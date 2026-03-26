# Performance Module Spec

## Purpose

`/office/performance` is the Office-side performance workspace for agent output review, ranking visibility, and lightweight management comparison.

The module must stay grounded in current live transaction data, not a second pre-aggregated performance table.

## Data model truth

- Primary source:
  - `Transaction`
- Supporting source:
  - `TransactionFinanceFee`
  - `Membership / Team / TeamMembership`
  - `Office`
- Current formula:
  - `Performance = Gross Commission - Rebate - Referral Fee - Reimbursement`
- Date attribution:
  - `Transaction.moveInDate ?? Transaction.closingDate`
- Included statuses:
  - `pending`
  - `closed`

## Workspace contract

The performance service returns one page-ready workspace contract:

- `filters`
- `selectedRangeLabel`
- `summary`
- `table`
- `leaderboards`

CSV export must reuse the same page filter contract and amount-visibility rules.

## Filters

Current supported filter contract:

- `period=month|quarter|year`
- `company=ny|rental|nj`
- `year`
- `month`
- `quarter`
- `yearStart`
- `yearEnd`

Current rollout behavior:

- only `ny` is exposed in UI
- `rental / nj` stay reserved in the contract for later activation

## Table behavior

- Month view:
  - selected natural year
  - columns = `Jan ... Dec`
- Quarter view:
  - selected natural year
  - columns = `Q1 ... Q4`
- Year view:
  - selected natural year range
  - columns = one column per year

Row visibility:

- company scope:
  - all visible sales members in the active company bucket
- team scope:
  - self + visible downline branch
- self scope:
  - current viewer only

## Ranking behavior

Leaderboards always render three boards together:

- month ranking
- quarter ranking
- year ranking

Scope rules:

- company-scope viewers:
  - company leaderboard with full amounts
- team leads:
  - team leaderboard with full amounts
- agents:
  - company Top 10 leaderboard
  - peer amounts hidden
  - own current rank and own amount still visible

## Permissions

This module does not introduce a new permission family.

It reuses current report visibility scope:

- `reports:view:personal`
- `reports:view:team`
- `reports:view:company`

Export:

- allowed for team/company scope viewers
- denied for self-only viewers
