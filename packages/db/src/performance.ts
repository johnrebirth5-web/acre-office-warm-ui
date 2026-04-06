import {
  MembershipStatus,
  Prisma,
  TransactionFinanceFeeType,
  TransactionStatus,
  UserRole
} from "@prisma/client";
import { resolveOfficeDataScope, type OfficeDataScope } from "./access";
import { prisma } from "./client";

export type OfficePerformancePeriod = "month" | "quarter" | "year";
export type OfficePerformanceCompany = "ny" | "rental" | "nj";

export type OfficePerformanceOption = {
  id: string;
  label: string;
};

export type OfficePerformanceSummaryCard = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: "default" | "accent";
};

export type OfficePerformanceSummary = {
  cards: OfficePerformanceSummaryCard[];
};

export type OfficePerformanceTableColumn = {
  key: string;
  label: string;
};

export type OfficePerformanceTableRow = {
  membershipId: string;
  name: string;
  secondaryLabel: string;
  isViewer: boolean;
  totalLabel: string;
  cellLabels: Record<string, string>;
};

export type OfficePerformanceLeaderboardEntry = {
  membershipId: string;
  rank: number;
  name: string;
  performanceLabel: string;
  amountVisible: boolean;
  isViewer: boolean;
};

export type OfficePerformanceLeaderboard = {
  period: "month" | "quarter" | "year";
  title: string;
  subtitle: string;
  entries: OfficePerformanceLeaderboardEntry[];
  viewerEntry: OfficePerformanceLeaderboardEntry | null;
  emptyMessage: string;
};

export type OfficePerformanceFilters = {
  period: OfficePerformancePeriod;
  periodOptions: OfficePerformanceOption[];
  company: OfficePerformanceCompany;
  companyOptions: OfficePerformanceOption[];
  year: string;
  month: string;
  quarter: string;
  yearStart: string;
  yearEnd: string;
  yearOptions: OfficePerformanceOption[];
  monthOptions: OfficePerformanceOption[];
  quarterOptions: OfficePerformanceOption[];
  canExport: boolean;
  scopeLabel: string;
  companyLabel: string;
  defaults: {
    period: OfficePerformancePeriod;
    company: OfficePerformanceCompany;
    year: string;
    month: string;
    quarter: string;
    yearStart: string;
    yearEnd: string;
  };
};

export type OfficePerformanceWorkspace = {
  filters: OfficePerformanceFilters;
  selectedRangeLabel: string;
  summary: OfficePerformanceSummary;
  table: {
    columns: OfficePerformanceTableColumn[];
    rows: OfficePerformanceTableRow[];
    rowCount: number;
    emptyMessage: string;
  };
  leaderboards: OfficePerformanceLeaderboard[];
};

export type GetOfficePerformanceWorkspaceInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  period?: string;
  company?: string;
  year?: string;
  month?: string;
  quarter?: string;
  yearStart?: string;
  yearEnd?: string;
};

type PerformanceTransactionRecord = {
  ownerMembershipId: string | null;
  officeId: string | null;
  grossCommission: Prisma.Decimal | null;
  closingDate: Date | null;
  moveInDate: Date | null;
  financeFees: Array<{
    feeType: TransactionFinanceFeeType;
    amount: Prisma.Decimal | null;
  }>;
};

type PerformanceMembershipRecord = {
  id: string;
  role: UserRole;
  title: string | null;
  officeId: string | null;
  status: MembershipStatus;
  user: {
    firstName: string;
    lastName: string;
  };
};

type PerformanceCompanyConfig = {
  id: OfficePerformanceCompany;
  label: string;
  officeNames: string[];
  officeSlugs: string[];
};

type TableAccumulator = Map<string, Map<string, number>>;
type LeaderboardAccumulator = Map<string, number>;

