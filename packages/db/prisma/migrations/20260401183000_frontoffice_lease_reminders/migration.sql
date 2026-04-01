-- AlterTable
ALTER TABLE "Client"
ADD COLUMN "leaseEndDate" TIMESTAMP(3),
ADD COLUMN "leaseReminderAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Client_organizationId_leaseReminderAt_idx"
ON "Client"("organizationId", "leaseReminderAt");
