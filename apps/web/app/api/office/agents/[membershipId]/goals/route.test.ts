import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAgentGoalPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/membership_2/goals`, {
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

test("handleCreateAgentGoalPost returns 400 validation_error for invalid periodType", async () => {
  const response = await handleCreateAgentGoalPost(
    createRequest(JSON.stringify({ periodType: "weekly" })),
    "membership_2",
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleCreateAgentGoalPost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateAgentGoalPost(
    createRequest(JSON.stringify({ periodType: "monthly", startsAt: "2026-04-01" })),
    "membership_2",
    createContext(),
    {
      createAgentGoal: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "goal_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.equal(capturedInput?.["periodType"], "monthly");
});
