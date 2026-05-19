# Acre 网站完整使用说明

更新时间：2026-05-19  
适用入口：`https://acresystem.us/`、`https://acresystem.us/login`、本地开发 `http://localhost:3105/`

## 1. 手册范围

这份手册面向 Acre 内部用户、运营管理员和经纪人，说明当前网站内所有主要工作区与功能模块的使用方式。

Acre 当前不是公开客户官网，而是公司内部工作台，分为三条主线：

- `Back Office / Office Console`：后台运营、交易、任务、审批、签署、会计、人事、行政、设置。
- `Front Office / Agent Workspace`：经纪人的日常客户跟进、预约、活动、资料、项目签署和执行提醒。
- `Listing Studio`：房源采集、客户版资料包、collection、公开分享页、PDF / 海报 / marketing kit。

有些功能会根据你的角色和权限显示或隐藏。看不到某个菜单通常意味着当前账号没有对应权限，或当前公司范围下没有可访问的数据。

## 2. 基础概念

### 2.1 Organization、Company、Office

系统顶层是一个 organization，例如 `Acre`。organization 下可以有多个 company / office，例如 `Acre NY Realty Inc`、`Acre NY Rentals LLC`、`Acre NJ LLC`。

使用时要注意右上或左侧工作区里的 company switcher。切换 company 后，交易、联系人、任务、报表、房源、成员等数据都会按当前 company scope 读取和写入。

### 2.2 Membership 与角色

用户通过 membership 进入某个 organization / office。常见角色包括：

- `Owner`：最高权限。
- `Office Admin`：后台管理员，负责用户、设置、交易、审批、会计等日常管理。
- `Accountant`：财务角色，重点使用 accounting、reports、transactions finance。
- `Human Resources`：人事角色，重点使用 HR、用户生命周期、组织数据。
- `Team Lead`：团队负责人，可查看自己和下线范围内的业务。
- `Agent`：经纪人，重点使用 Front Office、自己的客户、交易和房源资料。

角色决定默认权限，管理员也可以在用户详情里配置权限覆盖。

### 2.3 Front Office 与 Back Office 分界

Front Office 负责经纪人日常执行：lead intake、跟进提醒、客户 dossier、预约协调、活动中心、资源检索、房源推荐、项目签署准备。

Back Office 是正式系统记录：transactions、accounting、commissions、signature archive、documents、compliance、formal task review、reports。

当客户工作进入正式交易、佣金、签署归档或审计流程时，应从 Front Office handoff 到 Back Office。

### 2.4 自动化边界

Acre 当前很多外部动作是“辅助生成 / 手动执行”，不是自动发送：

- 邀请用户会生成 invite link，但不会自动发邮件。
- Front Office AI 只生成建议和草稿，不会自动发短信、微信或邮件。
- Listing Studio 可以复制分享文案、collection link、campaign bundle，但不会自动群发。
- Billing 中 payment method 是内部参考，不代表已接入真实银行卡 / ACH 扣款。
- Signature 可以通过配置好的 Resend / SMTP 发送；若邮件失败，发起人应使用系统生成的安全链接手动补发。

## 3. 登录、账号与会话

### 3.1 登录

进入 `/login`，使用邮箱和密码登录。登录页只接受 email + password，不支持 `admin` 这类用户名。

登录成功后，系统会写入 `acre_local_session` cookie，默认有效期为 30 天。根据角色，系统会进入默认工作区。

### 3.2 首次邀请激活

管理员在 `Back Office > Settings > Users` 创建用户后，系统会生成邀请链接。受邀用户打开 `/invite/[token]`，设置密码后账号变为 active，并自动登录。

邀请链接应通过安全渠道发送。当前系统不会自动发送邀请邮件。

### 3.3 修改密码

进入 `/change-password` 修改密码。首次 bootstrap admin 登录后会被强制修改密码。已登录用户也可以从 `Back Office > Account` 进入修改密码。

### 3.4 密码锁定

同一账号连续输错密码 5 次后，会锁定 1 小时。管理员可在 `Settings > Users` 查看锁定状态，并手动解锁或重新发邀请。

### 3.5 登出

在左侧导航底部点击 `Sign out`。登出后会清除当前会话，需要重新登录。

## 4. 全局操作

### 4.1 工作区切换

Back Office 和 Front Office 左侧导航中都有工作区切换入口。常见路径：

- Back Office：首页 `/office/dashboard`
- Front Office：首页 `/agent/dashboard`
- Listing Studio：`/listing-studio/listings`

Agent 可以从 Front Office 快速跳回 Back Office；Back Office 用户可从导航或 URL 进入 Agent 工作区，但具体可见模块仍受权限控制。

### 4.2 公司切换

使用 company switcher 切换当前公司。切换后，列表、统计、设置和创建记录都会使用新的 company scope。

### 4.3 语言切换

页面支持语言切换。切换语言只影响界面文案，不改变业务数据。

### 4.4 列表筛选、搜索与分页

Back Office 列表页通常支持：

