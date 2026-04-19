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
import { createSignatureRequest, normalizeSignatureRecipients, updateSignatureRequest } from "./signatures";
import { buildIncomingTransactionChanges, createIncomingUpdate, reviewIncomingUpdate } from "./incoming-updates";

export async function recordTransactionDocumentOpened(
  organizationId: string,
  actorMembershipId: string | null | undefined,
  documentId: string
) {
  const document = await prisma.transactionDocument.findFirst({
    where: {
      id: documentId,
      organizationId
    },
    include: {
      transaction: {
        select: {
          id: true,
          officeId: true,
          title: true,
          address: true,
          city: true,
          state: true
        }
      }
    }
  });

  if (!document) {
    return;
  }

  await recordActivityLogEvent(prisma, {
    organizationId,
    membershipId: actorMembershipId ?? null,
    entityType: "transaction_document",
    entityId: document.id,
    action: activityLogActions.documentOpened,
    payload: {
      officeId: document.transaction.officeId,
      transactionId: document.transactionId,
      transactionLabel: buildTransactionObjectLabel(document.transaction),
      objectLabel: buildDocumentObjectLabel(document.title, document.transaction),
      details: [`File: ${document.fileName}`],
      contextHref: `/office/transactions/${document.transactionId}#transaction-documents`
    }
  });
}



export async function createTransactionDocument(input: CreateTransactionDocumentInput): Promise<OfficeTransactionDocument | null> {
  const documentId = await prisma.$transaction(async (tx) => {
    const [transaction, linkedTask, linkedOffer] = await Promise.all([
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
      input.linkedTaskId
        ? tx.transactionTask.findFirst({
            where: {
              id: input.linkedTaskId,
              transactionId: input.transactionId,
              organizationId: input.organizationId
            },
            select: {
              id: true,
              title: true
            }
          })
        : Promise.resolve(null)
      ,
      getValidatedOfferLink(tx, input.organizationId, input.transactionId, input.offerId)
    ]);

    if (!transaction) {
      return null;
    }

    const created = await tx.transactionDocument.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: input.transactionId,
        uploadedByMembershipId: input.actorMembershipId ?? null,
        linkedTaskId: linkedTask?.id ?? null,
        offerId: linkedOffer?.id ?? null,
        title: input.title.trim(),
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        storageKey: input.storageKey,
        storageUrl: input.storageUrl ?? null,
        documentType: input.documentType?.trim() || "General",
        status: input.status ?? TransactionDocumentStatus.uploaded,
        source: input.source ?? TransactionDocumentSource.manual_upload,
        isRequired: input.isRequired ?? false,
        isUnsorted: input.isUnsorted ?? false,
        isSigned: input.isSigned ?? false,
        signedAt: parseOptionalDate(input.signedAt ?? undefined)
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? null,
      entityType: "transaction_document",
      entityId: created.id,
      action: activityLogActions.documentUploaded,
      payload: {
        officeId: transaction.officeId,
        transactionId: input.transactionId,
        transactionLabel: buildTransactionObjectLabel(transaction),
        objectLabel: buildDocumentObjectLabel(created.title, transaction),
        details: [
          `Document type: ${created.documentType}`,
          `Source: ${documentSourceLabelMap[created.source]}`,
          ...(created.isUnsorted ? ["Unsorted: Yes"] : []),
          ...(linkedTask ? [`Linked task: ${linkedTask.title}`] : []),
          ...(linkedOffer ? [`Linked offer: ${buildOfferObjectLabel(linkedOffer)}`] : [])
        ],
        contextHref: `/office/transactions/${input.transactionId}#transaction-documents`
      }
    });

    if (linkedOffer) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "offer",
        entityId: linkedOffer.id,
        action: activityLogActions.offerDocumentLinked,
        payload: {
          officeId: transaction.officeId,
          transactionId: input.transactionId,
          transactionLabel: buildTransactionObjectLabel(transaction),
          objectLabel: buildOfferObjectLabel(linkedOffer),
          details: [`Document: ${created.title}`],
          contextHref: `/office/transactions/${input.transactionId}#offer-${linkedOffer.id}`
        }
      });
    }

    if (linkedTask?.id) {
      await reconcileLinkedWorkflowTasks(tx, {
        organizationId: input.organizationId,
        transactionId: input.transactionId,
        actorMembershipId: input.actorMembershipId ?? null,
        taskIds: [linkedTask.id],
        reason: "Task workflow re-evaluated after a linked document was uploaded."
      });
    }

    return created.id;
  });

  if (!documentId) {
    return null;
  }

  const snapshot = await listTransactionDocumentsSnapshot(input.organizationId, input.transactionId);
  return snapshot.documents.find((document) => document.id === documentId) ?? null;
}



