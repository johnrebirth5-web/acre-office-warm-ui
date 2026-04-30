import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeSendChannel,
  Prisma,
  ResourceType,
  TaskStatus,
} from "@prisma/client";
import { activityLogActions } from "./activity-log.ts";
import { prisma } from "./client.ts";
import { getFrontOfficeDashboardSnapshot } from "./front-office-dashboard.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createFrontOfficeDashboardTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `FO Dashboard Test ${suffix}`,
      slug: `fo-dashboard-test-${suffix}`,
    },
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `FO Dashboard Office ${suffix}`,
      slug: `fo-dashboard-office-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  });

  const trackedUserIds: string[] = [];

  async function createMembership(
    role: "office_admin" | "agent",
    prefix: string,
  ) {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}@example.com`,
        firstName: prefix,
        lastName: "User",
        timezone: "America/New_York",
        locale: "en-US",
        isActive: true,
      },
    });
    trackedUserIds.push(user.id);

    const membership = await prisma.membership.create({
      data: {
        organizationId: organization.id,
        officeId: office.id,
        userId: user.id,
        role,
        status: "active",
        title: role === "office_admin" ? "Office Admin" : "Agent",
        permissions: Prisma.JsonNull,
      },
    });

    return membership;
  }

  const adminMembership = await createMembership(
    "office_admin",
    "dashboard-admin",
  );
  const agentMembership = await createMembership("agent", "dashboard-agent");

  const resource = await prisma.resource.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      type: ResourceType.playbook,
      title: `Dashboard Playbook ${suffix}`,
      slug: `dashboard-playbook-${suffix}`,
      summary: "A front office resource used for dashboard pulse tests.",
      url: "https://example.com/playbooks/dashboard",
      tags: ["script", "tour"],
      isPublished: true,
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      category: "staging",
      name: `Dashboard Vendor ${suffix}`,
      headline: "Shared vendor for dashboard tests",
      phone: "2125550137",
      email: `dashboard-vendor-${suffix}@example.com`,
      website: "https://example.com/dashboard-vendor",
      neighborhoods: ["Brooklyn"],
      notes: "Shared dashboard vendor coverage.",
      isFeatured: true,
    },
  });

  return {
    organization,
    office,
    adminMembership,
    agentMembership,
    resource,
    vendor,
    async recordInteraction(input: {
      membershipId: string;
      action: string;
      objectLabel: string;
      contextHref: string;
      details: string[];
      createdAt?: Date;
    }) {
      return prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          membershipId: input.membershipId,
          entityType: "resource",
          entityId: randomUUID(),
          action: input.action,
          createdAt: input.createdAt ?? new Date(),
          payload: {
            officeId: office.id,
            objectLabel: input.objectLabel,
            contextHref: input.contextHref,
            details: input.details,
          },
        },
      });
    },
    async createFollowUpTask(input: {
      clientId: string;
      assigneeMembershipId: string;
      title: string;
      dueAt?: Date | null;
    }) {
      return prisma.followUpTask.create({
        data: {
          organizationId: organization.id,
          clientId: input.clientId,
          assigneeMemberId: input.assigneeMembershipId,
          title: input.title,
          status: TaskStatus.queued,
          dueAt: input.dueAt ?? null,
          metadata: Prisma.JsonNull,
        },
      });
    },
    async createSendRecord(input: {
      clientId: string;
      senderMembershipId: string;
      sentAt: Date;
      listingId?: string | null;
      openCount?: number;
      firstOpenedAt?: Date | null;
      lastOpenedAt?: Date | null;
    }) {
      return prisma.frontOfficeSendRecord.create({
        data: {
          organizationId: organization.id,
          officeId: office.id,
          senderMembershipId: input.senderMembershipId,
          clientId: input.clientId,
          listingId: input.listingId ?? null,
          channel: FrontOfficeSendChannel.email,
          sentAt: input.sentAt,
          firstOpenedAt: input.firstOpenedAt ?? null,
          lastOpenedAt: input.lastOpenedAt ?? null,
          openCount: input.openCount ?? 0,
          clientStageLabel: "Warm Lead",
        },
      });
    },
    async createListing(input: {
      title: string;
      slug: string;
      ownerMembershipId?: string | null;
    }) {
      return prisma.listing.create({
        data: {
          organizationId: organization.id,
          officeId: office.id,
          ownerMembershipId: input.ownerMembershipId ?? agentMembership.id,
          title: input.title,
          slug: `${input.slug}-${suffix}`,
          status: "active",
          price: "750000",
          city: "Queens",
          neighborhood: "LIC",
          seoKeywords: [],
        },
      });
    },
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id,
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds,
          },
        },
      });
    },
  };
}

