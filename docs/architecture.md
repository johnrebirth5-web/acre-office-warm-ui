# Architecture

## 概览

当前项目是一个 `monorepo`，目标是承载 `Acre Agent OS`。它目前是一个“前端可运行、后端骨架已落、数据库 runtime 已经初始化，但主页面和主 API 仍以 mock 数据为主”的阶段。

更准确地说：

- 前端已经可运行
- API 已经存在
- API 当前以 `@acre/backoffice` 的内存数据为主，但 `Office Dashboard` 的业务指标、`Office Pipeline`、`Office Transactions`、`Office Contacts`、`Office Tasks`、`Office Reports`、`Office Performance`、`Office Notifications`、`Office Account / My Profile`、`Office Billing / My Billing`、`Office Activity Log`、`Office Library`、`Office Accounting`、`Office Agent Management` 和 `Office Admin / Settings` 已经切到 Prisma
- 数据库 schema、Prisma client、migration、seed 已接入
- 数据库现在已经覆盖主要 `Office / Back Office` 模块，但 agent/resource feed 和部分次级路径仍保留 mock 或过渡数据
- 权限模型存在，且当前已经接入一个最小本地 session
- 当前授权已不再是单纯 `membership.role -> fixed permissionMap`
- 当前真实模型是：
  - `@acre/auth` 中的静态 permission catalog
  - organization-scoped role templates
  - membership-level `allow / deny` overrides
  - team hierarchy 驱动的 `self / team / company` scope resolution
- 数据级 scope 也开始由显式 view permission 驱动，而不是只靠角色白名单
- `Office / Back Office` 的页面主线已经开始按 `Brokermint` 的后台结构收敛，其中 `Dashboard` 的业务指标、`Pipeline`、`Transactions`、`Contacts`、`Tasks`、`Approve Docs`、`Reports`、`Performance`、`Notifications`、`Account`、`Billing`、`Activity`、`Library` 已经切到真实数据库，其他页面仍主要由静态示例数据驱动
- `Transaction detail` 现在已经进入真实 workflow 阶段，除 overview / status / contacts / finance / tasks 外，还包含：
  - offers
  - documents
  - unsorted documents
  - forms / eSignature
  - commission management
- `Activity` 虽然已经是数据库驱动的真实 activity log，但当前覆盖范围仍只限于仓库里已经实现的真实写入路径；当前 documents / forms / signatures / incoming updates、部分 approvals，以及 roles / user permissions 等 settings 变更都已接入事件，但仍不是所有 settings 模块都已完整覆盖
- `Buyer Offers` 当前已经作为 transaction hub 内的真实 workflow foundation 落地，但仍是内部 Back Office offer management，不包含 MLS / email ingestion 或 client-facing portal
- `Activity` 当前还是一个受限访问的 account activity 模块，不把它当作所有 office 角色都能直接访问的普通页面；首版只允许 `office_admin` 和 `office_manager`

## 技术栈

### 前端

- `Next.js 16` App Router
- `React 19`
- `TypeScript`
- 原生 CSS，集中在 [apps/web/app/globals.css](../apps/web/app/globals.css)
- `@acre/ui` 里的轻量共享 Back Office primitives

说明：

- 当前没有引入第三方状态库
- 当前没有表单库
- 当前没有第三方 UI 框架，但已经建立内部 `Office` 设计系统：
  - 设计 tokens 在 [apps/web/app/globals.css](../apps/web/app/globals.css)
  - 共享组件在 [packages/ui/src/index.tsx](../packages/ui/src/index.tsx)
  - 规则文档在 [docs/office-design-system.md](./office-design-system.md)
- 页面主要是服务端组件 + 少量客户端导航组件
- 当前 `Back Office` 最接近真实参考的页面是：
  - [apps/web/app/office/dashboard/page.tsx](../apps/web/app/office/dashboard/page.tsx)
  - [apps/web/app/office/pipeline/page.tsx](../apps/web/app/office/pipeline/page.tsx)
  - [apps/web/app/office/transactions/page.tsx](../apps/web/app/office/transactions/page.tsx)

### 后端

- `Next.js Route Handlers` 作为当前 API 层
- `@acre/backoffice` 作为领域服务层
- `@acre/auth` 作为权限定义层
- `apps/web/lib/auth-session.ts` 作为当前本地 session 层

说明：

- 当前 API 已包含最小读写路径：
  - `Transactions`：list / detail / create / status update
  - `Contacts`：list / detail / create / edit / follow-up task create / transaction link
  - `Account`：current-membership profile update、notification preference save、self summary snapshot
  - `Library`：folder create / rename、document upload / rename / move / delete、inline preview / download
  - `Transaction detail`：finance update、linked contacts 管理、transaction tasks create / update、documents / forms / signatures、commission calculation
  - `Approve Docs`：server-side document review queue snapshot；approve / reject / reopen / complete 继续复用 transaction task workflow route
  - `Activity`：server-side 先读取真实 `AuditLog` 渲染 `Activity Log`，再由客户端请求 `/api/office/activity/alerts` 懒加载实时派生 alerts
    - `AuditLog` 是唯一活动事件源
    - 页面支持 `actor / object type / date range` 过滤
    - 事件摘要通过集中 formatter 读取结构化 payload / changes，而不是把文案散在 UI 里
    - 顶部 `Add comment` 会通过 `/api/office/activity/comments` 写入 `AuditLog`，评论和普通事件共用同一条活动流
    - `Approve Docs` 队列动作仍写入同一个 `AuditLog`，并用结构化 `actionSource=approve_docs_queue` 区分来源
    - `Operational Alerts` 仍然直接来自 transaction / task / contact / follow-up / accounting 等真实状态，但不再阻塞 page SSR
- 当前 `Pipeline` 页面已通过 server-side service 读取真实 transaction workspace 数据：
  - 顶部 workspace summary，直接汇总当前 filter context、live funnel、recent history 和当前 working list
  - 左侧 funnel summary rail
  - 右侧 unified transaction list
  - `Closed / Cancelled` 月度 rollup
  - query-param 驱动的 search / side / owner / metric mode 过滤
  - 当前 metric mode 支持：
    - `Office sales volume`
    - `Office net`
    - `Office gross`
    - `My sales volume`
    - `My gross commission`
    - `My net income`
  - `Office gross` 当前来自 transaction finance 上已存储的 `grossCommission`
  - `My gross commission` 复用同一个 `grossCommission` 字段，但只汇总当前 self / branch scope 可见的 transactions
  - stage / history 选择会直接驱动右侧 working list，并保存在 shareable URL 中
  - 当前 stage / history 选择可清除回保留 top filters 的 `all filtered transactions`
