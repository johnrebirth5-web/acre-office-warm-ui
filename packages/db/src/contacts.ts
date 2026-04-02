import {
  FrontOfficeHandoffStatus,
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  TaskStatus,
  TransactionContactRole,
} from "@prisma/client";
import {
  buildTransactionPortfolioVisibilityWhere,
  resolveOfficeDataScope,
} from "./access";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import {
  buildFrontOfficeHandoffSummary,
  isFrontOfficeStageReadyForBackOffice,
} from "./front-office-contracts";
import type { FrontOfficeAiAcceptedActionContext } from "./front-office-ai";
import { recordFrontOfficeAiAcceptedAction } from "./front-office-ai";
import { createNotificationsForMemberships } from "./notifications";
import {
  type LinkTransactionContactInput,
  linkContactToTransaction as linkTransactionContact,
} from "./transaction-contacts";
import { resolveLeaseReminderDates } from "./lease-reminders";

export type OfficeContactRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  contactType: string;
  source: string;
  stage: string;
  intent: string;
  budget: string;
  areas: string[];
  lastContactLabel: string;
  nextFollowUpLabel: string;
  owner: string;
};

export type OfficeContactListResult = {
  contacts: OfficeContactRecord[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type OfficeContactTask = {
  id: string;
  title: string;
  status: string;
  dueAt: string;
  assigneeName: string;
};

export type OfficeContactLinkedTransaction = {
  id: string;
  label: string;
  status: string;
  askingPrice: string;
  purchasedPrice: string;
  role: string;
  isPrimary: boolean;
};

export type OfficeTransactionLinkOption = {
  id: string;
  label: string;
};

export type OfficeContactDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  contactType: string;
  source: string;
  stage: string;
  intent: string;
  budgetMin: string;
  budgetMax: string;
  areas: string[];
  notes: string;
  lastContactAt: string;
  nextFollowUpAt: string;
  leaseEndDate: string;
  leaseReminderAt: string;
  ownerMembershipId: string | null;
  ownerName: string;
  additionalFields: Record<string, string>;
  linkedTransactions: OfficeContactLinkedTransaction[];
  availableTransactions: OfficeTransactionLinkOption[];
  followUpTasks: OfficeContactTask[];
};

export type ListContactsInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  search?: string;
  stage?: string;
  page?: number;
  pageSize?: number;
};

export type GetContactByIdInput = {
  organizationId: string;
  viewerMembershipId: string;
  contactId: string;
  officeId?: string | null;
};

const defaultContactsPage = 1;
const defaultContactsPageSize = 20;
const maxContactsPageSize = 100;

function formatTransactionPrice(value: Prisma.Decimal | null) {
  if (!value) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value));
}

export type SaveContactInput = {
  organizationId: string;
  ownerMembershipId: string;
  actorMembershipId?: string;
  actorOfficeId?: string | null;
  fullName: string;
  email?: string;
  phone?: string;
  contactType?: string;
  source?: string;
  stage?: string;
  intent?: string;
  budgetMin?: string;
  budgetMax?: string;
  preferredAreas?: string[];
  notes?: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
  leaseEndDate?: string;
  leaseReminderAt?: string;
  additionalFields?: Record<string, string>;
};

export type SaveFrontOfficeClientLeaseReminderInput = {
  organizationId: string;
  clientId: string;
  actorMembershipId: string;
  actorOfficeId?: string | null;
  leaseEndDate?: string;
  leaseReminderAt?: string;
};

export type CreateFollowUpTaskInput = {
  organizationId: string;
  clientId: string;
  assigneeMembershipId: string;
  actorMembershipId?: string;
  actorOfficeId?: string | null;
  title: string;
  dueAt?: string;
  acceptedAiAction?: FrontOfficeAiAcceptedActionContext | null;
};

export type UpdateFollowUpTaskInput = {
  organizationId: string;
  clientId: string;
  taskId: string;
  actorMembershipId: string;
  actorOfficeId?: string | null;
  title?: string;
  status?: string;
  dueAt?: string | null;
};

export type FrontOfficeLeadDuplicateMatch = {
  id: string;
  fullName: string;
  stage: string;
  sourceLabel: string;
  nextTouchLabel: string;
  href: string;
  matchReasons: string[];
};

export type FrontOfficeClientMergeResult = {
  targetClientId: string;
  targetFullName: string;
  sourceClientId: string;
  sourceFullName: string;
  movedCounts: {
    appointments: number;
    sendRecords: number;
    aiAcceptedActions: number;
    stageHistoryEntries: number;
    handoffDrafts: number;
    followUpTasks: number;
    transactionLinks: number;
    primaryTransactions: number;
  };
};

const openFollowUpTaskStatuses: TaskStatus[] = [
  TaskStatus.queued,
  TaskStatus.in_progress,
];

function formatDateLabel(date: Date | null) {
  if (!date) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateValue(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function parseOptionalDate(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  return new Date(value);
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function normalizeName(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, " ") || "";
}

function normalizePhoneDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") || "";
}

function pickEarlierDate(
  left: Date | null | undefined,
  right: Date | null | undefined,
) {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  return left.getTime() <= right.getTime() ? left : right;
}

function pickLaterDate(
  left: Date | null | undefined,
  right: Date | null | undefined,
) {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  return left.getTime() >= right.getTime() ? left : right;
}

function mergeStringLists(primary: string[], secondary: string[]) {
  const merged = new Set<string>();

  for (const value of [...primary, ...secondary]) {
    const normalized = value.trim();

    if (normalized) {
      merged.add(normalized);
    }
  }

  return Array.from(merged);
}

function mergeNotes(primary: string | null | undefined, secondary: string | null | undefined) {
  const primaryValue = primary?.trim() || "";
  const secondaryValue = secondary?.trim() || "";

  if (!primaryValue) {
    return secondaryValue || null;
  }

  if (!secondaryValue || primaryValue.includes(secondaryValue)) {
    return primaryValue;
  }

  return `${primaryValue}\n\nMerged from duplicate record:\n${secondaryValue}`;
}

function asJsonObject(
  value: Prisma.JsonValue | null | undefined,
): Record<string, Prisma.JsonValue> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function mergeJsonObjects(
  primary: Prisma.JsonValue | null | undefined,
  secondary: Prisma.JsonValue | null | undefined,
) {
  const primaryObject = asJsonObject(primary);
  const secondaryObject = asJsonObject(secondary);

  if (primaryObject && secondaryObject) {
    return {
      ...secondaryObject,
      ...primaryObject,
    } satisfies Prisma.InputJsonValue;
  }

  if (primaryObject) {
    return primaryObject satisfies Prisma.InputJsonValue;
  }

  if (secondaryObject) {
    return secondaryObject satisfies Prisma.InputJsonValue;
  }

  return Prisma.JsonNull;
}

function formatCompactDateLabel(date: Date | null, timeZone?: string | null) {
  if (!date) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timeZone ?? undefined,
  });
}

