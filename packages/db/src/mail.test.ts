import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { MembershipStatus, NotificationType, Prisma, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import {
  archiveOfficeMailThread,
  buildAppointmentInternalMailThreadResponse,
  buildAppointmentInternalMailThreadOpenedActivityPayload,
  createOfficeMailThread,
  getOfficeMailAttachmentStorageRecord,
  getOfficeMailUnreadCount,
  getOfficeMailThreadDetail,
  getOfficeMailWorkspace,
  markOfficeMailThreadUnread,
  mapAppointmentInternalMailThreadErrorStatus,
  recordAppointmentInternalMailThreadOpenedActivity,
  replyToOfficeMailThread
} from "./mail.ts";
import { getOfficeActivityLogSnapshot } from "./activity-log.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createMailTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const trackedUserIds: string[] = [];
  const trackedOrganizationIds: string[] = [];

  async function createWorkspace(prefix: string) {
    const organization = await prisma.organization.create({
      data: {
        name: `${prefix} Mail Test ${suffix}`,
        slug: `${prefix.toLowerCase()}-mail-test-${suffix}-${randomUUID().slice(0, 4)}`
      }
    });
    trackedOrganizationIds.push(organization.id);

    const office = await prisma.office.create({
      data: {
        organizationId: organization.id,
        name: `${prefix} Office ${suffix}`,
        slug: `${prefix.toLowerCase()}-office-${suffix}-${randomUUID().slice(0, 4)}`,
        market: "New York",
        isPrimary: true
      }
    });

    return { organization, office };
  }

  async function createMembership(input: {
    workspace: Awaited<ReturnType<typeof createWorkspace>>;
    role: UserRole;
    prefix: string;
    firstName: string;
    lastName: string;
    title?: string | null;
    status?: MembershipStatus;
    isActive?: boolean;
    permissions?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  }) {
    const user = await prisma.user.create({
      data: {
        email: `${input.prefix}-${randomUUID().slice(0, 8)}@example.com`,
        firstName: input.firstName,
        lastName: input.lastName,
        timezone: "America/New_York",
        locale: "en-US",
        isActive: input.isActive ?? true
      }
    });
    trackedUserIds.push(user.id);

    const membership = await prisma.membership.create({
      data: {
        organizationId: input.workspace.organization.id,
        officeId: input.workspace.office.id,
        userId: user.id,
        role: input.role,
        status: input.status ?? MembershipStatus.active,
        title: input.title ?? null,
        permissions: input.permissions ?? Prisma.JsonNull
      }
    });

    return { user, membership };
  }

  const primary = await createWorkspace("Primary");

  return {
    primary,
    createWorkspace,
    createMembership,
    async cleanup() {
      await prisma.organization.deleteMany({
        where: {
          id: {
            in: trackedOrganizationIds
          }
        }
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds
          }
        }
      });
    }
  };
}

test("createOfficeMailThread only allows active recipients from the same organization", async () => {
  const context = await createMailTestContext();

  try {
    const sender = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "mail-sender",
      firstName: "Mia",
      lastName: "Sender",
      title: "Coordinator"
    });
    const recipient = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "mail-recipient",
      firstName: "Rita",
      lastName: "Recipient",
      title: "Processor"
    });
    const inactiveRecipient = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "mail-inactive",
      firstName: "Ivy",
      lastName: "Inactive",
      status: MembershipStatus.invited
    });
    const otherWorkspace = await context.createWorkspace("Other");
    const outsider = await context.createMembership({
      workspace: otherWorkspace,
      role: "office_user",
      prefix: "mail-outsider",
      firstName: "Oscar",
      lastName: "Outside"
    });

    await assert.rejects(
      () =>
        createOfficeMailThread({
          organizationId: context.primary.organization.id,
          membershipId: sender.membership.id,
          subject: "Invalid recipient test",
          body: "This should fail.",
          recipientMembershipIds: [inactiveRecipient.membership.id]
        }),
      /One or more recipients are no longer available\./
    );

    await assert.rejects(
      () =>
        createOfficeMailThread({
          organizationId: context.primary.organization.id,
          membershipId: sender.membership.id,
          subject: "Cross org recipient test",
          body: "This should also fail.",
          recipientMembershipIds: [outsider.membership.id]
        }),
      /One or more recipients are no longer available\./
    );

    const thread = await createOfficeMailThread({
      organizationId: context.primary.organization.id,
      membershipId: sender.membership.id,
      subject: "Valid thread",
      body: "Hello Rita",
      recipientMembershipIds: [recipient.membership.id]
    });

    assert.equal(thread.participants.length, 2);
    assert.equal(thread.subject, "Valid thread");
  } finally {
    await context.cleanup();
  }
});