- 当前 `Reports` 页面已收口为 transaction-centric reporting workspace：
  - 同一套 server-side transaction predicate 同时驱动 filters、rows、summary 和 CSV export
  - 当前 summary 不再拼接 agent/team/accounting/EMD 多套聚合视图，而是只围绕当前筛选结果的 transaction 集合实时计算
  - 当前 shareable query-param filter contract 支持：
    - `ownerMembershipId`
    - `createdAtOperator / createdAtValue / createdAtFrom / createdAtTo`
    - `buyerTenant`
    - `closingMoveInOperator / closingMoveInValue / closingMoveInFrom / closingMoveInTo`
    - `commissionOperator / commissionValue / commissionMin / commissionMax`
    - `askingPriceOperator / askingPriceValue / askingPriceMin / askingPriceMax`
    - `purchasedPriceOperator / purchasedPriceValue / purchasedPriceMin / purchasedPriceMax`
    - `transactionStatuses[]`
    - `invoiceNumber`
    - `departmentIds[]`
    - `teamLeaderMembershipIds[]`
    - `transactionTypes[]`
    - `representingSides[]`
    - `layouts[]`
    - `companyReferral`
  - `Closing / Move-In Date` 的展示与筛选使用 `Transaction.moveInDate ?? Transaction.closingDate`
  - `Team Leader` 过滤和展示使用当前 `TeamMembership` hierarchy 计算，不依赖 retired transaction custom field
  - 当前 reports summary 只汇总当前 transaction 集合上的：
    - `Asking Price`
    - `Purchased Price`
    - `Gross Commission`
    - `Rebate`
    - `Referral`
    - `Reimbursement`
- 当前 `Performance` 页面也已切到真实数据库：
  - route 为 `/office/performance`
  - 页面直接读取 live `Transaction + TransactionFinanceFee`
  - 公式固定为 `Gross Commission - Rebate - Referral Fee - Reimbursement`
  - 周期归属使用 `moveInDate ?? closingDate`
  - 当前只统计 `Pending / Closed`
  - Agent 只能看自己的具体数字，但仍能看当前公司 Top 10 名次且隐藏他人的金额
  - Team Lead 看组内完整数字与组内排名
  - company-scope viewers 看当前公司完整数字、排名和 CSV 导出
  - 当前 CSV 导出与页面 table 共享同一份列注册表和同一份权限过滤
- 当前 `Commission Management` 已通过 Prisma service 和 route handlers 落地到：
  - `/office/accounting`
  - transaction detail
  - agent profile summary
  - 默认真源已经切到：
    - `CommissionSplitTemplate`
    - `MembershipCommissionSetting`
  - 旧 `CommissionPlan / CommissionPlanAssignment / CommissionPlanRule` 继续保留为 `Advanced settings / legacy compatibility`
  - transaction commission 默认使用：
    - owner membership 的 default split
    - `TeamMembership.reportsToTeamMembershipId` 向上的 reporting line
    - transaction `createdAt` 作为默认 split / hierarchy 的锁定口径时间
  - 计算结果继续写入 `CommissionCalculation`，但一笔 transaction 现在可以生成：
    - owner row
    - one or more upline rows
    - company row
    - optional referral row
  - commission 可见性已经接入 server-side data scope，避免通过 summary 或 hidden rows 反推上级 split
- 当前 `Office Admin / Settings` 已通过 Prisma service 和 route handlers 落地到：
  - `/office/settings`
  - `/office/settings/roles`
  - `/office/settings/users`
  - `/office/settings/teams`
  - `/office/settings/fields`
  - `/office/settings/checklists`
  - 核心复用：
    - `Membership` 做用户 role / status / office access
    - `MembershipCommissionSetting` 做 user default commission split 真源
    - `OrganizationRoleTemplate / OrganizationRoleTemplatePermission` 做 organization-scoped role templates
    - `MembershipPermissionOverride` 做 per-user allow / deny overrides
    - `Team / TeamMembership` 做 team admin
    - `RequiredContactRoleSetting / TransactionFieldSetting / TransactionCustomFieldDefinition` 做 workflow requirements 和 office-scoped transaction intake schema
    - `ChecklistTemplate / ChecklistTemplateItem` 做 checklist template admin
- 当前 `Office Library` 已通过 Prisma service 和 route handlers 落地到：
  - `/office/library`
  - 核心复用：
    - `LibraryFolder` 做 folder tree / scope / sort order
    - `LibraryDocument` 做 file metadata / folder assignment / preview metadata
    - `AuditLog` 记录 folder create / rename 和 document upload / update / delete
  - 当前 scope 仍只支持：
    - company-wide (`officeId = null`)
    - current office only (`officeId = currentOfficeId`)
    - private (`ownerMembershipId = current membership`)
  - 当前 preview 仍是 PDF-first；其他文件类型只保证 open / download
- 当前 `Office Account / My Profile` 也已通过 Prisma service 和 route handlers 落地到：
  - `/office/account`
  - `/api/office/account/profile`
  - `/api/office/account/notifications`
  - 核心复用：
    - `User` 做 name / email / phone / locale / timezone
    - `Membership` 做 self scope / role / office assignment
    - `AgentProfile` 做 avatar / license / extension / onboarding context
    - `MembershipNotificationPreference` 做当前 membership 的 inbox preference state
  - 当前 security section 只反映真实内部账号现状，不伪造 forgot-password、email delivery 或 2-step flows
- 当前 `Office Billing / My Billing` 也已通过 Prisma service 和 route handlers 落地到：
  - `/office/billing`
  - `/api/office/billing/payment-methods`
  - `/api/office/billing/payment-methods/:paymentMethodId`
  - 核心复用：
    - `AccountingTransaction` 做 charge / payment / credit ledger
    - `AccountingTransactionApplication` 做 payment / credit 对 invoice 的应用关系
    - `AgentRecurringChargeRule` 做 future recurring visibility
    - `AgentPaymentMethod` 做 masked payment-method reference foundation
    - `AuditLog` 做 billing-related recent activity
