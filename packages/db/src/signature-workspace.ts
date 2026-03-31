import type { UserRole } from "@acre/auth";
import { SignatureDriveSyncStatus, SignatureRecipientRole, SignatureRequestStatus } from "@prisma/client";
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
  transactionLabel: string;
  transactionHref: string;
  contextLabel: string;
  requestedByLabel: string;
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
  completedDocumentHref: string;
  subjectMembershipId: string;
};

export type OfficeSignatureWorkspaceSnapshot = {
  summary: {
    totalCount: number;
    pendingCount: number;
    completedCount: number;
    failedDriveCount: number;
    templateCount: number;
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
  transaction: "Transaction"
};

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

  return "";
}

function mapWorkspaceRow(
  request: Awaited<ReturnType<typeof listSignatureRequestsForWorkspace>>[number]
): OfficeSignatureWorkspaceRow {
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

  return {
    id: request.id,
    title,
    transactionLabel: request.transaction?.title || request.contextLabel || "—",
    transactionHref: request.transactionId ? `/office/transactions/${request.transactionId}` : "",
    contextLabel: request.contextLabel || request.transaction?.title || title,
    requestedByLabel: formatMembershipLabel(request.requestedByMembership),
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
    requestHref: request.transactionId ? `/office/transactions/${request.transactionId}/signatures/${request.id}` : "",
    completedDocumentHref:
      request.transactionId && request.completedDocumentId
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
  const [requests, templateCount] = await Promise.all([
    listSignatureRequestsForWorkspace(input),
    prisma.signatureTemplate.count({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {})
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

  return {
    summary: {
      totalCount: rows.length,
      pendingCount: rows.filter((row) => ["pending_send", "sent", "viewed", "signed"].includes(row.statusKey)).length,
      completedCount: rows.filter((row) => row.statusKey === "completed").length,
      failedDriveCount: rows.filter((row) => row.driveSyncStatus === SignatureDriveSyncStatus.failed).length,
      templateCount
    },
    filters: {
      status: input.status?.trim() || "all",
      category: input.category?.trim() || "all",
      requestedByMembershipId: input.requestedByMembershipId?.trim() || "",
      recipientQuery: input.recipientQuery?.trim() || "",
      subjectMembershipId: input.subjectMembershipId?.trim() || ""
    },
    requestedByOptions,
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
