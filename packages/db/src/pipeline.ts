import { Prisma, TransactionRepresenting, TransactionStatus, UserRole } from "@prisma/client";
import { buildTransactionPortfolioVisibilityWhere, resolveOfficeDataScope, type OfficeDataScope } from "./access";
import { prisma } from "./client";

export type OfficePipelineStatus = "Opportunity" | "Active" | "Pending" | "Closed" | "Cancelled";
export type OfficePipelineView = "pending" | "history";
export type OfficePipelineMetricScope = "office" | "my";
export type OfficePipelineMetricMode =
  | "office_net"
  | "office_sales_volume"
  | "office_gross"
  | "my_net_income"
  | "my_gross_commission"
  | "my_sales_volume";
export type OfficePipelineHistoryStatus = "Closed";
export type OfficePipelineRepresentingFilter = TransactionRepresenting | "all";

export type OfficePipelineOwnerOption = {
  id: string;
  label: string;
};

export type OfficePipelineMetricOption = {
  value: OfficePipelineMetricMode;
  label: string;
  description: string;
  scope: OfficePipelineMetricScope;
};

export type OfficePipelineFunnelBucket = {
  status: "Pending";
  count: number;
  metricLabel: string;
  note: string;
};

export type OfficePipelineHistoryBucket = {
  status: OfficePipelineHistoryStatus;
  count: number;
  metricLabel: string;
};

export type OfficePipelineHistoryMonth = {
  monthKey: string;
  label: string;
  count: number;
  metricLabel: string;
  isCurrentMonth: boolean;
};

export type OfficePipelineWorkspaceRow = {
  id: string;
  addressLine: string;
  amountLabel: string;
  owner: string;
  status: OfficePipelineStatus;
  representing: string;
  keyDateTypeLabel: string;
  keyDateLabel: string;
  updatedLabel: string;
};

export type OfficePipelineWorkspaceSnapshot = {
  filters: {
    search: string;
    representing: OfficePipelineRepresentingFilter;
    ownerMembershipId: string;
    metricMode: OfficePipelineMetricMode;
    metricOptions: OfficePipelineMetricOption[];
    view: OfficePipelineView;
    historyMonth: string;
  };
  metricModeLabel: string;
  metricModeDescription: string;
  selection: {
    kind: OfficePipelineView;
    label: string;
    note: string;
    contextChips: string[];
  };
  summary: {
    totalCount: number;
    totalMetricLabel: string;
  };
  pendingSummary: {
    count: number;
    metricLabel: string;
  };
  historyMonths: OfficePipelineHistoryMonth[];
  rows: OfficePipelineWorkspaceRow[];
};

export type GetOfficePipelineWorkspaceInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  search?: string;
  representing?: string;
  ownerMembershipId?: string;
  metricMode?: string;
  view?: string;
  stage?: string;
  historyStatus?: string;
  historyMonth?: string;
};

type PipelineWorkspaceTransaction = {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  purchasedPrice: Prisma.Decimal | null;
  price: Prisma.Decimal | null;
  grossCommission: Prisma.Decimal | null;
  officeNet: Prisma.Decimal | null;
  agentNet: Prisma.Decimal | null;
  importantDate: Date | null;
  closingDate: Date | null;
  updatedAt: Date;
  status: TransactionStatus;
  representing: TransactionRepresenting;
  ownerMembershipId: string | null;
  ownerMembership: {
    user: {
      firstName: string;
      lastName: string;
    };
  } | null;
  membershipLinks: Array<{
    membershipId: string;
  }>;
  commissionCalculations: Array<{
    membershipId: string | null;
    statementAmount: Prisma.Decimal;
  }>;
};

type NormalizedPipelineSelectionInput = {
  view: OfficePipelineView | "";
  historyMonth: string;
};

const pipelineHistoryWindowMonths = 6;
const supportedHistoryStatus: OfficePipelineHistoryStatus = "Closed";
const officePipelineMetricOrder: OfficePipelineMetricMode[] = ["office_net", "office_sales_volume", "office_gross"];
const myPipelineMetricOrder: OfficePipelineMetricMode[] = ["my_net_income", "my_gross_commission", "my_sales_volume"];

