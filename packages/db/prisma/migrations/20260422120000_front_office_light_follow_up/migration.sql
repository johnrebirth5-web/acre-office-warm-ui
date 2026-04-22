CREATE TYPE "ClientFollowUpStatus" AS ENUM (
    'new_lead',
    'active_follow_up',
    'waiting_reply',
    'appointment_booked',
    'paused'
);

CREATE TYPE "ClientFollowUpReminderMode" AS ENUM (
    'auto',
    'manual'
);

ALTER TYPE "NotificationEntityType" ADD VALUE IF NOT EXISTS 'client';

ALTER TABLE "Client"
ADD COLUMN     "followUpStatus" "ClientFollowUpStatus" NOT NULL DEFAULT 'new_lead',
ADD COLUMN     "followUpReminderMode" "ClientFollowUpReminderMode" NOT NULL DEFAULT 'auto';

UPDATE "Client"
SET "followUpStatus" = CASE
    WHEN LOWER(COALESCE("stage", '')) LIKE '%viewing%'
      OR LOWER(COALESCE("stage", '')) LIKE '%showing%'
      OR LOWER(COALESCE("stage", '')) LIKE '%tour%'
      THEN 'appointment_booked'::"ClientFollowUpStatus"
    WHEN LOWER(COALESCE("stage", '')) LIKE '%pending%'
      THEN 'waiting_reply'::"ClientFollowUpStatus"
    WHEN LOWER(COALESCE("stage", '')) LIKE '%won%'
      OR LOWER(COALESCE("stage", '')) LIKE '%lost%'
      THEN 'paused'::"ClientFollowUpStatus"
    WHEN "lastContactAt" IS NOT NULL
      THEN 'active_follow_up'::"ClientFollowUpStatus"
    ELSE 'new_lead'::"ClientFollowUpStatus"
END;

CREATE INDEX "Client_organizationId_followUpStatus_idx" ON "Client"("organizationId", "followUpStatus");
