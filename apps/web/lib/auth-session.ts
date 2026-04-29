import { createHmac, timingSafeEqual } from "node:crypto";
import { getDefaultAppPath, isOfficeRole, summarizeAccess } from "@acre/auth";
import { ensureBootstrapAdminAccount, getSessionMembershipContext, type SessionMembershipContext } from "@acre/db";
import type { NextRequest } from "next/server";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookieOptions, getSessionMaxAgeMs, getSessionSecrets, shouldUseSecureCookies } from "./auth-session-config";

const SESSION_COOKIE_NAME = "acre_local_session";
const LOGIN_NEXT_PATH_HEADER = "x-acre-current-path";

type SessionPayload = {
  membershipId: string;
  activeOfficeId: string | null;
  issuedAt: number;
};

type SessionContextOptions = {
  allowPasswordChangeRequired?: boolean;
};

type SessionMembershipContextLoader = (
  membershipId: string,
  options?: {
    activeOfficeId?: string | null;
  },
) => Promise<SessionMembershipContext | null>;

type SessionCookieStore = {
  get(name: string): { value?: string } | undefined;
};

type SessionRequestLike = {
  cookies: SessionCookieStore;
};

function signPayload(serializedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(serializedPayload).digest("base64url");
}

function isValidSignature(serializedPayload: string, signature: string, secret: string) {
  const expectedSignature = signPayload(serializedPayload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
}

function encodeSession(payload: SessionPayload) {
  const serializedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const { primary } = getSessionSecrets();
  const signature = signPayload(serializedPayload, primary);

  return `${serializedPayload}.${signature}`;
}

function decodeSession(cookieValue: string | undefined): SessionPayload | null {
  if (!cookieValue) {
    return null;
  }

  const [serializedPayload, signature] = cookieValue.split(".");

  if (!serializedPayload || !signature) {
    return null;
  }

  const { primary, secondary } = getSessionSecrets();
  const validPrimarySignature = isValidSignature(serializedPayload, signature, primary);
  const validSecondarySignature = secondary ? isValidSignature(serializedPayload, signature, secondary) : false;

  if (!validPrimarySignature && !validSecondarySignature) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(serializedPayload, "base64url").toString("utf8")) as SessionPayload;

    if (!parsed.membershipId || typeof parsed.membershipId !== "string") {
      return null;
    }

    if (!Number.isFinite(parsed.issuedAt) || parsed.issuedAt <= 0) {
      return null;
    }

    if (Date.now() - parsed.issuedAt > getSessionMaxAgeMs()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getContextCacheKey(session: SessionPayload) {
  return `${session.membershipId}:${session.activeOfficeId ?? ""}`;
}

function getCredentialPasswordChangedAtMs(
  context: SessionMembershipContext | null,
) {
  const passwordChangedAt = context?.currentCredential?.passwordChangedAt;
  return passwordChangedAt instanceof Date ? passwordChangedAt.getTime() : null;
}

function hasSessionBeenSuperseded(
  session: SessionPayload,
  context: SessionMembershipContext | null,
) {
  const passwordChangedAtMs = getCredentialPasswordChangedAtMs(context);
  return typeof passwordChangedAtMs === "number" && passwordChangedAtMs > session.issuedAt;
}

export function createCachedSessionMembershipContextResolver(
  loadMembershipContext: SessionMembershipContextLoader = getSessionMembershipContext,
) {
  return cache(async (membershipId: string, activeOfficeId: string | null) => {
    if (!membershipId) {
      return null;
    }

    return loadMembershipContext(membershipId, {
      activeOfficeId,
    });
  });
}

export function createRequestSessionContextResolver(
  loadMembershipContext: SessionMembershipContextLoader = getSessionMembershipContext,
) {
  const requestCache = new WeakMap<object, Map<string, Promise<SessionMembershipContext | null>>>();

  return async function resolveRequestSessionContext(request: SessionRequestLike) {
    const session = decodeSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

    if (!session) {
      return null;
    }

    let sessionCache = requestCache.get(request);

    if (!sessionCache) {
      sessionCache = new Map();
      requestCache.set(request, sessionCache);
    }

    const cacheKey = getContextCacheKey(session);
    let contextPromise = sessionCache.get(cacheKey);

    if (!contextPromise) {
      contextPromise = loadMembershipContext(session.membershipId, {
        activeOfficeId: session.activeOfficeId ?? null,
      });
      sessionCache.set(cacheKey, contextPromise);
    }

    const context = await contextPromise;
    return hasSessionBeenSuperseded(session, context) ? null : context;
  };
}

const getCachedSessionMembershipContext = createCachedSessionMembershipContextResolver();
const resolveRequestSessionContext = createRequestSessionContextResolver();

export function createSessionCookieValue(membershipId: string) {
  return encodeSession({
    membershipId,
    activeOfficeId: null,
    issuedAt: Date.now()
  });
}

export function createSessionCookieValueWithOfficeSelection(
  membershipId: string,
  activeOfficeId: string | null,
) {
  return encodeSession({
    membershipId,
    activeOfficeId,
    issuedAt: Date.now(),
  });
}

export function decodeSessionCookieValue(cookieValue: string | undefined) {
  return decodeSession(cookieValue);
}

function isPasswordChangeBlocked(context: SessionMembershipContext | null, options?: SessionContextOptions) {
  return Boolean(context?.currentCredential?.mustChangePassword) && !options?.allowPasswordChangeRequired;
}

export function sanitizeLoginNextPath(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://acre.local");
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (
      normalized === "/login" ||
      normalized.startsWith("/login?") ||
      normalized.startsWith("/api/")
    ) {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}

export function buildLoginPagePath(input?: {
  error?: string | null;
  nextPath?: string | null;
}) {
  const params = new URLSearchParams();
  const nextPath = sanitizeLoginNextPath(input?.nextPath);

  if (input?.error) {
    params.set("error", input.error);
  }

  if (nextPath) {
    params.set("next", nextPath);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

async function buildMissingSessionRedirectPath() {
  const headerStore = await headers();

  return buildLoginPagePath({
    nextPath: headerStore.get(LOGIN_NEXT_PATH_HEADER),
  });
}

export async function ensureBootstrapAdminSessionAccount() {
  await ensureBootstrapAdminAccount();
}

export async function getCurrentSessionContext(options?: SessionContextOptions): Promise<SessionMembershipContext | null> {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!session) {
    return null;
  }

  const context = await getCachedSessionMembershipContext(session.membershipId, session.activeOfficeId ?? null);
  if (hasSessionBeenSuperseded(session, context)) {
    return null;
  }

  return isPasswordChangeBlocked(context, options) ? null : context;
}

export async function getRequestSessionContext(request: NextRequest, options?: SessionContextOptions): Promise<SessionMembershipContext | null> {
  const context = await resolveRequestSessionContext(request);
  return isPasswordChangeBlocked(context, options) ? null : context;
}

export async function requireSessionContext(options?: SessionContextOptions): Promise<SessionMembershipContext> {
  const context = await getCurrentSessionContext({
    allowPasswordChangeRequired: true
  });

  if (!context) {
    redirect(await buildMissingSessionRedirectPath());
  }

  if (isPasswordChangeBlocked(context, options)) {
    redirect("/change-password");
  }

  return context;
}

export async function requireOfficeSession(): Promise<SessionMembershipContext> {
  const context = await requireSessionContext();

  if (!isOfficeRole(context.currentMembership)) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  return context;
}

export async function requireRequestOfficeSession(request: NextRequest): Promise<SessionMembershipContext | null> {
  const context = await getRequestSessionContext(request);

  if (!context || !isOfficeRole(context.currentMembership)) {
    return null;
  }

  return context;
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionCookieSettings() {
  return getSessionCookieOptions();
}

export function getSessionAccess(context: SessionMembershipContext) {
  return summarizeAccess(context.currentMembership);
}

export function mustChangePassword(context: SessionMembershipContext | null) {
  return Boolean(context?.currentCredential?.mustChangePassword);
}

export { shouldUseSecureCookies };
