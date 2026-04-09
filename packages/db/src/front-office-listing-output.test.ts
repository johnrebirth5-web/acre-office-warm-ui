import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import { Prisma } from "@prisma/client"
import { prisma } from "./client.ts"
import {
  createFrontOfficeListingShareLink,
  getFrontOfficeListingSharePageSnapshot,
} from "./front-office-listing-output.ts"

after(async () => {
  await prisma.$disconnect()
})

async function createListingShareTestContext() {
  const suffix = randomUUID().slice(0, 8)
  const organization = await prisma.organization.create({
    data: {
      name: `Listing Share Test ${suffix}`,
      slug: `listing-share-test-${suffix}`,
    },
  })

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Listing Share Office ${suffix}`,
      slug: `listing-share-office-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  })

  const user = await prisma.user.create({
    data: {
      email: `listing-share-agent-${suffix}@example.com`,
      firstName: "Listing",
      lastName: "Agent",
      phone: "2125550100",
      timezone: "America/New_York",
      locale: "en-US",
      isActive: true,
    },
  })

  const membership = await prisma.membership.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      userId: user.id,
      role: "agent",
      status: "active",
      title: "Front Office Agent",
      permissions: Prisma.JsonNull,
    },
  })

  const listing = await prisma.listing.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      ownerMembershipId: membership.id,
      title: `Tracked Share Listing ${suffix}`,
      slug: `tracked-share-listing-${suffix}`,
      sourceUrl: "https://example.com/listings/tracked-share",
      status: "active",
      price: 1250000,
      city: "Brooklyn",
      neighborhood: "Park Slope",
      bedrooms: 3,
      bathrooms: 2,
      isPublic: true,
      seoKeywords: [],
      aiSummary: "A listing prepared for tracked share regression coverage.",
    },
  })

  const trackedUserIds = [user.id]

  return {
    organization,
    office,
    membership,
    listing,
    async createClient() {
      return prisma.client.create({
        data: {
          organizationId: organization.id,
          ownerMembershipId: membership.id,
          fullName: `Share Client ${suffix}`,
          email: `share-client-${suffix}@example.com`,
          phone: "6465550199",
          source: "Regression test",
          stage: "Warm Lead",
          intent: "Buyer",
          preferredAreas: ["Park Slope"],
          additionalFields: Prisma.JsonNull,
        },
      })
    },
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id,
        },
      })

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds,
          },
        },
      })
    },
  }
}

test("generic listing shares return a public snapshot and increment click tracking", async () => {
  const context = await createListingShareTestContext()

  try {
    const share = await createFrontOfficeListingShareLink({
      organizationId: context.organization.id,
      officeId: context.office.id,
      viewerMembershipId: context.membership.id,
      listingId: context.listing.id,
      channel: "direct",
    })

    assert.match(share.sharePath, /^\/share\/listings\//)
    assert.equal(share.sendRecordId, null)

    const snapshot = await getFrontOfficeListingSharePageSnapshot(
      share.snapshot.shareLink.code,
    )

    assert.ok(snapshot)
    assert.equal(snapshot?.listingTitle, context.listing.title)
    assert.equal(snapshot?.shareSurfaceLabel, "Private listing share")
    assert.equal(snapshot?.trackingLabel, "Private share link only.")
    assert.equal(snapshot?.areaLabel, "Park Slope, Brooklyn")
    assert.equal(snapshot?.priceLabel, "$1,250,000")
    assert.match(snapshot?.agentLabel ?? "", /Listing Agent/)

    const storedShare = await prisma.listingShareLink.findUnique({
      where: {
        id: share.id,
      },
      select: {
        clickCount: true,
      },
    })

    assert.equal(storedShare?.clickCount, 1)
  } finally {
    await context.cleanup()
  }
})

test("client-bound listing shares create tracked send records and update opens from the public page", async () => {
  const context = await createListingShareTestContext()

  try {
    const client = await context.createClient()
    const share = await createFrontOfficeListingShareLink({
      organizationId: context.organization.id,
      officeId: context.office.id,
      viewerMembershipId: context.membership.id,
      listingId: context.listing.id,
      clientId: client.id,
      channel: "email",
    })

    assert.ok(share.sendRecordId)
    assert.equal(share.context.clientId, client.id)
    assert.equal(share.context.mode, "client_dossier_context")

    const beforeOpen = await prisma.frontOfficeSendRecord.findUnique({
      where: {
        id: share.sendRecordId ?? "",
      },
      select: {
        openCount: true,
        firstOpenedAt: true,
        lastOpenedAt: true,
      },
    })

    assert.equal(beforeOpen?.openCount, 0)
    assert.equal(beforeOpen?.firstOpenedAt, null)
    assert.equal(beforeOpen?.lastOpenedAt, null)

    const snapshot = await getFrontOfficeListingSharePageSnapshot(
      share.snapshot.shareLink.code,
    )

    assert.ok(snapshot)
    assert.equal(snapshot?.shareSurfaceLabel, "Tracked client share")
    assert.equal(snapshot?.trackingLabel, "Tracked via Email.")

    const storedSendRecord = await prisma.frontOfficeSendRecord.findUnique({
      where: {
        id: share.sendRecordId ?? "",
      },
      select: {
        clientId: true,
        openCount: true,
        firstOpenedAt: true,
        lastOpenedAt: true,
      },
    })

    assert.equal(storedSendRecord?.clientId, client.id)
    assert.equal(storedSendRecord?.openCount, 1)
    assert.ok(storedSendRecord?.firstOpenedAt)
    assert.ok(storedSendRecord?.lastOpenedAt)
  } finally {
    await context.cleanup()
  }
})
