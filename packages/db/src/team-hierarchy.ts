import { type TeamMembershipRole } from "@prisma/client";

export type TeamHierarchyTeamRecord = {
  id: string;
  name: string;
  slug?: string | null;
  isActive: boolean;
  parentTeamId: string | null;
};

export type TeamHierarchyMembershipRecord = {
  id: string;
  membershipId: string;
  teamId: string;
  role: TeamMembershipRole;
  reportsToTeamMembershipId: string | null;
  label: string;
};

export type TeamHierarchyLeaderRecord = {
  teamId: string;
  teamName: string;
  teamPathLabel: string;
  membershipId: string;
  teamMembershipId: string;
  label: string;
  role: TeamMembershipRole;
  roleLabel: string;
};

export type TeamMembershipHierarchyRecord = {
  teamMembershipId: string;
  membershipId: string;
  teamId: string;
  teamName: string;
  parentTeamId: string | null;
  childTeamIds: string[];
  depth: number;
  teamPathLabel: string;
  hierarchySegments: string[];
  hierarchyLabel: string;
  directManagerMembershipId: string | null;
  directManagerTeamMembershipId: string | null;
  directManagerLabel: string;
  branchLeaders: TeamHierarchyLeaderRecord[];
  ancestorLeaders: TeamHierarchyLeaderRecord[];
  rootLeader: TeamHierarchyLeaderRecord | null;
  descendantTeamIds: string[];
  branchMembershipIds: string[];
};

export type TeamHierarchyIndex = {
  teamById: Map<string, TeamHierarchyTeamRecord>;
  childTeamIdsByParentId: Map<string, string[]>;
};

const leaderRoles = new Set<TeamMembershipRole>(["team_leader", "junior_team_leader"]);

function sortTeams(left: TeamHierarchyTeamRecord, right: TeamHierarchyTeamRecord) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

export function isLeaderTeamMembershipRole(role: TeamMembershipRole) {
  return leaderRoles.has(role);
}

export function getExpectedBranchLeaderRole(parentTeamId: string | null | undefined): TeamMembershipRole {
  return parentTeamId ? "junior_team_leader" : "team_leader";
}

export function isValidBranchLeaderRole(parentTeamId: string | null | undefined, role: TeamMembershipRole) {
  return isLeaderTeamMembershipRole(role) && role === getExpectedBranchLeaderRole(parentTeamId);
}

export function formatAssignableTeamLabel(teamPathLabel: string, leaderLabels: string[]) {
  const normalizedLeaderLabels = leaderLabels.map((label) => label.trim()).filter(Boolean);
  const noun = normalizedLeaderLabels.length > 1 ? "Leaders" : "Leader";
  const summary = normalizedLeaderLabels.length > 0 ? normalizedLeaderLabels.join(", ") : "Unassigned";
  return `${teamPathLabel} · ${noun}: ${summary}`;
}

export function formatTeamMembershipRoleLabel(role: TeamMembershipRole) {
  if (role === "team_leader") {
    return "Team Leader";
  }

  if (role === "junior_team_leader") {
    return "Junior Team Leader";
  }

  return "Member";
}

export function createTeamHierarchyIndex(teams: TeamHierarchyTeamRecord[]): TeamHierarchyIndex {
  const normalizedTeams = teams
    .map((team) => ({
      ...team,
      parentTeamId: team.parentTeamId ?? null
    }))
    .sort(sortTeams);
  const teamById = new Map(normalizedTeams.map((team) => [team.id, team]));
  const childTeamIdsByParentId = new Map<string, string[]>();

  for (const team of normalizedTeams) {
    if (!team.parentTeamId || !teamById.has(team.parentTeamId)) {
      continue;
    }

    const currentChildren = childTeamIdsByParentId.get(team.parentTeamId) ?? [];
    currentChildren.push(team.id);
    childTeamIdsByParentId.set(team.parentTeamId, currentChildren);
  }

  for (const [parentTeamId, childTeamIds] of childTeamIdsByParentId) {
    childTeamIds.sort((leftId, rightId) => {
      const leftTeam = teamById.get(leftId);
      const rightTeam = teamById.get(rightId);
      if (!leftTeam || !rightTeam) {
        return leftId.localeCompare(rightId);
      }

      return sortTeams(leftTeam, rightTeam);
    });
    childTeamIdsByParentId.set(parentTeamId, childTeamIds);
  }

  return {
    teamById,
    childTeamIdsByParentId
  };
}

