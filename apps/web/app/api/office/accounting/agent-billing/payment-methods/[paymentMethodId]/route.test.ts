import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAgentBillingPaymentMethodPatch } from "./route";

function createPaymentMethodRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(
    `${origin}/api/office/accounting/agent-billing/payment-methods/payment_method_1`,
    {
      method: "PATCH",
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

test("handleUpdateAgentBillingPaymentMethodPatch returns 400 validation_error for invalid status", async () => {
  const response = await handleUpdateAgentBillingPaymentMethodPatch(
    createPaymentMethodRequest(
      JSON.stringify({
        status: "archived"
      })
    ),
    "payment_method_1",
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Agent billing payment method payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      status:
        "Invalid option: expected one of \"active\"|\"inactive\"|\"invalid\"|\"expired\"|\"removed\""
    }
  });
});

test("handleUpdateAgentBillingPaymentMethodPatch forwards validated payment method updates", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateAgentBillingPaymentMethodPatch(
    createPaymentMethodRequest(
      JSON.stringify({
        label: "Updated card",
        provider: "Stripe",
        status: "inactive",
        isDefault: false
      })
    ),
    "payment_method_1",
    createAccountingContext(),
    {
      updateAgentPaymentMethod: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "payment_method_1";
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    paymentMethodId: "payment_method_1",
    officeId: "office_1",
    membershipId: undefined,
    type: undefined,
    label: "Updated card",
    provider: "Stripe",
    last4: undefined,
    isDefault: false,
    autoPayEnabled: undefined,
    externalReferenceId: undefined,
    status: "inactive",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    paymentMethodId: "payment_method_1"
  });
});
