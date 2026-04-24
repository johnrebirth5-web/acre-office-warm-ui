import {
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  type AgentBankInformationAccountType,
  type AgentBankInformationTaxIdType,
  type AgentGoalPeriodType,
  type AgentOnboardingItemStatus,
  type AgentOnboardingStatus,
  type MembershipStatus,
  type TeamMembershipRole,
  type UserRole
} from "@prisma/client";

import {
  activityLogActions,
  recordActivityLogEvent,
  type ActivityLogAction,
  type ActivityLogChange
} from "../activity-log";

import {
  buildMembershipVisibilityWhere,
  canAccessMembership,
  canViewFinancialsForMembership,
  redactCurrency,
  resolveOfficeDataScope,
  type OfficeDataScope
} from "../access";

import { prisma } from "../client";

import { membershipHasAccessToOffice } from "../membership-office-access";

import {
  getMembershipCommissionEditorSnapshot,
  saveMembershipCommissionSetting,
  type OfficeMembershipCommissionEditorSnapshot
} from "../commission-defaults";

import { getAgentCommissionSummary, type OfficeAgentCommissionSummary } from "../commissions";

import { resolveManagedMembershipStoredTitle, resolveMembershipDisplayTitle } from "../membership-titles";

import { createNotificationsForMemberships } from "../notifications";

import {
  buildTeamMembershipHierarchyMap,
  buildTeamPathLabel,
  createTeamHierarchyIndex,
  expandSelectedTeamIds,
  formatAssignableTeamLabel,
  formatTeamMembershipRoleLabel,
  getExpectedBranchLeaderRole,
  getDescendantTeamIds,
  getTeamDepth,
  isLeaderTeamMembershipRole,
  isTeamHierarchyAssignableUserRole,
  isValidBranchLeaderRole,
  resolveUserRoleForTeamMembershipRole
} from "../team-hierarchy";
import { buildAgentOfficeProfileSeed } from "../agent-office-profiles";

import { AddAgentToTeamInput, ApplyAgentOnboardingTemplateInput, ComparableAgentBankInformationRecord, CreateAgentGoalInput, CreateAgentOnboardingItemInput, CreateAgentTeamInput, DeleteAgentTeamInput, GetOfficeAgentProfileInput, GetOfficeAgentsRosterInput, OfficeAgentBankInformationRecord, OfficeAgentGoalRecord, OfficeAgentOnboardingItemRecord, OfficeAgentOnboardingTemplateRecord, OfficeAgentOperationalAgendaItem, OfficeAgentProfileActivityItem, OfficeAgentProfileAvailableTeam, OfficeAgentProfileAvailableTeamManager, OfficeAgentProfileSnapshot, OfficeAgentProfileTeam, OfficeAgentRosterFilters, OfficeAgentRosterRow, OfficeAgentTeamSummary, OfficeAgentsRosterSnapshot, RemoveAgentFromTeamInput, SaveAgentProfileInput, UpdateAgentGoalInput, UpdateAgentOnboardingItemInput, UpdateAgentTeamInput, agentBankInformationAccountTypeLabelMap, agentBankInformationTaxIdTypeLabelMap, buildAgentBankInformationSignature, buildUniqueTeamSlug, canManageAgentBankInformation, defaultOnboardingItems, formatCurrency, formatDateLabel, formatDateTimeLabel, formatDateValue, getPurchasedPriceValue, goalPeriodLabelMap, hasAnyAgentBankInformationValue, membershipStatusLabelMap, normalizeComparableAgentBankInformationRecord, onboardingItemStatusLabelMap, onboardingStatusLabelMap, parseOptionalAgentBankInformationAccountType, parseOptionalAgentBankInformationTaxIdType, parseOptionalDate, parseOptionalDecimal, parseOptionalText, roleLabelMap, slugify, teamRoleLabelMap } from "./types";
import { getOfficeAgentProfileSnapshot, getOfficeAgentsRosterSnapshot, saveAgentProfile } from "./roster-profile";
import { addAgentToTeam, applyAgentOnboardingTemplate, assignMembershipToTeamTx, createAgentTeam, deleteAgentTeam, removeAgentFromTeam, updateAgentTeam } from "./team-management";
import { createAgentGoal, createAgentOnboardingItem, updateAgentGoal, updateAgentOnboardingItem } from "./progress";

