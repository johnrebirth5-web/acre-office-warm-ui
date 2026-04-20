CREATE TYPE "EventType" AS ENUM ('activity', 'training', 'admin');

CREATE TYPE "EventRecurrenceRule" AS ENUM ('weekly_thursday', 'monthly_first_friday');

ALTER TABLE "Event"
ADD COLUMN "eventType" "EventType" NOT NULL DEFAULT 'activity',
ADD COLUMN "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "area" TEXT,
ADD COLUMN "meetingPassword" TEXT,
ADD COLUMN "isMandatory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "seriesId" TEXT,
ADD COLUMN "recurrenceRule" "EventRecurrenceRule";

UPDATE "Event"
SET "isOnline" = true
WHERE "meetingUrl" IS NOT NULL AND BTRIM("meetingUrl") <> '';

CREATE INDEX "Event_organizationId_seriesId_startsAt_idx"
ON "Event"("organizationId", "seriesId", "startsAt");
