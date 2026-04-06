import {
  AgentPayoutStatementPeriodBasis,
  AgentPayoutStatementMessageType,
  AgentPayoutStatementReviewStatus,
  AgentBankInformationAccountType,
  AgentBankInformationTaxIdType,
  CommissionCalculationStatus,
  MembershipStatus,
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
  Prisma,
  TransactionFinanceApprovalStatus,
  TransactionFinanceCalculationType,
  TransactionFinanceFeeType,
  TransactionFinanceVersionSource
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import { createNotificationsForMemberships } from "./notifications";

type StatementCandidateCalculation = Prisma.CommissionCalculationGetPayload<{
  include: {
    transaction: true;
  };
}>;

type StatementPersistCalculation = Prisma.CommissionCalculationGetPayload<{
  include: {
    transaction: {
      include: {
        ownerMembership: {
          include: {
            user: true;
          };
        };
      };
    };
    transactionFinanceCalculationVersion: true;
  };
}>;

type StatementRecordWithRelations = Prisma.AgentPayoutStatementGetPayload<{
  include: {
    membership: {
      include: {
        user: true;
        agentBankInformation: true;
      };
    };
    office: true;
    organization: true;
    generatedByMembership: {
      include: {
        user: true;
      };
    };
    lastSharedByMembership: {
      include: {
        user: true;
      };
    };
    messages: {
      include: {
        membership: {
          include: {
            user: true;
          };
        };
      };
      orderBy: [{ createdAt: "asc" }, { id: "asc" }];
    };
    manualLineItems: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }];
    };
    lineItems: {
      orderBy: [{ calculatedAt: "desc" }, { transactionLabel: "asc" }];
    };
  };
}>;

export type OfficeAgentPayoutStatementMemberOption = {
  id: string;
  label: string;
};

export type OfficeAgentPayoutStatementInvoiceOption = {
  invoiceNumber: string;
  label: string;
  rowCount: number;
  totalStatementAmountLabel: string;
  totalStatementAmountValue: string;
  isGenerateEligible: boolean;
};

export type OfficeAgentPayoutStatementCandidateRow = {
  id: string;
  transactionId: string;
  transactionLabel: string;
  transactionHref: string;
  propertyAddress: string;
  invoiceNumber: string;
  closingDate: string;
  calculatedAt: string;
  status: string;
  statusValue: CommissionCalculationStatus;
  grossCommissionLabel: string;
  grossCommissionValue: string;
  feesLabel: string;
  feesValue: string;
  officeNetLabel: string;
  officeNetValue: string;
  agentNetLabel: string;
  agentNetValue: string;
  statementAmountLabel: string;
  statementAmountValue: string;
  isGenerateEligible: boolean;
};

export type OfficeAgentPayoutStatementLineRecord = {
  id: string;
  commissionCalculationId: string;
  transactionId: string;
  transactionLabel: string;
  transactionHref: string;
  propertyAddress: string;
  creationDate: string;
  invoiceNumber: string;
  ownerName: string;
  buildingName: string;
  unitNumber: string;
  closingDate: string;
  calculatedAt: string;
  commissionRate: string;
  statusAtGeneration: string;
  statusAtGenerationValue: CommissionCalculationStatus;
  grossCommissionLabel: string;
  grossCommissionValue: string;
  preSplitLabel: string;
  preSplitValue: string;
  referralFeeLabel: string;
  referralFeeValue: string;
  postSplitLabel: string;
  postSplitValue: string;
  postSplitBreakdown: OfficeAgentPayoutStatementPostSplitDetailItem[];
  feesLabel: string;
  feesValue: string;
  agentNetLabel: string;
  agentNetValue: string;
  netCommissionLabel: string;
  netCommissionValue: string;
  statementAmountLabel: string;
  statementAmountValue: string;
};

export type OfficeAgentPayoutStatementPostSplitDetailItem = {
  feeTypeValue: "external_referral" | "company_referral";
  feeTypeLabel: string;
  amountLabel: string;
  amountValue: string;
};

export type OfficeAgentPayoutStatementManualLineItemRecord = {
  id: string;
  memo: string;
  amountLabel: string;
  amountValue: string;
};

export type OfficeAgentPayoutStatementTimelineItem = {
  id: string;
  messageType: AgentPayoutStatementMessageType;
  messageTypeLabel: string;
  authorLabel: string;
  body: string;
  createdAt: string;
  createdAtLabel: string;
};

export type OfficeAgentPayoutStatementBankInformationRecord = {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  phoneNumber: string;
  taxIdType: string;
  taxIdTypeLabel: string;
  taxIdValue: string;
  dateOfBirth: string;
  accountType: string;
  accountTypeLabel: string;
};

export type OfficeAgentPayoutStatementRecord = {
  id: string;
  membershipId: string;
  agentLabel: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  periodBasis: AgentPayoutStatementPeriodBasis;
  periodBasisLabel: string;
  generatedAt: string;
  generatedAtLabel: string;
  generatedByLabel: string;
  reviewStatus: AgentPayoutStatementReviewStatus;
  reviewStatusLabel: string;
  lastSharedAt: string;
  lastSharedAtLabel: string;
  confirmedAt: string;
  confirmedAtLabel: string;
  lineItemCount: number;
  totalStatementAmountLabel: string;
  totalStatementAmountValue: string;
};

export type OfficeAgentPayoutStatementDetail = {
  id: string;
  organizationLabel: string;
  officeLabel: string;
  membershipId: string;
  agentLabel: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  periodBasis: AgentPayoutStatementPeriodBasis;
  periodBasisLabel: string;
  generatedAt: string;
  generatedAtLabel: string;
  generatedByLabel: string;
  reviewStatus: AgentPayoutStatementReviewStatus;
  reviewStatusLabel: string;
  lastSharedAt: string;
  lastSharedAtLabel: string;
  lastSharedByLabel: string;
  agentRespondedAt: string;
  agentRespondedAtLabel: string;
  confirmedAt: string;
  confirmedAtLabel: string;
  lineItemCount: number;
  invoicePayoutTotalLabel: string;
  invoicePayoutTotalValue: string;
  manualAdjustmentTotalLabel: string;
  manualAdjustmentTotalValue: string;
  totalStatementAmountLabel: string;
  totalStatementAmountValue: string;
  totalGrossCommissionLabel: string;
  totalGrossCommissionValue: string;
  totalAgentNetLabel: string;
  totalAgentNetValue: string;
  bankInformation: OfficeAgentPayoutStatementBankInformationRecord | null;
  timeline: OfficeAgentPayoutStatementTimelineItem[];
  manualLineItems: OfficeAgentPayoutStatementManualLineItemRecord[];
  lineItems: OfficeAgentPayoutStatementLineRecord[];
};

export type GetOfficeAgentPayoutStatementsWorkspaceInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId?: string;
  invoiceNumbers?: string[];
  statementId?: string;
};

export type OfficeAgentPayoutStatementsWorkspaceSnapshot = {
  filters: {
    membershipId: string;
    invoiceNumbers: string[];
    memberOptions: OfficeAgentPayoutStatementMemberOption[];
    invoiceOptions: OfficeAgentPayoutStatementInvoiceOption[];
  };
  candidateRows: OfficeAgentPayoutStatementCandidateRow[];
  history: OfficeAgentPayoutStatementRecord[];
  selectedStatement: OfficeAgentPayoutStatementDetail | null;
};

export type CreateAgentPayoutStatementInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  invoiceNumbers: string[];
  commissionCalculationIds: string[];
  actorMembershipId: string;
};

export type UpdateAgentPayoutStatementManualLineItemInput = {
  id?: string;
  memo: string;
  amount: string;
};

export type UpdateAgentPayoutStatementManualLineItemsInput = {
  organizationId: string;
  officeId?: string | null;
  statementId: string;
  manualLineItems: UpdateAgentPayoutStatementManualLineItemInput[];
  actorMembershipId: string;
};

export type UpdateAgentPayoutStatementReviewStatusInput = {
  organizationId: string;
  officeId?: string | null;
  statementId: string;
  reviewStatus: AgentPayoutStatementReviewStatus;
  actorMembershipId: string;
};

export type SendAgentPayoutStatementToAgentInput = {
  organizationId: string;
  officeId?: string | null;
  statementId: string;
  actorMembershipId: string;
  message?: string;
};

