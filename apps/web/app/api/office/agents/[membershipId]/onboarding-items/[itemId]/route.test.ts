import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAgentOnboardingItemPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/membership_2/onboarding-items/item_1`, {
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

test("handleUpdateAgentOnboardingItemPatch returns 400 validation_error for invalid status", async () => {
  const response = await handleUpdateAgentOnboardingItemPatch(
    createRequest(JSON.stringify({ status: "done" })),
    "membership_2",
    "item_1",
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleUpdateAgentOnboardingItemPatch forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleUpdateAgentOnboardingItemPatch(
    createRequest(JSON.stringify({ status: "completed" })),
    "membership_2",
    "item_1",
    createContext(),
    {
      updateAgentOnboardingItem: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "item_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["status"], "completed");
});
