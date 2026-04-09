# Office Design System

## 单一系统原则

`Acre` 全站只能存在一套设计系统。

这条规则覆盖：

- `Front Office`
- `Back Office`
- `Login`
- shared app shell
- mobile rails
- detail/list/workspace templates

允许存在的差异：

- 信息密度不同
- 导航结构不同
- 工作优先级和模块顺序不同

不允许存在的差异：

- 第二套视觉品牌
- 第二套路由级页面模板
- 第二套按钮 / 卡片 / 表格 / 表单语言
- 第二套 class 命名体系长期并行存在

执行要求：

- `@acre/ui` + `office-*` 是唯一 canonical UI foundation
- `Front Office` 只能作为同一系统里的前台工作区，不是另一套产品视觉
- 发现 live 页面仍依赖 `bm-*` 或其他 page-local 视觉体系时，应视为迁移债务并逐步收敛
- 新功能禁止继续扩张第二套设计语言

## 目标

`Office / Back Office` 现在使用统一的视觉系统，目标是贴近 `BoldTrail / Brokermint` 的后台产品气质：

- 信息密度高，但可扫读
- 中性、克制、偏运营后台
- 表格 / 列表 / detail section 优先
- 尽量减少页面级一次性样式

2026 refresh 之后，这套系统还承担更明确的品牌统一责任：

- 视觉方向改成更偏 Apple 式企业感，而不是旧式暖色后台
- `Office`、`Agent`、`Login` 三套界面都必须属于同一家产品家族
- 允许保留 `bm-*` 兼容层，但输出只能服从同一套 token 和组件节奏

这个系统不是独立组件库产品，而是当前仓库里给 `Office` 页面使用的共享 UI 约束。

## 字体策略

- 全局主字体通过 [apps/web/app/layout.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/layout.tsx) 加载 `Inter`
- 变量名：`--font-office-sans`
- Office 页面真正消费的共享 token 是 `--office-font-sans`
- `--office-font-sans` 必须包含明确的 CJK fallback，当前基线包含 `PingFang SC`、`Hiragino Sans GB`、`Microsoft YaHei`、`Noto Sans SC`、`Source Han Sans SC`
- `Office` 页面不再各自选字体，也不要混用新的主字体

默认层级：

- 页面标题：`PageHeader h2`
- 页面说明：`PageHeader p`
- section 标题：`SectionHeader h3`
- 列表列头：大写、较小字号、较高字重
- 正文：常规 14px-16px 区间
- 辅助说明：`text-muted`
- 数值摘要：`StatCard strong`

当前规范化字号 token：

- page title：`--office-text-page-title-size`
- page subtitle：`--office-text-page-subtitle-size`
- section title：`--office-text-section-title-size`
- subsection / inline title：`--office-text-subsection-title-size`
- body：`--office-text-body-size`
- meta / helper：`--office-text-meta-size`
- label / badge / table micro text：`--office-text-label-size`
- table header：`--office-text-table-head-size`
- stat value：`--office-text-stat-size`

规则：

- 同一级信息不要再随页使用 1-2px 的随意字号漂移
- heading 统一高字重、紧字距；meta 统一偏小、偏灰、较宽行高
- 后台页面不使用 marketing 风格的大字重装饰文本
- 不要再在页面 CSS 里散落硬编码 `"Helvetica Neue"`、`Arial` 这类局部字体栈；统一走 `var(--office-font-sans)`

## Tokens

主要 tokens 定义在 [apps/web/app/globals.css](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/globals.css)：

- 字体：`--office-font-sans`
- 背景 / surface：`--office-bg`、`--office-surface`、`--office-surface-muted`
- 文本：`--office-text`、`--office-text-muted`
- 边框：`--office-border`、`--office-border-strong`
- 强调色：`--office-accent`、`--office-accent-strong`
- 状态色：`--office-success`、`--office-warning`、`--office-danger`
- 阴影：`--office-shadow-sm`、`--office-shadow-md`
- 圆角：`--office-radius-sm`、`--office-radius-md`、`--office-radius-lg`
- 间距：`--office-space-*`
- focus：`--office-focus-ring`

规则：

