import {
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  SignatureRequestStatus,
  TransactionDocumentStatus,
  TransactionFormStatus,
  TransactionStatus,
  TransactionTaskComplianceStatus,
  TransactionTaskReviewStatus,
  TransactionTaskStatus,
  UserRole
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { createNotificationsForMemberships, listOfficeNotificationRecipientIds } from "./notifications";

export type OfficeTransactionTaskStatus = "Todo" | "In progress" | "Review requested" | "Completed" | "Reopened";
export type OfficeTransactionTaskReviewStatus =
  | "Not required"
  | "Pending"
  | "Review requested"
  | "First approved"
  | "Second review"
  | "Approved"
  | "Rejected";
export type OfficeTransactionTaskComplianceStatus = "Not applicable" | "Pending" | "In review" | "Approved" | "Rejected";
export type OfficeTaskOperationalStatus =
  | "Pending"
  | "In progress"
  | "Pending upload"
  | "Uploaded / not submitted"
  | "Review requested"
  | "Second review requested"
  | "Approved"
  | "Rejected"
  | "Waiting for signatures"
  | "Fully signed"
  | "Complete"
  | "Reopened";
export type OfficeTaskOperationalStatusTone = "pending" | "progress" | "review" | "approved" | "rejected" | "completed" | "reopened" | "signature";
export type OfficeTaskDueWindow = "" | "past_due" | "today" | "current_week" | "next_week" | "next_2_weeks";
export type OfficeTaskListVisibleColumn = "task" | "transaction" | "checklistGroup" | "assignee" | "dueDate" | "taskStatus" | "transactionStatus" | "owner";
export type OfficeTaskListViewKey = "requires-attention" | "all-transactions" | string;
export type OfficeTaskReviewFilter = "" | "Pending" | "Review requested" | "Second review" | "Approved" | "Rejected";

export type OfficeTransactionTaskLinkedDocument = {
  id: string;
  title: string;
  href: string;
  fileHref: string;
  status: string;
  isSigned: boolean;
  hasPendingSignature: boolean;
};

export type OfficeTransactionTaskLinkedForm = {
  id: string;
  name: string;
  href: string;
  status: string;
  documentId: string | null;
  documentTitle: string;
  documentFileHref: string;
  hasPendingSignature: boolean;
  signatureStatus: string;
};

export type OfficeTransactionTask = {
  id: string;
  transactionId: string;
  transactionHref: string;
  transactionLabel: string;
  transactionStatus: string;
  checklistGroup: string;
  title: string;
  description: string;
  assigneeMembershipId: string | null;
  assigneeName: string;
  ownerName: string;
  dueAt: string;
  status: OfficeTransactionTaskStatus;
  reviewStatus: OfficeTransactionTaskReviewStatus;
  complianceStatus: OfficeTransactionTaskComplianceStatus;
  taskStatusLabel: OfficeTaskOperationalStatus;
  taskStatusTone: OfficeTaskOperationalStatusTone;
  sortOrder: number;
  requiresDocument: boolean;
  requiresDocumentApproval: boolean;
  requiresSecondaryApproval: boolean;
  completedAt: string;
  completedByName: string;
  completedByMembershipId: string | null;
  submittedForReviewAt: string;
  submittedForReviewByName: string;
  submittedForReviewByMembershipId: string | null;
  firstApprovedAt: string;
  firstApprovedByName: string;
  firstApprovedByMembershipId: string | null;
  secondApprovedAt: string;
  secondApprovedByName: string;
  secondApprovedByMembershipId: string | null;
  rejectedAt: string;
  rejectedByName: string;
  rejectedByMembershipId: string | null;
  rejectionReason: string;
  reopenedAt: string;
  updatedAt: string;
  linkedDocuments: OfficeTransactionTaskLinkedDocument[];
  linkedForms: OfficeTransactionTaskLinkedForm[];
  awaitingSecondaryApproval: boolean;
  canCompleteDirectly: boolean;
  canRequestReview: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReopen: boolean;
};

export type OfficeTransactionTaskAssigneeOption = {
  id: string;
  label: string;
};

export type OfficeTaskTransactionOption = {
  id: string;
  label: string;
  status: string;
};

export type OfficeTaskListFilters = {
  transactionStatus: string;
  assigneeMembershipId: string;
  dueWindow: OfficeTaskDueWindow;
  noDueDate: boolean;
  reviewStatus: OfficeTaskReviewFilter;
  requiresSecondaryApproval: boolean;
  complianceStatuses: OfficeTransactionTaskComplianceStatus[];
  transactionId: string;
  q: string;
  includeCompleted: boolean;
};

export type OfficeTaskListView = {
  id: string;
  key: OfficeTaskListViewKey;
  name: string;
  isSystem: boolean;
  isShared: boolean;
  filters: OfficeTaskListFilters;
  visibleColumns: OfficeTaskListVisibleColumn[];
  sort: OfficeTaskListSort;
};

export type OfficeTaskListSort = {
  field: "dueAt";
  direction: "asc";
  nulls: "last";
};

export type OfficeTaskListSnapshot = {
  selectedViewKey: OfficeTaskListViewKey;
  selectedViewName: string;
  filters: OfficeTaskListFilters;
  visibleColumns: OfficeTaskListVisibleColumn[];
  sort: OfficeTaskListSort;
  tasks: OfficeTransactionTask[];
  taskCount: number;
  maxWindowLabel: string;
  summary: {
    overdueCount: number;
    dueSoonCount: number;
    reviewQueueCount: number;
    completedCount: number;
  };
  viewOptions: OfficeTaskListView[];
  assigneeOptions: OfficeTransactionTaskAssigneeOption[];
  transactionOptions: OfficeTaskTransactionOption[];
};

export type OfficeDocumentApprovalQueueView =
  | "all_open_review_items"
  | "awaiting_my_review"
  | "awaiting_second_review"
  | "rejected"
  | "waiting_for_signatures"
  | "missing_required_document";

export type OfficeDocumentApprovalQueueState =
  | "awaiting_my_review"
  | "awaiting_second_review"
  | "rejected"
  | "waiting_for_signatures"
  | "missing_required_document";

export type OfficeDocumentApprovalQueueFilters = {
  queue: OfficeDocumentApprovalQueueView;
  assigneeMembershipId: string;
  dueWindow: OfficeTaskDueWindow;
  q: string;
};

export type OfficeDocumentApprovalQueueSummary = Record<OfficeDocumentApprovalQueueView, number>;

export type OfficeDocumentApprovalQueueItem = {
  task: OfficeTransactionTask;
  queueState: OfficeDocumentApprovalQueueState;
  queueStateLabel: string;
  primaryArtifactKind: "document" | "form" | "missing";
  primaryArtifactTitle: string;
  secondaryArtifactTitle: string;
  openDocumentHref: string | null;
  artifactCountLabel: string;
  formStatusLabel: string;
  signatureStatusLabel: string;
};

export type OfficeDocumentApprovalQueueSnapshot = {
  filters: OfficeDocumentApprovalQueueFilters;
  selectedQueueLabel: string;
  summary: OfficeDocumentApprovalQueueSummary;
  items: OfficeDocumentApprovalQueueItem[];
  itemCount: number;
  assigneeOptions: OfficeTransactionTaskAssigneeOption[];
  maxWindowLabel: string;
};

export type ListOfficeTasksInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  view?: string;
  transactionStatus?: string;
  assigneeMembershipId?: string;
  dueWindow?: string;
  noDueDate?: string;
  reviewStatus?: string;
  requiresSecondaryApproval?: string;
  complianceStatus?: string | string[];
  transactionId?: string;
  q?: string;
  includeCompleted?: string;
  limit?: number;
};

export type ListOfficeDocumentApprovalQueueInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  canSecondaryReviewTasks?: boolean;
  queue?: string;
  assigneeMembershipId?: string;
  dueWindow?: string;
  q?: string;
  limit?: number;
};

export type TransactionTaskAuditSource = "approve_docs_queue";

export type CreateTransactionTaskInput = {
  organizationId: string;
  transactionId: string;
  actorMembershipId?: string;
  checklistGroup?: string;
  title: string;
  description?: string;
  assigneeMembershipId?: string;
  dueAt?: string;
  status?: OfficeTransactionTaskStatus;
  requiresDocument?: boolean;
  requiresDocumentApproval?: boolean;
  requiresSecondaryApproval?: boolean;
};

export type UpdateTransactionTaskInput = {
  organizationId: string;
  transactionId: string;
  taskId: string;
  actorMembershipId?: string;
  activitySource?: TransactionTaskAuditSource | null;
  checklistGroup?: string;
  title?: string;
  description?: string;
  assigneeMembershipId?: string;
  dueAt?: string;
  status?: OfficeTransactionTaskStatus;
  sortOrder?: number;
  requiresDocument?: boolean;
  requiresDocumentApproval?: boolean;
  requiresSecondaryApproval?: boolean;
};

export type SaveTaskListViewInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  name: string;
  isShared?: boolean;
  filters: OfficeTaskListFilters;
  visibleColumns?: OfficeTaskListVisibleColumn[];
  sort?: OfficeTaskListSort;
};

const taskStatusLabelMap: Record<TransactionTaskStatus, OfficeTransactionTaskStatus> = {
  todo: "Todo",
  in_progress: "In progress",
  review_requested: "Review requested",
  completed: "Completed",
  reopened: "Reopened"
};

const taskStatusDbMap: Record<OfficeTransactionTaskStatus, TransactionTaskStatus> = {
  Todo: "todo",
  "In progress": "in_progress",
  "Review requested": "review_requested",
  Completed: "completed",
  Reopened: "reopened"
};

const reviewStatusLabelMap: Record<TransactionTaskReviewStatus, OfficeTransactionTaskReviewStatus> = {
  not_required: "Not required",
  pending: "Pending",
  review_requested: "Review requested",
  first_approved: "First approved",
  second_review: "Second review",
  approved: "Approved",
  rejected: "Rejected"
};

const complianceStatusLabelMap: Record<TransactionTaskComplianceStatus, OfficeTransactionTaskComplianceStatus> = {
  not_applicable: "Not applicable",
  pending: "Pending",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected"
};

const complianceStatusDbMap: Record<OfficeTransactionTaskComplianceStatus, TransactionTaskComplianceStatus> = {
  "Not applicable": "not_applicable",
  Pending: "pending",
  "In review": "in_review",
  Approved: "approved",
  Rejected: "rejected"
};

const transactionStatusDbMap: Record<string, TransactionStatus> = {
  Opportunity: "opportunity",
  Active: "active",
  Pending: "pending",
  Closed: "closed",
  Cancelled: "cancelled"
};

const transactionStatusLabelMap: Record<TransactionStatus, string> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled",
  system_anchor: "System Anchor"
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
  canceled: "Canceled",
  voided: "Void / Cancelled",
  expired: "Expired"
};

const defaultTaskSort: OfficeTaskListSort = {
  field: "dueAt",
  direction: "asc",
  nulls: "last"
};

const defaultTaskListLimit = 200;
const defaultDocumentApprovalQueueLimit = 200;

const documentApprovalQueueViewLabels: Record<OfficeDocumentApprovalQueueView, string> = {
  all_open_review_items: "All open review items",
  awaiting_my_review: "Awaiting my review",
  awaiting_second_review: "Awaiting second review",
  rejected: "Rejected",
  waiting_for_signatures: "Waiting for signatures",
  missing_required_document: "Missing required document"
};

const documentApprovalQueueStateLabels: Record<OfficeDocumentApprovalQueueState, string> = {
  awaiting_my_review: "Awaiting first review",
  awaiting_second_review: "Awaiting second review",
  rejected: "Rejected",
  waiting_for_signatures: "Waiting for signatures",
  missing_required_document: "Missing required document"
};

const taskAuditSourceLabelMap: Record<TransactionTaskAuditSource, string> = {
  approve_docs_queue: "Approve Docs queue"
};

