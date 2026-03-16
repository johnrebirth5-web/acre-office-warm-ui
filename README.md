# Acre

`Acre` 是一个面向房地产经纪公司内部团队的 Web 工作台。当前仓库实现的是 `Acre Agent OS` 的第一版工程骨架，服务对象是：

- `Agent`：一线经纪人，使用 listings、轻 CRM、活动通知、资源库、AI 工具
- `Office Team`：运营/管理人员，当前重点是 `Back Office`，参考 `Brokermint` 的 `Dashboard / Pipeline / Transactions / Contacts / Reports / Notifications / Account / Billing / Activity / Library / Accounting`

这不是客户前台网站。客户前台后续会是独立 surface，复用这里的 listings 和后台数据能力。

## 当前唯一工作基线

当前默认按这一套口径工作，除非任务明确说明要切到别的环境：

- 本地源码目录：`/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean`
- 默认本地浏览器入口：`http://localhost:3105/`
- 默认 GitHub 仓库：`https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
- 默认外部入口：`http://acresystem.us/`
- 默认外部登录入口：`http://acresystem.us/login`
- 默认 DigitalOcean 直连入口：`http://45.55.247.137:3105/`
- 默认服务器应用目录：`/opt/acre-ui-rebuild/app`
- 默认服务器环境文件：`/etc/acre/acre-ui-rebuild.env`
- 默认 systemd 服务：`acre-ui-rebuild-web.service`
- 旧 `acre-web`、旧 `/opt/acre/app`、旧 `http://45.55.247.137/` 仅作为历史线路记录，不再作为当前默认目标

## 当前真实状态

当前已经实现：

- 一个 `Next.js` 响应式 Web 应用，支持桌面和手机浏览器
- 两套工作台入口：
  - `Agent Workspace`
  - `Office Console / Back Office`
- `Office Console` 已经按 `Brokermint` 的后台信息架构重做第一轮：
  - 左侧分组导航
  - `Dashboard`
  - `Pipeline`
  - `Transactions`
  - `Contacts`
  - `Tasks`
  - `Reports`
  - `Notifications`
  - `Account / My Profile`
  - `Billing / My Billing`
  - `Activity`
  - `Library`
  - `Accounting`
  - `Settings > Company`
  - `Settings > Users`
  - `Settings > Teams`
  - `Settings > Fields`
  - `Settings > Checklists`
- `Dashboard` 当前保留原有高保真布局，但业务指标已改为真实数据库查询：
  - `Goal Tracking`
  - 当前登录用户 / 角色 / office access 摘要
  - transaction counts by status
  - contacts needing follow-up
  - `Weekly Updates`
  - `Acre Useful Links`
  - `Back Office Agent Training Links`
  - `Recent Transactions`（真实数据库）
- `Pipeline` 现在也已接入真实数据库：
  - 页面已经从简单 bucket board 改成 `pipeline workspace`
  - 顶部现在是 `workspace summary`，把当前过滤上下文、当前 working list、live funnel、recent history 的真实 count 和 metric 放在同一层级
  - 左侧是更密集的 `Opportunity / Active / Pending` live funnel rail，以及最近几个月的 `Closed / Cancelled` 月度 rollup
  - 右侧是统一的真实 transaction working list，而不是按列拆开的 card board
  - 支持 query-param 驱动的顶层过滤：
    - `side / representing`
    - `metric mode`
    - `owner / agent`
    - `search`
  - 当前 metric mode 现在支持真实可得的数据：
    - `Transaction volume`
    - `Office net`
    - `Office gross`
  - `Transaction volume` 当前使用 transaction `price`
  - `Office net` 当前使用 transaction finance / commission workflow 已存储的 `officeNet`
  - `Office gross` 当前来自 transaction finance 上的 `grossCommission`；缺失 finance 数据时按 `0` 处理
  - 左侧 funnel / history 选择会通过 URL 持久化，并直接驱动右侧 working list
  - stage / history 选择可以清除回当前 top filter 下的 `all filtered transactions`
  - `Closed / Cancelled` 月度历史优先使用 `closingDate`，没有时回退到 `updatedAt`
  - transaction row 会显示 title / address、city / state、status、side、owner、price、所选 metric、key date、updated，并可进入真实 transaction detail