test("dashboard exposes shared resource pulse to office leadership", async () => {
  const context = await createFrontOfficeDashboardTestContext();
  const now = Date.now();

  try {
    await context.recordInteraction({
      membershipId: context.agentMembership.id,
      action: activityLogActions.frontOfficeResourceSearched,
      objectLabel: "Broker tour notes",
      contextHref: "/agent/resources?tab=documents",
      details: ["Query: broker tour notes", "Scope: Published resources"],
      createdAt: new Date(now - 20 * 24 * 60 * 60 * 1000),
    });
    await context.recordInteraction({
      membershipId: context.agentMembership.id,
      action: activityLogActions.frontOfficeResourceOpened,
      objectLabel: context.resource.title,
      contextHref: "/agent/resources?tab=documents",
      details: ["Lane: Playbook", "Action: Open playbook"],
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
    });
    await context.recordInteraction({
      membershipId: context.adminMembership.id,
      action: activityLogActions.frontOfficeVendorClicked,
      objectLabel: context.vendor.name,
      contextHref: "/agent/resources?tab=vendors",
      details: ["Action: Website", "Coverage: Brooklyn"],
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });

    const snapshot = await getFrontOfficeDashboardSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      viewerRole: "office_admin",
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.noticeRail.resourcePulse.visible, true);
    assert.equal(
      snapshot.noticeRail.resourcePulse.scopeLabel,
      "Office adoption pulse",
    );
    assert.equal(
      snapshot.noticeRail.resourcePulse.comparisonWindowLabel,
      "Prior 14 days",
    );
    assert.equal(snapshot.noticeRail.resourcePulse.totalCount, 2);
    assert.equal(snapshot.noticeRail.resourcePulse.totalCountDelta, 1);
    assert.equal(snapshot.noticeRail.resourcePulse.resourceOpenCount, 1);
    assert.equal(snapshot.noticeRail.resourcePulse.resourceOpenDelta, 1);
    assert.equal(snapshot.noticeRail.resourcePulse.vendorClickCount, 1);
    assert.equal(snapshot.noticeRail.resourcePulse.vendorClickDelta, 1);
    assert.equal(snapshot.noticeRail.resourcePulse.activeMembershipDelta, 1);
    assert.ok(snapshot.noticeRail.resourcePulse.topActors.length > 0);
    assert.ok(snapshot.noticeRail.resourcePulse.hottestTargets.length > 0);
  } finally {
    await context.cleanup();
  }
});

test("dashboard keeps shared resource pulse hidden for self-scoped agents", async () => {
  const context = await createFrontOfficeDashboardTestContext();
  const now = Date.now();

  try {
    await context.recordInteraction({
      membershipId: context.agentMembership.id,
      action: activityLogActions.frontOfficeResourceOpened,
      objectLabel: context.resource.title,
      contextHref: "/agent/resources?tab=documents",
      details: ["Lane: Playbook", "Action: Open playbook"],
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });

    const snapshot = await getFrontOfficeDashboardSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      viewerRole: "agent",
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.noticeRail.resourcePulse.visible, false);
    assert.equal(snapshot.noticeRail.resourcePulse.totalCount, 0);
    assert.equal(snapshot.noticeRail.resourcePulse.scopeLabel, "");
    assert.equal(
      snapshot.noticeRail.resourcePulse.comparisonWindowLabel,
      "Prior 14 days",
    );
    assert.equal(snapshot.noticeRail.resourcePulse.totalCountDelta, 0);
  } finally {
    await context.cleanup();
  }
});

