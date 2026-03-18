# Accounting MVP Spec

## Goal

Provide a durable Back Office accounting foundation focused on transaction-side accounting, EMD, agent billing, and operational ledger visibility.

## Current implemented foundation

- `/office/accounting` exists and is database-backed
- chart of accounts foundation exists
- accounting transactions and line items exist
- general ledger entries exist
- EMD workflow exists
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

## Future direction

- deepen reporting and statement outputs
- strengthen accounting-to-commission and accounting-to-billing bridges
- replace MVP/manual areas with stronger controlled workflows where justified
