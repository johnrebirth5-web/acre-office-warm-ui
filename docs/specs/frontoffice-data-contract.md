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

After the current `appointment + dossier + tracked listing output + send record + client engagement + lease reminder + appointment reminder + send context + leadership engagement visibility + offer bridge + inspection bridge + pdf export + closing suggestions + dossier ai suggestions + dashboard ai queue` foundation, the recommended next implementation target is:

- `agent-approved one-click follow-up creation + outbound draft assist rooted in the same dossier and live execution trail`

That means:

- Front Office should now let agents accept grounded suggestions with less friction than opening the detail page and manually retyping the next task
- automation should stay safe and agent-approved first: one-click task creation, better draft handoff into send surfaces, or pre-approved outbound prep before any true auto-send behavior
- the module should keep the FO -> BO boundary explicit by grounding recommendations in formal BO status / outcome signals while FO still owns client-facing follow-up, recap, referral, renewal, or re-entry prompts
- the goal is to extend the grounded AI bridge into lighter-weight accepted actions before skipping straight to opaque background automation

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
- send records now keep richer execution context instead of only `client + listing + channel`:
  - `FrontOfficeSendRecord` now also snapshots `clientStageLabel`, optional `appointmentId`, `appointmentTitle`, and `appointmentStartsAt`
  - `/agent/listings` now accepts appointment context in addition to client context, so sends can be recorded straight from a scheduled consultation/showing path
  - `/agent/clients/[clientId]`, `/agent/calendar`, and `/agent/dashboard` now surface that stage/appointment context directly in the send trail instead of forcing agents to reconstruct why a send happened
- leadership/team-level overdue engagement views now also read from that same send trail instead of inventing a second management score:
  - `/agent/dashboard` leadership scope now combines overdue tasks, 15+ day stale clients, and quiet tracked-send risk in one queue
  - the latest send per client is evaluated for `3+ day no open` and `7+ day quiet after last tracked open`, so management can see where tracked outreach exists but momentum has stalled
  - stage and appointment context captured on `FrontOfficeSendRecord` now appears directly in those leadership items, so oversight reflects the actual execution path rather than generic CRM aging text
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
  - those dashboard items now route either back into the dossier AI section or into the shared follow-up form with AI-prefilled task titles / due dates, so the agent can accept the suggestion without retyping it
  - the first dashboard automation layer intentionally stops at safe prefill and review: it does not auto-create follow-up tasks or auto-send messages in the background

## Non-goals in this phase

- no automatic transaction creation from Front Office
- no accounting / commission state duplication in Front Office
- no signature authoring inside Front Office
- no separate event system; shared office events remain on `Event`

## Expected next extensions

- agent-approved one-click follow-up creation + outbound draft assist rooted in the same dossier and live execution trail
