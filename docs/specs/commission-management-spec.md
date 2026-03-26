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
  - `client_referral` (user-facing label: `Internal Referral`)
  - `external_referral`
  - `company_referral`
  - `reimbursement`
  - legacy `channel_development_fee` rows may still exist in storage for backward compatibility, but active calculator / calculation / statement flows no longer seed, surface, or use them
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
  - the same simplified commission calculator used in create flow, instead of a separate fee-ledger editor
  - one left-to-right input path for:
    - `Gross Commission`
    - `Rebate`
    - `Internal Referral`
    - `External Referral`
    - `Company Referral`
    - `Calculate`
    - `Final Agent Net`
  - each fee keeps both `Amount` and `Rate %` inputs; editing one value auto-fills the paired value when `Gross Commission` is available
  - one shared `Note` field instead of multiple fee-level note inputs
  - `Pre-Split Total`
  - `Post-Split Total`
  - `Net Commission`
  - `Final Agent Net`
  - `Final Office Net`
  - prerequisite flags for `client referral` / `rebate`
- transaction creation intake now supports a structured finance seed path:
  - `New Transaction` create modal and `/office/transactions/new` now present create-time finance as a simplified commission calculator instead of a fee-by-fee ledger editor
  - the create-time calculator keeps one left-to-right input path:
    - `Gross Commission`
    - `Rebate`
    - `Internal Referral`
    - `External Referral`
    - `Company Referral`
    - `Calculate`
    - `Final Agent Net`
  - `Gross Commission` is the only required create-time field; the other fee inputs stay optional and blank values are treated as `0`
  - each fee also keeps an optional `Rate %` input, matching the earlier finance editor while staying inside the simplified calculator layout
  - create-time calculator preview reuses the existing split-chain + fee-placement rules to show a `Final Agent Net` result before the transaction is saved
  - the create-time note surface is now one shared `Note` field instead of separate fee-level notes
  - create-time finance input writes the same transaction finance storage used by detail finance instead of leaving those values only inside legacy custom text fields
  - blank create-time fee rows now stay blank in persistence; the system no longer auto-materializes placeholder `20%` rebate/referral/company-referral fees when the user did not explicitly enter them
  - create-time intake no longer shows the retired legacy commission text/select placeholders that were disconnected from the real fee ledger
- transaction detail commission section now supports:
  - current stakeholder breakdown
  - one combined post-split fee summary row in transaction detail `Commission`, rolling up the active `External Referral` and `Company Referral` amounts for quick review
  - current calculation version summary
  - calculation history
  - manual override for final stakeholder payouts
  - `Office Admin`-only add/remove of extra organization memberships during override
  - invited memberships stay operationally usable for admin-managed override work; the member does not need to activate/login first
  - manual participant rows saved as formal `commissionCalculation` agent rows
  - override total validation that must keep the full payout pool unchanged
  - manual-participant lock that blocks future `Recalculate`; once a transaction has manual participants it must continue through override only
- `/office/dashboard` now includes a self-service commission summary when the current membership has direct commission or statement data:
  - total persisted commission
  - current-month commission
  - current month always visible, with older monthly totals tucked into a collapsible history menu
  - recent saved payout statements with self-only PDF download links
- `/office/settings/commission-plans` is the primary commission management workspace
- agent profile shows commission summary
- strict visibility now applies:
  - agent sees self rows only
  - manager sees self + downline rows
  - admin/accountant sees full chain and company rows
- self-service visibility is separated from commission management:
  - current memberships with direct self data can view self-only commission data on dashboard
  - transaction detail commission visibility still stays scoped by the existing commission visibility rules
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
  - `external_referral` defaults to `post_split`
  - `reimbursement` uses the standalone reimbursement rule
- calculation order:
  1. read `Gross Commission`
  2. sum all current `pre_split` fees
  3. compute `Net Commission`
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
  - `client_referral` above `20%`
  - `rebate` above `20%`
- when a fee exceeds the default threshold:
  - system marks it as approval-required
  - formal commission calculation is blocked until the fee is marked approved
  - UI shows the approval instruction to email `cathy@acreny.us` and copy `pay@acreny.us`
- prerequisite checks:
  - `client_referral` (`Internal Referral`) requires `Agent Referral Form` confirmed as signed and approved
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
- transaction detail and statement views keep showing the saved post-split fee effects from the finance version / statement line snapshot, even though those fees still flow back into the company-side allocation by default
- history remains visible for audit/review but is not double-counted in payout summaries
- manual override versions may include extra `active` or `invited` memberships that were not part of the original split chain
- manual participant rows are marked as manual in the stored stakeholder snapshot:
  - `Share` shows the effective percentage implied by the latest `Final` amounts
  - `Base / Post-Split / Reimbursement` stay `0` or `—`
  - `Final` reflects the admin-entered override amount
- both transaction stakeholder tables and agent statement detail / PDF views recompute share percentages from the current `Final` allocations instead of preserving the old split-chain percentages after post-split or override adjustments
- manual override validation rules:
  - `overrideReason` is required
  - user rows must map to `active` or `invited` memberships in the same organization
  - `company` must remain present exactly once
  - duplicate memberships are rejected
  - payout amounts must stay non-negative
  - total allocated payout must remain identical to the current version total

## Current gaps

- no ACH / bank transfer execution
- no payroll / tax workflow
- no full enterprise rule engine
- statement generation is still MVP-level
- first release keeps one current row per fee type, not multiple rows of the same fee type
- manual override can add/remove extra `active` or `invited` memberships for a specific transaction version, but it still does not rewrite the source fee ledger or commission plan defaults
- legacy fee/status tools still coexist with the new default split-chain path

## Future direction

- strengthen accounting bridge for payable items
- deepen statement snapshots and payout workflow
- expand commission summary/report outputs without redesigning the foundation
- continue shrinking the legacy plan surface so most daily commission work stays inside split templates + membership defaults
