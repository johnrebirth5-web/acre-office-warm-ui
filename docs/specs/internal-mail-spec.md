# Internal Mail Spec

## Purpose

`Office Mail` provides an organization-internal mailbox for Back Office members. It is not backed by external SMTP identities and does not send to real-world email recipients. Users open `/office/mail` inside Back Office to read and send messages.

## Scope

### Included in v1

- same-organization `active` Back Office memberships only
- fixed-participant threads
- multi-message conversation history
- attachments with download-only behavior
- per-participant read / unread state
- per-participant archive / unarchive state
- `mail:audit` organization audit view
- notification bridge into `/office/notifications`

### Explicitly not included in v1

- external recipients
- free-text email addresses
- CC / BCC
- drafts
- forward / recall
- delete / recover
- message editing
- adding or removing participants after thread creation
- attachment preview workflow

## Data model

- `OfficeMailThread`
  - org-scoped thread header
  - stores `subject`, `createdByMembershipId`, `latestMessageAt`, and optional `actionUrl / actionLabel` for deep-linkable system alerts
- `OfficeMailParticipant`
  - access-control source of truth
  - stores private participant state: `lastReadAt`, `archivedAt`
- `OfficeMailMessage`
  - stores sender, body, and created timestamp
- `OfficeMailAttachment`
  - stores attachment metadata and `storageKey`
- `MembershipNotificationPreference.messageAlertsEnabled`
  - controls whether `internal_message_received` reminders are written for that membership

## Permissions

- `mail:view`
  - required to open `/office/mail` and call mail read APIs
- `mail:send`
  - required to create threads and send replies
- `mail:audit`
  - required to enter `Audit view`
  - does not grant reply ability in audit mode

Default behavior:

- `mail:view` and `mail:send` are granted to current Back Office login roles
- `mail:audit` is available by default to `owner` and `office_admin`

## API surface

- `GET /api/office/mail/recipients`
  - returns selectable internal recipients
- `POST /api/office/mail/threads`
  - creates a thread and first message
- `GET /api/office/mail/threads/[threadId]`
  - returns thread detail in `mine` or `audit` mode
- `PATCH /api/office/mail/threads/[threadId]`
  - supports `mark_read`, `mark_unread`, `archive`, `unarchive`
- `POST /api/office/mail/threads/[threadId]/messages`
  - appends a reply to the thread
- `GET /api/office/mail/attachments/[attachmentId]/file`
  - downloads an attachment if the caller is a participant or has `mail:audit`
- `GET /api/office/mail/unread-count`
  - returns the current participant's active unread-thread count for sidebar badge refresh

## Behavioral rules

### Recipients

- recipients must belong to the same organization
- recipients must be `active`
- recipients must be Back Office memberships
- sender is automatically added as a participant

### Messages

- `subject` is required on thread creation
- `body` or at least one attachment is required for every message
- replies always keep the original participant set
- system-generated threads may include an optional thread-level CTA via `actionUrl / actionLabel`

### System-generated alerts

- when an `agent` creates a new `Transaction`, the system creates a mail thread addressed to all active `owner` and `office_admin` memberships in the same organization
- the sending membership recorded on the first message is the creating agent, so the alert remains attributable in audit history
- the thread carries:
  - a subject describing the new transaction
  - a body with agent name, creation timestamp, transaction label, status, and owner
  - a `View transaction` CTA pointing at `/office/transactions/[transactionId]`
- admin-created transactions do not generate this automatic mail alert

### Read / archive state

- opening a thread in `mine` mode marks it read for the current participant
- `archive` is private to the participant who archives it
- a new reply clears `archivedAt` for other participants and makes the thread unread again

### Attachments

- stored under the existing document storage root using `organization/mail/thread/message`
- single attachment limit: `10 MB`
- total attachments per message limit: `25 MB`
- v1 supports download only

## Notifications

- every new message writes `NotificationType.internal_message_received` for other participants
- notification rows are upserted by `(membershipId, threadId)` so a thread only keeps one active reminder per recipient
- opening the thread marks the matching notification as read
- marking a thread unread also marks the matching notification unread

## Audit and activity log

- `Audit view` lives inside `/office/mail`; it is not mixed into personal mailbox state
- `Activity Log` records metadata only:
  - thread created
  - message sent
  - thread archived
  - thread unarchived
- message bodies are intentionally excluded from `Activity Log`

## UI contract

- left column:
  - search
  - inbox / unread / archived filter
  - thread list
  - compose panel
- right column:
  - thread header
  - optional CTA button when the selected thread includes `actionUrl`
  - participant strip
  - ordered message timeline
  - reply composer in `mine` mode
- `My mail / Audit view` switch is only visible to `mail:audit`
- Office sidebar shows `Mail +N` when the current mailbox has unread active threads
