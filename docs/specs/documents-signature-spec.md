# Documents / Forms / eSignature Spec

## Goal

Provide a real transaction-centered document workflow with structured documents, unsorted docs, internal forms, transaction-scoped external eSignature for PDF documents, and incoming update review.

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
- transaction document signature requests now support:
  - draft preparation inside transaction detail
  - draggable signature field placement on PDF page previews
  - signer setup with recipient name/email, email subject/body, optional expiry, and sender display/reply-to metadata
  - secure public signing links delivered through real SMTP email
  - no-login public signing page with fixed field overlays
  - signature capture by draw / typed signature / uploaded signature image
  - signed PDF generation and archive back into transaction documents
  - signature audit timeline alongside internal `Activity Log`
- signature requests now support statuses:
  - draft
  - sent
  - viewed
  - signed
  - completed
  - declined
  - canceled
  - expired
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
  - transaction detail only
  - single signer only
  - PDF documents only
  - synchronous request-time email send and PDF finalization
- there is still no third-party eSignature vendor integration
- no live Folio/external sync
- no email ingestion workflow
- no queue/worker-backed retry pipeline for email delivery or PDF finalization
- no OTP / extra signer identity verification beyond high-entropy link token + expiry + terminal-state invalidation

## Future direction

- replace storage with object storage
- improve template management
- add queue-backed retries / webhooks if the deployment model grows beyond synchronous request-time work
- add future integration adapters without redesigning current models
