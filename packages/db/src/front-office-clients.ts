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
import { prisma } from "./client";
import {
  buildFrontOfficeHandoffCreateHref,
  buildFrontOfficeHandoffSummary,
  isFrontOfficeStageReadyForBackOffice,
} from "./front-office-contracts";
import {
  buildFrontOfficeAiAcceptedActionBreakdown,
  buildFrontOfficeAiAcceptedActionBreakdownWindows,
  buildFrontOfficeAiBoundaryContract,
  buildFrontOfficeAiFollowUpAction,
  buildFrontOfficeAiSuggestionHistoryIndex,
  buildFrontOfficeAiSuggestionInsight,
  formatFrontOfficeAiActionTypeLabel,
  formatFrontOfficeAiSourceSurfaceLabel,
  mapFrontOfficeAiAcceptedActionOutcome,
  type FrontOfficeAiFollowUpKind,
  type FrontOfficeAiSuggestionHistoryIndex,
} from "./front-office-ai";
import { formatDateTimeLabel } from "./date-time";
import { buildFrontOfficeAppointmentExternalLinks } from "./front-office-calendar-links";
import {
  getFrontOfficeAppointmentBridgeStatusMap,
  getFrontOfficeAppointmentExternalWorkflowState,
  frontOfficeAppointmentExternalWorkflowStatuses,
  type FrontOfficeAppointmentBridgeStatus,
  type FrontOfficeAppointmentExternalWorkflowStatus,
} from "./front-office-appointments";
import {
  defaultLeaseReminderLeadDays,
  resolveLeaseReminderDates,
} from "./lease-reminders";
import { listTransactionOffersSnapshot } from "./offers";

export type FrontOfficeClientDetailTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export const frontOfficeClientDetailNextStepIds = {
  followUp: "follow_up",
  appointment: "appointment",
  listingOutput: "listing_output",
  offerPrep: "offer_prep",
  inspectionSupport: "inspection_support",
  closingSuggestion: "closing_suggestion",
} as const;

export type FrontOfficeClientDetailNextStepId =
  (typeof frontOfficeClientDetailNextStepIds)[keyof typeof frontOfficeClientDetailNextStepIds];

export const frontOfficeClientDetailActionTargets = {
  frontOfficeFollowUp: "front_office_follow_up",
  frontOfficeCalendar: "front_office_calendar",
  frontOfficeListingOutput: "front_office_listing_output",
  backOfficeCreate: "back_office_create",
  backOfficeTransaction: "back_office_transaction",
  backOfficeOffers: "back_office_offers",
  backOfficeTasks: "back_office_tasks",
  backOfficeSignatures: "back_office_signatures",
  backOfficeIncomingUpdates: "back_office_incoming_updates",
  clientPdf: "client_pdf",
  externalGoogleCalendar: "external_google_calendar",
  externalOutlookCalendar: "external_outlook_calendar",
  externalIcs: "external_ics",
  externalEmailBrief: "external_email_brief",
} as const;

export type FrontOfficeClientDetailActionTarget =
  (typeof frontOfficeClientDetailActionTargets)[keyof typeof frontOfficeClientDetailActionTargets];

export const frontOfficeClientDetailActionKinds = {
  createFollowUp: "create_follow_up",
  reviewFollowUpQueue: "review_follow_up_queue",
  openCalendar: "open_calendar",
  openListingOutput: "open_listing_output",
  openBackOfficeCreate: "open_back_office_create",
  openBackOfficeRecord: "open_back_office_record",
  openBackOfficeOffers: "open_back_office_offers",
  openBackOfficeTasks: "open_back_office_tasks",
  openBackOfficeSignatures: "open_back_office_signatures",
  openBackOfficeIncomingUpdates: "open_back_office_incoming_updates",
  openTransaction: "open_transaction",
  downloadClientPdf: "download_client_pdf",
  openGoogleCalendar: "open_google_calendar",
  openOutlookCalendar: "open_outlook_calendar",
  downloadIcs: "download_ics",
  openEmailBrief: "open_email_brief",
} as const;

export type FrontOfficeClientDetailActionKind =
  (typeof frontOfficeClientDetailActionKinds)[keyof typeof frontOfficeClientDetailActionKinds];

export const frontOfficeClientDetailOwnershipKeys = {
  frontOffice: "front_office",
  frontOfficeSupportsBackOffice: "front_office_supports_back_office",
  moveToBackOffice: "move_to_back_office",
  backOffice: "back_office",
  returnToFrontOffice: "return_to_front_office",
  inactive: "inactive",
} as const;

export type FrontOfficeClientDetailOwnershipKey =
  (typeof frontOfficeClientDetailOwnershipKeys)[keyof typeof frontOfficeClientDetailOwnershipKeys];

export const frontOfficeClientDetailDecisionKeys = {
  stayInFrontOffice: "stay_in_front_office",
  moveToBackOffice: "move_to_back_office",
  formalWorkflowInBackOffice: "formal_workflow_in_back_office",
  returnToFrontOffice: "return_to_front_office",
} as const;

export type FrontOfficeClientDetailDecisionKey =
  (typeof frontOfficeClientDetailDecisionKeys)[keyof typeof frontOfficeClientDetailDecisionKeys];

export const frontOfficeClientDetailBoundaryStates = {
  frontOfficeActive: "front_office_active",
  readyForBackOffice: "ready_for_back_office",
  backOfficeLive: "back_office_live",
  postCloseFrontOffice: "post_close_front_office",
  cancelledReentry: "cancelled_reentry",
} as const;

export type FrontOfficeClientDetailBoundaryState =
  (typeof frontOfficeClientDetailBoundaryStates)[keyof typeof frontOfficeClientDetailBoundaryStates];

export const frontOfficeClientDetailFollowUpCueKeys = {
  overdueTask: "overdue_task",
  leaseReminderDue: "lease_reminder_due",
  staleActiveClient: "stale_active_client",
  overdueNextTouch: "overdue_next_touch",
  missingNextTouch: "missing_next_touch",
  viewingScheduled: "viewing_scheduled",
  viewingFeedbackDue: "viewing_feedback_due",
  lostNurture: "lost_nurture",
  postCloseFollowUp: "post_close_follow_up",
  backOfficeTransition: "back_office_transition",
  pendingBlocker: "pending_blocker",
  healthyTouch: "healthy_touch",
  defaultFollowUp: "default_follow_up",
} as const;

export type FrontOfficeClientDetailFollowUpCueKey =
  (typeof frontOfficeClientDetailFollowUpCueKeys)[keyof typeof frontOfficeClientDetailFollowUpCueKeys];

export const frontOfficeClientDetailWorkflowPressureKeys = {
  healthy: "healthy",
  overdueFollowUp: "overdue_follow_up",
  leaseReminderDue: "lease_reminder_due",
  staleActiveClient: "stale_active_client",
  overdueNextTouch: "overdue_next_touch",
  missingNextTouch: "missing_next_touch",
} as const;

export type FrontOfficeClientDetailWorkflowPressureKey =
  (typeof frontOfficeClientDetailWorkflowPressureKeys)[keyof typeof frontOfficeClientDetailWorkflowPressureKeys];

export const frontOfficeClientDetailWorkflowNextStepKeys = {
  postCloseFollowUp: "post_close_follow_up",
  workFromBackOfficeRecord: "work_from_back_office_record",
  moveIntoBackOffice: "move_into_back_office",
  confirmShowingLogistics: "confirm_showing_logistics",
  captureShowingFeedback: "capture_showing_feedback",
  placeNurtureReminder: "place_nurture_reminder",
  clarifyPendingBlocker: "clarify_pending_blocker",
  startLeaseFollowUp: "start_lease_follow_up",
  scheduleNextTouch: "schedule_next_touch",
  trackSharedTransaction: "track_shared_transaction",
} as const;

export type FrontOfficeClientDetailWorkflowNextStepKey =
  (typeof frontOfficeClientDetailWorkflowNextStepKeys)[keyof typeof frontOfficeClientDetailWorkflowNextStepKeys];

export const frontOfficeClientDetailSendEngagementKeys = {
  notOpened: "not_opened",
  opened: "opened",
  revisited: "revisited",
} as const;

export type FrontOfficeClientDetailSendEngagementKey =
  (typeof frontOfficeClientDetailSendEngagementKeys)[keyof typeof frontOfficeClientDetailSendEngagementKeys];

export const frontOfficeClientDetailBridgeActivityStates = {
  idle: "idle",
  logged: "logged",
} as const;

export type FrontOfficeClientDetailBridgeActivityState =
  (typeof frontOfficeClientDetailBridgeActivityStates)[keyof typeof frontOfficeClientDetailBridgeActivityStates];

export const frontOfficeClientDetailHandoffStates = {
  none: "none",
  draft: FrontOfficeHandoffStatus.draft,
  ready: FrontOfficeHandoffStatus.ready,
  committed: FrontOfficeHandoffStatus.committed,
} as const;

export type FrontOfficeClientDetailHandoffState =
  | FrontOfficeHandoffStatus
  | (typeof frontOfficeClientDetailHandoffStates)["none"];

export type FrontOfficeClientDetailAction = {
  label: string;
  href: string;
  opensInNewTab: boolean;
  kind: FrontOfficeClientDetailActionKind;
  target: FrontOfficeClientDetailActionTarget;
};

export type FrontOfficeClientDetailOutputHandoff = {
  source: "appointment" | "send_record" | "dossier";
  clientId: string;
  appointmentId: string | null;
  hasAppointmentContext: boolean;
  hasListingContext: boolean;
  action: FrontOfficeClientDetailAction;
};

export type FrontOfficeClientDetailWorkbenchReturn = {
  label: string;
  description: string;
  href: string;
};

export type FrontOfficeClientDetailFollowUpCue = {
  key: FrontOfficeClientDetailFollowUpCueKey;
  tone: FrontOfficeClientDetailTone;
  label: string;
  description: string;
  dueLabel: string;
  dueAtValue: string;
  ownershipKey: FrontOfficeClientDetailOwnershipKey;
  targetStepId: FrontOfficeClientDetailNextStepId;
  action: FrontOfficeClientDetailAction;
};

export type FrontOfficeClientDetailBackOfficeHandoff = {
  state: FrontOfficeClientDetailHandoffState;
  isReadyForBackOffice: boolean;
  hasLinkedTransaction: boolean;
  hasOpenDraft: boolean;
  hasCommittedRecord: boolean;
  committedTransactionId: string | null;
  summary: string;
  destinationTarget: FrontOfficeClientDetailActionTarget | null;
  action: FrontOfficeClientDetailAction | null;
};

export type FrontOfficeClientDetailContract = {
  boundaryState: FrontOfficeClientDetailBoundaryState;
  decisionKey: FrontOfficeClientDetailDecisionKey;
  currentStepId: FrontOfficeClientDetailNextStepId;
  primaryAction: FrontOfficeClientDetailAction;
  followUpCue: FrontOfficeClientDetailFollowUpCue;
  handoff: FrontOfficeClientDetailBackOfficeHandoff;
};

export type FrontOfficeClientDetailStageHistoryItem = {
  id: string;
  title: string;
  description: string;
  actorLabel: string;
  noteLabel: string;
  changedAtLabel: string;
  changedAtValue: string;
  tone: FrontOfficeClientDetailTone;
};

export type FrontOfficeClientDetailAppointmentItem = {
  id: string;
  title: string;
  typeValue: AppointmentType;
  typeLabel: string;
  typeTone: FrontOfficeClientDetailTone;
  statusValue: AppointmentStatus;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  externalStatusValue: FrontOfficeAppointmentExternalWorkflowStatus;
  externalStatusLabel: string;
  externalStatusTone: FrontOfficeClientDetailTone;
  externalStatusDetail: string;
  externalNextActionAtValue: string;
  externalNextActionAtLabel: string;
  calendarWritebackHref: string;
  bridgeNextStepLabel: string;
  bridgeNextStepDetail: string;
  startsAtValue: string;
  startsAtLabel: string;
  locationLabel: string;
  contextLabel: string;
  outputHandoff: FrontOfficeClientDetailOutputHandoff;
  listingOutputHref: string;
  googleCalendarAction: FrontOfficeClientDetailAction;
  googleCalendarHref: string;
  outlookCalendarAction: FrontOfficeClientDetailAction;
  outlookCalendarHref: string;
  icsAction: FrontOfficeClientDetailAction;
  icsHref: string;
  emailBriefAction: FrontOfficeClientDetailAction | null;
  emailBriefHref: string | null;
  bridgeActivityState: FrontOfficeClientDetailBridgeActivityState;
  bridgeStatusLabel: string;
  bridgeStatusDetail: string;
  bridgeStatusTone: FrontOfficeClientDetailTone;
  bridgeActionLabel: string;
  bridgeLoggedAtLabel: string;
  hasBridgeActivity: boolean;
};

export type FrontOfficeClientDetailTaskItem = {
  id: string;
  title: string;
  statusValue: TaskStatus;
  dueLabel: string;
  dueAtValue: string;
  statusLabel: string;
  queueLabel: string;
  helperLabel: string;
  tone: FrontOfficeClientDetailTone;
  assigneeLabel: string;
  needsAttention: boolean;
  isResolved: boolean;
  createdAtLabel: string;
  createdAtValue: string;
  updatedAtLabel: string;
  updatedAtValue: string;
  timelineAtLabel: string;
  timelineAtValue: string;
  timelineTitle: string;
  timelineDescription: string;
  timelineContext: string;
};

export type FrontOfficeClientDetailSendRecordItem = {
  id: string;
  title: string;
  channelValue: FrontOfficeSendChannel;
  channelLabel: string;
  materialTypeValue: FrontOfficeSendMaterialType;
  stageLabel: string;
  appointmentId: string | null;
  appointmentLabel: string;
  sentAtValue: string;
  sentAtLabel: string;
  engagementKey: FrontOfficeClientDetailSendEngagementKey;
  openCount: number;
  engagementLabel: string;
  engagementTone: FrontOfficeClientDetailTone;
  lastActivityLabel: string;
  outputHandoff: FrontOfficeClientDetailOutputHandoff;
  href: string;
};

export type FrontOfficeClientDetailHandoffItem = {
  id: string;
  stageLabel: string;
  statusValue: FrontOfficeHandoffStatus;
  statusLabel: string;
  tone: FrontOfficeClientDetailTone;
  summary: string;
  committedTransactionId: string | null;
  destinationTarget: FrontOfficeClientDetailActionTarget;
  action: FrontOfficeClientDetailAction;
  updatedAtLabel: string;
  updatedAtValue: string;
  href: string;
};

export type FrontOfficeClientDetailTransactionItem = {
  id: string;
  label: string;
  statusLabel: string;
  roleLabel: string;
  href: string;
};

export type FrontOfficeClientDetailNegotiationOfferItem = {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  partyLabel: string;
  priceLabel: string;
  expirationLabel: string;
  updatedAtLabel: string;
  href: string;
};

export type FrontOfficeClientDetailNegotiation = {
  stageLabel: string;
  stageTone: FrontOfficeClientDetailTone;
  boundaryLabel: string;
  boundaryTone: FrontOfficeClientDetailTone;
  boundaryTitle: string;
  boundaryDescription: string;
  boundaryMetaLabel: string;
  offerCount: number;
  expiringSoonCount: number;
  acceptedOfferLabel: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  offers: FrontOfficeClientDetailNegotiationOfferItem[];
};

export type FrontOfficeClientDetailInspectionItem = {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  contextLabel: string;
  description: string;
  metaLabel: string;
  actionLabel: string;
  href: string;
};

export type FrontOfficeClientDetailInspection = {
  boundaryLabel: string;
  boundaryTone: FrontOfficeClientDetailTone;
  boundaryTitle: string;
  boundaryDescription: string;
  boundaryMetaLabel: string;
  openTaskCount: number;
  overdueTaskCount: number;
  pendingSignatureCount: number;
  pendingIncomingUpdateCount: number;
  primaryActionLabel: string;
  primaryActionHref: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  items: FrontOfficeClientDetailInspectionItem[];
};

export type FrontOfficeClientDetailClosingItem = {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  contextLabel: string;
  description: string;
  metaLabel: string;
  actionLabel: string;
  href: string;
  opensInNewTab: boolean;
};

export type FrontOfficeClientDetailClosing = {
  boundaryLabel: string;
  boundaryTone: FrontOfficeClientDetailTone;
  boundaryTitle: string;
  boundaryDescription: string;
  boundaryMetaLabel: string;
  transactionStatusLabel: string;
  keyDateLabel: string;
  nextTouchLabel: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  primaryActionOpensInNewTab: boolean;
  emptyStateTitle: string;
  emptyStateDescription: string;
  suggestions: FrontOfficeClientDetailClosingItem[];
};

export type FrontOfficeClientDetailAiDraftChannel = "call" | "sms" | "email";

export type FrontOfficeClientDetailAiDraft = {
  id: string;
  title: string;
  channelKey: FrontOfficeClientDetailAiDraftChannel;
  channelLabel: string;
  tone: FrontOfficeClientDetailTone;
  reasonLabel: string;
  subjectLine: string;
  body: string;
};

export type FrontOfficeClientDetailAiFollowUpSuggestion = {
  title: string;
  dueAt: string;
};

export type FrontOfficeClientDetailAiAcceptedActionItem = {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  description: string;
  contextLabel: string;
  helperLabel: string;
  actionLabel: string;
  href: string;
};

export type FrontOfficeClientDetailAiAcceptedActions = {
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
  items: FrontOfficeClientDetailAiAcceptedActionItem[];
};

export type FrontOfficeClientDetailAiSuggestions = {
  suggestionKind: FrontOfficeAiFollowUpKind;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  statusTitle: string;
  summary: string;
  helperText: string;
  groundingSignals: string[];
  rankingSignals: string[];
  boundaryLabel: string;
  boundaryTone: FrontOfficeClientDetailTone;
  boundaryDescription: string;
  primaryActionReason: string;
  oneClickReason: string;
  followUpSuggestion: FrontOfficeClientDetailAiFollowUpSuggestion | null;
  allowsDirectFollowUpCreation: boolean;
  primaryActionLabel: string;
  primaryActionHref: string;
  primaryActionOpensInNewTab: boolean;
  drafts: FrontOfficeClientDetailAiDraft[];
};

export type FrontOfficeClientDetailWorkflowSignal = {
  pressureKey: FrontOfficeClientDetailWorkflowPressureKey;
  pressureLabel: string;
  pressureTone: FrontOfficeClientDetailTone;
  pressureDescription: string;
  nextStepKey: FrontOfficeClientDetailWorkflowNextStepKey;
  nextStepTitle: string;
  nextStepTone: FrontOfficeClientDetailTone;
  nextStepDescription: string;
  action: FrontOfficeClientDetailAction;
  actionLabel: string;
  actionHref: string;
};

