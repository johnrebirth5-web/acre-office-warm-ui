import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleListingStudioExtensionStatusGet } from "./route";

function createListingStudioExtensionStatusRequest(
  origin = "http://localhost:3105",
  challengeToken = "ls_chal_123",
) {
  return new NextRequest(
    `${origin}/api/listing-studio/extension/connect/status?challengeToken=${challengeToken}`,
    {
      headers: {
        origin,
        "x-forwarded-for": "203.0.113.7",
      },
    },
  );
}

test("handleListingStudioExtensionStatusGet returns 429 when polling is rate limited", async () => {
  const response = await handleListingStudioExtensionStatusGet(
    createListingStudioExtensionStatusRequest(),
    {
      rateLimit: async () => ({
        allowed: false,
        limit: 240,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        retryAfterSeconds: 30,
      }),
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.deepEqual(await response.json(), {
    error: "Too many extension status checks. Please try again in a moment.",
  });
});

test("handleListingStudioExtensionStatusGet returns the polling payload on success", async () => {
  const response = await handleListingStudioExtensionStatusGet(
    createListingStudioExtensionStatusRequest(),
    {
      rateLimit: async () => ({
        allowed: true,
        limit: 240,
        remaining: 239,
        resetAt: Date.now() + 30_000,
        retryAfterSeconds: 30,
      }),
      pollStudioListingExtensionChallenge: async () =>
        ({ status: "pending" }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "pending",
  });
});
