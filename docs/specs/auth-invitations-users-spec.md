# Auth / Invitations / Users Spec

## Goal

Replace the old seeded-email sign-in with a minimal real internal account system while keeping the current signed cookie session model.

This spec describes what is implemented now, not the eventual full auth platform.

## Implemented now

### Account model

- `Membership.status` still owns lifecycle:
  - `invited`
  - `active`
  - `disabled`
- for admin-operated Back Office workflows, `invited` sales memberships are still operationally usable:
  - `invited` means the user has not completed their own password/login setup yet
  - it does **not** mean the agent should disappear from admin assignment, transaction creation, commission, or payout-statement workflows
  - for `agent` and other sales-side operational identities, admins should treat `invited` the same as `active` unless the action specifically requires that user to sign in personally
- `UserCredential` now owns auth state:
  - password hash
  - must-change-password flag
  - failed login count
  - locked-until timestamp
  - last login / failed login / password change timestamps
- `Invitation` now owns onboarding / password-setup links:
  - raw tokens are never stored
  - database stores `tokenHash` only
  - invite links expire after 7 days

### Roles

- `owner` and `office_admin` are the full Back Office admin tier
- `accountant` and `human_resources` are organization-wide operational roles with user lifecycle / reporting access
- `team_lead` is the scoped manager role; effective visibility depends on team hierarchy
- `agent` is the self-scoped production role
- `office_manager` and `office_user` stay compatible internally where needed, but are legacy-only create choices
- assigning `Team Leader` or `Junior Team Leader` in `Settings > Teams` now auto-upgrades an `agent` account to `team_lead` so branch ownership and manager visibility stay aligned
- only `agent / team_lead` accounts can be assigned inside `Team / Junior Team` hierarchy; `owner / office_admin / accountant / human_resources` must stay outside team assignment and branch-owner flows
- runtime authorization no longer reads only `membership.role`
- each fixed role now has an organization-scoped role template
- each membership can also carry explicit permission overrides:
  - `allow`
  - `deny`
- effective permissions resolve as:
  - role template permissions
  - plus membership `allow`
  - minus membership `deny`
- Users page only exposes:
  - `Owner`
  - `Office Admin`
  - `Accountant`
  - `Human Resources`
  - `Team Lead`
  - `Agent`
- `users:manage` allows lifecycle management for standard Back Office accounts, but it does not allow:
  - assigning `owner / office_admin`
  - managing existing `owner / office_admin` accounts
  - editing per-user permission overrides
- assigning admin-tier roles and editing user permission overrides require `settings:manage` and are restricted to current `owner / office_admin`

### Bootstrap admin

- The system ensures a bootstrap admin account exists for:
  - `office@acreny.us`
- The bootstrap admin is an `office_admin`
- Existing bootstrap account provisioning can be reused for a fresh setup/reset link instead of creating a duplicate account
- The bootstrap password is stored only as a hash
- First successful login requires a password change
- Existing bootstrap credentials are not destructively overwritten if they already exist

### Login / session flow

- `/login` now requires:
  - email
  - password
- Successful login still creates the same signed `acre_local_session` cookie
- the session cookie is persistent for `30` days
- Generic invalid-credential messaging is used
- Accounts lock for 1 hour after 5 failed password attempts
- Successful login clears lock state and failed-attempt count
- the login form keeps the email/password fields visually empty on first render and after failed round-trips, while still restoring standard password-manager semantics after the user manually focuses the inputs
- browser autofill should be resisted on localhost where practical; stale saved accounts must not silently overwrite the email the operator just typed
- `/change-password` handles:
  - forced first login password change
  - optional self-service change for signed-in users

### Invitation flow

- Admin creates invited user from `/office/settings/users`
- System creates:
  - `User`
  - `Membership(status=invited)`
  - `Invitation`
- Because email delivery is not implemented, the UI returns a copyable invite link
- `/invite/[token]` validates the token, collects password, accepts the invite, activates the membership, and signs the normal session cookie
- The same invitation model is also reused for setup/reset links on existing accounts

### Users admin page

Current routes:

- `/office/settings/roles`
- `/office/settings/users`
- `/office/settings/users/[membershipId]`
- `/office/settings/users/[membershipId]/permissions`

`/office/settings/users` now supports:

- search / filter the internal account roster
- default the roster to the current top-level company scope instead of showing the full organization by default
- only show memberships whose company access includes the current company; to manage a company-only account for another company, admins must switch the top-level `Company` selector first
- switch between `access` and `operations` views inside the same route
- keep `operations` aligned to current-company access as well: if a membership can access the current company, it stays visible in `operations` even when its home office differs
- open a dedicated detail page for each membership
- create invited users from a modal / drawer flow
- assign company access from a visible checkbox list while keeping one default company selected
- copy the generated invite link without leaving the page

`/office/settings/users/[membershipId]` now supports:

- review core account identity, office access, team context, and sign-in timestamps
- update first name and last name for the target Back Office user
- return `404` when the target membership does not belong to the current top-level company scope
- review and edit operational profile, team assignments, onboarding, goals, and workload context without leaving the user detail route
- update role
- update membership status
- update office access
- block role changes that would leave an active `Team / Junior Team` assignment on a non-hierarchy account
- issue or reissue invite/setup/reset link
- revoke active invite link
- unlock locked account
- review onboarding summary
- review a compact permission summary and open the dedicated permission editor
- review commission summary
- review recent audit/activity items tied to the user account
- user update / invite / unlock / permission-override actions now enforce the same current-company scope as the list and detail routes

`/office/settings/teams` now supports:

- company-wide `teams:view` visibility without piggybacking on transaction visibility scope
- team detail routes that keep valid team records reachable even when the viewer's `agents:view:*` scope is narrower than `teams:view`

`/office/settings/users/[membershipId]/permissions` now supports:

- review the full effective permission tree on a dedicated full-page editor
- `owner / office_admin` can edit per-user permission overrides with a BoldTrail-style two-column checkbox layout
- `owner / office_admin` can save per-user permission overrides against the current role template
- `owner / office_admin` can reset user overrides back to role defaults

`/office/settings/roles` now supports:

- review every fixed Back Office role template for the current organization
- enable/disable permissions on the role template itself
- save template changes so all members on that role inherit the updated baseline unless they have explicit user overrides

### Audit / activity log

The auth layer now records at least:

- bootstrap admin created
- user invited
- invite accepted
- login succeeded
- login failed
- account locked
- account unlocked
- password changed
- password setup link issued
- role changed
- role template updated
- user permission overrides changed
- user permission overrides reset
- account activated / deactivated

## Current limitations

These are intentionally still out of scope:

- forgot password
- email delivery
- 2FA / 2SV
- OAuth / SSO
- session store redesign
- organization-defined custom role creation

## Local verification checklist

1. Open `/login`
2. Sign in with the bootstrap admin and complete forced password change
3. Open `/office/settings/users`
4. Create an invited `User`
5. Copy the generated invite link and complete `/invite/[token]`
6. Sign out
7. Sign back in with the invited user using email + password
8. Trigger 5 failed logins and confirm lockout
9. Unlock from `/office/settings/users`

## Follow-up work

- add forgot-password once email infrastructure exists
- add email delivery for invite/setup links
- add optional 2FA
- decide whether to keep signed-cookie-only session storage or move to a fuller session layer
