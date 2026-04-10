import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { getSessionCookieOptions, getSessionMaxAgeMs, getSessionSecret, shouldUseSecureCookies } from "./auth-session-config.ts";
import { createSessionCookieValue, decodeSessionCookieValue } from "./auth-session.ts";

function withEnv(
  nextEnv: Partial<
    Record<"NODE_ENV" | "ACRE_SESSION_SECRET" | "ACRE_SESSION_SECRET_SECONDARY" | "ACRE_SECURE_COOKIES", string | undefined>
  >,
  run: () => void
) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ACRE_SESSION_SECRET: process.env.ACRE_SESSION_SECRET,
    ACRE_SESSION_SECRET_SECONDARY: process.env.ACRE_SESSION_SECRET_SECONDARY,
    ACRE_SECURE_COOKIES: process.env.ACRE_SECURE_COOKIES
  };

  for (const [key, value] of Object.entries(nextEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function signSessionPayload(membershipId: string, secret: string, issuedAt = Date.now()) {
  const serializedPayload = Buffer.from(
    JSON.stringify({
      membershipId,
      issuedAt
    })
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(serializedPayload).digest("base64url");

  return `${serializedPayload}.${signature}`;
}

test("secure cookie behavior stays explicit and proxy-safe", () => {
  withEnv({ NODE_ENV: "production", ACRE_SECURE_COOKIES: undefined }, () => {
    assert.equal(shouldUseSecureCookies(), true);
    assert.equal(getSessionCookieOptions().secure, true);
  });

  withEnv({ NODE_ENV: "production", ACRE_SECURE_COOKIES: "false" }, () => {
    assert.equal(shouldUseSecureCookies(), false);
    assert.equal(getSessionCookieOptions().secure, false);
  });

  withEnv({ NODE_ENV: "development", ACRE_SECURE_COOKIES: "true" }, () => {
    assert.equal(shouldUseSecureCookies(), true);
    assert.equal(getSessionCookieOptions().secure, true);
  });
});

test("production session creation requires an explicit secret", () => {
  withEnv({ NODE_ENV: "production", ACRE_SESSION_SECRET: undefined }, () => {
    assert.throws(() => getSessionSecret(), /ACRE_SESSION_SECRET is required in production/);
  });

  withEnv({ NODE_ENV: "production", ACRE_SESSION_SECRET: "0123456789abcdef0123456789abcdef" }, () => {
    assert.equal(getSessionSecret(), "0123456789abcdef0123456789abcdef");
  });
});

test("production session secrets reject weak placeholder values", () => {
  withEnv({ NODE_ENV: "production", ACRE_SESSION_SECRET: "replace-with-a-local-session-secret" }, () => {
    assert.throws(() => getSessionSecret(), /must be a strong generated secret in production/);
  });

  withEnv(
    {
      NODE_ENV: "production",
      ACRE_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      ACRE_SESSION_SECRET_SECONDARY: "replace-with-a-previous-session-secret"
    },
    () => {
      assert.throws(() => getSessionSecret(), /must be a strong generated secret in production/);
    }
  );
});

test("session cookies sign with the primary secret and verify with a secondary secret during rotation", () => {
  withEnv(
    {
      NODE_ENV: "production",
      ACRE_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      ACRE_SESSION_SECRET_SECONDARY: "fedcba9876543210fedcba9876543210"
    },
    () => {
      const primaryCookieValue = createSessionCookieValue("membership-primary");
      const primaryPayload = decodeSessionCookieValue(primaryCookieValue);

      assert.equal(primaryPayload?.membershipId, "membership-primary");

      const secondaryCookieValue = signSessionPayload("membership-secondary", "fedcba9876543210fedcba9876543210");
      const secondaryPayload = decodeSessionCookieValue(secondaryCookieValue);

      assert.equal(secondaryPayload?.membershipId, "membership-secondary");
    }
  );
});

test("session cookies keep the expected internal-account defaults", () => {
  withEnv({ NODE_ENV: "development", ACRE_SECURE_COOKIES: undefined }, () => {
    const options = getSessionCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.maxAge, 60 * 60 * 24 * 30);
    assert.equal(options.path, "/");
  });
});

test("session decoding rejects cookies older than the configured max age", () => {
  withEnv({ NODE_ENV: "development", ACRE_SESSION_SECRET: "test-secret" }, () => {
    const expiredPayload = Buffer.from(
      JSON.stringify({
        membershipId: "membership-1",
        issuedAt: Date.now() - getSessionMaxAgeMs() - 1000
      })
    ).toString("base64url");
    const signature = createHmac("sha256", getSessionSecret()).update(expiredPayload).digest("base64url");

    assert.equal(decodeSessionCookieValue(`${expiredPayload}.${signature}`), null);
  });
});

test("session decoding accepts fresh signed cookies", () => {
  withEnv({ NODE_ENV: "development", ACRE_SESSION_SECRET: "test-secret" }, () => {
    const cookieValue = createSessionCookieValue("membership-1");
    const payload = decodeSessionCookieValue(cookieValue);

    assert.equal(payload?.membershipId, "membership-1");
    assert.equal(typeof payload?.issuedAt, "number");
  });
});
