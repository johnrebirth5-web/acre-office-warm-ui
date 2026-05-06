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
  SignatureArtifactKind,
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
import { createTransactionDocument, createTransactionForm, deleteTransactionDocument, listTransactionFormTemplates, prepareTransactionFormDraft, recordTransactionDocumentOpened, updateTransactionDocument, updateTransactionForm } from "./documents";
import { createSignatureRequest, normalizeSignatureRecipients, updateSignatureRequest } from "./signatures";
import { buildIncomingTransactionChanges, createIncomingUpdate, reviewIncomingUpdate } from "./incoming-updates";

export function formatDateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}



export function formatDateTimeValue(date: Date | null) {
  return date ? date.toISOString() : "";
}



export function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}



export function toInputJsonValue(value: Prisma.JsonValue): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}



export function parseOptionalDate(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}



export function formatMembershipName(membership: { user: { firstName: string; lastName: string } } | null | undefined) {
  return membership ? `${membership.user.firstName} ${membership.user.lastName}` : "";
}



export function buildTransactionObjectLabel(transaction: { title: string; address: string; city: string; state: string }) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}



export function buildOfferObjectLabel(offer: { title: string; offeringPartyName: string; buyerName: string | null }) {
  const party = offer.buyerName?.trim() || offer.offeringPartyName;
  return `${offer.title} · ${party}`;
}



export function normalizeJsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry ?? "")]));
}



export function normalizeSubmittedFieldValues(
  value: Prisma.JsonValue | null | undefined,
  fallbackRecipientId = ""
): OfficeSignatureFieldValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const fieldId = typeof entry.fieldId === "string" ? entry.fieldId.trim() : "";
    const fieldType = typeof entry.fieldType === "string" ? (entry.fieldType as SignatureFieldType) : null;

    if (!fieldId || !fieldType) {
      return [];
    }

    return [
      {
        fieldId,
        recipientId:
          typeof entry.recipientId === "string" && entry.recipientId.trim()
            ? entry.recipientId.trim()
            : fallbackRecipientId,
        fieldType,
        textValue: typeof entry.textValue === "string" ? entry.textValue : "",
        signatureMode:
          entry.signatureMode === "draw" || entry.signatureMode === "type" || entry.signatureMode === "upload"
            ? entry.signatureMode
            : "",
        imageDataUrl: typeof entry.imageDataUrl === "string" ? entry.imageDataUrl : ""
      }
    ];
  });
}



export function collectSubmittedFieldValues(
  recipients: Array<{
    id: string;
    submittedValues?: Prisma.JsonValue | null;
  }>
) {
  const valuesByFieldId = new Map<string, OfficeSignatureFieldValue>();

  for (const recipient of recipients) {
    for (const value of normalizeSubmittedFieldValues(recipient.submittedValues, recipient.id)) {
      valuesByFieldId.set(value.fieldId, value);
    }
  }

  return [...valuesByFieldId.values()];
}



export function buildDocumentHref(transactionId: string, documentId: string) {
  return `/api/office/transactions/${transactionId}/documents/${documentId}/file`;
}



export function buildTaskHref(transactionId: string, taskId: string | null | undefined) {
  return taskId ? `/office/transactions/${transactionId}#transaction-task-${taskId}` : "";
}



export function buildSignatureRequestEditorHref(transactionId: string, signatureRequestId: string) {
  return `/office/transactions/${transactionId}/signatures/${signatureRequestId}`;
}



export function resolveSignatureStatus(request: {
  status: SignatureRequestStatus;
  expiresAt?: Date | null;
  expiredAt?: Date | null;
}) {
  if (
    !request.expiredAt &&
    request.expiresAt &&
    request.expiresAt.getTime() <= Date.now() &&
    request.status !== SignatureRequestStatus.completed &&
    request.status !== SignatureRequestStatus.canceled &&
    request.status !== SignatureRequestStatus.voided &&
    request.status !== SignatureRequestStatus.declined &&
    request.status !== SignatureRequestStatus.expired
  ) {
    return SignatureRequestStatus.expired;
  }

  return request.status;
}



export function mapSignatureField(field: {
  id: string;
  signatureRequestId: string;
  assignedRecipientId?: string | null;
  fieldType: SignatureFieldType;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  defaultValue: string | null;
  fontStyle: string | null;
  fieldKey?: string | null;
  isReadOnly?: boolean;
  isSystemPrefilled?: boolean;
  visibilityRule?: Prisma.JsonValue | null;
  mirrorGroup?: string | null;
  fieldOptions?: Prisma.JsonValue | null;
  sortOrder: number;
}): OfficeSignatureField {
  return {
    id: field.id,
    signatureRequestId: field.signatureRequestId,
    assignedRecipientId: field.assignedRecipientId ?? null,
    fieldType: field.fieldType,
    label: field.label,
    page: field.page,
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
    required: field.required,
    defaultValue: field.defaultValue ?? "",
    fontStyle: field.fontStyle ?? "",
    fieldKey: field.fieldKey ?? "",
    isReadOnly: field.isReadOnly ?? false,
    isSystemPrefilled: field.isSystemPrefilled ?? false,
    visibilityRule: normalizeJsonRecord(field.visibilityRule),
    mirrorGroup: field.mirrorGroup ?? "",
    fieldOptions: normalizeJsonRecord(field.fieldOptions),
    sortOrder: field.sortOrder
  };
}