export async function updateTransactionDocument(input: UpdateTransactionDocumentInput): Promise<OfficeTransactionDocument | null> {
  const documentId = await prisma.$transaction(async (tx) => {
    const existing = await tx.transactionDocument.findFirst({
      where: {
        id: input.documentId,
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
        linkedTask: {
          select: {
            id: true,
            title: true
          }
        },
        offer: {
          select: {
            id: true,
            title: true,
            offeringPartyName: true,
            buyerName: true
          }
        }
      }
    });

    if (!existing) {
      return null;
    }

    const [linkedTask, linkedOffer] = await Promise.all([
      input.linkedTaskId
        ? tx.transactionTask.findFirst({
            where: {
              id: input.linkedTaskId,
              transactionId: input.transactionId,
              organizationId: input.organizationId
            },
            select: {
              id: true,
              title: true
            }
          })
        : Promise.resolve(null),
      input.offerId === undefined
        ? Promise.resolve(existing.offer)
        : getValidatedOfferLink(tx, input.organizationId, input.transactionId, input.offerId)
    ]);

    const saved = await tx.transactionDocument.update({
      where: {
        id: existing.id
      },
      data: {
        title: input.title?.trim() || existing.title,
        documentType: input.documentType?.trim() || existing.documentType,
        status: input.status ?? existing.status,
        isRequired: input.isRequired ?? existing.isRequired,
        isUnsorted: input.isUnsorted ?? existing.isUnsorted,
        linkedTaskId: input.linkedTaskId === undefined ? existing.linkedTaskId : linkedTask?.id ?? null,
        offerId: input.offerId === undefined ? existing.offerId : linkedOffer?.id ?? null
      }
    });

    const changes = [
      ...buildChanges(existing.title, saved.title, "Title"),
      ...buildChanges(existing.documentType, saved.documentType, "Document type"),
      ...buildChanges(documentStatusLabelMap[existing.status], documentStatusLabelMap[saved.status], "Status"),
      ...buildChanges(existing.isRequired ? "Yes" : "No", saved.isRequired ? "Yes" : "No", "Required"),
      ...buildChanges(existing.isUnsorted ? "Yes" : "No", saved.isUnsorted ? "Yes" : "No", "Unsorted"),
      ...buildChanges(existing.linkedTask?.title ?? "None", linkedTask?.title ?? "None", "Linked task"),
      ...buildChanges(existing.offer ? buildOfferObjectLabel(existing.offer) : "None", linkedOffer ? buildOfferObjectLabel(linkedOffer) : "None", "Linked offer")
    ];

    if (changes.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "transaction_document",
        entityId: existing.id,
        action: activityLogActions.documentUpdated,
        payload: {
          officeId: existing.transaction.officeId,
          transactionId: input.transactionId,
          transactionLabel: buildTransactionObjectLabel(existing.transaction),
          objectLabel: buildDocumentObjectLabel(saved.title, existing.transaction),
          changes,
          contextHref: `/office/transactions/${input.transactionId}#transaction-documents`
        }
      });
    }

    if (input.offerId !== undefined && (existing.offer?.id ?? null) !== (linkedOffer?.id ?? null) && linkedOffer) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "offer",
        entityId: linkedOffer.id,
        action: activityLogActions.offerDocumentLinked,
        payload: {
          officeId: existing.transaction.officeId,
          transactionId: input.transactionId,
          transactionLabel: buildTransactionObjectLabel(existing.transaction),
          objectLabel: buildOfferObjectLabel(linkedOffer),
          details: [`Document: ${saved.title}`],
          contextHref: `/office/transactions/${input.transactionId}#offer-${linkedOffer.id}`
        }
      });
    }

    await reconcileLinkedWorkflowTasks(tx, {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      actorMembershipId: input.actorMembershipId ?? null,
      taskIds: [existing.linkedTaskId, linkedTask?.id],
      reason: "Task workflow re-evaluated after a linked document changed."
    });

    return saved.id;
  });

  if (!documentId) {
    return null;
  }

  const snapshot = await listTransactionDocumentsSnapshot(input.organizationId, input.transactionId);
  return snapshot.documents.find((document) => document.id === documentId) ?? null;
}



