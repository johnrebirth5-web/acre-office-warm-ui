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

- `office_admin` remains the full internal admin role
- `office_user` is the new normal internal user role
- `office_manager` stays compatible internally where needed, but is not exposed as a normal create-user choice
- Users page only exposes:
  - `Admin`
  - `User`

### Bootstrap admin

- The system ensures a bootstrap admin account exists for:
  - `office@acreny.us`
- The bootstrap admin is an `office_admin`
- The bootstrap password is stored only as a hash
- First successful login requires a password change
- Existing bootstrap credentials are not destructively overwritten if they already exist

### Login / session flow

- `/login` now requires:
  - email
  - password
- Successful login still creates the same signed `acre_local_session` cookie
- Generic invalid-credential messaging is used
- Accounts lock for 1 hour after 5 failed password attempts
- Successful login clears lock state and failed-attempt count
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

`/office/settings/users` now supports:

- create invited user
- choose role (`Admin` / `User`)
- see membership status
- see password/setup status
- see lock status
- issue or reissue invite/setup/reset link
- revoke active invite link
- activate / disable where appropriate
- unlock locked account

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
- account activated / deactivated

## Current limitations

These are intentionally still out of scope:

- forgot password
- email delivery
- 2FA / 2SV
- OAuth / SSO
- session store redesign

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
