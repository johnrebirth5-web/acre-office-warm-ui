import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  FrontOfficeSendChannel,
  FrontOfficeSendMaterialType,
  IncomingUpdateStatus,
  SignatureRequestStatus,
  TaskStatus,
  TransactionStatus,
  TransactionTaskStatus,
} from "@prisma/client";

import { prisma } from "../client";

import {
  buildFrontOfficeHandoffCreateHref,
  buildFrontOfficeHandoffSummary,
  isFrontOfficeStageReadyForBackOffice,
} from "../front-office-contracts";

import {
  buildFrontOfficeAiAcceptedActionBreakdown,
  buildFrontOfficeAiAcceptedActionBreakdownWindows,
  buildFrontOfficeAiBoundaryContract,
  buildFrontOfficeAiFollowUpAction,
  buildFrontOfficeAiSuggestionHistoryIndex,
  buildFrontOfficeAiStrategyContract,
  buildFrontOfficeAiSuggestionInsight,
  formatFrontOfficeAiActionTypeLabel,
  formatFrontOfficeAiSourceSurfaceLabel,
  mapFrontOfficeAiAcceptedActionOutcome,
  type FrontOfficeAiFollowUpKind,
  type FrontOfficeAiStrategyContract,
  type FrontOfficeAiSuggestionHistoryIndex,
} from "../front-office-ai";

import { formatDateTimeLabel } from "../date-time";

import { buildFrontOfficeAppointmentExternalLinks } from "../front-office-calendar-links";

import {
  getFrontOfficeAppointmentBridgeStatusMap,
  getFrontOfficeAppointmentExternalWorkflowState,
  frontOfficeAppointmentExternalWorkflowStatuses,
  type FrontOfficeAppointmentBridgeStatus,
  type FrontOfficeAppointmentExternalWorkflowStatus,
} from "../front-office-appointments";

import {
  defaultLeaseReminderLeadDays,
  resolveLeaseReminderDates,
} from "../lease-reminders";

import { listTransactionOffersSnapshot } from "../offers";

import { FrontOfficeClientDetailAction, FrontOfficeClientDetailActionKind, FrontOfficeClientDetailActionTarget, FrontOfficeClientDetailAiAcceptedActionItem, FrontOfficeClientDetailAiAcceptedActions, FrontOfficeClientDetailAiDraft, FrontOfficeClientDetailAiDraftChannel, FrontOfficeClientDetailAiFollowUpSuggestion, FrontOfficeClientDetailAiStrategy, FrontOfficeClientDetailAiSuggestions, FrontOfficeClientDetailAppointmentItem, FrontOfficeClientDetailBackOfficeHandoff, FrontOfficeClientDetailBoundaryState, FrontOfficeClientDetailBridgeActivityState, FrontOfficeClientDetailClosing, FrontOfficeClientDetailClosingItem, FrontOfficeClientDetailContract, FrontOfficeClientDetailDecisionKey, FrontOfficeClientDetailFollowUpCue, FrontOfficeClientDetailFollowUpCueKey, FrontOfficeClientDetailHandoffItem, FrontOfficeClientDetailHandoffState, FrontOfficeClientDetailInspection, FrontOfficeClientDetailInspectionItem, FrontOfficeClientDetailLeaseReminder, FrontOfficeClientDetailNegotiation, FrontOfficeClientDetailNegotiationOfferItem, FrontOfficeClientDetailNextStepId, FrontOfficeClientDetailNextStepRail, FrontOfficeClientDetailNextStepRailItem, FrontOfficeClientDetailOutputHandoff, FrontOfficeClientDetailOwnershipKey, FrontOfficeClientDetailPlaybook, FrontOfficeClientDetailPlaybookItem, FrontOfficeClientDetailPlaybookObjection, FrontOfficeClientDetailPlaybookTemplate, FrontOfficeClientDetailSendEngagementKey, FrontOfficeClientDetailSendRecordItem, FrontOfficeClientDetailSnapshot, FrontOfficeClientDetailStageHistoryItem, FrontOfficeClientDetailTaskItem, FrontOfficeClientDetailTone, FrontOfficeClientDetailTransactionItem, FrontOfficeClientDetailWorkbenchReturn, FrontOfficeClientDetailWorkflowNextStepKey, FrontOfficeClientDetailWorkflowPressureKey, FrontOfficeClientDetailWorkflowSignal, GetFrontOfficeClientDetailInput, frontOfficeClientDetailActionKinds, frontOfficeClientDetailActionTargets, frontOfficeClientDetailBoundaryStates, frontOfficeClientDetailBridgeActivityStates, frontOfficeClientDetailDecisionKeys, frontOfficeClientDetailFollowUpCueKeys, frontOfficeClientDetailHandoffStates, frontOfficeClientDetailNextStepIds, frontOfficeClientDetailOwnershipKeys, frontOfficeClientDetailSendEngagementKeys, frontOfficeClientDetailWorkflowNextStepKeys, frontOfficeClientDetailWorkflowPressureKeys } from "./types";
import { buildFrontOfficeAiSuggestions, buildFrontOfficePlaybook } from "./playbook";
import { buildClientPdfHref, buildDossierContract, buildFollowUpCue, buildFrontOfficeClientDetailWorkbenchReturn, buildFrontOfficeFollowUpAction, buildNextStepRail, buildOfferWorkspaceHref, buildTransactionContextMetaLabel, buildTransactionLocationLabel, buildTransactionWorkspaceHref, buildWorkflowSignal, formatHandoffStatusLabel, formatIncomingUpdateStatusLabel, formatSignatureRequestStatusLabel, formatTransactionStatusLabel, formatTransactionTaskStatusLabel, getDayDifferenceFromToday, getFrontOfficeClientDetailWorkbenchDescription, getFrontOfficeClientDetailWorkbenchHref, getFrontOfficeClientDetailWorkbenchLabel, mapHandoffTone, mapIncomingUpdateTone, mapOfferStatusTone, mapSignatureRequestTone, mapTransactionTaskTone } from "./dossier";
import { getFrontOfficeClientDetail } from "./detail";