- 搜索框：输入地址、姓名、标题、编号等关键词。
- 状态筛选：例如 transaction status、offer status、task review status。
- owner / team / type / date window 等筛选。
- URL 参数保留筛选状态，刷新或复制链接后仍可回到同一视图。
- 表格列宽在部分 Back Office 表格中可由管理员调整并保存到组织范围。

### 4.5 审计与通知

正式操作会尽量写入 `Activity Log` 或模块内 activity。个人需要处理的事项会进入 `Notifications` 或模块专属队列。不要只依赖口头记录；涉及审批、签署、交易、财务和账号的动作应在系统里完成。

## 5. Back Office 使用说明

入口：`/office/dashboard`

Back Office 是后台正式记录和运营管理中心。

### 5.1 Dashboard

路径：`/office/dashboard`

用途：查看当前办公室运营压力、状态统计、近期交易、待处理提醒和常用链接。

使用方式：

1. 进入 Dashboard 后先看顶部摘要，确认当前登录用户、角色和 company scope。
2. 查看交易状态统计，判断 Pending、Closed、Cancelled 等交易量。
3. 查看 `Recent Transactions`，点击交易进入详情。
4. 如果看到 overdue transaction queue，优先处理超过 move-in / closing 三个月但仍未 Closed / Cancelled 的交易。
5. Agent 或相关角色看到 payout statement review reminder 时，应进入对应 statement 完成确认或请求修改。

### 5.2 Pipeline

路径：`/office/pipeline`

用途：管理 Pending 交易和 Closed 月度历史，查看 office / personal metric。

使用方式：

1. 左侧选择 `Pending` 或某个月份的 `Closed` 历史。
2. 使用年份 dropdown 查看完整月份历史；默认展示最近 6 个月。
3. 在右侧工作列表中查看对应交易。
4. 使用 metric mode 切换查看口径，例如 office net、office sales volume、my net income。
5. 点击交易行进入 transaction detail。

注意：office-level financial metrics 只对有权限的管理角色显示。普通 agent 通常只能看到自己参与交易的个人指标。

### 5.3 Transactions

路径：`/office/transactions`

用途：创建、查询、管理正式交易，是 Back Office 的核心模块。

#### 5.3.1 查询交易

1. 打开 `Transactions`。
2. 使用搜索框输入地址、客户、owner 或关键字段。
3. 使用 status、owner、team、type、date window 等筛选。
4. 点击 `Pending` 或 `Closed` 快捷筛选可快速定位常用队列。
5. 使用分页和 page size 控制列表显示。
6. 点击任意交易行进入详情。

#### 5.3.2 创建交易

可从列表页 `New transaction` 或 `/office/transactions/new` 创建。

创建时通常填写：

- Transaction type、status、representing。
- Agent Name / owner。
- 地址、unit、city、state、zip。
- Asking Price 与 Purchased Price。
- 关键日期，例如 move-in date 或 closing date。
- 自定义字段和 required fields。
- Commission calculator：Gross commission、Rebate、Internal Referral、External Referral、Company Referral、Net Commission。

规则：

- 普通 agent 创建时默认进入 `Pending`，不能随意设置正式状态。
- `Gross commission` 是佣金计算基础；其他 fee 留空按 0 处理。
- `Purchased Price` 是报表、pipeline volume、dashboard recent transactions 的成交金额真源。

#### 5.3.3 管理交易详情

进入 `/office/transactions/[transactionId]` 后，按区块处理：

- `Intake / Details`：编辑交易基础字段。
- `Contacts`：link / unlink 联系人，设置 primary contact。
- `Checklist / Tasks`：创建、执行、提交审核和完成交易任务。
- `Finance / Commission`：维护 gross commission、fees、approval prerequisite、calculation history、manual override。
- `Documents / Forms / eSignature`：上传文件、整理 unsorted documents、发起签署。
- `Offers`：创建和跟踪 buyer offer。
- `Activity`：查看操作历史。

管理员或 owner 可从详情头部删除交易。删除会移除交易自有工作区记录和相关存储文件；已有 accounting rows 会保留历史，只解除 transaction link。

### 5.4 Contacts

路径：`/office/contacts`

用途：管理内部客户 / 联系人 / 交易相关方。

使用方式：

1. 使用搜索和筛选找到联系人。
2. 点击联系人进入详情。
3. 新建或编辑联系人时，系统会使用 `Settings > Fields` 中配置的 contact 字段。
4. 在联系人详情中查看交易关联、跟进信息和自定义字段。
5. 在 transaction detail 中也可以将联系人 link 到交易并设为 primary。

建议：同一个真实客户不要重复创建多个 contact。若在 Front Office 发现重复 lead，应优先使用 FO duplicate review / merge。

### 5.5 Tasks

路径：`/office/tasks`

用途：处理运营任务、交易任务、checklist、review / compliance workflow。

使用方式：

