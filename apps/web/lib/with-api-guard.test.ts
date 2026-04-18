import assert from "node:assert/strict";
import test from "node:test";
import { type NextRequest } from "next/server";
import { withApiGuard } from "./with-api-guard";

function createRequest() {
  return new Request(
    "https://example.com/api/office/settings/test",
  ) as NextRequest;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("withApiGuard returns 403 for csrf failures and preserves no-store headers", async () => {
  const response = await withApiGuard(
    createRequest(),
    async () => new Response("ok"),
    {
      cacheControlNoStore: true,
      csrf: () => false,
    },
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await readJson(response), {
    error: "CSRF validation failed.",
  });
});

test("withApiGuard returns 401 when auth is required but session is missing", async () => {
  const response = await withApiGuard(
    createRequest(),
    async () => new Response("ok"),
    {
      getRequestSessionContext: async () => null,
      requireAuth: true,
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "Authentication required.",
  });
});

test("withApiGuard returns 403 when access is denied", async () => {
  const response = await withApiGuard(
    createRequest(),
    async () => new Response("ok"),
    {
      canAccess: () => false,
      forbiddenMessage: "Permission required.",
      getRequestSessionContext: async () =>
        ({
          currentMembership: {
            id: "member_1",
          },
        }) as never,
      requireAuth: true,
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Permission required.",
  });
});

test("withApiGuard returns 429 when rate limit is exceeded", async () => {
  const response = await withApiGuard(
    createRequest(),
    async () => new Response("ok"),
    {
      cacheControlNoStore: true,
      prepare: async () => ({ email: "agent@example.com" }),
      rateLimit: {
        consumer: () => ({
          allowed: false,
          limit: 10,
          remaining: 0,
          resetAt: Date.now() + 30_000,
          retryAfterSeconds: 30,
        }),
        key: () => "login:agent@example.com",
        message: "Too many login attempts. Please try again in a moment.",
        options: {
          limit: 10,
          windowMs: 15 * 60 * 1000,
        },
      },
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "30");
  assert.deepEqual(await readJson(response), {
    error: "Too many login attempts. Please try again in a moment.",
  });
});

test("withApiGuard runs prepare once and passes prepared input to the handler", async () => {
  let prepareCalls = 0;

  const response = await withApiGuard(
    createRequest(),
    async ({ prepared }) =>
      new Response(JSON.stringify(prepared), { status: 200 }),
    {
      prepare: async () => {
        prepareCalls += 1;
        return { email: "agent@example.com" };
      },
    },
  );

  assert.equal(prepareCalls, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    email: "agent@example.com",
  });
});

test("withApiGuard supports custom unauthorized responses", async () => {
  const response = await withApiGuard(
    createRequest(),
    async () => new Response("ok"),
    {
      getRequestSessionContext: async () => null,
      onUnauthorized: () =>
        new Response(null, {
          status: 303,
          headers: {
            location: "/login",
          },
        }),
      requireAuth: true,
    },
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/login");
});

test("withApiGuard supports custom rate-limit rejection responses", async () => {
  const response = await withApiGuard(
    createRequest(),
    async () => new Response("ok"),
    {
      prepare: async () => ({ token: "invite_123" }),
      rateLimit: {
        consumer: () => ({
          allowed: false,
          limit: 10,
          remaining: 0,
          resetAt: Date.now() + 30_000,
          retryAfterSeconds: 30,
        }),
        key: () => "invite_123",
        message: "Too many attempts.",
        onRejected: ({ prepared }) =>
          new Response(null, {
            status: 303,
            headers: {
              location: `/invite/${prepared.token}?error=rate_limited`,
            },
          }),
        options: {
          limit: 10,
          windowMs: 15 * 60 * 1000,
        },
      },
    },
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "/invite/invite_123?error=rate_limited",
  );
});
