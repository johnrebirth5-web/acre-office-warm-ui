import { TaskStatus, type Prisma } from "@prisma/client";

export type FrontOfficeAiTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type FrontOfficeAiFollowUpKind =
  | "reentry"
  | "postclose"
  | "closing"
  | "lease"
  | "appointment"
  | "content_rescue"
  | "warm_engagement"
  | "handoff"
  | "generic";

export type FrontOfficeAiSourceSurface =
  | "client_dossier"
  | "dashboard_queue"
  | "listing_output";

export type FrontOfficeAiAcceptedActionType =
  | "follow_up_created"
  | "tracked_send_created";

export type FrontOfficeAiAcceptedActionContext = {
  sourceSurface: FrontOfficeAiSourceSurface;
  suggestionKind: FrontOfficeAiFollowUpKind;
  suggestionLabel: string;
  actionTitle?: string | null;
};

export type FrontOfficeAiFollowUpAction = {
  title: string;
  dueAt: string;
};

export type FrontOfficeAiAcceptedActionOutcome = {
  label: string;
  tone: FrontOfficeAiTone;
  detail: string;
  positive: boolean;
  stalled: boolean;
};

export type FrontOfficeAiHistoryAction = {
  clientId: string;
  suggestionKind: FrontOfficeAiFollowUpKind;
  actionType: FrontOfficeAiAcceptedActionType;
  createdAt: Date;
  followUpTask:
    | {
        status: TaskStatus;
        dueAt: Date | null;
      }
    | null
    | undefined;
  sendRecord:
    | {
        openCount: number;
        lastOpenedAt: Date | null;
        sentAt: Date;
      }
    | null
    | undefined;
};

export type FrontOfficeAiSuggestionHistoryStats = {
  acceptedCount: number;
  positiveCount: number;
  stalledCount: number;
  latestAcceptedAt: Date | null;
  latestPositiveAt: Date | null;
  latestStalledAt: Date | null;
};

export type FrontOfficeAiSuggestionHistoryIndex = {
  byKind: Partial<Record<FrontOfficeAiFollowUpKind, FrontOfficeAiSuggestionHistoryStats>>;
  latestByClientAndKind: Record<
    string,
    {
      actionType: FrontOfficeAiAcceptedActionType;
      createdAt: Date;
      outcome: FrontOfficeAiAcceptedActionOutcome;
    }
  >;
};

export type FrontOfficeAiSuggestionInsight = {
  priorityAdjustment: number;
  historySignals: string[];
  suppressDirectFollowUpCreation: boolean;
};

function formatDateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDisplayDate(value: Date, timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timeZone ?? undefined,
  }).format(value);
}

function formatDisplayDateTime(value: Date, timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? undefined,
  }).format(value);
}

function buildFrontOfficeAiClientKindKey(
  clientId: string,
  suggestionKind: FrontOfficeAiFollowUpKind,
) {
  return `${clientId}:${suggestionKind}`;
}

function buildSuggestedFollowUpDate(now: Date, daysFromNow: number) {
  const target = new Date(now);
  target.setDate(target.getDate() + daysFromNow);
  return formatDateValue(target);
}

export function normalizeFrontOfficeAiFollowUpKind(
  value: string | null | undefined,
): FrontOfficeAiFollowUpKind | null {
  const normalized = (value ?? "").trim().toLowerCase();

  switch (normalized) {
    case "reentry":
    case "postclose":
    case "closing":
    case "lease":
    case "appointment":
    case "content_rescue":
    case "warm_engagement":
    case "handoff":
    case "generic":
      return normalized as FrontOfficeAiFollowUpKind;
    default:
      return null;
  }
}

export function normalizeFrontOfficeAiSourceSurface(
  value: string | null | undefined,
): FrontOfficeAiSourceSurface | null {
  const normalized = (value ?? "").trim().toLowerCase();

  switch (normalized) {
    case "client_dossier":
    case "dashboard_queue":
    case "listing_output":
      return normalized as FrontOfficeAiSourceSurface;
    default:
      return null;
  }
}

export function formatFrontOfficeAiSourceSurfaceLabel(
  value: FrontOfficeAiSourceSurface,
) {
  switch (value) {
    case "client_dossier":
      return "Accepted in dossier";
    case "dashboard_queue":
      return "Accepted in dashboard";
    default:
      return "Accepted in listing output";
  }
}

export function formatFrontOfficeAiActionTypeLabel(
  value: FrontOfficeAiAcceptedActionType,
) {
  return value === "follow_up_created"
    ? "Follow-up created"
    : "Tracked send created";
}

