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
- `import-user-supplemental`
- `import-transactions`
- `run`

By default the CLI is dry-run. Database writes only happen with `--execute`.

Optional supplemental roster inputs:

- `--supplemental-sheet-url=<google-sheet-url>`
- `ACRE_LEGACY_IMPORT_SUPPLEMENTAL_SHEET_URL=<google-sheet-url>`

`run` keeps the old workflow when the supplemental URL is absent, but records the
step as skipped in the summary/report output.

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
- duplicate CSV email rows are merged into one membership with multi-company access
- when the same email appears with different roles, the merged account keeps the higher `team_lead` role
- imported accounts become `active`
- imported accounts receive a credential immediately
- initial password is `Acreny2026`
- `mustChangePassword = true`
- office access follows every company that the merged email appears in
- no team graph, reports-to chain, title, commission template, or split template is rebuilt

### Supplemental roster

When a supplemental Google Sheet URL is provided, the CLI downloads the workbook
export directly from Google Sheets and reads the full underlying workbook rows,
not the currently filtered visible rows in the browser.

Sheet -> office mapping:

- `Acre NY` -> `acre-ny-realty`
- `Acre NJ` -> `acre-nj-llc`
- `Acre Rentals` -> `acre-ny-rental`

Expected columns:

- `User Name`
- `License state`
- `Custom agent split %`
- `Expiration date`

Field mapping:

- `User Name` -> imported membership match within the mapped office scope
- `License state` -> `AgentOfficeProfile.licenseState`
- `Expiration date` -> `AgentOfficeProfile.expirationDate`
- `Custom agent split %` -> `MembershipCommissionSetting` via `saveAgentProfile`

Supplemental merge rules:

- rows are grouped per sheet by exact `User Name` before matching
- `licenseState` keeps the last non-empty value
- `expiration date` keeps the latest valid non-empty date
- `agent split` parses all available percentages and keeps the highest value
- mixed split text ignores dates, currency, caps, transaction-fee amounts, and
  other non-percent numbers
- `#N/A`, blank cells, and invalid dates are treated as empty values

Supplemental note behavior:

- existing office-scoped notes are preserved per matched sheet/company
- one import note block is appended per matched person
- the note block includes the sheet name, source rows, raw split text, and any
  conflicting license / expiration values detected inside the grouped rows

Supplemental match behavior:

- first try an office-scoped normalized exact name match
- then fall back to the existing alias / token-subset logic shared with
  transaction owner matching
- zero matches => skip row and report it
- multiple matches => skip row and report it

Supplemental commission behavior:

- if a valid split percent is extracted, create a new default split setting
- `commissionEffectiveFrom` is the import day in `America/New_York`
- if no valid split percent is extracted, the existing commission setting is left unchanged

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

Duplicate protection:

- rows whose legacy `custom_id` or fallback `id` already exists in imported transaction provenance are skipped
- this makes `import-transactions` re-runnable for partial catch-up without creating duplicate legacy rows

Owner matching:

- try `Agent Name`
- fallback to `Licensed Agent Name`
- if those fail, inspect legacy `users` and accept it only when exactly one imported internal user matches
- matching is case-insensitive
- whitespace is normalized
- parenthetical aliases are removed before compare
- slash-separated owner fragments can be recombined when the export split a name across two columns or tokens
- imported roster names also expose nickname / email-local-part aliases when they safely resolve to a unique person
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
- `supplemental-user-skipped.csv`
- `supplemental-user-failed.csv`
- `supplemental-user-success.csv`
- `transaction-skipped.csv`
- `transaction-failed.csv`
- `transaction-success.csv`

## Expected workflow

1. Run `analyze` or `run --dry-run`
2. Review skip / fail / warning reports
3. If you are using the supplemental sheet, review `supplemental-user-*.csv`
4. Run `run --execute`
5. Spot-check imported users and transactions in the app

## Known limitations

- owner matching is still deterministic and conservative; true missing agents, outside brokers, and opaque aliases still require manual cleanup
- dry-run simulates the post-reset contact set instead of reusing current test contacts
- supplemental notes are append-only and intentionally preserve prior notes for auditability
- the script is meant for this 2026-04 migration batch only