function formatFrontOfficeDuplicateNextTouchLabel(input: {
  nextFollowUpAt: Date | null;
  leaseReminderAt: Date | null;
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
    return `Lease reminder · ${formatCompactDateLabel(
      leaseReminder.leaseReminderAt,
      input.timeZone,
    )}`;
  }

  if (input.nextFollowUpAt) {
    return `Next follow-up · ${formatCompactDateLabel(
      input.nextFollowUpAt,
      input.timeZone,
    )}`;
  }

  return "No follow-up scheduled";
}

function normalizeLeaseReminderInput(input: {
  leaseEndDate?: string;
  leaseReminderAt?: string;
}) {
  return resolveLeaseReminderDates({
    leaseEndDate: parseOptionalDate(input.leaseEndDate),
    leaseReminderAt: parseOptionalDate(input.leaseReminderAt),
  });
}

function parseOptionalDecimal(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : null;
}

function formatBudget(min: Prisma.Decimal | null, max: Prisma.Decimal | null) {
  if (!min && !max) {
    return "—";
  }

  const format = (value: Prisma.Decimal | null) =>
    value
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
        }).format(Number(value))
      : "";

  if (min && max && Number(min) === Number(max)) {
    return format(min);
  }

  if (min && max) {
    return `${format(min)} - ${format(max)}`;
  }

  return format(min ?? max);
}

function formatTransactionContactRole(role: TransactionContactRole) {
  return role
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("-");
}

function buildContactObjectLabel(contact: {
  fullName: string;
  email: string | null;
  phone: string | null;
}) {
  return `${contact.fullName}${contact.email ? ` · ${contact.email}` : contact.phone ? ` · ${contact.phone}` : ""}`;
}

function normalizeFollowUpTaskStatus(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === TaskStatus.queued) {
    return TaskStatus.queued;
  }

  if (normalized === TaskStatus.in_progress) {
    return TaskStatus.in_progress;
  }

  if (normalized === TaskStatus.completed) {
    return TaskStatus.completed;
  }

  if (normalized === TaskStatus.canceled) {
    return TaskStatus.canceled;
  }

  throw new Error("Unsupported follow-up task status.");
}

async function syncClientNextFollowUpAtFromOpenTasks(
  tx: Prisma.TransactionClient,
  input: {
    clientId: string;
    previousDueAt?: Date | null;
  },
) {
  const client = await tx.client.findUnique({
    where: {
      id: input.clientId,
    },
    select: {
      id: true,
      nextFollowUpAt: true,
    },
  });

  if (!client) {
    return;
  }

  const openTasks = await tx.followUpTask.findMany({
    where: {
      clientId: input.clientId,
      status: {
        in: openFollowUpTaskStatuses,
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    select: {
      dueAt: true,
    },
  });

  const earliestOpenTaskDueAt =
    openTasks.find((task) => task.dueAt)?.dueAt ?? null;
  const currentNextFollowUpAt = client.nextFollowUpAt ?? null;

  let nextFollowUpAt = currentNextFollowUpAt;

  if (!currentNextFollowUpAt) {
    nextFollowUpAt = earliestOpenTaskDueAt;
  } else if (
    input.previousDueAt &&
    currentNextFollowUpAt.getTime() === input.previousDueAt.getTime()
  ) {
    nextFollowUpAt = earliestOpenTaskDueAt;
  } else if (
    earliestOpenTaskDueAt &&
    earliestOpenTaskDueAt.getTime() < currentNextFollowUpAt.getTime()
  ) {
    nextFollowUpAt = earliestOpenTaskDueAt;
  }

  const currentTime = currentNextFollowUpAt?.getTime() ?? null;
  const nextTime = nextFollowUpAt?.getTime() ?? null;

  if (currentTime === nextTime) {
    return;
  }

  await tx.client.update({
    where: {
      id: client.id,
    },
    data: {
      nextFollowUpAt,
    },
  });
}

function buildContactChangedDetail(
  label: string,
  previousValue: string,
  nextValue: string,
) {
  if (previousValue === nextValue) {
    return null;
  }

  return `${label}: ${previousValue || "—"} -> ${nextValue || "—"}`;
}

function buildContactChange(
  label: string,
  previousValue: string,
  nextValue: string,
) {
  if (previousValue === nextValue) {
    return null;
  }

  return {
    label,
    previousValue: previousValue || "—",
    nextValue: nextValue || "—",
  };
}

function formatAreas(areas: string[] | undefined) {
  return areas && areas.length > 0 ? areas.join(", ") : "—";
}

async function createClientStageHistoryEntry(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    clientId: string;
    membershipId?: string | null;
    fromStage?: string | null;
    toStage: string;
    note?: string | null;
  },
) {
  await tx.clientStageHistory.create({
    data: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      clientId: input.clientId,
      membershipId: input.membershipId ?? null,
      fromStage: input.fromStage?.trim() || null,
      toStage: input.toStage,
      note: input.note?.trim() || null,
    },
  });
}

async function syncFrontOfficeHandoffDraft(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    clientId: string;
    ownerMembershipId?: string | null;
    clientName: string;
    stage: string;
  },
) {
  const existingDrafts = await tx.frontOfficeHandoffDraft.findMany({
    where: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      status: {
        in: [FrontOfficeHandoffStatus.draft, FrontOfficeHandoffStatus.ready],
      },
    },
    select: {
      id: true,
    },
  });

  if (isFrontOfficeStageReadyForBackOffice(input.stage)) {
    const summary = buildFrontOfficeHandoffSummary(
      input.stage,
      input.clientName,
    );

    if (existingDrafts.length > 0) {
      await tx.frontOfficeHandoffDraft.updateMany({
        where: {
          id: {
            in: existingDrafts.map((draft) => draft.id),
          },
        },
        data: {
          officeId: input.officeId ?? null,
          ownerMembershipId: input.ownerMembershipId ?? null,
          status: FrontOfficeHandoffStatus.ready,
          stageLabel: input.stage,
          summary,
        },
      });
      return;
    }

    await tx.frontOfficeHandoffDraft.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        clientId: input.clientId,
        ownerMembershipId: input.ownerMembershipId ?? null,
        status: FrontOfficeHandoffStatus.ready,
        targetWorkflow: "transaction",
        stageLabel: input.stage,
        summary,
        metadata: Prisma.JsonNull,
      },
    });
    return;
  }

  if (existingDrafts.length > 0) {
    await tx.frontOfficeHandoffDraft.updateMany({
      where: {
        id: {
          in: existingDrafts.map((draft) => draft.id),
        },
      },
      data: {
        status: FrontOfficeHandoffStatus.canceled,
      },
    });
  }
}

