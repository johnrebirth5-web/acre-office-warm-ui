import { randomUUID } from "node:crypto";
import {
  CommissionCalculationMode,
  CommissionCalculationStatus,
  CommissionPlanRuleType,
  CommissionRecipientType,
  CommissionRuleFeeType,
  Prisma
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { buildTeamPathLabel, createTeamHierarchyIndex, expandSelectedTeamIds } from "./team-hierarchy";

export type OfficeCommissionCalculationStatusLabel =
  | "Draft"
  | "Calculated"
  | "Reviewed"
  | "Statement ready"
  | "Payable"
  | "Paid";

export type OfficeCommissionCalculationRecipientLabel = "Agent" | "Brokerage" | "Referral";

export type OfficeCommissionPlanRuleRecord = {
  id: string;
  ruleType: string;
  ruleTypeValue: CommissionPlanRuleType;
  ruleName: string;
  sortOrder: number;
  splitPercent: string;
  flatAmount: string;
  feeType: string;
  feeTypeValue: CommissionRuleFeeType | null;
  feeAmount: string;
  thresholdStart: string;
  thresholdEnd: string;
  appliesToRole: string;
  recipientType: string;
  recipientTypeValue: CommissionRecipientType | null;
  isActive: boolean;
};

export type OfficeCommissionPlanRecord = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  calculationMode: string;
  calculationModeValue: CommissionCalculationMode;
  defaultCurrency: string;
  assignmentCount: number;
  rules: OfficeCommissionPlanRuleRecord[];
};

export type OfficeCommissionPlanOption = {
  id: string;
  label: string;
};

export type OfficeCommissionTeamOption = {
  id: string;
  label: string;
};

export type OfficeCommissionAssignmentTargetType = "agent" | "team";
export type OfficeCommissionAssignmentSourceType = "membership" | "team";

export type OfficeCommissionAssignmentRecord = {
  id: string;
  membershipId: string;
  teamId: string;
  targetType: OfficeCommissionAssignmentTargetType;
  targetLabel: string;
  commissionPlanId: string;
  commissionPlanLabel: string;
  effectiveFrom: string;
  effectiveTo: string;
};

export type OfficeCommissionCalculationRow = {
  id: string;
  transactionId: string;
  transactionLabel: string;
  transactionHref: string;
  membershipId: string;
  recipientType: string;
  recipientTypeValue: CommissionRecipientType;
  recipientLabel: string;
  recipientRole: string;
  commissionPlanId: string;
  commissionPlanLabel: string;
  status: OfficeCommissionCalculationStatusLabel;
  statusValue: CommissionCalculationStatus;
  grossCommissionLabel: string;
  referralFeeLabel: string;
  feesLabel: string;
  officeNetLabel: string;
  agentNetLabel: string;
  statementAmountLabel: string;
  calculatedAt: string;
  notes: string;
  accountingHref: string | null;
};

export type OfficeCommissionStatementLine = {
  id: string;
  transactionId: string;
  transactionLabel: string;
  transactionHref: string;
  status: OfficeCommissionCalculationStatusLabel;
  statementAmountLabel: string;
  calculatedAt: string;
};

export type OfficeCommissionStatementSnapshot = {
  membershipId: string;
  agentLabel: string;
  generatedAt: string;
  openCalculatedLabel: string;
  statementReadyLabel: string;
  payableLabel: string;
  paidLabel: string;
  totalGrossCommissionLabel: string;
  totalOfficeNetLabel: string;
  totalAgentNetLabel: string;
  lineItems: OfficeCommissionStatementLine[];
};

export type OfficeCommissionManagementOverview = {
  activePlansCount: number;
  activeAssignmentsCount: number;
  calculatedRowsCount: number;
  statementReadyLabel: string;
  payableLabel: string;
  paidLabel: string;
};

export type OfficeCommissionManagementSnapshot = {
  overview: OfficeCommissionManagementOverview;
  filters: {
    membershipId: string;
    teamId: string;
    commissionPlanId: string;
    status: string;
    transactionId: string;
    startDate: string;
    endDate: string;
    memberOptions: Array<{ id: string; label: string }>;
    teamOptions: OfficeCommissionTeamOption[];
    commissionPlanOptions: OfficeCommissionPlanOption[];
    transactionOptions: Array<{ id: string; label: string }>;
  };
  plans: OfficeCommissionPlanRecord[];
  assignments: OfficeCommissionAssignmentRecord[];
  calculations: OfficeCommissionCalculationRow[];
  statement: OfficeCommissionStatementSnapshot | null;
};

export type OfficeTransactionCommissionSnapshot = {
  transactionId: string;
  planLabel: string;
  planId: string;
  planSourceLabel: string;
  planSourceValue: OfficeCommissionAssignmentSourceType | "manual";
  availablePlans: OfficeCommissionPlanOption[];
  calculations: OfficeCommissionCalculationRow[];
  summary: {
    grossCommissionLabel: string;
    referralFeeLabel: string;
    feesLabel: string;
    officeNetLabel: string;
    agentNetLabel: string;
    statementReadyLabel: string;
    payableLabel: string;
  };
};

