# Back Office Implementation Log

## Current milestone

- `Back Office MVP+`
- Major core modules now exist as real routes and real workflow foundations
- Current focus is strengthening workflow fidelity, admin controls, responsive stability, and long-context documentation

## Recently completed major work

- Full-site UI unification refresh:
  - `globals.css` now drives a single calmer enterprise visual language with shared shell, card, button, input, table, and badge styling
  - `Office`, `Agent`, and `Login` now read as one product family instead of three partially separate visual systems
  - agent routes now compose through shared `@acre/ui` page/header/section patterns instead of standalone workspace hero chrome
  - legacy `bm-*` heavy surfaces remain supported, but now inherit the refreshed token system instead of preserving a second brand layer
- Real Office Dashboard, Pipeline, Transactions, Contacts, Tasks, Reports, Activity, Accounting foundations
- Notifications Center MVP:
  - real `/office/notifications`
  - user-scoped inbox distinct from `Activity Log`
  - read / unread state
  - actionable deep links into task review, offers, signatures, incoming updates, follow-up, and onboarding
  - notification write paths wired into existing workflow services
- Office Account / My Profile MVP:
  - real `/office/account`
  - self-scoped profile editing for safe user/profile fields
  - explicit membership notification preferences for the real in-app inbox
  - truthful security section for current local auth limitations
  - lightweight personal summary built from real tasks, transactions, and notifications
  - account-related activity log coverage for profile and preference changes
- Office Billing / My Billing MVP:
  - real `/office/billing`
  - self-scoped billing summary built from accounting + agent billing records
  - outstanding charges, pending charges, recent payments, credit balance, and live monthly statement summaries
  - self-service payment-method references for the current membership only
  - truthful limitations around live checkout, ACH, and statement PDFs
- Company Library / Internal Document Library MVP:
  - real `/office/library`
  - `LibraryFolder` / `LibraryDocument`
  - folder tree + file list + preview pane
  - local file upload / preview / download
  - activity log coverage for folder/document actions
- Transaction detail workflow expansion:
  - contacts
  - finance
  - tasks / approvals / compliance
  - documents / forms / eSignature / incoming updates
  - offers
  - commissions
- Accounting MVP:
  - chart of accounts
  - accounting transactions
  - EMD
  - agent billing
- Commission Management MVP:
  - plans
  - rules
  - assignments
  - persisted calculations
- Agent Management MVP and follow-up strengthening:
  - roster
  - profile hub
  - onboarding
  - teams
  - goals
- Office Settings / Admin MVP
- Back Office design system and responsive hardening passes
- Back Office hardening pass:
  - shared table/workspace alignment contract tightened across Office list screens
  - route-level parent/child validation tightened for transaction incoming updates
  - write permissions split more explicitly away from broad view access for comments, transactions, contacts, and finance actions
  - local session behavior hardened for production secret handling and reverse-proxy cookie behavior
  - single-Droplet document storage expectations documented around `/var/lib/acre/documents`
  - minimum regression tests added for auth/session config, proxy origin handling, document storage, and permission boundaries
- Dense-table compaction pass:
  - shared Back Office table density tightened through smaller table padding, gaps, badges, and utility-column widths
  - major Office list screens moved further toward information-weighted column widths instead of even spacing
  - agents, pipeline, accounting, billing, reports, tasks, contacts, library, and settings tables now reserve more width for primary content and less for short-value columns
- Back Office UI system unification pass:
  - `@acre/ui` + `office-*` is now the explicit canonical UI layer for Office pages
  - major Office shell surfaces, headings, buttons, badges, detail grids, and workspace cards were normalized so older `bm-*` pages read like the same product family
  - dashboard, activity, library, office navigation, transaction detail, contact detail, and agent profile surfaces moved closer to the shared system
  - older `bm-*` selectors remain supported as migration bridges, but their visual output is now intentionally governed by the shared Back Office design system
- Canonical list-page unification pass (transactions as source of truth):
  - contacts, agents, reports list sections, accounting workbench list surfaces, and settings users/teams/checklists/fields now share the same list-page rhythm (`PageHeader + SummaryChip`, `office-list-card`, `office-list-filters`, dense table card contract)
  - settings teams/checklists now expose explicit list inventory tables before deep edit cards, so admin pages read like peer list modules instead of one-off internal forms
  - shared `SummaryChip` primitive added in `@acre/ui` to reduce repeated page-local KPI chip markup
- Office page-header normalization follow-up:
  - added shared `PageHeaderSummary` in `@acre/ui` so top-right page summary/actions stop diverging page by page
  - dashboard, tasks, activity, library, settings overview, approve docs, notifications, billing, and account now use the same summary-chip header contract instead of mixed `Badge`-based header chrome
  - stray mixed-language approval-queue UI copy was restored to English so the Office shell reads like one coherent product
- Root-cause list/workspace cleanup follow-up:
  - direct page audit showed `contacts` and `transactions` were still visually dominated by page-local footer / pager / status treatments even after shared-shell cleanup
  - `contacts` and `transactions` now share the same list footer / pager contract and status-language treatment instead of two parallel list-page skins
  - `pipeline` header now uses the same summary-chip language as the rest of Office instead of a separate header-chip pattern
  - `agents` team management is now split into a compact inventory table plus a separate administration block so the page reads as one controlled back-office surface instead of a mixed-generation form dump
