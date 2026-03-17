import {
  AccountingTransactionStatus,
  AccountingTransactionType,
  CommissionCalculationStatus,
  EarnestMoneyStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  UserRole
} from "@prisma/client";
import {
  buildMembershipVisibilityWhere,
  buildTransactionVisibilityWhere,
  canViewCrossMemberFinancials,
  redactCurrency,
  resolveOfficeDataScope,
  type OfficeDataScope
} from "./access";
import { prisma } from "./client";
import { buildTeamPathLabel, createTeamHierarchyIndex, expandSelectedTeamIds } from "./team-hierarchy";

export type OfficeReportStatus = "Opportunity" | "Active" | "Pending" | "Closed" | "Cancelled";

export type OfficeReportOwnerMetric = {
  ownerMembershipId: string | null;
  ownerName: string;
  transactionCount: number;
  totalVolumeLabel: string;
};

export type OfficeReportTimePoint = {
  label: string;
  transactionCount: number;
  closedTransactionCount?: number;
  totalVolumeLabel?: string;
};

export type OfficeReportOwnerOption = {
  id: string;
  label: string;
};

export type OfficeReportSelectOption = {
  id: string;
  label: string;
};

export type OfficeReportsFilters = {
  startDate: string;
  endDate: string;
  officeId: string;
  ownerMembershipId: string;
  teamId: string;
  transactionStatus: string;
  transactionType: string;
  commissionPlanId: string;
  officeOptions: OfficeReportSelectOption[];
  ownerOptions: OfficeReportOwnerOption[];
  teamOptions: OfficeReportSelectOption[];
  commissionPlanOptions: OfficeReportSelectOption[];
};

export type OfficeReportTransactionTypeMetric = {
  type: string;
  count: number;
  totalVolumeLabel: string;
  officeNetLabel: string;
};

export type OfficeReportRecentTransaction = {
  id: string;
  title: string;
  addressLine: string;
  status: OfficeReportStatus;
  type: string;
  ownerName: string;
  priceLabel: string;
  grossCommissionLabel: string;
  officeNetLabel: string;
  createdAtLabel: string;
  closingDateLabel: string;
  href: string;
};

export type OfficeReportAgentPerformanceRow = {
  ownerMembershipId: string | null;
  ownerName: string;
  teamLabel: string;
  transactionCount: number;
  closedTransactionCount: number;
  pendingTransactionCount: number;
  totalVolumeLabel: string;
  averageVolumeLabel: string;
  grossCommissionLabel: string;
  officeNetLabel: string;
  agentNetLabel: string;
  profileHref: string | null;
};

export type OfficeReportTeamPerformanceRow = {
  teamId: string;
  teamName: string;
  agentCount: number;
  transactionCount: number;
  closedTransactionCount: number;
  totalVolumeLabel: string;
  officeNetLabel: string;
};

export type OfficeReportCommissionStatusMetric = {
  status: string;
  count: number;
  statementAmountLabel: string;
};

export type OfficeReportCommissionPlanMetric = {
  commissionPlanId: string | null;
  planName: string;
  calculationCount: number;
  statementAmountLabel: string;
};

export type OfficeReportRecentCommission = {
  id: string;
  transactionId: string;
  transactionLabel: string;
  transactionHref: string;
  ownerName: string;
  status: string;
  statementAmountLabel: string;
  grossCommissionLabel: string;
  calculatedAtLabel: string;
  accountingHref: string | null;
};

export type OfficeReportAccountingTypeMetric = {
  type: string;
  count: number;
  totalAmountLabel: string;
};

export type OfficeReportRecentAccounting = {
  id: string;
  accountingDateLabel: string;
  type: string;
  status: string;
  counterparty: string;
  amountLabel: string;
  ownerName: string;
  linkedTransactionLabel: string;
  linkedTransactionHref: string | null;
  href: string;
};

export type OfficeReportEmdStatusMetric = {
  status: string;
  count: number;
  expectedAmountLabel: string;
  receivedAmountLabel: string;
};

export type OfficeReportRecentEmd = {
  id: string;
  transactionId: string;
  transactionLabel: string;
  transactionHref: string;
  expectedAmount: string;
  receivedAmount: string;
  dueAtLabel: string;
  status: string;
  holdingLabel: string;
};

export type OfficeReportsSnapshot = {
  filters: OfficeReportsFilters;
  totals: {
    totalTransactions: number;
    contactsNeedingFollowUp: number;
    totalVolumeLabel: string;
    activeOwnerCount: number;
    closedTransactionCount: number;
    pendingTransactionCount: number;
    totalGrossCommissionLabel: string;
    totalOfficeNetLabel: string;
    totalAgentNetLabel: string;
    statementReadyCommissionLabel: string;
    payableCommissionLabel: string;
    receivedPaymentsLabel: string;
    overdueEmdCount: number;
  };
  transactionsByStatus: Array<{
    status: OfficeReportStatus;
    count: number;
    totalVolumeLabel: string;
    officeNetLabel: string;
  }>;
  transactionsByOwner: OfficeReportOwnerMetric[];
  transactionsOverTime: OfficeReportTimePoint[];
  transactionTypes: OfficeReportTransactionTypeMetric[];
  recentTransactions: OfficeReportRecentTransaction[];
  agentPerformance: OfficeReportAgentPerformanceRow[];
  teamPerformance: {
    hasTeams: boolean;
    limitation: string | null;
    rows: OfficeReportTeamPerformanceRow[];
  };
  commissionSummary: {
    calculationCount: number;
    statementReadyLabel: string;
    payableLabel: string;
    paidLabel: string;
    byStatus: OfficeReportCommissionStatusMetric[];
    byPlan: OfficeReportCommissionPlanMetric[];
    recentCalculations: OfficeReportRecentCommission[];
  };
  accountingSummary: {
    transactionCount: number;
    totalInvoices: number;
    openBills: number;
    receivedPaymentsLabel: string;
    madePaymentsLabel: string;
    byType: OfficeReportAccountingTypeMetric[];
    recentTransactions: OfficeReportRecentAccounting[];
  };
  emdSummary: {
    recordCount: number;
    outstandingCount: number;
    overdueCount: number;
    expectedAmountLabel: string;
    receivedAmountLabel: string;
    byStatus: OfficeReportEmdStatusMetric[];
    recentRecords: OfficeReportRecentEmd[];
  };
  limitations: string[];
};

