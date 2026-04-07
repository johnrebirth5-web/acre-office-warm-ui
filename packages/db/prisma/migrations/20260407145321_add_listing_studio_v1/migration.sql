-- CreateEnum
CREATE TYPE "StudioListingSourceSite" AS ENUM ('streeteasy', 'zillow');

-- CreateEnum
CREATE TYPE "StudioListingImportStatus" AS ENUM ('received', 'parsing', 'downloading_assets', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "StudioListingAssetKind" AS ENUM ('hero', 'gallery', 'floor_plan', 'map', 'other');

-- CreateEnum
CREATE TYPE "StudioListingPackStatus" AS ENUM ('draft', 'ready', 'shared', 'archived');

-- CreateEnum
CREATE TYPE "StudioExtensionChallengeStatus" AS ENUM ('pending', 'approved', 'consumed', 'expired');

-- CreateTable
CREATE TABLE "StudioListingImport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "createdByMembershipId" TEXT NOT NULL,
    "sourceSite" "StudioListingSourceSite" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceListingId" TEXT,
    "status" "StudioListingImportStatus" NOT NULL DEFAULT 'received',
    "failureReason" TEXT,
    "diagnosticsJson" JSONB,
    "rawHtmlStorageKey" TEXT,
    "rawJsonStorageKey" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioListingImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioListingSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "importId" TEXT NOT NULL,
    "sourceSite" "StudioListingSourceSite" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceListingId" TEXT,
    "title" TEXT NOT NULL,
    "listingType" TEXT,
    "statusLabel" TEXT,
    "price" DECIMAL(12,2),
    "priceLabel" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "streetAddress" TEXT,
    "unit" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "borough" TEXT,
    "neighborhood" TEXT,
    "buildingName" TEXT,
    "bedrooms" DECIMAL(4,1),
    "bathrooms" DECIMAL(4,1),
    "rooms" DECIMAL(4,1),
    "sqft" INTEGER,
    "availabilityLabel" TEXT,
    "descriptionText" TEXT,
    "heroFactsJson" JSONB,
    "amenitiesJson" JSONB,
    "transitJson" JSONB,
    "floorPlanJson" JSONB,
    "propertyHistoryJson" JSONB,
    "rawParsedJson" JSONB,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioListingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioListingAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "kind" "StudioListingAssetKind" NOT NULL DEFAULT 'gallery',
    "label" TEXT,
    "originalUrl" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioListingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioListingPack" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "snapshotId" TEXT NOT NULL,
    "updatedByMembershipId" TEXT,
    "status" "StudioListingPackStatus" NOT NULL DEFAULT 'draft',
    "headline" TEXT,
    "summary" TEXT,
    "bulletPointsJson" JSONB,
    "selectedAssetIdsJson" JSONB,
    "coverAssetId" TEXT,
    "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shareCode" TEXT,
    "agentNote" TEXT,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "pdfStorageKey" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioListingPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioListingShareEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "shareCode" TEXT NOT NULL,
    "viewerFingerprint" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "ipAddressHash" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioListingShareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioListingExtensionToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "membershipId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "label" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioListingExtensionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioListingExtensionChallenge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "officeId" TEXT,
    "approvedByMembershipId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "StudioExtensionChallengeStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioListingExtensionChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioListingImport_organizationId_createdByMembershipId_createdAt_idx" ON "StudioListingImport"("organizationId", "createdByMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "StudioListingImport_organizationId_sourceSite_status_createdAt_idx" ON "StudioListingImport"("organizationId", "sourceSite", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudioListingSnapshot_importId_key" ON "StudioListingSnapshot"("importId");

-- CreateIndex
CREATE INDEX "StudioListingSnapshot_organizationId_sourceSite_createdAt_idx" ON "StudioListingSnapshot"("organizationId", "sourceSite", "createdAt");

-- CreateIndex
CREATE INDEX "StudioListingSnapshot_organizationId_city_neighborhood_idx" ON "StudioListingSnapshot"("organizationId", "city", "neighborhood");

-- CreateIndex
CREATE INDEX "StudioListingAsset_organizationId_snapshotId_sortOrder_idx" ON "StudioListingAsset"("organizationId", "snapshotId", "sortOrder");

-- CreateIndex
CREATE INDEX "StudioListingAsset_organizationId_kind_createdAt_idx" ON "StudioListingAsset"("organizationId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudioListingPack_snapshotId_key" ON "StudioListingPack"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "StudioListingPack_shareCode_key" ON "StudioListingPack"("shareCode");

-- CreateIndex
CREATE INDEX "StudioListingPack_organizationId_status_updatedAt_idx" ON "StudioListingPack"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "StudioListingPack_organizationId_shareEnabled_updatedAt_idx" ON "StudioListingPack"("organizationId", "shareEnabled", "updatedAt");

-- CreateIndex
CREATE INDEX "StudioListingShareEvent_organizationId_packId_openedAt_idx" ON "StudioListingShareEvent"("organizationId", "packId", "openedAt");

-- CreateIndex
CREATE INDEX "StudioListingShareEvent_organizationId_shareCode_openedAt_idx" ON "StudioListingShareEvent"("organizationId", "shareCode", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudioListingExtensionToken_tokenHash_key" ON "StudioListingExtensionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "StudioListingExtensionToken_organizationId_membershipId_createdAt_idx" ON "StudioListingExtensionToken"("organizationId", "membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "StudioListingExtensionToken_organizationId_expiresAt_revokedAt_idx" ON "StudioListingExtensionToken"("organizationId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudioListingExtensionChallenge_tokenHash_key" ON "StudioListingExtensionChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "StudioListingExtensionChallenge_status_expiresAt_idx" ON "StudioListingExtensionChallenge"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "StudioListingExtensionChallenge_organizationId_createdAt_idx" ON "StudioListingExtensionChallenge"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudioListingImport" ADD CONSTRAINT "StudioListingImport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingImport" ADD CONSTRAINT "StudioListingImport_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingImport" ADD CONSTRAINT "StudioListingImport_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingSnapshot" ADD CONSTRAINT "StudioListingSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingSnapshot" ADD CONSTRAINT "StudioListingSnapshot_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingSnapshot" ADD CONSTRAINT "StudioListingSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "StudioListingImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingAsset" ADD CONSTRAINT "StudioListingAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingAsset" ADD CONSTRAINT "StudioListingAsset_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StudioListingSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingPack" ADD CONSTRAINT "StudioListingPack_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingPack" ADD CONSTRAINT "StudioListingPack_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingPack" ADD CONSTRAINT "StudioListingPack_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StudioListingSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingPack" ADD CONSTRAINT "StudioListingPack_updatedByMembershipId_fkey" FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingShareEvent" ADD CONSTRAINT "StudioListingShareEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingShareEvent" ADD CONSTRAINT "StudioListingShareEvent_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StudioListingPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingExtensionToken" ADD CONSTRAINT "StudioListingExtensionToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingExtensionToken" ADD CONSTRAINT "StudioListingExtensionToken_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingExtensionToken" ADD CONSTRAINT "StudioListingExtensionToken_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingExtensionChallenge" ADD CONSTRAINT "StudioListingExtensionChallenge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingExtensionChallenge" ADD CONSTRAINT "StudioListingExtensionChallenge_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingExtensionChallenge" ADD CONSTRAINT "StudioListingExtensionChallenge_approvedByMembershipId_fkey" FOREIGN KEY ("approvedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
