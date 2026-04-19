import { createHash } from "node:crypto";

import {
  IncomingUpdateStatus,
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  SignatureAuditEventType,
  SignatureDriveSyncStatus,
  SignatureFieldType,
  SignatureRecipientRole,
  SignatureRecipientStatus,
  SignatureRequestStatus,
  SignatureTemplateCategory,
  TransactionDocumentSource,
  TransactionDocumentStatus,
  TransactionFormStatus,
  TransactionRepresenting,
  TransactionStatus,
  TransactionType
} from "@prisma/client";

import { activityLogActions, recordActivityLogEvent } from "../activity-log";

import { prisma } from "../client";

import { createNotificationsForMemberships, listOfficeNotificationRecipientIds } from "../notifications";

import { reconcileTransactionTaskDocumentWorkflow } from "../transaction-tasks";

import { CreateIncomingUpdateInput, CreateSignatureRequestInput, CreateTransactionDocumentInput, CreateTransactionFormInput, IncomingUpdateRecord, MergeContextOffer, MergeContextTransaction, OfficeFormTemplateOption, OfficeIncomingUpdate, OfficeSignatureArtifact, OfficeSignatureAuditEntry, OfficeSignatureEditorSnapshot, OfficeSignatureField, OfficeSignatureFieldValue, OfficeSignatureRecipient, OfficeSignatureRequest, OfficeTransactionDocument, OfficeTransactionDocumentFilter, OfficeTransactionDocumentsSnapshot, OfficeTransactionForm, PrepareTransactionFormDraftInput, PreparedTransactionFormDraft, PublicSignatureRequestSnapshot, ReplaceSignatureFieldsInput, ReviewIncomingUpdateInput, SignatureAuditEntryRecord, SignatureRequestRecord, TransactionDocumentRecord, TransactionFormRecord, UpdateSignatureRequestInput, UpdateTransactionDocumentInput, UpdateTransactionFormInput, documentSourceLabelMap, documentStatusLabelMap, formStatusLabelMap, incomingUpdateStatusLabelMap, signatureAuditEventLabelMap, signatureDriveStatusLabelMap, signatureRecipientRoleLabelMap, signatureRecipientStatusLabelMap, signatureStatusLabelMap, transactionRepresentingLabelMap, transactionStatusLabelMap, transactionTypeLabelMap } from "./types";
import { buildChanges, buildDocumentHref, buildDocumentObjectLabel, buildFormObjectLabel, buildIncomingUpdateObjectLabel, buildLegacyPublicRecipient, buildOfferObjectLabel, buildSignatureRequestEditorHref, buildTaskHref, buildTransactionFormPayload, buildTransactionObjectLabel, clampRelativeMetric, collectSubmittedFieldValues, deriveEnvelopeStatusFromRecipients, formatCurrency, formatDateTimeValue, formatDateValue, formatMembershipName, getActiveRoutingStepRecipients, getOfferMergeContext, getPublicSignatureDocumentStorageRecord, getPublicSignatureRequestRecord, getPublicSignatureRequestSnapshot, getSignatureEditorSnapshot, getSignatureRequestRecord, getTransactionDocumentStorageRecord, getTransactionMergeContext, getValidatedOfferLink, hashSignatureToken, isRecipientTerminalStatus, listTransactionDocumentsSnapshot, mapIncomingUpdate, mapSignatureArtifact, mapSignatureAuditEntry, mapSignatureField, mapSignatureRecipient, mapSignatureRequest, mapTransactionDocument, mapTransactionForm, normalizeJsonRecord, normalizeSubmittedFieldValues, parseOptionalDate, reconcileLinkedWorkflowTasks, recordSignatureAuditEntry, replaceSignatureRequestFields, resolveSignatureStatus, syncFormAndDocumentSignatureState, toInputJsonValue } from "./readers";
import { createTransactionDocument, createTransactionForm, deleteTransactionDocument, listTransactionFormTemplates, prepareTransactionFormDraft, recordTransactionDocumentOpened, updateTransactionDocument, updateTransactionForm } from "./documents";
import { buildIncomingTransactionChanges, createIncomingUpdate, reviewIncomingUpdate } from "./incoming-updates";