test("non-participants cannot read, reply to, or access attachments from a mail thread", async () => {
  const context = await createMailTestContext();

  try {
    const sender = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "thread-sender",
      firstName: "Seth",
      lastName: "Sender"
    });
    const recipient = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "thread-recipient",
      firstName: "Riley",
      lastName: "Reader"
    });
    const outsider = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "thread-outsider",
      firstName: "Nina",
      lastName: "Outsider"
    });

    const thread = await createOfficeMailThread({
      organizationId: context.primary.organization.id,
      membershipId: sender.membership.id,
      subject: "Attachment thread",
      body: "See attached.",
      recipientMembershipIds: [recipient.membership.id],
      attachments: [
        {
          fileName: "brief.txt",
          mimeType: "text/plain",
          fileSizeBytes: 12,
          storageKey: `mail/${randomUUID()}-brief.txt`
        }
      ]
    });

    const attachment = await prisma.officeMailAttachment.findFirst({
      where: {
        message: {
          threadId: thread.id
        }
      }
    });

    assert.ok(attachment);

    const visibleToOutsider = await getOfficeMailThreadDetail({
      organizationId: context.primary.organization.id,
      membershipId: outsider.membership.id,
      threadId: thread.id
    });

    assert.equal(visibleToOutsider, null);

    await assert.rejects(
      () =>
        replyToOfficeMailThread({
          organizationId: context.primary.organization.id,
          membershipId: outsider.membership.id,
          threadId: thread.id,
          body: "I should not be able to reply."
        }),
      /Mail thread not found\./
    );

    const outsiderAttachment = await getOfficeMailAttachmentStorageRecord({
      organizationId: context.primary.organization.id,
      membershipId: outsider.membership.id,
      attachmentId: attachment!.id
    });

    assert.equal(outsiderAttachment, null);
  } finally {
    await context.cleanup();
  }
});

test("mail audit access can inspect threads and attachments without being a participant", async () => {
  const context = await createMailTestContext();

  try {
    const sender = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "audit-sender",
      firstName: "Avery",
      lastName: "Sender"
    });
    const recipient = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "audit-recipient",
      firstName: "Reese",
      lastName: "Recipient"
    });
    const admin = await context.createMembership({
      workspace: context.primary,
      role: "office_admin",
      prefix: "audit-admin",
      firstName: "Ada",
      lastName: "Admin",
      title: "Office Admin"
    });

    const thread = await createOfficeMailThread({
      organizationId: context.primary.organization.id,
      membershipId: sender.membership.id,
      subject: "Audit review",
      body: "Admin should see this only in audit mode.",
      recipientMembershipIds: [recipient.membership.id],
      attachments: [
        {
          fileName: "audit-note.txt",
          mimeType: "text/plain",
          fileSizeBytes: 8,
          storageKey: `mail/${randomUUID()}-audit-note.txt`
        }
      ]
    });

    const attachment = await prisma.officeMailAttachment.findFirst({
      where: {
        message: {
          threadId: thread.id
        }
      }
    });

    const hiddenInMineMode = await getOfficeMailThreadDetail({
      organizationId: context.primary.organization.id,
      membershipId: admin.membership.id,
      threadId: thread.id,
      mode: "mine"
    });
    const visibleInAuditMode = await getOfficeMailThreadDetail({
      organizationId: context.primary.organization.id,
      membershipId: admin.membership.id,
      threadId: thread.id,
      mode: "audit"
    });
    const auditAttachment = await getOfficeMailAttachmentStorageRecord({
      organizationId: context.primary.organization.id,
      membershipId: admin.membership.id,
      attachmentId: attachment!.id,
      mode: "audit"
    });

    assert.equal(hiddenInMineMode, null);
    assert.ok(visibleInAuditMode);
    assert.equal(visibleInAuditMode?.auditedByAdmin, true);
    assert.equal(visibleInAuditMode?.messages.length, 1);
    assert.equal(auditAttachment?.id, attachment?.id);
  } finally {
    await context.cleanup();
  }
});

