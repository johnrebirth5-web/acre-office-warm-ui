CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "StudioListingSavedPackSource" AS ENUM ('imported_by_me', 'saved_from_dashboard');

-- AlterTable
ALTER TABLE "StudioListingPack"
ADD COLUMN "companyFeedVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "companyFeedPublishedAt" TIMESTAMP(3),
ADD COLUMN "companyFeedPublishedByMembershipId" TEXT;

-- CreateTable
CREATE TABLE "StudioListingSavedPack" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "source" "StudioListingSavedPackSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioListingSavedPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioListingPack_organizationId_companyFeedVisible_updatedAt_idx"
ON "StudioListingPack"("organizationId", "companyFeedVisible", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudioListingSavedPack_membershipId_packId_key"
ON "StudioListingSavedPack"("membershipId", "packId");

-- CreateIndex
CREATE INDEX "StudioListingSavedPack_organizationId_membershipId_createdAt_idx"
ON "StudioListingSavedPack"("organizationId", "membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "StudioListingSavedPack_organizationId_packId_createdAt_idx"
ON "StudioListingSavedPack"("organizationId", "packId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudioListingPack"
ADD CONSTRAINT "StudioListingPack_companyFeedPublishedByMembershipId_fkey"
FOREIGN KEY ("companyFeedPublishedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingSavedPack"
ADD CONSTRAINT "StudioListingSavedPack_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingSavedPack"
ADD CONSTRAINT "StudioListingSavedPack_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioListingSavedPack"
ADD CONSTRAINT "StudioListingSavedPack_packId_fkey"
FOREIGN KEY ("packId") REFERENCES "StudioListingPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill personal saved-pack membership rows from the original importer so
-- historical packets remain visible to the member who created them.
INSERT INTO "StudioListingSavedPack" (
    "id",
    "organizationId",
    "membershipId",
    "packId",
    "source",
    "createdAt"
)
SELECT
    gen_random_uuid()::text,
    pack."organizationId",
    import."createdByMembershipId",
    pack."id",
    'imported_by_me'::"StudioListingSavedPackSource",
    COALESCE(import."createdAt", pack."createdAt")
FROM "StudioListingPack" AS pack
JOIN "StudioListingSnapshot" AS snapshot
  ON snapshot."id" = pack."snapshotId"
JOIN "StudioListingImport" AS import
  ON import."id" = snapshot."importId"
LEFT JOIN "StudioListingSavedPack" AS existing
  ON existing."membershipId" = import."createdByMembershipId"
 AND existing."packId" = pack."id"
WHERE existing."id" IS NULL;

-- Backfill the new company-feed permission into persisted role templates so
-- existing organizations keep owner/admin parity with the code-level defaults.
INSERT INTO "OrganizationRoleTemplatePermission" (
    "id",
    "organizationId",
    "organizationRoleTemplateId",
    "permissionKey",
    "createdAt",
    "updatedAt"
)
SELECT
    'lstcfperm_' || md5(template."organizationId" || ':' || template."id" || ':' || mapped."permissionKey"),
    template."organizationId",
    template."id",
    mapped."permissionKey",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "OrganizationRoleTemplate" AS template
JOIN (
    VALUES
        ('owner', 'listing_studio:company_manage'),
        ('office_admin', 'listing_studio:company_manage')
) AS mapped("role", "permissionKey")
  ON template."role" = mapped."role"::"UserRole"
LEFT JOIN "OrganizationRoleTemplatePermission" AS existing
  ON existing."organizationRoleTemplateId" = template."id"
 AND existing."permissionKey" = mapped."permissionKey"
WHERE existing."id" IS NULL;