- Office list/workbench unification follow-up:
  - `tasks` filter, saved-view, create-task, and task-list sections now use canonical `SectionCard + FilterBar + Button + StatusBadge` primitives instead of mixed `bm-table-card` / `bm-detail-card` / `bm-view-toggle` markup
  - `notifications` filter and list areas now use the same list-card rhythm as the rest of Office instead of a separate legacy card shell
  - `approve docs` and `pipeline` status presentation now map back to `StatusBadge`, reducing one more visible layer of parallel status styling
  - agents, accounting, reports, and settings list pages now use `PageHeaderSummary` consistently instead of mixing direct `office-page-actions` markup
- List page canonicalization follow-up:
  - `/office/transactions` is now explicitly documented and implemented as the canonical Office list-page source
  - shared `ListPageSection`, `ListPageFilters`, `ListPageStatsGrid`, and `ListPageFooter` helpers were added to `@acre/ui` so peer list pages stop drifting into page-local shells
  - contacts, agents roster, reports list sections, accounting workbench sections, and settings users / teams / checklists / fields now compose through the same list-page skeleton instead of duplicating summary strips, filter shells, and section headers
  - settings admin pages now push secondary summary metrics back into page-header chips and use the same list-card rhythm as transactions
- Canonical list-page composition tightening:
  - `ListPageTableSection`, `ListPageStack`, and `ListPageSplit` now formalize the transactions-style list-page composition instead of relying on each page to hand-assemble the same structure
  - transactions and contacts now explicitly compose their main inventory module through the same `filters -> table -> footer` helper contract
  - agents roster, reports list modules, accounting list modules, and settings admin list pages now use the same shared list-page stack/split rhythm and more consistent `DataTable`-based inventory shells
- Transactions-to-contacts canonical template extraction:
  - `OfficeListPage` and `OfficeListPageSummary` now codify the exact transactions page skeleton (`header -> summary/actions -> filter card -> table card -> footer`)
  - `/office/transactions` now serves as the explicit canonical implementation through that template instead of hand-assembling `PageShell + PageHeader + ListPageTableSection`
  - `/office/contacts` now uses the same page composition and shared `office-list-table-*` contract, so it reads as a direct peer of transactions instead of a thinner parallel list page
- Wide-table horizontal access hardening:
  - shared `HorizontalScrollArea` now adds a visible bottom drag bar for horizontally overflowing Office tables instead of relying on OS-native scrollbar visibility
  - `DataTable` now composes through that shared scroll shell by default
  - pipeline, reports, accounting, billing, tasks, approve-docs, offer comparison, transaction commission, and other direct `office-table` surfaces now expose the same bottom drag affordance
- Shared density tightening for dashboard + tables:
  - the dashboard goal chart now uses a normal rectangular utility surface instead of a large pill-shaped backdrop that read like fake data
  - shared Office table density now favors tighter first-column proportions, smaller inline padding, and less wasted whitespace across transactions, contacts, reports, accounting, billing, agents, pipeline, and settings tables
- Cross-breakpoint responsive hardening pass:
  - page headers and section headers now stack actions earlier when medium-width desktop and tablet layouts can no longer safely support side-by-side title + CTA composition
  - shared header actions no longer claim full-width space by default, reducing CTA overlap with title/subtitle copy across reports, accounting, and peer Office pages
  - report/accounting KPI strips and other `StatCard` grids now use more content-aware responsive wrapping instead of forcing narrow high cards at tablet widths
  - short summary tables in reporting now differentiate from true wide data tables, so dual-column summary blocks stop rendering redundant horizontal drag rails
- long-context spec structure under `docs/specs`
  - added `agent-management-spec.md`
  - added `buyer-offers-spec.md`

## Next recommended work

- deepen notification automation only where real scheduling or assignment models exist
- deepen approval/document workflow parity
- strengthen storage strategy beyond local filesystem MVP
- expand Activity Log coverage for newer modules
- improve office-level admin automation and checklist application behavior
- strengthen durable statement/export/report outputs across accounting, commissions, and billing
- continue filling any remaining module-level specs before future large feature prompts depend on chat history
- add broader workflow-level automated coverage beyond the current minimum hardening tests

## Key product and engineering decisions

- Keep `Back Office` as the main current product priority
- Reuse shared foundations instead of spawning parallel mini-systems
- Keep workflow state explicit in Prisma models
- Keep permissions explicit in `@acre/auth`
- Keep activity/audit behavior integrated with `AuditLog`
- Prefer internal MVP workflow foundations over fake external integrations

## Known limitations

- object storage is still local filesystem MVP, but the single-Droplet production path is now explicit instead of project-relative
- many integrations are intentionally not implemented:
  - MLS ingestion
  - external eSignature vendors
  - QuickBooks sync
  - ACH payout execution
  - email/SMS delivery
- Office account security is still limited to local membership-email auth; there is still no real password reset or 2-step verification flow
- some modules are still `MVP`, not full product parity
- some workflow automation remains manual or manager-driven
- time-based notification reminders currently reconcile on inbox load, not via background jobs

## How to update this file

When a major feature lands:

1. add it to `Recently completed major work`
2. remove or downgrade any now-resolved limitation
3. refresh `Next recommended work`
4. keep this file brief and operational
