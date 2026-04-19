import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAgentGoalPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/membership_2/goals/goal_1`, {
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

test("handleUpdateAgentGoalPatch returns 400 validation_error for invalid periodType", async () => {
  const response = await handleUpdateAgentGoalPatch(
    createRequest(JSON.stringify({ periodType: "weekly" })),
    "membership_2",
    "goal_1",
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleUpdateAgentGoalPatch forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleUpdateAgentGoalPatch(
    createRequest(JSON.stringify({ periodType: "quarterly", notes: "Stretch" })),
    "membership_2",
    "goal_1",
    createContext(),
    {
      updateAgentGoal: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "goal_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["goalId"], "goal_1");
});
