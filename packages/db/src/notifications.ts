import {
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  TaskStatus,
  type OfferStatus,
  type UserRole
} from "@prisma/client";
import {
  canReviewOfficeIncomingUpdates,
  canReviewOfficeTasks,
  canSecondaryReviewOfficeTasks,
  isOfficeRole
} from "@acre/auth";
import { prisma } from "./client";
import {
  frontOfficeAppointmentExternalWorkflowStatuses,
  getFrontOfficeAppointmentExternalWorkflowState,
} from "./front-office-appointments";
import { getClientDisplayName } from "./front-office-follow-up";

type NotificationDbClient = Prisma.TransactionClient | typeof prisma;
type NotificationPreferenceField =
  | "approvalAlertsEnabled"
  | "taskRemindersEnabled"
  | "offerAlertsEnabled"
  | "messageAlertsEnabled";

export type OfficeNotificationReadFilter = "all" | "unread" | "read";
export type OfficeNotificationView = "inbox" | "archived";
export type OfficeNotificationPermissionGroup = "task_reviewers" | "secondary_task_reviewers" | "incoming_update_reviewers";

export type ListOfficeNotificationsInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  view?: string;
  type?: string;
  category?: string;
  readState?: string;
};

export type OfficeNotificationSummary = {
  totalCount: number;
  activeCount: number;
  archivedCount: number;
  unreadCount: number;
  reviewCount: number;
  timeSensitiveCount: number;
  payoutReviewCount: number;
};

export type OfficeNotificationFilterState = {
  view: OfficeNotificationView;
  type: string;
  category: string;
  readState: OfficeNotificationReadFilter;
};

export type OfficeNotificationFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type OfficeNotificationItem = {
  id: string;
  type: NotificationType;
  typeLabel: string;
  category: NotificationCategory | null;
  categoryLabel: string;
  severity: NotificationSeverity;
  severityLabel: string;
  title: string;
  body: string;
  actionUrl: string;
  openHref: string;
  isUnread: boolean;
  isArchived: boolean;
  createdAt: string;
  createdAtLabel: string;
  inboxStateLabel: "Inbox" | "Archived";
  readStateLabel: "Unread" | "Read";
};

export type OfficeNotificationGroup = {
  key: string;
  label: string;
  notifications: OfficeNotificationItem[];
};

export type OfficePayoutReviewReminder = {
  statementId: string;
  periodLabel: string;
  generatedAt: string;
  generatedAtLabel: string;
  totalStatementAmountLabel: string;
  openHref: string;
};

export type OfficeNotificationsSnapshot = {
  filters: OfficeNotificationFilterState;
  summary: OfficeNotificationSummary;
  totalCount: number;
  unreadCount: number;
  payoutReviewQueue: OfficePayoutReviewReminder[];
  groups: OfficeNotificationGroup[];
  typeOptions: OfficeNotificationFilterOption[];
  categoryOptions: OfficeNotificationFilterOption[];
};

export type CreateNotificationsForMembershipsInput = {
  organizationId: string;
  officeId?: string | null;
  membershipIds: string[];
  type: NotificationType;
  category?: NotificationCategory | null;
  severity?: NotificationSeverity | null;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  followUpTaskId?: string | null;
  eventId?: string | null;
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Prisma.InputJsonValue;
  excludeMembershipIds?: string[];
  restrictToOfficeRoles?: boolean;
};

export type EnsureNotificationForMembershipsInput = Omit<CreateNotificationsForMembershipsInput, "metadata"> & {
  metadata?: Prisma.InputJsonValue;
  resetReadState?: boolean;
};

export const officeNotificationInboxTypes: NotificationType[] = [
  NotificationType.internal_message_received,
  NotificationType.appointment_due_soon,
  NotificationType.appointment_external_touch_due,
  NotificationType.follow_up,
  NotificationType.task_review_requested,
  NotificationType.task_second_review_requested,
  NotificationType.task_rejected,
  NotificationType.offer_created,
  NotificationType.offer_received,
  NotificationType.offer_expiring_soon,
  NotificationType.signature_pending,
  NotificationType.signature_completed,
  NotificationType.incoming_update_pending_review,
  NotificationType.follow_up_assigned,
  NotificationType.follow_up_overdue,
  NotificationType.onboarding_assigned,
  NotificationType.onboarding_due_soon,
  NotificationType.payout_statement_ready,
  NotificationType.payout_statement_revision_requested,
  NotificationType.payout_statement_confirmed
];

const notificationTypeLabelMap: Record<NotificationType, string> = {
  system: "System",
  listing: "Listing",
  follow_up: "Follow-up",
  event: "Event",
  internal_message_received: "Internal message",
  appointment_due_soon: "Appointment due soon",
  appointment_external_touch_due: "External touch due",
  task_review_requested: "Awaiting my review",
  task_second_review_requested: "Awaiting second review",
  task_rejected: "Rejected task",
  offer_created: "Offer created",
  offer_received: "Offer received",
  offer_expiring_soon: "Offer expiring soon",
  signature_pending: "Signature pending",
  signature_completed: "Signature completed",
  incoming_update_pending_review: "Incoming update pending review",
  follow_up_assigned: "Follow-up assigned",
  follow_up_overdue: "Follow-up overdue",
  onboarding_assigned: "Onboarding assigned",
  onboarding_due_soon: "Onboarding due soon",
  payout_statement_ready: "Payout statement ready",
  payout_statement_revision_requested: "Payout statement revision requested",
  payout_statement_confirmed: "Payout statement confirmed"
};

const notificationCategoryLabelMap: Record<NotificationCategory, string> = {
  system: "System",
  message: "Mail",
  task: "Tasks",
  offer: "Offers",
  signature: "Signatures",
  incoming_update: "Incoming updates",
  follow_up: "Follow-up",
  onboarding: "Onboarding",
  event: "Events"
};

const notificationSeverityLabelMap: Record<NotificationSeverity, string> = {
  info: "Info",
  warning: "Needs attention",
  critical: "Critical"
};