export async function deleteTransactionDocument(
  organizationId: string,
  transactionId: string,
  documentId: string,
  actorMembershipId?: string
) {
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.transactionDocument.findFirst({
      where: {
        id: documentId,
        transactionId,
        organizationId
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
        }
      }
    });

    if (!existing) {
      return null;
    }

    await tx.signatureRequest.deleteMany({
      where: {
        documentId: existing.id
      }
    });

    await tx.transactionDocument.delete({
      where: {
        id: existing.id
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId,
      membershipId: actorMembershipId ?? null,
      entityType: "transaction_document",
      entityId: existing.id,
      action: activityLogActions.documentDeleted,
      payload: {
        officeId: existing.transaction.officeId,
        transactionId,
        transactionLabel: buildTransactionObjectLabel(existing.transaction),
        objectLabel: buildDocumentObjectLabel(existing.title, existing.transaction),
        details: [`File: ${existing.fileName}`],
        contextHref: `/office/transactions/${transactionId}#transaction-documents`
      }
    });

    await reconcileLinkedWorkflowTasks(tx, {
      organizationId,
      transactionId,
      actorMembershipId: actorMembershipId ?? null,
      taskIds: [existing.linkedTaskId],
      reason: "Task workflow re-evaluated after a linked document was deleted."
    });

    return {
      id: existing.id,
      storageKey: existing.storageKey
    };
  });

  return deleted;
}



export async function listTransactionFormTemplates(organizationId: string) {
  const templates = await prisma.formTemplate.findMany({
    where: {
      isActive: true,
      OR: [{ organizationId: null }, { organizationId }]
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }]
  });

  return templates.map((template) => ({
    id: template.id,
    key: template.key,
    name: template.name,
    description: template.description ?? "",
    documentType: template.documentType
  }));
}



export async function prepareTransactionFormDraft(input: PrepareTransactionFormDraftInput): Promise<PreparedTransactionFormDraft | null> {
  const [transaction, template, linkedTask, offer] = await Promise.all([
    getTransactionMergeContext(input.organizationId, input.transactionId),
    prisma.formTemplate.findFirst({
      where: {
        id: input.templateId,
        isActive: true,
        OR: [{ organizationId: null }, { organizationId: input.organizationId }]
      }
    }),
    input.linkedTaskId
      ? prisma.transactionTask.findFirst({
          where: {
            id: input.linkedTaskId,
            organizationId: input.organizationId,
            transactionId: input.transactionId
          },
          select: {
            id: true,
            title: true
          }
        })
      : Promise.resolve(null)
    ,
    getOfferMergeContext(input.organizationId, input.transactionId, input.offerId)
  ]);

  if (!transaction || !template) {
    return null;
  }

  if (input.offerId && !offer) {
    return null;
  }

  const payload = buildTransactionFormPayload(transaction, offer);
  const mergeFields =
    template.mergeFields && typeof template.mergeFields === "object" && !Array.isArray(template.mergeFields)
      ? Object.keys(template.mergeFields as Record<string, Prisma.JsonValue>)
      : [];

  const generatedPayload =
    mergeFields.length > 0
      ? Object.fromEntries(mergeFields.map((field) => [field, payload[field as keyof typeof payload] ?? ""]))
      : payload;

  return {
    templateId: template.id,
    templateName: template.name,
    documentType: template.documentType,
    name: input.name?.trim() || `${template.name} · ${transaction.title}`,
    generatedPayload,
    linkedTaskId: linkedTask?.id ?? null,
    offerId: offer?.id ?? null
  };
}



