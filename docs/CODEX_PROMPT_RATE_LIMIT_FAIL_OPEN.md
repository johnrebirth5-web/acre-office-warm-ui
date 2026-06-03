# Codex Prompt — Rate limit graceful degradation

> 目的：`eb0a7da` 加了 Redis 限流后端，并且生产已切到 `ACRE_RATE_LIMIT_BACKEND=redis` + `ACRE_RATE_LIMIT_REDIS_URL=redis://127.0.0.1:6380/0`。但当前 `consumeRateLimit` 在 Redis/Upstash 调用抛错时**没有兜底**，错误会直接冒到路由处理器，最终用户看到 500。
>
> 这意味着本机 Redis 一旦 OOM/重启/磁盘满/socket broken，`login` / `change-password` / `invite accept` / `signature submit` 这些挂了限流的入口**会同时全部 500**，而它们本来在 memory 后端下是能工作的。
>
> 方案：后端调用失败时 **默认 fail-open 到 memory 兜底 + Sentry 上报 + 结构化 warn 日志**，并保留一个 env flag 让运维切回 fail-closed 行为。
>
> 验收：`apps/web` typecheck 通过；`rate-limit.test.ts` 新增用例覆盖 fallback 路径。
>
> 前置：先读 `apps/web/lib/rate-limit.ts` 全文（< 500 行），再动手。

---

## 改动文件（预期）

1. `apps/web/lib/rate-limit.ts`（主改动）
2. `apps/web/lib/rate-limit.test.ts`（新增测试）
3. `.env.example`（新增一个 env 声明）
4. `docs/env.md`（补上新 env 的一行说明）

**不要改动其他文件**（也不要顺手重构 `getRequestClientIdentifier` / `buildRateLimitKey` 等无关函数）。

---

## 任务 1 — 给 `consumeRateLimit` 加 fail-open 兜底

**现状**（`apps/web/lib/rate-limit.ts:776` 附近）：

```ts
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
      ? await createUpstashRateLimitConsumer({ env, fetch: runtime.fetch })(key, options)
      : backend === "redis"
        ? await createRedisRateLimitConsumer({ env, executeRedisScript: runtime.executeRedisScript })(key, options)
        : consumeMemoryRateLimit(key, options);

  onDecision({ key, decision });
  return decision;
}
```

**改成**：

```ts
export async function consumeRateLimit(
  key: string,
  options: RateLimitOptions,
  runtime: RateLimitRuntime = {},
): Promise<RateLimitDecision> {
  const env = runtime.env ?? process.env;
  const onDecision = options.onDecision ?? logRejectedRateLimitDecision;
  const backend = resolveRateLimitBackend(env);
  const failClosed = isRateLimitFailClosed(env);

  let decision: RateLimitDecision;

  if (backend === "memory") {
    decision = consumeMemoryRateLimit(key, options);
  } else {
    try {
      decision =
        backend === "upstash"
          ? await createUpstashRateLimitConsumer({ env, fetch: runtime.fetch })(key, options)
          : await createRedisRateLimitConsumer({
              env,
              executeRedisScript: runtime.executeRedisScript,
            })(key, options);
    } catch (error) {
      reportRateLimitBackendFailure({ backend, error, key, failClosed });

      if (failClosed) {
        throw error;
      }

      decision = consumeMemoryRateLimit(key, options);
    }
  }

  onDecision({ key, decision });
  return decision;
}
```

**并新增两个辅助函数**（放在文件底部、`rateLimitTesting` 之前）：

```ts
function isRateLimitFailClosed(env: RateLimitEnvironment) {
  const value = env.ACRE_RATE_LIMIT_FAIL_MODE?.trim().toLowerCase();
  return value === "closed";
}

function reportRateLimitBackendFailure(input: {
  backend: "upstash" | "redis";
  error: unknown;
  key: string;
  failClosed: boolean;
}) {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error);

  process.stderr.write(
    JSON.stringify({
      kind: "rate_limit_backend_failure",
      backend: input.backend,
      key: input.key,
      failClosed: input.failClosed,
      error: message,
      ts: new Date().toISOString(),
    }) + "\n",
  );

  // 不要在这里 import Sentry — 保持 rate-limit 模块零外部依赖，Sentry 自己
  // 会通过 withApiGuard 那一层在更上层捕获。
}
```

**同时把 `RateLimitEnvironment` 类型加上**：

```ts
type RateLimitEnvironment = Record<string, string | undefined> & {
  ACRE_RATE_LIMIT_BACKEND?: string;
  ACRE_RATE_LIMIT_FAIL_MODE?: string; // 新增："open"（默认）或 "closed"
  ACRE_RATE_LIMIT_REDIS_URL?: string;
  ACRE_TRUSTED_PROXY_TIER?: string;
  ACRE_UPSTASH_REDIS_REST_URL?: string;
  ACRE_UPSTASH_REDIS_REST_TOKEN?: string;
};
```