const typeFilterOrder: NotificationType[] = [
  NotificationType.internal_message_received,
  NotificationType.appointment_due_soon,
  NotificationType.appointment_external_touch_due,
  NotificationType.follow_up,
  NotificationType.task_review_requested,
  NotificationType.task_second_review_requested,
  NotificationType.task_rejected,
  NotificationType.incoming_update_pending_review,
  NotificationType.offer_created,
  NotificationType.offer_received,
  NotificationType.offer_expiring_soon,
  NotificationType.signature_pending,
  NotificationType.signature_completed,
  NotificationType.payout_statement_ready,
  NotificationType.payout_statement_revision_requested,
  NotificationType.payout_statement_confirmed,
  NotificationType.follow_up_assigned,
  NotificationType.follow_up_overdue,
  NotificationType.onboarding_assigned,
  NotificationType.onboarding_due_soon
];

const categoryFilterOrder: NotificationCategory[] = [
  NotificationCategory.message,
  NotificationCategory.event,
  NotificationCategory.task,
  NotificationCategory.offer,
  NotificationCategory.signature,
  NotificationCategory.incoming_update,
  NotificationCategory.follow_up,
  NotificationCategory.onboarding
];

const readStateOptions: OfficeNotificationReadFilter[] = ["all", "unread", "read"];
const notificationViewOptions: OfficeNotificationView[] = ["inbox", "archived"];
const officeNotificationInboxStateKey = "officeInboxState";
const officeNotificationArchivedAtKey = "archivedAt";

type NotificationMetadataValue = Prisma.JsonValue | Prisma.InputJsonValue | null | undefined;

type OfficeNotificationListRecord = {
  id: string;
  type: NotificationType;
  category: NotificationCategory | null;
  severity: NotificationSeverity | null;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
};

type DecoratedOfficeNotificationRecord = OfficeNotificationListRecord & {
  isArchived: boolean;
};

function getNotificationPreferenceField(type: NotificationType): NotificationPreferenceField | null {
  if (
    type === NotificationType.internal_message_received
  ) {
    return "messageAlertsEnabled";
  }

  if (
    type === NotificationType.task_review_requested ||
    type === NotificationType.task_second_review_requested ||
    type === NotificationType.task_rejected ||
    type === NotificationType.signature_pending ||
    type === NotificationType.signature_completed ||
    type === NotificationType.incoming_update_pending_review ||
    type === NotificationType.payout_statement_ready ||
    type === NotificationType.payout_statement_revision_requested ||
    type === NotificationType.payout_statement_confirmed
  ) {
    return "approvalAlertsEnabled";
  }

  if (
    type === NotificationType.appointment_due_soon ||
    type === NotificationType.appointment_external_touch_due ||
    type === NotificationType.follow_up ||
    type === NotificationType.follow_up_assigned ||
    type === NotificationType.follow_up_overdue ||
    type === NotificationType.onboarding_assigned ||
    type === NotificationType.onboarding_due_soon
  ) {
    return "taskRemindersEnabled";
  }

  if (
    type === NotificationType.offer_created ||
    type === NotificationType.offer_received ||
    type === NotificationType.offer_expiring_soon
  ) {
    return "offerAlertsEnabled";
  }

  return null;
}

async function applyNotificationPreferenceFilter(
  db: NotificationDbClient,
  input: {
    organizationId: string;
    membershipIds: string[];
    type: NotificationType;
  }
) {
  if (input.membershipIds.length === 0) {
    return [];
  }

  const preferenceField = getNotificationPreferenceField(input.type);
  const preferences = await db.membershipNotificationPreference.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: {
        in: input.membershipIds
      }
    },
    select: {
      membershipId: true,
      inAppEnabled: true,
      approvalAlertsEnabled: true,
      taskRemindersEnabled: true,
      offerAlertsEnabled: true,
      messageAlertsEnabled: true
    }
  });
  const preferenceMap = new Map(preferences.map((preference) => [preference.membershipId, preference]));

  return input.membershipIds.filter((membershipId) => {
    const preference = preferenceMap.get(membershipId);

    if (!preference) {
      return true;
    }

    if (!preference.inAppEnabled) {
      return false;
    }

    if (!preferenceField) {
      return true;
    }

    return preference[preferenceField];
  });
}

function normalizeNotificationType(value: string | undefined) {
  if (!value) {
    return "";
  }

  return officeNotificationInboxTypes.includes(value as NotificationType) ? (value as NotificationType) : "";
}

function normalizeNotificationCategory(value: string | undefined) {
  if (!value) {
    return "";
  }

  return categoryFilterOrder.includes(value as NotificationCategory) ? (value as NotificationCategory) : "";
}

function normalizeReadState(value: string | undefined): OfficeNotificationReadFilter {
  if (readStateOptions.includes(value as OfficeNotificationReadFilter)) {
    return value as OfficeNotificationReadFilter;
  }

  return "all";
}

