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

import { ComputedTransactionFinanceResult, ComputedTransactionFinanceStakeholderRow, DerivedTransactionCommissionChainMember, NormalizedTransactionFinanceFee, PreviewCreateTransactionCommissionCalculatorInput, StoredTransactionCommissionChainMember, StoredTransactionCommissionContext, StoredTransactionFinanceFeeBreakdownRow, StoredTransactionFinanceStakeholderBreakdownRow, applyEffectiveSharePercentsToStoredStakeholderRows, buildCommissionChanges, buildCommissionStakeholderKey, buildDefaultSplitCalculationRows, buildDefaultTransactionCommissionChain, buildLegacyReviewItems, buildManualParticipantOption, buildPreviousCommissionChangeBaseline, buildStoredTransactionCommissionContext, buildStoredTransactionFinanceFeeBreakdownRows, buildStoredTransactionFinanceStakeholderBreakdownRows, buildTransactionCommissionSummary, buildTransactionFinanceBlockingIssues, buildTransactionLabel, calculatePlanDrivenValues, calculateTransactionFinanceResult, compareAssignmentPriority, computeRuleAmount, determineBaseSplitPercent, filterVisibleCommissionRows, findPrimaryAgentStakeholderRow, formatMembershipFullName, getAssignmentTargetLabel, getCommissionRoleLabel, getCommissionRoleValue, hasManualParticipantRows, listCommissionPlanOptions, managedTransactionMembershipLinkRoles, mapCommissionAssignmentRecord, mapCommissionCalculationRow, mapCommissionRule, mapStoredTransactionFinanceStakeholderRow, mapTransactionFinanceVersionRecord, normalizeCurrencyDecimal, normalizeSharePercentDecimal, normalizeTransactionFinanceFees, parseCommissionCalculationMode, parseCommissionCalculationStatus, parseCommissionPlanRuleType, parseCommissionRecipientType, parseCommissionRuleFeeType, parseStoredTransactionCommissionContext, parseStoredTransactionFinanceFeeBreakdown, parseStoredTransactionFinanceStakeholderBreakdown, previewCreateTransactionCommissionCalculator, resolveActiveCommissionPlanAssignment, saveCommissionPlan, sumStakeholderFinalAmounts, syncTransactionParticipantMembershipLinks } from "./planning";
import { assignCommissionPlanToMembership, calculateTransactionCommission, overrideTransactionCommission, updateCommissionCalculationStatus } from "./transactions";
import { buildCommissionStatementSnapshot, generateCommissionStatementSnapshot, getAgentCommissionSummary, getOfficeCommissionManagementSnapshot, getTransactionCommissionSnapshot, sumAgentStatementAmounts } from "./statements";

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
  statusLabel: string;
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



export type OfficeCreateTransactionCommissionPreview = {
  grossCommissionLabel: string;
  preSplitTotalLabel: string;
  postSplitTotalLabel: string;
  netCommissionBaseLabel: string;
  finalAgentNetLabel: string;
  finalOfficeNetLabel: string;
  blockingIssues: string[];
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



export type CommissionPlanWithRules = Prisma.CommissionPlanGetPayload<{
  include: {
    rules: true;
  };
}>;



export type ScopedPrismaClient = Prisma.TransactionClient | typeof prisma;



export type ResolvedCommissionPlanAssignment = Prisma.CommissionPlanAssignmentGetPayload<{
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



export const commissionCalculationStatusLabelMap: Record<CommissionCalculationStatus, OfficeCommissionCalculationStatusLabel> = {
  draft: "Draft",
  calculated: "Calculated",
  reviewed: "Reviewed",
  statement_ready: "Statement ready",
  payable: "Payable",
  paid: "Paid"
};



export const commissionRecipientLabelMap: Record<CommissionRecipientType, OfficeCommissionCalculationRecipientLabel> = {
  agent: "Agent",
  brokerage: "Brokerage",
  referral: "Referral"
};



export const commissionCalculationModeLabelMap: Record<CommissionCalculationMode, string> = {
  split_and_fees: "Split & fees",
  flat_net: "Flat net"
};



export const commissionRuleTypeLabelMap: Record<CommissionPlanRuleType, string> = {
  base_split: "Base split",
  brokerage_fee: "Brokerage fee",
  referral_fee: "Referral fee",
  flat_fee_deduction: "Flat fee deduction",
  sliding_scale: "Sliding scale"
};



export const commissionRuleFeeTypeLabelMap: Record<CommissionRuleFeeType, string> = {
  percentage: "Percentage",
  flat: "Flat"
};



export const transactionFinanceCalculationTypeLabelMap: Record<TransactionFinanceCalculationType, OfficeTransactionFinanceCalculationLabel> = {
  pre_split: "Pre-Split",
  post_split: "Post-Split",
  reimbursement: "Reimbursement"
};



export const transactionFinanceApprovalStatusLabelMap: Record<TransactionFinanceApprovalStatus, OfficeTransactionFinanceApprovalLabel> = {
  not_required: "Not required",
  pending: "Pending approval",
  approved: "Approved"
};



export const transactionFinanceVersionSourceLabelMap: Record<TransactionFinanceVersionSource, string> = {
  calculated: "Calculated",
  overridden: "Manual override"
};



export const userRoleLabelMap: Record<UserRole, string> = {
  owner: "Owner",
  office_admin: "Office Admin",
  accountant: "Accountant",
  human_resources: "Human Resources",
  team_lead: "Team Lead",
  agent: "Agent",
  office_manager: "Office Manager",
  office_user: "Office User"
};



export const membershipStatusLabelMap: Record<MembershipStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Inactive"
};



export const selectableOperationalMembershipStatuses = ["active", "invited"] satisfies MembershipStatus[];



export type TransactionFinanceFeeDefinition = {
  feeType: TransactionFinanceFeeType;
  label: string;
  defaultRate: Prisma.Decimal | null;
  defaultCalculationType: TransactionFinanceCalculationType;
  maxAutoApprovedRate: Prisma.Decimal | null;
  approvalHelperText: string;
  prerequisiteHelperText: string;
  isActive?: boolean;
};



export const channelDevelopmentApprovalPrompt = "Over 20% requires Cathy approval email and pay@acreny.us cc before it can be calculated.";


export const financeFeeDefinitions: TransactionFinanceFeeDefinition[] = [
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
    label: "Internal Referral",
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
    prerequisiteHelperText: "",
    isActive: false
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



export const activeFinanceFeeDefinitions = financeFeeDefinitions.filter((definition) => definition.isActive !== false);


export const financeFeeDefinitionByType = new Map(financeFeeDefinitions.map((definition) => [definition.feeType, definition]));



export function isActiveTransactionFinanceFeeType(feeType: TransactionFinanceFeeType) {
  return financeFeeDefinitionByType.get(feeType)?.isActive !== false;
}



export function filterActiveTransactionFinanceFees<T extends { feeType: TransactionFinanceFeeType }>(fees: T[]) {
  return fees.filter((fee) => isActiveTransactionFinanceFeeType(fee.feeType));
}



export function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}



export function formatPercentLabel(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "0";
  }

  if (Number.isInteger(numericValue)) {
    return String(numericValue);
  }

  return numericValue.toFixed(2).replace(/\.?0+$/, "");
}



