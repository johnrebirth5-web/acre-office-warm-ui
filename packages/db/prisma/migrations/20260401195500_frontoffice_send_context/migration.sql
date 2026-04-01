ALTER TABLE "FrontOfficeSendRecord"
ADD COLUMN "appointmentId" TEXT,
ADD COLUMN "clientStageLabel" TEXT,
ADD COLUMN "appointmentTitle" TEXT,
ADD COLUMN "appointmentStartsAt" TIMESTAMP(3);

CREATE INDEX "FrontOfficeSendRecord_organizationId_appointmentId_sentAt_idx"
ON "FrontOfficeSendRecord"("organizationId", "appointmentId", "sentAt");

CREATE INDEX "FrontOfficeSendRecord_organizationId_clientStageLabel_sentAt_idx"
ON "FrontOfficeSendRecord"("organizationId", "clientStageLabel", "sentAt");

ALTER TABLE "FrontOfficeSendRecord"
ADD CONSTRAINT "FrontOfficeSendRecord_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
