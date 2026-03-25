import { randomUUID } from "node:crypto";
import {
  CommissionCalculationMode,
  CommissionCalculationStatus,
  CommissionPlanRuleType,
  CommissionRecipientType,
  CommissionRuleFeeType,
  UserRole,
  Prisma,
  TransactionFinanceApprovalStatus,
  TransactionFinanceCalculationType,
  TransactionFinanceFeeType,
  TransactionFinanceVersionSource,
  TeamMembershipRole
} from "@prisma/client";
import { resolveOfficeDataScope } from "./access";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import {
  backfillCommissionSplitTemplatesFromLegacy,
  backfillMembershipCommissionSettingsFromLegacy,
  buildCommissionSplitLabel,
  listCommissionSplitTemplates,
  listCurrentMembershipCommissionSettings,
  resolveActiveMembershipCommissionSetting,
  type OfficeCommissionSplitTemplateRecord,
  type OfficeMembershipCommissionSettingRecord
} from "./commission-defaults";
import { buildTeamMembershipHierarchyMap, buildTeamPathLabel, createTeamHierarchyIndex, expandSelectedTeamIds, formatTeamMembershipRoleLabel } from "./team-hierarchy";

export type OfficeCommissionCalculationStatusLabel =
  | "Draft"
  | "Calculated"
  | "Reviewed"
  | "Statement ready"
  | "Payable"
  | "Paid";

export type OfficeCommissionCalculationRecipientLabel = "Agent" | "Brokerage" | "Referral";
export type OfficeTransactionFinanceCalculationLabel = "Pre-Split" | "Post-Split" | "Reimbursement";
export type OfficeTransactionFinanceApprovalLabel = "Not required" | "Pending approval" | "Approved";

export type OfficeTransactionFinanceFeeRecord = {
  id: string;
  feeTypeValue: TransactionFinanceFeeType;
  feeTypeLabel: string;
  defaultRate: string;
  rate: string;
  amount: string;
  defaultCalculationTypeValue: TransactionFinanceCalculationType;
  defaultCalculationTypeLabel: OfficeTransactionFinanceCalculationLabel;
  selectedCalculationTypeValue: TransactionFinanceCalculationType;
  selectedCalculationTypeLabel: OfficeTransactionFinanceCalculationLabel;
  approvalRequired: boolean;
  approvalStatusValue: TransactionFinanceApprovalStatus;
  approvalStatus: OfficeTransactionFinanceApprovalLabel;
  notes: string;
  approvalHelperText: string;
  prerequisiteHelperText: string;
};

export type OfficeTransactionFinancePrerequisiteSnapshot = {
  clientReferralFormApproved: boolean;
  rebateAgreementSigned: boolean;
  rebateGoogleFormSubmitted: boolean;
  clientReferralReady: boolean;
  rebateReady: boolean;
};

export type OfficeTransactionCommissionStakeholderRow = {
  key: string;
  membershipId: string;
  recipientLabel: string;
  recipientRole: string;
  isManualParticipant: boolean;
  sharePercent: string;
  sharePercentLabel: string;
  baseAmount: string;
  baseAmountLabel: string;
  postSplitAdjustment: string;
  postSplitAdjustmentLabel: string;
  reimbursementAdjustment: string;
  reimbursementAdjustmentLabel: string;
  finalAmount: string;
  finalAmountLabel: string;
};

export type OfficeTransactionFinanceVersionRecord = {
  id: string;
  versionNumber: number;
  sourceTypeValue: TransactionFinanceVersionSource;
  sourceTypeLabel: string;
  createdAt: string;
  createdByLabel: string;
  notes: string;
  overrideReason: string;
  finalAgentNetLabel: string;
  finalOfficeNetLabel: string;
  isCurrent: boolean;
};

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

export type OfficeTransactionCommissionManualParticipantOption = {
  membershipId: string;
  recipientLabel: string;
  recipientRole: string;
  officeLabel: string;
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
  isCompanyRow: boolean;
  recipientType: string;
  recipientTypeValue: CommissionRecipientType;
  recipientLabel: string;
  recipientRole: string;
  commissionPlanId: string;
  commissionPlanLabel: string;
  commissionPlanDetailLabel: string;
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
  activeSplitTemplatesCount: number;
  membersWithDefaultSplitCount: number;
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
  splitTemplates: OfficeCommissionSplitTemplateRecord[];
  memberDefaults: OfficeMembershipCommissionSettingRecord[];
  advancedReviewItems: string[];
  plans: OfficeCommissionPlanRecord[];
  assignments: OfficeCommissionAssignmentRecord[];
  calculations: OfficeCommissionCalculationRow[];
  statement: OfficeCommissionStatementSnapshot | null;
};

export type OfficeTransactionCommissionSnapshot = {
  transactionId: string;
  mode: "default_split_chain" | "legacy_plan";
  defaultSplitLabel: string;
  defaultSplitSourceLabel: string;
  hiddenRowCount: number;
  visibilityNote: string;
  planLabel: string;
  planId: string;
  planSourceLabel: string;
  planSourceValue: OfficeCommissionAssignmentSourceType | "manual";
  availablePlans: OfficeCommissionPlanOption[];
  manualParticipantOptions: OfficeTransactionCommissionManualParticipantOption[];
  manualParticipantLockActive: boolean;
  feeBreakdown: OfficeTransactionFinanceFeeRecord[];
  stakeholderBreakdown: OfficeTransactionCommissionStakeholderRow[];
  versionHistory: OfficeTransactionFinanceVersionRecord[];
  approvalBlockers: string[];
  calculations: OfficeCommissionCalculationRow[];
  summary: {
    grossCommissionLabel: string;
    referralFeeLabel: string;
    feesLabel: string;
    officeNetLabel: string;
    agentNetLabel: string;
    preSplitTotalLabel: string;
    postSplitTotalLabel: string;
    netCommissionBaseLabel: string;
    reimbursementLabel: string;
    currentVersionLabel: string;
    statementReadyLabel: string;
    payableLabel: string;
  };
};

