CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "StudioListingPack"
ADD COLUMN "legacyShareCode" TEXT,
ADD COLUMN "legacyShareCodeExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "StudioListingPack_legacyShareCode_key" ON "StudioListingPack"("legacyShareCode");

-- Rotate weak Studio listing pack share codes into legacy column with 60-day grace period.
-- Sanity gate: this is expected to touch a small handful of rows (audit identified 3
-- as of 2026-04-19). Abort if we see substantially more; something else is wrong.
DO $$
DECLARE
  weak_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO weak_count
  FROM "StudioListingPack"
  WHERE "shareCode" IS NOT NULL
    AND LENGTH("shareCode") <= 15;

  IF weak_count > 25 THEN
    RAISE EXCEPTION 'Refusing to rotate % weak share codes; expected <= 25. Investigate before re-running.', weak_count;
  END IF;
END $$;

-- Move weak codes to legacy column; mint a new strong code in shareCode.
-- New code format matches createStudioListingPackShareCode() in studio-listings.ts:
--   pack_ + base64url(24 random bytes) = pack_ + 32 chars
UPDATE "StudioListingPack"
SET
  "legacyShareCode" = "shareCode",
  "legacyShareCodeExpiresAt" = NOW() + INTERVAL '60 days',
  "shareCode" = 'pack_' || translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_')
WHERE
  "shareCode" IS NOT NULL
  AND LENGTH("shareCode") <= 15;
