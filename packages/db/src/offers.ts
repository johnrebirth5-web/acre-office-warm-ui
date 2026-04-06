import {
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  OfferStatus,
  Prisma,
  SignatureRequestStatus,
  TransactionStatus
} from "@prisma/client";
import { buildTransactionVisibilityWhere, resolveOfficeDataScope } from "./access";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { createNotificationsForMemberships } from "./notifications";

export type OfficeOfferCommentRecord = {
  id: string;
  membershipId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type OfficeOfferLinkedDocumentRecord = {
  id: string;
  title: string;
  documentType: string;
  status: string;
  statusValue: string;
  href: string;
  isSigned: boolean;
  updatedAt: string;
};

export type OfficeOfferLinkedFormRecord = {
  id: string;
  name: string;
  status: string;
  statusValue: string;
  href: string;
  documentId: string | null;
  signatureStatusSummary: string;
  signaturePendingCount: number;
  updatedAt: string;
};

export type OfficeOfferLinkedSignatureRecord = {
  id: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  status: string;
  statusValue: string;
  href: string;
  sentAt: string;
  completedAt: string;
  declinedAt: string;
};

export type OfficeOfferComparisonRow = {
  id: string;
  title: string;
  offeringPartyName: string;
  buyerName: string;
  status: string;
  statusValue: OfferStatus;
  price: string;
  earnestMoneyAmount: string;
  financingType: string;
  closingDateOffered: string;
  expirationAt: string;
  documentReadiness: string;
  signatureReadiness: string;
  isPrimaryOffer: boolean;
};

export type OfficeOfferRecord = {
  id: string;
  title: string;
  offeringPartyName: string;
  buyerName: string;
  status: string;
  statusValue: OfferStatus;
  price: string;
  earnestMoneyAmount: string;
  financingType: string;
  closingDateOffered: string;
  expirationAt: string;
  isPrimaryOffer: boolean;
  notes: string;
  additionalFields: Record<string, string>;
  submittedAt: string;
  acceptedAt: string;
  rejectedAt: string;
  withdrawnAt: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  documents: OfficeOfferLinkedDocumentRecord[];
  forms: OfficeOfferLinkedFormRecord[];
  signatureRequests: OfficeOfferLinkedSignatureRecord[];
  comments: OfficeOfferCommentRecord[];
  comparison: OfficeOfferComparisonRow;
};

export type OfficeTransactionOffersSnapshot = {
  offers: OfficeOfferRecord[];
  acceptedOfferId: string;
  acceptedOfferLabel: string;
  expiringSoonCount: number;
};

export type OfficeOffersQueueStatusFilter = "all" | OfferStatus;
export type OfficeOffersQueueTimingFilter = "all" | "expiring_soon";
export type OfficeOffersQueueContextFilter = "all" | "primary" | "accepted";

export type OfficeOfferQueueRow = {
  id: string;
  transactionId: string;
  transactionHref: string;
  offerHref: string;
  transactionTitle: string;
  transactionAddress: string;
  transactionStatus: string;
  ownerName: string;
  title: string;
  offeringPartyName: string;
  buyerName: string;
  status: string;
  statusValue: OfferStatus;
  price: string;
  earnestMoneyAmount: string;
  financingType: string;
  closingDateOffered: string;
  expirationAt: string;
  expirationLabel: string;
  isExpiringSoon: boolean;
  isPrimaryOffer: boolean;
  isAcceptedOffer: boolean;
  acceptedAt: string;
  acceptedAtLabel: string;
  transactionAcceptedOfferId: string;
  transactionAcceptedOfferLabel: string;
  transactionPrimaryOfferId: string;
  transactionPrimaryOfferLabel: string;
  updatedAt: string;
  updatedAtLabel: string;
  createdAt: string;
  createdAtLabel: string;
};

export type OfficeOffersQueueSummary = {
  totalCount: number;
  expiringSoonCount: number;
  primaryCount: number;
  acceptedCount: number;
};

export type OfficeOffersQueueFilters = {
  q: string;
  status: OfficeOffersQueueStatusFilter;
  timing: OfficeOffersQueueTimingFilter;
  context: OfficeOffersQueueContextFilter;
};

export type OfficeOffersQueueSnapshot = {
  filters: OfficeOffersQueueFilters;
  summary: OfficeOffersQueueSummary;
  rows: OfficeOfferQueueRow[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type ListOfficeOffersQueueInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  q?: string;
  status?: string;
  timing?: string;
  context?: string;
  page?: number;
  pageSize?: number;
};

export type CreateOfferInput = {
  organizationId: string;
  officeId?: string | null;
  transactionId: string;
  actorMembershipId: string;
  title: string;
  offeringPartyName: string;
  buyerName?: string;
  price?: string;
  earnestMoneyAmount?: string;
  financingType?: string;
  closingDateOffered?: string;
  expirationAt?: string;
  notes?: string;
  additionalFields?: Record<string, string>;
};

export type UpdateOfferInput = {
  organizationId: string;
  transactionId: string;
  offerId: string;
  actorMembershipId: string;
  title?: string;
  offeringPartyName?: string;
  buyerName?: string;
  price?: string;
  earnestMoneyAmount?: string;
  financingType?: string;
  closingDateOffered?: string;
  expirationAt?: string;
  isPrimaryOffer?: boolean;
  notes?: string;
  additionalFields?: Record<string, string>;
};

export type TransitionOfferAction =
  | "submit"
  | "receive"
  | "review"
  | "counter"
  | "accept"
  | "reject"
  | "withdraw"
  | "expire";

export type TransitionOfferStatusInput = {
  organizationId: string;
  transactionId: string;
  offerId: string;
  actorMembershipId: string;
  action: TransitionOfferAction;
};

export type CreateOfferCommentInput = {
  organizationId: string;
  officeId?: string | null;
  transactionId: string;
  offerId: string;
  actorMembershipId: string;
  body: string;
};

type OfferRecord = Prisma.OfferGetPayload<{
  include: {
    transaction: {
      select: {
        id: true;
        officeId: true;
        title: true;
        address: true;
        city: true;
        state: true;
        purchasedPrice: true;
        price: true;
        closingDate: true;
        acceptanceDate: true;
      };
    };
    createdByMembership: {
      include: {
        user: true;
      };
    };
    documents: {
      orderBy: {
        createdAt: "desc";
      };
    };
    forms: {
      include: {
        document: {
          select: {
            id: true;
            title: true;
          };
        };
        signatureRequests: {
          orderBy: {
            createdAt: "asc";
          };
        };
      };
      orderBy: {
        createdAt: "desc";
      };
    };
    signatureRequests: {
      orderBy: {
        createdAt: "desc";
      };
    };
    comments: {
      include: {
        membership: {
          include: {
            user: true;
          };
        };
      };
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

const offerStatusLabelMap: Record<OfferStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  received: "Received",
  under_review: "Under review",
  countered: "Countered",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired"
};

const signatureStatusLabelMap: Record<SignatureRequestStatus, string> = {
  draft: "Draft",
  pending_send: "Pending send",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  completed: "Completed",
  declined: "Declined",
  canceled: "Canceled",
  voided: "Void / Cancelled",
  expired: "Expired"
};

const transactionStatusLabelMap: Record<TransactionStatus, string> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

const offerTransitionMap: Record<OfferStatus, TransitionOfferAction[]> = {
  draft: ["submit", "receive", "withdraw"],
  submitted: ["receive", "counter", "reject", "withdraw", "expire"],
  received: ["review", "counter", "accept", "reject", "withdraw", "expire"],
  under_review: ["counter", "accept", "reject", "withdraw", "expire"],
  countered: ["submit", "receive", "accept", "reject", "withdraw", "expire"],
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: []
};

const terminalOfferStatuses: OfferStatus[] = ["accepted", "rejected", "withdrawn", "expired"];

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function formatDateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDateLabel(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTimeValue(date: Date | null) {
  return date ? date.toISOString() : "";
}

function parseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDate(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalDecimal(value: string | undefined) {
  const trimmed = value?.replaceAll(",", "").replace(/\$/g, "").trim();

  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
}

function getTransactionPurchasedPrice(transaction: { purchasedPrice: Prisma.Decimal | null; price: Prisma.Decimal | null }) {
  return transaction.purchasedPrice ?? transaction.price;
}

function buildTransactionObjectLabel(transaction: {
  title: string;
  address: string;
  city: string;
  state: string;
}) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}

function buildOfferObjectLabel(offer: {
  title: string;
  offeringPartyName: string;
  buyerName: string | null;
}, transaction: {
  title: string;
  address: string;
  city: string;
  state: string;
}) {
  const party = offer.buyerName?.trim() || offer.offeringPartyName;
  return `${offer.title} · ${party} · ${buildTransactionObjectLabel(transaction)}`;
}

function buildOfferHref(transactionId: string, offerId: string) {
  return `/office/transactions/${transactionId}#offer-${offerId}`;
}

function buildTransactionHref(transactionId: string) {
  return `/office/transactions/${transactionId}`;
}

function buildOfferChange(label: string, previousValue: string | null | undefined, nextValue: string | null | undefined) {
  const previousText = previousValue?.trim() || "—";
  const nextText = nextValue?.trim() || "—";

  if (previousText === nextText) {
    return null;
  }

  return {
    label,
    previousValue: previousText,
    nextValue: nextText
  };
}

function getSignaturePendingCount(statuses: SignatureRequestStatus[]) {
  return statuses.filter((status) => status === "draft" || status === "sent" || status === "viewed").length;
}

function buildOfferExpiringSoonWhere(now: Date): Prisma.OfferWhereInput {
  return {
    expirationAt: {
      gte: now,
      lte: new Date(now.getTime() + 72 * 60 * 60 * 1000)
    },
    status: {
      notIn: terminalOfferStatuses
    }
  };
}

function isOfferExpiringSoon(
  offer: {
    expirationAt: Date | null;
    status: OfferStatus;
  },
  now: Date
) {
  if (!offer.expirationAt || terminalOfferStatuses.includes(offer.status)) {
    return false;
  }

  const diff = offer.expirationAt.getTime() - now.getTime();
  return diff >= 0 && diff <= 72 * 60 * 60 * 1000;
}

function parseOfferQueueStatusFilter(value: string | undefined): OfficeOffersQueueStatusFilter {
  const trimmed = value?.trim();

  if (trimmed && trimmed in offerStatusLabelMap) {
    return trimmed as OfferStatus;
  }

  return "all";
}

function parseOfferQueueTimingFilter(value: string | undefined): OfficeOffersQueueTimingFilter {
  return value === "expiring_soon" ? "expiring_soon" : "all";
}

function parseOfferQueueContextFilter(value: string | undefined): OfficeOffersQueueContextFilter {
  return value === "primary" || value === "accepted" ? value : "all";
}

function getOfferSignatureReadiness(offer: OfferRecord) {
  const allStatuses = [
    ...offer.signatureRequests.map((request) => request.status),
    ...offer.forms.flatMap((form) => form.signatureRequests.map((request) => request.status))
  ];
  const pendingCount = getSignaturePendingCount(allStatuses);

  if (pendingCount > 0) {
    return `${pendingCount} pending`;
  }

  const signedCount = allStatuses.filter((status) => status === "signed").length;
  if (signedCount > 0) {
    return `${signedCount} signed`;
  }

  return "No signature requests";
}

function mapOfferRecord(record: OfferRecord): OfficeOfferRecord {
  const comparison = {
    id: record.id,
    title: record.title,
    offeringPartyName: record.offeringPartyName,
    buyerName: record.buyerName ?? "",
    status: offerStatusLabelMap[record.status],
    statusValue: record.status,
    price: formatCurrency(record.price),
    earnestMoneyAmount: formatCurrency(record.earnestMoneyAmount),
    financingType: record.financingType ?? "",
    closingDateOffered: formatDateValue(record.closingDateOffered),
    expirationAt: formatDateValue(record.expirationAt),
    documentReadiness:
      record.documents.length > 0
        ? `${record.documents.length} document${record.documents.length === 1 ? "" : "s"}`
        : "No linked documents",
    signatureReadiness: getOfferSignatureReadiness(record),
    isPrimaryOffer: record.isPrimaryOffer
  } satisfies OfficeOfferComparisonRow;

  return {
    id: record.id,
    title: record.title,
    offeringPartyName: record.offeringPartyName,
    buyerName: record.buyerName ?? "",
    status: offerStatusLabelMap[record.status],
    statusValue: record.status,
    price: formatCurrency(record.price),
    earnestMoneyAmount: formatCurrency(record.earnestMoneyAmount),
    financingType: record.financingType ?? "",
    closingDateOffered: formatDateValue(record.closingDateOffered),
    expirationAt: formatDateValue(record.expirationAt),
    isPrimaryOffer: record.isPrimaryOffer,
    notes: record.notes ?? "",
    additionalFields:
      record.additionalFields && typeof record.additionalFields === "object" && !Array.isArray(record.additionalFields)
        ? Object.fromEntries(
            Object.entries(record.additionalFields as Record<string, Prisma.JsonValue>).map(([key, value]) => [key, String(value ?? "")])
          )
        : {},
    submittedAt: formatDateTimeValue(record.submittedAt),
    acceptedAt: formatDateTimeValue(record.acceptedAt),
    rejectedAt: formatDateTimeValue(record.rejectedAt),
    withdrawnAt: formatDateTimeValue(record.withdrawnAt),
    createdAt: formatDateTimeValue(record.createdAt),
    updatedAt: formatDateTimeValue(record.updatedAt),
    createdByName: `${record.createdByMembership.user.firstName} ${record.createdByMembership.user.lastName}`,
    documents: record.documents.map((document) => ({
      id: document.id,
      title: document.title,
      documentType: document.documentType,
      status: document.status.replaceAll("_", " ").replace(/\b\w/g, (segment) => segment.toUpperCase()),
      statusValue: document.status,
      href: `/api/office/transactions/${record.transactionId}/documents/${document.id}/file`,
      isSigned: document.isSigned,
      updatedAt: formatDateTimeValue(document.updatedAt)
    })),
    forms: record.forms.map((form) => {
      const pendingCount = getSignaturePendingCount(form.signatureRequests.map((request) => request.status));
      const signedCount = form.signatureRequests.filter((request) => request.status === "signed").length;

      return {
        id: form.id,
        name: form.name,
        status: form.status.replaceAll("_", " ").replace(/\b\w/g, (segment) => segment.toUpperCase()),
        statusValue: form.status,
        href: buildOfferHref(record.transactionId, record.id),
        documentId: form.documentId,
        signatureStatusSummary:
          pendingCount > 0
            ? `${pendingCount} pending`
            : signedCount > 0
              ? `${signedCount} signed`
              : "No signature requests",
        signaturePendingCount: pendingCount,
        updatedAt: formatDateTimeValue(form.updatedAt)
      };
    }),
    signatureRequests: record.signatureRequests.map((request) => ({
      id: request.id,
      recipientName: request.recipientName,
      recipientEmail: request.recipientEmail,
      recipientRole: request.recipientRole,
      status: signatureStatusLabelMap[request.status],
      statusValue: request.status,
      href: buildOfferHref(record.transactionId, record.id),
      sentAt: formatDateTimeValue(request.sentAt),
      completedAt: formatDateTimeValue(request.completedAt),
      declinedAt: formatDateTimeValue(request.declinedAt)
    })),
    comments: record.comments.map((comment) => ({
      id: comment.id,
      membershipId: comment.membershipId,
      authorName: `${comment.membership.user.firstName} ${comment.membership.user.lastName}`,
      body: comment.body,
      createdAt: formatDateTimeValue(comment.createdAt)
    })),
    comparison
  };
}

type OfferQueueRecord = Prisma.OfferGetPayload<{
  include: {
    transaction: {
      select: {
        id: true;
        title: true;
        address: true;
        city: true;
        state: true;
        status: true;
        acceptanceDate: true;
        ownerMembership: {
          select: {
            user: {
              select: {
                firstName: true;
                lastName: true;
              };
            };
          };
        };
        offers: {
          where: {
            OR: [{ status: "accepted" }, { isPrimaryOffer: true }];
          };
          select: {
            id: true;
            title: true;
            offeringPartyName: true;
            status: true;
            isPrimaryOffer: true;
          };
        };
      };
    };
  };
}>;

function mapOfferQueueRow(record: OfferQueueRecord, now: Date): OfficeOfferQueueRow {
  const acceptedTransactionOffer =
    record.transaction.offers.find((offer) => offer.status === OfferStatus.accepted) ?? null;
  const primaryTransactionOffer =
    record.transaction.offers.find((offer) => offer.isPrimaryOffer) ?? acceptedTransactionOffer;
  const ownerName = record.transaction.ownerMembership
    ? `${record.transaction.ownerMembership.user.firstName} ${record.transaction.ownerMembership.user.lastName}`.trim()
    : "";
  const transactionAddress = [record.transaction.address, record.transaction.city, record.transaction.state]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(", ");

  return {
    id: record.id,
    transactionId: record.transactionId,
    transactionHref: buildTransactionHref(record.transactionId),
    offerHref: buildOfferHref(record.transactionId, record.id),
    transactionTitle: record.transaction.title,
    transactionAddress,
    transactionStatus: transactionStatusLabelMap[record.transaction.status],
    ownerName,
    title: record.title,
    offeringPartyName: record.offeringPartyName,
    buyerName: record.buyerName ?? "",
    status: offerStatusLabelMap[record.status],
    statusValue: record.status,
    price: formatCurrency(record.price),
    earnestMoneyAmount: formatCurrency(record.earnestMoneyAmount),
    financingType: record.financingType ?? "",
    closingDateOffered: formatDateValue(record.closingDateOffered),
    expirationAt: formatDateValue(record.expirationAt),
    expirationLabel: record.expirationAt ? formatDateLabel(record.expirationAt) : "",
    isExpiringSoon: isOfferExpiringSoon(record, now),
    isPrimaryOffer: record.isPrimaryOffer,
    isAcceptedOffer: record.status === OfferStatus.accepted,
    acceptedAt: formatDateTimeValue(record.acceptedAt),
    acceptedAtLabel: formatDateLabel(record.acceptedAt),
    transactionAcceptedOfferId: acceptedTransactionOffer?.id ?? "",
    transactionAcceptedOfferLabel: acceptedTransactionOffer
      ? `${acceptedTransactionOffer.title} · ${acceptedTransactionOffer.offeringPartyName}`
      : "",
    transactionPrimaryOfferId: primaryTransactionOffer?.id ?? "",
    transactionPrimaryOfferLabel: primaryTransactionOffer
      ? `${primaryTransactionOffer.title} · ${primaryTransactionOffer.offeringPartyName}`
      : "",
    updatedAt: formatDateTimeValue(record.updatedAt),
    updatedAtLabel: formatDateLabel(record.updatedAt),
    createdAt: formatDateTimeValue(record.createdAt),
    createdAtLabel: formatDateLabel(record.createdAt)
  };
}

function buildOfferQueueWhere(
  input: ListOfficeOffersQueueInput,
  filters: OfficeOffersQueueFilters,
  now: Date,
  scope: Awaited<ReturnType<typeof resolveOfficeDataScope>>
): Prisma.OfferWhereInput {
  const whereConditions: Prisma.OfferWhereInput[] = [
    {
      organizationId: input.organizationId
    },
    {
      transaction: buildTransactionVisibilityWhere(scope)
    }
  ];

  if (input.officeId) {
    whereConditions.push({
      transaction: {
        officeId: input.officeId
      }
    });
  }

  if (filters.q) {
    whereConditions.push({
      OR: [
        {
          title: {
            contains: filters.q,
            mode: "insensitive"
          }
        },
        {
          offeringPartyName: {
            contains: filters.q,
            mode: "insensitive"
          }
        },
        {
          buyerName: {
            contains: filters.q,
            mode: "insensitive"
          }
        },
        {
          transaction: {
            OR: [
              {
                title: {
                  contains: filters.q,
                  mode: "insensitive"
                }
              },
              {
                address: {
                  contains: filters.q,
                  mode: "insensitive"
                }
              },
              {
                city: {
                  contains: filters.q,
                  mode: "insensitive"
                }
              },
              {
                state: {
                  contains: filters.q,
                  mode: "insensitive"
                }
              }
            ]
          }
        }
      ]
    });
  }

  if (filters.status !== "all") {
    whereConditions.push({
      status: filters.status
    });
  }

  if (filters.timing === "expiring_soon") {
    whereConditions.push(buildOfferExpiringSoonWhere(now));
  }

  if (filters.context === "primary") {
    whereConditions.push({
      isPrimaryOffer: true
    });
  }

  if (filters.context === "accepted") {
    whereConditions.push({
      status: OfferStatus.accepted
    });
  }

  return {
    AND: whereConditions
  };
}

async function getOfferRecord(organizationId: string, transactionId: string, offerId: string) {
  return prisma.offer.findFirst({
    where: {
      id: offerId,
      organizationId,
      transactionId
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
          purchasedPrice: true,
          price: true,
          closingDate: true,
          acceptanceDate: true
        }
      },
      createdByMembership: {
        include: {
          user: true
        }
      },
      documents: {
        orderBy: [{ createdAt: "desc" }]
      },
      forms: {
        include: {
          document: {
            select: {
              id: true,
              title: true
            }
          },
          signatureRequests: {
            orderBy: [{ createdAt: "asc" }]
          }
        },
        orderBy: [{ createdAt: "desc" }]
      },
      signatureRequests: {
        orderBy: [{ createdAt: "desc" }]
      },
      comments: {
        include: {
          membership: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }]
      }
    }
  });
}

function getOfferEventAction(action: TransitionOfferAction) {
  switch (action) {
    case "submit":
      return activityLogActions.offerSubmitted;
    case "receive":
      return activityLogActions.offerReceived;
    case "counter":
      return activityLogActions.offerCountered;
    case "accept":
      return activityLogActions.offerAccepted;
    case "reject":
      return activityLogActions.offerRejected;
    case "withdraw":
      return activityLogActions.offerWithdrawn;
    case "review":
    case "expire":
    default:
      return activityLogActions.offerUpdated;
  }
}

export async function listTransactionOffersSnapshot(
  organizationId: string,
  transactionId: string
): Promise<OfficeTransactionOffersSnapshot> {
  const offers = await prisma.offer.findMany({
    where: {
      organizationId,
      transactionId
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
          purchasedPrice: true,
          price: true,
          closingDate: true,
          acceptanceDate: true
        }
      },
      createdByMembership: {
        include: {
          user: true
        }
      },
      documents: {
        orderBy: [{ createdAt: "desc" }]
      },
      forms: {
        include: {
          document: {
            select: {
              id: true,
              title: true
            }
          },
          signatureRequests: {
            orderBy: [{ createdAt: "asc" }]
          }
        },
        orderBy: [{ createdAt: "desc" }]
      },
      signatureRequests: {
        orderBy: [{ createdAt: "desc" }]
      },
      comments: {
        include: {
          membership: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }]
      }
    },
    orderBy: [{ isPrimaryOffer: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }]
  });

  const mappedOffers = offers.map(mapOfferRecord);
  const acceptedOffer = mappedOffers.find((offer) => offer.statusValue === "accepted") ?? mappedOffers.find((offer) => offer.isPrimaryOffer) ?? null;
  const now = new Date();
  const expiringSoonCount = offers.filter((offer) => isOfferExpiringSoon(offer, now)).length;

  return {
    offers: mappedOffers,
    acceptedOfferId: acceptedOffer?.id ?? "",
    acceptedOfferLabel: acceptedOffer ? `${acceptedOffer.title} · ${acceptedOffer.offeringPartyName}` : "",
    expiringSoonCount
  };
}

