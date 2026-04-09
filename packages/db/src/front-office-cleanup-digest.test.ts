import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
} from "@prisma/client";
import { prisma } from "./client.ts";
import {
  buildFrontOfficeCleanupDigestDeliveryDraft,
  buildFrontOfficeCleanupDigest,
  buildFrontOfficeCleanupDigestRunSummary,
  renderFrontOfficeCleanupDigestDeliveryDraft,
  renderFrontOfficeCleanupDigestReport,
  renderFrontOfficeCleanupDigestSection,
} from "./front-office-cleanup-digest.ts";

after(async () => {
  await prisma.$disconnect();
});

const digestIntegrationTest = process.env.DATABASE_URL?.trim()
  ? test
  : test.skip;

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
      status: "queued",
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
      type: "follow_up_overdue",
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

test("cleanup digest render helpers produce stable operator-facing output", () => {
  const digest = {
    generatedAt: "2026-04-09T15:00:00.000Z",
    generatedAtLabel: "Apr 9, 2026, 11:00 AM",
    scopeLabel: "Office cleanup digest",
    timeZone: "America/New_York",
    windowLabel: "Next 7 days",
    cutoffAt: "2026-04-16T15:00:00.000Z",
    summary: {
      totalCount: 4,
      urgentCount: 2,
      dueSoonCount: 2,
      notificationCount: 1,
      followUpTaskCount: 1,
      clientReminderCount: 1,
      appointmentCount: 1,
    },
    nextActionLabel: "Start with follow-up tasks",
    nextActionDetail: "Follow-up cleanup needs a quick owner check.",
    sections: [
      {
        key: "notifications",
        label: "Unread notifications",
        summary: "1 Notification needs attention.",
        count: 1,
        items: [
          {
            id: "notification-1",
            kind: "notification",
            title: "Follow-up overdue",
            detail: "Follow-up cleanup before the next touch.",
            href: "/office/notifications/notification-1/open",
            dueAtLabel: "Apr 8, 2026, 10:30 AM",
            tone: "danger",
          },
        ],
      },
      {
        key: "follow_up_tasks",
        label: "Follow-up tasks",
        summary: "1 Follow-up task needs attention.",
        count: 1,
        items: [
          {
            id: "task-1",
            kind: "follow_up_task",
            title: "Follow-up cleanup",
            detail: "Client: Cleanup Client · Status: queued",
            href: "/office/contacts/client-1",
            dueAtLabel: "Apr 8, 2026, 11:00 AM",
            tone: "danger",
          },
        ],
      },
      {
        key: "client_reminders",
        label: "Client reminders",
        summary: "1 Client reminder needs attention.",
        count: 1,
        items: [
          {
            id: "client-1",
            kind: "client_reminder",
            title: "Cleanup Client",
            detail:
              "Next follow-up: Apr 10, 2026, 11:00 AM · Lease reminder: Apr 11, 2026, 11:00 AM",
            href: "/office/contacts/client-1",
            dueAtLabel: "Apr 10, 2026, 11:00 AM",
            tone: "warning",
          },
        ],
      },
      {
        key: "appointment_continuity",
        label: "Appointment continuity",
        summary: "1 Appointment continuity item needs attention.",
        count: 1,
        items: [
          {
            id: "appointment-1",
            kind: "appointment_continuity",
            title: "Bridge cleanup",
            detail:
              "Bridge opened: Apr 9, 2026, 10:15 AM · No saved writeback yet",
            href: "/agent/clients/client-1",
            dueAtLabel: "Apr 10, 2026, 11:00 AM",
            tone: "warning",
          },
        ],
      },
    ],
  } satisfies Parameters<typeof renderFrontOfficeCleanupDigestReport>[0];

  const deliveryDraft = buildFrontOfficeCleanupDigestDeliveryDraft(digest);
  assert.equal(
    deliveryDraft.subject,
    "Office cleanup digest: 4 item(s), 2 urgent, 2 due soon",
  );
  assert.equal(
    deliveryDraft.summaryText,
    "Office cleanup digest · Next 7 days · 4 item(s), 2 urgent, 2 due soon",
  );
  assert.equal(deliveryDraft.runSummary.totalCount, 4);
  assert.match(deliveryDraft.body, /^Office cleanup digest$/m);

  const runSummary = buildFrontOfficeCleanupDigestRunSummary(digest);
  assert.equal(runSummary.scopeLabel, "Office cleanup digest");
  assert.equal(runSummary.totalCount, 4);
  assert.equal(runSummary.nextActionLabel, "Start with follow-up tasks");

  const notificationLines = renderFrontOfficeCleanupDigestSection(
    digest.sections[0],
  );
  assert.equal(notificationLines[0], "Unread notifications (1)");
  assert.match(notificationLines.join("\n"), /Follow-up overdue/);

  const report = renderFrontOfficeCleanupDigestReport(digest);
  assert.match(report, /^Office cleanup digest$/m);
  assert.match(report, /^Generated: Apr 9, 2026, 11:00 AM$/m);
  assert.match(report, /^Summary: 4 item\(s\), 2 urgent, 2 due soon$/m);
  assert.match(report, /^Next action: Start with follow-up tasks$/m);
  assert.match(report, /No saved writeback yet/);

  const renderedDraft = renderFrontOfficeCleanupDigestDeliveryDraft(
    deliveryDraft,
  );
  assert.match(
    renderedDraft,
    /^Subject: Office cleanup digest: 4 item\(s\), 2 urgent, 2 due soon$/m,
  );
  assert.match(
    renderedDraft,
    /^Summary: Office cleanup digest · Next 7 days · 4 item\(s\), 2 urgent, 2 due soon$/m,
  );
  assert.match(renderedDraft, /^Next action: Start with follow-up tasks$/m);
});

digestIntegrationTest(
  "cleanup digest aggregates unread cleanup signals into a reusable summary",
  async () => {
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
      assert.match(
        notificationSection?.items[0]?.title ?? "",
        /Follow-up overdue/,
      );
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

      const runSummary = buildFrontOfficeCleanupDigestRunSummary(digest);
      assert.equal(runSummary.scopeLabel, digest.scopeLabel);
      assert.equal(runSummary.totalCount, digest.summary.totalCount);
      assert.equal(runSummary.nextActionLabel, digest.nextActionLabel);

      const deliveryDraft = buildFrontOfficeCleanupDigestDeliveryDraft(digest);
      assert.equal(
        deliveryDraft.subject,
        "Office cleanup digest: 4 item(s), 2 urgent, 2 due soon",
      );
      assert.match(deliveryDraft.body, /Follow-up cleanup/);

      if (!appointmentSection) {
        throw new Error("Expected appointment continuity section");
      }

      const renderedSection = renderFrontOfficeCleanupDigestSection(
        appointmentSection,
      );
      assert.equal(renderedSection[0], "Appointment continuity (1)");
      assert.match(
        renderedSection[1] ?? "",
        /1 Appointment continuity item needs attention\./,
      );
      assert.match(renderedSection.join("\n"), /Link: \/agent\/clients\//);

      const report = renderFrontOfficeCleanupDigestReport(digest);
      assert.match(report, /^Office cleanup digest$/m);
      assert.match(report, /^Generated: /m);
      assert.match(report, /^Summary: 4 item\(s\), 2 urgent, 2 due soon$/m);
      assert.match(report, /^Next action: Start with follow-up tasks$/m);
    } finally {
      await context.cleanup();
    }
  },
);
