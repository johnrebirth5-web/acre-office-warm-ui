import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAgentBillingPaymentPost } from "./route";

function createPaymentsRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/accounting/agent-billing/payments`, {
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

test("handleCreateAgentBillingPaymentPost returns 400 validation_error for empty invoiceIds", async () => {
  const response = await handleCreateAgentBillingPaymentPost(
    createPaymentsRequest(
      JSON.stringify({
        membershipId: "membership_target",
        invoiceIds: [],
        accountingDate: "2026-04-18",
        paymentMethod: "ach"
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Agent billing payment payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      invoiceIds: "invoiceIds must include at least one invoice."
    }
  });
});

test("handleCreateAgentBillingPaymentPost forwards validated payment payload", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateAgentBillingPaymentPost(
    createPaymentsRequest(
      JSON.stringify({
        membershipId: "membership_target",
        invoiceIds: ["invoice_1", "invoice_2"],
        amount: "300.00",
        accountingDate: "2026-04-18",
        paymentMethod: "ach",
        referenceNumber: "REF-1",
        notes: "ACH batch"
      })
    ),
    createAccountingContext(),
    {
      recordAgentBillingPayment: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "payment_1";
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_target",
    invoiceIds: ["invoice_1", "invoice_2"],
    amount: "300.00",
    accountingDate: "2026-04-18",
    paymentMethod: "ach",
    referenceNumber: "REF-1",
    notes: "ACH batch",
    createdByMembershipId: "membership_actor",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    paymentId: "payment_1"
  });
});