export function mapSignatureRecipient(recipient: {
  id: string;
  role: SignatureRecipientRole;
  name: string;
  email: string;
  recipientRole: string;
  routingStep: number;
  sortOrder: number;
  status: SignatureRecipientStatus;
  sentAt?: Date | null;
  firstViewedAt?: Date | null;
  viewedAt?: Date | null;
  actedAt?: Date | null;
  declinedAt?: Date | null;
  tokenHash?: string | null;
}): OfficeSignatureRecipient {
  return {
    id: recipient.id,
    roleKey: recipient.role,
    role: signatureRecipientRoleLabelMap[recipient.role],
    name: recipient.name,
    email: recipient.email,
    recipientRole: recipient.recipientRole,
    routingStep: recipient.routingStep,
    sortOrder: recipient.sortOrder,
    statusKey: recipient.status,
    status: signatureRecipientStatusLabelMap[recipient.status],
    sentAt: formatDateTimeValue(recipient.sentAt ?? null),
    firstViewedAt: formatDateTimeValue(recipient.firstViewedAt ?? null),
    viewedAt: formatDateTimeValue(recipient.viewedAt ?? null),
    actedAt: formatDateTimeValue(recipient.actedAt ?? null),
    declinedAt: formatDateTimeValue(recipient.declinedAt ?? null),
    tokenIssued: Boolean(recipient.tokenHash?.trim())
  };
}



export function mapSignatureArtifact(artifact: {
  id: string;
  kind: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  storageUrl?: string | null;
  driveSyncStatus: SignatureDriveSyncStatus;
  driveSyncError?: string | null;
  driveSyncedAt?: Date | null;
  driveFolderId?: string | null;
  driveFileId?: string | null;
  driveWebViewLink?: string | null;
}): OfficeSignatureArtifact {
  return {
    id: artifact.id,
    kind: artifact.kind,
    title: artifact.title,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
    fileSizeBytes: artifact.fileSizeBytes,
    storageKey: artifact.storageKey,
    storageUrl: artifact.storageUrl?.trim() || "",
    driveSyncStatus: artifact.driveSyncStatus,
    driveSyncStatusLabel: signatureDriveStatusLabelMap[artifact.driveSyncStatus],
    driveSyncError: artifact.driveSyncError?.trim() || "",
    driveSyncedAt: formatDateTimeValue(artifact.driveSyncedAt ?? null),
    driveFolderId: artifact.driveFolderId?.trim() || "",
    driveFileId: artifact.driveFileId?.trim() || "",
    driveWebViewLink: artifact.driveWebViewLink?.trim() || ""
  };
}



export function mapSignatureAuditEntry(entry: SignatureAuditEntryRecord): OfficeSignatureAuditEntry {
  const detailsRecord = normalizeJsonRecord(entry.details);

  return {
    id: entry.id,
    eventType: entry.eventType,
    eventLabel: signatureAuditEventLabelMap[entry.eventType],
    actorLabel: entry.actorLabel?.trim() || "System",
    details: Object.entries(detailsRecord).map(([key, value]) => `${key}: ${value}`),
    createdAt: formatDateTimeValue(entry.createdAt)
  };
}



export function mapSignatureRequest(request: {
  id: string;
  transactionId: string | null;
  templateId?: string | null;
  formId: string | null;
  documentId: string | null;
  completedDocumentId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  contextLabel?: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  emailSubject?: string | null;
  emailBody?: string | null;
  signingOrder: number | null;
  senderDisplayName?: string | null;
  senderReplyTo?: string | null;
  status: SignatureRequestStatus;
  driveSyncStatus?: SignatureDriveSyncStatus;
  driveSyncError?: string | null;
  driveSyncedAt?: Date | null;
  driveFolderId?: string | null;
  driveFileId?: string | null;
  expiresAt?: Date | null;
  sentAt: Date | null;
  firstViewedAt?: Date | null;
  viewedAt: Date | null;
  signedAt?: Date | null;
  completedAt: Date | null;
  declinedAt: Date | null;
  canceledAt?: Date | null;
  expiredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  document?: {
    id: string;
    title: string;
    transactionId: string;
  } | null;
  completedDocument?: {
    id: string;
    title: string;
    transactionId: string;
  } | null;
  template?: {
    id: string;
    name: string;
    category: SignatureTemplateCategory;
  } | null;
  recipients?: Array<{
    id: string;
    role: SignatureRecipientRole;
    name: string;
    email: string;
    recipientRole: string;
    routingStep: number;
    sortOrder: number;
    status: SignatureRecipientStatus;
    sentAt?: Date | null;
    firstViewedAt?: Date | null;
    viewedAt?: Date | null;
    actedAt?: Date | null;
    declinedAt?: Date | null;
    tokenHash?: string | null;
  }>;
  artifacts?: Array<{
    id: string;
    kind: string;
    title: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storageKey: string;
    storageUrl?: string | null;
    driveSyncStatus: SignatureDriveSyncStatus;
    driveSyncError?: string | null;
    driveSyncedAt?: Date | null;
    driveFolderId?: string | null;
    driveFileId?: string | null;
    driveWebViewLink?: string | null;
  }>;
}): OfficeSignatureRequest {
  const resolvedStatus = resolveSignatureStatus(request);
  const recipients = (request.recipients ?? []).map(mapSignatureRecipient);
  const ccRecipients = recipients.filter((recipient) => recipient.roleKey === "cc");

  return {
    id: request.id,
    transactionId: request.transactionId,
    templateId: request.templateId ?? request.template?.id ?? null,
    formId: request.formId,
    documentId: request.documentId,
    documentTitle: request.document?.title ?? "",
    documentHref: request.document ? buildDocumentHref(request.document.transactionId, request.document.id) : "",
    completedDocumentId: request.completedDocumentId ?? request.completedDocument?.id ?? null,
    completedDocumentTitle: request.completedDocument?.title ?? "",
    completedDocumentHref: request.completedDocument ? buildDocumentHref(request.completedDocument.transactionId, request.completedDocument.id) : "",
    recipientName: request.recipientName,
    recipientEmail: request.recipientEmail,
    recipientRole: request.recipientRole,
    emailSubject: request.emailSubject?.trim() || "",
    emailBody: request.emailBody?.trim() || "",
    signingOrder: request.signingOrder,
    senderDisplayName: request.senderDisplayName?.trim() || "",
    senderReplyTo: request.senderReplyTo?.trim() || "",
    statusKey: resolvedStatus,
    status: signatureStatusLabelMap[resolvedStatus],
    contextType: request.contextType?.trim() || "transaction",
    contextId: request.contextId?.trim() || "",
    contextLabel: request.contextLabel?.trim() || "",
    driveSyncStatus: request.driveSyncStatus ?? SignatureDriveSyncStatus.not_configured,
    driveSyncStatusLabel: signatureDriveStatusLabelMap[request.driveSyncStatus ?? SignatureDriveSyncStatus.not_configured],
    driveSyncError: request.driveSyncError?.trim() || "",
    driveSyncedAt: formatDateTimeValue(request.driveSyncedAt ?? null),
    driveFolderId: request.driveFolderId?.trim() || "",
    driveFileId: request.driveFileId?.trim() || "",
    expiresAt: formatDateTimeValue(request.expiresAt ?? null),
    sentAt: formatDateTimeValue(request.sentAt),
    firstViewedAt: formatDateTimeValue(request.firstViewedAt ?? null),
    viewedAt: formatDateTimeValue(request.viewedAt),
    signedAt: formatDateTimeValue(request.signedAt ?? null),
    completedAt: formatDateTimeValue(request.completedAt),
    declinedAt: formatDateTimeValue(request.declinedAt),
    canceledAt: formatDateTimeValue(request.canceledAt ?? null),
    expiredAt: formatDateTimeValue(request.expiredAt ?? null),
    createdAt: formatDateTimeValue(request.createdAt),
    updatedAt: formatDateTimeValue(request.updatedAt),
    recipients,
    ccRecipients,
    artifacts: (request.artifacts ?? []).map(mapSignatureArtifact),
    templateSummary: request.template
      ? {
          id: request.template.id,
          name: request.template.name,
          category: request.template.category
        }
      : null,
    contextSummary: {
      type: request.contextType?.trim() || "transaction",
      id: request.contextId?.trim() || "",
      label: request.contextLabel?.trim() || ""
    }
  };
}