function normalizeNotificationView(value: string | undefined): OfficeNotificationView {
  if (notificationViewOptions.includes(value as OfficeNotificationView)) {
    return value as OfficeNotificationView;
  }

  return "inbox";
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTimeLabel(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatPeriodLabel(periodStart: Date, periodEnd: Date) {
  return `${formatDateLabel(periodStart)} to ${formatDateLabel(periodEnd)}`;
}

function getRelativeUrl(value: string | null | undefined) {
  if (!value?.trim()) {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.startsWith("/") ? trimmed : "";
}

function getJsonObject(value: NotificationMetadataValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.InputJsonValue>;
}

function buildOfficeNotificationMetadata(input: {
  metadata: NotificationMetadataValue;
  archivedAt: Date | null;
}): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const nextMetadata = { ...(getJsonObject(input.metadata) ?? {}) };
  const existingInboxState = getJsonObject(nextMetadata[officeNotificationInboxStateKey]);

  if (input.archivedAt) {
    nextMetadata[officeNotificationInboxStateKey] = {
      ...(existingInboxState ?? {}),
      [officeNotificationArchivedAtKey]: input.archivedAt.toISOString()
    };
    return nextMetadata;
  }

  if (existingInboxState) {
    const nextInboxState = { ...existingInboxState };
    delete nextInboxState[officeNotificationArchivedAtKey];

    if (Object.keys(nextInboxState).length > 0) {
      nextMetadata[officeNotificationInboxStateKey] = nextInboxState;
    } else {
      delete nextMetadata[officeNotificationInboxStateKey];
    }
  }

  return Object.keys(nextMetadata).length > 0 ? nextMetadata : Prisma.JsonNull;
}

function getOfficeNotificationArchivedAt(metadata: Prisma.JsonValue | null) {
  const inboxState = getJsonObject(getJsonObject(metadata)?.[officeNotificationInboxStateKey]);
  const archivedAt = inboxState?.[officeNotificationArchivedAtKey];

  return typeof archivedAt === "string" && archivedAt.trim().length > 0 ? archivedAt : "";
}

function isOfficeNotificationArchived(metadata: Prisma.JsonValue | null) {
  return getOfficeNotificationArchivedAt(metadata).length > 0;
}

function matchesNotificationReadState(
  notification: { readAt: Date | null },
  readState: OfficeNotificationReadFilter
) {
  if (readState === "unread") {
    return notification.readAt == null;
  }

  if (readState === "read") {
    return notification.readAt != null;
  }

  return true;
}

function compareOfficeNotifications(
  left: { readAt: Date | null; createdAt: Date },
  right: { readAt: Date | null; createdAt: Date }
) {
  if (left.readAt == null && right.readAt != null) {
    return -1;
  }

  if (left.readAt != null && right.readAt == null) {
    return 1;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function buildNotificationInboxWhere(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  type?: NotificationType | "";
  category?: NotificationCategory | "";
  readState?: OfficeNotificationReadFilter;
}): Prisma.NotificationWhereInput {
  const where: Prisma.NotificationWhereInput = {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    type: input.type || {
      in: officeNotificationInboxTypes
    }
  };

  if (input.officeId) {
    where.OR = [{ officeId: input.officeId }, { officeId: null }];
  }

  if (input.category) {
    where.category = input.category;
  }

  if (input.readState === "unread") {
    where.readAt = null;
  } else if (input.readState === "read") {
    where.readAt = {
      not: null
    };
  }

  return where;
}

function buildVisibleNotificationWhere(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationId?: string;
}): Prisma.NotificationWhereInput {
  const officeScopeOr = input.officeId
    ? [{ officeId: input.officeId }, { officeId: null }]
    : undefined;

  return {
    organizationId: input.organizationId,
    ...(input.notificationId
      ? {
          id: input.notificationId,
        }
      : {}),
    AND: [
      officeScopeOr
        ? {
            OR: officeScopeOr,
          }
        : {},
      {
        OR: [{ membershipId: input.membershipId }, { membershipId: null }],
      },
    ],
  };
}

function buildNotificationScopedWhere(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationId: string;
}): Prisma.NotificationWhereInput {
  return {
    id: input.notificationId,
    ...buildNotificationInboxWhere({
      organizationId: input.organizationId,
      officeId: input.officeId,
      membershipId: input.membershipId
    })
  };
}

async function listActiveMembershipsByIds(
  db: NotificationDbClient,
  organizationId: string,
  membershipIds: string[]
) {
  if (membershipIds.length === 0) {
    return [];
  }

  return db.membership.findMany({
    where: {
      organizationId,
      id: {
        in: membershipIds
      },
      status: "active",
      user: {
        isActive: true
      }
    },
    select: {
      id: true,
      role: true
    }
  });
}

async function normalizeRecipientMembershipIds(db: NotificationDbClient, input: {
  organizationId: string;
  membershipIds: string[];
  excludeMembershipIds?: string[];
  restrictToOfficeRoles?: boolean;
}) {
  const requestedIds = Array.from(new Set(input.membershipIds.filter((value) => value.trim().length > 0)));
  const excludedIds = new Set(input.excludeMembershipIds?.filter((value) => value.trim().length > 0) ?? []);

  if (requestedIds.length === 0) {
    return [];
  }

  const memberships = await listActiveMembershipsByIds(db, input.organizationId, requestedIds);

  return memberships
    .filter((membership) => !excludedIds.has(membership.id))
    .filter((membership) => !input.restrictToOfficeRoles || isOfficeRole(membership.role as UserRole))
    .map((membership) => membership.id);
}

function resolvePermissionGroupMatcher(group: OfficeNotificationPermissionGroup) {
  if (group === "task_reviewers") {
    return canReviewOfficeTasks;
  }

  if (group === "secondary_task_reviewers") {
    return canSecondaryReviewOfficeTasks;
  }

  return canReviewOfficeIncomingUpdates;
}

export async function listOfficeNotificationRecipientIds(
  db: NotificationDbClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    group: OfficeNotificationPermissionGroup;
    excludeMembershipIds?: string[];
    fallbackToExcludedIds?: boolean;
  }
) {
  const memberships = await db.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: "active",
      user: {
        isActive: true
      },
      ...(input.officeId
        ? {
            OR: [{ officeId: input.officeId }, { officeId: null }]
          }
        : {})
    },
    select: {
      id: true,
      role: true
    }
  });

  const matchesGroup = resolvePermissionGroupMatcher(input.group);
  const matchedIds = memberships.filter((membership) => matchesGroup(membership.role as UserRole)).map((membership) => membership.id);
  const excludedIds = new Set(input.excludeMembershipIds?.filter((value) => value.trim().length > 0) ?? []);
  const filteredIds = matchedIds.filter((membershipId) => !excludedIds.has(membershipId));

  if (filteredIds.length > 0 || !input.fallbackToExcludedIds) {
    return filteredIds;
  }

  return matchedIds;
}

