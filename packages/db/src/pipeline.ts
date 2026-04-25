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
    historyYear: string;
  };
  metricModeLabel: string;
  metricModeDescription: string;
  historyYearOptions: number[];
  currentMonthHistory: OfficePipelineHistoryMonth | null;
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
  locale?: string;
  search?: string;
  representing?: string;
  ownerMembershipId?: string;
  metricMode?: string;
  view?: string;
  stage?: string;
  historyStatus?: string;
  historyMonth?: string;
  historyYear?: string;
};

type PipelineWorkspaceTransaction = {
  id: string;
  createdAt: Date;
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
  commissionCalculations: Array<{
    membershipId: string | null;
    statementAmount: Prisma.Decimal;
  }>;
};

type PipelineMetricTransaction = Pick<
  PipelineWorkspaceTransaction,
  | "id"
  | "createdAt"
  | "purchasedPrice"
  | "price"
  | "grossCommission"
  | "officeNet"
  | "agentNet"
  | "closingDate"
  | "updatedAt"
  | "ownerMembershipId"
  | "commissionCalculations"
>;

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

function buildPipelineMetricTransactionSelect(membershipIds: string[]) {
  return {
    id: true,
    createdAt: true,
    purchasedPrice: true,
    price: true,
    grossCommission: true,
    officeNet: true,
    agentNet: true,
    closingDate: true,
    updatedAt: true,
    ownerMembershipId: true,
    commissionCalculations: getCommissionCalculationSelect(membershipIds)
  } satisfies Prisma.TransactionSelect;
}

function buildPipelineRowTransactionSelect(membershipIds: string[]) {
  return {
    id: true,
    createdAt: true,
    title: true,
    address: true,
    city: true,
    state: true,
    zipCode: true,
    purchasedPrice: true,
    price: true,
    grossCommission: true,
    officeNet: true,
    agentNet: true,
    importantDate: true,
    closingDate: true,
    updatedAt: true,
    status: true,
    representing: true,
    ownerMembershipId: true,
    ownerMembership: {
      select: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    },
    commissionCalculations: getCommissionCalculationSelect(membershipIds)
  } satisfies Prisma.TransactionSelect;
}

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

function normalizeHistoryYear(value: string | undefined) {
  if (!value) {
    return "";
  }

  return /^\d{4}$/.test(value) ? value : "";
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

export function buildPipelineYearHistoryMonthKeys(year: number) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export function buildPipelineHistoryYearOptions(now: Date = new Date(), oldestClosedYear?: number | null) {
  const currentYear = Number(now.toISOString().slice(0, 4));
  const floorYear = oldestClosedYear && oldestClosedYear < currentYear ? oldestClosedYear : currentYear;
  const years: number[] = [];

  for (let year = currentYear; year >= floorYear; year -= 1) {
    years.push(year);
  }

  return years;
}

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined, locale = "en-US") {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function formatDateLabel(value: Date, locale = "en-US") {
  return value.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatMonthLabel(monthKey: string, locale = "en-US") {
  const [year, month] = monthKey.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric"
  });
}

function getMonthKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 7);
}

function getYearFromDate(date: Date) {
  return Number(date.toISOString().slice(0, 4));
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
  return getMonthKeyFromDate(getMonthlyRollupDate(transaction));
}

function getHistoryMonthDateRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  return {
    start,
    end
  };
}

function buildHistoryWindowWhere(
  baseWhere: Prisma.TransactionWhereInput,
  historyMonthKeys: string[],
  metricScopeWhere: Prisma.TransactionWhereInput | null
): Prisma.TransactionWhereInput {
  const sortedMonthKeys = [...historyMonthKeys].sort();
  const oldestMonth = sortedMonthKeys[0];
  const newestMonth = sortedMonthKeys[sortedMonthKeys.length - 1];
  const oldestRange = getHistoryMonthDateRange(oldestMonth);
  const newestRange = getHistoryMonthDateRange(newestMonth);

  return {
    AND: [
      baseWhere,
      {
        status: "closed"
      },
      {
        OR: [
          {
            closingDate: {
              gte: oldestRange.start,
              lt: newestRange.end
            }
          },
          {
            AND: [
              {
                closingDate: null
              },
              {
                updatedAt: {
                  gte: oldestRange.start,
                  lt: newestRange.end
                }
              }
            ]
          }
        ]
      },
      ...(metricScopeWhere ? [metricScopeWhere] : [])
    ]
  };
}

function buildClosedBaseWhere(
  baseWhere: Prisma.TransactionWhereInput,
  metricScopeWhere: Prisma.TransactionWhereInput | null
): Prisma.TransactionWhereInput {
  return {
    AND: [
      baseWhere,
      {
        status: "closed"
      },
      ...(metricScopeWhere ? [metricScopeWhere] : [])
    ]
  };
}

function buildPendingWhere(
  baseWhere: Prisma.TransactionWhereInput,
  metricScopeWhere: Prisma.TransactionWhereInput | null
): Prisma.TransactionWhereInput {
  return {
    AND: [
      baseWhere,
      {
        status: "pending"
      },
      ...(metricScopeWhere ? [metricScopeWhere] : [])
    ]
  };
}

