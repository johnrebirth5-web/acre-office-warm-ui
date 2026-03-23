import {
  AgentPayoutStatementPeriodBasis,
  CommissionCalculationStatus,
  MembershipStatus,
  UserRole,
  Prisma
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";

type StatementCandidateCalculation = Prisma.CommissionCalculationGetPayload<{
  include: {
    transaction: true;
  };
}>;

type StatementRecordWithRelations = Prisma.AgentPayoutStatementGetPayload<{
  include: {
    membership: {
      include: {
        user: true;
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

export type OfficeAgentPayoutStatementCandidateRow = {
  id: string;
  transactionId: string;
  transactionLabel: string;
  transactionHref: string;
  propertyAddress: string;
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
};

export type OfficeAgentPayoutStatementLineRecord = {
  id: string;
  commissionCalculationId: string;
  transactionId: string;
  transactionLabel: string;
  transactionHref: string;
  propertyAddress: string;
  closingDate: string;
  calculatedAt: string;
  statusAtGeneration: string;
  statusAtGenerationValue: CommissionCalculationStatus;
  grossCommissionLabel: string;
  grossCommissionValue: string;
  referralFeeLabel: string;
  referralFeeValue: string;
  feesLabel: string;
  feesValue: string;
  officeNetLabel: string;
  officeNetValue: string;
  agentNetLabel: string;
  agentNetValue: string;
  statementAmountLabel: string;
  statementAmountValue: string;
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
  totalOfficeNetLabel: string;
  totalOfficeNetValue: string;
  totalAgentNetLabel: string;
  totalAgentNetValue: string;
  lineItems: OfficeAgentPayoutStatementLineRecord[];
};

export type GetOfficeAgentPayoutStatementsWorkspaceInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId?: string;
  periodStart?: string;
  periodEnd?: string;
  periodBasis?: string;
  statementId?: string;
};

export type OfficeAgentPayoutStatementsWorkspaceSnapshot = {
  filters: {
    membershipId: string;
    periodStart: string;
    periodEnd: string;
    periodBasis: AgentPayoutStatementPeriodBasis;
    memberOptions: OfficeAgentPayoutStatementMemberOption[];
  };
  candidateRows: OfficeAgentPayoutStatementCandidateRow[];
  skippedMissingClosingDateCount: number;
  history: OfficeAgentPayoutStatementRecord[];
  selectedStatement: OfficeAgentPayoutStatementDetail | null;
};

export type CreateAgentPayoutStatementInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  periodStart: string;
  periodEnd: string;
  periodBasis: string;
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

const commissionCalculationStatusLabelMap: Record<CommissionCalculationStatus, string> = {
  draft: "Draft",
  calculated: "Calculated",
  reviewed: "Reviewed",
  statement_ready: "Statement ready",
  payable: "Payable",
  paid: "Paid"
};

const selectableAgentMembershipStatuses = ["active", "invited"] satisfies MembershipStatus[];
const selectableAgentPayoutMembershipRoles = ["agent", "team_lead"] satisfies UserRole[];

function buildOfficeOrGlobalMembershipWhere(officeId: string | null | undefined): Prisma.MembershipWhereInput | undefined {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }]
  };
}

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

function formatPeriodLabel(periodStart: Date, periodEnd: Date) {
  return `${formatDateValue(periodStart)} to ${formatDateValue(periodEnd)}`;
}

function formatMembershipLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
  };
}) {
  return `${membership.user.firstName} ${membership.user.lastName}`.trim();
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

function startOfDay(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function endOfDay(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decimalToString(value: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(value ?? 0).toString();
}

export function normalizeAgentPayoutStatementPeriodBasis(value: string | undefined | null): AgentPayoutStatementPeriodBasis {
  return value === "closing_date" ? "closing_date" : "calculated_at";
}

export function getAgentPayoutStatementMatchDate(
  record: StatementDateSubject,
  periodBasis: AgentPayoutStatementPeriodBasis
) {
  return periodBasis === "closing_date" ? record.closingDate : record.calculatedAt;
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

function buildAgentPayoutStatementWhere(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  periodStart: Date;
  periodEnd: Date;
  periodBasis: AgentPayoutStatementPeriodBasis;
}) {
  const baseWhere: Prisma.CommissionCalculationWhereInput = {
    organizationId: input.organizationId,
    ...(buildOfficeOrGlobalCommissionWhere(input.officeId) ?? {}),
    membershipId: input.membershipId,
    recipientType: "agent",
    status: "statement_ready"
  };

  if (input.periodBasis === "closing_date") {
    return {
      ...baseWhere,
      transaction: {
        closingDate: {
          gte: input.periodStart,
          lte: input.periodEnd
        }
      }
    } satisfies Prisma.CommissionCalculationWhereInput;
  }

  return {
    ...baseWhere,
    calculatedAt: {
      gte: input.periodStart,
      lte: input.periodEnd
    }
  } satisfies Prisma.CommissionCalculationWhereInput;
}

function mapCandidateRow(calculation: StatementCandidateCalculation): OfficeAgentPayoutStatementCandidateRow {
  return {
    id: calculation.id,
    transactionId: calculation.transactionId,
    transactionLabel: buildTransactionLabel(calculation.transaction),
    transactionHref: `/office/transactions/${calculation.transactionId}`,
    propertyAddress: buildPropertyAddress(calculation.transaction),
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
    statementAmountValue: decimalToString(calculation.statementAmount)
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
    periodBasisLabel: record.periodBasis === "closing_date" ? "Closing date" : "Calculated date",
    generatedAt: record.generatedAt.toISOString(),
    generatedAtLabel: formatDateTimeValue(record.generatedAt),
    generatedByLabel: record.generatedByMembership ? formatMembershipLabel(record.generatedByMembership) : "System",
    lineItemCount: record.lineItemCount,
    totalStatementAmountLabel: formatCurrency(record.totalStatementAmount),
    totalStatementAmountValue: decimalToString(record.totalStatementAmount)
  };
}

function mapStatementDetail(record: StatementRecordWithRelations): OfficeAgentPayoutStatementDetail {
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
    periodBasisLabel: record.periodBasis === "closing_date" ? "Closing date" : "Calculated date",
    generatedAt: record.generatedAt.toISOString(),
    generatedAtLabel: formatDateTimeValue(record.generatedAt),
    generatedByLabel: record.generatedByMembership ? formatMembershipLabel(record.generatedByMembership) : "System",
    lineItemCount: record.lineItemCount,
    totalStatementAmountLabel: formatCurrency(record.totalStatementAmount),
    totalStatementAmountValue: decimalToString(record.totalStatementAmount),
    totalGrossCommissionLabel: formatCurrency(record.totalGrossCommission),
    totalGrossCommissionValue: decimalToString(record.totalGrossCommission),
    totalOfficeNetLabel: formatCurrency(record.totalOfficeNet),
    totalOfficeNetValue: decimalToString(record.totalOfficeNet),
    totalAgentNetLabel: formatCurrency(record.totalAgentNet),
    totalAgentNetValue: decimalToString(record.totalAgentNet),
    lineItems: record.lineItems.map((lineItem) => ({
      id: lineItem.id,
      commissionCalculationId: lineItem.commissionCalculationId,
      transactionId: lineItem.transactionId,
      transactionLabel: lineItem.transactionLabel,
      transactionHref: `/office/transactions/${lineItem.transactionId}`,
      propertyAddress: lineItem.propertyAddress,
      closingDate: formatDateValue(lineItem.closingDate),
      calculatedAt: formatDateValue(lineItem.calculatedAt),
      statusAtGeneration: commissionCalculationStatusLabelMap[lineItem.statusAtGeneration],
      statusAtGenerationValue: lineItem.statusAtGeneration,
      grossCommissionLabel: formatCurrency(lineItem.grossCommission),
      grossCommissionValue: decimalToString(lineItem.grossCommission),
      referralFeeLabel: formatCurrency(lineItem.referralFee),
      referralFeeValue: decimalToString(lineItem.referralFee),
      feesLabel: formatCurrency(lineItem.fees),
      feesValue: decimalToString(lineItem.fees),
      officeNetLabel: formatCurrency(lineItem.officeNet),
      officeNetValue: decimalToString(lineItem.officeNet),
      agentNetLabel: formatCurrency(lineItem.agentNet),
      agentNetValue: decimalToString(lineItem.agentNet),
      statementAmountLabel: formatCurrency(lineItem.statementAmount),
      statementAmountValue: decimalToString(lineItem.statementAmount)
    }))
  };
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
          user: true
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

  return statement ? mapStatementDetail(statement) : null;
}

export async function getOfficeAgentPayoutStatementsWorkspaceSnapshot(
  input: GetOfficeAgentPayoutStatementsWorkspaceInput
): Promise<OfficeAgentPayoutStatementsWorkspaceSnapshot> {
  const periodBasis = normalizeAgentPayoutStatementPeriodBasis(input.periodBasis);
  const periodStart = startOfDay(input.periodStart);
  const periodEnd = endOfDay(input.periodEnd);
  const membershipId = input.membershipId?.trim() ?? "";

  const [memberOptions, history, selectedStatement, candidateRows, skippedMissingClosingDateCount] = await Promise.all([
    prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        status: {
          in: selectableAgentMembershipStatuses
        },
        role: {
          in: selectableAgentPayoutMembershipRoles
        },
        ...(buildOfficeOrGlobalMembershipWhere(input.officeId) ?? {})
      },
      include: {
        user: true
      },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
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
            user: true
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
    membershipId && periodStart && periodEnd
      ? prisma.commissionCalculation.findMany({
          where: buildAgentPayoutStatementWhere({
            organizationId: input.organizationId,
            officeId: input.officeId,
            membershipId,
            periodStart,
            periodEnd,
            periodBasis
          }),
          include: {
            transaction: true
          },
          orderBy: [{ calculatedAt: "desc" }, { transaction: { closingDate: "desc" } }],
          take: 200
        })
      : Promise.resolve([]),
    membershipId && periodBasis === "closing_date"
      ? prisma.commissionCalculation.count({
          where: {
            organizationId: input.organizationId,
            ...(buildOfficeOrGlobalCommissionWhere(input.officeId) ?? {}),
            membershipId,
            recipientType: "agent",
            status: "statement_ready",
            transaction: {
              closingDate: null
            }
          }
        })
      : Promise.resolve(0)
  ]);

  return {
    filters: {
      membershipId,
      periodStart: input.periodStart?.trim() ?? "",
      periodEnd: input.periodEnd?.trim() ?? "",
      periodBasis,
      memberOptions: memberOptions.map((membership) => ({
        id: membership.id,
        label: formatMembershipLabel(membership)
      }))
    },
    candidateRows: candidateRows.map(mapCandidateRow),
    skippedMissingClosingDateCount,
    history: history.map(mapStatementRecord),
    selectedStatement
  };
}

export async function createAgentPayoutStatement(input: CreateAgentPayoutStatementInput) {
  const membershipId = input.membershipId.trim();
  const commissionCalculationIds = [...new Set(input.commissionCalculationIds.map((value) => value.trim()).filter(Boolean))];
  const periodBasis = normalizeAgentPayoutStatementPeriodBasis(input.periodBasis);
  const periodStart = startOfDay(input.periodStart);
  const periodEnd = endOfDay(input.periodEnd);

  if (!membershipId) {
    throw new Error("Agent is required.");
  }

  if (!periodStart || !periodEnd) {
    throw new Error("A valid statement date range is required.");
  }

  if (periodStart > periodEnd) {
    throw new Error("Statement start date must be on or before the end date.");
  }

  if (commissionCalculationIds.length === 0) {
    throw new Error("Select at least one commission row for this statement.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId: input.organizationId,
        status: {
          in: selectableAgentMembershipStatuses
        },
        role: {
          in: selectableAgentPayoutMembershipRoles
        },
        ...(buildOfficeOrGlobalMembershipWhere(input.officeId) ?? {})
      },
      include: {
        user: true
      }
    });

    if (!membership) {
      throw new Error("Agent not found for statement generation.");
    }

    const calculations = await tx.commissionCalculation.findMany({
      where: {
        ...buildAgentPayoutStatementWhere({
          organizationId: input.organizationId,
          officeId: input.officeId,
          membershipId,
          periodStart,
          periodEnd,
          periodBasis
        }),
        id: {
          in: commissionCalculationIds
        }
      },
      include: {
        transaction: true
      },
      orderBy: [{ calculatedAt: "desc" }, { transaction: { closingDate: "desc" } }]
    });

    if (calculations.length !== commissionCalculationIds.length) {
      throw new Error("Some selected commission rows are no longer eligible for this statement.");
    }

    const totals = summarizeAgentPayoutStatementRows(calculations);
    const statement = await tx.agentPayoutStatement.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? membership.officeId,
        membershipId: membership.id,
        periodStart,
        periodEnd,
        periodBasis,
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
        commissionCalculationId: calculation.id,
        transactionId: calculation.transactionId,
        transactionLabel: buildTransactionLabel(calculation.transaction),
        propertyAddress: buildPropertyAddress(calculation.transaction),
        closingDate: calculation.transaction.closingDate,
        calculatedAt: calculation.calculatedAt,
        statusAtGeneration: calculation.status,
        grossCommission: calculation.grossCommission,
        referralFee: calculation.referralFee,
        fees: calculation.fees,
        officeNet: calculation.officeNet,
        agentNet: calculation.agentNet,
        statementAmount: calculation.statementAmount
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
        contextHref: `/office/accounting?membershipId=${membership.id}&periodStart=${formatDateValue(periodStart)}&periodEnd=${formatDateValue(periodEnd)}&periodBasis=${periodBasis}&statementId=${statement.id}`,
        details: [
          `Agent: ${formatMembershipLabel(membership)}`,
          `Period: ${formatPeriodLabel(periodStart, periodEnd)}`,
          `Basis: ${periodBasis === "closing_date" ? "Closing date" : "Calculated date"}`,
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