const selectableMembershipStatuses = ["active", "invited"] satisfies MembershipStatus[];
const salesRoles = ["agent", "team_lead"] satisfies UserRole[];
const salesRoleSet = new Set<UserRole>(salesRoles);
const performanceStatuses = ["pending", "closed"] satisfies TransactionStatus[];
const activePerformanceCompanyIds: OfficePerformanceCompany[] = ["ny"];
const performanceCompanyConfigs: Record<OfficePerformanceCompany, PerformanceCompanyConfig> = {
  ny: {
    id: "ny",
    label: "NY",
    officeNames: ["Acre NY Realty Inc", "Acre NY Realty"],
    officeSlugs: ["acre-ny-realty-inc", "acre-ny-realty"]
  },
  rental: {
    id: "rental",
    label: "Rental",
    officeNames: ["Acre NY Rentals LLC", "Acre Rental", "Acre Rentals"],
    officeSlugs: ["acre-ny-rentals-llc", "acre-ny-rentals", "acre-rental"]
  },
  nj: {
    id: "nj",
    label: "NJ",
    officeNames: ["Acre NJ LLC", "Acre NJ Realty", "Acre NJ Realty LLC"],
    officeSlugs: ["acre-nj-llc", "acre-nj-realty", "acre-nj-realty-llc"]
  }
};
const periodOptions: OfficePerformanceOption[] = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" }
];
const monthOptions: OfficePerformanceOption[] = [
  { id: "01", label: "Jan" },
  { id: "02", label: "Feb" },
  { id: "03", label: "Mar" },
  { id: "04", label: "Apr" },
  { id: "05", label: "May" },
  { id: "06", label: "Jun" },
  { id: "07", label: "Jul" },
  { id: "08", label: "Aug" },
  { id: "09", label: "Sep" },
  { id: "10", label: "Oct" },
  { id: "11", label: "Nov" },
  { id: "12", label: "Dec" }
];
const quarterOptions: OfficePerformanceOption[] = [
  { id: "1", label: "Q1" },
  { id: "2", label: "Q2" },
  { id: "3", label: "Q3" },
  { id: "4", label: "Q4" }
];
const roleLabelMap: Record<UserRole, string> = {
  owner: "Owner",
  office_admin: "Office Admin",
  office_manager: "Office Manager",
  office_user: "Office User",
  accountant: "Accountant",
  human_resources: "Human Resources",
  team_lead: "Team Lead",
  agent: "Agent"
};

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function getFeeTotals(financeFees: PerformanceTransactionRecord["financeFees"]) {
  const rebateAmount = financeFees
    .filter((fee) => fee.feeType === "rebate")
    .reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);
  const referralAmount = financeFees
    .filter(
      (fee) =>
        fee.feeType === "client_referral" ||
        fee.feeType === "external_referral" ||
        fee.feeType === "company_referral"
    )
    .reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);
  const reimbursementAmount = financeFees
    .filter((fee) => fee.feeType === "reimbursement")
    .reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);

  return {
    rebateAmount,
    referralAmount,
    reimbursementAmount
  };
}

function calculateTransactionPerformance(transaction: PerformanceTransactionRecord) {
  const { rebateAmount, referralAmount, reimbursementAmount } = getFeeTotals(transaction.financeFees);
  return Number(transaction.grossCommission ?? 0) - rebateAmount - referralAmount - reimbursementAmount;
}

function getPerformanceAttributionDate(transaction: PerformanceTransactionRecord) {
  return transaction.moveInDate ?? transaction.closingDate;
}

function getUtcYear(value: Date) {
  return value.getUTCFullYear();
}

function getUtcMonth(value: Date) {
  return value.getUTCMonth() + 1;
}

function getUtcQuarter(value: Date) {
  return Math.floor(value.getUTCMonth() / 3) + 1;
}

function getMonthKey(value: Date) {
  return `${getUtcYear(value)}-${String(getUtcMonth(value)).padStart(2, "0")}`;
}