export function normalizeOnboardingStatus(
  explicitStatus: AgentOnboardingStatus | null | undefined,
  items: Array<{ status: AgentOnboardingItemStatus }>
) {
  if (items.length === 0) {
    return explicitStatus ?? "not_started";
  }

  const completedCount = items.filter((item) => item.status === "completed").length;

  if (completedCount === items.length) {
    return "complete";
  }

  if (completedCount > 0 || items.some((item) => item.status === "in_progress" || item.status === "reopened")) {
    return "in_progress";
  }

  return explicitStatus === "complete" ? "in_progress" : explicitStatus ?? "not_started";
}



export function normalizeTeamRole(value: string | undefined): TeamMembershipRole {
  if (value === "team_leader" || value === "junior_team_leader" || value === "member") {
    return value;
  }

  if (value === "leader_i" || value === "lead") {
    return "team_leader";
  }

  if (value === "leader_ii") {
    return "junior_team_leader";
  }

  return "member";
}



export function normalizeOptionalTeamMembershipId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}



export function normalizeOptionalTeamId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}



export function normalizeGoalPeriod(value: string): AgentGoalPeriodType {
  if (value === "monthly" || value === "quarterly" || value === "annual") {
    return value;
  }

  throw new Error("A valid goal period is required.");
}



export function normalizeOnboardingItemStatus(value: string | undefined): AgentOnboardingItemStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "pending" || value === "in_progress" || value === "completed" || value === "reopened") {
    return value;
  }

  throw new Error("A valid onboarding status is required.");
}



export function normalizeMembershipStatusFilter(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (value === "active") {
    return { status: "active" as MembershipStatus };
  }

  if (value === "inactive") {
    return { status: { in: ["invited", "disabled"] as MembershipStatus[] } };
  }

  return undefined;
}



export function formatDueDaysOffsetLabel(days: number | null | undefined) {
  if (days === null || days === undefined) {
    return "No default due date";
  }

  if (days === 0) {
    return "Due on apply date";
  }

  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}



export function buildOnboardingProgressLabel(totalCount: number, completedCount: number) {
  if (totalCount === 0) {
    return "No checklist";
  }

  return `${completedCount}/${totalCount} complete`;
}



export function buildTransactionSummaryLabel(openCount: number, recentClosedCount: number) {
  return `${openCount} open · ${recentClosedCount} recent`;
}



export function buildGoalProgressSummary(goal: OfficeAgentGoalRecord | null) {
  if (!goal) {
    return "No active goal";
  }

  const transactionTarget = goal.targetTransactionCount === "—" ? "—" : goal.targetTransactionCount;
  return `${goal.actualTransactionCount}/${transactionTarget} tx · ${goal.actualClosedVolume}`;
}



export function getCurrentOrLatestGoal(goalSnapshots: OfficeAgentGoalRecord[]) {
  if (goalSnapshots.length === 0) {
    return null;
  }

  const now = new Date();
  const currentGoal =
    goalSnapshots.find((goal) => {
      const startsAt = new Date(goal.startsAt);
      const endsAt = new Date(goal.endsAt);
      return startsAt <= now && endsAt >= now;
    }) ?? null;

  return currentGoal ?? goalSnapshots[0];
}



export function getDefaultOnboardingTemplateSeedData() {
  return defaultOnboardingItems.map((item, index) => ({
    title: item.title,
    description: item.description,
    category: item.category,
    dueDaysOffset: item.dueDaysOffset,
    sortOrder: index
  }));
}



export function resolveOnboardingDueDate(baseDate: Date, dueDaysOffset: number | null | undefined) {
  if (dueDaysOffset === null || dueDaysOffset === undefined) {
    return null;
  }

  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + dueDaysOffset);
  return dueDate;
}



export function getMembershipLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}) {
  return `${membership.user.firstName} ${membership.user.lastName}`;
}



