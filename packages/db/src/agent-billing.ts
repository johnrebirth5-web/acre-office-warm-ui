import {
  AccountingPaymentMethod,
  AccountingTransactionStatus,
  AccountingTransactionType,
  AgentBillingFrequency,
  AgentPaymentMethodStatus,
  AgentPaymentMethodType,
  Prisma
} from "@prisma/client";
import { accountingSystemAccountCodes, saveAccountingTransactionInternal } from "./accounting";
import { activityLogActions, recordActivityLogEvent, type ActivityLogAction } from "./activity-log";
import { prisma } from "./client";

export type OfficeAgentBillingLedgerStatus = "all" | "open" | "pending" | "paid" | "void";

export type OfficeAgentBillingOverview = {
  openChargesCount: number;
  openChargesLabel: string;
  pendingChargesCount: number;
  pendingChargesLabel: string;
  receivedPaymentsLabel: string;
  currentBalanceLabel: string;
  upcomingRecurringCount: number;
  paymentMethodsConfiguredCount: number;
};

export type OfficeAgentBillingMemberOption = {
  id: string;
  label: string;
};

export type OfficeAgentBillingTransactionOption = {
  id: string;
  label: string;
};

export type OfficeAgentBillingLedgerRow = {
  id: string;
  statementPeriodId: string;
  accountingDate: string;
  dueDate: string;
  type: string;
  status: string;
  counterparty: string;
  chargeCategory: string;
  amountLabel: string;
  appliedAmountLabel: string;
  outstandingAmountLabel: string;
  linkedTransactionLabel: string;
  linkedTransactionHref: string | null;
  ownerName: string;
  paymentMethod: string;
  referenceNumber: string;
  href: string;
};

export type OfficeAgentRecurringChargeRuleRecord = {
  id: string;
  membershipId: string;
  memberLabel: string;
  name: string;
  chargeType: string;
  description: string;
  amountLabel: string;
  amountValue: string;
  frequency: string;
  frequencyValue: AgentBillingFrequency;
  nextDueDate: string;
  startDate: string;
  endDate: string;
  autoGenerateInvoice: boolean;
  isActive: boolean;
  customIntervalDays: number | null;
  lastGeneratedAt: string;
};

export type OfficeAgentPaymentMethodRecord = {
  id: string;
  membershipId: string;
  memberLabel: string;
  type: string;
  typeValue: AgentPaymentMethodType;
  label: string;
  provider: string;
  maskedReference: string;
  last4: string;
  isDefault: boolean;
  autoPayEnabled: boolean;
  status: string;
  statusValue: AgentPaymentMethodStatus;
};

export type OfficeAgentStatementLine = {
  id: string;
  href: string;
  title: string;
  amountLabel: string;
  status: string;
  accountingDate: string;
};

export type OfficeAgentStatementSnapshot = {
  membershipId: string;
  agentLabel: string;
  openChargesLabel: string;
  pendingChargesLabel: string;
  paymentsReceivedLabel: string;
  creditsAppliedLabel: string;
  currentBalanceLabel: string;
  recentActivity: OfficeAgentStatementLine[];
};

export type OfficeAgentBillingInvoiceOption = {
  id: string;
  membershipId: string;
  label: string;
  outstandingAmountLabel: string;
};

export type OfficeAgentBillingCreditMemoOption = {
  id: string;
  membershipId: string;
  label: string;
  remainingAmountLabel: string;
};

export type OfficeAgentBillingFilters = {
  membershipId: string;
  status: OfficeAgentBillingLedgerStatus;
  startDate: string;
  endDate: string;
  transactionId: string;
  q: string;
  memberOptions: OfficeAgentBillingMemberOption[];
  transactionOptions: OfficeAgentBillingTransactionOption[];
};

export type OfficeAgentBillingSnapshot = {
  overview: OfficeAgentBillingOverview;
  filters: OfficeAgentBillingFilters;
  ledgerRows: OfficeAgentBillingLedgerRow[];
  recurringRules: OfficeAgentRecurringChargeRuleRecord[];
  paymentMethods: OfficeAgentPaymentMethodRecord[];
  statement: OfficeAgentStatementSnapshot | null;
  openInvoiceOptions: OfficeAgentBillingInvoiceOption[];
  openCreditMemoOptions: OfficeAgentBillingCreditMemoOption[];
};

export type GetOfficeAgentBillingSnapshotInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  transactionId?: string;
  q?: string;
};

export type OfficeBillingSummary = {
  outstandingBalanceLabel: string;
  openChargesCount: number;
  pendingChargesLabel: string;
  pendingChargesCount: number;
  recentPaymentsLabel: string;
  recentPaymentsWindowLabel: string;
  creditBalanceLabel: string;
  creditBalanceCount: number;
  paymentMethodIssueCount: number;
  latestStatementPeriodLabel: string;
  latestStatementBalanceLabel: string;
  latestStatementGeneratedAtLabel: string;
};

export type OfficeBillingNotice = {
  tone: "neutral" | "accent" | "success" | "warning" | "danger";
  title: string;
  description: string;
};

export type OfficeBillingUpcomingChargeRow = {
  id: string;
  dueDate: string;
  sourceType: "Pending invoice" | "Recurring rule";
  description: string;
  amountLabel: string;
  status: string;
  linkedTransactionLabel: string;
  linkedTransactionHref: string | null;
};

export type OfficeBillingStatementRow = {
  id: string;
  periodLabel: string;
  generatedAtLabel: string;
  totalChargesLabel: string;
  totalPaymentsLabel: string;
  creditsLabel: string;
  currentBalanceLabel: string;
  entryCount: number;
};

export type OfficeBillingActivityItem = {
  id: string;
  actionLabel: string;
  actorDisplayName: string;
  summary: string;
  objectLabel: string;
  href: string | null;
  timestampLabel: string;
  detailSummary: string[];
};

export type OfficeBillingSnapshot = {
  summary: OfficeBillingSummary;
  notices: OfficeBillingNotice[];
  outstandingChargeRows: OfficeAgentBillingLedgerRow[];
  pendingChargeRows: OfficeAgentBillingLedgerRow[];
  upcomingChargeRows: OfficeBillingUpcomingChargeRow[];
  ledgerRows: OfficeAgentBillingLedgerRow[];
  recentPaymentRows: OfficeAgentBillingLedgerRow[];
  creditRows: OfficeAgentBillingLedgerRow[];
  statements: OfficeBillingStatementRow[];
  latestStatement: OfficeBillingStatementRow | null;
  paymentMethods: OfficeAgentPaymentMethodRecord[];
  recentActivity: OfficeBillingActivityItem[];
  limitations: string[];
};

export type GetOfficeBillingSnapshotInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
};

export type CreateAgentBillingChargesInput = {
  organizationId: string;
  officeId?: string | null;
  membershipIds: string[];
  chargeType: string;
  description?: string;
  amount: string;
  accountingDate: string;
  dueDate?: string;
  relatedTransactionId?: string;
  notes?: string;
  createdByMembershipId: string;
  actorMembershipId?: string;
};

export type CreateAgentRecurringChargeRuleInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  name: string;
  chargeType: string;
  description?: string;
  amount: string;
  frequency: string;
  customIntervalDays?: string;
  startDate: string;
  nextDueDate: string;
  endDate?: string;
  autoGenerateInvoice?: boolean;
  isActive?: boolean;
  actorMembershipId: string;
};

export type UpdateAgentRecurringChargeRuleInput = {
  organizationId: string;
  recurringChargeRuleId: string;
  officeId?: string | null;
  membershipId?: string;
  name?: string;
  chargeType?: string;
  description?: string;
  amount?: string;
  frequency?: string;
  customIntervalDays?: string;
  startDate?: string;
  nextDueDate?: string;
  endDate?: string;
  autoGenerateInvoice?: boolean;
  isActive?: boolean;
  actorMembershipId: string;
};

export type GenerateDueAgentBillingChargesInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId?: string;
  asOfDate?: string;
  actorMembershipId: string;
};

export type CreateAgentPaymentMethodInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  type: string;
  label: string;
  provider?: string;
  last4?: string;
  isDefault?: boolean;
  autoPayEnabled?: boolean;
  externalReferenceId?: string;
  status?: string;
  actorMembershipId: string;
  activityContextHref?: string;
};

export type UpdateAgentPaymentMethodInput = {
  organizationId: string;
  paymentMethodId: string;
  officeId?: string | null;
  membershipId?: string;
  type?: string;
  label?: string;
  provider?: string;
  last4?: string;
  isDefault?: boolean;
  autoPayEnabled?: boolean;
  externalReferenceId?: string;
  status?: string;
  actorMembershipId: string;
  activityContextHref?: string;
};

export type RecordAgentBillingPaymentInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  invoiceIds: string[];
  amount?: string;
  accountingDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  createdByMembershipId: string;
  actorMembershipId?: string;
};

