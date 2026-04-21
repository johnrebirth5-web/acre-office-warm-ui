# Library Spec

## Purpose

`/office/library` is the internal `Company Library / Internal Document Library` for the Back Office workspace.

This module is not a vendor marketplace and not a public document portal.

Primary use cases:

- company files
- manuals
- tutorials
- onboarding packets
- legal PDFs
- financial references
- templates / playbooks

## Current MVP Scope

The current MVP is a real Prisma-backed document workspace with:

- folder tree on the left
- file list in the center
- preview / details pane on the right
- `Add folder` primary action
- `Upload file` action
- inline PDF-first preview
- open / download / rename / move / delete flows
- search and lightweight filtering
- activity log coverage for major actions

Seeded dev environments now start with an empty library by default.

- no sample folders are inserted
- no sample files are uploaded
- real content appears only after office users create folders or upload files

Route remains:

- `/office/library`

## Data Model

### LibraryFolder

Current model:

- `organizationId`
- `officeId`
  - `null` means company-wide
  - current office id means office-only
- `parentFolderId`
- `name`
- `description`
- `sortOrder`
- `isActive`
- `createdByMembershipId`
- `createdAt`
- `updatedAt`

Notes:

- nesting is intentionally light
- deletion is not exposed in the MVP UI
- rename is supported

### LibraryDocument

Current model:

- `organizationId`
- `officeId`
- `folderId`
- `uploadedByMembershipId`
- `title`
- `originalFileName`
- `mimeType`
- `fileSizeBytes`
- `storageKey`
- `pageCount`
- `summary`
- `tags`
- `category`
- `visibility`
  - `company_wide`
  - `office_only`
- `sortOrder`
- `createdAt`
- `updatedAt`

Notes:

- PDF is the primary previewed type
- non-PDF files are still stored and downloadable
- `visibility` is kept consistent with `officeId`

## Scope Rules

Current access is explicit and intentionally simple:

- company-wide documents use `officeId = null`
- office-only documents use `officeId = currentOfficeId`
- current session can read:
  - company-wide documents
  - current office documents
- current session cannot target other offices

This follows the current real `Membership.officeId` boundary and does not fake a larger multi-office ACL matrix.

## Permissions

Current explicit permissions in `@acre/auth`:

- `library:view`
- `library:manage`

Current role mapping:

- `office_manager`
  - view + manage
- `office_admin`
  - view + manage
- `agent`
  - no office library access

## Storage Strategy

Current file storage is still local filesystem MVP.

Library files reuse the shared storage foundation under `ACRE_DOCUMENTS_STORAGE_DIR` and are stored under organization-scoped library directories.

Current reality:

- real uploaded files are stored
- preview and download read back from the stored file
- object storage is not implemented yet

## Preview Behavior

Current preview behavior:

- PDF: inline preview in the right-hand pane
- non-PDF: metadata + open/download only

Current limitation:

- uploaded PDF page counts are not yet extracted through a stable parser
- `pageCount` is shown only when the value is already known

## Activity Log Coverage

Current library events recorded into `AuditLog`:

- folder created
- folder renamed / updated
- file uploaded
- file renamed / updated
- file moved between folders
- file deleted
- file opened from the explicit open route

Payload style remains structured:

- `objectLabel`
- `details`
- `changes`
- `contextHref`

## API Surface

Current API routes:

- `/api/office/library/folders`
- `/api/office/library/folders/:folderId`
- `/api/office/library/documents`
- `/api/office/library/documents/:documentId`
- `/api/office/library/documents/:documentId/file`

## Known Limitations

- folder delete / archive workflow is not exposed yet
- page count extraction is not automatic for uploads
- no OCR
- no full-text file indexing
- no object storage
- no public sharing portal
- no vendor marketplace workflow in this module

## Future Follow-up

- add safer folder archive / deactivate flow
- add PDF metadata extraction and stable page indexing
- add stronger bulk operations only if real office usage requires them
- replace local filesystem storage with object storage when deployment model is ready