- 当前 statements 是 live-generated monthly summaries，不是 durable statement snapshots，也没有 PDF download
- 当前 `Office Accounting` 页面已经从旧 ledger/billing/EMD 工作台收口为 `office_admin` 专属的 `Agent Statements` 工作台：
  - `/office/accounting`
  - 只允许 `office_admin`
  - 基于 `CommissionCalculation` 的 agent rows 生成 durable `AgentPayoutStatement` / `AgentPayoutStatementLine`
  - 当前按 transaction `invoiceNumber` 选择 candidate invoices，再预览/微调这些 invoice 下的 agent rows；`payable / paid` rows 也允许重新生成新的 statement snapshot，但不会把 `paid` 状态降级
  - 新生成的 statement 会把 `periodBasis` 保存为 `invoice_number`，并仅把 `periodStart / periodEnd` 当作兼容展示字段
  - 生成后可直接下载 PDF
  - 当前 payment-method self-service 只允许当前 membership 操作自己的方法记录，不允许跨成员编辑
- 当前已有最小本地登录 / 登出 / cookie session
- agent-management / user profile 现在会把 default commission split 作为结构化字段编辑，而不是自由文本 plan 名称
- 生产环境下 `ACRE_SESSION_SECRET` 现在应视为必填，不再继续回退到仓库内开发默认值
- 当前已经有 transaction、contact、task、activity、library、accounting、agent management、settings 等模块的 service-to-db 数据访问层
- 当前 dashboard 业务指标也已有最小查询 service
- 当前 transaction documents 和 office library documents 都使用本地文件系统 storage adapter，metadata 和 workflow 放在 Prisma
- 当前单 Droplet 生产默认 document storage root 是 `/var/lib/acre/documents`，新写入的 storage key 以该 root 下的相对路径保存
- 当前没有 worker、queue、cron

### 数据库

- `PostgreSQL`
- `Prisma schema` 已定义在 [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma)
- `Prisma client` 入口在 [packages/db/src/client.ts](../packages/db/src/client.ts)
- 最小数据库读取 utility 在 [packages/db/src/bootstrap.ts](../packages/db/src/bootstrap.ts)

说明：

- 已有 runtime Prisma client 接入
- 已有初始 migration 基线
- 已有 seed workflow
- 当前已经有本地 auth 查询路径，以及 transactions / contacts / tasks / notifications / account / activity / library / accounting / agents / settings 等真实持久化读写路径

## Office 设计系统

`Office / Back Office` 当前已经不再按页面各自决定视觉规则，而是使用统一设计系统：

- 主字体：通过 root layout 全局加载的 `Inter`
- tokens：集中在 [apps/web/app/globals.css](../apps/web/app/globals.css)
- primitives：集中在 [packages/ui/src/index.tsx](../packages/ui/src/index.tsx)
- 详细规则：见 [docs/office-design-system.md](./office-design-system.md)

当前统一的核心对象包括：

- page shell / page header
- section card / detail section
- filter bar
- data table
- form fields / inputs / buttons
- status badges
- Back Office navigation

这套系统当前优先解决的是：

- 页面间字体、间距、按钮、表格和 detail section 的漂移
- `Dashboard / Transactions / Contacts / Tasks / Activity / Accounting / Reports / Pipeline` 之间的产品割裂

### 第三方服务

当前真实接入状态：

- `GitHub`：已接入，当前默认远程目标是 `https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
- `DigitalOcean`：已接入，当前默认生产入口是 `https://acresystem.us/`，登录入口是 `https://acresystem.us/login`，服务是 `acre-ui-rebuild-web.service`
- `Vercel`：历史上可能存在绑定，但不是当前默认部署目标
- `PostgreSQL / Prisma runtime`：代码已接入，本机已验证 local migrate + seed + query，但主页面和主 API 尚未切换到数据库
- 对象存储：未实现
- OCR / AI / 外部地产系统集成：未实现

补充说明：

- 当前文档文件不是接入 S3 / R2，而是本地文件系统 MVP
- `Company Library` 也复用同一套本地文件系统存储基础，但按 organization / library scope 单独分目录
- 当前 eSignature 已升级为 transaction detail 内的外部签署 MVP：
  - 内部准备工作区 + 公共签署页仍由本仓库自托管
  - 邮件发送通过 SMTP 环境变量配置
  - 仅支持 PDF、单签署人、无登录公开链接
  - 还没有第三方 vendor integration
- 当前 incoming updates 不是 live Folio sync，而是内部 review-ready model；底层 route/service 仍保留，但默认不在 transaction detail 页面暴露

不要把“规划中”当成“已接入”。

## 模块划分

### `apps/web`

职责：

- 页面路由
- API 路由
- Agent / Office 的界面层
- 把 `@acre/backoffice` 和 `@acre/auth` 的数据渲染出来

关键目录：

- [apps/web/app](../apps/web/app)
- [apps/web/app/api](../apps/web/app/api)

### `packages/backoffice`

职责：

- 当前最核心的业务数据入口
- 提供页面和 API 共用的读取函数
- 定义当前示例数据的 shape

注意：

- 它现在既承担“领域模型定义”，又承担“临时 mock 数据源”
- 未来很可能要拆成更清晰的 domain modules

当前主要导出：

- organization / offices / members
- listings / clients / events / notifications / resources / vendors
- transactions / legacy pipeline snapshot helpers
- `getAgentDashboardSnapshot`
- `getOfficeDashboardSnapshot`
- `listListings`
- `listClients`
- `listEvents`
- `listResources`
- `listTransactions`
- `getApiCatalog`

### `packages/auth`

职责：

- 定义角色
- 定义权限项
- 提供角色到权限的映射

当前作用范围：

- 页面展示
- API 返回 access summary
- organization role templates + membership overrides 共同决定 effective permissions
- 当前也承载 `Back Office` 审核相关权限，例如：
  - `documents:approve`
  - `tasks:review`
  - `tasks:review:secondary`

未实现：

- 自定义角色创建
- 全模块最细粒度业务动作的完整等价实现

