import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleAddAgentToTeamPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/teams/team_1/memberships`, {
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

test("handleAddAgentToTeamPost returns 400 validation_error for blank membershipId", async () => {
  const response = await handleAddAgentToTeamPost(createRequest(JSON.stringify({ membershipId: " " })), "team_1", createContext());
  assert.equal(response.status, 400);
});

test("handleAddAgentToTeamPost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleAddAgentToTeamPost(
    createRequest(JSON.stringify({ membershipId: "membership_2", role: "member" })),
    "team_1",
    createContext(),
    {
      addAgentToTeam: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "team_membership_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.equal(capturedInput?.["membershipId"], "membership_2");
});