export function mapTransactionDocument(record: TransactionDocumentRecord): OfficeTransactionDocument {
  const latestSignature = record.signatureRequests[0] ?? null;
  const hasPendingSignature = record.signatureRequests.some((request) => {
    const resolvedStatus = resolveSignatureStatus(request);

    return (
      resolvedStatus === SignatureRequestStatus.draft ||
      resolvedStatus === SignatureRequestStatus.pending_send ||
      resolvedStatus === SignatureRequestStatus.sent ||
      resolvedStatus === SignatureRequestStatus.viewed ||
      resolvedStatus === SignatureRequestStatus.signed
    );
  });

  return {
    id: record.id,
    title: record.title,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSizeBytes: record.fileSizeBytes,
    storageKey: record.storageKey,
    storageUrl: buildDocumentHref(record.transactionId, record.id),
    documentType: record.documentType,
    statusKey: record.status,
    status: documentStatusLabelMap[record.status],
    sourceKey: record.source,
    source: documentSourceLabelMap[record.source],
    isRequired: record.isRequired,
    isSigned: record.isSigned,
    isUnsorted: record.isUnsorted,
    signedAt: formatDateTimeValue(record.signedAt),
    linkedTaskId: record.linkedTaskId,
    linkedTaskTitle: record.linkedTask?.title ?? "",
    linkedTaskHref: buildTaskHref(record.transactionId, record.linkedTaskId),
    hasPendingSignature,
    latestSignatureStatus: latestSignature ? signatureStatusLabelMap[resolveSignatureStatus(latestSignature)] : "",
    createdAt: formatDateTimeValue(record.createdAt),
    updatedAt: formatDateTimeValue(record.updatedAt)
  };
}



export function mapTransactionForm(record: TransactionFormRecord): OfficeTransactionForm {
  return {
    id: record.id,
    templateId: record.templateId,
    templateName: record.template?.name ?? "",
    linkedTaskId: record.linkedTaskId,
    linkedTaskTitle: record.linkedTask?.title ?? "",
    linkedTaskHref: buildTaskHref(record.transactionId, record.linkedTaskId),
    documentId: record.documentId,
    documentTitle: record.document?.title ?? "",
    name: record.name,
    statusKey: record.status,
    status: formStatusLabelMap[record.status],
    generatedPayload: normalizeJsonRecord(record.generatedPayload),
    createdByName: formatMembershipName(record.createdByMembership),
    createdAt: formatDateTimeValue(record.createdAt),
    updatedAt: formatDateTimeValue(record.updatedAt),
    signatureRequests: record.signatureRequests.map(mapSignatureRequest)
  };
}



export function isRecipientTerminalStatus(status: SignatureRecipientStatus) {
  return (
    status === SignatureRecipientStatus.acted ||
    status === SignatureRecipientStatus.declined ||
    status === SignatureRecipientStatus.voided ||
    status === SignatureRecipientStatus.expired
  );
}