test("dashboard surfaces the leadership command deck for office admins", async () => {
  const context = await createFrontOfficeDashboardTestContext();
  const now = Date.now();

  try {
    const client = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.agentMembership.id,
        fullName: "Leadership Command Client",
        email: "leadership-command-client@example.com",
        phone: "2125550198",
        source: "Dashboard regression",
        stage: "Warm Lead",
        intent: "Buyer",
        preferredAreas: ["Brooklyn"],
        lastContactAt: new Date(now - 16 * 24 * 60 * 60 * 1000),
        additionalFields: Prisma.JsonNull,
      },
    });
    const aiClient = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.adminMembership.id,
        fullName: "AI Sequence Client",
        email: "ai-sequence-client@example.com",
        phone: "2125550197",
        source: "Dashboard regression",
        stage: "Warm Lead",
        intent: "Buyer",
        preferredAreas: ["Brooklyn"],
        lastContactAt: new Date(now - 6 * 24 * 60 * 60 * 1000),
        additionalFields: Prisma.JsonNull,
      },
    });
    await prisma.appointment.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        ownerMembershipId: context.adminMembership.id,
        clientId: aiClient.id,
        title: "Leadership command deck prep",
        type: AppointmentType.showing,
        startsAt: new Date(now + 2 * 60 * 60 * 1000),
        status: AppointmentStatus.scheduled,
      },
    });

    await context.createFollowUpTask({
      clientId: client.id,
      assigneeMembershipId: context.agentMembership.id,
      title: "Leadership dashboard overdue task",
      dueAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });
    await context.createSendRecord({
      clientId: client.id,
      senderMembershipId: context.agentMembership.id,
      sentAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
    });

    const snapshot = await getFrontOfficeDashboardSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      viewerRole: "office_admin",
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.leadershipQueue.visible, true);
    assert.equal(
      snapshot.leadershipQueue.scopeLabel,
      "Office execution pressure",
    );
    assert.equal(snapshot.leadershipQueue.overdueTaskCount, 1);
    assert.equal(snapshot.leadershipQueue.staleClientCount, 1);
    assert.equal(snapshot.leadershipQueue.engagementRiskCount, 1);
    assert.equal(snapshot.summary.leadershipPressureCount, 3);
    const teamCleanupAction = snapshot.dailyActions.find(
      (action) => action.kind === "team_cleanup",
    );
    assert.equal(teamCleanupAction?.title, "Review office pressure");
    assert.equal(
      teamCleanupAction?.primaryAction.href,
      "/agent/notifications?activityView=team_cleanup&teamCleanupFilter=overdue_task#team-cleanup-pressure",
    );
    assert.ok(
      snapshot.dailyActions.every(
        (action, index, actions) =>
          index === 0 || actions[index - 1]!.priority <= action.priority,
      ),
    );
    assert.equal(snapshot.aiQueue.items.length > 0, true);
    assert.equal(
      snapshot.aiQueue.items[0]?.sequenceLabel,
      "Prep the calendar checkpoint",
    );
    assert.equal(
      snapshot.aiQueue.items[0]?.safeActionLabel,
      "Safe action · Open calendar writeback before dossier follow-up",
    );
    assert.equal(
      snapshot.aiQueue.items[0]?.sequenceContractLabel,
      "Sequence contract · Calendar writeback first, dossier second",
    );
    assert.match(
      snapshot.aiQueue.items[0]?.whyNowLabel ?? "",
      /^Why now · Appointment/,
    );
    assert.ok(snapshot.leadershipQueue.items.length > 0);
    assert.ok(snapshot.leadershipQueue.activityCenterItems.length > 0);
  } finally {
    await context.cleanup();
  }
});

test("dashboard daily actions rank appointments before same-client follow-up", async () => {
  const context = await createFrontOfficeDashboardTestContext();
  const now = Date.now();

  try {
    const sharedClient = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.agentMembership.id,
        fullName: "Appointment Priority Client",
        email: "appointment-priority@example.com",
        phone: "2125550101",
        source: "Dashboard regression",
        stage: "Warm Lead",
        intent: "Buyer",
        budgetMax: "6500",
        preferredAreas: ["LIC"],
        nextFollowUpAt: new Date(now + 30 * 60 * 1000),
        additionalFields: Prisma.JsonNull,
      },
    });
    const overdueClient = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.agentMembership.id,
        fullName: "Overdue Daily Action Client",
        email: "overdue-daily-action@example.com",
        phone: "2125550102",
        source: "Dashboard regression",
        stage: "Warm Lead",
        intent: "Buyer",
        preferredAreas: ["Astoria"],
        nextFollowUpAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        additionalFields: Prisma.JsonNull,
      },
    });

    await prisma.appointment.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        ownerMembershipId: context.agentMembership.id,
        clientId: sharedClient.id,
        title: "Same client showing",
        type: AppointmentType.showing,
        startsAt: new Date(now + 60 * 60 * 1000),
        status: AppointmentStatus.scheduled,
      },
    });

    const snapshot = await getFrontOfficeDashboardSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      viewerRole: "agent",
      officeId: context.office.id,
      timeZone: "America/New_York",
    });
    const sharedClientActions = snapshot.dailyActions.filter(
      (action) => action.clientId === sharedClient.id,
    );

    assert.equal(sharedClientActions.length, 1);
    assert.equal(sharedClientActions[0]?.kind, "appointment_confirmation");
    assert.equal(snapshot.dailyActions[0]?.clientId, overdueClient.id);
    assert.equal(snapshot.dailyActions[0]?.kind, "overdue_follow_up");
  } finally {
    await context.cleanup();
  }
});