export function formatCurrency(value: number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}



export function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
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



export function formatDateLabel(
  value: Date | null | undefined,
  timeZone?: string | null,
) {
  if (!value) {
    return "—";
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone ?? undefined,
  });
}



export function formatDateValue(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}



export function formatDateTimeValue(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString();
}



export function getCalendarDayDifference(value: Date, now: Date) {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfValue = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();

  return Math.round((startOfValue - startOfToday) / 86_400_000);
}



export function formatCalendarDistanceLabel(value: Date, now: Date) {
  const dayDifference = getCalendarDayDifference(value, now);

  if (dayDifference < 0) {
    const overdueDays = Math.abs(dayDifference);
    return overdueDays === 1
      ? "Overdue by 1 day"
      : `Overdue by ${overdueDays} days`;
  }

  if (dayDifference === 0) {
    return "Due today";
  }

  if (dayDifference === 1) {
    return "Due tomorrow";
  }

  if (dayDifference <= 7) {
    return `Due in ${dayDifference} days`;
  }

  return "Upcoming";
}



export function buildClientAction(input: {
  label: string;
  href: string;
  kind: FrontOfficeClientDetailActionKind;
  target: FrontOfficeClientDetailActionTarget;
  opensInNewTab?: boolean;
}): FrontOfficeClientDetailAction {
  return {
    label: input.label,
    href: input.href,
    opensInNewTab: input.opensInNewTab ?? false,
    kind: input.kind,
    target: input.target,
  };
}



export const frontOfficeCalendarViews = {
  replyDue: "reply_due",
  confirmationPending: "confirmation_pending",
  confirmed: "confirmed",
  touchDue: "touch_due",
  missingNextTouch: "missing_next_touch",
  rescheduleRequested: "reschedule_requested",
  bridgeLogged: "bridge_logged",
} as const;



export type FrontOfficeCalendarView =
  (typeof frontOfficeCalendarViews)[keyof typeof frontOfficeCalendarViews];



export const frontOfficeListingsLanes = {
  sendRescue: "send-rescue",
  followThrough: "follow-through",
  draftLane: "draft-lane",
} as const;



export type FrontOfficeListingsLane =
  (typeof frontOfficeListingsLanes)[keyof typeof frontOfficeListingsLanes];



