import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateAgentTeamPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/teams`, {
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

test("handleCreateAgentTeamPost returns 400 validation_error for blank name", async () => {
  const response = await handleCreateAgentTeamPost(createRequest(JSON.stringify({ name: " " })), createContext());
  assert.equal(response.status, 400);
});

test("handleCreateAgentTeamPost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleCreateAgentTeamPost(
    createRequest(JSON.stringify({ name: "North team", leaderMembershipId: "membership_2" })),
    createContext(),
    {
      createAgentTeam: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "team_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.equal(capturedInput?.["leaderMembershipId"], "membership_2");
});
