# Accounting MVP Spec

## Goal

Provide a durable Back Office accounting foundation focused on transaction-side accounting, EMD, agent billing, and admin-controlled agent payout statements, while allowing self-service members to view their own saved payout output.

## Current implemented foundation

- `/office/accounting` exists and is database-backed
- `/office/accounting` is now an `office_admin`-only agent statement workspace
- the statement workspace now sources selectable payees from `active` or `invited` memberships that either:
  - have eligible direct `commissionCalculation` rows
  - or already have saved payout statements
- admin-managed accounting must not require the member to activate/login first; invited memberships remain operationally usable
- selectable payees are no longer limited to `agent / team_lead`; manual override participants can also appear if they are `active` or `invited` memberships with direct payout rows
- chart of accounts foundation exists
- accounting transactions and line items exist
- general ledger entries exist
- EMD workflow exists
- agent payout statements now exist:
  - direct statement generation from selected invoice numbers on eligible unpaid agent commission rows
  - optional candidate preview / uncheck flow before final generation
  - invoice matching currently comes from the transaction `invoiceNumber` field; there is no separate invoice-receipt truth model yet
  - durable statement snapshot
  - PDF download
  - saved statement detail / PDF now also show the member's current `AgentBankInformation` block between generated metadata and line items
  - saved statement detail / PDF line items now show `Creation date / Invoice number / Owner / Building name / Unit / Gross / Pre split / Commission rate / Post split detail / Net commission`
  - `Post split detail` keeps the total and separately lists the saved `External Referral`, `Company Referral`, and `Channel Development Fee` amounts for that line item when the source finance version had named post-split fees
  - statement PDF uses a landscape table layout so the expanded line-item set remains readable
  - agent-facing statement output no longer surfaces `Office net`
  - manual override participant rows remain formal statement line-item sources because they are saved as direct agent `commissionCalculation` rows
- agent billing exists:
  - ledger
  - one-time charges
  - recurring rules
  - payment methods foundation
  - collections / payments
  - statement summary
- self-service billing exists:
  - `/office/billing`
  - current-membership summary / ledger / statement list
  - masked payment-method reference maintenance
  - no live gateway or ACH execution
- self-service commission statement access now exists on `/office/dashboard`:
  - the current membership sees self-only commission totals when direct commission or statement data exists
  - the current membership sees a `My payout statements` list for saved statements
  - the current membership can download only their own saved payout statement PDFs
  - self-service users cannot generate statements; creation stays in admin/accounting workflows
- commission management primary workspace now lives at `/office/settings/commission-plans`

## Current gaps

- no bank reconciliation
- no QuickBooks sync
- no payroll
- no ACH payout execution
- chart editing is still read-first / limited
- old ledger / agent-billing / EMD UI is no longer exposed through `/office/accounting`
- self-service statement generation is intentionally not exposed; only saved statements are downloadable by the member

## Future direction

- deepen reporting and statement outputs
- strengthen accounting-to-commission and accounting-to-billing bridges
- replace MVP/manual areas with stronger controlled workflows where justified
