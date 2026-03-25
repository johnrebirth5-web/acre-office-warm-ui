import { Prisma, TransactionStatus } from "@prisma/client";
import { buildMembershipVisibilityWhere, buildTransactionVisibilityWhere, resolveOfficeDataScope } from "./access";
import { prisma } from "./client";

export type OfficeDashboardStatusMetric = {
  status: "Opportunity" | "Active" | "Pending" | "Closed" | "Cancelled";
  count: number;
};

export type OfficeDashboardRecentTransaction = {
  id: string;
  label: string;
  amount: string;
  stage: string;
  owner: string;
};

export type OfficeDashboardChartPoint = {
  label: string;
  value: number;
};

export type OfficeDashboardCommissionMonth = {
  monthKey: string;
  label: string;
  totalLabel: string;
  calculationCount: number;
  isCurrent: boolean;
};

export type OfficeDashboardCommissionStatement = {
  id: string;
  periodLabel: string;
  generatedAtLabel: string;
  totalStatementAmountLabel: string;
  pdfHref: string;
};

export type OfficeDashboardCommissionSnapshot = {
  totalCommissionLabel: string;
  currentMonthCommissionLabel: string;
  payableLabel: string;
  paidLabel: string;
  calculationCount: number;
  hasSelfServiceData: boolean;
  monthlyTotals: OfficeDashboardCommissionMonth[];
  statements: OfficeDashboardCommissionStatement[];
};

export type OfficeDashboardBusinessSnapshot = {
  goal: {
    progressPercent: number;
    currentValue: string;
    currentValueLabel: string;
    target: string;
    targetLabel: string;
    secondaryValue: string;
    secondaryLabel: string;
  };
  chart: {
    axisLabels: string[];
    points: OfficeDashboardChartPoint[];
    maxValue: number;
  };
  transactionCountsByStatus: OfficeDashboardStatusMetric[];
  contactsNeedingFollowUp: number;
  recentTransactions: OfficeDashboardRecentTransaction[];
  commission: OfficeDashboardCommissionSnapshot;
};

type GetOfficeDashboardBusinessSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
};

const statusOrder: Array<OfficeDashboardStatusMetric["status"]> = ["Opportunity", "Active", "Pending", "Closed", "Cancelled"];

