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
import { DuplicateCandidate, FrontOfficeClientsWorkspaceView, activeListingStatuses, buildCleanupFilterCountRecord, buildCleanupKindCountRecord, buildClientWorkspaceAnchor, buildClientWorkspaceHref, buildElapsedDayCount, buildFreshnessLabel, buildNotificationGroupCountRecord, buildNotificationStreamCountRecord, cleanStringList, compareClientStageLabels, compareFrontOfficeClientQueueRecords, formatAreaSummaryLabel, formatBudgetRange, formatClientIntentLabel, formatCountLabel, formatCurrency, formatDateLabel, formatElapsedDayLabel, formatLooseTitleLabel, formatNextTouchLabel, formatRelativeDueLabel, formatSourceLabel, getClientStageSortRank, isBoundaryStage, isViewingLaneStage, mapClientStageTone, normalizeClientStageLabel, normalizeDuplicateEmail, normalizeDuplicateName, normalizeDuplicatePhone, openFollowUpStatuses, resolveClientNextTouchAt } from "./shared";
import { buildCalendarAppointmentHref, buildClientDetailHref, buildDuplicateCandidateDetailLabel, buildDuplicateCandidateStrengthScore, buildDuplicateRecommendationLabel, buildDuplicateRecord, buildFrontOfficeActivityCleanupFilterContract, buildFrontOfficeActivityNoticeFilterContract, buildFrontOfficeActivityNoticeStreamFilterContract, buildFrontOfficeActivityReadStateFilterContract, buildFrontOfficeDuplicatePairs, buildFrontOfficeResourceHref, buildFrontOfficeResourcesExecutionPulse, buildInitials, buildListingAreaLabel, buildListingSummaryLabel, buildOfficeScopeFilter, buildResourceDetailLabel, buildSendRecordAppointmentLabel, buildVendorCategoryDescription, buildVendorContactLabel, buildVendorCoverageLabel, buildVendorHeadline, buildVendorPrimaryActionLabel, buildVendorPrimaryHref, buildVendorQuickActionLabel, buildVisibleContactScopeWhere, buildVisibleEventWhere, countVendorQuickActions, formatAppointmentStatusLabel, formatAppointmentTypeLabel, formatEventVisibilityLabel, formatFrontOfficeSendChannelLabel, formatListingStatus, formatNotificationType, formatResourceType, formatSendRecordStageLabel, formatUserRoleLabel, formatVendorCategoryLabel, frontOfficeClientSectionAnchors, getFrontOfficeCleanupSectionLabel, getFrontOfficeClientsSnapshot, getFrontOfficeNotificationActionLabel, getFrontOfficeNotificationGroup, getFrontOfficeNotificationNextStepLabel, getFrontOfficeNotificationOwnerLabel, getFrontOfficeNotificationPressureState, getFrontOfficeNotificationScopeLabel, getFrontOfficeNotificationSectionLabel, getFrontOfficeNotificationSortRank, getFrontOfficeNotificationStream, getFrontOfficeNotificationStreamSortRank, getFrontOfficeToneSortRank, getListingStatusSortRank, getResourceActionLabel, getResourceTypeDescription, getResourceTypeDetailLabel, getResourceTypeLaneLabel, getResourceTypePriority, getResourceTypeStartLabel, getResourceTypeTone, getVendorCategoryPriority, getVisibleFrontOfficeDuplicatePairs, isClosedClientStage, mapAppointmentStatusTone, mapListingStatusTone, mapNotificationSeverityTone, mapVendorCategoryTone, normalizeFrontOfficeResourceType, readNotificationMetadataString } from "./clients";
import { getFrontOfficeListingsSnapshot } from "./listings";
import { getFrontOfficeResourcesSnapshot } from "./resources";

export async function getFrontOfficeActivitySnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeActivitySnapshot> {
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
  const twoDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 2,
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
  const fifteenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 15,
  );
  const thirtyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 30,
  );
  const thirtyDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 30,
  );
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const clientWhere: Prisma.ClientWhereInput = {
    organizationId: input.organizationId,
    ownerMembershipId: input.viewerMembershipId,
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

  const [
    notifications,
    unreadNoticeCount,
    events,
    duplicatePairs,
    dueFollowUpTasks,
    dueFollowUpClients,
    staleClients,
    scheduledAppointments,
    latestSendGroups,
  ] = await Promise.all([
    prisma.notification.findMany({
      where: notificationWhere,
      orderBy: [{ createdAt: "desc" }],
      take: 48,
      select: {
        id: true,
        membershipId: true,
        type: true,
        severity: true,
        metadata: true,
        title: true,
        body: true,
        actionUrl: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
        ...(officeScopeFilter ?? {}),
        readAt: null,
      },
    }),
    prisma.event.findMany({
      where: buildVisibleEventWhere(input, startOfToday, sevenDaysFromNow),
      orderBy: [{ startsAt: "asc" }],
      take: 24,
      select: {
        id: true,
        title: true,
        visibility: true,
        startsAt: true,
        location: true,
        meetingUrl: true,
        rsvps: {
          where: {
            membershipId: input.viewerMembershipId,
          },
          select: {
            status: true,
          },
          take: 1,
        },
        _count: {
          select: {
            rsvps: true,
          },
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
    prisma.followUpTask.findMany({
      where: {
        organizationId: input.organizationId,
        assigneeMemberId: input.viewerMembershipId,
        status: {
          in: [...openFollowUpStatuses],
        },
        dueAt: {
          lt: startOfTomorrow,
        },
        clientId: {
          not: null,
        },
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        dueAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            source: true,
            stage: true,
            lastContactAt: true,
            nextFollowUpAt: true,
            leaseReminderAt: true,
          },
        },
      },
    }),
    prisma.client.findMany({
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
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        fullName: true,
        source: true,
        stage: true,
        lastContactAt: true,
        nextFollowUpAt: true,
        leaseReminderAt: true,
      },
    }),
    prisma.client.findMany({
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
      orderBy: [{ lastContactAt: "asc" }, { createdAt: "asc" }],
      take: 8,
      select: {
        id: true,
        fullName: true,
        source: true,
        stage: true,
        lastContactAt: true,
        createdAt: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        startsAt: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      orderBy: [{ startsAt: "asc" }],
      take: 24,
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        location: true,
        meetingUrl: true,
        metadata: true,
        client: {
          select: {
            id: true,
            fullName: true,
            stage: true,
          },
        },
      },
    }),
    prisma.frontOfficeSendRecord.groupBy({
      by: ["clientId"],
      where: {
        ...sendRecordWhere,
        sentAt: {
          gte: thirtyDaysAgo,
        },
      },
      _max: {
        sentAt: true,
      },
    }),
  ]);

  const latestSendRecordFilters = latestSendGroups.flatMap((group) =>
    group._max.sentAt
      ? [
          {
            clientId: group.clientId,
            sentAt: group._max.sentAt,
          },
        ]
      : [],
  );
  const latestSendRecords =
    latestSendRecordFilters.length > 0
      ? await prisma.frontOfficeSendRecord.findMany({
          where: {
            AND: [sendRecordWhere, { OR: latestSendRecordFilters }],
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
            client: {
              select: {
                id: true,
                fullName: true,
                source: true,
                stage: true,
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

  const upcomingAppointments = scheduledAppointments
    .map((appointment) => ({
      appointment,
      externalWorkflow: getFrontOfficeAppointmentExternalWorkflowState({
        metadata: appointment.metadata,
        timeZone: input.timeZone ?? null,
      }),
    }))
    .filter(({ appointment, externalWorkflow }) => {
      if (appointment.startsAt.getTime() <= twoDaysFromNow.getTime()) {
        return true;
      }

      return (
        externalWorkflow.nextActionAt != null &&
        externalWorkflow.nextActionAt.getTime() <= twoDaysFromNow.getTime()
      );
    })
    .sort((left, right) => {
      const leftSortAt =
        left.externalWorkflow.nextActionAt != null &&
        left.externalWorkflow.nextActionAt.getTime() <
          left.appointment.startsAt.getTime()
          ? left.externalWorkflow.nextActionAt.getTime()
          : left.appointment.startsAt.getTime();
      const rightSortAt =
        right.externalWorkflow.nextActionAt != null &&
        right.externalWorkflow.nextActionAt.getTime() <
          right.appointment.startsAt.getTime()
          ? right.externalWorkflow.nextActionAt.getTime()
          : right.appointment.startsAt.getTime();

      return leftSortAt - rightSortAt;
    })
    .slice(0, 8);

  type CleanupCandidate = FrontOfficeActivityCleanupItem & {
    _priority: number;
    _sortAt: Date;
    _clientId: string | null;
  };

  const dueTaskClientIds = new Set(
    dueFollowUpTasks
      .map((task) => task.client?.id ?? null)
      .filter((clientId): clientId is string => Boolean(clientId)),
  );
  const dueFollowUpClientOnly = dueFollowUpClients
    .filter((client) => !dueTaskClientIds.has(client.id))
    .sort((left, right) => {
      const leftNextTouchAt =
        resolveClientNextTouchAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightNextTouchAt =
        resolveClientNextTouchAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;

      if (leftNextTouchAt !== rightNextTouchAt) {
        return leftNextTouchAt - rightNextTouchAt;
      }

      return (
        compareClientStageLabels(left.stage, right.stage) ||
        left.fullName.localeCompare(right.fullName)
      );
    });
  const appointmentSoonCount = upcomingAppointments.length;

  const appointmentItems: CleanupCandidate[] = upcomingAppointments.map(
    ({ appointment, externalWorkflow }) => {
      const startsAtTime = appointment.startsAt.getTime();
      const nextActionTime = externalWorkflow.nextActionAt?.getTime() ?? null;
      const hasExternalDeadline =
        nextActionTime != null && nextActionTime <= twoDaysFromNow.getTime();
      const isExternalDeadlineOverdue =
        nextActionTime != null && nextActionTime < now.getTime();
      const isExternalDeadlineSoon =
        nextActionTime != null &&
        nextActionTime >= now.getTime() &&
        nextActionTime <= now.getTime() + 12 * 60 * 60 * 1000;
      let tone: FrontOfficeTone =
        startsAtTime <= now.getTime() + 2 * 60 * 60 * 1000
          ? "danger"
          : startsAtTime < startOfTomorrow.getTime()
            ? "warning"
            : "accent";
      let priority = tone === "danger" ? 1 : tone === "warning" ? 3 : 7;
      let kindLabel = "Appointment soon";

      if (
        externalWorkflow.value ===
        frontOfficeAppointmentExternalWorkflowStatuses.rescheduleRequested
      ) {
        tone = "danger";
        priority = 0;
        kindLabel = "Reschedule requested";
      } else if (
        externalWorkflow.value ===
        frontOfficeAppointmentExternalWorkflowStatuses.needsFollowUp
      ) {
        tone =
          isExternalDeadlineOverdue ||
          startsAtTime <= now.getTime() + 6 * 60 * 60 * 1000
            ? "danger"
            : hasExternalDeadline
              ? "warning"
              : tone;
        priority = tone === "danger" ? 1 : hasExternalDeadline ? 2 : priority;
        kindLabel =
          isExternalDeadlineOverdue || isExternalDeadlineSoon
            ? "External touch due"
            : "Appointment follow-up";
      } else if (
        externalWorkflow.value ===
          frontOfficeAppointmentExternalWorkflowStatuses.confirmationPending &&
        (startsAtTime < startOfTomorrow.getTime() || hasExternalDeadline)
      ) {
        tone = isExternalDeadlineOverdue ? "danger" : "warning";
        priority = isExternalDeadlineOverdue ? 1 : 3;
        kindLabel =
          isExternalDeadlineOverdue || isExternalDeadlineSoon
            ? "Confirmation due"
            : "Awaiting confirmation";
      }
      const scopeKey =
        kindLabel === "Appointment soon"
          ? ("meeting_countdown" as const)
          : ("calendar_writeback" as const);
      const scopeLabel =
        scopeKey === "meeting_countdown"
          ? "Meeting countdown"
          : "Calendar update";
      const pressureKey =
        kindLabel === "Reschedule requested"
          ? ("reschedule_requested" as const)
          : kindLabel === "Confirmation due" ||
              kindLabel === "Awaiting confirmation"
            ? isExternalDeadlineOverdue
              ? ("confirmation_overdue" as const)
              : ("confirmation_due" as const)
            : kindLabel === "External touch due" ||
                kindLabel === "Appointment follow-up"
              ? isExternalDeadlineOverdue
                ? ("touch_overdue" as const)
                : ("touch_due" as const)
              : tone === "danger"
                ? ("starts_within_2h" as const)
                : tone === "warning"
                  ? ("starts_today" as const)
                  : ("coming_up" as const);
      const pressureLabel =
        pressureKey === "reschedule_requested"
          ? "Reschedule requested"
          : pressureKey === "confirmation_overdue"
            ? "Confirmation overdue"
            : pressureKey === "confirmation_due"
              ? "Confirmation due"
              : pressureKey === "touch_overdue"
                ? "Touch overdue"
                : pressureKey === "touch_due"
                  ? "Touch due"
                  : pressureKey === "starts_within_2h"
                    ? "Starts within 2h"
                    : pressureKey === "starts_today"
                      ? "Starts today"
                      : "Coming up";

      return {
        id: `appointment-${appointment.id}`,
        kindKey: "appointment_writeback",
        kindLabel,
        tone,
        title: appointment.client?.fullName || appointment.title,
        description: [
          appointment.title,
          formatAppointmentTypeLabel(appointment.type),
          formatDateTimeLabel(appointment.startsAt, {
            timeZone: input.timeZone ?? null,
          }),
        ]
          .filter(Boolean)
          .join(" · "),
        ownerKey: "assigned_to_viewer",
        ownerLabel: "Assigned to you",
        scopeKey,
        scopeLabel,
        sectionLabel: getFrontOfficeCleanupSectionLabel({
          kindKey: "appointment_writeback",
          scopeKey,
        }),
        pressureKey,
        pressureLabel,
        metaLabels: [
          appointment.client?.stage?.trim()
            ? `Stage · ${appointment.client.stage.trim()}`
            : "No client linked",
          externalWorkflow.label,
          hasExternalDeadline
            ? `Next touch · ${externalWorkflow.nextActionAtLabel}`
            : "No next touch scheduled",
          appointment.location?.trim() ||
            appointment.meetingUrl?.trim() ||
            "Location pending",
        ],
        whyNowLabel:
          kindLabel === "Reschedule requested"
            ? "The client already asked to reschedule, so the saved update is louder than the appointment start."
            : kindLabel === "Confirmation due" ||
                kindLabel === "Awaiting confirmation"
              ? "The appointment is approaching without an explicit client confirmation in place."
              : kindLabel === "External touch due" ||
                  kindLabel === "Appointment follow-up"
                ? "The next promised external touch is due before this appointment can safely stay on track."
                : "The meeting start itself is now the highest-pressure calendar commitment for this client.",
        sortLabel:
          nextActionTime != null && nextActionTime < startsAtTime
            ? `Next touch · ${externalWorkflow.nextActionAtLabel}`
            : `Starts · ${formatDateTimeLabel(appointment.startsAt, {
                timeZone: input.timeZone ?? null,
              })}`,
        href:
          appointment.client?.id && kindLabel !== "Appointment soon"
            ? buildClientDetailHref(
                appointment.client.id,
                frontOfficeClientSectionAnchors.appointmentsFollowUp,
              )
            : buildCalendarAppointmentHref({
                appointmentId: appointment.id,
                clientId: appointment.client?.id ?? null,
              }),
        actionLabel:
          kindLabel === "Appointment soon"
            ? "Open calendar item"
            : appointment.client?.id
              ? "Open appointment updates"
              : "Open calendar update",
        nextStepLabel:
          kindLabel === "Appointment soon"
            ? "Open the calendar page and keep the meeting on track."
            : appointment.client?.id
              ? "Open the appointments section with client context and record the next touch."
              : "Open the calendar update form and record the next touch.",
        _priority: priority,
        _sortAt:
          nextActionTime != null && nextActionTime < startsAtTime
            ? (externalWorkflow.nextActionAt ?? appointment.startsAt)
            : appointment.startsAt,
        _clientId: appointment.client?.id ?? null,
      };
    },
  );
  const dueTaskItems: CleanupCandidate[] = dueFollowUpTasks.flatMap((task) => {
    if (!task.client || !task.dueAt) {
      return [];
    }

    const isOverdue = task.dueAt.getTime() < startOfToday.getTime();

    return [
      {
        id: `follow-up-task-${task.id}`,
        kindKey: "follow_up",
        kindLabel: "Follow-up task",
        tone: isOverdue ? "danger" : "warning",
        title: task.client.fullName,
        description: [
          task.title.trim() || "Scheduled follow-up",
          task.client.stage.trim() || "Stage not captured",
          formatRelativeDueLabel(task.dueAt, now, input.timeZone),
        ]
          .filter(Boolean)
          .join(" · "),
        ownerKey: "assigned_to_viewer",
        ownerLabel: "Assigned to you",
        scopeKey: "follow_up_task",
        scopeLabel: "Client follow-up task",
        sectionLabel: getFrontOfficeCleanupSectionLabel({
          kindKey: "follow_up",
          scopeKey: "follow_up_task",
        }),
        pressureKey: isOverdue ? "overdue" : "due_today",
        pressureLabel: isOverdue ? "Overdue" : "Due today",
        metaLabels: [
          task.client.source?.trim() || "Source not captured",
          task.client.lastContactAt
            ? `Last contact · ${formatDateLabel(
                task.client.lastContactAt,
                input.timeZone,
              )}`
            : "No contact logged yet",
        ],
        whyNowLabel: isOverdue
          ? "The scheduled follow-up task is already overdue."
          : "This follow-up task lands in today's working set.",
        sortLabel: `Due · ${formatDateLabel(task.dueAt, input.timeZone)}`,
        href: buildClientDetailHref(
          task.client.id,
          frontOfficeClientSectionAnchors.appointmentsFollowUp,
        ),
        actionLabel: "Open follow-up section",
        nextStepLabel:
          "Open the follow-up section and resolve the overdue task.",
        _priority: isOverdue ? 0 : 2,
        _sortAt: task.dueAt,
        _clientId: task.client.id,
      },
    ];
  });
  const dueClientItems: CleanupCandidate[] = dueFollowUpClientOnly.map(
    (client) => {
      const nextTouchAt = resolveClientNextTouchAt(client) ?? now;
      const isOverdue = nextTouchAt.getTime() < startOfToday.getTime();

      return {
        id: `follow-up-client-${client.id}`,
        kindKey: "follow_up",
        kindLabel: "Follow-up due",
        tone: isOverdue ? "danger" : "warning",
        title: client.fullName,
        description: [
          client.stage.trim() || "Stage not captured",
          formatNextTouchLabel({
            nextFollowUpAt: client.nextFollowUpAt,
            leaseReminderAt: client.leaseReminderAt,
            now,
            timeZone: input.timeZone,
          }),
        ]
          .filter(Boolean)
          .join(" · "),
        ownerKey: "assigned_to_viewer",
        ownerLabel: "Assigned to you",
        scopeKey: "client_next_touch",
        scopeLabel: "Client next touch",
        sectionLabel: getFrontOfficeCleanupSectionLabel({
          kindKey: "follow_up",
          scopeKey: "client_next_touch",
        }),
        pressureKey: isOverdue ? "overdue" : "due_today",
        pressureLabel: isOverdue ? "Overdue" : "Due today",
        metaLabels: [
          client.source?.trim() || "Source not captured",
          client.lastContactAt
            ? `Last contact · ${formatDateLabel(
                client.lastContactAt,
                input.timeZone,
              )}`
            : "No contact logged yet",
        ],
        whyNowLabel: isOverdue
          ? "The next planned follow-up date has already slipped."
          : "This client's next touch is due today and should stay in the active pass.",
        sortLabel: `Next touch · ${formatDateLabel(nextTouchAt, input.timeZone)}`,
        href: buildClientDetailHref(
          client.id,
          frontOfficeClientSectionAnchors.appointmentsFollowUp,
        ),
        actionLabel: "Open next-touch section",
        nextStepLabel: "Open the follow-up section and choose the next touch.",
        _priority: isOverdue ? 0 : 2,
        _sortAt: nextTouchAt,
        _clientId: client.id,
      };
    },
  );
  const sendRiskItems: CleanupCandidate[] = latestSendRecords
    .filter((record) => !isClosedClientStage(record.client.stage))
    .flatMap<CleanupCandidate>((record) => {
      if (record.openCount <= 0) {
        if (record.sentAt.getTime() > threeDaysAgo.getTime()) {
          return [];
        }

        const daysSinceSend = buildElapsedDayCount(record.sentAt, now, 3);

        return [
          {
            id: `send-risk-${record.id}`,
            kindKey: "send_risk",
            kindLabel: "Send risk",
            tone: "danger",
            title: record.client.fullName,
            description: [
              record.listing?.title?.trim() || "Tracked Front Office send",
              formatSendRecordStageLabel(
                record.clientStageLabel || record.client.stage,
              ),
              buildSendRecordAppointmentLabel({
                title: record.appointmentTitle,
                startsAt: record.appointmentStartsAt,
                timeZone: input.timeZone,
              }),
              `No tracked open after ${formatElapsedDayLabel(daysSinceSend)}.`,
            ]
              .filter(Boolean)
              .join(" · "),
            ownerKey: "assigned_to_viewer",
            ownerLabel: "Assigned to you",
            scopeKey: "tracked_send_rescue",
            scopeLabel: "Tracked send rescue",
            sectionLabel: getFrontOfficeCleanupSectionLabel({
              kindKey: "send_risk",
              scopeKey: "tracked_send_rescue",
            }),
            pressureKey: "send_unopened_3_days",
            pressureLabel: "Unopened 3+ days",
            metaLabels: [
              `Channel · ${formatFrontOfficeSendChannelLabel(record.channel)}`,
              record.client.source?.trim() || "Source not captured",
            ],
            whyNowLabel:
              "The tracked send is still unopened after the initial wait window.",
            sortLabel: `Sent · ${formatDateLabel(record.sentAt, input.timeZone)}`,
            href: buildClientDetailHref(
              record.client.id,
              frontOfficeClientSectionAnchors.listingOutput,
            ),
            actionLabel: "Open listing follow-up",
            nextStepLabel:
              "Open the listing follow-up section and decide whether to rescue the send.",
            _priority: 4,
            _sortAt: record.sentAt,
            _clientId: record.client.id,
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
          id: `send-risk-${record.id}`,
          kindKey: "send_risk",
          kindLabel: "Send risk",
          tone: "warning",
          title: record.client.fullName,
          description: [
            record.listing?.title?.trim() || "Tracked Front Office send",
            formatSendRecordStageLabel(
              record.clientStageLabel || record.client.stage,
            ),
            buildSendRecordAppointmentLabel({
              title: record.appointmentTitle,
              startsAt: record.appointmentStartsAt,
              timeZone: input.timeZone,
            }),
            `Quiet for ${formatElapsedDayLabel(
              quietDays,
            )} since the last tracked open.`,
          ]
            .filter(Boolean)
            .join(" · "),
          ownerKey: "assigned_to_viewer",
          ownerLabel: "Assigned to you",
          scopeKey: "tracked_send_rescue",
          scopeLabel: "Tracked send rescue",
          sectionLabel: getFrontOfficeCleanupSectionLabel({
            kindKey: "send_risk",
            scopeKey: "tracked_send_rescue",
          }),
          pressureKey: "send_quiet_after_open",
          pressureLabel: "Quiet after last open",
          metaLabels: [
            `Channel · ${formatFrontOfficeSendChannelLabel(record.channel)}`,
            record.client.source?.trim() || "Source not captured",
          ],
          whyNowLabel:
            "The last tracked open has gone quiet long enough to warrant a fresh follow-up pass.",
          sortLabel: `Last open · ${formatDateLabel(
            lastEngagementAt,
            input.timeZone,
          )}`,
          href: buildClientDetailHref(
            record.client.id,
            frontOfficeClientSectionAnchors.listingOutput,
          ),
          actionLabel: "Open listing follow-up",
          nextStepLabel:
            "Open the listing follow-up section and decide whether to rescue the send.",
          _priority: 5,
          _sortAt: lastEngagementAt,
          _clientId: record.client.id,
        },
      ];
    });
  const staleClientItems: CleanupCandidate[] = staleClients.map((client) => {
    const staleSince = client.lastContactAt ?? client.createdAt;
    const staleDays = buildElapsedDayCount(staleSince, now, 15);
    const tone: FrontOfficeTone = staleDays >= 30 ? "danger" : "warning";

    return {
      id: `stale-client-${client.id}`,
      kindKey: "stale_client",
      kindLabel: "Stale client",
      tone,
      title: client.fullName,
      description: [
        client.stage.trim() || "Stage not captured",
        `${formatElapsedDayLabel(staleDays)} since ${
          client.lastContactAt ? "last touch" : "record create"
        }.`,
      ]
        .filter(Boolean)
        .join(" · "),
      ownerKey: "assigned_to_viewer",
      ownerLabel: "Assigned to you",
      scopeKey: "client_freshness",
      scopeLabel: "Client freshness",
      sectionLabel: getFrontOfficeCleanupSectionLabel({
        kindKey: "stale_client",
        scopeKey: "client_freshness",
      }),
      pressureKey: tone === "danger" ? "stale_30_days" : "stale_15_days",
      pressureLabel: tone === "danger" ? "30+ days stale" : "15+ days stale",
      metaLabels: [
        client.source?.trim() || "Source not captured",
        client.lastContactAt
          ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
          : `Created · ${formatDateLabel(client.createdAt, input.timeZone)}`,
      ],
      whyNowLabel: `No logged touch has landed on this client record for ${formatElapsedDayLabel(
        staleDays,
      )}.`,
      sortLabel: client.lastContactAt
        ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
        : `Created · ${formatDateLabel(client.createdAt, input.timeZone)}`,
      href: buildClientDetailHref(
        client.id,
        frontOfficeClientSectionAnchors.nextStepRail,
      ),
      actionLabel: "Open recovery section",
      nextStepLabel:
        "Open the next-step section and plan the next recovery touch.",
      _priority: tone === "danger" ? 6 : 7,
      _sortAt: staleSince,
      _clientId: client.id,
    };
  });

  const cleanupCandidates = [
    ...dueTaskItems,
    ...dueClientItems,
    ...appointmentItems,
    ...sendRiskItems,
    ...staleClientItems,
  ].sort(
    (left, right) =>
      left._priority - right._priority ||
      left._sortAt.getTime() - right._sortAt.getTime(),
  );
  const seenCleanupClientIds = new Set<string>();
  const cleanupItems: FrontOfficeActivityCleanupItem[] = [];

  for (const item of cleanupCandidates) {
    if (item._clientId && seenCleanupClientIds.has(item._clientId)) {
      continue;
    }

    cleanupItems.push({
      id: item.id,
      kindKey: item.kindKey,
      kindLabel: item.kindLabel,
      tone: item.tone,
      title: item.title,
      description: item.description,
      ownerKey: item.ownerKey,
      ownerLabel: item.ownerLabel,
      scopeKey: item.scopeKey,
      scopeLabel: item.scopeLabel,
      sectionLabel: item.sectionLabel,
      pressureKey: item.pressureKey,
      pressureLabel: item.pressureLabel,
      whyNowLabel: item.whyNowLabel,
      sortLabel: item.sortLabel,
      metaLabels: item.metaLabels,
      href: item.href,
      actionLabel: item.actionLabel,
      nextStepLabel: item.nextStepLabel,
    });

    if (item._clientId) {
      seenCleanupClientIds.add(item._clientId);
    }

    if (cleanupItems.length >= 12) {
      break;
    }
  }

  const followUpMetricCount = dueTaskItems.length + dueClientItems.length;
  const sendRiskMetricCount = sendRiskItems.length;
  const staleMetricCount = staleClientItems.length;
  const hasUrgentFollowUpPressure =
    dueTaskItems.some((item) => item.tone === "danger") ||
    dueClientItems.some((item) => item.tone === "danger");
  const totalCleanupByKind = buildCleanupKindCountRecord();
  totalCleanupByKind.follow_up = followUpMetricCount;
  totalCleanupByKind.appointment_writeback = appointmentSoonCount;
  totalCleanupByKind.send_risk = sendRiskMetricCount;
  totalCleanupByKind.stale_client = staleMetricCount;
  const visibleCleanupByKind = buildCleanupKindCountRecord();

  for (const item of cleanupItems) {
    visibleCleanupByKind[item.kindKey] += 1;
  }

  const cleanupItemCount = cleanupItems.length + duplicatePairs.length;
  const urgentCleanupCount = cleanupItems.filter(
    (item) => item.tone === "danger",
  ).length;
  const totalCleanupPressureCount =
    totalCleanupByKind.follow_up +
    totalCleanupByKind.appointment_writeback +
    totalCleanupByKind.send_risk +
    totalCleanupByKind.stale_client +
    duplicatePairs.length;
  const visibleCleanupByFilter = buildCleanupFilterCountRecord();
  visibleCleanupByFilter.all = cleanupItemCount;
  visibleCleanupByFilter.follow_up = visibleCleanupByKind.follow_up;
  visibleCleanupByFilter.appointment_writeback =
    visibleCleanupByKind.appointment_writeback;
  visibleCleanupByFilter.send_risk = visibleCleanupByKind.send_risk;
  visibleCleanupByFilter.stale_client = visibleCleanupByKind.stale_client;
  visibleCleanupByFilter.duplicate_review = duplicatePairs.length;
  const cleanupMetrics: FrontOfficeActivityCleanupMetric[] = [
    {
      key: "follow_up",
      label: "Follow-up due",
      count: followUpMetricCount,
      visibleCount: visibleCleanupByKind.follow_up,
      countMode: "raw_pressure",
      tone: hasUrgentFollowUpPressure
        ? "danger"
        : followUpMetricCount > 0
          ? "warning"
          : "neutral",
      helper:
        "Scheduled follow-up work that should be touched today or is already overdue.",
    },
    {
      key: "appointment_writeback",
      label: "Appointment cleanup",
      count: appointmentSoonCount,
      visibleCount: visibleCleanupByKind.appointment_writeback,
      countMode: "raw_pressure",
      tone: appointmentItems.some((item) => item.tone === "danger")
        ? "danger"
        : appointmentSoonCount > 0
          ? "warning"
          : "neutral",
      helper:
        "Calendar-owned meetings and promised external touches in the next two days that still need direct Front Office follow-through.",
    },
    {
      key: "send_risk",
      label: "Send risk",
      count: sendRiskMetricCount,
      visibleCount: visibleCleanupByKind.send_risk,
      countMode: "raw_pressure",
      tone: sendRiskItems.some((item) => item.tone === "danger")
        ? "danger"
        : sendRiskMetricCount > 0
          ? "warning"
          : "neutral",
      helper:
        "Tracked sends with no open after three days or no recent engagement after the last open.",
    },
    {
      key: "stale_client",
      label: "Stale clients",
      count: staleMetricCount,
      visibleCount: visibleCleanupByKind.stale_client,
      countMode: "raw_pressure",
      tone: staleMetricCount > 0 ? "danger" : "neutral",
      helper:
        "Active client records that have gone 15+ days without a logged contact touch.",
    },
    {
      key: "duplicate_review",
      label: "Potential dupes",
      count: duplicatePairs.length,
      visibleCount: duplicatePairs.length,
      countMode: "surfaced_items",
      tone: duplicatePairs.length > 0 ? "accent" : "neutral",
      helper:
        "Visible-scope duplicate review pairs that should be merged before the next touch.",
    },
  ];
  const notificationCards = notifications
    .map((notification) => {
      const group = getFrontOfficeNotificationGroup({
        type: notification.type,
        metadata: notification.metadata,
      });
      const stream = getFrontOfficeNotificationStream({
        actionUrl: notification.actionUrl?.trim() || null,
        membershipId: notification.membershipId,
        groupKey: group.groupKey,
      });
      const owner = getFrontOfficeNotificationOwnerLabel(
        notification.membershipId != null,
      );
      const scope = getFrontOfficeNotificationScopeLabel({
        groupKey: group.groupKey,
        streamKey: stream.streamKey,
        streamLabel: stream.streamLabel,
      });
      const readStateMutable = notification.membershipId != null;
      const isUnread = readStateMutable && notification.readAt == null;
      const pressureTone = mapNotificationSeverityTone(notification.severity);
      const pressureState = getFrontOfficeNotificationPressureState({
        groupKey: group.groupKey,
        notificationTone: pressureTone,
        readStateMutable,
        isUnread,
      });

      return {
        card: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          typeLabel: formatNotificationType(notification.type),
          groupKey: group.groupKey,
          groupLabel: group.groupLabel,
          streamKey: stream.streamKey,
          streamLabel: stream.streamLabel,
          audienceLabel: readStateMutable
            ? "Personal notice"
            : "Shared office notice",
          ownerKey: owner.ownerKey,
          ownerLabel: owner.ownerLabel,
          scopeKey: scope.scopeKey,
          scopeLabel: scope.scopeLabel,
          sectionLabel: getFrontOfficeNotificationSectionLabel({
            groupKey: group.groupKey,
            streamKey: stream.streamKey,
            streamLabel: stream.streamLabel,
          }),
          pressureKey: pressureState.key,
          pressureLabel: pressureState.label,
          pressureTone: pressureState.tone,
          whyNowLabel: pressureState.whyNowLabel,
          tone:
            notification.type === NotificationType.appointment_due_soon
              ? "accent"
              : mapNotificationSeverityTone(notification.severity),
          createdAtLabel: formatDateTimeLabel(notification.createdAt, {
            timeZone: input.timeZone ?? null,
          }),
          actionLabel: getFrontOfficeNotificationActionLabel({
            type: notification.type,
            actionUrl: notification.actionUrl?.trim() || null,
            groupKey: group.groupKey,
            streamKey: stream.streamKey,
          }),
          nextStepLabel: getFrontOfficeNotificationNextStepLabel({
            type: notification.type,
            groupKey: group.groupKey,
            streamKey: stream.streamKey,
          }),
          href: `/agent/notifications/${notification.id}/open`,
          isUnread,
          readStateLabel: !readStateMutable
            ? "Shared notice"
            : notification.readAt == null
              ? "Unread"
              : "Read",
          readStateMutable,
        } satisfies FrontOfficeActivityNotificationRecord,
        sortRank: getFrontOfficeNotificationSortRank({
          groupKey: group.groupKey,
          pressureTone: pressureState.tone,
          streamKey: stream.streamKey,
          readStateMutable,
          isUnread,
        }),
        createdAt: notification.createdAt.getTime(),
      };
    })
    .sort(
      (left, right) =>
        left.sortRank - right.sortRank ||
        right.createdAt - left.createdAt ||
        left.card.title.localeCompare(right.card.title),
    )
    .slice(0, 24)
    .map((entry) => entry.card);
  const notificationGroupCounts = buildNotificationGroupCountRecord();
  const notificationStreamCounts = buildNotificationStreamCountRecord();
  let personalVisibleNoticeCount = 0;
  let sharedVisibleNoticeCount = 0;
  let unreadPersonalVisibleNoticeCount = 0;

  for (const card of notificationCards) {
    notificationGroupCounts[card.groupKey] += 1;

    if (card.groupKey === "general_notice") {
      notificationStreamCounts[card.streamKey] += 1;
    }

    if (card.readStateMutable) {
      personalVisibleNoticeCount += 1;

      if (card.isUnread) {
        unreadPersonalVisibleNoticeCount += 1;
      }
    } else {
      sharedVisibleNoticeCount += 1;
    }
  }

  const counts: FrontOfficeActivityCounts = {
    notifications: {
      visibleCount: notificationCards.length,
      personalVisibleCount: personalVisibleNoticeCount,
      mutableVisibleCount: personalVisibleNoticeCount,
      sharedVisibleCount: sharedVisibleNoticeCount,
      unreadPersonalVisibleCount: unreadPersonalVisibleNoticeCount,
      unreadPersonalTotalCount: unreadNoticeCount,
      appointmentReminderVisibleCount:
        notificationCards.length - notificationGroupCounts.general_notice,
      generalNoticeVisibleCount: notificationGroupCounts.general_notice,
      byGroup: notificationGroupCounts,
      generalByStream: notificationStreamCounts,
    },
    cleanup: {
      surfacedCount: cleanupItemCount,
      surfacedItemCount: cleanupItems.length,
      duplicateReviewCount: duplicatePairs.length,
      urgentSurfacedCount: urgentCleanupCount,
      totalPressureCount: totalCleanupPressureCount,
      visibleByKind: visibleCleanupByKind,
      totalByKind: totalCleanupByKind,
      visibleByFilter: visibleCleanupByFilter,
    },
    events: {
      visibleCount: events.length,
    },
  };

  return {
    summary: {
      actionableItemCount:
        counts.notifications.visibleCount + counts.cleanup.surfacedCount,
      upcomingEventCount: counts.events.visibleCount,
      unreadNoticeCount,
      cleanupItemCount: counts.cleanup.surfacedCount,
      duplicateReviewCount: counts.cleanup.duplicateReviewCount,
      appointmentSoonCount: counts.cleanup.totalByKind.appointment_writeback,
      sharedNoticeCount: counts.notifications.sharedVisibleCount,
      urgentCleanupCount: counts.cleanup.urgentSurfacedCount,
    },
    counts,
    filters: {
      cleanup: buildFrontOfficeActivityCleanupFilterContract(counts.cleanup),
      notices: buildFrontOfficeActivityNoticeFilterContract(
        counts.notifications,
      ),
      noticeLanes: buildFrontOfficeActivityNoticeStreamFilterContract(
        counts.notifications,
      ),
      readState: buildFrontOfficeActivityReadStateFilterContract(
        counts.notifications,
      ),
    },
    notifications: notificationCards,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      typeLabel: event.meetingUrl?.trim() ? "Meeting" : "Event",
      visibilityLabel: formatEventVisibilityLabel(event.visibility),
      locationLabel:
        event.location?.trim() ||
        event.meetingUrl?.trim() ||
        "Location pending",
      startsAtLabel: formatDateTimeLabel(event.startsAt, {
        timeZone: input.timeZone ?? null,
      }),
      rsvpLabel:
        event.rsvps[0]?.status === "going"
          ? "You RSVP'd going"
          : event.rsvps[0]?.status === "maybe"
            ? "You RSVP'd maybe"
            : event.rsvps[0]?.status === "declined"
              ? "You declined"
              : formatCountLabel(event._count.rsvps, "RSVP"),
      href: `/agent/calendar?calendarView=month&focusDate=${encodeURIComponent(
        event.startsAt.toISOString().slice(0, 10),
      )}&eventId=${encodeURIComponent(event.id)}`,
    })),
    cleanup: {
      metrics: cleanupMetrics,
      items: cleanupItems,
      duplicatePairs,
    },
  };
}
