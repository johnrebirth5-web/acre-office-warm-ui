import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createUpstashRateLimitConsumer,
  getRequestClientIdentifier,
  hashRateLimitSegment,
  rateLimitTesting,
  resetRateLimitStateForTesting,
  resolveRateLimitBackend,
} from "./rate-limit";

function createRequest(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    } as Headers,
  };
}

test("buildRateLimitKey uses the forwarded client identifier and stable hashed segments", () => {
  const hashedEmail = hashRateLimitSegment("agent@example.com");
  const key = buildRateLimitKey(
    "auth/login",
    createRequest({
      "x-forwarded-for": "203.0.113.7, 10.0.0.4",
      host: "acresystem.us",
    }),
    hashedEmail,
  );

  assert.equal(key, `auth/login:203.0.113.7:${hashedEmail}`);
  assert.notEqual(hashedEmail, "agent@example.com");
  assert.equal(hashRateLimitSegment("agent@example.com"), hashedEmail);
});

test("getRequestClientIdentifier honors trusted proxy header priority modes", () => {
  const request = createRequest({
    "cf-connecting-ip": "198.51.100.8",
    "x-forwarded-for": "203.0.113.7, 10.0.0.4",
    "x-real-ip": "192.0.2.5",
    host: "acresystem.us",
  });

  assert.equal(getRequestClientIdentifier(request), "203.0.113.7");
  assert.equal(
    getRequestClientIdentifier(request, {
      ACRE_TRUSTED_PROXY_TIER: "cloudflare",
    }),
    "198.51.100.8",
  );
  assert.equal(
    getRequestClientIdentifier(request, {
      ACRE_TRUSTED_PROXY_TIER: "reverse-proxy",
    }),
    "192.0.2.5",
  );
  assert.equal(rateLimitTesting.resolveTrustedProxyTier({}), "none");
});

test("consumeRateLimit enforces the in-memory fixed window and resets after expiry", async () => {
  resetRateLimitStateForTesting();
  const key = "auth/login:203.0.113.7:user";

  const firstDecision = await consumeRateLimit(key, {
    limit: 2,
    windowMs: 1_000,
    now: 1_000,
  });
  const secondDecision = await consumeRateLimit(key, {
    limit: 2,
    windowMs: 1_000,
    now: 1_100,
  });
  const blockedDecision = await consumeRateLimit(key, {
    limit: 2,
    windowMs: 1_000,
    now: 1_200,
  });
  const resetDecision = await consumeRateLimit(key, {
    limit: 2,
    windowMs: 1_000,
    now: 2_100,
  });

  assert.equal(firstDecision.allowed, true);
  assert.equal(firstDecision.remaining, 1);
  assert.equal(secondDecision.allowed, true);
  assert.equal(secondDecision.remaining, 0);
  assert.equal(blockedDecision.allowed, false);
  assert.equal(blockedDecision.remaining, 0);
  assert.equal(resetDecision.allowed, true);
  assert.equal(resetDecision.remaining, 1);
});

test("resolveRateLimitBackend defaults to memory and honors explicit upstash configuration", () => {
  assert.equal(resolveRateLimitBackend({}), "memory");
  assert.equal(
    resolveRateLimitBackend({ ACRE_RATE_LIMIT_BACKEND: "upstash" }),
    "upstash",
  );
});

