import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";

function loadDatabaseEnvFromRepoRoot() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(sourceDir, "../../..");
  const candidates = [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const contents = readFileSync(candidate, "utf8");

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

loadDatabaseEnvFromRepoRoot();

const globalForPrisma = globalThis as typeof globalThis & {
  __acrePrisma?: AcrePrismaClient;
  __acrePrismaObservabilityRegistered?: boolean;
};

function parseIntegerEnvValue(
  value: string | undefined,
  options: {
    min: number;
  },
) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < options.min) {
    return null;
  }

  return parsed;
}

export function buildPrismaDatasourceUrl(
  baseUrl: string | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  if (!baseUrl) {
    return baseUrl;
  }

  const connectionLimit = parseIntegerEnvValue(env.PRISMA_CONNECTION_LIMIT, {
    min: 1,
  });
  const poolTimeout = parseIntegerEnvValue(env.PRISMA_POOL_TIMEOUT, {
    min: 0,
  });

  if (connectionLimit === null && poolTimeout === null) {
    return baseUrl;
  }

  const datasourceUrl = new URL(baseUrl);

  if (connectionLimit !== null) {
    datasourceUrl.searchParams.set("connection_limit", String(connectionLimit));
  }

  if (poolTimeout !== null) {
    datasourceUrl.searchParams.set("pool_timeout", String(poolTimeout));
  }

  return datasourceUrl.toString();
}

const datasourceUrl = buildPrismaDatasourceUrl(process.env.DATABASE_URL);
const prismaLogLevels: [
  { emit: "event"; level: "query" },
  { emit: "event"; level: "warn" },
  { emit: "event"; level: "error" },
] = [
  { emit: "event", level: "query" },
  { emit: "event", level: "warn" },
  { emit: "event", level: "error" },
];
const prismaClientOptions = {
  ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  log: prismaLogLevels,
} satisfies Prisma.PrismaClientOptions;

type AcrePrismaClient = PrismaClient<typeof prismaClientOptions>;

function parseThresholdMs(envKey: string, fallback: number) {
  const parsed = Number.parseInt(process.env[envKey] ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function truncateValue(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength);
}

async function capturePrismaErrorWithSentry(
  message: string,
  target: string | undefined,
) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  try {
    const Sentry = await import("@sentry/nextjs");
    const error = new Error(message);

    error.name = "PrismaClientError";

    Sentry.captureException(error, {
      tags: {
        kind: "prisma_error",
      },
      extra: {
        target: target ?? null,
      },
    });
  } catch {
    // Sentry is optional. Ignore loading failures when it is not installed or initialized.
  }
}

function registerPrismaObservability(client: AcrePrismaClient) {
  if (
    process.env.NODE_ENV === "test" ||
    globalForPrisma.__acrePrismaObservabilityRegistered
  ) {
    return;
  }

  const slowQueryThresholdMs = parseThresholdMs("PRISMA_SLOW_QUERY_MS", 500);
  const verySlowQueryThresholdMs = parseThresholdMs(
    "PRISMA_VERY_SLOW_QUERY_MS",
    2000,
  );

  client.$on("query", (event) => {
    if (event.duration > verySlowQueryThresholdMs) {
      console.error(
        JSON.stringify({
          kind: "very_slow_query",
          duration_ms: event.duration,
          query: truncateValue(event.query, 500),
          params:
            process.env.NODE_ENV === "production"
              ? "[REDACTED]"
              : event.params,
        }),
      );
      return;
    }

    if (event.duration > slowQueryThresholdMs) {
      console.warn(
        JSON.stringify({
          kind: "slow_query",
          duration_ms: event.duration,
          query: truncateValue(event.query, 500),
          params:
            process.env.NODE_ENV === "production"
              ? "[REDACTED]"
              : event.params,
        }),
      );
    }
  });

  client.$on("error", (event) => {
    console.error(
      JSON.stringify({
        kind: "prisma_error",
        message: event.message,
        target: event.target ?? null,
      }),
    );

    void capturePrismaErrorWithSentry(event.message, event.target);
  });

  globalForPrisma.__acrePrismaObservabilityRegistered = true;
}

export const prisma =
  globalForPrisma.__acrePrisma ??
  new PrismaClient<typeof prismaClientOptions>(prismaClientOptions);

registerPrismaObservability(prisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__acrePrisma = prisma;
}

export function getPrismaClient() {
  return prisma;
}

export function assertDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Prisma runtime.");
  }
}
