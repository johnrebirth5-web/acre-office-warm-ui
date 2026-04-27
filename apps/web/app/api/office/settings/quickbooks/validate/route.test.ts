import assert from "node:assert/strict";
import test from "node:test";
import { handleQuickBooksValidatePost } from "./route";

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleQuickBooksValidatePost validates the current organization connection", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleQuickBooksValidatePost(createSessionContext(), {
    validateOrganizationQuickBooksConnection: async (input) => {
      capturedInput = input as Record<string, unknown>;
      return { status: "connected" } as never;
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
  });
  assert.deepEqual(await readJson(response), {
    snapshot: {
      status: "connected",
    },
  });
});

test("handleQuickBooksValidatePost returns 400 when validation fails", async () => {
  const response = await handleQuickBooksValidatePost(createSessionContext(), {
    validateOrganizationQuickBooksConnection: async () => {
      throw new Error("QuickBooks is not connected.");
    },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "QuickBooks is not connected.",
  });
});
