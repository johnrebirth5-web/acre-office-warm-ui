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
import { getFrontOfficeResourcesSnapshot } from "./resources";
import { getFrontOfficeActivitySnapshot } from "./activity";

export async function getFrontOfficeListingsSnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeListingsSnapshot> {
  const now = new Date();
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const listingWhere: Prisma.ListingWhereInput = {
    organizationId: input.organizationId,
    status: {
      in: activeListingStatuses,
    },
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const [
    listings,
    listingCount,
    publicReadyCount,
    shareAggregate,
    explicitTargetClient,
    targetAppointment,
    membership,
    recentClosedTransactions,
    recentClosedCount,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: listingWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 48,
      select: {
        id: true,
        title: true,
        neighborhood: true,
        city: true,
        price: true,
        status: true,
        isPublic: true,
        aiSummary: true,
        bedrooms: true,
        bathrooms: true,
        updatedAt: true,
      },
    }),
    prisma.listing.count({
      where: listingWhere,
    }),
    prisma.listing.count({
      where: {
        ...listingWhere,
        isPublic: true,
      },
    }),
    prisma.listingShareLink.aggregate({
      where: {
        membershipId: input.viewerMembershipId,
        listing: {
          organizationId: input.organizationId,
          ...(officeScopeFilter ? officeScopeFilter : {}),
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        clickCount: true,
      },
    }),
    input.targetClientId?.trim()
      ? prisma.client.findFirst({
          where: {
            id: input.targetClientId.trim(),
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
          },
          select: {
            id: true,
            fullName: true,
            stage: true,
            nextFollowUpAt: true,
            leaseReminderAt: true,
          },
        })
      : Promise.resolve(null),
    input.targetAppointmentId?.trim()
      ? prisma.appointment.findFirst({
          where: {
            id: input.targetAppointmentId.trim(),
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
          },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            startsAt: true,
            location: true,
            meetingUrl: true,
            client: {
              select: {
                id: true,
                fullName: true,
                stage: true,
                nextFollowUpAt: true,
                leaseReminderAt: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.membership.findFirst({
      where: {
        id: input.viewerMembershipId,
        organizationId: input.organizationId,
      },
      select: {
        role: true,
        title: true,
        office: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        agentProfile: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            licenseNumber: true,
            licenseState: true,
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: "closed",
        ...(input.officeId ? { officeId: input.officeId } : {}),
      },
      orderBy: [{ closingDate: "desc" }, { updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        title: true,
        address: true,
        city: true,
        state: true,
        closingDate: true,
        purchasedPrice: true,
        price: true,
      },
    }),
    prisma.transaction.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: "closed",
        ...(input.officeId ? { officeId: input.officeId } : {}),
      },
    }),
  ]);

  type ListingShareAggregateRow = {
    listingId: string;
    _count: {
      _all: number;
    };
    _sum: {
      clickCount: number | null;
    };
  };
  type LatestListingShareLinkRow = {
    listingId: string;
    channel: string;
    createdAt: Date;
    sendRecord: {
      id: string;
      channel: FrontOfficeSendChannel;
      sentAt: Date;
      clientStageLabel: string | null;
      appointmentId: string | null;
      appointmentTitle: string | null;
      appointmentStartsAt: Date | null;
      client: {
        id: string;
        fullName: string;
      };
    } | null;
  };

  let listingShareAggregates: ListingShareAggregateRow[] = [];
  let latestShareLinks: LatestListingShareLinkRow[] = [];

  if (listings.length > 0) {
    [listingShareAggregates, latestShareLinks] = await Promise.all([
      prisma.listingShareLink.groupBy({
        by: ["listingId"],
        where: {
          membershipId: input.viewerMembershipId,
          listingId: {
            in: listings.map((listing) => listing.id),
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          clickCount: true,
        },
      }),
      prisma.listingShareLink.findMany({
        where: {
          membershipId: input.viewerMembershipId,
          listingId: {
            in: listings.map((listing) => listing.id),
          },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          listingId: true,
          channel: true,
          createdAt: true,
          sendRecord: {
            select: {
              id: true,
              channel: true,
              sentAt: true,
              clientStageLabel: true,
              appointmentId: true,
              appointmentTitle: true,
              appointmentStartsAt: true,
              client: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      }),
    ]);
  }

  const listingShareMap = new Map(
    listingShareAggregates.map((row) => [
      row.listingId,
      {
        count: row._count._all,
        clicks: row._sum.clickCount ?? 0,
      },
    ]),
  );
  const latestShareByListingId = new Map<
    string,
    {
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
    }
  >();

  for (const shareLink of latestShareLinks) {
    if (latestShareByListingId.has(shareLink.listingId)) {
      continue;
    }

    const execution = buildFrontOfficeListingShareExecutionSummary({
      channel: shareLink.sendRecord?.channel ?? shareLink.channel,
      client: shareLink.sendRecord?.client
        ? {
            fullName: shareLink.sendRecord.client.fullName,
            stageLabel: shareLink.sendRecord.clientStageLabel,
          }
        : null,
      appointment:
        shareLink.sendRecord?.appointmentTitle ||
        shareLink.sendRecord?.appointmentStartsAt
          ? {
              title:
                shareLink.sendRecord?.appointmentTitle?.trim() ||
                "Appointment context",
              startsAt: shareLink.sendRecord?.appointmentStartsAt ?? null,
            }
          : null,
      sentAt: shareLink.sendRecord?.sentAt ?? shareLink.createdAt,
      sendRecordId: shareLink.sendRecord?.id ?? null,
      timeZone: input.timeZone,
    });

    latestShareByListingId.set(shareLink.listingId, {
      modeLabel: execution.modeLabel,
      channelLabel: execution.channelLabel,
      sentAtLabel: execution.sentAtLabel,
      sentAtValue: execution.sentAtValue,
      trackingLabel: execution.trackingLabel,
      trackingStatus: shareLink.sendRecord?.id
        ? "tracked_send_recorded"
        : "tracked_link_only",
      statusTone: execution.statusTone,
      writebackLabel: execution.writebackLabel,
      writebackScopeLabel: execution.writebackScopeLabel,
      nextStepLabel: execution.nextStepLabel,
      clientLabel: execution.clientLabel,
      clientStageDisplayLabel: execution.clientStageDisplayLabel,
      clientHref: shareLink.sendRecord?.client
        ? buildClientDetailHref(
            shareLink.sendRecord.client.id,
            frontOfficeClientSectionAnchors.listingOutput,
          )
        : null,
      appointmentLabel: execution.appointmentLabel,
      appointmentWindowLabel: execution.appointmentWindowLabel,
      appointmentHref: shareLink.sendRecord?.appointmentId
        ? buildCalendarAppointmentHref({
            appointmentId: shareLink.sendRecord.appointmentId,
            clientId: shareLink.sendRecord.client.id,
          })
        : null,
    });
  }
  const sortedListings = listings
    .slice()
    .sort((left, right) => {
      const leftShares = listingShareMap.get(left.id);
      const rightShares = listingShareMap.get(right.id);
      const publicReadyDelta = Number(right.isPublic) - Number(left.isPublic);

      if (publicReadyDelta !== 0) {
        return publicReadyDelta;
      }

      const clickDelta = (rightShares?.clicks ?? 0) - (leftShares?.clicks ?? 0);

      if (clickDelta !== 0) {
        return clickDelta;
      }

      const trackedLinkDelta =
        (rightShares?.count ?? 0) - (leftShares?.count ?? 0);

      if (trackedLinkDelta !== 0) {
        return trackedLinkDelta;
      }

      const statusDelta =
        getListingStatusSortRank(left.status) -
        getListingStatusSortRank(right.status);

      if (statusDelta !== 0) {
        return statusDelta;
      }

      if (left.updatedAt.getTime() !== right.updatedAt.getTime()) {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, 24);

  const targetClient =
    explicitTargetClient ??
    (targetAppointment?.client
      ? {
          id: targetAppointment.client.id,
          fullName: targetAppointment.client.fullName,
          stage: targetAppointment.client.stage,
          nextFollowUpAt: targetAppointment.client.nextFollowUpAt,
          leaseReminderAt: targetAppointment.client.leaseReminderAt,
        }
      : null);
  const resolvedTargetAppointment =
    targetAppointment &&
    (!targetClient || targetAppointment.client?.id === targetClient.id)
      ? targetAppointment
      : null;

  const displayName =
    membership?.agentProfile?.displayName?.trim() ||
    `${membership?.user.firstName ?? ""} ${membership?.user.lastName ?? ""}`.trim() ||
    membership?.user.email ||
    "Acre agent";
  const titleLabel =
    membership?.title?.trim() ||
    (membership ? formatUserRoleLabel(membership.role) : "Agent");
  const officeLabel = membership?.office?.name?.trim() || "Acre";
  const bioLabel =
    membership?.agentProfile?.bio?.trim() ||
    "Use this profile sheet to keep business card, contact info, and recent closings beside the listing send.";
  const licenseLabel =
    membership?.agentProfile?.licenseNumber?.trim() &&
    membership?.agentProfile?.licenseState?.trim()
      ? `${membership.agentProfile.licenseState.trim()} · ${membership.agentProfile.licenseNumber.trim()}`
      : membership?.agentProfile?.licenseNumber?.trim() ||
        membership?.agentProfile?.licenseState?.trim() ||
        "License info not published";
  const avatarFallback = buildInitials(
    membership?.user.firstName,
    membership?.user.lastName,
  );
  const businessCardText = [
    displayName,
    titleLabel,
    officeLabel,
    membership?.user.phone?.trim() || "",
    membership?.user.email?.trim() || "",
    licenseLabel !== "License info not published" ? licenseLabel : "",
  ]
    .filter(Boolean)
    .join("\n");
  const introEmailText = `Subject: Introduction from ${displayName}\n\nHi,\n\nI am ${displayName}, ${titleLabel} at ${officeLabel}. I help clients move from first conversation through shortlist, showings, and the formal Back Office handoff once the process becomes transaction-ready.\n\nIf you want a quick intro call, reply here and I can send a few focused next steps.\n\nBest,\n${displayName}\n${membership?.user.phone?.trim() || ""}\n${membership?.user.email?.trim() || ""}`;
  const introTextMessage = `Hi, this is ${displayName} from ${officeLabel}. I help clients move from search setup into showings and formal next steps. If you want a quick intro call, reply here and I can line up the best next options.`;

  return {
    summary: {
      listingCount,
      publicReadyCount,
      trackedClicks: shareAggregate._sum.clickCount ?? 0,
      trackedLinks: shareAggregate._count._all,
    },
    targetClient: targetClient
      ? {
          id: targetClient.id,
          fullName: targetClient.fullName,
          stage: targetClient.stage,
          stageTone: mapClientStageTone(targetClient.stage),
          nextTouchLabel: formatNextTouchLabel({
            nextFollowUpAt: targetClient.nextFollowUpAt,
            leaseReminderAt: targetClient.leaseReminderAt,
            now,
            timeZone: input.timeZone,
          }),
          href: `/agent/clients/${targetClient.id}`,
        }
      : null,
    targetAppointment: resolvedTargetAppointment
      ? {
          id: resolvedTargetAppointment.id,
          title: resolvedTargetAppointment.title,
          typeLabel: formatAppointmentTypeLabel(resolvedTargetAppointment.type),
          statusLabel: formatAppointmentStatusLabel(
            resolvedTargetAppointment.status,
          ),
          statusTone: mapAppointmentStatusTone(
            resolvedTargetAppointment.status,
          ),
          startsAtLabel: formatDateTimeLabel(
            resolvedTargetAppointment.startsAt,
            {
              timeZone: input.timeZone ?? null,
            },
          ),
          locationLabel:
            resolvedTargetAppointment.location?.trim() ||
            resolvedTargetAppointment.meetingUrl?.trim() ||
            "Location pending",
          href: buildCalendarAppointmentHref({
            appointmentId: resolvedTargetAppointment.id,
            clientId: resolvedTargetAppointment.client?.id ?? null,
          }),
        }
      : null,
    agentMaterial: {
      displayName,
      titleLabel,
      officeLabel,
      bioLabel,
      avatarUrl: membership?.agentProfile?.avatarUrl?.trim() || "",
      avatarFallback,
      email: membership?.user.email?.trim() || "",
      phone: membership?.user.phone?.trim() || "",
      licenseLabel,
      recentClosedCount,
      featuredCaseCount: recentClosedTransactions.length,
      portraitReady: Boolean(membership?.agentProfile?.avatarUrl?.trim()),
      businessCardText,
      introEmailText,
      introTextMessage,
      featuredCases: recentClosedTransactions.map((transaction) => ({
        id: transaction.id,
        label: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`,
        closingLabel: transaction.closingDate
          ? `Closed ${formatDateLabel(transaction.closingDate, input.timeZone)}`
          : "Closed deal",
        priceLabel: formatCurrency(
          transaction.purchasedPrice ?? transaction.price,
        ),
        href: `/office/transactions/${transaction.id}`,
      })),
    },
    listings: sortedListings.map((listing) => {
      const shareMetrics = listingShareMap.get(listing.id);
      const latestTrackedShare = latestShareByListingId.get(listing.id) ?? null;

      return {
        id: listing.id,
        title: listing.title,
        areaLabel: buildListingAreaLabel(listing.neighborhood, listing.city),
        summaryLabel: buildListingSummaryLabel({
          aiSummary: listing.aiSummary,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          isPublic: listing.isPublic,
        }),
        priceLabel: formatCurrency(listing.price),
        cityLabel: cleanStringList([listing.city])[0] || "City pending",
        statusLabel: formatListingStatus(listing.status),
        statusTone: mapListingStatusTone(listing.status),
        trackedClickCount: shareMetrics?.clicks ?? 0,
        trackedLinkCount: shareMetrics?.count ?? 0,
        latestTrackedShare,
      };
    }),
  };
}
