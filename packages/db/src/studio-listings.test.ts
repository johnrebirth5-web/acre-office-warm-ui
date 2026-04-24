import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  Prisma,
  StudioListingImportStatus,
  StudioListingAssetKind,
  StudioListingPackStatus,
  StudioListingSourceSite,
  type UserRole,
} from "@prisma/client";
import {
  addStudioListingPackToCollection,
  configureStudioListingFileHelpers,
  createStudioListingImport,
  createStudioListingCollection,
  getStudioListingAssetRecord,
  getListingStudioCompanyDashboard,
  getStudioListingPublicCollection,
  getStudioListingPublicPack,
  getStudioListingCollectionDetail,
  listStudioListingPacks,
  listStudioListingCollectionPickerItems,
  listStudioListingCollections,
  publishStudioListingCollection,
  publishStudioListingPack,
  removeStudioListingPackFromCollection,
  removeStudioListingPackFromMyListings,
  saveStudioListingPackToMyListings,
  updateStudioListingPack,
} from "./studio-listings.ts";
import { prisma } from "./client.ts";

configureStudioListingFileHelpers({
  async saveText(input) {
    return {
      storageKey: `test/${input.bucket}/${input.importId}/${input.fileName}`,
    };
  },
  async saveFile(input) {
    return {
      storageKey: `test/${input.bucket}/${randomUUID()}-${input.fileName}`,
      fileName: input.fileName,
      fileSizeBytes: input.bytes.byteLength,
    };
  },
});

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
    companyFeedVisible?: boolean;
    companyFeedLabel?: string | null;
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
        companyFeedVisible: input.companyFeedVisible ?? false,
        companyFeedLabel:
          input.companyFeedLabel ??
          (input.companyFeedVisible ? "Acre Featured" : null),
        companyFeedPublishedAt: input.companyFeedVisible ? new Date() : null,
        companyFeedPublishedByMembershipId: input.companyFeedVisible
          ? input.membershipId
          : null,
        contactName: "Test Agent",
        contactTitle: "Acre agent",
        contactPhone: "2125550100",
        contactEmail: "agent@example.com",
        savedPacks: {
          create: {
            organizationId: organization.id,
            membershipId: input.membershipId,
            source: "imported_by_me",
          },
        },
      },
    });

    return {
      importId: importRecord.id,
      snapshotId: snapshot.id,
      packId: pack.id,
    };
  }

  const adminMembership = await createMembership("office_admin", "studio-admin");
  const ownerMembership = await createMembership("agent", "studio-owner");
  const teammateMembership = await createMembership("agent", "studio-peer");

  return {
    organization,
    office,
    adminMembership,
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

test("admin imports are saved personally and published to the company dashboard", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const imported = await createStudioListingImport({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.adminMembership.id,
      sourceSite: StudioListingSourceSite.streeteasy,
      sourceUrl: `https://streeteasy.com/building/${randomUUID()}`,
      rawHtml: "<html><body>listing</body></html>",
      canonicalFields: {
        title: "Admin Import",
        streetAddress: "5-11 47th Avenue",
        city: "Long Island City",
        state: "NY",
        postalCode: "11101",
        neighborhood: "Hunters Point",
        listingType: "sale",
        price: 875000,
        priceLabel: "$875,000",
        bedrooms: 1,
        bathrooms: 1,
        sqft: 658,
      },
      assets: [],
    });

    const dashboard = await getListingStudioCompanyDashboard({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
    });
    const adminListings = await listStudioListingPacks({
      organizationId: context.organization.id,
      membershipId: context.adminMembership.id,
    });

    assert.ok(dashboard.items.some((item) => item.packId === imported.packId));
    assert.ok(adminListings.some((item) => item.packId === imported.packId));
    assert.equal(
      adminListings.find((item) => item.packId === imported.packId)?.savedSource,
      "imported_by_me",
    );
    assert.equal(
      dashboard.items.find((item) => item.packId === imported.packId)
        ?.companyFeedVisible,
      true,
    );
    assert.equal(
      dashboard.items.find((item) => item.packId === imported.packId)
        ?.companyFeedLabel,
      "Acre Featured",
    );
  } finally {
    await context.cleanup();
  }
});