const systemTaskViewDefinitions: Record<
  "requires-attention" | "all-transactions",
  {
    name: string;
    getFilters: (membershipId: string) => OfficeTaskListFilters;
    visibleColumns: OfficeTaskListVisibleColumn[];
  }
> = {
  "requires-attention": {
    name: "Requires attention",
    getFilters: (membershipId) => ({
      transactionStatus: "Active",
      assigneeMembershipId: membershipId,
      dueWindow: "",
      noDueDate: false,
      reviewStatus: "",
      requiresSecondaryApproval: false,
      complianceStatuses: [],
      transactionId: "",
      q: "",
      includeCompleted: false
    }),
    visibleColumns: ["task", "transaction", "checklistGroup", "assignee", "dueDate", "taskStatus", "transactionStatus"]
  },
  "all-transactions": {
    name: "All transactions",
    getFilters: () => ({
      transactionStatus: "Active",
      assigneeMembershipId: "",
      dueWindow: "",
      noDueDate: false,
      reviewStatus: "",
      requiresSecondaryApproval: false,
      complianceStatuses: [],
      transactionId: "",
      q: "",
      includeCompleted: false
    }),
    visibleColumns: ["task", "transaction", "checklistGroup", "assignee", "dueDate", "taskStatus", "transactionStatus", "owner"]
  }
};

type TaskWithRelations = Prisma.TransactionTaskGetPayload<{
  include: {
    transaction: {
      include: {
        ownerMembership: {
          include: {
            user: true;
          };
        };
      };
    };
    assigneeMembership: {
      include: {
        user: true;
      };
    };
    completedByMembership: {
      include: {
        user: true;
      };
    };
    submittedForReviewByMembership: {
      include: {
        user: true;
      };
    };
    firstApprovedByMembership: {
      include: {
        user: true;
      };
    };
    secondApprovedByMembership: {
      include: {
        user: true;
      };
    };
    rejectedByMembership: {
      include: {
        user: true;
      };
    };
    documents: {
      include: {
        signatureRequests: true;
      };
    };
    forms: {
      include: {
        document: {
          include: {
            signatureRequests: true;
          };
        };
        signatureRequests: true;
      };
    };
  };
}>;

const transactionTaskInclude = {
  transaction: {
    include: {
      ownerMembership: {
        include: {
          user: true
        }
      }
    }
  },
  assigneeMembership: {
    include: {
      user: true
    }
  },
  completedByMembership: {
    include: {
      user: true
    }
  },
  submittedForReviewByMembership: {
    include: {
      user: true
    }
  },
  firstApprovedByMembership: {
    include: {
      user: true
    }
  },
  secondApprovedByMembership: {
    include: {
      user: true
    }
  },
  rejectedByMembership: {
    include: {
      user: true
    }
  },
  documents: {
    include: {
      signatureRequests: true
    }
  },
  forms: {
    include: {
      document: {
        include: {
          signatureRequests: true
        }
      },
      signatureRequests: true
    }
  }
} satisfies Prisma.TransactionTaskInclude;

function formatDateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDateTimeValue(date: Date | null) {
  return date ? date.toISOString() : "";
}

