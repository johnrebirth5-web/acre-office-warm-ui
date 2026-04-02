# Product Coverage Audit

## Purpose

This document is the current repo-level audit for how much of the documented `Front Office` and `Back Office` product scope is actually covered by the live Acre implementation.

It is not a release note and not a promise that every listed route is fully production-complete.

Use it when the question is:

- which documented modules are already live
- which areas are only `MVP` or partially covered
- which documented capabilities still remain as backlog
- what the next implementation priority should be

## Canonical inputs

This audit is based on the current documented product baseline in:

- [docs/specs/frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md)
- [docs/specs/backoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/backoffice-overview.md)
- [docs/specs/implementation-log.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/implementation-log.md)
- [docs/specs/documents-signature-spec.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/documents-signature-spec.md)

Audit date:

- `2026-04-02`

## Status legend

- `Live core`: the documented module exists as a real active surface and the main workflow is live
- `Partial / MVP`: the module exists, but some documented capabilities or target-state behavior are still missing
- `Not yet covered`: the documented capability is still missing or remains only as follow-up direction

## Current repo-wide summary

### Front Office

- The active `Phase 1` and `Phase 1.5` workflow spine is mostly live:
  - dashboard
  - client dossier / CRM core
  - reminders
  - appointments
  - listings output
  - resources
  - notifications
  - FO to BO handoff
  - tracked send/open/click layer
  - AI next-touch assistance
- The current FO gaps are mainly:
  - intake acceleration
  - CRM cleanup tooling
  - external-system integrations
  - stronger activity-center cohesion
  - later `Phase 3` commercialization and automation work

### Back Office

- The documented BO module family is broadly present as real product surfaces.
- Most BO gaps are no longer "module missing" problems. They are now `MVP follow-up` problems:
  - deeper accounting and reconciliation
  - stronger export and integration behavior
  - genericized signature authoring
  - production-grade storage and job infrastructure

## Front Office coverage

| Module or capability | Current status | Notes |
| --- | --- | --- |
| `Dashboard` | `Live core` | Real `/agent/dashboard` with tasks, reminders, quick lead intake, send/click summary, AI queue, explainable next-touch rationale, vendor shortcuts, and FO/BO split context. |
| `CRM / dossier center` | `Partial / MVP` | Real client dossier plus visible-scope duplicate review / merge are live, but a more unified office-wide cleanup center and OCR-assisted intake are still follow-up work. |
| `Status flow and reminders` | `Live core` | Stage history, reminder pressure, overdue visibility, lease reminders, and team-lead pressure queues are live. |
| `Phone strategy / Chat List` | `Live core` | Embedded directly in the dossier as execution support. |
| `Calendar / appointments` | `Partial / MVP` | Real appointments, notes, meeting links, in-app reminder pressure, and a first Google / Outlook / ICS / email export bridge are live; full external calendar sync is not. |
| `Listings and output` | `Live core` | Tracked private links, send records, opens, revisits, and listing-output workflow are live. |
| `Agent material window` | `Partial / MVP` | Live beside listing output, but not yet the broader dynamic profile / landing-page vision. |
| `Document center / training center / vendor pool` | `Partial / MVP` | Resources and vendor shortcuts are live, but not every target-state training or watch-progress behavior is complete. |
| `Activity center` | `Partial / MVP` | `/agent/notifications` now acts as a unified FO `Activity + Cleanup Center` for cleanup pressure, duplicate review, notices, and shared office events, but deeper office-wide cleanup depth and external writeback remain follow-up work. |
| `Tracked links / send records / click data` | `Live core` | This `Phase 1.5` tracking layer is live and wired back into dossier and dashboard context. |
| `Offer / negotiation bridge` | `Live core` | FO dossier can now point into the shared BO offer workspace and handoff state. |
| `Inspection / contract-support bridge` | `Live core` | FO dossier exposes BO tasks, signatures, and incoming-update context when a formal file exists. |
| `PDF export` | `Live core` | Client-facing summary export exists from the dossier. |
| `Closing / deal-win suggestions` | `Live core` | FO dossier can surface post-close and re-entry suggestions off BO outcome context. |
| `AI next-touch suggestions and queue` | `Live core` | Dossier and dashboard AI suggestions, accepted-action tracking, outcome ranking, explainability, safe escalation, and FO/BO boundary guardrails are live. |
| `FO -> BO handoff boundary` | `Live core` | Explicit handoff draft and BO transaction prefill contract are live. |

## Front Office gaps still not fully covered

### Missing or notably incomplete documented capabilities

