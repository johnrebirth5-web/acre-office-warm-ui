# Legacy Import 2026-04

## Goal

Provide a one-time CLI to:

- preserve the shared Acre organization shell
- clear legacy test roster / transaction business data
- import the three company agent CSVs
- import the three company transaction CSVs

This is an operational migration script, not a reusable admin UI.

## Entry point

- CLI: `npm run import:acre-2026-04 -- <command>`
- Script: `scripts/import/acre-2026-04/index.ts`
- Internal helpers: `packages/db/src/legacy-import.ts`

Supported commands:

- `analyze`
- `reset-business-data`
- `import-users`
- `import-transactions`
- `run`

By default the CLI is dry-run. Database writes only happen with `--execute`.

## Source files

### Users

- `ACRE_NJ_LLC_active_agents (1).csv` -> `acre-nj-llc`
- `ACRE_NY_REALTY_INC_active_agents (1).csv` -> `acre-ny-realty`
- `ACRE_NY_RENTALS_LLC_active_agents.csv` -> `acre-ny-rental`

User CSV columns:

- `name`
- `email`
- `role`

Role mapping:

- `Agent` -> `agent`
- `Team leader` -> `team_lead`

Name parsing:

- last token becomes `lastName`
- all prior tokens become `firstName`
- single-token names fall back to `lastName = Imported` and emit a warning

User import behavior:

- dedupe key is normalized email
- duplicate CSV email rows are skipped and reported
- imported accounts become `active`
- imported accounts receive a credential immediately
- initial password is `Acreny2026`
- `mustChangePassword = true`
- office access is fixed to the single company from the source file
- no cross-company access is created from this import
- no team graph, reports-to chain, title, commission template, or split template is rebuilt

## Reset scope

`reset-business-data` keeps:

- organization
- offices
- field settings
- custom field definitions
- role templates
- bootstrap admin user / membership / credential

`reset-business-data` clears organization business data that can be rebuilt from the migration:

- memberships except preserved bootstrap membership
- imported/test users except preserved bootstrap user
- invitations
- membership office access / permission overrides
- team memberships / teams
- contacts
- transactions and linked workflow data
- commissions / payout statements / accounting-derived business rows
- follow-up / activity-style operational rows tied to the reset scope

## Transaction import rules

Three transaction exports map to the same three company scopes.

Status handling:

- import `pending`
- import `closed`
- skip `active`
- skip `opportunity`
- skip `cancelled`

Owner matching:

- try `Agent Name`
- fallback to `Licensed Agent Name`
- matching is case-insensitive
- whitespace is normalized
- parenthetical aliases are removed before compare
- zero matches => fail row and report it
- multiple matches => fail row and report it

Contact matching:

- exact `Client's Email`
- exact normalized `Client Name`
- exact normalized `Buyer/Tenant`
- otherwise create a new contact

New contact defaults:

- `source = Legacy transaction import`
- `stage = Imported`
- `intent = Unknown`
- owner is the matched transaction owner

Transaction field mapping:

- `transaction_name` -> `transactionName`
- `Address / City / State / Zip Code` are preferred
- `full_address` is used as fallback parsing input
- `price` -> `askingPrice`
- `Sales Price/Gross Rent`, then `sales_volume`, then `Net Price`, then `price` -> `purchasedPrice`
- `total_gross_commission`, then `office_gross`, then `Commission($)` -> `grossCommission`
- `office_net` -> `officeNet`
- `agent_net` -> `agentNet`
- `Referral Fee` -> `referralFee`
- `Company Referral` -> `companyReferral`
- `Company Referral Employee's Name` -> `companyReferralEmployeeName`
- `Note(Rebate, Referral, Others)` -> `financeNotes`

Transaction type normalization:

- `Commercial Sale` -> `Commercial Sales`
- `Rent/Lease` -> `Rental/Leasing`
- `rent/lease` -> `Rental/Leasing`
- `rental/leasing` -> `Rental/Leasing`
- `sales` -> `Sales`
- `rental (listing)` -> `Rental (listing)`
- unsupported values fall back to `Other` with a warning

Additional field behavior:

- safe text-like fields are preserved in `additionalFields`
- constrained select values that do not fit current allowed options stay in provenance keys only
- raw source ids and metadata are preserved under `legacy*` keys
- the raw `users` column is preserved, but participant links are not rebuilt

Currency handling:

- non-`USD` rows are still imported
- numeric amounts are imported unchanged
- original currency is preserved in `additionalFields`
- this is an explicit business choice and can distort cross-currency financial reporting

## Reports

Each run writes a timestamped report directory under:

- `.local-storage/legacy-import-reports`

Reports include:

- `summary.json`
- `user-issues.csv`
- `transaction-skipped.csv`
- `transaction-failed.csv`
- `transaction-success.csv`

## Expected workflow

1. Run `analyze` or `run --dry-run`
2. Review skip / fail / warning reports
3. Run `run --execute`
4. Spot-check imported users and transactions in the app

## Known limitations

- duplicate email rows across company CSVs are not merged into cross-company access
- owner matching is exact after normalization; near-miss names still require manual cleanup
- dry-run simulates the post-reset contact set instead of reusing current test contacts
- the script is meant for this 2026-04 migration batch only
