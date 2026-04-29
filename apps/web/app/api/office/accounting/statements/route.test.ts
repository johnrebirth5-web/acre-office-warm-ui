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

function createStatementEmailContext() {
  return {
    statementId: "statement_1",
    membershipId: "membership_target",
    agentLabel: "Ada Agent",
    agentEmail: "agent@example.com",
    organizationLabel: "Acre",
    officeLabel: "Acre NY Realty",
    periodLabel: "Apr 1, 2026 to Apr 30, 2026",
    reviewStatus: "draft",
    reviewStatusLabel: "Draft",
    totalStatementAmountLabel: "$1,250.00",
    totalStatementAmountValue: "1250",
    invoiceNumbers: ["INV-1", "INV-2"],
    lineItemCount: 2,
    workspaceHref: "/office/accounting?membershipId=membership_target&statementId=statement_1",
    selfServiceHref: "/office/payout-statements/statement_1",
    quickBooksBillStatus: "not_posted",
    quickBooksBillStatusLabel: "Not posted",
    quickBooksBillId: "",
    quickBooksBillDocNumber: ""
  } as never;
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
          statementId: "statement_1"
        };
      },
      getAgentPayoutStatementEmailContext: async () => null
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
    statementId: "statement_1"
  });
});

test("handleCreateAccountingStatementPost sends finance a generated statement reminder", async () => {
  let capturedEmailInput: Record<string, unknown> | null = null;

  const response = await handleCreateAccountingStatementPost(
    createStatementsRequest(
      JSON.stringify({
        membershipId: "membership_target",
        invoiceNumbers: ["INV-1"],
        commissionCalculationIds: []
      })
    ),
    createAccountingContext(),
    {
      createAgentPayoutStatement: async () => ({
        statementId: "statement_1"
      }),
      getAgentPayoutStatementEmailContext: async (input) => {
        assert.equal(input.statementId, "statement_1");
        return createStatementEmailContext();
      },
      sendPayoutStatementGeneratedOperationalEmail: async (input) => {
        capturedEmailInput = input as unknown as Record<string, unknown>;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.equal(capturedEmailInput?.["organizationId"], "org_1");
  assert.equal(capturedEmailInput?.["baseUrl"], "http://localhost:3105");
  assert.deepEqual(await readJson(response), {
    statementId: "statement_1"
  });
});
