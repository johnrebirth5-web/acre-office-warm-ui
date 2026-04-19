# ACRE 系统 · 修订版 Codex Roadmap

> 本文件是对外部 reviewer 路线稿的仓库内修订版。
> 目标不是重复实现已经 live 的模块，而是把后续工作收敛成一份贴合当前代码和文档基线的执行清单。
> 修订日期：2026-04-09

---

## 0. 使用顺序与优先级

本文件只作为“后续推进手册”使用，不能覆盖以下更高优先级文件：

1. [AGENTS.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/AGENTS.md)
2. [docs/specs/frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md)
3. [docs/specs/backoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/backoffice-overview.md)
4. [docs/specs/documents-signature-spec.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/documents-signature-spec.md)
5. [docs/specs/product-coverage-audit.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/product-coverage-audit.md)
6. [docs/specs/implementation-log.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/implementation-log.md)

如果本文件与上述文档冲突，以这些文档为准。

---

## 1. 当前仓库真实基线

### 1.1 工程与校验基线

- 包管理器：`npm`
- Monorepo：`Turborepo`
- 默认校验命令：
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Prisma 变更后追加：
  - `npm run db:validate`
  - `npm run db:generate`
  - `npm run db:migrate -- --name <change_name>`（确有 schema 变更时）
  - `npm run db:seed`（仅任务需要时）

### 1.2 Git 与部署基线

