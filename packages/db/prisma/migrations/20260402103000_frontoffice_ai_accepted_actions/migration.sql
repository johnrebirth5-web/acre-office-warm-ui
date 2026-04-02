-- CreateEnum
CREATE TYPE "FrontOfficeAiActionType" AS ENUM ('follow_up_created', 'tracked_send_created');

-- CreateEnum
CREATE TYPE "FrontOfficeAiSourceSurface" AS ENUM ('client_dossier', 'dashboard_queue', 'listing_output');

-- CreateEnum
CREATE TYPE "FrontOfficeAiSuggestionKind" AS ENUM (
  'reentry',
  'postclose',
  'closing',
  'lease',
  'appointment',
  'content_rescue',
  'warm_engagement',
  'handoff',
  'generic'
);

-- CreateTable
CREATE TABLE "FrontOfficeAiAcceptedAction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "officeId" TEXT,
  "membershipId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "listingId" TEXT,
  "followUpTaskId" TEXT,
  "sendRecordId" TEXT,
  "actionType" "FrontOfficeAiActionType" NOT NULL,
  "sourceSurface" "FrontOfficeAiSourceSurface" NOT NULL,
  "suggestionKind" "FrontOfficeAiSuggestionKind" NOT NULL,
  "suggestionLabel" TEXT NOT NULL,
  "actionTitle" TEXT NOT NULL,
  "channel" "FrontOfficeSendChannel",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FrontOfficeAiAcceptedAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FrontOfficeAiAcceptedAction_followUpTaskId_key" ON "FrontOfficeAiAcceptedAction"("followUpTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "FrontOfficeAiAcceptedAction_sendRecordId_key" ON "FrontOfficeAiAcceptedAction"("sendRecordId");

-- CreateIndex
CREATE INDEX "FrontOfficeAiAcceptedAction_organizationId_membershipId_createdAt_idx" ON "FrontOfficeAiAcceptedAction"("organizationId", "membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "FrontOfficeAiAcceptedAction_organizationId_clientId_createdAt_idx" ON "FrontOfficeAiAcceptedAction"("organizationId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "FrontOfficeAiAcceptedAction_organizationId_sourceSurface_createdAt_idx" ON "FrontOfficeAiAcceptedAction"("organizationId", "sourceSurface", "createdAt");

-- CreateIndex
CREATE INDEX "FrontOfficeAiAcceptedAction_organizationId_suggestionKind_createdAt_idx" ON "FrontOfficeAiAcceptedAction"("organizationId", "suggestionKind", "createdAt");

-- CreateIndex
CREATE INDEX "FrontOfficeAiAcceptedAction_organizationId_actionType_createdAt_idx" ON "FrontOfficeAiAcceptedAction"("organizationId", "actionType", "createdAt");

-- AddForeignKey
ALTER TABLE "FrontOfficeAiAcceptedAction"
ADD CONSTRAINT "FrontOfficeAiAcceptedAction_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeAiAcceptedAction"
ADD CONSTRAINT "FrontOfficeAiAcceptedAction_officeId_fkey"
FOREIGN KEY ("officeId") REFERENCES "Office"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeAiAcceptedAction"
ADD CONSTRAINT "FrontOfficeAiAcceptedAction_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeAiAcceptedAction"
ADD CONSTRAINT "FrontOfficeAiAcceptedAction_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeAiAcceptedAction"
ADD CONSTRAINT "FrontOfficeAiAcceptedAction_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeAiAcceptedAction"
ADD CONSTRAINT "FrontOfficeAiAcceptedAction_followUpTaskId_fkey"
FOREIGN KEY ("followUpTaskId") REFERENCES "FollowUpTask"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontOfficeAiAcceptedAction"
ADD CONSTRAINT "FrontOfficeAiAcceptedAction_sendRecordId_fkey"
FOREIGN KEY ("sendRecordId") REFERENCES "FrontOfficeSendRecord"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
