import {
  ListingStatus,
  NotificationType,
  Prisma,
  ResourceType,
  SignatureRequestStatus,
  TransactionStatus
} from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

export type FrontOfficeDashboardTone = "neutral" | "accent" | "success" | "warning" | "danger";

export type FrontOfficeDashboardSummary = {
  todayActionCount: number;
  followUpDueCount: number;
  todayCommitmentCount: number;
  needsBackOfficeCount: number;
};

export type FrontOfficeDashboardActionQueueItem = {
  id: string;
  label: string;
  count: number;
  tone: FrontOfficeDashboardTone;
  description: string;
  helper: string;
  href: string;
  actionLabel: string;
};

export type FrontOfficeDashboardStageMetric = {
  label: string;
  count: number;
  tone: FrontOfficeDashboardTone;
};

export type FrontOfficeDashboardClientItem = {
  id: string;
  fullName: string;
  stage: string;
  stageTone: FrontOfficeDashboardTone;
  source: string;
  nextTouchLabel: string;
  lastTouchLabel: string;
  href: string;
};

export type FrontOfficeDashboardCommitmentItem = {
  id: string;
  title: string;
  visibilityLabel: string;
  startsAtLabel: string;
  locationLabel: string;
  rsvpLabel: string;
  href: string;
};

export type FrontOfficeDashboardListingItem = {
  id: string;
  title: string;
  neighborhoodLabel: string;
  priceLabel: string;
  statusLabel: string;
  statusTone: FrontOfficeDashboardTone;
  trackedLinkCount: number;
  trackedClickCount: number;
  href: string;
};

export type FrontOfficeDashboardNoticeItem = {
  id: string;
  title: string;
  body: string;
  typeLabel: string;
  createdAtLabel: string;
  href: string;
};

export type FrontOfficeDashboardResourceItem = {
  id: string;
  title: string;
  typeLabel: string;
  summary: string;
  href: string;
};

export type FrontOfficeDashboardVendorItem = {
  id: string;
  name: string;
  category: string;
  headline: string;
  contactLabel: string;
  href: string | null;
};

export type FrontOfficeDashboardBackOfficeItem = {
  id: string;
  title: string;
  description: string;
  contextLabel: string;
  tone: FrontOfficeDashboardTone;
  actionLabel: string;
  href: string;
};

export type FrontOfficeDashboardSnapshot = {
  summary: FrontOfficeDashboardSummary;
  actionQueue: FrontOfficeDashboardActionQueueItem[];
  pipeline: {
    stageMetrics: FrontOfficeDashboardStageMetric[];
    recentClients: FrontOfficeDashboardClientItem[];
  };
  commitments: {
    items: FrontOfficeDashboardCommitmentItem[];
    appointmentModuleReady: boolean;
    appointmentMessage: string;
  };
  listingOutput: {
    activeListingCount: number;
    trackedLinkCount: number;
    trackedClickCount: number;
    recentListings: FrontOfficeDashboardListingItem[];
    trackedSendingReady: boolean;
  };
  noticeRail: {
    notifications: FrontOfficeDashboardNoticeItem[];
    resources: FrontOfficeDashboardResourceItem[];
    vendors: FrontOfficeDashboardVendorItem[];
  };
  backOffice: {
    items: FrontOfficeDashboardBackOfficeItem[];
  };
};

type GetFrontOfficeDashboardSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
};

const openFollowUpStatuses = ["queued", "in_progress"] as const;
const activeListingStatuses: ListingStatus[] = [ListingStatus.active, ListingStatus.hot];
const activeTransactionStatuses: TransactionStatus[] = [TransactionStatus.pending, TransactionStatus.active];
const openSignatureStatuses: SignatureRequestStatus[] = [
  SignatureRequestStatus.draft,
  SignatureRequestStatus.pending_send,
  SignatureRequestStatus.sent,
  SignatureRequestStatus.viewed
];
const handoffStagePatterns = ["negotiation", "application", "offer", "won", "contract"];

function formatCurrency(value: Prisma.Decimal | number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2
  }).format(numeric);
}

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "—";
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function formatRelativeDueLabel(value: Date | null | undefined, now: Date) {
  if (!value) {
    return "No follow-up scheduled";
  }

  const dueTime = value.getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

  if (dueTime < startOfToday) {
    return `Overdue since ${formatDateLabel(value)}`;
  }

  if (dueTime < startOfTomorrow) {
    return `Due today · ${formatDateTimeLabel(value, { timeZone: null })}`;
  }

  return `Next follow-up · ${formatDateLabel(value)}`;
}

function mapClientStageTone(stage: string): FrontOfficeDashboardTone {
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

  if (normalized.includes("negotiation") || normalized.includes("offer") || normalized.includes("application")) {
    return "warning";
  }

  if (normalized.includes("tour") || normalized.includes("viewing") || normalized.includes("contacted") || normalized.includes("warm")) {
    return "accent";
  }

  return "neutral";
}