test("dashboard daily actions surface listing warm signal and quiet send risk", async () => {
  const context = await createFrontOfficeDashboardTestContext();
  const now = Date.now();

  try {
    const listing = await context.createListing({
      title: "LIC Waterfront Test Listing",
      slug: "lic-waterfront-test-listing",
    });
    const warmClient = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.agentMembership.id,
        fullName: "Warm Listing Client",
        email: "warm-listing@example.com",
        phone: "2125550103",
        source: "Dashboard regression",
        stage: "Warm Lead",
        intent: "Buyer",
        additionalFields: Prisma.JsonNull,
      },
    });
    const quietClient = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.agentMembership.id,
        fullName: "Quiet Listing Client",
        email: "quiet-listing@example.com",
        phone: "2125550104",
        source: "Dashboard regression",
        stage: "Warm Lead",
        intent: "Buyer",
        additionalFields: Prisma.JsonNull,
      },
    });

    await context.createSendRecord({
      clientId: warmClient.id,
      senderMembershipId: context.agentMembership.id,
      listingId: listing.id,
      sentAt: new Date(now - 24 * 60 * 60 * 1000),
      firstOpenedAt: new Date(now - 18 * 60 * 60 * 1000),
      lastOpenedAt: new Date(now - 2 * 60 * 60 * 1000),
      openCount: 3,
    });
    await context.createSendRecord({
      clientId: quietClient.id,
      senderMembershipId: context.agentMembership.id,
      listingId: listing.id,
      sentAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
      openCount: 0,
    });

    const snapshot = await getFrontOfficeDashboardSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      viewerRole: "agent",
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.ok(
      snapshot.dailyActions.some(
        (action) =>
          action.kind === "listing_warm_signal" &&
          action.clientId === warmClient.id,
      ),
    );
    assert.ok(
      snapshot.dailyActions.some(
        (action) =>
          action.kind === "listing_send_risk" &&
          action.clientId === quietClient.id,
      ),
    );
  } finally {
    await context.cleanup();
  }
});

test("dashboard hides AI daily actions when ai use is not granted", async () => {
  const context = await createFrontOfficeDashboardTestContext();
  const now = Date.now();

  try {
    const client = await prisma.client.create({
      data: {
        organizationId: context.organization.id,
        ownerMembershipId: context.agentMembership.id,
        fullName: "AI Hidden Client",
        email: "ai-hidden@example.com",
        phone: "2125550105",
        source: "Dashboard regression",
        stage: "Warm Lead",
        intent: "Buyer",
        lastContactAt: new Date(now - 6 * 24 * 60 * 60 * 1000),
        additionalFields: Prisma.JsonNull,
      },
    });

    await prisma.appointment.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        ownerMembershipId: context.agentMembership.id,
        clientId: client.id,
        title: "AI hidden appointment",
        type: AppointmentType.showing,
        startsAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
        status: AppointmentStatus.scheduled,
      },
    });

    const snapshot = await getFrontOfficeDashboardSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      viewerRole: "agent",
      officeId: context.office.id,
      timeZone: "America/New_York",
      canUseAi: false,
    });

    assert.equal(snapshot.aiQueue.suggestionCount, 0);
    assert.equal(snapshot.aiQueue.items.length, 0);
    assert.equal(
      snapshot.dailyActions.some(
        (action) => action.kind === "ai_suggested_touch",
      ),
      false,
    );
  } finally {
    await context.cleanup();
  }
});