export type RespondToAgentPayoutStatementInput = {
  organizationId: string;
  officeId?: string | null;
  statementId: string;
  actorMembershipId: string;
  response: "confirm" | "request_revision";
  message?: string;
};

export type GetOfficeAgentPayoutStatementDetailInput = {
  organizationId: string;
  officeId?: string | null;
  statementId: string;
};

type StatementDateSubject = {
  calculatedAt: Date;
  closingDate: Date | null;
};

type StatementSummarySubject = {
  grossCommission: Prisma.Decimal | number | string;
  officeNet: Prisma.Decimal | number | string;
  agentNet: Prisma.Decimal | number | string;
  statementAmount: Prisma.Decimal | number | string;
};

type StatementInvoiceOptionSubject = {
  invoiceNumber: string | null | undefined;
  calculatedAt: Date;
  statementAmount: Prisma.Decimal | number | string;
  status?: CommissionCalculationStatus | null | undefined;
};

type StatementManualLineItemSubject = {
  amount: Prisma.Decimal | number | string;
};

type NormalizedManualLineItemInput = {
  id?: string;
  memo: string;
  amount: Prisma.Decimal;
};

const commissionCalculationStatusLabelMap: Record<CommissionCalculationStatus, string> = {
  draft: "Draft",
  calculated: "Calculated",
  reviewed: "Reviewed",
  statement_ready: "Statement ready",
  payable: "Payable",
  paid: "Paid"
};

const statementReviewStatusLabelMap: Record<AgentPayoutStatementReviewStatus, string> = {
  draft: "Draft",
  awaiting_agent: "Awaiting agent",
  revision_requested: "Revision requested",
  confirmed: "Confirmed",
  paid: "Paid"
};

const statementMessageTypeLabelMap: Record<AgentPayoutStatementMessageType, string> = {
  sent_to_agent: "Sent to agent",
  finance_response: "Finance response",
  agent_revision_requested: "Revision requested",
  agent_confirmed: "Agent confirmed"
};

const selectableAgentMembershipStatuses = ["active", "invited"] satisfies MembershipStatus[];
const postSplitStatementFeeDefinitions = [
  { feeType: "external_referral", label: "External Referral" },
  { feeType: "company_referral", label: "Company Referral" }
] satisfies Array<{
  feeType: OfficeAgentPayoutStatementPostSplitDetailItem["feeTypeValue"];
  label: string;
}>;

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
const advanceToPayableAgentPayoutCalculationStatuses: readonly CommissionCalculationStatus[] = [
  "calculated",
  "reviewed",
  "statement_ready"
];
const creatableAgentPayoutCalculationStatuses = [
  ...advanceToPayableAgentPayoutCalculationStatuses,
  "payable",
  "paid"
] satisfies CommissionCalculationStatus[];

function isCreatableAgentPayoutCalculationStatus(status: CommissionCalculationStatus) {
  return (
    status === "calculated" ||
    status === "reviewed" ||
    status === "statement_ready" ||
    status === "payable" ||
    status === "paid"
  );
}

const agentBankInformationTaxIdTypeLabelMap: Record<AgentBankInformationTaxIdType, string> = {
  ssn: "SSN",
  ein: "EIN"
};

const agentBankInformationAccountTypeLabelMap: Record<AgentBankInformationAccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  business_checking: "Business checking",
  business_savings: "Business savings",
  other: "Other"
};

function buildOfficeOrGlobalStatementWhere(officeId: string | null | undefined): Prisma.AgentPayoutStatementWhereInput | undefined {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }]
  };
}

function buildOfficeOrGlobalCommissionWhere(
  officeId: string | null | undefined
): Prisma.CommissionCalculationWhereInput | undefined {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }]
  };
}

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

function formatDateTimeValue(value: Date | null | undefined, timeZone?: string | null) {
  return formatDateTimeLabel(value, {
    timeZone
  });
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

function normalizeCurrencyDecimal(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

function normalizeSharePercentDecimal(value: Prisma.Decimal) {
  return value.toDecimalPlaces(4);
}

type ParsedStakeholderBreakdownRow = {
  membershipId: string;
  recipientType: string;
  sharePercent: string;
  finalAmount: string;
};

function parseStakeholderBreakdownRows(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as ParsedStakeholderBreakdownRow[];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Record<string, Prisma.JsonValue>;

      if (
        typeof row.membershipId !== "string" ||
        typeof row.recipientType !== "string" ||
        typeof row.sharePercent !== "string" ||
        typeof row.finalAmount !== "string"
      ) {
        return null;
      }

      return {
        membershipId: row.membershipId,
        recipientType: row.recipientType,
        sharePercent: row.sharePercent,
        finalAmount: row.finalAmount
      } satisfies ParsedStakeholderBreakdownRow;
    })
    .filter((entry): entry is ParsedStakeholderBreakdownRow => Boolean(entry));
}

function applyEffectiveSharePercents(rows: ParsedStakeholderBreakdownRow[]) {
  const totalAllocatedPayout = rows.reduce(
    (sum, row) => sum.plus(normalizeCurrencyDecimal(new Prisma.Decimal(row.finalAmount || 0))),
    new Prisma.Decimal(0)
  );

  if (totalAllocatedPayout.lte(0)) {
    return rows.map((row) => ({
      ...row,
      sharePercent: "0"
    }));
  }

  return rows.map((row) => {
    const finalAmount = normalizeCurrencyDecimal(new Prisma.Decimal(row.finalAmount || 0));
    const effectiveSharePercent = normalizeSharePercentDecimal(
      Prisma.Decimal.max(new Prisma.Decimal(0), finalAmount.mul(new Prisma.Decimal(100)).div(totalAllocatedPayout))
    );

    return {
      ...row,
      sharePercent: String(effectiveSharePercent)
    };
  });
}

function formatPeriodLabel(periodStart: Date, periodEnd: Date) {
  return `${formatDateValue(periodStart)} to ${formatDateValue(periodEnd)}`;
}

function formatPeriodBasisLabel(periodBasis: AgentPayoutStatementPeriodBasis) {
  if (periodBasis === "closing_date") {
    return "Closing date";
  }

  if (periodBasis === "invoice_number") {
    return "Invoice number";
  }

  return "Calculated date";
}

function formatMembershipLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
  };
}) {
  return `${membership.user.firstName} ${membership.user.lastName}`.trim();
}

function buildOwnerLabel(
  ownerMembership:
    | {
        user: {
          firstName: string;
          lastName: string;
          email: string;
        };
      }
    | null
    | undefined
) {
  if (!ownerMembership) {
    return "Unassigned";
  }

  const fullName = `${ownerMembership.user.firstName} ${ownerMembership.user.lastName}`.trim();
  return fullName || ownerMembership.user.email;
}

function normalizeAdditionalFields(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, Prisma.JsonValue>).map(([key, entry]) => [key, String(entry ?? "")])
  );
}

export function parseStakeholderBreakdownSharePercent(
  value: Prisma.JsonValue | null | undefined,
  membershipId: string | null | undefined,
  options?: {
    sourceType?: TransactionFinanceVersionSource | null;
  }
) {
  if (!membershipId) {
    return "";
  }

  const parsedRows = parseStakeholderBreakdownRows(value);
  const rows = options?.sourceType === "overridden" ? applyEffectiveSharePercents(parsedRows) : parsedRows;
  const matchingRow = rows.find((row) => row.membershipId === membershipId && row.recipientType === "agent") ?? null;

  return matchingRow ? `${formatPercentLabel(matchingRow.sharePercent)}%` : "";
}

function mapStatementBankInformation(bankInformation: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  address: string | null;
  bankName: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  phoneNumber: string | null;
  taxIdType: AgentBankInformationTaxIdType | null;
  taxIdValue: string | null;
  dateOfBirth: Date | null;
  accountType: AgentBankInformationAccountType | null;
} | null): OfficeAgentPayoutStatementBankInformationRecord | null {
  if (!bankInformation) {
    return null;
  }

  const normalized = {
    firstName: bankInformation.firstName?.trim() ?? "",
    lastName: bankInformation.lastName?.trim() ?? "",
    email: bankInformation.email?.trim() ?? "",
    address: bankInformation.address?.trim() ?? "",
    bankName: bankInformation.bankName?.trim() ?? "",
    accountNumber: bankInformation.accountNumber?.trim() ?? "",
    routingNumber: bankInformation.routingNumber?.trim() ?? "",
    phoneNumber: bankInformation.phoneNumber?.trim() ?? "",
    taxIdType: bankInformation.taxIdType ?? "",
    taxIdTypeLabel: bankInformation.taxIdType ? agentBankInformationTaxIdTypeLabelMap[bankInformation.taxIdType] : "",
    taxIdValue: bankInformation.taxIdValue?.trim() ?? "",
    dateOfBirth: formatDateValue(bankInformation.dateOfBirth),
    accountType: bankInformation.accountType ?? "",
    accountTypeLabel: bankInformation.accountType ? agentBankInformationAccountTypeLabelMap[bankInformation.accountType] : ""
  } satisfies OfficeAgentPayoutStatementBankInformationRecord;

  return Object.values(normalized).some((value) => value.trim().length > 0) ? normalized : null;
}