export async function createNotificationsForMemberships(db: NotificationDbClient, input: CreateNotificationsForMembershipsInput) {
  const recipientIds = await normalizeRecipientMembershipIds(db, {
    organizationId: input.organizationId,
    membershipIds: input.membershipIds,
    excludeMembershipIds: input.excludeMembershipIds,
    restrictToOfficeRoles: input.restrictToOfficeRoles
  });
  const membershipIds = await applyNotificationPreferenceFilter(db, {
    organizationId: input.organizationId,
    membershipIds: recipientIds,
    type: input.type
  });

  if (membershipIds.length === 0) {
    return 0;
  }

  await Promise.all(
    membershipIds.map((membershipId) =>
      db.notification.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? null,
          membershipId,
          followUpTaskId: input.followUpTaskId ?? null,
          eventId: input.eventId ?? null,
          type: input.type,
          category: input.category ?? null,
          severity: input.severity ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          metadata: input.metadata,
          title: input.title,
          body: input.body,
          actionUrl: getRelativeUrl(input.actionUrl) || null
        }
      })
    )
  );

  return membershipIds.length;
}

export async function ensureNotificationForMemberships(db: NotificationDbClient, input: EnsureNotificationForMembershipsInput) {
  const recipientIds = await normalizeRecipientMembershipIds(db, {
    organizationId: input.organizationId,
    membershipIds: input.membershipIds,
    excludeMembershipIds: input.excludeMembershipIds,
    restrictToOfficeRoles: input.restrictToOfficeRoles
  });
  const membershipIds = await applyNotificationPreferenceFilter(db, {
    organizationId: input.organizationId,
    membershipIds: recipientIds,
    type: input.type
  });

  if (membershipIds.length === 0) {
    return 0;
  }

  let createdCount = 0;

  for (const membershipId of membershipIds) {
    const existing = await db.notification.findFirst({
      where: {
        organizationId: input.organizationId,
        membershipId,
        type: input.type,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null
      },
      select: {
        id: true
      }
    });

    if (existing) {
      continue;
    }

    await db.notification.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        membershipId,
        followUpTaskId: input.followUpTaskId ?? null,
        eventId: input.eventId ?? null,
        type: input.type,
        category: input.category ?? null,
        severity: input.severity ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
        title: input.title,
        body: input.body,
        actionUrl: getRelativeUrl(input.actionUrl) || null
      }
    });

    createdCount += 1;
  }

  return createdCount;
}

export async function upsertNotificationForMemberships(db: NotificationDbClient, input: EnsureNotificationForMembershipsInput) {
  const recipientIds = await normalizeRecipientMembershipIds(db, {
    organizationId: input.organizationId,
    membershipIds: input.membershipIds,
    excludeMembershipIds: input.excludeMembershipIds,
    restrictToOfficeRoles: input.restrictToOfficeRoles
  });
  const membershipIds = await applyNotificationPreferenceFilter(db, {
    organizationId: input.organizationId,
    membershipIds: recipientIds,
    type: input.type
  });

  if (membershipIds.length === 0) {
    return 0;
  }

  let affectedCount = 0;

  for (const membershipId of membershipIds) {
    const existing = await db.notification.findFirst({
      where: {
        organizationId: input.organizationId,
        membershipId,
        type: input.type,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null
      },
      select: {
        id: true,
        metadata: true
      }
    });

    if (existing) {
      await db.notification.update({
        where: {
          id: existing.id
        },
        data: {
          officeId: input.officeId ?? null,
          followUpTaskId: input.followUpTaskId ?? null,
          eventId: input.eventId ?? null,
          category: input.category ?? null,
          severity: input.severity ?? null,
          metadata: buildOfficeNotificationMetadata({
            metadata: input.metadata ?? existing.metadata,
            archivedAt: null
          }),
          title: input.title,
          body: input.body,
          actionUrl: getRelativeUrl(input.actionUrl) || null,
          ...(input.resetReadState === false ? {} : { readAt: null })
        }
      });
    } else {
      await db.notification.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? null,
          membershipId,
          followUpTaskId: input.followUpTaskId ?? null,
          eventId: input.eventId ?? null,
          type: input.type,
          category: input.category ?? null,
          severity: input.severity ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          metadata: input.metadata,
          title: input.title,
          body: input.body,
          actionUrl: getRelativeUrl(input.actionUrl) || null
        }
      });
    }

    affectedCount += 1;
  }

  return affectedCount;
}

function buildAppointmentReminderTitle(startsAt: Date, title: string, now: Date) {
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  if (startsAt < startOfTomorrow) {
    return `Appointment today: ${title}`;
  }

  return `Appointment coming up: ${title}`;
}

function buildAppointmentReminderBody(input: {
  startsAt: Date;
  locationLabel: string;
  clientName?: string | null;
  listingTitle?: string | null;
}) {
  const context = input.clientName?.trim()
    ? `Client ${input.clientName.trim()}`
    : input.listingTitle?.trim()
      ? `Listing ${input.listingTitle.trim()}`
      : "Front Office appointment";

  return `${context} starts on ${formatDateTimeLabel(input.startsAt)}. ${input.locationLabel}.`;
}

function getAppointmentReminderScopeFilter(input: {
  officeId?: string | null;
}) {
  if (!input.officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId: input.officeId }, { officeId: null }],
  };
}

function buildAppointmentExternalTouchReminderTitle(input: {
  title: string;
  externalStatus: ReturnType<
    typeof getFrontOfficeAppointmentExternalWorkflowState
  >["value"];
  nextActionAt: Date;
  now: Date;
}) {
  const isOverdue = input.nextActionAt.getTime() < input.now.getTime();

  if (
    input.externalStatus ===
    frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending
  ) {
    return `${isOverdue ? "Confirmation overdue" : "Confirmation due"}: ${input.title}`;
  }

  if (
    input.externalStatus ===
    frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested
  ) {
    return `${isOverdue ? "Reschedule overdue" : "Reschedule follow-up due"}: ${input.title}`;
  }

  return `${isOverdue ? "External touch overdue" : "External touch due"}: ${input.title}`;
}