export type OfficeAgentCommissionSummary = {
  activePlanId: string;
  activePlanLabel: string;
  activePlanSourceLabel: string;
  calculatedCount: number;
  statementReadyLabel: string;
  payableLabel: string;
  paidLabel: string;
  recentCalculations: OfficeCommissionCalculationRow[];
};

export type GetOfficeCommissionManagementSnapshotInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId?: string;
  teamId?: string;
  commissionPlanId?: string;
  status?: string;
  transactionId?: string;
  startDate?: string;
  endDate?: string;
};

export type SaveCommissionPlanRuleInput = {
  ruleType: string;
  ruleName: string;
  sortOrder?: number;
  splitPercent?: string;
  flatAmount?: string;
  feeType?: string;
  feeAmount?: string;
  thresholdStart?: string;
  thresholdEnd?: string;
  appliesToRole?: string;
  recipientType?: string;
  isActive?: boolean;
};

export type SaveCommissionPlanInput = {
  organizationId: string;
  officeId?: string | null;
  commissionPlanId?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  calculationMode?: string;
  defaultCurrency?: string;
  rules: SaveCommissionPlanRuleInput[];
  actorMembershipId: string;
};

export type SaveCommissionPlanAssignmentInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId?: string;
  teamId?: string;
  commissionPlanId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  actorMembershipId: string;
};

export type CalculateTransactionCommissionInput = {
  organizationId: string;
  officeId?: string | null;
  transactionId: string;
  commissionPlanId?: string;
  notes?: string;
  actorMembershipId: string;
};

export type UpdateCommissionCalculationStatusInput = {
  organizationId: string;
  calculationId: string;
  status: string;
  notes?: string;
  actorMembershipId: string;
};

export type GenerateCommissionStatementSnapshotInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  startDate?: string;
  endDate?: string;
  actorMembershipId?: string;
};

type CommissionPlanWithRules = Prisma.CommissionPlanGetPayload<{
  include: {
    rules: true;
  };
}>;

type ScopedPrismaClient = Prisma.TransactionClient | typeof prisma;

type ResolvedCommissionPlanAssignment = Prisma.CommissionPlanAssignmentGetPayload<{
  include: {
    commissionPlan: {
      include: {
        rules: true;
      };
    };
    membership: {
      include: {
        user: true;
      };
    };
    team: true;
  };
}> & {
  sourceType: OfficeCommissionAssignmentSourceType;
  sourceLabel: string;
};

const commissionCalculationStatusLabelMap: Record<CommissionCalculationStatus, OfficeCommissionCalculationStatusLabel> = {
  draft: "Draft",
  calculated: "Calculated",
  reviewed: "Reviewed",
  statement_ready: "Statement ready",
  payable: "Payable",
  paid: "Paid"
};

const commissionRecipientLabelMap: Record<CommissionRecipientType, OfficeCommissionCalculationRecipientLabel> = {
  agent: "Agent",
  brokerage: "Brokerage",
  referral: "Referral"
};

const commissionCalculationModeLabelMap: Record<CommissionCalculationMode, string> = {
  split_and_fees: "Split & fees",
  flat_net: "Flat net"
};

const commissionRuleTypeLabelMap: Record<CommissionPlanRuleType, string> = {
  base_split: "Base split",
  brokerage_fee: "Brokerage fee",
  referral_fee: "Referral fee",
  flat_fee_deduction: "Flat fee deduction",
  sliding_scale: "Sliding scale"
};

const commissionRuleFeeTypeLabelMap: Record<CommissionRuleFeeType, string> = {
  percentage: "Percentage",
  flat: "Flat"
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

function parseOptionalDate(value: string | undefined | null) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value: string | undefined | null) {
  const parsed = parseOptionalDate(value);

  if (!parsed) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function endOfDay(value: string | undefined | null) {
  const parsed = parseOptionalDate(value);

  if (!parsed) {
    return null;
  }

  parsed.setHours(23, 59, 59, 999);
  return parsed;
}

function parseOptionalDecimal(value: string | undefined | null) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
}

function parseOptionalText(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function decimalToString(value: Prisma.Decimal | null | undefined) {
  return value ? String(value) : "";
}

function buildTransactionLabel(transaction: {
  title: string;
  address: string;
  city: string;
  state: string;
}) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}

