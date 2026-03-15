# Decisions

## 这份文件是做什么的

这不是“理想架构宣言”，而是记录当前项目为什么会长成现在这样，以及哪些选择是有意为之，哪些只是阶段性方案。

接手者最应该先理解这里，因为很多代码现状看起来“不完整”，但其实是刻意停在一个对后续演进更安全的阶段。

## 关键决策 1：先做内部 Agent / Office 系统，不做客户前台

原因：

- 当前业务定义明确偏向内部工作台
- 用户角色、流程、权限、数据结构都首先服务 agent 和 office team
- 客户前台网站未来应复用这里的数据能力，但不应反过来绑架后台设计

影响：

- 当前页面只做 agent / office 两个 workspace
- 信息架构优先考虑内部工作流，不优先考虑营销展示

Trade-off：

- 现在看起来不“完整”，因为 public-facing 部分还没开始
- 但这样能先把真正复杂的业务中台钉住

## 关键决策 2：采用 monorepo，而不是单个前端项目

原因：

- 项目从一开始就不是单页面 demo
- 已经明确需要前端、权限、领域逻辑、数据库 schema 分层
- 后续还可能增加更多 app 和 package

影响：

- 根目录用 npm workspaces + Turbo
- `apps/web` 只做应用层
- `packages/*` 放共用能力

Trade-off：

- 初期样板和工程配置比单项目多
- 但后面接数据库、鉴权、更多 app 时返工更少

## 关键决策 3：当前后端先用 Next.js Route Handlers，而不是独立 API 服务

原因：

- 当前阶段最重要的是把 Web、API、领域结构一起钉住
- Next.js Route Handlers 足够承载现在这批只读 API
- 和当前单机 `Next.js + systemd + nginx` 的部署路径一致

影响：

- API 目前都在 [apps/web/app/api](../apps/web/app/api)
- 页面和 API 共用 `@acre/backoffice`

Trade-off：

- 后续如果出现复杂写操作、长任务、重集成，可能需要拆更独立的 service/worker
- 但现在不值得过早拆分

## 关键决策 4：先把业务结构做对，再接真实数据库

这是当前最容易被误解的一点。

为什么没有一开始就接数据库：

- 当前最先需要验证的是模块边界和信息架构
- 项目需求还在快速收敛
- 过早把数据库写入页面和 API，后续很容易高成本返工

所以现在采用了一个过渡方案：

- `packages/db` 里先定义 Prisma schema
- `packages/backoffice` 里先提供稳定的 mock 数据和 DTO
- 页面和 API 先围绕 service 输出建结构

Trade-off：

- 这让项目当前“能跑但不持久化”
- 这是刻意的，不是漏做

后续重构点：

- 用 Prisma runtime 替换 `@acre/backoffice` 里的内存数据来源
- 尽量保留页面和 API 的输出 shape，不让前端大面积返工

## 关键决策 5：权限模型先独立成包

原因：

- 多角色是项目基础，不是后加功能
- listings、clients、events、resources、analytics 的访问能力未来一定会分角色变化
- 如果权限逻辑先散在页面里，后面一定会变乱

影响：

- 当前 `@acre/auth` 已经独立
- 页面和 API 已经可以读角色摘要

未实现：

- 复杂 session 体系
- middleware
- 数据级权限

Trade-off：

- 当前看起来像“只定义了权限字符串”
- 但这比以后从 UI 代码里回收权限逻辑要安全得多

## 关键决策 6：Listings 是数据中轴

原因：

- 从产品定义看，listings 同时服务内部运营、agent 营销和未来 public site
- 所以 schema 和页面设计都优先围绕 listings 建立

影响：

- office 端有 listings admin
- agent 端有 listings workspace
- schema 中 listings 关联了 office、owner、share links、public/private 状态

Trade-off：

- 其他模块现在看起来相对轻
- 这是因为 listings 会成为后续很多功能的上游数据源

## 关键决策 7：当前 UI 不引入重型组件库，但建立内部 Back Office 设计系统

原因：

- 现在最重要的是把 `Back Office` 做成一个统一产品，而不是继续允许页面各自长相漂移
- 直接引入重型 UI 框架会增加约束和迁移成本
- 当前页面规模已经需要统一 token、表格、页头、detail section 和表单风格，但还不需要完整第三方 enterprise UI 平台

影响：

