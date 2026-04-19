import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleGenerateAgentBillingChargesPost } from "./route";

function createRecurringGenerateRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(
    `${origin}/api/office/accounting/agent-billing/recurring-rules/generate`,
    {
      method: "POST",
      body,
      headers: {
        origin,
        "content-type": "application/json"
      }
    }
  );
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

test("handleGenerateAgentBillingChargesPost returns 400 validation_error for non-string asOfDate", async () => {
  const response = await handleGenerateAgentBillingChargesPost(
    createRecurringGenerateRequest(
      JSON.stringify({
        asOfDate: 100
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Recurring billing charge generation payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      asOfDate: "Invalid input: expected string, received number"
    }
  });
});

test("handleGenerateAgentBillingChargesPost forwards validated generation payload", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleGenerateAgentBillingChargesPost(
    createRecurringGenerateRequest(
      JSON.stringify({
        membershipId: "membership_target",
        asOfDate: "2026-04-30"
      })
    ),
    createAccountingContext(),
    {
      generateDueAgentBillingCharges: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return ["txn_1", "txn_2"];
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_target",
    asOfDate: "2026-04-30",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    transactionIds: ["txn_1", "txn_2"]
  });
});
