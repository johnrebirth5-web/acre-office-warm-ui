# Back Office Overview

## Purpose

This file is the high-level product map for the current `Office / Back Office` system. Use it to understand what each module is for, how mature it is, and what still needs follow-up work.

## Cross-module UI conventions

- `/office/transactions` remains the canonical list-page composition reference for peer inventory pages.
- shared Office tables are now the canonical template for future Back Office table work:
  - new `/office` tables should default to `@acre/ui` `DataTable` plus the shared `office-table-*` / `office-list-table-*` row contracts
  - semantic native `<table>` is still allowed when it materially helps, but it should stay inside the supported Office table contract so shared column-width persistence and resize behavior still apply
  - do not introduce a fourth page-local table system when the shared Office contract already fits

## Module map

### Dashboard

- What it is for:
  - Office landing page for current operational pressure, status counts, recent transactions, and reference links.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - agent self-service commission area now surfaces a high-priority payout review reminder whenever a saved payout statement is still in `awaiting_agent`, so the latest statement stays visible from dashboard until the agent confirms it or requests a revision.
- Follow-up work:
  - stronger manager KPIs
  - better cross-module drilldowns
  - more configurable office summaries

### Pipeline

- What it is for:
  - management-oriented pipeline workspace focused on the pending queue, default six-month closed history, optional full-year monthly review, scoped metric switching, and a query-driven working transaction list.
- Current maturity:
  - `MVP / refined`
- Current notable behavior:
  - the left rail now exposes only `Pending` plus `Closed` monthly history, instead of the earlier full-stage funnel; the history rail defaults to the latest six months and also supports per-year `Jan` through `Dec` buckets from a year dropdown.
  - top-right metric switching now separates office metrics from personal metrics and enforces role-based visibility for office-level financials.
  - monthly history selection and right-side working list stay URL-driven and scoped to the current office/org context.
  - the current snapshot service now reads pending metrics, range-specific closed-history metrics, and selected list rows through separate queries instead of loading the whole visible transaction portfolio into memory first.
- Follow-up work:
  - deeper analytics drilldowns
  - more advanced owner/team slicing
  - more cross-links into downstream transaction work queues

### Reports

- What it is for:
  - transaction reporting workspace for filtered transaction visibility, live financial rollups, and CSV export.
- Current maturity:
  - `strong MVP`
- Current notable behavior:
  - `/office/reports` now uses one transaction-centric workspace contract shared by the on-screen table, live summary cards, and CSV export.
  - filters now come directly from transaction fields and current team hierarchy instead of separate report-only slices.
  - `Team Leader` is derived from live `TeamMembership` reporting lines, and `Closing / Move-In Date` uses `moveInDate ?? closingDate`.
  - live summary currently totals `Asking Price / Purchased Price / Gross Commission / Rebate / Referral / Reimbursement` from the exact filtered transaction set.
  - access is now aligned to role scope:
    - admin tiers see company scope
    - team leads see self + downline
    - agents see only self
- Follow-up work:
  - add user-facing sort controls on top of the already-supported server-side sort contract
  - add Excel export when a real workbook requirement exists
  - keep extending columns/filters only when the source transaction schema is explicit

### Performance

- What it is for:
  - role-scoped agent performance tracking with summary cards, period tables, and ranking boards.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `/office/performance` reads directly from live `Transaction + TransactionFinanceFee` data and reuses Office report scope instead of a second aggregate store.
  - the performance formula is fixed to `Gross Commission - Rebate - Referral Fee - Reimbursement`.
  - period attribution uses `moveInDate ?? closingDate`, and only `Pending / Closed` transactions contribute.
  - current rollout only exposes `NY`, while keeping `Rental / NJ` reserved in the contract for future expansion.
  - visibility is intentionally different from general transaction finance:
    - company-scope viewers see current-company full numeric detail
    - team leads see their visible branch's numeric detail
    - agents see only their own numeric row, while company Top 10 peer amounts stay hidden
- Follow-up work:
  - activate `Rental / NJ` once those company entities are live in the current product line
  - revisit richer comparison visuals only after the core reporting contract stays stable
  - add broader export formats only when a real downstream accounting or management workflow needs them

### Transactions

- What it is for:
  - transaction list, transaction detail, and transaction-centered workflow hub.
- Current maturity:
  - `strong MVP`
