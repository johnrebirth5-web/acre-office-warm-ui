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
- `searchLayout`
- `page`
- `pageSize`
- `totalPages`
- `rows`
- `summary`
- `totalCount`
- `columns`

Behavior rules:

- `rows` always represent the current page only
- `totalCount` always represents the full filtered result set, not the current page
- `summary` always represents the full filtered result set, not the current page
- page query params are `page` and `pageSize`
- CSV export must reuse the same filter contract, column registry, and permission scope as the page, but ignore `page` and `pageSize` so the export always contains the full filtered result set

## Search layout

- reports search fields are office-shared, not per-user
- users with field-management permission can add/remove visible filters through `Edit fields`
- selected field layout is persisted by `organizationId + officeId`
- hidden filter params in an old URL are still honored on first load for compatibility, but once the user reapplies filters the URL is rebuilt from only the currently visible fields
- `Sort By` and `Direction` stay pinned in the workbench and are not part of the editable field layout
- people-name filters such as `Owner` and `Team Leader` must use search-first pickers instead of raw dropdowns so the workbench still scales when offices have large rosters

Default visible report fields:

- `Owner`
- `Creation Date`
- `Closing / Move-In`
- `Transaction Status`
- `Department`
- `Team Leader`
- `Transaction Type`

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

All totals are recalculated from the currently filtered transaction set, not just the current page rows.

## Permissions

Reports visibility follows role/scope permissions, not hardcoded email checks:

- `owner / office_admin / accountant / human_resources`
  - company scope
- `team_lead`
  - self + downline scope
- `agent`
  - self scope only

Export scope must always match on-screen scope.
