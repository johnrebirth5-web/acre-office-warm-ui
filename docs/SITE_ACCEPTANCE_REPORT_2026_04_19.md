# Acre 系统整体验收报告 — 2026-04-19

> 这是一份"全站验收"快照，覆盖代码质量、性能 & 可扩展性、功能路径、近期改动回归风险四个维度。
> **生产环境可用性检查未能完成** —— 我的沙箱被网络策略拦截，无法 WebFetch `acresystem.us`。这部分需要你在本地补齐，见第 5 节。
>
> 结论：**整体系统可交付、无 P0 阻断**，但有 3 条 **HIGH** 级别的安全/运维风险需要在下一个短迭代内解决，另外若干 **MEDIUM** 是技术债而非故障。

---

## 0. 速览

| 维度 | 分数 | 一句话 |
| --- | --- | --- |
| 架构清晰度 | 良 | Next.js 16 + React 19 + Prisma + Postgres，分层合理，171 API 路由 + 74 页面 + 149 个测试文件。 |
| 安全 | 中上 | 主通路（auth / CSRF / rate limit / 输入校验）都有，但 3 处需要收口（见第 2 节）。 |
| 性能 | 良 | Phase 0 / 1.1 / 1.2 刚落地，基础设施到位；有 2 处 N+1 的苗头但不阻塞。 |
| 功能完整度 | 良（有例外） | 核心业务（交易、佣金、签字、邮箱、图库、看板）都通。明确缺：**密码重置、MFA、线上支付执行**。 |
| 测试覆盖 | 良 | 149 个 `.test.ts`，涵盖 auth / accounting / settings / mail / signatures 大部分热点路径。 |
| 观测性 | 良 | Phase 0 刚完工，health / metrics / Sentry / slow_query 都就位。待首次生产落地。 |

**仓库体量：** 233,664 行 TS/TSX；104 个 Prisma model / 77 个 enum；3,452 行 `schema.prisma`。近 30 天共 738 个 commit（活跃度极高）。

---

## 1. 系统总览

### 1.1 入口 & 部署
- **主站** `acresystem.us`（单机 DigitalOcean Droplet `45.55.247.137`）→ `acre-ui-rebuild-web.service` systemd unit
- **部署链路**：`npm run deploy:digitalocean -- <commit>` → SSH 到 droplet → 临时 clone → `npm ci` → `db:generate` → `prisma migrate deploy` → `next build` → rsync 到 `/opt/acre-ui-rebuild/app` → 重启 service → 校验 `/login`
- **包管理**：npm（不是 pnpm，尽管仓库根有 `pnpm-workspace.yaml` 残留）；workspaces `apps/*`, `packages/*`
- **关键技术栈**：Next 16.1.6、React 19.2.0、Prisma、PostgreSQL、Sentry 10、Zod 4、nodemailer、@react-pdf/renderer、pdfjs-dist、tesseract.js（OCR）

### 1.2 顶层路由地图
- `apps/web/app/` 主 Next.js 应用
  - `/login`, `/change-password`, `/invite/[token]`, `/sign/[token]`（外部签名）, `/share/*`（公开分享）
  - `/office/*` 内部后台（dashboard、transactions、accounting、mail、signatures、settings、contacts、tasks、listings、reports）
  - `/agent/*` 经纪人前端（dashboard、calendar、clients、listings、notifications）
  - `/listing-studio/listings/[packId]` 图库编辑器（Phase 0.5 改动集中地）
  - `/api/*` 171 个 API 路由，按业务分组
- `packages/db` Prisma 客户端 + 所有 DB 辅助函数
- `packages/auth` 会话 & 权限门
- `packages/ui`, `packages/backoffice` 组件 & 业务片段

---

## 2. 安全审计

