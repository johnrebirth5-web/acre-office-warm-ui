import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import {
  createContact,
  createTransaction,
  ensureBootstrapAdminAccount,
  linkContactToTransaction,
  mapLegacyImportedUserRole,
  normalizeLegacyImportNameForLookup,
  normalizeLegacyTransactionRow,
  previewResetOrganizationBusinessData,
  prisma,
  resetOrganizationBusinessData,
  splitImportedFullName,
  upsertImportedActiveUser,
} from "@acre/db";

type CommandName =
  | "analyze"
  | "reset-business-data"
  | "import-users"
  | "import-transactions"
  | "run";

type OfficeFileConfig = {
  officeSlug: "acre-nj-llc" | "acre-ny-realty" | "acre-ny-rental";
  officeLabel: string;
  fileName: string;
  kind: "users" | "transactions";
};

type ParsedArgs = {
  command: CommandName;
  execute: boolean;
  sourceDir: string;
  reportDir: string;
};

type OfficeContext = {
  id: string;
  name: string;
  slug: string;
  market: string;
  isPrimary: boolean;
};

type RuntimeContext = {
  organizationId: string;
  bootstrapMembershipId: string;
  officeBySlug: Map<string, OfficeContext>;
  sourceDir: string;
  reportDir: string;
};

type ImportedUserPlanEntry = {
  email: string;
  firstName: string;
  lastName: string;
  role: "agent" | "team_lead";
  officeSlug: OfficeFileConfig["officeSlug"];
  officeId: string;
  officeLabel: string;
  sourceFile: string;
  warnings: string[];
};

type ImportedUserIssue = {
  email: string;
  sourceFile: string;
  reason: string;
};

type ImportedUserPlan = {
  entries: ImportedUserPlanEntry[];
  issues: ImportedUserIssue[];
  countsByFile: Record<string, { rows: number; imported: number; issues: number }>;
};

type ImportedMembershipRecord = {
  membershipId: string;
  email: string;
  fullName: string;
  officeSlug: string;
};

type ContactCacheRecord = {
  id: string;
  fullName: string;
  email: string;
};

type TransactionReportRow = {
  officeSlug: string;
  sourceFile: string;
  sourceRowId: string;
  transactionName: string;
  reason: string;
};

type TransactionSuccessRow = {
  officeSlug: string;
  sourceFile: string;
  sourceRowId: string;
  transactionName: string;
  ownerEmail: string;
  warnings: string;
};

type ImportSummary = {
  analyze: {
    users: ImportedUserPlan;
    transactions: {
      totalRows: number;
      importableRows: number;
      skippedRows: number;
      warnings: number;
      countsByFile: Record<string, Record<string, number>>;
    };
  };
  resetPreview?: Awaited<ReturnType<typeof previewResetOrganizationBusinessData>>;
  userImport?: {
    imported: number;
    issues: ImportedUserIssue[];
  };
  transactionImport?: {
    imported: number;
    skipped: TransactionReportRow[];
    failed: TransactionReportRow[];
    successes: TransactionSuccessRow[];
  };
};

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const defaultSourceDirectory =
  "/Users/openclaw_john/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/veryjohn_99bc/msg/file/2026-04";
const defaultReportDirectory = resolve(repoRoot, ".local-storage/legacy-import-reports");
const userFileConfigs: OfficeFileConfig[] = [
  {
    officeSlug: "acre-nj-llc",
    officeLabel: "Acre NJ LLC",
    fileName: "ACRE_NJ_LLC_active_agents (1).csv",
    kind: "users",
  },
  {
    officeSlug: "acre-ny-realty",
    officeLabel: "Acre NY Realty",
    fileName: "ACRE_NY_REALTY_INC_active_agents (1).csv",
    kind: "users",
  },
  {
    officeSlug: "acre-ny-rental",
    officeLabel: "Acre NY Rental",
    fileName: "ACRE_NY_RENTALS_LLC_active_agents.csv",
    kind: "users",
  },
];
const transactionFileConfigs: OfficeFileConfig[] = [
  {
    officeSlug: "acre-nj-llc",
    officeLabel: "Acre NJ LLC",
    fileName: "acre nj report - 2026-04-16T112314.291.csv",
    kind: "transactions",
  },
  {
    officeSlug: "acre-ny-realty",
    officeLabel: "Acre NY Realty",
    fileName: "acre ny realty report - 2026-04-16T112134.861.csv",
    kind: "transactions",
  },
  {
    officeSlug: "acre-ny-rental",
    officeLabel: "Acre NY Rental",
    fileName: "acre ny rental report - 2026-04-16T112243.446.csv",
    kind: "transactions",
  },
];

