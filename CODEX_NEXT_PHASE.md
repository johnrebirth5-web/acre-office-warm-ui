# Acre 安全收尾 + 代码健康 · 下一轮工作计划

> 发给 Codex 的执行提示词。上下文默认是 `acre-office-warm-ui` 仓库，main 分支，以 HEAD 为起点推进。

---

## 上下文：已完成的防线（不要重做）

你过去两周的交付已经把下面这些基建立住了：

- **CI + gitleaks 守门员**（`d9529553`）
- **Zod 输入校验铺开到 ~50 条关键路由**（`9390cf97` 起 + 15 个批量 commit）
- **全局 CSRF proxy**（`1bec66b7`，Next.js 16 `apps/web/proxy.ts`）
- **共享 rate limit 后端 + Upstash 可选**（`5de1de2`）
- **共享 `withApiGuard` 编排层**（`fd02d04` + `820cf30`）
- **CI concurrency + bootstrap admin 测试隔离**（`7e082b7`）

本轮进入**安全收尾 + 代码健康**阶段。分三档优先级，按顺序推进，不要跳档。

---

## P0 · 必须完成的安全收尾

### P0-1 · 生产密钥轮换

**现状：** `.env` 里写的是生产真实值（`ACRE_SESSION_SECRET=3ab5690...`、`ACRE_RESEND_API_KEY=re_J4gNba2j_...`、DB password `f6ca1b16...`）。这些值在 git 历史里出现过，必须轮换。

**交付两类产物：**

1. **代码/脚本部分**（你写）：
   - `scripts/rotate-session-secret.sh`：在 DO 服务器上生成新 secret、写入 systemd env file、把旧值挪到 `ACRE_SESSION_SECRET_SECONDARY`、触发 reload。dry-run 模式默认开。
   - `docs/ops/secret-rotation-runbook.md`：每个密钥一节，操作步骤、回滚策略、预期空窗时间。
   - `docs/env.md` 的 rotation 表格加一列 "last rotated at"，现状全填 `<pending>`。

2. **运维 checklist**（用户执行）：
   - `docs/ops/secret-rotation-actions.md`：列出需要人在 DO 服务器、Resend 控制台、DB 里做的每一步，精确到命令行。

**禁止事项：**
- 不要把新生成的密钥写进 commit（即使作为 placeholder）
- 不要改 `scripts/deploy-digitalocean.sh`
- 不要跳过 SECONDARY 过渡期（session 需要 30 天兼容）

**验收：**
- `npm run scan:secrets` 干净
- `docs/env.md` 表格结构更新
- runbook 单独跑 shellcheck 通过

---

### P0-2 · 补全量历史扫描定时任务

**目标：** 现在 `secret-scan.yml` 用 `--no-git` 只扫工作目录。加一个每周全量历史扫描。

**交付：**
- `.github/workflows/secret-scan-history.yml`：
  - `on.schedule: "0 6 * * 1"`（每周一 UTC 06:00）+ `workflow_dispatch`
  - 跑 `gitleaks detect --source . --config .gitleaks.toml --redact --no-banner`（注意：**不要** `--no-git`）
  - 失败时用 `actions/github-script` open 一个 issue，标签 `security`、`secret-scan`
  - 不要阻塞 main 分支合并流程
- `.gitleaks.toml` allowlist 复查一遍，确认已知历史泄漏都在里面

**验收：**
- workflow 在 Actions 面板可见
- 手动 `workflow_dispatch` 跑一次通过
- 故意 commit 一个测试密钥到一次性分支上，验证 issue 被创建；然后删分支

---

### P0-3 · 分支保护规则 checklist

**这一项只写文档，不写代码。**

**交付：** `docs/ops/branch-protection.md`

**内容：**
- 必须勾选：require PR before merge、require status checks（`verify` + `hardening-tests`）、require branches to be up to date、require approvals ≥ 1、dismiss stale reviews、no force push、no deletions
- 每条的 GitHub Settings 路径（Settings → Branches → Add rule）
- 每条为什么要开
- 紧急情况的临时绕过流程（admin override + 事后补 PR）

---

## P1 · 巩固现有防线

