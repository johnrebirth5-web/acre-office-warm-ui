# Activity Log Spec

## Goal

Provide a real account activity + operational alerts module for Back Office, with audited events, internal comments, and live workflow alerts inside one operational page.

## Current implemented foundation

- `/office/activity` exists and is database-backed
- `AuditLog` is the single source of truth for activity events
- page supports:
  - activity events
  - operational alerts
  - left-side grouped sections
  - actor / object type / date range filtering
  - internal comments in the same stream
- major current workflow families already write events:
  - auth
  - tasks / approvals
  - documents / forms / signatures
  - offers
  - accounting / billing / commissions
  - agent management
  - settings/admin
- `Approve Docs` queue actions write the same task approval events, with structured source metadata so queue-driven review actions remain readable in the shared log
- approval invalidation caused by missing required documents or signature rollback writes the same `transaction_task` reopen event family, with structured workflow-reason metadata for readable audit summaries
- `/office/activity` now loads in two phases:
  - server-side `getOfficeActivityLogSnapshot()` renders the audit-backed activity stream, section counts, and actor filter options
  - client-side `GET /api/office/activity/alerts` fetches live-derived operational alerts after the page loads or when alert filters change
- operational alerts remain live-derived from current transaction / task / contact / follow-up / accounting state, but they no longer block the initial server render of the page

## Current gaps

- event coverage is only as complete as implemented write paths
- export/search depth is still limited
- no separate analytics over activity history
- alerts are practical MVP alerts, not a full notification product

## Future direction

- expand event coverage for new workflow modules
- strengthen alert taxonomy as more workflows become real
- add better admin/audit filtering and history review tools
