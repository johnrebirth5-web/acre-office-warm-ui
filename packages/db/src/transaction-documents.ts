import {
  IncomingUpdateStatus,
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  SignatureRequestStatus,
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
  formId: string | null;
  documentId: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  signingOrder: number | null;
  statusKey: SignatureRequestStatus;
  status: string;
  sentAt: string;
  viewedAt: string;
  completedAt: string;
  declinedAt: string;
  createdAt: string;
  updatedAt: string;
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
  formId?: string | null;
  documentId?: string | null;
  offerId?: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  signingOrder?: number | null;
};

export type UpdateSignatureRequestInput = {
  organizationId: string;
  transactionId: string;
  signatureRequestId: string;
  actorMembershipId?: string;
  action: "send" | "viewed" | "signed" | "declined" | "canceled";
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
      orderBy: {
        createdAt: "asc";
      };
    };
  };
}>;

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
  email_pdf: "Email PDF"
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
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
  canceled: "Canceled"
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

function buildDocumentHref(transactionId: string, documentId: string) {
  return `/api/office/transactions/${transactionId}/documents/${documentId}/file`;
}

function buildTaskHref(transactionId: string, taskId: string | null | undefined) {
  return taskId ? `/office/transactions/${transactionId}#transaction-task-${taskId}` : "";
}

