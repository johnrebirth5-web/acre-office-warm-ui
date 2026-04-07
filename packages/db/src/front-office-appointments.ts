import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  ListingStatus,
  Prisma,
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeInputValue, formatDateTimeLabel } from "./date-time";
import {
  buildFrontOfficeAppointmentCalendarExport,
  buildFrontOfficeAppointmentExternalLinks,
  buildFrontOfficeAppointmentExternalTargets,
  extractFrontOfficeAppointmentEmailRecipient,
  formatFrontOfficeAppointmentBridgeActionLabel,
  frontOfficeAppointmentBridgeActions,
  isFrontOfficeAppointmentBridgeAction,
  type FrontOfficeAppointmentBridgeAction,
  type FrontOfficeAppointmentCalendarExport,
} from "./front-office-calendar-links";
import { buildFrontOfficeHandoffCreateHref } from "./front-office-contracts";

export type FrontOfficeAppointmentTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type FrontOfficeAppointmentOption = {
  value: string;
  label: string;
};

export type FrontOfficeAppointmentRecord = {
  id: string;
  title: string;
  clientId: string | null;
  clientHref: string | null;
  typeValue: AppointmentType;
  statusValue: AppointmentStatus;
  startsAtValue: string;
  typeLabel: string;
  typeTone: FrontOfficeAppointmentTone;
  statusLabel: string;
  statusTone: FrontOfficeAppointmentTone;
  reminderLabel: string;
  reminderTone: FrontOfficeAppointmentTone;
  startsAtLabel: string;
  endsAtLabel: string;
  locationLabel: string;
  clientLabel: string;
  clientEmailLabel: string;
  contactLabel: string;
  listingLabel: string;
  notesLabel: string;
  meetingUrlLabel: string;
  listingOutputHref: string | null;
  googleCalendarHref: string;
  outlookCalendarHref: string;
  icsHref: string;
  emailBriefHref: string | null;
  externalStatusValue: FrontOfficeAppointmentExternalWorkflowStatus;
  externalStatusLabel: string;
  externalStatusTone: FrontOfficeAppointmentTone;
  externalStatusDetail: string;
  externalNote: string;
  externalNextActionAtLabel: string;
  externalNextActionAtValue: string;
  coordinationLabel: string;
  coordinationTone: FrontOfficeAppointmentTone;
  coordinationDetail: string;
  coordinationNextStep: string;
  requiresExternalResponse: boolean;
  isExternalTouchDue: boolean;
  needsNextTouchPlan: boolean;
  followUpPlanLabel: string;
  followUpPlanTone: FrontOfficeAppointmentTone;
  followUpPlanDetail: string;
  bridgeStatusLabel: string;
  bridgeStatusDetail: string;
  bridgeStatusTone: FrontOfficeAppointmentTone;
  bridgeActionLabel: string;
  bridgeLoggedAtLabel: string;
  hasBridgeActivity: boolean;
  hasWritebackHistory: boolean;
  latestCoordinationLabel: string;
  latestCoordinationDetail: string;
  touchPresets: FrontOfficeAppointmentTouchPreset[];
  coordinationHistory: FrontOfficeAppointmentCoordinationHistoryItem[];
  bridgeHistory: FrontOfficeAppointmentCoordinationHistoryItem[];
  writebackHistory: FrontOfficeAppointmentCoordinationHistoryItem[];
};

export type FrontOfficeAppointmentCoordinationHistoryItem = {
  id: string;
  kind: "bridge" | "writeback";
  label: string;
  detail: string;
  actorLabel: string;
  createdAtLabel: string;
  createdAtValue: string;
  tone: FrontOfficeAppointmentTone;
};

export type FrontOfficeAppointmentTouchPreset = {
  id: string;
  label: string;
  detail: string;
  suggestedStatus: FrontOfficeAppointmentExternalWorkflowStatus;
  nextActionAtLabel: string;
  nextActionAtValue: string;
};

export type FrontOfficeAppointmentHandoffItem = {
  id: string;
  clientName: string;
  stageLabel: string;
  summary: string;
  href: string;
};

export type FrontOfficeAppointmentsSnapshot = {
  summary: {
    upcomingCount: number;
    todayCount: number;
    showingCount: number;
    handoffReadyCount: number;
    awaitingReplyCount: number;
    confirmationPendingCount: number;
    rescheduleRequestedCount: number;
    touchDueCount: number;
    missingTouchPlanCount: number;
    bridgedCount: number;
  };
  filteredSummary: {
    appointmentCount: number;
    awaitingReplyCount: number;
    confirmationPendingCount: number;
    rescheduleRequestedCount: number;
    touchDueCount: number;
    missingTouchPlanCount: number;
    confirmedCount: number;
    bridgePendingCount: number;
  };
  typeOptions: FrontOfficeAppointmentOption[];
  clientOptions: FrontOfficeAppointmentOption[];
  listingOptions: FrontOfficeAppointmentOption[];
  appointments: FrontOfficeAppointmentRecord[];
  selectedAppointment: FrontOfficeAppointmentRecord | null;
  handoffs: FrontOfficeAppointmentHandoffItem[];
};

export type GetFrontOfficeAppointmentsSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
  clientId?: string | null;
  listingId?: string | null;
  type?: string | null;
  status?: string | null;
  coordination?: string | null;
  followUp?: string | null;
  targetAppointmentId?: string | null;
};

export type CreateFrontOfficeAppointmentInput = {
  organizationId: string;
  officeId?: string | null;
  ownerMembershipId: string;
  actorMembershipId?: string | null;
  title?: string | null;
  type?: string | null;
  clientId?: string | null;
  listingId?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  contactLabel?: string | null;
  notes?: string | null;
};

export type UpdateFrontOfficeAppointmentStatusInput = {
  organizationId: string;
  appointmentId: string;
  ownerMembershipId: string;
  actorMembershipId?: string | null;
  status?: string | null;
  externalStatus?: string | null;
  externalNote?: string | null;
  externalNextActionAt?: string | null;
  officeId?: string | null;
  timeZone?: string | null;
};

export type GetFrontOfficeAppointmentCalendarExportInput = {
  organizationId: string;
  appointmentId: string;
  ownerMembershipId: string;
  actorMembershipId?: string | null;
  officeId?: string | null;
  timeZone?: string | null;
};

export type GetFrontOfficeAppointmentBridgeResultInput = {
  organizationId: string;
  appointmentId: string;
  ownerMembershipId: string;
  actorMembershipId?: string | null;
  officeId?: string | null;
  timeZone?: string | null;
  action: FrontOfficeAppointmentBridgeAction;
};

export type FrontOfficeAppointmentBridgeResult =
  | {
      kind: "redirect";
      href: string;
    }
  | ({
      kind: "calendar_export";
    } & FrontOfficeAppointmentCalendarExport);

export type FrontOfficeAppointmentBridgeStatus = {
  label: string;
  detail: string;
  tone: FrontOfficeAppointmentTone;
  actionLabel: string;
  loggedAtLabel: string;
  hasBridgeActivity: boolean;
};

type FrontOfficeAppointmentCoordinationSummary = {
  label: string;
  tone: FrontOfficeAppointmentTone;
  detail: string;
  nextStep: string;
  requiresExternalResponse: boolean;
  isExternalTouchDue: boolean;
};

export const frontOfficeAppointmentExternalWorkflowStatuses = {
  idle: "idle",
  needsFollowUp: "needs_follow_up",
  confirmationPending: "confirmation_pending",
  confirmed: "confirmed",
  rescheduleRequested: "reschedule_requested",
} as const;

export type FrontOfficeAppointmentExternalWorkflowStatus =
  (typeof frontOfficeAppointmentExternalWorkflowStatuses)[keyof typeof frontOfficeAppointmentExternalWorkflowStatuses];

const frontOfficeAppointmentListStatusFilters = {
  all: "all",
  scheduled: AppointmentStatus.scheduled,
  completed: AppointmentStatus.completed,
  canceled: AppointmentStatus.canceled,
  noShow: AppointmentStatus.no_show,
} as const;

type FrontOfficeAppointmentListStatusFilter =
  (typeof frontOfficeAppointmentListStatusFilters)[keyof typeof frontOfficeAppointmentListStatusFilters];

const frontOfficeAppointmentCoordinationFilters = {
  all: "all",
  needsFollowUp: frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp,
  confirmationPending:
    frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending,
  confirmed: frontOfficeAppointmentExternalWorkflowStatuses.confirmed,
  rescheduleRequested:
    frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested,
  touchDue: "touch_due",
  bridgeLogged: "bridge_logged",
  writebackPending: "writeback_pending",
} as const;

type FrontOfficeAppointmentCoordinationFilter =
  (typeof frontOfficeAppointmentCoordinationFilters)[keyof typeof frontOfficeAppointmentCoordinationFilters];

const frontOfficeAppointmentFollowUpFilters = {
  all: "all",
  responseWaiting: "response_waiting",
  touchDue: "touch_due",
  nextTouchMissing: "next_touch_missing",
  touchScheduled: "touch_scheduled",
  confirmed: "confirmed",
} as const;

type FrontOfficeAppointmentFollowUpFilter =
  (typeof frontOfficeAppointmentFollowUpFilters)[keyof typeof frontOfficeAppointmentFollowUpFilters];

export type FrontOfficeAppointmentExternalWorkflowState = {
  value: FrontOfficeAppointmentExternalWorkflowStatus;
  label: string;
  tone: FrontOfficeAppointmentTone;
  detail: string;
  note: string | null;
  nextActionAt: Date | null;
  nextActionAtLabel: string;
  nextActionAtValue: string;
};

const frontOfficeAppointmentTypeDefinitions = [
  { value: AppointmentType.showing, label: "Showing" },
  { value: AppointmentType.consultation, label: "Consultation" },
  { value: AppointmentType.client_meeting, label: "Client meeting" },
  { value: AppointmentType.internal_meeting, label: "Internal meeting" },
  { value: AppointmentType.open_house, label: "Open house" },
  { value: AppointmentType.other, label: "Other" },
] as const;

const frontOfficeAppointmentStatusDefinitions = [
  { value: AppointmentStatus.scheduled, label: "Scheduled" },
  { value: AppointmentStatus.completed, label: "Completed" },
  { value: AppointmentStatus.canceled, label: "Canceled" },
  { value: AppointmentStatus.no_show, label: "No-show" },
] as const;

const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];
const openFrontOfficeHandoffStatuses: FrontOfficeHandoffStatus[] = [
  FrontOfficeHandoffStatus.draft,
  FrontOfficeHandoffStatus.ready,
] as const;

const appointmentSelect = Prisma.validator<Prisma.AppointmentSelect>()({
  id: true,
  title: true,
  type: true,
  status: true,
  startsAt: true,
  endsAt: true,
  location: true,
  meetingUrl: true,
  contactLabel: true,
  notes: true,
  metadata: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  listing: {
    select: {
      id: true,
      title: true,
      neighborhood: true,
      city: true,
    },
  },
});

const appointmentExternalWorkflowMetadataKey = "frontOfficeExternalWorkflow";

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function buildDedupedFrontOfficeAppointmentOptions(
  options: FrontOfficeAppointmentOption[],
) {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) {
      return false;
    }

    seen.add(option.value);
    return true;
  });
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function findAppointmentTypeDefinition(value: AppointmentType) {
  return frontOfficeAppointmentTypeDefinitions.find(
    (option) => option.value === value,
  );
}

