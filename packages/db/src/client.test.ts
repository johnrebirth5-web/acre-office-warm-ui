import assert from "node:assert/strict";
import test from "node:test";
import { buildPrismaDatasourceUrl } from "./client.ts";

test("buildPrismaDatasourceUrl keeps the original url when pool tuning env is unset", () => {
  const baseUrl = "postgresql://user:password@127.0.0.1:5433/acre";

  assert.equal(buildPrismaDatasourceUrl(baseUrl, {}), baseUrl);
});

test("buildPrismaDatasourceUrl injects connection_limit and pool_timeout", () => {
  const baseUrl = "postgresql://user:password@127.0.0.1:5433/acre";
  const nextUrl = buildPrismaDatasourceUrl(baseUrl, {
    PRISMA_CONNECTION_LIMIT: "15",
    PRISMA_POOL_TIMEOUT: "10",
  });

  assert.equal(
    nextUrl,
    "postgresql://user:password@127.0.0.1:5433/acre?connection_limit=15&pool_timeout=10",
  );
});

test("buildPrismaDatasourceUrl preserves existing query params while overriding tuned values", () => {
  const baseUrl =
    "postgresql://user:password@127.0.0.1:5433/acre?schema=public&connection_limit=5";
  const nextUrl = buildPrismaDatasourceUrl(baseUrl, {
    PRISMA_CONNECTION_LIMIT: "18",
    PRISMA_POOL_TIMEOUT: "0",
  });
  const parsed = new URL(nextUrl!);

  assert.equal(parsed.searchParams.get("schema"), "public");
  assert.equal(parsed.searchParams.get("connection_limit"), "18");
  assert.equal(parsed.searchParams.get("pool_timeout"), "0");
});

test("buildPrismaDatasourceUrl ignores invalid tuning env values", () => {
  const baseUrl = "postgresql://user:password@127.0.0.1:5433/acre";
  const nextUrl = buildPrismaDatasourceUrl(baseUrl, {
    PRISMA_CONNECTION_LIMIT: "0",
    PRISMA_POOL_TIMEOUT: "-1",
  });

  assert.equal(nextUrl, baseUrl);
});
