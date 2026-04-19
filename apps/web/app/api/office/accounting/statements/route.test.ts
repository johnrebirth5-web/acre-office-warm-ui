import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAccountingStatementPost } from "./route";

function createStatementsRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/accounting/statements`, {
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

test("handleCreateAccountingStatementPost returns 400 validation_error when membershipId is blank", async () => {
  const response = await handleCreateAccountingStatementPost(
    createStatementsRequest(
      JSON.stringify({
        membershipId: "   "
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Accounting statement payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      membershipId: "membershipId is required."
    }
  });
});

test("handleCreateAccountingStatementPost forwards normalized create payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateAccountingStatementPost(
    createStatementsRequest(
      JSON.stringify({
        membershipId: "membership_target",
        invoiceNumbers: ["INV-1", "INV-2"],
        commissionCalculationIds: ["calc_1"]
      })
    ),
    createAccountingContext(),
    {
      createAgentPayoutStatement: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "statement_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_target",
    invoiceNumbers: ["INV-1", "INV-2"],
    commissionCalculationIds: ["calc_1"],
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    id: "statement_1"
  });
});
