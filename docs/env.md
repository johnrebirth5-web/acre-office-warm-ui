# Environment Variables

## 概览

当前项目实际用到的环境变量非常少。

真实代码状态：

- 当前数据库相关代码使用 `DATABASE_URL`
- 当前主页面和大多数 API 仍不依赖数据库，因此在“只跑前端和 mock API”时，即使没有真实数据库，也能运行
- 但 `Office Pipeline workspace`、`Office Transactions`、`Office Contacts`、`Office Tasks`、`Office Accounting`、transaction finance、密码登录 / 邀请接受 / 用户管理、`/office/activity` 和数据库 probe 已经依赖 `DATABASE_URL`
- transaction detail 下的 checklist/tasks 也已经依赖 `DATABASE_URL`
- `Office Reports` 的 CSV 导出 route 也依赖 `DATABASE_URL`
- `/office/signatures` 中心和模板库也依赖 `DATABASE_URL`
- `/api/office/activity/comments` 也依赖 `DATABASE_URL`
- transaction detail 下的 documents / forms / signatures / incoming updates 也已经依赖 `DATABASE_URL`
- transaction detail 下的外部签署邮件发送额外依赖系统内 `Settings > Email delivery` 发件配置；当 `ACRE_RESEND_API_KEY` 存在时优先走 Resend HTTPS API，否则继续走 SMTP / signature mailer fallback
- `Settings > Signature Drive` 保存的 Google Drive service account 私钥也会使用系统设置加密 secret 做加密 / 解密；当前没有单独的 `GOOGLE_*` env 变量要求
- `Settings > QuickBooks` 的 OAuth token 也会使用系统设置加密 secret 做加密 / 解密；QuickBooks client id / secret 仍来自环境变量，可使用 `QUICKBOOKS_*` 或 `ACRE_QUICKBOOKS_*`
- `Office Accounting` 的 `Post to QuickBooks` payout statement 动作额外依赖 QuickBooks Online OAuth 和账户映射环境变量；缺失时不会创建本地“已同步”状态
- 一旦执行 Prisma 相关命令，或访问这些数据库路径，`DATABASE_URL` 就变成必需项
- 当前本地 auth/session 可以使用默认开发 secret，但建议显式配置 `ACRE_SESSION_SECRET`

未来随着 auth、storage、AI、第三方集成接入，这个文件需要同步扩展。

另外，`Listing Studio` 的 Chrome Web Store 安装入口现在支持前端公开链接配置：

- `NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL`

`Listing Studio` 的 collections 地图与附近设施筛选现在还支持一个前端公开地图 key：

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

这个值只影响前端安装页与 dashboard 安装按钮，不参与扩展鉴权或数据写入。

## 当前环境变量清单

### `DATABASE_URL`

用途：

- 提供 PostgreSQL 连接串
- 当前用于 Prisma schema 校验
- 当前用于 Prisma Client、migration、seed 和数据库 probe 读取
- 当前也用于 `TransactionContact` 关系迁移和回填
- 后续会用于更多页面和 API 的真实数据库读写

是否必填：

- 对 Prisma 命令是必填
- 对数据库 probe route 是必填
- 对只看 mock 页面本地运行是“可不填”
- 对 `/office/pipeline`、`/office/transactions`、`/office/contacts`、`/office/activity`、`/login`、`/invite/[token]`、`/change-password`、`/office/settings/users`、数据库 probe 是必填
- 对 `/office/tasks` 也是必填
- 对 `/office/accounting` 也是必填
- 对 `/office/signatures` 和 `/office/signatures/templates` 也是必填
- 对 transaction detail 下的 checklist/tasks 读写也是必填
- 对 `/api/office/reports/export` 也是必填
- 对 transaction detail 下的 finance 读写也是必填
- 对 `/api/office/activity/comments` 也是必填
- 对 `/api/office/accounting/transactions*` 和 `/api/office/accounting/earnest-money*` 也是必填
- 对 `/api/office/signatures/export`、`/api/office/signatures/templates`、`/api/office/signatures/:signatureRequestId/drive-sync` 和 `/api/office/settings/signature-drive` 也是必填
- 对 `/api/office/transactions/:transactionId/documents*` / `forms*` / `signatures*` / `incoming-updates*` 也是必填

示例格式：

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/acre"
```

Docker 本地开发补充：

- 当前仓库根目录的 `docker-compose.yml` 会把容器内 `DATABASE_URL` 覆盖为 `postgresql://postgres:postgres@db:5432/acre`
- 当前仓库默认把 Docker `db` 发布到宿主机 `127.0.0.1:5433`，避免和本机 Homebrew/Postgres 常见的 `5432` 冲突
- 这意味着宿主机 `.env.local` 应保持为 `127.0.0.1:5433`，而不是 `localhost:5432`
- 如果你要改 Docker 下的数据库连接串，可以设置 `ACRE_DOCKER_DATABASE_URL`

Prisma 连接池调优补充：

- 当前 `packages/db/src/client.ts` 会在运行时读取 `PRISMA_CONNECTION_LIMIT` 和 `PRISMA_POOL_TIMEOUT`
- 这两个值只会覆盖 Prisma datasource URL 的对应 query 参数；如果它们为空，当前行为完全回退到原始 `DATABASE_URL`
- `PRISMA_CONNECTION_LIMIT` 对应 Prisma PostgreSQL 连接池大小，要求是正整数
- `PRISMA_POOL_TIMEOUT` 对应连接等待超时，单位秒，允许 `0`
- 生产当前是单个 Node 进程、数据库 `max_connections=100`，可先从 `PRISMA_CONNECTION_LIMIT=15`、`PRISMA_POOL_TIMEOUT=10` 这种保守值起步，再结合 `/api/health` 和慢查询日志继续调
- 如果 `DATABASE_URL` 自己已经带了 `connection_limit` / `pool_timeout`，显式 env 会覆盖它们

缺失后的影响：

- `npm run db:validate` 会失败
- `npm run db:migrate` 会失败
- `npm run db:seed` 会失败
- `/api/db/seeded-context` 会失败
- `/office/pipeline` 会失败
- `/office/transactions` 会失败
- `/office/transactions` 的 URL 驱动分页查询（`q / status / page / pageSize`）会失败
- `/office/contacts` 会失败
- `/office/contacts` 的 URL 驱动分页查询（`q / stage / page / pageSize`）会失败
- `/office/activity` 会失败
- `/office/tasks` 会失败
- `/office/accounting` 会失败
- `/office/signatures` 会失败
- `/office/signatures/templates` 会失败
- `/login`、`/invite/[token]`、`/change-password` 和需要 session context 的 server-side 查询会失败
- `/office/settings/users` 以及其邀请 / 解锁写接口会失败
- transaction detail 下的 checklist/tasks route 会失败
- `/api/office/reports/export` 会失败
- `/api/office/activity/comments` 会失败
- `/api/office/accounting/transactions*` 会失败
- `/api/office/accounting/earnest-money*` 会失败
- `/api/office/signatures/export` 会失败
- `/api/office/signatures/templates` 会失败
- `/api/office/signatures/:signatureRequestId/drive-sync` 会失败
- `/api/office/settings/signature-drive` 会失败
- `/api/office/transactions/:transactionId/documents*` 会失败
- `/api/office/transactions/:transactionId/forms*` 会失败
- `/api/office/transactions/:transactionId/signatures*` 会失败
- `/api/office/transactions/:transactionId/incoming-updates*` 会失败
- 后续如果更多页面/API 接入 Prisma runtime，相关查询也会失败

开发和生产差异：

- 开发环境通常使用本地 PostgreSQL 或开发库
- 生产环境必须使用真实数据库，并确保网络和权限配置正确

### `PRISMA_CONNECTION_LIMIT`

用途：

- 显式设置 Prisma PostgreSQL 连接池大小
- 当前由 `packages/db/src/client.ts` 在运行时注入到 datasource URL 的 `connection_limit`

