# Front Office Parallel Execution Plan

## Purpose

This document captures the validated `10-thread` execution plan for completing the current `Front Office` push.

It exists so the team can launch parallel implementation work without relying on chat history, while keeping:

- one shared `Front Office` product direction
- one clear `FO -> BO` boundary
- explicit file ownership per thread
- explicit compatibility rules for shared snapshot/data contracts

## Use this file when

- the team wants to split FO work across multiple threads or engineers
- the team needs copy-ready thread prompts
- the team needs the validated ownership/compatibility rules that reduce merge conflicts

## Validation fixes already applied

This version already incorporates the acceptance fixes that were required before the plan could be considered ready:

1. `Thread 10` now includes the real BO transaction API write path that calls `commitFrontOfficeHandoffDraft(...)`, so the handoff flow is actually closed end-to-end.
2. `Thread 04` is now explicitly limited to backward-compatible enhancement of `packages/db/src/front-office-clients.ts`; it may not reshape the dossier snapshot or break `aiSuggestions` consumers.
3. `Thread 05` is now explicitly required to keep `packages/db/src/front-office-ai.ts` backward-compatible for listing output and existing dossier/dashboard consumers.
4. `Thread 06` is now explicitly required to keep the appointment exports that feed other FO snapshots backward-compatible.
5. `Thread 01` and `Thread 09` are now explicitly forbidden from breaking the snapshot shapes already consumed by `/agent/notifications`.

## Working rules

- Every thread prompt below is complete and copy-ready.
- The shared preface is already embedded into each prompt. There is no separate `11th` preface thread.
- Each thread should edit only its owned files.
- If a thread believes another file must change, it should stop and report a blocker instead of crossing ownership boundaries.
- Threads should not assume hidden chat context; this file is the source of truth for the parallel work split.

## Thread 01

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- apps/web/app/agent/dashboard/page.tsx
- apps/web/app/agent/dashboard/front-office-dashboard-ai-queue-client.tsx
- apps/web/app/api/agent/dashboard/route.ts
- packages/db/src/front-office-dashboard.ts

额外兼容性规则：
- 不得破坏 `/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/agent/notifications/page.tsx` 当前依赖的 dashboard snapshot shape，特别是 leadership queue 与通知页当前消费字段。

任务：
- 把 `/agent/dashboard` 打磨成真正的 FO 启动台，不再像“说明板”。
- 强化今日执行、follow-up pressure、AI queue、send/click、handoff、leadership cleanup 的信息层级和 CTA。
- 清理 honest-state / placeholder 风格文案，但不能夸大未实现能力。
- 优化空状态、跳转路径、反馈文案、队列动作完成后的回显。
- 保持现有对其他页面的链接契约尽量稳定。

完成标准：
- dashboard 对 agent / lead / admin 的可见重点更清楚。
- 页面第一屏就能告诉用户“现在最该做什么”。
- 不引入新的跨模块依赖，也不修改其他线程文件。
```

## Thread 02

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- apps/web/app/agent/_components/front-office-lead-intake-card.tsx
- apps/web/app/agent/_components/front-office-lead-intake-assist.ts
- apps/web/app/agent/_components/front-office-lead-intake-review.ts
- apps/web/app/api/agent/clients/route.ts

任务：
- 强化 OCR / transcript assist 的 review-then-apply 体验。
- 提升字段置信度、provenance、手工覆盖、错误提示、坏输入处理、空状态引导。
- 把 duplicate warning 的前置提示做得更清楚，但不要做 merge UI。
- 提升 create lead API 的输入校验和错误可读性。
- 全程坚持 `No auto-create / No auto-send`。

完成标准：
- 用户从截图或聊天文本进入真实表单更快、更稳。
- OCR assist 的保守性更强，但使用门槛更低。
- create lead 失败时，用户能明确知道是字段问题、重复问题还是权限问题。
```

## Thread 03

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- apps/web/app/agent/clients/page.tsx
- apps/web/app/agent/clients/front-office-client-duplicates-card.tsx
- apps/web/app/api/agent/clients/merge/route.ts