- 使用 root layout 全局加载的单一主字体
- `Office` token 继续集中在全局 CSS
- `@acre/ui` 扩成轻量但明确的 Back Office primitives：
  - `PageShell`
  - `PageHeader`
  - `SectionCard`
  - `DataTable`
  - `FormField`
  - `Button`
  - `StatusBadge`
  - 以及其他表单 / filter / detail primitives
- 仍不引入重型第三方组件库

Trade-off：

- 样式系统仍有一部分兼容旧 `bm-* / office-*` 类名的过渡层
- 这不是最“纯粹”的重构，但能在不推翻业务模块的情况下快速统一产品视觉
- 后续如果真的需要更强表格或复杂输入能力，仍可能继续引入专门工具

## 关键决策 8：当前优先贴近 `Brokermint` 的 Back Office，而不是继续发散 Acre 新概念页

原因：

- 用户已经明确当前范围只做后端，也就是内部 `Back Office`
- 真实参考已经固定为 `https://my.brokermint.com/#/dashboard`
- 前一轮概念化的 Acre 首页虽然能说明工程结构，但不符合真实业务使用场景

影响：

- 当前 `office` 线的页面命名、左侧导航、信息密度，都优先按 `Brokermint` 的后台结构收敛
- 当前最优先的页面是：
  - `Dashboard`
  - `Pipeline`
  - `Transactions`
- 其他 Acre 更宽泛的设想暂时不作为 `office` 主界面依据

Trade-off：

- 现在的 `office` UI 会比最初的 Acre PRD 更“像现有系统”，创新空间被暂时压后
- 但这更符合当前阶段目标，也更利于后续做功能等价系统

## 关键决策 8.5：Buyer Offers 继续放在 Transaction hub 内，而不是另建一个分离产品

原因：

- `Brokermint / BoldTrail` 的 buyer offers 本质上仍是 transaction management 的一部分
- offer 会直接依赖当前已经存在的：
  - transaction
  - documents
  - forms / signatures
  - tasks
  - activity log
- 如果现在另起第二套 offer app，后面会把 transaction detail、documents 和 workflow 再拆碎一次

影响：

- offer 当前落在 transaction detail 内
- `Offer` / `OfferComment` 进入 Prisma schema
- document / form / signature 直接通过 `offerId` 复用现有 foundation
- accepted offer 可以显式回写 transaction 的 price / closing date / acceptance context

Trade-off：

- 现在没有单独的 top-level `Offers` 工作台
- 也没有 MLS / email ingestion
- 但这样能先把内部 Back Office offer workflow 做实，而不是假装外部入口已经存在

## 关键决策 8.6：`Office Account` 保持自助账户页，而不是并入 `Office Admin`

原因：

- `User > Account` 面向当前登录用户的自助资料、通知偏好和安全上下文
- `Settings / Users / Teams` 仍然是管理员管理其他成员和 office 配置的入口
- 如果把两者混在一起，权限边界和页面心智都会变差

影响：

- `/office/account` 只允许当前 session membership 读取和保存自己的安全字段
- office / role / team assignment 在账户页只读展示，不开放跨用户编辑
- 通知偏好使用 membership-scoped 的显式模型，而不是复用 admin user access 表单
- 安全区只显示当前本地 auth 真实支持的能力，不伪造 password reset / 2SV

Trade-off：

- 账户页现在不是完整 identity center
- 但这样能先把真实 self-service 体验做出来，同时保持 admin 模块边界清晰

## 当前已知限制

这些限制是当前真实存在的，不应忽略：

- 只有最小本地 auth/session，没有第三方 provider、没有复杂权限管理
- 主页面和主 API 还没有切到真实数据库读写
- 写 API 当前只覆盖 `Transactions` 和 `Contacts` 的最小闭环
- 没有测试
- 没有异常监控
- 已有真实 `DigitalOcean :3105` 线路，但整体生产能力仍处于过渡阶段
- `@acre/backoffice` 目前同时承担“领域模型”和“临时数据源”两种职责
- 当前 `Back Office` 页面虽然已经开始贴近 `Brokermint`，但仍有一些边角流程、agent/resource feed 和非核心路径保留静态示例数据或简化交互，不应误判为已完全复刻完成
- 文档文件当前采用本地文件系统 MVP，而不是对象存储；这适合开发和本地验证，不应误判为生产可用存储层
- `Forms / eSignature / Incoming updates` 当前是内部 workflow foundation，不是外部 vendor integration

