import {
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
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
} from "./activity-log";
import {
  buildMembershipVisibilityWhere,
  canAccessMembership,
  canViewFinancialsForMembership,
  redactCurrency,
  resolveOfficeDataScope
} from "./access";
import { prisma } from "./client";
import {
  getMembershipCommissionEditorSnapshot,
  saveMembershipCommissionSetting,
  type OfficeMembershipCommissionEditorSnapshot
} from "./commission-defaults";
import { getAgentCommissionSummary, type OfficeAgentCommissionSummary } from "./commissions";
import { resolveManagedMembershipStoredTitle, resolveMembershipDisplayTitle } from "./membership-titles";
import { createNotificationsForMemberships } from "./notifications";
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
  isValidBranchLeaderRole
} from "./team-hierarchy";

const roleLabelMap: Record<UserRole, string> = {
  agent: "Agent",
  office_manager: "Office Manager (Legacy)",
  office_user: "Office User (Legacy)",
  office_admin: "Office Admin",
  owner: "Owner",
  accountant: "Accountant",
  human_resources: "Human Resources",
  team_lead: "Team Lead"
};

const onboardingStatusLabelMap: Record<AgentOnboardingStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete"
};

const membershipStatusLabelMap: Record<MembershipStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Inactive"
};

const onboardingItemStatusLabelMap: Record<AgentOnboardingItemStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  reopened: "Reopened"
};

const teamRoleLabelMap: Record<TeamMembershipRole, string> = {
  team_leader: "Team Leader",
  junior_team_leader: "Junior Team Leader",
  member: "Member"
};

const goalPeriodLabelMap: Record<AgentGoalPeriodType, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual"
};

const defaultOnboardingItems = [
  {
    category: "Compliance",
    title: "Upload license and state ID",
    description: "Provide your active license details and identity documents for office compliance review.",
    dueDaysOffset: 3
  },
  {
    category: "Operations",
    title: "Complete brokerage onboarding packet",
    description: "Review commission setup, office policies, and brokerage-required agreements.",
    dueDaysOffset: 5
  },
  {
    category: "Training",
    title: "Review transaction workflow basics",
    description: "Walk through the Back Office transaction, document, and task flow before going live.",
    dueDaysOffset: 7
  }
] as const;

export type OfficeAgentRosterRow = {
  membershipId: string;
  name: string;
  email: string;
  officeName: string;
  role: string;
  title: string;
  teamLabel: string;
  membershipStatus: string;
  membershipStatusValue: MembershipStatus;
  onboardingStatus: string;
  onboardingProgressLabel: string;
  activeTasksCount: number;
  openTransactionCount: number;
  recentClosedTransactionCount: number;
  transactionSummaryLabel: string;
  goalProgressSummary: string;
  billingBalanceLabel: string;
  billingSummaryLabel: string;
  href: string;
};

export type OfficeAgentRosterFilters = {
  officeId: string;
  role: string;
  teamId: string;
  onboardingStatus: string;
  membershipStatus: string;
  q: string;
  officeOptions: Array<{ id: string; label: string }>;
  roleOptions: Array<{ value: string; label: string }>;
  teamOptions: Array<{ id: string; label: string }>;
};

export type OfficeAgentTeamSummary = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  parentTeamId: string | null;
  depth: number;
  teamPathLabel: string;
  childTeamCount: number;
  memberCount: number;
  openTaskCount: number;
  openTransactionCount: number;
  onboardingInProgressCount: number;
  members: Array<{
    teamMembershipId: string;
    membershipId: string;
    label: string;
    role: string;
    roleValue: TeamMembershipRole;
    reportsToTeamMembershipId: string | null;
    reportsToLabel: string;
  }>;
};

export type OfficeAgentsRosterSnapshot = {
  summary: {
    totalMembers: number;
    agentCount: number;
    onboardingInProgressCount: number;
    activeTeamCount: number;
    inactiveMemberCount: number;
  };
  filters: OfficeAgentRosterFilters;
  rows: OfficeAgentRosterRow[];
  teams: OfficeAgentTeamSummary[];
};

export type OfficeAgentProfileTeam = {
  id: string;
  teamMembershipId: string;
  name: string;
  slug: string;
  isActive: boolean;
  teamPathLabel: string;
  depth: number;
  directManagerMembershipId: string | null;
  rootLeaderLabel: string;
  role: string;
  roleValue: TeamMembershipRole;
  reportsToTeamMembershipId: string | null;
  reportsToLabel: string;
};

export type OfficeAgentProfileAvailableTeamManager = {
  teamMembershipId: string;
  membershipId: string;
  label: string;
  role: string;
  roleValue: TeamMembershipRole;
};

export type OfficeAgentProfileAvailableTeam = {
  id: string;
  label: string;
  managerOptions: OfficeAgentProfileAvailableTeamManager[];
  defaultReportsToTeamMembershipId: string | null;
};

export type OfficeAgentOnboardingItemRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  dueAt: string;
  status: string;
  statusValue: AgentOnboardingItemStatus;
  completedAt: string;
  completedByName: string;
};

export type OfficeAgentGoalRecord = {
  id: string;
  periodType: string;
  startsAt: string;
  endsAt: string;
  targetTransactionCount: string;
  targetClosedVolume: string;
  targetOfficeNet: string;
  targetAgentNet: string;
  actualTransactionCount: string;
  actualClosedVolume: string;
  actualOfficeNet: string;
  actualAgentNet: string;
  notes: string;
};

export type OfficeAgentProfileActivityItem = {
  id: string;
  actionLabel: string;
  objectLabel: string;
  timestampLabel: string;
};

export type OfficeAgentOnboardingTemplateRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  dueDaysOffsetLabel: string;
};

export type OfficeAgentOperationalAgendaItem = {
  id: string;
  kind: string;
  title: string;
  statusLabel: string;
  dueAtLabel: string;
  href: string | null;
};

export type OfficeAgentProfileSnapshot = {
  financialsRestricted: boolean;
  profile: {
    membershipId: string;
    userId: string;
    fullName: string;
    displayName: string;
    email: string;
    officeName: string;
    role: string;
    membershipStatus: string;
    membershipStatusValue: MembershipStatus;
    title: string;
    bio: string;
    notes: string;
    licenseNumber: string;
    licenseState: string;
    startDate: string;
    onboardingStatus: string;
    onboardingStatusValue: AgentOnboardingStatus;
    commissionPlanName: string;
    avatarUrl: string;
    internalExtension: string;
  };
  defaultCommission: OfficeMembershipCommissionEditorSnapshot;
  summary: {
    activeTaskCount: number;
    openTransactionCount: number;
    recentClosedTransactionCount: number;
    currentBalanceLabel: string;
    paymentMethodsCount: number;
    openChargesCount: number;
    pendingChargesCount: number;
    currentGoalSummary: string;
    operationalAgendaCount: number;
    pipelineCounts: Array<{ label: string; count: number }>;
  };
  commissions: OfficeAgentCommissionSummary;
  teams: OfficeAgentProfileTeam[];
  availableTeams: OfficeAgentProfileAvailableTeam[];
  onboarding: {
    totalCount: number;
    completedCount: number;
    statusLabel: string;
    templateDefaultsCount: number;
    templateDefaults: OfficeAgentOnboardingTemplateRecord[];
    items: OfficeAgentOnboardingItemRecord[];
  };
  goals: OfficeAgentGoalRecord[];
  operationalAgenda: OfficeAgentOperationalAgendaItem[];
  recentTransactions: Array<{
    id: string;
    label: string;
    status: string;
    priceLabel: string;
    href: string;
  }>;
  recentActivity: OfficeAgentProfileActivityItem[];
};

export type GetOfficeAgentsRosterInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  officeFilterId?: string;
  role?: string;
  teamId?: string;
  onboardingStatus?: string;
  membershipStatus?: string;
  q?: string;
};

export type GetOfficeAgentProfileInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  membershipId: string;
};

export type SaveAgentProfileInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  actorMembershipId: string;
  displayName?: string;
  bio?: string;
  notes?: string;
  licenseNumber?: string;
  licenseState?: string;
  startDate?: string;
  commissionPlanName?: string;
  splitTemplateId?: string;
  customAgentPercent?: string;
  commissionEffectiveFrom?: string;
  commissionEffectiveTo?: string;
  avatarUrl?: string;
  internalExtension?: string;
};

export type CreateAgentTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  name: string;
  parentTeamId?: string | null;
  leaderMembershipId: string;
};

export type UpdateAgentTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  teamId: string;
  name?: string;
  isActive?: boolean;
  parentTeamId?: string | null;
};

export type DeleteAgentTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  teamId: string;
};

export type AddAgentToTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  teamId: string;
  membershipId: string;
  role?: string;
  reportsToTeamMembershipId?: string | null;
};

export type RemoveAgentFromTeamInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  teamId: string;
  membershipId: string;
};

export type CreateAgentOnboardingItemInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  membershipId: string;
  title: string;
  description?: string;
  category?: string;
  dueAt?: string;
};

export type ApplyAgentOnboardingTemplateInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  membershipId: string;
};

export type UpdateAgentOnboardingItemInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  membershipId: string;
  itemId: string;
  title?: string;
  description?: string;
  category?: string;
  dueAt?: string;
  status?: string;
};