async function findSupplementalContactSearchIds(
  organizationId: string,
  query: string,
) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const likeQuery = `%${normalizedQuery}%`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT DISTINCT c."id"
    FROM "Client" c
    LEFT JOIN "Membership" m ON m."id" = c."ownerMembershipId"
    LEFT JOIN "User" u ON u."id" = m."userId"
    WHERE c."organizationId" = ${organizationId}
      AND (
        CONCAT_WS(' ', COALESCE(u."firstName", ''), COALESCE(u."lastName", '')) ILIKE ${likeQuery}
        OR ARRAY_TO_STRING(c."preferredAreas", ' ') ILIKE ${likeQuery}
      )
  `);

  return rows.map((row) => row.id);
}

function buildContactScopeWhere(
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

function buildScopedTransactionWhere(
  scope: Awaited<ReturnType<typeof resolveOfficeDataScope>>,
  organizationId: string,
  officeId: string | null | undefined,
): Prisma.TransactionWhereInput {
  const whereConditions: Prisma.TransactionWhereInput[] = [
    {
      organizationId,
    },
    buildTransactionPortfolioVisibilityWhere(scope),
  ];

  if (officeId) {
    whereConditions.push({
      officeId,
    });
  }

  return {
    AND: whereConditions,
  };
}

function mapContactRecord(client: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  contactType: string | null;
  source: string;
  stage: string;
  intent: string;
  budgetMin: Prisma.Decimal | null;
  budgetMax: Prisma.Decimal | null;
  preferredAreas: string[];
  lastContactAt: Date | null;
  nextFollowUpAt: Date | null;
  ownerMembership: {
    user: {
      firstName: string;
      lastName: string;
    };
  } | null;
}): OfficeContactRecord {
  return {
    id: client.id,
    fullName: client.fullName,
    email: client.email ?? "",
    phone: client.phone ?? "",
    contactType: client.contactType ?? "",
    source: client.source,
    stage: client.stage,
    intent: client.intent,
    budget: formatBudget(client.budgetMin, client.budgetMax),
    areas: client.preferredAreas,
    lastContactLabel: formatDateLabel(client.lastContactAt),
    nextFollowUpLabel: formatDateLabel(client.nextFollowUpAt),
    owner: client.ownerMembership
      ? `${client.ownerMembership.user.firstName} ${client.ownerMembership.user.lastName}`
      : "Unassigned",
  };
}

export async function listContacts(
  input: ListContactsInput,
): Promise<OfficeContactListResult> {
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null,
    resource: "contacts",
  });
  const whereConditions: Prisma.ClientWhereInput[] = [
    {
      organizationId: input.organizationId,
    },
    ...buildContactScopeWhere(scope, input.officeId ?? null),
  ];
  const requestedPage = Number.isFinite(input.page)
    ? Number(input.page)
    : defaultContactsPage;
  const requestedPageSize = Number.isFinite(input.pageSize)
    ? Number(input.pageSize)
    : defaultContactsPageSize;
  const pageSize = Math.min(
    Math.max(Math.trunc(requestedPageSize) || defaultContactsPageSize, 1),
    maxContactsPageSize,
  );

  if (input.stage && input.stage !== "All") {
    whereConditions.push({
      stage: input.stage,
    });
  }

  if (input.search?.trim()) {
    const query = input.search.trim();
    const supplementalIds = await findSupplementalContactSearchIds(
      input.organizationId,
      query,
    );
    whereConditions.push({
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { source: { contains: query, mode: "insensitive" } },
        { intent: { contains: query, mode: "insensitive" } },
        {
          ownerMembership: {
            user: {
              OR: [
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
              ],
            },
          },
        },
        ...(supplementalIds.length > 0
          ? [{ id: { in: supplementalIds } }]
          : []),
      ],
    });
  }

  const where: Prisma.ClientWhereInput = {
    AND: whereConditions,
  };

  const totalCount = await prisma.client.count({
    where,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(
    Math.max(Math.trunc(requestedPage) || defaultContactsPage, 1),
    totalPages,
  );
  const clients = await prisma.client.findMany({
    where,
    include: {
      ownerMembership: {
        include: {
          user: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    contacts: clients.map(mapContactRecord),
    totalCount,
    totalPages,
    page,
    pageSize,
  };
}

export const officeContactsPageDefaults = {
  page: defaultContactsPage,
  pageSize: defaultContactsPageSize,
} as const;

export const officeContactsPageLimits = {
  maxPageSize: maxContactsPageSize,
} as const;

export async function createContact(
  input: SaveContactInput,
): Promise<OfficeContactDetail> {
  const leaseDates = normalizeLeaseReminderInput({
    leaseEndDate: input.leaseEndDate,
    leaseReminderAt: input.leaseReminderAt,
  });

  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        organizationId: input.organizationId,
        ownerMembershipId: input.ownerMembershipId,
        fullName: input.fullName.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        contactType: input.contactType?.trim() || null,
        source: input.source?.trim() || "Manual entry",
        stage: input.stage?.trim() || "New",
        intent: input.intent?.trim() || "Unknown",
        budgetMin: parseOptionalDecimal(input.budgetMin),
        budgetMax: parseOptionalDecimal(input.budgetMax),
        preferredAreas: input.preferredAreas?.filter(Boolean) ?? [],
        additionalFields: input.additionalFields ?? Prisma.JsonNull,
        notes: input.notes?.trim() || null,
        lastContactAt: parseOptionalDate(input.lastContactAt),
        nextFollowUpAt: parseOptionalDate(input.nextFollowUpAt),
        leaseEndDate: leaseDates.leaseEndDate,
        leaseReminderAt: leaseDates.leaseReminderAt,
      },
    });

    await createClientStageHistoryEntry(tx, {
      organizationId: input.organizationId,
      officeId: input.actorOfficeId ?? null,
      clientId: created.id,
      membershipId: input.actorMembershipId ?? input.ownerMembershipId,
      toStage: created.stage,
      note: "Client created in Front Office",
    });

    await syncFrontOfficeHandoffDraft(tx, {
      organizationId: input.organizationId,
      officeId: input.actorOfficeId ?? null,
      clientId: created.id,
      ownerMembershipId: input.ownerMembershipId,
      clientName: created.fullName,
      stage: created.stage,
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? input.ownerMembershipId,
      entityType: "contact",
      entityId: created.id,
      action: activityLogActions.contactCreated,
      payload: {
        officeId: input.actorOfficeId ?? null,
        contactId: created.id,
        contactName: created.fullName,
        objectLabel: buildContactObjectLabel(created),
        details: [`Stage: ${created.stage}`, `Intent: ${created.intent}`],
      },
    });

    return created;
  });

  return (await getContactById({
    organizationId: input.organizationId,
    viewerMembershipId: input.actorMembershipId ?? input.ownerMembershipId,
    contactId: client.id,
    officeId: input.actorOfficeId ?? null,
  })) as OfficeContactDetail;
}

export async function findFrontOfficeLeadDuplicateMatches(input: {
  organizationId: string;
  ownerMembershipId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  timeZone?: string | null;
}): Promise<FrontOfficeLeadDuplicateMatch[]> {
  const normalizedName = normalizeName(input.fullName);
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhoneDigits = normalizePhoneDigits(input.phone);
  const phoneNeedle =
    normalizedPhoneDigits.length >= 7
      ? normalizedPhoneDigits.slice(-7)
      : normalizedPhoneDigits;

  if (!normalizedName && !normalizedEmail && !normalizedPhoneDigits) {
    return [];
  }

  const candidates = await prisma.client.findMany({
    where: {
      organizationId: input.organizationId,
      ownerMembershipId: input.ownerMembershipId,
      OR: [
        normalizedEmail
          ? {
              email: {
                equals: normalizedEmail,
                mode: "insensitive",
              },
            }
          : undefined,
        phoneNeedle
          ? {
              phone: {
                contains: phoneNeedle,
              },
            }
          : undefined,
        normalizedName
          ? {
              fullName: {
                equals: input.fullName.trim(),
                mode: "insensitive",
              },
            }
          : undefined,
      ].filter(Boolean) as Prisma.ClientWhereInput[],
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 6,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      source: true,
      stage: true,
      nextFollowUpAt: true,
      leaseReminderAt: true,
    },
  });

  return candidates
    .map((candidate) => {
      const matchReasons: string[] = [];

      if (
        normalizedEmail &&
        normalizeEmail(candidate.email) &&
        normalizeEmail(candidate.email) === normalizedEmail
      ) {
        matchReasons.push("Same email");
      }

      if (
        normalizedPhoneDigits &&
        normalizePhoneDigits(candidate.phone) &&
        normalizePhoneDigits(candidate.phone) === normalizedPhoneDigits
      ) {
        matchReasons.push("Same phone");
      }

      if (
        normalizedName &&
        normalizeName(candidate.fullName) &&
        normalizeName(candidate.fullName) === normalizedName
      ) {
        matchReasons.push("Same name");
      }

      if (!matchReasons.length) {
        return null;
      }

      return {
        id: candidate.id,
        fullName: candidate.fullName,
        stage: candidate.stage,
        sourceLabel: candidate.source?.trim() || "Manual entry",
        nextTouchLabel: formatFrontOfficeDuplicateNextTouchLabel({
          nextFollowUpAt: candidate.nextFollowUpAt,
          leaseReminderAt: candidate.leaseReminderAt,
          timeZone: input.timeZone,
        }),
        href: `/agent/clients/${candidate.id}`,
        matchReasons,
      } satisfies FrontOfficeLeadDuplicateMatch;
    })
    .filter((candidate): candidate is FrontOfficeLeadDuplicateMatch =>
      Boolean(candidate),
    );
}

export async function mergeFrontOfficeClients(input: {
  organizationId: string;
  ownerMembershipId: string;
  targetClientId: string;
  sourceClientId: string;
  actorMembershipId: string;
  actorOfficeId?: string | null;
}): Promise<FrontOfficeClientMergeResult> {
  if (input.targetClientId === input.sourceClientId) {
    throw new Error("Choose two different client records to merge.");
  }

  return prisma.$transaction(async (tx) => {
    const clients = await tx.client.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.ownerMembershipId,
        id: {
          in: [input.targetClientId, input.sourceClientId],
        },
      },
      select: {
        id: true,
        ownerMembershipId: true,
        visibility: true,
        fullName: true,
        email: true,
        phone: true,
        contactType: true,
        source: true,
        stage: true,
        intent: true,
        budgetMin: true,
        budgetMax: true,
        preferredAreas: true,
        needsSummary: true,
        additionalFields: true,
        notes: true,
        lastContactAt: true,
        nextFollowUpAt: true,
        leaseEndDate: true,
        leaseReminderAt: true,
      },
    });

    const target = clients.find((client) => client.id === input.targetClientId);
    const source = clients.find((client) => client.id === input.sourceClientId);

    if (!target || !source) {
      throw new Error(
        "Both duplicate records must still exist in your Front Office queue before merging.",
      );
    }

    const mergedBudgetMin =
      target.budgetMin && source.budgetMin
        ? target.budgetMin.lessThan(source.budgetMin)
          ? target.budgetMin
          : source.budgetMin
        : target.budgetMin ?? source.budgetMin ?? null;
    const mergedBudgetMax =
      target.budgetMax && source.budgetMax
        ? target.budgetMax.greaterThan(source.budgetMax)
          ? target.budgetMax
          : source.budgetMax
        : target.budgetMax ?? source.budgetMax ?? null;
    const mergedEmail = target.email?.trim() || source.email?.trim() || null;
    const mergedPhone = target.phone?.trim() || source.phone?.trim() || null;
    const mergedContactType =
      target.contactType?.trim() || source.contactType?.trim() || null;
    const mergedSource =
      (target.source?.trim() &&
      target.source.trim().toLowerCase() !== "manual entry"
        ? target.source.trim()
        : source.source?.trim()) ||
      target.source.trim();
    const mergedIntent =
      (target.intent?.trim() &&
      target.intent.trim().toLowerCase() !== "unknown"
        ? target.intent.trim()
        : source.intent?.trim()) ||
      target.intent.trim();
    const mergedPreferredAreas = mergeStringLists(
      target.preferredAreas,
      source.preferredAreas,
    );
    const mergedNotes = mergeNotes(target.notes, source.notes);
    const mergedLastContactAt = pickLaterDate(
      target.lastContactAt,
      source.lastContactAt,
    );
    const mergedNextFollowUpAt = pickEarlierDate(
      target.nextFollowUpAt,
      source.nextFollowUpAt,
    );
    const mergedLeaseEndDate = target.leaseEndDate ?? source.leaseEndDate ?? null;
    const mergedLeaseReminderAt = pickEarlierDate(
      target.leaseReminderAt,
      source.leaseReminderAt,
    );
    const mergedNeedsSummary =
      target.needsSummary ?? source.needsSummary ?? Prisma.JsonNull;
    const mergedAdditionalFields = mergeJsonObjects(
      target.additionalFields,
      source.additionalFields,
    );

    const sourceTransactionLinks = await tx.transactionContact.findMany({
      where: {
        organizationId: input.organizationId,
        clientId: source.id,
      },
      select: {
        id: true,
        transactionId: true,
        isPrimary: true,
        notes: true,
        createdAt: true,
      },
    });
    const existingTargetTransactionLinks = await tx.transactionContact.findMany({
      where: {
        organizationId: input.organizationId,
        clientId: target.id,
      },
      select: {
        id: true,
        transactionId: true,
        isPrimary: true,
        notes: true,
        createdAt: true,
      },
    });
    const touchedTransactionIds = new Set<string>();
    const targetLinksByTransactionId = new Map(
      existingTargetTransactionLinks.map((link) => [link.transactionId, link]),
    );

    for (const sourceLink of sourceTransactionLinks) {
      touchedTransactionIds.add(sourceLink.transactionId);
      const targetLink = targetLinksByTransactionId.get(sourceLink.transactionId);

      if (targetLink) {
        const mergedLinkNotes = mergeNotes(targetLink.notes, sourceLink.notes);
        const shouldBePrimary = targetLink.isPrimary || sourceLink.isPrimary;

        if (
          mergedLinkNotes !== (targetLink.notes?.trim() || null) ||
          shouldBePrimary !== targetLink.isPrimary
        ) {
          await tx.transactionContact.update({
            where: {
              id: targetLink.id,
            },
            data: {
              notes: mergedLinkNotes,
              isPrimary: shouldBePrimary,
            },
          });
        }

        await tx.transactionContact.delete({
          where: {
            id: sourceLink.id,
          },
        });

        targetLinksByTransactionId.set(sourceLink.transactionId, {
          ...targetLink,
          isPrimary: shouldBePrimary,
          notes: mergedLinkNotes,
        });
        continue;
      }

      await tx.transactionContact.update({
        where: {
          id: sourceLink.id,
        },
        data: {
          clientId: target.id,
        },
      });

      targetLinksByTransactionId.set(sourceLink.transactionId, {
        id: sourceLink.id,
        transactionId: sourceLink.transactionId,
        isPrimary: sourceLink.isPrimary,
        notes: sourceLink.notes,
        createdAt: sourceLink.createdAt,
      });
    }

    for (const transactionId of touchedTransactionIds) {
      const links = await tx.transactionContact.findMany({
        where: {
          organizationId: input.organizationId,
          transactionId,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          clientId: true,
        },
      });
      const primaryClientId = links[0]?.clientId ?? null;

      await tx.transaction.updateMany({
        where: {
          id: transactionId,
          organizationId: input.organizationId,
        },
        data: {
          primaryClientId,
        },
      });
    }

    const [
      appointmentsResult,
      sendRecordsResult,
      aiAcceptedActionsResult,
      stageHistoryResult,
      handoffDraftsResult,
      followUpTasksResult,
      primaryTransactionsResult,
    ] = await Promise.all([
      tx.appointment.updateMany({
        where: {
          organizationId: input.organizationId,
          clientId: source.id,
        },
        data: {
          clientId: target.id,
        },
      }),
      tx.frontOfficeSendRecord.updateMany({
        where: {
          organizationId: input.organizationId,
          clientId: source.id,
        },
        data: {
          clientId: target.id,
        },
      }),
      tx.frontOfficeAiAcceptedAction.updateMany({
        where: {
          organizationId: input.organizationId,
          clientId: source.id,
        },
        data: {
          clientId: target.id,
        },
      }),
      tx.clientStageHistory.updateMany({
        where: {
          organizationId: input.organizationId,
          clientId: source.id,
        },
        data: {
          clientId: target.id,
        },
      }),
      tx.frontOfficeHandoffDraft.updateMany({
        where: {
          organizationId: input.organizationId,
          clientId: source.id,
        },
        data: {
          clientId: target.id,
          ownerMembershipId: target.ownerMembershipId,
        },
      }),
      tx.followUpTask.updateMany({
        where: {
          organizationId: input.organizationId,
          clientId: source.id,
        },
        data: {
          clientId: target.id,
        },
      }),
      tx.transaction.updateMany({
        where: {
          organizationId: input.organizationId,
          primaryClientId: source.id,
        },
        data: {
          primaryClientId: target.id,
        },
      }),
    ]);

    const updatedTarget = await tx.client.update({
      where: {
        id: target.id,
      },
      data: {
        email: mergedEmail,
        phone: mergedPhone,
        contactType: mergedContactType,
        source: mergedSource,
        intent: mergedIntent,
        budgetMin: mergedBudgetMin,
        budgetMax: mergedBudgetMax,
        preferredAreas: mergedPreferredAreas,
        needsSummary: mergedNeedsSummary,
        additionalFields: mergedAdditionalFields,
        notes: mergedNotes,
        lastContactAt: mergedLastContactAt,
        nextFollowUpAt: mergedNextFollowUpAt,
        leaseEndDate: mergedLeaseEndDate,
        leaseReminderAt: mergedLeaseReminderAt,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });

    await syncClientNextFollowUpAtFromOpenTasks(tx, {
      clientId: target.id,
      previousDueAt: mergedNextFollowUpAt,
    });

    const movedCounts = {
      appointments: appointmentsResult.count,
      sendRecords: sendRecordsResult.count,
      aiAcceptedActions: aiAcceptedActionsResult.count,
      stageHistoryEntries: stageHistoryResult.count,
      handoffDrafts: handoffDraftsResult.count,
      followUpTasks: followUpTasksResult.count,
      transactionLinks: sourceTransactionLinks.length,
      primaryTransactions: primaryTransactionsResult.count,
    };

    const details = [
      `Merged duplicate client ${buildContactObjectLabel(source)} into ${updatedTarget.fullName}.`,
      movedCounts.appointments > 0
        ? `Moved ${movedCounts.appointments} appointment record(s).`
        : null,
      movedCounts.sendRecords > 0
        ? `Moved ${movedCounts.sendRecords} tracked send record(s).`
        : null,
      movedCounts.followUpTasks > 0
        ? `Moved ${movedCounts.followUpTasks} follow-up task(s).`
        : null,
      movedCounts.handoffDrafts > 0
        ? `Moved ${movedCounts.handoffDrafts} Back Office handoff draft(s).`
        : null,
      movedCounts.transactionLinks > 0
        ? `Reconciled ${movedCounts.transactionLinks} transaction contact link(s).`
        : null,
      movedCounts.primaryTransactions > 0
        ? `Updated ${movedCounts.primaryTransactions} transaction primary-client pointer(s).`
        : null,
    ].filter((detail): detail is string => Boolean(detail));

    const changes = [
      buildContactChange("Email", target.email ?? "", mergedEmail ?? ""),
      buildContactChange("Phone", target.phone ?? "", mergedPhone ?? ""),
      buildContactChange(
        "Contact type",
        target.contactType ?? "",
        mergedContactType ?? "",
      ),
      buildContactChange("Source", target.source, mergedSource),
      buildContactChange("Intent", target.intent, mergedIntent),
      buildContactChange(
        "Budget min",
        formatBudget(target.budgetMin, target.budgetMin),
        formatBudget(mergedBudgetMin, mergedBudgetMin),
      ),
      buildContactChange(
        "Budget max",
        formatBudget(target.budgetMax, target.budgetMax),
        formatBudget(mergedBudgetMax, mergedBudgetMax),
      ),
      buildContactChange(
        "Preferred areas",
        formatAreas(target.preferredAreas),
        formatAreas(mergedPreferredAreas),
      ),
      buildContactChange("Notes", target.notes ?? "", mergedNotes ?? ""),
      buildContactChange(
        "Last contact",
        formatDateValue(target.lastContactAt),
        formatDateValue(mergedLastContactAt),
      ),
      buildContactChange(
        "Next follow-up",
        formatDateValue(target.nextFollowUpAt),
        formatDateValue(mergedNextFollowUpAt),
      ),
      buildContactChange(
        "Lease end date",
        formatDateValue(target.leaseEndDate),
        formatDateValue(mergedLeaseEndDate),
      ),
      buildContactChange(
        "Lease reminder",
        formatDateValue(target.leaseReminderAt),
        formatDateValue(mergedLeaseReminderAt),
      ),
    ].filter((change): change is NonNullable<typeof change> => Boolean(change));

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "contact",
      entityId: updatedTarget.id,
      action: activityLogActions.contactUpdated,
      payload: {
        officeId: input.actorOfficeId ?? null,
        contactId: updatedTarget.id,
        contactName: updatedTarget.fullName,
        objectLabel: buildContactObjectLabel(updatedTarget),
        details,
        changes,
      },
    });

    await tx.client.delete({
      where: {
        id: source.id,
      },
    });

    return {
      targetClientId: updatedTarget.id,
      targetFullName: updatedTarget.fullName,
      sourceClientId: source.id,
      sourceFullName: source.fullName,
      movedCounts,
    } satisfies FrontOfficeClientMergeResult;
  });
}

export async function updateContact(
  contactId: string,
  input: SaveContactInput,
): Promise<OfficeContactDetail | null> {
  const existing = await prisma.client.findFirst({
    where: {
      id: contactId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      ownerMembershipId: true,
      fullName: true,
      email: true,
      phone: true,
      contactType: true,
      source: true,
      stage: true,
      intent: true,
      additionalFields: true,
      notes: true,
      budgetMin: true,
      budgetMax: true,
      preferredAreas: true,
      lastContactAt: true,
      nextFollowUpAt: true,
      leaseEndDate: true,
      leaseReminderAt: true,
    },
  });

  if (!existing) {
    return null;
  }

  const nextValues = {
    fullName: input.fullName.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    contactType: input.contactType?.trim() || null,
    source: input.source?.trim() || "Manual entry",
    stage: input.stage?.trim() || "New",
    intent: input.intent?.trim() || "Unknown",
    additionalFields:
      input.additionalFields ??
      (existing.additionalFields &&
      typeof existing.additionalFields === "object" &&
      !Array.isArray(existing.additionalFields)
        ? Object.fromEntries(
            Object.entries(
              existing.additionalFields as Record<string, Prisma.JsonValue>,
            ).map(([key, value]) => [key, String(value ?? "")]),
          )
        : {}),
    notes: input.notes?.trim() || null,
    budgetMin: parseOptionalDecimal(input.budgetMin),
    budgetMax: parseOptionalDecimal(input.budgetMax),
    preferredAreas: input.preferredAreas?.filter(Boolean) ?? [],
    lastContactAt: parseOptionalDate(input.lastContactAt),
    nextFollowUpAt: parseOptionalDate(input.nextFollowUpAt),
    ...normalizeLeaseReminderInput({
      leaseEndDate: input.leaseEndDate,
      leaseReminderAt: input.leaseReminderAt,
    }),
  };

  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: contactId },
      data: {
        fullName: nextValues.fullName,
        email: nextValues.email,
        phone: nextValues.phone,
        contactType: nextValues.contactType,
        source: nextValues.source,
        stage: nextValues.stage,
        intent: nextValues.intent,
        budgetMin: nextValues.budgetMin,
        budgetMax: nextValues.budgetMax,
        preferredAreas: nextValues.preferredAreas,
        additionalFields: nextValues.additionalFields,
        notes: nextValues.notes,
        lastContactAt: nextValues.lastContactAt,
        nextFollowUpAt: nextValues.nextFollowUpAt,
        leaseEndDate: nextValues.leaseEndDate,
        leaseReminderAt: nextValues.leaseReminderAt,
      },
    });

    if (existing.stage !== nextValues.stage) {
      await createClientStageHistoryEntry(tx, {
        organizationId: input.organizationId,
        officeId: input.actorOfficeId ?? null,
        clientId: contactId,
        membershipId: input.actorMembershipId ?? input.ownerMembershipId,
        fromStage: existing.stage,
        toStage: nextValues.stage,
      });
    }

    await syncFrontOfficeHandoffDraft(tx, {
      organizationId: input.organizationId,
      officeId: input.actorOfficeId ?? null,
      clientId: contactId,
      ownerMembershipId: existing.ownerMembershipId,
      clientName: nextValues.fullName,
      stage: nextValues.stage,
    });

    const details = [
      buildContactChangedDetail(
        "Full name",
        existing.fullName,
        nextValues.fullName,
      ),
      buildContactChangedDetail(
        "Email",
        existing.email ?? "",
        nextValues.email ?? "",
      ),
      buildContactChangedDetail(
        "Phone",
        existing.phone ?? "",
        nextValues.phone ?? "",
      ),
      buildContactChangedDetail(
        "Type",
        existing.contactType ?? "",
        nextValues.contactType ?? "",
      ),
      buildContactChangedDetail("Stage", existing.stage, nextValues.stage),
      buildContactChangedDetail("Intent", existing.intent, nextValues.intent),
      buildContactChangedDetail("Source", existing.source, nextValues.source),
      buildContactChangedDetail(
        "Notes",
        existing.notes ?? "",
        nextValues.notes ?? "",
      ),
      buildContactChangedDetail(
        "Budget",
        formatBudget(existing.budgetMin, existing.budgetMax),
        formatBudget(nextValues.budgetMin, nextValues.budgetMax),
      ),
      buildContactChangedDetail(
        "Areas",
        formatAreas(existing.preferredAreas),
        formatAreas(nextValues.preferredAreas),
      ),
      buildContactChangedDetail(
        "Last contact",
        formatDateValue(existing.lastContactAt),
        formatDateValue(nextValues.lastContactAt),
      ),
      buildContactChangedDetail(
        "Next follow-up",
        formatDateValue(existing.nextFollowUpAt),
        formatDateValue(nextValues.nextFollowUpAt),
      ),
      buildContactChangedDetail(
        "Lease end date",
        formatDateValue(existing.leaseEndDate),
        formatDateValue(nextValues.leaseEndDate),
      ),
      buildContactChangedDetail(
        "Lease reminder",
        formatDateValue(existing.leaseReminderAt),
        formatDateValue(nextValues.leaseReminderAt),
      ),
      ...Object.keys(nextValues.additionalFields).map((fieldKey) =>
        buildContactChangedDetail(
          fieldKey,
          existing.additionalFields &&
            typeof existing.additionalFields === "object" &&
            !Array.isArray(existing.additionalFields)
            ? String(
                (existing.additionalFields as Record<string, Prisma.JsonValue>)[
                  fieldKey
                ] ?? "",
              )
            : "",
          nextValues.additionalFields[fieldKey] ?? "",
        ),
      ),
    ].filter((detail): detail is string => Boolean(detail));
    const changes = [
      buildContactChange("Full name", existing.fullName, nextValues.fullName),
      buildContactChange("Email", existing.email ?? "", nextValues.email ?? ""),
      buildContactChange("Phone", existing.phone ?? "", nextValues.phone ?? ""),
      buildContactChange(
        "Type",
        existing.contactType ?? "",
        nextValues.contactType ?? "",
      ),
      buildContactChange("Stage", existing.stage, nextValues.stage),
      buildContactChange("Intent", existing.intent, nextValues.intent),
      buildContactChange("Source", existing.source, nextValues.source),
      buildContactChange("Notes", existing.notes ?? "", nextValues.notes ?? ""),
      buildContactChange(
        "Budget",
        formatBudget(existing.budgetMin, existing.budgetMax),
        formatBudget(nextValues.budgetMin, nextValues.budgetMax),
      ),
      buildContactChange(
        "Areas",
        formatAreas(existing.preferredAreas),
        formatAreas(nextValues.preferredAreas),
      ),
      buildContactChange(
        "Last contact",
        formatDateValue(existing.lastContactAt),
        formatDateValue(nextValues.lastContactAt),
      ),
      buildContactChange(
        "Next follow-up",
        formatDateValue(existing.nextFollowUpAt),
        formatDateValue(nextValues.nextFollowUpAt),
      ),
      buildContactChange(
        "Lease end date",
        formatDateValue(existing.leaseEndDate),
        formatDateValue(nextValues.leaseEndDate),
      ),
      buildContactChange(
        "Lease reminder",
        formatDateValue(existing.leaseReminderAt),
        formatDateValue(nextValues.leaseReminderAt),
      ),
      ...Object.keys(nextValues.additionalFields).map((fieldKey) =>
        buildContactChange(
          fieldKey,
          existing.additionalFields &&
            typeof existing.additionalFields === "object" &&
            !Array.isArray(existing.additionalFields)
            ? String(
                (existing.additionalFields as Record<string, Prisma.JsonValue>)[
                  fieldKey
                ] ?? "",
              )
            : "",
          nextValues.additionalFields[fieldKey] ?? "",
        ),
      ),
    ].filter((change): change is NonNullable<typeof change> => Boolean(change));

    if (details.length > 0) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? input.ownerMembershipId,
        entityType: "contact",
        entityId: contactId,
        action: activityLogActions.contactUpdated,
        payload: {
          officeId: input.actorOfficeId ?? null,
          contactId,
          contactName: nextValues.fullName,
          objectLabel: buildContactObjectLabel({
            fullName: nextValues.fullName,
            email: nextValues.email,
            phone: nextValues.phone,
          }),
          changes,
          details,
        },
      });
    }
  });

  return getContactById({
    organizationId: input.organizationId,
    viewerMembershipId: input.actorMembershipId ?? input.ownerMembershipId,
    contactId,
    officeId: input.actorOfficeId ?? null,
  });
}

export async function getContactById(
  input: GetContactByIdInput,
): Promise<OfficeContactDetail | null> {
  const [contactScope, transactionScope] = await Promise.all([
    resolveOfficeDataScope({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      resource: "contacts",
    }),
    resolveOfficeDataScope({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      resource: "transactions",
    }),
  ]);
  const visibleTransactionWhere = buildScopedTransactionWhere(
    transactionScope,
    input.organizationId,
    input.officeId ?? null,
  );
  const client = await prisma.client.findFirst({
    where: {
      AND: [
        {
          id: input.contactId,
          organizationId: input.organizationId,
        },
        ...buildContactScopeWhere(contactScope, input.officeId ?? null),
      ],
    },
    include: {
      ownerMembership: {
        include: {
          user: true,
        },
      },
      followUpTasks: {
        include: {
          assigneeMembership: {
            include: {
              user: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      },
      transactionContacts: {
        where: {
          organizationId: input.organizationId,
          transaction: visibleTransactionWhere,
        },
        include: {
          transaction: true,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!client) {
    return null;
  }

  const availableTransactions = await prisma.transaction.findMany({
    where: {
      AND: [
        visibleTransactionWhere,
        {
          transactionContacts: {
            none: {
              clientId: client.id,
            },
          },
        },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      address: true,
      city: true,
      state: true,
    },
  });

  const linkedTransactions = client.transactionContacts.map(
    (transactionContact) => ({
      id: transactionContact.transaction.id,
      label: `${transactionContact.transaction.address}, ${transactionContact.transaction.city}, ${transactionContact.transaction.state} ${transactionContact.transaction.zipCode}`,
      status: transactionContact.transaction.status,
      askingPrice: formatTransactionPrice(
        transactionContact.transaction.askingPrice,
      ),
      purchasedPrice: formatTransactionPrice(
        transactionContact.transaction.purchasedPrice ??
          transactionContact.transaction.price,
      ),
      role: formatTransactionContactRole(transactionContact.role),
      isPrimary: transactionContact.isPrimary,
    }),
  );

  return {
    id: client.id,
    fullName: client.fullName,
    email: client.email ?? "",
    phone: client.phone ?? "",
    contactType: client.contactType ?? "",
    source: client.source,
    stage: client.stage,
    intent: client.intent,
    budgetMin: client.budgetMin ? String(client.budgetMin) : "",
    budgetMax: client.budgetMax ? String(client.budgetMax) : "",
    areas: client.preferredAreas,
    additionalFields:
      client.additionalFields &&
      typeof client.additionalFields === "object" &&
      !Array.isArray(client.additionalFields)
        ? Object.fromEntries(
            Object.entries(
              client.additionalFields as Record<string, Prisma.JsonValue>,
            ).map(([key, value]) => [key, String(value ?? "")]),
          )
        : {},
    notes: client.notes ?? "",
    lastContactAt: formatDateValue(client.lastContactAt),
    nextFollowUpAt: formatDateValue(client.nextFollowUpAt),
    leaseEndDate: formatDateValue(client.leaseEndDate),
    leaseReminderAt: formatDateValue(client.leaseReminderAt),
    ownerMembershipId: client.ownerMembershipId,
    ownerName: client.ownerMembership
      ? `${client.ownerMembership.user.firstName} ${client.ownerMembership.user.lastName}`
      : "Unassigned",
    linkedTransactions,
    availableTransactions: availableTransactions.map((transaction) => ({
      id: transaction.id,
      label: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`,
    })),
    followUpTasks: client.followUpTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueAt: formatDateLabel(task.dueAt),
      assigneeName: task.assigneeMembership
        ? `${task.assigneeMembership.user.firstName} ${task.assigneeMembership.user.lastName}`
        : "Unassigned",
    })),
  };
}