export function buildFrontOfficeAiFollowUpAction(input: {
  kind: FrontOfficeAiFollowUpKind;
  now: Date;
  clientFullName: string;
  appointmentTitle?: string | null;
}): FrontOfficeAiFollowUpAction {
  switch (input.kind) {
    case "reentry":
      return {
        title: `Nurture check-in with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 21),
      };
    case "postclose":
      return {
        title: `Post-close check-in with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 2),
      };
    case "closing":
      return {
        title: `Confirm closing logistics with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 1),
      };
    case "lease":
      return {
        title: `Confirm lease timing with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 0),
      };
    case "appointment":
      return {
        title: `Prep ${input.appointmentTitle?.trim() || "next appointment"} with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 0),
      };
    case "content_rescue":
      return {
        title: `Follow up on sent shortlist with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 1),
      };
    case "warm_engagement":
      return {
        title: `Follow up on viewed listings with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 1),
      };
    case "handoff":
      return {
        title: `Confirm formal handoff package with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 1),
      };
    default:
      return {
        title: `Set next touch with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 2),
      };
  }
}

export function buildFrontOfficeSuggestedFollowUpHref(input: {
  clientId: string;
  title: string;
  dueAt: string;
}) {
  const params = new URLSearchParams({
    followUpTitle: input.title,
    followUpDueAt: input.dueAt,
    followUpSource: "ai",
  });

  return `/agent/clients/${input.clientId}?${params.toString()}#front-office-follow-up-form`;
}

export function mapFrontOfficeAiAcceptedActionOutcome(input: {
  actionType: FrontOfficeAiAcceptedActionType;
  followUpTask:
    | {
        status: TaskStatus;
        dueAt: Date | null;
      }
    | null
    | undefined;
  sendRecord:
    | {
        openCount: number;
        lastOpenedAt: Date | null;
        sentAt: Date;
      }
    | null
    | undefined;
  now: Date;
  timeZone?: string | null;
  staleSendDays?: number;
}): FrontOfficeAiAcceptedActionOutcome {
  if (input.actionType === "follow_up_created") {
    if (!input.followUpTask) {
      return {
        label: "Task no longer linked",
        tone: "neutral",
        detail: "The accepted follow-up task is no longer available.",
        positive: false,
        stalled: false,
      };
    }

    if (input.followUpTask.status === TaskStatus.completed) {
      return {
        label: "Completed",
        tone: "success",
        detail: "The accepted follow-up was completed.",
        positive: true,
        stalled: false,
      };
    }

    if (input.followUpTask.status === TaskStatus.canceled) {
      return {
        label: "Canceled",
        tone: "neutral",
        detail: "The accepted follow-up was canceled.",
        positive: false,
        stalled: false,
      };
    }

    if (
      input.followUpTask.dueAt &&
      input.followUpTask.dueAt.getTime() < input.now.getTime()
    ) {
      return {
        label: "Overdue",
        tone: "danger",
        detail: `Due ${formatDisplayDate(input.followUpTask.dueAt, input.timeZone)}.`,
        positive: false,
        stalled: true,
      };
    }

    if (input.followUpTask.dueAt) {
      return {
        label: "Queued",
        tone: "accent",
        detail: `Due ${formatDisplayDate(input.followUpTask.dueAt, input.timeZone)}.`,
        positive: false,
        stalled: false,
      };
    }

    return {
      label: "Queued",
      tone: "accent",
      detail: "No due date captured yet.",
      positive: false,
      stalled: false,
    };
  }

  if (!input.sendRecord) {
    return {
      label: "Send missing",
      tone: "neutral",
      detail: "The accepted tracked send is no longer available.",
      positive: false,
      stalled: false,
    };
  }

  if (input.sendRecord.openCount > 0) {
    return {
      label: "Opened",
      tone: "success",
      detail: input.sendRecord.lastOpenedAt
        ? `Last opened ${formatDisplayDateTime(input.sendRecord.lastOpenedAt, input.timeZone)}.`
        : `Opened ${input.sendRecord.openCount} time(s).`,
      positive: true,
      stalled: false,
    };
  }

  const staleSendDays = input.staleSendDays ?? 3;
  const staleThreshold = new Date(input.now);
  staleThreshold.setDate(staleThreshold.getDate() - staleSendDays);

  if (input.sendRecord.sentAt.getTime() <= staleThreshold.getTime()) {
    return {
      label: "Still unopened",
      tone: "warning",
      detail: `Sent ${formatDisplayDate(input.sendRecord.sentAt, input.timeZone)} and still has no tracked open.`,
      positive: false,
      stalled: true,
    };
  }

  return {
    label: "Awaiting open",
    tone: "accent",
    detail: `Sent ${formatDisplayDate(input.sendRecord.sentAt, input.timeZone)}.`,
    positive: false,
    stalled: false,
  };
}

