# Front Office Data Contract

This file is the implementation-facing contract for the first real `Front Office -> Back Office` workflow bridge. It complements the product direction in [frontoffice-overview.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/frontoffice-overview.md).

## Core boundary

- `Front Office` owns agent execution state:
  - client stage movement
  - follow-up timing
  - appointment scheduling
  - outreach context
  - early BO handoff intent
- `Back Office` remains the formal system of record for:
  - transactions
  - accounting
  - commissions
  - signatures
  - archival document workflow

## Current recommended next target

After the current `appointment + dossier + tracked listing output + send record + client engagement + lease reminder + appointment reminder + send context + leadership engagement visibility + offer bridge + inspection bridge + pdf export + closing suggestions + dossier ai suggestions + dashboard ai queue + one-click follow-up + outbound draft assist + accepted-action history + ai outcome tracking + quick lead intake + visible-scope duplicate merge + ai explainability / boundary hardening + external calendar / email bridge + appointment external writeback state` foundation, the recommended next implementation target is:

- `broader CRM quality-of-life + deeper external-system integration`

That means:

- Front Office should keep extending beyond Acre-only scheduling surfaces, moving from export-style bridges into stronger calendar / inbox writeback where it is truly supported on top of the current bridge-action log plus agent-managed external follow-up state
- the next CRM pass should keep reducing first-call friction through stronger cleanup, deeper OCR-style intake assists, and eventually a more unified cross-surface cleanup center
- automation should still stay safe and agent-approved first: connect systems and improve operational reach before any true auto-send behavior
- the goal is to extend the now-explainable FO execution layer into the tools agents actually live in day to day

## First real FO workflow models

### `Appointment`

Purpose:

- agent-owned scheduling surface for showings, consultations, client meetings, and lightweight internal meetings

Source-of-truth rules:

- created and managed in `Front Office`
- linked to optional `Client` and optional `Listing`
- may reference a current `Office`, but the record belongs to the agent execution layer instead of the shared office-event layer
- does not replace `Event`; `Event` remains the shared office notice / RSVP surface

Current status model:

- `scheduled`
- `completed`
- `canceled`
- `no_show`

Current type model:

- `showing`
- `consultation`
- `client_meeting`
- `internal_meeting`
- `open_house`
- `other`

### `ClientStageHistory`

Purpose:

- durable audit trail of `Client.stage` changes

Source-of-truth rules:

- one row is created when a Front Office client is created
- one row is created each time the client stage changes
- this keeps the FO CRM pipeline reviewable without moving stage logic into opaque JSON

### `FrontOfficeHandoffDraft`

Purpose:

- explicit handoff queue from Front Office into Back Office

Source-of-truth rules:

- created or reactivated when a client enters a BO-ready stage such as negotiation / offer / application / contract / won
- canceled when a client leaves the BO-ready stage set
- this is an execution draft, not the final transaction record
- `Transaction` still becomes the formal record only after Back Office create/edit flow is used

Current lifecycle:

- `draft`
- `ready`
- `committed`
- `canceled`

## FO -> BO handoff rule

Current rule:

- a client becoming BO-ready does **not** automatically create a `Transaction`
- instead, Front Office creates or updates a `FrontOfficeHandoffDraft`
- dashboard and calendar rails read this explicit draft queue
- the user still opens Back Office create flow to establish the formal `Transaction`
- when that BO create flow is opened from a handoff draft, the intake form is now prefilled from the FO client context and the draft is marked `committed` after a successful transaction create

This keeps the handoff visible without pretending formal transaction creation already happened.

## Current implementation notes

