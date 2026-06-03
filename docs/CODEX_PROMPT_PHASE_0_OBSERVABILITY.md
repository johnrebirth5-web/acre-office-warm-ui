# Codex Prompt — Phase 0: Observability

> 目的：在动任何性能修复之前，先装上"眼睛"。完成后任何慢查询、内存异常、错误都能被看见和定位。
>
> 前提：不改业务逻辑，不改数据库 schema，不动部署脚本。所有改动都是**新增**或**包裹**，不删不改现有行为。
>
> 执行完后必须全部通过：`pnpm -w typecheck`、`pnpm -w lint`、`pnpm -w build`。

---

## 任务 0.1 — Prisma 慢查询日志

**文件：** `packages/db/src/client.ts`

**当前：** `new PrismaClient(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : undefined)` — 没有任何日志配置。

**要改成：**

1. 构造 PrismaClient 时加上 `log` 配置：
   ```ts
   log: [
     { emit: "event", level: "query" },
     { emit: "event", level: "warn" },
     { emit: "event", level: "error" },
   ]
   ```
2. 构造后注册 `client.$on("query", ...)` 事件监听：
   - 当 `event.duration > 500`（毫秒）时，用 `console.warn` 输出一条结构化 JSON，字段包含：`kind: "slow_query"`、`duration_ms`、`query`（截断到前 500 字符）、`params`（只有在非生产才输出，生产环境写 `"[REDACTED]"`）。
   - 当 `event.duration > 2000` 时，用 `console.error` 输出同样结构，`kind: "very_slow_query"`。
3. 监听 `client.$on("error", ...)`，`console.error` 输出 `{ kind: "prisma_error", message, target }`。
4. 阈值用环境变量可覆盖：`PRISMA_SLOW_QUERY_MS`（默认 500）、`PRISMA_VERY_SLOW_QUERY_MS`（默认 2000）。读取时 `parseInt` 并有兜底。
5. 仅在 `process.env.NODE_ENV !== "test"` 时注册监听，测试不受影响。

**验收：** 本地启动后，任意跑一次 `findMany({ take: 10000 })` 应该能在 stderr 看到 `{"kind":"slow_query",...}`。

---

## 任务 0.2 — `/api/health` 扩展 DB 延迟与连接池水位

**文件：** `packages/db/src/health.ts` 和 `apps/web/src/app/api/health/route.ts`（若路径不同，按实际为准）。

**当前：** `/api/health` 只跑 `SELECT 1`，返回 `{ status: "ok" }`。

**要改成：**

1. `packages/db/src/health.ts` 新增一个导出函数 `getHealthSnapshot()`，返回：
   ```ts
   {
     status: "ok" | "degraded" | "error",
     db: {
       ping_ms: number,              // SELECT 1 的耗时
       pool_in_use: number | null,   // pg_stat_activity 中该 DB 的 active + idle_in_transaction 数
       pool_idle: number | null,     // pg_stat_activity 中 idle 数
       pool_max: number | null,      // current_setting('max_connections')
     },
     process: {
       rss_bytes: number,
       heap_used_bytes: number,
       heap_total_bytes: number,
       uptime_seconds: number,
     },
     timestamp: string,              // ISO
   }
   ```
2. `ping_ms` 用 `Date.now()` 前后差计算 `SELECT 1`。
3. `pool_*` 用一条 `$queryRaw` 查询 `pg_stat_activity`，条件 `datname = current_database()`。若查询失败，三个字段返回 `null`（不让 health 变红）。
4. `process.*` 直接用 `process.memoryUsage()` 和 `process.uptime()`。
5. 状态判定：
   - `ping_ms > 1000` 或查询失败 → `"degraded"`
   - 实际抛错 → `"error"`，HTTP 503
   - 否则 `"ok"`，HTTP 200
6. Route handler 里直接 `return Response.json(snapshot, { status })`。
7. **关键约束：** 不能改动现有字段 `status` 的取值语义（"ok" | "degraded" 已有使用方），只能**新增**字段。

**验收：** `curl https://localhost:3000/api/health` 返回的 JSON 能看到 `db.ping_ms` 和 `process.rss_bytes`。

---

## 任务 0.3 — 新增 `/api/metrics` 进程指标端点

**文件：** 新建 `apps/web/src/app/api/metrics/route.ts`（路径按实际项目结构调整）。

**要求：**

1. 返回 Prometheus 纯文本格式（`Content-Type: text/plain; version=0.0.4`），方便以后接任意采集器。
2. 暴露以下指标（名字按 Prometheus 约定）：
   - `nodejs_process_rss_bytes`（gauge）
   - `nodejs_process_heap_used_bytes`（gauge）
   - `nodejs_process_heap_total_bytes`（gauge）
   - `nodejs_process_external_bytes`（gauge）
   - `nodejs_process_uptime_seconds`（gauge）
   - `nodejs_event_loop_lag_ms`（gauge，用 `perf_hooks.monitorEventLoopDelay()`）