- Current notable behavior:
  - `/office/transactions` is the canonical Office list-page composition source for peer inventory pages.
  - transaction create modal, `/office/transactions/new`, and transaction detail intake editing now consume one office-scoped schema managed centrally from `Settings > Fields`.
  - office admins can now open `Edit fields` directly inside both the `/office/transactions` create modal and `/office/transactions/new` to manage the full active transaction field schema without leaving the create flow:
    - built-in transaction fields can be renamed, re-ordered, hidden, required, and have dropdown option labels adjusted in place
    - custom fields can be created, renamed, re-typed, hidden, restored, protected from deletion, or deleted when they are not protected and have no persisted values
  - retired transaction compatibility placeholders and old text-only finance bridge fields have been removed from the shared transaction field schema, so `Settings > Fields`, inline `Edit fields`, create-time rendering, and default transaction search/report behavior now point at the same current field model.
  - transaction pricing is now split into `Asking Price + Purchased Price`, while legacy `price` remains a compatibility mirror of `purchasedPrice`.
  - the `/office/transactions` search workbench is now office-shared and schema-driven: admins with `fields:manage` can use `Edit fields` to add or remove operational, built-in, and custom filter blocks, while hidden or archived transaction fields are automatically removed from saved search layouts.
  - the `/office/transactions` page now reuses one shared server snapshot for both search-layout resolution and paginated list data, so it no longer resolves the same scope/team/filter-option context twice per request.
  - the built-in `Type / Status / Representing` dropdowns now keep stable system values while allowing office admins to edit which options are available and how each option label is displayed.
  - transaction report filters, report columns, and CSV export headers now resolve their labels from the same shared transaction field schema, so built-in label overrides such as renaming `State` stay consistent across create, settings, search, and reporting surfaces.
  - `New transaction` owner search for `Agent Name` is sourced from office/global sales memberships for company-scope creators, not just the currently visible transaction roster.
  - `New transaction` status creation is now limited to `Pending / Closed / Cancelled`, and non-admin users are forced to `Pending` and cannot change transaction status from create or detail-edit flows.
- Follow-up work:
  - deeper listing-side workflow parity
  - richer transaction automation
  - more operational subviews inside detail

### Contacts

- What it is for:
  - internal contact/party management tied to transaction workflows and follow-up tasks.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `/office/contacts` now uses the same canonical Office list-page template as `/office/transactions`, while keeping its own contact-specific fields and workflow content.
  - contact create/detail now render built-in and custom fields from the centralized `Settings > Fields` schema and persist custom values into `Client.additionalFields`.
- Follow-up work:
  - richer CRM-like workflows
  - more advanced relationship modeling
  - more contact-side automation

### Tasks

- What it is for:
  - operational task list, transaction tasks, checklist workflows, review/compliance workflow, approval states, and the dedicated `Approve Docs` reviewer queue.
- Current maturity:
  - `strong MVP`
- Current notable behavior:
  - `Approve Docs` uses the same `TransactionTask` review workflow as task list and transaction detail, including current-user actionable review filtering and explicit secondary-approval separation.
- Follow-up work:
  - richer template application
  - richer reminder tuning and delivery beyond the current in-product inbox
  - reviewer assignment / SLA handling beyond the current permission-based Approve Docs queue

### Notifications

- What it is for:
  - signed-in user inbox for actionable Back Office alerts and reminders tied to real workflow state.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `/office/notifications` is now a real user-scoped inbox route.
  - notification records are persisted separately from `AuditLog`.
  - inbox supports read/unread state, mark-all-read, category/type filtering, and deep links into the nearest real workflow page.
  - the page also shows a live high-priority payout review queue derived from current `AgentPayoutStatement.reviewStatus === awaiting_agent`, so payout review remains visible even if the original inbox item has already been marked read.
  - current coverage is intentionally limited to real signals:
    - task review / second review / rejection
    - offer created / received / expiring soon
    - signature pending / completed
    - incoming update pending review
    - follow-up assigned / overdue
    - onboarding assigned / due soon
    - payout statement ready / revision requested / confirmed
- Follow-up work:
  - add scheduler-driven reminder delivery when a real job runner exists
  - add archive/dismiss behavior if the inbox grows beyond read state
  - keep extending coverage only where a real workflow already exists

### Mail

- What it is for:
  - organization-scoped internal mail threads for Back Office communication, plus a small set of thread-worthy system alerts that need auditability and deep links.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `/office/mail` is now a real user-scoped mailbox route inside the Office shell.
  - threads are modeled explicitly as `subject + fixed participants + message stream + attachments`.
  - only active Back Office memberships in the same organization can be selected as recipients.
  - read/unread and archive state are private per participant; new replies automatically restore archived threads for other recipients.
  - each new message also upserts a single `internal_message_received` notification per recipient thread, so the personal inbox shows the latest unread mail reminder without duplicating rows.
  - when an `agent` creates a new `Transaction`, every active `owner / office_admin` now receives a system-generated mail alert thread with a direct `View transaction` CTA into `/office/transactions/[transactionId]`.
  - the Office sidebar now shows a live unread count badge next to `Mail`, driven from the current mailbox unread total.
  - users with `mail:audit` can switch into an `Audit view` that can inspect any org thread and attachment without becoming a participant.
  - `Activity Log` only stores mail metadata events and intentionally does not copy mail bodies into the global activity stream.