1. 进入 Task List 查看待办任务。
2. 使用状态、负责人、交易或 review 相关筛选找到任务。
3. 打开任务后查看 required documents、signature、review requirement。
4. 对普通任务，完成实际工作后标记完成。
5. 对需要审核的任务，先提交 review，再由有权限的 reviewer approve。
6. 如果任务需要 second review，第一次 approve 不等于最终完成，必须完成二次审批。

注意：任务是否 complete 会看真实前置条件，不只是 checkbox。缺文档、未提交 review、签署未完成时不能直接完成。

### 5.6 Approve Docs

路径：`/office/approve-docs`

用途：文档审批和 compliance reviewer 队列。

使用方式：

1. 打开 Approve Docs 查看当前用户可处理的文档审批任务。
2. 按 priority、due date 或 transaction 定位任务。
3. 打开任务或交易详情，检查上传文档和备注。
4. 选择 approve、reject 或请求补充。
5. 如果需要 second approval，完成当前审批后让系统进入下一审批阶段。

Approve Docs 使用与 Task List / transaction detail 相同的 `TransactionTask` review workflow。

### 5.7 Offers

路径：`/office/offers`，也可从 transaction detail 进入。

用途：管理 buyer offer、比较报价、评论、offer-linked docs / signatures。

使用方式：

1. 在交易详情或 Offers 列表中创建 offer。
2. 填写 offer 基础字段、自定义字段、金额、状态和备注。
3. 按业务进度更新状态，例如 draft、submitted、received、under_review。
4. 将相关文档、签署或评论关联到 offer。
5. 在正式交易推进后，继续让交易 detail 成为最终系统记录。

### 5.8 Reports

路径：`/office/reports`

用途：按角色权限查看交易报表、财务汇总和 CSV export。

使用方式：

1. 设置 transaction filters：状态、日期、owner、team、type、字段筛选。
2. 查看 summary cards，确认 filtered result 的 asking price、purchased price、gross commission、rebate、referral、reimbursement 等合计。
3. 查看报表表格，必要时调整筛选。
4. 点击 CSV export 导出当前筛选下的完整结果。

权限范围：

- admin tiers 通常可看 company scope。
- team leads 看自己和下线范围。
- agents 看自己相关记录。

### 5.9 Performance

路径：`/office/performance`

用途：查看 agent 业绩、周期表和排名。

使用方式：

1. 选择公司、周期和可见范围。
2. 查看个人 / 团队 / 公司 summary。
3. 查看 period table 和 Top 10 ranking。
4. 点击相关交易或报表路径做进一步核对。

公式：`Gross Commission - Rebate - Referral Fee - Reimbursement`。周期归属使用 `moveInDate ?? closingDate`，只有 Pending / Closed 交易参与。

### 5.10 Mail

路径：`/office/mail`

用途：组织内站内邮件线程，用于 Back Office 沟通和系统 alert。

使用方式：

1. 打开 Mail 查看个人参与的 thread。
2. 使用 unread / archive 状态管理收件箱。
3. 新建 thread 时选择同一 organization 内 active Back Office membership。
4. 回复 thread 时可继续保留固定 participants。
5. 上传附件时注意不要把敏感文件发给无关人员。
6. 有 `mail:audit` 权限的用户可进入 audit view 查看 org thread。

系统会在 agent 创建新交易时给 owner / office_admin 生成提醒 thread，并在左侧 Mail 显示未读数。

### 5.11 Notifications

路径：`/office/notifications`

用途：个人工作提醒 inbox。

使用方式：

1. 按 read / unread、category、type 筛选通知。
2. 点击通知 deep link 进入最近的真实 workflow 页面。
3. 处理完成后标记为 read。
4. 使用 mark all read 清理当前可见通知。
5. 如果顶部有 payout review queue，优先进入 statement 处理。

当前通知覆盖任务审核、交易 overdue、offer、signature、incoming update、follow-up、onboarding、payout statement 等真实 workflow 信号。

### 5.12 Activity Log

路径：`/office/activity`

用途：查看账号活动、业务变更和运营 alert。

使用方式：

1. 使用筛选定位模块、actor、时间或事件类型。
2. 查看变更摘要，例如状态、finance、primary contact、task 状态。
3. 对需要追责或复盘的操作，优先使用 Activity Log 作为系统记录。

Activity Log 和 Notifications 不同：Activity Log 是审计记录，Notifications 是个人待处理提醒。

### 5.13 Library

路径：`/office/library`

用途：公司内部文档库，支持 folder、文件元数据、PDF preview 和 office / company scope。

使用方式：

1. 左侧选择 folder，或选择 all files / unfiled。
2. 使用搜索、category、tag、scope 筛选文档。
3. 点击文件查看详情和预览。
4. 有管理权限时可以创建 folder、上传文件、编辑 title / category / summary / tags / visibility。
5. 可打开原文件、删除文档或 archive folder。

建议：Library 用于 Back Office 内部文件。面向 Front Office agent 的资源发布应使用 `Office Resources Publisher`。

### 5.14 Office Resources Publisher

路径：`/office/resources`

