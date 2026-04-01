-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('showing', 'consultation', 'client_meeting', 'internal_meeting', 'open_house', 'other');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'completed', 'canceled', 'no_show');

-- CreateEnum
CREATE TYPE "FrontOfficeHandoffStatus" AS ENUM ('draft', 'ready', 'committed', 'canceled');

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "ownerMembershipId" TEXT,
    "clientId" TEXT,
    "listingId" TEXT,
    "type" "AppointmentType" NOT NULL DEFAULT 'showing',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "meetingUrl" TEXT,
    "contactLabel" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientStageHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "clientId" TEXT NOT NULL,
    "membershipId" TEXT,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontOfficeHandoffDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "clientId" TEXT NOT NULL,
    "ownerMembershipId" TEXT,
    "committedTransactionId" TEXT,
    "status" "FrontOfficeHandoffStatus" NOT NULL DEFAULT 'ready',
    "targetWorkflow" TEXT NOT NULL DEFAULT 'transaction',
    "stageLabel" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontOfficeHandoffDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_organizationId_ownerMembershipId_startsAt_idx" ON "Appointment"("organizationId", "ownerMembershipId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_officeId_startsAt_idx" ON "Appointment"("organizationId", "officeId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_clientId_startsAt_idx" ON "Appointment"("organizationId", "clientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_listingId_startsAt_idx" ON "Appointment"("organizationId", "listingId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_status_startsAt_idx" ON "Appointment"("organizationId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "ClientStageHistory_organizationId_clientId_createdAt_idx" ON "ClientStageHistory"("organizationId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientStageHistory_organizationId_membershipId_createdAt_idx" ON "ClientStageHistory"("organizationId", "membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientStageHistory_organizationId_officeId_createdAt_idx" ON "ClientStageHistory"("organizationId", "officeId", "createdAt");

-- CreateIndex
CREATE INDEX "FrontOfficeHandoffDraft_organizationId_status_updatedAt_idx" ON "FrontOfficeHandoffDraft"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FrontOfficeHandoffDraft_organizationId_clientId_status_idx" ON "FrontOfficeHandoffDraft"("organizationId", "clientId", "status");

-- CreateIndex
CREATE INDEX "FrontOfficeHandoffDraft_organizationId_ownerMembershipId_st_idx" ON "FrontOfficeHandoffDraft"("organizationId", "ownerMembershipId", "status");

-- CreateIndex
CREATE INDEX "FrontOfficeHandoffDraft_organizationId_committedTransaction_idx" ON "FrontOfficeHandoffDraft"("organizationId", "committedTransactionId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_ownerMembershipId_fkey" FOREIGN KEY ("ownerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStageHistory" ADD CONSTRAINT "ClientStageHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStageHistory" ADD CONSTRAINT "ClientStageHistory_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStageHistory" ADD CONSTRAINT "ClientStageHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStageHistory" ADD CONSTRAINT "ClientStageHistory_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeHandoffDraft" ADD CONSTRAINT "FrontOfficeHandoffDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeHandoffDraft" ADD CONSTRAINT "FrontOfficeHandoffDraft_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeHandoffDraft" ADD CONSTRAINT "FrontOfficeHandoffDraft_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeHandoffDraft" ADD CONSTRAINT "FrontOfficeHandoffDraft_ownerMembershipId_fkey" FOREIGN KEY ("ownerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeHandoffDraft" ADD CONSTRAINT "FrontOfficeHandoffDraft_committedTransactionId_fkey" FOREIGN KEY ("committedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