### `packages/db`

职责：

- 定义数据库 schema
- 提供可复用 Prisma client
- 提供 migration / seed workflow
- 提供最小数据库读取 utility
- 明确未来持久化边界

当前覆盖的核心实体：

- `Organization`
- `Office`
- `User`
- `Membership`
- `Listing`
- `ListingAsset`
- `ListingShareLink`
- `Client`
- `AgentProfile`
- `AgentBankInformation`
- `Team`
- `TeamMembership`
- `AgentOnboardingItem`
- `AgentGoal`
- `RequiredContactRoleSetting`
- `TransactionFieldSetting`
- `TransactionCustomFieldDefinition`
- `ChecklistTemplate`
- `ChecklistTemplateItem`
- `FollowUpTask`
- `TransactionTask`
- `TaskListView`
- `Notification`
- `Event`
- `EventRsvp`
- `Resource`
- `LibraryFolder`
- `LibraryDocument`
- `Vendor`
- `AuditLog`
- `LedgerAccount`
- `AccountingTransaction`
- `AccountingTransactionLineItem`
- `GeneralLedgerEntry`
- `EarnestMoneyRecord`
- `CommissionPlan`
- `CommissionPlanAssignment`
- `CommissionPlanRule`
- `CommissionCalculation`
- `TransactionDocument`
- `FormTemplate`
- `TransactionForm`
- `SignatureRequest`
- `IncomingUpdate`
- `Offer`
- `OfferComment`

当前已提供的数据库运行时入口：

- `prisma`
- `getPrismaClient`
- `getSeededWorkspaceSnapshot`
- `getOfficeDashboardBusinessSnapshot`
- `getOfficeActivityLogSnapshot`
- `getOfficePipelineWorkspaceSnapshot`
- `listTransactions`
- `getTransactionById`
- `createTransaction`
- `updateTransactionStatus`
- `listContacts`
- `getContactById`
- `createContact`
- `updateContact`
- `createFollowUpTask`
- `linkContactToTransaction`
- `listTransactionTasks`
- `listOfficeTasks`
- `listTaskListViews`
- `createTransactionTask`
- `updateTransactionTask`
- `completeTransactionTask`
- `reopenTransactionTask`
- `requestTransactionTaskReview`
- `approveTransactionTask`
- `rejectTransactionTask`
- `saveTaskListView`
- `getOfficeReportsSnapshot`
- `getOfficeAccountingSnapshot`
- `getOfficeCommissionManagementSnapshot`
- `getTransactionCommissionSnapshot`
- `getAgentCommissionSummary`
- `saveCommissionPlan`
- `assignCommissionPlanToMembership`
- `calculateTransactionCommission`
- `updateCommissionCalculationStatus`
- `generateCommissionStatementSnapshot`
- `createAccountingTransaction`
- `updateAccountingTransaction`
- `createEarnestMoneyRecord`
- `updateEarnestMoneyRecord`
- `listTransactionDocumentsSnapshot`
- `createTransactionDocument`
- `updateTransactionDocument`
- `deleteTransactionDocument`
- `prepareTransactionFormDraft`
- `createTransactionForm`
- `updateTransactionForm`
- `createSignatureRequest`
- `updateSignatureRequest`
- `getSignatureEditorSnapshot`
- `replaceSignatureRequestFields`
- `getPublicSignatureRequestSnapshot`
- `listTransactionOffersSnapshot`
- `createOffer`
- `updateOffer`
- `transitionOfferStatus`
- `createOfferComment`
- `createIncomingUpdate`
- `reviewIncomingUpdate`
- `getOfficeAgentsRosterSnapshot`
- `getOfficeAgentProfileSnapshot`
- `saveAgentProfile`
- `createAgentTeam`
- `updateAgentTeam`
- `addAgentToTeam`
- `removeAgentFromTeam`
- `createAgentOnboardingItem`
- `updateAgentOnboardingItem`
- `createAgentGoal`
- `updateAgentGoal`

## 关键数据流

### 当前数据流

现在的主要请求链路是：

1. 请求进入 `apps/web`
2. 如果是 `/office/*`，layout 先解析本地 session
3. 页面/API 调用 `@acre/backoffice` 或 `@acre/db`
4. service 返回 DTO
5. 页面渲染或 API 返回 JSON

也就是说，当前主业务页面还没有：

- 远程 API 调用
- 缓存层

当前 `Back Office` 页面读取路径大致是：

