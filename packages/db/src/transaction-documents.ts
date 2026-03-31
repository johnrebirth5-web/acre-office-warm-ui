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
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { createNotificationsForMemberships, listOfficeNotificationRecipientIds } from "./notifications";
import { reconcileTransactionTaskDocumentWorkflow } from "./transaction-tasks";

export type OfficeTransactionDocumentFilter = "all" | "unsorted" | "signed" | "pending_signature" | "linked_to_tasks";

export type OfficeTransactionDocument = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  storageUrl: string;
  documentType: string;
  statusKey: TransactionDocumentStatus;
  status: string;
  sourceKey: TransactionDocumentSource;
  source: string;
  isRequired: boolean;
  isSigned: boolean;
  isUnsorted: boolean;
  signedAt: string;
  linkedTaskId: string | null;
  linkedTaskTitle: string;
  linkedTaskHref: string;
  hasPendingSignature: boolean;
  latestSignatureStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type OfficeFormTemplateOption = {
  id: string;
  key: string;
  name: string;
  description: string;
  documentType: string;
};

export type OfficeSignatureRequest = {
  id: string;
  templateId: string | null;
  formId: string | null;
  documentId: string | null;
  documentTitle: string;
  documentHref: string;
  completedDocumentId: string | null;
  completedDocumentTitle: string;
  completedDocumentHref: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  emailSubject: string;
  emailBody: string;
  signingOrder: number | null;
  senderDisplayName: string;
  senderReplyTo: string;
  statusKey: SignatureRequestStatus;
  status: string;
  contextType: string;
  contextId: string;
  contextLabel: string;
  driveSyncStatus: SignatureDriveSyncStatus;
  driveSyncStatusLabel: string;
  driveSyncError: string;
  driveSyncedAt: string;
  driveFolderId: string;
  driveFileId: string;
  expiresAt: string;
  sentAt: string;
  firstViewedAt: string;
  viewedAt: string;
  signedAt: string;
  completedAt: string;
  declinedAt: string;
  canceledAt: string;
  expiredAt: string;
  createdAt: string;
  updatedAt: string;
  recipients: OfficeSignatureRecipient[];
  ccRecipients: OfficeSignatureRecipient[];
  artifacts: OfficeSignatureArtifact[];
  templateSummary: {
    id: string;
    name: string;
    category: SignatureTemplateCategory | "";
  } | null;
  contextSummary: {
    type: string;
    id: string;
    label: string;
  };
};

export type OfficeSignatureField = {
  id: string;
  signatureRequestId: string;
  assignedRecipientId: string | null;
  fieldType: SignatureFieldType;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  defaultValue: string;
  fontStyle: string;
  fieldKey: string;
  isReadOnly: boolean;
  isSystemPrefilled: boolean;
  visibilityRule: Record<string, string>;
  mirrorGroup: string;
  fieldOptions: Record<string, string>;
  sortOrder: number;
};

export type OfficeSignatureRecipient = {
  id: string;
  roleKey: SignatureRecipientRole;
  role: string;
  name: string;
  email: string;
  recipientRole: string;
  routingStep: number;
  sortOrder: number;
  statusKey: SignatureRecipientStatus;
  status: string;
  sentAt: string;
  firstViewedAt: string;
  viewedAt: string;
  actedAt: string;
  declinedAt: string;
  tokenIssued: boolean;
};

export type OfficeSignatureArtifact = {
  id: string;
  kind: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  storageUrl: string;
  driveSyncStatus: SignatureDriveSyncStatus;
  driveSyncStatusLabel: string;
  driveSyncError: string;
  driveSyncedAt: string;
  driveFolderId: string;
  driveFileId: string;
  driveWebViewLink: string;
};

export type OfficeSignatureFieldValue = {
  fieldId: string;
  recipientId: string;
  fieldType: SignatureFieldType;
  textValue: string;
  signatureMode: "draw" | "type" | "upload" | "";
  imageDataUrl: string;
};

export type OfficeSignatureAuditEntry = {
  id: string;
  eventType: SignatureAuditEventType;
  eventLabel: string;
  actorLabel: string;
  details: string[];
  createdAt: string;
};

export type OfficeSignatureEditorSnapshot = {
  signatureRequest: OfficeSignatureRequest;
  fields: OfficeSignatureField[];
  auditEntries: OfficeSignatureAuditEntry[];
  document: OfficeTransactionDocument;
};