任务：
- 把 `/agent/clients` 做成真正的 FO CRM 队列页，而不只是摘要页。
- 强化 stage、next touch、anchor、queue order、review 跳转、duplicate lane 的可执行性。
- 把 merge 成功/失败/风险反馈做清楚，尤其是“为什么保留这个 dossier、为什么合并失败”。
- 在不改 intake 组件和 backend snapshot 的前提下，最大化列表页可读性与行动导向。

完成标准：
- client list 让 agent 一眼看到“先跟谁、先清理谁、先合并谁”。
- duplicate review lane 清楚、安全、好操作。
- 不触碰 lead intake 组件和 dossier 内页文件。
```

## Thread 04

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- packages/db/src/front-office-clients.ts
- apps/web/app/agent/clients/[clientId]/page.tsx
- apps/web/app/agent/clients/[clientId]/front-office-client-dossier-client.tsx
- apps/web/app/agent/clients/[clientId]/front-office-client-dossier-shared.tsx
- apps/web/app/agent/clients/[clientId]/front-office-client-lease-reminder-client.tsx
- apps/web/app/api/agent/clients/[clientId]/follow-up-tasks/route.ts
- apps/web/app/api/agent/clients/[clientId]/lease-reminder/route.ts
- apps/web/app/api/agent/clients/[clientId]/pdf/route.ts
- apps/web/app/api/agent/clients/[clientId]/pdf/front-office-client-summary-pdf.tsx

额外兼容性规则：
- 只能对 `packages/db/src/front-office-clients.ts` 做向后兼容增强。
- 不得删除、重命名或重塑现有 dossier snapshot 的顶层字段。
- 不得破坏 `aiSuggestions`、workflow signal、next-step rail 等现有消费契约。
- 如果你认为必须改这些契约，停止并明确报 blocker，不要自行突破。

任务：
- 完成 dossier 核心执行链：overview、timeline、follow-up、lease reminder、workflow pressure、PDF export、BO boundary。
- 强化 next-step rail、summary cards、follow-up form、follow-up queue、timeline 可读性。
- 提升 PDF 导出内容质量，让它更像真正可发给客户的摘要。
- 保持 FO/BO 边界清晰，不把 formal transaction/admin 工作复制回 FO。

完成标准：
- dossier 能支撑 agent 持续工作，不像“只读客户档案”。
- follow-up 和 lease reminder 真正成为这个页面的核心操作。
- 如果你发现必须改 AI suggestions 或 handoff contract，停止并报 blocker，不要越界。
```

## Thread 05

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- packages/db/src/front-office-ai.ts
- apps/web/app/agent/clients/[clientId]/front-office-client-ai-suggestions-client.tsx
- apps/web/app/agent/_components/front-office-ai-explainability-surface.tsx

额外兼容性规则：
- 对 `packages/db/src/front-office-ai.ts` 的改动必须保持向后兼容。
- 必须兼容 `packages/db/src/front-office-listing-output.ts`。
- 必须兼容现有 dossier/dashboard 的 AI 消费方向。
- 如果需要打破现有 AI contract，停止并报 blocker，不要自行扩散到其他线程文件。

任务：
- 强化 AI ranking、why-now、boundary reasoning、one-click safety、accepted-action outcome 的解释质量。
- 让 AI surface 更像 grounded execution assistant，而不是 demo 文案区。
- 保持现有消费者尽量兼容；不要强行改其他线程页面。
- 明确解释“为什么推荐这一步”“为什么允许/暂停一键动作”“为什么仍然需要人工确认”。