const pipelineStatusFromDb: Record<TransactionStatus, OfficePipelineStatus> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

const representingLabelMap: Record<TransactionRepresenting, string> = {
  buyer: "Buyer",
  seller: "Seller",
  both: "Both",
  tenant: "Tenant",
  landlord: "Landlord"
};

const metricModeLabels: Record<OfficePipelineMetricMode, string> = {
  office_net: "Office net",
  office_sales_volume: "Office sales volume",
  office_gross: "Office gross",
  my_net_income: "My net income",
  my_gross_commission: "My gross commission",
  my_sales_volume: "My sales volume"
};

function normalizeRepresentingFilter(value: string | undefined): OfficePipelineRepresentingFilter {
  if (!value || value === "all") {
    return "all";
  }

  return ["buyer", "seller", "both", "tenant", "landlord"].includes(value) ? (value as TransactionRepresenting) : "all";
}

function normalizeHistoryMonth(value: string | undefined) {
  if (!value) {
    return "";
  }

  return /^\d{4}-\d{2}$/.test(value) ? value : "";
}

export function canViewOfficePipelineMetrics(role: UserRole) {
  return role === "owner" || role === "office_admin";
}

function getDefaultMetricMode(canViewOfficeMetrics: boolean): OfficePipelineMetricMode {
  return canViewOfficeMetrics ? "office_sales_volume" : "my_sales_volume";
}

export function getOfficePipelineMetricOptions(canViewOfficeMetrics: boolean): OfficePipelineMetricOption[] {
  const officeOptions = officePipelineMetricOrder.map((value) => ({
    value,
    label: metricModeLabels[value],
    description: buildMetricModeDescription(value),
    scope: "office" as const
  }));
  const myOptions = myPipelineMetricOrder.map((value) => ({
    value,
    label: metricModeLabels[value],
    description: buildMetricModeDescription(value),
    scope: "my" as const
  }));

  return canViewOfficeMetrics ? [...officeOptions, ...myOptions] : myOptions;
}

export function normalizeOfficePipelineMetricMode(value: string | undefined, canViewOfficeMetrics: boolean): OfficePipelineMetricMode {
  if (value === "transaction_volume") {
    return canViewOfficeMetrics ? "office_sales_volume" : "my_sales_volume";
  }

  if (value === "office_net" || value === "office_sales_volume" || value === "office_gross") {
    return canViewOfficeMetrics ? value : getDefaultMetricMode(false);
  }

  if (value === "my_net_income" || value === "my_gross_commission" || value === "my_sales_volume") {
    return value;
  }

  return getDefaultMetricMode(canViewOfficeMetrics);
}

export function normalizeOfficePipelineSelectionInput(input: {
  view?: string;
  stage?: string;
  historyStatus?: string;
  historyMonth?: string;
}): NormalizedPipelineSelectionInput {
  const historyMonth = normalizeHistoryMonth(input.historyMonth);

  if (input.view === "pending" || input.stage === "Pending") {
    return {
      view: "pending",
      historyMonth: ""
    };
  }

  if (input.view === "history" && historyMonth) {
    return {
      view: "history",
      historyMonth
    };
  }

  if ((input.historyStatus === "Closed" || input.historyStatus === "Cancelled") && historyMonth) {
    return {
      view: "history",
      historyMonth
    };
  }

  return {
    view: "",
    historyMonth: ""
  };
}