- 新的 `Office` 页面不要硬编码随意颜色、间距、圆角
- 如果找不到合适 token，先补 token，再写页面
- 顶层壳层也要跟 token 走：`app-shell`、sidebar、mobile rail、auth shell、agent shell 不再各自发展第二套品牌语言

## 共享组件

共享 primitives 在 [packages/ui/src/index.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/packages/ui/src/index.tsx)：

- `PageShell`
- `PageHeader`
- `PageHeaderSummary`
- `OfficeListPageSummary`
- `OfficeListPage`
- `SectionHeader`
- `SectionCard`
- `ListPageSection`
- `ListPageTableSection`
- `ListPageStack`
- `ListPageSplit`
- `DetailSection`
- `FormSection`
- `FilterBar`
- `ListPageFilters`
- `FilterField`
- `StatCard`
- `SummaryChip`
- `ListPageStatsGrid`
- `ListPageFooter`
- `DataTable`
- `DataTableHeader`
- `DataTableBody`
- `DataTableRow`
- `HorizontalScrollArea`
- `FormField`
- `TextInput`
- `SelectInput`
- `TextareaInput`
- `Button`
- `Badge`
- `StatusBadge`
- `EmptyState`
- `QueueItem`
- `SecondaryMetaList`

Office 路由级 canonical 组合层：

- [apps/web/app/office/_components/office-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/_components/office-list-page-template.tsx)

使用原则：

- 新页面优先复用这些 primitives
- 如果页面里出现第二次相同结构，就优先考虑提到 `@acre/ui`
- 不要给单个页面再发明一套新的 button / card / filter bar
- `Agent` 页面也优先通过这些 primitives 组织页头、summary、section card，而不是继续保留 marketing 风格 hero/card 体系

表格 / 图表补充规则：

- 宽表优先通过共享滚动容器解决可达性，不要靠夸张的首列宽度吃掉整行空间
- `name`、`title`、`transaction` 这类主列应该保留可读性，但不能默认独占过大的 `fr` 比例
- 辅助列尽量收紧到内容所需宽度附近，把横向空间让给真正会换行的主信息
- dashboard / summary 图表的底板应是功能性的矩形容器，不要使用会误导成“数据本体”的大面积装饰性胶囊背景

## Heading Hierarchy

统一层级：

1. 页面标题：`PageHeader`
2. section / module 标题：`SectionHeader`
3. detail / subsection 标题：`DetailSection` 或 section 内二级 heading
4. inline mini heading：使用统一的小号大写 label，而不是 `strong` 冒充标题

规则：

- 同级页面标题必须同一视觉等级，不再混用 `bm-page-heading`、裸 `h2`、大号 `strong`
- card / module 标题统一跟 `SectionHeader` 走，不再单页自定义一套 head chrome
- `bm-card-head` 仍可作为迁移桥，但视觉输出要与 `office-section-head` 保持一致

## Button Hierarchy

当前 canonical button hierarchy：

- primary：`Button` / `office-button`
- secondary：`Button variant="secondary"` / `office-button-secondary`
- ghost / tertiary：`Button variant="ghost"`
- destructive：`Button variant="danger"`
- inline action：`office-inline-action`
- toggle / segmented link：复用 secondary button 外观，不再单独发展另一套 toggle 视觉

规则：

- 同优先级动作必须长得一样
- 旧的 `bm-create-button`、`bm-view-toggle`、`bm-transactions-page-button`、`bm-contacts-page-button` 视为兼容层，不再作为新页面的首选
- link-style actions 优先复用同一套按钮尺寸、圆角、hover 和 focus 状态
- 任务、通知、审批队列里的行级动作也必须回到这套按钮等级，不再允许 page-local action chrome 漂移
- 所有 destructive action，尤其是 `Delete / Remove / Unlink / Reset` 这类会移除记录、关联、行项目或覆盖的动作，不允许一击执行；必须先经过统一的确认弹窗，再进入真正的删除/移除请求

## 页面模板规则

### List pages

适用：

- `/office/transactions` 是 canonical source of truth
- `Transactions`
- `Contacts`
- `Agents` roster
- `Reports` 的 list / table sections
- `Accounting` 的 list / workbench sections
- `Settings` users / teams / checklists / fields
- `Tasks`
- `Notifications`
- `Approve docs`

