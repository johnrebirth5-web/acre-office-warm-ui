import { randomUUID } from "node:crypto";
import {
  canAccessOfficeMail,
  canAuditOfficeMail,
  canSendOfficeMail,
  getRoleSummary,
  isOfficeRole,
  type PermissionKey,
  type PermissionSubject,
} from "@acre/auth";
import {
  MembershipStatus,
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  type UserRole,
} from "@prisma/client";
import {
  activityLogActions,
  recordActivityLogEvent,
  type ActivityLogAction,
} from "./activity-log";
import { prisma } from "./client";
import { upsertNotificationForMemberships } from "./notifications";
import { getMembershipEffectivePermissionKeys } from "./permissions";

type MailDbClient = Prisma.TransactionClient | typeof prisma;

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGE_ATTACHMENTS_BYTES = 25 * 1024 * 1024;

export type OfficeMailMode = "mine" | "audit";
export type OfficeMailView = "all" | "unread" | "archived";

export type OfficeMailRecipientOption = {
  membershipId: string;
  fullName: string;
  roleLabel: string;
  title: string;
  officeName: string;
  label: string;
};

export type OfficeMailThreadListItem = {
  id: string;
  subject: string;
  participantsLabel: string;
  latestSenderName: string;
  latestPreview: string;
  latestMessageAt: string;
  latestMessageAtLabel: string;
  isUnread: boolean;
  isArchived: boolean;
  attachmentCount: number;
  messageCount: number;
  participantCount: number;
  hasAttachments: boolean;
};

export type OfficeMailParticipantItem = {
  membershipId: string;
  fullName: string;
  roleLabel: string;
  title: string;
  officeName: string;
};

export type OfficeMailAttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  downloadHref: string;
};

export type OfficeMailMessageItem = {
  id: string;
  senderMembershipId: string;
  senderName: string;
  senderRoleLabel: string;
  body: string;
  createdAt: string;
  createdAtLabel: string;
  isSelf: boolean;
  attachments: OfficeMailAttachmentItem[];
};

export type OfficeMailThreadDetail = {
  id: string;
  subject: string;
  participants: OfficeMailParticipantItem[];
  messages: OfficeMailMessageItem[];
  isUnread: boolean;
  isArchived: boolean;
  attachmentCount: number;
  latestMessageAt: string;
  latestMessageAtLabel: string;
  auditedByAdmin: boolean;
  canReply: boolean;
  actionUrl: string | null;
  actionLabel: string | null;
};

export type AppointmentInternalMailThreadContinuity = {
  label: string;
  detail: string;
  nextStep: string;
  sourceNote: string;
  returnToLabel: string;
  returnToDetail: string;
  returnToUrl: string | null;
};

export type AppointmentInternalMailThreadResponse = {
  thread: {
    id: string;
    subject: string;
  };
  threadHref: string;
  actionLabel: string;
  actionTargetLabel: string | null;
  actionTargetUrl: string | null;
  manualOnlyDetail: string;
  continuity: AppointmentInternalMailThreadContinuity;
};

export type AppointmentInternalMailThreadErrorStatus = {
  status: 400 | 403 | 409;
  hint: string | null;
};

export type OfficeMailWorkspaceSnapshot = {
  mode: OfficeMailMode;
  canAudit: boolean;
  canSend: boolean;
  filters: {
    q: string;
    view: OfficeMailView;
    selectedThreadId: string;
  };
  summary: {
    unreadCount: number;
    activeCount: number;
    archivedCount: number;
    attachmentsInView: number;
    threadsInView: number;
  };
  threads: OfficeMailThreadListItem[];
  selectedThread: OfficeMailThreadDetail | null;
};

export type OfficeMailAttachmentInput = {
  id?: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
};

export type CreateOfficeMailThreadInput = {
  organizationId: string;
  membershipId: string;
  subject: string;
  body: string;
  recipientMembershipIds: string[];
  threadId?: string;
  initialMessageId?: string;
  attachments?: OfficeMailAttachmentInput[];
  actionUrl?: string | null;
  actionLabel?: string | null;
};

type CreateMailThreadRecordInput = {
  organizationId: string;
  membershipId: string;
  subject: string;
  body: string;
  recipientMembershipIds: string[];
  threadId?: string;
  initialMessageId?: string;
  attachments?: OfficeMailAttachmentInput[];
  actionUrl?: string | null;
  actionLabel?: string | null;
  createdAt?: Date;
};

export type ReplyToOfficeMailThreadInput = {
  organizationId: string;
  membershipId: string;
  threadId: string;
  body: string;
  messageId?: string;
  attachments?: OfficeMailAttachmentInput[];
};

export type UpdateOfficeMailThreadInput = {
  organizationId: string;
  membershipId: string;
  threadId: string;
};

export type GetOfficeMailWorkspaceInput = {
  organizationId: string;
  membershipId: string;
  q?: string;
  view?: string;
  mode?: string;
  threadId?: string;
};