function getQuarterKey(value: Date) {
  return `${getUtcYear(value)}-Q${getUtcQuarter(value)}`;
}

function getYearKey(value: Date) {
  return String(getUtcYear(value));
}

function normalizeYearValue(value: string | undefined, fallback: number, minYear: number, maxYear: number) {
  const numeric = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(Math.max(numeric, minYear), maxYear);
}

function normalizeMonthValue(value: string | undefined, fallback: string) {
  return monthOptions.some((option) => option.id === value) ? (value ?? fallback) : fallback;
}

function normalizeQuarterValue(value: string | undefined, fallback: string) {
  return quarterOptions.some((option) => option.id === value) ? (value ?? fallback) : fallback;
}

function normalizePeriodValue(value: string | undefined): OfficePerformancePeriod {
  return value === "quarter" || value === "year" ? value : "month";
}

function normalizeCompanyValue(
  value: string | undefined,
  companyOptions: OfficePerformanceOption[]
): OfficePerformanceCompany {
  const availableIds = new Set(companyOptions.map((option) => option.id));

  if (value === "rental" || value === "nj" || value === "ny") {
    return availableIds.has(value) ? value : "ny";
  }

  return "ny";
}

function buildYearOptions(availableYears: number[], currentYear: number) {
  const minYear = Math.min(currentYear - 2, ...availableYears);
  const maxYear = Math.max(currentYear, ...availableYears);
  const values: OfficePerformanceOption[] = [];

  for (let year = minYear; year <= maxYear; year += 1) {
    values.push({
      id: String(year),
      label: String(year)
    });
  }

  return values;
}

function buildMonthColumns(year: string): OfficePerformanceTableColumn[] {
  return monthOptions.map((option) => ({
    key: `${year}-${option.id}`,
    label: option.label
  }));
}

function buildQuarterColumns(year: string): OfficePerformanceTableColumn[] {
  return quarterOptions.map((option) => ({
    key: `${year}-Q${option.id}`,
    label: option.label
  }));
}

function buildYearColumns(yearStart: string, yearEnd: string): OfficePerformanceTableColumn[] {
  const startYear = Number.parseInt(yearStart, 10);
  const endYear = Number.parseInt(yearEnd, 10);
  const columns: OfficePerformanceTableColumn[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    columns.push({
      key: String(year),
      label: String(year)
    });
  }

  return columns;
}

function getTableColumnKey(period: OfficePerformancePeriod, attributionDate: Date) {
  if (period === "month") {
    return getMonthKey(attributionDate);
  }

  if (period === "quarter") {
    return getQuarterKey(attributionDate);
  }

  return getYearKey(attributionDate);
}

function addTableAmount(accumulator: TableAccumulator, membershipId: string, columnKey: string, amount: number) {
  const membershipTotals = accumulator.get(membershipId) ?? new Map<string, number>();
  membershipTotals.set(columnKey, (membershipTotals.get(columnKey) ?? 0) + amount);
  accumulator.set(membershipId, membershipTotals);
}

function addLeaderboardAmount(accumulator: LeaderboardAccumulator, membershipId: string, amount: number) {
  accumulator.set(membershipId, (accumulator.get(membershipId) ?? 0) + amount);
}

function getMembershipLabel(membership: PerformanceMembershipRecord | null | undefined) {
  if (!membership) {
    return "Unknown member";
  }

  return `${membership.user.firstName} ${membership.user.lastName}`.trim();
}

function getMembershipSecondaryLabel(membership: PerformanceMembershipRecord | null | undefined) {
  if (!membership) {
    return "";
  }

  return membership.title?.trim() || roleLabelMap[membership.role] || "";
}

function isSalesMembership(membership: PerformanceMembershipRecord | null | undefined) {
  return Boolean(membership && salesRoleSet.has(membership.role));
}