### 2.1 Auth & Session
- 会话 cookie：`httpOnly`、`Secure`（生产）、`SameSite=Lax`，有效期 30 天（`apps/web/lib/auth-session-config.ts:2`）
- 强制改密 flow 正常（`mustChangePassword` → redirect）
- Invitation accept 有速率限制（15 分钟 10 次）、登录有速率限制（15 分钟 10 次）
- 支持 **secondary session secret**（`ACRE_SESSION_SECRET_SECONDARY`）做 key rotation，`scripts/rotate-session-secret.sh` 有配套 runbook

### 2.2 发现 — 按优先级

#### HIGH-1 · 改密后旧会话未失效
- **文件**：`apps/web/app/api/auth/change-password/route.ts`（全文已 grep，无 `destroySession/setSessionCookie/rotateSession` 调用）
- **风险**：攻击者拿到被盗 cookie 后，受害人即便改密也无法踢掉攻击者会话
- **建议修法**：`changeInternalPassword` 成功后，调用 `setSessionCookie(request, { ... })` 生成新 session token 并设到 response cookie（同时写 session 记录，老 session 标记 `revokedAt = now()`）

#### HIGH-2 · Rate limit 默认是进程内 Map
- **文件**：`apps/web/lib/rate-limit.ts:45`（`const rateLimitStore = new Map`）
- **实现是对的**：支持 Upstash backend，开关是 `ACRE_RATE_LIMIT_BACKEND=upstash`
- **风险**：**当前生产是不是开着 Upstash？** 如果不开（或 env 没设），多实例部署时速率限制只在单实例里有效，重启会清零。生产目前是单 droplet 单实例——可接受，但**一旦水平扩容就是个静默漏洞**
- **建议**：
  1. 去 droplet 上 `grep ACRE_RATE_LIMIT_BACKEND /etc/acre/acre-ui-rebuild.env`，确认是否设为 `upstash`
  2. 如果没有，在 Phase 1 做水平扩容之前补上 Upstash 或等价的中心化 store

#### HIGH-3 · 文件上传缺失大小限制
- **文件**：
  - `apps/web/app/api/listing-studio/listings/[packId]/assets/route.ts:38-51` — MIME 做了 `image/*` / `video/*` 白名单，但**没有 size 限制**。并且 `file.type && !...startsWith(...)` 的写法存在短路 bug —— 如果 `file.type` 为空串（某些浏览器上传裸 buffer 就是），会直接通过 MIME 校验
  - `apps/web/app/api/office/transactions/[transactionId]/documents/route.ts:48`（`saveStoredFile` 调用链）— 没见到 size 检查
  - `apps/web/app/api/office/mail/_helpers.ts` — mail 附件流：没看到 MIME / size 检查
- **风险**：单次请求上传 1GB 文件会直接占满 droplet 磁盘和进程内存（因为 `await file.arrayBuffer()` 一次性读入内存）
- **建议**：
  1. 在 `next.config.ts` 里设 `api.bodyParser = { sizeLimit: '25mb' }`（Next.js App Router 用 `export const maxDuration` + 检查 `request.headers.get('content-length')`）
  2. 在每个 upload route 顶部加 `const MAX_BYTES = 25 * 1024 * 1024; if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });`
  3. 修正 listing-studio route 的 MIME 短路 bug：改成 `if (!file.type || (!file.type.startsWith("image/") && !file.type.startsWith("video/")))`

#### MEDIUM-1 · Sentry 未做 PII 脱敏
- **文件**：`apps/web/sentry.shared.ts`
- 当前 `getSentryInitOptions()` 只设了 `dsn / tracesSampleRate / environment`，**没有 `beforeSend` / `sendDefaultPii: false`**
- **风险**：异常上报时请求 header（`cookie`、`authorization`）和 body 会原样发到 Sentry 云端。如果某条路由把邮箱 / 姓名 / 地址贴进 body，那些数据会进第三方
- **建议**：在 `getSentryInitOptions()` 的返回值里加
  ```ts
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.cookies) event.request.cookies = undefined;
    if (event.request?.headers) {
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
      delete event.request.headers["x-metrics-token"];
    }
    return event;
  }
  ```

