# Acre 百人并发 + 大库扩展性审计

> 2026-04-19 基于 `main` @ `3274acb` 的一次性审计。本文不是执行计划，是"目前的代码能扛多大、在哪一刻会死"的结论盘点。
> 最后一节是按优先级排序的修复路径。

## 1. 一句话结论

**当前架构在 ~30-50 个并发用户前能勉强扛住。到 100 个并发、或数据表涨到百万行级，会在以下顺序崩盘：**

1. Prisma 连接池饱和 → 请求大面积超时
2. Session 解析每请求 3-4 次查库，没缓存 → 放大连接池压力
3. 热路由（`/api/office/transactions` 等）单次请求打 8-12 次 DB → 进一步放大
4. 大事务里循环写（agent-billing 最多 1000+ 条 statements）→ 长持锁，阻塞其他请求
5. 未分页的 `findMany`（614 处，占所有 findMany 47%）→ 随表增长，单次查询就能 OOM
6. 没有 APM / 慢查询日志 → 死了不知道死在哪

**相对而言**，Zod / CSRF / secret 轮换这些近两周做的安全基建**完全不是瓶颈**。11 处 raw SQL 全部参数化，也没有 SQL 注入风险。这次的痛点 100% 在"性能 + 可扩展性"侧。

---

## 2. 会让系统崩的硬问题（必须先修，否则 100 人上线当天死）

### 2.1 Prisma 连接池默认（严重度 3）

- **证据**：`packages/db/src/client.ts:57-59`，`new PrismaClient()` 无任何配置；`DATABASE_URL` 里也没 `connection_limit` 参数。
- **默认行为**：`connection_limit = num_physical_cpus * 2 + 1`。在 2-core DO droplet 上是 **5 条**，4-core 是 **9 条**。
- **算账**：100 用户 × 每人每秒约 1 请求 × 每请求平均 5-8 次 Prisma 调用 = **500-800 个并发 DB 调用**排队抢 5-9 条连接。平均等待 100 秒+，客户端 30 秒超时，雪崩。
- **没有 PgBouncer**：文档里 grep `pgbouncer` 零命中。

### 2.2 Session 每请求 3-4 次查库，零缓存（严重度 3）

- **证据**：`apps/web/lib/with-api-guard.ts:130-132` → `getRequestSessionContext` → `packages/db/src/auth.ts` 的 `getSessionMembershipContext`。
- **每次调用做**：`membership.findUnique` + `office.findMany` + 权限 key 查询。**没有 memoize，没有 per-request cache，也没有外部 cache**。
- **放大效应**：一个用户同时开 5 个 tab 打 10 个 API，就产生 **150-200 次 session 查库**。这些查询本身都打 2.1 节的同一个连接池。

### 2.3 热路由单次打 8-12 次 DB（严重度 1，会雪崩）

最贵的 5 条路由，按"每请求 Prisma 调用数 / 循环查询 / 100 人并发估算"：

| 路径 | 每请求调用 | 循环 | 100req/s 需要连接数 |
|---|---|---|---|
| `/api/office/transactions` | 8-12 | 否 | ~1000 calls/sec |
| `/api/agent/clients` | 5-7 | 否 | ~600 calls/sec |
| `/api/office/activity/alerts` | 6 | 否 | ~600 calls/sec |
| `/api/office/mail/unread-count` | 2-3 | 否 | 高频被调用 |
| `/api/clients` | 1 | 否 | 单次查询可拉百万行（未分页） |

### 2.4 事务里跑循环/慢活，持锁 10+ 秒（严重度 1）

- `packages/db/src/agent-billing.ts:1937-1971`：`prisma.$transaction` 内 `for (rule of rules)` → `saveAccountingTransactionInternal()` → 嵌套 while。单次请求可产生 **1000+ 条 DB 写**，持读写锁可达 10+ 秒。
- `packages/db/src/agent-payout-statements.ts:1600-1700`：事务内 `findMany` + map 计算 + `createMany`。秒级计算在事务里。
- `packages/db/src/contacts.ts:1260-1400`：事务内复杂合并，100+ 行逻辑。
- `packages/db/src/accounting.ts:1545-1650`：事务内多个 findMany + 财务计算。

任一条在 100 并发下发生，整个连接池**短时间全被这一个请求吃掉**，其他请求全挂。

---

## 3. 会让系统慢的软问题（可以随负载增加逐步修）

### 3.1 614 处未分页 `findMany`（47% of all findMany）

**最坏 10 条（按表增长势头排序）**：

