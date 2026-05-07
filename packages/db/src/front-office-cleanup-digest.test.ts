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
  buildFrontOfficeCleanupDigestInternalMailThreadOpenedActivityPayload,
  buildFrontOfficeCleanupDigestRunnerContract,
  buildFrontOfficeCleanupDigestRunActivityPayload,
  buildFrontOfficeCleanupDigestRunSummary,
  renderFrontOfficeCleanupDigestDeliveryDraft,
  renderFrontOfficeCleanupDigestDryRunOutput,
  renderFrontOfficeCleanupDigestReport,
  renderFrontOfficeCleanupDigestSection,
  renderFrontOfficeCleanupDigestWorkflow,
  renderFrontOfficeCleanupDigestRunnerContract,
  recordFrontOfficeCleanupDigestInternalMailThreadOpenedActivity,
  recordFrontOfficeCleanupDigestRunActivity,
} from "./front-office-cleanup-digest.ts";
import {
  activityLogActions,
  getOfficeActivityLogSnapshot,
} from "./activity-log.ts";

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
            actionLabel: "Open notice",
            actionDetail:
              "Open the unread signal and return to the digest pass.",
            destinationLabel: "Unread notice",
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
            href: "/agent/clients/client-1",
            actionLabel: "Open follow-up",
            actionDetail:
              "Open the client record and keep the next reminder clock current.",
            destinationLabel: "Client follow-up",
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
            href: "/agent/clients/client-1",
            actionLabel: "Open client reminder",
            actionDetail:
              "Open the lightweight client page and update the reminder.",
            destinationLabel: "Client reminder",
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
            href:
              "/agent/calendar?calendarView=writeback_pending&appointmentId=appointment-1&clientId=client-1#calendar-writeback-section",
            actionLabel: "Open writeback",
            actionDetail:
              "Open the calendar writeback section and save the next checkpoint.",
            destinationLabel: "Calendar writeback",
            dueAtLabel: "Apr 10, 2026, 11:00 AM",
            tone: "warning",
          },
        ],
      },
    ],
    workflow: {
      label: "Manual cleanup pass",
      detail:
        "Run the digest, then work the listed passes in order. Acre records the manual run, but it does not schedule, auto-send, or provider-sync anything.",
      runMode: "manual_operator_pass",
      schedulerState: "runner_contract_ready",
      providerSyncState: "none",
      primaryStepKey: "follow_up_tasks",
      steps: [
        {
          key: "follow_up_tasks",
          label: "Follow-up pass",
          detail: "Work due follow-up first.",
          href: "/agent/notifications?activityView=personal_cleanup&cleanupFilter=follow_up",
          actionLabel: "Open follow-up pass",
          count: 1,
          tone: "danger",
          mode: "manual",
        },
        {
          key: "appointment_writeback",
          label: "Appointment writeback pass",
          detail: "Reconcile external calendar, email, or call results.",
          href:
            "/agent/calendar?calendarView=writeback_pending&appointmentId=appointment-1&clientId=client-1#calendar-writeback-section",
          actionLabel: "Open writeback pass",
          count: 1,
          tone: "warning",
          mode: "manual",
        },
      ],
    },
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
  assert.match(notificationLines.join("\n"), /Action: Open notice/);

  const workflowLines = renderFrontOfficeCleanupDigestWorkflow(digest.workflow);
  assert.equal(workflowLines[0], "Manual cleanup pass");
  assert.match(workflowLines.join("\n"), /Open writeback pass/);

  const report = renderFrontOfficeCleanupDigestReport(digest);
  assert.match(report, /^Office cleanup digest$/m);
  assert.match(report, /^Generated: Apr 9, 2026, 11:00 AM$/m);
  assert.match(report, /^Summary: 4 item\(s\), 2 urgent, 2 due soon$/m);
  assert.match(report, /^Next action: Start with follow-up tasks$/m);
  assert.match(report, /^Manual cleanup pass$/m);
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

  const runnerContract = buildFrontOfficeCleanupDigestRunnerContract(
    digest,
    "dry-run",
  );
  assert.equal(runnerContract.runMode, "manual-only");
  assert.equal(runnerContract.outputMode, "dry-run");
  assert.equal(runnerContract.schedulerState, "not-involved");
  assert.equal(runnerContract.deliveryMode, "draft-only");
  assert.equal(runnerContract.sideEffectPolicy, "none");
  assert.equal(runnerContract.scopeLabel, "Office cleanup digest");

  const runnerContractLines = renderFrontOfficeCleanupDigestRunnerContract(
    runnerContract,
  );
  assert.equal(runnerContractLines[0], "Runner contract");
  assert.deepEqual(runnerContractLines.slice(1, 5), [
    "Run mode: manual-only",
    "Output mode: dry-run",
    "Scheduler: not-involved",
    "Delivery mode: draft-only",
  ]);

  const dryRunOutput = renderFrontOfficeCleanupDigestDryRunOutput(digest);
  assert.match(dryRunOutput, /^Runner contract$/m);
  assert.match(dryRunOutput, /^Report$/m);
  assert.match(dryRunOutput, /^Office cleanup digest$/m);
});

