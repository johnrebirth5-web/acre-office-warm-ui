import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { getDatabaseHealthCheck, getHealthSnapshot } from "./health";

function createHealthClient(queryImpl: () => Promise<unknown>) {
  return {
    async $queryRaw<T = unknown>() {
      return (await queryImpl()) as T;
    },
  };
}

test("database health reports unavailable before attempting a query when no URL is configured", async () => {
  let queryCalls = 0;

  const result = await getDatabaseHealthCheck({
    hasDatabaseUrl: false,
    client: createHealthClient(async () => {
      queryCalls += 1;
      return [];
    }),
  });

  assert.equal(result.status, "unavailable");
  assert.equal(queryCalls, 0);
});

test("database health reports available when the query succeeds", async () => {
  let queryCalls = 0;

  const result = await getDatabaseHealthCheck({
    hasDatabaseUrl: true,
    client: createHealthClient(async () => {
      queryCalls += 1;
      return [];
    }),
  });

  assert.equal(result.status, "available");
  assert.equal(queryCalls, 1);
});

test("database health reports unavailable when the query fails", async () => {
  const result = await getDatabaseHealthCheck({
    hasDatabaseUrl: true,
    client: createHealthClient(async () => {
      throw new Error("connection refused");
    }),
  });

  assert.equal(result.status, "unavailable");
});

test("health snapshot reports degraded process-only metrics when no database URL is configured", async () => {
  const snapshot = await getHealthSnapshot({
    hasDatabaseUrl: false,
    memoryUsage: () => ({
      arrayBuffers: 16,
      external: 32,
      heapTotal: 2048,
      heapUsed: 1024,
      rss: 4096,
    }),
    timestampFactory: () => "2026-04-19T00:00:00.000Z",
    uptime: () => 12,
  });

  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.db.ping_ms, 0);
  assert.equal(snapshot.db.pool_in_use, null);
  assert.equal(snapshot.db.pool_idle, null);
  assert.equal(snapshot.db.pool_max, null);
  assert.equal(snapshot.process.rss_bytes, 4096);
  assert.equal(snapshot.process.heap_used_bytes, 1024);
  assert.equal(snapshot.process.heap_total_bytes, 2048);
  assert.equal(snapshot.process.uptime_seconds, 12);
  assert.equal(snapshot.timestamp, "2026-04-19T00:00:00.000Z");
});

test("health snapshot reports ok with ping, pool stats, and process metrics", async () => {
  const queryCalls: string[] = [];
  let nowValue = 100;

  const snapshot = await getHealthSnapshot({
    hasDatabaseUrl: true,
    client: {
      async $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql) {
        queryCalls.push(String(query));

        if (queryCalls.length === 1) {
          return [] as T;
        }

        return [
          {
            pool_in_use: 3,
            pool_idle: 5,
            pool_max: 100,
          },
        ] as T;
      },
    },
    memoryUsage: () => ({
      arrayBuffers: 16,
      external: 32,
      heapTotal: 2048,
      heapUsed: 1024,
      rss: 4096,
    }),
    now: () => {
      nowValue += 25;
      return nowValue;
    },
    timestampFactory: () => "2026-04-19T00:00:00.000Z",
    uptime: () => 12,
  });

  assert.equal(snapshot.status, "ok");
  assert.equal(snapshot.db.ping_ms, 25);
  assert.equal(snapshot.db.pool_in_use, 3);
  assert.equal(snapshot.db.pool_idle, 5);
  assert.equal(snapshot.db.pool_max, 100);
  assert.equal(snapshot.process.rss_bytes, 4096);
  assert.equal(snapshot.process.heap_used_bytes, 1024);
  assert.equal(snapshot.process.heap_total_bytes, 2048);
  assert.equal(snapshot.process.uptime_seconds, 12);
  assert.equal(snapshot.timestamp, "2026-04-19T00:00:00.000Z");
  assert.equal(queryCalls.length, 2);
});

test("health snapshot reports degraded when pool stats query fails", async () => {
  let queryCalls = 0;

  const snapshot = await getHealthSnapshot({
    hasDatabaseUrl: true,
    client: createHealthClient(async () => {
      queryCalls += 1;

      if (queryCalls === 1) {
        return [];
      }

      throw new Error("pg_stat_activity unavailable");
    }),
  });

  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.db.pool_in_use, null);
  assert.equal(snapshot.db.pool_idle, null);
  assert.equal(snapshot.db.pool_max, null);
});
