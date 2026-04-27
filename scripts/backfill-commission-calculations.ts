#!/usr/bin/env tsx

import {
  Prisma,
  type TransactionFinanceFee,
  type TransactionFinanceApprovalStatus,
  type TransactionFinanceCalculationType,
  type TransactionFinanceFeeType,
  type TransactionStatus
} from "@prisma/client";
import { calculateTransactionCommission, prisma } from "@acre/db";
import {
  activeFinanceFeeDefinitions,
  buildInitialTransactionFinanceFeeSeed,
  buildTransactionFinancePrerequisiteSnapshot,
  deriveRateFromAmount,
  formatCurrency,
  normalizeFinanceFeeApprovalStatus
} from "../packages/db/src/commissions/types";
import {
  buildDefaultTransactionCommissionChain,
  calculateTransactionFinanceResult,
  hasManualParticipantRows,
  parseStoredTransactionFinanceStakeholderBreakdown
} from "../packages/db/src/commissions/planning";

const defaultTransactionStatuses: TransactionStatus[] = ["pending", "closed"];
const validTransactionStatuses = new Set<TransactionStatus>([
  "opportunity",
  "active",
  "pending",
  "closed",
  "cancelled"
]);

type CliOptions = {
  organizationId?: string;
  organizationSlug?: string;
  officeId?: string;
  officeSlug?: string;
  actorMembershipId?: string;
  actorEmail?: string;
  transactionIds: string[];
  statuses: TransactionStatus[];
  limit?: number;
  allOffices: boolean;
  allStatuses: boolean;
  includeExisting: boolean;
  requireInvoiceNumber: boolean;
  allowZeroAgentPayout: boolean;
  execute: boolean;
  json: boolean;
};

type BatchAction = "ready" | "skip" | "calculated" | "failed";

type BatchRow = {
  transactionId: string;
  transactionLabel: string;
  officeLabel: string;
  status: TransactionStatus;
  ownerLabel: string;
  grossCommissionLabel: string;
  invoiceNumber: string;
  existingCalculationCount: number;
  action: BatchAction;
  blockers: string[];
  warnings: string[];
};

type BatchReport = {
  mode: "dry-run" | "execute";
  organizationLabel: string;
  officeLabel: string;
  transactionStatusesLabel: string;
  totalTransactions: number;
  rows: BatchRow[];
  summary: {
    ready: number;
    skipped: number;
    calculated: number;
    failed: number;
    withWarnings: number;
    blockerCounts: Record<string, number>;
    warningCounts: Record<string, number>;
  };
};

type DryRunFeeReader = {
  transactionFinanceFee: {
    findMany: (args: Prisma.TransactionFinanceFeeFindManyArgs) => Promise<TransactionFinanceFee[]>;
  };
};

class DryRunRollback extends Error {
  constructor(readonly row: BatchRow) {
    super("Rollback dry-run commission evaluation.");
  }
}

function readCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    transactionIds: [],
    statuses: [...defaultTransactionStatuses],
    allOffices: false,
    allStatuses: false,
    includeExisting: false,
    requireInvoiceNumber: false,
    allowZeroAgentPayout: false,
    execute: false,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--organization-id") {
      options.organizationId = argv[++index]?.trim();
      continue;
    }

    if (value === "--organization-slug") {
      options.organizationSlug = argv[++index]?.trim();
      continue;
    }

    if (value === "--office-id") {
      options.officeId = argv[++index]?.trim();
      continue;
    }

    if (value === "--office-slug") {
      options.officeSlug = argv[++index]?.trim();
      continue;
    }

    if (value === "--actor-membership-id") {
      options.actorMembershipId = argv[++index]?.trim();
      continue;
    }

    if (value === "--actor-email") {
      options.actorEmail = argv[++index]?.trim().toLowerCase();
      continue;
    }

    if (value === "--transaction-id") {
      const nextValue = argv[++index]?.trim();
      if (nextValue) {
        options.transactionIds.push(nextValue);
      }
      continue;
    }

    if (value === "--transaction-ids") {
      options.transactionIds.push(...parseCsv(argv[++index]));
      continue;
    }

    if (value === "--status" || value === "--statuses") {
      options.statuses = parseStatuses(argv[++index]);
      options.allStatuses = false;
      continue;
    }

    if (value === "--limit") {
      options.limit = parsePositiveInteger(argv[++index], "--limit");
      continue;
    }

    if (value === "--all-offices") {
      options.allOffices = true;
      continue;
    }

    if (value === "--all-statuses") {
      options.allStatuses = true;
      continue;
    }

    if (value === "--include-existing") {
      options.includeExisting = true;
      continue;
    }

    if (value === "--require-invoice-number") {
      options.requireInvoiceNumber = true;
      continue;
    }

    if (value === "--allow-zero-agent-payout") {
      options.allowZeroAgentPayout = true;
      continue;
    }

    if (value === "--execute") {
      options.execute = true;
      continue;
    }

    if (value === "--dry-run") {
      options.execute = false;
      continue;
    }

    if (value === "--json") {
      options.json = true;
      continue;
    }

    if (value === "--help" || value === "-h") {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown option: ${value}`);
  }

  options.transactionIds = Array.from(new Set(options.transactionIds));
  return options;
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseStatuses(value: string | undefined): TransactionStatus[] {
  const statuses = parseCsv(value);

  if (statuses.length === 0) {
    throw new Error("--status requires at least one transaction status.");
  }

  for (const status of statuses) {
    if (!validTransactionStatuses.has(status as TransactionStatus)) {
      throw new Error(`Unsupported transaction status: ${status}`);
    }
  }

  return statuses as TransactionStatus[];
}

function parsePositiveInteger(value: string | undefined, label: string) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function printUsage() {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/backfill-commission-calculations.ts --organization-slug acre --office-slug acre-ny-realty [--dry-run|--execute]",
      "",
      "Safe default:",
      "  The script runs in dry-run mode unless --execute is passed.",
      "",
      "Required scope:",
      "  --organization-id <id> | --organization-slug <slug>",
      "  --office-id <id> | --office-slug <slug> | --all-offices",
      "",
      "Execution requirement:",
      "  --execute requires --actor-email <email> or --actor-membership-id <id>.",
      "",
      "Filters:",
      "  --status pending,closed        Transaction statuses to scan. Defaults to pending,closed.",
      "  --all-statuses                 Scan all transaction statuses.",
      "  --transaction-id <id>          Scan one transaction id. Can be repeated.",
      "  --transaction-ids <id,id>      Scan multiple transaction ids.",
      "  --limit <n>                    Limit scanned transactions.",
      "",
      "Behavior:",
      "  --include-existing            Recalculate transactions that already have commission rows.",
      "  --require-invoice-number      Treat missing invoiceNumber as a blocker.",
      "  --allow-zero-agent-payout     Allow calculations whose agent payout amount is $0.",
      "  --json                        Print the full machine-readable report.",
    ].join("\n")
  );
}

async function resolveOrganization(options: CliOptions) {
  if (options.organizationId) {
    const organization = await prisma.organization.findUnique({
      where: {
        id: options.organizationId
      }
    });

    if (!organization) {
      throw new Error(`Organization not found: ${options.organizationId}`);
    }

    return organization;
  }

  if (options.organizationSlug) {
    const organization = await prisma.organization.findUnique({
      where: {
        slug: options.organizationSlug
      }
    });

    if (!organization) {
      throw new Error(`Organization not found: ${options.organizationSlug}`);
    }

    return organization;
  }

  const organizations = await prisma.organization.findMany({
    orderBy: {
      name: "asc"
    }
  });

  if (organizations.length === 1 && organizations[0]) {
    return organizations[0];
  }

  throw new Error("Pass --organization-id or --organization-slug.");
}

async function resolveOffice(options: CliOptions, organizationId: string) {
  if (options.allOffices) {
    return null;
  }

  if (options.officeId) {
    const office = await prisma.office.findFirst({
      where: {
        id: options.officeId,
        organizationId
      }
    });

    if (!office) {
      throw new Error(`Office not found: ${options.officeId}`);
    }

    return office;
  }

  if (options.officeSlug) {
    const office = await prisma.office.findFirst({
      where: {
        slug: options.officeSlug,
        organizationId
      }
    });

    if (!office) {
      throw new Error(`Office not found: ${options.officeSlug}`);
    }

    return office;
  }

  throw new Error("Pass --office-id, --office-slug, or --all-offices.");
}

async function resolveActorMembership(options: CliOptions, organizationId: string) {
  if (!options.execute) {
    return null;
  }

  if (options.actorMembershipId) {
    const membership = await prisma.membership.findFirst({
      where: {
        id: options.actorMembershipId,
        organizationId
      },
      include: {
        user: true
      }
    });

    if (!membership) {
      throw new Error(`Actor membership not found: ${options.actorMembershipId}`);
    }

    return membership;
  }

  if (options.actorEmail) {
    const membership = await prisma.membership.findFirst({
      where: {
        organizationId,
        user: {
          email: options.actorEmail
        }
      },
      include: {
        user: true
      }
    });

    if (!membership) {
      throw new Error(`Actor membership not found for email: ${options.actorEmail}`);
    }

    return membership;
  }

  throw new Error("--execute requires --actor-email or --actor-membership-id.");
}

function buildOfficeScopeWhere(officeId: string | null) {
  if (!officeId) {
    return {};
  }

  return {
    OR: [{ officeId }, { officeId: null }]
  } satisfies Prisma.TransactionWhereInput;
}

function getInvoiceNumber(additionalFields: Prisma.JsonValue | null | undefined) {
  if (!additionalFields || typeof additionalFields !== "object" || Array.isArray(additionalFields)) {
    return "";
  }

  const value = additionalFields.invoiceNumber;
  return typeof value === "string" ? value.trim() : "";
}

function buildTransactionLabel(transaction: {
  title: string;
  address: string;
  city: string;
  state: string;
}) {
  return [transaction.title, transaction.address, transaction.city, transaction.state]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" | ");
}

function buildMembershipLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
} | null) {
  if (!membership) {
    return "Unassigned";
  }

  return `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email;
}