推荐结构：

1. `OfficeListPage`
2. `OfficeListPage.summary` 使用 `OfficeListPageSummary`
3. `OfficeListPage.actions` 单独承载页头按钮
4. `OfficeListPageSummary` 内只放 `SummaryChip` / scope / KPI 类摘要
5. `ListPageTableSection`
6. `ListPageFilters`
7. `DataTable` 或共享 `office-table-*` / `office-list-table-*` table contract
8. `ListPageFooter` / `office-list-footer`

补充结构规则：

- transactions 的 `PageHeader + SummaryChip + list card + filter bar + dense table + footer` 是 peer list pages 的直接参考，不要再为 contacts / agents / reports / accounting / settings 各自发明另一套 page composition
- `OfficeListPage` 是 transactions 提炼出来的 canonical page shell；当 contacts 之类的 peer list page 需要页头 + summary + table card 时，优先直接复用这个组合层，而不是每页重新手写 `PageShell + PageHeader + ListPageTableSection`
- transactions 和 contacts 现在共用 [apps/web/app/office/_components/office-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/_components/office-list-page-template.tsx) 作为 canonical route-level list template；后续 peer list page 应优先向这套 header/workbench/table/footer 骨架靠拢
- 现在优先使用 `ListPageTableSection` 把 `filters -> table/list -> footer` 固定成一套顺序，避免每页各自排列 inventory section
- 当一个页面需要多个 peer list modules 时，优先使用 `ListPageStack` 和 `ListPageSplit` 组织主列表与次级列表/明细区，而不是重新回到 `dashboard` 式 page-local grid
- 对于 settings / accounting / agent detail 里的“小型运营清单”，优先使用 `office-queue-list + QueueItem`，不要继续使用带大左侧标签栏的旧 `office-note-item`
- `office-note-item` 只保留兼容，不再作为 live page 的默认结构；一旦任务触到对应 section，应把该 section 迁到 `QueueItem`
- 如果页面还需要一层二级 summary，只能用 `ListPageSection + ListPageStatsGrid + StatCard`，不能再额外长出第二套 floating KPI strip
- settings admin 页也按 list page 看待：先 inventory/list，再 editor/admin block；不要直接从页头跳进大表单
- accounting / reports 允许保留多 section，但每个 section 也必须看起来像同一家族的 list-page card，而不是旧 `bm-card-head` 模块

补充约束：

- `Tasks`、`Notifications`、`Approve docs` 这类“过滤 + 工作清单”页面也必须走 `ListPageSection + ListPageFilters + StatusBadge` 合同，不能继续保留单页私有 `bm-table-card` / `bm-create-button` / `bm-status-pill` 视觉
- 页头按钮和 summary 必须拆开：按钮走 `OfficeListPage.actions` 顶部 action row，summary 走 `OfficeListPage.summary`
- `OfficeListPageSummary` 里不要再混放 CTA；`Create` / `Export` / `Open activity` / `Add comment` 这类入口都应落在 action row，避免按钮因为 summary chip 数量变化而左右漂移
- 页头 supporting 区保持 full-width workbench，但视觉顺序固定为“上方 actions、下方 summary”，不要让按钮插进 KPI 卡片之间
- 页头 summary 现已统一为“1 张 lead summary card + 若干 secondary summary chips”的站内标准；默认应把最能代表当前页面意图的摘要项放在第一位，并可显式标记为 featured
- featured summary card 可以带一句辅助说明，用来解释当前 focus / lane / stage / command lead；其余 summary chip 只保留简短 KPI / scope / state
- 桌面中间断点开始，如果页头或 section 右侧 action 会压缩标题说明，就应优先改成上下两行，不要让按钮覆盖说明文本
- header / section actions 内的按钮必须允许在窄宽下自然换行或折成两行文案，不能靠固定 `nowrap` 把标题区挤坏

### Detail pages

适用：

- transaction detail
- contact detail

推荐结构：

1. `PageShell`
2. `PageHeader`
3. `DetailSection` / `SectionCard`
4. section 间距统一，不要一页一个节奏

transaction detail 补充规则：

