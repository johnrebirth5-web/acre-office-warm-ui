import assert from "node:assert/strict";
import test from "node:test";
import {
  coerceLocaleCode,
  defaultLocale,
  resolveLocaleFromAcceptLanguage,
  resolvePreferredLocale,
  supportedLocales,
} from "./config";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "./format";
import { enUSMessages } from "./messages/en-US";
import { zhCNMessages } from "./messages/zh-CN";

function collectMessagePaths(
  value: Record<string, unknown>,
  prefix = "",
  paths: string[] = [],
) {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof entry === "string") {
      paths.push(path);
      continue;
    }

    collectMessagePaths(entry as Record<string, unknown>, path, paths);
  }

  return paths.sort();
}

test("locale resolver prefers user locale over cookie and header", () => {
  assert.equal(
    resolvePreferredLocale({
      userLocale: "zh-CN",
      cookieLocale: "en-US",
      acceptLanguage: "en-US,en;q=0.9",
    }),
    "zh-CN",
  );
});

test("locale resolver prefers cookie locale when user locale is unavailable", () => {
  assert.equal(
    resolvePreferredLocale({
      cookieLocale: "zh-CN",
      acceptLanguage: "en-US,en;q=0.9",
    }),
    "zh-CN",
  );
});

test("locale resolver falls back to accept-language and then default locale", () => {
  assert.equal(
    resolvePreferredLocale({
      acceptLanguage: "zh-Hans-CN,zh;q=0.9,en;q=0.8",
    }),
    "zh-CN",
  );
  assert.equal(resolvePreferredLocale({}), defaultLocale);
});

test("coerceLocaleCode falls back to en-US for unsupported locales", () => {
  assert.equal(coerceLocaleCode("es-US"), "en-US");
  assert.equal(coerceLocaleCode(""), "en-US");
});

test("accept-language mapping recognizes supported aliases", () => {
  assert.equal(resolveLocaleFromAcceptLanguage("zh-SG,zh;q=0.9"), "zh-CN");
  assert.equal(resolveLocaleFromAcceptLanguage("en-GB,en;q=0.8"), "en-US");
});

test("message dictionaries keep the same key structure across locales", () => {
  const basePaths = collectMessagePaths(enUSMessages as Record<string, unknown>);
  const chinesePaths = collectMessagePaths(
    zhCNMessages as Record<string, unknown>,
  );

  assert.deepEqual(chinesePaths, basePaths);
});

test("number and currency formatting follows the requested locale", () => {
  assert.equal(formatNumber(1234567.89, "en-US"), "1,234,567.89");
  assert.equal(formatNumber(1234567.89, "zh-CN"), "1,234,567.89");
  assert.equal(formatCurrency(1234.5, "en-US"), "$1,234.50");
  assert.equal(formatCurrency(1234.5, "zh-CN"), "US$1,234.50");
  assert.equal(formatPercent(0.256, "en-US"), "26%");
  assert.equal(formatPercent(0.256, "zh-CN"), "26%");
});

test("date formatting follows the active locale", () => {
  const value = new Date("2026-04-09T13:45:00.000Z");

  assert.match(formatDate(value, "en-US"), /4\/9\/2026|04\/09\/2026/);
  assert.match(formatDate(value, "zh-CN"), /2026\/4\/9|2026\/04\/09/);
});

test("supported locale list stays limited to the phase-one languages", () => {
  assert.deepEqual(supportedLocales, ["en-US", "zh-CN"]);
});