export async function listOfficeOffersQueue(
  input: ListOfficeOffersQueueInput
): Promise<OfficeOffersQueueSnapshot> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
  const now = new Date();
  const filters = {
    q: input.q?.trim() ?? "",
    status: parseOfferQueueStatusFilter(input.status),
    timing: parseOfferQueueTimingFilter(input.timing),
    context: parseOfferQueueContextFilter(input.context)
  } satisfies OfficeOffersQueueFilters;
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null,
    resource: "transactions"
  });
  const where = buildOfferQueueWhere(input, filters, now, scope);
  const expiringSoonWhere = {
    AND: [where, buildOfferExpiringSoonWhere(now)]
  } satisfies Prisma.OfferWhereInput;
  const orderBy =
    filters.timing === "expiring_soon"
      ? [{ expirationAt: "asc" as const }, { isPrimaryOffer: "desc" as const }, { updatedAt: "desc" as const }]
      : [{ isPrimaryOffer: "desc" as const }, { updatedAt: "desc" as const }, { createdAt: "desc" as const }];

  const [totalCount, expiringSoonCount, primaryCount, acceptedCount, offers] = await Promise.all([
    prisma.offer.count({ where }),
    prisma.offer.count({ where: expiringSoonWhere }),
    prisma.offer.count({
      where: {
        AND: [where, { isPrimaryOffer: true }]
      }
    }),
    prisma.offer.count({
      where: {
        AND: [where, { status: OfferStatus.accepted }]
      }
    }),
    prisma.offer.findMany({
      where,
      include: {
        transaction: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            state: true,
            status: true,
            acceptanceDate: true,
            ownerMembership: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            offers: {
              where: {
                OR: [{ status: OfferStatus.accepted }, { isPrimaryOffer: true }]
              },
              select: {
                id: true,
                title: true,
                offeringPartyName: true,
                status: true,
                isPrimaryOffer: true
              }
            }
          }
        }
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    filters,
    summary: {
      totalCount,
      expiringSoonCount,
      primaryCount,
      acceptedCount
    },
    rows: offers.map((offer) => mapOfferQueueRow(offer, now)),
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    page,
    pageSize
  };
}

export async function createOffer(input: CreateOfferInput): Promise<OfficeOfferRecord | null> {
  const offerId = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: {
        id: input.transactionId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        officeId: true,
        ownerMembershipId: true,
        title: true,
        address: true,
        city: true,
        state: true
      }
    });

    if (!transaction) {
      return null;
    }

    const created = await tx.offer.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? transaction.officeId ?? null,
        transactionId: input.transactionId,
        createdByMembershipId: input.actorMembershipId,
        title: input.title.trim(),
        offeringPartyName: input.offeringPartyName.trim(),
        buyerName: parseOptionalText(input.buyerName),
        price: parseOptionalDecimal(input.price),
        earnestMoneyAmount: parseOptionalDecimal(input.earnestMoneyAmount),
        financingType: parseOptionalText(input.financingType),
        closingDateOffered: parseOptionalDate(input.closingDateOffered),
        expirationAt: parseOptionalDate(input.expirationAt),
        additionalFields: input.additionalFields ?? Prisma.JsonNull,
        notes: parseOptionalText(input.notes),
        status: OfferStatus.draft
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "offer",
      entityId: created.id,
      action: activityLogActions.offerCreated,
      payload: {
        officeId: transaction.officeId,
        transactionId: input.transactionId,
        transactionLabel: buildTransactionObjectLabel(transaction),
        objectLabel: buildOfferObjectLabel(created, transaction),
        details: [
          `Status: ${offerStatusLabelMap[created.status]}`,
          ...(created.price ? [`Price: ${formatCurrency(created.price)}`] : []),
          ...(created.expirationAt ? [`Expiration: ${formatDateValue(created.expirationAt)}`] : [])
        ],
        contextHref: buildOfferHref(input.transactionId, created.id)
      }
    });

    await createNotificationsForMemberships(tx, {
      organizationId: input.organizationId,
      officeId: transaction.officeId,
      membershipIds: [transaction.ownerMembershipId ?? ""],
      excludeMembershipIds: [input.actorMembershipId],
      restrictToOfficeRoles: true,
      type: NotificationType.offer_created,
      category: NotificationCategory.offer,
      severity: NotificationSeverity.info,
      entityType: NotificationEntityType.offer,
      entityId: created.id,
      title: `Offer added: ${transaction.title}`,
      body: `${created.title} was added for ${created.offeringPartyName}.`,
      actionUrl: buildOfferHref(input.transactionId, created.id)
    });

    return created.id;
  });

  if (!offerId) {
    return null;
  }

  const offer = await getOfferRecord(input.organizationId, input.transactionId, offerId);
  return offer ? mapOfferRecord(offer) : null;
}

