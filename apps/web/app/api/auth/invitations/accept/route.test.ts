import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { getSessionCookieName } from "../../../../../lib/auth-session";
import { handleInvitationAcceptPost } from "./route";

function createInvitationAcceptRequest(
  formData: FormData,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/auth/invitations/accept`, {
    method: "POST",
    body: formData,
    headers: {
      origin,
    },
  });
}

test("handleInvitationAcceptPost redirects to login when token is missing", async () => {
  const response = await handleInvitationAcceptPost(
    createInvitationAcceptRequest(new FormData()),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost:3105/login");
});

test("handleInvitationAcceptPost redirects with rate_limited when the guard rejects the request", async () => {
  const formData = new FormData();
  formData.set("token", "invite_token_123");
  formData.set("password", "new-password");
  formData.set("confirmPassword", "new-password");

  const response = await handleInvitationAcceptPost(
    createInvitationAcceptRequest(formData),
    {
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
    "http://localhost:3105/invite/invite_token_123?error=rate_limited",
  );
});

test("handleInvitationAcceptPost preserves the successful redirect and session cookie flow", async () => {
  const formData = new FormData();
  formData.set("token", "invite_token_123");
  formData.set("firstName", "Acre");
  formData.set("lastName", "Agent");
  formData.set("password", "new-password");
  formData.set("confirmPassword", "new-password");

  const response = await handleInvitationAcceptPost(
    createInvitationAcceptRequest(formData),
    {
      acceptInvitation: async () =>
        ({
          status: "success",
          context: {
            currentMembership: {
              id: "membership_1",
              permissions: [],
              role: "office_admin",
            },
            currentOffice: {
              id: "office_1",
            },
            currentUser: {
              locale: "en-US",
            },
          },
        }) as never,
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
    "http://localhost:3105/office/dashboard",
  );
  assert.match(response.headers.get("set-cookie") ?? "", new RegExp(getSessionCookieName()));
});
