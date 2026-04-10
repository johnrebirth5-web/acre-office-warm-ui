import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { getSessionCookieName } from "../../../../lib/auth-session";
import { handleLoginPost } from "./route";

function createLoginRequest(formData: FormData, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/auth/login`, {
    method: "POST",
    body: formData,
    headers: {
      origin,
    },
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleLoginPost returns 403 when csrf validation fails", async () => {
  const formData = new FormData();
  formData.set("email", "agent@example.com");
  formData.set("password", "bad-password");

  const response = await handleLoginPost(createLoginRequest(formData), {
    csrf: () => false,
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await readJson(response), {
    error: "CSRF validation failed.",
  });
});

test("handleLoginPost returns 429 when the login rate limit is exceeded", async () => {
  const formData = new FormData();
  formData.set("email", "agent@example.com");
  formData.set("password", "bad-password");

  const response = await handleLoginPost(createLoginRequest(formData), {
    csrf: () => true,
    rateLimit: () => ({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      retryAfterSeconds: 30,
    }),
  });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "30");
  assert.deepEqual(await readJson(response), {
    error: "Too many login attempts. Please try again in a moment.",
  });
});

test("handleLoginPost preserves the successful redirect flow after csrf and rate-limit checks", async () => {
  const formData = new FormData();
  formData.set("email", "agent@example.com");
  formData.set("password", "correct-password");

  const response = await handleLoginPost(createLoginRequest(formData), {
    csrf: () => true,
    rateLimit: () => ({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    }),
    authenticatePasswordUser: async () =>
      ({
        status: "success",
        context: {
          currentMembership: {
            id: "membership_1",
            role: "office_admin",
            permissions: [],
          },
          currentCredential: {
            mustChangePassword: false,
          },
          currentUser: {
            email: "agent@example.com",
            firstName: "Acre",
            lastName: "Agent",
            locale: "en-US",
          },
        },
      }) as never,
  });

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://localhost:3105/office/dashboard",
  );

  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, new RegExp(getSessionCookieName()));
});