#### MEDIUM-2 · `.env.local` 含生产密钥驻留在开发机
- **验证结果**：`.env.local` **没有被 git tracked**（`.gitignore` 正确排除了它），**不存在上报"commit 泄露"的问题**
- 但是你本机 `/Users/openclaw_john/.../Acre_latest_clean/.env.local` 里确实有真 `DATABASE_URL` / `ACRE_RESEND_API_KEY` / `ACRE_SESSION_SECRET` / SSH target。这是**本机数据安全**问题不是仓库问题
- **建议**：
  1. 考虑把 `.env.local` 里只留 dev 值，prod 值走 1Password / 密码管理器临时拷贝，用完即删
  2. 开启 FileVault 全盘加密（若未开）
  3. 定期轮换：`ACRE_SESSION_SECRET` 已有 rotation runbook，Resend API key 建议每季度轮换一次

#### LOW · `SameSite=Lax` 而非 `Strict`
- `Lax` 是合理默认，真要收紧成 `Strict` 会牺牲"从邮件点链接登录"这类 UX。当前不改也行。

### 2.3 通过项（显式确认无问题）
- ✅ 没有 `eval` / `new Function` / `$queryRawUnsafe` 散布
- ✅ 文件路径用 `sanitizeSegment()` 过滤 `..`，路径穿越风险低（`apps/web/lib/document-storage.ts:226`）
- ✅ Prisma query log 在生产下 redact 掉 params（仅开发日志含 params）
- ✅ SESSION_SECRET 有 weakness detection（长度 < 32 / 熵过低 / placeholder 词 → 生产启动时直接 throw）
- ✅ 有 `.gitleaks.toml` + `scripts/run-gitleaks.sh` 扫仓库密钥

---

## 3. 性能 & 可扩展性

### 3.1 近期改动已经动过的杠杆
- `8c45609` Phase 0 观测仪表 —— `/api/health` 返回 db.pool_max / heap 等，`/api/metrics` 给 Prometheus scrape
- `4c84aff` Phase 1.1 Prisma 连接池调优 —— 支持 `PRISMA_CONNECTION_LIMIT` / `PRISMA_POOL_TIMEOUT` env
- `c744edf` Phase 1.2 Session 上下文 per-request memo —— 用 React `cache()`，单次请求内多次 `getRequestSessionContext` 不再重复查 DB
- `8c51304` Phase 0.5 图片长缓存 —— 登录态 7 天 + `immutable`，公开分享 1 天 + `stale-while-revalidate`
- `a49511c` Phase 0.5 图片预加载 —— next/prev 提前请求
- `fa5dd65` Phase 0.5 `<img decoding="async" fetchPriority="high">`

### 3.2 已知待修（按优先级）

#### MEDIUM-3 · `getMembershipEffectivePermissions` 并发批量有 N+1 面
- **文件**：`packages/db/src/settings.ts:2148-2158`
- 对每个 accessibleOffice 发一次 `Promise.all(map(async ...))` —— 实际上每个 callback 都是独立查询
- 10 个 office 的 admin 一次请求 10 个 roundtrip。现在用户量小没事，用户规模上去后放大
- **建议**：合并成单条 `findMany({ where: { officeId: { in: ... } } })`

#### MEDIUM-4 · `roster-profile` 按 goal 拆查询
- **文件**：`packages/db/src/agents/roster-profile.ts:845-866`
- 每个 goal 单独跑 `prisma.transaction.findMany()`。一个 agent 12 个 goal → 12 个查询
- **建议**：一次范围查所有 transaction 然后 in-memory group by goal