function findAppointmentStatusDefinition(value: AppointmentStatus) {
  return frontOfficeAppointmentStatusDefinitions.find(
    (option) => option.value === value,
  );
}

function mapAppointmentTypeTone(
  type: AppointmentType,
): FrontOfficeAppointmentTone {
  switch (type) {
    case AppointmentType.showing:
      return "accent";
    case AppointmentType.consultation:
      return "success";
    case AppointmentType.client_meeting:
      return "warning";
    case AppointmentType.internal_meeting:
      return "neutral";
    case AppointmentType.open_house:
      return "accent";
    default:
      return "neutral";
  }
}

function mapAppointmentStatusTone(
  status: AppointmentStatus,
): FrontOfficeAppointmentTone {
  switch (status) {
    case AppointmentStatus.completed:
      return "success";
    case AppointmentStatus.no_show:
      return "warning";
    case AppointmentStatus.canceled:
      return "danger";
    default:
      return "accent";
  }
}

function buildAppointmentReminderState(input: {
  startsAt: Date;
  status: AppointmentStatus;
  now: Date;
}) {
  if (input.status !== AppointmentStatus.scheduled) {
    return {
      label: "Reminder cleared",
      tone: "neutral" as const,
    };
  }

  const twoHoursFromNow = new Date(input.now.getTime() + 2 * 60 * 60 * 1000);
  const startOfTomorrow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 1,
  );
  const startOfDayAfterTomorrow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 2,
  );

  if (input.startsAt.getTime() < input.now.getTime()) {
    return {
      label: "Start time passed",
      tone: "danger" as const,
    };
  }

  if (input.startsAt.getTime() <= twoHoursFromNow.getTime()) {
    return {
      label: "Starts within 2h",
      tone: "warning" as const,
    };
  }

  if (input.startsAt.getTime() < startOfTomorrow.getTime()) {
    return {
      label: "Today",
      tone: "accent" as const,
    };
  }

  if (input.startsAt.getTime() < startOfDayAfterTomorrow.getTime()) {
    return {
      label: "Tomorrow",
      tone: "success" as const,
    };
  }

  return {
    label: "Upcoming",
    tone: "neutral" as const,
  };
}

function isAppointmentType(
  value: string | null | undefined,
): value is AppointmentType {
  return frontOfficeAppointmentTypeDefinitions.some(
    (option) => option.value === value,
  );
}

function isAppointmentStatus(
  value: string | null | undefined,
): value is AppointmentStatus {
  return frontOfficeAppointmentStatusDefinitions.some(
    (option) => option.value === value,
  );
}

function isFrontOfficeAppointmentListStatusFilter(
  value: string | null | undefined,
): value is FrontOfficeAppointmentListStatusFilter {
  return Object.values(frontOfficeAppointmentListStatusFilters).includes(
    value as FrontOfficeAppointmentListStatusFilter,
  );
}

function isFrontOfficeAppointmentExternalWorkflowStatus(
  value: string | null | undefined,
): value is FrontOfficeAppointmentExternalWorkflowStatus {
  return Object.values(frontOfficeAppointmentExternalWorkflowStatuses).includes(
    value as FrontOfficeAppointmentExternalWorkflowStatus,
  );
}

function isFrontOfficeAppointmentCoordinationFilter(
  value: string | null | undefined,
): value is FrontOfficeAppointmentCoordinationFilter {
  return Object.values(frontOfficeAppointmentCoordinationFilters).includes(
    value as FrontOfficeAppointmentCoordinationFilter,
  );
}

function isFrontOfficeAppointmentFollowUpFilter(
  value: string | null | undefined,
): value is FrontOfficeAppointmentFollowUpFilter {
  return Object.values(frontOfficeAppointmentFollowUpFilters).includes(
    value as FrontOfficeAppointmentFollowUpFilter,
  );
}

export function formatFrontOfficeAppointmentExternalWorkflowLabel(
  value: FrontOfficeAppointmentExternalWorkflowStatus,
) {
  switch (value) {
    case frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp:
      return "Needs follow-up";
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending:
      return "Awaiting confirmation";
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmed:
      return "Confirmed";
    case frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested:
      return "Reschedule requested";
    default:
      return "External follow-up idle";
  }
}

function mapFrontOfficeAppointmentExternalWorkflowTone(
  value: FrontOfficeAppointmentExternalWorkflowStatus,
): FrontOfficeAppointmentTone {
  switch (value) {
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmed:
      return "success";
    case frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested:
      return "danger";
    case frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp:
      return "warning";
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending:
      return "accent";
    default:
      return "neutral";
  }
}

function parseAppointmentMetadataRecord(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value } as Record<string, Prisma.JsonValue>;
}

function parseFrontOfficeAppointmentExternalWorkflowMetadata(
  value: Prisma.JsonValue | null,
): {
  status: FrontOfficeAppointmentExternalWorkflowStatus;
  updatedAt: Date | null;
  note: string | null;
  nextActionAt: Date | null;
} {
  const metadata = parseAppointmentMetadataRecord(value);
  const workflowValue = metadata[appointmentExternalWorkflowMetadataKey];

  if (
    !workflowValue ||
    typeof workflowValue !== "object" ||
    Array.isArray(workflowValue)
  ) {
    return {
      status: frontOfficeAppointmentExternalWorkflowStatuses.idle,
      updatedAt: null,
      note: null,
      nextActionAt: null,
    };
  }

  const statusValue =
    "status" in workflowValue && typeof workflowValue.status === "string"
      ? workflowValue.status
      : null;
  const updatedAtValue =
    "updatedAt" in workflowValue ? workflowValue.updatedAt : undefined;
  const noteValue = "note" in workflowValue ? workflowValue.note : undefined;
  const nextActionAtValue =
    "nextActionAt" in workflowValue ? workflowValue.nextActionAt : undefined;
  const updatedAt =
    typeof updatedAtValue === "string" && updatedAtValue.trim()
      ? new Date(updatedAtValue)
      : null;
  const nextActionAt =
    typeof nextActionAtValue === "string" && nextActionAtValue.trim()
      ? new Date(nextActionAtValue)
      : null;

  return {
    status: isFrontOfficeAppointmentExternalWorkflowStatus(statusValue)
      ? statusValue
      : frontOfficeAppointmentExternalWorkflowStatuses.idle,
    updatedAt:
      updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
    note:
      typeof noteValue === "string" && noteValue.trim()
        ? noteValue.trim()
        : null,
    nextActionAt:
      nextActionAt && !Number.isNaN(nextActionAt.getTime())
        ? nextActionAt
        : null,
  };
}

function buildFrontOfficeAppointmentExternalWorkflowDetail(input: {
  status: FrontOfficeAppointmentExternalWorkflowStatus;
  updatedAt: Date | null;
  note: string | null;
  nextActionAt: Date | null;
  timeZone?: string | null;
}) {
  if (input.status === frontOfficeAppointmentExternalWorkflowStatuses.idle) {
    return "No explicit confirmation, follow-up, or reschedule state recorded yet.";
  }

  const timestamp = input.updatedAt
    ? `Marked ${formatDateTimeLabel(input.updatedAt, {
        timeZone: input.timeZone ?? null,
      })}`
    : "";
  const nextAction =
    input.nextActionAt != null
      ? `Next external touch ${formatDateTimeLabel(input.nextActionAt, {
          timeZone: input.timeZone ?? null,
        })}`
      : "";
  const defaultSummary =
    input.status === frontOfficeAppointmentExternalWorkflowStatuses.confirmed
      ? "Client or counterpart confirmed the plan."
      : input.status ===
          frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending
        ? "Waiting on the client or counterpart to confirm."
        : input.status ===
            frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested
          ? "The appointment needs a time change or reset."
          : "This appointment still needs active outreach or a fresh confirmation.";

  return [timestamp, nextAction, input.note, defaultSummary]
    .filter(Boolean)
    .join(" · ");
}

function buildFrontOfficeAppointmentFollowUpPlan(input: {
  appointmentStatus: AppointmentStatus;
  externalWorkflow: FrontOfficeAppointmentExternalWorkflowState;
  bridgeStatus: FrontOfficeAppointmentBridgeStatus;
  requiresExternalResponse: boolean;
  isExternalTouchDue: boolean;
}): {
  label: string;
  tone: FrontOfficeAppointmentTone;
  detail: string;
  needsNextTouchPlan: boolean;
} {
  if (input.appointmentStatus !== AppointmentStatus.scheduled) {
    return {
      label: "Closed in Acre",
      tone: "neutral" as const,
      detail:
        "This appointment is no longer scheduled, so the coordination rhythm is read-only unless you create a new plan.",
      needsNextTouchPlan: false,
    };
  }

  if (input.isExternalTouchDue) {
    return {
      label: "Touch overdue",
      tone: "danger" as const,
      detail:
        input.externalWorkflow.nextActionAtLabel === "No next external touch set"
          ? "Acre expects another outside touch now, but the saved follow-up deadline is already overdue."
          : `The saved next external touch is overdue since ${input.externalWorkflow.nextActionAtLabel}.`,
      needsNextTouchPlan: false,
    };
  }

  const hasNextTouch = Boolean(input.externalWorkflow.nextActionAt);
  const needsNextTouchPlan =
    input.requiresExternalResponse && !hasNextTouch;

  if (needsNextTouchPlan) {
    return {
      label: "Missing next touch",
      tone: "warning" as const,
      detail:
        "The appointment still needs outside confirmation or follow-up, but no next-touch deadline is saved yet.",
      needsNextTouchPlan: true,
    };
  }

  if (hasNextTouch) {
    return {
      label:
        input.externalWorkflow.value ===
        frontOfficeAppointmentExternalWorkflowStatuses.confirmed
          ? "Confirmed with guardrail"
          : "Touch scheduled",
      tone:
        input.externalWorkflow.value ===
        frontOfficeAppointmentExternalWorkflowStatuses.confirmed
          ? "success"
          : "accent",
      detail: `Next external touch is set for ${input.externalWorkflow.nextActionAtLabel}.`,
      needsNextTouchPlan: false,
    };
  }

  if (
    input.externalWorkflow.value ===
    frontOfficeAppointmentExternalWorkflowStatuses.confirmed
  ) {
    return {
      label: "Confirmed and clear",
      tone: "success" as const,
      detail:
        "Outside confirmation is already saved and there is no extra next-touch deadline on the record.",
      needsNextTouchPlan: false,
    };
  }

  if (input.bridgeStatus.hasBridgeActivity) {
    return {
      label: "Bridge opened, plan not written back",
      tone: "warning" as const,
      detail:
        "A Google, Outlook, ICS, or email bridge was opened from Acre, but the follow-up rhythm still has not been written back.",
      needsNextTouchPlan: false,
    };
  }

  return {
    label: "No follow-up rhythm saved",
    tone: "neutral" as const,
    detail:
      "Acre has the appointment on the calendar, but there is still no explicit outside follow-up rhythm saved on the record.",
    needsNextTouchPlan: false,
  };
}