function buildAppointmentExternalTouchReminderBody(input: {
  title: string;
  nextActionAt: Date;
  locationLabel: string;
  externalStatusLabel: string;
  note: string | null;
  clientName?: string | null;
  listingTitle?: string | null;
  now: Date;
}) {
  const context = input.clientName?.trim()
    ? `Client ${input.clientName.trim()}`
    : input.listingTitle?.trim()
      ? `Listing ${input.listingTitle.trim()}`
      : "Front Office appointment";
  const timingLabel =
    input.nextActionAt.getTime() < input.now.getTime()
      ? `was due on ${formatDateTimeLabel(input.nextActionAt)}`
      : `is due by ${formatDateTimeLabel(input.nextActionAt)}`;

  return [
    `${context} still needs ${input.externalStatusLabel.toLowerCase()} and ${timingLabel}.`,
    input.locationLabel,
    input.note?.trim() ? `Note: ${input.note.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function reconcileOfficeNotificationReminders(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
}) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 7);
  const appointmentCutoff = new Date(now);
  appointmentCutoff.setHours(appointmentCutoff.getHours() + 24);
  const offerCutoff = new Date(now);
  offerCutoff.setHours(offerCutoff.getHours() + 72);

  await prisma.$transaction(async (tx) => {
    const [
      dueSoonAppointments,
      dueExternalTouchAppointments,
      expiringOffers,
      overdueFollowUpTasks,
      dueClientReminders,
      dueSoonOnboardingItems
    ] = await Promise.all([
      tx.appointment.findMany({
        where: {
          organizationId: input.organizationId,
          ownerMembershipId: input.membershipId,
          status: "scheduled",
          startsAt: {
            gte: now,
            lte: appointmentCutoff
          },
          ...(input.officeId
            ? {
                OR: [{ officeId: input.officeId }, { officeId: null }]
              }
            : {})
        },
        select: {
          id: true,
          title: true,
          officeId: true,
          startsAt: true,
          location: true,
          meetingUrl: true,
          client: {
            select: {
              fullName: true
            }
          },
          listing: {
            select: {
              title: true
            }
          }
        }
      }),
      tx.appointment.findMany({
        where: {
          organizationId: input.organizationId,
          ownerMembershipId: input.membershipId,
          status: "scheduled",
          startsAt: {
            gte: now,
          },
          ...(getAppointmentReminderScopeFilter({
            officeId: input.officeId ?? null,
          }) ?? {}),
        },
        select: {
          id: true,
          title: true,
          officeId: true,
          startsAt: true,
          location: true,
          meetingUrl: true,
          metadata: true,
          client: {
            select: {
              fullName: true,
            },
          },
          listing: {
            select: {
              title: true,
            },
          },
        },
      }),
      tx.offer.findMany({
        where: {
          organizationId: input.organizationId,
          expirationAt: {
            gte: now,
            lte: offerCutoff
          },
          status: {
            notIn: [("accepted" as OfferStatus), ("rejected" as OfferStatus), ("withdrawn" as OfferStatus), ("expired" as OfferStatus)]
          },
          transaction: {
            ownerMembershipId: input.membershipId
          }
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
      }),
      tx.followUpTask.findMany({
        where: {
          organizationId: input.organizationId,
          assigneeMemberId: input.membershipId,
          status: {
            in: [TaskStatus.queued, TaskStatus.in_progress]
          },
          dueAt: {
            lt: now
          }
        },
        include: {
          client: {
            select: {
              id: true,
              fullName: true
            }
          },
          assigneeMembership: {
            select: {
              officeId: true
            }
          }
        }
      }),
      tx.client.findMany({
        where: {
          organizationId: input.organizationId,
          ownerMembershipId: input.membershipId,
          nextFollowUpAt: {
            lt: startOfTomorrow,
          },
          ...(input.officeId
            ? {
                ownerMembership: {
                  officeId: input.officeId,
                },
              }
            : {}),
        },
        select: {
          id: true,
          fullName: true,
          additionalFields: true,
          nextFollowUpAt: true,
          ownerMembership: {
            select: {
              officeId: true,
            },
          },
          followUpTasks: {
            where: {
              status: {
                in: [TaskStatus.queued, TaskStatus.in_progress],
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      }),
      tx.agentOnboardingItem.findMany({
        where: {
          organizationId: input.organizationId,
          membershipId: input.membershipId,
          status: {
            not: "completed"
          },
          dueAt: {
            gte: now,
            lte: soon
          }
        },
        include: {
          membership: {
            select: {
              officeId: true
            }
          }
        }
      })
    ]);

    const dueExternalTouchAppointmentRecords = dueExternalTouchAppointments
      .map((appointment) => {
        const externalWorkflow = getFrontOfficeAppointmentExternalWorkflowState({
          metadata: appointment.metadata,
        });

        if (
          !externalWorkflow.nextActionAt ||
          externalWorkflow.nextActionAt.getTime() > appointmentCutoff.getTime()
        ) {
          return null;
        }

        if (
          externalWorkflow.value !==
            frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp &&
          externalWorkflow.value !==
            frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending &&
          externalWorkflow.value !==
            frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested
        ) {
          return null;
        }

        return {
          appointment,
          externalWorkflow,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    const appointmentReminderScopeWhere = {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      entityType: NotificationEntityType.appointment,
      ...(getAppointmentReminderScopeFilter({
        officeId: input.officeId ?? null,
      }) ?? {}),
    };
    const dueSoonAppointmentIds = new Set(
      dueSoonAppointments.map((appointment) => appointment.id),
    );
    const dueExternalTouchAppointmentIds = new Set(
      dueExternalTouchAppointmentRecords.map(({ appointment }) => appointment.id),
    );
    const actionableClientReminders = dueClientReminders.filter(
      (client) => client.followUpTasks.length === 0 && client.nextFollowUpAt,
    );
    const dueClientIds = new Set(
      actionableClientReminders
        .filter(
          (client) =>
            (client.nextFollowUpAt as Date).getTime() >= startOfToday.getTime(),
        )
        .map((client) => client.id),
    );
    const overdueClientIds = new Set(
      actionableClientReminders
        .filter(
          (client) =>
            (client.nextFollowUpAt as Date).getTime() < startOfToday.getTime(),
        )
        .map((client) => client.id),
    );
    const clientReminderScopeWhere = {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      entityType: NotificationEntityType.client,
      ...(input.officeId
        ? {
            OR: [{ officeId: input.officeId }, { officeId: null }],
          }
        : {}),
    };

    await tx.notification.deleteMany({
      where: {
        ...appointmentReminderScopeWhere,
        type: NotificationType.appointment_due_soon,
        ...(dueSoonAppointmentIds.size
          ? {
              entityId: {
                notIn: [...dueSoonAppointmentIds],
              },
            }
          : {}),
      },
    });

    await tx.notification.deleteMany({
      where: {
        ...appointmentReminderScopeWhere,
        type: NotificationType.appointment_external_touch_due,
        ...(dueExternalTouchAppointmentIds.size
          ? {
              entityId: {
                notIn: [...dueExternalTouchAppointmentIds],
              },
            }
          : {}),
      },
    });

    await tx.notification.deleteMany({
      where: {
        ...clientReminderScopeWhere,
        type: NotificationType.follow_up,
        ...(dueClientIds.size
          ? {
              entityId: {
                notIn: [...dueClientIds],
              },
            }
          : {}),
      },
    });

    await tx.notification.deleteMany({
      where: {
        ...clientReminderScopeWhere,
        type: NotificationType.follow_up_overdue,
        ...(overdueClientIds.size
          ? {
              entityId: {
                notIn: [...overdueClientIds],
              },
            }
          : {}),
      },
    });

    for (const appointment of dueSoonAppointments) {
      await upsertNotificationForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: appointment.officeId ?? input.officeId ?? null,
        membershipIds: [input.membershipId],
        type: NotificationType.appointment_due_soon,
        category: NotificationCategory.event,
        severity:
          appointment.startsAt.getTime() <= now.getTime() + 2 * 60 * 60 * 1000
            ? NotificationSeverity.warning
            : NotificationSeverity.info,
        entityType: NotificationEntityType.appointment,
        entityId: appointment.id,
        title: buildAppointmentReminderTitle(
          appointment.startsAt,
          appointment.title,
          now
        ),
        body: buildAppointmentReminderBody({
          startsAt: appointment.startsAt,
          locationLabel:
            appointment.location?.trim() ||
            appointment.meetingUrl?.trim() ||
            "Location pending",
          clientName: appointment.client?.fullName,
          listingTitle: appointment.listing?.title
        }),
        actionUrl: `/agent/calendar?appointmentId=${appointment.id}`,
        resetReadState: false,
      });
    }

    for (const { appointment, externalWorkflow } of dueExternalTouchAppointmentRecords) {
      await upsertNotificationForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: appointment.officeId ?? input.officeId ?? null,
        membershipIds: [input.membershipId],
        type: NotificationType.appointment_external_touch_due,
        category: NotificationCategory.event,
        severity:
          externalWorkflow.nextActionAt &&
          externalWorkflow.nextActionAt.getTime() < now.getTime()
            ? NotificationSeverity.critical
            : NotificationSeverity.warning,
        entityType: NotificationEntityType.appointment,
        entityId: appointment.id,
        title: buildAppointmentExternalTouchReminderTitle({
          title: appointment.title,
          externalStatus: externalWorkflow.value,
          nextActionAt: externalWorkflow.nextActionAt!,
          now,
        }),
        body: buildAppointmentExternalTouchReminderBody({
          title: appointment.title,
          nextActionAt: externalWorkflow.nextActionAt!,
          locationLabel:
            appointment.location?.trim() ||
            appointment.meetingUrl?.trim() ||
            "Location pending",
          externalStatusLabel: externalWorkflow.label,
          note: externalWorkflow.note,
          clientName: appointment.client?.fullName,
          listingTitle: appointment.listing?.title,
          now,
        }),
        actionUrl: `/agent/calendar?appointmentId=${appointment.id}`,
        metadata: {
          externalStatus: externalWorkflow.value,
          nextActionAt: externalWorkflow.nextActionAt!.toISOString(),
        },
        resetReadState: false,
      });
    }

    for (const offer of expiringOffers) {
      await ensureNotificationForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: offer.transaction.officeId ?? input.officeId ?? null,
        membershipIds: [input.membershipId],
        type: NotificationType.offer_expiring_soon,
        category: NotificationCategory.offer,
        severity: NotificationSeverity.warning,
        entityType: NotificationEntityType.offer,
        entityId: offer.id,
        title: `Offer expiring soon: ${offer.transaction.title}`,
        body: `${offer.title} expires on ${formatDateTimeLabel(offer.expirationAt!)}.`,
        actionUrl: `/office/transactions/${offer.transactionId}#transaction-offers`,
        restrictToOfficeRoles: true
      });
    }

    for (const task of overdueFollowUpTasks) {
      await ensureNotificationForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: task.assigneeMembership?.officeId ?? input.officeId ?? null,
        membershipIds: [input.membershipId],
        type: NotificationType.follow_up_overdue,
        category: NotificationCategory.follow_up,
        severity: NotificationSeverity.warning,
        entityType: NotificationEntityType.follow_up_task,
        entityId: task.id,
        followUpTaskId: task.id,
        title: `Follow-up overdue: ${task.client?.fullName ?? "Contact follow-up"}`,
        body: `${task.title} was due on ${formatDateLabel(task.dueAt!)} and is still open.`,
        actionUrl: task.clientId ? `/office/contacts/${task.clientId}` : "/office/contacts",
        restrictToOfficeRoles: true
      });
    }

    for (const client of actionableClientReminders) {
      const displayName = getClientDisplayName({
        fullName: client.fullName,
        additionalFields: client.additionalFields,
      });
      const isOverdue =
        (client.nextFollowUpAt as Date).getTime() < startOfToday.getTime();

      await upsertNotificationForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: client.ownerMembership?.officeId ?? input.officeId ?? null,
        membershipIds: [input.membershipId],
        type: isOverdue
          ? NotificationType.follow_up_overdue
          : NotificationType.follow_up,
        category: NotificationCategory.follow_up,
        severity: isOverdue
          ? NotificationSeverity.critical
          : NotificationSeverity.warning,
        entityType: NotificationEntityType.client,
        entityId: client.id,
        title: isOverdue
          ? `Follow-up overdue: ${displayName}`
          : `Follow-up due: ${displayName}`,
        body: isOverdue
          ? `Next follow-up was planned for ${formatDateLabel(client.nextFollowUpAt as Date)} and still needs an update.`
          : `Next follow-up is due on ${formatDateLabel(client.nextFollowUpAt as Date)}.`,
        actionUrl: `/agent/clients/${client.id}`,
        resetReadState: false,
      });
    }

    for (const item of dueSoonOnboardingItems) {
      await ensureNotificationForMemberships(tx, {
        organizationId: input.organizationId,
        officeId: item.membership.officeId ?? input.officeId ?? null,
        membershipIds: [input.membershipId],
        type: NotificationType.onboarding_due_soon,
        category: NotificationCategory.onboarding,
        severity: NotificationSeverity.warning,
        entityType: NotificationEntityType.agent_onboarding_item,
        entityId: item.id,
        title: "Onboarding item due soon",
        body: `${item.title} is due on ${formatDateLabel(item.dueAt!)}.`,
        actionUrl: `/office/agents/${input.membershipId}#onboarding`,
        restrictToOfficeRoles: true
      });
    }
  });
}