用途：office admin 发布给 Front Office 使用的 documents、vendors、training videos。

使用方式：

1. 进入 `Resources` 后选择 `Documents`、`Vendors` 或 `Training` tab。
2. 在 Documents 中上传 PDF、填写标题、摘要和 tags。
3. 在 Vendors 中创建供应商，填写 category、name、headline、phone、email、website、neighborhoods，可设为 featured。
4. 在 Training 中创建 training video，填写 title、summary、URL 和 tags。
5. 编辑或删除资源后，Front Office `/agent/resources` 会使用同一套资源数据。

权限：当前主要由 `office_admin` 使用。

### 5.15 Signatures

路径：`/office/signatures`、模板路径 `/office/signatures/templates`，设置路径 `/office/settings/signature-drive`

用途：统一签署中心、模板、归档和 Drive sync。

使用方式：

1. 从交易详情、HR 流程或签署中心创建 signature request。
2. 先配置 recipients and delivery。
3. 保存 draft 后进入 PDF field placement。
4. 为每个 signer 放置签名、文本或日期字段。
5. 发送签署请求，或复制安全签署链接手动发送。
6. 在 Signature Center 按 status、sender、recipient、Drive sync 状态筛选。
7. 签署完成后查看 signed artifact，必要时 retry Drive sync。

模板页用于管理可复用 signature templates。Signature Drive 用于配置组织级 Google Drive service account 和 folder mapping。

### 5.16 Accounting

路径：`/office/accounting`

用途：管理员生成和管理 agent payout statements。

使用方式：

1. 选择 agent / payee。
2. 加载该 agent 的 invoice-number candidates。
3. 在 `Statement candidates` 中选择需要进入 statement 的 row。
4. 点击 candidate row 可打开 transaction drilldown modal 检查源交易。
5. 确认候选行、金额、invoice number 和 commission context 后生成 payout statement。
6. 进入 statement detail 发送给 agent review。
7. Agent 确认或请求修改后，admin 继续处理。

注意：invited agent 仍可用于 accounting workflow；invited 只表示未完成自助登录，不代表不能生成交易或 statement。

### 5.17 1099 Tracker

路径：`/office/1099-tracker`

用途：记录公司实际支付给 agent 的 payout，用于年终 1099 support document。

使用方式：

1. 选择 tax year 和 agent。
2. 新增或核对 payout records。
3. 查看年度 summary。
4. 导出 `1099 Summary / Backup Document` PDF。

1099 totals 只来自保存的 tracker records，不会把未保存或未支付的数据自动算进去。

### 5.18 Billing / My Billing

路径：`/office/billing`

用途：当前登录用户查看自己的 balance、charges、payments、statement summary、payment method references。

使用方式：

1. 查看 outstanding balance 和 recent activity。
2. 查看 charges / payments 明细。
3. 查看 masked payment method references。
4. 更新自助 payment-method reference 时会写入 AuditLog。

限制：当前没有真实 card / ACH processor，也没有 durable statement PDF 下载。

### 5.19 HR

路径：`/office/hr`，子页包括 candidates、interviews、onboarding、offboarding、templates。

用途：人事后台，覆盖候选人、面试、offer、入职、离职、HR checklist、HR signatures。

使用方式：

1. 在 Candidates 创建候选人，维护状态、来源、备注。
2. 在 Interviews 安排面试，必要时连接 Google Calendar / Meet。
3. 在 Templates 管理 HR 文档模板。
4. 在 Onboarding 创建入职流程，生成 `/onboarding/[token]` 公开上传窗口。
5. 在 Offboarding 管理离职 checklist 和文件。
6. 需要签署时，从 HR context 发起 signature request。
7. 使用 AI drafts 生成邮件或 letter 草稿，人工审核后再发送。

Google sync 失败会标记 `sync_failed`，不会阻断 HR 主流程。

### 5.20 Admin Office

路径：`/office/admin-office`，子页包括 calendar、email requests、signups。

用途：公司行政工作台，管理公司邮箱申请、全员活动、报名名单和 CSV export。

使用方式：

1. 在 Email Requests 查看 pending / approved / completed / rejected 请求。
2. 审批公司邮箱申请，并在实际完成后更新状态。
3. 在 Calendar 创建 all-staff 或 company scoped event。
4. 配置是否需要报名、容量、报名截止时间。
5. 在 Signups 查看 attendee list。
6. 导出 CSV 做线下处理。

Admin Office 和 Admin Assistant 不同：Admin Office 是行政流程；Admin Assistant 是 AI / ChatGPT Actions 设置入口。

### 5.21 Settings

路径：`/office/settings`

用途：公司配置、权限、用户、团队、字段、清单、集成和佣金方案。

#### 5.21.1 Overview / Company

查看当前 company / organization 的设置总览。涉及 company scope 的操作前，先确认当前 company switcher 是否正确。

#### 5.21.2 Roles

路径：`/office/settings/roles`

