import { createHash } from "node:crypto";
import { connect as connectNet } from "node:net";
import { connect as connectTls } from "node:tls";

type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitEnvironment = Record<string, string | undefined> & {
  ACRE_RATE_LIMIT_BACKEND?: string;
  ACRE_RATE_LIMIT_REDIS_URL?: string;
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
  executeRedisScript?: typeof executeRedisRateLimitScript;
  fetch?: typeof fetch;
};

type RedisRateLimitResult = {
  count: number;
  ttlMs: number;
};

type RedisResponse = number | string | null | RedisResponse[];

type RedisResponseParseResult = {
  nextOffset: number;
  value: RedisResponse;
};

type RedisConnection = {
  close: () => void;
  command: (args: string[]) => Promise<RedisResponse>;
};

const rateLimitStore = new Map<string, RateLimitState>();
const redisConnectionPromises = new Map<string, Promise<RedisConnection>>();
const MEMORY_RATE_LIMIT_CLEANUP_INTERVAL = 100;
let rateLimitConsumeCount = 0;

const REDIS_FIXED_WINDOW_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "redis.call('PEXPIRE', KEYS[1], ARGV[1], 'NX')",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {count, ttl}",
].join("\n");

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

function getRedisConfig(env: RateLimitEnvironment) {
  const url = env.ACRE_RATE_LIMIT_REDIS_URL?.trim();

  if (!url) {
    return null;
  }

  return { url };
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

function encodeRedisBulkString(value: string) {
  return `$${Buffer.byteLength(value, "utf8")}\r\n${value}\r\n`;
}

function serializeRedisCommand(args: string[]) {
  return `*${args.length}\r\n${args.map(encodeRedisBulkString).join("")}`;
}

function parseRedisInteger(
  buffer: Buffer,
  startOffset: number,
): RedisResponseParseResult | null {
  const lineEnd = buffer.indexOf("\r\n", startOffset);

  if (lineEnd === -1) {
    return null;
  }

  const parsed = Number.parseInt(
    buffer.subarray(startOffset + 1, lineEnd).toString("utf8"),
    10,
  );

  if (!Number.isFinite(parsed)) {
    throw new Error("Redis response contained an invalid integer.");
  }

  return {
    nextOffset: lineEnd + 2,
    value: parsed,
  };
}

function parseRedisSimpleString(
  buffer: Buffer,
  startOffset: number,
): RedisResponseParseResult | null {
  const lineEnd = buffer.indexOf("\r\n", startOffset);

  if (lineEnd === -1) {
    return null;
  }

  return {
    nextOffset: lineEnd + 2,
    value: buffer.subarray(startOffset + 1, lineEnd).toString("utf8"),
  };
}

function parseRedisBulkString(
  buffer: Buffer,
  startOffset: number,
): RedisResponseParseResult | null {
  const lengthResult = parseRedisInteger(buffer, startOffset);

  if (!lengthResult) {
    return null;
  }

  if (lengthResult.value === -1) {
    return {
      nextOffset: lengthResult.nextOffset,
      value: null,
    };
  }

  if (typeof lengthResult.value !== "number" || lengthResult.value < 0) {
    throw new Error("Redis bulk string length was invalid.");
  }

  const payloadEnd = lengthResult.nextOffset + lengthResult.value;

  if (buffer.length < payloadEnd + 2) {
    return null;
  }

  return {
    nextOffset: payloadEnd + 2,
    value: buffer.subarray(lengthResult.nextOffset, payloadEnd).toString("utf8"),
  };
}

function parseRedisArray(
  buffer: Buffer,
  startOffset: number,
): RedisResponseParseResult | null {
  const lengthResult = parseRedisInteger(buffer, startOffset);

  if (!lengthResult) {
    return null;
  }

  if (typeof lengthResult.value !== "number" || lengthResult.value < -1) {
    throw new Error("Redis array length was invalid.");
  }

  if (lengthResult.value === -1) {
    return {
      nextOffset: lengthResult.nextOffset,
      value: null,
    };
  }

  const values: RedisResponse[] = [];
  let offset = lengthResult.nextOffset;

  for (let index = 0; index < lengthResult.value; index += 1) {
    const next = tryParseRedisResponse(buffer, offset);

    if (!next) {
      return null;
    }

    values.push(next.value);
    offset = next.nextOffset;
  }

  return {
    nextOffset: offset,
    value: values,
  };
}

function tryParseRedisResponse(
  buffer: Buffer,
  startOffset = 0,
): RedisResponseParseResult | null {
  const prefix = buffer[startOffset];

  if (prefix === undefined) {
    return null;
  }

  if (prefix === 43) {
    return parseRedisSimpleString(buffer, startOffset);
  }

  if (prefix === 45) {
    const error = parseRedisSimpleString(buffer, startOffset);

    if (!error || typeof error.value !== "string") {
      return null;
    }

    throw new Error(`Redis command failed: ${error.value}`);
  }

  if (prefix === 58) {
    return parseRedisInteger(buffer, startOffset);
  }

  if (prefix === 36) {
    return parseRedisBulkString(buffer, startOffset);
  }

  if (prefix === 42) {
    return parseRedisArray(buffer, startOffset);
  }

  throw new Error(`Unsupported Redis response prefix: ${String.fromCharCode(prefix)}`);
}

function parseRedisDatabaseIndex(redisUrl: URL) {
  const path = redisUrl.pathname.replace(/^\/+/, "");

  if (!path) {
    return 0;
  }

  const parsed = Number.parseInt(path, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("ACRE_RATE_LIMIT_REDIS_URL must use a numeric database path.");
  }

  return parsed;
}

function createRedisSocket(redisUrl: URL) {
  const port = redisUrl.port
    ? Number.parseInt(redisUrl.port, 10)
    : redisUrl.protocol === "rediss:"
      ? 6380
      : 6379;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("ACRE_RATE_LIMIT_REDIS_URL must include a valid port.");
  }

  if (redisUrl.protocol === "rediss:") {
    return {
      readyEvent: "secureConnect" as const,
      socket: connectTls({
        host: redisUrl.hostname,
        port,
        servername: redisUrl.hostname,
      }),
    };
  }

  if (redisUrl.protocol !== "redis:") {
    throw new Error("ACRE_RATE_LIMIT_REDIS_URL must use redis:// or rediss://.");
  }

  return {
    readyEvent: "connect" as const,
    socket: connectNet({
      host: redisUrl.hostname,
      port,
    }),
  };
}

