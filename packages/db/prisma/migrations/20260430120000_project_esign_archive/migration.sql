ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'system_anchor';
ALTER TYPE "SignatureTemplateCategory" ADD VALUE IF NOT EXISTS 'project_sales';
ALTER TYPE "SignatureContextType" ADD VALUE IF NOT EXISTS 'project';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'session_created';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'session_completed';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'archive_resent';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'handoff_started';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'handoff_exited';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'handoff_token_expired';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'remote_otp_sent';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'remote_otp_verified';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'remote_otp_failed';
ALTER TYPE "SignatureAuditEventType" ADD VALUE IF NOT EXISTS 'hash_mismatch';

CREATE TYPE "SalesProjectStatus" AS ENUM ('active', 'archived');
CREATE TYPE "ProjectSigningSessionMode" AS ENUM ('in_person', 'remote');
CREATE TYPE "ProjectSigningSessionStatus" AS ENUM ('draft', 'awaiting_signers', 'partially_signed', 'completed', 'declined', 'voided', 'expired');
CREATE TYPE "ProjectSigningJobType" AS ENUM ('finalize_pdf', 'send_completion_email', 'drive_sync');
CREATE TYPE "ProjectSigningJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');
CREATE TYPE "ProjectDocumentDistributionRecipientKind" AS ENUM ('signer', 'responsible_agent', 'archive_sink', 'cc');
CREATE TYPE "ProjectDocumentDistributionMode" AS ENUM ('secure_link', 'attachment');
CREATE TYPE "ProjectDocumentDistributionStatus" AS ENUM ('queued', 'sending', 'sent', 'failed');

ALTER TABLE "Transaction"
ADD COLUMN "isSystemArchiveAnchor" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SignatureTemplate"
ADD COLUMN "pdfStorageKey" TEXT,
ADD COLUMN "pdfFileName" TEXT,
ADD COLUMN "pdfByteSize" INTEGER,
ADD COLUMN "pdfContentType" TEXT;

ALTER TABLE "SignatureArtifact"
ADD COLUMN "contentSha256" TEXT;

CREATE TABLE "SalesProject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "signatureAnchorTransactionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SalesProjectStatus" NOT NULL DEFAULT 'active',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "description" TEXT,
    "archiveSinkEmails" TEXT[],
    "defaultResponsibleMembershipId" TEXT,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectSigningSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "projectId" TEXT NOT NULL,
    "mode" "ProjectSigningSessionMode" NOT NULL DEFAULT 'remote',
    "status" "ProjectSigningSessionStatus" NOT NULL DEFAULT 'draft',
    "buyerName" TEXT,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "responsibleMembershipId" TEXT,
    "createdByMembershipId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "voidReason" TEXT,
    "handoffTokenHash" TEXT,
    "handoffTokenExpiresAt" TIMESTAMP(3),
    "handoffPinHash" TEXT,
    "handoffPinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "handoffLockedUntil" TIMESTAMP(3),
    "handoffStartedAt" TIMESTAMP(3),
    "handoffExitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSigningSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectSigningSessionRecipient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "sessionId" TEXT NOT NULL,
    "membershipId" TEXT,
    "role" "SignatureRecipientRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "phone" TEXT,
    "recipientRole" TEXT NOT NULL,
    "routingStep" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SignatureRecipientStatus" NOT NULL DEFAULT 'draft',
    "remoteTokenHash" TEXT,
    "remoteTokenIssuedAt" TIMESTAMP(3),
    "remoteTokenExpiresAt" TIMESTAMP(3),
    "remoteTokenRevokedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpLockedUntil" TIMESTAMP(3),
    "otpVerifiedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "actedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSigningSessionRecipient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectSigningSessionRecipient_membership_or_email_chk" CHECK ("membershipId" IS NOT NULL OR "email" IS NOT NULL)
);