- `Transactions` 当前已实现一版更接近 `Brokermint` 的静态高密度列表页，包含顶部统计、搜索、分页和交易列表
- `Transactions` 现在是当前第一个接入真实数据库的 `Office` 模块：
  - 列表页使用 PostgreSQL / Prisma 读取真实 transaction 数据
  - 列表页现在使用 URL 驱动的服务端查询：
    - `q`
    - `status`
    - `ownerMembershipId`
    - `teamId`
    - `type`
    - `startDate`
    - `endDate`
    - `page`
    - `pageSize`
  - 支持搜索、状态 / owner / team / type / date window 筛选和服务端分页
  - 顶部 `MY NET INCOME` 现在按真实 `officeNet` 聚合，不再硬编码 `$ 0`
  - `Create Transaction` modal 会真实写入数据库
  - 已有 transaction detail 页面
  - transaction detail 现在会渲染真实 linked contacts，并支持 link / unlink / set primary
  - transaction detail 现在有真实 `Checklist / Tasks` 区块，可创建、编辑并执行 document-linked review workflow
  - transaction detail 现在有最小真实 `Finance` 区块，可编辑 gross commission / referral fee / office net / agent net / finance notes
  - transaction detail 现在有最小真实 `Documents / Forms / eSignature / Incoming updates` workflow：
    - `Documents`
    - `Unsorted documents`
    - `Forms & eSignature`
    - `Incoming updates`
  - transaction detail 现在也有真实 `Offers` workflow：
    - offer create / edit
    - explicit status transitions：
      - `draft`
      - `submitted`
      - `received`
      - `under_review`
      - `countered`
      - `accepted`
      - `rejected`
      - `withdrawn`
      - `expired`
    - offer comparison
    - internal comments
    - offer-linked documents / forms / signatures
    - accepted offer 可以显式写回 transaction price / closing date / acceptance context
  - 当前 offers 是 Back Office internal workflow，不是外部 MLS / email ingestion，也不是 client-facing portal
  - `Documents` 当前支持：
    - upload
    - open / download
    - delete
    - unsorted -> structured
    - link / unlink to task
  - `Forms` 当前支持：
    - 从内部模板创建 form instance
    - 按 transaction 数据做确定性 merge
    - 保存 draft
    - 生成关联 document 记录
  - `eSignature` 当前支持内部状态机：
    - draft
    - sent
    - viewed
    - signed
    - declined
    - canceled
    当前没有第三方签名 vendor integration
  - `Incoming updates` 当前支持内部 review model：
    - pending_review
    - accepted
    - rejected
    - applied
    当前没有 live Folio / vendor sync
  - 文档文件当前使用本地文件系统存储：
    - 默认目录：`.local-storage/documents`
    - 可用 `ACRE_DOCUMENTS_STORAGE_DIR` 覆盖
    - 这是开发 / MVP 存储方案，不是生产对象存储方案
  - 已有 status update 写路径
- `Office Tasks` 现在是一个独立的真实数据库工作流模块：
  - 路由：`/office/tasks`
  - 内置视图：
    - `Requires attention`
    - `All transactions`
  - 支持个人 saved views，按 membership 持久化
  - 支持过滤：
    - transaction status
    - assignee
    - due date window
    - no due date
    - compliance status
    - transaction
    - keyword search
  - 支持任务动作：
    - create
    - edit
    - complete
    - reopen
    - request review
    - approve
    - reject
  - 支持最小合规工作流字段：
    - requires document
    - requires review
    - requires secondary approval
    - review status
    - compliance status
  - 任务真实状态会反映当前文档/签名/审核条件，而不是只看 `completed`：
    - pending upload
    - uploaded / not submitted
    - review requested
    - second review requested
    - approved
    - rejected
    - waiting for signatures
    - fully signed
    - complete
    - reopened
  - secondary approval 当前已实现，并要求 second approver 不能和 first approver 是同一人
  - 对需要文档/审核的任务，`approved` 与最终 `complete` 是分开的；缺少文档、未提交 review、签名未完成时不能直接 complete
  - 如果 required document 被删除或 workflow 条件失效，任务会按真实规则 reopen
  - 变更会回流到 transaction detail 的 tasks section，同一套数据不会分叉
- `Approve Docs` 现在也已落成真实 Back Office 审批队列：
  - 路由：`/office/approve-docs`
  - 使用与 `Task list` / transaction detail 相同的 `TransactionTask` 审核工作流作为唯一状态来源
  - 页面访问权限复用当前 Back Office 审核权限：
    - `tasks:review`
    - `documents:approve`
    - `tasks:review:secondary` 仅用于 second approval
  - 只展示文档审批相关任务，不混入普通非文档任务
  - 当前支持的队列过滤包括：
    - `All open review items`
    - `Awaiting my review`（按当前登录 reviewer 当前真实可执行的一审/二审动作计算）
    - `Awaiting second review`
    - `Rejected`
    - `Waiting for signatures`
    - `Missing required document`
  - 当前支持的队列动作包括：
    - open transaction
    - open linked document
    - approve
    - second approve
    - reject
    - reopen
    - complete（仅在真实满足条件时可见）
  - 队列动作会继续写入同一套 `AuditLog` 任务事件；从队列触发的动作会带上 `Approve Docs queue` source
  - linked document 删除、unlink 或 signature 状态回退时，会重新评估任务并把不再满足条件的审批任务拉回 queue；缺少 required document 时会明确 reopen 并留下对应 activity reason
