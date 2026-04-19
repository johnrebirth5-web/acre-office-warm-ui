import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateAgentTeamMembershipPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/agents/teams/team_1/memberships/membership_2`, {
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

test("handleUpdateAgentTeamMembershipPatch returns 400 validation_error for invalid reportsToTeamMembershipId type", async () => {
  const response = await handleUpdateAgentTeamMembershipPatch(
    createRequest(JSON.stringify({ reportsToTeamMembershipId: 123 })),
    "team_1",
    "membership_2",
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleUpdateAgentTeamMembershipPatch forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleUpdateAgentTeamMembershipPatch(
    createRequest(JSON.stringify({ role: "team_leader" })),
    "team_1",
    "membership_2",
    createContext(),
    {
      addAgentToTeam: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "team_membership_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(capturedInput?.["role"], "team_leader");
});