- `createContact(...)` now writes initial `ClientStageHistory`
- `updateContact(...)` now writes `ClientStageHistory` on stage changes
- contact create/update also synchronizes `FrontOfficeHandoffDraft`
- `/agent/dashboard` `Needs Back Office` now reads formal handoff drafts instead of stage-text heuristics
- `/agent/calendar` now reads and writes real `Appointment` records
- `/office/transactions/new?handoffId=...` now reads a formal FO handoff draft, pre-fills the current BO intake form, and marks that draft `committed` after the transaction is created
- that same BO create flow also links the originating FO client into the new transaction as the primary transaction contact
- `/agent/clients/[clientId]` now acts as the first real FO dossier page by surfacing stage history, appointments, follow-up tasks, and BO handoff state in one place
- that FO dossier now also exposes workflow pressure + suggested next step signals, and agents can create follow-up tasks directly from the dossier instead of bouncing back to Back Office
- that same FO dossier snapshot now carries a stage-aware `Chat List / phone strategy` playbook, so intro scripts, call checklists, objection handling, and copy-ready message templates stay embedded in the live execution view
- FO follow-up creation reuses the shared `FollowUpTask` store and now keeps `Client.nextFollowUpAt` aligned when a dated follow-up is created, so FO/BO reminders stay on one clock
- FO follow-up updates now also stay on that same shared task store: Front Office can complete or push a follow-up forward without inventing a second reminder model, and the client-level `nextFollowUpAt` stays synchronized when the updated task was driving the next-touch signal
- marking an appointment `completed` updates `Client.lastContactAt` so FO CRM freshness reflects real meetings
- `/agent/listings` now creates private tracked listing links through the shared `ListingShareLink` store, and those links resolve to a lightweight public Acre share page that increments `clickCount` on open instead of pretending a public listing site already exists
- that same `/agent/listings` snapshot now also carries an `agentMaterial` block for the current membership, so business-card copy, profile portrait/bio, recent closing history, and one-click intro send actions can live beside listing outreach without querying a second profile system
- `FrontOfficeSendRecord` is now the formal FO outreach record for client-linked listing sends:
  - `/agent/listings?clientId=...` puts listing output into an explicit client-send mode instead of leaving it as a generic copy terminal
  - creating a tracked listing link from that client-linked mode now also writes a send record with `client`, `listing`, `channel`, `sender`, and `sentAt`
  - opening the public listing-share page now increments both the shared-link click counter and the matching send record's `openCount`, `firstOpenedAt`, and `lastOpenedAt`
  - `/agent/clients/[clientId]` now shows send counts, opened sends, revisits, last engagement time, and recent send history directly in the dossier
  - `/agent/dashboard` now shows client-send and engagement summary stats plus a recent engagement list, so FO management visibility starts from the same send trail instead of informal notes
- `Client` now also carries lease-timing truth for Front Office reminder work:
  - shared contact save flows persist `leaseEndDate` and `leaseReminderAt` directly on the client record
  - `/agent/clients/[clientId]` now exposes a `Lease-date reminder` card where agents can set or adjust those dates without leaving the dossier
  - `/agent/dashboard` now shows a lease reminder queue so renewal / remarketing windows sit beside follow-up and appointment pressure instead of hiding in notes
- appointment reminders now reuse the shared notifications channel instead of inventing a second FO-only inbox:
  - the shared notification contract now includes a formal `appointment_due_soon` reminder type keyed to the appointment record
  - loading `/agent/dashboard` or `/agent/notifications` now reconciles near-term scheduled appointments into the same activity stream as other FO reminders
  - `/agent/calendar` now shows a reminder badge on each appointment row so agents can see `today / within 2h / passed` pressure directly in the scheduling queue
- `/agent/notifications` now also acts as the first unified `Activity + Cleanup Center` instead of staying a notice-only stream:
  - the shared FO activity snapshot now combines due follow-up tasks, client-level next-touch pressure, stale-client cleanup, tracked-send risk, near-term appointment pressure, visible-scope duplicate review, unread notices, and shared office events in one route-level contract
  - the center intentionally shows one highest-pressure cleanup signal per client first so the queue stays operational, while duplicate review remains a separate merge block because that action changes the record foundation itself
  - focused personal-cleanup, team-cleanup, appointment-reminder, and general-notice lanes now also expose section-level drill-down links that reopen the route directly into the requested pressure track while preserving the existing `activityView`, `cleanupFilter`, `teamCleanupFilter`, `appointmentFilter`, `noticeStreamFilter`, and `readState` query-string contract
  - this first center does not yet claim full office-wide cleanup management; it is the first unified FO surface on top of the current self-scoped queue plus visible-scope duplicate governance
