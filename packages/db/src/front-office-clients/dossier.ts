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
import { FRONT_OFFICE_FOLLOW_UP_FORM_ID, FRONT_OFFICE_FOLLOW_UP_QUEUE_ID, FrontOfficeCalendarView, FrontOfficeListingsLane, buildClientAction, buildClientRouteHref, buildFrontOfficeCalendarHref, buildFrontOfficeListingsHref, buildFrontOfficeSendEngagementLabel, buildLeaseReminderSnapshot, buildPlaybookItem, buildPlaybookObjection, buildPlaybookTemplate, buildSendRecordAppointmentLabel, buildTaskHelperLabel, buildTaskQueueLabel, buildTaskTimelineContext, buildTaskTimelineDescription, buildTaskTimelineTitle, formatAppointmentStatusLabel, formatAppointmentTypeLabel, formatBudgetRange, formatCalendarDistanceLabel, formatCurrency, formatDateLabel, formatDateTimeValue, formatDateValue, formatFrontOfficeSendChannelLabel, formatRelativeDueLabel, formatSendRecordStageLabel, formatTaskDueLabel, formatTaskStatusLabel, frontOfficeCalendarViews, frontOfficeListingsLanes, getCalendarDayDifference, getClientFirstName, hasMeaningfulAreasLabel, hasMeaningfulBudgetLabel, hasMeaningfulIntentLabel, mapAppointmentStatusTone, mapAppointmentTypeTone, mapBridgeActivityState, mapClientStageTone, mapFrontOfficeSendEngagementTone, mapSendEngagementKey, mapTaskTone, pickEarliestDate, resolveFrontOfficeCalendarView, resolveFrontOfficeListingsLane, resolveNextStepRailCalendarView } from "./workflow";
import { buildFrontOfficeAiSuggestions, buildFrontOfficePlaybook } from "./playbook";
import { getFrontOfficeClientDetail } from "./detail";

export function mapHandoffTone(
  status: FrontOfficeHandoffStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case FrontOfficeHandoffStatus.committed:
      return "success";
    case FrontOfficeHandoffStatus.canceled:
      return "neutral";
    case FrontOfficeHandoffStatus.ready:
      return "warning";
    default:
      return "accent";
  }
}



export function formatHandoffStatusLabel(status: FrontOfficeHandoffStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}



export function formatTransactionStatusLabel(status: string) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}



export function buildTransactionWorkspaceHref(transactionId: string, anchor?: string) {
  return anchor?.trim()
    ? `/office/transactions/${transactionId}#${anchor}`
    : `/office/transactions/${transactionId}`;
}



export function buildClientPdfHref(clientId: string) {
  return `/api/agent/clients/${clientId}/pdf`;
}



export function mapOfferStatusTone(status: string): FrontOfficeClientDetailTone {
  switch (status) {
    case "accepted":
      return "success";
    case "countered":
    case "under_review":
      return "warning";
    case "submitted":
    case "received":
      return "accent";
    case "rejected":
    case "withdrawn":
    case "expired":
      return "danger";
    default:
      return "neutral";
  }
}



export function buildOfferWorkspaceHref(
  transactionId: string,
  offerId?: string | null,
) {
  return offerId?.trim()
    ? `/office/transactions/${transactionId}#offer-${offerId}`
    : buildTransactionWorkspaceHref(transactionId, "transaction-offers");
}



export function formatTransactionTaskStatusLabel(status: TransactionTaskStatus) {
  return formatTransactionStatusLabel(status);
}



export function mapTransactionTaskTone(
  status: TransactionTaskStatus,
  dueAt: Date | null,
  now: Date,
): FrontOfficeClientDetailTone {
  if (status === TransactionTaskStatus.completed) {
    return "success";
  }

  if (dueAt && dueAt.getTime() < now.getTime()) {
    return "danger";
  }

  if (status === TransactionTaskStatus.review_requested) {
    return "warning";
  }

  if (status === TransactionTaskStatus.in_progress) {
    return "accent";
  }

  if (status === TransactionTaskStatus.reopened) {
    return "warning";
  }

  return "neutral";
}



export function formatSignatureRequestStatusLabel(status: SignatureRequestStatus) {
  return formatTransactionStatusLabel(status);
}



export function mapSignatureRequestTone(
  status: SignatureRequestStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case SignatureRequestStatus.completed:
      return "success";
    case SignatureRequestStatus.pending_send:
      return "warning";
    case SignatureRequestStatus.sent:
    case SignatureRequestStatus.viewed:
    case SignatureRequestStatus.signed:
      return "accent";
    case SignatureRequestStatus.declined:
    case SignatureRequestStatus.canceled:
    case SignatureRequestStatus.voided:
    case SignatureRequestStatus.expired:
      return "danger";
    default:
      return "neutral";
  }
}



export function formatIncomingUpdateStatusLabel(status: IncomingUpdateStatus) {
  return formatTransactionStatusLabel(status);
}



export function mapIncomingUpdateTone(
  status: IncomingUpdateStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case IncomingUpdateStatus.accepted:
    case IncomingUpdateStatus.applied:
      return "success";
    case IncomingUpdateStatus.rejected:
      return "danger";
    default:
      return "warning";
  }
}



export function buildTransactionLocationLabel(input: {
  address: string | null | undefined;
  city: string | null | undefined;
  state: string | null | undefined;
}) {
  const addressLabel = input.address?.trim() || "";
  const cityStateLabel = [input.city?.trim() || "", input.state?.trim() || ""]
    .filter(Boolean)
    .join(", ");

  return [addressLabel, cityStateLabel].filter(Boolean).join(", ");
}



export function buildTransactionContextMetaLabel(input: {
  title: string | null | undefined;
  address: string | null | undefined;
  city: string | null | undefined;
  state: string | null | undefined;
  acceptanceDate: Date | null | undefined;
  closingDate: Date | null | undefined;
  moveInDate?: Date | null | undefined;
  timeZone?: string | null;
}) {
  const timingLabels = [
    input.acceptanceDate
      ? `Accepted ${formatDateLabel(input.acceptanceDate, input.timeZone)}`
      : "",
    input.closingDate
      ? `Closing ${formatDateLabel(input.closingDate, input.timeZone)}`
      : "",
    input.moveInDate
      ? `Move-in ${formatDateLabel(input.moveInDate, input.timeZone)}`
      : "",
  ].filter(Boolean);

  return [
    input.title?.trim() || "",
    buildTransactionLocationLabel(input),
    ...timingLabels,
  ]
    .filter(Boolean)
    .join(" · ");
}



export function getDayDifferenceFromToday(value: Date, now: Date) {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfTarget = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();

  return Math.round((startOfTarget - startOfToday) / 86_400_000);
}



export function buildFrontOfficeFollowUpAction(input: {
  hasScheduledTouch: boolean;
}): FrontOfficeClientDetailAction {
  return input.hasScheduledTouch
    ? buildClientAction({
        label: "Review follow-up queue",
        href: `#${FRONT_OFFICE_FOLLOW_UP_QUEUE_ID}`,
        kind: frontOfficeClientDetailActionKinds.reviewFollowUpQueue,
        target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
      })
    : buildClientAction({
        label: "Create follow-up",
        href: `#${FRONT_OFFICE_FOLLOW_UP_FORM_ID}`,
        kind: frontOfficeClientDetailActionKinds.createFollowUp,
        target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
      });
}