#### MEDIUM-5 · Listing Studio 图片没有缩略图变体
- 原图 2MB+ 的 JPEG，thumbnail row 用同一 URL 显示成 120px
- 15 张缩略图 + 1 张大图 = ~30MB 首屏传输（已经靠浏览器缓存 + Phase 0.5 预加载缓解了点）
- **真正的解法**在 Phase 1.5：上传时用 sharp 生成 256px/1024px 变体，DB 里多几个 `storageKey` 字段，route.ts 按 `?variant=thumb` 挑
- 当前状态：**可用，不急**。但 CDN egress 费用会随用户增长同步涨

#### LOW · 高流量读接口少数缺 `Cache-Control`
- `/api/office/transactions` list、`/api/office/dashboard` 都没标 cache-control
- 理论上可以 `private, max-age=60` 加个短缓存，但也要看业务对新鲜度的容忍度

### 3.3 明确没问题
- ✅ 没有 `readFileSync` / `execSync` 在热路径上
- ✅ `@react-pdf/renderer` / `pdfjs-dist` / `tesseract.js` 全部在 server 端或通过 dynamic import 按需加载，不进客户端首屏 bundle
- ✅ `instrumentation.ts` 只做异步 Sentry 初始化，无阻塞
- ✅ `packages/db/src/client.ts` 用 singleton，连接懒加载
- ✅ 最大的 client 组件 `workspace-nav.tsx` 811 行，没看到单文件 > 1500 行的怪物（`listing-studio-detail-client.tsx` 2557 行是例外，下迭代拆）

---

## 4. 核心功能路径走查

| 功能域 | 状态 | 关键路径 | 备注 |
| --- | --- | --- | --- |
| 登录 / 登出 | ✅ 完整 | `/login` → `/api/auth/login` | 速率限制 + CSRF |
| 改密 | ⚠️ 改密成功但老会话不失效 | `/change-password` → `/api/auth/change-password` | 见 HIGH-1 |
| 邀请接受 | ✅ 完整 | `/invite/[token]` → `/api/auth/invitations/accept` | |
| **密码重置 / MFA** | ❌ 未实现 | — | 仓库内无"忘记密码"入口；无 TOTP / 短信 |
| 后台首页 | ✅ 完整 | `/office` → `/office/dashboard` | 12 个月图 + 佣金 KPI + 目标环 |
| 交易 CRUD | ✅ 完整 | `/office/transactions/[id]` + 11 个子资源 | offers / tasks / signatures / forms / documents / contacts / incoming-updates / intake / commissions 全通 |
| 图库 (Listing Studio) | ✅ 完整 | 上传 → 存储 → 浏览 → PDF → 分享 | Phase 0.5 刚做完性能优化 |
| 佣金 / 账单 / 对账单 | ⚠️ 部分 | `/office/accounting/*` | 计算、统计、PDF 渲染都有；**线上支付执行未接**（UI 里明说 "Live checkout and ACH execution are not implemented"） |
| 内部邮件 | ✅ 完整 | `/office/mail` → 线程 / 消息 / 附件 | 纯内部，不走 SMTP/IMAP |
| 电子签字 | ✅ 完整 | `/sign/[token]` 公开签字 + `/office/signatures` 后台管理 | 自研（不是 DocuSign 集成）；submit 有速率限制 |
| Agent 端 | ✅ 完整 | `/agent/dashboard` + 子页面 | |
| 公开分享链接 | ✅ 完整 | `/share/listings/[code]`, `/share/packs/[code]` | 靠 code/token 做认证，**注意 token 熵**（见下） |
| Observability | ✅ Phase 0 完成 | `/api/health`, `/api/metrics` | 未部署到生产，runbook 已备 |
| Training 页面 | ⚠️ 空壳 | `/office/training` → redirect 到 resources | 意料之中的占位 |