- Follow-up work:
  - richer search and attachment previews only when a real need appears
  - thread participant changes only if the workflow genuinely needs re-openable group membership
  - external delivery only if a true email bridge is later implemented

### Account / My Profile

- What it is for:
  - signed-in user self-service account page for profile details, office/team visibility, notification preferences, security context, and a lightweight personal work summary.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `/office/account` is now a real user-scoped route inside the Office shell.
  - profile editing is limited to safe self-service fields on `User` and `AgentProfile`.
  - office, role, and team assignment remain visible but read-only in this page.
  - notification preferences are persisted explicitly per membership and only govern the real in-app inbox and internal mail reminder bridge.
  - security section stays truthful about the current internal password-account flow and does not fake forgot-password, email delivery, or 2-step support.
  - profile and notification preference changes write into `AuditLog`.
- Follow-up work:
  - add richer personal work drilldowns only where underlying workflow modules already exist
  - revisit forgot-password / 2-step actions only when real auth support lands
  - extend notification preference granularity only when new real inbox families exist

### Billing / My Billing

- What it is for:
  - signed-in user self-service billing page for outstanding balances, charges, payments, statement visibility, payment-method references, and recent billing activity.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `/office/billing` is now a real user-scoped route inside the Office shell.
  - it reuses the existing agent billing / accounting foundation instead of introducing a second billing store.
  - statements are live-generated monthly on-screen summaries; PDF downloads are not implemented.
  - payment methods remain masked internal references only and do not imply live card or ACH processing.
  - self-service payment-method changes are scoped to the current membership and continue writing into `AuditLog`.
- Follow-up work:
  - add durable statement snapshots only when statement finalization becomes a real workflow
  - add billing notifications only when real inbox notification families exist
  - revisit self-service payment actions only when real processor support exists

### Activity Log

- What it is for:
  - account activity + operational alerts for auditable system actions and live workflow issues.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - remains intentionally separate from the personal notifications inbox.
- Follow-up work:
  - broader event coverage for future modules
  - deeper filtering and export
  - more alert types tied to newly implemented workflows

### Library

- What it is for:
  - internal company document library with folders, file metadata, PDF-first preview, and office/company scope.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `/office/library` is now backed by Prisma `LibraryFolder` and `LibraryDocument`, not the old mock resource feed.
  - primary workflow is folder select -> file list -> preview/details pane.
  - major folder/document actions write into `AuditLog`.
- Follow-up work:
  - stable PDF page indexing and richer metadata extraction
  - safer folder deactivation/archive workflow
  - future object storage replacement for local filesystem storage

### Accounting

- What it is for:
  - admin-controlled agent payout statements on top of the existing accounting and commission foundation.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `/office/accounting` is now an `office_admin`-only `Agent Statements` workspace.
  - `/office/1099-tracker` now sits as a separate sidebar module for `office_admin` users and handles internal year-end payout backup / 1099 support documents.
  - the page lets admin select an agent, load that agent's invoice-number candidates, and work inside one combined `Statement candidates` card where invoice selection and candidate-row preview stay together before final generation.
  - `Candidate rows` now support an in-place transaction drilldown modal backed by the live transaction detail workspace, so admins can inspect or edit the source transaction without navigating away from the current statement selection.
  - closing that modal refreshes the current accounting snapshot while keeping the admin inside the same payout-statement workflow instead of forcing a route change.
  - invited agents remain selectable for admin-operated accounting workflows; `invited` only means the agent has not completed self-login, not that the office should be blocked from creating transactions, calculating commissions, or generating payout statements for them.
  - accounting payee search follows the same office/global sales-member rule as transaction owner search, so admins can select current-office or company-level `agent / team_lead` memberships instead of being limited to office-local `active agent` rows only.
  - `1099 Tracker` stores actual company-paid agent payouts by tax year, aggregates totals from those saved records only, and exports internal `1099 Summary / Backup Document` PDFs using the current `AgentBankInformation` payee fields.
  - old ledger / agent billing / EMD UI is no longer rendered on `/office/accounting`, but the underlying accounting and billing foundation still exists.
  - `/office/billing` provides the current signed-in user's self-service billing view on top of the same accounting and agent-billing records.
