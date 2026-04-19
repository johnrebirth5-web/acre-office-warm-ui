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
import {
  getFrontOfficeClientDetailRecord,
  getFrontOfficeClientEngagementSnapshot,
  getFrontOfficeTaskSummary,
  getUpcomingScheduledAppointment,
} from "./detail-query";
import { FRONT_OFFICE_FOLLOW_UP_FORM_ID, FRONT_OFFICE_FOLLOW_UP_QUEUE_ID, FrontOfficeCalendarView, FrontOfficeListingsLane, buildClientAction, buildClientRouteHref, buildFrontOfficeCalendarHref, buildFrontOfficeListingsHref, buildFrontOfficeSendEngagementLabel, buildLeaseReminderSnapshot, buildPlaybookItem, buildPlaybookObjection, buildPlaybookTemplate, buildSendRecordAppointmentLabel, buildTaskHelperLabel, buildTaskQueueLabel, buildTaskTimelineContext, buildTaskTimelineDescription, buildTaskTimelineTitle, formatAppointmentStatusLabel, formatAppointmentTypeLabel, formatBudgetRange, formatCalendarDistanceLabel, formatCurrency, formatDateLabel, formatDateTimeValue, formatDateValue, formatFrontOfficeSendChannelLabel, formatRelativeDueLabel, formatSendRecordStageLabel, formatTaskDueLabel, formatTaskStatusLabel, frontOfficeCalendarViews, frontOfficeListingsLanes, getCalendarDayDifference, getClientFirstName, hasMeaningfulAreasLabel, hasMeaningfulBudgetLabel, hasMeaningfulIntentLabel, mapAppointmentStatusTone, mapAppointmentTypeTone, mapBridgeActivityState, mapClientStageTone, mapFrontOfficeSendEngagementTone, mapSendEngagementKey, mapTaskTone, pickEarliestDate, resolveFrontOfficeCalendarView, resolveFrontOfficeListingsLane, resolveNextStepRailCalendarView } from "./workflow";
import { buildFrontOfficeAiSuggestions, buildFrontOfficePlaybook } from "./playbook";
import { buildClientPdfHref, buildDossierContract, buildFollowUpCue, buildFrontOfficeClientDetailWorkbenchReturn, buildFrontOfficeFollowUpAction, buildNextStepRail, buildOfferWorkspaceHref, buildTransactionContextMetaLabel, buildTransactionLocationLabel, buildTransactionWorkspaceHref, buildWorkflowSignal, formatHandoffStatusLabel, formatIncomingUpdateStatusLabel, formatSignatureRequestStatusLabel, formatTransactionStatusLabel, formatTransactionTaskStatusLabel, getDayDifferenceFromToday, getFrontOfficeClientDetailWorkbenchDescription, getFrontOfficeClientDetailWorkbenchHref, getFrontOfficeClientDetailWorkbenchLabel, mapHandoffTone, mapIncomingUpdateTone, mapOfferStatusTone, mapSignatureRequestTone, mapTransactionTaskTone } from "./dossier";

