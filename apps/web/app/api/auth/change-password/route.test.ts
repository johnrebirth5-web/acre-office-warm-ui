import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleChangePasswordPost } from "./route";
import { getSessionCookieName } from "../../../../lib/auth-session";

function createChangePasswordRequest(
  formData: FormData,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/auth/change-password`, {
    method: "POST",
    body: formData,
    headers: {
      origin,
    },
  });
}

function createSessionContext(options: { mustChangePassword?: boolean } = {}) {
  return {
    currentCredential: {
      mustChangePassword: options.mustChangePassword ?? false,
    },
    currentMembership: {
      id: "membership_1",
      permissions: [],
      role: "office_admin",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

test("handleChangePasswordPost redirects unauthenticated users to login", async () => {
  const formData = new FormData();
  formData.set("currentPassword", "old-password");
  formData.set("newPassword", "new-password");
  formData.set("confirmPassword", "new-password");

  const response = await handleChangePasswordPost(
    createChangePasswordRequest(formData),
    {
      getRequestSessionContext: async () => null,
    },
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost:3105/login");
});

test("handleChangePasswordPost redirects with rate_limited when the guard rejects the request", async () => {
  const formData = new FormData();
  formData.set("currentPassword", "old-password");
  formData.set("newPassword", "new-password");
  formData.set("confirmPassword", "new-password");

  const response = await handleChangePasswordPost(
    createChangePasswordRequest(formData),
    {
      getRequestSessionContext: async () => createSessionContext(),
      rateLimit: async () => ({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        retryAfterSeconds: 30,
      }),
    },
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://localhost:3105/change-password?error=rate_limited",
  );
});

test("handleChangePasswordPost preserves the successful redirect after the shared guard passes", async () => {
  const formData = new FormData();
  formData.set("currentPassword", "old-password");
  formData.set("newPassword", "new-password");
  formData.set("confirmPassword", "new-password");

  const response = await handleChangePasswordPost(
    createChangePasswordRequest(formData),
    {
      changeInternalPassword: async () => undefined,
      getRequestSessionContext: async () => createSessionContext(),
      rateLimit: async () => ({
        allowed: true,
        limit: 10,
        remaining: 9,
        resetAt: Date.now() + 30_000,
        retryAfterSeconds: 30,
      }),
    },
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://localhost:3105/office/account",
  );
  assert.match(
    response.headers.get("set-cookie") ?? "",
    new RegExp(getSessionCookieName()),
  );
});
