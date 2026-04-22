import assert from "node:assert/strict";
import test from "node:test";
import {
  getAvailableParentTeams,
  getBranchTypeLabel,
  getChildCollectionLabel,
  getLeaderTitleLabel,
  getTeamMemberRoleLabel,
  type TeamDirectorySnapshot
} from "./team-directory-shared";

function buildTeam(
  id: string,
  name: string,
  depth: number,
  parentTeamId: string | null,
  teamPathLabel: string
) {
  return {
    id,
    name,
    slug: id,
    isActive: true,
    parentTeamId,
    depth,
    teamPathLabel,
    childTeamCount: 0,
    memberCount: 0,
    commissionPlanAssignmentCount: 0,
    openTaskCount: 0,
    openTransactionCount: 0,
    onboardingInProgressCount: 0,
    members: []
  } satisfies TeamDirectorySnapshot["teams"][number];
}

test("depth-aware team labels stay readable across recursive child branches", () => {
  const rootTeam = buildTeam("team-root", "Root", 0, null, "Root");
  const juniorTeamOne = buildTeam("team-j1", "Junior 1", 1, "team-root", "Root / Junior 1");
  const juniorTeamTwo = buildTeam("team-j2", "Junior 2", 2, "team-j1", "Root / Junior 1 / Junior 2");

  assert.equal(getBranchTypeLabel(rootTeam), "Team");
  assert.equal(getLeaderTitleLabel(rootTeam), "Team Leader");
  assert.equal(getBranchTypeLabel(juniorTeamOne), "Junior Team 1");
  assert.equal(getLeaderTitleLabel(juniorTeamOne), "Junior Team Leader 1");
  assert.equal(getBranchTypeLabel(juniorTeamTwo), "Junior Team 2");
  assert.equal(getLeaderTitleLabel(juniorTeamTwo), "Junior Team Leader 2");
  assert.equal(getChildCollectionLabel(juniorTeamOne), "Junior Team 2 branches");
  assert.equal(getTeamMemberRoleLabel(juniorTeamTwo, "junior_team_leader"), "Junior Team Leader 2");
});

test("available parent team options exclude the current branch and its descendants", () => {
  const snapshot = {
    teams: [
      buildTeam("team-root", "Root", 0, null, "Root"),
      buildTeam("team-j1", "Junior 1", 1, "team-root", "Root / Junior 1"),
      buildTeam("team-j2", "Junior 2", 2, "team-j1", "Root / Junior 1 / Junior 2"),
      buildTeam("team-other", "Other", 0, null, "Other")
    ],
    allRows: []
  } as unknown as TeamDirectorySnapshot;

  const parentOptions = getAvailableParentTeams(snapshot, "team-j1");

  assert.deepEqual(
    parentOptions.map((team) => team.id),
    ["team-other", "team-root"]
  );
});