function addCount(target: Record<string, number>, values: string[]) {
  for (const value of values) {
    target[value] = (target[value] ?? 0) + 1;
  }
}

function buildSummary(rows: BatchRow[]): BatchReport["summary"] {
  const blockerCounts: Record<string, number> = {};
  const warningCounts: Record<string, number> = {};

  for (const row of rows) {
    addCount(blockerCounts, row.blockers);
    addCount(warningCounts, row.warnings);
  }

  return {
    ready: rows.filter((row) => row.action === "ready").length,
    skipped: rows.filter((row) => row.action === "skip").length,
    calculated: rows.filter((row) => row.action === "calculated").length,
    failed: rows.filter((row) => row.action === "failed").length,
    withWarnings: rows.filter((row) => row.warnings.length > 0).length,
    blockerCounts,
    warningCounts
  };
}

async function buildDryRunFeeRows(
  tx: DryRunFeeReader,
  transaction: {
    id: string;
    organizationId: string;
    officeId: string | null;
    grossCommission: Prisma.Decimal | null;
    referralFee: Prisma.Decimal | null;
    companyReferral: boolean;
    additionalFields: Prisma.JsonValue | null;
  }
) {
  const existingFees = await tx.transactionFinanceFee.findMany({
    where: {
      organizationId: transaction.organizationId,
      transactionId: transaction.id
    }
  });
  const existingByType = new Map<TransactionFinanceFeeType, TransactionFinanceFee>(
    existingFees.map((fee) => [fee.feeType, fee])
  );

  return activeFinanceFeeDefinitions.map((definition) => {
    const existing = existingByType.get(definition.feeType);

    if (existing) {
      return {
        id: existing.id,
        feeType: existing.feeType,
        rate: existing.rate,
        amount: existing.amount,
        selectedCalculationType: existing.selectedCalculationType,
        approvalRequired: existing.approvalRequired,
        approvalStatus: existing.approvalStatus,
        notes: existing.notes
      };
    }

    const seededAmount = buildInitialTransactionFinanceFeeSeed({
      feeType: definition.feeType,
      grossCommission: transaction.grossCommission,
      referralFee: transaction.referralFee,
      companyReferral: transaction.companyReferral,
      additionalFields: transaction.additionalFields
    });
    const seededRate = seededAmount
      ? deriveRateFromAmount(seededAmount, transaction.grossCommission) ?? definition.defaultRate
      : null;
    const approval = normalizeFinanceFeeApprovalStatus({
      definition,
      rate: seededRate,
      requestedStatus: null
    });

    return {
      id: `dry-run-${definition.feeType}`,
      feeType: definition.feeType as TransactionFinanceFeeType,
      rate: seededRate,
      amount: seededAmount,
      selectedCalculationType: definition.defaultCalculationType as TransactionFinanceCalculationType,
      approvalRequired: approval.approvalRequired,
      approvalStatus: approval.approvalStatus as TransactionFinanceApprovalStatus,
      notes: null
    };
  });
}