function sortMembershipIds(
  membershipIds: string[],
  membershipMap: Map<string, PerformanceMembershipRecord>
) {
  return [...membershipIds].sort((leftId, rightId) => {
    const left = membershipMap.get(leftId);
    const right = membershipMap.get(rightId);
    const leftLabel = getMembershipLabel(left);
    const rightLabel = getMembershipLabel(right);
    const comparison = leftLabel.localeCompare(rightLabel);

    if (comparison !== 0) {
      return comparison;
    }

    return leftId.localeCompare(rightId);
  });
}

function buildRankLabel(entry: OfficePerformanceLeaderboardEntry | null) {
  return entry ? `#${entry.rank}` : "Not ranked";
}

function getScopeLabel(scope: OfficeDataScope) {
  if (scope.kind === "organization") {
    return "Company scope";
  }

  if (scope.kind === "team") {
    return "Team scope";
  }

  return "My performance";
}

function buildSelectedRangeLabel(filters: {
  period: OfficePerformancePeriod;
  year: string;
  month: string;
  quarter: string;
  yearStart: string;
  yearEnd: string;
}) {
  if (filters.period === "month") {
    return `Monthly performance · ${filters.year}`;
  }

  if (filters.period === "quarter") {
    return `Quarterly performance · ${filters.year}`;
  }

  return `Annual performance · ${filters.yearStart}-${filters.yearEnd}`;
}

function buildLeaderboardTitle(period: "month" | "quarter" | "year", filters: {
  year: string;
  month: string;
  quarter: string;
}) {
  if (period === "month") {
    const monthLabel = monthOptions.find((option) => option.id === filters.month)?.label ?? filters.month;
    return `${monthLabel} ${filters.year}`;
  }

  if (period === "quarter") {
    return `Q${filters.quarter} ${filters.year}`;
  }

  return filters.year;
}

function buildLeaderboardSubtitle(scope: OfficeDataScope, companyLabel: string) {
  if (scope.kind === "team") {
    return "Top performers in the visible team scope";
  }

  return `Top performers in ${companyLabel}`;
}

function matchesMonthSelection(date: Date, year: string, month: string) {
  return String(getUtcYear(date)) === year && String(getUtcMonth(date)).padStart(2, "0") === month;
}

function matchesQuarterSelection(date: Date, year: string, quarter: string) {
  return String(getUtcYear(date)) === year && String(getUtcQuarter(date)) === quarter;
}

function matchesYearSelection(date: Date, year: string) {
  return String(getUtcYear(date)) === year;
}

function buildPerformanceCompanyOptions() {
  return activePerformanceCompanyIds.map((id) => ({
    id,
    label: performanceCompanyConfigs[id].label
  }));
}

function resolveCompanyOfficeIds(
  company: OfficePerformanceCompany,
  offices: Array<{ id: string; name: string; slug: string }>,
  fallbackOfficeId: string | null | undefined
) {
  const config = performanceCompanyConfigs[company];
  const matchedOfficeIds = offices
    .filter((office) => config.officeNames.includes(office.name) || config.officeSlugs.includes(office.slug))
    .map((office) => office.id);

  if (matchedOfficeIds.length > 0) {
    return matchedOfficeIds;
  }

  if (fallbackOfficeId) {
    return [fallbackOfficeId];
  }

  return company === "ny" ? offices.map((office) => office.id) : [];
}

