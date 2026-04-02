# Front Office Overview

## Purpose

This file is the stable `Front Office` product brief for Codex tasks in this repository.

It is the repo-local source of truth distilled from:

- `/Users/openclaw_john/Desktop/ACRE_Front_Office_PRD_03-30.docx.pdf`

Use this file instead of chat history when a task touches `Front Office`, `/agent` routes, or FO/BO handoff behavior.

## Canonical rule

- For `Front Office` scope, priority, module order, and product intent, follow this file first.
- If older repo docs, implementation notes, placeholder copy, or partial route behavior conflict with this file, treat them as implementation snapshots rather than product direction.
- `Back Office` remains the formal system of record for transaction execution, accounting, commissions, signatures, and archival workflows.
- `Front Office` should lead the agent's daily execution flow and hand off into `Back Office` when work becomes formal, auditable, or finance-driven.

## Product positioning

`Front Office` is not just a light lead-entry surface or listing browser.

It is the agent's main workbench for:

- lead intake
- follow-up
- phone/chat execution support
- appointment scheduling
- showing / viewing coordination
- listing recommendation and outbound sharing
- resource retrieval
- event/activity visibility
- pre-transaction execution before formal `Back Office` handoff

Core problem statement:

- the biggest operational issue is not lack of leads
- it is missed follow-up, delayed action, scattered materials, and non-standard execution

## Design and product principles

- Solve high-frequency execution problems first.
- `Front Office` should support fast, lightweight field use, including mobile-first task completion where practical.
- Agents should spend most of their day in `Front Office`, not be forced into `Back Office` for every step.
- Key actions must be traceable: sends, clicks, reminders, status changes, template generation, and report export.
- Reuse the shared Acre design system and product family language; do not create a second visual brand for FO.

## Information architecture

Recommended `Front Office` structure:

- `Dashboard Shell`
- `Clients / Process Center`
- `Listings / External Output`
- `Resources / Efficiency Tools`
- `Advanced workflows`
- `Automation / AI`
- `Tracking / Analytics`
- `Back Office handoff layer`

## Core workflow chain

The intended FO workflow is:

1. lead intake
2. first follow-up
3. listing recommendation / content send
4. appointment / showing scheduling
5. negotiation / offer preparation
6. inspection / handoff support
7. formal transaction handoff into `Back Office`
8. remarketing / lease-date / silent-period follow-up

## Phase priorities

### Phase 1

Must ship first:

- `Dashboard`
- `CRM`
- status flow and reminders
- phone strategy / `Chat List`
- calendar / appointment scheduling
- agent profile material window
- document center
- activity center
- `Front Office` / `Back Office` switching

Intent:

- solve the highest-frequency execution problems first

### Phase 1.5

Next, fill data and management visibility gaps:

- tracked links
- send records
- click data
- team overdue follow-up list
- lease-date reminders

Intent:

- make the system produce management value, not just agent-side utility

Current implementation priority note:

- `lease-date reminders` are now live on the client record, dossier, and dashboard
- `appointment reminders / notification delivery` are now also live on top of the FO calendar, so near-term appointments enter the same activity stream as other execution reminders
- `send records` now also snapshot client stage and optional appointment context, so outreach can be read as part of the live execution trail instead of generic clipboard history
- `leadership/team-level overdue engagement views` are now live on top of the same send trail, so team leads and office admins can spot quiet tracked sends alongside overdue tasks and 15+ day stale clients
- the `Offer / negotiation bridge` is now live on the client dossier, so agents can see whether work is still in FO prep, ready for BO handoff, or already tracked in the shared BO offer workspace
- the `inspection / contract-support bridge` is now also live on the client dossier, so the same FO record can point directly into BO tasks, signatures, and incoming-update review once a formal transaction file exists
- `PDF export` is now also live off the same dossier, so agents can download a client-ready summary PDF without creating a second reporting module or exporting raw BO state directly
- `closing / deal-win suggestions` are now also live on the client dossier, so the same FO record can turn shared BO outcome signals into post-close touches, referral timing, recap PDF suggestions, and respectful re-entry guidance without inventing a second “win board”
- `AI next-touch suggestions` are now also live on the client dossier for memberships with `ai:use`, so Acre can ground copyable call / text / email drafts in the live dossier trail without auto-sending anything or inventing a second recommendation layer
- `dashboard-level AI queue + safe automation actions` are now also live, so the dashboard can surface grounded next-touch opportunities and route agents into prefilled follow-up forms without auto-creating or auto-sending anything
- `agent-approved one-click follow-up creation + outbound draft assist` are now also live, so grounded AI suggestions can become real shared follow-up tasks from the dossier or dashboard, and copy-ready AI drafts can now enter the tracked listing-output surface without auto-sending anything
- `accepted-action history + AI outcome tracking` is now also live, so the dossier and dashboard can measure which AI suggestions actually became shared follow-up tasks or tracked sends, and whether those accepted actions produced a completed task or real engagement signal
- `outcome-informed AI ranking + safe escalation rules` are now also live, so dashboard queue order and dossier suggestion emphasis can react to measured completion / open outcomes instead of treating every grounded path as equally strong forever
- that ranking layer stays deliberately explainable and agent-approved: Acre can now promote higher-converting suggestion kinds, escalate stalled accepted actions for review, and suppress one-click duplicate follow-up creation when a similar AI-created follow-up is already overdue or still unresolved
- `quick lead intake` is now also live on `/agent/dashboard` and `/agent/clients`, so agents can capture a real FO client dossier, first follow-up date, and stage context without leaving the active execution shell
- that intake path now also performs a lightweight duplicate warning check against the current agent-owned FO queue before create, so obvious same-email / same-phone / same-name lead collisions can be reviewed before a second dossier is created
- `/agent/clients` now also exposes pairwise duplicate review + merge actions for the current agent-owned queue, so appointments, follow-up tasks, send records, handoff drafts, and transaction-contact links can be reconciled into one surviving FO dossier instead of leaving the duplicate guard at warning-only
- `AI explainability + FO / BO boundary hardening` are now also live, so the dashboard queue and dossier can explicitly answer why a suggestion is surfacing now, what changed the priority, whether the work should stay in Front Office or move into Back Office, and why one-click follow-up is available or paused
- a first `external calendar / email bridge` is now also live on appointment surfaces, so scheduled meetings can jump into Google Calendar, Outlook, downloadable ICS files, or a client-facing email brief without pretending Acre already owns a two-way sync
- keep the next FO iteration focused on deeper external-system integration plus broader CRM quality-of-life improvements before introducing any heavier automation or auto-send behavior