export async function createTransactionForm(input: CreateTransactionFormInput): Promise<OfficeTransactionForm | null> {
  const formId = await prisma.$transaction(async (tx) => {
    const [transaction, template, linkedTask, linkedOffer] = await Promise.all([
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
      tx.formTemplate.findFirst({
        where: {
          id: input.templateId,
          isActive: true,
          OR: [{ organizationId: null }, { organizationId: input.organizationId }]
        }
      }),
      input.linkedTaskId
        ? tx.transactionTask.findFirst({
            where: {
              id: input.linkedTaskId,
              transactionId: input.transactionId,
              organizationId: input.organizationId
            },
            select: {
              id: true,
              title: true
            }
          })
        : Promise.resolve(null)
      ,
      getValidatedOfferLink(tx, input.organizationId, input.transactionId, input.offerId)
    ]);

    if (!transaction || !template) {
      return null;
    }

    if (input.offerId && !linkedOffer) {
      return null;
    }

    let documentId: string | null = null;

    if (input.generatedDocument) {
      const createdDocument = await tx.transactionDocument.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? transaction.officeId ?? null,
          transactionId: input.transactionId,
          offerId: linkedOffer?.id ?? null,
          uploadedByMembershipId: input.actorMembershipId,
          linkedTaskId: linkedTask?.id ?? null,
          title: input.generatedDocument.title,
          fileName: input.generatedDocument.fileName,
          mimeType: input.generatedDocument.mimeType,
          fileSizeBytes: input.generatedDocument.fileSizeBytes,
          storageKey: input.generatedDocument.storageKey,
          storageUrl: input.generatedDocument.storageUrl ?? null,
          documentType: input.generatedDocument.documentType,
          status: TransactionDocumentStatus.uploaded,
          source: TransactionDocumentSource.generated_form,
          isRequired: false,
          isUnsorted: false
        }
      });

      documentId = createdDocument.id;

      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "transaction_document",
        entityId: createdDocument.id,
        action: activityLogActions.documentUploaded,
        payload: {
          officeId: transaction.officeId,
          transactionId: input.transactionId,
          transactionLabel: buildTransactionObjectLabel(transaction),
          objectLabel: buildDocumentObjectLabel(createdDocument.title, transaction),
          details: [`Source: ${documentSourceLabelMap[TransactionDocumentSource.generated_form]}`],
          contextHref: `/office/transactions/${input.transactionId}#transaction-documents`
        }
      });

      if (linkedOffer) {
        await recordActivityLogEvent(tx, {
          organizationId: input.organizationId,
          membershipId: input.actorMembershipId,
          entityType: "offer",
          entityId: linkedOffer.id,
          action: activityLogActions.offerDocumentLinked,
          payload: {
            officeId: transaction.officeId,
            transactionId: input.transactionId,
            transactionLabel: buildTransactionObjectLabel(transaction),
            objectLabel: buildOfferObjectLabel(linkedOffer),
            details: [`Generated form document: ${createdDocument.title}`],
            contextHref: `/office/transactions/${input.transactionId}#offer-${linkedOffer.id}`
          }
        });
      }
    }

    const createdForm = await tx.transactionForm.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: input.transactionId,
        offerId: linkedOffer?.id ?? null,
        templateId: template.id,
        linkedTaskId: linkedTask?.id ?? null,
        documentId,
        name: input.name.trim(),
        status: TransactionFormStatus.draft,
        generatedPayload: input.generatedPayload,
        createdByMembershipId: input.actorMembershipId
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "transaction_form",
      entityId: createdForm.id,
      action: activityLogActions.formCreated,
      payload: {
        officeId: transaction.officeId,
        transactionId: input.transactionId,
        transactionLabel: buildTransactionObjectLabel(transaction),
        taskId: linkedTask?.id ?? undefined,
        taskTitle: linkedTask?.title ?? undefined,
        objectLabel: buildFormObjectLabel(createdForm.name, transaction),
        details: [
          `Template: ${template.name}`,
          `Status: ${formStatusLabelMap[TransactionFormStatus.draft]}`,
          ...(linkedTask ? [`Linked task: ${linkedTask.title}`] : []),
          ...(linkedOffer ? [`Linked offer: ${buildOfferObjectLabel(linkedOffer)}`] : []),
          ...(documentId ? ["Generated document: Yes"] : [])
        ],
        contextHref: `/office/transactions/${input.transactionId}#transaction-forms-signatures`
      }
    });

    return createdForm.id;
  });

  if (!formId) {
    return null;
  }

  const snapshot = await listTransactionDocumentsSnapshot(input.organizationId, input.transactionId);
  return snapshot.forms.find((form) => form.id === formId) ?? null;
}



