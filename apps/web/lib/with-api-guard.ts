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

type ApiGuardResponseBuilderInput<Prepared> = ApiGuardRequestContext<Prepared>;

export type ApiGuardRateLimitConfig<Prepared> = {
  consumer?: RateLimitConsumer;
  key: (input: ApiGuardRequestContext<Prepared>) => string;
  message: string;
  options: RateLimitOptions;
  onRejected?: (
    input: ApiGuardResponseBuilderInput<Prepared> & {
      decision: Awaited<ReturnType<RateLimitConsumer>>;
    },
  ) => Promise<Response> | Response;
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
  onForbidden?: (
    input: ApiGuardResponseBuilderInput<Prepared> & {
      context: NonNullable<ApiGuardContext>;
    },
  ) => Promise<Response> | Response;
  onUnauthorized?: (
    input: ApiGuardResponseBuilderInput<Prepared>,
  ) => Promise<Response> | Response;
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

async function captureApiGuardException(error: unknown) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  try {
    const Sentry = await import("@sentry/nextjs");

    Sentry.captureException(error);
  } catch {
    // Sentry is optional. Ignore capture failures to preserve the original API behavior.
  }
}

export async function withApiGuard<Prepared = undefined>(
  request: NextRequest,
  handler: (
    input: ApiGuardRequestContext<Prepared>,
  ) => Promise<Response> | Response,
  options: WithApiGuardOptions<Prepared> = {},
) {
  try {
    /**
     * `prepare` MUST be idempotent and side-effect free.
     * It runs after auth but before permission checks and rate-limit consumption,
     * which means a request rejected at `canAccess` still incurs `prepare`'s cost.
     * Use `prepare` only to derive values (for example parsing `formData` or query
     * params) that are needed by `rateLimit.key` or the downstream handler.
     */
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
    let prepared = undefined as Prepared;

    if (shouldLoadSessionContext(options)) {
      const getSessionContext =
        options.getRequestSessionContext ?? getRequestSessionContext;
      context = await getSessionContext(request);
    }

    if (options.requireAuth && !context) {
      if (options.onUnauthorized) {
        return options.onUnauthorized({ request, context, prepared });
      }

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
        if (options.onUnauthorized) {
          return options.onUnauthorized({ request, context, prepared });
        }

        return buildApiGuardErrorResponse(
          options.unauthorizedMessage ?? "Authentication required.",
          401,
          {
            cacheControlNoStore: options.cacheControlNoStore,
          },
        );
      }

      if (options.prepare) {
        prepared = await options.prepare({ request, context });
      }

      if (!options.canAccess(context.currentMembership)) {
        if (options.onForbidden) {
          return options.onForbidden({ request, context, prepared });
        }

        return buildApiGuardErrorResponse(
          options.forbiddenMessage ?? "Permission required.",
          403,
          {
            cacheControlNoStore: options.cacheControlNoStore,
          },
        );
      }
    } else if (options.prepare) {
      prepared = await options.prepare({ request, context });
    }

    if (options.rateLimit) {
      const decision = await (options.rateLimit.consumer ?? consumeRateLimit)(
        options.rateLimit.key({ request, context, prepared }),
        options.rateLimit.options,
      );

      if (!decision.allowed) {
        if (options.rateLimit.onRejected) {
          return options.rateLimit.onRejected({
            request,
            context,
            prepared,
            decision,
          });
        }

        return buildApiGuardErrorResponse(options.rateLimit.message, 429, {
          cacheControlNoStore: options.cacheControlNoStore,
          retryAfterSeconds: decision.retryAfterSeconds,
        });
      }
    }

    return handler({ request, context, prepared });
  } catch (error) {
    await captureApiGuardException(error);
    throw error;
  }
}
