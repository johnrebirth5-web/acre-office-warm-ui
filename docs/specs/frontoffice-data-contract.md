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

After the current `appointment + dossier + tracked listing output + send record + client engagement + lease reminder + appointment reminder + send context` foundation, the recommended next implementation target is:

- `leadership/team-level overdue engagement views on top of the same send trail`

That means:

- team leads and office admins should be able to spot clients or agents whose send trail has gone quiet even when tracked links already exist
- leadership visibility should build on the same `FrontOfficeSendRecord` context instead of inventing a second engagement scoring store
- stage and appointment context already captured on sends should now become grouping / filtering signals for management review
- the goal is to turn the current execution trail into actionable oversight before building heavier analytics modules

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

## Non-goals in this phase

- no automatic transaction creation from Front Office
- no accounting / commission state duplication in Front Office
- no signature authoring inside Front Office
- no separate event system; shared office events remain on `Event`

## Expected next extensions

- leadership/team-level overdue engagement views on top of the same send trail