export async function updateOffer(input: UpdateOfferInput): Promise<OfficeOfferRecord | null> {
  const offerId = await prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findFirst({
      where: {
        id: input.offerId,
        organizationId: input.organizationId,
        transactionId: input.transactionId
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
            state: true,
            purchasedPrice: true,
            price: true,
            closingDate: true,
            acceptanceDate: true
          }
        }
      }
    });

    if (!existing) {
      return null;
    }

    const existingAdditionalFields =
      existing.additionalFields &&
      typeof existing.additionalFields === "object" &&
      !Array.isArray(existing.additionalFields)
        ? Object.fromEntries(
            Object.entries(existing.additionalFields as Record<string, Prisma.JsonValue>).map(([key, value]) => [
              key,
              String(value ?? "")
            ])
          )
        : Prisma.JsonNull;

    const nextValues = {
      title: input.title?.trim() || existing.title,
      offeringPartyName: input.offeringPartyName?.trim() || existing.offeringPartyName,
      buyerName: input.buyerName === undefined ? existing.buyerName : parseOptionalText(input.buyerName),
      price: input.price === undefined ? existing.price : parseOptionalDecimal(input.price),
      earnestMoneyAmount:
        input.earnestMoneyAmount === undefined ? existing.earnestMoneyAmount : parseOptionalDecimal(input.earnestMoneyAmount),
      financingType:
        input.financingType === undefined ? existing.financingType : parseOptionalText(input.financingType),
      closingDateOffered:
        input.closingDateOffered === undefined ? existing.closingDateOffered : parseOptionalDate(input.closingDateOffered),
      expirationAt: input.expirationAt === undefined ? existing.expirationAt : parseOptionalDate(input.expirationAt),
      additionalFields:
        input.additionalFields === undefined
          ? existingAdditionalFields
          : input.additionalFields,
      notes: input.notes === undefined ? existing.notes : parseOptionalText(input.notes),
      isPrimaryOffer: input.isPrimaryOffer ?? existing.isPrimaryOffer
    };

    if (nextValues.isPrimaryOffer) {
      await tx.offer.updateMany({
        where: {
          organizationId: input.organizationId,
          transactionId: input.transactionId,
          NOT: {
            id: existing.id
          },
          isPrimaryOffer: true
        },
        data: {
          isPrimaryOffer: false
        }
      });
    }

    const saved = await tx.offer.update({
      where: { id: existing.id },
      data: nextValues
    });

    const changes = [
      buildOfferChange("Title", existing.title, saved.title),
      buildOfferChange("Offer party", existing.offeringPartyName, saved.offeringPartyName),
      buildOfferChange("Buyer name", existing.buyerName, saved.buyerName),
      buildOfferChange("Price", formatCurrency(existing.price), formatCurrency(saved.price)),
      buildOfferChange("Earnest money", formatCurrency(existing.earnestMoneyAmount), formatCurrency(saved.earnestMoneyAmount)),
      buildOfferChange("Financing type", existing.financingType, saved.financingType),
      buildOfferChange("Closing date", formatDateValue(existing.closingDateOffered), formatDateValue(saved.closingDateOffered)),
      buildOfferChange("Expiration", formatDateValue(existing.expirationAt), formatDateValue(saved.expirationAt)),
      buildOfferChange("Primary offer", existing.isPrimaryOffer ? "Yes" : "No", saved.isPrimaryOffer ? "Yes" : "No"),
      buildOfferChange("Notes", existing.notes, saved.notes),
      ...Object.keys(input.additionalFields ?? {}).map((fieldKey) =>
        buildOfferChange(
          fieldKey,
          existing.additionalFields && typeof existing.additionalFields === "object" && !Array.isArray(existing.additionalFields)
            ? String((existing.additionalFields as Record<string, Prisma.JsonValue>)[fieldKey] ?? "")
            : "",
          nextValues.additionalFields && typeof nextValues.additionalFields === "object" && !Array.isArray(nextValues.additionalFields)
            ? String((nextValues.additionalFields as Record<string, Prisma.JsonValue>)[fieldKey] ?? "")
            : ""
        )
      )
    ].filter((change): change is NonNullable<typeof change> => Boolean(change));

    if (changes.length > 0) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "offer",
        entityId: saved.id,
        action: activityLogActions.offerUpdated,
        payload: {
          officeId: existing.transaction.officeId,
          transactionId: input.transactionId,
          transactionLabel: buildTransactionObjectLabel(existing.transaction),
          objectLabel: buildOfferObjectLabel(saved, existing.transaction),
          changes,
          contextHref: buildOfferHref(input.transactionId, saved.id)
        }
      });
    }

    return saved.id;
  });

  if (!offerId) {
    return null;
  }

  const offer = await getOfferRecord(input.organizationId, input.transactionId, offerId);
  return offer ? mapOfferRecord(offer) : null;
}

