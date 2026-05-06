-- CreateEnum
CREATE TYPE "HrCandidateStatus" AS ENUM ('applied', 'screening', 'interview_1', 'interview_2', 'offered', 'hired', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "HrIdentityType" AS ENUM ('f1_student', 'f1_opt', 'green_card', 'citizen', 'd1_cpt', 'h1b', 'o1');

-- CreateEnum
CREATE TYPE "HrSyncState" AS ENUM ('pending', 'synced', 'sync_failed', 'not_applicable');

-- CreateEnum
CREATE TYPE "HrInterviewMode" AS ENUM ('online', 'offline');

-- CreateEnum
CREATE TYPE "HrInterviewStatus" AS ENUM ('requested', 'scheduled', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "HrOnboardingCaseStatus" AS ENUM ('draft', 'token_issued', 'submitted', 'in_review', 'completed', 'closed');

-- CreateEnum
CREATE TYPE "HrOffboardingCaseStatus" AS ENUM ('started', 'in_progress', 'access_limited', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "HrDocumentTemplateType" AS ENUM ('offer_letter', 'nda', 'employee_handbook', 'welcome_email', 'termination_letter', 'commission_after_termination', 'other');

-- CreateEnum
CREATE TYPE "HrChecklistCaseType" AS ENUM ('onboarding', 'offboarding');

-- CreateEnum
CREATE TYPE "HrChecklistItemStatus" AS ENUM ('open', 'completed', 'reopened');

-- CreateEnum
CREATE TYPE "HrOnboardingDocumentKind" AS ENUM ('legal_document', 'onboarding_info', 'direct_deposit_info', 'other');

-- CreateEnum
CREATE TYPE "AdminEmailRequestStatus" AS ENUM ('pending', 'approved', 'completed', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'meeting';
ALTER TYPE "EventType" ADD VALUE 'broker_tour';
ALTER TYPE "EventType" ADD VALUE 'other';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SignatureContextType" ADD VALUE 'hr_onboarding';
ALTER TYPE "SignatureContextType" ADD VALUE 'hr_offboarding';
ALTER TYPE "SignatureContextType" ADD VALUE 'hr_offer';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "signupClosesAt" TIMESTAMP(3),
ADD COLUMN     "signupExportedAt" TIMESTAMP(3),
ADD COLUMN     "signupExportedByMembershipId" TEXT,
ADD COLUMN     "signupRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SignatureRecipient" ALTER COLUMN "transactionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SignatureRequest" ALTER COLUMN "transactionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "HrCandidate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "positionTitle" TEXT,
    "teamLeadName" TEXT,
    "sourceType" TEXT,
    "referrerName" TEXT,
    "hrOwnerMembershipId" TEXT,
    "resumeFileKey" TEXT,
    "resumeDriveFileId" TEXT,
    "status" "HrCandidateStatus" NOT NULL DEFAULT 'applied',
    "identityType" "HrIdentityType",
    "driveFolderId" TEXT,
    "driveSyncState" "HrSyncState" NOT NULL DEFAULT 'pending',
    "driveSyncError" TEXT,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrInterview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "candidateId" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "title" TEXT NOT NULL,
    "mode" "HrInterviewMode" NOT NULL DEFAULT 'online',
    "status" "HrInterviewStatus" NOT NULL DEFAULT 'requested',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "interviewerNames" TEXT[],
    "attendeeEmails" TEXT[],
    "ccEmails" TEXT[],
    "location" TEXT,
    "calendarEventId" TEXT,
    "meetUrl" TEXT,
    "aiEmailDraft" TEXT,
    "notes" TEXT,
    "googleSyncState" "HrSyncState" NOT NULL DEFAULT 'pending',
    "googleSyncError" TEXT,
    "trackerSyncState" "HrSyncState" NOT NULL DEFAULT 'pending',
    "trackerSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrOnboardingCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "candidateId" TEXT,
    "membershipId" TEXT,
    "createdByMembershipId" TEXT,
    "status" "HrOnboardingCaseStatus" NOT NULL DEFAULT 'draft',
    "tokenHash" TEXT,
    "tokenIssuedAt" TIMESTAMP(3),
    "tokenExpiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "accessLimitedAt" TIMESTAMP(3),
    "driveFolderId" TEXT,
    "driveSyncState" "HrSyncState" NOT NULL DEFAULT 'pending',
    "driveSyncError" TEXT,
    "legalFormUrl" TEXT NOT NULL DEFAULT 'https://forms.gle/zALYVvygYPJWpZSn8',
    "position" TEXT,
    "teamLeadName" TEXT,
    "externalFormSubmittedAt" TIMESTAMP(3),
    "offerSignatureRequestId" TEXT,
    "ndaSignatureRequestId" TEXT,
    "handbookSignatureRequestId" TEXT,
    "welcomeEmailDraft" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrOnboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrOnboardingDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "onboardingCaseId" TEXT NOT NULL,
    "uploadedByMembershipId" TEXT,
    "kind" "HrOnboardingDocumentKind" NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "submittedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrOnboardingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrOffboardingCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "candidateId" TEXT,
    "membershipId" TEXT,
    "createdByMembershipId" TEXT,
    "status" "HrOffboardingCaseStatus" NOT NULL DEFAULT 'started',
    "position" TEXT,
    "directSupervisor" TEXT,
    "workWechatId" TEXT,
    "lastWorkingDate" TIMESTAMP(3),
    "reason" TEXT,
    "externalFormUrl" TEXT DEFAULT 'https://forms.gle/pi4AMjwgybYeH2JF9',
    "externalFormSubmittedAt" TIMESTAMP(3),
    "checklistInstanceId" TEXT,
    "terminationSignatureRequestId" TEXT,
    "commissionAgreementSignatureRequestId" TEXT,
    "financeHandoffStatus" TEXT,
    "commissionSettlementTriggeredAt" TIMESTAMP(3),
    "salespersonLicenseUnlinkRequired" BOOLEAN NOT NULL DEFAULT false,
    "salespersonLicenseUnlinkedAt" TIMESTAMP(3),
    "accessClosedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrOffboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrDocumentTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "createdByMembershipId" TEXT,
    "type" "HrDocumentTemplateType" NOT NULL DEFAULT 'other',
    "name" TEXT NOT NULL,
    "company" TEXT,
    "position" TEXT,
    "body" TEXT,
    "driveFileId" TEXT,
    "driveFolderId" TEXT,
    "sourceUrl" TEXT,
    "syncState" "HrSyncState" NOT NULL DEFAULT 'not_applicable',
    "syncError" TEXT,
    "variables" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrDocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrIdentityChecklistMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "identityType" "HrIdentityType" NOT NULL,
    "caseType" "HrChecklistCaseType" NOT NULL DEFAULT 'onboarding',
    "checklistTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrIdentityChecklistMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrChecklistInstance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "checklistTemplateId" TEXT,
    "onboardingCaseId" TEXT,
    "offboardingCaseId" TEXT,
    "caseType" "HrChecklistCaseType" NOT NULL,
    "title" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrChecklistInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrChecklistInstanceItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "checklistInstanceId" TEXT NOT NULL,
    "checklistTemplateItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "HrChecklistItemStatus" NOT NULL DEFAULT 'open',
    "completedByMembershipId" TEXT,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrChecklistInstanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminEmailRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "requestedByMembershipId" TEXT,
    "fullName" TEXT NOT NULL,
    "preferredEmailPrefix" TEXT NOT NULL,
    "status" "AdminEmailRequestStatus" NOT NULL DEFAULT 'pending',
    "approvedByMembershipId" TEXT,
    "completedByMembershipId" TEXT,
    "rejectedByMembershipId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminEmailRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationGoogleIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "updatedByMembershipId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "calendarId" TEXT,
    "driveRootFolderId" TEXT,
    "resumeFolderId" TEXT,
    "offerFolderId" TEXT,
    "onboardingFolderId" TEXT,
    "offboardingFolderId" TEXT,
    "hrTrackerSpreadsheetId" TEXT,
    "onboardingFormUrl" TEXT,
    "offboardingFormUrl" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "lastSyncStatus" "HrSyncState" NOT NULL DEFAULT 'pending',
    "lastSyncMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationGoogleIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrCandidate_organizationId_officeId_status_idx" ON "HrCandidate"("organizationId", "officeId", "status");

-- CreateIndex
CREATE INDEX "HrCandidate_organizationId_email_idx" ON "HrCandidate"("organizationId", "email");

-- CreateIndex
CREATE INDEX "HrCandidate_organizationId_hrOwnerMembershipId_idx" ON "HrCandidate"("organizationId", "hrOwnerMembershipId");

-- CreateIndex
CREATE INDEX "HrCandidate_organizationId_createdAt_idx" ON "HrCandidate"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "HrInterview_organizationId_officeId_startsAt_idx" ON "HrInterview"("organizationId", "officeId", "startsAt");

-- CreateIndex
CREATE INDEX "HrInterview_organizationId_candidateId_idx" ON "HrInterview"("organizationId", "candidateId");

-- CreateIndex
CREATE INDEX "HrInterview_organizationId_googleSyncState_idx" ON "HrInterview"("organizationId", "googleSyncState");

-- CreateIndex
CREATE UNIQUE INDEX "HrOnboardingCase_tokenHash_key" ON "HrOnboardingCase"("tokenHash");

-- CreateIndex
CREATE INDEX "HrOnboardingCase_organizationId_officeId_status_idx" ON "HrOnboardingCase"("organizationId", "officeId", "status");

-- CreateIndex
CREATE INDEX "HrOnboardingCase_organizationId_candidateId_idx" ON "HrOnboardingCase"("organizationId", "candidateId");

-- CreateIndex
CREATE INDEX "HrOnboardingCase_organizationId_membershipId_idx" ON "HrOnboardingCase"("organizationId", "membershipId");

-- CreateIndex
CREATE INDEX "HrOnboardingCase_organizationId_tokenExpiresAt_idx" ON "HrOnboardingCase"("organizationId", "tokenExpiresAt");

-- CreateIndex
CREATE INDEX "HrOnboardingDocument_organizationId_onboardingCaseId_idx" ON "HrOnboardingDocument"("organizationId", "onboardingCaseId");

-- CreateIndex
CREATE INDEX "HrOnboardingDocument_organizationId_officeId_createdAt_idx" ON "HrOnboardingDocument"("organizationId", "officeId", "createdAt");

-- CreateIndex
CREATE INDEX "HrOffboardingCase_organizationId_officeId_status_idx" ON "HrOffboardingCase"("organizationId", "officeId", "status");

-- CreateIndex
CREATE INDEX "HrOffboardingCase_organizationId_membershipId_idx" ON "HrOffboardingCase"("organizationId", "membershipId");

-- CreateIndex
CREATE INDEX "HrOffboardingCase_organizationId_candidateId_idx" ON "HrOffboardingCase"("organizationId", "candidateId");

-- CreateIndex
CREATE INDEX "HrDocumentTemplate_organizationId_officeId_type_idx" ON "HrDocumentTemplate"("organizationId", "officeId", "type");

-- CreateIndex
CREATE INDEX "HrDocumentTemplate_organizationId_isActive_idx" ON "HrDocumentTemplate"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "HrIdentityChecklistMapping_organizationId_checklistTemplate_idx" ON "HrIdentityChecklistMapping"("organizationId", "checklistTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "HrIdentityChecklistMapping_organizationId_officeId_identity_key" ON "HrIdentityChecklistMapping"("organizationId", "officeId", "identityType", "caseType");

-- CreateIndex
CREATE INDEX "HrChecklistInstance_organizationId_officeId_caseType_idx" ON "HrChecklistInstance"("organizationId", "officeId", "caseType");

-- CreateIndex
CREATE INDEX "HrChecklistInstance_organizationId_onboardingCaseId_idx" ON "HrChecklistInstance"("organizationId", "onboardingCaseId");

-- CreateIndex
CREATE INDEX "HrChecklistInstance_organizationId_offboardingCaseId_idx" ON "HrChecklistInstance"("organizationId", "offboardingCaseId");

-- CreateIndex
CREATE INDEX "HrChecklistInstanceItem_organizationId_checklistInstanceId__idx" ON "HrChecklistInstanceItem"("organizationId", "checklistInstanceId", "sortOrder");

-- CreateIndex
CREATE INDEX "HrChecklistInstanceItem_organizationId_status_idx" ON "HrChecklistInstanceItem"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AdminEmailRequest_organizationId_officeId_status_idx" ON "AdminEmailRequest"("organizationId", "officeId", "status");

-- CreateIndex
CREATE INDEX "AdminEmailRequest_organizationId_preferredEmailPrefix_idx" ON "AdminEmailRequest"("organizationId", "preferredEmailPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationGoogleIntegration_organizationId_key" ON "OrganizationGoogleIntegration"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationGoogleIntegration_organizationId_isEnabled_idx" ON "OrganizationGoogleIntegration"("organizationId", "isEnabled");

-- CreateIndex
CREATE INDEX "SignatureRequest_organizationId_contextType_contextId_idx" ON "SignatureRequest"("organizationId", "contextType", "contextId");

-- AddForeignKey
ALTER TABLE "HrCandidate" ADD CONSTRAINT "HrCandidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrCandidate" ADD CONSTRAINT "HrCandidate_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrInterview" ADD CONSTRAINT "HrInterview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrInterview" ADD CONSTRAINT "HrInterview_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrInterview" ADD CONSTRAINT "HrInterview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOnboardingCase" ADD CONSTRAINT "HrOnboardingCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOnboardingCase" ADD CONSTRAINT "HrOnboardingCase_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOnboardingCase" ADD CONSTRAINT "HrOnboardingCase_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOnboardingDocument" ADD CONSTRAINT "HrOnboardingDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOnboardingDocument" ADD CONSTRAINT "HrOnboardingDocument_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOnboardingDocument" ADD CONSTRAINT "HrOnboardingDocument_onboardingCaseId_fkey" FOREIGN KEY ("onboardingCaseId") REFERENCES "HrOnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOffboardingCase" ADD CONSTRAINT "HrOffboardingCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOffboardingCase" ADD CONSTRAINT "HrOffboardingCase_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrOffboardingCase" ADD CONSTRAINT "HrOffboardingCase_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrDocumentTemplate" ADD CONSTRAINT "HrDocumentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrDocumentTemplate" ADD CONSTRAINT "HrDocumentTemplate_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrIdentityChecklistMapping" ADD CONSTRAINT "HrIdentityChecklistMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrIdentityChecklistMapping" ADD CONSTRAINT "HrIdentityChecklistMapping_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrIdentityChecklistMapping" ADD CONSTRAINT "HrIdentityChecklistMapping_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstance" ADD CONSTRAINT "HrChecklistInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstance" ADD CONSTRAINT "HrChecklistInstance_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstance" ADD CONSTRAINT "HrChecklistInstance_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstance" ADD CONSTRAINT "HrChecklistInstance_onboardingCaseId_fkey" FOREIGN KEY ("onboardingCaseId") REFERENCES "HrOnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstance" ADD CONSTRAINT "HrChecklistInstance_offboardingCaseId_fkey" FOREIGN KEY ("offboardingCaseId") REFERENCES "HrOffboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstanceItem" ADD CONSTRAINT "HrChecklistInstanceItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstanceItem" ADD CONSTRAINT "HrChecklistInstanceItem_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstanceItem" ADD CONSTRAINT "HrChecklistInstanceItem_checklistInstanceId_fkey" FOREIGN KEY ("checklistInstanceId") REFERENCES "HrChecklistInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrChecklistInstanceItem" ADD CONSTRAINT "HrChecklistInstanceItem_checklistTemplateItemId_fkey" FOREIGN KEY ("checklistTemplateItemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEmailRequest" ADD CONSTRAINT "AdminEmailRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEmailRequest" ADD CONSTRAINT "AdminEmailRequest_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationGoogleIntegration" ADD CONSTRAINT "OrganizationGoogleIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
