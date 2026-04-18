import assert from "node:assert/strict";
import test from "node:test";
import { handleUnlockOfficeUserPost } from "./route";

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["users.manage"],
      role: "office_admin",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUnlockOfficeUserPost calls unlockInternalAccount with the current actor and target membership", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUnlockOfficeUserPost(
    "membership_2",
    createSessionContext(),
    {
      unlockInternalAccount: async (input) => {
        capturedInput = input as Record<string, unknown>;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    membershipId: "membership_2",
  });
  assert.deepEqual(await readJson(response), {
    membershipId: "membership_2",
    unlocked: true,
  });
});

test("handleUnlockOfficeUserPost preserves service-level unlock errors", async () => {
  const response = await handleUnlockOfficeUserPost(
    "membership_2",
    createSessionContext(),
    {
      unlockInternalAccount: async () => {
        throw new Error("Account is already active.");
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Account is already active.",
  });
});
