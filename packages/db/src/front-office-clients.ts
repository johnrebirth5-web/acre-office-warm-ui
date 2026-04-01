import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "./client";
import {
  buildFrontOfficeHandoffCreateHref,
  buildFrontOfficeHandoffSummary,
} from "./front-office-contracts";
import { formatDateTimeLabel } from "./date-time";

export type FrontOfficeClientDetailTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type FrontOfficeClientDetailStageHistoryItem = {
  id: string;
  title: string;
  description: string;
  changedAtLabel: string;
  tone: FrontOfficeClientDetailTone;
};

export type FrontOfficeClientDetailAppointmentItem = {
  id: string;
  title: string;
  typeLabel: string;
  typeTone: FrontOfficeClientDetailTone;
  statusLabel: string;
  statusTone: FrontOfficeClientDetailTone;
  startsAtLabel: string;
  locationLabel: string;
  contextLabel: string;
};

export type FrontOfficeClientDetailTaskItem = {
  id: string;
  title: string;
  dueLabel: string;
  statusLabel: string;
  tone: FrontOfficeClientDetailTone;
  assigneeLabel: string;
};

export type FrontOfficeClientDetailHandoffItem = {
  id: string;
  stageLabel: string;
  statusLabel: string;
  tone: FrontOfficeClientDetailTone;
  summary: string;
  updatedAtLabel: string;
  href: string;
};

export type FrontOfficeClientDetailTransactionItem = {
  id: string;
  label: string;
  statusLabel: string;
  roleLabel: string;
  href: string;
};

export type FrontOfficeClientDetailSnapshot = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  stage: string;
  stageTone: FrontOfficeClientDetailTone;
  sourceLabel: string;
  intentLabel: string;
  budgetLabel: string;
  preferredAreasLabel: string;
  notesLabel: string;
  ownerLabel: string;
  lastTouchLabel: string;
  nextTouchLabel: string;
  summary: {
    openTaskCount: number;
    upcomingAppointmentCount: number;
    stageHistoryCount: number;
    openHandoffCount: number;
  };
  stageHistory: FrontOfficeClientDetailStageHistoryItem[];
  appointments: FrontOfficeClientDetailAppointmentItem[];
  followUpTasks: FrontOfficeClientDetailTaskItem[];
  handoffs: FrontOfficeClientDetailHandoffItem[];
  linkedTransactions: FrontOfficeClientDetailTransactionItem[];
};

export type GetFrontOfficeClientDetailInput = {
  organizationId: string;
  viewerMembershipId: string;
  clientId: string;
  timeZone?: string | null;
};

