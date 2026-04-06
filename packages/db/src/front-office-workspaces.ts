import {
  AppointmentStatus,
  AppointmentType,
  ListingStatus,
  NotificationSeverity,
  NotificationType,
  Prisma,
  ResourceType,
  UserRole,
} from "@prisma/client";
import { resolveOfficeDataScope } from "./access";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import {
  frontOfficeAppointmentExternalWorkflowStatuses,
  getFrontOfficeAppointmentExternalWorkflowState,
} from "./front-office-appointments";
import { resolveLeaseReminderDates } from "./lease-reminders";
import { reconcileOfficeNotificationReminders } from "./notifications";

export type FrontOfficeWorkspaceInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
  targetClientId?: string | null;
  targetAppointmentId?: string | null;
};

export type FrontOfficeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

const frontOfficeActivityNotificationGroupKeys = [
  "appointment_soon",
  "confirmation_due",
  "reschedule_due",
  "external_touch_due",
  "general_notice",
] as const;
type FrontOfficeActivityNotificationGroupKey =
  (typeof frontOfficeActivityNotificationGroupKeys)[number];

const frontOfficeActivityNotificationStreamKeys = [
  "front_office",
  "back_office",
  "shared_notice",
  "reference",
] as const;
type FrontOfficeActivityNotificationStreamKey =
  (typeof frontOfficeActivityNotificationStreamKeys)[number];

const frontOfficeActivityNotificationOwnerKeys = [
  "assigned_to_viewer",
  "shared_office",
] as const;
type FrontOfficeActivityNotificationOwnerKey =
  (typeof frontOfficeActivityNotificationOwnerKeys)[number];

const frontOfficeActivityNotificationScopeKeys = [
  "meeting_countdown",
  "calendar_writeback",
  "front_office_action",
  "back_office_handoff",
  "shared_office_notice",
  "awareness_only",
] as const;
type FrontOfficeActivityNotificationScopeKey =
  (typeof frontOfficeActivityNotificationScopeKeys)[number];

const frontOfficeActivityNotificationPressureKeys = [
  "confirmation_due",
  "confirmation_overdue",
  "reschedule_due",
  "reschedule_overdue",
  "touch_due",
  "touch_overdue",
  "starts_within_2h",
  "starts_today",
  "coming_up",
  "shared_visibility",
  "action_now",
  "needs_review",
  "new_notice",
  "reviewed",
] as const;
type FrontOfficeActivityNotificationPressureKey =
  (typeof frontOfficeActivityNotificationPressureKeys)[number];

const frontOfficeActivityCleanupKindKeys = [
  "follow_up",
  "appointment_writeback",
  "send_risk",
  "stale_client",
] as const;
type FrontOfficeActivityCleanupKindKey =
  (typeof frontOfficeActivityCleanupKindKeys)[number];

const frontOfficeActivityCleanupFilterKeys = [
  "all",
  "follow_up",
  "appointment_writeback",
  "send_risk",
  "stale_client",
  "duplicate_review",
] as const;
type FrontOfficeActivityCleanupFilterKey =
  (typeof frontOfficeActivityCleanupFilterKeys)[number];

const frontOfficeActivityCleanupOwnerKeys = ["assigned_to_viewer"] as const;
type FrontOfficeActivityCleanupOwnerKey =
  (typeof frontOfficeActivityCleanupOwnerKeys)[number];

const frontOfficeActivityCleanupScopeKeys = [
  "meeting_countdown",
  "calendar_writeback",
  "follow_up_task",
  "client_next_touch",
  "tracked_send_rescue",
  "client_freshness",
] as const;
type FrontOfficeActivityCleanupScopeKey =
  (typeof frontOfficeActivityCleanupScopeKeys)[number];

const frontOfficeActivityCleanupPressureKeys = [
  "reschedule_requested",
  "confirmation_due",
  "confirmation_overdue",
  "touch_due",
  "touch_overdue",
  "starts_within_2h",
  "starts_today",
  "coming_up",
  "overdue",
  "due_today",
  "send_unopened_3_days",
  "send_quiet_after_open",
  "stale_15_days",
  "stale_30_days",
] as const;
type FrontOfficeActivityCleanupPressureKey =
  (typeof frontOfficeActivityCleanupPressureKeys)[number];

const frontOfficeActivityNoticeFilterKeys = [
  "all",
  "appointment_soon",
  "confirmation_due",
  "reschedule_due",
  "external_touch_due",
  "general_notice",
] as const;
type FrontOfficeActivityNoticeFilterKey =
  (typeof frontOfficeActivityNoticeFilterKeys)[number];

const frontOfficeActivityNoticeStreamFilterKeys = [
  "all",
  "front_office",
  "back_office",
  "shared_notice",
  "reference",
] as const;
type FrontOfficeActivityNoticeStreamFilterKey =
  (typeof frontOfficeActivityNoticeStreamFilterKeys)[number];

const frontOfficeActivityReadStateKeys = ["all", "unread", "read"] as const;
type FrontOfficeActivityReadState =
  (typeof frontOfficeActivityReadStateKeys)[number];

type FrontOfficeActivityFilterOption<TValue extends string> = {
  value: TValue;
  label: string;
  count: number;
};

type FrontOfficeActivityFilterContract<TValue extends string> = {
  defaultValue: TValue;
  paramKey: string;
  options: FrontOfficeActivityFilterOption<TValue>[];
};

type FrontOfficeActivityNoticeFilterContract =
  FrontOfficeActivityFilterContract<FrontOfficeActivityNoticeFilterKey> & {
    activityViewRules: {
      appointmentRemindersDisallow: "general_notice";
      generalNoticesForce: "general_notice";
    };
  };

type FrontOfficeActivityNoticeStreamFilterContract =
  FrontOfficeActivityFilterContract<FrontOfficeActivityNoticeStreamFilterKey> & {
    appliesToGroupKey: "general_notice";
  };

type FrontOfficeActivityReadStateFilterContract =
  FrontOfficeActivityFilterContract<FrontOfficeActivityReadState> & {
    sharedNoticeBehavior: "shared_notices_ignore_read_state";
  };

type FrontOfficeActivityCleanupMetricCountMode =
  | "raw_pressure"
  | "surfaced_items";

type FrontOfficeActivityCounts = {
  notifications: {
    visibleCount: number;
    personalVisibleCount: number;
    mutableVisibleCount: number;
    sharedVisibleCount: number;
    unreadPersonalVisibleCount: number;
    unreadPersonalTotalCount: number;
    appointmentReminderVisibleCount: number;
    generalNoticeVisibleCount: number;
    byGroup: Record<FrontOfficeActivityNotificationGroupKey, number>;
    generalByStream: Record<FrontOfficeActivityNotificationStreamKey, number>;
  };
  cleanup: {
    surfacedCount: number;
    surfacedItemCount: number;
    duplicateReviewCount: number;
    urgentSurfacedCount: number;
    totalPressureCount: number;
    visibleByKind: Record<FrontOfficeActivityCleanupKindKey, number>;
    totalByKind: Record<FrontOfficeActivityCleanupKindKey, number>;
    visibleByFilter: Record<FrontOfficeActivityCleanupFilterKey, number>;
  };
  events: {
    visibleCount: number;
  };
};

export type FrontOfficeClientRecord = {
  id: string;
  fullName: string;
  stage: string;
  stageTone: FrontOfficeTone;
  intentLabel: string;
  budgetLabel: string;
  areasLabel: string;
  sourceLabel: string;
  lastTouchLabel: string;
  nextTouchLabel: string;
  href: string;
};

export type FrontOfficeClientsSnapshot = {
  summary: {
    liveContacts: number;
    activeStages: number;
    followUpDueCount: number;
    overdueTaskCount: number;
    potentialDuplicateCount: number;
  };
  stageMetrics: Array<{
    label: string;
    count: number;
    tone: FrontOfficeTone;
  }>;
  clients: FrontOfficeClientRecord[];
  duplicatePairs: FrontOfficeClientDuplicatePair[];
};

export type FrontOfficeClientDuplicateRecord = {
  id: string;
  fullName: string;
  href: string;
  reviewLabel: string;
  stage: string;
  stageTone: FrontOfficeTone;
  sourceLabel: string;
  nextTouchLabel: string;
  detailLabel: string;
  lastUpdatedLabel: string;
  ownerLabel: string;
  scopeLabel: string;
};

export type FrontOfficeClientDuplicatePair = {
  id: string;
  matchReasons: string[];
  rationaleLabel: string;
  recommendedClient: FrontOfficeClientDuplicateRecord;
  duplicateClient: FrontOfficeClientDuplicateRecord;
};

export type FrontOfficeListingRecord = {
  id: string;
  title: string;
  areaLabel: string;
  summaryLabel: string;
  priceLabel: string;
  cityLabel: string;
  statusLabel: string;
  statusTone: FrontOfficeTone;
  trackedClickCount: number;
  trackedLinkCount: number;
};

export type FrontOfficeAgentMaterialFeaturedCase = {
  id: string;
  label: string;
  closingLabel: string;
  priceLabel: string;
  href: string;
};

export type FrontOfficeAgentMaterialSnapshot = {
  displayName: string;
  titleLabel: string;
  officeLabel: string;
  bioLabel: string;
  avatarUrl: string;
  avatarFallback: string;
  email: string;
  phone: string;
  licenseLabel: string;
  recentClosedCount: number;
  featuredCaseCount: number;
  portraitReady: boolean;
  businessCardText: string;
  introEmailText: string;
  introTextMessage: string;
  featuredCases: FrontOfficeAgentMaterialFeaturedCase[];
};

export type FrontOfficeListingsTargetClient = {
  id: string;
  fullName: string;
  stage: string;
  stageTone: FrontOfficeTone;
  nextTouchLabel: string;
  href: string;
};

export type FrontOfficeListingsTargetAppointment = {
  id: string;
  title: string;
  typeLabel: string;
  statusLabel: string;
  statusTone: FrontOfficeTone;
  startsAtLabel: string;
  locationLabel: string;
  href: string;
};

export type FrontOfficeListingsSnapshot = {
  summary: {
    listingCount: number;
    publicReadyCount: number;
    trackedClicks: number;
    trackedLinks: number;
  };
  targetClient: FrontOfficeListingsTargetClient | null;
  targetAppointment: FrontOfficeListingsTargetAppointment | null;
  agentMaterial: FrontOfficeAgentMaterialSnapshot;
  listings: FrontOfficeListingRecord[];
};

export type FrontOfficeResourceRecord = {
  id: string;
  title: string;
  summary: string;
  typeLabel: string;
  tags: string[];
  href: string;
};

export type FrontOfficeVendorRecord = {
  id: string;
  name: string;
  category: string;
  headline: string;
  neighborhoodsLabel: string;
  contactLabel: string;
  href: string | null;
};

export type FrontOfficeResourcesSnapshot = {
  summary: {
    resourceCount: number;
    vendorCount: number;
    resourceTypeCount: number;
  };
  resources: FrontOfficeResourceRecord[];
  vendors: FrontOfficeVendorRecord[];
};

export type FrontOfficeActivityNotificationRecord = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  typeLabel: string;
  groupKey: FrontOfficeActivityNotificationGroupKey;
  groupLabel: string;
  streamKey: FrontOfficeActivityNotificationStreamKey;
  streamLabel: string;
  audienceLabel: "Personal notice" | "Shared office notice";
  ownerKey: FrontOfficeActivityNotificationOwnerKey;
  ownerLabel: string;
  scopeKey: FrontOfficeActivityNotificationScopeKey;
  scopeLabel: string;
  pressureKey: FrontOfficeActivityNotificationPressureKey;
  pressureLabel: string;
  pressureTone: FrontOfficeTone;
  whyNowLabel: string;
  tone: FrontOfficeTone;
  createdAtLabel: string;
  actionLabel: string;
  href: string;
  isUnread: boolean;
  readStateLabel: "Unread" | "Read" | "Shared notice";
  readStateMutable: boolean;
};

