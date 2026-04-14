# Front Office Page Simplification Playbook

## Purpose

Use this playbook when a `Front Office` page feels too busy, too wordy, too repetitive, or too "internal tool"-like.

This is the default simplification standard for `/agent` pages.

Use it together with:

- [docs/specs/frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md)

Do not rely on chat history as the source of truth for simplification decisions.

## Core rule

The page should help the operator do the next obvious thing fast.

If a block does not help the user:

- decide what to do next
- confirm the minimum required context
- complete the next action safely

then it should usually be removed, collapsed, or downgraded.

## Simplification priorities

Always simplify in this order:

1. Remove duplicate information.
2. Remove internal system explanation.
3. Hide empty or healthy-state blocks.
4. Collapse secondary details behind a click or lighter affordance.
5. Shorten copy until the page reads like an operator workbench, not a product demo.

## Page-level rules

### 1. One page, one primary workbench

Each page should have:

- one primary queue, list, or task surface
- one secondary action area at most

Avoid pages that show multiple summaries of the same queue in different shells.

Bad:

- a top "today" summary card
- a second full queue card
- a right rail that repeats the same routing logic

Preferred:

- one main queue
- one intake / create / review block if needed

### 2. Top summary must stay small

Top summary chips should usually stay between `3` and `4`.

Default priority:

- immediate work
- missing / blocked work
- risk / duplicate / exception work

Do not show counts for everything just because the data exists.

Remove or hide:

- informational counts
- healthy counts
- vanity counts
- counts the operator cannot act on immediately

### 3. Empty states are not content

If a section has nothing actionable, prefer hiding it entirely.

Do not render full cards for:

- "clear"
- "no issues"
- "nothing waiting"
- "no duplicates"

Exception:

- keep an empty state only when the page would otherwise feel broken or directionless

## Copy rules

### 4. Remove system self-explanation

Do not default-show copy like:

- review-first
- no auto-create
- no auto-send
- provider-backed
- visible scope
- save-time check
- internal batching language
- queue-order explanation

These are implementation or safety details, not primary UI copy.

Only show them when:

- the user is about to take a risky action
- the system is blocked
- the detail changes the next decision

### 5. Prefer direct verbs

Button labels should describe the action outcome directly.

Good:

- `Fill form`
- `Update form`
- `Review record`
- `Open client`
- `Merge pair`

Avoid:

- `Apply reviewed unresolved section batch`
- `Continue after merge`
- `Reopen this list`

### 6. Keep supporting copy to one sentence

Card subtitles and descriptions should usually be one sentence.

If a paragraph contains:

- workflow philosophy
- implementation caveats
- repeated guardrail explanation
- more than one operator instruction

it is probably too long.

## List and queue rules

### 7. Keep queue rows scannable

A queue row should normally show only:

- title
- one badge
- one reason why it is surfacing now
- one compact meta line
- one or two actions

Do not stack three meta rows unless the extra context materially changes the next move.

Default queue meta should prefer:

- stage
- next touch
- one risk flag if needed

### 8. Repeated navigation should be cut

If the same destination appears in:

- summary cards
- list rows
- right rail
- helper cards

pick one strong place and remove the rest.

## Intake / AI assist rules

### 9. Extraction UI should behave like a field grabber

For OCR / transcript / AI extraction surfaces:

- show input
- show extracted fields
- show direct actions

Do not make the extraction area feel like a second review console.

### 10. Extracted field cards should stay tiny

By default, each extracted field card should show only:

- field label
- extracted value
- one action button

Only show confidence or evidence when:

- confidence is not high
- the field is preview-only
- there is a replace-risk confirmation

### 11. Hide successful technical detail

Do not show model names, OCR providers, fallback paths, or provenance labels in the default success path.

Keep these only for:

- debug mode
- explicit diagnostics
- failure states where the detail explains the problem

### 12. Duplicate warnings must be conditional

If there is no actual visible duplicate match, hide the duplicate warning block.

Do not render:

- "No visible duplicate"
- "duplicate review is clear"
- "waiting on identity"

unless the page truly needs a fallback explanation.

When there is a duplicate warning, keep it compact:

- matched record
- one-line reason
- `Review record`

## Form rules

### 13. Default to only the fields needed now

Show only the minimum fields needed to create the record safely.

Default visible set:

- name
- phone
- email
- intent
- budget
- area
- next follow-up

Move lower-frequency fields such as `stage`, `source`, or long `notes` into either:

- a second row
- an expandable `More fields`
- a lower visual priority section

### 14. Helper text should mostly be error-driven

Do not fill forms with constant helper copy.

Preferred:

- show helper text only when there is an error
- use placeholders for lightweight examples

## Safety rules

### 15. Keep confirmation only where the user can cause damage

Do not add review steps just for ceremony.

Keep explicit confirmation only for:

- replacing an existing live value
- merging duplicates
- destructive or irreversible actions

## Output contract for simplification tasks

When a thread simplifies a page, its report should answer:

1. what was removed
2. what was collapsed or hidden
3. what remains visible in the default operator path
4. whether any safety-critical confirmation was preserved
5. which files changed
6. which validation commands passed

## Ready-to-paste prompt for another thread

Use this prompt when assigning page simplification to another thread:

```text
你现在负责做一个 Front Office 页面减法任务。先读：

1. /Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md
2. /Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-page-simplification-playbook.md

目标：
- 把目标页面改成更像“操作台”，不是“解释台”
- 默认界面只保留下一步动作需要的信息
- 删除重复区块、空状态区块、系统自我解释、技术实现细节
- 保留必要的安全确认，但不要增加仪式化 review 步骤

硬规则：
- 一个页面只保留一个主 workbench
- summary chips 默认最多 3-4 个
- queue row 默认只保留标题、一个 why-now、一个 meta 行、1-2 个动作
- intake / AI extract 区默认只显示输入、字段值、直接动作
- 没有真实 duplicate 命中时，不要显示 duplicate warning
- 不要在成功路径默认展示 model / OCR / fallback / provider 等技术信息
- 非高风险字段不要强制多一步 review 才能填表

执行要求：
- 先列出你准备删除、隐藏、降级的内容
- 再直接改代码，不要只停留在建议
- 保持现有业务能力不变，只做信息架构和默认显示层级减法
- 完成后运行 typecheck、lint、build

输出格式：
1. 删除了什么
2. 折叠或隐藏了什么
3. 默认界面还剩什么
4. 保留了哪些必要确认
5. 改了哪些文件
6. 跑了哪些验证
```

## Recommendation

For future work, prefer:

- one stable rules file as the source of truth
- one short task-specific prompt that references this file

This scales better than rewriting a brand-new prompt every time.
