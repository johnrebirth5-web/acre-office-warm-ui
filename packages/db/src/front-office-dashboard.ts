import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  ListingStatus,
  MembershipStatus,
  NotificationType,
  Prisma,
  ResourceType,
  SignatureRequestStatus,
  TaskStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import {
  buildFrontOfficeAiAcceptedActionBreakdown,
  buildFrontOfficeAiAcceptedActionBreakdownWindows,
  buildFrontOfficeAiBoundaryContract,
  buildFrontOfficeAiFollowUpAction,
  buildFrontOfficeAiSuggestionHistoryIndex,
  buildFrontOfficeAiStrategyPlaybookContract,
  buildFrontOfficeAiStrategyContract,
  formatFrontOfficeAiActionTypeLabel,
  formatFrontOfficeAiSourceSurfaceLabel,
  mapFrontOfficeAiAcceptedActionOutcome,
  rankFrontOfficeAiQueueHistoryCandidates,
  type FrontOfficeAiFollowUpKind,
  type FrontOfficeAiStrategyContract,
  type FrontOfficeAiStrategyRule,
} from "./front-office-ai";
import {
  buildFrontOfficeHandoffCreateHref,
  isFrontOfficeStageReadyForBackOffice,
} from "./front-office-contracts";
import {
  frontOfficeAppointmentExternalWorkflowStatuses,
  getFrontOfficeAppointmentExternalWorkflowState,
  type FrontOfficeAppointmentExternalWorkflowStatus,
} from "./front-office-appointments";
import {
  getFrontOfficeSharedResourceInteractionSnapshot,
  type FrontOfficeSharedResourceInteractionSnapshot,
} from "./front-office-resources";
import { resolveLeaseReminderDates } from "./lease-reminders";
import { reconcileOfficeNotificationReminders } from "./notifications";
import {
  buildTeamMembershipHierarchyMap,
  isLeaderTeamMembershipRole,
} from "./team-hierarchy";

export type FrontOfficeDashboardTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

const frontOfficeDashboardLeadershipKindKeys = [
  "overdue_task",
  "engagement_risk",
  "stale_client",
] as const;
type FrontOfficeDashboardLeadershipKindKey =
  (typeof frontOfficeDashboardLeadershipKindKeys)[number];

const frontOfficeDashboardLeadershipFilterKeys = [
  "all",
  "overdue_task",
  "engagement_risk",
  "stale_client",
] as const;
type FrontOfficeDashboardLeadershipFilterKey =
  (typeof frontOfficeDashboardLeadershipFilterKeys)[number];

type FrontOfficeDashboardLeadershipScopeKey =
  | "team_execution_pressure"
  | "office_execution_pressure"
  | "none";

type FrontOfficeDashboardFilterOption<TValue extends string> = {
  value: TValue;
  label: string;
  count: number;
};

type FrontOfficeDashboardLeadershipFilterContract = {
  defaultValue: "all";
  paramKey: "teamCleanupFilter";
  options: FrontOfficeDashboardFilterOption<FrontOfficeDashboardLeadershipFilterKey>[];
};

const frontOfficeDashboardLeadershipPreviewPerKind = 2;
const frontOfficeDashboardLeadershipPreviewTotal = 4;
const frontOfficeDashboardLeadershipWorkbenchPerKind = 6;
const frontOfficeDashboardLeadershipTaskFetchLimit = 8;

const frontOfficeDashboardCalendarViews = {
  replyDue: "reply_due",
  confirmationPending: "confirmation_pending",
  confirmed: "confirmed",
  touchDue: "touch_due",
  missingNextTouch: "missing_next_touch",
  rescheduleRequested: "reschedule_requested",
} as const;

type FrontOfficeDashboardCalendarView =
  (typeof frontOfficeDashboardCalendarViews)[keyof typeof frontOfficeDashboardCalendarViews];

export type FrontOfficeDashboardSummary = {
  todayActionCount: number;
  followUpDueCount: number;
  leaseReminderCount: number;
  overdueTaskCount: number;
  staleClientCount: number;
  todayCommitmentCount: number;
  needsBackOfficeCount: number;
  leadershipPressureCount: number;
  aiSuggestionCount: number;
};

export type FrontOfficeDashboardActionQueueItem = {
  id: string;
  label: string;
  count: number;
  tone: FrontOfficeDashboardTone;
  description: string;
  helper: string;
  sequenceLabel: string;
  whyNowLabel: string;
  nextStepLabel: string;
  href: string;
  actionLabel: string;
};

export type FrontOfficeDashboardStageMetric = {
  label: string;
  count: number;
  tone: FrontOfficeDashboardTone;
};

export type FrontOfficeDashboardClientItem = {
  id: string;
  fullName: string;
  stage: string;
  stageTone: FrontOfficeDashboardTone;
  source: string;
  nextTouchLabel: string;
  lastTouchLabel: string;
  href: string;
};

export type FrontOfficeDashboardCommitmentItem = {
  id: string;
  title: string;
  badgeLabel: string;
  badgeTone: FrontOfficeDashboardTone;
  startsAtLabel: string;
  locationLabel: string;
  contextLabel: string;
  actionLabel: string;
  href: string;
};

export type FrontOfficeDashboardListingItem = {
  id: string;
  title: string;
  neighborhoodLabel: string;
  priceLabel: string;
  statusLabel: string;
  statusTone: FrontOfficeDashboardTone;
  trackedLinkCount: number;
  trackedClickCount: number;
  href: string;
};

export type FrontOfficeDashboardEngagementItem = {
  id: string;
  clientName: string;
  listingTitle: string;
  channelLabel: string;
  stageLabel: string;
  appointmentLabel: string;
  sentAtLabel: string;
  engagementLabel: string;
  engagementTone: FrontOfficeDashboardTone;
  detailLabel: string;
  href: string;
};

export type FrontOfficeDashboardNoticeItem = {
  id: string;
  title: string;
  body: string;
  typeLabel: string;
  createdAtLabel: string;
  href: string;
};

export type FrontOfficeDashboardResourceItem = {
  id: string;
  title: string;
  typeLabel: string;
  summary: string;
  href: string;
};

export type FrontOfficeDashboardVendorItem = {
  id: string;
  name: string;
  category: string;
  headline: string;
  contactLabel: string;
  href: string | null;
};

export type FrontOfficeDashboardLeaseReminderItem = {
  id: string;
  clientName: string;
  statusLabel: string;
  tone: FrontOfficeDashboardTone;
  reminderLabel: string;
  detailLabel: string;
  actionLabel: string;
  href: string;
};

export type FrontOfficeDashboardBackOfficeItem = {
  id: string;
  title: string;
  description: string;
  contextLabel: string;
  tone: FrontOfficeDashboardTone;
  actionLabel: string;
  href: string;
};

export type FrontOfficeDashboardLeadershipItem = {
  id: string;
  kindKey: FrontOfficeDashboardLeadershipKindKey;
  kindLabel: string;
  title: string;
  description: string;
  contextLabel: string;
  ownerLabel: string;
  scopeLabel: string;
  pressureLabel: string;
  whyNowLabel: string;
  nextStepLabel: string;
  tone: FrontOfficeDashboardTone;
  actionLabel: string;
  href: string;
};

export type FrontOfficeDashboardAiQueueItem = {
  id: string;
  clientId: string;
  clientName: string;
  suggestionKind: FrontOfficeAiFollowUpKind;
  statusLabel: string;
  tone: FrontOfficeDashboardTone;
  description: string;
  contextLabel: string;
  sequenceLabel: string;
  safeActionLabel: string;
  sequenceContractLabel: string;
  whyNowLabel: string;
  helperLabel: string;
  whyNowSignals: string[];
  rankingSignals: string[];
  boundaryLabel: string;
  boundaryTone: FrontOfficeDashboardTone;
  boundaryDescription: string;
  primaryActionReason: string;
  oneClickReason: string;
  openDossierHref: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  primaryActionOpensInNewTab: boolean;
  followUpTitle: string;
  followUpDueAt: string;
  allowsDirectFollowUpCreation: boolean;
};

export type FrontOfficeDashboardAiAcceptedActionItem = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  statusLabel: string;
  statusTone: FrontOfficeDashboardTone;
  description: string;
  contextLabel: string;
  helperLabel: string;
  href: string;
  actionLabel: string;
};

type FrontOfficeDashboardLeadershipEngagementItem =
  FrontOfficeDashboardLeadershipItem & {
    _priority: number;
    _sortAt: Date;
  };

function buildFrontOfficeDashboardActionSequenceLabel(
  actionId: FrontOfficeDashboardActionQueueItem["id"],
) {
  switch (actionId) {
    case "leadership":
      return "Clear leadership pressure first";
    case "follow-up":
      return "Then work the next-touch clock";
    case "commitments":
      return "Keep calendar commitments in order";
    case "lease-reminders":
      return "Protect lease timing before it slips";
    case "content":
      return "Rescue the send-risk trail";
    case "handoff":
      return "Move formal work to Back Office";
    default:
      return "Keep the command deck in sequence";
  }
}

function buildFrontOfficeDashboardAiSequenceLabel(
  suggestionKind: FrontOfficeDashboardAiQueueItem["suggestionKind"],
) {
  switch (suggestionKind) {
    case "reentry":
      return "Reopen gently after the formal close";
    case "postclose":
      return "Keep the relationship warm after the win";
    case "closing":
      return "Steady the finish before the milestone slips";
    case "lease":
      return "Protect the lease window";
    case "appointment":
      return "Prep the calendar checkpoint";
    case "content_rescue":
      return "Rescue the quiet send trail";
    case "warm_engagement":
      return "Turn the warm signal into the next step";
    case "handoff":
      return "Prepare the formal handoff";
    default:
      return "Choose the next grounded touch";
  }
}

function buildFrontOfficeDashboardAiSafeActionLabel(
  suggestionKind: FrontOfficeDashboardAiQueueItem["suggestionKind"],
) {
  switch (suggestionKind) {
    case "reentry":
      return "Safe action · Reopen gently without restarting formal workflow";
    case "postclose":
      return "Safe action · Keep the relationship warm without reopening formal work";
    case "closing":
      return "Safe action · Steady the finish without jumping ahead";
    case "lease":
      return "Safe action · Confirm lease timing before the window slips";
    case "appointment":
      return "Safe action · Open calendar writeback before dossier follow-up";
    case "content_rescue":
      return "Safe action · Rescue the send trail before retrying the send";
    case "warm_engagement":
      return "Safe action · Turn warm interest into the next grounded step";
    case "handoff":
      return "Safe action · Confirm the package before opening Back Office";
    default:
      return "Safe action · Open the dossier and choose the next grounded touch";
  }
}

function buildFrontOfficeDashboardAiSequenceContractLabel(
  suggestionKind: FrontOfficeDashboardAiQueueItem["suggestionKind"],
) {
  switch (suggestionKind) {
    case "reentry":
      return "Sequence contract · Reopen gently, then reassess the next touch";
    case "postclose":
      return "Sequence contract · Stay in relationship lane, not formal workflow";
    case "closing":
      return "Sequence contract · Stabilize the finish, then hand off if needed";
    case "lease":
      return "Sequence contract · Protect lease timing before it slips";
    case "appointment":
      return "Sequence contract · Calendar writeback first, dossier second";
    case "content_rescue":
      return "Sequence contract · Rescue the send trail before retrying the send";
    case "warm_engagement":
      return "Sequence contract · Convert warm interest into the next step";
    case "handoff":
      return "Sequence contract · Prepare the package before Back Office";
    default:
      return "Sequence contract · Open the dossier first, then choose the next touch";
  }
}

function buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals: string[]) {
  const signals = whyNowSignals.filter((signal) => signal.trim().length > 0);

  if (!signals.length) {
    return "Why now · Use the record trail to justify the next touch";
  }

  return `Why now · ${signals.slice(0, 2).join(" · ")}`;
}

type FrontOfficeDashboardAiCandidateItem = Omit<
  FrontOfficeDashboardAiQueueItem,
  | "allowsDirectFollowUpCreation"
  | "whyNowSignals"
  | "rankingSignals"
  | "boundaryLabel"
  | "boundaryTone"
  | "boundaryDescription"
  | "primaryActionReason"
  | "oneClickReason"
  | "primaryActionLabel"
  | "primaryActionHref"
  | "primaryActionOpensInNewTab"
  | "helperLabel"
> & {
  helperLabel: string;
  whyNowSignals?: string[];
  primaryActionLabel?: string;
  primaryActionHref?: string;
  primaryActionOpensInNewTab?: boolean;
  defaultAllowsDirectFollowUpCreation?: boolean;
  hasLinkedTransaction: boolean;
  isReadyForBackOffice: boolean;
  hasClosedTransaction: boolean;
  hasCancelledTransaction: boolean;
  basePriority: number;
  sortAt: Date;
};

export type FrontOfficeDashboardSnapshot = {
  summary: FrontOfficeDashboardSummary;
  actionQueue: FrontOfficeDashboardActionQueueItem[];
  pipeline: {
    stageMetrics: FrontOfficeDashboardStageMetric[];
    recentClients: FrontOfficeDashboardClientItem[];
  };
  commitments: {
    items: FrontOfficeDashboardCommitmentItem[];
    appointmentModuleReady: boolean;
    appointmentMessage: string;
  };
  listingOutput: {
    activeListingCount: number;
    trackedLinkCount: number;
    trackedClickCount: number;
    sendRecordCount: number;
    openedSendCount: number;
    engagedClientCount: number;
    recentListings: FrontOfficeDashboardListingItem[];
    recentEngagement: FrontOfficeDashboardEngagementItem[];
    trackedSendingReady: boolean;
  };
  noticeRail: {
    notifications: FrontOfficeDashboardNoticeItem[];
    resources: FrontOfficeDashboardResourceItem[];
    vendors: FrontOfficeDashboardVendorItem[];
    resourcePulse: FrontOfficeSharedResourceInteractionSnapshot;
  };
  leaseReminders: {
    dueCount: number;
    overdueCount: number;
    items: FrontOfficeDashboardLeaseReminderItem[];
  };
  aiQueue: {
    suggestionCount: number;
    items: FrontOfficeDashboardAiQueueItem[];
  };
  aiStrategy: FrontOfficeAiStrategyContract;
  aiAcceptedActions: {
    acceptedCount: number;
    positiveOutcomeCount: number;
    breakdown: {
      label: string;
      summary: string;
    }[];
    windows: {
      label: string;
      summary: string;
      items: {
        label: string;
        summary: string;
      }[];
    }[];
    items: FrontOfficeDashboardAiAcceptedActionItem[];
  };
  backOffice: {
    items: FrontOfficeDashboardBackOfficeItem[];
  };
  leadershipQueue: {
    visible: boolean;
    scopeLabel: string;
    scopeKey: FrontOfficeDashboardLeadershipScopeKey;
    overdueTaskCount: number;
    staleClientCount: number;
    engagementRiskCount: number;
    counts: {
      surfacedCount: number;
      totalSignalCount: number;
      byKind: Record<FrontOfficeDashboardLeadershipKindKey, number>;
    };
    filters: FrontOfficeDashboardLeadershipFilterContract;
    items: FrontOfficeDashboardLeadershipItem[];
    activityCenterItems: FrontOfficeDashboardLeadershipItem[];
  };
};

const frontOfficeDashboardLeadershipFilterLabels: Record<
  FrontOfficeDashboardLeadershipFilterKey,
  string
> = {
  all: "All team pressure",
  overdue_task: "Overdue tasks",
  engagement_risk: "Send-trail risk",
  stale_client: "15+ day stale",
};

function buildFrontOfficeDashboardLeadershipKindCountRecord() {
  return {
    overdue_task: 0,
    engagement_risk: 0,
    stale_client: 0,
  } satisfies Record<FrontOfficeDashboardLeadershipKindKey, number>;
}

function resolveDashboardAppointmentCalendarView(input: {
  externalStatusValue: FrontOfficeAppointmentExternalWorkflowStatus;
  nextActionAt: Date | null;
  isExternalTouchDue: boolean;
}): FrontOfficeDashboardCalendarView | null {
  switch (input.externalStatusValue) {
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmed:
      return frontOfficeDashboardCalendarViews.confirmed;
    case frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested:
      return frontOfficeDashboardCalendarViews.rescheduleRequested;
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending:
      return input.isExternalTouchDue
        ? frontOfficeDashboardCalendarViews.touchDue
        : frontOfficeDashboardCalendarViews.confirmationPending;
    case frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp:
      return input.isExternalTouchDue
        ? frontOfficeDashboardCalendarViews.touchDue
        : frontOfficeDashboardCalendarViews.replyDue;
    default:
      if (input.isExternalTouchDue) {
        return frontOfficeDashboardCalendarViews.touchDue;
      }

      if (!input.nextActionAt) {
        return frontOfficeDashboardCalendarViews.missingNextTouch;
      }

      return null;
  }
}

function formatDashboardAppointmentCalendarActionLabel(
  calendarView: FrontOfficeDashboardCalendarView | null,
) {
  switch (calendarView) {
    case frontOfficeDashboardCalendarViews.replyDue:
      return "Open reply-due writeback";
    case frontOfficeDashboardCalendarViews.confirmationPending:
      return "Open confirmation writeback";
    case frontOfficeDashboardCalendarViews.confirmed:
      return "Open confirmed writeback";
    case frontOfficeDashboardCalendarViews.touchDue:
      return "Open touch writeback";
    case frontOfficeDashboardCalendarViews.missingNextTouch:
      return "Open next-touch writeback";
    case frontOfficeDashboardCalendarViews.rescheduleRequested:
      return "Open reschedule writeback";
    default:
      return "Open appointment writeback";
  }
}

function formatDashboardAppointmentCalendarViewLabel(
  calendarView: FrontOfficeDashboardCalendarView | null,
) {
  switch (calendarView) {
    case frontOfficeDashboardCalendarViews.replyDue:
      return "Reply due";
    case frontOfficeDashboardCalendarViews.confirmationPending:
      return "Awaiting confirmation";
    case frontOfficeDashboardCalendarViews.confirmed:
      return "Externally confirmed";
    case frontOfficeDashboardCalendarViews.touchDue:
      return "Touch due";
    case frontOfficeDashboardCalendarViews.missingNextTouch:
      return "Missing next touch";
    case frontOfficeDashboardCalendarViews.rescheduleRequested:
      return "Reschedule requested";
    default:
      return "Appointment workbench";
  }
}

type GetFrontOfficeDashboardSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  viewerRole: UserRole;
  officeId?: string | null;
  timeZone?: string | null;
};

const openFollowUpStatuses: TaskStatus[] = [
  TaskStatus.queued,
  TaskStatus.in_progress,
];
const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];
const activeTransactionStatuses: TransactionStatus[] = [
  TransactionStatus.pending,
  TransactionStatus.active,
];
const openSignatureStatuses: SignatureRequestStatus[] = [
  SignatureRequestStatus.draft,
  SignatureRequestStatus.pending_send,
  SignatureRequestStatus.sent,
  SignatureRequestStatus.viewed,
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

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "—";
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDueLabel(value: Date | null | undefined, now: Date) {
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
    return `Overdue since ${formatDateLabel(value)}`;
  }

  if (dueTime < startOfTomorrow) {
    return `Due today · ${formatDateTimeLabel(value, { timeZone: null })}`;
  }

  return `Next follow-up · ${formatDateLabel(value)}`;
}

function buildLeaseReminderStatus(input: {
  leaseEndDate: Date | null;
  leaseReminderAt: Date | null;
  now: Date;
}) {
  const leaseDates = resolveLeaseReminderDates({
    leaseEndDate: input.leaseEndDate,
    leaseReminderAt: input.leaseReminderAt,
  });
  const startOfToday = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate(),
  );
  const startOfTomorrow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 1,
  );
  const fourteenDaysFromNow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 14,
  );

  if (!leaseDates.leaseReminderAt) {
    return {
      reminderAt: null,
      statusLabel: "No reminder",
      tone: "neutral" as const,
      detailLabel: "No lease reminder is scheduled.",
    };
  }

  if (leaseDates.leaseReminderAt.getTime() < startOfToday.getTime()) {
    return {
      reminderAt: leaseDates.leaseReminderAt,
      statusLabel: "Overdue",
      tone: "danger" as const,
      detailLabel: leaseDates.leaseEndDate
        ? `Lease end ${formatDateLabel(leaseDates.leaseEndDate)}`
        : "Lease follow-up is already late.",
    };
  }

  if (leaseDates.leaseReminderAt.getTime() < startOfTomorrow.getTime()) {
    return {
      reminderAt: leaseDates.leaseReminderAt,
      statusLabel: "Due today",
      tone: "warning" as const,
      detailLabel: leaseDates.leaseEndDate
        ? `Lease end ${formatDateLabel(leaseDates.leaseEndDate)}`
        : "Renewal or remarketing touch is due today.",
    };
  }

  if (leaseDates.leaseReminderAt.getTime() <= fourteenDaysFromNow.getTime()) {
    return {
      reminderAt: leaseDates.leaseReminderAt,
      statusLabel: "Due soon",
      tone: "accent" as const,
      detailLabel: leaseDates.leaseEndDate
        ? `Lease end ${formatDateLabel(leaseDates.leaseEndDate)}`
        : "Lease-related follow-up is coming up soon.",
    };
  }

  return {
    reminderAt: leaseDates.leaseReminderAt,
    statusLabel: "Scheduled",
    tone: "success" as const,
    detailLabel: leaseDates.leaseEndDate
      ? `Lease end ${formatDateLabel(leaseDates.leaseEndDate)}`
      : "Lease reminder is already on the calendar.",
  };
}

function formatNextTouchLabel(input: {
  nextFollowUpAt: Date | null;
  leaseReminderAt: Date | null;
  now: Date;
}) {
  const leaseReminder = buildLeaseReminderStatus({
    leaseEndDate: null,
    leaseReminderAt: input.leaseReminderAt,
    now: input.now,
  });

  if (
    leaseReminder.reminderAt &&
    (!input.nextFollowUpAt ||
      leaseReminder.reminderAt.getTime() <= input.nextFollowUpAt.getTime())
  ) {
    if (leaseReminder.statusLabel === "Overdue") {
      return `Lease reminder overdue since ${formatDateLabel(leaseReminder.reminderAt)}`;
    }

    if (leaseReminder.statusLabel === "Due today") {
      return `Lease reminder · ${formatDateTimeLabel(leaseReminder.reminderAt, { timeZone: null })}`;
    }

    return `Lease reminder · ${formatDateLabel(leaseReminder.reminderAt)}`;
  }

  return formatRelativeDueLabel(input.nextFollowUpAt, input.now);
}

function buildAiQueueWhyNowSignals(input: {
  trigger: string;
  contextLabel: string;
  supportingDetail?: string | null;
}) {
  return [input.trigger, input.contextLabel, input.supportingDetail]
    .filter((value): value is string => Boolean(value?.trim()))
    .slice(0, 3);
}