是否必填：

- 非必填
- 未设置时 Prisma 继续使用默认连接池推导逻辑

示例格式：

```env
PRISMA_CONNECTION_LIMIT="15"
```

使用建议：

- 生产当前是单 Node 进程、PostgreSQL `max_connections=100`
- 当前可先从 `15` 这种保守值起步，再观察 `/api/health` 的 `db.pool_in_use / db.pool_idle` 与慢查询日志
- 如果未来接入 PgBouncer、增加 Node 进程数，或数据库 `max_connections` 调整了，这个值也要一起复核

### `PRISMA_POOL_TIMEOUT`

用途：

- 设置 Prisma 等待空闲连接的超时时间
- 当前由 `packages/db/src/client.ts` 在运行时注入到 datasource URL 的 `pool_timeout`

是否必填：

- 非必填
- 未设置时 Prisma 继续使用默认超时行为

示例格式：

```env
PRISMA_POOL_TIMEOUT="10"
```

使用建议：

- 单位是秒
- `0` 表示不等待池超时保护，不建议在当前生产拓扑下默认使用
- 当前生产可先保持 `10` 秒，避免连接池排队时无限放大尾延迟

### `ACRE_SESSION_SECRET`

用途：

- 本地 auth/session 的 cookie 签名 secret
- 当前用于保护 `acre_local_session` 不被随意篡改
- 当前 password login、invite accept、forced change-password 成功后都依赖这套 signed cookie

是否必填：

- 本地开发不是强制必填，因为代码里有 development fallback
- 但建议配置，避免不同环境共享默认 secret
- 生产环境现在应视为必填；缺失时登录签名不会继续回退到仓库内默认值

示例格式：

```env
ACRE_SESSION_SECRET="replace-with-a-long-random-string"
```

缺失后的影响：

- 本地登录仍然可以工作
- 但会退回到仓库内的开发默认值，不适合长期共享环境
- 生产环境下如果缺失，session 创建会直接失败并暴露配置问题

开发和生产差异：

- 开发环境可用 fallback 启动
- 生产或共享环境应始终显式配置

轮换建议：

- 如果工作目录、截图、日志、备份或聊天内容暴露了当前值，应视为已泄露并立刻轮换
- 先确认生产环境是否已经显式配置 `ACRE_SETTINGS_ENCRYPTION_SECRET`
- 如果系统内 SMTP / Signature Drive / QuickBooks 设置仍在回退使用 `ACRE_SESSION_SECRET` 做加密，先补上独立的 `ACRE_SETTINGS_ENCRYPTION_SECRET`，或准备在轮换后重新保存这些设置
- 先生成新的强随机值作为 `ACRE_SESSION_SECRET`
- 把旧值临时放到 `ACRE_SESSION_SECRET_SECONDARY`
- 部署一版后，让现有 cookie 在主/次 key 双验签窗口内自然过渡
- 等当前 session 最大存活期过去后，再把 `ACRE_SESSION_SECRET_SECONDARY` 从环境源删除

### `ACRE_SESSION_SECRET_SECONDARY`

用途：

- 在 session secret 轮换窗口内继续验签旧 cookie
- 当前由 `apps/web/lib/auth-session.ts` 在 `decodeSession` 时与主 key 一起参与验签

是否必填：

- 非必填
- 仅在轮换 `ACRE_SESSION_SECRET` 时临时使用

示例格式：

```env
ACRE_SESSION_SECRET_SECONDARY="<previous-generated-session-secret>"
```

使用建议：

- 只在轮换窗口内保留
- 不要把它长期当作第二个常驻 secret
- 当前 cookie 最大存活期过去后，应尽快删除

### `ACRE_BASE_URL`

用途：

- 为一次性 provisioning / 邀请批量初始化脚本生成完整 invite URL
- 为 transaction document 外部签署邮件生成 public signing link 的绝对 base URL fallback
- 当前用于 `scripts/provision-backoffice-initial-accounts.ts`
- 当前也会在签署邮件 route 中作为 request origin 缺失时的回退值

是否必填：

- 非必填
- 缺失时默认使用 `https://acresystem.us`

示例格式：

```env
ACRE_BASE_URL="https://acresystem.us"
```

缺失后的影响：

- 脚本仍可运行
- 但 invite URL 会按默认生产域名拼接
- 外部签署邮件在缺少可信 request origin 的场景下，也会回退到默认生产域名拼接链接

### `ACRE_FINANCE_NOTIFICATION_EMAIL`

用途：

- 接收 Back Office operational email reminders，例如 agent 创建 transaction、transaction closed、payout statement 生成 / 发送 / agent 回复、以及 payout statement post 到 QuickBooks unpaid bill
- 当前由 `apps/web/lib/operational-email.ts` 读取

是否必填：

- 非必填
- 缺失时默认使用 `pay@acreny.us`

示例格式：

```env
ACRE_FINANCE_NOTIFICATION_EMAIL="pay@acreny.us"
```

缺失后的影响：

- 财务提醒仍会发送到默认邮箱 `pay@acreny.us`

### QuickBooks Online unpaid bill sync

用途：

- 支持 `/office/accounting` 中已由 agent 确认的 payout statement 通过 `Post to QuickBooks` 推送到 QuickBooks Online
- 当前只创建 QuickBooks unpaid bill / Accounts Payable
- 不自动付款，不触发 ACH / 银行出款；出纳菲菲仍在 QuickBooks 中人工检查并手动付款

三家公司映射变量：

```env
ACRE_QUICKBOOKS_CLIENT_ID="<intuit-oauth-client-id>"
ACRE_QUICKBOOKS_CLIENT_SECRET="<intuit-oauth-client-secret>"
ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON='{
  "acre-nj-llc": {
    "companyName": "ACRE NJ LLC",
    "realmId": "<quickbooks-company-realm-id>",
    "refreshToken": "<intuit-oauth-refresh-token-for-this-company>",
    "apAccountId": "<quickbooks-accounts-payable-account-id>",
    "agentCommissionExpenseAccountId": "<quickbooks-agent-commission-expense-account-id>"
  },
  "acre-ny-realty": {
    "companyName": "ACRE NY REALTY INC",
    "realmId": "<quickbooks-company-realm-id>",
    "refreshToken": "<intuit-oauth-refresh-token-for-this-company>",
    "apAccountId": "<quickbooks-accounts-payable-account-id>",
    "agentCommissionExpenseAccountId": "<quickbooks-agent-commission-expense-account-id>"
  },
  "acre-ny-rental": {
    "companyName": "Acre NY Rentals LLC",
    "realmId": "<quickbooks-company-realm-id>",
    "refreshToken": "<intuit-oauth-refresh-token-for-this-company>",
    "apAccountId": "<quickbooks-accounts-payable-account-id>",
    "agentCommissionExpenseAccountId": "<quickbooks-agent-commission-expense-account-id>"
  }
}'
```

可选变量：

```env
ACRE_QUICKBOOKS_REDIRECT_URI="https://acresystem.us/api/office/settings/quickbooks/callback"
ACRE_QUICKBOOKS_API_BASE_URL="https://quickbooks.api.intuit.com"
ACRE_QUICKBOOKS_MINOR_VERSION="75"
```

兼容单公司 / 本地测试变量：

```env
ACRE_QUICKBOOKS_REALM_ID="<quickbooks-company-realm-id>"
ACRE_QUICKBOOKS_REFRESH_TOKEN="<intuit-oauth-refresh-token>"
ACRE_QUICKBOOKS_AP_ACCOUNT_ID="<quickbooks-accounts-payable-account-id>"
ACRE_QUICKBOOKS_AGENT_COMMISSION_EXPENSE_ACCOUNT_ID="<quickbooks-agent-commission-expense-account-id>"
```

使用约束：

- 生产应配置 `ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON`，按 Acre office slug 分流：
  `acre-nj-llc -> ACRE NJ LLC`、`acre-ny-realty -> ACRE NY REALTY INC`、`acre-ny-rental -> Acre NY Rentals LLC`
