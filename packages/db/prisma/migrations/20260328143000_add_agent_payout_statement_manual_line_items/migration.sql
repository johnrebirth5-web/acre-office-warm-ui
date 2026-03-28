CREATE TABLE "AgentPayoutStatementManualLineItem" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "membershipId" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPayoutStatementManualLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentPayoutStatementManualLineItem_statementId_createdAt_idx"
ON "AgentPayoutStatementManualLineItem"("statementId", "createdAt");

CREATE INDEX "AgentPayoutStatementManualLineItem_organizationId_officeId_c_idx"
ON "AgentPayoutStatementManualLineItem"("organizationId", "officeId", "createdAt");

CREATE INDEX "AgentPayoutStatementManualLineItem_membershipId_createdAt_idx"
ON "AgentPayoutStatementManualLineItem"("membershipId", "createdAt");

CREATE INDEX "AgentPayoutStatementManualLineItem_createdByMembershipId__idx"
ON "AgentPayoutStatementManualLineItem"("createdByMembershipId", "createdAt");

ALTER TABLE "AgentPayoutStatementManualLineItem"
ADD CONSTRAINT "AgentPayoutStatementManualLineItem_statementId_fkey"
FOREIGN KEY ("statementId") REFERENCES "AgentPayoutStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentPayoutStatementManualLineItem"
ADD CONSTRAINT "AgentPayoutStatementManualLineItem_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentPayoutStatementManualLineItem"
ADD CONSTRAINT "AgentPayoutStatementManualLineItem_officeId_fkey"
FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentPayoutStatementManualLineItem"
ADD CONSTRAINT "AgentPayoutStatementManualLineItem_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentPayoutStatementManualLineItem"
ADD CONSTRAINT "AgentPayoutStatementManualLineItem_createdByMembershi_fkey"
FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
