import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionMembershipContext } from "@acre/db";
import { getSessionSecret } from "../auth-session-config";
import { canAccessAdminGpt } from "./access";

const CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const DEFAULT_DEV_CLIENT_ID = "acre-admin-gpt-local";
const DEFAULT_DEV_CLIENT_SECRET = "acre-admin-gpt-local-secret";
const TOKEN_VERSION = 1;
const DEFAULT_ALLOWED_REDIRECT_HOSTS = new Set([
  "chat.openai.com",
  "chatgpt.com",
]);

export type AdminGptOAuthErrorCode =
  | "invalid_client"
  | "invalid_grant"
  | "invalid_request"
  | "access_denied"
  | "unsupported_grant_type";

export type AdminGptOAuthPayload = {
  activeOfficeId: string | null;
  clientId: string;
  exp: number;
  iat: number;
  membershipId: string;
  organizationId: string;
  redirectUri: string;
  scope: string;
  tokenType: "code" | "access";
  v: number;
};

export class AdminGptOAuthError extends Error {
  code: AdminGptOAuthErrorCode;
  status: number;

  constructor(code: AdminGptOAuthErrorCode, message: string, status = 400) {
    super(message);
    this.name = "AdminGptOAuthError";
    this.code = code;
    this.status = status;
  }
}

