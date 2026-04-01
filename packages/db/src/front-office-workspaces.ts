import {
  ListingStatus,
  NotificationType,
  Prisma,
  ResourceType,
} from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

export type FrontOfficeWorkspaceInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
};

export type FrontOfficeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type FrontOfficeClientRecord = {
  id: string;
  fullName: string;
  stage: string;
  stageTone: FrontOfficeTone;
  intentLabel: string;
  budgetLabel: string;
  areasLabel: string;
  sourceLabel: string;
  lastTouchLabel: string;
  nextTouchLabel: string;
  href: string;
};

export type FrontOfficeClientsSnapshot = {
  summary: {
    liveContacts: number;
    activeStages: number;
    followUpDueCount: number;
    overdueTaskCount: number;
  };
  stageMetrics: Array<{
    label: string;
    count: number;
    tone: FrontOfficeTone;
  }>;
  clients: FrontOfficeClientRecord[];
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
};

export type FrontOfficeListingsSnapshot = {
  summary: {
    listingCount: number;
    publicReadyCount: number;
    trackedClicks: number;
    trackedLinks: number;
  };
  listings: FrontOfficeListingRecord[];
};

export type FrontOfficeResourceRecord = {
  id: string;
  title: string;
  summary: string;
  typeLabel: string;
  tags: string[];
  href: string;
};

export type FrontOfficeVendorRecord = {
  id: string;
  name: string;
  category: string;
  headline: string;
  neighborhoodsLabel: string;
  contactLabel: string;
  href: string | null;
};

export type FrontOfficeResourcesSnapshot = {
  summary: {
    resourceCount: number;
    vendorCount: number;
    resourceTypeCount: number;
  };
  resources: FrontOfficeResourceRecord[];
  vendors: FrontOfficeVendorRecord[];
};

export type FrontOfficeActivityNotificationRecord = {
  id: string;
  title: string;
  body: string;
  typeLabel: string;
  actionLabel: string;
  href: string;
  isUnread: boolean;
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

export type FrontOfficeActivitySnapshot = {
  summary: {
    actionableItemCount: number;
    upcomingEventCount: number;
    unreadNoticeCount: number;
  };
  notifications: FrontOfficeActivityNotificationRecord[];
  events: FrontOfficeActivityEventRecord[];
};

const openFollowUpStatuses = ["queued", "in_progress"] as const;
const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];

function formatCurrency(value: Prisma.Decimal | number | null | undefined) {
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

function formatBudgetRange(
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
    timeZone: timeZone ?? undefined,
  });
}

