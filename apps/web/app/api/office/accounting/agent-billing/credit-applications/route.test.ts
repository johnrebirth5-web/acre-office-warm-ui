import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAgentBillingCreditApplicationPost } from "./route";

function createCreditApplicationRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(
    `${origin}/api/office/accounting/agent-billing/credit-applications`,
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

test("handleCreateAgentBillingCreditApplicationPost returns 400 validation_error for blank creditMemoId", async () => {
  const response = await handleCreateAgentBillingCreditApplicationPost(
    createCreditApplicationRequest(
      JSON.stringify({
        creditMemoId: "   ",
        invoiceId: "invoice_1"
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Agent billing credit application payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      creditMemoId: "creditMemoId is required."
    }
  });
});

test("handleCreateAgentBillingCreditApplicationPost forwards validated credit application payload", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateAgentBillingCreditApplicationPost(
    createCreditApplicationRequest(
      JSON.stringify({
        creditMemoId: "credit_1",
        invoiceId: "invoice_1",
        amount: "75.00",
        memo: "Apply partial credit"
      })
    ),
    createAccountingContext(),
    {
      applyAgentBillingCreditMemo: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          creditMemoId: "credit_1",
          invoiceId: "invoice_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    creditMemoId: "credit_1",
    invoiceId: "invoice_1",
    amount: "75.00",
    memo: "Apply partial credit",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    result: {
      creditMemoId: "credit_1",
      invoiceId: "invoice_1"
    }
  });
});
