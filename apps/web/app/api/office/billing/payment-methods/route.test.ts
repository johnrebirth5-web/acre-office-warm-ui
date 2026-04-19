import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeBillingPaymentMethodPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/billing/payment-methods`, {
    method: "POST",
    body,
    headers: { origin, "content-type": "application/json" }
  });
}

function createContext() {
  return {
    currentMembership: { id: "membership_actor", role: "agent", permissions: [] },
    currentOrganization: { id: "org_1" },
    currentOffice: { id: "office_1" }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleCreateOfficeBillingPaymentMethodPost returns 400 validation_error for invalid type", async () => {
  const response = await handleCreateOfficeBillingPaymentMethodPost(
    createRequest(JSON.stringify({ type: "wallet", label: "Primary" })),
    createContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Billing payment method payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      type:
        "Invalid option: expected one of \"card_on_file\"|\"bank_account\"|\"check\"|\"manual\"|\"other\""
    }
  });
});

test("handleCreateOfficeBillingPaymentMethodPost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateOfficeBillingPaymentMethodPost(
    createRequest(JSON.stringify({ type: "bank_account", label: "Main checking", autoPayEnabled: true })),
    createContext(),
    {
      createOfficeBillingPaymentMethod: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "pm_1";
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_actor",
    type: "bank_account",
    label: "Main checking",
    provider: "",
    last4: "",
    isDefault: undefined,
    autoPayEnabled: true,
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), { paymentMethodId: "pm_1" });
});