export type FrontOfficeActivityEventRecord = {
  id: string;
  title: string;
  typeLabel: string;
  visibilityLabel: string;
  locationLabel: string;
  startsAtLabel: string;
  rsvpLabel: string;
  href: string;
};

export type FrontOfficeActivityCleanupMetric = {
  key: FrontOfficeActivityCleanupFilterKey;
  label: string;
  count: number;
  visibleCount: number;
  countMode: FrontOfficeActivityCleanupMetricCountMode;
  tone: FrontOfficeTone;
  helper: string;
};

export type FrontOfficeActivityCleanupItem = {
  id: string;
  kindKey: FrontOfficeActivityCleanupKindKey;
  kindLabel: string;
  tone: FrontOfficeTone;
  title: string;
  description: string;
  ownerKey: FrontOfficeActivityCleanupOwnerKey;
  ownerLabel: string;
  scopeKey: FrontOfficeActivityCleanupScopeKey;
  scopeLabel: string;
  pressureKey: FrontOfficeActivityCleanupPressureKey;
  pressureLabel: string;
  whyNowLabel: string;
  sortLabel: string;
  metaLabels: string[];
  href: string;
  actionLabel: string;
};

export type FrontOfficeActivitySnapshot = {
  summary: {
    actionableItemCount: number;
    upcomingEventCount: number;
    unreadNoticeCount: number;
    cleanupItemCount: number;
    duplicateReviewCount: number;
    appointmentSoonCount: number;
    sharedNoticeCount: number;
    urgentCleanupCount: number;
  };
  counts: FrontOfficeActivityCounts;
  filters: {
    cleanup: FrontOfficeActivityFilterContract<FrontOfficeActivityCleanupFilterKey>;
    notices: FrontOfficeActivityNoticeFilterContract;
    noticeLanes: FrontOfficeActivityNoticeStreamFilterContract;
    readState: FrontOfficeActivityReadStateFilterContract;
  };
  notifications: FrontOfficeActivityNotificationRecord[];
  events: FrontOfficeActivityEventRecord[];
  cleanup: {
    metrics: FrontOfficeActivityCleanupMetric[];
    items: FrontOfficeActivityCleanupItem[];
    duplicatePairs: FrontOfficeClientDuplicatePair[];
  };
};

const frontOfficeActivityCleanupFilterLabels: Record<
  FrontOfficeActivityCleanupFilterKey,
  string
> = {
  all: "All personal cleanup",
  follow_up: "Follow-up due",
  appointment_writeback: "Appointment writeback",
  send_risk: "Send-trail risk",
  stale_client: "Stale dossiers",
  duplicate_review: "Duplicate review",
};

const frontOfficeActivityNoticeFilterLabels: Record<
  FrontOfficeActivityNoticeFilterKey,
  string
> = {
  all: "All notices",
  appointment_soon: "Appointment soon",
  confirmation_due: "Confirmation due",
  reschedule_due: "Reschedule follow-up",
  external_touch_due: "External touch due",
  general_notice: "General notices",
};

const frontOfficeActivityNoticeStreamFilterLabels: Record<
  FrontOfficeActivityNoticeStreamFilterKey,
  string
> = {
  all: "All notice lanes",
  front_office: "FO actions",
  back_office: "BO handoff",
  shared_notice: "Shared office notices",
  reference: "Awareness only",
};

const frontOfficeActivityReadStateLabels: Record<
  FrontOfficeActivityReadState,
  string
> = {
  all: "All",
  unread: "Unread only",
  read: "Read only",
};

function buildNotificationGroupCountRecord() {
  return {
    appointment_soon: 0,
    confirmation_due: 0,
    reschedule_due: 0,
    external_touch_due: 0,
    general_notice: 0,
  } satisfies Record<FrontOfficeActivityNotificationGroupKey, number>;
}

function buildNotificationStreamCountRecord() {
  return {
    front_office: 0,
    back_office: 0,
    shared_notice: 0,
    reference: 0,
  } satisfies Record<FrontOfficeActivityNotificationStreamKey, number>;
}

function buildCleanupKindCountRecord() {
  return {
    follow_up: 0,
    appointment_writeback: 0,
    send_risk: 0,
    stale_client: 0,
  } satisfies Record<FrontOfficeActivityCleanupKindKey, number>;
}

function buildCleanupFilterCountRecord() {
  return {
    all: 0,
    follow_up: 0,
    appointment_writeback: 0,
    send_risk: 0,
    stale_client: 0,
    duplicate_review: 0,
  } satisfies Record<FrontOfficeActivityCleanupFilterKey, number>;
}

const openFollowUpStatuses = ["queued", "in_progress"] as const;
const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];

function formatCurrency(value: Prisma.Decimal | number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

function formatBudgetRange(
  min: Prisma.Decimal | number | null | undefined,
  max: Prisma.Decimal | number | null | undefined,
) {
  const minValue = Number(min ?? 0);
  const maxValue = Number(max ?? 0);

  if (minValue > 0 && maxValue > 0) {
    return `${formatCurrency(minValue)} - ${formatCurrency(maxValue)}`;
  }

  if (maxValue > 0) {
    return `Up to ${formatCurrency(maxValue)}`;
  }

  if (minValue > 0) {
    return `From ${formatCurrency(minValue)}`;
  }

  return "Budget not captured";
}

function formatDateLabel(
  value: Date | null | undefined,
  timeZone?: string | null,
) {
  if (!value) {
    return "—";
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timeZone ?? undefined,
  });
}

function formatRelativeDueLabel(
  value: Date | null | undefined,
  now: Date,
  timeZone?: string | null,
) {
  if (!value) {
    return "No follow-up scheduled";
  }

  const dueTime = value.getTime();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();

  if (dueTime < startOfToday) {
    return `Overdue since ${formatDateLabel(value, timeZone)}`;
  }

  if (dueTime < startOfTomorrow) {
    return `Due today · ${formatDateTimeLabel(value, { timeZone: timeZone ?? null })}`;
  }

  return `Next follow-up · ${formatDateLabel(value, timeZone)}`;
}

function formatNextTouchLabel(input: {
  nextFollowUpAt: Date | null;
  leaseReminderAt: Date | null;
  now: Date;
  timeZone?: string | null;
}) {
  const leaseReminder = resolveLeaseReminderDates({
    leaseEndDate: null,
    leaseReminderAt: input.leaseReminderAt,
  });

  if (
    leaseReminder.leaseReminderAt &&
    (!input.nextFollowUpAt ||
      leaseReminder.leaseReminderAt.getTime() <= input.nextFollowUpAt.getTime())
  ) {
    const reminderTime = leaseReminder.leaseReminderAt.getTime();
    const startOfToday = new Date(
      input.now.getFullYear(),
      input.now.getMonth(),
      input.now.getDate(),
    ).getTime();
    const startOfTomorrow = new Date(
      input.now.getFullYear(),
      input.now.getMonth(),
      input.now.getDate() + 1,
    ).getTime();

    if (reminderTime < startOfToday) {
      return `Lease reminder overdue since ${formatDateLabel(leaseReminder.leaseReminderAt, input.timeZone)}`;
    }

    if (reminderTime < startOfTomorrow) {
      return `Lease reminder · ${formatDateTimeLabel(leaseReminder.leaseReminderAt, { timeZone: input.timeZone ?? null })}`;
    }

    return `Lease reminder · ${formatDateLabel(leaseReminder.leaseReminderAt, input.timeZone)}`;
  }

  return formatRelativeDueLabel(
    input.nextFollowUpAt,
    input.now,
    input.timeZone,
  );
}

function buildElapsedDayCount(value: Date, now: Date, minimum = 1) {
  return Math.max(
    minimum,
    Math.floor((now.getTime() - value.getTime()) / 86_400_000),
  );
}

function mapClientStageTone(stage: string): FrontOfficeTone {
  const normalized = stage.trim().toLowerCase();

  if (!normalized) {
    return "neutral";
  }

  if (normalized.includes("won")) {
    return "success";
  }

  if (normalized.includes("lost")) {
    return "danger";
  }

  if (
    normalized.includes("negotiation") ||
    normalized.includes("offer") ||
    normalized.includes("application")
  ) {
    return "warning";
  }

  if (
    normalized.includes("tour") ||
    normalized.includes("viewing") ||
    normalized.includes("contacted") ||
    normalized.includes("warm")
  ) {
    return "accent";
  }

  return "neutral";
}

function normalizeDuplicateName(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}

function normalizeDuplicateEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function normalizeDuplicatePhone(value: string | null | undefined) {
  return value?.replace(/\D/g, "") || "";
}

type DuplicateCandidate = {
  id: string;
  fullName: string;
  ownerMembershipId: string | null;
  ownerLabel: string;
  email: string | null;
  phone: string | null;
  source: string;
  stage: string;
  budgetMin: Prisma.Decimal | null;
  budgetMax: Prisma.Decimal | null;
  preferredAreas: string[];
  notes: string | null;
  lastContactAt: Date | null;
  nextFollowUpAt: Date | null;
  leaseReminderAt: Date | null;
  updatedAt: Date;
  _count: {
    appointments: number;
    frontOfficeSendRecords: number;
    followUpTasks: number;
    handoffDrafts: number;
    transactionContacts: number;
    stageHistory: number;
  };
};

function buildVisibleContactScopeWhere(
  scope: Awaited<ReturnType<typeof resolveOfficeDataScope>>,
  officeId: string | null | undefined,
): Prisma.ClientWhereInput[] {
  const whereConditions: Prisma.ClientWhereInput[] = [];

  if (scope.visibleMembershipIds !== null) {
    whereConditions.push({
      ownerMembershipId: {
        in:
          scope.visibleMembershipIds.length > 0
            ? scope.visibleMembershipIds
            : [scope.viewerMembershipId],
      },
    });
  }

  if (officeId) {
    whereConditions.push({
      ownerMembership: {
        officeId,
      },
    });
  }

  return whereConditions;
}

function buildDuplicateCandidateStrengthScore(candidate: DuplicateCandidate) {
  return (
    (candidate.email?.trim() ? 4 : 0) +
    (candidate.phone?.trim() ? 4 : 0) +
    (candidate.notes?.trim() ? 3 : 0) +
    (candidate.preferredAreas.length > 0 ? 2 : 0) +
    (candidate.budgetMin || candidate.budgetMax ? 2 : 0) +
    (candidate.lastContactAt ? 2 : 0) +
    (candidate.nextFollowUpAt ? 2 : 0) +
    candidate._count.followUpTasks * 3 +
    candidate._count.transactionContacts * 4 +
    candidate._count.appointments * 2 +
    candidate._count.frontOfficeSendRecords * 2 +
    candidate._count.handoffDrafts * 2 +
    candidate._count.stageHistory
  );
}

function buildDuplicateCandidateDetailLabel(candidate: DuplicateCandidate) {
  const labels = [
    candidate._count.followUpTasks > 0
      ? `${candidate._count.followUpTasks} follow-up task(s)`
      : null,
    candidate._count.appointments > 0
      ? `${candidate._count.appointments} appointment(s)`
      : null,
    candidate._count.frontOfficeSendRecords > 0
      ? `${candidate._count.frontOfficeSendRecords} tracked send(s)`
      : null,
    candidate._count.transactionContacts > 0
      ? `${candidate._count.transactionContacts} BO link(s)`
      : null,
    candidate.preferredAreas.length > 0
      ? `${candidate.preferredAreas.length} area tag(s)`
      : null,
  ].filter((label): label is string => Boolean(label));

  return labels.join(" · ") || "Light dossier with no linked workflow yet";
}

