import {
  AgentPayoutStatementPeriodBasis,
  AgentBankInformationAccountType,
  AgentBankInformationTaxIdType,
  CommissionCalculationStatus,
  MembershipStatus,
  Prisma,
  TransactionFinanceVersionSource
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";

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
  feesLabel: string;
  feesValue: string;
  agentNetLabel: string;
  agentNetValue: string;
  netCommissionLabel: string;
  netCommissionValue: string;
  statementAmountLabel: string;
  statementAmountValue: string;
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
  lineItemCount: number;
  totalStatementAmountLabel: string;
  totalStatementAmountValue: string;
  totalGrossCommissionLabel: string;
  totalGrossCommissionValue: string;
  totalAgentNetLabel: string;
  totalAgentNetValue: string;
  bankInformation: OfficeAgentPayoutStatementBankInformationRecord | null;
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

const commissionCalculationStatusLabelMap: Record<CommissionCalculationStatus, string> = {
  draft: "Draft",
  calculated: "Calculated",
  reviewed: "Reviewed",
  statement_ready: "Statement ready",
  payable: "Payable",
  paid: "Paid"
};

const selectableAgentMembershipStatuses = ["active", "invited"] satisfies MembershipStatus[];
const generateEligibleAgentPayoutCalculationStatuses: readonly CommissionCalculationStatus[] = [
  "calculated",
  "reviewed",
  "statement_ready"
];
const visibleAgentPayoutCalculationStatuses = [
  ...generateEligibleAgentPayoutCalculationStatuses,
  "payable",
  "paid"
] satisfies CommissionCalculationStatus[];

function isGenerateEligibleAgentPayoutCalculationStatus(status: CommissionCalculationStatus) {
  return status === "calculated" || status === "reviewed" || status === "statement_ready";
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

function formatDateTimeValue(value: Date | null | undefined) {
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
    existing.isGenerateEligible ||= row.status ? isGenerateEligibleAgentPayoutCalculationStatus(row.status) : false;

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
    isGenerateEligible: isGenerateEligibleAgentPayoutCalculationStatus(calculation.status)
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
    statementAmount: calculation.statementAmount
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
    generatedAtLabel: formatDateTimeValue(record.generatedAt),
    generatedByLabel: record.generatedByMembership ? formatMembershipLabel(record.generatedByMembership) : "System",
    lineItemCount: record.lineItemCount,
    totalStatementAmountLabel: formatCurrency(record.totalStatementAmount),
    totalStatementAmountValue: decimalToString(record.totalStatementAmount)
  };
}

function mapStatementDetail(
  record: StatementRecordWithRelations,
  options?: {
    liveCommissionRateByCalculationId?: Map<string, string>;
  }
): OfficeAgentPayoutStatementDetail {
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
    generatedAtLabel: formatDateTimeValue(record.generatedAt),
    generatedByLabel: record.generatedByMembership ? formatMembershipLabel(record.generatedByMembership) : "System",
    lineItemCount: record.lineItemCount,
    totalStatementAmountLabel: formatCurrency(record.totalStatementAmount),
    totalStatementAmountValue: decimalToString(record.totalStatementAmount),
    totalGrossCommissionLabel: formatCurrency(record.totalGrossCommission),
    totalGrossCommissionValue: decimalToString(record.totalGrossCommission),
    totalAgentNetLabel: formatCurrency(record.totalAgentNet),
    totalAgentNetValue: decimalToString(record.totalAgentNet),
    bankInformation: mapStatementBankInformation(record.membership.agentBankInformation),
    lineItems: record.lineItems.map((lineItem) => {
      const liveCommissionRate = options?.liveCommissionRateByCalculationId?.get(lineItem.commissionCalculationId) ?? "";

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
          in: visibleAgentPayoutCalculationStatuses
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

  return mapStatementDetail(statement, {
    liveCommissionRateByCalculationId
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
            statuses: visibleAgentPayoutCalculationStatuses
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
        statuses: generateEligibleAgentPayoutCalculationStatuses
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
      throw new Error("No eligible commission rows were found for the selected invoice numbers.");
    }

    const calculations =
      commissionCalculationIds.length > 0
        ? invoiceScopedCalculations.filter((calculation) => commissionCalculationIds.includes(calculation.id))
        : invoiceScopedCalculations;

    if (commissionCalculationIds.length > 0 && calculations.length !== commissionCalculationIds.length) {
      throw new Error("Some selected commission rows are no longer eligible for the selected invoices.");
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
      throw new Error("No eligible commission rows were found for this statement.");
    }

    const includedInvoiceNumbers = normalizeAgentPayoutStatementInvoiceNumbers(
      calculations.map((calculation) => getAgentPayoutStatementInvoiceNumber(calculation))
    );
    const totals = summarizeAgentPayoutStatementRows(calculations);
    const statement = await tx.agentPayoutStatement.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership.officeId,
        membershipId: membership.id,
        periodStart: periodRange.periodStart,
        periodEnd: periodRange.periodEnd,
        periodBasis: "invoice_number",
        generatedByMembershipId: input.actorMembershipId,
        lineItemCount: totals.lineItemCount,
        totalStatementAmount: totals.totalStatementAmount,
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
          `Total payout: ${formatCurrency(totals.totalStatementAmount)}`
        ]
      }
    });

    return {
      statementId: statement.id
    };
  });
}