- send records now keep richer execution context instead of only `client + listing + channel`:
  - `FrontOfficeSendRecord` now also snapshots `clientStageLabel`, optional `appointmentId`, `appointmentTitle`, and `appointmentStartsAt`
  - `/agent/listings` now accepts appointment context in addition to client context, so sends can be recorded straight from a scheduled consultation/showing path
  - `/agent/clients/[clientId]`, `/agent/calendar`, and `/agent/dashboard` now surface that stage/appointment context directly in the send trail instead of forcing agents to reconstruct why a send happened
- leadership/team-level overdue engagement views now also read from that same send trail instead of inventing a second management score:
  - `/agent/dashboard` leadership scope now combines overdue tasks, 15+ day stale clients, and quiet tracked-send risk in one queue
  - the latest send per client is evaluated for `3+ day no open` and `7+ day quiet after last tracked open`, so management can see where tracked outreach exists but momentum has stalled
  - stage and appointment context captured on `FrontOfficeSendRecord` now appears directly in those leadership items, so oversight reflects the actual execution path rather than generic CRM aging text
  - `/agent/dashboard` still keeps that queue preview-sized, but `/agent/notifications` now receives a deeper notifications-only drill-down item set so team leads and office admins can work beyond the first few summary rows without changing the dashboard card density
- offer / negotiation bridge now also lives inside the same FO dossier instead of becoming a second offer database:
  - `/agent/clients/[clientId]` now exposes an `Offer & negotiation` section that makes the boundary explicit across `Front Office prep`, `Ready for BO handoff`, and `BO workspace live`
  - when a linked transaction already exists, the dossier now reads the shared Back Office offers snapshot directly and surfaces offer count, expiring-soon count, accepted / primary state, and direct links into the BO offers workspace
  - when a client is BO-ready but the transaction is not yet committed, the dossier now points straight into the formal BO create flow instead of encouraging a duplicated Front Office offer record
- inspection / contract-support bridge now also lives inside that same FO dossier instead of becoming a second inspection tracker:
  - `/agent/clients/[clientId]` now exposes an `Inspection & contract support` section that makes the boundary explicit across `Front Office prep`, `Ready for contract file`, `Contract file live`, and `Inspection-era live`
  - when a linked transaction already exists, the dossier now reads the shared BO transaction task, signature-request, and incoming-update foundations directly and surfaces open task counts, pending signatures, review-queue counts, and direct links into the relevant BO anchors
  - when no formal transaction exists yet, the same section points back to the BO create flow or stays inside FO follow-up, so post-offer support remains visible without pretending a second contract / inspection store already exists
- PDF export / client-facing report delivery now also lives on top of that same dossier instead of becoming a separate report builder:
  - `/api/agent/clients/[clientId]/pdf` now renders a client-ready summary PDF from the live FO dossier snapshot using the same appointments, send trail, negotiation bridge, and inspection / contract-support bridge already shown in the web UI
  - `/agent/clients/[clientId]` now exposes a direct `Download client PDF` action so agents can package the current execution story without copying raw dashboard notes into an external document
  - the PDF intentionally omits internal-only note fields and does not try to replace formal BO records; it wraps the live FO/BO execution state into a presentation layer while keeping the source-of-truth boundary intact
- closing / deal-win suggestions now also live inside that same FO dossier instead of becoming a separate “closed wins” tracker:
  - `/agent/clients/[clientId]` now exposes a `Closing & win suggestions` section that makes the boundary explicit across `Pre-win prep`, `Ready for deal wrap`, `Formal deal in flight`, `Closing soon`, `Fresh win`, and `Post-close nurture`
  - when a linked transaction already exists, the dossier now reads the shared BO transaction status plus acceptance / closing / move-in dates directly and turns those signals into actionable FO suggestions such as confirming the close date, placing the first post-close touch, downloading the client recap PDF, or timing a referral / testimonial ask
  - when the formal deal is cancelled or has not started yet, the same section intentionally falls back to respectful future nurture, alternate listing output, or BO create-flow routing instead of pretending a second win-tracking database exists