- `Contacts` 现在也已接入真实数据库：
  - 列表页使用 PostgreSQL / Prisma 读取真实 client 数据
  - 列表页现在使用 URL 驱动的服务端查询：
    - `q`
    - `stage`
    - `page`
    - `pageSize`
  - 支持搜索、创建、编辑、基础 stage 筛选和服务端分页
  - 已有 contact detail 页面
  - 支持为 contact 创建 follow-up task
  - 已切到 `TransactionContact` relation，支持一个 transaction 关联多个 contact
  - `Transaction.primaryClientId` 仍临时保留，并与当前 primary linked contact 同步
- `Reports` 现在也已接入真实数据库：
  - 现在是一个更强的 management reporting workspace，而不只是 summary + export
  - 支持按真实数据查看：
    - transaction performance
    - agent performance
    - team performance（基于当前 team membership，可见限制会在页面说明）
    - commission summary
    - accounting / payment summary
    - earnest money summary
  - 顶部过滤当前支持：
    - `startDate`
    - `endDate`
    - `officeId`
    - `ownerMembershipId`
    - `teamId`
    - `transactionStatus`
    - `transactionType`
    - `commissionPlanId`
  - 页面内 summary rows 可 drill-down 到真实 `/office/transactions`、`/office/accounting`、`/office/agents/:membershipId`
  - CSV 导出仍保留，并继续复用当前 transaction 过滤上下文导出真实 transaction 行
- `Accounting` 现在也已接入真实数据库，作为一个最小但真实的 back-office accounting MVP：
  - 路由：`/office/accounting`
  - 基于 `LedgerAccount / AccountingTransaction / AccountingTransactionLineItem / GeneralLedgerEntry / EarnestMoneyRecord`
  - 已有最小 chart of accounts foundation
  - 现在也包含最小 `Commission Management / Commission Automation` foundation：
    - `CommissionPlan`
    - `CommissionPlanAssignment`
    - `CommissionPlanRule`
    - `CommissionCalculation`
  - 现在也包含最小 `Agent Billing` foundation：
    - `Agent ledger`
    - `One-time charges`
    - `Recurring charge rules`
    - `Payment methods`（masked/internal foundation，不存原始敏感凭据）
    - `Collections / payments received`
    - `Credit memo application`
    - `Statement` on-screen summary
  - `Accounting` 仍然是 admin / operations workspace；当前用户的 self-service billing view 在独立的 `/office/billing`
  - 支持 accounting transaction types：
    - `invoice`
    - `bill`
    - `credit_memo`
    - `deposit`
    - `received_payment`
    - `made_payment`
    - `journal_entry`
    - `transfer`
    - `refund`
  - 当前已实现 create / edit / list 的 MVP 类型：
    - `invoice`
    - `bill`
    - `deposit`
    - `received_payment`
    - `made_payment`
    - `refund`
  - 当前 commission management 已支持：
    - commission plan create / update
    - membership / agent plan assignment
    - team-level plan assignment
    - precedence rule:
      - direct agent assignment overrides team assignment
      - team assignment applies when no active direct assignment exists
    - transaction-level persisted commission calculations
    - plan rule types:
      - `base split`
      - `brokerage fee`
      - `referral fee`
      - `flat fee deduction`
      - `sliding scale`
    - transaction detail commission section:
      - assigned plan
      - calculation inputs
      - persisted outputs
      - recalculate
      - commission row status update
    - accounting 内的 commission management 区块：
      - plans
      - assignments
      - team filter
      - calculated rows / queue
      - statement snapshot generation
    - agent profile 的 commission summary
      - active plan source visibility
  - 当前 commission workflow 状态包括：
    - `draft`
    - `calculated`
    - `reviewed`
    - `statement_ready`
    - `payable`
    - `paid`
  - 当前 statement / payout-ready 是内部 snapshot 和可见性基础，不代表真实 ACH / bank payout 已执行
  - `credit_memo / journal_entry / transfer` 当前已有基础 list/view 和 line-item 录入能力
  - 已有最小 general ledger posting layer
  - `Agent Billing` 当前已支持：
    - 单个或多个 agent 的 one-time charges
    - recurring billing rule create / update / deactivate
    - due recurring charge generation（手动触发，deterministic）
    - payment method create / update
    - record payment against agent balances
    - apply credit memo to open invoices
    - agent statement snapshot
    - ledger rows linked back to accounting transactions 和 originating transaction
  - 当前 gateway / collection 边界仍然是 MVP：
    - `card on file` 只是配置基础，不代表已自动扣款
    - 没有 ACH / Stripe / QuickBooks sync
  - 已有最小 earnest money / EMD workflow：
    - expected
    - received
    - refund / distribution
    - ledger-tracked optional posting
  - accounting 相关动作会写入 `AuditLog`
