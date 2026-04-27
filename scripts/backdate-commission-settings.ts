#!/usr/bin/env tsx

import { Prisma, type MembershipCommissionSetting, type TransactionStatus } from "@prisma/client";
import { prisma } from "@acre/db";

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
  transactionIds: string[];
  statuses: TransactionStatus[];
  allStatuses: boolean;
  includeExistingCalculations: boolean;
  targetEffectiveFrom?: Date;
  currentEffectiveFrom?: Date;
  limit?: number;
  execute: boolean;
  json: boolean;
};

type TransactionSubject = Prisma.TransactionGetPayload<{
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
  };
}>;

type SettingCandidate = {
  settingId: string;
  membershipId: string;
  membershipLabel: string;
  officeLabel: string;
  currentEffectiveFrom: string;
  targetEffectiveFrom: string;
  agentPercent: string;
  impactedTransactionCount: number;
  earliestTransactionCreatedAt: string;
  latestTransactionCreatedAt: string;
  sampleTransactions: string[];
  action: "ready" | "updated" | "skip";
  blockers: string[];
  warnings: string[];
};

type SkippedTransaction = {
  transactionId: string;
  transactionLabel: string;
  ownerLabel: string;
  createdAt: string;
  reason: string;
};

type Report = {
  mode: "dry-run" | "execute";
  organizationLabel: string;
  officeLabel: string;
  transactionStatusesLabel: string;
  targetEffectiveFrom: string;
  scannedTransactions: number;
  alreadyCoveredTransactions: number;
  candidateSettings: SettingCandidate[];
  skippedTransactions: SkippedTransaction[];
  summary: {
    readySettings: number;
    updatedSettings: number;
    blockedSettings: number;
    impactedTransactions: number;
    skippedTransactions: number;
    blockerCounts: Record<string, number>;
    skipReasonCounts: Record<string, number>;
  };
};

function readCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    transactionIds: [],
    statuses: [...defaultTransactionStatuses],
    allStatuses: false,
    includeExistingCalculations: false,
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

    if (value === "--all-statuses") {
      options.allStatuses = true;
      continue;
    }

    if (value === "--include-existing-calculations") {
      options.includeExistingCalculations = true;
      continue;
    }

    if (value === "--target-effective-from") {
      options.targetEffectiveFrom = parseDateOnly(argv[++index], "--target-effective-from");
      continue;
    }

    if (value === "--current-effective-from") {
      options.currentEffectiveFrom = parseDateOnly(argv[++index], "--current-effective-from");
      continue;
    }

    if (value === "--limit") {
      options.limit = parsePositiveInteger(argv[++index], "--limit");
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

function parseDateOnly(value: string | undefined, label: string) {
  const normalized = value?.trim();

  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }

  return new Date(`${normalized}T00:00:00.000Z`);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: Date) {
  return value.toISOString();
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function printUsage() {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/backdate-commission-settings.ts --organization-slug acre --office-slug acre-ny-realty --dry-run",
      "  npx tsx scripts/backdate-commission-settings.ts --organization-slug acre --office-slug acre-ny-realty --target-effective-from 2026-04-21 --current-effective-from 2026-04-22 --execute",
      "",
      "Safe default:",
      "  The script runs in dry-run mode unless --execute is passed.",
      "",
      "Required scope:",
      "  --organization-id <id> | --organization-slug <slug>",
      "  --office-id <id> | --office-slug <slug>",
      "",
      "Filters:",
      "  --status pending,closed              Transaction statuses to scan. Defaults to pending,closed.",
      "  --all-statuses                       Scan all transaction statuses.",
      "  --transaction-id <id>                Scan one transaction id. Can be repeated.",
      "  --transaction-ids <id,id>            Scan multiple transaction ids.",
      "  --include-existing-calculations      Include transactions that already have commission rows.",
      "  --current-effective-from YYYY-MM-DD  Only update settings currently starting on this date.",
      "  --limit <n>                          Limit scanned transactions.",
      "",
      "Execution:",
      "  --target-effective-from YYYY-MM-DD   Required for --execute. Dry-run derives the earliest needed date when omitted.",
      "  --execute                            Update ready MembershipCommissionSetting rows.",
      "  --json                               Print the full machine-readable report.",
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

  throw new Error("Pass --organization-id or --organization-slug.");
}

async function resolveOffice(options: CliOptions, organizationId: string) {
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

  throw new Error("Pass --office-id or --office-slug.");
}

function buildTransactionWhere(input: {
  organizationId: string;
  officeId: string;
  options: CliOptions;
}) {
  return {
    organizationId: input.organizationId,
    OR: [{ officeId: input.officeId }, { officeId: null }],
    ownerMembershipId: {
      not: null
    },
    ...(input.options.includeExistingCalculations
      ? {}
      : {
          commissionCalculations: {
            none: {}
          }
        }),
    ...(input.options.transactionIds.length > 0
      ? {
          id: {
            in: input.options.transactionIds
          }
        }
      : input.options.allStatuses
        ? {}
        : {
            status: {
              in: input.options.statuses
            }
          })
  } satisfies Prisma.TransactionWhereInput;
}

function buildTransactionLabel(transaction: TransactionSubject) {
  return [transaction.title, transaction.address, transaction.city, transaction.state]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" | ");
}

