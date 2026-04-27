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
    currentMembership: manage
      ? { id: "membership_actor", role: "office_admin" }
      : { id: "membership_2", role: "agent", permissions: [] },
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

test("handleSaveAgentProfilePatch accepts blank bank select values when saving profile basics", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleSaveAgentProfilePatch(
    createRequest(
      JSON.stringify({
        customAgentPercent: "50",
        commissionEffectiveFrom: "2026-04-27",
        bankTaxIdType: "",
        bankAccountType: ""
      })
    ),
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
  assert.equal(capturedInput?.["customAgentPercent"], "50");
  assert.equal(capturedInput?.["commissionEffectiveFrom"], "2026-04-27");
  assert.equal(capturedInput?.["bankTaxIdType"], "");
  assert.equal(capturedInput?.["bankAccountType"], "");
});

test("handleSaveAgentProfilePatch keeps self-service bank updates scoped to bank fields", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleSaveAgentProfilePatch(
    createRequest(JSON.stringify({ displayName: "Ignored", bankName: "Mercury" })),
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
  assert.equal(capturedInput?.["bankName"], "Mercury");
});