function formatRelativeDueLabel(
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

function mapClientStageTone(stage: string): FrontOfficeTone {
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

function mapListingStatusTone(status: ListingStatus): FrontOfficeTone {
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

function formatListingStatus(status: ListingStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatNotificationType(type: NotificationType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatResourceType(type: ResourceType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatEventVisibilityLabel(
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

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function buildVisibleEventWhere(
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

  const [clients, stageGroups, followUpDueCount, overdueTaskCount] =
    await Promise.all([
      prisma.client.findMany({
        where: clientWhere,
        orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
        take: 24,
        select: {
          id: true,
          fullName: true,
          source: true,
          stage: true,
          intent: true,
          budgetMin: true,
          budgetMax: true,
          preferredAreas: true,
          lastContactAt: true,
          nextFollowUpAt: true,
        },
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
          nextFollowUpAt: {
            lt: startOfTomorrow,
          },
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
    ]);

  return {
    summary: {
      liveContacts: clients.length,
      activeStages: stageGroups.length,
      followUpDueCount,
      overdueTaskCount,
    },
    stageMetrics: stageGroups
      .sort(
        (left, right) =>
          right._count._all - left._count._all ||
          left.stage.localeCompare(right.stage),
      )
      .slice(0, 6)
      .map((group) => ({
        label: group.stage,
        count: group._count._all,
        tone: mapClientStageTone(group.stage),
      })),
    clients: clients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      stage: client.stage,
      stageTone: mapClientStageTone(client.stage),
      intentLabel: client.intent?.trim() || "Intent not captured",
      budgetLabel: formatBudgetRange(client.budgetMin, client.budgetMax),
      areasLabel: client.preferredAreas.length
        ? client.preferredAreas.join(", ")
        : "Areas not captured",
      sourceLabel: client.source?.trim() || "Source not captured",
      lastTouchLabel: client.lastContactAt
        ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
        : "No contact logged yet",
      nextTouchLabel: formatRelativeDueLabel(
        client.nextFollowUpAt,
        now,
        input.timeZone,
      ),
      href: `/agent/clients/${client.id}`,
    })),
  };
}

export async function getFrontOfficeListingsSnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeListingsSnapshot> {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const listingWhere: Prisma.ListingWhereInput = {
    organizationId: input.organizationId,
    status: {
      in: activeListingStatuses,
    },
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const [listings, listingCount, publicReadyCount, shareAggregate] =
    await Promise.all([
      prisma.listing.findMany({
        where: listingWhere,
        orderBy: [{ updatedAt: "desc" }],
        take: 24,
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
    ]);

  const listingShareRows =
    listings.length > 0
      ? await prisma.listingShareLink.groupBy({
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
        })
      : [];

  const listingShareMap = new Map(
    listingShareRows.map((row) => [
      row.listingId,
      {
        count: row._count._all,
        clicks: row._sum.clickCount ?? 0,
      },
    ]),
  );

  return {
    summary: {
      listingCount,
      publicReadyCount,
      trackedClicks: shareAggregate._sum.clickCount ?? 0,
      trackedLinks: shareAggregate._count._all,
    },
    listings: listings.map((listing) => {
      const shareMetrics = listingShareMap.get(listing.id);
      const bedroomLabel = listing.bedrooms ? `${listing.bedrooms} bd` : null;
      const bathroomLabel = listing.bathrooms
        ? `${Number(listing.bathrooms)} ba`
        : null;
      const layoutLabel = [bedroomLabel, bathroomLabel]
        .filter(Boolean)
        .join(" · ");

      return {
        id: listing.id,
        title: listing.title,
        areaLabel: `${listing.neighborhood}, ${listing.city}`,
        summaryLabel:
          listing.aiSummary?.trim() ||
          layoutLabel ||
          "Send-ready listing in the current office scope.",
        priceLabel: formatCurrency(listing.price),
        cityLabel: listing.city,
        statusLabel: formatListingStatus(listing.status),
        statusTone: mapListingStatusTone(listing.status),
        trackedClickCount: shareMetrics?.clicks ?? 0,
        trackedLinkCount: shareMetrics?.count ?? 0,
      };
    }),
  };
}

export async function getFrontOfficeResourcesSnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeResourcesSnapshot> {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const resourceWhere: Prisma.ResourceWhereInput = {
    organizationId: input.organizationId,
    isPublished: true,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };
  const vendorWhere: Prisma.VendorWhereInput = {
    organizationId: input.organizationId,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const [resources, vendors, resourceCount, vendorCount, resourceTypes] =
    await Promise.all([
      prisma.resource.findMany({
        where: resourceWhere,
        orderBy: [{ updatedAt: "desc" }],
        take: 24,
        select: {
          id: true,
          title: true,
          summary: true,
          type: true,
          tags: true,
          url: true,
        },
      }),
      prisma.vendor.findMany({
        where: vendorWhere,
        orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
        take: 24,
        select: {
          id: true,
          category: true,
          name: true,
          headline: true,
          phone: true,
          email: true,
          website: true,
          neighborhoods: true,
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
      }),
    ]);

  return {
    summary: {
      resourceCount,
      vendorCount,
      resourceTypeCount: resourceTypes.length,
    },
    resources: resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      summary: resource.summary,
      typeLabel: formatResourceType(resource.type),
      tags: resource.tags,
      href: resource.url,
    })),
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      category: vendor.category,
      headline: vendor.headline,
      neighborhoodsLabel: vendor.neighborhoods.length
        ? vendor.neighborhoods.join(" · ")
        : "Office-wide vendor",
      contactLabel:
        vendor.phone?.trim() ||
        vendor.website?.trim() ||
        vendor.email?.trim() ||
        "Open vendor profile",
      href:
        vendor.website?.trim() ||
        (vendor.phone?.trim()
          ? `tel:${vendor.phone.trim()}`
          : vendor.email?.trim()
            ? `mailto:${vendor.email.trim()}`
            : null),
    })),
  };
}

export async function getFrontOfficeActivitySnapshot(
  input: FrontOfficeWorkspaceInput,
): Promise<FrontOfficeActivitySnapshot> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const sevenDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 7,
  );
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
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

  const [notifications, unreadNoticeCount, events] = await Promise.all([
    prisma.notification.findMany({
      where: notificationWhere,
      orderBy: [{ createdAt: "desc" }],
      take: 24,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        actionUrl: true,
        readAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        ...notificationWhere,
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
  ]);

  return {
    summary: {
      actionableItemCount: notifications.length,
      upcomingEventCount: events.length,
      unreadNoticeCount,
    },
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      typeLabel: formatNotificationType(notification.type),
      actionLabel: notification.actionUrl?.trim()
        ? "Open notice"
        : formatNotificationType(notification.type),
      href: notification.actionUrl?.trim() || "/agent/notifications",
      isUnread: notification.readAt == null,
    })),
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
              : `${event._count.rsvps} RSVP(s)`,
      href: event.meetingUrl?.trim() || "/agent/notifications",
    })),
  };
}
