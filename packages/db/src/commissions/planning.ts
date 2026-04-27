import { randomUUID } from "node:crypto";

import {
  CommissionCalculationMode,
  CommissionCalculationStatus,
  CommissionPlanRuleType,
  CommissionRecipientType,
  CommissionRuleFeeType,
  MembershipStatus,
  UserRole,
  Prisma,
  TransactionFinanceApprovalStatus,
  TransactionFinanceCalculationType,
  TransactionFinanceFeeType,
  TransactionFinanceVersionSource,
  TeamMembershipRole
} from "@prisma/client";

import { resolveOfficeDataScope } from "../access";

import { activityLogActions, recordActivityLogEvent } from "../activity-log";

import { prisma } from "../client";

import {
  backfillCommissionSplitTemplatesFromLegacy,
  backfillMembershipCommissionSettingsFromLegacy,
  buildCommissionSplitLabel,
  listCommissionSplitTemplates,
  listCurrentMembershipCommissionSettings,
  resolveActiveMembershipCommissionSetting,
  type OfficeCommissionSplitTemplateRecord,
  type OfficeMembershipCommissionSettingRecord
} from "../commission-defaults";

import { buildTeamMembershipHierarchyMap, buildTeamPathLabel, createTeamHierarchyIndex, expandSelectedTeamIds, formatTeamMembershipRoleLabel } from "../team-hierarchy";

import { CalculateTransactionCommissionInput, CommissionPlanWithRules, GenerateCommissionStatementSnapshotInput, GetOfficeCommissionManagementSnapshotInput, OfficeAgentCommissionSummary, OfficeCommissionAssignmentRecord, OfficeCommissionAssignmentSourceType, OfficeCommissionAssignmentTargetType, OfficeCommissionCalculationRecipientLabel, OfficeCommissionCalculationRow, OfficeCommissionCalculationStatusLabel, OfficeCommissionManagementOverview, OfficeCommissionManagementSnapshot, OfficeCommissionPlanOption, OfficeCommissionPlanRecord, OfficeCommissionPlanRuleRecord, OfficeCommissionStatementLine, OfficeCommissionStatementSnapshot, OfficeCommissionTeamOption, OfficeCreateTransactionCommissionPreview, OfficeTransactionCommissionManualParticipantOption, OfficeTransactionCommissionSnapshot, OfficeTransactionCommissionStakeholderRow, OfficeTransactionFinanceApprovalLabel, OfficeTransactionFinanceCalculationLabel, OfficeTransactionFinanceFeeRecord, OfficeTransactionFinancePrerequisiteSnapshot, OfficeTransactionFinanceVersionRecord, OverrideTransactionCommissionInput, ResolvedCommissionPlanAssignment, SaveCommissionPlanAssignmentInput, SaveCommissionPlanInput, SaveCommissionPlanRuleInput, ScopedPrismaClient, TransactionFinanceFeeDefinition, UpdateCommissionCalculationStatusInput, activeFinanceFeeDefinitions, buildInitialTransactionFinanceFeeSeed, buildTransactionFinancePrerequisiteSnapshot, channelDevelopmentApprovalPrompt, commissionCalculationModeLabelMap, commissionCalculationStatusLabelMap, commissionRecipientLabelMap, commissionRuleFeeTypeLabelMap, commissionRuleTypeLabelMap, decimalToString, deriveRateFromAmount, endOfDay, ensureTransactionFinanceFees, filterActiveTransactionFinanceFees, financeFeeDefinitionByType, financeFeeDefinitions, formatCurrency, formatDateValue, formatFallbackRoleLabel, formatMembershipParticipantRole, formatPercentLabel, formatRecipientRoleLabel, getTransactionFinanceFeeDefinition, getTransactionFinanceFeeSortOrder, isActiveTransactionFinanceFeeType, mapTransactionFinanceFeeRecord, membershipStatusLabelMap, normalizeFinanceFeeApprovalStatus, normalizeTransactionFinanceFeeForPersistence, parseOptionalDate, parseOptionalDecimal, parseOptionalText, parseTransactionFinanceApprovalStatus, parseTransactionFinanceCalculationType, parseTransactionFinanceFeeType, selectableOperationalMembershipStatuses, sortTransactionFinanceFees, startOfDay, transactionFinanceApprovalStatusLabelMap, transactionFinanceCalculationTypeLabelMap, transactionFinanceVersionSourceLabelMap, userRoleLabelMap } from "./types";
import { assignCommissionPlanToMembership, calculateTransactionCommission, overrideTransactionCommission, updateCommissionCalculationStatus } from "./transactions";
import { buildCommissionStatementSnapshot, generateCommissionStatementSnapshot, getAgentCommissionSummary, getOfficeCommissionManagementSnapshot, getTransactionCommissionSnapshot, sumAgentStatementAmounts } from "./statements";
export {
  buildCommissionChanges,
  mapTransactionFinanceVersionRecord,
} from "./planning-helpers";
import {
  buildCommissionChanges,
  mapTransactionFinanceVersionRecord,
} from "./planning-helpers";

export function buildTransactionLabel(transaction: {
  title: string;
  address: string;
  city: string;
  state: string;
}) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}

export function getAssignmentTargetLabel(assignment: {
  membership?: { user: { firstName: string; lastName: string } } | null;
  team?: { name: string } | null;
}) {
  if (assignment.membership) {
    return `${assignment.membership.user.firstName} ${assignment.membership.user.lastName}`;
  }

  if (assignment.team) {
    return assignment.team.name;
  }

  return "Unassigned target";
}

