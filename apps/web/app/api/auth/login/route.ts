import { getDefaultAppPath } from "@acre/auth";
import { authenticatePasswordUser } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValueWithOfficeSelection,
  buildLoginPagePath,
  getSessionCookieName,
  getSessionCookieSettings,
  mustChangePassword,
  sanitizeLoginNextPath,
} from "../../../../lib/auth-session";
import { isSameOriginRequest } from "../../../../lib/csrf";
import {
  buildRateLimitKey,
  consumeRateLimit,
  hashRateLimitSegment,
  type RateLimitConsumer,
  type RateLimitOptions,
} from "../../../../lib/rate-limit";
import { coerceLocaleCode, getLocaleCookieOptions, localeCookieName } from "../../../../lib/i18n/config";
import { getRequestOrigin } from "../../../../lib/request-origin";
import { withApiGuard } from "../../../../lib/with-api-guard";

type LoginRouteDependencies = {
  authenticatePasswordUser?: typeof authenticatePasswordUser;
  csrf?: typeof isSameOriginRequest;
  getRequestOrigin?: typeof getRequestOrigin;
  rateLimit?: RateLimitConsumer;
  rateLimitOptions?: RateLimitOptions;
  withApiGuard?: typeof withApiGuard;
};

const DEFAULT_LOGIN_RATE_LIMIT_OPTIONS = {
  limit: 10,
  windowMs: 15 * 60 * 1000
};

function buildLoginRedirect(
  requestOrigin: string,
  error: string | null,
  nextPath?: string | null,
) {
  return NextResponse.redirect(
    new URL(buildLoginPagePath({ error, nextPath }), requestOrigin),
    303,
  );
}

function getLoginRateLimitKey(request: NextRequest, email: string) {
  return buildRateLimitKey(
    "auth/login",
    request,
    email ? hashRateLimitSegment(email) : "anonymous",
  );
}

export async function handleLoginPost(request: NextRequest, dependencies: LoginRouteDependencies = {}) {
  return (dependencies.withApiGuard ?? withApiGuard)<{
    email: string;
    password: string;
    nextPath: string | null;
    requestOrigin: string;
  }>(
    request,
    async ({ prepared }) => {
      const authenticate =
        dependencies.authenticatePasswordUser ?? authenticatePasswordUser;
      const result = await authenticate(prepared.email, prepared.password);

      if (result.status === "locked") {
        return buildLoginRedirect(
          prepared.requestOrigin,
          "locked",
          prepared.nextPath,
        );
      }

      if (result.status !== "success") {
        return buildLoginRedirect(
          prepared.requestOrigin,
          "invalid_credentials",
          prepared.nextPath,
        );
      }

      const redirectPath = mustChangePassword(result.context)
        ? "/change-password"
        : (prepared.nextPath ??
          getDefaultAppPath(result.context.currentMembership));
      const response = NextResponse.redirect(
        new URL(redirectPath, prepared.requestOrigin),
        303,
      );

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
    },
    {
      cacheControlNoStore: true,
      csrf: dependencies.csrf ?? isSameOriginRequest,
      prepare: async ({ request: guardedRequest }) => {
        const formData = await guardedRequest.formData();
        const email = String(
          formData.get("workEmail") ?? formData.get("email") ?? "",
        )
          .trim()
          .toLowerCase();

        return {
          email,
          password: String(
            formData.get("workPassword") ?? formData.get("password") ?? "",
          ),
          nextPath: sanitizeLoginNextPath(String(formData.get("next") ?? "")),
          requestOrigin: (dependencies.getRequestOrigin ?? getRequestOrigin)(
            guardedRequest,
          ),
        };
      },
      rateLimit: {
        consumer: dependencies.rateLimit ?? consumeRateLimit,
        key: ({ prepared, request: guardedRequest }) =>
          getLoginRateLimitKey(guardedRequest, prepared.email),
        message: "Too many login attempts. Please try again in a moment.",
        options:
          dependencies.rateLimitOptions ?? DEFAULT_LOGIN_RATE_LIMIT_OPTIONS,
      },
    },
  );
}

export async function POST(request: NextRequest) {
  return handleLoginPost(request);
}

export async function GET(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const nextPath = sanitizeLoginNextPath(request.nextUrl.searchParams.get("next"));

  return NextResponse.redirect(
    new URL(buildLoginPagePath({ nextPath }), requestOrigin),
    303,
  );
}