export async function getFrontOfficeClientDetail(
  input: GetFrontOfficeClientDetailInput,
): Promise<FrontOfficeClientDetailSnapshot | null> {
  const now = new Date();
  const ninetyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 90,
  );
  const client = await getFrontOfficeClientDetailRecord(input, now);

  if (!client) {
    return null;
  }

  const { sendCount, openedSendCount, sendAggregate } =
    await getFrontOfficeClientEngagementSnapshot(input, client.id);
  const appointmentBridgeStatusMap =
    await getFrontOfficeAppointmentBridgeStatusMap({
      organizationId: input.organizationId,
      appointmentIds: client.appointments.map((appointment) => appointment.id),
      timeZone: input.timeZone,
    });

  const {
    openTaskCount,
    completedTaskCount,
    overdueTaskCount,
    hasOverdueTask,
  } = getFrontOfficeTaskSummary(client.followUpTasks, now);
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
    ? "Back Office live"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Ready for Back Office"
      : "Front Office prep";
  const negotiationBoundaryTone: FrontOfficeClientDetailTone =
    negotiationTransactionId
      ? "success"
      : isFrontOfficeStageReadyForBackOffice(client.stage)
        ? "warning"
        : "accent";
  const negotiationPrimaryActionLabel = negotiationTransactionId
    ? negotiationOfferCount > 0
      ? "Open Back Office offers"
      : "Start Back Office offer tracking"
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
    ? "The formal offer file is the source of truth"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "The next formal offer file should open in Back Office"
      : "Keep offer prep in Front Office until the file is ready";
  const negotiationBoundaryDescription = negotiationTransactionId
    ? negotiationOfferCount > 0
      ? `${negotiationOfferCount} offer record(s) already exist in the shared Back Office record, so comparison, documents, and signatures stay anchored there. Front Office should stay client-facing, keep the recap aligned, and point back to that file.`
      : "The formal transaction record is live. Start structured offer tracking from the shared Back Office offers record instead of creating a second Front Office record, and use this client page as the return point."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Stage, appointments, send history, and handoff context are already lined up. The next formal offer record should open in Back Office, while Front Office keeps the coaching, client-ready explanation, and return point together."
      : "Use appointment feedback, send context, and follow-up to sharpen pricing, timing, and decision-maker clarity before the formal Back Office offer workflow opens and the client page becomes the recap anchor.";
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
  const negotiationNextMoveLabel = negotiationTransactionId
    ? negotiationOfferCount > 0
      ? "Open the linked Back Office offer file"
      : "Start the formal Back Office offer file"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Move the offer into Back Office now"
      : "Keep shaping the offer in Front Office";
  const negotiationNextMoveDescription = negotiationTransactionId
    ? negotiationOfferCount > 0
      ? "Price, contingencies, signatures, and expiration control belong in the shared Back Office record now. Front Office should stay client-facing, keep the return point visible, and point back to that file."
      : "The file is already Back Office-ready, so the first formal step should be a Back Office offer record instead of a duplicate note, with this client page remaining the client-facing return."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "The client is ready for formal tracking, so open the shared offer record before the terms drift or get duplicated, and keep the client-ready summary consistent."
      : "Use coaching, recap, and decision support here until the client's terms are ready for formal Back Office tracking and the client page can hand off cleanly.";
  const negotiationOperatorLabel = negotiationTransactionId
    ? "Front Office coaches; Back Office owns the formal offer file"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Front Office prepares the handoff; Back Office should open the file"
      : "Front Office owns prep and decision support";
  const negotiationOperatorDescription = negotiationTransactionId
    ? "Keep client conversation, explanation, and comparison work here, but treat the offer itself as a Back Office record and the client page as the client-facing companion."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "This client page should hand the actual offer terms to Back Office instead of creating a second track, while still preserving the client-ready story."
      : "Use this section for response shaping, objections, and readiness checks while the deal is still being clarified and the return point stays in Front Office.";
  const negotiationEmptyStateTitle = negotiationTransactionId
    ? "No formal offers yet"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "No Back Office offer record started yet"
      : "Still in Front Office prep";
  const negotiationEmptyStateDescription = negotiationTransactionId
    ? "Once the first Back Office offer is created, it will appear here with status, price, expiration, and direct links into the shared offer record while the client page remains the client-ready summary."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "This client is at a Back Office-ready stage, but the formal transaction and offer record have not been opened yet, so the client page is still the place to keep the recap coherent."
      : "This client is not yet at a formal negotiation / offer stage, so the next move should stay in Front Office follow-up, showing, and send prep with the same client page as the return point.";
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
      ? "The live contract file owns inspection support"
      : "Formal contract file is live, but acceptance is not locked yet"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "The next formal contract step should start in Back Office"
      : "Inspection support starts after the formal file exists";
  const inspectionBoundaryDescription = negotiationTransactionId
    ? inspectionTransactionRecord?.acceptanceDate
      ? "Use the shared Back Office transaction to drive checklist work, signatures, incoming update review, and client-facing milestone clarity through the inspection window. Front Office stays the explanation layer and the same recap surface, not a duplicate checklist."
      : "The transaction record exists, but Acre does not have an accepted-contract date yet. Finish the offer-to-contract transition in Back Office before treating this as a live inspection file or a separate Front Office tracker."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Negotiation is advanced enough that the next formal contract / inspection step should begin from the shared Back Office record, not as a second Front Office checklist, and the client page should stay the client-facing reference."
      : "Keep the client in Front Office follow-up, showing, and negotiation prep until the formal contract file is opened and the next return point becomes the shared record.";
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
  const inspectionNextMoveLabel = negotiationTransactionId
    ? inspectionOverdueTaskCount > 0
      ? "Clear Back Office tasks first"
      : inspectionPendingSignatureCount > 0
        ? "Open signatures in Back Office"
        : inspectionPendingIncomingUpdateCount > 0
          ? "Review the incoming Back Office updates"
          : "Open the formal contract file"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Open the formal contract file"
      : "Keep inspection support in Front Office only";
  const inspectionNextMoveDescription = negotiationTransactionId
    ? inspectionOverdueTaskCount > 0
      ? "The shared transaction record already has checklist pressure, so clear the live Back Office tasks before anything else and leave the client page as the explanation layer."
      : inspectionPendingSignatureCount > 0
        ? "Signature work now lives in the shared transaction, so the next move is to handle the formal paperwork there and keep the client-ready view in sync."
        : inspectionPendingIncomingUpdateCount > 0
          ? "The contract file is live, and the next actionable signal is the incoming-update queue inside Back Office while the client page keeps the summary visible."
          : "The inspection-era file is live, but there is no immediate pressure, so keep the formal record ready and the client-facing summary visible on the same return point."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "The client is Back Office-ready, so the formal contract file should open before inspection support drifts into a duplicate tracker or a second recap surface."
      : "Use this section only for recap and coordination until a formal contract file exists and the return point can stay consistent.";
  const inspectionOperatorLabel = negotiationTransactionId
    ? "Front Office explains; Back Office owns tasks, signatures, and updates"
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Front Office prepares the handoff; Back Office should own the file"
      : "Front Office keeps the client visible";
  const inspectionOperatorDescription = negotiationTransactionId
    ? "Keep the client-facing explanation on this client page, but let the checklist, signature queue, and incoming review live in Back Office while this page stays the reference view."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "Use this section to prepare the handoff, but do not duplicate the contract workflow in Front Office or break the client-ready recap."
      : "Inspection support stays in Front Office until the formal file opens and the same client page can point back to it.";
  const inspectionPrimaryActionLabel = negotiationTransactionId
    ? inspectionOverdueTaskCount > 0 || inspectionOpenTaskCount > 0
      ? "Open Back Office tasks"
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
      ? "Open tasks, pending signatures, and incoming review items will show up here when the shared transaction record needs action, while the client page keeps the client-facing recap aligned."
      : "Open the formal transaction record to finish acceptance / contract setup. Inspection-era checklist support will become meaningful once the Back Office file is carrying the live milestones and this client page can mirror them."
    : isFrontOfficeStageReadyForBackOffice(client.stage)
      ? "This client is Back Office-ready, but the formal contract record has not been opened yet, so the client-ready view still belongs in Front Office."
      : "Inspection support is intentionally deferred until the client reaches formal contract work and the same return point can stay in sync.";
  const inspectionItems = negotiationTransactionId
    ? [
        ...inspectionTaskRows.map((task) => ({
          id: `task-${task.id}`,
          title: task.title,
          statusLabel: formatTransactionTaskStatusLabel(task.status),
          statusTone: mapTransactionTaskTone(task.status, task.dueAt, now),
          contextLabel: task.checklistGroup?.trim() || "Back Office checklist",
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
          actionLabel: "Open Back Office tasks",
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
          metaLabel:
            request.form?.name?.trim() || "Shared Back Office signature flow",
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
    ? "This file no longer has a live close path"
    : isFreshWin
      ? "The deal just closed and the follow-up window is open"
      : hasClosedTransaction
        ? "The deal is closed and now needs post-close follow-through"
        : isClosingSoon
          ? "The deal is approaching its closing or move-in window"
          : negotiationTransactionId
            ? "The formal Back Office record is already carrying the deal"
            : isFrontOfficeStageReadyForBackOffice(client.stage)
              ? "The file is ready to open the formal Back Office record"
              : "Closing guidance starts after the formal deal exists";
  const closingBoundaryDescription = hasCancelledTransaction
    ? "The formal transaction no longer points to a live close. Use Front Office for respectful re-entry, alternate options, or a future nurture touch instead of pretending a win exists."
    : isFreshWin
      ? "The shared transaction record now proves the win. Front Office should turn that into a same-week check-in, recap, referral ask, or move-in support plan before the momentum cools, and keep the client-ready summary tied to the same file."
      : hasClosedTransaction
        ? "The formal record is already closed. Front Office should keep the client relationship alive through post-close follow-up, referral timing, and future move planning while the recap still points to the same source of truth."
        : isClosingSoon
          ? "The formal file already has a near-term closing or move-in milestone. Front Office should make the wrap-up visible now instead of waiting until the date has already passed, and keep the same return point visible."
          : negotiationTransactionId
            ? "The formal file is active, and Front Office should reference that shared Back Office record for the next move instead of creating a second close-out surface or a second recap."
            : isFrontOfficeStageReadyForBackOffice(client.stage)
              ? "The client is Back Office-ready, but the formal deal-wrap record has not been opened yet. Start there before relying on win-stage guidance and keep the client page as the client-facing version."
              : "This client is not yet in a deal-wrap phase, so closing guidance should stay dormant while follow-up, showing, and negotiation prep continue from the same client page.";
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
  const closingNextMoveLabel = hasCancelledTransaction
    ? "Switch to respectful re-entry"
    : hasClosedTransaction
      ? nextTouchAt
        ? "Keep the post-close touch on the calendar"
        : "Book the post-close touch"
      : isClosingSoon
        ? "Confirm the milestone date and wrap-up touch"
        : negotiationTransactionId
          ? "Keep the formal Back Office record in view"
          : isFrontOfficeStageReadyForBackOffice(client.stage)
            ? "Open the formal Back Office record"
            : "Stay in Front Office prep until the deal exists";
  const closingNextMoveDescription = hasCancelledTransaction
    ? "The formal win path is gone, so the next move should be a respectful re-entry or a future nurture touch instead of a fake close-out."
    : hasClosedTransaction
      ? nextTouchAt
        ? "The deal is already closed, so keep the follow-through visible and use the calendar touch to protect the relationship."
        : "The win is already in the record, so book the first post-close touch before the momentum cools."
      : isClosingSoon
        ? "The milestone is close enough that the wrap-up touch, date check, and client expectation should already be visible in Front Office, with the same return point calling back to the formal file."
        : negotiationTransactionId
          ? "The formal file is live, so Front Office should point to the shared Back Office record, keep client-facing context visible, and avoid building a second close-out surface or recap."
          : isFrontOfficeStageReadyForBackOffice(client.stage)
            ? "The client is ready for formal deal-wrap handling, so open the shared Back Office record before closing guidance starts and keep the recap aligned."
            : "Stay in Front Office prep until the deal is formal enough to need a close-out track and the return point can move with it.";
  const closingOperatorLabel = hasCancelledTransaction
    ? "Front Office resets the conversation"
    : hasClosedTransaction
      ? "Front Office owns the relationship; Back Office owns the finished record"
      : negotiationTransactionId
        ? "Front Office supports the wrap-up; Back Office owns the formal record"
        : isFrontOfficeStageReadyForBackOffice(client.stage)
          ? "Front Office prepares the close; Back Office should own the file"
          : "Front Office is still in pre-win mode";
  const closingOperatorDescription = hasCancelledTransaction
    ? "Use this section for respectful re-entry, future planning, or alternate options instead of treating the cancelled file like a live win."
    : hasClosedTransaction
      ? "Keep post-close care in Front Office while the authoritative transaction record remains in Back Office."
      : negotiationTransactionId
        ? "The wrap-up should keep pointing to the formal Back Office record, not create a second closing tracker in Front Office or split the recap away from it."
        : isFrontOfficeStageReadyForBackOffice(client.stage)
          ? "Prepare the close here, but hand the formal deal file to Back Office when it opens and preserve the same client-ready view."
          : "Use this section only for pre-win prep and keep the formal record dormant until the deal exists.";
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
      ? "The formal win is already recorded, and the next recommendations should keep the relationship active after close while the client-ready summary keeps pointing back to the same file."
      : negotiationTransactionId
        ? "As closing dates, move-in timing, or transaction outcomes settle, the client page will turn those signals into wrap-up guidance tied to the shared Back Office record and the same return point."
        : isFrontOfficeStageReadyForBackOffice(client.stage)
          ? "Open the formal Back Office deal first. Closing suggestions are intentionally downstream of that shared transaction record and should mirror the same client-facing view."
          : "Closing and win suggestions stay dormant until the client reaches a formal deal stage and the client page can hand off cleanly.";
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
              "If the client restarts, the fastest recovery path is to reopen listing output from this same client page instead of rebuilding context from scratch.",
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
                "The current client page can already generate a clean client summary PDF for move-in, milestone, or thank-you communication without duplicating the Back Office record.",
              metaLabel: `${sendCount} tracked send(s) already live on this client page`,
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
                title:
                  "Confirm the closing or move-in date in the shared Back Office file",
                statusLabel: closingReferenceDate
                  ? "Date on file"
                  : "Missing date",
                statusTone: closingReferenceDate ? "accent" : "warning",
                contextLabel: "Deal wrap",
                description: closingReferenceDate
                  ? closingKeyDateLabel
                  : "A formal transaction exists, but no closing or move-in milestone is captured yet in the shared Back Office record.",
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
                  : "Do not wait until after close to think about the next client relationship touch, because the formal record should already point to it.",
                metaLabel: `${openTaskCount} Front Office follow-up task(s) still open`,
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
                  "The client page can already export a clean client summary PDF, so wrap-up communication does not need a separate manual document or a second formal file.",
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
                  contextLabel: "Back Office ready",
                  description:
                    "Closing and win guidance depend on the shared transaction record, so the first move is still to open the formal Back Office file.",
                  metaLabel: closingBoundaryMetaLabel,
                  actionLabel: "Open Back Office create flow",
                  href: activeHandoff?.href ?? "/office/transactions",
                  opensInNewTab: false,
                },
              ]
            : [];
  const latestUpcomingAppointment = getUpcomingScheduledAppointment(
    client.appointments,
    now,
  );
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
      nextMoveLabel: negotiationNextMoveLabel,
      nextMoveDescription: negotiationNextMoveDescription,
      operatorLabel: negotiationOperatorLabel,
      operatorDescription: negotiationOperatorDescription,
      primaryAction: negotiationPrimaryAction,
    },
    inspection: {
      boundaryLabel: inspectionBoundaryLabel,
      boundaryTitle: inspectionBoundaryTitle,
      boundaryDescription: inspectionBoundaryDescription,
      boundaryMetaLabel: inspectionBoundaryMetaLabel,
      nextMoveLabel: inspectionNextMoveLabel,
      nextMoveDescription: inspectionNextMoveDescription,
      operatorLabel: inspectionOperatorLabel,
      operatorDescription: inspectionOperatorDescription,
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
      nextMoveLabel: closingNextMoveLabel,
      nextMoveDescription: closingNextMoveDescription,
      operatorLabel: closingOperatorLabel,
      operatorDescription: closingOperatorDescription,
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
    lastContactAt: client.lastContactAt,
    nextFollowUpAt: client.nextFollowUpAt,
    openTaskCount,
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
      nextMoveLabel: negotiationNextMoveLabel,
      nextMoveDescription: negotiationNextMoveDescription,
      operatorLabel: negotiationOperatorLabel,
      operatorDescription: negotiationOperatorDescription,
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
      nextMoveLabel: inspectionNextMoveLabel,
      nextMoveDescription: inspectionNextMoveDescription,
      operatorLabel: inspectionOperatorLabel,
      operatorDescription: inspectionOperatorDescription,
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
      nextMoveLabel: closingNextMoveLabel,
      nextMoveDescription: closingNextMoveDescription,
      operatorLabel: closingOperatorLabel,
      operatorDescription: closingOperatorDescription,
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
    aiStrategy: aiSuggestions.aiStrategy,
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
        ? "Open calendar update"
        : externalWorkflow.value === "confirmed"
          ? "Open calendar update after confirmation"
          : externalWorkflow.value === "reschedule_requested"
            ? "Bridge the reschedule, then open calendar update"
            : externalWorkflow.value === "needs_follow_up" ||
                externalWorkflow.value === "confirmation_pending"
              ? "Keep the draft moving, then open calendar update"
              : "Open calendar update after the next external touch";
      const bridgeNextStepDetail = bridgeStatus?.hasBridgeActivity
        ? "The draft has already been logged, so the next touch should be recorded in the calendar route instead of starting a second coordination surface."
        : externalWorkflow.value === "confirmed"
          ? "The outside status is settled enough that the calendar route should capture the next touch and keep the focus on this appointment."
          : externalWorkflow.value === "reschedule_requested"
            ? "Once the new time or reply is confirmed, move straight into the calendar update form with the same appointment focus."
            : externalWorkflow.value === "needs_follow_up" ||
                externalWorkflow.value === "confirmation_pending"
              ? "Use the draft action first, then come back to the calendar update form when the outside reply is ready to record."
              : "The calendar update should happen after the next external touch, not as a separate coordination page.";
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