test("createUpstashRateLimitConsumer sends the expected pipeline request", async () => {
  const requests: Array<{
    url: string;
    init: RequestInit | undefined;
  }> = [];
  const consumeUpstashRateLimit = createUpstashRateLimitConsumer({
    env: {
      ACRE_RATE_LIMIT_BACKEND: "upstash",
      ACRE_UPSTASH_REDIS_REST_URL: "https://upstash.example.com",
      ACRE_UPSTASH_REDIS_REST_TOKEN: "secret-token",
    },
    fetch: async (url, init) => {
      requests.push({
        url: String(url),
        init,
      });

      return new Response(
        JSON.stringify([
          { result: 3 },
          { result: 1 },
          { result: 9_000 },
        ]),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  });

  const decision = await consumeUpstashRateLimit("scope:key", {
    limit: 2,
    windowMs: 9_000,
    now: 500,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.remaining, 0);
  assert.equal(decision.retryAfterSeconds, 9);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://upstash.example.com/pipeline");
  assert.equal(
    (requests[0]?.init?.headers as Record<string, string>).Authorization,
    "Bearer secret-token",
  );
  assert.equal(
    requests[0]?.init?.body,
    JSON.stringify([
      ["INCR", "scope:key"],
      ["PEXPIRE", "scope:key", "9000", "NX"],
      ["PTTL", "scope:key"],
    ]),
  );
});

test("consumeRateLimit routes through the upstash backend when configured", async () => {
  const requests: string[] = [];

  const decision = await consumeRateLimit(
    "scope:key",
    {
      limit: 1,
      windowMs: 1_000,
    },
    {
      env: {
        ACRE_RATE_LIMIT_BACKEND: "upstash",
        ACRE_UPSTASH_REDIS_REST_URL: "https://upstash.example.com",
        ACRE_UPSTASH_REDIS_REST_TOKEN: "secret-token",
      },
      fetch: async (url) => {
        requests.push(String(url));

        return new Response(
          JSON.stringify([
            { result: 1 },
            { result: 1 },
            { result: 1_000 },
          ]),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      },
    },
  );

  assert.equal(decision.allowed, true);
  assert.equal(requests[0], "https://upstash.example.com/pipeline");
});

test("createUpstashRateLimitConsumer fails fast when configuration is incomplete", async () => {
  const consumeUpstashRateLimit = createUpstashRateLimitConsumer({
    env: {
      ACRE_RATE_LIMIT_BACKEND: "upstash",
    },
  });

  await assert.rejects(
    async () =>
      consumeUpstashRateLimit("scope:key", {
        limit: 1,
        windowMs: 1_000,
      }),
    /ACRE_RATE_LIMIT_BACKEND=upstash requires/,
  );
});

test("consumeRateLimit logs a structured rejection only when a request is blocked", async () => {
  resetRateLimitStateForTesting();
  const calls: string[] = [];
  const originalConsoleError = console.error;

  console.error = (value?: unknown) => {
    calls.push(String(value));
  };

  try {
    await consumeRateLimit("auth/login:203.0.113.7:user", {
      limit: 1,
      windowMs: 1_000,
      now: 100,
    });
    await consumeRateLimit("auth/login:203.0.113.7:user", {
      limit: 1,
      windowMs: 1_000,
      now: 200,
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(calls.length, 1);
  assert.match(calls[0] ?? "", /"event":"rate_limit_rejected"/);
});

test("consumeRateLimit honors a custom onDecision hook without default logging", async () => {
  resetRateLimitStateForTesting();
  const decisions: Array<{ key: string; allowed: boolean }> = [];
  const originalConsoleError = console.error;
  let consoleErrorCalls = 0;

  console.error = () => {
    consoleErrorCalls += 1;
  };

  try {
    await consumeRateLimit("auth/login:203.0.113.7:user", {
      limit: 1,
      onDecision: ({ key, decision }) => {
        decisions.push({ key, allowed: decision.allowed });
      },
      windowMs: 1_000,
      now: 100,
    });
    await consumeRateLimit("auth/login:203.0.113.7:user", {
      limit: 1,
      onDecision: ({ key, decision }) => {
        decisions.push({ key, allowed: decision.allowed });
      },
      windowMs: 1_000,
      now: 200,
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(decisions, [
    { key: "auth/login:203.0.113.7:user", allowed: true },
    { key: "auth/login:203.0.113.7:user", allowed: false },
  ]);
  assert.equal(consoleErrorCalls, 0);
});