export function compareAssignmentPriority(
  left: { officeId: string | null; effectiveFrom: Date; updatedAt: Date; createdAt: Date },
  right: { officeId: string | null; effectiveFrom: Date; updatedAt: Date; createdAt: Date },
  officeId?: string | null
) {
  const leftOfficeScore = left.officeId === officeId ? 2 : left.officeId ? 1 : 0;
  const rightOfficeScore = right.officeId === officeId ? 2 : right.officeId ? 1 : 0;

  if (leftOfficeScore !== rightOfficeScore) {
    return rightOfficeScore - leftOfficeScore;
  }

  if (left.effectiveFrom.getTime() !== right.effectiveFrom.getTime()) {
    return right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
  }

  if (left.updatedAt.getTime() !== right.updatedAt.getTime()) {
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

export function parseCommissionCalculationStatus(value: string | undefined | null): CommissionCalculationStatus | null {
  if (
    value === "draft" ||
    value === "calculated" ||
    value === "reviewed" ||
    value === "statement_ready" ||
    value === "payable" ||
    value === "paid"
  ) {
    return value;
  }

  return null;
}

export function parseCommissionCalculationMode(value: string | undefined | null): CommissionCalculationMode | null {
  if (value === "split_and_fees" || value === "flat_net") {
    return value;
  }

  return null;
}

export function parseCommissionPlanRuleType(value: string | undefined | null): CommissionPlanRuleType | null {
  if (
    value === "base_split" ||
    value === "brokerage_fee" ||
    value === "referral_fee" ||
    value === "flat_fee_deduction" ||
    value === "sliding_scale"
  ) {
    return value;
  }

  return null;
}

export function parseCommissionRuleFeeType(value: string | undefined | null): CommissionRuleFeeType | null {
  if (value === "percentage" || value === "flat") {
    return value;
  }

  return null;
}

export function parseCommissionRecipientType(value: string | undefined | null): CommissionRecipientType | null {
  if (value === "agent" || value === "brokerage" || value === "referral") {
    return value;
  }

  return null;
}

export function mapCommissionRule(rule: {
  id: string;
  ruleType: CommissionPlanRuleType;
  ruleName: string;
  sortOrder: number;
  splitPercent: Prisma.Decimal | null;
  flatAmount: Prisma.Decimal | null;
  feeType: CommissionRuleFeeType | null;
  feeAmount: Prisma.Decimal | null;
  thresholdStart: Prisma.Decimal | null;
  thresholdEnd: Prisma.Decimal | null;
  appliesToRole: string | null;
  recipientType: CommissionRecipientType | null;
  isActive: boolean;
}): OfficeCommissionPlanRuleRecord {
  return {
    id: rule.id,
    ruleType: commissionRuleTypeLabelMap[rule.ruleType],
    ruleTypeValue: rule.ruleType,
    ruleName: rule.ruleName,
    sortOrder: rule.sortOrder,
    splitPercent: decimalToString(rule.splitPercent),
    flatAmount: decimalToString(rule.flatAmount),
    feeType: rule.feeType ? commissionRuleFeeTypeLabelMap[rule.feeType] : "",
    feeTypeValue: rule.feeType,
    feeAmount: decimalToString(rule.feeAmount),
    thresholdStart: decimalToString(rule.thresholdStart),
    thresholdEnd: decimalToString(rule.thresholdEnd),
    appliesToRole: rule.appliesToRole ?? "",
    recipientType: rule.recipientType ? commissionRecipientLabelMap[rule.recipientType] : "",
    recipientTypeValue: rule.recipientType,
    isActive: rule.isActive
  };
}

export function mapCommissionCalculationRow(calculation: Prisma.CommissionCalculationGetPayload<{
  include: {
    transaction: true;
    membership: { include: { user: true } };
    commissionPlan: true;
    accountingTransaction: true;
  };
}>): OfficeCommissionCalculationRow {
  const recipientLabel =
    calculation.recipientName?.trim() ||
    (calculation.membership ? `${calculation.membership.user.firstName} ${calculation.membership.user.lastName}` : commissionRecipientLabelMap[calculation.recipientType]);
  const storedContext = parseStoredTransactionCommissionContext(calculation.transaction.commissionContext);
  const defaultSplitLabel =
    storedContext?.members[0]?.agentPercent
      ? buildCommissionSplitLabel(storedContext.members[0].agentPercent)
      : "Default split chain";
  const storedChainMember =
    calculation.membershipId && storedContext
      ? storedContext.members.find((member) => member.membershipId === calculation.membershipId) ?? null
      : null;
  const highestChainPercent =
    storedContext?.members.length
      ? new Prisma.Decimal(storedContext.members[storedContext.members.length - 1]?.agentPercent ?? 0)
      : null;
  const grossAfterReferral = Prisma.Decimal.max(new Prisma.Decimal(0), calculation.grossCommission.minus(calculation.referralFee));
  const effectiveSharePercent =
    grossAfterReferral.gt(0)
      ? calculation.statementAmount.mul(new Prisma.Decimal(100)).div(grossAfterReferral)
      : new Prisma.Decimal(0);
  const effectiveShareLabel = `${formatPercentLabel(effectiveSharePercent)}% actual share`;
  const companyResidualPercent =
    highestChainPercent
      ? Prisma.Decimal.max(new Prisma.Decimal(0), new Prisma.Decimal(100).minus(highestChainPercent))
      : null;

  return {
    id: calculation.id,
    transactionId: calculation.transactionId,
    transactionLabel: buildTransactionLabel(calculation.transaction),
    transactionHref: `/office/transactions/${calculation.transactionId}`,
    membershipId: calculation.membershipId ?? "",
    isCompanyRow: calculation.recipientType === "brokerage",
    recipientType: commissionRecipientLabelMap[calculation.recipientType],
    recipientTypeValue: calculation.recipientType,
    recipientLabel,
    recipientRole: formatRecipientRoleLabel(calculation.recipientRole),
    commissionPlanId: calculation.commissionPlanId ?? "",
    commissionPlanLabel:
      calculation.commissionPlan?.name ??
      (calculation.recipientType === "brokerage"
        ? companyResidualPercent
          ? `${formatPercentLabel(companyResidualPercent)}% company residual`
          : "Company residual"
        : storedChainMember
          ? buildCommissionSplitLabel(storedChainMember.agentPercent)
          : storedContext
            ? "Manual override participant"
            : "Manual / transaction finance"),
    commissionPlanDetailLabel: effectiveShareLabel,
    status: commissionCalculationStatusLabelMap[calculation.status],
    statusValue: calculation.status,
    grossCommissionLabel: formatCurrency(calculation.grossCommission),
    referralFeeLabel: formatCurrency(calculation.referralFee),
    feesLabel: formatCurrency(calculation.fees),
    officeNetLabel: formatCurrency(calculation.officeNet),
    agentNetLabel: formatCurrency(calculation.agentNet),
    statementAmountLabel: formatCurrency(calculation.statementAmount),
    calculatedAt: formatDateValue(calculation.calculatedAt),
    notes: calculation.notes ?? "",
    accountingHref: calculation.accountingTransactionId ? `/office/accounting?entryId=${calculation.accountingTransactionId}` : null
  };
}

export function mapCommissionAssignmentRecord(
  assignment: Prisma.CommissionPlanAssignmentGetPayload<{
    include: {
      membership: { include: { user: true } };
      team: true;
      commissionPlan: true;
    };
  }>
): OfficeCommissionAssignmentRecord {
  const targetType: OfficeCommissionAssignmentTargetType = assignment.membershipId ? "agent" : "team";

  return {
    id: assignment.id,
    membershipId: assignment.membershipId ?? "",
    teamId: assignment.teamId ?? "",
    targetType,
    targetLabel: getAssignmentTargetLabel({
      membership: assignment.membership,
      team: assignment.team
    }),
    commissionPlanId: assignment.commissionPlanId,
    commissionPlanLabel: assignment.commissionPlan.name,
    effectiveFrom: formatDateValue(assignment.effectiveFrom),
    effectiveTo: formatDateValue(assignment.effectiveTo)
  };
}

export async function listCommissionPlanOptions(organizationId: string, officeId?: string | null) {
  const plans = await prisma.commissionPlan.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {})
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true
    }
  });

  return plans.map((plan) => ({
    id: plan.id,
    label: plan.name
  }));
}

export async function resolveActiveCommissionPlanAssignment(
  tx: ScopedPrismaClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    membershipId: string;
    effectiveAt?: Date | null;
  }
) : Promise<ResolvedCommissionPlanAssignment | null> {
  const effectiveAt = input.effectiveAt ?? new Date();
  const activeAssignmentWindow: Prisma.CommissionPlanAssignmentWhereInput = {
    effectiveFrom: {
      lte: effectiveAt
    },
    AND: [
      {
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }]
      },
      ...(input.officeId
        ? [
            {
              OR: [{ officeId: input.officeId }, { officeId: null }]
            }
          ]
        : [])
    ]
  };

  const directAssignments = await tx.commissionPlanAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      ...activeAssignmentWindow
    },
    include: {
      membership: {
        include: {
          user: true
        }
      },
      team: true,
      commissionPlan: {
        include: {
          rules: {
            where: {
              isActive: true
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      }
    }
  });

  if (directAssignments.length > 0) {
    directAssignments.sort((left, right) => compareAssignmentPriority(left, right, input.officeId));

    return {
      ...directAssignments[0],
      sourceType: "membership",
      sourceLabel: "Assigned directly to agent"
    };
  }

  const teamMemberships = await tx.teamMembership.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {}),
      team: {
        isActive: true
      }
    },
    select: {
      teamId: true
    }
  });

  if (teamMemberships.length === 0) {
    return null;
  }

  const teamAssignments = await tx.commissionPlanAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      teamId: {
        in: teamMemberships.map((teamMembership) => teamMembership.teamId)
      },
      ...activeAssignmentWindow
    },
    include: {
      membership: {
        include: {
          user: true
        }
      },
      team: true,
      commissionPlan: {
        include: {
          rules: {
            where: {
              isActive: true
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      }
    }
  });

  if (teamAssignments.length === 0) {
    return null;
  }

  teamAssignments.sort((left, right) => compareAssignmentPriority(left, right, input.officeId));

  return {
    ...teamAssignments[0],
    sourceType: "team",
    sourceLabel: `Assigned via team ${teamAssignments[0].team?.name ?? ""}`.trim()
  };
}

export type StoredTransactionCommissionChainMember = {
  membershipId: string;
  membershipLabel: string;
  recipientRole: string;
  recipientRoleValue: string;
  agentPercent: string;
};

export type StoredTransactionCommissionContext = {
  version: 2;
  mode: "default_split_chain";
  sourceDate: string;
  lockedAt: string;
  ownerMembershipId: string;
  members: StoredTransactionCommissionChainMember[];
};

export type StoredTransactionFinanceFeeBreakdownRow = {
  feeType: TransactionFinanceFeeType;
  label: string;
  calculationType: TransactionFinanceCalculationType;
  rate: string;
  amount: string;
  approvalRequired: boolean;
  approvalStatus: TransactionFinanceApprovalStatus;
  notes: string;
};

export type StoredTransactionFinanceStakeholderBreakdownRow = {
  key: string;
  membershipId: string;
  recipientLabel: string;
  recipientRole: string;
  recipientRoleValue: string;
  recipientType: CommissionRecipientType;
  isManualParticipant: boolean;
  sharePercent: string;
  baseAmount: string;
  postSplitAdjustment: string;
  reimbursementAdjustment: string;
  finalAmount: string;
};

