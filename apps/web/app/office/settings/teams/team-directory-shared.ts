import type { OfficeAgentsRosterSnapshot } from "@acre/db";

export type TeamDirectorySnapshot = OfficeAgentsRosterSnapshot;
export type TeamDirectoryTeam = TeamDirectorySnapshot["teams"][number];
export type TeamDirectoryMember = TeamDirectoryTeam["members"][number];
export type TeamLeaderOption = {
  membershipId: string;
  label: string;
};

export function isLeaderRoleValue(roleValue: string) {
  return roleValue === "team_leader" || roleValue === "junior_team_leader" || roleValue === "leader_i" || roleValue === "leader_ii";
}

function isTeamHierarchyAssignableRoleValue(roleValue: string) {
  return roleValue === "agent" || roleValue === "team_lead";
}

export function getExpectedLeaderRoleValue(team: TeamDirectoryTeam) {
  return team.parentTeamId ? "junior_team_leader" : "team_leader";
}

export function getBranchTypeLabelByDepth(depth: number) {
  const normalizedDepth = Math.max(0, depth);
  return normalizedDepth === 0 ? "Team" : `Junior Team ${normalizedDepth}`;
}

export function getLeaderTitleLabelByDepth(depth: number) {
  const normalizedDepth = Math.max(0, depth);
  return normalizedDepth === 0 ? "Team Leader" : `Junior Team Leader ${normalizedDepth}`;
}

export function getRootTeams(snapshot: TeamDirectorySnapshot) {
  return snapshot.teams.filter((team) => !team.parentTeamId);
}

export function getChildTeams(snapshot: TeamDirectorySnapshot, teamId: string) {
  return snapshot.teams.filter((team) => team.parentTeamId === teamId);
}

export function getDescendantTeamIds(snapshot: TeamDirectorySnapshot, teamId: string) {
  const descendantTeamIds: string[] = [];
  const stack = getChildTeams(snapshot, teamId).map((team) => team.id);
  const visited = new Set<string>();

  while (stack.length > 0) {
    const currentTeamId = stack.pop();

    if (!currentTeamId || visited.has(currentTeamId)) {
      continue;
    }

    visited.add(currentTeamId);
    descendantTeamIds.push(currentTeamId);

    for (const childTeam of getChildTeams(snapshot, currentTeamId)) {
      stack.push(childTeam.id);
    }
  }

  return descendantTeamIds;
}

export function getAvailableParentTeams(snapshot: TeamDirectorySnapshot, currentTeamId?: string | null) {
  const blockedTeamIds = new Set<string>(
    currentTeamId ? [currentTeamId, ...getDescendantTeamIds(snapshot, currentTeamId)] : []
  );

  return snapshot.teams
    .filter((team) => !blockedTeamIds.has(team.id))
    .sort((left, right) => left.teamPathLabel.localeCompare(right.teamPathLabel) || left.id.localeCompare(right.id));
}

export function getChildBranchTypeLabel(team: TeamDirectoryTeam) {
  return getBranchTypeLabelByDepth(team.depth + 1);
}

export function getChildLeaderTitleLabel(team: TeamDirectoryTeam) {
  return getLeaderTitleLabelByDepth(team.depth + 1);
}

export function getLeaderScopeLabel(team: TeamDirectoryTeam) {
  return getBranchTypeLabel(team).toLowerCase();
}

export function getTeamMemberRoleLabel(team: TeamDirectoryTeam, roleValue: string) {
  if (roleValue === "team_leader" || roleValue === "leader_i") {
    return "Team Leader";
  }

  if (roleValue === "junior_team_leader" || roleValue === "leader_ii") {
    return team.depth > 0 ? getLeaderTitleLabel(team) : "Junior Team Leader";
  }

  return "Member";
}

export function isValidBranchLeaderRoleValue(team: TeamDirectoryTeam, roleValue: string) {
  return isLeaderRoleValue(roleValue) && roleValue === getExpectedLeaderRoleValue(team);
}

export function isInvalidBranchLeaderRoleValue(team: TeamDirectoryTeam, roleValue: string) {
  return isLeaderRoleValue(roleValue) && !isValidBranchLeaderRoleValue(team, roleValue);
}

export function isValidBranchLeader(team: TeamDirectoryTeam, member: TeamDirectoryMember) {
  return isValidBranchLeaderRoleValue(team, member.roleValue);
}

export function getBranchLeaderMembers(team: TeamDirectoryTeam) {
  return team.members.filter((member) => isValidBranchLeader(team, member));
}

export function getBranchLeader(team: TeamDirectoryTeam) {
  return getBranchLeaderMembers(team)[0] ?? null;
}

export function getBranchLeaderLabel(team: TeamDirectoryTeam) {
  return getBranchLeader(team)?.label ?? "Unassigned";
}

export function getDirectMembers(team: TeamDirectoryTeam) {
  const branchLeader = getBranchLeader(team);
  return team.members.filter((member) => member.teamMembershipId !== branchLeader?.teamMembershipId);
}

export function getInvalidLeaderMembers(team: TeamDirectoryTeam) {
  return team.members.filter((member) => isInvalidBranchLeaderRoleValue(team, member.roleValue));
}

export function getMemberNamesLabel(members: TeamDirectoryMember[]) {
  return members.length ? members.map((member) => member.label).join(", ") : "No agents assigned";
}

export function getBranchTypeLabel(team: TeamDirectoryTeam) {
  return getBranchTypeLabelByDepth(team.depth);
}

export function getLeaderTitleLabel(team: TeamDirectoryTeam) {
  return getLeaderTitleLabelByDepth(team.depth);
}

export function getChildCollectionLabel(team: TeamDirectoryTeam) {
  return `${getChildBranchTypeLabel(team)} branches`;
}

export function getTotalChildBranchCount(snapshot: TeamDirectorySnapshot) {
  return snapshot.teams.filter((team) => Boolean(team.parentTeamId)).length;
}

export function getUnassignedBranchCount(snapshot: TeamDirectorySnapshot) {
  return snapshot.teams.filter((team) => team.parentTeamId && !getBranchLeader(team)).length;
}

export function getAssignableLeaderOptions(snapshot: TeamDirectorySnapshot, parentTeamId?: string | null): TeamLeaderOption[] {
  const activeMembershipIds = new Set(
    snapshot.teams.filter((team) => team.isActive).flatMap((team) => team.members.map((member) => member.membershipId))
  );
  const parentTeam = parentTeamId ? snapshot.teams.find((team) => team.id === parentTeamId) ?? null : null;
  const reusableParentMembershipIds = new Set(
    parentTeam ? getDirectMembers(parentTeam).filter((member) => member.roleValue === "member").map((member) => member.membershipId) : []
  );

  return snapshot.allRows
    .filter(
      (row) =>
        isTeamHierarchyAssignableRoleValue(row.roleValue) &&
        row.membershipStatusValue === "active" &&
        (!activeMembershipIds.has(row.membershipId) || reusableParentMembershipIds.has(row.membershipId))
    )
    .map((row) => ({
      membershipId: row.membershipId,
      label: `${row.name} · ${row.title}`
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}
