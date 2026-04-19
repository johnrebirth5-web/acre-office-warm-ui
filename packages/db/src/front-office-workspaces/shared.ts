import {
  AppointmentStatus,
  AppointmentType,
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

import { FrontOfficeActivityCleanupFilterKey, FrontOfficeActivityCleanupItem, FrontOfficeActivityCleanupKindKey, FrontOfficeActivityCleanupMetric, FrontOfficeActivityCleanupMetricCountMode, FrontOfficeActivityCleanupOwnerKey, FrontOfficeActivityCleanupPressureKey, FrontOfficeActivityCleanupScopeKey, FrontOfficeActivityCounts, FrontOfficeActivityEventRecord, FrontOfficeActivityFilterContract, FrontOfficeActivityFilterOption, FrontOfficeActivityNoticeFilterContract, FrontOfficeActivityNoticeFilterKey, FrontOfficeActivityNoticeStreamFilterContract, FrontOfficeActivityNoticeStreamFilterKey, FrontOfficeActivityNotificationGroupKey, FrontOfficeActivityNotificationOwnerKey, FrontOfficeActivityNotificationPressureKey, FrontOfficeActivityNotificationRecord, FrontOfficeActivityNotificationScopeKey, FrontOfficeActivityNotificationStreamKey, FrontOfficeActivityReadState, FrontOfficeActivityReadStateFilterContract, FrontOfficeActivitySnapshot, FrontOfficeAgentMaterialFeaturedCase, FrontOfficeAgentMaterialSnapshot, FrontOfficeClientDuplicatePair, FrontOfficeClientDuplicateRecord, FrontOfficeClientRecord, FrontOfficeClientsSnapshot, FrontOfficeListingRecord, FrontOfficeListingsSnapshot, FrontOfficeListingsTargetAppointment, FrontOfficeListingsTargetClient, FrontOfficeResourceRecord, FrontOfficeResourcesSnapshot, FrontOfficeTone, FrontOfficeVendorRecord, FrontOfficeWorkspaceInput, frontOfficeActivityCleanupFilterKeys, frontOfficeActivityCleanupFilterLabels, frontOfficeActivityCleanupKindKeys, frontOfficeActivityCleanupOwnerKeys, frontOfficeActivityCleanupPressureKeys, frontOfficeActivityCleanupScopeKeys, frontOfficeActivityNoticeFilterKeys, frontOfficeActivityNoticeFilterLabels, frontOfficeActivityNoticeStreamFilterKeys, frontOfficeActivityNoticeStreamFilterLabels, frontOfficeActivityNotificationGroupKeys, frontOfficeActivityNotificationOwnerKeys, frontOfficeActivityNotificationPressureKeys, frontOfficeActivityNotificationScopeKeys, frontOfficeActivityNotificationStreamKeys, frontOfficeActivityReadStateKeys, frontOfficeActivityReadStateLabels } from "./types";
import { buildCalendarAppointmentHref, buildClientDetailHref, buildDuplicateCandidateDetailLabel, buildDuplicateCandidateStrengthScore, buildDuplicateRecommendationLabel, buildDuplicateRecord, buildFrontOfficeActivityCleanupFilterContract, buildFrontOfficeActivityNoticeFilterContract, buildFrontOfficeActivityNoticeStreamFilterContract, buildFrontOfficeActivityReadStateFilterContract, buildFrontOfficeDuplicatePairs, buildFrontOfficeResourceHref, buildFrontOfficeResourcesExecutionPulse, buildInitials, buildListingAreaLabel, buildListingSummaryLabel, buildOfficeScopeFilter, buildResourceDetailLabel, buildSendRecordAppointmentLabel, buildVendorCategoryDescription, buildVendorContactLabel, buildVendorCoverageLabel, buildVendorHeadline, buildVendorPrimaryActionLabel, buildVendorPrimaryHref, buildVendorQuickActionLabel, buildVisibleContactScopeWhere, buildVisibleEventWhere, countVendorQuickActions, formatAppointmentStatusLabel, formatAppointmentTypeLabel, formatEventVisibilityLabel, formatFrontOfficeSendChannelLabel, formatListingStatus, formatNotificationType, formatResourceType, formatSendRecordStageLabel, formatUserRoleLabel, formatVendorCategoryLabel, frontOfficeClientSectionAnchors, getFrontOfficeCleanupSectionLabel, getFrontOfficeClientsSnapshot, getFrontOfficeNotificationActionLabel, getFrontOfficeNotificationGroup, getFrontOfficeNotificationNextStepLabel, getFrontOfficeNotificationOwnerLabel, getFrontOfficeNotificationPressureState, getFrontOfficeNotificationScopeLabel, getFrontOfficeNotificationSectionLabel, getFrontOfficeNotificationSortRank, getFrontOfficeNotificationStream, getFrontOfficeNotificationStreamSortRank, getFrontOfficeToneSortRank, getListingStatusSortRank, getResourceActionLabel, getResourceTypeDescription, getResourceTypeDetailLabel, getResourceTypeLaneLabel, getResourceTypePriority, getResourceTypeStartLabel, getResourceTypeTone, getVendorCategoryPriority, getVisibleFrontOfficeDuplicatePairs, isClosedClientStage, mapAppointmentStatusTone, mapListingStatusTone, mapNotificationSeverityTone, mapVendorCategoryTone, normalizeFrontOfficeResourceType, readNotificationMetadataString } from "./clients";
import { getFrontOfficeListingsSnapshot } from "./listings";
import { getFrontOfficeResourcesSnapshot } from "./resources";
import { getFrontOfficeActivitySnapshot } from "./activity";

export function buildNotificationGroupCountRecord() {
  return {
    appointment_soon: 0,
    confirmation_due: 0,
    reschedule_due: 0,
    external_touch_due: 0,
    general_notice: 0,
  } satisfies Record<FrontOfficeActivityNotificationGroupKey, number>;
}



export function buildNotificationStreamCountRecord() {
  return {
    front_office: 0,
    back_office: 0,
    shared_notice: 0,
    reference: 0,
  } satisfies Record<FrontOfficeActivityNotificationStreamKey, number>;
}



export function buildCleanupKindCountRecord() {
  return {
    follow_up: 0,
    appointment_writeback: 0,
    send_risk: 0,
    stale_client: 0,
  } satisfies Record<FrontOfficeActivityCleanupKindKey, number>;
}



export function buildCleanupFilterCountRecord() {
  return {
    all: 0,
    follow_up: 0,
    appointment_writeback: 0,
    send_risk: 0,
    stale_client: 0,
    duplicate_review: 0,
  } satisfies Record<FrontOfficeActivityCleanupFilterKey, number>;
}



export const openFollowUpStatuses = ["queued", "in_progress"] as const;


export const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];



