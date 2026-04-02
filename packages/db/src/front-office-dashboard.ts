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
import {
  buildFrontOfficeAiFollowUpAction,
  buildFrontOfficeAiSuggestionHistoryIndex,
  buildFrontOfficeAiSuggestionInsight,
  formatFrontOfficeAiActionTypeLabel,
  formatFrontOfficeAiSourceSurfaceLabel,
  mapFrontOfficeAiAcceptedActionOutcome,
  type FrontOfficeAiFollowUpKind,
} from "./front-office-ai";
import {
  buildFrontOfficeHandoffCreateHref,
  isFrontOfficeStageReadyForBackOffice,
} from "./front-office-contracts";
import { resolveLeaseReminderDates } from "./lease-reminders";
import { reconcileOfficeNotificationReminders } from "./notifications";
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
  leaseReminderCount: number;
  overdueTaskCount: number;
  staleClientCount: number;
  todayCommitmentCount: number;
  needsBackOfficeCount: number;
  leadershipPressureCount: number;
  aiSuggestionCount: number;
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
  stageLabel: string;
  appointmentLabel: string;
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

export type FrontOfficeDashboardLeaseReminderItem = {
  id: string;
  clientName: string;
  statusLabel: string;
  tone: FrontOfficeDashboardTone;
  reminderLabel: string;
  detailLabel: string;
  href: string;
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

export type FrontOfficeDashboardAiQueueItem = {
  id: string;
  clientId: string;
  clientName: string;
  suggestionKind: FrontOfficeAiFollowUpKind;
  statusLabel: string;
  tone: FrontOfficeDashboardTone;
  description: string;
  contextLabel: string;
  helperLabel: string;
  openDossierHref: string;
  followUpTitle: string;
  followUpDueAt: string;
  allowsDirectFollowUpCreation: boolean;
};

export type FrontOfficeDashboardAiAcceptedActionItem = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  statusLabel: string;
  statusTone: FrontOfficeDashboardTone;
  description: string;
  contextLabel: string;
  helperLabel: string;
  href: string;
  actionLabel: string;
};

type FrontOfficeDashboardLeadershipEngagementItem =
  FrontOfficeDashboardLeadershipItem & {
    _priority: number;
    _sortAt: Date;
  };

type FrontOfficeDashboardAiCandidateItem = Omit<
  FrontOfficeDashboardAiQueueItem,
  "allowsDirectFollowUpCreation"
> & {
  _priority: number;
  _sortAt: Date;
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
  leaseReminders: {
    dueCount: number;
    overdueCount: number;
    items: FrontOfficeDashboardLeaseReminderItem[];
  };
  aiQueue: {
    suggestionCount: number;
    items: FrontOfficeDashboardAiQueueItem[];
  };
  aiAcceptedActions: {
    acceptedCount: number;
    positiveOutcomeCount: number;
    items: FrontOfficeDashboardAiAcceptedActionItem[];
  };
  backOffice: {
    items: FrontOfficeDashboardBackOfficeItem[];
  };
  leadershipQueue: {
    visible: boolean;
    scopeLabel: string;
    overdueTaskCount: number;
    staleClientCount: number;
    engagementRiskCount: number;
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

function buildLeaseReminderStatus(input: {
  leaseEndDate: Date | null;
  leaseReminderAt: Date | null;
  now: Date;
}) {
  const leaseDates = resolveLeaseReminderDates({
    leaseEndDate: input.leaseEndDate,
    leaseReminderAt: input.leaseReminderAt,
  });
  const startOfToday = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate(),
  );
  const startOfTomorrow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 1,
  );
  const fourteenDaysFromNow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 14,
  );

  if (!leaseDates.leaseReminderAt) {
    return {
      reminderAt: null,
      statusLabel: "No reminder",
      tone: "neutral" as const,
      detailLabel: "No lease reminder is scheduled.",
    };
  }

  if (leaseDates.leaseReminderAt.getTime() < startOfToday.getTime()) {
    return {
      reminderAt: leaseDates.leaseReminderAt,
      statusLabel: "Overdue",
      tone: "danger" as const,
      detailLabel: leaseDates.leaseEndDate
        ? `Lease end ${formatDateLabel(leaseDates.leaseEndDate)}`
        : "Lease follow-up is already late.",
    };
  }

  if (leaseDates.leaseReminderAt.getTime() < startOfTomorrow.getTime()) {
    return {
      reminderAt: leaseDates.leaseReminderAt,
      statusLabel: "Due today",
      tone: "warning" as const,
      detailLabel: leaseDates.leaseEndDate
        ? `Lease end ${formatDateLabel(leaseDates.leaseEndDate)}`
        : "Renewal or remarketing touch is due today.",
    };
  }

  if (leaseDates.leaseReminderAt.getTime() <= fourteenDaysFromNow.getTime()) {
    return {
      reminderAt: leaseDates.leaseReminderAt,
      statusLabel: "Due soon",
      tone: "accent" as const,
      detailLabel: leaseDates.leaseEndDate
        ? `Lease end ${formatDateLabel(leaseDates.leaseEndDate)}`
        : "Lease-related follow-up is coming up soon.",
    };
  }

  return {
    reminderAt: leaseDates.leaseReminderAt,
    statusLabel: "Scheduled",
    tone: "success" as const,
    detailLabel: leaseDates.leaseEndDate
      ? `Lease end ${formatDateLabel(leaseDates.leaseEndDate)}`
      : "Lease reminder is already on the calendar.",
  };
}

