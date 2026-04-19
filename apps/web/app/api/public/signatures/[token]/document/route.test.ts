import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handlePublicSignatureDocumentGet } from "./route";

function createPublicSignatureDocumentRequest(
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/public/signatures/token_123/document`, {
    headers: {
      origin,
      "x-forwarded-for": "203.0.113.7",
    },
  });
}

test("handlePublicSignatureDocumentGet returns 429 when the read rate limit is exceeded", async () => {
  const response = await handlePublicSignatureDocumentGet(
    createPublicSignatureDocumentRequest(),
    { token: "token_123" },
    {
      rateLimit: async () => ({
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        retryAfterSeconds: 30,
      }),
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.deepEqual(await response.json(), {
    error: "Too many signature view attempts. Please try again in a moment.",
  });
});

test("handlePublicSignatureDocumentGet returns 404 when the public document cannot be loaded", async () => {
  const response = await handlePublicSignatureDocumentGet(
    createPublicSignatureDocumentRequest(),
    { token: "token_123" },
    {
      rateLimit: async () => ({
        allowed: true,
        limit: 60,
        remaining: 59,
        resetAt: Date.now() + 30_000,
        retryAfterSeconds: 30,
      }),
      getPublicSignatureDocumentStorageRecord: async () => null,
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "Signature document not found.",
  });
});
