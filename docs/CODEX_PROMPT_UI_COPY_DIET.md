# Codex Prompt C — UI 文案瘦身（一次性删/改 ~20 处废话）

> 目的：整站的卡片副标题、帮助段落、空状态文案大量是"功能列表体"或"复述标题"的废话，吃用户认知预算。这一轮**只做文字删/改，不重排版、不拆组件、不动逻辑**。
>
> 范围：`apps/web/app/office/`、`apps/web/app/listing-studio/`。
>
> 风险：极低（纯 JSX 文案替换）。可以和正在进行的 Rate Limit / Token Audit 两个 task 并行跑，因为完全不碰 `apps/web/lib/` 和 `packages/db/`。
>
> 验收：`apps/web` typecheck 通过；一个独立 commit。

---

## 改动原则

1. **标题已经说清楚的事，副标题不重复说一遍**。例：title="Status" + subtitle="Update the primary workflow status for this transaction." → 直接删 subtitle。
2. **描述组件功能的"功能列表"文案**（"tracking, comparison, comments, and offer-linked documents/forms/signatures"）→ 要么删，要么改成一句话的用户目标。
3. **空状态不要写成博客段落**。"Files that landed in the transaction but have not been organized into the main workflow yet." 这种改成 title="Unsorted documents"，副标题直接删。
4. **保留**：带数据的 subtitle（"3 items hidden"、"Last updated 2 hours ago"）；真正给用户 context 的一句话（例如"Saved views are per-user, not shared"）。
5. 英文原文里动词短语重复的（"Manage and view and track"）→ 留一个动词。

---

## 改动清单（精确到行号）

### 1. `apps/web/app/office/transactions/[transactionId]/transaction-detail-workspace.tsx`

| 行号 | 当前 subtitle | 动作 |
| --- | --- | --- |
| 159 | `"Core transaction facts, dates, and referral context."` | **删 subtitle 属性** |
| 222 | `"Update the primary workflow status for this transaction."` | **删 subtitle 属性** |
| 234 | `"Review and update transaction values."` | **删 subtitle 属性** |
| 281 | `"Use the same commission calculator flow here to update fees, notes, prerequisites, and the saved final agent net output."` | 改为 `"Fees, splits, and agent net."` |
| 302 | `"Structured fee logic, final stakeholder split, and calculation history for this transaction."` | **删 subtitle 属性** |
| 328 | `"Back-office offer tracking, comparison, comments, and offer-linked documents/forms/signatures."` | 改为 `"Incoming offers and linked documents."` |
| 362 | `"Structured back-office files linked to this transaction and its checklist tasks."` | **删 subtitle 属性** |
| 378 | `"Files that landed in the transaction but have not been organized into the main workflow yet."` | 改为 `"Uploaded but not yet categorized."` |
| 393 附近 | `"Generate transaction forms from templates, keep them tied to checklist tasks, and track manual signature status."` | 改为 `"Generate and track form signatures."` |

### 2. `apps/web/app/office/tasks/tasks-client.tsx`

| 行号 | 当前 | 动作 |
| --- | --- | --- |
| 334 | `subtitle="Filter task operations by saved view, assignee, compliance, and transaction context."` | **删 subtitle** |
| 460 | `subtitle="Built-in views stay fixed. Save the current filter set as a personal custom view."` | **删 subtitle**（按钮自解释） |
| 466 | `<p>Use the current filters and visible columns as the starting point for a saved personal view.</p>` | **整个 `<p>` 删掉** |
| 479 | `subtitle="Create a task directly into the office task list."` | **删 subtitle** |

### 3. `apps/web/app/office/settings/page.tsx`

这一轮**只精简文字**（卡片布局的信息架构合并留给 Prompt D）：

