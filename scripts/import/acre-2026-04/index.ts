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
  saveAgentProfile,
  splitImportedFullName,
  upsertImportedActiveUser,
} from "@acre/db";
import { resolveAgentOfficeProfileFields } from "../../../packages/db/src/agent-office-profiles";
import {
  aggregateSupplementalRows,
  appendSupplementalNote,
  buildSupplementalWorkbookExportUrl,
  parseSupplementalWorkbook,
  type SupplementalAggregatedUser,
} from "./supplemental";

type CommandName =
  | "analyze"
  | "reset-business-data"
  | "import-users"
  | "import-user-supplemental"
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
  supplementalSheetUrl: string;
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
  defaultOfficeSlug: OfficeFileConfig["officeSlug"];
  defaultOfficeId: string;
  defaultOfficeLabel: string;
  accessibleOfficeSlugs: OfficeFileConfig["officeSlug"][];
  accessibleOfficeIds: string[];
  accessibleOfficeLabels: string[];
  sourceFiles: string[];
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
  officeSlugs: string[];
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

type SupplementalImportSheetCount = {
  rows: number;
  groupedUsers: number;
  imported: number;
  skipped: number;
  failed: number;
};

type SupplementalImportSkippedRow = {
  officeSlug: string;
  sheetName: string;
  userName: string;
  sourceRows: string;
  reason: string;
};

type SupplementalImportFailedRow = SupplementalImportSkippedRow;

type SupplementalImportSuccessRow = {
  officeSlug: string;
  sheetName: string;
  userName: string;
  sourceRows: string;
  membershipId: string;
  membershipEmail: string;
  splitPercent: string;
  licenseState: string;
  expirationDate: string;
  profileUpdated: string;
  commissionUpdated: string;
  noteUpdated: string;
};

type SupplementalImportResult = {
  sourceUrl: string;
  skippedByConfiguration: boolean;
  reason: string;
  imported: number;
  skipped: SupplementalImportSkippedRow[];
  failed: SupplementalImportFailedRow[];
  successes: SupplementalImportSuccessRow[];
  countsBySheet: Record<string, SupplementalImportSheetCount>;
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
  supplementalImport?: SupplementalImportResult;
  transactionImport?: {
    imported: number;
    skipped: TransactionReportRow[];
    failed: TransactionReportRow[];
    successes: TransactionSuccessRow[];
  };
};

function buildLegacyTransactionSourceKeys(row: Record<string, string>) {
  return [
    (row.custom_id ?? "").trim(),
    (row.id ?? "").trim(),
  ].filter(Boolean);
}

function readAdditionalFieldString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const candidate = (value as Record<string, unknown>)[key];

  if (typeof candidate === "string") {
    return candidate.trim();
  }

  if (typeof candidate === "number") {
    return String(candidate);
  }

  return "";
}

async function loadExistingLegacyTransactionSourceKeys(organizationId: string) {
  const rows = await prisma.transaction.findMany({
    where: {
      organizationId,
    },
    select: {
      additionalFields: true,
    },
  });
  const keys = new Set<string>();

  for (const row of rows) {
    const legacyCustomId = readAdditionalFieldString(
      row.additionalFields,
      "legacyCustomId",
    );
    const legacyRecordId = readAdditionalFieldString(
      row.additionalFields,
      "legacyRecordId",
    );

    if (legacyCustomId) {
      keys.add(legacyCustomId);
    }

    if (legacyRecordId) {
      keys.add(legacyRecordId);
    }
  }

  return keys;
}

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
    officeLabel: "Acre NY Realty Inc",
    fileName: "ACRE_NY_REALTY_INC_active_agents (1).csv",
    kind: "users",
  },
  {
    officeSlug: "acre-ny-rental",
    officeLabel: "Acre NY Rentals LLC",
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
    officeLabel: "Acre NY Realty Inc",
    fileName: "acre ny realty report - 2026-04-16T112134.861.csv",
    kind: "transactions",
  },
  {
    officeSlug: "acre-ny-rental",
    officeLabel: "Acre NY Rentals LLC",
    fileName: "acre ny rental report - 2026-04-16T112243.446.csv",
    kind: "transactions",
  },
];

