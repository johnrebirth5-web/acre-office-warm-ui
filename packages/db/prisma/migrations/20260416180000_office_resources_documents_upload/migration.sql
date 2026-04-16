-- Allow office-managed resources to store uploaded PDFs instead of requiring
-- external URLs for every document record.
ALTER TABLE "Resource"
ALTER COLUMN "url" DROP NOT NULL;

ALTER TABLE "Resource"
ADD COLUMN "originalFileName" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "fileSizeBytes" INTEGER,
ADD COLUMN "storageKey" TEXT;

-- Collapse legacy resource subtypes into the FO-aligned document lane.
UPDATE "Resource"
SET "type" = 'document'
WHERE "type" IN ('playbook', 'template');

-- BO resources now publish immediately by default so existing drafts should
-- not stay hidden from the FO directory.
UPDATE "Resource"
SET "isPublished" = TRUE
WHERE "isPublished" = FALSE;