- `Agent Management` 现在也已接入真实数据库，作为一个独立的 Office 模块：
  - 路由：`/office/agents`
  - 详情页：`/office/agents/[membershipId]`
  - 以现有 `User / Membership / Office` 为身份基础
  - 通过 `AgentProfile / Team / TeamMembership / AgentOnboardingItem / AgentGoal` 扩展 agent 管理能力
  - roster 页当前支持：
    - office 过滤
    - role 过滤
    - team 过滤
    - onboarding status 过滤
    - membership status 过滤
    - keyword search
    - onboarding progress / goal progress / billing summary / workload 摘要
  - profile 页当前支持：
    - profile basics
    - team roster 管理
    - onboarding checklist create / edit / complete / reopen
    - apply standard onboarding template
    - goal create / edit
    - recent transactions
    - active tasks / operational agenda / billing summary / recent activity 聚合
  - onboarding 当前是 Back Office 可管理 checklist，不是 recruit/candidate pipeline
  - onboarding 现在支持组织级默认模板条目，能按 office 上下文一键应用到 agent
  - goals 当前支持：
    - monthly
    - quarterly
    - annual
    并按真实 transactions / accounting 数据计算最小 progress
  - team 管理当前支持：
    - create
    - rename
    - activate / deactivate
    - add / remove agent
  - agent profile / team / onboarding / goal 变更会写入 `AuditLog`
- `Office Admin / Settings` 现在也已接入真实数据库，作为一个真实的 admin/config 模块：
  - 路由：
    - `/office/settings`
    - `/office/settings/users`
    - `/office/settings/teams`
    - `/office/settings/fields`
    - `/office/settings/checklists`
  - `Users` 当前支持：
    - role change
    - active / inactive membership status
    - office assignment
  - `Teams` 当前在 admin context 内支持：
    - create
    - rename
    - activate / deactivate
    - add / remove members
  - `Fields` 当前支持：
    - required contact roles
    - transaction field required / visible settings
  - `Checklists` 当前支持：
    - create template
    - edit template
    - activate / deactivate template
    - grouped task rows with due offsets and document/compliance flags
  - 当前 office access 仍基于单个 `Membership.officeId` 或 org-wide `null`，不是完整多 office ACL matrix；UI 按这个真实边界实现，没有伪造更复杂 access 模型
- `Notifications` 现在也已落成真实 Back Office 个人收件箱：
  - 路由：`/office/notifications`
  - 这是当前登录 membership 的个人 inbox，不是全局活动流
  - 与 `Activity Log` 的边界现在明确：
    - `Activity Log` = account/system 级审计事件与实时 operational alerts
    - `Notifications` = 面向当前用户的 actionable alerts / reminders inbox
  - 当前支持：
    - unread-first 排序
    - category / type / read-state filters
    - date grouping
    - mark read
    - mark unread
    - mark all in view as read
    - open linked record（open 前会先把通知标为已读）
  - 当前已接入的真实通知家族包括：
    - task review requested
    - task second review requested
    - rejected task needing action
    - offer created / received / expiring soon
    - signature pending / completed
    - incoming update pending review
    - follow-up assigned / overdue
    - onboarding assigned / due soon
  - 当前不会伪造 email / SMS / WeChat delivery
  - 当前也没有 dismiss / archive；MVP 先以 read/unread 为唯一用户状态
- `Account / My Profile` 现在也已落成真实 Back Office 自助账户页：
  - 路由：`/office/account`
  - 这是当前登录 membership 的 self-service account/profile page，不是 admin-facing `Users / Teams / Settings`
  - 当前页面按当前登录 membership / user scope 展示：
    - personal profile details
    - office / role / team assignment visibility
    - notification preferences
    - security/password/2-step verification context
    - lightweight `My Summary`
  - 当前可安全自助编辑的字段包括：
    - first / last name
    - display name
    - phone
    - internal extension
    - avatar URL
    - license number / state
    - timezone / locale
    - bio
  - 当前只读展示、不在这个页面开放修改的内容包括：
    - email
    - office assignment
    - role / membership status
    - team assignment
    - onboarding status / start date
  - 当前通知偏好使用显式持久化模型：
    - `MembershipNotificationPreference`
    - 支持 `in-app notifications`
    - 支持 `activity / approval alerts`
    - 支持 `task reminders`
    - 支持 `offer notifications`
    - 当前不会伪造 email / SMS / push channels
  - 当前安全区会如实展示：
    - 当前 auth method = internal password account
    - 当前 password 可能处于已设置 / 需设置 / 需修改 / 临时锁定状态
    - 当前没有 forgot-password 或 2-step verification flow
    - 当前 session 仍是 HTTP-only cookie + 12 hour max age
  - 当前页面会把 profile update 和 notification preference change 写入 `Activity Log`
