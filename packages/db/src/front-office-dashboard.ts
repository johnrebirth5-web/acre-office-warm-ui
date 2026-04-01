import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  ListingStatus,
  MembershipStatus,
  NotificationType,
  Prisma,
  ResourceType,
  SignatureRequestStatus,
  TaskStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import { buildFrontOfficeHandoffCreateHref } from "./front-office-contracts";
import {
  buildTeamMembershipHierarchyMap,
  isLeaderTeamMembershipRole,
} from "./team-hierarchy";

export type FrontOfficeDashboardTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type FrontOfficeDashboardSummary = {
  todayActionCount: number;
  followUpDueCount: number;
  overdueTaskCount: number;
  staleClientCount: number;
  todayCommitmentCount: number;
  needsBackOfficeCount: number;
  leadershipPressureCount: number;
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
  badgeLabel: string;
  badgeTone: FrontOfficeDashboardTone;
  startsAtLabel: string;
  locationLabel: string;
  contextLabel: string;
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

export type FrontOfficeDashboardEngagementItem = {
  id: string;
  clientName: string;
  listingTitle: string;
  channelLabel: string;
  sentAtLabel: string;
  engagementLabel: string;
  engagementTone: FrontOfficeDashboardTone;
  detailLabel: string;
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

export type FrontOfficeDashboardLeadershipItem = {
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
    sendRecordCount: number;
    openedSendCount: number;
    engagedClientCount: number;
    recentListings: FrontOfficeDashboardListingItem[];
    recentEngagement: FrontOfficeDashboardEngagementItem[];
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
  leadershipQueue: {
    visible: boolean;
    scopeLabel: string;
    overdueTaskCount: number;
    staleClientCount: number;
    items: FrontOfficeDashboardLeadershipItem[];
  };
};

type GetFrontOfficeDashboardSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  viewerRole: UserRole;
  officeId?: string | null;
  timeZone?: string | null;
};

const openFollowUpStatuses: TaskStatus[] = [
  TaskStatus.queued,
  TaskStatus.in_progress,
];
const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];
const activeTransactionStatuses: TransactionStatus[] = [
  TransactionStatus.pending,
  TransactionStatus.active,
];
const openSignatureStatuses: SignatureRequestStatus[] = [
  SignatureRequestStatus.draft,
  SignatureRequestStatus.pending_send,
  SignatureRequestStatus.sent,
  SignatureRequestStatus.viewed,
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

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "—";
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDueLabel(value: Date | null | undefined, now: Date) {
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

function formatFrontOfficeSendChannelLabel(channel: string) {
  switch (channel.trim().toLowerCase()) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    default:
      return "Direct link";
  }
}

function mapFrontOfficeSendEngagementTone(
  openCount: number,
): FrontOfficeDashboardTone {
  if (openCount <= 0) {
    return "neutral";
  }

  if (openCount === 1) {
    return "success";
  }

  return "accent";
}

function buildFrontOfficeSendEngagementLabel(openCount: number) {
  if (openCount <= 0) {
    return "Not opened";
  }

  if (openCount === 1) {
    return "Opened";
  }

  return `Revisited ${openCount} times`;
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

function formatAppointmentTypeLabel(type: AppointmentType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapAppointmentTypeTone(
  type: AppointmentType,
): FrontOfficeDashboardTone {
  if (type === AppointmentType.showing || type === AppointmentType.open_house) {
    return "accent";
  }

  if (type === AppointmentType.consultation) {
    return "success";
  }

  if (type === AppointmentType.client_meeting) {
    return "warning";
  }

  return "neutral";
}

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function isClosedClientStage(stage: string) {
  const normalized = stage.trim().toLowerCase();
  return normalized.includes("won") || normalized.includes("lost");
}

async function getLeadershipScopeMembershipIds(input: {
  organizationId: string;
  viewerMembershipId: string;
  viewerRole: UserRole;
  officeId?: string | null;
}) {
  if (input.viewerRole === "team_lead") {
    const teams = await prisma.team.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        parentTeamId: true,
      },
    });
    const teamMemberships = await prisma.teamMembership.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }],
            }
          : {}),
      },
      select: {
        id: true,
        membershipId: true,
        teamId: true,
        role: true,
        reportsToTeamMembershipId: true,
        membership: {
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
    });

    const hierarchy = buildTeamMembershipHierarchyMap({
      teams,
      teamMemberships: teamMemberships.map((membership) => ({
        id: membership.id,
        membershipId: membership.membershipId,
        teamId: membership.teamId,
        role: membership.role,
        reportsToTeamMembershipId: membership.reportsToTeamMembershipId,
        label:
          `${membership.membership.user.firstName} ${membership.membership.user.lastName}`.trim() ||
          membership.membership.user.email ||
          membership.membershipId,
      })),
    });

    const viewerLeaderMemberships = teamMemberships.filter(
      (membership) =>
        membership.membershipId === input.viewerMembershipId &&
        isLeaderTeamMembershipRole(membership.role),
    );
    const membershipIds = new Set<string>();

    for (const membership of viewerLeaderMemberships) {
      const hierarchyRecord = hierarchy.hierarchyMap.get(membership.id);

      for (const branchMembershipId of hierarchyRecord?.branchMembershipIds ??
        []) {
        if (branchMembershipId !== input.viewerMembershipId) {
          membershipIds.add(branchMembershipId);
        }
      }
    }

    return {
      visible: true,
      scopeLabel: "Team follow-up pressure",
      membershipIds: [...membershipIds],
    };
  }

  if (input.viewerRole === "office_admin" || input.viewerRole === "owner") {
    const memberships = await prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        role: {
          in: [UserRole.agent, UserRole.team_lead],
        },
        status: MembershipStatus.active,
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }],
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    return {
      visible: true,
      scopeLabel: "Office follow-up pressure",
      membershipIds: memberships
        .map((membership) => membership.id)
        .filter((membershipId) => membershipId !== input.viewerMembershipId),
    };
  }

  return {
    visible: false,
    scopeLabel: "",
    membershipIds: [] as string[],
  };
}