## 明确的临时方案

以下是刻意接受的临时方案，后续大概率会重构：

### 1. `@acre/backoffice` 里的内存数据

这是当前最大的临时方案。

目的：

- 让页面、API、领域结构先稳定

未来：

- 用真实 repository / Prisma 查询替换

### 2. API 全是 `GET`

目的：

- 先把读取模型钉稳

未来：

- 再补写操作和 mutation 规则

### 3. Prisma 先以最小 runtime 进入仓库

目的：

- 先定义数据边界
- 建立 generate / migrate / seed 的基础工作流
- 先证明 seed 后的数据可以被服务端查询
- 不在这一轮就把所有页面和 API 从 mock 切到数据库

未来：

- 再把真实数据库读取逐步替换进领域 service 和页面/API
- 当前这条迁移已经从 `Transactions` 和 `Contacts` 开始落地：
  - dashboard 业务指标 / recent transactions / access summary 已切到 Prisma + session context
  - pipeline 已切到 Prisma，并重构成左侧 summary rail + 右侧 unified list 的 workspace
  - 当前 metric mode 暴露真实可得的 `Transaction volume`、`Office net` 和 `Office gross`
  - `Office gross` 当前使用 transaction finance 上已存储的 `grossCommission`，缺失值按 `0` 处理
  - `Closed / Cancelled` 月度历史优先使用 `closingDate`，没有时回退到 `updatedAt`
  - transaction list/detail/create/status update 已经切到 Prisma
  - transaction finance 先用 `Transaction` 上的 5 个可空字段落地，而不是单独 finance model
  - contact list/detail/create/edit/follow-up task / transaction link 已经切到 Prisma
  - contact list 现在改成 URL 驱动的服务端搜索 / stage 过滤 / 分页，而不是客户端拿全量数组后本地过滤
  - transaction list 现在也改成 URL 驱动的服务端搜索 / status 过滤 / 分页，而不是客户端拿全量数组后本地过滤
  - transaction/contact relation 现在以 `TransactionContact` 为 source of truth，`primaryClientId` 仅保留兼容同步
  - transaction detail 现在已经开始消费 `TransactionContact`，支持最小 linked contacts 管理
  - transaction detail 的 checklist 先用单独的 `TransactionTask` 小模型落地，不复用 `FollowUpTask`
  - 在此基础上，再扩成独立 `/office/tasks` 模块，而不是另建第二套 task 系统
  - `TaskListView` 先按 membership 维度持久化 saved views，不做公司级全局视图编辑器
  - task workflow 先支持最小 review / secondary approval 状态流，再与当前 documents / forms / signatures foundation 做真实联动
  - transaction summary 的 `totalNetIncome` 现在按 `officeNet` 聚合，不再硬编码
  - reports page 的最小聚合报表已切到 Prisma
  - reports page 的 CSV 导出当前采用单页专用 route，不引入通用导出框架
  - 其他模块继续保留 mock

### 4. Auth 先采用本地 seeded-user + signed-cookie 方案

目的：

- 尽快让 `/office/*` 具备最小服务端保护
- 复用已存在的 seeded users / memberships
- 不在这个阶段引入第三方 auth provider

当前形态：

- `/login` 使用 seeded email 登录
- server-side signed cookie session
- `/office/*` 通过 layout 做服务端拦截
- office dashboard API 改为读取真实 session context

未来：

- 再决定是否升级到更完整的 auth provider、session store、数据级权限

### 5. Documents / Forms / eSignature 先做内部 workflow foundation，不直接接第三方

原因：

- 当前最重要的是把 transaction detail 的 document workflow 真实接起来
- 需要先有 durable models，避免以后接 DocuSign / Dotloop / Folio 时重做 schema
- 当前仓库还没有稳定的外部 vendor 写路径，不能假装已经存在

影响：

- 当前已有：
  - `TransactionDocument`
  - `FormTemplate`
  - `TransactionForm`
  - `SignatureRequest`
  - `IncomingUpdate`
- transaction detail 已支持：
  - 文档上传 / 删除 / 打开
  - unsorted documents
  - 从 task 进入 forms
  - 内部签名请求状态机
  - incoming update review
- activity log 已经能记录 document / form / signature / incoming update 事件

Trade-off：