test("agent imports stay private to personal listings until an admin publishes them", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const imported = await createStudioListingImport({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.ownerMembership.id,
      sourceSite: StudioListingSourceSite.zillow,
      sourceUrl: `https://zillow.com/homedetails/${randomUUID()}`,
      rawHtml: "<html><body>listing</body></html>",
      canonicalFields: {
        title: "Agent Import",
        streetAddress: "24-01 Queens Plaza North",
        city: "Long Island City",
        state: "NY",
        postalCode: "11101",
        neighborhood: "Queens Plaza",
        listingType: "rent",
        price: 4200,
        priceLabel: "$4,200/mo",
        bedrooms: 1,
        bathrooms: 1,
      },
      assets: [],
    });

    const dashboard = await getListingStudioCompanyDashboard({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
    });
    const ownerListings = await listStudioListingPacks({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
    });

    assert.ok(ownerListings.some((item) => item.packId === imported.packId));
    assert.ok(!dashboard.items.some((item) => item.packId === imported.packId));
  } finally {
    await context.cleanup();
  }
});

test("company dashboard saves are idempotent and scoped to the viewer", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.adminMembership.id,
      title: "Published LIC",
      streetAddress: "10-50 Jackson Avenue",
      companyFeedVisible: true,
    });

    const firstSave = await saveStudioListingPackToMyListings({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
      packId: pack.packId,
    });
    const secondSave = await saveStudioListingPackToMyListings({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
      packId: pack.packId,
    });
    const teammateListings = await listStudioListingPacks({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
    });
    const ownerListings = await listStudioListingPacks({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
    });

    assert.deepEqual(firstSave, {
      saved: true,
      alreadySaved: false,
    });
    assert.deepEqual(secondSave, {
      saved: true,
      alreadySaved: true,
    });
    assert.ok(teammateListings.some((item) => item.packId === pack.packId));
    assert.equal(
      teammateListings.find((item) => item.packId === pack.packId)?.savedSource,
      "saved_from_dashboard",
    );
    assert.ok(!ownerListings.some((item) => item.packId === pack.packId));
  } finally {
    await context.cleanup();
  }
});

test("dashboard-saved listings can be removed from personal workspace and collections without deleting the shared pack", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.adminMembership.id,
      title: "Shared Court Square",
      streetAddress: "27-01 Jackson Avenue",
      companyFeedVisible: true,
    });

    await saveStudioListingPackToMyListings({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
      packId: pack.packId,
    });

    const collection = await createStudioListingCollection({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.teammateMembership.id,
      name: "Shared shortlist",
      initialPackId: pack.packId,
    });
    assert.ok(collection);
    assert.equal(collection?.listingCount, 1);

    const removed = await removeStudioListingPackFromMyListings({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
      packId: pack.packId,
    });

    assert.deepEqual(removed, {
      removed: true,
      removedCollectionCount: 1,
    });

    const teammateListings = await listStudioListingPacks({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
    });
    assert.ok(!teammateListings.some((item) => item.packId === pack.packId));

    const collectionAfterRemoval = await getStudioListingCollectionDetail({
      organizationId: context.organization.id,
      membershipId: context.teammateMembership.id,
      collectionId: collection?.id ?? "",
    });
    assert.equal(collectionAfterRemoval?.listingCount, 0);

    const dashboard = await getListingStudioCompanyDashboard({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
    });
    assert.ok(dashboard.items.some((item) => item.packId === pack.packId));

    await assert.rejects(
      () =>
        removeStudioListingPackFromMyListings({
          organizationId: context.organization.id,
          membershipId: context.adminMembership.id,
          packId: pack.packId,
        }),
      /Only company dashboard listings can be removed from My listings\./,
    );
  } finally {
    await context.cleanup();
  }
});