export type ApplyAgentBillingCreditMemoInput = {
  organizationId: string;
  officeId?: string | null;
  creditMemoId: string;
  invoiceId: string;
  amount?: string;
  memo?: string;
  actorMembershipId: string;
};

export type CreateOfficeBillingPaymentMethodInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  type: string;
  label: string;
  provider?: string;
  last4?: string;
  isDefault?: boolean;
  autoPayEnabled?: boolean;
  actorMembershipId: string;
};

export type UpdateOfficeBillingPaymentMethodInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  paymentMethodId: string;
  type?: string;
  label?: string;
  provider?: string;
  last4?: string;
  isDefault?: boolean;
  autoPayEnabled?: boolean;
  remove?: boolean;
  actorMembershipId: string;
};

const agentBillingTransactionInclude = {
  relatedTransaction: {
    select: {
      id: true,
      title: true,
      address: true,
      city: true,
      state: true,
      zipCode: true
    }
  },
  relatedMembership: {
    include: {
      user: true
    }
  },
  createdByMembership: {
    include: {
      user: true
    }
  },
  originRecurringChargeRule: {
    select: {
      id: true,
      name: true
    }
  },
  applicationsTo: {
    include: {
      sourceAccountingTransaction: {
        select: {
          id: true,
          type: true,
          referenceNumber: true,
          counterpartyName: true
        }
      }
    }
  },
  applicationsFrom: {
    include: {
      targetAccountingTransaction: {
        select: {
          id: true,
          type: true,
          referenceNumber: true,
          counterpartyName: true
        }
      }
    }
  }
} as const;

type AgentBillingTransactionRecord = Prisma.AccountingTransactionGetPayload<{
  include: typeof agentBillingTransactionInclude;
}>;

type ActiveAgentMembershipRecord = Prisma.MembershipGetPayload<{
  include: {
    user: true;
  };
}>;

type AgentRecurringRuleRecord = Prisma.AgentRecurringChargeRuleGetPayload<{
  include: {
    membership: {
      include: {
        user: true;
      };
    };
  };
}>;

type AgentPaymentMethodRecord = Prisma.AgentPaymentMethodGetPayload<{
  include: {
    membership: {
      include: {
        user: true;
      };
    };
  };
}>;

type BillingAuditLogRecord = Prisma.AuditLogGetPayload<{
  include: {
    membership: {
      include: {
        user: true;
      };
    };
  };
}>;

const accountingTypeLabelMap: Record<AccountingTransactionType, string> = {
  invoice: "Invoice",
  bill: "Bill",
  credit_memo: "Credit memo",
  deposit: "Deposit",
  received_payment: "Received payment",
  made_payment: "Made payment",
  journal_entry: "Journal entry",
  transfer: "Transfer",
  refund: "Refund"
};

const paymentMethodLabelMap: Record<AccountingPaymentMethod, string> = {
  ach: "ACH",
  check: "Check",
  wire: "Wire",
  cash: "Cash",
  internal_transfer: "Internal transfer",
  other: "Other"
};

const agentPaymentMethodTypeLabelMap: Record<AgentPaymentMethodType, string> = {
  card_on_file: "Card on file",
  bank_account: "Bank account",
  check: "Check",
  manual: "Manual",
  other: "Other"
};

const agentPaymentMethodStatusLabelMap: Record<AgentPaymentMethodStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  invalid: "Invalid",
  expired: "Expired",
  removed: "Removed"
};

const billingActivityActionLabelMap: Partial<Record<ActivityLogAction, string>> = {
  [activityLogActions.accountingAgentChargeCreated]: "Charge added",
  [activityLogActions.accountingCreditMemoCreated]: "Credit memo added",
  [activityLogActions.accountingPaymentReceived]: "Payment recorded",
  [activityLogActions.accountingAgentCreditApplied]: "Credit applied",
  [activityLogActions.accountingPaymentMethodAdded]: "Payment method added",
  [activityLogActions.accountingPaymentMethodUpdated]: "Payment method updated",
  [activityLogActions.accountingPaymentMethodRemoved]: "Payment method removed",
  [activityLogActions.accountingTransactionUpdated]: "Billing transaction updated"
};

