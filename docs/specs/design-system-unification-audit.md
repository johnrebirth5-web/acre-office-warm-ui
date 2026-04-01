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

As of `2026-04-01` in the next migration batch, the `office/dashboard` goal / KPI workspace has also moved onto canonical Office naming:

- [apps/web/app/office/dashboard/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/dashboard/page.tsx)

The dashboard no longer emits `bm-*` classes for its goal tracking, KPI strip, chart, or payout-statement action row. Those surfaces now use `office-dashboard-*` classes in [apps/web/app/globals.css](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/globals.css), which removes another major BO visual-language fork while keeping the same data and dashboard composition.

As of the same `2026-04-01` consolidation pass, the remaining active Office workspaces with live `bm-*` markup were migrated in one batch:

- [apps/web/app/office/accounting/accounting-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/accounting-client.tsx)
- [apps/web/app/office/accounting/agent-billing-panel.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/agent-billing-panel.tsx)
- [apps/web/app/office/accounting/commission-management-panel.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/commission-management-panel.tsx)
- [apps/web/app/office/billing/billing-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/billing/billing-client.tsx)
- [apps/web/app/office/contacts/contacts-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/contacts/contacts-client.tsx)
- [apps/web/app/office/transactions/transactions-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/transactions-client.tsx)
- [apps/web/app/office/transactions/transaction-intake-form.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/transaction-intake-form.tsx)
- transaction detail subcards and signature editor under [apps/web/app/office/transactions/[transactionId]](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId])

After that sweep, active `apps/web/app` page markup no longer emits `bm-*` design-language classes. Remaining `bm-*` references are now limited to compatibility CSS and table-runtime support, not live page/component chrome.

As of the next `2026-04-01` cleanup step, the highest-traffic BO route pages also moved from hand-assembled `PageShell + PageHeader + PageHeaderSummary` composition onto the shared route-template shell/header pair:

- [apps/web/app/office/accounting/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/page.tsx)
- [apps/web/app/office/activity/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/activity/page.tsx)
- [apps/web/app/office/dashboard/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/dashboard/page.tsx)
- [apps/web/app/office/notifications/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/notifications/page.tsx)
- [apps/web/app/office/tasks/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/tasks/page.tsx)

These pages now start from [office-list-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/_components/office-list-page-template.tsx) at the shell/header layer while preserving their existing body layouts, which narrows the remaining route-template gap to the rest of the BO surface set.

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

The BO adapter is now directly used by the main Office list/workspace routes, including:

- [apps/web/app/office/transactions/transactions-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/transactions-client.tsx)
- [apps/web/app/office/contacts/contacts-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/contacts/contacts-client.tsx)
- workspace routes such as [apps/web/app/office/accounting/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/accounting/page.tsx), [apps/web/app/office/activity/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/activity/page.tsx), [apps/web/app/office/dashboard/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/dashboard/page.tsx), [apps/web/app/office/notifications/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/notifications/page.tsx), [apps/web/app/office/tasks/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/tasks/page.tsx), [apps/web/app/office/pipeline/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/pipeline/page.tsx), [apps/web/app/office/library/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/library/page.tsx), [apps/web/app/office/reports/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/reports/page.tsx), [apps/web/app/office/billing/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/billing/page.tsx), [apps/web/app/office/approve-docs/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/approve-docs/page.tsx), [apps/web/app/office/performance/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/performance/page.tsx), [apps/web/app/office/account/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/account/page.tsx), [apps/web/app/office/1099-tracker/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/1099-tracker/page.tsx), [apps/web/app/office/signatures/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/signatures/page.tsx), and the settings index/workbench routes under [apps/web/app/office/settings](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings)

The repo now also has a dedicated shared detail-shell family:

- [apps/web/app/_components/canonical-detail-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/_components/canonical-detail-page-template.tsx)
- [apps/web/app/office/_components/office-detail-page-template.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/_components/office-detail-page-template.tsx)

That adapter is now used by special Office routes such as:

