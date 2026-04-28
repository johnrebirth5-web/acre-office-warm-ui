-- Normalize the public company names used by the Acre office switcher.
UPDATE "Office"
SET
    "name" = 'Acre NY Realty Inc',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "organizationId" IN (
    SELECT "id"
    FROM "Organization"
    WHERE "slug" = 'acre'
)
  AND (
    "slug" = 'acre-ny-realty'
    OR "name" IN ('Acre NY Realty', 'ACRE NY REALTY INC')
  );

UPDATE "Office"
SET
    "name" = 'Acre NY Rentals LLC',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "organizationId" IN (
    SELECT "id"
    FROM "Organization"
    WHERE "slug" = 'acre'
)
  AND (
    "slug" = 'acre-ny-rental'
    OR "name" IN ('Acre NY Rental', 'Acre NY Rentals LLC')
  );
