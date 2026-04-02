import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { MembershipStatus, NotificationType, Prisma, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import {
  archiveOfficeMailThread,
  createOfficeMailThread,
  getOfficeMailAttachmentStorageRecord,
  getOfficeMailUnreadCount,
  getOfficeMailThreadDetail,
  getOfficeMailWorkspace,
  markOfficeMailThreadUnread,
  replyToOfficeMailThread
} from "./mail.ts";

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