export function buildClientRouteHref(
  path: string,
  params: Array<[string, string | null | undefined]>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of params) {
    if (value && value.trim()) {
      searchParams.set(key, value.trim());
    }
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}



export function buildFrontOfficeCalendarHref(input: {
  clientId: string;
  appointmentId?: string | null;
  calendarView?: FrontOfficeCalendarView | null;
}) {
  return buildClientRouteHref("/agent/calendar", [
    ["calendarView", input.calendarView ?? null],
    ["clientId", input.clientId],
    ["appointmentId", input.appointmentId ?? null],
  ]);
}



export function buildFrontOfficeListingsHref(input: {
  clientId: string;
  appointmentId?: string | null;
  lane?: FrontOfficeListingsLane | null;
}) {
  return input.appointmentId
    ? buildFrontOfficeCalendarHref({
        clientId: input.clientId,
        appointmentId: input.appointmentId,
        calendarView: frontOfficeCalendarViews.bridgeLogged,
      })
    : `/agent/clients/${input.clientId}#front-office-client-next-step-rail`;
}



export function resolveFrontOfficeCalendarView(input: {
  bridgeActivityState?: FrontOfficeClientDetailBridgeActivityState;
  externalStatusValue?: FrontOfficeAppointmentExternalWorkflowStatus | null;
  hasBridgeActivity: boolean;
  hasNextAction: boolean;
  isExternalTouchDue: boolean;
}): FrontOfficeCalendarView | null {
  if (input.bridgeActivityState === "logged" || input.hasBridgeActivity) {
    return frontOfficeCalendarViews.bridgeLogged;
  }

  switch (input.externalStatusValue) {
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmed:
      return frontOfficeCalendarViews.confirmed;
    case frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested:
      return frontOfficeCalendarViews.rescheduleRequested;
    case frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending:
      return frontOfficeCalendarViews.confirmationPending;
    case frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp:
      return frontOfficeCalendarViews.replyDue;
    default:
      if (input.isExternalTouchDue) {
        return frontOfficeCalendarViews.touchDue;
      }

      if (input.hasNextAction) {
        return null;
      }

      return frontOfficeCalendarViews.missingNextTouch;
  }
}



export function resolveNextStepRailCalendarView(input: {
  hasUpcomingAppointment: boolean;
  nextTouchAt: Date | null;
  openTaskCount: number;
  now: Date;
}): FrontOfficeCalendarView | null {
  if (input.hasUpcomingAppointment) {
    return frontOfficeCalendarViews.confirmationPending;
  }

  if (input.nextTouchAt && input.nextTouchAt.getTime() <= input.now.getTime()) {
    return frontOfficeCalendarViews.touchDue;
  }

  if (!input.nextTouchAt && input.openTaskCount === 0) {
    return frontOfficeCalendarViews.missingNextTouch;
  }

  return null;
}



export function resolveFrontOfficeListingsLane(input: {
  openCount: number;
  appointmentId?: string | null;
  hasListingContext: boolean;
  latestEngagementKey?: FrontOfficeClientDetailSendEngagementKey | null;
}) {
  if (
    input.openCount > 0 ||
    input.latestEngagementKey === "opened" ||
    input.latestEngagementKey === "revisited"
  ) {
    return frontOfficeListingsLanes.followThrough;
  }

  if (input.hasListingContext || input.appointmentId) {
    return frontOfficeListingsLanes.sendRescue;
  }

  return frontOfficeListingsLanes.draftLane;
}



export const FRONT_OFFICE_FOLLOW_UP_FORM_ID = "front-office-follow-up-form";


export const FRONT_OFFICE_FOLLOW_UP_QUEUE_ID = "front-office-follow-up-queue";



export function pickEarliestDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((earliest, value) => {
    if (!value) {
      return earliest;
    }

    if (!earliest || value.getTime() < earliest.getTime()) {
      return value;
    }

    return earliest;
  }, null);
}



