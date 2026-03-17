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
- the login form now uses standard browser autofill/password-manager semantics (`username` + `current-password`) so Chrome / Google password save prompts can appear normally
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
- open a dedicated detail page for each membership
- create invited users from a modal / drawer flow
- copy the generated invite link without leaving the page

`/office/settings/users/[membershipId]` now supports:

- review core account identity, office access, team context, and sign-in timestamps
- update role
- update membership status
- update office access
- issue or reissue invite/setup/reset link
- revoke active invite link
- unlock locked account
- review onboarding summary
- review a compact permission summary and open the dedicated permission editor
- review commission summary
- review recent audit/activity items tied to the user account

`/office/settings/users/[membershipId]/permissions` now supports:

- review the full effective permission tree on a dedicated full-page editor
- edit per-user permission overrides with a BoldTrail-style two-column checkbox layout
- save per-user permission overrides against the current role template
- reset user overrides back to role defaults

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
