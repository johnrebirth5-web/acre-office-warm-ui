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
          id: "statement_1",
          reviewStatus: "confirmed"
        } as never;
      }
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
    id: "statement_1",
    reviewStatus: "confirmed"
  });
});