export type DerivedTransactionCommissionChainMember = {
  membershipId: string;
  membershipLabel: string;
  recipientRole: string;
  recipientRoleValue: string;
  agentPercent: Prisma.Decimal;
  sourceLabel: string;
  defaultSplitMissing: boolean;
};

export function parseStoredTransactionCommissionContext(value: Prisma.JsonValue | null | undefined): StoredTransactionCommissionContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, Prisma.JsonValue>;

  if (candidate.version !== 2 || candidate.mode !== "default_split_chain" || typeof candidate.ownerMembershipId !== "string" || !Array.isArray(candidate.members)) {
    return null;
  }

  const members = candidate.members
    .map((member) => {
      if (!member || typeof member !== "object" || Array.isArray(member)) {
        return null;
      }

      const row = member as Record<string, Prisma.JsonValue>;

      if (
        typeof row.membershipId !== "string" ||
        typeof row.membershipLabel !== "string" ||
        typeof row.recipientRole !== "string" ||
        typeof row.recipientRoleValue !== "string" ||
        typeof row.agentPercent !== "string"
      ) {
        return null;
      }

      return {
        membershipId: row.membershipId,
        membershipLabel: row.membershipLabel,
        recipientRole: row.recipientRole,
        recipientRoleValue: row.recipientRoleValue,
        agentPercent: row.agentPercent
      } satisfies StoredTransactionCommissionChainMember;
    })
    .filter((member): member is StoredTransactionCommissionChainMember => Boolean(member));

  if (members.length === 0) {
    return null;
  }

  return {
    version: 2,
    mode: "default_split_chain",
    sourceDate: typeof candidate.sourceDate === "string" ? candidate.sourceDate : new Date().toISOString(),
    lockedAt: typeof candidate.lockedAt === "string" ? candidate.lockedAt : new Date().toISOString(),
    ownerMembershipId: candidate.ownerMembershipId,
    members
  };
}

export function buildStoredTransactionCommissionContext(input: {
  ownerMembershipId: string;
  effectiveAt: Date;
  members: DerivedTransactionCommissionChainMember[];
}): StoredTransactionCommissionContext {
  return {
    version: 2,
    mode: "default_split_chain",
    sourceDate: input.effectiveAt.toISOString(),
    lockedAt: new Date().toISOString(),
    ownerMembershipId: input.ownerMembershipId,
    members: input.members.map((member) => ({
      membershipId: member.membershipId,
      membershipLabel: member.membershipLabel,
      recipientRole: member.recipientRole,
      recipientRoleValue: member.recipientRoleValue,
      agentPercent: String(member.agentPercent)
    }))
  };
}

export function storedTransactionCommissionContextMatchesChain(input: {
  storedContext: StoredTransactionCommissionContext | null;
  ownerMembershipId: string;
  members: DerivedTransactionCommissionChainMember[];
}) {
  if (!input.storedContext || input.storedContext.ownerMembershipId !== input.ownerMembershipId) {
    return false;
  }

  if (input.storedContext.members.length !== input.members.length) {
    return false;
  }

  return input.members.every((member, index) => {
    const storedMember = input.storedContext?.members[index];

    if (!storedMember) {
      return false;
    }

    return (
      storedMember.membershipId === member.membershipId &&
      storedMember.membershipLabel === member.membershipLabel &&
      storedMember.recipientRole === member.recipientRole &&
      storedMember.recipientRoleValue === member.recipientRoleValue &&
      new Prisma.Decimal(storedMember.agentPercent).eq(member.agentPercent)
    );
  });
}

export function parseStoredTransactionFinanceFeeBreakdown(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Record<string, Prisma.JsonValue>;

      if (
        typeof row.feeType !== "string" ||
        typeof row.label !== "string" ||
        typeof row.calculationType !== "string" ||
        typeof row.rate !== "string" ||
        typeof row.amount !== "string" ||
        typeof row.approvalRequired !== "boolean" ||
        typeof row.approvalStatus !== "string" ||
        typeof row.notes !== "string"
      ) {
        return null;
      }

      if (
        row.feeType !== "rebate" &&
        row.feeType !== "client_referral" &&
        row.feeType !== "external_referral" &&
        row.feeType !== "company_referral" &&
        row.feeType !== "channel_development_fee" &&
        row.feeType !== "reimbursement"
      ) {
        return null;
      }

      if (row.calculationType !== "pre_split" && row.calculationType !== "post_split" && row.calculationType !== "reimbursement") {
        return null;
      }

      if (row.approvalStatus !== "not_required" && row.approvalStatus !== "pending" && row.approvalStatus !== "approved") {
        return null;
      }

      return {
        feeType: row.feeType,
        label: row.label,
        calculationType: row.calculationType,
        rate: row.rate,
        amount: row.amount,
        approvalRequired: row.approvalRequired,
        approvalStatus: row.approvalStatus,
        notes: row.notes
      } satisfies StoredTransactionFinanceFeeBreakdownRow;
    })
    .filter((entry): entry is StoredTransactionFinanceFeeBreakdownRow => Boolean(entry));
}

export function parseStoredTransactionFinanceStakeholderBreakdown(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Record<string, Prisma.JsonValue>;

      if (
        typeof row.key !== "string" ||
        typeof row.membershipId !== "string" ||
        typeof row.recipientLabel !== "string" ||
        typeof row.recipientRole !== "string" ||
        typeof row.recipientRoleValue !== "string" ||
        typeof row.recipientType !== "string" ||
        typeof row.sharePercent !== "string" ||
        typeof row.baseAmount !== "string" ||
        typeof row.postSplitAdjustment !== "string" ||
        typeof row.reimbursementAdjustment !== "string" ||
        typeof row.finalAmount !== "string"
      ) {
        return null;
      }

      if (row.recipientType !== "agent" && row.recipientType !== "brokerage" && row.recipientType !== "referral") {
        return null;
      }

      return {
        key: row.key,
        membershipId: row.membershipId,
        recipientLabel: row.recipientLabel,
        recipientRole: row.recipientRole,
        recipientRoleValue: row.recipientRoleValue,
        recipientType: row.recipientType,
        isManualParticipant: typeof row.isManualParticipant === "boolean" ? row.isManualParticipant : false,
        sharePercent: row.sharePercent,
        baseAmount: row.baseAmount,
        postSplitAdjustment: row.postSplitAdjustment,
        reimbursementAdjustment: row.reimbursementAdjustment,
        finalAmount: row.finalAmount
      } satisfies StoredTransactionFinanceStakeholderBreakdownRow;
    })
    .filter((entry): entry is StoredTransactionFinanceStakeholderBreakdownRow => Boolean(entry));
}

export function mapStoredTransactionFinanceStakeholderRow(
  row: StoredTransactionFinanceStakeholderBreakdownRow
): OfficeTransactionCommissionStakeholderRow {
  return {
    key: row.key,
    membershipId: row.membershipId,
    recipientLabel: row.recipientLabel,
    recipientRole: row.recipientRole,
    isManualParticipant: row.isManualParticipant,
    sharePercent: row.sharePercent,
    sharePercentLabel: `${formatPercentLabel(row.sharePercent)}%`,
    baseAmount: row.baseAmount,
    baseAmountLabel: row.isManualParticipant ? "—" : formatCurrency(row.baseAmount),
    postSplitAdjustment: row.postSplitAdjustment,
    postSplitAdjustmentLabel: row.isManualParticipant ? "—" : formatCurrency(row.postSplitAdjustment),
    reimbursementAdjustment: row.reimbursementAdjustment,
    reimbursementAdjustmentLabel: row.isManualParticipant ? "—" : formatCurrency(row.reimbursementAdjustment),
    finalAmount: row.finalAmount,
    finalAmountLabel: formatCurrency(row.finalAmount)
  };
}

export function getCommissionRoleValue(teamMembershipRole: TeamMembershipRole | null | undefined) {
  if (teamMembershipRole === "team_leader" || teamMembershipRole === "junior_team_leader" || teamMembershipRole === "member") {
    return teamMembershipRole;
  }

  return "agent";
}

export function getCommissionRoleLabel(teamMembershipRole: TeamMembershipRole | null | undefined) {
  if (!teamMembershipRole) {
    return "Agent";
  }

  return formatTeamMembershipRoleLabel(teamMembershipRole);
}