function buildMembershipLabel(membership: TransactionSubject["ownerMembership"]) {
  if (!membership) {
    return "Unassigned";
  }

  return `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email;
}

function settingMatchesOffice(setting: Pick<MembershipCommissionSetting, "officeId">, officeId: string) {
  return setting.officeId === officeId || setting.officeId === null;
}

function isSettingActiveAt(setting: Pick<MembershipCommissionSetting, "effectiveFrom" | "effectiveTo">, date: Date) {
  return setting.effectiveFrom <= date && (!setting.effectiveTo || setting.effectiveTo >= date);
}

function sortFutureSettings(left: MembershipCommissionSetting, right: MembershipCommissionSetting, officeId: string) {
  if (left.effectiveFrom.getTime() !== right.effectiveFrom.getTime()) {
    return left.effectiveFrom.getTime() - right.effectiveFrom.getTime();
  }

  const leftSpecific = left.officeId === officeId ? 0 : 1;
  const rightSpecific = right.officeId === officeId ? 0 : 1;

  if (leftSpecific !== rightSpecific) {
    return leftSpecific - rightSpecific;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function addCount(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

function buildCandidateForSetting(input: {
  setting: MembershipCommissionSetting;
  transactions: TransactionSubject[];
  targetEffectiveFrom: Date;
  currentEffectiveFrom?: Date;
  exactScopeSettings: MembershipCommissionSetting[];
  officeLabel: string;
}): SettingCandidate {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const sortedTransactions = [...input.transactions].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const earliestTransaction = sortedTransactions[0];
  const latestTransaction = sortedTransactions[sortedTransactions.length - 1] ?? earliestTransaction;

  if (!earliestTransaction || !latestTransaction) {
    blockers.push("No impacted transactions were found for this setting.");
  }

  if (input.currentEffectiveFrom && formatDate(input.setting.effectiveFrom) !== formatDate(input.currentEffectiveFrom)) {
    blockers.push(`Current setting effectiveFrom is ${formatDate(input.setting.effectiveFrom)}, not ${formatDate(input.currentEffectiveFrom)}.`);
  }

  if (input.targetEffectiveFrom >= input.setting.effectiveFrom) {
    blockers.push("Target effectiveFrom is not earlier than the current setting start date.");
  }

  if (earliestTransaction && input.targetEffectiveFrom > earliestTransaction.createdAt) {
    blockers.push("Target effectiveFrom is later than at least one impacted transaction createdAt.");
  }

  if (input.setting.effectiveTo && input.targetEffectiveFrom > input.setting.effectiveTo) {
    blockers.push("Target effectiveFrom is later than this setting effectiveTo.");
  }

  const overlappingExactScopeSetting = input.exactScopeSettings.find(
    (setting) => setting.id !== input.setting.id && isSettingActiveAt(setting, input.targetEffectiveFrom)
  );

  if (overlappingExactScopeSetting) {
    blockers.push(`Another same-scope setting is already active on ${formatDate(input.targetEffectiveFrom)}.`);
  }

  const sampleTransactions = sortedTransactions.slice(0, 5).map((transaction) => buildTransactionLabel(transaction));
  const membershipLabel = buildMembershipLabel(earliestTransaction?.ownerMembership ?? null);

  return {
    settingId: input.setting.id,
    membershipId: input.setting.membershipId,
    membershipLabel,
    officeLabel: input.officeLabel,
    currentEffectiveFrom: formatDate(input.setting.effectiveFrom),
    targetEffectiveFrom: formatDate(input.targetEffectiveFrom),
    agentPercent: String(input.setting.agentPercent),
    impactedTransactionCount: input.transactions.length,
    earliestTransactionCreatedAt: earliestTransaction ? formatDateTime(earliestTransaction.createdAt) : "",
    latestTransactionCreatedAt: latestTransaction ? formatDateTime(latestTransaction.createdAt) : "",
    sampleTransactions,
    action: blockers.length > 0 ? "skip" : "ready",
    blockers,
    warnings
  };
}

async function runBackdate(options: CliOptions): Promise<Report> {
  if (options.execute && !options.targetEffectiveFrom) {
    throw new Error("--execute requires --target-effective-from.");
  }

  const organization = await resolveOrganization(options);
  const office = await resolveOffice(options, organization.id);
  const transactions = await prisma.transaction.findMany({
    where: buildTransactionWhere({
      organizationId: organization.id,
      officeId: office.id,
      options
    }),
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
      }
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(options.limit ? { take: options.limit } : {})
  });
  const ownerMembershipIds = Array.from(new Set(transactions.map((transaction) => transaction.ownerMembershipId).filter(Boolean))) as string[];
  const settings = ownerMembershipIds.length
    ? await prisma.membershipCommissionSetting.findMany({
        where: {
          organizationId: organization.id,
          membershipId: {
            in: ownerMembershipIds
          },
          OR: [{ officeId: office.id }, { officeId: null }]
        },
        orderBy: [{ effectiveFrom: "asc" }, { updatedAt: "desc" }]
      })
    : [];
  const settingsByMembershipId = new Map<string, MembershipCommissionSetting[]>();

  for (const setting of settings) {
    const current = settingsByMembershipId.get(setting.membershipId) ?? [];
    current.push(setting);
    settingsByMembershipId.set(setting.membershipId, current);
  }

  let alreadyCoveredTransactions = 0;
  const skippedTransactions: SkippedTransaction[] = [];
  const impactedTransactionsBySettingId = new Map<string, TransactionSubject[]>();
  const settingById = new Map(settings.map((setting) => [setting.id, setting]));

  for (const transaction of transactions) {
    const ownerMembershipId = transaction.ownerMembershipId;

    if (!ownerMembershipId) {
      skippedTransactions.push({
        transactionId: transaction.id,
        transactionLabel: buildTransactionLabel(transaction),
        ownerLabel: "Unassigned",
        createdAt: formatDateTime(transaction.createdAt),
        reason: "Missing transaction owner membership."
      });
      continue;
    }

    const ownerSettings = (settingsByMembershipId.get(ownerMembershipId) ?? []).filter((setting) =>
      settingMatchesOffice(setting, office.id)
    );
    const activeAtCreated = ownerSettings.find((setting) => isSettingActiveAt(setting, transaction.createdAt));

    if (activeAtCreated) {
      alreadyCoveredTransactions += 1;
      continue;
    }

    const futureSetting = ownerSettings
      .filter((setting) => setting.effectiveFrom > transaction.createdAt)
      .sort((left, right) => sortFutureSettings(left, right, office.id))[0];

    if (!futureSetting) {
      skippedTransactions.push({
        transactionId: transaction.id,
        transactionLabel: buildTransactionLabel(transaction),
        ownerLabel: buildMembershipLabel(transaction.ownerMembership),
        createdAt: formatDateTime(transaction.createdAt),
        reason: "No current or future commission setting was found for the transaction owner."
      });
      continue;
    }

    const impactedTransactions = impactedTransactionsBySettingId.get(futureSetting.id) ?? [];
    impactedTransactions.push(transaction);
    impactedTransactionsBySettingId.set(futureSetting.id, impactedTransactions);
  }

  const earliestImpactedCreatedAt = Array.from(impactedTransactionsBySettingId.values())
    .flat()
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0]?.createdAt;
  const targetEffectiveFrom =
    options.targetEffectiveFrom ?? (earliestImpactedCreatedAt ? startOfUtcDay(earliestImpactedCreatedAt) : startOfUtcDay(new Date()));
  const candidateSettings = Array.from(impactedTransactionsBySettingId.entries())
    .map(([settingId, impactedTransactions]) => {
      const setting = settingById.get(settingId);

      if (!setting) {
        throw new Error(`Internal error: missing setting ${settingId}`);
      }

      return buildCandidateForSetting({
        setting,
        transactions: impactedTransactions,
        targetEffectiveFrom,
        currentEffectiveFrom: options.currentEffectiveFrom,
        exactScopeSettings: (settingsByMembershipId.get(setting.membershipId) ?? []).filter(
          (candidate) => candidate.officeId === setting.officeId
        ),
        officeLabel: setting.officeId === null ? "All offices" : office.name
      });
    })
    .sort((left, right) => left.membershipLabel.localeCompare(right.membershipLabel));

  if (options.execute) {
    const readyCandidates = candidateSettings.filter((candidate) => candidate.action === "ready");

    await prisma.$transaction(async (tx) => {
      for (const candidate of readyCandidates) {
        await tx.membershipCommissionSetting.update({
          where: {
            id: candidate.settingId
          },
          data: {
            effectiveFrom: targetEffectiveFrom
          }
        });
      }
    });

    for (const candidate of readyCandidates) {
      candidate.action = "updated";
    }
  }

  const blockerCounts: Record<string, number> = {};
  const skipReasonCounts: Record<string, number> = {};

  for (const candidate of candidateSettings) {
    for (const blocker of candidate.blockers) {
      addCount(blockerCounts, blocker);
    }
  }

  for (const skippedTransaction of skippedTransactions) {
    addCount(skipReasonCounts, skippedTransaction.reason);
  }

  return {
    mode: options.execute ? "execute" : "dry-run",
    organizationLabel: organization.name,
    officeLabel: office.name,
    transactionStatusesLabel:
      options.transactionIds.length > 0
        ? "explicit transaction ids"
        : options.allStatuses
          ? "all statuses"
          : options.statuses.join(","),
    targetEffectiveFrom: formatDate(targetEffectiveFrom),
    scannedTransactions: transactions.length,
    alreadyCoveredTransactions,
    candidateSettings,
    skippedTransactions,
    summary: {
      readySettings: candidateSettings.filter((candidate) => candidate.action === "ready").length,
      updatedSettings: candidateSettings.filter((candidate) => candidate.action === "updated").length,
      blockedSettings: candidateSettings.filter((candidate) => candidate.action === "skip").length,
      impactedTransactions: candidateSettings.reduce((sum, candidate) => sum + candidate.impactedTransactionCount, 0),
      skippedTransactions: skippedTransactions.length,
      blockerCounts,
      skipReasonCounts
    }
  };
}

function renderCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  if (entries.length === 0) {
    return "  none";
  }

  return entries.map(([label, count]) => `  ${count} - ${label}`).join("\n");
}

function renderCandidate(candidate: SettingCandidate) {
  const blockers = candidate.blockers.length ? ` blockers=${candidate.blockers.join(" | ")}` : "";
  const warnings = candidate.warnings.length ? ` warnings=${candidate.warnings.join(" | ")}` : "";
  return `  [${candidate.action}] ${candidate.membershipLabel} ${candidate.agentPercent}% ${candidate.currentEffectiveFrom} -> ${candidate.targetEffectiveFrom} (${candidate.impactedTransactionCount} tx)${blockers}${warnings}`;
}

function renderSkippedTransaction(skippedTransaction: SkippedTransaction) {
  return `  ${skippedTransaction.transactionLabel} (${skippedTransaction.ownerLabel}, ${skippedTransaction.createdAt}) reason=${skippedTransaction.reason}`;
}

function renderReport(report: Report) {
  const candidateSample = report.candidateSettings.slice(0, 25);
  const skippedSample = report.skippedTransactions.slice(0, 25);

  return [
    "Commission setting effectiveFrom backdate",
    `Mode: ${report.mode}`,
    `Organization: ${report.organizationLabel}`,
    `Office scope: ${report.officeLabel}`,
    `Transaction status scope: ${report.transactionStatusesLabel}`,
    `Target effectiveFrom: ${report.targetEffectiveFrom}`,
    `Transactions scanned: ${report.scannedTransactions}`,
    `Transactions already covered by an active setting: ${report.alreadyCoveredTransactions}`,
    "",
    "Summary:",
    `  ready settings: ${report.summary.readySettings}`,
    `  updated settings: ${report.summary.updatedSettings}`,
    `  blocked settings: ${report.summary.blockedSettings}`,
    `  impacted transactions: ${report.summary.impactedTransactions}`,
    `  skipped transactions: ${report.summary.skippedTransactions}`,
    "",
    "Setting blockers:",
    renderCounts(report.summary.blockerCounts),
    "",
    "Skipped transaction reasons:",
    renderCounts(report.summary.skipReasonCounts),
    "",
    "Candidate settings sample:",
    candidateSample.length ? candidateSample.map(renderCandidate).join("\n") : "  none",
    "",
    "Skipped transactions sample:",
    skippedSample.length ? skippedSample.map(renderSkippedTransaction).join("\n") : "  none"
  ].join("\n");
}

async function main() {
  const options = readCliOptions(process.argv.slice(2));
  const report = await runBackdate(options);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderReport(report));
}

void main()
  .catch((error) => {
    console.error("[backdate-commission-settings] Failed.");
    console.error(error instanceof Error ? error.message : error);
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