function parseOptionalDate(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseBooleanFlag(value: boolean | string | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeChecklistGroup(value: string | undefined) {
  return value?.trim() || "General";
}

function normalizeTaskStatus(value: string | undefined) {
  const fallback: OfficeTransactionTaskStatus = "Todo";

  if (!value) {
    return fallback;
  }

  return value in taskStatusDbMap ? (value as OfficeTransactionTaskStatus) : fallback;
}

function normalizeDocumentApprovalQueueView(value: string | undefined): OfficeDocumentApprovalQueueView {
  if (
    value === "awaiting_my_review" ||
    value === "awaiting_second_review" ||
    value === "rejected" ||
    value === "waiting_for_signatures" ||
    value === "missing_required_document"
  ) {
    return value;
  }

  return "all_open_review_items";
}

function formatMembershipName(
  membership:
    | {
        user: {
          firstName: string;
          lastName: string;
        };
      }
    | null
    | undefined,
  fallback = "Unassigned"
) {
  return membership ? `${membership.user.firstName} ${membership.user.lastName}` : fallback;
}

function buildTransactionObjectLabel(transaction: {
  title: string;
  address: string;
  city: string;
  state: string;
}) {
  return `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`;
}

function buildTaskObjectLabel(taskTitle: string, transactionLabel: string) {
  return `${taskTitle} · ${transactionLabel}`;
}

function buildTaskNotificationHref(transactionId: string) {
  return `/office/transactions/${transactionId}#transaction-tasks`;
}

function taskNeedsReview(task: {
  requiresDocumentApproval: boolean;
  requiresSecondaryApproval: boolean;
}) {
  return task.requiresDocumentApproval || task.requiresSecondaryApproval;
}

function taskRequiresDocumentWorkflow(task: {
  requiresDocument: boolean;
  requiresDocumentApproval: boolean;
  requiresSecondaryApproval: boolean;
}) {
  return task.requiresDocument || task.requiresDocumentApproval || task.requiresSecondaryApproval;
}

function deriveDefaultReviewStatus(requiresReview: boolean): TransactionTaskReviewStatus {
  return requiresReview ? "pending" : "not_required";
}

function deriveDefaultComplianceStatus(requiresReview: boolean): TransactionTaskComplianceStatus {
  return requiresReview ? "pending" : "not_applicable";
}

function normalizeTaskFlags(
  existing: {
    requiresDocument: boolean;
    requiresDocumentApproval: boolean;
    requiresSecondaryApproval: boolean;
  },
  updates: {
    requiresDocument?: boolean;
    requiresDocumentApproval?: boolean;
    requiresSecondaryApproval?: boolean;
  }
) {
  const requestedSecondaryApproval = updates.requiresSecondaryApproval ?? existing.requiresSecondaryApproval;
  const requestedDocumentApproval =
    updates.requiresDocumentApproval ?? existing.requiresDocumentApproval;
  const requestedDocument = updates.requiresDocument ?? existing.requiresDocument;
  const requiresSecondaryApproval = requestedSecondaryApproval;
  const requiresDocumentApproval = requestedDocumentApproval || requiresSecondaryApproval;
  const requiresDocument = requestedDocument || requiresDocumentApproval;

  return {
    requiresDocument,
    requiresDocumentApproval,
    requiresSecondaryApproval
  };
}

type TaskWorkflowEvidence = {
  linkedDocuments: OfficeTransactionTaskLinkedDocument[];
  hasAnyLinkedDocument: boolean;
  hasSubmittedDocument: boolean;
  hasPendingSignature: boolean;
  hasAnySignatureRequest: boolean;
  hasDeclinedSignature: boolean;
  allSignatureRequestsSigned: boolean;
};

function buildLinkedTaskDocumentHref(transactionId: string, documentId: string) {
  return `/office/transactions/${transactionId}#transaction-document-${documentId}`;
}

function buildLinkedTaskDocumentFileHref(transactionId: string, documentId: string) {
  return `/api/office/transactions/${transactionId}/documents/${documentId}/file`;
}

function buildLinkedTaskFormHref(transactionId: string) {
  return `/office/transactions/${transactionId}#transaction-forms-signatures`;
}

function getDocumentStatusLabel(status: TransactionDocumentStatus) {
  switch (status) {
    case "uploaded":
      return "Uploaded";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "signed":
      return "Signed";
    case "archived":
      return "Archived";
    default:
      return "Uploaded";
  }
}

function getTaskWorkflowEvidence(task: TaskWithRelations): TaskWorkflowEvidence {
  const documentMap = new Map<string, OfficeTransactionTaskLinkedDocument>();
  const signatureStatuses: SignatureRequestStatus[] = [];

  for (const document of task.documents) {
    documentMap.set(document.id, {
      id: document.id,
      title: document.title,
      href: buildLinkedTaskDocumentHref(task.transactionId, document.id),
      fileHref: buildLinkedTaskDocumentFileHref(task.transactionId, document.id),
      status: getDocumentStatusLabel(document.status),
      isSigned: document.isSigned,
      hasPendingSignature: document.signatureRequests.some((request) =>
        request.status === "draft" || request.status === "sent" || request.status === "viewed"
      )
    });
    signatureStatuses.push(...document.signatureRequests.map((request) => request.status));
  }

  for (const form of task.forms) {
    signatureStatuses.push(...form.signatureRequests.map((request) => request.status));

    if (form.document && !documentMap.has(form.document.id)) {
      documentMap.set(form.document.id, {
        id: form.document.id,
        title: form.document.title,
        href: buildLinkedTaskDocumentHref(task.transactionId, form.document.id),
        fileHref: buildLinkedTaskDocumentFileHref(task.transactionId, form.document.id),
        status: getDocumentStatusLabel(form.document.status),
        isSigned: form.document.isSigned,
        hasPendingSignature: form.document.signatureRequests.some((request) =>
          request.status === "draft" || request.status === "sent" || request.status === "viewed"
        )
      });
      signatureStatuses.push(...form.document.signatureRequests.map((request) => request.status));
    }
  }

  const linkedDocuments = Array.from(documentMap.values());
  const hasAnySignatureRequest = signatureStatuses.length > 0;
  const hasPendingSignature = signatureStatuses.some((status) => status === "draft" || status === "sent" || status === "viewed");
  const hasDeclinedSignature = signatureStatuses.some((status) => status === "declined" || status === "canceled");
  const allSignatureRequestsSigned = hasAnySignatureRequest && signatureStatuses.every((status) => status === "signed");
  const hasSubmittedDocument = linkedDocuments.some((document) => document.status !== "Uploaded");

  return {
    linkedDocuments,
    hasAnyLinkedDocument: linkedDocuments.length > 0,
    hasSubmittedDocument,
    hasPendingSignature,
    hasAnySignatureRequest,
    hasDeclinedSignature,
    allSignatureRequestsSigned
  };
}

function getTaskFormSignatureStatus(statuses: SignatureRequestStatus[]) {
  if (!statuses.length) {
    return "No signature request";
  }

  if (statuses.some((status) => status === "declined" || status === "canceled")) {
    return "Declined / canceled";
  }

  if (statuses.every((status) => status === "signed")) {
    return "Fully signed";
  }

  if (statuses.some((status) => status === "signed")) {
    return "Partially signed";
  }

  if (statuses.some((status) => status === "viewed")) {
    return "Viewed";
  }

  if (statuses.some((status) => status === "sent")) {
    return "Sent";
  }

  if (statuses.every((status) => status === "draft")) {
    return "Draft";
  }

  return "Signature activity";
}

function getTaskLinkedForms(task: TaskWithRelations): OfficeTransactionTaskLinkedForm[] {
  return task.forms.map((form) => {
    const signatureStatuses = form.signatureRequests.map((request) => request.status);

    return {
      id: form.id,
      name: form.name,
      href: buildLinkedTaskFormHref(task.transactionId),
      status: formStatusLabelMap[form.status],
      documentId: form.document?.id ?? null,
      documentTitle: form.document?.title ?? "",
      documentFileHref: form.document ? buildLinkedTaskDocumentFileHref(task.transactionId, form.document.id) : "",
      hasPendingSignature: signatureStatuses.some((status) => status === "draft" || status === "sent" || status === "viewed"),
      signatureStatus: getTaskFormSignatureStatus(signatureStatuses)
    };
  });
}

function deriveTaskStatusPresentation(task: {
  status: TransactionTaskStatus;
  reviewStatus: TransactionTaskReviewStatus;
  complianceStatus: TransactionTaskComplianceStatus;
  requiresDocument: boolean;
  requiresDocumentApproval: boolean;
  requiresSecondaryApproval: boolean;
}, evidence: TaskWorkflowEvidence) {
  if (task.status === "completed") {
    return {
      label: "Complete" as const,
      tone: "completed" as const
    };
  }

  if (task.reviewStatus === "rejected" || task.complianceStatus === "rejected") {
    return {
      label: "Rejected" as const,
      tone: "rejected" as const
    };
  }

  if (task.reviewStatus === "second_review") {
    return {
      label: "Second review requested" as const,
      tone: "review" as const
    };
  }

  if (task.reviewStatus === "review_requested" || task.status === "review_requested") {
    return {
      label: "Review requested" as const,
      tone: "review" as const
    };
  }

  if (task.reviewStatus === "approved" || task.complianceStatus === "approved") {
    return {
      label: "Approved" as const,
      tone: "approved" as const
    };
  }

  if (task.status === "reopened") {
    return {
      label: "Reopened" as const,
      tone: "reopened" as const
    };
  }

  if (taskRequiresDocumentWorkflow(task)) {
    if (!evidence.hasAnyLinkedDocument) {
      return {
        label: "Pending upload" as const,
        tone: "pending" as const
      };
    }

    if (evidence.hasDeclinedSignature) {
      return {
        label: "Rejected" as const,
        tone: "rejected" as const
      };
    }

    if (evidence.hasPendingSignature) {
      return {
        label: "Waiting for signatures" as const,
        tone: "signature" as const
      };
    }

    if (evidence.allSignatureRequestsSigned) {
      return {
        label: "Fully signed" as const,
        tone: "signature" as const
      };
    }

    if (evidence.hasAnyLinkedDocument && !evidence.hasSubmittedDocument) {
      return {
        label: "Uploaded / not submitted" as const,
        tone: "progress" as const
      };
    }
  }

  if (task.status === "in_progress") {
    return {
      label: "In progress" as const,
      tone: "progress" as const
    };
  }

  return {
    label: "Pending" as const,
    tone: "pending" as const
  };
}

function buildTaskDetail(label: string, previousValue: string, nextValue: string) {
  if (previousValue === nextValue) {
    return null;
  }

  return `${label}: ${previousValue || "—"} -> ${nextValue || "—"}`;
}

function buildTaskChange(label: string, previousValue: string, nextValue: string) {
  if (previousValue === nextValue) {
    return null;
  }

  return {
    label,
    previousValue: previousValue || "—",
    nextValue: nextValue || "—"
  };
}

function normalizeOfficeTaskComplianceStatus(value: string): OfficeTransactionTaskComplianceStatus | null {
  if (value in complianceStatusDbMap) {
    return value as OfficeTransactionTaskComplianceStatus;
  }

  return null;
}

function normalizeOfficeTaskReviewStatus(value: string): OfficeTaskReviewFilter | null {
  if (value === "" || value === "Pending" || value === "Review requested" || value === "Second review" || value === "Approved" || value === "Rejected") {
    return value as OfficeTaskReviewFilter;
  }

  return null;
}

function getDbReviewStatuses(filter: OfficeTaskReviewFilter): TransactionTaskReviewStatus[] {
  switch (filter) {
    case "Pending":
      return ["pending"];
    case "Review requested":
      return ["review_requested"];
    case "Second review":
      return ["second_review"];
    case "Approved":
      return ["approved"];
    case "Rejected":
      return ["rejected"];
    default:
      return [];
  }
}

function parseComplianceStatusFilter(value: string | string[] | undefined): OfficeTransactionTaskComplianceStatus[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string" && value.includes(",")
      ? value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : typeof value === "string" && value.trim()
        ? [value.trim()]
        : [];

  return Array.from(
    new Set(
      values
        .map(normalizeOfficeTaskComplianceStatus)
        .filter((entry): entry is OfficeTransactionTaskComplianceStatus => Boolean(entry))
    )
  );
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(date: Date) {
  const next = endOfDay(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (7 - day));
  return endOfDay(next);
}

function getDueDateUpperBound(dueWindow: OfficeTaskDueWindow) {
  const now = new Date();

  switch (dueWindow) {
    case "today":
      return endOfDay(now);
    case "current_week":
      return endOfWeek(now);
    case "next_week": {
      const currentWeekEnd = endOfWeek(now);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
      return endOfDay(currentWeekEnd);
    }
    case "next_2_weeks": {
      const currentWeekEnd = endOfWeek(now);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 14);
      return endOfDay(currentWeekEnd);
    }
    default:
      return null;
  }
}

function getDueDateLowerBound(dueWindow: OfficeTaskDueWindow) {
  if (dueWindow !== "past_due") {
    return null;
  }

  return startOfDay(new Date());
}

function sanitizeVisibleColumns(columns: unknown, fallback: OfficeTaskListVisibleColumn[]) {
  if (!Array.isArray(columns)) {
    return fallback;
  }

  const allowed = new Set<OfficeTaskListVisibleColumn>(["task", "transaction", "checklistGroup", "assignee", "dueDate", "taskStatus", "transactionStatus", "owner"]);
  const sanitized = columns.filter((value): value is OfficeTaskListVisibleColumn => typeof value === "string" && allowed.has(value as OfficeTaskListVisibleColumn));

  return sanitized.length ? sanitized : fallback;
}

function sanitizeSort(sort: unknown): OfficeTaskListSort {
  if (
    sort &&
    typeof sort === "object" &&
    !Array.isArray(sort) &&
    (sort as Record<string, unknown>).field === "dueAt" &&
    (sort as Record<string, unknown>).direction === "asc" &&
    (sort as Record<string, unknown>).nulls === "last"
  ) {
    return defaultTaskSort;
  }

  return defaultTaskSort;
}

function sanitizePersistedFilters(filters: unknown, fallback: OfficeTaskListFilters): OfficeTaskListFilters {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return fallback;
  }

  const object = filters as Record<string, unknown>;

  return {
    transactionStatus: typeof object.transactionStatus === "string" ? object.transactionStatus : fallback.transactionStatus,
    assigneeMembershipId: typeof object.assigneeMembershipId === "string" ? object.assigneeMembershipId : fallback.assigneeMembershipId,
    dueWindow:
      object.dueWindow === "past_due" ||
      object.dueWindow === "today" ||
      object.dueWindow === "current_week" ||
      object.dueWindow === "next_week" ||
      object.dueWindow === "next_2_weeks"
        ? (object.dueWindow as OfficeTaskDueWindow)
        : fallback.dueWindow,
    noDueDate: typeof object.noDueDate === "boolean" ? object.noDueDate : fallback.noDueDate,
    reviewStatus:
      typeof object.reviewStatus === "string" && normalizeOfficeTaskReviewStatus(object.reviewStatus) !== null
        ? (object.reviewStatus as OfficeTaskReviewFilter)
        : fallback.reviewStatus,
    requiresSecondaryApproval:
      typeof object.requiresSecondaryApproval === "boolean" ? object.requiresSecondaryApproval : fallback.requiresSecondaryApproval,
    complianceStatuses: Array.isArray(object.complianceStatuses)
      ? object.complianceStatuses
          .map((entry) => (typeof entry === "string" ? normalizeOfficeTaskComplianceStatus(entry) : null))
          .filter((entry): entry is OfficeTransactionTaskComplianceStatus => Boolean(entry))
      : fallback.complianceStatuses,
    transactionId: typeof object.transactionId === "string" ? object.transactionId : fallback.transactionId,
    q: typeof object.q === "string" ? object.q : fallback.q,
    includeCompleted: typeof object.includeCompleted === "boolean" ? object.includeCompleted : fallback.includeCompleted
  };
}

function buildBuiltInTaskViews(membershipId: string): OfficeTaskListView[] {
  return Object.entries(systemTaskViewDefinitions).map(([key, definition]) => ({
    id: key,
    key,
    name: definition.name,
    isSystem: true,
    isShared: true,
    filters: definition.getFilters(membershipId),
    visibleColumns: definition.visibleColumns,
    sort: defaultTaskSort
  }));
}

function mergeFilterOverrides(base: OfficeTaskListFilters, input: ListOfficeTasksInput): OfficeTaskListFilters {
  return {
    transactionStatus: typeof input.transactionStatus === "string" && input.transactionStatus.trim() ? input.transactionStatus : base.transactionStatus,
    assigneeMembershipId:
      typeof input.assigneeMembershipId === "string" ? input.assigneeMembershipId : base.assigneeMembershipId,
    dueWindow:
      input.dueWindow === "past_due" ||
      input.dueWindow === "today" ||
      input.dueWindow === "current_week" ||
      input.dueWindow === "next_week" ||
      input.dueWindow === "next_2_weeks"
        ? input.dueWindow
        : base.dueWindow,
    noDueDate: input.noDueDate !== undefined ? parseBooleanFlag(input.noDueDate) : base.noDueDate,
    reviewStatus:
      input.reviewStatus !== undefined && normalizeOfficeTaskReviewStatus(input.reviewStatus) !== null
        ? (input.reviewStatus as OfficeTaskReviewFilter)
        : base.reviewStatus,
    requiresSecondaryApproval:
      input.requiresSecondaryApproval !== undefined ? parseBooleanFlag(input.requiresSecondaryApproval) : base.requiresSecondaryApproval,
    complianceStatuses:
      input.complianceStatus !== undefined ? parseComplianceStatusFilter(input.complianceStatus) : base.complianceStatuses,
    transactionId: typeof input.transactionId === "string" ? input.transactionId : base.transactionId,
    q: typeof input.q === "string" ? input.q : base.q,
    includeCompleted: input.includeCompleted !== undefined ? parseBooleanFlag(input.includeCompleted) : base.includeCompleted
  };
}

function mapTransactionTask(task: TaskWithRelations): OfficeTransactionTask {
  const transactionLabel = buildTransactionObjectLabel(task.transaction);
  const workflowEvidence = getTaskWorkflowEvidence(task);
  const linkedForms = getTaskLinkedForms(task);
  const statusPresentation = deriveTaskStatusPresentation(task, workflowEvidence);
  const canRequestReview =
    taskNeedsReview(task) &&
    task.status !== "completed" &&
    task.reviewStatus !== "review_requested" &&
    task.reviewStatus !== "second_review" &&
    task.reviewStatus !== "approved" &&
    workflowEvidence.hasAnyLinkedDocument &&
    (!workflowEvidence.hasAnySignatureRequest || workflowEvidence.allSignatureRequestsSigned);
  const canComplete =
    task.status !== "completed" &&
    (!taskRequiresDocumentWorkflow(task) || workflowEvidence.hasAnyLinkedDocument) &&
    (!workflowEvidence.hasAnySignatureRequest || workflowEvidence.allSignatureRequestsSigned) &&
    (!taskNeedsReview(task) || task.reviewStatus === "approved");
  const canApprove =
    taskNeedsReview(task) &&
    (task.reviewStatus === "review_requested" || task.reviewStatus === "second_review");

  return {
    id: task.id,
    transactionId: task.transactionId,
    transactionHref: `/office/transactions/${task.transactionId}#transaction-task-${task.id}`,
    transactionLabel,
    transactionStatus: transactionStatusLabelMap[task.transaction.status],
    checklistGroup: task.checklistGroup,
    title: task.title,
    description: task.description ?? "",
    assigneeMembershipId: task.assigneeMembershipId,
    assigneeName: formatMembershipName(task.assigneeMembership),
    ownerName: formatMembershipName(task.transaction.ownerMembership),
    dueAt: formatDateValue(task.dueAt),
    status: taskStatusLabelMap[task.status],
    reviewStatus: reviewStatusLabelMap[task.reviewStatus],
    complianceStatus: complianceStatusLabelMap[task.complianceStatus],
    taskStatusLabel: statusPresentation.label,
    taskStatusTone: statusPresentation.tone,
    sortOrder: task.sortOrder,
    requiresDocument: task.requiresDocument,
    requiresDocumentApproval: task.requiresDocumentApproval,
    requiresSecondaryApproval: task.requiresSecondaryApproval,
    completedAt: formatDateTimeValue(task.completedAt),
    completedByName: formatMembershipName(task.completedByMembership, ""),
    completedByMembershipId: task.completedByMembershipId,
    submittedForReviewAt: formatDateTimeValue(task.submittedForReviewAt),
    submittedForReviewByName: formatMembershipName(task.submittedForReviewByMembership, ""),
    submittedForReviewByMembershipId: task.submittedForReviewByMembershipId,
    firstApprovedAt: formatDateTimeValue(task.firstApprovedAt),
    firstApprovedByName: formatMembershipName(task.firstApprovedByMembership, ""),
    firstApprovedByMembershipId: task.firstApprovedByMembershipId,
    secondApprovedAt: formatDateTimeValue(task.secondApprovedAt),
    secondApprovedByName: formatMembershipName(task.secondApprovedByMembership, ""),
    secondApprovedByMembershipId: task.secondApprovedByMembershipId,
    rejectedAt: formatDateTimeValue(task.rejectedAt),
    rejectedByName: formatMembershipName(task.rejectedByMembership, ""),
    rejectedByMembershipId: task.rejectedByMembershipId,
    rejectionReason: task.rejectionReason ?? "",
    reopenedAt: formatDateTimeValue(task.reopenedAt),
    updatedAt: formatDateTimeValue(task.updatedAt),
    linkedDocuments: workflowEvidence.linkedDocuments,
    linkedForms,
    awaitingSecondaryApproval: task.reviewStatus === "second_review",
    canCompleteDirectly: canComplete,
    canRequestReview,
    canApprove,
    canReject: canApprove,
    canReopen:
      task.status === "completed" ||
      task.status === "review_requested" ||
      task.reviewStatus === "rejected" ||
      task.reviewStatus === "approved"
  };
}

function getDocumentApprovalQueueState(
  task: TaskWithRelations,
  evidence: TaskWorkflowEvidence
): OfficeDocumentApprovalQueueState | null {
  if (!taskRequiresDocumentWorkflow(task) || task.status === "completed") {
    return null;
  }

  if (task.reviewStatus === "second_review") {
    return "awaiting_second_review";
  }

  if (task.reviewStatus === "review_requested") {
    return "awaiting_my_review";
  }

  if (task.reviewStatus === "rejected" || task.complianceStatus === "rejected") {
    return "rejected";
  }

  if (evidence.hasPendingSignature || (evidence.hasAnySignatureRequest && !evidence.allSignatureRequestsSigned)) {
    return "waiting_for_signatures";
  }

  if (!evidence.hasAnyLinkedDocument) {
    return "missing_required_document";
  }

  return null;
}

function matchesDocumentApprovalQueueView(
  item: Pick<OfficeDocumentApprovalQueueItem, "queueState" | "task">,
  view: OfficeDocumentApprovalQueueView,
  actorContext: {
    membershipId: string;
    canSecondaryReviewTasks: boolean;
  }
) {
  if (view === "all_open_review_items") {
    return true;
  }

  if (view === "awaiting_my_review") {
    if (!item.task.canApprove) {
      return false;
    }

    if (item.queueState === "awaiting_second_review") {
      return (
        item.task.firstApprovedByMembershipId !== actorContext.membershipId &&
        actorContext.canSecondaryReviewTasks
      );
    }

    return item.queueState === "awaiting_my_review";
  }

  return item.queueState === view;
}

function pluralizeQueueArtifact(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildDocumentApprovalArtifactCountLabel(task: OfficeTransactionTask) {
  const parts: string[] = [];

  if (task.linkedDocuments.length) {
    parts.push(pluralizeQueueArtifact(task.linkedDocuments.length, "document", "documents"));
  }

  if (task.linkedForms.length) {
    parts.push(pluralizeQueueArtifact(task.linkedForms.length, "form", "forms"));
  }

  return parts.join(" · ");
}

function buildDocumentApprovalFormStatusLabel(task: OfficeTransactionTask) {
  const labels = Array.from(new Set(task.linkedForms.map((form) => form.status)));
  return labels.slice(0, 2).join(", ");
}

function buildDocumentApprovalSignatureStatusLabel(task: TaskWithRelations, evidence: TaskWorkflowEvidence) {
  if (!evidence.hasAnySignatureRequest) {
    return "";
  }

  if (evidence.hasDeclinedSignature) {
    return "Declined / canceled";
  }

  if (evidence.hasPendingSignature) {
    return "Waiting for signatures";
  }

  if (evidence.allSignatureRequestsSigned) {
    return "Fully signed";
  }

  const formStatuses = Array.from(new Set(getTaskLinkedForms(task).map((form) => form.signatureStatus)));
  return formStatuses[0] ?? "Signature activity";
}

function getDocumentApprovalPrimaryArtifact(task: OfficeTransactionTask) {
  const firstForm = task.linkedForms[0] ?? null;

  if (firstForm) {
    return {
      primaryArtifactKind: "form" as const,
      primaryArtifactTitle: firstForm.name,
      secondaryArtifactTitle: firstForm.documentTitle ? `Document: ${firstForm.documentTitle}` : "",
      openDocumentHref: firstForm.documentFileHref || task.linkedDocuments[0]?.fileHref || null
    };
  }

  const firstDocument = task.linkedDocuments[0] ?? null;

  if (firstDocument) {
    return {
      primaryArtifactKind: "document" as const,
      primaryArtifactTitle: firstDocument.title,
      secondaryArtifactTitle: `Document status: ${firstDocument.status}`,
      openDocumentHref: firstDocument.fileHref
    };
  }

  return {
    primaryArtifactKind: "missing" as const,
    primaryArtifactTitle: "No linked document yet",
    secondaryArtifactTitle: "",
    openDocumentHref: null
  };
}

function getQueueReferenceTime(task: OfficeDocumentApprovalQueueItem) {
  if (task.task.submittedForReviewAt) {
    return new Date(task.task.submittedForReviewAt).getTime();
  }

  if (task.task.dueAt) {
    return new Date(`${task.task.dueAt}T00:00:00.000Z`).getTime();
  }

  return new Date(task.task.updatedAt).getTime();
}

function sortDocumentApprovalQueue(items: OfficeDocumentApprovalQueueItem[]) {
  const queuePriority: Record<OfficeDocumentApprovalQueueState, number> = {
    awaiting_my_review: 0,
    awaiting_second_review: 1,
    rejected: 2,
    waiting_for_signatures: 3,
    missing_required_document: 4
  };

  return [...items].sort((left, right) => {
    const priorityDelta = queuePriority[left.queueState] - queuePriority[right.queueState];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const leftReference = getQueueReferenceTime(left);
    const rightReference = getQueueReferenceTime(right);

    if (leftReference !== rightReference) {
      return leftReference - rightReference;
    }

    return left.task.transactionLabel.localeCompare(right.task.transactionLabel);
  });
}

async function getTransactionScope(organizationId: string, transactionId: string) {
  return prisma.transaction.findFirst({
    where: {
      id: transactionId,
      organizationId
    },
    select: {
      id: true,
      officeId: true,
      title: true,
      address: true,
      city: true,
      state: true
    }
  });
}

async function validateAssigneeMembership(
  organizationId: string,
  officeId: string | null,
  assigneeMembershipId: string | undefined
) {
  const trimmedMembershipId = assigneeMembershipId?.trim();

  if (!trimmedMembershipId) {
    return null;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      id: trimmedMembershipId,
      organizationId,
      status: "active",
      ...(officeId ? { officeId } : {}),
      role: {
        in: ["agent", "office_manager", "office_admin"] satisfies UserRole[]
      }
    },
    select: {
      id: true
    }
  });

  return membership?.id ?? null;
}