export function buildLeaseReminderSnapshot(input: {
  leaseEndDate: Date | null;
  leaseReminderAt: Date | null;
  now: Date;
  timeZone?: string | null;
}): FrontOfficeClientDetailLeaseReminder {
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
    const helperText =
      "Add the lease end date and reminder date when this client needs renewal, remarketing, or move planning to stay visible in Front Office.";

    return {
      leaseEndDateValue: formatDateValue(leaseDates.leaseEndDate),
      leaseEndDateLabel: leaseDates.leaseEndDate
        ? formatDateLabel(leaseDates.leaseEndDate, input.timeZone)
        : "No lease end date captured",
      reminderAtValue: "",
      reminderAtLabel: "Not scheduled",
      statusLabel: "No lease reminder",
      statusTone: "neutral",
      helperText,
      isAutoScheduled: false,
      needsAttention: false,
      timelineAtLabel: "No reminder on calendar",
      timelineAtValue: "",
      timelineTitle: leaseDates.leaseEndDate
        ? "Lease timing captured but follow-up is not scheduled"
        : "No lease timing is scheduled yet",
      timelineDescription: helperText,
    };
  }

  let statusLabel = "Reminder scheduled";
  let statusTone: FrontOfficeClientDetailTone = "success";
  let helperText = leaseDates.leaseEndDate
    ? `Lease ends ${formatDateLabel(leaseDates.leaseEndDate, input.timeZone)}.`
    : "Lease reminder is on the calendar.";
  let needsAttention = false;

  if (leaseDates.leaseReminderAt.getTime() < startOfToday.getTime()) {
    statusLabel = "Reminder overdue";
    statusTone = "danger";
    helperText = leaseDates.leaseEndDate
      ? `Lease ended or will end ${formatDateLabel(leaseDates.leaseEndDate, input.timeZone)}. Renewal or remarketing follow-up should already be underway.`
      : `This lease reminder slipped past ${formatDateLabel(leaseDates.leaseReminderAt, input.timeZone)}.`;
    needsAttention = true;
  } else if (leaseDates.leaseReminderAt.getTime() < startOfTomorrow.getTime()) {
    statusLabel = "Reminder due today";
    statusTone = "warning";
    helperText = leaseDates.leaseEndDate
      ? `Lease ends ${formatDateLabel(leaseDates.leaseEndDate, input.timeZone)}. Make the renewal or move-out touch today.`
      : "Make the lease follow-up today so this client does not go quiet.";
    needsAttention = true;
  } else if (
    leaseDates.leaseReminderAt.getTime() <= fourteenDaysFromNow.getTime()
  ) {
    statusLabel = "Reminder due soon";
    statusTone = "accent";
    helperText = leaseDates.leaseEndDate
      ? `Lease ends ${formatDateLabel(leaseDates.leaseEndDate, input.timeZone)}. Use the next two weeks to confirm renewal, remarketing, or move plans.`
      : "A lease-related touch is coming up soon. Confirm the outreach plan before it is late.";
  }

  if (leaseDates.isAutoScheduled && leaseDates.leaseEndDate) {
    helperText = `${helperText} Acre auto-scheduled this reminder ${defaultLeaseReminderLeadDays} days before the lease end date.`;
  }

  const timelineTitle = needsAttention
    ? "Lease renewal follow-up needs attention now"
    : "Lease timing is already on the calendar";
  const timelineDescription = leaseDates.leaseEndDate
    ? `Reminder ${formatDateLabel(
        leaseDates.leaseReminderAt,
        input.timeZone,
      )} supports the lease ending ${formatDateLabel(
        leaseDates.leaseEndDate,
        input.timeZone,
      )}. ${helperText}`
    : helperText;

  return {
    leaseEndDateValue: formatDateValue(leaseDates.leaseEndDate),
    leaseEndDateLabel: leaseDates.leaseEndDate
      ? formatDateLabel(leaseDates.leaseEndDate, input.timeZone)
      : "No lease end date captured",
    reminderAtValue: formatDateValue(leaseDates.leaseReminderAt),
    reminderAtLabel: formatDateLabel(
      leaseDates.leaseReminderAt,
      input.timeZone,
    ),
    statusLabel,
    statusTone,
    helperText,
    isAutoScheduled: leaseDates.isAutoScheduled,
    needsAttention,
    timelineAtLabel: formatRelativeDueLabel(
      leaseDates.leaseReminderAt,
      input.now,
      input.timeZone,
    ),
    timelineAtValue: formatDateTimeValue(leaseDates.leaseReminderAt),
    timelineTitle,
    timelineDescription,
  };
}



