ALTER TABLE "StudioListingCollection"
ADD COLUMN "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shareCode" TEXT;

CREATE UNIQUE INDEX "StudioListingCollection_shareCode_key"
ON "StudioListingCollection"("shareCode");

CREATE INDEX "StudioListingCollection_organizationId_shareEnabled_updatedAt_idx"
ON "StudioListingCollection"("organizationId", "shareEnabled", "updatedAt");
