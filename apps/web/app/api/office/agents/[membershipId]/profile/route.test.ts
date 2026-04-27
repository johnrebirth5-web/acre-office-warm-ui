import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSaveAgentProfilePatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/membership_2/profile`, {
    method: "PATCH",
    body,
    headers: { origin, "content-type": "application/json" }
  });
}

function createContext(manage = true) {
  return {
    currentMembership: { id: manage ? "membership_actor" : "membership_2", role: manage ? "office_admin" : "agent", permissions: manage ? ["agents:view", "agents:manage"] : [] },
    currentOrganization: { id: "org_1" },
    currentOffice: { id: "office_1" }
  } as never;
}

test("handleSaveAgentProfilePatch returns 400 validation_error for invalid bankAccountType", async () => {
  const response = await handleSaveAgentProfilePatch(
    createRequest(JSON.stringify({ bankAccountType: "crypto" })),
    "membership_2",
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleSaveAgentProfilePatch keeps self-service bank updates scoped to bank fields", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleSaveAgentProfilePatch(
    createRequest(JSON.stringify({ displayName: "Ignored", quickBooksVendorId: "Ignored", bankName: "Mercury" })),
    "membership_2",
    createContext(false),
    {
      saveAgentProfile: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "profile_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["displayName"], undefined);
  assert.equal(capturedInput?.["quickBooksVendorId"], undefined);
  assert.equal(capturedInput?.["bankName"], "Mercury");
});

test("handleSaveAgentProfilePatch lets admins save the QuickBooks vendor mapping", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleSaveAgentProfilePatch(
    createRequest(JSON.stringify({ quickBooksVendorId: "88" })),
    "membership_2",
    createContext(),
    {
      saveAgentProfile: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "profile_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["quickBooksVendorId"], "88");
});