- `OCR-assisted intake from WeChat screenshots` is still not implemented
- complete `external calendar / email systems` integration is still missing beyond the current export-style bridge
- duplicate cleanup no longer stops at the current agent-owned queue, but `/agent/clients` still is not yet a fully unified office-wide cleanup center
- the later `Phase 3` line is still largely open:
  - automated content generation
  - enterprise WeChat exploration
  - agent dynamic profile / landing page
  - monetizable value-add packages

### Current FO priority conclusion

The next FO implementation work should remain focused on:

- deeper external calendar / email integration beyond the current export bridge
- workflow hardening on top of the now-explainable AI layer
- remaining CRM quality-of-life gaps such as OCR-assisted intake and broader office-wide cleanup depth

It should not jump straight to heavier background automation or auto-send behavior first.

## Back Office coverage

| Module or capability | Current status | Notes |
| --- | --- | --- |
| `Dashboard` | `Live core` | Real operational landing page with current reminders and payout review visibility. |
| `Pipeline` | `Live core` | Management-oriented pending and closed-history workspace is live. |
| `Reports` | `Live core` | Transaction-centric filtered reporting and CSV export are live. |
| `Performance` | `Partial / MVP` | Live module, but current rollout is still limited to `NY`; other reserved company buckets are future work. |
| `Transactions` | `Live core` | Real transaction list/detail, intake schema, finance, documents, tasks, offers, and signatures workflow. |
| `Contacts` | `Live core` | Real contact management exists and follows the shared Office template. |
| `Tasks / Approve Docs` | `Live core` | Real task and review workflow is live. |
| `Notifications` | `Partial / MVP` | Real inbox exists, but scheduler-driven reminder delivery and richer archive/dismiss behavior are still follow-up work. |
| `Account / My Profile` | `Partial / MVP` | Real self-service account page exists, but forgot-password and stronger auth flows are still missing. |
| `Billing / My Billing` | `Partial / MVP` | Real self-service billing exists, but monthly statements are live-generated summaries and PDF downloads are not implemented. |
| `Activity Log` | `Live core` | Real audit/event flow exists for implemented write paths. |
| `Library` | `Partial / MVP` | Real library exists, but storage and richer extraction behavior remain follow-up work. |
| `Accounting` | `Partial / MVP` | Real payout statement workspace is live, but stronger posting/reconciliation workflows and integration bridges remain open. |
| `Documents / Forms / eSignature` | `Partial / MVP` | Strong platform-level MVP is live, but generic non-transaction authoring and production-grade storage/integration are still missing. |
| `Offers` | `Partial / MVP` | Live internal offer workflow exists, but global queue and inbound ingestion remain follow-up work. |
| `Settings / Admin` | `Partial / MVP` | Major settings surfaces are live, but broader settings coverage and richer multi-office controls remain open. |
| `Agent Management` | `Live core` | Operationally covered through `Settings / Users`, even though the legacy route family is now redirect-only. |
| `Commission Management` | `Partial / MVP` | Core commission foundation is live, but deeper payout/approval/accounting bridge work remains. |

## Back Office gaps still not fully covered

### Missing or notably incomplete documented capabilities

- `Performance` is still not rolled out beyond the current `NY` scope
- `/office/billing` still lacks statement PDF download
- notification delivery still lacks mature scheduler/job-runner behavior
- current document storage is still local filesystem based, not object storage
- signatures still lack a truly generic non-transaction create-anywhere flow
- signatures still do not have third-party eSignature vendor integration
- accounting and commission still need deeper reconciliation, payout, and integration workflows
- some module families still carry transitional or intentionally hidden foundations, such as the current incoming-updates layer

## Cross-cutting remaining platform gaps

- no mature background job infrastructure yet
- no object-storage-based document layer yet
- no staging environment documented as the normal baseline
- some reminders and automation are still request-time or manual because a durable worker layer is not established
- some routes still carry transitional implementation patterns even though the main product surfaces are Prisma-backed

## Recommended next implementation order

### Highest-value next steps

1. deeper external writeback plus OCR-assisted intake
2. deeper FO calendar / inbox writeback beyond the current export bridge
3. unified FO activity-center hardening on top of the current dashboard / notifications split
4. BO generic eSignature create flow beyond transaction-first authoring
5. platform storage and job-runner foundations

### What this means in plain language

- The product is no longer at the "missing whole modules" stage.
- The next wins come from closing high-friction workflow gaps and infrastructure bottlenecks.
- `Front Office` still has the largest visible feature gaps against the target spec.
- `Back Office` already covers most module families, but many of them still need depth rather than brand-new top-level routes.
