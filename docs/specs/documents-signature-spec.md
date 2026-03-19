# Documents / Forms / eSignature Spec

## Goal

Provide a real transaction-centered document workflow with structured documents, unsorted docs, internal forms, internal eSignature states, and incoming update review.

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
- forms support:
  - internal template-based creation
  - deterministic merge from transaction data
  - generated document linkage
- signature requests support internal statuses:
  - draft
  - sent
  - viewed
  - signed
  - declined
  - canceled
- document / form / signature changes re-evaluate linked task approval state and can reopen invalidated approvals when required files disappear, submitted review evidence is no longer valid, or signatures are no longer complete
- linked document deletion/unlink now explicitly reopens affected approval tasks with a `missing required document`-style workflow reason when that is the real blocker
- incoming updates support review states:
  - pending_review
  - accepted
  - rejected
  - applied

## Current gaps

- file storage is local filesystem MVP
- no external eSignature vendor integration
- no PDF parsing/generation engine beyond current internal payload flow
- no live Folio/external sync
- no email ingestion workflow

## Future direction

- replace storage with object storage
- improve template management
- add future integration adapters without redesigning current models
