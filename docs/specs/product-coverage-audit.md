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

- `2026-04-13`

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
  - agent material support
  - first poster / template generator
  - resources
  - notifications
  - FO to BO handoff
  - tracked send/open/click layer
  - AI next-touch assistance
  - first rule-layer reminder guidance
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
| `Dashboard` | `Live core` | Real `/agent/dashboard` with tasks, reminders, quick lead intake, send/click summary, AI queue, explainable next-touch rationale, vendor shortcuts, FO/BO split context, route-stable re-entry shortcuts into focused FO workbench lanes such as `follow first`, `anchor now`, `duplicate review`, and `viewing lane`, harder workbench CTAs for appointment writeback, send-risk follow-through, and cleanup re-entry instead of broad summary links, tighter appointment-commitment lane selection for the calendar workbench, and a stable `/agent/listings?lane=draft-lane` fallback when the next move is broad outbound prep rather than one client-specific send trail. |
| `CRM / dossier center` | `Partial / MVP` | Real client dossier, visible-scope duplicate review / merge, and a first browser-side OCR / transcript intake assist are live; the intake review now explicitly separates recognized vs review-first vs omitted fields, groups them into batchable execution sections, and prioritizes unresolved/manual-confirmation sections before calmer recognized blocks, duplicate warnings now steer agents into existing-record review first, `/agent/clients` now supports route-persistent `clientView` lane focus, and the dossier now reuses lane-aware calendar / listings re-entry plus anchored section-focus guidance across appointment cards, send records, AI accepted actions, and the next-step rail, but deeper provider-backed intake acceleration and broader office-wide cleanup depth are still follow-up work. |
| `Status flow and reminders` | `Live core` | Stage history, reminder pressure, overdue visibility, lease reminders, and team-lead pressure queues are live. |
| `Phone strategy / Chat List` | `Live core` | Embedded directly in the dossier as execution support. |
| `Calendar / appointments` | `Partial / MVP` | Real appointments, notes, meeting links, in-app reminder pressure, and a first Google / Outlook / ICS / email bridge are live; those bridge actions now log back into Acre, appointments carry an agent-managed external follow-up / confirmation / reschedule state, agents can now set the next promised external touch deadline directly on the appointment, the calendar focus view now exposes an explicit `After the bridge` checkpoint plus suggested-writeback load path, the route now supports stable `calendarView` aliases for the main coordination lanes including explicit `Externally confirmed`, `Touch scheduled`, and `Writeback pending` slices, the live calendar now also supports true `day` and `week` agenda views grouped by date/time, calendar save / bridge flows preserve the active lane when Acre can prove it, dossier appointment cards expose direct calendar-writeback reopen links and bridge-next-step copy, and that deadline reconciles into the shared inbox as a time-sensitive reminder, but full external calendar sync is still not. |
| `Listings and output` | `Live core` | Tracked private links, send records, opens, revisits, and listing-output workflow are live, `/agent/listings` now carries a route-persistent focused `lane` contract for `send rescue`, `follow-through`, and `draft lane` re-entry instead of behaving like one generic outbound desk, and the live workspace now surfaces a lane-execution checklist so the active rescue / follow-through / draft path reads like an operator plan rather than URL state alone. |
| `Agent material window` | `Partial / MVP` | Live beside listing output with a clearer `profile / contact / proof / route` packet organizer for outbound support, and the rail now reads more like a reusable material center with profile-sheet / packet-style preview blocks, a route block, a recommended packet mode, a manual launchpad for stable-route reopen plus companion-package copy, direct SMS / email draft-launch links that reopen the same focused lane with manual draft assist already loaded, an explicit `asset readiness board` plus route-aware `send plan` so operators can check packet readiness and copy a manual execution order before sending, and now first `profile showcase assets` such as an outward-facing intro poster and closing-history strip, but it is still not yet the broader dynamic profile / landing-page vision or a full asset-management center. |
| `Marketing template generator` | `Partial / MVP` | `Listing Studio` now has a first poster / template generator that can switch between editorial, open-house, social-square, and factsheet layouts, preview the generated layout, copy poster text, and open printable / downloadable HTML output; that flow now also keeps agent info and a scan-ready packet path visible in preview / export, lets the agent edit the saved packet contact block directly, adds a manual packet-distribution summary, exposes a first manual marketing kit with social captions, listing blurbs, and follow-up notes derived from the same saved packet, groups that copy into reusable social / listing / follow-up campaign bundles, and now organizes those bundles into a first manual `campaign delivery plan` with send-ready packages, delivery sequence, and readiness checklist, but it is still a manual Acre-owned export path rather than Canva-backed generation, PNG rendering, or a broader marketing operations center. |
| `Document center / training center / vendor pool` | `Partial / MVP` | Resources and vendor shortcuts are live, but not every target-state training or watch-progress behavior is complete. |
| `Activity center` | `Partial / MVP` | `/agent/notifications` now acts as a unified FO `Activity + Cleanup Center` for cleanup pressure, duplicate review, notices, shared office events, appointment writeback pressure, and leader-visible team cleanup pressure, including a dedicated appointment-reminder block for `confirmation due`, `reschedule follow-up`, `external touch due`, and `appointment soon`, basic single/bulk read-state controls, URL-persistent reminder/read-state filters, a dedicated main-stack team-cleanup section for leadership scopes, URL-persistent team-pressure filtering for overdue tasks vs stale dossiers vs send-trail risk, a route-persistent focus-area view for personal cleanup vs team cleanup vs reminder vs notice slices, lane-level `next step` guidance, stronger workbench-language cleanup actions, shared section labels on cleanup/reminder/notice cards, and focused re-entry into clients duplicate-review, dossier section anchors, and client-aware calendar writeback lanes, but deeper office-wide cleanup depth and external-system depth remain follow-up work. |
| `Tracked links / send records / click data` | `Live core` | This `Phase 1.5` tracking layer is live and wired back into dossier and dashboard context. |
| `Offer / negotiation bridge` | `Live core` | FO dossier can now point into the shared BO offer workspace and handoff state. |
| `Inspection / contract-support bridge` | `Live core` | FO dossier exposes BO tasks, signatures, and incoming-update context when a formal file exists. |
| `PDF export` | `Live core` | Client-facing summary export exists from the dossier. |
| `Closing / deal-win suggestions` | `Live core` | FO dossier can surface post-close and re-entry suggestions off BO outcome context. |
| `AI next-touch suggestions and queue` | `Live core` | Dossier and dashboard AI suggestions, accepted-action tracking, outcome ranking, explainability, safe escalation, FO/BO boundary guardrails, and a first shared rule-layer strategy contract for `follow-up`, `silent period`, `holiday`, and `lease` guidance are live; that rule layer now also reads as a shared playbook with concrete do-now / prepare / watch steps instead of only static explanation copy. |
| `FO -> BO handoff boundary` | `Live core` | Explicit handoff draft and BO transaction prefill contract are live. |

