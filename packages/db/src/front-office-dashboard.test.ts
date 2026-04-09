import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
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
      openCount?: number;
    }) {
      return prisma.frontOfficeSendRecord.create({
        data: {
          organizationId: organization.id,
          officeId: office.id,
          senderMembershipId: input.senderMembershipId,
          clientId: input.clientId,
          channel: FrontOfficeSendChannel.email,
          sentAt: input.sentAt,
          openCount: input.openCount ?? 0,
          clientStageLabel: "Warm Lead",
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
      contextHref: "/agent/resources#resource-search-results",
      details: ["Query: broker tour notes", "Scope: Published resources"],
      createdAt: new Date(now - 20 * 24 * 60 * 60 * 1000),
    });
    await context.recordInteraction({
      membershipId: context.agentMembership.id,
      action: activityLogActions.frontOfficeResourceOpened,
      objectLabel: context.resource.title,
      contextHref: "/agent/resources#published-tool-library",
      details: ["Lane: Playbook", "Action: Open playbook"],
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
    });
    await context.recordInteraction({
      membershipId: context.adminMembership.id,
      action: activityLogActions.frontOfficeVendorClicked,
      objectLabel: context.vendor.name,
      contextHref: "/agent/resources#vendor-hub",
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
      contextHref: "/agent/resources#published-tool-library",
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
    assert.equal(snapshot.actionQueue[0]?.label, "Office cleanup");
    assert.equal(
      snapshot.actionQueue[0]?.actionLabel,
      "Open office command deck",
    );
    assert.match(
      snapshot.actionQueue[0]?.description ?? "",
      /first rescue pass in this command deck/,
    );
    assert.match(
      snapshot.actionQueue[0]?.helper ?? "",
      /work the command deck first/,
    );
    assert.ok(snapshot.leadershipQueue.items.length > 0);
    assert.ok(snapshot.leadershipQueue.activityCenterItems.length > 0);
  } finally {
    await context.cleanup();
  }
});