- `Acre Media LLC` 是作废 QuickBooks company，不配置到 Acre 映射中
- 每个 agent profile 可以保存 `QuickBooks Vendor ID` 作为确定性映射；`Post to QuickBooks` 会先在 statement 所属 office 对应的 QuickBooks company 内校验该 Vendor ID 是否存在且 active。保存的 ID 为空或在当前 company 查不到时，系统会按 payout payee name、再按 agent display name 精确匹配一个 active Vendor，找不到时用同名创建新的 QuickBooks Vendor，并把匹配到或创建出的 ID 回写到 profile。出现重复 active Vendor 等歧义时仍会停止
- payout statement 必须由 agent 在 Acre 内确认后才会显示 / 允许 `Post to QuickBooks`
- 成功后 Acre 会记录 QuickBooks bill id / doc number，并创建本地 open `AccountingTransaction` bill 作为 AP 记录
- QuickBooks refresh token 当前来自服务端环境变量；如果 Intuit OAuth 返回/要求轮换 refresh token，需要按对应 company 更新环境值
- Docker 本地开发的 `web` 容器会从仓库根目录 `.env` / `.env.local` 透传 `QUICKBOOKS_*` 与 `ACRE_QUICKBOOKS_*` 变量；更新这些值后需要 recreate `web` 容器才能让 `Post to QuickBooks` 读到新的 office mapping

Intuit Developer 生产 app 信息：

- Host domain: `acresystem.us`
- Launch URL: `https://acresystem.us/office/settings/quickbooks`
- Connect / reconnect URL: `https://acresystem.us/api/office/settings/quickbooks/connect`
- OAuth redirect URI: `https://acresystem.us/api/office/settings/quickbooks/callback`
- Disconnect URL: `https://acresystem.us/api/office/settings/quickbooks/disconnect`
- Privacy policy URL: `https://acresystem.us/legal/privacy`
- Terms / EULA URL: `https://acresystem.us/legal/terms`
- `/office/settings/quickbooks` 管理 organization-level OAuth 连接状态和健康检查；payout bill posting 当前仍读取服务端 `ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON` 的 per-office company / account mapping。不要把 refresh token 复制进聊天、工单、PR 或代码仓库。

### `ACRE_METRICS_TOKEN`

用途：

- 保护 `/api/metrics` 的 header 鉴权 token
- 当前由 `apps/web/app/api/metrics/route.ts` 读取，并要求请求头 `X-Metrics-Token` 与之完全匹配

是否必填：

- 对普通页面和业务 API 不是必填
- 对要采集 `/api/metrics` 的环境是必填

示例格式：

```env
ACRE_METRICS_TOKEN="replace-with-a-long-random-token"
```

缺失后的影响：

- `/api/metrics` 会对所有请求返回 `401`
- `/api/health`、业务 API、登录和页面渲染不受影响

部署建议：

- 生产环境应把它放进 `/etc/acre/acre-ui-rebuild.env`
- 不要把真实 token 写进仓库内 `.env.example`

### `QUICKBOOKS_CLIENT_ID`

用途：

- 启用 `/office/settings/quickbooks` 的 QuickBooks Online OAuth 连接
- 当前由 `packages/db/src/quickbooks-settings.ts` 读取
- 与 `QUICKBOOKS_CLIENT_SECRET` 一起用于生成 Intuit OAuth authorize URL 和交换 token；如果未设置，也可使用 `ACRE_QUICKBOOKS_CLIENT_ID`

是否必填：

- 只有需要连接 QuickBooks Online 时必填
- 缺失时 QuickBooks 设置页仍可打开，但 Connect 按钮会被禁用

示例格式：

```env
QUICKBOOKS_CLIENT_ID="replace-with-intuit-app-client-id"
# or ACRE_QUICKBOOKS_CLIENT_ID="replace-with-intuit-app-client-id"
```

### `QUICKBOOKS_CLIENT_SECRET`

用途：

- QuickBooks Online OAuth confidential client secret
- 当前由 `packages/db/src/quickbooks-settings.ts` 读取；如果未设置，也可使用 `ACRE_QUICKBOOKS_CLIENT_SECRET`
- 只用于服务器端 token exchange / refresh，永远不回传到浏览器

是否必填：

- 只有需要连接 QuickBooks Online 时必填
- 必须和 `QUICKBOOKS_CLIENT_ID` 同时配置

示例格式：

```env
QUICKBOOKS_CLIENT_SECRET="replace-with-intuit-app-client-secret"
# or ACRE_QUICKBOOKS_CLIENT_SECRET="replace-with-intuit-app-client-secret"
```

### `QUICKBOOKS_ENVIRONMENT`

用途：

- 选择 QuickBooks Accounting API base URL
- `sandbox` 使用 Intuit sandbox API
- 其他值或缺失时使用 production API

是否必填：

- 非必填
- 本地或测试 QuickBooks app 建议显式设为 `sandbox`

示例格式：

```env
QUICKBOOKS_ENVIRONMENT="sandbox"
```

### `QUICKBOOKS_REDIRECT_URI`

用途：

- 覆盖 QuickBooks OAuth callback URL
- 当前默认会从 `ACRE_BASE_URL` 或请求 origin 生成：
  `https://<host>/api/office/settings/quickbooks/callback`
- 如果未设置 `QUICKBOOKS_REDIRECT_URI`，也可用 `ACRE_QUICKBOOKS_REDIRECT_URI`
- 如果 Intuit app 里登记的是固定 callback，生产建议显式配置，避免 proxy / host header 导致 callback 不一致

是否必填：

- 非必填
- QuickBooks app 里的 redirect URI 必须和实际发起 OAuth 时使用的值完全匹配

示例格式：

```env
QUICKBOOKS_REDIRECT_URI="https://acresystem.us/api/office/settings/quickbooks/callback"
```

QuickBooks production app URL checklist:

- End-user license agreement URL:
  `https://acresystem.us/legal/acre-back-office-eula`
- Privacy policy URL:
  `https://acresystem.us/legal/acre-back-office-privacy`
- Host domain: `acresystem.us`
- Launch URL:
  `https://acresystem.us/office/settings/quickbooks`
- Disconnect URL:
  `https://acresystem.us/quickbooks/disconnect`
- Connect/Reconnect URL:
  `https://acresystem.us/quickbooks/connect`
- Hosted country: `United States`
- Hosted IP address: `45.55.247.137` unless the production infrastructure changes

### `PRISMA_SLOW_QUERY_MS`

用途：

- 控制 Prisma 慢查询日志的 warn 阈值，默认 `500`
- 当前由 `packages/db/src/client.ts` 读取

是否必填：

- 非必填
- 缺失或非法值时回退到 `500`

示例格式：

```env
PRISMA_SLOW_QUERY_MS="500"
```

缺失后的影响：

- 不会阻塞 Prisma 或应用启动
- 仅会使用默认慢查询阈值

### `PRISMA_VERY_SLOW_QUERY_MS`

用途：

- 控制 Prisma 超慢查询日志的 error 阈值，默认 `2000`
- 当前由 `packages/db/src/client.ts` 读取

是否必填：

- 非必填
- 缺失或非法值时回退到 `2000`

示例格式：

```env
PRISMA_VERY_SLOW_QUERY_MS="2000"
```

缺失后的影响：

- 不会阻塞 Prisma 或应用启动
- 仅会使用默认超慢查询阈值

### `SENTRY_DSN`

用途：

- 启用 Sentry SDK，把 API guard 异常、Prisma 运行时错误、全局错误边界和 Next runtime 错误送到 Sentry
- 当前由 `apps/web/sentry.shared.ts` 统一读取

是否必填：

- 非必填
- 留空时 Sentry 保持静默关闭

示例格式：

```env
SENTRY_DSN="https://<key>@o0.ingest.sentry.io/<project>"
```

缺失后的影响：