export function getTeamPath(index: TeamHierarchyIndex, teamId: string) {
  const path: TeamHierarchyTeamRecord[] = [];
  const visited = new Set<string>();
  let cursor = index.teamById.get(teamId) ?? null;

  while (cursor && !visited.has(cursor.id)) {
    path.unshift(cursor);
    visited.add(cursor.id);
    cursor = cursor.parentTeamId ? index.teamById.get(cursor.parentTeamId) ?? null : null;
  }

  return path;
}

export function getTeamDepth(index: TeamHierarchyIndex, teamId: string) {
  return Math.max(0, getTeamPath(index, teamId).length - 1);
}

export function buildTeamPathLabel(index: TeamHierarchyIndex, teamId: string) {
  const path = getTeamPath(index, teamId);
  return path.length ? path.map((team) => team.name).join(" / ") : "";
}

export function getDescendantTeamIds(index: TeamHierarchyIndex, teamId: string) {
  const descendantIds: string[] = [];
  const stack = [teamId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const currentTeamId = stack.pop();

    if (!currentTeamId || visited.has(currentTeamId)) {
      continue;
    }

    visited.add(currentTeamId);
    descendantIds.push(currentTeamId);

    for (const childTeamId of index.childTeamIdsByParentId.get(currentTeamId) ?? []) {
      stack.push(childTeamId);
    }
  }

  return descendantIds;
}

export function expandSelectedTeamIds(index: TeamHierarchyIndex, selectedTeamId: string | null | undefined) {
  const normalizedTeamId = selectedTeamId?.trim();
  if (!normalizedTeamId) {
    return [];
  }

  return getDescendantTeamIds(index, normalizedTeamId);
}

function buildLeaderRecord(
  index: TeamHierarchyIndex,
  leaderMembership: TeamHierarchyMembershipRecord,
  teamPathLabel: string
): TeamHierarchyLeaderRecord {
  const team = index.teamById.get(leaderMembership.teamId);

  return {
    teamId: leaderMembership.teamId,
    teamName: team?.name ?? "Unknown team",
    teamPathLabel,
    membershipId: leaderMembership.membershipId,
    teamMembershipId: leaderMembership.id,
    label: leaderMembership.label,
    role: leaderMembership.role,
    roleLabel: formatTeamMembershipRoleLabel(leaderMembership.role)
  };
}

function buildHierarchySegments(
  index: TeamHierarchyIndex,
  teamMembership: TeamHierarchyMembershipRecord
) {
  const teamPath = getTeamPath(index, teamMembership.teamId);
  const segments = teamPath.map((team, indexInPath) => {
    if (indexInPath === 0) {
      return team.name;
    }

    return `Junior Team Leader (${team.name})`;
  });

  if (teamMembership.role === "team_leader") {
    segments.push("Team Leader");
  } else if (teamMembership.role === "junior_team_leader" && teamPath.length === 1) {
    segments.push("Junior Team Leader");
  } else if (teamMembership.role === "member") {
    segments.push("Member");
  }

  return segments;
}