- `Overview` 和首个核心 workflow section 可以保持直接展开
- 当 detail 页进入长工作流堆栈时，优先把次级模块做成可折叠 section，减少整页默认高度
- 如果折叠状态需要记忆，必须按当前用户隔离，不要把一个人的展开偏好变成组织级默认
- 折叠外壳应复用同一套 card/header token，并避免展开后出现双层标题

### Workspace pages

适用：

- `Pipeline`
- `Activity`

推荐结构：

1. `PageShell`
2. `PageHeader`
3. 左 summary rail / 分类区
4. 右主工作区

### Cross-app shells

- `Office` shell、`Agent` shell、`Login` 页面共用一套字体、色板、边框、圆角、阴影和按钮层级
- 允许 `Agent` 信息密度略低于 `Office`，但不能回到独立的 marketing UI 视觉
- `/agent/dashboard` 现在按 `Front Office` 行动首页处理：页头仍用 `PageHeader + PageHeaderSummary`，内容仍用 `SectionCard / StatCard / SummaryChip / ListPageSplit / ListPageStack` 组织
- `Front Office` 与 `Back Office` 现在共享同一套页头 summary 结构：lead card 承载当前 focus / lane / stage / queue lead，剩余 chip 承载数量、scope、状态与窗口类信息
- `Front Office` 页面可以比 `Back Office` 更偏行动队列和对客输出，但不能复制正式 transaction / signature / accounting 工作流，也不能长出第二套 design language
- `Login` 允许更强的品牌氛围和更大的标题，但表单字段、按钮、badge 仍需复用共享输入/动作语法

## 表格 / 列表规则

- 优先高密度、可扫读，而不是大卡片
- 列头统一大写、小字号、高字重
- 宽表和摘要表要区分：
  - 宽表继续用共享横向滚动容器
  - 摘要双栏 / 状态汇总 / type 汇总这类短表不应该机械复用宽表拖拽条，应优先在栏内自适应排版
- 报表和 accounting 的 KPI / stat 区优先使用响应式 `auto-fit` 网格，避免在平板或窄桌面里挤成过窄高卡片
- `StatCard` 的高度应由内容主导，不要用过大的固定最小高度制造空白
- 共享业务表格现在支持 organization-level 列宽持久化：只有 `owner / office_admin` 可以拖拽列边界并保存，保存后同组织所有用户看到同一套列宽
- 以后新的 `/office` 表格默认必须把这套共享 Office table contract 当作模板；不要再为单页新造第四套私有表格系统

## Responsive rules

- `PageHeader`、`SectionHeader` 默认按 `content + actions` 双列组织；当动作区开始挤压正文时，优先切成单列堆叠
- `PageHeaderSummary`、`office-section-actions` 在桌面端默认右对齐，但只应按内容宽度占位，不能默认 `width: 100%`
- `SummaryChip`、KPI 卡、报表 stat strip 在窄桌面和平板上应自动换列，不要死守四列
- 移动端优先保证：
  - 标题和说明完整可读
  - 主动作可点
  - 摘要卡不出现异常细长比例
  - 二级汇总表优先单列堆叠，而不是每块都单独横向滚动
- 行 hover 要轻，不要 marketing 式大阴影
- 状态尽量用 badge / pill，不靠删除线或颜色堆砌
- 数字列尽量对齐，避免跳动
- header 和 body 必须共享同一套列定义，不允许各自单独算宽度
- 横向滚动只放在外层 table / workspace 容器，不放在单独行容器上
- 不要再用 row-level `width: max-content` 驱动布局；需要稳定宽度时，用 table 容器 `min-width`
- 文本列允许截断或换行，但不能把后续数值列挤偏
- 数值列默认右对齐并使用 `tabular-nums`
- badge / status 列保持左对齐，date 列允许使用更紧凑的 label + value 结构
- list pages 的 header actions 统一使用 `SummaryChip`，避免每页发明不同 KPI 小卡样式

### Dense table compaction

这一轮 Back Office 表格进一步统一成“信息加权”的紧凑分列规则：

