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

import { AddAgentToTeamInput, ApplyAgentOnboardingTemplateInput, ComparableAgentBankInformationRecord, CreateAgentGoalInput, CreateAgentOnboardingItemInput, CreateAgentTeamInput, DeleteAgentTeamInput, GetOfficeAgentProfileInput, GetOfficeAgentsRosterInput, OfficeAgentBankInformationRecord, OfficeAgentGoalRecord, OfficeAgentOnboardingItemRecord, OfficeAgentOnboardingTemplateRecord, OfficeAgentOperationalAgendaItem, OfficeAgentProfileActivityItem, OfficeAgentProfileAvailableTeam, OfficeAgentProfileAvailableTeamManager, OfficeAgentProfileSnapshot, OfficeAgentProfileTeam, OfficeAgentRosterFilters, OfficeAgentRosterRow, OfficeAgentTeamSummary, OfficeAgentsRosterSnapshot, RemoveAgentFromTeamInput, SaveAgentProfileInput, UpdateAgentGoalInput, UpdateAgentOnboardingItemInput, UpdateAgentTeamInput, agentBankInformationAccountTypeLabelMap, agentBankInformationTaxIdTypeLabelMap, buildAgentBankInformationSignature, buildUniqueTeamSlug, canManageAgentBankInformation, defaultOnboardingItems, formatCurrency, formatDateLabel, formatDateTimeLabel, formatDateValue, getPurchasedPriceValue, goalPeriodLabelMap, hasAnyAgentBankInformationValue, membershipStatusLabelMap, normalizeComparableAgentBankInformationRecord, onboardingItemStatusLabelMap, onboardingStatusLabelMap, parseOptionalAgentBankInformationAccountType, parseOptionalAgentBankInformationTaxIdType, parseOptionalDate, parseOptionalDecimal, parseOptionalText, roleLabelMap, slugify, teamRoleLabelMap } from "./types";
import { ManagedMembershipRecord, applyOnboardingTemplateItems, assertTeamHierarchyAssignableMembership, buildChange, buildGoalProgressSummary, buildLeaderOwnedTeamName, buildOnboardingProgressLabel, buildTransactionSummaryLabel, ensureAgentProfileFoundation, ensureMembershipExists, formatDueDaysOffsetLabel, getActivityActionLabel, getBillingSummaryByMembership, getCurrentOrLatestGoal, getDefaultOnboardingTemplateSeedData, getGoalProgressSourceDate, getMembershipLabel, getPayloadObjectLabel, listActiveOnboardingTemplateItems, materializeImplicitJuniorTeamsForManagementAction, materializeImplicitJuniorTeamsForOrganization, normalizeGoalPeriod, normalizeMembershipStatusFilter, normalizeOnboardingItemStatus, normalizeOnboardingStatus, normalizeOptionalTeamId, normalizeOptionalTeamMembershipId, normalizeTeamRole, redactAgentCommissionSummary, redactAgentGoalFinancials, resolveOnboardingDueDate, syncAgentProfileOnboardingStatus, syncLeaderAccountRoleForTeamAssignment, syncManagedMembershipTitle, syncManagedMembershipTitlesForTeam, syncManagedMembershipTitlesForTeamBranch, validateTeamMembershipHierarchy, validateTeamParentAssignment } from "./helpers";
import { getOfficeAgentProfileSnapshot, getOfficeAgentsRosterSnapshot, saveAgentProfile } from "./roster-profile";
import { addAgentToTeam, applyAgentOnboardingTemplate, assignMembershipToTeamTx, createAgentTeam, deleteAgentTeam, removeAgentFromTeam, updateAgentTeam } from "./team-management";

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