export function getActiveRoutingStepRecipients<
  T extends {
    role: SignatureRecipientRole;
    routingStep: number;
    status: SignatureRecipientStatus;
  }
>(recipients: T[]) {
  const actionable = recipients.filter((recipient) => recipient.role !== SignatureRecipientRole.cc && !isRecipientTerminalStatus(recipient.status));
  if (actionable.length === 0) {
    return [];
  }

  const nextStep = actionable.reduce((minimum, recipient) => Math.min(minimum, recipient.routingStep), actionable[0]!.routingStep);
  return actionable.filter((recipient) => recipient.routingStep === nextStep);
}



export function deriveEnvelopeStatusFromRecipients(
  currentStatus: SignatureRequestStatus,
  recipients: Array<{
    role: SignatureRecipientRole;
    status: SignatureRecipientStatus;
  }>
) {
  const actionable = recipients.filter((recipient) => recipient.role !== SignatureRecipientRole.cc);

  if (actionable.length === 0) {
    return currentStatus;
  }

  if (actionable.some((recipient) => recipient.status === SignatureRecipientStatus.declined)) {
    return SignatureRequestStatus.declined;
  }

  if (actionable.every((recipient) => recipient.status === SignatureRecipientStatus.voided)) {
    return SignatureRequestStatus.voided;
  }

  if (actionable.every((recipient) => recipient.status === SignatureRecipientStatus.expired)) {
    return SignatureRequestStatus.expired;
  }

  if (actionable.every((recipient) => recipient.status === SignatureRecipientStatus.acted)) {
    return SignatureRequestStatus.completed;
  }

  if (actionable.some((recipient) => recipient.status === SignatureRecipientStatus.acted)) {
    return SignatureRequestStatus.signed;
  }

  if (actionable.some((recipient) => recipient.status === SignatureRecipientStatus.viewed)) {
    return SignatureRequestStatus.viewed;
  }

  if (actionable.some((recipient) => recipient.status === SignatureRecipientStatus.sent)) {
    return SignatureRequestStatus.sent;
  }

  if (actionable.some((recipient) => recipient.status === SignatureRecipientStatus.pending)) {
    return SignatureRequestStatus.pending_send;
  }

  return SignatureRequestStatus.draft;
}



export function mapIncomingUpdate(record: IncomingUpdateRecord): OfficeIncomingUpdate {
  const payloadPreview = Object.entries(normalizeJsonRecord(record.payload))
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${value}`);

  return {
    id: record.id,
    sourceSystem: record.sourceSystem,
    sourceReference: record.sourceReference,
    statusKey: record.status,
    status: incomingUpdateStatusLabelMap[record.status],
    summary: record.summary,
    payloadPreview,
    receivedAt: formatDateTimeValue(record.receivedAt),
    reviewedAt: formatDateTimeValue(record.reviewedAt),
    reviewedByName: formatMembershipName(record.reviewedByMembership),
    acceptedAt: formatDateTimeValue(record.acceptedAt),
    rejectedAt: formatDateTimeValue(record.rejectedAt)
  };
}



export async function getTransactionMergeContext(organizationId: string, transactionId: string): Promise<MergeContextTransaction | null> {
  return prisma.transaction.findFirst({
    where: {
      id: transactionId,
      organizationId
    },
    include: {
      ownerMembership: {
        include: {
          user: true
        }
      },
      transactionContacts: {
        where: {
          isPrimary: true
        },
        include: {
          client: true
        },
        take: 1
      }
    }
  });
}



export async function getOfferMergeContext(
  organizationId: string,
  transactionId: string,
  offerId: string | null | undefined
): Promise<MergeContextOffer | null> {
  if (!offerId) {
    return null;
  }

  return prisma.offer.findFirst({
    where: {
      id: offerId,
      organizationId,
      transactionId
    },
    select: {
      id: true,
      title: true,
      offeringPartyName: true,
      buyerName: true,
      price: true,
      earnestMoneyAmount: true,
      financingType: true,
      closingDateOffered: true,
      expirationAt: true
    }
  });
}



export async function getValidatedOfferLink(
  tx: Prisma.TransactionClient,
  organizationId: string,
  transactionId: string,
  offerId: string | null | undefined
) {
  if (!offerId) {
    return null;
  }

  return tx.offer.findFirst({
    where: {
      id: offerId,
      organizationId,
      transactionId
    },
    select: {
      id: true,
      title: true,
      offeringPartyName: true,
      buyerName: true
    }
  });
}



export function buildTransactionFormPayload(transaction: MergeContextTransaction, offer: MergeContextOffer | null) {
  const primaryContact = transaction.transactionContacts[0]?.client ?? null;
  const ownerName = transaction.ownerMembership
    ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}`
    : "";

  return {
    transactionTitle: transaction.title,
    propertyAddress: transaction.address,
    city: transaction.city,
    state: transaction.state,
    zipCode: transaction.zipCode,
    transactionType: transactionTypeLabelMap[transaction.type],
    transactionStatus: transactionStatusLabelMap[transaction.status],
    representing: transactionRepresentingLabelMap[transaction.representing],
    ownerName,
    ownerEmail: transaction.ownerMembership?.user.email ?? "",
    primaryContactName: primaryContact?.fullName ?? "",
    primaryContactEmail: primaryContact?.email ?? "",
    primaryContactPhone: primaryContact?.phone ?? "",
    offerTitle: offer?.title ?? "",
    offerPartyName: (offer?.buyerName?.trim() || offer?.offeringPartyName) ?? "",
    offerPrice: formatCurrency(offer?.price),
    offerEarnestMoney: formatCurrency(offer?.earnestMoneyAmount),
    offerFinancingType: offer?.financingType ?? "",
    offerClosingDate: formatDateValue(offer?.closingDateOffered ?? null),
    offerExpirationDate: formatDateValue(offer?.expirationAt ?? null),
    grossCommission: formatCurrency(transaction.grossCommission),
    referralFee: formatCurrency(transaction.referralFee),
    officeNet: formatCurrency(transaction.officeNet),
    agentNet: formatCurrency(transaction.agentNet),
    closingDate: formatDateValue(transaction.closingDate),
    importantDate: formatDateValue(transaction.importantDate)
  };
}