- 构建仍可通过
- 应用仍可运行
- 只是不会向 Sentry 上报异常

### `SENTRY_TRACES_SAMPLE_RATE`

用途：

- 控制 Sentry tracing 采样率
- 当前默认值是 `0.1`

是否必填：

- 非必填
- 未设置时回退到 `0.1`

示例格式：

```env
SENTRY_TRACES_SAMPLE_RATE="0.1"
```

缺失后的影响：

- 不会阻塞构建或运行
- 仅会使用默认 tracing 采样率

### `SENTRY_AUTH_TOKEN`

用途：

- 给 `@sentry/nextjs` 的构建插件上传 source map 用
- 当前只在 `apps/web/next.config.ts` 的 `withSentryConfig(...)` 里读取

是否必填：

- 非必填
- 仅在你要上传 source map 到 Sentry 时需要

示例格式：

```env
SENTRY_AUTH_TOKEN="<sentry-auth-token>"
```

缺失后的影响：

- `npm run build` 仍会通过
- 只是会跳过 source map 上传
- 运行时异常采集仍主要由 `SENTRY_DSN` 决定

### `ACRE_RATE_LIMIT_BACKEND`

用途：

- 选择写接口 rate limit 的共享后端
- 当前支持：
  - `memory`：默认值，单进程内存窗口计数
  - `redis`：通过标准 Redis 连接串共享计数，适合单机多进程或自建/托管 Redis
  - `upstash`：通过 Upstash Redis REST API 共享计数，适合多实例/容器
- 当前由 `apps/web/lib/rate-limit.ts` 读取

是否必填：

- 非必填
- 缺失时默认使用 `memory`
- 生产如果要跨实例共享限流，应显式改成 `upstash`

示例格式：

```env
ACRE_RATE_LIMIT_BACKEND="memory"
```

使用建议：

- 本地开发和单实例测试环境继续用 `memory`
- 如果已经有可达的 Redis，可改用 `redis`
- 多实例或会横向扩容的环境应改用 `upstash`
- 当前 DigitalOcean 生产机如果要先避免进程重启清零，可使用 `ACRE_RATE_LIMIT_BACKEND="redis"` 并把 `ACRE_RATE_LIMIT_REDIS_URL` 指到现有 Redis，例如 `redis://127.0.0.1:6380/0`
- 如果显式设置为 `redis`，则必须同时提供 `ACRE_RATE_LIMIT_REDIS_URL`
- 如果显式设置为 `upstash`，则必须同时提供 `ACRE_UPSTASH_REDIS_REST_URL` 和 `ACRE_UPSTASH_REDIS_REST_TOKEN`

### `ACRE_RATE_LIMIT_FAIL_MODE`

Behavior when the configured rate limit backend (Redis or Upstash) throws.

- `open` (default): log the error, fall back to the in-process memory store,
  keep serving the request. Keeps auth endpoints available during Redis
  outages at the cost of one process rotation of counters.
- `closed`: propagate the error to the caller (usually becomes a 500). Use
  only if strict enforcement is more important than availability.

Public token-backed routes such as `/share/*`, `/sign/*`, public invite links,
and Listing Studio shared assets still force a memory fallback even when this
flag is `closed`, so public links do not white-screen during a shared rate-limit
backend outage.

### `ACRE_RATE_LIMIT_REDIS_URL`

用途：

- 标准 Redis 连接串
- 仅在 `ACRE_RATE_LIMIT_BACKEND="redis"` 时使用
- 当前支持 `redis://` 与 `rediss://`

是否必填：

- 仅在使用 `redis` 后端时必填

示例格式：

```env
ACRE_RATE_LIMIT_REDIS_URL="redis://127.0.0.1:6380/0"
```

使用建议：

- 单机生产如果已经有本地 Redis，可先用这个模式替代 `memory`
- 如果未来切到托管 Redis，也可以继续沿用这个变量，只需替换连接串
- 如果未来明确走 Upstash REST，则继续使用 `upstash` 后端，不需要这个变量

### `ACRE_UPSTASH_REDIS_REST_URL`

用途：

- Upstash Redis 的 REST API base URL
- 仅在 `ACRE_RATE_LIMIT_BACKEND="upstash"` 时使用

是否必填：

- 仅在使用 `upstash` 后端时必填

示例格式：

```env
ACRE_UPSTASH_REDIS_REST_URL="https://example.upstash.io"
```

### `ACRE_UPSTASH_REDIS_REST_TOKEN`

用途：

- Upstash Redis REST API bearer token
- 仅在 `ACRE_RATE_LIMIT_BACKEND="upstash"` 时使用

是否必填：

- 仅在使用 `upstash` 后端时必填

示例格式：

```env
ACRE_UPSTASH_REDIS_REST_TOKEN="replace-with-upstash-rest-token"
```

### `ACRE_TRUSTED_PROXY_TIER`

用途：

- 控制 rate limit client identifier 对代理头的优先级
- 为将来接入 Cloudflare 或标准反向代理时，显式声明“哪个 header 最可信”
- 当前由 `apps/web/lib/rate-limit.ts` 读取

可选值：

- `none`：默认值，沿用现有优先级 `x-forwarded-for -> x-real-ip -> cf-connecting-ip`
- `cloudflare`：优先使用 `cf-connecting-ip`
- `reverse-proxy`：优先使用 `x-real-ip`

是否必填：

- 非必填
- 缺失时默认使用 `none`

示例格式：

```env
ACRE_TRUSTED_PROXY_TIER="none"
```

使用建议：

- 还没有明确的可信上游代理时，保持 `none`
- 通过 Cloudflare 进入应用时，改成 `cloudflare`
- 通过 Nginx / Caddy 这类反向代理进入应用时，改成 `reverse-proxy`

### `NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL`

用途：

- 覆盖 `Listing Studio` 默认内置的公开 `Chrome Web Store` 链接
- 当前由 `/listing-studio/extension/install` 读取
- 当前也会影响 dashboard 中“未安装扩展”状态下的安装入口

是否必填：

- 不是必填
- 当前代码已经内置 `Acre Listing Studio` 的正式商店地址
- 只有当你需要切到别的商店条目、测试条目、或未来新 extension id 时，才需要显式配置覆盖

示例格式：

```env
NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL="https://chromewebstore.google.com/detail/acre-listing-studio/hijmimhfeckiiahbjmdjpepoaifekcbk"
```

缺失后的影响：

- 不会影响 `Listing Studio` 的一键安装入口
- 安装页和 dashboard 仍会默认打开正式 `Chrome Web Store` 条目
- 只有在你需要覆盖到别的商店链接时，缺失这个变量才意味着无法替换默认地址

### `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

用途：

- 为 `Listing Studio > Collections` 详情页启用真实 Google 地图与附近设施筛选
- 当前由 `/listing-studio/collections/[collectionId]` 的客户端地图组件读取；`/share/collections/[code]` 也会优先使用它，但缺失时会用公开瓦片地图降级显示房源点位
- 用于运行时加载 `Google Maps JavaScript API` 和 `Places` library

是否必填：

- 不是全站必填
- 但如果你希望在 collection detail 页面看到真实 Google 地图、listing 点位和 `Supermarket / Subway / Restaurant / Coffee / Nightlife / All` 附近设施筛选，就需要显式配置
- 如果不配置，collections 列表和 collection 内的 listing cards 仍然正常工作；public collection share 页面仍会用 saved coordinates 显示免 key 的地图预览