export function buildFrontOfficeAiSuggestionHistoryIndex(input: {
  actions: FrontOfficeAiHistoryAction[];
  now: Date;
  timeZone?: string | null;
  staleSendDays?: number;
}): FrontOfficeAiSuggestionHistoryIndex {
  const byKind: FrontOfficeAiSuggestionHistoryIndex["byKind"] = {};
  const latestByClientAndKind: FrontOfficeAiSuggestionHistoryIndex["latestByClientAndKind"] =
    {};

  for (const action of input.actions) {
    const outcome = mapFrontOfficeAiAcceptedActionOutcome({
      actionType: action.actionType,
      followUpTask: action.followUpTask,
      sendRecord: action.sendRecord,
      now: input.now,
      timeZone: input.timeZone,
      staleSendDays: input.staleSendDays,
    });
    const kindStats = byKind[action.suggestionKind] ?? {
      acceptedCount: 0,
      positiveCount: 0,
      stalledCount: 0,
      latestAcceptedAt: null,
      latestPositiveAt: null,
      latestStalledAt: null,
    };

    kindStats.acceptedCount += 1;

    if (outcome.positive) {
      kindStats.positiveCount += 1;
      if (
        !kindStats.latestPositiveAt ||
        action.createdAt.getTime() > kindStats.latestPositiveAt.getTime()
      ) {
        kindStats.latestPositiveAt = action.createdAt;
      }
    }

    if (outcome.stalled) {
      kindStats.stalledCount += 1;
      if (
        !kindStats.latestStalledAt ||
        action.createdAt.getTime() > kindStats.latestStalledAt.getTime()
      ) {
        kindStats.latestStalledAt = action.createdAt;
      }
    }

    if (
      !kindStats.latestAcceptedAt ||
      action.createdAt.getTime() > kindStats.latestAcceptedAt.getTime()
    ) {
      kindStats.latestAcceptedAt = action.createdAt;
    }

    byKind[action.suggestionKind] = kindStats;

    const clientKindKey = buildFrontOfficeAiClientKindKey(
      action.clientId,
      action.suggestionKind,
    );
    const latestAction = latestByClientAndKind[clientKindKey];

    if (
      !latestAction ||
      action.createdAt.getTime() > latestAction.createdAt.getTime()
    ) {
      latestByClientAndKind[clientKindKey] = {
        actionType: action.actionType,
        createdAt: action.createdAt,
        outcome,
      };
    }
  }

  return {
    byKind,
    latestByClientAndKind,
  };
}

export function buildFrontOfficeAiSuggestionInsight(input: {
  historyIndex: FrontOfficeAiSuggestionHistoryIndex;
  clientId: string;
  suggestionKind: FrontOfficeAiFollowUpKind;
}): FrontOfficeAiSuggestionInsight {
  const historySignals: string[] = [];
  let priorityAdjustment = 0;
  let suppressDirectFollowUpCreation = false;
  const kindStats = input.historyIndex.byKind[input.suggestionKind] ?? null;
  const latestClientAction =
    input.historyIndex.latestByClientAndKind[
      buildFrontOfficeAiClientKindKey(input.clientId, input.suggestionKind)
    ] ?? null;

  if (latestClientAction?.outcome.stalled) {
    priorityAdjustment -= 2;
    historySignals.push(
      latestClientAction.actionType === "follow_up_created"
        ? "Escalation · the last accepted follow-up of this kind is still overdue or stalled"
        : "Escalation · the last accepted tracked send of this kind is still unopened",
    );
    suppressDirectFollowUpCreation =
      latestClientAction.actionType === "follow_up_created";
  } else if (latestClientAction?.outcome.positive) {
    priorityAdjustment -= 1;
    historySignals.push(
      latestClientAction.actionType === "follow_up_created"
        ? "Momentum · the last accepted follow-up of this kind was completed"
        : "Momentum · the last accepted tracked send of this kind was opened",
    );
  }

  if (kindStats) {
    if (
      kindStats.acceptedCount >= 2 &&
      kindStats.positiveCount > kindStats.stalledCount
    ) {
      priorityAdjustment -= 1;
      historySignals.push(
        kindStats.positiveCount >= 2
          ? "Outcome signal · similar suggestions have produced repeated positive outcomes lately"
          : "Outcome signal · this suggestion kind recently produced a positive outcome",
      );
    } else if (
      kindStats.acceptedCount >= 2 &&
      kindStats.stalledCount > kindStats.positiveCount
    ) {
      priorityAdjustment += 1;
      historySignals.push(
        "Outcome signal · similar suggestions have stalled more often lately, so Acre keeps stronger signals ahead of this one",
      );
    }
  }

  return {
    priorityAdjustment,
    historySignals: Array.from(new Set(historySignals)).slice(0, 2),
    suppressDirectFollowUpCreation,
  };
}

export async function recordFrontOfficeAiAcceptedAction(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    officeId?: string | null;
    membershipId: string;
    clientId: string;
    listingId?: string | null;
    followUpTaskId?: string | null;
    sendRecordId?: string | null;
    actionType: FrontOfficeAiAcceptedActionType;
    sourceSurface: FrontOfficeAiSourceSurface;
    suggestionKind: FrontOfficeAiFollowUpKind;
    suggestionLabel: string;
    actionTitle: string;
    channel?: "sms" | "email" | "direct" | null;
  },
) {
  return tx.frontOfficeAiAcceptedAction.create({
    data: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      membershipId: input.membershipId,
      clientId: input.clientId,
      listingId: input.listingId ?? null,
      followUpTaskId: input.followUpTaskId ?? null,
      sendRecordId: input.sendRecordId ?? null,
      actionType: input.actionType,
      sourceSurface: input.sourceSurface,
      suggestionKind: input.suggestionKind,
      suggestionLabel: input.suggestionLabel.trim(),
      actionTitle: input.actionTitle.trim(),
      channel: input.channel ?? null,
    },
  });
}