export type PublicSignatureRequestSnapshot = {
  request: OfficeSignatureRequest;
  currentRecipient: OfficeSignatureRecipient;
  fields: OfficeSignatureField[];
  submittedValues: OfficeSignatureFieldValue[];
  auditEntries: OfficeSignatureAuditEntry[];
  document: {
    id: string;
    title: string;
    fileName: string;
    mimeType: string;
  };
};

export type OfficeTransactionForm = {
  id: string;
  templateId: string | null;
  templateName: string;
  linkedTaskId: string | null;
  linkedTaskTitle: string;
  linkedTaskHref: string;
  documentId: string | null;
  documentTitle: string;
  name: string;
  statusKey: TransactionFormStatus;
  status: string;
  generatedPayload: Record<string, string>;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  signatureRequests: OfficeSignatureRequest[];
};

export type OfficeIncomingUpdate = {
  id: string;
  sourceSystem: string;
  sourceReference: string;
  statusKey: IncomingUpdateStatus;
  status: string;
  summary: string;
  payloadPreview: string[];
  receivedAt: string;
  reviewedAt: string;
  reviewedByName: string;
  acceptedAt: string;
  rejectedAt: string;
};

export type OfficeTransactionDocumentsSnapshot = {
  documents: OfficeTransactionDocument[];
  forms: OfficeTransactionForm[];
  signatureRequests: OfficeSignatureRequest[];
  incomingUpdates: OfficeIncomingUpdate[];
  formTemplates: OfficeFormTemplateOption[];
};

export type CreateTransactionDocumentInput = {
  organizationId: string;
  officeId?: string | null;
  transactionId: string;
  actorMembershipId?: string;
  offerId?: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  storageUrl?: string | null;
  documentType?: string;
  status?: TransactionDocumentStatus;
  source?: TransactionDocumentSource;
  isRequired?: boolean;
  isUnsorted?: boolean;
  isSigned?: boolean;
  signedAt?: string | null;
  linkedTaskId?: string | null;
};

export type UpdateTransactionDocumentInput = {
  organizationId: string;
  transactionId: string;
  documentId: string;
  actorMembershipId?: string;
  offerId?: string | null;
  title?: string;
  documentType?: string;
  status?: TransactionDocumentStatus;
  isRequired?: boolean;
  isUnsorted?: boolean;
  linkedTaskId?: string | null;
};

export type PrepareTransactionFormDraftInput = {
  organizationId: string;
  transactionId: string;
  templateId: string;
  linkedTaskId?: string | null;
  offerId?: string | null;
  name?: string;
};

export type PreparedTransactionFormDraft = {
  templateId: string;
  templateName: string;
  documentType: string;
  name: string;
  generatedPayload: Record<string, string>;
  linkedTaskId: string | null;
  offerId: string | null;
};

export type CreateTransactionFormInput = {
  organizationId: string;
  officeId?: string | null;
  transactionId: string;
  actorMembershipId: string;
  templateId: string;
  linkedTaskId?: string | null;
  offerId?: string | null;
  name: string;
  generatedPayload: Record<string, string>;
  generatedDocument?: {
    title: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storageKey: string;
    storageUrl?: string | null;
    documentType: string;
  } | null;
};

export type UpdateTransactionFormInput = {
  organizationId: string;
  transactionId: string;
  formId: string;
  actorMembershipId?: string;
  name?: string;
  linkedTaskId?: string | null;
  offerId?: string | null;
  generatedPayload?: Record<string, string>;
  status?: TransactionFormStatus;
};

export type CreateSignatureRequestInput = {
  organizationId: string;
  officeId?: string | null;
  transactionId: string;
  actorMembershipId: string;
  signatureRequestId?: string | null;
  formId?: string | null;
  documentId?: string | null;
  offerId?: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  emailSubject?: string | null;
  emailBody?: string | null;
  expiresAt?: string | null;
  senderDisplayName?: string | null;
  senderReplyTo?: string | null;
  signingOrder?: number | null;
  templateId?: string | null;
  contextType?: "transaction" | "membership" | "finance_request" | "admin_request" | "generic";
  contextId?: string | null;
  contextLabel?: string | null;
  subjectMembershipId?: string | null;
  recipients?: Array<{
    id?: string | null;
    role?: SignatureRecipientRole;
    name: string;
    email: string;
    recipientRole: string;
    routingStep?: number | null;
    sortOrder?: number | null;
  }>;
  ccRecipients?: Array<{
    id?: string | null;
    name: string;
    email: string;
    recipientRole: string;
    sortOrder?: number | null;
  }>;
};