- AI next-touch suggestions now also live inside that same FO dossier instead of becoming an isolated “AI composer” page:
  - `/agent/clients/[clientId]` now exposes an `AI next-touch suggestions` section for memberships with `ai:use`, and the suggestions are grounded in the same live dossier trail: workflow pressure, lease reminders, appointments, tracked send/open behavior, BO handoff state, and formal transaction milestones
  - the dossier now emits a primary AI recommendation plus copyable call / text / email drafts that stay aligned to the current record state, while keeping the actual send decision with the agent
  - the first AI bridge intentionally does not auto-send anything and does not require a standalone model service; it turns the existing execution trail into a grounded suggestion layer that future dashboard / automation work can reuse
- dashboard-level AI queue + safe automation actions now also live on top of that same grounded suggestion layer:
  - `/agent/dashboard` now exposes an `AI next-touch queue` for memberships with `ai:use`, surfacing the most actionable grounded suggestions across lease timing, appointment prep, tracked send follow-up, BO-ready handoff, and post-close support
  - those dashboard items now still keep a review path back into the dossier AI section while also carrying structured AI follow-up titles / due dates that the next layer can accept directly
  - the first dashboard automation layer intentionally stays agent-approved: it never auto-sends in the background, and even direct task creation still lands in the shared FO follow-up store instead of creating a hidden automation queue
- agent-approved one-click follow-up creation + outbound draft assist now also live on top of that same grounded suggestion layer:
  - `/agent/dashboard` AI queue items can now create shared FO follow-up tasks directly with one click, so the accepted suggestion lands in the same `FollowUpTask` store and client next-touch clock without retyping
  - `/agent/clients/[clientId]` AI suggestions can now also create the suggested follow-up task directly from the dossier, while still leaving the existing review path and other FO / BO actions available
  - AI text / email drafts from the dossier can now open `/agent/listings?clientId=...` with outbound draft assist loaded, so the agent can reuse grounded draft copy inside the tracked listing-output send surface and still generate the private tracked link / send record instead of bypassing the execution trail
- accepted-action history + AI outcome tracking now also lives on top of that same grounded suggestion layer:
  - added a dedicated `FrontOfficeAiAcceptedAction` record so accepted AI follow-up creation and AI-assisted tracked sends can be written into the same FO execution trail without inventing a second analytics silo
  - `/agent/clients/[clientId]` now exposes an `Accepted AI actions & outcomes` section for memberships with `ai:use`, showing recent accepted actions, their source surface / suggestion context, and whether the resulting follow-up was completed or the tracked send was opened
  - `/agent/dashboard` now also exposes `AI accepted actions & outcomes`, so the agent can see acceptance volume and positive outcomes across their current FO scope instead of reopening each dossier to understand whether the suggestions actually moved work
  - dashboard one-click follow-up acceptance, dossier one-click follow-up acceptance, and dossier-to-listing-output draft assist now all send structured accepted-action metadata through the same API layer before the shared follow-up task or send record is created
- outcome-informed AI ranking + safe escalation rules now also live on top of that same grounded suggestion layer:
  - the shared FO AI service now turns recent accepted-action outcomes into a reusable ranking signal, so dashboard queue order and dossier suggestion emphasis can promote suggestion kinds that recently led to completed follow-ups or tracked opens
  - the same history index now also adds safe escalation cues when a similar accepted action stalled, so Acre can elevate the review path without quietly auto-sending or auto-creating more work in the background
  - dashboard one-click follow-up creation now intentionally backs off when the latest similar AI-created follow-up is still overdue, pushing the agent back into the dossier review path instead of stacking a duplicate shared follow-up task
  - dossier AI suggestions now separate `why now` from `what changed the priority`, so live record signals and history-driven ranking cues stop appearing as one mixed explanation string
  - accepted AI outcomes now also expose compact `Last 7d` and `Last 90d` suggestion-kind summaries, so agents can see whether current behavior still matches recent conversion patterns instead of relying only on all-up totals
