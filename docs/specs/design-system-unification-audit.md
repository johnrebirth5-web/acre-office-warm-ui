# Design System Unification Audit

## Purpose

This document is the current audit baseline for unifying `Front Office` and `Back Office` under one Acre design system.

It exists to support the current product rule:

- the whole product, including `FO`, `BO`, `Login`, and shared shells, must use one visual system
- `@acre/ui` + `office-*` is the only canonical component and page-template language
- any remaining `bm-*`, page-local shell, or alternate template system is migration debt, not a second supported design language

## Canonical baseline

Current canonical sources of truth:

- [docs/office-design-system.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/office-design-system.md)
- [apps/web/app/globals.css](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/globals.css)
- [packages/ui/src/index.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/packages/ui/src/index.tsx)
- [apps/web/app/_components/canonical-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/_components/canonical-list-page-template.tsx)
- [apps/web/app/office/_components/office-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/_components/office-list-page-template.tsx)

`Front Office` already follows this baseline through:

- [apps/web/app/agent/_components/front-office-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/agent/_components/front-office-page-template.tsx)

As of `2026-04-01`, FO and BO route-level templates already share one common route-template skeleton through [canonical-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/_components/canonical-list-page-template.tsx). The remaining unification work is now about expanding adoption and removing legacy page-local chrome, not about inventing the shared skeleton for the first time.

As of `2026-04-01` later in the same cleanup pass, the `office/activity` workspace has also completed its first live migration batch:

- [apps/web/app/office/activity/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/activity/page.tsx)
- [apps/web/app/office/activity/activity-alerts-layout.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/activity/activity-alerts-layout.tsx)

These files no longer emit `bm-*` activity shell/list markup. Their workspace chrome now routes through `office-activity-*` classes in [apps/web/app/globals.css](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/globals.css), which makes `activity` the first high-visibility BO workbench migrated off `bm-*` shell language without changing its data flow.

## Audit method

The current audit reviewed:

- route-level page shells under `apps/web/app/office` and `apps/web/app/agent`
- shared templates and primitives
- active `bm-*` usage in live page markup
- deprecated list patterns such as `office-note-item`
- shell/nav divergence between `FO` and `BO`

## Current state summary

### 1. Shared primitives are already the right foundation

The repo already has a solid canonical primitive set in [packages/ui/src/index.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/packages/ui/src/index.tsx):

- `PageShell`
- `PageHeader`
- `OfficeListPageSummary`
- `SectionCard`
- `ListPageSection`
- `ListPageTableSection`
- `ListPageStack`
- `ListPageSplit`
- `QueueItem`
- shared form, badge, button, and table primitives

This means the main problem is not missing foundation. The problem is incomplete adoption.

### 2. Route-level page templates now share one skeleton, but adoption is still incomplete

Canonical shared route-level list skeleton now exists in:

- [apps/web/app/_components/canonical-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/_components/canonical-list-page-template.tsx)

BO list-page adapter exists in:

- [apps/web/app/office/_components/office-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/_components/office-list-page-template.tsx)

FO list-page adapter exists in:

- [apps/web/app/agent/_components/front-office-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/agent/_components/front-office-page-template.tsx)

The BO adapter is only directly used by:

- [apps/web/app/office/transactions/transactions-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/transactions-client.tsx)
- [apps/web/app/office/contacts/contacts-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/contacts/contacts-client.tsx)

Many BO pages still hand-roll route shells with `PageShell + PageHeader + PageHeaderSummary` instead of using the canonical list template directly, for example:

- [apps/web/app/office/dashboard/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/dashboard/page.tsx)
- [apps/web/app/office/activity/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/activity/page.tsx)
- [apps/web/app/office/accounting/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/page.tsx)
- [apps/web/app/office/pipeline/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/pipeline/page.tsx)
- [apps/web/app/office/library/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/library/page.tsx)
- [apps/web/app/office/tasks/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/tasks/page.tsx)
- [apps/web/app/office/notifications/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/notifications/page.tsx)
- multiple settings index pages under [apps/web/app/office/settings](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings)

Finding:

- there is now one correct route-template contract at the skeleton level
- but BO adoption is still inconsistent because many route pages bypass the canonical list-page adapter

### 3. `bm-*` is still active in live BO pages

The repo still contains a large amount of active `bm-*` markup, not just compatibility CSS.

High-impact live files still using `bm-*` heavily:

- [apps/web/app/office/dashboard/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/dashboard/page.tsx)
- [apps/web/app/office/accounting/agent-billing-panel.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/agent-billing-panel.tsx)
- [apps/web/app/office/accounting/accounting-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/accounting-client.tsx)
- [apps/web/app/office/accounting/commission-management-panel.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/commission-management-panel.tsx)
- [apps/web/app/office/transactions/transactions-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/transactions-client.tsx)
- [apps/web/app/office/contacts/contacts-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/contacts/contacts-client.tsx)
- [apps/web/app/office/transactions/transaction-intake-form.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/transaction-intake-form.tsx)
- [apps/web/app/office/transactions/[transactionId]/documents-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/documents-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/tasks-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/tasks-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/offers-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/offers-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/contacts-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/contacts-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/incoming-updates-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/incoming-updates-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/signatures/signature-request-editor.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/signatures/signature-request-editor.tsx)

Finding:

- `bm-*` is not just dead CSS
- several of the heaviest BO workspaces still visually depend on it
- these areas are the largest risk to the “single system” goal

