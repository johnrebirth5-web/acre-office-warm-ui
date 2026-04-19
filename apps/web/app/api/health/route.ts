import {
  getDatabaseHealthCheck as getDatabaseHealthCheckFromDb,
  getHealthSnapshot as getHealthSnapshotFromDb,
  type DatabaseHealthCheck,
  type HealthSnapshot,
} from "@acre/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type HealthRouteDependencies = {
  getDatabaseHealthCheck?: () => Promise<DatabaseHealthCheck>;
  getHealthSnapshot?: () => Promise<HealthSnapshot>;
  memoryUsage?: () => NodeJS.MemoryUsage;
  timestampFactory?: () => string;
  uptime?: () => number;
};

export async function handleHealthGet(
  dependencies: HealthRouteDependencies = {},
) {
  const getHealthSnapshot =
    dependencies.getHealthSnapshot ?? getHealthSnapshotFromDb;
  const getDatabaseHealthCheck =
    dependencies.getDatabaseHealthCheck ?? getDatabaseHealthCheckFromDb;

  try {
    const [snapshot, database] = await Promise.all([
      getHealthSnapshot(),
      getDatabaseHealthCheck(),
    ]);
    const httpStatus = snapshot.status === "ok" ? 200 : 503;

    return NextResponse.json(
      {
        status: snapshot.status === "error" ? "degraded" : snapshot.status,
        health_status: snapshot.status,
        service: "acre-agent-os",
        checks: {
          app: {
            status: "alive",
          },
          database,
        },
        db: snapshot.db,
        process: snapshot.process,
        timestamp: snapshot.timestamp,
      },
      {
        status: httpStatus,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    const memoryUsage = (dependencies.memoryUsage ?? process.memoryUsage)();
    const timestamp =
      dependencies.timestampFactory?.() ?? new Date().toISOString();
    const uptimeSeconds = (dependencies.uptime ?? process.uptime)();

    return NextResponse.json(
      {
        status: "degraded",
        health_status: "error",
        service: "acre-agent-os",
        checks: {
          app: {
            status: "alive",
          },
          database: {
            status: "unavailable" as const,
          },
        },
        db: {
          ping_ms: 0,
          pool_in_use: null,
          pool_idle: null,
          pool_max: null,
        },
        process: {
          rss_bytes: memoryUsage.rss,
          heap_used_bytes: memoryUsage.heapUsed,
          heap_total_bytes: memoryUsage.heapTotal,
          uptime_seconds: uptimeSeconds,
        },
        timestamp,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export async function GET() {
  return handleHealthGet();
}
