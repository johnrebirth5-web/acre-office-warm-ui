import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAgentTeamPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/teams/team_1`, {
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

test("handleUpdateAgentTeamPatch returns 400 validation_error for invalid isActive type", async () => {
  const response = await handleUpdateAgentTeamPatch(createRequest(JSON.stringify({ isActive: "yes" })), "team_1", createContext());
  assert.equal(response.status, 400);
});

test("handleUpdateAgentTeamPatch forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleUpdateAgentTeamPatch(
    createRequest(JSON.stringify({ name: "North team", isActive: false })),
    "team_1",
    createContext(),
    {
      updateAgentTeam: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "team_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["isActive"], false);
});
