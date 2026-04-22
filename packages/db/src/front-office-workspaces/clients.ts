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
import {
  buildFrontOfficeNoteSummary,
  formatFrontOfficeFollowUpStatusLabel,
  formatFrontOfficeLastFollowUpLabel,
  formatFrontOfficeNextReminderLabel,
  formatFrontOfficeReminderModeLabel,
  getClientDisplayName,
  getWechatDisplayName,
  mapFrontOfficeFollowUpStatusTone,
} from "../front-office-follow-up";

import { FrontOfficeActivityCleanupFilterKey, FrontOfficeActivityCleanupItem, FrontOfficeActivityCleanupKindKey, FrontOfficeActivityCleanupMetric, FrontOfficeActivityCleanupMetricCountMode, FrontOfficeActivityCleanupOwnerKey, FrontOfficeActivityCleanupPressureKey, FrontOfficeActivityCleanupScopeKey, FrontOfficeActivityCounts, FrontOfficeActivityEventRecord, FrontOfficeActivityFilterContract, FrontOfficeActivityFilterOption, FrontOfficeActivityNoticeFilterContract, FrontOfficeActivityNoticeFilterKey, FrontOfficeActivityNoticeStreamFilterContract, FrontOfficeActivityNoticeStreamFilterKey, FrontOfficeActivityNotificationGroupKey, FrontOfficeActivityNotificationOwnerKey, FrontOfficeActivityNotificationPressureKey, FrontOfficeActivityNotificationRecord, FrontOfficeActivityNotificationScopeKey, FrontOfficeActivityNotificationStreamKey, FrontOfficeActivityReadState, FrontOfficeActivityReadStateFilterContract, FrontOfficeActivitySnapshot, FrontOfficeAgentMaterialFeaturedCase, FrontOfficeAgentMaterialSnapshot, FrontOfficeClientDuplicatePair, FrontOfficeClientDuplicateRecord, FrontOfficeClientRecord, FrontOfficeClientsSnapshot, FrontOfficeListingRecord, FrontOfficeListingsSnapshot, FrontOfficeListingsTargetAppointment, FrontOfficeListingsTargetClient, FrontOfficeResourceRecord, FrontOfficeResourcesSnapshot, FrontOfficeTone, FrontOfficeVendorRecord, FrontOfficeWorkspaceInput, frontOfficeActivityCleanupFilterKeys, frontOfficeActivityCleanupFilterLabels, frontOfficeActivityCleanupKindKeys, frontOfficeActivityCleanupOwnerKeys, frontOfficeActivityCleanupPressureKeys, frontOfficeActivityCleanupScopeKeys, frontOfficeActivityNoticeFilterKeys, frontOfficeActivityNoticeFilterLabels, frontOfficeActivityNoticeStreamFilterKeys, frontOfficeActivityNoticeStreamFilterLabels, frontOfficeActivityNotificationGroupKeys, frontOfficeActivityNotificationOwnerKeys, frontOfficeActivityNotificationPressureKeys, frontOfficeActivityNotificationScopeKeys, frontOfficeActivityNotificationStreamKeys, frontOfficeActivityReadStateKeys, frontOfficeActivityReadStateLabels } from "./types";
import { DuplicateCandidate, FrontOfficeClientsWorkspaceView, activeListingStatuses, buildCleanupFilterCountRecord, buildCleanupKindCountRecord, buildClientWorkspaceAnchor, buildClientWorkspaceHref, buildElapsedDayCount, buildFreshnessLabel, buildNotificationGroupCountRecord, buildNotificationStreamCountRecord, cleanStringList, compareClientStageLabels, compareFrontOfficeClientQueueRecords, formatAreaSummaryLabel, formatBudgetRange, formatClientIntentLabel, formatCountLabel, formatCurrency, formatDateLabel, formatElapsedDayLabel, formatLooseTitleLabel, formatNextTouchLabel, formatRelativeDueLabel, formatSourceLabel, getClientStageSortRank, isBoundaryStage, isViewingLaneStage, mapClientStageTone, normalizeClientStageLabel, normalizeDuplicateEmail, normalizeDuplicateName, normalizeDuplicatePhone, openFollowUpStatuses, resolveClientNextTouchAt } from "./shared";
import { getFrontOfficeListingsSnapshot } from "./listings";
import { getFrontOfficeResourcesSnapshot } from "./resources";
import { getFrontOfficeActivitySnapshot } from "./activity";

