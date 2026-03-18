import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTeamMembershipHierarchyMap,
  formatAssignableTeamLabel,
  getExpectedBranchLeaderRole,
  isValidBranchLeaderRole
} from "./team-hierarchy.ts";

test("branch leader role expectation follows root vs child team structure", () => {
  assert.equal(getExpectedBranchLeaderRole(null), "team_leader");
  assert.equal(getExpectedBranchLeaderRole("parent-team"), "junior_team_leader");
  assert.equal(isValidBranchLeaderRole(null, "team_leader"), true);
  assert.equal(isValidBranchLeaderRole(null, "junior_team_leader"), false);
  assert.equal(isValidBranchLeaderRole("parent-team", "junior_team_leader"), true);
  assert.equal(isValidBranchLeaderRole("parent-team", "team_leader"), false);
});

test("assignable team labels stay consistent when a branch leader is missing", () => {
  assert.equal(formatAssignableTeamLabel("Candy Team", ["Linfen Ruan"]), "Candy Team · Leader: Linfen Ruan");
  assert.equal(formatAssignableTeamLabel("Candy Team / Sylvia Team", []), "Candy Team / Sylvia Team · Leader: Unassigned");
  assert.equal(
    formatAssignableTeamLabel("Candy Team", ["Linfen Ruan", "Ding Cai"]),
    "Candy Team · Leaders: Linfen Ruan, Ding Cai"
  );
});

test("hierarchy leader selection ignores invalid leader roles for the current branch shape", () => {
  const hierarchy = buildTeamMembershipHierarchyMap({
    teams: [
      { id: "team-root", name: "Candy Team", slug: "candy-team", isActive: true, parentTeamId: null },
      { id: "team-child", name: "Sylvia Team", slug: "sylvia-team", isActive: true, parentTeamId: "team-root" }
    ],
    teamMemberships: [
      {
        id: "tm-root-valid",
        membershipId: "member-root-valid",
        teamId: "team-root",
        role: "team_leader",
        reportsToTeamMembershipId: null,
        label: "Linfen Ruan"
      },
      {
        id: "tm-root-invalid",
        membershipId: "member-root-invalid",
        teamId: "team-root",
        role: "junior_team_leader",
        reportsToTeamMembershipId: null,
        label: "Ding Cai"
      },
      {
        id: "tm-child-invalid",
        membershipId: "member-child-invalid",
        teamId: "team-child",
        role: "team_leader",
        reportsToTeamMembershipId: null,
        label: "Wrong Leader"
      },
      {
        id: "tm-child-member",
        membershipId: "member-child",
        teamId: "team-child",
        role: "member",
        reportsToTeamMembershipId: null,
        label: "Child Member"
      }
    ]
  });

  assert.equal(hierarchy.leaderByTeamId.get("team-root")?.label, "Linfen Ruan");
  assert.equal(hierarchy.leaderByTeamId.has("team-child"), false);
  assert.equal(hierarchy.hierarchyMap.get("tm-child-member")?.directManagerLabel, "No direct manager");
});
