-- CreateEnum
CREATE TYPE "SignatureRecipientRole" AS ENUM ('signer', 'approver', 'cc');

-- CreateEnum
CREATE TYPE "SignatureRecipientStatus" AS ENUM ('draft', 'pending', 'sent', 'viewed', 'acted', 'declined', 'voided', 'expired');

-- CreateEnum
CREATE TYPE "SignatureTemplateCategory" AS ENUM ('hr', 'finance', 'admin', 'transaction');

-- CreateEnum
CREATE TYPE "SignatureContextType" AS ENUM ('transaction', 'membership', 'finance_request', 'admin_request', 'generic');

-- CreateEnum
CREATE TYPE "SignatureArtifactKind" AS ENUM ('original', 'signed_copy');

-- CreateEnum
CREATE TYPE "SignatureDriveSyncStatus" AS ENUM ('not_configured', 'pending', 'synced', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SignatureFieldType" ADD VALUE 'initials';
ALTER TYPE "SignatureFieldType" ADD VALUE 'email';
ALTER TYPE "SignatureFieldType" ADD VALUE 'title';
ALTER TYPE "SignatureFieldType" ADD VALUE 'company';
ALTER TYPE "SignatureFieldType" ADD VALUE 'checkbox';
ALTER TYPE "SignatureFieldType" ADD VALUE 'dropdown';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SignatureRequestStatus" ADD VALUE 'pending_send';
ALTER TYPE "SignatureRequestStatus" ADD VALUE 'voided';

-- AlterTable
ALTER TABLE "SignatureField" ADD COLUMN     "assignedRecipientId" TEXT,
ADD COLUMN     "fieldKey" TEXT,
ADD COLUMN     "fieldOptions" JSONB,
ADD COLUMN     "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSystemPrefilled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mirrorGroup" TEXT,
ADD COLUMN     "visibilityRule" JSONB;

-- AlterTable
ALTER TABLE "SignatureRequest" ADD COLUMN     "contextId" TEXT,
ADD COLUMN     "contextLabel" TEXT,
ADD COLUMN     "contextType" "SignatureContextType" NOT NULL DEFAULT 'transaction',
ADD COLUMN     "driveFileId" TEXT,
ADD COLUMN     "driveFolderId" TEXT,
ADD COLUMN     "driveSyncError" TEXT,
ADD COLUMN     "driveSyncStatus" "SignatureDriveSyncStatus" NOT NULL DEFAULT 'not_configured',
ADD COLUMN     "driveSyncedAt" TIMESTAMP(3),
ADD COLUMN     "subjectMembershipId" TEXT,
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "OrganizationSignatureDriveSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "updatedByMembershipId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "clientEmail" TEXT,
    "clientId" TEXT,
    "privateKeyId" TEXT,
    "encryptedPrivateKey" TEXT,
    "sharedDriveId" TEXT,
    "rootFolderId" TEXT,
    "folderMappings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSignatureDriveSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "category" "SignatureTemplateCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "senderDisplayName" TEXT,
    "senderReplyTo" TEXT,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureTemplateRecipient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "templateId" TEXT NOT NULL,
    "role" "SignatureRecipientRole" NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "defaultNameSource" TEXT,
    "defaultEmailSource" TEXT,
    "routingStep" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureTemplateRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureTemplateField" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "templateId" TEXT NOT NULL,
    "assignedTemplateRecipientId" TEXT,
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
    "fieldKey" TEXT,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "isSystemPrefilled" BOOLEAN NOT NULL DEFAULT false,
    "visibilityRule" JSONB,
    "mirrorGroup" TEXT,
    "fieldOptions" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureTemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRecipient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "transactionId" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "membershipId" TEXT,
    "role" "SignatureRecipientRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "routingStep" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SignatureRecipientStatus" NOT NULL DEFAULT 'draft',
    "tokenHash" TEXT,
    "submittedValues" JSONB,
    "sentAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "actedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureArtifact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "transactionId" TEXT,
    "subjectMembershipId" TEXT,
    "offerId" TEXT,
    "signatureRequestId" TEXT NOT NULL,
    "transactionDocumentId" TEXT,
    "kind" "SignatureArtifactKind" NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT,
    "driveSyncStatus" "SignatureDriveSyncStatus" NOT NULL DEFAULT 'not_configured',
    "driveSyncError" TEXT,
    "driveSyncedAt" TIMESTAMP(3),
    "driveFolderId" TEXT,
    "driveFileId" TEXT,
    "driveWebViewLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSignatureDriveSetting_organizationId_key" ON "OrganizationSignatureDriveSetting"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationSignatureDriveSetting_organizationId_isEnabled_idx" ON "OrganizationSignatureDriveSetting"("organizationId", "isEnabled");

-- CreateIndex
CREATE INDEX "SignatureTemplate_organizationId_officeId_category_isActive_idx" ON "SignatureTemplate"("organizationId", "officeId", "category", "isActive");

-- CreateIndex
CREATE INDEX "SignatureTemplateRecipient_organizationId_templateId_sortOr_idx" ON "SignatureTemplateRecipient"("organizationId", "templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "SignatureTemplateField_organizationId_templateId_sortOrder_idx" ON "SignatureTemplateField"("organizationId", "templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRecipient_tokenHash_key" ON "SignatureRecipient"("tokenHash");

-- CreateIndex
CREATE INDEX "SignatureRecipient_organizationId_transactionId_signatureRe_idx" ON "SignatureRecipient"("organizationId", "transactionId", "signatureRequestId", "sortOrder");

-- CreateIndex
CREATE INDEX "SignatureRecipient_organizationId_email_idx" ON "SignatureRecipient"("organizationId", "email");

-- CreateIndex
CREATE INDEX "SignatureRecipient_organizationId_membershipId_idx" ON "SignatureRecipient"("organizationId", "membershipId");

-- CreateIndex
CREATE INDEX "SignatureArtifact_organizationId_signatureRequestId_kind_idx" ON "SignatureArtifact"("organizationId", "signatureRequestId", "kind");

-- CreateIndex
CREATE INDEX "SignatureArtifact_organizationId_driveSyncStatus_idx" ON "SignatureArtifact"("organizationId", "driveSyncStatus");

-- CreateIndex
CREATE INDEX "SignatureRequest_organizationId_subjectMembershipId_idx" ON "SignatureRequest"("organizationId", "subjectMembershipId");

-- CreateIndex
CREATE INDEX "SignatureRequest_organizationId_templateId_idx" ON "SignatureRequest"("organizationId", "templateId");

-- AddForeignKey
ALTER TABLE "OrganizationSignatureDriveSetting" ADD CONSTRAINT "OrganizationSignatureDriveSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSignatureDriveSetting" ADD CONSTRAINT "OrganizationSignatureDriveSetting_updatedByMembershipId_fkey" FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplate" ADD CONSTRAINT "SignatureTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplate" ADD CONSTRAINT "SignatureTemplate_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplate" ADD CONSTRAINT "SignatureTemplate_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplateRecipient" ADD CONSTRAINT "SignatureTemplateRecipient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplateRecipient" ADD CONSTRAINT "SignatureTemplateRecipient_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplateRecipient" ADD CONSTRAINT "SignatureTemplateRecipient_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplateField" ADD CONSTRAINT "SignatureTemplateField_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplateField" ADD CONSTRAINT "SignatureTemplateField_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplateField" ADD CONSTRAINT "SignatureTemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplateField" ADD CONSTRAINT "SignatureTemplateField_assignedTemplateRecipientId_fkey" FOREIGN KEY ("assignedTemplateRecipientId") REFERENCES "SignatureTemplateRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_subjectMembershipId_fkey" FOREIGN KEY ("subjectMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecipient" ADD CONSTRAINT "SignatureRecipient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecipient" ADD CONSTRAINT "SignatureRecipient_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecipient" ADD CONSTRAINT "SignatureRecipient_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecipient" ADD CONSTRAINT "SignatureRecipient_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecipient" ADD CONSTRAINT "SignatureRecipient_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_assignedRecipientId_fkey" FOREIGN KEY ("assignedRecipientId") REFERENCES "SignatureRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_subjectMembershipId_fkey" FOREIGN KEY ("subjectMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_transactionDocumentId_fkey" FOREIGN KEY ("transactionDocumentId") REFERENCES "TransactionDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