export type OfficeAgentCommissionSummary = {
  defaultSettingId: string;
  defaultSplitLabel: string;
  defaultSplitSourceLabel: string;
  defaultAgentPercentLabel: string;
  defaultCompanyPercentLabel: string;
  defaultEffectiveFrom: string;
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
  viewerMembershipId?: string;
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

export type OverrideTransactionCommissionInput = {
  organizationId: string;
  officeId?: string | null;
  transactionId: string;
  overrideReason: string;
  notes?: string;
  stakeholderRows: Array<{
    key: string;
    membershipId: string;
    amount: string;
  }>;
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

const transactionFinanceCalculationTypeLabelMap: Record<TransactionFinanceCalculationType, OfficeTransactionFinanceCalculationLabel> = {
  pre_split: "Pre-Split",
  post_split: "Post-Split",
  reimbursement: "Reimbursement"
};

const transactionFinanceApprovalStatusLabelMap: Record<TransactionFinanceApprovalStatus, OfficeTransactionFinanceApprovalLabel> = {
  not_required: "Not required",
  pending: "Pending approval",
  approved: "Approved"
};

const transactionFinanceVersionSourceLabelMap: Record<TransactionFinanceVersionSource, string> = {
  calculated: "Calculated",
  overridden: "Manual override"
};

const userRoleLabelMap: Record<UserRole, string> = {
  owner: "Owner",
  office_admin: "Office Admin",
  accountant: "Accountant",
  human_resources: "Human Resources",
  team_lead: "Team Lead",
  agent: "Agent",
  office_manager: "Office Manager",
  office_user: "Office User"
};

type TransactionFinanceFeeDefinition = {
  feeType: TransactionFinanceFeeType;
  label: string;
  defaultRate: Prisma.Decimal | null;
  defaultCalculationType: TransactionFinanceCalculationType;
  maxAutoApprovedRate: Prisma.Decimal | null;
  approvalHelperText: string;
  prerequisiteHelperText: string;
};

const channelDevelopmentApprovalPrompt = "Over 20% requires Cathy approval email and pay@acreny.us cc before it can be calculated.";
const financeFeeDefinitions: TransactionFinanceFeeDefinition[] = [
  {
    feeType: "rebate",
    label: "Rebate",
    defaultRate: new Prisma.Decimal(20),
    defaultCalculationType: "pre_split",
    maxAutoApprovedRate: new Prisma.Decimal(20),
    approvalHelperText: "Over 20% requires Cathy approval email and pay@acreny.us cc before it can be calculated.",
    prerequisiteHelperText: "Requires signed rebate agreement and submitted rebate Google Form."
  },
  {
    feeType: "client_referral",
    label: "Client Referral",
    defaultRate: new Prisma.Decimal(20),
    defaultCalculationType: "pre_split",
    maxAutoApprovedRate: new Prisma.Decimal(20),
    approvalHelperText: "Over 20% requires Cathy approval email and pay@acreny.us cc before it can be calculated.",
    prerequisiteHelperText: "Requires signed and approved Agent Referral Form."
  },
  {
    feeType: "external_referral",
    label: "External Referral",
    defaultRate: null,
    defaultCalculationType: "post_split",
    maxAutoApprovedRate: null,
    approvalHelperText: "No automatic approval threshold.",
    prerequisiteHelperText: ""
  },
  {
    feeType: "company_referral",
    label: "Company Referral",
    defaultRate: new Prisma.Decimal(20),
    defaultCalculationType: "post_split",
    maxAutoApprovedRate: null,
    approvalHelperText: "No automatic approval threshold.",
    prerequisiteHelperText: ""
  },
  {
    feeType: "channel_development_fee",
    label: "Channel Development Fee",
    defaultRate: null,
    defaultCalculationType: "post_split",
    maxAutoApprovedRate: new Prisma.Decimal(20),
    approvalHelperText: channelDevelopmentApprovalPrompt,
    prerequisiteHelperText: ""
  },
  {
    feeType: "reimbursement",
    label: "Reimbursement",
    defaultRate: null,
    defaultCalculationType: "reimbursement",
    maxAutoApprovedRate: null,
    approvalHelperText: "Calculated separately from split math.",
    prerequisiteHelperText: "Company reimburses up to 50% of the amount, capped at 10% of final agent net."
  }
];

const financeFeeDefinitionByType = new Map(financeFeeDefinitions.map((definition) => [definition.feeType, definition]));

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function formatPercentLabel(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "0";
  }

  if (Number.isInteger(numericValue)) {
    return String(numericValue);
  }

  return numericValue.toFixed(2).replace(/\.?0+$/, "");
}

function formatDateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function formatFallbackRoleLabel(value: string) {
  return value
    .split("_")
    .map((part) => (part ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}` : ""))
    .join(" ")
    .trim();
}

function formatRecipientRoleLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  if (value === "team_leader" || value === "junior_team_leader" || value === "member") {
    return formatTeamMembershipRoleLabel(value);
  }

  if (value in userRoleLabelMap) {
    return userRoleLabelMap[value as UserRole];
  }

  if (value === "brokerage") {
    return "Brokerage";
  }

  return formatFallbackRoleLabel(value);
}

function formatMembershipParticipantRole(input: {
  role: UserRole;
  title?: string | null;
}) {
  const title = input.title?.trim();

  if (title) {
    return title;
  }

  return formatRecipientRoleLabel(input.role);
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

function getTransactionFinanceFeeDefinition(feeType: TransactionFinanceFeeType) {
  const definition = financeFeeDefinitionByType.get(feeType);

  if (!definition) {
    throw new Error(`Unsupported transaction finance fee type: ${feeType}`);
  }

  return definition;
}

function getTransactionFinanceFeeSortOrder(feeType: TransactionFinanceFeeType) {
  return financeFeeDefinitions.findIndex((definition) => definition.feeType === feeType);
}

function sortTransactionFinanceFees<T extends { feeType: TransactionFinanceFeeType }>(fees: T[]) {
  return [...fees].sort((left, right) => getTransactionFinanceFeeSortOrder(left.feeType) - getTransactionFinanceFeeSortOrder(right.feeType));
}

function parseLegacyAdditionalFieldDecimal(value: Prisma.JsonValue | null | undefined) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  return parseOptionalDecimal(String(value));
}

function deriveRateFromAmount(amount: Prisma.Decimal | null | undefined, grossCommission: Prisma.Decimal | null | undefined) {
  if (!amount || !grossCommission || grossCommission.lte(0)) {
    return null;
  }

  return amount.mul(new Prisma.Decimal(100)).div(grossCommission);
}

function normalizeFinanceFeeApprovalStatus(input: {
  definition: TransactionFinanceFeeDefinition;
  rate: Prisma.Decimal | null;
  requestedStatus: TransactionFinanceApprovalStatus | null | undefined;
}) {
  const approvalRequired = Boolean(
    input.definition.maxAutoApprovedRate &&
      input.rate &&
      input.rate.gt(input.definition.maxAutoApprovedRate)
  );

  if (!approvalRequired) {
    return {
      approvalRequired: false,
      approvalStatus: "not_required" as const
    };
  }

  return {
    approvalRequired: true,
    approvalStatus: input.requestedStatus === "approved" ? ("approved" as const) : ("pending" as const)
  };
}

export function normalizeTransactionFinanceFeeForPersistence(input: {
  feeType: TransactionFinanceFeeType;
  grossCommission: Prisma.Decimal | null;
  existingRate: Prisma.Decimal | null;
  existingAmount: Prisma.Decimal | null;
  existingCalculationType: TransactionFinanceCalculationType;
  existingApprovalStatus: TransactionFinanceApprovalStatus;
  rate: Prisma.Decimal | null;
  amount: Prisma.Decimal | null;
  selectedCalculationType: TransactionFinanceCalculationType | null;
  requestedApprovalStatus: TransactionFinanceApprovalStatus | null;
  notes: string | null;
}) {
  const definition = getTransactionFinanceFeeDefinition(input.feeType);
  const selectedCalculationType =
    definition.defaultCalculationType === "reimbursement"
      ? "reimbursement"
      : input.selectedCalculationType ?? input.existingCalculationType;
  let nextRate = input.rate;
  let nextAmount = input.amount;

  if (input.rate && input.amount === null && input.grossCommission && input.grossCommission.gt(0)) {
    nextAmount = input.grossCommission.mul(input.rate).div(new Prisma.Decimal(100));
  } else if (!input.rate && input.amount && input.grossCommission && input.grossCommission.gt(0)) {
    nextRate = deriveRateFromAmount(input.amount, input.grossCommission) ?? nextRate;
  }

  const approval = normalizeFinanceFeeApprovalStatus({
    definition,
    rate: nextRate,
    requestedStatus: input.requestedApprovalStatus ?? input.existingApprovalStatus
  });

  return {
    rate: nextRate,
    amount: nextAmount,
    selectedCalculationType,
    approvalRequired: approval.approvalRequired,
    approvalStatus: approval.approvalStatus,
    notes: input.notes
  };
}

function buildInitialTransactionFinanceFeeSeed(input: {
  feeType: TransactionFinanceFeeType;
  grossCommission: Prisma.Decimal | null;
  referralFee: Prisma.Decimal | null;
  companyReferral: boolean;
  additionalFields: Prisma.JsonValue | null | undefined;
}) {
  const additionalFields =
    input.additionalFields && typeof input.additionalFields === "object" && !Array.isArray(input.additionalFields)
      ? (input.additionalFields as Record<string, Prisma.JsonValue>)
      : {};

  if (input.feeType === "rebate") {
    return parseLegacyAdditionalFieldDecimal(additionalFields.rebate);
  }

  if (input.feeType === "reimbursement") {
    return parseLegacyAdditionalFieldDecimal(additionalFields.reimbursement);
  }

  if (input.referralFee?.gt(0)) {
    if (input.companyReferral && input.feeType === "company_referral") {
      return input.referralFee;
    }

    if (!input.companyReferral && input.feeType === "client_referral") {
      return input.referralFee;
    }
  }

  return null;
}

export async function ensureTransactionFinanceFees(
  tx: ScopedPrismaClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    transactionId: string;
    grossCommission: Prisma.Decimal | null;
    referralFee: Prisma.Decimal | null;
    companyReferral: boolean;
    additionalFields?: Prisma.JsonValue | null;
  }
) {
  const existingFees = await tx.transactionFinanceFee.findMany({
    where: {
      organizationId: input.organizationId,
      transactionId: input.transactionId
    }
  });
  const existingFeeTypes = new Set(existingFees.map((fee) => fee.feeType));

  if (existingFees.length < financeFeeDefinitions.length) {
    const missingDefinitions = financeFeeDefinitions.filter((definition) => !existingFeeTypes.has(definition.feeType));

    if (missingDefinitions.length > 0) {
      await tx.transactionFinanceFee.createMany({
        data: missingDefinitions.map((definition) => {
          const seededAmount = buildInitialTransactionFinanceFeeSeed({
            feeType: definition.feeType,
            grossCommission: input.grossCommission,
            referralFee: input.referralFee,
            companyReferral: input.companyReferral,
            additionalFields: input.additionalFields ?? null
          });
          const seededRate = seededAmount
            ? deriveRateFromAmount(seededAmount, input.grossCommission) ?? definition.defaultRate
            : null;
          const approval = normalizeFinanceFeeApprovalStatus({
            definition,
            rate: seededRate,
            requestedStatus: null
          });

          return {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            transactionId: input.transactionId,
            feeType: definition.feeType,
            defaultRate: definition.defaultRate,
            rate: seededRate,
            amount: seededAmount,
            defaultCalculationType: definition.defaultCalculationType,
            selectedCalculationType: definition.defaultCalculationType,
            approvalRequired: approval.approvalRequired,
            approvalStatus: approval.approvalStatus
          };
        })
      });
    }
  }

  const fees = await tx.transactionFinanceFee.findMany({
    where: {
      organizationId: input.organizationId,
      transactionId: input.transactionId
    }
  });

  return sortTransactionFinanceFees(fees);
}

export function mapTransactionFinanceFeeRecord(
  fee: {
    id: string;
    feeType: TransactionFinanceFeeType;
    defaultRate: Prisma.Decimal | null;
    rate: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    defaultCalculationType: TransactionFinanceCalculationType;
    selectedCalculationType: TransactionFinanceCalculationType;
    approvalRequired: boolean;
    approvalStatus: TransactionFinanceApprovalStatus;
    notes: string | null;
  },
  options?: {
    restrictAmounts?: boolean;
  }
): OfficeTransactionFinanceFeeRecord {
  const definition = getTransactionFinanceFeeDefinition(fee.feeType);
  const restricted = Boolean(options?.restrictAmounts);

  return {
    id: fee.id,
    feeTypeValue: fee.feeType,
    feeTypeLabel: definition.label,
    defaultRate: restricted ? "Restricted" : decimalToString(fee.defaultRate),
    rate: restricted ? "Restricted" : decimalToString(fee.rate),
    amount: restricted ? "Restricted" : decimalToString(fee.amount),
    defaultCalculationTypeValue: fee.defaultCalculationType,
    defaultCalculationTypeLabel: transactionFinanceCalculationTypeLabelMap[fee.defaultCalculationType],
    selectedCalculationTypeValue: fee.selectedCalculationType,
    selectedCalculationTypeLabel: transactionFinanceCalculationTypeLabelMap[fee.selectedCalculationType],
    approvalRequired: fee.approvalRequired,
    approvalStatusValue: fee.approvalStatus,
    approvalStatus: transactionFinanceApprovalStatusLabelMap[fee.approvalStatus],
    notes: fee.notes ?? "",
    approvalHelperText: definition.approvalHelperText,
    prerequisiteHelperText: definition.prerequisiteHelperText
  };
}

export function buildTransactionFinancePrerequisiteSnapshot(input: {
  clientReferralFormApproved: boolean;
  rebateAgreementSigned: boolean;
  rebateGoogleFormSubmitted: boolean;
}): OfficeTransactionFinancePrerequisiteSnapshot {
  return {
    clientReferralFormApproved: input.clientReferralFormApproved,
    rebateAgreementSigned: input.rebateAgreementSigned,
    rebateGoogleFormSubmitted: input.rebateGoogleFormSubmitted,
    clientReferralReady: input.clientReferralFormApproved,
    rebateReady: input.rebateAgreementSigned && input.rebateGoogleFormSubmitted
  };
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

type StoredTransactionCommissionChainMember = {
  membershipId: string;
  membershipLabel: string;
  recipientRole: string;
  recipientRoleValue: string;
  agentPercent: string;
};

type StoredTransactionCommissionContext = {
  version: 2;
  mode: "default_split_chain";
  sourceDate: string;
  lockedAt: string;
  ownerMembershipId: string;
  members: StoredTransactionCommissionChainMember[];
};

type StoredTransactionFinanceFeeBreakdownRow = {
  feeType: TransactionFinanceFeeType;
  label: string;
  calculationType: TransactionFinanceCalculationType;
  rate: string;
  amount: string;
  approvalRequired: boolean;
  approvalStatus: TransactionFinanceApprovalStatus;
  notes: string;
};

type StoredTransactionFinanceStakeholderBreakdownRow = {
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

type DerivedTransactionCommissionChainMember = {
  membershipId: string;
  membershipLabel: string;
  recipientRole: string;
  recipientRoleValue: string;
  agentPercent: Prisma.Decimal;
  sourceLabel: string;
};

function parseStoredTransactionCommissionContext(value: Prisma.JsonValue | null | undefined): StoredTransactionCommissionContext | null {
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

function buildStoredTransactionCommissionContext(input: {
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

function parseStoredTransactionFinanceFeeBreakdown(value: Prisma.JsonValue | null | undefined) {
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

function parseStoredTransactionFinanceStakeholderBreakdown(value: Prisma.JsonValue | null | undefined) {
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

function mapStoredTransactionFinanceStakeholderRow(
  row: StoredTransactionFinanceStakeholderBreakdownRow
): OfficeTransactionCommissionStakeholderRow {
  return {
    key: row.key,
    membershipId: row.membershipId,
    recipientLabel: row.recipientLabel,
    recipientRole: row.recipientRole,
    isManualParticipant: row.isManualParticipant,
    sharePercent: row.sharePercent,
    sharePercentLabel: row.isManualParticipant ? "Manual" : `${formatPercentLabel(row.sharePercent)}%`,
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

function getCommissionRoleValue(teamMembershipRole: TeamMembershipRole | null | undefined) {
  if (teamMembershipRole === "team_leader" || teamMembershipRole === "junior_team_leader" || teamMembershipRole === "member") {
    return teamMembershipRole;
  }

  return "agent";
}

function getCommissionRoleLabel(teamMembershipRole: TeamMembershipRole | null | undefined) {
  if (!teamMembershipRole) {
    return "Agent";
  }

  return formatTeamMembershipRoleLabel(teamMembershipRole);
}

async function buildDefaultTransactionCommissionChain(
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

  if (storedContext && storedContext.ownerMembershipId === input.ownerMembershipId) {
    return storedContext.members.map((member) => ({
      membershipId: member.membershipId,
      membershipLabel: member.membershipLabel,
      recipientRole: member.recipientRole,
      recipientRoleValue: member.recipientRoleValue,
      agentPercent: new Prisma.Decimal(member.agentPercent),
      sourceLabel: "Locked on transaction"
    }));
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
    throw new Error("Each membership can only belong to one active team per organization. Resolve team assignments before calculating commissions.");
  }

  const chain: DerivedTransactionCommissionChainMember[] = [];

  async function pushChainMember(
    membershipId: string,
    membershipLabel: string,
    recipientRole: string,
    recipientRoleValue: string
  ) {
    await backfillMembershipCommissionSettingsFromLegacy(input.organizationId, input.officeId, [membershipId], tx);

    const setting = await resolveActiveMembershipCommissionSetting(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId,
      membershipId,
      effectiveAt: input.effectiveAt
    });

    chain.push({
      membershipId,
      membershipLabel,
      recipientRole,
      recipientRoleValue,
      agentPercent: setting?.agentPercent ?? new Prisma.Decimal(0),
      sourceLabel: setting?.sourceLabel ?? "No default split configured"
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

function buildDefaultSplitCalculationRows(input: {
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

type NormalizedTransactionFinanceFee = {
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

type ComputedTransactionFinanceStakeholderRow = {
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

type ComputedTransactionFinanceResult = {
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

function normalizeTransactionFinanceFees(
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
    fees.map((fee) => {
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

function buildTransactionFinanceBlockingIssues(input: {
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
      blockers.push("Client Referral requires a signed and approved Agent Referral Form before calculation.");
    }

    if (fee.feeType === "rebate" && !input.prerequisites.rebateReady) {
      blockers.push("Rebate requires a signed Rebate Agreement and submitted Rebate Google Form before calculation.");
    }
  }

  return blockers;
}

function buildStoredTransactionFinanceFeeBreakdownRows(fees: NormalizedTransactionFinanceFee[]): StoredTransactionFinanceFeeBreakdownRow[] {
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

function buildStoredTransactionFinanceStakeholderBreakdownRows(
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

function buildCommissionStakeholderKey(input: {
  recipientType: CommissionRecipientType;
  membershipId: string | null;
}) {
  if (input.recipientType === "brokerage") {
    return "company";
  }

  return input.membershipId ?? "";
}

function normalizeCurrencyDecimal(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

function hasManualParticipantRows(rows: Array<{ isManualParticipant: boolean }>) {
  return rows.some((row) => row.isManualParticipant);
}

function sumStakeholderFinalAmounts(rows: Array<{ finalAmount: string }>) {
  return rows.reduce(
    (sum, row) => sum.plus(normalizeCurrencyDecimal(parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0))),
    new Prisma.Decimal(0)
  );
}

function findPrimaryAgentStakeholderRow(
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

function buildPreviousCommissionChangeBaseline(
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

function formatMembershipFullName(input: {
  firstName: string;
  lastName: string;
  email?: string | null;
}) {
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  return fullName || input.email?.trim() || "Unnamed member";
}

function buildManualParticipantOption(input: {
  membershipId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
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
  const officeLabel = input.officeName?.trim() || "All offices";

  return {
    membershipId: input.membershipId,
    recipientLabel,
    recipientRole,
    officeLabel,
    label: `${recipientLabel} · ${recipientRole} · ${officeLabel}`
  } satisfies OfficeTransactionCommissionManualParticipantOption;
}

function calculateTransactionFinanceResult(input: {
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

function filterVisibleCommissionRows(
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

function buildLegacyReviewItems(input: {
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

function buildTransactionCommissionSummary(
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

function mapTransactionFinanceVersionRecord(
  version: Prisma.TransactionFinanceCalculationVersionGetPayload<{
    include: {
      createdByMembership: {
        include: {
          user: true;
        };
      };
    };
  }>
): OfficeTransactionFinanceVersionRecord {
  const createdByLabel =
    version.createdByMembership
      ? `${version.createdByMembership.user.firstName} ${version.createdByMembership.user.lastName}`.trim()
      : "System";

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    sourceTypeValue: version.sourceType,
    sourceTypeLabel: transactionFinanceVersionSourceLabelMap[version.sourceType],
    createdAt: formatDateValue(version.createdAt),
    createdByLabel,
    notes: version.notes ?? "",
    overrideReason: version.overrideReason ?? "",
    finalAgentNetLabel: formatCurrency(version.finalAgentNet),
    finalOfficeNetLabel: formatCurrency(version.finalOfficeNet),
    isCurrent: version.isCurrent
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
        contextHref: membership ? `/office/agents/${membership.id}` : "/office/settings/commission-plans",
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

  if (transaction.grossCommission === null) {
    throw new Error("Set Gross commission in Finance before calculating commission.");
  }

  const effectiveAt = transaction.createdAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    const currentVersion = await tx.transactionFinanceCalculationVersion.findFirst({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id,
        isCurrent: true
      },
      orderBy: [{ versionNumber: "desc" }]
    });

    if (
      currentVersion &&
      hasManualParticipantRows(parseStoredTransactionFinanceStakeholderBreakdown(currentVersion.stakeholderBreakdown))
    ) {
      throw new Error("This transaction has manual override participants. Continue using Override instead of Recalculate.");
    }

    const storedContext = parseStoredTransactionCommissionContext(transaction.commissionContext);
    const fees = await ensureTransactionFinanceFees(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? transaction.officeId,
      transactionId: transaction.id,
      grossCommission: transaction.grossCommission,
      referralFee: transaction.referralFee,
      companyReferral: transaction.companyReferral,
      additionalFields: transaction.additionalFields
    });
    const previousRows = await tx.commissionCalculation.findMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      },
      orderBy: [{ createdAt: "asc" }]
    });
    const previousAgentRow = buildPreviousCommissionChangeBaseline({
      rows: previousRows,
      ownerMembershipId: transaction.ownerMembershipId,
      fallbackGrossCommission: new Prisma.Decimal(0),
      fallbackReferralFee: new Prisma.Decimal(0),
      fallbackOfficeNet: new Prisma.Decimal(0),
      fallbackAgentNet: new Prisma.Decimal(0)
    });
    const grossCommission = transaction.grossCommission ?? new Prisma.Decimal(0);
    const note = parseOptionalText(input.notes) ?? parseOptionalText(transaction.financeNotes);
    const chain =
      transaction.ownerMembershipId
        ? await buildDefaultTransactionCommissionChain(tx, {
            organizationId: input.organizationId,
            officeId: input.officeId ?? transaction.officeId,
            ownerMembershipId: transaction.ownerMembershipId,
            effectiveAt,
            transactionCommissionContext: transaction.commissionContext
          })
        : [];
    const prerequisites = buildTransactionFinancePrerequisiteSnapshot({
      clientReferralFormApproved: transaction.clientReferralFormApproved,
      rebateAgreementSigned: transaction.rebateAgreementSigned,
      rebateGoogleFormSubmitted: transaction.rebateGoogleFormSubmitted
    });
    const calculated = calculateTransactionFinanceResult({
      grossCommission,
      fees,
      chain,
      prerequisites
    });

    if (calculated.approvalBlockers.length > 0) {
      throw new Error(calculated.approvalBlockers.join(" "));
    }

    if (transaction.ownerMembershipId && (!storedContext || storedContext.ownerMembershipId !== transaction.ownerMembershipId)) {
      await tx.transaction.update({
        where: {
          id: transaction.id
        },
        data: {
          commissionContext: buildStoredTransactionCommissionContext({
            ownerMembershipId: transaction.ownerMembershipId,
            effectiveAt,
            members: chain
          }) satisfies Prisma.InputJsonValue
        }
      });
    }

    const previousVersion = await tx.transactionFinanceCalculationVersion.findFirst({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      },
      orderBy: [{ versionNumber: "desc" }]
    });
    const versionNumber = (previousVersion?.versionNumber ?? 0) + 1;

    await tx.transactionFinanceCalculationVersion.updateMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id,
        isCurrent: true
      },
      data: {
        isCurrent: false
      }
    });

    const version = await tx.transactionFinanceCalculationVersion.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        versionNumber,
        sourceType: "calculated",
        isCurrent: true,
        grossCommission,
        preSplitTotal: calculated.preSplitTotal,
        postSplitTotal: calculated.postSplitTotal,
        netCommissionBase: calculated.netCommissionBase,
        reimbursementAmount: calculated.reimbursementAmount,
        finalAgentNet: calculated.finalAgentNet,
        finalOfficeNet: calculated.finalOfficeNet,
        feeBreakdown: buildStoredTransactionFinanceFeeBreakdownRows(calculated.normalizedFees) satisfies Prisma.InputJsonValue,
        stakeholderBreakdown: buildStoredTransactionFinanceStakeholderBreakdownRows(calculated.stakeholderRows) satisfies Prisma.InputJsonValue,
        blockingIssues: [] satisfies Prisma.InputJsonValue,
        notes: note,
        createdByMembershipId: input.actorMembershipId
      }
    });

    await tx.transaction.update({
      where: {
        id: transaction.id
      },
      data: {
        referralFee: calculated.preSplitTotal,
        officeNet: calculated.finalOfficeNet,
        agentNet: calculated.finalAgentNet
      }
    });

    await tx.commissionCalculation.deleteMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      }
    });

    const rows: Prisma.CommissionCalculationCreateManyInput[] = calculated.stakeholderRows.map((row) => ({
      organizationId: input.organizationId,
      officeId: input.officeId ?? transaction.officeId ?? null,
      transactionId: transaction.id,
      transactionFinanceCalculationVersionId: version.id,
      membershipId: row.membershipId || null,
      commissionPlanId: null,
      accountingTransactionId: null,
      recipientType: row.recipientType,
      recipientRole: row.recipientRoleValue,
      recipientName: row.recipientLabel,
      grossCommission,
      referralFee: calculated.preSplitTotal,
      fees: calculated.postSplitTotal,
      officeNet: row.recipientType === "brokerage" ? row.finalAmount : new Prisma.Decimal(0),
      agentNet: row.recipientType === "agent" ? row.finalAmount : new Prisma.Decimal(0),
      statementAmount: row.finalAmount,
      status: "calculated",
      notes: note,
      calculatedAt: new Date(),
      calculatedByMembershipId: input.actorMembershipId
    }));

    await tx.commissionCalculation.createMany({
      data: rows
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_calculation",
      entityId: version.id,
      action: previousRows.length > 0 ? activityLogActions.commissionRecalculated : activityLogActions.commissionCalculated,
      payload: {
        officeId: transaction.officeId,
        transactionId: transaction.id,
        transactionLabel: buildTransactionLabel(transaction),
        objectLabel: buildTransactionLabel(transaction),
        contextHref: `/office/transactions/${transaction.id}#commission`,
        changes: buildCommissionChanges(previousAgentRow, {
          grossCommission,
          referralFee: calculated.preSplitTotal,
          officeNet: calculated.finalOfficeNet,
          agentNet: calculated.finalAgentNet,
          fees: calculated.postSplitTotal
        }),
        details: [
          "Mode: Finance rule engine",
          `Reference: ${chain[0] ? buildCommissionSplitLabel(chain[0].agentPercent) : "Default split chain"}`,
          `Version: ${versionNumber}`,
          `Agent net: ${formatCurrency(calculated.finalAgentNet)}`,
          `Office net: ${formatCurrency(calculated.finalOfficeNet)}`
        ]
      }
    });
  });

  return getTransactionCommissionSnapshot(
    input.organizationId,
    input.transactionId,
    input.officeId ?? transaction.officeId ?? null,
    input.actorMembershipId
  );
}

