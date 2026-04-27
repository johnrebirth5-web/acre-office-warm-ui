import assert from "node:assert/strict";
import test from "node:test";
import { handleQuickBooksSettingsDelete } from "./route";

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

test("handleQuickBooksSettingsDelete removes the organization connection", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleQuickBooksSettingsDelete(createSessionContext(), {
    deleteOrganizationQuickBooksConnection: async (input) => {
      capturedInput = input as Record<string, unknown>;
      return { id: "quickbooks_1" } as never;
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
  });
  assert.deepEqual(await readJson(response), {
    snapshot: {
      id: "quickbooks_1",
    },
  });
});
