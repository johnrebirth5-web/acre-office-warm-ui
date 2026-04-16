-- CreateTable
CREATE TABLE "MembershipOfficeAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipOfficeAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipOfficePermissionOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "effect" "PermissionOverrideEffect" NOT NULL,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipOfficePermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipOfficeAccess_organizationId_officeId_idx" ON "MembershipOfficeAccess"("organizationId", "officeId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipOfficeAccess_membershipId_officeId_key" ON "MembershipOfficeAccess"("membershipId", "officeId");

-- CreateIndex
CREATE INDEX "MembershipOfficePermissionOverride_organizationId_officeId__idx" ON "MembershipOfficePermissionOverride"("organizationId", "officeId", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipOfficePermissionOverride_membershipId_officeId_pe_key" ON "MembershipOfficePermissionOverride"("membershipId", "officeId", "permissionKey");

-- AddForeignKey
ALTER TABLE "MembershipOfficeAccess" ADD CONSTRAINT "MembershipOfficeAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOfficeAccess" ADD CONSTRAINT "MembershipOfficeAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOfficeAccess" ADD CONSTRAINT "MembershipOfficeAccess_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOfficeAccess" ADD CONSTRAINT "MembershipOfficeAccess_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOfficePermissionOverride" ADD CONSTRAINT "MembershipOfficePermissionOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOfficePermissionOverride" ADD CONSTRAINT "MembershipOfficePermissionOverride_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOfficePermissionOverride" ADD CONSTRAINT "MembershipOfficePermissionOverride_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOfficePermissionOverride" ADD CONSTRAINT "MembershipOfficePermissionOverride_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the Acre company scopes for existing databases before the new
-- company switcher starts querying office-based access rows.
WITH "AcreOrganizations" AS (
    SELECT "id"
    FROM "Organization"
    WHERE "slug" = 'acre'
)
UPDATE "Office" AS "legacyOffice"
SET
    "slug" = 'acre-ny-realty',
    "name" = 'Acre NY Realty',
    "market" = 'New York Sales',
    "isPrimary" = TRUE,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "AcreOrganizations" AS "organization"
WHERE "legacyOffice"."organizationId" = "organization"."id"
  AND "legacyOffice"."slug" = 'acre-ny'
  AND NOT EXISTS (
    SELECT 1
    FROM "Office" AS "currentOffice"
    WHERE "currentOffice"."organizationId" = "organization"."id"
      AND "currentOffice"."slug" = 'acre-ny-realty'
  );

UPDATE "Office"
SET
    "name" = 'Acre NY Realty',
    "market" = 'New York Sales',
    "isPrimary" = TRUE,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "organizationId" IN (
    SELECT "id"
    FROM "Organization"
    WHERE "slug" = 'acre'
)
  AND "slug" = 'acre-ny-realty';

INSERT INTO "Office" (
    "id",
    "organizationId",
    "name",
    "slug",
    "market",
    "isPrimary",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT("organization"."id", '_acre_ny_rental'),
    "organization"."id",
    'Acre NY Rental',
    'acre-ny-rental',
    'New York Rental',
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization" AS "organization"
WHERE "organization"."slug" = 'acre'
  AND NOT EXISTS (
    SELECT 1
    FROM "Office" AS "office"
    WHERE "office"."organizationId" = "organization"."id"
      AND "office"."slug" = 'acre-ny-rental'
  );

INSERT INTO "Office" (
    "id",
    "organizationId",
    "name",
    "slug",
    "market",
    "isPrimary",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT("organization"."id", '_acre_nj_llc'),
    "organization"."id",
    'Acre NJ LLC',
    'acre-nj-llc',
    'New Jersey',
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization" AS "organization"
WHERE "organization"."slug" = 'acre'
  AND NOT EXISTS (
    SELECT 1
    FROM "Office" AS "office"
    WHERE "office"."organizationId" = "organization"."id"
      AND "office"."slug" = 'acre-nj-llc'
  );
