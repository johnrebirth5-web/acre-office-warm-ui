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
import { createSignatureRequest, normalizeSignatureRecipients, updateSignatureRequest } from "./signatures";

export async function createIncomingUpdate(input: CreateIncomingUpdateInput): Promise<OfficeIncomingUpdate | null> {
  const incomingUpdateId = await prisma.$transaction(async (tx) => {
    const transaction = input.transactionId
      ? await tx.transaction.findFirst({
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
        })
      : null;

    const created = await tx.incomingUpdate.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction?.officeId ?? null,
        transactionId: input.transactionId ?? null,
        sourceSystem: input.sourceSystem.trim(),
        sourceReference: input.sourceReference.trim(),
        status: IncomingUpdateStatus.pending_review,
        summary: input.summary.trim(),
        payload: input.payload,
        receivedAt: new Date()
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? null,
      entityType: "incoming_update",
      entityId: created.id,
      action: activityLogActions.incomingUpdateReceived,
      payload: {
        officeId: created.officeId,
        transactionId: created.transactionId ?? undefined,
        transactionLabel: transaction ? buildTransactionObjectLabel(transaction) : undefined,
        objectLabel: buildIncomingUpdateObjectLabel(created.summary, created.sourceSystem),
        details: [`Source reference: ${created.sourceReference}`],
        contextHref: created.transactionId ? `/office/transactions/${created.transactionId}#transaction-incoming-updates` : "/office/activity?view=alerts"
      }
    });

    const reviewerMembershipIds = await listOfficeNotificationRecipientIds(tx, {
      organizationId: input.organizationId,
      officeId: created.officeId,
      group: "incoming_update_reviewers",
      excludeMembershipIds: input.actorMembershipId ? [input.actorMembershipId] : [],
      fallbackToExcludedIds: true
    });

    await createNotificationsForMemberships(tx, {
      organizationId: input.organizationId,
      officeId: created.officeId,
      membershipIds: reviewerMembershipIds,
      type: NotificationType.incoming_update_pending_review,
      category: NotificationCategory.incoming_update,
      severity: NotificationSeverity.warning,
      entityType: NotificationEntityType.incoming_update,
      entityId: created.id,
      title: "Incoming update pending review",
      body: transaction
        ? `${created.summary} needs review for ${transaction.title}.`
        : `${created.summary} needs review before it can be applied.`,
      actionUrl: created.transactionId
        ? `/office/transactions/${created.transactionId}#transaction-incoming-updates`
        : "/office/activity?view=alerts&alertSection=incoming-updates-awaiting-review"
    });

    return created.id;
  });

  if (!incomingUpdateId) {
    return null;
  }

  const record = await prisma.incomingUpdate.findUnique({
    where: {
      id: incomingUpdateId
    },
    include: {
      reviewedByMembership: {
        include: {
          user: true
        }
      }
    }
  });

  return record ? mapIncomingUpdate(record) : null;
}



export function buildIncomingTransactionChanges(payload: Record<string, string>) {
  const changes = [
    { key: "title", label: "Transaction title" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "zipCode", label: "Zip code" },
    { key: "status", label: "Status" },
    { key: "importantDate", label: "Important date" },
    { key: "closingDate", label: "Closing date" }
  ].filter((entry) => payload[entry.key]);

  if (payload.askingPrice) {
    changes.push({ key: "askingPrice", label: "Asking price" });
  }

  if (payload.purchasedPrice || payload.price) {
    changes.push({ key: "purchasedPrice", label: "Purchased price" });
  }

  return changes;
}



