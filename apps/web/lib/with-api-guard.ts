import type { SessionMembershipContext } from "@acre/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestSessionContext } from "./auth-session";
import { isSameOriginRequest } from "./csrf";
import {
  consumeRateLimit,
  type RateLimitConsumer,
  type RateLimitOptions,
} from "./rate-limit";

type ApiGuardContext = SessionMembershipContext | null;

type ApiGuardRequestContext<Prepared> = {
  context: ApiGuardContext;
  prepared: Prepared;
  request: NextRequest;
};

export type ApiGuardRateLimitConfig<Prepared> = {
  consumer?: RateLimitConsumer;
  key: (input: ApiGuardRequestContext<Prepared>) => string;
  message: string;
  options: RateLimitOptions;
};

export type WithApiGuardOptions<Prepared = undefined> = {
  cacheControlNoStore?: boolean;
  canAccess?: (
    membership: SessionMembershipContext["currentMembership"],
  ) => boolean;
  csrf?: boolean | typeof isSameOriginRequest;
  csrfMessage?: string;
  forbiddenMessage?: string;
  getRequestSessionContext?: typeof getRequestSessionContext;
  prepare?: (
    input: Omit<ApiGuardRequestContext<undefined>, "prepared">,
  ) => Promise<Prepared> | Prepared;
  rateLimit?: ApiGuardRateLimitConfig<Prepared>;
  requireAuth?: boolean;
  unauthorizedMessage?: string;
};

type ApiGuardErrorStatus = 401 | 403 | 429;

export function buildApiGuardErrorResponse(
  error: string,
  status: ApiGuardErrorStatus,
  options: {
    cacheControlNoStore?: boolean;
    retryAfterSeconds?: number;
  } = {},
) {
  const response = NextResponse.json({ error }, { status });

  if (options.cacheControlNoStore) {
    response.headers.set("Cache-Control", "no-store");
  }

  if (options.retryAfterSeconds) {
    response.headers.set("Retry-After", String(options.retryAfterSeconds));
  }

  return response;
}

function resolveCsrfCheck(csrf: WithApiGuardOptions["csrf"]) {
  if (csrf === false || csrf === undefined) {
    return null;
  }

  if (csrf === true) {
    return isSameOriginRequest;
  }

  return csrf;
}

function shouldLoadSessionContext<Prepared>(
  options: WithApiGuardOptions<Prepared>,
) {
  return Boolean(options.requireAuth || options.canAccess);
}

export async function withApiGuard<Prepared = undefined>(
  request: NextRequest,
  handler: (
    input: ApiGuardRequestContext<Prepared>,
  ) => Promise<Response> | Response,
  options: WithApiGuardOptions<Prepared> = {},
) {
  const csrfCheck = resolveCsrfCheck(options.csrf);

  if (csrfCheck && !csrfCheck(request)) {
    return buildApiGuardErrorResponse(
      options.csrfMessage ?? "CSRF validation failed.",
      403,
      {
        cacheControlNoStore: options.cacheControlNoStore,
      },
    );
  }

  let context: ApiGuardContext = null;

  if (shouldLoadSessionContext(options)) {
    const getSessionContext =
      options.getRequestSessionContext ?? getRequestSessionContext;
    context = await getSessionContext(request);
  }

  if (options.requireAuth && !context) {
    return buildApiGuardErrorResponse(
      options.unauthorizedMessage ?? "Authentication required.",
      401,
      {
        cacheControlNoStore: options.cacheControlNoStore,
      },
    );
  }

  if (options.canAccess) {
    if (!context) {
      return buildApiGuardErrorResponse(
        options.unauthorizedMessage ?? "Authentication required.",
        401,
        {
          cacheControlNoStore: options.cacheControlNoStore,
        },
      );
    }

    if (!options.canAccess(context.currentMembership)) {
      return buildApiGuardErrorResponse(
        options.forbiddenMessage ?? "Permission required.",
        403,
        {
          cacheControlNoStore: options.cacheControlNoStore,
        },
      );
    }
  }

  const prepared = options.prepare
    ? await options.prepare({ request, context })
    : (undefined as Prepared);

  if (options.rateLimit) {
    const decision = await (options.rateLimit.consumer ?? consumeRateLimit)(
      options.rateLimit.key({ request, context, prepared }),
      options.rateLimit.options,
    );

    if (!decision.allowed) {
      return buildApiGuardErrorResponse(options.rateLimit.message, 429, {
        cacheControlNoStore: options.cacheControlNoStore,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }
  }

  return handler({ request, context, prepared });
}
