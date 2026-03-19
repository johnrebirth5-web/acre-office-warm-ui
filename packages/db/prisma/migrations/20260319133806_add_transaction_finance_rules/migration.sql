-- CreateEnum
CREATE TYPE "TransactionFinanceFeeType" AS ENUM (
    'rebate',
    'client_referral',
    'external_referral',
    'company_referral',
    'channel_development_fee',
    'reimbursement'
);

-- CreateEnum
CREATE TYPE "TransactionFinanceCalculationType" AS ENUM (
    'pre_split',
    'post_split',
    'reimbursement'
);

-- CreateEnum
CREATE TYPE "TransactionFinanceApprovalStatus" AS ENUM (
    'not_required',
    'pending',
    'approved'
);

-- CreateEnum
CREATE TYPE "TransactionFinanceVersionSource" AS ENUM (
    'calculated',
    'overridden'
);

-- AlterTable
ALTER TABLE "Transaction"
ADD COLUMN "clientReferralFormApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rebateAgreementSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rebateGoogleFormSubmitted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CommissionCalculation"
ADD COLUMN "transactionFinanceCalculationVersionId" TEXT;

-- CreateTable
CREATE TABLE "TransactionFinanceFee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "transactionId" TEXT NOT NULL,
    "feeType" "TransactionFinanceFeeType" NOT NULL,
    "defaultRate" DECIMAL(5,2),
    "rate" DECIMAL(5,2),
    "amount" DECIMAL(12,2),
    "defaultCalculationType" "TransactionFinanceCalculationType" NOT NULL,
    "selectedCalculationType" "TransactionFinanceCalculationType" NOT NULL,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "TransactionFinanceApprovalStatus" NOT NULL DEFAULT 'not_required',
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionFinanceFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionFinanceCalculationVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "transactionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sourceType" "TransactionFinanceVersionSource" NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "grossCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preSplitTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "postSplitTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netCommissionBase" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reimbursementAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalAgentNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalOfficeNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "feeBreakdown" JSONB,
    "stakeholderBreakdown" JSONB,
    "blockingIssues" JSONB,
    "notes" TEXT,
    "overrideReason" TEXT,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionFinanceCalculationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionFinanceFee_transactionId_feeType_key"
ON "TransactionFinanceFee"("transactionId", "feeType");

-- CreateIndex
CREATE INDEX "TransactionFinanceFee_organizationId_officeId_feeType_idx"
ON "TransactionFinanceFee"("organizationId", "officeId", "feeType");

-- CreateIndex
CREATE INDEX "TransactionFinanceFee_organizationId_transactionId_idx"
ON "TransactionFinanceFee"("organizationId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionFinanceCalculationVersion_transactionId_versionNumber_key"
ON "TransactionFinanceCalculationVersion"("transactionId", "versionNumber");

-- CreateIndex
CREATE INDEX "TransactionFinanceCalculationVersion_organizationId_officeId_isCurrent_idx"
ON "TransactionFinanceCalculationVersion"("organizationId", "officeId", "isCurrent");

-- CreateIndex
CREATE INDEX "TransactionFinanceCalculationVersion_organizationId_transactionId_isCurrent_idx"
ON "TransactionFinanceCalculationVersion"("organizationId", "transactionId", "isCurrent");

-- CreateIndex
CREATE INDEX "CommissionCalculation_organizationId_transactionFinanceCalculationVersionId_idx"
ON "CommissionCalculation"("organizationId", "transactionFinanceCalculationVersionId");

-- AddForeignKey
ALTER TABLE "TransactionFinanceFee"
ADD CONSTRAINT "TransactionFinanceFee_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFinanceFee"
ADD CONSTRAINT "TransactionFinanceFee_officeId_fkey"
FOREIGN KEY ("officeId") REFERENCES "Office"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFinanceFee"
ADD CONSTRAINT "TransactionFinanceFee_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFinanceFee"
ADD CONSTRAINT "TransactionFinanceFee_approvedByMembershipId_fkey"
FOREIGN KEY ("approvedByMembershipId") REFERENCES "Membership"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFinanceCalculationVersion"
ADD CONSTRAINT "TransactionFinanceCalculationVersion_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFinanceCalculationVersion"
ADD CONSTRAINT "TransactionFinanceCalculationVersion_officeId_fkey"
FOREIGN KEY ("officeId") REFERENCES "Office"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFinanceCalculationVersion"
ADD CONSTRAINT "TransactionFinanceCalculationVersion_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFinanceCalculationVersion"
ADD CONSTRAINT "TransactionFinanceCalculationVersion_createdByMembershipId_fkey"
FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCalculation"
ADD CONSTRAINT "CommissionCalculation_transactionFinanceCalculationVersionId_fkey"
FOREIGN KEY ("transactionFinanceCalculationVersionId") REFERENCES "TransactionFinanceCalculationVersion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