| 严重度 | 位置 | 问题 |
|---|---|---|
| 1 | `packages/db/src/activity-log.ts:2029-2430` | 12 处条件 `findMany(transactions/offers/tasks/clients)`，全无分页 |
| 1 | `packages/db/src/accounting.ts:1348` | `ledgerAccount.findMany()` 无分页，所有账户全查 |
| 1 | `packages/db/src/accounting.ts:1355` | `earnestMoneyRecord.findMany()` 无 take，include transaction，可达万级 |
| 1 | `packages/db/src/accounting.ts:1362` | `membership.findMany()` 无分页，active agents 全表 |
| 1 | `packages/db/src/access.ts:141` | `team.findMany()` 无分页 |
| 1 | `packages/db/src/agent-billing.ts:838` | `membership.findMany()` 无 take/skip，加 include |
| 2 | `packages/db/src/front-office-dashboard.ts:1159` | dashboard 初始化时 `membership.findMany()` 无限制 |
| 2 | `packages/db/src/front-office-resources.ts:690` | `membership.findMany()` 无分页 |
| 2 | `packages/db/src/mail.ts:1073` | `officeMailThread.findMany()` 无 take |
| 2 | `packages/db/src/mail.ts:1540` | `officeMailParticipant.findMany()` 无分页 |

当表是小几千行时这些不是问题；到十万行级就开始 OOM + 超时。

### 3.2 深层 include 链（5 处，3 层嵌套以上）

| 严重度 | 位置 | 层级 |
|---|---|---|
| 1 | `packages/db/src/mail.ts:250-280` | participants → membership → user/office |
| 1 | `packages/db/src/agent-payout-statements.ts:1625-1637` | transaction → ownerMembership → user |
| 2 | `packages/db/src/front-office-clients/detail.ts:313-318` | 4 个 `Promise.all` 并发查询 |
| 2 | `packages/db/src/agent-billing.ts:1124-1128` | 2 层，take 400，100+ 行时重 |

Prisma 把这些编译成多轮 roundtrip 或 `LEFT JOIN LATERAL`，每条路由成本被隐式放大 3-5 倍。

### 3.3 单进程 Node + 无 Nginx keepalive（严重度 2）

- **证据**：`scripts/deploy-digitalocean.sh:8-14`、`docs/deployment.md`。
- systemd 跑单 Node 进程，无 PM2 cluster、无 Node `cluster` 模式。
- Nginx 转 `127.0.0.1:3206`，未找到 `upstream { keepalive }` 指令。
- 结果：多核 CPU 吃不满；每个 Nginx → Node 请求开新 TCP。

### 3.4 巨型 client component，hydration 成本高（严重度 2）

| 行数 | 文件 | 问题 |
|---|---|---|
| 2886 | `apps/web/app/agent/notifications/agent-notifications-client.tsx` | 全量 snapshot 一次 hydrate，无虚拟化，客户端重复过滤 |
| 2557 | `apps/web/app/listing-studio/listings/[packId]/listing-studio-detail-client.tsx` | 21 个 onChange 无 `useCallback`/debounce，每次键盘输入全组件 re-render |
| 1716 | `apps/web/app/agent/calendar/front-office-calendar-client/client.tsx` | 每次 render 遍历全 appointments 数组，无索引化 |

加上三个首屏序列化数据都 > 100 KB：
- `apps/web/app/office/dashboard/page.tsx:78`：chart / commission / statements / transactions 全量传
- `apps/web/app/agent/notifications/page.tsx:51-71`：三个 snapshot 并行 fetch 后全传给 2886 行组件
- `apps/web/app/agent/calendar/page.tsx:61`：clientOptions/listingOptions/appointments 整个传，client 上用 `.find()` 反复搜

### 3.5 签名图片 base64 进 state（严重度 3，小痛点但会出事）

- `apps/web/app/sign/[token]/public-signature-client.tsx:252, 280, 396`
- 签名 `canvas.toDataURL("image/png")` 和上传图 `reader.readAsDataURL(file)` 都以 base64 整个存 state。
- 100 KB+ 图片每次 re-render 都重新编码。多人同时签约会把内存吃爆。

### 3.6 N+1 循环查询（8 处）

| 严重度 | 位置 | 循环大小 |
|---|---|---|
| 1 | `packages/db/src/agent-billing.ts:1937-1971` | rules × 月份，1000+ writes |
| 1 | `packages/db/src/studio-listings.ts:1472-1509` | savedAssets，百级 |
| 2 | `packages/db/src/contacts.ts:1459` | transactionContact 循环内查 |
| 2 | `packages/db/src/mail.ts:833-837` | 附件逐个 |

### 3.7 没有缓存策略

- 整个 `apps/web/` 只有 **6 处** `revalidate`/`dynamic`/`unstable_cache`，大部分还是 `export const dynamic = "force-dynamic"`（关掉 Next 默认缓存）。
- 结果：Next.js 缓存层完全没被用上，每个请求都走 SSR + DB。
- 静态资源由 Nginx 直供，没有 CDN。

---

## 4. 可观测性窟窿（严重度 3，因为没这个，你连上面问题出现都感知不到）

全部是**没有**：

- ❌ APM / Tracing（无 OpenTelemetry、Sentry Performance、Datadog RUM）
- ❌ Prisma 慢查询日志（`client.ts` 没配 `log: ["query"]`）
- ❌ Prometheus / `/metrics` endpoint
- ❌ Error tracking（无 Sentry SDK）
- ❌ 健康接口不暴露 pool 使用率 / DB latency，只 `SELECT 1`

