ALTER TABLE "StudioListingPack"
ADD COLUMN "companyFeedLabel" TEXT;

UPDATE "StudioListingPack"
SET "companyFeedLabel" = 'Acre Featured'
WHERE "companyFeedVisible" = true
  AND ("companyFeedLabel" IS NULL OR btrim("companyFeedLabel") = '');
