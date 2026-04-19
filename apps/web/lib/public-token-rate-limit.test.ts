import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicTokenRateLimitKey, buildPublicTokenRateLimitResponse, consumePublicTokenRateLimit } from "./public-token-rate-limit";

test("buildPublicTokenRateLimitKey hashes the token segment instead of exposing the raw token", () => {
  const key = buildPublicTokenRateLimitKey(
    "public/signatures/read",
    {
      get(name: string) {
        return name.toLowerCase() === "x-forwarded-for" ? "203.0.113.7" : null;
      },
    },
    "token_123",
  );

  assert.match(key, /^public\/signatures\/read:203\.0\.113\.7:[a-f0-9]{24}$/);
  assert.equal(key.includes("token_123"), false);
});

test("consumePublicTokenRateLimit forwards the hashed key to the injected consumer", async () => {
  let capturedKey = "";

  const decision = await consumePublicTokenRateLimit({
    scope: "public/invitations/read",
    request: {
      get(name: string) {
        return name.toLowerCase() === "x-real-ip" ? "198.51.100.11" : null;
      },
    },
    token: "invite_token_123",
    options: {
      limit: 40,
      windowMs: 600_000,
    },
    consumer: async (key) => {
      capturedKey = key;
      return {
        allowed: true,
        limit: 40,
        remaining: 39,
        resetAt: Date.now() + 60_000,
        retryAfterSeconds: 60,
      };
    },
  });

  assert.equal(decision.allowed, true);
  assert.match(capturedKey, /^public\/invitations\/read:198\.51\.100\.11:[a-f0-9]{24}$/);
  assert.equal(capturedKey.includes("invite_token_123"), false);
});

test("buildPublicTokenRateLimitResponse sets retry headers for callers", async () => {
  const response = buildPublicTokenRateLimitResponse(
    "Too many signature view attempts. Please try again in a moment.",
    45,
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "45");
  assert.deepEqual(await response.json(), {
    error: "Too many signature view attempts. Please try again in a moment.",
  });
});