- 主列最宽，只允许 1-2 个主列显著扩展
- 次级文本列使用中等宽度，不与主列均分空间
- 状态、计数、金额、日期、动作列必须是窄列或有明确上限
- `Actions` / `Open` / `Edit` 这类列只容纳内容本身，不预留大块空白
- cell padding、列间 gap、badge 高度都应优先服务 dense desktop workflow
- 当宽度不足时，优先容器横向滚动，不把 utility columns 拉宽到浪费空间

判断标准：

- 看列重要性分宽度，而不是“每列差不多宽”
- 短值列旁边不应该出现大面积空白
- 主列应明显更容易扫读，数字列应更容易纵向比较
- 收紧之后仍要保持专业、可读，不追求极限压缩

### 共享 table contract

Back Office 以后新增表格时，默认模板就是这套共享 Office table system。除非任务明确要求别的语义或不在 `/office` 壳层里，否则新表格先按这套合同实现。

首选落地顺序：

1. `@acre/ui` 的 `DataTable / DataTableHeader / DataTableBody / DataTableRow`
2. 对应的共享 row contract：`office-table-header + office-table-row-*` 或 `office-list-table-header-* / office-list-table-row-*`
3. 保持在 `/office` shell 下，让共享列宽运行时和 organization-level 列宽持久化自动接管

当前允许的合法实现只有两种，不能再混入第三套页面私有表格：

1. `@acre/ui` 的 `DataTable / DataTableHeader / DataTableBody / DataTableRow`
2. 原生 `<table>`，但仅限语义上确实更合适时使用，并且仍要接入共享 Office table contract

共同要求：

- 表头和数据行必须使用完全相同的 `grid-template-columns`
- row class 负责定义列模板和 `min-width`
- 外层容器负责 `overflow-x: auto`
- 页面只补本页需要的列模板，不再重复定义一整套 table chrome
- 如果列宽被组织级设置覆盖，页面本地 CSS 只提供默认初始宽度，不应再试图绕过共享列宽运行时
- 可调列的拖拽线统一贴在当前列的左侧边界；第一列不显示拖拽线，其余列都从自己的 leading edge 开始拖拽
- 列拖拽 hover / active 态只高亮当前正在操作的那一条边界，不要把整表所有边界同时点亮
- 如果某张表需要把表头和内容都做左对齐，优先在该 row contract 上统一处理，不要为了拖拽观感去全站一刀切改所有数字列/金额列
- 原生 `<table>` 如果用于 `/office`，类名也必须保持在共享可识别范围内，例如 `office-*table` 或现存兼容层 `bm-*table`，并保留 `thead`，这样共享列宽逻辑才能接管
- 非 `/office` 路由不会自动获得这套运行时；如果未来要在别的壳层复用，必须明确扩展共享 contract，而不是复制一份页面本地脚本

## Migration boundary

- `bm-*` 仍是过渡兼容层，不应再扩张
- 新的 UI 工作优先改共享 token、共享 primitives、canonical page composition
- 新任务不得新增 `bm-*` markup；如果页面里仍有 `bm-*`，优先把触达的 shell、列表、card 或 action 区迁回 `office-*` / `@acre/ui`
- 如果必须继续使用 `bm-*` markup，至少要让它的颜色、边框、按钮、表单、badge 和 spacing 输出与 `office-*` 完全一致

## Card / Module Surface 规则

当前 Office 模块 surface 统一到这几个层级：

- page shell：`PageShell`
- page header：`PageHeader`
- standard module surface：`SectionCard`
- detail surface：`DetailSection`
- stats / KPI surface：`StatCard`
- workspace side / rail panel：在 `office-section-card` 或共享 workspace panel 规则上扩展

规则：

- 同等级模块必须共享相近的 border、radius、padding、shadow 强度
- 不再允许 `bm-table-card`、`bm-detail-card`、`bm-goal-card`、`bm-transactions-card` 继续各自像不同产品
- 页面局部需要特殊布局时，优先在共享 surface 上加变体类，而不是重新定义新 card family

## Detail Grid 规则

- detail / profile / finance / settings form 的信息块优先使用共享 `office-detail-grid` + `office-detail-field`
- `bm-detail-grid` / `bm-detail-field` 目前仍兼容，但只是迁移桥
- 同类信息块保持统一：
  - label 在上
  - value / input 在下
  - 宽字段使用统一的 `*-field-wide`
  - action row 使用共享的 form action contract