## Front Office gaps still not fully covered

### Missing or notably incomplete documented capabilities

- `OCR-assisted intake from WeChat screenshots` is now only partially covered: a browser-side OCR / transcript beta exists in quick intake, but there is still no provider-backed ingestion pipeline, no WeChat integration, and no office-wide import workflow
- complete `external calendar / email systems` integration is still missing beyond the current export-style bridge plus logged bridge-action writeback and agent-managed external follow-up state
- duplicate cleanup no longer stops at the current agent-owned queue, but `/agent/clients` still is not yet a fully unified office-wide cleanup center
- the later `Phase 3` line is still largely open even though the first manual poster/template workflow is now live:
  - stronger automated content generation beyond manual HTML poster export
  - enterprise WeChat exploration
  - broader agent dynamic profile / landing page behavior
  - monetizable value-add packages

### Current FO priority conclusion

The next FO implementation work should remain focused on:

- deeper external calendar / email integration beyond the current export bridge plus logged bridge-action writeback and appointment external-status layer
- workflow hardening on top of the now-explainable AI layer
- turning the new material window + poster generator into a broader reusable outbound asset workflow beyond the current route-aware packet organizer, draft-launch links, asset-readiness board, send-plan layer, first showcase assets, manual launchpad, packet-distribution summary, first marketing kit, first campaign bundles, and first campaign delivery plan, without pretending Canva sync or rendered social export already exist
- remaining CRM quality-of-life gaps such as deeper OCR-assisted intake and broader office-wide cleanup depth

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

1. deeper external writeback plus stronger OCR-assisted intake depth
2. deeper FO calendar / inbox writeback beyond the current export bridge + external-status layer
3. unified FO activity-center hardening on top of the current dashboard / notifications split
4. BO generic eSignature create flow beyond transaction-first authoring
5. platform storage and job-runner foundations

### What this means in plain language

- The product is no longer at the "missing whole modules" stage.
- The next wins come from closing high-friction workflow gaps and infrastructure bottlenecks.
- `Front Office` still has the largest visible feature gaps against the target spec, but they are now mostly workflow-depth gaps rather than totally missing surfaces.
- `Back Office` already covers most module families, but many of them still need depth rather than brand-new top-level routes.