export async function overrideTransactionCommission(
  input: OverrideTransactionCommissionInput
): Promise<OfficeTransactionCommissionSnapshot | null> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      organizationId: input.organizationId
    },
    include: {
      office: true
    }
  });

  if (!transaction) {
    return null;
  }

  const overrideReason = parseOptionalText(input.overrideReason);

  if (!overrideReason) {
    throw new Error("Override reason is required.");
  }

  await prisma.$transaction(async (tx) => {
    const [currentVersion, actorMembership] = await Promise.all([
      tx.transactionFinanceCalculationVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          transactionId: transaction.id,
          isCurrent: true
        },
        orderBy: [{ versionNumber: "desc" }]
      }),
      tx.membership.findFirst({
        where: {
          id: input.actorMembershipId,
          organizationId: input.organizationId
        },
        select: {
          role: true
        }
      })
    ]);

    if (!currentVersion) {
      throw new Error("Run the finance calculation before applying a manual override.");
    }

    if (!actorMembership) {
      throw new Error("Actor membership not found.");
    }

    const currentStakeholderRows = parseStoredTransactionFinanceStakeholderBreakdown(currentVersion.stakeholderBreakdown);

    if (currentStakeholderRows.length === 0) {
      throw new Error("Current calculation does not have stakeholder rows to override.");
    }

    const overrideEntries = input.stakeholderRows
      .map((entry) => ({
        key: entry.key.trim(),
        membershipId: entry.membershipId.trim(),
        amount: parseOptionalDecimal(entry.amount)
      }))
      .filter((entry) => entry.key || entry.membershipId || entry.amount !== null);

    if (overrideEntries.length === 0) {
      throw new Error("Enter at least one stakeholder override row.");
    }

    const actorIsOwner = actorMembership.role === "owner";
    const currentRowByKey = new Map(currentStakeholderRows.map((row) => [row.key, row]));
    const incomingKeys = new Set<string>();
    const incomingMembershipIds = new Set<string>();
    let companyRowCount = 0;

    for (const entry of overrideEntries) {
      const isCompanyRow = entry.key === "company";

      if (!entry.key) {
        throw new Error("Each override row must include a stable key.");
      }

      if (incomingKeys.has(entry.key)) {
        throw new Error("Duplicate override rows are not allowed.");
      }

      incomingKeys.add(entry.key);

      if (entry.amount === null) {
        throw new Error("Every override row must include a valid amount.");
      }

      entry.amount = normalizeCurrencyDecimal(entry.amount);

      if (entry.amount.lt(0)) {
        throw new Error("Override amounts must be zero or greater.");
      }

      if (isCompanyRow) {
        companyRowCount += 1;
        entry.membershipId = "";
        continue;
      }

      if (!entry.membershipId) {
        throw new Error("Every participant row must include a valid membership.");
      }

      if (entry.key !== entry.membershipId) {
        throw new Error("Manual participant keys must match the selected membership.");
      }

      if (incomingMembershipIds.has(entry.membershipId)) {
        throw new Error("Duplicate participant memberships are not allowed.");
      }

      incomingMembershipIds.add(entry.membershipId);
    }

    if (companyRowCount !== 1) {
      throw new Error("Manual override must include exactly one company row.");
    }

    const requiredPersistentKeys = currentStakeholderRows
      .filter((row) => row.recipientType !== "brokerage" && !row.isManualParticipant)
      .map((row) => row.key);

    for (const key of requiredPersistentKeys) {
      if (!incomingKeys.has(key)) {
        throw new Error("Only manually added participants can be removed from an override.");
      }
    }

    const participantSetChanged =
      currentStakeholderRows.length !== overrideEntries.length ||
      currentStakeholderRows.some((row) => !incomingKeys.has(row.key)) ||
      overrideEntries.some((entry) => !currentRowByKey.has(entry.key));

    if (participantSetChanged && !actorIsOwner) {
      throw new Error("Only Owner can add or remove override participants.");
    }

    const addedMembershipIds = overrideEntries
      .filter((entry) => entry.key !== "company" && !currentRowByKey.has(entry.key))
      .map((entry) => entry.membershipId);
    const addedMemberships =
      addedMembershipIds.length > 0
        ? await tx.membership.findMany({
            where: {
              organizationId: input.organizationId,
              id: {
                in: addedMembershipIds
              },
              status: "active"
            },
            include: {
              user: true,
              office: true
            }
          })
        : [];

    if (addedMemberships.length !== new Set(addedMembershipIds).size) {
      throw new Error("One or more added participants are no longer active memberships in this organization.");
    }

    const addedMembershipById = new Map(addedMemberships.map((membership) => [membership.id, membership]));
    const addedParticipantLabels: string[] = [];
    const nextStakeholderRows = overrideEntries.map((entry) => {
      const existingRow = currentRowByKey.get(entry.key) ?? null;

      if (existingRow) {
        return {
          ...existingRow,
          finalAmount: String(entry.amount ?? new Prisma.Decimal(0))
        };
      }

      const membership = addedMembershipById.get(entry.membershipId);

      if (!membership) {
        throw new Error("One or more added participants are no longer available. Refresh and try again.");
      }

      const recipientLabel = formatMembershipFullName({
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email
      });
      addedParticipantLabels.push(recipientLabel);

      return {
        key: membership.id,
        membershipId: membership.id,
        recipientLabel,
        recipientRole: formatMembershipParticipantRole({
          role: membership.role,
          title: membership.title
        }),
        recipientRoleValue: membership.role,
        recipientType: "agent",
        isManualParticipant: true,
        sharePercent: "0",
        baseAmount: "0",
        postSplitAdjustment: "0",
        reimbursementAdjustment: "0",
        finalAmount: String(entry.amount ?? new Prisma.Decimal(0))
      } satisfies StoredTransactionFinanceStakeholderBreakdownRow;
    });

    const currentTotal = normalizeCurrencyDecimal(sumStakeholderFinalAmounts(currentStakeholderRows));
    const nextTotal = normalizeCurrencyDecimal(sumStakeholderFinalAmounts(nextStakeholderRows));

    if (!currentTotal.eq(nextTotal)) {
      throw new Error("Override amounts must keep the total allocated payout unchanged.");
    }

    const ownerAgentRow = findPrimaryAgentStakeholderRow(nextStakeholderRows, transaction.ownerMembershipId);
    const companyRow = nextStakeholderRows.find((row) => row.recipientType === "brokerage" && row.key === "company") ?? null;

    if (!companyRow) {
      throw new Error("Manual override must retain the company payout row.");
    }

    const nextFinalAgentNet = ownerAgentRow ? parseOptionalDecimal(ownerAgentRow.finalAmount) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
    const nextFinalOfficeNet = companyRow ? parseOptionalDecimal(companyRow.finalAmount) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
    const note = parseOptionalText(input.notes) ?? currentVersion.notes;
    const previousRows = await tx.commissionCalculation.findMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      },
      orderBy: [{ createdAt: "asc" }]
    });
    const previousAgentRow = buildPreviousCommissionChangeBaseline({
      rows: previousRows,
      ownerMembershipId: transaction.ownerMembershipId,
      fallbackGrossCommission: currentVersion.grossCommission,
      fallbackReferralFee: currentVersion.preSplitTotal,
      fallbackOfficeNet: currentVersion.finalOfficeNet,
      fallbackAgentNet: currentVersion.finalAgentNet
    });
    const removedParticipantLabels = currentStakeholderRows
      .filter((row) => row.isManualParticipant && !incomingKeys.has(row.key))
      .map((row) => row.recipientLabel);
    const versionNumber = currentVersion.versionNumber + 1;

    await tx.transactionFinanceCalculationVersion.updateMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id,
        isCurrent: true
      },
      data: {
        isCurrent: false
      }
    });

    const version = await tx.transactionFinanceCalculationVersion.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        versionNumber,
        sourceType: "overridden",
        isCurrent: true,
        grossCommission: currentVersion.grossCommission,
        preSplitTotal: currentVersion.preSplitTotal,
        postSplitTotal: currentVersion.postSplitTotal,
        netCommissionBase: currentVersion.netCommissionBase,
        reimbursementAmount: currentVersion.reimbursementAmount,
        finalAgentNet: nextFinalAgentNet,
        finalOfficeNet: nextFinalOfficeNet,
        feeBreakdown: currentVersion.feeBreakdown ?? ([] satisfies Prisma.InputJsonValue),
        stakeholderBreakdown: nextStakeholderRows satisfies Prisma.InputJsonValue,
        blockingIssues: currentVersion.blockingIssues ?? ([] satisfies Prisma.InputJsonValue),
        notes: note,
        overrideReason,
        createdByMembershipId: input.actorMembershipId
      }
    });

    await tx.transaction.update({
      where: {
        id: transaction.id
      },
      data: {
        referralFee: currentVersion.preSplitTotal,
        officeNet: nextFinalOfficeNet,
        agentNet: nextFinalAgentNet
      }
    });

    await tx.commissionCalculation.deleteMany({
      where: {
        organizationId: input.organizationId,
        transactionId: transaction.id
      }
    });

    await tx.commissionCalculation.createMany({
      data: nextStakeholderRows.map((row) => ({
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        transactionFinanceCalculationVersionId: version.id,
        membershipId: row.membershipId || null,
        commissionPlanId: null,
        accountingTransactionId: null,
        recipientType: row.recipientType,
        recipientRole: row.recipientRoleValue,
        recipientName: row.recipientLabel,
        grossCommission: currentVersion.grossCommission,
        referralFee: currentVersion.preSplitTotal,
        fees: currentVersion.postSplitTotal,
        officeNet: row.recipientType === "brokerage" ? parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0),
        agentNet: row.recipientType === "agent" ? parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0),
        statementAmount: parseOptionalDecimal(row.finalAmount) ?? new Prisma.Decimal(0),
        status: "calculated",
        notes: note,
        calculatedAt: new Date(),
        calculatedByMembershipId: input.actorMembershipId
      }))
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "commission_calculation",
      entityId: version.id,
      action: activityLogActions.commissionRecalculated,
      payload: {
        officeId: transaction.officeId,
        transactionId: transaction.id,
        transactionLabel: buildTransactionLabel(transaction),
        objectLabel: buildTransactionLabel(transaction),
        contextHref: `/office/transactions/${transaction.id}#commission`,
        changes: buildCommissionChanges(previousAgentRow, {
          grossCommission: currentVersion.grossCommission,
          referralFee: currentVersion.preSplitTotal,
          officeNet: nextFinalOfficeNet,
          agentNet: nextFinalAgentNet,
          fees: currentVersion.postSplitTotal
        }),
        details: [
          "Mode: Manual override",
          `Version: ${versionNumber}`,
          `Reason: ${overrideReason}`,
          ...(addedParticipantLabels.length > 0 ? [`Added participants: ${addedParticipantLabels.join(", ")}`] : []),
          ...(removedParticipantLabels.length > 0 ? [`Removed participants: ${removedParticipantLabels.join(", ")}`] : []),
          `Primary agent net: ${formatCurrency(nextFinalAgentNet)}`,
          `Office net: ${formatCurrency(nextFinalOfficeNet)}`
        ]
      }
    });
  });

  return getTransactionCommissionSnapshot(
    input.organizationId,
    input.transactionId,
    input.officeId ?? transaction.officeId ?? null,
    input.actorMembershipId
  );
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
        contextHref: `/office/settings/commission-plans`,
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
  const scope =
    input.viewerMembershipId
      ? await resolveOfficeDataScope({
          organizationId: input.organizationId,
          viewerMembershipId: input.viewerMembershipId,
          officeId: input.officeId ?? null,
          resource: "commissions"
        })
      : null;

  await backfillCommissionSplitTemplatesFromLegacy(input.organizationId, input.officeId);
  await backfillMembershipCommissionSettingsFromLegacy(input.organizationId, input.officeId);

  const visibleMembershipIds = scope?.visibleMembershipIds ?? null;
  const visibleTeamIds = scope?.visibleTeamIds ?? null;
  const scopedTeams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.officeId ? { OR: [{ officeId: input.officeId }, { officeId: null }] } : {}),
      ...(visibleTeamIds ? { id: { in: visibleTeamIds.length > 0 ? visibleTeamIds : ["__no_team__"] } } : {})
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

  const [plans, assignments, calculations, memberships, transactions, splitTemplates, memberDefaults] = await Promise.all([
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
        ...(input.officeId ? { officeId: input.officeId } : {}),
        ...(visibleMembershipIds ? { id: { in: visibleMembershipIds.length > 0 ? visibleMembershipIds : ["__no_membership__"] } } : {})
      },
      include: {
        user: true
      },
      orderBy: [{ user: { firstName: "asc" } }]
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {}),
        ...(visibleMembershipIds ? { ownerMembershipId: { in: visibleMembershipIds.length > 0 ? visibleMembershipIds : ["__no_membership__"] } } : {})
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
    }),
    listCommissionSplitTemplates(input.organizationId, input.officeId),
    listCurrentMembershipCommissionSettings({
      organizationId: input.organizationId,
      officeId: input.officeId,
      membershipIds: visibleMembershipIds ?? undefined
    })
  ]);

  const filteredAssignments = assignments.filter((assignment) => {
    if (!scope || scope.visibleMembershipIds === null) {
      return true;
    }

    if (assignment.membershipId) {
      return scope.visibleMembershipIds.includes(assignment.membershipId);
    }

    if (assignment.teamId && scope.visibleTeamIds) {
      return scope.visibleTeamIds.includes(assignment.teamId);
    }

    return false;
  });
  const visibility = filterVisibleCommissionRows(
    calculations.map((calculation) => ({
      membershipId: calculation.membershipId,
      recipientType: calculation.recipientType
    })),
    scope
  );
  const visibleCalculations = visibility.visibleRowIndexes.map((index) => calculations[index]);
  const memberById = new Map(memberships.map((membership) => [membership.id, membership]));
  const statementMembershipId = input.membershipId?.trim() || visibleCalculations.find((row) => row.membershipId)?.membershipId || "";
  const statementMembership = statementMembershipId ? memberById.get(statementMembershipId) : null;
  const statement = statementMembershipId
    ? buildCommissionStatementSnapshot(
        statementMembershipId,
        statementMembership ? `${statementMembership.user.firstName} ${statementMembership.user.lastName}`.trim() : "Selected agent",
        visibleCalculations.filter((row) => row.membershipId === statementMembershipId)
      )
    : null;
  const mappedPlans = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description ?? "",
    isActive: plan.isActive,
    calculationMode: commissionCalculationModeLabelMap[plan.calculationMode],
    calculationModeValue: plan.calculationMode,
    defaultCurrency: plan.defaultCurrency ?? "USD",
    assignmentCount: plan.assignments.length,
    rules: plan.rules.map(mapCommissionRule)
  }));
  const mappedAssignments = filteredAssignments.map((assignment) => ({
    ...mapCommissionAssignmentRecord(assignment),
    targetLabel:
      assignment.membership
        ? `${assignment.membership.user.firstName} ${assignment.membership.user.lastName}`.trim()
        : assignment.teamId
          ? teamPathLabelById.get(assignment.teamId) ?? assignment.team?.name ?? "Unassigned target"
          : "Unassigned target"
  }));

  return {
    overview: {
      activeSplitTemplatesCount: splitTemplates.filter((template) => template.isActive).length,
      membersWithDefaultSplitCount: memberDefaults.length,
      activePlansCount: mappedPlans.filter((plan) => plan.isActive).length,
      activeAssignmentsCount: mappedAssignments.filter((assignment) => !assignment.effectiveTo || new Date(assignment.effectiveTo) >= new Date()).length,
      calculatedRowsCount: visibleCalculations.length,
      statementReadyLabel: formatCurrency(sumAgentStatementAmounts(visibleCalculations, "statement_ready")),
      payableLabel: formatCurrency(sumAgentStatementAmounts(visibleCalculations, "payable")),
      paidLabel: formatCurrency(sumAgentStatementAmounts(visibleCalculations, "paid"))
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
    splitTemplates,
    memberDefaults,
    advancedReviewItems: buildLegacyReviewItems({
      plans: mappedPlans,
      assignments: mappedAssignments
    }),
    plans: mappedPlans,
    assignments: mappedAssignments,
    calculations: visibleCalculations.map(mapCommissionCalculationRow),
    statement
  };
}

