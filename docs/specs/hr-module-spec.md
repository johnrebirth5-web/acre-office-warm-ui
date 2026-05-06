# HR Module Spec

## Purpose

The HR module is a new Back Office surface for recruiting, interviews, offers, onboarding, employee documents, and offboarding.

Routes:

- `/office/hr`
- `/office/hr/candidates`
- `/office/hr/interviews`
- `/office/hr/onboarding`
- `/office/hr/offboarding`
- `/office/hr/templates`
- public no-login onboarding window: `/onboarding/[token]`

This module does not replace Transactions, Signatures, Mail, Library, Events, or Commission Management. It uses their existing foundations only where the workflow needs them.

## Scope Rules

- Every HR record is scoped by `organizationId`.
- `officeId` is optional.
- `officeId = null` means organization-wide / cross-company visibility.
- Current-office HR records use the active office id.
- There is no `companyId` and no parallel company system.

## Permissions

New permission keys:

- `hr:view`
- `hr:manage`
- `hr:templates_manage`
- `hr:offboarding_manage`

Default role behavior:

- `owner` and `office_admin`: all HR permissions
- `human_resources`: all HR permissions
- `office_manager` and `accountant`: `hr:view`
- `agent`, `office_user`, and `team_lead`: no default HR access

## Data Model

Primary models:

- `HrCandidate`
- `HrInterview`
- `HrOnboardingCase`
- `HrOnboardingDocument`
- `HrOffboardingCase`
- `HrDocumentTemplate`
- `HrIdentityChecklistMapping`
- `HrChecklistInstance`
- `HrChecklistInstanceItem`
- `OrganizationGoogleIntegration`

Checklist template intent:

- HR uses existing `ChecklistTemplate` / `ChecklistTemplateItem` as the template base.
- HR execution state lives in `HrChecklistInstance` and `HrChecklistInstanceItem`.
- HR checklist state is not forced into transaction-only `TransactionTask`.

## Recruiting And Interviews

Candidates track:

- full name
- email
- phone
- resume storage key
- status
- identity type
- Google Drive folder id
- sync state

Candidate statuses:

- `applied`
- `screening`
- `interview_1`
- `interview_2`
- `offered`
- `hired`
- `rejected`
- `withdrawn`

Interviews support:

- first and second interview records
- online / phone / onsite modes
- Google Calendar event creation
- Google Meet link generation for online interviews
- append to `HR Tracker 2026`
- offline interview email draft generation

External sync failures never block the HR workflow. Failed Google operations set `sync_failed` and can be retried.

## Google Drive / Docs / Sheets References

The implementation keeps these as configurable integration targets rather than hard-coded secrets:

- Resume folder: `1bWjLPTGFcscFTw5nQXHBnH74PqI6pqXO`
- HR Tracker 2026 sheet: `19BbELkzU9DW8XJtfm11pB5Q_Dot2pbhkzA8K0yrcj4U`
- Offer folder: `1LpyJI6-1woHBTVbHJyC3lSKtsK6fDVhw`
- Onboarding folder: `1wBZhsKIwNlhzBWQZQMoLyI9d2qn_jo_L`
- Offboarding folder: `1k80R1lZ-9IJd9gZ0CdHYtLThXmn-GG_Q`
- Onboarding form: `https://forms.gle/zALYVvygYPJWpZSn8`
- Offboarding form: `https://forms.gle/pi4AMjwgybYeH2JF9`

Offer / employment template references reviewed from the Google Doc:

- NY Sales Assistant: `1K5gc17xSooBxAKG_Utg2ASmsAPQObYmA0gMZ5UruVZY`
- NY Salesperson: `19IbGPvUW5_gfWeoYJ6t2PgaDjPl41F9i`
- Rental Sales Assistant: `1vR6BsYDgbnxcl0F39cSLQypO6JuntBYnx7bZXzQh8Og`
- Rental Salesperson: `12CWNqC4A4-TDdvY1XaTvxoHFfrAcORy_`
- NJ Sales Assistant: `1gdTdU30hk3SHIBT9tFDt8rBcrstuzczi2sP_LPe0tT4`

Known source limitation:

- The NJ Salesperson offer template link in the source document was inaccessible during implementation review and is not treated as a synced default.

NDA / onboarding / offboarding references reviewed:

- NY NDA: `1ZYdZ57rYixvqRbtd915ntFAk2Wmfusbh`
- NJ NDA: `1PitIMZC3epKdfKnSyRAs9EALfPctjlbD`
- Rentals NDA PDF: `1Q6skKUvqvXJcmXgU0j8q6pF6hP-tbV6L`
- Welcome guide PDF: `1pSbZK0bJQmYhdNpi7HrJzZNHcl1Gr7pi`
- Finance process PDF: `1oU2vTQ0sIlKnuF8SERb5IZyc0xommXA-`
- Commission after termination agreement: `19HgHdtmFaM0T4fNPtuklwXDyMcSMwjq2`
- NY termination template: `1_TAEV5vfJ-Nd0HSFt7Swu31TJDQ8UDayiusFMqBuzOY`
- Rentals termination template: `199jjsMP-jfNL1712OgwL4fGE6UxAukO7e8JTh1CCdqM`
- NJ termination template: `1f4KZJIoDuGQi9HrGUpYgvyoO0VqWx3UCmZpdltF_k8g`

## Onboarding

Onboarding cases support:

- candidate-linked case creation
- high-entropy public token issuance
- token hash storage, not plaintext token storage
- token expiry and use count
- no-login public onboarding window
- uploads for legal documents, onboarding information, and direct deposit information
- display of the external onboarding form link
- HR notification / activity logging on submission

Uploaded onboarding files reuse the shared document storage backend. This does not change `/office/library` behavior or expose onboarding uploads as Library documents.

## Signatures

HR can create non-transaction signature requests for:

- offer letter
- NDA
- employee handbook
- offboarding / termination documents

`SignatureRequest.transactionId` is nullable for HR contexts. Existing transaction signatures continue to use `transactionId`, while HR signatures use `contextType + contextId`.

Supported HR context values:

- `hr_onboarding`
- `hr_offboarding`
- `hr_offer`

Public signing token behavior is shared with the existing signing flow.

## Offboarding

Offboarding cases support:

- employee / candidate reference
- offboarding form link
- handoff checklist
- device return item
- access close item
- commission settlement handoff
- termination letter draft
- manual Salesperson license unlink item

After offboarding, access can be closed or restricted while historical HR records remain visible to authorized HR users.

## AI Drafts

AI helpers generate drafts only:

- offline interview confirmation email
- welcome email
- termination letter draft

The system does not send these drafts automatically. HR must review and send through an existing mail or email delivery flow. AI failure returns a manual-draft fallback and does not block the workflow.

## Activity Log

The HR module records activity for:

- candidate create / update / status change
- interview create / update
- Google sync success / failure / retry
- onboarding / offboarding case creation
- onboarding document upload
- checklist item complete / reopen
- HR signature request creation / send
- AI draft generation
