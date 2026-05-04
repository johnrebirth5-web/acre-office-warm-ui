import type { UserRole } from "@acre/auth";
import {
  SignatureDriveSyncStatus,
  SignatureRecipientRole,
  SignatureRequestStatus,
  SignatureTemplateCategory
} from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

type WorkspaceVisibilityInput = {
  organizationId: string;
  officeId?: string | null;
  viewerMembershipId: string;
  viewerRole: UserRole;
  viewerEmail: string;
};

export type OfficeSignatureWorkspaceRow = {
  id: string;
  title: string;
  contextType: string;
  contextTypeLabel: string;
  transactionLabel: string;
  transactionHref: string;
  contextLabel: string;
  requestedByLabel: string;
  subjectLabel: string;
  recipientsLabel: string;
  signersCount: number;
  approversCount: number;
  ccCount: number;
  statusKey: SignatureRequestStatus;
  status: string;
  driveSyncStatus: SignatureDriveSyncStatus;
  driveSyncStatusLabel: string;
  templateName: string;
  templateCategory: string;
  templateCategoryLabel: string;
  sentAt: string;
  completedAt: string;
  updatedAt: string;
  requestHref: string;
  primaryActionHref: string;
  primaryActionLabel: string;
  completedDocumentHref: string;
  subjectMembershipId: string;
};

export type OfficeSignatureWorkspaceSnapshot = {
  summary: {
    totalCount: number;
    draftCount: number;
    readyToSendCount: number;
    inFlightCount: number;
    pendingCount: number;
    completedCount: number;
    failedDriveCount: number;
    templateCount: number;
    activeTemplateCount: number;
    nonTransactionRequestCount: number;
    nonTransactionTemplateCount: number;
  };
  createSupport: {
    canStartNonTransactionDraft: boolean;
    currentAuthoringPathLabel: string;
    blockers: Array<{
      code: string;
      title: string;
      detail: string;
    }>;
  };
  filters: {
    status: string;
    category: string;
    requestedByMembershipId: string;
    recipientQuery: string;
    subjectMembershipId: string;
  };
  requestedByOptions: Array<{
    id: string;
    label: string;
  }>;
  subjectOptions: Array<{
    id: string;
    label: string;
  }>;
  rows: OfficeSignatureWorkspaceRow[];
};

export type OfficeSignatureExportPayload = {
  columns: Array<{
    key: string;
    label: string;
  }>;
  rows: Array<Record<string, string>>;
};

export type ListOfficeSignaturesInput = WorkspaceVisibilityInput & {
  status?: string | null;
  category?: string | null;
  requestedByMembershipId?: string | null;
  recipientQuery?: string | null;
  subjectMembershipId?: string | null;
};

const companyWideRoles = new Set<UserRole>(["owner", "office_admin", "accountant", "human_resources", "office_manager"]);

const signatureStatusLabelMap: Record<SignatureRequestStatus, string> = {
  draft: "Draft",
  pending_send: "Pending Send",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  completed: "Completed",
  declined: "Declined",
  canceled: "Void / Cancelled",
  voided: "Void / Cancelled",
  expired: "Expired"
};

const signatureDriveStatusLabelMap: Record<SignatureDriveSyncStatus, string> = {
  not_configured: "Not configured",
  pending: "Pending",
  synced: "Synced",
  failed: "Failed"
};

const templateCategoryLabelMap: Record<string, string> = {
  hr: "HR",
  finance: "Finance",
  admin: "Admin",
  transaction: "Transaction",
  project_sales: "Project sales",
  generic: "Generic"
};

const contextTypeLabelMap: Record<string, string> = {
  transaction: "Transaction",
  membership: "HR / Membership",
  finance_request: "Finance request",
  admin_request: "Admin request",
  generic: "Generic",
  project: "Project signing"
};

const projectSigningWorkspaceHref = "/agent/projects";