export type OfficeReportTransactionExportRow = {
  transactionId: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  type: string;
  status: OfficeReportStatus;
  representing: string;
  owner: string;
  primaryContact: string;
  price: string;
  grossCommission: string;
  referralFee: string;
  officeNet: string;
  agentNet: string;
  importantDate: string;
  closingDate: string;
  createdAt: string;
  updatedAt: string;
};

export type GetOfficeReportsSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  officeFilterId?: string;
  startDate?: string;
  endDate?: string;
  ownerMembershipId?: string;
  teamId?: string;
  transactionStatus?: string;
  transactionType?: string;
  commissionPlanId?: string;
};

const reportStatusOrder: OfficeReportStatus[] = ["Opportunity", "Active", "Pending", "Closed", "Cancelled"];
const reportTypeOrder = [
  "Sales",
  "Sales (listing)",
  "Rental/Leasing",
  "Rental (listing)",
  "Commercial Sales",
  "Commercial Lease",
  "Other"
] as const;
const accountingTypeOrder: AccountingTransactionType[] = [
  "invoice",
  "bill",
  "credit_memo",
  "deposit",
  "received_payment",
  "made_payment",
  "journal_entry",
  "transfer",
  "refund"
];
const commissionStatusOrder: CommissionCalculationStatus[] = [
  "draft",
  "calculated",
  "reviewed",
  "statement_ready",
  "payable",
  "paid"
];
const earnestMoneyStatusOrder: EarnestMoneyStatus[] = [
  "not_received",
  "overdue",
  "pending_bank_deposit",
  "fully_deposited",
  "distribute_balance",
  "complete"
];

const statusFromDb: Record<TransactionStatus, OfficeReportStatus> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

const typeFromDb: Record<TransactionType, (typeof reportTypeOrder)[number]> = {
  sales: "Sales",
  sales_listing: "Sales (listing)",
  rental_leasing: "Rental/Leasing",
  rental_listing: "Rental (listing)",
  commercial_sales: "Commercial Sales",
  commercial_lease: "Commercial Lease",
  other: "Other"
};

const representingFromDb = {
  buyer: "buyer",
  seller: "seller",
  both: "both",
  tenant: "tenant",
  landlord: "landlord"
} as const;

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

const accountingStatusLabelMap: Record<AccountingTransactionStatus, string> = {
  draft: "Draft",
  open: "Open",
  posted: "Posted",
  completed: "Completed",
  void: "Void"
};

const commissionStatusLabelMap: Record<CommissionCalculationStatus, string> = {
  draft: "Draft",
  calculated: "Calculated",
  reviewed: "Reviewed",
  statement_ready: "Statement ready",
  payable: "Payable",
  paid: "Paid"
};

const earnestMoneyStatusLabelMap: Record<EarnestMoneyStatus, string> = {
  not_received: "Not received",
  overdue: "Overdue",
  pending_bank_deposit: "Pending bank deposit",
  fully_deposited: "Fully deposited",
  distribute_balance: "Distribute balance",
  complete: "Complete"
};

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function formatCurrencyFromDb(value: Prisma.Decimal | null) {
  return value ? formatCurrency(Number(value)) : "";
}

function formatDateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function formatDateLabel(value: Date | null | undefined) {
  return value
    ? value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : "—";
}

