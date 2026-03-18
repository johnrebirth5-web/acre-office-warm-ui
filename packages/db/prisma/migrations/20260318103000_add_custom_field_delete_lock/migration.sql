ALTER TABLE "TransactionCustomFieldDefinition"
ADD COLUMN "isDeletionLocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ContactCustomFieldDefinition"
ADD COLUMN "isDeletionLocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OfferCustomFieldDefinition"
ADD COLUMN "isDeletionLocked" BOOLEAN NOT NULL DEFAULT false;
