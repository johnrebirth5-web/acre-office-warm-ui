import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  Prisma,
  StudioListingImportStatus,
  StudioListingPackStatus,
  StudioListingSourceSite,
  type UserRole,
} from "@prisma/client";
import {
  addStudioListingPackToCollection,
  createStudioListingCollection,
  publishStudioListingPack,
  getStudioListingCollectionDetail,
  listStudioListingCollectionPickerItems,
  listStudioListingCollections,
  removeStudioListingPackFromCollection,
} from "./studio-listings.ts";
import { prisma } from "./client.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createStudioListingsTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Studio Listings Test ${suffix}`,
      slug: `studio-listings-test-${suffix}`,
    },
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Studio Listings Office ${suffix}`,
      slug: `studio-listings-office-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  });

  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string) {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}-${randomUUID().slice(0, 8)}@example.com`,
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
        title: role,
        permissions: Prisma.JsonNull,
      },
    });

    return membership;
  }

  async function createPack(input: {
    membershipId: string;
    title: string;
    streetAddress: string;
    city?: string;
    state?: string;
    postalCode?: string;
    neighborhood?: string;
    latitude?: number | null;
    longitude?: number | null;
  }) {
    const importRecord = await prisma.studioListingImport.create({
      data: {
        organizationId: organization.id,
        officeId: office.id,
        createdByMembershipId: input.membershipId,
        sourceSite: StudioListingSourceSite.streeteasy,
        sourceUrl: `https://example.com/${randomUUID()}`,
        status: StudioListingImportStatus.ready,
      },
    });

    const snapshot = await prisma.studioListingSnapshot.create({
      data: {
        organizationId: organization.id,
        officeId: office.id,
        importId: importRecord.id,
        sourceSite: StudioListingSourceSite.streeteasy,
        sourceUrl: importRecord.sourceUrl,
        title: input.title,
        listingType: "sale",
        price: "995000",
        priceLabel: "$995,000",
        currency: "USD",
        streetAddress: input.streetAddress,
        city: input.city ?? "Long Island City",
        state: input.state ?? "NY",
        postalCode: input.postalCode ?? "11101",
        neighborhood: input.neighborhood ?? "Long Island City",
        heroFactsJson: [{ label: "Bedrooms", value: "2" }, { label: "Bathrooms", value: "2" }],
        rawParsedJson: {
          canonicalFields: {
            listingType: "sale",
            priceLabel: "$995,000",
          },
        },
        latitude:
          typeof input.latitude === "number" ? input.latitude.toString() : null,
        longitude:
          typeof input.longitude === "number" ? input.longitude.toString() : null,
      },
    });

    const pack = await prisma.studioListingPack.create({
      data: {
        organizationId: organization.id,
        officeId: office.id,
        snapshotId: snapshot.id,
        updatedByMembershipId: input.membershipId,
        status: StudioListingPackStatus.ready,
        headline: input.title,
        summary: `${input.streetAddress} summary`,
        bulletPointsJson: ["Bedrooms: 2", "Bathrooms: 2"],
        selectedAssetIdsJson: Prisma.JsonNull,
        contactName: "Test Agent",
        contactTitle: "Acre agent",
        contactPhone: "2125550100",
        contactEmail: "agent@example.com",
      },
    });

    return {
      importId: importRecord.id,
      snapshotId: snapshot.id,
      packId: pack.id,
    };
  }

  const ownerMembership = await createMembership("agent", "studio-owner");
  const teammateMembership = await createMembership("agent", "studio-peer");

  return {
    organization,
    office,
    ownerMembership,
    teammateMembership,
    createPack,
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

test("collections are scoped to the current membership and reject duplicate names", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Urban 21",
      streetAddress: "46-30 21st Street",
      latitude: 40.7445,
      longitude: -73.9481,
    });

    const created = await createStudioListingCollection({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.ownerMembership.id,
      name: "For Kyung",
      initialPackId: pack.packId,
    });

    assert.ok(created);
    assert.equal(created?.listingCount, 1);
    assert.equal(created?.name, "For Kyung");

    const ownerCollections = await listStudioListingCollections({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
    });
    assert.equal(ownerCollections.length, 1);
    assert.equal(ownerCollections[0]?.listingCount, 1);

    const teammateCollections = await listStudioListingCollections({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
    });
    assert.equal(teammateCollections.length, 0);

    await assert.rejects(
      () =>
        createStudioListingCollection({
          organizationId: context.organization.id,
          officeId: context.office.id,
          membershipId: context.ownerMembership.id,
          name: "  for   kyung  ",
        }),
      /Collection name already exists\./,
    );

    const teammateCreated = await createStudioListingCollection({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.teammateMembership.id,
      name: "For Kyung",
    });
    assert.ok(teammateCreated);

    const hiddenFromTeammate = await getStudioListingCollectionDetail({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
      collectionId: created?.id ?? "",
    });
    assert.equal(hiddenFromTeammate, null);
  } finally {
    await context.cleanup();
  }
});

test("publishing a pack mints a high-entropy share code", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Queens Landing",
      streetAddress: "41-15 Crescent Street",
      latitude: 40.7513,
      longitude: -73.9375,
    });

    const published = await publishStudioListingPack({
      organizationId: context.organization.id,
      packId: pack.packId,
      membershipId: context.ownerMembership.id,
    });

    assert.ok(published);
    assert.match(published?.shareCode ?? "", /^pack_[A-Za-z0-9_-]{32}$/);
  } finally {
    await context.cleanup();
  }
});

test("collection picker membership, add/remove, and pack delete cleanup stay in sync", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const firstPack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Arcadia LIC",
      streetAddress: "24-12 42nd Road",
      latitude: 40.7501,
      longitude: -73.9403,
    });
    const secondPack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Urban 21",
      streetAddress: "46-30 21st Street",
      latitude: null,
      longitude: null,
    });

    const collection = await createStudioListingCollection({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.ownerMembership.id,
      name: "LIC Tour",
    });
    assert.ok(collection);

    const addedFirst = await addStudioListingPackToCollection({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
      collectionId: collection?.id ?? "",
      packId: firstPack.packId,
    });
    assert.equal(addedFirst?.listingCount, 1);

    const pickerAfterFirst = await listStudioListingCollectionPickerItems({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
      packId: firstPack.packId,
    });
    assert.equal(pickerAfterFirst[0]?.includesPack, true);
    assert.equal(pickerAfterFirst[0]?.listingCount, 1);

    const addedSecond = await addStudioListingPackToCollection({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
      collectionId: collection?.id ?? "",
      packId: secondPack.packId,
    });
    assert.equal(addedSecond?.listingCount, 2);
    assert.equal(addedSecond?.listingsWithoutCoordinates, 1);

    const removedFirst = await removeStudioListingPackFromCollection({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
      collectionId: collection?.id ?? "",
      packId: firstPack.packId,
    });
    assert.equal(removedFirst?.listingCount, 1);
    assert.equal(removedFirst?.listings[0]?.packId, secondPack.packId);

    await prisma.studioListingImport.delete({
      where: {
        id: secondPack.importId,
      },
    });

    const afterDelete = await getStudioListingCollectionDetail({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
      collectionId: collection?.id ?? "",
    });
    assert.ok(afterDelete);
    assert.equal(afterDelete?.listingCount, 0);
    assert.equal(afterDelete?.listingsWithoutCoordinates, 0);
  } finally {
    await context.cleanup();
  }
});