export function normalizeSignatureRecipients(input: CreateSignatureRequestInput) {
  const signerRecipients =
    input.recipients && input.recipients.length > 0
      ? input.recipients
      : [
          {
            role: SignatureRecipientRole.signer,
            name: input.recipientName,
            email: input.recipientEmail,
            recipientRole: input.recipientRole,
            routingStep: input.signingOrder ?? 1,
            sortOrder: 0
          }
        ];

  const normalizedSigners = signerRecipients.map((recipient, index) => ({
    role: recipient.role ?? SignatureRecipientRole.signer,
    name: recipient.name.trim(),
    email: recipient.email.trim(),
    recipientRole: recipient.recipientRole.trim(),
    routingStep: Math.max(1, recipient.routingStep ?? input.signingOrder ?? index + 1),
    sortOrder: recipient.sortOrder ?? index
  }));

  const normalizedCcRecipients = (input.ccRecipients ?? []).map((recipient, index) => ({
    role: SignatureRecipientRole.cc,
    name: recipient.name.trim(),
    email: recipient.email.trim(),
    recipientRole: recipient.recipientRole.trim(),
    routingStep: 9999,
    sortOrder: recipient.sortOrder ?? normalizedSigners.length + index
  }));

  const recipients = [...normalizedSigners, ...normalizedCcRecipients].filter(
    (recipient) => recipient.name && recipient.email && recipient.recipientRole
  );

  const primarySigner =
    recipients.find((recipient) => recipient.role !== SignatureRecipientRole.cc) ??
    recipients[0] ?? {
      role: SignatureRecipientRole.signer,
      name: input.recipientName.trim(),
      email: input.recipientEmail.trim(),
      recipientRole: input.recipientRole.trim(),
      routingStep: input.signingOrder ?? 1,
      sortOrder: 0
    };

  return {
    recipients,
    primarySigner
  };
}