export async function listOfficeNotifications(input: ListOfficeNotificationsInput): Promise<OfficeNotificationsSnapshot> {
  await reconcileOfficeNotificationReminders({
    organizationId: input.organizationId,
    officeId: input.officeId ?? null,
    membershipId: input.membershipId
  });

  const selectedView = normalizeNotificationView(input.view);
  const selectedType = normalizeNotificationType(input.type);
  const selectedCategory = normalizeNotificationCategory(input.category);
  const readState = normalizeReadState(input.readState);
  const baseWhere = buildNotificationInboxWhere({
    organizationId: input.organizationId,
    officeId: input.officeId ?? null,
    membershipId: input.membershipId,
  });

  const payoutStatementWhere: Prisma.AgentPayoutStatementWhereInput = {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    reviewStatus: "awaiting_agent",
    ...(input.officeId
      ? {
          OR: [{ officeId: input.officeId }, { officeId: null }]
        }
      : {})
  };

  const [notificationRecords, payoutReviewCount, payoutReviewStatements] = await Promise.all([
    prisma.notification.findMany({
      where: baseWhere,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        category: true,
        severity: true,
        title: true,
        body: true,
        actionUrl: true,
        readAt: true,
        createdAt: true,
        metadata: true
      }
    }),
    prisma.agentPayoutStatement.count({
      where: payoutStatementWhere
    }),
    prisma.agentPayoutStatement.findMany({
      where: payoutStatementWhere,
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        generatedAt: true,
        totalStatementAmount: true
      },
      orderBy: [{ generatedAt: "desc" }],
      take: 5
    })
  ]);

  const allNotifications: DecoratedOfficeNotificationRecord[] = notificationRecords.map((notification) => ({
    ...notification,
    isArchived: isOfficeNotificationArchived(notification.metadata)
  }));
  const activeNotifications = allNotifications.filter((notification) => !notification.isArchived);
  const archivedNotifications = allNotifications.filter((notification) => notification.isArchived);
  const notificationsInSelectedView = (selectedView === "archived" ? archivedNotifications : activeNotifications).filter(
    (notification) =>
      (!selectedType || notification.type === selectedType) &&
      (!selectedCategory || notification.category === selectedCategory) &&
      matchesNotificationReadState(notification, readState)
  );
  const filteredNotifications = [...notificationsInSelectedView].sort(compareOfficeNotifications);
  const activeUnreadNotifications = activeNotifications.filter((notification) => !notification.readAt);
  const typeCounts = new Map<NotificationType, number>();
  const categoryCounts = new Map<NotificationCategory, number>();

  for (const notification of selectedView === "archived" ? archivedNotifications : activeNotifications) {
    typeCounts.set(notification.type, (typeCounts.get(notification.type) ?? 0) + 1);

    if (notification.category) {
      categoryCounts.set(notification.category, (categoryCounts.get(notification.category) ?? 0) + 1);
    }
  }

  const groupsByDate = new Map<string, OfficeNotificationGroup>();
  for (const notification of filteredNotifications) {
    const groupKey = notification.createdAt.toISOString().slice(0, 10);
    const group = groupsByDate.get(groupKey) ?? {
      key: groupKey,
      label: formatDateLabel(notification.createdAt),
      notifications: []
    };

    group.notifications.push({
      id: notification.id,
      type: notification.type,
      typeLabel: notificationTypeLabelMap[notification.type],
      category: notification.category,
      categoryLabel: notification.category ? notificationCategoryLabelMap[notification.category] : "General",
      severity: notification.severity ?? NotificationSeverity.info,
      severityLabel: notificationSeverityLabelMap[notification.severity ?? NotificationSeverity.info],
      title: notification.title,
      body: notification.body,
      actionUrl: getRelativeUrl(notification.actionUrl),
      openHref: `/office/notifications/${notification.id}/open`,
      isUnread: !notification.readAt,
      isArchived: notification.isArchived,
      createdAt: notification.createdAt.toISOString(),
      createdAtLabel: formatDateTimeLabel(notification.createdAt),
      inboxStateLabel: notification.isArchived ? "Archived" : "Inbox",
      readStateLabel: notification.readAt ? "Read" : "Unread"
    });

    groupsByDate.set(groupKey, group);
  }

  const typeOptions = typeFilterOrder
    .map((type) => ({
      value: type,
      label: notificationTypeLabelMap[type],
      count: typeCounts.get(type) ?? 0
    }))
    .filter((option) => option.count > 0 || option.value === selectedType);

  const categoryOptions = categoryFilterOrder
    .map((category) => ({
      value: category,
      label: notificationCategoryLabelMap[category],
      count: categoryCounts.get(category) ?? 0
    }))
    .filter((option) => option.count > 0 || option.value === selectedCategory);
  const payoutReviewQueue = payoutReviewStatements.map((statement) => ({
    statementId: statement.id,
    periodLabel: formatPeriodLabel(statement.periodStart, statement.periodEnd),
    generatedAt: statement.generatedAt.toISOString(),
    generatedAtLabel: formatDateTimeLabel(statement.generatedAt),
    totalStatementAmountLabel: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: Number(statement.totalStatementAmount ?? 0) % 1 === 0 ? 0 : 2
    }).format(Number(statement.totalStatementAmount ?? 0)),
    openHref: `/office/payout-statements/${statement.id}`
  }));

  return {
    filters: {
      view: selectedView,
      type: selectedType,
      category: selectedCategory,
      readState
    },
    summary: {
      totalCount: allNotifications.length,
      activeCount: activeNotifications.length,
      archivedCount: archivedNotifications.length,
      unreadCount: activeUnreadNotifications.length,
      reviewCount: activeUnreadNotifications.filter((notification) =>
        notification.type === NotificationType.task_review_requested ||
        notification.type === NotificationType.task_second_review_requested ||
        notification.type === NotificationType.incoming_update_pending_review
      ).length,
      timeSensitiveCount: activeUnreadNotifications.filter((notification) =>
        notification.type === NotificationType.appointment_due_soon ||
        notification.type === NotificationType.appointment_external_touch_due ||
        notification.type === NotificationType.offer_expiring_soon ||
        notification.type === NotificationType.follow_up_overdue ||
        notification.type === NotificationType.onboarding_due_soon
      ).length,
      payoutReviewCount
    },
    totalCount: filteredNotifications.length,
    unreadCount: filteredNotifications.filter((notification) => !notification.readAt).length,
    payoutReviewQueue,
    groups: Array.from(groupsByDate.values()),
    typeOptions,
    categoryOptions
  };
}

