import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  ListingStatus,
  Prisma,
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import {
  formatDateTimeInputValue,
  formatDateTimeLabel,
} from "./date-time";
import {
  buildFrontOfficeAppointmentCalendarExport,
  buildFrontOfficeAppointmentExternalLinks,
  buildFrontOfficeAppointmentExternalTargets,
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
  statusValue: AppointmentStatus;
  typeLabel: string;
  typeTone: FrontOfficeAppointmentTone;
  statusLabel: string;
  statusTone: FrontOfficeAppointmentTone;
  reminderLabel: string;
  reminderTone: FrontOfficeAppointmentTone;
  startsAtLabel: string;
  locationLabel: string;
  clientLabel: string;
  listingLabel: string;
  notesLabel: string;
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
  bridgeStatusLabel: string;
  bridgeStatusDetail: string;
  bridgeStatusTone: FrontOfficeAppointmentTone;
  bridgeActionLabel: string;
  bridgeLoggedAtLabel: string;
  hasBridgeActivity: boolean;
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
    touchDueCount: number;
    bridgedCount: number;
  };
  typeOptions: FrontOfficeAppointmentOption[];
  clientOptions: FrontOfficeAppointmentOption[];
  listingOptions: FrontOfficeAppointmentOption[];
  appointments: FrontOfficeAppointmentRecord[];
  handoffs: FrontOfficeAppointmentHandoffItem[];
};

export type GetFrontOfficeAppointmentsSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
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

const appointmentExternalWorkflowMetadataKey =
  "frontOfficeExternalWorkflow";

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
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