async function listCompanySalesMembershipIds(input: {
  organizationId: string;
  companyOfficeIds: string[];
  fallbackMembershipIds: string[];
}) {
  if (input.companyOfficeIds.length === 0 && input.fallbackMembershipIds.length === 0) {
    return [];
  }

  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      role: {
        in: salesRoles
      },
      status: {
        in: selectableMembershipStatuses
      },
      OR: [
        ...(input.companyOfficeIds.length > 0
          ? [
              {
                officeId: {
                  in: input.companyOfficeIds
                }
              }
            ]
          : []),
        ...(input.fallbackMembershipIds.length > 0
          ? [
              {
                id: {
                  in: input.fallbackMembershipIds
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true
    }
  });

  return memberships.map((membership) => membership.id);
}

function buildLeaderboard(
  input: {
    period: "month" | "quarter" | "year";
    title: string;
    subtitle: string;
    baseMembershipIds: string[];
    totals: LeaderboardAccumulator;
    membershipMap: Map<string, PerformanceMembershipRecord>;
    viewerMembershipId: string;
    amountVisibleForPeers: boolean;
  }
): OfficePerformanceLeaderboard {
  const entryIds = Array.from(new Set([...input.baseMembershipIds, ...input.totals.keys()])).filter((membershipId) =>
    input.membershipMap.has(membershipId)
  );
  const sortedEntries = entryIds
    .map((membershipId) => ({
      membershipId,
      name: getMembershipLabel(input.membershipMap.get(membershipId)),
      total: input.totals.get(membershipId) ?? 0
    }))
    .sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total;
      }

      const nameComparison = left.name.localeCompare(right.name);

      if (nameComparison !== 0) {
        return nameComparison;
      }

      return left.membershipId.localeCompare(right.membershipId);
    })
    .map((entry, index) => {
      const isViewer = entry.membershipId === input.viewerMembershipId;
      const amountVisible = isViewer || input.amountVisibleForPeers;

      return {
        membershipId: entry.membershipId,
        rank: index + 1,
        name: entry.name,
        performanceLabel: amountVisible ? formatCurrency(entry.total) : "",
        amountVisible,
        isViewer
      } satisfies OfficePerformanceLeaderboardEntry;
    });

  return {
    period: input.period,
    title: input.title,
    subtitle: input.subtitle,
    entries: sortedEntries.slice(0, 10),
    viewerEntry: sortedEntries.find((entry) => entry.membershipId === input.viewerMembershipId) ?? null,
    emptyMessage: "No ranked performance for this period yet."
  };
}