function buildTransactionLabel(transaction: {
  title: string;
  address: string;
  city: string;
  state: string;
}) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}

function buildPropertyAddress(transaction: {
  address: string;
  city: string;
  state: string;
  zipCode: string;
}) {
  return [transaction.address, [transaction.city, transaction.state].filter(Boolean).join(", "), transaction.zipCode]
    .filter((part) => part && part.trim().length > 0)
    .join(" ");
}

function decimalToString(value: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(value ?? 0).toString();
}

function buildActivityLogChange(label: string, previousValue: string, nextValue: string): ActivityLogChange | null {
  return previousValue === nextValue
    ? null
    : {
        label,
        previousValue,
        nextValue
      };
}

function buildTimelineAuthorLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
    email?: string | null;
  };
}) {
  const fullName = `${membership.user.firstName} ${membership.user.lastName}`.trim();
  return fullName || membership.user.email?.trim() || "Unknown member";
}

function parseManualLineItemAmount(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Manual line item amount is required.");
  }

  if (!/^[+-]?(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/.test(trimmed)) {
    throw new Error("Manual line item amounts must be signed numbers with up to 2 decimal places.");
  }

  return normalizeCurrencyDecimal(new Prisma.Decimal(trimmed));
}

function normalizeManualLineItemInputs(items: UpdateAgentPayoutStatementManualLineItemInput[]) {
  const seenIds = new Set<string>();

  return items.map((item, index) => {
    const id = item.id?.trim();
    const memo = item.memo.trim();

    if (!memo) {
      throw new Error(`Manual line item ${index + 1} memo is required.`);
    }

    if (id) {
      if (seenIds.has(id)) {
        throw new Error("Manual line item ids must be unique.");
      }

      seenIds.add(id);
    }

    return {
      ...(id ? { id } : {}),
      memo,
      amount: parseManualLineItemAmount(item.amount)
    } satisfies NormalizedManualLineItemInput;
  });
}

function summarizeStatementManualLineItems(rows: StatementManualLineItemSubject[]) {
  return rows.reduce((sum, row) => sum.plus(new Prisma.Decimal(row.amount ?? 0)), new Prisma.Decimal(0));
}

function summarizeAgentPayoutStatementSnapshot(input: {
  invoiceLineItems: StatementSummarySubject[];
  manualLineItems: StatementManualLineItemSubject[];
}) {
  const invoiceSummary = summarizeAgentPayoutStatementRows(input.invoiceLineItems);
  const manualAdjustmentTotal = summarizeStatementManualLineItems(input.manualLineItems);

  return {
    ...invoiceSummary,
    invoicePayoutTotal: invoiceSummary.totalStatementAmount,
    manualAdjustmentTotal,
    finalPayoutTotal: invoiceSummary.totalStatementAmount.plus(manualAdjustmentTotal),
    lineItemCount: invoiceSummary.lineItemCount + input.manualLineItems.length
  };
}