export async function saveFrontOfficeClientLeaseReminder(
  input: SaveFrontOfficeClientLeaseReminderInput,
) {
  const existing = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      organizationId: input.organizationId,
      ownerMembershipId: input.actorMembershipId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      leaseEndDate: true,
      leaseReminderAt: true,
    },
  });

  if (!existing) {
    return null;
  }

  const nextValues = normalizeLeaseReminderInput({
    leaseEndDate: input.leaseEndDate,
    leaseReminderAt: input.leaseReminderAt,
  });

  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: {
        id: input.clientId,
      },
      data: {
        leaseEndDate: nextValues.leaseEndDate,
        leaseReminderAt: nextValues.leaseReminderAt,
      },
    });

    const details = [
      buildContactChangedDetail(
        "Lease end date",
        formatDateValue(existing.leaseEndDate),
        formatDateValue(nextValues.leaseEndDate),
      ),
      buildContactChangedDetail(
        "Lease reminder",
        formatDateValue(existing.leaseReminderAt),
        formatDateValue(nextValues.leaseReminderAt),
      ),
    ].filter((detail): detail is string => Boolean(detail));
    const changes = [
      buildContactChange(
        "Lease end date",
        formatDateValue(existing.leaseEndDate),
        formatDateValue(nextValues.leaseEndDate),
      ),
      buildContactChange(
        "Lease reminder",
        formatDateValue(existing.leaseReminderAt),
        formatDateValue(nextValues.leaseReminderAt),
      ),
    ].filter((change): change is NonNullable<typeof change> => Boolean(change));

    if (details.length > 0) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "contact",
        entityId: input.clientId,
        action: activityLogActions.contactUpdated,
        payload: {
          officeId: input.actorOfficeId ?? null,
          contactId: input.clientId,
          contactName: existing.fullName,
          objectLabel: buildContactObjectLabel(existing),
          changes,
          details,
        },
      });
    }
  });

  return {
    id: existing.id,
    leaseEndDate: formatDateValue(nextValues.leaseEndDate),
    leaseReminderAt: formatDateValue(nextValues.leaseReminderAt),
  };
}

