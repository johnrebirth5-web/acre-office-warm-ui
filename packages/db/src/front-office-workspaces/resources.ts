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
import { getFrontOfficeActivitySnapshot } from "./activity";

export async function getFrontOfficeResourcesSnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeResourcesSnapshot> {
  const resourceWhere: Prisma.ResourceWhereInput = {
    organizationId: input.organizationId,
    isPublished: true,
  };
  const vendorWhere: Prisma.VendorWhereInput = {
    organizationId: input.organizationId,
  };

  const [
    resources,
    vendors,
    resourceCount,
    vendorCount,
    resourceTypeGroups,
    featuredVendorCount,
    quickContactVendorCount,
    vendorCategoryGroups,
    interactionTracking,
    sharedInteractionTracking,
  ] = await Promise.all([
    prisma.resource.findMany({
      where: resourceWhere,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        summary: true,
        type: true,
        tags: true,
        url: true,
        updatedAt: true,
      },
    }),
    prisma.vendor.findMany({
      where: vendorWhere,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        category: true,
        name: true,
        headline: true,
        phone: true,
        email: true,
        website: true,
        neighborhoods: true,
        notes: true,
        isFeatured: true,
        updatedAt: true,
      },
    }),
    prisma.resource.count({
      where: resourceWhere,
    }),
    prisma.vendor.count({
      where: vendorWhere,
    }),
    prisma.resource.groupBy({
      by: ["type"],
      where: resourceWhere,
      _count: {
        _all: true,
      },
    }),
    prisma.vendor.count({
      where: {
        ...vendorWhere,
        isFeatured: true,
      },
    }),
    prisma.vendor.count({
      where: {
        ...vendorWhere,
        OR: [
          { phone: { not: null } },
          { email: { not: null } },
          { website: { not: null } },
        ],
      },
    }),
    prisma.vendor.groupBy({
      by: ["category"],
      where: vendorWhere,
      _count: {
        _all: true,
      },
    }),
    getFrontOfficeResourceInteractionSnapshot({
      organizationId: input.organizationId,
      membershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      timeZone: input.timeZone ?? null,
    }),
    getFrontOfficeSharedResourceInteractionSnapshot({
      organizationId: input.organizationId,
      membershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      timeZone: input.timeZone ?? null,
    }),
  ]);

  const sortedResources = resources
    .slice()
    .sort((left, right) => {
      const priorityDelta =
        getResourceTypePriority(left.type) -
        getResourceTypePriority(right.type);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const summaryDelta =
        Number(Boolean(right.summary?.trim())) -
        Number(Boolean(left.summary?.trim()));

      if (summaryDelta !== 0) {
        return summaryDelta;
      }

      const tagDelta =
        cleanStringList(right.tags).length - cleanStringList(left.tags).length;

      if (tagDelta !== 0) {
        return tagDelta;
      }

      if (left.updatedAt.getTime() !== right.updatedAt.getTime()) {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      }

      return left.title.localeCompare(right.title);
    });
  const sortedVendors = vendors
    .slice()
    .sort((left, right) => {
      const featuredDelta = Number(right.isFeatured) - Number(left.isFeatured);

      if (featuredDelta !== 0) {
        return featuredDelta;
      }

      const leftQuickActionCount = countVendorQuickActions(left);
      const rightQuickActionCount = countVendorQuickActions(right);

      if (leftQuickActionCount !== rightQuickActionCount) {
        return rightQuickActionCount - leftQuickActionCount;
      }

      const categoryPriorityDelta =
        getVendorCategoryPriority(left.category) -
        getVendorCategoryPriority(right.category);

      if (categoryPriorityDelta !== 0) {
        return categoryPriorityDelta;
      }

      const categoryDelta = formatVendorCategoryLabel(
        left.category,
      ).localeCompare(formatVendorCategoryLabel(right.category));

      if (categoryDelta !== 0) {
        return categoryDelta;
      }

      if (left.updatedAt.getTime() !== right.updatedAt.getTime()) {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      }

      return left.name.localeCompare(right.name);
    });
  const executionPulse = buildFrontOfficeResourcesExecutionPulse({
    resourceTypeGroups: Array.from(
      resources.reduce((map, resource) => {
        const normalizedType = normalizeFrontOfficeResourceType(resource.type);
        map.set(normalizedType, (map.get(normalizedType) ?? 0) + 1);
        return map;
      }, new Map<ResourceType, number>()),
    ).map(([type, count]) => ({
      type,
      _count: {
        _all: count,
      },
    })),
    vendorCount,
    quickContactVendorCount,
  });
  const normalizedResourceTypeGroups = Array.from(
    resources.reduce((map, resource) => {
      const normalizedType = normalizeFrontOfficeResourceType(resource.type);
      map.set(normalizedType, (map.get(normalizedType) ?? 0) + 1);
      return map;
    }, new Map<ResourceType, number>()),
  ).map(([type, count]) => ({
    type,
    _count: {
      _all: count,
    },
  }));

  return {
    summary: {
      resourceCount,
      vendorCount,
      resourceTypeCount: normalizedResourceTypeGroups.length,
      featuredVendorCount,
      quickContactVendorCount,
      vendorCategoryCount: vendorCategoryGroups.length,
    },
    interactionTracking: {
      ...interactionTracking,
      sharedTracking: sharedInteractionTracking,
    },
    executionPulse,
    resourceTypes: normalizedResourceTypeGroups
      .slice()
      .sort(
        (left, right) =>
          getResourceTypePriority(left.type) -
            getResourceTypePriority(right.type) ||
          Number(left.type === ResourceType.training_video) -
            Number(right.type === ResourceType.training_video) ||
          right._count._all - left._count._all,
      )
      .map((group) => ({
        key: group.type,
        label: formatResourceType(group.type),
        count: group._count._all,
        tone: getResourceTypeTone(group.type),
        description: getResourceTypeDescription(group.type),
        startLabel: getResourceTypeStartLabel(group.type),
        actionLabel: getResourceActionLabel(group.type),
      })),
    vendorCategories: vendorCategoryGroups
      .slice()
      .sort(
        (left, right) =>
          getVendorCategoryPriority(left.category) -
            getVendorCategoryPriority(right.category) ||
          right._count._all - left._count._all ||
          formatVendorCategoryLabel(left.category).localeCompare(
            formatVendorCategoryLabel(right.category),
          ),
      )
      .map((group) => ({
        category: group.category,
        label: formatVendorCategoryLabel(group.category),
        count: group._count._all,
        tone: mapVendorCategoryTone(group.category),
        description: buildVendorCategoryDescription(group.category),
      })),
    resources: sortedResources.map((resource) => {
      const normalizedType = normalizeFrontOfficeResourceType(resource.type);

      return {
        id: resource.id,
        title: resource.title,
        summary:
          resource.summary?.trim() || getResourceTypeDescription(normalizedType),
        detailLabel: buildResourceDetailLabel({
          type: normalizedType,
          tags: resource.tags,
        }),
        freshnessLabel: buildFreshnessLabel(
          resource.updatedAt,
          new Date(),
          input.timeZone,
        ),
        actionLabel: getResourceActionLabel(normalizedType),
        laneLabel: getResourceTypeLaneLabel(normalizedType),
        typeKey: normalizedType,
        typeLabel: formatResourceType(normalizedType),
        typeTone: getResourceTypeTone(normalizedType),
        tagCount: cleanStringList(resource.tags).length,
        tags: cleanStringList(resource.tags, 4),
        href: buildFrontOfficeResourceHref(
          resource.id,
          normalizedType,
          resource.url?.trim() || "",
        ),
      };
    }),
    vendors: sortedVendors.map((vendor) => {
      const websiteHref = vendor.website?.trim() || null;
      const phoneHref = vendor.phone?.trim()
        ? `tel:${vendor.phone.trim()}`
        : null;
      const emailHref = vendor.email?.trim()
        ? `mailto:${vendor.email.trim()}`
        : null;
      const coverageLabel = buildVendorCoverageLabel(vendor.neighborhoods);
      const quickActionCount = countVendorQuickActions(vendor);

      return {
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        categoryLabel: formatVendorCategoryLabel(vendor.category),
        categoryTone: mapVendorCategoryTone(vendor.category),
        headline: buildVendorHeadline({
          category: vendor.category,
          headline: vendor.headline,
          notes: vendor.notes,
          neighborhoods: vendor.neighborhoods,
          quickActionCount,
        }),
        neighborhoodsLabel: coverageLabel,
        coverageLabel,
        contactLabel: buildVendorContactLabel(vendor),
        actionLabel: buildVendorPrimaryActionLabel(vendor),
        websiteHref,
        phoneHref,
        emailHref,
        quickActionCount,
        quickActionLabel: buildVendorQuickActionLabel(quickActionCount),
        isFeatured: vendor.isFeatured,
        href: buildVendorPrimaryHref(vendor),
      };
    }),
  };
}
