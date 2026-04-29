import assert from "node:assert/strict";
import test from "node:test";
import type { SessionMembershipContext } from "@acre/db";
import { encodeAdminGptOAuthToken } from "./oauth";
import { resolveAdminGptActionContext } from "./route-auth";

const originalSigningSecret = process.env.ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET;

test.after(() => {
  if (originalSigningSecret === undefined) {
    delete process.env.ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET;
  } else {
    process.env.ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET = originalSigningSecret;
  }
});

function createRequest(token: string | null) {
  return {
    headers: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function createContext(role: SessionMembershipContext["currentMembership"]["role"] = "office_admin") {
  return {
    accessibleOffices: [],
    currentCredential: null,
    currentMembership: {
      id: "membership_1",
      permissions: ["ai:use"],
      role,
      status: "active",
      title: "Admin",
    },
    currentOffice: null,
    currentOrganization: {
      id: "org_1",
      name: "Acre",
      slug: "acre",
      timezone: "America/New_York",
    },
    currentUser: {
      email: "admin@acre.test",
      firstName: "Admin",
      id: "user_1",
      lastName: "User",
      locale: "en-US",
      timezone: "America/New_York",
    },
  } as SessionMembershipContext;
}

function createAccessToken() {
  process.env.ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET = "0123456789abcdef0123456789abcdef";

  return encodeAdminGptOAuthToken({
    activeOfficeId: null,
    clientId: "acre-admin-gpt",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    membershipId: "membership_1",
    organizationId: "org_1",
    redirectUri: "https://chat.openai.com/aip/callback",
    scope: "admin_help:read",
    tokenType: "access",
    v: 1,
  });
}

test("resolveAdminGptActionContext rejects missing bearer tokens", async () => {
  await assert.rejects(
    () => resolveAdminGptActionContext(createRequest(null)),
    /Bearer token required/,
  );
});

test("resolveAdminGptActionContext resolves valid admin tokens", async () => {
  const token = createAccessToken();
  const context = await resolveAdminGptActionContext(createRequest(token), {
    getSessionMembershipContext: async () => createContext(),
  });

  assert.equal(context.currentMembership.id, "membership_1");
});

test("resolveAdminGptActionContext rejects non-admin token contexts", async () => {
  const token = createAccessToken();

  await assert.rejects(
    () =>
      resolveAdminGptActionContext(createRequest(token), {
        getSessionMembershipContext: async () => createContext("agent"),
      }),
    /access denied/i,
  );
});