export function buildPipelineHistoryMonthKeys(now: Date = new Date()) {
  const keys: string[] = [];
  const cursor = new Date(now);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  for (let index = 0; index < pipelineHistoryWindowMonths; index += 1) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    keys.push(monthKey);
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return keys;
}

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function formatDateLabel(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function isMyMetricMode(metricMode: OfficePipelineMetricMode) {
  return metricMode === "my_net_income" || metricMode === "my_gross_commission" || metricMode === "my_sales_volume";
}

function getPurchasedPriceValue(transaction: Pick<PipelineWorkspaceTransaction, "purchasedPrice" | "price">) {
  return Number(transaction.purchasedPrice ?? transaction.price ?? 0);
}

function getTransactionMetricValue(
  transaction: Pick<
    PipelineWorkspaceTransaction,
    "purchasedPrice" | "price" | "grossCommission" | "officeNet" | "agentNet" | "ownerMembershipId" | "commissionCalculations"
  >,
  metricMode: OfficePipelineMetricMode,
  membershipIds: string[]
) {
  if (metricMode === "office_net") {
    return Number(transaction.officeNet ?? 0);
  }

  if (metricMode === "office_gross") {
    return Number(transaction.grossCommission ?? 0);
  }

  if (metricMode === "my_net_income") {
    const scopedCommissionRows = transaction.commissionCalculations.filter(
      (calculation) => calculation.membershipId && membershipIds.includes(calculation.membershipId)
    );

    if (scopedCommissionRows.length > 0) {
      return scopedCommissionRows.reduce((sum, calculation) => sum + Number(calculation.statementAmount ?? 0), 0);
    }

    return membershipIds.includes(transaction.ownerMembershipId ?? "") ? Number(transaction.agentNet ?? 0) : 0;
  }

  if (metricMode === "my_gross_commission") {
    return Number(transaction.grossCommission ?? 0);
  }

  return getPurchasedPriceValue(transaction);
}

function getMonthlyRollupDate(transaction: Pick<PipelineWorkspaceTransaction, "closingDate" | "updatedAt">) {
  return transaction.closingDate ?? transaction.updatedAt;
}

function getMonthlyRollupKey(transaction: Pick<PipelineWorkspaceTransaction, "closingDate" | "updatedAt">) {
  return getMonthlyRollupDate(transaction).toISOString().slice(0, 7);
}

function buildTransactionAddressLabel(transaction: Pick<PipelineWorkspaceTransaction, "address" | "city" | "state" | "zipCode">) {
  const locality = [transaction.city, transaction.state].filter(Boolean).join(", ");
  return [transaction.address, locality, transaction.zipCode].filter(Boolean).join(" ").replace(/\s+,/g, ",");
}

function buildOwnerLabel(transaction: Pick<PipelineWorkspaceTransaction, "ownerMembership">) {
  return transaction.ownerMembership
    ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`.trim()
    : "Unassigned";
}

function buildMetricModeDescription(metricMode: OfficePipelineMetricMode) {
  if (metricMode === "office_net") {
    return "Uses stored office net values from transaction finance and commission workflow outputs; missing values are treated as zero.";
  }

  if (metricMode === "office_sales_volume") {
    return "Uses transaction purchased price as the office sales volume metric.";
  }

  if (metricMode === "office_gross") {
    return "Uses stored gross commission values from transaction finance; missing values are treated as zero.";
  }

  if (metricMode === "my_net_income") {
    return "Uses stored agent net values attributed to the current viewer only; missing values are treated as zero.";
  }

  if (metricMode === "my_gross_commission") {
    return "Uses transaction gross commission for deals where the current viewer is directly involved; missing values are treated as zero.";
  }

  return "Uses transaction purchased price for deals where the current viewer is directly involved.";
}

function buildTopLevelWhere(input: GetOfficePipelineWorkspaceInput, representing: OfficePipelineRepresentingFilter, scope: OfficeDataScope): Prisma.TransactionWhereInput {
  const whereConditions: Prisma.TransactionWhereInput[] = [
    {
      organizationId: input.organizationId
    },
    buildTransactionPortfolioVisibilityWhere(scope)
  ];

  if (input.officeId) {
    whereConditions.push({
      officeId: input.officeId
    });
  }

  if (representing !== "all") {
    whereConditions.push({
      representing
    });
  }

  if (input.ownerMembershipId?.trim()) {
    whereConditions.push({
      ownerMembershipId: input.ownerMembershipId.trim()
    });
  }

  if (input.search?.trim()) {
    const query = input.search.trim();

    whereConditions.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { address: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { state: { contains: query, mode: "insensitive" } },
        { zipCode: { contains: query, mode: "insensitive" } },
        {
          ownerMembership: {
            user: {
              OR: [
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } }
              ]
            }
          }
        }
      ]
    });
  }

  const where: Prisma.TransactionWhereInput = {
    AND: whereConditions
  };

  return where;
}

export function getMyPipelineVisibleMembershipIds(scope: OfficeDataScope) {
  return [scope.viewerMembershipId];
}

function transactionMatchesMembershipScope(transaction: PipelineWorkspaceTransaction, membershipIds: string[]) {
  if (membershipIds.includes(transaction.ownerMembershipId ?? "")) {
    return true;
  }

  if (transaction.commissionCalculations.some((calculation) => calculation.membershipId && membershipIds.includes(calculation.membershipId))) {
    return true;
  }

  return transaction.membershipLinks.some((membershipLink) => membershipIds.includes(membershipLink.membershipId));
}

function filterTransactionsForMetricScope(
  transactions: PipelineWorkspaceTransaction[],
  scope: OfficeDataScope,
  metricMode: OfficePipelineMetricMode
) {
  if (!isMyMetricMode(metricMode)) {
    return transactions;
  }

  const membershipIds = getMyPipelineVisibleMembershipIds(scope);
  return transactions.filter((transaction) => transactionMatchesMembershipScope(transaction, membershipIds));
}

export function resolveDefaultOfficePipelineSelection(historyMonths: OfficePipelineHistoryMonth[]): {
  view: OfficePipelineView;
  historyMonth: string;
} {
  const currentMonth = historyMonths[0];

  if (currentMonth && currentMonth.count > 0) {
    return {
      view: "history",
      historyMonth: currentMonth.monthKey
    };
  }

  const firstMonthWithClosed = historyMonths.find((month) => month.count > 0);

  if (firstMonthWithClosed) {
    return {
      view: "history",
      historyMonth: firstMonthWithClosed.monthKey
    };
  }

  return {
    view: "pending",
    historyMonth: ""
  };
}

function resolveSelection(
  requestedSelection: NormalizedPipelineSelectionInput,
  historyMonths: OfficePipelineHistoryMonth[]
): { view: OfficePipelineView; historyMonth: string } {
  if (requestedSelection.view === "pending") {
    return {
      view: "pending",
      historyMonth: ""
    };
  }

  if (
    requestedSelection.view === "history" &&
    requestedSelection.historyMonth &&
    historyMonths.some((month) => month.monthKey === requestedSelection.historyMonth)
  ) {
    return {
      view: "history",
      historyMonth: requestedSelection.historyMonth
    };
  }

  return resolveDefaultOfficePipelineSelection(historyMonths);
}

function mapPipelineRow(
  transaction: PipelineWorkspaceTransaction,
  metricMode: OfficePipelineMetricMode,
  membershipIds: string[]
): OfficePipelineWorkspaceRow {
  const keyDate = transaction.closingDate ?? transaction.importantDate ?? transaction.updatedAt;
  const keyDateTypeLabel = transaction.closingDate ? "Closed" : transaction.importantDate ? "Important date" : "Updated";

  return {
    id: transaction.id,
    addressLine: buildTransactionAddressLabel(transaction),
    amountLabel: formatCurrency(getTransactionMetricValue(transaction, metricMode, membershipIds)),
    owner: buildOwnerLabel(transaction),
    status: pipelineStatusFromDb[transaction.status],
    representing: representingLabelMap[transaction.representing],
    keyDateTypeLabel,
    keyDateLabel: keyDate ? formatDateLabel(keyDate) : "—",
    updatedLabel: formatDateLabel(transaction.updatedAt)
  };
}

export async function getOfficePipelineWorkspaceSnapshot(
  input: GetOfficePipelineWorkspaceInput
): Promise<OfficePipelineWorkspaceSnapshot> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null,
    resource: "transactions"
  });
  const representing = normalizeRepresentingFilter(input.representing);
  const canViewOfficeMetrics = canViewOfficePipelineMetrics(scope.viewerRole);
  const metricMode = normalizeOfficePipelineMetricMode(input.metricMode, canViewOfficeMetrics);
  const metricOptions = getOfficePipelineMetricOptions(canViewOfficeMetrics);
  const myMetricMembershipIds = getMyPipelineVisibleMembershipIds(scope);
  const requestedSelection = normalizeOfficePipelineSelectionInput({
    view: input.view,
    stage: input.stage,
    historyStatus: input.historyStatus,
    historyMonth: input.historyMonth
  });
  const where = buildTopLevelWhere(input, representing, scope);
  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      ownerMembership: {
        include: {
          user: true
        }
      },
      membershipLinks: {
        select: {
          membershipId: true
        }
      },
      commissionCalculations: {
        where: {
          membershipId: {
            in: myMetricMembershipIds
          }
        },
        select: {
          membershipId: true,
          statementAmount: true
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  const scopedTransactions = filterTransactionsForMetricScope(transactions, scope, metricMode);
  const pendingTransactions = scopedTransactions.filter((transaction) => pipelineStatusFromDb[transaction.status] === "Pending");
  const historyMonthKeys = buildPipelineHistoryMonthKeys();
  const historyMonths = historyMonthKeys.map((monthKey, index) => {
    const monthTransactions = scopedTransactions.filter(
      (transaction) => pipelineStatusFromDb[transaction.status] === supportedHistoryStatus && getMonthlyRollupKey(transaction) === monthKey
    );
    const totalMetric = monthTransactions.reduce(
      (sum, transaction) => sum + getTransactionMetricValue(transaction, metricMode, myMetricMembershipIds),
      0
    );

    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      count: monthTransactions.length,
      metricLabel: formatCurrency(totalMetric),
      isCurrentMonth: index === 0
    };
  });
  const selectionFilters = resolveSelection(requestedSelection, historyMonths);
  const selectedTransactions =
    selectionFilters.view === "pending"
      ? [...pendingTransactions].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      : scopedTransactions
          .filter(
            (transaction) =>
              pipelineStatusFromDb[transaction.status] === supportedHistoryStatus &&
              getMonthlyRollupKey(transaction) === selectionFilters.historyMonth
          )
          .sort((left, right) => getMonthlyRollupDate(right).getTime() - getMonthlyRollupDate(left).getTime());

  const selectedMetricTotal = selectedTransactions.reduce(
    (sum, transaction) => sum + getTransactionMetricValue(transaction, metricMode, myMetricMembershipIds),
    0
  );
  const pendingMetricTotal = pendingTransactions.reduce(
    (sum, transaction) => sum + getTransactionMetricValue(transaction, metricMode, myMetricMembershipIds),
    0
  );
  const representingFilterLabel = representing === "all" ? "Any side" : `${representingLabelMap[representing]} side`;
  const contextChips = [
    representingFilterLabel,
    ...(input.search?.trim() ? [`Search: ${input.search.trim()}`] : []),
    ...(input.ownerMembershipId?.trim() ? ["Owner filter applied"] : [])
  ];
  const selectedHistoryMonth = selectionFilters.view === "history"
    ? historyMonths.find((month) => month.monthKey === selectionFilters.historyMonth) ?? null
    : null;

  return {
    filters: {
      search: input.search?.trim() ?? "",
      representing,
      ownerMembershipId: input.ownerMembershipId?.trim() ?? "",
      metricMode,
      metricOptions,
      view: selectionFilters.view,
      historyMonth: selectionFilters.historyMonth
    },
    metricModeLabel: metricModeLabels[metricMode],
    metricModeDescription: buildMetricModeDescription(metricMode),
    selection: {
      kind: selectionFilters.view,
      label: selectionFilters.view === "pending" ? "Pending" : `${selectedHistoryMonth?.label ?? "Closed"} closed`,
      note:
        selectionFilters.view === "pending"
          ? "Showing pending transactions inside the current office, visibility scope, and side filter."
          : "Showing closed transactions for the selected month. Monthly history uses closing date first, then falls back to updated date.",
      contextChips
    },
    summary: {
      totalCount: selectedTransactions.length,
      totalMetricLabel: formatCurrency(selectedMetricTotal)
    },
    pendingSummary: {
      count: pendingTransactions.length,
      metricLabel: formatCurrency(pendingMetricTotal)
    },
    historyMonths,
    rows: selectedTransactions.map((transaction) => mapPipelineRow(transaction, metricMode, myMetricMembershipIds))
  };
}
