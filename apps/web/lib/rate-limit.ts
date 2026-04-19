import { createHash } from "node:crypto";

type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitEnvironment = Record<string, string | undefined> & {
  ACRE_RATE_LIMIT_BACKEND?: string;
  ACRE_TRUSTED_PROXY_TIER?: string;
  ACRE_UPSTASH_REDIS_REST_URL?: string;
  ACRE_UPSTASH_REDIS_REST_TOKEN?: string;
};

type UpstashPipelineResponseItem = {
  result?: unknown;
  error?: string;
};

export type RateLimitOptions = {
  limit: number;
  onDecision?: (input: { key: string; decision: RateLimitDecision }) => void;
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

export type RateLimitConsumer = (
  key: string,
  options: RateLimitOptions,
) => Promise<RateLimitDecision> | RateLimitDecision;

type RateLimitRuntime = {
  env?: RateLimitEnvironment;
  fetch?: typeof fetch;
};

const rateLimitStore = new Map<string, RateLimitState>();
const MEMORY_RATE_LIMIT_CLEANUP_INTERVAL = 100;
let rateLimitConsumeCount = 0;

function cleanupExpiredRateLimits(now: number) {
  rateLimitConsumeCount += 1;

  if (rateLimitConsumeCount < MEMORY_RATE_LIMIT_CLEANUP_INTERVAL) {
    return;
  }

  rateLimitConsumeCount = 0;

  for (const [key, state] of rateLimitStore.entries()) {
    if (state.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function getNow(options: RateLimitOptions) {
  return options.now ?? Date.now();
}

function parseNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeUpstashUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function getUpstashConfig(env: RateLimitEnvironment) {
  const url = env.ACRE_UPSTASH_REDIS_REST_URL?.trim();
  const token = env.ACRE_UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return {
    url: normalizeUpstashUrl(url),
    token,
  };
}

async function executeUpstashPipeline(
  commands: string[][],
  env: RateLimitEnvironment,
  fetchImpl: typeof fetch,
) {
  const config = getUpstashConfig(env);

  if (!config) {
    throw new Error(
      "ACRE_RATE_LIMIT_BACKEND=upstash requires ACRE_UPSTASH_REDIS_REST_URL and ACRE_UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  const response = await fetchImpl(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(
      `Upstash rate limit request failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as UpstashPipelineResponseItem[];

  if (!Array.isArray(payload)) {
    throw new Error("Upstash rate limit response was not a pipeline array.");
  }

  for (const item of payload) {
    if (item && typeof item.error === "string" && item.error.length > 0) {
      throw new Error(`Upstash rate limit pipeline failed: ${item.error}`);
    }
  }

  return payload.map((item) => item?.result);
}

function getForwardedIp(request: { headers: Pick<Headers, "get"> }) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
}

function getRealIp(request: { headers: Pick<Headers, "get"> }) {
  return request.headers.get("x-real-ip")?.trim();
}

function getCloudflareIp(request: { headers: Pick<Headers, "get"> }) {
  return request.headers.get("cf-connecting-ip")?.trim();
}

export function resolveTrustedProxyTier(
  env: RateLimitEnvironment = process.env,
) {
  const normalized = env.ACRE_TRUSTED_PROXY_TIER?.trim().toLowerCase();

  if (normalized === "cloudflare" || normalized === "reverse-proxy") {
    return normalized;
  }

  return "none";
}

export function getRequestClientIdentifier(
  request: { headers: Pick<Headers, "get"> },
  env: RateLimitEnvironment = process.env,
) {
  const forwardedFor = getForwardedIp(request);
  const forwardedIp = getRealIp(request);
  const connectedIp = getCloudflareIp(request);
  const host = request.headers.get("host")?.trim();

  if (resolveTrustedProxyTier(env) === "cloudflare") {
    return connectedIp || forwardedFor || forwardedIp || host || "unknown";
  }

  if (resolveTrustedProxyTier(env) === "reverse-proxy") {
    return forwardedIp || forwardedFor || connectedIp || host || "unknown";
  }

  return forwardedFor || forwardedIp || connectedIp || host || "unknown";
}

export function hashRateLimitSegment(value: string) {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 24);
}

export function buildRateLimitKey(scope: string, request: { headers: Pick<Headers, "get"> }, ...segments: string[]) {
  return [scope, getRequestClientIdentifier(request), ...segments.filter(Boolean)].join(":");
}

export function resolveRateLimitBackend(
  env: RateLimitEnvironment = process.env,
) {
  return env.ACRE_RATE_LIMIT_BACKEND?.trim().toLowerCase() === "upstash"
    ? "upstash"
    : "memory";
}

function consumeMemoryRateLimit(key: string, options: RateLimitOptions): RateLimitDecision {
  if (options.limit <= 0) {
    throw new Error("Rate limit limit must be greater than zero.");
  }

  if (options.windowMs <= 0) {
    throw new Error("Rate limit window must be greater than zero.");
  }

  const now = getNow(options);
  cleanupExpiredRateLimits(now);
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

export function createUpstashRateLimitConsumer(options: {
  env?: RateLimitEnvironment;
  fetch?: typeof fetch;
} = {}): RateLimitConsumer {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? fetch;

  return async (key, rateLimitOptions) => {
    if (rateLimitOptions.limit <= 0) {
      throw new Error("Rate limit limit must be greater than zero.");
    }

    if (rateLimitOptions.windowMs <= 0) {
      throw new Error("Rate limit window must be greater than zero.");
    }

    const now = getNow(rateLimitOptions);
    const [countResult, , ttlResult] = await executeUpstashPipeline(
      [
        ["INCR", key],
        ["PEXPIRE", key, String(rateLimitOptions.windowMs), "NX"],
        ["PTTL", key],
      ],
      env,
      fetchImpl,
    );

    const count = parseNumberValue(countResult);

    if (count === null) {
      throw new Error("Upstash rate limit did not return a numeric count.");
    }

    const ttlMs = Math.max(
      1,
      parseNumberValue(ttlResult) ?? rateLimitOptions.windowMs,
    );
    const resetAt = now + ttlMs;

    return {
      allowed: count <= rateLimitOptions.limit,
      limit: rateLimitOptions.limit,
      remaining: Math.max(0, rateLimitOptions.limit - count),
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
    };
  };
}

function logRejectedRateLimitDecision(input: {
  key: string;
  decision: RateLimitDecision;
}) {
  if (input.decision.allowed) {
    return;
  }

  console.error(
    JSON.stringify({
      event: "rate_limit_rejected",
      key: input.key,
      limit: input.decision.limit,
      retry_after: input.decision.retryAfterSeconds,
      ts: new Date().toISOString(),
    }),
  );
}

export async function consumeRateLimit(
  key: string,
  options: RateLimitOptions,
  runtime: RateLimitRuntime = {},
): Promise<RateLimitDecision> {
  const env = runtime.env ?? process.env;
  const onDecision = options.onDecision ?? logRejectedRateLimitDecision;
  const decision =
    resolveRateLimitBackend(env) === "upstash"
      ? await createUpstashRateLimitConsumer({
          env,
          fetch: runtime.fetch,
        })(key, options)
      : consumeMemoryRateLimit(key, options);

  onDecision({ key, decision });

  return decision;
}

export const rateLimitTesting = {
  logRejectedRateLimitDecision,
  resolveTrustedProxyTier,
};

export function resetRateLimitStateForTesting() {
  rateLimitStore.clear();
  rateLimitConsumeCount = 0;
}