1. `/office/dashboard` 先读取当前 office session，再调 `@acre/db` 的 `getOfficeDashboardBusinessSnapshot`
2. `/office/activity` 先读取当前 office session，再调 `@acre/db` 的 `getOfficeActivityLogSnapshot`
3. `/office/activity` 在当前 view 包含 alerts 时，再由客户端调用 `GET /api/office/activity/alerts` 获取 `getOfficeOperationalAlertsSnapshot`
4. `/office/pipeline` 调 `@acre/db` 的 `getOfficePipelineWorkspaceSnapshot`
5. `/office/transactions` 调 `@acre/db` 的 transaction service，并按 query-param 驱动的 `q / status / ownerMembershipId / teamId / type / startDate / endDate / page / pageSize` 做服务端过滤和分页
6. `/office/transactions` modal、`/office/transactions/new` 页面和 transaction detail intake editor 共享同一份 office-scoped transaction intake schema，来自 `getOfficeTransactionIntakeSchema`
7. `/office/transactions` 内的客户端 modal 调 `/api/office/transactions` 写入数据库；`GET /api/office/transactions` 也接受同一组 list-side query params
8. `/office/transactions/:transactionId` 调 `getTransactionById`
9. detail 页面通过 `/api/office/transactions/:transactionId` 更新 status
10. detail 页面通过 `/api/office/transactions/:transactionId/intake` 更新 built-in/custom intake 字段
11. detail 页面通过 `/api/office/transactions/:transactionId/finance` 更新最小 finance 字段
12. detail 页面通过 transaction contact routes 做 link / unlink / set primary
13. detail 页面通过 transaction task routes 做 create / edit / complete / reopen / request review / approve / reject，并按 linked document / signature / approval truth 决定任务是否真正可 complete
14. `/office/contacts` 调 `@acre/db` 的 contact service，并按 query-param 驱动的 `q / stage / page / pageSize` 做服务端过滤和分页；contacts 读路径现在也复用 office/team/self data scope，而不是默认给整个 organization 同一份列表
15. `/office/contacts` 和 `/office/contacts/:contactId` 通过 contacts API 做 create / edit / follow-up task / transaction link；`GET /api/office/contacts` 也接受 `q / stage / page / pageSize`，且 detail 内的 linked/available transaction 选项会按当前 transaction visibility scope 收窄
16. `/office/reports` 调 `@acre/db` 的 reports service，返回 query-param 驱动的 transaction reporting workspace snapshot，统一输出 `filters / rows / summary / totalCount / export columns`
17. `/office/accounting` 调 `@acre/db` 的 agent-payout-statement service，返回 agent options、invoice options、所选 invoice 对应的 candidate commission rows、saved statement history 和 selected statement detail；selected statement 的 durable line snapshot 额外固化 transaction creation date、invoice / owner / building / unit 和 payout commission rate
18. `/office/settings/commission-plans` 调 commission service，返回 plan list、assignment list、commission queue 和 statement snapshot
19. `/api/office/accounting/transactions` 与 `/api/office/accounting/earnest-money` 负责最小 create / update 写入；posting 成功后同步生成 GL entries 和 `AuditLog`
20. `/api/office/accounting/commissions/*` 与 `/api/office/transactions/:transactionId/commissions/calculate` 负责 commission plan、assignment、calculation、status、statement snapshot 的最小写入，并同步写入 `AuditLog`
21. `/office/activity` 的 activity stream 来自 `AuditLog`，alerts 则由 `/api/office/activity/alerts` 在客户端按需读取并结合 transaction / task / contact / follow-up / accounting / EMD / commission 的实时数据库状态派生
22. transaction / contact / finance / task / accounting / EMD / commission 的真实写入路径会同步写入 `AuditLog`
23. auth login / logout 和 follow-up task create 也会写入 `AuditLog`
24. `/office/activity` 顶部的内部评论也会写入 `AuditLog`，并出现在同一条 stream 里
25. `/office/activity` 的左侧分类来自真实 action taxonomy，不是静态菜单
26. `GET /api/office/reports/export` 复用与 `/office/reports` 相同的 filter contract、column registry 和 session scope，导出与页面 table 一致的真实 transaction CSV
27. `/office/tasks` 读取 `TransactionTask + TaskListView`，按 built-in view、saved view 和 query-param filters 返回真实任务列表
28. `/office/tasks` 的 create / edit / complete / reopen / request review / approve / reject 都直接写数据库，并同步写入 `AuditLog`
29. document-linked tasks 会根据真实 workflow evidence 推导 task status，例如：
   - pending upload
   - uploaded / not submitted
   - review requested
   - second review requested
   - approved
   - rejected
   - waiting for signatures
   - fully signed
   - complete
26. secondary approval 当前已实现，并要求 second approver 与 first approver 必须是不同 membership
27. 删除 required document、取消提交条件或让签名重新变成未完成时，会触发 task workflow 重新评估并必要时 reopen
28. `/api/office/tasks/views` 以 membership 维度持久化 saved views
29. transaction detail 的 documents / forms / signatures，以及隐藏中的 incoming update foundation，统一通过 `packages/db/src/transaction-documents.ts` 读取和写入
30. document signature editor 通过 `/api/office/transactions/:transactionId/signatures`、`/api/office/transactions/:transactionId/signatures/:signatureRequestId` 和 `/api/office/transactions/:transactionId/signatures/:signatureRequestId/fields` 保存 signer metadata、状态和签区布局
31. 外部签署人通过 `/sign/:token` 和 `/api/public/signatures/:token*` 访问公开签署页面、读取 PDF 预览、提交签字并触发 signed PDF 归档
32. 文件本体当前通过 `apps/web/lib/document-storage.ts` 写入本地文件系统；document metadata 仍在 PostgreSQL
33. document / form / signature / incoming update 的关键动作会写入 `AuditLog`，外部签署时间线额外写入 `SignatureAuditEntry`
34. buyer offers 继续落在 transaction hub 内，不另建第二个 offer app；offer 的 documents / forms / signatures 直接复用现有 foundation，并通过 `offerId` 做 linkage
35. offer workflow 当前支持显式状态迁移、internal comments、comparison，以及 accepted offer -> transaction field 的可见回写
36. `/office/transactions/:transactionId` 还会通过 `getTransactionCommissionSnapshot` 读取 assigned plan、persisted calculations 和 transaction-level summary
37. `/office/settings/users/:membershipId` 的 operations 区块会通过 `getAgentCommissionSummary` 聚合 active plan、recent calculations、statement-ready / payable / paid totals
38. `Activity Log + Operational Alerts` 现在也会显示：
   - missing required document
   - signature pending
   - incoming update awaiting review
   - tasks awaiting your review
   - tasks awaiting second review
   - rejected tasks needing action
   - offers awaiting review
   - offers expiring soon
39. `/office/settings/users?view=operations` 读取 `AgentProfile / AgentBankInformation / Team / TeamMembership / AgentOnboardingItem / AgentGoal / AgentOnboardingTemplateItem`，并聚合 transactions / tasks / billing / activity 数据形成 operational roster snapshot
40. roster snapshot 当前会额外提供：
   - membership status
   - onboarding progress label
   - open / recent closed transaction rollups
   - goal progress summary
   - billing summary label
   - team-level open task / open transaction / onboarding in-progress counts
41. `/office/settings/users/:membershipId` 组合 access snapshot 和 profile snapshot，展示 basics、teams、onboarding、goals、recent transactions、recent activity，并额外聚合 operational agenda、current goal summary、open/pending charges、commission summary
42. `/api/office/agents/*` 负责 profile、team、onboarding、goal 的最小 create / update 写入，并同步写入 `AuditLog`
43. `/api/office/agents/:membershipId/onboarding-template` 会把 office 范围内的默认 onboarding 模板条目实例化到具体 agent
44. Dashboard 的 weekly updates / useful links / training links 仍使用静态内容
45. 其他页面仍然直接把静态 DTO 渲染成后台 UI

当前唯一已经走数据库的最小读路径是：