export type CreateAgentGoalInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  membershipId: string;
  periodType: string;
  startsAt: string;
  endsAt: string;
  targetTransactionCount?: string;
  targetClosedVolume?: string;
  targetOfficeNet?: string;
  targetAgentNet?: string;
  notes?: string;
};

export type UpdateAgentGoalInput = CreateAgentGoalInput & {
  goalId: string;
};

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function formatDateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function formatDateLabel(value: Date | null | undefined) {
  return value
    ? value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : "—";
}

function formatDateTimeLabel(value: Date | null | undefined) {
  return value
    ? value.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : "—";
}

function parseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDate(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalDecimal(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeOnboardingStatus(
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

function normalizeTeamRole(value: string | undefined): TeamMembershipRole {
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

function normalizeOptionalTeamMembershipId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalTeamId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeGoalPeriod(value: string): AgentGoalPeriodType {
  if (value === "monthly" || value === "quarterly" || value === "annual") {
    return value;
  }

  throw new Error("A valid goal period is required.");
}

function normalizeOnboardingItemStatus(value: string | undefined): AgentOnboardingItemStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "pending" || value === "in_progress" || value === "completed" || value === "reopened") {
    return value;
  }

  throw new Error("A valid onboarding status is required.");
}

function normalizeMembershipStatusFilter(value: string | undefined) {
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

function formatDueDaysOffsetLabel(days: number | null | undefined) {
  if (days === null || days === undefined) {
    return "No default due date";
  }

  if (days === 0) {
    return "Due on apply date";
  }

  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

function buildOnboardingProgressLabel(totalCount: number, completedCount: number) {
  if (totalCount === 0) {
    return "No checklist";
  }

  return `${completedCount}/${totalCount} complete`;
}

function buildTransactionSummaryLabel(openCount: number, recentClosedCount: number) {
  return `${openCount} open · ${recentClosedCount} recent`;
}

function buildGoalProgressSummary(goal: OfficeAgentGoalRecord | null) {
  if (!goal) {
    return "No active goal";
  }

  const transactionTarget = goal.targetTransactionCount === "—" ? "—" : goal.targetTransactionCount;
  return `${goal.actualTransactionCount}/${transactionTarget} tx · ${goal.actualClosedVolume}`;
}

function getCurrentOrLatestGoal(goalSnapshots: OfficeAgentGoalRecord[]) {
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

function getDefaultOnboardingTemplateSeedData() {
  return defaultOnboardingItems.map((item, index) => ({
    title: item.title,
    description: item.description,
    category: item.category,
    dueDaysOffset: item.dueDaysOffset,
    sortOrder: index
  }));
}

function resolveOnboardingDueDate(baseDate: Date, dueDaysOffset: number | null | undefined) {
  if (dueDaysOffset === null || dueDaysOffset === undefined) {
    return null;
  }

  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + dueDaysOffset);
  return dueDate;
}

function getMembershipLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}) {
  return `${membership.user.firstName} ${membership.user.lastName}`;
}

function redactAgentGoalFinancials(goal: OfficeAgentGoalRecord, allowed: boolean): OfficeAgentGoalRecord {
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

function redactAgentCommissionSummary(summary: OfficeAgentCommissionSummary, allowed: boolean): OfficeAgentCommissionSummary {
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

async function validateTeamMembershipHierarchy(
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

async function validateTeamParentAssignment(
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

async function syncManagedMembershipTitle(tx: Prisma.TransactionClient, membershipId: string) {
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

async function syncManagedMembershipTitlesForTeam(tx: Prisma.TransactionClient, teamId: string) {
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

async function syncManagedMembershipTitlesForTeamBranch(
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

function getActivityActionLabel(action: string) {
  switch (action) {
    case activityLogActions.transactionCreated:
      return "Transaction created";
    case activityLogActions.transactionUpdated:
      return "Transaction updated";
    case activityLogActions.transactionStatusChanged:
      return "Transaction status changed";
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

function getPayloadObjectLabel(payload: Prisma.JsonValue | null) {
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

function buildChange(label: string, previousValue: string, nextValue: string): ActivityLogChange | null {
  return previousValue === nextValue ? null : { label, previousValue, nextValue };
}

async function ensureMembershipExists(
  tx: Prisma.TransactionClient,
  organizationId: string,
  membershipId: string,
  officeId?: string | null
) {
  const membership = await tx.membership.findFirst({
    where: {
      id: membershipId,
      organizationId,
      ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {})
    },
    include: {
      user: true,
      office: true,
      agentProfile: true
    }
  });

  if (!membership) {
    throw new Error("Agent membership was not found.");
  }

  return membership;
}

async function listActiveOnboardingTemplateItems(
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

async function applyOnboardingTemplateItems(
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

async function syncAgentProfileOnboardingStatus(
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

  return nextStatus;
}

async function ensureAgentProfileFoundation(
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

function getGoalProgressSourceDate(transaction: {
  closingDate: Date | null;
  updatedAt: Date;
}) {
  return transaction.closingDate ?? transaction.updatedAt;
}

async function getBillingSummaryByMembership(
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

export async function getOfficeAgentsRosterSnapshot(input: GetOfficeAgentsRosterInput): Promise<OfficeAgentsRosterSnapshot> {
  const membershipStatusFilter = normalizeMembershipStatusFilter(input.membershipStatus);
  const scopedOfficeId = input.officeFilterId || input.officeId || undefined;
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: scopedOfficeId ?? null
  });
  const scopedTeams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
      ...(scope.visibleTeamIds ? { id: { in: scope.visibleTeamIds } } : {})
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      parentTeamId: true
    },
    orderBy: [{ name: "asc" }]
  });
  const teamHierarchyIndex = createTeamHierarchyIndex(scopedTeams);
  const filteredTeamIds = input.teamId ? expandSelectedTeamIds(teamHierarchyIndex, input.teamId) : [];
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      ...buildMembershipVisibilityWhere(scope),
      ...(membershipStatusFilter ?? {}),
      ...(scopedOfficeId ? { officeId: scopedOfficeId } : {}),
      ...(input.role ? { role: input.role as UserRole } : {}),
      ...(input.teamId
        ? {
            teamMemberships: {
              some: {
                teamId: {
                  in: filteredTeamIds.length > 0 ? filteredTeamIds : ["__no_team__"]
                }
              }
            }
          }
        : {}),
      ...(input.q?.trim()
        ? {
            OR: [
              { user: { firstName: { contains: input.q.trim(), mode: "insensitive" } } },
              { user: { lastName: { contains: input.q.trim(), mode: "insensitive" } } },
              { user: { email: { contains: input.q.trim(), mode: "insensitive" } } },
              { title: { contains: input.q.trim(), mode: "insensitive" } },
              { agentProfile: { displayName: { contains: input.q.trim(), mode: "insensitive" } } },
              { teamMemberships: { some: { team: { name: { contains: input.q.trim(), mode: "insensitive" } } } } }
            ]
          }
        : {})
    },
    include: {
      user: true,
      office: true,
      agentProfile: true,
      teamMemberships: {
        where: {
          ...(scopedTeams.length ? { teamId: { in: scopedTeams.map((team) => team.id) } } : {})
        },
        include: {
          team: true,
          reportsToTeamMembership: {
            include: {
              membership: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  const membershipIds = memberships.map((membership) => membership.id);
  const recentClosedCutoff = new Date();
  recentClosedCutoff.setDate(recentClosedCutoff.getDate() - 90);

  const [offices, teams, onboardingItems, openTaskCounts, allTransactions, goals, billingSummary] = await Promise.all([
    prisma.office.findMany({
      where: {
        organizationId: input.organizationId,
        ...(scopedOfficeId ? { id: scopedOfficeId } : {})
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.team.findMany({
      where: {
        id: {
          in: scopedTeams.map((team) => team.id)
        }
      },
      include: {
        memberships: {
          where: {
            ...(scope.visibleMembershipIds ? { membershipId: { in: scope.visibleMembershipIds } } : {})
          },
          include: {
            membership: {
              include: {
                user: true
              }
            },
            reportsToTeamMembership: {
              include: {
                membership: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.agentOnboardingItem.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: {
          in: membershipIds
        },
        ...(input.officeId ? { officeId: input.officeId } : {})
      },
      select: {
        membershipId: true,
        status: true
      }
    }),
    prisma.transactionTask.groupBy({
      by: ["assigneeMembershipId"],
      where: {
        organizationId: input.organizationId,
        assigneeMembershipId: {
          in: membershipIds
        },
        status: {
          in: ["todo", "in_progress", "review_requested", "reopened"]
        },
        transaction: input.officeId
          ? {
              officeId: input.officeId
            }
          : undefined
      },
      _count: {
        _all: true
      }
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: {
          in: membershipIds
        },
        ...(scopedOfficeId ? { officeId: scopedOfficeId } : {})
      },
      select: {
        ownerMembershipId: true,
        status: true,
        price: true,
        officeNet: true,
        agentNet: true,
        closingDate: true,
        updatedAt: true,
        createdAt: true
      }
    }),
    prisma.agentGoal.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: {
          in: membershipIds
        },
        ...(scopedOfficeId ? { officeId: scopedOfficeId } : {})
      },
      orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }]
    }),
    getBillingSummaryByMembership(input.organizationId, membershipIds, scopedOfficeId)
  ]);

  const openTaskCountMap = new Map(openTaskCounts.map((item) => [item.assigneeMembershipId ?? "", item._count._all]));
  const openTransactionCountMap = new Map<string, number>();
  const recentClosedCountMap = new Map<string, number>();
  const teamHierarchy = buildTeamMembershipHierarchyMap({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      isActive: team.isActive,
      parentTeamId: team.parentTeamId ?? null
    })),
    teamMemberships: teams.flatMap((team) =>
      team.memberships.map((teamMembership) => ({
        id: teamMembership.id,
        membershipId: teamMembership.membershipId,
        teamId: teamMembership.teamId,
        role: teamMembership.role,
        reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
        label: getMembershipLabel(teamMembership.membership)
      }))
    )
  });
  const teamPathLabelMap = new Map(teams.map((team) => [team.id, buildTeamPathLabel(teamHierarchy.index, team.id)]));
  const onboardingProgressMap = new Map<
    string,
    {
      totalCount: number;
      completedCount: number;
      status: AgentOnboardingStatus;
    }
  >();
  const goalProgressSummaryMap = new Map<string, string>();

  for (const transaction of allTransactions) {
    const membershipId = transaction.ownerMembershipId ?? "";
    if (!membershipId) {
      continue;
    }

    if (transaction.status === "opportunity" || transaction.status === "active" || transaction.status === "pending") {
      openTransactionCountMap.set(membershipId, (openTransactionCountMap.get(membershipId) ?? 0) + 1);
    }

    if (transaction.status === "closed" && getGoalProgressSourceDate(transaction) >= recentClosedCutoff) {
      recentClosedCountMap.set(membershipId, (recentClosedCountMap.get(membershipId) ?? 0) + 1);
    }
  }

  for (const item of onboardingItems) {
    const current = onboardingProgressMap.get(item.membershipId) ?? {
      totalCount: 0,
      completedCount: 0,
      status: "not_started" as AgentOnboardingStatus
    };
    current.totalCount += 1;
    if (item.status === "completed") {
      current.completedCount += 1;
    }
    onboardingProgressMap.set(item.membershipId, current);
  }

  for (const membership of memberships) {
    const current = onboardingProgressMap.get(membership.id) ?? {
      totalCount: 0,
      completedCount: 0,
      status: membership.agentProfile?.onboardingStatus ?? "not_started"
    };
    current.status = normalizeOnboardingStatus(
      membership.agentProfile?.onboardingStatus ?? "not_started",
      Array.from({ length: current.totalCount }, (_, index) => ({
        status:
          index < current.completedCount
            ? ("completed" as AgentOnboardingItemStatus)
            : ("pending" as AgentOnboardingItemStatus)
      }))
    );
    onboardingProgressMap.set(membership.id, current);
  }

  const transactionsByMembership = new Map<string, typeof allTransactions>();
  for (const membershipId of membershipIds) {
    transactionsByMembership.set(
      membershipId,
      allTransactions.filter((transaction) => transaction.ownerMembershipId === membershipId)
    );
  }

  const goalsByMembership = new Map<string, typeof goals>();
  for (const goal of goals) {
    const list = goalsByMembership.get(goal.membershipId) ?? [];
    list.push(goal);
    goalsByMembership.set(goal.membershipId, list);
  }

  for (const membership of memberships) {
    const membershipGoals = goalsByMembership.get(membership.id) ?? [];
    if (membershipGoals.length === 0) {
      goalProgressSummaryMap.set(membership.id, "No active goal");
      continue;
    }

    const goalSnapshots = membershipGoals.map((goal) => {
      const goalTransactions = (transactionsByMembership.get(membership.id) ?? []).filter(
        (transaction) => transaction.createdAt >= goal.startsAt && transaction.createdAt <= goal.endsAt
      );

      const closedTransactions = goalTransactions.filter(
        (transaction) =>
          transaction.status === "closed" &&
          getGoalProgressSourceDate(transaction) >= goal.startsAt &&
          getGoalProgressSourceDate(transaction) <= goal.endsAt
      );

      const closedVolume = closedTransactions.reduce((sum, transaction) => sum.plus(transaction.price ?? 0), new Prisma.Decimal(0));
      const officeNet = closedTransactions.reduce((sum, transaction) => sum.plus(transaction.officeNet ?? 0), new Prisma.Decimal(0));
      const agentNet = closedTransactions.reduce((sum, transaction) => sum.plus(transaction.agentNet ?? 0), new Prisma.Decimal(0));

      return {
        id: goal.id,
        periodType: goalPeriodLabelMap[goal.periodType],
        startsAt: formatDateValue(goal.startsAt),
        endsAt: formatDateValue(goal.endsAt),
        targetTransactionCount: goal.targetTransactionCount ? String(goal.targetTransactionCount) : "—",
        targetClosedVolume: goal.targetClosedVolume ? formatCurrency(goal.targetClosedVolume) : "—",
        targetOfficeNet: goal.targetOfficeNet ? formatCurrency(goal.targetOfficeNet) : "—",
        targetAgentNet: goal.targetAgentNet ? formatCurrency(goal.targetAgentNet) : "—",
        actualTransactionCount: String(goalTransactions.length),
        actualClosedVolume: formatCurrency(closedVolume),
        actualOfficeNet: formatCurrency(officeNet),
        actualAgentNet: formatCurrency(agentNet),
        notes: goal.notes ?? ""
      } satisfies OfficeAgentGoalRecord;
    });

    goalProgressSummaryMap.set(membership.id, buildGoalProgressSummary(getCurrentOrLatestGoal(goalSnapshots)));
  }

  let filteredMemberships = memberships;

  if (input.onboardingStatus) {
    filteredMemberships = filteredMemberships.filter((membership) => {
      const onboardingProgress = onboardingProgressMap.get(membership.id);
      const status = onboardingProgress?.status ?? membership.agentProfile?.onboardingStatus ?? "not_started";
      return status === (input.onboardingStatus as AgentOnboardingStatus);
    });
  }

  const rows = filteredMemberships.map((membership) => {
    const balance = billingSummary.get(membership.id);
    const canViewFinancials = canViewFinancialsForMembership(scope, membership.id);
    const onboardingProgress = onboardingProgressMap.get(membership.id) ?? {
      totalCount: 0,
      completedCount: 0,
      status: membership.agentProfile?.onboardingStatus ?? "not_started"
    };
    const teamLabels = membership.teamMemberships
      .filter((teamMembership) => teamMembership.team.isActive)
      .map((teamMembership) => teamHierarchy.hierarchyMap.get(teamMembership.id)?.teamPathLabel ?? teamMembership.team.name);
    const openTransactionCount = openTransactionCountMap.get(membership.id) ?? 0;
    const recentClosedTransactionCount = recentClosedCountMap.get(membership.id) ?? 0;

    return {
      membershipId: membership.id,
      name: membership.agentProfile?.displayName?.trim() || `${membership.user.firstName} ${membership.user.lastName}`,
      email: membership.user.email,
      officeName: membership.office?.name ?? "Unassigned",
      role: roleLabelMap[membership.role],
      title:
        resolveMembershipDisplayTitle({
          role: membership.role,
          fallbackTitle: membership.title,
          teamMemberships: membership.teamMemberships.map((teamMembership) => ({
            ...teamMembership,
            teamPathLabel: teamPathLabelMap.get(teamMembership.teamId) ?? teamMembership.team.name
          }))
        }) || "—",
      teamLabel: teamLabels.length ? [...new Set(teamLabels)].join(" • ") : "No team",
      membershipStatus: membershipStatusLabelMap[membership.status],
      membershipStatusValue: membership.status,
      onboardingStatus: onboardingStatusLabelMap[onboardingProgress.status],
      onboardingProgressLabel: buildOnboardingProgressLabel(
        onboardingProgress.totalCount,
        onboardingProgress.completedCount
      ),
      activeTasksCount: openTaskCountMap.get(membership.id) ?? 0,
      openTransactionCount,
      recentClosedTransactionCount,
      transactionSummaryLabel: buildTransactionSummaryLabel(openTransactionCount, recentClosedTransactionCount),
      goalProgressSummary: goalProgressSummaryMap.get(membership.id) ?? "No active goal",
      billingBalanceLabel: redactCurrency(formatCurrency(balance?.currentBalance ?? 0), canViewFinancials),
      billingSummaryLabel: canViewFinancials
        ? `${formatCurrency(balance?.currentBalance ?? 0)} · ${balance?.openChargesCount ?? 0} open`
        : "Restricted",
      href: `/office/agents/${membership.id}`
    };
  });

  const activeTeamCount = teams.filter((team) => team.isActive && team.memberships.length > 0).length;
  const onboardingInProgressCount = rows.filter((row) => row.onboardingStatus === "In progress").length;
  const roleOptions = [
    { value: "owner", label: "Owner" },
    { value: "office_admin", label: "Office Admin" },
    { value: "accountant", label: "Accountant" },
    { value: "human_resources", label: "Human Resources" },
    { value: "team_lead", label: "Team Lead" },
    { value: "agent", label: "Agent" },
    ...(memberships.some((membership) => membership.role === "office_manager")
      ? [{ value: "office_manager", label: "Office Manager (Legacy)" }]
      : []),
    ...(memberships.some((membership) => membership.role === "office_user")
      ? [{ value: "office_user", label: "Office User (Legacy)" }]
      : [])
  ];

  return {
    summary: {
      totalMembers: rows.length,
      agentCount: rows.filter((row) => row.role === "Agent" || row.role === "Team Lead").length,
      onboardingInProgressCount,
      activeTeamCount,
      inactiveMemberCount: rows.filter((row) => row.membershipStatusValue !== "active").length
    },
    filters: {
      officeId: scopedOfficeId ?? "",
      role: input.role ?? "",
      teamId: input.teamId ?? "",
      onboardingStatus: input.onboardingStatus ?? "",
      membershipStatus: input.membershipStatus ?? "",
      q: input.q?.trim() ?? "",
      officeOptions: offices.map((office) => ({
        id: office.id,
        label: office.name
      })),
      roleOptions,
      teamOptions: teams.map((team) => ({
        id: team.id,
        label: teamPathLabelMap.get(team.id) ?? team.name
      }))
    },
    rows,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      isActive: team.isActive,
      parentTeamId: team.parentTeamId ?? null,
      depth: getTeamDepth(teamHierarchy.index, team.id),
      teamPathLabel: teamPathLabelMap.get(team.id) ?? team.name,
      childTeamCount: teamHierarchy.index.childTeamIdsByParentId.get(team.id)?.length ?? 0,
      memberCount: team.memberships.length,
      openTaskCount: team.memberships.reduce(
        (sum, teamMembership) => sum + (openTaskCountMap.get(teamMembership.membershipId) ?? 0),
        0
      ),
      openTransactionCount: team.memberships.reduce(
        (sum, teamMembership) => sum + (openTransactionCountMap.get(teamMembership.membershipId) ?? 0),
        0
      ),
      onboardingInProgressCount: team.memberships.reduce((sum, teamMembership) => {
        const progress = onboardingProgressMap.get(teamMembership.membershipId);
        return sum + (progress?.status === "in_progress" ? 1 : 0);
      }, 0),
      members: team.memberships.map((teamMembership) => ({
        teamMembershipId: teamMembership.id,
        membershipId: teamMembership.membershipId,
        label: getMembershipLabel(teamMembership.membership),
        role: formatTeamMembershipRoleLabel(teamMembership.role),
        roleValue: teamMembership.role,
        reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
        reportsToLabel:
          teamHierarchy.hierarchyMap.get(teamMembership.id)?.directManagerLabel ??
          (teamMembership.reportsToTeamMembership ? getMembershipLabel(teamMembership.reportsToTeamMembership.membership) : "No direct manager")
      }))
    }))
  };
}

export async function getOfficeAgentProfileSnapshot(input: GetOfficeAgentProfileInput): Promise<OfficeAgentProfileSnapshot | null> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null
  });

  if (!canAccessMembership(scope, input.membershipId)) {
    return null;
  }

  let membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      ...buildMembershipVisibilityWhere(scope),
      ...(input.officeId ? { officeId: input.officeId } : {})
    },
    include: {
      user: true,
      office: true,
      agentProfile: true,
      teamMemberships: {
        where: {
          ...(scope.visibleTeamIds ? { teamId: { in: scope.visibleTeamIds } } : {})
        },
        include: {
          team: true,
          reportsToTeamMembership: {
            include: {
              membership: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!membership) {
    return null;
  }

  await ensureAgentProfileFoundation(input.organizationId, input.membershipId, input.officeId);

  membership =
    (await prisma.membership.findUnique({
      where: {
        id: membership.id
      },
      include: {
        user: true,
        office: true,
        agentProfile: true,
        teamMemberships: {
          where: {
            ...(scope.visibleTeamIds ? { teamId: { in: scope.visibleTeamIds } } : {})
          },
          include: {
            team: true,
            reportsToTeamMembership: {
              include: {
                membership: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })) ?? membership;

  const canViewFinancials = canViewFinancialsForMembership(scope, input.membershipId);

  const [
    onboardingItems,
    goals,
    recentTransactions,
    activeTaskCount,
    billingSummaryMap,
    commissionSummary,
    recentActivity,
    availableTeams,
    defaultCommission,
    templateDefaults,
    openTransactionTasks,
    allTransactionsForSummary
  ] =
    await Promise.all([
      prisma.agentOnboardingItem.findMany({
        where: {
          organizationId: input.organizationId,
          membershipId: input.membershipId,
          ...(input.officeId ? { officeId: input.officeId } : {})
        },
        include: {
          completedByMembership: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }),
      prisma.agentGoal.findMany({
        where: {
          organizationId: input.organizationId,
          membershipId: input.membershipId,
          ...(input.officeId ? { officeId: input.officeId } : {})
        },
        orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.transaction.findMany({
        where: {
          organizationId: input.organizationId,
          ownerMembershipId: input.membershipId,
          ...(input.officeId ? { officeId: input.officeId } : {})
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 6
      }),
      prisma.transactionTask.count({
        where: {
          organizationId: input.organizationId,
          assigneeMembershipId: input.membershipId,
          status: {
            in: ["todo", "in_progress", "review_requested", "reopened"]
          },
          transaction: input.officeId
            ? {
                officeId: input.officeId
              }
            : undefined
        }
      }),
      getBillingSummaryByMembership(input.organizationId, [input.membershipId], input.officeId),
      getAgentCommissionSummary({
        organizationId: input.organizationId,
        officeId: input.officeId,
        membershipId: input.membershipId
      }),
      prisma.auditLog.findMany({
        where: {
          organizationId: input.organizationId,
          membershipId: input.membershipId
        },
        orderBy: [{ createdAt: "desc" }],
        take: 8
      }),
      prisma.team.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {}),
          ...(scope.visibleTeamIds ? { id: { in: scope.visibleTeamIds } } : {})
        },
        orderBy: [{ name: "asc" }]
      }),
      getMembershipCommissionEditorSnapshot({
        organizationId: input.organizationId,
        officeId: input.officeId,
        membershipId: input.membershipId
      }),
      listActiveOnboardingTemplateItems(prisma, input.organizationId, input.officeId),
      prisma.transactionTask.findMany({
        where: {
          organizationId: input.organizationId,
          assigneeMembershipId: input.membershipId,
          status: {
            in: ["todo", "in_progress", "review_requested", "reopened"]
          },
          transaction: input.officeId
            ? {
                officeId: input.officeId
              }
            : undefined
        },
        include: {
          transaction: {
            select: {
              id: true,
              title: true,
              address: true
            }
          }
        },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
        take: 6
      }),
      prisma.transaction.findMany({
        where: {
          organizationId: input.organizationId,
          ownerMembershipId: input.membershipId,
          ...(input.officeId ? { officeId: input.officeId } : {})
        },
        select: {
          status: true,
          price: true,
          officeNet: true,
          agentNet: true,
          closingDate: true,
          updatedAt: true,
          createdAt: true
        }
      })
    ]);

  const scopedTeamMemberships = availableTeams.length
    ? await prisma.teamMembership.findMany({
        where: {
          organizationId: input.organizationId,
          teamId: {
            in: availableTeams.map((team) => team.id)
          }
        },
        include: {
          membership: {
            include: {
              user: true
            }
          }
        }
      })
    : [];
  const availableTeamHierarchy = buildTeamMembershipHierarchyMap({
    teams: availableTeams.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      isActive: team.isActive,
      parentTeamId: team.parentTeamId ?? null
    })),
    teamMemberships: scopedTeamMemberships.map((teamMembership) => ({
      id: teamMembership.id,
      membershipId: teamMembership.membershipId,
      teamId: teamMembership.teamId,
      role: teamMembership.role,
      reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
      label: getMembershipLabel(teamMembership.membership)
    }))
  });
  const availableTeamPathLabelMap = new Map(
    availableTeams.map((team) => [team.id, buildTeamPathLabel(availableTeamHierarchy.index, team.id)])
  );
  const availableTeamManagerOptionsMap = new Map<
    string,
    OfficeAgentProfileAvailableTeamManager[]
  >(
    availableTeams.map((team) => {
      const managers = scopedTeamMemberships
        .filter(
          (teamMembership) =>
            teamMembership.teamId === team.id && isValidBranchLeaderRole(team.parentTeamId ?? null, teamMembership.role)
        )
        .sort((left, right) => {
          if (left.role !== right.role) {
            return left.role === "team_leader" ? -1 : 1;
          }

          return getMembershipLabel(left.membership).localeCompare(getMembershipLabel(right.membership));
        })
        .map((teamMembership) => ({
          teamMembershipId: teamMembership.id,
          membershipId: teamMembership.membershipId,
          label: getMembershipLabel(teamMembership.membership),
          role: formatTeamMembershipRoleLabel(teamMembership.role),
          roleValue: teamMembership.role
        }));

      return [team.id, managers];
    })
  );

  const pipelineTransactions = await prisma.transaction.groupBy({
    by: ["status"],
    where: {
      organizationId: input.organizationId,
      ownerMembershipId: input.membershipId,
      ...(input.officeId ? { officeId: input.officeId } : {})
    },
    _count: {
      _all: true
    }
  });

  const goalSnapshots = await Promise.all(
    goals.map(async (goal) => {
      const goalTransactions = await prisma.transaction.findMany({
        where: {
          organizationId: input.organizationId,
          ownerMembershipId: input.membershipId,
          ...(input.officeId ? { officeId: input.officeId } : {}),
          createdAt: {
            gte: goal.startsAt,
            lte: goal.endsAt
          }
        },
        select: {
          status: true,
          price: true,
          officeNet: true,
          agentNet: true,
          closingDate: true,
          updatedAt: true
        }
      });

      const closedTransactions = goalTransactions.filter(
        (transaction) =>
          transaction.status === "closed" &&
          getGoalProgressSourceDate(transaction) >= goal.startsAt &&
          getGoalProgressSourceDate(transaction) <= goal.endsAt
      );

      const closedVolume = closedTransactions.reduce((sum, transaction) => sum.plus(transaction.price ?? 0), new Prisma.Decimal(0));
      const officeNet = closedTransactions.reduce((sum, transaction) => sum.plus(transaction.officeNet ?? 0), new Prisma.Decimal(0));
      const agentNet = closedTransactions.reduce((sum, transaction) => sum.plus(transaction.agentNet ?? 0), new Prisma.Decimal(0));

      return {
        id: goal.id,
        periodType: goalPeriodLabelMap[goal.periodType],
        startsAt: formatDateValue(goal.startsAt),
        endsAt: formatDateValue(goal.endsAt),
        targetTransactionCount: goal.targetTransactionCount ? String(goal.targetTransactionCount) : "—",
        targetClosedVolume: goal.targetClosedVolume ? formatCurrency(goal.targetClosedVolume) : "—",
        targetOfficeNet: goal.targetOfficeNet ? formatCurrency(goal.targetOfficeNet) : "—",
        targetAgentNet: goal.targetAgentNet ? formatCurrency(goal.targetAgentNet) : "—",
        actualTransactionCount: String(goalTransactions.length),
        actualClosedVolume: formatCurrency(closedVolume),
        actualOfficeNet: formatCurrency(officeNet),
        actualAgentNet: formatCurrency(agentNet),
        notes: goal.notes ?? ""
      };
    })
  );

  const completedOnboardingCount = onboardingItems.filter((item) => item.status === "completed").length;
  const recentClosedCutoff = new Date();
  recentClosedCutoff.setDate(recentClosedCutoff.getDate() - 90);
  const recentClosedTransactionCount = allTransactionsForSummary.filter(
    (transaction) => transaction.status === "closed" && getGoalProgressSourceDate(transaction) >= recentClosedCutoff
  ).length;
  const profileStatus = normalizeOnboardingStatus(membership.agentProfile?.onboardingStatus, onboardingItems);
  const billingSummary = billingSummaryMap.get(input.membershipId);
  const currentGoalSummary = buildGoalProgressSummary(getCurrentOrLatestGoal(goalSnapshots));
  const onboardingAgenda = onboardingItems
    .filter((item) => item.status !== "completed")
    .slice(0, 4)
    .map((item) => ({
      id: `onboarding-${item.id}`,
      kind: "Onboarding",
      title: item.title,
      statusLabel: onboardingItemStatusLabelMap[item.status],
      dueAtLabel: formatDateLabel(item.dueAt),
      href: `/office/agents/${input.membershipId}#onboarding`
    }));
  const taskAgenda = openTransactionTasks.map((task) => ({
    id: `task-${task.id}`,
    kind: "Transaction task",
    title: task.title,
    statusLabel: task.status,
    dueAtLabel: formatDateLabel(task.dueAt),
    href: `/office/transactions/${task.transactionId}#tasks`
  }));
  const operationalAgenda = [...onboardingAgenda, ...taskAgenda].slice(0, 8);

  return {
    financialsRestricted: !canViewFinancials,
    profile: {
      membershipId: membership.id,
      userId: membership.user.id,
      fullName: `${membership.user.firstName} ${membership.user.lastName}`,
      displayName:
        membership.agentProfile?.displayName?.trim() || `${membership.user.firstName} ${membership.user.lastName}`,
      email: membership.user.email,
      officeName: membership.office?.name ?? "Unassigned",
      role: roleLabelMap[membership.role],
      membershipStatus: membershipStatusLabelMap[membership.status],
      membershipStatusValue: membership.status,
      title: resolveMembershipDisplayTitle({
        role: membership.role,
        fallbackTitle: membership.title,
        teamMemberships: membership.teamMemberships.map((teamMembership) => ({
          ...teamMembership,
          teamPathLabel: availableTeamPathLabelMap.get(teamMembership.teamId) ?? teamMembership.team.name
        }))
      }),
      bio: membership.agentProfile?.bio ?? "",
      notes: membership.agentProfile?.notes ?? "",
      licenseNumber: membership.agentProfile?.licenseNumber ?? "",
      licenseState: membership.agentProfile?.licenseState ?? "",
      startDate: formatDateValue(membership.agentProfile?.startDate),
      onboardingStatus: onboardingStatusLabelMap[profileStatus],
      onboardingStatusValue: profileStatus,
      commissionPlanName: membership.agentProfile?.commissionPlanName ?? "",
      avatarUrl: membership.agentProfile?.avatarUrl ?? "",
      internalExtension: membership.agentProfile?.internalExtension ?? ""
    },
    defaultCommission,
    summary: {
      activeTaskCount,
      openTransactionCount: pipelineTransactions
        .filter((item) => item.status !== "closed" && item.status !== "cancelled")
        .reduce((sum, item) => sum + item._count._all, 0),
      recentClosedTransactionCount,
      currentBalanceLabel: redactCurrency(formatCurrency(billingSummary?.currentBalance ?? 0), canViewFinancials),
      paymentMethodsCount: billingSummary?.paymentMethodsCount ?? 0,
      openChargesCount: billingSummary?.openChargesCount ?? 0,
      pendingChargesCount: billingSummary?.pendingChargesCount ?? 0,
      currentGoalSummary,
      operationalAgendaCount: operationalAgenda.length,
      pipelineCounts: [
        { label: "Opportunity", count: pipelineTransactions.find((item) => item.status === "opportunity")?._count._all ?? 0 },
        { label: "Active", count: pipelineTransactions.find((item) => item.status === "active")?._count._all ?? 0 },
        { label: "Pending", count: pipelineTransactions.find((item) => item.status === "pending")?._count._all ?? 0 },
        { label: "Closed", count: pipelineTransactions.find((item) => item.status === "closed")?._count._all ?? 0 }
      ]
    },
    commissions: redactAgentCommissionSummary(commissionSummary, canViewFinancials),
    teams: membership.teamMemberships.map((teamMembership) => ({
      id: teamMembership.team.id,
      teamMembershipId: teamMembership.id,
      name: teamMembership.team.name,
      slug: teamMembership.team.slug,
      isActive: teamMembership.team.isActive,
      teamPathLabel: availableTeamPathLabelMap.get(teamMembership.team.id) ?? teamMembership.team.name,
      depth: availableTeamHierarchy.hierarchyMap.get(teamMembership.id)?.depth ?? 0,
      directManagerMembershipId: availableTeamHierarchy.hierarchyMap.get(teamMembership.id)?.directManagerMembershipId ?? null,
      rootLeaderLabel: availableTeamHierarchy.hierarchyMap.get(teamMembership.id)?.rootLeader?.label ?? "—",
      role: formatTeamMembershipRoleLabel(teamMembership.role),
      roleValue: teamMembership.role,
      reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
      reportsToLabel:
        availableTeamHierarchy.hierarchyMap.get(teamMembership.id)?.directManagerLabel ??
        (teamMembership.reportsToTeamMembership ? getMembershipLabel(teamMembership.reportsToTeamMembership.membership) : "No direct manager")
    })),
    availableTeams: availableTeams.map((team) => {
      const managerOptions = availableTeamManagerOptionsMap.get(team.id) ?? [];
      const teamPathLabel = availableTeamPathLabelMap.get(team.id) ?? team.name;

      return {
        id: team.id,
        label: formatAssignableTeamLabel(teamPathLabel, managerOptions.map((manager) => manager.label)),
        managerOptions,
        defaultReportsToTeamMembershipId: managerOptions.length === 1 ? managerOptions[0]?.teamMembershipId ?? null : null
      };
    }),
    onboarding: {
      totalCount: onboardingItems.length,
      completedCount: completedOnboardingCount,
      statusLabel: onboardingStatusLabelMap[profileStatus],
      templateDefaultsCount: templateDefaults.length,
      templateDefaults: templateDefaults.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        category: item.category,
        dueDaysOffsetLabel: formatDueDaysOffsetLabel(item.dueDaysOffset)
      })),
      items: onboardingItems.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        category: item.category,
        dueAt: formatDateValue(item.dueAt),
        status: onboardingItemStatusLabelMap[item.status],
        statusValue: item.status,
        completedAt: formatDateValue(item.completedAt),
        completedByName: item.completedByMembership ? getMembershipLabel(item.completedByMembership) : ""
      }))
    },
    goals: goalSnapshots.map((goal) => redactAgentGoalFinancials(goal, canViewFinancials)),
    operationalAgenda,
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction.id,
      label: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`,
      status: transaction.status,
      priceLabel: formatCurrency(transaction.price),
      href: `/office/transactions/${transaction.id}`
    })),
    recentActivity: recentActivity.map((item) => ({
      id: item.id,
      actionLabel: getActivityActionLabel(item.action),
      objectLabel: getPayloadObjectLabel(item.payload),
      timestampLabel: formatDateTimeLabel(item.createdAt)
    }))
  };
}

export async function saveAgentProfile(input: SaveAgentProfileInput) {
  return prisma.$transaction(async (tx) => {
    const membership = await ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId);
    const previousProfile = await tx.agentProfile.findUnique({
      where: {
        membershipId: input.membershipId
      }
    });

    const previousDisplayName = previousProfile?.displayName?.trim() || `${membership.user.firstName} ${membership.user.lastName}`;
    const previousLicense = previousProfile?.licenseNumber?.trim() || "—";
    const previousPlan = previousProfile?.commissionPlanName?.trim() || "—";

    const savedProfile = await tx.agentProfile.upsert({
      where: {
        membershipId: input.membershipId
      },
      update: {
        organizationId: input.organizationId,
        officeId: membership.officeId,
        displayName: parseOptionalText(input.displayName),
        bio: parseOptionalText(input.bio),
        notes: parseOptionalText(input.notes),
        licenseNumber: parseOptionalText(input.licenseNumber),
        licenseState: parseOptionalText(input.licenseState),
        startDate: parseOptionalDate(input.startDate),
        avatarUrl: parseOptionalText(input.avatarUrl),
        internalExtension: parseOptionalText(input.internalExtension)
      },
      create: {
        organizationId: input.organizationId,
        officeId: membership.officeId,
        membershipId: input.membershipId,
        displayName: parseOptionalText(input.displayName),
        bio: parseOptionalText(input.bio),
        notes: parseOptionalText(input.notes),
        licenseNumber: parseOptionalText(input.licenseNumber),
        licenseState: parseOptionalText(input.licenseState),
        startDate: parseOptionalDate(input.startDate),
        avatarUrl: parseOptionalText(input.avatarUrl),
        internalExtension: parseOptionalText(input.internalExtension)
      }
    });

    const shouldSaveDefaultCommission =
      input.splitTemplateId !== undefined ||
      input.customAgentPercent !== undefined ||
      input.commissionEffectiveFrom !== undefined ||
      input.commissionEffectiveTo !== undefined;

    if (shouldSaveDefaultCommission) {
      await saveMembershipCommissionSetting(
        {
          organizationId: input.organizationId,
          officeId: input.officeId ?? membership.officeId,
          membershipId: input.membershipId,
          splitTemplateId: input.splitTemplateId,
          customAgentPercent: input.customAgentPercent,
          effectiveFrom: input.commissionEffectiveFrom ?? "",
          effectiveTo: input.commissionEffectiveTo,
          actorMembershipId: input.actorMembershipId,
          contextHref: `/office/agents/${input.membershipId}`,
          recordActivity: false
        },
        tx
      );
    }

    await syncAgentProfileOnboardingStatus(tx, input.organizationId, input.membershipId, input.officeId);

    const finalProfile = await tx.agentProfile.findUnique({
      where: {
        membershipId: input.membershipId
      }
    });
    const nextDisplayName = savedProfile.displayName?.trim() || `${membership.user.firstName} ${membership.user.lastName}`;
    const nextLicense = savedProfile.licenseNumber?.trim() || "—";
    const nextPlan = finalProfile?.commissionPlanName?.trim() || "—";
    const changes = [
      buildChange("Display name", previousDisplayName, nextDisplayName),
      buildChange("License number", previousLicense, nextLicense),
      buildChange("Default split", previousPlan, nextPlan)
    ].filter((change): change is ActivityLogChange => Boolean(change));

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_profile",
      entityId: savedProfile.id,
      action: previousProfile ? activityLogActions.agentProfileUpdated : activityLogActions.agentProfileCreated,
      payload: {
        officeId: membership.officeId,
        objectLabel: nextDisplayName,
        contextHref: `/office/agents/${input.membershipId}`,
        details: [`Role: ${roleLabelMap[membership.role]}`],
        changes
      }
    });

    return finalProfile ?? savedProfile;
  });
}

export async function applyAgentOnboardingTemplate(input: ApplyAgentOnboardingTemplateInput) {
  return prisma.$transaction(async (tx) => {
    const { membership, appliedCount } = await applyOnboardingTemplateItems(
      tx,
      input.organizationId,
      input.membershipId,
      input.officeId
    );

    await syncAgentProfileOnboardingStatus(tx, input.organizationId, input.membershipId, input.officeId);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_onboarding_item",
      entityId: input.membershipId,
      action: activityLogActions.agentOnboardingTemplateApplied,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${getMembershipLabel(membership)} · Standard onboarding`,
        contextHref: `/office/agents/${input.membershipId}#onboarding`,
        details: [`Applied ${appliedCount} template item${appliedCount === 1 ? "" : "s"}`]
      }
    });

    return {
      appliedCount
    };
  });
}

export async function createAgentTeam(input: CreateAgentTeamInput) {
  const name = input.name.trim();
  const leaderMembershipId = input.leaderMembershipId.trim();

  if (!name) {
    throw new Error("Team name is required.");
  }

  if (!leaderMembershipId) {
    throw new Error("A team owner is required when creating a Team or Junior Team.");
  }

  return prisma.$transaction(async (tx) => {
    const parentTeamId = await validateTeamParentAssignment(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId,
      parentTeamId: input.parentTeamId ?? null,
      maxDepth: 1
    });
    const [leaderMembership, parentTeam] = await Promise.all([
      ensureMembershipExists(tx, input.organizationId, leaderMembershipId, input.officeId),
      parentTeamId
        ? tx.team.findUnique({
            where: {
              id: parentTeamId
            },
            select: {
              name: true
            }
          })
        : Promise.resolve(null)
    ]);
    const reusableParentMembership =
      parentTeamId
        ? await tx.teamMembership.findFirst({
            where: {
              organizationId: input.organizationId,
              membershipId: leaderMembership.id,
              teamId: parentTeamId,
              role: "member",
              team: {
                isActive: true
              }
            },
            select: {
              id: true
            }
          })
        : null;

    if (reusableParentMembership) {
      const directReportCount = await tx.teamMembership.count({
        where: {
          organizationId: input.organizationId,
          teamId: parentTeamId ?? undefined,
          reportsToTeamMembershipId: reusableParentMembership.id
        }
      });

      if (directReportCount > 0) {
        throw new Error("Reassign this future Junior Team Leader's direct reports before creating the new Junior Team.");
      }

      await tx.teamMembership.delete({
        where: {
          id: reusableParentMembership.id
        }
      });
      await syncManagedMembershipTitle(tx, leaderMembership.id);
    }

    const baseSlug = slugify(name);
    const existingTeams = await tx.team.findMany({
      where: {
        organizationId: input.organizationId,
        slug: {
          startsWith: baseSlug
        }
      },
      select: {
        slug: true
      }
    });
    const slug = existingTeams.some((team) => team.slug === baseSlug) ? `${baseSlug}-${existingTeams.length + 1}` : baseSlug;
    const team = await tx.team.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        name,
        slug,
        parentTeamId
      }
    });
    const leaderRole = getExpectedBranchLeaderRole(parentTeamId);

    await assignMembershipToTeamTx(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId,
      actorMembershipId: input.actorMembershipId,
      teamId: team.id,
      membershipId: leaderMembership.id,
      role: leaderRole,
      reportsToTeamMembershipId: null
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "team",
      entityId: team.id,
      action: activityLogActions.teamCreated,
      payload: {
        officeId: input.officeId ?? null,
        objectLabel: team.name,
        contextHref: `/office/agents?teamId=${team.id}`,
        details: [
          `Status: Active`,
          `Parent team: ${parentTeam?.name ?? "None"}`,
          `${teamRoleLabelMap[leaderRole]}: ${getMembershipLabel(leaderMembership)}`
        ]
      }
    });

    return team;
  });
}