function mapClientStageTone(stage: string): FrontOfficeDashboardTone {
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

function mapListingStatusTone(status: ListingStatus): FrontOfficeDashboardTone {
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

function formatListingStatus(status: ListingStatus) {
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

function mapFrontOfficeSendEngagementTone(
  openCount: number,
): FrontOfficeDashboardTone {
  if (openCount <= 0) {
    return "neutral";
  }

  if (openCount === 1) {
    return "success";
  }

  return "accent";
}

function buildFrontOfficeSendEngagementLabel(openCount: number) {
  if (openCount <= 0) {
    return "Not opened";
  }

  if (openCount === 1) {
    return "Opened";
  }

  return `Revisited ${openCount} times`;
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

function buildMembershipUserLabel(
  user:
    | {
        firstName: string | null | undefined;
        lastName: string | null | undefined;
        email: string | null | undefined;
      }
    | null
    | undefined,
  fallback: string,
) {
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  if (fullName) {
    return fullName;
  }

  if (user?.email?.trim()) {
    return user.email.trim();
  }

  return fallback;
}

function buildElapsedDayCount(value: Date, now: Date, minimum = 1) {
  return Math.max(
    minimum,
    Math.floor((now.getTime() - value.getTime()) / 86_400_000),
  );
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

function formatResourceType(type: ResourceType) {
  return (type === ResourceType.training_video ? type : ResourceType.document)
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildFrontOfficeDashboardResourceHref(
  resourceId: string,
  type: ResourceType,
  url: string | null,
) {
  if (type === ResourceType.training_video) {
    return url?.trim() || "";
  }

  return `/api/resources/${resourceId}/file`;
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

type FrontOfficeClientWorkbenchView =
  | "all"
  | "follow_first"
  | "anchor_now"
  | "viewing_lane"
  | "boundary_review"
  | "duplicate_review";

function buildClientWorkbenchHref(
  clientView: FrontOfficeClientWorkbenchView,
  hash?: string,
) {
  return `/agent/clients?clientView=${clientView}${hash ? `#${hash}` : ""}`;
}

function formatAppointmentTypeLabel(type: AppointmentType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapAppointmentTypeTone(
  type: AppointmentType,
): FrontOfficeDashboardTone {
  if (type === AppointmentType.showing || type === AppointmentType.open_house) {
    return "accent";
  }

  if (type === AppointmentType.consultation) {
    return "success";
  }

  if (type === AppointmentType.client_meeting) {
    return "warning";
  }

  return "neutral";
}

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function isClosedClientStage(stage: string) {
  const normalized = stage.trim().toLowerCase();
  return normalized.includes("won") || normalized.includes("lost");
}

async function getLeadershipScopeMembershipIds(input: {
  organizationId: string;
  viewerMembershipId: string;
  viewerRole: UserRole;
  officeId?: string | null;
}) {
  if (input.viewerRole === "team_lead") {
    const teams = await prisma.team.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        parentTeamId: true,
      },
    });
    const teamMemberships = await prisma.teamMembership.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }],
            }
          : {}),
      },
      select: {
        id: true,
        membershipId: true,
        teamId: true,
        role: true,
        reportsToTeamMembershipId: true,
        membership: {
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
      },
    });

    const hierarchy = buildTeamMembershipHierarchyMap({
      teams,
      teamMemberships: teamMemberships.map((membership) => ({
        id: membership.id,
        membershipId: membership.membershipId,
        teamId: membership.teamId,
        role: membership.role,
        reportsToTeamMembershipId: membership.reportsToTeamMembershipId,
        label:
          `${membership.membership.user.firstName} ${membership.membership.user.lastName}`.trim() ||
          membership.membership.user.email ||
          membership.membershipId,
      })),
    });

    const viewerLeaderMemberships = teamMemberships.filter(
      (membership) =>
        membership.membershipId === input.viewerMembershipId &&
        isLeaderTeamMembershipRole(membership.role),
    );
    const membershipIds = new Set<string>();

    for (const membership of viewerLeaderMemberships) {
      const hierarchyRecord = hierarchy.hierarchyMap.get(membership.id);

      for (const branchMembershipId of hierarchyRecord?.branchMembershipIds ??
        []) {
        if (branchMembershipId !== input.viewerMembershipId) {
          membershipIds.add(branchMembershipId);
        }
      }
    }

    return {
      visible: true,
      scopeKey: "team_execution_pressure" as const,
      scopeLabel: "Team execution pressure",
      membershipIds: [...membershipIds],
    };
  }

  if (input.viewerRole === "office_admin" || input.viewerRole === "owner") {
    const memberships = await prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        role: {
          in: [UserRole.agent, UserRole.team_lead],
        },
        status: MembershipStatus.active,
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }],
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    return {
      visible: true,
      scopeKey: "office_execution_pressure" as const,
      scopeLabel: "Office execution pressure",
      membershipIds: memberships
        .map((membership) => membership.id)
        .filter((membershipId) => membershipId !== input.viewerMembershipId),
    };
  }

  return {
    visible: false,
    scopeKey: "none" as const,
    scopeLabel: "",
    membershipIds: [] as string[],
  };
}

