import { getDefaultAppPath } from "@acre/auth";
import { authenticatePasswordUser } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValueWithOfficeSelection,
  getSessionCookieName,
  getSessionCookieSettings,
  mustChangePassword,
} from "../../../../lib/auth-session";
import { isSameOriginRequest } from "../../../../lib/csrf";
import { buildRateLimitKey, consumeRateLimit, type RateLimitOptions } from "../../../../lib/rate-limit";
import { coerceLocaleCode, getLocaleCookieOptions, localeCookieName } from "../../../../lib/i18n/config";
import { getRequestOrigin } from "../../../../lib/request-origin";

type LoginRouteDependencies = {
  authenticatePasswordUser?: typeof authenticatePasswordUser;
  csrf?: typeof isSameOriginRequest;
  getRequestOrigin?: typeof getRequestOrigin;
  rateLimit?: typeof consumeRateLimit;
  rateLimitOptions?: RateLimitOptions;
};

const DEFAULT_LOGIN_RATE_LIMIT_OPTIONS = {
  limit: 10,
  windowMs: 15 * 60 * 1000
};

function buildLoginErrorResponse(error: string, status: 403 | 429, retryAfterSeconds?: number) {
  const response = NextResponse.json({ error }, { status });
  response.headers.set("Cache-Control", "no-store");

  if (retryAfterSeconds) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return response;
}

function buildLoginRedirect(requestOrigin: string, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${error}`, requestOrigin), 303);
}

function getLoginRateLimitKey(request: NextRequest, email: string) {
  return buildRateLimitKey("auth/login", request, email || "anonymous");
}

export async function handleLoginPost(request: NextRequest, dependencies: LoginRouteDependencies = {}) {
  const requestOrigin = (dependencies.getRequestOrigin ?? getRequestOrigin)(request);
  const csrfCheck = dependencies.csrf ?? isSameOriginRequest;

  if (!csrfCheck(request)) {
    return buildLoginErrorResponse("CSRF validation failed.", 403);
  }

  const formData = await request.formData();
  const email = String(formData.get("workEmail") ?? formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("workPassword") ?? formData.get("password") ?? "");
  const rateLimitDecision = (dependencies.rateLimit ?? consumeRateLimit)(
    getLoginRateLimitKey(request, email),
    dependencies.rateLimitOptions ?? DEFAULT_LOGIN_RATE_LIMIT_OPTIONS
  );

  if (!rateLimitDecision.allowed) {
    return buildLoginErrorResponse(
      "Too many login attempts. Please try again in a moment.",
      429,
      rateLimitDecision.retryAfterSeconds
    );
  }

  const authenticate = dependencies.authenticatePasswordUser ?? authenticatePasswordUser;
  const result = await authenticate(email, password);

  if (result.status === "locked") {
    return buildLoginRedirect(requestOrigin, "locked");
  }

  if (result.status !== "success") {
    return buildLoginRedirect(requestOrigin, "invalid_credentials");
  }

  const redirectPath = mustChangePassword(result.context) ? "/change-password" : getDefaultAppPath(result.context.currentMembership);
  const response = NextResponse.redirect(new URL(redirectPath, requestOrigin), 303);

  response.cookies.set(
    getSessionCookieName(),
    createSessionCookieValueWithOfficeSelection(
      result.context.currentMembership.id,
      result.context.currentOffice?.id ?? null,
    ),
    getSessionCookieSettings(),
  );
  response.cookies.set(
    localeCookieName,
    coerceLocaleCode(result.context.currentUser.locale),
    getLocaleCookieOptions(),
  );

  return response;
}

export async function POST(request: NextRequest) {
  return handleLoginPost(request);
}