function parseStoredStatementFeeBreakdown(value: Prisma.JsonValue | null | undefined): StoredTransactionFinanceFeeBreakdownRow[] {
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

function buildStatementLineFeeBreakdownSnapshot(value: Prisma.JsonValue | null | undefined) {
  return parseStoredStatementFeeBreakdown(value).map((row) => ({
    feeType: row.feeType,
    label: row.label,
    calculationType: row.calculationType,
    rate: row.rate,
    amount: row.amount,
    approvalRequired: row.approvalRequired,
    approvalStatus: row.approvalStatus,
    notes: row.notes
  })) satisfies Prisma.InputJsonValue;
}

function buildPostSplitBreakdownDetails(
  value: Prisma.JsonValue | null | undefined
): OfficeAgentPayoutStatementPostSplitDetailItem[] {
  const parsedRows = parseStoredStatementFeeBreakdown(value).filter(
    (row) =>
      row.calculationType === "post_split" &&
      postSplitStatementFeeDefinitions.some((definition) => definition.feeType === row.feeType)
  );

  if (parsedRows.length === 0) {
    return [];
  }

  const amountByFeeType = new Map(parsedRows.map((row) => [row.feeType, decimalToString(row.amount)]));

  return postSplitStatementFeeDefinitions.map((definition) => {
    const amountValue = amountByFeeType.get(definition.feeType) ?? "0";

    return {
      feeTypeValue: definition.feeType,
      feeTypeLabel: definition.label,
      amountLabel: formatCurrency(amountValue),
      amountValue
    };
  });
}

export function normalizeAgentPayoutStatementPeriodBasis(value: string | undefined | null): AgentPayoutStatementPeriodBasis {
  if (value === "closing_date") {
    return "closing_date";
  }

  if (value === "invoice_number") {
    return "invoice_number";
  }

  return "calculated_at";
}

export function getAgentPayoutStatementMatchDate(
  record: StatementDateSubject,
  periodBasis: AgentPayoutStatementPeriodBasis
) {
  return periodBasis === "closing_date" ? record.closingDate : record.calculatedAt;
}

export function normalizeAgentPayoutStatementInvoiceNumber(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeAgentPayoutStatementInvoiceNumbers(values: string[] | undefined | null) {
  return Array.from(
    new Set((values ?? []).map((value) => normalizeAgentPayoutStatementInvoiceNumber(value)).filter(Boolean))
  );
}

export function summarizeAgentPayoutStatementRows(rows: StatementSummarySubject[]) {
  const totals = rows.reduce(
    (summary, row) => ({
      totalGrossCommission: summary.totalGrossCommission.plus(new Prisma.Decimal(row.grossCommission ?? 0)),
      totalOfficeNet: summary.totalOfficeNet.plus(new Prisma.Decimal(row.officeNet ?? 0)),
      totalAgentNet: summary.totalAgentNet.plus(new Prisma.Decimal(row.agentNet ?? 0)),
      totalStatementAmount: summary.totalStatementAmount.plus(new Prisma.Decimal(row.statementAmount ?? 0))
    }),
    {
      totalGrossCommission: new Prisma.Decimal(0),
      totalOfficeNet: new Prisma.Decimal(0),
      totalAgentNet: new Prisma.Decimal(0),
      totalStatementAmount: new Prisma.Decimal(0)
    }
  );

  return {
    ...totals,
    lineItemCount: rows.length
  };
}

export function deriveAgentPayoutStatementPeriodRange(rows: Pick<StatementDateSubject, "calculatedAt">[]) {
  if (!rows.length) {
    return null;
  }

  let periodStart = rows[0].calculatedAt;
  let periodEnd = rows[0].calculatedAt;

  for (const row of rows) {
    if (row.calculatedAt < periodStart) {
      periodStart = row.calculatedAt;
    }

    if (row.calculatedAt > periodEnd) {
      periodEnd = row.calculatedAt;
    }
  }

  return {
    periodStart,
    periodEnd
  };
}

export function buildAgentPayoutStatementInvoiceOptions(
  rows: StatementInvoiceOptionSubject[]
): OfficeAgentPayoutStatementInvoiceOption[] {
  const invoiceGroups = new Map<
    string,
    {
      invoiceNumber: string;
      rowCount: number;
      totalStatementAmount: Prisma.Decimal;
      latestCalculatedAt: Date;
      isGenerateEligible: boolean;
    }
  >();

  for (const row of rows) {
    const invoiceNumber = normalizeAgentPayoutStatementInvoiceNumber(row.invoiceNumber);

    if (!invoiceNumber) {
      continue;
    }

    const existing =
      invoiceGroups.get(invoiceNumber) ??
      {
        invoiceNumber,
        rowCount: 0,
        totalStatementAmount: new Prisma.Decimal(0),
        latestCalculatedAt: row.calculatedAt,
        isGenerateEligible: false
      };

    existing.rowCount += 1;
    existing.totalStatementAmount = existing.totalStatementAmount.plus(new Prisma.Decimal(row.statementAmount ?? 0));
    existing.isGenerateEligible ||= row.status ? isCreatableAgentPayoutCalculationStatus(row.status) : false;

    if (row.calculatedAt > existing.latestCalculatedAt) {
      existing.latestCalculatedAt = row.calculatedAt;
    }

    invoiceGroups.set(invoiceNumber, existing);
  }

  return Array.from(invoiceGroups.values())
    .sort((left, right) => {
      if (left.latestCalculatedAt.getTime() !== right.latestCalculatedAt.getTime()) {
        return right.latestCalculatedAt.getTime() - left.latestCalculatedAt.getTime();
      }

      return left.invoiceNumber.localeCompare(right.invoiceNumber);
    })
    .map((group) => ({
      invoiceNumber: group.invoiceNumber,
      label: `${group.invoiceNumber} · ${group.rowCount} row(s) · ${formatCurrency(group.totalStatementAmount)}`,
      rowCount: group.rowCount,
      totalStatementAmountLabel: formatCurrency(group.totalStatementAmount),
      totalStatementAmountValue: decimalToString(group.totalStatementAmount),
      isGenerateEligible: group.isGenerateEligible
    }));
}

function buildAgentPayoutStatementWhere(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  statuses: readonly CommissionCalculationStatus[];
}) {
  return {
    organizationId: input.organizationId,
    ...(buildOfficeOrGlobalCommissionWhere(input.officeId) ?? {}),
    membershipId: input.membershipId,
    recipientType: "agent",
    status: {
      in: [...input.statuses]
    }
  } satisfies Prisma.CommissionCalculationWhereInput;
}

function getAgentPayoutStatementInvoiceNumber(calculation: { transaction: { additionalFields: Prisma.JsonValue | null } }) {
  const additionalFields = normalizeAdditionalFields(calculation.transaction.additionalFields);
  return normalizeAgentPayoutStatementInvoiceNumber(additionalFields.invoiceNumber);
}

function filterAgentPayoutStatementCalculationsByInvoiceNumbers<
  TCalculation extends {
    transaction: {
      additionalFields: Prisma.JsonValue | null;
    };
  }
>(calculations: TCalculation[], invoiceNumbers: string[]) {
  const invoiceNumberSet = new Set(normalizeAgentPayoutStatementInvoiceNumbers(invoiceNumbers));

  if (!invoiceNumberSet.size) {
    return [] as TCalculation[];
  }

  return calculations.filter((calculation) =>
    invoiceNumberSet.has(getAgentPayoutStatementInvoiceNumber(calculation))
  );
}

function buildAgentPayoutStatementWorkspaceHref(input: {
  membershipId: string;
  invoiceNumbers: string[];
  statementId?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("membershipId", input.membershipId);

  for (const invoiceNumber of input.invoiceNumbers) {
    searchParams.append("invoiceNumber", invoiceNumber);
  }

  if (input.statementId?.trim()) {
    searchParams.set("statementId", input.statementId.trim());
  }

  return `/office/accounting?${searchParams.toString()}`;
}

function buildAgentPayoutStatementSelfServiceHref(statementId: string) {
  return `/office/payout-statements/${statementId}`;
}

function normalizeStatementMessage(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function reviewStatusKeepsConfirmation(status: AgentPayoutStatementReviewStatus) {
  return status === "confirmed" || status === "paid";
}

function deriveStatementConfirmedAt(
  previousStatus: AgentPayoutStatementReviewStatus,
  nextStatus: AgentPayoutStatementReviewStatus,
  confirmedAt: Date | null
) {
  if (!reviewStatusKeepsConfirmation(nextStatus)) {
    return null;
  }

  return reviewStatusKeepsConfirmation(previousStatus) ? confirmedAt : null;
}

function resolveStatementAdminNotificationMembershipIds(input: {
  lastSharedByMembershipId?: string | null;
  generatedByMembershipId?: string | null;
  fallbackMembershipId: string;
}) {
  return Array.from(
    new Set(
      [
        input.lastSharedByMembershipId?.trim() || "",
        input.generatedByMembershipId?.trim() || "",
        input.fallbackMembershipId.trim()
      ].filter(Boolean)
    )
  );
}

function mapCandidateRow(calculation: StatementCandidateCalculation): OfficeAgentPayoutStatementCandidateRow {
  return {
    id: calculation.id,
    transactionId: calculation.transactionId,
    transactionLabel: buildTransactionLabel(calculation.transaction),
    transactionHref: `/office/transactions/${calculation.transactionId}`,
    propertyAddress: buildPropertyAddress(calculation.transaction),
    invoiceNumber: getAgentPayoutStatementInvoiceNumber(calculation),
    closingDate: formatDateValue(calculation.transaction.closingDate),
    calculatedAt: formatDateValue(calculation.calculatedAt),
    status: commissionCalculationStatusLabelMap[calculation.status],
    statusValue: calculation.status,
    grossCommissionLabel: formatCurrency(calculation.grossCommission),
    grossCommissionValue: decimalToString(calculation.grossCommission),
    feesLabel: formatCurrency(calculation.fees),
    feesValue: decimalToString(calculation.fees),
    officeNetLabel: formatCurrency(calculation.officeNet),
    officeNetValue: decimalToString(calculation.officeNet),
    agentNetLabel: formatCurrency(calculation.agentNet),
    agentNetValue: decimalToString(calculation.agentNet),
    statementAmountLabel: formatCurrency(calculation.statementAmount),
    statementAmountValue: decimalToString(calculation.statementAmount),
    isGenerateEligible: isCreatableAgentPayoutCalculationStatus(calculation.status)
  };
}

function buildStatementLineSnapshot(
  calculation: StatementPersistCalculation
): Omit<Prisma.AgentPayoutStatementLineCreateManyInput, "statementId"> {
  const additionalFields = normalizeAdditionalFields(calculation.transaction.additionalFields);
  const commissionRate = parseStakeholderBreakdownSharePercent(
    calculation.transactionFinanceCalculationVersion?.stakeholderBreakdown,
    calculation.membershipId,
    {
      sourceType: calculation.transactionFinanceCalculationVersion?.sourceType ?? null
    }
  );

  return {
    commissionCalculationId: calculation.id,
    transactionId: calculation.transactionId,
    transactionLabel: buildTransactionLabel(calculation.transaction),
    propertyAddress: buildPropertyAddress(calculation.transaction),
    transactionCreatedAt: calculation.transaction.createdAt,
    invoiceNumber: additionalFields.invoiceNumber?.trim() ?? "",
    ownerName: buildOwnerLabel(calculation.transaction.ownerMembership),
    buildingName: additionalFields.buildingName?.trim() ?? "",
    unitNumber: additionalFields.unitNumber?.trim() ?? "",
    commissionRate,
    closingDate: calculation.transaction.closingDate,
    calculatedAt: calculation.calculatedAt,
    statusAtGeneration: calculation.status,
    grossCommission: calculation.grossCommission,
    referralFee: calculation.referralFee,
    fees: calculation.fees,
    officeNet: calculation.officeNet,
    agentNet: calculation.agentNet,
    statementAmount: calculation.statementAmount,
    feeBreakdown: buildStatementLineFeeBreakdownSnapshot(calculation.transactionFinanceCalculationVersion?.feeBreakdown)
  };
}

function mapStatementRecord(record: StatementRecordWithRelations): OfficeAgentPayoutStatementRecord {
  return {
    id: record.id,
    membershipId: record.membershipId,
    agentLabel: formatMembershipLabel(record.membership),
    periodStart: formatDateValue(record.periodStart),
    periodEnd: formatDateValue(record.periodEnd),
    periodLabel: formatPeriodLabel(record.periodStart, record.periodEnd),
    periodBasis: record.periodBasis,
    periodBasisLabel: formatPeriodBasisLabel(record.periodBasis),
    generatedAt: record.generatedAt.toISOString(),
    generatedAtLabel: formatDateTimeValue(record.generatedAt, record.organization.timezone),
    generatedByLabel: record.generatedByMembership ? formatMembershipLabel(record.generatedByMembership) : "System",
    reviewStatus: record.reviewStatus,
    reviewStatusLabel: statementReviewStatusLabelMap[record.reviewStatus],
    lastSharedAt: record.lastSharedAt?.toISOString() ?? "",
    lastSharedAtLabel: formatDateTimeValue(record.lastSharedAt, record.organization.timezone),
    confirmedAt: record.confirmedAt?.toISOString() ?? "",
    confirmedAtLabel: formatDateTimeValue(record.confirmedAt, record.organization.timezone),
    lineItemCount: record.lineItemCount,
    totalStatementAmountLabel: formatCurrency(record.totalStatementAmount),
    totalStatementAmountValue: decimalToString(record.totalStatementAmount)
  };
}

function mapStatementDetail(
  record: StatementRecordWithRelations,
  options?: {
    liveCommissionRateByCalculationId?: Map<string, string>;
    livePostSplitBreakdownByCalculationId?: Map<string, OfficeAgentPayoutStatementPostSplitDetailItem[]>;
  }
): OfficeAgentPayoutStatementDetail {
  const snapshotSummary = summarizeAgentPayoutStatementSnapshot({
    invoiceLineItems: record.lineItems.map((lineItem) => ({
      grossCommission: lineItem.grossCommission,
      officeNet: lineItem.officeNet,
      agentNet: lineItem.agentNet,
      statementAmount: lineItem.statementAmount
    })),
    manualLineItems: record.manualLineItems.map((lineItem) => ({
      amount: lineItem.amount
    }))
  });

  return {
    id: record.id,
    organizationLabel: record.organization.name,
    officeLabel: record.office?.name ?? record.organization.name,
    membershipId: record.membershipId,
    agentLabel: formatMembershipLabel(record.membership),
    periodStart: formatDateValue(record.periodStart),
    periodEnd: formatDateValue(record.periodEnd),
    periodLabel: formatPeriodLabel(record.periodStart, record.periodEnd),
    periodBasis: record.periodBasis,
    periodBasisLabel: formatPeriodBasisLabel(record.periodBasis),
    generatedAt: record.generatedAt.toISOString(),
    generatedAtLabel: formatDateTimeValue(record.generatedAt, record.organization.timezone),
    generatedByLabel: record.generatedByMembership ? formatMembershipLabel(record.generatedByMembership) : "System",
    reviewStatus: record.reviewStatus,
    reviewStatusLabel: statementReviewStatusLabelMap[record.reviewStatus],
    lastSharedAt: record.lastSharedAt?.toISOString() ?? "",
    lastSharedAtLabel: formatDateTimeValue(record.lastSharedAt, record.organization.timezone),
    lastSharedByLabel: record.lastSharedByMembership ? formatMembershipLabel(record.lastSharedByMembership) : "",
    agentRespondedAt: record.agentRespondedAt?.toISOString() ?? "",
    agentRespondedAtLabel: formatDateTimeValue(record.agentRespondedAt, record.organization.timezone),
    confirmedAt: record.confirmedAt?.toISOString() ?? "",
    confirmedAtLabel: formatDateTimeValue(record.confirmedAt, record.organization.timezone),
    lineItemCount: record.lineItemCount,
    invoicePayoutTotalLabel: formatCurrency(snapshotSummary.invoicePayoutTotal),
    invoicePayoutTotalValue: decimalToString(snapshotSummary.invoicePayoutTotal),
    manualAdjustmentTotalLabel: formatCurrency(snapshotSummary.manualAdjustmentTotal),
    manualAdjustmentTotalValue: decimalToString(snapshotSummary.manualAdjustmentTotal),
    totalStatementAmountLabel: formatCurrency(record.totalStatementAmount),
    totalStatementAmountValue: decimalToString(record.totalStatementAmount),
    totalGrossCommissionLabel: formatCurrency(record.totalGrossCommission),
    totalGrossCommissionValue: decimalToString(record.totalGrossCommission),
    totalAgentNetLabel: formatCurrency(record.totalAgentNet),
    totalAgentNetValue: decimalToString(record.totalAgentNet),
    bankInformation: mapStatementBankInformation(record.membership.agentBankInformation),
    timeline: record.messages.map((message) => ({
      id: message.id,
      messageType: message.messageType,
      messageTypeLabel: statementMessageTypeLabelMap[message.messageType],
      authorLabel: buildTimelineAuthorLabel(message.membership),
      body: message.body.trim(),
      createdAt: message.createdAt.toISOString(),
      createdAtLabel: formatDateTimeValue(message.createdAt, record.organization.timezone)
    })),
    manualLineItems: record.manualLineItems.map((lineItem) => ({
      id: lineItem.id,
      memo: lineItem.memo,
      amountLabel: formatCurrency(lineItem.amount),
      amountValue: decimalToString(lineItem.amount)
    })),
    lineItems: record.lineItems.map((lineItem) => {
      const liveCommissionRate = options?.liveCommissionRateByCalculationId?.get(lineItem.commissionCalculationId) ?? "";
      const postSplitBreakdown =
        options?.livePostSplitBreakdownByCalculationId?.get(lineItem.commissionCalculationId) ??
        buildPostSplitBreakdownDetails(lineItem.feeBreakdown);

      return {
        id: lineItem.id,
        commissionCalculationId: lineItem.commissionCalculationId,
        transactionId: lineItem.transactionId,
        transactionLabel: lineItem.transactionLabel,
        transactionHref: `/office/transactions/${lineItem.transactionId}`,
        propertyAddress: lineItem.propertyAddress,
        creationDate: formatDateValue(lineItem.transactionCreatedAt),
        invoiceNumber: lineItem.invoiceNumber,
        ownerName: lineItem.ownerName,
        buildingName: lineItem.buildingName,
        unitNumber: lineItem.unitNumber,
        closingDate: formatDateValue(lineItem.closingDate),
        calculatedAt: formatDateValue(lineItem.calculatedAt),
        commissionRate: liveCommissionRate.trim().length > 0 ? liveCommissionRate : lineItem.commissionRate,
        statusAtGeneration: commissionCalculationStatusLabelMap[lineItem.statusAtGeneration],
        statusAtGenerationValue: lineItem.statusAtGeneration,
        grossCommissionLabel: formatCurrency(lineItem.grossCommission),
        grossCommissionValue: decimalToString(lineItem.grossCommission),
        preSplitLabel: formatCurrency(lineItem.referralFee),
        preSplitValue: decimalToString(lineItem.referralFee),
        referralFeeLabel: formatCurrency(lineItem.referralFee),
        referralFeeValue: decimalToString(lineItem.referralFee),
        postSplitLabel: formatCurrency(lineItem.fees),
        postSplitValue: decimalToString(lineItem.fees),
        postSplitBreakdown,
        feesLabel: formatCurrency(lineItem.fees),
        feesValue: decimalToString(lineItem.fees),
        agentNetLabel: formatCurrency(lineItem.agentNet),
        agentNetValue: decimalToString(lineItem.agentNet),
        netCommissionLabel: formatCurrency(lineItem.statementAmount),
        netCommissionValue: decimalToString(lineItem.statementAmount),
        statementAmountLabel: formatCurrency(lineItem.statementAmount),
        statementAmountValue: decimalToString(lineItem.statementAmount)
      };
    })
  };
}

async function listSelectableAgentPayoutMemberships(input: {
  organizationId: string;
  officeId?: string | null;
}) {
  const [calculationMemberships, statementMemberships] = await Promise.all([
    prisma.commissionCalculation.findMany({
      where: {
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalCommissionWhere(input.officeId) ?? {}),
        recipientType: "agent",
        membershipId: {
          not: null
        },
        status: {
          in: creatableAgentPayoutCalculationStatuses
        }
      },
      select: {
        membershipId: true
      },
      distinct: ["membershipId"]
    }),
    prisma.agentPayoutStatement.findMany({
      where: {
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalStatementWhere(input.officeId) ?? {})
      },
      select: {
        membershipId: true
      },
      distinct: ["membershipId"]
    })
  ]);

  const selectableMembershipIds = Array.from(
    new Set(
      [...calculationMemberships, ...statementMemberships]
        .map((row) => row.membershipId?.trim() ?? "")
        .filter(Boolean)
    )
  );

  if (selectableMembershipIds.length === 0) {
    return [];
  }

  return prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: {
        in: selectableAgentMembershipStatuses
      },
      id: {
        in: selectableMembershipIds
      }
    },
    include: {
      user: true
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
  });
}