const statusFromDb: Record<TransactionStatus, OfficeDashboardStatusMetric["status"]> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function formatCompactCount(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getNiceAxisMax(value: number) {
  if (value <= 10) {
    return 10;
  }

  const targetStep = value / 10;
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const normalized = targetStep / magnitude;
  const stepBase = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = stepBase * magnitude;

  return step * 10;
}

function buildAxisLabels(maxValue: number) {
  const axisMax = getNiceAxisMax(maxValue);
  const step = axisMax / 10;

  return Array.from({ length: 11 }, (_, index) => String(axisMax - index * step));
}

function buildMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function getPurchasedPriceValue(transaction: { purchasedPrice: Prisma.Decimal | null; price: Prisma.Decimal | null }) {
  return Number(transaction.purchasedPrice ?? transaction.price ?? 0);
}

export async function getOfficeDashboardBusinessSnapshot(
  input: GetOfficeDashboardBusinessSnapshotInput
): Promise<OfficeDashboardBusinessSnapshot> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null
  });
  const transactionWhere: Prisma.TransactionWhereInput = {
    AND: [
      {
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {})
      },
      buildTransactionVisibilityWhere(scope)
    ]
  };

  const contactWhere: Prisma.ClientWhereInput = {
    AND: [
      {
        organizationId: input.organizationId,
        ...(input.officeId
          ? {
              ownerMembership: {
                is: {
                  officeId: input.officeId
                }
              }
            }
          : {})
      },
      ...(scope.visibleMembershipIds === null
        ? []
        : [
            {
              ownerMembership: {
                is: buildMembershipVisibilityWhere(scope)
              }
            }
          ])
    ]
  };

  const now = new Date();
  const chartWindowStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const commissionWindowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    recentTransactions,
    groupedStatuses,
    totalTransactions,
    closedTransactions,
    contactsNeedingFollowUp,
    monthlyTransactions,
    commissionTotalsByStatus,
    recentCommissionRows,
    recentStatements
  ] =
    await Promise.all([
      prisma.transaction.findMany({
        where: transactionWhere,
        include: {
          ownerMembership: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        take: 3
      }),
      prisma.transaction.groupBy({
        by: ["status"],
        where: transactionWhere,
        _count: {
          _all: true
        }
      }),
      prisma.transaction.count({
        where: transactionWhere
      }),
      prisma.transaction.count({
        where: {
          ...transactionWhere,
          status: "closed"
        }
      }),
      prisma.client.count({
        where: {
          ...contactWhere,
          nextFollowUpAt: {
            lte: now
          }
        }
      }),
      prisma.transaction.findMany({
        where: {
          ...transactionWhere,
          createdAt: {
            gte: chartWindowStart
          }
        },
        select: {
          createdAt: true
        },
        orderBy: [{ createdAt: "asc" }]
      }),
      prisma.commissionCalculation.groupBy({
        by: ["status"],
        where: {
          organizationId: input.organizationId,
          membershipId: scope.viewerMembershipId
        },
        _sum: {
          statementAmount: true
        },
        _count: {
          _all: true
        }
      }),
      prisma.commissionCalculation.findMany({
        where: {
          organizationId: input.organizationId,
          membershipId: scope.viewerMembershipId,
          calculatedAt: {
            gte: commissionWindowStart
          }
        },
        select: {
          calculatedAt: true,
          statementAmount: true
        },
        orderBy: [{ calculatedAt: "asc" }]
      }),
      prisma.agentPayoutStatement.findMany({
        where: {
          organizationId: input.organizationId,
          membershipId: scope.viewerMembershipId
        },
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          generatedAt: true,
          totalStatementAmount: true
        },
        orderBy: [{ generatedAt: "desc" }],
        take: 5
      })
    ]);

  const transactionCountsByStatus = statusOrder.map((status) => ({
    status,
    count: groupedStatuses.find((entry) => statusFromDb[entry.status] === status)?._count._all ?? 0
  }));

  const points = Array.from({ length: 13 }, (_, index) => {
    const monthDate = new Date(chartWindowStart.getFullYear(), chartWindowStart.getMonth() + index, 1);
    const label = monthDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric"
    });
    const count = monthlyTransactions.filter(
      (transaction) =>
        transaction.createdAt.getFullYear() === monthDate.getFullYear() && transaction.createdAt.getMonth() === monthDate.getMonth()
    ).length;

    return {
      label,
      value: count
    };
  });

  const maxPointValue = Math.max(...points.map((point) => point.value), 0);
  const progressPercent = totalTransactions > 0 ? Math.round((closedTransactions / totalTransactions) * 100) : 0;
  const currentMonthKey = buildMonthKey(now);
  const commissionTotalsByMonth = new Map<
    string,
    {
      total: number;
      calculationCount: number;
    }
  >();

  for (const row of recentCommissionRows) {
    const monthKey = buildMonthKey(row.calculatedAt);
    const current =
      commissionTotalsByMonth.get(monthKey) ??
      {
        total: 0,
        calculationCount: 0
      };

    current.total += Number(row.statementAmount ?? 0);
    current.calculationCount += 1;
    commissionTotalsByMonth.set(monthKey, current);
  }

  const monthlyCommissionTotals = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(commissionWindowStart.getFullYear(), commissionWindowStart.getMonth() + index, 1);
    const monthKey = buildMonthKey(monthDate);
    const totals =
      commissionTotalsByMonth.get(monthKey) ??
      {
        total: 0,
        calculationCount: 0
      };

    return {
      monthKey,
      label: monthDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric"
      }),
      totalLabel: formatCurrency(totals.total),
      calculationCount: totals.calculationCount,
      isCurrent: monthKey === currentMonthKey
    };
  });
  const totalCommissionAmount = commissionTotalsByStatus.reduce(
    (sum, entry) => sum + Number(entry._sum.statementAmount ?? 0),
    0
  );
  const currentMonthCommissionAmount = commissionTotalsByMonth.get(currentMonthKey)?.total ?? 0;
  const payableCommissionAmount =
    commissionTotalsByStatus.find((entry) => entry.status === "payable")?._sum.statementAmount ?? new Prisma.Decimal(0);
  const paidCommissionAmount =
    commissionTotalsByStatus.find((entry) => entry.status === "paid")?._sum.statementAmount ?? new Prisma.Decimal(0);
  const commissionCalculationCount = commissionTotalsByStatus.reduce((sum, entry) => sum + entry._count._all, 0);
  const hasSelfServiceData = commissionCalculationCount > 0 || recentStatements.length > 0;

  return {
    goal: {
      progressPercent,
      currentValue: formatCompactCount(closedTransactions, "closed transaction"),
      currentValueLabel: "Closed rate",
      target: formatCompactCount(totalTransactions, "total transaction"),
      targetLabel: "Transactions",
      secondaryValue: formatCompactCount(contactsNeedingFollowUp, "contact"),
      secondaryLabel: "Follow-ups due"
    },
    chart: {
      axisLabels: buildAxisLabels(maxPointValue),
      points,
      maxValue: Math.max(getNiceAxisMax(maxPointValue), 10)
    },
    transactionCountsByStatus,
    contactsNeedingFollowUp,
    commission: {
      totalCommissionLabel: formatCurrency(totalCommissionAmount),
      currentMonthCommissionLabel: formatCurrency(currentMonthCommissionAmount),
      payableLabel: formatCurrency(Number(payableCommissionAmount ?? 0)),
      paidLabel: formatCurrency(Number(paidCommissionAmount ?? 0)),
      calculationCount: commissionCalculationCount,
      hasSelfServiceData,
      monthlyTotals: monthlyCommissionTotals,
      statements: recentStatements.map((statement) => ({
        id: statement.id,
        periodLabel: `${formatDateValue(statement.periodStart)} to ${formatDateValue(statement.periodEnd)}`,
        generatedAtLabel: formatDateTime(statement.generatedAt),
        totalStatementAmountLabel: formatCurrency(Number(statement.totalStatementAmount ?? 0)),
        pdfHref: `/api/office/accounting/self-service/statements/${statement.id}/pdf`
      }))
    },
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction.id,
      label: `${transaction.address}, ${transaction.city}, ${transaction.state} ${transaction.zipCode}`.replace(/,\s+,/g, ", "),
      amount: formatCurrency(getPurchasedPriceValue(transaction)),
      stage: statusFromDb[transaction.status].toLowerCase(),
      owner: transaction.ownerMembership
        ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
        : "Unassigned"
    }))
  };
}