export async function updateAgentTeam(input: UpdateAgentTeamInput) {
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.findFirst({
      where: {
        id: input.teamId,
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {})
      }
    });

    if (!team) {
      throw new Error("Team was not found.");
    }

    const nextName = parseOptionalText(input.name) ?? team.name;
    const nextIsActive = typeof input.isActive === "boolean" ? input.isActive : team.isActive;
    const nextParentTeamId =
      input.parentTeamId === undefined
        ? team.parentTeamId
        : await validateTeamParentAssignment(tx, {
            organizationId: input.organizationId,
            officeId: input.officeId,
            teamId: team.id,
            parentTeamId: input.parentTeamId,
            maxDepth: 1
          });
    const [currentParentTeam, nextParentTeam] = await Promise.all([
      team.parentTeamId
        ? tx.team.findUnique({
            where: {
              id: team.parentTeamId
            },
            select: {
              name: true
            }
          })
        : Promise.resolve(null),
      nextParentTeamId
        ? tx.team.findUnique({
            where: {
              id: nextParentTeamId
            },
            select: {
              name: true
            }
          })
        : Promise.resolve(null)
    ]);
    const changes = [
      buildChange("Name", team.name, nextName),
      buildChange("Status", team.isActive ? "Active" : "Inactive", nextIsActive ? "Active" : "Inactive"),
      buildChange("Parent team", currentParentTeam?.name ?? "None", nextParentTeam?.name ?? "None")
    ].filter((change): change is ActivityLogChange => Boolean(change));

    const updatedTeam = await tx.team.update({
      where: {
        id: input.teamId
      },
      data: {
        name: nextName,
        slug: nextName === team.name ? team.slug : slugify(nextName),
        isActive: nextIsActive,
        parentTeamId: nextParentTeamId
      }
    });

    const nextLeaderRole = getExpectedBranchLeaderRole(updatedTeam.parentTeamId);
    await tx.teamMembership.updateMany({
      where: {
        organizationId: input.organizationId,
        teamId: updatedTeam.id,
        role: {
          in: ["team_leader", "junior_team_leader"]
        }
      },
      data: {
        role: nextLeaderRole,
        reportsToTeamMembershipId: null
      }
    });

    await syncManagedMembershipTitlesForTeamBranch(tx, input.organizationId, updatedTeam.id, input.officeId);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "team",
      entityId: updatedTeam.id,
      action: nextIsActive ? activityLogActions.teamUpdated : activityLogActions.teamDeactivated,
      payload: {
        officeId: updatedTeam.officeId,
        objectLabel: updatedTeam.name,
        contextHref: `/office/agents?teamId=${updatedTeam.id}`,
        details: [],
        changes
      }
    });

    return updatedTeam;
  });
}