export async function createSignatureRequest(input: CreateSignatureRequestInput): Promise<OfficeSignatureRequest | null> {
  const signatureRequestId = await prisma.$transaction(async (tx) => {
    const [transaction, form, document, linkedOffer, existingRequest] = await Promise.all([
      tx.transaction.findFirst({
        where: {
          id: input.transactionId,
          organizationId: input.organizationId
        },
        select: {
          id: true,
          officeId: true,
          title: true,
          address: true,
          city: true,
          state: true
        }
      }),
      input.formId
        ? tx.transactionForm.findFirst({
            where: {
              id: input.formId,
              transactionId: input.transactionId,
              organizationId: input.organizationId
            }
          })
        : Promise.resolve(null),
      input.documentId
        ? tx.transactionDocument.findFirst({
            where: {
              id: input.documentId,
              transactionId: input.transactionId,
              organizationId: input.organizationId
            }
          })
        : Promise.resolve(null),
      getValidatedOfferLink(tx, input.organizationId, input.transactionId, input.offerId)
      ,
      input.signatureRequestId
        ? tx.signatureRequest.findFirst({
            where: {
              id: input.signatureRequestId,
              organizationId: input.organizationId,
              transactionId: input.transactionId
            }
          })
        : Promise.resolve(null)
    ]);

    if (!transaction || (!form && !document)) {
      return null;
    }

    if (document && document.mimeType.toLowerCase() !== "application/pdf") {
      throw new Error("Only PDF documents can use the external signature workflow.");
    }

    const effectiveOfferId = linkedOffer?.id ?? form?.offerId ?? document?.offerId ?? null;
    if (input.offerId && !effectiveOfferId) {
      return null;
    }

    const { recipients, primarySigner } = normalizeSignatureRecipients(input);

    if (!primarySigner.name || !primarySigner.email || !primarySigner.recipientRole) {
      throw new Error("At least one signer is required.");
    }

    const expiresAt = parseOptionalDate(input.expiresAt ?? undefined);
    const payload = {
      officeId: input.officeId ?? transaction.officeId ?? null,
      offerId: effectiveOfferId,
      formId: form?.id ?? null,
      documentId: document?.id ?? form?.documentId ?? null,
      subjectMembershipId: input.subjectMembershipId?.trim() || null,
      templateId: input.templateId?.trim() || null,
      contextType: input.contextType ?? "transaction",
      contextId: input.contextId?.trim() || null,
      contextLabel: input.contextLabel?.trim() || null,
      recipientName: primarySigner.name,
      recipientEmail: primarySigner.email,
      recipientRole: primarySigner.recipientRole,
      emailSubject: input.emailSubject?.trim() || null,
      emailBody: input.emailBody?.trim() || null,
      signingOrder: primarySigner.routingStep ?? input.signingOrder ?? null,
      senderDisplayName: input.senderDisplayName?.trim() || null,
      senderReplyTo: input.senderReplyTo?.trim() || null,
      expiresAt,
      status:
        existingRequest?.status === SignatureRequestStatus.sent ||
        existingRequest?.status === SignatureRequestStatus.viewed ||
        existingRequest?.status === SignatureRequestStatus.signed
          ? existingRequest.status
          : SignatureRequestStatus.draft
    } satisfies Prisma.SignatureRequestUncheckedUpdateInput;

    if (existingRequest) {
      await tx.signatureRequest.update({
        where: {
          id: existingRequest.id
        },
        data: {
          ...payload,
          completedDocumentId: null,
          driveSyncStatus: SignatureDriveSyncStatus.not_configured,
          driveSyncError: null,
          driveSyncedAt: null,
          driveFolderId: null,
          driveFileId: null,
          publicTokenHash: existingRequest.publicTokenHash,
          firstViewedAt: existingRequest.firstViewedAt,
          viewedAt: existingRequest.viewedAt,
          signedAt: existingRequest.signedAt,
          completedAt: existingRequest.completedAt,
          canceledAt: existingRequest.canceledAt,
          expiredAt: existingRequest.expiredAt
        }
      });

      await tx.signatureRecipient.deleteMany({
        where: {
          signatureRequestId: existingRequest.id
        }
      });

      if (recipients.length > 0) {
        await tx.signatureRecipient.createMany({
          data: recipients.map((recipient, index) => ({
            organizationId: input.organizationId,
            officeId: payload.officeId,
            transactionId: input.transactionId,
            signatureRequestId: existingRequest.id,
            role: recipient.role,
            name: recipient.name,
            email: recipient.email,
            recipientRole: recipient.recipientRole,
            routingStep: recipient.routingStep,
            sortOrder: recipient.sortOrder ?? index,
            status: SignatureRecipientStatus.draft
          }))
        });
      }

      return existingRequest.id;
    }

    const created = await tx.signatureRequest.create({
      data: {
        organizationId: input.organizationId,
        officeId: payload.officeId,
        transactionId: input.transactionId,
        offerId: payload.offerId,
        formId: payload.formId,
        documentId: payload.documentId,
        subjectMembershipId: payload.subjectMembershipId,
        templateId: payload.templateId,
        contextType: payload.contextType,
        contextId: payload.contextId,
        contextLabel: payload.contextLabel,
        requestedByMembershipId: input.actorMembershipId,
        recipientName: payload.recipientName,
        recipientEmail: payload.recipientEmail,
        recipientRole: payload.recipientRole,
        emailSubject: payload.emailSubject,
        emailBody: payload.emailBody,
        signingOrder: payload.signingOrder,
        senderDisplayName: payload.senderDisplayName,
        senderReplyTo: payload.senderReplyTo,
        expiresAt: payload.expiresAt,
        status: SignatureRequestStatus.draft
      }
    });

    if (recipients.length > 0) {
      await tx.signatureRecipient.createMany({
        data: recipients.map((recipient, index) => ({
          organizationId: input.organizationId,
          officeId: payload.officeId,
          transactionId: input.transactionId,
          signatureRequestId: created.id,
          role: recipient.role,
          name: recipient.name,
          email: recipient.email,
          recipientRole: recipient.recipientRole,
          routingStep: recipient.routingStep,
          sortOrder: recipient.sortOrder ?? index,
          status: SignatureRecipientStatus.draft
        }))
      });
    }

    await recordSignatureAuditEntry(tx, {
      signatureRequestId: created.id,
      eventType: SignatureAuditEventType.request_created,
      actorMembershipId: input.actorMembershipId,
      actorLabel: "Internal team member",
      details: {
        recipient: created.recipientEmail,
        recipients: String(recipients.length),
        document: document?.title ?? form?.name ?? "Signature request"
      }
    });

    return created.id;
  });

  if (!signatureRequestId) {
    return null;
  }

  const request = await prisma.signatureRequest.findUnique({
    where: {
      id: signatureRequestId
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          category: true
        }
      },
      document: {
        select: {
          id: true,
          title: true,
          transactionId: true
        }
      },
      completedDocument: {
        select: {
          id: true,
          title: true,
          transactionId: true
        }
      },
      recipients: {
        orderBy: [{ sortOrder: "asc" }]
      },
      artifacts: true
    }
  });

  return request ? mapSignatureRequest(request) : null;
}