export function buildFollowUpCue(input: {
  clientId: string;
  stage: string;
  lastContactAt: Date | null;
  nextTouchAt: Date | null;
  leaseReminderAt: Date | null;
  leaseReminderNeedsAttention: boolean;
  hasOverdueTask: boolean;
  openTaskCount: number;
  activeHandoff: {
    status: FrontOfficeHandoffStatus;
    href: string;
    committedTransactionId: string | null;
  } | null;
  linkedTransactionStatus?: TransactionStatus | null;
  linkedTransactionHref: string | null;
  timeZone?: string | null;
  now: Date;
}): FrontOfficeClientDetailFollowUpCue {
  const normalizedStage = input.stage.trim().toLowerCase();
  const hasScheduledTouch = Boolean(
    input.nextTouchAt || input.openTaskCount > 0,
  );
  const defaultDueLabel = input.nextTouchAt
    ? formatRelativeDueLabel(input.nextTouchAt, input.now, input.timeZone)
    : "No follow-up scheduled";
  const defaultDueAtValue = formatDateTimeValue(input.nextTouchAt);

  if (input.linkedTransactionStatus === TransactionStatus.closed) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.postCloseFollowUp,
      tone: "success",
      label: input.nextTouchAt
        ? "Post-close touch on books"
        : "Post-close touch needed",
      description: input.nextTouchAt
        ? `${defaultDueLabel} Keep the relationship warm after close while the client is still engaged.`
        : "The formal deal is closed, but the next relationship touch is not yet scheduled.",
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.returnToFrontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({
        hasScheduledTouch: Boolean(input.nextTouchAt),
      }),
    };
  }

  if (isFrontOfficeStageReadyForBackOffice(input.stage)) {
    const hasCommittedRecord =
      input.activeHandoff?.status === FrontOfficeHandoffStatus.committed;
    const target = hasCommittedRecord
      ? frontOfficeClientDetailActionTargets.backOfficeTransaction
      : input.activeHandoff
        ? frontOfficeClientDetailActionTargets.backOfficeCreate
        : input.linkedTransactionHref
          ? frontOfficeClientDetailActionTargets.backOfficeTransaction
          : frontOfficeClientDetailActionTargets.backOfficeCreate;

    return {
      key: frontOfficeClientDetailFollowUpCueKeys.backOfficeTransition,
      tone: hasCommittedRecord ? "success" : "warning",
      label: hasCommittedRecord
        ? "Formal file already opened"
        : "Open the Back Office file now",
      description: hasCommittedRecord
        ? "Formal workflow is already live in Back Office. Keep Front Office follow-up supportive, not duplicative."
        : "This client page is far enough along that the formal offer or contract record should open in Back Office next.",
      dueLabel: hasCommittedRecord
        ? "Formal workflow already linked"
        : defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: hasCommittedRecord
        ? frontOfficeClientDetailOwnershipKeys.backOffice
        : frontOfficeClientDetailOwnershipKeys.moveToBackOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.offerPrep,
      action: buildClientAction({
        label: hasCommittedRecord
          ? "Open Back Office record"
          : "Open Back Office create flow",
        href:
          input.activeHandoff?.href ??
          input.linkedTransactionHref ??
          "/office/transactions",
        kind: hasCommittedRecord
          ? frontOfficeClientDetailActionKinds.openBackOfficeRecord
          : frontOfficeClientDetailActionKinds.openBackOfficeCreate,
        target,
      }),
    };
  }

  if (input.hasOverdueTask) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.overdueTask,
      tone: "danger",
      label: "Overdue follow-up",
      description:
        "At least one follow-up task is already overdue. Close it or move the due date before the client record stalls.",
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({ hasScheduledTouch: true }),
    };
  }

  if (input.leaseReminderNeedsAttention && input.leaseReminderAt) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.leaseReminderDue,
      tone:
        input.leaseReminderAt.getTime() < input.now.getTime()
          ? "danger"
          : "warning",
      label: "Lease reminder due",
      description: `Lease-related follow-up is due by ${formatDateLabel(
        input.leaseReminderAt,
        input.timeZone,
      )}. Confirm renewal, move timing, or remarketing next steps now.`,
      dueLabel: `Lease reminder · ${formatDateLabel(
        input.leaseReminderAt,
        input.timeZone,
      )}`,
      dueAtValue: formatDateTimeValue(input.leaseReminderAt),
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({
        hasScheduledTouch: Boolean(input.nextTouchAt),
      }),
    };
  }

  const isClosedStage =
    normalizedStage.includes("won") || normalizedStage.includes("lost");
  const isActiveOpportunity = Boolean(normalizedStage) && !isClosedStage;
  const daysSinceLastTouch = input.lastContactAt
    ? Math.floor(
        (input.now.getTime() - input.lastContactAt.getTime()) / 86_400_000,
      )
    : null;

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("scheduled")
  ) {
    const calendarView = buildFrontOfficeCalendarHref({
      clientId: input.clientId,
      calendarView: frontOfficeCalendarViews.confirmationPending,
    });
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.viewingScheduled,
      tone: "accent",
      label: "Showing logistics next",
      description:
        "Use the calendar and listing output context to tighten the appointment before the showing starts.",
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.appointment,
      action: buildClientAction({
        label: "Open calendar",
        href: calendarView,
        kind: frontOfficeClientDetailActionKinds.openCalendar,
        target: frontOfficeClientDetailActionTargets.frontOfficeCalendar,
      }),
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("completed")
  ) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.viewingFeedbackDue,
      tone: "accent",
      label: "Showing feedback next",
      description:
        "The viewing already happened. Capture feedback quickly and turn it into the next follow-up or shortlist move.",
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({
        hasScheduledTouch: hasScheduledTouch,
      }),
    };
  }

  if (normalizedStage.includes("lost")) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.lostNurture,
      tone: "neutral",
      label: "Nurture reminder next",
      description:
        "This opportunity is marked lost, but the client record should still carry a respectful future touch.",
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({
        hasScheduledTouch: hasScheduledTouch,
      }),
    };
  }

  if (normalizedStage.includes("pending")) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.pendingBlocker,
      tone: "warning",
      label: "Pending blocker needs owner",
      description:
        "Pending stages still need an owner and next date. Convert the blocker into a scheduled follow-up instead of waiting passively.",
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({
        hasScheduledTouch: hasScheduledTouch,
      }),
    };
  }

  if (input.nextTouchAt && input.nextTouchAt.getTime() < input.now.getTime()) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.overdueNextTouch,
      tone: "warning",
      label: "Next touch overdue",
      description: `${defaultDueLabel} Move it forward or confirm which newer touch now owns the conversation.`,
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({ hasScheduledTouch: true }),
    };
  }

  if (
    isActiveOpportunity &&
    daysSinceLastTouch !== null &&
    daysSinceLastTouch >= 15
  ) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.staleActiveClient,
      tone: "warning",
      label: "15+ day pressure",
      description: `No contact has been logged for ${daysSinceLastTouch} days while the opportunity is still active.`,
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({
        hasScheduledTouch: hasScheduledTouch,
      }),
    };
  }

  if (!input.nextTouchAt && input.openTaskCount === 0) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.missingNextTouch,
      tone: "warning",
      label: "No next touch scheduled",
      description:
        "This client page is still active, but no call, text, or email is on the books yet.",
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({ hasScheduledTouch: false }),
    };
  }

  if (hasScheduledTouch) {
    return {
      key: frontOfficeClientDetailFollowUpCueKeys.healthyTouch,
      tone: "success",
      label: "Next touch is scheduled",
      description:
        "The client page already has a future touch or task on the books, so the conversation still has a clear owner.",
      dueLabel: defaultDueLabel,
      dueAtValue: defaultDueAtValue,
      ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
      targetStepId: frontOfficeClientDetailNextStepIds.followUp,
      action: buildFrontOfficeFollowUpAction({ hasScheduledTouch: true }),
    };
  }

  return {
    key: frontOfficeClientDetailFollowUpCueKeys.defaultFollowUp,
    tone: "accent",
    label: "Set the next touch",
    description:
      "Use Front Office to keep the next call, text, or showing visible before the client record cools down.",
    dueLabel: defaultDueLabel,
    dueAtValue: defaultDueAtValue,
    ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
    targetStepId: frontOfficeClientDetailNextStepIds.followUp,
    action: buildFrontOfficeFollowUpAction({ hasScheduledTouch: false }),
  };
}



