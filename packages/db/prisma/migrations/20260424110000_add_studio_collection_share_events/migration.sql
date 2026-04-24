CREATE TYPE "StudioListingCollectionShareEventKind" AS ENUM ('shared', 'opened');

CREATE TABLE "StudioListingCollectionShareEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "shareCode" TEXT NOT NULL,
    "eventKind" "StudioListingCollectionShareEventKind" NOT NULL,
    "createdByMembershipId" TEXT,
    "viewerFingerprint" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "ipAddressHash" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioListingCollectionShareEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioListingCollectionShareEvent_organizationId_collectionId_eventKind_occurredAt_idx"
ON "StudioListingCollectionShareEvent"("organizationId", "collectionId", "eventKind", "occurredAt");

CREATE INDEX "StudioListingCollectionShareEvent_organizationId_shareCode_eventKind_occurredAt_idx"
ON "StudioListingCollectionShareEvent"("organizationId", "shareCode", "eventKind", "occurredAt");

CREATE INDEX "StudioListingCollectionShareEvent_organizationId_createdByMembershipId_occurredAt_idx"
ON "StudioListingCollectionShareEvent"("organizationId", "createdByMembershipId", "occurredAt");

ALTER TABLE "StudioListingCollectionShareEvent"
ADD CONSTRAINT "StudioListingCollectionShareEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioListingCollectionShareEvent"
ADD CONSTRAINT "StudioListingCollectionShareEvent_collectionId_fkey"
FOREIGN KEY ("collectionId") REFERENCES "StudioListingCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioListingCollectionShareEvent"
ADD CONSTRAINT "StudioListingCollectionShareEvent_createdByMembershipId_fkey"
FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