function parseArgs(argv: string[]): ParsedArgs {
  const command = (argv[0] ?? "run") as CommandName;
  const supportedCommands = new Set<CommandName>([
    "analyze",
    "reset-business-data",
    "import-users",
    "import-transactions",
    "run",
  ]);

  if (!supportedCommands.has(command)) {
    throw new Error(`Unsupported command "${command}".`);
  }

  let sourceDir = process.env.ACRE_LEGACY_IMPORT_SOURCE_DIR ?? defaultSourceDirectory;
  let reportDir = process.env.ACRE_LEGACY_IMPORT_REPORT_DIR ?? defaultReportDirectory;
  let execute = false;

  for (const arg of argv.slice(1)) {
    if (arg === "--execute") {
      execute = true;
      continue;
    }

    if (arg === "--dry-run") {
      execute = false;
      continue;
    }

    if (arg.startsWith("--source-dir=")) {
      sourceDir = arg.slice("--source-dir=".length);
      continue;
    }

    if (arg.startsWith("--report-dir=")) {
      reportDir = arg.slice("--report-dir=".length);
      continue;
    }
  }

  return {
    command,
    execute,
    sourceDir,
    reportDir,
  };
}

function parseCsvString(contents: string) {
  const rows: string[][] = [];
  const text = contents.charCodeAt(0) === 0xfeff ? contents.slice(1) : contents;
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
          continue;
        }

        inQuotes = false;
        continue;
      }

      field += character;
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (character === "\r") {
      if (text[index + 1] === "\n") {
        index += 1;
      }

      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(
    (entry) => entry.length > 1 || entry.some((value) => value.trim().length > 0),
  );
}

async function readCsvFile(filePath: string) {
  const contents = await readFile(filePath, "utf8");
  const rows = parseCsvString(contents);

  if (rows.length === 0) {
    return [];
  }

  const [header, ...body] = rows;

  return body.map((row) =>
    Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])) as Record<string, string>,
  );
}