export async function markOfficeNotificationRead(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationId: string;
}) {
  const result = await prisma.notification.updateMany({
    where: {
      ...buildNotificationScopedWhere(input),
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  return result.count > 0;
}

export async function markOfficeNotificationUnread(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationId: string;
}) {
  const result = await prisma.notification.updateMany({
    where: buildNotificationScopedWhere(input),
    data: {
      readAt: null
    }
  });

  return result.count > 0;
}

async function updateOfficeNotificationArchiveState(
  input: {
    organizationId: string;
    officeId?: string | null;
    membershipId: string;
    notificationId: string;
  },
  archivedAt: Date | null
) {
  const notification = await prisma.notification.findFirst({
    where: buildNotificationScopedWhere(input),
    select: {
      id: true,
      metadata: true,
      readAt: true
    }
  });

  if (!notification) {
    return false;
  }

  await prisma.notification.update({
    where: {
      id: notification.id
    },
    data: {
      metadata: buildOfficeNotificationMetadata({
        metadata: notification.metadata,
        archivedAt
      }),
      ...(archivedAt && !notification.readAt
        ? {
            readAt: archivedAt
          }
        : {})
    }
  });

  return true;
}

export async function archiveOfficeNotification(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationId: string;
}) {
  return updateOfficeNotificationArchiveState(input, new Date());
}

export async function unarchiveOfficeNotification(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationId: string;
}) {
  return updateOfficeNotificationArchiveState(input, null);
}

