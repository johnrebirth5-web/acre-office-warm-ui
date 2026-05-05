-- Add focused composite indexes for high-read Office and Front Office paths.
-- These indexes do not change application behavior; they reduce scan pressure
-- for existing dashboard, task, activity, mail, library, reports, and pipeline queries.

CREATE INDEX "Transaction_org_office_status_updated_idx"
  ON "Transaction"("organizationId", "officeId", "status", "updatedAt");

CREATE INDEX "Transaction_org_office_status_closing_idx"
  ON "Transaction"("organizationId", "officeId", "status", "closingDate");

CREATE INDEX "Transaction_org_office_status_moveIn_idx"
  ON "Transaction"("organizationId", "officeId", "status", "moveInDate");

CREATE INDEX "TransactionTask_org_status_dueAt_idx"
  ON "TransactionTask"("organizationId", "status", "dueAt");

CREATE INDEX "TransactionTask_org_assignee_status_dueAt_idx"
  ON "TransactionTask"("organizationId", "assigneeMembershipId", "status", "dueAt");

CREATE INDEX "TransactionTask_org_review_status_dueAt_idx"
  ON "TransactionTask"("organizationId", "reviewStatus", "status", "dueAt");

CREATE INDEX "TransactionTask_org_secondary_status_dueAt_idx"
  ON "TransactionTask"("organizationId", "requiresSecondaryApproval", "status", "dueAt");

CREATE INDEX "LibraryDocument_org_office_sort_updated_idx"
  ON "LibraryDocument"("organizationId", "officeId", "sortOrder", "updatedAt");

CREATE INDEX "AuditLog_org_entity_createdAt_idx"
  ON "AuditLog"("organizationId", "entityType", "createdAt");

CREATE INDEX "AuditLog_org_membership_createdAt_idx"
  ON "AuditLog"("organizationId", "membershipId", "createdAt");

CREATE INDEX "OfficeMailParticipant_org_member_archived_thread_idx"
  ON "OfficeMailParticipant"("organizationId", "membershipId", "archivedAt", "threadId");

CREATE INDEX "Offer_org_office_status_updated_idx"
  ON "Offer"("organizationId", "officeId", "status", "updatedAt");

CREATE INDEX "Offer_org_office_status_expiration_idx"
  ON "Offer"("organizationId", "officeId", "status", "expirationAt");

CREATE INDEX "SignatureRequest_org_office_status_sentAt_idx"
  ON "SignatureRequest"("organizationId", "officeId", "status", "sentAt");

CREATE INDEX "IncomingUpdate_org_office_status_received_idx"
  ON "IncomingUpdate"("organizationId", "officeId", "status", "receivedAt");
