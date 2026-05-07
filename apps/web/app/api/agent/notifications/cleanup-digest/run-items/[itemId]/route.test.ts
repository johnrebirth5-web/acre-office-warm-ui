import assert from "node:assert/strict";
import test from "node:test";
import { type NextRequest } from "next/server";
import { handleCleanupDigestRunItemPatch } from "./route";

type RouteDependencies = NonNullable<
  Parameters<typeof handleCleanupDigestRunItemPatch>[2]
>;

type UpdatedRunItemInput = {
  itemId: string;
  membershipId: string;
  organizationId: string;
  status: string;
  timeZone?: string | null;
};

function createRequest(body: Record<string, unknown> = { status: "completed" }) {
  const url =
    "https://example.com/api/agent/notifications/cleanup-digest/run-items/item_1?timeZone=America/New_York";

  return Object.assign(
    new Request(url, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }),
    {
      nextUrl: new URL(url),
    },
  ) as NextRequest;
}

function createRouteContext(itemId = "item_1") {
  return {
    params: Promise.resolve({
      itemId,
    }),
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function buildCleanupRun() {
  return {
    completedAtLabel: null,
    createdAtLabel: "April 9, 2026 at 10:00 AM",
    id: "cleanup_run_1",
    items: [
      {
        actionDetail: "Open the client record and update the reminder.",
        actionLabel: "Open follow-up",
        destinationLabel: "Client follow-up",
        detail: "Client: Cleanup Client · Status: queued",
        dueAtLabel: "April 9, 2026 at 11:00 AM",
        href: "/agent/clients/client_1",
        id: "item_1",
        sortOrder: 0,
        status: "completed",
        statusLabel: "Done",
        statusTone: "success",
        statusUpdatedAtLabel: "April 9, 2026 at 10:05 AM",
        title: "Follow-up cleanup",
        tone: "danger",
      },
    ],
    progress: {
      completedCount: 1,
      handledCount: 1,
      openCount: 0,
      pendingCount: 0,
      percentComplete: 100,
      revisitCount: 0,
      skippedCount: 0,
      totalCount: 1,
    },
    scopeLabel: "Office cleanup digest",
    status: "completed",
    statusLabel: "Completed",
    statusTone: "success",
    timeZone: "America/New_York",
    updatedAtLabel: "April 9, 2026 at 10:05 AM",
    windowLabel: "Next 7 days",
  } as never;
}

function buildDependencies(
  overrides: Partial<RouteDependencies> = {},
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
    updateRunItemStatus: async () => buildCleanupRun(),
    ...overrides,
  };
}

test("returns 401 when cleanup run item access is unauthenticated", async () => {
  const response = await handleCleanupDigestRunItemPatch(
    createRequest(),
    createRouteContext(),
    buildDependencies({
      getSessionContext: async () => null,
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "Authentication required.",
  });
});

test("returns 403 when cleanup run item access is missing", async () => {
  const response = await handleCleanupDigestRunItemPatch(
    createRequest(),
    createRouteContext(),
    buildDependencies({
      canViewCleanupDigest: () => false,
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Cleanup digest access required.",
  });
});

test("returns 400 when cleanup run item status is invalid", async () => {
  const response = await handleCleanupDigestRunItemPatch(
    createRequest({ status: "sent_to_provider" }),
    createRouteContext(),
    buildDependencies(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "A valid cleanup run item status is required.",
  });
});

test("returns 404 when cleanup run item cannot be found", async () => {
  const response = await handleCleanupDigestRunItemPatch(
    createRequest(),
    createRouteContext(),
    buildDependencies({
      updateRunItemStatus: async () => null,
    }),
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await readJson(response), {
    error: "Cleanup run item not found.",
  });
});

test("returns 200, no-store, and updates the cleanup run item status", async () => {
  let updatedRunItemInput: UpdatedRunItemInput | null = null;

  const response = await handleCleanupDigestRunItemPatch(
    createRequest(),
    createRouteContext(),
    buildDependencies({
      updateRunItemStatus: async (_writer, input) => {
        updatedRunItemInput = {
          itemId: input.itemId,
          membershipId: input.membershipId,
          organizationId: input.organizationId,
          status: input.status,
          timeZone: input.timeZone ?? null,
        };

        return buildCleanupRun();
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await readJson(response), {
    ok: true,
    itemId: "item_1",
    status: "completed",
    manualOnlyDetail:
      "Checklist status updated in Acre only. No scheduler or provider sync ran.",
    run: buildCleanupRun(),
  });
  assert.ok(updatedRunItemInput);
  const input = updatedRunItemInput as UpdatedRunItemInput;
  assert.equal(input.organizationId, "org_1");
  assert.equal(input.membershipId, "member_1");
  assert.equal(input.itemId, "item_1");
  assert.equal(input.status, "completed");
  assert.equal(input.timeZone, "America/New_York");
});