export async function reviewIncomingUpdate(input: ReviewIncomingUpdateInput): Promise<OfficeIncomingUpdate | null> {
  const updateId = await prisma.$transaction(async (tx) => {
    const existing = await tx.incomingUpdate.findFirst({
      where: {
        id: input.incomingUpdateId,
        organizationId: input.organizationId,
        transactionId: input.transactionId
      },
      include: {
        transaction: {
          select: {
            id: true,
            officeId: true,
            title: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            status: true,
            askingPrice: true,
            purchasedPrice: true,
            price: true,
            importantDate: true,
            closingDate: true
          }
        }
      }
    });

    if (!existing) {
      return null;
    }

    const payload = normalizeJsonRecord(existing.payload);
    const now = new Date();

    let finalStatus: IncomingUpdateStatus = input.action === "accept" ? IncomingUpdateStatus.accepted : IncomingUpdateStatus.rejected;
    const updatePayloadChanges: Array<{ label: string; previousValue?: string | null; nextValue?: string | null }> = [];

    if (input.action === "accept" && existing.transaction) {
      const changesToApply = buildIncomingTransactionChanges(payload);
      const updateData: Prisma.TransactionUpdateInput = {};

      for (const change of changesToApply) {
        if (change.key === "title") {
          updateData.title = payload.title;
          updatePayloadChanges.push(...buildChanges(existing.transaction.title, payload.title, change.label));
        }

        if (change.key === "address") {
          updateData.address = payload.address;
          updatePayloadChanges.push(...buildChanges(existing.transaction.address, payload.address, change.label));
        }

        if (change.key === "city") {
          updateData.city = payload.city;
          updatePayloadChanges.push(...buildChanges(existing.transaction.city, payload.city, change.label));
        }

        if (change.key === "state") {
          updateData.state = payload.state;
          updatePayloadChanges.push(...buildChanges(existing.transaction.state, payload.state, change.label));
        }

        if (change.key === "zipCode") {
          updateData.zipCode = payload.zipCode;
          updatePayloadChanges.push(...buildChanges(existing.transaction.zipCode, payload.zipCode, change.label));
        }

        if (change.key === "status") {
          const nextStatus = payload.status?.trim().toLowerCase();

          if (
            nextStatus === "opportunity" ||
            nextStatus === "active" ||
            nextStatus === "pending" ||
            nextStatus === "closed" ||
            nextStatus === "cancelled"
          ) {
            updateData.status = nextStatus as TransactionStatus;
            updatePayloadChanges.push(
              ...buildChanges(
                transactionStatusLabelMap[existing.transaction.status],
                transactionStatusLabelMap[nextStatus as TransactionStatus],
                change.label
              )
            );
          }
        }

        if (change.key === "askingPrice") {
          const numeric = Number(payload.askingPrice);

          if (Number.isFinite(numeric)) {
            const nextAskingPrice = new Prisma.Decimal(numeric);
            updateData.askingPrice = nextAskingPrice;
            updatePayloadChanges.push(
              ...buildChanges(formatCurrency(existing.transaction.askingPrice), formatCurrency(numeric), change.label)
            );
          }
        }

        if (change.key === "purchasedPrice") {
          const numeric = Number(payload.purchasedPrice ?? payload.price);

          if (Number.isFinite(numeric)) {
            const nextPurchasedPrice = new Prisma.Decimal(numeric);
            updateData.purchasedPrice = nextPurchasedPrice;
            updateData.price = nextPurchasedPrice;
            updatePayloadChanges.push(
              ...buildChanges(
                formatCurrency(existing.transaction.purchasedPrice ?? existing.transaction.price),
                formatCurrency(numeric),
                change.label
              )
            );
          }
        }

        if (change.key === "importantDate") {
          const parsedDate = parseOptionalDate(payload.importantDate);
          updateData.importantDate = parsedDate;
          updatePayloadChanges.push(
            ...buildChanges(formatDateValue(existing.transaction.importantDate), formatDateValue(parsedDate), change.label)
          );
        }

        if (change.key === "closingDate") {
          const parsedDate = parseOptionalDate(payload.closingDate);
          updateData.closingDate = parsedDate;
          updatePayloadChanges.push(
            ...buildChanges(formatDateValue(existing.transaction.closingDate), formatDateValue(parsedDate), change.label)
          );
        }
      }

      if (Object.keys(updateData).length > 0) {
        await tx.transaction.update({
          where: {
            id: existing.transaction.id
          },
          data: updateData
        });

        finalStatus = IncomingUpdateStatus.applied;

        await recordActivityLogEvent(tx, {
          organizationId: input.organizationId,
          membershipId: input.actorMembershipId,
          entityType: "transaction",
          entityId: existing.transaction.id,
          action: activityLogActions.transactionUpdated,
          payload: {
            officeId: existing.transaction.officeId,
            transactionId: existing.transaction.id,
            transactionLabel: buildTransactionObjectLabel(existing.transaction),
            objectLabel: buildTransactionObjectLabel(existing.transaction),
            changes: updatePayloadChanges,
            details: [`Applied from incoming update: ${existing.summary}`]
          }
        });
      }
    }

    const saved = await tx.incomingUpdate.update({
      where: {
        id: existing.id
      },
      data: {
        status: finalStatus,
        reviewedAt: now,
        reviewedByMembershipId: input.actorMembershipId,
        acceptedAt: input.action === "accept" ? now : existing.acceptedAt,
        rejectedAt: input.action === "reject" ? now : existing.rejectedAt
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "incoming_update",
      entityId: saved.id,
      action: input.action === "accept" ? activityLogActions.incomingUpdateAccepted : activityLogActions.incomingUpdateRejected,
      payload: {
        officeId: existing.officeId,
        transactionId: existing.transactionId ?? undefined,
        transactionLabel: existing.transaction ? buildTransactionObjectLabel(existing.transaction) : undefined,
        objectLabel: buildIncomingUpdateObjectLabel(existing.summary, existing.sourceSystem),
        details:
          input.action === "accept"
            ? [`Applied mapped fields: ${updatePayloadChanges.length}`]
            : [`Marked ${incomingUpdateStatusLabelMap[IncomingUpdateStatus.rejected].toLowerCase()}`],
        changes: input.action === "accept" ? updatePayloadChanges : [],
        contextHref: existing.transactionId ? `/office/transactions/${existing.transactionId}#transaction-incoming-updates` : "/office/activity"
      }
    });

    return saved.id;
  });

  if (!updateId) {
    return null;
  }

  const record = await prisma.incomingUpdate.findUnique({
    where: {
      id: updateId
    },
    include: {
      reviewedByMembership: {
        include: {
          user: true
        }
      }
    }
  });

  return record ? mapIncomingUpdate(record) : null;
}