async function connectRedisConnection(redisUrlValue: string) {
  const redisUrl = new URL(redisUrlValue);
  const { readyEvent, socket } = createRedisSocket(redisUrl);
  let buffer = Buffer.alloc(0);
  const pending: Array<{
    reject: (error: Error) => void;
    resolve: (value: RedisResponse) => void;
  }> = [];

  const rejectPending = (error: Error) => {
    while (pending.length > 0) {
      pending.shift()?.reject(error);
    }
  };

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    try {
      while (pending.length > 0) {
        const parsed = tryParseRedisResponse(buffer);

        if (!parsed) {
          break;
        }

        buffer = buffer.subarray(parsed.nextOffset);
        pending.shift()?.resolve(parsed.value);
      }
    } catch (error) {
      rejectPending(
        error instanceof Error
          ? error
          : new Error("Redis response parsing failed."),
      );
      socket.destroy();
    }
  });

  socket.on("close", () => {
    redisConnectionPromises.delete(redisUrlValue);
    rejectPending(new Error("Redis connection closed."));
  });

  socket.on("error", (error) => {
    redisConnectionPromises.delete(redisUrlValue);
    rejectPending(
      error instanceof Error ? error : new Error("Redis connection failed."),
    );
  });

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      socket.off("error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      socket.off(readyEvent, onReady);
      reject(error);
    };

    socket.once(readyEvent, onReady);
    socket.once("error", onError);
  });

  const connection: RedisConnection = {
    close() {
      socket.end();
    },
    command(args) {
      return new Promise<RedisResponse>((resolve, reject) => {
        pending.push({ resolve, reject });
        socket.write(serializeRedisCommand(args));
      });
    },
  };

  const username = redisUrl.username ? decodeURIComponent(redisUrl.username) : "";
  const password = redisUrl.password ? decodeURIComponent(redisUrl.password) : "";
  const databaseIndex = parseRedisDatabaseIndex(redisUrl);

  if (password) {
    await connection.command(
      username
        ? ["AUTH", username, password]
        : ["AUTH", password],
    );
  }

  if (databaseIndex > 0) {
    await connection.command(["SELECT", String(databaseIndex)]);
  }

  return connection;
}