- 默认分支：沿用当前工作分支，除非任务明确要求分支策略
- 默认远端：`origin = https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
- 默认部署目标：`DigitalOcean`
- 不把 `Vercel` 当成当前默认交付目标
- 不在未被明确要求时执行生产部署

### 1.3 不要误判为“缺失”的已落地能力

以下能力已经不是“从零开始”：

- `Front Office`
  - `/agent/dashboard`
  - `/agent/clients`
  - `/agent/calendar`
  - `/agent/notifications`
  - route-persistent workbench re-entry
  - duplicate review + merge
  - handoff draft + BO transaction prefill
  - browser-side `OCR / transcript assist` beta
- `Back Office`
  - `/office/transactions`
  - `/office/contacts`
  - `/office/tasks`
  - `/office/signatures`
  - `/office/signatures/templates`
  - `Settings > Email delivery`
  - `Settings > Signature Drive`
  - `/api/health`
- `eSignature`
  - 自托管请求中心
  - recipient-token 公开签署页
  - Resend 优先、SMTP fallback 的邮件发送
  - signed PDF 归档
  - Google Drive sync 可见状态和手动重试

因此后续工作应以“硬化、补深度、补基础设施”为主，而不是把这些模块当成完全未实现。

---

## 2. 执行纪律

每完成一个 Task：

1. 在对应 Task 标题旁打勾 `- [x]` 并注明完成日期与 commit hash。
2. 在本文末尾的“变更日志”追加一段不超过 300 字的摘要。
3. 运行与任务匹配的最小必要验证；若涉及全局公共面或 schema，再跑仓库级校验。
4. 如果改动数据库 schema，新增 Prisma migration，不改历史 migration。
5. 如果触及权限、路由、schema、环境变量或核心产品行为，同步更新相关文档。

禁止事项：

- 禁止提交明文密钥、密码、Token、私钥。
- 禁止通过 `any`、`@ts-ignore`、`@ts-nocheck` 绕过问题。
- 禁止删除已有 `AuditLog` / 业务审计写入，只能在保真前提下重构。
- 禁止把尚未真正记录的状态说成“已发送”“已同步”“已签署”“已到账”。
- 禁止把已上线的 FO/BO live surface 重新当成空壳重复造轮子。

---

## 3. 修订后的阶段总览

| 阶段 | 目标 | 预估工期 | 是否阻塞真实环境上线 |
|------|------|----------|----------------------|
| Phase 0 | 安全与输入边界硬化 | 1-2 周 | ✅ 是 |
| Phase 1 | 工作流一致性与防御性补强 | 2-4 周 | ✅ 是 |
| Phase 2 | 产品深度与基础设施补齐 | 1-2 月 | ⚠️ 部分 |
| Phase 3 | 测试、可观测性、运维成熟度 | 持续 | ❌ 否 |

说明：

- `Phase 0` 和 `Phase 1` 的目标是把“当前能用”提升到“更稳更可控”。
- `Phase 2` 不是“补缺整个系统”，而是围绕当前 live surface 提升深度。
- `Phase 3` 优先做对真实运维最有价值的项，不做为了好看而堆栈。

---

## Phase 0 · 安全与输入边界硬化

### R0-1 会话密钥强化与轮换支持
- [x] **文件：** `apps/web/lib/auth-session-config.ts`、`.env.example`、必要时新增 `scripts/generate-session-secret.ts`（2026-04-09，`a19c17e`）
- **当前真实状态：**
  - 生产环境下缺少 `ACRE_SESSION_SECRET` 已会直接报错
  - 开发环境仍保留固定 dev fallback
- **目标：**
  - 增加弱 secret 检测
  - 评估并实现双 key 验签轮换支持（如 `PRIMARY / SECONDARY`）
  - 保持开发环境可启动，但不能把示例值带进生产
- **验收：**
  - 生产环境弱 secret / 缺 secret 直接失败
  - 轮换路径有单元测试覆盖
  - `.env.example` 只保留生成说明，不放示例弱值

### R0-2 高风险路由输入校验统一化
- [ ] **新增：** `apps/web/lib/validate.ts`
- [ ] **评估新增：** `packages/db/src/schemas/*` 或等价领域 schema 目录
- **当前真实状态：**
  - 现有路由有不少手写校验
  - 但没有统一 schema 入口
- **优先范围：**
  - `/api/office/transactions/**`
  - `/api/office/settings/**`
  - `/api/office/signatures/**`
  - `/api/agent/clients/intake-assist`
- **验收：**
  - 非法 body / query 返回一致化 400
  - 错误消息不泄露内部字段细节
  - 关键失败路径有 route test 或 service-level regression test
- **已落地 slice：**
  - `POST /api/office/transactions` 与列表 query 参数已切到统一 `validate` helper，并补了 route-level regression test（2026-04-10，`a8dc78e`）
  - `office signature send/resend` PATCH 路由已接入统一 action 解析，并补了 route-level regression tests（2026-04-11，pending）

### R0-3 路由权限包装层统一
- [ ] **新增：** `apps/web/lib/with-permission.ts` 或等价 helper
- **当前真实状态：**
  - 现有路由已大量使用 `canView...` / `canManage...` helper
  - 但缺统一包装和目录级审计
- **目标：**
  - 在不破坏现有权限语义的前提下，统一 session + permission + 403 响应模式
  - 为新增路由建立固定接入方式
- **优先范围：**
  - `office/settings`
  - `office/signatures`
  - `office/transactions`
  - `office/accounting`
- **验收：**
  - 高风险写路由都通过统一包装层进入
  - 未授权访问会稳定返回 401/403，且无副作用
  - 权限 key 映射可在 PR 说明中追踪
- **已落地 slice：**
  - `office/settings/email-delivery`、`signature-drive`、`users` 三组设置路由已接入统一 wrapper，并补了 helper test（2026-04-10，`aeca10d`）
  - `office/settings/email-delivery` 与 `signature-drive` 的 PATCH 已补统一 Zod body schema、handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/settings/users` 主入口与 `[membershipId]` PATCH 已补统一 Zod body schema、handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/settings/users/[membershipId]/permissions` 已补 PATCH body schema、DELETE query validation 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/settings/users/[membershipId]/invitation` 已补 POST body schema 与 handler-level regression tests，`unlock` 也已补 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/transactions/[transactionId]` 状态更新、`contacts` 绑定、`incoming-updates/[incomingUpdateId]` 审核、`offers/[offerId]/comments` 评论已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/transactions/[transactionId]/incoming-updates` 创建、`forms` 创建、`forms/[formId]` 更新已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/transactions/[transactionId]/offers/[offerId]`、`tasks` 主入口、`tasks/[taskId]` 更新、`tasks/[taskId]/workflow` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/transactions/[transactionId]/documents/[documentId]`、`signatures` 创建、`signatures/[signatureRequestId]/fields` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/transactions/commission-preview`、`search-layout`、`[transactionId]/intake`、`[transactionId]/offers` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/transactions` 主入口 `POST` 已补统一 Zod body schema 与 create-flow regression tests，保留现有 FO handoff / owner assignment / finance fee 语义不变（2026-04-18，pending）
  - `office/account/notifications`、`office/notifications`、`office/notifications/[notificationId]` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/resources`、`office/resources/[resourceId]` 的 JSON 管理路径，以及 `office/resources/vendors`、`office/resources/vendors/[vendorId]` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/library/folders`、`office/library/folders/[folderId]` 与 `office/library/documents/[documentId]` 的 JSON 管理路径已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/tasks/views` 与 `office/reports/search-layout` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/account/profile`、`office/activity/comments` 与 `office/mail/threads/[threadId]` 的轻量写入口已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/1099-tracker/records` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/accounting/agent-billing/payment-methods`、`payment-methods/[paymentMethodId]`、`charges`、`payments` 与 `credit-applications` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/accounting/agent-billing/recurring-rules`、`recurring-rules/[recurringChargeRuleId]` 与 `recurring-rules/generate` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office/accounting/statements`、`statements/[statementId]`、`statements/[statementId]/status`、`statements/[statementId]/send` 以及 `accounting/self-service/statements/[statementId]/review` 已补统一 Zod body schema 与 handler-level regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）
  - `office signature send/resend` PATCH 路由已接入统一权限 wrapper，去掉重复 session / 403 分支（2026-04-11，pending）
  - 新增 `withApiGuard` 统一收口 `csrf + auth + permission + prepare + rate limit`，并把 `login`、`FO intake-assist`、`office signature request PATCH` 三条高复用入口迁到共享 guard；对应 route tests 已纳入 `test:backoffice-hardening`（2026-04-17，pending）
  - `change-password`、`invitation accept`、`public signature submit` 已迁到共享 `withApiGuard`，补齐了 redirect/429 级别的 route regression tests，并纳入 `test:backoffice-hardening`（2026-04-18，pending）

### R0-4 写操作的基础防护：CSRF + rate limit
- [ ] **新增：** `apps/web/lib/csrf.ts`
- [ ] **新增：** `apps/web/lib/rate-limit.ts`
- **说明：**
  - 当前 cookie 为 `sameSite: "lax"`，不能只凭“直觉”直接全量改 `strict`
  - 先补写路由 CSRF 保护和统一 rate limit，再评估 cookie 收紧是否会影响现有入口
- **优先范围：**
  - 登录
  - Office 写接口
  - 签署发送 / resend
  - FO intake assist server route
- **验收：**
  - 关键写接口具备 CSRF 校验
  - 高频攻击面可稳定返回 `429`
  - 现有正常登录和内部工作流不被误伤
- **已落地 slice：**
  - 登录与 `FO intake-assist` 已接入 same-origin CSRF 校验和内存型 rate limit，并补了 route tests（2026-04-10，`07d40fc`）
  - `office signature send/resend` PATCH 路由已接入 same-origin CSRF 校验和发送级 rate limit（2026-04-11，pending）
  - `/api/:path*` 已新增全局 same-origin CSRF proxy，并对白名单收敛到 `listing-studio extension connect/start` 与 `listing-studio imports` 两类 extension-token 写入口（2026-04-17，pending）
  - `rate-limit.ts` 已支持 `memory/upstash` 双后端，并把 `change-password`、`invite accept`、`public signature submit`、`listing-studio imports` 纳入统一限流（2026-04-17，pending）

### R0-5 外发邮件发送边界收敛
- [ ] **整理目标文件：** `apps/web/lib/signature-email.ts` 及相关发送入口
- **当前真实状态：**
  - Resend 发送逻辑仍主要存在于 `apps/web/lib/signature-email.ts`
  - SMTP 配置与加密已落地，不应重复实现
- **目标：**
  - 收敛 provider-specific 发信逻辑，避免未来多处散落
  - 不重复实现 `smtp-settings` 的加解密能力
- **验收：**
  - 签名发送、完成通知、reply-to 选择逻辑边界清晰
  - 文档明确 Resend / SMTP 的优先级和 fallback 行为
- **已落地 slice：**
  - `signature-email` 已收拢 sender / reply-to 解析逻辑，并补了 helper tests（2026-04-10，`1788e7f`）
  - `office signature send/resend` 入口已改为复用收口后的 sender / reply-to 解析与统一发送边界（2026-04-11，pending）

---

## Phase 1 · 工作流一致性与防御性补强

### R1-1 FO -> BO handoff 原子性补强
- [ ] **文件：** `packages/db/src/front-office-contracts.ts`、`apps/web/app/api/office/transactions/route.ts`
- **当前真实状态：**
  - claim / commit 防重复链路已经存在
  - 但 transaction create 与 handoff finalize 之间仍有“创建成功、回写失败需人工核对”的尾部风险
- **目标：**
  - 在现有机制上补事务性、一致性和冲突测试
  - 不把现有 live flow 当成从零重写对象
- **验收：**
  - 并发 claim / commit 场景有测试
  - 冲突返回语义稳定
  - AuditLog / 用户提示明确说明成功、冲突、尾部失败三类结果
- **已落地 slice：**
  - claim / commit 并发测试已补齐，transaction create 后 handoff commit 失败时会显式返回 cleanup 结果，降低尾部挂起风险（2026-04-09，`69156df`）

### R1-2 高价值 POST 幂等支持
- [ ] **评估新增模型：** `IdempotencyKey`
- **优先范围：**
  - `POST /api/office/transactions`
  - 签名发送 / resend
  - 后续真正需要去重保护的财务写接口
- **说明：**
  - 不是所有写路由都必须先引入幂等
  - 先覆盖“重复提交成本高”的接口
- **验收：**
  - 同 key 重放不会重复创建交易或重复触发高价值副作用
  - 回放响应可预测

### R1-3 `/api/health` 从静态回显扩展为依赖健康检查
- [x] **文件：** `apps/web/app/api/health/route.ts`（2026-04-09，`538d23d`）
- **当前真实状态：**
  - 路由已存在，但还是轻量静态回显
- **目标：**
  - 增加 DB、缓存、邮件发送器、签署发送器等可选检查
  - 保持轻量、可匿名 smoke-test 的特性
- **验收：**
  - 至少能区分“应用存活”和“依赖可用”
  - 错误信息不会暴露 secret 或内部实现细节

### R1-4 Worker / job runner 最小基线
- [ ] **文档优先：** 先定义哪些任务必须脱离请求时执行
- **优先候选：**
  - appointment reminder delivery
  - signature email retry / drive sync retry
  - cleanup digest scheduler
- **注意：**
  - 默认部署目标是 `DigitalOcean`，不要以 `Vercel Cron` 作为默认方案
- **验收：**
  - 至少确定一种与当前部署模型兼容的 durable runner 方案
  - 对应 runbook 补全

---

## Phase 2 · 产品深度与基础设施补齐

### R2-1 Front Office intake 深化，而不是重做
- [ ] **基于现有实现继续：**
  - 更深的 OCR / transcript ingestion
  - provider-backed 适配层预留
  - review-first 不变
- **当前真实状态：**
  - 本地 `local_tesseract` OCR beta 已 live
  - server ingest route 已 live
- **不要做：**
  - 不要把 current beta 当成零实现
  - 不要自动建档
  - 不要假装已有 WeChat 官方集成

### R2-2 Front Office cleanup / calendar / external writeback 深化
- [ ] **方向：**
  - 增强 office-wide cleanup depth
  - 增强 appointment external writeback coherence
  - 继续让 FO workbench 重入更准确
- **不要做：**
  - 不要先上隐藏自动化
  - 不要把简单状态切换直接变成后台交易自动创建

### R2-3 Generic eSignature create flow
- [ ] **文件方向：** 在现有 `transaction-first` 模型上外扩
- **当前真实状态：**
  - 平台级 eSignature MVP 已 live
  - 缺的是 truly generic non-transaction authoring
- **目标：**
  - 允许不依赖 transaction detail 的通用签署创建入口
  - 保持现有 request center、模板库、public signing page 兼容

### R2-4 文档存储与签署异步化
- [ ] **方向：**
  - 从本地文件系统 MVP 走向 object storage
  - 邮件发送、PDF finalize、Drive sync 逐步脱离 request-time
- **说明：**
  - 这是对现有可用工作流的基础设施升级
  - 不是重新设计文档中心

### R2-5 会计 / 佣金深度补齐
- [ ] **方向：**
  - 多 agent split edge cases
  - clawback / reversal accounting
  - deeper reconciliation
  - 1099 / referral 分类补强
- **说明：**
  - 当前已有 live foundation，重点是补复杂场景和测试深度

### R2-6 `@acre/backoffice` 逐步收缩，而不是先宣告删除
- [ ] **当前真实状态：**
  - 仍有少量 import 存在，例如 `/api/health` 和 dashboard 静态资源
- **目标：**
  - 只在真实引用消失后再收缩 package
  - 不为了“删除而删除”打断当前稳定面

---

## Phase 3 · 测试、可观测性、运维成熟度

### R3-1 面向风险面的测试增长
- [ ] **重点领域：**
  - `packages/db` 的 accounting / signatures / FO workbench service
  - `apps/web/app/api` 的高风险写路由
- **原则：**
  - 每个真实 bug fix 必须附带回归测试
  - 覆盖率目标可追，但不要写脱离现实的空指标

### R3-2 关键链路 E2E
- [ ] **建议优先：**
  - FO intake / duplicate review / handoff / BO create
  - signature request / public sign / archive / completion notification

### R3-3 TypeScript 进一步收紧
- [ ] **当前真实状态：**
  - `strict: true` 已开启
- **下一步：**
  - 评估 `noUncheckedIndexedAccess`
  - 在公共模块先落地，不做一次性全仓硬切

### R3-4 JSON logging + APM
- [ ] **方向：**
  - 结构化运行日志用于运维监控
  - `AuditLog` 继续保留给业务取证
  - APM 先覆盖未捕获异常和关键 API

### R3-5 Runbook 与 secrets 管理
- [ ] **新增目录：** `docs/runbook/`
- **建议文件：**
  - `deploy.md`
  - `secrets.md`
  - `incident.md`

### R3-6 Feature flags 只在 rollout 复杂度真实存在时引入
- [ ] **说明：**
  - 不反对 feature flags
  - 但不要先造一个 DB-driven flag 平台再去找场景
- **优先候选：**
  - provider-backed intake
  - generic eSignature flow
  - async reminder delivery

---

## 4. 明确不按原稿执行的事项

以下事项不应继续按外部 reviewer 原稿原样推进：

1. 不使用 `pnpm turbo run lint typecheck test` 作为仓库基线命令。
2. 不把 `.env.local` 直接描述为“已被仓库签入”，除非有 Git 证据。
3. 不再把 `TypeScript strict` 当成尚未启动的工作项。
4. 不再把 `/api/health`、FO OCR assist、duplicate merge、平台级 eSignature center 当成“从零开始”的模块。
5. 不以 `Vercel` 为默认部署方案。
6. 不直接把“前台标记成交”设计成后台交易自动创建。
7. 不先宣告“彻底删除 `@acre/backoffice`”，而是按引用收缩。

---

## 5. 人工决策项

以下问题仍不应由 Codex 擅自决定：

1. 第三方签名 provider 是否接入，以及接谁。
2. 是否引入短信供应商，以及选型。
3. APM / 日志供应商选型。
4. clawback 的业务口径和时限。
5. object storage 供应商与成本模型。
6. worker / scheduler 的最终运行形态。

---

## 6. 变更日志

> 格式：
> `### YYYY-MM-DD · <Task ID> · <commit hash>`
> `<≤300 字摘要，包含：动机、关键变更、测试情况、遗留问题>`

### 2026-04-09 · roadmap-revision · b075494
本次修订去掉了与当前仓库基线冲突的执行假设，例如 `pnpm` 校验命令、把 `.env.local` 直接写成已签入、把 `strict` 和 `/api/health` 当成未实现项；同时保留了真正有价值的后续方向，例如 session hardening、统一输入校验、权限包装层、rate limit、handoff 原子性补强、generic eSignature flow、object storage、worker/runner 与可观测性建设。重点从“重做缺失模块”改成“围绕现有 live surface 做硬化与补深度”。

### 2026-04-09 · R0-1 · a19c17e
补上 session secret 弱值检测、主/次 key 轮换验签、生成脚本与回归测试；开发环境仍可启动，生产弱 secret / 缺 secret 会直接失败。验证：`auth-session` tests 通过。遗留：其他潜在 `ACRE_SESSION_SECRET` 使用点仍待统一审计。

### 2026-04-09 · R1-1 · 69156df
补了 FO->BO handoff 的并发 claim / commit regression tests，并在 transaction 已创建但 handoff commit 失败时返回 cleanup 结果，减少尾部挂起。验证：`front-office-contracts.test.ts` 通过，`@acre/db` / `@acre/web` typecheck 通过。

### 2026-04-09 · R1-3 · 538d23d
`/api/health` 从静态回显升级为 app + database 双层健康检查，DB 不可用时会返回 `degraded` + `503`，且不暴露内部细节。验证：`health.test.ts` 通过，route load 与相关 typecheck 通过。

### 2026-04-10 · R0-2-slice · a8dc78e
先把 `/api/office/transactions` 的 query/body 收口到统一 `validate` helper，补了 create/list 失败路径测试，错误语义改成一致的 400 且不再泄露内部字段细节。验证：`route.test.ts` 通过，`@acre/web` typecheck 通过。

### 2026-04-10 · R0-3-slice · aeca10d
新增 `with-permission` helper，并接入 `email-delivery`、`signature-drive`、`users` 三组 Office settings 路由，统一 401/403 响应模式而不改变原权限语义。验证：`with-permission.test.ts` 通过，`@acre/web` typecheck 通过。

### 2026-04-10 · R0-4-slice · 07d40fc
登录与 `FO intake-assist` 已接入 same-origin CSRF 校验和内存型 rate limit，并补了 route tests；为恢复 worktree 污染还额外做了分支级恢复与重新验证。验证：登录/ intake tests、仓库 `typecheck/lint/build` 全通过。遗留：Office 写接口与签署发送入口仍待继续纳入。

### 2026-04-10 · R0-5-slice · 1788e7f
收拢 `signature-email` 的 provider-specific sender / reply-to 解析逻辑，把默认回复地址兜底放回邮件 helper，减少路由层散落条件分支。验证：`signature-email.test.ts` 通过，`@acre/web` typecheck 通过。遗留：Resend / SMTP 优先级文档仍待补齐。

### 2026-04-11 · R0-signature-send-slice · pending
`office signature send/resend` PATCH 路由已接入 `validate`、`withPermission`、same-origin CSRF 和发送级 rate limit，并补了 route regression tests；目标是先把高价值外发入口从“手写校验 + 裸写操作”推进到统一防护链。验证：签名路由 tests、`@acre/web` typecheck 通过。

### 2026-04-17 · R0-4-proxy-slice · pending
新增 `apps/web/proxy.ts`，把 `/api/*` 的非 `GET/HEAD/OPTIONS` 请求统一纳入 same-origin CSRF 校验，同时仅对白名单中的 extension-token 写入口放行；同步补了 `proxy.test.ts`，并把测试接入 `test:backoffice-hardening`。验证：proxy tests、仓库 `typecheck/lint/build` 通过。遗留：仍需把共享限流和 route-level guard 继续收敛。

### 2026-04-17 · R0-4-rate-limit-slice · pending
`apps/web/lib/rate-limit.ts` 已升级为 `memory/upstash` 双后端，并新增 `rate-limit.test.ts`；`auth/change-password`、`auth/invitations/accept`、`public/signatures/[token]/submit`、`listing-studio/imports` 现已接入统一限流，同时保留现有 login / intake / signature-send 的防护链。验证：rate-limit tests、仓库 `typecheck/lint/build` 通过。遗留：仍需把更多 Office 写接口逐步纳入统一策略，并在生产真正切到共享后端。
