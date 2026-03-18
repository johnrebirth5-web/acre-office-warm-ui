import type { OfficeAgentsRosterSnapshot } from "@acre/db";

export type TeamDirectorySnapshot = OfficeAgentsRosterSnapshot;
export type TeamDirectoryTeam = TeamDirectorySnapshot["teams"][number];
export type TeamDirectoryMember = TeamDirectoryTeam["members"][number];

function isLeaderRoleValue(roleValue: string) {
  return roleValue === "team_leader" || roleValue === "junior_team_leader" || roleValue === "leader_i" || roleValue === "leader_ii";
}

function getExpectedLeaderRoleValue(team: TeamDirectoryTeam) {
  return team.parentTeamId ? "junior_team_leader" : "team_leader";
}

export function getRootTeams(snapshot: TeamDirectorySnapshot) {
  return snapshot.teams.filter((team) => !team.parentTeamId);
}

export function getChildTeams(snapshot: TeamDirectorySnapshot, teamId: string) {
  return snapshot.teams.filter((team) => team.parentTeamId === teamId);
}

export function isValidBranchLeader(team: TeamDirectoryTeam, member: TeamDirectoryMember) {
  return isLeaderRoleValue(member.roleValue) && member.roleValue === getExpectedLeaderRoleValue(team);
}

export function getBranchLeader(team: TeamDirectoryTeam) {
  return team.members.find((member) => isValidBranchLeader(team, member)) ?? null;
}

export function getBranchLeaderLabel(team: TeamDirectoryTeam) {
  return getBranchLeader(team)?.label ?? "Unassigned";
}

export function getDirectMembers(team: TeamDirectoryTeam) {
  const branchLeader = getBranchLeader(team);
  return team.members.filter((member) => member.teamMembershipId !== branchLeader?.teamMembershipId);
}

export function getInvalidLeaderMembers(team: TeamDirectoryTeam) {
  return team.members.filter((member) => isLeaderRoleValue(member.roleValue) && !isValidBranchLeader(team, member));
}

export function getMemberNamesLabel(members: TeamDirectoryMember[]) {
  return members.length ? members.map((member) => member.label).join(", ") : "No agents assigned";
}

export function getBranchTypeLabel(team: TeamDirectoryTeam) {
  return team.parentTeamId ? "Child branch" : "Root team";
}

export function getTotalChildBranchCount(snapshot: TeamDirectorySnapshot) {
  return snapshot.teams.filter((team) => Boolean(team.parentTeamId)).length;
}

export function getUnassignedBranchCount(snapshot: TeamDirectorySnapshot) {
  return snapshot.teams.filter((team) => team.parentTeamId && !getBranchLeader(team)).length;
}