示例格式：

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIza..."
```

缺失后的影响：

- `/listing-studio/collections` 首页不受影响
- `/listing-studio/collections/[collectionId]` 仍会展示 collection 头部和 listing cards
- 但 collection detail 底部的 live map、编号 marker、POI pills 与 nearby places 查询不会启用

### `ACRE_SETTINGS_ENCRYPTION_SECRET`

用途：

- 为系统内保存的 SMTP 密码做加密 / 解密
- 为系统内保存的 `Signature Drive` service account 私钥做加密 / 解密
- 为系统内保存的 QuickBooks Online access token / refresh token 做加密 / 解密
- 当前由 `packages/db/src/smtp-settings.ts` 读取
- 当前也由 `packages/db/src/signature-drive-settings.ts` 读取
- 当前也由 `packages/db/src/quickbooks-settings.ts` 读取
- 当前会优先使用这个值；未设置时会回退到 `ACRE_SESSION_SECRET`

是否必填：

- 不是强制必填
- 如果没有配置它，但已经配置了 `ACRE_SESSION_SECRET`，系统内 SMTP 设置仍然可以工作
- 如果没有配置它，但已经配置了 `ACRE_SESSION_SECRET`，系统内 `Signature Drive` 设置仍然可以工作
- 如果两者都缺失，系统内保存的 SMTP 密码、Google Drive 私钥和 QuickBooks token 都无法写入或解密

示例格式：

```env
ACRE_SETTINGS_ENCRYPTION_SECRET="replace-with-a-long-random-string"
```

### `ACRE_RESEND_API_KEY`

用途：

- 为 transaction document 外部签署邮件启用 Resend HTTPS API 发送
- 当前由 `apps/web/lib/signature-email.ts` 读取
- 一旦配置，签署邀请邮件和签署完成邮件都会优先走 Resend，而不是服务器直接连 SMTP 端口

是否必填：

- 不是必填
- 但如果你的部署环境阻止出站 `25 / 465 / 587`，这是当前推荐的生产配置
- 如果不配置它，系统会继续走 SMTP delivery

示例格式：

```env
ACRE_RESEND_API_KEY="replace-with-resend-api-key"
```

缺失后的影响：

- 不会导致应用报错
- 但签署邮件会继续尝试走 SMTP transport
- 在像 DigitalOcean 这类默认封锁出站 SMTP 端口的环境里，外部签署邮件可能无法送达

### `ACRE_SMTP_HOST`

用途：

- 作为 transaction document 外部签署邮件的 SMTP host fallback
- 当前只在没有配置 `ACRE_RESEND_API_KEY` 时才会参与真实发送
- 当系统内还没有保存组织级 SMTP 配置时，才会回退到这个 env 值

是否必填：

- 只在你继续使用 SMTP delivery，而且没有系统内 SMTP 配置时才是必填
- 如果已经配置 `ACRE_RESEND_API_KEY`，或者已经在 `Settings > Email delivery` 保存可用 SMTP 配置，这个值可以不填

示例格式：

```env
ACRE_SMTP_HOST="smtp.mailgun.org"
```

缺失后的影响：

- 当系统内 SMTP 配置也不存在、且 `ACRE_RESEND_API_KEY` 也不存在时，`/api/office/transactions/:transactionId/signatures/:signatureRequestId` 的 `send` / `resend` 会失败
- request 不会伪装成已发送

### `ACRE_SMTP_PORT`

用途：

- transaction document 外部签署邮件 SMTP port fallback
- 只在系统实际走 SMTP delivery 时生效

是否必填：

- 不是必填
- 缺失时默认 `587`

示例格式：

```env
ACRE_SMTP_PORT="587"
```

### `ACRE_SMTP_SECURE`

用途：

- 控制 fallback SMTP transport 是否走 secure 模式
- 只在系统实际走 SMTP delivery 时生效

是否必填：

- 不是必填
- 缺失时会按端口推断，`465` 默认为 `true`

示例格式：

```env
ACRE_SMTP_SECURE="false"
```

### `ACRE_SMTP_USER`

用途：

- transaction document 外部签署邮件 SMTP 用户名 fallback
- 只在系统实际走 SMTP delivery 时生效

是否必填：

- 只在继续使用 SMTP env fallback 时必填

示例格式：

```env
ACRE_SMTP_USER="postmaster@example.com"
```

### `ACRE_SMTP_PASSWORD`

用途：

- transaction document 外部签署邮件 SMTP 密码 fallback
- 只在系统实际走 SMTP delivery 时生效

是否必填：

- 只在继续使用 SMTP env fallback 时必填

示例格式：

```env
ACRE_SMTP_PASSWORD="replace-with-smtp-password"
```

### `ACRE_SIGNATURE_FROM_EMAIL`

用途：

- transaction document 外部签署邮件的实际发件邮箱
- 当前首版是单一公共发件邮箱，再通过邮件内容展示 agent 署名
- 当前作为 fallback 发件邮箱；无论系统最终通过 Resend 还是 SMTP 发送，只要 `Settings > Email delivery` 还没有保存组织级 sender defaults，就会回退到这里

是否必填：

- 只在没有系统内 sender defaults 时必填
- 如果你使用 `ACRE_RESEND_API_KEY` 但没有系统内 sender defaults，这个值也必须配置

示例格式：

```env
ACRE_SIGNATURE_FROM_EMAIL="signatures@acresystem.us"
```

### `ACRE_SIGNATURE_FROM_NAME`

用途：

- transaction document 外部签署邮件的 fallback 发件人名称
- Resend API 和 SMTP fallback 都会读取它

是否必填：

- 不是必填
- 缺失时默认 `Acre Signatures`

示例格式：

```env
ACRE_SIGNATURE_FROM_NAME="Acre Signatures"
```

### `ACRE_SIGNATURE_REPLY_TO`

用途：

- transaction document 外部签署邮件的 fallback 默认 reply-to
- 当前允许 per-request sender reply-to 覆盖它
- Resend API 和 SMTP fallback 都会读取它

是否必填：

- 不是必填

示例格式：

```env
ACRE_SIGNATURE_REPLY_TO="agent@acresystem.us"
```

### `ACRE_DOCUMENTS_STORAGE_DIR`

用途：

- 覆盖 transaction document 文件的本地存储目录
- 当前 document upload / generated form document / file open 都通过这个目录读写文件

是否必填：

- 不是必填
- 开发环境不配置时，默认落到仓库根目录下的 `.local-storage/documents`
- 生产环境不配置时，默认落到 `/var/lib/acre/documents`

示例格式：

```env
ACRE_DOCUMENTS_STORAGE_DIR="/absolute/path/to/acre-documents"
```

缺失后的影响：

- 不会导致应用报错
- 会使用默认本地目录
- 当前新写入的 `storageKey` 会以 storage root 下的相对路径保存，避免把仓库目录写死进 metadata
- 这适合当前单 Droplet 生产模型，但前提是目录必须是持久化磁盘路径，而不是 deploy 目录

开发和生产差异：

- 开发环境可直接使用默认目录或显式指定一个本地路径
- 生产环境如果继续保留这个实现，需要保证文件系统持久化、目录权限正确、并把该目录纳入备份
- 更合理的长期方向仍是后续替换到对象存储

### `ACRE_REMOTE_DOCUMENTS_SSH_TARGET`

用途：

- 仅供本地开发使用
- 当本地文档目录缺少某个文件时，允许本地 app 通过 `ssh` 从远端文档根目录按 `storageKey` 回源读取
- 当前主要用于“本地直连 DO 数据库，但图片 / 文档文件仍保存在远端磁盘”的开发场景

是否必填：

- 不是必填
- 只有在你希望本地自动回源远端文档时才需要配置

示例格式：

```env
ACRE_REMOTE_DOCUMENTS_SSH_TARGET="root@45.55.247.137"
```

### `ACRE_REMOTE_DOCUMENTS_STORAGE_ROOT`

用途：

- 仅供本地开发使用
- 指定远端机器上的文档根目录
- 本地回源时会把 `storageKey` 拼接到这个目录下读取真实文件

是否必填：

- 不是必填
- 只有在你希望本地自动回源远端文档时才需要配置

示例格式：

```env
ACRE_REMOTE_DOCUMENTS_STORAGE_ROOT="/var/lib/acre/documents"
```

### `ACRE_REMOTE_DOCUMENTS_SSH_KEY`

用途：

- 仅供本地开发使用
- 指向本地 app 进程可读取的 SSH 私钥路径
- Docker 本地开发通常会把宿主机私钥只读挂进容器，再把容器内路径配置到这个变量

是否必填：

- 在启用远端文档回源时建议配置
- 如果目标主机允许别的无交互认证方式，也可以不配

示例格式：

```env
ACRE_REMOTE_DOCUMENTS_SSH_KEY="/run/acre/remote-documents-ssh-key"
```

### `ACRE_REMOTE_DOCUMENTS_SSH_KNOWN_HOSTS`

用途：

- 仅供本地开发使用
- 指向本地 app 进程可读取的 `known_hosts` 文件路径
- 用来保持 `StrictHostKeyChecking=yes`，避免本地回源时静默信任未知主机

是否必填：

- 不是强制必填
- 但建议和 `ACRE_REMOTE_DOCUMENTS_SSH_KEY` 一起配置

示例格式：

```env
ACRE_REMOTE_DOCUMENTS_SSH_KNOWN_HOSTS="/run/acre/remote-documents-known_hosts"
```

### `ACRE_SECURE_COOKIES`

用途：

- 控制当前本地 auth/session cookie 是否强制使用 `Secure`
- 当前主要用于没有 HTTPS 的部署环境

是否必填：

- 不是必填
- 不配置时，当前代码会在 `production` 环境默认使用 `Secure` cookie

示例格式：

```env
ACRE_SECURE_COOKIES=false
```

当前使用建议：

- 本地开发：通常不需要显式设置
- 纯 `HTTP` 的临时生产部署：设为 `false`
- 正式 `HTTPS` 生产部署：不要设为 `false`
- 当前默认生产基线应显式把它设为 `true`，避免环境缺失时靠隐式默认值判断

缺失后的影响：

- 在没有 HTTPS 的生产环境里，如果保持默认 `Secure` cookie，登录后浏览器不会保存 session
- 表现为：
  - 登录接口返回成功
  - 但进入受保护页面后又被重定向回 `/login`

开发和生产差异：

- 开发环境通常不受这个问题影响
- 纯 `HTTP` 生产环境需要显式处理
- 一旦接入 HTTPS，应恢复 `Secure` cookie

## 当前代码中的来源

参考文件：

- [.env.example](../.env.example)
- [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma)
- [packages/db/package.json](../packages/db/package.json)
- [packages/db/src/client.ts](../packages/db/src/client.ts)

注意：

- 当前 `db:validate` 脚本里带了一个本地占位格式的连接串，用于在没有真实 secret 的情况下完成 schema 语法校验
- 这不等于已经接入真实数据库

## 当前可选但按需启用的环境变量

- `NEXT_PUBLIC_ACRE_ADMIN_GPT_URL`
- `ACRE_ADMIN_GPT_OAUTH_CLIENT_ID`
- `ACRE_ADMIN_GPT_OAUTH_CLIENT_SECRET`
- `ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET`
- `ACRE_ADMIN_GPT_ALLOWED_REDIRECT_HOSTS`
- `ACRE_ADMIN_CODEX_BIN`
- `ACRE_ADMIN_CODEX_MODEL`
- `ACRE_ADMIN_CODEX_WORKDIR`
- `ACRE_ADMIN_CODEX_TIMEOUT_SECONDS`
- `ACRE_ADMIN_CODEX_MAX_IMAGES`
- `ACRE_ADMIN_CODEX_MAX_IMAGE_BYTES`
- `ACRE_ADMIN_CODEX_MAX_TOTAL_IMAGE_BYTES`
- `ACRE_ADMIN_CODEX_MAX_EXEC_OUTPUT_BYTES`
- `OPENAI_API_KEY`
- `OPENAI_INTAKE_ASSIST_MODEL`

### `NEXT_PUBLIC_ACRE_ADMIN_GPT_URL`

用途：

- 旧的外部 ChatGPT 自定义 GPT 入口配置
- 当前 `/office/admin-assistant` 默认使用站内聊天框 + 服务器本机 Codex CLI OAuth，不再依赖这个 URL

是否必填：

- 非必填
- 当前站内聊天实现不需要设置

示例格式：

```env
NEXT_PUBLIC_ACRE_ADMIN_GPT_URL="https://chatgpt.com/g/g-your-acre-admin-help"
```

### `ACRE_ADMIN_GPT_OAUTH_CLIENT_ID`

用途：

- ChatGPT GPT Actions 连接 Acre Admin Help Action 时使用的 OAuth client id
- 必须与 GPT Builder 中填写的 client id 一致

是否必填：

- 生产必填
- 本地开发未设置时会使用开发 fallback，不能用于共享环境

示例格式：

```env
ACRE_ADMIN_GPT_OAUTH_CLIENT_ID="acre-admin-gpt"
```

### `ACRE_ADMIN_GPT_OAUTH_CLIENT_SECRET`

用途：

- ChatGPT GPT Actions 交换 Acre Admin GPT OAuth authorization code 时使用的 client secret
- 只应配置在服务器环境和 GPT Builder Action authentication 配置中，不要提交到仓库

是否必填：

- 生产必填
- 本地开发未设置时会使用开发 fallback，不能用于共享环境

示例格式：

```env
ACRE_ADMIN_GPT_OAUTH_CLIENT_SECRET="<generated-client-secret>"
```

### `ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET`

用途：

- 对 Acre Admin GPT 的短期 OAuth code / access token 做 HMAC 签名
- 当前实现不持久化 OAuth code 或 access token，因此这个 secret 是无状态验签边界

是否必填：

- 非必填
- 未设置时回退使用 `ACRE_SESSION_SECRET`
- 生产建议设置独立强随机值，避免和浏览器 session secret 绑定轮换

示例格式：

```env
ACRE_ADMIN_GPT_OAUTH_SIGNING_SECRET="<generated-signing-secret>"
```

### `ACRE_ADMIN_GPT_ALLOWED_REDIRECT_HOSTS`

用途：

- 限制 Acre Admin GPT OAuth authorize endpoint 可以回跳的 ChatGPT callback host
- 多个 host 用英文逗号分隔

是否必填：

- 非必填
- 未设置时默认允许 `chat.openai.com` 和 `chatgpt.com`

示例格式：

```env
ACRE_ADMIN_GPT_ALLOWED_REDIRECT_HOSTS="chat.openai.com,chatgpt.com"
```

补充说明：

- `/api/admin-gpt/context`、`lookup`、`triage`、OAuth、OpenAPI schema 仍是只读 GPT Action 服务，可作为外部 GPT fallback 使用
- 新的站内聊天使用 `/api/admin-gpt/chat`，由 Acre 做管理员 session、CSRF、限流和图片大小校验，然后调用服务器本机 `codex exec`
- Acre 不写入完整聊天、图片、模型回答到数据库；Codex CLI 自身的运行日志或 OAuth session 属于服务器运行环境，应按服务器运维策略单独管理
- 不要复制本机 Codex Desktop 登录 token / session 到生产；生产服务器应使用 app service user 自己的 `codex login --device-auth` OAuth 登录

### `ACRE_ADMIN_CODEX_BIN`

用途：

- `/api/admin-gpt/chat` 调用的 Codex CLI 可执行文件
- 默认值是 `codex`

是否必填：

- 非必填

示例格式：

```env
ACRE_ADMIN_CODEX_BIN="codex"
```

### `ACRE_ADMIN_CODEX_MODEL`

用途：

- `/api/admin-gpt/chat` 调用 `codex exec -m` 时使用的模型
- 默认值是 `gpt-5.5`

是否必填：

- 非必填

示例格式：

```env
ACRE_ADMIN_CODEX_MODEL="gpt-5.5"
```

### `ACRE_ADMIN_CODEX_WORKDIR`

用途：

- `codex exec` 的工作目录
- 生产默认随 Next.js service 工作目录运行，建议显式设置为 `/opt/acre-ui-rebuild/app`
- Codex 使用 `--sandbox read-only`、`--ask-for-approval never`、`--ephemeral`，管理员助手不应写代码、改数据库或部署

是否必填：

- 非必填

示例格式：

```env
ACRE_ADMIN_CODEX_WORKDIR="/opt/acre-ui-rebuild/app"
```

### `ACRE_ADMIN_CODEX_TIMEOUT_SECONDS`

用途：

- 单次管理员助手回答的 Codex CLI 超时时间
- 默认 `90`

是否必填：

- 非必填

示例格式：

```env
ACRE_ADMIN_CODEX_TIMEOUT_SECONDS="90"
```

### `ACRE_ADMIN_CODEX_MAX_IMAGES` / `ACRE_ADMIN_CODEX_MAX_IMAGE_BYTES` / `ACRE_ADMIN_CODEX_MAX_TOTAL_IMAGE_BYTES`

用途：

- 限制站内聊天一次最多上传多少张截图、单张大小、总大小
- 默认分别是 `3`、`1048576`、`2097152`

是否必填：

- 非必填
- 生产建议保持小尺寸，避免 Codex CLI 进程处理过大的图片

示例格式：

```env
ACRE_ADMIN_CODEX_MAX_IMAGES="3"
ACRE_ADMIN_CODEX_MAX_IMAGE_BYTES="1048576"
ACRE_ADMIN_CODEX_MAX_TOTAL_IMAGE_BYTES="2097152"
```

### `ACRE_ADMIN_CODEX_MAX_EXEC_OUTPUT_BYTES`

用途：

- 限制 `codex exec` stdout/stderr 捕获大小
- 默认 `524288`

是否必填：

- 非必填

示例格式：

```env
ACRE_ADMIN_CODEX_MAX_EXEC_OUTPUT_BYTES="524288"
```

补充说明：

- 当前 `/agent` quick lead intake 的服务端增强版 `OCR / transcript assist` 会在检测到 `OPENAI_API_KEY` 时尝试调用 OpenAI 做结构化字段提取，默认模型为 `gpt-5.4-mini`
- 该能力仍然保持 `review-first`：只生成待审查建议，不自动创建 lead，不自动发送，不绕过现有 live form
- 如果 `OPENAI_API_KEY` 未配置、请求失败、或模型没有返回可用字段，当前代码会自动回退到现有本地 OCR + 本地规则提取链路
- `OPENAI_INTAKE_ASSIST_MODEL` 仅用于覆盖默认模型；未配置时默认走 `gpt-5.4-mini`

## 暂未实现但未来大概率会新增的环境变量

以下变量当前还不存在于代码里，因此不要提前假设已经接入：

- `NEXTAUTH_SECRET` 或同类 auth secret
- `NEXTAUTH_URL` 或应用 base URL
- `S3_*` / `R2_*` 对象存储相关变量
- OCR provider key
- 邮件 / 短信服务 key
- 第三方地产平台集成 key

这些在真正接入前，不应写入生产部署手册中作为“已存在配置”。

补充说明：

- 当前 `/agent` quick lead intake 仍然不依赖独立 OCR provider key
- OCR 目前仍以本地 `tesseract.js` 为基础，OpenAI 只参与结构化字段提取，不替代现有 review-first 边界

## 开发环境建议

如果你当前只是前端开发或页面结构开发：

- 可以不配置真实数据库
- 直接运行 `npm run dev`
- 当前根目录 `npm run dev` 通过 `scripts/dev-web.mjs` 直接拉起 Next.js 开发服务器，并默认使用 Next.js 当前默认 bundler，避免 `Docker/Colima` detached 开发态里 `next dev --webpack` 首次请求后偶发 clean exit / 自动重启循环
- 如果你明确要验证 `webpack` 行为，改为直接运行 `npm run dev --workspace=@acre/web -- --port 3105 --hostname 0.0.0.0`

如果你要开始接数据库：

1. 先在仓库根目录配置 `.env.local`
2. 提供真实可连接的 `DATABASE_URL`
3. 运行 `npm run db:generate`
4. 运行 `npm run db:migrate -- --name init`
5. 运行 `npm run db:seed`

如果你要改用 Docker 本地长期运行：

1. 安装 Docker Desktop 或可用的 Docker Engine
2. 在仓库根目录执行 `npm run docker:dev:up`
3. 首次初始化数据库时执行 `docker compose run --rm web npm run db:migrate -- --name init`
4. 需要初始数据时执行 `docker compose run --rm web npm run db:seed`
5. 打开 `http://localhost:3105/`