export async function getOfficePerformanceWorkspace(
  input: GetOfficePerformanceWorkspaceInput
): Promise<OfficePerformanceWorkspace> {
  const [scope, offices] = await Promise.all([
    resolveOfficeDataScope({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      resource: "reports"
    }),
    prisma.office.findMany({
      where: {
        organizationId: input.organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    })
  ]);
  const companyOptions = buildPerformanceCompanyOptions();
  const company = normalizeCompanyValue(input.company, companyOptions);
  const companyOfficeIds = resolveCompanyOfficeIds(company, offices, input.officeId ?? null);
  const companyLabel = companyOptions.find((option) => option.id === company)?.label ?? performanceCompanyConfigs.ny.label;
  const companyTransactions =
    companyOfficeIds.length > 0
      ? await prisma.transaction.findMany({
          where: {
            organizationId: input.organizationId,
            officeId: {
              in: companyOfficeIds
            },
            status: {
              in: performanceStatuses
            },
            ownerMembershipId: {
              not: null
            }
          },
          select: {
            ownerMembershipId: true,
            officeId: true,
            grossCommission: true,
            closingDate: true,
            moveInDate: true,
            financeFees: {
              select: {
                feeType: true,
                amount: true
              }
            }
          }
        })
      : [];
  const attributionYears = companyTransactions
    .map((transaction) => getPerformanceAttributionDate(transaction))
    .filter((value): value is Date => Boolean(value))
    .map((value) => getUtcYear(value));
  const currentDate = new Date();
  const currentYear = getUtcYear(currentDate);
  const currentMonth = String(getUtcMonth(currentDate)).padStart(2, "0");
  const currentQuarter = String(getUtcQuarter(currentDate));
  const yearOptions = buildYearOptions(attributionYears, currentYear);
  const minYear = Number.parseInt(yearOptions[0]?.id ?? String(currentYear - 2), 10);
  const maxYear = Number.parseInt(yearOptions[yearOptions.length - 1]?.id ?? String(currentYear), 10);
  const defaultYearStart = Math.max(minYear, currentYear - 2);
  const defaultYearEnd = currentYear;
  const filters: {
    period: OfficePerformancePeriod;
    company: OfficePerformanceCompany;
    year: string;
    month: string;
    quarter: string;
    yearStart: string;
    yearEnd: string;
  } = {
    period: normalizePeriodValue(input.period),
    company,
    year: String(normalizeYearValue(input.year, currentYear, minYear, maxYear)),
    month: normalizeMonthValue(input.month, currentMonth),
    quarter: normalizeQuarterValue(input.quarter, currentQuarter),
    yearStart: "",
    yearEnd: ""
  };
  const normalizedYearStart = normalizeYearValue(input.yearStart, defaultYearStart, minYear, maxYear);
  const normalizedYearEnd = normalizeYearValue(input.yearEnd, defaultYearEnd, minYear, maxYear);
  filters.yearStart = String(Math.min(normalizedYearStart, normalizedYearEnd));
  filters.yearEnd = String(Math.max(normalizedYearStart, normalizedYearEnd));

  const tableColumns =
    filters.period === "month"
      ? buildMonthColumns(filters.year)
      : filters.period === "quarter"
        ? buildQuarterColumns(filters.year)
        : buildYearColumns(filters.yearStart, filters.yearEnd);
  const tableColumnKeys = new Set(tableColumns.map((column) => column.key));
  const tableVisibleMembershipIds = scope.visibleMembershipIds === null ? null : new Set(scope.visibleMembershipIds);
  const rankingVisibleMembershipIds =
    scope.kind === "team" && scope.visibleMembershipIds !== null ? new Set(scope.visibleMembershipIds) : null;
  const tableAccumulator: TableAccumulator = new Map();
  const monthLeaderboardTotals: LeaderboardAccumulator = new Map();
  const quarterLeaderboardTotals: LeaderboardAccumulator = new Map();
  const yearLeaderboardTotals: LeaderboardAccumulator = new Map();
  const companyOwnerMembershipIds = new Set<string>();

  for (const transaction of companyTransactions) {
    if (!transaction.ownerMembershipId) {
      continue;
    }

    companyOwnerMembershipIds.add(transaction.ownerMembershipId);

    const attributionDate = getPerformanceAttributionDate(transaction);

    if (!attributionDate) {
      continue;
    }

    const performanceAmount = calculateTransactionPerformance(transaction);

    if (tableVisibleMembershipIds === null || tableVisibleMembershipIds.has(transaction.ownerMembershipId)) {
      const tableColumnKey = getTableColumnKey(filters.period, attributionDate);

      if (tableColumnKeys.has(tableColumnKey)) {
        addTableAmount(tableAccumulator, transaction.ownerMembershipId, tableColumnKey, performanceAmount);
      }
    }

    if (rankingVisibleMembershipIds === null || rankingVisibleMembershipIds.has(transaction.ownerMembershipId)) {
      if (matchesMonthSelection(attributionDate, filters.year, filters.month)) {
        addLeaderboardAmount(monthLeaderboardTotals, transaction.ownerMembershipId, performanceAmount);
      }

      if (matchesQuarterSelection(attributionDate, filters.year, filters.quarter)) {
        addLeaderboardAmount(quarterLeaderboardTotals, transaction.ownerMembershipId, performanceAmount);
      }

      if (matchesYearSelection(attributionDate, filters.year)) {
        addLeaderboardAmount(yearLeaderboardTotals, transaction.ownerMembershipId, performanceAmount);
      }
    }
  }

  const companySalesMembershipIds =
    scope.kind === "organization" || scope.kind === "self"
      ? await listCompanySalesMembershipIds({
          organizationId: input.organizationId,
          companyOfficeIds,
          fallbackMembershipIds: [...companyOwnerMembershipIds]
        })
      : [];
  const tableBaseMembershipIds =
    scope.kind === "organization"
      ? companySalesMembershipIds
      : scope.visibleMembershipIds && scope.visibleMembershipIds.length > 0
        ? scope.visibleMembershipIds
        : [scope.viewerMembershipId];
  const rankingBaseMembershipIds =
    scope.kind === "team"
      ? scope.visibleMembershipIds && scope.visibleMembershipIds.length > 0
        ? scope.visibleMembershipIds
        : [scope.viewerMembershipId]
      : Array.from(new Set([...companySalesMembershipIds, scope.viewerMembershipId]));
  const allMembershipIds = Array.from(
    new Set([
      ...tableBaseMembershipIds,
      ...rankingBaseMembershipIds,
      ...companyOwnerMembershipIds,
      scope.viewerMembershipId
    ])
  );
  const memberships = allMembershipIds.length
    ? await prisma.membership.findMany({
        where: {
          organizationId: input.organizationId,
          id: {
            in: allMembershipIds
          },
          status: {
            in: selectableMembershipStatuses
          }
        },
        select: {
          id: true,
          role: true,
          title: true,
          officeId: true,
          status: true,
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      })
    : [];
  const membershipMap = new Map(memberships.map((membership) => [membership.id, membership] as const));
  const tableMembershipIds = sortMembershipIds(
    tableBaseMembershipIds.filter((membershipId) => {
      const membership = membershipMap.get(membershipId);
      return isSalesMembership(membership);
    }),
    membershipMap
  );
  const tableRows = tableMembershipIds.map((membershipId) => {
    const membership = membershipMap.get(membershipId) ?? null;
    const rowTotals = tableAccumulator.get(membershipId) ?? new Map<string, number>();
    const cellLabels = Object.fromEntries(
      tableColumns.map((column) => [column.key, formatCurrency(rowTotals.get(column.key) ?? 0)])
    );
    const rowTotal = tableColumns.reduce((sum, column) => sum + (rowTotals.get(column.key) ?? 0), 0);

    return {
      membershipId,
      name: getMembershipLabel(membership),
      secondaryLabel: getMembershipSecondaryLabel(membership),
      isViewer: membershipId === scope.viewerMembershipId,
      totalLabel: formatCurrency(rowTotal),
      cellLabels
    } satisfies OfficePerformanceTableRow;
  });
  const selectedPerformanceTotal = tableMembershipIds.reduce((sum, membershipId) => {
    const rowTotals = tableAccumulator.get(membershipId) ?? new Map<string, number>();

    return sum + tableColumns.reduce((rowSum, column) => rowSum + (rowTotals.get(column.key) ?? 0), 0);
  }, 0);
  const amountVisibleForPeers = scope.kind !== "self";
  const leaderboardSubtitle = buildLeaderboardSubtitle(scope, companyLabel);
  const leaderboards = [
    buildLeaderboard({
      period: "month",
      title: buildLeaderboardTitle("month", filters),
      subtitle: leaderboardSubtitle,
      baseMembershipIds: rankingBaseMembershipIds.filter((membershipId) => isSalesMembership(membershipMap.get(membershipId))),
      totals: monthLeaderboardTotals,
      membershipMap,
      viewerMembershipId: scope.viewerMembershipId,
      amountVisibleForPeers
    }),
    buildLeaderboard({
      period: "quarter",
      title: buildLeaderboardTitle("quarter", filters),
      subtitle: leaderboardSubtitle,
      baseMembershipIds: rankingBaseMembershipIds.filter((membershipId) => isSalesMembership(membershipMap.get(membershipId))),
      totals: quarterLeaderboardTotals,
      membershipMap,
      viewerMembershipId: scope.viewerMembershipId,
      amountVisibleForPeers
    }),
    buildLeaderboard({
      period: "year",
      title: buildLeaderboardTitle("year", filters),
      subtitle: leaderboardSubtitle,
      baseMembershipIds: rankingBaseMembershipIds.filter((membershipId) => isSalesMembership(membershipMap.get(membershipId))),
      totals: yearLeaderboardTotals,
      membershipMap,
      viewerMembershipId: scope.viewerMembershipId,
      amountVisibleForPeers
    })
  ] satisfies OfficePerformanceLeaderboard[];
  const monthRankEntry = leaderboards[0]?.viewerEntry ?? null;
  const quarterRankEntry = leaderboards[1]?.viewerEntry ?? null;
  const yearRankEntry = leaderboards[2]?.viewerEntry ?? null;
  const summaryCards: OfficePerformanceSummaryCard[] =
    scope.kind === "self"
      ? [
          {
            id: "selected-performance",
            label: "My performance",
            value: tableRows[0]?.totalLabel ?? formatCurrency(0),
            hint: buildSelectedRangeLabel(filters),
            tone: "accent"
          },
          {
            id: "month-rank",
            label: "Month rank",
            value: buildRankLabel(monthRankEntry),
            hint: leaderboards[0].title,
            tone: "default"
          },
          {
            id: "quarter-rank",
            label: "Quarter rank",
            value: buildRankLabel(quarterRankEntry),
            hint: leaderboards[1].title,
            tone: "default"
          },
          {
            id: "year-rank",
            label: "Year rank",
            value: buildRankLabel(yearRankEntry),
            hint: leaderboards[2].title,
            tone: "default"
          }
        ]
      : [
          {
            id: "visible-performance",
            label: "Visible performance",
            value: formatCurrency(selectedPerformanceTotal),
            hint: buildSelectedRangeLabel(filters),
            tone: "accent"
          },
          {
            id: "visible-people",
            label: "Active Users",
            value: String(tableRows.length),
            hint: getScopeLabel(scope),
            tone: "default"
          },
          {
            id: "month-rank",
            label: "My month rank",
            value: buildRankLabel(monthRankEntry),
            hint: leaderboards[0].title,
            tone: "default"
          },
          {
            id: "quarter-rank",
            label: "My quarter rank",
            value: buildRankLabel(quarterRankEntry),
            hint: leaderboards[1].title,
            tone: "default"
          },
          {
            id: "year-rank",
            label: "My year rank",
            value: buildRankLabel(yearRankEntry),
            hint: leaderboards[2].title,
            tone: "default"
          }
        ];

  return {
    filters: {
      period: filters.period,
      periodOptions,
      company,
      companyOptions,
      year: filters.year,
      month: filters.month,
      quarter: filters.quarter,
      yearStart: filters.yearStart,
      yearEnd: filters.yearEnd,
      yearOptions,
      monthOptions,
      quarterOptions,
      canExport: scope.kind !== "self",
      scopeLabel: getScopeLabel(scope),
      companyLabel,
      defaults: {
        period: "month",
        company: "ny",
        year: String(currentYear),
        month: currentMonth,
        quarter: currentQuarter,
        yearStart: String(defaultYearStart),
        yearEnd: String(defaultYearEnd)
      }
    },
    selectedRangeLabel: buildSelectedRangeLabel(filters),
    summary: {
      cards: summaryCards
    },
    table: {
      columns: tableColumns,
      rows: tableRows,
      rowCount: tableRows.length,
      emptyMessage: "No visible performance rows matched the current scope and period."
    },
    leaderboards
  };
}

export async function listOfficePerformanceExportRows(input: GetOfficePerformanceWorkspaceInput) {
  const workspace = await getOfficePerformanceWorkspace(input);

  return {
    columns: ["Name", "Role", ...workspace.table.columns.map((column) => column.label)],
    rows: workspace.table.rows.map((row) => [
      row.name,
      row.secondaryLabel,
      ...workspace.table.columns.map((column) => row.cellLabels[column.key] ?? formatCurrency(0))
    ])
  };
}
