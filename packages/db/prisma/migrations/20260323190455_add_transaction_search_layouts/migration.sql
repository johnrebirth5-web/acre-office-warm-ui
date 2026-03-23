-- CreateTable
CREATE TABLE "TransactionSearchLayout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "updatedByMembershipId" TEXT,
    "fieldLayout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionSearchLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionSearchLayout_organizationId_officeId_idx" ON "TransactionSearchLayout"("organizationId", "officeId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionSearchLayout_organizationId_officeId_key" ON "TransactionSearchLayout"("organizationId", "officeId");

-- RenameForeignKey
ALTER TABLE "CommissionCalculation" RENAME CONSTRAINT "CommissionCalculation_transactionFinanceCalculationVersionId_fk" TO "CommissionCalculation_transactionFinanceCalculationVersion_fkey";

-- AddForeignKey
ALTER TABLE "TransactionSearchLayout" ADD CONSTRAINT "TransactionSearchLayout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionSearchLayout" ADD CONSTRAINT "TransactionSearchLayout_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionSearchLayout" ADD CONSTRAINT "TransactionSearchLayout_updatedByMembershipId_fkey" FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CommissionCalculation_organizationId_transactionFinanceCalculat" RENAME TO "CommissionCalculation_organizationId_transactionFinanceCalc_idx";

-- RenameIndex
ALTER INDEX "MembershipCommissionSetting_organizationId_membership_idx" RENAME TO "MembershipCommissionSetting_organizationId_membershipId_eff_idx";

-- RenameIndex
ALTER INDEX "MembershipCommissionSetting_organizationId_splitTempl_idx" RENAME TO "MembershipCommissionSetting_organizationId_splitTemplateId_idx";

-- RenameIndex
ALTER INDEX "TransactionFinanceCalculationVersion_organizationId_officeId_is" RENAME TO "TransactionFinanceCalculationVersion_organizationId_officeI_idx";

-- RenameIndex
ALTER INDEX "TransactionFinanceCalculationVersion_organizationId_transaction" RENAME TO "TransactionFinanceCalculationVersion_organizationId_transac_idx";

-- RenameIndex
ALTER INDEX "TransactionFinanceCalculationVersion_transactionId_versionNumbe" RENAME TO "TransactionFinanceCalculationVersion_transactionId_versionN_key";
