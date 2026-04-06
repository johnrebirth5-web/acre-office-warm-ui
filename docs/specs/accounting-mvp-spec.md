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
  - direct statement generation from selected invoice numbers on visible agent commission rows, including regenerating fresh snapshots from `payable / paid` rows while keeping already-`paid` rows in `paid`
  - one combined statement-candidates workspace now keeps invoice selection and candidate-row preview in the same card, with an optional preview / uncheck flow before final generation
  - candidate-row transaction drilldown now opens inside the accounting workspace as an embedded transaction detail modal, so admins can review or edit the source transaction/finance data without leaving the current statement selection
  - closing the embedded transaction modal refreshes the current accounting snapshot while keeping the statement workflow context on the same page
  - invoice matching currently comes from the transaction `invoiceNumber` field; there is no separate invoice-receipt truth model yet
  - durable statement snapshot
  - PDF download
  - saved statement detail / PDF now also show the member's current `AgentBankInformation` block between generated metadata and line items
  - saved statement detail / PDF line items now show `Creation date / Invoice number / Owner / Building name / Unit / Gross / Pre split / Commission rate / Post split detail / Net commission`
  - `Post split detail` keeps the total and separately lists the saved `External Referral` and `Company Referral` amounts for that line item when the source finance version had named post-split fees
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
- 1099 Tracker now exists as a separate `office_admin`-only accounting-adjacent module at `/office/1099-tracker`:
  - `Payment Record` stores actual company-paid agent payouts by `Agent + Tax Year` with editable free line items
  - `1099 Summary / Preview` aggregates annual totals per agent from those saved payment records only
  - the summary uses current `AgentBankInformation` as the payee-profile source, including `payeeName`, tax ID, contact number, address, and email
  - preview and PDF export remain available even when profile fields are missing; the UI and export simply keep those values blank while warning the admin
  - exported PDFs are internal `1099 Summary / Backup Document` output, not official IRS 1099 forms
- self-service billing exists:
  - `/office/billing`
  - current-membership summary / ledger / statement list
  - masked payment-method reference maintenance
  - no live gateway or ACH execution
- self-service commission statement access now exists on `/office/dashboard`:
  - the current membership sees self-only commission totals when direct commission or statement data exists
  - the current membership sees a `My payout statements` list for saved statements
  - payout statements now follow an internal-only review lifecycle:
    - `draft`
    - `awaiting_agent`
    - `revision_requested`
    - `confirmed`
    - `paid`
  - admins must explicitly `Send to agent` from `/office/accounting` before a saved statement becomes visible for agent review
  - office admins can now override the saved statement review status directly from the `/office/accounting` history table, including rolling a previously `confirmed` statement back into another review state or marking it `paid`
  - the current membership can open only their own non-`draft` statement at `/office/payout-statements/[statementId]`
  - the current membership can download only their own sent/saved payout statement PDFs
  - the current membership can confirm the statement in-system or submit an in-system revision request with a required message
  - finance/admin can resend the statement with an internal note, and the full conversation stays on the statement timeline inside the BO system
  - no payout-statement delivery, confirmation, or revision handling should depend on email / WeChat; this workflow is intentionally system-internal only
  - self-service users cannot generate statements; creation stays in admin/accounting workflows
- commission management primary workspace now lives at `/office/settings/commission-plans`

## Current gaps

- no bank reconciliation
- no QuickBooks sync
- no payroll
- no ACH payout execution
- chart editing is still read-first / limited
- old ledger / agent-billing / EMD UI is no longer exposed through `/office/accounting`
- self-service statement generation is intentionally not exposed; agent self-service stays limited to reviewing, confirming, requesting revision, and downloading statements that finance has already sent internally
- there is no batch 1099 PDF export, IRS box mapping, or e-filing integration yet; current 1099 output is strictly internal backup/support documentation

## Future direction

- deepen reporting and statement outputs
- strengthen accounting-to-commission and accounting-to-billing bridges
- replace MVP/manual areas with stronger controlled workflows where justified
