import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSendAccountingStatementPost } from "./route";

function createSendRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/accounting/statements/statement_1/send`, {
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
    membershipId: "membership_agent",
    agentLabel: "Ada Agent",
    agentEmail: "agent@example.com",
    organizationLabel: "Acre",
    officeLabel: "Acre NY Realty",
    periodLabel: "Apr 1, 2026 to Apr 30, 2026",
    reviewStatus: "awaiting_agent",
    reviewStatusLabel: "Awaiting agent",
    totalStatementAmountLabel: "$1,250.00",
    totalStatementAmountValue: "1250",
    invoiceNumbers: ["INV-1"],
    lineItemCount: 1,
    workspaceHref: "/office/accounting?membershipId=membership_agent&statementId=statement_1",
    selfServiceHref: "/office/payout-statements/statement_1",
    quickBooksBillStatus: "not_posted",
    quickBooksBillStatusLabel: "Not posted",
    quickBooksBillId: "",
    quickBooksBillDocNumber: ""
  } as never;
}

test("handleSendAccountingStatementPost returns 400 validation_error for non-string message", async () => {
  const response = await handleSendAccountingStatementPost(
    createSendRequest(
      JSON.stringify({
        message: 100
      })
    ),
    "statement_1",
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Statement send payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      message: "Invalid input: expected string, received number"
    }
  });
});

test("handleSendAccountingStatementPost forwards validated send payload", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleSendAccountingStatementPost(
    createSendRequest(
      JSON.stringify({
        message: "Please review this statement."
      })
    ),
    "statement_1",
    createAccountingContext(),
    {
      sendAgentPayoutStatementToAgent: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          statementId: "statement_1"
        } as never;
      },
      getAgentPayoutStatementEmailContext: async () => null
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    statementId: "statement_1",
    actorMembershipId: "membership_actor",
    message: "Please review this statement."
  });
  assert.deepEqual(await readJson(response), {
    statementId: "statement_1"
  });
});

test("handleSendAccountingStatementPost emails the agent and finance after sending", async () => {
  let capturedEmailInput: Record<string, unknown> | null = null;

  const response = await handleSendAccountingStatementPost(
    createSendRequest(
      JSON.stringify({
        message: "Please review this statement."
      })
    ),
    "statement_1",
    createAccountingContext(),
    {
      sendAgentPayoutStatementToAgent: async () =>
        ({
          statementId: "statement_1"
        }) as never,
      getAgentPayoutStatementEmailContext: async (input) => {
        assert.equal(input.statementId, "statement_1");
        return createStatementEmailContext();
      },
      sendPayoutStatementSentOperationalEmail: async (input) => {
        capturedEmailInput = input as unknown as Record<string, unknown>;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedEmailInput?.["organizationId"], "org_1");
  assert.equal(capturedEmailInput?.["baseUrl"], "http://localhost:3105");
});