function buildNonTransactionCreateSupport() {
  return {
    canStartNonTransactionDraft: false,
    currentAuthoringPathLabel: "Transaction PDF -> recipients and delivery -> PDF field placement",
    blockers: [
      {
        code: "signature-request-transaction-required",
        title: "New requests still need a transaction source",
        detail:
          "Standalone HR, finance, admin, and generic requests cannot be started from the center yet because new signature drafts still begin from a transaction-linked request."
      },
      {
        code: "signature-recipient-field-transaction-required",
        title: "Recipients and fields are still set up inside that flow",
        detail:
          "Signer routing, recipient ownership, and field placement are still configured through the current transaction-based authoring flow."
      },
      {
        code: "signature-editor-needs-transaction-pdf",
        title: "The editor still opens from a transaction PDF",
        detail:
          "The current editor expects a transaction PDF as its starting document, so there is not yet a blank standalone authoring path for non-transaction requests."
      },
      {
        code: "generic-template-category-missing",
        title: "Generic templates are not fully reusable yet",
        detail:
          "Templates already cover transaction, HR, finance, and admin use cases, but generic standalone templates are not fully supported yet."
      }
    ]
  };
}

function buildVisibilityWhere(input: WorkspaceVisibilityInput) {
  const officeScope = input.officeId ? { officeId: input.officeId } : {};

  if (companyWideRoles.has(input.viewerRole)) {
    return {
      organizationId: input.organizationId,
      ...officeScope
    };
  }

  return {
    organizationId: input.organizationId,
    ...officeScope,
    OR: [
      { requestedByMembershipId: input.viewerMembershipId },
      { subjectMembershipId: input.viewerMembershipId },
      {
        recipients: {
          some: {
            OR: [
              { membershipId: input.viewerMembershipId },
              { email: input.viewerEmail.trim().toLowerCase() }
            ]
          }
        }
      }
    ]
  };
}

function formatMembershipLabel(
  membership:
    | {
        user?: {
          firstName: string | null;
          lastName: string | null;
          email: string;
        } | null;
      }
    | null
    | undefined
) {
  const firstName = membership?.user?.firstName?.trim() ?? "";
  const lastName = membership?.user?.lastName?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim();

  return name || membership?.user?.email || "—";
}

function buildRecipientsLabel(
  request:
    | {
        recipientName: string;
        recipientEmail: string;
        recipients: Array<{
          role: SignatureRecipientRole;
          name: string;
          email: string;
        }>;
      }
) {
  if (request.recipients.length === 0) {
    return [request.recipientName, request.recipientEmail].filter(Boolean).join(" · ");
  }

  return request.recipients
    .filter((recipient) => recipient.role !== "cc")
    .map((recipient) => recipient.name || recipient.email)
    .filter(Boolean)
    .join(", ");
}

function normalizeTemplateCategory(
  request: {
    template?: {
      category: string;
      name: string;
    } | null;
    contextType: string;
  }
) {
  if (request.template?.category) {
    return request.template.category;
  }

  if (request.contextType === "membership") {
    return "hr";
  }

  if (request.contextType === "finance_request") {
    return "finance";
  }

  if (request.contextType === "admin_request") {
    return "admin";
  }

  if (request.contextType === "transaction") {
    return "transaction";
  }

  if (request.contextType === "generic") {
    return "generic";
  }

  if (request.contextType === "project") {
    return SignatureTemplateCategory.project_sales;
  }

  return "";
}

function buildPrimaryAction(snapshot: {
  requestHref: string;
  transactionHref: string;
  statusKey: SignatureRequestStatus;
}) {
  if (snapshot.requestHref) {
    if (snapshot.statusKey === "draft" || snapshot.statusKey === "pending_send") {
      return {
        href: snapshot.requestHref,
        label: "Continue draft"
      };
    }

    return {
      href: snapshot.requestHref,
      label: "Open request"
    };
  }

  if (snapshot.transactionHref) {
    return {
      href: snapshot.transactionHref,
      label: "Open transaction"
    };
  }

  return {
    href: "",
    label: ""
  };
}

