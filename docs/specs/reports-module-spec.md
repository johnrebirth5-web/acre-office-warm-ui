# Reports Module Spec

## Purpose

`/office/reports` is the unified transaction reporting and export center for Back Office users. It must read directly from live transaction data, not from a second report-specific aggregate store.

## Data model truth

- Primary source:
  - `Transaction`
- Supporting sources:
  - `TransactionFinanceFee`
  - `Membership / Team / TeamMembership`
  - `Office`
- Pricing fields:
  - `askingPrice`
  - `purchasedPrice`
  - legacy `price` remains as a compatibility mirror of `purchasedPrice`
- Date fields:
  - creation filtering uses `Transaction.createdAt`
  - closing / move-in filtering and display use `Transaction.moveInDate ?? Transaction.closingDate`

## Workspace contract

The reports service returns one transaction-centric workspace contract:

- `filters`
- `rows`
- `summary`
- `totalCount`
- `columns`

CSV export must reuse the same filter contract, column registry, and permission scope as the page.

## Filters

Current supported filters:

- `Owner`
- `Creation Date` with `eq / gte / lte / range`
- `Buyer / Tenant`
- `Closing / Move-In Date` with `eq / gte / lte / range`
- `Commission` with `eq / gt / gte / lt / lte / range`
- `Asking Price` with `eq / gt / gte / lt / lte / range`
- `Purchased Price` with `eq / gt / gte / lt / lte / range`
- `Transaction Status[]`
- `Invoice Number`
- `Department[]`
- `Team Leader[]`
- `Transaction Type[]`
- `Representing Side[]`
- `Layout[]`
- `Company Referral`

## Row mapping

Selected mappings are fixed:

- `Department` = `Transaction.office.name`
- `Team Leader` = current hierarchy-derived leader from `TeamMembership`
- `Commission` filter = `Transaction.grossCommission`
- `Buyer / Tenant`, `Licensed Agent Name`, `Invoice Number`, `Building Name`, `Layout`, `Invoice Bill To`, `Leasing Contact`, `Currency Type`, `Co-Agent Legal Name`, `Commission Breakdown`, `Notes`, `External Partners` = transaction `additionalFields`
- `Representing Side` labels:
  - `buyer -> Buyer Side`
  - `seller | landlord -> Seller Side`
  - `both -> Both`
  - `tenant -> Tenant`

## Summary

Current live summary totals:

- `Asking Price`
- `Purchased Price`
- `Gross Commission`
- `Rebate`
- `Referral`
- `Reimbursement`

All totals are recalculated from the currently filtered transaction rows.

## Permissions

Reports visibility follows role/scope permissions, not hardcoded email checks:

- `owner / office_admin / accountant / human_resources`
  - company scope
- `team_lead`
  - self + downline scope
- `agent`
  - self scope only

Export scope must always match on-screen scope.