export async function buildDefaultTransactionCommissionChain(
  tx: ScopedPrismaClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    ownerMembershipId: string;
    effectiveAt: Date;
    transactionCommissionContext?: Prisma.JsonValue | null;
  }
): Promise<DerivedTransactionCommissionChainMember[]> {
  const storedContext = parseStoredTransactionCommissionContext(input.transactionCommissionContext);

  async function resolveChainMemberSplit(
    membershipId: string,
    storedAgentPercent?: Prisma.Decimal | null,
    effectiveAt: Date = input.effectiveAt
  ) {
    await backfillMembershipCommissionSettingsFromLegacy(input.organizationId, input.officeId, [membershipId], tx);

    const setting = await resolveActiveMembershipCommissionSetting(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId,
      membershipId,
      effectiveAt
    });
    const storedPercent = storedAgentPercent ?? null;

    if (setting) {
      return {
        agentPercent: setting.agentPercent,
        sourceLabel: setting.sourceLabel,
        defaultSplitMissing: false
      };
    }

    return {
      agentPercent: storedPercent ?? new Prisma.Decimal(0),
      sourceLabel: storedPercent && storedPercent.gt(0) ? "Locked on transaction" : "No default split configured",
      defaultSplitMissing: !(storedPercent && storedPercent.gt(0))
    };
  }

  if (storedContext && storedContext.ownerMembershipId === input.ownerMembershipId) {
    const storedEffectiveAt = new Date(storedContext.sourceDate);
    const effectiveAt = Number.isNaN(storedEffectiveAt.getTime()) ? input.effectiveAt : storedEffectiveAt;
    const members: DerivedTransactionCommissionChainMember[] = [];

    for (const member of storedContext.members) {
      const resolvedSplit = await resolveChainMemberSplit(member.membershipId, new Prisma.Decimal(member.agentPercent), effectiveAt);

      members.push({
        membershipId: member.membershipId,
        membershipLabel: member.membershipLabel,
        recipientRole: member.recipientRole,
        recipientRoleValue: member.recipientRoleValue,
        ...resolvedSplit
      });
    }

    return members;
  }

  const [ownerMembership, teams, teamMemberships] = await Promise.all([
    tx.membership.findFirst({
      where: {
        id: input.ownerMembershipId,
        organizationId: input.organizationId
      },
      include: {
        user: true
      }
    }),
    tx.team.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        parentTeamId: true
      }
    }),
    tx.teamMembership.findMany({
      where: {
        organizationId: input.organizationId,
        team: {
          isActive: true,
          ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
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
  ]);

  if (!ownerMembership) {
    throw new Error("Transaction owner membership was not found.");
  }

  const hierarchy = buildTeamMembershipHierarchyMap({
    teams,
    teamMemberships: teamMemberships.map((teamMembership) => ({
      id: teamMembership.id,
      membershipId: teamMembership.membershipId,
      teamId: teamMembership.teamId,
      role: teamMembership.role,
      reportsToTeamMembershipId: teamMembership.reportsToTeamMembershipId,
      label: `${teamMembership.membership.user.firstName} ${teamMembership.membership.user.lastName}`.trim() || teamMembership.membership.user.email
    }))
  });
  const teamMembershipById = new Map(teamMemberships.map((teamMembership) => [teamMembership.id, teamMembership]));
  const ownerTeamMemberships = teamMemberships.filter((teamMembership) => teamMembership.membershipId === input.ownerMembershipId);

  if (ownerTeamMemberships.length > 1) {
    throw new Error("Each membership can only belong to one active team in the current company scope. Resolve team assignments before calculating commissions.");
  }

  const chain: DerivedTransactionCommissionChainMember[] = [];

  async function pushChainMember(
    membershipId: string,
    membershipLabel: string,
    recipientRole: string,
    recipientRoleValue: string
  ) {
    const resolvedSplit = await resolveChainMemberSplit(membershipId);

    chain.push({
      membershipId,
      membershipLabel,
      recipientRole,
      recipientRoleValue,
      ...resolvedSplit
    });
  }

  await pushChainMember(input.ownerMembershipId, `${ownerMembership.user.firstName} ${ownerMembership.user.lastName}`.trim() || ownerMembership.user.email, ownerTeamMemberships[0] ? getCommissionRoleLabel(ownerTeamMemberships[0].role) : "Agent", ownerTeamMemberships[0] ? getCommissionRoleValue(ownerTeamMemberships[0].role) : "agent");

  const visitedTeamMembershipIds = new Set<string>();
  let cursorTeamMembershipId = ownerTeamMemberships[0]?.id ?? null;

  while (cursorTeamMembershipId && !visitedTeamMembershipIds.has(cursorTeamMembershipId)) {
    visitedTeamMembershipIds.add(cursorTeamMembershipId);

    const directManagerTeamMembershipId = hierarchy.hierarchyMap.get(cursorTeamMembershipId)?.directManagerTeamMembershipId ?? null;

    if (!directManagerTeamMembershipId) {
      break;
    }

    const managerTeamMembership = teamMembershipById.get(directManagerTeamMembershipId);

    if (!managerTeamMembership) {
      break;
    }

    await pushChainMember(
      managerTeamMembership.membershipId,
      `${managerTeamMembership.membership.user.firstName} ${managerTeamMembership.membership.user.lastName}`.trim() || managerTeamMembership.membership.user.email,
      getCommissionRoleLabel(managerTeamMembership.role),
      getCommissionRoleValue(managerTeamMembership.role)
    );

    cursorTeamMembershipId = managerTeamMembership.id;
  }

  return chain;
}

export function buildDefaultSplitCalculationRows(input: {
  grossCommission: Prisma.Decimal;
  referralFee: Prisma.Decimal;
  chain: DerivedTransactionCommissionChainMember[];
}) {
  const grossAfterReferral = Prisma.Decimal.max(new Prisma.Decimal(0), input.grossCommission.minus(input.referralFee));
  const memberRows: Array<{
    membershipId: string;
    membershipLabel: string;
    recipientRole: string;
    recipientRoleValue: string;
    agentPercent: Prisma.Decimal;
    sharePercent: Prisma.Decimal;
    statementAmount: Prisma.Decimal;
  }> = [];
  let runningPercent = new Prisma.Decimal(0);
  let memberTotal = new Prisma.Decimal(0);

  for (const member of input.chain) {
    const nextRunningPercent = Prisma.Decimal.max(runningPercent, member.agentPercent);
    const sharePercent = Prisma.Decimal.max(new Prisma.Decimal(0), member.agentPercent.minus(runningPercent));
    const statementAmount = grossAfterReferral.mul(sharePercent).div(new Prisma.Decimal(100));

    memberRows.push({
      membershipId: member.membershipId,
      membershipLabel: member.membershipLabel,
      recipientRole: member.recipientRole,
      recipientRoleValue: member.recipientRoleValue,
      agentPercent: member.agentPercent,
      sharePercent,
      statementAmount
    });

    memberTotal = memberTotal.plus(statementAmount);
    runningPercent = nextRunningPercent;
  }

  return {
    grossAfterReferral,
    memberRows,
    companyPercent: Prisma.Decimal.max(new Prisma.Decimal(0), new Prisma.Decimal(100).minus(runningPercent)),
    companyAmount: Prisma.Decimal.max(new Prisma.Decimal(0), grossAfterReferral.minus(memberTotal))
  };
}

export type NormalizedTransactionFinanceFee = {
  id: string;
  feeType: TransactionFinanceFeeType;
  label: string;
  rate: Prisma.Decimal;
  amount: Prisma.Decimal;
  selectedCalculationType: TransactionFinanceCalculationType;
  approvalRequired: boolean;
  approvalStatus: TransactionFinanceApprovalStatus;
  notes: string;
};

export type ComputedTransactionFinanceStakeholderRow = {
  key: string;
  membershipId: string;
  recipientLabel: string;
  recipientRole: string;
  recipientRoleValue: string;
  recipientType: CommissionRecipientType;
  isManualParticipant: boolean;
  sharePercent: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  postSplitAdjustment: Prisma.Decimal;
  reimbursementAdjustment: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
};

export type ComputedTransactionFinanceResult = {
  normalizedFees: NormalizedTransactionFinanceFee[];
  approvalBlockers: string[];
  preSplitTotal: Prisma.Decimal;
  postSplitTotal: Prisma.Decimal;
  netCommissionBase: Prisma.Decimal;
  reimbursementAmount: Prisma.Decimal;
  finalAgentNet: Prisma.Decimal;
  finalOfficeNet: Prisma.Decimal;
  stakeholderRows: ComputedTransactionFinanceStakeholderRow[];
};

export function normalizeTransactionFinanceFees(
  fees: Array<{
    id: string;
    feeType: TransactionFinanceFeeType;
    rate: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    selectedCalculationType: TransactionFinanceCalculationType;
    approvalRequired: boolean;
    approvalStatus: TransactionFinanceApprovalStatus;
    notes: string | null;
  }>
) {
  return sortTransactionFinanceFees(
    filterActiveTransactionFinanceFees(fees).map((fee) => {
      const definition = getTransactionFinanceFeeDefinition(fee.feeType);

      return {
        id: fee.id,
        feeType: fee.feeType,
        label: definition.label,
        rate: fee.rate ?? new Prisma.Decimal(0),
        amount: fee.amount ?? new Prisma.Decimal(0),
        selectedCalculationType: fee.selectedCalculationType,
        approvalRequired: fee.approvalRequired,
        approvalStatus: fee.approvalStatus,
        notes: fee.notes ?? ""
      } satisfies NormalizedTransactionFinanceFee;
    })
  );
}

export function buildTransactionFinanceBlockingIssues(input: {
  fees: NormalizedTransactionFinanceFee[];
  prerequisites: OfficeTransactionFinancePrerequisiteSnapshot;
}) {
  const blockers: string[] = [];

  for (const fee of input.fees) {
    if (fee.amount.lte(0)) {
      continue;
    }

    if (fee.approvalRequired && fee.approvalStatus !== "approved") {
      blockers.push(`${fee.label} exceeds the allowed rate and must be approved before calculation.`);
    }

    if (fee.feeType === "client_referral" && !input.prerequisites.clientReferralReady) {
      blockers.push("Internal Referral requires a signed and approved Agent Referral Form before calculation.");
    }

    if (fee.feeType === "rebate" && !input.prerequisites.rebateReady) {
      blockers.push("Rebate requires a signed Rebate Agreement and submitted Rebate Google Form before calculation.");
    }
  }

  return blockers;
}

export function buildStoredTransactionFinanceFeeBreakdownRows(fees: NormalizedTransactionFinanceFee[]): StoredTransactionFinanceFeeBreakdownRow[] {
  return fees.map((fee) => ({
    feeType: fee.feeType,
    label: fee.label,
    calculationType: fee.selectedCalculationType,
    rate: String(fee.rate),
    amount: String(fee.amount),
    approvalRequired: fee.approvalRequired,
    approvalStatus: fee.approvalStatus,
    notes: fee.notes
  }));
}

export function buildStoredTransactionFinanceStakeholderBreakdownRows(
  rows: ComputedTransactionFinanceStakeholderRow[]
): StoredTransactionFinanceStakeholderBreakdownRow[] {
  return rows.map((row) => ({
    key: row.key,
    membershipId: row.membershipId,
    recipientLabel: row.recipientLabel,
    recipientRole: row.recipientRole,
    recipientRoleValue: row.recipientRoleValue,
    recipientType: row.recipientType,
    isManualParticipant: row.isManualParticipant,
    sharePercent: String(row.sharePercent),
    baseAmount: String(row.baseAmount),
    postSplitAdjustment: String(row.postSplitAdjustment),
    reimbursementAdjustment: String(row.reimbursementAdjustment),
    finalAmount: String(row.finalAmount)
  }));
}

export const managedTransactionMembershipLinkRoles = ["commission_participant", "commission_manual_participant"] as const;

export async function syncTransactionParticipantMembershipLinks(
  tx: ScopedPrismaClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    transactionId: string;
    stakeholderRows: StoredTransactionFinanceStakeholderBreakdownRow[];
  }
) {
  const participantRows = input.stakeholderRows.filter(
    (row) => row.recipientType === "agent" && Boolean(row.membershipId?.trim())
  );
  const participantRowByMembershipId = new Map(participantRows.map((row) => [row.membershipId.trim(), row]));
  const participantMembershipIds = [...participantRowByMembershipId.keys()];

  await tx.transactionMembershipLink.deleteMany({
    where: {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      role: {
        in: [...managedTransactionMembershipLinkRoles]
      },
      ...(participantMembershipIds.length > 0
        ? {
            membershipId: {
              notIn: participantMembershipIds
            }
          }
        : {})
    }
  });

  if (participantMembershipIds.length === 0) {
    return;
  }

  const existingLinks = await tx.transactionMembershipLink.findMany({
    where: {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      membershipId: {
        in: participantMembershipIds
      }
    },
    select: {
      id: true,
      membershipId: true,
      role: true,
      notes: true
    }
  });
  const existingLinkByMembershipId = new Map(existingLinks.map((link) => [link.membershipId, link]));

  for (const membershipId of participantMembershipIds) {
    const participantRow = participantRowByMembershipId.get(membershipId);

    if (!participantRow) {
      continue;
    }

    const role = participantRow.isManualParticipant ? "commission_manual_participant" : "commission_participant";
    const notes = participantRow.isManualParticipant
      ? "Managed from transaction commission manual override."
      : "Managed from transaction commission calculation.";
    const existingLink = existingLinkByMembershipId.get(membershipId) ?? null;

    if (!existingLink) {
      await tx.transactionMembershipLink.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? null,
          transactionId: input.transactionId,
          membershipId,
          role,
          notes
        }
      });
      continue;
    }

    if (!managedTransactionMembershipLinkRoles.includes(existingLink.role as (typeof managedTransactionMembershipLinkRoles)[number])) {
      continue;
    }

    if (existingLink.role === role && existingLink.notes === notes) {
      continue;
    }

    await tx.transactionMembershipLink.update({
      where: {
        id: existingLink.id
      },
      data: {
        officeId: input.officeId ?? null,
        role,
        notes
      }
    });
  }
}

