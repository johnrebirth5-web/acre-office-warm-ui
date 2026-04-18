import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handlePublicSignatureSubmitPost } from "./route";

function createPublicSignatureSubmitRequest(
  body: Record<string, unknown>,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/public/signatures/token_123/submit`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      origin,
      "content-type": "application/json",
    },
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handlePublicSignatureSubmitPost returns 429 when the submit rate limit is exceeded", async () => {
  const response = await handlePublicSignatureSubmitPost(
    createPublicSignatureSubmitRequest({ values: [] }),
    {
      token: "token_123",
    },
    {
      rateLimit: async () => ({
        allowed: false,
        limit: 15,
        remaining: 0,
        resetAt: Date.now() + 45_000,
        retryAfterSeconds: 45,
      }),
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "45");
  assert.deepEqual(await readJson(response), {
    error: "Too many signature submit attempts. Please try again in a moment.",
  });
});

test("handlePublicSignatureSubmitPost returns 404 when the request snapshot cannot be loaded", async () => {
  const response = await handlePublicSignatureSubmitPost(
    createPublicSignatureSubmitRequest({ values: [] }),
    {
      token: "token_123",
    },
    {
      getPublicSignatureDocumentStorageRecord: async () => null,
      getPublicSignatureRequestSnapshot: async () => null,
      rateLimit: async () => ({
        allowed: true,
        limit: 15,
        remaining: 14,
        resetAt: Date.now() + 45_000,
        retryAfterSeconds: 45,
      }),
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), {
    error: "Signature request not found.",
  });
});
