-- CreateEnum
CREATE TYPE "AgentPayoutStatementPeriodBasis" AS ENUM ('calculated_at', 'closing_date');

-- CreateTable
CREATE TABLE "AgentPayoutStatement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "membershipId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodBasis" "AgentPayoutStatementPeriodBasis" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByMembershipId" TEXT,
    "lineItemCount" INTEGER NOT NULL DEFAULT 0,
    "totalStatementAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalGrossCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalOfficeNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAgentNet" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "AgentPayoutStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPayoutStatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "commissionCalculationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionLabel" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "closingDate" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "statusAtGeneration" "CommissionCalculationStatus" NOT NULL,
    "grossCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referralFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "officeNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "agentNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "statementAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "AgentPayoutStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentPayoutStatement_organizationId_officeId_generatedAt_idx" ON "AgentPayoutStatement"("organizationId", "officeId", "generatedAt");

-- CreateIndex
CREATE INDEX "AgentPayoutStatement_organizationId_membershipId_generatedA_idx" ON "AgentPayoutStatement"("organizationId", "membershipId", "generatedAt");

-- CreateIndex
CREATE INDEX "AgentPayoutStatement_organizationId_periodStart_periodEnd_idx" ON "AgentPayoutStatement"("organizationId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AgentPayoutStatementLine_statementId_idx" ON "AgentPayoutStatementLine"("statementId");

-- CreateIndex
CREATE INDEX "AgentPayoutStatementLine_commissionCalculationId_idx" ON "AgentPayoutStatementLine"("commissionCalculationId");

-- CreateIndex
CREATE INDEX "AgentPayoutStatementLine_transactionId_idx" ON "AgentPayoutStatementLine"("transactionId");

-- AddForeignKey
ALTER TABLE "AgentPayoutStatement" ADD CONSTRAINT "AgentPayoutStatement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayoutStatement" ADD CONSTRAINT "AgentPayoutStatement_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayoutStatement" ADD CONSTRAINT "AgentPayoutStatement_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayoutStatement" ADD CONSTRAINT "AgentPayoutStatement_generatedByMembershipId_fkey" FOREIGN KEY ("generatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayoutStatementLine" ADD CONSTRAINT "AgentPayoutStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "AgentPayoutStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