export async function getFrontOfficeDashboardSnapshot(
  input: GetFrontOfficeDashboardSnapshotInput,
): Promise<FrontOfficeDashboardSnapshot> {
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
  const sevenDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 7,
  );
  const fifteenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 15,
  );
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const leadershipScope = await getLeadershipScopeMembershipIds({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    viewerRole: input.viewerRole,
    officeId: input.officeId ?? null,
  });

  const clientWhere: Prisma.ClientWhereInput = {
    organizationId: input.organizationId,
    ownerMembershipId: input.viewerMembershipId,
  };

  const listingWhere: Prisma.ListingWhereInput = {
    organizationId: input.organizationId,
    status: {
      in: activeListingStatuses,
    },
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
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

  const resourceWhere: Prisma.ResourceWhereInput = {
    organizationId: input.organizationId,
    isPublished: true,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const vendorWhere: Prisma.VendorWhereInput = {
    organizationId: input.organizationId,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
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

  const commitmentWhere: Prisma.EventWhereInput = {
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

  const [
    dueFollowUpClients,
    openFollowUpTaskCount,
    overdueFollowUpTaskCount,
    staleClientCount,
    stageGroups,
    recentClients,
    activeListingCount,
    recentListings,
    shareAggregate,
    sendRecordCount,
    openedSendCount,
    engagedClientRows,
    recentSendRecords,
    upcomingEvents,
    upcomingAppointments,
    notifications,
    resources,
    vendors,
    handoffDraftCount,
    handoffDrafts,
    signatureTransactions,
    leadershipOverdueTaskCount,
    leadershipOverdueTasks,
    leadershipStaleClientCandidates,
  ] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...clientWhere,
        nextFollowUpAt: {
          lt: startOfTomorrow,
        },
      },
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        fullName: true,
        source: true,
        stage: true,
        nextFollowUpAt: true,
        lastContactAt: true,
      },
    }),
    prisma.followUpTask.count({
      where: {
        organizationId: input.organizationId,
        assigneeMemberId: input.viewerMembershipId,
        status: {
          in: [...openFollowUpStatuses],
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
    prisma.client.count({
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
    }),
    prisma.client.groupBy({
      by: ["stage"],
      where: clientWhere,
      _count: {
        _all: true,
      },
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
        lastContactAt: true,
      },
    }),
    prisma.listing.count({
      where: listingWhere,
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
        status: true,
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
    prisma.frontOfficeSendRecord.count({
      where: sendRecordWhere,
    }),
    prisma.frontOfficeSendRecord.count({
      where: {
        ...sendRecordWhere,
        openCount: {
          gt: 0,
        },
      },
    }),
    prisma.frontOfficeSendRecord.groupBy({
      by: ["clientId"],
      where: {
        ...sendRecordWhere,
        openCount: {
          gt: 0,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.frontOfficeSendRecord.findMany({
      where: sendRecordWhere,
      orderBy: [{ sentAt: "desc" }],
      take: 4,
      select: {
        id: true,
        channel: true,
        sentAt: true,
        lastOpenedAt: true,
        openCount: true,
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
        listing: {
          select: {
            title: true,
          },
        },
      },
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
            rsvps: true,
          },
        },
        rsvps: {
          where: {
            membershipId: input.viewerMembershipId,
          },
          select: {
            status: true,
          },
          take: 1,
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        startsAt: {
          gte: startOfToday,
          lte: sevenDaysFromNow,
        },
      },
      orderBy: [{ startsAt: "asc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        location: true,
        meetingUrl: true,
        client: {
          select: {
            fullName: true,
          },
        },
        listing: {
          select: {
            title: true,
          },
        },
      },
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
        createdAt: true,
      },
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
        url: true,
      },
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
        website: true,
      },
    }),
    prisma.frontOfficeHandoffDraft.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: [FrontOfficeHandoffStatus.draft, FrontOfficeHandoffStatus.ready],
        },
        committedTransactionId: null,
        AND: [
          officeScopeFilter ?? {},
          {
            client: {
              primaryTransactions: {
                none: {},
              },
              transactionContacts: {
                none: {},
              },
            },
          },
        ],
      },
    }),
    prisma.frontOfficeHandoffDraft.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: [FrontOfficeHandoffStatus.draft, FrontOfficeHandoffStatus.ready],
        },
        committedTransactionId: null,
        AND: [
          officeScopeFilter ?? {},
          {
            client: {
              primaryTransactions: {
                none: {},
              },
              transactionContacts: {
                none: {},
              },
            },
          },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        stageLabel: true,
        summary: true,
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: activeTransactionStatuses,
        },
        signatureRequests: {
          some: {
            status: {
              in: openSignatureStatuses,
            },
          },
        },
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
              in: openSignatureStatuses,
            },
          },
          select: {
            status: true,
            recipientRole: true,
          },
          take: 1,
        },
      },
    }),
    leadershipScope.visible && leadershipScope.membershipIds.length > 0
      ? prisma.followUpTask.count({
          where: {
            organizationId: input.organizationId,
            assigneeMemberId: {
              in: leadershipScope.membershipIds,
            },
            status: {
              in: [...openFollowUpStatuses],
            },
            dueAt: {
              lt: now,
            },
          },
        })
      : Promise.resolve(0),
    leadershipScope.visible && leadershipScope.membershipIds.length > 0
      ? prisma.followUpTask.findMany({
          where: {
            organizationId: input.organizationId,
            assigneeMemberId: {
              in: leadershipScope.membershipIds,
            },
            status: {
              in: [...openFollowUpStatuses],
            },
            dueAt: {
              lt: now,
            },
          },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "asc" }],
          take: 3,
          select: {
            id: true,
            title: true,
            dueAt: true,
            clientId: true,
            client: {
              select: {
                fullName: true,
              },
            },
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
    leadershipScope.visible && leadershipScope.membershipIds.length > 0
      ? prisma.client.findMany({
          where: {
            organizationId: input.organizationId,
            ownerMembershipId: {
              in: leadershipScope.membershipIds,
            },
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
          select: {
            id: true,
            fullName: true,
            stage: true,
            lastContactAt: true,
            createdAt: true,
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
          },
        })
      : Promise.resolve([]),
  ]);

  const recentListingIds = recentListings.map((listing) => listing.id);
  const listingShareRows =
    recentListingIds.length > 0
      ? await prisma.listingShareLink.groupBy({
          by: ["listingId"],
          where: {
            membershipId: input.viewerMembershipId,
            listingId: {
              in: recentListingIds,
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

  const dueFollowUpCount = dueFollowUpClients.length;
  const filteredLeadershipStaleClients = leadershipStaleClientCandidates.filter(
    (client) => !isClosedClientStage(client.stage),
  );
  const leadershipStaleClientCount = filteredLeadershipStaleClients.length;
  const leadershipItems: FrontOfficeDashboardLeadershipItem[] = [
    ...leadershipOverdueTasks.map((task) => ({
      id: `leadership-task-${task.id}`,
      title: task.client?.fullName ?? task.title,
      description: `${task.title} · Due ${formatDateLabel(task.dueAt)}`,
      contextLabel:
        `${task.assigneeMembership?.user.firstName ?? ""} ${task.assigneeMembership?.user.lastName ?? ""}`.trim() ||
        task.assigneeMembership?.user.email ||
        "Assigned team member",
      tone: "danger" as const,
      actionLabel: "Open office contact",
      href: task.clientId
        ? `/office/contacts/${task.clientId}`
        : "/office/contacts",
    })),
    ...filteredLeadershipStaleClients.slice(0, 3).map((client) => {
      const inactiveDays = Math.max(
        15,
        Math.floor(
          (now.getTime() -
            (client.lastContactAt ?? client.createdAt).getTime()) /
            86_400_000,
        ),
      );

      return {
        id: `leadership-client-${client.id}`,
        title: client.fullName,
        description: `${client.stage} · ${inactiveDays} day(s) since the last recorded touch.`,
        contextLabel:
          `${client.ownerMembership?.user.firstName ?? ""} ${client.ownerMembership?.user.lastName ?? ""}`.trim() ||
          client.ownerMembership?.user.email ||
          "Assigned owner",
        tone: "warning" as const,
        actionLabel: "Open office contact",
        href: `/office/contacts/${client.id}`,
      };
    }),
  ].slice(0, 4);
  const todayEventCount = upcomingEvents.filter(
    (event) =>
      event.startsAt >= startOfToday && event.startsAt < startOfTomorrow,
  ).length;
  const todayAppointmentCount = upcomingAppointments.filter(
    (appointment) =>
      appointment.startsAt >= startOfToday &&
      appointment.startsAt < startOfTomorrow,
  ).length;
  const todayCommitmentCount = todayEventCount + todayAppointmentCount;
  const backOfficeItems: FrontOfficeDashboardBackOfficeItem[] = [
    ...handoffDrafts.map((draft) => ({
      id: `handoff-client-${draft.id}`,
      title: draft.client.fullName,
      description:
        draft.summary?.trim() ||
        `${draft.stageLabel} is ready to become a formal transaction record.`,
      contextLabel: "Create transaction",
      tone: "warning" as const,
      actionLabel: "Open Back Office create flow",
      href: buildFrontOfficeHandoffCreateHref(draft.id),
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
      href: `/office/transactions/${transaction.id}#transaction-forms-signatures`,
    })),
  ].slice(0, 4);
  const needsBackOfficeCount = handoffDraftCount + signatureTransactions.length;
  const leadershipPressureCount =
    leadershipOverdueTaskCount + leadershipStaleClientCount;
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
      actionLabel: "Open clients",
    },
    {
      id: "commitments",
      label: "Commitments today",
      count: todayCommitmentCount,
      tone: todayCommitmentCount > 0 ? "accent" : "neutral",
      description:
        todayCommitmentCount > 0
          ? `${todayAppointmentCount} appointment(s) and ${todayEventCount} shared office event(s) land today.`
          : "No appointments or shared office commitments are scheduled for today.",
      helper:
        "Your own Front Office appointments now live here alongside shared office events.",
      href: "/agent/calendar",
      actionLabel: "Open calendar",
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
      actionLabel: "Open listings",
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
      helper:
        "Use this queue when a client, document, or signature step becomes an official record.",
      href: "/office/transactions",
      actionLabel: "Open Back Office",
    },
    ...(leadershipScope.visible
      ? [
          {
            id: "leadership",
            label:
              input.viewerRole === "team_lead"
                ? "Team follow-up pressure"
                : "Office follow-up pressure",
            count: leadershipPressureCount,
            tone: leadershipPressureCount > 0 ? "danger" : "neutral",
            description:
              leadershipPressureCount > 0
                ? `${leadershipOverdueTaskCount} overdue task(s) and ${leadershipStaleClientCount} stale client(s) need leadership attention.`
                : "No overdue or 15+ day stale follow-up pressure is visible in your leadership scope right now.",
            helper:
              "Leadership visibility should surface team risk before it turns into a formal Back Office problem.",
            href: "/office/contacts",
            actionLabel:
              input.viewerRole === "team_lead"
                ? "Open team contacts"
                : "Open office contacts",
          } satisfies FrontOfficeDashboardActionQueueItem,
        ]
      : []),
  ];

  return {
    summary: {
      todayActionCount:
        dueFollowUpCount +
        todayCommitmentCount +
        needsBackOfficeCount +
        leadershipPressureCount,
      followUpDueCount: dueFollowUpCount,
      overdueTaskCount: overdueFollowUpTaskCount,
      staleClientCount,
      todayCommitmentCount,
      needsBackOfficeCount,
      leadershipPressureCount,
    },
    actionQueue,
    pipeline: {
      stageMetrics: stageGroups
        .sort(
          (left, right) =>
            right._count._all - left._count._all ||
            left.stage.localeCompare(right.stage),
        )
        .slice(0, 4)
        .map((stage) => ({
          label: stage.stage,
          count: stage._count._all,
          tone: mapClientStageTone(stage.stage),
        })),
      recentClients: recentClients.map((client) => ({
        id: client.id,
        fullName: client.fullName,
        stage: client.stage,
        stageTone: mapClientStageTone(client.stage),
        source: client.source,
        nextTouchLabel: formatRelativeDueLabel(client.nextFollowUpAt, now),
        lastTouchLabel: client.lastContactAt
          ? `Last contact · ${formatDateLabel(client.lastContactAt)}`
          : "No contact logged yet",
        href: `/agent/clients/${client.id}`,
      })),
    },
    commitments: {
      items: [
        ...upcomingAppointments.map((appointment) => ({
          sortAt: appointment.startsAt,
          item: {
            id: `appointment-${appointment.id}`,
            title: appointment.title,
            badgeLabel: formatAppointmentTypeLabel(appointment.type),
            badgeTone: mapAppointmentTypeTone(appointment.type),
            startsAtLabel: formatDateTimeLabel(appointment.startsAt, {
              timeZone: input.timeZone,
            }),
            locationLabel:
              appointment.location?.trim() ||
              appointment.meetingUrl?.trim() ||
              "Location pending",
            contextLabel: appointment.client?.fullName
              ? `Client · ${appointment.client.fullName}`
              : appointment.listing?.title
                ? `Listing · ${appointment.listing.title}`
                : "Front Office appointment",
            href: "/agent/calendar",
          },
        })),
        ...upcomingEvents.map((event) => ({
          sortAt: event.startsAt,
          item: {
            id: `event-${event.id}`,
            title: event.title,
            badgeLabel: "Office event",
            badgeTone: "neutral" as const,
            startsAtLabel: formatDateTimeLabel(event.startsAt, {
              timeZone: input.timeZone,
            }),
            locationLabel:
              event.location?.trim() ||
              event.meetingUrl?.trim() ||
              "Location pending",
            contextLabel:
              event.rsvps[0]?.status === "going"
                ? "You RSVP'd going"
                : event.rsvps[0]?.status === "maybe"
                  ? "You RSVP'd maybe"
                  : event.rsvps[0]?.status === "declined"
                    ? "You declined"
                    : `${formatEventVisibilityLabel(event.visibility)} · ${event._count.rsvps} RSVP(s)`,
            href: "/agent/notifications",
          },
        })),
      ]
        .sort((left, right) => left.sortAt.getTime() - right.sortAt.getTime())
        .slice(0, 4)
        .map((entry) => entry.item),
      appointmentModuleReady: true,
      appointmentMessage:
        todayAppointmentCount > 0
          ? `${todayAppointmentCount} Front Office appointment(s) are on your calendar today. Shared office events still stay visible so the workday does not fragment.`
          : "Front Office appointment scheduling is now live. Shared office events still stay visible here when the office publishes commitments.",
    },
    listingOutput: {
      activeListingCount,
      trackedLinkCount: shareAggregate._count._all,
      trackedClickCount: shareAggregate._sum.clickCount ?? 0,
      sendRecordCount,
      openedSendCount,
      engagedClientCount: engagedClientRows.length,
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
          href: "/agent/listings",
        };
      }),
      recentEngagement: recentSendRecords.map((record) => ({
        id: record.id,
        clientName: record.client.fullName,
        listingTitle:
          record.listing?.title?.trim() || "Front Office material send",
        channelLabel: formatFrontOfficeSendChannelLabel(record.channel),
        sentAtLabel: formatDateTimeLabel(record.sentAt, {
          timeZone: input.timeZone ?? null,
        }),
        engagementLabel: buildFrontOfficeSendEngagementLabel(record.openCount),
        engagementTone: mapFrontOfficeSendEngagementTone(record.openCount),
        detailLabel:
          record.lastOpenedAt && record.openCount > 0
            ? `Last opened · ${formatDateTimeLabel(record.lastOpenedAt, {
                timeZone: input.timeZone ?? null,
              })}`
            : "No open recorded yet",
        href: `/agent/clients/${record.client.id}`,
      })),
    },
    noticeRail: {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        typeLabel: formatNotificationType(notification.type),
        createdAtLabel: formatDateTimeLabel(notification.createdAt, {
          timeZone: input.timeZone,
        }),
        href: notification.actionUrl?.trim() || "/agent/notifications",
      })),
      resources: resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        typeLabel: formatResourceType(resource.type),
        summary: resource.summary,
        href: resource.url,
      })),
      vendors: vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        headline: vendor.headline,
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
    },
    backOffice: {
      items: backOfficeItems,
    },
    leadershipQueue: {
      visible: leadershipScope.visible,
      scopeLabel: leadershipScope.scopeLabel,
      overdueTaskCount: leadershipOverdueTaskCount,
      staleClientCount: leadershipStaleClientCount,
      items: leadershipItems,
    },
  };
}