当前 Docker 开发基线说明：

- `db` 使用 `postgres:16-alpine`
- `web` 使用仓库内 `Dockerfile.dev`
- `web` 和 `db` 都配置为 `restart: unless-stopped`
- `web` 容器额外保持 `stdin_open + tty`，减少 detached compose 下 dev server 因 stdin EOF 提前退出
- `scripts/dev-web.mjs` 会在容器内自动重启意外退出的 `next dev` 子进程，减少 `localhost:3105` 偶发空响应
- 文档文件会持久化到 Docker volume，而不是容器临时层
- 如果你希望宿主机 `npm run dev` 与 Docker `web` 共享同一套本地数据库，宿主机 `.env.local` 的 `DATABASE_URL` 应保持为 `postgresql://postgres:postgres@127.0.0.1:5433/acre`
- 容器内部仍然固定使用 `postgresql://postgres:postgres@db:5432/acre`
- 如果宿主机另一个服务占用了 `5433`，需要同步修改 compose 的 host 端口映射和宿主机 `.env.local`

如果你当前 Docker 开发态直接依赖 `DigitalOcean` 远端数据库隧道，希望本地站点尽量持续在线，可以额外开一个终端长期运行：

```bash
npm run docker:dev:keepalive
```

这条 watchdog 会循环确保：

