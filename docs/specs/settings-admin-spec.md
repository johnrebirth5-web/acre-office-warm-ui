# Settings / Admin Spec

## Goal

Provide a practical Back Office admin/settings area for access management, role templates, teams, field requirements, and checklist templates.

## Current implemented foundation

- routes exist:
  - `/office/settings`
  - `/office/settings/roles`
  - `/office/settings/users`
  - `/office/settings/teams`
  - `/office/settings/fields`
  - `/office/settings/checklists`
- roles admin supports:
  - fixed Back Office role catalog
  - organization-level role templates
  - enable/disable permissions per role template
  - template changes that immediately alter inherited permissions for all members on that role
- users admin supports:
  - role update
  - activate/deactivate
  - office access within current membership model
  - team assignment / removal from the unified user detail page when the admin has `teams:manage`, including users who have not yet joined their first branch
  - per-user permission override editing with `inherit / allow / deny`
  - reset user overrides back to role defaults
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
  - assign `Team Leader / Junior Team Leader / Member`
  - maintain parent / child branch structure
  - maintain direct reporting lines inside a team
  - show inherited parent-branch managers for branch leaders instead of leaving the direct-manager field visually blank
  - surface invalid root/child branch leader-role mismatches so admins can correct legacy team data intentionally
- fields admin supports:
  - `Settings > Fields` as the single field-structure admin entry
  - module rail for `transaction / contact / offer`
  - per-module built-in field `required / visible / sort order`
  - per-module custom field create / edit / delete for `text / select / date`
  - custom field create / edit includes a `Protected from deletion` toggle so linked fields can be hidden without being hard-deleted
  - transaction `Agent Name` remains protected from deletion because it is tied to owner assignment behavior
  - hidden-field restore workflow from the same page
  - transaction-only `Type / Status / Representing` dropdown option enable/disable plus display-label editing
  - transaction-only required contact roles admin in the same `Fields` page
  - one shared schema source consumed by transaction create/detail, contact create/detail, and offer create/edit
  - `office_admin`-only schema editing and audit coverage for field-structure changes
- checklist template admin supports:
  - create/edit
  - activate/deactivate
  - task rows
- shared table layout admin now supports:
  - organization-wide saved column widths across current Back Office tables
  - `owner / office_admin`-only column resizing
  - saved widths applied to all users in the same organization, not only the admin who dragged them

## Current gaps

- the first centralized field platform only covers `transaction / contact / offer`, not every future workflow module
- role catalog is still fixed; admins cannot create brand-new custom roles
- some business actions already have permission keys, but the underlying module action surface is still catching up in places
- checklist templates are managed but not fully auto-applied everywhere

## Future direction

- stronger office/user access controls on top of the new role-template + user-override baseline
- richer template application behavior
- broader centralized field coverage for future workflow modules
