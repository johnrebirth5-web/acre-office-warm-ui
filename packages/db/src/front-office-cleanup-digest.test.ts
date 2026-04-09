import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  PrismaClient,
  TaskStatus,
} from "/Users/openclaw_john/工作文件夹/Acre_latest_clean/node_modules/@prisma/client/index.js";
import { buildFrontOfficeCleanupDigest } from "./front-office-cleanup-digest.ts";

const prisma = new PrismaClient();

after(async () => {
  await prisma.$disconnect();
});

async function createFrontOfficeCleanupDigestTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Cleanup Digest Test ${suffix}`,
      slug: `cleanup-digest-test-${suffix}`,
    },
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Cleanup Digest Office ${suffix}`,
      slug: `cleanup-digest-office-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `cleanup-digest-agent-${suffix}@example.com`,
      firstName: "Cleanup",
      lastName: "Agent",
      phone: "2125550144",
      timezone: "America/New_York",
      locale: "en-US",
      isActive: true,
    },
  });

  const membership = await prisma.membership.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      userId: user.id,
      role: "office_admin",
      status: "active",
      title: "Front Office Admin",
      permissions: {},
    },
  });

  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      ownerMembershipId: membership.id,
      fullName: `Cleanup Client ${suffix}`,
      email: `cleanup-client-${suffix}@example.com`,
      phone: "6465550188",
      source: "Regression test",
      stage: "Warm Lead",
      intent: "Buyer",
      preferredAreas: ["Park Slope"],
      nextFollowUpAt: new Date("2026-04-10T15:00:00.000Z"),
      leaseReminderAt: new Date("2026-04-11T15:00:00.000Z"),
      additionalFields: {},
    },
  });

  const followUpTask = await prisma.followUpTask.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      assigneeMemberId: membership.id,
      title: `Follow-up cleanup ${suffix}`,
      status: TaskStatus.queued,
      dueAt: new Date("2026-04-08T15:00:00.000Z"),
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      ownerMembershipId: membership.id,
      clientId: client.id,
      type: "showing",
      status: "scheduled",
      title: `Bridge cleanup ${suffix}`,
      startsAt: new Date("2026-04-10T15:00:00.000Z"),
      location: "Brooklyn",
      meetingUrl: "https://example.com/meeting",
      notes: "Cleanup digest regression coverage.",
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      membershipId: membership.id,
      entityType: "appointment",
      entityId: appointment.id,
      action: "appointment.bridge_opened",
      createdAt: new Date("2026-04-09T14:15:00.000Z"),
      payload: {
        action: "ics_download",
        note: "Bridge opened for cleanup digest coverage.",
      },
    },
  });

  await prisma.notification.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      membershipId: membership.id,
      type: NotificationType.follow_up_overdue,
      category: NotificationCategory.follow_up,
      severity: NotificationSeverity.warning,
      entityType: NotificationEntityType.follow_up_task,
      entityId: followUpTask.id,
      followUpTaskId: followUpTask.id,
      title: `Follow-up overdue: ${client.fullName}`,
      body: `${followUpTask.title} needs cleanup before the next touch.`,
      actionUrl: `/office/contacts/${client.id}`,
    },
  });

  return {
    organization,
    office,
    membership,
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id,
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: user.id,
        },
      });
    },
  };
}

test("cleanup digest aggregates unread cleanup signals into a reusable summary", async () => {
  const context = await createFrontOfficeCleanupDigestTestContext();

  try {
    const digest = await buildFrontOfficeCleanupDigest({
      organizationId: context.organization.id,
      viewerMembershipId: context.membership.id,
      officeId: context.office.id,
      timeZone: "America/New_York",
      now: new Date("2026-04-09T15:00:00.000Z"),
    });

    assert.equal(digest.scopeLabel, "Office cleanup digest");
    assert.equal(digest.windowLabel, "Next 7 days");
    assert.equal(digest.summary.notificationCount, 1);
    assert.equal(digest.summary.followUpTaskCount, 1);
    assert.equal(digest.summary.clientReminderCount, 1);
    assert.equal(digest.summary.appointmentCount, 1);
    assert.equal(digest.summary.totalCount, 4);
    assert.equal(digest.nextActionLabel, "Start with follow-up tasks");
    assert.match(digest.nextActionDetail, /Follow-up cleanup/);

    const notificationSection = digest.sections.find(
      (section) => section.key === "notifications",
    );
    const taskSection = digest.sections.find(
      (section) => section.key === "follow_up_tasks",
    );
    const reminderSection = digest.sections.find(
      (section) => section.key === "client_reminders",
    );
    const appointmentSection = digest.sections.find(
      (section) => section.key === "appointment_continuity",
    );

    assert.ok(notificationSection);
    assert.ok(taskSection);
    assert.ok(reminderSection);
    assert.ok(appointmentSection);
    assert.equal(notificationSection?.items[0]?.kind, "notification");
    assert.match(notificationSection?.items[0]?.title ?? "", /Follow-up overdue/);
    assert.equal(taskSection?.items[0]?.kind, "follow_up_task");
    assert.match(taskSection?.items[0]?.detail ?? "", /Cleanup Client/);
    assert.equal(reminderSection?.items[0]?.kind, "client_reminder");
    assert.match(reminderSection?.items[0]?.detail ?? "", /Next follow-up/);
    assert.match(reminderSection?.items[0]?.detail ?? "", /Lease reminder/);
    assert.equal(appointmentSection?.items[0]?.kind, "appointment_continuity");
    assert.match(
      appointmentSection?.items[0]?.detail ?? "",
      /Bridge opened:/,
    );
    assert.match(
      appointmentSection?.items[0]?.detail ?? "",
      /No saved writeback yet/,
    );
  } finally {
    await context.cleanup();
  }
});
