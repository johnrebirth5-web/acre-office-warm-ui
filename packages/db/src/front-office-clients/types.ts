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

import { FRONT_OFFICE_FOLLOW_UP_FORM_ID, FRONT_OFFICE_FOLLOW_UP_QUEUE_ID, FrontOfficeCalendarView, FrontOfficeListingsLane, buildClientAction, buildClientRouteHref, buildFrontOfficeCalendarHref, buildFrontOfficeListingsHref, buildFrontOfficeSendEngagementLabel, buildLeaseReminderSnapshot, buildPlaybookItem, buildPlaybookObjection, buildPlaybookTemplate, buildSendRecordAppointmentLabel, buildTaskHelperLabel, buildTaskQueueLabel, buildTaskTimelineContext, buildTaskTimelineDescription, buildTaskTimelineTitle, formatAppointmentStatusLabel, formatAppointmentTypeLabel, formatBudgetRange, formatCalendarDistanceLabel, formatCurrency, formatDateLabel, formatDateTimeValue, formatDateValue, formatFrontOfficeSendChannelLabel, formatRelativeDueLabel, formatSendRecordStageLabel, formatTaskDueLabel, formatTaskStatusLabel, frontOfficeCalendarViews, frontOfficeListingsLanes, getCalendarDayDifference, getClientFirstName, hasMeaningfulAreasLabel, hasMeaningfulBudgetLabel, hasMeaningfulIntentLabel, mapAppointmentStatusTone, mapAppointmentTypeTone, mapBridgeActivityState, mapClientStageTone, mapFrontOfficeSendEngagementTone, mapSendEngagementKey, mapTaskTone, pickEarliestDate, resolveFrontOfficeCalendarView, resolveFrontOfficeListingsLane, resolveNextStepRailCalendarView } from "./workflow";
import { buildFrontOfficeAiSuggestions, buildFrontOfficePlaybook } from "./playbook";
import { buildClientPdfHref, buildDossierContract, buildFollowUpCue, buildFrontOfficeClientDetailWorkbenchReturn, buildFrontOfficeFollowUpAction, buildNextStepRail, buildOfferWorkspaceHref, buildTransactionContextMetaLabel, buildTransactionLocationLabel, buildTransactionWorkspaceHref, buildWorkflowSignal, formatHandoffStatusLabel, formatIncomingUpdateStatusLabel, formatSignatureRequestStatusLabel, formatTransactionStatusLabel, formatTransactionTaskStatusLabel, getDayDifferenceFromToday, getFrontOfficeClientDetailWorkbenchDescription, getFrontOfficeClientDetailWorkbenchHref, getFrontOfficeClientDetailWorkbenchLabel, mapHandoffTone, mapIncomingUpdateTone, mapOfferStatusTone, mapSignatureRequestTone, mapTransactionTaskTone } from "./dossier";
import { getFrontOfficeClientDetail } from "./detail";

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
  nextMoveLabel: string;
  nextMoveDescription: string;
  operatorLabel: string;
  operatorDescription: string;
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
  nextMoveLabel: string;
  nextMoveDescription: string;
  operatorLabel: string;
  operatorDescription: string;
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
  nextMoveLabel: string;
  nextMoveDescription: string;
  operatorLabel: string;
  operatorDescription: string;
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
  aiStrategy: FrontOfficeClientDetailAiStrategy;
};



export type FrontOfficeClientDetailAiStrategy = FrontOfficeAiStrategyContract;



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
  aiStrategy: FrontOfficeClientDetailAiStrategy;
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
