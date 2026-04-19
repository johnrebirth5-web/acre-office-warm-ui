import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAccountingStatementStatusPatch } from "./route";

function createStatusRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/accounting/statements/statement_1/status`, {
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

test("handleUpdateAccountingStatementStatusPatch returns 400 validation_error for unsupported reviewStatus", async () => {
  const response = await handleUpdateAccountingStatementStatusPatch(
    createStatusRequest(
      JSON.stringify({
        reviewStatus: "archived"
      })
    ),
    "statement_1",
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "A valid statement status is required.",
    errorCode: "validation_error",
    fieldErrors: {
      reviewStatus:
        "Invalid option: expected one of \"draft\"|\"awaiting_agent\"|\"revision_requested\"|\"confirmed\"|\"paid\""
    }
  });
});

test("handleUpdateAccountingStatementStatusPatch forwards validated review status", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateAccountingStatementStatusPatch(
    createStatusRequest(
      JSON.stringify({
        reviewStatus: "confirmed"
      })
    ),
    "statement_1",
    createAccountingContext(),
    {
      updateAgentPayoutStatementReviewStatus: async (input) => {
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
    reviewStatus: "confirmed",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    id: "statement_1",
    reviewStatus: "confirmed"
  });
});