test("appointment internal mail thread response keeps the continuity contract explicit", () => {
  const response = buildAppointmentInternalMailThreadResponse({
    threadId: "thread_123",
    subject: "Please confirm: 123 Main St",
    actionUrl: "/agent/calendar?appointmentId=apt_123",
    actionLabel: "Open appointment",
  });

  assert.deepEqual(response.thread, {
    id: "thread_123",
    subject: "Please confirm: 123 Main St",
  });
  assert.equal(response.threadHref, "/office/mail?threadId=thread_123");
  assert.equal(response.actionLabel, "Internal mail thread");
  assert.equal(
    response.actionTargetLabel,
    "Open appointment",
  );
  assert.equal(
    response.actionTargetUrl,
    "/agent/calendar?appointmentId=apt_123",
  );
  assert.match(
    response.manualOnlyDetail,
    /external send still stays manual and no provider sync is implied\./,
  );
  assert.match(
    response.continuity.detail,
    /continuity stays inside Acre/,
  );
  assert.equal(response.continuity.returnToLabel, "Return to update form");
  assert.equal(
    response.continuity.returnToUrl,
    "/agent/calendar?appointmentId=apt_123",
  );
  assert.match(
    response.continuity.sourceNote,
    /outside email remains manual and no provider sync is implied\./,
  );
});

test("appointment internal mail thread response drops unsafe action deep links while keeping the thread continuity contract intact", () => {
  const response = buildAppointmentInternalMailThreadResponse({
    threadId: "thread_456",
    subject: "Please confirm: 456 Main St",
    actionUrl: "https://example.com/agent/calendar?appointmentId=apt_456",
    actionLabel: "Open appointment",
  });

  assert.equal(response.actionTargetLabel, "Open appointment");
  assert.equal(response.actionTargetUrl, null);
  assert.equal(response.continuity.returnToUrl, null);
  assert.equal(response.threadHref, "/office/mail?threadId=thread_456");
});