1. `/api/db/seeded-context`
2. route 调 `@acre/db` 的 `getSeededWorkspaceSnapshot`
3. utility 通过 Prisma 查询 organization / office / memberships / users
4. 返回 seed 后的数据库快照 JSON

当前本地 auth 的主要链路是：

1. 管理员在 `/office/settings/users` 创建 invited user，系统生成 hashed invitation token 和 copyable link
2. invited user 打开 `/invite/[token]`，设置 password，membership 从 `invited` 变为 `active`
3. 用户在 `/login` 提交 email + password
4. `/api/auth/login` 通过 `@acre/db` 校验 credential、failedLoginCount、lockedUntil
5. 成功后服务端写入 signed cookie session
6. `/office/*` layout 读取 session，并在服务端拿到 current user / membership / organization / office / credential
7. 未登录用户重定向到 `/login`；must-change-password 用户重定向到 `/change-password`
8. `/api/office/dashboard` 读取当前 session context，而不是硬编码角色

### 未来预期数据流

暂定方案：

1. 请求进入 `apps/web`
2. session / auth middleware 解析当前用户和组织
3. route handler 调用领域 service
4. 领域 service 通过 `@acre/db` 的 Prisma runtime 访问 PostgreSQL
5. 返回 DTO 给页面或 API

这个链路只完成了最小数据库 probe，主页面和主 API 还没有全部切换。

## 核心业务逻辑

从当前项目目标看，后续最核心的业务逻辑不在 UI，而在下面这些领域：

### 1. 多组织 / 多 office

项目不是单一公司后台。当前 mock 数据里已经体现了多公司结构：

- Acre NY Realty Inc
- Acre NJ LLC
- Acre NY Rentals LLC

这意味着后续任何真实数据接入，都必须优先考虑：

- organization scope
- office scope
- membership scope

如果这里处理错，最容易出权限和数据串线问题。

### 2. 角色和权限

当前 Back Office 已切到分层角色模型：

- `owner`
- `office_admin`
- `accountant`
- `human_resources`
- `team_lead`
- `agent`
- 兼容保留：`office_manager`、`office_user`

权限不再只是静态页面映射。当前实现要求：

- broad role 放在 `Membership.role`
- team hierarchy 放在 `TeamMembership.role`
- 直属关系放在 `TeamMembership.reportsToTeamMembershipId`
- 真实可见范围和财务脱敏统一下沉到 server-side scope resolver，而不是散落在页面组件里

### 3. Listings 是系统核心

从 PRD 和当前页面结构看，`listings` 不是普通内容列表，而是整个系统的数据中轴：

- agent 端依赖 listings 做营销和分享
- office 端依赖 listings 做 intake / review / publish
- public site 后续也会依赖 listings

这部分以后最可能演化为系统最重要的核心模块。

### 3.5 Transactions 是当前 Back Office 的主轴

按用户最新范围定义，当前阶段优先复刻的是 `Brokermint` 的 `Back Office`，不是 Acre 全平台所有模块。因此当前最重要的 UI/业务主轴是：

- `Dashboard`
- `Pipeline`
- `Transactions`
- `Contacts`
- `Reports`
- `Activity`
- `Library`
- `Accounting`

其中真正最需要优先落成真实数据的，是 `Transactions`、`Contacts` 以及它们关联出来的 `Pipeline`、`Reports`。

### 3.6 Company referral / commission rule 是当前已确认的真实业务规则

来自本地 PDF [____CRM_____Agent__.pdf](../____CRM_____Agent__.pdf) 的已确认规则：

- 创建交易时要支持 `Company Referral`
- 需要有 `Company Referral Employee's Name`
- 要支持 `Add agent / commission`
- 客服推单默认 `20%`
- 代运营成单默认 `10%`
- 特定来源还要求额外添加特定参与方，例如 `Guangzhou Huihe`、`Feitong Zhao`

这意味着 `Create Transaction` 以后不能只是基础交易表单，还必须包含 referral source 和 commission participant 的业务层逻辑。

### 4. CRM / Follow-up / Notifications 是 agent 和 office 的连续工作流

CRM 当前已经开始从 `Office Contacts` 落地最小真实实现，但整体仍远未完整。从 schema 看已经有明确方向：

- client
- follow_up_task
- notification

当前已经落地的最小闭环包括：

- contact list / create / edit
  - contact list 现在不再把全量结果拉到客户端内存过滤，而是由服务端按 URL 参数返回分页结果
- contact detail
- follow-up task create / list
- `TransactionContact` -> transaction/contact relation
- `Transaction.primaryClientId` 兼容同步
- transaction detail contacts section:
  - list linked contacts
  - link existing contact
  - unlink linked contact
  - set primary linked contact
- transaction finance section:
  - `grossCommission`
  - `referralFee`
  - `officeNet`
  - `agentNet`
  - `financeNotes`
  - 当前直接存放在 `Transaction` 行上，而不是独立 finance 子系统
- `Office Tasks` 现在已经从 transaction detail 内嵌区块扩成独立模块：
  - `TransactionTask`
  - `TaskListView`
  - built-in views:
    - `Requires attention`
    - `All transactions`
  - per-membership saved views
  - filters:
    - transaction status
    - assignee
    - due window
    - no due date
    - compliance status
    - transaction
    - keyword search
  - 最小合规工作流字段：
    - requires document
    - requires review
    - requires secondary approval
    - review status
    - compliance status
  - 任务动作：
    - create
    - edit
    - complete
    - reopen
    - request review
    - approve
    - reject
  - workflow 规则：
    - required document 必须真实存在
    - 需要 review 的任务必须先提交 review 才能继续
    - secondary approval 由不同于 first approver 的第二个 approver 完成
    - approval 与 final completion 是两步，不自动混成一个状态
    - document/signature 条件失效时，任务会被重新评估并必要时 reopen
  - transaction detail tasks section 与 `/office/tasks` 共用同一套数据库和 service，不另建第二套 task 系统

更高级的 CRM 自动化、提醒编排、批量任务、线索分配仍未实现。

### 5. Accounting 当前是 foundation + admin payout workspace

`Accounting` 的底层 foundation 仍然是 transaction-side accounting，但 `/office/accounting` 的当前页面入口已经收口成 `office_admin` 专属的 agent payout workspace：