test("company dashboard only returns packs currently published to the feed", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const visiblePack = await context.createPack({
      membershipId: context.adminMembership.id,
      title: "Visible Pack",
      streetAddress: "21 India Street",
      companyFeedVisible: true,
    });
    const hiddenPack = await context.createPack({
      membershipId: context.adminMembership.id,
      title: "Hidden Pack",
      streetAddress: "5 Pointz Lane",
    });

    const published = await updateStudioListingPack({
      organizationId: context.organization.id,
      membershipId: context.adminMembership.id,
      packId: hiddenPack.packId,
      companyFeedVisible: true,
      companyFeedLabel: "Acre Exclusive",
    });
    assert.equal(published?.pack.companyFeedVisible, true);
    assert.equal(published?.pack.companyFeedLabel, "Acre Exclusive");

    const dashboardAfterPublish = await getListingStudioCompanyDashboard({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
    });
    assert.ok(
      dashboardAfterPublish.items.some((item) => item.packId === visiblePack.packId),
    );
    assert.ok(
      dashboardAfterPublish.items.some((item) => item.packId === hiddenPack.packId),
    );
    assert.equal(
      dashboardAfterPublish.items.find((item) => item.packId === hiddenPack.packId)
        ?.companyFeedLabel,
      "Acre Exclusive",
    );

    const unpublished = await updateStudioListingPack({
      organizationId: context.organization.id,
      membershipId: context.adminMembership.id,
      packId: hiddenPack.packId,
      companyFeedVisible: false,
    });
    assert.equal(unpublished?.pack.companyFeedVisible, false);
    assert.equal(unpublished?.pack.companyFeedLabel, "Acre Exclusive");

    const dashboardAfterUnpublish = await getListingStudioCompanyDashboard({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
    });
    assert.ok(
      dashboardAfterUnpublish.items.some(
        (item) => item.packId === visiblePack.packId,
      ),
    );
    assert.ok(
      !dashboardAfterUnpublish.items.some(
        (item) => item.packId === hiddenPack.packId,
      ),
    );
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

test("publishing a collection mints a high-entropy share code", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Collection Share Draft",
      streetAddress: "24-16 Jackson Avenue",
      latitude: 40.7448,
      longitude: -73.9494,
    });

    const collection = await createStudioListingCollection({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.ownerMembership.id,
      name: "For Sharing",
      initialPackId: pack.packId,
    });

    const published = await publishStudioListingCollection({
      organizationId: context.organization.id,
      collectionId: collection?.id ?? "",
      membershipId: context.ownerMembership.id,
    });

    assert.ok(published);
    assert.match(
      published?.shareCode ?? "",
      /^collection_[A-Za-z0-9_-]{32}$/,
    );
  } finally {
    await context.cleanup();
  }
});

test("public collection lookup returns current shared listings", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const firstPack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Court Square One",
      streetAddress: "43-10 Crescent Street",
      latitude: 40.7497,
      longitude: -73.9421,
    });
    const secondPack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Court Square Two",
      streetAddress: "27-19 Thomson Avenue",
      latitude: 40.7459,
      longitude: -73.9432,
    });

    const collection = await createStudioListingCollection({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.ownerMembership.id,
      name: "For Client",
      initialPackId: firstPack.packId,
    });
    await addStudioListingPackToCollection({
      organizationId: context.organization.id,
      membershipId: context.ownerMembership.id,
      collectionId: collection?.id ?? "",
      packId: secondPack.packId,
    });

    const published = await publishStudioListingCollection({
      organizationId: context.organization.id,
      collectionId: collection?.id ?? "",
      membershipId: context.ownerMembership.id,
    });

    const snapshot = await getStudioListingPublicCollection({
      shareCode: published?.shareCode ?? "",
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.name, "For Client");
    assert.equal(snapshot?.listingCount, 2);
    assert.equal(snapshot?.listings.length, 2);
    assert.ok(
      snapshot?.listings.some((item) => item.packId === firstPack.packId),
    );
    assert.ok(
      snapshot?.listings.some((item) => item.packId === secondPack.packId),
    );
  } finally {
    await context.cleanup();
  }
});

test("legacy share codes resolve public packs during the rotation window", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Legacy Share Window",
      streetAddress: "12-10 Jackson Avenue",
      latitude: 40.7445,
      longitude: -73.9481,
    });
    const legacyShareCodeExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.studioListingPack.update({
      where: { id: pack.packId },
      data: {
        shareEnabled: true,
        shareCode: "pack_12345678901234567890123456789012",
        legacyShareCode: "oldweak",
        legacyShareCodeExpiresAt,
      },
    });

    const snapshot = await getStudioListingPublicPack({
      shareCode: "oldweak",
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.usesLegacyShareCode, true);
    assert.equal(
      snapshot?.legacyShareCodeExpiresAt?.getTime(),
      legacyShareCodeExpiresAt.getTime(),
    );
  } finally {
    await context.cleanup();
  }
});