用于配置角色模板权限。修改角色权限会影响该角色下所有用户的默认权限。建议只由 owner / office_admin 修改，并在修改后重新检查关键用户的可见模块。

#### 5.21.3 Email Delivery

路径：`/office/settings/email-delivery`

用于配置组织级 SMTP / Resend 邮件发送参数。保存后，签署等需要邮件发送的模块会使用该配置。删除配置后，相关模块应回到手动链接发送。

#### 5.21.4 QuickBooks

路径：`/office/settings/quickbooks`

用于连接、验证或断开 QuickBooks 设置。Accounting statement bill sync 相关动作依赖这里的连接状态。

#### 5.21.5 Users

路径：`/office/settings/users`

用于管理内部账号、agent roster、profile、onboarding、goals 和用户权限。

常用操作：

1. 搜索或按 role / status / office 筛选用户。
2. 点击用户进入详情。
3. 创建用户时填写 first name、last name、email、role、office access、title。
4. 创建后复制 invite link，手动发给用户。
5. 在详情中修改 role、status、office access。
6. 解锁账号、重新发邀请或查看 password setup 状态。
7. 在用户详情中维护 profile、team assignment、onboarding items、goals。
8. 有权限时进入 permissions 页面配置 per-user override。

#### 5.21.6 Teams

路径：`/office/settings/teams`

用于管理递归团队层级。支持 Team Leader、Junior Team Leader、Member、parent-child branches 和 direct manager assignment。

使用方式：

1. 创建 root team 或 child team。
2. 设置 team leader。
3. 添加成员并设置成员在团队中的角色。
4. 调整 parent team 或成员汇报关系。
5. 修改后检查 Reports / Performance / Transactions 中 team scope 是否符合预期。

#### 5.21.7 Fields

路径：`/office/settings/fields`

用于管理 transaction / contact / offer 字段。

可做操作：

- 重命名 built-in field label。
- 调整字段顺序。
- 设置 visible / required。
- 创建、编辑、隐藏、恢复 custom fields。
- 删除没有持久值且未受保护的 custom field。
- 管理 dropdown options。
- 管理 transaction required contact roles。

影响范围：create form、detail edit、transactions search layout、reports filters、CSV headers 会尽量复用同一字段 schema。

#### 5.21.8 Checklists

路径：`/office/settings/checklists`

用于维护交易 checklist templates。模板会影响 transaction detail 中的任务生成和 review workflow。

#### 5.21.9 Signature Drive

路径：`/office/settings/signature-drive`

用于配置完成签署后的 Google Drive 归档目标。填写 service account 和 folder mapping 后，完成的 request 会尝试同步 original / signed copies。失败可在 Signature Center retry。

#### 5.21.10 Commission Plans

路径：`/office/settings/commission-plans`

用于管理 commission plans、split templates、assignments、calculation rules 和 statement-ready context。

使用建议：改 commission plan 前先确认是否会影响现有 transaction calculation 和 payout statement snapshot。

#### 5.21.11 Admin Assistant

路径：`/office/admin-assistant`

用于配置和进入 Acre Admin GPT 的外部 ChatGPT Actions 工作流。Acre 只暴露只读 admin context、feature lookup、bug triage 等 action；真实 chat、截图上传和图片 review 在 ChatGPT 侧完成。

## 6. Front Office 使用说明

入口：`/agent/dashboard`

Front Office 是经纪人的日常执行工作台。它帮助 agent 抓 lead、跟进客户、安排预约、查看活动、处理 cleanup、使用资源和发起项目签署。

### 6.1 Dashboard

路径：`/agent/dashboard`

用途：当天下一步行动台。

使用方式：

1. 先看 `Next Actions`，处理 due follow-up、today schedule、hot signals、needs handoff。
2. 使用 primary action 直接进入客户、预约、listing 或 Back Office handoff。
3. 使用 `Quick Capture` 快速录入新 lead。
4. 管理角色可通过 team pressure 入口进入 `/agent/notifications?activityView=team_cleanup`。
5. AI queue 中的建议只用于辅助判断；agent 必须确认后才会创建 follow-up 或复制 outbound draft。

### 6.2 Quick Capture / Lead Intake

入口：Dashboard 或 Clients 页面。

使用方式：

1. 打开 Quick Capture。
2. 输入或粘贴客户信息，也可粘贴聊天记录 / 上传截图进行 OCR / transcript assist。
3. 检查系统提取出的 recognized、manual confirmation、not extracted 分组。
4. Acre 只把 `Name`、`Budget`、`Target Area`、`Follow-up Status` 写入结构化字段；其他信息应进入 editable `Note`。
5. 若出现 duplicate warning，先打开已有 dossier 对比，再决定 merge 或创建独立 dossier。
6. 保存后进入客户 follow-up queue。

### 6.3 Clients / CRM Workbench

路径：`/agent/clients`

用途：轻量客户跟进工作台。

默认列表重点显示：

- Name
- Budget
- Target Area
- Follow-up Status
- Last follow-up
- Next reminder
- Note

使用方式：