export type FrontOfficeClientsWorkspaceView =
  | "all"
  | "follow_first"
  | "anchor_now"
  | "viewing_lane"
  | "boundary_review"
  | "duplicate_review";



export function formatCurrency(value: Prisma.Decimal | number | null | undefined) {
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



export function formatBudgetRange(
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



export function cleanStringList(
  values: Array<string | null | undefined>,
  maxItems?: number,
) {
  const uniqueValues = Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return typeof maxItems === "number"
    ? uniqueValues.slice(0, maxItems)
    : uniqueValues;
}



export function formatLooseTitleLabel(value: string | null | undefined) {
  return cleanStringList([value])
    .join(" ")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}



export function formatCountLabel(
  value: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${value} ${value === 1 ? singular : plural}`;
}



export function formatClientIntentLabel(value: string | null | undefined) {
  return formatLooseTitleLabel(value) || "Intent not captured";
}



export function formatSourceLabel(value: string | null | undefined) {
  return formatLooseTitleLabel(value) || "Source not captured";
}



export function formatAreaSummaryLabel(
  values: Array<string | null | undefined>,
  emptyLabel: string,
) {
  const cleanedValues = cleanStringList(values);

  if (cleanedValues.length === 0) {
    return emptyLabel;
  }

  if (cleanedValues.length <= 2) {
    return cleanedValues.join(" · ");
  }

  return `${cleanedValues.slice(0, 2).join(" · ")} · +${
    cleanedValues.length - 2
  } more`;
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
    timeZone: timeZone ?? undefined,
  });
}



export function formatElapsedDayLabel(value: number) {
  return formatCountLabel(value, "day");
}



export function buildFreshnessLabel(value: Date, now: Date, timeZone?: string | null) {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  ).getTime();
  const updatedAt = value.getTime();

  if (updatedAt >= startOfToday) {
    return "Updated today";
  }

  if (updatedAt >= startOfYesterday) {
    return "Updated yesterday";
  }

  const ageInDays = Math.max(
    1,
    Math.floor((startOfToday - updatedAt) / 86_400_000),
  );

  if (ageInDays < 7) {
    return `Updated ${formatElapsedDayLabel(ageInDays)} ago`;
  }

  return `Updated ${formatDateLabel(value, timeZone)}`;
}



export function formatRelativeDueLabel(
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



export function formatNextTouchLabel(input: {
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



export function buildElapsedDayCount(value: Date, now: Date, minimum = 1) {
  return Math.max(
    minimum,
    Math.floor((now.getTime() - value.getTime()) / 86_400_000),
  );
}



export function mapClientStageTone(stage: string): FrontOfficeTone {
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



export function getClientStageSortRank(stage: string) {
  const normalized = stage.trim().toLowerCase();

  if (!normalized) {
    return 99;
  }

  if (normalized.includes("cold")) {
    return 0;
  }

  if (normalized.includes("warm")) {
    return 1;
  }

  if (normalized.includes("contacted")) {
    return 2;
  }

  if (normalized.includes("follow-up") || normalized.includes("follow up")) {
    return 3;
  }

  if (
    normalized.includes("viewing scheduled") ||
    normalized.includes("showing scheduled") ||
    normalized.includes("tour scheduled")
  ) {
    return 4;
  }

  if (
    normalized.includes("viewing completed") ||
    normalized.includes("showing completed") ||
    normalized.includes("tour completed")
  ) {
    return 5;
  }

  if (normalized.includes("negotiation")) {
    return 6;
  }

  if (normalized.includes("application") || normalized.includes("offer")) {
    return 7;
  }

  if (normalized.includes("pending")) {
    return 8;
  }

  if (normalized.includes("won")) {
    return 9;
  }

  if (normalized.includes("lost")) {
    return 10;
  }

  return 50;
}



export function compareClientStageLabels(left: string, right: string) {
  const rankDelta =
    getClientStageSortRank(left) - getClientStageSortRank(right);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return left.localeCompare(right);
}



export function normalizeClientStageLabel(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}



export function isViewingLaneStage(stage: string) {
  const normalized = normalizeClientStageLabel(stage);

  return (
    normalized.includes("viewing") ||
    normalized.includes("showing") ||
    normalized.includes("tour") ||
    normalized.includes("open house")
  );
}



export function isBoundaryStage(stage: string) {
  const normalized = normalizeClientStageLabel(stage);

  return (
    normalized.includes("negotiation") ||
    normalized.includes("offer") ||
    normalized.includes("application") ||
    normalized.includes("contract")
  );
}



export function buildClientWorkspaceHref(
  view: FrontOfficeClientsWorkspaceView,
  anchorId: string,
) {
  return `/agent/clients?clientView=${view}#${anchorId}`;
}



export function buildClientWorkspaceAnchor(input: {
  followUpDueCount: number;
  overdueTaskCount: number;
  missingContactCount: number;
  missingNextTouchCount: number;
  viewingLaneCount: number;
  boundaryReviewCount: number;
  duplicatePairCount: number;
}) {
  const followPressureCount = input.followUpDueCount + input.overdueTaskCount;
  const anchorGapCount =
    input.missingContactCount + input.missingNextTouchCount;

  if (followPressureCount > 0) {
    return {
      label: "Follow first",
      tone: "danger" as FrontOfficeTone,
      contextLabel: `${formatCountLabel(followPressureCount, "pressure")} on the active queue`,
      description:
        "Keep the due-today and overdue touches visible before anything else so the Clients page stays execution-first.",
      primaryActionLabel: "Open follow-up view",
      primaryActionHref: buildClientWorkspaceHref(
        "follow_first",
        "client-execution-queue",
      ),
      secondaryActionLabel: "Open cleanup view",
      secondaryActionHref: buildClientWorkspaceHref(
        "anchor_now",
        "client-execution-queue",
      ),
      returnSectionLabel: "Execution queue section",
      returnSectionHref: buildClientWorkspaceHref(
        "follow_first",
        "client-execution-queue",
      ),
      returnSectionDescription:
        "Re-enter the same execution queue section so the next-touch order stays visible after cleanup.",
      returnLabel: "Return to follow-up view",
      returnHref: buildClientWorkspaceHref(
        "follow_first",
        "client-execution-queue",
      ),
      returnDescription:
        "After you clear a record, come back through the same follow-up view so the next touch stays visible and the queue does not drift into passive cleanup.",
    };
  }

  if (anchorGapCount > 0) {
    return {
      label: "Needs attention",
      tone: "warning" as FrontOfficeTone,
      contextLabel: `${formatCountLabel(anchorGapCount, "client")} still need a first touch or next-touch date`,
      description:
        "Keep each visible client tied to a clear first touch or dated next touch instead of letting the page drift into a passive CRM list.",
      primaryActionLabel: "Open cleanup view",
      primaryActionHref: buildClientWorkspaceHref(
        "anchor_now",
        "client-execution-queue",
      ),
      secondaryActionLabel: "Open duplicate review",
      secondaryActionHref: buildClientWorkspaceHref(
        "duplicate_review",
        "duplicate-review",
      ),
      returnSectionLabel: "Cleanup section",
      returnSectionHref: buildClientWorkspaceHref(
        "anchor_now",
        "client-execution-queue",
      ),
      returnSectionDescription:
        "Re-enter the same cleanup section so the first-touch anchor stays visible alongside duplicate review.",
      returnLabel: "Return to cleanup view",
      returnHref: buildClientWorkspaceHref(
        "anchor_now",
        "client-execution-queue",
      ),
      returnDescription:
        "Re-enter cleanup view when a client still needs a first touch or a dated next touch; this same page stays ready for duplicate review and the next cleanup pass.",
    };
  }

  if (input.viewingLaneCount > 0) {
    return {
      label: "Appointments",
      tone: "accent" as FrontOfficeTone,
      contextLabel: `${formatCountLabel(input.viewingLaneCount, "client")} are in appointment follow-up`,
      description:
        "Keep showing and appointment follow-up easy to reopen without losing the surrounding client queue.",
      primaryActionLabel: "Open appointments view",
      primaryActionHref: buildClientWorkspaceHref(
        "viewing_lane",
        "client-execution-queue",
      ),
      secondaryActionLabel: "Open follow-up view",
      secondaryActionHref: buildClientWorkspaceHref(
        "follow_first",
        "client-execution-queue",
      ),
      returnSectionLabel: "Viewing section",
      returnSectionHref: buildClientWorkspaceHref(
        "viewing_lane",
        "client-execution-queue",
      ),
      returnSectionDescription:
        "Re-enter the same viewing section so appointment follow-through stays visible from the same queue anchor.",
      returnLabel: "Return to appointments view",
      returnHref: buildClientWorkspaceHref(
        "viewing_lane",
        "client-execution-queue",
      ),
      returnDescription:
        "Use the same queue anchor to revisit showing follow-up without losing the active client list or the next cleanup step.",
    };
  }

  if (input.boundaryReviewCount > 0) {
    return {
      label: "Ready for Back Office",
      tone: "warning" as FrontOfficeTone,
      contextLabel: `${formatCountLabel(input.boundaryReviewCount, "client")} are ready for Back Office review`,
      description:
        "Negotiation, offer, application, and contract-era work should still be easy to reopen here, but the formal record belongs in Back Office.",
      primaryActionLabel: "Open Back Office review",
      primaryActionHref: buildClientWorkspaceHref(
        "boundary_review",
        "client-execution-queue",
      ),
      secondaryActionLabel: "Open duplicate review",
      secondaryActionHref: buildClientWorkspaceHref(
        "duplicate_review",
        "duplicate-review",
      ),
      returnSectionLabel: "Back Office review section",
      returnSectionHref: buildClientWorkspaceHref(
        "boundary_review",
        "client-execution-queue",
      ),
      returnSectionDescription:
        "Re-enter the same Back Office review section so formal-stage client records stay easy to reopen without drifting into the wrong view.",
      returnLabel: "Return to Back Office review",
      returnHref: buildClientWorkspaceHref(
        "boundary_review",
        "client-execution-queue",
      ),
      returnDescription:
        "Re-open this view when negotiation, offer, or application work needs another Front Office to Back Office check, then step back to duplicate review or cleanup from the same anchor if the queue still needs attention.",
    };
  }

  if (input.duplicatePairCount > 0) {
    return {
      label: "Duplicate review",
      tone: "warning" as FrontOfficeTone,
      contextLabel: `${formatCountLabel(input.duplicatePairCount, "pair")} need merge review`,
      description:
        "Compare the surviving and duplicate records side by side, then merge only after the keep choice is clear. After each merge, come back through this same duplicate-review slice so the next pair and cleanup re-entry stay easy to reopen.",
      primaryActionLabel: "Open duplicate review",
      primaryActionHref: buildClientWorkspaceHref(
        "duplicate_review",
        "duplicate-review",
      ),
      secondaryActionLabel: "Open cleanup view",
      secondaryActionHref: buildClientWorkspaceHref(
        "anchor_now",
        "client-execution-queue",
      ),
      returnSectionLabel: "Duplicate review section",
      returnSectionHref: buildClientWorkspaceHref(
        "duplicate_review",
        "duplicate-review",
      ),
      returnSectionDescription:
        "Re-enter the same duplicate-review section so the next pair and cleanup re-entry stay on the same visible slice.",
      returnLabel: "Re-enter duplicate review",
      returnHref: buildClientWorkspaceHref(
        "duplicate_review",
        "duplicate-review",
      ),
      returnDescription:
        "After a merge completes, reopen this duplicate-review slice to verify the surviving client record, then step back into cleanup view if another pair is still waiting.",
    };
  }

  return {
    label: "Queue clear",
    tone: "success" as FrontOfficeTone,
    contextLabel: "No active client pressure",
    description:
      "The visible client queue is clear enough to reopen intake or widen the current view from the same page.",
    primaryActionLabel: "Open intake review",
    primaryActionHref: buildClientWorkspaceHref(
      "anchor_now",
      "clients-intake-launch",
    ),
    secondaryActionLabel: "Open full queue",
    secondaryActionHref: buildClientWorkspaceHref(
      "all",
      "client-execution-queue",
    ),
    returnSectionLabel: "Intake review section",
    returnSectionHref: buildClientWorkspaceHref(
      "anchor_now",
      "clients-intake-launch",
    ),
    returnSectionDescription:
      "Re-enter the intake section so first-touch work stays explicit before the queue widens again.",
    returnLabel: "Return to intake review",
    returnHref: buildClientWorkspaceHref("anchor_now", "clients-intake-launch"),
    returnDescription:
      "When new work comes in, come back through intake review so the first touch stays explicit and the same page can widen back into cleanup or duplicate review later.",
  };
}



export function resolveClientNextTouchAt(input: {
  nextFollowUpAt: Date | null;
  leaseReminderAt: Date | null;
}) {
  const leaseReminder = resolveLeaseReminderDates({
    leaseEndDate: null,
    leaseReminderAt: input.leaseReminderAt,
  }).leaseReminderAt;

  if (input.nextFollowUpAt && leaseReminder) {
    return input.nextFollowUpAt.getTime() <= leaseReminder.getTime()
      ? input.nextFollowUpAt
      : leaseReminder;
  }

  return input.nextFollowUpAt ?? leaseReminder ?? null;
}



export function compareFrontOfficeClientQueueRecords(
  left: {
    fullName: string;
    stage: string;
    lastContactAt: Date | null;
    nextFollowUpAt: Date | null;
    leaseReminderAt: Date | null;
    updatedAt: Date;
    createdAt: Date;
  },
  right: {
    fullName: string;
    stage: string;
    lastContactAt: Date | null;
    nextFollowUpAt: Date | null;
    leaseReminderAt: Date | null;
    updatedAt: Date;
    createdAt: Date;
  },
  now: Date,
) {
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
  const fifteenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 15,
  ).getTime();

  const resolveBucket = (value: typeof left) => {
    if (isClosedClientStage(value.stage)) {
      return 5;
    }

    const nextTouchAt = resolveClientNextTouchAt(value)?.getTime() ?? null;

    if (nextTouchAt != null && nextTouchAt < startOfToday) {
      return 0;
    }

    if (nextTouchAt != null && nextTouchAt < startOfTomorrow) {
      return 1;
    }

    if (nextTouchAt != null) {
      return 2;
    }

    const lastTouchAt = value.lastContactAt?.getTime() ?? null;

    if (lastTouchAt == null || lastTouchAt <= fifteenDaysAgo) {
      return 3;
    }

    return 4;
  };

  const leftBucket = resolveBucket(left);
  const rightBucket = resolveBucket(right);

  if (leftBucket !== rightBucket) {
    return leftBucket - rightBucket;
  }

  if (leftBucket <= 2) {
    const leftNextTouchAt =
      resolveClientNextTouchAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightNextTouchAt =
      resolveClientNextTouchAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (leftNextTouchAt !== rightNextTouchAt) {
      return leftNextTouchAt - rightNextTouchAt;
    }
  }

  if (leftBucket === 3) {
    const leftStaleAt = (left.lastContactAt ?? left.createdAt).getTime();
    const rightStaleAt = (right.lastContactAt ?? right.createdAt).getTime();

    if (leftStaleAt !== rightStaleAt) {
      return leftStaleAt - rightStaleAt;
    }
  }

  if (left.updatedAt.getTime() !== right.updatedAt.getTime()) {
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  }

  return (
    compareClientStageLabels(left.stage, right.stage) ||
    left.fullName.localeCompare(right.fullName)
  );
}



export function normalizeDuplicateName(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}



export function normalizeDuplicateEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}



export function normalizeDuplicatePhone(value: string | null | undefined) {
  return value?.replace(/\D/g, "") || "";
}



export type DuplicateCandidate = {
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