- `root@45.55.247.137 -> 0.0.0.0:15432` 的 SSH 隧道仍然在线；Docker 容器经 `host.docker.internal:15432` 访问（OrbStack / Docker Desktop），宿主机工具仍可经 `127.0.0.1:15432` 访问
- `docker compose up -d` 的 `web + db` 服务维持运行
- `http://localhost:3105/login` 可响应；如果检测失败，会自动 `docker compose restart web`

当前 `macOS + OrbStack` 基线说明（历史上也支持 Colima/Lima，但当前基线早已切到 OrbStack，不要再把迁移到 OrbStack 当作待办排查项）：

- `ssh -L` 默认只绑定 `localhost` 时，Docker 容器经 `host.docker.internal` 访问不到这条隧道
- `scripts/docker-dev-keepalive.sh` 现在默认把 DO 数据库隧道绑定到 `0.0.0.0:15432`
- 脚本会从 `db` 容器内探测 `host.docker.internal:15432`；如果容器侧探测失败，会自动重建隧道
- 如需覆盖默认值，可设置 `ACRE_DO_DB_TUNNEL_BIND_HOST`、`ACRE_DO_DB_TUNNEL_CONTAINER_HOST`、`ACRE_DO_DB_TUNNEL_PROBE_SERVICE`

### 生产数据到本地的单向同步

如果你需要把 `DigitalOcean` 线上最新数据拉到本地开发库，但又不希望本地写操作回写线上，可以使用：

```bash
npm run db:sync:from-production
```

当前同步行为：

- 通过 `ssh` 连接默认生产主机 `root@45.55.247.137`
- 从 `/etc/acre/acre-ui-rebuild.env` 读取生产 `DATABASE_URL`
- 在远端仅执行 `pg_dump` 只读导出
- 在本地 Docker `db` 容器里先导入 `prod_sync_stage` 临时 schema
- 再把 stage 数据 upsert 合并进本地 `public` schema
- 线上不存在的本地记录会保留，不会被删除
- 这是一条单向同步线：本地不会把数据回写线上

当前限制：