function mapSignatureRequest(request: {
  id: string;
  formId: string | null;
  documentId: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  signingOrder: number | null;
  status: SignatureRequestStatus;
  sentAt: Date | null;
  viewedAt: Date | null;
  completedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OfficeSignatureRequest {
  return {
    id: request.id,
    formId: request.formId,
    documentId: request.documentId,
    recipientName: request.recipientName,
    recipientEmail: request.recipientEmail,
    recipientRole: request.recipientRole,
    signingOrder: request.signingOrder,
    statusKey: request.status,
    status: signatureStatusLabelMap[request.status],
    sentAt: formatDateTimeValue(request.sentAt),
    viewedAt: formatDateTimeValue(request.viewedAt),
    completedAt: formatDateTimeValue(request.completedAt),
    declinedAt: formatDateTimeValue(request.declinedAt),
    createdAt: formatDateTimeValue(request.createdAt),
    updatedAt: formatDateTimeValue(request.updatedAt)
  };
}

function mapTransactionDocument(record: TransactionDocumentRecord): OfficeTransactionDocument {
  const latestSignature = record.signatureRequests[0] ?? null;
  const hasPendingSignature = record.signatureRequests.some((request) =>
    request.status === SignatureRequestStatus.draft ||
    request.status === SignatureRequestStatus.sent ||
    request.status === SignatureRequestStatus.viewed
  );

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
    latestSignatureStatus: latestSignature ? signatureStatusLabelMap[latestSignature.status] : "",
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

  if (signatureRequests.some((request) => request.status === SignatureRequestStatus.declined)) {
    nextFormStatus = TransactionFormStatus.rejected;
    nextDocumentStatus = TransactionDocumentStatus.rejected;
  } else if (
    signatureRequests.length > 0 &&
    signatureRequests.every((request) => request.status === SignatureRequestStatus.signed)
  ) {
    nextFormStatus = TransactionFormStatus.fully_signed;
    nextDocumentStatus = TransactionDocumentStatus.signed;
    nextDocumentSigned = true;
    nextDocumentSignedAt = signatureRequests.reduce<Date | null>((latest, request) => {
      if (!request.completedAt) {
        return latest;
      }

      if (!latest || request.completedAt > latest) {
        return request.completedAt;
      }

      return latest;
    }, null);
  } else if (signatureRequests.some((request) => request.status === SignatureRequestStatus.signed)) {
    nextFormStatus = TransactionFormStatus.partially_signed;
    nextDocumentStatus = TransactionDocumentStatus.submitted;
  } else if (
    signatureRequests.some((request) =>
      request.status === SignatureRequestStatus.sent || request.status === SignatureRequestStatus.viewed
    )
  ) {
    nextFormStatus = TransactionFormStatus.sent_for_signature;
    nextDocumentStatus = TransactionDocumentStatus.submitted;
  } else if (signatureRequests.every((request) => request.status === SignatureRequestStatus.canceled)) {
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

export async function listTransactionDocumentsSnapshot(
  organizationId: string,
  transactionId: string
): Promise<OfficeTransactionDocumentsSnapshot> {
  const [documents, forms, incomingUpdates, formTemplates] = await Promise.all([
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
          orderBy: [{ createdAt: "asc" }]
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
        isUnsorted: input.isUnsorted ?? false
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

export async function createSignatureRequest(input: CreateSignatureRequestInput): Promise<OfficeSignatureRequest | null> {
  const signatureRequestId = await prisma.$transaction(async (tx) => {
    const [transaction, form, document, linkedOffer] = await Promise.all([
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
    ]);

    if (!transaction || (!form && !document)) {
      return null;
    }

    const effectiveOfferId = linkedOffer?.id ?? form?.offerId ?? document?.offerId ?? null;
    if (input.offerId && !effectiveOfferId) {
      return null;
    }

    const created = await tx.signatureRequest.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: input.transactionId,
        offerId: effectiveOfferId,
        formId: form?.id ?? null,
        documentId: document?.id ?? form?.documentId ?? null,
        requestedByMembershipId: input.actorMembershipId,
        recipientName: input.recipientName.trim(),
        recipientEmail: input.recipientEmail.trim(),
        recipientRole: input.recipientRole.trim(),
        signingOrder: input.signingOrder ?? null,
        status: SignatureRequestStatus.draft
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
        }
      }
    });

    if (!existing) {
      return null;
    }

    const now = new Date();
    const nextStatus =
      input.action === "send"
        ? SignatureRequestStatus.sent
        : input.action === "viewed"
          ? SignatureRequestStatus.viewed
          : input.action === "signed"
            ? SignatureRequestStatus.signed
            : input.action === "declined"
              ? SignatureRequestStatus.declined
              : SignatureRequestStatus.canceled;

    const saved = await tx.signatureRequest.update({
      where: {
        id: existing.id
      },
      data: {
        status: nextStatus,
        sentAt: input.action === "send" ? now : existing.sentAt,
        viewedAt: input.action === "viewed" ? now : existing.viewedAt,
        completedAt: input.action === "signed" ? now : existing.completedAt,
        declinedAt: input.action === "declined" ? now : existing.declinedAt
      }
    });

    await syncFormAndDocumentSignatureState(tx, {
      formId: existing.formId,
      documentId: existing.documentId
    });

    const action =
      input.action === "send"
        ? activityLogActions.signatureRequestSent
        : input.action === "signed"
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
        changes: buildChanges(signatureStatusLabelMap[existing.status], signatureStatusLabelMap[saved.status], "Signature status"),
        contextHref: `/office/transactions/${input.transactionId}#transaction-forms-signatures`
      }
    });

    if (input.action === "send" || input.action === "signed") {
      const notificationType =
        input.action === "send" ? NotificationType.signature_pending : NotificationType.signature_completed;
      const notificationTitle =
        input.action === "send"
          ? `Signature pending: ${existing.document?.title ?? existing.form?.name ?? existing.transaction.title}`
          : `Signature completed: ${existing.document?.title ?? existing.form?.name ?? existing.transaction.title}`;
      const notificationBody =
        input.action === "send"
          ? `${saved.recipientName} still needs to complete this signature request.`
          : `${saved.recipientName} completed this signature request.`;

      await createNotificationsForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: existing.transaction.officeId,
        membershipIds: [existing.transaction.ownerMembershipId ?? "", existing.requestedByMembershipId],
        restrictToOfficeRoles: true,
        type: notificationType,
        category: NotificationCategory.signature,
        severity: input.action === "send" ? NotificationSeverity.warning : NotificationSeverity.info,
        entityType: NotificationEntityType.signature_request,
        entityId: saved.id,
        title: notificationTitle,
        body: notificationBody,
        actionUrl: `/office/transactions/${input.transactionId}#transaction-forms-signatures`
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