function isFrontOfficeAppointmentExternalWorkflowStatus(
  value: string | null | undefined,
): value is FrontOfficeAppointmentExternalWorkflowStatus {
  return Object.values(frontOfficeAppointmentExternalWorkflowStatuses).includes(
    value as FrontOfficeAppointmentExternalWorkflowStatus,
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
    note: typeof noteValue === "string" && noteValue.trim() ? noteValue.trim() : null,
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

function parseAppointmentBridgeActionFromPayload(payload: Prisma.JsonValue | null) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const bridgeAction = "bridgeAction" in payload ? payload.bridgeAction : null;
  const workflowReason = "workflowReason" in payload ? payload.workflowReason : null;

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

export async function getFrontOfficeAppointmentBridgeStatusMap(input: {
  organizationId: string;
  appointmentIds: string[];
  timeZone?: string | null;
}) {
  const uniqueAppointmentIds = [...new Set(input.appointmentIds.filter(Boolean))];

  if (!uniqueAppointmentIds.length) {
    return new Map<string, FrontOfficeAppointmentBridgeStatus>();
  }

  const bridgeLogs = await prisma.auditLog.findMany({
    where: {
      organizationId: input.organizationId,
      entityType: "appointment",
      entityId: {
        in: uniqueAppointmentIds,
      },
      action: activityLogActions.appointmentBridgeOpened,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      entityId: true,
      createdAt: true,
      payload: true,
    },
  });
  const latestBridgeActionMap = new Map<
    string,
    FrontOfficeAppointmentLatestBridgeAction
  >();

  for (const log of bridgeLogs) {
    if (latestBridgeActionMap.has(log.entityId)) {
      continue;
    }

    const action = parseAppointmentBridgeActionFromPayload(log.payload);

    if (!action) {
      continue;
    }

    latestBridgeActionMap.set(log.entityId, {
      action,
      createdAt: log.createdAt,
    });
  }

  return new Map(
    uniqueAppointmentIds.map((appointmentId) => [
      appointmentId,
      buildFrontOfficeAppointmentBridgeStatus(
        latestBridgeActionMap.get(appointmentId),
        input.timeZone,
      ),
    ]),
  );
}

function mapAppointmentRecord(
  appointment: Prisma.AppointmentGetPayload<{
    select: typeof appointmentSelect;
  }>,
  now: Date,
  timeZone?: string | null,
  bridgeStatus?: FrontOfficeAppointmentBridgeStatus | null,
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
  const resolvedBridgeStatus = bridgeStatus
    ? bridgeStatus
    : buildFrontOfficeAppointmentBridgeStatus(null, timeZone);
  const coordination = buildFrontOfficeAppointmentCoordinationSummary({
    appointmentStatus: appointment.status,
    appointmentStatusLabel: statusLabel,
    appointmentStatusTone: statusTone,
    now,
    externalWorkflow,
    bridgeStatus: resolvedBridgeStatus,
  });

  return {
    id: appointment.id,
    title: appointment.title,
    clientId: appointment.client?.id ?? null,
    statusValue: appointment.status,
    typeLabel,
    typeTone: mapAppointmentTypeTone(appointment.type),
    statusLabel,
    statusTone,
    reminderLabel: reminder.label,
    reminderTone: reminder.tone,
    startsAtLabel: formatDateTimeLabel(appointment.startsAt, { timeZone }),
    locationLabel: meetingOrLocation,
    clientLabel,
    listingLabel,
    notesLabel,
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
    bridgeStatusLabel: resolvedBridgeStatus.label,
    bridgeStatusDetail: resolvedBridgeStatus.detail,
    bridgeStatusTone: resolvedBridgeStatus.tone,
    bridgeActionLabel: resolvedBridgeStatus.actionLabel,
    bridgeLoggedAtLabel: resolvedBridgeStatus.loggedAtLabel,
    hasBridgeActivity: resolvedBridgeStatus.hasBridgeActivity,
  };
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
    listings,
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
      take: 24,
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
    ? appointments.some((appointment) => appointment.id === targetedAppointment.id)
      ? appointments
      : [...appointments, targetedAppointment]
    : appointments;
  visibleAppointments.sort((left, right) => {
    if (left.startsAt.getTime() !== right.startsAt.getTime()) {
      return left.startsAt.getTime() - right.startsAt.getTime();
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
  const appointmentBridgeStatusMap =
    await getFrontOfficeAppointmentBridgeStatusMap({
      organizationId: input.organizationId,
      appointmentIds: visibleAppointments.map((appointment) => appointment.id),
      timeZone: input.timeZone,
    });
  const appointmentRecords = visibleAppointments.map((appointment) =>
    mapAppointmentRecord(
      appointment,
      now,
      input.timeZone,
      appointmentBridgeStatusMap.get(appointment.id) ?? null,
    ),
  );
  const awaitingReplyCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.requiresExternalResponse,
  ).length;
  const touchDueCount = appointmentRecords.filter(
    (appointment) =>
      appointment.statusValue === AppointmentStatus.scheduled &&
      appointment.isExternalTouchDue,
  ).length;
  const bridgedCount = appointmentRecords.filter(
    (appointment) => appointment.hasBridgeActivity,
  ).length;

  return {
    summary: {
      upcomingCount,
      todayCount,
      showingCount,
      handoffReadyCount,
      awaitingReplyCount,
      touchDueCount,
      bridgedCount,
    },
    typeOptions: frontOfficeAppointmentTypeDefinitions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    clientOptions: clients.map((client) => ({
      value: client.id,
      label: `${client.fullName} · ${client.stage}`,
    })),
    listingOptions: listings.map((listing) => ({
      value: listing.id,
      label: `${listing.title} · ${listing.neighborhood}, ${listing.city}`,
    })),
    appointments: appointmentRecords,
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
    throw new Error("A valid appointment external workflow status is required.");
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
                `External workflow: ${formatFrontOfficeAppointmentExternalWorkflowLabel(
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

  const appointmentTypeLabel =
    findAppointmentTypeDefinition(appointment.type)?.label ?? "Appointment";
  const appointmentStatusLabel =
    findAppointmentStatusDefinition(appointment.status)?.label ?? "Scheduled";
  const externalWorkflow = getFrontOfficeAppointmentExternalWorkflowState({
    metadata: appointment.metadata,
    timeZone: input.timeZone ?? null,
  });
  const externalStatusLabel =
    externalWorkflow.value === frontOfficeAppointmentExternalWorkflowStatuses.idle
      ? null
      : externalWorkflow.label;

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
                  "Client email is required before opening the appointment email brief.",
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
          appointment.client?.email?.trim()
            ? [`Email: ${appointment.client.email.trim()}`]
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