export function assertTeamHierarchyAssignableMembership(
  membership: {
    role: UserRole;
  },
  action: "team_member" | "team_owner" = "team_member"
) {
  if (isTeamHierarchyAssignableUserRole(membership.role)) {
    return;
  }

  if (action === "team_owner") {
    throw new Error("Only Agent / Team Lead accounts can own a Team or Junior Team. Update the account role in Settings > Users first.");
  }

  throw new Error("Only Agent / Team Lead accounts can be assigned inside Team / Junior Team hierarchy. Update the account role in Settings > Users first.");
}



export function buildLeaderOwnedTeamName(leaderLabel: string) {
  const normalized = leaderLabel.trim();
  return normalized ? `${normalized} Team` : "Leader Team";
}



export async function materializeImplicitJuniorTeamsForOrganization(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    actorMembershipId: string;
  }
) {
  const invalidJuniorLeaders = await tx.teamMembership.findMany({
    where: {
      organizationId: input.organizationId,
      role: "junior_team_leader",
      team: {
        parentTeamId: null,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      }
    },
    include: {
      team: true,
      membership: {
        include: {
          user: true
        }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  for (const invalidJuniorLeader of invalidJuniorLeaders) {
    const desiredTeamName = buildLeaderOwnedTeamName(getMembershipLabel(invalidJuniorLeader.membership));
    const childTeams = await tx.team.findMany({
      where: {
        organizationId: input.organizationId,
        parentTeamId: invalidJuniorLeader.teamId
      },
      include: {
        memberships: {
          select: {
            id: true,
            membershipId: true,
            role: true
          }
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });
    const existingOwnedTeam =
      childTeams.find((team) =>
        team.memberships.some(
          (membership) =>
            membership.membershipId === invalidJuniorLeader.membershipId && membership.role === "junior_team_leader"
        )
      ) ??
      childTeams.find((team) => team.name === desiredTeamName && !team.memberships.some((membership) => membership.role === "junior_team_leader")) ??
      null;

    const targetTeam =
      existingOwnedTeam ??
      (await tx.team.create({
        data: {
          organizationId: input.organizationId,
          officeId: invalidJuniorLeader.team.officeId,
          name: desiredTeamName,
          slug: await buildUniqueTeamSlug(tx, input.organizationId, desiredTeamName),
          parentTeamId: invalidJuniorLeader.teamId
        }
      }));

    if (!existingOwnedTeam) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "team",
        entityId: targetTeam.id,
        action: activityLogActions.teamCreated,
        payload: {
          officeId: targetTeam.officeId,
          objectLabel: targetTeam.name,
          contextHref: `/office/settings/teams/${invalidJuniorLeader.teamId}`,
          details: [
            `Status: Active`,
            `Parent team: ${invalidJuniorLeader.team.name}`,
            `Auto-created for Junior Team Leader: ${getMembershipLabel(invalidJuniorLeader.membership)}`
          ]
        }
      });
    }

    await tx.teamMembership.update({
      where: {
        id: invalidJuniorLeader.id
      },
      data: {
        officeId: targetTeam.officeId,
        teamId: targetTeam.id,
        role: "junior_team_leader",
        reportsToTeamMembershipId: null
      }
    });
    await syncLeaderAccountRoleForTeamAssignment(tx, {
      organizationId: input.organizationId,
      actorMembershipId: input.actorMembershipId,
      membership: invalidJuniorLeader.membership,
      teamRole: "junior_team_leader"
    });

    await tx.teamMembership.updateMany({
      where: {
        organizationId: input.organizationId,
        teamId: invalidJuniorLeader.teamId,
        reportsToTeamMembershipId: invalidJuniorLeader.id
      },
      data: {
        officeId: targetTeam.officeId,
        teamId: targetTeam.id
      }
    });

    await syncManagedMembershipTitlesForTeamBranch(tx, input.organizationId, invalidJuniorLeader.teamId, input.officeId);
  }
}



// Read paths must stay side-effect free. Only explicit management writes or one-off backfills
// should trigger legacy junior-team materialization.
export async function materializeImplicitJuniorTeamsForManagementAction(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    actorMembershipId: string;
  }
) {
  return materializeImplicitJuniorTeamsForOrganization(tx, input);
}



export function redactAgentGoalFinancials(goal: OfficeAgentGoalRecord, allowed: boolean): OfficeAgentGoalRecord {
  if (allowed) {
    return goal;
  }

  return {
    ...goal,
    targetOfficeNet: "Restricted",
    targetAgentNet: "Restricted",
    actualOfficeNet: "Restricted",
    actualAgentNet: "Restricted"
  };
}



export function redactAgentCommissionSummary(summary: OfficeAgentCommissionSummary, allowed: boolean): OfficeAgentCommissionSummary {
  if (allowed) {
    return summary;
  }

  return {
    ...summary,
    statementReadyLabel: "Restricted",
    payableLabel: "Restricted",
    paidLabel: "Restricted",
    recentCalculations: summary.recentCalculations.map((calculation) => ({
      ...calculation,
      grossCommissionLabel: "Restricted",
      referralFeeLabel: "Restricted",
      feesLabel: "Restricted",
      officeNetLabel: "Restricted",
      agentNetLabel: "Restricted",
      statementAmountLabel: "Restricted"
    }))
  };
}



export async function validateTeamMembershipHierarchy(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    teamId: string;
    teamParentTeamId?: string | null;
    membershipId: string;
    role: TeamMembershipRole;
    reportsToTeamMembershipId?: string | null;
    existingTeamMembershipId?: string | null;
  }
) {
  const parentId = normalizeOptionalTeamMembershipId(input.reportsToTeamMembershipId);

  if (input.role !== "member" && parentId) {
    throw new Error("Leaders cannot report to another team member inside the same team.");
  }

  if (!parentId) {
    return null;
  }

  const parentMembership = await tx.teamMembership.findFirst({
    where: {
      id: parentId,
      organizationId: input.organizationId,
      teamId: input.teamId,
      ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
    },
    select: {
      id: true,
      membershipId: true,
      role: true,
      reportsToTeamMembershipId: true
    }
  });

  if (!parentMembership) {
    throw new Error("Direct manager must belong to the same team.");
  }

  if (parentMembership.membershipId === input.membershipId || parentMembership.id === input.existingTeamMembershipId) {
    throw new Error("A team member cannot report to themselves.");
  }

  if (input.role === "member" && !isValidBranchLeaderRole(input.teamParentTeamId ?? null, parentMembership.role)) {
    throw new Error("Members can only report to the current team leader inside the same team.");
  }

  if (!input.existingTeamMembershipId) {
    return parentMembership.id;
  }

  const visited = new Set<string>();
  let cursor = parentMembership;

  while (cursor) {
    if (cursor.id === input.existingTeamMembershipId) {
      throw new Error("This reporting line would create a cycle.");
    }

    if (!cursor.reportsToTeamMembershipId || visited.has(cursor.id)) {
      break;
    }

    visited.add(cursor.id);

    const nextParent = await tx.teamMembership.findUnique({
      where: {
        id: cursor.reportsToTeamMembershipId
      },
      select: {
        id: true,
        membershipId: true,
        role: true,
        reportsToTeamMembershipId: true
      }
    });

    if (!nextParent) {
      break;
    }

    cursor = nextParent;
  }

  return parentMembership.id;
}



export async function validateTeamParentAssignment(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    teamId?: string | null;
    parentTeamId?: string | null;
    maxDepth?: number | null;
  }
) {
  const parentTeamId = normalizeOptionalTeamId(input.parentTeamId);

  if (!parentTeamId) {
    return null;
  }

  if (input.teamId && input.teamId === parentTeamId) {
    throw new Error("A team cannot be its own parent.");
  }

  const parentTeam = await tx.team.findFirst({
    where: {
      id: parentTeamId,
      organizationId: input.organizationId,
      ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
    },
    select: {
      id: true,
      parentTeamId: true
    }
  });

  if (!parentTeam) {
    throw new Error("Parent team must belong to the same office scope.");
  }

  const visited = new Set<string>();
  let cursor: { id: string; parentTeamId: string | null } | null = parentTeam;

  while (cursor && !visited.has(cursor.id)) {
    if (input.teamId && cursor.id === input.teamId) {
      throw new Error("This parent team would create a cycle.");
    }

    visited.add(cursor.id);

    if (!cursor.parentTeamId) {
      break;
    }

    cursor =
      (await tx.team.findUnique({
        where: {
          id: cursor.parentTeamId
        },
        select: {
          id: true,
          parentTeamId: true
        }
      })) ?? null;
  }

  if (typeof input.maxDepth === "number") {
    const scopedTeams = await tx.team.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        parentTeamId: true
      }
    });
    const hierarchyIndex = createTeamHierarchyIndex(scopedTeams);
    const nextDepth = getTeamDepth(hierarchyIndex, parentTeam.id) + 1;

    if (nextDepth > input.maxDepth) {
      throw new Error("Current team settings only support Team -> Junior Team. Choose a top-level Team as the parent.");
    }

    if (input.teamId) {
      const currentDepth = getTeamDepth(hierarchyIndex, input.teamId);
      const subtreeHeight = getDescendantTeamIds(hierarchyIndex, input.teamId).reduce((height, descendantTeamId) => {
        return Math.max(height, getTeamDepth(hierarchyIndex, descendantTeamId) - currentDepth);
      }, 0);

      if (nextDepth + subtreeHeight > input.maxDepth) {
        throw new Error("Reassign or remove this team's nested child teams before turning it into a Junior Team.");
      }
    }
  }

  return parentTeam.id;
}