- AI explainability + FO / BO boundary hardening now also live on top of that same grounded suggestion layer:
  - `/agent/clients/[clientId]` dossier AI suggestions and `/agent/dashboard` AI queue items now render a shared explainability surface that explicitly breaks out `Why Acre is suggesting this`, `Why now`, `What changed the priority`, `Execution boundary`, `Why this action is next`, and whether one-click follow-up is available or paused
  - the shared FO AI service now emits an execution-boundary contract, so the UI can tell the agent when work should stay in client-facing follow-up versus when the record should move into the formal Back Office flow
  - BO-ready `handoff` suggestions now intentionally suppress one-click follow-up creation and promote the Back Office create flow as the primary action, keeping the FO -> BO boundary explicit instead of stacking another reminder onto a formal-transition moment
- quick lead intake now also lives directly inside the active FO shell instead of forcing agents through Back Office contact admin first:
  - `/agent/dashboard` and `/agent/clients` now expose a lightweight lead-capture form that writes into the same shared `Client` record, `ClientStageHistory`, and `FollowUp` clock foundation used by the rest of Front Office
  - the intake path intentionally captures only first-touch essentials such as name, source, stage, intent, target areas, budget, notes, and next follow-up timing so the agent can keep moving during a live call or message thread
  - that same intake form now also exposes a first browser-side `OCR / transcript assist` block that can parse a WeChat screenshot or pasted chat text into suggested lead fields, while only filling empty/default values in the live form and never auto-creating the record
  - before create, that path now performs a lightweight duplicate warning check against the CRM records currently visible to the viewer for same-email, same-phone, or same-name matches, pushing the user toward dossier review before creating a second FO record
- `/agent/clients` now also exposes a pairwise duplicate review + merge surface for the current visible CRM scope:
  - Acre surfaces same-email / same-phone / same-name duplicate pairs in the active FO pipeline instead of only warning at create time
  - the merge action keeps one surviving FO dossier and moves shared FO workflow context such as appointments, follow-up tasks, tracked send history, AI accepted actions, handoff drafts, and transaction-contact links onto that surviving record
  - when the matched record belongs to the current viewer, review stays inside the FO dossier; when it is only visible through broader contact permissions, the review path intentionally opens the shared Office contact workspace instead of a FO-only route that would fail access
  - this cleanup pass now extends beyond the current owner's queue, and the first unified cleanup center now lives on `/agent/notifications`, but deeper office-wide cleanup depth and stronger intake acceleration beyond the current browser-side OCR beta still remain follow-up work
- external calendar / email bridge now also lives on top of the same FO appointment foundation instead of remaining only a roadmap line:
  - scheduled appointments on `/agent/calendar` and `/agent/clients/[clientId]` now expose direct `Google Calendar`, `Outlook`, `Download ICS`, and `Email client` actions
  - the shared appointment service now generates those export links from the same FO appointment record instead of asking the agent to manually retype title, time, location, or meeting link into outside systems
  - those bridge actions now also write back into the shared `AuditLog`, so the FO calendar and dossier can show the latest logged external action on each appointment without inventing a second sync-status store
  - FO appointments now also carry an explicit agent-managed external follow-up state, so confirmation, resend, and reschedule pressure can be surfaced in the calendar, dossier, and cleanup center even though Acre still does not own the outside system
  - that same writeback layer now also supports an optional `next external touch` timestamp plus operator note, so cleanup priority can follow the promised outside follow-up window instead of only the appointment start time
  - that promised outside follow-up window now also flows into the shared inbox reconciliation path, so a due or overdue confirmation / reschedule touch can become a real notification instead of staying cleanup-only
  - this current layer intentionally stops short of pretending Acre already owns full two-way sync; it is an action-first export path with lightweight writeback that preserves the existing FO appointment source of truth

## Non-goals in this phase

- no automatic transaction creation from Front Office
- no accounting / commission state duplication in Front Office
- no signature authoring inside Front Office
- no separate event system; shared office events remain on `Event`

## Expected next extensions

- deeper calendar / inbox writeback on top of the current export + logged-bridge + external-status layer
- broader CRM quality-of-life work such as deeper office-wide cleanup depth and provider-backed OCR / transcript intake depth beyond the current browser-side beta