CREATE TABLE "ProjectSigningSessionDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'draft',
    "snapshotTemplateName" TEXT NOT NULL,
    "snapshotTemplateVersion" INTEGER NOT NULL,
    "snapshotPdfStorageKey" TEXT NOT NULL,
    "snapshotPdfFileName" TEXT NOT NULL,
    "snapshotPdfByteSize" INTEGER NOT NULL,
    "snapshotPdfContentType" TEXT NOT NULL,
    "snapshotFieldsJson" JSONB NOT NULL,
    "snapshotRecipientsJson" JSONB NOT NULL,
    "snapshotEmailSubject" TEXT,
    "snapshotEmailBody" TEXT,
    "signedArtifactId" TEXT,
    "signedArtifactStorageKey" TEXT,
    "signedArtifactSha256" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizationStatus" "ProjectSigningJobStatus",
    "finalizationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSigningSessionDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesProjectDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT,
    "sessionDocumentId" TEXT,
    "signatureRequestId" TEXT,
    "signatureArtifactId" TEXT,
    "templateId" TEXT,
    "responsibleMembershipId" TEXT,
    "buyerName" TEXT,
    "buyerEmail" TEXT,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentSha256" TEXT,
    "source" TEXT NOT NULL DEFAULT 'signature_output',
    "signedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesProjectDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectSignatureJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "projectId" TEXT,
    "sessionId" TEXT,
    "sessionDocumentId" TEXT,
    "signatureRequestId" TEXT,
    "signatureArtifactId" TEXT,
    "distributionId" TEXT,
    "type" "ProjectSigningJobType" NOT NULL,
    "status" "ProjectSigningJobStatus" NOT NULL DEFAULT 'queued',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSignatureJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectDocumentDistribution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionDocumentId" TEXT NOT NULL,
    "signatureArtifactId" TEXT,
    "recipientKind" "ProjectDocumentDistributionRecipientKind" NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "deliveryMode" "ProjectDocumentDistributionMode" NOT NULL DEFAULT 'secure_link',
    "status" "ProjectDocumentDistributionStatus" NOT NULL DEFAULT 'queued',
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocumentDistribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectDocumentDownloadToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "distributionId" TEXT,
    "salesProjectDocumentId" TEXT,
    "signatureArtifactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocumentDownloadToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesProject_signatureAnchorTransactionId_key" ON "SalesProject"("signatureAnchorTransactionId");
CREATE UNIQUE INDEX "SalesProject_organizationId_officeId_code_key" ON "SalesProject"("organizationId", "officeId", "code");
CREATE UNIQUE INDEX "SalesProject_organizationId_signatureAnchorTransactionId_key" ON "SalesProject"("organizationId", "signatureAnchorTransactionId");
CREATE INDEX "SalesProject_organizationId_officeId_status_idx" ON "SalesProject"("organizationId", "officeId", "status");
CREATE INDEX "SalesProject_organizationId_defaultResponsibleMembershipId_idx" ON "SalesProject"("organizationId", "defaultResponsibleMembershipId");
CREATE INDEX "SalesProject_organizationId_createdByMembershipId_idx" ON "SalesProject"("organizationId", "createdByMembershipId");

CREATE UNIQUE INDEX "SalesProjectDocument_sessionDocumentId_key" ON "SalesProjectDocument"("sessionDocumentId");
CREATE UNIQUE INDEX "SalesProjectDocument_organizationId_sessionDocumentId_key" ON "SalesProjectDocument"("organizationId", "sessionDocumentId");
CREATE UNIQUE INDEX "SalesProjectDocument_organizationId_signatureArtifactId_key" ON "SalesProjectDocument"("organizationId", "signatureArtifactId");
CREATE INDEX "SalesProjectDocument_organizationId_projectId_archivedAt_idx" ON "SalesProjectDocument"("organizationId", "projectId", "archivedAt");
CREATE INDEX "SalesProjectDocument_organizationId_projectId_documentType_idx" ON "SalesProjectDocument"("organizationId", "projectId", "documentType");
CREATE INDEX "SalesProjectDocument_organizationId_buyerEmail_idx" ON "SalesProjectDocument"("organizationId", "buyerEmail");
CREATE INDEX "SalesProjectDocument_organizationId_contentSha256_idx" ON "SalesProjectDocument"("organizationId", "contentSha256");
CREATE INDEX "SalesProjectDocument_organizationId_responsibleMembershipId_idx" ON "SalesProjectDocument"("organizationId", "responsibleMembershipId");

