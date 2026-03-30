-- CreateIndex
CREATE INDEX "Transaction_organizationId_officeId_updatedAt_idx" ON "Transaction"("organizationId", "officeId", "updatedAt");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_officeId_closingDate_idx" ON "Transaction"("organizationId", "officeId", "closingDate");

-- CreateIndex
CREATE INDEX "Client_organizationId_nextFollowUpAt_idx" ON "Client"("organizationId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "FollowUpTask_organizationId_dueAt_idx" ON "FollowUpTask"("organizationId", "dueAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
