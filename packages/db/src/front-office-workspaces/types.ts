import {
  AppointmentStatus,
  AppointmentType,
  ClientFollowUpReminderMode,
  ClientFollowUpStatus,
  FrontOfficeSendChannel,
  ListingStatus,
  NotificationSeverity,
  NotificationType,
  Prisma,
  ResourceType,
  UserRole,
} from "@prisma/client";

import { resolveOfficeDataScope } from "../access";

import { prisma } from "../client";

import { formatDateTimeLabel } from "../date-time";

import {
  frontOfficeAppointmentExternalWorkflowStatuses,
  getFrontOfficeAppointmentExternalWorkflowState,
} from "../front-office-appointments";

import {
  getFrontOfficeResourceInteractionSnapshot,
  getFrontOfficeSharedResourceInteractionSnapshot,
} from "../front-office-resources";

import { buildFrontOfficeListingShareExecutionSummary } from "../front-office-listing-output";

import { resolveLeaseReminderDates } from "../lease-reminders";

import { reconcileOfficeNotificationReminders } from "../notifications";

import { DuplicateCandidate, FrontOfficeClientsWorkspaceView, activeListingStatuses, buildCleanupFilterCountRecord, buildCleanupKindCountRecord, buildClientWorkspaceAnchor, buildClientWorkspaceHref, buildElapsedDayCount, buildFreshnessLabel, buildNotificationGroupCountRecord, buildNotificationStreamCountRecord, cleanStringList, compareClientStageLabels, compareFrontOfficeClientQueueRecords, formatAreaSummaryLabel, formatBudgetRange, formatClientIntentLabel, formatCountLabel, formatCurrency, formatDateLabel, formatElapsedDayLabel, formatLooseTitleLabel, formatNextTouchLabel, formatRelativeDueLabel, formatSourceLabel, getClientStageSortRank, isBoundaryStage, isViewingLaneStage, mapClientStageTone, normalizeClientStageLabel, normalizeDuplicateEmail, normalizeDuplicateName, normalizeDuplicatePhone, openFollowUpStatuses, resolveClientNextTouchAt } from "./shared";
import { buildCalendarAppointmentHref, buildClientDetailHref, buildDuplicateCandidateDetailLabel, buildDuplicateCandidateStrengthScore, buildDuplicateRecommendationLabel, buildDuplicateRecord, buildFrontOfficeActivityCleanupFilterContract, buildFrontOfficeActivityNoticeFilterContract, buildFrontOfficeActivityNoticeStreamFilterContract, buildFrontOfficeActivityReadStateFilterContract, buildFrontOfficeDuplicatePairs, buildFrontOfficeResourceHref, buildFrontOfficeResourcesExecutionPulse, buildInitials, buildListingAreaLabel, buildListingSummaryLabel, buildOfficeScopeFilter, buildResourceDetailLabel, buildSendRecordAppointmentLabel, buildVendorCategoryDescription, buildVendorContactLabel, buildVendorCoverageLabel, buildVendorHeadline, buildVendorPrimaryActionLabel, buildVendorPrimaryHref, buildVendorQuickActionLabel, buildVisibleContactScopeWhere, buildVisibleEventWhere, countVendorQuickActions, formatAppointmentStatusLabel, formatAppointmentTypeLabel, formatEventVisibilityLabel, formatFrontOfficeSendChannelLabel, formatListingStatus, formatNotificationType, formatResourceType, formatSendRecordStageLabel, formatUserRoleLabel, formatVendorCategoryLabel, frontOfficeClientSectionAnchors, getFrontOfficeCleanupSectionLabel, getFrontOfficeClientsSnapshot, getFrontOfficeNotificationActionLabel, getFrontOfficeNotificationGroup, getFrontOfficeNotificationNextStepLabel, getFrontOfficeNotificationOwnerLabel, getFrontOfficeNotificationPressureState, getFrontOfficeNotificationScopeLabel, getFrontOfficeNotificationSectionLabel, getFrontOfficeNotificationSortRank, getFrontOfficeNotificationStream, getFrontOfficeNotificationStreamSortRank, getFrontOfficeToneSortRank, getListingStatusSortRank, getResourceActionLabel, getResourceTypeDescription, getResourceTypeDetailLabel, getResourceTypeLaneLabel, getResourceTypePriority, getResourceTypeStartLabel, getResourceTypeTone, getVendorCategoryPriority, getVisibleFrontOfficeDuplicatePairs, isClosedClientStage, mapAppointmentStatusTone, mapListingStatusTone, mapNotificationSeverityTone, mapVendorCategoryTone, normalizeFrontOfficeResourceType, readNotificationMetadataString } from "./clients";
import { getFrontOfficeResourcesSnapshot } from "./resources";
import { getFrontOfficeActivitySnapshot } from "./activity";

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



