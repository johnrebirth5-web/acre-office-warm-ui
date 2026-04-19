import assert from "node:assert/strict";
import test from "node:test";
import {
  amountString,
  domainId,
  isoDate,
  rateString,
  safeEmail,
  safeUrl,
} from "./field-validators";

function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, "NODE_ENV", {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

test("amountString accepts empty, signed, and decimal values", () => {
  const schema = amountString();

  assert.equal(schema.safeParse("").success, true);
  assert.equal(schema.safeParse("-125.50").success, true);
  assert.equal(schema.safeParse("10").success, true);
});

test("amountString rejects malformed amounts", () => {
  const schema = amountString();

  assert.equal(schema.safeParse("12.345").success, false);
  assert.equal(schema.safeParse("abc").success, false);
  assert.equal(schema.safeParse("10,000").success, false);
});

test("rateString accepts decimals and percent suffixes", () => {
  const schema = rateString();

  assert.equal(schema.safeParse("5").success, true);
  assert.equal(schema.safeParse("5.125").success, true);
  assert.equal(schema.safeParse("6%").success, true);
});

test("rateString rejects malformed rates", () => {
  const schema = rateString();

  assert.equal(schema.safeParse("").success, false);
  assert.equal(schema.safeParse("5.12345").success, false);
  assert.equal(schema.safeParse("5 percent").success, false);
});

test("domainId accepts common Acre ids", () => {
  const schema = domainId();

  assert.equal(schema.safeParse("membership_123").success, true);
  assert.equal(schema.safeParse("FIELD-ABC_789").success, true);
  assert.equal(schema.safeParse("abc123def456").success, true);
});

test("domainId rejects short, spaced, and symbolic ids", () => {
  const schema = domainId();

  assert.equal(schema.safeParse("short").success, false);
  assert.equal(schema.safeParse("has spaces").success, false);
  assert.equal(schema.safeParse("invalid!token").success, false);
});

test("safeEmail accepts normal addresses within size limits", () => {
  const schema = safeEmail();

  assert.equal(schema.safeParse("agent@example.com").success, true);
  assert.equal(schema.safeParse("agent.ops+acre@example.co").success, true);
  assert.equal(schema.safeParse("john_rebirth5@example.io").success, true);
});

test("safeEmail rejects malformed or oversized addresses", () => {
  const schema = safeEmail();
  const oversized = `${"a".repeat(250)}@example.com`;

  assert.equal(schema.safeParse("not-an-email").success, false);
  assert.equal(schema.safeParse("agent@example").success, false);
  assert.equal(schema.safeParse(oversized).success, false);
});

test("safeUrl accepts https and development http URLs", () => {
  const schema = safeUrl();
  const originalNodeEnv = process.env.NODE_ENV;

  setNodeEnv("development");

  try {
    assert.equal(schema.safeParse("https://acresystem.us/path").success, true);
    assert.equal(schema.safeParse("http://localhost:3105/login").success, true);
    assert.equal(schema.safeParse("https://example.upstash.io").success, true);
  } finally {
    setNodeEnv(originalNodeEnv);
  }
});

test("safeUrl rejects non-http schemes and production http URLs", () => {
  const schema = safeUrl();
  const originalNodeEnv = process.env.NODE_ENV;

  setNodeEnv("production");

  try {
    assert.equal(schema.safeParse("http://localhost:3105/login").success, false);
    assert.equal(schema.safeParse("ftp://example.com/file").success, false);
    assert.equal(schema.safeParse("not-a-url").success, false);
  } finally {
    setNodeEnv(originalNodeEnv);
  }
});

test("isoDate accepts yyyy-mm-dd dates", () => {
  const schema = isoDate();

  assert.equal(schema.safeParse("2026-04-18").success, true);
  assert.equal(schema.safeParse("1999-12-31").success, true);
  assert.equal(schema.safeParse("2030-01-01").success, true);
});

test("isoDate rejects non-iso formats", () => {
  const schema = isoDate();

  assert.equal(schema.safeParse("04/18/2026").success, false);
  assert.equal(schema.safeParse("2026-4-18").success, false);
  assert.equal(schema.safeParse("2026-04-18T10:00:00Z").success, false);
});