function isExecutedDirectly() {
  if (import.meta.main) {
    return true;
  }

  const entryPath = process.argv[1];

  if (!entryPath) {
    return false;
  }

  return resolve(entryPath) === fileURLToPath(import.meta.url);
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = (argv[0] ?? "run") as CommandName;
  const supportedCommands = new Set<CommandName>([
    "analyze",
    "reset-business-data",
    "import-users",
    "import-user-supplemental",
    "import-transactions",
    "run",
  ]);

  if (!supportedCommands.has(command)) {
    throw new Error(`Unsupported command "${command}".`);
  }

  let sourceDir = process.env.ACRE_LEGACY_IMPORT_SOURCE_DIR ?? defaultSourceDirectory;
  let reportDir = process.env.ACRE_LEGACY_IMPORT_REPORT_DIR ?? defaultReportDirectory;
  let supplementalSheetUrl = process.env.ACRE_LEGACY_IMPORT_SUPPLEMENTAL_SHEET_URL ?? "";
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

    if (arg.startsWith("--supplemental-sheet-url=")) {
      supplementalSheetUrl = arg.slice("--supplemental-sheet-url=".length);
      continue;
    }
  }

  return {
    command,
    execute,
    sourceDir,
    reportDir,
    supplementalSheetUrl,
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

function formatDateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function getCurrentNewYorkDateValue(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now);
}

function buildSkippedSupplementalImportResult(reason: string): SupplementalImportResult {
  return {
    sourceUrl: "",
    skippedByConfiguration: true,
    reason,
    imported: 0,
    skipped: [],
    failed: [],
    successes: [],
    countsBySheet: {},
  };
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
        defaultOfficeSlug: config.officeSlug,
        defaultOfficeId: office.id,
        defaultOfficeLabel: office.name,
        accessibleOfficeSlugs: [config.officeSlug],
        accessibleOfficeIds: [office.id],
        accessibleOfficeLabels: [office.name],
        sourceFiles: [config.fileName],
        warnings: splitName.warnings.map((warning) => warning.message),
      };
      const existing = emailOwner.get(email);

      if (existing) {
        if (!existing.accessibleOfficeIds.includes(office.id)) {
          existing.accessibleOfficeIds.push(office.id);
          existing.accessibleOfficeSlugs.push(config.officeSlug);
          existing.accessibleOfficeLabels.push(office.name);
        }

        if (!existing.sourceFiles.includes(config.fileName)) {
          existing.sourceFiles.push(config.fileName);
        }

        if (existing.role !== roleResult.role) {
          existing.role = existing.role === "team_lead" || roleResult.role === "team_lead"
            ? "team_lead"
            : "agent";
          existing.warnings.push(
            `Email ${email} appeared with multiple roles; elevated to ${existing.role}.`,
          );
        }

        if (
          `${existing.firstName} ${existing.lastName}`.trim().toLowerCase() !==
          `${entry.firstName} ${entry.lastName}`.trim().toLowerCase()
        ) {
          existing.warnings.push(
            `Email ${email} appeared with multiple names; kept "${existing.firstName} ${existing.lastName}" and also saw "${entry.firstName} ${entry.lastName}".`,
          );
        }

        countsByFile[config.fileName].imported += 1;
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
  const officeMap = new Map<
    string,
    {
      byExact: Map<string, ImportedMembershipRecord[]>;
      records: Array<ImportedMembershipRecord & { aliasKeys: string[] }>;
    }
  >();

  for (const record of records) {
    const aliasKeys = buildImportedNameAliasKeys(record.fullName, record.email);

    for (const officeSlug of record.officeSlugs) {
      const officeIndex = officeMap.get(officeSlug) ?? {
        byExact: new Map<string, ImportedMembershipRecord[]>(),
        records: [],
      };

      for (const aliasKey of aliasKeys) {
        const existing = officeIndex.byExact.get(aliasKey) ?? [];

        existing.push(record);
        officeIndex.byExact.set(aliasKey, existing);
      }

      officeIndex.records.push({
        ...record,
        aliasKeys,
      });
      officeMap.set(officeSlug, officeIndex);
    }
  }

  return officeMap;
}

function normalizeCandidateOwnerLabel(value: string) {
  return value.trim().replace(/[\s.]+$/g, "");
}

