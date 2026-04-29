import assert from "node:assert/strict";
import test from "node:test";
import type { SessionMembershipContext } from "@acre/db";
import {
  AdminGptOAuthError,
  createAdminGptAuthorizationCode,
  decodeAdminGptOAuthToken,
  encodeAdminGptOAuthToken,
  exchangeAdminGptAuthorizationCode,
  readBasicClientCredentials,
} from "./oauth";

type EnvKey =
  | "ACRE_ADMIN_GPT_ALLOWED_REDIRECT_HOSTS"
  | "ACRE_ADMIN_GPT_OAUTH_CLIENT_ID"
  | "ACRE_ADMIN_GPT_OAUTH_CLIENT_SECRET"
  | "ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET"
  | "ACRE_SESSION_SECRET";

const originalEnv = {
  ACRE_ADMIN_GPT_ALLOWED_REDIRECT_HOSTS: process.env.ACRE_ADMIN_GPT_ALLOWED_REDIRECT_HOSTS,
  ACRE_ADMIN_GPT_OAUTH_CLIENT_ID: process.env.ACRE_ADMIN_GPT_OAUTH_CLIENT_ID,
  ACRE_ADMIN_GPT_OAUTH_CLIENT_SECRET: process.env.ACRE_ADMIN_GPT_OAUTH_CLIENT_SECRET,
  ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET: process.env.ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET,
  ACRE_SESSION_SECRET: process.env.ACRE_SESSION_SECRET,
} satisfies Record<EnvKey, string | undefined>;

function withEnv<T>(updates: Partial<Record<EnvKey, string | undefined>>, fn: () => T) {
  const mutableEnv = process.env as Record<string, string | undefined>;

  for (const [key, value] of Object.entries(updates) as Array<[EnvKey, string | undefined]>) {
    if (value === undefined) {
      delete mutableEnv[key];
    } else {
      mutableEnv[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(originalEnv) as Array<[EnvKey, string | undefined]>) {
      if (value === undefined) {
        delete mutableEnv[key];
      } else {
        mutableEnv[key] = value;
      }
    }
  }
}

function createContext(overrides: Partial<SessionMembershipContext["currentMembership"]> = {}) {
  return {
    accessibleOffices: [
      {
        id: "office_1",
        market: "NY",
        name: "Acre NY",
        slug: "acre-ny",
      },
    ],
    currentCredential: null,
    currentMembership: {
      id: "membership_1",
      permissions: ["ai:use"],
      role: "office_admin",
      status: "active",
      title: "Admin",
      ...overrides,
    },
    currentOffice: {
      id: "office_1",
      market: "NY",
      name: "Acre NY",
      slug: "acre-ny",
    },
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

function withOAuthEnv<T>(fn: () => T) {
  return withEnv(
    {
      ACRE_ADMIN_GPT_ALLOWED_REDIRECT_HOSTS: "chat.openai.com",
      ACRE_ADMIN_GPT_OAUTH_CLIENT_ID: "acre-admin-gpt",
      ACRE_ADMIN_GPT_OAUTH_CLIENT_SECRET: "client-secret",
      ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
    },
    fn,
  );
}

test("createAdminGptAuthorizationCode and exchangeAdminGptAuthorizationCode issue a short-lived bearer token", () => {
  withOAuthEnv(() => {
    const code = createAdminGptAuthorizationCode({
      clientId: "acre-admin-gpt",
      context: createContext(),
      redirectUri: "https://chat.openai.com/aip/callback",
      scope: "admin_help:read",
    });
    const result = exchangeAdminGptAuthorizationCode({
      clientId: "acre-admin-gpt",
      clientSecret: "client-secret",
      code,
      redirectUri: "https://chat.openai.com/aip/callback",
    });
    const payload = decodeAdminGptOAuthToken(result.accessToken, "access");

    assert.equal(result.tokenType, "Bearer");
    assert.equal(result.expiresIn, 3600);
    assert.equal(payload.membershipId, "membership_1");
    assert.equal(payload.organizationId, "org_1");
    assert.equal(payload.scope, "admin_help:read");
  });
});

test("exchangeAdminGptAuthorizationCode rejects an invalid client secret", () => {
  withOAuthEnv(() => {
    const code = createAdminGptAuthorizationCode({
      clientId: "acre-admin-gpt",
      context: createContext(),
      redirectUri: "https://chat.openai.com/aip/callback",
      scope: "admin_help:read",
    });

    assert.throws(
      () =>
        exchangeAdminGptAuthorizationCode({
          clientId: "acre-admin-gpt",
          clientSecret: "wrong-secret",
          code,
          redirectUri: "https://chat.openai.com/aip/callback",
        }),
      (error) => error instanceof AdminGptOAuthError && error.code === "invalid_client",
    );
  });
});

test("decodeAdminGptOAuthToken rejects expired tokens", () => {
  withOAuthEnv(() => {
    const expired = encodeAdminGptOAuthToken({
      activeOfficeId: "office_1",
      clientId: "acre-admin-gpt",
      exp: 1,
      iat: 1,
      membershipId: "membership_1",
      organizationId: "org_1",
      redirectUri: "https://chat.openai.com/aip/callback",
      scope: "admin_help:read",
      tokenType: "access",
      v: 1,
    });

    assert.throws(
      () => decodeAdminGptOAuthToken(expired, "access"),
      (error) => error instanceof AdminGptOAuthError && error.code === "invalid_grant",
    );
  });
});

test("createAdminGptAuthorizationCode rejects non-admin accounts", () => {
  withOAuthEnv(() => {
    assert.throws(
      () =>
        createAdminGptAuthorizationCode({
          clientId: "acre-admin-gpt",
          context: createContext({ permissions: ["ai:use"], role: "agent" }),
          redirectUri: "https://chat.openai.com/aip/callback",
          scope: "admin_help:read",
        }),
      (error) => error instanceof AdminGptOAuthError && error.code === "access_denied",
    );
  });
});

test("readBasicClientCredentials parses OAuth basic auth", () => {
  const encoded = Buffer.from("acre-admin-gpt:client-secret").toString("base64");

  assert.deepEqual(readBasicClientCredentials(`Basic ${encoded}`), {
    clientId: "acre-admin-gpt",
    clientSecret: "client-secret",
  });
});