export async function getOfficeAgentPayoutStatementDetail(
  input: GetOfficeAgentPayoutStatementDetailInput
): Promise<OfficeAgentPayoutStatementDetail | null> {
  const statement = await prisma.agentPayoutStatement.findFirst({
    where: {
      id: input.statementId,
      organizationId: input.organizationId,
      ...(buildOfficeOrGlobalStatementWhere(input.officeId) ?? {})
    },
    include: {
      membership: {
        include: {
          user: true,
          agentBankInformation: true
        }
      },
      office: true,
      organization: true,
      generatedByMembership: {
        include: {
          user: true
        }
      },
      lastSharedByMembership: {
        include: {
          user: true
        }
      },
      messages: {
        include: {
          membership: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      },
      manualLineItems: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      },
      lineItems: {
        orderBy: [{ calculatedAt: "desc" }, { transactionLabel: "asc" }]
      }
    }
  });

  if (!statement) {
    return null;
  }

  const commissionCalculationIds = Array.from(new Set(statement.lineItems.map((lineItem) => lineItem.commissionCalculationId)));
  const liveCalculations =
    commissionCalculationIds.length > 0
      ? await prisma.commissionCalculation.findMany({
          where: {
            organizationId: input.organizationId,
            id: {
              in: commissionCalculationIds
            }
          },
          include: {
            transactionFinanceCalculationVersion: true
          }
        })
      : [];
  const liveCommissionRateByCalculationId = new Map(
    liveCalculations.map((calculation) => [
      calculation.id,
      parseStakeholderBreakdownSharePercent(
        calculation.transactionFinanceCalculationVersion?.stakeholderBreakdown,
        calculation.membershipId,
        {
          sourceType: calculation.transactionFinanceCalculationVersion?.sourceType ?? null
        }
      )
    ])
  );
  const livePostSplitBreakdownByCalculationId = new Map(
    liveCalculations
      .map((calculation) => [
        calculation.id,
        buildPostSplitBreakdownDetails(calculation.transactionFinanceCalculationVersion?.feeBreakdown)
      ] as const)
      .filter(([, breakdown]) => breakdown.length > 0)
  );

  return mapStatementDetail(statement, {
    liveCommissionRateByCalculationId,
    livePostSplitBreakdownByCalculationId
  });
}

