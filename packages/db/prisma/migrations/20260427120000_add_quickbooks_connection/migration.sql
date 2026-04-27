CREATE TABLE "OrganizationQuickBooksConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "updatedByMembershipId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "realmId" TEXT NOT NULL,
    "companyName" TEXT,
    "legalName" TEXT,
    "scope" TEXT,
    "tokenType" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "lastValidationStatus" TEXT,
    "lastValidationMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationQuickBooksConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationQuickBooksConnection_organizationId_key" ON "OrganizationQuickBooksConnection"("organizationId");

CREATE INDEX "OrganizationQuickBooksConnection_organizationId_isEnabled_idx" ON "OrganizationQuickBooksConnection"("organizationId", "isEnabled");

CREATE INDEX "OrganizationQuickBooksConnection_organizationId_realmId_idx" ON "OrganizationQuickBooksConnection"("organizationId", "realmId");

ALTER TABLE "OrganizationQuickBooksConnection"
ADD CONSTRAINT "OrganizationQuickBooksConnection_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationQuickBooksConnection"
ADD CONSTRAINT "OrganizationQuickBooksConnection_updatedByMembershipId_fkey"
FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