完成标准：
- AI 建议更可信、更可执行、更可审计。
- 不引入 auto-send、隐式后台任务、夸大模型能力的文案。
- 若你确实需要改 `front-office-clients.ts` 或 dashboard 消费层，只报告 blocker，不要越界。
```

## Thread 06

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- packages/db/src/front-office-appointments.ts
- packages/db/src/front-office-calendar-links.ts
- apps/web/app/agent/calendar/page.tsx
- apps/web/app/agent/calendar/front-office-calendar-client.tsx
- apps/web/app/api/agent/appointments/route.ts
- apps/web/app/api/agent/appointments/[appointmentId]/route.ts
- apps/web/app/api/agent/appointments/[appointmentId]/bridge/route.ts
- apps/web/app/api/agent/appointments/[appointmentId]/ics/route.ts

额外兼容性规则：
- 对 `packages/db/src/front-office-appointments.ts` 暴露给其他 FO snapshot 的导出契约只能做向后兼容增强。
- 不得随意改导出函数的含义、移除既有字段或让其他 snapshot 消费方失效。
- 如果你认为必须打破导出契约，停止并报 blocker。

任务：
- 深化 appointment 创建、筛选、状态更新、external follow-up writeback、bridge action、ICS/email brief 的稳定性与可用性。
- 提升 calendar 上的 coordination cues、awaiting confirmation、touch due、reschedule requested 等状态反馈。
- 让 bridge 更顺手，但继续保持“action-first export bridge，不是假 two-way sync”。
- 优化错误处理、表单反馈、deep-link 到 client/listing 的上下文保持。

完成标准：
- calendar 能更稳定支撑真实 showing / meeting 协调。
- 外部 bridge 的反馈更清楚，agent 不会误会系统已经自动同步。
- 不触碰通知中心和 dossier 文件。
```

## Thread 07

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- apps/web/app/agent/listings/page.tsx
- apps/web/app/agent/listings/front-office-listings-output-client.tsx
- apps/web/app/agent/listings/front-office-agent-material-window.tsx
- apps/web/app/agent/listings/front-office-listings-route-state.ts
- apps/web/app/api/agent/listings/[listingId]/share-links/route.ts
- packages/db/src/front-office-listing-output.ts

启动顺序提示：
- 你可以并行工作，但默认不能依赖线程 05 做破坏式 AI contract 变更。
- 如果线程 05 已经落了向后兼容增强，先重读相关导出再消费；如果没有，就只按当前 contract 开发。

任务：
- 把 `/agent/listings` 做成真正的 outbound workspace：share action、draft assist、tracked link context、send cue、agent material packaging 都更完整。
- 清理 route-state / deep-link / draft-assist 逻辑，让链接更稳、更不容易脏。
- 强化 SMS、Email、Direct 三种动作的差异提示与完成反馈。
- 保持所有发送仍然是人工触发，不引入 auto-send。

完成标准：
- listings output 更像真实经纪人外发工作台，不像说明页面。
- agent material window 能自然服务 listing send，而不是独立摆设。
- 如需新增 snapshot 字段，不要改 `front-office-workspaces.ts`，只报 blocker。
```

## Thread 08

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- apps/web/app/agent/notifications/page.tsx
- apps/web/app/agent/notifications/agent-notifications-client.tsx
- apps/web/app/agent/notifications/agent-notifications-config.ts
- apps/web/app/api/agent/notifications/route.ts
- apps/web/app/api/agent/notifications/[notificationId]/route.ts
- apps/web/app/agent/notifications/[notificationId]/open/page.tsx

启动顺序提示：
- 这个线程同时消费 dashboard snapshot 和 workspace snapshot。
- 理想情况下，在读取线程 01 和线程 09 的最终 contract 后再做最终收尾。
- 如果线程 01 或线程 09 正在并行修改，视它们的 snapshot shape 为只读契约，不要求上游改 shape 配合你。

任务：
- 把 `/agent/notifications` 做成真正的 FO Activity + Cleanup Center。
- 强化 personal cleanup、team cleanup、appointment reminder、general notice 的切换、过滤、URL state、batch 操作和跳转反馈。
- 保持现有 snapshot contract，不要求 backend 改 shape。
- 优化“打开即已处理、标记已读、批量改状态、filter 持久化”这些高频动作。

完成标准：
- activity center 更像 inbox / cleanup hub，不是信息墙。
- 个人和团队压力的边界更清楚。
- 不改 backend snapshot 文件。
```

