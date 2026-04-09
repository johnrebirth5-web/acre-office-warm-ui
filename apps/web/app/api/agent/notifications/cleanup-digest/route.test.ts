import assert from "node:assert/strict";
import test from "node:test";
import { type NextRequest } from "next/server";
import { buildFrontOfficeCleanupDigestDeliveryDraft } from "@acre/db";
import { handleCleanupDigestPost } from "./route";

type RouteDependencies = NonNullable<
  Parameters<typeof handleCleanupDigestPost>[1]
>;

type RecordedCleanupDigestRunActivity = {
  organizationId: string;
  membershipId: string;
  officeId: string | null;
  runSummary: Record<string, unknown>;
  contextHref?: string | null;
  objectLabel?: string;
};

function createRequest() {
  const url =
    "https://example.com/api/agent/notifications/cleanup-digest?timeZone=America/New_York";
  return Object.assign(
    new Request(url, {
      method: "POST",
    }),
    {
      nextUrl: new URL(url),
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
    canViewCleanupDigest: () => true,
    getCleanupDigest: async () => buildCleanupDigest(),
    buildDeliveryDraft: buildFrontOfficeCleanupDigestDeliveryDraft,
    recordRunActivity: async () => undefined,
    ...overrides,
  };
}

test("returns 401 when cleanup digest manual run access is unauthenticated", async () => {
  const response = await handleCleanupDigestPost(
    createRequest(),
    buildDependencies({
      getSessionContext: async () => null,
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "Authentication required.",
  });
});

test("returns 403 when cleanup digest access is missing", async () => {
  const response = await handleCleanupDigestPost(
    createRequest(),
    buildDependencies({
      canViewCleanupDigest: () => false,
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Cleanup digest access required.",
  });
});

test("returns 200, no-store, and records the cleanup digest manual run activity", async () => {
  let recordedActivity: RecordedCleanupDigestRunActivity | null = null;

  const recordRunActivity: RouteDependencies["recordRunActivity"] = async (
    _writer,
    input,
  ) => {
    const typedInput = input as unknown as {
      organizationId: string;
      membershipId: string;
      officeId?: string | null;
      runSummary: Record<string, unknown>;
      contextHref?: string | null;
      objectLabel?: string;
    };

    recordedActivity = {
      organizationId: typedInput.organizationId,
      membershipId: typedInput.membershipId,
      officeId: typedInput.officeId ?? null,
      runSummary: typedInput.runSummary,
      contextHref: typedInput.contextHref ?? null,
      objectLabel: typedInput.objectLabel,
    };
  };

  const response = await handleCleanupDigestPost(
    createRequest(),
    buildDependencies({
      recordRunActivity,
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await readJson(response), {
    ok: true,
    executionMode: "manual-run",
    activityLabel: "Cleanup digest run recorded",
    manualOnlyDetail: "Manual-only. No scheduler. No provider sync.",
    mailThreadHref: "/api/agent/notifications/cleanup-digest/mail-thread",
    digest: buildCleanupDigest(),
  });
  assert.ok(recordedActivity);
  const activity = recordedActivity as RecordedCleanupDigestRunActivity;
  assert.equal(activity.organizationId, "org_1");
  assert.equal(activity.membershipId, "member_1");
  assert.equal(activity.officeId, "office_1");
  assert.equal(activity.contextHref, "/agent/notifications");
  assert.equal(activity.objectLabel, "Cleanup digest manual run");
  assert.equal(activity.runSummary.scopeLabel, "South Bay Office");
});
