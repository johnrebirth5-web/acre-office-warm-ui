import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeBillingPaymentMethodPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/billing/payment-methods/pm_1`, {
    method: "PATCH",
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

test("handleUpdateOfficeBillingPaymentMethodPatch returns 400 validation_error for invalid action", async () => {
  const response = await handleUpdateOfficeBillingPaymentMethodPatch(
    createRequest(JSON.stringify({ action: "archive" })),
    createContext(),
    "pm_1"
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Billing payment method payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      action: "Invalid input: expected \"remove\""
    }
  });
});

test("handleUpdateOfficeBillingPaymentMethodPatch forwards remove action", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleUpdateOfficeBillingPaymentMethodPatch(
    createRequest(JSON.stringify({ action: "remove" })),
    createContext(),
    "pm_1",
    {
      updateOfficeBillingPaymentMethod: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "pm_1";
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_actor",
    paymentMethodId: "pm_1",
    type: undefined,
    label: undefined,
    provider: undefined,
    last4: undefined,
    isDefault: undefined,
    autoPayEnabled: undefined,
    remove: true,
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), { paymentMethodId: "pm_1" });
});