function escapeCsvValue(value: string) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function stringifyCsv(records: Array<Record<string, string>>) {
  if (records.length === 0) {
    return "";
  }

  const header = Object.keys(records[0] ?? {});
  const lines = [
    header.join(","),
    ...records.map((record) =>
      header.map((key) => escapeCsvValue(record[key] ?? "")).join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

async function buildRuntimeContext(args: ParsedArgs): Promise<RuntimeContext> {
  const bootstrap = await ensureBootstrapAdminAccount();

  if (!bootstrap.organizationId || !bootstrap.membershipId) {
    throw new Error("Bootstrap admin is required before running the legacy import.");
  }

  const organization = await prisma.organization.findUnique({
    where: {
      id: bootstrap.organizationId,
    },
    include: {
      offices: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      },
    },
  });

  if (!organization) {
    throw new Error("The Acre organization could not be found.");
  }

  const officeBySlug = new Map(
    organization.offices.map((office) => [
      office.slug,
      {
        id: office.id,
        name: office.name,
        slug: office.slug,
        market: office.market,
        isPrimary: office.isPrimary,
      } satisfies OfficeContext,
    ]),
  );

  for (const config of [...userFileConfigs, ...transactionFileConfigs]) {
    if (!officeBySlug.has(config.officeSlug)) {
      throw new Error(`Missing office slug "${config.officeSlug}" in organization ${organization.slug}.`);
    }
  }

  return {
    organizationId: organization.id,
    bootstrapMembershipId: bootstrap.membershipId,
    officeBySlug,
    sourceDir: args.sourceDir,
    reportDir: args.reportDir,
  };
}

async function buildUserImportPlan(context: RuntimeContext) {
  const entries: ImportedUserPlanEntry[] = [];
  const issues: ImportedUserIssue[] = [];
  const countsByFile: ImportedUserPlan["countsByFile"] = {};
  const emailOwner = new Map<string, ImportedUserPlanEntry>();

  for (const config of userFileConfigs) {
    const filePath = join(context.sourceDir, config.fileName);
    const rows = await readCsvFile(filePath);
    countsByFile[config.fileName] = {
      rows: rows.length,
      imported: 0,
      issues: 0,
    };

    for (const row of rows) {
      const email = (row.email ?? "").trim().toLowerCase();
      const rawName = (row.name ?? "").trim();
      const rawRole = (row.role ?? "").trim();
      const roleResult = mapLegacyImportedUserRole(rawRole);

      if (!email || !rawName || !roleResult.role) {
        issues.push({
          email,
          sourceFile: config.fileName,
          reason: !email
            ? "Email is required."
            : !rawName
              ? "Name is required."
              : roleResult.warning?.message ?? "Unsupported role.",
        });
        countsByFile[config.fileName].issues += 1;
        continue;
      }

      const office = context.officeBySlug.get(config.officeSlug);

      if (!office) {
        throw new Error(`Missing office context for slug ${config.officeSlug}.`);
      }

      const splitName = splitImportedFullName(rawName);
      const entry: ImportedUserPlanEntry = {
        email,
        firstName: splitName.firstName,
        lastName: splitName.lastName,
        role: roleResult.role,
        officeSlug: config.officeSlug,
        officeId: office.id,
        officeLabel: office.name,
        sourceFile: config.fileName,
        warnings: splitName.warnings.map((warning) => warning.message),
      };
      const existing = emailOwner.get(email);

      if (existing) {
        issues.push({
          email,
          sourceFile: config.fileName,
          reason: `Duplicate imported email already claimed by ${existing.sourceFile} (${existing.officeLabel}).`,
        });
        countsByFile[config.fileName].issues += 1;
        continue;
      }

      emailOwner.set(email, entry);
      entries.push(entry);
      countsByFile[config.fileName].imported += 1;
    }
  }

  return {
    entries,
    issues,
    countsByFile,
  } satisfies ImportedUserPlan;
}

function buildImportedMembershipIndex(records: ImportedMembershipRecord[]) {
  const officeMap = new Map<string, Map<string, ImportedMembershipRecord[]>>();

  for (const record of records) {
    const officeIndex = officeMap.get(record.officeSlug) ?? new Map<string, ImportedMembershipRecord[]>();
    const normalizedName = normalizeLegacyImportNameForLookup(record.fullName);
    const existing = officeIndex.get(normalizedName) ?? [];

    existing.push(record);
    officeIndex.set(normalizedName, existing);
    officeMap.set(record.officeSlug, officeIndex);
  }

  return officeMap;
}

function summarizeTransactionStatuses(rows: Record<string, string>[]) {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const status = (row.status ?? "").trim().toLowerCase() || "(blank)";
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return counts;
}

async function analyzeTransactions(context: RuntimeContext) {
  const countsByFile: Record<string, Record<string, number>> = {};
  let totalRows = 0;
  let importableRows = 0;
  let skippedRows = 0;
  let warnings = 0;

  for (const config of transactionFileConfigs) {
    const filePath = join(context.sourceDir, config.fileName);
    const rows = await readCsvFile(filePath);
    countsByFile[config.fileName] = summarizeTransactionStatuses(rows);

    totalRows += rows.length;

    for (const row of rows) {
      const normalized = normalizeLegacyTransactionRow(row);

      if (normalized.shouldImport) {
        importableRows += 1;
      } else {
        skippedRows += 1;
      }

      warnings += normalized.warnings.length;
    }
  }

  return {
    totalRows,
    importableRows,
    skippedRows,
    warnings,
    countsByFile,
  };
}

async function executeUserImport(
  context: RuntimeContext,
  plan: ImportedUserPlan,
) {
  const imported: ImportedMembershipRecord[] = [];

  for (const entry of plan.entries) {
    const saved = await upsertImportedActiveUser({
      organizationId: context.organizationId,
      actorMembershipId: context.bootstrapMembershipId,
      viewerOfficeId: entry.officeId,
      email: entry.email,
      firstName: entry.firstName,
      lastName: entry.lastName,
      role: entry.role,
      defaultOfficeId: entry.officeId,
      accessibleOfficeIds: [entry.officeId],
      title: null,
      initialPassword: "Acreny2026",
    });

    imported.push({
      membershipId: saved.membershipId,
      email: entry.email,
      fullName: `${entry.firstName} ${entry.lastName}`.trim(),
      officeSlug: entry.officeSlug,
    });
  }

  return imported;
}

function simulateUserImport(plan: ImportedUserPlan) {
  return plan.entries.map((entry) => ({
    membershipId: `dry-run:${entry.officeSlug}:${entry.email}`,
    email: entry.email,
    fullName: `${entry.firstName} ${entry.lastName}`.trim(),
    officeSlug: entry.officeSlug,
  })) satisfies ImportedMembershipRecord[];
}

async function loadImportedUsersFromDatabase(
  context: RuntimeContext,
  plan: ImportedUserPlan,
) {
  const plannedEntriesByEmail = new Map(plan.entries.map((entry) => [entry.email, entry]));
  const rows = await prisma.membership.findMany({
    where: {
      organizationId: context.organizationId,
      user: {
        email: {
          in: [...plannedEntriesByEmail.keys()],
        },
      },
    },
    include: {
      user: true,
      office: true,
    },
  });
  const imported = rows.flatMap((row) => {
    const planned = plannedEntriesByEmail.get(row.user.email);

    if (!planned || !row.office || row.office.slug !== planned.officeSlug) {
      return [];
    }

    return [
      {
        membershipId: row.id,
        email: row.user.email,
        fullName: `${row.user.firstName} ${row.user.lastName}`.trim(),
        officeSlug: planned.officeSlug,
      } satisfies ImportedMembershipRecord,
    ];
  });

  const importedEmails = new Set(imported.map((entry) => entry.email));
  const missingEmails = plan.entries
    .map((entry) => entry.email)
    .filter((email) => !importedEmails.has(email));

  if (missingEmails.length > 0) {
    throw new Error(
      `Imported users are missing in the database for ${missingEmails.length} planned email(s): ${missingEmails.slice(0, 10).join(", ")}${missingEmails.length > 10 ? ", ..." : ""}.`,
    );
  }

  return imported;
}

type ContactCache = {
  byEmail: Map<string, ContactCacheRecord[]>;
  byName: Map<string, ContactCacheRecord[]>;
};

function addContactToCache(cache: ContactCache, contact: ContactCacheRecord) {
  const normalizedEmail = contact.email ? contact.email.trim().toLowerCase() : "";
  const normalizedName = normalizeLegacyImportNameForLookup(contact.fullName);

  if (normalizedEmail) {
    const emailMatches = cache.byEmail.get(normalizedEmail) ?? [];

    emailMatches.push(contact);
    cache.byEmail.set(normalizedEmail, emailMatches);
  }

  if (normalizedName) {
    const nameMatches = cache.byName.get(normalizedName) ?? [];

    nameMatches.push(contact);
    cache.byName.set(normalizedName, nameMatches);
  }
}

async function loadContactCache(organizationId: string) {
  const clients = await prisma.client.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });
  const cache: ContactCache = {
    byEmail: new Map(),
    byName: new Map(),
  };

  for (const client of clients) {
    addContactToCache(cache, {
      id: client.id,
      fullName: client.fullName,
      email: client.email ?? "",
    });
  }

  return cache;
}