export async function createFollowUpTask(
  input: CreateFollowUpTaskInput,
): Promise<OfficeContactTask | null> {
  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      nextFollowUpAt: true,
    },
  });

  if (!client) {
    return null;
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.followUpTask.create({
      data: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        assigneeMemberId: input.assigneeMembershipId,
        title: input.title.trim(),
        status: TaskStatus.queued,
        dueAt: parseOptionalDate(input.dueAt),
        metadata: Prisma.JsonNull,
      },
      include: {
        assigneeMembership: {
          include: {
            user: true,
          },
        },
      },
    });

    await syncClientNextFollowUpAtFromOpenTasks(tx, {
      clientId: client.id,
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? input.assigneeMembershipId,
      entityType: "follow_up_task",
      entityId: created.id,
      action: activityLogActions.followUpTaskCreated,
      payload: {
        officeId: input.actorOfficeId ?? null,
        contactId: client.id,
        contactName: client.fullName,
        taskId: created.id,
        taskTitle: created.title,
        objectLabel: `${created.title} · ${buildContactObjectLabel(client)}`,
        details: [
          `Status: Queued`,
          ...(created.dueAt ? [`Due: ${formatDateLabel(created.dueAt)}`] : []),
          `Assignee: ${created.assigneeMembership ? `${created.assigneeMembership.user.firstName} ${created.assigneeMembership.user.lastName}` : "Unassigned"}`,
        ],
      },
    });

    await createNotificationsForMemberships(tx, {
      organizationId: input.organizationId,
      officeId: input.actorOfficeId ?? null,
      membershipIds: [input.assigneeMembershipId],
      restrictToOfficeRoles: true,
      type: NotificationType.follow_up_assigned,
      category: NotificationCategory.follow_up,
      severity: NotificationSeverity.info,
      entityType: NotificationEntityType.follow_up_task,
      entityId: created.id,
      followUpTaskId: created.id,
      title: `Follow-up assigned: ${client.fullName}`,
      body: created.dueAt
        ? `${created.title} is due on ${formatDateLabel(created.dueAt)}.`
        : `${created.title} was assigned to your follow-up queue.`,
      actionUrl: `/office/contacts/${client.id}`,
    });

    if (input.acceptedAiAction) {
      await recordFrontOfficeAiAcceptedAction(tx, {
        organizationId: input.organizationId,
        officeId: input.actorOfficeId ?? null,
        membershipId: input.actorMembershipId ?? input.assigneeMembershipId,
        clientId: client.id,
        followUpTaskId: created.id,
        actionType: "follow_up_created",
        sourceSurface: input.acceptedAiAction.sourceSurface,
        suggestionKind: input.acceptedAiAction.suggestionKind,
        suggestionLabel: input.acceptedAiAction.suggestionLabel,
        actionTitle:
          input.acceptedAiAction.actionTitle?.trim() || created.title,
      });
    }

    return created;
  });

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueAt: formatDateLabel(task.dueAt),
    assigneeName: task.assigneeMembership
      ? `${task.assigneeMembership.user.firstName} ${task.assigneeMembership.user.lastName}`
      : "Unassigned",
  };
}