export type UpdateSignatureRequestInput = {
  organizationId: string;
  transactionId: string;
  signatureRequestId: string;
  actorMembershipId?: string;
  action: "send" | "resend" | "advance" | "viewed" | "signed" | "completed" | "declined" | "canceled" | "expire";
  tokenHash?: string | null;
  recipientId?: string | null;
  recipientTokens?: Array<{
    recipientId: string;
    tokenHash: string;
  }>;
  submittedValues?: Prisma.JsonValue | null;
  completedDocumentId?: string | null;
};

export type ReplaceSignatureFieldsInput = {
  organizationId: string;
  transactionId: string;
  signatureRequestId: string;
  actorMembershipId: string;
  fields: Array<{
    id?: string;
    assignedRecipientId?: string | null;
    fieldType: SignatureFieldType;
    label: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required?: boolean;
    defaultValue?: string | null;
    fontStyle?: string | null;
    fieldKey?: string | null;
    isReadOnly?: boolean;
    isSystemPrefilled?: boolean;
    visibilityRule?: Prisma.JsonValue;
    mirrorGroup?: string | null;
    fieldOptions?: Prisma.JsonValue;
    sortOrder?: number;
  }>;
};

export type CreateIncomingUpdateInput = {
  organizationId: string;
  officeId?: string | null;
  transactionId?: string | null;
  actorMembershipId?: string;
  sourceSystem: string;
  sourceReference: string;
  summary: string;
  payload: Record<string, Prisma.JsonValue>;
};

export type ReviewIncomingUpdateInput = {
  organizationId: string;
  transactionId: string;
  incomingUpdateId: string;
  actorMembershipId: string;
  action: "accept" | "reject";
};