- 现在不是完整文档平台
- 没有 live external sync
- 没有真正第三方签名 transport
- 但数据库和 workflow foundation 已经稳定，后续接 vendor 不需要完全推翻

### 6. 文件存储先用本地文件系统 MVP，而不是对象存储

原因：

- 现在需要真实 upload / open / delete 能力，不能继续停留在假链接
- 当前还没到必须引入 S3 / R2 / signed URL 的阶段

影响：

- 当前文档文件默认写到 `.local-storage/documents`
- 可以用 `ACRE_DOCUMENTS_STORAGE_DIR` 覆盖
- 这套存储实现和 document metadata 已经解耦，后续可以替换 storage adapter

Trade-off：

- 本地开发简单
- 生产环境不合适
- 后续切对象存储时，需要替换底层存储实现，但不必重做 transaction document schema

### 7. `Activity` 现在以 `AuditLog` 为主，并同页补了实时 `Operational Alerts`

原因：

- 当前仓库已经落地了多条真实写入路径：
  - transaction create / status / finance
  - transaction contact link / unlink / primary change
  - transaction task create / update / complete / reopen
  - follow-up task create
  - contact create / update
  - accounting transaction create / update
  - EMD create / update
  - auth login / logout
- 与其继续维护一个“运营 feed”，不如直接把这些真实写入统一沉淀到 `AuditLog`
- 但也不能假装系统已经有完整 Brokermint 级 audit coverage，所以范围必须如实收口

影响：

- `Activity` 页面现在改成 account activity log：
  - 左侧 section counts
  - 右侧保留最新 200 条 event stream
  - 同页增加基于数据库状态实时派生的 alerts
  - 以 `AuditLog` 为主数据源，alerts 只作为第二数据源
  - 事件按更宽的 taxonomy 分组，而不是把每个 action 暴露成碎片化小类
  - 过滤器允许按 actor、object type、date range 收窄范围
  - 顶部 `Add comment` 也直接写进 `AuditLog`，不再额外造第二套 comment store
  - 首版访问权限收紧为 `office_admin / office_manager`
  - event summary 优先从结构化 payload / changes 生成，避免把文案散落到页面组件
- 事件只覆盖当前仓库已经实现并真实写入的模块
- 没有 write hook 的模块，不会伪造 event category
- 没有真实底层模块的 alert 类型也不会伪造，比如 document/signature/invoice

Trade-off：

- 当前 activity 还不是完整 back-office 审计产品，也不是完整通知中心
- 但它已经是一个真实、actor-aware 的 activity log，并能把最关键的运营告警收进系统内
- 当前还没有 documents / settings / team / invoice payment lifecycle 这些模块的完整真实事件覆盖，所以页面不会假装这些分类已经可用

## 关键决策 8：Accounting 先做 transaction-side accounting MVP，不做通用会计平台

原因：

- 目标参考是 `BoldTrail / Brokermint` 的 back-office transactional accounting
- 当前最需要的是围绕 transaction、agent、brokerage financial workflow 的 accounting foundation
- 如果现在直接做通用小企业会计系统，范围会失控，而且和当前产品目标不匹配

影响：

- 现在先引入：
  - `LedgerAccount`
  - `AccountingTransaction`
  - `AccountingTransactionLineItem`
  - `GeneralLedgerEntry`
  - `EarnestMoneyRecord`
- 支持的 transaction types 明确限定在：
  - `invoice`
  - `bill`
  - `credit_memo`
  - `deposit`
  - `received_payment`
  - `made_payment`
  - `journal_entry`
  - `transfer`
  - `refund`
- posting 规则保持显式、可审查，而不是抽象成通用 accounting engine
- EMD 作为真实地产会计概念被单独建模，不混进普通 finance notes

Trade-off：

- 当前 accounting 已经是真实数据库模块，但仍然不是完整会计产品
- 没有：
  - QuickBooks sync
  - bank reconciliation
  - payroll
  - office rent / utilities accounting
  - ACH payout / payment gateways
  - giant enterprise accounting / payout engine
- 这样做的好处是后续还能继续长，而不用重推翻当前 schema foundation

## 关键决策 9：Agent Billing 不另建第二套系统，直接落在 Accounting foundation 上

原因：