export function buildCommissionStakeholderKey(input: {
  recipientType: CommissionRecipientType;
  membershipId: string | null;
}) {
  if (input.recipientType === "brokerage") {
    return "company";
  }

  return input.membershipId ?? "";
}

export function normalizeCurrencyDecimal(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

export function normalizeSharePercentDecimal(value: Prisma.Decimal) {
  return value.toDecimalPlaces(4);
}

export function hasManualParticipantRows(rows: Array<{ isManualParticipant: boolean }>) {
  return rows.some((row) => row.isManualParticipant);
}

export function sumStakeholderFinalAmounts(rows: Array<{ finalAmount: string }>) {
  return rows.reduce(
    (sum, row) => sum.plus(normalizeCurrencyDecimal(parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0))),
    new Prisma.Decimal(0)
  );
}

export function applyEffectiveSharePercentsToStoredStakeholderRows(rows: StoredTransactionFinanceStakeholderBreakdownRow[]) {
  const totalAllocatedPayout = normalizeCurrencyDecimal(sumStakeholderFinalAmounts(rows));

  if (totalAllocatedPayout.lte(0)) {
    return rows.map((row) => ({
      ...row,
      sharePercent: "0"
    }));
  }

  return rows.map((row) => {
    const finalAmount = normalizeCurrencyDecimal(parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0));
    const effectiveSharePercent = normalizeSharePercentDecimal(
      Prisma.Decimal.max(new Prisma.Decimal(0), finalAmount.mul(new Prisma.Decimal(100)).div(totalAllocatedPayout))
    );

    return {
      ...row,
      sharePercent: String(effectiveSharePercent)
    };
  });
}

export function findPrimaryAgentStakeholderRow(
  rows: StoredTransactionFinanceStakeholderBreakdownRow[],
  ownerMembershipId: string | null | undefined
) {
  if (ownerMembershipId) {
    const ownerRow = rows.find((row) => row.recipientType === "agent" && row.membershipId === ownerMembershipId);

    if (ownerRow) {
      return ownerRow;
    }
  }

  return rows.find((row) => row.recipientType === "agent") ?? null;
}

export function buildPreviousCommissionChangeBaseline(
  input: {
    rows: Array<{
      membershipId: string | null;
      recipientType: CommissionRecipientType;
      grossCommission: Prisma.Decimal;
      referralFee: Prisma.Decimal;
      statementAmount: Prisma.Decimal;
    }>;
    ownerMembershipId: string | null | undefined;
    fallbackGrossCommission: Prisma.Decimal;
    fallbackReferralFee: Prisma.Decimal;
    fallbackOfficeNet: Prisma.Decimal;
    fallbackAgentNet: Prisma.Decimal;
  }
) {
  const primaryAgentRow =
    (input.ownerMembershipId
      ? input.rows.find((row) => row.recipientType === "agent" && row.membershipId === input.ownerMembershipId)
      : null) ?? input.rows.find((row) => row.recipientType === "agent");

  return {
    grossCommission: primaryAgentRow?.grossCommission ?? input.rows[0]?.grossCommission ?? input.fallbackGrossCommission,
    referralFee: primaryAgentRow?.referralFee ?? input.rows[0]?.referralFee ?? input.fallbackReferralFee,
    officeNet:
      input.rows.find((row) => row.recipientType === "brokerage")?.statementAmount ?? input.fallbackOfficeNet,
    agentNet: primaryAgentRow?.statementAmount ?? input.fallbackAgentNet
  } as const;
}