export async function transitionOfferStatus(input: TransitionOfferStatusInput): Promise<OfficeOfferRecord | null> {
  const offerId = await prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findFirst({
      where: {
        id: input.offerId,
        organizationId: input.organizationId,
        transactionId: input.transactionId
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
            state: true,
            purchasedPrice: true,
            price: true,
            closingDate: true,
            acceptanceDate: true
          }
        }
      }
    });

    if (!existing) {
      return null;
    }

    const allowedActions = offerTransitionMap[existing.status];
    if (!allowedActions.includes(input.action)) {
      throw new Error(`Cannot ${input.action.replaceAll("_", " ")} an offer in ${offerStatusLabelMap[existing.status]} state.`);
    }

    const now = new Date();
    const nextStatus =
      input.action === "submit"
        ? OfferStatus.submitted
        : input.action === "receive"
          ? OfferStatus.received
          : input.action === "review"
            ? OfferStatus.under_review
            : input.action === "counter"
              ? OfferStatus.countered
              : input.action === "accept"
                ? OfferStatus.accepted
                : input.action === "reject"
                  ? OfferStatus.rejected
                  : input.action === "withdraw"
                    ? OfferStatus.withdrawn
                    : OfferStatus.expired;

    if (input.action === "accept") {
      const existingAcceptedOffer = await tx.offer.findFirst({
        where: {
          organizationId: input.organizationId,
          transactionId: input.transactionId,
          status: OfferStatus.accepted,
          NOT: {
            id: existing.id
          }
        },
        select: {
          id: true
        }
      });

      if (existingAcceptedOffer) {
        throw new Error("Another accepted offer already exists for this transaction.");
      }

      await tx.offer.updateMany({
        where: {
          organizationId: input.organizationId,
          transactionId: input.transactionId,
          NOT: {
            id: existing.id
          },
          isPrimaryOffer: true
        },
        data: {
          isPrimaryOffer: false
        }
      });
    }

    const saved = await tx.offer.update({
      where: {
        id: existing.id
      },
      data: {
        status: nextStatus,
        submittedAt:
          input.action === "submit" || input.action === "receive"
            ? existing.submittedAt ?? now
            : existing.submittedAt,
        acceptedAt: input.action === "accept" ? now : existing.acceptedAt,
        rejectedAt: input.action === "reject" ? now : existing.rejectedAt,
        withdrawnAt: input.action === "withdraw" ? now : existing.withdrawnAt,
        isPrimaryOffer: input.action === "accept" ? true : input.action === "reject" || input.action === "withdraw" || input.action === "expire" ? false : existing.isPrimaryOffer
      }
    });

    const offerChanges = [
      buildOfferChange("Status", offerStatusLabelMap[existing.status], offerStatusLabelMap[saved.status]),
      ...(input.action === "accept"
        ? [buildOfferChange("Primary offer", existing.isPrimaryOffer ? "Yes" : "No", "Yes")]
        : [])
    ].filter((change): change is NonNullable<typeof change> => Boolean(change));

    if (input.action === "accept") {
      const nextPurchasedPrice = saved.price ?? getTransactionPurchasedPrice(existing.transaction);
      const transactionChanges = [
        buildOfferChange("Transaction price", formatCurrency(getTransactionPurchasedPrice(existing.transaction)), formatCurrency(nextPurchasedPrice)),
        buildOfferChange("Closing date", formatDateValue(existing.transaction.closingDate), formatDateValue(saved.closingDateOffered ?? existing.transaction.closingDate)),
        buildOfferChange("Acceptance date", formatDateValue(existing.transaction.acceptanceDate), formatDateValue(now))
      ].filter((change): change is NonNullable<typeof change> => Boolean(change));

      await tx.transaction.update({
        where: {
          id: existing.transactionId
        },
        data: {
          purchasedPrice: nextPurchasedPrice,
          price: nextPurchasedPrice,
          closingDate: saved.closingDateOffered ?? existing.transaction.closingDate,
          acceptanceDate: now
        }
      });

      if (transactionChanges.length > 0) {
        await recordActivityLogEvent(tx, {
          organizationId: input.organizationId,
          membershipId: input.actorMembershipId,
          entityType: "transaction",
          entityId: existing.transactionId,
          action: activityLogActions.transactionUpdated,
          payload: {
            officeId: existing.transaction.officeId,
            transactionId: existing.transactionId,
            transactionLabel: buildTransactionObjectLabel(existing.transaction),
            objectLabel: buildTransactionObjectLabel(existing.transaction),
            changes: transactionChanges,
            details: [`Accepted offer applied: ${saved.title}`]
          }
        });
      }
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "offer",
      entityId: saved.id,
      action: getOfferEventAction(input.action),
      payload: {
        officeId: existing.transaction.officeId,
        transactionId: existing.transactionId,
        transactionLabel: buildTransactionObjectLabel(existing.transaction),
        objectLabel: buildOfferObjectLabel(saved, existing.transaction),
        changes: offerChanges,
        details: [
          ...(saved.price ? [`Price: ${formatCurrency(saved.price)}`] : []),
          ...(saved.expirationAt ? [`Expiration: ${formatDateValue(saved.expirationAt)}`] : []),
          ...(input.action === "accept" ? ["Accepted offer applied to transaction finance context"] : [])
        ],
        contextHref: buildOfferHref(existing.transactionId, saved.id)
      }
    });

    if (input.action === "receive") {
      await createNotificationsForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: existing.transaction.officeId,
        membershipIds: [existing.transaction.ownerMembershipId ?? ""],
        restrictToOfficeRoles: true,
        type: NotificationType.offer_received,
        category: NotificationCategory.offer,
        severity: NotificationSeverity.warning,
        entityType: NotificationEntityType.offer,
        entityId: saved.id,
        title: `Offer received: ${existing.transaction.title}`,
        body: `${saved.title} from ${saved.offeringPartyName} is now marked received.`,
        actionUrl: buildOfferHref(existing.transactionId, saved.id)
      });
    }

    return saved.id;
  });

  if (!offerId) {
    return null;
  }

  const offer = await getOfferRecord(input.organizationId, input.transactionId, offerId);
  return offer ? mapOfferRecord(offer) : null;
}