function formatNextTouchLabel(input: {
  nextFollowUpAt: Date | null;
  leaseReminderAt: Date | null;
  now: Date;
}) {
  const leaseReminder = buildLeaseReminderStatus({
    leaseEndDate: null,
    leaseReminderAt: input.leaseReminderAt,
    now: input.now,
  });

  if (
    leaseReminder.reminderAt &&
    (!input.nextFollowUpAt ||
      leaseReminder.reminderAt.getTime() <= input.nextFollowUpAt.getTime())
  ) {
    if (leaseReminder.statusLabel === "Overdue") {
      return `Lease reminder overdue since ${formatDateLabel(leaseReminder.reminderAt)}`;
    }

    if (leaseReminder.statusLabel === "Due today") {
      return `Lease reminder · ${formatDateTimeLabel(leaseReminder.reminderAt, { timeZone: null })}`;
    }

    return `Lease reminder · ${formatDateLabel(leaseReminder.reminderAt)}`;
  }

  return formatRelativeDueLabel(input.nextFollowUpAt, input.now);
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

function formatSendRecordStageLabel(value: string | null | undefined) {
  return value?.trim() || "Stage not captured";
}

function buildSendRecordAppointmentLabel(input: {
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

function buildMembershipUserLabel(
  user:
    | {
        firstName: string | null | undefined;
        lastName: string | null | undefined;
        email: string | null | undefined;
      }
    | null
    | undefined,
  fallback: string,
) {
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  if (fullName) {
    return fullName;
  }

  if (user?.email?.trim()) {
    return user.email.trim();
  }

  return fallback;
}

function buildElapsedDayCount(value: Date, now: Date, minimum = 1) {
  return Math.max(
    minimum,
    Math.floor((now.getTime() - value.getTime()) / 86_400_000),
  );
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
      scopeLabel: "Team execution pressure",
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
      scopeLabel: "Office execution pressure",
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
  const fourteenDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 14,
  );
  const thirtyDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 30,
  );
  const fifteenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 15,
  );
  const ninetyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 90,
  );
  const thirtyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 30,
  );
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const leadershipScope = await getLeadershipScopeMembershipIds({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    viewerRole: input.viewerRole,
    officeId: input.officeId ?? null,
  });
  const leadershipSendWhere: Prisma.FrontOfficeSendRecordWhereInput | null =
    leadershipScope.visible && leadershipScope.membershipIds.length > 0
      ? {
          organizationId: input.organizationId,
          senderMembershipId: {
            in: leadershipScope.membershipIds,
          },
          sentAt: {
            gte: thirtyDaysAgo,
          },
          ...(input.officeId
            ? {
                officeId: input.officeId,
              }
            : {}),
        }
      : null;

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
    dueLeaseReminderClients,
    overdueLeaseReminderCount,
    openFollowUpTaskCount,
    overdueFollowUpTaskCount,
    staleClientCount,
    stageGroups,
    recentClients,
    aiSuggestionCandidates,
    aiAcceptedActionCount,
    aiPositiveOutcomeCount,
    recentAiAcceptedActions,
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
    leadershipLatestSendGroups,
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
        leaseReminderAt: true,
        lastContactAt: true,
      },
    }),
    prisma.client.findMany({
      where: {
        ...clientWhere,
        leaseReminderAt: {
          lte: thirtyDaysFromNow,
        },
      },
      orderBy: [{ leaseReminderAt: "asc" }, { updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        fullName: true,
        leaseEndDate: true,
        leaseReminderAt: true,
      },
    }),
    prisma.client.count({
      where: {
        ...clientWhere,
        leaseReminderAt: {
          lt: startOfToday,
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
        leaseReminderAt: true,
        lastContactAt: true,
      },
    }),
    prisma.client.findMany({
      where: clientWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        fullName: true,
        stage: true,
        nextFollowUpAt: true,
        leaseEndDate: true,
        leaseReminderAt: true,
        lastContactAt: true,
        createdAt: true,
        appointments: {
          where: {
            status: AppointmentStatus.scheduled,
            startsAt: {
              gte: startOfToday,
              lte: fourteenDaysFromNow,
            },
          },
          orderBy: [{ startsAt: "asc" }],
          take: 1,
          select: {
            id: true,
            title: true,
            type: true,
            startsAt: true,
          },
        },
        frontOfficeSendRecords: {
          orderBy: [{ sentAt: "desc" }],
          take: 1,
          select: {
            id: true,
            sentAt: true,
            openCount: true,
            lastOpenedAt: true,
            listing: {
              select: {
                title: true,
              },
            },
          },
        },
        handoffDrafts: {
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            committedTransactionId: true,
            summary: true,
          },
        },
        transactionContacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
          select: {
            transaction: {
              select: {
                id: true,
                status: true,
                acceptanceDate: true,
                closingDate: true,
                moveInDate: true,
              },
            },
          },
        },
      },
    }),
    prisma.frontOfficeAiAcceptedAction.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
      },
    }),
    prisma.frontOfficeAiAcceptedAction.count({
      where: {
        organizationId: input.organizationId,
        membershipId: input.viewerMembershipId,
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
        createdAt: {
          gte: ninetyDaysAgo,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        actionType: true,
        sourceSurface: true,
        suggestionKind: true,
        suggestionLabel: true,
        actionTitle: true,
        channel: true,
        createdAt: true,
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
    leadershipSendWhere
      ? prisma.frontOfficeSendRecord.groupBy({
          by: ["clientId"],
          where: leadershipSendWhere,
          _max: {
            sentAt: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const aiHistoryIndex = buildFrontOfficeAiSuggestionHistoryIndex({
    actions: recentAiAcceptedActions.map((action) => ({
      clientId: action.client.id,
      suggestionKind: action.suggestionKind,
      actionType: action.actionType,
      createdAt: action.createdAt,
      followUpTask: action.followUpTask,
      sendRecord: action.sendRecord,
    })),
    now,
    timeZone: input.timeZone,
  });
  const recentAiAcceptedActionItems = recentAiAcceptedActions.slice(0, 4);

  const leadershipLatestSendRecordFilters = leadershipLatestSendGroups
    .flatMap((group) =>
      group._max.sentAt
        ? [
            {
              clientId: group.clientId,
              sentAt: group._max.sentAt,
            },
          ]
        : [],
    );
  const leadershipLatestSendRecords =
    leadershipSendWhere && leadershipLatestSendRecordFilters.length > 0
      ? await prisma.frontOfficeSendRecord.findMany({
          where: {
            AND: [leadershipSendWhere, { OR: leadershipLatestSendRecordFilters }],
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
            senderMembership: {
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
            client: {
              select: {
                id: true,
                fullName: true,
                stage: true,
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
            },
            listing: {
              select: {
                title: true,
              },
            },
          },
        })
      : [];

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
  const leaseReminderItems: FrontOfficeDashboardLeaseReminderItem[] =
    dueLeaseReminderClients.flatMap((client) => {
      const leaseReminder = buildLeaseReminderStatus({
        leaseEndDate: client.leaseEndDate,
        leaseReminderAt: client.leaseReminderAt,
        now,
      });

      if (!leaseReminder.reminderAt) {
        return [];
      }

      return [
        {
          id: client.id,
          clientName: client.fullName,
          statusLabel: leaseReminder.statusLabel,
          tone: leaseReminder.tone,
          reminderLabel:
            leaseReminder.statusLabel === "Due today"
              ? formatDateTimeLabel(leaseReminder.reminderAt, {
                  timeZone: null,
                })
              : formatDateLabel(leaseReminder.reminderAt),
          detailLabel: leaseReminder.detailLabel,
          href: `/agent/clients/${client.id}`,
        },
      ];
    });
  const dueLeaseReminderCount = dueLeaseReminderClients.filter((client) => {
    if (!client.leaseReminderAt) {
      return false;
    }

    return client.leaseReminderAt.getTime() <= fourteenDaysFromNow.getTime();
  }).length;
  const filteredLeadershipStaleClients = leadershipStaleClientCandidates.filter(
    (client) => !isClosedClientStage(client.stage),
  );
  const leadershipStaleClientCount = filteredLeadershipStaleClients.length;
  const leadershipLatestSendByClient = new Map<
    string,
    (typeof leadershipLatestSendRecords)[number]
  >();

  for (const record of leadershipLatestSendRecords) {
    if (!leadershipLatestSendByClient.has(record.clientId)) {
      leadershipLatestSendByClient.set(record.clientId, record);
    }
  }

  const leadershipEngagementItems: FrontOfficeDashboardLeadershipEngagementItem[] =
    [...leadershipLatestSendByClient.values()]
      .filter((record) => !isClosedClientStage(record.client.stage))
      .flatMap<FrontOfficeDashboardLeadershipEngagementItem>((record) => {
      const appointmentLabel = buildSendRecordAppointmentLabel({
        title: record.appointmentTitle,
        startsAt: record.appointmentStartsAt,
        timeZone: input.timeZone,
      });
      const stageLabel = formatSendRecordStageLabel(
        record.clientStageLabel || record.client.stage,
      );
      const listingLabel =
        record.listing?.title?.trim() || "Tracked Front Office send";

        if (record.openCount <= 0) {
          if (record.sentAt.getTime() > threeDaysAgo.getTime()) {
            return [];
          }

          const daysSinceSend = buildElapsedDayCount(record.sentAt, now, 3);

          return [
            {
              id: `leadership-engagement-${record.id}`,
              title: record.client.fullName,
              description: [
                listingLabel,
                stageLabel,
                appointmentLabel,
                `${daysSinceSend} day(s) since send with no tracked open.`,
              ]
                .filter(Boolean)
                .join(" · "),
              contextLabel: buildMembershipUserLabel(
                record.senderMembership.user,
                buildMembershipUserLabel(
                  record.client.ownerMembership?.user,
                  "Assigned owner",
                ),
              ),
              tone: "danger",
              actionLabel: "Open office contact",
              href: `/office/contacts/${record.client.id}`,
              _priority: 0,
              _sortAt: record.sentAt,
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
            id: `leadership-engagement-${record.id}`,
            title: record.client.fullName,
            description: [
              listingLabel,
              stageLabel,
              appointmentLabel,
              `${quietDays} day(s) since the last tracked open.`,
            ]
              .filter(Boolean)
              .join(" · "),
            contextLabel: buildMembershipUserLabel(
              record.senderMembership.user,
              buildMembershipUserLabel(
                record.client.ownerMembership?.user,
                "Assigned owner",
              ),
            ),
            tone: "warning",
            actionLabel: "Open office contact",
            href: `/office/contacts/${record.client.id}`,
            _priority: 1,
            _sortAt: lastEngagementAt,
          },
        ];
      })
      .sort(
        (left, right) =>
          left._priority - right._priority ||
          left._sortAt.getTime() - right._sortAt.getTime(),
      );
  const leadershipEngagementRiskCount = leadershipEngagementItems.length;
  const leadershipItems: FrontOfficeDashboardLeadershipItem[] = [
    ...leadershipOverdueTasks.slice(0, 2).map((task) => ({
      id: `leadership-task-${task.id}`,
      title: task.client?.fullName ?? task.title,
      description: `${task.title} · Due ${formatDateLabel(task.dueAt)}`,
      contextLabel: buildMembershipUserLabel(
        task.assigneeMembership?.user,
        "Assigned team member",
      ),
      tone: "danger" as const,
      actionLabel: "Open office contact",
      href: task.clientId
        ? `/office/contacts/${task.clientId}`
        : "/office/contacts",
    })),
    ...leadershipEngagementItems.slice(0, 2).map(
      ({ _priority, _sortAt, ...item }) => item,
    ),
    ...filteredLeadershipStaleClients.slice(0, 2).map((client) => {
      const inactiveDays = Math.max(
        15,
        buildElapsedDayCount(client.lastContactAt ?? client.createdAt, now, 15),
      );

      return {
        id: `leadership-client-${client.id}`,
        title: client.fullName,
        description: `${client.stage} · ${inactiveDays} day(s) since the last recorded touch.`,
        contextLabel: buildMembershipUserLabel(
          client.ownerMembership?.user,
          "Assigned owner",
        ),
        tone: "warning" as const,
        actionLabel: "Open office contact",
        href: `/office/contacts/${client.id}`,
      };
    }),
  ].slice(0, 4);
  const aiQueueCandidates = aiSuggestionCandidates
    .flatMap<FrontOfficeDashboardAiCandidateItem>((client) => {
      const leaseReminder = buildLeaseReminderStatus({
        leaseEndDate: client.leaseEndDate,
        leaseReminderAt: client.leaseReminderAt,
        now,
      });
      const nextTouchLabel = formatNextTouchLabel({
        nextFollowUpAt: client.nextFollowUpAt,
        leaseReminderAt: client.leaseReminderAt,
        now,
      });
      const latestAppointment = client.appointments[0] ?? null;
      const latestSendRecord = client.frontOfficeSendRecords[0] ?? null;
      const linkedTransaction = client.transactionContacts[0]?.transaction ?? null;
      const closingReferenceDate =
        linkedTransaction?.moveInDate ??
        linkedTransaction?.closingDate ??
        linkedTransaction?.acceptanceDate ??
        null;
      const hasClosedTransaction =
        linkedTransaction?.status === TransactionStatus.closed;
      const hasCancelledTransaction =
        linkedTransaction?.status === TransactionStatus.cancelled;
      const isClosingSoon = Boolean(
        !hasClosedTransaction &&
          !hasCancelledTransaction &&
          closingReferenceDate &&
          closingReferenceDate.getTime() >= startOfToday.getTime() &&
          closingReferenceDate.getTime() <= fourteenDaysFromNow.getTime(),
      );
      const isReadyForBackOffice = isFrontOfficeStageReadyForBackOffice(
        client.stage,
      );
      const openDossierHref = `/agent/clients/${client.id}#front-office-ai-suggestions`;

      if (hasCancelledTransaction) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "reentry",
          now,
          clientFullName: client.fullName,
        });

        return [
          {
            id: `ai-${client.id}-reentry`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "reentry",
            statusLabel: "Re-entry",
            tone: "warning",
            description:
              "The formal deal did not close, so the next-touch should reopen the relationship without forcing urgency.",
            contextLabel: nextTouchLabel,
            helperLabel: "Grounded by cancelled / lost transaction outcome",
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: 0,
            _sortAt: linkedTransaction?.acceptanceDate ?? client.createdAt,
          },
        ];
      }

      if (hasClosedTransaction) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "postclose",
          now,
          clientFullName: client.fullName,
        });

        return [
          {
            id: `ai-${client.id}-postclose`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "postclose",
            statusLabel: "Post-close",
            tone: "success",
            description:
              closingReferenceDate
                ? `The shared transaction is already closed around ${formatDateLabel(closingReferenceDate)}. Keep the relationship warm while the win is still fresh.`
                : "The shared transaction is already closed. Keep the relationship warm while the win is still fresh.",
            contextLabel: nextTouchLabel,
            helperLabel:
              closingReferenceDate
                ? `Milestone · ${formatDateLabel(closingReferenceDate)}`
                : "Grounded by closed transaction outcome",
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: 1,
            _sortAt: closingReferenceDate ?? client.createdAt,
          },
        ];
      }

      if (isClosingSoon && closingReferenceDate) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "closing",
          now,
          clientFullName: client.fullName,
        });

        return [
          {
            id: `ai-${client.id}-closing`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "closing",
            statusLabel: "Closing support",
            tone: "warning",
            description: `A formal deal milestone is close: ${formatDateLabel(
              closingReferenceDate,
            )}. Use the next touch to steady logistics and wrap-up timing.`,
            contextLabel: nextTouchLabel,
            helperLabel:
              linkedTransaction?.moveInDate
                ? "Move-in window is approaching"
                : linkedTransaction?.closingDate
                  ? "Closing date is approaching"
                  : "Accepted file needs a wrap-up plan",
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: 2,
            _sortAt: closingReferenceDate,
          },
        ];
      }

      if (
        leaseReminder.statusLabel === "Overdue" ||
        leaseReminder.statusLabel === "Due today" ||
        leaseReminder.statusLabel === "Due soon"
      ) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "lease",
          now:
            leaseReminder.statusLabel === "Due soon"
              ? new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
              : now,
          clientFullName: client.fullName,
        });

        return [
          {
            id: `ai-${client.id}-lease`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "lease",
            statusLabel: "Lease timing",
            tone: leaseReminder.tone,
            description:
              "Lease timing is already visible on this record, so the next-touch should lock renewal, move, or remarketing intent before the window slips.",
            contextLabel: nextTouchLabel,
            helperLabel: `${leaseReminder.statusLabel} · ${leaseReminder.detailLabel}`,
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: leaseReminder.statusLabel === "Overdue" ? 3 : 4,
            _sortAt: leaseReminder.reminderAt ?? client.createdAt,
          },
        ];
      }

      if (latestAppointment) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "appointment",
          now,
          clientFullName: client.fullName,
          appointmentTitle: latestAppointment.title,
        });

        return [
          {
            id: `ai-${client.id}-appointment`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "appointment",
            statusLabel: "Appointment prep",
            tone: "accent",
            description: `There is already a scheduled ${formatAppointmentTypeLabel(
              latestAppointment.type,
            ).toLowerCase()} on the calendar, so the next-touch should sharpen expectations before the meeting.`,
            contextLabel: nextTouchLabel,
            helperLabel: `${latestAppointment.title} · ${formatDateTimeLabel(
              latestAppointment.startsAt,
              { timeZone: input.timeZone ?? null },
            )}`,
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: 5,
            _sortAt: latestAppointment.startsAt,
          },
        ];
      }

      if (
        latestSendRecord &&
        latestSendRecord.openCount <= 0 &&
        latestSendRecord.sentAt.getTime() <= threeDaysAgo.getTime()
      ) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "content_rescue",
          now,
          clientFullName: client.fullName,
        });

        return [
          {
            id: `ai-${client.id}-unopened-send`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "content_rescue",
            statusLabel: "Content follow-up",
            tone: "warning",
            description:
              "Material was sent but there is still no tracked open, so the safest next-touch is to reduce friction and offer a smaller next step.",
            contextLabel: nextTouchLabel,
            helperLabel:
              latestSendRecord.listing?.title?.trim()
                ? `No open on ${latestSendRecord.listing.title.trim()}`
                : "Tracked send has no open yet",
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: 6,
            _sortAt: latestSendRecord.sentAt,
          },
        ];
      }

      if (
        latestSendRecord &&
        latestSendRecord.openCount > 0 &&
        (latestSendRecord.lastOpenedAt ?? latestSendRecord.sentAt).getTime() >=
          sevenDaysAgo.getTime()
      ) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "warm_engagement",
          now,
          clientFullName: client.fullName,
        });

        return [
          {
            id: `ai-${client.id}-warm-send`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "warm_engagement",
            statusLabel: "Warm engagement",
            tone: latestSendRecord.openCount > 1 ? "success" : "accent",
            description:
              "Tracked content already shows live interest, so the next-touch should turn that signal into a shortlist, feedback, or booked step.",
            contextLabel: nextTouchLabel,
            helperLabel:
              latestSendRecord.lastOpenedAt
                ? `Last open · ${formatDateTimeLabel(
                    latestSendRecord.lastOpenedAt,
                    { timeZone: input.timeZone ?? null },
                  )}`
                : `Opened ${latestSendRecord.openCount} time(s)`,
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: 7,
            _sortAt: latestSendRecord.lastOpenedAt ?? latestSendRecord.sentAt,
          },
        ];
      }

      if (isReadyForBackOffice && !linkedTransaction) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "handoff",
          now,
          clientFullName: client.fullName,
        });

        return [
          {
            id: `ai-${client.id}-handoff`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "handoff",
            statusLabel: "Formal handoff",
            tone: "warning",
            description:
              "This record is BO-ready, but the formal file is not live yet, so the next-touch should confirm package, timing, and expectations before handoff.",
            contextLabel: nextTouchLabel,
            helperLabel:
              client.handoffDrafts[0]?.summary?.trim() ||
              "Front Office stage is ready for formal workflow",
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: 8,
            _sortAt: client.createdAt,
          },
        ];
      }

      if (!isClosedClientStage(client.stage) && !client.nextFollowUpAt) {
        const followUp = buildFrontOfficeAiFollowUpAction({
          kind: "generic",
          now,
          clientFullName: client.fullName,
        });

        return [
          {
            id: `ai-${client.id}-generic`,
            clientId: client.id,
            clientName: client.fullName,
            suggestionKind: "generic",
            statusLabel: "Next touch",
            tone: "accent",
            description:
              "This active client does not yet have a future touch on the books, so Acre should not leave the next move implicit.",
            contextLabel: nextTouchLabel,
            helperLabel: `Stage · ${client.stage}`,
            openDossierHref,
            followUpTitle: followUp.title,
            followUpDueAt: followUp.dueAt,
            _priority: 9,
            _sortAt: client.createdAt,
          },
        ];
      }

      return [];
    })
    .map((candidate) => {
      const insight = buildFrontOfficeAiSuggestionInsight({
        historyIndex: aiHistoryIndex,
        clientId: candidate.clientId,
        suggestionKind: candidate.suggestionKind,
      });

      return {
        ...candidate,
        helperLabel: [candidate.helperLabel, ...insight.historySignals]
          .filter(Boolean)
          .join(" · "),
        allowsDirectFollowUpCreation:
          !insight.suppressDirectFollowUpCreation,
        _priority: candidate._priority + insight.priorityAdjustment,
      };
    })
    .sort(
      (left, right) =>
        left._priority - right._priority ||
        left._sortAt.getTime() - right._sortAt.getTime(),
    );
  const aiQueueItems = aiQueueCandidates
    .slice(0, 4)
    .map(({ _priority, _sortAt, ...item }) => item);
  const aiSuggestionCount = aiQueueCandidates.length;
  const aiAcceptedActionItems = recentAiAcceptedActionItems.map((action) => {
    const outcome = mapFrontOfficeAiAcceptedActionOutcome({
      actionType: action.actionType,
      followUpTask: action.followUpTask,
      sendRecord: action.sendRecord,
      now,
      timeZone: input.timeZone,
    });

    return {
      id: action.id,
      clientId: action.client.id,
      clientName: action.client.fullName,
      title: action.actionTitle.trim() || formatFrontOfficeAiActionTypeLabel(action.actionType),
      statusLabel: outcome.label,
      statusTone: outcome.tone,
      description: outcome.detail,
      contextLabel: `${action.suggestionLabel} · ${formatFrontOfficeAiSourceSurfaceLabel(action.sourceSurface)}`,
      helperLabel: [
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
      href: `/agent/clients/${action.client.id}#front-office-ai-outcomes`,
      actionLabel: "Open AI history",
    } satisfies FrontOfficeDashboardAiAcceptedActionItem;
  });
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
    leadershipOverdueTaskCount +
    leadershipStaleClientCount +
    leadershipEngagementRiskCount;
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
      id: "lease-reminders",
      label: "Lease reminders",
      count: dueLeaseReminderCount,
      tone:
        overdueLeaseReminderCount > 0
          ? "danger"
          : dueLeaseReminderCount > 0
            ? "warning"
            : "neutral",
      description:
        leaseReminderItems.length > 0
          ? leaseReminderItems.map((item) => item.clientName).join(" · ")
          : "No lease-date reminders are due soon right now.",
      helper:
        overdueLeaseReminderCount > 0
          ? `${overdueLeaseReminderCount} reminder(s) are already overdue.`
          : "Use lease dates to surface renewal, remarketing, and move planning before they go quiet.",
      href: "/agent/clients",
      actionLabel: "Open client pipeline",
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
                ? "Team execution pressure"
                : "Office execution pressure",
            count: leadershipPressureCount,
            tone: leadershipPressureCount > 0 ? "danger" : "neutral",
            description:
              leadershipPressureCount > 0
                ? `${leadershipOverdueTaskCount} overdue task(s), ${leadershipStaleClientCount} stale client(s), and ${leadershipEngagementRiskCount} send-trail risk item(s) need leadership attention.`
                : "No overdue task, stale-client, or send-trail pressure is visible in your leadership scope right now.",
            helper:
              "Leadership visibility should surface follow-up drift and quiet engagement before it turns into a formal Back Office problem.",
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
        dueLeaseReminderCount +
        todayCommitmentCount +
        needsBackOfficeCount +
        leadershipPressureCount +
        aiSuggestionCount,
      followUpDueCount: dueFollowUpCount,
      leaseReminderCount: dueLeaseReminderCount,
      overdueTaskCount: overdueFollowUpTaskCount,
      staleClientCount,
      todayCommitmentCount,
      needsBackOfficeCount,
      leadershipPressureCount,
      aiSuggestionCount,
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
        nextTouchLabel: formatNextTouchLabel({
          nextFollowUpAt: client.nextFollowUpAt,
          leaseReminderAt: client.leaseReminderAt,
          now,
        }),
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
        stageLabel: formatSendRecordStageLabel(record.clientStageLabel),
        appointmentLabel: buildSendRecordAppointmentLabel({
          title: record.appointmentTitle,
          startsAt: record.appointmentStartsAt,
          timeZone: input.timeZone,
        }),
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
    leaseReminders: {
      dueCount: dueLeaseReminderCount,
      overdueCount: overdueLeaseReminderCount,
      items: leaseReminderItems,
    },
    aiQueue: {
      suggestionCount: aiSuggestionCount,
      items: aiQueueItems,
    },
    aiAcceptedActions: {
      acceptedCount: aiAcceptedActionCount,
      positiveOutcomeCount: aiPositiveOutcomeCount,
      items: aiAcceptedActionItems,
    },
    backOffice: {
      items: backOfficeItems,
    },
    leadershipQueue: {
      visible: leadershipScope.visible,
      scopeLabel: leadershipScope.scopeLabel,
      overdueTaskCount: leadershipOverdueTaskCount,
      staleClientCount: leadershipStaleClientCount,
      engagementRiskCount: leadershipEngagementRiskCount,
      items: leadershipItems,
    },
  };
}
