-- CreateEnum
CREATE TYPE "AgentBankInformationTaxIdType" AS ENUM ('ssn', 'ein');

-- CreateEnum
CREATE TYPE "AgentBankInformationAccountType" AS ENUM ('checking', 'savings', 'business_checking', 'business_savings', 'other');

-- CreateTable
CREATE TABLE "AgentBankInformation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "membershipId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "address" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "routingNumber" TEXT,
    "phoneNumber" TEXT,
    "taxIdType" "AgentBankInformationTaxIdType",
    "taxIdValue" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "accountType" "AgentBankInformationAccountType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentBankInformation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentBankInformation_membershipId_key" ON "AgentBankInformation"("membershipId");

-- CreateIndex
CREATE INDEX "AgentBankInformation_organizationId_officeId_idx" ON "AgentBankInformation"("organizationId", "officeId");

-- CreateIndex
CREATE INDEX "AgentBankInformation_organizationId_membershipId_idx" ON "AgentBankInformation"("organizationId", "membershipId");

-- AddForeignKey
ALTER TABLE "AgentBankInformation" ADD CONSTRAINT "AgentBankInformation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentBankInformation" ADD CONSTRAINT "AgentBankInformation_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentBankInformation" ADD CONSTRAINT "AgentBankInformation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