function formatCurrency(value: number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
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
    year: "numeric",
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

function mapClientStageTone(stage: string): FrontOfficeClientDetailTone {
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

function mapAppointmentTypeTone(
  type: AppointmentType,
): FrontOfficeClientDetailTone {
  switch (type) {
    case AppointmentType.showing:
    case AppointmentType.open_house:
      return "accent";
    case AppointmentType.consultation:
      return "success";
    case AppointmentType.client_meeting:
      return "warning";
    default:
      return "neutral";
  }
}

function mapAppointmentStatusTone(
  status: AppointmentStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case AppointmentStatus.completed:
      return "success";
    case AppointmentStatus.no_show:
      return "warning";
    case AppointmentStatus.canceled:
      return "danger";
    default:
      return "accent";
  }
}

function formatAppointmentTypeLabel(type: AppointmentType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatAppointmentStatusLabel(status: AppointmentStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapTaskTone(
  status: TaskStatus,
  dueAt: Date | null,
  now: Date,
): FrontOfficeClientDetailTone {
  if (status === TaskStatus.completed) {
    return "success";
  }

  if (!dueAt) {
    return "neutral";
  }

  if (dueAt.getTime() < now.getTime()) {
    return "warning";
  }

  return "accent";
}

function formatTaskStatusLabel(status: TaskStatus) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatTaskDueLabel(
  dueAt: Date | null,
  now: Date,
  timeZone?: string | null,
) {
  if (!dueAt) {
    return "No due date";
  }

  const dueTime = dueAt.getTime();
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
    return `Overdue · ${formatDateLabel(dueAt, timeZone)}`;
  }

  if (dueTime < startOfTomorrow) {
    return `Due today · ${formatDateLabel(dueAt, timeZone)}`;
  }

  return `Due ${formatDateLabel(dueAt, timeZone)}`;
}

function mapHandoffTone(
  status: FrontOfficeHandoffStatus,
): FrontOfficeClientDetailTone {
  switch (status) {
    case FrontOfficeHandoffStatus.committed:
      return "success";
    case FrontOfficeHandoffStatus.canceled:
      return "neutral";
    case FrontOfficeHandoffStatus.ready:
      return "warning";
    default:
      return "accent";
  }
}

function formatHandoffStatusLabel(status: FrontOfficeHandoffStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTransactionStatusLabel(status: string) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export async function getFrontOfficeClientDetail(
  input: GetFrontOfficeClientDetailInput,
): Promise<FrontOfficeClientDetailSnapshot | null> {
  const now = new Date();
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

  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      organizationId: input.organizationId,
      ownerMembershipId: input.viewerMembershipId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      source: true,
      stage: true,
      intent: true,
      budgetMin: true,
      budgetMax: true,
      preferredAreas: true,
      notes: true,
      lastContactAt: true,
      nextFollowUpAt: true,
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
      followUpTasks: {
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 6,
        select: {
          id: true,
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
      },
      appointments: {
        where: {
          startsAt: {
            gte: thirtyDaysAgo,
            lte: thirtyDaysFromNow,
          },
        },
        orderBy: [{ startsAt: "asc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          startsAt: true,
          location: true,
          meetingUrl: true,
          contactLabel: true,
          listing: {
            select: {
              title: true,
              neighborhood: true,
              city: true,
            },
          },
        },
      },
      stageHistory: {
        orderBy: [{ createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          fromStage: true,
          toStage: true,
          note: true,
          createdAt: true,
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
      },
      handoffDrafts: {
        orderBy: [{ updatedAt: "desc" }],
        take: 4,
        select: {
          id: true,
          stageLabel: true,
          summary: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          committedAt: true,
          committedTransactionId: true,
        },
      },
      transactionContacts: {
        where: {
          organizationId: input.organizationId,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          role: true,
          transaction: {
            select: {
              id: true,
              title: true,
              address: true,
              city: true,
              state: true,
              zipCode: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!client) {
    return null;
  }

  const openTaskCount = client.followUpTasks.filter(
    (task) => task.status !== TaskStatus.completed,
  ).length;
  const upcomingAppointmentCount = client.appointments.filter(
    (appointment) =>
      appointment.status === AppointmentStatus.scheduled &&
      appointment.startsAt.getTime() >= now.getTime(),
  ).length;
  const openHandoffCount = client.handoffDrafts.filter(
    (draft) =>
      draft.status === FrontOfficeHandoffStatus.draft ||
      draft.status === FrontOfficeHandoffStatus.ready,
  ).length;

  return {
    id: client.id,
    fullName: client.fullName,
    email: client.email?.trim() || "",
    phone: client.phone?.trim() || "",
    stage: client.stage,
    stageTone: mapClientStageTone(client.stage),
    sourceLabel: client.source?.trim() || "Source not captured",
    intentLabel: client.intent?.trim() || "Intent not captured",
    budgetLabel: formatBudgetRange(
      client.budgetMin ? Number(client.budgetMin) : null,
      client.budgetMax ? Number(client.budgetMax) : null,
    ),
    preferredAreasLabel: client.preferredAreas.length
      ? client.preferredAreas.join(", ")
      : "Areas not captured",
    notesLabel: client.notes?.trim() || "No internal notes yet",
    ownerLabel:
      `${client.ownerMembership?.user.firstName ?? ""} ${client.ownerMembership?.user.lastName ?? ""}`.trim() ||
      client.ownerMembership?.user.email ||
      "Unassigned",
    lastTouchLabel: client.lastContactAt
      ? `Last contact · ${formatDateLabel(client.lastContactAt, input.timeZone)}`
      : "No contact logged yet",
    nextTouchLabel: formatRelativeDueLabel(
      client.nextFollowUpAt,
      now,
      input.timeZone,
    ),
    summary: {
      openTaskCount,
      upcomingAppointmentCount,
      stageHistoryCount: client.stageHistory.length,
      openHandoffCount,
    },
    stageHistory: client.stageHistory.map((entry) => {
      const actorLabel =
        `${entry.membership?.user.firstName ?? ""} ${entry.membership?.user.lastName ?? ""}`.trim() ||
        entry.membership?.user.email ||
        "Front Office";
      const transitionLabel = entry.fromStage?.trim()
        ? `${entry.fromStage} → ${entry.toStage}`
        : `Entered ${entry.toStage}`;

      return {
        id: entry.id,
        title: transitionLabel,
        description: [entry.note?.trim() || "", `Updated by ${actorLabel}`]
          .filter(Boolean)
          .join(" · "),
        changedAtLabel: formatDateTimeLabel(entry.createdAt, {
          timeZone: input.timeZone ?? null,
        }),
        tone: mapClientStageTone(entry.toStage),
      };
    }),
    appointments: client.appointments.map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      typeLabel: formatAppointmentTypeLabel(appointment.type),
      typeTone: mapAppointmentTypeTone(appointment.type),
      statusLabel: formatAppointmentStatusLabel(appointment.status),
      statusTone: mapAppointmentStatusTone(appointment.status),
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
    })),
    followUpTasks: client.followUpTasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueLabel: formatTaskDueLabel(task.dueAt, now, input.timeZone),
      statusLabel: formatTaskStatusLabel(task.status),
      tone: mapTaskTone(task.status, task.dueAt, now),
      assigneeLabel:
        `${task.assigneeMembership?.user.firstName ?? ""} ${task.assigneeMembership?.user.lastName ?? ""}`.trim() ||
        task.assigneeMembership?.user.email ||
        "Unassigned",
    })),
    handoffs: client.handoffDrafts.map((draft) => ({
      id: draft.id,
      stageLabel: draft.stageLabel,
      statusLabel: formatHandoffStatusLabel(draft.status),
      tone: mapHandoffTone(draft.status),
      summary:
        draft.summary?.trim() ||
        buildFrontOfficeHandoffSummary(draft.stageLabel, client.fullName),
      updatedAtLabel: formatDateTimeLabel(
        draft.committedAt ?? draft.updatedAt ?? draft.createdAt,
        { timeZone: input.timeZone ?? null },
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
