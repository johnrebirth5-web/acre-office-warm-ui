import assert from "node:assert/strict";
import test from "node:test";
import { type NextRequest } from "next/server";
import { buildFrontOfficeCleanupDigestDeliveryDraft } from "@acre/db";
import { handleCleanupDigestMailThreadPost } from "./route";

type RouteDependencies = NonNullable<
  Parameters<typeof handleCleanupDigestMailThreadPost>[2]
>;

type RecordedCleanupDigestThreadActivity = {
  organizationId: string;
  membershipId: string;
  officeId: string | null;
  threadId: string;
  threadSubject: string;
  contextHref?: string | null;
  runSummary: Record<string, unknown>;
};

function createRequest() {
  return new Request(
    "https://example.com/api/agent/notifications/cleanup-digest/mail-thread",
    {
      method: "POST",
    },
  ) as NextRequest;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function buildCleanupDigest() {
  return {
    generatedAtLabel: "April 9, 2026 at 10:00 AM",
    nextActionDetail: "Open the loudest unread cleanup signal first.",
    nextActionLabel: "Clear unread cleanup notifications",
    scopeLabel: "South Bay Office",
    sections: [],
    summary: {
      appointmentCount: 1,
      clientReminderCount: 2,
      dueSoonCount: 1,
      followUpTaskCount: 3,
      notificationCount: 4,
      totalCount: 7,
      urgentCount: 2,
    },
    timeZone: "America/New_York",
    windowLabel: "Next 7 days",
  } as never;
}

function buildDependencies(
  overrides: Partial<RouteDependencies>,
): RouteDependencies {
  return {
    getSessionContext: async () =>
      ({
        currentMembership: { id: "member_1" },
        currentOrganization: { id: "org_1" },
        currentOffice: { id: "office_1" },
        currentUser: { timezone: "America/New_York" },
      }) as never,
    canViewDashboard: () => true,
    canAccessOfficeMail: () => true,
    canSendOfficeMail: () => true,
    getCleanupDigest: async () => buildCleanupDigest(),
    buildDeliveryDraft: buildFrontOfficeCleanupDigestDeliveryDraft,
    resolveRecipientMembershipIds: async () => ["recipient_1"],
    createOfficeMailThread: async (input) =>
      ({
        id: "thread_123",
        subject: input.subject,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        actionLabel: input.actionLabel ?? null,
      }) as never,
    recordThreadOpenedActivity: async () => undefined,
    buildResponse: (input) => ({
      thread: {
        id: input.threadId,
        subject: input.subject,
      },
      threadHref: `/office/mail?threadId=${input.threadId}`,
      actionLabel: "Internal mail thread",
      actionTargetLabel: "Return to cleanup workbench",
      actionTargetUrl: input.actionUrl ?? null,
      manualOnlyDetail:
        "The Acre mail thread keeps the cleanup digest inside the workspace; the external send still stays manual and no provider sync is implied.",
      continuity: {
        label: "Cleanup digest thread opened",
        detail:
          "Acre created an internal mail thread for the cleanup digest so the continuity stays inside the workspace.",
        nextStep:
          "Review the Acre thread, then return to the cleanup digest workbench and keep the current cleanup queue visible.",
        sourceNote:
          "Internal mail continuity only; the outside send remains manual and no provider sync is implied.",
        returnToLabel: "Return to workbench",
        returnToDetail:
          "Jump back to the cleanup digest workbench after reviewing the thread, then continue the manual cleanup pass.",
        returnToUrl: input.actionUrl ?? null,
      },
    }),
    mapErrorStatus: (message: string) => {
      if (message.includes("recipients")) {
        return {
          status: 409 as const,
          hint: "If internal mail access is unavailable, keep working from the cleanup digest workbench instead.",
        };
      }

      return {
        status: 400 as const,
        hint: null,
      };
    },
    ...overrides,
  };
}

test("returns 401 when cleanup digest mail thread access is unauthenticated", async () => {
  const response = await handleCleanupDigestMailThreadPost(
    createRequest(),
    {},
    buildDependencies({
      getSessionContext: async () => null,
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "Authentication required.",
  });
});

test("returns 403 when dashboard access is missing", async () => {
  const response = await handleCleanupDigestMailThreadPost(
    createRequest(),
    {},
    buildDependencies({
      canViewDashboard: () => false,
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Front Office dashboard access required.",
  });
});

test("returns 403 when mail access is missing", async () => {
  const response = await handleCleanupDigestMailThreadPost(
    createRequest(),
    {},
    buildDependencies({
      canAccessOfficeMail: () => false,
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Mail access required.",
  });
});

test("returns 409 when no internal mail recipients are available", async () => {
  const response = await handleCleanupDigestMailThreadPost(
    createRequest(),
    {},
    buildDependencies({
      resolveRecipientMembershipIds: async () => {
        throw new Error(
          "No internal mail recipients are available for the cleanup digest thread.",
        );
      },
    }),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await readJson(response), {
    error:
      "No internal mail recipients are available for the cleanup digest thread.",
    hint: "If internal mail access is unavailable, keep working from the cleanup digest workbench instead.",
  });
});

test("returns 201 and a no-store internal mail thread response when the cleanup digest is available", async () => {
  let recordedThreadActivity: RecordedCleanupDigestThreadActivity | null = null;

  const recordThreadOpenedActivity: RouteDependencies["recordThreadOpenedActivity"] =
    async (_writer, input) => {
      const typedInput = input as unknown as {
        organizationId: string;
        membershipId: string;
        officeId?: string | null;
        threadId: string;
        threadSubject: string;
        contextHref?: string | null;
        runSummary: Record<string, unknown>;
      };

      recordedThreadActivity = {
        organizationId: typedInput.organizationId,
        membershipId: typedInput.membershipId,
        officeId: typedInput.officeId ?? null,
        threadId: typedInput.threadId,
        threadSubject: typedInput.threadSubject,
        contextHref: typedInput.contextHref ?? null,
        runSummary: typedInput.runSummary,
      };
    };

  const response = await handleCleanupDigestMailThreadPost(
    createRequest(),
    {},
    buildDependencies({
      recordThreadOpenedActivity,
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await readJson(response), {
    thread: {
      id: "thread_123",
      subject: "South Bay Office: 7 item(s), 2 urgent, 1 due soon",
    },
    threadHref: "/office/mail?threadId=thread_123",
    actionLabel: "Internal mail thread",
    actionTargetLabel: "Return to cleanup workbench",
    actionTargetUrl: "/agent/notifications",
    manualOnlyDetail:
      "The Acre mail thread keeps the cleanup digest inside the workspace; the external send still stays manual and no provider sync is implied.",
    continuity: {
      label: "Cleanup digest thread opened",
      detail:
        "Acre created an internal mail thread for the cleanup digest so the continuity stays inside the workspace.",
      nextStep:
        "Review the Acre thread, then return to the cleanup digest workbench and keep the current cleanup queue visible.",
      sourceNote:
        "Internal mail continuity only; the outside send remains manual and no provider sync is implied.",
      returnToLabel: "Return to workbench",
      returnToDetail:
        "Jump back to the cleanup digest workbench after reviewing the thread, then continue the manual cleanup pass.",
      returnToUrl: "/agent/notifications",
    },
  });
  assert.ok(recordedThreadActivity);
  const threadActivity =
    recordedThreadActivity as RecordedCleanupDigestThreadActivity;
  assert.equal(threadActivity.organizationId, "org_1");
  assert.equal(threadActivity.membershipId, "member_1");
  assert.equal(threadActivity.officeId, "office_1");
  assert.equal(threadActivity.threadId, "thread_123");
  assert.equal(
    threadActivity.threadSubject,
    "South Bay Office: 7 item(s), 2 urgent, 1 due soon",
  );
  assert.equal(threadActivity.contextHref, "/agent/notifications");
  assert.equal(
    threadActivity.runSummary.scopeLabel,
    "South Bay Office",
  );
});