## Badge / Status 规则

- 统一使用 `Badge` 和 `StatusBadge`
- `bm-status-pill`、旧的 transaction / task / alert 状态 pills 应当映射到同一套 tone 语言：
  - neutral
  - accent
  - success
  - warning
  - danger
- 不再按页面单独发明 badge 尺寸、圆角和字体
- `Tasks`、`Approve docs`、`Pipeline` 里的状态展示应优先迁到 `StatusBadge`，避免同一 Office 同时出现多套状态 pill

## Migration 规则

- `office-*` + `@acre/ui` 是现在唯一的 canonical Office system
- 旧 `bm-*` 类允许保留一段时间作为兼容层，但它们的视觉应该被共享规则接管
- 新任务里如果碰到 `bm-*` 页面：
  - 优先迁到 shared primitive
  - 或至少把它映射回 canonical `office-*` 视觉层
- 当前 live 页面优先统一到这些 canonical 家族：
  - page shell：`office-page-shell`、`office-transactions-page`、`office-transaction-detail-page`
  - modal：`office-modal-*`、`office-create-modal-*`
  - actions / errors：`office-button*`、`office-toggle-link`、`office-inline-error`、`office-form-error`
  - detail / form fields：`office-detail-field`、`office-form-field`、`office-modal-field`
- 新的 live 页面和对现有 live 页面的修改，不再直接引入 `bm-modal-*`、`bm-create-button`、`bm-view-toggle`、`bm-transaction-detail-page` 这类旧壳层类名
- 不要在 `office-*` 和 `bm-*` 之外再创造第三套页面私有视觉系统

## Responsive 规则

`Office / Back Office` 采用 desktop-first 的响应策略，重点不是手机优先，而是保证窄一点的桌面和笔记本宽度仍然稳定、可操作。

### 断点

- `<= 1360px`
  进入第一层 laptop hardening：
  - 过滤条开始更积极换行
  - 双栏 workspace / detail 区开始允许纵向堆叠
  - summary cards 从 4/3 列收成 2 列
- `<= 1120px`
  进入窄笔记本模式：
  - 多数 summary grid 收成 1 列
  - 表单网格优先收成 1 列
  - Activity / Pipeline / Accounting 的并排区域应改为上下结构
- `<= 980px`
  保持 desktop shell，但进一步缩紧 sidebar 和 page padding
- `<= 820px`
  进入当前已有的 mobile rail / sidebar collapse 行为

### 表格溢出策略

- Back Office 列表优先保持列语义，不要把桌面表格硬压成不可读窄列
- 当宽度不足时：
  - 表格容器横向滚动
  - 不让整页横向滚动
  - 关键 dense 表格要有明确 `min-width`
- 适用至少包括：
  - Transactions
  - Contacts
  - Tasks
  - Accounting
  - Agent Billing ledger
  - Reports 里的表格区

### List footer / pager

- `Transactions`、`Contacts`、类似 admin list page 的底部分页区不再继续各自保留一套 page-local footer / pager 皮肤
- 统一使用共享 list footer contract：
  - `office-list-footer`
  - `office-list-footer-controls`
  - `office-list-page-size`
  - `office-list-pager`
  - `office-list-page-button`
  - `office-list-page-indicator`
- 旧 `bm-transactions-*` / `bm-contacts-*` footer class 只保留兼容，不再作为新页面的 canonical 结构

### Filter Bar 换行策略

- 过滤条和 action bar 在 laptop 宽度下必须允许换到多行
- 行为原则：
  - filters 可缩，但不能缩到不可操作
  - primary / secondary actions 在换行后仍然可见
  - query-param 行为不变，只改布局

### 双栏 / 侧栏堆叠策略

- `main + side panel` 或 `left rail + right content` 结构在较窄桌面宽度下应改为上下堆叠
- 当前重点适用：
  - Accounting
  - Activity
  - Pipeline
  - detail page 的双栏信息区

### Summary Card 策略

- wide desktop：允许 3-4 列
- narrow laptop：优先收成 2 列
- 必要时收成 1 列
- 不要让卡片为了保留列数而被压成不稳定高度或极窄内容块