export async function syncFormAndDocumentSignatureState(
  tx: Prisma.TransactionClient,
  input: {
    formId?: string | null;
    documentId?: string | null;
  }
) {
  if (!input.formId) {
    return;
  }

  const signatureRequests = await tx.signatureRequest.findMany({
    where: {
      formId: input.formId
    },
    orderBy: [{ createdAt: "asc" }]
  });

  let nextFormStatus: TransactionFormStatus | null = null;
  let nextDocumentStatus: TransactionDocumentStatus | null = null;
  let nextDocumentSignedAt: Date | null = null;
  let nextDocumentSigned = false;
  const resolvedStatuses = signatureRequests.map((request) => ({
    ...request,
    resolvedStatus: resolveSignatureStatus(request)
  }));

  if (resolvedStatuses.some((request) => request.resolvedStatus === SignatureRequestStatus.declined)) {
    nextFormStatus = TransactionFormStatus.rejected;
    nextDocumentStatus = TransactionDocumentStatus.rejected;
  } else if (
    resolvedStatuses.length > 0 &&
    resolvedStatuses.every((request) => request.resolvedStatus === SignatureRequestStatus.completed)
  ) {
    nextFormStatus = TransactionFormStatus.fully_signed;
    nextDocumentStatus = TransactionDocumentStatus.signed;
    nextDocumentSigned = true;
    nextDocumentSignedAt = resolvedStatuses.reduce<Date | null>((latest, request) => {
      if (!request.completedAt) {
        return latest;
      }

      if (!latest || request.completedAt > latest) {
        return request.completedAt;
      }

      return latest;
    }, null);
  } else if (
    resolvedStatuses.some(
      (request) =>
        request.resolvedStatus === SignatureRequestStatus.signed || request.resolvedStatus === SignatureRequestStatus.completed
    )
  ) {
    nextFormStatus = TransactionFormStatus.partially_signed;
    nextDocumentStatus = TransactionDocumentStatus.submitted;
  } else if (
    resolvedStatuses.some((request) =>
      request.resolvedStatus === SignatureRequestStatus.sent ||
      request.resolvedStatus === SignatureRequestStatus.viewed ||
      request.resolvedStatus === SignatureRequestStatus.expired
    )
  ) {
    nextFormStatus = TransactionFormStatus.sent_for_signature;
    nextDocumentStatus = TransactionDocumentStatus.submitted;
  } else if (
    resolvedStatuses.length > 0 &&
    resolvedStatuses.every(
      (request) =>
        request.resolvedStatus === SignatureRequestStatus.canceled || request.resolvedStatus === SignatureRequestStatus.expired
    )
  ) {
    nextFormStatus = TransactionFormStatus.prepared;
    nextDocumentStatus = TransactionDocumentStatus.uploaded;
  }

  if (nextFormStatus) {
    await tx.transactionForm.update({
      where: {
        id: input.formId
      },
      data: {
        status: nextFormStatus
      }
    });
  }

  if (input.documentId && nextDocumentStatus) {
    await tx.transactionDocument.update({
      where: {
        id: input.documentId
      },
      data: {
        status: nextDocumentStatus,
        isSigned: nextDocumentSigned,
        signedAt: nextDocumentSignedAt
      }
    });
  }
}



export async function reconcileLinkedWorkflowTasks(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    transactionId: string;
    actorMembershipId?: string | null;
    taskIds: Array<string | null | undefined>;
    reason: string;
  }
) {
  const taskIds = Array.from(new Set(input.taskIds.filter((taskId): taskId is string => Boolean(taskId))));

  for (const taskId of taskIds) {
    await reconcileTransactionTaskDocumentWorkflow(tx, {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      taskId,
      actorMembershipId: input.actorMembershipId ?? null,
      reason: input.reason
    });
  }
}



export function buildDocumentObjectLabel(documentTitle: string, transaction: { title: string; address: string; city: string; state: string }) {
  return `${documentTitle} · ${buildTransactionObjectLabel(transaction)}`;
}



export function buildFormObjectLabel(formName: string, transaction: { title: string; address: string; city: string; state: string }) {
  return `${formName} · ${buildTransactionObjectLabel(transaction)}`;
}



export function buildIncomingUpdateObjectLabel(summary: string, sourceSystem: string) {
  return `${summary} · ${sourceSystem}`;
}



export function buildChanges(
  previousValue: string | null | undefined,
  nextValue: string | null | undefined,
  label: string
) {
  const previousText = previousValue?.trim() || "—";
  const nextText = nextValue?.trim() || "—";

  if (previousText === nextText) {
    return [];
  }

  return [
    {
      label,
      previousValue: previousText,
      nextValue: nextText
    }
  ];
}



