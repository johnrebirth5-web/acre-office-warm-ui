-- CreateTable
CREATE TABLE "AgentOfficeProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "notes" TEXT,
    "licenseNumber" TEXT,
    "licenseState" TEXT,
    "expirationDate" TIMESTAMP(3),
    "onboardingStatus" "AgentOnboardingStatus",
    "internalExtension" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentOfficeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentOfficeProfile_membershipId_officeId_key"
ON "AgentOfficeProfile"("membershipId", "officeId");

-- CreateIndex
CREATE INDEX "AgentOfficeProfile_organizationId_officeId_idx"
ON "AgentOfficeProfile"("organizationId", "officeId");

-- CreateIndex
CREATE INDEX "AgentOfficeProfile_organizationId_membershipId_idx"
ON "AgentOfficeProfile"("organizationId", "membershipId");

-- CreateIndex
CREATE INDEX "AgentOfficeProfile_organizationId_officeId_membershipId_idx"
ON "AgentOfficeProfile"("organizationId", "officeId", "membershipId");

-- AddForeignKey
ALTER TABLE "AgentOfficeProfile"
ADD CONSTRAINT "AgentOfficeProfile_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOfficeProfile"
ADD CONSTRAINT "AgentOfficeProfile_officeId_fkey"
FOREIGN KEY ("officeId") REFERENCES "Office"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOfficeProfile"
ADD CONSTRAINT "AgentOfficeProfile_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one office-scoped profile row per existing membership-office scope so
-- shared legacy AgentProfile values become visible in each company context.
WITH "MembershipOfficeScope" AS (
    SELECT DISTINCT
        membership."organizationId",
        membership."id" AS "membershipId",
        membership."officeId"
    FROM "Membership" AS membership
    WHERE membership."officeId" IS NOT NULL

    UNION

    SELECT DISTINCT
        access."organizationId",
        access."membershipId",
        access."officeId"
    FROM "MembershipOfficeAccess" AS access
)
INSERT INTO "AgentOfficeProfile" (
    "id",
    "organizationId",
    "officeId",
    "membershipId",
    "notes",
    "licenseNumber",
    "licenseState",
    "expirationDate",
    "onboardingStatus",
    "internalExtension",
    "createdAt",
    "updatedAt"
)
SELECT
    'aop_' || md5(profile."membershipId" || ':' || scope."officeId"),
    profile."organizationId",
    scope."officeId",
    profile."membershipId",
    profile."notes",
    profile."licenseNumber",
    profile."licenseState",
    profile."startDate",
    profile."onboardingStatus",
    profile."internalExtension",
    profile."createdAt",
    profile."updatedAt"
FROM "AgentProfile" AS profile
JOIN "MembershipOfficeScope" AS scope
  ON scope."organizationId" = profile."organizationId"
 AND scope."membershipId" = profile."membershipId"
LEFT JOIN "AgentOfficeProfile" AS existing
  ON existing."membershipId" = profile."membershipId"
 AND existing."officeId" = scope."officeId"
WHERE existing."id" IS NULL;