export async function deleteAgentTeam(input: DeleteAgentTeamInput) {
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.findFirst({
      where: {
        id: input.teamId,
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {})
      }
    });

    if (!team) {
      throw new Error("Team was not found.");
    }

    const [memberCount, childTeamCount, commissionAssignmentCount] = await Promise.all([
      tx.teamMembership.count({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId
        }
      }),
      tx.team.count({
        where: {
          organizationId: input.organizationId,
          parentTeamId: input.teamId
        }
      }),
      tx.commissionPlanAssignment.count({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId
        }
      })
    ]);

    if (memberCount > 0) {
      throw new Error("Remove all team members before deleting this team.");
    }

    if (childTeamCount > 0) {
      throw new Error("Remove or reassign this team's Junior Teams before deleting it.");
    }

    if (commissionAssignmentCount > 0) {
      throw new Error("Remove this team's commission plan assignments before deleting it.");
    }

    await tx.team.delete({
      where: {
        id: input.teamId
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "team",
      entityId: input.teamId,
      action: activityLogActions.teamDeleted,
      payload: {
        officeId: team.officeId,
        objectLabel: team.name,
        contextHref: "/office/settings/teams",
        details: []
      }
    });

    return {
      id: input.teamId
    };
  });
}

export async function addAgentToTeam(input: AddAgentToTeamInput) {
  return prisma.$transaction(async (tx) => assignMembershipToTeamTx(tx, input));
}

