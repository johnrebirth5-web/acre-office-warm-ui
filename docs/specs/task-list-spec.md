# Task List Spec

## Goal

Provide a real Back Office task list for transaction workflow, approvals, compliance, and operational follow-up.

## Current implemented foundation

- `/office/tasks` exists and is database-backed
- `/office/approve-docs` now exists as the dedicated reviewer queue for document-linked task approvals
- built-in views:
  - `Requires attention`
  - `All transactions`
- document approval queue views now include:
  - `All open review items`
  - `Awaiting my review` (current-user actionable review work, including second review when the current reviewer is eligible)
  - `Awaiting second review`
  - `Rejected`
  - `Waiting for signatures`
  - `Missing required document`
- personal saved views exist
- tasks support:
  - create / edit
  - complete / reopen
  - request review
  - approve / reject
  - secondary approval
- queue review actions reuse the same task workflow API and do not create a second approval system
- second approval continues to enforce a different reviewer from the first approver
- task workflow can reflect:
  - pending upload
  - uploaded / not submitted
  - review requested
  - second review requested
  - approved
  - rejected
  - waiting for signatures
  - fully signed
  - complete
  - reopened
- HR checklist execution is a separate lightweight workflow:
  - it can reuse `ChecklistTemplate` / `ChecklistTemplateItem` as a template source
  - runtime state is stored in `HrChecklistInstance` / `HrChecklistInstanceItem`
  - HR onboarding / offboarding checklists do not create or mutate transaction-only `TransactionTask` rows

## Current gaps

- no reminder delivery system
- no reviewer assignment / SLA model beyond the current permission-based queue
- checklist template auto-application is still limited
- no complex BPM/workflow engine

## Future direction

- strengthen checklist application from admin templates
- improve reviewer load balancing and bottleneck visibility
- add stronger alerting/reminder workflows without duplicating task state
