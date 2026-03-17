ALTER TABLE "Client"
ADD COLUMN IF NOT EXISTS "additionalFields" JSONB;

ALTER TABLE "Offer"
ADD COLUMN IF NOT EXISTS "additionalFields" JSONB;

ALTER TABLE "TransactionFieldSetting"
ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TransactionCustomFieldDefinition"
ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

UPDATE "TransactionFieldSetting"
SET "sortOrder" = CASE "fieldKey"::text
  WHEN 'transaction_type' THEN 0
  WHEN 'transaction_status' THEN 1
  WHEN 'representing' THEN 2
  WHEN 'address' THEN 10
  WHEN 'city' THEN 11
  WHEN 'state' THEN 12
  WHEN 'zip_code' THEN 13
  WHEN 'transaction_name' THEN 14
  WHEN 'price' THEN 15
  WHEN 'buyer_agreement_date' THEN 16
  WHEN 'buyer_expiration_date' THEN 17
  WHEN 'acceptance_date' THEN 18
  WHEN 'listing_date' THEN 19
  WHEN 'listing_expiration_date' THEN 20
  WHEN 'closing_date' THEN 21
  ELSE "sortOrder"
END;

UPDATE "TransactionCustomFieldDefinition"
SET "sortOrder" = "sortOrder" + 100
WHERE "sortOrder" < 100;

CREATE TABLE "ContactFieldSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactFieldSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactCustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TransactionCustomFieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactCustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfferFieldSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferFieldSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfferCustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TransactionCustomFieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferCustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactFieldSetting_organizationId_officeId_fieldKey_key" ON "ContactFieldSetting"("organizationId", "officeId", "fieldKey");
CREATE INDEX "ContactFieldSetting_org_office_visible_order_idx" ON "ContactFieldSetting"("organizationId", "officeId", "isVisible", "sortOrder");

CREATE UNIQUE INDEX "ContactCustomFieldDefinition_organizationId_officeId_fieldKey_key" ON "ContactCustomFieldDefinition"("organizationId", "officeId", "fieldKey");
CREATE INDEX "ContactCustomFieldDefinition_org_office_visible_archived_order_idx" ON "ContactCustomFieldDefinition"("organizationId", "officeId", "isVisible", "isArchived", "sortOrder");

CREATE UNIQUE INDEX "OfferFieldSetting_organizationId_officeId_fieldKey_key" ON "OfferFieldSetting"("organizationId", "officeId", "fieldKey");
CREATE INDEX "OfferFieldSetting_org_office_visible_order_idx" ON "OfferFieldSetting"("organizationId", "officeId", "isVisible", "sortOrder");

CREATE UNIQUE INDEX "OfferCustomFieldDefinition_organizationId_officeId_fieldKey_key" ON "OfferCustomFieldDefinition"("organizationId", "officeId", "fieldKey");
CREATE INDEX "OfferCustomFieldDefinition_org_office_visible_archived_order_idx" ON "OfferCustomFieldDefinition"("organizationId", "officeId", "isVisible", "isArchived", "sortOrder");

CREATE INDEX "TransactionFieldSetting_org_office_visible_order_idx" ON "TransactionFieldSetting"("organizationId", "officeId", "isVisible", "sortOrder");
CREATE INDEX "TransactionCustomFieldDefinition_org_office_visible_archived_order_idx" ON "TransactionCustomFieldDefinition"("organizationId", "officeId", "isVisible", "isArchived", "sortOrder");

ALTER TABLE "ContactFieldSetting"
ADD CONSTRAINT "ContactFieldSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactFieldSetting"
ADD CONSTRAINT "ContactFieldSetting_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactCustomFieldDefinition"
ADD CONSTRAINT "ContactCustomFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactCustomFieldDefinition"
ADD CONSTRAINT "ContactCustomFieldDefinition_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfferFieldSetting"
ADD CONSTRAINT "OfferFieldSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferFieldSetting"
ADD CONSTRAINT "OfferFieldSetting_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfferCustomFieldDefinition"
ADD CONSTRAINT "OfferCustomFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferCustomFieldDefinition"
ADD CONSTRAINT "OfferCustomFieldDefinition_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
