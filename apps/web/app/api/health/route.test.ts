import assert from "node:assert/strict";
import test from "node:test";
import { handleHealthGet } from "./route";

test("handleHealthGet returns 200 and the merged health snapshot when dependencies are healthy", async () => {
  const response = await handleHealthGet({
    getDatabaseHealthCheck: async () => ({
      status: "available",
    }),
    getHealthSnapshot: async () => ({
      status: "ok",
      db: {
        ping_ms: 12,
        pool_idle: 5,
        pool_in_use: 3,
        pool_max: 100,
      },
      process: {
        rss_bytes: 4096,
        heap_used_bytes: 1024,
        heap_total_bytes: 2048,
        uptime_seconds: 18,
      },
      timestamp: "2026-04-19T00:00:00.000Z",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    status: "ok",
    health_status: "ok",
    service: "acre-agent-os",
    checks: {
      app: {
        status: "alive",
      },
      database: {
        status: "available",
      },
    },
    db: {
      ping_ms: 12,
      pool_idle: 5,
      pool_in_use: 3,
      pool_max: 100,
    },
    process: {
      rss_bytes: 4096,
      heap_used_bytes: 1024,
      heap_total_bytes: 2048,
      uptime_seconds: 18,
    },
    timestamp: "2026-04-19T00:00:00.000Z",
  });
});

test("handleHealthGet returns 503 while preserving the legacy degraded status mapping", async () => {
  const response = await handleHealthGet({
    getDatabaseHealthCheck: async () => ({
      status: "available",
    }),
    getHealthSnapshot: async () => ({
      status: "degraded",
      db: {
        ping_ms: 1201,
        pool_idle: null,
        pool_in_use: null,
        pool_max: null,
      },
      process: {
        rss_bytes: 4096,
        heap_used_bytes: 1024,
        heap_total_bytes: 2048,
        uptime_seconds: 18,
      },
      timestamp: "2026-04-19T00:00:00.000Z",
    }),
  });

  assert.equal(response.status, 503);

  const body = (await response.json()) as Record<string, unknown>;

  assert.equal(body.status, "degraded");
  assert.equal(body.health_status, "degraded");
});

test("handleHealthGet falls back to the error payload when health sampling throws", async () => {
  const response = await handleHealthGet({
    getDatabaseHealthCheck: async () => ({
      status: "available",
    }),
    getHealthSnapshot: async () => {
      throw new Error("snapshot failed");
    },
    memoryUsage: () => ({
      arrayBuffers: 16,
      external: 32,
      heapTotal: 2048,
      heapUsed: 1024,
      rss: 4096,
    }),
    timestampFactory: () => "2026-04-19T00:00:00.000Z",
    uptime: () => 42,
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "degraded",
    health_status: "error",
    service: "acre-agent-os",
    checks: {
      app: {
        status: "alive",
      },
      database: {
        status: "unavailable",
      },
    },
    db: {
      ping_ms: 0,
      pool_in_use: null,
      pool_idle: null,
      pool_max: null,
    },
    process: {
      rss_bytes: 4096,
      heap_used_bytes: 1024,
      heap_total_bytes: 2048,
      uptime_seconds: 42,
    },
    timestamp: "2026-04-19T00:00:00.000Z",
  });
});
