CREATE TABLE "OrganizationSmtpSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "updatedByMembershipId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "host" TEXT,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" TEXT,
    "encryptedPassword" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "replyTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSmtpSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationSmtpSetting_organizationId_key" ON "OrganizationSmtpSetting"("organizationId");

CREATE INDEX "OrganizationSmtpSetting_organizationId_isEnabled_idx" ON "OrganizationSmtpSetting"("organizationId", "isEnabled");

ALTER TABLE "OrganizationSmtpSetting"
ADD CONSTRAINT "OrganizationSmtpSetting_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationSmtpSetting"
ADD CONSTRAINT "OrganizationSmtpSetting_updatedByMembershipId_fkey"
FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