test("appointment internal mail thread opened activity payload and record helper keep the continuity contract explicit", async () => {
  const context = await createMailTestContext();

  try {
    const sender = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "activity-sender",
      firstName: "Anya",
      lastName: "Writer",
    });

    const payload = buildAppointmentInternalMailThreadOpenedActivityPayload({
      officeId: context.primary.office.id,
      organizationId: context.primary.organization.id,
      membershipId: sender.membership.id,
      appointment: {
        id: "apt_123",
        title: "Buyer Check-In",
        startsAtLabel: "April 9, 2026 at 10:00 AM",
        endsAtLabel: "April 9, 2026 at 10:30 AM",
        clientLabel: "Ava Client",
        clientEmailLabel: "ava@example.com",
        contactLabel: "Ava Client <ava@example.com>",
        listingLabel: "12 Main St",
        locationLabel: "Living room",
        coordinationLabel: "Prepare internal continuity brief",
        coordinationNextStep: "Review and save the next checkpoint",
        externalStatusLabel: "Confirmed",
        externalNote: "Bring listing docs",
      },
      thread: {
        id: "thread_123",
        subject: "Confirmed: Buyer Check-In on April 9, 2026 at 10:00 AM",
      },
      contextHref: "/agent/calendar?appointmentId=apt_123",
    });

    assert.deepEqual(payload, {
      officeId: context.primary.office.id,
      objectLabel: "Buyer Check-In",
      contextHref: "/agent/calendar?appointmentId=apt_123",
      details: [
        "Mode: Manual-only",
        "Provider sync: None",
        "Thread: Internal mail continuity",
        "Thread subject: Confirmed: Buyer Check-In on April 9, 2026 at 10:00 AM",
        "Thread href: /office/mail?threadId=thread_123",
        "Appointment: Buyer Check-In",
        "Starts: April 9, 2026 at 10:00 AM",
        "Ends: April 9, 2026 at 10:30 AM",
        "Client: Ava Client",
        "Email target: ava@example.com",
        "Contact: Ava Client <ava@example.com>",
        "Listing: 12 Main St",
        "Location: Living room",
        "External coordination: Confirmed",
        "External note: Bring listing docs",
        "Acre coordination: Prepare internal continuity brief",
        "Next move: Review and save the next checkpoint",
        "Return to: Open appointment",
        "Return href: /agent/calendar?appointmentId=apt_123",
      ],
    });

    await recordAppointmentInternalMailThreadOpenedActivity(prisma, {
      officeId: context.primary.office.id,
      organizationId: context.primary.organization.id,
      membershipId: sender.membership.id,
      appointment: {
        id: "apt_123",
        title: "Buyer Check-In",
        startsAtLabel: "April 9, 2026 at 10:00 AM",
        endsAtLabel: "April 9, 2026 at 10:30 AM",
        clientLabel: "Ava Client",
        clientEmailLabel: "ava@example.com",
        contactLabel: "Ava Client <ava@example.com>",
        listingLabel: "12 Main St",
        locationLabel: "Living room",
        coordinationLabel: "Prepare internal continuity brief",
        coordinationNextStep: "Review and save the next checkpoint",
        externalStatusLabel: "Confirmed",
        externalNote: "Bring listing docs",
      },
      thread: {
        id: "thread_123",
        subject: "Confirmed: Buyer Check-In on April 9, 2026 at 10:00 AM",
      },
      contextHref: "/agent/calendar?appointmentId=apt_123",
    });

    const snapshot = await getOfficeActivityLogSnapshot({
      organizationId: context.primary.organization.id,
      officeId: context.primary.office.id,
      limit: 10,
      activitySection: "contacts",
    });

    assert.equal(snapshot.activityEvents[0]?.action, "appointment.internal_mail_thread_opened");
    assert.equal(snapshot.activityEvents[0]?.actionLabel, "Appointment internal mail thread opened");
    assert.equal(snapshot.activityEvents[0]?.objectLabel, "Buyer Check-In");
    assert.equal(snapshot.activityEvents[0]?.href, "/agent/calendar?appointmentId=apt_123");
    assert.deepEqual(snapshot.activityEvents[0]?.detailSummary, [
      "Mode: Manual-only",
      "Provider sync: None",
      "Thread: Internal mail continuity",
      "Thread subject: Confirmed: Buyer Check-In on April 9, 2026 at 10:00 AM",
      "Thread href: /office/mail?threadId=thread_123",
      "Appointment: Buyer Check-In",
      "Starts: April 9, 2026 at 10:00 AM",
      "Ends: April 9, 2026 at 10:30 AM",
      "Client: Ava Client",
      "Email target: ava@example.com",
      "Contact: Ava Client <ava@example.com>",
      "Listing: 12 Main St",
      "Location: Living room",
      "External coordination: Confirmed",
      "External note: Bring listing docs",
      "Acre coordination: Prepare internal continuity brief",
      "Next move: Review and save the next checkpoint",
      "Return to: Open appointment",
      "Return href: /agent/calendar?appointmentId=apt_123",
    ]);
  } finally {
    await context.cleanup();
  }
});

test("appointment internal mail thread error mapping keeps manual-only and permission failures on the guarded contract", () => {
  const noRecipients = mapAppointmentInternalMailThreadErrorStatus(
    "No internal mail recipients are available for this appointment brief.",
  );
  const missingEmailTarget = mapAppointmentInternalMailThreadErrorStatus(
    "An email target is required before opening the appointment mail thread.",
  );
  const notScheduled = mapAppointmentInternalMailThreadErrorStatus(
    "Only scheduled appointments can open the internal mail brief.",
  );
  const noAccess = mapAppointmentInternalMailThreadErrorStatus(
    "Mail access required.",
  );
  const noSendAccess = mapAppointmentInternalMailThreadErrorStatus(
    "Mail send access required.",
  );
  const generic = mapAppointmentInternalMailThreadErrorStatus("Unexpected.");

  assert.equal(noRecipients.status, 409);
  assert.equal(missingEmailTarget.status, 409);
  assert.equal(notScheduled.status, 409);
  assert.equal(noAccess.status, 403);
  assert.equal(noSendAccess.status, 403);
  assert.equal(generic.status, 400);
  assert.equal(generic.hint, null);
  assert.match(noRecipients.hint ?? "", /external email brief/);
  assert.match(noAccess.hint ?? "", /external email brief/);
});

