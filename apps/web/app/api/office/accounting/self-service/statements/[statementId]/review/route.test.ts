import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleReviewAccountingStatementPost } from "./route";

function createReviewRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(
    `${origin}/api/office/accounting/self-service/statements/statement_1/review`,
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
      role: "office_user",
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

function createStatementEmailContext(overrides: Record<string, unknown> = {}) {
  return {
    statementId: "statement_1",
    membershipId: "membership_actor",
    agentLabel: "Ada Agent",
    agentEmail: "agent@example.com",
    organizationLabel: "Acre",
    officeLabel: "Acre NY Realty",
    periodLabel: "Apr 1, 2026 to Apr 30, 2026",
    reviewStatus: "confirmed",
    reviewStatusLabel: "Confirmed",
    totalStatementAmountLabel: "$1,250.00",
    totalStatementAmountValue: "1250",
    invoiceNumbers: ["INV-1"],
    lineItemCount: 1,
    workspaceHref: "/office/accounting?membershipId=membership_actor&statementId=statement_1",
    selfServiceHref: "/office/payout-statements/statement_1",
    quickBooksBillStatus: "not_posted",
    quickBooksBillStatusLabel: "Not posted",
    quickBooksBillId: "",
    quickBooksBillDocNumber: "",
    ...overrides
  } as never;
}

test("handleReviewAccountingStatementPost returns 400 validation_error for unsupported response", async () => {
  const response = await handleReviewAccountingStatementPost(
    createReviewRequest(
      JSON.stringify({
        response: "reject"
      })
    ),
    "statement_1",
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Statement review payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      response: "Invalid option: expected one of \"confirm\"|\"request_revision\""
    }
  });
});

test("handleReviewAccountingStatementPost defaults missing response to confirm", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleReviewAccountingStatementPost(
    createReviewRequest(
      JSON.stringify({
        message: "Looks good."
      })
    ),
    "statement_1",
    createAccountingContext(),
    {
      respondToAgentPayoutStatement: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          statementId: "statement_1",
          reviewStatus: "confirmed"
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
    response: "confirm",
    message: "Looks good."
  });
  assert.deepEqual(await readJson(response), {
    statementId: "statement_1",
    reviewStatus: "confirmed"
  });
});

test("handleReviewAccountingStatementPost sends confirmation review emails", async () => {
  let capturedEmailInput: Record<string, unknown> | null = null;

  const response = await handleReviewAccountingStatementPost(
    createReviewRequest(
      JSON.stringify({
        response: "confirm",
        message: "Looks good."
      })
    ),
    "statement_1",
    createAccountingContext(),
    {
      respondToAgentPayoutStatement: async () =>
        ({
          statementId: "statement_1",
          reviewStatus: "confirmed"
        }) as never,
      getAgentPayoutStatementEmailContext: async () => createStatementEmailContext(),
      sendPayoutStatementReviewOperationalEmail: async (input) => {
        capturedEmailInput = input as unknown as Record<string, unknown>;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedEmailInput?.["response"], "confirm");
  assert.equal(capturedEmailInput?.["baseUrl"], "https://acresystem.us");
});

test("handleReviewAccountingStatementPost sends revision request review emails", async () => {
  let capturedEmailInput: Record<string, unknown> | null = null;

  const response = await handleReviewAccountingStatementPost(
    createReviewRequest(
      JSON.stringify({
        response: "request_revision",
        message: "Please update the split."
      })
    ),
    "statement_1",
    createAccountingContext(),
    {
      respondToAgentPayoutStatement: async () =>
        ({
          statementId: "statement_1",
          reviewStatus: "revision_requested"
        }) as never,
      getAgentPayoutStatementEmailContext: async () =>
        createStatementEmailContext({
          reviewStatus: "revision_requested",
          reviewStatusLabel: "Revision requested"
        }),
      sendPayoutStatementReviewOperationalEmail: async (input) => {
        capturedEmailInput = input as unknown as Record<string, unknown>;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedEmailInput?.["response"], "request_revision");
  assert.equal(capturedEmailInput?.["message"], "Please update the split.");
});