export async function assignMembershipToTeamTx(tx: Prisma.TransactionClient, input: AddAgentToTeamInput) {
  const [team, membership, existingTeamMembership, otherTeamMembership] = await Promise.all([
    tx.team.findFirst({
      where: {
        id: input.teamId,
        organizationId: input.organizationId,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      }
    }),
    ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId),
    tx.teamMembership.findUnique({
      where: {
        teamId_membershipId: {
          teamId: input.teamId,
          membershipId: input.membershipId
        }
      }
    }),
    tx.teamMembership.findFirst({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        NOT: {
          teamId: input.teamId
        },
        team: {
          isActive: true
        }
      },
      include: {
        team: true
      }
    })
  ]);

  if (!team) {
    throw new Error("Team was not found.");
  }

  if (otherTeamMembership) {
    throw new Error(
      `Each membership can only belong to one active team per organization. Remove the existing team assignment from ${otherTeamMembership.team.name} first.`
    );
  }

  const nextRole = normalizeTeamRole(input.role);
  const expectedLeaderRole = getExpectedBranchLeaderRole(team.parentTeamId);
  const validLeaderMemberships = await tx.teamMembership.findMany({
    where: {
      organizationId: input.organizationId,
      teamId: input.teamId,
      role: expectedLeaderRole
    },
    select: {
      id: true,
      membershipId: true,
      role: true
    }
  });
  const currentMembershipIsValidLeader = existingTeamMembership
    ? validLeaderMemberships.some((leader) => leader.id === existingTeamMembership.id)
    : false;
  const otherValidLeaders = validLeaderMemberships.filter((leader) => leader.id !== existingTeamMembership?.id);

  if (nextRole !== "member" && nextRole !== expectedLeaderRole) {
    throw new Error(
      team.parentTeamId
        ? "Junior Teams can only assign a Junior Team Leader as the owner."
        : "Teams can only assign a Team Leader as the owner."
    );
  }

  if (nextRole !== "member" && otherValidLeaders.length > 1) {
    throw new Error("This team currently has multiple active leaders. Clean that up before assigning a new owner.");
  }
  const transferLeader = nextRole === expectedLeaderRole ? otherValidLeaders[0] ?? null : null;

  const directReports = existingTeamMembership
    ? await tx.teamMembership.findMany({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          reportsToTeamMembershipId: existingTeamMembership.id
        },
        select: {
          id: true,
          role: true
        }
      })
    : [];

  if (nextRole === "member" && currentMembershipIsValidLeader && otherValidLeaders.length === 0) {
    throw new Error(
      team.parentTeamId
        ? "Transfer this Junior Team to another Junior Team Leader before changing the current owner."
        : "Transfer this Team to another Team Leader before changing the current owner."
    );
  }

  if (nextRole === "member" && directReports.length > 0) {
    throw new Error("Members cannot keep direct reports. Reassign direct reports first.");
  }

  const nextReportsToTeamMembershipId = await validateTeamMembershipHierarchy(tx, {
    organizationId: input.organizationId,
    officeId: input.officeId,
    teamId: input.teamId,
    teamParentTeamId: team.parentTeamId,
    membershipId: input.membershipId,
    role: nextRole,
    reportsToTeamMembershipId: input.reportsToTeamMembershipId,
    existingTeamMembershipId: existingTeamMembership?.id ?? null
  });

  const teamMembership = await tx.teamMembership.upsert({
    where: {
      teamId_membershipId: {
        teamId: input.teamId,
        membershipId: input.membershipId
      }
    },
    update: {
      role: nextRole,
      officeId: team.officeId,
      reportsToTeamMembershipId: nextReportsToTeamMembershipId
    },
    create: {
      organizationId: input.organizationId,
      officeId: team.officeId,
      teamId: input.teamId,
      membershipId: input.membershipId,
      role: nextRole,
      reportsToTeamMembershipId: nextReportsToTeamMembershipId
    }
  });

  if (transferLeader) {
    await tx.teamMembership.update({
      where: {
        id: transferLeader.id
      },
      data: {
        role: "member",
        reportsToTeamMembershipId: teamMembership.id
      }
    });
    await tx.teamMembership.updateMany({
      where: {
        organizationId: input.organizationId,
        teamId: input.teamId,
        reportsToTeamMembershipId: transferLeader.id
      },
      data: {
        reportsToTeamMembershipId: teamMembership.id
      }
    });
    await syncManagedMembershipTitle(tx, transferLeader.membershipId);
  }

  await syncManagedMembershipTitle(tx, input.membershipId);

  const directManager =
    teamMembership.reportsToTeamMembershipId
      ? await tx.teamMembership.findUnique({
          where: {
            id: teamMembership.reportsToTeamMembershipId
          },
          include: {
            membership: {
              include: {
                user: true
              }
            }
          }
        })
      : team.parentTeamId && nextRole !== "member"
        ? await tx.teamMembership.findFirst({
            where: {
              organizationId: input.organizationId,
              teamId: team.parentTeamId,
              role: {
                in: ["team_leader", "junior_team_leader"]
              }
            },
            include: {
              membership: {
                include: {
                  user: true
                }
              }
            }
          })
        : null;

  await recordActivityLogEvent(tx, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId,
    entityType: "team",
    entityId: team.id,
    action: activityLogActions.teamMemberAdded,
    payload: {
      officeId: team.officeId,
      objectLabel: `${team.name} · ${getMembershipLabel(membership)}`,
      contextHref: `/office/settings/users/${input.membershipId}`,
      details: [
        `Team role: ${teamRoleLabelMap[teamMembership.role]}`,
        `Direct manager: ${directManager ? getMembershipLabel(directManager.membership) : "None"}`,
        ...(transferLeader ? [`Leadership transferred from another ${teamRoleLabelMap[expectedLeaderRole]}`] : [])
      ]
    }
  });

  return teamMembership;
}