type TransactionDocumentRecord = Prisma.TransactionDocumentGetPayload<{
  include: {
    linkedTask: {
      select: {
        id: true;
        title: true;
      };
    };
    signatureRequests: {
      include: {
        recipients: {
          orderBy: {
            sortOrder: "asc";
          };
        };
      };
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

type TransactionFormRecord = Prisma.TransactionFormGetPayload<{
  include: {
    template: true;
    linkedTask: {
      select: {
        id: true;
        title: true;
      };
    };
    document: {
      select: {
        id: true;
        title: true;
      };
    };
    createdByMembership: {
      include: {
        user: true;
      };
    };
    signatureRequests: {
      include: {
        template: {
          select: {
            id: true;
            name: true;
            category: true;
          };
        };
        document: {
          select: {
            id: true;
            title: true;
            transactionId: true;
          };
        };
        recipients: {
          orderBy: {
            sortOrder: "asc";
          };
        };
        artifacts: true;
        completedDocument: {
          select: {
            id: true;
            title: true;
            transactionId: true;
          };
        };
      };
      orderBy: {
        createdAt: "asc";
      };
    };
  };
}>;

type SignatureRequestRecord = Prisma.SignatureRequestGetPayload<{
  include: {
    template: {
      select: {
        id: true;
        name: true;
        category: true;
      };
    };
    form: {
      select: {
        id: true;
        name: true;
        linkedTaskId: true;
      };
    };
    document: {
      select: {
        id: true;
        title: true;
        transactionId: true;
      };
    };
    completedDocument: {
      select: {
        id: true;
        title: true;
        transactionId: true;
      };
    };
    fields: {
      orderBy: {
        sortOrder: "asc";
      };
    };
    recipients: {
      orderBy: {
        sortOrder: "asc";
      };
    };
    artifacts: true;
    auditEntries: {
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

type SignatureAuditEntryRecord = Prisma.SignatureAuditEntryGetPayload<{}>;

type IncomingUpdateRecord = Prisma.IncomingUpdateGetPayload<{
  include: {
    reviewedByMembership: {
      include: {
        user: true;
      };
    };
  };
}>;

type MergeContextTransaction = Prisma.TransactionGetPayload<{
  include: {
    ownerMembership: {
      include: {
        user: true;
      };
    };
    transactionContacts: {
      where: {
        isPrimary: true;
      };
      include: {
        client: true;
      };
    };
  };
}>;

type MergeContextOffer = Prisma.OfferGetPayload<{
  select: {
    id: true;
    title: true;
    offeringPartyName: true;
    buyerName: true;
    price: true;
    earnestMoneyAmount: true;
    financingType: true;
    closingDateOffered: true;
    expirationAt: true;
  };
}>;

const documentStatusLabelMap: Record<TransactionDocumentStatus, string> = {
  uploaded: "Uploaded",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  signed: "Signed",
  archived: "Archived"
};

const documentSourceLabelMap: Record<TransactionDocumentSource, string> = {
  manual_upload: "Manual upload",
  generated_form: "Generated form",
  incoming_update: "Incoming update",
  synced_external: "Synced external",
  email_pdf: "Email PDF",
  signature_output: "Signed output"
};

const formStatusLabelMap: Record<TransactionFormStatus, string> = {
  draft: "Draft",
  prepared: "Prepared",
  sent_for_signature: "Sent for signature",
  partially_signed: "Partially signed",
  fully_signed: "Fully signed",
  rejected: "Rejected",
  voided: "Voided"
};

const signatureStatusLabelMap: Record<SignatureRequestStatus, string> = {
  draft: "Draft",
  pending_send: "Pending send",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  completed: "Completed",
  declined: "Declined",
  canceled: "Void / Cancelled",
  voided: "Void / Cancelled",
  expired: "Expired"
};

const signatureRecipientRoleLabelMap: Record<SignatureRecipientRole, string> = {
  signer: "Signer",
  approver: "Approver",
  cc: "CC"
};

const signatureRecipientStatusLabelMap: Record<SignatureRecipientStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  sent: "Sent",
  viewed: "Viewed",
  acted: "Signed / Approved",
  declined: "Declined",
  voided: "Void / Cancelled",
  expired: "Expired"
};

const signatureDriveStatusLabelMap: Record<SignatureDriveSyncStatus, string> = {
  not_configured: "Not configured",
  pending: "Pending",
  synced: "Synced",
  failed: "Failed"
};

const signatureAuditEventLabelMap: Record<SignatureAuditEventType, string> = {
  request_created: "Request created",
  email_sent: "Email sent",
  link_opened: "Link opened",
  field_updated: "Fields updated",
  signature_submitted: "Signature submitted",
  pdf_finalized: "Signed PDF finalized",
  request_expired: "Request expired",
  request_canceled: "Request canceled"
};

const incomingUpdateStatusLabelMap: Record<IncomingUpdateStatus, string> = {
  pending_review: "Pending review",
  accepted: "Accepted",
  rejected: "Rejected",
  applied: "Applied"
};

const transactionTypeLabelMap: Record<TransactionType, string> = {
  sales: "Sales",
  sales_listing: "Sales (listing)",
  rental_leasing: "Rental/Leasing",
  rental_listing: "Rental (listing)",
  commercial_sales: "Commercial Sales",
  commercial_lease: "Commercial Lease",
  other: "Other"
};

const transactionStatusLabelMap: Record<TransactionStatus, string> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

const transactionRepresentingLabelMap: Record<TransactionRepresenting, string> = {
  buyer: "Buyer",
  seller: "Seller",
  both: "Both",
  tenant: "Tenant",
  landlord: "Landlord"
};

function formatDateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDateTimeValue(date: Date | null) {
  return date ? date.toISOString() : "";
}

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function toInputJsonValue(value: Prisma.JsonValue): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function parseOptionalDate(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMembershipName(membership: { user: { firstName: string; lastName: string } } | null | undefined) {
  return membership ? `${membership.user.firstName} ${membership.user.lastName}` : "";
}

function buildTransactionObjectLabel(transaction: { title: string; address: string; city: string; state: string }) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}

function buildOfferObjectLabel(offer: { title: string; offeringPartyName: string; buyerName: string | null }) {
  const party = offer.buyerName?.trim() || offer.offeringPartyName;
  return `${offer.title} · ${party}`;
}

function normalizeJsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry ?? "")]));
}