function normalize(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readClientId() {
  return normalize(process.env.ACRE_ADMIN_GPT_OAUTH_CLIENT_ID) ?? (
    process.env.NODE_ENV === "production" ? null : DEFAULT_DEV_CLIENT_ID
  );
}

function readClientSecret() {
  return normalize(process.env.ACRE_ADMIN_GPT_OAUTH_CLIENT_SECRET) ?? (
    process.env.NODE_ENV === "production" ? null : DEFAULT_DEV_CLIENT_SECRET
  );
}

function getSigningSecret() {
  return normalize(process.env.ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET) ?? getSessionSecret();
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getSigningSecret()).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function getAdminGptOAuthConfig() {
  const clientId = readClientId();
  const clientSecret = readClientSecret();

  if (!clientId || !clientSecret) {
    throw new AdminGptOAuthError(
      "invalid_client",
      "Acre Admin GPT OAuth is not configured.",
      500,
    );
  }

  return {
    accessTokenTtlSeconds: ACCESS_TOKEN_TTL_SECONDS,
    allowedScope: "admin_help:read",
    clientId,
    clientSecret,
    codeTtlSeconds: CODE_TTL_SECONDS,
  };
}

function parseAllowedRedirectHosts() {
  const configured = normalize(process.env.ACRE_ADMIN_GPT_ALLOWED_REDIRECT_HOSTS);

  if (!configured) {
    return DEFAULT_ALLOWED_REDIRECT_HOSTS;
  }

  return new Set(
    configured
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowedAdminGptRedirectUri(redirectUri: string) {
  let parsed: URL;

  try {
    parsed = new URL(redirectUri);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && parsed.hostname === "localhost";
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  return parseAllowedRedirectHosts().has(parsed.hostname.toLowerCase());
}

export function assertValidAdminGptClient(input: {
  clientId: string | null;
  clientSecret?: string | null;
}) {
  const config = getAdminGptOAuthConfig();

  if (input.clientId !== config.clientId) {
    throw new AdminGptOAuthError("invalid_client", "Invalid Acre Admin GPT OAuth client.", 401);
  }

  if (
    typeof input.clientSecret === "string" &&
    input.clientSecret !== config.clientSecret
  ) {
    throw new AdminGptOAuthError("invalid_client", "Invalid Acre Admin GPT OAuth client secret.", 401);
  }
}

export function encodeAdminGptOAuthToken(payload: AdminGptOAuthPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function decodeAdminGptOAuthToken(token: string, expectedType: AdminGptOAuthPayload["tokenType"]) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeEqual(signature, signPayload(encodedPayload))) {
    throw new AdminGptOAuthError("invalid_grant", "Invalid Acre Admin GPT OAuth token.");
  }

  let payload: AdminGptOAuthPayload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminGptOAuthPayload;
  } catch {
    throw new AdminGptOAuthError("invalid_grant", "Invalid Acre Admin GPT OAuth token.");
  }

  if (
    payload.v !== TOKEN_VERSION ||
    payload.tokenType !== expectedType ||
    payload.exp <= nowSeconds()
  ) {
    throw new AdminGptOAuthError("invalid_grant", "Expired or invalid Acre Admin GPT OAuth token.");
  }

  return payload;
}

export function createAdminGptAuthorizationCode(input: {
  context: SessionMembershipContext;
  clientId: string;
  redirectUri: string;
  scope?: string | null;
}) {
  const config = getAdminGptOAuthConfig();
  const scope = normalize(input.scope) ?? config.allowedScope;

  if (input.clientId !== config.clientId) {
    throw new AdminGptOAuthError("invalid_client", "Invalid Acre Admin GPT OAuth client.", 401);
  }

  if (scope !== config.allowedScope) {
    throw new AdminGptOAuthError("invalid_request", "Acre Admin GPT only supports read-only admin help scope.");
  }

  if (!isAllowedAdminGptRedirectUri(input.redirectUri)) {
    throw new AdminGptOAuthError("invalid_request", "Unsupported Acre Admin GPT OAuth redirect URI.");
  }

  if (!canAccessAdminGpt(input.context.currentMembership)) {
    throw new AdminGptOAuthError("access_denied", "Acre Admin GPT is only available to administrators with AI access.", 403);
  }

  const iat = nowSeconds();

  return encodeAdminGptOAuthToken({
    activeOfficeId: input.context.currentOffice?.id ?? null,
    clientId: input.clientId,
    exp: iat + config.codeTtlSeconds,
    iat,
    membershipId: input.context.currentMembership.id,
    organizationId: input.context.currentOrganization.id,
    redirectUri: input.redirectUri,
    scope,
    tokenType: "code",
    v: TOKEN_VERSION,
  });
}

export function exchangeAdminGptAuthorizationCode(input: {
  clientId: string | null;
  clientSecret: string | null;
  code: string | null;
  redirectUri: string | null;
}) {
  const config = getAdminGptOAuthConfig();

  assertValidAdminGptClient({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });

  if (!input.code || !input.redirectUri) {
    throw new AdminGptOAuthError("invalid_request", "Authorization code and redirect URI are required.");
  }

  const codePayload = decodeAdminGptOAuthToken(input.code, "code");

  if (
    codePayload.clientId !== config.clientId ||
    codePayload.redirectUri !== input.redirectUri
  ) {
    throw new AdminGptOAuthError("invalid_grant", "Authorization code does not match this OAuth request.");
  }

  const iat = nowSeconds();
  const accessToken = encodeAdminGptOAuthToken({
    ...codePayload,
    exp: iat + config.accessTokenTtlSeconds,
    iat,
    tokenType: "access",
  });

  return {
    accessToken,
    expiresIn: config.accessTokenTtlSeconds,
    scope: config.allowedScope,
    tokenType: "Bearer" as const,
  };
}

export function parseBearerToken(authorizationHeader: string | null) {
  const [scheme, token] = (authorizationHeader ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export function readBasicClientCredentials(authorizationHeader: string | null) {
  const [scheme, value] = (authorizationHeader ?? "").split(" ");

  if (scheme?.toLowerCase() !== "basic" || !value) {
    return {
      clientId: null,
      clientSecret: null,
    };
  }

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return {
        clientId: null,
        clientSecret: null,
      };
    }

    return {
      clientId: decoded.slice(0, separatorIndex),
      clientSecret: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return {
      clientId: null,
      clientSecret: null,
    };
  }
}