export async function syncManagedMembershipTitle(tx: Prisma.TransactionClient, membershipId: string) {
  const membership = await tx.membership.findUnique({
    where: {
      id: membershipId
    },
    include: {
      teamMemberships: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              parentTeamId: true
            }
          }
        }
      }
    }
  });

  if (!membership) {
    return;
  }

  const teams = await tx.team.findMany({
    where: {
      organizationId: membership.organizationId,
      ...(membership.officeId ? { OR: [{ officeId: membership.officeId }, { officeId: null }] } : {})
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      parentTeamId: true
    }
  });
  const hierarchyIndex = createTeamHierarchyIndex(teams);

  const nextTitle = resolveManagedMembershipStoredTitle({
    role: membership.role,
    fallbackTitle: membership.title,
    teamMemberships: membership.teamMemberships.map((teamMembership) => ({
      ...teamMembership,
      teamPathLabel: buildTeamPathLabel(hierarchyIndex, teamMembership.team.id) || teamMembership.team.name
    }))
  });

  if ((membership.title ?? null) === nextTitle) {
    return;
  }

  await tx.membership.update({
    where: {
      id: membership.id
    },
    data: {
      title: nextTitle
    }
  });
}



export async function syncManagedMembershipTitlesForTeam(tx: Prisma.TransactionClient, teamId: string) {
  const teamMemberships = await tx.teamMembership.findMany({
    where: {
      teamId
    },
    select: {
      membershipId: true
    }
  });

  for (const membershipId of new Set(teamMemberships.map((teamMembership) => teamMembership.membershipId))) {
    await syncManagedMembershipTitle(tx, membershipId);
  }
}



