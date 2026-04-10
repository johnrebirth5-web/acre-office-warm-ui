type RateLimitState = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const rateLimitStore = new Map<string, RateLimitState>();

function getNow(options: RateLimitOptions) {
  return options.now ?? Date.now();
}

export function getRequestClientIdentifier(request: { headers: Pick<Headers, "get"> }) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const forwardedIp = request.headers.get("x-real-ip")?.trim();
  const connectedIp = request.headers.get("cf-connecting-ip")?.trim();
  const host = request.headers.get("host")?.trim();

  return forwardedFor || forwardedIp || connectedIp || host || "unknown";
}

export function buildRateLimitKey(scope: string, request: { headers: Pick<Headers, "get"> }, ...segments: string[]) {
  return [scope, getRequestClientIdentifier(request), ...segments.filter(Boolean)].join(":");
}

export function consumeRateLimit(key: string, options: RateLimitOptions): RateLimitDecision {
  if (options.limit <= 0) {
    throw new Error("Rate limit limit must be greater than zero.");
  }

  if (options.windowMs <= 0) {
    throw new Error("Rate limit window must be greater than zero.");
  }

  const now = getNow(options);
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(options.windowMs / 1000))
    };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}

export function resetRateLimitStateForTesting() {
  rateLimitStore.clear();
}
