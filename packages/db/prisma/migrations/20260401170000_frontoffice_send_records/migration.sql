-- CreateEnum
CREATE TYPE "FrontOfficeSendChannel" AS ENUM ('sms', 'email', 'direct');

-- CreateEnum
CREATE TYPE "FrontOfficeSendMaterialType" AS ENUM ('listing_share');

-- CreateTable
CREATE TABLE "FrontOfficeSendRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "senderMembershipId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "listingId" TEXT,
    "shareLinkId" TEXT,
    "channel" "FrontOfficeSendChannel" NOT NULL,
    "materialType" "FrontOfficeSendMaterialType" NOT NULL DEFAULT 'listing_share',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontOfficeSendRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FrontOfficeSendRecord_shareLinkId_key" ON "FrontOfficeSendRecord"("shareLinkId");

-- CreateIndex
CREATE INDEX "FrontOfficeSendRecord_org_sender_sentAt_idx" ON "FrontOfficeSendRecord"("organizationId", "senderMembershipId", "sentAt");

-- CreateIndex
CREATE INDEX "FrontOfficeSendRecord_org_office_sentAt_idx" ON "FrontOfficeSendRecord"("organizationId", "officeId", "sentAt");

-- CreateIndex
CREATE INDEX "FrontOfficeSendRecord_org_client_sentAt_idx" ON "FrontOfficeSendRecord"("organizationId", "clientId", "sentAt");

-- CreateIndex
CREATE INDEX "FrontOfficeSendRecord_org_lastOpenedAt_idx" ON "FrontOfficeSendRecord"("organizationId", "lastOpenedAt");

-- AddForeignKey
ALTER TABLE "FrontOfficeSendRecord" ADD CONSTRAINT "FrontOfficeSendRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeSendRecord" ADD CONSTRAINT "FrontOfficeSendRecord_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeSendRecord" ADD CONSTRAINT "FrontOfficeSendRecord_senderMembershipId_fkey" FOREIGN KEY ("senderMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeSendRecord" ADD CONSTRAINT "FrontOfficeSendRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeSendRecord" ADD CONSTRAINT "FrontOfficeSendRecord_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeSendRecord" ADD CONSTRAINT "FrontOfficeSendRecord_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ListingShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