function getCommissionCalculationSelect(membershipIds: string[]) {
  return membershipIds.length > 0
    ? {
        where: {
          membershipId: {
            in: membershipIds
          }
        },
        select: {
          membershipId: true,
          statementAmount: true
        }
      }
    : {
        where: {
          membershipId: {
            in: ["__no_membership__"]
          }
        },
        select: {
          membershipId: true,
          statementAmount: true
        }
      };
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

function buildPipelineMetricScopeWhere(
  viewerMembershipId: string,
  metricMode: OfficePipelineMetricMode
): Prisma.TransactionWhereInput | null {
  if (!isMyMetricMode(metricMode)) {
    return null;
  }

  return {
    OR: [
      {
        ownerMembershipId: viewerMembershipId
      },
      {
        membershipLinks: {
          some: {
            membershipId: viewerMembershipId
          }
        }
      },
      {
        commissionCalculations: {
          some: {
            membershipId: viewerMembershipId
          }
        }
      }
    ]
  };
}

export function resolveDefaultOfficePipelineSelection(historyMonths: OfficePipelineHistoryMonth[]): {
  view: OfficePipelineView;
  historyMonth: string;
} {
  const currentMonth = historyMonths.find((month) => month.isCurrentMonth);

  if (currentMonth && currentMonth.count > 0) {
    return {
      view: "history",
      historyMonth: currentMonth.monthKey
    };
  }

  const latestMonthWithClosed = historyMonths
    .filter((month) => month.count > 0)
    .sort((left, right) => right.monthKey.localeCompare(left.monthKey))[0];

  if (latestMonthWithClosed) {
    return {
      view: "history",
      historyMonth: latestMonthWithClosed.monthKey
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
  membershipIds: string[],
  locale = "en-US"
): OfficePipelineWorkspaceRow {
  const keyDate = transaction.closingDate ?? transaction.importantDate ?? transaction.updatedAt;
  const keyDateTypeLabel = transaction.closingDate ? "Closed" : transaction.importantDate ? "Important date" : "Updated";

  return {
    id: transaction.id,
    addressLine: buildTransactionAddressLabel(transaction),
    amountLabel: formatCurrency(getTransactionMetricValue(transaction, metricMode, membershipIds), locale),
    owner: buildOwnerLabel(transaction),
    status: pipelineStatusFromDb[transaction.status],
    representing: representingLabelMap[transaction.representing],
    keyDateTypeLabel,
    keyDateLabel: keyDate ? formatDateLabel(keyDate, locale) : "—",
    updatedLabel: formatDateLabel(transaction.updatedAt, locale)
  };
}

function buildHistoryMonths(
  transactions: PipelineMetricTransaction[],
  historyMonthKeys: string[],
  metricMode: OfficePipelineMetricMode,
  membershipIds: string[],
  currentMonthKey: string,
  locale = "en-US"
) {
  return historyMonthKeys.map((monthKey) => {
    const monthTransactions = transactions.filter((transaction) => getMonthlyRollupKey(transaction) === monthKey);
    const totalMetric = monthTransactions.reduce(
      (sum, transaction) => sum + getTransactionMetricValue(transaction, metricMode, membershipIds),
      0
    );

    return {
      monthKey,
      label: formatMonthLabel(monthKey, locale),
      count: monthTransactions.length,
      metricLabel: formatCurrency(totalMetric, locale),
      isCurrentMonth: monthKey === currentMonthKey
    } satisfies OfficePipelineHistoryMonth;
  });
}

async function resolveOldestClosedHistoryYear(input: {
  baseWhere: Prisma.TransactionWhereInput;
  metricScopeWhere: Prisma.TransactionWhereInput | null;
}) {
  const closedBaseWhere = buildClosedBaseWhere(input.baseWhere, input.metricScopeWhere);
  const [earliestClosingTransaction, earliestFallbackTransaction] = await Promise.all([
    prisma.transaction.findFirst({
      where: {
        AND: [
          closedBaseWhere,
          {
            closingDate: {
              not: null
            }
          }
        ]
      },
      orderBy: [{ closingDate: "asc" }, { updatedAt: "asc" }],
      select: {
        closingDate: true
      }
    }),
    prisma.transaction.findFirst({
      where: {
        AND: [
          closedBaseWhere,
          {
            closingDate: null
          }
        ]
      },
      orderBy: [{ updatedAt: "asc" }],
      select: {
        updatedAt: true
      }
    })
  ]);
  const candidates = [earliestClosingTransaction?.closingDate, earliestFallbackTransaction?.updatedAt].filter(
    (value): value is Date => value instanceof Date
  );

  if (candidates.length === 0) {
    return null;
  }

  const earliestDate = candidates.sort((left, right) => left.getTime() - right.getTime())[0];
  return getYearFromDate(earliestDate);
}

async function loadPipelineMetricTransactions(input: {
  where: Prisma.TransactionWhereInput;
  membershipIds: string[];
  orderBy?: Prisma.TransactionOrderByWithRelationInput[];
}) {
  return prisma.transaction.findMany({
    where: input.where,
    select: buildPipelineMetricTransactionSelect(input.membershipIds),
    orderBy: input.orderBy
  });
}

async function loadPipelineRowsByIds(input: {
  transactionIds: string[];
  membershipIds: string[];
}) {
  if (input.transactionIds.length === 0) {
    return [] satisfies PipelineWorkspaceTransaction[];
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      id: {
        in: input.transactionIds
      }
    },
    select: buildPipelineRowTransactionSelect(input.membershipIds)
  });
  const transactionMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));

  return input.transactionIds.flatMap((transactionId) => {
    const transaction = transactionMap.get(transactionId);
    return transaction ? [transaction] : [];
  });
}

