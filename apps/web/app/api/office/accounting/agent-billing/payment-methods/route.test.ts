import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAgentBillingPaymentMethodPost } from "./route";

function createPaymentMethodRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/accounting/agent-billing/payment-methods`, {
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

test("handleCreateAgentBillingPaymentMethodPost returns 400 validation_error for unsupported payment method type", async () => {
  const response = await handleCreateAgentBillingPaymentMethodPost(
    createPaymentMethodRequest(
      JSON.stringify({
        membershipId: "membership_target",
        type: "crypto",
        label: "Primary card"
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Agent billing payment method payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      type:
        "Invalid option: expected one of \"card_on_file\"|\"bank_account\"|\"check\"|\"manual\"|\"other\""
    }
  });
});

test("handleCreateAgentBillingPaymentMethodPost forwards validated payment method payload", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateAgentBillingPaymentMethodPost(
    createPaymentMethodRequest(
      JSON.stringify({
        membershipId: "membership_target",
        type: "card_on_file",
        label: "Primary card",
        provider: "Stripe",
        last4: "4242",
        isDefault: true,
        autoPayEnabled: true,
        externalReferenceId: "pm_1",
        status: "active"
      })
    ),
    createAccountingContext(),
    {
      createAgentPaymentMethod: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "payment_method_1";
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_target",
    type: "card_on_file",
    label: "Primary card",
    provider: "Stripe",
    last4: "4242",
    isDefault: true,
    autoPayEnabled: true,
    externalReferenceId: "pm_1",
    status: "active",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    paymentMethodId: "payment_method_1"
  });
});
