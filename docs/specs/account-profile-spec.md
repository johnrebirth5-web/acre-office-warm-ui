# Account / My Profile Spec

## Goal

Provide a real Back Office self-service account page for the signed-in user.

This page is intentionally separate from:

- `Office Admin / Settings`
- `Agent Management`
- any future full identity-provider work

## Route and scope

- route:
  - `/office/account`
- access model:
  - requires a valid office session
  - always scopes reads and writes to the current signed-in membership
  - does not allow editing another user's account from this route

## Page sections

Current MVP sections:

- `Profile`
  - editable safe self-service fields
  - current email shown read-only
- `Office / Team`
  - office, role, title, membership status, license expiration date, onboarding status
  - current team memberships shown read-only
- `Notifications`
  - explicit in-app inbox preference toggles
  - honest channel status for unsupported delivery methods
- `Security`
  - current auth method
  - password management status
  - 2-step verification status
  - session model summary
- `My Summary`
  - open tasks
  - review queue
  - open transactions
  - recent notifications

## Current editable profile fields

The current MVP allows editing:

- `User.firstName`
- `User.lastName`
- `User.phone`
- `User.timezone`
- `User.locale`
- `AgentProfile.displayName`
- `AgentProfile.bio`
- `AgentProfile.avatarUrl`
- `AgentOfficeProfile.licenseNumber`
- `AgentOfficeProfile.licenseState`
- `AgentOfficeProfile.internalExtension`

When a member has access to multiple companies, the page reads and writes
company-specific licensing / extension fields from the current office context's
`AgentOfficeProfile` row instead of sharing those values across every office.

The page intentionally does not allow editing:

- email
- role
- office assignment
- team membership
- membership status
- onboarding status
- admin-only notes / commission plan data

## Notification preference model

The page persists notification preferences with an explicit membership-scoped model:

- `MembershipNotificationPreference`

Current preference fields:

- `inAppEnabled`
- `approvalAlertsEnabled`
- `taskRemindersEnabled`
- `offerAlertsEnabled`

Current behavior:

- preferences only affect real in-app inbox record creation
- supported delivery remains in-product inbox only
- email / SMS / push are shown as unavailable, not as fake toggles

## Security behavior

Current security section is intentionally truthful:

- current auth method is internal email + password
- password may be in a set / setup required / change required / temporarily locked state
- there is no forgot-password flow
- there is no 2-step verification flow
- session is still an HTTP-only cookie with a 12-hour max age

The page includes real actions only where the system actually supports them today, such as change-password, sign-out, and auth activity visibility.

## My Summary behavior

Current summary values reuse real persisted workflow data:

- open transaction tasks assigned to the current membership
- open follow-up tasks assigned to the current membership
- current actionable Approve Docs queue count
- current open transactions owned by the membership
- recent and unread persisted notifications

This is intentionally lightweight and not a second dashboard.

## Activity integration

The account page writes auditable events for:

- account profile updated
- notification preferences updated

These events:

- write into `AuditLog`
- include structured `changes`
- link back to `/office/account`

## Current limitations

- no in-app password reset
- no email delivery for setup/reset links
- no 2-step verification enrollment or challenge flow
- no email / SMS / push delivery
- notification preferences are deliberately coarse and limited to currently real inbox families
- account page is self-service only; it is not an admin user-management surface
