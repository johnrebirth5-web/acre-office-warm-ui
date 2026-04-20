import assert from "node:assert/strict";
import test from "node:test";
import {
  resetRateLimitStateForTesting,
} from "./rate-limit";
import {
  buildPublicTokenRateLimitKey,
  buildPublicTokenRateLimitResponse,
  consumePublicTokenRateLimit,
} from "./public-token-rate-limit";

function captureStderrWrites() {
  const writes: string[] = [];
  const originalWrite = process.stderr.write;

  process.stderr.write = ((chunk: string | Uint8Array) => {
    writes.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
    );
    return true;
  }) as typeof process.stderr.write;

  return {
    restore() {
      process.stderr.write = originalWrite;
    },
    writes,
  };
}

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

test("buildPublicTokenRateLimitKey prefers a direct header reader over an unrelated headers field", () => {
  const key = buildPublicTokenRateLimitKey(
    "public/listing-studio/packs/read",
    {
      get(name: string) {
        return name.toLowerCase() === "x-forwarded-for" ? "198.51.100.42" : null;
      },
      headers: {},
    } as {
      get(name: string): string | null;
      headers: Record<string, never>;
    },
    "pack_token_123",
  );

  assert.match(
    key,
    /^public\/listing-studio\/packs\/read:198\.51\.100\.42:[a-f0-9]{24}$/,
  );
  assert.equal(key.includes("pack_token_123"), false);
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

test("consumePublicTokenRateLimit falls back to per-process memory when the shared backend throws", async () => {
  resetRateLimitStateForTesting();
  const stderr = captureStderrWrites();

  try {
    const firstDecision = await consumePublicTokenRateLimit({
      scope: "public/signatures/read",
      request: {
        get(name: string) {
          return name.toLowerCase() === "x-forwarded-for"
            ? "203.0.113.7"
            : null;
        },
      },
      token: "signature_token_123",
      options: {
        limit: 1,
        windowMs: 60_000,
        now: 1_000,
      },
      consumer: async () => {
        throw new Error("upstash unavailable");
      },
    });

    const secondDecision = await consumePublicTokenRateLimit({
      scope: "public/signatures/read",
      request: {
        get(name: string) {
          return name.toLowerCase() === "x-forwarded-for"
            ? "203.0.113.7"
            : null;
        },
      },
      token: "signature_token_123",
      options: {
        limit: 1,
        windowMs: 60_000,
        now: 1_500,
      },
      consumer: async () => {
        throw new Error("upstash unavailable");
      },
    });

    assert.equal(firstDecision.allowed, true);
    assert.equal(firstDecision.remaining, 0);
    assert.equal(secondDecision.allowed, false);
    assert.equal(secondDecision.retryAfterSeconds, 60);
    assert.ok(stderr.writes.length >= 2);

    const payload = JSON.parse(stderr.writes[0]?.trim() ?? "{}") as {
      error?: string;
      key?: string;
      kind?: string;
      scope?: string;
    };

    assert.equal(payload.kind, "public_token_rate_limit_fallback");
    assert.equal(payload.scope, "public/signatures/read");
    assert.match(payload.key ?? "", /^public\/signatures\/read:203\.0\.113\.7:[a-f0-9]{24}$/);
    assert.equal(payload.error, "upstash unavailable");
  } finally {
    stderr.restore();
    resetRateLimitStateForTesting();
  }
});