export function buildTeamMembershipHierarchyMap(input: {
  teams: TeamHierarchyTeamRecord[];
  teamMemberships: TeamHierarchyMembershipRecord[];
}) {
  const index = createTeamHierarchyIndex(input.teams);
  const teamMemberships = input.teamMemberships.map((teamMembership) => ({
    ...teamMembership,
    reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId ?? null
  }));
  const membershipByTeamMembershipId = new Map(teamMemberships.map((teamMembership) => [teamMembership.id, teamMembership]));
  const membershipsByTeamId = new Map<string, TeamHierarchyMembershipRecord[]>();
  const leaderByTeamId = new Map<string, TeamHierarchyMembershipRecord>();

  for (const teamMembership of teamMemberships) {
    const currentMemberships = membershipsByTeamId.get(teamMembership.teamId) ?? [];
    currentMemberships.push(teamMembership);
    membershipsByTeamId.set(teamMembership.teamId, currentMemberships);

    const team = index.teamById.get(teamMembership.teamId);
    if (!team || !isValidBranchLeaderRole(team.parentTeamId, teamMembership.role)) {
      continue;
    }

    const currentLeader = leaderByTeamId.get(teamMembership.teamId);
    if (
      !currentLeader ||
      teamMembership.label.localeCompare(currentLeader.label) < 0 ||
      (teamMembership.label === currentLeader.label && teamMembership.id.localeCompare(currentLeader.id) < 0)
    ) {
      leaderByTeamId.set(teamMembership.teamId, teamMembership);
    }
  }

  for (const [teamId, memberships] of membershipsByTeamId) {
    memberships.sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
    membershipsByTeamId.set(teamId, memberships);
  }

  const hierarchyMap = new Map<string, TeamMembershipHierarchyRecord>();

  for (const teamMembership of teamMemberships) {
    const team = index.teamById.get(teamMembership.teamId);
    const teamPathLabel = buildTeamPathLabel(index, teamMembership.teamId);
    const descendantTeamIds = getDescendantTeamIds(index, teamMembership.teamId);
    const branchMembershipIds = isLeaderTeamMembershipRole(teamMembership.role)
      ? descendantTeamIds.flatMap((teamId) => (membershipsByTeamId.get(teamId) ?? []).map((member) => member.membershipId))
      : [teamMembership.membershipId];
    const ancestorTeams = getTeamPath(index, teamMembership.teamId);
    const branchLeaders = ancestorTeams
      .map((ancestorTeam) => leaderByTeamId.get(ancestorTeam.id) ?? null)
      .filter((leader): leader is TeamHierarchyMembershipRecord => Boolean(leader))
      .map((leader) => buildLeaderRecord(index, leader, buildTeamPathLabel(index, leader.teamId)));
    const ancestorLeaders =
      teamMembership.role === "member"
        ? branchLeaders
        : branchLeaders.filter((leader) => leader.teamMembershipId !== teamMembership.id);
    const explicitDirectManager = teamMembership.reportsToTeamMembershipId
      ? membershipByTeamMembershipId.get(teamMembership.reportsToTeamMembershipId) ?? null
      : null;
    const directManager =
      explicitDirectManager ??
      (teamMembership.role === "member"
        ? leaderByTeamId.get(teamMembership.teamId) ?? null
        : team?.parentTeamId
          ? leaderByTeamId.get(team.parentTeamId) ?? null
          : null);

    hierarchyMap.set(teamMembership.id, {
      teamMembershipId: teamMembership.id,
      membershipId: teamMembership.membershipId,
      teamId: teamMembership.teamId,
      teamName: team?.name ?? "Unknown team",
      parentTeamId: team?.parentTeamId ?? null,
      childTeamIds: index.childTeamIdsByParentId.get(teamMembership.teamId) ?? [],
      depth: getTeamDepth(index, teamMembership.teamId),
      teamPathLabel,
      hierarchySegments: buildHierarchySegments(index, teamMembership),
      hierarchyLabel: buildHierarchySegments(index, teamMembership).join(" / "),
      directManagerMembershipId: directManager?.membershipId ?? null,
      directManagerTeamMembershipId: directManager?.id ?? null,
      directManagerLabel: directManager?.label ?? "No direct manager",
      branchLeaders,
      ancestorLeaders,
      rootLeader: branchLeaders[0] ?? null,
      descendantTeamIds,
      branchMembershipIds: [...new Set(branchMembershipIds)]
    });
  }

  return {
    index,
    hierarchyMap,
    leaderByTeamId
  };
}