function getAssignmentTargetLabel(assignment: {
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

function compareAssignmentPriority(
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

function parseCommissionCalculationStatus(value: string | undefined | null): CommissionCalculationStatus | null {
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

function parseCommissionCalculationMode(value: string | undefined | null): CommissionCalculationMode | null {
  if (value === "split_and_fees" || value === "flat_net") {
    return value;
  }

  return null;
}

function parseCommissionPlanRuleType(value: string | undefined | null): CommissionPlanRuleType | null {
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

function parseCommissionRuleFeeType(value: string | undefined | null): CommissionRuleFeeType | null {
  if (value === "percentage" || value === "flat") {
    return value;
  }

  return null;
}

function parseCommissionRecipientType(value: string | undefined | null): CommissionRecipientType | null {
  if (value === "agent" || value === "brokerage" || value === "referral") {
    return value;
  }

  return null;
}

function mapCommissionRule(rule: {
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

function mapCommissionCalculationRow(calculation: Prisma.CommissionCalculationGetPayload<{
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

  return {
    id: calculation.id,
    transactionId: calculation.transactionId,
    transactionLabel: buildTransactionLabel(calculation.transaction),
    transactionHref: `/office/transactions/${calculation.transactionId}`,
    membershipId: calculation.membershipId ?? "",
    recipientType: commissionRecipientLabelMap[calculation.recipientType],
    recipientTypeValue: calculation.recipientType,
    recipientLabel,
    recipientRole: calculation.recipientRole ?? "",
    commissionPlanId: calculation.commissionPlanId ?? "",
    commissionPlanLabel: calculation.commissionPlan?.name ?? "Manual / transaction finance",
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

function mapCommissionAssignmentRecord(
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

async function listCommissionPlanOptions(organizationId: string, officeId?: string | null) {
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

async function resolveActiveCommissionPlanAssignment(
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

function computeRuleAmount(
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

function determineBaseSplitPercent(plan: CommissionPlanWithRules | null, grossAfterReferral: Prisma.Decimal) {
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

function calculatePlanDrivenValues(input: {
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

function buildCommissionChanges(
  previous: {
    grossCommission: Prisma.Decimal | null;
    referralFee: Prisma.Decimal | null;
    officeNet: Prisma.Decimal | null;
    agentNet: Prisma.Decimal | null;
  } | null,
  next: {
    grossCommission: Prisma.Decimal;
    referralFee: Prisma.Decimal;
    officeNet: Prisma.Decimal;
    agentNet: Prisma.Decimal;
    fees: Prisma.Decimal;
  }
) {
  const changes: Array<{ label: string; previousValue: string; nextValue: string }> = [];

  const pairs = [
    ["Gross commission", previous?.grossCommission ?? null, next.grossCommission],
    ["Referral fee", previous?.referralFee ?? null, next.referralFee],
    ["Office net", previous?.officeNet ?? null, next.officeNet],
    ["Agent net", previous?.agentNet ?? null, next.agentNet]
  ] as const;

  for (const [label, previousValue, nextValue] of pairs) {
    const previousLabel = previousValue ? formatCurrency(previousValue) : "—";
    const nextLabel = formatCurrency(nextValue);

    if (previousLabel !== nextLabel) {
      changes.push({
        label,
        previousValue: previousLabel,
        nextValue: nextLabel
      });
    }
  }

  changes.push({
    label: "Calculated fees",
    previousValue: "—",
    nextValue: formatCurrency(next.fees)
  });

  return changes;
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
        contextHref: "/office/accounting#commissions",
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

export async function assignCommissionPlanToMembership(input: SaveCommissionPlanAssignmentInput) {
  const effectiveFrom = parseOptionalDate(input.effectiveFrom);

  if (!effectiveFrom) {
    throw new Error("Effective-from date is required.");
  }

  const effectiveTo = parseOptionalDate(input.effectiveTo);

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new Error("Effective-to date must be on or after the start date.");
  }

  return prisma.$transaction(async (tx) => {
    const normalizedMembershipId = input.membershipId?.trim() || null;
    const normalizedTeamId = input.teamId?.trim() || null;

    if (!normalizedMembershipId && !normalizedTeamId) {
      throw new Error("Select an agent or a team for the commission assignment.");
    }

    if (normalizedMembershipId && normalizedTeamId) {
      throw new Error("Commission assignments can target either an agent or a team, not both.");
    }

    const [membership, team, plan] = await Promise.all([
      normalizedMembershipId
        ? tx.membership.findFirst({
            where: {
              id: normalizedMembershipId,
              organizationId: input.organizationId
            },
            include: {
              user: true,
              agentProfile: true
            }
          })
        : Promise.resolve(null),
      normalizedTeamId
        ? tx.team.findFirst({
            where: {
              id: normalizedTeamId,
              organizationId: input.organizationId
            }
          })
        : Promise.resolve(null),
      tx.commissionPlan.findFirst({
        where: {
          id: input.commissionPlanId,
          organizationId: input.organizationId
        }
      })
    ]);

    if (normalizedMembershipId && !membership) {
      throw new Error("Selected agent was not found.");
    }

    if (normalizedTeamId && !team) {
      throw new Error("Selected team was not found.");
    }

    if (!plan) {
      throw new Error("Commission plan was not found.");
    }

    await tx.commissionPlanAssignment.updateMany({
      where: {
        organizationId: input.organizationId,
        ...(membership ? { membershipId: membership.id } : { teamId: team!.id }),
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }]
      },
      data: {
        effectiveTo: effectiveFrom
      }
    });

    const assignment = await tx.commissionPlanAssignment.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership?.officeId ?? team?.officeId ?? null,
        membershipId: membership?.id ?? null,
        teamId: team?.id ?? null,
        commissionPlanId: plan.id,
        effectiveFrom,
        effectiveTo
      }
    });

    if (membership) {
      await tx.agentProfile.upsert({
        where: {
          membershipId: membership.id
        },
        update: {
          commissionPlanName: plan.name
        },
        create: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? membership.officeId ?? null,
          membershipId: membership.id,
          commissionPlanName: plan.name
        }
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_plan",
      entityId: assignment.id,
      action: activityLogActions.commissionPlanAssigned,
      payload: {
        officeId: input.officeId ?? membership?.officeId ?? team?.officeId ?? null,
        objectLabel: `${plan.name} · ${membership ? `${membership.user.firstName} ${membership.user.lastName}` : team?.name ?? "Assignment target"}`,
        contextHref: membership ? `/office/agents/${membership.id}` : "/office/accounting#commissions",
        details: [
          `Plan: ${plan.name}`,
          `${membership ? "Agent" : "Team"}: ${membership ? `${membership.user.firstName} ${membership.user.lastName}` : team?.name ?? "—"}`,
          `Effective from: ${formatDateValue(effectiveFrom)}`
        ]
      }
    });

    return assignment.id;
  });
}

export async function calculateTransactionCommission(
  input: CalculateTransactionCommissionInput
): Promise<OfficeTransactionCommissionSnapshot | null> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      organizationId: input.organizationId
    },
    include: {
      office: true,
      ownerMembership: {
        include: {
          user: true
        }
      }
    }
  });

  if (!transaction) {
    return null;
  }

  const asOfDate = transaction.closingDate ?? transaction.updatedAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    const explicitPlan = input.commissionPlanId
      ? await tx.commissionPlan.findFirst({
          where: {
            id: input.commissionPlanId,
            organizationId: input.organizationId
          },
          include: {
            rules: {
              where: {
                isActive: true
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            }
          }
        })
      : null;

    const assignment = !explicitPlan && transaction.ownerMembershipId
      ? await resolveActiveCommissionPlanAssignment(tx, {
          organizationId: input.organizationId,
          officeId: input.officeId ?? transaction.officeId,
          membershipId: transaction.ownerMembershipId,
          effectiveAt: asOfDate
        })
      : null;

    const plan = explicitPlan ?? assignment?.commissionPlan ?? null;
    const previousRows = await tx.commissionCalculation.findMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      },
      orderBy: [{ createdAt: "asc" }]
    });

    const previousAgentRow = previousRows.find((row) => row.recipientType === "agent") ?? null;
    const grossCommission = transaction.grossCommission ?? new Prisma.Decimal(0);
    const transactionReferralFee = transaction.referralFee ?? new Prisma.Decimal(0);
    const transactionOfficeNet = transaction.officeNet ?? new Prisma.Decimal(0);
    const transactionAgentNet = transaction.agentNet ?? new Prisma.Decimal(0);
    const calculated = calculatePlanDrivenValues({
      grossCommission,
      transactionReferralFee,
      transactionOfficeNet,
      transactionAgentNet,
      plan
    });

    await tx.commissionCalculation.deleteMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      }
    });

    const rows: Prisma.CommissionCalculationCreateManyInput[] = [];
    const officeLabel = transaction.office?.name ?? "Brokerage";
    const note = parseOptionalText(input.notes) ?? parseOptionalText(transaction.financeNotes);

    rows.push({
      organizationId: input.organizationId,
      officeId: input.officeId ?? transaction.officeId ?? null,
      transactionId: transaction.id,
      membershipId: null,
      commissionPlanId: plan?.id ?? null,
      accountingTransactionId: null,
      recipientType: "brokerage",
      recipientRole: "brokerage",
      recipientName: officeLabel,
      grossCommission,
      referralFee: calculated.referralFee,
      fees: calculated.fees,
      officeNet: calculated.officeNet,
      agentNet: new Prisma.Decimal(0),
      statementAmount: calculated.officeNet,
      status: "calculated",
      notes: note,
      calculatedAt: new Date(),
      calculatedByMembershipId: input.actorMembershipId
    });

    if (transaction.ownerMembershipId && transaction.ownerMembership) {
      rows.push({
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        membershipId: transaction.ownerMembershipId,
        commissionPlanId: plan?.id ?? null,
        accountingTransactionId: null,
        recipientType: "agent",
        recipientRole: transaction.ownerMembership.role,
        recipientName: `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`,
        grossCommission,
        referralFee: calculated.referralFee,
        fees: calculated.fees,
        officeNet: new Prisma.Decimal(0),
        agentNet: calculated.agentNet,
        statementAmount: calculated.agentNet,
        status: "calculated",
        notes: note,
        calculatedAt: new Date(),
        calculatedByMembershipId: input.actorMembershipId
      });
    }

    if (calculated.referralFee.gt(0)) {
      rows.push({
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        membershipId: null,
        commissionPlanId: plan?.id ?? null,
        accountingTransactionId: null,
        recipientType: "referral",
        recipientRole: "referral",
        recipientName: transaction.companyReferralEmployeeName?.trim() || "Referral recipient",
        grossCommission,
        referralFee: calculated.referralFee,
        fees: new Prisma.Decimal(0),
        officeNet: new Prisma.Decimal(0),
        agentNet: new Prisma.Decimal(0),
        statementAmount: calculated.referralFee,
        status: "calculated",
        notes: note,
        calculatedAt: new Date(),
        calculatedByMembershipId: input.actorMembershipId
      });
    }

    await tx.commissionCalculation.createMany({
      data: rows
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_calculation",
      entityId: `${transaction.id}:${Date.now()}`,
      action: previousRows.length > 0 ? activityLogActions.commissionRecalculated : activityLogActions.commissionCalculated,
      payload: {
        officeId: transaction.officeId,
        transactionId: transaction.id,
        transactionLabel: buildTransactionLabel(transaction),
        objectLabel: buildTransactionLabel(transaction),
        contextHref: `/office/transactions/${transaction.id}#commission`,
        changes: buildCommissionChanges(previousAgentRow, {
          grossCommission,
          referralFee: calculated.referralFee,
          officeNet: calculated.officeNet,
          agentNet: calculated.agentNet,
          fees: calculated.fees
        }),
        details: [
          `Plan: ${plan?.name ?? "Manual / transaction finance"}`,
          `Agent net: ${formatCurrency(calculated.agentNet)}`,
          `Office net: ${formatCurrency(calculated.officeNet)}`
        ]
      }
    });
  });

  return getTransactionCommissionSnapshot(input.organizationId, input.transactionId, input.officeId ?? transaction.officeId ?? null);
}

export async function updateCommissionCalculationStatus(input: UpdateCommissionCalculationStatusInput) {
  const nextStatus = parseCommissionCalculationStatus(input.status);

  if (!nextStatus) {
    throw new Error("Unsupported commission status.");
  }

  const existing = await prisma.commissionCalculation.findFirst({
    where: {
      id: input.calculationId,
      organizationId: input.organizationId
    },
    include: {
      transaction: true
    }
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.commissionCalculation.update({
      where: {
        id: existing.id
      },
      data: {
        status: nextStatus,
        notes: parseOptionalText(input.notes) ?? existing.notes
      },
      include: {
        transaction: true,
        membership: {
          include: {
            user: true
          }
        },
        commissionPlan: true,
        accountingTransaction: true
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_calculation",
      entityId: saved.id,
      action: activityLogActions.commissionStatusUpdated,
      payload: {
        officeId: saved.officeId,
        transactionId: saved.transactionId,
        transactionLabel: buildTransactionLabel(saved.transaction),
        objectLabel: `${saved.commissionPlan?.name ?? "Manual commission"} · ${saved.recipientName ?? commissionRecipientLabelMap[saved.recipientType]}`,
        contextHref: `/office/transactions/${saved.transactionId}#commission`,
        changes: [
          {
            label: "Status",
            previousValue: commissionCalculationStatusLabelMap[existing.status],
            nextValue: commissionCalculationStatusLabelMap[nextStatus]
          }
        ],
        details: [
          `Recipient: ${saved.recipientName ?? commissionRecipientLabelMap[saved.recipientType]}`,
          `Statement amount: ${formatCurrency(saved.statementAmount)}`
        ]
      }
    });

    return saved;
  });

  return mapCommissionCalculationRow(updated);
}

export async function generateCommissionStatementSnapshot(
  input: GenerateCommissionStatementSnapshotInput
): Promise<OfficeCommissionStatementSnapshot | null> {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId
    },
    include: {
      user: true
    }
  });

  if (!membership) {
    return null;
  }

  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  const calculations = await prisma.commissionCalculation.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.officeId ? { officeId: input.officeId } : {}),
      membershipId: membership.id,
      ...(startDate || endDate
        ? {
            calculatedAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {})
            }
          }
        : {})
    },
    include: {
      transaction: true
    },
    orderBy: [{ calculatedAt: "desc" }],
    take: 100
  });

  const summary = buildCommissionStatementSnapshot(membership.id, `${membership.user.firstName} ${membership.user.lastName}`, calculations);

  if (input.actorMembershipId) {
    await recordActivityLogEvent(prisma, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_statement",
      entityId: randomUUID(),
      action: activityLogActions.commissionStatementGenerated,
      payload: {
        officeId: input.officeId ?? membership.officeId ?? null,
        objectLabel: `${membership.user.firstName} ${membership.user.lastName} commission statement`,
        contextHref: `/office/accounting#commissions`,
        details: [
          `Agent: ${membership.user.firstName} ${membership.user.lastName}`,
          `Statement-ready: ${summary.statementReadyLabel}`,
          `Payable: ${summary.payableLabel}`
        ]
      }
    });
  }

  return summary;
}