function buildScopedOfficeWhere(officeId?: string | null) {
  return officeId
    ? {
        OR: [{ officeId }, { officeId: null }]
      }
    : {};
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
  if (!value) {
    return "";
  }

  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function parseOptionalText(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDate(value: string | undefined | null) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalDecimal(value: string | undefined | null) {
  if (!value?.trim()) {
    return null;
  }

  const numeric = Number(value.replaceAll(",", "").replace(/\$/g, "").trim());
  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
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

function formatMembershipLabel(membership: ActiveAgentMembershipRecord | AgentRecurringRuleRecord["membership"] | AgentPaymentMethodRecord["membership"]) {
  return `${membership.user.firstName} ${membership.user.lastName}`;
}

function parseRecurringFrequency(value: string | undefined | null) {
  if (
    value === "monthly" ||
    value === "quarterly" ||
    value === "annual" ||
    value === "custom_interval"
  ) {
    return value satisfies AgentBillingFrequency;
  }

  return null;
}

function parseAgentPaymentMethodType(value: string | undefined | null) {
  if (
    value === "card_on_file" ||
    value === "bank_account" ||
    value === "check" ||
    value === "manual" ||
    value === "other"
  ) {
    return value satisfies AgentPaymentMethodType;
  }

  return null;
}

function parseAgentPaymentMethodStatus(value: string | undefined | null) {
  if (
    value === "active" ||
    value === "inactive" ||
    value === "invalid" ||
    value === "expired" ||
    value === "removed"
  ) {
    return value satisfies AgentPaymentMethodStatus;
  }

  return null;
}

function normalizeBillingStatusFilter(value: string | undefined | null): OfficeAgentBillingLedgerStatus {
  if (value === "open" || value === "pending" || value === "paid" || value === "void") {
    return value;
  }

  return "all";
}

function clampToTargetMonth(next: Date, targetDay: number) {
  const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDayOfTargetMonth));
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const targetDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  return clampToTargetMonth(next, targetDay);
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  const targetDay = next.getDate();
  next.setDate(1);
  next.setFullYear(next.getFullYear() + years);
  return clampToTargetMonth(next, targetDay);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getNextRecurringDate(
  rule: Pick<AgentRecurringRuleRecord, "frequency" | "customIntervalDays"> | Pick<Prisma.AgentRecurringChargeRuleUncheckedCreateInput, "frequency" | "customIntervalDays">,
  currentDate: Date
) {
  switch (rule.frequency) {
    case "monthly":
      return addMonths(currentDate, 1);
    case "quarterly":
      return addMonths(currentDate, 3);
    case "annual":
      return addYears(currentDate, 1);
    case "custom_interval":
      return addDays(currentDate, Math.max(rule.customIntervalDays ?? 30, 1));
    default:
      return addMonths(currentDate, 1);
  }
}

function formatFrequency(rule: { frequency: AgentBillingFrequency; customIntervalDays: number | null }) {
  switch (rule.frequency) {
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "annual":
      return "Annual";
    case "custom_interval":
      return `Every ${rule.customIntervalDays ?? 30} days`;
    default:
      return "Monthly";
  }
}

function sumApplications(applications: Array<{ amount: Prisma.Decimal }>) {
  return applications.reduce((sum, application) => sum.plus(application.amount), new Prisma.Decimal(0));
}

function getInvoiceOutstandingAmount(transaction: AgentBillingTransactionRecord) {
  if (transaction.type !== "invoice") {
    return new Prisma.Decimal(0);
  }

  const appliedAmount = sumApplications(transaction.applicationsTo);
  const outstanding = transaction.totalAmount.minus(appliedAmount);
  return outstanding.greaterThan(0) ? outstanding : new Prisma.Decimal(0);
}

function getSourceRemainingAmount(transaction: AgentBillingTransactionRecord) {
  if (transaction.type !== "credit_memo" && transaction.type !== "received_payment") {
    return new Prisma.Decimal(0);
  }

  const appliedAmount = sumApplications(transaction.applicationsFrom);
  const remaining = transaction.totalAmount.minus(appliedAmount);
  return remaining.greaterThan(0) ? remaining : new Prisma.Decimal(0);
}

function isFutureDated(transaction: AgentBillingTransactionRecord) {
  const now = new Date();
  const comparisonDate = transaction.dueDate ?? transaction.accountingDate;
  return comparisonDate > now;
}

function deriveLedgerStatus(transaction: AgentBillingTransactionRecord): Exclude<OfficeAgentBillingLedgerStatus, "all"> {
  if (transaction.status === "void") {
    return "void";
  }

  if (transaction.type === "invoice") {
    if (getInvoiceOutstandingAmount(transaction).equals(0)) {
      return "paid";
    }

    if (transaction.status === "draft" || isFutureDated(transaction)) {
      return "pending";
    }

    return "open";
  }

  if (transaction.type === "credit_memo" || transaction.type === "received_payment") {
    return getSourceRemainingAmount(transaction).greaterThan(0) ? "open" : "paid";
  }

  return transaction.status === "draft" ? "pending" : "paid";
}

function formatLedgerStatusLabel(transaction: AgentBillingTransactionRecord) {
  const status = deriveLedgerStatus(transaction);
  switch (status) {
    case "open":
      return "Open";
    case "pending":
      return "Pending";
    case "paid":
      return "Paid / applied";
    case "void":
      return "Void";
    default:
      return "Open";
  }
}

function mapLedgerRow(transaction: AgentBillingTransactionRecord): OfficeAgentBillingLedgerRow {
  const appliedAmount =
    transaction.type === "invoice" ? sumApplications(transaction.applicationsTo) : sumApplications(transaction.applicationsFrom);
  const outstandingAmount =
    transaction.type === "invoice" ? getInvoiceOutstandingAmount(transaction) : getSourceRemainingAmount(transaction);

  return {
    id: transaction.id,
    statementPeriodId: buildStatementPeriodKey(transaction.accountingDate),
    accountingDate: formatDateValue(transaction.accountingDate),
    dueDate: formatDateValue(transaction.dueDate),
    type: accountingTypeLabelMap[transaction.type],
    status: formatLedgerStatusLabel(transaction),
    counterparty: transaction.counterpartyName
      ? transaction.counterpartyName
      : transaction.relatedMembership
        ? formatMembershipLabel(transaction.relatedMembership)
        : "—",
    chargeCategory: transaction.billingCategory ?? "",
    amountLabel: formatCurrency(transaction.totalAmount),
    appliedAmountLabel: formatCurrency(appliedAmount),
    outstandingAmountLabel: formatCurrency(outstandingAmount),
    linkedTransactionLabel: transaction.relatedTransaction
      ? `${transaction.relatedTransaction.title} · ${transaction.relatedTransaction.address}, ${transaction.relatedTransaction.city}`
      : "—",
    linkedTransactionHref: transaction.relatedTransaction ? `/office/transactions/${transaction.relatedTransaction.id}` : null,
    ownerName: transaction.relatedMembership ? formatMembershipLabel(transaction.relatedMembership) : "—",
    paymentMethod: transaction.paymentMethod ? paymentMethodLabelMap[transaction.paymentMethod] : "—",
    referenceNumber: transaction.referenceNumber ?? "",
    href: `/office/accounting?entryId=${transaction.id}#agent-billing`
  };
}

async function getAgentBillingIncomeAccount(tx: Prisma.TransactionClient, organizationId: string) {
  const account = await tx.ledgerAccount.findFirst({
    where: {
      organizationId,
      code: {
        in: [accountingSystemAccountCodes.agentBillingIncome, accountingSystemAccountCodes.commissionIncome]
      }
    },
    orderBy: [{ code: "asc" }]
  });

  if (!account) {
    throw new Error("Agent billing income account is missing from the chart of accounts.");
  }

  return account;
}

async function getActiveAgentMemberships(organizationId: string, officeId?: string | null) {
  return prisma.membership.findMany({
    where: {
      organizationId,
      status: "active",
      role: "agent",
      ...(officeId ? { officeId } : {})
    },
    include: {
      user: true
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
  });
}

async function syncAppliedTransactionStatus(tx: Prisma.TransactionClient, transactionId: string) {
  const transaction = await tx.accountingTransaction.findUnique({
    where: {
      id: transactionId
    },
    include: {
      applicationsTo: true,
      applicationsFrom: true
    }
  });

  if (!transaction || transaction.status === "void") {
    return;
  }

  if (transaction.type === "invoice") {
    const appliedAmount = transaction.applicationsTo.reduce((sum, application) => sum.plus(application.amount), new Prisma.Decimal(0));
    const nextStatus = appliedAmount.greaterThanOrEqualTo(transaction.totalAmount) ? "completed" : transaction.status === "draft" ? "draft" : "open";

    if (nextStatus !== transaction.status) {
      await tx.accountingTransaction.update({
        where: { id: transaction.id },
        data: {
          status: nextStatus
        }
      });
    }

    return;
  }

  if (transaction.type === "credit_memo" || transaction.type === "received_payment") {
    const appliedAmount = transaction.applicationsFrom.reduce((sum, application) => sum.plus(application.amount), new Prisma.Decimal(0));
    const nextStatus = appliedAmount.greaterThanOrEqualTo(transaction.totalAmount) ? "completed" : "posted";

    if (nextStatus !== transaction.status) {
      await tx.accountingTransaction.update({
        where: { id: transaction.id },
        data: {
          status: nextStatus
        }
      });
    }
  }
}

async function applyAccountingTransactionToInvoice(tx: Prisma.TransactionClient, input: {
  organizationId: string;
  officeId?: string | null;
  sourceAccountingTransactionId: string;
  targetAccountingTransactionId: string;
  createdByMembershipId: string;
  amount: Prisma.Decimal;
  memo?: string | null;
}) {
  const [source, target] = await Promise.all([
    tx.accountingTransaction.findFirst({
      where: {
        id: input.sourceAccountingTransactionId,
        organizationId: input.organizationId,
        isAgentBilling: true
      },
      include: {
        applicationsFrom: true,
        relatedMembership: {
          include: {
            user: true
          }
        }
      }
    }),
    tx.accountingTransaction.findFirst({
      where: {
        id: input.targetAccountingTransactionId,
        organizationId: input.organizationId,
        isAgentBilling: true,
        type: "invoice"
      },
      include: {
        applicationsTo: true,
        relatedMembership: {
          include: {
            user: true
          }
        }
      }
    })
  ]);

  if (!source || !target) {
    throw new Error("Billing transactions were not found in the current organization scope.");
  }

  if (!source.relatedMembershipId || source.relatedMembershipId !== target.relatedMembershipId) {
    throw new Error("Source and target billing records must belong to the same agent.");
  }

  if (!["credit_memo", "received_payment"].includes(source.type)) {
    throw new Error("Only received payments and credit memos can be applied to invoices.");
  }

  const sourceRemaining = source.totalAmount.minus(sumApplications(source.applicationsFrom));
  const targetOutstanding = target.totalAmount.minus(sumApplications(target.applicationsTo));

  if (sourceRemaining.lte(0) || targetOutstanding.lte(0)) {
    throw new Error("There is no remaining balance to apply.");
  }

  const maxApplicable = sourceRemaining.lessThan(targetOutstanding) ? sourceRemaining : targetOutstanding;
  const amount = input.amount.lessThanOrEqualTo(maxApplicable) ? input.amount : maxApplicable;

  if (amount.lte(0)) {
    throw new Error("A positive amount is required to apply this billing record.");
  }

  await tx.accountingTransactionApplication.create({
    data: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? source.officeId ?? target.officeId ?? null,
      sourceAccountingTransactionId: source.id,
      targetAccountingTransactionId: target.id,
      createdByMembershipId: input.createdByMembershipId,
      amount,
      memo: input.memo ?? null,
      appliedAt: new Date()
    }
  });

  await Promise.all([syncAppliedTransactionStatus(tx, source.id), syncAppliedTransactionStatus(tx, target.id)]);

  await recordActivityLogEvent(tx, {
    organizationId: input.organizationId,
    membershipId: input.createdByMembershipId,
    entityType: "accounting_transaction",
    entityId: source.id,
    action: activityLogActions.accountingAgentCreditApplied,
    payload: {
      officeId: input.officeId ?? source.officeId ?? target.officeId ?? null,
      objectLabel: `${source.counterpartyName ?? "Agent"} · Credit applied`,
      contextHref: `/office/accounting?entryId=${target.id}#agent-billing`,
      details: [
        `Source: ${accountingTypeLabelMap[source.type]} ${source.referenceNumber ?? source.id}`,
        `Target invoice: ${target.referenceNumber ?? target.id}`,
        `Amount: ${formatCurrency(amount)}`
      ]
    }
  });
}

function matchesBillingSearch(transaction: AgentBillingTransactionRecord, query: string) {
  if (!query.trim()) {
    return true;
  }

  const normalized = query.trim().toLowerCase();
  return [
    transaction.referenceNumber ?? "",
    transaction.counterpartyName ?? "",
    transaction.billingCategory ?? "",
    transaction.memo ?? "",
    transaction.notes ?? "",
    transaction.relatedMembership ? formatMembershipLabel(transaction.relatedMembership) : "",
    transaction.relatedMembership?.user.email ?? "",
    transaction.relatedTransaction?.title ?? "",
    transaction.relatedTransaction?.address ?? "",
    transaction.relatedTransaction?.city ?? "",
    transaction.relatedTransaction?.state ?? ""
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function matchesBillingStatus(transaction: AgentBillingTransactionRecord, status: OfficeAgentBillingLedgerStatus) {
  return status === "all" ? true : deriveLedgerStatus(transaction) === status;
}

function buildStatementPeriodKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatStatementPeriodLabel(key: string) {
  const [year, month] = key.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
    return key;
  }

  return new Date(Date.UTC(parsedYear, parsedMonth - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function getBillingActivitySummary(record: BillingAuditLogRecord) {
  const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
    ? (record.payload as Prisma.JsonObject)
    : null;
  const objectLabel = typeof payload?.objectLabel === "string" ? payload.objectLabel : null;
  const details = Array.isArray(payload?.details)
    ? payload.details.filter((value): value is string => typeof value === "string")
    : [];

  switch (record.action) {
    case activityLogActions.accountingAgentChargeCreated:
      return `Added a billing charge${objectLabel ? ` for ${objectLabel}` : ""}.`;
    case activityLogActions.accountingCreditMemoCreated:
      return `Added a credit memo${objectLabel ? ` for ${objectLabel}` : ""}.`;
    case activityLogActions.accountingPaymentReceived:
      return `Recorded a payment${details[0] ? ` · ${details[0]}` : ""}.`;
    case activityLogActions.accountingAgentCreditApplied:
      return details[2] ? `Applied credit · ${details[2]}.` : "Applied a credit against an open charge.";
    case activityLogActions.accountingPaymentMethodAdded:
      return `Added a payment method${objectLabel ? ` · ${objectLabel}` : ""}.`;
    case activityLogActions.accountingPaymentMethodUpdated:
      return `Updated a payment method${objectLabel ? ` · ${objectLabel}` : ""}.`;
    case activityLogActions.accountingPaymentMethodRemoved:
      return `Removed a payment method${objectLabel ? ` · ${objectLabel}` : ""}.`;
    case activityLogActions.accountingTransactionUpdated:
      return `Updated a billing transaction${objectLabel ? ` · ${objectLabel}` : ""}.`;
    default:
      return billingActivityActionLabelMap[record.action as ActivityLogAction] ?? "Billing activity updated";
  }
}

function mapBillingActivityItem(record: BillingAuditLogRecord): OfficeBillingActivityItem {
  const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
    ? (record.payload as Prisma.JsonObject)
    : null;
  const detailSummary = Array.isArray(payload?.details)
    ? payload.details.filter((value): value is string => typeof value === "string").slice(0, 3)
    : [];

  return {
    id: record.id,
    actionLabel: billingActivityActionLabelMap[record.action as ActivityLogAction] ?? "Billing activity",
    actorDisplayName: record.membership ? `${record.membership.user.firstName} ${record.membership.user.lastName}` : "System",
    summary: getBillingActivitySummary(record),
    objectLabel: typeof payload?.objectLabel === "string" ? payload.objectLabel : "Billing record",
    href: typeof payload?.contextHref === "string" ? payload.contextHref : "/office/billing",
    timestampLabel: formatDateTimeValue(record.createdAt),
    detailSummary
  };
}

export async function getOfficeAgentBillingSnapshot(input: GetOfficeAgentBillingSnapshotInput): Promise<OfficeAgentBillingSnapshot> {
  const [memberships, transactionOptions, recurringRules, paymentMethods, billingTransactions] = await Promise.all([
    getActiveAgentMemberships(input.organizationId, input.officeId),
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
    }),
    prisma.agentRecurringChargeRule.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildScopedOfficeWhere(input.officeId),
        ...(input.membershipId ? { membershipId: input.membershipId } : {})
      },
      include: {
        membership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }]
    }),
    prisma.agentPaymentMethod.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildScopedOfficeWhere(input.officeId),
        ...(input.membershipId ? { membershipId: input.membershipId } : {})
      },
      include: {
        membership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { isDefault: "desc" }, { createdAt: "desc" }]
    }),
    prisma.accountingTransaction.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildScopedOfficeWhere(input.officeId),
        isAgentBilling: true,
        ...(input.membershipId ? { relatedMembershipId: input.membershipId } : {}),
        ...(input.transactionId ? { relatedTransactionId: input.transactionId } : {}),
        ...((input.startDate || input.endDate)
          ? {
              accountingDate: {
                ...(startOfDay(input.startDate) ? { gte: startOfDay(input.startDate)! } : {}),
                ...(endOfDay(input.endDate) ? { lte: endOfDay(input.endDate)! } : {})
              }
            }
          : {})
      },
      include: agentBillingTransactionInclude,
      orderBy: [{ accountingDate: "desc" }, { createdAt: "desc" }],
      take: 400
    })
  ]);

  const statusFilter = normalizeBillingStatusFilter(input.status);
  const filteredTransactions = billingTransactions
    .filter((transaction) => matchesBillingStatus(transaction, statusFilter))
    .filter((transaction) => matchesBillingSearch(transaction, input.q ?? ""));
  const ledgerRows = filteredTransactions.map(mapLedgerRow);

  const openInvoices = filteredTransactions.filter(
    (transaction) => transaction.type === "invoice" && getInvoiceOutstandingAmount(transaction).greaterThan(0)
  );
  const openCreditMemos = filteredTransactions.filter(
    (transaction) => transaction.type === "credit_memo" && getSourceRemainingAmount(transaction).greaterThan(0)
  );

  const openCharges = openInvoices.filter((transaction) => !isFutureDated(transaction));
  const pendingCharges = [
    ...openInvoices.filter((transaction) => isFutureDated(transaction)),
    ...recurringRules.filter((rule) => rule.isActive && rule.nextDueDate > new Date())
  ];

  const currentBalance = openInvoices.reduce((sum, transaction) => sum.plus(getInvoiceOutstandingAmount(transaction)), new Prisma.Decimal(0));
  const receivedPayments = filteredTransactions
    .filter((transaction) => transaction.type === "received_payment")
    .reduce((sum, transaction) => sum.plus(transaction.totalAmount), new Prisma.Decimal(0));

  const selectedMembership = input.membershipId
    ? memberships.find((membership) => membership.id === input.membershipId) ?? null
    : null;
  const statementTransactions = selectedMembership
    ? filteredTransactions.filter((transaction) => transaction.relatedMembershipId === selectedMembership.id)
    : [];

  const statementPendingCharges = recurringRules
    .filter((rule) => selectedMembership && rule.membershipId === selectedMembership.id && rule.isActive)
    .reduce((sum, rule) => sum.plus(rule.amount), new Prisma.Decimal(0));
  const statementOpenBalance = statementTransactions
    .filter((transaction) => transaction.type === "invoice")
    .reduce((sum, transaction) => sum.plus(getInvoiceOutstandingAmount(transaction)), new Prisma.Decimal(0));
  const statementReceivedPayments = statementTransactions
    .filter((transaction) => transaction.type === "received_payment")
    .reduce((sum, transaction) => sum.plus(transaction.totalAmount), new Prisma.Decimal(0));
  const statementCredits = statementTransactions
    .filter((transaction) => transaction.type === "credit_memo")
    .reduce((sum, transaction) => sum.plus(sumApplications(transaction.applicationsFrom)), new Prisma.Decimal(0));

  return {
    overview: {
      openChargesCount: openCharges.length,
      openChargesLabel: formatCurrency(openCharges.reduce((sum, transaction) => sum.plus(getInvoiceOutstandingAmount(transaction)), new Prisma.Decimal(0))),
      pendingChargesCount: pendingCharges.length,
      pendingChargesLabel: formatCurrency(
        pendingCharges.reduce((sum, item) => {
          if ("type" in item) {
            return sum.plus(getInvoiceOutstandingAmount(item as AgentBillingTransactionRecord));
          }

          return sum.plus((item as AgentRecurringRuleRecord).amount);
        }, new Prisma.Decimal(0))
      ),
      receivedPaymentsLabel: formatCurrency(receivedPayments),
      currentBalanceLabel: formatCurrency(currentBalance),
      upcomingRecurringCount: recurringRules.filter((rule) => rule.isActive).length,
      paymentMethodsConfiguredCount: paymentMethods.filter((method) => method.status === "active").length
    },
    filters: {
      membershipId: input.membershipId ?? "",
      status: statusFilter,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      transactionId: input.transactionId ?? "",
      q: input.q ?? "",
      memberOptions: memberships.map((membership) => ({
        id: membership.id,
        label: formatMembershipLabel(membership)
      })),
      transactionOptions: transactionOptions.map((transaction) => ({
        id: transaction.id,
        label: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`
      }))
    },
    ledgerRows,
    recurringRules: recurringRules.map((rule) => ({
      id: rule.id,
      membershipId: rule.membershipId,
      memberLabel: formatMembershipLabel(rule.membership),
      name: rule.name,
      chargeType: rule.chargeType,
      description: rule.description ?? "",
      amountLabel: formatCurrency(rule.amount),
      amountValue: rule.amount.toString(),
      frequency: formatFrequency(rule),
      frequencyValue: rule.frequency,
      nextDueDate: formatDateValue(rule.nextDueDate),
      startDate: formatDateValue(rule.startDate),
      endDate: formatDateValue(rule.endDate),
      autoGenerateInvoice: rule.autoGenerateInvoice,
      isActive: rule.isActive,
      customIntervalDays: rule.customIntervalDays,
      lastGeneratedAt: formatDateValue(rule.lastGeneratedAt)
    })),
    paymentMethods: paymentMethods.map((method) => ({
      id: method.id,
      membershipId: method.membershipId,
      memberLabel: formatMembershipLabel(method.membership),
      type: agentPaymentMethodTypeLabelMap[method.type],
      typeValue: method.type,
      label: method.label,
      provider: method.provider,
      maskedReference: method.last4 ? `•••• ${method.last4}` : "Configured",
      last4: method.last4 ?? "",
      isDefault: method.isDefault,
      autoPayEnabled: method.autoPayEnabled,
      status: agentPaymentMethodStatusLabelMap[method.status],
      statusValue: method.status
    })),
    statement: selectedMembership
      ? {
          membershipId: selectedMembership.id,
          agentLabel: formatMembershipLabel(selectedMembership),
          openChargesLabel: formatCurrency(statementOpenBalance),
          pendingChargesLabel: formatCurrency(statementPendingCharges),
          paymentsReceivedLabel: formatCurrency(statementReceivedPayments),
          creditsAppliedLabel: formatCurrency(statementCredits),
          currentBalanceLabel: formatCurrency(statementOpenBalance),
          recentActivity: statementTransactions.slice(0, 12).map((transaction) => ({
            id: transaction.id,
            href: `/office/accounting?entryId=${transaction.id}#agent-billing`,
            title: `${accountingTypeLabelMap[transaction.type]} · ${transaction.referenceNumber ?? transaction.counterpartyName ?? transaction.id}`,
            amountLabel: formatCurrency(transaction.totalAmount),
            status: formatLedgerStatusLabel(transaction),
            accountingDate: formatDateValue(transaction.accountingDate)
          }))
        }
      : null,
    openInvoiceOptions: openInvoices.map((transaction) => ({
      id: transaction.id,
      membershipId: transaction.relatedMembershipId ?? "",
      label: `${transaction.referenceNumber ?? transaction.counterpartyName ?? transaction.id} · ${formatMembershipLabel(transaction.relatedMembership!)}`,
      outstandingAmountLabel: formatCurrency(getInvoiceOutstandingAmount(transaction))
    })),
    openCreditMemoOptions: openCreditMemos.map((transaction) => ({
      id: transaction.id,
      membershipId: transaction.relatedMembershipId ?? "",
      label: `${transaction.referenceNumber ?? transaction.counterpartyName ?? transaction.id} · ${formatMembershipLabel(transaction.relatedMembership!)}`,
      remainingAmountLabel: formatCurrency(getSourceRemainingAmount(transaction))
    }))
  };
}

