import { NextResponse } from "next/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  hashRateLimitSegment,
  type RateLimitConsumer,
  type RateLimitDecision,
  type RateLimitOptions,
} from "./rate-limit";

type HeaderReader = Pick<Headers, "get">;

type HeaderSource = HeaderReader | { headers: HeaderReader };

export const PUBLIC_LISTING_SHARE_READ_RATE_LIMIT_OPTIONS = {
  limit: 60,
  windowMs: 10 * 60 * 1000,
} satisfies RateLimitOptions;

export const PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS = {
  limit: 60,
  windowMs: 10 * 60 * 1000,
} satisfies RateLimitOptions;

export const PUBLIC_LISTING_STUDIO_ASSET_READ_RATE_LIMIT_OPTIONS = {
  limit: 180,
  windowMs: 10 * 60 * 1000,
} satisfies RateLimitOptions;

export const PUBLIC_SIGNATURE_READ_RATE_LIMIT_OPTIONS = {
  limit: 60,
  windowMs: 10 * 60 * 1000,
} satisfies RateLimitOptions;

export const PUBLIC_INVITATION_READ_RATE_LIMIT_OPTIONS = {
  limit: 40,
  windowMs: 10 * 60 * 1000,
} satisfies RateLimitOptions;

export const LISTING_STUDIO_EXTENSION_STATUS_RATE_LIMIT_OPTIONS = {
  limit: 240,
  windowMs: 15 * 60 * 1000,
} satisfies RateLimitOptions;

export const LISTING_STUDIO_EXTENSION_APPROVE_RATE_LIMIT_OPTIONS = {
  limit: 20,
  windowMs: 15 * 60 * 1000,
} satisfies RateLimitOptions;

function resolveHeaders(input: HeaderSource): HeaderReader {
  return "headers" in input ? input.headers : input;
}

export function buildPublicTokenRateLimitKey(
  scope: string,
  input: HeaderSource,
  token: string,
) {
  return buildRateLimitKey(
    scope,
    { headers: resolveHeaders(input) },
    hashRateLimitSegment(token),
  );
}

export async function consumePublicTokenRateLimit(input: {
  consumer?: RateLimitConsumer;
  options: RateLimitOptions;
  scope: string;
  token: string;
  request: HeaderSource;
}): Promise<RateLimitDecision> {
  const consumer = input.consumer ?? consumeRateLimit;
  const key = buildPublicTokenRateLimitKey(
    input.scope,
    input.request,
    input.token,
  );

  try {
    return await consumer(key, input.options);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown");

    process.stderr.write(
      JSON.stringify({
        kind: "public_token_rate_limit_fallback",
        key,
        scope: input.scope,
        error: message,
        ts: new Date().toISOString(),
      }) + "\n",
    );

    // Public token routes should never white-screen just because the shared
    // rate-limit backend is unhealthy. Fall back to a per-process memory
    // limiter even when the global backend is configured fail-closed.
    return consumeRateLimit(key, input.options, {
      env: {
        ACRE_RATE_LIMIT_BACKEND: "memory",
      },
    });
  }
}

export function buildPublicTokenRateLimitResponse(
  error: string,
  retryAfterSeconds: number,
) {
  const response = NextResponse.json({ error }, { status: 429 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}
