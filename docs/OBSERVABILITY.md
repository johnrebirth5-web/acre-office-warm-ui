# Observability

## 慢查询日志

- Prisma 慢查询日志由 `packages/db/src/client.ts` 在运行时输出到进程标准错误。
- 本地开发直接看当前终端输出即可。
- 生产环境通过 systemd/journald 查看：
  - `journalctl -u acre-ui-rebuild-web.service`
  - `journalctl -u acre-ui-rebuild-web.service | grep slow_query`
  - `journalctl -u acre-ui-rebuild-web.service | grep very_slow_query`
- 默认阈值：
  - `PRISMA_SLOW_QUERY_MS=500`
  - `PRISMA_VERY_SLOW_QUERY_MS=2000`
- 生产环境会把 `params` 字段写成 `"[REDACTED]"`；非生产环境保留原始参数，便于本地定位。

## /api/health

- `GET /api/health` 仍保留现有 `status` 语义：
  - `ok`：应用与数据库探测正常
  - `degraded`：数据库未配置、探测超时、探测失败，或 health 采样出现异常
- 新增字段：
  - `health_status`：更细粒度的内部状态，可能为 `ok`、`degraded`、`error`
  - `db.ping_ms`：`SELECT 1` 的耗时，单位毫秒
  - `db.pool_in_use`：当前数据库 `active + idle in transaction` 连接数
  - `db.pool_idle`：当前数据库 `idle` 连接数
  - `db.pool_max`：`max_connections`
  - `process.rss_bytes`：进程常驻内存
  - `process.heap_used_bytes`：Node/V8 已使用堆内存
  - `process.heap_total_bytes`：Node/V8 已分配堆内存
  - `process.uptime_seconds`：当前进程运行时长
- `db.pool_*` 查询失败时会返回 `null`，并把整体状态降为 `degraded`，但不会把接口抛成 500。

## /api/metrics

- `GET /api/metrics` 返回 Prometheus 文本格式，适合 Prometheus、VictoriaMetrics、Grafana Agent 等采集器直接抓取。
- 必须带请求头：
  - `X-Metrics-Token: <ACRE_METRICS_TOKEN>`
- 未配置 `ACRE_METRICS_TOKEN` 或 token 不匹配时返回 `401`。
- 生产环境 token 来源：
  - `/etc/acre/acre-ui-rebuild.env`
- 示例：

```bash
curl -H "X-Metrics-Token: <token>" http://localhost:3105/api/metrics
```

## Sentry

- Sentry 通过环境变量 `SENTRY_DSN` 控制。
- 当 `SENTRY_DSN` 为空时，客户端、服务端、Edge 端都不会调用 `Sentry.init()`，因此默认是静默关闭状态。
- `SENTRY_TRACES_SAMPLE_RATE` 控制 tracing 采样率，默认 `0.1`。
- `SENTRY_AUTH_TOKEN` 仅用于构建阶段 source map 上传；未设置时构建不会被阻塞，并会跳过 source map 上传能力。