- 目标是支持 brokerage / agent / transaction 相关的 accounting workflow
- 不是 QuickBooks 替代品
- 也不是全公司运营会计平台

当前落地的数据基础：

- `LedgerAccount`
- `AccountingTransaction`
- `AccountingTransactionLineItem`
- `GeneralLedgerEntry`
- `EarnestMoneyRecord`
- `AccountingTransactionApplication`
- `AgentRecurringChargeRule`
- `AgentPaymentMethod`
- `AgentPayoutStatement`
- `AgentPayoutStatementLine`

当前支持的 accounting transaction types：

- `invoice`
- `bill`
- `credit_memo`
- `deposit`
- `received_payment`
- `made_payment`
- `journal_entry`
- `transfer`
- `refund`

当前 posting 层仍然是显式规则，不是通用 accounting engine：

- `invoice`
- `received_payment`
- `bill`
- `made_payment`
- `deposit`
- `refund`
- `credit_memo / journal_entry / transfer` 走 line items + balanced entry 规则

当前 EMD workflow 也是真实的：

- expected amount
- received amount
- refund / distribution
- ledger-tracked optional posting

当前 `/office/accounting` 页面只负责：

- 选择一个 agent
- 加载该 agent 当前 eligible rows 上已有的 `invoiceNumber` 候选
- 按 invoice number 自由多选
- 预览这些 invoice 下的 agent commission rows，并允许取消个别行
- 生成 durable payout snapshot
- 直接导出 PDF
- 打开已保存 statement detail 时额外读取当前 membership 的 `AgentBankInformation`，在 generated metadata 与 line items 之间展示 payout / tax reporting bank info
- statement detail / PDF 当前只保留 gross / agent-facing payout summary，不向 agent statement 输出 `Office net`
- statement detail / PDF 的 line items 现在按 `Creation date / Invoice number / Owner / Building name / Unit / Gross / Pre split / Commission rate / Post split detail / Net commission` 展示；`Post split detail` 会保留总额并列出 `External Referral / Company Referral` 的命名明细；PDF 为适配扩展列改成 landscape table layout

### 6. Agent Billing 建在现有 Accounting foundation 上，不另建第二套 billing 系统

`Agent Billing` 当前不是独立 app，也不是第二套账务系统，但它现在主要作为底层 foundation 和 `/office/billing` 的数据来源存在，而不是 `/office/accounting` 的当前页面主模块。

这样做的原因是：

- agent billing 的 invoice / payment / credit / balance，本质上仍然是 accounting transaction
- 如果单独再建一套 billing store，后面 ledger / statement / activity log 会双轨
- 参考目标是 `BoldTrail / Brokermint` 的 back-office agent billing，不是消费级订阅计费

当前实现方式：

- 继续复用：
  - `AccountingTransaction`
  - `AccountingTransactionLineItem`
  - `GeneralLedgerEntry`
- 用 `AccountingTransactionApplication` 表达 payment / credit 对 invoice 的应用关系
- 用 `AgentRecurringChargeRule` 表达 recurring charge rule
- 用 `AgentPaymentMethod` 表达 masked payment method foundation

当前底层 Agent Billing foundation 支持：

- overview cards
- agent ledger
- one-time charges
- recurring billing rules
- payment methods
- record payment
- apply credit memo
- statement snapshot

当前明确没做的部分：

- real payment gateway capture
- ACH / autopay execution
- payroll
- broad office operational accounting
- QuickBooks sync

所以页面里如果看到 `card on file`，应理解为：

- 这是 payment method foundation
- 不是已经接通自动扣款
- refunded / distributed amount
- due date / payment date / deposit date
- held by office / held externally
- optional ledger posting

### 6.5 Commission Management 建在现有 Transaction Finance + Accounting + Agent Billing foundation 上

`Commission Management` 当前不是独立 app，也不是脱离 accounting 的单独佣金工具，而是建立在：

- transaction finance inputs
- accounting transaction / ledger foundation
- agent billing / statement foundation

之上。

这样做的原因是：

- transaction 侧已经有 `grossCommission / referralFee / officeNet / agentNet`
- accounting 已经能承载 invoice / payment / statement-ready visibility
- 如果再单独做一套 detached commission store，后面一定会和 accounting / billing / activity log 分叉

当前实现方式：

- durable 模型：
  - `CommissionPlan`
  - `CommissionPlanAssignment`
  - `CommissionPlanRule`
  - `CommissionCalculation`
- `CommissionPlanAssignment` 现在可绑定到：
  - `Membership`
  - `Team`
- precedence：
  - direct agent assignment 优先
  - team assignment 作为 fallback
- 基础 rule types：
  - `base_split`
  - `brokerage_fee`
  - `referral_fee`
  - `flat_fee_deduction`
  - `sliding_scale`
- transaction detail 提供 commission section：
  - assigned plan
  - calculation inputs
  - persisted outputs
  - recalculate
- `/office/settings/commission-plans` 提供 primary commission management area：
  - plan list
  - assignment list
  - team-aware assignment targets
  - team filter
  - calculation queue
  - statement snapshot
- agent profile 提供 commission summary：
  - active plan
  - active plan source
  - recent calculations
  - statement-ready totals
  - payable / paid totals

当前 commission status：

- `draft`
- `calculated`
- `reviewed`
- `statement_ready`
- `payable`
- `paid`
- `paid`

当前明确没做的部分：

- ACH / bank payout execution
- external payroll / tax workflow
- giant enterprise commission engine
- full automatic bridge into external transfer rails

所以页面里如果看到：

- `statement ready`
- `payable`
- `paid`

应理解为：

- 这是系统内部的 calculation / readiness / bookkeeping status
- 不是自动代表外部银行转账已经完成

### 7. Agent Management 复用 Membership 作为身份主轴，只补必要的 profile / team / onboarding / goal 模型

当前不再保留顶层 `/office/agents` 作为 canonical UI；agent management 能力已经并入 `Settings / Users`，但底层模型仍是独立的 operational foundation。

这样设计的原因是：

- `User / Membership / Office` 已经承担了 agent 身份、角色、权限和 office 归属
- 如果再单独做一套 agent identity，会和 transactions / tasks / accounting / activity 分叉
- 当前目标是 `BoldTrail / Brokermint` 风格的 Back Office Agent Management，不是 recruit/candidate pipeline

