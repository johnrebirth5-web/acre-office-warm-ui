ALTER TABLE "AgentBankInformation"
ADD COLUMN "payeeName" TEXT;

CREATE TABLE "Agent1099PaymentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "membershipId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentAmount" DECIMAL(12,2) NOT NULL,
    "memo" TEXT,
    "createdByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent1099PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Agent1099PaymentRecord_organizationId_officeId_members_idx"
ON "Agent1099PaymentRecord"("organizationId", "officeId", "membershipId", "taxYear");

CREATE INDEX "Agent1099PaymentRecord_organizationId_officeId_taxYea_idx"
ON "Agent1099PaymentRecord"("organizationId", "officeId", "taxYear");

CREATE INDEX "Agent1099PaymentRecord_organizationId_membershipId_tax_idx"
ON "Agent1099PaymentRecord"("organizationId", "membershipId", "taxYear", "paymentDate");

ALTER TABLE "Agent1099PaymentRecord"
ADD CONSTRAINT "Agent1099PaymentRecord_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Agent1099PaymentRecord"
ADD CONSTRAINT "Agent1099PaymentRecord_officeId_fkey"
FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Agent1099PaymentRecord"
ADD CONSTRAINT "Agent1099PaymentRecord_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Agent1099PaymentRecord"
ADD CONSTRAINT "Agent1099PaymentRecord_createdByMembershipId_fkey"
FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