export async function updateSignatureRequest(input: UpdateSignatureRequestInput): Promise<OfficeSignatureRequest | null> {
  const requestId = await prisma.$transaction(async (tx) => {
    const existing = await tx.signatureRequest.findFirst({
      where: {
        id: input.signatureRequestId,
        transactionId: input.transactionId,
        organizationId: input.organizationId
      },
      include: {
        transaction: {
          select: {
            id: true,
            officeId: true,
            ownerMembershipId: true,
            title: true,
            address: true,
            city: true,
            state: true
          }
        },
        form: {
          select: {
            id: true,
            name: true,
            linkedTaskId: true
          }
        },
        document: {
          select: {
            id: true,
            title: true,
            linkedTaskId: true
          }
        },
        completedDocument: {
          select: {
            id: true,
            title: true,
            transactionId: true
          }
        },
        recipients: {
          orderBy: [{ sortOrder: "asc" }]
        }
      }
    });

    if (!existing) {
      return null;
    }

    const now = new Date();
    const effectiveStatus = resolveSignatureStatus(existing);

    if ((input.action === "send" || input.action === "resend") && existing.recipients.length === 0 && !input.tokenHash?.trim()) {
      throw new Error("A public signing token is required before sending the signature email.");
    }

    if (input.action === "completed" && !input.completedDocumentId?.trim()) {
      throw new Error("A completed signed PDF document is required before marking the request completed.");
    }

    if (effectiveStatus === SignatureRequestStatus.completed && input.action !== "completed") {
      throw new Error("This signature request is already in a terminal state.");
    }

    if (
      (effectiveStatus === SignatureRequestStatus.canceled || effectiveStatus === SignatureRequestStatus.voided) &&
      input.action !== "resend" &&
      input.action !== "advance"
    ) {
      throw new Error("This signature request is already in a terminal state.");
    }

    if (
      input.action === "resend" &&
      effectiveStatus !== SignatureRequestStatus.draft &&
      effectiveStatus !== SignatureRequestStatus.sent &&
      effectiveStatus !== SignatureRequestStatus.viewed &&
      effectiveStatus !== SignatureRequestStatus.expired &&
      effectiveStatus !== SignatureRequestStatus.canceled &&
      effectiveStatus !== SignatureRequestStatus.voided
    ) {
      throw new Error("Only pending or expired signature requests can be resent.");
    }

    let nextStatus: SignatureRequestStatus = effectiveStatus;
    const updateData: Prisma.SignatureRequestUpdateInput = {};
    let nextRecipientDetails = existing.recipients.map((recipient) => ({ ...recipient }));

    switch (input.action) {
      case "send":
      case "resend":
      case "advance":
        nextStatus = SignatureRequestStatus.sent;
        updateData.status = nextStatus;
        if (input.action !== "advance") {
          updateData.publicTokenHash = existing.recipients.length > 0 ? null : input.tokenHash?.trim() || null;
          updateData.sentAt = now;
          updateData.firstViewedAt = null;
          updateData.viewedAt = null;
          updateData.signedAt = null;
          updateData.completedAt = null;
          updateData.canceledAt = null;
          updateData.expiredAt = null;
          updateData.declinedAt = null;
          updateData.completedDocument = {
            disconnect: true
          };
        } else {
          updateData.sentAt = existing.sentAt ?? now;
        }
        if (existing.recipients.length > 0) {
          const activeRecipients = getActiveRoutingStepRecipients(existing.recipients);
          const providedTokens = new Map((input.recipientTokens ?? []).map((entry) => [entry.recipientId, entry.tokenHash.trim()]));

          if (activeRecipients.length === 0) {
            throw new Error("There are no actionable recipients left to send.");
          }

          if (providedTokens.size < activeRecipients.length) {
            throw new Error("Recipient tokens are required for the current routing step.");
          }

          for (const recipient of existing.recipients) {
            if (recipient.role === SignatureRecipientRole.cc) {
              await tx.signatureRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: SignatureRecipientStatus.sent,
                  sentAt: now
                }
              });
              continue;
            }

            if (activeRecipients.some((activeRecipient) => activeRecipient.id === recipient.id)) {
              const tokenHash = providedTokens.get(recipient.id);

              await tx.signatureRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: SignatureRecipientStatus.sent,
                  tokenHash,
                  sentAt: now,
                  firstViewedAt: input.action === "advance" ? recipient.firstViewedAt : null,
                  viewedAt: input.action === "advance" ? recipient.viewedAt : null,
                  actedAt: input.action === "advance" ? recipient.actedAt : null,
                  declinedAt: input.action === "advance" ? recipient.declinedAt : null,
                  voidedAt: input.action === "advance" ? recipient.voidedAt : null,
                  expiredAt: input.action === "advance" ? recipient.expiredAt : null
                }
              });
              continue;
            }

            if (!isRecipientTerminalStatus(recipient.status)) {
              await tx.signatureRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: SignatureRecipientStatus.pending
                }
              });
            }
          }

          nextRecipientDetails = await tx.signatureRecipient.findMany({
            where: {
              signatureRequestId: existing.id
            },
            orderBy: [{ sortOrder: "asc" }]
          });
          nextStatus = deriveEnvelopeStatusFromRecipients(nextStatus, nextRecipientDetails);
          updateData.status = nextStatus;
        }
        break;
      case "viewed":
        if (existing.recipients.length > 0) {
          const targetRecipient =
            existing.recipients.find((recipient) => recipient.id === input.recipientId) ??
            getActiveRoutingStepRecipients(existing.recipients)[0] ??
            existing.recipients[0];

          if (!targetRecipient) {
            throw new Error("Recipient not found.");
          }

          await tx.signatureRecipient.update({
            where: { id: targetRecipient.id },
            data: {
              status: SignatureRecipientStatus.viewed,
              firstViewedAt: targetRecipient.firstViewedAt ?? now,
              viewedAt: now
            }
          });
          nextRecipientDetails = await tx.signatureRecipient.findMany({
            where: { signatureRequestId: existing.id },
            orderBy: [{ sortOrder: "asc" }]
          });
          nextStatus = deriveEnvelopeStatusFromRecipients(nextStatus, nextRecipientDetails);
          updateData.status = nextStatus;
        } else {
          nextStatus = SignatureRequestStatus.viewed;
          updateData.status = nextStatus;
        }
        updateData.firstViewedAt = existing.firstViewedAt ?? now;
        updateData.viewedAt = now;
        break;
      case "signed":
        if (existing.recipients.length > 0) {
          const targetRecipient =
            existing.recipients.find((recipient) => recipient.id === input.recipientId) ??
            getActiveRoutingStepRecipients(existing.recipients)[0] ??
            existing.recipients[0];

          if (!targetRecipient) {
            throw new Error("Recipient not found.");
          }

          await tx.signatureRecipient.update({
            where: { id: targetRecipient.id },
            data: {
              status: SignatureRecipientStatus.acted,
              submittedValues: input.submittedValues ? toInputJsonValue(input.submittedValues) : Prisma.JsonNull,
              actedAt: now
            }
          });
          nextRecipientDetails = await tx.signatureRecipient.findMany({
            where: { signatureRequestId: existing.id },
            orderBy: [{ sortOrder: "asc" }]
          });
          nextStatus = deriveEnvelopeStatusFromRecipients(nextStatus, nextRecipientDetails);
          updateData.status = nextStatus;
        } else {
          nextStatus = SignatureRequestStatus.signed;
          updateData.status = nextStatus;
        }
        updateData.signedAt = now;
        break;
      case "completed":
        nextStatus = SignatureRequestStatus.completed;
        updateData.status = nextStatus;
        updateData.completedAt = now;
        updateData.completedDocument = {
          connect: {
            id: input.completedDocumentId!
          }
        };
        break;
      case "declined":
        if (existing.recipients.length > 0) {
          const targetRecipient =
            existing.recipients.find((recipient) => recipient.id === input.recipientId) ??
            getActiveRoutingStepRecipients(existing.recipients)[0] ??
            existing.recipients[0];

          if (!targetRecipient) {
            throw new Error("Recipient not found.");
          }

          await tx.signatureRecipient.update({
            where: { id: targetRecipient.id },
            data: {
              status: SignatureRecipientStatus.declined,
              declinedAt: now
            }
          });
          nextRecipientDetails = await tx.signatureRecipient.findMany({
            where: { signatureRequestId: existing.id },
            orderBy: [{ sortOrder: "asc" }]
          });
          nextStatus = deriveEnvelopeStatusFromRecipients(nextStatus, nextRecipientDetails);
          updateData.status = nextStatus;
        } else {
          nextStatus = SignatureRequestStatus.declined;
          updateData.status = nextStatus;
        }
        updateData.declinedAt = now;
        break;
      case "canceled":
        nextStatus = SignatureRequestStatus.voided;
        updateData.status = nextStatus;
        updateData.canceledAt = now;
        if (existing.recipients.length > 0) {
          await tx.signatureRecipient.updateMany({
            where: {
              signatureRequestId: existing.id,
              status: {
                notIn: [SignatureRecipientStatus.acted, SignatureRecipientStatus.declined]
              }
            },
            data: {
              status: SignatureRecipientStatus.voided,
              voidedAt: now
            }
          });
          nextRecipientDetails = await tx.signatureRecipient.findMany({
            where: { signatureRequestId: existing.id },
            orderBy: [{ sortOrder: "asc" }]
          });
        }
        break;
      case "expire":
        nextStatus = SignatureRequestStatus.expired;
        updateData.status = nextStatus;
        updateData.expiredAt = now;
        if (existing.recipients.length > 0) {
          await tx.signatureRecipient.updateMany({
            where: {
              signatureRequestId: existing.id,
              status: {
                notIn: [SignatureRecipientStatus.acted, SignatureRecipientStatus.declined, SignatureRecipientStatus.voided]
              }
            },
            data: {
              status: SignatureRecipientStatus.expired,
              expiredAt: now
            }
          });
          nextRecipientDetails = await tx.signatureRecipient.findMany({
            where: { signatureRequestId: existing.id },
            orderBy: [{ sortOrder: "asc" }]
          });
        }
        break;
    }

    const saved = await tx.signatureRequest.update({
      where: {
        id: existing.id
      },
      data: updateData
    });

    await syncFormAndDocumentSignatureState(tx, {
      formId: existing.formId,
      documentId: existing.documentId
    });

    const action =
      input.action === "send" || input.action === "resend" || input.action === "advance"
        ? activityLogActions.signatureRequestSent
        : input.action === "completed"
          ? activityLogActions.signatureCompleted
        : input.action === "declined"
          ? activityLogActions.signatureDeclined
          : activityLogActions.signatureUpdated;

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? null,
      entityType: "signature_request",
      entityId: saved.id,
      action,
      payload: {
        officeId: existing.transaction.officeId,
        transactionId: input.transactionId,
        transactionLabel: buildTransactionObjectLabel(existing.transaction),
        objectLabel: existing.document?.title ?? existing.form?.name ?? "Signature request",
        details: [
          `Recipient: ${saved.recipientName}`,
          `Role: ${saved.recipientRole}`,
          `Status: ${signatureStatusLabelMap[saved.status]}`
        ],
        changes: buildChanges(signatureStatusLabelMap[effectiveStatus], signatureStatusLabelMap[saved.status], "Signature status"),
        contextHref: `/office/transactions/${input.transactionId}#transaction-forms-signatures`
      }
    });

    if (input.action === "send" || input.action === "resend" || input.action === "advance" || input.action === "completed") {
      const notificationType =
        input.action === "send" || input.action === "resend" || input.action === "advance"
          ? NotificationType.signature_pending
          : NotificationType.signature_completed;
      const notificationTitle =
        input.action === "send" || input.action === "resend" || input.action === "advance"
          ? `Signature pending: ${existing.document?.title ?? existing.form?.name ?? existing.transaction.title}`
          : `Signature completed: ${existing.document?.title ?? existing.form?.name ?? existing.transaction.title}`;
      const notificationBody =
        input.action === "send" || input.action === "resend" || input.action === "advance"
          ? `${saved.recipientName} still needs to complete this signature request.`
          : `${saved.recipientName} completed this signature request.`;

      await createNotificationsForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: existing.transaction.officeId,
        membershipIds: [existing.transaction.ownerMembershipId ?? "", existing.requestedByMembershipId],
        restrictToOfficeRoles: true,
        type: notificationType,
        category: NotificationCategory.signature,
        severity: input.action === "send" || input.action === "advance" ? NotificationSeverity.warning : NotificationSeverity.info,
        entityType: NotificationEntityType.signature_request,
        entityId: saved.id,
        title: notificationTitle,
        body: notificationBody,
        actionUrl: `/office/transactions/${input.transactionId}#transaction-forms-signatures`
      });
    }

    if (input.action === "send" || input.action === "resend" || input.action === "advance") {
      await recordSignatureAuditEntry(tx, {
        signatureRequestId: saved.id,
        eventType: SignatureAuditEventType.email_sent,
        actorMembershipId: input.actorMembershipId ?? null,
        actorLabel: "Internal team member",
        details: {
          recipient: saved.recipientEmail,
          subject: saved.emailSubject ?? ""
        }
      });
    }

    if (input.action === "viewed") {
      await recordSignatureAuditEntry(tx, {
        signatureRequestId: saved.id,
        eventType: SignatureAuditEventType.link_opened,
        actorLabel: saved.recipientName,
        details: {
          email: saved.recipientEmail
        }
      });
    }

    if (input.action === "signed") {
      await recordSignatureAuditEntry(tx, {
        signatureRequestId: saved.id,
        eventType: SignatureAuditEventType.signature_submitted,
        actorLabel: saved.recipientName,
        details: {
          email: saved.recipientEmail
        }
      });
    }

    if (input.action === "completed") {
      await recordSignatureAuditEntry(tx, {
        signatureRequestId: saved.id,
        eventType: SignatureAuditEventType.pdf_finalized,
        actorMembershipId: input.actorMembershipId ?? null,
        actorLabel: input.actorMembershipId ? "Internal team member" : "System",
        details: {
          signedDocumentId: input.completedDocumentId ?? ""
        }
      });
    }

    if (input.action === "canceled") {
      await recordSignatureAuditEntry(tx, {
        signatureRequestId: saved.id,
        eventType: SignatureAuditEventType.request_canceled,
        actorMembershipId: input.actorMembershipId ?? null,
        actorLabel: input.actorMembershipId ? "Internal team member" : "System",
        details: {
          status: signatureStatusLabelMap[saved.status]
        }
      });
    }

    if (input.action === "expire") {
      await recordSignatureAuditEntry(tx, {
        signatureRequestId: saved.id,
        eventType: SignatureAuditEventType.request_expired,
        actorMembershipId: input.actorMembershipId ?? null,
        actorLabel: input.actorMembershipId ? "Internal team member" : "System",
        details: {
          status: signatureStatusLabelMap[saved.status]
        }
      });
    }

    await reconcileLinkedWorkflowTasks(tx, {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      actorMembershipId: input.actorMembershipId ?? null,
      taskIds: [existing.form?.linkedTaskId ?? null, existing.document?.linkedTaskId ?? null],
      reason: "Task workflow re-evaluated after a linked signature request changed."
    });

    return saved.id;
  });

  if (!requestId) {
    return null;
  }

  const request = await prisma.signatureRequest.findUnique({
    where: {
      id: requestId
    }
  });

  return request ? mapSignatureRequest(request) : null;
}
