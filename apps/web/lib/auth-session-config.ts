const DEV_SESSION_SECRET = "acre-local-session-dev-only";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

export function getSessionSecret() {
  const configuredSecret = process.env.ACRE_SESSION_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("ACRE_SESSION_SECRET is required in production.");
  }

  return DEV_SESSION_SECRET;
}

export function shouldUseSecureCookies() {
  const forceSecureCookies = process.env.ACRE_SECURE_COOKIES;
  return forceSecureCookies ? forceSecureCookies !== "false" : process.env.NODE_ENV === "production";
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    priority: "high" as const,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS
  };
}