export type FrontOfficeClientDetailNextStepRailItem = {
  id: FrontOfficeClientDetailNextStepId;
  stepLabel: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  ownershipKey: FrontOfficeClientDetailOwnershipKey;
  ownershipLabel: string;
  ownershipTone: FrontOfficeClientDetailTone;
  title: string;
  description: string;
  metaLabel: string;
  action: FrontOfficeClientDetailAction;
  actionLabel: string;
  actionHref: string;
  actionOpensInNewTab: boolean;
  returnPoint: FrontOfficeClientDetailWorkbenchReturn;
  returnDescription: string;
  isCurrent: boolean;
};

export type FrontOfficeClientDetailNextStepRail = {
  decisionKey: FrontOfficeClientDetailDecisionKey;
  decisionLabel: string;
  decisionTone: FrontOfficeClientDetailTone;
  decisionTitle: string;
  decisionDescription: string;
  decisionMetaLabel: string;
  currentStepId: FrontOfficeClientDetailNextStepId;
  primaryAction: FrontOfficeClientDetailAction;
  primaryActionLabel: string;
  primaryActionHref: string;
  primaryActionOpensInNewTab: boolean;
  items: FrontOfficeClientDetailNextStepRailItem[];
};

export type FrontOfficeClientDetailLeaseReminder = {
  leaseEndDateValue: string;
  leaseEndDateLabel: string;
  reminderAtValue: string;
  reminderAtLabel: string;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  helperText: string;
  isAutoScheduled: boolean;
  needsAttention: boolean;
  timelineAtLabel: string;
  timelineAtValue: string;
  timelineTitle: string;
  timelineDescription: string;
};

export type FrontOfficeClientDetailPlaybookItem = {
  id: string;
  title: string;
  description: string;
};

export type FrontOfficeClientDetailPlaybookTemplate = {
  id: string;
  label: string;
  channelLabel: string;
  body: string;
};

export type FrontOfficeClientDetailPlaybookObjection = {
  id: string;
  objection: string;
  response: string;
};

export type FrontOfficeClientDetailPlaybook = {
  focusLabel: string;
  focusDescription: string;
  introScript: string;
  callChecklist: FrontOfficeClientDetailPlaybookItem[];
  conversationPrompts: FrontOfficeClientDetailPlaybookItem[];
  objectionHandling: FrontOfficeClientDetailPlaybookObjection[];
  messageTemplates: FrontOfficeClientDetailPlaybookTemplate[];
};

export type FrontOfficeClientDetailSnapshot = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  stage: string;
  stageTone: FrontOfficeClientDetailTone;
  sourceLabel: string;
  intentLabel: string;
  budgetLabel: string;
  preferredAreasLabel: string;
  notesLabel: string;
  ownerLabel: string;
  lastTouchLabel: string;
  nextTouchLabel: string;
  summary: {
    openTaskCount: number;
    overdueTaskCount: number;
    completedTaskCount: number;
    attentionTaskCount: number;
    dueSoonTaskCount: number;
    upcomingAppointmentCount: number;
    stageHistoryCount: number;
    openHandoffCount: number;
  };
  engagement: {
    sendCount: number;
    openedSendCount: number;
    revisitCount: number;
    lastEngagementLabel: string;
  };
  leaseReminder: FrontOfficeClientDetailLeaseReminder;
  negotiation: FrontOfficeClientDetailNegotiation;
  inspection: FrontOfficeClientDetailInspection;
  closing: FrontOfficeClientDetailClosing;
  aiSuggestions: FrontOfficeClientDetailAiSuggestions;
  aiAcceptedActions: FrontOfficeClientDetailAiAcceptedActions;
  followUpCue: FrontOfficeClientDetailFollowUpCue;
  contract: FrontOfficeClientDetailContract;
  workflow: FrontOfficeClientDetailWorkflowSignal;
  nextStepRail: FrontOfficeClientDetailNextStepRail;
  playbook: FrontOfficeClientDetailPlaybook;
  stageHistory: FrontOfficeClientDetailStageHistoryItem[];
  appointments: FrontOfficeClientDetailAppointmentItem[];
  followUpTasks: FrontOfficeClientDetailTaskItem[];
  sendRecords: FrontOfficeClientDetailSendRecordItem[];
  handoffs: FrontOfficeClientDetailHandoffItem[];
  linkedTransactions: FrontOfficeClientDetailTransactionItem[];
};

export type GetFrontOfficeClientDetailInput = {
  organizationId: string;
  viewerMembershipId: string;
  clientId: string;
  timeZone?: string | null;
};

function formatCurrency(value: number | null | undefined) {
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

function formatBudgetRange(
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
    year: "numeric",
    timeZone: timeZone ?? undefined,
  });
}