3. event loop lag 用模块级单例：进程启动时 `monitorEventLoopDelay({ resolution: 10 })`，每次请求时读取 `histogram.mean / 1e6`，然后 `histogram.reset()`。
4. **访问控制：** 必须通过一个简单的 header 鉴权 `X-Metrics-Token`，与环境变量 `ACRE_METRICS_TOKEN` 对比。未设置或不匹配返回 401。不暴露给公网匿名。
5. 不要挂任何业务鉴权中间件（这是运维端点，不是用户端点）。

**验收：** `curl -H "X-Metrics-Token: <token>" http://localhost:3000/api/metrics` 能看到 6 条指标。

---

## 任务 0.4 — Sentry 错误追踪接入（服务端 + 客户端）

**约束：** 不要在任何地方硬编码 DSN，只从环境变量读取。如果 `SENTRY_DSN` 为空，Sentry **必须静默不启用**，不能抛错。

1. 安装 `@sentry/nextjs`（确认已有 pnpm workspace 协议下的添加方式）。
2. 新建 `sentry.server.config.ts`、`sentry.edge.config.ts`、`sentry.client.config.ts`（Next.js 约定文件名），每个文件里：
   - 若 `process.env.SENTRY_DSN` 为空，直接 `return`，不调用 `Sentry.init`。
   - 若非空，调用 `Sentry.init({ dsn, tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"), environment: process.env.NODE_ENV })`。
3. 更新 `next.config.*`：按 `@sentry/nextjs` 文档包一层 `withSentryConfig`，但 `silent: true`、`disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN`、`disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN` — 没 token 时不上传 source map，不阻塞构建。
4. 在 `packages/db/src/client.ts` 的 `$on("error")` 回调里，如果 Sentry 已初始化，调用 `Sentry.captureException`（用 `await import` 懒加载避免引入到 db 包的强依赖）。
5. 如果项目里已有统一的 API 错误处理中间件（例如 `withApiGuard`），在 catch 分支里 `Sentry.captureException(err)`。
6. `.env.example` 加上 `SENTRY_DSN=`、`SENTRY_TRACES_SAMPLE_RATE=0.1`、`SENTRY_AUTH_TOKEN=` 三个占位。**不要**改任何现有 `.env` 文件。

**验收：** 不设 `SENTRY_DSN` 时 `pnpm -w build` 通过、`pnpm dev` 不报 Sentry 相关错误；设置后故意抛一次 `throw new Error("sentry-probe")` 能在 Sentry 看到。

---

## 任务 0.5 — 文档更新

更新 `docs/` 下任意一处运维/onboarding 文档（若不存在则新建 `docs/OBSERVABILITY.md`），说明：

1. 慢查询日志输出在哪（stdout/journalctl）、怎么筛（`journalctl -u <app-service-name> | grep slow_query`）。
2. `/api/health` 新字段的含义。
3. `/api/metrics` 的访问方式（含 `ACRE_METRICS_TOKEN` 获取途径——指向 `<deployment-env-file>`）。
4. Sentry DSN 放在哪个环境变量、默认关闭的行为。

---

## 交付清单

- [ ] `packages/db/src/client.ts` 加了 `log` 配置和事件监听
- [ ] `packages/db/src/health.ts` 导出 `getHealthSnapshot()`
- [ ] `/api/health` route handler 使用新的 snapshot
- [ ] 新建 `/api/metrics` route handler，Prometheus 文本格式，带 token 鉴权
- [ ] `@sentry/nextjs` 接入，DSN 为空时静默禁用
- [ ] `.env.example` 新增三个 Sentry 占位 + `ACRE_METRICS_TOKEN=` + `PRISMA_SLOW_QUERY_MS=` + `PRISMA_VERY_SLOW_QUERY_MS=`
- [ ] `docs/OBSERVABILITY.md` 或现有运维文档更新
- [ ] `pnpm -w typecheck` 通过
- [ ] `pnpm -w lint` 通过
- [ ] `pnpm -w build` 通过
- [ ] 本地 `pnpm dev` 启动成功，`/api/health` 和 `/api/metrics` 能正常响应

## 禁止项

- 不要改任何 Prisma schema
- 不要改任何 `packages/db/src/*.ts` 里已有的查询逻辑
- 不要在 `client.ts` 里加 `connection_limit`、`pool_timeout` 之类的参数（那是 Phase 1 要做的）
- 不要改 systemd unit、Nginx、部署脚本
- 不要改任何现有环境变量的值
- 不要提交 `.env` 文件本身，只改 `.env.example`