export async function getOfficeBillingSnapshot(input: GetOfficeBillingSnapshotInput): Promise<OfficeBillingSnapshot | null> {
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

  const now = new Date();
  const recentPaymentsCutoff = new Date();
  recentPaymentsCutoff.setDate(recentPaymentsCutoff.getDate() - 90);

  const [billingTransactions, allPaymentMethods, recurringRules] = await Promise.all([
    prisma.accountingTransaction.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildScopedOfficeWhere(input.officeId),
        isAgentBilling: true,
        relatedMembershipId: membership.id,
        status: {
          not: "void"
        }
      },
      include: agentBillingTransactionInclude,
      orderBy: [{ accountingDate: "desc" }, { createdAt: "desc" }],
      take: 400
    }),
    prisma.agentPaymentMethod.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildScopedOfficeWhere(input.officeId),
        membershipId: membership.id
      },
      include: {
        membership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { isDefault: "desc" }, { createdAt: "desc" }]
    }),
    prisma.agentRecurringChargeRule.findMany({
      where: {
        organizationId: input.organizationId,
        ...buildScopedOfficeWhere(input.officeId),
        membershipId: membership.id,
        isActive: true
      },
      include: {
        membership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ nextDueDate: "asc" }]
    })
  ]);

  const ledgerRows = billingTransactions.map(mapLedgerRow);
  const outstandingChargeTransactions = billingTransactions.filter(
    (transaction) => transaction.type === "invoice" && getInvoiceOutstandingAmount(transaction).greaterThan(0) && !isFutureDated(transaction)
  );
  const pendingChargeTransactions = billingTransactions.filter(
    (transaction) =>
      transaction.type === "invoice" &&
      getInvoiceOutstandingAmount(transaction).greaterThan(0) &&
      (transaction.status === "draft" || isFutureDated(transaction))
  );
  const recentPaymentTransactions = billingTransactions
    .filter((transaction) => transaction.type === "received_payment")
    .slice(0, 8);
  const creditTransactions = billingTransactions.filter((transaction) => transaction.type === "credit_memo");

  const pendingRecurringRules = recurringRules.filter((rule) => {
    if (rule.nextDueDate <= now) {
      return false;
    }

    return !pendingChargeTransactions.some((transaction) => {
      const transactionDueDate = transaction.dueDate ?? transaction.accountingDate;
      return (
        transaction.billingCategory === rule.chargeType &&
        transaction.totalAmount.equals(rule.amount) &&
        transactionDueDate.getUTCFullYear() === rule.nextDueDate.getUTCFullYear() &&
        transactionDueDate.getUTCMonth() === rule.nextDueDate.getUTCMonth()
      );
    });
  });

  const outstandingBalance = outstandingChargeTransactions.reduce(
    (sum, transaction) => sum.plus(getInvoiceOutstandingAmount(transaction)),
    new Prisma.Decimal(0)
  );
  const pendingChargeTotal = pendingChargeTransactions.reduce(
    (sum, transaction) => sum.plus(getInvoiceOutstandingAmount(transaction)),
    new Prisma.Decimal(0)
  ).plus(pendingRecurringRules.reduce((sum, rule) => sum.plus(rule.amount), new Prisma.Decimal(0)));
  const recentPaymentsTotal = billingTransactions
    .filter((transaction) => transaction.type === "received_payment" && transaction.accountingDate >= recentPaymentsCutoff)
    .reduce((sum, transaction) => sum.plus(transaction.totalAmount), new Prisma.Decimal(0));
  const creditBalance = creditTransactions.reduce(
    (sum, transaction) => sum.plus(getSourceRemainingAmount(transaction)),
    new Prisma.Decimal(0)
  );
  const paymentMethods = allPaymentMethods.filter((method) => method.status !== "removed");
  const paymentMethodIssueCount = paymentMethods.filter((method) => method.status === "invalid" || method.status === "expired").length;

  const statementGroups = new Map<
    string,
    {
      totalCharges: Prisma.Decimal;
      totalPayments: Prisma.Decimal;
      totalCredits: Prisma.Decimal;
      currentBalance: Prisma.Decimal;
      entryCount: number;
    }
  >();

  for (const transaction of billingTransactions) {
    const key = buildStatementPeriodKey(transaction.accountingDate);
    const current =
      statementGroups.get(key) ??
      {
        totalCharges: new Prisma.Decimal(0),
        totalPayments: new Prisma.Decimal(0),
        totalCredits: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        entryCount: 0
      };

    current.entryCount += 1;

    if (transaction.type === "invoice") {
      current.totalCharges = current.totalCharges.plus(transaction.totalAmount);
      current.currentBalance = current.currentBalance.plus(getInvoiceOutstandingAmount(transaction));
    } else if (transaction.type === "received_payment") {
      current.totalPayments = current.totalPayments.plus(transaction.totalAmount);
    } else if (transaction.type === "credit_memo") {
      current.totalCredits = current.totalCredits.plus(transaction.totalAmount);
    }

    statementGroups.set(key, current);
  }

  const generatedAtLabel = formatDateTimeValue(now);
  const statements = Array.from(statementGroups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, value]) => ({
      id: key,
      periodLabel: formatStatementPeriodLabel(key),
      generatedAtLabel,
      totalChargesLabel: formatCurrency(value.totalCharges),
      totalPaymentsLabel: formatCurrency(value.totalPayments),
      creditsLabel: formatCurrency(value.totalCredits),
      currentBalanceLabel: formatCurrency(value.currentBalance),
      entryCount: value.entryCount
    }));
  const latestStatement = statements[0] ?? null;

  const transactionIds = billingTransactions.map((transaction) => transaction.id);
  const paymentMethodIds = allPaymentMethods.map((method) => method.id);
  const auditScopeClauses: Prisma.AuditLogWhereInput[] = [];

  if (transactionIds.length) {
    auditScopeClauses.push({
      entityType: "accounting_transaction",
      entityId: {
        in: transactionIds
      },
      action: {
        in: [
          activityLogActions.accountingAgentChargeCreated,
          activityLogActions.accountingCreditMemoCreated,
          activityLogActions.accountingPaymentReceived,
          activityLogActions.accountingAgentCreditApplied,
          activityLogActions.accountingTransactionUpdated
        ]
      }
    });
  }

  if (paymentMethodIds.length) {
    auditScopeClauses.push({
      entityType: "agent_payment_method",
      entityId: {
        in: paymentMethodIds
      },
      action: {
        in: [
          activityLogActions.accountingPaymentMethodAdded,
          activityLogActions.accountingPaymentMethodUpdated,
          activityLogActions.accountingPaymentMethodRemoved
        ]
      }
    });
  }

  const recentActivity = auditScopeClauses.length
    ? (
        await prisma.auditLog.findMany({
          where: {
            organizationId: input.organizationId,
            OR: auditScopeClauses
          },
          include: {
            membership: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: 10
        })
      ).map(mapBillingActivityItem)
    : [];

  const notices: OfficeBillingNotice[] = [];

  if (outstandingBalance.greaterThan(0)) {
    notices.push({
      tone: "warning",
      title: "Outstanding balance recorded",
      description: `You currently have ${formatCurrency(outstandingBalance)} in open charges. Self-service checkout is not implemented; office accounting records payments manually.`
    });
  }

  if (paymentMethodIssueCount > 0) {
    notices.push({
      tone: "danger",
      title: "Payment method needs attention",
      description: `${paymentMethodIssueCount} stored payment method${paymentMethodIssueCount === 1 ? "" : "s"} ${paymentMethodIssueCount === 1 ? "shows" : "show"} an invalid or expired state.`
    });
  } else if (paymentMethods.length === 0) {
    notices.push({
      tone: "neutral",
      title: "No payment method on file",
      description: "You can store a masked payment-method reference below, but no live card or ACH processing is connected in this MVP."
    });
  }

  if (statements.length > 0) {
    notices.push({
      tone: "accent",
      title: "Monthly statement summaries available",
      description: "Statements are generated live from the current billing ledger below. PDF downloads export the current live summary and do not create archived statement snapshots."
    });
  }

  return {
    summary: {
      outstandingBalanceLabel: formatCurrency(outstandingBalance),
      openChargesCount: outstandingChargeTransactions.length,
      pendingChargesLabel: formatCurrency(pendingChargeTotal),
      pendingChargesCount: pendingChargeTransactions.length + pendingRecurringRules.length,
      recentPaymentsLabel: formatCurrency(recentPaymentsTotal),
      recentPaymentsWindowLabel: "Last 90 days",
      creditBalanceLabel: formatCurrency(creditBalance),
      creditBalanceCount: creditTransactions.filter((transaction) => getSourceRemainingAmount(transaction).greaterThan(0)).length,
      paymentMethodIssueCount,
      latestStatementPeriodLabel: latestStatement?.periodLabel ?? "No statements yet",
      latestStatementBalanceLabel: latestStatement?.currentBalanceLabel ?? formatCurrency(0),
      latestStatementGeneratedAtLabel: latestStatement?.generatedAtLabel ?? "Not available"
    },
    notices,
    outstandingChargeRows: outstandingChargeTransactions.map(mapLedgerRow),
    pendingChargeRows: pendingChargeTransactions.map(mapLedgerRow),
    upcomingChargeRows: [
      ...pendingChargeTransactions.map((transaction) => ({
        id: transaction.id,
        dueDate: formatDateValue(transaction.dueDate ?? transaction.accountingDate),
        sourceType: "Pending invoice" as const,
        description: transaction.memo ?? transaction.billingCategory ?? accountingTypeLabelMap[transaction.type],
        amountLabel: formatCurrency(getInvoiceOutstandingAmount(transaction)),
        status: formatLedgerStatusLabel(transaction),
        linkedTransactionLabel: transaction.relatedTransaction
          ? `${transaction.relatedTransaction.title} · ${transaction.relatedTransaction.address}, ${transaction.relatedTransaction.city}`
          : "—",
        linkedTransactionHref: transaction.relatedTransaction ? `/office/transactions/${transaction.relatedTransaction.id}` : null
      })),
      ...pendingRecurringRules.map((rule) => ({
        id: rule.id,
        dueDate: formatDateValue(rule.nextDueDate),
        sourceType: "Recurring rule" as const,
        description: rule.description ?? rule.name,
        amountLabel: formatCurrency(rule.amount),
        status: "Scheduled",
        linkedTransactionLabel: "Generated from recurring billing rule",
        linkedTransactionHref: null
      }))
    ],
    ledgerRows,
    recentPaymentRows: recentPaymentTransactions.map(mapLedgerRow),
    creditRows: creditTransactions.map(mapLedgerRow),
    statements,
    latestStatement,
    paymentMethods: paymentMethods.map((method) => ({
      id: method.id,
      membershipId: method.membershipId,
      memberLabel: formatMembershipLabel(method.membership),
      type: agentPaymentMethodTypeLabelMap[method.type],
      typeValue: method.type,
      label: method.label,
      provider: method.provider,
      maskedReference: method.last4 ? `•••• ${method.last4}` : "Configured",
      last4: method.last4 ?? "",
      isDefault: method.isDefault,
      autoPayEnabled: method.autoPayEnabled,
      status: agentPaymentMethodStatusLabelMap[method.status],
      statusValue: method.status
    })),
    recentActivity,
    limitations: [
      "Self-service checkout and ACH capture are not implemented. Payments are recorded through office accounting workflows.",
      "Billing statement PDFs are live exports of the current ledger summary. They are not finalized or archived statement snapshots.",
      "Payment methods store only masked references and auto-pay flags. Raw card or bank credentials are never stored here."
    ]
  };
}