### 4.1 功能层有限但值得记录的发现
- **分享 token 的熵**：`/share/listings/[code]`、`/sign/[token]`、`/share/packs/[code]` 都用 URL 里的 code/token 做认证。**我没进一步验证 token 生成逻辑是不是 cryptographically random**，这是下次专题审计的候选
- **`/api/public/signatures/[token]/submit`** 有速率限制（10 分钟 15 次 / token），对枚举攻击有基本防御
- **无 TODO/FIXME 散布**：全仓库 grep 不到 TODO/FIXME/XXX 标记（规范整洁度高）

---

## 5. 生产环境可用性 — ⚠️ 未能从沙箱验证

我的沙箱被 egress proxy 拦截，无法直接访问 `https://acresystem.us`。下面 4 个命令请你在 **Mac 本地**跑，把输出回贴：

```bash
# 5.1 健康检查（当前 Phase 0 未部署，应当还是老版本响应体 —— 只有 status/service 没有 db/process 字段）
curl -s https://acresystem.us/api/health | jq .

# 5.2 登录页存在
curl -s -o /dev/null -w 'login page: %{http_code}\n' https://acresystem.us/login

# 5.3 metrics 应当 404（还没部署 Phase 0）
curl -s -o /dev/null -w 'metrics route: %{http_code}\n' https://acresystem.us/api/metrics

# 5.4 SSL 证书有效期
echo | openssl s_client -servername acresystem.us -connect acresystem.us:443 2>/dev/null | openssl x509 -noout -dates
```

**预期基线**（Phase 0 部署前）：
- `/api/health` 返回 `{ "status": "ok", "service": "acre-agent-os" }` （老版，无 db / process / health_status 字段）
- `/login` 返回 `200`
- `/api/metrics` 返回 `404`
- SSL 证书 notAfter 还有至少 30 天以上

部署 Phase 0 之后的预期见 `docs/RUNBOOK_DEPLOY_PHASE_0_AND_0_5.md` 步骤 5。

---

## 6. 回归风险矩阵（基于近 10 个 commit）

| commit | 风险 | 最需关注的场景 |
| --- | --- | --- |
| `4c84aff` Prisma 连接池 env | LOW | 不设 env 则行为不变，安全 |
| `c744edf` session memo | MEDIUM | 单次请求中途若修改 session，老缓存会命中。当前没发现这种路径，但测试覆盖不足 |
| `024fc99` 部署 runbook 文档 | NONE | 纯文档 |
| `8c51304` 图片缓存 1 周 + immutable | MEDIUM | **前提是 assetId 不可变**。已 grep 过 `storageKey` 没有 update/upsert，该假设成立 |
| `fa5dd65` img 解码提示 | NONE | HTML 属性提示 |
| `a49511c` 图片预加载 | LOW | `preloadedAssetIds` Set 不会无界增长（受 listing 内图片数约束） |
| `a0d79bc` 观测路由测试 | LOW | 测试 + 文档 |
| **`8c45609` Phase 0 观测** | **HIGH** | **`/api/health` 现在会在 degraded 时返回 503**。DigitalOcean Droplet 的外部 LB/监控如果不理解 503 含义，会错误地把实例标成"挂了"触发告警或移除。**部署前要先确认 acresystem.us 前面有没有挂 CDN/LB，以及它的 health check 策略** |
| `3274acb` 分支保护文档 | NONE | 纯文档 |
| `1538405` 密钥轮换文档 | NONE | 纯文档 |

### Phase 0 部署前的必做核对
1. **LB 健康检查兼容性**：如果 droplet 前面是 nginx/Cloudflare/DO Load Balancer，确认它对 `/api/health` 返回 503 的反应（能否只在连续 N 次失败才下线？）。如果是裸 droplet 直接 A 记录解析，这条没问题
2. **`ACRE_METRICS_TOKEN` 已生成**（见 runbook 步骤 3）
3. **`SENTRY_DSN` 已申请**（见 runbook 步骤 2）

---

## 7. TODO 清单（按优先级）

