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
- transaction finance ledger now supports one current row per fee type:
  - `rebate`
  - `client_referral`
  - `external_referral`
  - `company_referral`
  - `channel_development_fee`
  - `reimbursement`
- each transaction finance fee row stores:
  - rate
  - amount
  - default calculation type
  - selected calculation type
  - approval-required state
  - approval status
  - notes
- transaction detail has a commission section
- transaction detail finance section now supports:
  - transaction-level fee ledger editing
  - `Pre-Split Total`
  - `Post-Split Total`
  - `Net Commission Base`
  - `Final Agent Net`
  - `Final Office Net`
  - prerequisite flags for `client referral` / `rebate`
- transaction detail commission section now supports:
  - current stakeholder breakdown
  - current calculation version summary
  - calculation history
  - manual override for finance/admin users
- `/office/dashboard` now includes a self-service commission summary for sales-role memberships (`agent / team_lead`) only:
  - total persisted commission
  - current-month commission
  - current month always visible, with older monthly totals tucked into a collapsible history menu
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

## Transaction finance rule engine

- fee calculation types:
  - `pre_split`
  - `post_split`
  - `reimbursement`
- default fee behavior:
  - `rebate` defaults to `pre_split`
  - `client_referral` defaults to `pre_split`
  - `company_referral` defaults to `post_split`
  - `channel_development_fee` defaults to `post_split`
  - `external_referral` defaults to `post_split`
  - `reimbursement` uses the standalone reimbursement rule
- calculation order:
  1. read `Gross Commission`
  2. sum all current `pre_split` fees
  3. compute `Net Commission Base`
  4. run the split chain on the reduced base
  5. sum all current `post_split` fees
  6. deduct those fees from the owner agent row only
  7. add those fees back into the company row
  8. calculate reimbursement separately
  9. persist current version + current commission rows
- split-chain rule:
  - owner takes the owner split first
  - each upstream leader takes only the differential above the level below
  - company takes the remainder
- `pre_split` fees reduce the base for every stakeholder
- `post_split` fees do not change upstream split math; they only reduce the owner agent final net
- first release assumption:
  - all `post_split` fees flow back to company
  - there is no separate external payee row yet
- reimbursement rule:
  - reimbursement does not enter the split base
  - company reimbursement amount is capped at `50%` of the lesser of:
    - reimbursement amount
    - `Final Agent Net * 10%`

## Approval and prerequisite rules

- approval-required thresholds:
  - `channel_development_fee` above `20%`
  - `client_referral` above `20%`
  - `rebate` above `20%`
- when a fee exceeds the default threshold:
  - system marks it as approval-required
  - formal commission calculation is blocked until the fee is marked approved
  - UI shows the approval instruction to email `cathy@acreny.us` and copy `pay@acreny.us`
- prerequisite checks:
  - `client_referral` requires `Agent Referral Form` confirmed as signed and approved
  - `rebate` requires both `Rebate Agreement` signed and `Rebate Google Form` submitted
- first release assumption:
  - prerequisite checks are finance-confirmed booleans on the transaction
  - the system does not yet auto-read documents/forms/signatures to decide eligibility

## Versioning and payout snapshot behavior

- every calculate run creates a new transaction finance calculation version
- every manual override creates a new transaction finance calculation version
- each version stores:
  - fee breakdown
  - stakeholder breakdown
  - summary totals
  - blocking issues
  - notes / override reason
  - actor + timestamps
- only one version is marked current
- the current version is mirrored into the active `CommissionCalculation` rows for compatibility
- statement / payslip views read the current version-backed rows only
- history remains visible for audit/review but is not double-counted in payout summaries

## Current gaps

- no ACH / bank transfer execution
- no payroll / tax workflow
- no full enterprise rule engine
- statement generation is still MVP-level
- first release keeps one current row per fee type, not multiple rows of the same fee type
- first release manual override edits final stakeholder payouts only; it does not rewrite the source fee ledger
- legacy fee/status tools still coexist with the new default split-chain path

## Future direction

- strengthen accounting bridge for payable items
- deepen statement snapshots and payout workflow
- expand commission summary/report outputs without redesigning the foundation
- continue shrinking the legacy plan surface so most daily commission work stays inside split templates + membership defaults