### 4. Transaction detail still behaves like a parallel design language

Transaction detail and its subcards are one of the biggest sources of parallel UI vocabulary:

- `bm-detail-card`
- `bm-card-head`
- `bm-status-pill`
- `bm-transaction-task-*`
- `bm-document-*`
- `bm-offer-*`

Relevant files:

- [apps/web/app/office/transactions/[transactionId]/transaction-detail-workspace.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/transaction-detail-workspace.tsx)
- [apps/web/app/office/transactions/[transactionId]/documents-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/documents-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/tasks-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/tasks-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/offers-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/offers-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/contacts-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/contacts-card.tsx)
- [apps/web/app/office/transactions/[transactionId]/incoming-updates-card.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/incoming-updates-card.tsx)

Finding:

- list pages have already moved much closer to the unified system
- transaction detail is still the largest surviving visual subsystem

### 5. FO shell is close to canonical, but nav and shell behavior are still separate implementations

FO layout and BO layout already share the same top-level shell classes:

- [apps/web/app/office/layout.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/layout.tsx)
- [apps/web/app/agent/layout.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/agent/layout.tsx)

That is good.

However, nav implementations are still separate:

- [apps/web/app/office/office-nav.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/office-nav.tsx)
- [apps/web/app/agent/agent-nav.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/agent/agent-nav.tsx)

Finding:

- this is not a visual-brand fork
- but it is still a second route-shell implementation that can drift over time

### 6. Deprecated list patterns appear mostly cleaned up in markup, but dead compatibility CSS remains

The repo still contains deprecated compatibility selectors in global CSS:

- `office-note-item`
- `front-office-note-item`

Current audit did not find active TSX usage of those classes in `apps/web/app`.

Finding:

- markup migration is ahead of CSS cleanup
- dead compatibility CSS should be removed only after the remaining routes are confirmed clean

## Audit inventory

### Already closest to canonical

- FO pages built on [front-office-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/agent/_components/front-office-page-template.tsx)
- BO list pages built on [office-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/_components/office-list-page-template.tsx)
- detail/admin surfaces already centered on `SectionCard`, `QueueItem`, and shared form primitives, such as:
  - [apps/web/app/office/settings/users/[membershipId]/user-operations-detail-sections.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings/users/[membershipId]/user-operations-detail-sections.tsx)
  - [apps/web/app/office/agents/[membershipId]/agent-profile-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/agents/[membershipId]/agent-profile-client.tsx)

### Partially canonical, but still hand-assembled

- BO route pages using `PageShell + PageHeader + PageHeaderSummary` directly
- settings index pages
- dashboard-like pages
- workbench list pages such as accounting, reports, notifications, tasks, library, and pipeline
- `activity` still hand-assembles its route shell, but its inner workspace chrome has already moved to `office-activity-*`, so the remaining work there is template adoption rather than another visual-language migration

### Highest migration debt

- transaction detail workspace
- activity workspace
- accounting admin workbench
- dashboard chart and KPI chrome
- create transaction and transaction intake/edit modal flows

## Priority order for unification

### P0. Freeze new divergence

Effective immediately:

- no new `bm-*` classes in TSX
- no new page-local route templates
- no new FO-only visual primitives unless they are built on top of `@acre/ui`

### P1. Unify route-level templates

Goal:

- all FO and BO list pages should route through one canonical route-template family

Recommended approach:

- keep [front-office-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/agent/_components/front-office-page-template.tsx) as a thin adapter only if needed
- refactor it to compose the same lower-level contract as [office-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/_components/office-list-page-template.tsx)
- convert BO hand-built list pages to `OfficeListPageTemplate` or a single shared variant layer

First candidates:

- dashboard
- accounting
- pipeline
- library
- notifications
- tasks
- reports
- settings index pages

Completed first batch:

- `activity` shell/list chrome moved off `bm-*`; follow-up work there is now limited to routing the page through the canonical route-template family when the surrounding filter/header composition is ready

### P2. Migrate transaction detail off `bm-*`

Goal:

- transaction detail should use the same `SectionCard`, `DetailSection`, `StatusBadge`, `QueueItem`, and shared form grammar as the rest of the product

First candidates:

- contacts card
- tasks card
- documents card
- offers card
- incoming updates card
- signature request editor

### P3. Normalize nav and shell behavior

Goal:

- FO and BO may keep different navigation data, but should not drift into separate shell implementations

Recommended approach:

- extract shared nav section primitives
- normalize active states, mobile rail behavior, and section chrome

### P4. Remove dead compatibility CSS

Only after the markup migration is complete:

- remove unused `office-note-item`
- remove unused `front-office-note-item`
- remove dead `bm-*` selectors that no longer have live markup

## Acceptance rules for future work

Any new FO or BO page should pass all of these checks:

- uses `@acre/ui` primitives before adding page-local structures
- uses the canonical route template or a thin shared adapter
- does not introduce new `bm-*` classes
- does not create a second button/card/table/filter vocabulary
- keeps FO and BO in the same product family, even when information density differs

## First migration batch recommendation

Recommended first batch for actual implementation work:

1. unify route-level list pages onto one template contract
2. migrate `office/activity` off `bm-*`
3. migrate `office/dashboard` KPI/chart shell toward canonical cards
4. migrate `office/accounting` and `agent-billing-panel` modal/form chrome
5. start transaction-detail subcard migration with `contacts-card` and `tasks-card`

This order reduces the most visible design-system divergence first without blocking core FO/BO workflow work.
