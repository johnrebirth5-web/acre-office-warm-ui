-- CreateTable
CREATE TABLE "TransactionReportSearchLayout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "updatedByMembershipId" TEXT,
    "fieldLayout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionReportSearchLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionReportSearchLayout_organizationId_officeId_idx" ON "TransactionReportSearchLayout"("organizationId", "officeId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionReportSearchLayout_organizationId_officeId_key" ON "TransactionReportSearchLayout"("organizationId", "officeId");

-- AddForeignKey
ALTER TABLE "TransactionReportSearchLayout" ADD CONSTRAINT "TransactionReportSearchLayout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionReportSearchLayout" ADD CONSTRAINT "TransactionReportSearchLayout_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionReportSearchLayout" ADD CONSTRAINT "TransactionReportSearchLayout_updatedByMembershipId_fkey" FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
