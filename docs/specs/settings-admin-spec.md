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
  - Back Office tier catalog:
    - `owner`
    - `office_admin`
    - `accountant`
    - `human_resources`
    - `team_lead`
    - `agent`
- teams admin supports:
  - create
  - rename
  - activate/deactivate
  - delete empty teams with no remaining commission-plan assignments
  - add/remove members
  - assign `Leader I / Leader II / Member`
  - maintain direct reporting lines inside a team
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
- shared table layout admin now supports:
  - organization-wide saved column widths across current Back Office tables
  - `owner / office_admin`-only column resizing
  - saved widths applied to all users in the same organization, not only the admin who dragged them

## Current gaps

- no generic no-code schema builder across every workflow module yet
- transaction intake builder exists, but broader settings modules still do not expose the same level of schema configurability
- office access is still bounded by current membership model plus explicit team hierarchy / scope resolution, not a full ACL matrix
- checklist templates are managed but not fully auto-applied everywhere

## Future direction

- stronger office/user access controls
- richer template application behavior
- broader settings coverage for future workflow modules
