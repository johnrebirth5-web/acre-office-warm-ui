# Settings / Admin Spec

## Goal

Provide a practical Back Office admin/settings area for access management, teams, field requirements, and checklist templates.

## Current implemented foundation

- routes exist:
  - `/office/settings`
  - `/office/settings/users`
  - `/office/settings/teams`
  - `/office/settings/fields`
  - `/office/settings/checklists`
- users admin supports:
  - role update
  - activate/deactivate
  - office access within current membership model
- teams admin supports:
  - create
  - rename
  - activate/deactivate
  - add/remove members
- fields admin supports:
  - required contact roles
  - built-in transaction field required / visible settings
  - built-in `Type / Status / Representing` dropdown option enable/disable plus display-label editing
  - office-scoped custom transaction intake fields (`text / select / date`)
  - one shared intake schema across transaction create modal, `/office/transactions/new`, and transaction detail intake editing
  - `office_admin`-only schema editing and audit coverage for schema/value changes
- checklist template admin supports:
  - create/edit
  - activate/deactivate
  - task rows

## Current gaps

- no generic no-code schema builder across every workflow module yet
- transaction intake builder exists, but broader settings modules still do not expose the same level of schema configurability
- office access is still bounded by current membership model, not a full ACL matrix
- checklist templates are managed but not fully auto-applied everywhere

## Future direction

- stronger office/user access controls
- richer template application behavior
- broader settings coverage for future workflow modules