function pushFrontOfficeAppointmentTouchPreset(
  presets: FrontOfficeAppointmentTouchPreset[],
  input: {
    id: string;
    label: string;
    detail: string;
    suggestedStatus: FrontOfficeAppointmentExternalWorkflowStatus;
    nextActionAt: Date;
    now: Date;
    timeZone?: string | null;
  },
) {
  if (input.nextActionAt.getTime() <= input.now.getTime()) {
    return;
  }

  const nextActionAtValue = formatDateTimeInputValue(input.nextActionAt, {
    timeZone: input.timeZone ?? null,
  });

  if (!nextActionAtValue) {
    return;
  }

  if (
    presets.some(
      (preset) =>
        preset.suggestedStatus === input.suggestedStatus &&
        preset.nextActionAtValue === nextActionAtValue,
    )
  ) {
    return;
  }

  presets.push({
    id: input.id,
    label: input.label,
    detail: input.detail,
    suggestedStatus: input.suggestedStatus,
    nextActionAtLabel: formatDateTimeLabel(input.nextActionAt, {
      timeZone: input.timeZone ?? null,
    }),
    nextActionAtValue,
  });
}

function buildFrontOfficeAppointmentTouchPresets(input: {
  appointmentStatus: AppointmentStatus;
  startsAt: Date;
  externalWorkflow: FrontOfficeAppointmentExternalWorkflowState;
  now: Date;
  timeZone?: string | null;
}) {
  if (input.appointmentStatus !== AppointmentStatus.scheduled) {
    return [] as FrontOfficeAppointmentTouchPreset[];
  }

  const twoHoursFromNow = new Date(input.now.getTime() + 2 * 60 * 60 * 1000);
  const oneDayFromNow = new Date(input.now.getTime() + 24 * 60 * 60 * 1000);
  const twoHoursBeforeStart = new Date(
    input.startsAt.getTime() - 2 * 60 * 60 * 1000,
  );
  const oneDayBeforeStart = new Date(
    input.startsAt.getTime() - 24 * 60 * 60 * 1000,
  );
  const presets: FrontOfficeAppointmentTouchPreset[] = [];

  if (
    input.externalWorkflow.value ===
    frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested
  ) {
    pushFrontOfficeAppointmentTouchPreset(presets, {
      id: "reschedule-2h",
      label: "Reschedule · +2h",
      detail: "Keep the time-change conversation active in the next two hours.",
      suggestedStatus:
        frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested,
      nextActionAt: twoHoursFromNow,
      now: input.now,
      timeZone: input.timeZone,
    });
    pushFrontOfficeAppointmentTouchPreset(presets, {
      id: "reschedule-24h",
      label: "Reschedule · +24h",
      detail:
        "Bring the time-change thread back tomorrow if the new slot is still unresolved.",
      suggestedStatus:
        frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested,
      nextActionAt: oneDayFromNow,
      now: input.now,
      timeZone: input.timeZone,
    });
  } else if (
    input.externalWorkflow.value ===
    frontOfficeAppointmentExternalWorkflowStatuses.confirmed
  ) {
    pushFrontOfficeAppointmentTouchPreset(presets, {
      id: "confirmed-prestart",
      label: "Confirmed · before start",
      detail:
        "Keep a light final check before the meeting starts without changing the confirmed state.",
      suggestedStatus:
        frontOfficeAppointmentExternalWorkflowStatuses.confirmed,
      nextActionAt: twoHoursBeforeStart,
      now: input.now,
      timeZone: input.timeZone,
    });
    pushFrontOfficeAppointmentTouchPreset(presets, {
      id: "confirmed-day-before",
      label: "Confirmed · day-before",
      detail:
        "Use a day-before reminder when you want one last soft touch on the record.",
      suggestedStatus:
        frontOfficeAppointmentExternalWorkflowStatuses.confirmed,
      nextActionAt: oneDayBeforeStart,
      now: input.now,
      timeZone: input.timeZone,
    });
  } else {
    pushFrontOfficeAppointmentTouchPreset(presets, {
      id: "awaiting-2h",
      label: "Awaiting reply · +2h",
      detail: "Best when you expect a same-day confirmation reply.",
      suggestedStatus:
        frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending,
      nextActionAt: twoHoursFromNow,
      now: input.now,
      timeZone: input.timeZone,
    });
    pushFrontOfficeAppointmentTouchPreset(presets, {
      id: "awaiting-24h",
      label: "Awaiting reply · +24h",
      detail:
        "Keeps the confirmation thread visible tomorrow if no one replies today.",
      suggestedStatus:
        frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending,
      nextActionAt: oneDayFromNow,
      now: input.now,
      timeZone: input.timeZone,
    });
    pushFrontOfficeAppointmentTouchPreset(presets, {
      id: "followup-prestart",
      label: "Needs follow-up · before start",
      detail:
        "Use when you want one more outbound push shortly before the meeting starts.",
      suggestedStatus:
        frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp,
      nextActionAt: twoHoursBeforeStart,
      now: input.now,
      timeZone: input.timeZone,
    });
  }

  if (!presets.length) {
    pushFrontOfficeAppointmentTouchPreset(presets, {
      id: "followup-2h",
      label: "Needs follow-up · +2h",
      detail:
        "Adds a fresh next-touch checkpoint without implying anything synced in the background.",
      suggestedStatus:
        frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp,
      nextActionAt: twoHoursFromNow,
      now: input.now,
      timeZone: input.timeZone,
    });
  }

  return presets.slice(0, 3);
}

export function getFrontOfficeAppointmentExternalWorkflowState(input: {
  metadata: Prisma.JsonValue | null;
  timeZone?: string | null;
}): FrontOfficeAppointmentExternalWorkflowState {
  const parsed = parseFrontOfficeAppointmentExternalWorkflowMetadata(
    input.metadata,
  );

  return {
    value: parsed.status,
    label: formatFrontOfficeAppointmentExternalWorkflowLabel(parsed.status),
    tone: mapFrontOfficeAppointmentExternalWorkflowTone(parsed.status),
    detail: buildFrontOfficeAppointmentExternalWorkflowDetail({
      status: parsed.status,
      updatedAt: parsed.updatedAt,
      note: parsed.note,
      nextActionAt: parsed.nextActionAt,
      timeZone: input.timeZone ?? null,
    }),
    note: parsed.note,
    nextActionAt: parsed.nextActionAt,
    nextActionAtLabel: parsed.nextActionAt
      ? formatDateTimeLabel(parsed.nextActionAt, {
          timeZone: input.timeZone ?? null,
        })
      : "No next external touch set",
    nextActionAtValue: formatDateTimeInputValue(parsed.nextActionAt, {
      timeZone: input.timeZone ?? null,
    }),
  };
}

function buildAppointmentMetadataWithExternalWorkflow(input: {
  existingMetadata: Prisma.JsonValue | null;
  status: FrontOfficeAppointmentExternalWorkflowStatus;
  updatedAt: Date;
  note?: string | null;
  nextActionAt?: Date | null;
}) {
  const metadataRecord = parseAppointmentMetadataRecord(input.existingMetadata);

  if (input.status === frontOfficeAppointmentExternalWorkflowStatuses.idle) {
    delete metadataRecord[appointmentExternalWorkflowMetadataKey];
  } else {
    metadataRecord[appointmentExternalWorkflowMetadataKey] = {
      status: input.status,
      updatedAt: input.updatedAt.toISOString(),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.nextActionAt
        ? { nextActionAt: input.nextActionAt.toISOString() }
        : {}),
    };
  }

  return Object.keys(metadataRecord).length
    ? (metadataRecord as Prisma.InputJsonValue)
    : Prisma.JsonNull;
}