CREATE UNIQUE INDEX "ProjectSigningSession_handoffTokenHash_key" ON "ProjectSigningSession"("handoffTokenHash");
CREATE INDEX "ProjectSigningSession_organizationId_officeId_projectId_status_idx" ON "ProjectSigningSession"("organizationId", "officeId", "projectId", "status");
CREATE INDEX "ProjectSigningSession_organizationId_responsibleMembershipId_createdAt_idx" ON "ProjectSigningSession"("organizationId", "responsibleMembershipId", "createdAt");
CREATE INDEX "ProjectSigningSession_organizationId_createdByMembershipId_createdAt_idx" ON "ProjectSigningSession"("organizationId", "createdByMembershipId", "createdAt");
CREATE INDEX "ProjectSigningSession_organizationId_status_expiresAt_idx" ON "ProjectSigningSession"("organizationId", "status", "expiresAt");

CREATE UNIQUE INDEX "ProjectSigningSessionRecipient_remoteTokenHash_key" ON "ProjectSigningSessionRecipient"("remoteTokenHash");
CREATE UNIQUE INDEX "ProjectSigningSessionRecipient_sessionId_normalizedEmail_key" ON "ProjectSigningSessionRecipient"("sessionId", "normalizedEmail");
CREATE INDEX "ProjectSigningSessionRecipient_organizationId_sessionId_routingStep_sortOrder_idx" ON "ProjectSigningSessionRecipient"("organizationId", "sessionId", "routingStep", "sortOrder");
CREATE INDEX "ProjectSigningSessionRecipient_organizationId_email_idx" ON "ProjectSigningSessionRecipient"("organizationId", "email");
CREATE INDEX "ProjectSigningSessionRecipient_organizationId_membershipId_idx" ON "ProjectSigningSessionRecipient"("organizationId", "membershipId");

CREATE UNIQUE INDEX "ProjectSigningSessionDocument_signatureRequestId_key" ON "ProjectSigningSessionDocument"("signatureRequestId");
CREATE UNIQUE INDEX "ProjectSigningSessionDocument_organizationId_signatureRequestId_key" ON "ProjectSigningSessionDocument"("organizationId", "signatureRequestId");
CREATE UNIQUE INDEX "ProjectSigningSessionDocument_organizationId_signedArtifactId_key" ON "ProjectSigningSessionDocument"("organizationId", "signedArtifactId");
CREATE UNIQUE INDEX "ProjectSigningSessionDocument_sessionId_sortOrder_key" ON "ProjectSigningSessionDocument"("sessionId", "sortOrder");
CREATE INDEX "ProjectSigningSessionDocument_organizationId_projectId_status_idx" ON "ProjectSigningSessionDocument"("organizationId", "projectId", "status");
CREATE INDEX "ProjectSigningSessionDocument_organizationId_sessionId_status_idx" ON "ProjectSigningSessionDocument"("organizationId", "sessionId", "status");
CREATE INDEX "ProjectSigningSessionDocument_organizationId_signedArtifactSha256_idx" ON "ProjectSigningSessionDocument"("organizationId", "signedArtifactSha256");

CREATE UNIQUE INDEX "ProjectSignatureJob_idempotencyKey_key" ON "ProjectSignatureJob"("idempotencyKey");
CREATE INDEX "ProjectSignatureJob_status_runAfter_idx" ON "ProjectSignatureJob"("status", "runAfter");
CREATE INDEX "ProjectSignatureJob_status_lockedAt_idx" ON "ProjectSignatureJob"("status", "lockedAt");
CREATE INDEX "ProjectSignatureJob_organizationId_type_status_idx" ON "ProjectSignatureJob"("organizationId", "type", "status");
CREATE INDEX "ProjectSignatureJob_organizationId_sessionId_status_idx" ON "ProjectSignatureJob"("organizationId", "sessionId", "status");