export async function getOfficePipelineWorkspaceSnapshot(
  input: GetOfficePipelineWorkspaceInput
): Promise<OfficePipelineWorkspaceSnapshot> {
  const now = new Date();
  const locale = input.locale ?? "en-US";
  const currentMonthKey = buildPipelineHistoryMonthKeys(now)[0];
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
  const metricMembershipIds = isMyMetricMode(metricMode) ? getMyPipelineVisibleMembershipIds(scope) : [];
  const metricScopeWhere = buildPipelineMetricScopeWhere(scope.viewerMembershipId, metricMode);
  const requestedHistoryYear = normalizeHistoryYear(input.historyYear);
  const requestedSelection = normalizeOfficePipelineSelectionInput({
    view: input.view,
    stage: input.stage,
    historyStatus: input.historyStatus,
    historyMonth: input.historyMonth
  });
  const baseWhere = buildTopLevelWhere(input, representing, scope);
  const pendingWhere = buildPendingWhere(baseWhere, metricScopeWhere);
  const currentMonthWhere = buildHistoryWindowWhere(baseWhere, [currentMonthKey], metricScopeWhere);
  const [pendingTransactions, oldestClosedHistoryYear, currentMonthTransactions] = await Promise.all([
    loadPipelineMetricTransactions({
      where: pendingWhere,
      membershipIds: metricMembershipIds,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    }),
    resolveOldestClosedHistoryYear({
      baseWhere,
      metricScopeWhere
    }),
    loadPipelineMetricTransactions({
      where: currentMonthWhere,
      membershipIds: metricMembershipIds
    })
  ]);
  const historyYearOptions = buildPipelineHistoryYearOptions(now, oldestClosedHistoryYear);
  const selectedHistoryYear =
    requestedHistoryYear && historyYearOptions.includes(Number(requestedHistoryYear)) ? requestedHistoryYear : "";
  const historyMonthKeys = selectedHistoryYear
    ? buildPipelineYearHistoryMonthKeys(Number(selectedHistoryYear))
    : buildPipelineHistoryMonthKeys(now);
  const historyWhere = buildHistoryWindowWhere(baseWhere, historyMonthKeys, metricScopeWhere);
  const closedHistoryTransactions = await loadPipelineMetricTransactions({
    where: historyWhere,
    membershipIds: metricMembershipIds
  });
  const historyMonths = buildHistoryMonths(
    closedHistoryTransactions,
    historyMonthKeys,
    metricMode,
    metricMembershipIds,
    currentMonthKey,
    locale
  );
  const currentMonthHistory =
    buildHistoryMonths(currentMonthTransactions, [currentMonthKey], metricMode, metricMembershipIds, currentMonthKey, locale)[0] ?? null;
  const selectionFilters = resolveSelection(requestedSelection, historyMonths);
  const selectedMetricTransactions =
    selectionFilters.view === "pending"
      ? pendingTransactions
      : closedHistoryTransactions
          .filter((transaction) => getMonthlyRollupKey(transaction) === selectionFilters.historyMonth)
          .sort((left, right) => getMonthlyRollupDate(right).getTime() - getMonthlyRollupDate(left).getTime());
  const selectedTransactionIds = selectedMetricTransactions.map((transaction) => transaction.id);
  const selectedTransactions = await loadPipelineRowsByIds({
    transactionIds: selectedTransactionIds,
    membershipIds: metricMembershipIds
  });
  const pendingMetricTotal = pendingTransactions.reduce(
    (sum, transaction) => sum + getTransactionMetricValue(transaction, metricMode, metricMembershipIds),
    0
  );
  const selectedMetricTotal = selectedMetricTransactions.reduce(
    (sum, transaction) => sum + getTransactionMetricValue(transaction, metricMode, metricMembershipIds),
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
      historyMonth: selectionFilters.historyMonth,
      historyYear: selectedHistoryYear
    },
    metricModeLabel: metricModeLabels[metricMode],
    metricModeDescription: buildMetricModeDescription(metricMode),
    historyYearOptions,
    currentMonthHistory,
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
      totalCount: selectedMetricTransactions.length,
      totalMetricLabel: formatCurrency(selectedMetricTotal, locale)
    },
    pendingSummary: {
      count: pendingTransactions.length,
      metricLabel: formatCurrency(pendingMetricTotal, locale)
    },
    historyMonths,
    rows: selectedTransactions.map((transaction) => mapPipelineRow(transaction, metricMode, metricMembershipIds, locale))
  };
}