async function evaluateTransactionForBackfill(
  transaction: Prisma.TransactionGetPayload<{
    include: {
      office: true;
      ownerMembership: {
        include: {
          user: true;
        };
      };
      commissionCalculations: {
        select: {
          id: true;
        };
      };
      financeCalculationVersions: true;
    };
  }>,
  options: CliOptions
): Promise<BatchRow> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const invoiceNumber = getInvoiceNumber(transaction.additionalFields);
  const baseRow: Omit<BatchRow, "action" | "blockers" | "warnings"> = {
    transactionId: transaction.id,
    transactionLabel: buildTransactionLabel(transaction),
    officeLabel: transaction.office?.name ?? "All offices",
    status: transaction.status,
    ownerLabel: buildMembershipLabel(transaction.ownerMembership),
    grossCommissionLabel: formatCurrency(transaction.grossCommission),
    invoiceNumber,
    existingCalculationCount: transaction.commissionCalculations.length
  };

  if (transaction.commissionCalculations.length > 0 && !options.includeExisting) {
    blockers.push("Existing commission calculation rows already exist.");
  }

  if (!transaction.grossCommission) {
    blockers.push("Missing gross commission.");
  }

  if (!transaction.ownerMembershipId) {
    blockers.push("Missing transaction owner membership.");
  }

  if (!invoiceNumber) {
    const message = "Missing invoiceNumber; Agent Statements invoice picker will not show this row.";
    if (options.requireInvoiceNumber) {
      blockers.push(message);
    } else {
      warnings.push(message);
    }
  }

  const currentVersion = transaction.financeCalculationVersions[0] ?? null;
  if (
    currentVersion &&
    hasManualParticipantRows(parseStoredTransactionFinanceStakeholderBreakdown(currentVersion.stakeholderBreakdown))
  ) {
    blockers.push("Current finance version has manual override participants; use Override instead of Recalculate.");
  }

  if (blockers.length > 0) {
    return {
      ...baseRow,
      action: "skip",
      blockers,
      warnings
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      let row: BatchRow;

      try {
        const fees = await buildDryRunFeeRows(tx, transaction);
        const chain = await buildDefaultTransactionCommissionChain(tx, {
          organizationId: transaction.organizationId,
          officeId: transaction.officeId,
          ownerMembershipId: transaction.ownerMembershipId ?? "",
          effectiveAt: transaction.createdAt ?? new Date(),
          transactionCommissionContext: transaction.commissionContext
        });
        const calculated = calculateTransactionFinanceResult({
          grossCommission: transaction.grossCommission ?? new Prisma.Decimal(0),
          fees,
          chain,
          prerequisites: buildTransactionFinancePrerequisiteSnapshot({
            clientReferralFormApproved: transaction.clientReferralFormApproved,
            rebateAgreementSigned: transaction.rebateAgreementSigned,
            rebateGoogleFormSubmitted: transaction.rebateGoogleFormSubmitted
          })
        });
        const nextBlockers = [...calculated.approvalBlockers];
        const agentRows = calculated.stakeholderRows.filter(
          (stakeholderRow) => stakeholderRow.recipientType === "agent" && stakeholderRow.membershipId
        );

        if (nextBlockers.length === 0 && agentRows.length === 0) {
          nextBlockers.push("Calculation would not create an agent payout row.");
        }

        if (
          nextBlockers.length === 0 &&
          agentRows.length > 0 &&
          agentRows.every((stakeholderRow) => stakeholderRow.finalAmount.lte(0))
        ) {
          const message = "Calculated agent payout amount is $0; configure commission split before batch calculation.";
          if (options.allowZeroAgentPayout) {
            warnings.push(message);
          } else {
            nextBlockers.push(message);
          }
        }

        row = {
          ...baseRow,
          action: nextBlockers.length > 0 ? "skip" : "ready",
          blockers: nextBlockers,
          warnings
        };
      } catch (error) {
        row = {
          ...baseRow,
          action: "skip",
          blockers: [error instanceof Error ? error.message : "Failed to evaluate commission calculation."],
          warnings
        };
      }

      throw new DryRunRollback(row);
    });
  } catch (error) {
    if (error instanceof DryRunRollback) {
      return error.row;
    }

    throw error;
  }

  throw new Error("Dry-run transaction evaluation did not roll back.");
}