CREATE INDEX "ProjectDocumentDistribution_organizationId_sessionId_status_idx" ON "ProjectDocumentDistribution"("organizationId", "sessionId", "status");
CREATE INDEX "ProjectDocumentDistribution_organizationId_recipientEmail_idx" ON "ProjectDocumentDistribution"("organizationId", "recipientEmail");
CREATE INDEX "ProjectDocumentDistribution_organizationId_projectId_status_idx" ON "ProjectDocumentDistribution"("organizationId", "projectId", "status");

CREATE UNIQUE INDEX "ProjectDocumentDownloadToken_tokenHash_key" ON "ProjectDocumentDownloadToken"("tokenHash");
CREATE INDEX "ProjectDocumentDownloadToken_organizationId_expiresAt_idx" ON "ProjectDocumentDownloadToken"("organizationId", "expiresAt");
CREATE INDEX "ProjectDocumentDownloadToken_organizationId_signatureArtifactId_idx" ON "ProjectDocumentDownloadToken"("organizationId", "signatureArtifactId");

CREATE INDEX "Transaction_organizationId_isSystemArchiveAnchor_idx" ON "Transaction"("organizationId", "isSystemArchiveAnchor");
CREATE INDEX "Transaction_organizationId_officeId_isSystemArchiveAnchor_idx" ON "Transaction"("organizationId", "officeId", "isSystemArchiveAnchor");
CREATE INDEX "SignatureArtifact_organizationId_contentSha256_idx" ON "SignatureArtifact"("organizationId", "contentSha256");