### Phase 2

Enhance in-flight deal execution:

- `Offer` / negotiation module
- `Inspection Report`
- PDF export
- closing / deal-win suggestions

Intent:

- add structured mid-funnel tools after the core FO flow is stable

### Phase 3

Later AI and commercialization:

- automated content generation
- enterprise WeChat exploration
- agent dynamic profile / landing page
- monetizable value-add packages

## Module expectations

### Dashboard

Should aggregate:

- today's tasks
- follow-up reminders
- recent client activity
- quick create lead entry
- recent send / click summary
- activity and notice cards
- `Front Office` / `Back Office` switch

### CRM

Should be a real client dossier center rather than a mock list.

Expected coverage includes:

- buyer and rental clients
- source and channel metadata
- budget, area, layout, business type, and timeline
- notes and attachments
- dedupe / merge support
- optional OCR-assisted intake from WeChat screenshots

### Status flow and reminders

The system should make missed follow-up visible.

Suggested status baseline:

- `Cold Lead`
- `Warm Lead`
- `Contacted`
- `Needs Follow-up`
- `Viewing Scheduled`
- `Viewing Completed`
- `Negotiation`
- `Application / Offer`
- `Won`
- `Lost`
- `Pending`

Rules:

- every status change should retain timestamp, operator, and note
- the system should suggest the next step by stage
- agents can set reminders manually
- active opportunities with no update for 15+ days should trigger reminder pressure
- team leaders should be able to see overdue follow-up queues

### Phone strategy / Chat List

Should embed training into the active execution context.

Examples:

- first-call question checklist
- intro scripts
- budget / area / timeline prompts
- showing scheduling prompts
- objection handling snippets
- copy-ready message templates

### Calendar / appointments

This is `Phase 1`, not a future-only placeholder.

Expected coverage:

- showing appointments
- events
- internal meetings
- day/week views
- in-app, email, and calendar reminders
- meeting links for Zoom / Google Meet
- on-site address, contact, and notes

### Listings and output

Should support:

- curated send-ready inventory
- standardized listing data
- URL/document-assisted import for authorized roles
- listing status freshness
- private agent send links vs public links
- tracked send/click feedback

### Agent material window

Should centralize:

- business card
- portrait / profile assets
- intro posters
- closing history
- featured cases
- one-click client send actions

### Document center / training center / vendor pool

Should make high-value materials easy to find first.

Examples:

- legal docs
- business forms
- standard contracts
- brand kit
- system videos
- sales training
- vendor cards with phone / QR / quick actions

### Activity center

Should support:

- event publish
- training notices
- office/admin notices
- agent RSVP
- reminder delivery
- roster and calendar writeback

## Tracking requirements

`Front Office` should be designed with first-class tracking.

Track at least:

- client create / edit / status change / reminder completion / overdue state
- send, open, click, and latest visit behavior
- template generation and usage
- appointment creation / reschedule / cancel / attendance
- resource search / open / watch progress / vendor click
- offer / inspection create / export / client view

Tracked links should include enough context to attribute:

- `agent_id`
- `listing_id`
- `resource_id` or `template_id`
- `channel`
- `campaign`
- `send_timestamp`

## FO and BO boundary

`Front Office` should integrate with:

- `Contacts`
- `Create Transaction`
- `Transactions`
- `Accounting`
- lease-date reminder fields
- external calendar / email systems
- tracked website or H5 link layers

Rules:

- FO should reduce duplicate entry and prepare data for BO
- FO may surface BO context read-only where helpful
- FO should not become a second accounting or transaction admin console

## Role expectations

- `Agent`: manage own clients, reminders, sends, public resources, activity signup, and authorized BO jump points
- `Team Leader`: see own + team overdue follow-up, team client overview, team listing/template usage, and team-related BO summaries
- `Office / Admin`: global reminders, listing/template publish control, resource/activity maintenance, cross-system rule setup
- `Finance / Back Office`: mostly read-only FO context, while owning downstream accounting and payout workflows
- `Super Admin`: full configuration and access

## Guidance for Codex tasks

When a user asks about `Front Office next steps`, roadmap, or implementation priority:

- answer from this file first
- do not anchor on older repo language that still says `Back Office` is always the only priority
- distinguish clearly between:
  - current implementation state
  - current `Front Office` target state from this spec

When implementing FO work:

- prefer the `Phase 1 -> Phase 1.5 -> Phase 2 -> Phase 3` order above
- treat current mock `/agent` pages as incomplete implementations, not product truth
- preserve the FO -> BO handoff boundary instead of duplicating formal BO workflows
