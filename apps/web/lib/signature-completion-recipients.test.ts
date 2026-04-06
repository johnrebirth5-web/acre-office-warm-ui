import assert from "node:assert/strict";
import test from "node:test";
import type { OfficeSignatureRequest } from "@acre/db";
import { listSignatureCompletionRecipients } from "./signature-completion-recipients.ts";

function buildSignatureRequest(overrides: Partial<OfficeSignatureRequest> = {}): OfficeSignatureRequest {
  return {
    id: overrides.id ?? "request-1",
    templateId: overrides.templateId ?? null,
    formId: overrides.formId ?? null,
    documentId: overrides.documentId ?? "document-1",
    documentTitle: overrides.documentTitle ?? "Offer package",
    documentHref: overrides.documentHref ?? "",
    completedDocumentId: overrides.completedDocumentId ?? null,
    completedDocumentTitle: overrides.completedDocumentTitle ?? "",
    completedDocumentHref: overrides.completedDocumentHref ?? "",
    recipientName: overrides.recipientName ?? "Primary signer",
    recipientEmail: overrides.recipientEmail ?? "primary@example.com",
    recipientRole: overrides.recipientRole ?? "Signer",
    emailSubject: overrides.emailSubject ?? "",
    emailBody: overrides.emailBody ?? "",
    signingOrder: overrides.signingOrder ?? 1,
    senderDisplayName: overrides.senderDisplayName ?? "Acre Signatures",
    senderReplyTo: overrides.senderReplyTo ?? "ops@example.com",
    statusKey: overrides.statusKey ?? "completed",
    status: overrides.status ?? "Completed",
    contextType: overrides.contextType ?? "transaction",
    contextId: overrides.contextId ?? "tx-1",
    contextLabel: overrides.contextLabel ?? "123 Main St",
    driveSyncStatus: overrides.driveSyncStatus ?? "not_configured",
    driveSyncStatusLabel: overrides.driveSyncStatusLabel ?? "Not configured",
    driveSyncError: overrides.driveSyncError ?? "",
    driveSyncedAt: overrides.driveSyncedAt ?? "",
    driveFolderId: overrides.driveFolderId ?? "",
    driveFileId: overrides.driveFileId ?? "",
    expiresAt: overrides.expiresAt ?? "",
    sentAt: overrides.sentAt ?? "",
    firstViewedAt: overrides.firstViewedAt ?? "",
    viewedAt: overrides.viewedAt ?? "",
    signedAt: overrides.signedAt ?? "",
    completedAt: overrides.completedAt ?? "",
    declinedAt: overrides.declinedAt ?? "",
    canceledAt: overrides.canceledAt ?? "",
    expiredAt: overrides.expiredAt ?? "",
    createdAt: overrides.createdAt ?? "",
    updatedAt: overrides.updatedAt ?? "",
    recipients: overrides.recipients ?? [],
    ccRecipients: overrides.ccRecipients ?? [],
    artifacts: overrides.artifacts ?? [],
    templateSummary: overrides.templateSummary ?? null,
    contextSummary: overrides.contextSummary ?? {
      type: "transaction",
      id: "tx-1",
      label: "123 Main St"
    }
  };
}

test("listSignatureCompletionRecipients returns all participants plus reply-to without duplicates", () => {
  const recipients = listSignatureCompletionRecipients(
    buildSignatureRequest({
      recipientEmail: "primary@example.com",
      senderReplyTo: "ops@example.com",
      recipients: [
        {
          id: "signer-1",
          roleKey: "signer",
          role: "Signer",
          name: "Signer One",
          email: "primary@example.com",
          recipientRole: "Signer",
          routingStep: 1,
          sortOrder: 0,
          statusKey: "acted",
          status: "Acted",
          sentAt: "",
          firstViewedAt: "",
          viewedAt: "",
          actedAt: "",
          declinedAt: "",
          tokenIssued: true
        },
        {
          id: "approver-1",
          roleKey: "approver",
          role: "Approver",
          name: "Office Admin",
          email: "admin@example.com",
          recipientRole: "Admin",
          routingStep: 2,
          sortOrder: 1,
          statusKey: "acted",
          status: "Acted",
          sentAt: "",
          firstViewedAt: "",
          viewedAt: "",
          actedAt: "",
          declinedAt: "",
          tokenIssued: true
        },
        {
          id: "cc-1",
          roleKey: "cc",
          role: "CC",
          name: "Operations",
          email: "ops@example.com",
          recipientRole: "CC",
          routingStep: 0,
          sortOrder: 2,
          statusKey: "sent",
          status: "Sent",
          sentAt: "",
          firstViewedAt: "",
          viewedAt: "",
          actedAt: "",
          declinedAt: "",
          tokenIssued: true
        }
      ]
    })
  );

  assert.deepEqual(recipients, ["primary@example.com", "admin@example.com", "ops@example.com"]);
});

test("listSignatureCompletionRecipients ignores blank entries and dedupes case-insensitively", () => {
  const recipients = listSignatureCompletionRecipients(
    buildSignatureRequest({
      recipientEmail: "   ",
      senderReplyTo: "TEAM@example.com",
      recipients: [
        {
          id: "signer-1",
          roleKey: "signer",
          role: "Signer",
          name: "Signer One",
          email: "team@example.com",
          recipientRole: "Signer",
          routingStep: 1,
          sortOrder: 0,
          statusKey: "acted",
          status: "Acted",
          sentAt: "",
          firstViewedAt: "",
          viewedAt: "",
          actedAt: "",
          declinedAt: "",
          tokenIssued: true
        },
        {
          id: "signer-2",
          roleKey: "signer",
          role: "Signer",
          name: "Signer Two",
          email: "second@example.com",
          recipientRole: "Signer",
          routingStep: 1,
          sortOrder: 1,
          statusKey: "acted",
          status: "Acted",
          sentAt: "",
          firstViewedAt: "",
          viewedAt: "",
          actedAt: "",
          declinedAt: "",
          tokenIssued: true
        }
      ]
    })
  );

  assert.deepEqual(recipients, ["team@example.com", "second@example.com"]);
});