export async function createAgentBillingCharges(input: CreateAgentBillingChargesInput) {
  const amount = parseOptionalDecimal(input.amount);
  const accountingDate = parseOptionalDate(input.accountingDate);

  if (!amount || amount.lte(0)) {
    throw new Error("A positive charge amount is required.");
  }

  if (!accountingDate) {
    throw new Error("Accounting date is required.");
  }

  const membershipIds = Array.from(new Set(input.membershipIds.filter(Boolean)));

  if (!membershipIds.length) {
    throw new Error("Select at least one agent for the charge.");
  }

  const createdIds = await prisma.$transaction(async (tx) => {
    const [memberships, incomeAccount] = await Promise.all([
      tx.membership.findMany({
        where: {
          organizationId: input.organizationId,
          id: {
            in: membershipIds
          },
          role: "agent",
          status: "active"
        },
        include: {
          user: true
        }
      }),
      getAgentBillingIncomeAccount(tx, input.organizationId)
    ]);

    if (memberships.length !== membershipIds.length) {
      throw new Error("One or more selected agents were not found.");
    }

    const created: string[] = [];

    for (const membership of memberships) {
      const transactionId = await saveAccountingTransactionInternal(tx, {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership.officeId ?? null,
        relatedTransactionId: input.relatedTransactionId,
        relatedMembershipId: membership.id,
        type: "invoice",
        status: "open",
        accountingDate: formatDateValue(accountingDate),
        dueDate: input.dueDate,
        counterpartyName: formatMembershipLabel(membership),
        memo: input.description || input.chargeType,
        notes: input.notes,
        isAgentBilling: true,
        billingCategory: input.chargeType,
        activityActionOverride: activityLogActions.accountingAgentChargeCreated,
        activityContextHref: "/office/accounting#agent-billing",
        lineItems: [
          {
            ledgerAccountId: incomeAccount.id,
            description: input.description || input.chargeType,
            amount: input.amount,
            entrySide: "credit"
          }
        ],
        createdByMembershipId: input.createdByMembershipId,
        actorMembershipId: input.actorMembershipId ?? input.createdByMembershipId
      });

      created.push(transactionId);
    }

    return created;
  });

  return createdIds;
}