function resolveOwnerMatch(
  officeSlug: string,
  normalizedRow: LegacyNormalizedTransactionRow,
  ownerIndex: ReturnType<typeof buildImportedMembershipIndex>,
) {
  const officeOwners = ownerIndex.get(officeSlug) ?? new Map<string, ImportedMembershipRecord[]>();

  for (const candidate of normalizedRow.ownerCandidateNames) {
    const normalizedCandidate = normalizeLegacyImportNameForLookup(candidate);
    const matches = officeOwners.get(normalizedCandidate) ?? [];

    if (matches.length === 1) {
      return {
        ok: true as const,
        owner: matches[0],
      };
    }

    if (matches.length > 1) {
      return {
        ok: false as const,
        reason: `Owner candidate "${candidate}" matched multiple imported users in ${officeSlug}.`,
      };
    }
  }

  return {
    ok: false as const,
    reason: normalizedRow.ownerCandidateNames.length
      ? `No imported owner matched ${normalizedRow.ownerCandidateNames.join(" / ")}.`
      : "No owner candidate columns were available.",
  };
}

async function resolveOrCreateContact(
  cache: ContactCache,
  normalizedRow: LegacyNormalizedTransactionRow,
  input: {
    organizationId: string;
    ownerMembershipId: string;
    actorMembershipId: string;
    officeId: string;
    execute: boolean;
  },
) {
  const email = normalizedRow.contactMatchInput.clientEmail.trim().toLowerCase();
  const clientNameKey = normalizeLegacyImportNameForLookup(normalizedRow.contactMatchInput.clientName);
  const buyerTenantKey = normalizeLegacyImportNameForLookup(normalizedRow.contactMatchInput.buyerTenant);

  if (email) {
    const emailMatches = cache.byEmail.get(email) ?? [];

    if (emailMatches.length === 1) {
      return {
        id: emailMatches[0].id,
        created: false,
      };
    }
  }

  if (clientNameKey) {
    const nameMatches = cache.byName.get(clientNameKey) ?? [];

    if (nameMatches.length === 1) {
      return {
        id: nameMatches[0].id,
        created: false,
      };
    }
  }

  if (buyerTenantKey) {
    const tenantMatches = cache.byName.get(buyerTenantKey) ?? [];

    if (tenantMatches.length === 1) {
      return {
        id: tenantMatches[0].id,
        created: false,
      };
    }
  }

  const createName = normalizedRow.contactMatchInput.preferredCreateName.trim();

  if (!createName && !email) {
    return null;
  }

  if (!input.execute) {
    return {
      id: `dry-run:contact:${createName || email}`,
      created: true,
    };
  }

  const created = await createContact({
    organizationId: input.organizationId,
    ownerMembershipId: input.ownerMembershipId,
    actorMembershipId: input.actorMembershipId,
    actorOfficeId: input.officeId,
    fullName: createName || email,
    email: email || undefined,
    source: "Legacy transaction import",
    stage: "Imported",
    intent: "Unknown",
  });

  addContactToCache(cache, {
    id: created.id,
    fullName: created.fullName,
    email: created.email ?? "",
  });

  return {
    id: created.id,
    created: true,
  };
}

