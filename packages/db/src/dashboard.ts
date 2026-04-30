import { AgentPayoutStatementReviewStatus, Prisma, TransactionStatus } from "@prisma/client";
import { buildMembershipVisibilityWhere, buildTransactionPortfolioVisibilityWhere, resolveOfficeDataScope } from "./access";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import {
  buildTransactionOverdueWhere,
  getTransactionOverdueReferenceDate,
  getTransactionOverdueSinceDate,
  isTransactionOverdue,
  reconcileOfficeNotificationReminders,
} from "./notifications";

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
  generatedAt: string;
  generatedAtLabel: string;
  reviewStatus: AgentPayoutStatementReviewStatus;
  reviewStatusLabel: string;
  totalStatementAmountLabel: string;
  openHref: string;
  pdfHref: string;
};

export type OfficeDashboardPayoutReviewQueue = {
  count: number;
  statements: OfficeDashboardCommissionStatement[];
};

export type OfficeDashboardOverdueTransaction = {
  id: string;
  label: string;
  owner: string;
  status: OfficeDashboardStatusMetric["status"];
  referenceDate: string;
  referenceDateLabel: string;
  overdueSince: string;
  overdueSinceLabel: string;
  openHref: string;
};

export type OfficeDashboardTransactionOverdueQueue = {
  count: number;
  transactions: OfficeDashboardOverdueTransaction[];
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
  payoutReviewQueue: OfficeDashboardPayoutReviewQueue;
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
  transactionOverdueQueue: OfficeDashboardTransactionOverdueQueue;
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
  cancelled: "Cancelled",
  system_anchor: "Cancelled"
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

function formatDateTime(value: Date, timeZone?: string | null) {
  return formatDateTimeLabel(value, {
    timeZone
  });
}

function formatDateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatStatementReviewStatusLabel(value: AgentPayoutStatementReviewStatus) {
  if (value === "awaiting_agent") {
    return "Awaiting agent";
  }

  if (value === "revision_requested") {
    return "Revision requested";
  }

  if (value === "confirmed") {
    return "Confirmed";
  }

  if (value === "paid") {
    return "Paid";
  }

  return "Draft";
}

function formatStatementPeriodLabel(periodStart: Date, periodEnd: Date) {
  return `${formatDateValue(periodStart)} to ${formatDateValue(periodEnd)}`;
}

function mapDashboardCommissionStatement(
  statement: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    generatedAt: Date;
    reviewStatus: AgentPayoutStatementReviewStatus;
    totalStatementAmount: Prisma.Decimal;
  },
  timeZone?: string | null
): OfficeDashboardCommissionStatement {
  return {
    id: statement.id,
    periodLabel: formatStatementPeriodLabel(statement.periodStart, statement.periodEnd),
    generatedAt: statement.generatedAt.toISOString(),
    generatedAtLabel: formatDateTime(statement.generatedAt, timeZone),
    reviewStatus: statement.reviewStatus,
    reviewStatusLabel: formatStatementReviewStatusLabel(statement.reviewStatus),
    totalStatementAmountLabel: formatCurrency(Number(statement.totalStatementAmount ?? 0)),
    openHref: `/office/payout-statements/${statement.id}`,
    pdfHref: `/api/office/accounting/self-service/statements/${statement.id}/pdf`
  };
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

function mapDashboardOverdueTransaction(transaction: {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  status: TransactionStatus;
  moveInDate: Date | null;
  closingDate: Date | null;
  ownerMembership: {
    user: {
      firstName: string;
      lastName: string;
    };
  } | null;
}): OfficeDashboardOverdueTransaction | null {
  const referenceDate = getTransactionOverdueReferenceDate(transaction);

  if (!referenceDate) {
    return null;
  }

  const overdueSince = getTransactionOverdueSinceDate(referenceDate);

  return {
    id: transaction.id,
    label: `${transaction.address}, ${transaction.city}, ${transaction.state} ${transaction.zipCode}`.replace(/,\s+,/g, ", "),
    owner: transaction.ownerMembership
      ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
      : "Unassigned",
    status: statusFromDb[transaction.status],
    referenceDate: referenceDate.toISOString(),
    referenceDateLabel: formatDateValue(referenceDate),
    overdueSince: overdueSince.toISOString(),
    overdueSinceLabel: formatDateValue(overdueSince),
    openHref: `/office/transactions/${transaction.id}`,
  };
}

export async function getOfficeDashboardBusinessSnapshot(
  input: GetOfficeDashboardBusinessSnapshotInput
): Promise<OfficeDashboardBusinessSnapshot> {
  await reconcileOfficeNotificationReminders({
    organizationId: input.organizationId,
    officeId: input.officeId ?? null,
    membershipId: input.viewerMembershipId,
  });

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
      buildTransactionPortfolioVisibilityWhere(scope)
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
  const transactionOverdueWhere: Prisma.TransactionWhereInput = {
    AND: [transactionWhere, buildTransactionOverdueWhere(now)],
  };

  const [
    organization,
    recentTransactions,
    groupedStatuses,
    totalTransactions,
    closedTransactions,
    contactsNeedingFollowUp,
    monthlyTransactions,
    commissionTotalsByStatus,
    recentCommissionRows,
    recentStatements,
    payoutReviewCount,
    payoutReviewStatements,
    overdueTransactionCandidates
  ] =
    await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: {
          id: input.organizationId
        },
        select: {
          timezone: true
        }
      }),
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
          membershipId: scope.viewerMembershipId,
          reviewStatus: {
            in: ["awaiting_agent", "revision_requested", "confirmed", "paid"]
          }
        },
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          generatedAt: true,
          reviewStatus: true,
          totalStatementAmount: true
        },
        orderBy: [{ generatedAt: "desc" }],
        take: 5
      }),
      prisma.agentPayoutStatement.count({
        where: {
          organizationId: input.organizationId,
          membershipId: scope.viewerMembershipId,
          reviewStatus: "awaiting_agent"
        }
      }),
      prisma.agentPayoutStatement.findMany({
        where: {
          organizationId: input.organizationId,
          membershipId: scope.viewerMembershipId,
          reviewStatus: "awaiting_agent"
        },
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          generatedAt: true,
          reviewStatus: true,
          totalStatementAmount: true
        },
        orderBy: [{ generatedAt: "desc" }],
        take: 3
      }),
      prisma.transaction.findMany({
        where: transactionOverdueWhere,
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          status: true,
          moveInDate: true,
          closingDate: true,
          ownerMembership: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
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
  const overdueTransactions = overdueTransactionCandidates.filter((transaction) =>
    isTransactionOverdue(transaction, now),
  );
  const overdueQueueTransactions = overdueTransactions
    .map(mapDashboardOverdueTransaction)
    .filter((transaction): transaction is OfficeDashboardOverdueTransaction => Boolean(transaction))
    .sort((left, right) => left.overdueSince.localeCompare(right.overdueSince))
    .slice(0, 5);

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
    transactionOverdueQueue: {
      count: overdueTransactions.length,
      transactions: overdueQueueTransactions,
    },
    commission: {
      totalCommissionLabel: formatCurrency(totalCommissionAmount),
      currentMonthCommissionLabel: formatCurrency(currentMonthCommissionAmount),
      payableLabel: formatCurrency(Number(payableCommissionAmount ?? 0)),
      paidLabel: formatCurrency(Number(paidCommissionAmount ?? 0)),
      calculationCount: commissionCalculationCount,
      hasSelfServiceData,
      monthlyTotals: monthlyCommissionTotals,
      statements: recentStatements.map((statement) => mapDashboardCommissionStatement(statement, organization.timezone)),
      payoutReviewQueue: {
        count: payoutReviewCount,
        statements: payoutReviewStatements.map((statement) =>
          mapDashboardCommissionStatement(statement, organization.timezone)
        )
      }
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