export async function createAgentRecurringChargeRule(input: CreateAgentRecurringChargeRuleInput) {
  const frequency = parseRecurringFrequency(input.frequency);
  const amount = parseOptionalDecimal(input.amount);
  const startDate = parseOptionalDate(input.startDate);
  const nextDueDate = parseOptionalDate(input.nextDueDate);
  const endDate = parseOptionalDate(input.endDate);
  const customIntervalDays = input.customIntervalDays ? Number(input.customIntervalDays) : null;

  if (!frequency) {
    throw new Error("Recurring frequency is required.");
  }

  if (!amount || amount.lte(0)) {
    throw new Error("A positive recurring charge amount is required.");
  }

  if (!startDate || !nextDueDate) {
    throw new Error("Start date and next due date are required.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId,
        role: "agent",
        status: "active"
      },
      include: {
        user: true
      }
    });

    if (!membership) {
      throw new Error("Agent membership was not found.");
    }

    const rule = await tx.agentRecurringChargeRule.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership.officeId ?? null,
        membershipId: membership.id,
        name: input.name.trim(),
        chargeType: input.chargeType.trim(),
        description: parseOptionalText(input.description),
        amount,
        frequency,
        customIntervalDays: frequency === "custom_interval" ? Math.max(customIntervalDays ?? 30, 1) : null,
        startDate,
        nextDueDate,
        endDate,
        autoGenerateInvoice: Boolean(input.autoGenerateInvoice),
        isActive: input.isActive ?? true
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_recurring_charge_rule",
      entityId: rule.id,
      action: activityLogActions.accountingRecurringRuleCreated,
      payload: {
        officeId: rule.officeId,
        objectLabel: `${rule.name} · ${formatMembershipLabel(membership)}`,
        contextHref: "/office/accounting#agent-billing",
        details: [
          `Charge type: ${rule.chargeType}`,
          `Amount: ${formatCurrency(rule.amount)}`,
          `Frequency: ${formatFrequency(rule)}`
        ]
      }
    });

    return rule.id;
  });

  return created;
}