async function executeTransactionImport(
  context: RuntimeContext,
  ownerRecords: ImportedMembershipRecord[],
  execute: boolean,
) {
  const ownerIndex = buildImportedMembershipIndex(ownerRecords);
  const contactCache = execute
    ? await loadContactCache(context.organizationId)
    : {
        byEmail: new Map<string, ContactCacheRecord[]>(),
        byName: new Map<string, ContactCacheRecord[]>(),
      };
  const skipped: TransactionReportRow[] = [];
  const failed: TransactionReportRow[] = [];
  const successes: TransactionSuccessRow[] = [];

  for (const config of transactionFileConfigs) {
    const filePath = join(context.sourceDir, config.fileName);
    const rows = await readCsvFile(filePath);
    const office = context.officeBySlug.get(config.officeSlug);

    if (!office) {
      throw new Error(`Missing office context for slug ${config.officeSlug}.`);
    }

    for (const row of rows) {
      const normalized = normalizeLegacyTransactionRow(row);
      const warnings = normalized.warnings.map((warning) => warning.message);

      if (!normalized.shouldImport) {
        skipped.push({
          officeSlug: config.officeSlug,
          sourceFile: config.fileName,
          sourceRowId: normalized.sourceRowId,
          transactionName: normalized.createInput.transactionName,
          reason: normalized.skipReason ?? "Skipped by import filter.",
        });
        continue;
      }

      const ownerMatch = resolveOwnerMatch(config.officeSlug, normalized, ownerIndex);

      if (!ownerMatch.ok) {
        failed.push({
          officeSlug: config.officeSlug,
          sourceFile: config.fileName,
          sourceRowId: normalized.sourceRowId,
          transactionName: normalized.createInput.transactionName,
          reason: ownerMatch.reason,
        });
        continue;
      }

      const contact = await resolveOrCreateContact(contactCache, normalized, {
        organizationId: context.organizationId,
        ownerMembershipId: ownerMatch.owner.membershipId,
        actorMembershipId: context.bootstrapMembershipId,
        officeId: office.id,
        execute,
      });

      if (!contact) {
        warnings.push("No contact identifiers were available, so no contact link was created.");
      }

      if (execute) {
        const transaction = await createTransaction({
          organizationId: context.organizationId,
          officeId: office.id,
          ownerMembershipId: ownerMatch.owner.membershipId,
          actorMembershipId: context.bootstrapMembershipId,
          ...normalized.createInput,
        });

        if (contact) {
          await linkContactToTransaction(context.organizationId, contact.id, transaction.id, {
            actorMembershipId: context.bootstrapMembershipId,
            isPrimary: true,
          });
        }
      }

      successes.push({
        officeSlug: config.officeSlug,
        sourceFile: config.fileName,
        sourceRowId: normalized.sourceRowId,
        transactionName: normalized.createInput.transactionName,
        ownerEmail: ownerMatch.owner.email,
        warnings: warnings.join(" | "),
      });
    }
  }

  return {
    imported: successes.length,
    skipped,
    failed,
    successes,
  };
}

