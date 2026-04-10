const DEV_SESSION_SECRET = "acre-local-session-dev-only";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MIN_SESSION_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET_PATTERNS = [
  /replace-with/i,
  /generate-with/i,
  /set-with/i,
  /change-me/i,
  /test-secret/i,
  /dev-only/i,
  /development/i,
  /example/i,
  /placeholder/i
];

type SessionSecrets = {
  primary: string;
  secondary: string | null;
};

export function getSessionMaxAgeMs() {
  return SESSION_COOKIE_MAX_AGE_SECONDS * 1000;
}

function normalizeSecret(value: string | undefined) {
  const secret = value?.trim();
  return secret ? secret : null;
}

function looksLikePlaceholderSecret(secret: string) {
  const lowered = secret.toLowerCase();
  return PLACEHOLDER_SECRET_PATTERNS.some((pattern) => pattern.test(lowered));
}

function isWeakProductionSecret(secret: string) {
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    return true;
  }

  if (looksLikePlaceholderSecret(secret)) {
    return true;
  }

  if (new Set(secret).size < 8) {
    return true;
  }

  return false;
}

function readConfiguredSecret(envName: string, value: string | undefined, requiredInProduction = false) {
  const secret = normalizeSecret(value);

  if (!secret) {
    if (requiredInProduction) {
      throw new Error(`${envName} is required in production.`);
    }

    return null;
  }

  if (process.env.NODE_ENV === "production" && isWeakProductionSecret(secret)) {
    throw new Error(`${envName} must be a strong generated secret in production.`);
  }

  return secret;
}

export function getSessionSecrets(): SessionSecrets {
  const primarySecret =
    readConfiguredSecret("ACRE_SESSION_SECRET", process.env.ACRE_SESSION_SECRET, true) ?? DEV_SESSION_SECRET;
  const secondarySecret = readConfiguredSecret("ACRE_SESSION_SECRET_SECONDARY", process.env.ACRE_SESSION_SECRET_SECONDARY);

  return {
    primary: primarySecret,
    secondary: secondarySecret && secondarySecret !== primarySecret ? secondarySecret : null
  };
}

export function getSessionSecret() {
  return getSessionSecrets().primary;
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