- `Billing / My Billing` 现在也已落成真实 Back Office 自助账务页：
  - 路由：`/office/billing`
  - 这是当前登录 membership 的 self-service billing page，不是 admin-facing `Accounting / Agent Billing`
  - 当前页面按当前登录 membership scope 展示：
    - outstanding balance
    - open / pending charges
    - recent payments
    - credit / adjustments
    - monthly statement summaries
    - payment-method references
    - recent billing activity
  - 当前页面继续复用现有 `AccountingTransaction / AccountingTransactionApplication / AgentRecurringChargeRule / AgentPaymentMethod`
  - statement 当前是 live on-screen monthly summaries，不是 durable statement snapshot，也没有 PDF download
  - `Payment methods` 当前只保存 masked/internal reference：
    - type
    - label
    - provider
    - masked last4
    - default / auto-pay flags
    - status
    - 当前不会存 raw card / bank credentials
  - 当前允许当前 membership 自助 add / update / remove 自己的 payment-method reference
  - 当前不会伪造：
    - pay-now checkout
    - ACH execution
    - external gateway capture
    - email / SMS billing delivery
  - payment-method self-service change 继续写入 `Activity Log`
- `Activity` 现在也已接入真实数据库：
  - 页面现在改为真实 `Account Activity Log`
  - 以 `AuditLog` 为主数据源
  - 同页整合 `Activity Log + Operational Alerts`
  - `office_admin` 和 `office_manager` 可以访问；当前不把它当作所有 office 角色都可见的普通页面
  - 支持左侧事件分类和告警分类，右侧分别显示审计事件流和实时告警
  - 默认显示当前 scope 内最新 `200` 条记录
  - 支持最小过滤：
    - `All / Activity only / Alerts only`
    - `actor`
    - `object type`
    - `date range`
  - 支持顶部 `Add comment`，评论会作为 `AuditLog` 事件进入同一条活动流
  - 当前页面级分类包括：
    - `Transactions`
    - `Contacts`
    - `Tasks / Checklists`
    - `Finance / Commissions`
    - `Authentication`
    - `Comments`
    - `Operational alerts`
  - 事件摘要会优先使用结构化 payload / changes，显示状态、finance、primary contact、task 状态等变更摘要
  - 当前已接入的真实事件包括：
    - transaction created / status changed / closed
    - transaction cancelled
    - transaction contact linked / unlinked / primary changed
    - transaction finance updated
    - transaction task created / updated / completed / reopened
    - follow-up task created
    - contact created / updated
    - auth login / logout
  - 当前已接入的真实告警包括：
    - transaction closing soon
    - overdue transaction tasks
    - contacts needing follow-up soon
    - overdue follow-up tasks
    - transaction finance incomplete
- `Library` 现在也已接入真实数据库，作为真实 `Company Library / Internal Document Library`：
  - 路由保持在 `/office/library`
  - 页面改成真实三栏 workspace：
    - 左侧 folder tree
    - 中间 file list
    - 右侧 preview / details pane
  - 数据模型现在使用独立 Prisma 实体：
    - `LibraryFolder`
    - `LibraryDocument`
  - 当前支持：
    - create folder
    - rename folder
    - upload file
    - rename file
    - move file between folders
    - inline PDF preview
    - open / download
    - delete file
    - keyword / folder / category / tag filtering
  - 当前作用域明确区分：
    - `company_wide`
    - `office_only`
  - 当前访问权限：
    - `library:view`
    - `library:manage`
  - major library actions 会写入 `Activity Log`
  - 当前文件存储仍然是本地文件系统 MVP，不是假装已接入对象存储
  - 当前 page count 只在已知值时显示；上传时暂未做稳定 PDF page indexing
- `Create Transaction` 保持在 `Transactions` 页面内的 modal 结构，按 `NEW TRANSACTION / step 1 of 4` 真实截图铺出，包含顶部 `Type / Status / Representing` 和 `Additional fields`
- 基础页面路由：
  - `/` -> 登录后跳对应 workspace，未登录跳 `/login`
  - `/agent` -> `/agent/dashboard`
  - `/office` -> `/office/dashboard`
  - `/login`
  - `/agent/dashboard`
  - `/agent/listings`
  - `/agent/clients`
  - `/agent/notifications`
  - `/agent/resources`
  - `/office/dashboard`
  - `/office/pipeline`
  - `/office/transactions`
  - `/office/contacts`
  - `/office/agents`
  - `/office/tasks`
  - `/office/reports`
  - `/office/activity`
  - `/office/company`
  - `/office/library`
  - `/office/accounting`
  - `/change-password`
  - `/invite/[token]`
