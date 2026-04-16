-- CreateTable
CREATE TABLE "StudioListingCollection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "createdByMembershipId" TEXT NOT NULL,
    "updatedByMembershipId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioListingCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioListingCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioListingCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudioListingCollection_organizationId_createdByMembershipId_nameNormalized_key" ON "StudioListingCollection"("organizationId", "createdByMembershipId", "nameNormalized");

-- CreateIndex
CREATE INDEX "StudioListingCollection_organizationId_createdByMembershipId_updatedAt_idx" ON "StudioListingCollection"("organizationId", "createdByMembershipId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudioListingCollectionItem_collectionId_packId_key" ON "StudioListingCollectionItem"("collectionId", "packId");

-- CreateIndex
CREATE INDEX "StudioListingCollectionItem_packId_createdAt_idx" ON "StudioListingCollectionItem"("packId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudioListingCollection" ADD CONSTRAINT "StudioListingCollection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingCollection" ADD CONSTRAINT "StudioListingCollection_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingCollection" ADD CONSTRAINT "StudioListingCollection_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingCollection" ADD CONSTRAINT "StudioListingCollection_updatedByMembershipId_fkey" FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingCollectionItem" ADD CONSTRAINT "StudioListingCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "StudioListingCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingCollectionItem" ADD CONSTRAINT "StudioListingCollectionItem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StudioListingPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
