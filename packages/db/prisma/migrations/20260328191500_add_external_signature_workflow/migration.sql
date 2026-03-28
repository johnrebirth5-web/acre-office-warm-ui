-- CreateEnum
CREATE TYPE "SignatureFieldType" AS ENUM ('signature', 'date', 'name', 'text');

-- CreateEnum
CREATE TYPE "SignatureAuditEventType" AS ENUM ('request_created', 'email_sent', 'link_opened', 'field_updated', 'signature_submitted', 'pdf_finalized', 'request_expired', 'request_canceled');

-- AlterEnum
ALTER TYPE "TransactionDocumentSource" ADD VALUE 'signature_output';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "SignatureRequestStatus" ADD VALUE 'completed';
ALTER TYPE "SignatureRequestStatus" ADD VALUE 'expired';

-- AlterTable
ALTER TABLE "SignatureRequest"
ADD COLUMN "canceledAt" TIMESTAMP(3),
ADD COLUMN "completedDocumentId" TEXT,
ADD COLUMN "emailBody" TEXT,
ADD COLUMN "emailSubject" TEXT,
ADD COLUMN "expiredAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "firstViewedAt" TIMESTAMP(3),
ADD COLUMN "publicTokenHash" TEXT,
ADD COLUMN "senderDisplayName" TEXT,
ADD COLUMN "senderReplyTo" TEXT,
ADD COLUMN "signedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SignatureField" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "fieldType" "SignatureFieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "defaultValue" TEXT,
    "fontStyle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureAuditEntry" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "eventType" "SignatureAuditEventType" NOT NULL,
    "actorMembershipId" TEXT,
    "actorLabel" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignatureField_signatureRequestId_sortOrder_idx" ON "SignatureField"("signatureRequestId", "sortOrder");

-- CreateIndex
CREATE INDEX "SignatureAuditEntry_signatureRequestId_createdAt_idx" ON "SignatureAuditEntry"("signatureRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "SignatureAuditEntry_actorMembershipId_idx" ON "SignatureAuditEntry"("actorMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_publicTokenHash_key" ON "SignatureRequest"("publicTokenHash");

-- CreateIndex
CREATE INDEX "SignatureRequest_organizationId_completedDocumentId_idx" ON "SignatureRequest"("organizationId", "completedDocumentId");

-- CreateIndex
CREATE INDEX "SignatureRequest_organizationId_expiresAt_idx" ON "SignatureRequest"("organizationId", "expiresAt");

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_completedDocumentId_fkey" FOREIGN KEY ("completedDocumentId") REFERENCES "TransactionDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAuditEntry" ADD CONSTRAINT "SignatureAuditEntry_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAuditEntry" ADD CONSTRAINT "SignatureAuditEntry_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
