# Commission Management Spec

## Goal

Provide a durable commission automation MVP inside Back Office, with a default split-chain system for day-to-day use and legacy advanced plans preserved for fee-heavy or transitional cases.

## Current implemented foundation

- commission plans exist
- split templates now exist for reusable `20/80` / `50/50` style defaults
- membership-level default commission settings now exist as the primary source of truth
- assignments exist for:
  - agents
  - teams
- precedence is explicit:
  - direct agent assignment overrides team assignment
  - team assignment applies when no active direct assignment exists
- plan rules support:
  - base split
  - brokerage fee
  - referral fee
  - flat fee deduction
  - sliding scale
- transaction-level calculations are persisted
- default transaction calculation now supports:
  - owner membership split
  - recursive reporting-line uplines
  - differential share allocation per level
  - company remainder
  - transaction `createdAt` as the locking date for default split / hierarchy replay
- transaction detail has a commission section
- `/office/dashboard` now includes a self-service commission summary for the current logged-in membership:
  - total persisted commission
  - current-month commission
  - monthly commission totals
- `/office/settings/commission-plans` is the primary commission management workspace
- agent profile shows commission summary
- strict visibility now applies:
  - agent sees self rows only
  - manager sees self + downline rows
  - admin/accountant sees full chain and company rows
- self-service visibility is separated from commission management:
  - sales roles can view scoped commission data on dashboard and transaction detail
  - commission plan / statement management stays in admin-review surfaces only
- internal statuses include:
  - draft
  - calculated
  - reviewed
  - statement_ready
  - payable
  - paid

## Current gaps

- no ACH / bank transfer execution
- no payroll / tax workflow
- no full enterprise rule engine
- statement generation is still MVP-level
- legacy fee/status tools still coexist with the new default split-chain path

## Future direction

- strengthen accounting bridge for payable items
- deepen statement snapshots and payout workflow
- expand commission summary/report outputs without redesigning the foundation
- continue shrinking the legacy plan surface so most daily commission work stays inside split templates + membership defaults
