import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import { Prisma } from "@prisma/client"
import { prisma } from "./client.ts"
import {
  createFrontOfficeListingShareLink,
  buildFrontOfficeListingUsagePulse,
  getFrontOfficeListingSharePageSnapshot,
  type FrontOfficeListingUsagePulseListing,
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

test("listing usage pulse surfaces explicit send trail and next move summaries", () => {
  const listings: FrontOfficeListingUsagePulseListing[] = [
    {
      id: "listing-a",
      title: "Quiet Trail Listing",
      areaLabel: "Park Slope, Brooklyn",
      summaryLabel: "A listing still waiting on its first click pulse.",
      priceLabel: "$1,250,000",
      cityLabel: "Brooklyn",
      statusLabel: "Active",
      statusTone: "warning",
      trackedClickCount: 0,
      trackedLinkCount: 1,
      latestTrackedShare: {
        modeLabel: "Client dossier context",
        channelLabel: "Email",
        sentAtLabel: "Apr 8, 2026",
        sentAtValue: "2026-04-08T14:00:00.000Z",
        trackingLabel: "Tracked via Email.",
        trackingStatus: "tracked_link_only",
        statusTone: "warning",
        writebackLabel: "Tracked link saved without client-linked writeback.",
        writebackScopeLabel: "Writeback scope stays on the selected client's Front Office dossier trail.",
        nextStepLabel: "Paste the email package into your mail client and send it manually.",
        clientLabel: "Follow Through Client",
        clientStageDisplayLabel: "Warm Lead",
        clientHref: "/agent/clients/client-a",
        appointmentLabel: null,
        appointmentWindowLabel: null,
        appointmentHref: null,
      },
    },
    {
      id: "listing-b",
      title: "Active Trail Listing",
      areaLabel: "Cobble Hill, Brooklyn",
      summaryLabel: "A listing that already has an engaged send trail.",
      priceLabel: "$1,900,000",
      cityLabel: "Brooklyn",
      statusLabel: "Active",
      statusTone: "accent",
      trackedClickCount: 1,
      trackedLinkCount: 2,
      latestTrackedShare: {
        modeLabel: "Appointment follow-through lane",
        channelLabel: "SMS",
        sentAtLabel: "Apr 8, 2026",
        sentAtValue: "2026-04-08T16:00:00.000Z",
        trackingLabel: "Tracked via SMS.",
        trackingStatus: "tracked_send_recorded",
        statusTone: "accent",
        writebackLabel: "Tracked link, send record, and AI acceptance trail saved.",
        writebackScopeLabel: "Writeback scope stays on the selected client and appointment, so reply pressure and appointment continuity remain on one trail.",
        nextStepLabel: "Paste the SMS package into your texting app and send it manually.",
        clientLabel: "Follow Through Client",
        clientStageDisplayLabel: "Warm Lead",
        clientHref: "/agent/clients/client-b",
        appointmentLabel: "Open House",
        appointmentWindowLabel: "ahead of the appointment window",
        appointmentHref: "/agent/calendar/appointments/appointment-b",
      },
    },
  ]

  const usagePulse = buildFrontOfficeListingUsagePulse(listings)

  assert.equal(usagePulse.sendTrailLabel, "Mixed send trail")
  assert.equal(usagePulse.quietTrailLabel, "1 quiet trail(s)")
  assert.equal(usagePulse.nextMoveLabel, "Rescue quiet trails")
  assert.equal(usagePulse.strongestTrail?.title, "Active Trail Listing")
  assert.equal(usagePulse.latestTrackedShare?.title, "Active Trail Listing")
  assert.match(usagePulse.sendTrailDescription, /quiet/)
  assert.match(usagePulse.nextMoveDescription, /quiet/i)
})