export async function getTransactionCommissionSnapshot(
  organizationId: string,
  transactionId: string,
  officeId?: string | null,
  viewerMembershipId?: string
): Promise<OfficeTransactionCommissionSnapshot | null> {
  const scope =
    viewerMembershipId
      ? await resolveOfficeDataScope({
          organizationId,
          viewerMembershipId,
          officeId: officeId ?? null,
          resource: "commissions"
        })
      : null;
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

  const effectiveAt = transaction.createdAt ?? new Date();
  if (transaction.ownerMembershipId) {
    await backfillMembershipCommissionSettingsFromLegacy(organizationId, officeId ?? transaction.officeId, [transaction.ownerMembershipId]);
  }
  const financeFees = await prisma.$transaction((tx) =>
    ensureTransactionFinanceFees(tx, {
      organizationId,
      officeId: officeId ?? transaction.officeId,
      transactionId: transaction.id,
      grossCommission: transaction.grossCommission,
      referralFee: transaction.referralFee,
      companyReferral: transaction.companyReferral,
      additionalFields: transaction.additionalFields
    })
  );

  const [assignment, defaultSetting, plans, calculations, versions] = await Promise.all([
    transaction.ownerMembershipId
      ? resolveActiveCommissionPlanAssignment(prisma, {
          organizationId,
          officeId: officeId ?? transaction.officeId,
          membershipId: transaction.ownerMembershipId,
          effectiveAt
        })
      : Promise.resolve(null),
    transaction.ownerMembershipId
      ? resolveActiveMembershipCommissionSetting(prisma, {
          organizationId,
          officeId: officeId ?? transaction.officeId,
          membershipId: transaction.ownerMembershipId,
          effectiveAt
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
    }),
    prisma.transactionFinanceCalculationVersion.findMany({
      where: {
        organizationId,
        transactionId
      },
      include: {
        createdByMembership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ versionNumber: "desc" }]
    })
  ]);
  const storedContext = parseStoredTransactionCommissionContext(transaction.commissionContext);
  const prerequisites = buildTransactionFinancePrerequisiteSnapshot({
    clientReferralFormApproved: transaction.clientReferralFormApproved,
    rebateAgreementSigned: transaction.rebateAgreementSigned,
    rebateGoogleFormSubmitted: transaction.rebateGoogleFormSubmitted
  });
  const previewChain =
    transaction.grossCommission && transaction.ownerMembershipId
      ? await buildDefaultTransactionCommissionChain(prisma, {
          organizationId,
          officeId: officeId ?? transaction.officeId,
          ownerMembershipId: transaction.ownerMembershipId,
          effectiveAt,
          transactionCommissionContext: transaction.commissionContext
        })
      : [];
  const previewCalculation =
    transaction.grossCommission
      ? calculateTransactionFinanceResult({
          grossCommission: transaction.grossCommission,
          fees: financeFees,
          chain: previewChain,
          prerequisites
        })
      : null;
  const visibility = filterVisibleCommissionRows(
    calculations.map((calculation) => ({
      membershipId: calculation.membershipId,
      recipientType: calculation.recipientType
    })),
    scope
  );
  const visibleCalculations = visibility.visibleRowIndexes.map((index) => calculations[index]);
  const restrictedTotals = Boolean(scope && scope.visibleMembershipIds !== null && visibility.hiddenRowCount > 0);
  const defaultSplitLabel =
    storedContext?.members[0]?.agentPercent
      ? buildCommissionSplitLabel(storedContext.members[0].agentPercent)
      : defaultSetting?.settingLabel ??
        (transaction.ownerMembership
          ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName} default split`
          : "Default split chain");
  const defaultSplitSourceLabel =
    storedContext
      ? `Locked on ${formatDateValue(new Date(storedContext.sourceDate)) || formatDateValue(effectiveAt)}`
      : defaultSetting?.sourceLabel ?? "No default split configured";
  const latestCalculatedPlan = calculations.find((row) => Boolean(row.commissionPlanId)) ?? null;
  const currentVersion = versions.find((version) => version.isCurrent) ?? versions[0] ?? null;
  const summary = buildTransactionCommissionSummary(transaction, visibleCalculations, {
    restrictTotals: restrictedTotals,
    currentVersion:
      currentVersion
        ? {
            versionNumber: currentVersion.versionNumber,
            sourceType: currentVersion.sourceType,
            preSplitTotal: currentVersion.preSplitTotal,
            postSplitTotal: currentVersion.postSplitTotal,
            netCommissionBase: currentVersion.netCommissionBase,
            reimbursementAmount: currentVersion.reimbursementAmount,
            finalAgentNet: currentVersion.finalAgentNet,
            finalOfficeNet: currentVersion.finalOfficeNet
          }
        : null,
    feeRows: financeFees
  });
  const rawStakeholderBreakdown =
    currentVersion
      ? parseStoredTransactionFinanceStakeholderBreakdown(currentVersion.stakeholderBreakdown)
      : previewCalculation?.stakeholderRows.map((row) => ({
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
        })) ?? [];
  const manualParticipantLockActive = hasManualParticipantRows(rawStakeholderBreakdown);
  const existingStakeholderMembershipIds = new Set(
    rawStakeholderBreakdown
      .filter((row) => row.recipientType !== "brokerage" && row.membershipId.trim().length > 0)
      .map((row) => row.membershipId)
  );
  const manualParticipantOptions =
    scope?.viewerRole === "owner"
      ? (
          await prisma.membership.findMany({
            where: {
              organizationId,
              status: "active"
            },
            include: {
              user: true,
              office: true
            },
            orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
          })
        )
          .filter((membership) => !existingStakeholderMembershipIds.has(membership.id))
          .map((membership) =>
            buildManualParticipantOption({
              membershipId: membership.id,
              firstName: membership.user.firstName,
              lastName: membership.user.lastName,
              email: membership.user.email,
              role: membership.role,
              title: membership.title,
              officeName: membership.office?.name ?? null
            })
          )
      : [];
  const stakeholderVisibility = filterVisibleCommissionRows(
    rawStakeholderBreakdown.map((row) => ({
      membershipId: row.membershipId || null,
      recipientType: row.recipientType
    })),
    scope
  );
  const stakeholderBreakdown = stakeholderVisibility.visibleRowIndexes.map((index) =>
    mapStoredTransactionFinanceStakeholderRow(rawStakeholderBreakdown[index]!)
  );
  const versionHistory = versions.map((version) => {
    const mapped = mapTransactionFinanceVersionRecord(version);

    if (!restrictedTotals) {
      return mapped;
    }

    return {
      ...mapped,
      finalAgentNetLabel: "Restricted",
      finalOfficeNetLabel: "Restricted"
    };
  });

  return {
    transactionId: transaction.id,
    mode: latestCalculatedPlan ? "legacy_plan" : "default_split_chain",
    defaultSplitLabel,
    defaultSplitSourceLabel,
    hiddenRowCount: visibility.hiddenRowCount,
    visibilityNote: visibility.visibilityNote,
    planLabel: latestCalculatedPlan?.commissionPlan?.name ?? assignment?.commissionPlan.name ?? defaultSplitLabel,
    planId: latestCalculatedPlan?.commissionPlanId ?? assignment?.commissionPlanId ?? "",
    planSourceLabel:
      latestCalculatedPlan?.commissionPlanId
        ? "Used for latest calculation"
        : assignment?.sourceLabel ?? defaultSplitSourceLabel,
    planSourceValue: latestCalculatedPlan?.commissionPlanId ? "manual" : assignment?.sourceType ?? "manual",
    availablePlans: plans,
    manualParticipantOptions,
    manualParticipantLockActive,
    feeBreakdown: financeFees.map((fee) =>
      mapTransactionFinanceFeeRecord(fee, {
        restrictAmounts: restrictedTotals
      })
    ),
    stakeholderBreakdown,
    versionHistory,
    approvalBlockers: previewCalculation?.approvalBlockers ?? [],
    calculations: visibleCalculations.map(mapCommissionCalculationRow),
    summary
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
      defaultSettingId: "",
      defaultSplitLabel: "",
      defaultSplitSourceLabel: "",
      defaultAgentPercentLabel: "",
      defaultCompanyPercentLabel: "",
      defaultEffectiveFrom: "",
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

  await backfillMembershipCommissionSettingsFromLegacy(
    input.organizationId,
    input.officeId ?? membership.officeId,
    [membership.id]
  );

  const [assignment, defaultSetting, calculations, allTotals] = await Promise.all([
    resolveActiveCommissionPlanAssignment(prisma, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? membership.officeId,
      membershipId: membership.id,
      effectiveAt: new Date()
    }),
    resolveActiveMembershipCommissionSetting(prisma, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? membership.officeId,
      membershipId: membership.id,
      effectiveAt: new Date()
    }),
    prisma.commissionCalculation.findMany({
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
    }),
    prisma.commissionCalculation.groupBy({
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
    })
  ]);

  const getStatusTotal = (status: CommissionCalculationStatus) =>
    allTotals.find((entry) => entry.status === status)?._sum.statementAmount ?? new Prisma.Decimal(0);
  const totalCount = allTotals.reduce((sum, entry) => sum + entry._count._all, 0);

  return {
    defaultSettingId: defaultSetting?.id ?? "",
    defaultSplitLabel: defaultSetting?.settingLabel ?? membership.agentProfile?.commissionPlanName ?? "",
    defaultSplitSourceLabel: defaultSetting?.sourceLabel ?? "",
    defaultAgentPercentLabel: defaultSetting ? `${String(defaultSetting.agentPercent)}%` : "",
    defaultCompanyPercentLabel: defaultSetting ? `${String(defaultSetting.companyPercent)}%` : "",
    defaultEffectiveFrom: defaultSetting ? formatDateValue(defaultSetting.effectiveFrom) : "",
    activePlanId: assignment?.commissionPlanId ?? defaultSetting?.id ?? "",
    activePlanLabel: assignment?.commissionPlan.name ?? defaultSetting?.settingLabel ?? membership.agentProfile?.commissionPlanName ?? "",
    activePlanSourceLabel: assignment?.sourceLabel ?? defaultSetting?.sourceLabel ?? "",
    calculatedCount: totalCount,
    statementReadyLabel: formatCurrency(getStatusTotal("statement_ready")),
    payableLabel: formatCurrency(getStatusTotal("payable")),
    paidLabel: formatCurrency(getStatusTotal("paid")),
    recentCalculations: calculations.map(mapCommissionCalculationRow)
  };
}