export async function markAllOfficeNotificationsRead(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  type?: string;
  category?: string;
}) {
  const where = buildNotificationInboxWhere({
    organizationId: input.organizationId,
    officeId: input.officeId ?? null,
    membershipId: input.membershipId,
    type: normalizeNotificationType(input.type),
    category: normalizeNotificationCategory(input.category)
  });

  const result = await prisma.notification.updateMany({
    where: {
      ...where,
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  return result.count;
}

export async function markOfficeNotificationsReadByIds(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationIds: string[];
}) {
  const notificationIds = Array.from(
    new Set(
      input.notificationIds
        .map((notificationId) => notificationId.trim())
        .filter(Boolean),
    ),
  );

  if (!notificationIds.length) {
    return 0;
  }

  const result = await prisma.notification.updateMany({
    where: {
      ...buildNotificationInboxWhere({
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        membershipId: input.membershipId,
      }),
      id: {
        in: notificationIds,
      },
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return result.count;
}

export async function markOfficeNotificationsUnreadByIds(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationIds: string[];
}) {
  const notificationIds = Array.from(
    new Set(
      input.notificationIds
        .map((notificationId) => notificationId.trim())
        .filter(Boolean),
    ),
  );

  if (!notificationIds.length) {
    return 0;
  }

  const result = await prisma.notification.updateMany({
    where: {
      ...buildNotificationInboxWhere({
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        membershipId: input.membershipId,
      }),
      id: {
        in: notificationIds,
      },
      readAt: {
        not: null,
      },
    },
    data: {
      readAt: null,
    },
  });

  return result.count;
}

export async function openOfficeNotification(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  notificationId: string;
  fallbackUrl?: string;
}) {
  const notification = await prisma.notification.findFirst({
    where: buildVisibleNotificationWhere({
      organizationId: input.organizationId,
      officeId: input.officeId,
      membershipId: input.membershipId,
      notificationId: input.notificationId,
    }),
    select: {
      id: true,
      membershipId: true,
      readAt: true,
      actionUrl: true
    }
  });

  if (!notification) {
    return "";
  }

  if (!notification.readAt && notification.membershipId) {
    await prisma.notification.update({
      where: {
        id: notification.id
      },
      data: {
        readAt: new Date()
      }
    });
  }

  return getRelativeUrl(notification.actionUrl) || getRelativeUrl(input.fallbackUrl) || "/office/notifications";
}
