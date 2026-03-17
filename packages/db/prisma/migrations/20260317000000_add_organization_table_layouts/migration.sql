-- CreateTable
CREATE TABLE "OrganizationTableLayout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "updatedByMembershipId" TEXT,
    "tableKey" TEXT NOT NULL,
    "columnLayout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationTableLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationTableLayout_organizationId_idx" ON "OrganizationTableLayout"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationTableLayout_organizationId_tableKey_key" ON "OrganizationTableLayout"("organizationId", "tableKey");

-- AddForeignKey
ALTER TABLE "OrganizationTableLayout" ADD CONSTRAINT "OrganizationTableLayout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationTableLayout" ADD CONSTRAINT "OrganizationTableLayout_updatedByMembershipId_fkey" FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