export function clampRelativeMetric(value: number, minimum = 0, maximum = 1) {
  if (Number.isNaN(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}



export async function recordSignatureAuditEntry(
  tx: Prisma.TransactionClient,
  input: {
    signatureRequestId: string;
    eventType: SignatureAuditEventType;
    actorMembershipId?: string | null;
    actorLabel?: string | null;
    details?: Record<string, string>;
  }
) {
  await tx.signatureAuditEntry.create({
    data: {
      signatureRequestId: input.signatureRequestId,
      eventType: input.eventType,
      actorMembershipId: input.actorMembershipId ?? null,
      actorLabel: input.actorLabel?.trim() || null,
      details: input.details ?? {}
    }
  });
}



export async function getSignatureRequestRecord(organizationId: string, transactionId: string, signatureRequestId: string) {
  return prisma.signatureRequest.findFirst({
    where: {
      id: signatureRequestId,
      organizationId,
      transactionId
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          category: true
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
          transactionId: true,
          fileName: true,
          mimeType: true,
          fileSizeBytes: true,
          storageKey: true,
          storageUrl: true,
          documentType: true,
          status: true,
          source: true,
          isRequired: true,
          isSigned: true,
          isUnsorted: true,
          signedAt: true,
          linkedTaskId: true,
          createdAt: true,
          updatedAt: true,
          linkedTask: {
            select: {
              id: true,
              title: true
            }
          },
          signatureRequests: {
            include: {
              recipients: {
                orderBy: [{ sortOrder: "asc" }]
              }
            },
            orderBy: [{ createdAt: "desc" }]
          }
        }
      },
      completedDocument: {
        select: {
          id: true,
          title: true,
          transactionId: true
        }
      },
      fields: {
        orderBy: [{ sortOrder: "asc" }]
      },
      recipients: {
        orderBy: [{ sortOrder: "asc" }]
      },
      artifacts: true,
      auditEntries: {
        orderBy: [{ createdAt: "desc" }]
      }
    }
  });
}



export async function getSignatureEditorSnapshot(
  organizationId: string,
  transactionId: string,
  signatureRequestId: string
): Promise<OfficeSignatureEditorSnapshot | null> {
  const request = await getSignatureRequestRecord(organizationId, transactionId, signatureRequestId);

  if (!request?.document) {
    return null;
  }

  return {
    signatureRequest: mapSignatureRequest(request),
    fields: request.fields.map(mapSignatureField),
    auditEntries: request.auditEntries.map(mapSignatureAuditEntry),
    document: mapTransactionDocument(request.document as TransactionDocumentRecord)
  };
}



export function hashSignatureToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}



export async function getPublicSignatureRequestRecord(token: string) {
  const hashedToken = hashSignatureToken(token);

  const recipientMatch = await prisma.signatureRecipient.findFirst({
    where: {
      tokenHash: hashedToken
    },
    include: {
      signatureRequest: {
        include: {
          template: {
            select: {
              id: true,
              name: true,
              category: true
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
              transactionId: true,
              fileName: true,
              mimeType: true,
              fileSizeBytes: true,
              storageKey: true,
              storageUrl: true,
              documentType: true,
              status: true,
              source: true,
              isRequired: true,
              isSigned: true,
              isUnsorted: true,
              signedAt: true,
              linkedTaskId: true,
              createdAt: true,
              updatedAt: true,
              linkedTask: {
                select: {
                  id: true,
                  title: true
                }
              },
              signatureRequests: {
                include: {
                  recipients: {
                    orderBy: [{ sortOrder: "asc" }]
                  }
                },
                orderBy: [{ createdAt: "desc" }]
              }
            }
          },
          completedDocument: {
            select: {
              id: true,
              title: true,
              transactionId: true
            }
          },
          fields: {
            orderBy: [{ sortOrder: "asc" }]
          },
          recipients: {
            orderBy: [{ sortOrder: "asc" }]
          },
          artifacts: true,
          auditEntries: {
            orderBy: [{ createdAt: "desc" }]
          }
        }
      }
    }
  });

  if (recipientMatch?.signatureRequest) {
    return {
      request: recipientMatch.signatureRequest,
      currentRecipientId: recipientMatch.id
    };
  }

  const request = await prisma.signatureRequest.findFirst({
    where: {
      publicTokenHash: hashedToken
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          category: true
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
          transactionId: true,
          fileName: true,
          mimeType: true,
          fileSizeBytes: true,
          storageKey: true,
          storageUrl: true,
          documentType: true,
          status: true,
          source: true,
          isRequired: true,
          isSigned: true,
          isUnsorted: true,
          signedAt: true,
          linkedTaskId: true,
          createdAt: true,
          updatedAt: true,
          linkedTask: {
            select: {
              id: true,
              title: true
            }
          },
          signatureRequests: {
            include: {
              recipients: {
                orderBy: [{ sortOrder: "asc" }]
              }
            },
            orderBy: [{ createdAt: "desc" }]
          }
        }
      },
      completedDocument: {
        select: {
          id: true,
          title: true,
          transactionId: true
        }
      },
      fields: {
        orderBy: [{ sortOrder: "asc" }]
      },
      recipients: {
        orderBy: [{ sortOrder: "asc" }]
      },
      artifacts: true,
      auditEntries: {
        orderBy: [{ createdAt: "desc" }]
      }
    }
  });

  return {
    request,
    currentRecipientId: null
  };
}