export async function getFrontOfficeDashboardSnapshot(
  input: GetFrontOfficeDashboardSnapshotInput,
): Promise<FrontOfficeDashboardSnapshot> {
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
  const fourteenDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 14,
  );
  const thirtyDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 30,
  );
  const fifteenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 15,
  );
  const ninetyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 90,
  );
  const thirtyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 30,
  );
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const leadershipScope = await getLeadershipScopeMembershipIds({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    viewerRole: input.viewerRole,
    officeId: input.officeId ?? null,
  });
  const leadershipSendWhere: Prisma.FrontOfficeSendRecordWhereInput | null =
    leadershipScope.visible && leadershipScope.membershipIds.length > 0
      ? {
          organizationId: input.organizationId,
          senderMembershipId: {
            in: leadershipScope.membershipIds,
          },
          sentAt: {
            gte: thirtyDaysAgo,
          },
          ...(input.officeId
            ? {
                officeId: input.officeId,
              }
            : {}),
        }
      : null;

  const clientWhere: Prisma.ClientWhereInput = {
    organizationId: input.organizationId,
    ownerMembershipId: input.viewerMembershipId,
  };

  const listingWhere: Prisma.ListingWhereInput = {
    organizationId: input.organizationId,
    status: {
      in: activeListingStatuses,
    },
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
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

  const resourceWhere: Prisma.ResourceWhereInput = {
    organizationId: input.organizationId,
    isPublished: true,
  };

  const vendorWhere: Prisma.VendorWhereInput = {
    organizationId: input.organizationId,
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

  const commitmentWhere: Prisma.EventWhereInput = {
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

  const [
    dueFollowUpClients,
    dueLeaseReminderClients,
    overdueLeaseReminderCount,
    openFollowUpTaskCount,
    overdueFollowUpTaskCount,
    staleClientCount,
    stageGroups,
    recentClients,
    aiSuggestionCandidates,
    aiAcceptedActionCount,
    aiPositiveOutcomeCount,
    recentAiAcceptedActions,
    activeListingCount,
    recentListings,
    shareAggregate,
    sendRecordCount,
    openedSendCount,
    engagedClientRows,
    recentSendRecords,
    upcomingEvents,
    upcomingAppointments,
    notifications,
    resources,
    vendors,
    resourcePulse,
    handoffDraftCount,
    handoffDrafts,
    signatureTransactions,
    leadershipOverdueTaskCount,
    leadershipOverdueTasks,
    leadershipStaleClientCandidates,
    leadershipLatestSendGroups,
  ] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...clientWhere,
        nextFollowUpAt: {
          lt: startOfTomorrow,
        },
      },
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        fullName: true,
        source: true,
        stage: true,
        nextFollowUpAt: true,
        leaseReminderAt: true,
        lastContactAt: true,
      },
    }),
    prisma.client.findMany({
      where: {
        ...clientWhere,
        leaseReminderAt: {
          lte: thirtyDaysFromNow,
        },
      },
      orderBy: [{ leaseReminderAt: "asc" }, { updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        fullName: true,
        leaseEndDate: true,
        leaseReminderAt: true,
      },
    }),
    prisma.client.count({
      where: {
        ...clientWhere,
        leaseReminderAt: {
          lt: startOfToday,
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
    prisma.client.count({
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
    }),
    prisma.client.groupBy({
      by: ["stage"],
      where: clientWhere,
      _count: {
        _all: true,
      },
    }),
    prisma.client.findMany({
      where: clientWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        fullName: true,
        source: true,
        stage: true,
        nextFollowUpAt: true,
        leaseReminderAt: true,
        lastContactAt: true,
      },
    }),
    prisma.client.findMany({
      where: clientWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        fullName: true,
        stage: true,
        nextFollowUpAt: true,
        leaseEndDate: true,
        leaseReminderAt: true,
        lastContactAt: true,
        createdAt: true,
        appointments: {
          where: {
            status: AppointmentStatus.scheduled,
            startsAt: {
              gte: startOfToday,
              lte: fourteenDaysFromNow,
            },
          },
          orderBy: [{ startsAt: "asc" }],
          take: 1,
          select: {
            id: true,
            title: true,
            type: true,
            startsAt: true,
          },
        },
        frontOfficeSendRecords: {
          orderBy: [{ sentAt: "desc" }],
          take: 1,
          select: {
            id: true,
            sentAt: true,
            openCount: true,
            lastOpenedAt: true,
            listing: {
              select: {
                title: true,
              },
            },
          },
        },
        handoffDrafts: {
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            committedTransactionId: true,
            summary: true,
          },
        },
        transactionContacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
          select: {
            transaction: {
              select: {
                id: true,
                status: true,
                acceptanceDate: true,
                closingDate: true,
                moveInDate: true,
              },
            },
          },
        },
      },
    }),
    prisma.frontOfficeAiAcceptedAction.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
      },
    }),
    prisma.frontOfficeAiAcceptedAction.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
        OR: [
          {
            actionType: "follow_up_created",
            followUpTask: {
              is: {
                status: TaskStatus.completed,
              },
            },
          },
          {
            actionType: "tracked_send_created",
            sendRecord: {
              is: {
                openCount: {
                  gt: 0,
                },
              },
            },
          },
        ],
      },
    }),
    prisma.frontOfficeAiAcceptedAction.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
        createdAt: {
          gte: ninetyDaysAgo,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        actionType: true,
        sourceSurface: true,
        suggestionKind: true,
        suggestionLabel: true,
        actionTitle: true,
        channel: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
        listing: {
          select: {
            title: true,
          },
        },
        followUpTask: {
          select: {
            status: true,
            dueAt: true,
          },
        },
        sendRecord: {
          select: {
            openCount: true,
            lastOpenedAt: true,
            sentAt: true,
          },
        },
      },
    }),
    prisma.listing.count({
      where: listingWhere,
    }),
    prisma.listing.findMany({
      where: listingWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        neighborhood: true,
        city: true,
        price: true,
        status: true,
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
    prisma.frontOfficeSendRecord.count({
      where: sendRecordWhere,
    }),
    prisma.frontOfficeSendRecord.count({
      where: {
        ...sendRecordWhere,
        openCount: {
          gt: 0,
        },
      },
    }),
    prisma.frontOfficeSendRecord.groupBy({
      by: ["clientId"],
      where: {
        ...sendRecordWhere,
        openCount: {
          gt: 0,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.frontOfficeSendRecord.findMany({
      where: sendRecordWhere,
      orderBy: [{ sentAt: "desc" }],
      take: 4,
      select: {
        id: true,
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
          },
        },
        listing: {
          select: {
            title: true,
          },
        },
      },
    }),
    prisma.event.findMany({
      where: commitmentWhere,
      orderBy: [{ startsAt: "asc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        visibility: true,
        startsAt: true,
        location: true,
        meetingUrl: true,
        _count: {
          select: {
            rsvps: true,
          },
        },
        rsvps: {
          where: {
            membershipId: input.viewerMembershipId,
          },
          select: {
            status: true,
          },
          take: 1,
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        startsAt: {
          gte: startOfToday,
          lte: sevenDaysFromNow,
        },
      },
      orderBy: [{ startsAt: "asc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        type: true,
        metadata: true,
        startsAt: true,
        location: true,
        meetingUrl: true,
        client: {
          select: {
            id: true,
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
    prisma.notification.findMany({
      where: notificationWhere,
      orderBy: [{ createdAt: "desc" }],
      take: 3,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        actionUrl: true,
        createdAt: true,
      },
    }),
    prisma.resource.findMany({
      where: resourceWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        type: true,
        title: true,
        summary: true,
        url: true,
      },
    }),
    prisma.vendor.findMany({
      where: vendorWhere,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        category: true,
        name: true,
        headline: true,
        phone: true,
        email: true,
        website: true,
      },
    }),
    getFrontOfficeSharedResourceInteractionSnapshot({
      organizationId: input.organizationId,
      membershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      timeZone: input.timeZone ?? null,
    }),
    prisma.frontOfficeHandoffDraft.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: [FrontOfficeHandoffStatus.draft, FrontOfficeHandoffStatus.ready],
        },
        committedTransactionId: null,
        AND: [
          officeScopeFilter ?? {},
          {
            client: {
              primaryTransactions: {
                none: {},
              },
              transactionContacts: {
                none: {},
              },
            },
          },
        ],
      },
    }),
    prisma.frontOfficeHandoffDraft.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: [FrontOfficeHandoffStatus.draft, FrontOfficeHandoffStatus.ready],
        },
        committedTransactionId: null,
        AND: [
          officeScopeFilter ?? {},
          {
            client: {
              primaryTransactions: {
                none: {},
              },
              transactionContacts: {
                none: {},
              },
            },
          },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        stageLabel: true,
        summary: true,
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: activeTransactionStatuses,
        },
        signatureRequests: {
          some: {
            status: {
              in: openSignatureStatuses,
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        title: true,
        address: true,
        signatureRequests: {
          where: {
            status: {
              in: openSignatureStatuses,
            },
          },
          select: {
            status: true,
            recipientRole: true,
          },
          take: 1,
        },
      },
    }),
    leadershipScope.visible && leadershipScope.membershipIds.length > 0
      ? prisma.followUpTask.count({
          where: {
            organizationId: input.organizationId,
            assigneeMemberId: {
              in: leadershipScope.membershipIds,
            },
            status: {
              in: [...openFollowUpStatuses],
            },
            dueAt: {
              lt: now,
            },
          },
        })
      : Promise.resolve(0),
    leadershipScope.visible && leadershipScope.membershipIds.length > 0
      ? prisma.followUpTask.findMany({
          where: {
            organizationId: input.organizationId,
            assigneeMemberId: {
              in: leadershipScope.membershipIds,
            },
            status: {
              in: [...openFollowUpStatuses],
            },
            dueAt: {
              lt: now,
            },
          },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "asc" }],
          take: frontOfficeDashboardLeadershipTaskFetchLimit,
          select: {
            id: true,
            title: true,
            dueAt: true,
            clientId: true,
            client: {
              select: {
                fullName: true,
              },
            },
            assigneeMembership: {
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
          },
        })
      : Promise.resolve([]),
    leadershipScope.visible && leadershipScope.membershipIds.length > 0
      ? prisma.client.findMany({
          where: {
            organizationId: input.organizationId,
            ownerMembershipId: {
              in: leadershipScope.membershipIds,
            },
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
          select: {
            id: true,
            fullName: true,
            stage: true,
            lastContactAt: true,
            createdAt: true,
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
          },
        })
      : Promise.resolve([]),
    leadershipSendWhere
      ? prisma.frontOfficeSendRecord.groupBy({
          by: ["clientId"],
          where: leadershipSendWhere,
          _max: {
            sentAt: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const aiLearningActions = recentAiAcceptedActions.map((action) => ({
    clientId: action.client.id,
    suggestionKind: action.suggestionKind,
    actionType: action.actionType,
    createdAt: action.createdAt,
    actionTitle: action.actionTitle,
    suggestionLabel: action.suggestionLabel,
    sourceSurface: action.sourceSurface,
    followUpTask: action.followUpTask,
    sendRecord: action.sendRecord,
  }));
  const aiHistoryIndex = buildFrontOfficeAiSuggestionHistoryIndex({
    actions: aiLearningActions,
    now,
    timeZone: input.timeZone,
  });
  const recentAiAcceptedActionItems = recentAiAcceptedActions.slice(0, 4);

  const leadershipLatestSendRecordFilters = leadershipLatestSendGroups.flatMap(
    (group) =>
      group._max.sentAt
        ? [
            {
              clientId: group.clientId,
              sentAt: group._max.sentAt,
            },
          ]
        : [],
  );
  const leadershipLatestSendRecords =
    leadershipSendWhere && leadershipLatestSendRecordFilters.length > 0
      ? await prisma.frontOfficeSendRecord.findMany({
          where: {
            AND: [
              leadershipSendWhere,
              { OR: leadershipLatestSendRecordFilters },
            ],
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
            senderMembership: {
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
            client: {
              select: {
                id: true,
                fullName: true,
                stage: true,
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

  const recentListingIds = recentListings.map((listing) => listing.id);
  const listingShareRows =
    recentListingIds.length > 0
      ? await prisma.listingShareLink.groupBy({
          by: ["listingId"],
          where: {
            membershipId: input.viewerMembershipId,
            listingId: {
              in: recentListingIds,
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

  const dueFollowUpCount = dueFollowUpClients.length;
  const leaseReminderItems: FrontOfficeDashboardLeaseReminderItem[] =
    dueLeaseReminderClients.flatMap((client) => {
      const leaseReminder = buildLeaseReminderStatus({
        leaseEndDate: client.leaseEndDate,
        leaseReminderAt: client.leaseReminderAt,
        now,
      });

      if (!leaseReminder.reminderAt) {
        return [];
      }

      return [
        {
          id: client.id,
          clientName: client.fullName,
          statusLabel: leaseReminder.statusLabel,
          tone: leaseReminder.tone,
          reminderLabel:
            leaseReminder.statusLabel === "Due today"
              ? formatDateTimeLabel(leaseReminder.reminderAt, {
                  timeZone: null,
                })
              : formatDateLabel(leaseReminder.reminderAt),
          detailLabel: leaseReminder.detailLabel,
          actionLabel: "Open client dossier",
          href: `/agent/clients/${client.id}`,
        },
      ];
    });
  const dueLeaseReminderCount = dueLeaseReminderClients.filter((client) => {
    if (!client.leaseReminderAt) {
      return false;
    }

    return client.leaseReminderAt.getTime() <= fourteenDaysFromNow.getTime();
  }).length;
  const filteredLeadershipStaleClients = leadershipStaleClientCandidates.filter(
    (client) => !isClosedClientStage(client.stage),
  );
  const leadershipStaleClientCount = filteredLeadershipStaleClients.length;
  const leadershipLatestSendByClient = new Map<
    string,
    (typeof leadershipLatestSendRecords)[number]
  >();

  for (const record of leadershipLatestSendRecords) {
    if (!leadershipLatestSendByClient.has(record.clientId)) {
      leadershipLatestSendByClient.set(record.clientId, record);
    }
  }

  const leadershipEngagementItems: FrontOfficeDashboardLeadershipEngagementItem[] =
    [...leadershipLatestSendByClient.values()]
      .filter((record) => !isClosedClientStage(record.client.stage))
      .flatMap<FrontOfficeDashboardLeadershipEngagementItem>((record) => {
        const appointmentLabel = buildSendRecordAppointmentLabel({
          title: record.appointmentTitle,
          startsAt: record.appointmentStartsAt,
          timeZone: input.timeZone,
        });
        const stageLabel = formatSendRecordStageLabel(
          record.clientStageLabel || record.client.stage,
        );
        const listingLabel =
          record.listing?.title?.trim() || "Tracked Front Office send";
        const ownerLabel = buildMembershipUserLabel(
          record.senderMembership.user,
          buildMembershipUserLabel(
            record.client.ownerMembership?.user,
            "Assigned owner",
          ),
        );

        if (record.openCount <= 0) {
          if (record.sentAt.getTime() > threeDaysAgo.getTime()) {
            return [];
          }

          const daysSinceSend = buildElapsedDayCount(record.sentAt, now, 3);

          return [
            {
              id: `leadership-engagement-${record.id}`,
              kindKey: "engagement_risk",
              kindLabel: "Send-trail risk",
              title: record.client.fullName,
              description: [
                listingLabel,
                stageLabel,
                appointmentLabel,
                `${daysSinceSend} day(s) since send with no tracked open.`,
              ]
                .filter(Boolean)
                .join(" · "),
              contextLabel: ownerLabel,
              ownerLabel,
              scopeLabel: leadershipScope.scopeLabel,
              pressureLabel: "Unopened 3+ days",
              whyNowLabel:
                "A tracked send inside this leadership scope is still unopened after the initial wait window.",
              nextStepLabel:
                "Open the contact and decide whether the send needs rescue.",
              tone: "danger",
              actionLabel: "Open office contact",
              href: `/office/contacts/${record.client.id}`,
              _priority: 0,
              _sortAt: record.sentAt,
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
            id: `leadership-engagement-${record.id}`,
            kindKey: "engagement_risk",
            kindLabel: "Send-trail risk",
            title: record.client.fullName,
            description: [
              listingLabel,
              stageLabel,
              appointmentLabel,
              `${quietDays} day(s) since the last tracked open.`,
            ]
              .filter(Boolean)
              .join(" · "),
            contextLabel: ownerLabel,
            ownerLabel,
            scopeLabel: leadershipScope.scopeLabel,
            pressureLabel: "Quiet after last open",
            whyNowLabel:
              "The last tracked open inside this leadership scope has gone quiet long enough to warrant a leadership rescue pass.",
            nextStepLabel: "Open the contact and choose the next rescue touch.",
            tone: "warning",
            actionLabel: "Open office contact",
            href: `/office/contacts/${record.client.id}`,
            _priority: 1,
            _sortAt: lastEngagementAt,
          },
        ];
      })
      .sort(
        (left, right) =>
          left._priority - right._priority ||
          left._sortAt.getTime() - right._sortAt.getTime(),
      );
  const leadershipEngagementRiskCount = leadershipEngagementItems.length;
  const leadershipOverdueTaskItems: FrontOfficeDashboardLeadershipItem[] =
    leadershipOverdueTasks.map((task) => {
      const dueAt = task.dueAt ?? now;
      const overdueDays = buildElapsedDayCount(dueAt, now, 1);

      return {
        id: `leadership-task-${task.id}`,
        kindKey: "overdue_task" as const,
        kindLabel: "Overdue task",
        title: task.client?.fullName ?? task.title,
        description: `${task.title} · Due ${formatDateLabel(dueAt)}`,
        contextLabel: buildMembershipUserLabel(
          task.assigneeMembership?.user,
          "Assigned team member",
        ),
        ownerLabel: buildMembershipUserLabel(
          task.assigneeMembership?.user,
          "Assigned team member",
        ),
        scopeLabel: leadershipScope.scopeLabel,
        pressureLabel:
          overdueDays >= 3 ? `${overdueDays} day(s) overdue` : "Task overdue",
        whyNowLabel:
          overdueDays >= 3
            ? `This shared follow-up has been overdue for ${overdueDays} day(s) inside the visible leadership scope and needs an operator-level recovery pass.`
            : "A shared follow-up inside this leadership scope is already overdue and needs an operator-level follow-through.",
        nextStepLabel: "Open the task and follow up with the assignee.",
        tone: "danger" as const,
        actionLabel: "Open office contact",
        href: task.clientId
          ? `/office/contacts/${task.clientId}`
          : "/office/contacts",
      };
    });
  const leadershipEngagementWorkbenchItems: FrontOfficeDashboardLeadershipItem[] =
    leadershipEngagementItems.map(({ _priority, _sortAt, ...item }) => ({
      ...item,
      kindKey: "engagement_risk" as const,
      kindLabel: "Send-trail risk",
    }));
  const leadershipStaleClientItems: FrontOfficeDashboardLeadershipItem[] =
    filteredLeadershipStaleClients.map((client) => {
      const inactiveDays = Math.max(
        15,
        buildElapsedDayCount(client.lastContactAt ?? client.createdAt, now, 15),
      );

      return {
        id: `leadership-client-${client.id}`,
        kindKey: "stale_client" as const,
        kindLabel: "Stale client",
        title: client.fullName,
        description: `${client.stage} · ${inactiveDays} day(s) since the last recorded touch.`,
        contextLabel: buildMembershipUserLabel(
          client.ownerMembership?.user,
          "Assigned owner",
        ),
        ownerLabel: buildMembershipUserLabel(
          client.ownerMembership?.user,
          "Assigned owner",
        ),
        scopeLabel: leadershipScope.scopeLabel,
        pressureLabel: inactiveDays >= 30 ? "30+ days stale" : "15+ days stale",
        whyNowLabel: `No logged touch has landed on this visible-scope dossier for ${inactiveDays} day(s).`,
        nextStepLabel: "Open the contact and choose the next touch.",
        tone: "warning" as const,
        actionLabel: "Open office contact",
        href: `/office/contacts/${client.id}`,
      };
    });
  const leadershipWorkbenchItems: FrontOfficeDashboardLeadershipItem[] = [
    ...leadershipOverdueTaskItems.slice(
      0,
      frontOfficeDashboardLeadershipWorkbenchPerKind,
    ),
    ...leadershipEngagementWorkbenchItems.slice(
      0,
      frontOfficeDashboardLeadershipWorkbenchPerKind,
    ),
    ...leadershipStaleClientItems.slice(
      0,
      frontOfficeDashboardLeadershipWorkbenchPerKind,
    ),
  ];
  const leadershipItems: FrontOfficeDashboardLeadershipItem[] = [
    ...leadershipOverdueTaskItems.slice(
      0,
      frontOfficeDashboardLeadershipPreviewPerKind,
    ),
    ...leadershipEngagementWorkbenchItems.slice(
      0,
      frontOfficeDashboardLeadershipPreviewPerKind,
    ),
    ...leadershipStaleClientItems.slice(
      0,
      frontOfficeDashboardLeadershipPreviewPerKind,
    ),
  ].slice(0, frontOfficeDashboardLeadershipPreviewTotal);
  const leadershipCounts = buildFrontOfficeDashboardLeadershipKindCountRecord();
  leadershipCounts.overdue_task = leadershipOverdueTaskCount;
  leadershipCounts.engagement_risk = leadershipEngagementRiskCount;
  leadershipCounts.stale_client = leadershipStaleClientCount;
  const leadershipTotalSignalCount =
    leadershipCounts.overdue_task +
    leadershipCounts.engagement_risk +
    leadershipCounts.stale_client;
  const leadershipFilters: FrontOfficeDashboardLeadershipFilterContract = {
    defaultValue: "all",
    paramKey: "teamCleanupFilter",
    options: frontOfficeDashboardLeadershipFilterKeys.map((value) => ({
      value,
      label: frontOfficeDashboardLeadershipFilterLabels[value],
      count:
        value === "all" ? leadershipTotalSignalCount : leadershipCounts[value],
    })),
  };
  const aiStrategyRules: FrontOfficeAiStrategyRule[] = [];
  const aiQueueCandidates = rankFrontOfficeAiQueueHistoryCandidates({
    candidates:
      aiSuggestionCandidates.flatMap<FrontOfficeDashboardAiCandidateItem>(
        (client) => {
          const leaseReminder = buildLeaseReminderStatus({
            leaseEndDate: client.leaseEndDate,
            leaseReminderAt: client.leaseReminderAt,
            now,
          });
          const nextTouchLabel = formatNextTouchLabel({
            nextFollowUpAt: client.nextFollowUpAt,
            leaseReminderAt: client.leaseReminderAt,
            now,
          });
          const latestAppointment = client.appointments[0] ?? null;
          const latestSendRecord = client.frontOfficeSendRecords[0] ?? null;
          const linkedTransaction =
            client.transactionContacts[0]?.transaction ?? null;
          const closingReferenceDate =
            linkedTransaction?.moveInDate ??
            linkedTransaction?.closingDate ??
            linkedTransaction?.acceptanceDate ??
            null;
          const hasClosedTransaction =
            linkedTransaction?.status === TransactionStatus.closed;
          const hasCancelledTransaction =
            linkedTransaction?.status === TransactionStatus.cancelled;
          const isClosingSoon = Boolean(
            !hasClosedTransaction &&
            !hasCancelledTransaction &&
            closingReferenceDate &&
            closingReferenceDate.getTime() >= startOfToday.getTime() &&
            closingReferenceDate.getTime() <= fourteenDaysFromNow.getTime(),
          );
          const isReadyForBackOffice = isFrontOfficeStageReadyForBackOffice(
            client.stage,
          );
          const openDossierHref = `/agent/clients/${client.id}#front-office-ai-suggestions`;
          const aiBoundaryState = {
            hasLinkedTransaction: Boolean(linkedTransaction),
            isReadyForBackOffice,
            hasClosedTransaction,
            hasCancelledTransaction,
          };
          const strategyContract = buildFrontOfficeAiStrategyContract({
            clientId: client.id,
            clientName: client.fullName,
            now,
            timeZone: input.timeZone,
            stage: client.stage,
            nextFollowUpAt: client.nextFollowUpAt,
            lastContactAt: client.lastContactAt,
            leaseReminderAt: leaseReminder.reminderAt,
            leaseReminderNeedsAttention:
              leaseReminder.statusLabel === "Overdue" ||
              leaseReminder.statusLabel === "Due today" ||
              leaseReminder.statusLabel === "Due soon",
            openTaskCount: 0,
            sendCount: client.frontOfficeSendRecords.length,
            openedSendCount: client.frontOfficeSendRecords.filter(
              (record) => record.openCount > 0,
            ).length,
            latestSendRecordSentAt: latestSendRecord?.sentAt ?? null,
            latestSendRecordLastOpenedAt: latestSendRecord?.lastOpenedAt ?? null,
            hasClosedTransaction,
            hasCancelledTransaction,
            hasLinkedTransaction: Boolean(linkedTransaction),
            isReadyForBackOffice,
            isClosingSoon,
            closingKeyDateLabel: closingReferenceDate
              ? formatDateLabel(closingReferenceDate)
              : null,
          });
          aiStrategyRules.push(...strategyContract.rules);

          if (hasCancelledTransaction) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "reentry",
              now,
              clientFullName: client.fullName,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger: "Formal deal outcome · cancelled or lost",
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail:
                "Use a respectful re-entry touch instead of restarting formal workflow.",
            });

            return [
              {
                id: `ai-${client.id}-reentry`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "reentry",
                statusLabel: "Re-entry",
                tone: "warning",
                description:
                  "The formal deal did not close, so the next-touch should reopen the relationship without forcing urgency.",
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("reentry"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("reentry"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel("reentry"),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel: "Grounded by cancelled / lost transaction outcome",
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: 0,
                sortAt: linkedTransaction?.acceptanceDate ?? client.createdAt,
              },
            ];
          }

          if (hasClosedTransaction) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "postclose",
              now,
              clientFullName: client.fullName,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger: closingReferenceDate
                ? `Closed milestone · ${formatDateLabel(closingReferenceDate)}`
                : "Formal deal outcome · closed",
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail:
                "Keep the relationship warm while the formal record stays in Back Office.",
            });

            return [
              {
                id: `ai-${client.id}-postclose`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "postclose",
                statusLabel: "Post-close",
                tone: "success",
                description: closingReferenceDate
                  ? `The shared transaction is already closed around ${formatDateLabel(closingReferenceDate)}. Keep the relationship warm while the win is still fresh.`
                  : "The shared transaction is already closed. Keep the relationship warm while the win is still fresh.",
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("postclose"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("postclose"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel("postclose"),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel: closingReferenceDate
                  ? `Milestone · ${formatDateLabel(closingReferenceDate)}`
                  : "Grounded by closed transaction outcome",
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: 1,
                sortAt: closingReferenceDate ?? client.createdAt,
              },
            ];
          }

          if (isClosingSoon && closingReferenceDate) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "closing",
              now,
              clientFullName: client.fullName,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger: linkedTransaction?.moveInDate
                ? "Move-in window is approaching"
                : linkedTransaction?.closingDate
                  ? "Closing date is approaching"
                  : "Accepted file needs a wrap-up plan",
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail: `Shared milestone · ${formatDateLabel(
                closingReferenceDate,
              )}`,
            });

            return [
              {
                id: `ai-${client.id}-closing`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "closing",
                statusLabel: "Closing support",
                tone: "warning",
                description: `A formal deal milestone is close: ${formatDateLabel(
                  closingReferenceDate,
                )}. Use the next touch to steady logistics and wrap-up timing.`,
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("closing"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("closing"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel("closing"),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel: linkedTransaction?.moveInDate
                  ? "Move-in window is approaching"
                  : linkedTransaction?.closingDate
                    ? "Closing date is approaching"
                    : "Accepted file needs a wrap-up plan",
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: 2,
                sortAt: closingReferenceDate,
              },
            ];
          }

          if (
            leaseReminder.statusLabel === "Overdue" ||
            leaseReminder.statusLabel === "Due today" ||
            leaseReminder.statusLabel === "Due soon"
          ) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "lease",
              now:
                leaseReminder.statusLabel === "Due soon"
                  ? new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
                  : now,
              clientFullName: client.fullName,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger: `Lease reminder · ${leaseReminder.statusLabel}`,
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail: leaseReminder.detailLabel,
            });

            return [
              {
                id: `ai-${client.id}-lease`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "lease",
                statusLabel: "Lease timing",
                tone: leaseReminder.tone,
                description:
                  "Lease timing is already visible on this record, so the next-touch should lock renewal, move, or remarketing intent before the window slips.",
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("lease"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("lease"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel("lease"),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel: `${leaseReminder.statusLabel} · ${leaseReminder.detailLabel}`,
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: leaseReminder.statusLabel === "Overdue" ? 3 : 4,
                sortAt: leaseReminder.reminderAt ?? client.createdAt,
              },
            ];
          }

          if (latestAppointment) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "appointment",
              now,
              clientFullName: client.fullName,
              appointmentTitle: latestAppointment.title,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger: `Appointment · ${latestAppointment.title}`,
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail: `Starts ${formatDateTimeLabel(
                latestAppointment.startsAt,
                { timeZone: input.timeZone ?? null },
              )}`,
            });

            return [
              {
                id: `ai-${client.id}-appointment`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "appointment",
                statusLabel: "Appointment prep",
                tone: "accent",
                description: `There is already a scheduled ${formatAppointmentTypeLabel(
                  latestAppointment.type,
                ).toLowerCase()} on the calendar, so the next-touch should sharpen expectations before the meeting and save the writeback checkpoint.`,
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("appointment"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("appointment"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel(
                    "appointment",
                  ),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel: `${latestAppointment.title} · ${formatDateTimeLabel(
                  latestAppointment.startsAt,
                  { timeZone: input.timeZone ?? null },
                )} · Calendar writeback first, then dossier follow-up.`,
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                primaryActionLabel: "Open calendar writeback",
                primaryActionHref: `/agent/calendar?clientId=${client.id}`,
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: 5,
                sortAt: latestAppointment.startsAt,
              },
            ];
          }

          if (
            latestSendRecord &&
            latestSendRecord.openCount <= 0 &&
            latestSendRecord.sentAt.getTime() <= threeDaysAgo.getTime()
          ) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "content_rescue",
              now,
              clientFullName: client.fullName,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger: latestSendRecord.listing?.title?.trim()
                ? `Tracked send · no open on ${latestSendRecord.listing.title.trim()}`
                : "Tracked send · no open yet",
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail: `Sent ${formatDateTimeLabel(
                latestSendRecord.sentAt,
                { timeZone: input.timeZone ?? null },
              )}`,
            });

            return [
              {
                id: `ai-${client.id}-unopened-send`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "content_rescue",
                statusLabel: "Content follow-up",
                tone: "warning",
                description:
                  "Material was sent but there is still no tracked open, so the safest next-touch is to reduce friction and offer a smaller next step from the dossier.",
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("content_rescue"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("content_rescue"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel(
                    "content_rescue",
                  ),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel: latestSendRecord.listing?.title?.trim()
                  ? `No open on ${latestSendRecord.listing.title.trim()} · open the dossier before retrying.`
                  : "Tracked send has no open yet · reopen the dossier before retrying.",
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                primaryActionLabel: "Open dossier and rescue thread",
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: 6,
                sortAt: latestSendRecord.sentAt,
              },
            ];
          }

          if (
            latestSendRecord &&
            latestSendRecord.openCount > 0 &&
            (
              latestSendRecord.lastOpenedAt ?? latestSendRecord.sentAt
            ).getTime() >= sevenDaysAgo.getTime()
          ) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "warm_engagement",
              now,
              clientFullName: client.fullName,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger: latestSendRecord.lastOpenedAt
                ? `Tracked engagement · last open ${formatDateTimeLabel(
                    latestSendRecord.lastOpenedAt,
                    { timeZone: input.timeZone ?? null },
                  )}`
                : `Tracked engagement · opened ${latestSendRecord.openCount} time(s)`,
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail: latestSendRecord.listing?.title?.trim()
                ? `Listing · ${latestSendRecord.listing.title.trim()}`
                : null,
            });

            return [
              {
                id: `ai-${client.id}-warm-send`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "warm_engagement",
                statusLabel: "Warm engagement",
                tone: latestSendRecord.openCount > 1 ? "success" : "accent",
                description:
                  "Tracked content already shows live interest, so the next-touch should turn that signal into a shortlist, feedback, or booked step.",
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("warm_engagement"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("warm_engagement"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel(
                    "warm_engagement",
                  ),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel: latestSendRecord.lastOpenedAt
                  ? `Last open · ${formatDateTimeLabel(
                      latestSendRecord.lastOpenedAt,
                      { timeZone: input.timeZone ?? null },
                    )} · open the dossier and turn the warm signal into a next step.`
                  : `Opened ${latestSendRecord.openCount} time(s) · open the dossier and turn the warm signal into a next step.`,
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                primaryActionLabel: "Open dossier and turn warm signal",
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: 7,
                sortAt:
                  latestSendRecord.lastOpenedAt ?? latestSendRecord.sentAt,
              },
            ];
          }

          if (isReadyForBackOffice && !linkedTransaction) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "handoff",
              now,
              clientFullName: client.fullName,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger:
                "Execution boundary · Front Office is ready for formal workflow",
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail:
                client.handoffDrafts[0]?.summary?.trim() ||
                "Acre should align package and timing before creating the Back Office file.",
            });

            return [
              {
                id: `ai-${client.id}-handoff`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "handoff",
                statusLabel: "Formal handoff",
                tone: "warning",
                description:
                  "This record is BO-ready, but the formal file is not live yet, so the next-touch should confirm package, timing, and expectations before handoff.",
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("handoff"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("handoff"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel("handoff"),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel:
                  client.handoffDrafts[0]?.summary?.trim() ||
                  "Front Office stage is ready for formal workflow. Confirm the package before opening Back Office.",
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                primaryActionLabel: "Open Back Office create flow",
                primaryActionHref: client.handoffDrafts[0]
                  ? buildFrontOfficeHandoffCreateHref(
                      client.handoffDrafts[0].id,
                    )
                  : "/office/transactions/new",
                defaultAllowsDirectFollowUpCreation: false,
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: 8,
                sortAt: client.createdAt,
              },
            ];
          }

          if (!isClosedClientStage(client.stage) && !client.nextFollowUpAt) {
            const followUp = buildFrontOfficeAiFollowUpAction({
              kind: "generic",
              now,
              clientFullName: client.fullName,
            });
            const whyNowSignals = buildAiQueueWhyNowSignals({
              trigger: `Stage · ${client.stage}`,
              contextLabel: `Current touch window · ${nextTouchLabel}`,
              supportingDetail:
                "No future touch is currently scheduled on this active record.",
            });

            return [
              {
                id: `ai-${client.id}-generic`,
                clientId: client.id,
                clientName: client.fullName,
                suggestionKind: "generic",
                statusLabel: "Next touch",
                tone: "accent",
                description:
                  "This active client does not yet have a future touch on the books, so Acre should not leave the next move implicit.",
                contextLabel: nextTouchLabel,
                sequenceLabel:
                  buildFrontOfficeDashboardAiSequenceLabel("generic"),
                safeActionLabel:
                  buildFrontOfficeDashboardAiSafeActionLabel("generic"),
                sequenceContractLabel:
                  buildFrontOfficeDashboardAiSequenceContractLabel("generic"),
                whyNowLabel:
                  buildFrontOfficeDashboardAiWhyNowLabel(whyNowSignals),
                helperLabel: `Stage · ${client.stage} · open the dossier and choose the next grounded touch.`,
                whyNowSignals,
                openDossierHref,
                ...aiBoundaryState,
                primaryActionLabel: "Open dossier and choose next touch",
                followUpTitle: followUp.title,
                followUpDueAt: followUp.dueAt,
                basePriority: 9,
                sortAt: client.createdAt,
              },
            ];
          }

          return [];
        },
      ),
    historyIndex: aiHistoryIndex,
  });
  const aiQueueItems = aiQueueCandidates
    .slice(0, 4)
    .map(
      ({
        priority,
        directFollowUpState,
        primaryActionReasonOverride,
        oneClickReasonOverride,
        hasLinkedTransaction,
        isReadyForBackOffice,
        hasClosedTransaction,
        hasCancelledTransaction,
        ...item
      }) => {
        const boundaryContract = buildFrontOfficeAiBoundaryContract({
          suggestionKind: item.suggestionKind,
          hasLinkedTransaction,
          isReadyForBackOffice,
          hasClosedTransaction,
          hasCancelledTransaction,
          directFollowUpState,
          primaryActionReasonOverride,
          oneClickReasonOverride,
        });

        return {
          ...item,
          boundaryLabel: boundaryContract.boundaryLabel,
          boundaryTone: boundaryContract.boundaryTone,
          boundaryDescription: boundaryContract.boundaryDescription,
          primaryActionReason: boundaryContract.primaryActionReason,
          oneClickReason: boundaryContract.oneClickReason,
        };
      },
    );
  const aiStrategy = {
    summaryLabel: aiStrategyRules.length
      ? `Rule layer · ${aiStrategyRules.length} review-first signal(s)`
      : "Rule layer · no active strategy signals",
    rules: aiStrategyRules
      .sort(
        (left, right) =>
          left.priority - right.priority ||
        left.clientName.localeCompare(right.clientName) ||
        left.title.localeCompare(right.title),
      )
      .slice(0, 4),
    playbook: buildFrontOfficeAiStrategyPlaybookContract(
      aiStrategyRules
        .slice()
        .sort(
          (left, right) =>
            left.priority - right.priority ||
            left.clientName.localeCompare(right.clientName) ||
            left.title.localeCompare(right.title),
        )
        .slice(0, 4),
    ),
  } satisfies FrontOfficeAiStrategyContract;
  const aiSuggestionCount = aiQueueCandidates.length;
  const aiAcceptedActionBreakdown = buildFrontOfficeAiAcceptedActionBreakdown({
    historyIndex: aiHistoryIndex,
    limit: 3,
  }).map((item) => ({
    label: item.label,
    summary: item.summary,
  }));
  const aiAcceptedActionWindows =
    buildFrontOfficeAiAcceptedActionBreakdownWindows({
      actions: aiLearningActions,
      now,
      limit: 3,
      windows: [7, 90],
    }).map((window) => ({
      label: window.label,
      summary: window.summary,
      items: window.items.map((item) => ({
        label: item.label,
        summary: item.summary,
      })),
    }));
  const aiAcceptedActionItems = recentAiAcceptedActionItems.map((action) => {
    const outcome = mapFrontOfficeAiAcceptedActionOutcome({
      actionType: action.actionType,
      followUpTask: action.followUpTask,
      sendRecord: action.sendRecord,
      now,
      timeZone: input.timeZone,
    });

    return {
      id: action.id,
      clientId: action.client.id,
      clientName: action.client.fullName,
      title:
        action.actionTitle.trim() ||
        formatFrontOfficeAiActionTypeLabel(action.actionType),
      statusLabel: outcome.label,
      statusTone: outcome.tone,
      description: outcome.detail,
      contextLabel: `${action.suggestionLabel} · ${formatFrontOfficeAiSourceSurfaceLabel(action.sourceSurface)}`,
      helperLabel: [
        "Agent-approved",
        formatFrontOfficeAiActionTypeLabel(action.actionType),
        action.channel ? `Channel · ${action.channel.toUpperCase()}` : null,
        action.listing?.title?.trim()
          ? `Listing · ${action.listing.title.trim()}`
          : null,
        `Accepted ${formatDateTimeLabel(action.createdAt, {
          timeZone: input.timeZone ?? null,
        })}`,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/agent/clients/${action.client.id}#front-office-ai-outcomes`,
      actionLabel: "Open AI history",
    } satisfies FrontOfficeDashboardAiAcceptedActionItem;
  });
  const todayEventCount = upcomingEvents.filter(
    (event) =>
      event.startsAt >= startOfToday && event.startsAt < startOfTomorrow,
  ).length;
  const todayAppointmentCount = upcomingAppointments.filter(
    (appointment) =>
      appointment.startsAt >= startOfToday &&
      appointment.startsAt < startOfTomorrow,
  ).length;
  const todayCommitmentCount = todayEventCount + todayAppointmentCount;
  const commitmentEntries = [
    ...upcomingAppointments.map((appointment) => ({
      sortAt: appointment.startsAt,
      item: (() => {
        const externalWorkflow = getFrontOfficeAppointmentExternalWorkflowState(
          {
            metadata: appointment.metadata,
            timeZone: input.timeZone ?? null,
          },
        );
        const calendarView = resolveDashboardAppointmentCalendarView({
          externalStatusValue: externalWorkflow.value,
          nextActionAt: externalWorkflow.nextActionAt,
          isExternalTouchDue: Boolean(
            externalWorkflow.nextActionAt &&
            externalWorkflow.nextActionAt.getTime() <= now.getTime(),
          ),
        });
        const routeLabel =
          formatDashboardAppointmentCalendarViewLabel(calendarView);
        const actionLabel =
          formatDashboardAppointmentCalendarActionLabel(calendarView);
        const baseHref = appointment.client?.id
          ? `/agent/calendar?clientId=${appointment.client.id}&appointmentId=${appointment.id}`
          : `/agent/calendar?appointmentId=${appointment.id}`;

        return {
          id: `appointment-${appointment.id}`,
          title: appointment.title,
          badgeLabel: formatAppointmentTypeLabel(appointment.type),
          badgeTone: mapAppointmentTypeTone(appointment.type),
          startsAtLabel: formatDateTimeLabel(appointment.startsAt, {
            timeZone: input.timeZone,
          }),
          locationLabel:
            appointment.location?.trim() ||
            appointment.meetingUrl?.trim() ||
            "Location pending",
          contextLabel: appointment.client?.fullName
            ? `${appointment.client.fullName} · ${routeLabel}`
            : appointment.listing?.title
              ? `${appointment.listing.title} · ${routeLabel}`
              : routeLabel,
          actionLabel,
          href: calendarView
            ? `${baseHref}&calendarView=${calendarView}`
            : baseHref,
        };
      })(),
    })),
    ...upcomingEvents.map((event) => ({
      sortAt: event.startsAt,
      item: {
        id: `event-${event.id}`,
        title: event.title,
        badgeLabel: "Office event",
        badgeTone: "neutral" as const,
        startsAtLabel: formatDateTimeLabel(event.startsAt, {
          timeZone: input.timeZone,
        }),
        locationLabel:
          event.location?.trim() ||
          event.meetingUrl?.trim() ||
          "Location pending",
        contextLabel:
          event.rsvps[0]?.status === "going"
            ? "You RSVP'd going"
            : event.rsvps[0]?.status === "maybe"
              ? "You RSVP'd maybe"
              : event.rsvps[0]?.status === "declined"
                ? "You declined"
                : `${formatEventVisibilityLabel(event.visibility)} · ${event._count.rsvps} RSVP(s)`,
        actionLabel: "Open Event Hub",
        href: `/agent/calendar?calendarView=month&focusDate=${encodeURIComponent(
          event.startsAt.toISOString().slice(0, 10),
        )}&eventId=${encodeURIComponent(event.id)}`,
      },
    })),
  ]
    .sort((left, right) => left.sortAt.getTime() - right.sortAt.getTime())
    .slice(0, 4);
  const commitmentItems = commitmentEntries.map((entry) => entry.item);
  const backOfficeItems: FrontOfficeDashboardBackOfficeItem[] = [
    ...handoffDrafts.map((draft) => ({
      id: `handoff-client-${draft.id}`,
      title: draft.client.fullName,
      description:
        draft.summary?.trim() ||
        `${draft.stageLabel} is ready to become a formal transaction record.`,
      contextLabel: "Create transaction",
      tone: "warning" as const,
      actionLabel: "Open Back Office create flow",
      href: buildFrontOfficeHandoffCreateHref(draft.id),
    })),
    ...signatureTransactions.map((transaction) => ({
      id: `handoff-signature-${transaction.id}`,
      title: transaction.title,
      description: `${transaction.address} still has signature work in progress.`,
      contextLabel: transaction.signatureRequests[0]?.recipientRole
        ? `Signature · ${transaction.signatureRequests[0].recipientRole}`
        : "Signature follow-through",
      tone: "accent" as const,
      actionLabel: "Open forms & signatures",
      href: `/office/transactions/${transaction.id}#transaction-forms-signatures`,
    })),
  ].slice(0, 4);
  const needsBackOfficeCount = handoffDraftCount + signatureTransactions.length;
  const leadershipPressureCount =
    leadershipOverdueTaskCount +
    leadershipStaleClientCount +
    leadershipEngagementRiskCount;
  const leadingFollowUpClient = dueFollowUpClients[0] ?? null;
  const followUpPressureCount = Math.max(
    dueFollowUpCount,
    overdueFollowUpTaskCount,
  );
  const followUpAction =
    followUpPressureCount === 1 && leadingFollowUpClient
      ? {
          href: buildClientWorkbenchHref("anchor_now"),
          actionLabel: "Anchor now",
        }
      : {
          href: buildClientWorkbenchHref("follow_first"),
          actionLabel: "Open follow-first queue",
        };
  const leadingCommitmentItem = commitmentItems[0] ?? null;
  const leadingLeaseReminderItem = leaseReminderItems[0] ?? null;
  const leadingSendRecord = recentSendRecords[0] ?? null;
  const leadingBackOfficeItem = backOfficeItems[0] ?? null;
  const leadingLeadershipItem = leadershipWorkbenchItems[0] ?? null;
  const leadershipNotificationsHref = leadingLeadershipItem
    ? `/agent/notifications?activityView=team_cleanup&teamCleanupFilter=${leadingLeadershipItem.kindKey}#team-cleanup-pressure`
    : "/agent/notifications?activityView=team_cleanup#team-cleanup-pressure";
  const sendSignalCount =
    recentSendRecords.length > 0
      ? recentSendRecords.length
      : activeListingCount;
  const leadingSendListingLabel =
    leadingSendRecord?.listing?.title?.trim() || "tracked send trail";
  const sendSignalTone: FrontOfficeDashboardTone = leadingSendRecord
    ? leadingSendRecord.openCount <= 0 &&
      leadingSendRecord.sentAt.getTime() <= threeDaysAgo.getTime()
      ? "warning"
      : leadingSendRecord.openCount > 1
        ? "success"
        : "accent"
    : activeListingCount > 0
      ? "success"
      : "neutral";
  const sendSignalDescription = leadingSendRecord
    ? leadingSendRecord.openCount <= 0 &&
      leadingSendRecord.sentAt.getTime() <= threeDaysAgo.getTime()
      ? `${leadingSendRecord.client.fullName} still has no tracked open on ${leadingSendListingLabel}. Rescue this thread before you add fresh noise.`
      : leadingSendRecord.openCount > 0
        ? `${leadingSendRecord.client.fullName} already engaged with ${leadingSendListingLabel}. Turn that signal into a real next step while it is still warm.`
        : `${leadingSendRecord.client.fullName} already has tracked send history in motion. Keep the next send and follow-through explicit.`
    : activeListingCount > 0
      ? `${activeListingCount} active or hot listing(s) are ready for tracked outreach. Start a send only when the target client and channel are clear.`
      : "No active listing inventory is currently available in this scope.";
  const sendSignalHelper = leadingSendRecord
    ? [
        `${formatFrontOfficeSendChannelLabel(leadingSendRecord.channel)} · ${formatDateTimeLabel(
          leadingSendRecord.sentAt,
          { timeZone: input.timeZone ?? null },
        )}`,
        buildFrontOfficeSendEngagementLabel(leadingSendRecord.openCount),
        "Acre records the trail only after you choose to send.",
      ].join(" · ")
    : shareAggregate._count._all > 0
      ? `${shareAggregate._count._all} tracked link(s) already exist in this scope. Acre still does not auto-send anything.`
      : "Tracked sending is ready as soon as you create the first share link.";
  const actionQueueBase: FrontOfficeDashboardActionQueueItem[] = [
    {
      id: "follow-up",
      label: "Follow-up pressure",
      count: followUpPressureCount,
      tone: followUpPressureCount > 0 ? "warning" : "neutral",
      description:
        leadingFollowUpClient && dueFollowUpCount > 0
          ? `${leadingFollowUpClient.fullName} is the clearest next touch. ${dueFollowUpCount} client touch(es) are due today or already late, so start in the shared clock and then reopen the dossier.`
          : overdueFollowUpTaskCount > 0
            ? `${overdueFollowUpTaskCount} shared follow-up task(s) are already overdue even though no fresh client touch is due today.`
            : "No same-day client touch or overdue shared follow-up task is waiting right now.",
      helper:
        overdueFollowUpTaskCount > 0
          ? `${overdueFollowUpTaskCount} task(s) are already overdue, with ${openFollowUpTaskCount} still open in total. Start there, then anchor the top dossier.`
          : `${openFollowUpTaskCount} scheduled follow-up task(s) remain open in the shared Front Office clock. Use that clock to pick the next grounded dossier.`,
      sequenceLabel: buildFrontOfficeDashboardActionSequenceLabel("follow-up"),
      whyNowLabel:
        leadingFollowUpClient && dueFollowUpCount > 0
          ? `${leadingFollowUpClient.fullName} is due first, so the follow-first queue should be the next stop before you reopen the dossier.`
          : overdueFollowUpTaskCount > 0
            ? `${overdueFollowUpTaskCount} shared follow-up task(s) are already overdue.`
            : "The shared follow-up clock is clear for now.",
      nextStepLabel:
        followUpPressureCount === 1 && leadingFollowUpClient
          ? "Anchor now and work the top dossier."
          : "Open the follow-first queue, then anchor the next dossier.",
      href: followUpAction.href,
      actionLabel: followUpAction.actionLabel,
    },
    {
      id: "commitments",
      label: "Today commitments",
      count: todayCommitmentCount,
      tone: todayCommitmentCount > 0 ? "accent" : "neutral",
      description:
        leadingCommitmentItem && todayCommitmentCount > 0
          ? `${leadingCommitmentItem.title} is the next time-bound promise on your desk. Prep it before the start window slips, then save the follow-up checkpoint.`
          : commitmentItems.length > 0
            ? `No commitment lands today, but ${commitmentItems.length} appointment or office item(s) are already on deck.`
            : "No Front Office appointments or shared office commitments are currently scheduled.",
      helper: leadingCommitmentItem
        ? `${leadingCommitmentItem.startsAtLabel} · ${leadingCommitmentItem.contextLabel} · External calendar and email remain explicit bridge actions, not hidden sync.`
        : "The live FO calendar stays action-first. Google, Outlook, ICS, and email are still explicit jump-outs, not two-way sync.",
      sequenceLabel:
        buildFrontOfficeDashboardActionSequenceLabel("commitments"),
      whyNowLabel: leadingCommitmentItem
        ? leadingCommitmentItem.id.startsWith("event-")
          ? `${leadingCommitmentItem.title} is already on the office calendar.`
          : `${leadingCommitmentItem.title} is already on the calendar and should be prepped before the start window.`
        : "The nearest commitment is already visible on the calendar.",
      nextStepLabel: leadingCommitmentItem
        ? leadingCommitmentItem.id.startsWith("appointment-")
          ? "Open the appointment writeback and record the next touch."
          : leadingCommitmentItem.actionLabel
        : "Open the calendar and confirm prep.",
      href: leadingCommitmentItem?.href ?? "/agent/calendar",
      actionLabel: leadingCommitmentItem?.actionLabel ?? "Open calendar",
    },
    {
      id: "lease-reminders",
      label: "Lease timing",
      count: dueLeaseReminderCount,
      tone:
        overdueLeaseReminderCount > 0
          ? "danger"
          : dueLeaseReminderCount > 0
            ? "warning"
            : "neutral",
      description: leadingLeaseReminderItem
        ? `${leadingLeaseReminderItem.clientName} is already inside a renewal or move-planning window. Keep the next touch explicit before the record goes quiet, then reopen the dossier with the timing lane in view.`
        : "No lease-date reminder is due soon right now.",
      helper:
        overdueLeaseReminderCount > 0
          ? `${overdueLeaseReminderCount} lease reminder(s) are already overdue. Use the lease lane to rescue the timing before it becomes a scramble.`
          : leadingLeaseReminderItem
            ? `${leadingLeaseReminderItem.statusLabel} · ${leadingLeaseReminderItem.detailLabel}`
            : "Lease timing stays visible here before renewal, remarketing, or move planning becomes a fire drill.",
      sequenceLabel:
        buildFrontOfficeDashboardActionSequenceLabel("lease-reminders"),
      whyNowLabel: leadingLeaseReminderItem
        ? `${leadingLeaseReminderItem.clientName} needs lease timing attention now.`
        : "No lease timing pressure is visible right now.",
      nextStepLabel: leadingLeaseReminderItem
        ? "Open the client dossier, confirm the next timing touch, and keep the lease lane explicit."
        : "Open the lease lane and sort the next reminder.",
      href:
        dueLeaseReminderCount === 1 && leadingLeaseReminderItem
          ? leadingLeaseReminderItem.href
          : buildClientWorkbenchHref("viewing_lane"),
      actionLabel:
        dueLeaseReminderCount === 1 && leadingLeaseReminderItem
          ? "Open client dossier"
          : "Open lease lane",
    },
    {
      id: "content",
      label: "Send-risk follow-through",
      count: sendSignalCount,
      tone: sendSignalTone,
      description: sendSignalDescription,
      helper: sendSignalHelper,
      sequenceLabel: buildFrontOfficeDashboardActionSequenceLabel("content"),
      whyNowLabel: leadingSendRecord
        ? `${leadingSendRecord.client.fullName} already has tracked send history waiting for the next touch. Open the dossier before sending again.`
        : "Tracked sending is ready once the target client and channel are clear.",
      nextStepLabel: leadingSendRecord
        ? "Open the client next-step rail and choose the next tracked send or reply."
        : "Open the send-risk workbench and start a tracked send.",
      href: leadingSendRecord
        ? `/agent/clients/${leadingSendRecord.client.id}#front-office-client-next-step-rail`
        : "/agent/listings?lane=draft-lane",
      actionLabel: leadingSendRecord
        ? "Open next-step rail"
        : "Open send-risk workbench",
    },
    {
      id: "handoff",
      label: "Formal handoff",
      count: needsBackOfficeCount,
      tone: needsBackOfficeCount > 0 ? "warning" : "neutral",
      description: leadingBackOfficeItem
        ? `${leadingBackOfficeItem.title} is the clearest FO -> BO boundary move right now. Confirm package, timing, and expectations before opening the formal workspace.`
        : "Nothing needs formal transaction, signature, or auditable Back Office workflow right now.",
      helper: leadingBackOfficeItem
        ? `${leadingBackOfficeItem.contextLabel} · ${leadingBackOfficeItem.description}`
        : "Front Office can tee up the work, but the official record still starts in Back Office.",
      sequenceLabel: buildFrontOfficeDashboardActionSequenceLabel("handoff"),
      whyNowLabel: leadingBackOfficeItem
        ? `${leadingBackOfficeItem.title} is ready for formal ownership outside Front Office.`
        : "No formal handoff is waiting right now.",
      nextStepLabel: leadingBackOfficeItem
        ? `Open Back Office and complete ${leadingBackOfficeItem.contextLabel.toLowerCase()}.`
        : "Review the formal handoff queue.",
      href: leadingBackOfficeItem?.href ?? "/office/transactions",
      actionLabel:
        leadingBackOfficeItem?.actionLabel ?? "Review formal handoff",
    },
  ];
  const actionQueue: FrontOfficeDashboardActionQueueItem[] =
    leadershipScope.visible
      ? [
          {
            id: "leadership",
            label:
              input.viewerRole === "team_lead"
                ? "Team cleanup"
                : "Office cleanup",
            count: leadershipPressureCount,
            tone: leadershipPressureCount > 0 ? "danger" : "neutral",
            description: leadingLeadershipItem
              ? `${leadingLeadershipItem.title} is the first rescue pass in this command deck. Review visible cleanup pressure in the Front Office command deck before it becomes a formal fire drill, then keep the rest of the rescue pass in the same lane.`
              : "No overdue task, stale-client, or send-trail pressure is visible in your leadership scope right now.",
            helper: leadingLeadershipItem
              ? `${leadingLeadershipItem.pressureLabel} · ${leadingLeadershipItem.contextLabel} · ${leadershipTotalSignalCount} visible signal(s) in scope. The next move is to keep the rescue pass in Front Office and work the command deck first.`
              : "Leadership cleanup stays visible in the FO activity center first, before anyone jumps into a formal record workspace.",
            sequenceLabel:
              buildFrontOfficeDashboardActionSequenceLabel("leadership"),
            whyNowLabel: leadingLeadershipItem
              ? leadingLeadershipItem.whyNowLabel
              : "Leadership cleanup is clear for now.",
            nextStepLabel: leadingLeadershipItem
              ? "Open the cleanup lane and continue the rescue pass."
              : "Open the cleanup lane and scan the next pressure point.",
            href: leadershipNotificationsHref,
            actionLabel:
              input.viewerRole === "team_lead"
                ? "Open team command deck"
                : "Open office command deck",
          },
          ...actionQueueBase,
        ]
      : actionQueueBase;

  return {
    summary: {
      todayActionCount:
        dueFollowUpCount +
        dueLeaseReminderCount +
        todayCommitmentCount +
        needsBackOfficeCount +
        leadershipPressureCount +
        aiSuggestionCount,
      followUpDueCount: dueFollowUpCount,
      leaseReminderCount: dueLeaseReminderCount,
      overdueTaskCount: overdueFollowUpTaskCount,
      staleClientCount,
      todayCommitmentCount,
      needsBackOfficeCount,
      leadershipPressureCount,
      aiSuggestionCount,
    },
    actionQueue,
    pipeline: {
      stageMetrics: stageGroups
        .sort(
          (left, right) =>
            right._count._all - left._count._all ||
            left.stage.localeCompare(right.stage),
        )
        .slice(0, 4)
        .map((stage) => ({
          label: stage.stage,
          count: stage._count._all,
          tone: mapClientStageTone(stage.stage),
        })),
      recentClients: recentClients.map((client) => ({
        id: client.id,
        fullName: client.fullName,
        stage: client.stage,
        stageTone: mapClientStageTone(client.stage),
        source: client.source,
        nextTouchLabel: formatNextTouchLabel({
          nextFollowUpAt: client.nextFollowUpAt,
          leaseReminderAt: client.leaseReminderAt,
          now,
        }),
        lastTouchLabel: client.lastContactAt
          ? `Last contact · ${formatDateLabel(client.lastContactAt)}`
          : "No contact logged yet",
        href: `/agent/clients/${client.id}`,
      })),
    },
    commitments: {
      items: commitmentItems,
      appointmentModuleReady: true,
      appointmentMessage:
        todayAppointmentCount > 0
          ? `${todayAppointmentCount} Front Office appointment(s) are on your calendar today. Open the appointment writeback from the commitment row when the next touch needs to be recorded, and keep shared office events visible so the workday does not fragment.`
          : "Front Office appointment scheduling is now live. Shared office events still stay visible here when the office publishes commitments.",
    },
    listingOutput: {
      activeListingCount,
      trackedLinkCount: shareAggregate._count._all,
      trackedClickCount: shareAggregate._sum.clickCount ?? 0,
      sendRecordCount,
      openedSendCount,
      engagedClientCount: engagedClientRows.length,
      trackedSendingReady: shareAggregate._count._all > 0,
      recentListings: recentListings.map((listing) => {
        const shareMetrics = listingShareMap.get(listing.id);

        return {
          id: listing.id,
          title: listing.title,
          neighborhoodLabel: `${listing.neighborhood}, ${listing.city}`,
          priceLabel: formatCurrency(listing.price),
          statusLabel: formatListingStatus(listing.status),
          statusTone: mapListingStatusTone(listing.status),
          trackedLinkCount: shareMetrics?.count ?? 0,
          trackedClickCount: shareMetrics?.clicks ?? 0,
          href: "/agent/listings?lane=draft-lane",
        };
      }),
      recentEngagement: recentSendRecords.map((record) => ({
        id: record.id,
        clientName: record.client.fullName,
        listingTitle:
          record.listing?.title?.trim() || "Front Office material send",
        channelLabel: formatFrontOfficeSendChannelLabel(record.channel),
        stageLabel: formatSendRecordStageLabel(record.clientStageLabel),
        appointmentLabel: buildSendRecordAppointmentLabel({
          title: record.appointmentTitle,
          startsAt: record.appointmentStartsAt,
          timeZone: input.timeZone,
        }),
        sentAtLabel: formatDateTimeLabel(record.sentAt, {
          timeZone: input.timeZone ?? null,
        }),
        engagementLabel: buildFrontOfficeSendEngagementLabel(record.openCount),
        engagementTone: mapFrontOfficeSendEngagementTone(record.openCount),
        detailLabel:
          record.lastOpenedAt && record.openCount > 0
            ? `Last opened · ${formatDateTimeLabel(record.lastOpenedAt, {
                timeZone: input.timeZone ?? null,
              })}`
            : "No open recorded yet",
        href: `/agent/clients/${record.client.id}`,
      })),
    },
    noticeRail: {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        typeLabel: formatNotificationType(notification.type),
        createdAtLabel: formatDateTimeLabel(notification.createdAt, {
          timeZone: input.timeZone,
        }),
        href: notification.actionUrl?.trim() || "/agent/notifications",
      })),
      resources: resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        typeLabel: formatResourceType(resource.type),
        summary: resource.summary,
        href: buildFrontOfficeDashboardResourceHref(
          resource.id,
          resource.type,
          resource.url,
        ),
      })),
      vendors: vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        headline: vendor.headline,
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
      resourcePulse,
    },
    leaseReminders: {
      dueCount: dueLeaseReminderCount,
      overdueCount: overdueLeaseReminderCount,
      items: leaseReminderItems,
    },
    aiQueue: {
      suggestionCount: aiSuggestionCount,
      items: aiQueueItems,
    },
    aiStrategy,
    aiAcceptedActions: {
      acceptedCount: aiAcceptedActionCount,
      positiveOutcomeCount: aiPositiveOutcomeCount,
      breakdown: aiAcceptedActionBreakdown,
      windows: aiAcceptedActionWindows,
      items: aiAcceptedActionItems,
    },
    backOffice: {
      items: backOfficeItems,
    },
    leadershipQueue: {
      visible: leadershipScope.visible,
      scopeLabel: leadershipScope.scopeLabel,
      scopeKey: leadershipScope.scopeKey,
      overdueTaskCount: leadershipOverdueTaskCount,
      staleClientCount: leadershipStaleClientCount,
      engagementRiskCount: leadershipEngagementRiskCount,
      counts: {
        surfacedCount: leadershipWorkbenchItems.length,
        totalSignalCount: leadershipTotalSignalCount,
        byKind: leadershipCounts,
      },
      filters: leadershipFilters,
      items: leadershipItems,
      activityCenterItems: leadershipWorkbenchItems,
    },
  };
}
