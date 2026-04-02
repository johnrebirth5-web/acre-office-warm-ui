-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'internal_message_received';

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'message';

-- AlterEnum
ALTER TYPE "NotificationEntityType" ADD VALUE IF NOT EXISTS 'office_mail_thread';

-- AlterTable
ALTER TABLE "MembershipNotificationPreference"
ADD COLUMN IF NOT EXISTS "messageAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "OfficeMailThread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "latestMessageAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeMailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeMailParticipant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "OfficeMailParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeMailMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderMembershipId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeMailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeMailAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeMailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfficeMailThread_organizationId_latestMessageAt_idx" ON "OfficeMailThread"("organizationId", "latestMessageAt");

-- CreateIndex
CREATE INDEX "OfficeMailThread_organizationId_createdByMembershipId_latestMessageAt_idx" ON "OfficeMailThread"("organizationId", "createdByMembershipId", "latestMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeMailParticipant_threadId_membershipId_key" ON "OfficeMailParticipant"("threadId", "membershipId");

-- CreateIndex
CREATE INDEX "OfficeMailParticipant_organizationId_membershipId_archivedAt_idx" ON "OfficeMailParticipant"("organizationId", "membershipId", "archivedAt");

-- CreateIndex
CREATE INDEX "OfficeMailParticipant_organizationId_membershipId_lastReadAt_idx" ON "OfficeMailParticipant"("organizationId", "membershipId", "lastReadAt");

-- CreateIndex
CREATE INDEX "OfficeMailMessage_organizationId_threadId_createdAt_idx" ON "OfficeMailMessage"("organizationId", "threadId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficeMailMessage_organizationId_senderMembershipId_createdAt_idx" ON "OfficeMailMessage"("organizationId", "senderMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficeMailAttachment_organizationId_createdAt_idx" ON "OfficeMailAttachment"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficeMailAttachment_organizationId_messageId_idx" ON "OfficeMailAttachment"("organizationId", "messageId");

-- AddForeignKey
ALTER TABLE "OfficeMailThread" ADD CONSTRAINT "OfficeMailThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailThread" ADD CONSTRAINT "OfficeMailThread_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailParticipant" ADD CONSTRAINT "OfficeMailParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailParticipant" ADD CONSTRAINT "OfficeMailParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "OfficeMailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailParticipant" ADD CONSTRAINT "OfficeMailParticipant_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailMessage" ADD CONSTRAINT "OfficeMailMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailMessage" ADD CONSTRAINT "OfficeMailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "OfficeMailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailMessage" ADD CONSTRAINT "OfficeMailMessage_senderMembershipId_fkey" FOREIGN KEY ("senderMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailAttachment" ADD CONSTRAINT "OfficeMailAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMailAttachment" ADD CONSTRAINT "OfficeMailAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "OfficeMailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing role templates with mail baseline permissions
INSERT INTO "OrganizationRoleTemplatePermission" (
    "id",
    "organizationId",
    "organizationRoleTemplateId",
    "permissionKey",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(template."id" || ':mail:view'),
    template."organizationId",
    template."id",
    'mail:view',
    NOW(),
    NOW()
FROM "OrganizationRoleTemplate" template
WHERE template."role" IN ('owner', 'office_admin', 'accountant', 'human_resources', 'team_lead', 'agent', 'office_manager', 'office_user')
ON CONFLICT ("organizationRoleTemplateId", "permissionKey") DO NOTHING;

INSERT INTO "OrganizationRoleTemplatePermission" (
    "id",
    "organizationId",
    "organizationRoleTemplateId",
    "permissionKey",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(template."id" || ':mail:send'),
    template."organizationId",
    template."id",
    'mail:send',
    NOW(),
    NOW()
FROM "OrganizationRoleTemplate" template
WHERE template."role" IN ('owner', 'office_admin', 'accountant', 'human_resources', 'team_lead', 'agent', 'office_manager', 'office_user')
ON CONFLICT ("organizationRoleTemplateId", "permissionKey") DO NOTHING;

INSERT INTO "OrganizationRoleTemplatePermission" (
    "id",
    "organizationId",
    "organizationRoleTemplateId",
    "permissionKey",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(template."id" || ':mail:audit'),
    template."organizationId",
    template."id",
    'mail:audit',
    NOW(),
    NOW()
FROM "OrganizationRoleTemplate" template
WHERE template."role" IN ('owner', 'office_admin')
ON CONFLICT ("organizationRoleTemplateId", "permissionKey") DO NOTHING;