## Responsive 实施细则

这一轮不是补充“原则”，而是把原则真正落到了共享层和关键页面上。

### Office shell

- `<= 980px`
  - `Office` 侧边栏不再继续强撑桌面双栏
  - 主内容改成单列
  - 使用 `office-mobile-rail` 保持主要导航可达
- 目标不是手机优先，而是避免窄笔记本把主内容压坏

### 表格实现策略

- `DataTable / office-table / bm-office-table` 统一使用局部横向滚动
- 宽表除了局部横向滚动之外，还必须提供显式可见的底部拖拽条；不要把“能不能横向拖动”完全交给系统原生滚动条显示策略
- 规则：
  - 容器自己滚动
  - 不允许整页跟着横向滚动
  - 行和表头保留明确 `min-width`
  - header/body 不再各自使用不同宽度算法
  - 重要 dense 表格不改成 stacked cards
- 当前已明确加固：
  - Transactions
  - Contacts
  - Tasks
  - Accounting
  - Agent Billing ledger
  - Reports tables
  - Pipeline list/table
  - Agents roster

### Filter / action bar 实施策略

- 过滤条、操作条、页头 action 区统一允许换行
- 输入控件保持合理最小宽度
- action buttons 保持 `flex: 0 0 auto`
- 任何“人名 / 成员 / agent / owner / team leader / assignee”选择器都必须优先使用可搜索的 combobox / picker，不要再用原生长下拉；名单规模按几百人也要能快速定位
- 复杂表单页继续优先使用共享 class：
  - `office-filter-bar`
  - `office-report-filters`
  - `office-page-actions`
  - `office-section-actions`
  - `office-filter-actions`

### 双栏 / side-panel 实施策略

- 以下布局在 laptop 宽度下优先堆叠，而不是继续横向硬挤：
  - Accounting
  - Activity
  - Pipeline
  - detail pages with secondary panel
- 共享 class：
  - `office-detail-two-column`
  - `bm-accounting-grid`
  - `bm-activity-layout`
  - `office-pipeline-layout`

### 已重点加固的页面

- `/office/dashboard`
- `/agent/dashboard`
- `/office/transactions`
- `/office/contacts`
- `/office/tasks`
- `/office/activity`
- `/office/accounting`
- `/office/reports`
- `/office/pipeline`
- transaction detail
- contact detail

如果新增 `Office` 页面也落在这些结构类型里，优先复用这些共享 class，不要重新写页面级媒体查询。

## 详情 section 规则

- section 表面统一用浅色 surface + 细边框
- label/value 模式统一
- 不要一个 detail section 用表单样式，另一个像 marketing card
- `contacts / finance / tasks / overview` 都应该像一个产品的一部分

## 表单规则

- 统一使用：
  - `FormField`
  - `TextInput`
  - `SelectInput`
  - `TextareaInput`
  - `Button`
- 字段语义可以不同，但控件风格不要再分裂
- modal 里的输入也尽量走同一视觉系统

## 导航规则

- 导航保持密集、稳定、运营后台感
- 分组标题统一大写和较高字重
- 激活态用克制的深蓝，不用过多装饰
- 不改 IA 时，尽量只做视觉统一，不动结构

## 当前覆盖范围

这套设计系统已经开始用于这些关键页面：

- `Dashboard`
- `Transactions`
- `Contacts`
- `Tasks`
- `Activity`
- `Accounting`
- `Reports`
- `Pipeline`
- transaction detail
- contact detail

仍有旧类名存在，这是兼容式重构的一部分。当前策略不是一次性重写全部 markup，而是：

- 先统一 token 和 primitives
- 再逐步把旧 `bm-* / office-*` 样式收口到同一视觉系统

## 后续新增页面要求

以后新增 `Office` 页面时：

1. 先看这个文档
2. 优先复用 [packages/ui/src/index.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/packages/ui/src/index.tsx)
3. 尽量不要新增页面专属 button / card / table 皮肤
4. 如果需要新模式，先判断是否应该进入 `@acre/ui`
5. 如果页面包含 dense table / filter bar / 双栏 detail，先按上面的 responsive 规则处理，不要再让页面在 laptop 宽度下被横向挤坏
