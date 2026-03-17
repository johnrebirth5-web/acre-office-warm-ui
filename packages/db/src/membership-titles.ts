import { type TeamMembershipRole, type UserRole } from "@prisma/client";
import {
  buildTeamMembershipHierarchyMap,
  formatTeamMembershipRoleLabel,
  type TeamHierarchyMembershipRecord,
  type TeamHierarchyTeamRecord
} from "./team-hierarchy";

const managedTeamTitlePattern = /^.+ \/ (Team Leader|Junior Team Leader(?: \(.+\))?|Member)$/;
const managedIndependentTitle = "Independent";
const managedNoActiveTeamTitle = "No active team";

export type MembershipTitleTeamMembership = {
  id?: string;
  membershipId?: string;
  role: TeamMembershipRole;
  teamPathLabel?: string;
  team: {
    id?: string;
    name: string;
    isActive: boolean;
    parentTeamId?: string | null;
  };
  reportsToTeamMembershipId?: string | null;
};

function normalizeTitle(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function compareManagedMembershipTitles(
  left: MembershipTitleTeamMembership,
  right: MembershipTitleTeamMembership
) {
  return (
    (left.teamPathLabel ?? left.team.name).localeCompare(right.teamPathLabel ?? right.team.name) ||
    formatTeamMembershipRoleLabel(left.role).localeCompare(formatTeamMembershipRoleLabel(right.role))
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
    const hierarchy = buildTeamMembershipHierarchyMap({
      teams: activeTeamMemberships.map((teamMembership, index) => ({
        id: teamMembership.team.id ?? `membership-title-team-${index}`,
        name: teamMembership.team.name,
        isActive: teamMembership.team.isActive,
        parentTeamId: teamMembership.team.parentTeamId ?? null
      }) satisfies TeamHierarchyTeamRecord),
      teamMemberships: activeTeamMemberships.map((teamMembership, index) => ({
        id: teamMembership.id ?? `membership-title-row-${index}`,
        membershipId: teamMembership.membershipId ?? `membership-title-membership-${index}`,
        teamId: teamMembership.team.id ?? `membership-title-team-${index}`,
        role: teamMembership.role,
        reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId ?? null,
        label: ""
      }) satisfies TeamHierarchyMembershipRecord)
    });

    return activeTeamMemberships
      .map((teamMembership, index) => {
        const hierarchyLabel = hierarchy.hierarchyMap.get(teamMembership.id ?? `membership-title-row-${index}`)?.hierarchyLabel ?? "";
        if (!hierarchyLabel) {
          return "";
        }

        if (
          teamMembership.teamPathLabel &&
          hierarchyLabel.startsWith(teamMembership.team.name) &&
          teamMembership.teamPathLabel !== teamMembership.team.name
        ) {
          return hierarchyLabel.replace(teamMembership.team.name, teamMembership.teamPathLabel);
        }

        return hierarchyLabel;
      })
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .join(" • ");
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