export function formatDateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}



export function formatFallbackRoleLabel(value: string) {
  return value
    .split("_")
    .map((part) => (part ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}` : ""))
    .join(" ")
    .trim();
}



export function formatRecipientRoleLabel(value: string | null | undefined) {
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



export function formatMembershipParticipantRole(input: {
  role: UserRole;
  title?: string | null;
}) {
  const title = input.title?.trim();

  if (title) {
    return title;
  }

  return formatRecipientRoleLabel(input.role);
}



export function parseOptionalDate(value: string | undefined | null) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}



export function startOfDay(value: string | undefined | null) {
  const parsed = parseOptionalDate(value);

  if (!parsed) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}



export function endOfDay(value: string | undefined | null) {
  const parsed = parseOptionalDate(value);

  if (!parsed) {
    return null;
  }

  parsed.setHours(23, 59, 59, 999);
  return parsed;
}



export function parseOptionalDecimal(value: string | undefined | null) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
}



export function parseOptionalText(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}



export function parseTransactionFinanceFeeType(value: string | undefined | null): TransactionFinanceFeeType | null {
  if (
    value === "rebate" ||
    value === "client_referral" ||
    value === "external_referral" ||
    value === "company_referral" ||
    value === "channel_development_fee" ||
    value === "reimbursement"
  ) {
    return value;
  }

  return null;
}



export function parseTransactionFinanceCalculationType(value: string | undefined | null): TransactionFinanceCalculationType | null {
  if (value === "pre_split" || value === "post_split" || value === "reimbursement") {
    return value;
  }

  return null;
}



export function parseTransactionFinanceApprovalStatus(value: string | undefined | null): TransactionFinanceApprovalStatus | null {
  if (value === "not_required" || value === "pending" || value === "approved") {
    return value;
  }

  return null;
}



export function decimalToString(value: Prisma.Decimal | null | undefined) {
  return value ? String(value) : "";
}



export function getTransactionFinanceFeeDefinition(feeType: TransactionFinanceFeeType) {
  const definition = financeFeeDefinitionByType.get(feeType);

  if (!definition) {
    throw new Error(`Unsupported transaction finance fee type: ${feeType}`);
  }

  return definition;
}



export function getTransactionFinanceFeeSortOrder(feeType: TransactionFinanceFeeType) {
  return financeFeeDefinitions.findIndex((definition) => definition.feeType === feeType);
}



export function sortTransactionFinanceFees<T extends { feeType: TransactionFinanceFeeType }>(fees: T[]) {
  return [...fees].sort((left, right) => getTransactionFinanceFeeSortOrder(left.feeType) - getTransactionFinanceFeeSortOrder(right.feeType));
}



export function deriveRateFromAmount(amount: Prisma.Decimal | null | undefined, grossCommission: Prisma.Decimal | null | undefined) {
  if (!amount || !grossCommission || grossCommission.lte(0)) {
    return null;
  }

  return amount.mul(new Prisma.Decimal(100)).div(grossCommission);
}



export function normalizeFinanceFeeApprovalStatus(input: {
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



export function buildInitialTransactionFinanceFeeSeed(input: {
  feeType: TransactionFinanceFeeType;
  grossCommission: Prisma.Decimal | null;
  referralFee: Prisma.Decimal | null;
  companyReferral: boolean;
  additionalFields: Prisma.JsonValue | null | undefined;
}) {
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
    const missingDefinitions = activeFinanceFeeDefinitions.filter((definition) => !existingFeeTypes.has(definition.feeType));

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

  return sortTransactionFinanceFees(filterActiveTransactionFinanceFees(fees));
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
