-- CreateTable
CREATE TABLE "CommissionSplitTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "name" TEXT NOT NULL,
    "agentPercent" DECIMAL(7,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionSplitTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipCommissionSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "membershipId" TEXT NOT NULL,
    "splitTemplateId" TEXT,
    "agentPercent" DECIMAL(7,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipCommissionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionSplitTemplate_organizationId_officeId_isActive_idx" ON "CommissionSplitTemplate"("organizationId", "officeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSplitTemplate_organizationId_officeId_name_key" ON "CommissionSplitTemplate"("organizationId", "officeId", "name");

-- CreateIndex
CREATE INDEX "MembershipCommissionSetting_organizationId_officeId_members_idx" ON "MembershipCommissionSetting"("organizationId", "officeId", "membershipId");

-- CreateIndex
CREATE INDEX "MembershipCommissionSetting_organizationId_splitTempl_idx" ON "MembershipCommissionSetting"("organizationId", "splitTemplateId");

-- CreateIndex
CREATE INDEX "MembershipCommissionSetting_organizationId_membership_idx" ON "MembershipCommissionSetting"("organizationId", "membershipId", "effectiveFrom", "effectiveTo");

-- AddForeignKey
ALTER TABLE "CommissionSplitTemplate" ADD CONSTRAINT "CommissionSplitTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSplitTemplate" ADD CONSTRAINT "CommissionSplitTemplate_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCommissionSetting" ADD CONSTRAINT "MembershipCommissionSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCommissionSetting" ADD CONSTRAINT "MembershipCommissionSetting_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCommissionSetting" ADD CONSTRAINT "MembershipCommissionSetting_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCommissionSetting" ADD CONSTRAINT "MembershipCommissionSetting_splitTemplateId_fkey" FOREIGN KEY ("splitTemplateId") REFERENCES "CommissionSplitTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