export function formatMembershipFullName(input: {
  firstName: string;
  lastName: string;
  email?: string | null;
}) {
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  return fullName || input.email?.trim() || "Unnamed member";
}

export function buildManualParticipantOption(input: {
  membershipId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: MembershipStatus;
  title?: string | null;
  officeName?: string | null;
}) {
  const recipientLabel = formatMembershipFullName({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email
  });
  const recipientRole = formatMembershipParticipantRole({
    role: input.role,
    title: input.title
  });
  const statusLabel = membershipStatusLabelMap[input.status];
  const officeLabel = input.officeName?.trim() || "All offices";

  return {
    membershipId: input.membershipId,
    recipientLabel,
    recipientRole,
    statusLabel,
    officeLabel,
    label: `${recipientLabel} · ${recipientRole} · ${statusLabel} · ${officeLabel}`
  } satisfies OfficeTransactionCommissionManualParticipantOption;
}

export function calculateTransactionFinanceResult(input: {
  grossCommission: Prisma.Decimal;
  fees: Array<{
    id: string;
    feeType: TransactionFinanceFeeType;
    rate: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    selectedCalculationType: TransactionFinanceCalculationType;
    approvalRequired: boolean;
    approvalStatus: TransactionFinanceApprovalStatus;
    notes: string | null;
  }>;
  chain: DerivedTransactionCommissionChainMember[];
  prerequisites: OfficeTransactionFinancePrerequisiteSnapshot;
}) {
  const normalizedFees = normalizeTransactionFinanceFees(input.fees);
  const approvalBlockers = buildTransactionFinanceBlockingIssues({
    fees: normalizedFees,
    prerequisites: input.prerequisites
  });

  for (const member of input.chain) {
    if (!member.defaultSplitMissing) {
      continue;
    }

    approvalBlockers.push(
      `${member.membershipLabel} (${member.recipientRole}) is missing a default split. Configure the member default split before calculating commission.`
    );
  }

  const preSplitTotal = normalizedFees
    .filter((fee) => fee.selectedCalculationType === "pre_split")
    .reduce((sum, fee) => sum.plus(fee.amount), new Prisma.Decimal(0));
  const postSplitTotal = normalizedFees
    .filter((fee) => fee.selectedCalculationType === "post_split")
    .reduce((sum, fee) => sum.plus(fee.amount), new Prisma.Decimal(0));
  const reimbursementBase = normalizedFees
    .filter((fee) => fee.selectedCalculationType === "reimbursement")
    .reduce((sum, fee) => sum.plus(fee.amount), new Prisma.Decimal(0));
  const baseSplit = buildDefaultSplitCalculationRows({
    grossCommission: input.grossCommission,
    referralFee: preSplitTotal,
    chain: input.chain
  });
  const ownerBaseAmount = baseSplit.memberRows[0]?.statementAmount ?? new Prisma.Decimal(0);

  if (postSplitTotal.gt(0) && input.chain.length === 0) {
    approvalBlockers.push("Post-split fees require a transaction owner and split chain before calculation.");
  }

  if (postSplitTotal.gt(ownerBaseAmount)) {
    approvalBlockers.push("Post-split deductions exceed the owner agent share for this transaction.");
  }

  if (approvalBlockers.length > 0) {
    return {
      normalizedFees,
      approvalBlockers,
      preSplitTotal,
      postSplitTotal,
      netCommissionBase: baseSplit.grossAfterReferral,
      reimbursementAmount: new Prisma.Decimal(0),
      finalAgentNet: ownerBaseAmount,
      finalOfficeNet: baseSplit.companyAmount,
      stakeholderRows: [] as ComputedTransactionFinanceStakeholderRow[]
    } satisfies ComputedTransactionFinanceResult;
  }

  const reimbursementCap = ownerBaseAmount.minus(postSplitTotal).mul(new Prisma.Decimal(10)).div(new Prisma.Decimal(100));
  const reimbursementEligible = Prisma.Decimal.max(new Prisma.Decimal(0), reimbursementCap);
  const reimbursementAmount = Prisma.Decimal.min(reimbursementBase, reimbursementEligible).mul(new Prisma.Decimal(50)).div(new Prisma.Decimal(100));
  const stakeholderRows: ComputedTransactionFinanceStakeholderRow[] = baseSplit.memberRows.map((row, index) => ({
    key: row.membershipId,
    membershipId: row.membershipId,
    recipientLabel: row.membershipLabel,
    recipientRole: row.recipientRole,
    recipientRoleValue: row.recipientRoleValue,
    recipientType: "agent",
    isManualParticipant: false,
    sharePercent: row.sharePercent,
    baseAmount: row.statementAmount,
    postSplitAdjustment: index === 0 ? postSplitTotal.neg() : new Prisma.Decimal(0),
    reimbursementAdjustment: index === 0 ? reimbursementAmount : new Prisma.Decimal(0),
    finalAmount: index === 0 ? row.statementAmount.minus(postSplitTotal).plus(reimbursementAmount) : row.statementAmount
  }));
  const companyFinalAmount = baseSplit.companyAmount.plus(postSplitTotal).minus(reimbursementAmount);

  stakeholderRows.push({
    key: "company",
    membershipId: "",
    recipientLabel: "Company",
    recipientRole: "Brokerage",
    recipientRoleValue: "brokerage",
    recipientType: "brokerage",
    isManualParticipant: false,
    sharePercent: baseSplit.companyPercent,
    baseAmount: baseSplit.companyAmount,
    postSplitAdjustment: postSplitTotal,
    reimbursementAdjustment: reimbursementAmount.neg(),
    finalAmount: companyFinalAmount
  });

  return {
    normalizedFees,
    approvalBlockers,
    preSplitTotal,
    postSplitTotal,
    netCommissionBase: baseSplit.grossAfterReferral,
    reimbursementAmount,
    finalAgentNet: stakeholderRows[0]?.finalAmount ?? new Prisma.Decimal(0),
    finalOfficeNet: companyFinalAmount,
    stakeholderRows
  } satisfies ComputedTransactionFinanceResult;
}

export function filterVisibleCommissionRows(
  calculations: Array<{
    membershipId: string | null;
    recipientType: CommissionRecipientType;
  }>,
  scope: Awaited<ReturnType<typeof resolveOfficeDataScope>> | null
) {
  if (!scope || scope.visibleMembershipIds === null) {
    return {
      visibleRowIndexes: calculations.map((_, index) => index),
      hiddenRowCount: 0,
      visibilityNote: ""
    };
  }

  const visibleMembershipIds = new Set(scope.visibleMembershipIds);
  const canViewCompanyRows = scope.viewerPermissions.includes("commissions:view:company");
  const visibleRowIndexes: number[] = [];

  calculations.forEach((row, index) => {
    if (row.recipientType === "agent") {
      if (row.membershipId && visibleMembershipIds.has(row.membershipId)) {
        visibleRowIndexes.push(index);
      }
      return;
    }

    if (canViewCompanyRows) {
      visibleRowIndexes.push(index);
    }
  });

  const hiddenRowCount = Math.max(0, calculations.length - visibleRowIndexes.length);

  return {
    visibleRowIndexes,
    hiddenRowCount,
    visibilityNote: hiddenRowCount > 0 ? "Some internal allocations are hidden for your current commission access level." : ""
  };
}

export function buildLegacyReviewItems(input: {
  plans: OfficeCommissionPlanRecord[];
  assignments: OfficeCommissionAssignmentRecord[];
}) {
  const reviewItems: string[] = [];
  const complexPlanCount = input.plans.filter((plan) => plan.rules.some((rule) => rule.ruleTypeValue !== "base_split")).length;
  const teamAssignmentCount = input.assignments.filter((assignment) => assignment.targetType === "team").length;

  if (complexPlanCount > 0) {
    reviewItems.push(`${complexPlanCount} legacy plan(s) still use fee or sliding-scale rules and should be reviewed in Advanced settings.`);
  }

  if (teamAssignmentCount > 0) {
    reviewItems.push(`${teamAssignmentCount} legacy team assignment(s) remain active and are not used by the new default split chain.`);
  }

  return reviewItems;
}

