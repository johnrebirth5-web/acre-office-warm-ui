-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "UserRole" ADD VALUE 'owner';
ALTER TYPE "UserRole" ADD VALUE 'accountant';
ALTER TYPE "UserRole" ADD VALUE 'human_resources';
ALTER TYPE "UserRole" ADD VALUE 'team_lead';

-- AlterTable
ALTER TABLE "TeamMembership" ADD COLUMN     "reportsToTeamMembershipId" TEXT;

-- CreateTable
CREATE TABLE "TransactionMembershipLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "transactionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'collaborator',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionMembershipLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionMembershipLink_organizationId_membershipId_idx" ON "TransactionMembershipLink"("organizationId", "membershipId");

-- CreateIndex
CREATE INDEX "TransactionMembershipLink_organizationId_transactionId_idx" ON "TransactionMembershipLink"("organizationId", "transactionId");

-- CreateIndex
CREATE INDEX "TransactionMembershipLink_organizationId_officeId_membershi_idx" ON "TransactionMembershipLink"("organizationId", "officeId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionMembershipLink_transactionId_membershipId_key" ON "TransactionMembershipLink"("transactionId", "membershipId");

-- CreateIndex
CREATE INDEX "TeamMembership_organizationId_teamId_reportsToTeamMembershi_idx" ON "TeamMembership"("organizationId", "teamId", "reportsToTeamMembershipId");

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_reportsToTeamMembershipId_fkey" FOREIGN KEY ("reportsToTeamMembershipId") REFERENCES "TeamMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMembershipLink" ADD CONSTRAINT "TransactionMembershipLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMembershipLink" ADD CONSTRAINT "TransactionMembershipLink_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMembershipLink" ADD CONSTRAINT "TransactionMembershipLink_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMembershipLink" ADD CONSTRAINT "TransactionMembershipLink_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "TransactionCustomFieldDefinition_organizationId_officeId_fieldK" RENAME TO "TransactionCustomFieldDefinition_organizationId_officeId_fi_key";

-- RenameIndex
ALTER INDEX "TransactionCustomFieldDefinition_organizationId_officeId_isVis_" RENAME TO "TransactionCustomFieldDefinition_organizationId_officeId_is_idx";
