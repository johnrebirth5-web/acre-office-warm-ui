import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAgentOnboardingItemPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/membership_2/onboarding-items`, {
    method: "POST",
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

test("handleCreateAgentOnboardingItemPost returns 400 validation_error for blank title", async () => {
  const response = await handleCreateAgentOnboardingItemPost(
    createRequest(JSON.stringify({ title: " " })),
    "membership_2",
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleCreateAgentOnboardingItemPost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateAgentOnboardingItemPost(
    createRequest(JSON.stringify({ title: "Upload W9", category: "Compliance" })),
    "membership_2",
    createContext(),
    {
      createAgentOnboardingItem: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "item_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.equal(capturedInput?.["title"], "Upload W9");
});
