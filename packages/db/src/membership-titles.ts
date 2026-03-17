import { type TeamMembershipRole, type UserRole } from "@prisma/client";

const detailedTeamRoleLabelMap: Record<TeamMembershipRole, string> = {
  leader_i: "Team Leader I",
  leader_ii: "Team Leader II",
  member: "Team Member"
};

const managedTeamTitlePattern = /^.+ - Team (Leader I|Leader II|Member)$/;
const managedIndependentTitle = "Independent";
const managedNoActiveTeamTitle = "No active team";

export type MembershipTitleTeamMembership = {
  role: TeamMembershipRole;
  team: {
    name: string;
    isActive: boolean;
  };
};

function normalizeTitle(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function compareManagedMembershipTitles(
  left: MembershipTitleTeamMembership,
  right: MembershipTitleTeamMembership
) {
  return (
    left.team.name.localeCompare(right.team.name) ||
    detailedTeamRoleLabelMap[left.role].localeCompare(detailedTeamRoleLabelMap[right.role])
  );
}

export function isManagedMembershipTitle(value: string | null | undefined) {
  const normalized = normalizeTitle(value);

  if (!normalized || normalized === managedIndependentTitle || normalized === managedNoActiveTeamTitle) {
    return true;
  }

  return normalized.split(" / ").every((part) => managedTeamTitlePattern.test(part.trim()));
}

export function buildManagedMembershipTitle(
  role: UserRole,
  teamMemberships: MembershipTitleTeamMembership[]
) {
  const activeTeamMemberships = teamMemberships
    .filter((teamMembership) => teamMembership.team.isActive)
    .sort(compareManagedMembershipTitles);

  if (activeTeamMemberships.length > 0) {
    return activeTeamMemberships
      .map((teamMembership) => `${teamMembership.team.name} - ${detailedTeamRoleLabelMap[teamMembership.role]}`)
      .join(" / ");
  }

  if (role === "agent") {
    return managedIndependentTitle;
  }

  if (role === "team_lead") {
    return managedNoActiveTeamTitle;
  }

  return "";
}

export function resolveMembershipDisplayTitle(input: {
  role: UserRole;
  fallbackTitle: string | null | undefined;
  teamMemberships: MembershipTitleTeamMembership[];
}) {
  const fallbackTitle = normalizeTitle(input.fallbackTitle);
  const hasActiveTeamMembership = input.teamMemberships.some((teamMembership) => teamMembership.team.isActive);

  if ((input.role === "agent" || input.role === "team_lead") && hasActiveTeamMembership) {
    return buildManagedMembershipTitle(input.role, input.teamMemberships);
  }

  if (isManagedMembershipTitle(fallbackTitle)) {
    return buildManagedMembershipTitle(input.role, input.teamMemberships);
  }

  return fallbackTitle;
}

export function resolveManagedMembershipStoredTitle(input: {
  role: UserRole;
  fallbackTitle: string | null | undefined;
  teamMemberships: MembershipTitleTeamMembership[];
}) {
  const fallbackTitle = normalizeTitle(input.fallbackTitle);

  if (!isManagedMembershipTitle(fallbackTitle)) {
    return fallbackTitle || null;
  }

  const managedTitle = buildManagedMembershipTitle(input.role, input.teamMemberships);
  return managedTitle || null;
}