function buildImportedNameAliasKeys(fullName: string, email: string) {
  const variants = new Set<string>();
  const trimmed = fullName.trim();
  const normalizedFull = normalizeLegacyImportNameForLookup(trimmed);

  if (normalizedFull) {
    variants.add(normalizedFull);
  }

  const match = trimmed.match(/^(.*?)\(([^)]+)\)(.*)$/);

  if (match) {
    const prefix = match[1]?.trim() ?? "";
    const nickname = match[2]?.trim() ?? "";
    const suffix = match[3]?.trim() ?? "";
    const candidateVariants = [
      [prefix, suffix].filter(Boolean).join(" "),
      [nickname, suffix].filter(Boolean).join(" "),
      [prefix, nickname, suffix].filter(Boolean).join(" "),
    ];

    for (const candidate of candidateVariants) {
      const normalized = normalizeLegacyImportNameForLookup(candidate);

      if (normalized) {
        variants.add(normalized);
      }
    }
  }

  const emailLocalPart = email.trim().toLowerCase().split("@")[0] ?? "";
  const emailTokens = emailLocalPart
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lastName = trimmed.split(/\s+/).filter(Boolean).at(-1) ?? "";

  if (emailTokens.length > 0 && lastName) {
    const candidateVariants = new Set<string>([
      `${emailTokens.join(" ")} ${lastName}`,
      `${emailTokens[0]} ${lastName}`,
    ]);

    for (const candidate of candidateVariants) {
      const normalized = normalizeLegacyImportNameForLookup(candidate);

      if (normalized) {
        variants.add(normalized);
      }
    }
  }

  return [...variants];
}

function buildOwnerCandidateVariants(candidateNames: string[]) {
  const variants = new Set<string>();
  const cleanedCandidates = candidateNames
    .map((entry) => normalizeCandidateOwnerLabel(entry))
    .filter(Boolean);

  for (const cleaned of cleanedCandidates) {
    variants.add(cleaned);

    const slashParts = cleaned
      .split("/")
      .map((entry) => normalizeCandidateOwnerLabel(entry))
      .filter(Boolean);

    for (const part of slashParts) {
      variants.add(part);
    }

    if (slashParts.length === 2 && slashParts.every((part) => part.split(/\s+/).length === 1)) {
      variants.add(`${slashParts[0]} ${slashParts[1]}`);
    }

    const ampersandParts = cleaned
      .split(/\s+(?:and|&)\s+/i)
      .map((entry) => normalizeCandidateOwnerLabel(entry))
      .filter(Boolean);

    for (const part of ampersandParts) {
      variants.add(part);
    }
  }

  for (let index = 0; index < cleanedCandidates.length - 1; index += 1) {
    const current = cleanedCandidates[index] ?? "";
    const next = cleanedCandidates[index + 1] ?? "";

    if (
      current.split(/\s+/).filter(Boolean).length === 1 &&
      next.split(/\s+/).filter(Boolean).length === 1
    ) {
      variants.add(`${current} ${next}`);
    }
  }

  return [...variants];
}

function findOwnerMatchesByTokenSubset(
  normalizedCandidate: string,
  officeRecords: Array<ImportedMembershipRecord & { aliasKeys: string[] }>,
) {
  const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);

  if (candidateTokens.length < 2) {
    return [];
  }

  return officeRecords.filter((record) =>
    record.aliasKeys.some((aliasKey) => {
      const aliasTokens = aliasKey.split(" ").filter(Boolean);

      return candidateTokens.every((token) => aliasTokens.includes(token));
    }),
  );
}

type SupplementalWorkbookData = {
  sourceUrl: string;
  aggregatedUsers: SupplementalAggregatedUser[];
  countsBySheet: Record<string, SupplementalImportSheetCount>;
};

type SupplementalMembershipState = {
  notes: string;
  licenseState: string;
  startDate: string;
};