export function buildLegacyPublicRecipient(request: OfficeSignatureRequest): OfficeSignatureRecipient {
  let statusKey: SignatureRecipientStatus = SignatureRecipientStatus.draft;

  if (request.statusKey === SignatureRequestStatus.sent || request.statusKey === SignatureRequestStatus.pending_send) {
    statusKey = SignatureRecipientStatus.sent;
  } else if (request.statusKey === SignatureRequestStatus.viewed) {
    statusKey = SignatureRecipientStatus.viewed;
  } else if (request.statusKey === SignatureRequestStatus.signed || request.statusKey === SignatureRequestStatus.completed) {
    statusKey = SignatureRecipientStatus.acted;
  } else if (request.statusKey === SignatureRequestStatus.declined) {
    statusKey = SignatureRecipientStatus.declined;
  } else if (request.statusKey === SignatureRequestStatus.expired) {
    statusKey = SignatureRecipientStatus.expired;
  } else if (request.statusKey === SignatureRequestStatus.canceled || request.statusKey === SignatureRequestStatus.voided) {
    statusKey = SignatureRecipientStatus.voided;
  }

  return {
    id: `legacy-${request.id}`,
    roleKey: SignatureRecipientRole.signer,
    role: signatureRecipientRoleLabelMap[SignatureRecipientRole.signer],
    name: request.recipientName,
    email: request.recipientEmail,
    recipientRole: request.recipientRole,
    routingStep: request.signingOrder ?? 1,
    sortOrder: 0,
    statusKey,
    status: signatureRecipientStatusLabelMap[statusKey],
    sentAt: request.sentAt,
    firstViewedAt: request.firstViewedAt,
    viewedAt: request.viewedAt,
    actedAt: request.signedAt || request.completedAt,
    declinedAt: request.declinedAt,
    tokenIssued: true
  };
}

function getOriginalSignatureArtifact(
  request: {
    artifacts?: Array<{
      id: string;
      kind: string;
      title: string;
      fileName: string;
      mimeType: string;
      fileSizeBytes: number;
      storageKey: string;
      storageUrl?: string | null;
    }>;
  },
) {
  return (
    request.artifacts?.find((artifact) => artifact.kind === SignatureArtifactKind.original) ??
    null
  );
}



export async function getPublicSignatureRequestSnapshot(token: string): Promise<PublicSignatureRequestSnapshot | null> {
  let access = await getPublicSignatureRequestRecord(token);
  let request = access?.request ?? null;

  if (!request) {
    return null;
  }

  const originalArtifact = getOriginalSignatureArtifact(request);

  if (!request.document && !originalArtifact) {
    return null;
  }

  const resolvedStatus = resolveSignatureStatus(request);

  if (resolvedStatus === SignatureRequestStatus.expired && request.status !== SignatureRequestStatus.expired) {
    await updateSignatureRequest({
      organizationId: request.organizationId,
      transactionId: request.transactionId,
      signatureRequestId: request.id,
      action: "expire"
    });
    access = await getPublicSignatureRequestRecord(token);
    request = access?.request ?? null;
    if (!request) {
      return null;
    }
  } else {
    const currentRecipient =
      access?.currentRecipientId ? request.recipients.find((recipient) => recipient.id === access.currentRecipientId) ?? null : null;

    if (request.status === SignatureRequestStatus.sent || currentRecipient?.status === SignatureRecipientStatus.sent) {
      await updateSignatureRequest({
        organizationId: request.organizationId,
        transactionId: request.transactionId,
        signatureRequestId: request.id,
        action: "viewed",
        recipientId: currentRecipient?.id ?? null
      });
      access = await getPublicSignatureRequestRecord(token);
      request = access?.request ?? null;
      if (!request) {
        return null;
      }
    }
  }

  const refreshedOriginalArtifact = getOriginalSignatureArtifact(request);

  if (!request.document && !refreshedOriginalArtifact) {
    return null;
  }

  const mappedRequest = mapSignatureRequest(request);
  const currentRecipient =
    access?.currentRecipientId ? request.recipients.find((recipient) => recipient.id === access.currentRecipientId) ?? null : null;

  return {
    request: mappedRequest,
    currentRecipient: currentRecipient ? mapSignatureRecipient(currentRecipient) : buildLegacyPublicRecipient(mappedRequest),
    fields: request.fields.map(mapSignatureField),
    submittedValues: collectSubmittedFieldValues(request.recipients),
    auditEntries: request.auditEntries.map(mapSignatureAuditEntry),
    document: {
      id: request.document?.id ?? refreshedOriginalArtifact!.id,
      title: request.document?.title ?? refreshedOriginalArtifact!.title,
      fileName: request.document?.fileName ?? refreshedOriginalArtifact!.fileName,
      mimeType: request.document?.mimeType ?? refreshedOriginalArtifact!.mimeType
    }
  };
}



export async function getPublicSignatureDocumentStorageRecord(token: string) {
  const access = await getPublicSignatureRequestRecord(token);
  const request = access?.request ?? null;

  if (!request) {
    return null;
  }

  const originalArtifact = getOriginalSignatureArtifact(request);

  if (!request.document && !originalArtifact) {
    return null;
  }

  if (
    request.expiredAt ||
    (request.expiresAt && request.expiresAt.getTime() <= Date.now())
  ) {
    return null;
  }

  return {
    signatureRequestId: request.id,
    currentRecipientId: access?.currentRecipientId ?? null,
    organizationId: request.organizationId,
    officeId: request.officeId,
    transactionId: request.transactionId,
    sourceKind: request.document ? "transaction_document" : "signature_artifact",
    documentId: request.document?.id ?? originalArtifact!.id,
    title: request.document?.title ?? originalArtifact!.title,
    fileName: request.document?.fileName ?? originalArtifact!.fileName,
    mimeType: request.document?.mimeType ?? originalArtifact!.mimeType,
    storageKey: request.document?.storageKey ?? originalArtifact!.storageKey,
    documentType: request.document?.documentType ?? "signature",
    linkedTaskId: request.document?.linkedTaskId ?? null,
    offerId: request.offerId,
    fields: request.fields.map(mapSignatureField),
    submittedValues: collectSubmittedFieldValues(request.recipients)
  };
}



