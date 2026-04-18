import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  buildApiCsrfFailureResponse,
  isApiCsrfExemptPath,
  isCsrfSafeMethod,
  shouldEnforceApiCsrf,
  validateApiCsrf,
} from "./proxy";

function createRequest(
  path: string,
  options: {
    method?: string;
    origin?: string;
    referer?: string;
    host?: string;
    protocol?: "http" | "https";
  } = {},
) {
  const host = options.host ?? "acresystem.us";
  const protocol = options.protocol ?? "https";
  const headers = new Headers({
    host,
    "x-forwarded-host": host,
    "x-forwarded-proto": protocol,
  });

  if (options.origin) {
    headers.set("origin", options.origin);
  }

  if (options.referer) {
    headers.set("referer", options.referer);
  }

  return new NextRequest(`${protocol}://${host}${path}`, {
    method: options.method ?? "POST",
    headers,
  });
}

test("isCsrfSafeMethod recognizes read-only HTTP methods", () => {
  assert.equal(isCsrfSafeMethod("GET"), true);
  assert.equal(isCsrfSafeMethod("head"), true);
  assert.equal(isCsrfSafeMethod("OPTIONS"), true);
  assert.equal(isCsrfSafeMethod("POST"), false);
});

test("isApiCsrfExemptPath only bypasses exact extension-token endpoints", () => {
  assert.equal(isApiCsrfExemptPath("/api/listing-studio/extension/connect/start"), true);
  assert.equal(isApiCsrfExemptPath("/api/listing-studio/imports"), true);
  assert.equal(isApiCsrfExemptPath("/api/listing-studio/extension/connect/approve"), false);
  assert.equal(isApiCsrfExemptPath("/api/listing-studio/imports/import_123"), false);
});

test("shouldEnforceApiCsrf protects non-safe API writes while skipping safe or exempt requests", () => {
  assert.equal(
    shouldEnforceApiCsrf(createRequest("/api/auth/login", { method: "POST" })),
    true,
  );
  assert.equal(
    shouldEnforceApiCsrf(createRequest("/api/public/signatures/token/submit", { method: "POST" })),
    true,
  );
  assert.equal(
    shouldEnforceApiCsrf(createRequest("/api/listing-studio/extension/connect/start", { method: "POST" })),
    false,
  );
  assert.equal(
    shouldEnforceApiCsrf(createRequest("/api/health", { method: "GET" })),
    false,
  );
});

test("validateApiCsrf returns a 403 response for cross-origin protected requests", async () => {
  const response = validateApiCsrf(
    createRequest("/api/auth/login", {
      method: "POST",
      origin: "https://evil.example",
    }),
  );

  assert.ok(response);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: "CSRF validation failed.",
  });
});

test("validateApiCsrf accepts same-origin referer fallback when origin is absent", () => {
  const response = validateApiCsrf(
    createRequest("/api/auth/login", {
      method: "POST",
      referer: "https://acresystem.us/login",
    }),
  );

  assert.equal(response, null);
});

test("validateApiCsrf bypasses exempt extension-token writes", () => {
  const response = validateApiCsrf(
    createRequest("/api/listing-studio/imports", {
      method: "POST",
      origin: "chrome-extension://listing-studio",
    }),
  );

  assert.equal(response, null);
});

test("buildApiCsrfFailureResponse matches the shared error payload", async () => {
  const response = buildApiCsrfFailureResponse();

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "CSRF validation failed.",
  });
});