- 一组 API：
  - `/api/health`
  - `/api/db/seeded-context`
  - `/api/agent/dashboard`
  - `/api/office/dashboard`
  - `/api/office/transactions`
  - `/api/office/transactions/:transactionId`
  - `/api/office/transactions/:transactionId/finance`
  - `/api/office/transactions/:transactionId/contacts`
  - `/api/office/transactions/:transactionId/contacts/:contactLinkId`
  - `/api/office/transactions/:transactionId/tasks`
  - `/api/office/transactions/:transactionId/tasks/:taskId`
  - `/api/auth/login`
  - `/api/auth/logout`
  - `/api/auth/change-password`
  - `/api/auth/invitations/accept`
  - `/api/office/settings/users`
  - `/api/office/settings/users/:membershipId`
  - `/api/office/settings/users/:membershipId/invitation`
  - `/api/office/settings/users/:membershipId/unlock`
  - `/api/office/transactions/:transactionId/tasks/:taskId/workflow`
  - `/api/office/transactions/:transactionId/documents`
  - `/api/office/transactions/:transactionId/documents/:documentId`
  - `/api/office/transactions/:transactionId/documents/:documentId/file`
  - `/api/office/transactions/:transactionId/forms`
  - `/api/office/transactions/:transactionId/forms/:formId`
  - `/api/office/transactions/:transactionId/signatures`
  - `/api/office/transactions/:transactionId/signatures/:signatureRequestId`
  - `/api/office/transactions/:transactionId/incoming-updates`
  - `/api/office/transactions/:transactionId/incoming-updates/:incomingUpdateId`
  - `/api/office/tasks/views`
  - `/api/office/contacts`
  - `/api/office/contacts/:contactId`
  - `/api/office/contacts/:contactId/follow-up-tasks`
  - `/api/office/contacts/:contactId/transactions/:transactionId`
  - `/api/office/activity/comments`
  - `/api/office/library/folders`
  - `/api/office/library/folders/:folderId`
  - `/api/office/library/documents`
  - `/api/office/library/documents/:documentId`
  - `/api/office/library/documents/:documentId/file`
  - `/api/office/agents/teams`
  - `/api/office/agents/teams/:teamId`
  - `/api/office/agents/teams/:teamId/memberships`
  - `/api/office/agents/teams/:teamId/memberships/:membershipId`
  - `/api/office/agents/:membershipId/profile`
  - `/api/office/agents/:membershipId/onboarding-items`
  - `/api/office/agents/:membershipId/onboarding-items/:itemId`
  - `/api/office/agents/:membershipId/goals`
  - `/api/office/agents/:membershipId/goals/:goalId`
  - `/api/office/accounting/transactions`
  - `/api/office/accounting/transactions/:accountingTransactionId`
  - `/api/office/accounting/earnest-money`
  - `/api/office/accounting/earnest-money/:earnestMoneyRecordId`
  - `/api/office/accounting/commissions/plans`
  - `/api/office/accounting/commissions/plans/:commissionPlanId`
  - `/api/office/accounting/commissions/assignments`
  - `/api/office/accounting/commissions/calculations/:calculationId`
  - `/api/office/accounting/commissions/statements`
  - `/api/office/transactions/:transactionId/commissions/calculate`
  - `/api/listings`
  - `/api/clients`
  - `/api/events`
  - `/api/resources`
  - `/api/office/reports/export`
- 一个独立的权限模型包 `@acre/auth`
- 一个独立的领域数据/服务包 `@acre/backoffice`
- 一个独立的数据库包 `@acre/db`，当前已包含：
  - 可复用的 Prisma client
  - 初始 migration 基线
  - seed workflow
  - 一个最小的数据库读取 utility 和 API probe
- 一个统一的 `Office / Back Office` 设计系统：
  - 主字体统一通过 root layout 加载
  - 共享 tokens 集中在 [apps/web/app/globals.css](/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean/apps/web/app/globals.css)
  - 共享 primitives 集中在 [packages/ui/src/index.tsx](/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean/packages/ui/src/index.tsx)
  - 设计规则文档见 [docs/office-design-system.md](/Users/openclaw_john/工作文件夹/acre-ui-rebuild-clean/docs/office-design-system.md)