- [apps/web/app/office/settings/users/[membershipId]/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings/users/[membershipId]/page.tsx)
- [apps/web/app/office/settings/teams/[teamId]/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings/teams/[teamId]/page.tsx)
- [apps/web/app/office/1099-tracker/preview/[membershipId]/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/1099-tracker/preview/[membershipId]/page.tsx)
- [apps/web/app/office/transactions/new/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/new/page.tsx)
- [apps/web/app/office/transactions/[transactionId]/signatures/new/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/signatures/new/page.tsx)
- [apps/web/app/office/transactions/[transactionId]/signatures/[signatureRequestId]/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/signatures/[signatureRequestId]/page.tsx)
- [apps/web/app/office/settings/users/[membershipId]/permissions/page.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings/users/[membershipId]/permissions/page.tsx)

Finding:

- there is now one correct route-template contract at the skeleton level
- and BO route-level adoption now spans both list/workbench pages and special detail/create/preview routes

### 3. Active page markup is now clean; remaining `bm-*` is compatibility/runtime only

The repo still contains many `bm-*` selectors in [apps/web/app/globals.css](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/globals.css), but active page/component markup under `apps/web/app` no longer emits those classes for live Office surfaces.

Remaining code references are limited to compatibility/runtime support such as:

- [apps/web/app/office/office-table-layout-bootstrap.ts](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/office-table-layout-bootstrap.ts)
- [apps/web/app/office/office-table-layout-runtime.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/office-table-layout-runtime.tsx)

Finding:

- the product no longer has a second live page-markup language
- remaining `bm-*` debt is now mostly CSS cleanup and backward-compatibility support

### 4. The biggest remaining unification gap is route/template adoption, not class vocabulary

Transaction detail and a smaller set of BO route pages now emit canonical `office-*` markup, but some of them still preserve older layout composition patterns instead of flowing through the full shared route-template family.

Relevant files:

- [apps/web/app/office/transactions/[transactionId]/transaction-detail-workspace.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/transactions/[transactionId]/transaction-detail-workspace.tsx)
- [apps/web/app/office/settings/users/[membershipId]/permissions/permissions-client.tsx](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings/users/[membershipId]/permissions/permissions-client.tsx)
- nested detail workspaces that still manage their own inner hero/body contract inside an otherwise canonical route shell

Finding:

- the design-language fork is largely closed at the class/markup layer
- the remaining work is deeper inner-workspace normalization and later dead-CSS removal

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

- nested BO workspaces that still manage local inner-page hero/copy contracts inside a canonical outer shell
- transaction detail workspaces that already use canonical cards/components but have not yet been normalized onto a dedicated shared inner detail grammar
- special routes whose page body still carries route-local heading blocks, such as the permissions client under [apps/web/app/office/settings/users/[membershipId]/permissions](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings/users/[membershipId]/permissions)

### Highest migration debt

- route/template adoption for BO pages still bypassing the canonical list-page family
- dead compatibility CSS cleanup after the new class names bake in
- runtime compatibility support such as legacy table-layout hooks

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

Completed workbench batch:

- `activity` shell/list chrome moved off `bm-*`; follow-up work there is now limited to routing the page through the canonical route-template family when the surrounding filter/header composition is ready
- `dashboard` goal-tracking and KPI/chart chrome moved off `bm-*`; follow-up work there is now limited to route-template adoption and any deeper legacy card cleanup outside the main dashboard page
- active Office module/page markup under accounting, billing, contacts, transactions list/create/detail, and related modals/cards now emits `office-*` classes instead of `bm-*`, leaving only compatibility/runtime references behind
- route-level shell/header adoption is now complete for the active Office list/workbench routes:
  - `accounting`, `activity`, `dashboard`, `notifications`, `tasks`
  - `pipeline`, `library`, `reports`
  - `billing`, `approve-docs`, `performance`, `account`, `1099-tracker`, `signatures`, `signatures/templates`
  - settings index/workbench routes under [apps/web/app/office/settings](/Users/openclaw_john/工作文件夹/Acre_latest_clean/apps/web/app/office/settings)
- route-level shell adoption now also covers the main Office special pages through the shared detail-shell family:
  - `New transaction`
  - settings user detail / team detail / permissions
  - `1099 Summary Preview`
  - transaction signature prepare / edit routes

Next candidates:

- inner-workspace normalization for transaction detail and permission-management surfaces
- dead compatibility CSS cleanup once the new shell families have baked in

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