---

## 任务 2 — 新增单元测试

在 `apps/web/lib/rate-limit.test.ts` 里加三组用例：

1. **Redis 后端抛错 + fail-open（默认）→ 退回 memory 后端并允许请求**
2. **Redis 后端抛错 + `ACRE_RATE_LIMIT_FAIL_MODE=closed` → 抛错冒出来**
3. **Upstash 后端抛错 + fail-open → 退回 memory 后端并允许请求**

用例里的 Redis/Upstash 调用必须通过注入 `runtime.executeRedisScript` / `runtime.fetch` 强制抛错，**不要真的连 Redis**。

验证方式：
- fail-open 分支：`decision.allowed` 为 `true`，`decision.remaining` 为 `limit - 1`（memory 后端首次命中）
- fail-closed 分支：`assert.rejects(() => consumeRateLimit(...))`

跑命令（你本机验证）：
```bash
npx tsx --test apps/web/lib/rate-limit.test.ts
```

---

## 任务 3 — 更新环境变量文档

### `.env.example`

找到 `ACRE_RATE_LIMIT_BACKEND` 那行附近，追加：

```
# When a non-memory rate limit backend (redis/upstash) fails, whether to
# fall back to the in-process memory counter ("open", default) or propagate
# the error to callers ("closed"). Open prioritizes availability of auth
# endpoints; closed prioritizes strict enforcement. Operators can flip this
# without a code change.
ACRE_RATE_LIMIT_FAIL_MODE=open
```

### `docs/env.md`

在 `ACRE_RATE_LIMIT_BACKEND` 条目下方新增一条：

```
### `ACRE_RATE_LIMIT_FAIL_MODE`

Behavior when the configured rate limit backend (Redis or Upstash) throws.

- `open` (default): log the error, fall back to the in-process memory store,
  keep serving the request. Keeps auth endpoints available during Redis
  outages at the cost of one process rotation of counters.
- `closed`: propagate the error to the caller (usually becomes a 500). Use
  only if strict enforcement is more important than availability.
```

---

## 禁止项

- ❌ 不要引入 `@sentry/nextjs` 到 `rate-limit.ts`（保持模块零外部依赖，Sentry 捕获在 `withApiGuard` 那一层，不需要重复）
- ❌ 不要把 fail-open 变成**静默**兜底——必须写 `process.stderr` 的 JSON 日志，journalctl 要能看到
- ❌ 不要改 `consumeMemoryRateLimit` / `createRedisRateLimitConsumer` / `createUpstashRateLimitConsumer` 的签名（只在 `consumeRateLimit` 这一层加 try/catch）
- ❌ 不要顺手重构无关代码
- ❌ 不要把 `ACRE_RATE_LIMIT_FAIL_MODE` 变成三态 / 枚举 enum（只有 "open" 和 "closed" 两种，其他值按 "open" 处理）

---

## 交付清单

- [ ] `apps/web/lib/rate-limit.ts` 的 `consumeRateLimit` 在 Redis/Upstash 抛错时默认 fail-open 到 memory
- [ ] 新增 `ACRE_RATE_LIMIT_FAIL_MODE=closed` env flag 可切回原行为
- [ ] 失败路径往 stderr 写 JSON 日志（journalctl 可采）
- [ ] `rate-limit.test.ts` 覆盖三个新场景
- [ ] `.env.example` 和 `docs/env.md` 更新
- [ ] `npx tsx --test apps/web/lib/rate-limit.test.ts` 通过
- [ ] `cd apps/web && npx tsc --noEmit` 通过
- [ ] 做成**一个独立 commit**，commit message 里说清楚默认行为变化

## 部署后验证（部署时让 John 跑）

在 server 上：

```bash
# 1. 确认当前 fail mode 是 open（或者不设，都等价）
grep ACRE_RATE_LIMIT_FAIL_MODE <deployment-env-file> || echo "unset => open"

# 2. 临时 stop Redis 模拟故障
sudo systemctl stop redis  # 或你现在用的 Redis service 名

# 3. 走一次登录（应该还能走通，只是进 memory 后端）
curl -s -o /dev/null -w 'login: %{http_code}\n' https://your-acre-domain.example.com/login

# 4. 检查 journald 有没有看到 rate_limit_backend_failure 日志
sudo journalctl -u <app-service-name> --since "2 minutes ago" | grep rate_limit_backend_failure

# 5. 恢复 Redis
sudo systemctl start redis
```

**预期**：步骤 3 的 login 返回 200（或正常 302 重定向），步骤 4 能看到至少一条 `rate_limit_backend_failure` JSON 日志。