async function getTaskRecord(organizationId: string, transactionId: string, taskId: string) {
  return prisma.transactionTask.findFirst({
    where: {
      id: taskId,
      organizationId,
      transactionId
    },
    include: transactionTaskInclude
  });
}

function getTaskWorkflowResetState(requiresReview: boolean) {
  return {
    reviewStatus: deriveDefaultReviewStatus(requiresReview),
    complianceStatus: deriveDefaultComplianceStatus(requiresReview),
    submittedForReviewAt: null,
    submittedForReviewByMembershipId: null,
    firstApprovedAt: null,
    firstApprovedByMembershipId: null,
    secondApprovedAt: null,
    secondApprovedByMembershipId: null,
    rejectedAt: null,
    rejectedByMembershipId: null,
    rejectionReason: null
  };
}

function sortOfficeTasks(tasks: OfficeTransactionTask[]) {
  return [...tasks].sort((left, right) => {
    const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;

    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    if (left.transactionLabel !== right.transactionLabel) {
      return left.transactionLabel.localeCompare(right.transactionLabel);
    }

    if (left.checklistGroup !== right.checklistGroup) {
      return left.checklistGroup.localeCompare(right.checklistGroup);
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.title.localeCompare(right.title);
  });
}

function buildTaskAuditPayload(
  task: TaskWithRelations,
  details: string[],
  changes: Array<{ label: string; previousValue?: string | null; nextValue?: string | null }>,
  options?: {
    actionSource?: TransactionTaskAuditSource | null;
    workflowReason?: string | null;
  }
) {
  return {
    officeId: task.transaction.officeId,
    transactionId: task.transactionId,
    taskId: task.id,
    taskTitle: task.title,
    objectLabel: buildTaskObjectLabel(task.title, buildTransactionObjectLabel(task.transaction)),
    actionSource: options?.actionSource ?? undefined,
    workflowReason: options?.workflowReason ?? undefined,
    details,
    changes
  };
}

async function createTaskAuditEvent(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    actorMembershipId?: string | null;
    action: (typeof activityLogActions)[keyof typeof activityLogActions];
    task: TaskWithRelations;
    details: string[];
    changes?: Array<{ label: string; previousValue?: string | null; nextValue?: string | null }>;
    actionSource?: TransactionTaskAuditSource | null;
    workflowReason?: string | null;
  }
) {
  await recordActivityLogEvent(tx, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId ?? null,
    entityType: "transaction_task",
    entityId: input.task.id,
    action: input.action,
    payload: buildTaskAuditPayload(input.task, input.details, input.changes ?? [], {
      actionSource: input.actionSource ?? null,
      workflowReason: input.workflowReason ?? null
    })
  });
}

function getDbTaskStatusLabel(status: TransactionTaskStatus) {
  return taskStatusLabelMap[status];
}

function canTaskRequestReview(task: TaskWithRelations, evidence: TaskWorkflowEvidence) {
  return (
    taskNeedsReview(task) &&
    task.status !== "completed" &&
    task.reviewStatus !== "review_requested" &&
    task.reviewStatus !== "second_review" &&
    task.reviewStatus !== "approved" &&
    evidence.hasAnyLinkedDocument &&
    (!evidence.hasAnySignatureRequest || evidence.allSignatureRequestsSigned)
  );
}

function canTaskComplete(task: TaskWithRelations, evidence: TaskWorkflowEvidence) {
  if (task.status === "completed") {
    return false;
  }

  if (taskRequiresDocumentWorkflow(task) && !evidence.hasAnyLinkedDocument) {
    return false;
  }

  if (evidence.hasAnySignatureRequest && !evidence.allSignatureRequestsSigned) {
    return false;
  }

  if (taskNeedsReview(task) && task.reviewStatus !== "approved") {
    return false;
  }

  return true;
}

function getTaskMissingWorkflowReason(task: TaskWithRelations, evidence: TaskWorkflowEvidence) {
  if (taskRequiresDocumentWorkflow(task) && !evidence.hasAnyLinkedDocument) {
    return "A required document has not been attached.";
  }

  if (taskNeedsReview(task) && !evidence.hasSubmittedDocument) {
    return "Submit the linked document for review before continuing.";
  }

  if (evidence.hasPendingSignature) {
    return "Signature requests are still pending.";
  }

  if (evidence.hasAnySignatureRequest && !evidence.allSignatureRequestsSigned) {
    return "All required signatures must be completed first.";
  }

  if (taskNeedsReview(task) && task.reviewStatus !== "approved") {
    return "This task requires review before it can be completed.";
  }

  return null;
}