function normalizeSubmittedFieldValues(
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

function collectSubmittedFieldValues(
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

function buildDocumentHref(transactionId: string, documentId: string) {
  return `/api/office/transactions/${transactionId}/documents/${documentId}/file`;
}

function buildTaskHref(transactionId: string, taskId: string | null | undefined) {
  return taskId ? `/office/transactions/${transactionId}#transaction-task-${taskId}` : "";
}

function buildSignatureRequestEditorHref(transactionId: string, signatureRequestId: string) {
  return `/office/transactions/${transactionId}/signatures/${signatureRequestId}`;
}

function resolveSignatureStatus(request: {
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

function mapSignatureField(field: {
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

function mapSignatureRecipient(recipient: {
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

function mapSignatureArtifact(artifact: {
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

function mapSignatureAuditEntry(entry: SignatureAuditEntryRecord): OfficeSignatureAuditEntry {
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

function mapSignatureRequest(request: {
  id: string;
  transactionId: string;
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

function mapTransactionDocument(record: TransactionDocumentRecord): OfficeTransactionDocument {
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

function mapTransactionForm(record: TransactionFormRecord): OfficeTransactionForm {
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

function isRecipientTerminalStatus(status: SignatureRecipientStatus) {
  return (
    status === SignatureRecipientStatus.acted ||
    status === SignatureRecipientStatus.declined ||
    status === SignatureRecipientStatus.voided ||
    status === SignatureRecipientStatus.expired
  );
}

function getActiveRoutingStepRecipients<
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

function deriveEnvelopeStatusFromRecipients(
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

function mapIncomingUpdate(record: IncomingUpdateRecord): OfficeIncomingUpdate {
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

async function getTransactionMergeContext(organizationId: string, transactionId: string): Promise<MergeContextTransaction | null> {
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

async function getOfferMergeContext(
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

async function getValidatedOfferLink(
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

function buildTransactionFormPayload(transaction: MergeContextTransaction, offer: MergeContextOffer | null) {
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

async function syncFormAndDocumentSignatureState(
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

async function reconcileLinkedWorkflowTasks(
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

function buildDocumentObjectLabel(documentTitle: string, transaction: { title: string; address: string; city: string; state: string }) {
  return `${documentTitle} · ${buildTransactionObjectLabel(transaction)}`;
}

function buildFormObjectLabel(formName: string, transaction: { title: string; address: string; city: string; state: string }) {
  return `${formName} · ${buildTransactionObjectLabel(transaction)}`;
}

function buildIncomingUpdateObjectLabel(summary: string, sourceSystem: string) {
  return `${summary} · ${sourceSystem}`;
}

function buildChanges(
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

function clampRelativeMetric(value: number, minimum = 0, maximum = 1) {
  if (Number.isNaN(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

async function recordSignatureAuditEntry(
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

async function getSignatureRequestRecord(organizationId: string, transactionId: string, signatureRequestId: string) {
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

function hashSignatureToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

async function getPublicSignatureRequestRecord(token: string) {
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

function buildLegacyPublicRecipient(request: OfficeSignatureRequest): OfficeSignatureRecipient {
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

export async function getPublicSignatureRequestSnapshot(token: string): Promise<PublicSignatureRequestSnapshot | null> {
  let access = await getPublicSignatureRequestRecord(token);
  let request = access?.request ?? null;

  if (!request?.document) {
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
    }
  }

  if (!request?.document) {
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
      id: request.document.id,
      title: request.document.title,
      fileName: request.document.fileName,
      mimeType: request.document.mimeType
    }
  };
}

export async function getPublicSignatureDocumentStorageRecord(token: string) {
  const access = await getPublicSignatureRequestRecord(token);
  const request = access?.request ?? null;

  if (!request?.document) {
    return null;
  }

  return {
    signatureRequestId: request.id,
    currentRecipientId: access?.currentRecipientId ?? null,
    organizationId: request.organizationId,
    officeId: request.officeId,
    transactionId: request.transactionId,
    documentId: request.document.id,
    title: request.document.title,
    fileName: request.document.fileName,
    mimeType: request.document.mimeType,
    storageKey: request.document.storageKey,
    documentType: request.document.documentType,
    linkedTaskId: request.document.linkedTaskId,
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

function normalizeSignatureRecipients(input: CreateSignatureRequestInput) {
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

function buildIncomingTransactionChanges(payload: Record<string, string>) {
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
