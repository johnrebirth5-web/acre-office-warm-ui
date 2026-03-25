# Settings / Admin Spec

## Goal

Provide a practical Back Office admin/settings area for access management, role templates, teams, field requirements, and checklist templates.

## Current implemented foundation

- routes exist:
  - `/office/settings`
  - `/office/settings/roles`
  - `/office/settings/users`
  - `/office/settings/teams`
  - `/office/settings/teams/[teamId]`
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
  - `accountant / human_resources` can manage lifecycle for standard Back Office accounts, but cannot assign or manage `owner / office_admin`
  - team assignment / removal from the unified user detail page when the admin has `teams:manage`, including users who have not yet joined their first branch
  - only `agent / team_lead` accounts can participate in `Team / Junior Team` hierarchy; non-sales roles must stay out of team assignment and branch-owner flows
  - users with any active `Team / Junior Team` assignment cannot be switched to a non-hierarchy role from `Settings > Users` until those assignments are removed in `Settings > Teams`
  - users who still own an active `Team / Junior Team` cannot be downgraded to the `agent` permission template from `Settings > Users` until that leadership is transferred or removed in `Settings > Teams`
  - only `owner / office_admin` can edit per-user permission overrides with `inherit / allow / deny`
  - only `owner / office_admin` can reset user overrides back to role defaults
  - Back Office tier catalog:
    - `owner`
    - `office_admin`
    - `accountant`
    - `human_resources`
    - `team_lead`
    - `agent`
- teams admin supports:
  - create `Team / Junior Team` with a required owner at creation time
  - rename
  - activate/deactivate
  - delete empty teams with no remaining commission-plan assignments
  - add/remove members
  - assign `Team Leader / Junior Team Leader / Member`
  - `Teams` directory visibility follows `teams:view` directly and must not be narrowed by `agents:view:*` or `transactions:view:*` scope math
  - maintain `Team / Junior Team` structure in the current two-level admin product flow while keeping the underlying recursive data model available for future expansion
  - maintain direct reporting lines inside a team
  - show inherited parent-branch managers for branch leaders instead of leaving the direct-manager field visually blank
  - surface invalid root/child branch leader-role mismatches so admins can correct legacy team data intentionally
  - keep branch-owner summaries scoped to the team's valid owner role only, instead of mixing in invalid legacy leader assignments
  - show explicit `Team / Junior Team / Team Leader / Junior Team Leader / Unassigned` state so legacy mismatches are distinguishable from valid hierarchy ownership
  - prevent current owners from being removed or demoted without transferring ownership first, so teams no longer become leaderless through normal admin flows
  - auto-materialize a missing Junior Team for legacy `Junior Team Leader` assignments that were left inside the parent Team, using a leader-named Team record instead of leaving the leader stranded without a group
  - legacy Junior Team materialization is now limited to explicit management writes or one-off backfills; simply opening `Users` / `Teams` roster views must stay side-effect free
  - default `Teams` landing view is now a top-level Team directory; Junior Team/member structure is reviewed from each Team detail page instead of mixing every level into one long admin canvas
- fields admin supports:
  - `Settings > Fields` as the single field-structure admin entry
  - module rail for `transaction / contact / offer`
  - per-module built-in field `label / required / visible / sort order`
  - per-module custom field create / edit / delete for `text / select / date`
  - custom field create / edit includes a `Protected from deletion` toggle so linked fields can be hidden without being hard-deleted
  - transaction `Agent Name` remains protected from deletion because it is tied to owner assignment behavior
  - hidden-field restore workflow from the same page
  - transaction-only `Type / Status / Representing` dropdown option enable/disable plus display-label editing
  - transaction-only required contact roles admin in the same `Fields` page
  - one shared schema source consumed by transaction create/detail, contact create/detail, and offer create/edit
  - transaction create flows now embed the same full field editor inside `Edit fields`, so admins can rename built-in labels, manage custom fields, and adjust transaction-required contact roles without leaving `Create transaction`
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