function startOfDay(input: string | undefined | null) {
  if (!input?.trim()) {
    return null;
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(input: string | undefined | null) {
  if (!input?.trim()) {
    return null;
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(23, 59, 59, 999);
  return date;
}

function getScopedOfficeId(input: GetOfficeReportsSnapshotInput) {
  return input.officeId?.trim() || input.officeFilterId?.trim() || null;
}

function buildScopedOfficeCondition(officeId: string | null): Prisma.AccountingTransactionWhereInput {
  return officeId
    ? {
        OR: [{ officeId }, { officeId: null }]
      }
    : {};
}

function buildScopedOfficeFilterLabel(input: GetOfficeReportsSnapshotInput, scopedOfficeId: string | null) {
  if (input.officeId?.trim()) {
    return input.officeId.trim();
  }

  return scopedOfficeId ?? "";
}

function parseTransactionStatus(value: string | undefined | null): TransactionStatus | null {
  if (value === "opportunity" || value === "active" || value === "pending" || value === "closed" || value === "cancelled") {
    return value;
  }

  return null;
}

function parseTransactionType(value: string | undefined | null): TransactionType | null {
  if (
    value === "sales" ||
    value === "sales_listing" ||
    value === "rental_leasing" ||
    value === "rental_listing" ||
    value === "commercial_sales" ||
    value === "commercial_lease" ||
    value === "other"
  ) {
    return value;
  }

  return null;
}

function getOwnerName(membership: { user: { firstName: string; lastName: string } } | null | undefined) {
  return membership ? `${membership.user.firstName} ${membership.user.lastName}` : "Unassigned";
}

function getTransactionLabel(transaction: { title: string; address: string; city: string; state: string }) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}

function dedupeTeamMemberships(
  teamMemberships: Array<{
    teamId: string;
    team: {
      id: string;
      name: string;
      isActive: boolean;
    };
  }>
) {
  const seen = new Set<string>();

  return teamMemberships.filter((teamMembership) => {
    if (!teamMembership.team.isActive || seen.has(teamMembership.teamId)) {
      return false;
    }

    seen.add(teamMembership.teamId);
    return true;
  });
}

function buildTimeSeries(
  transactions: Array<{ createdAt: Date; status: TransactionStatus; price: Prisma.Decimal | null }>,
  startDate: Date | null,
  endDate: Date | null
): OfficeReportTimePoint[] {
  const rangeStart = startDate ?? new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
  const rangeEnd = endDate ?? new Date();
  const bucketStart = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const bucketEnd = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  const points: OfficeReportTimePoint[] = [];
  const cursor = new Date(bucketStart);

  while (cursor <= bucketEnd) {
    const matchingTransactions = transactions.filter(
      (transaction) =>
        transaction.createdAt.getFullYear() === cursor.getFullYear() && transaction.createdAt.getMonth() === cursor.getMonth()
    );

    points.push({
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric"
      }),
      transactionCount: matchingTransactions.length,
      closedTransactionCount: matchingTransactions.filter((transaction) => transaction.status === "closed").length,
      totalVolumeLabel: formatCurrency(
        matchingTransactions.reduce((sum, transaction) => sum + Number(transaction.price ?? 0), 0)
      )
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points;
}

function selectedTeamIdsOrNone(selectedTeamIds: string[]) {
  return selectedTeamIds.length > 0 ? selectedTeamIds : ["__no_team__"];
}

function buildTransactionTeamFilter(
  input: GetOfficeReportsSnapshotInput,
  scopedOfficeId: string | null,
  selectedTeamIds: string[]
) {
  if (!input.teamId?.trim()) {
    return null;
  }

  return {
    ownerMembership: {
      is: {
        teamMemberships: {
          some: {
            organizationId: input.organizationId,
            teamId: {
              in: selectedTeamIdsOrNone(selectedTeamIds)
            },
            ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
            team: {
              isActive: true
            }
          }
        }
      }
    }
  } satisfies Prisma.TransactionWhereInput;
}

function buildTransactionWhere(
  input: GetOfficeReportsSnapshotInput,
  scopedOfficeId: string | null,
  selectedTeamIds: string[]
): Prisma.TransactionWhereInput {
  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  const status = parseTransactionStatus(input.transactionStatus);
  const type = parseTransactionType(input.transactionType);
  const conditions: Prisma.TransactionWhereInput[] = [
    {
      organizationId: input.organizationId
    }
  ];

  if (scopedOfficeId) {
    conditions.push({
      officeId: scopedOfficeId
    });
  }

  if (input.ownerMembershipId?.trim()) {
    conditions.push({
      ownerMembershipId: input.ownerMembershipId.trim()
    });
  }

  const teamFilter = buildTransactionTeamFilter(input, scopedOfficeId, selectedTeamIds);
  if (teamFilter) {
    conditions.push(teamFilter);
  }

  if (status) {
    conditions.push({
      status
    });
  }

  if (type) {
    conditions.push({
      type
    });
  }

  if (input.commissionPlanId?.trim()) {
    conditions.push({
      commissionCalculations: {
        some: {
          commissionPlanId: input.commissionPlanId.trim()
        }
      }
    });
  }

  if (startDate || endDate) {
    conditions.push({
      createdAt: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    });
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

function buildClientWhere(
  input: GetOfficeReportsSnapshotInput,
  scopedOfficeId: string | null,
  selectedTeamIds: string[]
): Prisma.ClientWhereInput {
  const conditions: Prisma.ClientWhereInput[] = [
    {
      organizationId: input.organizationId
    }
  ];

  if (input.ownerMembershipId?.trim()) {
    conditions.push({
      ownerMembershipId: input.ownerMembershipId.trim()
    });
  }

  if (scopedOfficeId) {
    conditions.push({
      ownerMembership: {
        is: {
          officeId: scopedOfficeId
        }
      }
    });
  }

  if (input.teamId?.trim()) {
    conditions.push({
      ownerMembership: {
        is: {
          teamMemberships: {
            some: {
              organizationId: input.organizationId,
              teamId: {
                in: selectedTeamIdsOrNone(selectedTeamIds)
              },
              ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
              team: {
                isActive: true
              }
            }
          }
        }
      }
    });
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

function buildAccountingWhere(
  input: GetOfficeReportsSnapshotInput,
  scopedOfficeId: string | null,
  selectedTeamIds: string[]
): Prisma.AccountingTransactionWhereInput {
  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  const status = parseTransactionStatus(input.transactionStatus);
  const type = parseTransactionType(input.transactionType);
  const conditions: Prisma.AccountingTransactionWhereInput[] = [
    {
      organizationId: input.organizationId
    },
    buildScopedOfficeCondition(scopedOfficeId)
  ];

  if (startDate || endDate) {
    conditions.push({
      accountingDate: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    });
  }

  if (input.ownerMembershipId?.trim()) {
    conditions.push({
      OR: [
        { relatedMembershipId: input.ownerMembershipId.trim() },
        { relatedTransaction: { ownerMembershipId: input.ownerMembershipId.trim() } }
      ]
    });
  }

  if (input.teamId?.trim()) {
    conditions.push({
      OR: [
        {
          relatedMembership: {
            is: {
              teamMemberships: {
                some: {
                  organizationId: input.organizationId,
                  teamId: {
                    in: selectedTeamIdsOrNone(selectedTeamIds)
                  },
                  ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
                  team: { isActive: true }
                }
              }
            }
          }
        },
        {
          relatedTransaction: {
            ownerMembership: {
              is: {
                teamMemberships: {
                some: {
                  organizationId: input.organizationId,
                  teamId: {
                    in: selectedTeamIdsOrNone(selectedTeamIds)
                  },
                  ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
                  team: { isActive: true }
                }
                }
              }
            }
          }
        }
      ]
    });
  }

  if (status || type) {
    conditions.push({
      relatedTransaction: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {})
      }
    });
  }

  if (input.commissionPlanId?.trim()) {
    conditions.push({
      OR: [
        {
          commissionCalculations: {
            some: {
              commissionPlanId: input.commissionPlanId.trim()
            }
          }
        },
        {
          relatedTransaction: {
            commissionCalculations: {
              some: {
                commissionPlanId: input.commissionPlanId.trim()
              }
            }
          }
        }
      ]
    });
  }

  return {
    AND: conditions
  };
}

function buildCommissionWhere(
  input: GetOfficeReportsSnapshotInput,
  scopedOfficeId: string | null,
  selectedTeamIds: string[]
): Prisma.CommissionCalculationWhereInput {
  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  const status = parseTransactionStatus(input.transactionStatus);
  const type = parseTransactionType(input.transactionType);
  const conditions: Prisma.CommissionCalculationWhereInput[] = [
    {
      organizationId: input.organizationId
    }
  ];

  if (scopedOfficeId) {
    conditions.push({
      officeId: scopedOfficeId
    });
  }

  if (input.ownerMembershipId?.trim()) {
    conditions.push({
      membershipId: input.ownerMembershipId.trim()
    });
  }

  if (input.teamId?.trim()) {
    conditions.push({
      membership: {
        is: {
          teamMemberships: {
            some: {
              organizationId: input.organizationId,
              teamId: {
                in: selectedTeamIdsOrNone(selectedTeamIds)
              },
              ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
              team: { isActive: true }
            }
          }
        }
      }
    });
  }

  if (input.commissionPlanId?.trim()) {
    conditions.push({
      commissionPlanId: input.commissionPlanId.trim()
    });
  }

  if (status || type) {
    conditions.push({
      transaction: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {})
      }
    });
  }

  if (startDate || endDate) {
    conditions.push({
      calculatedAt: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    });
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

function buildEarnestMoneyWhere(
  input: GetOfficeReportsSnapshotInput,
  scopedOfficeId: string | null,
  selectedTeamIds: string[]
): Prisma.EarnestMoneyRecordWhereInput {
  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  const status = parseTransactionStatus(input.transactionStatus);
  const type = parseTransactionType(input.transactionType);
  const conditions: Prisma.EarnestMoneyRecordWhereInput[] = [
    {
      organizationId: input.organizationId
    },
    scopedOfficeId
      ? {
          OR: [{ officeId: scopedOfficeId }, { officeId: null }]
        }
      : {}
  ];

  if (startDate || endDate) {
    conditions.push({
      dueAt: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    });
  }

  if (input.ownerMembershipId?.trim()) {
    conditions.push({
      transaction: {
        ownerMembershipId: input.ownerMembershipId.trim()
      }
    });
  }

  if (input.teamId?.trim()) {
    conditions.push({
      transaction: {
        ownerMembership: {
          is: {
            teamMemberships: {
              some: {
                organizationId: input.organizationId,
                teamId: {
                  in: selectedTeamIdsOrNone(selectedTeamIds)
                },
                ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
                team: { isActive: true }
              }
            }
          }
        }
      }
    });
  }

  if (status || type) {
    conditions.push({
      transaction: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {})
      }
    });
  }

  if (input.commissionPlanId?.trim()) {
    conditions.push({
      transaction: {
        commissionCalculations: {
          some: {
            commissionPlanId: input.commissionPlanId.trim()
          }
        }
      }
    });
  }

  return {
    AND: conditions
  };
}

function applyTransactionScope(where: Prisma.TransactionWhereInput, scope: OfficeDataScope): Prisma.TransactionWhereInput {
  if (scope.visibleMembershipIds === null) {
    return where;
  }

  return {
    AND: [where, buildTransactionVisibilityWhere(scope)]
  };
}

function applyClientScope(where: Prisma.ClientWhereInput, scope: OfficeDataScope): Prisma.ClientWhereInput {
  if (scope.visibleMembershipIds === null) {
    return where;
  }

  return {
    AND: [where, { ownerMembership: { is: buildMembershipVisibilityWhere(scope) } }]
  };
}

function applyAccountingScope(
  where: Prisma.AccountingTransactionWhereInput,
  scope: OfficeDataScope
): Prisma.AccountingTransactionWhereInput {
  if (scope.visibleMembershipIds === null) {
    return where;
  }

  return {
    AND: [
      where,
      {
        OR: [
          {
            relatedMembershipId: {
              in: scope.visibleMembershipIds
            }
          },
          {
            relatedTransaction: buildTransactionVisibilityWhere(scope)
          }
        ]
      }
    ]
  };
}

function applyCommissionScope(
  where: Prisma.CommissionCalculationWhereInput,
  scope: OfficeDataScope
): Prisma.CommissionCalculationWhereInput {
  if (scope.visibleMembershipIds === null) {
    return where;
  }

  return {
    AND: [
      where,
      {
        OR: [
          {
            membershipId: {
              in: scope.visibleMembershipIds
            }
          },
          {
            transaction: buildTransactionVisibilityWhere(scope)
          }
        ]
      }
    ]
  };
}

function applyEarnestMoneyScope(
  where: Prisma.EarnestMoneyRecordWhereInput,
  scope: OfficeDataScope
): Prisma.EarnestMoneyRecordWhereInput {
  if (scope.visibleMembershipIds === null) {
    return where;
  }

  return {
    AND: [where, { transaction: buildTransactionVisibilityWhere(scope) }]
  };
}

export async function getOfficeReportsSnapshot(input: GetOfficeReportsSnapshotInput): Promise<OfficeReportsSnapshot> {
  const scopedOfficeId = getScopedOfficeId(input);
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: scopedOfficeId
  });
  const scopedTeams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
      ...(scope.visibleTeamIds ? { id: { in: scope.visibleTeamIds } } : {})
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      parentTeamId: true
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });
  const teamHierarchyIndex = createTeamHierarchyIndex(scopedTeams);
  const selectedTeamIds = input.teamId?.trim() ? expandSelectedTeamIds(teamHierarchyIndex, input.teamId) : [];
  const teamPathLabelById = new Map(
    scopedTeams.map((team) => [team.id, buildTeamPathLabel(teamHierarchyIndex, team.id) || team.name])
  );
  const canViewFinancialAmounts = canViewCrossMemberFinancials(scope);
  const transactionWhere = applyTransactionScope(buildTransactionWhere(input, scopedOfficeId, selectedTeamIds), scope);
  const clientWhere = applyClientScope(buildClientWhere(input, scopedOfficeId, selectedTeamIds), scope);
  const accountingWhere = applyAccountingScope(buildAccountingWhere(input, scopedOfficeId, selectedTeamIds), scope);
  const commissionWhere = applyCommissionScope(buildCommissionWhere(input, scopedOfficeId, selectedTeamIds), scope);
  const earnestMoneyWhere = applyEarnestMoneyScope(buildEarnestMoneyWhere(input, scopedOfficeId, selectedTeamIds), scope);
  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);
  const now = new Date();

  const [
    transactions,
    contactsNeedingFollowUp,
    offices,
    ownerMemberships,
    teams,
    commissionPlans,
    commissionCalculations,
    accountingTransactions,
    earnestMoneyRecords
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: transactionWhere,
      select: {
        id: true,
        title: true,
        address: true,
        city: true,
        state: true,
        status: true,
        type: true,
        price: true,
        grossCommission: true,
        officeNet: true,
        agentNet: true,
        createdAt: true,
        closingDate: true,
        updatedAt: true,
        ownerMembershipId: true,
        ownerMembership: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            teamMemberships: {
              where: {
                organizationId: input.organizationId,
                ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
                team: {
                  isActive: true
                }
              },
              select: {
                teamId: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.client.count({
      where: {
        ...clientWhere,
        nextFollowUpAt: {
          lte: now
        }
      }
    }),
    prisma.office.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId?.trim() ? { id: input.officeId.trim() } : {})
      },
      select: {
        id: true,
        name: true
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        status: "active",
        ...buildMembershipVisibilityWhere(scope),
        ...(scopedOfficeId ? { officeId: scopedOfficeId } : {}),
        role: {
          in: [
            "owner",
            "office_admin",
            "accountant",
            "human_resources",
            "team_lead",
            "agent",
            "office_manager",
            "office_user"
          ] satisfies UserRole[]
        }
      },
      include: {
        user: true
      },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
    }),
    prisma.team.findMany({
      where: {
        id: {
          in: scopedTeams.map((team) => team.id)
        }
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        parentTeamId: true
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    prisma.commissionPlan.findMany({
      where: {
        organizationId: input.organizationId,
        ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {})
      },
      select: {
        id: true,
        name: true
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.commissionCalculation.findMany({
      where: commissionWhere,
      select: {
        id: true,
        status: true,
        statementAmount: true,
        grossCommission: true,
        calculatedAt: true,
        membership: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        transaction: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            state: true
          }
        },
        accountingTransactionId: true,
        commissionPlanId: true,
        commissionPlan: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ calculatedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.accountingTransaction.findMany({
      where: accountingWhere,
      select: {
        id: true,
        accountingDate: true,
        type: true,
        status: true,
        counterpartyName: true,
        totalAmount: true,
        relatedMembership: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        relatedTransaction: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            state: true,
            ownerMembership: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [{ accountingDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.earnestMoneyRecord.findMany({
      where: earnestMoneyWhere,
      select: {
        id: true,
        expectedAmount: true,
        receivedAmount: true,
        refundedAmount: true,
        dueAt: true,
        paymentDate: true,
        depositDate: true,
        heldByOffice: true,
        heldExternally: true,
        status: true,
        transaction: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            state: true
          }
        }
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }]
    })
  ]);

  const transactionsByStatus = reportStatusOrder.map((status) => {
    const matchingTransactions = transactions.filter((transaction) => statusFromDb[transaction.status] === status);

    return {
      status,
      count: matchingTransactions.length,
      totalVolumeLabel: formatCurrency(
        matchingTransactions.reduce((sum, transaction) => sum + Number(transaction.price ?? 0), 0)
      ),
      officeNetLabel: redactCurrency(
        formatCurrency(matchingTransactions.reduce((sum, transaction) => sum + Number(transaction.officeNet ?? 0), 0)),
        canViewFinancialAmounts
      )
    };
  });

  const ownerMap = new Map<
    string,
    {
      ownerMembershipId: string | null;
      ownerName: string;
      transactionCount: number;
      totalVolume: number;
    }
  >();
  const agentPerformanceMap = new Map<
    string,
    {
      ownerMembershipId: string | null;
      ownerName: string;
      teamLabels: Set<string>;
      transactionCount: number;
      closedTransactionCount: number;
      pendingTransactionCount: number;
      totalVolume: number;
      grossCommission: number;
      officeNet: number;
      agentNet: number;
    }
  >();
  const teamPerformanceMap = new Map<
    string,
    {
      teamId: string;
      teamName: string;
      ownerIds: Set<string>;
      transactionIds: Set<string>;
      transactionCount: number;
      closedTransactionCount: number;
      totalVolume: number;
      officeNet: number;
    }
  >();

  for (const transaction of transactions) {
    const ownerName = getOwnerName(transaction.ownerMembership);
    const ownerKey = transaction.ownerMembershipId ?? "unassigned";
    const ownerMetric = ownerMap.get(ownerKey) ?? {
      ownerMembershipId: transaction.ownerMembershipId,
      ownerName,
      transactionCount: 0,
      totalVolume: 0
    };

    ownerMetric.transactionCount += 1;
    ownerMetric.totalVolume += Number(transaction.price ?? 0);
    ownerMap.set(ownerKey, ownerMetric);

    const agentMetric = agentPerformanceMap.get(ownerKey) ?? {
      ownerMembershipId: transaction.ownerMembershipId,
      ownerName,
      teamLabels: new Set<string>(),
      transactionCount: 0,
      closedTransactionCount: 0,
      pendingTransactionCount: 0,
      totalVolume: 0,
      grossCommission: 0,
      officeNet: 0,
      agentNet: 0
    };

    agentMetric.transactionCount += 1;
    agentMetric.closedTransactionCount += transaction.status === "closed" ? 1 : 0;
    agentMetric.pendingTransactionCount += transaction.status === "pending" ? 1 : 0;
    agentMetric.totalVolume += Number(transaction.price ?? 0);
    agentMetric.grossCommission += Number(transaction.grossCommission ?? 0);
    agentMetric.officeNet += Number(transaction.officeNet ?? 0);
    agentMetric.agentNet += Number(transaction.agentNet ?? 0);

    for (const teamMembership of dedupeTeamMemberships(transaction.ownerMembership?.teamMemberships ?? [])) {
      agentMetric.teamLabels.add(teamPathLabelById.get(teamMembership.teamId) ?? teamMembership.team.name);
      const teamMetric = teamPerformanceMap.get(teamMembership.teamId) ?? {
        teamId: teamMembership.teamId,
        teamName: teamPathLabelById.get(teamMembership.teamId) ?? teamMembership.team.name,
        ownerIds: new Set<string>(),
        transactionIds: new Set<string>(),
        transactionCount: 0,
        closedTransactionCount: 0,
        totalVolume: 0,
        officeNet: 0
      };

      if (transaction.ownerMembershipId) {
        teamMetric.ownerIds.add(transaction.ownerMembershipId);
      }

      if (!teamMetric.transactionIds.has(transaction.id)) {
        teamMetric.transactionIds.add(transaction.id);
        teamMetric.transactionCount += 1;
        teamMetric.closedTransactionCount += transaction.status === "closed" ? 1 : 0;
        teamMetric.totalVolume += Number(transaction.price ?? 0);
        teamMetric.officeNet += Number(transaction.officeNet ?? 0);
      }

      teamPerformanceMap.set(teamMembership.teamId, teamMetric);
    }

    agentPerformanceMap.set(ownerKey, agentMetric);
  }

  const transactionTypes = reportTypeOrder.map((typeLabel) => {
    const matchingTransactions = transactions.filter((transaction) => typeFromDb[transaction.type] === typeLabel);

    return {
      type: typeLabel,
      count: matchingTransactions.length,
      totalVolumeLabel: formatCurrency(
        matchingTransactions.reduce((sum, transaction) => sum + Number(transaction.price ?? 0), 0)
      ),
      officeNetLabel: redactCurrency(
        formatCurrency(matchingTransactions.reduce((sum, transaction) => sum + Number(transaction.officeNet ?? 0), 0)),
        canViewFinancialAmounts
      )
    };
  });

  const transactionsByOwner = [...ownerMap.values()]
    .sort((left, right) => right.transactionCount - left.transactionCount || right.totalVolume - left.totalVolume)
    .map((entry) => ({
      ownerMembershipId: entry.ownerMembershipId,
      ownerName: entry.ownerName,
      transactionCount: entry.transactionCount,
      totalVolumeLabel: formatCurrency(entry.totalVolume)
    }));

  const recentTransactions = transactions.slice(0, 8).map((transaction) => ({
    id: transaction.id,
    title: transaction.title,
    addressLine: `${transaction.address}, ${transaction.city}, ${transaction.state}`,
    status: statusFromDb[transaction.status],
    type: typeFromDb[transaction.type],
    ownerName: getOwnerName(transaction.ownerMembership),
    priceLabel: formatCurrency(transaction.price),
    grossCommissionLabel: redactCurrency(formatCurrency(transaction.grossCommission), canViewFinancialAmounts),
    officeNetLabel: redactCurrency(formatCurrency(transaction.officeNet), canViewFinancialAmounts),
    createdAtLabel: formatDateLabel(transaction.createdAt),
    closingDateLabel: formatDateLabel(transaction.closingDate),
    href: `/office/transactions/${transaction.id}`
  }));

  const agentPerformance = [...agentPerformanceMap.values()]
    .sort((left, right) => right.transactionCount - left.transactionCount || right.totalVolume - left.totalVolume)
    .map((entry) => ({
      ownerMembershipId: entry.ownerMembershipId,
      ownerName: entry.ownerName,
      teamLabel: entry.teamLabels.size > 0 ? [...entry.teamLabels].sort().join(", ") : "No team",
      transactionCount: entry.transactionCount,
      closedTransactionCount: entry.closedTransactionCount,
      pendingTransactionCount: entry.pendingTransactionCount,
      totalVolumeLabel: formatCurrency(entry.totalVolume),
      averageVolumeLabel: formatCurrency(entry.transactionCount > 0 ? entry.totalVolume / entry.transactionCount : 0),
      grossCommissionLabel: redactCurrency(formatCurrency(entry.grossCommission), canViewFinancialAmounts),
      officeNetLabel: redactCurrency(formatCurrency(entry.officeNet), canViewFinancialAmounts),
      agentNetLabel: redactCurrency(formatCurrency(entry.agentNet), canViewFinancialAmounts),
      profileHref: entry.ownerMembershipId ? `/office/settings/users/${entry.ownerMembershipId}` : null
    }));

  const teamPerformanceRows = [...teamPerformanceMap.values()]
    .sort((left, right) => right.transactionCount - left.transactionCount || right.totalVolume - left.totalVolume)
    .map((entry) => ({
      teamId: entry.teamId,
      teamName: entry.teamName,
      agentCount: entry.ownerIds.size,
      transactionCount: entry.transactionCount,
      closedTransactionCount: entry.closedTransactionCount,
      totalVolumeLabel: formatCurrency(entry.totalVolume),
      officeNetLabel: redactCurrency(formatCurrency(entry.officeNet), canViewFinancialAmounts)
    }));

  const commissionSummaryByStatus = commissionStatusOrder.map((status) => {
    const matchingRows = commissionCalculations.filter((calculation) => calculation.status === status);

    return {
      status: commissionStatusLabelMap[status],
      count: matchingRows.length,
      statementAmountLabel: redactCurrency(
        formatCurrency(matchingRows.reduce((sum, row) => sum + Number(row.statementAmount ?? 0), 0)),
        canViewFinancialAmounts
      )
    };
  });

  const commissionPlanMap = new Map<
    string,
    {
      commissionPlanId: string | null;
      planName: string;
      calculationCount: number;
      statementAmount: number;
    }
  >();

  for (const calculation of commissionCalculations) {
    const key = calculation.commissionPlanId ?? "__unassigned_plan__";
    const current = commissionPlanMap.get(key) ?? {
      commissionPlanId: calculation.commissionPlanId,
      planName: calculation.commissionPlan?.name ?? "No persisted plan",
      calculationCount: 0,
      statementAmount: 0
    };

    current.calculationCount += 1;
    current.statementAmount += Number(calculation.statementAmount ?? 0);
    commissionPlanMap.set(key, current);
  }

  const recentCalculations = commissionCalculations.slice(0, 8).map((calculation) => ({
    id: calculation.id,
    transactionId: calculation.transaction.id,
    transactionLabel: getTransactionLabel(calculation.transaction),
    transactionHref: `/office/transactions/${calculation.transaction.id}`,
    ownerName: calculation.membership
      ? `${calculation.membership.user.firstName} ${calculation.membership.user.lastName}`
      : "Brokerage / referral",
    status: commissionStatusLabelMap[calculation.status],
    statementAmountLabel: redactCurrency(formatCurrency(calculation.statementAmount), canViewFinancialAmounts),
    grossCommissionLabel: redactCurrency(formatCurrency(calculation.grossCommission), canViewFinancialAmounts),
    calculatedAtLabel: formatDateLabel(calculation.calculatedAt),
    accountingHref: calculation.accountingTransactionId ? `/office/accounting?entryId=${calculation.accountingTransactionId}` : null
  }));

  const accountingTypeMetrics = accountingTypeOrder.map((type) => {
    const matchingTransactions = accountingTransactions.filter((transaction) => transaction.type === type);

    return {
      type: accountingTypeLabelMap[type],
      count: matchingTransactions.length,
      totalAmountLabel: redactCurrency(
        formatCurrency(matchingTransactions.reduce((sum, transaction) => sum + Number(transaction.totalAmount ?? 0), 0)),
        canViewFinancialAmounts
      )
    };
  });

  const recentAccountingTransactions = accountingTransactions.slice(0, 8).map((transaction) => {
    const ownerName = transaction.relatedMembership
      ? `${transaction.relatedMembership.user.firstName} ${transaction.relatedMembership.user.lastName}`
      : getOwnerName(transaction.relatedTransaction?.ownerMembership);

    return {
      id: transaction.id,
      accountingDateLabel: formatDateLabel(transaction.accountingDate),
      type: accountingTypeLabelMap[transaction.type],
      status: accountingStatusLabelMap[transaction.status],
      counterparty: transaction.counterpartyName?.trim() || "—",
      amountLabel: redactCurrency(formatCurrency(transaction.totalAmount), canViewFinancialAmounts),
      ownerName,
      linkedTransactionLabel: transaction.relatedTransaction ? getTransactionLabel(transaction.relatedTransaction) : "—",
      linkedTransactionHref: transaction.relatedTransaction ? `/office/transactions/${transaction.relatedTransaction.id}` : null,
      href: `/office/accounting?entryId=${transaction.id}`
    };
  });

  const earnestMoneyByStatus = earnestMoneyStatusOrder.map((status) => {
    const matchingRecords = earnestMoneyRecords.filter((record) => record.status === status);

    return {
      status: earnestMoneyStatusLabelMap[status],
      count: matchingRecords.length,
      expectedAmountLabel: redactCurrency(
        formatCurrency(matchingRecords.reduce((sum, record) => sum + Number(record.expectedAmount ?? 0), 0)),
        canViewFinancialAmounts
      ),
      receivedAmountLabel: redactCurrency(
        formatCurrency(matchingRecords.reduce((sum, record) => sum + Number(record.receivedAmount ?? 0), 0)),
        canViewFinancialAmounts
      )
    };
  });

  const recentEarnestMoneyRecords = earnestMoneyRecords.slice(0, 8).map((record) => ({
    id: record.id,
    transactionId: record.transaction.id,
    transactionLabel: getTransactionLabel(record.transaction),
    transactionHref: `/office/transactions/${record.transaction.id}`,
    expectedAmount: redactCurrency(formatCurrency(record.expectedAmount), canViewFinancialAmounts),
    receivedAmount: redactCurrency(formatCurrency(record.receivedAmount), canViewFinancialAmounts),
    dueAtLabel: formatDateLabel(record.dueAt),
    status: earnestMoneyStatusLabelMap[record.status],
    holdingLabel: record.heldExternally ? "Held externally" : record.heldByOffice ? "Held by office" : "Holding mode unset"
  }));

  const totalTransactions = transactions.length;
  const totalVolume = transactions.reduce((sum, transaction) => sum + Number(transaction.price ?? 0), 0);
  const totalGrossCommission = transactions.reduce((sum, transaction) => sum + Number(transaction.grossCommission ?? 0), 0);
  const totalOfficeNet = transactions.reduce((sum, transaction) => sum + Number(transaction.officeNet ?? 0), 0);
  const totalAgentNet = transactions.reduce((sum, transaction) => sum + Number(transaction.agentNet ?? 0), 0);
  const activeOwnerCount = new Set(
    transactions
      .map((transaction) => transaction.ownerMembershipId)
      .filter((ownerMembershipId): ownerMembershipId is string => Boolean(ownerMembershipId))
  ).size;
  const closedTransactionCount = transactions.filter((transaction) => transaction.status === "closed").length;
  const pendingTransactionCount = transactions.filter((transaction) => transaction.status === "pending").length;
  const statementReadyCommissionAmount = commissionCalculations
    .filter((calculation) => calculation.status === "statement_ready")
    .reduce((sum, calculation) => sum + Number(calculation.statementAmount ?? 0), 0);
  const payableCommissionAmount = commissionCalculations
    .filter((calculation) => calculation.status === "payable")
    .reduce((sum, calculation) => sum + Number(calculation.statementAmount ?? 0), 0);
  const paidCommissionAmount = commissionCalculations
    .filter((calculation) => calculation.status === "paid")
    .reduce((sum, calculation) => sum + Number(calculation.statementAmount ?? 0), 0);
  const totalInvoices = accountingTransactions.filter((transaction) => transaction.type === "invoice").length;
  const openBills = accountingTransactions.filter((transaction) => transaction.type === "bill" && transaction.status === "open").length;
  const receivedPaymentsAmount = accountingTransactions
    .filter((transaction) => transaction.type === "received_payment")
    .reduce((sum, transaction) => sum + Number(transaction.totalAmount ?? 0), 0);
  const madePaymentsAmount = accountingTransactions
    .filter((transaction) => transaction.type === "made_payment")
    .reduce((sum, transaction) => sum + Number(transaction.totalAmount ?? 0), 0);
  const outstandingEmdCount = earnestMoneyRecords.filter((record) => record.status !== "complete").length;
  const overdueEmdCount = earnestMoneyRecords.filter((record) => record.status === "overdue").length;

  const limitations = [
    "Transaction date range filters by transaction created date; commissions use calculated date; accounting uses accounting date; EMD uses due date.",
    "Team rollups use the owner's active team memberships; owners on multiple teams will appear in multiple team rows."
  ];

  if (!canViewFinancialAmounts) {
    limitations.push("Financial payout, commission, accounting, and earnest money amounts are redacted for the current access tier.");
  }

  if (input.commissionPlanId?.trim()) {
    limitations.push(
      "Commission plan filters depend on persisted commission calculations; transactions without calculations are excluded from that slice."
    );
  }

  limitations.push("Contacts needing follow-up are scoped only by office / owner / team and are not sliced by commission plan.");

  return {
    filters: {
      startDate: startDate ? startDate.toISOString().slice(0, 10) : "",
      endDate: endDate ? endDate.toISOString().slice(0, 10) : "",
      officeId: buildScopedOfficeFilterLabel(input, scopedOfficeId),
      ownerMembershipId: input.ownerMembershipId?.trim() ?? "",
      teamId: input.teamId?.trim() ?? "",
      transactionStatus: parseTransactionStatus(input.transactionStatus) ?? "",
      transactionType: parseTransactionType(input.transactionType) ?? "",
      commissionPlanId: input.commissionPlanId?.trim() ?? "",
      officeOptions: offices.map((office) => ({
        id: office.id,
        label: office.name
      })),
      ownerOptions: ownerMemberships.map((membership) => ({
        id: membership.id,
        label: `${membership.user.firstName} ${membership.user.lastName}`
      })),
      teamOptions: teams.map((team) => ({
        id: team.id,
        label: teamPathLabelById.get(team.id) ?? team.name
      })),
      commissionPlanOptions: commissionPlans.map((plan) => ({
        id: plan.id,
        label: plan.name
      }))
    },
    totals: {
      totalTransactions,
      contactsNeedingFollowUp,
      totalVolumeLabel: formatCurrency(totalVolume),
      activeOwnerCount,
      closedTransactionCount,
      pendingTransactionCount,
      totalGrossCommissionLabel: redactCurrency(formatCurrency(totalGrossCommission), canViewFinancialAmounts),
      totalOfficeNetLabel: redactCurrency(formatCurrency(totalOfficeNet), canViewFinancialAmounts),
      totalAgentNetLabel: redactCurrency(formatCurrency(totalAgentNet), canViewFinancialAmounts),
      statementReadyCommissionLabel: redactCurrency(formatCurrency(statementReadyCommissionAmount), canViewFinancialAmounts),
      payableCommissionLabel: redactCurrency(formatCurrency(payableCommissionAmount), canViewFinancialAmounts),
      receivedPaymentsLabel: redactCurrency(formatCurrency(receivedPaymentsAmount), canViewFinancialAmounts),
      overdueEmdCount
    },
    transactionsByStatus,
    transactionsByOwner,
    transactionsOverTime: buildTimeSeries(
      transactions.map((transaction) => ({
        createdAt: transaction.createdAt,
        status: transaction.status,
        price: transaction.price
      })),
      startDate,
      endDate
    ),
    transactionTypes,
    recentTransactions,
    agentPerformance,
    teamPerformance: {
      hasTeams: teams.length > 0,
      limitation: teams.length > 0 ? limitations[1] : null,
      rows: teamPerformanceRows
    },
    commissionSummary: {
      calculationCount: commissionCalculations.length,
      statementReadyLabel: redactCurrency(formatCurrency(statementReadyCommissionAmount), canViewFinancialAmounts),
      payableLabel: redactCurrency(formatCurrency(payableCommissionAmount), canViewFinancialAmounts),
      paidLabel: redactCurrency(formatCurrency(paidCommissionAmount), canViewFinancialAmounts),
      byStatus: commissionSummaryByStatus,
      byPlan: [...commissionPlanMap.values()]
        .sort((left, right) => right.calculationCount - left.calculationCount || right.statementAmount - left.statementAmount)
        .map((entry) => ({
          commissionPlanId: entry.commissionPlanId,
          planName: entry.planName,
          calculationCount: entry.calculationCount,
          statementAmountLabel: redactCurrency(formatCurrency(entry.statementAmount), canViewFinancialAmounts)
        })),
      recentCalculations
    },
    accountingSummary: {
      transactionCount: accountingTransactions.length,
      totalInvoices,
      openBills,
      receivedPaymentsLabel: redactCurrency(formatCurrency(receivedPaymentsAmount), canViewFinancialAmounts),
      madePaymentsLabel: redactCurrency(formatCurrency(madePaymentsAmount), canViewFinancialAmounts),
      byType: accountingTypeMetrics,
      recentTransactions: recentAccountingTransactions
    },
    emdSummary: {
      recordCount: earnestMoneyRecords.length,
      outstandingCount: outstandingEmdCount,
      overdueCount: overdueEmdCount,
      expectedAmountLabel: redactCurrency(
        formatCurrency(earnestMoneyRecords.reduce((sum, record) => sum + Number(record.expectedAmount ?? 0), 0)),
        canViewFinancialAmounts
      ),
      receivedAmountLabel: redactCurrency(
        formatCurrency(earnestMoneyRecords.reduce((sum, record) => sum + Number(record.receivedAmount ?? 0), 0)),
        canViewFinancialAmounts
      ),
      byStatus: earnestMoneyByStatus,
      recentRecords: recentEarnestMoneyRecords
    },
    limitations
  };
}

export async function listOfficeReportTransactionsForExport(
  input: GetOfficeReportsSnapshotInput
): Promise<OfficeReportTransactionExportRow[]> {
  const scopedOfficeId = getScopedOfficeId(input);
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: scopedOfficeId
  });
  const canViewFinancialAmounts = canViewCrossMemberFinancials(scope);
  const scopedTeams = await prisma.team.findMany({
    where: {
      organizationId: input.organizationId,
      ...(scopedOfficeId ? { OR: [{ officeId: scopedOfficeId }, { officeId: null }] } : {}),
      ...(scope.visibleTeamIds ? { id: { in: scope.visibleTeamIds } } : {})
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      parentTeamId: true
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });
  const teamHierarchyIndex = createTeamHierarchyIndex(scopedTeams);
  const selectedTeamIds = input.teamId?.trim() ? expandSelectedTeamIds(teamHierarchyIndex, input.teamId) : [];
  const transactionWhere = applyTransactionScope(buildTransactionWhere(input, scopedOfficeId, selectedTeamIds), scope);

  const transactions = await prisma.transaction.findMany({
    where: transactionWhere,
    include: {
      ownerMembership: {
        include: {
          user: true
        }
      },
      primaryClient: {
        select: {
          fullName: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return transactions.map((transaction) => ({
    transactionId: transaction.id,
    title: transaction.title,
    address: transaction.address,
    city: transaction.city,
    state: transaction.state,
    zipCode: transaction.zipCode,
    type: typeFromDb[transaction.type],
    status: statusFromDb[transaction.status],
    representing: representingFromDb[transaction.representing],
    owner: transaction.ownerMembership
      ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
      : "Unassigned",
    primaryContact: transaction.primaryClient?.fullName ?? "",
    price: formatCurrencyFromDb(transaction.price),
    grossCommission: redactCurrency(formatCurrencyFromDb(transaction.grossCommission), canViewFinancialAmounts),
    referralFee: redactCurrency(formatCurrencyFromDb(transaction.referralFee), canViewFinancialAmounts),
    officeNet: redactCurrency(formatCurrencyFromDb(transaction.officeNet), canViewFinancialAmounts),
    agentNet: redactCurrency(formatCurrencyFromDb(transaction.agentNet), canViewFinancialAmounts),
    importantDate: formatDateOnly(transaction.importantDate),
    closingDate: formatDateOnly(transaction.closingDate),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString()
  }));
}
