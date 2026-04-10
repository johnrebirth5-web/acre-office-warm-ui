import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseHealthCheck } from "./health";

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