function buildCommissionStatementSnapshot(
  membershipId: string,
  agentLabel: string,
  calculations: Array<
    Prisma.CommissionCalculationGetPayload<{
      include: {
        transaction: true;
      };
    }>
  >
): OfficeCommissionStatementSnapshot {
  const totalForStatus = (status: CommissionCalculationStatus) =>
    calculations
      .filter((row) => row.status === status)
      .reduce((sum, row) => sum.plus(row.statementAmount), new Prisma.Decimal(0));
  const totalGross = calculations.reduce((sum, row) => sum.plus(row.grossCommission), new Prisma.Decimal(0));
  const totalOfficeNet = calculations.reduce((sum, row) => sum.plus(row.officeNet), new Prisma.Decimal(0));
  const totalAgentNet = calculations.reduce((sum, row) => sum.plus(row.agentNet), new Prisma.Decimal(0));

  return {
    membershipId,
    agentLabel,
    generatedAt: new Date().toISOString(),
    openCalculatedLabel: formatCurrency(totalForStatus("calculated").plus(totalForStatus("reviewed"))),
    statementReadyLabel: formatCurrency(totalForStatus("statement_ready")),
    payableLabel: formatCurrency(totalForStatus("payable")),
    paidLabel: formatCurrency(totalForStatus("paid")),
    totalGrossCommissionLabel: formatCurrency(totalGross),
    totalOfficeNetLabel: formatCurrency(totalOfficeNet),
    totalAgentNetLabel: formatCurrency(totalAgentNet),
    lineItems: calculations.map((calculation) => ({
      id: calculation.id,
      transactionId: calculation.transactionId,
      transactionLabel: buildTransactionLabel(calculation.transaction),
      transactionHref: `/office/transactions/${calculation.transactionId}`,
      status: commissionCalculationStatusLabelMap[calculation.status],
      statementAmountLabel: formatCurrency(calculation.statementAmount),
      calculatedAt: formatDateValue(calculation.calculatedAt)
    }))
  };
}