现状：出事时你只能靠 `journalctl` 肉眼扫。

---

## 5. 已经是干净的部分（不用动）

- 11 处 `$queryRaw` / `$executeRaw` 全部参数化，**零 SQL 注入风险**
- 270 个 `@@index` + `@@unique`（3452 行 schema 下），索引覆盖面正常
- Zod 校验、CSRF、rate-limit、session secret 轮换基建都到位
- `TODO/FIXME/HACK` 标记：**0**（代码整洁度好）
- `any` 类型：`apps/web/lib` / `apps/web/app` 下仅 9 处
- `@ts-ignore`：761 处（需要扫一下，可能是类型定义问题）

---

## 6. 修复路径（按"撑住 100 人"的优先级）

### 第 0 阶段：先装可观测性（1-2 天）

没有监控，下面任何修复都在盲修。装这四样：

1. **Prisma 慢查询日志**：`client.ts` 给 PrismaClient 加 `log: [{ emit: "event", level: "query" }]`，超过 500ms 的 query 打 `console.warn`
2. **Sentry 或自建 error tracking**：至少把未捕获异常打到一个集中位置
3. **`/api/health` 扩展**：增加 pool 使用率（用 Prisma `$metrics.json()`）、DB 平均延迟
4. **Node process metrics**：简单的 `/metrics` endpoint 暴露 RSS、heap、event loop lag

### 第 1 阶段：阻止 100 人上线当天死（3-5 天）

**按影响面排序，一个一个做：**

1. **Prisma 连接池显式配置**
   - `DATABASE_URL` 加 `?connection_limit=50&pool_timeout=10&statement_timeout=10000`
   - 或者引入 **PgBouncer**（session mode），放在 Postgres 前面
   - 预期效果：从"池爆"变成"慢但不崩"

2. **Session 解析缓存**
   - `with-api-guard` 里把 `getSessionMembershipContext` 的结果 memoize 到当前请求（Next.js `cache()` 或一个 WeakMap）
   - 进阶：把 session → membership 映射写到 Upstash，TTL 30-60 秒
   - 预期效果：每请求 DB 查询从 3-4 次降到 0-1 次

3. **砍掉事务里的循环**
   - `agent-billing.ts:1937` / `agent-payout-statements.ts:1600` / `contacts.ts:1260` / `accounting.ts:1545`
   - 把循环挪到事务外先计算完，事务里只批量写
   - 预期效果：持锁从 10+ 秒降到亚秒

4. **最热 5 条 GET 路由减少 Prisma 调用数**
   - `/api/office/transactions`、`/api/agent/clients`、`/api/office/activity/alerts` 每条减到 ≤ 3 次查询
   - 手段：合并查询、改用 `Promise.all`、把 count 用 `$queryRaw` 一条 SQL 查完

### 第 2 阶段：让系统在 100 人下舒适（5-10 天）

5. **给最坏的 10 条未分页 `findMany` 加分页 + max-take**
   - `activity-log.ts` 那 12 处、`accounting.ts` 三连、`mail.ts` 的列表
   - 每条 API 默认 take ≤ 50，前端改成 cursor 分页

6. **PM2 cluster 或 Node cluster 模式**
   - 改成 2-4 进程（根据 droplet 核数），Nginx upstream 挂多个内部端口
   - 前提：先解决"内存 rate-limit 跨进程失效"——部署 Upstash（代码已经就绪）

7. **Nginx 前置缓存 + CDN**
   - 静态资源走 CDN（Cloudflare / Bunny）
   - Nginx upstream 加 `keepalive 64`

### 第 3 阶段：前端侧（持续优化）

8. **三个最大的 client component 拆**（2886 / 2557 / 1716 行）
   - 按功能切成 5-8 个小组件
   - 列表加 `react-window` 虚拟化
   - 重 onChange 加 `useCallback` + debounce

9. **签名页用 Blob 替代 base64**
   - `public-signature-client.tsx:252,280` 改成 `canvas.toBlob` + `URL.createObjectURL`

10. **首屏 SSR payload 瘦身**
    - dashboard / notifications / calendar 只传首屏 20-50 条，"显示更多"走 API

### 第 4 阶段：未来可扩展性（100+ 用户或多机部署时）

- Postgres 只读副本做 report / dashboard 类查询
- Redis 做 session cache
- 考虑把 activity-log 和 mail 这两个高写入表做 partition 或归档

---

## 7. 数字快览

- 总 TS 行数：226,347
- Next.js 路由：170
- 测试文件：146
- Zod schema：94
- Prisma 迁移：66
- Prisma schema：3,452 行
- findMany 总数：1,310（其中 614 未分页）
- `$transaction` 块：130
- 深层 include 链：5 处 ≥ 3 层
- 最大 client.tsx：2,886 行
- 最大 packages/db 文件（未拆的）：`front-office-dashboard.ts` 3,649 行

---

*本审计是一次性快照，不替代持续性能监控。第 0 阶段装完监控之后，所有数字应该被实时 dashboard 替代。*
