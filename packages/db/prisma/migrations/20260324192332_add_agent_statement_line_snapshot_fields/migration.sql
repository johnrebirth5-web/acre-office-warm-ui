-- AlterTable
ALTER TABLE "AgentPayoutStatementLine" ADD COLUMN     "buildingName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "commissionRate" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "invoiceNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ownerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "transactionCreatedAt" TIMESTAMP(3),
ADD COLUMN     "unitNumber" TEXT NOT NULL DEFAULT '';

UPDATE "AgentPayoutStatementLine" AS "line"
SET
  "transactionCreatedAt" = "transaction"."createdAt",
  "invoiceNumber" = COALESCE("transaction"."additionalFields" ->> 'invoiceNumber', ''),
  "ownerName" = COALESCE(
    NULLIF(
      TRIM(CONCAT(COALESCE("ownerUser"."firstName", ''), ' ', COALESCE("ownerUser"."lastName", ''))),
      ''
    ),
    "ownerUser"."email",
    'Unassigned'
  ),
  "buildingName" = COALESCE("transaction"."additionalFields" ->> 'buildingName', ''),
  "unitNumber" = COALESCE("transaction"."additionalFields" ->> 'unitNumber', ''),
  "commissionRate" = COALESCE("transaction"."additionalFields" ->> 'yourCommissionRate', '')
FROM "Transaction" AS "transaction"
LEFT JOIN "Membership" AS "ownerMembership" ON "ownerMembership"."id" = "transaction"."ownerMembershipId"
LEFT JOIN "User" AS "ownerUser" ON "ownerUser"."id" = "ownerMembership"."userId"
WHERE "line"."transactionId" = "transaction"."id";
