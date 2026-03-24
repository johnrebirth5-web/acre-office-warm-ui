# Accounting MVP Spec

## Goal

Provide a durable Back Office accounting foundation focused on transaction-side accounting, EMD, agent billing, and admin-controlled agent payout statements.

## Current implemented foundation

- `/office/accounting` exists and is database-backed
- `/office/accounting` is now an `office_admin`-only agent statement workspace
- admin-operated agent selection must treat `invited` agents as operationally usable, not hidden, because many agents never log in and are fully managed by office admins
- the statement workspace should source selectable payees from office/global sales memberships, not just office-local active agents:
  - include `agent` and `team_lead`
  - include `active` and `invited`
  - include current-office memberships plus company-level memberships with `officeId = null`
- chart of accounts foundation exists
- accounting transactions and line items exist
- general ledger entries exist
- EMD workflow exists
- agent payout statements now exist:
  - direct statement generation from eligible unpaid agent commission rows in the selected period
  - optional candidate preview / uncheck flow before final generation
  - durable statement snapshot
  - PDF download
  - saved statement detail / PDF now also show the member's current `AgentBankInformation` block between generated metadata and line items
  - saved statement detail / PDF line items now show `Creation date / Invoice number / Owner / Building name / Unit / Gross / Pre split / Commission rate / Post split / Net commission`
  - statement PDF uses a landscape table layout so the expanded line-item set remains readable
  - agent-facing statement output no longer surfaces `Office net`
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
- commission management primary workspace now lives at `/office/settings/commission-plans`

## Current gaps

- no bank reconciliation
- no QuickBooks sync
- no payroll
- no ACH payout execution
- chart editing is still read-first / limited
- old ledger / agent-billing / EMD UI is no longer exposed through `/office/accounting`

## Future direction

- deepen reporting and statement outputs
- strengthen accounting-to-commission and accounting-to-billing bridges
- replace MVP/manual areas with stronger controlled workflows where justified