function getTaskWorkflowInvalidationReason(task: TaskWithRelations, evidence: TaskWorkflowEvidence) {
  if (taskRequiresDocumentWorkflow(task) && !evidence.hasAnyLinkedDocument) {
    return {
      workflowReason: "missing_required_document",
      detail: "Missing required document caused reopen"
    };
  }

  if (taskNeedsReview(task) && !evidence.hasSubmittedDocument) {
    return {
      workflowReason: "review_submission_missing",
      detail: "Submitted document is no longer available for review"
    };
  }

  if (evidence.hasPendingSignature) {
    return {
      workflowReason: "signatures_pending",
      detail: "Pending signatures caused reopen"
    };
  }

  if (evidence.hasAnySignatureRequest && !evidence.allSignatureRequestsSigned) {
    return {
      workflowReason: "signatures_incomplete",
      detail: "Incomplete signatures caused reopen"
    };
  }

  return {
    workflowReason: "document_workflow_invalidated",
    detail: "Document workflow conditions caused reopen"
  };
}

async function syncTaskLinkedDocumentStatuses(
  tx: Prisma.TransactionClient,
  input: {
    taskId: string;
    nextStatus?: TransactionDocumentStatus;
    actorMembershipId?: string | null;
    organizationId: string;
    transactionId: string;
  }
) {
  const linkedDocuments = await tx.transactionDocument.findMany({
    where: {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      linkedTaskId: input.taskId
    },
    include: {
      signatureRequests: true
    }
  });

  if (!linkedDocuments.length || !input.nextStatus) {
    return;
  }

  for (const document of linkedDocuments) {
    const nextStatus =
      document.isSigned || document.signatureRequests.some((request) => request.status === "signed")
        ? document.status
        : input.nextStatus;

    if (nextStatus !== document.status) {
      await tx.transactionDocument.update({
        where: {
          id: document.id
        },
        data: {
          status: nextStatus
        }
      });
    }
  }
}

export async function reconcileTransactionTaskDocumentWorkflow(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    transactionId: string;
    taskId: string;
    actorMembershipId?: string | null;
    reason: string;
  }
) {
  const existingTask = await tx.transactionTask.findFirst({
    where: {
      id: input.taskId,
      organizationId: input.organizationId,
      transactionId: input.transactionId
    },
    include: transactionTaskInclude
  });

  if (!existingTask || !taskRequiresDocumentWorkflow(existingTask)) {
    return null;
  }

  const evidence = getTaskWorkflowEvidence(existingTask);
  const workflowCommitted =
    existingTask.status === "completed" ||
    existingTask.reviewStatus !== "pending" && existingTask.reviewStatus !== "not_required";
  const shouldInvalidate =
    workflowCommitted &&
    (!evidence.hasAnyLinkedDocument ||
    (taskNeedsReview(existingTask) && !evidence.hasSubmittedDocument) ||
    evidence.hasPendingSignature ||
    (evidence.hasAnySignatureRequest && !evidence.allSignatureRequestsSigned));

  if (!shouldInvalidate) {
    return mapTransactionTask(existingTask);
  }

  const resetState = getTaskWorkflowResetState(taskNeedsReview(existingTask));
  const invalidation = getTaskWorkflowInvalidationReason(existingTask, evidence);
  const nextStatus: TransactionTaskStatus = existingTask.status === "todo" ? "todo" : "reopened";
  const reopenedAt = new Date();

  const updated = await tx.transactionTask.update({
    where: {
      id: existingTask.id
    },
    data: {
      status: nextStatus,
      reviewStatus: resetState.reviewStatus,
      complianceStatus: resetState.complianceStatus,
      completedAt: null,
      completedByMembershipId: null,
      submittedForReviewAt: resetState.submittedForReviewAt,
      submittedForReviewByMembershipId: resetState.submittedForReviewByMembershipId,
      firstApprovedAt: resetState.firstApprovedAt,
      firstApprovedByMembershipId: resetState.firstApprovedByMembershipId,
      secondApprovedAt: resetState.secondApprovedAt,
      secondApprovedByMembershipId: resetState.secondApprovedByMembershipId,
      rejectedAt: resetState.rejectedAt,
      rejectedByMembershipId: resetState.rejectedByMembershipId,
      rejectionReason: resetState.rejectionReason,
      reopenedAt
    },
    include: transactionTaskInclude
  });

  await createTaskAuditEvent(tx, {
    organizationId: input.organizationId,
    actorMembershipId: input.actorMembershipId ?? null,
    action: activityLogActions.transactionTaskReopened,
    task: updated,
    workflowReason: invalidation.workflowReason,
    details: [
      input.reason,
      invalidation.detail,
      "Task reopened because required workflow conditions are no longer satisfied"
    ],
    changes: [
      buildTaskChange("Workflow status", getDbTaskStatusLabel(existingTask.status), getDbTaskStatusLabel(updated.status)),
      buildTaskChange("Review status", reviewStatusLabelMap[existingTask.reviewStatus], reviewStatusLabelMap[updated.reviewStatus]),
      buildTaskChange("Compliance status", complianceStatusLabelMap[existingTask.complianceStatus], complianceStatusLabelMap[updated.complianceStatus])
    ].filter((change): change is NonNullable<typeof change> => Boolean(change))
  });

  return mapTransactionTask(updated);
}

export async function listTransactionTasks(organizationId: string, transactionId: string): Promise<OfficeTransactionTask[]> {
  const tasks = await prisma.transactionTask.findMany({
    where: {
      organizationId,
      transactionId
    },
    include: transactionTaskInclude,
    orderBy: [{ checklistGroup: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return tasks.map(mapTransactionTask);
}

export async function listTransactionTaskAssigneeOptions(
  organizationId: string,
  transactionId: string
): Promise<OfficeTransactionTaskAssigneeOption[]> {
  const transaction = await getTransactionScope(organizationId, transactionId);

  if (!transaction) {
    return [];
  }

  return listOfficeTaskAssigneeOptions(organizationId, transaction.officeId);
}

export async function listOfficeTaskAssigneeOptions(
  organizationId: string,
  officeId?: string | null
): Promise<OfficeTransactionTaskAssigneeOption[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId,
      status: "active",
      ...(officeId ? { officeId } : {}),
      role: {
        in: ["agent", "office_manager", "office_admin"] satisfies UserRole[]
      }
    },
    include: {
      user: true
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }]
  });

  return memberships.map((membership) => ({
    id: membership.id,
    label: `${membership.user.firstName} ${membership.user.lastName}`
  }));
}