export async function removeAgentFromTeam(input: RemoveAgentFromTeamInput) {
  return prisma.$transaction(async (tx) => {
    const [team, membership, teamMembership] = await Promise.all([
      tx.team.findFirst({
        where: {
          id: input.teamId,
          organizationId: input.organizationId,
          ...(input.officeId ? { officeId: input.officeId } : {})
        }
      }),
      ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId),
      tx.teamMembership.findFirst({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          membershipId: input.membershipId
        }
      })
    ]);

    if (!team || !teamMembership) {
      throw new Error("Team membership was not found.");
    }

    const expectedLeaderRole = getExpectedBranchLeaderRole(team.parentTeamId);
    const [directReportCount, childTeamCount, otherValidLeaderCount] = await Promise.all([
      tx.teamMembership.count({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          reportsToTeamMembershipId: teamMembership.id
        }
      }),
      isLeaderTeamMembershipRole(teamMembership.role)
        ? tx.team.count({
            where: {
              organizationId: input.organizationId,
              parentTeamId: input.teamId
            }
          })
        : Promise.resolve(0),
      tx.teamMembership.count({
        where: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          role: expectedLeaderRole,
          NOT: {
            id: teamMembership.id
          }
        }
      })
    ]);

    if (teamMembership.role === expectedLeaderRole && otherValidLeaderCount === 0) {
      throw new Error(
        team.parentTeamId
          ? "Transfer this Junior Team to another Junior Team Leader before removing the current owner."
          : "Transfer this Team to another Team Leader before removing the current owner."
      );
    }

    if (directReportCount > 0) {
      throw new Error("Reassign or remove this member's direct reports before removing them from the team.");
    }

    if (childTeamCount > 0) {
      throw new Error("Reassign this team's Junior Teams before removing its leader.");
    }

    await tx.teamMembership.delete({
      where: {
        id: teamMembership.id
      }
    });

    await syncManagedMembershipTitle(tx, input.membershipId);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "team",
      entityId: team.id,
      action: activityLogActions.teamMemberRemoved,
      payload: {
        officeId: team.officeId,
        objectLabel: `${team.name} · ${getMembershipLabel(membership)}`,
        contextHref: `/office/agents/${input.membershipId}`,
        details: [`Previous role: ${teamRoleLabelMap[teamMembership.role]}`]
      }
    });

    return true;
  });
}

