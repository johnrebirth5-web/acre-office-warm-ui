UPDATE "TransactionFieldSetting"
SET "fieldKey" = 'purchased_price'::"TransactionFieldKey",
    "updatedAt" = NOW()
WHERE "fieldKey" = 'price';

INSERT INTO "TransactionFieldSetting" (
  "id",
  "organizationId",
  "officeId",
  "fieldKey",
  "isRequired",
  "isVisible",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'migr-purchased-price-' || md5(scope."organizationId" || ':' || COALESCE(scope."officeId", 'global')),
  scope."organizationId",
  scope."officeId",
  'purchased_price'::"TransactionFieldKey",
  false,
  true,
  16,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "organizationId", "officeId"
  FROM "TransactionFieldSetting"
) AS scope
WHERE NOT EXISTS (
  SELECT 1
  FROM "TransactionFieldSetting" existing
  WHERE existing."organizationId" = scope."organizationId"
    AND existing."officeId" IS NOT DISTINCT FROM scope."officeId"
    AND existing."fieldKey" = 'purchased_price'
);

INSERT INTO "TransactionFieldSetting" (
  "id",
  "organizationId",
  "officeId",
  "fieldKey",
  "isRequired",
  "isVisible",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'migr-asking-price-' || md5(scope."organizationId" || ':' || COALESCE(scope."officeId", 'global')),
  scope."organizationId",
  scope."officeId",
  'asking_price'::"TransactionFieldKey",
  false,
  COALESCE(purchased."isVisible", true),
  15,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "organizationId", "officeId"
  FROM "TransactionFieldSetting"
) AS scope
LEFT JOIN "TransactionFieldSetting" purchased
  ON purchased."organizationId" = scope."organizationId"
 AND purchased."officeId" IS NOT DISTINCT FROM scope."officeId"
 AND purchased."fieldKey" = 'purchased_price'
WHERE NOT EXISTS (
  SELECT 1
  FROM "TransactionFieldSetting" existing
  WHERE existing."organizationId" = scope."organizationId"
    AND existing."officeId" IS NOT DISTINCT FROM scope."officeId"
    AND existing."fieldKey" = 'asking_price'
);

INSERT INTO "TransactionFieldSetting" (
  "id",
  "organizationId",
  "officeId",
  "fieldKey",
  "isRequired",
  "isVisible",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'migr-move-in-date-' || md5(scope."organizationId" || ':' || COALESCE(scope."officeId", 'global')),
  scope."organizationId",
  scope."officeId",
  'move_in_date'::"TransactionFieldKey",
  false,
  COALESCE(closing."isVisible", true),
  17,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "organizationId", "officeId"
  FROM "TransactionFieldSetting"
) AS scope
LEFT JOIN "TransactionFieldSetting" closing
  ON closing."organizationId" = scope."organizationId"
 AND closing."officeId" IS NOT DISTINCT FROM scope."officeId"
 AND closing."fieldKey" = 'closing_date'
WHERE NOT EXISTS (
  SELECT 1
  FROM "TransactionFieldSetting" existing
  WHERE existing."organizationId" = scope."organizationId"
    AND existing."officeId" IS NOT DISTINCT FROM scope."officeId"
    AND existing."fieldKey" = 'move_in_date'
);

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
  WHEN 'asking_price' THEN 15
  WHEN 'purchased_price' THEN 16
  WHEN 'move_in_date' THEN 17
  WHEN 'buyer_agreement_date' THEN 18
  WHEN 'buyer_expiration_date' THEN 19
  WHEN 'acceptance_date' THEN 20
  WHEN 'listing_date' THEN 21
  WHEN 'listing_expiration_date' THEN 22
  WHEN 'closing_date' THEN 23
  ELSE "sortOrder"
END,
    "updatedAt" = NOW();