export async function updateTransactionForm(input: UpdateTransactionFormInput): Promise<OfficeTransactionForm | null> {
  const formId = await prisma.$transaction(async (tx) => {
    const existing = await tx.transactionForm.findFirst({
      where: {
        id: input.formId,
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
        linkedTask: {
          select: {
            id: true,
            title: true
          }
        },
        offer: {
          select: {
            id: true,
            title: true,
            offeringPartyName: true,
            buyerName: true
          }
        }
      }
    });

    if (!existing) {
      return null;
    }

    const [linkedTask, linkedOffer] = await Promise.all([
      input.linkedTaskId
        ? tx.transactionTask.findFirst({
            where: {
              id: input.linkedTaskId,
              transactionId: input.transactionId,
              organizationId: input.organizationId
            },
            select: {
              id: true,
              title: true
            }
          })
        : Promise.resolve(null),
      input.offerId === undefined
        ? Promise.resolve(existing.offer)
        : getValidatedOfferLink(tx, input.organizationId, input.transactionId, input.offerId)
    ]);

    const saved = await tx.transactionForm.update({
      where: {
        id: existing.id
      },
      data: {
        name: input.name?.trim() || existing.name,
        linkedTaskId: input.linkedTaskId === undefined ? existing.linkedTaskId : linkedTask?.id ?? null,
        offerId: input.offerId === undefined ? existing.offerId : linkedOffer?.id ?? null,
        generatedPayload: input.generatedPayload
          ? toInputJsonValue(input.generatedPayload)
          : toInputJsonValue(existing.generatedPayload),
        status: input.status ?? existing.status
      }
    });

    const changes = [
      ...buildChanges(existing.name, saved.name, "Form name"),
      ...buildChanges(existing.linkedTask?.title ?? "None", linkedTask?.title ?? "None", "Linked task"),
      ...buildChanges(existing.offer ? buildOfferObjectLabel(existing.offer) : "None", linkedOffer ? buildOfferObjectLabel(linkedOffer) : "None", "Linked offer"),
      ...buildChanges(formStatusLabelMap[existing.status], formStatusLabelMap[saved.status], "Form status")
    ];

    if (changes.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "transaction_form",
        entityId: saved.id,
        action: activityLogActions.formUpdated,
        payload: {
          officeId: existing.transaction.officeId,
          transactionId: input.transactionId,
          transactionLabel: buildTransactionObjectLabel(existing.transaction),
          taskId: linkedTask?.id ?? undefined,
          taskTitle: linkedTask?.title ?? undefined,
          objectLabel: buildFormObjectLabel(saved.name, existing.transaction),
          changes,
          contextHref: `/office/transactions/${input.transactionId}#transaction-forms-signatures`
        }
      });
    }

    await reconcileLinkedWorkflowTasks(tx, {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      actorMembershipId: input.actorMembershipId ?? null,
      taskIds: [existing.linkedTaskId, linkedTask?.id],
      reason: "Task workflow re-evaluated after a linked form changed."
    });

    return saved.id;
  });

  if (!formId) {
    return null;
  }

  const snapshot = await listTransactionDocumentsSnapshot(input.organizationId, input.transactionId);
  return snapshot.forms.find((form) => form.id === formId) ?? null;
}
