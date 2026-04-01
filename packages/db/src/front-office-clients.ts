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
  isFrontOfficeStageReadyForBackOffice,
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
  statusValue: TaskStatus;
  dueLabel: string;
  dueAtValue: string;
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

export type FrontOfficeClientDetailWorkflowSignal = {
  pressureLabel: string;
  pressureTone: FrontOfficeClientDetailTone;
  pressureDescription: string;
  nextStepTitle: string;
  nextStepTone: FrontOfficeClientDetailTone;
  nextStepDescription: string;
  actionLabel: string;
  actionHref: string;
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
  workflow: FrontOfficeClientDetailWorkflowSignal;
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

function pickEarliestDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((earliest, value) => {
    if (!value) {
      return earliest;
    }

    if (!earliest || value.getTime() < earliest.getTime()) {
      return value;
    }

    return earliest;
  }, null);
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

function buildWorkflowSignal(input: {
  clientId: string;
  stage: string;
  lastContactAt: Date | null;
  nextTouchAt: Date | null;
  hasOverdueTask: boolean;
  openTaskCount: number;
  activeHandoff: {
    status: FrontOfficeHandoffStatus;
    href: string;
    committedTransactionId: string | null;
  } | null;
  linkedTransactionHref: string | null;
  timeZone?: string | null;
  now: Date;
}): FrontOfficeClientDetailWorkflowSignal {
  const normalizedStage = input.stage.trim().toLowerCase();
  const isClosedStage =
    normalizedStage.includes("won") || normalizedStage.includes("lost");
  const isActiveOpportunity = Boolean(normalizedStage) && !isClosedStage;
  const daysSinceLastTouch = input.lastContactAt
    ? Math.floor(
        (input.now.getTime() - input.lastContactAt.getTime()) / 86_400_000,
      )
    : null;
  const hasOverdueNextTouch = Boolean(
    input.nextTouchAt && input.nextTouchAt.getTime() < input.now.getTime(),
  );

  let pressureLabel = "Workflow healthy";
  let pressureTone: FrontOfficeClientDetailTone = "success";
  let pressureDescription =
    input.nextTouchAt || input.openTaskCount
      ? "This dossier already has an upcoming touch or task attached, so the workflow is still moving."
      : "Recent activity is still fresh, but the next touch should be scheduled before the client goes quiet.";

  if (input.hasOverdueTask) {
    pressureLabel = "Overdue follow-up";
    pressureTone = "danger";
    pressureDescription =
      "At least one follow-up task is already past due. Close the loop or reschedule it today so the client does not slip.";
  } else if (
    isActiveOpportunity &&
    daysSinceLastTouch !== null &&
    daysSinceLastTouch >= 15
  ) {
    pressureLabel = "15+ day pressure";
    pressureTone = "warning";
    pressureDescription = `No contact has been logged for ${daysSinceLastTouch} days while this opportunity is still active. The system should push the next action now.`;
  } else if (hasOverdueNextTouch) {
    pressureLabel = "Next touch overdue";
    pressureTone = "warning";
    pressureDescription = `The scheduled next touch slipped past ${formatDateLabel(input.nextTouchAt, input.timeZone)}. Move it forward or create a new follow-up.`;
  } else if (
    isActiveOpportunity &&
    !input.nextTouchAt &&
    input.openTaskCount === 0
  ) {
    pressureLabel = "No next touch scheduled";
    pressureTone = "warning";
    pressureDescription =
      "This client is active but no future follow-up is on the books yet. Add a reminder before the dossier goes stale.";
  }

  if (isFrontOfficeStageReadyForBackOffice(input.stage)) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle:
        input.activeHandoff?.status === FrontOfficeHandoffStatus.committed
          ? "Work from the Back Office record"
          : "Move this client into Back Office",
      nextStepTone:
        input.activeHandoff?.status === FrontOfficeHandoffStatus.committed
          ? "success"
          : "warning",
      nextStepDescription:
        input.activeHandoff?.status === FrontOfficeHandoffStatus.committed
          ? "Formal transaction workflow has already started. Keep execution aligned from the linked Back Office record."
          : "Negotiation, application, or offer work is now formal enough that the shared Back Office workflow should take over.",
      actionLabel:
        input.activeHandoff?.status === FrontOfficeHandoffStatus.committed
          ? "Open Back Office record"
          : "Open Back Office create flow",
      actionHref:
        input.activeHandoff?.href ??
        input.linkedTransactionHref ??
        "/office/transactions",
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("scheduled")
  ) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Confirm the showing logistics",
      nextStepTone: "accent",
      nextStepDescription:
        "Use the calendar to confirm the address, access notes, contact, and reminder timing before the appointment happens.",
      actionLabel: "Open calendar",
      actionHref: `/agent/calendar?clientId=${input.clientId}`,
    };
  }

  if (
    normalizedStage.includes("viewing") &&
    normalizedStage.includes("completed")
  ) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Capture feedback and set the next follow-up",
      nextStepTone: "accent",
      nextStepDescription:
        "Log the client reaction, narrow the shortlist, and place the next call or message on the calendar now.",
      actionLabel: "Create follow-up",
      actionHref: "#front-office-follow-up-form",
    };
  }

  if (normalizedStage.includes("lost")) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Place a nurture reminder",
      nextStepTone: "neutral",
      nextStepDescription:
        "This opportunity is marked lost, but the dossier should still carry a future check-in instead of disappearing.",
      actionLabel: "Create follow-up",
      actionHref: "#front-office-follow-up-form",
    };
  }

  if (normalizedStage.includes("won") && input.linkedTransactionHref) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Track progress from the shared transaction record",
      nextStepTone: "success",
      nextStepDescription:
        "The client is already won. Keep milestone updates aligned from the linked Back Office transaction instead of duplicating workflow here.",
      actionLabel: "Open transaction",
      actionHref: input.linkedTransactionHref,
    };
  }

  if (normalizedStage.includes("pending")) {
    return {
      pressureLabel,
      pressureTone,
      pressureDescription,
      nextStepTitle: "Clarify the blocker and owner",
      nextStepTone: "warning",
      nextStepDescription:
        "Pending stages should still have an explicit owner, due date, and unblock plan so the record does not sit quietly.",
      actionLabel: "Create follow-up",
      actionHref: "#front-office-follow-up-form",
    };
  }

  return {
    pressureLabel,
    pressureTone,
    pressureDescription,
    nextStepTitle: "Set the next call, text, or showing",
    nextStepTone: "accent",
    nextStepDescription:
      "Front Office should keep the next touch visible by default. Create a follow-up or book the next appointment before leaving this dossier.",
    actionLabel: "Create follow-up",
    actionHref: "#front-office-follow-up-form",
  };
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
  const earliestOpenTaskDueAt = client.followUpTasks.reduce<Date | null>(
    (earliest, task) => {
      if (task.status === TaskStatus.completed || !task.dueAt) {
        return earliest;
      }

      return pickEarliestDate(earliest, task.dueAt);
    },
    null,
  );
  const nextTouchAt = pickEarliestDate(
    earliestOpenTaskDueAt,
    client.nextFollowUpAt,
  );
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
  const linkedTransactionHref = client.transactionContacts[0]
    ? `/office/transactions/${client.transactionContacts[0].transaction.id}`
    : null;
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
    nextTouchLabel: formatRelativeDueLabel(nextTouchAt, now, input.timeZone),
    summary: {
      openTaskCount,
      upcomingAppointmentCount,
      stageHistoryCount: client.stageHistory.length,
      openHandoffCount,
    },
    workflow: buildWorkflowSignal({
      clientId: client.id,
      stage: client.stage,
      lastContactAt: client.lastContactAt,
      nextTouchAt,
      hasOverdueTask: client.followUpTasks.some(
        (task) =>
          task.status !== TaskStatus.completed &&
          Boolean(task.dueAt && task.dueAt.getTime() < now.getTime()),
      ),
      openTaskCount,
      activeHandoff,
      linkedTransactionHref,
      timeZone: input.timeZone,
      now,
    }),
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
      statusValue: task.status,
      dueLabel: formatTaskDueLabel(task.dueAt, now, input.timeZone),
      dueAtValue: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
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