export function formatRelativeDueLabel(
  value: Date | null | undefined,
  now: Date,
  timeZone?: string | null,
) {
  if (!value) {
    return "No follow-up scheduled";
  }

  const distanceLabel = formatCalendarDistanceLabel(value, now);
  const needsTimeLabel = getCalendarDayDifference(value, now) === 0;

  return needsTimeLabel
    ? `${distanceLabel} · ${formatDateTimeLabel(value, {
        timeZone: timeZone ?? null,
      })}`
    : `${distanceLabel} · ${formatDateLabel(value, timeZone)}`;
}



export function mapSendEngagementKey(
  openCount: number,
): FrontOfficeClientDetailSendEngagementKey {
  if (openCount <= 0) {
    return frontOfficeClientDetailSendEngagementKeys.notOpened;
  }

  if (openCount === 1) {
    return frontOfficeClientDetailSendEngagementKeys.opened;
  }

  return frontOfficeClientDetailSendEngagementKeys.revisited;
}



export function mapBridgeActivityState(
  bridgeStatus: FrontOfficeAppointmentBridgeStatus | null | undefined,
): FrontOfficeClientDetailBridgeActivityState {
  return bridgeStatus?.hasBridgeActivity
    ? frontOfficeClientDetailBridgeActivityStates.logged
    : frontOfficeClientDetailBridgeActivityStates.idle;
}



