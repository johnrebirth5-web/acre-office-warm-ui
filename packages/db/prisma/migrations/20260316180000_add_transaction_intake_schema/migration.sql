ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'transaction_type';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'transaction_status';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'representing';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'address';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'city';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'state';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'zip_code';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'transaction_name';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'buyer_agreement_date';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'listing_date';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'listing_expiration_date';

CREATE TYPE "TransactionCustomFieldType" AS ENUM ('text', 'select', 'date');

CREATE TABLE "TransactionCustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TransactionCustomFieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionCustomFieldDefinition_organizationId_officeId_fieldK_key" ON "TransactionCustomFieldDefinition"("organizationId", "officeId", "fieldKey");
CREATE INDEX "TransactionCustomFieldDefinition_organizationId_officeId_isVis_idx" ON "TransactionCustomFieldDefinition"("organizationId", "officeId", "isVisible", "sortOrder");

ALTER TABLE "TransactionCustomFieldDefinition" ADD CONSTRAINT "TransactionCustomFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionCustomFieldDefinition" ADD CONSTRAINT "TransactionCustomFieldDefinition_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