function buildDuplicateRecommendationLabel(
  recommended: DuplicateCandidate,
  duplicate: DuplicateCandidate,
) {
  const recommendedWorkflowCount =
    recommended._count.followUpTasks +
    recommended._count.appointments +
    recommended._count.frontOfficeSendRecords +
    recommended._count.transactionContacts +
    recommended._count.handoffDrafts;
  const duplicateWorkflowCount =
    duplicate._count.followUpTasks +
    duplicate._count.appointments +
    duplicate._count.frontOfficeSendRecords +
    duplicate._count.transactionContacts +
    duplicate._count.handoffDrafts;

  if (recommendedWorkflowCount > duplicateWorkflowCount) {
    return "Recommended keep: more live workflow is already attached here.";
  }

  if (
    buildDuplicateCandidateStrengthScore(recommended) >
    buildDuplicateCandidateStrengthScore(duplicate)
  ) {
    return "Recommended keep: this dossier already carries richer contact context.";
  }

  if (recommended.updatedAt.getTime() !== duplicate.updatedAt.getTime()) {
    return "Recommended keep: this record was updated more recently.";
  }

  return "Recommended keep: this record has the stronger contact profile.";
}

function buildDuplicateRecord(
  candidate: DuplicateCandidate,
  viewerMembershipId: string,
  now: Date,
  timeZone?: string | null,
): FrontOfficeClientDuplicateRecord {
  const isViewerOwned = candidate.ownerMembershipId === viewerMembershipId;

  return {
    id: candidate.id,
    fullName: candidate.fullName,
    href: isViewerOwned
      ? `/agent/clients/${candidate.id}`
      : `/office/contacts/${candidate.id}`,
    reviewLabel: isViewerOwned ? "Open FO dossier" : "Open office contact",
    stage: candidate.stage,
    stageTone: mapClientStageTone(candidate.stage),
    sourceLabel: candidate.source?.trim() || "Source not captured",
    nextTouchLabel: formatNextTouchLabel({
      nextFollowUpAt: candidate.nextFollowUpAt,
      leaseReminderAt: candidate.leaseReminderAt,
      now,
      timeZone,
    }),
    detailLabel: buildDuplicateCandidateDetailLabel(candidate),
    lastUpdatedLabel: `Updated ${formatDateTimeLabel(candidate.updatedAt, {
      timeZone: timeZone ?? null,
    })}`,
    ownerLabel: candidate.ownerLabel,
    scopeLabel: isViewerOwned
      ? "In your FO queue"
      : "Visible in office CRM scope",
  };
}

function buildFrontOfficeDuplicatePairs(input: {
  candidates: DuplicateCandidate[];
  viewerMembershipId: string;
  now: Date;
  timeZone?: string | null;
}) {
  const bucketMap = new Map<string, { reason: string; clientIds: string[] }>();

  for (const candidate of input.candidates) {
    const emailKey = normalizeDuplicateEmail(candidate.email);
    const phoneKey = normalizeDuplicatePhone(candidate.phone);
    const nameKey = normalizeDuplicateName(candidate.fullName);

    if (emailKey) {
      bucketMap.set(`email:${emailKey}`, {
        reason: "Same email",
        clientIds: [
          ...(bucketMap.get(`email:${emailKey}`)?.clientIds ?? []),
          candidate.id,
        ],
      });
    }

    if (phoneKey) {
      bucketMap.set(`phone:${phoneKey}`, {
        reason: "Same phone",
        clientIds: [
          ...(bucketMap.get(`phone:${phoneKey}`)?.clientIds ?? []),
          candidate.id,
        ],
      });
    }

    if (nameKey) {
      bucketMap.set(`name:${nameKey}`, {
        reason: "Same name",
        clientIds: [
          ...(bucketMap.get(`name:${nameKey}`)?.clientIds ?? []),
          candidate.id,
        ],
      });
    }
  }

  const candidatesById = new Map(
    input.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const pairReasonMap = new Map<
    string,
    { leftId: string; rightId: string; reasons: Set<string> }
  >();

  for (const bucket of bucketMap.values()) {
    if (bucket.clientIds.length < 2) {
      continue;
    }

    const uniqueIds = Array.from(new Set(bucket.clientIds));

    for (let index = 0; index < uniqueIds.length - 1; index += 1) {
      for (
        let compareIndex = index + 1;
        compareIndex < uniqueIds.length;
        compareIndex += 1
      ) {
        const leftId = uniqueIds[index];
        const rightId = uniqueIds[compareIndex];
        const pairKey = [leftId, rightId].sort().join(":");
        const existingPair = pairReasonMap.get(pairKey);

        if (existingPair) {
          existingPair.reasons.add(bucket.reason);
          continue;
        }

        pairReasonMap.set(pairKey, {
          leftId,
          rightId,
          reasons: new Set([bucket.reason]),
        });
      }
    }
  }

  return Array.from(pairReasonMap.values())
    .map((pair) => {
      const left = candidatesById.get(pair.leftId);
      const right = candidatesById.get(pair.rightId);

      if (!left || !right) {
        return null;
      }

      const leftScore = buildDuplicateCandidateStrengthScore(left);
      const rightScore = buildDuplicateCandidateStrengthScore(right);
      const recommended =
        leftScore > rightScore
          ? left
          : rightScore > leftScore
            ? right
            : left.updatedAt.getTime() >= right.updatedAt.getTime()
              ? left
              : right;
      const duplicate = recommended.id === left.id ? right : left;

      return {
        id: [recommended.id, duplicate.id].join(":"),
        matchReasons: Array.from(pair.reasons).sort(),
        rationaleLabel: buildDuplicateRecommendationLabel(
          recommended,
          duplicate,
        ),
        sortUpdatedAt: recommended.updatedAt.getTime(),
        recommendedClient: buildDuplicateRecord(
          recommended,
          input.viewerMembershipId,
          input.now,
          input.timeZone,
        ),
        duplicateClient: buildDuplicateRecord(
          duplicate,
          input.viewerMembershipId,
          input.now,
          input.timeZone,
        ),
      };
    })
    .filter(
      (
        pair,
      ): pair is FrontOfficeClientDuplicatePair & { sortUpdatedAt: number } =>
        Boolean(pair),
    )
    .sort((left, right) => {
      const reasonDelta = right.matchReasons.length - left.matchReasons.length;

      if (reasonDelta !== 0) {
        return reasonDelta;
      }

      return right.sortUpdatedAt - left.sortUpdatedAt;
    })
    .slice(0, 6);
}

function mapListingStatusTone(status: ListingStatus): FrontOfficeTone {
  if (status === ListingStatus.hot || status === ListingStatus.active) {
    return "success";
  }

  if (status === ListingStatus.pending) {
    return "warning";
  }

  if (status === ListingStatus.sold) {
    return "accent";
  }

  if (status === ListingStatus.off_market) {
    return "danger";
  }

  return "neutral";
}

function formatUserRoleLabel(role: UserRole) {
  switch (role) {
    case "owner":
      return "Owner";
    case "office_admin":
      return "Office Admin";
    case "accountant":
      return "Accountant";
    case "human_resources":
      return "Human Resources";
    case "team_lead":
      return "Team Lead";
    case "office_manager":
      return "Office Manager";
    case "office_user":
      return "Office User";
    default:
      return "Agent";
  }
}

function buildInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) {
  return (
    `${firstName?.trim().charAt(0) ?? ""}${lastName?.trim().charAt(0) ?? ""}`.toUpperCase() ||
    "AC"
  );
}

