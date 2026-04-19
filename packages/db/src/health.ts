import { Prisma } from "@prisma/client";
import { getPrismaClient } from "./client";

export type DatabaseHealthStatus = "available" | "unavailable";

export type DatabaseHealthCheck = {
  status: DatabaseHealthStatus;
};

export type DatabaseHealthCheckClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: readonly unknown[]
  ): Promise<T>;
};

export type DatabaseHealthCheckOptions = {
  client?: DatabaseHealthCheckClient;
  hasDatabaseUrl?: boolean;
};

export type HealthSnapshotStatus = "ok" | "degraded" | "error";

export type HealthSnapshot = {
  status: HealthSnapshotStatus;
  db: {
    ping_ms: number;
    pool_in_use: number | null;
    pool_idle: number | null;
    pool_max: number | null;
  };
  process: {
    rss_bytes: number;
    heap_used_bytes: number;
    heap_total_bytes: number;
    uptime_seconds: number;
  };
  timestamp: string;
};

export type HealthSnapshotOptions = DatabaseHealthCheckOptions & {
  memoryUsage?: () => NodeJS.MemoryUsage;
  pingDegradedThresholdMs?: number;
  now?: () => number;
  timestampFactory?: () => string;
  uptime?: () => number;
};

type PoolSnapshotRow = {
  pool_in_use: bigint | number | string | null;
  pool_idle: bigint | number | string | null;
  pool_max: bigint | number | string | null;
};

function coerceNullableNumber(value: bigint | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

async function getPoolSnapshot(client: DatabaseHealthCheckClient) {
  try {
    const [row] = await client.$queryRaw<PoolSnapshotRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*) FILTER (
            WHERE state = 'active' OR state = 'idle in transaction'
          )::int AS pool_in_use,
          COUNT(*) FILTER (
            WHERE state = 'idle'
          )::int AS pool_idle,
          current_setting('max_connections')::int AS pool_max
        FROM pg_stat_activity
        WHERE datname = current_database()
      `,
    );

    return {
      failed: false,
      pool_idle: coerceNullableNumber(row?.pool_idle),
      pool_in_use: coerceNullableNumber(row?.pool_in_use),
      pool_max: coerceNullableNumber(row?.pool_max),
    };
  } catch {
    return {
      failed: true,
      pool_idle: null,
      pool_in_use: null,
      pool_max: null,
    };
  }
}

export async function getDatabaseHealthCheck(
  options: DatabaseHealthCheckOptions = {},
): Promise<DatabaseHealthCheck> {
  const hasDatabaseUrl = options.hasDatabaseUrl ?? Boolean(process.env.DATABASE_URL);
  const client = options.client ?? getPrismaClient();

  if (!hasDatabaseUrl) {
    return { status: "unavailable" };
  }

  try {
    await client.$queryRaw(Prisma.sql`SELECT 1`);
    return { status: "available" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function getHealthSnapshot(
  options: HealthSnapshotOptions = {},
): Promise<HealthSnapshot> {
  const hasDatabaseUrl = options.hasDatabaseUrl ?? Boolean(process.env.DATABASE_URL);
  const memoryUsage = (options.memoryUsage ?? process.memoryUsage)();
  const now = options.now ?? Date.now;
  const timestamp =
    options.timestampFactory?.() ?? new Date().toISOString();
  const uptimeSeconds = (options.uptime ?? process.uptime)();

  if (!hasDatabaseUrl) {
    return {
      status: "degraded",
      db: {
        ping_ms: 0,
        pool_idle: null,
        pool_in_use: null,
        pool_max: null,
      },
      process: {
        rss_bytes: memoryUsage.rss,
        heap_used_bytes: memoryUsage.heapUsed,
        heap_total_bytes: memoryUsage.heapTotal,
        uptime_seconds: uptimeSeconds,
      },
      timestamp,
    };
  }

  const client = options.client ?? getPrismaClient();
  const pingStartedAt = now();
  let pingFailed = false;
  let pingMs = 0;

  try {
    await client.$queryRaw(Prisma.sql`SELECT 1`);
    pingMs = now() - pingStartedAt;
  } catch {
    pingFailed = true;
    pingMs = Math.max(0, now() - pingStartedAt);
  }

  const poolSnapshot = pingFailed
    ? {
        failed: true,
        pool_idle: null,
        pool_in_use: null,
        pool_max: null,
      }
    : await getPoolSnapshot(client);

  return {
    status:
      pingFailed ||
      poolSnapshot.failed ||
      pingMs > (options.pingDegradedThresholdMs ?? 1000)
        ? "degraded"
        : "ok",
    db: {
      ping_ms: pingMs,
      pool_idle: poolSnapshot.pool_idle,
      pool_in_use: poolSnapshot.pool_in_use,
      pool_max: poolSnapshot.pool_max,
    },
    process: {
      rss_bytes: memoryUsage.rss,
      heap_used_bytes: memoryUsage.heapUsed,
      heap_total_bytes: memoryUsage.heapTotal,
      uptime_seconds: uptimeSeconds,
    },
    timestamp,
  };
}
