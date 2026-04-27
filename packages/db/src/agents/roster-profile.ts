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
import {
  buildAgentOfficeProfileSeed,
  findAgentOfficeProfileForOffice,
  resolveAgentOfficeProfileFields
} from "../agent-office-profiles";

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

import { AddAgentToTeamInput, ApplyAgentOnboardingTemplateInput, ComparableAgentBankInformationRecord, CreateAgentGoalInput, CreateAgentOnboardingItemInput, CreateAgentTeamInput, DeleteAgentTeamInput, GetOfficeAgentProfileInput, GetOfficeAgentsRosterInput, OfficeAgentBankInformationRecord, OfficeAgentGoalRecord, OfficeAgentOnboardingItemRecord, OfficeAgentOnboardingTemplateRecord, OfficeAgentOperationalAgendaItem, OfficeAgentProfileActivityItem, OfficeAgentProfileAvailableTeam, OfficeAgentProfileAvailableTeamManager, OfficeAgentProfileSnapshot, OfficeAgentProfileTeam, OfficeAgentRosterFilters, OfficeAgentRosterRow, OfficeAgentTeamSummary, OfficeAgentsRosterSnapshot, RemoveAgentFromTeamInput, SaveAgentProfileInput, UpdateAgentGoalInput, UpdateAgentOnboardingItemInput, UpdateAgentTeamInput, agentBankInformationAccountTypeLabelMap, agentBankInformationTaxIdTypeLabelMap, buildAgentBankInformationSignature, buildUniqueTeamSlug, canManageAgentBankInformation, defaultOnboardingItems, formatCurrency, formatDateLabel, formatDateTimeLabel, formatDateValue, getPurchasedPriceValue, goalPeriodLabelMap, hasAnyAgentBankInformationValue, membershipStatusLabelMap, normalizeComparableAgentBankInformationRecord, onboardingItemStatusLabelMap, onboardingStatusLabelMap, parseOptionalAgentBankInformationAccountType, parseOptionalAgentBankInformationTaxIdType, parseOptionalDate, parseOptionalDecimal, parseOptionalText, roleLabelMap, slugify, teamRoleLabelMap } from "./types";

const defaultOfficeAgentsRosterPage = 1;
const defaultOfficeAgentsRosterPageSize = 50;
const maxOfficeAgentsRosterPageSize = 100;
import { ManagedMembershipRecord, applyOnboardingTemplateItems, assertTeamHierarchyAssignableMembership, buildChange, buildGoalProgressSummary, buildLeaderOwnedTeamName, buildOnboardingProgressLabel, buildTransactionSummaryLabel, ensureAgentProfileFoundation, ensureMembershipExists, formatDueDaysOffsetLabel, getActivityActionLabel, getBillingSummaryByMembership, getCurrentOrLatestGoal, getDefaultOnboardingTemplateSeedData, getGoalProgressSourceDate, getMembershipLabel, getPayloadObjectLabel, listActiveOnboardingTemplateItems, materializeImplicitJuniorTeamsForManagementAction, materializeImplicitJuniorTeamsForOrganization, normalizeGoalPeriod, normalizeMembershipStatusFilter, normalizeOnboardingItemStatus, normalizeOnboardingStatus, normalizeOptionalTeamId, normalizeOptionalTeamMembershipId, normalizeTeamRole, redactAgentCommissionSummary, redactAgentGoalFinancials, resolveOnboardingDueDate, syncAgentProfileOnboardingStatus, syncLeaderAccountRoleForTeamAssignment, syncManagedMembershipTitle, syncManagedMembershipTitlesForTeam, syncManagedMembershipTitlesForTeamBranch, validateTeamMembershipHierarchy, validateTeamParentAssignment } from "./helpers";
import { addAgentToTeam, applyAgentOnboardingTemplate, assignMembershipToTeamTx, createAgentTeam, deleteAgentTeam, removeAgentFromTeam, updateAgentTeam } from "./team-management";
import { createAgentGoal, createAgentOnboardingItem, updateAgentGoal, updateAgentOnboardingItem } from "./progress";