export async function syncManagedMembershipTitlesForTeamBranch(
  tx: Prisma.TransactionClient,
  organizationId: string,
  teamId: string,
  officeId?: string | null
) {
  const teams = await tx.team.findMany({
    where: {
      organizationId,
      ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {})
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      parentTeamId: true
    }
  });
  const hierarchyIndex = createTeamHierarchyIndex(teams);
  const descendantTeamIds = getDescendantTeamIds(hierarchyIndex, teamId);

  for (const descendantTeamId of descendantTeamIds) {
    await syncManagedMembershipTitlesForTeam(tx, descendantTeamId);
  }
}



export function getActivityActionLabel(action: string) {
  switch (action) {
    case activityLogActions.transactionCreated:
      return "Transaction created";
    case activityLogActions.transactionUpdated:
      return "Transaction updated";
    case activityLogActions.transactionStatusChanged:
      return "Transaction status changed";
    case activityLogActions.transactionDeleted:
      return "Transaction deleted";
    case activityLogActions.transactionTaskCreated:
      return "Task created";
    case activityLogActions.transactionTaskUpdated:
      return "Task updated";
    case activityLogActions.transactionTaskCompleted:
      return "Task completed";
    case activityLogActions.transactionTaskReopened:
      return "Task reopened";
    case activityLogActions.contactCreated:
      return "Contact created";
    case activityLogActions.contactUpdated:
      return "Contact updated";
    case activityLogActions.accountingPaymentReceived:
      return "Payment received";
    case activityLogActions.accountingAgentChargeCreated:
      return "Agent charge created";
    case "agent.profile_created":
      return "Agent profile created";
    case "agent.profile_updated":
      return "Agent profile updated";
    case "team.created":
      return "Team created";
    case "team.updated":
      return "Team updated";
    case "team.deactivated":
      return "Team deactivated";
    case "team.deleted":
      return "Team deleted";
    case "team.member_added":
      return "Agent added to team";
    case "team.member_removed":
      return "Agent removed from team";
    case "agent.onboarding_item_created":
      return "Onboarding item created";
    case "agent.onboarding_item_updated":
      return "Onboarding item updated";
    case "agent.onboarding_item_completed":
      return "Onboarding item completed";
    case "agent.onboarding_item_reopened":
      return "Onboarding item reopened";
    case "agent.onboarding_template_applied":
      return "Onboarding template applied";
    case "agent.goal_created":
      return "Goal created";
    case "agent.goal_updated":
      return "Goal updated";
    default:
      return action;
  }
}