async function loadSupplementalWorkbookData(
  supplementalSheetUrl: string,
): Promise<SupplementalWorkbookData> {
  const sourceUrl = buildSupplementalWorkbookExportUrl(supplementalSheetUrl);
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download supplemental workbook (${response.status} ${response.statusText}).`,
    );
  }

  const workbook = parseSupplementalWorkbook(
    Buffer.from(await response.arrayBuffer()),
  );
  const aggregated = aggregateSupplementalRows(workbook.rows);
  const countsBySheet = Object.fromEntries(
    Object.entries(aggregated.countsBySheet).map(([sheetName, counts]) => [
      sheetName,
      {
        rows: counts.rows,
        groupedUsers: counts.groupedUsers,
        imported: 0,
        skipped: 0,
        failed: 0,
      } satisfies SupplementalImportSheetCount,
    ]),
  );

  return {
    sourceUrl,
    aggregatedUsers: aggregated.aggregatedUsers,
    countsBySheet,
  };
}

async function loadSupplementalMembershipState(
  organizationId: string,
  membershipIds: string[],
  officeIds: string[],
) {
  if (membershipIds.length === 0) {
    return new Map<string, SupplementalMembershipState>();
  }

  const rows = await prisma.membership.findMany({
    where: {
      organizationId,
      id: {
        in: membershipIds,
      },
    },
    select: {
      id: true,
      agentProfile: {
        select: {
          notes: true,
          licenseNumber: true,
          licenseState: true,
          startDate: true,
          onboardingStatus: true,
          internalExtension: true,
        },
      },
      agentOfficeProfiles: {
        where: {
          officeId: {
            in: officeIds,
          },
        },
        select: {
          id: true,
          officeId: true,
          notes: true,
          licenseNumber: true,
          licenseState: true,
          expirationDate: true,
          onboardingStatus: true,
          internalExtension: true,
        },
      },
    },
  });

  const state = new Map<string, SupplementalMembershipState>();

  for (const row of rows) {
    for (const officeId of officeIds) {
      const officeProfile = row.agentOfficeProfiles.find(
        (profile) => profile.officeId === officeId,
      );
      const resolved = resolveAgentOfficeProfileFields(
        row.agentProfile,
        officeProfile,
      );
      state.set(`${row.id}::${officeId}`, {
        notes: resolved.notes,
        licenseState: resolved.licenseState,
        startDate: formatDateValue(resolved.expirationDate),
      });
    }
  }

  return state;
}

function resolveSupplementalMembershipMatch(
  user: SupplementalAggregatedUser,
  importedIndex: ReturnType<typeof buildImportedMembershipIndex>,
) {
  const officeUsers = importedIndex.get(user.officeSlug) ?? {
    byExact: new Map<string, ImportedMembershipRecord[]>(),
    records: [],
  };

  for (const candidate of buildOwnerCandidateVariants([user.userName])) {
    const normalizedCandidate = normalizeLegacyImportNameForLookup(candidate);

    if (!normalizedCandidate) {
      continue;
    }

    const exactMatches = officeUsers.byExact.get(normalizedCandidate) ?? [];
    const matches =
      exactMatches.length > 0
        ? exactMatches
        : findOwnerMatchesByTokenSubset(normalizedCandidate, officeUsers.records);

    if (matches.length === 1) {
      return {
        ok: true as const,
        membership: matches[0],
      };
    }

    if (matches.length > 1) {
      return {
        ok: false as const,
        reason: `Supplemental user "${candidate}" matched multiple imported users in ${user.officeSlug}.`,
      };
    }
  }

  return {
    ok: false as const,
    reason: `No imported user matched ${user.userName} in ${user.officeSlug}.`,
  };
}

export async function executeSupplementalImport(
  context: RuntimeContext,
  importedUsers: ImportedMembershipRecord[],
  execute: boolean,
  supplementalSheetUrl: string,
  dependencies: {
    loadSupplementalWorkbookData?: (
      url: string,
    ) => Promise<SupplementalWorkbookData>;
    now?: Date;
  } = {},
) {
  const loadData =
    dependencies.loadSupplementalWorkbookData ?? loadSupplementalWorkbookData;
  const workbookData = await loadData(supplementalSheetUrl);
  const importedIndex = buildImportedMembershipIndex(importedUsers);
  const supplementalOfficeIds = [
    ...new Set(
      workbookData.aggregatedUsers
        .map((user) => context.officeBySlug.get(user.officeSlug)?.id ?? "")
        .filter(Boolean),
    ),
  ];
  const membershipState = execute
    ? await loadSupplementalMembershipState(
        context.organizationId,
        importedUsers.map((user) => user.membershipId),
        supplementalOfficeIds,
      )
    : new Map<string, SupplementalMembershipState>();
  const effectiveFrom = getCurrentNewYorkDateValue(dependencies.now);
  const skipped: SupplementalImportSkippedRow[] = [];
  const failed: SupplementalImportFailedRow[] = [];
  const successes: SupplementalImportSuccessRow[] = [];

  for (const user of workbookData.aggregatedUsers) {
    const sheetCounts = workbookData.countsBySheet[user.sheetName];
    const sourceRows = user.sourceRowNumbers.join(", ");
    const matched = resolveSupplementalMembershipMatch(user, importedIndex);

    if (!matched.ok) {
      skipped.push({
        officeSlug: user.officeSlug,
        sheetName: user.sheetName,
        userName: user.userName,
        sourceRows,
        reason: matched.reason,
      });
      if (sheetCounts) {
        sheetCounts.skipped += 1;
      }
      continue;
    }

    const viewerOffice = context.officeBySlug.get(user.officeSlug);
    const membershipStateKey = viewerOffice?.id
      ? `${matched.membership.membershipId}::${viewerOffice.id}`
      : matched.membership.membershipId;
    const existingState = membershipState.get(membershipStateKey) ?? {
      notes: "",
      licenseState: "",
      startDate: "",
    };
    const nextNotes = appendSupplementalNote(existingState.notes, user.noteBlock);
    const shouldUpdateNote = nextNotes !== existingState.notes;
    const shouldUpdateLicenseState =
      Boolean(user.licenseState) && user.licenseState !== existingState.licenseState;
    const shouldUpdateStartDate =
      Boolean(user.expirationDate) && user.expirationDate !== existingState.startDate;
    const shouldUpdateCommission = Boolean(user.maxSplitPercentLabel);

    try {
      if (
        execute &&
        (shouldUpdateNote ||
          shouldUpdateLicenseState ||
          shouldUpdateStartDate ||
          shouldUpdateCommission)
      ) {
        await saveAgentProfile({
          organizationId: context.organizationId,
          officeId: viewerOffice?.id ?? null,
          membershipId: matched.membership.membershipId,
          actorMembershipId: context.bootstrapMembershipId,
          ...(shouldUpdateNote ? { notes: nextNotes } : {}),
          ...(shouldUpdateLicenseState
            ? { licenseState: user.licenseState }
            : {}),
          ...(shouldUpdateStartDate ? { startDate: user.expirationDate } : {}),
          ...(shouldUpdateCommission
            ? {
                customAgentPercent: user.maxSplitPercentLabel,
                commissionEffectiveFrom: effectiveFrom,
              }
            : {}),
        });
      }

      successes.push({
        officeSlug: user.officeSlug,
        sheetName: user.sheetName,
        userName: user.userName,
        sourceRows,
        membershipId: matched.membership.membershipId,
        membershipEmail: matched.membership.email,
        splitPercent: user.maxSplitPercentLabel,
        licenseState: user.licenseState,
        expirationDate: user.expirationDate,
        profileUpdated:
          shouldUpdateLicenseState || shouldUpdateStartDate ? "yes" : "no",
        commissionUpdated: shouldUpdateCommission ? "yes" : "no",
        noteUpdated: shouldUpdateNote ? "yes" : "no",
      });
      membershipState.set(membershipStateKey, {
        notes: nextNotes,
        licenseState: shouldUpdateLicenseState
          ? user.licenseState
          : existingState.licenseState,
        startDate: shouldUpdateStartDate
          ? user.expirationDate
          : existingState.startDate,
      });
      if (sheetCounts) {
        sheetCounts.imported += 1;
      }
    } catch (error) {
      failed.push({
        officeSlug: user.officeSlug,
        sheetName: user.sheetName,
        userName: user.userName,
        sourceRows,
        reason: error instanceof Error ? error.message : String(error),
      });
      if (sheetCounts) {
        sheetCounts.failed += 1;
      }
    }
  }

  return {
    sourceUrl: workbookData.sourceUrl,
    skippedByConfiguration: false,
    reason: "",
    imported: successes.length,
    skipped,
    failed,
    successes,
    countsBySheet: workbookData.countsBySheet,
  } satisfies SupplementalImportResult;
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
      viewerOfficeId: entry.defaultOfficeId,
      email: entry.email,
      firstName: entry.firstName,
      lastName: entry.lastName,
      role: entry.role,
      defaultOfficeId: entry.defaultOfficeId,
      accessibleOfficeIds: entry.accessibleOfficeIds,
      title: null,
      initialPassword: "Acreny2026",
    });

    imported.push({
      membershipId: saved.membershipId,
      email: entry.email,
      fullName: `${entry.firstName} ${entry.lastName}`.trim(),
      officeSlugs: entry.accessibleOfficeSlugs,
    });
  }

  return imported;
}

function simulateUserImport(plan: ImportedUserPlan) {
  return plan.entries.map((entry) => ({
    membershipId: `dry-run:${entry.defaultOfficeSlug}:${entry.email}`,
    email: entry.email,
    fullName: `${entry.firstName} ${entry.lastName}`.trim(),
    officeSlugs: entry.accessibleOfficeSlugs,
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
      officeAccesses: {
        include: {
          office: true,
        },
      },
    },
  });
  const imported = rows.flatMap((row) => {
    const planned = plannedEntriesByEmail.get(row.user.email);

    if (!planned || !row.office) {
      return [];
    }

    const officeSlugs = new Set<string>([row.office.slug]);

    for (const access of row.officeAccesses) {
      officeSlugs.add(access.office.slug);
    }

    if (!planned.accessibleOfficeSlugs.every((officeSlug) => officeSlugs.has(officeSlug))) {
      return [];
    }

    return [
      {
        membershipId: row.id,
        email: row.user.email,
        fullName: `${row.user.firstName} ${row.user.lastName}`.trim(),
        officeSlugs: [...officeSlugs],
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
  const officeOwners = ownerIndex.get(officeSlug) ?? {
    byExact: new Map<string, ImportedMembershipRecord[]>(),
    records: [],
  };
  const legacyUsers = normalizedRow.additionalFields.legacyUsers ?? "";

  for (const candidate of buildOwnerCandidateVariants(normalizedRow.ownerCandidateNames)) {
    const normalizedCandidate = normalizeLegacyImportNameForLookup(candidate);
    const exactMatches = officeOwners.byExact.get(normalizedCandidate) ?? [];
    const matches =
      exactMatches.length > 0
        ? exactMatches
        : findOwnerMatchesByTokenSubset(normalizedCandidate, officeOwners.records);

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

  const fallbackMatches = new Map<string, ImportedMembershipRecord>();

  for (const rawUser of legacyUsers.split(",")) {
    const candidate = rawUser.trim();

    if (!candidate) {
      continue;
    }

    const normalizedCandidate = normalizeLegacyImportNameForLookup(candidate);

    if (!normalizedCandidate) {
      continue;
    }

    const exactMatches = officeOwners.byExact.get(normalizedCandidate) ?? [];
    const matches =
      exactMatches.length > 0
        ? exactMatches
        : findOwnerMatchesByTokenSubset(normalizedCandidate, officeOwners.records);

    if (matches.length > 1) {
      return {
        ok: false as const,
        reason: `Legacy users fallback candidate "${candidate}" matched multiple imported users in ${officeSlug}.`,
      };
    }

    if (matches.length === 1) {
      fallbackMatches.set(matches[0].membershipId, matches[0]);
    }
  }

  if (fallbackMatches.size === 1) {
    return {
      ok: true as const,
      owner: [...fallbackMatches.values()][0],
      usedLegacyUsersFallback: true,
    };
  }

  if (fallbackMatches.size > 1) {
    return {
      ok: false as const,
      reason: `Legacy users fallback matched multiple imported users in ${officeSlug}.`,
    };
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

  const resolvedCreatedContact =
    created && typeof created.id === "string"
      ? {
          id: created.id,
          fullName: created.fullName,
          email: created.email ?? "",
        }
      : await prisma.client.findFirst({
          where: {
            organizationId: input.organizationId,
            ownerMembershipId: input.ownerMembershipId,
            fullName: createName || email,
            email: email || null,
          },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        });

  if (!resolvedCreatedContact) {
    throw new Error(
      `Contact create returned no visible record for "${createName || email}".`,
    );
  }

  addContactToCache(cache, {
    id: resolvedCreatedContact.id,
    fullName: resolvedCreatedContact.fullName,
    email: resolvedCreatedContact.email ?? "",
  });

  return {
    id: resolvedCreatedContact.id,
    created: true,
  };
}

async function executeTransactionImport(
  context: RuntimeContext,
  ownerRecords: ImportedMembershipRecord[],
  execute: boolean,
) {
  const ownerIndex = buildImportedMembershipIndex(ownerRecords);
  const existingLegacyTransactionSourceKeys =
    await loadExistingLegacyTransactionSourceKeys(context.organizationId);
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
      const sourceKeys = buildLegacyTransactionSourceKeys(row);
      const duplicateSourceKey = sourceKeys.find((key) =>
        existingLegacyTransactionSourceKeys.has(key),
      );

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

      if (duplicateSourceKey) {
        skipped.push({
          officeSlug: config.officeSlug,
          sourceFile: config.fileName,
          sourceRowId: normalized.sourceRowId,
          transactionName: normalized.createInput.transactionName,
          reason: `Legacy transaction "${duplicateSourceKey}" already exists in the database or current import batch.`,
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

      if (ownerMatch.usedLegacyUsersFallback) {
        warnings.push("Owner matched through unique legacy users fallback.");
      }

      try {
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

        for (const sourceKey of sourceKeys) {
          existingLegacyTransactionSourceKeys.add(sourceKey);
        }

        successes.push({
          officeSlug: config.officeSlug,
          sourceFile: config.fileName,
          sourceRowId: normalized.sourceRowId,
          transactionName: normalized.createInput.transactionName,
          ownerEmail: ownerMatch.owner.email,
          warnings: warnings.join(" | "),
        });
      } catch (error) {
        failed.push({
          officeSlug: config.officeSlug,
          sourceFile: config.fileName,
          sourceRowId: normalized.sourceRowId,
          transactionName: normalized.createInput.transactionName,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
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

  if (summary.supplementalImport) {
    await writeFile(
      join(targetDir, "supplemental-user-skipped.csv"),
      stringifyCsv(
        summary.supplementalImport.skipped.map((entry) => ({
          officeSlug: entry.officeSlug,
          sheetName: entry.sheetName,
          userName: entry.userName,
          sourceRows: entry.sourceRows,
          reason: entry.reason,
        })),
      ),
      "utf8",
    );
    await writeFile(
      join(targetDir, "supplemental-user-failed.csv"),
      stringifyCsv(
        summary.supplementalImport.failed.map((entry) => ({
          officeSlug: entry.officeSlug,
          sheetName: entry.sheetName,
          userName: entry.userName,
          sourceRows: entry.sourceRows,
          reason: entry.reason,
        })),
      ),
      "utf8",
    );
    await writeFile(
      join(targetDir, "supplemental-user-success.csv"),
      stringifyCsv(
        summary.supplementalImport.successes.map((entry) => ({
          officeSlug: entry.officeSlug,
          sheetName: entry.sheetName,
          userName: entry.userName,
          sourceRows: entry.sourceRows,
          membershipId: entry.membershipId,
          membershipEmail: entry.membershipEmail,
          splitPercent: entry.splitPercent,
          licenseState: entry.licenseState,
          expirationDate: entry.expirationDate,
          profileUpdated: entry.profileUpdated,
          commissionUpdated: entry.commissionUpdated,
          noteUpdated: entry.noteUpdated,
        })),
      ),
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
  console.log(
    `Supplemental sheet: ${args.supplementalSheetUrl || "(not provided)"}`,
  );
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

  if (summary.supplementalImport) {
    console.log("");
    console.log(
      `Supplemental import: imported=${summary.supplementalImport.imported}, skipped=${summary.supplementalImport.skipped.length}, failed=${summary.supplementalImport.failed.length}`,
    );
    if (summary.supplementalImport.skippedByConfiguration) {
      console.log(
        `Supplemental import skipped: ${summary.supplementalImport.reason}`,
      );
    }
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

  if (
    args.command === "import-user-supplemental" &&
    !args.supplementalSheetUrl.trim()
  ) {
    throw new Error(
      "Supplemental Google Sheet URL is required for import-user-supplemental.",
    );
  }

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
    summary.supplementalImport = args.supplementalSheetUrl.trim()
      ? await executeSupplementalImport(
          context,
          simulateUserImport(userPlan),
          false,
          args.supplementalSheetUrl,
        )
      : buildSkippedSupplementalImportResult(
          "Supplemental Google Sheet URL was not provided.",
        );
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

  if (
    (args.command === "import-user-supplemental" || args.command === "run") &&
    args.execute &&
    args.command === "import-user-supplemental"
  ) {
    importedUsers = await loadImportedUsersFromDatabase(context, userPlan);
  }

  if (args.command === "import-user-supplemental" || args.command === "run") {
    summary.supplementalImport = args.supplementalSheetUrl.trim()
      ? await executeSupplementalImport(
          context,
          importedUsers,
          args.execute,
          args.supplementalSheetUrl,
        )
      : buildSkippedSupplementalImportResult(
          "Supplemental Google Sheet URL was not provided.",
        );
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

if (isExecutedDirectly()) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