export async function listOfficeTaskTransactionOptions(
  organizationId: string,
  officeId?: string | null
): Promise<OfficeTaskTransactionOption[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      ...(officeId ? { officeId } : {}),
      status: {
        in: ["opportunity", "active", "pending"]
      }
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      address: true,
      city: true,
      state: true,
      status: true
    }
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    label: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`,
    status: transactionStatusLabelMap[transaction.status]
  }));
}

export async function listTaskListViews(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
}): Promise<OfficeTaskListView[]> {
  const systemViews = buildBuiltInTaskViews(input.membershipId);
  const customViews = await prisma.taskListView.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      OR: input.officeId ? [{ officeId: input.officeId }, { officeId: null }] : [{ officeId: null }, { officeId: input.officeId ?? null }]
    },
    orderBy: [{ name: "asc" }]
  });

  return [
    ...systemViews,
    ...customViews.map((view) => {
      const fallback = systemTaskViewDefinitions["all-transactions"].getFilters(input.membershipId);

      return {
        id: view.id,
        key: view.id,
        name: view.name,
        isSystem: view.isSystem,
        isShared: view.isShared,
        filters: sanitizePersistedFilters(view.filters, fallback),
        visibleColumns: sanitizeVisibleColumns(view.visibleColumns, systemTaskViewDefinitions["all-transactions"].visibleColumns),
        sort: sanitizeSort(view.sort)
      };
    })
  ];
}

export async function listOfficeTasks(input: ListOfficeTasksInput): Promise<OfficeTaskListSnapshot> {
  const limit = input.limit ?? defaultTaskListLimit;
  const viewOptions = await listTaskListViews({
    organizationId: input.organizationId,
    officeId: input.officeId,
    membershipId: input.membershipId
  });
  const selectedView =
    viewOptions.find((view) => view.key === input.view || view.id === input.view) ??
    viewOptions.find((view) => view.key === "requires-attention") ??
    viewOptions[0];
  const filters = mergeFilterOverrides(selectedView.filters, input);

  const transactionWhere: Prisma.TransactionWhereInput = {
    ...(input.officeId ? { officeId: input.officeId } : {})
  };
  const where: Prisma.TransactionTaskWhereInput = {
    organizationId: input.organizationId,
    transaction: transactionWhere
  };

  if (filters.transactionStatus && filters.transactionStatus !== "All") {
    const mappedStatus = transactionStatusDbMap[filters.transactionStatus];

    if (mappedStatus) {
      transactionWhere.status = mappedStatus;
    }
  }

  if (filters.assigneeMembershipId) {
    where.assigneeMembershipId = filters.assigneeMembershipId;
  }

  if (!filters.includeCompleted) {
    where.status = {
      not: "completed"
    };
  }

  if (filters.transactionId) {
    where.transactionId = filters.transactionId;
  }

  if (filters.noDueDate) {
    where.dueAt = null;
  } else if (filters.dueWindow === "past_due") {
    where.dueAt = {
      lt: getDueDateLowerBound(filters.dueWindow) ?? undefined
    };
  } else if (filters.dueWindow) {
    where.dueAt = {
      lte: getDueDateUpperBound(filters.dueWindow) ?? undefined
    };
  }

  if (filters.complianceStatuses.length) {
    where.complianceStatus = {
      in: filters.complianceStatuses.map((status) => complianceStatusDbMap[status])
    };
  }

  if (filters.reviewStatus) {
    const mappedReviewStatuses = getDbReviewStatuses(filters.reviewStatus);

    if (mappedReviewStatuses.length) {
      where.reviewStatus = {
        in: mappedReviewStatuses
      };
    }
  }

  if (filters.requiresSecondaryApproval) {
    where.requiresSecondaryApproval = true;
  }

  if (filters.q.trim()) {
    const query = filters.q.trim();
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { checklistGroup: { contains: query, mode: "insensitive" } },
      {
        transaction: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { address: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } }
          ]
        }
      },
      {
        assigneeMembership: {
          user: {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } }
            ]
          }
        }
      }
    ];
  }

  const [tasks, assigneeOptions, transactionOptions] = await Promise.all([
    prisma.transactionTask.findMany({
      where,
      include: transactionTaskInclude
    }),
    listOfficeTaskAssigneeOptions(input.organizationId, input.officeId),
    listOfficeTaskTransactionOptions(input.organizationId, input.officeId)
  ]);

  const mappedTasks = sortOfficeTasks(tasks.map(mapTransactionTask)).slice(0, limit);
  const now = startOfDay(new Date());
  const summary = mappedTasks.reduce(
    (accumulator, task) => {
      if (task.taskStatusLabel === "Review requested" || task.taskStatusLabel === "Second review requested") {
        accumulator.reviewQueueCount += 1;
      }

      if (task.taskStatusLabel === "Complete") {
        accumulator.completedCount += 1;
      }

      if (task.dueAt) {
        const dueDate = new Date(`${task.dueAt}T00:00:00.000Z`);

        if (dueDate < now && task.taskStatusLabel !== "Complete") {
          accumulator.overdueCount += 1;
        } else {
          const dueSoonBoundary = endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

          if (dueDate <= dueSoonBoundary && task.taskStatusLabel !== "Complete") {
            accumulator.dueSoonCount += 1;
          }
        }
      }

      return accumulator;
    },
    {
      overdueCount: 0,
      dueSoonCount: 0,
      reviewQueueCount: 0,
      completedCount: 0
    }
  );

  return {
    selectedViewKey: selectedView.key,
    selectedViewName: selectedView.name,
    filters,
    visibleColumns: selectedView.visibleColumns,
    sort: selectedView.sort,
    tasks: mappedTasks,
    taskCount: mappedTasks.length,
    maxWindowLabel: `Showing up to ${limit} tasks`,
    summary,
    viewOptions,
    assigneeOptions,
    transactionOptions
  };
}

export async function listOfficeDocumentApprovalQueue(
  input: ListOfficeDocumentApprovalQueueInput
): Promise<OfficeDocumentApprovalQueueSnapshot> {
  const limit = input.limit ?? defaultDocumentApprovalQueueLimit;
  const actorContext = {
    membershipId: input.membershipId,
    canSecondaryReviewTasks: input.canSecondaryReviewTasks ?? false
  };
  const filters: OfficeDocumentApprovalQueueFilters = {
    queue: normalizeDocumentApprovalQueueView(input.queue),
    assigneeMembershipId: typeof input.assigneeMembershipId === "string" ? input.assigneeMembershipId : "",
    dueWindow:
      input.dueWindow === "past_due" ||
      input.dueWindow === "today" ||
      input.dueWindow === "current_week" ||
      input.dueWindow === "next_week" ||
      input.dueWindow === "next_2_weeks"
        ? input.dueWindow
        : "",
    q: typeof input.q === "string" ? input.q : ""
  };
  const transactionWhere: Prisma.TransactionWhereInput = {
    ...(input.officeId ? { officeId: input.officeId } : {})
  };
  const whereClauses: Prisma.TransactionTaskWhereInput[] = [
    {
      OR: [{ requiresDocument: true }, { requiresDocumentApproval: true }, { requiresSecondaryApproval: true }]
    }
  ];
  const where: Prisma.TransactionTaskWhereInput = {
    organizationId: input.organizationId,
    transaction: transactionWhere,
    status: {
      not: "completed"
    },
    AND: whereClauses
  };

  if (filters.assigneeMembershipId) {
    where.assigneeMembershipId = filters.assigneeMembershipId;
  }

  if (filters.dueWindow === "past_due") {
    where.dueAt = {
      lt: getDueDateLowerBound(filters.dueWindow) ?? undefined
    };
  } else if (filters.dueWindow) {
    where.dueAt = {
      lte: getDueDateUpperBound(filters.dueWindow) ?? undefined
    };
  }

  if (filters.q.trim()) {
    const query = filters.q.trim();
    whereClauses.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { checklistGroup: { contains: query, mode: "insensitive" } },
        {
          transaction: {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { address: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
              { state: { contains: query, mode: "insensitive" } }
            ]
          }
        },
        {
          assigneeMembership: {
            user: {
              OR: [
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } }
              ]
            }
          }
        },
        {
          documents: {
            some: {
              title: { contains: query, mode: "insensitive" }
            }
          }
        },
        {
          forms: {
            some: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                {
                  document: {
                    is: {
                      title: { contains: query, mode: "insensitive" }
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    });
  }

  const [tasks, assigneeOptions] = await Promise.all([
    prisma.transactionTask.findMany({
      where,
      include: transactionTaskInclude
    }),
    listOfficeTaskAssigneeOptions(input.organizationId, input.officeId)
  ]);

  const queueItems = tasks.flatMap((task) => {
    const evidence = getTaskWorkflowEvidence(task);
    const queueState = getDocumentApprovalQueueState(task, evidence);

    if (!queueState) {
      return [];
    }

    const mappedTask = mapTransactionTask(task);
    const primaryArtifact = getDocumentApprovalPrimaryArtifact(mappedTask);

    return [
      {
        task: mappedTask,
        queueState,
        queueStateLabel: documentApprovalQueueStateLabels[queueState],
        primaryArtifactKind: primaryArtifact.primaryArtifactKind,
        primaryArtifactTitle: primaryArtifact.primaryArtifactTitle,
        secondaryArtifactTitle: primaryArtifact.secondaryArtifactTitle,
        openDocumentHref: primaryArtifact.openDocumentHref,
        artifactCountLabel: buildDocumentApprovalArtifactCountLabel(mappedTask),
        formStatusLabel: buildDocumentApprovalFormStatusLabel(mappedTask),
        signatureStatusLabel: buildDocumentApprovalSignatureStatusLabel(task, evidence)
      } satisfies OfficeDocumentApprovalQueueItem
    ];
  });
  const summary = queueItems.reduce<OfficeDocumentApprovalQueueSummary>(
    (accumulator, item) => {
      accumulator.all_open_review_items += 1;
      if (matchesDocumentApprovalQueueView(item, "awaiting_my_review", actorContext)) {
        accumulator.awaiting_my_review += 1;
      }

      if (item.queueState === "awaiting_second_review") {
        accumulator.awaiting_second_review += 1;
      }

      if (item.queueState === "rejected") {
        accumulator.rejected += 1;
      }

      if (item.queueState === "waiting_for_signatures") {
        accumulator.waiting_for_signatures += 1;
      }

      if (item.queueState === "missing_required_document") {
        accumulator.missing_required_document += 1;
      }

      return accumulator;
    },
    {
      all_open_review_items: 0,
      awaiting_my_review: 0,
      awaiting_second_review: 0,
      rejected: 0,
      waiting_for_signatures: 0,
      missing_required_document: 0
    }
  );
  const visibleItems = sortDocumentApprovalQueue(
    queueItems.filter((item) => matchesDocumentApprovalQueueView(item, filters.queue, actorContext))
  ).slice(0, limit);

  return {
    filters,
    selectedQueueLabel: documentApprovalQueueViewLabels[filters.queue],
    summary,
    items: visibleItems,
    itemCount: visibleItems.length,
    assigneeOptions,
    maxWindowLabel: `Showing up to ${limit} queue items`
  };
}

export async function saveTaskListView(input: SaveTaskListViewInput): Promise<OfficeTaskListView | null> {
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    return null;
  }

  const view = await prisma.taskListView.upsert({
    where: {
      organizationId_membershipId_name: {
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        name: trimmedName
      }
    },
    update: {
      officeId: input.officeId ?? null,
      isShared: input.isShared ?? false,
      filters: input.filters,
      visibleColumns: input.visibleColumns ?? systemTaskViewDefinitions["all-transactions"].visibleColumns,
      sort: input.sort ?? defaultTaskSort
    },
    create: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      membershipId: input.membershipId,
      name: trimmedName,
      isSystem: false,
      isShared: input.isShared ?? false,
      filters: input.filters,
      visibleColumns: input.visibleColumns ?? systemTaskViewDefinitions["all-transactions"].visibleColumns,
      sort: input.sort ?? defaultTaskSort
    }
  });

  return {
    id: view.id,
    key: view.id,
    name: view.name,
    isSystem: view.isSystem,
    isShared: view.isShared,
    filters: sanitizePersistedFilters(view.filters, systemTaskViewDefinitions["all-transactions"].getFilters(input.membershipId)),
    visibleColumns: sanitizeVisibleColumns(view.visibleColumns, systemTaskViewDefinitions["all-transactions"].visibleColumns),
    sort: sanitizeSort(view.sort)
  };
}

export async function createTransactionTask(input: CreateTransactionTaskInput): Promise<OfficeTransactionTask | null> {
  const transaction = await prisma.transaction.findFirst({
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
  });

  if (!transaction) {
    return null;
  }

  const title = input.title.trim();

  if (!title) {
    return null;
  }

  const assigneeMembershipId = await validateAssigneeMembership(input.organizationId, transaction.officeId, input.assigneeMembershipId);
  const sortAggregate = await prisma.transactionTask.aggregate({
    where: {
      organizationId: input.organizationId,
      transactionId: input.transactionId
    },
    _max: {
      sortOrder: true
    }
  });
  const flags = normalizeTaskFlags(
    {
      requiresDocument: false,
      requiresDocumentApproval: false,
      requiresSecondaryApproval: false
    },
    {
      requiresDocument: input.requiresDocument,
      requiresDocumentApproval: input.requiresDocumentApproval,
      requiresSecondaryApproval: input.requiresSecondaryApproval
    }
  );
  const requiresReview = taskNeedsReview(flags);
  const normalizedStatus = normalizeTaskStatus(input.status);
  const dbStatus =
    requiresReview && normalizedStatus === "Completed"
      ? "todo"
      : taskStatusDbMap[normalizedStatus];

  const createdTask = await prisma.$transaction(async (tx) => {
    const created = await tx.transactionTask.create({
      data: {
        organizationId: input.organizationId,
        transactionId: input.transactionId,
        checklistGroup: normalizeChecklistGroup(input.checklistGroup),
        title,
        description: parseOptionalText(input.description),
        assigneeMembershipId,
        dueAt: parseOptionalDate(input.dueAt),
        status: dbStatus,
        requiresDocument: flags.requiresDocument,
        requiresDocumentApproval: flags.requiresDocumentApproval,
        requiresSecondaryApproval: flags.requiresSecondaryApproval,
        reviewStatus: deriveDefaultReviewStatus(requiresReview),
        complianceStatus: deriveDefaultComplianceStatus(requiresReview),
        completedAt: dbStatus === "completed" && !requiresReview ? new Date() : null,
        completedByMembershipId: dbStatus === "completed" && !requiresReview ? input.actorMembershipId ?? null : null,
        sortOrder: (sortAggregate._max.sortOrder ?? -1) + 1
      },
      include: transactionTaskInclude
    });

    await createTaskAuditEvent(tx, {
      organizationId: input.organizationId,
      actorMembershipId: input.actorMembershipId ?? null,
      action: activityLogActions.transactionTaskCreated,
      task: created,
      details: [
        `Group: ${created.checklistGroup}`,
        `Task status: ${deriveTaskStatusPresentation(created, getTaskWorkflowEvidence(created)).label}`,
        ...(created.dueAt ? [`Due: ${formatDateValue(created.dueAt)}`] : []),
        ...(created.requiresDocument ? ["Requires document: Yes"] : []),
        ...(created.requiresDocumentApproval ? ["Requires review: Yes"] : []),
        ...(created.requiresSecondaryApproval ? ["Secondary review: Yes"] : [])
      ]
    });

    return created;
  });

  return mapTransactionTask(createdTask);
}

export async function updateTransactionTask(input: UpdateTransactionTaskInput): Promise<OfficeTransactionTask | null> {
  const existingTask = await getTaskRecord(input.organizationId, input.transactionId, input.taskId);

  if (!existingTask) {
    return null;
  }

  const assigneeMembershipId =
    input.assigneeMembershipId !== undefined
      ? await validateAssigneeMembership(input.organizationId, existingTask.transaction.officeId, input.assigneeMembershipId)
      : undefined;
  const nextChecklistGroup = input.checklistGroup !== undefined ? normalizeChecklistGroup(input.checklistGroup) : existingTask.checklistGroup;
  const nextTitle = input.title !== undefined ? input.title.trim() || "Untitled task" : existingTask.title;
  const nextDescription = input.description !== undefined ? parseOptionalText(input.description) : existingTask.description;
  const nextDueAt = input.dueAt !== undefined ? parseOptionalDate(input.dueAt) : existingTask.dueAt;
  const nextSortOrder = input.sortOrder !== undefined ? input.sortOrder : existingTask.sortOrder;
  const nextAssigneeMembershipId = input.assigneeMembershipId !== undefined ? assigneeMembershipId : existingTask.assigneeMembershipId;
  const nextFlags = normalizeTaskFlags(existingTask, input);
  const requiresReview = taskNeedsReview(nextFlags);
  const explicitStatus = input.status !== undefined ? taskStatusDbMap[normalizeTaskStatus(input.status)] : existingTask.status;
  const workflowEvidence = getTaskWorkflowEvidence(existingTask);

  if (explicitStatus === "completed") {
    const completionCandidate = {
      ...existingTask,
      requiresDocument: nextFlags.requiresDocument,
      requiresDocumentApproval: nextFlags.requiresDocumentApproval,
      requiresSecondaryApproval: nextFlags.requiresSecondaryApproval
    };
    const completionError = getTaskMissingWorkflowReason(completionCandidate, workflowEvidence);

    if (completionError) {
      throw new Error(completionError);
    }
  }

  let nextStatus = explicitStatus;
  let nextReviewStatus = existingTask.reviewStatus;
  let nextComplianceStatus = existingTask.complianceStatus;
  let completedAt = existingTask.completedAt;
  let completedByMembershipId = existingTask.completedByMembershipId;
  let submittedForReviewAt = existingTask.submittedForReviewAt;
  let submittedForReviewByMembershipId = existingTask.submittedForReviewByMembershipId;
  let firstApprovedAt = existingTask.firstApprovedAt;
  let firstApprovedByMembershipId = existingTask.firstApprovedByMembershipId;
  let secondApprovedAt = existingTask.secondApprovedAt;
  let secondApprovedByMembershipId = existingTask.secondApprovedByMembershipId;
  let rejectedAt = existingTask.rejectedAt;
  let rejectedByMembershipId = existingTask.rejectedByMembershipId;
  let rejectionReason = existingTask.rejectionReason;
  let reopenedAt = existingTask.reopenedAt;

  if (!requiresReview) {
    nextReviewStatus = "not_required";
    nextComplianceStatus = "not_applicable";
    submittedForReviewAt = null;
    submittedForReviewByMembershipId = null;
    firstApprovedAt = null;
    firstApprovedByMembershipId = null;
    secondApprovedAt = null;
    secondApprovedByMembershipId = null;
    rejectedAt = null;
    rejectedByMembershipId = null;
    rejectionReason = null;
  } else if (existingTask.reviewStatus === "not_required" || input.requiresDocumentApproval !== undefined || input.requiresSecondaryApproval !== undefined) {
    if (nextStatus !== "completed") {
      nextReviewStatus = "pending";
      nextComplianceStatus = "pending";
      submittedForReviewAt = null;
      submittedForReviewByMembershipId = null;
      firstApprovedAt = null;
      firstApprovedByMembershipId = null;
      secondApprovedAt = null;
      secondApprovedByMembershipId = null;
      rejectedAt = null;
      rejectedByMembershipId = null;
      rejectionReason = null;
    }
  }

  if (nextStatus === "review_requested") {
    nextReviewStatus = "review_requested";
    nextComplianceStatus = "in_review";
    submittedForReviewAt = submittedForReviewAt ?? new Date();
    submittedForReviewByMembershipId = submittedForReviewByMembershipId ?? input.actorMembershipId ?? null;
    completedAt = null;
    completedByMembershipId = null;
    rejectedAt = null;
    rejectedByMembershipId = null;
    rejectionReason = null;
  } else if (nextStatus === "reopened") {
    reopenedAt = new Date();
    completedAt = null;
    completedByMembershipId = null;
    const resetState = getTaskWorkflowResetState(requiresReview);
    nextReviewStatus = resetState.reviewStatus;
    nextComplianceStatus = resetState.complianceStatus;
    submittedForReviewAt = resetState.submittedForReviewAt;
    submittedForReviewByMembershipId = resetState.submittedForReviewByMembershipId;
    firstApprovedAt = resetState.firstApprovedAt;
    firstApprovedByMembershipId = resetState.firstApprovedByMembershipId;
    secondApprovedAt = resetState.secondApprovedAt;
    secondApprovedByMembershipId = resetState.secondApprovedByMembershipId;
    rejectedAt = resetState.rejectedAt;
    rejectedByMembershipId = resetState.rejectedByMembershipId;
    rejectionReason = resetState.rejectionReason;
  } else if (nextStatus === "completed") {
    completedAt = completedAt ?? new Date();
    completedByMembershipId = completedByMembershipId ?? input.actorMembershipId ?? null;

    if (!requiresReview) {
      nextReviewStatus = "not_required";
      nextComplianceStatus = "not_applicable";
    }
  } else if (nextStatus === "todo" || nextStatus === "in_progress") {
    completedAt = null;
    completedByMembershipId = null;

    if (requiresReview) {
      nextReviewStatus = "pending";
      nextComplianceStatus = "pending";
    }
  }

  const savedTask = await prisma.$transaction(async (tx) => {
    const saved = await tx.transactionTask.update({
      where: {
        id: input.taskId
      },
      data: {
        checklistGroup: nextChecklistGroup,
        title: nextTitle,
        description: nextDescription,
        assigneeMembershipId: nextAssigneeMembershipId,
        dueAt: nextDueAt,
        status: nextStatus,
        requiresDocument: nextFlags.requiresDocument,
        requiresDocumentApproval: nextFlags.requiresDocumentApproval,
        requiresSecondaryApproval: nextFlags.requiresSecondaryApproval,
        reviewStatus: nextReviewStatus,
        complianceStatus: nextComplianceStatus,
        sortOrder: nextSortOrder,
        completedAt,
        completedByMembershipId,
        submittedForReviewAt,
        submittedForReviewByMembershipId,
        firstApprovedAt,
        firstApprovedByMembershipId,
        secondApprovedAt,
        secondApprovedByMembershipId,
        rejectedAt,
        rejectedByMembershipId,
        rejectionReason,
        reopenedAt
      },
      include: transactionTaskInclude
    });

    const previousAssigneeName = formatMembershipName(existingTask.assigneeMembership);
    const nextAssigneeName = formatMembershipName(saved.assigneeMembership);
    const details = [
      buildTaskDetail("Group", existingTask.checklistGroup, nextChecklistGroup),
      buildTaskDetail("Title", existingTask.title, nextTitle),
      buildTaskDetail("Description", existingTask.description ?? "", nextDescription ?? ""),
      buildTaskDetail("Assignee", previousAssigneeName, nextAssigneeName),
      buildTaskDetail("Due date", formatDateValue(existingTask.dueAt), formatDateValue(nextDueAt)),
      buildTaskDetail("Workflow status", getDbTaskStatusLabel(existingTask.status), getDbTaskStatusLabel(nextStatus)),
      buildTaskDetail("Review status", reviewStatusLabelMap[existingTask.reviewStatus], reviewStatusLabelMap[nextReviewStatus]),
      buildTaskDetail("Compliance status", complianceStatusLabelMap[existingTask.complianceStatus], complianceStatusLabelMap[nextComplianceStatus]),
      buildTaskDetail("Submitted by", formatMembershipName(existingTask.submittedForReviewByMembership), formatMembershipName(saved.submittedForReviewByMembership)),
      buildTaskDetail("Rejection reason", existingTask.rejectionReason ?? "", rejectionReason ?? ""),
      buildTaskDetail("Requires document", existingTask.requiresDocument ? "Yes" : "No", saved.requiresDocument ? "Yes" : "No"),
      buildTaskDetail("Requires document approval", existingTask.requiresDocumentApproval ? "Yes" : "No", saved.requiresDocumentApproval ? "Yes" : "No"),
      buildTaskDetail("Requires secondary approval", existingTask.requiresSecondaryApproval ? "Yes" : "No", saved.requiresSecondaryApproval ? "Yes" : "No"),
      buildTaskDetail("Sort order", String(existingTask.sortOrder), String(nextSortOrder))
    ].filter((detail): detail is string => Boolean(detail));
    const changes = [
      buildTaskChange("Group", existingTask.checklistGroup, nextChecklistGroup),
      buildTaskChange("Title", existingTask.title, nextTitle),
      buildTaskChange("Description", existingTask.description ?? "", nextDescription ?? ""),
      buildTaskChange("Assignee", previousAssigneeName, nextAssigneeName),
      buildTaskChange("Due date", formatDateValue(existingTask.dueAt), formatDateValue(nextDueAt)),
      buildTaskChange("Workflow status", getDbTaskStatusLabel(existingTask.status), getDbTaskStatusLabel(nextStatus)),
      buildTaskChange("Review status", reviewStatusLabelMap[existingTask.reviewStatus], reviewStatusLabelMap[nextReviewStatus]),
      buildTaskChange("Compliance status", complianceStatusLabelMap[existingTask.complianceStatus], complianceStatusLabelMap[nextComplianceStatus]),
      buildTaskChange("Submitted by", formatMembershipName(existingTask.submittedForReviewByMembership), formatMembershipName(saved.submittedForReviewByMembership)),
      buildTaskChange("Rejection reason", existingTask.rejectionReason ?? "", rejectionReason ?? ""),
      buildTaskChange("Requires document", existingTask.requiresDocument ? "Yes" : "No", saved.requiresDocument ? "Yes" : "No"),
      buildTaskChange("Requires document approval", existingTask.requiresDocumentApproval ? "Yes" : "No", saved.requiresDocumentApproval ? "Yes" : "No"),
      buildTaskChange("Requires secondary approval", existingTask.requiresSecondaryApproval ? "Yes" : "No", saved.requiresSecondaryApproval ? "Yes" : "No"),
      buildTaskChange("Sort order", String(existingTask.sortOrder), String(nextSortOrder))
    ].filter((change): change is NonNullable<typeof change> => Boolean(change));

    if (existingTask.status !== "completed" && nextStatus === "completed") {
      await createTaskAuditEvent(tx, {
        organizationId: input.organizationId,
        actorMembershipId: input.actorMembershipId ?? null,
        action: activityLogActions.transactionTaskCompleted,
        task: saved,
        actionSource: input.activitySource ?? null,
        details,
        changes
      });
    } else if (existingTask.status !== "reopened" && nextStatus === "reopened") {
      await createTaskAuditEvent(tx, {
        organizationId: input.organizationId,
        actorMembershipId: input.actorMembershipId ?? null,
        action: activityLogActions.transactionTaskReopened,
        task: saved,
        actionSource: input.activitySource ?? null,
        details,
        changes
      });
    } else if (existingTask.status !== "review_requested" && nextStatus === "review_requested") {
      await createTaskAuditEvent(tx, {
        organizationId: input.organizationId,
        actorMembershipId: input.actorMembershipId ?? null,
        action: activityLogActions.transactionTaskReviewRequested,
        task: saved,
        actionSource: input.activitySource ?? null,
        details,
        changes
      });
    } else if (details.length > 0) {
      await createTaskAuditEvent(tx, {
        organizationId: input.organizationId,
        actorMembershipId: input.actorMembershipId ?? null,
        action: activityLogActions.transactionTaskUpdated,
        task: saved,
        actionSource: input.activitySource ?? null,
        details,
        changes
      });
    }

    return saved;
  });

  return mapTransactionTask(savedTask);
}

export async function completeTransactionTask(input: {
  organizationId: string;
  transactionId: string;
  taskId: string;
  actorMembershipId?: string;
  activitySource?: TransactionTaskAuditSource | null;
}): Promise<OfficeTransactionTask | null> {
  const task = await getTaskRecord(input.organizationId, input.transactionId, input.taskId);

  if (!task) {
    return null;
  }

  const workflowEvidence = getTaskWorkflowEvidence(task);
  const completionError = getTaskMissingWorkflowReason(task, workflowEvidence);

  if (completionError) {
    throw new Error(completionError);
  }

  return updateTransactionTask({
    organizationId: input.organizationId,
    transactionId: input.transactionId,
    taskId: input.taskId,
    actorMembershipId: input.actorMembershipId,
    activitySource: input.activitySource ?? null,
    status: "Completed"
  });
}

export async function reopenTransactionTask(input: {
  organizationId: string;
  transactionId: string;
  taskId: string;
  actorMembershipId?: string;
  activitySource?: TransactionTaskAuditSource | null;
}): Promise<OfficeTransactionTask | null> {
  return updateTransactionTask({
    organizationId: input.organizationId,
    transactionId: input.transactionId,
    taskId: input.taskId,
    actorMembershipId: input.actorMembershipId,
    activitySource: input.activitySource ?? null,
    status: "Reopened"
  });
}

export async function requestTransactionTaskReview(input: {
  organizationId: string;
  transactionId: string;
  taskId: string;
  actorMembershipId?: string;
  activitySource?: TransactionTaskAuditSource | null;
}): Promise<OfficeTransactionTask | null> {
  const task = await getTaskRecord(input.organizationId, input.transactionId, input.taskId);

  if (!task) {
    return null;
  }

  if (!taskNeedsReview(task)) {
    throw new Error("This task does not require review.");
  }

  const evidence = getTaskWorkflowEvidence(task);

  if (!evidence.hasAnyLinkedDocument) {
    throw new Error("Attach a required document before requesting review.");
  }

  if (evidence.hasPendingSignature || (evidence.hasAnySignatureRequest && !evidence.allSignatureRequestsSigned)) {
    throw new Error("All required signatures must be completed before requesting review.");
  }

  const saved = await prisma.$transaction(async (tx) => {
    const now = new Date();
    await syncTaskLinkedDocumentStatuses(tx, {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      taskId: input.taskId,
      actorMembershipId: input.actorMembershipId ?? null,
      nextStatus: "submitted"
    });

    const updated = await tx.transactionTask.update({
      where: {
        id: input.taskId
      },
      data: {
        status: "review_requested",
        reviewStatus: "review_requested",
        complianceStatus: "in_review",
        submittedForReviewAt: now,
        submittedForReviewByMembershipId: input.actorMembershipId ?? null,
        rejectedAt: null,
        rejectedByMembershipId: null,
        rejectionReason: null,
        reopenedAt: null
      },
      include: transactionTaskInclude
    });

    await createTaskAuditEvent(tx, {
      organizationId: input.organizationId,
      actorMembershipId: input.actorMembershipId ?? null,
      action: activityLogActions.transactionTaskReviewRequested,
      task: updated,
      actionSource: input.activitySource ?? null,
      details: [
        `Submitted by: ${formatMembershipName(updated.submittedForReviewByMembership)}`,
        `Linked documents: ${evidence.linkedDocuments.length}`
      ],
      changes: [
        buildTaskChange("Review status", reviewStatusLabelMap[task.reviewStatus], reviewStatusLabelMap[updated.reviewStatus]),
        buildTaskChange("Compliance status", complianceStatusLabelMap[task.complianceStatus], complianceStatusLabelMap[updated.complianceStatus]),
        buildTaskChange("Workflow status", getDbTaskStatusLabel(task.status), getDbTaskStatusLabel(updated.status))
      ].filter((change): change is NonNullable<typeof change> => Boolean(change))
    });

    const reviewerMembershipIds = await listOfficeNotificationRecipientIds(tx, {
      organizationId: input.organizationId,
      officeId: updated.transaction.officeId ?? null,
      group: "task_reviewers",
      excludeMembershipIds: input.actorMembershipId ? [input.actorMembershipId] : [],
      fallbackToExcludedIds: true
    });

    await createNotificationsForMemberships(tx, {
      organizationId: input.organizationId,
      officeId: updated.transaction.officeId ?? null,
      membershipIds: reviewerMembershipIds,
      type: NotificationType.task_review_requested,
      category: NotificationCategory.task,
      severity: NotificationSeverity.info,
      entityType: NotificationEntityType.transaction_task,
      entityId: updated.id,
      title: `Review requested: ${updated.title}`,
      body: `${buildTransactionObjectLabel(updated.transaction)} was submitted for document review.`,
      actionUrl: "/office/approve-docs?queue=awaiting_my_review"
    });

    return updated;
  });

  return mapTransactionTask(saved);
}

export async function approveTransactionTask(input: {
  organizationId: string;
  transactionId: string;
  taskId: string;
  actorMembershipId: string;
  allowSecondaryApproval?: boolean;
  activitySource?: TransactionTaskAuditSource | null;
}): Promise<OfficeTransactionTask | null> {
  const existingTask = await getTaskRecord(input.organizationId, input.transactionId, input.taskId);

  if (!existingTask) {
    return null;
  }

  if (!taskNeedsReview(existingTask)) {
    throw new Error("This task does not require review.");
  }

  if (existingTask.reviewStatus !== "review_requested" && existingTask.reviewStatus !== "second_review") {
    throw new Error("This task is not currently awaiting approval.");
  }

  const workflowEvidence = getTaskWorkflowEvidence(existingTask);

  if (taskRequiresDocumentWorkflow(existingTask) && !workflowEvidence.hasAnyLinkedDocument) {
    throw new Error("A required document is missing.");
  }

  if (workflowEvidence.hasPendingSignature || (workflowEvidence.hasAnySignatureRequest && !workflowEvidence.allSignatureRequestsSigned)) {
    throw new Error("All required signatures must be completed before approval.");
  }

  if (taskNeedsReview(existingTask) && !workflowEvidence.hasSubmittedDocument) {
    throw new Error("Submit the linked document for review before approval.");
  }

  const saved = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const isSecondApprovalRequired = existingTask.requiresSecondaryApproval;
    const isFirstApproval = existingTask.reviewStatus === "review_requested";

    if (isSecondApprovalRequired && !isFirstApproval && !input.allowSecondaryApproval) {
      throw new Error("Secondary approval permission is required.");
    }

    if (isSecondApprovalRequired && existingTask.firstApprovedByMembershipId && existingTask.firstApprovedByMembershipId === input.actorMembershipId) {
      throw new Error("Secondary approval must be completed by a different approver.");
    }

    const updateData: Prisma.TransactionTaskUncheckedUpdateInput = isSecondApprovalRequired && isFirstApproval
      ? {
          firstApprovedAt: now,
          firstApprovedByMembershipId: input.actorMembershipId,
          reviewStatus: "second_review",
          complianceStatus: "in_review",
          status: "review_requested",
          rejectedAt: null,
          rejectedByMembershipId: null,
          rejectionReason: null
        }
      : {
          firstApprovedAt: existingTask.firstApprovedAt ?? now,
          firstApprovedByMembershipId: existingTask.firstApprovedByMembershipId ?? input.actorMembershipId,
          secondApprovedAt: isSecondApprovalRequired ? now : null,
          secondApprovedByMembershipId: isSecondApprovalRequired ? input.actorMembershipId : null,
          reviewStatus: "approved",
          complianceStatus: "approved",
          status: "in_progress",
          completedAt: null,
          completedByMembershipId: null,
          rejectedAt: null,
          rejectedByMembershipId: null,
          rejectionReason: null
        };

    const nextDocumentStatus = isSecondApprovalRequired && isFirstApproval ? "submitted" : "approved";
    await syncTaskLinkedDocumentStatuses(tx, {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      taskId: input.taskId,
      actorMembershipId: input.actorMembershipId,
      nextStatus: nextDocumentStatus
    });

    const updated = await tx.transactionTask.update({
      where: {
        id: input.taskId
      },
      data: updateData,
      include: transactionTaskInclude
    });

    await createTaskAuditEvent(tx, {
      organizationId: input.organizationId,
      actorMembershipId: input.actorMembershipId,
      action:
        isSecondApprovalRequired && isFirstApproval
          ? activityLogActions.transactionTaskFirstApproved
          : isSecondApprovalRequired
            ? activityLogActions.transactionTaskSecondApproved
            : activityLogActions.transactionTaskApproved,
      task: updated,
      actionSource: input.activitySource ?? null,
      details: isSecondApprovalRequired && isFirstApproval
        ? ["First approval recorded", "Task moved to second review"]
        : ["Approval completed", "Task is now eligible for final completion"],
      changes: [
        buildTaskChange("Review status", reviewStatusLabelMap[existingTask.reviewStatus], reviewStatusLabelMap[updated.reviewStatus]),
        buildTaskChange("Compliance status", complianceStatusLabelMap[existingTask.complianceStatus], complianceStatusLabelMap[updated.complianceStatus]),
        buildTaskChange("Workflow status", getDbTaskStatusLabel(existingTask.status), getDbTaskStatusLabel(updated.status))
      ].filter((change): change is NonNullable<typeof change> => Boolean(change))
    });

    if (isSecondApprovalRequired && isFirstApproval) {
      const secondReviewerMembershipIds = await listOfficeNotificationRecipientIds(tx, {
        organizationId: input.organizationId,
        officeId: updated.transaction.officeId ?? null,
        group: "secondary_task_reviewers",
        excludeMembershipIds: [input.actorMembershipId]
      });

      await createNotificationsForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: updated.transaction.officeId ?? null,
        membershipIds: secondReviewerMembershipIds,
        type: NotificationType.task_second_review_requested,
        category: NotificationCategory.task,
        severity: NotificationSeverity.info,
        entityType: NotificationEntityType.transaction_task,
        entityId: updated.id,
        title: `Second review requested: ${updated.title}`,
        body: `${buildTransactionObjectLabel(updated.transaction)} now requires a second reviewer.`,
        actionUrl: "/office/approve-docs?queue=awaiting_second_review"
      });
    }

    return updated;
  });

  return mapTransactionTask(saved);
}

export async function rejectTransactionTask(input: {
  organizationId: string;
  transactionId: string;
  taskId: string;
  actorMembershipId: string;
  rejectionReason?: string;
  activitySource?: TransactionTaskAuditSource | null;
}): Promise<OfficeTransactionTask | null> {
  const existingTask = await getTaskRecord(input.organizationId, input.transactionId, input.taskId);

  if (!existingTask) {
    return null;
  }

  if (!taskNeedsReview(existingTask)) {
    throw new Error("This task does not require review.");
  }

  const saved = await prisma.$transaction(async (tx) => {
    const now = new Date();
    await syncTaskLinkedDocumentStatuses(tx, {
      organizationId: input.organizationId,
      transactionId: input.transactionId,
      taskId: input.taskId,
      actorMembershipId: input.actorMembershipId,
      nextStatus: "rejected"
    });

    const updated = await tx.transactionTask.update({
      where: {
        id: input.taskId
      },
      data: {
        status: "reopened",
        reviewStatus: "rejected",
        complianceStatus: "rejected",
        rejectedAt: now,
        rejectedByMembershipId: input.actorMembershipId,
        rejectionReason: parseOptionalText(input.rejectionReason),
        reopenedAt: now,
        completedAt: null,
        completedByMembershipId: null
      },
      include: transactionTaskInclude
    });

    await createTaskAuditEvent(tx, {
      organizationId: input.organizationId,
      actorMembershipId: input.actorMembershipId,
      action: activityLogActions.transactionTaskRejected,
      task: updated,
      actionSource: input.activitySource ?? null,
      details: [
        "Review rejected",
        "Task reopened for changes",
        ...(updated.rejectionReason ? [`Reason: ${updated.rejectionReason}`] : [])
      ],
      changes: [
        buildTaskChange("Review status", reviewStatusLabelMap[existingTask.reviewStatus], reviewStatusLabelMap[updated.reviewStatus]),
        buildTaskChange("Compliance status", complianceStatusLabelMap[existingTask.complianceStatus], complianceStatusLabelMap[updated.complianceStatus]),
        buildTaskChange("Workflow status", getDbTaskStatusLabel(existingTask.status), getDbTaskStatusLabel(updated.status))
      ].filter((change): change is NonNullable<typeof change> => Boolean(change))
    });

    await createNotificationsForMemberships(tx, {
      organizationId: input.organizationId,
      officeId: updated.transaction.officeId ?? null,
      membershipIds: [
        updated.assigneeMembershipId ?? "",
        updated.submittedForReviewByMembershipId ?? "",
        updated.transaction.ownerMembershipId ?? ""
      ],
      excludeMembershipIds: [input.actorMembershipId],
      restrictToOfficeRoles: true,
      type: NotificationType.task_rejected,
      category: NotificationCategory.task,
      severity: NotificationSeverity.warning,
      entityType: NotificationEntityType.transaction_task,
      entityId: updated.id,
      title: `Task rejected: ${updated.title}`,
      body: updated.rejectionReason
        ? `${buildTransactionObjectLabel(updated.transaction)} was rejected and reopened. Reason: ${updated.rejectionReason}`
        : `${buildTransactionObjectLabel(updated.transaction)} was rejected and reopened for changes.`,
      actionUrl: buildTaskNotificationHref(input.transactionId)
    });

    return updated;
  });

  return mapTransactionTask(saved);
}