1. 使用 `clientView` lanes 查看 all、follow first、anchor now、viewing lane、boundary review、duplicate review。
2. 按 follow-up status 更新客户状态：new lead、active follow-up、waiting reply、appointment booked、paused。
3. 设置或调整 next reminder。
4. 处理 duplicate review 时，确认 surviving dossier 后执行 merge。
5. 点击客户进入 `/agent/clients/[clientId]`。

### 6.4 Client Dossier

路径：`/agent/clients/[clientId]`

用途：单个客户的轻量执行页面。

使用方式：

1. 查看客户关键字段、预算、目标区域、note 和 follow-up 状态。
2. 使用 follow-up rail 创建或完成 follow-up task。
3. 查看 appointment cards，并通过 `Open calendar writeback` 回到对应预约处理页。
4. 查看 send records、listing-output、offer bridge、inspection support、AI accepted action history 等 secondary sections。
5. 必要时下载 client summary PDF。
6. 当工作需要正式交易、offer、inspection、signature 或 accounting 时，从 dossier 的 Back Office handoff link 进入对应 Back Office 模块。

### 6.5 Calendar / Event Hub

路径：`/agent/calendar`

用途：查看个人 appointment、office events、mandatory commitments，以及外部日历桥接后的 writeback。

使用方式：

1. 在 month / week / day view 中查看日程。
2. 使用 lanes 查看 reply due、confirmation pending、externally confirmed、touch due、missing next touch、reschedule requested、bridge logged、touch scheduled、writeback pending。
3. 打开 appointment 后，可跳转到 Google Calendar、Outlook、下载 ICS 或复制 client-facing email brief。
4. 完成外部操作后，保存 writeback 状态：needs follow-up、awaiting confirmation、confirmed、reschedule requested。
5. 设置 next external touch 和 note，让后续提醒进入 dashboard / notifications。

### 6.6 Activity + Cleanup Center

路径：`/agent/notifications`

用途：Front Office 统一活动和 cleanup 中心。

使用方式：

1. 使用 focus area 查看 personal cleanup、team cleanup、appointment reminders、notices。
2. 处理 due follow-up、stale clients、tracked-send risk、duplicate review、near-term appointments、shared office events。
3. 使用 filters 按 reminder type 和 read state 筛选。
4. 标记 read / unread 或 clear 当前可见 notices。
5. 对 cleanup digest run items 标记 done、skipped、later 或 reopened。
6. 点击卡片 deep link 回到客户 dossier 的具体 section、calendar lane 或 clients duplicate review。

### 6.7 Projects / Project Signing

路径：`/agent/projects`

用途：开发商销售 / 项目类文件签署和归档入口。

使用方式：

1. 创建 project，使用项目名称 / 地址作为主入口；project code 为内部生成。
2. 上传或选择 project-sales templates。
3. 在 `/agent/projects/templates/[templateId]/fields` 配置 reusable PDF field placement。
4. 创建 signing session，选择 remote send 或 in-person handoff。
5. Remote signer 使用 `/sign/session/[token]`，handoff signer 使用 `/sign/handoff/[token]`。
6. 签署完成后下载 secure signed copy，并进入 archive / sink 处理。

注意：外部 signer 不进入 Front Office shell。Project signing 不应新增平行 `/office/projects` route。

### 6.8 Front Office Resources

路径：`/agent/resources`

用途：经纪人查找文档、供应商和 training videos。

使用方式：

1. 在 tab 中选择 documents、vendors、training。
2. 使用搜索定位资源。
3. 打开 document 或 video；供应商信息用于人工联系。
4. 资源由 Back Office `Office Resources Publisher` 管理。

### 6.9 Training

路径：`/agent/training`

当前会进入 Front Office 资源 / training 相关体验。培训视频和资料由 admin 在 `/office/resources?tab=training` 发布。

### 6.10 Front Office Profile Settings

路径：`/agent/settings/profile`

用途：维护 agent 自己的公开资料和头像。

使用方式：

1. 更新公开展示姓名、title、phone、bio 等资料。
2. 上传 avatar，系统会裁剪预览并标准化为 512 x 512 WebP。
3. Email 变更仍应通过 Admin Office request 或管理员流程处理。
4. Listing Studio public contact cards、poster、template outputs 会复用当前 profile / avatar。

## 7. Listing Studio 使用说明

入口：`/listing-studio/listings`

Listing Studio 属于 Front Office 的 listing-output 模块，用来把外部房源整理成客户可读材料。

### 7.1 安装和连接 Chrome Extension

路径：`/listing-studio/extension/install`，连接入口在 `/listing-studio/listings`

使用方式：

1. 进入 Listing Studio Listings。
2. 如果页面提示未连接扩展，点击 connect / install。
3. 按页面指引打开 Chrome Web Store 或扩展设置。
4. 安装后回到 Listing Studio，页面会继续 extension challenge + token 授权。
5. 成功后即可在 StreetEasy / Zillow 房源详情页看到 `Save to Acre` 浮层。