type MailActor = {
  membershipId: string;
  organizationId: string;
  role: UserRole;
  permissions: PermissionKey[];
  canAudit: boolean;
  canSend: boolean;
};

type MailThreadListRecord = Prisma.OfficeMailThreadGetPayload<{
  include: {
    participants: {
      include: {
        membership: {
          include: {
            user: true;
            office: true;
          };
        };
      };
    };
    messages: {
      take: 1;
      orderBy: { createdAt: "desc" };
      include: {
        senderMembership: {
          include: {
            user: true;
          };
        };
      };
    };
    _count: {
      select: {
        messages: true;
        participants: true;
      };
    };
  };
}>;

type MailThreadDetailRecord = Prisma.OfficeMailThreadGetPayload<{
  include: {
    participants: {
      include: {
        membership: {
          include: {
            user: true;
            office: true;
          };
        };
      };
    };
    messages: {
      orderBy: { createdAt: "asc" };
      include: {
        senderMembership: {
          include: {
            user: true;
          };
        };
        attachments: true;
      };
    };
  };
}>;

function formatDateTimeLabel(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMembershipName(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const fullName = `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim();
  return fullName || input.email?.trim() || "Unknown member";
}

function formatFileSize(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${value} B`;
}

function normalizeMode(
  value: string | undefined,
  canAudit: boolean,
): OfficeMailMode {
  if (value === "audit" && canAudit) {
    return "audit";
  }

  return "mine";
}

function normalizeView(value: string | undefined): OfficeMailView {
  if (value === "unread" || value === "archived") {
    return value;
  }

  return "all";
}

function normalizeSearch(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeBody(value: string) {
  return value.trim();
}

function normalizeSubject(value: string) {
  const subject = value.trim();

  if (!subject) {
    throw new Error("Subject is required.");
  }

  return subject;
}

function normalizeActionUrl(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim();
  return normalized.startsWith("/") ? normalized : null;
}

function normalizeActionLabel(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeRecipientIds(
  membershipId: string,
  recipientMembershipIds: string[],
) {
  const ids = Array.from(
    new Set(
      recipientMembershipIds
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value) => value !== membershipId),
    ),
  );

  if (ids.length === 0) {
    throw new Error("At least one valid recipient is required.");
  }

  return ids;
}

function normalizeAttachments(
  attachments: OfficeMailAttachmentInput[] | undefined,
) {
  const normalized = (attachments ?? []).map((attachment) => ({
    id: attachment.id?.trim() || randomUUID(),
    fileName: attachment.fileName.trim(),
    mimeType: attachment.mimeType.trim() || "application/octet-stream",
    fileSizeBytes: Number(attachment.fileSizeBytes) || 0,
    storageKey: attachment.storageKey.trim(),
  }));

  for (const attachment of normalized) {
    if (!attachment.fileName) {
      throw new Error("Every attachment requires a file name.");
    }

    if (!attachment.storageKey) {
      throw new Error("Every attachment requires a storage key.");
    }

    if (attachment.fileSizeBytes <= 0) {
      throw new Error("Every attachment must include a valid file size.");
    }

    if (attachment.fileSizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(
        `Attachment ${attachment.fileName} exceeds the 10 MB limit.`,
      );
    }
  }

  const totalBytes = normalized.reduce(
    (sum, attachment) => sum + attachment.fileSizeBytes,
    0,
  );

  if (totalBytes > MAX_MESSAGE_ATTACHMENTS_BYTES) {
    throw new Error("Attachments for one message cannot exceed 25 MB total.");
  }

  return normalized;
}

function assertBodyOrAttachments(
  body: string,
  attachments: ReturnType<typeof normalizeAttachments>,
) {
  if (!body && attachments.length === 0) {
    throw new Error("A message body or at least one attachment is required.");
  }
}

function buildThreadHref(threadId: string, mode: OfficeMailMode = "mine") {
  const query = new URLSearchParams({ threadId });

  if (mode === "audit") {
    query.set("mode", "audit");
  }

  return `/office/mail?${query.toString()}`;
}

function buildAttachmentHref(
  attachmentId: string,
  mode: OfficeMailMode = "mine",
) {
  const query = new URLSearchParams();

  if (mode === "audit") {
    query.set("mode", "audit");
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `/api/office/mail/attachments/${attachmentId}/file${suffix}`;
}

function buildAppointmentInternalMailThreadContinuity(
  returnToUrl: string | null,
): AppointmentInternalMailThreadContinuity {
  return {
    label: "Internal mail thread opened",
    detail:
      "Acre created an internal mail thread for the appointment brief so the continuity stays inside the workspace.",
    nextStep:
      "Review the Acre thread, then return to the appointment record and save the next checkpoint.",
    sourceNote:
      "Internal mail continuity only; the outside email remains manual and no provider sync is implied.",
    returnToLabel: "Return to writeback",
    returnToDetail:
      "Jump back to the same appointment after reviewing the thread, then save the next checkpoint in Acre.",
    returnToUrl,
  };
}

export function buildAppointmentInternalMailThreadResponse(input: {
  threadId: string;
  subject: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
}): AppointmentInternalMailThreadResponse {
  const actionTargetUrl = normalizeActionUrl(input.actionUrl);
  const actionTargetLabel = normalizeActionLabel(input.actionLabel);

  return {
    thread: {
      id: input.threadId,
      subject: input.subject,
    },
    threadHref: buildThreadHref(input.threadId),
    actionLabel: "Internal mail thread",
    actionTargetLabel,
    actionTargetUrl,
    manualOnlyDetail:
      "The Acre mail thread keeps the appointment email brief inside the workspace; the external send still stays manual and no provider sync is implied.",
    continuity: buildAppointmentInternalMailThreadContinuity(actionTargetUrl),
  };
}

export function mapAppointmentInternalMailThreadErrorStatus(
  message: string,
): AppointmentInternalMailThreadErrorStatus {
  if (
    message.includes("No internal mail recipients") ||
    message.includes("email target is required") ||
    message.includes("Only scheduled appointments")
  ) {
    return {
      status: 409,
      hint:
        "If internal mail access is unavailable, use the external email brief from the appointment bridge instead.",
    };
  }

  if (
    message.includes("Mail access required") ||
    message.includes("Mail send access required.")
  ) {
    return {
      status: 403,
      hint:
        "If internal mail access is unavailable, use the external email brief from the appointment bridge instead.",
    };
  }

  return {
    status: 400,
    hint: null,
  };
}

function summarizeMessageBody(body: string, attachmentCount: number) {
  const normalized = body.replace(/\s+/g, " ").trim();

  if (normalized) {
    return normalized.length > 140
      ? `${normalized.slice(0, 137)}...`
      : normalized;
  }

  if (attachmentCount > 0) {
    return attachmentCount === 1
      ? "Attachment only"
      : `${attachmentCount} attachments`;
  }

  return "No body";
}

function buildParticipantsLabel(
  participants: MailThreadListRecord["participants"],
  viewerMembershipId: string | null,
  mode: OfficeMailMode,
) {
  const visibleParticipants =
    mode === "mine" && viewerMembershipId
      ? participants.filter(
          (participant) => participant.membershipId !== viewerMembershipId,
        )
      : participants;

  const labels = (
    visibleParticipants.length ? visibleParticipants : participants
  ).map((participant) =>
    formatMembershipName({
      firstName: participant.membership.user.firstName,
      lastName: participant.membership.user.lastName,
      email: participant.membership.user.email,
    }),
  );

  if (labels.length === 0) {
    return "Just you";
  }

  if (labels.length === 1) {
    return labels[0]!;
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

function buildParticipantItem(
  participant: MailThreadDetailRecord["participants"][number],
): OfficeMailParticipantItem {
  return {
    membershipId: participant.membershipId,
    fullName: formatMembershipName({
      firstName: participant.membership.user.firstName,
      lastName: participant.membership.user.lastName,
      email: participant.membership.user.email,
    }),
    roleLabel: getRoleSummary(participant.membership.role as UserRole).label,
    title: participant.membership.title?.trim() || "",
    officeName: participant.membership.office?.name ?? "All offices",
  };
}

function isThreadUnreadForParticipant(
  participant: { lastReadAt: Date | null },
  latestMessageAt: Date,
) {
  return (
    !participant.lastReadAt ||
    participant.lastReadAt.getTime() < latestMessageAt.getTime()
  );
}

function getAnyParticipantUnread(
  record: MailThreadListRecord | MailThreadDetailRecord,
) {
  return record.participants.some((participant) =>
    isThreadUnreadForParticipant(participant, record.latestMessageAt),
  );
}

function getAnyParticipantArchived(
  record: MailThreadListRecord | MailThreadDetailRecord,
) {
  return record.participants.some(
    (participant) => participant.archivedAt != null,
  );
}

async function getMailActor(
  organizationId: string,
  membershipId: string,
): Promise<MailActor> {
  const membership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      organizationId,
    },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  if (!membership || membership.status !== MembershipStatus.active) {
    throw new Error("Mail access requires an active membership.");
  }

  const permissions = await getMembershipEffectivePermissionKeys({
    organizationId,
    membershipId,
  });
  const subject: PermissionSubject = {
    role: membership.role as UserRole,
    permissions,
  };

  if (!canAccessOfficeMail(subject)) {
    throw new Error("Mail access required.");
  }

  return {
    membershipId: membership.id,
    organizationId,
    role: membership.role as UserRole,
    permissions,
    canAudit: canAuditOfficeMail(subject),
    canSend: canSendOfficeMail(subject),
  };
}

async function getValidRecipients(
  db: MailDbClient,
  organizationId: string,
  recipientMembershipIds: string[],
) {
  const recipients = await db.membership.findMany({
    where: {
      organizationId,
      id: {
        in: recipientMembershipIds,
      },
      status: MembershipStatus.active,
      user: {
        isActive: true,
      },
    },
    include: {
      user: true,
      office: true,
    },
  });

  if (recipients.length !== recipientMembershipIds.length) {
    throw new Error("One or more recipients are no longer available.");
  }

  if (
    recipients.some((recipient) => !isOfficeRole(recipient.role as UserRole))
  ) {
    throw new Error("Recipients must be active Back Office memberships.");
  }

  return recipients;
}

async function getThreadAttachmentCounts(
  organizationId: string,
  threadIds: string[],
) {
  if (threadIds.length === 0) {
    return new Map<string, number>();
  }

  const attachments = await prisma.officeMailAttachment.findMany({
    where: {
      organizationId,
      message: {
        threadId: {
          in: threadIds,
        },
      },
    },
    select: {
      message: {
        select: {
          threadId: true,
        },
      },
    },
  });

  const counts = new Map<string, number>();

  for (const attachment of attachments) {
    counts.set(
      attachment.message.threadId,
      (counts.get(attachment.message.threadId) ?? 0) + 1,
    );
  }

  return counts;
}

function mapThreadListItem(
  actor: MailActor,
  mode: OfficeMailMode,
  record: MailThreadListRecord,
  attachmentCounts: Map<string, number>,
): OfficeMailThreadListItem {
  const latestMessage = record.messages[0] ?? null;
  const viewerParticipant =
    mode === "mine"
      ? (record.participants.find(
          (participant) => participant.membershipId === actor.membershipId,
        ) ?? null)
      : null;
  const attachmentCount = attachmentCounts.get(record.id) ?? 0;
  const isUnread =
    mode === "mine" && viewerParticipant
      ? isThreadUnreadForParticipant(viewerParticipant, record.latestMessageAt)
      : getAnyParticipantUnread(record);
  const isArchived =
    mode === "mine" && viewerParticipant
      ? viewerParticipant.archivedAt != null
      : getAnyParticipantArchived(record);

  return {
    id: record.id,
    subject: record.subject,
    participantsLabel: buildParticipantsLabel(
      record.participants,
      actor.membershipId,
      mode,
    ),
    latestSenderName: latestMessage
      ? formatMembershipName({
          firstName: latestMessage.senderMembership.user.firstName,
          lastName: latestMessage.senderMembership.user.lastName,
          email: latestMessage.senderMembership.user.email,
        })
      : "Unknown sender",
    latestPreview: latestMessage
      ? summarizeMessageBody(latestMessage.body, attachmentCount)
      : "No messages yet",
    latestMessageAt: record.latestMessageAt.toISOString(),
    latestMessageAtLabel: formatDateTimeLabel(record.latestMessageAt),
    isUnread,
    isArchived,
    attachmentCount,
    messageCount: record._count.messages,
    participantCount: record._count.participants,
    hasAttachments: attachmentCount > 0,
  };
}

function applyThreadViewFilter(
  item: OfficeMailThreadListItem,
  view: OfficeMailView,
) {
  if (view === "unread") {
    return !item.isArchived && item.isUnread;
  }

  if (view === "archived") {
    return item.isArchived;
  }

  return !item.isArchived;
}

async function markThreadReadState(
  db: MailDbClient,
  input: {
    organizationId: string;
    membershipId: string;
    threadId: string;
    lastReadAt: Date | null;
  },
) {
  const result = await db.officeMailParticipant.updateMany({
    where: {
      organizationId: input.organizationId,
      threadId: input.threadId,
      membershipId: input.membershipId,
    },
    data: {
      lastReadAt: input.lastReadAt,
    },
  });

  if (result.count === 0) {
    return false;
  }

  await db.notification.updateMany({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      type: NotificationType.internal_message_received,
      entityType: NotificationEntityType.office_mail_thread,
      entityId: input.threadId,
    },
    data: {
      readAt: input.lastReadAt ? new Date() : null,
    },
  });

  return true;
}

async function getReadableThread(
  actor: MailActor,
  threadId: string,
  mode: OfficeMailMode,
) {
  const record = await prisma.officeMailThread.findFirst({
    where: {
      id: threadId,
      organizationId: actor.organizationId,
      ...(mode === "mine"
        ? {
            participants: {
              some: {
                membershipId: actor.membershipId,
              },
            },
          }
        : {}),
    },
    include: {
      participants: {
        include: {
          membership: {
            include: {
              user: true,
              office: true,
            },
          },
        },
        orderBy: [{ joinedAt: "asc" }],
      },
      messages: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          senderMembership: {
            include: {
              user: true,
            },
          },
          attachments: {
            orderBy: [{ createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  return record;
}

function mapThreadDetail(
  actor: MailActor,
  mode: OfficeMailMode,
  record: MailThreadDetailRecord,
): OfficeMailThreadDetail {
  const viewerParticipant =
    mode === "mine"
      ? (record.participants.find(
          (participant) => participant.membershipId === actor.membershipId,
        ) ?? null)
      : null;
  const attachmentCount = record.messages.reduce(
    (sum, message) => sum + message.attachments.length,
    0,
  );

  return {
    id: record.id,
    subject: record.subject,
    participants: record.participants.map(buildParticipantItem),
    messages: record.messages.map((message) => ({
      id: message.id,
      senderMembershipId: message.senderMembershipId,
      senderName: formatMembershipName({
        firstName: message.senderMembership.user.firstName,
        lastName: message.senderMembership.user.lastName,
        email: message.senderMembership.user.email,
      }),
      senderRoleLabel: getRoleSummary(message.senderMembership.role as UserRole)
        .label,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      createdAtLabel: formatDateTimeLabel(message.createdAt),
      isSelf: message.senderMembershipId === actor.membershipId,
      attachments: message.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSizeBytes: attachment.fileSizeBytes,
        fileSizeLabel: formatFileSize(attachment.fileSizeBytes),
        downloadHref: buildAttachmentHref(attachment.id, mode),
      })),
    })),
    isUnread:
      mode === "mine" && viewerParticipant
        ? isThreadUnreadForParticipant(
            viewerParticipant,
            record.latestMessageAt,
          )
        : getAnyParticipantUnread(record),
    isArchived:
      mode === "mine" && viewerParticipant
        ? viewerParticipant.archivedAt != null
        : getAnyParticipantArchived(record),
    attachmentCount,
    latestMessageAt: record.latestMessageAt.toISOString(),
    latestMessageAtLabel: formatDateTimeLabel(record.latestMessageAt),
    auditedByAdmin: mode === "audit",
    canReply: mode === "mine" && actor.canSend,
    actionUrl: normalizeActionUrl(record.actionUrl),
    actionLabel: normalizeActionLabel(record.actionLabel),
  };
}

async function listThreadRecords(
  actor: MailActor,
  mode: OfficeMailMode,
  q: string,
) {
  return prisma.officeMailThread.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(mode === "mine"
        ? {
            participants: {
              some: {
                membershipId: actor.membershipId,
              },
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              {
                subject: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                messages: {
                  some: {
                    body: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                participants: {
                  some: {
                    membership: {
                      OR: [
                        {
                          title: {
                            contains: q,
                            mode: "insensitive",
                          },
                        },
                        {
                          user: {
                            firstName: {
                              contains: q,
                              mode: "insensitive",
                            },
                          },
                        },
                        {
                          user: {
                            lastName: {
                              contains: q,
                              mode: "insensitive",
                            },
                          },
                        },
                        {
                          user: {
                            email: {
                              contains: q,
                              mode: "insensitive",
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ latestMessageAt: "desc" }],
    include: {
      participants: {
        include: {
          membership: {
            include: {
              user: true,
              office: true,
            },
          },
        },
        orderBy: [{ joinedAt: "asc" }],
      },
      messages: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        include: {
          senderMembership: {
            include: {
              user: true,
            },
          },
        },
      },
      _count: {
        select: {
          messages: true,
          participants: true,
        },
      },
    },
  });
}

async function createThreadNotification(
  db: MailDbClient,
  input: {
    organizationId: string;
    senderName: string;
    subject: string;
    threadId: string;
    officeId?: string | null;
    recipientMembershipIds: string[];
    preview: string;
  },
) {
  return upsertNotificationForMemberships(db, {
    organizationId: input.organizationId,
    officeId: input.officeId ?? null,
    membershipIds: input.recipientMembershipIds,
    type: NotificationType.internal_message_received,
    category: NotificationCategory.message,
    severity: NotificationSeverity.info,
    entityType: NotificationEntityType.office_mail_thread,
    entityId: input.threadId,
    title: `New internal message: ${input.subject}`,
    body: `${input.senderName}: ${input.preview}`,
    actionUrl: buildThreadHref(input.threadId),
    restrictToOfficeRoles: true,
  });
}

export async function listOfficeMailRecipientOptions(input: {
  organizationId: string;
  membershipId: string;
}): Promise<OfficeMailRecipientOption[]> {
  const actor = await getMailActor(input.organizationId, input.membershipId);

  if (!actor.canSend) {
    throw new Error("Mail send access required.");
  }

  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: MembershipStatus.active,
      user: {
        isActive: true,
      },
    },
    include: {
      user: true,
      office: true,
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });

  return memberships
    .filter((membership) => membership.id !== input.membershipId)
    .filter((membership) => isOfficeRole(membership.role as UserRole))
    .map((membership) => {
      const fullName = formatMembershipName({
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email,
      });
      const roleLabel = getRoleSummary(membership.role as UserRole).label;
      const title = membership.title?.trim() || "";
      const officeName = membership.office?.name ?? "All offices";

      return {
        membershipId: membership.id,
        fullName,
        roleLabel,
        title,
        officeName,
        label: `${fullName} · ${title || roleLabel} · ${officeName}`,
      };
    });
}

export async function getOfficeMailWorkspace(
  input: GetOfficeMailWorkspaceInput,
): Promise<OfficeMailWorkspaceSnapshot> {
  const actor = await getMailActor(input.organizationId, input.membershipId);
  const mode = normalizeMode(input.mode, actor.canAudit);
  const q = normalizeSearch(input.q);
  const view = normalizeView(input.view);
  const threadRecords = await listThreadRecords(actor, mode, q);
  const attachmentCounts = await getThreadAttachmentCounts(
    actor.organizationId,
    threadRecords.map((record) => record.id),
  );

  let allThreads = threadRecords.map((record) =>
    mapThreadListItem(actor, mode, record, attachmentCounts),
  );
  let threads = allThreads.filter((thread) =>
    applyThreadViewFilter(thread, view),
  );

  let selectedThreadId = input.threadId?.trim() || "";

  if (
    !selectedThreadId ||
    !threads.some((thread) => thread.id === selectedThreadId)
  ) {
    selectedThreadId = threads[0]?.id ?? "";
  }

  let selectedThread: OfficeMailThreadDetail | null = null;

  if (selectedThreadId) {
    if (mode === "mine") {
      const selectedListItem =
        threads.find((thread) => thread.id === selectedThreadId) ?? null;

      if (selectedListItem?.isUnread) {
        const latestMessageAt =
          threadRecords.find((record) => record.id === selectedThreadId)
            ?.latestMessageAt ?? new Date();
        await markThreadReadState(prisma, {
          organizationId: actor.organizationId,
          membershipId: actor.membershipId,
          threadId: selectedThreadId,
          lastReadAt: latestMessageAt,
        });
      }
    }

    const detailRecord = await getReadableThread(actor, selectedThreadId, mode);

    if (detailRecord) {
      const nextSelectedThread = mapThreadDetail(actor, mode, detailRecord);
      selectedThread = nextSelectedThread;
      allThreads = allThreads.map((thread) =>
        thread.id === selectedThreadId
          ? {
              ...thread,
              isUnread: nextSelectedThread.isUnread,
              isArchived: nextSelectedThread.isArchived,
            }
          : thread,
      );
      threads = allThreads.filter((thread) =>
        applyThreadViewFilter(thread, view),
      );
    }
  }

  const activeThreads = allThreads.filter((thread) => !thread.isArchived);
  const archivedThreads = allThreads.filter((thread) => thread.isArchived);
  const unreadThreads = activeThreads.filter((thread) => thread.isUnread);

  return {
    mode,
    canAudit: actor.canAudit,
    canSend: actor.canSend,
    filters: {
      q,
      view,
      selectedThreadId,
    },
    summary: {
      unreadCount: unreadThreads.length,
      activeCount: activeThreads.length,
      archivedCount: archivedThreads.length,
      attachmentsInView: threads.reduce(
        (sum, thread) => sum + thread.attachmentCount,
        0,
      ),
      threadsInView: threads.length,
    },
    threads,
    selectedThread,
  };
}

async function createMailThreadRecord(
  db: MailDbClient,
  input: CreateMailThreadRecordInput,
) {
  const subject = normalizeSubject(input.subject);
  const body = normalizeBody(input.body);
  const attachments = normalizeAttachments(input.attachments);
  const recipientIds = normalizeRecipientIds(
    input.membershipId,
    input.recipientMembershipIds,
  );
  const actionUrl = normalizeActionUrl(input.actionUrl);
  const actionLabel = normalizeActionLabel(input.actionLabel);

  assertBodyOrAttachments(body, attachments);

  const recipients = await getValidRecipients(
    db,
    input.organizationId,
    recipientIds,
  );
  const threadId = input.threadId?.trim() || randomUUID();
  const messageId = input.initialMessageId?.trim() || randomUUID();
  const createdAt = input.createdAt ?? new Date();

  await db.officeMailThread.create({
    data: {
      id: threadId,
      organizationId: input.organizationId,
      createdByMembershipId: input.membershipId,
      subject,
      actionUrl,
      actionLabel,
      latestMessageAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      participants: {
        createMany: {
          data: [
            {
              organizationId: input.organizationId,
              membershipId: input.membershipId,
              joinedAt: createdAt,
              lastReadAt: createdAt,
            },
            ...recipients.map((recipient) => ({
              organizationId: input.organizationId,
              membershipId: recipient.id,
              joinedAt: createdAt,
            })),
          ],
        },
      },
      messages: {
        create: {
          id: messageId,
          organizationId: input.organizationId,
          senderMembershipId: input.membershipId,
          body,
          createdAt,
          attachments: attachments.length
            ? {
                createMany: {
                  data: attachments.map((attachment) => ({
                    id: attachment.id,
                    organizationId: input.organizationId,
                    fileName: attachment.fileName,
                    mimeType: attachment.mimeType,
                    fileSizeBytes: attachment.fileSizeBytes,
                    storageKey: attachment.storageKey,
                    createdAt,
                  })),
                },
              }
            : undefined,
        },
      },
    },
  });

  const actorMembership = await db.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
    },
    include: {
      user: true,
      office: true,
    },
  });
  const actorName = actorMembership
    ? formatMembershipName({
        firstName: actorMembership.user.firstName,
        lastName: actorMembership.user.lastName,
        email: actorMembership.user.email,
      })
    : "Unknown sender";

  await createThreadNotification(db, {
    organizationId: input.organizationId,
    senderName: actorName,
    subject,
    threadId,
    officeId: actorMembership?.officeId ?? null,
    recipientMembershipIds: recipients.map((recipient) => recipient.id),
    preview: summarizeMessageBody(body, attachments.length),
  });

  await recordActivityLogEvent(db, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "office_mail_thread",
    entityId: threadId,
    action: activityLogActions.officeMailThreadCreated,
    payload: {
      objectLabel: subject,
      contextHref: buildThreadHref(threadId),
      details: [
        `Participants: ${recipients.length + 1}`,
        `Initial attachments: ${attachments.length}`,
        ...(actionUrl ? [`Action target: ${actionLabel ?? actionUrl}`] : []),
      ],
    },
  });

  return {
    threadId,
    subject,
    body,
    attachments,
    recipients,
  };
}

export async function createOfficeMailThread(
  input: CreateOfficeMailThreadInput,
): Promise<OfficeMailThreadDetail> {
  const actor = await getMailActor(input.organizationId, input.membershipId);

  if (!actor.canSend) {
    throw new Error("Mail send access required.");
  }

  const createdThread = await prisma.$transaction((tx) =>
    createMailThreadRecord(tx, {
      ...input,
      actionUrl: input.actionUrl ?? null,
      actionLabel: input.actionLabel ?? null,
    }),
  );
  const threadId = createdThread.threadId;
  const record = await getReadableThread(actor, threadId, "mine");

  if (!record) {
    throw new Error("The new mail thread could not be loaded.");
  }

  return mapThreadDetail(actor, "mine", record);
}

export async function createSystemOfficeMailThread(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    organizationId: string;
    membershipId: string;
    subject: string;
    body: string;
    recipientMembershipIds: string[];
    threadId?: string;
    initialMessageId?: string;
    attachments?: OfficeMailAttachmentInput[];
    actionUrl?: string | null;
    actionLabel?: string | null;
    createdAt?: Date;
  },
) {
  return createMailThreadRecord(db, input);
}

export async function getOfficeMailUnreadCount(input: {
  organizationId: string;
  membershipId: string;
}) {
  const actor = await getMailActor(input.organizationId, input.membershipId);
  const participants = await prisma.officeMailParticipant.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: actor.membershipId,
      archivedAt: null,
    },
    select: {
      lastReadAt: true,
      thread: {
        select: {
          latestMessageAt: true,
        },
      },
    },
  });

  return participants.filter(
    (participant) =>
      !participant.lastReadAt ||
      participant.lastReadAt.getTime() <
        participant.thread.latestMessageAt.getTime(),
  ).length;
}

export async function replyToOfficeMailThread(
  input: ReplyToOfficeMailThreadInput,
): Promise<OfficeMailThreadDetail> {
  const actor = await getMailActor(input.organizationId, input.membershipId);

  if (!actor.canSend) {
    throw new Error("Mail send access required.");
  }

  const body = normalizeBody(input.body);
  const attachments = normalizeAttachments(input.attachments);
  assertBodyOrAttachments(body, attachments);

  const thread = await prisma.officeMailThread.findFirst({
    where: {
      id: input.threadId,
      organizationId: input.organizationId,
      participants: {
        some: {
          membershipId: input.membershipId,
        },
      },
    },
    include: {
      participants: {
        include: {
          membership: {
            include: {
              user: true,
              office: true,
            },
          },
        },
      },
    },
  });

  if (!thread) {
    throw new Error("Mail thread not found.");
  }

  const messageId = input.messageId?.trim() || randomUUID();
  const createdAt = new Date();
  const otherParticipantIds = thread.participants
    .map((participant) => participant.membershipId)
    .filter((membershipId) => membershipId !== input.membershipId);
  const senderParticipant =
    thread.participants.find(
      (participant) => participant.membershipId === input.membershipId,
    ) ?? null;
  const senderName = senderParticipant
    ? formatMembershipName({
        firstName: senderParticipant.membership.user.firstName,
        lastName: senderParticipant.membership.user.lastName,
        email: senderParticipant.membership.user.email,
      })
    : "Unknown sender";

  await prisma.$transaction(async (tx) => {
    await tx.officeMailMessage.create({
      data: {
        id: messageId,
        organizationId: input.organizationId,
        threadId: input.threadId,
        senderMembershipId: input.membershipId,
        body,
        createdAt,
        attachments: attachments.length
          ? {
              createMany: {
                data: attachments.map((attachment) => ({
                  id: attachment.id,
                  organizationId: input.organizationId,
                  fileName: attachment.fileName,
                  mimeType: attachment.mimeType,
                  fileSizeBytes: attachment.fileSizeBytes,
                  storageKey: attachment.storageKey,
                  createdAt,
                })),
              },
            }
          : undefined,
      },
    });

    await tx.officeMailThread.update({
      where: {
        id: input.threadId,
      },
      data: {
        latestMessageAt: createdAt,
      },
    });

    await tx.officeMailParticipant.updateMany({
      where: {
        organizationId: input.organizationId,
        threadId: input.threadId,
      },
      data: {
        archivedAt: null,
      },
    });

    await tx.officeMailParticipant.updateMany({
      where: {
        organizationId: input.organizationId,
        threadId: input.threadId,
        membershipId: input.membershipId,
      },
      data: {
        lastReadAt: createdAt,
      },
    });

    if (otherParticipantIds.length > 0) {
      await createThreadNotification(tx, {
        organizationId: input.organizationId,
        senderName,
        subject: thread.subject,
        threadId: input.threadId,
        officeId: senderParticipant?.membership.officeId ?? null,
        recipientMembershipIds: otherParticipantIds,
        preview: summarizeMessageBody(body, attachments.length),
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      entityType: "office_mail_message",
      entityId: messageId,
      action: activityLogActions.officeMailMessageSent,
      payload: {
        objectLabel: thread.subject,
        contextHref: buildThreadHref(input.threadId),
        details: [
          `Recipients: ${otherParticipantIds.length}`,
          `Attachments: ${attachments.length}`,
        ],
      },
    });
  });

  const record = await getReadableThread(actor, input.threadId, "mine");

  if (!record) {
    throw new Error("The updated mail thread could not be loaded.");
  }

  return mapThreadDetail(actor, "mine", record);
}

export async function markOfficeMailThreadRead(
  input: UpdateOfficeMailThreadInput,
) {
  const actor = await getMailActor(input.organizationId, input.membershipId);
  const thread = await prisma.officeMailThread.findFirst({
    where: {
      id: input.threadId,
      organizationId: input.organizationId,
      participants: {
        some: {
          membershipId: input.membershipId,
        },
      },
    },
    select: {
      latestMessageAt: true,
    },
  });

  if (!thread) {
    return false;
  }

  return markThreadReadState(prisma, {
    organizationId: actor.organizationId,
    membershipId: actor.membershipId,
    threadId: input.threadId,
    lastReadAt: thread.latestMessageAt,
  });
}

export async function markOfficeMailThreadUnread(
  input: UpdateOfficeMailThreadInput,
) {
  await getMailActor(input.organizationId, input.membershipId);
  return markThreadReadState(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    threadId: input.threadId,
    lastReadAt: null,
  });
}

async function updateThreadArchiveState(
  input: UpdateOfficeMailThreadInput,
  archivedAt: Date | null,
  action: ActivityLogAction,
) {
  await getMailActor(input.organizationId, input.membershipId);

  const result = await prisma.officeMailParticipant.updateMany({
    where: {
      organizationId: input.organizationId,
      threadId: input.threadId,
      membershipId: input.membershipId,
    },
    data: {
      archivedAt,
    },
  });

  if (result.count === 0) {
    return false;
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "office_mail_thread",
    entityId: input.threadId,
    action,
    payload: {
      contextHref: buildThreadHref(input.threadId),
    },
  });

  return true;
}

export async function archiveOfficeMailThread(
  input: UpdateOfficeMailThreadInput,
) {
  return updateThreadArchiveState(
    input,
    new Date(),
    activityLogActions.officeMailThreadArchived,
  );
}

export async function unarchiveOfficeMailThread(
  input: UpdateOfficeMailThreadInput,
) {
  return updateThreadArchiveState(
    input,
    null,
    activityLogActions.officeMailThreadUnarchived,
  );
}

export async function getOfficeMailAttachmentStorageRecord(input: {
  organizationId: string;
  membershipId: string;
  attachmentId: string;
  mode?: string;
}) {
  const actor = await getMailActor(input.organizationId, input.membershipId);
  const mode = normalizeMode(input.mode, actor.canAudit);

  return prisma.officeMailAttachment.findFirst({
    where: {
      id: input.attachmentId,
      organizationId: input.organizationId,
      ...(mode === "mine"
        ? {
            message: {
              thread: {
                participants: {
                  some: {
                    membershipId: input.membershipId,
                  },
                },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSizeBytes: true,
      storageKey: true,
    },
  });
}

export async function getOfficeMailThreadDetail(input: {
  organizationId: string;
  membershipId: string;
  threadId: string;
  mode?: string;
}) {
  const actor = await getMailActor(input.organizationId, input.membershipId);
  const mode = normalizeMode(input.mode, actor.canAudit);
  const record = await getReadableThread(actor, input.threadId, mode);

  if (!record) {
    return null;
  }

  return mapThreadDetail(actor, mode, record);
}
