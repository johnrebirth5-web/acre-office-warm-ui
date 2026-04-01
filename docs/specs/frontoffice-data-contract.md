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
- `/agent/clients/[clientId]` now acts as the first real FO dossier page by surfacing stage history, appointments, follow-up tasks, and BO handoff state in one place
- marking an appointment `completed` updates `Client.lastContactAt` so FO CRM freshness reflects real meetings

## Non-goals in this phase

- no automatic transaction creation from Front Office
- no accounting / commission state duplication in Front Office
- no signature authoring inside Front Office
- no separate event system; shared office events remain on `Event`

## Expected next extensions

- richer appointment reminders / notification delivery
- tracked send records tied to appointments and client stage