function formatListingStatus(status: ListingStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatAppointmentTypeLabel(type: AppointmentType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatAppointmentStatusLabel(status: AppointmentStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatFrontOfficeSendChannelLabel(channel: string) {
  switch (channel.trim().toLowerCase()) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    default:
      return "Direct link";
  }
}

function formatSendRecordStageLabel(value: string | null | undefined) {
  return value?.trim() || "Stage not captured";
}

function buildSendRecordAppointmentLabel(input: {
  title: string | null | undefined;
  startsAt: Date | null | undefined;
  timeZone?: string | null;
}) {
  if (!input.title?.trim() && !input.startsAt) {
    return "";
  }

  if (!input.startsAt) {
    return input.title?.trim() || "Appointment context";
  }

  if (!input.title?.trim()) {
    return `Appointment · ${formatDateTimeLabel(input.startsAt, {
      timeZone: input.timeZone ?? null,
    })}`;
  }

  return `${input.title.trim()} · ${formatDateTimeLabel(input.startsAt, {
    timeZone: input.timeZone ?? null,
  })}`;
}

function mapAppointmentStatusTone(status: AppointmentStatus): FrontOfficeTone {
  if (status === AppointmentStatus.completed) {
    return "success";
  }

  if (status === AppointmentStatus.canceled) {
    return "danger";
  }

  if (status === AppointmentStatus.no_show) {
    return "warning";
  }

  return "accent";
}

function formatNotificationType(type: NotificationType) {
  if (type === NotificationType.appointment_external_touch_due) {
    return "External touch due";
  }

  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapNotificationSeverityTone(
  severity: NotificationSeverity | null | undefined,
): FrontOfficeTone {
  if (severity === NotificationSeverity.critical) {
    return "danger";
  }

  if (severity === NotificationSeverity.warning) {
    return "warning";
  }

  return "accent";
}

function readNotificationMetadataString(
  metadata: Prisma.JsonValue | null | undefined,
  key: string,
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, Prisma.JsonValue>;
  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getFrontOfficeNotificationGroup(input: {
  type: NotificationType;
  metadata: Prisma.JsonValue | null | undefined;
}) {
  if (input.type === NotificationType.appointment_due_soon) {
    return {
      groupKey: "appointment_soon" as const,
      groupLabel: "Appointment soon",
    };
  }

  if (input.type === NotificationType.appointment_external_touch_due) {
    const externalStatus = readNotificationMetadataString(
      input.metadata,
      "externalStatus",
    );

    if (
      externalStatus ===
      frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending
    ) {
      return {
        groupKey: "confirmation_due" as const,
        groupLabel: "Confirmation due",
      };
    }

    if (
      externalStatus ===
      frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested
    ) {
      return {
        groupKey: "reschedule_due" as const,
        groupLabel: "Reschedule follow-up",
      };
    }

    return {
      groupKey: "external_touch_due" as const,
      groupLabel: "External touch due",
    };
  }

  return {
    groupKey: "general_notice" as const,
    groupLabel: "General notice",
  };
}

function getFrontOfficeNotificationActionLabel(input: {
  type: NotificationType;
  actionUrl: string | null;
  groupKey: FrontOfficeActivityNotificationRecord["groupKey"];
}) {
  if (input.type === NotificationType.appointment_due_soon) {
    return "Open calendar item";
  }

  if (input.type === NotificationType.appointment_external_touch_due) {
    return input.groupKey === "confirmation_due"
      ? "Open confirmation writeback"
      : input.groupKey === "reschedule_due"
        ? "Open reschedule writeback"
        : "Open calendar writeback";
  }

  return input.actionUrl?.trim()
    ? "Open notice"
    : formatNotificationType(input.type);
}

function getFrontOfficeNotificationStream(input: {
  actionUrl: string | null;
  membershipId: string | null;
  groupKey: FrontOfficeActivityNotificationRecord["groupKey"];
}) {
  if (input.groupKey !== "general_notice") {
    return {
      streamKey: "front_office" as const,
      streamLabel: "Front Office action",
    };
  }

  if (!input.membershipId) {
    return {
      streamKey: "shared_notice" as const,
      streamLabel: "Shared office notice",
    };
  }

  if (input.actionUrl?.startsWith("/agent")) {
    return {
      streamKey: "front_office" as const,
      streamLabel: "Front Office action",
    };
  }

  if (input.actionUrl?.startsWith("/office")) {
    return {
      streamKey: "back_office" as const,
      streamLabel: "Back Office handoff",
    };
  }

  return {
    streamKey: "reference" as const,
    streamLabel: "Awareness only",
  };
}

function getFrontOfficeNotificationOwnerLabel(readStateMutable: boolean) {
  return readStateMutable
    ? {
        ownerKey: "assigned_to_viewer" as const,
        ownerLabel: "Assigned to you",
      }
    : {
        ownerKey: "shared_office" as const,
        ownerLabel: "Shared office",
      };
}

function getFrontOfficeNotificationScopeLabel(input: {
  groupKey: FrontOfficeActivityNotificationRecord["groupKey"];
  streamKey: FrontOfficeActivityNotificationStreamKey;
  streamLabel: string;
}) {
  if (input.groupKey === "appointment_soon") {
    return {
      scopeKey: "meeting_countdown" as const,
      scopeLabel: "Meeting countdown",
    };
  }

  if (input.groupKey !== "general_notice") {
    return {
      scopeKey: "calendar_writeback" as const,
      scopeLabel: "Calendar writeback",
    };
  }

  if (input.streamKey === "front_office") {
    return {
      scopeKey: "front_office_action" as const,
      scopeLabel: input.streamLabel,
    };
  }

  if (input.streamKey === "back_office") {
    return {
      scopeKey: "back_office_handoff" as const,
      scopeLabel: input.streamLabel,
    };
  }

  if (input.streamKey === "shared_notice") {
    return {
      scopeKey: "shared_office_notice" as const,
      scopeLabel: input.streamLabel,
    };
  }

  return {
    scopeKey: "awareness_only" as const,
    scopeLabel: input.streamLabel,
  };
}

function getFrontOfficeNotificationPressureState(input: {
  groupKey: FrontOfficeActivityNotificationRecord["groupKey"];
  notificationTone: FrontOfficeTone;
  readStateMutable: boolean;
  isUnread: boolean;
}) {
  if (input.groupKey === "confirmation_due") {
    return {
      key:
        input.notificationTone === "danger"
          ? ("confirmation_overdue" as const)
          : ("confirmation_due" as const),
      label:
        input.notificationTone === "danger"
          ? "Confirmation overdue"
          : "Confirmation due",
      tone: input.notificationTone,
      whyNowLabel:
        input.notificationTone === "danger"
          ? "The promised confirmation window already slipped, so this appointment now needs a writeback pass before the meeting can stay trustworthy."
          : "The meeting is approaching without an explicit client confirmation in place.",
    };
  }

  if (input.groupKey === "reschedule_due") {
    return {
      key:
        input.notificationTone === "danger"
          ? ("reschedule_overdue" as const)
          : ("reschedule_due" as const),
      label:
        input.notificationTone === "danger"
          ? "Reschedule overdue"
          : "Reschedule due",
      tone: input.notificationTone,
      whyNowLabel:
        input.notificationTone === "danger"
          ? "The client already asked to reschedule and the follow-up window has passed."
          : "The client already asked to reschedule, so this writeback needs a fresh touch before the appointment drifts.",
    };
  }

  if (input.groupKey === "external_touch_due") {
    return {
      key:
        input.notificationTone === "danger"
          ? ("touch_overdue" as const)
          : ("touch_due" as const),
      label:
        input.notificationTone === "danger" ? "Touch overdue" : "Touch due",
      tone: input.notificationTone,
      whyNowLabel:
        input.notificationTone === "danger"
          ? "A promised external touch is already overdue, so the appointment now needs active intervention."
          : "A promised external touch is now due before the appointment can safely stay on track.",
    };
  }

  if (input.groupKey === "appointment_soon") {
    return {
      key:
        input.notificationTone === "danger"
          ? ("starts_within_2h" as const)
          : input.notificationTone === "warning"
            ? ("starts_today" as const)
            : ("coming_up" as const),
      label:
        input.notificationTone === "danger"
          ? "Starts within 2h"
          : input.notificationTone === "warning"
            ? "Starts today"
            : "Coming up",
      tone: input.notificationTone,
      whyNowLabel:
        input.notificationTone === "danger"
          ? "The meeting start is now close enough that it belongs in the live reminder stack."
          : input.notificationTone === "warning"
            ? "This appointment is on today's clock and should stay visible in the active reminder pass."
            : "The meeting is close enough to keep on the agent's short-range reminder horizon.",
    };
  }

  if (!input.readStateMutable) {
    return {
      key: "shared_visibility" as const,
      label: "Shared visibility",
      tone: "neutral" as const,
      whyNowLabel:
        "This notice is shared for office awareness, so it stays visible here without a personal read-state toggle.",
    };
  }

  if (input.isUnread) {
    return {
      key:
        input.notificationTone === "danger"
          ? ("action_now" as const)
          : input.notificationTone === "warning"
            ? ("needs_review" as const)
            : ("new_notice" as const),
      label:
        input.notificationTone === "danger"
          ? "Action now"
          : input.notificationTone === "warning"
            ? "Needs review"
            : "New notice",
      tone:
        input.notificationTone === "neutral"
          ? "accent"
          : input.notificationTone,
      whyNowLabel:
        input.notificationTone === "danger"
          ? "This personal notice is still unread and is carrying active pressure."
          : input.notificationTone === "warning"
            ? "This personal notice is still unread and should be reviewed in the current pass."
            : "This personal notice has not been reviewed yet.",
    };
  }

  return {
    key: "reviewed" as const,
    label: "Reviewed",
    tone: "neutral" as const,
    whyNowLabel:
      "This notice was already reviewed, but it stays in the stream so the current filter slice remains stable.",
  };
}

function formatResourceType(type: ResourceType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatEventVisibilityLabel(
  value: "all_agents" | "office_only" | "invite_only",
) {
  if (value === "all_agents") {
    return "All agents";
  }

  if (value === "office_only") {
    return "Office only";
  }

  return "Invite only";
}

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function buildFrontOfficeActivityCleanupFilterContract(
  counts: FrontOfficeActivityCounts["cleanup"],
): FrontOfficeActivitySnapshot["filters"]["cleanup"] {
  return {
    defaultValue: "all",
    paramKey: "cleanupFilter",
    options: frontOfficeActivityCleanupFilterKeys.map((value) => ({
      value,
      label: frontOfficeActivityCleanupFilterLabels[value],
      count: counts.visibleByFilter[value],
    })),
  };
}

function buildFrontOfficeActivityNoticeFilterContract(
  counts: FrontOfficeActivityCounts["notifications"],
): FrontOfficeActivitySnapshot["filters"]["notices"] {
  return {
    defaultValue: "all",
    paramKey: "noticeFilter",
    options: frontOfficeActivityNoticeFilterKeys.map((value) => ({
      value,
      label: frontOfficeActivityNoticeFilterLabels[value],
      count:
        value === "all" ? counts.visibleCount : counts.byGroup[value],
    })),
    activityViewRules: {
      appointmentRemindersDisallow: "general_notice",
      generalNoticesForce: "general_notice",
    },
  };
}

function buildFrontOfficeActivityNoticeStreamFilterContract(
  counts: FrontOfficeActivityCounts["notifications"],
): FrontOfficeActivitySnapshot["filters"]["noticeLanes"] {
  return {
    defaultValue: "all",
    paramKey: "noticeStreamFilter",
    options: frontOfficeActivityNoticeStreamFilterKeys.map((value) => ({
      value,
      label: frontOfficeActivityNoticeStreamFilterLabels[value],
      count:
        value === "all"
          ? counts.generalNoticeVisibleCount
          : counts.generalByStream[value],
    })),
    appliesToGroupKey: "general_notice",
  };
}

function buildFrontOfficeActivityReadStateFilterContract(
  counts: FrontOfficeActivityCounts["notifications"],
): FrontOfficeActivitySnapshot["filters"]["readState"] {
  return {
    defaultValue: "all",
    paramKey: "readState",
    options: frontOfficeActivityReadStateKeys.map((value) => ({
      value,
      label: frontOfficeActivityReadStateLabels[value],
      count:
        value === "all"
          ? counts.visibleCount
          : value === "unread"
            ? counts.unreadPersonalVisibleCount
            : counts.mutableVisibleCount - counts.unreadPersonalVisibleCount,
    })),
    sharedNoticeBehavior: "shared_notices_ignore_read_state",
  };
}

function isClosedClientStage(stage: string) {
  const normalized = stage.trim().toLowerCase();
  return normalized.includes("won") || normalized.includes("lost");
}

function buildVisibleEventWhere(
  input: FrontOfficeWorkspaceInput,
  startOfToday: Date,
  sevenDaysFromNow: Date,
): Prisma.EventWhereInput {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);

  return {
    organizationId: input.organizationId,
    startsAt: {
      gte: startOfToday,
      lte: sevenDaysFromNow,
    },
    AND: [
      officeScopeFilter ?? {},
      {
        OR: [
          {
            visibility: "all_agents",
          },
          ...(input.officeId
            ? [
                {
                  visibility: "office_only" as const,
                  officeId: input.officeId,
                },
              ]
            : []),
          {
            visibility: "invite_only",
            rsvps: {
              some: {
                membershipId: input.viewerMembershipId,
              },
            },
          },
        ],
      },
    ],
  };
}

async function getVisibleFrontOfficeDuplicatePairs(input: {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  now: Date;
  timeZone?: string | null;
}) {
  const duplicateScope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null,
    resource: "contacts",
  });
  const duplicateWhere: Prisma.ClientWhereInput = {
    AND: [
      {
        organizationId: input.organizationId,
      },
      ...buildVisibleContactScopeWhere(duplicateScope, input.officeId ?? null),
    ],
  };
  const duplicateCandidates = await prisma.client.findMany({
    where: duplicateWhere,
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      fullName: true,
      ownerMembershipId: true,
      email: true,
      phone: true,
      source: true,
      stage: true,
      budgetMin: true,
      budgetMax: true,
      preferredAreas: true,
      notes: true,
      lastContactAt: true,
      nextFollowUpAt: true,
      leaseReminderAt: true,
      updatedAt: true,
      ownerMembership: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      _count: {
        select: {
          appointments: true,
          frontOfficeSendRecords: true,
          followUpTasks: true,
          handoffDrafts: true,
          transactionContacts: true,
          stageHistory: true,
        },
      },
    },
  });

  return buildFrontOfficeDuplicatePairs({
    candidates: duplicateCandidates.map((candidate) => ({
      ...candidate,
      ownerLabel:
        `${candidate.ownerMembership?.user.firstName ?? ""} ${candidate.ownerMembership?.user.lastName ?? ""}`.trim() ||
        candidate.ownerMembership?.user.email ||
        "Unassigned",
    })),
    viewerMembershipId: input.viewerMembershipId,
    now: input.now,
    timeZone: input.timeZone,
  });
}

export async function getFrontOfficeClientsSnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeClientsSnapshot> {
  const now = new Date();
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const clientWhere: Prisma.ClientWhereInput = {
    organizationId: input.organizationId,
    ownerMembershipId: input.viewerMembershipId,
  };

  const [
    clients,
    stageGroups,
    followUpDueCount,
    overdueTaskCount,
    duplicatePairs,
  ] = await Promise.all([
    prisma.client.findMany({
      where: clientWhere,
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 24,
      select: {
        id: true,
        fullName: true,
        source: true,
        stage: true,
        intent: true,
        budgetMin: true,
        budgetMax: true,
        preferredAreas: true,
        lastContactAt: true,
        nextFollowUpAt: true,
        leaseReminderAt: true,
      },
    }),
    prisma.client.groupBy({
      by: ["stage"],
      where: clientWhere,
      _count: {
        _all: true,
      },
    }),
    prisma.client.count({
      where: {
        ...clientWhere,
        nextFollowUpAt: {
          lt: startOfTomorrow,
        },
      },
    }),
    prisma.followUpTask.count({
      where: {
        organizationId: input.organizationId,
        assigneeMemberId: input.viewerMembershipId,
        status: {
          in: [...openFollowUpStatuses],
        },
        dueAt: {
          lt: now,
        },
      },
    }),
    getVisibleFrontOfficeDuplicatePairs({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      now,
      timeZone: input.timeZone,
    }),
  ]);

  return {
    summary: {
      liveContacts: clients.length,
      activeStages: stageGroups.length,
      followUpDueCount,
      overdueTaskCount,
      potentialDuplicateCount: duplicatePairs.length,
    },
    stageMetrics: stageGroups
      .sort(
        (left, right) =>
          right._count._all - left._count._all ||
          left.stage.localeCompare(right.stage),
      )
      .slice(0, 6)
      .map((group) => ({
        label: group.stage,
        count: group._count._all,
        tone: mapClientStageTone(group.stage),
      })),
    clients: clients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      stage: client.stage,
      stageTone: mapClientStageTone(client.stage),
      intentLabel: client.intent?.trim() || "Intent not captured",
      budgetLabel: formatBudgetRange(client.budgetMin, client.budgetMax),
      areasLabel: client.preferredAreas.length
        ? client.preferredAreas.join(", ")
        : "Areas not captured",
      sourceLabel: client.source?.trim() || "Source not captured",
      lastTouchLabel: client.lastContactAt
        ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
        : "No contact logged yet",
      nextTouchLabel: formatNextTouchLabel({
        nextFollowUpAt: client.nextFollowUpAt,
        leaseReminderAt: client.leaseReminderAt,
        now,
        timeZone: input.timeZone,
      }),
      href: `/agent/clients/${client.id}`,
    })),
    duplicatePairs,
  };
}

export async function getFrontOfficeListingsSnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeListingsSnapshot> {
  const now = new Date();
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const listingWhere: Prisma.ListingWhereInput = {
    organizationId: input.organizationId,
    status: {
      in: activeListingStatuses,
    },
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const [
    listings,
    listingCount,
    publicReadyCount,
    shareAggregate,
    explicitTargetClient,
    targetAppointment,
    membership,
    recentClosedTransactions,
    recentClosedCount,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: listingWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 24,
      select: {
        id: true,
        title: true,
        neighborhood: true,
        city: true,
        price: true,
        status: true,
        isPublic: true,
        aiSummary: true,
        bedrooms: true,
        bathrooms: true,
      },
    }),
    prisma.listing.count({
      where: listingWhere,
    }),
    prisma.listing.count({
      where: {
        ...listingWhere,
        isPublic: true,
      },
    }),
    prisma.listingShareLink.aggregate({
      where: {
        membershipId: input.viewerMembershipId,
        listing: {
          organizationId: input.organizationId,
          ...(officeScopeFilter ? officeScopeFilter : {}),
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        clickCount: true,
      },
    }),
    input.targetClientId?.trim()
      ? prisma.client.findFirst({
          where: {
            id: input.targetClientId.trim(),
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
          },
          select: {
            id: true,
            fullName: true,
            stage: true,
            nextFollowUpAt: true,
            leaseReminderAt: true,
          },
        })
      : Promise.resolve(null),
    input.targetAppointmentId?.trim()
      ? prisma.appointment.findFirst({
          where: {
            id: input.targetAppointmentId.trim(),
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
          },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            startsAt: true,
            location: true,
            meetingUrl: true,
            client: {
              select: {
                id: true,
                fullName: true,
                stage: true,
                nextFollowUpAt: true,
                leaseReminderAt: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.membership.findFirst({
      where: {
        id: input.viewerMembershipId,
        organizationId: input.organizationId,
      },
      select: {
        role: true,
        title: true,
        office: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        agentProfile: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            licenseNumber: true,
            licenseState: true,
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: "closed",
        ...(input.officeId ? { officeId: input.officeId } : {}),
      },
      orderBy: [{ closingDate: "desc" }, { updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        title: true,
        address: true,
        city: true,
        state: true,
        closingDate: true,
        purchasedPrice: true,
        price: true,
      },
    }),
    prisma.transaction.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: "closed",
        ...(input.officeId ? { officeId: input.officeId } : {}),
      },
    }),
  ]);

  const listingShareRows =
    listings.length > 0
      ? await prisma.listingShareLink.groupBy({
          by: ["listingId"],
          where: {
            membershipId: input.viewerMembershipId,
            listingId: {
              in: listings.map((listing) => listing.id),
            },
          },
          _count: {
            _all: true,
          },
          _sum: {
            clickCount: true,
          },
        })
      : [];

  const listingShareMap = new Map(
    listingShareRows.map((row) => [
      row.listingId,
      {
        count: row._count._all,
        clicks: row._sum.clickCount ?? 0,
      },
    ]),
  );

  const targetClient =
    explicitTargetClient ??
    (targetAppointment?.client
      ? {
          id: targetAppointment.client.id,
          fullName: targetAppointment.client.fullName,
          stage: targetAppointment.client.stage,
          nextFollowUpAt: targetAppointment.client.nextFollowUpAt,
          leaseReminderAt: targetAppointment.client.leaseReminderAt,
        }
      : null);
  const resolvedTargetAppointment =
    targetAppointment &&
    (!targetClient || targetAppointment.client?.id === targetClient.id)
      ? targetAppointment
      : null;

  const displayName =
    membership?.agentProfile?.displayName?.trim() ||
    `${membership?.user.firstName ?? ""} ${membership?.user.lastName ?? ""}`.trim() ||
    membership?.user.email ||
    "Acre agent";
  const titleLabel =
    membership?.title?.trim() ||
    (membership ? formatUserRoleLabel(membership.role) : "Agent");
  const officeLabel = membership?.office?.name?.trim() || "Acre";
  const bioLabel =
    membership?.agentProfile?.bio?.trim() ||
    "Share your business card, profile, and recent closings without leaving the Front Office output terminal.";
  const licenseLabel =
    membership?.agentProfile?.licenseNumber?.trim() &&
    membership?.agentProfile?.licenseState?.trim()
      ? `${membership.agentProfile.licenseState.trim()} · ${membership.agentProfile.licenseNumber.trim()}`
      : membership?.agentProfile?.licenseNumber?.trim() ||
        membership?.agentProfile?.licenseState?.trim() ||
        "License info not published";
  const avatarFallback = buildInitials(
    membership?.user.firstName,
    membership?.user.lastName,
  );
  const businessCardText = [
    displayName,
    titleLabel,
    officeLabel,
    membership?.user.phone?.trim() || "",
    membership?.user.email?.trim() || "",
    licenseLabel !== "License info not published" ? licenseLabel : "",
  ]
    .filter(Boolean)
    .join("\n");
  const introEmailText = `Subject: Introduction from ${displayName}\n\nHi,\n\nI am ${displayName}, ${titleLabel} at ${officeLabel}. I help clients move from first conversation through shortlist, showings, and the formal Back Office handoff once the process becomes transaction-ready.\n\nIf you want a quick intro call, reply here and I can send a few focused next steps.\n\nBest,\n${displayName}\n${membership?.user.phone?.trim() || ""}\n${membership?.user.email?.trim() || ""}`;
  const introTextMessage = `Hi, this is ${displayName} from ${officeLabel}. I help clients move from search setup into showings and formal next steps. If you want a quick intro call, reply here and I can line up the best next options.`;

  return {
    summary: {
      listingCount,
      publicReadyCount,
      trackedClicks: shareAggregate._sum.clickCount ?? 0,
      trackedLinks: shareAggregate._count._all,
    },
    targetClient: targetClient
      ? {
          id: targetClient.id,
          fullName: targetClient.fullName,
          stage: targetClient.stage,
          stageTone: mapClientStageTone(targetClient.stage),
          nextTouchLabel: formatNextTouchLabel({
            nextFollowUpAt: targetClient.nextFollowUpAt,
            leaseReminderAt: targetClient.leaseReminderAt,
            now,
            timeZone: input.timeZone,
          }),
          href: `/agent/clients/${targetClient.id}`,
        }
      : null,
    targetAppointment: resolvedTargetAppointment
      ? {
          id: resolvedTargetAppointment.id,
          title: resolvedTargetAppointment.title,
          typeLabel: formatAppointmentTypeLabel(resolvedTargetAppointment.type),
          statusLabel: formatAppointmentStatusLabel(
            resolvedTargetAppointment.status,
          ),
          statusTone: mapAppointmentStatusTone(
            resolvedTargetAppointment.status,
          ),
          startsAtLabel: formatDateTimeLabel(
            resolvedTargetAppointment.startsAt,
            {
              timeZone: input.timeZone ?? null,
            },
          ),
          locationLabel:
            resolvedTargetAppointment.location?.trim() ||
            resolvedTargetAppointment.meetingUrl?.trim() ||
            "Location pending",
          href: `/agent/calendar?appointmentId=${resolvedTargetAppointment.id}`,
        }
      : null,
    agentMaterial: {
      displayName,
      titleLabel,
      officeLabel,
      bioLabel,
      avatarUrl: membership?.agentProfile?.avatarUrl?.trim() || "",
      avatarFallback,
      email: membership?.user.email?.trim() || "",
      phone: membership?.user.phone?.trim() || "",
      licenseLabel,
      recentClosedCount,
      featuredCaseCount: recentClosedTransactions.length,
      portraitReady: Boolean(membership?.agentProfile?.avatarUrl?.trim()),
      businessCardText,
      introEmailText,
      introTextMessage,
      featuredCases: recentClosedTransactions.map((transaction) => ({
        id: transaction.id,
        label: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`,
        closingLabel: transaction.closingDate
          ? `Closed ${formatDateLabel(transaction.closingDate, input.timeZone)}`
          : "Closed deal",
        priceLabel: formatCurrency(
          transaction.purchasedPrice ?? transaction.price,
        ),
        href: `/office/transactions/${transaction.id}`,
      })),
    },
    listings: listings.map((listing) => {
      const shareMetrics = listingShareMap.get(listing.id);
      const bedroomLabel = listing.bedrooms ? `${listing.bedrooms} bd` : null;
      const bathroomLabel = listing.bathrooms
        ? `${Number(listing.bathrooms)} ba`
        : null;
      const layoutLabel = [bedroomLabel, bathroomLabel]
        .filter(Boolean)
        .join(" · ");

      return {
        id: listing.id,
        title: listing.title,
        areaLabel: `${listing.neighborhood}, ${listing.city}`,
        summaryLabel:
          listing.aiSummary?.trim() ||
          layoutLabel ||
          "Send-ready listing in the current office scope.",
        priceLabel: formatCurrency(listing.price),
        cityLabel: listing.city,
        statusLabel: formatListingStatus(listing.status),
        statusTone: mapListingStatusTone(listing.status),
        trackedClickCount: shareMetrics?.clicks ?? 0,
        trackedLinkCount: shareMetrics?.count ?? 0,
      };
    }),
  };
}

export async function getFrontOfficeResourcesSnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeResourcesSnapshot> {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const resourceWhere: Prisma.ResourceWhereInput = {
    organizationId: input.organizationId,
    isPublished: true,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };
  const vendorWhere: Prisma.VendorWhereInput = {
    organizationId: input.organizationId,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const [resources, vendors, resourceCount, vendorCount, resourceTypes] =
    await Promise.all([
      prisma.resource.findMany({
        where: resourceWhere,
        orderBy: [{ updatedAt: "desc" }],
        take: 24,
        select: {
          id: true,
          title: true,
          summary: true,
          type: true,
          tags: true,
          url: true,
        },
      }),
      prisma.vendor.findMany({
        where: vendorWhere,
        orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
        take: 24,
        select: {
          id: true,
          category: true,
          name: true,
          headline: true,
          phone: true,
          email: true,
          website: true,
          neighborhoods: true,
        },
      }),
      prisma.resource.count({
        where: resourceWhere,
      }),
      prisma.vendor.count({
        where: vendorWhere,
      }),
      prisma.resource.groupBy({
        by: ["type"],
        where: resourceWhere,
      }),
    ]);

  return {
    summary: {
      resourceCount,
      vendorCount,
      resourceTypeCount: resourceTypes.length,
    },
    resources: resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      summary: resource.summary,
      typeLabel: formatResourceType(resource.type),
      tags: resource.tags,
      href: resource.url,
    })),
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      category: vendor.category,
      headline: vendor.headline,
      neighborhoodsLabel: vendor.neighborhoods.length
        ? vendor.neighborhoods.join(" · ")
        : "Office-wide vendor",
      contactLabel:
        vendor.phone?.trim() ||
        vendor.website?.trim() ||
        vendor.email?.trim() ||
        "Open vendor profile",
      href:
        vendor.website?.trim() ||
        (vendor.phone?.trim()
          ? `tel:${vendor.phone.trim()}`
          : vendor.email?.trim()
            ? `mailto:${vendor.email.trim()}`
            : null),
    })),
  };
}

export async function getFrontOfficeActivitySnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeActivitySnapshot> {
  await reconcileOfficeNotificationReminders({
    organizationId: input.organizationId,
    officeId: input.officeId ?? null,
    membershipId: input.viewerMembershipId,
  });

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
  const twoDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 2,
  );
  const sevenDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 7,
  );
  const threeDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 3,
  );
  const sevenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 7,
  );
  const fifteenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 15,
  );
  const thirtyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 30,
  );
  const thirtyDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 30,
  );
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const clientWhere: Prisma.ClientWhereInput = {
    organizationId: input.organizationId,
    ownerMembershipId: input.viewerMembershipId,
  };
  const sendRecordWhere: Prisma.FrontOfficeSendRecordWhereInput = {
    organizationId: input.organizationId,
    senderMembershipId: input.viewerMembershipId,
    ...(input.officeId
      ? {
          officeId: input.officeId,
        }
      : {}),
  };
  const notificationWhere: Prisma.NotificationWhereInput = {
    organizationId: input.organizationId,
    AND: [
      officeScopeFilter ?? {},
      {
        OR: [
          { membershipId: input.viewerMembershipId },
          { membershipId: null },
        ],
      },
    ],
  };

  const [
    notifications,
    unreadNoticeCount,
    events,
    duplicatePairs,
    dueFollowUpTasks,
    dueFollowUpClients,
    staleClients,
    scheduledAppointments,
    latestSendGroups,
  ] = await Promise.all([
    prisma.notification.findMany({
      where: notificationWhere,
      orderBy: [{ createdAt: "desc" }],
      take: 24,
      select: {
        id: true,
        membershipId: true,
        type: true,
        severity: true,
        metadata: true,
        title: true,
        body: true,
        actionUrl: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
        ...(officeScopeFilter ?? {}),
        readAt: null,
      },
    }),
    prisma.event.findMany({
      where: buildVisibleEventWhere(input, startOfToday, sevenDaysFromNow),
      orderBy: [{ startsAt: "asc" }],
      take: 24,
      select: {
        id: true,
        title: true,
        visibility: true,
        startsAt: true,
        location: true,
        meetingUrl: true,
        rsvps: {
          where: {
            membershipId: input.viewerMembershipId,
          },
          select: {
            status: true,
          },
          take: 1,
        },
        _count: {
          select: {
            rsvps: true,
          },
        },
      },
    }),
    getVisibleFrontOfficeDuplicatePairs({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      now,
      timeZone: input.timeZone,
    }),
    prisma.followUpTask.findMany({
      where: {
        organizationId: input.organizationId,
        assigneeMemberId: input.viewerMembershipId,
        status: {
          in: [...openFollowUpStatuses],
        },
        dueAt: {
          lt: startOfTomorrow,
        },
        clientId: {
          not: null,
        },
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        dueAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            source: true,
            stage: true,
            lastContactAt: true,
            nextFollowUpAt: true,
            leaseReminderAt: true,
          },
        },
      },
    }),
    prisma.client.findMany({
      where: {
        ...clientWhere,
        nextFollowUpAt: {
          lt: startOfTomorrow,
        },
      },
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        fullName: true,
        source: true,
        stage: true,
        lastContactAt: true,
        nextFollowUpAt: true,
        leaseReminderAt: true,
      },
    }),
    prisma.client.findMany({
      where: {
        ...clientWhere,
        NOT: [
          {
            OR: [
              { stage: { contains: "won", mode: "insensitive" } },
              { stage: { contains: "lost", mode: "insensitive" } },
            ],
          },
        ],
        OR: [
          {
            lastContactAt: {
              lt: fifteenDaysAgo,
            },
          },
          {
            lastContactAt: null,
            createdAt: {
              lt: fifteenDaysAgo,
            },
          },
        ],
      },
      orderBy: [{ lastContactAt: "asc" }, { createdAt: "asc" }],
      take: 8,
      select: {
        id: true,
        fullName: true,
        source: true,
        stage: true,
        lastContactAt: true,
        createdAt: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        startsAt: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      orderBy: [{ startsAt: "asc" }],
      take: 24,
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        location: true,
        meetingUrl: true,
        metadata: true,
        client: {
          select: {
            id: true,
            fullName: true,
            stage: true,
          },
        },
      },
    }),
    prisma.frontOfficeSendRecord.groupBy({
      by: ["clientId"],
      where: {
        ...sendRecordWhere,
        sentAt: {
          gte: thirtyDaysAgo,
        },
      },
      _max: {
        sentAt: true,
      },
    }),
  ]);

  const latestSendRecordFilters = latestSendGroups.flatMap((group) =>
    group._max.sentAt
      ? [
          {
            clientId: group.clientId,
            sentAt: group._max.sentAt,
          },
        ]
      : [],
  );
  const latestSendRecords =
    latestSendRecordFilters.length > 0
      ? await prisma.frontOfficeSendRecord.findMany({
          where: {
            AND: [sendRecordWhere, { OR: latestSendRecordFilters }],
          },
          orderBy: [{ sentAt: "desc" }],
          select: {
            id: true,
            clientId: true,
            channel: true,
            clientStageLabel: true,
            appointmentTitle: true,
            appointmentStartsAt: true,
            sentAt: true,
            lastOpenedAt: true,
            openCount: true,
            client: {
              select: {
                id: true,
                fullName: true,
                source: true,
                stage: true,
              },
            },
            listing: {
              select: {
                title: true,
              },
            },
          },
        })
      : [];

  const upcomingAppointments = scheduledAppointments
    .map((appointment) => ({
      appointment,
      externalWorkflow: getFrontOfficeAppointmentExternalWorkflowState({
        metadata: appointment.metadata,
        timeZone: input.timeZone ?? null,
      }),
    }))
    .filter(({ appointment, externalWorkflow }) => {
      if (appointment.startsAt.getTime() <= twoDaysFromNow.getTime()) {
        return true;
      }

      return (
        externalWorkflow.nextActionAt != null &&
        externalWorkflow.nextActionAt.getTime() <= twoDaysFromNow.getTime()
      );
    })
    .sort((left, right) => {
      const leftSortAt =
        left.externalWorkflow.nextActionAt != null &&
        left.externalWorkflow.nextActionAt.getTime() <
          left.appointment.startsAt.getTime()
          ? left.externalWorkflow.nextActionAt.getTime()
          : left.appointment.startsAt.getTime();
      const rightSortAt =
        right.externalWorkflow.nextActionAt != null &&
        right.externalWorkflow.nextActionAt.getTime() <
          right.appointment.startsAt.getTime()
          ? right.externalWorkflow.nextActionAt.getTime()
          : right.appointment.startsAt.getTime();

      return leftSortAt - rightSortAt;
    })
    .slice(0, 8);

  type CleanupCandidate = FrontOfficeActivityCleanupItem & {
    _priority: number;
    _sortAt: Date;
    _clientId: string | null;
  };

  const dueTaskClientIds = new Set(
    dueFollowUpTasks
      .map((task) => task.client?.id ?? null)
      .filter((clientId): clientId is string => Boolean(clientId)),
  );
  const dueFollowUpClientOnly = dueFollowUpClients.filter(
    (client) => !dueTaskClientIds.has(client.id),
  );
  const appointmentSoonCount = upcomingAppointments.length;

  const appointmentItems: CleanupCandidate[] = upcomingAppointments.map(
    ({ appointment, externalWorkflow }) => {
      const startsAtTime = appointment.startsAt.getTime();
      const nextActionTime = externalWorkflow.nextActionAt?.getTime() ?? null;
      const hasExternalDeadline =
        nextActionTime != null && nextActionTime <= twoDaysFromNow.getTime();
      const isExternalDeadlineOverdue =
        nextActionTime != null && nextActionTime < now.getTime();
      const isExternalDeadlineSoon =
        nextActionTime != null &&
        nextActionTime >= now.getTime() &&
        nextActionTime <= now.getTime() + 12 * 60 * 60 * 1000;
      let tone: FrontOfficeTone =
        startsAtTime <= now.getTime() + 2 * 60 * 60 * 1000
          ? "danger"
          : startsAtTime < startOfTomorrow.getTime()
            ? "warning"
            : "accent";
      let priority = tone === "danger" ? 1 : tone === "warning" ? 3 : 7;
      let kindLabel = "Appointment soon";

      if (
        externalWorkflow.value ===
        frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested
      ) {
        tone = "danger";
        priority = 0;
        kindLabel = "Reschedule requested";
      } else if (
        externalWorkflow.value ===
        frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp
      ) {
        tone =
          isExternalDeadlineOverdue ||
          startsAtTime <= now.getTime() + 6 * 60 * 60 * 1000
            ? "danger"
            : hasExternalDeadline
              ? "warning"
              : tone;
        priority = tone === "danger" ? 1 : hasExternalDeadline ? 2 : priority;
        kindLabel =
          isExternalDeadlineOverdue || isExternalDeadlineSoon
            ? "External touch due"
            : "Appointment follow-up";
      } else if (
        externalWorkflow.value ===
          frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending &&
        (startsAtTime < startOfTomorrow.getTime() || hasExternalDeadline)
      ) {
        tone = isExternalDeadlineOverdue ? "danger" : "warning";
        priority = isExternalDeadlineOverdue ? 1 : 3;
        kindLabel =
          isExternalDeadlineOverdue || isExternalDeadlineSoon
            ? "Confirmation due"
            : "Awaiting confirmation";
      }
      const scopeKey =
        kindLabel === "Appointment soon"
          ? ("meeting_countdown" as const)
          : ("calendar_writeback" as const);
      const scopeLabel =
        scopeKey === "meeting_countdown"
          ? "Meeting countdown"
          : "Calendar writeback";
      const pressureKey =
        kindLabel === "Reschedule requested"
          ? ("reschedule_requested" as const)
          : kindLabel === "Confirmation due" ||
              kindLabel === "Awaiting confirmation"
            ? isExternalDeadlineOverdue
              ? ("confirmation_overdue" as const)
              : ("confirmation_due" as const)
            : kindLabel === "External touch due" ||
                kindLabel === "Appointment follow-up"
              ? isExternalDeadlineOverdue
                ? ("touch_overdue" as const)
                : ("touch_due" as const)
              : tone === "danger"
                ? ("starts_within_2h" as const)
                : tone === "warning"
                  ? ("starts_today" as const)
                  : ("coming_up" as const);
      const pressureLabel =
        pressureKey === "reschedule_requested"
          ? "Reschedule requested"
          : pressureKey === "confirmation_overdue"
            ? "Confirmation overdue"
            : pressureKey === "confirmation_due"
              ? "Confirmation due"
              : pressureKey === "touch_overdue"
                ? "Touch overdue"
                : pressureKey === "touch_due"
                  ? "Touch due"
                  : pressureKey === "starts_within_2h"
                    ? "Starts within 2h"
                    : pressureKey === "starts_today"
                      ? "Starts today"
                      : "Coming up";

      return {
        id: `appointment-${appointment.id}`,
        kindKey: "appointment_writeback",
        kindLabel,
        tone,
        title: appointment.client?.fullName || appointment.title,
        description: [
          appointment.title,
          formatAppointmentTypeLabel(appointment.type),
          formatDateTimeLabel(appointment.startsAt, {
            timeZone: input.timeZone ?? null,
          }),
        ]
          .filter(Boolean)
          .join(" · "),
        ownerKey: "assigned_to_viewer",
        ownerLabel: "Assigned to you",
        scopeKey,
        scopeLabel,
        pressureKey,
        pressureLabel,
        metaLabels: [
          appointment.client?.stage?.trim()
            ? `Stage · ${appointment.client.stage.trim()}`
            : "No client linked",
          externalWorkflow.label,
          hasExternalDeadline
            ? `Next touch · ${externalWorkflow.nextActionAtLabel}`
            : "No next touch scheduled",
          appointment.location?.trim() ||
            appointment.meetingUrl?.trim() ||
            "Location pending",
        ],
        whyNowLabel:
          kindLabel === "Reschedule requested"
            ? "The client already asked to reschedule, so the writeback commitment is louder than the appointment start."
            : kindLabel === "Confirmation due" ||
                kindLabel === "Awaiting confirmation"
              ? "The appointment is approaching without an explicit client confirmation in place."
              : kindLabel === "External touch due" ||
                  kindLabel === "Appointment follow-up"
                ? "The next promised external touch is due before this appointment can safely stay on track."
                : "The meeting start itself is now the highest-pressure calendar commitment for this client.",
        sortLabel:
          nextActionTime != null && nextActionTime < startsAtTime
            ? `Next touch · ${externalWorkflow.nextActionAtLabel}`
            : `Starts · ${formatDateTimeLabel(appointment.startsAt, {
                timeZone: input.timeZone ?? null,
              })}`,
        href: `/agent/calendar?appointmentId=${appointment.id}`,
        actionLabel:
          kindLabel === "Appointment soon"
            ? "Open calendar item"
            : "Open calendar writeback",
        _priority: priority,
        _sortAt:
          nextActionTime != null && nextActionTime < startsAtTime
            ? (externalWorkflow.nextActionAt ?? appointment.startsAt)
            : appointment.startsAt,
        _clientId: appointment.client?.id ?? null,
      };
    },
  );
  const dueTaskItems: CleanupCandidate[] = dueFollowUpTasks.flatMap((task) => {
    if (!task.client || !task.dueAt) {
      return [];
    }

    const isOverdue = task.dueAt.getTime() < startOfToday.getTime();

    return [
      {
        id: `follow-up-task-${task.id}`,
        kindKey: "follow_up",
        kindLabel: "Follow-up task",
        tone: isOverdue ? "danger" : "warning",
        title: task.client.fullName,
        description: [
          task.title.trim() || "Scheduled follow-up",
          task.client.stage.trim() || "Stage not captured",
          formatRelativeDueLabel(task.dueAt, now, input.timeZone),
        ]
          .filter(Boolean)
          .join(" · "),
        ownerKey: "assigned_to_viewer",
        ownerLabel: "Assigned to you",
        scopeKey: "follow_up_task",
        scopeLabel: "Client follow-up task",
        pressureKey: isOverdue ? "overdue" : "due_today",
        pressureLabel: isOverdue ? "Overdue" : "Due today",
        metaLabels: [
          task.client.source?.trim() || "Source not captured",
          task.client.lastContactAt
            ? `Last contact · ${formatDateLabel(
                task.client.lastContactAt,
                input.timeZone,
              )}`
            : "No contact logged yet",
        ],
        whyNowLabel: isOverdue
          ? "The scheduled follow-up task is already overdue."
          : "This follow-up task lands in today's working set.",
        sortLabel: `Due · ${formatDateLabel(task.dueAt, input.timeZone)}`,
        href: `/agent/clients/${task.client.id}`,
        actionLabel: "Open client workspace",
        _priority: isOverdue ? 0 : 2,
        _sortAt: task.dueAt,
        _clientId: task.client.id,
      },
    ];
  });
  const dueClientItems: CleanupCandidate[] = dueFollowUpClientOnly.map(
    (client) => {
      const nextTouchAt =
        client.nextFollowUpAt ?? client.leaseReminderAt ?? now;
      const isOverdue = nextTouchAt.getTime() < startOfToday.getTime();

      return {
        id: `follow-up-client-${client.id}`,
        kindKey: "follow_up",
        kindLabel: "Follow-up due",
        tone: isOverdue ? "danger" : "warning",
        title: client.fullName,
        description: [
          client.stage.trim() || "Stage not captured",
          formatNextTouchLabel({
            nextFollowUpAt: client.nextFollowUpAt,
            leaseReminderAt: client.leaseReminderAt,
            now,
            timeZone: input.timeZone,
          }),
        ]
          .filter(Boolean)
          .join(" · "),
        ownerKey: "assigned_to_viewer",
        ownerLabel: "Assigned to you",
        scopeKey: "client_next_touch",
        scopeLabel: "Client next touch",
        pressureKey: isOverdue ? "overdue" : "due_today",
        pressureLabel: isOverdue ? "Overdue" : "Due today",
        metaLabels: [
          client.source?.trim() || "Source not captured",
          client.lastContactAt
            ? `Last contact · ${formatDateLabel(
                client.lastContactAt,
                input.timeZone,
              )}`
            : "No contact logged yet",
        ],
        whyNowLabel: isOverdue
          ? "The next planned follow-up date has already slipped."
          : "This client's next touch is due today and should stay in the active pass.",
        sortLabel: `Next touch · ${formatDateLabel(nextTouchAt, input.timeZone)}`,
        href: `/agent/clients/${client.id}`,
        actionLabel: "Open client workspace",
        _priority: isOverdue ? 0 : 2,
        _sortAt: nextTouchAt,
        _clientId: client.id,
      };
    },
  );
  const sendRiskItems: CleanupCandidate[] = latestSendRecords
    .filter((record) => !isClosedClientStage(record.client.stage))
    .flatMap<CleanupCandidate>((record) => {
      if (record.openCount <= 0) {
        if (record.sentAt.getTime() > threeDaysAgo.getTime()) {
          return [];
        }

        const daysSinceSend = buildElapsedDayCount(record.sentAt, now, 3);

        return [
          {
            id: `send-risk-${record.id}`,
            kindKey: "send_risk",
            kindLabel: "Send risk",
            tone: "danger",
            title: record.client.fullName,
            description: [
              record.listing?.title?.trim() || "Tracked Front Office send",
              formatSendRecordStageLabel(
                record.clientStageLabel || record.client.stage,
              ),
              buildSendRecordAppointmentLabel({
                title: record.appointmentTitle,
                startsAt: record.appointmentStartsAt,
                timeZone: input.timeZone,
              }),
              `${daysSinceSend} day(s) since send with no tracked open.`,
            ]
              .filter(Boolean)
              .join(" · "),
            ownerKey: "assigned_to_viewer",
            ownerLabel: "Assigned to you",
            scopeKey: "tracked_send_rescue",
            scopeLabel: "Tracked send rescue",
            pressureKey: "send_unopened_3_days",
            pressureLabel: "Unopened 3+ days",
            metaLabels: [
              `Channel · ${formatFrontOfficeSendChannelLabel(record.channel)}`,
              record.client.source?.trim() || "Source not captured",
            ],
            whyNowLabel:
              "The tracked send is still unopened after the initial wait window.",
            sortLabel: `Sent · ${formatDateLabel(record.sentAt, input.timeZone)}`,
            href: `/agent/clients/${record.client.id}`,
            actionLabel: "Open send trail",
            _priority: 4,
            _sortAt: record.sentAt,
            _clientId: record.client.id,
          },
        ];
      }

      const lastEngagementAt = record.lastOpenedAt ?? record.sentAt;

      if (lastEngagementAt.getTime() > sevenDaysAgo.getTime()) {
        return [];
      }

      const quietDays = buildElapsedDayCount(lastEngagementAt, now, 7);

      return [
        {
          id: `send-risk-${record.id}`,
          kindKey: "send_risk",
          kindLabel: "Send risk",
          tone: "warning",
          title: record.client.fullName,
          description: [
            record.listing?.title?.trim() || "Tracked Front Office send",
            formatSendRecordStageLabel(
              record.clientStageLabel || record.client.stage,
            ),
            buildSendRecordAppointmentLabel({
              title: record.appointmentTitle,
              startsAt: record.appointmentStartsAt,
              timeZone: input.timeZone,
            }),
            `${quietDays} day(s) since the last tracked open.`,
          ]
            .filter(Boolean)
            .join(" · "),
          ownerKey: "assigned_to_viewer",
          ownerLabel: "Assigned to you",
          scopeKey: "tracked_send_rescue",
          scopeLabel: "Tracked send rescue",
          pressureKey: "send_quiet_after_open",
          pressureLabel: "Quiet after last open",
          metaLabels: [
            `Channel · ${formatFrontOfficeSendChannelLabel(record.channel)}`,
            record.client.source?.trim() || "Source not captured",
          ],
          whyNowLabel:
            "The last tracked open has gone quiet long enough to warrant a fresh follow-up pass.",
          sortLabel: `Last open · ${formatDateLabel(
            lastEngagementAt,
            input.timeZone,
          )}`,
          href: `/agent/clients/${record.client.id}`,
          actionLabel: "Open send trail",
          _priority: 5,
          _sortAt: lastEngagementAt,
          _clientId: record.client.id,
        },
      ];
    });
  const staleClientItems: CleanupCandidate[] = staleClients.map((client) => {
    const staleSince = client.lastContactAt ?? client.createdAt;
    const staleDays = buildElapsedDayCount(staleSince, now, 15);
    const tone: FrontOfficeTone = staleDays >= 30 ? "danger" : "warning";

    return {
      id: `stale-client-${client.id}`,
      kindKey: "stale_client",
      kindLabel: "Stale client",
      tone,
      title: client.fullName,
      description: [
        client.stage.trim() || "Stage not captured",
        `${staleDays} day(s) since ${
          client.lastContactAt ? "last touch" : "record create"
        }.`,
      ]
        .filter(Boolean)
        .join(" · "),
      ownerKey: "assigned_to_viewer",
      ownerLabel: "Assigned to you",
      scopeKey: "client_freshness",
      scopeLabel: "Client freshness",
      pressureKey: tone === "danger" ? "stale_30_days" : "stale_15_days",
      pressureLabel: tone === "danger" ? "30+ days stale" : "15+ days stale",
      metaLabels: [
        client.source?.trim() || "Source not captured",
        client.lastContactAt
          ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
          : `Created · ${formatDateLabel(client.createdAt, input.timeZone)}`,
      ],
      whyNowLabel: `No logged touch has landed on this dossier for ${staleDays} day(s).`,
      sortLabel: client.lastContactAt
        ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
        : `Created · ${formatDateLabel(client.createdAt, input.timeZone)}`,
      href: `/agent/clients/${client.id}`,
      actionLabel: "Open client workspace",
      _priority: tone === "danger" ? 6 : 7,
      _sortAt: staleSince,
      _clientId: client.id,
    };
  });

  const cleanupCandidates = [
    ...dueTaskItems,
    ...dueClientItems,
    ...appointmentItems,
    ...sendRiskItems,
    ...staleClientItems,
  ].sort(
    (left, right) =>
      left._priority - right._priority ||
      left._sortAt.getTime() - right._sortAt.getTime(),
  );
  const seenCleanupClientIds = new Set<string>();
  const cleanupItems: FrontOfficeActivityCleanupItem[] = [];

  for (const item of cleanupCandidates) {
    if (item._clientId && seenCleanupClientIds.has(item._clientId)) {
      continue;
    }

    cleanupItems.push({
      id: item.id,
      kindKey: item.kindKey,
      kindLabel: item.kindLabel,
      tone: item.tone,
      title: item.title,
      description: item.description,
      ownerKey: item.ownerKey,
      ownerLabel: item.ownerLabel,
      scopeKey: item.scopeKey,
      scopeLabel: item.scopeLabel,
      pressureKey: item.pressureKey,
      pressureLabel: item.pressureLabel,
      whyNowLabel: item.whyNowLabel,
      sortLabel: item.sortLabel,
      metaLabels: item.metaLabels,
      href: item.href,
      actionLabel: item.actionLabel,
    });

    if (item._clientId) {
      seenCleanupClientIds.add(item._clientId);
    }

    if (cleanupItems.length >= 12) {
      break;
    }
  }

  const followUpMetricCount = dueTaskItems.length + dueClientItems.length;
  const sendRiskMetricCount = sendRiskItems.length;
  const staleMetricCount = staleClientItems.length;
  const totalCleanupByKind = buildCleanupKindCountRecord();
  totalCleanupByKind.follow_up = followUpMetricCount;
  totalCleanupByKind.appointment_writeback = appointmentSoonCount;
  totalCleanupByKind.send_risk = sendRiskMetricCount;
  totalCleanupByKind.stale_client = staleMetricCount;
  const visibleCleanupByKind = buildCleanupKindCountRecord();

  for (const item of cleanupItems) {
    visibleCleanupByKind[item.kindKey] += 1;
  }

  const cleanupItemCount = cleanupItems.length + duplicatePairs.length;
  const urgentCleanupCount = cleanupItems.filter(
    (item) => item.tone === "danger",
  ).length;
  const totalCleanupPressureCount =
    totalCleanupByKind.follow_up +
    totalCleanupByKind.appointment_writeback +
    totalCleanupByKind.send_risk +
    totalCleanupByKind.stale_client +
    duplicatePairs.length;
  const visibleCleanupByFilter = buildCleanupFilterCountRecord();
  visibleCleanupByFilter.all = cleanupItemCount;
  visibleCleanupByFilter.follow_up = visibleCleanupByKind.follow_up;
  visibleCleanupByFilter.appointment_writeback =
    visibleCleanupByKind.appointment_writeback;
  visibleCleanupByFilter.send_risk = visibleCleanupByKind.send_risk;
  visibleCleanupByFilter.stale_client = visibleCleanupByKind.stale_client;
  visibleCleanupByFilter.duplicate_review = duplicatePairs.length;
  const cleanupMetrics: FrontOfficeActivityCleanupMetric[] = [
    {
      key: "follow_up",
      label: "Follow-up due",
      count: followUpMetricCount,
      visibleCount: visibleCleanupByKind.follow_up,
      countMode: "raw_pressure",
      tone: followUpMetricCount > 0 ? "warning" : "neutral",
      helper:
        "Scheduled follow-up work that should be touched today or is already overdue.",
    },
    {
      key: "appointment_writeback",
      label: "Appointment cleanup",
      count: appointmentSoonCount,
      visibleCount: visibleCleanupByKind.appointment_writeback,
      countMode: "raw_pressure",
      tone: appointmentSoonCount > 0 ? "accent" : "neutral",
      helper:
        "Calendar-owned meetings and promised external touches in the next two days that still need direct Front Office follow-through.",
    },
    {
      key: "send_risk",
      label: "Send risk",
      count: sendRiskMetricCount,
      visibleCount: visibleCleanupByKind.send_risk,
      countMode: "raw_pressure",
      tone: sendRiskMetricCount > 0 ? "warning" : "neutral",
      helper:
        "Tracked sends with no open after three days or no recent engagement after the last open.",
    },
    {
      key: "stale_client",
      label: "Stale clients",
      count: staleMetricCount,
      visibleCount: visibleCleanupByKind.stale_client,
      countMode: "raw_pressure",
      tone: staleMetricCount > 0 ? "danger" : "neutral",
      helper:
        "Active dossiers that have gone 15+ days without a logged contact touch.",
    },
    {
      key: "duplicate_review",
      label: "Potential dupes",
      count: duplicatePairs.length,
      visibleCount: duplicatePairs.length,
      countMode: "surfaced_items",
      tone: duplicatePairs.length > 0 ? "accent" : "neutral",
      helper:
        "Visible-scope duplicate review pairs that should be merged before the next touch.",
    },
  ];
  const notificationCards = notifications.map((notification) => {
    const group = getFrontOfficeNotificationGroup({
      type: notification.type,
      metadata: notification.metadata,
    });
    const stream = getFrontOfficeNotificationStream({
      actionUrl: notification.actionUrl?.trim() || null,
      membershipId: notification.membershipId,
      groupKey: group.groupKey,
    });
    const owner = getFrontOfficeNotificationOwnerLabel(
      notification.membershipId != null,
    );
    const scope = getFrontOfficeNotificationScopeLabel({
      groupKey: group.groupKey,
      streamKey: stream.streamKey,
      streamLabel: stream.streamLabel,
    });
    const readStateMutable = notification.membershipId != null;
    const isUnread = readStateMutable && notification.readAt == null;
    const pressureTone = mapNotificationSeverityTone(notification.severity);
    const pressureState = getFrontOfficeNotificationPressureState({
      groupKey: group.groupKey,
      notificationTone: pressureTone,
      readStateMutable,
      isUnread,
    });

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      typeLabel: formatNotificationType(notification.type),
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      streamKey: stream.streamKey,
      streamLabel: stream.streamLabel,
      audienceLabel: readStateMutable
        ? "Personal notice"
        : "Shared office notice",
      ownerKey: owner.ownerKey,
      ownerLabel: owner.ownerLabel,
      scopeKey: scope.scopeKey,
      scopeLabel: scope.scopeLabel,
      pressureKey: pressureState.key,
      pressureLabel: pressureState.label,
      pressureTone: pressureState.tone,
      whyNowLabel: pressureState.whyNowLabel,
      tone:
        notification.type === NotificationType.appointment_due_soon
          ? "accent"
          : mapNotificationSeverityTone(notification.severity),
      createdAtLabel: formatDateTimeLabel(notification.createdAt, {
        timeZone: input.timeZone ?? null,
      }),
      actionLabel: getFrontOfficeNotificationActionLabel({
        type: notification.type,
        actionUrl: notification.actionUrl?.trim() || null,
        groupKey: group.groupKey,
      }),
      href: `/agent/notifications/${notification.id}/open`,
      isUnread,
      readStateLabel: !readStateMutable
        ? "Shared notice"
        : notification.readAt == null
          ? "Unread"
          : "Read",
      readStateMutable,
    } satisfies FrontOfficeActivityNotificationRecord;
  });
  const notificationGroupCounts = buildNotificationGroupCountRecord();
  const notificationStreamCounts = buildNotificationStreamCountRecord();
  let personalVisibleNoticeCount = 0;
  let sharedVisibleNoticeCount = 0;
  let unreadPersonalVisibleNoticeCount = 0;

  for (const card of notificationCards) {
    notificationGroupCounts[card.groupKey] += 1;

    if (card.groupKey === "general_notice") {
      notificationStreamCounts[card.streamKey] += 1;
    }

    if (card.readStateMutable) {
      personalVisibleNoticeCount += 1;

      if (card.isUnread) {
        unreadPersonalVisibleNoticeCount += 1;
      }
    } else {
      sharedVisibleNoticeCount += 1;
    }
  }

  const counts: FrontOfficeActivityCounts = {
    notifications: {
      visibleCount: notificationCards.length,
      personalVisibleCount: personalVisibleNoticeCount,
      mutableVisibleCount: personalVisibleNoticeCount,
      sharedVisibleCount: sharedVisibleNoticeCount,
      unreadPersonalVisibleCount: unreadPersonalVisibleNoticeCount,
      unreadPersonalTotalCount: unreadNoticeCount,
      appointmentReminderVisibleCount:
        notificationCards.length - notificationGroupCounts.general_notice,
      generalNoticeVisibleCount: notificationGroupCounts.general_notice,
      byGroup: notificationGroupCounts,
      generalByStream: notificationStreamCounts,
    },
    cleanup: {
      surfacedCount: cleanupItemCount,
      surfacedItemCount: cleanupItems.length,
      duplicateReviewCount: duplicatePairs.length,
      urgentSurfacedCount: urgentCleanupCount,
      totalPressureCount: totalCleanupPressureCount,
      visibleByKind: visibleCleanupByKind,
      totalByKind: totalCleanupByKind,
      visibleByFilter: visibleCleanupByFilter,
    },
    events: {
      visibleCount: events.length,
    },
  };

  return {
    summary: {
      actionableItemCount:
        counts.notifications.visibleCount + counts.cleanup.surfacedCount,
      upcomingEventCount: counts.events.visibleCount,
      unreadNoticeCount,
      cleanupItemCount: counts.cleanup.surfacedCount,
      duplicateReviewCount: counts.cleanup.duplicateReviewCount,
      appointmentSoonCount: counts.cleanup.totalByKind.appointment_writeback,
      sharedNoticeCount: counts.notifications.sharedVisibleCount,
      urgentCleanupCount: counts.cleanup.urgentSurfacedCount,
    },
    counts,
    filters: {
      cleanup: buildFrontOfficeActivityCleanupFilterContract(
        counts.cleanup,
      ),
      notices: buildFrontOfficeActivityNoticeFilterContract(
        counts.notifications,
      ),
      noticeLanes: buildFrontOfficeActivityNoticeStreamFilterContract(
        counts.notifications,
      ),
      readState: buildFrontOfficeActivityReadStateFilterContract(
        counts.notifications,
      ),
    },
    notifications: notificationCards,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      typeLabel: event.meetingUrl?.trim() ? "Meeting" : "Event",
      visibilityLabel: formatEventVisibilityLabel(event.visibility),
      locationLabel:
        event.location?.trim() ||
        event.meetingUrl?.trim() ||
        "Location pending",
      startsAtLabel: formatDateTimeLabel(event.startsAt, {
        timeZone: input.timeZone ?? null,
      }),
      rsvpLabel:
        event.rsvps[0]?.status === "going"
          ? "You RSVP'd going"
          : event.rsvps[0]?.status === "maybe"
            ? "You RSVP'd maybe"
            : event.rsvps[0]?.status === "declined"
              ? "You declined"
              : `${event._count.rsvps} RSVP(s)`,
      href: event.meetingUrl?.trim() || "/agent/notifications",
    })),
    cleanup: {
      metrics: cleanupMetrics,
      items: cleanupItems,
      duplicatePairs,
    },
  };
}