export async function createAgentOnboardingItem(input: CreateAgentOnboardingItemInput) {
  if (!input.title.trim()) {
    throw new Error("Onboarding item title is required.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId);
    const nextSortOrder = await tx.agentOnboardingItem.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId
      }
    });

    const item = await tx.agentOnboardingItem.create({
      data: {
        organizationId: input.organizationId,
        officeId: membership.officeId,
        membershipId: input.membershipId,
        title: input.title.trim(),
        description: parseOptionalText(input.description),
        category: parseOptionalText(input.category) ?? "General",
        dueAt: parseOptionalDate(input.dueAt),
        sortOrder: nextSortOrder
      }
    });

    await syncAgentProfileOnboardingStatus(tx, input.organizationId, input.membershipId, input.officeId);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_onboarding_item",
      entityId: item.id,
      action: activityLogActions.agentOnboardingItemCreated,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${getMembershipLabel(membership)} · ${item.title}`,
        contextHref: `/office/agents/${input.membershipId}#onboarding`,
        details: [`Category: ${item.category}`]
      }
    });

    await createNotificationsForMemberships(tx, {
      organizationId: input.organizationId,
      officeId: membership.officeId,
      membershipIds: [input.membershipId],
      restrictToOfficeRoles: true,
      type: NotificationType.onboarding_assigned,
      category: NotificationCategory.onboarding,
      severity: NotificationSeverity.info,
      entityType: NotificationEntityType.agent_onboarding_item,
      entityId: item.id,
      title: "Onboarding item assigned",
      body: item.dueAt
        ? `${item.title} is due on ${formatDateLabel(item.dueAt)}.`
        : `${item.title} was added to your onboarding checklist.`,
      actionUrl: `/office/agents/${input.membershipId}#onboarding`
    });

    return item;
  });
}