export async function updateAgentRecurringChargeRule(input: UpdateAgentRecurringChargeRuleInput) {
  const existing = await prisma.agentRecurringChargeRule.findFirst({
    where: {
      id: input.recurringChargeRuleId,
      organizationId: input.organizationId
    },
    include: {
      membership: {
        include: {
          user: true
        }
      }
    }
  });

  if (!existing) {
    return null;
  }

  const frequency = input.frequency !== undefined ? parseRecurringFrequency(input.frequency) : existing.frequency;
  const amount = input.amount !== undefined ? parseOptionalDecimal(input.amount) : existing.amount;
  const membershipId = input.membershipId ?? existing.membershipId;

  if (!frequency || !amount || amount.lte(0)) {
    throw new Error("Recurring rule updates must keep a valid frequency and positive amount.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const membership = membershipId === existing.membershipId
      ? existing.membership
      : await tx.membership.findFirst({
          where: {
            id: membershipId,
            organizationId: input.organizationId,
            role: "agent",
            status: "active"
          },
          include: {
            user: true
          }
        });

    if (!membership) {
      throw new Error("Agent membership was not found.");
    }

    const saved = await tx.agentRecurringChargeRule.update({
      where: {
        id: existing.id
      },
      data: {
        officeId: input.officeId !== undefined ? input.officeId : existing.officeId,
        membershipId,
        name: input.name !== undefined ? input.name.trim() : existing.name,
        chargeType: input.chargeType !== undefined ? input.chargeType.trim() : existing.chargeType,
        description: input.description !== undefined ? parseOptionalText(input.description) : existing.description,
        amount,
        frequency,
        customIntervalDays:
          frequency === "custom_interval"
            ? Math.max(input.customIntervalDays ? Number(input.customIntervalDays) : existing.customIntervalDays ?? 30, 1)
            : null,
        startDate: input.startDate !== undefined ? parseOptionalDate(input.startDate) ?? existing.startDate : existing.startDate,
        nextDueDate: input.nextDueDate !== undefined ? parseOptionalDate(input.nextDueDate) ?? existing.nextDueDate : existing.nextDueDate,
        endDate: input.endDate !== undefined ? parseOptionalDate(input.endDate) : existing.endDate,
        autoGenerateInvoice: input.autoGenerateInvoice ?? existing.autoGenerateInvoice,
        isActive: input.isActive ?? existing.isActive
      }
    });

    const changes = [
      existing.name !== saved.name ? { label: "Name", previousValue: existing.name, nextValue: saved.name } : null,
      existing.chargeType !== saved.chargeType ? { label: "Charge type", previousValue: existing.chargeType, nextValue: saved.chargeType } : null,
      !existing.amount.equals(saved.amount) ? { label: "Amount", previousValue: formatCurrency(existing.amount), nextValue: formatCurrency(saved.amount) } : null,
      existing.isActive !== saved.isActive ? { label: "Active", previousValue: existing.isActive ? "Yes" : "No", nextValue: saved.isActive ? "Yes" : "No" } : null,
      existing.nextDueDate.getTime() !== saved.nextDueDate.getTime() ? { label: "Next due date", previousValue: formatDateValue(existing.nextDueDate), nextValue: formatDateValue(saved.nextDueDate) } : null
    ].filter(Boolean);

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_recurring_charge_rule",
      entityId: saved.id,
      action: saved.isActive
        ? activityLogActions.accountingRecurringRuleUpdated
        : activityLogActions.accountingRecurringRuleDeactivated,
      payload: {
        officeId: saved.officeId,
        objectLabel: `${saved.name} · ${formatMembershipLabel(membership)}`,
        contextHref: "/office/accounting#agent-billing",
        changes: changes as Array<{ label: string; previousValue: string; nextValue: string }>
      }
    });

    return saved.id;
  });

  return updated;
}

export async function generateDueAgentBillingCharges(input: GenerateDueAgentBillingChargesInput) {
  const asOfDate = parseOptionalDate(input.asOfDate) ?? new Date();

  const generatedTransactionIds = await prisma.$transaction(async (tx) => {
    const [rules, incomeAccount] = await Promise.all([
      tx.agentRecurringChargeRule.findMany({
        where: {
          organizationId: input.organizationId,
          ...buildScopedOfficeWhere(input.officeId),
          isActive: true,
          autoGenerateInvoice: true,
          nextDueDate: {
            lte: asOfDate
          },
          ...(input.membershipId ? { membershipId: input.membershipId } : {})
        },
        include: {
          membership: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ nextDueDate: "asc" }]
      }),
      getAgentBillingIncomeAccount(tx, input.organizationId)
    ]);

    const createdIds: string[] = [];

    for (const rule of rules) {
      let cursorDate = new Date(rule.nextDueDate);

      while (cursorDate <= asOfDate && (!rule.endDate || cursorDate <= rule.endDate)) {
        const transactionId = await saveAccountingTransactionInternal(tx, {
          organizationId: input.organizationId,
          officeId: input.officeId ?? rule.officeId ?? rule.membership.officeId ?? null,
          relatedMembershipId: rule.membershipId,
          type: "invoice",
          status: "open",
          accountingDate: formatDateValue(cursorDate),
          dueDate: formatDateValue(cursorDate),
          counterpartyName: formatMembershipLabel(rule.membership),
          memo: rule.description ?? rule.name,
          notes: `Generated from recurring rule: ${rule.name}`,
          isAgentBilling: true,
          billingCategory: rule.chargeType,
          originRecurringChargeRuleId: rule.id,
          activityContextHref: "/office/accounting#agent-billing",
          lineItems: [
            {
              ledgerAccountId: incomeAccount.id,
              description: rule.description ?? rule.name,
              amount: String(rule.amount),
              entrySide: "credit"
            }
          ],
          createdByMembershipId: input.actorMembershipId,
          actorMembershipId: input.actorMembershipId
        });

        createdIds.push(transactionId);
        rule.lastGeneratedAt = cursorDate;
        cursorDate = getNextRecurringDate(rule, cursorDate);
      }

      await tx.agentRecurringChargeRule.update({
        where: {
          id: rule.id
        },
        data: {
          lastGeneratedAt: rule.lastGeneratedAt ?? rule.lastGeneratedAt,
          nextDueDate: cursorDate
        }
      });
    }

    return createdIds;
  });

  return generatedTransactionIds;
}

export async function createAgentPaymentMethod(input: CreateAgentPaymentMethodInput) {
  const type = parseAgentPaymentMethodType(input.type);
  const status = parseAgentPaymentMethodStatus(input.status) ?? "active";

  if (!type) {
    throw new Error("Payment method type is required.");
  }

  if (!input.label.trim()) {
    throw new Error("Payment method label is required.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId,
        role: "agent",
        status: "active"
      },
      include: {
        user: true
      }
    });

    if (!membership) {
      throw new Error("Agent membership was not found.");
    }

    const existingCount = await tx.agentPaymentMethod.count({
      where: {
        organizationId: input.organizationId,
        membershipId: membership.id,
        status: {
          not: "removed"
        }
      }
    });

    const isDefault = input.isDefault ?? existingCount === 0;

    if (isDefault) {
      await tx.agentPaymentMethod.updateMany({
        where: {
          organizationId: input.organizationId,
          membershipId: membership.id
        },
        data: {
          isDefault: false
        }
      });
    }

    const paymentMethod = await tx.agentPaymentMethod.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership.officeId ?? null,
        membershipId: membership.id,
        type,
        label: input.label.trim(),
        provider: parseOptionalText(input.provider) ?? "Manual",
        last4: parseOptionalText(input.last4),
        isDefault,
        autoPayEnabled: Boolean(input.autoPayEnabled),
        externalReferenceId: parseOptionalText(input.externalReferenceId),
        status
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_payment_method",
      entityId: paymentMethod.id,
      action: activityLogActions.accountingPaymentMethodAdded,
      payload: {
        officeId: paymentMethod.officeId,
        objectLabel: `${formatMembershipLabel(membership)} · ${paymentMethod.label}`,
        contextHref: input.activityContextHref ?? "/office/accounting#agent-billing",
        details: [
          `Type: ${agentPaymentMethodTypeLabelMap[paymentMethod.type]}`,
          `Provider: ${paymentMethod.provider}`,
          `Auto-pay: ${paymentMethod.autoPayEnabled ? "Enabled" : "Disabled"}`
        ]
      }
    });

    return paymentMethod.id;
  });
}