export function getPayloadObjectLabel(payload: Prisma.JsonValue | null) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "—";
  }

  if (typeof payload.objectLabel === "string" && payload.objectLabel.trim()) {
    return payload.objectLabel;
  }

  if (typeof payload.teamName === "string" && payload.teamName.trim()) {
    return payload.teamName;
  }

  return "—";
}



export function buildChange(label: string, previousValue: string, nextValue: string): ActivityLogChange | null {
  return previousValue === nextValue ? null : { label, previousValue, nextValue };
}



export async function ensureMembershipExists(
  tx: Prisma.TransactionClient,
  organizationId: string,
  membershipId: string,
  officeId?: string | null
) {
  const membership = await tx.membership.findFirst({
    where: {
      id: membershipId,
      organizationId
    },
    include: {
      user: true,
      office: true,
      officeAccesses: {
        include: {
          office: {
            select: {
              id: true,
              name: true,
              slug: true,
              market: true,
              isPrimary: true
            }
          }
        }
      },
      agentProfile: true,
      agentBankInformation: true
    }
  });

  if (!membership) {
    throw new Error("Agent membership was not found.");
  }

  if (officeId) {
    const allOffices = await tx.office.findMany({
      where: {
        organizationId
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        market: true,
        isPrimary: true
      }
    });

    if (
      !membershipHasAccessToOffice({
        role: membership.role,
        allOffices,
        defaultOfficeId: membership.officeId,
        officeAccesses: membership.officeAccesses,
        officeId
      })
    ) {
      throw new Error("Agent membership was not found.");
    }
  }

  return membership;
}



export type ManagedMembershipRecord = {
  id: string;
  role: UserRole;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
};



export async function syncLeaderAccountRoleForTeamAssignment(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    actorMembershipId: string;
    membership: ManagedMembershipRecord;
    teamRole: TeamMembershipRole;
  }
) {
  const nextMembershipRole = resolveUserRoleForTeamMembershipRole(input.membership.role, input.teamRole);

  if (nextMembershipRole === input.membership.role) {
    return {
      nextMembershipRole,
      promotionDetail: ""
    };
  }

  await tx.membership.update({
    where: {
      id: input.membership.id
    },
    data: {
      role: nextMembershipRole
    }
  });

  const promotionDetail = `Account role auto-upgraded: ${roleLabelMap[input.membership.role]} -> ${roleLabelMap[nextMembershipRole]}`;

  await recordActivityLogEvent(tx, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId,
    entityType: "membership",
    entityId: input.membership.id,
    action: activityLogActions.settingsUserRoleChanged,
    payload: {
      objectLabel: getMembershipLabel(input.membership),
      contextHref: `/office/settings/users/${input.membership.id}`,
      details: [promotionDetail],
      changes: [buildChange("Role", roleLabelMap[input.membership.role], roleLabelMap[nextMembershipRole])].filter(
        (change): change is ActivityLogChange => Boolean(change)
      )
    }
  });

  return {
    nextMembershipRole,
    promotionDetail
  };
}