test("workspace reads sync notification state and replies restore archived threads without duplicating notifications", async () => {
  const context = await createMailTestContext();

  try {
    const sender = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "sync-sender",
      firstName: "Sam",
      lastName: "Sender"
    });
    const recipient = await context.createMembership({
      workspace: context.primary,
      role: "office_user",
      prefix: "sync-recipient",
      firstName: "Rae",
      lastName: "Recipient"
    });

    const thread = await createOfficeMailThread({
      organizationId: context.primary.organization.id,
      membershipId: sender.membership.id,
      subject: "State sync thread",
      body: "Initial message.",
      recipientMembershipIds: [recipient.membership.id]
    });

    let notifications = await prisma.notification.findMany({
      where: {
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id,
        type: NotificationType.internal_message_received,
        entityId: thread.id
      }
    });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.readAt, null);
    assert.equal(
      await getOfficeMailUnreadCount({
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id
      }),
      1
    );

    const workspace = await getOfficeMailWorkspace({
      organizationId: context.primary.organization.id,
      membershipId: recipient.membership.id,
      threadId: thread.id
    });

    assert.equal(workspace.selectedThread?.isUnread, false);

    notifications = await prisma.notification.findMany({
      where: {
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id,
        type: NotificationType.internal_message_received,
        entityId: thread.id
      }
    });

    assert.equal(notifications.length, 1);
    assert.ok(notifications[0]?.readAt);
    assert.equal(
      await getOfficeMailUnreadCount({
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id
      }),
      0
    );

    const markUnreadResult = await markOfficeMailThreadUnread({
      organizationId: context.primary.organization.id,
      membershipId: recipient.membership.id,
      threadId: thread.id
    });

    assert.equal(markUnreadResult, true);

    notifications = await prisma.notification.findMany({
      where: {
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id,
        type: NotificationType.internal_message_received,
        entityId: thread.id
      }
    });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.readAt, null);
    assert.equal(
      await getOfficeMailUnreadCount({
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id
      }),
      1
    );

    const archiveResult = await archiveOfficeMailThread({
      organizationId: context.primary.organization.id,
      membershipId: recipient.membership.id,
      threadId: thread.id
    });

    assert.equal(archiveResult, true);

    let archivedParticipant = await prisma.officeMailParticipant.findFirst({
      where: {
        threadId: thread.id,
        membershipId: recipient.membership.id
      }
    });

    assert.ok(archivedParticipant?.archivedAt);
    assert.equal(
      await getOfficeMailUnreadCount({
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id
      }),
      0
    );

    const repliedThread = await replyToOfficeMailThread({
      organizationId: context.primary.organization.id,
      membershipId: sender.membership.id,
      threadId: thread.id,
      body: "Second message after archive."
    });

    assert.equal(repliedThread.participants.length, 2);
    assert.equal(repliedThread.messages.length, 2);

    archivedParticipant = await prisma.officeMailParticipant.findFirst({
      where: {
        threadId: thread.id,
        membershipId: recipient.membership.id
      }
    });

    assert.equal(archivedParticipant?.archivedAt, null);

    notifications = await prisma.notification.findMany({
      where: {
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id,
        type: NotificationType.internal_message_received,
        entityId: thread.id
      }
    });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.readAt, null);
    assert.match(notifications[0]?.body ?? "", /Second message after archive\./);
    assert.equal(
      await getOfficeMailUnreadCount({
        organizationId: context.primary.organization.id,
        membershipId: recipient.membership.id
      }),
      1
    );
  } finally {
    await context.cleanup();
  }
});