- agent billing 的本质仍然是 accounting transaction、open balance、payment application、statement
- 如果另建一套 billing store，后面一定会和 ledger、EMD、activity log 分叉
- 当前目标是 `BoldTrail / Brokermint` 风格的 brokerage back-office，不是消费级 subscription billing

影响：

- 继续复用 `AccountingTransaction` / `AccountingTransactionLineItem`
- 用 `AccountingTransactionApplication` 处理 payment / credit 对 open invoice 的应用
- 只新增最小 durable 模型：
  - `AgentRecurringChargeRule`
  - `AgentPaymentMethod`
- `/office/accounting` 现在包含：
  - overview
  - accounting transactions
  - agent billing
  - earnest money
  - chart of accounts

Trade-off：

- 现在的 `Agent Billing` 已经是真实可操作的 MVP，但仍然是人工/内部 foundation
- 没有：
  - real gateway capture
  - ACH
  - auto-charge execution
  - payroll
  - full brokerage billing suite
- 好处是后续接真实 payment provider 时，不需要把 agent ledger / statement / invoice 模型推翻重做

## 关键决策 9.25：`/office/billing` 做成当前用户自助账务页，但继续复用同一套 Accounting / Agent Billing foundation

原因：

- 当前用户确实需要看到自己欠费、已收费、已付款、credit 和 statement context
- 但这不应该再复制一套 billing store、statement store 或 payment-method store
- admin-side `Accounting / Agent Billing` 和 self-service `My Billing` 的差别主要是页面视角和权限边界，不是数据源

影响：

- `/office/billing` 只读取当前 session membership 自己的账务数据
- 继续复用：
  - `AccountingTransaction`
  - `AccountingTransactionApplication`
  - `AgentRecurringChargeRule`
  - `AgentPaymentMethod`
  - `AuditLog`
- payment-method 自助编辑只允许当前 membership 操作自己的记录
- statement 当前先做 live-generated monthly on-screen summaries，不提前引入 PDF 或 gateway integration

Trade-off：

- 当前 statement 不是 durable snapshot
- 当前没有 `Pay now` checkout
- 但这样能先把真实自助账务体验和透明度做出来，同时不把 admin accounting 模块和 self-service 模块分叉

## 关键决策 9.5：Commission Management 直接建立在 Transaction Finance + Accounting + Agent Billing 之上

原因：

- 当前已经有 transaction finance 输入字段
- accounting 已经能承载可审计的 financial rows 和 statement-like visibility
- agent billing 已经能承载 payable / balance / statement foundation
- 如果再另建一套 detached commission engine，后面会和 accounting、billing、activity log 分叉

影响：

- 新增 durable 模型：
  - `CommissionPlan`
  - `CommissionPlanAssignment`
  - `CommissionPlanRule`
  - `CommissionCalculation`
- `CommissionPlanAssignment` 允许绑定到：
  - `membership`
  - `team`
- precedence rule 明确为：
  - direct agent assignment > team assignment
  - 没有 active direct assignment 时才回退到 team assignment
- commission plan 不单独做成新 app，而是嵌在：
  - `/office/accounting`
  - transaction detail finance / commission context
  - agent profile commission summary
- 当前支持的基础规则：
  - `base split`
  - `brokerage fee`
  - `referral fee`
  - `flat fee deduction`
  - `sliding scale`
- calculation 结果会持久化，不是 UI 即时计算
- `Activity Log` 会记录：
  - commission plan created / updated
  - commission plan assigned
  - commission calculated / recalculated
  - commission statement snapshot generated

Trade-off：

- 当前已经是 durable、可审计的 commission MVP
- 但没有：
  - ACH payout execution
  - payroll / tax workflow
  - giant enterprise commission rule engine
  - 自动外部出款
- 当前 `statement_ready / payable / paid` 只是内部状态与可见性，不自动代表外部银行资金已打出

## 关键决策 10：Agent Management 建在现有 Membership / Office 身份基础上，而不是另建第二套人员系统

原因：

- agent 的身份、office 归属、角色和权限已经通过 `User + Membership + Office` 建立
- 如果另建一套 agent identity，会很快和 transactions / tasks / accounting / activity 分叉
- 当前目标是 `BoldTrail / Brokermint` 风格的 back-office agent management，不是 recruit/candidate pipeline

影响：

- 新增 durable 模型：
  - `AgentProfile`
  - `Team`
  - `TeamMembership`
  - `AgentOnboardingItem`
  - `AgentOnboardingTemplateItem`
  - `AgentGoal`