test("cleanup digest activity payload builders keep manual-only semantics explicit", () => {
  const runSummary = {
    scopeLabel: "Office cleanup digest",
    generatedAtLabel: "Apr 9, 2026, 11:00 AM",
    timeZone: "America/New_York",
    windowLabel: "Next 7 days",
    totalCount: 4,
    urgentCount: 2,
    dueSoonCount: 2,
    notificationCount: 1,
    followUpTaskCount: 1,
    clientReminderCount: 1,
    appointmentCount: 1,
    nextActionLabel: "Start with follow-up tasks",
    nextActionDetail: "Follow-up cleanup needs a quick owner check.",
  } satisfies ReturnType<typeof buildFrontOfficeCleanupDigestRunSummary>;

  const runPayload = buildFrontOfficeCleanupDigestRunActivityPayload({
    officeId: "office-1",
    runSummary,
  });
  const threadPayload =
    buildFrontOfficeCleanupDigestInternalMailThreadOpenedActivityPayload({
      officeId: "office-1",
      objectLabel: "Cleanup digest continuity thread",
      contextHref: "/office/mail?threadId=thread-1",
      runSummary,
    });

  assert.equal(runPayload.officeId, "office-1");
  assert.equal(runPayload.objectLabel, "Office cleanup digest");
  assert.equal(runPayload.contextHref, undefined);
  assert.deepEqual(runPayload.details?.slice(0, 3), [
    "Mode: Manual-only",
    "Scheduler: Not involved",
    "Provider sync: None",
  ]);
  assert.match(
    runPayload.details?.join("\n") ?? "",
    /Summary: 4 item\(s\), 2 urgent, 2 due soon/,
  );

  assert.equal(threadPayload.officeId, "office-1");
  assert.equal(threadPayload.objectLabel, "Cleanup digest continuity thread");
  assert.equal(threadPayload.contextHref, "/office/mail?threadId=thread-1");
  assert.deepEqual(threadPayload.details?.slice(0, 4), [
    "Mode: Manual-only",
    "Scheduler: Not involved",
    "Provider sync: None",
    "Scope: Office cleanup digest",
  ]);
  assert.match(
    threadPayload.details?.join("\n") ?? "",
    /Thread: Internal mail continuity/,
  );
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
      assert.match(renderedSection.join("\n"), /Calendar writeback/);
      assert.match(
        renderedSection.join("\n"),
        /\/agent\/calendar\?calendarView=writeback_pending/,
      );

      const report = renderFrontOfficeCleanupDigestReport(digest);
      assert.match(report, /^Office cleanup digest$/m);
      assert.match(report, /^Generated: /m);
      assert.match(report, /^Summary: 4 item\(s\), 2 urgent, 2 due soon$/m);
      assert.match(report, /^Next action: Start with follow-up tasks$/m);
      assert.equal(digest.workflow.primaryStepKey, "follow_up_tasks");
      assert.ok(
        digest.workflow.steps.some(
          (step) => step.key === "appointment_writeback",
        ),
      );

      await recordFrontOfficeCleanupDigestRunActivity(prisma, {
        organizationId: context.organization.id,
        membershipId: context.membership.id,
        officeId: context.office.id,
        runSummary,
        contextHref: "/agent/notifications",
      });

      await recordFrontOfficeCleanupDigestInternalMailThreadOpenedActivity(
        prisma,
        {
          organizationId: context.organization.id,
          membershipId: context.membership.id,
          officeId: context.office.id,
          runSummary,
          threadId: "cleanup-digest-thread-1",
          threadSubject: "Cleanup digest continuity thread",
          contextHref: "/office/mail?threadId=cleanup-digest-thread-1",
        },
      );

      const activitySnapshot = await getOfficeActivityLogSnapshot({
        organizationId: context.organization.id,
        officeId: context.office.id,
        objectType: "task",
        activitySection: "tasks-checklists",
        limit: 10,
      });

      assert.equal(activitySnapshot.filters.objectType, "task");
      assert.equal(activitySnapshot.activitySelectedSection, "tasks-checklists");
      assert.ok(
        activitySnapshot.activityEvents.some(
          (event) =>
            event.action === activityLogActions.frontOfficeCleanupDigestRun &&
            event.actionLabel === "Cleanup digest run" &&
            event.summary === "ran the cleanup digest manually" &&
            event.objectType === "task" &&
            event.href === "/agent/notifications",
        ),
      );
      assert.ok(
        activitySnapshot.activityEvents.some(
          (event) =>
            event.action ===
              activityLogActions.frontOfficeCleanupDigestThreadOpened &&
            event.actionLabel === "Cleanup digest thread opened" &&
            event.summary ===
              "opened the cleanup digest internal mail thread" &&
            event.objectType === "task" &&
            event.href === "/office/mail?threadId=cleanup-digest-thread-1",
        ),
      );
    } finally {
      await context.cleanup();
    }
  },
);