function sumAgentStatementAmounts(
  calculations: Array<{
    recipientType: CommissionRecipientType;
    status: CommissionCalculationStatus;
    statementAmount: Prisma.Decimal;
  }>,
  status: CommissionCalculationStatus
) {
  return calculations
    .filter((row) => row.recipientType === "agent" && row.status === status)
    .reduce((sum, row) => sum.plus(row.statementAmount), new Prisma.Decimal(0));
}

export async function getOfficeCommissionManagementSnapshot(
  input: GetOfficeCommissionManagementSnapshotInput
): Promise<OfficeCommissionManagementSnapshot> {
  const scopedTeams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      parentTeamId: true
    }
  });
  const teamHierarchyIndex = createTeamHierarchyIndex(scopedTeams);
  const selectedTeamIds = input.teamId?.trim() ? expandSelectedTeamIds(teamHierarchyIndex, input.teamId) : [];
  const teamPathLabelById = new Map(
    scopedTeams.map((team) => [team.id, buildTeamPathLabel(teamHierarchyIndex, team.id) || team.name])
  );
  const calculationWhere: Prisma.CommissionCalculationWhereInput = {
    organizationId: input.organizationId,
    ...(input.officeId ? { officeId: input.officeId } : {})
  };

  if (input.membershipId) {
    calculationWhere.membershipId = input.membershipId;
  }

  if (input.teamId?.trim()) {
    const membershipFilterId = input.membershipId?.trim() || "";
    const teamMemberships = await prisma.teamMembership.findMany({
      where: {
        organizationId: input.organizationId,
        teamId: {
          in: selectedTeamIds.length > 0 ? selectedTeamIds : ["__no_team__"]
        },
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      },
      select: {
        membershipId: true
      }
    });

    const teamMembershipIds = teamMemberships.map((row) => row.membershipId);
    const filteredMembershipIds =
      membershipFilterId
        ? teamMembershipIds.filter((membershipId) => membershipId === membershipFilterId)
        : teamMembershipIds;

    calculationWhere.membershipId = {
      in: filteredMembershipIds.length > 0 ? filteredMembershipIds : ["__no_membership__"]
    };
  }

  const parsedStatus = parseCommissionCalculationStatus(input.status);
  if (parsedStatus) {
    calculationWhere.status = parsedStatus;
  }

  if (input.commissionPlanId?.trim()) {
    calculationWhere.commissionPlanId = input.commissionPlanId.trim();
  }

  if (input.transactionId?.trim()) {
    calculationWhere.transactionId = input.transactionId.trim();
  }

  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  if (startDate || endDate) {
    calculationWhere.calculatedAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {})
    };
  }

  const assignmentWhere: Prisma.CommissionPlanAssignmentWhereInput = {
    organizationId: input.organizationId,
    AND: [
      ...(input.officeId
        ? [
            {
              OR: [{ officeId: input.officeId }, { officeId: null }]
            }
          ]
        : []),
      ...(
        input.membershipId?.trim() && input.teamId?.trim()
          ? [
              {
                OR: [
                  { membershipId: input.membershipId.trim() },
                  {
                    teamId: {
                      in: selectedTeamIds.length > 0 ? selectedTeamIds : ["__no_team__"]
                    }
                  }
                ]
              }
            ]
          : input.membershipId?.trim()
            ? [{ membershipId: input.membershipId.trim() }]
            : input.teamId?.trim()
              ? [
                  {
                    teamId: {
                      in: selectedTeamIds.length > 0 ? selectedTeamIds : ["__no_team__"]
                    }
                  }
                ]
              : []
      )
    ]
  };

  const [plans, assignments, calculations, memberships, transactions] = await Promise.all([
    prisma.commissionPlan.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {})
      },
      include: {
        rules: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        assignments: true
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    prisma.commissionPlanAssignment.findMany({
      where: assignmentWhere,
      include: {
        membership: {
          include: {
            user: true
          }
        },
        team: true,
        commissionPlan: true
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 100
    }),
    prisma.commissionCalculation.findMany({
      where: calculationWhere,
      include: {
        transaction: true,
        membership: {
          include: {
            user: true
          }
        },
        commissionPlan: true,
        accountingTransaction: true
      },
      orderBy: [{ calculatedAt: "desc" }, { createdAt: "desc" }],
      take: 200
    }),
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        status: "active",
        ...(input.officeId ? { officeId: input.officeId } : {})
      },
      include: {
        user: true
      },
      orderBy: [{ user: { firstName: "asc" } }]
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {})
      },
      select: {
        id: true,
        title: true,
        address: true,
        city: true,
        state: true
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 100
    })
  ]);

  const statementMembershipId = input.membershipId?.trim() || calculations.find((row) => row.membershipId)?.membershipId || "";
  const statement = statementMembershipId
    ? buildCommissionStatementSnapshot(
        statementMembershipId,
        memberships.find((membership) => membership.id === statementMembershipId)
          ? `${memberships.find((membership) => membership.id === statementMembershipId)!.user.firstName} ${memberships.find((membership) => membership.id === statementMembershipId)!.user.lastName}`
          : "Selected agent",
        calculations.filter((row) => row.membershipId === statementMembershipId)
      )
    : null;

  return {
    overview: {
      activePlansCount: plans.filter((plan) => plan.isActive).length,
      activeAssignmentsCount: assignments.filter((assignment) => !assignment.effectiveTo || assignment.effectiveTo >= new Date()).length,
      calculatedRowsCount: calculations.length,
      statementReadyLabel: formatCurrency(sumAgentStatementAmounts(calculations, "statement_ready")),
      payableLabel: formatCurrency(sumAgentStatementAmounts(calculations, "payable")),
      paidLabel: formatCurrency(sumAgentStatementAmounts(calculations, "paid"))
    },
    filters: {
      membershipId: input.membershipId ?? "",
      teamId: input.teamId ?? "",
      commissionPlanId: input.commissionPlanId ?? "",
      status: parsedStatus ?? "",
      transactionId: input.transactionId ?? "",
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      memberOptions: memberships.map((membership) => ({
        id: membership.id,
        label: `${membership.user.firstName} ${membership.user.lastName}`
      })),
      teamOptions: scopedTeams.map((team) => ({
        id: team.id,
        label: teamPathLabelById.get(team.id) ?? team.name
      })),
      commissionPlanOptions: plans.map((plan) => ({
        id: plan.id,
        label: plan.name
      })),
      transactionOptions: transactions.map((transaction) => ({
        id: transaction.id,
        label: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`
      }))
    },
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description ?? "",
      isActive: plan.isActive,
      calculationMode: commissionCalculationModeLabelMap[plan.calculationMode],
      calculationModeValue: plan.calculationMode,
      defaultCurrency: plan.defaultCurrency ?? "USD",
      assignmentCount: plan.assignments.length,
      rules: plan.rules.map(mapCommissionRule)
    })),
    assignments: assignments.map((assignment) => ({
      ...mapCommissionAssignmentRecord(assignment),
      targetLabel:
        assignment.membership
          ? `${assignment.membership.user.firstName} ${assignment.membership.user.lastName}`
          : assignment.teamId
            ? teamPathLabelById.get(assignment.teamId) ?? assignment.team?.name ?? "Unassigned target"
            : "Unassigned target"
    })),
    calculations: calculations.map(mapCommissionCalculationRow),
    statement
  };
}

export async function getTransactionCommissionSnapshot(
  organizationId: string,
  transactionId: string,
  officeId?: string | null
): Promise<OfficeTransactionCommissionSnapshot | null> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      organizationId
    },
    include: {
      ownerMembership: {
        include: {
          user: true
        }
      },
      office: true
    }
  });

  if (!transaction) {
    return null;
  }

  const [assignment, plans, calculations] = await Promise.all([
    transaction.ownerMembershipId
      ? resolveActiveCommissionPlanAssignment(prisma, {
          organizationId,
          officeId: officeId ?? transaction.officeId,
          membershipId: transaction.ownerMembershipId,
          effectiveAt: transaction.closingDate ?? transaction.updatedAt ?? new Date()
        })
      : Promise.resolve(null),
    listCommissionPlanOptions(organizationId, officeId ?? transaction.officeId),
    prisma.commissionCalculation.findMany({
      where: {
        organizationId,
        transactionId
      },
      include: {
        transaction: true,
        membership: {
          include: {
            user: true
          }
        },
        commissionPlan: true,
        accountingTransaction: true
      },
      orderBy: [{ calculatedAt: "desc" }, { createdAt: "desc" }]
    })
  ]);

  const feesTotal = calculations.reduce((sum, row) => sum.plus(row.fees), new Prisma.Decimal(0));
  const statementReadyTotal = sumAgentStatementAmounts(calculations, "statement_ready");
  const payableTotal = sumAgentStatementAmounts(calculations, "payable");
  const planLabel =
    calculations[0]?.commissionPlan?.name ??
    assignment?.commissionPlan.name ??
    (transaction.ownerMembership
      ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName} default`
      : "Manual / transaction finance");

  return {
    transactionId: transaction.id,
    planLabel,
    planId: calculations[0]?.commissionPlanId ?? assignment?.commissionPlanId ?? "",
    planSourceLabel: calculations[0]?.commissionPlanId ? "Used for latest calculation" : assignment?.sourceLabel ?? "Manual / no plan assignment",
    planSourceValue: calculations[0]?.commissionPlanId ? "manual" : assignment?.sourceType ?? "manual",
    availablePlans: plans,
    calculations: calculations.map(mapCommissionCalculationRow),
    summary: {
      grossCommissionLabel: formatCurrency(transaction.grossCommission),
      referralFeeLabel: formatCurrency(transaction.referralFee),
      feesLabel: formatCurrency(feesTotal),
      officeNetLabel: formatCurrency(transaction.officeNet),
      agentNetLabel: formatCurrency(transaction.agentNet),
      statementReadyLabel: formatCurrency(statementReadyTotal),
      payableLabel: formatCurrency(payableTotal)
    }
  };
}

export async function getAgentCommissionSummary(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
}): Promise<OfficeAgentCommissionSummary> {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId
    },
    include: {
      agentProfile: true
    }
  });

  if (!membership) {
    return {
      activePlanId: "",
      activePlanLabel: "",
      activePlanSourceLabel: "",
      calculatedCount: 0,
      statementReadyLabel: formatCurrency(0),
      payableLabel: formatCurrency(0),
      paidLabel: formatCurrency(0),
      recentCalculations: []
    };
  }

  const assignment = await resolveActiveCommissionPlanAssignment(prisma, {
    organizationId: input.organizationId,
    officeId: input.officeId ?? membership.officeId,
    membershipId: membership.id,
    effectiveAt: new Date()
  });

  const calculations = await prisma.commissionCalculation.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: membership.id
    },
    include: {
      transaction: true,
      membership: {
        include: {
          user: true
        }
      },
      commissionPlan: true,
      accountingTransaction: true
    },
    orderBy: [{ calculatedAt: "desc" }],
    take: 5
  });

  const allTotals = await prisma.commissionCalculation.groupBy({
    by: ["status"],
    where: {
      organizationId: input.organizationId,
      membershipId: membership.id
    },
    _sum: {
      statementAmount: true
    },
    _count: {
      _all: true
    }
  });

  const getStatusTotal = (status: CommissionCalculationStatus) =>
    allTotals.find((entry) => entry.status === status)?._sum.statementAmount ?? new Prisma.Decimal(0);
  const totalCount = allTotals.reduce((sum, entry) => sum + entry._count._all, 0);

  return {
    activePlanId: assignment?.commissionPlanId ?? "",
    activePlanLabel: assignment?.commissionPlan.name ?? membership.agentProfile?.commissionPlanName ?? "",
    activePlanSourceLabel: assignment?.sourceLabel ?? "",
    calculatedCount: totalCount,
    statementReadyLabel: formatCurrency(getStatusTotal("statement_ready")),
    payableLabel: formatCurrency(getStatusTotal("payable")),
    paidLabel: formatCurrency(getStatusTotal("paid")),
    recentCalculations: calculations.map(mapCommissionCalculationRow)
  };
}