- `/office/agents` 是 roster 页面
- `/office/agents/:membershipId` 是 profile/detail 页面
- roster 现在承载管理型摘要，而不只是目录：
  - membership status
  - onboarding progress
  - transaction summary
  - goal progress
  - billing summary
- profile 页直接聚合：
  - transactions
  - tasks
  - billing summary
  - recent activity
- onboarding 被独立建模，不和 transaction tasks 混成一套
- onboarding 默认模板也被独立建模，允许按 office 上下文把标准 checklist 套到新 agent

Trade-off：

- 当前没有 recruit / candidate pipeline
- 当前没有 coaching workflow
- 当前没有 agent self-service portal
- 但后续继续扩 agent management 时，不需要推翻现有 identity / team / goals 基础

## 关键决策 10.5：Office Admin / Settings 直接建立在现有 Membership / Team / workflow foundation 之上

原因：

- 这轮要支持的 admin 能力本质上都是现有运营对象的配置面：
  - user access
  - team roster
  - required contact roles
  - transaction field rules
  - checklist templates
- 与其另建一套“只给设置页使用”的影子模型，不如直接把这些配置显式建模并复用现有主实体

影响：

- `Users` 直接复用 `Membership`
- `Teams` 继续复用 `Team / TeamMembership`
- 新增显式 settings 模型：
  - `RequiredContactRoleSetting`
  - `TransactionFieldSetting`
  - `ChecklistTemplate`
  - `ChecklistTemplateItem`
- settings 写操作进入 `Activity Log`

Trade-off：

- 当前 office access 仍然不是完整多 office ACL matrix
- 系统现在诚实支持的是：
  - 单 office access
  - org-wide access (`officeId = null`)
- 这样看起来没有某些 SaaS 那么“花”，但不会伪造未实现的 access pattern，也避免之后高成本返工

## 关键决策 10.7：Company Library 不复用旧 `Resource / Vendor` mock，而是建立独立 folder/document 模型

原因：

- `/office/library` 的目标已经明确是内部 `Company Library / Internal Document Library`，不是 vendor marketplace
- 旧的 `Resource` 列表更适合过渡期的扁平资源 feed，不适合 folder tree、file move、preview pane 这类文档工作区行为
- 如果继续把 PDF library 挤进 `Resource`，后续 folder、scope、preview 和审计都会越来越别扭

影响：

- 新增独立 Prisma 模型：
  - `LibraryFolder`
  - `LibraryDocument`
- `LibraryFolder` 明确承载：
  - organization / office scope
  - parent folder
  - sort order
  - active state
- `LibraryDocument` 明确承载：
  - folder assignment
  - original file metadata
  - local storage key
  - tags / category / visibility
  - PDF-first preview metadata
- `/office/library` 现在直接读写 Prisma，而不是再经过 `@acre/backoffice` mock feed
- library major actions 进入 `AuditLog`

Trade-off：

- 现在仓库里同时还保留旧 `Resource / Vendor` 模型，短期内会有两套“资源”概念并存
- 但这样能保持 agent/resource feed 和 office/company library 各自语义清晰，而不是继续混成一个模糊模型

## 后续接手时最需要先理解的几个决策

如果你只读这一段，也要先理解下面四点：

1. 当前系统不是“全栈已完成”，而是“前端 + API + schema + 最小 Prisma runtime + 最小本地 auth + 部分模块数据库落地”已完成
2. 当前主 API 和页面的数据仍有一部分来自 `@acre/backoffice` 的内存数据，但 `Dashboard`、`Pipeline`、`Transactions`、`Contacts`、`Tasks`、`Reports`、`Activity`、`Library`、`Accounting`、`Agent Management`、`Settings` 已不再是 mock 页面
3. `packages/db` 现在已经能 generate / migrate / seed / query，但这不代表所有页面都已经完成数据库迁移
4. 当前 auth 只是本地开发方案，不应误判为生产 auth 设计
5. 后续功能开发应优先保持模块边界，不要把 auth、db、页面逻辑重新混在一起

## 文档维护约定

从现在开始，任何影响架构边界的改动，都应该同步更新这份文件。尤其是：

- 新增数据库接入
- 新增 auth/session
- 新增外部服务
- 新增 app
- 把某个临时方案替换为正式实现