export function buildVisibleContactScopeWhere(
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



export function buildDuplicateCandidateStrengthScore(candidate: DuplicateCandidate) {
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



export function buildDuplicateCandidateDetailLabel(candidate: DuplicateCandidate) {
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
      ? `${candidate._count.transactionContacts} Back Office link(s)`
      : null,
    candidate.preferredAreas.length > 0
      ? `${candidate.preferredAreas.length} area tag(s)`
      : null,
  ].filter((label): label is string => Boolean(label));

  return (
    labels.join(" · ") || "Light client record with no linked workflow yet"
  );
}



export function buildDuplicateRecommendationLabel(
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
    return "Recommended keep: this client record already carries richer contact context.";
  }

  if (recommended.updatedAt.getTime() !== duplicate.updatedAt.getTime()) {
    return "Recommended keep: this record was updated more recently.";
  }

  return "Recommended keep: this record has the stronger contact profile.";
}



export function buildDuplicateRecord(
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
    reviewLabel: isViewerOwned ? "Open client page" : "Open office contact",
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
      ? "In your Front Office queue"
      : "Visible in office CRM scope",
  };
}



export function buildFrontOfficeDuplicatePairs(input: {
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



export function mapListingStatusTone(status: ListingStatus): FrontOfficeTone {
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



export function getListingStatusSortRank(status: ListingStatus) {
  switch (status) {
    case ListingStatus.hot:
      return 0;
    case ListingStatus.active:
      return 1;
    case ListingStatus.pending:
      return 2;
    case ListingStatus.sold:
      return 3;
    case ListingStatus.off_market:
      return 4;
    default:
      return 5;
  }
}



export function formatUserRoleLabel(role: UserRole) {
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



export function buildInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) {
  return (
    `${firstName?.trim().charAt(0) ?? ""}${lastName?.trim().charAt(0) ?? ""}`.toUpperCase() ||
    "AC"
  );
}



export function formatListingStatus(status: ListingStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
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



export function buildCalendarAppointmentHref(input: {
  appointmentId: string;
  clientId?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.clientId?.trim()) {
    params.set("clientId", input.clientId.trim());
  }

  params.set("appointmentId", input.appointmentId);

  return `/agent/calendar?${params.toString()}`;
}



export const frontOfficeClientSectionAnchors = {
  appointmentsFollowUp: "front-office-client-appointments-follow-up",
  listingOutput: "front-office-client-listing-output",
  nextStepRail: "front-office-client-next-step-rail",
} as const;



export function buildClientDetailHref(clientId: string, anchor?: string | null) {
  const href = `/agent/clients/${clientId}`;

  if (!anchor?.trim()) {
    return href;
  }

  return `${href}#${anchor.trim().replace(/^#/, "")}`;
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



export function mapAppointmentStatusTone(status: AppointmentStatus): FrontOfficeTone {
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



export function formatNotificationType(type: NotificationType) {
  if (type === NotificationType.appointment_external_touch_due) {
    return "External touch due";
  }

  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}



export function mapNotificationSeverityTone(
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



export function readNotificationMetadataString(
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



export function getFrontOfficeNotificationGroup(input: {
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



export function getFrontOfficeCleanupSectionLabel(input: {
  kindKey: FrontOfficeActivityCleanupKindKey;
  scopeKey: FrontOfficeActivityCleanupScopeKey;
}) {
  if (input.kindKey === "appointment_writeback") {
    return "Calendar update section";
  }

  if (input.kindKey === "send_risk") {
    return "Send follow-up section";
  }

  if (input.kindKey === "stale_client") {
    return "Recovery section";
  }

  if (input.scopeKey === "follow_up_task") {
    return "Follow-up section";
  }

  return "Next-step section";
}



export function getFrontOfficeNotificationSectionLabel(input: {
  groupKey: FrontOfficeActivityNotificationGroupKey;
  streamKey: FrontOfficeActivityNotificationStreamKey;
  streamLabel: string;
}) {
  if (input.groupKey !== "general_notice") {
    return input.groupKey === "appointment_soon"
      ? "Meeting countdown section"
      : "Calendar update section";
  }

  if (input.streamKey === "front_office") {
    return "Front Office action section";
  }

  if (input.streamKey === "back_office") {
    return "Back Office handoff section";
  }

  if (input.streamKey === "shared_notice") {
    return "Shared office notice section";
  }

  return "Awareness section";
}



export function getFrontOfficeNotificationActionLabel(input: {
  type: NotificationType;
  actionUrl: string | null;
  groupKey: FrontOfficeActivityNotificationRecord["groupKey"];
  streamKey: FrontOfficeActivityNotificationStreamKey;
}) {
  if (input.type === NotificationType.appointment_due_soon) {
    return "Open calendar item";
  }

  if (input.type === NotificationType.appointment_external_touch_due) {
    return input.groupKey === "confirmation_due"
      ? "Open confirmation update"
      : input.groupKey === "reschedule_due"
        ? "Open reschedule update"
        : "Open calendar update";
  }

  if (input.streamKey === "front_office") {
    return "Open Front Office action";
  }

  if (input.streamKey === "back_office") {
    return "Open Back Office handoff";
  }

  if (input.streamKey === "shared_notice") {
    return "Open shared notice";
  }

  if (input.streamKey === "reference") {
    return "Open awareness item";
  }

  return input.actionUrl?.trim() ? "Open notice" : "Review notice";
}



export function getFrontOfficeNotificationNextStepLabel(input: {
  type: NotificationType;
  groupKey: FrontOfficeActivityNotificationRecord["groupKey"];
  streamKey: FrontOfficeActivityNotificationStreamKey;
}) {
  if (input.type === NotificationType.appointment_due_soon) {
    return "Open the calendar page and keep the meeting on track.";
  }

  if (input.type === NotificationType.appointment_external_touch_due) {
    return input.groupKey === "confirmation_due"
      ? "Open the calendar update form and record the confirmation."
      : input.groupKey === "reschedule_due"
        ? "Open the calendar update form and capture the reschedule follow-up."
        : "Open the calendar update form and record the next external touch.";
  }

  if (input.streamKey === "front_office") {
    return "Open the Front Office action and decide the next follow-through.";
  }

  if (input.streamKey === "back_office") {
    return "Open the Back Office handoff and keep the formal workflow moving.";
  }

  if (input.streamKey === "shared_notice") {
    return "Open the shared notice and keep the office-visible context in view.";
  }

  return "Open the awareness item and decide whether this needs action.";
}



export function getFrontOfficeNotificationStream(input: {
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



export function getFrontOfficeNotificationOwnerLabel(readStateMutable: boolean) {
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



export function getFrontOfficeToneSortRank(tone: FrontOfficeTone) {
  switch (tone) {
    case "danger":
      return 0;
    case "warning":
      return 1;
    case "accent":
      return 2;
    case "success":
      return 3;
    default:
      return 4;
  }
}



export function getFrontOfficeNotificationStreamSortRank(
  streamKey: FrontOfficeActivityNotificationStreamKey,
) {
  switch (streamKey) {
    case "front_office":
      return 0;
    case "back_office":
      return 1;
    case "shared_notice":
      return 2;
    default:
      return 3;
  }
}



export function getFrontOfficeNotificationSortRank(input: {
  groupKey: FrontOfficeActivityNotificationRecord["groupKey"];
  pressureTone: FrontOfficeTone;
  streamKey: FrontOfficeActivityNotificationStreamKey;
  readStateMutable: boolean;
  isUnread: boolean;
}) {
  if (input.groupKey !== "general_notice") {
    return getFrontOfficeToneSortRank(input.pressureTone);
  }

  if (input.readStateMutable && input.isUnread) {
    return 10 + getFrontOfficeToneSortRank(input.pressureTone);
  }

  if (!input.readStateMutable) {
    return 20 + getFrontOfficeNotificationStreamSortRank(input.streamKey);
  }

  return 30 + getFrontOfficeToneSortRank(input.pressureTone);
}



export function getFrontOfficeNotificationScopeLabel(input: {
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
      scopeLabel: "Calendar update",
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



export function getFrontOfficeNotificationPressureState(input: {
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
          ? "The promised confirmation window already slipped, so this appointment now needs an update pass before the meeting can stay trustworthy."
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
          : "The client already asked to reschedule, so this update needs a fresh touch before the appointment drifts.",
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



export function formatResourceType(type: ResourceType) {
  return normalizeFrontOfficeResourceType(type)
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}



export function normalizeFrontOfficeResourceType(type: ResourceType) {
  return type === ResourceType.training_video
    ? ResourceType.training_video
    : ResourceType.document;
}



export function buildFrontOfficeResourceHref(resourceId: string, type: ResourceType, url: string) {
  if (normalizeFrontOfficeResourceType(type) === ResourceType.document) {
    return `/api/resources/${resourceId}/file`;
  }

  return url;
}



export function getResourceTypePriority(type: ResourceType) {
  switch (normalizeFrontOfficeResourceType(type)) {
    case ResourceType.document:
      return 0;
    case ResourceType.training_video:
      return 1;
    default:
      return 2;
  }
}



export function getResourceTypeTone(type: ResourceType): FrontOfficeTone {
  switch (normalizeFrontOfficeResourceType(type)) {
    case ResourceType.training_video:
      return "warning";
    default:
      return "neutral";
  }
}



export function getResourceTypeDescription(type: ResourceType) {
  switch (normalizeFrontOfficeResourceType(type)) {
    case ResourceType.document:
      return "Shared PDFs and reference docs that agents can open quickly from one searchable directory.";
    case ResourceType.training_video:
      return "Short coaching clips for refreshers, onboarding, and fast workflow recovery between live tasks.";
    default:
      return "Published Front Office material ready to open.";
  }
}



export function getResourceTypeLaneLabel(type: ResourceType) {
  switch (normalizeFrontOfficeResourceType(type)) {
    case ResourceType.document:
      return "Documents & PDFs";
    case ResourceType.training_video:
      return "Coaching refreshers";
    default:
      return formatResourceType(type);
  }
}



export function getResourceTypeStartLabel(type: ResourceType) {
  switch (normalizeFrontOfficeResourceType(type)) {
    case ResourceType.document:
      return "Start with the document";
    case ResourceType.training_video:
      return "Start with the refresher";
    default:
      return "Start here";
  }
}



export function getResourceTypeDetailLabel(type: ResourceType) {
  switch (normalizeFrontOfficeResourceType(type)) {
    case ResourceType.document:
      return "Keep the canonical PDF or reference close without turning this page into a second formal records system.";
    case ResourceType.training_video:
      return "Use for quick refreshers and coaching moments, not as a background automation or hidden progress layer.";
    default:
      return "Published Front Office material that can be opened directly from the live workflow.";
  }
}



export function getResourceActionLabel(type: ResourceType) {
  switch (normalizeFrontOfficeResourceType(type)) {
    case ResourceType.document:
      return "Open document";
    case ResourceType.training_video:
      return "Watch training";
    default:
      return "Open resource";
  }
}



export function buildResourceDetailLabel(input: {
  type: ResourceType;
  tags: string[];
}) {
  const cleanedTags = cleanStringList(input.tags, 3);

  if (cleanedTags.length > 0) {
    return `Best for ${cleanedTags.join(" · ")}.`;
  }

  return getResourceTypeDetailLabel(input.type);
}



export function buildFrontOfficeResourcesExecutionPulse(input: {
  resourceTypeGroups: Array<{
    type: ResourceType;
    _count: {
      _all: number;
    };
  }>;
  vendorCount: number;
  quickContactVendorCount: number;
}): FrontOfficeResourcesSnapshot["executionPulse"] {
  const countByType = new Map(
    input.resourceTypeGroups.map((group) => [group.type, group._count._all]),
  );
  const libraryLaneKeys: ResourceType[] = [
    ResourceType.document,
    ResourceType.training_video,
  ];
  const libraryLanes = libraryLaneKeys.map((type) => ({
    key: type,
    label: formatResourceType(type),
    count: countByType.get(type) ?? 0,
    tone: getResourceTypeTone(type),
    description: getResourceTypeDescription(type),
    startLabel: getResourceTypeStartLabel(type),
    actionLabel: getResourceActionLabel(type),
  }));
  const strongestLane =
    libraryLanes.slice().sort((left, right) => right.count - left.count)[0] ??
    null;
  const thinnestLane =
    libraryLanes.slice().sort((left, right) => left.count - right.count)[0] ??
    null;
  const referenceOnlyCount = Math.max(
    input.vendorCount - input.quickContactVendorCount,
    0,
  );
  const vendorPosture =
    input.quickContactVendorCount > 0
      ? {
          label: "Partners ready now",
          tone: "success" as const,
          contextLabel: `${formatCountLabel(input.quickContactVendorCount, "quick-contact vendor")} ready`,
          description:
            "The vendor desk is already contact-ready, so outside support can be pulled into the same Front Office workflow without a second lookup pass.",
          readyNowCount: input.quickContactVendorCount,
          referenceOnlyCount,
        }
      : {
          label: "Reference posture",
          tone: "warning" as const,
          contextLabel: `${formatCountLabel(input.quickContactVendorCount, "quick-contact vendor")} ready`,
          description:
            "Published vendors are still acting more like reference cards than contact-ready partners, so agents may need to widen the directory before acting.",
          readyNowCount: input.quickContactVendorCount,
          referenceOnlyCount,
        };

  return {
    libraryLanes,
    strongestLane,
    thinnestLane,
    vendorPosture,
  };
}



export function buildListingAreaLabel(
  neighborhood: string | null | undefined,
  city: string | null | undefined,
) {
  const labels = cleanStringList([neighborhood, city]);

  if (labels.length === 0) {
    return "Area pending";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels[0]}, ${labels[1]}`;
}



export function buildListingSummaryLabel(input: {
  aiSummary: string | null;
  bedrooms: number | null;
  bathrooms: Prisma.Decimal | number | null;
  isPublic: boolean;
}) {
  if (input.aiSummary?.trim()) {
    return input.aiSummary.trim();
  }

  const bedroomLabel = input.bedrooms ? `${input.bedrooms} bd` : null;
  const bathroomLabel = input.bathrooms
    ? `${Number(input.bathrooms)} ba`
    : null;
  const layoutLabel = [bedroomLabel, bathroomLabel].filter(Boolean).join(" · ");

  if (layoutLabel) {
    return input.isPublic
      ? `${layoutLabel} · Public-ready send package.`
      : `${layoutLabel} · Internal shortlist candidate.`;
  }

  return input.isPublic
    ? "Public-ready send package."
    : "Internal shortlist candidate.";
}



export function formatVendorCategoryLabel(category: string | null | undefined) {
  return formatLooseTitleLabel(category) || "Vendor";
}



export function getVendorCategoryPriority(category: string | null | undefined) {
  const normalized = category?.trim().toLowerCase() || "";

  if (
    normalized.includes("mortgage") ||
    normalized.includes("loan") ||
    normalized.includes("lender") ||
    normalized.includes("finance")
  ) {
    return 0;
  }

  if (
    normalized.includes("attorney") ||
    normalized.includes("legal") ||
    normalized.includes("title") ||
    normalized.includes("closing") ||
    normalized.includes("escrow")
  ) {
    return 1;
  }

  if (
    normalized.includes("inspection") ||
    normalized.includes("repair") ||
    normalized.includes("contractor") ||
    normalized.includes("insurance") ||
    normalized.includes("moving")
  ) {
    return 2;
  }

  return 3;
}



export function mapVendorCategoryTone(category: string | null | undefined) {
  const normalized = category?.trim().toLowerCase() || "";

  if (
    normalized.includes("mortgage") ||
    normalized.includes("loan") ||
    normalized.includes("lender") ||
    normalized.includes("finance")
  ) {
    return "success";
  }

  if (
    normalized.includes("attorney") ||
    normalized.includes("legal") ||
    normalized.includes("title") ||
    normalized.includes("closing") ||
    normalized.includes("escrow")
  ) {
    return "accent";
  }

  if (
    normalized.includes("inspection") ||
    normalized.includes("repair") ||
    normalized.includes("contractor") ||
    normalized.includes("moving") ||
    normalized.includes("insurance")
  ) {
    return "warning";
  }

  return "neutral";
}



export function buildVendorCoverageLabel(neighborhoods: string[]) {
  const cleanedNeighborhoods = cleanStringList(neighborhoods);

  if (cleanedNeighborhoods.length === 0) {
    return "Office-wide coverage";
  }

  if (cleanedNeighborhoods.length === 1) {
    return `Covers ${cleanedNeighborhoods[0]}`;
  }

  if (cleanedNeighborhoods.length === 2) {
    return `Covers ${cleanedNeighborhoods.join(" · ")}`;
  }

  return `Covers ${cleanedNeighborhoods.slice(0, 2).join(" · ")} · +${
    cleanedNeighborhoods.length - 2
  } more`;
}



export function buildVendorPrimaryHref(input: {
  website: string | null;
  phone: string | null;
  email: string | null;
}) {
  return (
    input.website?.trim() ||
    (input.phone?.trim()
      ? `tel:${input.phone.trim()}`
      : input.email?.trim()
        ? `mailto:${input.email.trim()}`
        : null)
  );
}



export function buildVendorPrimaryActionLabel(input: {
  website: string | null;
  phone: string | null;
  email: string | null;
}) {
  if (input.website?.trim()) {
    return "Open site";
  }

  if (input.phone?.trim()) {
    return "Call vendor";
  }

  if (input.email?.trim()) {
    return "Email vendor";
  }

  return "Review vendor";
}



export function buildVendorContactLabel(input: {
  website: string | null;
  phone: string | null;
  email: string | null;
}) {
  const quickActionCount = countVendorQuickActions(input);

  if (quickActionCount >= 3) {
    return "Phone, email, and site ready";
  }

  if (quickActionCount === 2) {
    const readyLabels = [
      input.phone?.trim() ? "phone" : null,
      input.email?.trim() ? "email" : null,
      input.website?.trim() ? "site" : null,
    ].filter((value): value is string => Boolean(value));

    return `${readyLabels.join(" + ")} ready`;
  }

  if (input.phone?.trim()) {
    return `Call ${input.phone.trim()}`;
  }

  if (input.email?.trim()) {
    return `Email ${input.email.trim()}`;
  }

  if (input.website?.trim()) {
    return "Website available";
  }

  return "No quick contact published";
}



export function buildVendorQuickActionLabel(count: number) {
  return count > 0
    ? `${formatCountLabel(count, "quick action")} ready`
    : "Reference only";
}



export function buildVendorCategoryDescription(category: string | null | undefined) {
  const normalized = category?.trim().toLowerCase() || "";

  if (
    normalized.includes("mortgage") ||
    normalized.includes("loan") ||
    normalized.includes("lender") ||
    normalized.includes("finance")
  ) {
    return "Use when pre-approval, affordability, or financing questions need a trusted next contact.";
  }

  if (
    normalized.includes("attorney") ||
    normalized.includes("legal") ||
    normalized.includes("title") ||
    normalized.includes("closing") ||
    normalized.includes("escrow")
  ) {
    return "Use when formal contract, title, or closing coordination needs a grounded vendor handoff.";
  }

  if (
    normalized.includes("inspection") ||
    normalized.includes("repair") ||
    normalized.includes("contractor") ||
    normalized.includes("insurance") ||
    normalized.includes("moving")
  ) {
    return "Use when property condition, move logistics, or post-tour prep needs a fast outside partner.";
  }

  return `Shared ${formatVendorCategoryLabel(category).toLowerCase()} support for day-to-day Front Office execution.`;
}



export function buildVendorHeadline(input: {
  category: string | null;
  headline: string | null;
  notes: string | null;
  neighborhoods: string[];
  quickActionCount: number;
}) {
  if (input.headline?.trim()) {
    return input.headline.trim();
  }

  if (input.notes?.trim()) {
    return input.notes.trim();
  }

  const coverageLabel = buildVendorCoverageLabel(input.neighborhoods);
  const categoryLabel = formatVendorCategoryLabel(input.category);

  if (input.quickActionCount > 0) {
    return `${categoryLabel} partner with ${buildVendorQuickActionLabel(
      input.quickActionCount,
    ).toLowerCase()} and ${coverageLabel}.`;
  }

  return `${categoryLabel} partner card ready for ${coverageLabel}.`;
}



export function countVendorQuickActions(input: {
  website: string | null;
  phone: string | null;
  email: string | null;
}) {
  return [
    input.website?.trim(),
    input.phone?.trim(),
    input.email?.trim(),
  ].filter(Boolean).length;
}



export function formatEventVisibilityLabel(
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



export function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}



export function buildFrontOfficeActivityCleanupFilterContract(
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



export function buildFrontOfficeActivityNoticeFilterContract(
  counts: FrontOfficeActivityCounts["notifications"],
): FrontOfficeActivitySnapshot["filters"]["notices"] {
  return {
    defaultValue: "all",
    paramKey: "noticeFilter",
    options: frontOfficeActivityNoticeFilterKeys.map((value) => ({
      value,
      label: frontOfficeActivityNoticeFilterLabels[value],
      count: value === "all" ? counts.visibleCount : counts.byGroup[value],
    })),
    activityViewRules: {
      appointmentRemindersDisallow: "general_notice",
      generalNoticesForce: "general_notice",
    },
  };
}



export function buildFrontOfficeActivityNoticeStreamFilterContract(
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



export function buildFrontOfficeActivityReadStateFilterContract(
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



export function isClosedClientStage(stage: string) {
  const normalized = stage.trim().toLowerCase();
  return normalized.includes("won") || normalized.includes("lost");
}



export function buildVisibleEventWhere(
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



export async function getVisibleFrontOfficeDuplicatePairs(input: {
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
    clientCount,
    stageGroups,
    followUpDueCount,
    overdueTaskCount,
    duplicatePairs,
  ] = await Promise.all([
    prisma.client.findMany({
      where: clientWhere,
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 48,
      select: {
        id: true,
        fullName: true,
        additionalFields: true,
        source: true,
        stage: true,
        intent: true,
        followUpStatus: true,
        followUpReminderMode: true,
        budgetMin: true,
        budgetMax: true,
        preferredAreas: true,
        notes: true,
        lastContactAt: true,
        nextFollowUpAt: true,
        leaseReminderAt: true,
        createdAt: true,
        updatedAt: true,
        followUpTasks: {
          where: {
            status: {
              in: [...openFollowUpStatuses],
            },
          },
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.client.count({
      where: clientWhere,
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
        OR: [
          {
            nextFollowUpAt: {
              lt: startOfTomorrow,
            },
          },
          {
            leaseReminderAt: {
              lt: startOfTomorrow,
            },
          },
        ],
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

  const sortedClients = clients
    .slice()
    .sort((left, right) =>
      compareFrontOfficeClientQueueRecords(left, right, now),
    )
    .slice(0, 24);
  const missingContactCount = sortedClients.filter(
    (client) => !client.lastContactAt,
  ).length;
  const missingNextTouchCount = sortedClients.filter(
    (client) => !client.nextFollowUpAt && !client.leaseReminderAt,
  ).length;
  const viewingLaneCount = sortedClients.filter((client) =>
    isViewingLaneStage(client.stage),
  ).length;
  const boundaryReviewCount = sortedClients.filter((client) =>
    isBoundaryStage(client.stage),
  ).length;
  const leaseWatchCount = sortedClients.filter((client) => {
    if (!client.leaseReminderAt) {
      return false;
    }

    const leaseReminderTime = client.leaseReminderAt.getTime();
    const nextFollowUpTime = client.nextFollowUpAt?.getTime() ?? Infinity;

    return (
      leaseReminderTime >= startOfTomorrow.getTime() &&
      leaseReminderTime <= nextFollowUpTime
    );
  }).length;

  return {
    summary: {
      liveContacts: clientCount,
      activeStages: stageGroups.length,
      followUpDueCount,
      overdueTaskCount,
      potentialDuplicateCount: duplicatePairs.length,
      missingContactCount,
      missingNextTouchCount,
      viewingLaneCount,
      boundaryReviewCount,
      leaseWatchCount,
    },
    workspaceAnchor: buildClientWorkspaceAnchor({
      followUpDueCount,
      overdueTaskCount,
      missingContactCount,
      missingNextTouchCount,
      viewingLaneCount,
      boundaryReviewCount,
      duplicatePairCount: duplicatePairs.length,
    }),
    stageMetrics: stageGroups
      .slice()
      .sort(
        (left, right) =>
          compareClientStageLabels(left.stage, right.stage) ||
          right._count._all - left._count._all,
      )
      .slice(0, 6)
      .map((group) => ({
        label: group.stage,
        count: group._count._all,
        tone: mapClientStageTone(group.stage),
      })),
    clients: sortedClients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      displayName: getClientDisplayName({
        fullName: client.fullName,
        additionalFields: client.additionalFields,
      }),
      wechatDisplayName: getWechatDisplayName(client.additionalFields),
      stage: client.stage,
      stageTone: mapClientStageTone(client.stage),
      followUpStatus: client.followUpStatus,
      followUpStatusLabel: formatFrontOfficeFollowUpStatusLabel(
        client.followUpStatus,
      ),
      followUpStatusTone: mapFrontOfficeFollowUpStatusTone(
        client.followUpStatus,
      ),
      followUpReminderMode: client.followUpReminderMode,
      followUpReminderModeLabel: formatFrontOfficeReminderModeLabel(
        client.followUpReminderMode,
      ),
      intentLabel: formatClientIntentLabel(client.intent),
      budgetLabel: formatBudgetRange(client.budgetMin, client.budgetMax),
      areasLabel: formatAreaSummaryLabel(
        client.preferredAreas,
        "Areas not captured",
      ),
      sourceLabel: formatSourceLabel(client.source),
      lastTouchLabel: client.lastContactAt
        ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
        : "No contact logged yet",
      nextTouchLabel: formatNextTouchLabel({
        nextFollowUpAt: client.nextFollowUpAt,
        leaseReminderAt: client.leaseReminderAt,
        now,
        timeZone: input.timeZone,
      }),
      lastFollowUpLabel: formatFrontOfficeLastFollowUpLabel(
        client.lastContactAt,
        input.timeZone,
      ),
      nextReminderLabel: formatFrontOfficeNextReminderLabel(
        client.nextFollowUpAt,
        input.timeZone,
      ),
      nextReminderValue: client.nextFollowUpAt
        ? client.nextFollowUpAt.toISOString().slice(0, 10)
        : "",
      noteSummary: buildFrontOfficeNoteSummary(client.notes),
      legacyOpenTaskCount: client.followUpTasks.length,
      href: `/agent/clients/${client.id}`,
    })),
    duplicatePairs,
  };
}
