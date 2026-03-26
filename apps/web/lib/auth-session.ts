import { createHmac, timingSafeEqual } from "node:crypto";
import { getDefaultAppPath, isOfficeRole, summarizeAccess } from "@acre/auth";
import { ensureBootstrapAdminAccount, getSessionMembershipContext, type SessionMembershipContext } from "@acre/db";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookieOptions, getSessionMaxAgeMs, getSessionSecret, shouldUseSecureCookies } from "./auth-session-config";

const SESSION_COOKIE_NAME = "acre_local_session";

type SessionPayload = {
  membershipId: string;
  issuedAt: number;
};

type SessionContextOptions = {
  allowPasswordChangeRequired?: boolean;
};

function signPayload(serializedPayload: string) {
  return createHmac("sha256", getSessionSecret()).update(serializedPayload).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const serializedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(serializedPayload);

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

  const expectedSignature = signPayload(serializedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
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

export function createSessionCookieValue(membershipId: string) {
  return encodeSession({
    membershipId,
    issuedAt: Date.now()
  });
}

export function decodeSessionCookieValue(cookieValue: string | undefined) {
  return decodeSession(cookieValue);
}

function isPasswordChangeBlocked(context: SessionMembershipContext | null, options?: SessionContextOptions) {
  return Boolean(context?.currentCredential?.mustChangePassword) && !options?.allowPasswordChangeRequired;
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

  const context = await getSessionMembershipContext(session.membershipId);
  return isPasswordChangeBlocked(context, options) ? null : context;
}

export async function getRequestSessionContext(request: NextRequest, options?: SessionContextOptions): Promise<SessionMembershipContext | null> {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!session) {
    return null;
  }

  const context = await getSessionMembershipContext(session.membershipId);
  return isPasswordChangeBlocked(context, options) ? null : context;
}

export async function requireSessionContext(options?: SessionContextOptions): Promise<SessionMembershipContext> {
  const context = await getCurrentSessionContext({
    allowPasswordChangeRequired: true
  });

  if (!context) {
    redirect("/login");
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