| 行号 | 动作 |
| --- | --- |
| 52-54 | 删 `<p className="office-settings-copy">…unified route.</p>` 整块 |
| 61-64 | 删 `<p>` 整块 |
| 72-75 | 删 `<p>` 整块 |
| 83-85 | 删 `<p>` 整块 |
| 92-94 | 删 `<p>` 整块 |
| 101-103 | 删 `<p>` 整块 |
| 111-113 | 删 `<p>` 整块 |
| 122-124 | 删 `<p>` 整块 |
| 51, 60, 71, 82, 91, 100, 110, 121 | 保留每张 SectionCard 的 `subtitle`（那是一句话总结，可以留），但检查 subtitle 里如果也是"功能列表体"，缩到 <10 个英文词 |

副标题收紧建议（保留一句话）：
- 51: `"Account access and member operations in one place."` → `"Members, access, and onboarding."`
- 60: `"Organization-wide role templates that seed effective permissions for every member."` → `"Role templates and overrides."`
- 71: `"Administrator-managed sender defaults plus Resend-ready delivery and SMTP fallback for signature requests."` → `"Sender defaults for signature emails."`
- 82: 保持现状（够短）
- 91: 保持现状
- 100: `"Reusable task templates for sales, rentals, and office defaults."` → `"Reusable task templates."`
- 110: `"Service-account based Google Drive archival targets for completed signature envelopes."` → `"Google Drive archival for signed envelopes."`
- 121: `"Default split templates, member-level defaults, and advanced legacy commission tools."` → `"Split templates and member defaults."`

### 4. `apps/web/app/listing-studio/listings/[packId]/listing-studio-detail-client.tsx`

| 行号 | 当前 | 动作 |
| --- | --- | --- |
| 2097 附近 | Disclosure description: `"Raw price and listing history stay nearby without taking over the primary reading flow."` | **删 description 属性** |
| 2117 附近 | Disclosure description: `"Additional scraped sections stay collapsed until you need the raw source payload."` | **删 description 属性** |
| 2282 附近 | Dropzone 提示: `"Click or drag to add images & videos (JPEG, PNG, WebP · MP4, WebM)"` | 改为 `"Drop files or click to upload"` |

### 5. 其他零星（顺手）

在 `apps/web/app/office/pipeline/page.tsx` 里如果存在类似：
- `"Use the two main cards to switch between open work and this month's closed results."`
- `"Recent monthly performance, kept visible even when a month is empty."`

**全部删掉**（sidebar 布局本身自解释）。搜关键词 `"Use the two main cards"` 和 `"Recent monthly performance"` 定位。

---

## 禁止项

- ❌ 不要改 SectionCard / StatCard / Disclosure 这些组件的**签名**（`subtitle` 依然是可选 prop，只是这次很多处不传）
- ❌ 不要改 CSS / 布局 / 组件结构（例如不要顺手把 4 张 StatCard 合并成一个组件——那是 Prompt D 的事）
- ❌ 不要改 i18n key（如果本仓库以后上 i18n，这些 string 还需要可以被换回来；现阶段直接删即可）
- ❌ 不要改 `const` 变量名或文件组织
- ❌ 如果某个 subtitle 在其他文件被当成 prop 传进来（跨文件引用），先 grep 一下确认没人引用再删；有引用的保留
- ❌ 不要"顺手修好"其他文件里看到的废话——先按清单来，有精力的话写一个 follow-up TODO 给 John 看

---

## 交付清单

- [ ] `apps/web/app/office/transactions/[transactionId]/transaction-detail-workspace.tsx` — 9 处改动
- [ ] `apps/web/app/office/tasks/tasks-client.tsx` — 4 处改动
- [ ] `apps/web/app/office/settings/page.tsx` — 8 个 `<p>` 删除 + 5 个 subtitle 收紧
- [ ] `apps/web/app/listing-studio/listings/[packId]/listing-studio-detail-client.tsx` — 3 处改动
- [ ] `apps/web/app/office/pipeline/page.tsx` — 2 处删除（如存在）
- [ ] `cd apps/web && npx tsc --noEmit` 通过
- [ ] **一个独立 commit**，message: `ui: trim redundant card subtitles and help text across back-office`