ALTER TABLE "SalesProject" ADD CONSTRAINT "SalesProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesProject" ADD CONSTRAINT "SalesProject_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesProject" ADD CONSTRAINT "SalesProject_signatureAnchorTransactionId_fkey" FOREIGN KEY ("signatureAnchorTransactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesProject" ADD CONSTRAINT "SalesProject_defaultResponsibleMembershipId_fkey" FOREIGN KEY ("defaultResponsibleMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesProject" ADD CONSTRAINT "SalesProject_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectSigningSession" ADD CONSTRAINT "ProjectSigningSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSession" ADD CONSTRAINT "ProjectSigningSession_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSession" ADD CONSTRAINT "ProjectSigningSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SalesProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSession" ADD CONSTRAINT "ProjectSigningSession_responsibleMembershipId_fkey" FOREIGN KEY ("responsibleMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSession" ADD CONSTRAINT "ProjectSigningSession_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectSigningSessionRecipient" ADD CONSTRAINT "ProjectSigningSessionRecipient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionRecipient" ADD CONSTRAINT "ProjectSigningSessionRecipient_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionRecipient" ADD CONSTRAINT "ProjectSigningSessionRecipient_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProjectSigningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionRecipient" ADD CONSTRAINT "ProjectSigningSessionRecipient_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectSigningSessionDocument" ADD CONSTRAINT "ProjectSigningSessionDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionDocument" ADD CONSTRAINT "ProjectSigningSessionDocument_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionDocument" ADD CONSTRAINT "ProjectSigningSessionDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SalesProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionDocument" ADD CONSTRAINT "ProjectSigningSessionDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProjectSigningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionDocument" ADD CONSTRAINT "ProjectSigningSessionDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionDocument" ADD CONSTRAINT "ProjectSigningSessionDocument_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSigningSessionDocument" ADD CONSTRAINT "ProjectSigningSessionDocument_signedArtifactId_fkey" FOREIGN KEY ("signedArtifactId") REFERENCES "SignatureArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SalesProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProjectSigningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_sessionDocumentId_fkey" FOREIGN KEY ("sessionDocumentId") REFERENCES "ProjectSigningSessionDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_signatureArtifactId_fkey" FOREIGN KEY ("signatureArtifactId") REFERENCES "SignatureArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesProjectDocument" ADD CONSTRAINT "SalesProjectDocument_responsibleMembershipId_fkey" FOREIGN KEY ("responsibleMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectSignatureJob" ADD CONSTRAINT "ProjectSignatureJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSignatureJob" ADD CONSTRAINT "ProjectSignatureJob_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectSignatureJob" ADD CONSTRAINT "ProjectSignatureJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SalesProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSignatureJob" ADD CONSTRAINT "ProjectSignatureJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProjectSigningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSignatureJob" ADD CONSTRAINT "ProjectSignatureJob_sessionDocumentId_fkey" FOREIGN KEY ("sessionDocumentId") REFERENCES "ProjectSigningSessionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSignatureJob" ADD CONSTRAINT "ProjectSignatureJob_signatureArtifactId_fkey" FOREIGN KEY ("signatureArtifactId") REFERENCES "SignatureArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectSignatureJob" ADD CONSTRAINT "ProjectSignatureJob_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "ProjectDocumentDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectDocumentDistribution" ADD CONSTRAINT "ProjectDocumentDistribution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDistribution" ADD CONSTRAINT "ProjectDocumentDistribution_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDistribution" ADD CONSTRAINT "ProjectDocumentDistribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SalesProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDistribution" ADD CONSTRAINT "ProjectDocumentDistribution_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProjectSigningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDistribution" ADD CONSTRAINT "ProjectDocumentDistribution_sessionDocumentId_fkey" FOREIGN KEY ("sessionDocumentId") REFERENCES "ProjectSigningSessionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDistribution" ADD CONSTRAINT "ProjectDocumentDistribution_signatureArtifactId_fkey" FOREIGN KEY ("signatureArtifactId") REFERENCES "SignatureArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectDocumentDownloadToken" ADD CONSTRAINT "ProjectDocumentDownloadToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDownloadToken" ADD CONSTRAINT "ProjectDocumentDownloadToken_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDownloadToken" ADD CONSTRAINT "ProjectDocumentDownloadToken_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "ProjectDocumentDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDownloadToken" ADD CONSTRAINT "ProjectDocumentDownloadToken_salesProjectDocumentId_fkey" FOREIGN KEY ("salesProjectDocumentId") REFERENCES "SalesProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentDownloadToken" ADD CONSTRAINT "ProjectDocumentDownloadToken_signatureArtifactId_fkey" FOREIGN KEY ("signatureArtifactId") REFERENCES "SignatureArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "OrganizationRoleTemplatePermission" (
    "id",
    "organizationId",
    "organizationRoleTemplateId",
    "permissionKey",
    "createdAt",
    "updatedAt"
)
SELECT
    'proj_sign_perm_' || md5(template."organizationId" || ':' || template."id" || ':' || mapped."permissionKey"),
    template."organizationId",
    template."id",
    mapped."permissionKey",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "OrganizationRoleTemplate" AS template
JOIN (
    VALUES
        ('owner', 'project_signing:view'),
        ('owner', 'project_signing:create'),
        ('owner', 'project_signing:manage'),
        ('owner', 'project_signing:template_manage'),
        ('owner', 'project_signing:archive_manage'),
        ('office_admin', 'project_signing:view'),
        ('office_admin', 'project_signing:create'),
        ('office_admin', 'project_signing:manage'),
        ('office_admin', 'project_signing:template_manage'),
        ('office_admin', 'project_signing:archive_manage'),
        ('office_manager', 'project_signing:view'),
        ('office_manager', 'project_signing:create'),
        ('office_manager', 'project_signing:manage'),
        ('office_manager', 'project_signing:template_manage'),
        ('office_manager', 'project_signing:archive_manage'),
        ('team_lead', 'project_signing:view'),
        ('team_lead', 'project_signing:create'),
        ('team_lead', 'project_signing:manage'),
        ('team_lead', 'project_signing:archive_manage'),
        ('agent', 'project_signing:view'),
        ('agent', 'project_signing:create'),
        ('office_user', 'project_signing:view')
) AS mapped("role", "permissionKey")
  ON template."role" = mapped."role"::"UserRole"
LEFT JOIN "OrganizationRoleTemplatePermission" AS existing
  ON existing."organizationRoleTemplateId" = template."id"
 AND existing."permissionKey" = mapped."permissionKey"
WHERE existing."id" IS NULL;