### 7.2 从 StreetEasy / Zillow 保存房源

使用方式：

1. 在 Chrome 打开支持的 StreetEasy 或 Zillow 房源详情页。
2. 等待右下角 Acre 浮层识别房源。
3. 检查浮层中的标题、地址、价格、facts、缩略图。
4. 点击 `Save to Acre`。
5. 扩展会采集 source URL、raw HTML、canonical fields、image urls、facts、amenities、transit、floor plans 等信息。
6. 保存成功后点击 `Open in Acre`，或回到 `/listing-studio/listings` 查看。

### 7.3 Company Dashboard

路径：`/listing-studio/dashboard`

用途：公司公盘 feed。

使用方式：

1. 查看 office admin 发布给全员的 company feed listings。
2. Agent 点击 `+ Add to my listings` 收录到个人 workspace。
3. 已收录的卡片会显示完成态。
4. 只有具备 `listing_studio:company_manage` 的管理员可以发布 / 下架 company feed。

### 7.4 My Listings

路径：`/listing-studio/listings`

用途：当前 agent 的个人 saved listings 工作台。

使用方式：

1. 查看自己导入的 listing 和从 company dashboard 收录的 listing。
2. 使用搜索、source site、listing type 筛选。
3. 点击 card 进入 listing detail。
4. 在 card 上将 listing 加入或移出 collections。
5. 从 company dashboard 收录的 listing 可以移出个人 workspace；自己导入的 listing 可以完整删除。
6. 有 company manage 权限的 admin 可以将个人 pack 发布到 company dashboard。

### 7.5 Listing Detail

路径：`/listing-studio/listings/[packId]`

用途：编辑客户版 listing packet。

使用方式：

1. 查看 hero image、gallery、price、address、facts。
2. 使用 curated-page editor 编辑 headline、summary、bullet points、agent note、contact block。
3. 选择 cover asset 和 selected assets。
4. 查看 source facts、amenities、transit、property history、additional captured sections、floor plans。
5. 使用 monthly payment calculator 调整 home price、down payment、term、rate，估算 mortgage + HOA / common charges + taxes。
6. 使用 publish / export rail 保存、分享、导出 PDF、进入 poster studio 或扫描 public packet。
7. 在 marketing workspace 复制 caption、listing blurb、follow-up note、campaign bundle、delivery plan、template brief 和 campaign flight。
8. 不再需要的自有 listing 可删除；删除会清理相关导入快照、资产、share 事件和 PDF 缓存。

### 7.6 Collections

路径：`/listing-studio/collections`、`/listing-studio/collections/[collectionId]`

用途：把多个 saved listings 组织成客户短名单。

使用方式：

1. 在 Collections 创建 collection / folder。
2. 进入 collection detail。
3. 点击 `Add listings` 多选加入房源。
4. 查看 collection card grid。
5. 使用 map 查看编号 pins；点击 POI filter 查看 supermarket、subway、restaurant、coffee、nightlife 等周边点位。
6. 点击 `Share` 生成公开 collection link。
7. 使用 `Copy with message` 或 `WeChat card` 复制分享内容。
8. 删除 collection 前确认不会再用于客户沟通。

### 7.7 Shares

路径：`/listing-studio/shares`

用途：查看 collection share activity。

使用方式：

1. 查看 shared collections。
2. 检查 listing count、link status、share count、view count、last shared、last viewed。
3. 对客户重新分享时，从 collection detail 复制最新链接。

限制：Shares 不记录收件人身份，不做 resend workflow，也不自动发送。

### 7.8 Public Share Pages

客户公开页面：

- `/share/packs/[code]`
- `/share/collections/[code]`

使用方式：

1. Agent 从 Listing Studio 复制 share link。
2. 手动发给客户。
3. 客户打开后看到移动端友好的 listing / collection 页面。
4. Collection share 会记录 opened event，用于 `/listing-studio/shares` view count。
5. 客户页不会显示 source-site labels，也不会提供自动 `Schedule a Viewing` CTA。

### 7.9 Poster / Template Export

路径：`/listing-studio/listings/[packId]/share`

使用方式：

1. 选择 poster 模板：hero、editorial、card、cinematic、grid。
2. 选择 Listing status：JUST LISTED、IN CONTRACT、PRICE REDUCED、OPEN HOUSE、SOLD。
3. 选择主图。
4. 检查 preview 中 agent contact block。
5. 导出 SVG / HTML / PNG，PNG 为 2160 x 2880。
6. 需要打印时使用 print / HTML output。

Poster artwork 不注入 Acre / Listed / source-site branding 或 QR block；public packet link 仍可单独分享。

## 8. 外部流程说明

### 8.1 邀请链接

路径：`/invite/[token]`

管理员创建用户后复制链接给内部成员。用户设置密码后成为 active membership。

### 8.2 HR 入职上传窗口

路径：`/onboarding/[token]`

由 HR onboarding 流程生成。外部人员不需要登录，通过 token 上传指定文件。token 不应公开发布到群聊或网站。