- 一个最小正式内部账号系统，当前已包含：
  - bootstrap admin 保障
  - invitation onboarding
  - email + password 登录
  - 5 次失败后锁定 1 小时
  - 管理员解锁和 setup/reset link 重新签发
  - 登录后 signed cookie session
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/auth/change-password`
  - `POST /api/auth/invitations/accept`
  - `/invite/[token]`
  - `/change-password`
  - `/office/*` 服务端保护
  - 服务端可读取 `currentUser / currentMembership / currentOrganization / currentOffice / currentCredential`
- 一份 `Prisma + PostgreSQL` schema，覆盖组织、用户、房源、CRM、通知、活动、资源、vendor、审计日志
- 一份 `Prisma + PostgreSQL` schema，当前也覆盖：
  - transactions / transaction contacts / transaction tasks
  - ledger accounts
  - accounting transactions / line items
  - general ledger entries
  - earnest money records

当前未实现 / 计划中：

- `Dashboard`、`Pipeline`、`Transactions`、`Contacts`、`Reports` 之外的大多数页面和 API 仍使用 `@acre/backoffice` 的内存示例数据
- 已实现数据库 runtime、migration、seed，且 `Dashboard` 的业务指标、`Pipeline`、`Transactions`、`Contacts`、`Tasks`、`Reports`、`Notifications`、`Account`、`Activity`、`Accounting` 已接入真实数据库；其余主页面和主 API 仍未完成数据库切换
- 已实现最小正式内部 auth/session，但还没有 forgot-password、2FA、第三方 auth provider、数据级权限
- 未实现 `Brokermint` 中更深层的 offer ingestion / MLS-email sync，以及更完整的 accounting workflows（如 reconciliation、QuickBooks sync、ACH/网关自动扣款）
- 写操作接口当前只覆盖：
  - `Transactions` 的 create / status update
  - `Contacts` 的 create / edit / follow-up task create / transaction link
  - `Accounting` 的最小 create / edit / EMD / Agent Billing write flows
  - `Agent Management` 的 profile / team / onboarding / goal write flows
- 其余模块仍未实现真实 CRUD
- 测试体系仍不完整，但内部账号主链路已经补了基础 node tests（bootstrap admin / invite accept / password login / lockout / admin unlock）
- 当前默认 GitHub 目标是 `acre-office-warm-ui`，默认生产线路是 `DigitalOcean :3105`；历史上的 Vercel 绑定只作为遗留说明，不是当前默认交付路径
- 未实现对象存储、异步任务、AI 工作流、文件上传、OCR、第三方集成

这几项在文档里都会明确以“未实现 / 暂定方案”处理，不应误认为已经完成。

## 本地启动

前提：

- Node.js `22+` 建议
- npm `10+`
- 如果要使用本地登录、执行 Prisma 命令、或访问数据库 probe route，需要本地可用的 PostgreSQL 连接串
- 如果只浏览当前 mock 页面和不依赖数据库的只读 API，真实数据库不是必需项

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

当前本地工作基线入口：

- `http://localhost:3105/`

当前仓库根目录的 `npm run dev` 会默认把 `@acre/web` 启动到 `3105`。

当前本地 auth 基线：

- `/login` 现在使用 email + password
- `/login` 首屏必须保持空白，不要预填任何演示账号、用户名或默认密码；如果浏览器对 `localhost` 自动填充，也要尽量压制
- `/login` 只接受邮箱，不支持 `admin` 这类用户名
- 系统会确保 bootstrap admin `office@acreny.us` 存在
- bootstrap admin 首次成功登录后必须立即修改密码
- 新用户通过 `/office/settings/users` 创建邀请并拿到 copyable invite link
- 当前未实现 forgot password、邮件发送、2-step verification、OAuth / SSO
- 详细使用说明见 [docs/specs/auth-usage-guide.md](./docs/specs/auth-usage-guide.md)

直接运行 `npm run dev` 且未设置 `PORT` 时，Next.js 默认仍会使用：

- `http://localhost:3000`

但这个仓库已经把根目录 `npm run dev` 包了一层启动脚本，正常情况下会直接起在 `3105`。
只有你绕过根目录脚本、直接在 `apps/web` 下运行 `next dev` 时，才会回到 Next.js 自己的 `3000` 默认端口。

Prisma / auth 开发注意：

- 如果改了 `packages/db/prisma/schema.prisma`
- 或者运行了 `npm run db:generate`
- 或者变更了依赖新 relation / model 的 auth 代码
- 浏览器验证前必须重启正在运行的 Next dev server

原因：

- Next dev 进程可能继续持有旧的 Prisma Client
- 页面会出现 `PrismaClientValidationError`
- 常见现象是代码和 schema 明明已经是新的，但运行中的服务仍按旧 relation 解析查询

## 常用开发命令

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

类型检查：

```bash
npm run typecheck
```

基础静态校验：

```bash
npm run lint
```

构建生产包：

```bash
npm run build
```

运行当前 Back Office hardening tests：

```bash
npm run test:backoffice-hardening
```

校验 Prisma schema：

```bash
npm run db:validate
```

生成 Prisma client：

```bash
npm run db:generate
```

运行开发 migration：

```bash
npm run db:migrate -- --name init
```

执行 seed：

```bash
npm run db:seed
```

## 项目目录结构

```text
acre/
  apps/
    web/                    # Next.js Web 应用
      app/                  # App Router 页面和 API routes
  packages/
    auth/                   # 角色和权限定义
    backoffice/             # 领域模型、示例数据、页面/API 共用服务层
    db/                     # Prisma schema 和数据库相关配置
    ui/                     # 共享 UI 组件
  docs/                     # 面向维护者的文档
  package.json              # monorepo 根脚本
  turbo.json                # Turbo task 配置
  tsconfig.base.json        # 共享 TS 配置
```

更具体一点：

- [apps/web](./apps/web) 是当前唯一运行中的应用
- [apps/web/app](./apps/web/app) 同时包含页面和 API route
- [packages/backoffice/src/index.ts](./packages/backoffice/src/index.ts) 是当前最核心的业务入口文件
- [packages/auth/src/index.ts](./packages/auth/src/index.ts) 定义角色和权限
- [packages/db/prisma/schema.prisma](./packages/db/prisma/schema.prisma) 定义数据库结构和 migration 方向
- [packages/db/src/client.ts](./packages/db/src/client.ts) 是可复用 Prisma client 入口
- [packages/db/src/bootstrap.ts](./packages/db/src/bootstrap.ts) 是当前最小数据库读取 utility
- [packages/db/src/transactions.ts](./packages/db/src/transactions.ts) 是当前 transaction 持久化 service 入口
- [packages/db/src/contacts.ts](./packages/db/src/contacts.ts) 是当前 contact / follow-up task 持久化 service 入口
- [packages/db/src/commissions.ts](./packages/db/src/commissions.ts) 是当前 commission plan / calculation / statement service 入口
- [apps/web/lib/auth-session.ts](./apps/web/lib/auth-session.ts) 是当前本地 session 和 server-side auth context 入口
- [apps/web/app/office/dashboard/page.tsx](./apps/web/app/office/dashboard/page.tsx)、[apps/web/app/office/pipeline/page.tsx](./apps/web/app/office/pipeline/page.tsx)、[apps/web/app/office/transactions/page.tsx](./apps/web/app/office/transactions/page.tsx) 是当前 `Back Office` UI 的主要入口
- [apps/web/app/office/transactions/[transactionId]/page.tsx](./apps/web/app/office/transactions/[transactionId]/page.tsx) 是当前 transaction detail 入口
- [apps/web/app/office/contacts/page.tsx](./apps/web/app/office/contacts/page.tsx) 和 [apps/web/app/office/contacts/[contactId]/page.tsx](./apps/web/app/office/contacts/[contactId]/page.tsx) 是当前 contact list/detail 入口

## 新人第一次接手建议先看什么

建议按这个顺序读，30 分钟内能建立项目全貌：

1. [README.md](./README.md)
2. [docs/architecture.md](./docs/architecture.md)
3. [packages/backoffice/src/index.ts](./packages/backoffice/src/index.ts)
4. [apps/web/app/page.tsx](./apps/web/app/page.tsx)
5. [apps/web/app/agent/dashboard/page.tsx](./apps/web/app/agent/dashboard/page.tsx)
6. [apps/web/app/office/dashboard/page.tsx](./apps/web/app/office/dashboard/page.tsx)
7. [packages/auth/src/index.ts](./packages/auth/src/index.ts)
8. [packages/db/prisma/schema.prisma](./packages/db/prisma/schema.prisma)
9. [docs/deployment.md](./docs/deployment.md)
10. [docs/decisions.md](./docs/decisions.md)

如果你准备继续开发功能，不要先从页面样式下手。先确认三件事：

- 当前功能是不是仍然只读 mock 数据
- 你要改的是页面展示层，还是 `@acre/backoffice` 服务层
- 新功能是否需要先落数据库 schema，再补 API，再接页面

## 维护要求

从现在开始，每次新增重要功能或新增环境变量时，至少同步更新这些文档：

- [README.md](./README.md)
- [docs/architecture.md](./docs/architecture.md)
- [docs/deployment.md](./docs/deployment.md)
- [docs/env.md](./docs/env.md)
- [docs/decisions.md](./docs/decisions.md)