export async function updateAgentPaymentMethod(input: UpdateAgentPaymentMethodInput) {
  const existing = await prisma.agentPaymentMethod.findFirst({
    where: {
      id: input.paymentMethodId,
      organizationId: input.organizationId
    },
    include: {
      membership: {
        include: {
          user: true
        }
      }
    }
  });

  if (!existing) {
    return null;
  }

  const nextType = input.type !== undefined ? parseAgentPaymentMethodType(input.type) : existing.type;
  const nextStatus = input.status !== undefined ? parseAgentPaymentMethodStatus(input.status) : existing.status;

  if (!nextType || !nextStatus) {
    throw new Error("Payment method updates must keep a valid type and status.");
  }

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.agentPaymentMethod.updateMany({
        where: {
          organizationId: input.organizationId,
          membershipId: existing.membershipId
        },
        data: {
          isDefault: false
        }
      });
    }

    const saved = await tx.agentPaymentMethod.update({
      where: {
        id: existing.id
      },
      data: {
        officeId: input.officeId !== undefined ? input.officeId : existing.officeId,
        membershipId: input.membershipId ?? existing.membershipId,
        type: nextType,
        label: input.label !== undefined ? input.label.trim() : existing.label,
        provider: input.provider !== undefined ? parseOptionalText(input.provider) ?? "Manual" : existing.provider,
        last4: input.last4 !== undefined ? parseOptionalText(input.last4) : existing.last4,
        isDefault: input.isDefault ?? existing.isDefault,
        autoPayEnabled: input.autoPayEnabled ?? existing.autoPayEnabled,
        externalReferenceId: input.externalReferenceId !== undefined ? parseOptionalText(input.externalReferenceId) : existing.externalReferenceId,
        status: nextStatus
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "agent_payment_method",
      entityId: saved.id,
      action: saved.status === "removed" ? activityLogActions.accountingPaymentMethodRemoved : activityLogActions.accountingPaymentMethodUpdated,
      payload: {
        officeId: saved.officeId,
        objectLabel: `${formatMembershipLabel(existing.membership)} · ${saved.label}`,
        contextHref: input.activityContextHref ?? "/office/accounting#agent-billing",
        details: [
          `Type: ${agentPaymentMethodTypeLabelMap[saved.type]}`,
          `Status: ${agentPaymentMethodStatusLabelMap[saved.status]}`,
          `Auto-pay: ${saved.autoPayEnabled ? "Enabled" : "Disabled"}`
        ]
      }
    });

    return saved.id;
  });
}

export async function createOfficeBillingPaymentMethod(input: CreateOfficeBillingPaymentMethodInput) {
  return createAgentPaymentMethod({
    organizationId: input.organizationId,
    officeId: input.officeId,
    membershipId: input.membershipId,
    type: input.type,
    label: input.label,
    provider: input.provider,
    last4: input.last4,
    isDefault: input.isDefault,
    autoPayEnabled: input.autoPayEnabled,
    actorMembershipId: input.actorMembershipId,
    activityContextHref: "/office/billing"
  });
}

export async function updateOfficeBillingPaymentMethod(input: UpdateOfficeBillingPaymentMethodInput) {
  const existing = await prisma.agentPaymentMethod.findFirst({
    where: {
      id: input.paymentMethodId,
      organizationId: input.organizationId,
      membershipId: input.membershipId
    }
  });

  if (!existing) {
    return null;
  }

  return updateAgentPaymentMethod({
    organizationId: input.organizationId,
    paymentMethodId: existing.id,
    officeId: input.officeId ?? existing.officeId,
    membershipId: input.membershipId,
    type: input.type,
    label: input.label,
    provider: input.provider,
    last4: input.last4,
    isDefault: input.isDefault,
    autoPayEnabled: input.autoPayEnabled,
    status: input.remove ? "removed" : undefined,
    actorMembershipId: input.actorMembershipId,
    activityContextHref: "/office/billing"
  });
}

export async function recordAgentBillingPayment(input: RecordAgentBillingPaymentInput) {
  const accountingDate = parseOptionalDate(input.accountingDate);

  if (!accountingDate) {
    throw new Error("Accounting date is required.");
  }

  const invoiceIds = Array.from(new Set(input.invoiceIds.filter(Boolean)));

  if (!invoiceIds.length) {
    throw new Error("Select at least one open invoice.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId,
        role: "agent",
        status: "active"
      },
      include: {
        user: true
      }
    });

    if (!membership) {
      throw new Error("Agent membership was not found.");
    }

    const invoices = await tx.accountingTransaction.findMany({
      where: {
        organizationId: input.organizationId,
        id: {
          in: invoiceIds
        },
        relatedMembershipId: membership.id,
        type: "invoice",
        isAgentBilling: true
      },
      include: {
        applicationsTo: true
      },
      orderBy: [{ dueDate: "asc" }, { accountingDate: "asc" }]
    });

    if (invoices.length !== invoiceIds.length) {
      throw new Error("One or more selected invoices were not found.");
    }

    const totalOutstanding = invoices.reduce((sum, invoice) => {
      const outstanding = invoice.totalAmount.minus(invoice.applicationsTo.reduce((acc, application) => acc.plus(application.amount), new Prisma.Decimal(0)));
      return sum.plus(outstanding.greaterThan(0) ? outstanding : new Prisma.Decimal(0));
    }, new Prisma.Decimal(0));

    const requestedAmount = parseOptionalDecimal(input.amount) ?? totalOutstanding;

    if (requestedAmount.lte(0)) {
      throw new Error("A positive payment amount is required.");
    }

    const paymentId = await saveAccountingTransactionInternal(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? membership.officeId ?? null,
      relatedMembershipId: membership.id,
      type: "received_payment",
      status: "posted",
      accountingDate: formatDateValue(accountingDate),
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber,
      counterpartyName: formatMembershipLabel(membership),
      notes: input.notes,
      totalAmount: requestedAmount.toString(),
      isAgentBilling: true,
      billingCategory: "collections",
      activityContextHref: "/office/accounting#agent-billing",
      createdByMembershipId: input.createdByMembershipId,
      actorMembershipId: input.actorMembershipId ?? input.createdByMembershipId
    });

    let remainingAmount = requestedAmount;

    for (const invoice of invoices) {
      if (remainingAmount.lte(0)) {
        break;
      }

      const outstanding = invoice.totalAmount.minus(invoice.applicationsTo.reduce((sum, application) => sum.plus(application.amount), new Prisma.Decimal(0)));
      const applicable = remainingAmount.lessThan(outstanding) ? remainingAmount : outstanding;

      if (applicable.greaterThan(0)) {
        await applyAccountingTransactionToInvoice(tx, {
          organizationId: input.organizationId,
          officeId: input.officeId ?? membership.officeId ?? null,
          sourceAccountingTransactionId: paymentId,
          targetAccountingTransactionId: invoice.id,
          createdByMembershipId: input.actorMembershipId ?? input.createdByMembershipId,
          amount: applicable,
          memo: input.notes ?? null
        });
        remainingAmount = remainingAmount.minus(applicable);
      }
    }

    return paymentId;
  });
}

export async function applyAgentBillingCreditMemo(input: ApplyAgentBillingCreditMemoInput) {
  const amount = parseOptionalDecimal(input.amount);

  return prisma.$transaction(async (tx) => {
    const source = await tx.accountingTransaction.findFirst({
      where: {
        id: input.creditMemoId,
        organizationId: input.organizationId,
        isAgentBilling: true,
        type: "credit_memo"
      },
      include: {
        applicationsFrom: true
      }
    });

    const target = await tx.accountingTransaction.findFirst({
      where: {
        id: input.invoiceId,
        organizationId: input.organizationId,
        isAgentBilling: true,
        type: "invoice"
      },
      include: {
        applicationsTo: true
      }
    });

    if (!source || !target) {
      throw new Error("Credit memo or invoice was not found.");
    }

    const sourceRemaining = source.totalAmount.minus(source.applicationsFrom.reduce((sum, application) => sum.plus(application.amount), new Prisma.Decimal(0)));
    const targetOutstanding = target.totalAmount.minus(target.applicationsTo.reduce((sum, application) => sum.plus(application.amount), new Prisma.Decimal(0)));
    const applicable = amount ?? (sourceRemaining.lessThan(targetOutstanding) ? sourceRemaining : targetOutstanding);

    if (applicable.lte(0)) {
      throw new Error("A positive credit amount is required.");
    }

    await applyAccountingTransactionToInvoice(tx, {
      organizationId: input.organizationId,
      officeId: input.officeId ?? source.officeId ?? target.officeId ?? null,
      sourceAccountingTransactionId: source.id,
      targetAccountingTransactionId: target.id,
      createdByMembershipId: input.actorMembershipId,
      amount: applicable,
      memo: input.memo ?? null
    });

    return {
      creditMemoId: source.id,
      invoiceId: target.id
    };
  });
}