export async function updateFollowUpTask(
  input: UpdateFollowUpTaskInput,
): Promise<OfficeContactTask | null> {
  const existing = await prisma.followUpTask.findFirst({
    where: {
      id: input.taskId,
      organizationId: input.organizationId,
      clientId: input.clientId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      assigneeMemberId: true,
      clientId: true,
      client: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const nextStatus =
    normalizeFollowUpTaskStatus(input.status) ?? existing.status;
  const title = input.title !== undefined ? input.title.trim() : existing.title;

  if (!title) {
    throw new Error("Task title is required.");
  }

  const dueAt =
    input.dueAt !== undefined
      ? parseOptionalDate(input.dueAt ?? undefined)
      : existing.dueAt;

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.followUpTask.update({
      where: {
        id: existing.id,
      },
      data: {
        title,
        status: nextStatus,
        dueAt,
      },
      include: {
        assigneeMembership: {
          include: {
            user: true,
          },
        },
      },
    });

    if (existing.clientId) {
      await syncClientNextFollowUpAtFromOpenTasks(tx, {
        clientId: existing.clientId,
        previousDueAt: existing.dueAt,
      });
    }

    const details = [
      title !== existing.title ? `Title: ${existing.title} → ${title}` : null,
      nextStatus !== existing.status
        ? `Status: ${existing.status} → ${nextStatus}`
        : null,
      formatDateValue(dueAt) !== formatDateValue(existing.dueAt)
        ? `Due: ${formatDateLabel(existing.dueAt)} → ${formatDateLabel(dueAt)}`
        : null,
    ].filter((detail): detail is string => Boolean(detail));

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "follow_up_task",
      entityId: updated.id,
      action: activityLogActions.followUpTaskUpdated,
      payload: {
        officeId: input.actorOfficeId ?? null,
        contactId: existing.client?.id ?? undefined,
        contactName: existing.client?.fullName ?? undefined,
        taskId: updated.id,
        taskTitle: updated.title,
        objectLabel: existing.client
          ? `${updated.title} · ${buildContactObjectLabel(existing.client)}`
          : updated.title,
        changes: details.map((detail) => ({
          label: detail.split(":")[0],
          before: "",
          after: detail,
        })),
        details,
        completed: nextStatus === TaskStatus.completed,
      },
    });

    return updated;
  });

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueAt: formatDateLabel(task.dueAt),
    assigneeName: task.assigneeMembership
      ? `${task.assigneeMembership.user.firstName} ${task.assigneeMembership.user.lastName}`
      : "Unassigned",
  };
}

export async function linkContactToTransaction(
  organizationId: string,
  contactId: string,
  transactionId: string,
  options?: LinkTransactionContactInput,
): Promise<boolean> {
  return linkTransactionContact(
    organizationId,
    contactId,
    transactionId,
    options,
  );
}