export async function getOfficeAgentPayoutStatementsWorkspaceSnapshot(
  input: GetOfficeAgentPayoutStatementsWorkspaceInput
): Promise<OfficeAgentPayoutStatementsWorkspaceSnapshot> {
  const membershipId = input.membershipId?.trim() ?? "";
  const requestedInvoiceNumbers = normalizeAgentPayoutStatementInvoiceNumbers(input.invoiceNumbers);

  const [memberOptions, history, selectedStatement, eligibleCalculations] = await Promise.all([
    listSelectableAgentPayoutMemberships({
      organizationId: input.organizationId,
      officeId: input.officeId
    }),
    prisma.agentPayoutStatement.findMany({
      where: {
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalStatementWhere(input.officeId) ?? {}),
        ...(membershipId ? { membershipId } : {})
      },
      include: {
        membership: {
          include: {
            user: true,
            agentBankInformation: true
          }
        },
        office: true,
        organization: true,
        generatedByMembership: {
          include: {
            user: true
          }
        },
        lastSharedByMembership: {
          include: {
            user: true
          }
        },
        messages: {
          include: {
            membership: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        },
        manualLineItems: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        },
        lineItems: {
          orderBy: [{ calculatedAt: "desc" }, { transactionLabel: "asc" }]
        }
      },
      orderBy: [{ generatedAt: "desc" }],
      take: 30
    }),
    input.statementId?.trim()
      ? getOfficeAgentPayoutStatementDetail({
          organizationId: input.organizationId,
          officeId: input.officeId,
          statementId: input.statementId
        })
      : Promise.resolve(null),
    membershipId
      ? prisma.commissionCalculation.findMany({
          where: buildAgentPayoutStatementWhere({
            organizationId: input.organizationId,
            officeId: input.officeId,
            membershipId,
            statuses: creatableAgentPayoutCalculationStatuses
          }),
          include: {
            transaction: true
          },
          orderBy: [{ calculatedAt: "desc" }, { transaction: { closingDate: "desc" } }]
        })
      : Promise.resolve([] as StatementCandidateCalculation[])
  ]);

  const invoiceOptions = buildAgentPayoutStatementInvoiceOptions(
    eligibleCalculations.map((calculation) => ({
      invoiceNumber: getAgentPayoutStatementInvoiceNumber(calculation),
      calculatedAt: calculation.calculatedAt,
      statementAmount: calculation.statementAmount,
      status: calculation.status
    }))
  );
  const availableInvoiceNumberSet = new Set(invoiceOptions.map((option) => option.invoiceNumber));
  const invoiceNumbers = requestedInvoiceNumbers.filter((invoiceNumber) => availableInvoiceNumberSet.has(invoiceNumber));
  const candidateRows =
    membershipId && invoiceNumbers.length > 0
      ? filterAgentPayoutStatementCalculationsByInvoiceNumbers(eligibleCalculations, invoiceNumbers)
      : [];

  return {
    filters: {
      membershipId,
      invoiceNumbers,
      memberOptions: memberOptions.map((membership) => ({
        id: membership.id,
        label: formatMembershipLabel(membership)
      })),
      invoiceOptions
    },
    candidateRows: candidateRows.map(mapCandidateRow),
    history: history.map(mapStatementRecord),
    selectedStatement
  };
}

export async function createAgentPayoutStatement(input: CreateAgentPayoutStatementInput) {
  const membershipId = input.membershipId.trim();
  const invoiceNumbers = normalizeAgentPayoutStatementInvoiceNumbers(input.invoiceNumbers);
  const commissionCalculationIds = [...new Set(input.commissionCalculationIds.map((value) => value.trim()).filter(Boolean))];

  if (!membershipId) {
    throw new Error("Membership is required.");
  }

  if (!invoiceNumbers.length) {
    throw new Error("Select at least one invoice number.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId: input.organizationId,
        status: {
          in: selectableAgentMembershipStatuses
        }
      },
      include: {
        user: true
      }
    });

    if (!membership) {
      throw new Error("Active or invited membership not found for statement generation.");
    }

    const eligibleCalculations = await tx.commissionCalculation.findMany({
      where: buildAgentPayoutStatementWhere({
        organizationId: input.organizationId,
        officeId: input.officeId,
        membershipId,
        statuses: creatableAgentPayoutCalculationStatuses
      }),
      include: {
        transaction: {
          include: {
            ownerMembership: {
              include: {
                user: true
              }
            }
          }
        },
        transactionFinanceCalculationVersion: true
      },
      orderBy: [{ calculatedAt: "desc" }, { transaction: { closingDate: "desc" } }]
    });

    const invoiceScopedCalculations = filterAgentPayoutStatementCalculationsByInvoiceNumbers(
      eligibleCalculations,
      invoiceNumbers
    );

    if (invoiceScopedCalculations.length === 0) {
      throw new Error("No available commission rows were found for the selected invoice numbers.");
    }

    const calculations =
      commissionCalculationIds.length > 0
        ? invoiceScopedCalculations.filter((calculation) => commissionCalculationIds.includes(calculation.id))
        : invoiceScopedCalculations;

    if (commissionCalculationIds.length > 0 && calculations.length !== commissionCalculationIds.length) {
      throw new Error("Some selected commission rows are no longer available for the selected invoices.");
    }

    if (calculations.length === 0) {
      throw new Error("Select at least one commission row for this statement.");
    }

    const periodRange = deriveAgentPayoutStatementPeriodRange(
      calculations.map((calculation) => ({
        calculatedAt: calculation.calculatedAt
      }))
    );

    if (!periodRange) {
      throw new Error("No available commission rows were found for this statement.");
    }

    const includedInvoiceNumbers = normalizeAgentPayoutStatementInvoiceNumbers(
      calculations.map((calculation) => getAgentPayoutStatementInvoiceNumber(calculation))
    );
    const totals = summarizeAgentPayoutStatementSnapshot({
      invoiceLineItems: calculations,
      manualLineItems: []
    });
    const statement = await tx.agentPayoutStatement.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership.officeId,
        membershipId: membership.id,
        periodStart: periodRange.periodStart,
        periodEnd: periodRange.periodEnd,
        periodBasis: "invoice_number",
        reviewStatus: "draft",
        generatedByMembershipId: input.actorMembershipId,
        lineItemCount: totals.lineItemCount,
        totalStatementAmount: totals.finalPayoutTotal,
        totalGrossCommission: totals.totalGrossCommission,
        totalOfficeNet: totals.totalOfficeNet,
        totalAgentNet: totals.totalAgentNet
      }
    });

    await tx.agentPayoutStatementLine.createMany({
      data: calculations.map((calculation) => ({
        statementId: statement.id,
        ...buildStatementLineSnapshot(calculation)
      }))
    });

    await tx.commissionCalculation.updateMany({
      where: {
        id: {
          in: calculations.map((calculation) => calculation.id)
        },
        status: {
          in: [...advanceToPayableAgentPayoutCalculationStatuses]
        }
      },
      data: {
        status: "payable"
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_payout_statement",
      entityId: statement.id,
      action: activityLogActions.agentPayoutStatementGenerated,
      payload: {
        officeId: input.officeId ?? membership.officeId ?? null,
        objectLabel: `${formatMembershipLabel(membership)} payout statement`,
        contextHref: buildAgentPayoutStatementWorkspaceHref({
          membershipId: membership.id,
          invoiceNumbers: includedInvoiceNumbers,
          statementId: statement.id
        }),
        details: [
          `Agent: ${formatMembershipLabel(membership)}`,
          `Period: ${formatPeriodLabel(periodRange.periodStart, periodRange.periodEnd)}`,
          "Basis: Invoice number",
          `Invoices: ${includedInvoiceNumbers.join(", ")}`,
          `Line items: ${totals.lineItemCount}`,
          `Total payout: ${formatCurrency(totals.finalPayoutTotal)}`
        ]
      }
    });

    return {
      statementId: statement.id
    };
  });
}