function mapListingStatusTone(status: ListingStatus): FrontOfficeDashboardTone {
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

function formatEventVisibilityLabel(value: "all_agents" | "office_only" | "invite_only") {
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
    OR: [{ officeId }, { officeId: null }]
  };
}

function buildClientHandoffWhere(organizationId: string, viewerMembershipId: string) {
  return {
    organizationId,
    ownerMembershipId: viewerMembershipId,
    OR: handoffStagePatterns.map((pattern) => ({
      stage: {
        contains: pattern,
        mode: "insensitive" as const
      }
    }))
  };
}

export async function getFrontOfficeDashboardSnapshot(
  input: GetFrontOfficeDashboardSnapshotInput
): Promise<FrontOfficeDashboardSnapshot> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const sevenDaysFromNow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);

  const clientWhere: Prisma.ClientWhereInput = {
    organizationId: input.organizationId,
    ownerMembershipId: input.viewerMembershipId
  };

  const listingWhere: Prisma.ListingWhereInput = {
    organizationId: input.organizationId,
    status: {
      in: activeListingStatuses
    },
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {})
  };

  const resourceWhere: Prisma.ResourceWhereInput = {
    organizationId: input.organizationId,
    isPublished: true,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {})
  };

  const vendorWhere: Prisma.VendorWhereInput = {
    organizationId: input.organizationId,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {})
  };

  const notificationWhere: Prisma.NotificationWhereInput = {
    organizationId: input.organizationId,
    AND: [
      officeScopeFilter ?? {},
      {
        OR: [{ membershipId: input.viewerMembershipId }, { membershipId: null }]
      }
    ]
  };

  const commitmentWhere: Prisma.EventWhereInput = {
    organizationId: input.organizationId,
    startsAt: {
      gte: startOfToday,
      lte: sevenDaysFromNow
    },
    AND: [
      officeScopeFilter ?? {},
      {
        OR: [
          {
            visibility: "all_agents"
          },
          ...(input.officeId
            ? [
                {
                  visibility: "office_only" as const,
                  officeId: input.officeId
                }
              ]
            : []),
          {
            visibility: "invite_only",
            rsvps: {
              some: {
                membershipId: input.viewerMembershipId
              }
            }
          }
        ]
      }
    ]
  };

  const [dueFollowUpClients, openFollowUpTaskCount, stageGroups, recentClients, activeListingCount, recentListings, shareAggregate, upcomingEvents, notifications, resources, vendors, handoffClients, signatureTransactions] =
    await Promise.all([
      prisma.client.findMany({
        where: {
          ...clientWhere,
          nextFollowUpAt: {
            lt: startOfTomorrow
          }
        },
        orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
        take: 3,
        select: {
          id: true,
          fullName: true,
          source: true,
          stage: true,
          nextFollowUpAt: true,
          lastContactAt: true
        }
      }),
      prisma.followUpTask.count({
        where: {
          organizationId: input.organizationId,
          assigneeMemberId: input.viewerMembershipId,
          status: {
            in: [...openFollowUpStatuses]
          }
        }
      }),
      prisma.client.groupBy({
        by: ["stage"],
        where: clientWhere,
        _count: {
          _all: true
        }
      }),
      prisma.client.findMany({
        where: clientWhere,
        orderBy: [{ updatedAt: "desc" }],
        take: 4,
        select: {
          id: true,
          fullName: true,
          source: true,
          stage: true,
          nextFollowUpAt: true,
          lastContactAt: true
        }
      }),
      prisma.listing.count({
        where: listingWhere
      }),
      prisma.listing.findMany({
        where: listingWhere,
        orderBy: [{ updatedAt: "desc" }],
        take: 4,
        select: {
          id: true,
          title: true,
          neighborhood: true,
          city: true,
          price: true,
          status: true
        }
      }),
      prisma.listingShareLink.aggregate({
        where: {
          membershipId: input.viewerMembershipId,
          listing: {
            organizationId: input.organizationId,
            ...(officeScopeFilter ? officeScopeFilter : {})
          }
        },
        _count: {
          _all: true
        },
        _sum: {
          clickCount: true
        }
      }),
      prisma.event.findMany({
        where: commitmentWhere,
        orderBy: [{ startsAt: "asc" }],
        take: 4,
        select: {
          id: true,
          title: true,
          visibility: true,
          startsAt: true,
          location: true,
          meetingUrl: true,
          _count: {
            select: {
              rsvps: true
            }
          },
          rsvps: {
            where: {
              membershipId: input.viewerMembershipId
            },
            select: {
              status: true
            },
            take: 1
          }
        }
      }),
      prisma.notification.findMany({
        where: notificationWhere,
        orderBy: [{ createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          actionUrl: true,
          createdAt: true
        }
      }),
      prisma.resource.findMany({
        where: resourceWhere,
        orderBy: [{ updatedAt: "desc" }],
        take: 3,
        select: {
          id: true,
          type: true,
          title: true,
          summary: true,
          url: true
        }
      }),
      prisma.vendor.findMany({
        where: vendorWhere,
        orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
        take: 3,
        select: {
          id: true,
          category: true,
          name: true,
          headline: true,
          phone: true,
          email: true,
          website: true
        }
      }),
      prisma.client.findMany({
        where: buildClientHandoffWhere(input.organizationId, input.viewerMembershipId),
        orderBy: [{ updatedAt: "desc" }],
        take: 3,
        select: {
          id: true,
          fullName: true,
          stage: true,
          transactionContacts: {
            select: {
              id: true
            },
            take: 1
          },
          primaryTransactions: {
            select: {
              id: true
            },
            take: 1
          }
        }
      }),
      prisma.transaction.findMany({
        where: {
          organizationId: input.organizationId,
          ownerMembershipId: input.viewerMembershipId,
          status: {
            in: activeTransactionStatuses
          },
          signatureRequests: {
            some: {
              status: {
                in: openSignatureStatuses
              }
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 3,
        select: {
          id: true,
          title: true,
          address: true,
          signatureRequests: {
            where: {
              status: {
                in: openSignatureStatuses
              }
            },
            select: {
              status: true,
              recipientRole: true
            },
            take: 1
          }
        }
      })
    ]);

  const recentListingIds = recentListings.map((listing) => listing.id);
  const listingShareRows =
    recentListingIds.length > 0
      ? await prisma.listingShareLink.groupBy({
          by: ["listingId"],
          where: {
            membershipId: input.viewerMembershipId,
            listingId: {
              in: recentListingIds
            }
          },
          _count: {
            _all: true
          },
          _sum: {
            clickCount: true
          }
        })
      : [];

  const listingShareMap = new Map(
    listingShareRows.map((row) => [
      row.listingId,
      {
        count: row._count._all,
        clicks: row._sum.clickCount ?? 0
      }
    ])
  );

  const dueFollowUpCount = dueFollowUpClients.length;
  const todayCommitmentCount = upcomingEvents.filter((event) => event.startsAt >= startOfToday && event.startsAt < startOfTomorrow).length;
  const handoffCandidates = handoffClients.filter(
    (client) => client.transactionContacts.length === 0 && client.primaryTransactions.length === 0
  );
  const backOfficeItems: FrontOfficeDashboardBackOfficeItem[] = [
    ...handoffCandidates.map((client) => ({
      id: `handoff-client-${client.id}`,
      title: client.fullName,
      description: `${client.stage} is ready to become a formal transaction record.`,
      contextLabel: "Create transaction",
      tone: "warning" as const,
      actionLabel: "Open Back Office create flow",
      href: `/office/transactions/new`
    })),
    ...signatureTransactions.map((transaction) => ({
      id: `handoff-signature-${transaction.id}`,
      title: transaction.title,
      description: `${transaction.address} still has signature work in progress.`,
      contextLabel: transaction.signatureRequests[0]?.recipientRole
        ? `Signature · ${transaction.signatureRequests[0].recipientRole}`
        : "Signature follow-through",
      tone: "accent" as const,
      actionLabel: "Open forms & signatures",
      href: `/office/transactions/${transaction.id}#transaction-forms-signatures`
    }))
  ].slice(0, 4);
  const needsBackOfficeCount = handoffCandidates.length + signatureTransactions.length;
  const actionQueue: FrontOfficeDashboardActionQueueItem[] = [
    {
      id: "follow-up",
      label: "Follow up now",
      count: dueFollowUpCount,
      tone: dueFollowUpCount > 0 ? "warning" : "neutral",
      description:
        dueFollowUpClients.length > 0
          ? dueFollowUpClients.map((client) => client.fullName).join(" · ")
          : "No overdue or same-day follow-ups are waiting right now.",
      helper: `${openFollowUpTaskCount} open scheduled follow-up task(s) in your queue.`,
      href: "/agent/clients",
      actionLabel: "Open clients"
    },
    {
      id: "commitments",
      label: "Commitments today",
      count: todayCommitmentCount,
      tone: todayCommitmentCount > 0 ? "accent" : "neutral",
      description:
        todayCommitmentCount > 0
          ? `${todayCommitmentCount} office event or meeting item(s) land today.`
          : "No office commitments are scheduled for today.",
      helper: "Agent appointment scheduling is not live yet, so this card tracks visible commitments only.",
      href: "/agent/notifications",
      actionLabel: "Open activity"
    },
    {
      id: "content",
      label: "Content ready to send",
      count: activeListingCount,
      tone: activeListingCount > 0 ? "success" : "neutral",
      description:
        activeListingCount > 0
          ? `${activeListingCount} active or hot listing(s) are available for outreach.`
          : "No active listing inventory is currently available in this scope.",
      helper:
        shareAggregate._count._all > 0
          ? `${shareAggregate._count._all} tracked link(s) already created from this dashboard scope.`
          : "Tracked sending is ready for listings with existing share links.",
      href: "/agent/listings",
      actionLabel: "Open listings"
    },
    {
      id: "handoff",
      label: "Needs Back Office",
      count: needsBackOfficeCount,
      tone: needsBackOfficeCount > 0 ? "warning" : "neutral",
      description:
        needsBackOfficeCount > 0
          ? `${needsBackOfficeCount} item(s) should move into formal transaction or signature workflow.`
          : "Nothing is waiting for formal transaction or signature work right now.",
      helper: "Use this queue when a client, document, or signature step becomes an official record.",
      href: "/office/transactions",
      actionLabel: "Open Back Office"
    }
  ];

  return {
    summary: {
      todayActionCount: dueFollowUpCount + todayCommitmentCount + needsBackOfficeCount,
      followUpDueCount: dueFollowUpCount,
      todayCommitmentCount,
      needsBackOfficeCount
    },
    actionQueue,
    pipeline: {
      stageMetrics: stageGroups
        .sort((left, right) => right._count._all - left._count._all || left.stage.localeCompare(right.stage))
        .slice(0, 4)
        .map((stage) => ({
          label: stage.stage,
          count: stage._count._all,
          tone: mapClientStageTone(stage.stage)
        })),
      recentClients: recentClients.map((client) => ({
        id: client.id,
        fullName: client.fullName,
        stage: client.stage,
        stageTone: mapClientStageTone(client.stage),
        source: client.source,
        nextTouchLabel: formatRelativeDueLabel(client.nextFollowUpAt, now),
        lastTouchLabel: client.lastContactAt ? `Last contact · ${formatDateLabel(client.lastContactAt)}` : "No contact logged yet",
        href: "/agent/clients"
      }))
    },
    commitments: {
      items: upcomingEvents.map((event) => ({
        id: event.id,
        title: event.title,
        visibilityLabel: formatEventVisibilityLabel(event.visibility),
        startsAtLabel: formatDateTimeLabel(event.startsAt, { timeZone: input.timeZone }),
        locationLabel: event.location?.trim() || event.meetingUrl?.trim() || "Location pending",
        rsvpLabel:
          event.rsvps[0]?.status === "going"
            ? "You RSVP'd going"
            : event.rsvps[0]?.status === "maybe"
              ? "You RSVP'd maybe"
              : event.rsvps[0]?.status === "declined"
                ? "You declined"
                : `${event._count.rsvps} RSVP(s)`,
        href: "/agent/notifications"
      })),
      appointmentModuleReady: false,
      appointmentMessage:
        "Agent appointment scheduling is still a planned module. This section currently shows shared office commitments so the dashboard stays honest."
    },
    listingOutput: {
      activeListingCount,
      trackedLinkCount: shareAggregate._count._all,
      trackedClickCount: shareAggregate._sum.clickCount ?? 0,
      trackedSendingReady: shareAggregate._count._all > 0,
      recentListings: recentListings.map((listing) => {
        const shareMetrics = listingShareMap.get(listing.id);

        return {
          id: listing.id,
          title: listing.title,
          neighborhoodLabel: `${listing.neighborhood}, ${listing.city}`,
          priceLabel: formatCurrency(listing.price),
          statusLabel: formatListingStatus(listing.status),
          statusTone: mapListingStatusTone(listing.status),
          trackedLinkCount: shareMetrics?.count ?? 0,
          trackedClickCount: shareMetrics?.clicks ?? 0,
          href: "/agent/listings"
        };
      })
    },
    noticeRail: {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        typeLabel: formatNotificationType(notification.type),
        createdAtLabel: formatDateTimeLabel(notification.createdAt, { timeZone: input.timeZone }),
        href: notification.actionUrl?.trim() || "/agent/notifications"
      })),
      resources: resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        typeLabel: formatResourceType(resource.type),
        summary: resource.summary,
        href: resource.url
      })),
      vendors: vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        headline: vendor.headline,
        contactLabel: vendor.phone?.trim() || vendor.website?.trim() || vendor.email?.trim() || "Open vendor profile",
        href: vendor.website?.trim() || (vendor.phone?.trim() ? `tel:${vendor.phone.trim()}` : vendor.email?.trim() ? `mailto:${vendor.email.trim()}` : null)
      }))
    },
    backOffice: {
      items: backOfficeItems
    }
  };
}
