import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAccountingStatementPatch } from "./route";

function createStatementRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/accounting/statements/statement_1`, {
    method: "PATCH",
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

test("handleUpdateAccountingStatementPatch returns 400 validation_error for non-array manualLineItems", async () => {
  const response = await handleUpdateAccountingStatementPatch(
    createStatementRequest(
      JSON.stringify({
        manualLineItems: "bad"
      })
    ),
    "statement_1",
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Statement manual line items payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      manualLineItems: "Invalid input: expected array, received string"
    }
  });
});

test("handleUpdateAccountingStatementPatch forwards normalized manual line items", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateAccountingStatementPatch(
    createStatementRequest(
      JSON.stringify({
        manualLineItems: [
          {
            id: "line_1",
            memo: "Adjustment",
            amount: "125.00"
          },
          {
            memo: "Second",
            amount: "75.00"
          }
        ]
      })
    ),
    "statement_1",
    createAccountingContext(),
    {
      updateAgentPayoutStatementManualLineItems: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "statement_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    statementId: "statement_1",
    manualLineItems: [
      {
        id: "line_1",
        memo: "Adjustment",
        amount: "125.00"
      },
      {
        memo: "Second",
        amount: "75.00"
      }
    ],
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    id: "statement_1"
  });
});