### P0 — 本周内
- [ ] **部署 Phase 0 + 0.5 到生产**（按 `docs/RUNBOOK_DEPLOY_PHASE_0_AND_0_5.md` 执行；你要手动做的 4 步）
- [ ] **验证 `ACRE_RATE_LIMIT_BACKEND=upstash`** 在生产 env 里是否设置 —— 如果没设，加上
- [ ] **跑 `verify-branch-protection.sh`** 确认 main 分支保护规则没漂移；打开 "Do not allow bypassing the above settings"

### P1 — 2 周内
- [ ] **改密后 session 轮换**：改 `apps/web/app/api/auth/change-password/route.ts`，成功后重新生成并设置 session cookie，老 session 记录标记失效
- [ ] **文件上传加 size 限制**：至少给 listing-studio assets / transaction documents / mail attachments 三处加 25MB 上限
- [ ] **修正 listing-studio 上传的 MIME 短路 bug**（空 `file.type` 会绕过白名单）
- [ ] **Sentry `beforeSend` 脱敏**：删 cookie / authorization / x-metrics-token 头

### P2 — 1 个月内
- [ ] **Phase 1.1 落地**：基于生产 `/api/health` 给出的 `db.pool_max` + `journalctl` slow_query 数据调 `PRISMA_CONNECTION_LIMIT` 合理值
- [ ] **合并 `getMembershipEffectivePermissions` 的 Promise.all(map)**（N+1 消除）
- [ ] **合并 `roster-profile` 按 goal 的查询**（同上）
- [ ] **密码重置流程**（产品决策 —— 要不要做 magic link / 邮件重置链接）

### P3 — 规划期
- [ ] **Phase 1.5 图片缩略图管线**（sharp 生成 256/1024 变体，DB 多字段，route 按 `?variant=` 挑）
- [ ] **`listing-studio-detail-client.tsx` 2557 行拆分**（下一个触及 Listing Studio 的改动里顺手做）
- [ ] **MFA / 2FA**（产品决策 —— 是否在内部系统里强制）
- [ ] **线上支付执行**（ACH / Stripe 接入 —— 产品决策）
- [ ] **分享 token 熵审计**（专题：验证 `/share/*` 和 `/sign/[token]` 的 token 是否 cryptographically random）

---

## 8. 不验收通过的场景

如果下列任何一项成立，**暂缓 Phase 0 部署**：

1. `acresystem.us` 前面有 CDN/LB 且它的 health check 策略未审核
2. 生产 env 里 `ACRE_RATE_LIMIT_BACKEND` 不是 `upstash` 且你计划近期水平扩容
3. `verify-branch-protection.sh` 输出有任何 `[FAIL]` 行

其他 HIGH/MEDIUM 发现不会阻断 Phase 0，但列入上方 P1 队列处理。

---

## 9. 附：本次验收的方法 & 已知局限

- 验收方法：4 个并行 Explore 子 agent（安全 / 性能 / 功能 / 回归）各自扫描相关代码路径，外加我本轮的交叉复核（特别是安全部分）
- **已被证伪的 agent 报告**：
  - ❌ "CRITICAL: `.env.local` 有密钥提交到仓库" —— 实际 `.env.local` 被 `.gitignore` 正确排除，**没有进仓库**。只是你本机开发副本里有。降级为 MEDIUM-2（本机数据安全）
  - ❌ "CRITICAL: 文件上传完全无 MIME/size 校验" —— listing-studio 做了 MIME 白名单但有短路 bug，不是完全没做。降级为 HIGH-3
  - ❌ "图片预加载会内存泄漏" —— preloadedAssetIds Set 是 listing 局部，实际规模有限
- **未覆盖的维度**：
  - 生产环境可用性检查（egress proxy 拦截）
  - 分享 token 熵审计
  - 数据库层 `pg_stat_statements` 实际慢查询（要 Phase 0 落地后才有数据）
  - 前端性能指标（LCP / FID / CLS —— 需浏览器真机测量）

