CREATE TYPE "AgentPayoutStatementQuickBooksBillStatus" AS ENUM ('not_posted', 'posted', 'failed');

ALTER TABLE "AgentProfile"
ADD COLUMN "quickBooksVendorId" TEXT;

ALTER TABLE "AgentPayoutStatement"
ADD COLUMN "quickBooksBillStatus" "AgentPayoutStatementQuickBooksBillStatus" NOT NULL DEFAULT 'not_posted',
ADD COLUMN "quickBooksBillId" TEXT,
ADD COLUMN "quickBooksBillDocNumber" TEXT,
ADD COLUMN "quickBooksBillPostedAt" TIMESTAMP(3),
ADD COLUMN "quickBooksBillRequestId" TEXT,
ADD COLUMN "quickBooksBillSyncError" TEXT,
ADD COLUMN "quickBooksBillAccountingTransactionId" TEXT;

CREATE INDEX "AgentPayoutStatement_org_qbBillStatus_generatedAt_idx"
ON "AgentPayoutStatement"("organizationId", "quickBooksBillStatus", "generatedAt");
