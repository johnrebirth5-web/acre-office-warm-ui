import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAgentBillingChargesPost } from "./route";

function createChargesRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/accounting/agent-billing/charges`, {
    method: "POST",
    body,
    headers: {
      origin,
      "content-type": "application/json"
    }
  });
}

function createAccountingContext() {
  return {
    currentMembership: {
      id: "membership_actor",
      role: "office_admin",
      permissions: []
    },
    currentOrganization: {
      id: "org_1"
    },
    currentOffice: {
      id: "office_1"
    }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleCreateAgentBillingChargesPost returns 400 validation_error for empty membershipIds", async () => {
  const response = await handleCreateAgentBillingChargesPost(
    createChargesRequest(
      JSON.stringify({
        membershipIds: [],
        chargeType: "desk_fee",
        amount: "125.00",
        accountingDate: "2026-04-18"
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Agent billing charges payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      membershipIds: "membershipIds must include at least one agent."
    }
  });
});

test("handleCreateAgentBillingChargesPost forwards validated charge payload", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateAgentBillingChargesPost(
    createChargesRequest(
      JSON.stringify({
        membershipIds: ["membership_1", "membership_2"],
        chargeType: "desk_fee",
        description: "Monthly desk fee",
        amount: "125.00",
        accountingDate: "2026-04-18",
        dueDate: "2026-04-25",
        relatedTransactionId: "transaction_1",
        notes: "April cycle"
      })
    ),
    createAccountingContext(),
    {
      createAgentBillingCharges: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return ["txn_1", "txn_2"];
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipIds: ["membership_1", "membership_2"],
    chargeType: "desk_fee",
    description: "Monthly desk fee",
    amount: "125.00",
    accountingDate: "2026-04-18",
    dueDate: "2026-04-25",
    relatedTransactionId: "transaction_1",
    notes: "April cycle",
    createdByMembershipId: "membership_actor",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    transactionIds: ["txn_1", "txn_2"]
  });
});
