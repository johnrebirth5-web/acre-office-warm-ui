# Admin Office Spec

## Purpose

Admin Office is a new Back Office module for office administration workflows that are not the AI Admin Assistant.

Routes:

- `/office/admin-office`
- `/office/admin-office/email-requests`
- `/office/admin-office/calendar`
- `/office/admin-office/signups`

This module is separate from `/office/admin-assistant`, which remains the AI assistant entry.

Admin Office does not replace the existing Event / Calendar / RSVP foundation. It reuses `Event` and `EventRsvp` with small schema extensions for company-visible signup workflows.

## Scope Rules

- Every Admin Office record is scoped by `organizationId`.
- `officeId = null` means organization-wide / company-wide / all-staff visibility.
- Current-office records use the active office id.
- No `companyId` is introduced.

## Permissions

New permission keys:

- `admin_office:view`
- `admin_office:manage`

Default role behavior:

- `owner` and `office_admin`: view and manage
- `human_resources`: view and manage
- `office_manager` and `accountant`: view only
- `agent`, `office_user`, and `team_lead`: no default Admin Office access

## Company Email Requests

`AdminEmailRequest` supports:

- full name
- preferred email prefix
- status
- admin reviewer
- notes

Statuses:

- `pending`
- `approved`
- `completed`
- `rejected`

Approval / completion / rejection actions write activity log entries.

## Calendar

Admin Office calendar uses the existing `Event` model.

Supported event types include:

- activity
- meeting
- training
- broker tour
- other

Event extensions:

- signup required
- signup close time
- capacity
- CSV export metadata

Existing `/agent/calendar`, `/api/agent/events`, and `EventRsvp` RSVP behavior remain compatible. Admin Office adds Back Office management views without introducing a second calendar system.

## Signups

Admin-created events can require signups.

Members can be registered with existing `EventRsvp` rows. Admins can:

- see the signup list
- cancel signup entries
- export CSV

CSV export records metadata in `AuditLog`; it does not copy sensitive bodies into the activity stream.

## Activity Log

The Admin Office module records activity for:

- email request creation
- email request approval / completion / rejection
- event creation / update
- signup / cancel signup
- CSV export metadata