export const frontOfficeActivityNotificationGroupKeys = [
  "appointment_soon",
  "confirmation_due",
  "reschedule_due",
  "external_touch_due",
  "general_notice",
] as const;


export type FrontOfficeActivityNotificationGroupKey =
  (typeof frontOfficeActivityNotificationGroupKeys)[number];



export const frontOfficeActivityNotificationStreamKeys = [
  "front_office",
  "back_office",
  "shared_notice",
  "reference",
] as const;


export type FrontOfficeActivityNotificationStreamKey =
  (typeof frontOfficeActivityNotificationStreamKeys)[number];



export const frontOfficeActivityNotificationOwnerKeys = [
  "assigned_to_viewer",
  "shared_office",
] as const;


export type FrontOfficeActivityNotificationOwnerKey =
  (typeof frontOfficeActivityNotificationOwnerKeys)[number];



export const frontOfficeActivityNotificationScopeKeys = [
  "meeting_countdown",
  "calendar_writeback",
  "front_office_action",
  "back_office_handoff",
  "shared_office_notice",
  "awareness_only",
] as const;


export type FrontOfficeActivityNotificationScopeKey =
  (typeof frontOfficeActivityNotificationScopeKeys)[number];



export const frontOfficeActivityNotificationPressureKeys = [
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


export type FrontOfficeActivityNotificationPressureKey =
  (typeof frontOfficeActivityNotificationPressureKeys)[number];



export const frontOfficeActivityCleanupKindKeys = [
  "follow_up",
  "appointment_writeback",
  "send_risk",
  "stale_client",
] as const;


export type FrontOfficeActivityCleanupKindKey =
  (typeof frontOfficeActivityCleanupKindKeys)[number];



export const frontOfficeActivityCleanupFilterKeys = [
  "all",
  "follow_up",
  "appointment_writeback",
  "send_risk",
  "stale_client",
  "duplicate_review",
] as const;


export type FrontOfficeActivityCleanupFilterKey =
  (typeof frontOfficeActivityCleanupFilterKeys)[number];



export const frontOfficeActivityCleanupOwnerKeys = ["assigned_to_viewer"] as const;


export type FrontOfficeActivityCleanupOwnerKey =
  (typeof frontOfficeActivityCleanupOwnerKeys)[number];



export const frontOfficeActivityCleanupScopeKeys = [
  "meeting_countdown",
  "calendar_writeback",
  "follow_up_task",
  "client_next_touch",
  "tracked_send_rescue",
  "client_freshness",
] as const;


export type FrontOfficeActivityCleanupScopeKey =
  (typeof frontOfficeActivityCleanupScopeKeys)[number];



export const frontOfficeActivityCleanupPressureKeys = [
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


export type FrontOfficeActivityCleanupPressureKey =
  (typeof frontOfficeActivityCleanupPressureKeys)[number];



export const frontOfficeActivityNoticeFilterKeys = [
  "all",
  "appointment_soon",
  "confirmation_due",
  "reschedule_due",
  "external_touch_due",
  "general_notice",
] as const;


export type FrontOfficeActivityNoticeFilterKey =
  (typeof frontOfficeActivityNoticeFilterKeys)[number];



export const frontOfficeActivityNoticeStreamFilterKeys = [
  "all",
  "front_office",
  "back_office",
  "shared_notice",
  "reference",
] as const;


export type FrontOfficeActivityNoticeStreamFilterKey =
  (typeof frontOfficeActivityNoticeStreamFilterKeys)[number];



export const frontOfficeActivityReadStateKeys = ["all", "unread", "read"] as const;


export type FrontOfficeActivityReadState =
  (typeof frontOfficeActivityReadStateKeys)[number];



export type FrontOfficeActivityFilterOption<TValue extends string> = {
  value: TValue;
  label: string;
  count: number;
};



export type FrontOfficeActivityFilterContract<TValue extends string> = {
  defaultValue: TValue;
  paramKey: string;
  options: FrontOfficeActivityFilterOption<TValue>[];
};



export type FrontOfficeActivityNoticeFilterContract =
  FrontOfficeActivityFilterContract<FrontOfficeActivityNoticeFilterKey> & {
    activityViewRules: {
      appointmentRemindersDisallow: "general_notice";
      generalNoticesForce: "general_notice";
    };
  };



export type FrontOfficeActivityNoticeStreamFilterContract =
  FrontOfficeActivityFilterContract<FrontOfficeActivityNoticeStreamFilterKey> & {
    appliesToGroupKey: "general_notice";
  };



export type FrontOfficeActivityReadStateFilterContract =
  FrontOfficeActivityFilterContract<FrontOfficeActivityReadState> & {
    sharedNoticeBehavior: "shared_notices_ignore_read_state";
  };



export type FrontOfficeActivityCleanupMetricCountMode =
  | "raw_pressure"
  | "surfaced_items";



export type FrontOfficeActivityCounts = {
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
  displayName: string;
  wechatDisplayName: string;
  stage: string;
  stageTone: FrontOfficeTone;
  followUpStatus: ClientFollowUpStatus;
  followUpStatusLabel: string;
  followUpStatusTone: FrontOfficeTone;
  followUpReminderMode: ClientFollowUpReminderMode;
  followUpReminderModeLabel: string;
  intentLabel: string;
  budgetLabel: string;
  areasLabel: string;
  sourceLabel: string;
  lastTouchLabel: string;
  nextTouchLabel: string;
  lastFollowUpLabel: string;
  nextReminderLabel: string;
  nextReminderValue: string;
  noteSummary: string;
  legacyOpenTaskCount: number;
  href: string;
};



export type FrontOfficeClientsSnapshot = {
  summary: {
    liveContacts: number;
    activeStages: number;
    followUpDueCount: number;
    overdueTaskCount: number;
    potentialDuplicateCount: number;
    missingContactCount: number;
    missingNextTouchCount: number;
    viewingLaneCount: number;
    boundaryReviewCount: number;
    leaseWatchCount: number;
  };
  workspaceAnchor: {
    label: string;
    tone: FrontOfficeTone;
    contextLabel: string;
    description: string;
    primaryActionLabel: string;
    primaryActionHref: string;
    secondaryActionLabel: string;
    secondaryActionHref: string;
    returnSectionLabel: string;
    returnSectionHref: string;
    returnSectionDescription: string;
    returnLabel: string;
    returnHref: string;
    returnDescription: string;
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
  latestTrackedShare: {
    modeLabel: string;
    channelLabel: string;
    sentAtLabel: string;
    sentAtValue: string;
    trackingLabel: string;
    trackingStatus: "tracked_link_only" | "tracked_send_recorded";
    statusTone: FrontOfficeTone;
    writebackLabel: string;
    writebackScopeLabel: string;
    nextStepLabel: string;
    clientLabel: string | null;
    clientStageDisplayLabel: string | null;
    clientHref: string | null;
    appointmentLabel: string | null;
    appointmentWindowLabel: string | null;
    appointmentHref: string | null;
  } | null;
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



export type FrontOfficeResourceRecord = {
  id: string;
  title: string;
  summary: string;
  detailLabel: string;
  freshnessLabel: string;
  actionLabel: string;
  laneLabel: string;
  typeKey: ResourceType;
  typeLabel: string;
  typeTone: FrontOfficeTone;
  tagCount: number;
  tags: string[];
  href: string;
};



export type FrontOfficeVendorRecord = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  categoryTone: FrontOfficeTone;
  headline: string;
  neighborhoodsLabel: string;
  coverageLabel: string;
  contactLabel: string;
  actionLabel: string;
  websiteHref: string | null;
  phoneHref: string | null;
  emailHref: string | null;
  quickActionCount: number;
  quickActionLabel: string;
  isFeatured: boolean;
  href: string | null;
};



export type FrontOfficeResourcesSnapshot = {
  summary: {
    resourceCount: number;
    vendorCount: number;
    resourceTypeCount: number;
    featuredVendorCount: number;
    quickContactVendorCount: number;
    vendorCategoryCount: number;
  };
  interactionTracking: {
    windowLabel: string;
    totalCount: number;
    searchCount: number;
    progressCount: number;
    completionCount: number;
    resourceOpenCount: number;
    vendorClickCount: number;
    recentInteractionCount: number;
    lastInteractionLabel: string;
    recentInteractions: Array<{
      id: string;
      title: string;
      kindLabel:
        | "Resource search"
        | "Watch progress"
        | "Resource open"
        | "Vendor click";
      detailLabel: string;
      timestampLabel: string;
      href: string;
    }>;
    sharedTracking: {
      visible: boolean;
      scopeKey: "self" | "team" | "organization";
      scopeLabel: string;
      windowLabel: string;
      comparisonWindowLabel: string;
      visibleMembershipCount: number;
      activeMembershipCount: number;
      totalCount: number;
      searchCount: number;
      progressCount: number;
      completionCount: number;
      resourceOpenCount: number;
      vendorClickCount: number;
      recentInteractionCount: number;
      lastInteractionLabel: string;
      totalCountDelta: number;
      searchCountDelta: number;
      progressCountDelta: number;
      completionCountDelta: number;
      activeMembershipDelta: number;
      resourceOpenDelta: number;
      vendorClickDelta: number;
      topActors: Array<{
        membershipId: string;
        label: string;
        interactionCount: number;
        lastInteractionLabel: string;
      }>;
      hottestTargets: Array<{
        key: string;
        title: string;
        kindLabel:
          | "Resource search"
          | "Watch progress"
          | "Resource open"
          | "Vendor click";
        detailLabel: string;
        interactionCount: number;
        href: string;
        lastInteractionLabel: string;
      }>;
    };
  };
  executionPulse: {
    libraryLanes: Array<{
      key: ResourceType;
      label: string;
      count: number;
      tone: FrontOfficeTone;
      description: string;
      startLabel: string;
      actionLabel: string;
    }>;
    strongestLane: {
      key: ResourceType;
      label: string;
      count: number;
      tone: FrontOfficeTone;
      description: string;
      startLabel: string;
      actionLabel: string;
    } | null;
    thinnestLane: {
      key: ResourceType;
      label: string;
      count: number;
      tone: FrontOfficeTone;
      description: string;
      startLabel: string;
      actionLabel: string;
    } | null;
    vendorPosture: {
      label: string;
      tone: FrontOfficeTone;
      contextLabel: string;
      description: string;
      readyNowCount: number;
      referenceOnlyCount: number;
    };
  };
  resourceTypes: Array<{
    key: ResourceType;
    label: string;
    count: number;
    tone: FrontOfficeTone;
    description: string;
    startLabel: string;
    actionLabel: string;
  }>;
  vendorCategories: Array<{
    category: string;
    label: string;
    count: number;
    tone: FrontOfficeTone;
    description: string;
  }>;
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
  sectionLabel: string;
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
  nextStepLabel: string;
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
  sectionLabel: string;
  pressureKey: FrontOfficeActivityCleanupPressureKey;
  pressureLabel: string;
  whyNowLabel: string;
  sortLabel: string;
  metaLabels: string[];
  href: string;
  actionLabel: string;
  nextStepLabel: string;
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



export const frontOfficeActivityCleanupFilterLabels: Record<
  FrontOfficeActivityCleanupFilterKey,
  string
> = {
  all: "All personal cleanup",
  follow_up: "Follow-up due",
  appointment_writeback: "Appointment updates",
  send_risk: "Send risk",
  stale_client: "Stale clients",
  duplicate_review: "Duplicate review",
};



export const frontOfficeActivityNoticeFilterLabels: Record<
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



export const frontOfficeActivityNoticeStreamFilterLabels: Record<
  FrontOfficeActivityNoticeStreamFilterKey,
  string
> = {
  all: "All notice categories",
  front_office: "Front Office actions",
  back_office: "Back Office handoff",
  shared_notice: "Shared office notices",
  reference: "Awareness only",
};



export const frontOfficeActivityReadStateLabels: Record<
  FrontOfficeActivityReadState,
  string
> = {
  all: "All",
  unread: "Unread only",
  read: "Read only",
};