export async function sendAgentPayoutStatementToAgent(input: SendAgentPayoutStatementToAgentInput) {
  const statementId = input.statementId.trim();
  const message = normalizeStatementMessage(input.message);

  if (!statementId) {
    throw new Error("Statement is required.");
  }

  return prisma.$transaction(async (tx) => {
    const statement = await tx.agentPayoutStatement.findFirst({
      where: {
        id: statementId,
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalStatementWhere(input.officeId) ?? {})
      },
      include: {
        membership: {
          include: {
            user: true
          }
        },
        lineItems: {
          select: {
            invoiceNumber: true
          }
        }
      }
    });

    if (!statement) {
      return null;
    }

    const previousStatus = statement.reviewStatus;
    const nextStatus: AgentPayoutStatementReviewStatus = "awaiting_agent";
    const now = new Date();
    const messageType: AgentPayoutStatementMessageType =
      previousStatus === "revision_requested" || Boolean(statement.lastSharedAt) ? "finance_response" : "sent_to_agent";
    const invoiceNumbers = normalizeAgentPayoutStatementInvoiceNumbers(
      statement.lineItems.map((lineItem) => lineItem.invoiceNumber)
    );

    await tx.agentPayoutStatement.update({
      where: {
        id: statement.id
      },
      data: {
        reviewStatus: nextStatus,
        lastSharedAt: now,
        lastSharedByMembershipId: input.actorMembershipId,
        confirmedAt: null
      }
    });

    await tx.agentPayoutStatementMessage.create({
      data: {
        statementId: statement.id,
        organizationId: statement.organizationId,
        officeId: statement.officeId,
        membershipId: input.actorMembershipId,
        messageType,
        body: message
      }
    });

    await createNotificationsForMemberships(tx, {
      organizationId: input.organizationId,
      officeId: statement.officeId,
      membershipIds: [statement.membershipId],
      type: NotificationType.payout_statement_ready,
      category: NotificationCategory.system,
      severity: NotificationSeverity.critical,
      title:
        previousStatus === "revision_requested"
          ? "Action required: review your updated payout statement"
          : "Action required: review your payout statement",
      body:
        previousStatus === "revision_requested"
          ? "Finance updated your payout statement. Open it in Acre to confirm it or request another revision."
          : "Finance sent you a payout statement that needs your review in Acre. Confirm it or request a revision.",
      actionUrl: buildAgentPayoutStatementSelfServiceHref(statement.id)
    });

    const changes = [
      buildActivityLogChange("Review status", statementReviewStatusLabelMap[previousStatus], statementReviewStatusLabelMap[nextStatus])
    ].filter((change): change is ActivityLogChange => Boolean(change));

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_payout_statement",
      entityId: statement.id,
      action: activityLogActions.agentPayoutStatementSentToAgent,
      payload: {
        officeId: statement.officeId,
        objectLabel: `${formatMembershipLabel(statement.membership)} payout statement`,
        contextHref: buildAgentPayoutStatementWorkspaceHref({
          membershipId: statement.membershipId,
          invoiceNumbers,
          statementId: statement.id
        }),
        details: [
          `Agent: ${formatMembershipLabel(statement.membership)}`,
          `Review status: ${statementReviewStatusLabelMap[nextStatus]}`,
          `Invoices: ${invoiceNumbers.join(", ") || "—"}`,
          ...(message ? [`Message: ${message}`] : [])
        ],
        changes
      }
    });

    return {
      statementId: statement.id
    };
  });
}

export async function respondToAgentPayoutStatement(input: RespondToAgentPayoutStatementInput) {
  const statementId = input.statementId.trim();
  const message = normalizeStatementMessage(input.message);

  if (!statementId) {
    throw new Error("Statement is required.");
  }

  if (input.response === "request_revision" && !message) {
    throw new Error("Explain what should change before requesting a revision.");
  }

  return prisma.$transaction(async (tx) => {
    const statement = await tx.agentPayoutStatement.findFirst({
      where: {
        id: statementId,
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalStatementWhere(input.officeId) ?? {})
      },
      include: {
        membership: {
          include: {
            user: true
          }
        },
        lineItems: {
          select: {
            invoiceNumber: true
          }
        }
      }
    });

    if (!statement) {
      return null;
    }

    if (statement.membershipId !== input.actorMembershipId) {
      throw new Error("You can only review your own payout statement.");
    }

    if (statement.reviewStatus !== "awaiting_agent") {
      throw new Error("This payout statement is not currently awaiting your review.");
    }

    const now = new Date();
    const nextStatus: AgentPayoutStatementReviewStatus =
      input.response === "confirm" ? "confirmed" : "revision_requested";
    const messageType: AgentPayoutStatementMessageType =
      input.response === "confirm" ? "agent_confirmed" : "agent_revision_requested";
    const invoiceNumbers = normalizeAgentPayoutStatementInvoiceNumbers(
      statement.lineItems.map((lineItem) => lineItem.invoiceNumber)
    );

    await tx.agentPayoutStatement.update({
      where: {
        id: statement.id
      },
      data: {
        reviewStatus: nextStatus,
        agentRespondedAt: now,
        confirmedAt: input.response === "confirm" ? now : null
      }
    });

    await tx.agentPayoutStatementMessage.create({
      data: {
        statementId: statement.id,
        organizationId: statement.organizationId,
        officeId: statement.officeId,
        membershipId: input.actorMembershipId,
        messageType,
        body: message
      }
    });

    const adminNotificationRecipients = resolveStatementAdminNotificationMembershipIds({
      lastSharedByMembershipId: statement.lastSharedByMembershipId,
      generatedByMembershipId: statement.generatedByMembershipId,
      fallbackMembershipId: input.actorMembershipId
    }).filter((membershipId) => membershipId !== input.actorMembershipId);

    if (adminNotificationRecipients.length > 0) {
      await createNotificationsForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: statement.officeId,
        membershipIds: adminNotificationRecipients,
        type:
          input.response === "confirm"
            ? NotificationType.payout_statement_confirmed
            : NotificationType.payout_statement_revision_requested,
        category: NotificationCategory.system,
        severity: input.response === "confirm" ? NotificationSeverity.info : NotificationSeverity.warning,
        title:
          input.response === "confirm"
            ? `${formatMembershipLabel(statement.membership)} confirmed the payout statement`
            : `${formatMembershipLabel(statement.membership)} requested payout statement changes`,
        body:
          input.response === "confirm"
            ? "The agent confirmed this payout statement inside the system."
            : "The agent requested statement changes inside the system. Open the statement to review the request.",
        actionUrl: buildAgentPayoutStatementWorkspaceHref({
          membershipId: statement.membershipId,
          invoiceNumbers,
          statementId: statement.id
        })
      });
    }

    const changes = [
      buildActivityLogChange("Review status", statementReviewStatusLabelMap[statement.reviewStatus], statementReviewStatusLabelMap[nextStatus])
    ].filter((change): change is ActivityLogChange => Boolean(change));

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_payout_statement",
      entityId: statement.id,
      action:
        input.response === "confirm"
          ? activityLogActions.agentPayoutStatementConfirmed
          : activityLogActions.agentPayoutStatementRevisionRequested,
      payload: {
        officeId: statement.officeId,
        objectLabel: `${formatMembershipLabel(statement.membership)} payout statement`,
        contextHref: buildAgentPayoutStatementSelfServiceHref(statement.id),
        details: [
          `Agent: ${formatMembershipLabel(statement.membership)}`,
          `Review status: ${statementReviewStatusLabelMap[nextStatus]}`,
          ...(message ? [`Message: ${message}`] : [])
        ],
        changes
      }
    });

    return {
      statementId: statement.id
    };
  });
}