export async function createOfferComment(input: CreateOfferCommentInput): Promise<OfficeOfferCommentRecord | null> {
  const commentId = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findFirst({
      where: {
        id: input.offerId,
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
            purchasedPrice: true,
            price: true,
            closingDate: true,
            acceptanceDate: true
          }
        }
      }
    });

    if (!offer) {
      return null;
    }

    const body = input.body.trim();
    if (!body) {
      throw new Error("Comment body is required.");
    }

    const created = await tx.offerComment.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? offer.transaction.officeId ?? null,
        offerId: input.offerId,
        membershipId: input.actorMembershipId,
        body
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "offer",
      entityId: offer.id,
      action: activityLogActions.offerCommentAdded,
      payload: {
        officeId: offer.transaction.officeId,
        transactionId: input.transactionId,
        transactionLabel: buildTransactionObjectLabel(offer.transaction),
        objectLabel: buildOfferObjectLabel(offer, offer.transaction),
        commentBody: body,
        contextHref: buildOfferHref(input.transactionId, offer.id)
      }
    });

    return created.id;
  });

  if (!commentId) {
    return null;
  }

  const comment = await prisma.offerComment.findUnique({
    where: { id: commentId },
    include: {
      membership: {
        include: {
          user: true
        }
      }
    }
  });

  return comment
    ? {
        id: comment.id,
        membershipId: comment.membershipId,
        authorName: `${comment.membership.user.firstName} ${comment.membership.user.lastName}`,
        body: comment.body,
        createdAt: formatDateTimeValue(comment.createdAt)
      }
    : null;
}
