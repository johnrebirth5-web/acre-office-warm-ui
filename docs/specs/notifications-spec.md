# Notifications Spec

## Goal

Provide a real Back Office notifications center for the signed-in user.

This inbox is intentionally different from `Activity Log`:

- `Activity Log`
  - account / system level audited event stream
  - source of truth for operational history
  - includes comments and live alerts
- `Notifications`
  - personal inbox for actionable alerts and reminders
  - scoped to the current membership / user
  - supports read / unread state and direct action links

## Route and access

- route:
  - `/office/notifications`
- access model:
  - requires a valid office session
  - uses the current signed-in membership as the notification recipient scope
  - preserves organization and office scoping on reads and writes

## Current implemented foundation

- `Notification` is now the persisted inbox record
- `/office/notifications` is a real page in the existing Office shell
- nav `User > Notifications` now points to the real route
- nav `User > Account` now exposes the current membership's notification preference controls
- inbox supports:
  - unread-first sorting
  - category filter
  - type filter
  - read / unread filter
  - date grouping
  - row-level deep links
  - mark read
  - mark unread
  - mark all in view as read
- notifications page also surfaces a live payout-review queue for `awaiting_agent` payout statements, so statement review stays visible even after the inbox row is marked read
- opening a notification uses a scoped redirect route that marks it as read first

## Notification model

Current notification records support:

- `organizationId`
- `officeId`
- `membershipId`
- `type`
- `category`
- `severity`
- `entityType`
- `entityId`
- `title`
- `body`
- `actionUrl`
- `metadata`
- `readAt`
- `createdAt`

The model remains explicit and reviewable; it does not reuse `AuditLog` rows as inbox items.

Current preference model for the inbox is also explicit:

- `MembershipNotificationPreference`
  - scoped to the current membership
  - controls only real in-app inbox creation
  - currently supports:
    - master in-app enable / disable
    - activity / approval alerts
    - task reminder alerts
    - offer alerts
  - payout statement live review queue is derived from statement status and is intentionally not hidden by inbox read state

## Current notification families

Current user-facing inbox coverage is limited to real implemented workflow signals:

- appointment due soon
- appointment external touch due
- task review requested
- task second review requested
- rejected task needing action
- offer created for an office-scoped responsible user
- offer received
- offer expiring soon
- signature pending
- signature completed
- incoming update pending review
- follow-up assigned
- follow-up overdue
- onboarding assigned
- onboarding due soon
- payout statement ready for agent review
- payout statement revision requested
- payout statement confirmed

## Current write paths

Notifications are currently written from real workflow services:

- `requestTransactionTaskReview`
- first approval -> second review handoff
- `rejectTransactionTask`
- `createOffer`
- offer `receive` transition
- signature `send` / `signed` transitions
- `createIncomingUpdate`
- `createFollowUpTask`
- `createAgentOnboardingItem`
- `sendAgentPayoutStatementToAgent`
- `respondToAgentPayoutStatement`

Time-based reminders without a scheduler are currently reconciled when the inbox is loaded:

- appointment due soon
- appointment external touch due
- offer expiring soon
- follow-up overdue
- onboarding due soon

This keeps the system honest without inventing a fake delivery daemon.

Current notification creation also respects the signed-in membership's saved inbox preferences before writing new inbox rows.

## Deep-link behavior

Notifications currently link to the nearest real actionable page:

- task review items:
  - `/office/approve-docs`
- rejected tasks:
  - transaction task section
- offers:
  - transaction offers anchor
- signatures:
  - transaction forms/signatures anchor
- incoming updates:
  - transaction incoming updates anchor
- follow-up:
  - contact detail
- onboarding:
  - agent onboarding anchor
- appointments:
  - `/agent/calendar?appointmentId=...`
- payout statements:
  - `/office/payout-statements/[statementId]`

If the product does not yet have a more precise queue or sub-route, the notification links to the closest practical page instead of faking a nonexistent destination.

On `/agent/notifications`, appointment-linked reminders now render in a dedicated reminder-pressure block before the broader notice stream, so confirmation, reschedule, external follow-up, and near-term appointment pressure do not disappear inside a generic inbox list.
Those Agent-side notice links now also open through a dedicated read-through page, so clicking a Front Office reminder marks it read before redirecting to the calendar, dossier, or nearest actionable route.
`/agent/notifications` now also exposes a lightweight reminder filter plus read/unread actions for the visible notice stack, including mark-all-read and mark-all-unread actions scoped to the currently visible Agent-side cards.
The Agent-side reminder filter and read-state view now also persist in the route query string, so the current inbox slice can be refreshed or reopened without losing context.
For team leads and office admins, `/agent/notifications` now also includes a dedicated team-cleanup section in the main activity stack, while the rail keeps a lighter leadership summary so team pressure is not trapped on `/agent/dashboard` only.
That same route now also persists a team-cleanup filter in the query string, so leadership users can reopen the activity center directly into overdue-task, stale-client, or send-trail-risk pressure without resetting to the mixed queue.
That same route now also persists an `activityView` focus state in the query string, so the page can reopen directly into personal cleanup, team cleanup, appointment reminders, or general notices instead of always rendering the full mixed center first.

## Current limitations

- no email / SMS / WeChat delivery
- no dismiss / archive action yet
- no background scheduler; time-based reminders are created during inbox reconciliation
- appointment reminder reconciliation now also deletes stale appointment timing/writeback notifications when the appointment no longer matches the active reminder window
- reviewer targeting still follows current permission-based queues, not explicit reviewer assignment models
- onboarding notifications are most useful for office-role recipients because the current inbox route is office-only
- preferences only control the in-app inbox and do not create email / SMS / push channels; the live payout review queue remains visible while a statement is still awaiting agent action
- changing preferences does not rewrite or delete already-created notification rows

## Future direction

- add dismiss / archive semantics if the product needs inbox cleanup beyond read state
- add scheduler-driven reminder generation when a real job runner exists
- expand notification coverage only when new workflow modules become real
- keep notifications distinct from `Activity Log` even when both are triggered by the same workflow action