## Thread 09

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- packages/db/src/front-office-workspaces.ts
- apps/web/app/agent/resources/page.tsx

额外兼容性规则：
- 不得破坏 `/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/agent/notifications/page.tsx` 当前依赖的 activity snapshot shape。
- 对 `packages/db/src/front-office-workspaces.ts` 的改动默认只能做 backward-compatible 增强。
- 不得改掉已有字段名、顶层结构或让 notifications、resources、clients、listings 的现有消费方直接失效。

启动顺序提示：
- 该线程依赖 appointment 导出契约；如果线程 06 已经增强了相关导出，先重读最终导出形式。
- 无论线程 06 是否已完成，你都不能假设可以重塑 appointment 相关对外字段。

任务：
- 只做 backward-compatible 的 workspace snapshot backend 强化，不要破坏其他线程正在消费的字段。
- 提升 clients、listings、activity、resources 这些 snapshot 的排序、标签、计数、描述、empty-state 语义质量，但不能改掉字段名和基本 shape。
- 把 `/agent/resources` 做得更像 FO 工具库与 vendor hub，而不是简单列表。
- 优先做“更稳、更清楚、更可用”，不要发明新模块。

完成标准：
- `front-office-workspaces.ts` 更稳定，语义更清楚，兼容现有消费者。
- resources/vendor hub 更实用，能服务 agent 日常执行。
- 不碰 dashboard/listings/notifications/clients 的页面文件。
```

## Thread 10

```text
你在 Acre 仓库 `/Users/openclaw_john/工作文件夹/Acre_latest_clean` 工作。

先读：
- docs/specs/frontoffice-overview.md
- docs/specs/product-coverage-audit.md
- docs/specs/frontoffice-data-contract.md

目标：
把 Front Office 往“完整可用的执行型工作台”推进，同时严格保持 FO -> BO boundary；不要假装已经有 two-way sync、provider-backed ingestion、WeChat integration、auto-send、隐藏自动化。

通用规则：
- 只修改我给你的 owned files。
- 不要修改 docs/**、apps/web/app/globals.css、packages/ui/**、packages/auth/**、lockfile、以及其他线程文件。
- 不要做无关重构、全局格式化、样式语言重写。
- 如果需要跨线程改文件，停止并明确报告 blocker，不要越界代改。
- 看到其他线程已有改动时，不要回滚，先重读再只处理你的 owned files。
- 跑与你改动最相关的最小验证；不要为了通过检查去改别的线程文件。
- 不要做 git push / merge / reset；是否 commit 由主线程决定。
- 最终输出用中文：做了什么、改了哪些文件、跑了哪些验证、还有哪些 blocker。

owned files:
- packages/db/src/front-office-contracts.ts
- apps/web/app/office/transactions/new/page.tsx
- apps/web/app/office/transactions/new/transaction-create-page-client.tsx
- apps/web/app/api/office/transactions/route.ts

任务：
- 把 `handoffId -> BO create prefill -> committed` 这条链路做稳。
- 强化 handoff 缺失、失效、重复提交、已 committed、prefill 不完整时的处理与反馈。
- 明确覆盖真正调用 `commitFrontOfficeHandoffDraft(...)` 的 API 写入口，确保这条链路在 owned files 内闭环。
- 保持 FO 只负责准备和交接，formal transaction workflow 继续留在 BO。
- 不修改 FO 页面；只把 handoff contract 和 BO create flow 的接力做好。

完成标准：
- 从 FO 跳到 BO create flow 更可靠、更可解释。
- handoff contract 更稳，不容易重复提交或产生模糊状态。
- `handoffId -> prefill -> transaction create -> committed` 在你的 owned files 范围内形成完整闭环。
- 如果你发现必须改 dossier / dashboard 页面，只报 blocker，不要越界。
```