export function buildWorkflowSignal(input: {
  clientId: string;
  stage: string;
  lastContactAt: Date | null;
  nextTouchAt: Date | null;
  leaseReminderAt: Date | null;
  leaseReminderNeedsAttention: boolean;
  hasOverdueTask: boolean;
  openTaskCount: number;
  activeHandoff: {
    status: FrontOfficeHandoffStatus;
    href: string;
    committedTransactionId: string | null;
  } | null;
  linkedTransactionStatus?: TransactionStatus | null;
  linkedTransactionClosingDate?: Date | null;
  linkedTransactionMoveInDate?: Date | null;
  linkedTransactionHref: string | null;
  timeZone?: string | null;
  now: Date;
}): FrontOfficeClientDetailWorkflowSignal {
  const normalizedStage = input.stage.trim().toLowerCase();
  const isClosedStage =
    normalizedStage.includes("won") || normalizedStage.includes("lost");
  const isActiveOpportunity = Boolean(normalizedStage) && !isClosedStage;
  const daysSinceLastTouch = input.lastContactAt
    ? Math.floor(
        (input.now.getTime() - input.lastContactAt.getTime()) / 86_400_000,
      )
    : null;
  const hasOverdueNextTouch = Boolean(
    input.nextTouchAt && input.nextTouchAt.getTime() < input.now.getTime(),
  );

  let pressureKey: FrontOfficeClientDetailWorkflowPressureKey =
    frontOfficeClientDetailWorkflowPressureKeys.healthy;
  let pressureLabel = "Workflow healthy";
  let pressureTone: FrontOfficeClientDetailTone = "success";
  let pressureDescription =
    input.nextTouchAt || input.openTaskCount
      ? "This client page already has an upcoming touch or task attached, so the workflow is still moving."
      : "Recent activity is still fresh, but the next touch should be scheduled before the client goes quiet.";

  if (input.hasOverdueTask) {
    pressureKey = frontOfficeClientDetailWorkflowPressureKeys.overdueFollowUp;
    pressureLabel = "Overdue follow-up";
    pressureTone = "danger";
    pressureDescription =
      "At least one follow-up task is already past due. Close the loop or reschedule it today so the client does not slip.";
  } else if (input.leaseReminderNeedsAttention && input.leaseReminderAt) {
    pressureKey = frontOfficeClientDetailWorkflowPressureKeys.leaseReminderDue;
    pressureLabel = "Lease reminder due";
    pressureTone =
      input.leaseReminderAt.getTime() < input.now.getTime()
        ? "danger"
        : "warning";
    pressureDescription = `Lease-related follow-up is due by ${formatDateLabel(input.leaseReminderAt, input.timeZone)}. Confirm renewal, remarketing, or move timing before this window slips.`;
  } else if (
    isActiveOpportunity &&
    daysSinceLastTouch !== null &&
    daysSinceLastTouch >= 15
  ) {
    pressureKey = frontOfficeClientDetailWorkflowPressureKeys.staleActiveClient;
    pressureLabel = "15+ day pressure";
    pressureTone = "warning";
    pressureDescription = `No contact has been logged for ${daysSinceLastTouch} days while this opportunity is still active. The system should push the next action now.`;
  } else if (hasOverdueNextTouch) {
    pressureKey = frontOfficeClientDetailWorkflowPressureKeys.overdueNextTouch;
    pressureLabel = "Next touch overdue";
    pressureTone = "warning";
    pressureDescription = `The scheduled next touch slipped past ${formatDateLabel(input.nextTouchAt, input.timeZone)}. Move it forward or create a new follow-up.`;
  } else if (
    isActiveOpportunity &&
    !input.nextTouchAt &&
    input.openTaskCount === 0
  ) {
    pressureKey = frontOfficeClientDetailWorkflowPressureKeys.missingNextTouch;
    pressureLabel = "No next touch scheduled";
    pressureTone = "warning";
    pressureDescription =
      "This client is active but no future follow-up is on the books yet. Add a reminder before the client record goes stale.";
  }

  if (input.linkedTransactionStatus === TransactionStatus.closed) {
    const closingReferenceDate =
      input.linkedTransactionMoveInDate ?? input.linkedTransactionClosingDate;
    const action = buildClientAction({
      label: "Create follow-up",
      href: "#front-office-follow-up-form",
      kind: frontOfficeClientDetailActionKinds.createFollowUp,
      target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
    });

    return {
      pressureKey,
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepKey:
        frontOfficeClientDetailWorkflowNextStepKeys.postCloseFollowUp,
      nextStepTitle: "Place the post-close follow-up",
      nextStepTone: "success",
      nextStepDescription: closingReferenceDate
        ? `The formal deal already closed around ${formatDateLabel(closingReferenceDate, input.timeZone)}. Use Front Office to keep the referral, testimonial, or retention touch visible while the win is still fresh.`
        : "The formal deal is already closed. Use Front Office to keep the referral, testimonial, or retention touch visible while the win is still fresh.",
      action,
      actionLabel: action.label,
      actionHref: action.href,
    };
  }

  if (isFrontOfficeStageReadyForBackOffice(input.stage)) {
    const hasCommittedRecord =
      input.activeHandoff?.status === FrontOfficeHandoffStatus.committed;
    const action = buildClientAction({
      label: hasCommittedRecord
        ? "Open Back Office record"
        : "Open Back Office create flow",
      href:
        input.activeHandoff?.href ??
        input.linkedTransactionHref ??
        "/office/transactions",
      kind: hasCommittedRecord
        ? frontOfficeClientDetailActionKinds.openBackOfficeRecord
        : frontOfficeClientDetailActionKinds.openBackOfficeCreate,
      target: hasCommittedRecord
        ? frontOfficeClientDetailActionTargets.backOfficeTransaction
        : input.activeHandoff
          ? frontOfficeClientDetailActionTargets.backOfficeCreate
          : input.linkedTransactionHref
            ? frontOfficeClientDetailActionTargets.backOfficeTransaction
            : frontOfficeClientDetailActionTargets.backOfficeCreate,
    });

    return {
      pressureKey,
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepKey: hasCommittedRecord
        ? frontOfficeClientDetailWorkflowNextStepKeys.workFromBackOfficeRecord
        : frontOfficeClientDetailWorkflowNextStepKeys.moveIntoBackOffice,
      nextStepTitle: hasCommittedRecord
        ? "Work from the Back Office record"
        : "Move this client into Back Office",
      nextStepTone: hasCommittedRecord ? "success" : "warning",
      nextStepDescription: hasCommittedRecord
        ? "Formal transaction workflow has already started. Keep execution aligned from the linked Back Office record."
        : "Negotiation, application, or offer work is now formal enough that the shared Back Office workflow should take over.",
      action,
      actionLabel: action.label,
      actionHref: action.href,
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("scheduled")
  ) {
    const calendarView = buildFrontOfficeCalendarHref({
      clientId: input.clientId,
      calendarView: frontOfficeCalendarViews.confirmationPending,
    });
    const action = buildClientAction({
      label: "Open calendar",
      href: calendarView,
      kind: frontOfficeClientDetailActionKinds.openCalendar,
      target: frontOfficeClientDetailActionTargets.frontOfficeCalendar,
    });

    return {
      pressureKey,
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepKey:
        frontOfficeClientDetailWorkflowNextStepKeys.confirmShowingLogistics,
      nextStepTitle: "Confirm the showing logistics",
      nextStepTone: "accent",
      nextStepDescription:
        "Use the calendar to confirm the address, access notes, contact, and reminder timing before the appointment happens.",
      action,
      actionLabel: action.label,
      actionHref: action.href,
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("completed")
  ) {
    const action = buildClientAction({
      label: "Create follow-up",
      href: "#front-office-follow-up-form",
      kind: frontOfficeClientDetailActionKinds.createFollowUp,
      target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
    });

    return {
      pressureKey,
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepKey:
        frontOfficeClientDetailWorkflowNextStepKeys.captureShowingFeedback,
      nextStepTitle: "Capture feedback and set the next follow-up",
      nextStepTone: "accent",
      nextStepDescription:
        "Log the client reaction, narrow the shortlist, and place the next call or message on the calendar now.",
      action,
      actionLabel: action.label,
      actionHref: action.href,
    };
  }

  if (normalizedStage.includes("lost")) {
    const action = buildClientAction({
      label: "Create follow-up",
      href: "#front-office-follow-up-form",
      kind: frontOfficeClientDetailActionKinds.createFollowUp,
      target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
    });

    return {
      pressureKey,
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepKey:
        frontOfficeClientDetailWorkflowNextStepKeys.placeNurtureReminder,
      nextStepTitle: "Place a nurture reminder",
      nextStepTone: "neutral",
      nextStepDescription:
        "This opportunity is marked lost, but the client record should still carry a future check-in instead of disappearing.",
      action,
      actionLabel: action.label,
      actionHref: action.href,
    };
  }

  if (normalizedStage.includes("won") && input.linkedTransactionHref) {
    const action = buildClientAction({
      label: "Open transaction",
      href: input.linkedTransactionHref,
      kind: frontOfficeClientDetailActionKinds.openTransaction,
      target: frontOfficeClientDetailActionTargets.backOfficeTransaction,
    });

    return {
      pressureKey,
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepKey:
        frontOfficeClientDetailWorkflowNextStepKeys.trackSharedTransaction,
      nextStepTitle: "Track progress from the shared transaction record",
      nextStepTone: "success",
      nextStepDescription:
        "The client is already won. Keep milestone updates aligned from the linked Back Office transaction instead of duplicating workflow here.",
      action,
      actionLabel: action.label,
      actionHref: action.href,
    };
  }

  if (normalizedStage.includes("pending")) {
    const action = buildClientAction({
      label: "Create follow-up",
      href: "#front-office-follow-up-form",
      kind: frontOfficeClientDetailActionKinds.createFollowUp,
      target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
    });

    return {
      pressureKey,
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepKey:
        frontOfficeClientDetailWorkflowNextStepKeys.clarifyPendingBlocker,
      nextStepTitle: "Clarify the blocker and owner",
      nextStepTone: "warning",
      nextStepDescription:
        "Pending stages should still have an explicit owner, due date, and unblock plan so the record does not sit quietly.",
      action,
      actionLabel: action.label,
      actionHref: action.href,
    };
  }

  if (input.leaseReminderAt) {
    const leaseReminderSoon =
      input.leaseReminderAt.getTime() <=
      new Date(
        input.now.getFullYear(),
        input.now.getMonth(),
        input.now.getDate() + 14,
      ).getTime();

    if (leaseReminderSoon) {
      const action = buildClientAction({
        label: "Create follow-up",
        href: "#front-office-follow-up-form",
        kind: frontOfficeClientDetailActionKinds.createFollowUp,
        target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
      });

      return {
        pressureKey,
        pressureLabel,
        pressureTone,
        pressureDescription,
        nextStepKey:
          frontOfficeClientDetailWorkflowNextStepKeys.startLeaseFollowUp,
        nextStepTitle: "Start renewal or remarketing follow-up",
        nextStepTone: input.leaseReminderNeedsAttention ? "warning" : "accent",
        nextStepDescription:
          "Use the lease window to confirm whether this client is renewing, moving, or needs a fresh listing / tour plan before the date passes quietly.",
        action,
        actionLabel: action.label,
        actionHref: action.href,
      };
    }
  }

  const action = buildClientAction({
    label: "Create follow-up",
    href: "#front-office-follow-up-form",
    kind: frontOfficeClientDetailActionKinds.createFollowUp,
    target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
  });

  return {
    pressureKey,
    pressureLabel,
    pressureTone,
    pressureDescription,
    nextStepKey: frontOfficeClientDetailWorkflowNextStepKeys.scheduleNextTouch,
    nextStepTitle: "Set the next call, text, or showing",
    nextStepTone: "accent",
    nextStepDescription:
      "Front Office should keep the next touch visible by default. Create a follow-up or book the next appointment before leaving this client page.",
    action,
    actionLabel: action.label,
    actionHref: action.href,
  };
}



export function getFrontOfficeClientDetailWorkbenchLabel(
  stepId: FrontOfficeClientDetailNextStepId,
) {
  switch (stepId) {
    case frontOfficeClientDetailNextStepIds.followUp:
    case frontOfficeClientDetailNextStepIds.appointment:
      return "Appointments & follow-up";
    case frontOfficeClientDetailNextStepIds.listingOutput:
      return "Listing output";
    case frontOfficeClientDetailNextStepIds.offerPrep:
      return "Offer & negotiation";
    case frontOfficeClientDetailNextStepIds.inspectionSupport:
      return "Inspection & contract support";
    case frontOfficeClientDetailNextStepIds.closingSuggestion:
      return "Closing & win suggestions";
    default:
      return "Next-step section";
  }
}



export function getFrontOfficeClientDetailWorkbenchDescription(
  stepId: FrontOfficeClientDetailNextStepId,
) {
  switch (stepId) {
    case frontOfficeClientDetailNextStepIds.followUp:
    case frontOfficeClientDetailNextStepIds.appointment:
      return "Use this section when the next touch belongs to calls, reminders, confirmations, reschedules, or live client coordination and you want to re-enter from the calendar update form.";
    case frontOfficeClientDetailNextStepIds.listingOutput:
      return "Use this section when the next move is about tracked sends, rescues, open counts, follow-through on a previous shortlist, or a return from listing follow-up.";
    case frontOfficeClientDetailNextStepIds.offerPrep:
      return "Use this section when negotiation is active, Front Office still owns the client-facing prep, and the same page needs to return to Back Office for the formal offer file.";
    case frontOfficeClientDetailNextStepIds.inspectionSupport:
      return "Use this section when the formal transaction is live, Front Office still owns the client-facing explanation, and the same page should reopen the Back Office checklist instead of creating a second tracker.";
    case frontOfficeClientDetailNextStepIds.closingSuggestion:
      return "Use this section when the deal is closing, closed, or paused, and the same page should turn the formal outcome into a next move, a post-close touch, or a respectful re-entry plan.";
    default:
      return "Use this section when you want the client page to explain the active view, the current return point, and the next best move.";
  }
}



export function getFrontOfficeClientDetailWorkbenchHref(
  stepId: FrontOfficeClientDetailNextStepId,
) {
  switch (stepId) {
    case frontOfficeClientDetailNextStepIds.followUp:
    case frontOfficeClientDetailNextStepIds.appointment:
      return "#front-office-client-appointments-follow-up";
    case frontOfficeClientDetailNextStepIds.listingOutput:
      return "#front-office-client-listing-output";
    case frontOfficeClientDetailNextStepIds.offerPrep:
      return "#front-office-client-offer-prep";
    case frontOfficeClientDetailNextStepIds.inspectionSupport:
      return "#front-office-client-inspection-support";
    case frontOfficeClientDetailNextStepIds.closingSuggestion:
      return "#front-office-client-closing-suggestion";
    default:
      return "#front-office-client-next-step-rail";
  }
}



export function buildFrontOfficeClientDetailWorkbenchReturn(
  stepId: FrontOfficeClientDetailNextStepId,
): FrontOfficeClientDetailWorkbenchReturn {
  return {
    label: getFrontOfficeClientDetailWorkbenchLabel(stepId),
    description: getFrontOfficeClientDetailWorkbenchDescription(stepId),
    href: getFrontOfficeClientDetailWorkbenchHref(stepId),
  };
}



export function buildNextStepRail(input: {
  clientId: string;
  stage: string;
  now: Date;
  timeZone?: string | null;
  nextTouchAt: Date | null;
  openTaskCount: number;
  hasOverdueTask: boolean;
  hasUpcomingAppointment: boolean;
  latestUpcomingAppointment: {
    title: string;
    startsAt: Date;
    externalStatusLabel: string;
    externalStatusDetail: string;
  } | null;
  sendCount: number;
  openedSendCount: number;
  revisitCount: number;
  latestSendRecord: {
    listingTitle: string;
    sentAt: Date;
    openCount: number;
    lastOpenedAt: Date | null;
  } | null;
  workflow: FrontOfficeClientDetailWorkflowSignal;
  isReadyForBackOffice: boolean;
  hasLinkedTransaction: boolean;
  hasClosedTransaction: boolean;
  hasCancelledTransaction: boolean;
  isClosingSoon: boolean;
  negotiation: Pick<
    FrontOfficeClientDetailNegotiation,
    | "boundaryLabel"
    | "boundaryTitle"
    | "boundaryDescription"
    | "boundaryMetaLabel"
    | "nextMoveLabel"
    | "nextMoveDescription"
    | "operatorLabel"
    | "operatorDescription"
  > & {
    primaryAction: FrontOfficeClientDetailAction;
  };
  inspection: Pick<
    FrontOfficeClientDetailInspection,
    | "boundaryLabel"
    | "boundaryTitle"
    | "boundaryDescription"
    | "boundaryMetaLabel"
    | "nextMoveLabel"
    | "nextMoveDescription"
    | "operatorLabel"
    | "operatorDescription"
    | "openTaskCount"
    | "pendingSignatureCount"
    | "pendingIncomingUpdateCount"
  > & {
    primaryAction: FrontOfficeClientDetailAction;
  };
  closing: Pick<
    FrontOfficeClientDetailClosing,
    | "boundaryLabel"
    | "boundaryTitle"
    | "boundaryDescription"
    | "boundaryMetaLabel"
    | "nextMoveLabel"
    | "nextMoveDescription"
    | "operatorLabel"
    | "operatorDescription"
  > & {
    primaryAction: FrontOfficeClientDetailAction;
  };
}): FrontOfficeClientDetailNextStepRail {
  const normalizedStage = input.stage.trim().toLowerCase();
  const isViewingScheduled =
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("scheduled");
  const isViewingCompleted =
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("completed");
  const hasOverdueNextTouch = Boolean(
    input.nextTouchAt && input.nextTouchAt.getTime() < input.now.getTime(),
  );
  const nextTouchDetail = input.nextTouchAt
    ? formatRelativeDueLabel(input.nextTouchAt, input.now, input.timeZone)
    : "No follow-up is scheduled yet.";

  let decisionKey: FrontOfficeClientDetailDecisionKey =
    frontOfficeClientDetailDecisionKeys.stayInFrontOffice;
  let decisionLabel = "Stay in Front Office";
  let decisionTone: FrontOfficeClientDetailTone = "accent";
  let decisionTitle = "Daily execution still belongs in Front Office for now";
  let decisionDescription =
    "Keep the next call, appointment, and listing output here until the client crosses into formal offer or contract work. Do not open a Back Office record early just to hold a reminder.";
  let decisionMetaLabel = `Current stage · ${input.stage}`;
  let primaryAction = input.workflow.action;

  if (input.hasClosedTransaction) {
    decisionKey = frontOfficeClientDetailDecisionKeys.returnToFrontOffice;
    decisionLabel = "Return to Front Office";
    decisionTone = "success";
    decisionTitle =
      "The formal deal is closed, so the next daily work moves back to Front Office";
    decisionDescription =
      "Back Office remains the system of record for the finished transaction. Use this client page for recap, referral, testimonial, and post-close care instead of creating a second closing tracker.";
    decisionMetaLabel = input.closing.boundaryMetaLabel;
    primaryAction = input.closing.primaryAction;
  } else if (input.hasLinkedTransaction) {
    decisionKey =
      frontOfficeClientDetailDecisionKeys.formalWorkflowInBackOffice;
    decisionLabel = "Formal workflow is in Back Office";
    decisionTone = "warning";
    decisionTitle =
      "Keep the formal record in Back Office and use Front Office for client-facing support";
    decisionDescription =
      "Offers, inspection work, signatures, and closing milestones now belong to the shared Back Office record. Keep this client page focused on the next client touch, recap, and coordination around that formal file.";
    decisionMetaLabel = input.inspection.boundaryMetaLabel;
    primaryAction = input.workflow.action;
  } else if (input.isReadyForBackOffice) {
    decisionKey = frontOfficeClientDetailDecisionKeys.moveToBackOffice;
    decisionLabel = "Move into Back Office now";
    decisionTone = "warning";
    decisionTitle =
      "This client page has crossed into Back Office-ready work and needs a formal file";
    decisionDescription =
      "Negotiation, application, or offer prep is now formal enough that the next record belongs in Back Office. Keep client-facing context here, but do not create a duplicate offer or inspection tracker inside Front Office.";
    decisionMetaLabel = input.negotiation.boundaryMetaLabel;
    primaryAction = input.negotiation.primaryAction;
  }

  let currentStepId: FrontOfficeClientDetailNextStepId =
    frontOfficeClientDetailNextStepIds.followUp;

  if (
    input.hasClosedTransaction ||
    input.isClosingSoon ||
    input.hasCancelledTransaction
  ) {
    currentStepId = frontOfficeClientDetailNextStepIds.closingSuggestion;
  } else if (
    input.hasLinkedTransaction &&
    (input.inspection.openTaskCount > 0 ||
      input.inspection.pendingSignatureCount > 0 ||
      input.inspection.pendingIncomingUpdateCount > 0 ||
      input.inspection.boundaryLabel === "Inspection-era live" ||
      input.inspection.boundaryLabel === "Contract file live")
  ) {
    currentStepId = frontOfficeClientDetailNextStepIds.inspectionSupport;
  } else if (input.hasLinkedTransaction || input.isReadyForBackOffice) {
    currentStepId = frontOfficeClientDetailNextStepIds.offerPrep;
  } else if (input.hasOverdueTask || hasOverdueNextTouch) {
    currentStepId = frontOfficeClientDetailNextStepIds.followUp;
  } else if (input.hasUpcomingAppointment || isViewingScheduled) {
    currentStepId = frontOfficeClientDetailNextStepIds.appointment;
  } else if (input.sendCount > 0) {
    currentStepId = frontOfficeClientDetailNextStepIds.listingOutput;
  }

  const followUpStatusLabel = input.hasOverdueTask
    ? "Due now"
    : hasOverdueNextTouch
      ? "Overdue"
      : input.nextTouchAt || input.openTaskCount > 0
        ? "On books"
        : input.hasClosedTransaction
          ? "Post-close needed"
          : normalizedStage.includes("lost")
            ? "Nurture next"
            : "Needed";
  const followUpStatusTone: FrontOfficeClientDetailTone = input.hasOverdueTask
    ? "danger"
    : hasOverdueNextTouch
      ? "warning"
      : input.nextTouchAt || input.openTaskCount > 0
        ? "success"
        : input.hasClosedTransaction
          ? "accent"
          : "warning";
  const followUpOwnershipKey = input.hasClosedTransaction
    ? frontOfficeClientDetailOwnershipKeys.returnToFrontOffice
    : input.hasLinkedTransaction
      ? frontOfficeClientDetailOwnershipKeys.frontOfficeSupportsBackOffice
      : input.isReadyForBackOffice
        ? frontOfficeClientDetailOwnershipKeys.moveToBackOffice
        : frontOfficeClientDetailOwnershipKeys.frontOffice;
  const followUpOwnershipLabel = input.hasClosedTransaction
    ? "Front Office owns the relationship"
    : input.hasLinkedTransaction
      ? "Front Office supports Back Office"
      : input.isReadyForBackOffice
        ? "Front Office until Back Office opens"
        : "Stay in Front Office";
  const followUpOwnershipTone: FrontOfficeClientDetailTone =
    input.hasClosedTransaction
      ? "success"
      : input.hasLinkedTransaction
        ? "accent"
        : input.isReadyForBackOffice
          ? "warning"
          : "accent";
  const followUpDescription = input.hasOverdueTask
    ? "At least one follow-up task is already overdue. Close the loop or move the due date before the client record stalls."
    : hasOverdueNextTouch
      ? `${nextTouchDetail} Move it forward or confirm that a different next touch now owns the client conversation.`
      : input.nextTouchAt || input.openTaskCount > 0
        ? `${nextTouchDetail} Keep the next touch explicit so the client record stays live from one action to the next.`
        : input.hasClosedTransaction
          ? "The formal file is already closed, but the relationship still needs a post-close touch, support check-in, or referral ask."
          : input.isReadyForBackOffice
            ? "Client-facing follow-up still belongs here, but the formal offer / contract record should open in Back Office next."
            : "No next touch is scheduled yet. Put the next call, text, or email on the books before leaving this client page.";
  const followUpMetaLabel = input.openTaskCount
    ? `${input.openTaskCount} open follow-up task(s)`
    : nextTouchDetail;

  const appointmentStatusLabel = input.latestUpcomingAppointment
    ? "Scheduled"
    : isViewingCompleted
      ? "Feedback due"
      : isViewingScheduled
        ? "Book / confirm"
        : input.hasClosedTransaction
          ? "Optional"
          : "Standby";
  const appointmentStatusTone: FrontOfficeClientDetailTone =
    input.latestUpcomingAppointment
      ? "accent"
      : isViewingCompleted
        ? "warning"
        : isViewingScheduled
          ? "accent"
          : "neutral";
  const appointmentOwnershipKey =
    input.hasLinkedTransaction && !input.hasClosedTransaction
      ? frontOfficeClientDetailOwnershipKeys.frontOfficeSupportsBackOffice
      : input.hasClosedTransaction
        ? frontOfficeClientDetailOwnershipKeys.inactive
        : frontOfficeClientDetailOwnershipKeys.frontOffice;
  const appointmentOwnershipLabel =
    input.hasLinkedTransaction && !input.hasClosedTransaction
      ? "Front Office support"
      : input.hasClosedTransaction
        ? "Optional support"
        : "Stay in Front Office";
  const appointmentOwnershipTone: FrontOfficeClientDetailTone =
    input.hasLinkedTransaction && !input.hasClosedTransaction
      ? "accent"
      : "neutral";
  const appointmentTitle = input.latestUpcomingAppointment
    ? `Prepare ${input.latestUpcomingAppointment.title}`
    : isViewingCompleted
      ? "Turn the completed showing into a decision"
      : isViewingScheduled
        ? "Make the showing logistics airtight"
        : "Use appointments when the next touch needs live time";
  const appointmentDescription = input.latestUpcomingAppointment
    ? `${formatDateTimeLabel(input.latestUpcomingAppointment.startsAt, {
        timeZone: input.timeZone ?? null,
      })} · ${input.latestUpcomingAppointment.externalStatusDetail}`
    : isViewingCompleted
      ? "The tour already happened. Capture feedback, confirm the shortlist, and decide whether the next move is another showing, a send, or a Back Office handoff."
      : isViewingScheduled
        ? "Use the calendar to confirm the time, address, access, and follow-up timing before the showing starts."
        : input.hasLinkedTransaction
          ? "Calendar stays useful for client coordination, but not as a second Back Office milestone tracker."
          : "Use appointments for showings, consultations, and decision calls once the next touch is clear.";
  const appointmentMetaLabel = input.latestUpcomingAppointment
    ? `External state · ${input.latestUpcomingAppointment.externalStatusLabel}`
    : "Open the shared Front Office calendar from this client page";

  const listingStatusLabel = input.latestSendRecord
    ? input.latestSendRecord.openCount > 1
      ? "Revisited"
      : input.latestSendRecord.openCount === 1
        ? "Opened"
        : "Sent"
    : input.hasClosedTransaction
      ? "Optional"
      : input.isReadyForBackOffice
        ? "Support only"
        : "Ready";
  const listingStatusTone = input.latestSendRecord
    ? mapFrontOfficeSendEngagementTone(input.latestSendRecord.openCount)
    : input.isReadyForBackOffice
      ? "neutral"
      : "accent";
  const listingOwnershipKey = input.hasClosedTransaction
    ? frontOfficeClientDetailOwnershipKeys.inactive
    : input.hasLinkedTransaction
      ? frontOfficeClientDetailOwnershipKeys.frontOfficeSupportsBackOffice
      : input.isReadyForBackOffice
        ? frontOfficeClientDetailOwnershipKeys.moveToBackOffice
        : frontOfficeClientDetailOwnershipKeys.frontOffice;
  const listingOwnershipLabel = input.hasClosedTransaction
    ? "Optional support"
    : input.hasLinkedTransaction
      ? "Front Office support"
      : input.isReadyForBackOffice
        ? "Support, not source of truth"
        : "Stay in Front Office";
  const listingOwnershipTone: FrontOfficeClientDetailTone =
    input.hasLinkedTransaction
      ? "accent"
      : input.isReadyForBackOffice
        ? "warning"
        : "accent";
  const listingTitle = input.latestSendRecord
    ? input.latestSendRecord.openCount > 0
      ? "Use engagement signals to sharpen the next option"
      : "Follow up on the last listing send before sending more"
    : input.hasClosedTransaction
      ? "Listing output is no longer the main workflow"
      : input.isReadyForBackOffice
        ? "Use listing output only if it helps the handoff"
        : "Send the shortlist or the next option set";
  const listingDescription = input.latestSendRecord
    ? input.latestSendRecord.lastOpenedAt
      ? `${input.latestSendRecord.listingTitle} was last opened ${formatDateTimeLabel(
          input.latestSendRecord.lastOpenedAt,
          {
            timeZone: input.timeZone ?? null,
          },
        )}. Use that signal to decide whether to book, send backups, or stop pushing.`
      : `${input.latestSendRecord.listingTitle} was sent ${formatDateLabel(
          input.latestSendRecord.sentAt,
          input.timeZone,
        )}. If the client is quiet, follow up before generating another send.`
    : input.hasClosedTransaction
      ? "Keep listing output for recap or future re-entry only. The live deal record is already finished."
      : input.isReadyForBackOffice
        ? "A tracked send can support the conversation, but it should not replace opening the formal Back Office file."
        : "Tracked listing output keeps client interest measurable before you escalate into formal offer work.";
  const listingMetaLabel = input.sendCount
    ? `${input.sendCount} tracked send(s) · ${input.openedSendCount} opened · ${input.revisitCount} revisit(s)`
    : "Open listing follow-up from this client page";

  const offerOwnershipKey = input.hasLinkedTransaction
    ? frontOfficeClientDetailOwnershipKeys.backOffice
    : input.isReadyForBackOffice
      ? frontOfficeClientDetailOwnershipKeys.moveToBackOffice
      : frontOfficeClientDetailOwnershipKeys.frontOffice;
  const offerOwnershipLabel = input.hasLinkedTransaction
    ? "Back Office source of truth"
    : input.isReadyForBackOffice
      ? "Move to Back Office now"
      : "Stay in Front Office";
  const offerOwnershipTone: FrontOfficeClientDetailTone =
    input.hasLinkedTransaction
      ? "success"
      : input.isReadyForBackOffice
        ? "warning"
        : "accent";

  const inspectionOwnershipKey = input.hasLinkedTransaction
    ? frontOfficeClientDetailOwnershipKeys.backOffice
    : input.isReadyForBackOffice
      ? frontOfficeClientDetailOwnershipKeys.moveToBackOffice
      : frontOfficeClientDetailOwnershipKeys.inactive;
  const inspectionOwnershipLabel = input.hasLinkedTransaction
    ? "Back Office source of truth"
    : input.isReadyForBackOffice
      ? "Needs Back Office first"
      : "Not active yet";
  const inspectionOwnershipTone: FrontOfficeClientDetailTone =
    input.hasLinkedTransaction
      ? "success"
      : input.isReadyForBackOffice
        ? "warning"
        : "neutral";

  const closingOwnershipKey = input.hasClosedTransaction
    ? frontOfficeClientDetailOwnershipKeys.returnToFrontOffice
    : input.hasLinkedTransaction
      ? frontOfficeClientDetailOwnershipKeys.backOffice
      : input.isReadyForBackOffice
        ? frontOfficeClientDetailOwnershipKeys.moveToBackOffice
        : frontOfficeClientDetailOwnershipKeys.inactive;
  const closingOwnershipLabel = input.hasClosedTransaction
    ? "Return to Front Office"
    : input.hasLinkedTransaction
      ? "Back Office milestone"
      : input.isReadyForBackOffice
        ? "Needs Back Office first"
        : "Not active yet";
  const closingOwnershipTone: FrontOfficeClientDetailTone =
    input.hasClosedTransaction
      ? "success"
      : input.hasLinkedTransaction
        ? "accent"
        : input.isReadyForBackOffice
          ? "warning"
          : "neutral";

  const followUpAction = buildFrontOfficeFollowUpAction({
    hasScheduledTouch: Boolean(input.nextTouchAt || input.openTaskCount > 0),
  });
  const appointmentAction = buildClientAction({
    label: "Open calendar",
    href: buildFrontOfficeCalendarHref({
      clientId: input.clientId,
      calendarView: resolveNextStepRailCalendarView({
        hasUpcomingAppointment: input.hasUpcomingAppointment,
        nextTouchAt: input.nextTouchAt,
        openTaskCount: input.openTaskCount,
        now: input.now,
      }),
    }),
    kind: frontOfficeClientDetailActionKinds.openCalendar,
    target: frontOfficeClientDetailActionTargets.frontOfficeCalendar,
  });
  const listingAction = buildClientAction({
    label:
      input.latestSendRecord || input.sendCount > 0
        ? "Open listing output"
        : "Send first listing",
    href: buildFrontOfficeListingsHref({
      clientId: input.clientId,
      lane:
        input.latestSendRecord || input.sendCount > 0
          ? frontOfficeListingsLanes.followThrough
          : frontOfficeListingsLanes.draftLane,
    }),
    kind: frontOfficeClientDetailActionKinds.openListingOutput,
    target: frontOfficeClientDetailActionTargets.frontOfficeListingOutput,
  });
  const followUpReturnPoint = buildFrontOfficeClientDetailWorkbenchReturn(
    frontOfficeClientDetailNextStepIds.followUp,
  );
  const appointmentReturnPoint = buildFrontOfficeClientDetailWorkbenchReturn(
    frontOfficeClientDetailNextStepIds.appointment,
  );
  const listingReturnPoint = buildFrontOfficeClientDetailWorkbenchReturn(
    frontOfficeClientDetailNextStepIds.listingOutput,
  );
  const offerReturnPoint = buildFrontOfficeClientDetailWorkbenchReturn(
    frontOfficeClientDetailNextStepIds.offerPrep,
  );
  const inspectionReturnPoint = buildFrontOfficeClientDetailWorkbenchReturn(
    frontOfficeClientDetailNextStepIds.inspectionSupport,
  );
  const closingReturnPoint = buildFrontOfficeClientDetailWorkbenchReturn(
    frontOfficeClientDetailNextStepIds.closingSuggestion,
  );

  const followUpReturnDescription = input.hasClosedTransaction
    ? "Use this section when post-close support, recap, or referral follow-up should reopen from the same client record instead of a finished formal file."
    : input.hasLinkedTransaction
      ? "Use this section when calls, reminders, and client-facing follow-up still need to stay on the client page while Back Office owns the formal file."
      : input.isReadyForBackOffice
        ? "Use this section when the next touch is still client-facing, but the client page also needs to prepare for a formal Back Office handoff."
        : "Use this section when calls, reminders, confirmations, or next-touch tasks need to reopen from the same client page.";
  const appointmentReturnDescription = input.latestUpcomingAppointment
    ? "Use this section when the calendar update form needs to keep the same appointment focus and the client page should reopen the exact next touch."
    : isViewingCompleted
      ? "Use this section when the showing already happened and the client page should reopen feedback capture before the client goes cold."
      : isViewingScheduled
        ? "Use this section when showing logistics, confirmations, or reschedules need to come back into the same calendar page."
        : input.hasLinkedTransaction
          ? "Use this section when client coordination around a live deal still needs to reopen from the same calendar page, not a second Back Office milestone tracker."
          : "Use this section when live client coordination should return from the calendar update form into the same appointment section.";
  const listingReturnDescription = input.latestSendRecord
    ? input.latestSendRecord.openCount > 0
      ? "Use this section when tracked engagement or revisit signals need to bring the client page back into listing follow-up before another send goes out."
      : "Use this section when the last send still needs follow-through and the client page should return to listing follow-up instead of generating a fresh shortlist blindly."
    : input.hasClosedTransaction
      ? "Use this section when recap or future re-entry needs the prior send history without reopening formal deal work."
      : input.isReadyForBackOffice
        ? "Use this section when a tracked send helps the conversation or handoff, but the formal record still needs to open in Back Office next."
        : "Use this section when a tracked send, resend, or follow-through action needs to come back into listing follow-up.";
  const offerReturnDescription = input.hasLinkedTransaction
    ? "Use this section when offer intent is active, but the formal steps belong in the Back Office record and Front Office needs to keep the client-ready recap and return point aligned with that file."
    : input.isReadyForBackOffice
      ? "Use this section when the client page has crossed into formal offer prep and the next move is to open the Back Office file without losing client context or the same return point."
      : offerReturnPoint.description;
  const inspectionReturnDescription = input.hasLinkedTransaction
    ? "Use this section when the formal transaction is live and the same client record needs client-facing support without duplicating the Back Office tracker or the client-ready summary."
    : inspectionReturnPoint.description;
  const closingReturnDescription = input.hasClosedTransaction
    ? "Use this section when a closed deal needs post-close re-entry, recap, or relationship follow-through from the same Front Office page and the same client-ready story."
    : closingReturnPoint.description;

  const items: FrontOfficeClientDetailNextStepRailItem[] = [
    {
      id: frontOfficeClientDetailNextStepIds.followUp,
      stepLabel: "Follow-up",
      statusLabel: followUpStatusLabel,
      statusTone: followUpStatusTone,
      ownershipKey: followUpOwnershipKey,
      ownershipLabel: followUpOwnershipLabel,
      ownershipTone: followUpOwnershipTone,
      title: input.hasClosedTransaction
        ? "Keep the relationship moving after the deal"
        : "Keep the next touch visible",
      description: followUpDescription,
      metaLabel: followUpMetaLabel,
      action: followUpAction,
      actionLabel: followUpAction.label,
      actionHref: followUpAction.href,
      actionOpensInNewTab: followUpAction.opensInNewTab,
      returnPoint: followUpReturnPoint,
      returnDescription: followUpReturnDescription,
      isCurrent: currentStepId === frontOfficeClientDetailNextStepIds.followUp,
    },
    {
      id: frontOfficeClientDetailNextStepIds.appointment,
      stepLabel: "Appointment",
      statusLabel: appointmentStatusLabel,
      statusTone: appointmentStatusTone,
      ownershipKey: appointmentOwnershipKey,
      ownershipLabel: appointmentOwnershipLabel,
      ownershipTone: appointmentOwnershipTone,
      title: appointmentTitle,
      description: appointmentDescription,
      metaLabel: appointmentMetaLabel,
      action: appointmentAction,
      actionLabel: appointmentAction.label,
      actionHref: appointmentAction.href,
      actionOpensInNewTab: appointmentAction.opensInNewTab,
      returnPoint: appointmentReturnPoint,
      returnDescription: appointmentReturnDescription,
      isCurrent:
        currentStepId === frontOfficeClientDetailNextStepIds.appointment,
    },
    {
      id: frontOfficeClientDetailNextStepIds.listingOutput,
      stepLabel: "Listing output",
      statusLabel: listingStatusLabel,
      statusTone: listingStatusTone,
      ownershipKey: listingOwnershipKey,
      ownershipLabel: listingOwnershipLabel,
      ownershipTone: listingOwnershipTone,
      title: listingTitle,
      description: listingDescription,
      metaLabel: listingMetaLabel,
      action: listingAction,
      actionLabel: listingAction.label,
      actionHref: listingAction.href,
      actionOpensInNewTab: listingAction.opensInNewTab,
      returnPoint: listingReturnPoint,
      returnDescription: listingReturnDescription,
      isCurrent:
        currentStepId === frontOfficeClientDetailNextStepIds.listingOutput,
    },
    {
      id: frontOfficeClientDetailNextStepIds.offerPrep,
      stepLabel: "Offer prep",
      statusLabel: input.negotiation.boundaryLabel,
      statusTone: input.hasLinkedTransaction
        ? "success"
        : input.isReadyForBackOffice
          ? "warning"
          : "accent",
      ownershipKey: offerOwnershipKey,
      ownershipLabel: offerOwnershipLabel,
      ownershipTone: offerOwnershipTone,
      title: input.negotiation.boundaryTitle,
      description: input.negotiation.boundaryDescription,
      metaLabel: input.negotiation.boundaryMetaLabel,
      action: input.negotiation.primaryAction,
      actionLabel: input.negotiation.primaryAction.label,
      actionHref: input.negotiation.primaryAction.href,
      actionOpensInNewTab: input.negotiation.primaryAction.opensInNewTab,
      returnPoint: offerReturnPoint,
      returnDescription: offerReturnDescription,
      isCurrent: currentStepId === frontOfficeClientDetailNextStepIds.offerPrep,
    },
    {
      id: frontOfficeClientDetailNextStepIds.inspectionSupport,
      stepLabel: "Inspection support",
      statusLabel: input.inspection.boundaryLabel,
      statusTone: input.hasLinkedTransaction
        ? "success"
        : input.isReadyForBackOffice
          ? "warning"
          : "neutral",
      ownershipKey: inspectionOwnershipKey,
      ownershipLabel: inspectionOwnershipLabel,
      ownershipTone: inspectionOwnershipTone,
      title: input.inspection.boundaryTitle,
      description: input.inspection.boundaryDescription,
      metaLabel: input.inspection.boundaryMetaLabel,
      action: input.inspection.primaryAction,
      actionLabel: input.inspection.primaryAction.label,
      actionHref: input.inspection.primaryAction.href,
      actionOpensInNewTab: input.inspection.primaryAction.opensInNewTab,
      returnPoint: inspectionReturnPoint,
      returnDescription: inspectionReturnDescription,
      isCurrent:
        currentStepId === frontOfficeClientDetailNextStepIds.inspectionSupport,
    },
    {
      id: frontOfficeClientDetailNextStepIds.closingSuggestion,
      stepLabel: "Closing suggestion",
      statusLabel: input.closing.boundaryLabel,
      statusTone: input.hasClosedTransaction
        ? "success"
        : input.hasLinkedTransaction
          ? "accent"
          : input.isReadyForBackOffice
            ? "warning"
            : "neutral",
      ownershipKey: closingOwnershipKey,
      ownershipLabel: closingOwnershipLabel,
      ownershipTone: closingOwnershipTone,
      title: input.closing.boundaryTitle,
      description: input.closing.boundaryDescription,
      metaLabel: input.closing.boundaryMetaLabel,
      action: input.closing.primaryAction,
      actionLabel: input.closing.primaryAction.label,
      actionHref: input.closing.primaryAction.href,
      actionOpensInNewTab: input.closing.primaryAction.opensInNewTab,
      returnPoint: closingReturnPoint,
      returnDescription: closingReturnDescription,
      isCurrent:
        currentStepId === frontOfficeClientDetailNextStepIds.closingSuggestion,
    },
  ];

  return {
    decisionKey,
    decisionLabel,
    decisionTone,
    decisionTitle,
    decisionDescription,
    decisionMetaLabel,
    currentStepId,
    primaryAction,
    primaryActionLabel: primaryAction.label,
    primaryActionHref: primaryAction.href,
    primaryActionOpensInNewTab: primaryAction.opensInNewTab,
    items,
  };
}



export function buildDossierContract(input: {
  stage: string;
  nextStepRail: FrontOfficeClientDetailNextStepRail;
  followUpCue: FrontOfficeClientDetailFollowUpCue;
  activeHandoffDraft: {
    status: FrontOfficeHandoffStatus;
    stageLabel: string;
    summary: string | null;
    committedTransactionId: string | null;
    id: string;
  } | null;
  activeHandoffHref: string | null;
  clientFullName: string;
  hasLinkedTransaction: boolean;
  hasClosedTransaction: boolean;
  hasCancelledTransaction: boolean;
  isReadyForBackOffice: boolean;
}): FrontOfficeClientDetailContract {
  const handoffState: FrontOfficeClientDetailHandoffState =
    input.activeHandoffDraft
      ? input.activeHandoffDraft.status
      : frontOfficeClientDetailHandoffStates.none;
  const hasCommittedRecord =
    input.activeHandoffDraft?.status === FrontOfficeHandoffStatus.committed;
  const handoffAction =
    input.activeHandoffDraft && input.activeHandoffHref
      ? buildClientAction({
          label: hasCommittedRecord
            ? "Open Back Office record"
            : "Open Back Office create flow",
          href: input.activeHandoffHref,
          kind: hasCommittedRecord
            ? frontOfficeClientDetailActionKinds.openBackOfficeRecord
            : frontOfficeClientDetailActionKinds.openBackOfficeCreate,
          target: hasCommittedRecord
            ? frontOfficeClientDetailActionTargets.backOfficeTransaction
            : frontOfficeClientDetailActionTargets.backOfficeCreate,
        })
      : null;

  let boundaryState: FrontOfficeClientDetailBoundaryState =
    frontOfficeClientDetailBoundaryStates.frontOfficeActive;
  if (input.hasCancelledTransaction) {
    boundaryState = frontOfficeClientDetailBoundaryStates.cancelledReentry;
  } else if (input.hasClosedTransaction) {
    boundaryState = frontOfficeClientDetailBoundaryStates.postCloseFrontOffice;
  } else if (input.hasLinkedTransaction) {
    boundaryState = frontOfficeClientDetailBoundaryStates.backOfficeLive;
  } else if (input.isReadyForBackOffice) {
    boundaryState = frontOfficeClientDetailBoundaryStates.readyForBackOffice;
  }

  return {
    boundaryState,
    decisionKey: input.nextStepRail.decisionKey,
    currentStepId: input.nextStepRail.currentStepId,
    primaryAction: input.nextStepRail.primaryAction,
    followUpCue: input.followUpCue,
    handoff: {
      state: handoffState,
      isReadyForBackOffice: input.isReadyForBackOffice,
      hasLinkedTransaction: input.hasLinkedTransaction,
      hasOpenDraft: Boolean(
        input.activeHandoffDraft &&
        input.activeHandoffDraft.status !== FrontOfficeHandoffStatus.committed,
      ),
      hasCommittedRecord,
      committedTransactionId:
        input.activeHandoffDraft?.committedTransactionId ?? null,
      summary:
        input.activeHandoffDraft?.summary?.trim() ||
        (input.activeHandoffDraft
          ? buildFrontOfficeHandoffSummary(
              input.activeHandoffDraft.stageLabel,
              input.clientFullName,
            )
          : `Current stage · ${input.stage}`),
      destinationTarget: handoffAction?.target ?? null,
      action: handoffAction,
    },
  };
}