export async function updateAgentPayoutStatementReviewStatus(input: UpdateAgentPayoutStatementReviewStatusInput) {
  const statementId = input.statementId.trim();

  if (!statementId) {
    throw new Error("Statement is required.");
  }

  return prisma.$transaction(async (tx) => {
    const statement = await tx.agentPayoutStatement.findFirst({
      where: {
        id: statementId,
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalStatementWhere(input.officeId) ?? {})
      },
      include: {
        membership: {
          include: {
            user: true
          }
        },
        lineItems: {
          select: {
            invoiceNumber: true
          }
        }
      }
    });

    if (!statement) {
      return null;
    }

    if (statement.reviewStatus === input.reviewStatus) {
      return {
        statementId: statement.id
      };
    }

    const invoiceNumbers = normalizeAgentPayoutStatementInvoiceNumbers(
      statement.lineItems.map((lineItem) => lineItem.invoiceNumber)
    );
    const nextConfirmedAt = deriveStatementConfirmedAt(statement.reviewStatus, input.reviewStatus, statement.confirmedAt);

    await tx.agentPayoutStatement.update({
      where: {
        id: statement.id
      },
      data: {
        reviewStatus: input.reviewStatus,
        confirmedAt: nextConfirmedAt
      }
    });

    const changes = [
      buildActivityLogChange("Review status", statementReviewStatusLabelMap[statement.reviewStatus], statementReviewStatusLabelMap[input.reviewStatus])
    ].filter((change): change is ActivityLogChange => Boolean(change));

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_payout_statement",
      entityId: statement.id,
      action: activityLogActions.agentPayoutStatementAdjusted,
      payload: {
        officeId: statement.officeId,
        objectLabel: `${formatMembershipLabel(statement.membership)} payout statement`,
        contextHref: buildAgentPayoutStatementWorkspaceHref({
          membershipId: statement.membershipId,
          invoiceNumbers,
          statementId: statement.id
        }),
        details: [`Review status: ${statementReviewStatusLabelMap[input.reviewStatus]}`],
        changes
      }
    });

    return {
      statementId: statement.id
    };
  });
}

export async function updateAgentPayoutStatementManualLineItems(input: UpdateAgentPayoutStatementManualLineItemsInput) {
  const statementId = input.statementId.trim();

  if (!statementId) {
    throw new Error("Statement is required.");
  }

  const normalizedManualLineItems = normalizeManualLineItemInputs(input.manualLineItems);

  return prisma.$transaction(async (tx) => {
    const statement = await tx.agentPayoutStatement.findFirst({
      where: {
        id: statementId,
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalStatementWhere(input.officeId) ?? {})
      },
      include: {
        membership: {
          include: {
            user: true
          }
        },
        lineItems: {
          select: {
            invoiceNumber: true,
            grossCommission: true,
            officeNet: true,
            agentNet: true,
            statementAmount: true
          }
        },
        manualLineItems: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        }
      }
    });

    if (!statement) {
      return null;
    }

    const existingManualLineItemsById = new Map(statement.manualLineItems.map((lineItem) => [lineItem.id, lineItem]));

    for (const lineItem of normalizedManualLineItems) {
      if (lineItem.id && !existingManualLineItemsById.has(lineItem.id)) {
        throw new Error("Some manual line items are no longer available on this statement.");
      }
    }

    const retainedIds = new Set(normalizedManualLineItems.map((lineItem) => lineItem.id).filter(Boolean));
    const removedItems = statement.manualLineItems.filter((lineItem) => !retainedIds.has(lineItem.id));
    const itemsToCreate = normalizedManualLineItems.filter((lineItem) => !lineItem.id);
    const itemsToUpdate = normalizedManualLineItems.filter((lineItem) => {
      if (!lineItem.id) {
        return false;
      }

      const existing = existingManualLineItemsById.get(lineItem.id);
      return Boolean(existing) && (existing?.memo !== lineItem.memo || decimalToString(existing?.amount) !== lineItem.amount.toString());
    });

    if (removedItems.length > 0) {
      await tx.agentPayoutStatementManualLineItem.deleteMany({
        where: {
          statementId: statement.id,
          id: {
            in: removedItems.map((lineItem) => lineItem.id)
          }
        }
      });
    }

    for (const lineItem of itemsToUpdate) {
      await tx.agentPayoutStatementManualLineItem.update({
        where: {
          id: lineItem.id
        },
        data: {
          memo: lineItem.memo,
          amount: lineItem.amount
        }
      });
    }

    for (const lineItem of itemsToCreate) {
      await tx.agentPayoutStatementManualLineItem.create({
        data: {
          statementId: statement.id,
          organizationId: statement.organizationId,
          officeId: statement.officeId,
          membershipId: statement.membershipId,
          memo: lineItem.memo,
          amount: lineItem.amount,
          createdByMembershipId: input.actorMembershipId
        }
      });
    }

    const previousSummary = summarizeAgentPayoutStatementSnapshot({
      invoiceLineItems: statement.lineItems,
      manualLineItems: statement.manualLineItems
    });
    const nextSummary = summarizeAgentPayoutStatementSnapshot({
      invoiceLineItems: statement.lineItems,
      manualLineItems: normalizedManualLineItems
    });
    const hasChanges = removedItems.length > 0 || itemsToCreate.length > 0 || itemsToUpdate.length > 0;
    const nextReviewStatus =
      hasChanges && statement.reviewStatus !== "draft" ? ("draft" satisfies AgentPayoutStatementReviewStatus) : statement.reviewStatus;

    await tx.agentPayoutStatement.update({
      where: {
        id: statement.id
      },
      data: {
        lineItemCount: nextSummary.lineItemCount,
        totalStatementAmount: nextSummary.finalPayoutTotal,
        reviewStatus: nextReviewStatus,
        confirmedAt: deriveStatementConfirmedAt(statement.reviewStatus, nextReviewStatus, statement.confirmedAt)
      }
    });

    if (hasChanges) {
      const invoiceNumbers = normalizeAgentPayoutStatementInvoiceNumbers(
        statement.lineItems.map((lineItem) => lineItem.invoiceNumber)
      );
      const changes = [
        buildActivityLogChange(
          "Manual adjustment total",
          formatCurrency(previousSummary.manualAdjustmentTotal),
          formatCurrency(nextSummary.manualAdjustmentTotal)
        ),
        buildActivityLogChange("Final payout", formatCurrency(previousSummary.finalPayoutTotal), formatCurrency(nextSummary.finalPayoutTotal)),
        buildActivityLogChange("Review status", statementReviewStatusLabelMap[statement.reviewStatus], statementReviewStatusLabelMap[nextReviewStatus])
      ].filter((change): change is ActivityLogChange => Boolean(change));

      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "agent_payout_statement",
        entityId: statement.id,
        action: activityLogActions.agentPayoutStatementAdjusted,
        payload: {
          officeId: statement.officeId,
          objectLabel: `${formatMembershipLabel(statement.membership)} payout statement`,
          contextHref: buildAgentPayoutStatementWorkspaceHref({
            membershipId: statement.membershipId,
            invoiceNumbers,
            statementId: statement.id
          }),
          details: [
            `Added manual items: ${itemsToCreate.length}`,
            `Updated manual items: ${itemsToUpdate.length}`,
            `Removed manual items: ${removedItems.length}`,
            `Manual adjustments total: ${formatCurrency(nextSummary.manualAdjustmentTotal)}`,
            `Final payout: ${formatCurrency(nextSummary.finalPayoutTotal)}`,
            `Review status: ${statementReviewStatusLabelMap[nextReviewStatus]}`
          ],
          changes
        }
      });
    }

    return {
      statementId: statement.id
    };
  });
}
