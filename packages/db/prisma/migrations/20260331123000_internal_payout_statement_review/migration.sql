-- CreateEnum
CREATE TYPE "AgentPayoutStatementReviewStatus" AS ENUM ('draft', 'awaiting_agent', 'revision_requested', 'confirmed');

-- CreateEnum
CREATE TYPE "AgentPayoutStatementMessageType" AS ENUM ('sent_to_agent', 'finance_response', 'agent_revision_requested', 'agent_confirmed');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'payout_statement_ready';
ALTER TYPE "NotificationType" ADD VALUE 'payout_statement_revision_requested';
ALTER TYPE "NotificationType" ADD VALUE 'payout_statement_confirmed';

-- AlterTable
ALTER TABLE "AgentPayoutStatement"
ADD COLUMN "agentRespondedAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "lastSharedAt" TIMESTAMP(3),
ADD COLUMN "lastSharedByMembershipId" TEXT,
ADD COLUMN "reviewStatus" "AgentPayoutStatementReviewStatus" NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "AgentPayoutStatementMessage" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "membershipId" TEXT NOT NULL,
    "messageType" "AgentPayoutStatementMessageType" NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPayoutStatementMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentPayoutStatementMessage_statementId_createdAt_idx"
ON "AgentPayoutStatementMessage"("statementId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentPayoutStatementMessage_organizationId_officeId_created_idx"
ON "AgentPayoutStatementMessage"("organizationId", "officeId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentPayoutStatementMessage_membershipId_createdAt_idx"
ON "AgentPayoutStatementMessage"("membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentPayoutStatement_organizationId_reviewStatus_generatedA_idx"
ON "AgentPayoutStatement"("organizationId", "reviewStatus", "generatedAt");

-- AddForeignKey
ALTER TABLE "AgentPayoutStatement"
ADD CONSTRAINT "AgentPayoutStatement_lastSharedByMembershipId_fkey"
FOREIGN KEY ("lastSharedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayoutStatementMessage"
ADD CONSTRAINT "AgentPayoutStatementMessage_statementId_fkey"
FOREIGN KEY ("statementId") REFERENCES "AgentPayoutStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayoutStatementMessage"
ADD CONSTRAINT "AgentPayoutStatementMessage_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayoutStatementMessage"
ADD CONSTRAINT "AgentPayoutStatementMessage_officeId_fkey"
FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayoutStatementMessage"
ADD CONSTRAINT "AgentPayoutStatementMessage_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