### 8.3 远程签署

路径：`/sign/session/[token]`

外部 signer 通过安全链接查看 PDF packet，填写自己负责的字段，签署并确认。Signer 不进入 Acre 内部工作区。

### 8.4 现场交接签署

路径：`/sign/handoff/[token]`

用于 in-person handoff。链接是 token-only、会过期，不需要 agent exit PIN。签署前仍应让客户完整查看合同内容。

### 8.5 QuickBooks Connect / Disconnect

路径：`/quickbooks/connect`、`/quickbooks/disconnect`

这些是 QuickBooks OAuth 回调 / 连接辅助入口，日常管理员应从 `Settings > QuickBooks` 操作，而不是直接访问回调页。

### 8.6 Legal Pages

公开法律页面包括 privacy、terms、Acre Back Office EULA、Listing Studio Extension Privacy 等。它们用于外部合规展示，不是日常业务工作台。

## 9. 推荐日常工作流

### 9.1 经纪人每天怎么用

1. 登录后进入 `/agent/dashboard`。
2. 先处理 Next Actions。
3. 使用 Quick Capture 新增 lead。
4. 进入 `/agent/clients` 处理 follow-first 和 anchor-now。
5. 对有预约的客户进入 `/agent/calendar` 做 bridge + writeback。
6. 对需要房源材料的客户进入 Listing Studio，保存或整理 listing packet。
7. 对需要正式交易、签署、offer 或会计处理的事项，从客户 dossier handoff 到 Back Office。

### 9.2 Office Admin 每天怎么用

1. 进入 `/office/dashboard` 查看 overdue、recent transactions、payout reminders。
2. 进入 `/office/transactions` 处理新交易和异常交易。
3. 进入 `/office/tasks` / `/office/approve-docs` 处理审核队列。
4. 进入 `/office/mail` 和 `/office/notifications` 处理内部沟通与提醒。
5. 进入 `/office/accounting` 处理 payout statements，必要时查看 `/office/1099-tracker`。
6. 进入 `/office/settings/users` 管理邀请、权限、团队和 agent profile。

### 9.3 Accountant 每天怎么用

1. 从 `/office/reports` 和 `/office/performance` 查看交易与业绩数据。
2. 在 transaction detail 核对 Finance / Commission。
3. 在 `/office/accounting` 选择 agent、检查 candidates、生成 statement。
4. 处理 agent review 后的确认或 revision request。
5. 在 `/office/1099-tracker` 维护年度 payout backup。

### 9.4 HR 每天怎么用

1. 进入 `/office/hr` 查看 candidates、interviews、onboarding、offboarding。
2. 安排面试或更新 candidate status。
3. 创建 onboarding token 并让候选人上传文件。
4. 发起 HR signature request。
5. 使用 AI draft 生成草稿后人工发送。

### 9.5 Listing Studio 工作流

1. 在 StreetEasy / Zillow 保存房源。
2. 回到 `/listing-studio/listings` 打开 packet。
3. 编辑客户版 headline、summary、photos、contact block。
4. 加入 collection。
5. 生成 collection link 或 pack link。
6. 导出 PDF / poster / marketing kit。
7. 手动发送给客户，并在后续跟进中记录回客户 dossier。

## 10. 常见问题

### 看不到某个菜单怎么办？

先确认当前 company 是否正确，再确认角色和权限。仍看不到时，让 office admin 在 `Settings > Users` 检查 membership status、role、office access 和 permission overrides。

### 创建用户后为什么对方没收到邮件？

当前邀请不会自动发邮件。管理员需要复制 invite link，手动发给用户。

### 为什么 AI 建议没有自动创建任务或自动发送消息？

Acre 当前坚持 review-first。AI 建议必须由 agent 接受后才会创建 follow-up 或生成可复制草稿，不会自动外发。

### Billing 里看到 payment method 是否表示可以自动扣款？

不是。当前 payment method 是 masked internal reference，不代表已接入真实支付处理器。

### Listing Studio 分享是否知道客户是谁？

当前 collection share 记录 link copied / opened count，不记录收件人身份，也不做自动发送或 resend。

### Activity Log 和 Notifications 有什么区别？

Activity Log 是审计流水，记录系统动作和变更。Notifications 是个人 inbox，提示你现在需要处理什么。

### Front Office 客户什么时候要进入 Back Office？

当事项进入正式交易、offer、inspection、documents、signature、commission、accounting 或 archival workflow 时，应 handoff 到 Back Office。

## 11. 当前明确限制

- 不支持 forgot password。
- 不支持 2FA / OAuth / SSO。
- 邀请链接不自动邮件发送。
- Front Office 不自动发送短信、微信或邮件。
- Listing Studio 不做 scheduled campaign、Canva sync、batch import 或自动重抓。
- Billing 不做真实 card / ACH processing。
- 一些外部 integration 使用 bridge / writeback，而不是完整双向同步。
- 生产文件存储当前仍以本地 filesystem 为主，后续可能替换为 object storage。

