import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { ResourceType } from "@prisma/client";
import { activityLogActions } from "./activity-log.ts";
import { prisma } from "./client.ts";
import {
  createOfficeResource,
  createOfficeVendor,
  deleteOfficeResource,
  deleteOfficeVendor,
  getOfficeResourcesAdminSnapshot,
  updateOfficeResource,
  updateOfficeVendor,
} from "./office-resources.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createOfficeResourcesTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Office Resources Test ${suffix}`,
      slug: `office-resources-test-${suffix}`,
    },
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Office Resources ${suffix}`,
      slug: `office-resources-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `office-admin-${suffix}@example.com`,
      firstName: "Office",
      lastName: "Admin",
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
      title: "Office Admin",
    },
  });

  return {
    organization,
    office,
    membership,
    user,
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id,
        },
      });
      await prisma.user.delete({
        where: {
          id: user.id,
        },
      });
    },
  };
}

test("office resource admin snapshot supports resource and vendor CRUD", async () => {
  const context = await createOfficeResourcesTestContext();

  try {
    const resourceId = await createOfficeResource({
      organizationId: context.organization.id,
      officeId: context.office.id,
      title: "Buyer intro template",
      summary: "Shared message template for first buyer outreach.",
      url: "https://example.com/buyer-intro-template",
      tags: ["buyers", "intro"],
      type: ResourceType.template,
      isPublished: true,
      visibilityScope: "office_only",
    });

    const vendorId = await createOfficeVendor({
      organizationId: context.organization.id,
      officeId: context.office.id,
      category: "lender",
      name: "North Star Lending",
      headline: "Fast pre-approval help for active buyer leads.",
      phone: "2125550199",
      email: "northstar@example.com",
      website: "https://example.com/north-star",
      neighborhoods: ["Brooklyn", "Queens"],
      notes: "Best for first-time buyers.",
      isFeatured: true,
      visibilityScope: "organization_wide",
    });

    let snapshot = await getOfficeResourcesAdminSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.summary.resourceCount, 1);
    assert.equal(snapshot.summary.publishedResourceCount, 1);
    assert.equal(snapshot.summary.vendorCount, 1);
    assert.equal(snapshot.resources[0]?.title, "Buyer intro template");
    assert.equal(snapshot.resources[0]?.scopeKey, "office_only");
    assert.equal(snapshot.vendors[0]?.name, "North Star Lending");
    assert.equal(snapshot.vendors[0]?.scopeKey, "organization_wide");

    const updatedResourceId = await updateOfficeResource({
      organizationId: context.organization.id,
      officeId: context.office.id,
      resourceId,
      title: "Buyer intro playbook",
      summary: "Updated first-touch talking points for buyer outreach.",
      url: "https://example.com/buyer-intro-playbook",
      tags: ["buyers", "first-touch"],
      type: ResourceType.playbook,
      isPublished: false,
      visibilityScope: "organization_wide",
    });

    const updatedVendorId = await updateOfficeVendor({
      organizationId: context.organization.id,
      officeId: context.office.id,
      vendorId,
      category: "attorney",
      name: "Park Slope Closings",
      headline: "Clean contract support for co-op and condo deals.",
      phone: "7185550110",
      email: "closings@example.com",
      website: "https://example.com/closings",
      neighborhoods: ["Brooklyn"],
      notes: "Handles evening review windows.",
      isFeatured: false,
      visibilityScope: "office_only",
    });

    assert.equal(updatedResourceId, resourceId);
    assert.equal(updatedVendorId, vendorId);

    snapshot = await getOfficeResourcesAdminSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.summary.publishedResourceCount, 0);
    assert.equal(snapshot.resources[0]?.title, "Buyer intro playbook");
    assert.equal(snapshot.resources[0]?.type, ResourceType.playbook);
    assert.equal(snapshot.resources[0]?.scopeKey, "organization_wide");
    assert.equal(snapshot.vendors[0]?.category, "attorney");
    assert.equal(snapshot.vendors[0]?.scopeKey, "office_only");

    assert.equal(
      await deleteOfficeResource({
        organizationId: context.organization.id,
        officeId: context.office.id,
        resourceId,
      }),
      true,
    );
    assert.equal(
      await deleteOfficeVendor({
        organizationId: context.organization.id,
        officeId: context.office.id,
        vendorId,
      }),
      true,
    );

    snapshot = await getOfficeResourcesAdminSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.summary.resourceCount, 0);
    assert.equal(snapshot.summary.vendorCount, 0);
  } finally {
    await context.cleanup();
  }
});

test("office resource admin snapshot exposes top-opened and stale resources", async () => {
  const context = await createOfficeResourcesTestContext();
  const now = Date.now();

  try {
    const staleResource = await prisma.resource.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        type: ResourceType.document,
        title: "Quiet relocation guide",
        slug: `quiet-relocation-guide-${randomUUID().slice(0, 6)}`,
        summary: "Document that has gone untouched for months.",
        url: "https://example.com/quiet-relocation-guide",
        tags: ["relocation"],
        isPublished: true,
        createdAt: new Date(now - 130 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now - 120 * 24 * 60 * 60 * 1000),
      },
    });

    const popularResource = await prisma.resource.create({
      data: {
        organizationId: context.organization.id,
        officeId: null,
        type: ResourceType.playbook,
        title: "Popular open-house playbook",
        slug: `popular-open-house-playbook-${randomUUID().slice(0, 6)}`,
        summary: "Frequently opened buyer prep material.",
        url: "https://example.com/open-house-playbook",
        tags: ["open-house"],
        isPublished: true,
      },
    });

    await prisma.auditLog.createMany({
      data: [
        {
          organizationId: context.organization.id,
          membershipId: context.membership.id,
          entityType: "resource",
          entityId: popularResource.id,
          action: activityLogActions.frontOfficeResourceOpened,
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
          payload: {
            officeId: context.office.id,
            objectLabel: popularResource.title,
          },
        },
        {
          organizationId: context.organization.id,
          membershipId: context.membership.id,
          entityType: "resource",
          entityId: popularResource.id,
          action: activityLogActions.frontOfficeResourceOpened,
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
          payload: {
            officeId: context.office.id,
            objectLabel: popularResource.title,
          },
        },
      ],
    });

    const snapshot = await getOfficeResourcesAdminSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      timeZone: "America/New_York",
    });

    assert.equal(snapshot.topOpenedResources.length, 1);
    assert.equal(snapshot.topOpenedResources[0]?.title, popularResource.title);
    assert.equal(snapshot.topOpenedResources[0]?.openCount, 2);
    assert.ok(
      snapshot.staleResources.some(
        (resource) => resource.id === staleResource.id,
      ),
    );
  } finally {
    await context.cleanup();
  }
});
