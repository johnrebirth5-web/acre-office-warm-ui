import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateCommissionCalculationPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/commissions/calculations/calc_1`, {
    method: "PATCH",
    body,
    headers: { origin, "content-type": "application/json" }
  });
}

function createContext() {
  return {
    currentMembership: { id: "membership_actor", role: "office_admin", permissions: [] },
    currentOrganization: { id: "org_1" },
    currentOffice: { id: "office_1" }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateCommissionCalculationPatch returns 400 validation_error for unsupported status", async () => {
  const response = await handleUpdateCommissionCalculationPatch(
    createRequest(JSON.stringify({ status: "approved" })),
    createContext(),
    "calc_1"
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission calculation payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      status:
        "Invalid option: expected one of \"draft\"|\"calculated\"|\"reviewed\"|\"statement_ready\"|\"payable\"|\"paid\""
    }
  });
});

test("handleUpdateCommissionCalculationPatch forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleUpdateCommissionCalculationPatch(
    createRequest(JSON.stringify({ status: "reviewed", notes: "Looks good." })),
    createContext(),
    "calc_1",
    {
      updateCommissionCalculationStatus: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "calc_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    calculationId: "calc_1",
    status: "reviewed",
    notes: "Looks good.",
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), { calculation: { id: "calc_1" } });
});
