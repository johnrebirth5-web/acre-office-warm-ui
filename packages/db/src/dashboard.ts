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

  const [recentTransactions, groupedStatuses, totalTransactions, closedTransactions, contactsNeedingFollowUp, monthlyTransactions] =
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
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction.id,
      label: `${transaction.address}, ${transaction.city}, ${transaction.state} ${transaction.zipCode}`.replace(/,\s+,/g, ", "),
      amount: formatCurrency(Number(transaction.price ?? 0)),
      stage: statusFromDb[transaction.status].toLowerCase(),
      owner: transaction.ownerMembership
        ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
        : "Unassigned"
    }))
  };
}