export async function updateAgentOnboardingItem(input: UpdateAgentOnboardingItemInput) {
  return prisma.$transaction(async (tx) => {
    const [membership, item] = await Promise.all([
      ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId),
      tx.agentOnboardingItem.findFirst({
        where: {
          id: input.itemId,
          organizationId: input.organizationId,
          membershipId: input.membershipId
        }
      })
    ]);

    if (!item) {
      throw new Error("Onboarding item was not found.");
    }

    const nextStatus = normalizeOnboardingItemStatus(input.status) ?? item.status;
    const willComplete = nextStatus === "completed";
    const willReopen = nextStatus === "reopened" || nextStatus === "pending" || nextStatus === "in_progress";
    const updatedItem = await tx.agentOnboardingItem.update({
      where: {
        id: item.id
      },
      data: {
        title: input.title?.trim() || item.title,
        description: input.description !== undefined ? parseOptionalText(input.description) : item.description,
        category: input.category?.trim() || item.category,
        dueAt: input.dueAt !== undefined ? parseOptionalDate(input.dueAt) : item.dueAt,
        status: nextStatus,
        completedAt: willComplete ? new Date() : willReopen ? null : item.completedAt,
        completedByMembershipId: willComplete ? input.actorMembershipId : willReopen ? null : item.completedByMembershipId
      }
    });

    await syncAgentProfileOnboardingStatus(tx, input.organizationId, input.membershipId, input.officeId);

    const changes = [
      buildChange("Status", onboardingItemStatusLabelMap[item.status], onboardingItemStatusLabelMap[updatedItem.status]),
      buildChange("Title", item.title, updatedItem.title),
      buildChange("Category", item.category, updatedItem.category)
    ].filter((change): change is ActivityLogChange => Boolean(change));

    let action: ActivityLogAction = activityLogActions.agentOnboardingItemUpdated;
    if (item.status !== "completed" && updatedItem.status === "completed") {
      action = activityLogActions.agentOnboardingItemCompleted;
    } else if (item.status === "completed" && updatedItem.status !== "completed") {
      action = activityLogActions.agentOnboardingItemReopened;
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_onboarding_item",
      entityId: updatedItem.id,
      action,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${getMembershipLabel(membership)} · ${updatedItem.title}`,
        contextHref: `/office/agents/${input.membershipId}#onboarding`,
        details: updatedItem.completedAt ? [`Completed: ${formatDateLabel(updatedItem.completedAt)}`] : [],
        changes
      }
    });

    return updatedItem;
  });
}

export async function createAgentGoal(input: CreateAgentGoalInput) {
  return prisma.$transaction(async (tx) => {
    const membership = await ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId);
    const goal = await tx.agentGoal.create({
      data: {
        organizationId: input.organizationId,
        officeId: membership.officeId,
        membershipId: input.membershipId,
        periodType: normalizeGoalPeriod(input.periodType),
        startsAt: parseOptionalDate(input.startsAt) ?? new Date(),
        endsAt: parseOptionalDate(input.endsAt) ?? new Date(),
        targetTransactionCount: input.targetTransactionCount?.trim() ? Number.parseInt(input.targetTransactionCount, 10) : null,
        targetClosedVolume: parseOptionalDecimal(input.targetClosedVolume),
        targetOfficeNet: parseOptionalDecimal(input.targetOfficeNet),
        targetAgentNet: parseOptionalDecimal(input.targetAgentNet),
        notes: parseOptionalText(input.notes)
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_goal",
      entityId: goal.id,
      action: activityLogActions.agentGoalCreated,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${getMembershipLabel(membership)} · ${goalPeriodLabelMap[goal.periodType]} goal`,
        contextHref: `/office/agents/${input.membershipId}#goals`,
        details: [`Window: ${formatDateLabel(goal.startsAt)} - ${formatDateLabel(goal.endsAt)}`]
      }
    });

    return goal;
  });
}

export async function updateAgentGoal(input: UpdateAgentGoalInput) {
  return prisma.$transaction(async (tx) => {
    const [membership, goal] = await Promise.all([
      ensureMembershipExists(tx, input.organizationId, input.membershipId, input.officeId),
      tx.agentGoal.findFirst({
        where: {
          id: input.goalId,
          organizationId: input.organizationId,
          membershipId: input.membershipId
        }
      })
    ]);

    if (!goal) {
      throw new Error("Goal was not found.");
    }

    const nextPeriod = normalizeGoalPeriod(input.periodType);
    const nextStartsAt = parseOptionalDate(input.startsAt) ?? goal.startsAt;
    const nextEndsAt = parseOptionalDate(input.endsAt) ?? goal.endsAt;
    const nextTransactionTarget = input.targetTransactionCount?.trim()
      ? Number.parseInt(input.targetTransactionCount, 10)
      : null;

    const updatedGoal = await tx.agentGoal.update({
      where: {
        id: goal.id
      },
      data: {
        periodType: nextPeriod,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        targetTransactionCount: nextTransactionTarget,
        targetClosedVolume: parseOptionalDecimal(input.targetClosedVolume),
        targetOfficeNet: parseOptionalDecimal(input.targetOfficeNet),
        targetAgentNet: parseOptionalDecimal(input.targetAgentNet),
        notes: parseOptionalText(input.notes)
      }
    });

    const changes = [
      buildChange("Period", goalPeriodLabelMap[goal.periodType], goalPeriodLabelMap[updatedGoal.periodType]),
      buildChange(
        "Transaction target",
        goal.targetTransactionCount ? String(goal.targetTransactionCount) : "—",
        updatedGoal.targetTransactionCount ? String(updatedGoal.targetTransactionCount) : "—"
      ),
      buildChange(
        "Closed volume target",
        goal.targetClosedVolume ? formatCurrency(goal.targetClosedVolume) : "—",
        updatedGoal.targetClosedVolume ? formatCurrency(updatedGoal.targetClosedVolume) : "—"
      )
    ].filter((change): change is ActivityLogChange => Boolean(change));

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_goal",
      entityId: updatedGoal.id,
      action: activityLogActions.agentGoalUpdated,
      payload: {
        officeId: membership.officeId,
        objectLabel: `${getMembershipLabel(membership)} · ${goalPeriodLabelMap[updatedGoal.periodType]} goal`,
        contextHref: `/office/agents/${input.membershipId}#goals`,
        details: [`Window: ${formatDateLabel(updatedGoal.startsAt)} - ${formatDateLabel(updatedGoal.endsAt)}`],
        changes
      }
    });

    return updatedGoal;
  });
}