async function writeSummaryReport(
  args: ParsedArgs,
  summary: ImportSummary,
) {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const targetDir = resolve(args.reportDir, stamp);

  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  if (summary.transactionImport) {
    await writeFile(
      join(targetDir, "transaction-skipped.csv"),
      stringifyCsv(summary.transactionImport.skipped.map((entry) => ({
        officeSlug: entry.officeSlug,
        sourceFile: entry.sourceFile,
        sourceRowId: entry.sourceRowId,
        transactionName: entry.transactionName,
        reason: entry.reason,
      }))),
      "utf8",
    );
    await writeFile(
      join(targetDir, "transaction-failed.csv"),
      stringifyCsv(summary.transactionImport.failed.map((entry) => ({
        officeSlug: entry.officeSlug,
        sourceFile: entry.sourceFile,
        sourceRowId: entry.sourceRowId,
        transactionName: entry.transactionName,
        reason: entry.reason,
      }))),
      "utf8",
    );
    await writeFile(
      join(targetDir, "transaction-success.csv"),
      stringifyCsv(summary.transactionImport.successes.map((entry) => ({
        officeSlug: entry.officeSlug,
        sourceFile: entry.sourceFile,
        sourceRowId: entry.sourceRowId,
        transactionName: entry.transactionName,
        ownerEmail: entry.ownerEmail,
        warnings: entry.warnings,
      }))),
      "utf8",
    );
  }

  await writeFile(
    join(targetDir, "user-issues.csv"),
    stringifyCsv(
      summary.analyze.users.issues.map((entry) => ({
        email: entry.email,
        sourceFile: entry.sourceFile,
        reason: entry.reason,
      })),
    ),
    "utf8",
  );

  return targetDir;
}