export async function replaceSignatureRequestFields(input: ReplaceSignatureFieldsInput): Promise<OfficeSignatureField[] | null> {
  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.signatureRequest.findFirst({
      where: {
        id: input.signatureRequestId,
        organizationId: input.organizationId,
        transactionId: input.transactionId
      },
      select: {
        id: true,
        recipients: {
          orderBy: [{ sortOrder: "asc" }]
        }
      }
    });

    if (!existing) {
      return null;
    }

    const validRecipientIds = new Set(
      existing.recipients.filter((recipient) => recipient.role !== SignatureRecipientRole.cc).map((recipient) => recipient.id)
    );

    await tx.signatureField.deleteMany({
      where: {
        signatureRequestId: existing.id
      }
    });

    for (const [index, field] of input.fields.entries()) {
      const assignedRecipientId = field.assignedRecipientId?.trim() || null;

      if (assignedRecipientId && !validRecipientIds.has(assignedRecipientId)) {
        throw new Error("Signature fields can only be assigned to active signer or approver recipients.");
      }

      await tx.signatureField.create({
        data: {
          signatureRequestId: existing.id,
          assignedRecipientId,
          fieldType: field.fieldType,
          label: field.label.trim() || `${field.fieldType} ${index + 1}`,
          page: Math.max(1, Math.trunc(field.page)),
          x: clampRelativeMetric(field.x),
          y: clampRelativeMetric(field.y),
          width: clampRelativeMetric(field.width, 0.04, 1),
          height: clampRelativeMetric(field.height, 0.02, 1),
          required: field.required ?? true,
          defaultValue: field.defaultValue?.trim() || null,
          fontStyle: field.fontStyle?.trim() || null,
          fieldKey: field.fieldKey?.trim() || null,
          isReadOnly: field.isReadOnly ?? false,
          isSystemPrefilled: field.isSystemPrefilled ?? false,
          visibilityRule: field.visibilityRule ? toInputJsonValue(field.visibilityRule) : Prisma.JsonNull,
          mirrorGroup: field.mirrorGroup?.trim() || null,
          fieldOptions: field.fieldOptions ? toInputJsonValue(field.fieldOptions) : Prisma.JsonNull,
          sortOrder: field.sortOrder ?? index
        }
      });
    }

    await recordSignatureAuditEntry(tx, {
      signatureRequestId: existing.id,
      eventType: SignatureAuditEventType.field_updated,
      actorMembershipId: input.actorMembershipId,
      actorLabel: "Internal team member",
      details: {
        fields: String(input.fields.length)
      }
    });

    return tx.signatureField.findMany({
      where: {
        signatureRequestId: existing.id
      },
      orderBy: [{ sortOrder: "asc" }]
    });
  });

  return saved ? saved.map(mapSignatureField) : null;
}



export async function listTransactionDocumentsSnapshot(
  organizationId: string,
  transactionId: string
): Promise<OfficeTransactionDocumentsSnapshot> {
  const [documents, forms, signatureRequests, incomingUpdates, formTemplates] = await Promise.all([
    prisma.transactionDocument.findMany({
      where: {
        organizationId,
        transactionId
      },
      include: {
        linkedTask: {
          select: {
            id: true,
            title: true
          }
        },
        signatureRequests: {
          include: {
            recipients: {
              orderBy: [{ sortOrder: "asc" }]
            }
          },
          orderBy: [{ createdAt: "desc" }]
        }
      },
      orderBy: [{ isUnsorted: "desc" }, { createdAt: "desc" }]
    }),
    prisma.transactionForm.findMany({
      where: {
        organizationId,
        transactionId
      },
      include: {
        template: true,
        linkedTask: {
          select: {
            id: true,
            title: true
          }
        },
        document: {
          select: {
            id: true,
            title: true
          }
        },
        createdByMembership: {
          include: {
            user: true
          }
        },
        signatureRequests: {
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
            recipients: {
              orderBy: [{ sortOrder: "asc" }]
            },
            artifacts: true,
            completedDocument: {
              select: {
                id: true,
                title: true,
                transactionId: true
              }
            }
          },
          orderBy: [{ createdAt: "asc" }]
        }
      },
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.signatureRequest.findMany({
      where: {
        organizationId,
        transactionId
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true
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
        fields: {
          orderBy: [{ sortOrder: "asc" }]
        },
        recipients: {
          orderBy: [{ sortOrder: "asc" }]
        },
        artifacts: true,
        auditEntries: {
          orderBy: [{ createdAt: "desc" }]
        }
      },
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.incomingUpdate.findMany({
      where: {
        organizationId,
        transactionId
      },
      include: {
        reviewedByMembership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ receivedAt: "desc" }]
    }),
    prisma.formTemplate.findMany({
      where: {
        isActive: true,
        OR: [{ organizationId: null }, { organizationId }]
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }]
    })
  ]);

  return {
    documents: documents.map(mapTransactionDocument),
    forms: forms.map(mapTransactionForm),
    signatureRequests: signatureRequests.map(mapSignatureRequest),
    incomingUpdates: incomingUpdates.map(mapIncomingUpdate),
    formTemplates: formTemplates.map((template) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      description: template.description ?? "",
      documentType: template.documentType
    }))
  };
}



export async function getTransactionDocumentStorageRecord(
  organizationId: string,
  transactionId: string,
  documentId: string
) {
  return prisma.transactionDocument.findFirst({
    where: {
      id: documentId,
      organizationId,
      transactionId
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      storageKey: true,
      transactionId: true,
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
}
