ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'asking_price';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'purchased_price';
ALTER TYPE "TransactionFieldKey" ADD VALUE IF NOT EXISTS 'move_in_date';

ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "askingPrice" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "purchasedPrice" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "moveInDate" TIMESTAMP(3);

UPDATE "Transaction"
SET "purchasedPrice" = COALESCE("purchasedPrice", "price")
WHERE "purchasedPrice" IS NULL;

UPDATE "Transaction"
SET "askingPrice" = CASE
  WHEN COALESCE(regexp_replace(COALESCE("additionalFields"->>'askingPrice', ''), '[^0-9.\-]', '', 'g'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
    THEN CAST(regexp_replace(COALESCE("additionalFields"->>'askingPrice', ''), '[^0-9.\-]', '', 'g') AS DECIMAL(12,2))
  ELSE COALESCE("askingPrice", "purchasedPrice", "price")
END
WHERE "askingPrice" IS NULL;

UPDATE "Transaction"
SET "moveInDate" = CASE
  WHEN COALESCE("additionalFields"->>'moveInDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN ("additionalFields"->>'moveInDate')::date::timestamp
  WHEN COALESCE("additionalFields"->>'moveInDateClosingDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN ("additionalFields"->>'moveInDateClosingDate')::date::timestamp
  ELSE "moveInDate"
END
WHERE "moveInDate" IS NULL;