function getRedisConnection(redisUrl: string) {
  let connectionPromise = redisConnectionPromises.get(redisUrl);

  if (!connectionPromise) {
    connectionPromise = connectRedisConnection(redisUrl).catch((error) => {
      redisConnectionPromises.delete(redisUrl);
      throw error;
    });
    redisConnectionPromises.set(redisUrl, connectionPromise);
  }

  return connectionPromise;
}

function parseRedisRateLimitScriptResult(
  value: RedisResponse,
): RedisRateLimitResult {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("Redis rate limit script did not return the expected tuple.");
  }

  const count = parseNumberValue(value[0]);
  const ttlMs = parseNumberValue(value[1]);

  if (count === null || ttlMs === null) {
    throw new Error("Redis rate limit script returned non-numeric values.");
  }

  return {
    count,
    ttlMs,
  };
}

async function executeRedisRateLimitScript(
  redisUrl: string,
  key: string,
  windowMs: number,
) {
  const connection = await getRedisConnection(redisUrl);
  const result = await connection.command([
    "EVAL",
    REDIS_FIXED_WINDOW_SCRIPT,
    "1",
    key,
    String(windowMs),
  ]);

  return parseRedisRateLimitScriptResult(result);
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
  const normalized = env.ACRE_RATE_LIMIT_BACKEND?.trim().toLowerCase();

  if (normalized === "upstash") {
    return "upstash";
  }

  if (normalized === "redis") {
    return "redis";
  }

  return "memory";
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

export function createRedisRateLimitConsumer(options: {
  env?: RateLimitEnvironment;
  executeRedisScript?: typeof executeRedisRateLimitScript;
} = {}): RateLimitConsumer {
  const env = options.env ?? process.env;
  const executeRedisScriptImpl =
    options.executeRedisScript ?? executeRedisRateLimitScript;

  return async (key, rateLimitOptions) => {
    if (rateLimitOptions.limit <= 0) {
      throw new Error("Rate limit limit must be greater than zero.");
    }

    if (rateLimitOptions.windowMs <= 0) {
      throw new Error("Rate limit window must be greater than zero.");
    }

    const config = getRedisConfig(env);

    if (!config) {
      throw new Error(
        "ACRE_RATE_LIMIT_BACKEND=redis requires ACRE_RATE_LIMIT_REDIS_URL.",
      );
    }

    const now = getNow(rateLimitOptions);
    const scriptResult = await executeRedisScriptImpl(
      config.url,
      key,
      rateLimitOptions.windowMs,
    );
    const ttlMs = Math.max(1, scriptResult.ttlMs);
    const resetAt = now + ttlMs;

    return {
      allowed: scriptResult.count <= rateLimitOptions.limit,
      limit: rateLimitOptions.limit,
      remaining: Math.max(0, rateLimitOptions.limit - scriptResult.count),
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
  const backend = resolveRateLimitBackend(env);
  const decision =
    backend === "upstash"
      ? await createUpstashRateLimitConsumer({
          env,
          fetch: runtime.fetch,
        })(key, options)
      : backend === "redis"
        ? await createRedisRateLimitConsumer({
            env,
            executeRedisScript: runtime.executeRedisScript,
          })(key, options)
        : consumeMemoryRateLimit(key, options);

  onDecision({ key, decision });

  return decision;
}

export const rateLimitTesting = {
  executeRedisRateLimitScript,
  logRejectedRateLimitDecision,
  parseRedisRateLimitScriptResult,
  resolveTrustedProxyTier,
};

export function resetRateLimitStateForTesting() {
  rateLimitStore.clear();
  rateLimitConsumeCount = 0;

  for (const connectionPromise of redisConnectionPromises.values()) {
    connectionPromise
      .then((connection) => connection.close())
      .catch(() => null);
  }

  redisConnectionPromises.clear();
}