function parseRequiredDate(value: string, fieldLabel: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return parsed;
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalDateTimeInput(
  value: string | null | undefined,
  fieldLabel: string,
) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} is invalid.`);
  }

  return parsed;
}

function buildDefaultAppointmentTitle(
  type: AppointmentType,
  clientName: string | null | undefined,
  listingTitle: string | null | undefined,
) {
  const typeLabel = findAppointmentTypeDefinition(type)?.label ?? "Appointment";
  const context = [clientName?.trim(), listingTitle?.trim()]
    .filter(Boolean)
    .join(" · ");

  return context ? `${typeLabel} · ${context}` : typeLabel;
}

type FrontOfficeAppointmentLatestBridgeAction = {
  action: FrontOfficeAppointmentBridgeAction;
  createdAt: Date;
};

type FrontOfficeAppointmentCoordinationArtifacts = {
  bridgeStatusMap: Map<string, FrontOfficeAppointmentBridgeStatus>;
  bridgeHistoryMap: Map<
    string,
    FrontOfficeAppointmentCoordinationHistoryItem[]
  >;
  writebackHistoryMap: Map<
    string,
    FrontOfficeAppointmentCoordinationHistoryItem[]
  >;
};

type FrontOfficeAppointmentRelevantAuditChange = {
  label: string;
  previousValue: string;
  nextValue: string;
};

type FrontOfficeAppointmentBridgePayloadSnapshot = {
  action: FrontOfficeAppointmentBridgeAction;
  actionLabel: string;
  appointmentStatusLabel: string | null;
  externalStatusLabel: string | null;
  nextExternalTouchLabel: string | null;
  externalNote: string | null;
};

type FrontOfficeAppointmentWritebackChangedField =
  | "status"
  | "note"
  | "nextActionAt";

type FrontOfficeAppointmentWritebackPayloadSnapshot = {
  statusLabel: string | null;
  note: string | null;
  nextActionAtLabel: string | null;
  changedFields: FrontOfficeAppointmentWritebackChangedField[];
};

const coordinationHistoryChangeLabels = new Set([
  "External follow-up",
  "External note",
  "Next external touch",
]);

function parseAppointmentBridgeActionFromPayload(
  payload: Prisma.JsonValue | null,
) {
  const bridgeSnapshot = parseAppointmentBridgePayloadSnapshot(payload);

  if (bridgeSnapshot) {
    return bridgeSnapshot.action;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const bridgeAction = "bridgeAction" in payload ? payload.bridgeAction : null;
  const workflowReason =
    "workflowReason" in payload ? payload.workflowReason : null;

  if (
    typeof bridgeAction === "string" &&
    isFrontOfficeAppointmentBridgeAction(bridgeAction)
  ) {
    return bridgeAction;
  }

  if (
    typeof workflowReason === "string" &&
    isFrontOfficeAppointmentBridgeAction(workflowReason)
  ) {
    return workflowReason;
  }

  return null;
}

function parseAuditLogPayloadRecord(value: Prisma.JsonValue | null) {
  return parseAppointmentMetadataRecord(value);
}

function readTrimmedAuditLogString(
  record: Record<string, Prisma.JsonValue> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseAppointmentBridgePayloadSnapshot(
  payload: Prisma.JsonValue | null,
): FrontOfficeAppointmentBridgePayloadSnapshot | null {
  const record = parseAuditLogPayloadRecord(payload);
  const rawSnapshot = record.coordinationBridge;

  if (
    !rawSnapshot ||
    typeof rawSnapshot !== "object" ||
    Array.isArray(rawSnapshot)
  ) {
    return null;
  }

  const snapshotRecord = rawSnapshot as Record<string, Prisma.JsonValue>;
  const action = readTrimmedAuditLogString(snapshotRecord, "action");

  if (!isFrontOfficeAppointmentBridgeAction(action)) {
    return null;
  }

  return {
    action,
    actionLabel:
      readTrimmedAuditLogString(snapshotRecord, "actionLabel") ??
      formatFrontOfficeAppointmentBridgeActionLabel(action),
    appointmentStatusLabel: readTrimmedAuditLogString(
      snapshotRecord,
      "appointmentStatusLabel",
    ),
    externalStatusLabel: readTrimmedAuditLogString(
      snapshotRecord,
      "externalStatusLabel",
    ),
    nextExternalTouchLabel: readTrimmedAuditLogString(
      snapshotRecord,
      "nextExternalTouchLabel",
    ),
    externalNote: readTrimmedAuditLogString(snapshotRecord, "externalNote"),
  };
}

function parseAppointmentWritebackPayloadSnapshot(
  payload: Prisma.JsonValue | null,
): FrontOfficeAppointmentWritebackPayloadSnapshot | null {
  const record = parseAuditLogPayloadRecord(payload);
  const rawSnapshot = record.coordinationWriteback;

  if (
    !rawSnapshot ||
    typeof rawSnapshot !== "object" ||
    Array.isArray(rawSnapshot)
  ) {
    return null;
  }

  const snapshotRecord = rawSnapshot as Record<string, Prisma.JsonValue>;
  const rawChangedFields = snapshotRecord.changedFields;
  const changedFields = Array.isArray(rawChangedFields)
    ? rawChangedFields.filter(
        (field): field is FrontOfficeAppointmentWritebackChangedField =>
          field === "status" || field === "note" || field === "nextActionAt",
      )
    : [];

  if (!changedFields.length) {
    return null;
  }

  return {
    statusLabel: readTrimmedAuditLogString(snapshotRecord, "statusLabel"),
    note: readTrimmedAuditLogString(snapshotRecord, "note"),
    nextActionAtLabel: readTrimmedAuditLogString(
      snapshotRecord,
      "nextActionAtLabel",
    ),
    changedFields,
  };
}

function parseRelevantAppointmentAuditChanges(
  payload: Prisma.JsonValue | null,
): FrontOfficeAppointmentRelevantAuditChange[] {
  const record = parseAuditLogPayloadRecord(payload);
  const rawChanges = record.changes;

  if (!Array.isArray(rawChanges)) {
    return [];
  }

  const changes: FrontOfficeAppointmentRelevantAuditChange[] = [];

  for (const rawChange of rawChanges) {
    if (
      !rawChange ||
      typeof rawChange !== "object" ||
      Array.isArray(rawChange)
    ) {
      continue;
    }

    const label = "label" in rawChange ? rawChange.label : null;
    const previousValue =
      "previousValue" in rawChange ? rawChange.previousValue : null;
    const nextValue = "nextValue" in rawChange ? rawChange.nextValue : null;

    if (
      typeof label !== "string" ||
      !coordinationHistoryChangeLabels.has(label) ||
      typeof previousValue !== "string" ||
      typeof nextValue !== "string"
    ) {
      continue;
    }

    changes.push({
      label,
      previousValue,
      nextValue,
    });
  }

  return changes;
}

function parseAuditLogDetailLines(payload: Prisma.JsonValue | null) {
  const record = parseAuditLogPayloadRecord(payload);
  const rawDetails = record.details;

  if (!Array.isArray(rawDetails)) {
    return [];
  }

  return rawDetails
    .filter((detail): detail is string => typeof detail === "string")
    .map((detail) => detail.trim())
    .filter(Boolean);
}

function formatAuditActorLabel(
  membership:
    | {
        user: {
          firstName: string;
          lastName: string;
          email: string;
        };
      }
    | null
    | undefined,
) {
  if (!membership?.user) {
    return "Acre user";
  }

  const fullName =
    `${membership.user.firstName} ${membership.user.lastName}`.trim();
  return fullName || membership.user.email || "Acre user";
}

function mapExternalWorkflowLabelTone(
  label: string | null | undefined,
): FrontOfficeAppointmentTone {
  switch (label?.trim()) {
    case "Confirmed":
      return "success";
    case "Reschedule requested":
      return "danger";
    case "Needs follow-up":
      return "warning";
    case "Awaiting confirmation":
      return "accent";
    default:
      return "accent";
  }
}

function buildBridgeHistoryItem(input: {
  id: string;
  createdAt: Date;
  action: FrontOfficeAppointmentBridgeAction;
  actorLabel: string;
  payload: Prisma.JsonValue | null;
  timeZone?: string | null;
}): FrontOfficeAppointmentCoordinationHistoryItem {
  const createdAtLabel = formatDateTimeLabel(input.createdAt, {
    timeZone: input.timeZone ?? null,
  });
  const bridgeSnapshot = parseAppointmentBridgePayloadSnapshot(input.payload);
  const detailLines = parseAuditLogDetailLines(input.payload).filter(
    (detail) =>
      detail.startsWith("Acre status:") ||
      detail.startsWith("External coordination:") ||
      detail.startsWith("Next external touch:") ||
      detail.startsWith("Writeback note:"),
  );
  const detailParts = bridgeSnapshot
    ? [
        bridgeSnapshot.appointmentStatusLabel
          ? `Acre status: ${bridgeSnapshot.appointmentStatusLabel}`
          : "",
        bridgeSnapshot.externalStatusLabel
          ? `External coordination: ${bridgeSnapshot.externalStatusLabel}`
          : "External coordination: No writeback saved yet",
        bridgeSnapshot.nextExternalTouchLabel
          ? `Next external touch: ${bridgeSnapshot.nextExternalTouchLabel}`
          : "",
        bridgeSnapshot.externalNote
          ? `Writeback note: ${bridgeSnapshot.externalNote}`
          : "",
      ]
        .filter(Boolean)
        .slice(0, 3)
    : detailLines.slice(0, 3);
  const actionLabel =
    bridgeSnapshot?.actionLabel ??
    formatFrontOfficeAppointmentBridgeActionLabel(input.action);

  return {
    id: input.id,
    kind: "bridge",
    label: `${actionLabel} opened`,
    detail: detailParts.join(" · ") || "Opened from the appointment record in Acre.",
    actorLabel: input.actorLabel,
    createdAtLabel,
    createdAtValue: input.createdAt.toISOString(),
    tone: "accent",
  };
}

function buildWritebackHistoryItem(input: {
  id: string;
  createdAt: Date;
  actorLabel: string;
  payload: Prisma.JsonValue | null;
  timeZone?: string | null;
}): FrontOfficeAppointmentCoordinationHistoryItem | null {
  const writebackSnapshot = parseAppointmentWritebackPayloadSnapshot(
    input.payload,
  );
  const changes = parseRelevantAppointmentAuditChanges(input.payload);

  if (!writebackSnapshot && !changes.length) {
    return null;
  }

  const createdAtLabel = formatDateTimeLabel(input.createdAt, {
    timeZone: input.timeZone ?? null,
  });
  const detailParts = writebackSnapshot
    ? [
        writebackSnapshot.changedFields.includes("status") &&
        writebackSnapshot.statusLabel
          ? `External follow-up: ${writebackSnapshot.statusLabel}`
          : "",
        writebackSnapshot.changedFields.includes("note")
          ? `External note: ${writebackSnapshot.note ?? "Cleared"}`
          : "",
        writebackSnapshot.changedFields.includes("nextActionAt")
          ? `Next external touch: ${writebackSnapshot.nextActionAtLabel ?? "Cleared"}`
          : "",
      ].filter(Boolean)
    : changes.map((change) => `${change.label}: ${change.nextValue}`);
  const statusChange = changes.find(
    (change) => change.label === "External follow-up",
  );
  const nextLabel =
    writebackSnapshot?.statusLabel ?? statusChange?.nextValue?.trim() ?? null;

  return {
    id: input.id,
    kind: "writeback",
    label: nextLabel ? `Writeback saved: ${nextLabel}` : "Writeback updated",
    detail: detailParts.join(" · "),
    actorLabel: input.actorLabel,
    createdAtLabel,
    createdAtValue: input.createdAt.toISOString(),
    tone: mapExternalWorkflowLabelTone(nextLabel),
  };
}

function compareCoordinationHistoryItems(
  left: FrontOfficeAppointmentCoordinationHistoryItem,
  right: FrontOfficeAppointmentCoordinationHistoryItem,
) {
  if (left.createdAtValue !== right.createdAtValue) {
    return right.createdAtValue.localeCompare(left.createdAtValue);
  }

  if (left.kind !== right.kind) {
    return left.kind === "writeback" ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

function parseAppointmentSortTimestamp(value: string) {
  if (!value.trim()) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getAppointmentRecordSortRank(
  appointment: FrontOfficeAppointmentRecord,
) {
  if (appointment.statusValue !== AppointmentStatus.scheduled) {
    switch (appointment.statusValue) {
      case AppointmentStatus.completed:
        return 50;
      case AppointmentStatus.no_show:
        return 51;
      case AppointmentStatus.canceled:
        return 52;
      default:
        return 53;
    }
  }

  if (appointment.isExternalTouchDue) {
    return 0;
  }

  if (appointment.needsNextTouchPlan) {
    return 1;
  }

  if (
    appointment.hasBridgeActivity &&
    appointment.externalStatusValue ===
      frontOfficeAppointmentExternalWorkflowStatuses.idle
  ) {
    return 2;
  }

  if (
    appointment.requiresExternalResponse &&
    appointment.externalNextActionAtValue !== ""
  ) {
    return 3;
  }

  if (appointment.requiresExternalResponse) {
    return 4;
  }

  if (
    appointment.externalStatusValue ===
      frontOfficeAppointmentExternalWorkflowStatuses.confirmed &&
    appointment.externalNextActionAtValue !== ""
  ) {
    return 5;
  }

  if (appointment.reminderLabel === "Starts within 2h") {
    return 6;
  }

  if (appointment.reminderLabel === "Today") {
    return 7;
  }

  return 8;
}

function getAppointmentRecordSortAnchor(
  appointment: FrontOfficeAppointmentRecord,
) {
  const nextTouchTimestamp = parseAppointmentSortTimestamp(
    appointment.externalNextActionAtValue,
  );

  if (
    appointment.statusValue === AppointmentStatus.scheduled &&
    nextTouchTimestamp !== Number.POSITIVE_INFINITY &&
    (appointment.isExternalTouchDue ||
      appointment.requiresExternalResponse ||
      appointment.externalStatusValue ===
        frontOfficeAppointmentExternalWorkflowStatuses.confirmed)
  ) {
    return nextTouchTimestamp;
  }

  return parseAppointmentSortTimestamp(appointment.startsAtValue);
}

function compareAppointmentRecords(
  left: FrontOfficeAppointmentRecord,
  right: FrontOfficeAppointmentRecord,
) {
  const leftRank = getAppointmentRecordSortRank(left);
  const rightRank = getAppointmentRecordSortRank(right);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const leftAnchor = getAppointmentRecordSortAnchor(left);
  const rightAnchor = getAppointmentRecordSortAnchor(right);
  const leftClosed = left.statusValue !== AppointmentStatus.scheduled;
  const rightClosed = right.statusValue !== AppointmentStatus.scheduled;

  if (leftAnchor !== rightAnchor) {
    if (leftClosed && rightClosed) {
      return rightAnchor - leftAnchor;
    }

    return leftAnchor - rightAnchor;
  }

  const leftStart = parseAppointmentSortTimestamp(left.startsAtValue);
  const rightStart = parseAppointmentSortTimestamp(right.startsAtValue);

  if (leftStart !== rightStart) {
    if (leftClosed && rightClosed) {
      return rightStart - leftStart;
    }

    return leftStart - rightStart;
  }

  return left.title.localeCompare(right.title);
}

function buildFrontOfficeAppointmentBridgeStatus(
  latestAction: FrontOfficeAppointmentLatestBridgeAction | null | undefined,
  timeZone?: string | null,
): FrontOfficeAppointmentBridgeStatus {
  if (!latestAction) {
    return {
      label: "No external bridge opened",
      detail:
        "Google Calendar, Outlook, ICS, or email has not been opened from Acre yet.",
      tone: "neutral",
      actionLabel: "No bridge logged",
      loggedAtLabel: "No bridge logged",
      hasBridgeActivity: false,
    };
  }

  const actionLabel = formatFrontOfficeAppointmentBridgeActionLabel(
    latestAction.action,
  );
  const loggedAtLabel = formatDateTimeLabel(latestAction.createdAt, {
    timeZone: timeZone ?? null,
  });

  return {
    label: `${actionLabel} opened from Acre`,
    detail: `Logged ${loggedAtLabel}`,
    tone: "accent",
    actionLabel,
    loggedAtLabel,
    hasBridgeActivity: true,
  };
}

function buildFrontOfficeAppointmentCoordinationSummary(input: {
  appointmentStatus: AppointmentStatus;
  appointmentStatusLabel: string;
  appointmentStatusTone: FrontOfficeAppointmentTone;
  now: Date;
  externalWorkflow: FrontOfficeAppointmentExternalWorkflowState;
  bridgeStatus: FrontOfficeAppointmentBridgeStatus;
}): FrontOfficeAppointmentCoordinationSummary {
  const isScheduled = input.appointmentStatus === AppointmentStatus.scheduled;
  const isExternalTouchDue = Boolean(
    isScheduled &&
    input.externalWorkflow.nextActionAt &&
    input.externalWorkflow.nextActionAt.getTime() <= input.now.getTime(),
  );
  const requiresExternalResponse =
    isScheduled &&
    (input.externalWorkflow.value ===
      frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp ||
      input.externalWorkflow.value ===
        frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending ||
      input.externalWorkflow.value ===
        frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested);
  const bridgeSummary = input.bridgeStatus.hasBridgeActivity
    ? `${input.bridgeStatus.actionLabel} opened ${input.bridgeStatus.loggedAtLabel}.`
    : "No Google / Outlook / ICS / email bridge logged from Acre yet.";
  const nextTouchSummary = input.externalWorkflow.nextActionAt
    ? isExternalTouchDue
      ? `Next external touch is overdue since ${input.externalWorkflow.nextActionAtLabel}.`
      : `Next external touch is set for ${input.externalWorkflow.nextActionAtLabel}.`
    : input.externalWorkflow.value !==
        frontOfficeAppointmentExternalWorkflowStatuses.idle
      ? "No next external touch deadline is saved yet."
      : "";
  const noteSummary = input.externalWorkflow.note
    ? `Writeback note: ${input.externalWorkflow.note}.`
    : "";

  if (!isScheduled) {
    return {
      label: `${input.appointmentStatusLabel} in Acre`,
      tone: input.appointmentStatusTone,
      detail: [
        `This appointment is already marked ${input.appointmentStatusLabel.toLowerCase()} in Acre.`,
        input.bridgeStatus.hasBridgeActivity
          ? bridgeSummary
          : "No further external coordination is expected unless you reopen or replace the appointment.",
      ]
        .filter(Boolean)
        .join(" "),
      nextStep:
        "No new external follow-up is required unless the plan changes and you create or reopen an appointment.",
      requiresExternalResponse: false,
      isExternalTouchDue: false,
    };
  }

  if (isExternalTouchDue) {
    return {
      label: "External touch overdue",
      tone: "danger",
      detail: [
        `${input.externalWorkflow.label} is still the saved writeback state.`,
        nextTouchSummary,
        bridgeSummary,
        noteSummary,
      ]
        .filter(Boolean)
        .join(" "),
      nextStep:
        "Reach back out now, then update the writeback to confirmed, reschedule requested, or a new follow-up deadline.",
      requiresExternalResponse,
      isExternalTouchDue: true,
    };
  }

  switch (input.externalWorkflow.value) {
    case frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested:
      return {
        label: "Reschedule in motion",
        tone: "danger",
        detail: [
          "The latest writeback says this appointment needs a time change.",
          nextTouchSummary,
          bridgeSummary,
          noteSummary,
        ]
          .filter(Boolean)
          .join(" "),
        nextStep:
          "Use the note field to capture the new timing conversation, then save the next external touch until a replacement time is locked.",
        requiresExternalResponse: true,
        isExternalTouchDue: false,
      };
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending:
      return {
        label: "Waiting on outside reply",
        tone: "accent",
        detail: [
          "Acre is still waiting for a confirmation response outside the system.",
          nextTouchSummary,
          bridgeSummary,
          noteSummary,
        ]
          .filter(Boolean)
          .join(" "),
        nextStep:
          "When the client or counterpart replies, write back whether the plan is confirmed or needs a reschedule.",
        requiresExternalResponse: true,
        isExternalTouchDue: false,
      };
    case frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp:
      return {
        label: "Follow-up still needed",
        tone: "warning",
        detail: [
          "The current writeback says this appointment still needs an outbound touch.",
          nextTouchSummary,
          bridgeSummary,
          noteSummary,
        ]
          .filter(Boolean)
          .join(" "),
        nextStep:
          "Use a bridge action or direct outreach, then save the next touch or confirmation outcome here.",
        requiresExternalResponse: true,
        isExternalTouchDue: false,
      };
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmed:
      return {
        label: "Externally confirmed",
        tone: "success",
        detail: [
          "The outside participant has already confirmed this appointment.",
          nextTouchSummary,
          bridgeSummary,
          noteSummary,
        ]
          .filter(Boolean)
          .join(" "),
        nextStep:
          "Keep this record as-is unless the plan changes, or add a follow-up reminder if you want a last-touch check before start time.",
        requiresExternalResponse: false,
        isExternalTouchDue: false,
      };
    default:
      if (input.bridgeStatus.hasBridgeActivity) {
        return {
          label: "Bridge opened, writeback pending",
          tone: "warning",
          detail: [
            bridgeSummary,
            "Acre has a bridge action on file, but no confirmation or reschedule writeback has been saved yet.",
          ]
            .filter(Boolean)
            .join(" "),
          nextStep:
            "After you hear back, save whether the appointment is awaiting confirmation, confirmed, or being rescheduled.",
          requiresExternalResponse: false,
          isExternalTouchDue: false,
        };
      }

      return {
        label: "No external coordination logged",
        tone: "neutral",
        detail:
          "Acre has the appointment on the calendar, but there is no bridge activity or follow-up writeback saved yet.",
        nextStep:
          "Open Google, Outlook, ICS, or email from this record when the meeting needs outside calendar or email coordination.",
        requiresExternalResponse: false,
        isExternalTouchDue: false,
      };
  }
}

async function getFrontOfficeAppointmentCoordinationArtifacts(input: {
  organizationId: string;
  appointmentIds: string[];
  timeZone?: string | null;
}): Promise<FrontOfficeAppointmentCoordinationArtifacts> {
  const uniqueAppointmentIds = [
    ...new Set(input.appointmentIds.filter(Boolean)),
  ];

  if (!uniqueAppointmentIds.length) {
    return {
      bridgeStatusMap: new Map<string, FrontOfficeAppointmentBridgeStatus>(),
      bridgeHistoryMap: new Map<
        string,
        FrontOfficeAppointmentCoordinationHistoryItem[]
      >(),
      writebackHistoryMap: new Map<
        string,
        FrontOfficeAppointmentCoordinationHistoryItem[]
      >(),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: input.organizationId,
      entityType: "appointment",
      entityId: {
        in: uniqueAppointmentIds,
      },
      action: {
        in: [
          activityLogActions.appointmentBridgeOpened,
          activityLogActions.appointmentUpdated,
        ],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      entityId: true,
      action: true,
      createdAt: true,
      payload: true,
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
  const latestBridgeActionMap = new Map<
    string,
    FrontOfficeAppointmentLatestBridgeAction
  >();
  const bridgeHistoryMap = new Map<
    string,
    FrontOfficeAppointmentCoordinationHistoryItem[]
  >();
  const writebackHistoryMap = new Map<
    string,
    FrontOfficeAppointmentCoordinationHistoryItem[]
  >();

  for (const log of logs) {
    const actorLabel = formatAuditActorLabel(log.membership);

    if (log.action === activityLogActions.appointmentBridgeOpened) {
      const action = parseAppointmentBridgeActionFromPayload(log.payload);

      if (!action) {
        continue;
      }

      if (!latestBridgeActionMap.has(log.entityId)) {
        latestBridgeActionMap.set(log.entityId, {
          action,
          createdAt: log.createdAt,
        });
      }

      const existingBridgeHistory = bridgeHistoryMap.get(log.entityId) ?? [];

      if (existingBridgeHistory.length < 5) {
        existingBridgeHistory.push(
          buildBridgeHistoryItem({
            id: log.id,
            createdAt: log.createdAt,
            action,
            actorLabel,
            payload: log.payload,
            timeZone: input.timeZone,
          }),
        );
        bridgeHistoryMap.set(log.entityId, existingBridgeHistory);
      }

      continue;
    }

    const writebackHistoryItem = buildWritebackHistoryItem({
      id: log.id,
      createdAt: log.createdAt,
      actorLabel,
      payload: log.payload,
      timeZone: input.timeZone,
    });

    if (!writebackHistoryItem) {
      continue;
    }

    const existingWritebackHistory =
      writebackHistoryMap.get(log.entityId) ?? [];

    if (existingWritebackHistory.length < 5) {
      existingWritebackHistory.push(writebackHistoryItem);
      writebackHistoryMap.set(log.entityId, existingWritebackHistory);
    }
  }

  return {
    bridgeStatusMap: new Map(
      uniqueAppointmentIds.map((appointmentId) => [
        appointmentId,
        buildFrontOfficeAppointmentBridgeStatus(
          latestBridgeActionMap.get(appointmentId),
          input.timeZone,
        ),
      ]),
    ),
    bridgeHistoryMap,
    writebackHistoryMap,
  };
}

export async function getFrontOfficeAppointmentBridgeStatusMap(input: {
  organizationId: string;
  appointmentIds: string[];
  timeZone?: string | null;
}) {
  const artifacts = await getFrontOfficeAppointmentCoordinationArtifacts(input);
  return artifacts.bridgeStatusMap;
}

function mapAppointmentRecord(
  appointment: Prisma.AppointmentGetPayload<{
    select: typeof appointmentSelect;
  }>,
  now: Date,
  timeZone?: string | null,
  coordinationArtifacts?: {
    bridgeStatus?: FrontOfficeAppointmentBridgeStatus | null;
    bridgeHistory?: FrontOfficeAppointmentCoordinationHistoryItem[];
    writebackHistory?: FrontOfficeAppointmentCoordinationHistoryItem[];
  } | null,
): FrontOfficeAppointmentRecord {
  const meetingOrLocation =
    appointment.location?.trim() ||
    appointment.meetingUrl?.trim() ||
    "Location pending";
  const listingLabel = appointment.listing
    ? `${appointment.listing.title} · ${appointment.listing.neighborhood}, ${appointment.listing.city}`
    : "No listing linked";
  const clientLabel =
    appointment.client?.fullName ??
    (appointment.contactLabel?.trim() || "No client linked");
  const notesLabel = appointment.notes?.trim() || "No internal note yet";
  const typeLabel =
    findAppointmentTypeDefinition(appointment.type)?.label ?? "Appointment";
  const statusLabel =
    findAppointmentStatusDefinition(appointment.status)?.label ?? "Scheduled";
  const statusTone = mapAppointmentStatusTone(appointment.status);
  const reminder = buildAppointmentReminderState({
    startsAt: appointment.startsAt,
    status: appointment.status,
    now,
  });
  const externalWorkflow = getFrontOfficeAppointmentExternalWorkflowState({
    metadata: appointment.metadata,
    timeZone,
  });
  const emailRecipientLabel = extractFrontOfficeAppointmentEmailRecipient({
    clientEmail: appointment.client?.email,
    contactLabel: appointment.contactLabel,
  });
  const externalLinks = buildFrontOfficeAppointmentExternalLinks({
    appointmentId: appointment.id,
    title: appointment.title,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    location: appointment.location,
    meetingUrl: appointment.meetingUrl,
    clientName: appointment.client?.fullName,
    clientEmail: appointment.client?.email,
    contactLabel: appointment.contactLabel,
    listingTitle: appointment.listing?.title,
    listingNeighborhood: appointment.listing?.neighborhood,
    listingCity: appointment.listing?.city,
    timeZone,
  });
  const resolvedBridgeStatus = coordinationArtifacts?.bridgeStatus
    ? coordinationArtifacts.bridgeStatus
    : buildFrontOfficeAppointmentBridgeStatus(null, timeZone);
  const coordination = buildFrontOfficeAppointmentCoordinationSummary({
    appointmentStatus: appointment.status,
    appointmentStatusLabel: statusLabel,
    appointmentStatusTone: statusTone,
    now,
    externalWorkflow,
    bridgeStatus: resolvedBridgeStatus,
  });
  const bridgeHistory = [...(coordinationArtifacts?.bridgeHistory ?? [])].sort(
    compareCoordinationHistoryItems,
  );
  const writebackHistory = [
    ...(coordinationArtifacts?.writebackHistory ?? []),
  ].sort(compareCoordinationHistoryItems);
  const coordinationHistory = [...bridgeHistory, ...writebackHistory]
    .sort(compareCoordinationHistoryItems)
    .slice(0, 6);
  const latestCoordination = coordinationHistory[0] ?? null;
  const followUpPlan = buildFrontOfficeAppointmentFollowUpPlan({
    appointmentStatus: appointment.status,
    externalWorkflow,
    bridgeStatus: resolvedBridgeStatus,
    requiresExternalResponse: coordination.requiresExternalResponse,
    isExternalTouchDue: coordination.isExternalTouchDue,
  });
  const touchPresets = buildFrontOfficeAppointmentTouchPresets({
    appointmentStatus: appointment.status,
    startsAt: appointment.startsAt,
    externalWorkflow,
    now,
    timeZone,
  });

  return {
    id: appointment.id,
    title: appointment.title,
    clientId: appointment.client?.id ?? null,
    clientHref: appointment.client?.id
      ? `/agent/clients/${appointment.client.id}`
      : null,
    typeValue: appointment.type,
    statusValue: appointment.status,
    startsAtValue: appointment.startsAt.toISOString(),
    typeLabel,
    typeTone: mapAppointmentTypeTone(appointment.type),
    statusLabel,
    statusTone,
    reminderLabel: reminder.label,
    reminderTone: reminder.tone,
    startsAtLabel: formatDateTimeLabel(appointment.startsAt, { timeZone }),
    endsAtLabel: appointment.endsAt
      ? formatDateTimeLabel(appointment.endsAt, { timeZone })
      : "No end time set",
    locationLabel: meetingOrLocation,
    clientLabel,
    clientEmailLabel: emailRecipientLabel || "No email target saved",
    contactLabel:
      appointment.contactLabel?.trim() || "No external contact noted",
    listingLabel,
    notesLabel,
    meetingUrlLabel: appointment.meetingUrl?.trim() || "No meeting link saved",
    listingOutputHref: appointment.client?.id
      ? `/agent/listings?clientId=${appointment.client.id}&appointmentId=${appointment.id}`
      : null,
    googleCalendarHref: externalLinks.googleCalendarHref,
    outlookCalendarHref: externalLinks.outlookCalendarHref,
    icsHref: externalLinks.icsHref,
    emailBriefHref: externalLinks.emailBriefHref,
    externalStatusValue: externalWorkflow.value,
    externalStatusLabel: externalWorkflow.label,
    externalStatusTone: externalWorkflow.tone,
    externalStatusDetail: externalWorkflow.detail,
    externalNote: externalWorkflow.note ?? "",
    externalNextActionAtLabel: externalWorkflow.nextActionAtLabel,
    externalNextActionAtValue: externalWorkflow.nextActionAtValue,
    coordinationLabel: coordination.label,
    coordinationTone: coordination.tone,
    coordinationDetail: coordination.detail,
    coordinationNextStep: coordination.nextStep,
    requiresExternalResponse: coordination.requiresExternalResponse,
    isExternalTouchDue: coordination.isExternalTouchDue,
    needsNextTouchPlan: followUpPlan.needsNextTouchPlan,
    followUpPlanLabel: followUpPlan.label,
    followUpPlanTone: followUpPlan.tone,
    followUpPlanDetail: followUpPlan.detail,
    bridgeStatusLabel: resolvedBridgeStatus.label,
    bridgeStatusDetail: resolvedBridgeStatus.detail,
    bridgeStatusTone: resolvedBridgeStatus.tone,
    bridgeActionLabel: resolvedBridgeStatus.actionLabel,
    bridgeLoggedAtLabel: resolvedBridgeStatus.loggedAtLabel,
    hasBridgeActivity: resolvedBridgeStatus.hasBridgeActivity,
    hasWritebackHistory: writebackHistory.length > 0,
    latestCoordinationLabel:
      latestCoordination?.label ?? "No coordination activity yet",
    latestCoordinationDetail: latestCoordination
      ? `${latestCoordination.actorLabel} · ${latestCoordination.createdAtLabel}`
      : "Bridge opens and writeback saves will appear here once coordination begins.",
    touchPresets,
    coordinationHistory,
    bridgeHistory,
    writebackHistory,
  };
}

function appointmentMatchesSnapshotFilters(input: {
  appointment: FrontOfficeAppointmentRecord;
  clientId?: string | null;
  type?: string | null;
  status?: string | null;
  coordination?: string | null;
  followUp?: string | null;
}) {
  const normalizedClientId = input.clientId?.trim() || null;
  const normalizedType = isAppointmentType(input.type) ? input.type : null;
  const normalizedStatus = isFrontOfficeAppointmentListStatusFilter(
    input.status,
  )
    ? input.status
    : frontOfficeAppointmentListStatusFilters.all;
  const normalizedCoordination = isFrontOfficeAppointmentCoordinationFilter(
    input.coordination,
  )
    ? input.coordination
    : frontOfficeAppointmentCoordinationFilters.all;
  const normalizedFollowUp = isFrontOfficeAppointmentFollowUpFilter(
    input.followUp,
  )
    ? input.followUp
    : frontOfficeAppointmentFollowUpFilters.all;

  if (normalizedClientId && input.appointment.clientId !== normalizedClientId) {
    return false;
  }

  if (normalizedType && input.appointment.typeValue !== normalizedType) {
    return false;
  }

  if (
    normalizedStatus !== frontOfficeAppointmentListStatusFilters.all &&
    input.appointment.statusValue !== normalizedStatus
  ) {
    return false;
  }

  if (
    normalizedCoordination ===
    frontOfficeAppointmentCoordinationFilters.touchDue
  ) {
    return input.appointment.isExternalTouchDue;
  }

  if (
    normalizedCoordination ===
    frontOfficeAppointmentCoordinationFilters.bridgeLogged
  ) {
    return input.appointment.hasBridgeActivity;
  }

  if (
    normalizedCoordination ===
    frontOfficeAppointmentCoordinationFilters.writebackPending
  ) {
    return (
      input.appointment.statusValue === AppointmentStatus.scheduled &&
      input.appointment.hasBridgeActivity &&
      input.appointment.externalStatusValue ===
        frontOfficeAppointmentExternalWorkflowStatuses.idle
    );
  }

  if (
    normalizedCoordination !== frontOfficeAppointmentCoordinationFilters.all &&
    input.appointment.externalStatusValue !== normalizedCoordination
  ) {
    return false;
  }

  if (normalizedFollowUp === frontOfficeAppointmentFollowUpFilters.all) {
    return true;
  }

  if (
    normalizedFollowUp === frontOfficeAppointmentFollowUpFilters.responseWaiting
  ) {
    return (
      input.appointment.statusValue === AppointmentStatus.scheduled &&
      input.appointment.requiresExternalResponse
    );
  }

  if (
    normalizedFollowUp === frontOfficeAppointmentFollowUpFilters.touchDue
  ) {
    return (
      input.appointment.statusValue === AppointmentStatus.scheduled &&
      input.appointment.isExternalTouchDue
    );
  }

  if (
    normalizedFollowUp ===
    frontOfficeAppointmentFollowUpFilters.nextTouchMissing
  ) {
    return (
      input.appointment.statusValue === AppointmentStatus.scheduled &&
      input.appointment.needsNextTouchPlan
    );
  }

  if (
    normalizedFollowUp ===
    frontOfficeAppointmentFollowUpFilters.touchScheduled
  ) {
    return (
      input.appointment.statusValue === AppointmentStatus.scheduled &&
      !input.appointment.isExternalTouchDue &&
      input.appointment.externalNextActionAtValue !== ""
    );
  }

  return (
    input.appointment.statusValue === AppointmentStatus.scheduled &&
    input.appointment.externalStatusValue ===
      frontOfficeAppointmentExternalWorkflowStatuses.confirmed
  );
}

export async function getFrontOfficeAppointmentsSnapshot(
  input: GetFrontOfficeAppointmentsSnapshotInput,
): Promise<FrontOfficeAppointmentsSnapshot> {
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
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const listingWhere: Prisma.ListingWhereInput = {
    organizationId: input.organizationId,
    status: {
      in: activeListingStatuses,
    },
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const [
    appointments,
    targetedAppointment,
    upcomingCount,
    todayCount,
    showingCount,
    clients,
    selectedClient,
    listings,
    selectedListing,
    handoffReadyCount,
    handoffs,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        startsAt: {
          gte: sevenDaysAgo,
          lte: fourteenDaysFromNow,
        },
      },
      orderBy: [{ startsAt: "asc" }, { updatedAt: "desc" }],
      select: appointmentSelect,
    }),
    input.targetAppointmentId?.trim()
      ? prisma.appointment.findFirst({
          where: {
            id: input.targetAppointmentId.trim(),
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
          },
          select: appointmentSelect,
        })
      : Promise.resolve(null),
    prisma.appointment.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        startsAt: {
          gte: now,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        startsAt: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        type: AppointmentType.showing,
        startsAt: {
          gte: now,
        },
      },
    }),
    prisma.client.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 16,
      select: {
        id: true,
        fullName: true,
        stage: true,
      },
    }),
    input.clientId?.trim()
      ? prisma.client.findFirst({
          where: {
            id: input.clientId.trim(),
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
          },
          select: {
            id: true,
            fullName: true,
            stage: true,
          },
        })
      : Promise.resolve(null),
    prisma.listing.findMany({
      where: listingWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 16,
      select: {
        id: true,
        title: true,
        neighborhood: true,
        city: true,
      },
    }),
    input.listingId?.trim()
      ? prisma.listing.findFirst({
          where: {
            id: input.listingId.trim(),
            ...listingWhere,
          },
          select: {
            id: true,
            title: true,
            neighborhood: true,
            city: true,
          },
        })
      : Promise.resolve(null),
    prisma.frontOfficeHandoffDraft.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: [...openFrontOfficeHandoffStatuses],
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
          in: [...openFrontOfficeHandoffStatuses],
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
      take: 4,
      select: {
        id: true,
        stageLabel: true,
        summary: true,
        client: {
          select: {
            fullName: true,
          },
        },
      },
    }),
  ]);
  const visibleAppointments = targetedAppointment
    ? appointments.some(
        (appointment) => appointment.id === targetedAppointment.id,
      )
      ? appointments
      : [...appointments, targetedAppointment]
    : appointments;
  visibleAppointments.sort((left, right) => {
    if (left.startsAt.getTime() !== right.startsAt.getTime()) {
      return left.startsAt.getTime() - right.startsAt.getTime();
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
  const coordinationArtifacts =
    await getFrontOfficeAppointmentCoordinationArtifacts({
      organizationId: input.organizationId,
      appointmentIds: visibleAppointments.map((appointment) => appointment.id),
      timeZone: input.timeZone,
    });
  const mappedAppointmentRecords = visibleAppointments.map((appointment) =>
    mapAppointmentRecord(appointment, now, input.timeZone, {
      bridgeStatus:
        coordinationArtifacts.bridgeStatusMap.get(appointment.id) ?? null,
      bridgeHistory:
        coordinationArtifacts.bridgeHistoryMap.get(appointment.id) ?? [],
      writebackHistory:
        coordinationArtifacts.writebackHistoryMap.get(appointment.id) ?? [],
    }),
  );
  const selectedAppointment = input.targetAppointmentId?.trim()
    ? (mappedAppointmentRecords.find(
        (appointment) => appointment.id === input.targetAppointmentId?.trim(),
      ) ?? null)
    : null;
  const appointmentRecords = mappedAppointmentRecords.filter((appointment) =>
    appointmentMatchesSnapshotFilters({
      appointment,
      clientId: input.clientId,
      type: input.type,
      status: input.status,
      coordination: input.coordination,
      followUp: input.followUp,
    }),
  );
  appointmentRecords.sort(compareAppointmentRecords);
  const awaitingReplyCount = mappedAppointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.requiresExternalResponse,
  ).length;
  const touchDueCount = mappedAppointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.isExternalTouchDue,
  ).length;
  const missingTouchPlanCount = mappedAppointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.needsNextTouchPlan,
  ).length;
  const bridgedCount = mappedAppointmentRecords.filter(
    (appointment) => appointment.hasBridgeActivity,
  ).length;
  const confirmationPendingCount = mappedAppointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.externalStatusValue ===
        frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending,
  ).length;
  const rescheduleRequestedCount = mappedAppointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.externalStatusValue ===
        frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested,
  ).length;
  const filteredAwaitingReplyCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.requiresExternalResponse,
  ).length;
  const filteredConfirmationPendingCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.externalStatusValue ===
        frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending,
  ).length;
  const filteredRescheduleRequestedCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.externalStatusValue ===
        frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested,
  ).length;
  const filteredTouchDueCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.isExternalTouchDue,
  ).length;
  const filteredMissingTouchPlanCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.needsNextTouchPlan,
  ).length;
  const filteredConfirmedCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.externalStatusValue ===
      frontOfficeAppointmentExternalWorkflowStatuses.confirmed,
  ).length;
  const filteredBridgePendingCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.hasBridgeActivity &&
      appointment.externalStatusValue ===
        frontOfficeAppointmentExternalWorkflowStatuses.idle,
  ).length;

  return {
    summary: {
      upcomingCount,
      todayCount,
      showingCount,
      handoffReadyCount,
      awaitingReplyCount,
      confirmationPendingCount,
      rescheduleRequestedCount,
      touchDueCount,
      missingTouchPlanCount,
      bridgedCount,
    },
    filteredSummary: {
      appointmentCount: appointmentRecords.length,
      awaitingReplyCount: filteredAwaitingReplyCount,
      confirmationPendingCount: filteredConfirmationPendingCount,
      rescheduleRequestedCount: filteredRescheduleRequestedCount,
      touchDueCount: filteredTouchDueCount,
      missingTouchPlanCount: filteredMissingTouchPlanCount,
      confirmedCount: filteredConfirmedCount,
      bridgePendingCount: filteredBridgePendingCount,
    },
    typeOptions: frontOfficeAppointmentTypeDefinitions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    clientOptions: buildDedupedFrontOfficeAppointmentOptions(
      [selectedClient, ...clients]
        .filter(isPresent)
        .map((client) => ({
          value: client.id,
          label: `${client.fullName} · ${client.stage}`,
        })),
    ),
    listingOptions: buildDedupedFrontOfficeAppointmentOptions(
      [selectedListing, ...listings]
        .filter(isPresent)
        .map((listing) => ({
          value: listing.id,
          label: `${listing.title} · ${listing.neighborhood}, ${listing.city}`,
        })),
    ),
    appointments: appointmentRecords,
    selectedAppointment,
    handoffs: handoffs.map((draft) => ({
      id: draft.id,
      clientName: draft.client.fullName,
      stageLabel: draft.stageLabel,
      summary:
        draft.summary?.trim() ||
        `${draft.client.fullName} is ready for formal transaction workflow.`,
      href: buildFrontOfficeHandoffCreateHref(draft.id),
    })),
  };
}

export async function createFrontOfficeAppointment(
  input: CreateFrontOfficeAppointmentInput,
): Promise<FrontOfficeAppointmentRecord> {
  const type = isAppointmentType(input.type)
    ? input.type
    : AppointmentType.showing;
  const startsAt = parseRequiredDate(input.startsAt, "Start time");
  const endsAt = parseOptionalDate(input.endsAt);
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);

  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw new Error("End time cannot be earlier than start time.");
  }

  const [client, listing] = await Promise.all([
    input.clientId
      ? prisma.client.findFirst({
          where: {
            id: input.clientId,
            organizationId: input.organizationId,
            ownerMembershipId: input.ownerMembershipId,
          },
          select: {
            id: true,
            fullName: true,
          },
        })
      : Promise.resolve(null),
    input.listingId
      ? prisma.listing.findFirst({
          where: {
            id: input.listingId,
            organizationId: input.organizationId,
            ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
          },
          select: {
            id: true,
            title: true,
            neighborhood: true,
            city: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (input.clientId && !client) {
    throw new Error(
      "Selected client is not available in your Front Office scope.",
    );
  }

  if (input.listingId && !listing) {
    throw new Error(
      "Selected listing is not available in the current office scope.",
    );
  }

  const title =
    input.title?.trim() ||
    buildDefaultAppointmentTitle(type, client?.fullName, listing?.title);
  const appointment = await prisma.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        ownerMembershipId: input.ownerMembershipId,
        clientId: client?.id ?? null,
        listingId: listing?.id ?? null,
        type,
        status: AppointmentStatus.scheduled,
        title,
        startsAt,
        endsAt,
        location: input.location?.trim() || null,
        meetingUrl: input.meetingUrl?.trim() || null,
        contactLabel: input.contactLabel?.trim() || null,
        notes: input.notes?.trim() || null,
        metadata: Prisma.JsonNull,
      },
      select: appointmentSelect,
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? input.ownerMembershipId,
      entityType: "appointment",
      entityId: created.id,
      action: activityLogActions.appointmentCreated,
      payload: {
        officeId: input.officeId ?? null,
        ...(created.client?.id ? { contactId: created.client.id } : {}),
        ...(created.client?.fullName
          ? { contactName: created.client.fullName }
          : {}),
        objectLabel: `${created.title}${created.client?.fullName ? ` · ${created.client.fullName}` : ""}`,
        details: [
          `Type: ${findAppointmentTypeDefinition(created.type)?.label ?? "Appointment"}`,
          `Status: ${findAppointmentStatusDefinition(created.status)?.label ?? "Scheduled"}`,
          `Starts: ${formatDateTimeLabel(created.startsAt, { timeZone: null })}`,
          ...(created.location?.trim()
            ? [`Location: ${created.location.trim()}`]
            : []),
          ...(created.meetingUrl?.trim()
            ? [`Meeting link: ${created.meetingUrl.trim()}`]
            : []),
          ...(created.listing ? [`Listing: ${created.listing.title}`] : []),
        ],
      },
    });

    return created;
  });

  return mapAppointmentRecord(appointment, new Date(), null);
}

export async function updateFrontOfficeAppointmentStatus(
  input: UpdateFrontOfficeAppointmentStatusInput,
): Promise<FrontOfficeAppointmentRecord | null> {
  const hasStatusUpdateInput = Boolean(input.status?.trim());
  const hasExternalUpdateInput = [
    input.externalStatus,
    input.externalNote,
    input.externalNextActionAt,
  ].some((value) => typeof value === "string" && value.trim().length > 0);

  if (hasStatusUpdateInput && hasExternalUpdateInput) {
    throw new Error(
      "Submit either an appointment status update or an external coordination writeback, not both.",
    );
  }

  if (
    input.status != null &&
    input.status !== "" &&
    !isAppointmentStatus(input.status)
  ) {
    throw new Error("A valid appointment status is required.");
  }

  if (
    input.externalStatus != null &&
    input.externalStatus !== "" &&
    !isFrontOfficeAppointmentExternalWorkflowStatus(input.externalStatus)
  ) {
    throw new Error(
      "A valid appointment external workflow status is required.",
    );
  }

  const nextStatus = isAppointmentStatus(input.status) ? input.status : null;
  const nextExternalStatus = isFrontOfficeAppointmentExternalWorkflowStatus(
    input.externalStatus,
  )
    ? input.externalStatus
    : null;
  const nextExternalNote = input.externalNote?.trim() || null;
  const nextExternalActionAt = parseOptionalDateTimeInput(
    input.externalNextActionAt,
    "Next external touch",
  );

  if (!nextStatus && !nextExternalStatus) {
    throw new Error(
      "A valid appointment status or external workflow status is required.",
    );
  }

  if (
    nextExternalStatus === frontOfficeAppointmentExternalWorkflowStatuses.idle &&
    (nextExternalNote || nextExternalActionAt)
  ) {
    throw new Error(
      "Clear the external note and next-touch deadline when the appointment is set back to idle.",
    );
  }

  const existing = await prisma.appointment.findFirst({
    where: {
      id: input.appointmentId,
      organizationId: input.organizationId,
      ownerMembershipId: input.ownerMembershipId,
    },
    select: appointmentSelect,
  });

  if (!existing) {
    return null;
  }

  if (nextExternalStatus && existing.status !== AppointmentStatus.scheduled) {
    throw new Error(
      "External coordination can only be updated while the appointment is still scheduled in Acre.",
    );
  }

  const currentExternalWorkflow =
    parseFrontOfficeAppointmentExternalWorkflowMetadata(existing.metadata);
  const shouldUpdateStatus = Boolean(
    nextStatus && existing.status !== nextStatus,
  );
  const shouldUpdateExternalWorkflow = Boolean(
    nextExternalStatus &&
    (currentExternalWorkflow.status !== nextExternalStatus ||
      currentExternalWorkflow.note !== nextExternalNote ||
      currentExternalWorkflow.nextActionAt?.getTime() !==
        nextExternalActionAt?.getTime()),
  );

  if (!shouldUpdateStatus && !shouldUpdateExternalWorkflow) {
    return mapAppointmentRecord(existing, new Date(), input.timeZone ?? null);
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.appointment.update({
      where: {
        id: input.appointmentId,
      },
      data: {
        ...(shouldUpdateStatus && nextStatus ? { status: nextStatus } : {}),
        ...(shouldUpdateExternalWorkflow && nextExternalStatus
          ? {
              metadata: buildAppointmentMetadataWithExternalWorkflow({
                existingMetadata: existing.metadata,
                status: nextExternalStatus,
                updatedAt: now,
                note: nextExternalNote,
                nextActionAt: nextExternalActionAt,
              }),
            }
          : {}),
      },
      select: appointmentSelect,
    });

    if (
      saved.client?.id &&
      shouldUpdateStatus &&
      nextStatus === AppointmentStatus.completed
    ) {
      await tx.client.update({
        where: {
          id: saved.client.id,
        },
        data: {
          lastContactAt: now,
        },
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? input.ownerMembershipId,
      entityType: "appointment",
      entityId: saved.id,
      action: activityLogActions.appointmentUpdated,
      payload: {
        officeId: input.officeId ?? null,
        ...(saved.client?.id ? { contactId: saved.client.id } : {}),
        ...(saved.client?.fullName
          ? { contactName: saved.client.fullName }
          : {}),
        objectLabel: `${saved.title}${saved.client?.fullName ? ` · ${saved.client.fullName}` : ""}`,
        changes: [
          ...(shouldUpdateStatus && nextStatus
            ? [
                {
                  label: "Status",
                  previousValue:
                    findAppointmentStatusDefinition(existing.status)?.label ??
                    "Scheduled",
                  nextValue:
                    findAppointmentStatusDefinition(saved.status)?.label ??
                    "Scheduled",
                },
              ]
            : []),
          ...(shouldUpdateExternalWorkflow && nextExternalStatus
            ? [
                ...(currentExternalWorkflow.status !== nextExternalStatus
                  ? [
                      {
                        label: "External follow-up",
                        previousValue:
                          formatFrontOfficeAppointmentExternalWorkflowLabel(
                            currentExternalWorkflow.status,
                          ),
                        nextValue:
                          formatFrontOfficeAppointmentExternalWorkflowLabel(
                            nextExternalStatus,
                          ),
                      },
                    ]
                  : []),
                ...(currentExternalWorkflow.note !== nextExternalNote
                  ? [
                      {
                        label: "External note",
                        previousValue:
                          currentExternalWorkflow.note?.trim() || "None",
                        nextValue: nextExternalNote || "Cleared",
                      },
                    ]
                  : []),
                ...(currentExternalWorkflow.nextActionAt?.getTime() !==
                nextExternalActionAt?.getTime()
                  ? [
                      {
                        label: "Next external touch",
                        previousValue: currentExternalWorkflow.nextActionAt
                          ? formatDateTimeLabel(
                              currentExternalWorkflow.nextActionAt,
                              {
                                timeZone: input.timeZone ?? null,
                              },
                            )
                          : "None",
                        nextValue: nextExternalActionAt
                          ? formatDateTimeLabel(nextExternalActionAt, {
                              timeZone: input.timeZone ?? null,
                            })
                          : "Cleared",
                      },
                    ]
                  : []),
              ]
            : []),
        ],
        details: [
          `Starts: ${formatDateTimeLabel(saved.startsAt, {
            timeZone: input.timeZone ?? null,
          })}`,
          ...(saved.location?.trim()
            ? [`Location: ${saved.location.trim()}`]
            : []),
          ...(shouldUpdateExternalWorkflow && nextExternalStatus
            ? [
                `External coordination: ${formatFrontOfficeAppointmentExternalWorkflowLabel(
                  nextExternalStatus,
                )}`,
              ]
            : []),
          ...(shouldUpdateExternalWorkflow &&
          currentExternalWorkflow.note !== nextExternalNote
            ? [
                nextExternalNote
                  ? `Workflow note: ${nextExternalNote}`
                  : "Workflow note cleared",
              ]
            : []),
          ...(shouldUpdateExternalWorkflow &&
          currentExternalWorkflow.nextActionAt?.getTime() !==
            nextExternalActionAt?.getTime()
            ? [
                nextExternalActionAt
                  ? `Next external touch: ${formatDateTimeLabel(
                      nextExternalActionAt,
                      {
                        timeZone: input.timeZone ?? null,
                      },
                    )}`
                  : "Next external touch cleared",
              ]
            : []),
        ],
      },
    });

    return saved;
  });

  return mapAppointmentRecord(updated, new Date(), input.timeZone ?? null);
}

export async function getFrontOfficeAppointmentCalendarExport(
  input: GetFrontOfficeAppointmentCalendarExportInput,
): Promise<FrontOfficeAppointmentCalendarExport | null> {
  const result = await getFrontOfficeAppointmentBridgeResult({
    organizationId: input.organizationId,
    appointmentId: input.appointmentId,
    ownerMembershipId: input.ownerMembershipId,
    actorMembershipId: input.actorMembershipId ?? input.ownerMembershipId,
    officeId: input.officeId ?? null,
    timeZone: input.timeZone ?? null,
    action: frontOfficeAppointmentBridgeActions.icsDownload,
  });

  if (!result || result.kind !== "calendar_export") {
    return null;
  }

  return {
    fileName: result.fileName,
    content: result.content,
  };
}

export async function getFrontOfficeAppointmentBridgeResult(
  input: GetFrontOfficeAppointmentBridgeResultInput,
): Promise<FrontOfficeAppointmentBridgeResult | null> {
  if (!isFrontOfficeAppointmentBridgeAction(input.action)) {
    throw new Error("A valid appointment bridge action is required.");
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: input.appointmentId,
      organizationId: input.organizationId,
      ownerMembershipId: input.ownerMembershipId,
    },
    select: appointmentSelect,
  });

  if (!appointment) {
    return null;
  }

  if (appointment.status !== AppointmentStatus.scheduled) {
    throw new Error(
      "Only scheduled appointments can open the external bridge from Acre.",
    );
  }

  const appointmentTypeLabel =
    findAppointmentTypeDefinition(appointment.type)?.label ?? "Appointment";
  const appointmentStatusLabel =
    findAppointmentStatusDefinition(appointment.status)?.label ?? "Scheduled";
  const externalWorkflow = getFrontOfficeAppointmentExternalWorkflowState({
    metadata: appointment.metadata,
    timeZone: input.timeZone ?? null,
  });
  const externalStatusLabel =
    externalWorkflow.value ===
    frontOfficeAppointmentExternalWorkflowStatuses.idle
      ? null
      : externalWorkflow.label;
  const emailRecipient = extractFrontOfficeAppointmentEmailRecipient({
    clientEmail: appointment.client?.email,
    contactLabel: appointment.contactLabel,
  });

  const externalTargets = buildFrontOfficeAppointmentExternalTargets({
    appointmentId: appointment.id,
    title: appointment.title,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    location: appointment.location,
    meetingUrl: appointment.meetingUrl,
    clientName: appointment.client?.fullName,
    clientEmail: appointment.client?.email,
    contactLabel: appointment.contactLabel,
    listingTitle: appointment.listing?.title,
    listingNeighborhood: appointment.listing?.neighborhood,
    listingCity: appointment.listing?.city,
    appointmentTypeLabel,
    appointmentStatusLabel,
    externalStatusLabel,
    externalNote: externalWorkflow.note,
    externalNextActionAtLabel: externalWorkflow.nextActionAt
      ? externalWorkflow.nextActionAtLabel
      : null,
    timeZone: input.timeZone ?? null,
  });
  const result: FrontOfficeAppointmentBridgeResult =
    input.action === frontOfficeAppointmentBridgeActions.googleCalendar
      ? {
          kind: "redirect",
          href: externalTargets.googleCalendarHref,
        }
      : input.action === frontOfficeAppointmentBridgeActions.outlookCalendar
        ? {
            kind: "redirect",
            href: externalTargets.outlookCalendarHref,
          }
        : input.action === frontOfficeAppointmentBridgeActions.emailBrief
          ? externalTargets.emailBriefHref
            ? {
                kind: "redirect",
                href: externalTargets.emailBriefHref,
              }
            : (() => {
                throw new Error(
                  "An email target is required before opening the appointment email brief.",
                );
              })()
          : {
              kind: "calendar_export",
              ...buildFrontOfficeAppointmentCalendarExport({
                appointmentId: appointment.id,
                title: appointment.title,
                startsAt: appointment.startsAt,
                endsAt: appointment.endsAt,
                location: appointment.location,
                meetingUrl: appointment.meetingUrl,
                clientName: appointment.client?.fullName,
                clientEmail: appointment.client?.email,
                contactLabel: appointment.contactLabel,
                listingTitle: appointment.listing?.title,
                listingNeighborhood: appointment.listing?.neighborhood,
                listingCity: appointment.listing?.city,
                appointmentTypeLabel,
                appointmentStatusLabel,
                externalStatusLabel,
                externalNote: externalWorkflow.note,
                externalNextActionAtLabel: externalWorkflow.nextActionAt
                  ? externalWorkflow.nextActionAtLabel
                  : null,
                timeZone: input.timeZone ?? null,
              }),
            };

  await prisma.$transaction(async (tx) => {
    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? input.ownerMembershipId,
      entityType: "appointment",
      entityId: appointment.id,
      action: activityLogActions.appointmentBridgeOpened,
      payload: {
        officeId: input.officeId ?? null,
        ...(appointment.client?.id ? { contactId: appointment.client.id } : {}),
        ...(appointment.client?.fullName
          ? { contactName: appointment.client.fullName }
          : {}),
        objectLabel: `${appointment.title}${appointment.client?.fullName ? ` · ${appointment.client.fullName}` : ""}`,
        contextHref: appointment.client?.id
          ? `/agent/clients/${appointment.client.id}`
          : "/agent/calendar",
        actionSource: "front_office_appointment_bridge",
        workflowReason: input.action,
        details: [
          `Bridge target: ${formatFrontOfficeAppointmentBridgeActionLabel(input.action)}`,
          `Appointment type: ${appointmentTypeLabel}`,
          `Acre status: ${appointmentStatusLabel}`,
          `Starts: ${formatDateTimeLabel(appointment.startsAt, {
            timeZone: input.timeZone ?? null,
          })}`,
          ...(externalStatusLabel
            ? [`External coordination: ${externalStatusLabel}`]
            : ["External coordination: No writeback saved yet"]),
          ...(externalWorkflow.nextActionAt
            ? [`Next external touch: ${externalWorkflow.nextActionAtLabel}`]
            : []),
          ...(externalWorkflow.note
            ? [`Writeback note: ${externalWorkflow.note}`]
            : []),
          ...(appointment.location?.trim()
            ? [`Location: ${appointment.location.trim()}`]
            : []),
          ...(appointment.meetingUrl?.trim()
            ? [`Meeting link: ${appointment.meetingUrl.trim()}`]
            : []),
          ...(input.action === frontOfficeAppointmentBridgeActions.emailBrief &&
          emailRecipient
            ? [`Email: ${emailRecipient}`]
            : []),
          ...(appointment.listing?.title
            ? [`Listing: ${appointment.listing.title}`]
            : []),
        ],
      },
    });
  });

  return result;
}