test("expired legacy share codes do not resolve public packs", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Expired Legacy Share",
      streetAddress: "45-22 Vernon Boulevard",
      latitude: 40.7501,
      longitude: -73.9403,
    });

    await prisma.studioListingPack.update({
      where: { id: pack.packId },
      data: {
        shareEnabled: true,
        shareCode: "pack_abcdefghijklmnopqrstuvwx12345678",
        legacyShareCode: "oldweak-expired",
        legacyShareCodeExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const snapshot = await getStudioListingPublicPack({
      shareCode: "oldweak-expired",
    });

    assert.equal(snapshot, null);
  } finally {
    await context.cleanup();
  }
});

test("public pack lookup prefers the current share code over legacy metadata", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Current Share Priority",
      streetAddress: "27-01 39th Avenue",
      latitude: 40.7513,
      longitude: -73.9375,
    });
    const legacyShareCodeExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.studioListingPack.update({
      where: { id: pack.packId },
      data: {
        shareEnabled: true,
        shareCode: "pack_priority1234567890123456789012",
        legacyShareCode: "oldweak-priority",
        legacyShareCodeExpiresAt,
      },
    });

    const snapshot = await getStudioListingPublicPack({
      shareCode: "pack_priority1234567890123456789012",
    });

    assert.ok(snapshot);
    assert.equal(snapshot?.usesLegacyShareCode, false);
    assert.equal(snapshot?.legacyShareCodeExpiresAt, null);
  } finally {
    await context.cleanup();
  }
});

test("legacy share codes continue to authorize public asset reads during the rotation window", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Legacy Asset Share",
      streetAddress: "30-10 41st Avenue",
      latitude: 40.7504,
      longitude: -73.9428,
    });

    const asset = await prisma.studioListingAsset.create({
      data: {
        organizationId: context.organization.id,
        snapshotId: pack.snapshotId,
        kind: StudioListingAssetKind.gallery,
        label: "Front exterior",
        storageKey: `test/studio-assets/${randomUUID()}.jpg`,
        mimeType: "image/jpeg",
        fileName: "front-exterior.jpg",
        fileSizeBytes: 4096,
        sortOrder: 0,
      },
    });

    await prisma.studioListingPack.update({
      where: { id: pack.packId },
      data: {
        shareEnabled: true,
        shareCode: "pack_asset12345678901234567890123456",
        legacyShareCode: "oldweak-asset",
        legacyShareCodeExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const record = await getStudioListingAssetRecord({
      assetId: asset.id,
      shareCode: "oldweak-asset",
    });

    assert.ok(record);
    assert.equal(record?.id, asset.id);
  } finally {
    await context.cleanup();
  }
});

test("collection share codes authorize public asset reads", async () => {
  const context = await createStudioListingsTestContext();

  try {
    const pack = await context.createPack({
      membershipId: context.ownerMembership.id,
      title: "Collection Asset Share",
      streetAddress: "5-33 47th Road",
      latitude: 40.7445,
      longitude: -73.9522,
    });

    const asset = await prisma.studioListingAsset.create({
      data: {
        organizationId: context.organization.id,
        snapshotId: pack.snapshotId,
        kind: StudioListingAssetKind.hero,
        label: "Hero",
        storageKey: `test/studio-assets/${randomUUID()}.jpg`,
        mimeType: "image/jpeg",
        fileName: "hero.jpg",
        fileSizeBytes: 4096,
        sortOrder: 0,
      },
    });

    await prisma.studioListingPack.update({
      where: { id: pack.packId },
      data: {
        coverAssetId: asset.id,
        selectedAssetIdsJson: [asset.id],
      },
    });

    const collection = await createStudioListingCollection({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.ownerMembership.id,
      name: "Asset Collection",
      initialPackId: pack.packId,
    });

    const published = await publishStudioListingCollection({
      organizationId: context.organization.id,
      collectionId: collection?.id ?? "",
      membershipId: context.ownerMembership.id,
    });

    const record = await getStudioListingAssetRecord({
      assetId: asset.id,
      shareCode: published?.shareCode ?? "",
    });

    assert.ok(record);
    assert.equal(record?.id, asset.id);
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