export function mapClientStageTone(stage: string): FrontOfficeClientDetailTone {
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



export function mapAppointmentTypeTone(
  type: AppointmentType,
): FrontOfficeClientDetailTone {
  switch (type) {
    case AppointmentType.showing:
    case AppointmentType.open_house:
      return "accent";
    case AppointmentType.consultation:
      return "success";
    case AppointmentType.client_meeting:
      return "warning";
    default:
      return "neutral";
  }
}



export function mapAppointmentStatusTone(
  status: AppointmentStatus,
): FrontOfficeClientDetailTone {
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



export function formatAppointmentTypeLabel(type: AppointmentType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}



export function formatAppointmentStatusLabel(status: AppointmentStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}



export function mapTaskTone(
  status: TaskStatus,
  dueAt: Date | null,
  now: Date,
): FrontOfficeClientDetailTone {
  if (status === TaskStatus.completed) {
    return "success";
  }

  if (status === TaskStatus.canceled) {
    return "neutral";
  }

  if (!dueAt) {
    return "neutral";
  }

  const dayDifference = getCalendarDayDifference(dueAt, now);

  if (dayDifference < 0) {
    return "danger";
  }

  if (dayDifference === 0) {
    return "warning";
  }

  return "accent";
}



export function formatTaskStatusLabel(status: TaskStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}



export function formatTaskDueLabel(
  dueAt: Date | null,
  now: Date,
  timeZone?: string | null,
) {
  if (!dueAt) {
    return "No due date";
  }

  const distanceLabel = formatCalendarDistanceLabel(dueAt, now);
  return `${distanceLabel} · ${formatDateLabel(dueAt, timeZone)}`;
}



export function buildTaskQueueLabel(
  status: TaskStatus,
  dueAt: Date | null,
  now: Date,
) {
  if (status === TaskStatus.completed) {
    return "Closed out";
  }

  if (status === TaskStatus.canceled) {
    return "Canceled";
  }

  if (!dueAt) {
    return "Needs a date";
  }

  const dayDifference = getCalendarDayDifference(dueAt, now);

  if (dayDifference < 0) {
    return "Needs action now";
  }

  if (dayDifference === 0) {
    return "Today";
  }

  if (dayDifference === 1) {
    return "Tomorrow";
  }

  return "Upcoming";
}



export function buildTaskHelperLabel(input: {
  status: TaskStatus;
  dueAt: Date | null;
  assigneeLabel: string;
  now: Date;
}) {
  const details = [`Owner · ${input.assigneeLabel}`];

  if (input.status === TaskStatus.completed) {
    details.push("Resolved");
  } else if (input.status === TaskStatus.canceled) {
    details.push("No longer active");
  } else if (!input.dueAt) {
    details.push("Add a due date to keep workflow pressure accurate");
  } else {
    details.push(formatCalendarDistanceLabel(input.dueAt, input.now));
  }

  return details.join(" · ");
}



export function buildTaskTimelineTitle(input: {
  title: string;
  status: TaskStatus;
  needsAttention: boolean;
  dueAt: Date | null;
}) {
  if (input.status === TaskStatus.completed) {
    return `Resolved follow-up · ${input.title}`;
  }

  if (input.status === TaskStatus.canceled) {
    return `Canceled follow-up · ${input.title}`;
  }

  if (input.status === TaskStatus.in_progress) {
    return `In-progress follow-up · ${input.title}`;
  }

  if (input.needsAttention) {
    return `Follow-up due now · ${input.title}`;
  }

  if (input.dueAt) {
    return `Scheduled follow-up · ${input.title}`;
  }

  return `Undated follow-up · ${input.title}`;
}



export function buildTaskTimelineDescription(input: {
  status: TaskStatus;
  dueAt: Date | null;
  assigneeLabel: string;
  now: Date;
  timeZone?: string | null;
}) {
  const details: string[] = [];

  if (input.status === TaskStatus.completed) {
    details.push("Completed in the shared Front Office follow-up queue.");
  } else if (input.status === TaskStatus.canceled) {
    details.push("Canceled out of the shared Front Office follow-up queue.");
  } else if (input.status === TaskStatus.in_progress) {
    details.push(
      "Already being worked in the shared Front Office follow-up queue.",
    );
  }

  if (input.dueAt) {
    details.push(
      `Due ${formatTaskDueLabel(input.dueAt, input.now, input.timeZone)}`,
    );
  } else if (
    input.status !== TaskStatus.completed &&
    input.status !== TaskStatus.canceled
  ) {
    details.push(
      "No due date is attached yet, so the follow-up still needs a visible next-touch date.",
    );
  }

  details.push(`Owner · ${input.assigneeLabel}`);

  return details.join(" · ");
}



export function buildTaskTimelineContext(input: {
  status: TaskStatus;
  queueLabel: string;
  statusLabel: string;
  needsAttention: boolean;
}) {
  if (
    input.status === TaskStatus.completed ||
    input.status === TaskStatus.canceled
  ) {
    return input.statusLabel;
  }

  if (input.needsAttention) {
    return "Needs action now";
  }

  return input.queueLabel;
}



export function formatFrontOfficeSendChannelLabel(channel: string) {
  switch (channel.trim().toLowerCase()) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    default:
      return "Direct link";
  }
}



export function mapFrontOfficeSendEngagementTone(
  openCount: number,
): FrontOfficeClientDetailTone {
  if (openCount <= 0) {
    return "neutral";
  }

  if (openCount === 1) {
    return "success";
  }

  return "accent";
}



export function buildFrontOfficeSendEngagementLabel(openCount: number) {
  if (openCount <= 0) {
    return "Not opened";
  }

  if (openCount === 1) {
    return "Opened";
  }

  return `Revisited ${openCount} times`;
}



export function formatSendRecordStageLabel(value: string | null | undefined) {
  return value?.trim() || "Stage not captured";
}



export function buildSendRecordAppointmentLabel(input: {
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



export function getClientFirstName(fullName: string) {
  const [firstName] = fullName.trim().split(/\s+/);
  return firstName?.trim() || "there";
}



export function hasMeaningfulBudgetLabel(label: string) {
  return label.trim() !== "Budget not captured";
}



export function hasMeaningfulAreasLabel(label: string) {
  return label.trim() !== "Areas not captured";
}



export function hasMeaningfulIntentLabel(label: string) {
  return label.trim() !== "Intent not captured";
}



export function buildPlaybookItem(
  id: string,
  title: string,
  description: string,
): FrontOfficeClientDetailPlaybookItem {
  return { id, title, description };
}



export function buildPlaybookTemplate(
  id: string,
  label: string,
  channelLabel: string,
  body: string,
): FrontOfficeClientDetailPlaybookTemplate {
  return { id, label, channelLabel, body };
}



export function buildPlaybookObjection(
  id: string,
  objection: string,
  response: string,
): FrontOfficeClientDetailPlaybookObjection {
  return { id, objection, response };
}