function getMembershipOfficeProfileFields(
  membership: {
    officeId?: string | null;
    agentProfile?: {
      notes?: string | null;
      licenseNumber?: string | null;
      licenseState?: string | null;
      startDate?: Date | null;
      onboardingStatus?: AgentOnboardingStatus | null;
      internalExtension?: string | null;
    } | null;
    agentOfficeProfiles?: Array<{
      id?: string;
      officeId: string;
      notes?: string | null;
      licenseNumber?: string | null;
      licenseState?: string | null;
      expirationDate?: Date | null;
      onboardingStatus?: AgentOnboardingStatus | null;
      internalExtension?: string | null;
    }>;
  },
  officeId?: string | null,
) {
  return resolveAgentOfficeProfileFields(
    membership.agentProfile,
    findAgentOfficeProfileForOffice(membership, officeId),
  );
}

export async function getOfficeAgentsRosterSnapshot(input: GetOfficeAgentsRosterInput): Promise<OfficeAgentsRosterSnapshot> {
  const membershipStatusFilter = normalizeMembershipStatusFilter(input.membershipStatus);
  const scopedOfficeId = input.officeFilterId || input.officeId || undefined;
  const agentScope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: scopedOfficeId ?? null,
    resource: "agents"
  });
  const scope =
    input.scopeMode === "teams"
      ? {
          ...agentScope,
          kind: "organization" as const,
          visibleMembershipIds: null,
          visibleTeamIds: null,
          visibleTeamMembershipIds: null
        }
      : agentScope;
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
  const [allOffices, rawMemberships] = await Promise.all([
    prisma.office.findMany({
      where: {
        organizationId: input.organizationId
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        market: true,
        isPrimary: true
      }
    }),
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildMembershipVisibilityWhere(scope),
        ...(membershipStatusFilter ?? {}),
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
        agentOfficeProfiles: true,
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
    })
  ]);

  const memberships = rawMemberships.filter((membership) =>
    membershipHasAccessToOffice({
      role: membership.role,
      allOffices,
      defaultOfficeId: membership.officeId,
      officeAccesses: membership.officeAccesses,
      officeId: scopedOfficeId ?? null
    })
  );
  const officeProfileFieldsByMembershipId = new Map(
    memberships.map((membership) => [
      membership.id,
      getMembershipOfficeProfileFields(membership, scopedOfficeId ?? membership.officeId ?? null),
    ]),
  );

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
        _count: {
          select: {
            commissionPlanAssignments: true
          }
        },
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
        purchasedPrice: true,
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
    const officeProfileFields = officeProfileFieldsByMembershipId.get(membership.id);
    const current = onboardingProgressMap.get(membership.id) ?? {
      totalCount: 0,
      completedCount: 0,
      status: officeProfileFields?.onboardingStatus ?? "not_started"
    };
    current.status = normalizeOnboardingStatus(
      officeProfileFields?.onboardingStatus ?? "not_started",
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

      const closedVolume = closedTransactions.reduce((sum, transaction) => sum.plus(getPurchasedPriceValue(transaction)), new Prisma.Decimal(0));
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
      const officeProfileFields = officeProfileFieldsByMembershipId.get(membership.id);
      const status = onboardingProgress?.status ?? officeProfileFields?.onboardingStatus ?? "not_started";
      return status === (input.onboardingStatus as AgentOnboardingStatus);
    });
  }

  const totalCount = filteredMemberships.length;
  const requestedPage = Number.isFinite(input.page) ? Number(input.page) : defaultOfficeAgentsRosterPage;
  const requestedPageSize = Number.isFinite(input.pageSize)
    ? Number(input.pageSize)
    : defaultOfficeAgentsRosterPageSize;
  const pageSize = Math.min(
    Math.max(Math.trunc(requestedPageSize) || defaultOfficeAgentsRosterPageSize, 1),
    maxOfficeAgentsRosterPageSize
  );
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(
    Math.max(Math.trunc(requestedPage) || defaultOfficeAgentsRosterPage, 1),
    totalPages
  );
  const buildRosterRow = (membership: (typeof filteredMemberships)[number]) => {
    const balance = billingSummary.get(membership.id);
    const canViewFinancials = canViewFinancialsForMembership(scope, membership.id);
    const onboardingProgress = onboardingProgressMap.get(membership.id) ?? {
      totalCount: 0,
      completedCount: 0,
      status:
        officeProfileFieldsByMembershipId.get(membership.id)?.onboardingStatus ??
        "not_started"
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
      roleValue: membership.role,
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
  };
  const allRows = filteredMemberships.map(buildRosterRow);
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize);

  const activeTeamCount = teams.filter((team) => team.isActive && team.memberships.length > 0).length;
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
      totalMembers: totalCount,
      agentCount: filteredMemberships.filter((membership) => membership.role === "agent" || membership.role === "team_lead").length,
      onboardingInProgressCount: filteredMemberships.filter((membership) => {
        const onboardingProgress = onboardingProgressMap.get(membership.id);
        const officeProfileFields = officeProfileFieldsByMembershipId.get(membership.id);
        const status = onboardingProgress?.status ?? officeProfileFields?.onboardingStatus ?? "not_started";
        return status === "in_progress";
      }).length,
      activeTeamCount,
      inactiveMemberCount: filteredMemberships.filter((membership) => membership.status !== "active").length
    },
    totalCount,
    page,
    pageSize,
    totalPages,
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
    allRows,
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
      commissionPlanAssignmentCount: team._count.commissionPlanAssignments,
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
    officeId: input.officeId ?? null,
    resource: "agents"
  });

  if (!canAccessMembership(scope, input.membershipId)) {
    return null;
  }

  let membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      ...buildMembershipVisibilityWhere(scope)
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
      agentOfficeProfiles: true,
      agentBankInformation: true,
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

  const allOffices = await prisma.office.findMany({
    where: {
      organizationId: input.organizationId
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
      officeId: input.officeId ?? null
    })
  ) {
    return null;
  }

  await ensureAgentProfileFoundation(input.organizationId, input.membershipId, membership.officeId);

  membership =
    (await prisma.membership.findUnique({
      where: {
        id: membership.id
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
        agentOfficeProfiles: true,
        agentBankInformation: true,
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
  const canManageBankInformationForProfile = canManageAgentBankInformation(scope, input.membershipId);
  const canViewBankInformationForProfile = canManageBankInformationForProfile;
  const canParticipateInTeamHierarchy = isTeamHierarchyAssignableUserRole(membership.role);
  const officeProfileFields = getMembershipOfficeProfileFields(
    membership,
    input.officeId ?? membership.officeId ?? null,
  );

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
          purchasedPrice: true,
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
          purchasedPrice: true,
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

      const closedVolume = closedTransactions.reduce((sum, transaction) => sum.plus(getPurchasedPriceValue(transaction)), new Prisma.Decimal(0));
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
  const profileStatus = normalizeOnboardingStatus(
    officeProfileFields.onboardingStatus,
    onboardingItems,
  );
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
  const normalizedBankInformation = normalizeComparableAgentBankInformationRecord(membership.agentBankInformation);

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
      roleValue: membership.role,
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
      notes: officeProfileFields.notes,
      licenseNumber: officeProfileFields.licenseNumber,
      licenseState: officeProfileFields.licenseState,
      startDate: formatDateValue(officeProfileFields.expirationDate),
      onboardingStatus: onboardingStatusLabelMap[profileStatus],
      onboardingStatusValue: profileStatus,
      commissionPlanName: membership.agentProfile?.commissionPlanName ?? "",
      avatarUrl: membership.agentProfile?.avatarUrl ?? "",
      internalExtension: officeProfileFields.internalExtension,
      quickBooksVendorId: membership.agentProfile?.quickBooksVendorId ?? ""
    },
    bankInformation: {
      canView: canViewBankInformationForProfile,
      canManage: canManageBankInformationForProfile,
      payeeName: canViewBankInformationForProfile ? normalizedBankInformation.payeeName : "",
      firstName: canViewBankInformationForProfile ? normalizedBankInformation.firstName : "",
      lastName: canViewBankInformationForProfile ? normalizedBankInformation.lastName : "",
      email: canViewBankInformationForProfile ? normalizedBankInformation.email : "",
      address: canViewBankInformationForProfile ? normalizedBankInformation.address : "",
      bankName: canViewBankInformationForProfile ? normalizedBankInformation.bankName : "",
      accountNumber: canViewBankInformationForProfile ? normalizedBankInformation.accountNumber : "",
      routingNumber: canViewBankInformationForProfile ? normalizedBankInformation.routingNumber : "",
      phoneNumber: canViewBankInformationForProfile ? normalizedBankInformation.phoneNumber : "",
      taxIdType: canViewBankInformationForProfile ? normalizedBankInformation.taxIdType : "",
      taxIdTypeLabel:
        canViewBankInformationForProfile && membership.agentBankInformation?.taxIdType
          ? agentBankInformationTaxIdTypeLabelMap[membership.agentBankInformation.taxIdType]
          : "",
      taxIdValue: canViewBankInformationForProfile ? normalizedBankInformation.taxIdValue : "",
      dateOfBirth: canViewBankInformationForProfile ? normalizedBankInformation.dateOfBirth : "",
      accountType: canViewBankInformationForProfile ? normalizedBankInformation.accountType : "",
      accountTypeLabel:
        canViewBankInformationForProfile && membership.agentBankInformation?.accountType
          ? agentBankInformationAccountTypeLabelMap[membership.agentBankInformation.accountType]
          : ""
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
    availableTeams: canParticipateInTeamHierarchy
      ? availableTeams.map((team) => {
          const managerOptions = availableTeamManagerOptionsMap.get(team.id) ?? [];
          const teamPathLabel = availableTeamPathLabelMap.get(team.id) ?? team.name;

          return {
            id: team.id,
            label: formatAssignableTeamLabel(teamPathLabel, managerOptions.map((manager) => manager.label)),
            managerOptions,
            defaultReportsToTeamMembershipId: managerOptions.length === 1 ? managerOptions[0]?.teamMembershipId ?? null : null
          };
        })
      : [],
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
      priceLabel: formatCurrency(getPurchasedPriceValue(transaction)),
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
    const targetOfficeId = input.officeId ?? membership.officeId ?? null;
    const previousProfile = await tx.agentProfile.findUnique({
      where: {
        membershipId: input.membershipId
      }
    });
    const previousOfficeProfile = targetOfficeId
      ? await tx.agentOfficeProfile.findUnique({
          where: {
            membershipId_officeId: {
              membershipId: input.membershipId,
              officeId: targetOfficeId
            }
          }
        })
      : null;
    const previousBankInformation = await tx.agentBankInformation.findUnique({
      where: {
        membershipId: input.membershipId
      }
    });

    const previousDisplayName = previousProfile?.displayName?.trim() || `${membership.user.firstName} ${membership.user.lastName}`;
    const previousOfficeFields = resolveAgentOfficeProfileFields(previousProfile, previousOfficeProfile);
    const previousLicense = previousOfficeFields.licenseNumber.trim() || "—";
    const previousPlan = previousProfile?.commissionPlanName?.trim() || "—";
    const profileUpsertData = {
      organizationId: input.organizationId,
      officeId: membership.officeId,
      ...(input.displayName !== undefined ? { displayName: parseOptionalText(input.displayName) } : {}),
      ...(input.bio !== undefined ? { bio: parseOptionalText(input.bio) } : {}),
      ...(input.commissionPlanName !== undefined
        ? { commissionPlanName: parseOptionalText(input.commissionPlanName) }
        : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: parseOptionalText(input.avatarUrl) } : {}),
      ...(input.quickBooksVendorId !== undefined
        ? { quickBooksVendorId: parseOptionalText(input.quickBooksVendorId) }
        : {}),
      ...(previousProfile?.notes !== undefined ? { notes: previousProfile.notes } : {}),
      ...(previousProfile?.licenseNumber !== undefined ? { licenseNumber: previousProfile.licenseNumber } : {}),
      ...(previousProfile?.licenseState !== undefined ? { licenseState: previousProfile.licenseState } : {}),
      ...(previousProfile?.startDate !== undefined ? { startDate: previousProfile.startDate } : {}),
      ...(previousProfile?.internalExtension !== undefined
        ? { internalExtension: previousProfile.internalExtension }
        : {})
    };

    const savedProfile = await tx.agentProfile.upsert({
      where: {
        membershipId: input.membershipId
      },
      update: profileUpsertData,
      create: {
        membershipId: input.membershipId,
        ...profileUpsertData
      }
    });
    const shouldSaveOfficeProfile =
      Boolean(targetOfficeId) &&
      (previousOfficeProfile !== null ||
        input.notes !== undefined ||
        input.licenseNumber !== undefined ||
        input.licenseState !== undefined ||
        input.startDate !== undefined ||
        input.internalExtension !== undefined);
    const officeProfileUpsertData = targetOfficeId
      ? {
          organizationId: input.organizationId,
          officeId: targetOfficeId,
          ...(input.notes !== undefined ? { notes: parseOptionalText(input.notes) } : {}),
          ...(input.licenseNumber !== undefined
            ? { licenseNumber: parseOptionalText(input.licenseNumber) }
            : {}),
          ...(input.licenseState !== undefined
            ? { licenseState: parseOptionalText(input.licenseState) }
            : {}),
          ...(input.startDate !== undefined
            ? { expirationDate: parseOptionalDate(input.startDate) }
            : {}),
          ...(input.internalExtension !== undefined
            ? { internalExtension: parseOptionalText(input.internalExtension) }
            : {}),
        }
      : null;
    const savedOfficeProfile =
      shouldSaveOfficeProfile && targetOfficeId && officeProfileUpsertData
        ? await tx.agentOfficeProfile.upsert({
            where: {
              membershipId_officeId: {
                membershipId: input.membershipId,
                officeId: targetOfficeId
              }
            },
            update: officeProfileUpsertData,
            create: {
              membershipId: input.membershipId,
              ...buildAgentOfficeProfileSeed(previousProfile),
              ...officeProfileUpsertData
            }
          })
        : previousOfficeProfile;

    const shouldSaveBankInformation =
      input.bankPayeeName !== undefined ||
      input.bankFirstName !== undefined ||
      input.bankLastName !== undefined ||
      input.bankEmail !== undefined ||
      input.bankAddress !== undefined ||
      input.bankName !== undefined ||
      input.bankAccountNumber !== undefined ||
      input.bankRoutingNumber !== undefined ||
      input.bankPhoneNumber !== undefined ||
      input.bankTaxIdType !== undefined ||
      input.bankTaxIdValue !== undefined ||
      input.bankDateOfBirth !== undefined ||
      input.bankAccountType !== undefined;

    if (shouldSaveBankInformation) {
      const nextComparableBankInformation = normalizeComparableAgentBankInformationRecord({
        payeeName: parseOptionalText(input.bankPayeeName),
        firstName: parseOptionalText(input.bankFirstName),
        lastName: parseOptionalText(input.bankLastName),
        email: parseOptionalText(input.bankEmail),
        address: parseOptionalText(input.bankAddress),
        bankName: parseOptionalText(input.bankName),
        accountNumber: parseOptionalText(input.bankAccountNumber),
        routingNumber: parseOptionalText(input.bankRoutingNumber),
        phoneNumber: parseOptionalText(input.bankPhoneNumber),
        taxIdType: parseOptionalAgentBankInformationTaxIdType(input.bankTaxIdType),
        taxIdValue: parseOptionalText(input.bankTaxIdValue),
        dateOfBirth: parseOptionalDate(input.bankDateOfBirth),
        accountType: parseOptionalAgentBankInformationAccountType(input.bankAccountType)
      });

      if (hasAnyAgentBankInformationValue(nextComparableBankInformation)) {
        await tx.agentBankInformation.upsert({
          where: {
            membershipId: input.membershipId
          },
          update: {
            organizationId: input.organizationId,
            officeId: membership.officeId,
            payeeName: nextComparableBankInformation.payeeName || null,
            firstName: nextComparableBankInformation.firstName || null,
            lastName: nextComparableBankInformation.lastName || null,
            email: nextComparableBankInformation.email || null,
            address: nextComparableBankInformation.address || null,
            bankName: nextComparableBankInformation.bankName || null,
            accountNumber: nextComparableBankInformation.accountNumber || null,
            routingNumber: nextComparableBankInformation.routingNumber || null,
            phoneNumber: nextComparableBankInformation.phoneNumber || null,
            taxIdType: parseOptionalAgentBankInformationTaxIdType(nextComparableBankInformation.taxIdType),
            taxIdValue: nextComparableBankInformation.taxIdValue || null,
            dateOfBirth: parseOptionalDate(nextComparableBankInformation.dateOfBirth),
            accountType: parseOptionalAgentBankInformationAccountType(nextComparableBankInformation.accountType)
          },
          create: {
            organizationId: input.organizationId,
            officeId: membership.officeId,
            membershipId: input.membershipId,
            payeeName: nextComparableBankInformation.payeeName || null,
            firstName: nextComparableBankInformation.firstName || null,
            lastName: nextComparableBankInformation.lastName || null,
            email: nextComparableBankInformation.email || null,
            address: nextComparableBankInformation.address || null,
            bankName: nextComparableBankInformation.bankName || null,
            accountNumber: nextComparableBankInformation.accountNumber || null,
            routingNumber: nextComparableBankInformation.routingNumber || null,
            phoneNumber: nextComparableBankInformation.phoneNumber || null,
            taxIdType: parseOptionalAgentBankInformationTaxIdType(nextComparableBankInformation.taxIdType),
            taxIdValue: nextComparableBankInformation.taxIdValue || null,
            dateOfBirth: parseOptionalDate(nextComparableBankInformation.dateOfBirth),
            accountType: parseOptionalAgentBankInformationAccountType(nextComparableBankInformation.accountType)
          }
        });
      } else if (previousBankInformation) {
        await tx.agentBankInformation.delete({
          where: {
            membershipId: input.membershipId
          }
        });
      }
    }

    const shouldSaveDefaultCommission =
      input.splitTemplateId !== undefined ||
      input.customAgentPercent !== undefined ||
      input.commissionEffectiveFrom !== undefined ||
      input.commissionEffectiveTo !== undefined;

    if (shouldSaveDefaultCommission) {
      await saveMembershipCommissionSetting(
        {
          organizationId: input.organizationId,
          officeId: targetOfficeId,
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

    await syncAgentProfileOnboardingStatus(tx, input.organizationId, input.membershipId, targetOfficeId);

    const finalProfile = await tx.agentProfile.findUnique({
      where: {
        membershipId: input.membershipId
      }
    });
    const finalOfficeProfile = targetOfficeId
      ? await tx.agentOfficeProfile.findUnique({
          where: {
            membershipId_officeId: {
              membershipId: input.membershipId,
              officeId: targetOfficeId
            }
          }
        })
      : null;
    const finalBankInformation = await tx.agentBankInformation.findUnique({
      where: {
        membershipId: input.membershipId
      }
    });
    const nextDisplayName = savedProfile.displayName?.trim() || `${membership.user.firstName} ${membership.user.lastName}`;
    const finalOfficeFields = resolveAgentOfficeProfileFields(finalProfile, finalOfficeProfile);
    const nextLicense = finalOfficeFields.licenseNumber.trim() || "—";
    const nextPlan = finalProfile?.commissionPlanName?.trim() || "—";
    const previousBankInformationSignature = buildAgentBankInformationSignature(previousBankInformation);
    const nextBankInformationSignature = buildAgentBankInformationSignature(finalBankInformation);
    const previousBankInformationConfigured = hasAnyAgentBankInformationValue(
      normalizeComparableAgentBankInformationRecord(previousBankInformation)
    );
    const nextBankInformationConfigured = hasAnyAgentBankInformationValue(
      normalizeComparableAgentBankInformationRecord(finalBankInformation)
    );
    const changes = [
      buildChange("Display name", previousDisplayName, nextDisplayName),
      buildChange("License number", previousLicense, nextLicense),
      buildChange("Default split", previousPlan, nextPlan)
    ].filter((change): change is ActivityLogChange => Boolean(change));
    const details = [`Role: ${roleLabelMap[membership.role]}`];

    if (previousBankInformationSignature !== nextBankInformationSignature) {
      details.push(
        nextBankInformationConfigured
          ? previousBankInformationConfigured
            ? "Bank information updated"
            : "Bank information added"
          : "Bank information cleared"
      );
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_profile",
      entityId: savedOfficeProfile?.id ?? savedProfile.id,
      action:
        previousProfile || previousOfficeProfile
          ? activityLogActions.agentProfileUpdated
          : activityLogActions.agentProfileCreated,
      payload: {
        officeId: targetOfficeId ?? membership.officeId,
        objectLabel: nextDisplayName,
        contextHref: `/office/agents/${input.membershipId}`,
        details,
        changes
      }
    });

    return finalProfile ?? savedProfile;
  });
}