function mapWorkspaceRow(
  request: Awaited<ReturnType<typeof listSignatureRequestsForWorkspace>>[number]
): OfficeSignatureWorkspaceRow {
  const isProjectSigningRequest = request.contextType === "project";
  const canOpenTransactionRequest = !isProjectSigningRequest && Boolean(request.transactionId && request.documentId);
  const canOpenTransaction = !isProjectSigningRequest && Boolean(request.transactionId);
  const templateCategory = normalizeTemplateCategory(request);
  const signersCount = request.recipients.filter((recipient) => recipient.role === "signer").length;
  const approversCount = request.recipients.filter((recipient) => recipient.role === "approver").length;
  const ccCount = request.recipients.filter((recipient) => recipient.role === "cc").length;
  const title =
    request.document?.title ||
    request.form?.name ||
    request.completedDocument?.title ||
    request.contextLabel ||
    "Signature request";
  const transactionHref = canOpenTransaction ? `/office/transactions/${request.transactionId}` : "";
  const requestHref = canOpenTransactionRequest
    ? `/office/transactions/${request.transactionId}/signatures/${request.id}`
    : isProjectSigningRequest
      ? projectSigningWorkspaceHref
      : "";
  const primaryAction = isProjectSigningRequest
    ? {
        href: projectSigningWorkspaceHref,
        label: "Open project signing"
      }
    : buildPrimaryAction({
        requestHref,
        transactionHref,
        statusKey: request.status
      });

  return {
    id: request.id,
    title,
    contextType: request.contextType,
    contextTypeLabel: contextTypeLabelMap[request.contextType] ?? "Generic",
    transactionLabel: request.transaction?.title || request.contextLabel || "—",
    transactionHref,
    contextLabel: request.contextLabel || request.transaction?.title || title,
    requestedByLabel: formatMembershipLabel(request.requestedByMembership),
    subjectLabel: formatMembershipLabel(request.subjectMembership),
    recipientsLabel: buildRecipientsLabel(request),
    signersCount,
    approversCount,
    ccCount,
    statusKey: request.status,
    status: signatureStatusLabelMap[request.status],
    driveSyncStatus: request.driveSyncStatus,
    driveSyncStatusLabel: signatureDriveStatusLabelMap[request.driveSyncStatus],
    templateName: request.template?.name ?? "",
    templateCategory,
    templateCategoryLabel: templateCategoryLabelMap[templateCategory] ?? "Uncategorized",
    sentAt: formatDateTimeLabel(request.sentAt ?? null) || "",
    completedAt: formatDateTimeLabel(request.completedAt ?? null) || "",
    updatedAt: formatDateTimeLabel(request.updatedAt ?? null) || "",
    requestHref,
    primaryActionHref: primaryAction.href,
    primaryActionLabel: primaryAction.label,
    completedDocumentHref:
      !isProjectSigningRequest && request.transactionId && request.completedDocumentId
        ? `/api/office/transactions/${request.transactionId}/documents/${request.completedDocumentId}/file`
        : "",
    subjectMembershipId: request.subjectMembershipId ?? ""
  };
}