### P1-1 · 域级输入校验（共享字段 schema）

**目标：** 现有 Zod schema 只校验字段是 string，不校验内容。把常见域约束抽成共享字段 schema。

**交付：**
- 新建 `apps/web/lib/api/field-validators.ts`，导出以下共享字段：
  | 名称 | 约束 |
  |---|---|
  | `amountString` | `/^-?\d+(\.\d{1,2})?$/`，空字符串合法（有些场景是可选） |
  | `rateString` | `/^\d+(\.\d{1,4})?$/` 或 `/^\d+%$/` 之一 |
  | `domainId` | `/^[a-z0-9_-]{10,64}$/i` |
  | `safeEmail` | `z.string().email().max(254)` |
  | `safeUrl` | `z.string().url()`，scheme 限定 `https:`（dev 可接受 `http:`） |
  | `isoDate` | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` |

- `apps/web/lib/api/field-validators.test.ts`：每个 validator 正负用例各 3 个
- 逐步把现有 schema 里裸 `z.string()` 用于上述含义的地方替换成共享字段
  - 优先替换 `finance/route.schema.ts`、`commissions/override/route.schema.ts`、`public/signatures/[token]/submit/route.schema.ts`
  - 每个 route 的替换单独一个 commit

**约束：**
- 不要改变 schema 的字段名、可选性
- 错误消息保留原有语义（比如 `"missing_password"` 这种 token 不能变）
- 不要引入 `validator.js` 或其他字符串校验依赖

**验收：** 现有 route tests 全部继续通过；新 `field-validators.test.ts` 覆盖所有导出

---

### P1-2 · `withApiGuard` prepare 语义敲定

**现状：** `prepare` 在 `canAccess` 之前跑。权限拒绝时 `prepare` 也会执行一遍。

**交付方案 A（推荐）：**
- 在 `apps/web/lib/with-api-guard.ts` 顶部 JSDoc 写明：
  > `prepare` MUST be idempotent and side-effect free. It runs after auth but before permission checks and rate-limit consumption, which means a request rejected at `canAccess` still incurs `prepare`'s cost. Use `prepare` only to derive values (e.g. parse `formData`, extract query params) needed by `rateLimit.key`.
- `with-api-guard.test.ts` 加一个测试："prepare runs before canAccess denies"，用 counter 验证调用次数

**不要改执行顺序**（会影响 login 从 formData 挖 email 这种用例）。

---

### P1-3 · Upstash 切换演练 + 文档

**目标：** memory → upstash 切换有代码支持但没演练过。

**交付：**
- `docs/ops/rate-limit-upstash.md`：
  - Upstash 账号开通步骤（截图可选）
  - 需要的环境变量：`ACRE_RATE_LIMIT_BACKEND=upstash`、`ACRE_UPSTASH_REDIS_REST_URL`、`ACRE_UPSTASH_REDIS_REST_TOKEN`
  - 本地验证方式
  - 回滚方式（改回 `memory` 重启）
  - 失败模式（Upstash 宕机时的行为 —— 当前会抛错 503）
- 本地用一个 mock fetch 的端到端测试，验证 `ACRE_RATE_LIMIT_BACKEND=upstash` 时 `consumeRateLimit` 走 Upstash 路径
- **不需要**真的切生产

**验收：** 文档完整；本地演练的 log 片段贴进文档

---

### P1-4 · 可信任反向代理头优先级

**目标：** 将来挂 Cloudflare 或其他 CDN 时，`x-forwarded-for` 可被伪造。现在加环境变量控制。

**交付：**
- `apps/web/lib/rate-limit.ts` 的 `getRequestClientIdentifier` 加一个环境变量 `ACRE_TRUSTED_PROXY_TIER`：
  - `none`（默认）：现有逻辑不变
  - `cloudflare`：`cf-connecting-ip` 提为第一优先级
  - `reverse-proxy`：`x-real-ip` 提为第一优先级（Nginx/Caddy 默认写这个 header）
- 单元测试覆盖三种模式
- `docs/env.md` 加说明

**约束：** 默认值 `none` 不改变现有行为

---

## P2 · 代码组织债（大文件拆分）

我在原诊断里提过的"维护税"部分。不是安全风险，但影响长期可维护性。一个文件一个 PR，不要批量。

### P2-1 · 拆 `packages/db/src/front-office-clients.ts`（6603 行）

**建议拆分（可自行调整）：**

```
packages/db/src/front-office-clients/
├── queries.ts       // 读查询
├── mutations.ts     // 写操作
├── snapshots.ts     // 聚合快照
├── access-control.ts // 权限过滤逻辑
├── types.ts         // 共享类型
└── index.ts         // re-export，对外 API 不变
```

**约束：**
- 公共导出列表、每个函数签名、调用方代码**零改动**
- 每个 commit 必须 `npm run typecheck` + `npm run test:backoffice-hardening` 通过
- 中间状态可以 commit（拆了一半也算一个 commit），但不能破坏 build
- 拆完单个文件不超过 2000 行

**验收：**
- 所有 import 站点无变化
- 测试全绿
- 新目录结构 ≤ 2000 行/文件

---

### P2-2 · 按同样方式拆其余大文件

按优先级（行数从多到少）：

1. `packages/db/src/front-office-workspaces.ts`（5426 行）
2. `packages/db/src/commissions.ts`（4542 行）
3. `packages/db/src/transaction-documents.ts`（4168 行）
4. `packages/db/src/agents.ts`（4047 行）
5. `apps/web/app/agent/calendar/front-office-calendar-client.tsx`（3560 行 —— 这个是 React 组件，拆分策略不同，按子组件 + hooks + 常量三档拆）

**一个 PR 只拆一个文件。**

---

## P3 · 可观测性（时间充裕时再做）

### P3-1 · Rate limit 拒绝事件结构化日志

**交付：**
- `apps/web/lib/rate-limit.ts` 的 `consumeRateLimit` 加可选 `onDecision` hook
- 默认实现：当 `decision.allowed === false` 时打一行 JSON 到 stderr
  ```json
  {"event":"rate_limit_rejected","key":"<key>","limit":10,"retry_after":30,"ts":"2026-04-18T..."}
  ```
- **不要**引入 pino / winston / Sentry SDK，纯 `console.error(JSON.stringify(...))` 足够
- 留 hook 入口让未来可以接外部 log collector

---

### P3-2 · CI 测试 matrix 拆分（触发条件：`hardening-tests` 单次跑 > 8 分钟）

当前不用做。记在 `docs/CODEX_ROADMAP.md` 的 R0 末尾即可。触发后按以下切：

- `unit`：不需要 DB 的 lib / schema tests
- `integration`：需要 Postgres service 的 route tests + packages/db tests
- 两个 matrix job 并行，都过才 merge

---

## 执行节奏

沿用你已经在用的方式：

1. **每个 commit 一个主题**，message 写"为什么"不是"做了什么"
2. **每个 commit 通过** `npm run typecheck && npm run lint && npm run test:backoffice-hardening`
3. **每完成一个 P0/P1/P2 项**，在 `docs/CODEX_ROADMAP.md` 末尾加 roll-out 记录（日期 + commit sha + 一句话总结）
4. P0 三项必须先完成再进 P1
5. P1 四项可以并行切片
6. P2 严格一次一个文件

## 禁止事项

- 不要引入新的大型依赖（ORM、日志库、监控 SDK、校验库）
- 不要改 Prisma schema 或 migration
- 不要动生产部署脚本
- 不要修改 Next.js 16 proxy / middleware 核心
- 不要把新生成的生产密钥写进任何文件（包括作为示例）
- 不要在 commit 里夹带"顺手修"的无关改动

## 需要用户手动执行的项（你负责生成 checklist，不要代做）

- P0-1 运维动作（DO 服务器、Resend 控制台、DB 用户切换）
- P0-3 GitHub 分支保护规则设置
- P1-3 Upstash 账号开通（如果决定切）

这些产物放 `docs/ops/<item>.md`，写到"ops 抄命令就能做"的颗粒度。

---

## 开始

从 **P0-1 的 runbook + rotate-session-secret.sh 脚本** 起步。运维 checklist 和本地 dry-run 产物先出来，等用户确认再推进后续子项。