export async function listActiveOnboardingTemplateItems(
  tx: Pick<Prisma.TransactionClient, "agentOnboardingTemplateItem">,
  organizationId: string,
  officeId?: string | null
) {
  const templateItems = await tx.agentOnboardingTemplateItem.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [{ officeId: officeId ?? null }, { officeId: null }]
    },
    orderBy: [{ officeId: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
  });

  if (templateItems.length > 0) {
    return templateItems;
  }

  return getDefaultOnboardingTemplateSeedData().map((item, index) => ({
    id: `fallback-template-${index}`,
    organizationId,
    officeId: officeId ?? null,
    title: item.title,
    description: item.description,
    category: item.category,
    dueDaysOffset: item.dueDaysOffset,
    sortOrder: item.sortOrder,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
}



export async function applyOnboardingTemplateItems(
  tx: Prisma.TransactionClient,
  organizationId: string,
  membershipId: string,
  officeId?: string | null
) {
  const [membership, profile, templateItems, existingItems] = await Promise.all([
    ensureMembershipExists(tx, organizationId, membershipId, officeId),
    tx.agentProfile.findUnique({
      where: {
        membershipId
      }
    }),
    listActiveOnboardingTemplateItems(tx, organizationId, officeId),
    tx.agentOnboardingItem.findMany({
      where: {
        organizationId,
        membershipId,
        ...(officeId ? { officeId } : {})
      },
      select: {
        id: true,
        templateItemId: true,
        title: true,
        category: true
      }
    })
  ]);

  const baseDate = profile?.startDate ?? new Date();
  let appliedCount = 0;

  for (const templateItem of templateItems) {
    const existingItem = existingItems.find((item) => {
      if (templateItem.id.startsWith("fallback-template-")) {
        return item.title === templateItem.title && item.category === templateItem.category;
      }

      return item.templateItemId === templateItem.id || (item.title === templateItem.title && item.category === templateItem.category);
    });

    if (existingItem) {
      if (!existingItem.templateItemId && !templateItem.id.startsWith("fallback-template-")) {
        await tx.agentOnboardingItem.update({
          where: {
            id: existingItem.id
          },
          data: {
            templateItemId: templateItem.id
          }
        });
      }

      continue;
    }

    await tx.agentOnboardingItem.create({
      data: {
        organizationId,
        officeId: membership.officeId,
        membershipId,
        templateItemId: templateItem.id.startsWith("fallback-template-") ? null : templateItem.id,
        title: templateItem.title,
        description: templateItem.description,
        category: templateItem.category,
        dueAt: resolveOnboardingDueDate(baseDate, templateItem.dueDaysOffset),
        sortOrder: templateItem.sortOrder
      }
    });
    appliedCount += 1;
  }

  return {
    membership,
    appliedCount,
    templateItems
  };
}



export async function syncAgentProfileOnboardingStatus(
  tx: Prisma.TransactionClient,
  organizationId: string,
  membershipId: string,
  officeId?: string | null
) {
  const [profile, onboardingItems] = await Promise.all([
    tx.agentProfile.findUnique({
      where: {
        membershipId
      }
    }),
    tx.agentOnboardingItem.findMany({
      where: {
        organizationId,
        membershipId,
        ...(officeId ? { officeId } : {})
      },
      select: {
        status: true
      }
    })
  ]);

  const nextStatus = normalizeOnboardingStatus(profile?.onboardingStatus, onboardingItems);

  await tx.agentProfile.upsert({
    where: {
      membershipId
    },
    update: {
      onboardingStatus: nextStatus
    },
    create: {
      organizationId,
      officeId: officeId ?? null,
      membershipId,
      onboardingStatus: nextStatus
    }
  });

  if (officeId) {
    await tx.agentOfficeProfile.upsert({
      where: {
        membershipId_officeId: {
          membershipId,
          officeId,
        },
      },
      update: {
        organizationId,
        officeId,
        onboardingStatus: nextStatus,
      },
      create: {
        organizationId,
        officeId,
        membershipId,
        ...buildAgentOfficeProfileSeed(profile),
        onboardingStatus: nextStatus,
      },
    });
  }

  return nextStatus;
}



export async function ensureAgentProfileFoundation(
  organizationId: string,
  membershipId: string,
  officeId?: string | null
) {
  return prisma.$transaction(async (tx) => {
    const membership = await ensureMembershipExists(tx, organizationId, membershipId, officeId);

    await tx.agentProfile.upsert({
      where: {
        membershipId
      },
      update: {
        officeId: membership.officeId
      },
      create: {
        organizationId,
        officeId: membership.officeId,
        membershipId,
        displayName: `${membership.user.firstName} ${membership.user.lastName}`
      }
    });

    if (membership.role === "agent") {
      const existingCount = await tx.agentOnboardingItem.count({
        where: {
          organizationId,
          membershipId
        }
      });

      if (existingCount === 0) {
        await applyOnboardingTemplateItems(tx, organizationId, membershipId, officeId);
      }
    }

    await syncAgentProfileOnboardingStatus(tx, organizationId, membershipId, officeId);
  });
}



export function getGoalProgressSourceDate(transaction: {
  closingDate: Date | null;
  updatedAt: Date;
}) {
  return transaction.closingDate ?? transaction.updatedAt;
}



export async function getBillingSummaryByMembership(
  organizationId: string,
  membershipIds: string[],
  officeId?: string | null
) {
  if (membershipIds.length === 0) {
    return new Map<
      string,
      {
        currentBalance: Prisma.Decimal;
        paymentMethodsCount: number;
        openChargesCount: number;
        pendingChargesCount: number;
      }
    >();
  }

  const [transactions, paymentMethods] = await Promise.all([
    prisma.accountingTransaction.findMany({
      where: {
        organizationId,
        relatedMembershipId: {
          in: membershipIds
        },
        isAgentBilling: true,
        status: {
          not: "void"
        },
        ...(officeId ? { officeId } : {})
      },
      include: {
        applicationsTo: {
          select: {
            amount: true
          }
        }
      }
    }),
    prisma.agentPaymentMethod.findMany({
      where: {
        organizationId,
        membershipId: {
          in: membershipIds
        },
        ...(officeId ? { officeId } : {})
      },
      select: {
        membershipId: true
      }
    })
  ]);

  const balances = new Map<
    string,
    {
      currentBalance: Prisma.Decimal;
      paymentMethodsCount: number;
      openChargesCount: number;
      pendingChargesCount: number;
    }
  >();

  for (const membershipId of membershipIds) {
    balances.set(membershipId, {
      currentBalance: new Prisma.Decimal(0),
      paymentMethodsCount: 0,
      openChargesCount: 0,
      pendingChargesCount: 0
    });
  }

  for (const transaction of transactions) {
    if (!transaction.relatedMembershipId || transaction.type !== "invoice") {
      continue;
    }

    const appliedAmount = transaction.applicationsTo.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
    const outstandingAmount = transaction.totalAmount.minus(appliedAmount);
    const current = balances.get(transaction.relatedMembershipId);

    if (!current) {
      continue;
    }

    const positiveOutstanding = outstandingAmount.greaterThan(0) ? outstandingAmount : new Prisma.Decimal(0);
    current.currentBalance = current.currentBalance.plus(positiveOutstanding);

    if (transaction.status === "draft") {
      current.pendingChargesCount += 1;
    } else if (positiveOutstanding.greaterThan(0)) {
      current.openChargesCount += 1;
    }
  }

  for (const method of paymentMethods) {
    const current = balances.get(method.membershipId);

    if (!current) {
      continue;
    }

    current.paymentMethodsCount += 1;
  }

  return balances;
}
