# Documents / Forms / eSignature Spec

## Goal

Provide a real document workflow with structured documents, unsorted docs, internal forms, a platform-level eSignature center, and incoming update review.

## Current implemented foundation

- transaction detail has:
  - Documents
  - Unsorted documents
  - Forms & eSignature
- incoming updates review foundation remains implemented in the data/API layer, but it is not currently surfaced on the default transaction detail page
- `/office/approve-docs` now reads the same task-linked document review workflow for manager/reviewer processing
- documents support:
  - upload
  - open/download
  - delete
  - task linkage
  - unsorted-to-structured movement
- document-based external signature requests only allow PDF source files; non-PDF transaction documents stay uploadable/manageable but cannot enter the external signing flow
- forms support:
  - internal template-based creation
  - deterministic merge from transaction data
  - generated document linkage
- platform eSignature now supports:
  - `/office/signatures` unified center for request tracking, recipient-level status visibility, Drive sync visibility, and CSV export
  - `/office/signatures/templates` template library for reusable recipient / field blueprints and default mail copy
  - `Settings > Signature Drive` organization-level Google Drive service-account configuration and folder mapping
  - transaction detail editor as the first-phase request authoring surface
  - a two-step transaction authoring flow: save `Recipients and delivery` first, then enter the PDF field-placement step
  - draggable and resizable field placement on PDF page previews
  - one or more signers, approvers, and CC recipients
  - serial, parallel, and mixed routing via `routingStep`
  - per-field recipient ownership via `assignedRecipientId`, so recipients can only act on their own fields
  - secure recipient-token public signing links delivered through real email transport, preferring Resend HTTPS API and falling back to SMTP when needed
  - admin-managed sender / reply-to defaults plus SMTP fallback under `Settings > Email delivery`, with environment-variable fallback when no in-app config exists yet
  - no-login public signing page with fixed field overlays, prefilled values, and signer-specific locking
  - signature capture by draw / typed signature / uploaded signature image
  - signed PDF generation and archive back into transaction documents
  - completion email delivery to every signature participant plus the configured reply-to inbox, including the finalized signed PDF as an attachment
  - immediate Google Drive sync attempt for original + signed copy, with visible failure state and manual retry
  - signature audit timeline alongside internal `Activity Log`
- non-transaction signature contexts now support module-owned signing flows:
  - `SignatureRequest.transactionId` is nullable
  - existing transaction signing continues to use `transactionId`
  - HR signing requests use `contextType + contextId`
  - supported HR context values are `hr_onboarding`, `hr_offboarding`, and `hr_offer`
  - public signing tokens reuse the existing no-login signing path
- signature requests now support statuses:
  - draft
  - pending_send
  - sent
  - viewed
  - signed
  - completed
  - declined
  - voided
  - expired
- legacy `canceled` rows remain readable for backward compatibility
- public signing UI intentionally does not expose `decline`; the status remains for backward-compatible historical/internal flows
- document / form / signature changes re-evaluate linked task approval state and can reopen invalidated approvals when required files disappear, submitted review evidence is no longer valid, or signatures are no longer complete
- linked document deletion/unlink now explicitly reopens affected approval tasks with a `missing required document`-style workflow reason when that is the real blocker
- completed external signatures keep:
  - original document
  - signed output document
  - signer identity snapshot
  - signed/completed timestamps
  - audit entries for request create/send/view/submit/finalize/cancel/expire
- incoming updates support review states:
  - pending_review
  - accepted
  - rejected
  - applied

## Current gaps

- file storage is local filesystem MVP
- external signing currently supports:
  - transaction-first authoring for the transaction detail workspace
  - module-owned non-transaction authoring for HR contexts
  - PDF documents only
  - synchronous request-time email send, PDF finalization, and Drive sync
  - Step 1 can save a request before any fields exist, but send still requires at least one PDF field and clear signer assignment for multi-recipient requests
- there is still no third-party eSignature vendor integration
- no live Folio/external sync
- no email ingestion workflow
- no queue/worker-backed retry pipeline for email delivery, PDF finalization, or Drive sync
- no OTP / extra signer identity verification beyond high-entropy link token + expiry + terminal-state invalidation
- there is not yet a broad standalone create-anything signature wizard outside module-specific entry points

## Future direction

- replace storage with object storage
- add a broader generic create flow outside transaction detail and module-specific HR entry points
- improve template management
- add queue-backed retries / webhooks if the deployment model grows beyond synchronous request-time work
- add future integration adapters without redesigning current models
