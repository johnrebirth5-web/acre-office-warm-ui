-- CreateEnum
CREATE TYPE "FrontOfficeCleanupRunStatus" AS ENUM ('active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "FrontOfficeCleanupRunItemKind" AS ENUM ('notification', 'follow_up_task', 'client_reminder', 'appointment_continuity');

-- CreateEnum
CREATE TYPE "FrontOfficeCleanupRunItemStatus" AS ENUM ('pending', 'completed', 'skipped', 'revisit');

-- CreateTable
CREATE TABLE "FrontOfficeCleanupRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "membershipId" TEXT NOT NULL,
    "status" "FrontOfficeCleanupRunStatus" NOT NULL DEFAULT 'active',
    "scopeLabel" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "windowLabel" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "urgentCount" INTEGER NOT NULL DEFAULT 0,
    "dueSoonCount" INTEGER NOT NULL DEFAULT 0,
    "notificationCount" INTEGER NOT NULL DEFAULT 0,
    "followUpTaskCount" INTEGER NOT NULL DEFAULT 0,
    "clientReminderCount" INTEGER NOT NULL DEFAULT 0,
    "appointmentCount" INTEGER NOT NULL DEFAULT 0,
    "nextActionLabel" TEXT NOT NULL,
    "nextActionDetail" TEXT NOT NULL,
    "workflowJson" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontOfficeCleanupRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontOfficeCleanupRunItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceKind" "FrontOfficeCleanupRunItemKind" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "FrontOfficeCleanupRunItemStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "actionLabel" TEXT NOT NULL,
    "actionDetail" TEXT NOT NULL,
    "destinationLabel" TEXT NOT NULL,
    "dueAtLabel" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "statusUpdatedAt" TIMESTAMP(3),
    "statusUpdatedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontOfficeCleanupRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FOCleanupRun_org_member_status_created_idx" ON "FrontOfficeCleanupRun"("organizationId", "membershipId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FOCleanupRun_org_office_status_created_idx" ON "FrontOfficeCleanupRun"("organizationId", "officeId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FOCleanupRunItem_run_kind_source_key" ON "FrontOfficeCleanupRunItem"("runId", "sourceKind", "sourceId");

-- CreateIndex
CREATE INDEX "FOCleanupRunItem_org_run_status_idx" ON "FrontOfficeCleanupRunItem"("organizationId", "runId", "status");

-- CreateIndex
CREATE INDEX "FOCleanupRunItem_org_kind_source_idx" ON "FrontOfficeCleanupRunItem"("organizationId", "sourceKind", "sourceId");

-- AddForeignKey
ALTER TABLE "FrontOfficeCleanupRun" ADD CONSTRAINT "FrontOfficeCleanupRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeCleanupRun" ADD CONSTRAINT "FrontOfficeCleanupRun_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeCleanupRun" ADD CONSTRAINT "FrontOfficeCleanupRun_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeCleanupRunItem" ADD CONSTRAINT "FrontOfficeCleanupRunItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeCleanupRunItem" ADD CONSTRAINT "FrontOfficeCleanupRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FrontOfficeCleanupRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