async function runBatch(options: CliOptions): Promise<BatchReport> {
  const organization = await resolveOrganization(options);
  const office = await resolveOffice(options, organization.id);
  const actorMembership = await resolveActorMembership(options, organization.id);
  const transactionWhere: Prisma.TransactionWhereInput = {
    organizationId: organization.id,
    ...buildOfficeScopeWhere(office?.id ?? null),
    ...(options.transactionIds.length > 0
      ? {
          id: {
            in: options.transactionIds
          }
        }
      : options.allStatuses
        ? {}
        : {
            status: {
              in: options.statuses
            }
          })
  };
  const transactions = await prisma.transaction.findMany({
    where: transactionWhere,
    include: {
      office: true,
      ownerMembership: {
        include: {
          user: true
        }
      },
      commissionCalculations: {
        select: {
          id: true
        }
      },
      financeCalculationVersions: {
        where: {
          isCurrent: true
        },
        orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
        take: 1
      }
    },
    orderBy: [{ closingDate: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    ...(options.limit ? { take: options.limit } : {})
  });
  const rows: BatchRow[] = [];

  for (const transaction of transactions) {
    const evaluated = await evaluateTransactionForBackfill(transaction, options);

    if (!options.execute || evaluated.action !== "ready") {
      rows.push(evaluated);
      continue;
    }

    try {
      await calculateTransactionCommission({
        organizationId: organization.id,
        officeId: office?.id ?? transaction.officeId ?? null,
        transactionId: transaction.id,
        actorMembershipId: actorMembership?.id ?? ""
      });

      rows.push({
        ...evaluated,
        action: "calculated"
      });
    } catch (error) {
      rows.push({
        ...evaluated,
        action: "failed",
        blockers: [error instanceof Error ? error.message : "Failed to calculate transaction commission."]
      });
    }
  }

  return {
    mode: options.execute ? "execute" : "dry-run",
    organizationLabel: organization.name,
    officeLabel: office?.name ?? "All offices",
    transactionStatusesLabel:
      options.transactionIds.length > 0
        ? "explicit transaction ids"
        : options.allStatuses
          ? "all statuses"
          : options.statuses.join(","),
    totalTransactions: transactions.length,
    rows,
    summary: buildSummary(rows)
  };
}

function formatCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  if (entries.length === 0) {
    return "  none";
  }

  return entries.map(([label, count]) => `  ${count} - ${label}`).join("\n");
}

function formatRow(row: BatchRow) {
  const invoice = row.invoiceNumber || "no invoice";
  const blockers = row.blockers.length ? ` blockers=${row.blockers.join(" | ")}` : "";
  const warnings = row.warnings.length ? ` warnings=${row.warnings.join(" | ")}` : "";
  return `  [${row.action}] ${row.transactionLabel} (${row.status}, ${row.ownerLabel}, ${invoice})${blockers}${warnings}`;
}

function renderReport(report: BatchReport) {
  const skippedRows = report.rows.filter((row) => row.action === "skip" || row.action === "failed").slice(0, 25);
  const readyRows = report.rows.filter((row) => row.action === "ready" || row.action === "calculated").slice(0, 25);

  return [
    "Bulk commission calculation backfill",
    `Mode: ${report.mode}`,
    `Organization: ${report.organizationLabel}`,
    `Office scope: ${report.officeLabel}`,
    `Transaction status scope: ${report.transactionStatusesLabel}`,
    `Transactions scanned: ${report.totalTransactions}`,
    "",
    "Summary:",
    `  ready: ${report.summary.ready}`,
    `  calculated: ${report.summary.calculated}`,
    `  skipped: ${report.summary.skipped}`,
    `  failed: ${report.summary.failed}`,
    `  rows with warnings: ${report.summary.withWarnings}`,
    "",
    "Blockers:",
    formatCounts(report.summary.blockerCounts),
    "",
    "Warnings:",
    formatCounts(report.summary.warningCounts),
    "",
    "Ready/calculated sample:",
    readyRows.length ? readyRows.map(formatRow).join("\n") : "  none",
    "",
    "Skipped/failed sample:",
    skippedRows.length ? skippedRows.map(formatRow).join("\n") : "  none"
  ].join("\n");
}

async function main() {
  const options = readCliOptions(process.argv.slice(2));
  const report = await runBatch(options);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderReport(report));
}

void main()
  .catch((error) => {
    console.error("[backfill-commission-calculations] Failed.");
    console.error(error instanceof Error ? error.message : error);
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
