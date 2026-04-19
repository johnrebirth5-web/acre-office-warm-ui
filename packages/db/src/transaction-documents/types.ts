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

import { buildChanges, buildDocumentHref, buildDocumentObjectLabel, buildFormObjectLabel, buildIncomingUpdateObjectLabel, buildLegacyPublicRecipient, buildOfferObjectLabel, buildSignatureRequestEditorHref, buildTaskHref, buildTransactionFormPayload, buildTransactionObjectLabel, clampRelativeMetric, collectSubmittedFieldValues, deriveEnvelopeStatusFromRecipients, formatCurrency, formatDateTimeValue, formatDateValue, formatMembershipName, getActiveRoutingStepRecipients, getOfferMergeContext, getPublicSignatureDocumentStorageRecord, getPublicSignatureRequestRecord, getPublicSignatureRequestSnapshot, getSignatureEditorSnapshot, getSignatureRequestRecord, getTransactionDocumentStorageRecord, getTransactionMergeContext, getValidatedOfferLink, hashSignatureToken, isRecipientTerminalStatus, listTransactionDocumentsSnapshot, mapIncomingUpdate, mapSignatureArtifact, mapSignatureAuditEntry, mapSignatureField, mapSignatureRecipient, mapSignatureRequest, mapTransactionDocument, mapTransactionForm, normalizeJsonRecord, normalizeSubmittedFieldValues, parseOptionalDate, reconcileLinkedWorkflowTasks, recordSignatureAuditEntry, replaceSignatureRequestFields, resolveSignatureStatus, syncFormAndDocumentSignatureState, toInputJsonValue } from "./readers";
import { createTransactionDocument, createTransactionForm, deleteTransactionDocument, listTransactionFormTemplates, prepareTransactionFormDraft, recordTransactionDocumentOpened, updateTransactionDocument, updateTransactionForm } from "./documents";
import { createSignatureRequest, normalizeSignatureRecipients, updateSignatureRequest } from "./signatures";
import { buildIncomingTransactionChanges, createIncomingUpdate, reviewIncomingUpdate } from "./incoming-updates";

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



export type TransactionDocumentRecord = Prisma.TransactionDocumentGetPayload<{
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



export type TransactionFormRecord = Prisma.TransactionFormGetPayload<{
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



export type SignatureRequestRecord = Prisma.SignatureRequestGetPayload<{
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



export type SignatureAuditEntryRecord = Prisma.SignatureAuditEntryGetPayload<{}>;



export type IncomingUpdateRecord = Prisma.IncomingUpdateGetPayload<{
  include: {
    reviewedByMembership: {
      include: {
        user: true;
      };
    };
  };
}>;



export type MergeContextTransaction = Prisma.TransactionGetPayload<{
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



export type MergeContextOffer = Prisma.OfferGetPayload<{
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



export const documentStatusLabelMap: Record<TransactionDocumentStatus, string> = {
  uploaded: "Uploaded",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  signed: "Signed",
  archived: "Archived"
};



export const documentSourceLabelMap: Record<TransactionDocumentSource, string> = {
  manual_upload: "Manual upload",
  generated_form: "Generated form",
  incoming_update: "Incoming update",
  synced_external: "Synced external",
  email_pdf: "Email PDF",
  signature_output: "Signed output"
};



export const formStatusLabelMap: Record<TransactionFormStatus, string> = {
  draft: "Draft",
  prepared: "Prepared",
  sent_for_signature: "Sent for signature",
  partially_signed: "Partially signed",
  fully_signed: "Fully signed",
  rejected: "Rejected",
  voided: "Voided"
};



export const signatureStatusLabelMap: Record<SignatureRequestStatus, string> = {
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



export const signatureRecipientRoleLabelMap: Record<SignatureRecipientRole, string> = {
  signer: "Signer",
  approver: "Approver",
  cc: "CC"
};



export const signatureRecipientStatusLabelMap: Record<SignatureRecipientStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  sent: "Sent",
  viewed: "Viewed",
  acted: "Signed / Approved",
  declined: "Declined",
  voided: "Void / Cancelled",
  expired: "Expired"
};



export const signatureDriveStatusLabelMap: Record<SignatureDriveSyncStatus, string> = {
  not_configured: "Not configured",
  pending: "Pending",
  synced: "Synced",
  failed: "Failed"
};



export const signatureAuditEventLabelMap: Record<SignatureAuditEventType, string> = {
  request_created: "Request created",
  email_sent: "Email sent",
  link_opened: "Link opened",
  field_updated: "Fields updated",
  signature_submitted: "Signature submitted",
  pdf_finalized: "Signed PDF finalized",
  request_expired: "Request expired",
  request_canceled: "Request canceled"
};



export const incomingUpdateStatusLabelMap: Record<IncomingUpdateStatus, string> = {
  pending_review: "Pending review",
  accepted: "Accepted",
  rejected: "Rejected",
  applied: "Applied"
};



export const transactionTypeLabelMap: Record<TransactionType, string> = {
  sales: "Sales",
  sales_listing: "Sales (listing)",
  rental_leasing: "Rental/Leasing",
  rental_listing: "Rental (listing)",
  commercial_sales: "Commercial Sales",
  commercial_lease: "Commercial Lease",
  other: "Other"
};



export const transactionStatusLabelMap: Record<TransactionStatus, string> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};



export const transactionRepresentingLabelMap: Record<TransactionRepresenting, string> = {
  buyer: "Buyer",
  seller: "Seller",
  both: "Both",
  tenant: "Tenant",
  landlord: "Landlord"
};