async function listSignatureRequestsForWorkspace(input: ListOfficeSignaturesInput) {
  const visibilityWhere = buildVisibilityWhere(input);
  const filters: Array<Record<string, unknown>> = [];

  if (input.status && input.status !== "all") {
    filters.push({
      status: input.status as SignatureRequestStatus
    });
  }

  if (input.requestedByMembershipId) {
    filters.push({
      requestedByMembershipId: input.requestedByMembershipId
    });
  }

  if (input.subjectMembershipId) {
    filters.push({
      subjectMembershipId: input.subjectMembershipId
    });
  }

  if (input.recipientQuery) {
    filters.push({
      OR: [
        { recipientName: { contains: input.recipientQuery, mode: "insensitive" } },
        { recipientEmail: { contains: input.recipientQuery, mode: "insensitive" } },
        {
          recipients: {
            some: {
              OR: [
                { name: { contains: input.recipientQuery, mode: "insensitive" } },
                { email: { contains: input.recipientQuery, mode: "insensitive" } }
              ]
            }
          }
        }
      ]
    });
  }

  return prisma.signatureRequest.findMany({
    where: {
      AND: [visibilityWhere, ...filters]
    },
    include: {
      transaction: {
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
      form: {
        select: {
          id: true,
          name: true
        }
      },
      completedDocument: {
        select: {
          id: true,
          title: true
        }
      },
      template: {
        select: {
          id: true,
          name: true,
          category: true
        }
      },
      requestedByMembership: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      subjectMembership: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      recipients: {
        select: {
          id: true,
          role: true,
          name: true,
          email: true
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getOfficeSignaturesWorkspace(
  input: ListOfficeSignaturesInput
): Promise<OfficeSignatureWorkspaceSnapshot> {
  const templateWhere = {
    organizationId: input.organizationId,
    ...(input.officeId ? { officeId: input.officeId } : {})
  };

  const [requests, templateCount, activeTemplateCount, nonTransactionTemplateCount] = await Promise.all([
    listSignatureRequestsForWorkspace(input),
    prisma.signatureTemplate.count({ where: templateWhere }),
    prisma.signatureTemplate.count({
      where: {
        ...templateWhere,
        isActive: true
      }
    }),
    prisma.signatureTemplate.count({
      where: {
        ...templateWhere,
        category: {
          in: [SignatureTemplateCategory.hr, SignatureTemplateCategory.finance, SignatureTemplateCategory.admin]
        }
      }
    })
  ]);

  const rows = requests
    .map(mapWorkspaceRow)
    .filter((row) => !input.category || input.category === "all" || row.templateCategory === input.category);

  const requestedByOptions = Array.from(
    new Map(
      requests
        .map((request) => ({
          id: request.requestedByMembershipId,
          label: formatMembershipLabel(request.requestedByMembership)
        }))
        .map((entry) => [entry.id, entry])
    ).values()
  ).sort((left, right) => left.label.localeCompare(right.label));

  const subjectOptions = Array.from(
    new Map(
      requests
        .filter((request) => request.subjectMembershipId)
        .map((request) => ({
          id: request.subjectMembershipId ?? "",
          label: formatMembershipLabel(request.subjectMembership)
        }))
        .map((entry) => [entry.id, entry])
    ).values()
  ).sort((left, right) => left.label.localeCompare(right.label));

  return {
    summary: {
      totalCount: rows.length,
      draftCount: rows.filter((row) => row.statusKey === "draft").length,
      readyToSendCount: rows.filter((row) => row.statusKey === "pending_send").length,
      inFlightCount: rows.filter((row) => ["sent", "viewed", "signed"].includes(row.statusKey)).length,
      pendingCount: rows.filter((row) => ["pending_send", "sent", "viewed", "signed"].includes(row.statusKey)).length,
      completedCount: rows.filter((row) => row.statusKey === "completed").length,
      failedDriveCount: rows.filter((row) => row.driveSyncStatus === SignatureDriveSyncStatus.failed).length,
      templateCount,
      activeTemplateCount,
      nonTransactionRequestCount: rows.filter(
        (row) => row.templateCategory !== "" && row.templateCategory !== "transaction"
      ).length,
      nonTransactionTemplateCount
    },
    createSupport: buildNonTransactionCreateSupport(),
    filters: {
      status: input.status?.trim() || "all",
      category: input.category?.trim() || "all",
      requestedByMembershipId: input.requestedByMembershipId?.trim() || "",
      recipientQuery: input.recipientQuery?.trim() || "",
      subjectMembershipId: input.subjectMembershipId?.trim() || ""
    },
    requestedByOptions,
    subjectOptions,
    rows
  };
}

export async function getOfficeSignatureExportPayload(input: ListOfficeSignaturesInput): Promise<OfficeSignatureExportPayload> {
  const workspace = await getOfficeSignaturesWorkspace(input);

  return {
    columns: [
      { key: "title", label: "Title" },
      { key: "context", label: "Context" },
      { key: "templateCategory", label: "Template Category" },
      { key: "requestedBy", label: "Requested By" },
      { key: "recipients", label: "Recipients" },
      { key: "status", label: "Status" },
      { key: "driveSync", label: "Drive Sync" },
      { key: "sentAt", label: "Sent At" },
      { key: "completedAt", label: "Completed At" },
      { key: "updatedAt", label: "Updated At" }
    ],
    rows: workspace.rows.map((row) => ({
      title: row.title,
      context: row.contextLabel,
      templateCategory: row.templateCategoryLabel,
      requestedBy: row.requestedByLabel,
      recipients: row.recipientsLabel,
      status: row.status,
      driveSync: row.driveSyncStatusLabel,
      sentAt: row.sentAt,
      completedAt: row.completedAt,
      updatedAt: row.updatedAt
    }))
  };
}