function printSummary(args: ParsedArgs, summary: ImportSummary, reportDir: string) {
  console.log(`Command: ${args.command}`);
  console.log(`Mode: ${args.execute ? "execute" : "dry-run"}`);
  console.log(`Source dir: ${args.sourceDir}`);
  console.log(`Report dir: ${reportDir}`);
  console.log("");
  console.log("User files:");

  for (const [fileName, counts] of Object.entries(summary.analyze.users.countsByFile)) {
    console.log(`- ${fileName}: rows=${counts.rows}, imported=${counts.imported}, issues=${counts.issues}`);
  }

  console.log("");
  console.log("Transaction files:");

  for (const [fileName, counts] of Object.entries(summary.analyze.transactions.countsByFile)) {
    const line = Object.entries(counts)
      .map(([status, count]) => `${status}=${count}`)
      .join(", ");
    console.log(`- ${fileName}: ${line}`);
  }

  console.log("");
  console.log(
    `Transactions: total=${summary.analyze.transactions.totalRows}, importable=${summary.analyze.transactions.importableRows}, skipped=${summary.analyze.transactions.skippedRows}, warnings=${summary.analyze.transactions.warnings}`,
  );

  if (summary.resetPreview) {
    console.log("");
    console.log(
      `Reset preview: memberships=${summary.resetPreview.counts.memberships}, users=${summary.resetPreview.counts.users}, contacts=${summary.resetPreview.counts.contacts}, transactions=${summary.resetPreview.counts.transactions}`,
    );
  }

  if (summary.userImport) {
    console.log("");
    console.log(`Imported users: ${summary.userImport.imported}`);
  }

  if (summary.transactionImport) {
    console.log("");
    console.log(
      `Imported transactions: ${summary.transactionImport.imported}, skipped=${summary.transactionImport.skipped.length}, failed=${summary.transactionImport.failed.length}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await buildRuntimeContext(args);
  const userPlan = await buildUserImportPlan(context);
  const transactionAnalyze = await analyzeTransactions(context);

  const summary: ImportSummary = {
    analyze: {
      users: userPlan,
      transactions: transactionAnalyze,
    },
  };

  if (args.command === "analyze") {
    summary.resetPreview = await previewResetOrganizationBusinessData({
      organizationId: context.organizationId,
      preserveMembershipIds: [context.bootstrapMembershipId],
    });
    summary.userImport = {
      imported: userPlan.entries.length,
      issues: userPlan.issues,
    };
    summary.transactionImport = await executeTransactionImport(
      context,
      simulateUserImport(userPlan),
      false,
    );
    const reportDir = await writeSummaryReport(args, summary);

    printSummary(args, summary, reportDir);
    return;
  }

  if (args.command === "reset-business-data" || args.command === "run") {
    summary.resetPreview = await previewResetOrganizationBusinessData({
      organizationId: context.organizationId,
      preserveMembershipIds: [context.bootstrapMembershipId],
    });

    if (args.execute) {
      await resetOrganizationBusinessData({
        organizationId: context.organizationId,
        preserveMembershipIds: [context.bootstrapMembershipId],
      });
    }
  }

  let importedUsers = simulateUserImport(userPlan);

  if (args.command === "import-users" || args.command === "run") {
    if (args.execute) {
      importedUsers = await executeUserImport(context, userPlan);
    }

    summary.userImport = {
      imported: importedUsers.length,
      issues: userPlan.issues,
    };
  }

  if (args.command === "import-transactions" || args.command === "run") {
    if (args.execute && args.command === "import-transactions") {
      importedUsers = await loadImportedUsersFromDatabase(context, userPlan);
    }

    summary.transactionImport = await executeTransactionImport(
      context,
      importedUsers,
      args.execute,
    );
  }

  const reportDir = await writeSummaryReport(args, summary);

  printSummary(args, summary, reportDir);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