function formatDateValue(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

function formatDateTimeValue(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString();
}

function getCalendarDayDifference(value: Date, now: Date) {
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

function formatCalendarDistanceLabel(value: Date, now: Date) {
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

function buildClientAction(input: {
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

const frontOfficeCalendarViews = {
  replyDue: "reply_due",
  confirmationPending: "confirmation_pending",
  confirmed: "confirmed",
  touchDue: "touch_due",
  missingNextTouch: "missing_next_touch",
  rescheduleRequested: "reschedule_requested",
  bridgeLogged: "bridge_logged",
} as const;

type FrontOfficeCalendarView =
  (typeof frontOfficeCalendarViews)[keyof typeof frontOfficeCalendarViews];

const frontOfficeListingsLanes = {
  sendRescue: "send-rescue",
  followThrough: "follow-through",
  draftLane: "draft-lane",
} as const;

type FrontOfficeListingsLane =
  (typeof frontOfficeListingsLanes)[keyof typeof frontOfficeListingsLanes];

function buildClientRouteHref(
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

function buildFrontOfficeCalendarHref(input: {
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

function buildFrontOfficeListingsHref(input: {
  clientId: string;
  appointmentId?: string | null;
  lane?: FrontOfficeListingsLane | null;
}) {
  return buildClientRouteHref("/agent/listings", [
    ["lane", input.lane ?? null],
    ["clientId", input.clientId],
    ["appointmentId", input.appointmentId ?? null],
  ]);
}

function resolveFrontOfficeCalendarView(input: {
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

function resolveNextStepRailCalendarView(input: {
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

function resolveFrontOfficeListingsLane(input: {
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

const FRONT_OFFICE_FOLLOW_UP_FORM_ID = "front-office-follow-up-form";
const FRONT_OFFICE_FOLLOW_UP_QUEUE_ID = "front-office-follow-up-queue";

function pickEarliestDate(...values: Array<Date | null | undefined>) {
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

function buildLeaseReminderSnapshot(input: {
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
    ? "Lease renewal follow-up is in the live execution lane"
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

function formatRelativeDueLabel(
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

function mapSendEngagementKey(
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

function mapBridgeActivityState(
  bridgeStatus: FrontOfficeAppointmentBridgeStatus | null | undefined,
): FrontOfficeClientDetailBridgeActivityState {
  return bridgeStatus?.hasBridgeActivity
    ? frontOfficeClientDetailBridgeActivityStates.logged
    : frontOfficeClientDetailBridgeActivityStates.idle;
}

function mapClientStageTone(stage: string): FrontOfficeClientDetailTone {
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

function mapAppointmentTypeTone(
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

function mapAppointmentStatusTone(
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

function mapTaskTone(
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

function formatTaskStatusLabel(status: TaskStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatTaskDueLabel(
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

function buildTaskQueueLabel(
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

function buildTaskHelperLabel(input: {
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

function buildTaskTimelineTitle(input: {
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

function buildTaskTimelineDescription(input: {
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

function buildTaskTimelineContext(input: {
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
): FrontOfficeClientDetailTone {
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

function getClientFirstName(fullName: string) {
  const [firstName] = fullName.trim().split(/\s+/);
  return firstName?.trim() || "there";
}

function hasMeaningfulBudgetLabel(label: string) {
  return label.trim() !== "Budget not captured";
}

function hasMeaningfulAreasLabel(label: string) {
  return label.trim() !== "Areas not captured";
}

function hasMeaningfulIntentLabel(label: string) {
  return label.trim() !== "Intent not captured";
}

function buildPlaybookItem(
  id: string,
  title: string,
  description: string,
): FrontOfficeClientDetailPlaybookItem {
  return { id, title, description };
}

function buildPlaybookTemplate(
  id: string,
  label: string,
  channelLabel: string,
  body: string,
): FrontOfficeClientDetailPlaybookTemplate {
  return { id, label, channelLabel, body };
}

function buildPlaybookObjection(
  id: string,
  objection: string,
  response: string,
): FrontOfficeClientDetailPlaybookObjection {
  return { id, objection, response };
}

function buildFrontOfficePlaybook(input: {
  fullName: string;
  ownerLabel: string;
  stage: string;
  intentLabel: string;
  budgetLabel: string;
  preferredAreasLabel: string;
  upcomingAppointmentCount: number;
}): FrontOfficeClientDetailPlaybook {
  const normalizedStage = input.stage.trim().toLowerCase();
  const firstName = getClientFirstName(input.fullName);
  const agentLabel =
    input.ownerLabel.trim() && input.ownerLabel !== "Unassigned"
      ? input.ownerLabel
      : "Acre";
  const budgetContext = hasMeaningfulBudgetLabel(input.budgetLabel)
    ? input.budgetLabel
    : "the right budget";
  const areaContext = hasMeaningfulAreasLabel(input.preferredAreasLabel)
    ? input.preferredAreasLabel
    : "the right neighborhoods";
  const intentContext = hasMeaningfulIntentLabel(input.intentLabel)
    ? input.intentLabel
    : "this move";
  const appointmentContext = input.upcomingAppointmentCount
    ? "There is already an appointment on the calendar, so this call should tighten the plan instead of reopening discovery."
    : "No appointment is booked yet, so the next touch should either narrow the search or book the next showing.";

  if (isFrontOfficeStageReadyForBackOffice(input.stage)) {
    return {
      focusLabel: "Offer / application coordination",
      focusDescription:
        "Use this conversation to lock the client-facing terms, document readiness, and deadlines before the formal Back Office file does the heavy lifting.",
      introScript: `Hi ${firstName}, this is ${agentLabel} from Acre. Before we push this fully into the formal Back Office workflow, I want to lock the exact terms, timeline, and supporting documents so nothing slows us down.`,
      callChecklist: [
        buildPlaybookItem(
          "confirm-property",
          "Confirm the exact property and target terms",
          "Repeat the address or listing, confirm the target price or rent range, and make sure both sides are talking about the same unit and timing.",
        ),
        buildPlaybookItem(
          "confirm-documents",
          "Check document readiness",
          "Confirm IDs, proof of funds, pre-approval, landlord package items, or any supporting paperwork that must be in hand today.",
        ),
        buildPlaybookItem(
          "confirm-decision-makers",
          "Lock the sign-off path",
          "Ask who needs to review or sign, and when each decision-maker will be available so the BO handoff is not blocked by missing approvals.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "terms-flexibility",
          "Price / term flexibility",
          "Ask where the client has room to move on price, closing, contingencies, lease length, or concessions.",
        ),
        buildPlaybookItem(
          "deadline-risk",
          "Deadline pressure",
          "Clarify what happens if a response or signature slips, and which deadlines are truly hard stops.",
        ),
        buildPlaybookItem(
          "bo-handoff-brief",
          "BO handoff brief",
          "Summarize what the Back Office team needs to know on day one: timeline, terms, blockers, and any personality or communication preferences.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "wait-before-submit",
          "I want to wait a little longer before we submit.",
          "Acknowledge the hesitation, then clarify what new information would materially change the decision so the team can either get that answer fast or agree on a deadline to decide.",
        ),
        buildPlaybookObjection(
          "nervous-about-paperwork",
          "The paperwork feels overwhelming.",
          "Break the process into the next two concrete actions only, tell them which documents matter first, and explain that the BO file will keep the formal checklist organized once this handoff is opened.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "docs-request-email",
          "Document request",
          "Email",
          `Subject: Next items for ${intentContext}\n\nHi ${firstName},\n\nTo keep this moving, please send the remaining documents for ${intentContext}. Right now I want to confirm the target terms, your availability to sign, and anything still outstanding on the paperwork side.\n\nOnce those items are in, I will push the formal file forward and keep you updated on the next deadline.\n\nThanks,\n${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "offer-recap-text",
          "Offer / application recap",
          "Text",
          `Hi ${firstName}, quick recap from our call: we are aligned on the target terms, the remaining documents, and the timing to move this into the formal process. Send anything outstanding when you can, and I will keep the next steps tight from there.\n\n- ${agentLabel}`,
        ),
      ],
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("scheduled")
  ) {
    return {
      focusLabel: "Showing confirmation",
      focusDescription:
        "Confirm logistics and decision criteria before the tour, so the showing is about decision-making instead of basic coordination.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. I am confirming the showing details and want to make sure we focus on the right features while you are there so the appointment gives us a real next step.`,
      callChecklist: [
        buildPlaybookItem(
          "confirm-logistics",
          "Confirm time, address, and access",
          "Repeat the appointment window, exact location, access instructions, and any building entry notes so nobody arrives uncertain.",
        ),
        buildPlaybookItem(
          "confirm-attendees",
          "Confirm who is attending",
          "Ask who will join the showing and whether any decision-maker still needs a separate walkthrough or recap afterward.",
        ),
        buildPlaybookItem(
          "confirm-day-of-plan",
          "Set the day-of communication plan",
          "Confirm the best number for day-of updates, parking or transit questions, and what to do if timing shifts.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "must-see-features",
          "Top 3 must-see features",
          "Ask what absolutely needs to feel right during the showing so you can steer the walkthrough around those priorities.",
        ),
        buildPlaybookItem(
          "deal-breakers",
          "Immediate pass triggers",
          "Ask what would make them rule the listing out on the spot so you can qualify the fit faster.",
        ),
        buildPlaybookItem(
          "backup-plan",
          "Backup options",
          "Confirm whether they want one or two fallback listings lined up if this showing misses.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "need-reschedule",
          "I may need to reschedule.",
          "Confirm whether timing or motivation changed. If the interest is still real, move the appointment before ending the call so the momentum stays intact.",
        ),
        buildPlaybookObjection(
          "want-more-options-first",
          "Can you just send a few more options first?",
          "Agree to send backups, but keep the current showing unless there is a real mismatch. The appointment gives cleaner feedback than another round of blind browsing.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "showing-confirmation-text",
          "Showing confirmation",
          "Text",
          `Hi ${firstName}, confirming our showing. I will send the final address and access notes before we meet. If anything changes on timing, text me here so I can adjust quickly.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "day-of-reminder-text",
          "Day-of reminder",
          "Text",
          `Hi ${firstName}, quick reminder for today's showing. I have the timing and access notes ready, and I will keep the walkthrough focused on the features that matter most to you.\n\n- ${agentLabel}`,
        ),
      ],
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("completed")
  ) {
    return {
      focusLabel: "Feedback capture",
      focusDescription:
        "Memory is freshest right after the visit. Use this call to separate polite reactions from real intent and decide whether the next move is a second showing, shortlist, or BO-ready handoff.",
      introScript: `Hi ${firstName}, thanks again for seeing the property. I want to grab your reaction while it is still fresh so I can either narrow the shortlist or move quickly on the next step.`,
      callChecklist: [
        buildPlaybookItem(
          "likes-dislikes",
          "Capture what matched and what missed",
          "Ask for one thing they liked, one thing that felt off, and whether that issue is a deal-breaker or only a trade-off.",
        ),
        buildPlaybookItem(
          "price-readiness",
          "Test price or rent resistance",
          "Clarify whether hesitation is about price, condition, layout, timing, or another listing still in the mix.",
        ),
        buildPlaybookItem(
          "next-decision",
          "Leave the call with a concrete next action",
          "Do not end with 'let me know.' Set the next showing, recap list, or offer/application prep step before you hang up.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "compare-to-shortlist",
          "Compare against current shortlist",
          "Ask where this property ranks against everything else they have seen so far and why.",
        ),
        buildPlaybookItem(
          "decision-gap",
          "Name the gap to decision",
          "Ask what still needs to be true before they would seriously consider moving forward.",
        ),
        buildPlaybookItem(
          "timing-after-showing",
          "Lock the follow-up window",
          "Agree on when they will decide between this listing and the backups so the dossier does not drift after the tour.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "need-to-think",
          "We need to think about it.",
          "Acknowledge that, then ask what exactly needs review and when they will know. Convert a vague pause into a specific follow-up date or decision milestone.",
        ),
        buildPlaybookObjection(
          "price-too-high",
          "It feels too expensive.",
          "Ask whether the issue is the absolute price, the value compared with alternatives, or the monthly payment. That tells you whether to negotiate, replace, or nurture.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "feedback-follow-up-text",
          "Feedback follow-up",
          "Text",
          `Hi ${firstName}, thanks again for the showing today. Send me the top one or two things that felt strongest and the biggest hesitation, and I will line up the smartest next step from there.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "shortlist-recap-email",
          "Shortlist recap",
          "Email",
          `Subject: Today's showing recap\n\nHi ${firstName},\n\nThanks again for taking the time to tour the property. I want to keep the next move simple: reply with what felt strongest, what felt weakest, and whether you want to compare this against backup options before making a decision.\n\nOnce I have that, I will tighten the shortlist and set the right follow-up.\n\nThanks,\n${agentLabel}`,
        ),
      ],
    };
  }

  if (normalizedStage.includes("lost")) {
    return {
      focusLabel: "Nurture re-entry",
      focusDescription:
        "A lost stage should still end with a respectful future touchpoint instead of silence. Keep the relationship warm without pretending the urgency still exists.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. I know the timing may not be right today, but I wanted to keep a light touchpoint open in case the plan changes and you want to restart quickly.`,
      callChecklist: [
        buildPlaybookItem(
          "why-paused",
          "Clarify why the search paused",
          "Capture the real reason the opportunity cooled off so future follow-up can be relevant instead of generic.",
        ),
        buildPlaybookItem(
          "future-window",
          "Ask for the next realistic window",
          "Get a month, season, or trigger event you can anchor the next reminder to.",
        ),
        buildPlaybookItem(
          "permission-to-return",
          "Keep the door open",
          "Ask how they want to be contacted if something especially relevant appears before the nurture reminder fires.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "what-changed",
          "What changed most?",
          "Ask whether budget, timeline, financing, family decision-making, or competition changed the plan.",
        ),
        buildPlaybookItem(
          "restart-trigger",
          "What would bring them back?",
          "Name the condition that would make them restart: a date, a price point, a neighborhood, or a new approval.",
        ),
        buildPlaybookItem(
          "future-channel",
          "Best future contact channel",
          "Confirm whether the next nurture touch should be text, email, or phone so the later reminder lands well.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "stop-for-now",
          "We are stopping for now.",
          "Respect that clearly, then ask for the best future moment to check back so the dossier has a real nurture date instead of a vague open loop.",
        ),
        buildPlaybookObjection(
          "working-with-someone-else",
          "We are working with someone else now.",
          "Stay professional and ask whether they want to keep your contact for backup help later. The goal is a clean relationship, not a hard sell.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "soft-check-in-text",
          "Soft nurture text",
          "Text",
          `Hi ${firstName}, just keeping a light touchpoint open in case your plans change. If timing opens back up or you want a quick market read, I am happy to help.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "future-reopen-email",
          "Future reopen email",
          "Email",
          `Subject: Keeping the door open\n\nHi ${firstName},\n\nI know the timing may not be right right now, so there is no pressure. I just wanted to keep the line open in case your plans change and you want to restart quickly.\n\nIf that happens, send me the latest timing, target budget, and areas you want to revisit, and I will pick it up from there.\n\nBest,\n${agentLabel}`,
        ),
      ],
    };
  }

  if (normalizedStage.includes("won")) {
    return {
      focusLabel: "Post-handoff client update",
      focusDescription:
        "Front Office should keep the client calm and informed while the formal record and deadlines now live in Back Office.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. The formal file is now moving forward, and I want to make sure you know what the next milestone is and how I will keep you posted.`,
      callChecklist: [
        buildPlaybookItem(
          "confirm-milestone",
          "Name the immediate next milestone",
          "Tell the client exactly what is happening next, whether that is paperwork, inspection, approval, deposit, or another BO milestone.",
        ),
        buildPlaybookItem(
          "confirm-update-channel",
          "Confirm update cadence",
          "Ask how often they want updates and which channel they trust most for process communication.",
        ),
        buildPlaybookItem(
          "capture-anxiety",
          "Surface hidden concerns",
          "Invite the client to say what feels uncertain now so the next update can address that directly instead of only repeating status.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "what-happens-next",
          "Explain the process in plain English",
          "Translate the formal BO step into a client-friendly explanation and confirm they understand what is expected from them.",
        ),
        buildPlaybookItem(
          "decision-timing",
          "Clarify when they need to act next",
          "Make sure they know the next date that requires a response, payment, signature, or scheduling choice.",
        ),
        buildPlaybookItem(
          "handoff-boundary",
          "Explain who handles what",
          "Reassure them that the formal record is active while you stay aligned on communication, support, and escalation.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "dont-understand-next-steps",
          "I do not really understand what happens now.",
          "Slow down, explain only the immediate milestone, and tell them what they do not need to worry about yet. The goal is clarity, not a full training session.",
        ),
        buildPlaybookObjection(
          "worried-about-delay",
          "I am worried this is taking too long.",
          "Acknowledge the delay, restate the current blocker or milestone, and give the next expected update window so the client is not left guessing.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "milestone-update-text",
          "Milestone update",
          "Text",
          `Hi ${firstName}, quick update: the formal file is moving and I will keep you posted on the next milestone as soon as I have it. If any question comes up in the meantime, send it here and I will keep it aligned.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "process-welcome-email",
          "Welcome to process email",
          "Email",
          `Subject: What happens next\n\nHi ${firstName},\n\nThe formal process is now underway. I will keep the communication simple: I will tell you what the next milestone is, what you need to do for that step, and when you can expect the following update.\n\nIf anything feels unclear, reply here and I will help translate it into the next action.\n\nThanks,\n${agentLabel}`,
        ),
      ],
    };
  }

  if (normalizedStage.includes("pending")) {
    return {
      focusLabel: "Unblock the file",
      focusDescription:
        "Pending should still feel active. Use the call to name the blocker, the owner, and the next date instead of letting the dossier sit quietly.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. I wanted to check what is still blocking the next step so we can either move it now or set a clear date to revisit it.`,
      callChecklist: [
        buildPlaybookItem(
          "name-blocker",
          "Name the actual blocker",
          "Do not accept 'still pending' as the answer. Pin down whether the delay is timing, documentation, another person, or missing inventory.",
        ),
        buildPlaybookItem(
          "assign-owner",
          "Assign the owner",
          "Confirm who owns the next move: the client, a decision-maker, the agent, or the BO workflow.",
        ),
        buildPlaybookItem(
          "set-date",
          "Leave with a real date",
          "If the blocker cannot be cleared immediately, agree on the next follow-up date before ending the conversation.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "what-can-move-now",
          "What can still move today?",
          "Even if the main blocker remains, ask whether a document, shortlist, or decision step can still advance now.",
        ),
        buildPlaybookItem(
          "hidden-objection",
          "Is there an unspoken hesitation?",
          "Pending often hides uncertainty. Ask what feels unresolved so you do not manage the wrong problem.",
        ),
        buildPlaybookItem(
          "deadline-cost",
          "What happens if this slips another week?",
          "This surfaces urgency without sounding pushy and helps the client decide whether the blocker really matters.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "waiting-on-someone",
          "We are waiting on someone else.",
          "Ask what that person needs in order to respond and whether you can package the ask more clearly. Turn passive waiting into a defined follow-up plan.",
        ),
        buildPlaybookObjection(
          "not-urgent-right-now",
          "It is not urgent right now.",
          "Acknowledge that, then ask what date would make it urgent again so the dossier gets a concrete next-touch instead of a vague pause.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "blocker-checkin-text",
          "Blocker check-in",
          "Text",
          `Hi ${firstName}, quick check-in so I can keep this moving cleanly: what is still blocking the next step, and what date should I anchor the follow-up to if it does not clear today?\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "status-check-email",
          "Status check email",
          "Email",
          `Subject: Quick status check\n\nHi ${firstName},\n\nI wanted to keep this from drifting. What is the current blocker, who owns the next move, and what date should we use for the next check-in if it is still unresolved?\n\nOnce I have that, I can keep the follow-up clean instead of guessing.\n\nThanks,\n${agentLabel}`,
        ),
      ],
    };
  }

  if (
    normalizedStage.includes("contacted") ||
    normalizedStage.includes("warm") ||
    normalizedStage.includes("qualified")
  ) {
    return {
      focusLabel: "Qualification follow-up",
      focusDescription:
        "Move the record from general interest into a defined shortlist by tightening intent, budget, area, and timing on this call.",
      introScript: `Hi ${firstName}, this is ${agentLabel}. I wanted to tighten the search before I send another round of options so everything I send is actually aligned with your timing, budget, and preferred areas.`,
      callChecklist: [
        buildPlaybookItem(
          "restate-brief",
          "Restate the brief back to them",
          `Repeat the current working picture for ${intentContext}, ${budgetContext}, and ${areaContext}, then ask what needs to be corrected.`,
        ),
        buildPlaybookItem(
          "narrow-search",
          "Reduce the search shape",
          "Try to leave the call with fewer neighborhoods, a firmer budget guardrail, or a clearer property type preference than you had before.",
        ),
        buildPlaybookItem(
          "set-tour-readiness",
          "Test tour readiness",
          "Ask what would need to be true for them to book a showing this week instead of staying in passive browsing mode.",
        ),
      ],
      conversationPrompts: [
        buildPlaybookItem(
          "must-have-vs-nice-to-have",
          "Must-have vs. nice-to-have",
          "Ask which features are true decision filters and which ones are only preferences.",
        ),
        buildPlaybookItem(
          "timing-trigger",
          "Timing trigger",
          "Ask what date or life event is driving the move so urgency is grounded in reality.",
        ),
        buildPlaybookItem(
          "decision-circle",
          "Who else is part of the decision?",
          "Clarify whether a partner, parent, roommate, or employer still needs to weigh in before a showing or application can happen.",
        ),
      ],
      objectionHandling: [
        buildPlaybookObjection(
          "still-browsing",
          "We are still browsing.",
          "That is fine, but ask what would make the browsing feel actionable. The goal is to turn vague browsing into criteria you can actually work with.",
        ),
        buildPlaybookObjection(
          "send-more-options",
          "Can you just send more options first?",
          "Agree to send more only after you tighten one variable. Otherwise the next batch just creates more noise and no progress.",
        ),
      ],
      messageTemplates: [
        buildPlaybookTemplate(
          "shortlist-text",
          "Shortlist follow-up",
          "Text",
          `Hi ${firstName}, I am tightening the shortlist around ${areaContext} and ${budgetContext}. Send me the top feature you care about most right now, and I will make the next batch more precise.\n\n- ${agentLabel}`,
        ),
        buildPlaybookTemplate(
          "qualification-email",
          "Qualification recap",
          "Email",
          `Subject: Tightening the shortlist\n\nHi ${firstName},\n\nBefore I send the next round of options, I want to make sure I am aiming at the right search. Right now I am working from ${intentContext}, ${budgetContext}, and ${areaContext}.\n\nReply with anything that should change, especially around timing, top must-haves, and the neighborhoods that matter most.\n\nThanks,\n${agentLabel}`,
        ),
      ],
    };
  }

  return {
    focusLabel: "First call",
    focusDescription: `Use the first conversation to qualify ${intentContext}, timing, budget, and areas quickly so the next move is intentional instead of generic. ${appointmentContext}`,
    introScript: `Hi ${firstName}, this is ${agentLabel} from Acre. I wanted to make sure I understand what you are looking for before I send a random batch of options. Do you have two or three minutes to go over timing, budget, and the areas that matter most?`,
    callChecklist: [
      buildPlaybookItem(
        "timing",
        "Confirm the move timeline",
        "Ask what is driving the timing and whether they are making a move this month, this season, or only exploring for later.",
      ),
      buildPlaybookItem(
        "budget",
        "Confirm the working budget",
        `Use ${budgetContext} as the starting point and tighten whether that number is hard, flexible, or still unknown.`,
      ),
      buildPlaybookItem(
        "areas",
        "Confirm the priority areas",
        `Use ${areaContext} as the starting map and reduce it to the neighborhoods they would actually tour first.`,
      ),
    ],
    conversationPrompts: [
      buildPlaybookItem(
        "goal",
        "What problem are they solving?",
        "Ask why this move matters now. The answer usually reveals the real urgency and filters out nice-to-have conversations.",
      ),
      buildPlaybookItem(
        "readiness",
        "How ready are they to act?",
        "Ask what still needs to happen before they would book a showing, apply, or seriously narrow choices.",
      ),
      buildPlaybookItem(
        "decision-makers",
        "Who else is involved?",
        "Clarify who will help decide so follow-up can include the right people early instead of stalling later.",
      ),
    ],
    objectionHandling: [
      buildPlaybookObjection(
        "just-looking",
        "We are just looking right now.",
        "Take the pressure off, then ask what would make the search feel worth taking seriously. That gives you a real threshold for the next touch.",
      ),
      buildPlaybookObjection(
        "too-early-for-call",
        "Can you just text or email me instead?",
        "Respect that, but still ask for one key variable now, such as timing or budget, so your next message feels tailored instead of automated.",
      ),
    ],
    messageTemplates: [
      buildPlaybookTemplate(
        "intro-text",
        "Intro text",
        "Text",
        `Hi ${firstName}, this is ${agentLabel} from Acre. I am pulling together options around ${areaContext}, and I want to make sure I have the right timing and budget before I send them. What is the ideal move timeline for you right now?`,
      ),
      buildPlaybookTemplate(
        "first-call-email",
        "First-call recap",
        "Email",
        `Subject: Quick search setup\n\nHi ${firstName},\n\nThanks again. Before I send options, I want to make sure I understand the search correctly. Right now I am working from ${intentContext}, ${budgetContext}, and ${areaContext}.\n\nReply with the timing that matters most and anything I should adjust before I build the shortlist.\n\nThanks,\n${agentLabel}`,
      ),
    ],
  };
}

function buildFrontOfficeAiSuggestions(input: {
  clientId: string;
  fullName: string;
  now: Date;
  stage: string;
  intentLabel: string;
  budgetLabel: string;
  preferredAreasLabel: string;
  sendCount: number;
  openedSendCount: number;
  revisitCount: number;
  nextTouchLabel: string;
  leaseReminder: FrontOfficeClientDetailLeaseReminder;
  workflow: FrontOfficeClientDetailWorkflowSignal;
  playbook: FrontOfficeClientDetailPlaybook;
  latestAppointment: {
    title: string;
    startsAt: Date;
    type: AppointmentType;
  } | null;
  latestSendRecord: {
    listingTitle: string;
    sentAt: Date;
    openCount: number;
    lastOpenedAt: Date | null;
  } | null;
  hasClosedTransaction: boolean;
  hasCancelledTransaction: boolean;
  hasLinkedTransaction: boolean;
  isClosingSoon: boolean;
  isReadyForBackOffice: boolean;
  closingKeyDateLabel: string;
  closingBoundaryLabel: string;
  closingPrimaryActionLabel: string;
  closingPrimaryActionHref: string;
  closingPrimaryActionOpensInNewTab: boolean;
  historyIndex: FrontOfficeAiSuggestionHistoryIndex;
  timeZone?: string | null;
}): FrontOfficeClientDetailAiSuggestions {
  const firstName = getClientFirstName(input.fullName);
  const areaContext = hasMeaningfulAreasLabel(input.preferredAreasLabel)
    ? input.preferredAreasLabel
    : "the right neighborhoods";
  const budgetContext = hasMeaningfulBudgetLabel(input.budgetLabel)
    ? input.budgetLabel
    : "the right budget";
  const intentContext = hasMeaningfulIntentLabel(input.intentLabel)
    ? input.intentLabel
    : "this move";
  const appointmentLabel = input.latestAppointment
    ? `${input.latestAppointment.title} · ${formatDateTimeLabel(
        input.latestAppointment.startsAt,
        {
          timeZone: input.timeZone ?? null,
        },
      )}`
    : "";
  const latestListingLabel =
    input.latestSendRecord?.listingTitle.trim() || "the last shortlist";
  const candidateKinds: FrontOfficeAiFollowUpKind[] =
    input.hasCancelledTransaction
      ? ["reentry"]
      : input.hasClosedTransaction
        ? ["postclose"]
        : [
            ...(input.isClosingSoon ? (["closing"] as const) : []),
            ...(input.leaseReminder.needsAttention ? (["lease"] as const) : []),
            ...(input.latestAppointment ? (["appointment"] as const) : []),
            ...(input.latestSendRecord && input.latestSendRecord.openCount <= 0
              ? (["content_rescue"] as const)
              : []),
            ...(input.latestSendRecord && input.latestSendRecord.openCount > 0
              ? (["warm_engagement"] as const)
              : []),
            ...(input.isReadyForBackOffice && !input.hasLinkedTransaction
              ? (["handoff"] as const)
              : []),
          ];
  const rankedCandidateKinds = (
    candidateKinds.length ? candidateKinds : (["generic"] as const)
  )
    .map((kind) => {
      const basePriority = {
        reentry: 0,
        postclose: 1,
        closing: 2,
        lease: 4,
        appointment: 5,
        content_rescue: 6,
        warm_engagement: 7,
        handoff: 8,
        generic: 9,
      } satisfies Record<FrontOfficeAiFollowUpKind, number>;
      const insight = buildFrontOfficeAiSuggestionInsight({
        historyIndex: input.historyIndex,
        clientId: input.clientId,
        suggestionKind: kind,
      });

      return {
        kind,
        insight,
        priority: basePriority[kind] + insight.priorityAdjustment,
      };
    })
    .sort((left, right) => left.priority - right.priority);
  const selectedSuggestionKind =
    rankedCandidateKinds[0]?.kind ?? ("generic" as const);
  const selectedInsight = rankedCandidateKinds[0]?.insight ?? {
    priorityAdjustment: 0,
    historySignals: [],
    suppressDirectFollowUpCreation: false,
    primaryActionReasonOverride: null,
    oneClickReasonOverride: null,
  };

  const workflowGroundingSignals = [
    `Stage · ${input.stage}`,
    `Workflow pressure · ${input.workflow.pressureLabel}`,
    `Current touch window · ${input.nextTouchLabel}`,
  ];
  let groundingSignals = [
    ...workflowGroundingSignals,
    input.leaseReminder.statusLabel !== "No lease reminder"
      ? `Lease reminder · ${input.leaseReminder.statusLabel}`
      : "",
    appointmentLabel ? `Appointment · ${appointmentLabel}` : "",
    input.sendCount > 0
      ? `Tracked engagement · ${input.openedSendCount}/${input.sendCount} send(s) opened`
      : "",
    input.hasLinkedTransaction &&
    input.closingKeyDateLabel !== "No milestone date captured"
      ? `Deal milestone · ${input.closingKeyDateLabel}`
      : "",
  ].filter(Boolean);

  const drafts: FrontOfficeClientDetailAiDraft[] = [];
  const pushDraft = (draft: FrontOfficeClientDetailAiDraft) => {
    drafts.push(draft);
  };

  let statusLabel = "Next touch ready";
  let statusTone: FrontOfficeClientDetailTone = "accent";
  let statusTitle = "Best next touch from the live dossier";
  let summary =
    "Acre can already ground the next touch in the live dossier instead of leaving the agent to guess the right opener.";
  let helperText =
    "These drafts are grounded in the appointment, send, follow-up, handoff, and transaction signals already on this record. Nothing auto-sends; edit before using.";
  let suggestionKind: FrontOfficeAiFollowUpKind = "generic";
  let followUpSuggestion: FrontOfficeClientDetailAiFollowUpSuggestion | null =
    buildFrontOfficeAiFollowUpAction({
      kind: "generic",
      now: input.now,
      clientFullName: input.fullName,
    });
  let allowsDirectFollowUpCreation = true;
  let directFollowUpState:
    | "available"
    | "suppressed_by_history"
    | "suppressed_by_boundary" = "available";
  let primaryActionLabel = input.workflow.actionLabel;
  let primaryActionHref = input.workflow.actionHref;
  let primaryActionOpensInNewTab = false;

  if (selectedSuggestionKind === "reentry") {
    suggestionKind = "reentry";
    statusLabel = "Re-entry";
    statusTone = "warning";
    statusTitle = "Use a respectful reopen touch, not a hard restart";
    summary =
      "The formal deal did not close, so the best next-touch should stay low-pressure and leave the door open for timing to restart.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "reentry",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = "Create follow-up";
    primaryActionHref = "#front-office-follow-up-form";

    pushDraft({
      id: "reentry-call",
      title: "Soft re-entry opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: "warning",
      reasonLabel: "Grounded by cancelled / lost formal outcome",
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to check in without any pressure. If your timing opens back up or you want to revisit options, I can pick things up quickly from where we left off. What would make it useful for us to reconnect?`,
    });
    pushDraft({
      id: "reentry-email",
      title: "Respectful re-entry email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "neutral",
      reasonLabel: "Keeps the relationship warm without forcing urgency",
      subjectLine: "Checking in whenever the timing reopens",
      body: `Hi ${firstName},\n\nI wanted to check in without any pressure. If your timing opens back up or you want to revisit options, I can restart quickly from where we left off instead of rebuilding the search from scratch.\n\nIf it helps, I can also tighten a smaller shortlist around ${areaContext} so the next step feels simpler.\n\nBest,\nAcre`,
    });
  } else if (selectedSuggestionKind === "postclose") {
    suggestionKind = "postclose";
    statusLabel = "Post-close";
    statusTone = "success";
    statusTitle = "Keep the win warm with a human follow-up";
    summary =
      "The deal is already closed, so the next-touch should sound supportive, recap-oriented, and referral-aware rather than salesy.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "postclose",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = input.closingPrimaryActionLabel;
    primaryActionHref = input.closingPrimaryActionHref;
    primaryActionOpensInNewTab = input.closingPrimaryActionOpensInNewTab;

    pushDraft({
      id: "postclose-text",
      title: "Post-close check-in text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "success",
      reasonLabel:
        input.closingKeyDateLabel !== "No milestone date captured"
          ? input.closingKeyDateLabel
          : "Grounded by closed formal transaction",
      subjectLine: "",
      body: `Hi ${firstName}, congratulations again on the close. I wanted to check that everything feels settled and see if you need anything as move-in continues. Once you are fully settled, I would also be glad to help anyone you send my way.`,
    });
    pushDraft({
      id: "postclose-email",
      title: "Support-first follow-up email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "accent",
      reasonLabel: "Built for recap, support, and referral timing",
      subjectLine: "Checking in after the close",
      body: `Hi ${firstName},\n\nCongratulations again on the close. I wanted to check that everything feels settled and make sure there is nothing you need as move-in continues.\n\nIf it helps, I can also send a clean recap packet from our current dossier so you have the key details in one place. And once you are fully settled, I would love to help anyone you send my way.\n\nBest,\nAcre`,
    });
  } else if (selectedSuggestionKind === "closing") {
    suggestionKind = "closing";
    statusLabel = "Closing support";
    statusTone = "warning";
    statusTitle = "Use the next touch to steady the closing window";
    summary =
      "A near-term closing or move-in date is already on the shared file, so the next-touch should reduce wrap-up confusion before the date slips by.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "closing",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = input.closingPrimaryActionLabel;
    primaryActionHref = input.closingPrimaryActionHref;
    primaryActionOpensInNewTab = input.closingPrimaryActionOpensInNewTab;

    pushDraft({
      id: "closing-text",
      title: "Closing-week text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "warning",
      reasonLabel:
        input.closingKeyDateLabel !== "No milestone date captured"
          ? input.closingKeyDateLabel
          : "Near-term closing support",
      subjectLine: "",
      body: `Hi ${firstName}, as we get closer to ${input.closingKeyDateLabel.toLowerCase()}, I want to make sure the wrap-up stays smooth. If anything changed around timing, logistics, or the final checklist, send it over and I will help keep the next steps clear.`,
    });
    pushDraft({
      id: "closing-email",
      title: "Closing recap email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "accent",
      reasonLabel: "Good fit when you want one clean written recap",
      subjectLine: "Quick check-in before the close",
      body: `Hi ${firstName},\n\nAs we get closer to ${input.closingKeyDateLabel.toLowerCase()}, I want to make sure the wrap-up stays smooth and that nothing important is left fuzzy.\n\nIf it helps, I can send one clean recap and keep the first post-close follow-up visible now so there is no gap once the deal lands.\n\nBest,\nAcre`,
    });
  } else if (selectedSuggestionKind === "lease") {
    suggestionKind = "lease";
    statusLabel = "Lease timing";
    statusTone = input.leaseReminder.statusTone;
    statusTitle = "Use the next touch to clarify renewal or move timing";
    summary =
      "The lease reminder is already due or near due, so the next-touch should lock whether this is a renewal, remarketing, or move-planning conversation.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "lease",
      now:
        input.leaseReminder.statusLabel === "Reminder due soon"
          ? new Date(input.now.getTime() + 2 * 24 * 60 * 60 * 1000)
          : input.now,
      clientFullName: input.fullName,
    });

    pushDraft({
      id: "lease-call",
      title: "Lease-timing opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: input.leaseReminder.statusTone,
      reasonLabel: input.leaseReminder.statusLabel,
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to check in on your lease timing so we can stay ahead of the decision. Are you leaning more toward renewing, moving, or starting a fresh search?`,
    });
    pushDraft({
      id: "lease-text",
      title: "Lease follow-up text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "accent",
      reasonLabel: input.leaseReminder.helperText,
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to check in on your lease timing so we can stay ahead of the next step. If you are leaning toward renewal, moving, or starting a new search, I can map the options now rather than waiting until it gets tight.`,
    });
  } else if (
    selectedSuggestionKind === "appointment" &&
    input.latestAppointment
  ) {
    suggestionKind = "appointment";
    statusLabel = "Appointment prep";
    statusTone = "accent";
    statusTitle = "Use the touch to tighten expectations before the meeting";
    summary =
      "There is already a scheduled appointment on the calendar, so the next-touch should sharpen logistics and expectations instead of reopening discovery from zero.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "appointment",
      now: input.now,
      clientFullName: input.fullName,
      appointmentTitle: input.latestAppointment.title,
    });
    primaryActionLabel = "Open calendar";
    primaryActionHref = buildFrontOfficeCalendarHref({
      clientId: input.clientId,
      calendarView: frontOfficeCalendarViews.confirmationPending,
    });

    pushDraft({
      id: "appointment-text",
      title: "Pre-appointment text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "accent",
      reasonLabel: appointmentLabel || "Upcoming appointment in Front Office",
      subjectLine: "",
      body: `Hi ${firstName}, looking forward to our ${input.latestAppointment.title} on ${formatDateTimeLabel(
        input.latestAppointment.startsAt,
        { timeZone: input.timeZone ?? null },
      )}. I will have the key details and best-fit options ready so we can use the time well. If anything changed on budget, area, or timing, send it over and I will adjust before we meet.`,
    });
    pushDraft({
      id: "appointment-email",
      title: "Pre-appointment email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "neutral",
      reasonLabel: "Best when the meeting needs one clear written setup",
      subjectLine: `Quick setup before our ${input.latestAppointment.title}`,
      body: `Hi ${firstName},\n\nLooking forward to our ${input.latestAppointment.title} on ${formatDateTimeLabel(
        input.latestAppointment.startsAt,
        { timeZone: input.timeZone ?? null },
      )}.\n\nI will come in ready around ${intentContext}, ${budgetContext}, and ${areaContext}. If anything changed on timing or priorities, reply here and I will adjust before we meet.\n\nBest,\nAcre`,
    });
  } else if (
    selectedSuggestionKind === "content_rescue" &&
    input.latestSendRecord &&
    input.latestSendRecord.openCount <= 0
  ) {
    suggestionKind = "content_rescue";
    statusLabel = "Content follow-up";
    statusTone = "warning";
    statusTitle = "Rescue the tracked send before it goes quiet";
    summary =
      "Material has already been sent, but there is no tracked open yet, so the next-touch should reduce friction and offer a smaller next step.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "content_rescue",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = "Open listing output";
    primaryActionHref = buildFrontOfficeListingsHref({
      clientId: input.clientId,
      lane: frontOfficeListingsLanes.sendRescue,
    });

    pushDraft({
      id: "unopened-text",
      title: "Shortlist rescue text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "warning",
      reasonLabel: `No tracked open on ${latestListingLabel}`,
      subjectLine: "",
      body: `Hi ${firstName}, just checking that you saw the options I sent over. I can narrow them down to the 2 or 3 best matches in ${areaContext} if that makes the next step easier. Want me to tighten the list or book a quick showing?`,
    });
    pushDraft({
      id: "unopened-call",
      title: "No-open follow-up opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: "accent",
      reasonLabel: "Designed to restart momentum without sounding pushy",
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to make this easier instead of sending another big batch. I can cut the shortlist down around ${areaContext} and ${budgetContext} so the next step feels obvious. Which direction would help most right now?`,
    });
  } else if (
    selectedSuggestionKind === "warm_engagement" &&
    input.latestSendRecord &&
    input.latestSendRecord.openCount > 0
  ) {
    suggestionKind = "warm_engagement";
    statusLabel = "Warm engagement";
    statusTone = input.revisitCount > 0 ? "success" : "accent";
    statusTitle = "Follow the signal while the client is still engaged";
    summary =
      "The send trail already shows engagement, so the next-touch should turn interest into a clearer shortlist, feedback, or booked step.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "warm_engagement",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = "Create follow-up";
    primaryActionHref = "#front-office-follow-up-form";

    pushDraft({
      id: "engaged-call",
      title: "Engagement follow-up opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: input.revisitCount > 0 ? "success" : "accent",
      reasonLabel:
        input.revisitCount > 0
          ? "Revisit signal on tracked content"
          : "At least one tracked open is already recorded",
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to follow up on the options we reviewed. Based on what stood out most, I can narrow the search and line up the next showing. Which one felt closest to the mark?`,
    });
    pushDraft({
      id: "engaged-text",
      title: "Warm-engagement text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "accent",
      reasonLabel: `Grounded by interest in ${latestListingLabel}`,
      subjectLine: "",
      body: `Hi ${firstName}, wanted to follow up on the options I sent over. If one or two stood out, I can narrow the list and line up the next step around ${areaContext}. Want me to tighten the shortlist or book a quick tour?`,
    });
  } else if (
    selectedSuggestionKind === "handoff" &&
    input.isReadyForBackOffice &&
    !input.hasLinkedTransaction
  ) {
    suggestionKind = "handoff";
    statusLabel = "Formal handoff";
    statusTone = "warning";
    statusTitle = "Use the touch to align the client before the BO handoff";
    summary =
      "The dossier is BO-ready, but the formal file is not live yet, so the next-touch should confirm package, timing, and expectations before handoff.";
    followUpSuggestion = buildFrontOfficeAiFollowUpAction({
      kind: "handoff",
      now: input.now,
      clientFullName: input.fullName,
    });
    primaryActionLabel = input.closingPrimaryActionLabel;
    primaryActionHref = input.closingPrimaryActionHref;
    primaryActionOpensInNewTab = input.closingPrimaryActionOpensInNewTab;
    allowsDirectFollowUpCreation = false;
    directFollowUpState = "suppressed_by_boundary";

    pushDraft({
      id: "handoff-call",
      title: "Offer / application alignment opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: "warning",
      reasonLabel: input.closingBoundaryLabel,
      subjectLine: "",
      body: `Hi ${firstName}, we are at the point where the next step should become formal, and I want to make sure timing, paperwork, and expectations stay clean. If we confirm the exact package today, I can keep the process moving without extra back-and-forth.`,
    });
    pushDraft({
      id: "handoff-email",
      title: "Formal-step email",
      channelKey: "email",
      channelLabel: "Email draft",
      tone: "accent",
      reasonLabel:
        "Best when the client needs one written recap before formal handoff",
      subjectLine: "Confirming the next formal step",
      body: `Hi ${firstName},\n\nWe are at the point where the next step should become formal, and I want to keep timing, paperwork, and expectations clean.\n\nIf we confirm the exact package today, I can move the file forward without extra back-and-forth and make sure the next milestone is clear.\n\nBest,\nAcre`,
    });
  } else {
    pushDraft({
      id: "next-call",
      title: "Primary next-touch opener",
      channelKey: "call",
      channelLabel: "Call opener",
      tone: input.workflow.nextStepTone,
      reasonLabel: input.workflow.nextStepTitle,
      subjectLine: "",
      body: input.playbook.introScript,
    });
    pushDraft({
      id: "next-text",
      title: "Short next-step text",
      channelKey: "sms",
      channelLabel: "Text draft",
      tone: "accent",
      reasonLabel:
        "Built from current stage, budget, area, and timeline context",
      subjectLine: "",
      body: `Hi ${firstName}, I wanted to check in on ${intentContext}. I can tighten the next step around ${areaContext} and ${budgetContext} so it feels more actionable instead of broad. Would a quick call this week help us choose the next move?`,
    });
  }

  const suggestionGroundingSignals = (() => {
    switch (suggestionKind) {
      case "reentry":
        return [
          "Formal deal outcome · cancelled or lost",
          "Execution boundary · relationship reset belongs in Front Office before any new formal workflow",
        ];
      case "postclose":
        return [
          input.closingKeyDateLabel !== "No milestone date captured"
            ? `Closed milestone · ${input.closingKeyDateLabel}`
            : "Formal deal outcome · closed",
          "Execution boundary · keep the touch client-facing while Back Office remains the system of record",
        ];
      case "closing":
        return [
          input.closingKeyDateLabel !== "No milestone date captured"
            ? `Shared milestone · ${input.closingKeyDateLabel}`
            : "Shared file milestone is approaching",
          "Execution boundary · steady the client touch without duplicating Back Office execution",
        ];
      case "lease":
        return [
          `Lease reminder · ${input.leaseReminder.statusLabel}`,
          input.leaseReminder.helperText,
        ];
      case "appointment":
        return input.latestAppointment
          ? [
              `Appointment · ${input.latestAppointment.title}`,
              `Starts ${formatDateTimeLabel(input.latestAppointment.startsAt, {
                timeZone: input.timeZone ?? null,
              })}`,
            ]
          : [];
      case "content_rescue":
        return [
          input.latestSendRecord?.listingTitle.trim()
            ? `Tracked send · no open on ${input.latestSendRecord.listingTitle.trim()}`
            : "Tracked send · still no open",
          input.latestSendRecord
            ? `Sent ${formatDateTimeLabel(input.latestSendRecord.sentAt, {
                timeZone: input.timeZone ?? null,
              })}`
            : "",
        ];
      case "warm_engagement":
        return [
          input.latestSendRecord?.lastOpenedAt
            ? `Tracked engagement · last open ${formatDateTimeLabel(
                input.latestSendRecord.lastOpenedAt,
                {
                  timeZone: input.timeZone ?? null,
                },
              )}`
            : `Tracked engagement · ${input.latestSendRecord?.openCount ?? 0} open(s) recorded`,
          input.latestSendRecord?.listingTitle.trim()
            ? `Listing · ${input.latestSendRecord.listingTitle.trim()}`
            : "",
        ];
      case "handoff":
        return [
          "Execution boundary · Front Office is ready for formal workflow",
          input.closingBoundaryLabel,
        ];
      default:
        return [
          `Stage · ${input.stage}`,
          "No future touch is currently scheduled on this active record.",
        ];
    }
  })();
  groundingSignals = Array.from(
    new Set(
      [...suggestionGroundingSignals, ...workflowGroundingSignals].filter(
        Boolean,
      ),
    ),
  ).slice(0, 5);

  if (selectedInsight.suppressDirectFollowUpCreation) {
    allowsDirectFollowUpCreation = false;
    directFollowUpState = "suppressed_by_history";
    helperText = `${helperText} ${selectedInsight.oneClickReasonOverride ?? "Acre is holding back one-click follow-up creation here because a similar AI-created follow-up still needs review first."}`;
    primaryActionLabel = "Review existing follow-up";
    primaryActionHref = "#front-office-follow-up-form";
    primaryActionOpensInNewTab = false;
  }

  const boundaryContract = buildFrontOfficeAiBoundaryContract({
    suggestionKind,
    hasLinkedTransaction: input.hasLinkedTransaction,
    isReadyForBackOffice: input.isReadyForBackOffice,
    hasClosedTransaction: input.hasClosedTransaction,
    hasCancelledTransaction: input.hasCancelledTransaction,
    directFollowUpState,
    primaryActionReasonOverride: selectedInsight.primaryActionReasonOverride,
    oneClickReasonOverride: selectedInsight.oneClickReasonOverride,
  });

  return {
    suggestionKind,
    statusLabel,
    statusTone,
    statusTitle,
    summary,
    helperText,
    groundingSignals,
    rankingSignals: selectedInsight.historySignals,
    boundaryLabel: boundaryContract.boundaryLabel,
    boundaryTone: boundaryContract.boundaryTone,
    boundaryDescription: boundaryContract.boundaryDescription,
    primaryActionReason: boundaryContract.primaryActionReason,
    oneClickReason: boundaryContract.oneClickReason,
    followUpSuggestion,
    allowsDirectFollowUpCreation,
    primaryActionLabel,
    primaryActionHref,
    primaryActionOpensInNewTab,
    drafts,
  };
}

function mapHandoffTone(
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

function formatHandoffStatusLabel(status: FrontOfficeHandoffStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTransactionStatusLabel(status: string) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildTransactionWorkspaceHref(transactionId: string, anchor?: string) {
  return anchor?.trim()
    ? `/office/transactions/${transactionId}#${anchor}`
    : `/office/transactions/${transactionId}`;
}

function buildClientPdfHref(clientId: string) {
  return `/api/agent/clients/${clientId}/pdf`;
}

function mapOfferStatusTone(status: string): FrontOfficeClientDetailTone {
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

function buildOfferWorkspaceHref(
  transactionId: string,
  offerId?: string | null,
) {
  return offerId?.trim()
    ? `/office/transactions/${transactionId}#offer-${offerId}`
    : buildTransactionWorkspaceHref(transactionId, "transaction-offers");
}

function formatTransactionTaskStatusLabel(status: TransactionTaskStatus) {
  return formatTransactionStatusLabel(status);
}

function mapTransactionTaskTone(
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

function formatSignatureRequestStatusLabel(status: SignatureRequestStatus) {
  return formatTransactionStatusLabel(status);
}

function mapSignatureRequestTone(
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

function formatIncomingUpdateStatusLabel(status: IncomingUpdateStatus) {
  return formatTransactionStatusLabel(status);
}

function mapIncomingUpdateTone(
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

function buildTransactionLocationLabel(input: {
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

function buildTransactionContextMetaLabel(input: {
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

function getDayDifferenceFromToday(value: Date, now: Date) {
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

function buildFrontOfficeFollowUpAction(input: {
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

function buildFollowUpCue(input: {
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
        : "This dossier is far enough along that the formal offer or contract record should open in Back Office next.",
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
        "At least one follow-up task is already overdue. Close it or move the due date before the dossier stalls.",
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
        "This opportunity is marked lost, but the dossier should still carry a respectful future touch.",
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
        "This dossier is still active, but no call, text, or email is on the books yet.",
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
        "The dossier already has a future touch or task on the books, so the conversation still has a clear owner.",
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
      "Use Front Office to keep the next call, text, or showing visible before the dossier cools down.",
    dueLabel: defaultDueLabel,
    dueAtValue: defaultDueAtValue,
    ownershipKey: frontOfficeClientDetailOwnershipKeys.frontOffice,
    targetStepId: frontOfficeClientDetailNextStepIds.followUp,
    action: buildFrontOfficeFollowUpAction({ hasScheduledTouch: false }),
  };
}

function buildWorkflowSignal(input: {
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
      ? "This dossier already has an upcoming touch or task attached, so the workflow is still moving."
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
      "This client is active but no future follow-up is on the books yet. Add a reminder before the dossier goes stale.";
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
        "This opportunity is marked lost, but the dossier should still carry a future check-in instead of disappearing.",
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
      "Front Office should keep the next touch visible by default. Create a follow-up or book the next appointment before leaving this dossier.",
    action,
    actionLabel: action.label,
    actionHref: action.href,
  };
}

function getFrontOfficeClientDetailWorkbenchLabel(
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
      return "Next-step rail";
  }
}

function getFrontOfficeClientDetailWorkbenchDescription(
  stepId: FrontOfficeClientDetailNextStepId,
) {
  switch (stepId) {
    case frontOfficeClientDetailNextStepIds.followUp:
    case frontOfficeClientDetailNextStepIds.appointment:
      return "Use this section when the next touch belongs to calls, reminders, confirmations, reschedules, or live client coordination and you want to re-enter from calendar writeback.";
    case frontOfficeClientDetailNextStepIds.listingOutput:
      return "Use this section when the next move is about tracked sends, rescues, open counts, follow-through on a previous shortlist, or a return from the listing workbench.";
    case frontOfficeClientDetailNextStepIds.offerPrep:
      return "Use this section when the dossier has crossed into negotiation or formal offer prep and needs the FO / BO boundary to stay explicit.";
    case frontOfficeClientDetailNextStepIds.inspectionSupport:
      return "Use this section when a linked transaction needs inspection, signature, or incoming-update support from the same client record.";
    case frontOfficeClientDetailNextStepIds.closingSuggestion:
      return "Use this section when the record is closing, recently won, or ready for post-close re-entry and recap.";
    default:
      return "Use this section when you want the dossier to explain the active workbench lane, the current return point, and the next best move.";
  }
}

function getFrontOfficeClientDetailWorkbenchHref(
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

function buildFrontOfficeClientDetailWorkbenchReturn(
  stepId: FrontOfficeClientDetailNextStepId,
): FrontOfficeClientDetailWorkbenchReturn {
  return {
    label: getFrontOfficeClientDetailWorkbenchLabel(stepId),
    description: getFrontOfficeClientDetailWorkbenchDescription(stepId),
    href: getFrontOfficeClientDetailWorkbenchHref(stepId),
  };
}

function buildNextStepRail(input: {
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
  > & {
    primaryAction: FrontOfficeClientDetailAction;
  };
  inspection: Pick<
    FrontOfficeClientDetailInspection,
    | "boundaryLabel"
    | "boundaryTitle"
    | "boundaryDescription"
    | "boundaryMetaLabel"
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
      "Back Office remains the system of record for the finished transaction. Use this dossier for recap, referral, testimonial, and post-close care instead of creating a second closing tracker.";
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
      "Offers, inspection work, signatures, and closing milestones now belong to the shared Back Office record. Keep this dossier focused on the next client touch, recap, and coordination around that formal file.";
    decisionMetaLabel = input.inspection.boundaryMetaLabel;
    primaryAction = input.workflow.action;
  } else if (input.isReadyForBackOffice) {
    decisionKey = frontOfficeClientDetailDecisionKeys.moveToBackOffice;
    decisionLabel = "Move into Back Office now";
    decisionTone = "warning";
    decisionTitle =
      "This dossier has crossed the FO / BO boundary and needs a formal file";
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
    ? "FO owns the relationship"
    : input.hasLinkedTransaction
      ? "FO supports BO"
      : input.isReadyForBackOffice
        ? "FO until BO opens"
        : "Stay in FO";
  const followUpOwnershipTone: FrontOfficeClientDetailTone =
    input.hasClosedTransaction
      ? "success"
      : input.hasLinkedTransaction
        ? "accent"
        : input.isReadyForBackOffice
          ? "warning"
          : "accent";
  const followUpDescription = input.hasOverdueTask
    ? "At least one follow-up task is already overdue. Close the loop or move the due date before the dossier stalls."
    : hasOverdueNextTouch
      ? `${nextTouchDetail} Move it forward or confirm that a different next touch now owns the client conversation.`
      : input.nextTouchAt || input.openTaskCount > 0
        ? `${nextTouchDetail} Keep the next touch explicit so the dossier stays live from one action to the next.`
        : input.hasClosedTransaction
          ? "The formal file is already closed, but the relationship still needs a post-close touch, support check-in, or referral ask."
          : input.isReadyForBackOffice
            ? "Client-facing follow-up still belongs here, but the formal offer / contract record should open in Back Office next."
            : "No next touch is scheduled yet. Put the next call, text, or email on the books before leaving this dossier.";
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
      ? "FO support"
      : input.hasClosedTransaction
        ? "Optional support"
        : "Stay in FO";
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
      ? "The tour already happened. Capture feedback, confirm the shortlist, and decide whether the next move is another showing, a send, or BO handoff."
      : isViewingScheduled
        ? "Use the calendar to confirm the time, address, access, and follow-up timing before the showing starts."
        : input.hasLinkedTransaction
          ? "Calendar stays useful for client coordination, but not as a second Back Office milestone tracker."
          : "Use appointments for showings, consultations, and decision calls once the next touch is clear.";
  const appointmentMetaLabel = input.latestUpcomingAppointment
    ? `External state · ${input.latestUpcomingAppointment.externalStatusLabel}`
    : "Open the shared Front Office calendar from this dossier";

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
      ? "FO support"
      : input.isReadyForBackOffice
        ? "Support, not source of truth"
        : "Stay in FO";
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
    : "Open listing output from this dossier";

  const offerOwnershipKey = input.hasLinkedTransaction
    ? frontOfficeClientDetailOwnershipKeys.backOffice
    : input.isReadyForBackOffice
      ? frontOfficeClientDetailOwnershipKeys.moveToBackOffice
      : frontOfficeClientDetailOwnershipKeys.frontOffice;
  const offerOwnershipLabel = input.hasLinkedTransaction
    ? "BO source of truth"
    : input.isReadyForBackOffice
      ? "Move to BO now"
      : "Stay in FO";
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
    ? "BO source of truth"
    : input.isReadyForBackOffice
      ? "Needs BO first"
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
    ? "Return to FO"
    : input.hasLinkedTransaction
      ? "BO milestone"
      : input.isReadyForBackOffice
        ? "Needs BO first"
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
    ? "Use this rail when post-close support, recap, or referral follow-up should reopen from the same client record instead of a finished formal file."
    : input.hasLinkedTransaction
      ? "Use this rail when calls, reminders, and client-facing follow-up still need to stay on the dossier while Back Office owns the formal file."
      : input.isReadyForBackOffice
        ? "Use this rail when the next touch is still client-facing, but the dossier also needs to prepare for a formal Back Office handoff."
        : "Use this rail when calls, reminders, confirmations, or next-touch tasks need to reopen from the same client workbench.";
  const appointmentReturnDescription = input.latestUpcomingAppointment
    ? "Use this rail when calendar writeback needs to keep the same appointment focus and the dossier should reopen the exact next touch."
    : isViewingCompleted
      ? "Use this rail when the showing already happened and the dossier should reopen feedback capture before the client goes cold."
      : isViewingScheduled
        ? "Use this rail when showing logistics, confirmations, or reschedules need to come back into the same calendar workbench."
        : input.hasLinkedTransaction
          ? "Use this rail when client coordination around a live deal still needs to reopen from the same calendar workbench, not a second Back Office milestone tracker."
          : "Use this rail when live client coordination should return from calendar writeback into the same appointment lane.";
  const listingReturnDescription = input.latestSendRecord
    ? input.latestSendRecord.openCount > 0
      ? "Use this rail when tracked engagement or revisit signals need to bring the dossier back into the listing workbench before another send goes out."
      : "Use this rail when the last send still needs follow-through and the dossier should return to the listing workbench instead of generating a fresh shortlist blindly."
    : input.hasClosedTransaction
      ? "Use this rail when recap or future re-entry needs the prior send history without reopening formal deal work."
      : input.isReadyForBackOffice
        ? "Use this rail when a tracked send helps the conversation or handoff, but the formal record still needs to open in Back Office next."
        : "Use this rail when a tracked send, resend, or follow-through action needs to come back into the listing workbench.";
  const offerReturnDescription = input.hasLinkedTransaction
    ? "Use this rail when offer intent is active, but the formal steps belong in the Back Office record and Front Office needs to stay clear about that boundary."
    : input.isReadyForBackOffice
      ? "Use this rail when the dossier has crossed into formal offer prep and the next move is to open the Back Office file without losing client context."
      : offerReturnPoint.description;
  const inspectionReturnDescription = input.hasLinkedTransaction
    ? "Use this rail when inspection, signatures, or incoming updates need client-facing support without duplicating the Back Office tracker."
    : inspectionReturnPoint.description;
  const closingReturnDescription = input.hasClosedTransaction
    ? "Use this rail when a closed deal needs post-close re-entry, recap, or relationship follow-through from Front Office."
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

function buildDossierContract(input: {
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

export async function getFrontOfficeClientDetail(
  input: GetFrontOfficeClientDetailInput,
): Promise<FrontOfficeClientDetailSnapshot | null> {
  const now = new Date();
  const thirtyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 30,
  );
  const ninetyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 90,
  );
  const thirtyDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 30,
  );

  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      organizationId: input.organizationId,
      ownerMembershipId: input.viewerMembershipId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      source: true,
      stage: true,
      intent: true,
      budgetMin: true,
      budgetMax: true,
      preferredAreas: true,
      notes: true,
      lastContactAt: true,
      nextFollowUpAt: true,
      leaseEndDate: true,
      leaseReminderAt: true,
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
      followUpTasks: {
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          createdAt: true,
          updatedAt: true,
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
      },
      frontOfficeSendRecords: {
        orderBy: [{ sentAt: "desc" }],
        take: 8,
        select: {
          id: true,
          channel: true,
          materialType: true,
          clientStageLabel: true,
          appointmentId: true,
          appointmentTitle: true,
          appointmentStartsAt: true,
          sentAt: true,
          firstOpenedAt: true,
          lastOpenedAt: true,
          openCount: true,
          listing: {
            select: {
              title: true,
              neighborhood: true,
              city: true,
            },
          },
        },
      },
      appointments: {
        where: {
          startsAt: {
            gte: thirtyDaysAgo,
            lte: thirtyDaysFromNow,
          },
        },
        orderBy: [{ startsAt: "asc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          startsAt: true,
          endsAt: true,
          location: true,
          meetingUrl: true,
          contactLabel: true,
          metadata: true,
          listing: {
            select: {
              title: true,
              neighborhood: true,
              city: true,
            },
          },
        },
      },
      stageHistory: {
        orderBy: [{ createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          fromStage: true,
          toStage: true,
          note: true,
          createdAt: true,
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
      },
      handoffDrafts: {
        orderBy: [{ updatedAt: "desc" }],
        take: 4,
        select: {
          id: true,
          stageLabel: true,
          summary: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          committedAt: true,
          committedTransactionId: true,
        },
      },
      transactionContacts: {
        where: {
          organizationId: input.organizationId,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          role: true,
          transaction: {
            select: {
              id: true,
              title: true,
              address: true,
              city: true,
              state: true,
              zipCode: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!client) {
    return null;
  }

  const [sendCount, openedSendCount, sendAggregate] = await Promise.all([
    prisma.frontOfficeSendRecord.count({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId: client.id,
      },
    }),
    prisma.frontOfficeSendRecord.count({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId: client.id,
        openCount: {
          gt: 0,
        },
      },
    }),
    prisma.frontOfficeSendRecord.aggregate({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId: client.id,
      },
      _sum: {
        openCount: true,
      },
      _max: {
        lastOpenedAt: true,
      },
    }),
  ]);
  const appointmentBridgeStatusMap =
    await getFrontOfficeAppointmentBridgeStatusMap({
      organizationId: input.organizationId,
      appointmentIds: client.appointments.map((appointment) => appointment.id),
      timeZone: input.timeZone,
    });

  const openTaskCount = client.followUpTasks.filter(
    (task) =>
      task.status !== TaskStatus.completed &&
      task.status !== TaskStatus.canceled,
  ).length;
  const completedTaskCount = client.followUpTasks.filter(
    (task) => task.status === TaskStatus.completed,
  ).length;
  const overdueTaskCount = client.followUpTasks.filter(
    (task) =>
      task.status !== TaskStatus.completed &&
      task.status !== TaskStatus.canceled &&
      Boolean(task.dueAt && task.dueAt.getTime() < now.getTime()),
  ).length;
  const hasOverdueTask = client.followUpTasks.some(
    (task) =>
      task.status !== TaskStatus.completed &&
      task.status !== TaskStatus.canceled &&
      Boolean(task.dueAt && task.dueAt.getTime() < now.getTime()),
  );
  const earliestOpenTaskDueAt = client.followUpTasks.reduce<Date | null>(
    (earliest, task) => {
      if (
        task.status === TaskStatus.completed ||
        task.status === TaskStatus.canceled ||
        !task.dueAt
      ) {
        return earliest;
      }

      return pickEarliestDate(earliest, task.dueAt);
    },
    null,
  );
  const nextTouchAt = pickEarliestDate(
    earliestOpenTaskDueAt,
    client.nextFollowUpAt,
    client.leaseReminderAt,
  );
  const leaseReminder = buildLeaseReminderSnapshot({
    leaseEndDate: client.leaseEndDate,
    leaseReminderAt: client.leaseReminderAt,
    now,
    timeZone: input.timeZone,
  });
  const activeHandoffDraft =
    client.handoffDrafts.find(
      (draft) =>
        draft.status === FrontOfficeHandoffStatus.ready ||
        draft.status === FrontOfficeHandoffStatus.draft,
    ) ??
    client.handoffDrafts.find(
      (draft) => draft.status === FrontOfficeHandoffStatus.committed,
    ) ??
    null;
  const activeHandoff = activeHandoffDraft
    ? {
        status: activeHandoffDraft.status,
        href:
          activeHandoffDraft.status === FrontOfficeHandoffStatus.committed &&
          activeHandoffDraft.committedTransactionId
            ? `/office/transactions/${activeHandoffDraft.committedTransactionId}`
            : buildFrontOfficeHandoffCreateHref(activeHandoffDraft.id),
        committedTransactionId: activeHandoffDraft.committedTransactionId,
      }
    : null;
  const primaryLinkedTransaction =
    (activeHandoffDraft?.committedTransactionId
      ? client.transactionContacts.find(
          (link) =>
            link.transaction.id === activeHandoffDraft.committedTransactionId,
        )
      : null) ??
    client.transactionContacts[0] ??
    null;
  const negotiationTransactionId =
    primaryLinkedTransaction?.transaction.id ??
    activeHandoffDraft?.committedTransactionId ??
    null;
  const linkedTransactionHref = client.transactionContacts[0]
    ? `/office/transactions/${client.transactionContacts[0].transaction.id}`
    : null;
  const activeSignatureStatuses = [
    SignatureRequestStatus.pending_send,
    SignatureRequestStatus.sent,
    SignatureRequestStatus.viewed,
    SignatureRequestStatus.signed,
  ];
  const [
    negotiationOffersSnapshot,
    upcomingAppointmentCount,
    openHandoffCount,
    inspectionTransactionRecord,
    inspectionOpenTaskCount,
    inspectionOverdueTaskCount,
    inspectionPendingSignatureCount,
    inspectionPendingIncomingUpdateCount,
    inspectionTaskRows,
    inspectionSignatureRows,
    inspectionIncomingUpdateRows,
  ] = await Promise.all([
    negotiationTransactionId
      ? listTransactionOffersSnapshot(
          input.organizationId,
          negotiationTransactionId,
        )
      : Promise.resolve(null),
    Promise.resolve(
      client.appointments.filter(
        (appointment) =>
          appointment.status === AppointmentStatus.scheduled &&
          appointment.startsAt.getTime() >= now.getTime(),
      ).length,
    ),
    Promise.resolve(
      client.handoffDrafts.filter(
        (draft) =>
          draft.status === FrontOfficeHandoffStatus.draft ||
          draft.status === FrontOfficeHandoffStatus.ready,
      ).length,
    ),
    negotiationTransactionId
      ? prisma.transaction.findFirst({
          where: {
            id: negotiationTransactionId,
            organizationId: input.organizationId,
          },
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            state: true,
            status: true,
            acceptanceDate: true,
            closingDate: true,
            moveInDate: true,
          },
        })
      : Promise.resolve(null),
    negotiationTransactionId
      ? prisma.transactionTask.count({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              not: TransactionTaskStatus.completed,
            },
          },
        })
      : Promise.resolve(0),
    negotiationTransactionId
      ? prisma.transactionTask.count({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              not: TransactionTaskStatus.completed,
            },
            dueAt: {
              lt: now,
            },
          },
        })
      : Promise.resolve(0),
    negotiationTransactionId
      ? prisma.signatureRequest.count({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              in: activeSignatureStatuses,
            },
          },
        })
      : Promise.resolve(0),
    negotiationTransactionId
      ? prisma.incomingUpdate.count({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: IncomingUpdateStatus.pending_review,
          },
        })
      : Promise.resolve(0),
    negotiationTransactionId
      ? prisma.transactionTask.findMany({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              not: TransactionTaskStatus.completed,
            },
          },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
          take: 3,
          select: {
            id: true,
            checklistGroup: true,
            title: true,
            status: true,
            dueAt: true,
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
    negotiationTransactionId
      ? prisma.signatureRequest.findMany({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: {
              in: activeSignatureStatuses,
            },
          },
          orderBy: [{ expiresAt: "asc" }, { updatedAt: "desc" }],
          take: 2,
          select: {
            id: true,
            contextLabel: true,
            recipientName: true,
            recipientEmail: true,
            status: true,
            sentAt: true,
            expiresAt: true,
            form: {
              select: {
                name: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    negotiationTransactionId
      ? prisma.incomingUpdate.findMany({
          where: {
            organizationId: input.organizationId,
            transactionId: negotiationTransactionId,
            status: IncomingUpdateStatus.pending_review,
          },
          orderBy: [{ receivedAt: "desc" }],
          take: 2,
          select: {
            id: true,
            summary: true,
            status: true,
            sourceSystem: true,
            sourceReference: true,
            receivedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const [
    aiAcceptedActionCount,
    aiPositiveOutcomeCount,
    recentAiAcceptedActions,
    membershipAiLearningActions,
  ] = await Promise.all([
    prisma.frontOfficeAiAcceptedAction.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
        clientId: client.id,
      },
    }),
    prisma.frontOfficeAiAcceptedAction.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
        clientId: client.id,
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
        clientId: client.id,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 4,
      select: {
        id: true,
        actionType: true,
        sourceSurface: true,
        suggestionLabel: true,
        actionTitle: true,
        channel: true,
        createdAt: true,
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
        clientId: true,
        suggestionKind: true,
        actionType: true,
        createdAt: true,
        actionTitle: true,
        suggestionLabel: true,
        sourceSurface: true,
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
  ]);
  const aiHistoryIndex = buildFrontOfficeAiSuggestionHistoryIndex({
    actions: membershipAiLearningActions,
    now,
    timeZone: input.timeZone,
  });
  const clientAiAcceptedActionBreakdown =
    buildFrontOfficeAiAcceptedActionBreakdown({
      historyIndex: aiHistoryIndex,
      suggestionKinds: Array.from(
        new Set(
          membershipAiLearningActions
            .filter((action) => action.clientId === client.id)
            .map((action) => action.suggestionKind),
        ),
      ),
      limit: 3,
    }).map((item) => ({
      label: item.label,
      summary: item.summary,
    }));
  const clientAiAcceptedActionWindows =
    buildFrontOfficeAiAcceptedActionBreakdownWindows({
      actions: membershipAiLearningActions.filter(
        (action) => action.clientId === client.id,
      ),
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
  const ownerLabel =
    `${client.ownerMembership?.user.firstName ?? ""} ${client.ownerMembership?.user.lastName ?? ""}`.trim() ||
    client.ownerMembership?.user.email ||
    "Unassigned";
  const budgetLabel = formatBudgetRange(
    client.budgetMin ? Number(client.budgetMin) : null,
    client.budgetMax ? Number(client.budgetMax) : null,
  );
  const preferredAreasLabel = client.preferredAreas.length
    ? client.preferredAreas.join(", ")
    : "Areas not captured";
  const totalOpenCount = sendAggregate._sum.openCount ?? 0;
  const revisitCount = Math.max(totalOpenCount - openedSendCount, 0);
  const nextTouchLabel = formatRelativeDueLabel(
    nextTouchAt,
    now,
    input.timeZone,
  );
  const workflow = buildWorkflowSignal({
    clientId: client.id,
    stage: client.stage,
    lastContactAt: client.lastContactAt,
    nextTouchAt,
    leaseReminderAt: client.leaseReminderAt,
    leaseReminderNeedsAttention: leaseReminder.needsAttention,
    hasOverdueTask,
    openTaskCount,
    activeHandoff,
    linkedTransactionHref,
    linkedTransactionStatus: inspectionTransactionRecord?.status ?? null,
    linkedTransactionClosingDate:
      inspectionTransactionRecord?.closingDate ?? null,
    linkedTransactionMoveInDate:
      inspectionTransactionRecord?.moveInDate ?? null,
    timeZone: input.timeZone,
    now,
  });
  const followUpCue = buildFollowUpCue({
    clientId: client.id,
    stage: client.stage,
    lastContactAt: client.lastContactAt,
    nextTouchAt,
    leaseReminderAt: client.leaseReminderAt,
    leaseReminderNeedsAttention: leaseReminder.needsAttention,
    hasOverdueTask,
    openTaskCount,
    activeHandoff,
    linkedTransactionStatus: inspectionTransactionRecord?.status ?? null,
    linkedTransactionHref,
    timeZone: input.timeZone,
    now,
  });
  const playbook = buildFrontOfficePlaybook({
    fullName: client.fullName,
    ownerLabel,
    stage: client.stage,
    intentLabel: client.intent?.trim() || "Intent not captured",
    budgetLabel,
    preferredAreasLabel,
    upcomingAppointmentCount,
  });
  const negotiationOfferCount = negotiationOffersSnapshot?.offers.length ?? 0;
  const negotiationBoundaryLabel = negotiationTransactionId
    ? "BO workspace live"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Ready for BO handoff"
      : "Front Office prep";
  const negotiationBoundaryTone: FrontOfficeClientDetailTone =
    negotiationTransactionId
      ? "success"
      : isFrontOfficeStageReadyForBackOffice(client.stage)
        ? "warning"
        : "accent";
  const negotiationPrimaryActionLabel = negotiationTransactionId
    ? negotiationOfferCount > 0
      ? "Open BO offers"
      : "Start BO offer tracking"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Open Back Office create flow"
      : workflow.actionLabel;
  const negotiationPrimaryActionHref = negotiationTransactionId
    ? buildOfferWorkspaceHref(negotiationTransactionId)
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? (activeHandoff?.href ?? "/office/transactions")
      : workflow.actionHref;
  const negotiationPrimaryAction = negotiationTransactionId
    ? buildClientAction({
        label: negotiationPrimaryActionLabel,
        href: negotiationPrimaryActionHref,
        kind: frontOfficeClientDetailActionKinds.openBackOfficeOffers,
        target: frontOfficeClientDetailActionTargets.backOfficeOffers,
      })
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? buildClientAction({
          label: negotiationPrimaryActionLabel,
          href: negotiationPrimaryActionHref,
          kind: frontOfficeClientDetailActionKinds.openBackOfficeCreate,
          target: frontOfficeClientDetailActionTargets.backOfficeCreate,
        })
      : workflow.action;
  const negotiationBoundaryTitle = negotiationTransactionId
    ? "Formal offer workspace is now the source of truth"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Negotiation is ready to become a formal record"
      : "Keep offer prep lightweight inside Front Office";
  const negotiationBoundaryDescription = negotiationTransactionId
    ? negotiationOfferCount > 0
      ? `${negotiationOfferCount} offer record(s) already exist in the shared Back Office workspace, so comparison, documents, and signatures stay anchored there.`
      : "The formal transaction record is live. Start structured offer tracking from the shared Back Office offers workspace instead of creating a second Front Office record."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Stage, appointments, send trail, and handoff context are already lined up. The next formal offer record should start in Back Office, not as a duplicate Front Office note."
      : "Use appointment feedback, send context, and follow-up to sharpen pricing, timing, and decision-maker clarity before this becomes a formal Back Office offer workflow.";
  const negotiationBoundaryMetaLabel = negotiationTransactionId
    ? inspectionTransactionRecord
      ? buildTransactionContextMetaLabel({
          title: inspectionTransactionRecord.title,
          address: inspectionTransactionRecord.address,
          city: inspectionTransactionRecord.city,
          state: inspectionTransactionRecord.state,
          acceptanceDate: inspectionTransactionRecord.acceptanceDate,
          closingDate: inspectionTransactionRecord.closingDate,
          moveInDate: inspectionTransactionRecord.moveInDate,
          timeZone: input.timeZone,
        })
      : "Linked transaction ready"
    : activeHandoffDraft
      ? activeHandoffDraft.summary?.trim() ||
        buildFrontOfficeHandoffSummary(
          activeHandoffDraft.stageLabel,
          client.fullName,
        )
      : `Current stage · ${client.stage}`;
  const negotiationEmptyStateTitle = negotiationTransactionId
    ? "No formal offers yet"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "No BO offer workspace started yet"
      : "Still in Front Office prep";
  const negotiationEmptyStateDescription = negotiationTransactionId
    ? "Once the first Back Office offer is created, it will appear here with status, price, expiration, and direct links into the shared offer workspace."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "This client is at a BO-ready stage, but the formal transaction and offer workspace have not been opened yet."
      : "This client is not yet at a formal negotiation / offer stage, so the next move should stay in Front Office follow-up, showing, and send prep.";
  const inspectionBoundaryLabel = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Inspection-era live"
      : "Contract file live"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Ready for contract file"
      : "Front Office prep";
  const inspectionBoundaryTone: FrontOfficeClientDetailTone =
    negotiationTransactionId
      ? inspectionTransactionRecord?.acceptanceDate
        ? "success"
        : "accent"
      : isFrontOfficeStageReadyForBackOffice(client.stage)
        ? "warning"
        : "neutral";
  const inspectionBoundaryTitle = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Inspection-era execution now lives in the shared BO workspace"
      : "Formal contract file is live, but acceptance is not locked yet"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "The next formal contract step should start in Back Office"
      : "Inspection support starts after the formal file exists";
  const inspectionBoundaryDescription = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Use the shared Back Office transaction to drive checklist work, signatures, incoming update review, and client-facing milestone clarity through the inspection window."
      : "The transaction record exists, but Acre does not have an accepted-contract date yet. Finish the offer-to-contract transition in Back Office before treating this as a live inspection file."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Negotiation is advanced enough that the next formal contract / inspection step should begin from the shared Back Office record, not as a second Front Office checklist."
      : "Keep the client in Front Office follow-up, showing, and negotiation prep until the formal contract file is opened.";
  const inspectionBoundaryMetaLabel = negotiationTransactionId
    ? inspectionTransactionRecord
      ? buildTransactionContextMetaLabel({
          title: inspectionTransactionRecord.title,
          address: inspectionTransactionRecord.address,
          city: inspectionTransactionRecord.city,
          state: inspectionTransactionRecord.state,
          acceptanceDate: inspectionTransactionRecord.acceptanceDate,
          closingDate: inspectionTransactionRecord.closingDate,
          moveInDate: inspectionTransactionRecord.moveInDate,
          timeZone: input.timeZone,
        })
      : "Back Office transaction ready"
    : activeHandoffDraft
      ? activeHandoffDraft.summary?.trim() ||
        buildFrontOfficeHandoffSummary(
          activeHandoffDraft.stageLabel,
          client.fullName,
        )
      : `Current stage · ${client.stage}`;
  const inspectionPrimaryActionLabel = negotiationTransactionId
    ? inspectionOverdueTaskCount > 0 || inspectionOpenTaskCount > 0
      ? "Open BO tasks"
      : inspectionPendingSignatureCount > 0
        ? "Open signatures"
        : inspectionPendingIncomingUpdateCount > 0
          ? "Review incoming updates"
          : "Open transaction"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Open Back Office create flow"
      : workflow.actionLabel;
  const inspectionPrimaryActionHref = negotiationTransactionId
    ? inspectionOverdueTaskCount > 0 || inspectionOpenTaskCount > 0
      ? buildTransactionWorkspaceHref(
          negotiationTransactionId,
          "transaction-tasks",
        )
      : inspectionPendingSignatureCount > 0
        ? buildTransactionWorkspaceHref(
            negotiationTransactionId,
            "transaction-forms-signatures",
          )
        : inspectionPendingIncomingUpdateCount > 0
          ? buildTransactionWorkspaceHref(
              negotiationTransactionId,
              "transaction-incoming-updates",
            )
          : buildTransactionWorkspaceHref(negotiationTransactionId)
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? (activeHandoff?.href ?? "/office/transactions")
      : workflow.actionHref;
  const inspectionPrimaryAction = negotiationTransactionId
    ? inspectionOverdueTaskCount > 0 || inspectionOpenTaskCount > 0
      ? buildClientAction({
          label: inspectionPrimaryActionLabel,
          href: inspectionPrimaryActionHref,
          kind: frontOfficeClientDetailActionKinds.openBackOfficeTasks,
          target: frontOfficeClientDetailActionTargets.backOfficeTasks,
        })
      : inspectionPendingSignatureCount > 0
        ? buildClientAction({
            label: inspectionPrimaryActionLabel,
            href: inspectionPrimaryActionHref,
            kind: frontOfficeClientDetailActionKinds.openBackOfficeSignatures,
            target: frontOfficeClientDetailActionTargets.backOfficeSignatures,
          })
        : inspectionPendingIncomingUpdateCount > 0
          ? buildClientAction({
              label: inspectionPrimaryActionLabel,
              href: inspectionPrimaryActionHref,
              kind: frontOfficeClientDetailActionKinds.openBackOfficeIncomingUpdates,
              target:
                frontOfficeClientDetailActionTargets.backOfficeIncomingUpdates,
            })
          : buildClientAction({
              label: inspectionPrimaryActionLabel,
              href: inspectionPrimaryActionHref,
              kind: frontOfficeClientDetailActionKinds.openTransaction,
              target:
                frontOfficeClientDetailActionTargets.backOfficeTransaction,
            })
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? buildClientAction({
          label: inspectionPrimaryActionLabel,
          href: inspectionPrimaryActionHref,
          kind: frontOfficeClientDetailActionKinds.openBackOfficeCreate,
          target: frontOfficeClientDetailActionTargets.backOfficeCreate,
        })
      : workflow.action;
  const inspectionEmptyStateTitle = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "No inspection pressure right now"
      : "Contract file is live"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Formal contract support has not started yet"
      : "Still in Front Office prep";
  const inspectionEmptyStateDescription = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Open tasks, pending signatures, and incoming review items will show up here when the shared transaction workspace needs action."
      : "Open the formal transaction record to finish acceptance / contract setup. Inspection-era checklist support will become meaningful once the BO file is carrying the live milestones."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "This client is BO-ready, but the formal contract workspace has not been opened yet."
      : "Inspection support is intentionally deferred until the client reaches formal contract work.";
  const inspectionItems = negotiationTransactionId
    ? [
        ...inspectionTaskRows.map((task) => ({
          id: `task-${task.id}`,
          title: task.title,
          statusLabel: formatTransactionTaskStatusLabel(task.status),
          statusTone: mapTransactionTaskTone(task.status, task.dueAt, now),
          contextLabel: task.checklistGroup?.trim() || "BO checklist",
          description: [
            formatTaskDueLabel(task.dueAt, now, input.timeZone),
            task.assigneeMembership
              ? `Assignee · ${
                  `${task.assigneeMembership.user.firstName ?? ""} ${task.assigneeMembership.user.lastName ?? ""}`.trim() ||
                  task.assigneeMembership.user.email ||
                  "Unassigned"
                }`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
          metaLabel:
            task.dueAt && task.dueAt.getTime() < now.getTime()
              ? "Needs attention now"
              : "Open Back Office checklist item",
          actionLabel: "Open BO tasks",
          href: buildTransactionWorkspaceHref(
            negotiationTransactionId,
            "transaction-tasks",
          ),
        })),
        ...inspectionSignatureRows.map((request) => ({
          id: `signature-${request.id}`,
          title:
            request.contextLabel?.trim() ||
            request.form?.name?.trim() ||
            `Signature request for ${request.recipientName || request.recipientEmail}`,
          statusLabel: formatSignatureRequestStatusLabel(request.status),
          statusTone: mapSignatureRequestTone(request.status),
          contextLabel:
            request.recipientName?.trim() || request.recipientEmail.trim(),
          description: [
            request.sentAt
              ? `Sent ${formatDateLabel(request.sentAt, input.timeZone)}`
              : request.status === SignatureRequestStatus.pending_send
                ? "Ready to send"
                : "",
            request.expiresAt
              ? `Expires ${formatDateLabel(request.expiresAt, input.timeZone)}`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
          metaLabel: request.form?.name?.trim() || "Shared BO signature flow",
          actionLabel: "Open signatures",
          href: buildTransactionWorkspaceHref(
            negotiationTransactionId,
            "transaction-forms-signatures",
          ),
        })),
        ...inspectionIncomingUpdateRows.map((update) => ({
          id: `incoming-update-${update.id}`,
          title: update.summary,
          statusLabel: formatIncomingUpdateStatusLabel(update.status),
          statusTone: mapIncomingUpdateTone(update.status),
          contextLabel: `${update.sourceSystem} · ${update.sourceReference}`,
          description: `Received ${formatDateLabel(
            update.receivedAt,
            input.timeZone,
          )}`,
          metaLabel: "Awaiting Back Office review",
          actionLabel: "Review update",
          href: buildTransactionWorkspaceHref(
            negotiationTransactionId,
            "transaction-incoming-updates",
          ),
        })),
      ]
    : [];
  const closingReferenceDate =
    inspectionTransactionRecord?.moveInDate ??
    inspectionTransactionRecord?.closingDate ??
    inspectionTransactionRecord?.acceptanceDate ??
    null;
  const closingDayOffset = closingReferenceDate
    ? getDayDifferenceFromToday(closingReferenceDate, now)
    : null;
  const hasClosedTransaction =
    inspectionTransactionRecord?.status === TransactionStatus.closed;
  const hasCancelledTransaction =
    inspectionTransactionRecord?.status === TransactionStatus.cancelled;
  const isFreshWin =
    hasClosedTransaction &&
    closingDayOffset !== null &&
    closingDayOffset >= -21 &&
    closingDayOffset <= 7;
  const isClosingSoon =
    !hasClosedTransaction &&
    !hasCancelledTransaction &&
    closingDayOffset !== null &&
    closingDayOffset >= 0 &&
    closingDayOffset <= 14;
  const closingBoundaryLabel = hasCancelledTransaction
    ? "No active win path"
    : isFreshWin
      ? "Fresh win"
      : hasClosedTransaction
        ? "Post-close nurture"
        : isClosingSoon
          ? "Closing soon"
          : negotiationTransactionId
            ? "Formal deal in flight"
            : isFrontOfficeStageReadyForBackOffice(client.stage)
              ? "Ready for deal wrap"
              : "Pre-win prep";
  const closingBoundaryTone: FrontOfficeClientDetailTone =
    hasCancelledTransaction
      ? "danger"
      : hasClosedTransaction
        ? "success"
        : isClosingSoon
          ? "warning"
          : negotiationTransactionId
            ? "accent"
            : isFrontOfficeStageReadyForBackOffice(client.stage)
              ? "warning"
              : "neutral";
  const closingBoundaryTitle = hasCancelledTransaction
    ? "This file did not turn into a closed win"
    : isFreshWin
      ? "The deal just closed and the follow-up window is open"
      : hasClosedTransaction
        ? "The deal is closed and now needs post-close follow-through"
        : isClosingSoon
          ? "The deal is approaching its closing or move-in window"
          : negotiationTransactionId
            ? "Formal deal execution is active, but the wrap-up is not here yet"
            : isFrontOfficeStageReadyForBackOffice(client.stage)
              ? "The file is ready for formal deal-wrap execution"
              : "Closing guidance starts after the formal deal exists";
  const closingBoundaryDescription = hasCancelledTransaction
    ? "The formal transaction no longer points to a live close. Use Front Office for respectful re-entry, alternate options, or a future nurture touch instead of pretending a win exists."
    : isFreshWin
      ? "The shared transaction record now proves the win. Front Office should turn that into a same-week check-in, recap, referral ask, or move-in support plan before the momentum cools."
      : hasClosedTransaction
        ? "The formal record is already closed. Front Office should keep the client relationship alive through post-close follow-up, referral timing, and future move planning."
        : isClosingSoon
          ? "The formal file already has a near-term closing or move-in milestone. Front Office should make the wrap-up visible now instead of waiting until the date has already passed."
          : negotiationTransactionId
            ? "The formal file is active, but the best next move is still to tighten transaction milestones and place the first post-close touch before the close happens."
            : isFrontOfficeStageReadyForBackOffice(client.stage)
              ? "The client is BO-ready, but the formal deal-wrap record has not been opened yet. Start there before relying on win-stage guidance."
              : "This client is not yet in a deal-wrap phase, so closing guidance should stay dormant while follow-up, showing, and negotiation prep continue.";
  const closingBoundaryMetaLabel = negotiationTransactionId
    ? inspectionTransactionRecord
      ? buildTransactionContextMetaLabel({
          title: inspectionTransactionRecord.title,
          address: inspectionTransactionRecord.address,
          city: inspectionTransactionRecord.city,
          state: inspectionTransactionRecord.state,
          acceptanceDate: inspectionTransactionRecord.acceptanceDate,
          closingDate: inspectionTransactionRecord.closingDate,
          moveInDate: inspectionTransactionRecord.moveInDate,
          timeZone: input.timeZone,
        })
      : "Linked transaction ready"
    : activeHandoffDraft
      ? activeHandoffDraft.summary?.trim() ||
        buildFrontOfficeHandoffSummary(
          activeHandoffDraft.stageLabel,
          client.fullName,
        )
      : `Current stage · ${client.stage}`;
  const closingTransactionStatusLabel = inspectionTransactionRecord
    ? formatTransactionStatusLabel(inspectionTransactionRecord.status)
    : "No linked transaction";
  const closingKeyDateLabel = inspectionTransactionRecord?.moveInDate
    ? `Move-in ${formatDateLabel(
        inspectionTransactionRecord.moveInDate,
        input.timeZone,
      )}`
    : inspectionTransactionRecord?.closingDate
      ? `Closing ${formatDateLabel(
          inspectionTransactionRecord.closingDate,
          input.timeZone,
        )}`
      : inspectionTransactionRecord?.acceptanceDate
        ? `Accepted ${formatDateLabel(
            inspectionTransactionRecord.acceptanceDate,
            input.timeZone,
          )}`
        : "No milestone date captured";
  const closingPrimaryActionLabel = hasClosedTransaction
    ? "Create follow-up"
    : negotiationTransactionId
      ? "Open transaction"
      : isFrontOfficeStageReadyForBackOffice(client.stage)
        ? "Open Back Office create flow"
        : workflow.actionLabel;
  const closingPrimaryActionHref = hasClosedTransaction
    ? "#front-office-follow-up-form"
    : negotiationTransactionId
      ? buildTransactionWorkspaceHref(negotiationTransactionId)
      : isFrontOfficeStageReadyForBackOffice(client.stage)
        ? (activeHandoff?.href ?? "/office/transactions")
        : workflow.actionHref;
  const closingPrimaryActionOpensInNewTab = false;
  const closingPrimaryAction = hasClosedTransaction
    ? buildClientAction({
        label: closingPrimaryActionLabel,
        href: closingPrimaryActionHref,
        kind: frontOfficeClientDetailActionKinds.createFollowUp,
        target: frontOfficeClientDetailActionTargets.frontOfficeFollowUp,
      })
    : negotiationTransactionId
      ? buildClientAction({
          label: closingPrimaryActionLabel,
          href: closingPrimaryActionHref,
          kind: frontOfficeClientDetailActionKinds.openTransaction,
          target: frontOfficeClientDetailActionTargets.backOfficeTransaction,
        })
      : isFrontOfficeStageReadyForBackOffice(client.stage)
        ? buildClientAction({
            label: closingPrimaryActionLabel,
            href: closingPrimaryActionHref,
            kind: frontOfficeClientDetailActionKinds.openBackOfficeCreate,
            target: frontOfficeClientDetailActionTargets.backOfficeCreate,
          })
        : workflow.action;
  const closingEmptyStateTitle = hasCancelledTransaction
    ? "No closing guidance is active"
    : hasClosedTransaction
      ? "Post-close suggestions are ready"
      : negotiationTransactionId
        ? "Deal wrap guidance will fill in as the file settles"
        : isFrontOfficeStageReadyForBackOffice(client.stage)
          ? "The formal deal-wrap file has not started yet"
          : "Too early for closing guidance";
  const closingEmptyStateDescription = hasCancelledTransaction
    ? "Use Front Office follow-up, alternate options, or future nurture steps instead of a closeout workflow."
    : hasClosedTransaction
      ? "The formal win is already recorded, and the next recommendations should keep the relationship active after close."
      : negotiationTransactionId
        ? "As closing dates, move-in timing, or transaction outcomes settle, the dossier will turn those signals into wrap-up guidance."
        : isFrontOfficeStageReadyForBackOffice(client.stage)
          ? "Open the formal Back Office deal first. Closing suggestions are intentionally downstream of that shared transaction record."
          : "Closing and win suggestions stay dormant until the client reaches a formal deal stage.";
  const closingSuggestions: FrontOfficeClientDetailClosingItem[] =
    hasCancelledTransaction
      ? [
          {
            id: "future-nurture",
            title: "Place a respectful future check-in",
            statusLabel: nextTouchAt ? "Touch on books" : "Suggested",
            statusTone: nextTouchAt ? "success" : "warning",
            contextLabel: "Nurture",
            description: nextTouchAt
              ? `The next touch is already visible: ${formatRelativeDueLabel(
                  nextTouchAt,
                  now,
                  input.timeZone,
                )}.`
              : "The formal deal did not close, so the next best move is a clean future touch instead of silence.",
            metaLabel: closingBoundaryMetaLabel,
            actionLabel: "Create follow-up",
            href: "#front-office-follow-up-form",
            opensInNewTab: false,
          },
          {
            id: "alternate-options",
            title: "Keep alternative options ready if timing reopens",
            statusLabel: "Standby",
            statusTone: "neutral",
            contextLabel: "Re-entry plan",
            description:
              "If the client restarts, the fastest recovery path is to reopen listing output from this same dossier instead of rebuilding context from scratch.",
            metaLabel: `${sendCount} tracked send(s) already attached to this client`,
            actionLabel: "Open listing output",
            href: buildFrontOfficeListingsHref({
              clientId: client.id,
              lane: frontOfficeListingsLanes.followThrough,
            }),
            opensInNewTab: false,
          },
        ]
      : hasClosedTransaction
        ? [
            {
              id: "post-close-touch",
              title: nextTouchAt
                ? "Keep the post-close touch on the calendar"
                : "Book a post-close touch while the win is fresh",
              statusLabel: nextTouchAt ? "Scheduled" : "Suggested",
              statusTone: nextTouchAt ? "success" : "warning",
              contextLabel: "Retention",
              description: nextTouchAt
                ? formatRelativeDueLabel(nextTouchAt, now, input.timeZone)
                : "No future touch is scheduled even though the formal deal is already closed.",
              metaLabel: closingKeyDateLabel,
              actionLabel: "Create follow-up",
              href: "#front-office-follow-up-form",
              opensInNewTab: false,
            },
            {
              id: "client-recap-pdf",
              title: "Use the client summary PDF as the win recap packet",
              statusLabel: "Ready now",
              statusTone: "accent",
              contextLabel: "Client-facing recap",
              description:
                "The current dossier can already generate a clean client summary PDF for move-in, milestone, or thank-you communication.",
              metaLabel: `${sendCount} tracked send(s) already live on this dossier`,
              actionLabel: "Download client PDF",
              href: buildClientPdfHref(client.id),
              opensInNewTab: true,
            },
            {
              id: "referral-window",
              title: "Ask for a referral or testimonial before momentum cools",
              statusLabel:
                isFreshWin ||
                (closingDayOffset !== null && closingDayOffset >= -45)
                  ? "Fresh window"
                  : "Keep warm",
              statusTone:
                isFreshWin ||
                (closingDayOffset !== null && closingDayOffset >= -45)
                  ? "accent"
                  : "neutral",
              contextLabel: "Win capture",
              description:
                isFreshWin ||
                (closingDayOffset !== null && closingDayOffset >= -45)
                  ? "The outcome is recent enough that a referral, testimonial, or celebration touch will still feel natural."
                  : "The win is older now, so frame the next touch as support and relationship maintenance rather than a hard ask.",
              metaLabel: closingBoundaryMetaLabel,
              actionLabel: "Create follow-up",
              href: "#front-office-follow-up-form",
              opensInNewTab: false,
            },
          ]
        : negotiationTransactionId
          ? [
              {
                id: "confirm-close-date",
                title: "Confirm the closing or move-in date in the shared file",
                statusLabel: closingReferenceDate
                  ? "Date on file"
                  : "Missing date",
                statusTone: closingReferenceDate ? "accent" : "warning",
                contextLabel: "Deal wrap",
                description: closingReferenceDate
                  ? closingKeyDateLabel
                  : "A formal transaction exists, but no closing or move-in milestone is captured yet.",
                metaLabel: closingBoundaryMetaLabel,
                actionLabel: "Open transaction",
                href: buildTransactionWorkspaceHref(negotiationTransactionId),
                opensInNewTab: false,
              },
              {
                id: "post-close-plan",
                title: nextTouchAt
                  ? "Keep the first post-close touch visible now"
                  : "Place the first post-close touch before the close happens",
                statusLabel: nextTouchAt ? "Scheduled" : "Suggested",
                statusTone: nextTouchAt ? "success" : "warning",
                contextLabel: "Retention prep",
                description: nextTouchAt
                  ? formatRelativeDueLabel(nextTouchAt, now, input.timeZone)
                  : "Do not wait until after close to think about the next client relationship touch.",
                metaLabel: `${openTaskCount} FO follow-up task(s) still open`,
                actionLabel: "Create follow-up",
                href: "#front-office-follow-up-form",
                opensInNewTab: false,
              },
              {
                id: "prepare-pdf",
                title: "Prepare the client recap PDF before the closing call",
                statusLabel: "Ready now",
                statusTone: "accent",
                contextLabel: "Client-facing recap",
                description:
                  "The dossier can already export a clean client summary PDF, so wrap-up communication does not need a separate manual document.",
                metaLabel: closingBoundaryMetaLabel,
                actionLabel: "Download client PDF",
                href: buildClientPdfHref(client.id),
                opensInNewTab: true,
              },
            ]
          : isFrontOfficeStageReadyForBackOffice(client.stage)
            ? [
                {
                  id: "open-formal-file",
                  title:
                    "Open the formal Back Office file before planning the close",
                  statusLabel: "Required first",
                  statusTone: "warning",
                  contextLabel: "BO boundary",
                  description:
                    "Closing and win guidance depend on the shared transaction record, so the first move is still to open the formal Back Office file.",
                  metaLabel: closingBoundaryMetaLabel,
                  actionLabel: "Open Back Office create flow",
                  href: activeHandoff?.href ?? "/office/transactions",
                  opensInNewTab: false,
                },
              ]
            : [];
  const latestUpcomingAppointment =
    client.appointments.find(
      (appointment) =>
        appointment.status === AppointmentStatus.scheduled &&
        appointment.startsAt.getTime() >= now.getTime(),
    ) ?? null;
  const latestSendRecord = client.frontOfficeSendRecords[0]
    ? {
        listingTitle:
          client.frontOfficeSendRecords[0].listing?.title?.trim() ||
          "Front Office material send",
        sentAt: client.frontOfficeSendRecords[0].sentAt,
        openCount: client.frontOfficeSendRecords[0].openCount,
        lastOpenedAt: client.frontOfficeSendRecords[0].lastOpenedAt,
      }
    : null;
  const latestUpcomingAppointmentExternalWorkflow = latestUpcomingAppointment
    ? getFrontOfficeAppointmentExternalWorkflowState({
        metadata: latestUpcomingAppointment.metadata,
        timeZone: input.timeZone ?? null,
      })
    : null;
  const nextStepRail = buildNextStepRail({
    clientId: client.id,
    stage: client.stage,
    now,
    timeZone: input.timeZone,
    nextTouchAt,
    openTaskCount,
    hasOverdueTask,
    hasUpcomingAppointment: upcomingAppointmentCount > 0,
    latestUpcomingAppointment: latestUpcomingAppointment
      ? {
          title: latestUpcomingAppointment.title,
          startsAt: latestUpcomingAppointment.startsAt,
          externalStatusLabel:
            latestUpcomingAppointmentExternalWorkflow?.label ??
            "External follow-up not tracked",
          externalStatusDetail:
            latestUpcomingAppointmentExternalWorkflow?.detail ??
            "No external follow-up state is captured yet.",
        }
      : null,
    sendCount,
    openedSendCount,
    revisitCount,
    latestSendRecord,
    workflow,
    isReadyForBackOffice: isFrontOfficeStageReadyForBackOffice(client.stage),
    hasLinkedTransaction: Boolean(negotiationTransactionId),
    hasClosedTransaction,
    hasCancelledTransaction,
    isClosingSoon,
    negotiation: {
      boundaryLabel: negotiationBoundaryLabel,
      boundaryTitle: negotiationBoundaryTitle,
      boundaryDescription: negotiationBoundaryDescription,
      boundaryMetaLabel: negotiationBoundaryMetaLabel,
      primaryAction: negotiationPrimaryAction,
    },
    inspection: {
      boundaryLabel: inspectionBoundaryLabel,
      boundaryTitle: inspectionBoundaryTitle,
      boundaryDescription: inspectionBoundaryDescription,
      boundaryMetaLabel: inspectionBoundaryMetaLabel,
      primaryAction: inspectionPrimaryAction,
      openTaskCount: inspectionOpenTaskCount,
      pendingSignatureCount: inspectionPendingSignatureCount,
      pendingIncomingUpdateCount: inspectionPendingIncomingUpdateCount,
    },
    closing: {
      boundaryLabel: closingBoundaryLabel,
      boundaryTitle: closingBoundaryTitle,
      boundaryDescription: closingBoundaryDescription,
      boundaryMetaLabel: closingBoundaryMetaLabel,
      primaryAction: closingPrimaryAction,
    },
  });
  const contract = buildDossierContract({
    stage: client.stage,
    nextStepRail,
    followUpCue,
    activeHandoffDraft,
    activeHandoffHref: activeHandoff?.href ?? null,
    clientFullName: client.fullName,
    hasLinkedTransaction: Boolean(negotiationTransactionId),
    hasClosedTransaction,
    hasCancelledTransaction,
    isReadyForBackOffice: isFrontOfficeStageReadyForBackOffice(client.stage),
  });
  const aiSuggestions = buildFrontOfficeAiSuggestions({
    clientId: client.id,
    fullName: client.fullName,
    now,
    stage: client.stage,
    intentLabel: client.intent?.trim() || "Intent not captured",
    budgetLabel,
    preferredAreasLabel,
    sendCount,
    openedSendCount,
    revisitCount,
    nextTouchLabel,
    leaseReminder,
    workflow,
    playbook,
    latestAppointment: latestUpcomingAppointment
      ? {
          title: latestUpcomingAppointment.title,
          startsAt: latestUpcomingAppointment.startsAt,
          type: latestUpcomingAppointment.type,
        }
      : null,
    latestSendRecord,
    hasClosedTransaction,
    hasCancelledTransaction,
    hasLinkedTransaction: Boolean(negotiationTransactionId),
    isClosingSoon,
    isReadyForBackOffice: isFrontOfficeStageReadyForBackOffice(client.stage),
    closingKeyDateLabel,
    closingBoundaryLabel,
    closingPrimaryActionLabel,
    closingPrimaryActionHref,
    closingPrimaryActionOpensInNewTab,
    historyIndex: aiHistoryIndex,
    timeZone: input.timeZone,
  });
  const aiAcceptedActions: FrontOfficeClientDetailAiAcceptedActions = {
    acceptedCount: aiAcceptedActionCount,
    positiveOutcomeCount: aiPositiveOutcomeCount,
    breakdown: clientAiAcceptedActionBreakdown,
    windows: clientAiAcceptedActionWindows,
    items: recentAiAcceptedActions.map((action) => {
      const outcome = mapFrontOfficeAiAcceptedActionOutcome({
        actionType: action.actionType,
        followUpTask: action.followUpTask,
        sendRecord: action.sendRecord,
        now,
        timeZone: input.timeZone,
      });

      return {
        id: action.id,
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
        actionLabel:
          action.actionType === "tracked_send_created"
            ? "Open listing output"
            : "Open follow-up queue",
        href:
          action.actionType === "tracked_send_created"
            ? buildFrontOfficeListingsHref({
                clientId: client.id,
                lane: frontOfficeListingsLanes.followThrough,
              })
            : "#front-office-follow-up-form",
      };
    }),
  };
  const attentionTaskCount = client.followUpTasks.filter((task) => {
    const isResolved =
      task.status === TaskStatus.completed ||
      task.status === TaskStatus.canceled;

    if (isResolved || !task.dueAt) {
      return false;
    }

    return getCalendarDayDifference(task.dueAt, now) <= 0;
  }).length;
  const dueSoonTaskCount = client.followUpTasks.filter((task) => {
    const isResolved =
      task.status === TaskStatus.completed ||
      task.status === TaskStatus.canceled;

    if (isResolved || !task.dueAt) {
      return false;
    }

    const dayDifference = getCalendarDayDifference(task.dueAt, now);
    return dayDifference > 0 && dayDifference <= 7;
  }).length;

  return {
    id: client.id,
    fullName: client.fullName,
    email: client.email?.trim() || "",
    phone: client.phone?.trim() || "",
    stage: client.stage,
    stageTone: mapClientStageTone(client.stage),
    sourceLabel: client.source?.trim() || "Source not captured",
    intentLabel: client.intent?.trim() || "Intent not captured",
    budgetLabel,
    preferredAreasLabel,
    notesLabel: client.notes?.trim() || "No internal notes yet",
    ownerLabel,
    lastTouchLabel: client.lastContactAt
      ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
      : "No contact logged yet",
    nextTouchLabel,
    summary: {
      openTaskCount,
      overdueTaskCount,
      completedTaskCount,
      attentionTaskCount,
      dueSoonTaskCount,
      upcomingAppointmentCount,
      stageHistoryCount: client.stageHistory.length,
      openHandoffCount,
    },
    leaseReminder,
    engagement: {
      sendCount,
      openedSendCount,
      revisitCount,
      lastEngagementLabel: sendAggregate._max.lastOpenedAt
        ? `Last opened · ${formatDateTimeLabel(
            sendAggregate._max.lastOpenedAt,
            {
              timeZone: input.timeZone ?? null,
            },
          )}`
        : "No client engagement yet",
    },
    negotiation: {
      stageLabel: client.stage,
      stageTone: mapClientStageTone(client.stage),
      boundaryLabel: negotiationBoundaryLabel,
      boundaryTone: negotiationBoundaryTone,
      boundaryTitle: negotiationBoundaryTitle,
      boundaryDescription: negotiationBoundaryDescription,
      boundaryMetaLabel: negotiationBoundaryMetaLabel,
      offerCount: negotiationOfferCount,
      expiringSoonCount: negotiationOffersSnapshot?.expiringSoonCount ?? 0,
      acceptedOfferLabel:
        negotiationOffersSnapshot?.acceptedOfferLabel || "No accepted offer",
      primaryActionLabel: negotiationPrimaryActionLabel,
      primaryActionHref: negotiationPrimaryActionHref,
      emptyStateTitle: negotiationEmptyStateTitle,
      emptyStateDescription: negotiationEmptyStateDescription,
      offers:
        negotiationTransactionId && negotiationOffersSnapshot
          ? negotiationOffersSnapshot.offers.slice(0, 4).map((offer) => ({
              id: offer.id,
              title: offer.title,
              statusLabel: offer.status,
              statusTone: mapOfferStatusTone(offer.statusValue),
              partyLabel:
                offer.buyerName.trim() || offer.offeringPartyName.trim(),
              priceLabel: offer.price || "Price not captured",
              expirationLabel: offer.expirationAt
                ? `Expires ${formatDateLabel(
                    new Date(offer.expirationAt),
                    input.timeZone,
                  )}`
                : "No expiration set",
              updatedAtLabel: `Updated ${formatDateTimeLabel(
                new Date(offer.updatedAt),
                { timeZone: input.timeZone ?? null },
              )}`,
              href: buildOfferWorkspaceHref(negotiationTransactionId, offer.id),
            }))
          : [],
    },
    inspection: {
      boundaryLabel: inspectionBoundaryLabel,
      boundaryTone: inspectionBoundaryTone,
      boundaryTitle: inspectionBoundaryTitle,
      boundaryDescription: inspectionBoundaryDescription,
      boundaryMetaLabel: inspectionBoundaryMetaLabel,
      openTaskCount: inspectionOpenTaskCount,
      overdueTaskCount: inspectionOverdueTaskCount,
      pendingSignatureCount: inspectionPendingSignatureCount,
      pendingIncomingUpdateCount: inspectionPendingIncomingUpdateCount,
      primaryActionLabel: inspectionPrimaryActionLabel,
      primaryActionHref: inspectionPrimaryActionHref,
      emptyStateTitle: inspectionEmptyStateTitle,
      emptyStateDescription: inspectionEmptyStateDescription,
      items: inspectionItems,
    },
    closing: {
      boundaryLabel: closingBoundaryLabel,
      boundaryTone: closingBoundaryTone,
      boundaryTitle: closingBoundaryTitle,
      boundaryDescription: closingBoundaryDescription,
      boundaryMetaLabel: closingBoundaryMetaLabel,
      transactionStatusLabel: closingTransactionStatusLabel,
      keyDateLabel: closingKeyDateLabel,
      nextTouchLabel: formatRelativeDueLabel(nextTouchAt, now, input.timeZone),
      primaryActionLabel: closingPrimaryActionLabel,
      primaryActionHref: closingPrimaryActionHref,
      primaryActionOpensInNewTab: closingPrimaryActionOpensInNewTab,
      emptyStateTitle: closingEmptyStateTitle,
      emptyStateDescription: closingEmptyStateDescription,
      suggestions: closingSuggestions,
    },
    aiSuggestions,
    aiAcceptedActions,
    followUpCue,
    contract,
    workflow,
    nextStepRail,
    playbook,
    stageHistory: client.stageHistory.map((entry) => {
      const actorLabel =
        `${entry.membership?.user.firstName ?? ""} ${entry.membership?.user.lastName ?? ""}`.trim() ||
        entry.membership?.user.email ||
        "Front Office";
      const transitionLabel = entry.fromStage?.trim()
        ? `${entry.fromStage} → ${entry.toStage}`
        : `Entered ${entry.toStage}`;
      const noteLabel = entry.note?.trim() || "";

      return {
        id: entry.id,
        title: transitionLabel,
        description: [noteLabel || "", `Updated by ${actorLabel}`]
          .filter(Boolean)
          .join(" · "),
        actorLabel,
        noteLabel,
        changedAtLabel: formatDateTimeLabel(entry.createdAt, {
          timeZone: input.timeZone ?? null,
        }),
        changedAtValue: formatDateTimeValue(entry.createdAt),
        tone: mapClientStageTone(entry.toStage),
      };
    }),
    appointments: client.appointments.map((appointment) => {
      const externalWorkflow = getFrontOfficeAppointmentExternalWorkflowState({
        metadata: appointment.metadata,
        timeZone: input.timeZone ?? null,
      });
      const bridgeStatus =
        appointmentBridgeStatusMap.get(appointment.id) ?? null;
      const calendarWritebackHref = buildFrontOfficeCalendarHref({
        clientId: client.id,
        appointmentId: appointment.id,
        calendarView: resolveFrontOfficeCalendarView({
          bridgeActivityState: mapBridgeActivityState(bridgeStatus),
          externalStatusValue: externalWorkflow.value,
          hasBridgeActivity: bridgeStatus?.hasBridgeActivity ?? false,
          hasNextAction: Boolean(externalWorkflow.nextActionAtValue),
          isExternalTouchDue: Boolean(
            externalWorkflow.nextActionAt &&
            externalWorkflow.nextActionAt.getTime() <= now.getTime(),
          ),
        }),
      });
      const bridgeNextStepLabel = bridgeStatus?.hasBridgeActivity
        ? "Open calendar writeback"
        : externalWorkflow.value === "confirmed"
          ? "Open calendar writeback after confirmation"
          : externalWorkflow.value === "reschedule_requested"
            ? "Bridge the reschedule, then open calendar writeback"
            : externalWorkflow.value === "needs_follow_up" ||
                externalWorkflow.value === "confirmation_pending"
              ? "Keep the bridge moving, then open calendar writeback"
              : "Open calendar writeback after the next external touch";
      const bridgeNextStepDetail = bridgeStatus?.hasBridgeActivity
        ? "The bridge has already been logged, so the next touch should be recorded in the calendar route instead of starting a second coordination surface."
        : externalWorkflow.value === "confirmed"
          ? "The outside status is settled enough that the calendar route should capture the next touch and keep the focus on this appointment."
          : externalWorkflow.value === "reschedule_requested"
            ? "Once the new time or reply is confirmed, move straight into calendar writeback with the same appointment focus."
            : externalWorkflow.value === "needs_follow_up" ||
                externalWorkflow.value === "confirmation_pending"
              ? "Use the bridge action first, then come back to calendar writeback when the outside reply is ready to record."
              : "Calendar writeback should happen after the next external touch, not as a separate coordination page.";
      const externalLinks = buildFrontOfficeAppointmentExternalLinks({
        appointmentId: appointment.id,
        title: appointment.title,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        location: appointment.location,
        meetingUrl: appointment.meetingUrl,
        clientName: client.fullName,
        clientEmail: client.email,
        contactLabel: appointment.contactLabel,
        listingTitle: appointment.listing?.title,
        listingNeighborhood: appointment.listing?.neighborhood,
        listingCity: appointment.listing?.city,
        followUpCadenceLabel: bridgeNextStepLabel,
        followUpCadenceDetail: bridgeNextStepDetail,
        timeZone: input.timeZone ?? null,
      });
      const outputHandoffAction = buildClientAction({
        label: "Open listing output",
        href: buildFrontOfficeListingsHref({
          clientId: client.id,
          appointmentId: appointment.id,
          lane: resolveFrontOfficeListingsLane({
            openCount: bridgeStatus?.hasBridgeActivity ? 1 : 0,
            appointmentId: appointment.id,
            hasListingContext: Boolean(appointment.listing),
            latestEngagementKey: bridgeStatus?.hasBridgeActivity
              ? "opened"
              : null,
          }),
        }),
        kind: frontOfficeClientDetailActionKinds.openListingOutput,
        target: frontOfficeClientDetailActionTargets.frontOfficeListingOutput,
      });
      const googleCalendarAction = buildClientAction({
        label: "Open Google Calendar",
        href: externalLinks.googleCalendarHref,
        kind: frontOfficeClientDetailActionKinds.openGoogleCalendar,
        target: frontOfficeClientDetailActionTargets.externalGoogleCalendar,
        opensInNewTab: true,
      });
      const outlookCalendarAction = buildClientAction({
        label: "Open Outlook",
        href: externalLinks.outlookCalendarHref,
        kind: frontOfficeClientDetailActionKinds.openOutlookCalendar,
        target: frontOfficeClientDetailActionTargets.externalOutlookCalendar,
        opensInNewTab: true,
      });
      const icsAction = buildClientAction({
        label: "Download ICS",
        href: externalLinks.icsHref,
        kind: frontOfficeClientDetailActionKinds.downloadIcs,
        target: frontOfficeClientDetailActionTargets.externalIcs,
        opensInNewTab: true,
      });
      const emailBriefAction = externalLinks.emailBriefHref
        ? buildClientAction({
            label: "Open email brief",
            href: externalLinks.emailBriefHref,
            kind: frontOfficeClientDetailActionKinds.openEmailBrief,
            target: frontOfficeClientDetailActionTargets.externalEmailBrief,
            opensInNewTab: true,
          })
        : null;

      return {
        id: appointment.id,
        title: appointment.title,
        typeValue: appointment.type,
        typeLabel: formatAppointmentTypeLabel(appointment.type),
        typeTone: mapAppointmentTypeTone(appointment.type),
        statusValue: appointment.status,
        statusLabel: formatAppointmentStatusLabel(appointment.status),
        statusTone: mapAppointmentStatusTone(appointment.status),
        externalStatusValue: externalWorkflow.value,
        externalStatusLabel: externalWorkflow.label,
        externalStatusTone: externalWorkflow.tone,
        externalStatusDetail: externalWorkflow.detail,
        externalNextActionAtValue: externalWorkflow.nextActionAtValue,
        externalNextActionAtLabel: externalWorkflow.nextActionAtLabel,
        calendarWritebackHref,
        bridgeNextStepLabel,
        bridgeNextStepDetail,
        startsAtValue: formatDateTimeValue(appointment.startsAt),
        startsAtLabel: formatDateTimeLabel(appointment.startsAt, {
          timeZone: input.timeZone ?? null,
        }),
        locationLabel:
          appointment.location?.trim() ||
          appointment.meetingUrl?.trim() ||
          "Location pending",
        contextLabel: appointment.listing
          ? `${appointment.listing.title} · ${appointment.listing.neighborhood}, ${appointment.listing.city}`
          : appointment.contactLabel?.trim() || "Front Office appointment",
        outputHandoff: {
          source: "appointment",
          clientId: client.id,
          appointmentId: appointment.id,
          hasAppointmentContext: true,
          hasListingContext: Boolean(appointment.listing),
          action: outputHandoffAction,
        },
        listingOutputHref: outputHandoffAction.href,
        googleCalendarAction,
        googleCalendarHref: externalLinks.googleCalendarHref,
        outlookCalendarAction,
        outlookCalendarHref: externalLinks.outlookCalendarHref,
        icsAction,
        icsHref: externalLinks.icsHref,
        emailBriefAction,
        emailBriefHref: externalLinks.emailBriefHref,
        bridgeActivityState: mapBridgeActivityState(bridgeStatus),
        bridgeStatusLabel: bridgeStatus?.label ?? "External bridge idle",
        bridgeStatusDetail:
          bridgeStatus?.detail ??
          "No Google / Outlook / ICS / email action logged yet",
        bridgeStatusTone: bridgeStatus?.tone ?? "neutral",
        bridgeActionLabel:
          bridgeStatus?.actionLabel ?? "No bridge action logged",
        bridgeLoggedAtLabel:
          bridgeStatus?.loggedAtLabel ?? "No bridge activity yet",
        hasBridgeActivity: bridgeStatus?.hasBridgeActivity ?? false,
      };
    }),
    followUpTasks: client.followUpTasks.map((task) => {
      const assigneeLabel =
        `${task.assigneeMembership?.user.firstName ?? ""} ${task.assigneeMembership?.user.lastName ?? ""}`.trim() ||
        task.assigneeMembership?.user.email ||
        "Unassigned";
      const isResolved =
        task.status === TaskStatus.completed ||
        task.status === TaskStatus.canceled;
      const needsAttention =
        !isResolved &&
        Boolean(task.dueAt && getCalendarDayDifference(task.dueAt, now) <= 0);
      const timelineAt =
        isResolved || !task.dueAt ? task.updatedAt : task.dueAt;
      const createdAtLabel = formatDateTimeLabel(task.createdAt, {
        timeZone: input.timeZone ?? null,
      });
      const updatedAtLabel = formatDateTimeLabel(task.updatedAt, {
        timeZone: input.timeZone ?? null,
      });

      return {
        id: task.id,
        title: task.title,
        statusValue: task.status,
        dueLabel: formatTaskDueLabel(task.dueAt, now, input.timeZone),
        dueAtValue: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
        statusLabel: formatTaskStatusLabel(task.status),
        queueLabel: buildTaskQueueLabel(task.status, task.dueAt, now),
        helperLabel: buildTaskHelperLabel({
          status: task.status,
          dueAt: task.dueAt,
          assigneeLabel,
          now,
        }),
        tone: mapTaskTone(task.status, task.dueAt, now),
        assigneeLabel,
        needsAttention,
        isResolved,
        createdAtLabel,
        createdAtValue: formatDateTimeValue(task.createdAt),
        updatedAtLabel,
        updatedAtValue: formatDateTimeValue(task.updatedAt),
        timelineAtLabel:
          isResolved || !task.dueAt
            ? `Updated ${updatedAtLabel}`
            : `Due ${formatTaskDueLabel(task.dueAt, now, input.timeZone)}`,
        timelineAtValue: formatDateTimeValue(timelineAt),
        timelineTitle: buildTaskTimelineTitle({
          title: task.title,
          status: task.status,
          needsAttention,
          dueAt: task.dueAt,
        }),
        timelineDescription: buildTaskTimelineDescription({
          status: task.status,
          dueAt: task.dueAt,
          assigneeLabel,
          now,
          timeZone: input.timeZone,
        }),
        timelineContext: buildTaskTimelineContext({
          status: task.status,
          queueLabel: buildTaskQueueLabel(task.status, task.dueAt, now),
          statusLabel: formatTaskStatusLabel(task.status),
          needsAttention,
        }),
      };
    }),
    sendRecords: client.frontOfficeSendRecords.map((record) => ({
      id: record.id,
      title:
        record.listing?.title?.trim() ||
        (record.materialType === "listing_share"
          ? "Listing share"
          : "Front Office material"),
      channelValue: record.channel,
      channelLabel: formatFrontOfficeSendChannelLabel(record.channel),
      materialTypeValue: record.materialType,
      stageLabel: formatSendRecordStageLabel(record.clientStageLabel),
      appointmentId: record.appointmentId,
      appointmentLabel: buildSendRecordAppointmentLabel({
        title: record.appointmentTitle,
        startsAt: record.appointmentStartsAt,
        timeZone: input.timeZone,
      }),
      sentAtValue: formatDateTimeValue(record.sentAt),
      sentAtLabel: formatDateTimeLabel(record.sentAt, {
        timeZone: input.timeZone ?? null,
      }),
      engagementKey: mapSendEngagementKey(record.openCount),
      openCount: record.openCount,
      engagementLabel: buildFrontOfficeSendEngagementLabel(record.openCount),
      engagementTone: mapFrontOfficeSendEngagementTone(record.openCount),
      lastActivityLabel:
        record.lastOpenedAt && record.openCount > 0
          ? `Last opened · ${formatDateTimeLabel(record.lastOpenedAt, {
              timeZone: input.timeZone ?? null,
            })}`
          : "No open recorded yet",
      outputHandoff: {
        source: "send_record",
        clientId: client.id,
        appointmentId: record.appointmentId,
        hasAppointmentContext: Boolean(record.appointmentId),
        hasListingContext: Boolean(record.listing),
        action: buildClientAction({
          label: "Open listing output",
          href: buildFrontOfficeListingsHref({
            clientId: client.id,
            appointmentId: record.appointmentId,
            lane: resolveFrontOfficeListingsLane({
              openCount: record.openCount,
              appointmentId: record.appointmentId,
              hasListingContext: Boolean(record.listing),
              latestEngagementKey: mapSendEngagementKey(record.openCount),
            }),
          }),
          kind: frontOfficeClientDetailActionKinds.openListingOutput,
          target: frontOfficeClientDetailActionTargets.frontOfficeListingOutput,
        }),
      },
      href: buildFrontOfficeListingsHref({
        clientId: client.id,
        appointmentId: record.appointmentId,
        lane: resolveFrontOfficeListingsLane({
          openCount: record.openCount,
          appointmentId: record.appointmentId,
          hasListingContext: Boolean(record.listing),
          latestEngagementKey: mapSendEngagementKey(record.openCount),
        }),
      }),
    })),
    handoffs: client.handoffDrafts.map((draft) => ({
      id: draft.id,
      stageLabel: draft.stageLabel,
      statusValue: draft.status,
      statusLabel: formatHandoffStatusLabel(draft.status),
      tone: mapHandoffTone(draft.status),
      summary:
        draft.summary?.trim() ||
        buildFrontOfficeHandoffSummary(draft.stageLabel, client.fullName),
      committedTransactionId: draft.committedTransactionId,
      destinationTarget:
        draft.status === FrontOfficeHandoffStatus.committed &&
        draft.committedTransactionId
          ? frontOfficeClientDetailActionTargets.backOfficeTransaction
          : frontOfficeClientDetailActionTargets.backOfficeCreate,
      action: buildClientAction({
        label:
          draft.status === FrontOfficeHandoffStatus.committed &&
          draft.committedTransactionId
            ? "Open Back Office record"
            : "Open Back Office create flow",
        href:
          draft.status === FrontOfficeHandoffStatus.committed &&
          draft.committedTransactionId
            ? `/office/transactions/${draft.committedTransactionId}`
            : buildFrontOfficeHandoffCreateHref(draft.id),
        kind:
          draft.status === FrontOfficeHandoffStatus.committed &&
          draft.committedTransactionId
            ? frontOfficeClientDetailActionKinds.openBackOfficeRecord
            : frontOfficeClientDetailActionKinds.openBackOfficeCreate,
        target:
          draft.status === FrontOfficeHandoffStatus.committed &&
          draft.committedTransactionId
            ? frontOfficeClientDetailActionTargets.backOfficeTransaction
            : frontOfficeClientDetailActionTargets.backOfficeCreate,
      }),
      updatedAtLabel: formatDateTimeLabel(
        draft.committedAt ?? draft.updatedAt ?? draft.createdAt,
        { timeZone: input.timeZone ?? null },
      ),
      updatedAtValue: formatDateTimeValue(
        draft.committedAt ?? draft.updatedAt ?? draft.createdAt,
      ),
      href:
        draft.status === FrontOfficeHandoffStatus.committed &&
        draft.committedTransactionId
          ? `/office/transactions/${draft.committedTransactionId}`
          : buildFrontOfficeHandoffCreateHref(draft.id),
    })),
    linkedTransactions: client.transactionContacts.map((link) => ({
      id: link.transaction.id,
      label: `${link.transaction.title} · ${link.transaction.address}, ${link.transaction.city}, ${link.transaction.state}`,
      statusLabel: formatTransactionStatusLabel(link.transaction.status),
      roleLabel: link.role
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join("-"),
      href: `/office/transactions/${link.transaction.id}`,
    })),
  };
}
