import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, ResourceType } from "@prisma/client";
import { activityLogActions } from "./activity-log.ts";
import { prisma } from "./client.ts";
import { getFrontOfficeResourcesSnapshot } from "./front-office-workspaces.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createFrontOfficeResourcesTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `FO Resources Test ${suffix}`,
      slug: `fo-resources-test-${suffix}`,
    },
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `FO Resources Office ${suffix}`,
      slug: `fo-resources-office-${suffix}`,
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
    "resource-admin",
  );
  const agentMembership = await createMembership("agent", "resource-agent");

  const resource = await prisma.resource.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      type: ResourceType.playbook,
      title: `Shareable Playbook ${suffix}`,
      slug: `shareable-playbook-${suffix}`,
      summary: "A front office resource used for shared adoption tests.",
      url: "https://example.com/playbooks/shareable",
      tags: ["script", "tour"],
      isPublished: true,
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      category: "staging",
      name: `Vendor Desk ${suffix}`,
      headline: "Shared vendor for FO tests",
      phone: "2125550199",
      email: `vendor-${suffix}@example.com`,
      website: "https://example.com/vendor",
      neighborhoods: ["Brooklyn"],
      notes: "Shared vendor coverage.",
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
      progressPercent?: number;
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
            progressPercent: input.progressPercent ?? null,
            details: input.details,
          },
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

test("office admins see a shared resource adoption pulse for visible FO usage", async () => {
  const context = await createFrontOfficeResourcesTestContext();
  const now = Date.now();

  try {
    await context.recordInteraction({
      membershipId: context.agentMembership.id,
      action: activityLogActions.frontOfficeResourceSearched,
      objectLabel: "Staging checklist",
      contextHref: "/agent/resources#resource-search-results",
      details: ["Query: staging checklist", "Scope: Published resources"],
      createdAt: new Date(now - 20 * 24 * 60 * 60 * 1000),
    });
    await context.recordInteraction({
      membershipId: context.agentMembership.id,
      action: activityLogActions.frontOfficeResourceProgressLogged,
      objectLabel: context.resource.title,
      contextHref: "/agent/resources#published-tool-library",
      details: ["Progress: 25% watched", "Lane: Training video"],
      progressPercent: 25,
      createdAt: new Date(now - 18 * 24 * 60 * 60 * 1000),
    });
    await context.recordInteraction({
      membershipId: context.adminMembership.id,
      action: activityLogActions.frontOfficeResourceSearched,
      objectLabel: "Shared vendor desk",
      contextHref: "/agent/resources#resource-search-results",
      details: ["Query: shared vendor desk", "Scope: Published resources"],
      createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
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
      membershipId: context.agentMembership.id,
      action: activityLogActions.frontOfficeResourceProgressLogged,
      objectLabel: context.resource.title,
      contextHref: "/agent/resources#published-tool-library",
      details: ["Progress: Completed", "Lane: Training video"],
      progressPercent: 100,
      createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
    });
    await context.recordInteraction({
      membershipId: context.adminMembership.id,
      action: activityLogActions.frontOfficeVendorClicked,
      objectLabel: context.vendor.name,
      contextHref: "/agent/resources#vendor-hub",
      details: ["Action: Call", "Coverage: Brooklyn"],
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });

    const snapshot = await getFrontOfficeResourcesSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.adminMembership.id,
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.interactionTracking.sharedTracking.visible, true);
    assert.equal(
      snapshot.interactionTracking.sharedTracking.scopeLabel,
      "Office adoption pulse",
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.comparisonWindowLabel,
      "Prior 14 days",
    );
    assert.equal(snapshot.interactionTracking.sharedTracking.totalCount, 4);
    assert.equal(
      snapshot.interactionTracking.sharedTracking.totalCountDelta,
      2,
    );
    assert.equal(snapshot.interactionTracking.sharedTracking.searchCount, 1);
    assert.equal(
      snapshot.interactionTracking.sharedTracking.searchCountDelta,
      0,
    );
    assert.equal(snapshot.interactionTracking.sharedTracking.progressCount, 1);
    assert.equal(
      snapshot.interactionTracking.sharedTracking.progressCountDelta,
      0,
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.completionCount,
      1,
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.completionCountDelta,
      1,
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.resourceOpenCount,
      1,
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.resourceOpenDelta,
      1,
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.vendorClickCount,
      1,
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.vendorClickDelta,
      1,
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.activeMembershipCount,
      2,
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.activeMembershipDelta,
      1,
    );
    assert.ok(
      snapshot.interactionTracking.sharedTracking.visibleMembershipCount >= 2,
    );
    assert.ok(
      snapshot.interactionTracking.sharedTracking.topActors.some(
        (actor) => actor.membershipId === context.agentMembership.id,
      ),
    );
    assert.ok(
      snapshot.interactionTracking.sharedTracking.hottestTargets.some(
        (target) =>
          target.title === context.resource.title &&
          target.lastInteractionLabel.length > 0,
      ),
    );
  } finally {
    await context.cleanup();
  }
});

test("agents keep the shared adoption pulse hidden when their FO scope is self only", async () => {
  const context = await createFrontOfficeResourcesTestContext();
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

    const snapshot = await getFrontOfficeResourcesSnapshot({
      organizationId: context.organization.id,
      viewerMembershipId: context.agentMembership.id,
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.interactionTracking.sharedTracking.visible, false);
    assert.equal(snapshot.interactionTracking.sharedTracking.totalCount, 0);
    assert.equal(snapshot.interactionTracking.sharedTracking.scopeLabel, "");
    assert.equal(
      snapshot.interactionTracking.sharedTracking.comparisonWindowLabel,
      "Prior 14 days",
    );
    assert.equal(
      snapshot.interactionTracking.sharedTracking.totalCountDelta,
      0,
    );
  } finally {
    await context.cleanup();
  }
});