export function buildTransactionCommissionSummary(
  transaction: {
    grossCommission: Prisma.Decimal | null;
    referralFee: Prisma.Decimal | null;
    officeNet: Prisma.Decimal | null;
    agentNet: Prisma.Decimal | null;
  },
  calculations: Array<{
    recipientType: CommissionRecipientType;
    grossCommission: Prisma.Decimal;
    referralFee: Prisma.Decimal;
    fees: Prisma.Decimal;
    statementAmount: Prisma.Decimal;
    status: CommissionCalculationStatus;
  }>,
  options?: {
    restrictTotals?: boolean;
    currentVersion?: {
      versionNumber: number;
      sourceType: TransactionFinanceVersionSource;
      preSplitTotal: Prisma.Decimal;
      postSplitTotal: Prisma.Decimal;
      netCommissionBase: Prisma.Decimal;
      reimbursementAmount: Prisma.Decimal;
      finalAgentNet: Prisma.Decimal;
      finalOfficeNet: Prisma.Decimal;
    } | null;
    feeRows?: Array<{
      amount: Prisma.Decimal | null;
      selectedCalculationType: TransactionFinanceCalculationType;
    }>;
  }
) {
  const summarySource = calculations[0] ?? null;
  const officeNetTotal = calculations
    .filter((row) => row.recipientType === "brokerage")
    .reduce((sum, row) => sum.plus(row.statementAmount), new Prisma.Decimal(0));
  const grossCommission = summarySource?.grossCommission ?? transaction.grossCommission ?? new Prisma.Decimal(0);
  const fallbackPreSplitTotal =
    options?.feeRows
      ?.filter((fee) => fee.selectedCalculationType === "pre_split")
      .reduce((sum, fee) => sum.plus(fee.amount ?? new Prisma.Decimal(0)), new Prisma.Decimal(0)) ??
    summarySource?.referralFee ??
    transaction.referralFee ??
    new Prisma.Decimal(0);
  const fallbackPostSplitTotal =
    options?.feeRows
      ?.filter((fee) => fee.selectedCalculationType === "post_split")
      .reduce((sum, fee) => sum.plus(fee.amount ?? new Prisma.Decimal(0)), new Prisma.Decimal(0)) ??
    summarySource?.fees ??
    new Prisma.Decimal(0);
  const preSplitTotal = options?.currentVersion?.preSplitTotal ?? fallbackPreSplitTotal;
  const postSplitTotal = options?.currentVersion?.postSplitTotal ?? fallbackPostSplitTotal;
  const netCommissionBase =
    options?.currentVersion?.netCommissionBase ?? Prisma.Decimal.max(new Prisma.Decimal(0), grossCommission.minus(preSplitTotal));
  const reimbursementAmount = options?.currentVersion?.reimbursementAmount ?? new Prisma.Decimal(0);
  const ownerAgentNet = options?.currentVersion?.finalAgentNet ?? transaction.agentNet ?? new Prisma.Decimal(0);
  const fallbackCompanyNet = officeNetTotal.gt(0) ? officeNetTotal : transaction.officeNet ?? new Prisma.Decimal(0);
  const companyNet = options?.currentVersion?.finalOfficeNet ?? fallbackCompanyNet;
  const statementReadyTotal = sumAgentStatementAmounts(calculations, "statement_ready");
  const payableTotal = sumAgentStatementAmounts(calculations, "payable");
  const currentVersionLabel = options?.currentVersion
    ? `Version ${options.currentVersion.versionNumber} · ${transactionFinanceVersionSourceLabelMap[options.currentVersion.sourceType]}`
    : "Not calculated";

  if (options?.restrictTotals) {
    return {
      grossCommissionLabel: "Restricted",
      referralFeeLabel: "Restricted",
      feesLabel: "Restricted",
      officeNetLabel: "Restricted",
      agentNetLabel: "Restricted",
      preSplitTotalLabel: "Restricted",
      postSplitTotalLabel: "Restricted",
      netCommissionBaseLabel: "Restricted",
      reimbursementLabel: "Restricted",
      currentVersionLabel,
      statementReadyLabel: formatCurrency(statementReadyTotal),
      payableLabel: formatCurrency(payableTotal)
    };
  }

  return {
    grossCommissionLabel: formatCurrency(grossCommission),
    referralFeeLabel: formatCurrency(preSplitTotal),
    feesLabel: formatCurrency(postSplitTotal),
    officeNetLabel: formatCurrency(companyNet),
    agentNetLabel: formatCurrency(ownerAgentNet),
    preSplitTotalLabel: formatCurrency(preSplitTotal),
    postSplitTotalLabel: formatCurrency(postSplitTotal),
    netCommissionBaseLabel: formatCurrency(netCommissionBase),
    reimbursementLabel: formatCurrency(reimbursementAmount),
    currentVersionLabel,
    statementReadyLabel: formatCurrency(statementReadyTotal),
    payableLabel: formatCurrency(payableTotal)
  };
}

export type PreviewCreateTransactionCommissionCalculatorInput = {
  organizationId: string;
  officeId?: string | null;
  ownerMembershipId: string;
  grossCommission: string;
  fees?: Array<{
    feeType?: string;
    rate?: string;
    amount?: string;
    selectedCalculationType?: string;
    approvalStatus?: string;
    notes?: string;
  }>;
};

export async function previewCreateTransactionCommissionCalculator(
  input: PreviewCreateTransactionCommissionCalculatorInput
): Promise<OfficeCreateTransactionCommissionPreview> {
  const grossCommission = parseOptionalDecimal(input.grossCommission);

  if (!grossCommission || grossCommission.lte(0)) {
    throw new Error("Gross Commission is required before calculation.");
  }

  if (!input.ownerMembershipId.trim()) {
    throw new Error("Select an agent owner before calculating commission.");
  }

  const effectiveAt = new Date();
  const chain = await buildDefaultTransactionCommissionChain(prisma, {
    organizationId: input.organizationId,
    officeId: input.officeId ?? null,
    ownerMembershipId: input.ownerMembershipId,
    effectiveAt,
    transactionCommissionContext: null
  });

  const normalizedPreviewFees = (input.fees ?? [])
    .map((fee, index) => {
      const feeType = parseTransactionFinanceFeeType(fee?.feeType);

      if (!feeType || !isActiveTransactionFinanceFeeType(feeType)) {
        return null;
      }

      const definition = getTransactionFinanceFeeDefinition(feeType);
      const normalized = normalizeTransactionFinanceFeeForPersistence({
        feeType,
        grossCommission,
        existingRate: null,
        existingAmount: null,
        existingCalculationType: definition.defaultCalculationType,
        existingApprovalStatus: "not_required",
        rate: parseOptionalDecimal(fee?.rate),
        amount: parseOptionalDecimal(fee?.amount),
        selectedCalculationType:
          parseTransactionFinanceCalculationType(fee?.selectedCalculationType) ?? definition.defaultCalculationType,
        requestedApprovalStatus: parseTransactionFinanceApprovalStatus(fee?.approvalStatus),
        notes: parseOptionalText(fee?.notes)
      });

      return {
        id: `preview:${feeType}:${index}:${randomUUID()}`,
        feeType,
        rate: normalized.rate,
        amount: normalized.amount,
        selectedCalculationType: normalized.selectedCalculationType,
        approvalRequired: normalized.approvalRequired,
        approvalStatus: normalized.approvalStatus,
        notes: normalized.notes
      };
    })
    .filter(
      (
        fee
      ): fee is {
        id: string;
        feeType: TransactionFinanceFeeType;
        rate: Prisma.Decimal | null;
        amount: Prisma.Decimal | null;
        selectedCalculationType: TransactionFinanceCalculationType;
        approvalRequired: boolean;
        approvalStatus: TransactionFinanceApprovalStatus;
        notes: string | null;
      } => Boolean(fee)
    );

  const calculated = calculateTransactionFinanceResult({
    grossCommission,
    fees: normalizedPreviewFees,
    chain,
    prerequisites: buildTransactionFinancePrerequisiteSnapshot({
      clientReferralFormApproved: true,
      rebateAgreementSigned: true,
      rebateGoogleFormSubmitted: true
    })
  });

  return {
    grossCommissionLabel: formatCurrency(grossCommission),
    preSplitTotalLabel: formatCurrency(calculated.preSplitTotal),
    postSplitTotalLabel: formatCurrency(calculated.postSplitTotal),
    netCommissionBaseLabel: formatCurrency(calculated.netCommissionBase),
    finalAgentNetLabel: formatCurrency(calculated.finalAgentNet),
    finalOfficeNetLabel: formatCurrency(calculated.finalOfficeNet),
    blockingIssues: calculated.approvalBlockers
  };
}