当前实现方式：

- `AgentProfile` 只补 membership 侧扩展字段：
  - display name
  - license info
  - start date
  - onboarding status
  - commission plan name
  - bio / notes
- `AgentBankInformation` 承载 membership 级 payout / tax reporting intake：
  - first / last name
  - email / phone
  - complete address
  - bank name / account number / routing number
  - tax reporting ID type + value
  - date of birth
  - account type
  - 当前在 `agents:manage` 查看者的 operational profile snapshot 中返回，同时也允许 membership 本人查看和维护自己的这组敏感字段；其他普通 profile readers 仍不会拿到这些值
- `Team / TeamMembership` 提供最小 team roster foundation
- `AgentOnboardingItem` 作为独立 onboarding checklist，不和 transaction tasks 混成一套
- `AgentOnboardingTemplateItem` 作为组织级/office 级默认 onboarding 模板条目，避免每个 agent 从零创建 checklist
- `AgentGoal` 提供月 / 季 / 年目标，并尽量从 transactions / accounting 派生实际进度
- `/office/settings/users?view=operations` 作为管理 roster，会集中展示 onboarding progress、goal progress、transaction summary、billing summary、membership status
- `/office/settings/users/:membershipId` 聚合 profile basics、bank information、teams、onboarding、goals、recent transactions、billing summary、recent activity，并额外展示 operational agenda 和 template defaults

当前明确没做的部分：

- recruit / candidate pipeline
- coaching workflow
- agent self-service portal
- 更复杂的 commission-plan editor

### 7.5 Office Admin / Settings 建在现有 Membership / Team / workflow foundation 之上

原因：

- Back Office 里真正需要 admin 可配置的对象，本质上就是现有运营模型的配置面
  - 当前最需要被配置的是：
  - user role / status / office access
  - team rosters
  - required contact roles
  - module field requirements for transaction / contact / offer
  - built-in transaction dropdown option labels / availability for `Type / Status / Representing`
  - custom fields for transaction / contact / offer
  - checklist templates
- 这些都已经有清晰的领域主轴，不值得再造一套 admin-only 影子模型

当前实现方式：

- `Users`：直接复用 `Membership`
- `Teams`：直接复用 `Team / TeamMembership`
- `Fields`：新增显式 settings 模型
  - `RequiredContactRoleSetting`
  - `TransactionFieldSetting`
  - `TransactionCustomFieldDefinition`
  - `ContactFieldSetting`
  - `ContactCustomFieldDefinition`
  - `OfferFieldSetting`
  - `OfferCustomFieldDefinition`
  - `Client.additionalFields`
  - `Offer.additionalFields`
- `Checklists`：新增显式模板模型
  - `ChecklistTemplate`
  - `ChecklistTemplateItem`
- settings 相关变更写入 `Activity Log`

当前字段平台实现约束：

- `Settings > Fields` 是唯一 schema 管理入口
- transaction / contact / offer 业务页只按当前 schema 渲染并保存值
- transaction 保留 required contact roles 和 `Type / Status / Representing` dropdown option 管理，但都已集中到 `Fields` 页面

已知边界：

- 当前 office access 不是完整多 office ACL matrix
- 真实支持的只有：
  - 单 office membership
  - 或 `officeId = null` 的 org-wide access
- 这比“伪装成支持多个 office access”更诚实，也避免后续回收错误产品假设

故意没做的范围：

- QuickBooks sync
- bank reconciliation
- payroll
- office-rent / utilities accounting
- ACH payouts / payment gateways
- 完整 commission-plan engine

## 最容易改出问题的地方

### 1. 把 mock 数据当成正式数据层

当前 `@acre/backoffice` 很方便，但它本质上还是临时数据源。后续接数据库时，最容易出现的问题是：

- 页面直接耦合到 mock 字段
- API 和页面各自写一套转换逻辑
- 新旧 DTO 不一致

建议：

- 在接数据库前先定义清楚 DTO 边界
- 保持页面只依赖 service 输出，不直接依赖底层 schema

### 2. 权限逻辑下沉到页面

当前页面里已经有 role summary 展示，但还没有真正做权限拦截。后续很容易有人为了“先跑起来”直接在页面组件里写 if/else。

建议：

- 权限判断统一放在 `@acre/auth` 和 server-side service 层
- 页面只消费“已经过滤好的能力”

### 3. Listings 既服务内部又服务外部

同一份 listings 数据未来既要服务内部 agent/office，又可能服务 public website。最容易出错的点是：

- public/private 字段边界
- SEO 字段和内部字段混杂
- 营销文案与后台原始数据耦合

建议：

- 明确区分内部模型、外部展示模型、营销输出模型

### 4. 数据库 runtime 已有，但主读取链路还没有切换

后续第一位接手者最容易误判“既然有 Prisma client 和 seed，就说明页面已经接数据库”。实际上现在只有 `Dashboard` 的业务指标、`Pipeline`、`Transactions`、`Contacts`、`Reports` 这几条线已经接数据库，其他主页面大多还没有。

建议：

- 先通过最小 query utility 明确 DTO 形状
- 再逐步替换 `@acre/backoffice` 的内存数据

## 后续扩展推荐入口

如果你要继续实现真实功能，建议按这个顺序推进：

1. `auth/session`
2. `organization + office context`
3. 把更多读取路径接到 `@acre/db`
4. `listings CRUD`
5. `clients + follow_up_tasks`
6. `notifications + events`
7. `resources + vendors`
8. 文件、OCR、AI、外部集成

原因：

- 先把用户上下文和组织边界定住，后面不容易返工
- listings 和 CRM 是最核心的业务价值
- 其他模块大多依赖这些基础数据结构

## 给维护者的建议

如果你是第一次接手，不要直接“开始加页面”。先确认：

- 你的改动是临时展示层改动，还是会进入长期业务模型
- 你是否需要先改 `@acre/backoffice`
- 你是否需要同步改 `@acre/auth` 或 `packages/db/prisma/schema.prisma`
- 文档是否需要同步更新

这个项目当前还在“把架构方向钉稳”的阶段。稳定边界比快速堆页面更重要。