- 本地如果改的是与线上同一主键的既有记录，下一次同步时会被线上版本覆盖
- 该脚本依赖本地 `docker compose` 的 `db` 服务正在运行
- 该脚本依赖远端主机上可用的 `pg_dump`
- 同步前应保证本地 schema 与当前代码匹配；如果刚改过 Prisma schema，先运行 `npm run db:generate` 以及需要的 migration
- 如果你本地之前跑过 seed 或旧测试数据，这些“线上不存在”的本地记录会默认保留；如果首次要做成纯线上基线，可临时开启 `ACRE_SYNC_RESET_LOCAL=1`

如果你想直接把本地数据库重置成“当前线上库的纯镜像”，可以使用：

```bash
npm run db:mirror:from-production
```

这条命令会自动启用 `ACRE_SYNC_RESET_LOCAL=1`，因此会先清空本地 `public` schema 的业务数据，再导入当前生产数据。

如果你还想把远端文档文件也镜像到本地 Docker 文档卷，可以使用：

```bash
npm run documents:mirror:from-production
```

这条命令会：

- 通过 `rsync` 从远端 `ACRE_REMOTE_DOCUMENTS_STORAGE_ROOT`（默认 `/var/lib/acre/documents`）拉取文件
- 覆盖本地 `web` 容器里的 `ACRE_DOCUMENTS_STORAGE_DIR`（默认 `/app/.local-storage/documents`）
- 删除本地文档卷里线上已经不存在的文件

如果你要一次性做“数据库 + 文档文件”的本地完整镜像，可以使用：

```bash
npm run state:mirror:from-production
```

这条命令会先执行 `db:mirror:from-production`，再执行 `documents:mirror:from-production`，是当前仓库里最接近“把本地状态拉到和线上一样”的固定入口。

### 本地同步脚本相关变量

以下变量是同步脚本的 operator override，不是 Web 应用 runtime 必填项：

- `ACRE_DEPLOY_HOST`
  - 默认 `root@45.55.247.137`
- `ACRE_DEPLOY_SSH_KEY`
  - 默认 `$HOME/.ssh/acre_do_ed25519`
- `ACRE_DEPLOY_ENV_FILE`
  - 默认 `/etc/acre/acre-ui-rebuild.env`
- `ACRE_LOCAL_DB_SERVICE`
  - 默认 `db`
- `ACRE_LOCAL_DB_HOST`
  - 默认 `127.0.0.1`
- `ACRE_LOCAL_DB_NAME`
  - 默认 `acre`
- `ACRE_LOCAL_DB_USER`
  - 默认 `postgres`
- `ACRE_LOCAL_DB_PASSWORD`
  - 默认 `postgres`
- `ACRE_SYNC_STAGE_SCHEMA`
  - 默认 `prod_sync_stage`
- `ACRE_SYNC_KEEP_STAGE_SCHEMA`
  - 默认 `0`
- `ACRE_SYNC_RESET_LOCAL`
  - 默认 `0`
  - 设为 `1` 时，会先清空本地 `public` schema 里的业务数据，再把线上数据导入本地
- `ACRE_LOCAL_WEB_SERVICE`
  - 默认 `web`
- `ACRE_LOCAL_DOCUMENTS_DIR`
  - 默认 `/app/.local-storage/documents`
- `ACRE_REMOTE_DOCUMENTS_STORAGE_ROOT`
  - 默认 `/var/lib/acre/documents`
  - `documents:mirror:from-production` 会使用它作为远端文件根目录

当前实现说明：

- `packages/db` 的 Prisma 脚本会读取仓库根目录的 `.env.local` / `.env`
- `@acre/db` 的 runtime 也会从仓库根目录读取同一份 `DATABASE_URL`

## 生产环境建议

当前默认生产基线是 `DigitalOcean + systemd + nginx`：

- 不要把 `.env.local` 提交到仓库
- 服务器环境文件位于 `/etc/acre/acre-ui-rebuild.env`
- 服务器应用目录位于 `/opt/acre-ui-rebuild/app`
- 生产服务名是 `acre-ui-rebuild-web.service`
- 生产 `DATABASE_URL` 必须指向可用的 PostgreSQL 实例
- 生产 `ACRE_SECURE_COOKIES` 应显式设为 `true`

### Secret rotation tracking

| Secret | Source of truth | Compatibility window | Last rotated at |
| --- | --- | --- | --- |
| `ACRE_SESSION_SECRET` | `/etc/acre/acre-ui-rebuild.env` | `30 days` via `ACRE_SESSION_SECRET_SECONDARY` | `<pending>` |
| `ACRE_SETTINGS_ENCRYPTION_SECRET` | `/etc/acre/acre-ui-rebuild.env` | none; re-save SMTP / Signature Drive / QuickBooks only if decrypt fails | `<pending>` |
| `ACRE_RESEND_API_KEY` | `/etc/acre/acre-ui-rebuild.env` + Resend dashboard | none | `<pending>` |
| `QUICKBOOKS_CLIENT_SECRET` | `/etc/acre/acre-ui-rebuild.env` + Intuit developer app | reconnect QuickBooks after app-secret rotation | `<pending>` |
| `DATABASE_URL` (`acre_app` password) | `/etc/acre/acre-ui-rebuild.env` + PostgreSQL role `acre_app` | until the app reconnects with the restarted process | `<pending>` |

配套文档：

- [docs/ops/secret-rotation-runbook.md](./ops/secret-rotation-runbook.md)
- [docs/ops/secret-rotation-actions.md](./ops/secret-rotation-actions.md)

### 已暴露本地 secret 的止血 runbook

当 `.env` / `.env.local`、终端输出、截图、聊天记录或备份暴露了真实值时，按以下顺序处理：

1. 先轮换外部系统里的真实凭据，再改代码仓库和本地环境
2. `Resend`：吊销旧 `ACRE_RESEND_API_KEY`，生成新 key，并同步更新生产 `/etc/acre/acre-ui-rebuild.env`
3. `PostgreSQL`：为 `acre_app` 执行 `ALTER USER ... WITH PASSWORD ...`，然后同步更新生产 `/etc/acre/acre-ui-rebuild.env`
4. `Session`：生成新的 `ACRE_SESSION_SECRET`，把旧值临时移到 `ACRE_SESSION_SECRET_SECONDARY`，等待当前 cookie 最大存活期过去后再删除 secondary
5. 重启生产服务：`systemctl restart acre-ui-rebuild-web.service`
6. 如果历史上没有单独的 `ACRE_SETTINGS_ENCRYPTION_SECRET`，确认 SMTP / Signature Drive / QuickBooks 的已保存密钥仍可解密；必要时在新 secret 生效后重新保存这些设置
7. 本地环境不要继续保留长期生产或共享环境 secret；优先迁移到 `1Password CLI`、`Doppler` 或其他外部 secret source

### git 历史扫描 checklist

在确认“只是本地工作树暴露”之前，先跑一轮历史扫描：

```bash
git log --all --full-history -p -- .env .env.local
git log --all -S '<old-resend-key-fragment>'
git log --all -S '<old-db-password-fragment>'
git log --all -S 'ACRE_SESSION_SECRET'
```

如果历史里出现真实 secret：

- 先继续按上面的 runbook 完成轮换
- 再决定是否需要 `git filter-repo` 重写历史
- 无论是否重写，都应把这次事件写入内部 incident log / 运维记录

### 本地 secret scan 与 hook

- 仓库现在提供 `.gitleaks.toml`
- `npm run scan:secrets` 会运行一次工作树 secret scan
- `npm run hooks:install` 会把 Git hooks 指向仓库内 `.githooks`
- `.githooks/pre-commit` 当前会对 staged 变更运行 gitleaks；如果本机没有 `gitleaks`，会尝试使用 Docker 镜像

## 维护要求

今后每新增一个环境变量，都应同步更新：

- [docs/env.md](./env.md)
- [.env.example](../.env.example)
- 如果影响部署，也要同步更新 [docs/deployment.md](./deployment.md)