export function computeRuleAmount(
  rule: {
    splitPercent: Prisma.Decimal | null;
    flatAmount: Prisma.Decimal | null;
    feeType: CommissionRuleFeeType | null;
    feeAmount: Prisma.Decimal | null;
  },
  basisAmount: Prisma.Decimal
) {
  if (rule.feeType === "percentage" && rule.feeAmount) {
    return basisAmount.mul(rule.feeAmount).div(new Prisma.Decimal(100));
  }

  if (rule.feeType === "flat" && rule.feeAmount) {
    return rule.feeAmount;
  }

  if (rule.flatAmount) {
    return rule.flatAmount;
  }

  if (rule.splitPercent) {
    return basisAmount.mul(rule.splitPercent).div(new Prisma.Decimal(100));
  }

  return new Prisma.Decimal(0);
}

export function determineBaseSplitPercent(plan: CommissionPlanWithRules | null, grossAfterReferral: Prisma.Decimal) {
  const defaultSplit = new Prisma.Decimal(70);

  if (!plan) {
    return defaultSplit;
  }

  const slidingRule = plan.rules
    .filter((rule) => rule.ruleType === "sliding_scale" && rule.splitPercent)
    .find((rule) => {
      const meetsStart = !rule.thresholdStart || grossAfterReferral.gte(rule.thresholdStart);
      const meetsEnd = !rule.thresholdEnd || grossAfterReferral.lte(rule.thresholdEnd);
      return meetsStart && meetsEnd;
    });

  if (slidingRule?.splitPercent) {
    return slidingRule.splitPercent;
  }

  const baseRule = plan.rules.find((rule) => rule.ruleType === "base_split" && rule.splitPercent);
  return baseRule?.splitPercent ?? defaultSplit;
}

export function calculatePlanDrivenValues(input: {
  grossCommission: Prisma.Decimal;
  transactionReferralFee: Prisma.Decimal;
  transactionOfficeNet: Prisma.Decimal;
  transactionAgentNet: Prisma.Decimal;
  plan: CommissionPlanWithRules | null;
}) {
  if (!input.plan) {
    const manualFees = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      input.grossCommission.minus(input.transactionReferralFee).minus(input.transactionOfficeNet).minus(input.transactionAgentNet)
    );

    return {
      referralFee: input.transactionReferralFee,
      fees: manualFees,
      officeNet: input.transactionOfficeNet,
      agentNet: input.transactionAgentNet
    };
  }

  const referralFromRule = input.plan.rules
    .filter((rule) => rule.ruleType === "referral_fee")
    .reduce((sum, rule) => sum.plus(computeRuleAmount(rule, input.grossCommission)), new Prisma.Decimal(0));

  const referralFee = input.transactionReferralFee.gt(0) ? input.transactionReferralFee : referralFromRule;
  const grossAfterReferral = Prisma.Decimal.max(new Prisma.Decimal(0), input.grossCommission.minus(referralFee));
  const baseSplitPercent = determineBaseSplitPercent(input.plan, grossAfterReferral);
  const feeTotal = input.plan.rules
    .filter((rule) => rule.ruleType === "brokerage_fee" || rule.ruleType === "flat_fee_deduction")
    .reduce((sum, rule) => sum.plus(computeRuleAmount(rule, grossAfterReferral)), new Prisma.Decimal(0));
  const rawAgentShare = grossAfterReferral.mul(baseSplitPercent).div(new Prisma.Decimal(100));
  const agentNet = Prisma.Decimal.max(new Prisma.Decimal(0), rawAgentShare.minus(feeTotal));
  const officeNet = Prisma.Decimal.max(new Prisma.Decimal(0), grossAfterReferral.minus(agentNet));

  return {
    referralFee,
    fees: feeTotal,
    officeNet,
    agentNet
  };
}
export async function saveCommissionPlan(input: SaveCommissionPlanInput): Promise<OfficeCommissionPlanRecord> {
  const calculationMode = parseCommissionCalculationMode(input.calculationMode) ?? "split_and_fees";
  const name = input.name.trim();

  if (!name) {
    throw new Error("Commission plan name is required.");
  }

  const normalizedRules: Array<{
    ruleType: CommissionPlanRuleType;
    ruleName: string;
    sortOrder: number;
    splitPercent: Prisma.Decimal | null;
    flatAmount: Prisma.Decimal | null;
    feeType: CommissionRuleFeeType | null;
    feeAmount: Prisma.Decimal | null;
    thresholdStart: Prisma.Decimal | null;
    thresholdEnd: Prisma.Decimal | null;
    appliesToRole: string | null;
    recipientType: CommissionRecipientType | null;
    isActive: boolean;
  }> = input.rules
    .map((rule, index) => {
      const ruleType = parseCommissionPlanRuleType(rule.ruleType);

      if (!ruleType) {
        return null;
      }

      return {
        ruleType,
        ruleName: rule.ruleName.trim() || commissionRuleTypeLabelMap[ruleType],
        sortOrder: Number.isFinite(rule.sortOrder) ? Number(rule.sortOrder) : index,
        splitPercent: parseOptionalDecimal(rule.splitPercent),
        flatAmount: parseOptionalDecimal(rule.flatAmount),
        feeType: parseCommissionRuleFeeType(rule.feeType),
        feeAmount: parseOptionalDecimal(rule.feeAmount),
        thresholdStart: parseOptionalDecimal(rule.thresholdStart),
        thresholdEnd: parseOptionalDecimal(rule.thresholdEnd),
        appliesToRole: parseOptionalText(rule.appliesToRole),
        recipientType: parseCommissionRecipientType(rule.recipientType),
        isActive: rule.isActive ?? true
      };
    })
    .filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));

  const saved = await prisma.$transaction(async (tx) => {
    const existing = input.commissionPlanId
      ? await tx.commissionPlan.findFirst({
          where: {
            id: input.commissionPlanId,
            organizationId: input.organizationId
          },
          include: {
            rules: true
          }
        })
      : null;

    const plan = existing
      ? await tx.commissionPlan.update({
          where: {
            id: existing.id
          },
          data: {
            officeId: input.officeId ?? existing.officeId,
            name,
            description: parseOptionalText(input.description),
            isActive: input.isActive ?? existing.isActive,
            calculationMode,
            defaultCurrency: parseOptionalText(input.defaultCurrency) ?? "USD"
          }
        })
      : await tx.commissionPlan.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            name,
            description: parseOptionalText(input.description),
            isActive: input.isActive ?? true,
            calculationMode,
            defaultCurrency: parseOptionalText(input.defaultCurrency) ?? "USD"
          }
        });

    await tx.commissionPlanRule.deleteMany({
      where: {
        organizationId: input.organizationId,
        commissionPlanId: plan.id
      }
    });

    if (normalizedRules.length > 0) {
      await tx.commissionPlanRule.createMany({
        data: normalizedRules.map((rule) => ({
          organizationId: input.organizationId,
          commissionPlanId: plan.id,
          ruleType: rule.ruleType,
          ruleName: rule.ruleName,
          sortOrder: rule.sortOrder,
          splitPercent: rule.splitPercent,
          flatAmount: rule.flatAmount,
          feeType: rule.feeType,
          feeAmount: rule.feeAmount,
          thresholdStart: rule.thresholdStart,
          thresholdEnd: rule.thresholdEnd,
          appliesToRole: rule.appliesToRole,
          recipientType: rule.recipientType,
          isActive: rule.isActive
        }))
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_plan",
      entityId: plan.id,
      action: existing ? activityLogActions.commissionPlanUpdated : activityLogActions.commissionPlanCreated,
      payload: {
        officeId: input.officeId ?? null,
        objectLabel: name,
        contextHref: "/office/settings/commission-plans",
        details: [
          `Mode: ${commissionCalculationModeLabelMap[calculationMode]}`,
          `Active rules: ${normalizedRules.length}`
        ],
        changes: existing
          ? [
              {
                label: "Name",
                previousValue: existing.name,
                nextValue: name
              },
              {
                label: "Mode",
                previousValue: commissionCalculationModeLabelMap[existing.calculationMode],
                nextValue: commissionCalculationModeLabelMap[calculationMode]
              }
            ].filter((change) => change.previousValue !== change.nextValue)
          : []
      }
    });

    return tx.commissionPlan.findUniqueOrThrow({
      where: {
        id: plan.id
      },
      include: {
        rules: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        assignments: true
      }
    });
  });

  return {
    id: saved.id,
    name: saved.name,
    description: saved.description ?? "",
    isActive: saved.isActive,
    calculationMode: commissionCalculationModeLabelMap[saved.calculationMode],
    calculationModeValue: saved.calculationMode,
    defaultCurrency: saved.defaultCurrency ?? "USD",
    assignmentCount: saved.assignments.length,
    rules: saved.rules.map(mapCommissionRule)
  };
}