- Follow-up work:
  - stronger reporting
  - deeper posting/reconciliation workflows
  - future integration bridges

### Documents / Forms / eSignature

- What it is for:
  - transaction documents, unsorted docs, internal forms, platform-level eSignature center, and incoming update review.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `Incoming updates` foundation still exists in the data/API layer, but the transaction detail page no longer shows that section by default.
  - nested transaction child routes now need to respect the parent transaction scope instead of resolving by child id alone.
  - current single-Droplet deployment intentionally keeps local filesystem document storage, with production storage expected under `/var/lib/acre/documents`.
  - `/office/signatures` now provides one cross-module signature center with status filtering, sender/recipient filtering, Drive sync visibility, and CSV export.
  - transaction documents can now launch external signature requests from the detail workspace with PDF-only field placement, drag/resize editing, multi-recipient routing, assigned signer ownership, Resend-or-SMTP email delivery, public recipient-token signing links, and signed-PDF archive output.
  - transaction signature authoring now starts with `Recipients and delivery`, then unlocks the PDF field-placement step after the request draft is saved, so multi-signer ownership is configured before fields are mapped.
  - `/office/signatures/templates` stores reusable signature templates, but the current authoring flow still starts from a configured signature request instead of a standalone blank-canvas designer.
  - `Settings > Signature Drive` stores one organization-level Google Drive service account configuration and folder mapping; completed requests synchronously attempt to upload original and signed copies, and failed sync can be retried from the center page.
  - first-phase creation is still transaction-first under the hood even when the request is tagged as `HR / Finance / Admin / Generic`, so the center currently acts more as a unified operations / template / archive workspace than a fully generic create-anywhere entry point.
- Follow-up work:
  - object storage replacement for local file storage
  - a truly generic non-transaction create flow
  - richer template management
  - queue-backed retries / stronger signer verification
  - future vendor integrations

### Offers

- What it is for:
  - buyer offer workflow inside transaction management, including comparison, comments, and offer-linked docs/forms/signatures.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - offer create/edit now render built-in and custom fields from the centralized `Settings > Fields` schema and persist custom values into `Offer.additionalFields`.
- Follow-up work:
  - optional global offers queue
  - inbound offer ingestion when a real source exists
  - richer listing-side workflow parity

### Settings / Admin

- What it is for:
  - user access management, team admin, field requirements, and checklist templates.
- Current maturity:
  - `MVP`
- Current notable behavior:
  - `Users` is now the unified member workspace under `Settings`, combining internal account administration with the former agent roster / profile operational views.
  - `Users` now manages internal Back Office accounts with invitation onboarding, password setup state, account lockout visibility, admin unlock / reissue actions, and the member operational roster view.
  - normal create-user choices now expose the Back Office tier catalog: `owner / office_admin / accountant / human_resources / team_lead / agent`
  - only current `owner / office_admin` can assign or manage `owner / office_admin` accounts, or edit per-user permission overrides
  - legacy `office_manager / office_user` stay compatible internally, but are not the primary create-user flow
  - `Teams` now supports recursive `Team Leader / Junior Team Leader / Member` hierarchy, parent-child branches, and explicit direct-manager assignment
  - shared Office table widths are now organization-scoped settings: `owner / office_admin` can resize current Back Office table columns, and saved widths apply to all users in the same org
  - `Fields` is now the single schema-management surface for `transaction / contact / offer`, including sort order, required / visible, custom field create-edit-delete, per-field deletion protection, hidden-field restore, and transaction-only required contact roles.
  - transaction search layouts now depend on the same transaction field visibility rules, so hidden or archived transaction fields no longer remain selectable in `/office/transactions`
- Follow-up work:
  - richer multi-office access controls
  - stronger template application behavior
  - broader settings coverage

### Agent Management

- What it is for:
  - legacy route family that now redirects into `Settings / Users` operational views.
- Current maturity:
  - `legacy redirect`
- Follow-up work:
  - keep the underlying `AgentProfile / Team / onboarding / goal` foundation strong inside the unified member workspace

### Commission Management

- What it is for:
  - commission plans, assignments, rules, calculation rows, statement-ready visibility, payout-ready workflow context.
- Current maturity:
  - `MVP`
- Follow-up work:
  - deeper approval/payout workflow
  - richer statement generation
  - stronger accounting bridge

## General product follow-up themes

- reduce remaining mock/transitional edges
- improve audit/event coverage across newer modules
- replace local file storage with production-ready object storage
- keep Back Office aligned with BoldTrail/Brokermint workflow behavior without faking unsupported integrations
