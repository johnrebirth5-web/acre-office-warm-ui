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
  requiresReview: boolean;
  blocksDirectFollowUpCreation: boolean;
};

export type FrontOfficeAiHistoryAction = {
  clientId: string;
  suggestionKind: FrontOfficeAiFollowUpKind;
  actionType: FrontOfficeAiAcceptedActionType;
  createdAt: Date;
  actionTitle?: string | null;
  suggestionLabel?: string | null;
  sourceSurface?: FrontOfficeAiSourceSurface | null;
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
      actionTitle: string | null;
      suggestionLabel: string | null;
      sourceSurface: FrontOfficeAiSourceSurface | null;
      outcome: FrontOfficeAiAcceptedActionOutcome;
    }
  >;
};

export type FrontOfficeAiSuggestionInsight = {
  priorityAdjustment: number;
  historySignals: string[];
  suppressDirectFollowUpCreation: boolean;
  primaryActionReasonOverride: string | null;
  oneClickReasonOverride: string | null;
};

export type FrontOfficeAiDirectFollowUpState =
  | "available"
  | "suppressed_by_history"
  | "suppressed_by_boundary";

export type FrontOfficeAiBoundaryContract = {
  boundaryLabel: string;
  boundaryTone: FrontOfficeAiTone;
  boundaryDescription: string;
  primaryActionReason: string;
  oneClickReason: string;
};

export type FrontOfficeAiAcceptedActionBreakdownItem = {
  suggestionKind: FrontOfficeAiFollowUpKind;
  label: string;
  acceptedCount: number;
  positiveOutcomeCount: number;
  stalledCount: number;
  summary: string;
};

export type FrontOfficeAiAcceptedActionBreakdownWindow = {
  label: string;
  days: number;
  summary: string;
  items: FrontOfficeAiAcceptedActionBreakdownItem[];
};

export type FrontOfficeAiQueueHistoryCandidate = {
  id: string;
  clientId: string;
  suggestionKind: FrontOfficeAiFollowUpKind;
  helperLabel: string;
  whyNowSignals?: string[];
  openDossierHref: string;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  primaryActionOpensInNewTab?: boolean;
  defaultAllowsDirectFollowUpCreation?: boolean;
  basePriority: number;
  sortAt: Date;
};

export type FrontOfficeAiQueueHistoryDecoratedCandidate =
  Omit<
    FrontOfficeAiQueueHistoryCandidate,
    | "basePriority"
    | "sortAt"
    | "primaryActionLabel"
    | "primaryActionHref"
    | "primaryActionOpensInNewTab"
  > & {
    whyNowSignals: string[];
    rankingSignals: string[];
    allowsDirectFollowUpCreation: boolean;
    directFollowUpState: FrontOfficeAiDirectFollowUpState;
    primaryActionReasonOverride: string | null;
    oneClickReasonOverride: string | null;
    primaryActionLabel: string;
    primaryActionHref: string;
    primaryActionOpensInNewTab: boolean;
    priority: number;
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

function buildFrontOfficeAiWindowStart(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function trimFrontOfficeAiCopy(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatFrontOfficeAiActionReference(
  actionTitle: string | null | undefined,
  fallback: string,
) {
  const normalized = trimFrontOfficeAiCopy(actionTitle);
  return normalized ? `"${normalized}"` : fallback;
}

function formatFrontOfficeAiAcceptedSourceContext(
  value: FrontOfficeAiSourceSurface | null | undefined,
) {
  switch (value) {
    case "client_dossier":
      return "from the dossier";
    case "dashboard_queue":
      return "from the dashboard queue";
    case "listing_output":
      return "from tracked send assist";
    default:
      return null;
  }
}

function formatFrontOfficeAiAcceptedHistoryContext(input: {
  sourceSurface?: FrontOfficeAiSourceSurface | null;
  createdAt?: Date | null;
}) {
  const parts = [
    formatFrontOfficeAiAcceptedSourceContext(input.sourceSurface),
    input.createdAt ? `accepted ${formatDisplayDate(input.createdAt)}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : null;
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

export function formatFrontOfficeAiFollowUpKindLabel(
  value: FrontOfficeAiFollowUpKind,
) {
  switch (value) {
    case "reentry":
      return "Re-entry";
    case "postclose":
      return "Post-close";
    case "closing":
      return "Closing support";
    case "lease":
      return "Lease timing";
    case "appointment":
      return "Appointment prep";
    case "content_rescue":
      return "Content follow-up";
    case "warm_engagement":
      return "Warm engagement";
    case "handoff":
      return "Formal handoff";
    default:
      return "Next touch";
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
        label: "Needs review",
        tone: "neutral",
        detail:
          "The accepted AI-created follow-up is no longer linked to a live shared task, so Acre cannot prove whether it was completed, canceled, or replaced. Review the follow-up queue before creating another one.",
        positive: false,
        stalled: false,
        requiresReview: true,
        blocksDirectFollowUpCreation: true,
      };
    }

    if (input.followUpTask.status === TaskStatus.completed) {
      return {
        label: "Completed",
        tone: "success",
        detail:
          "This accepted AI-created follow-up turned into a completed shared task. Acre treats that as a positive execution outcome, but the actual touch still required agent follow-through.",
        positive: true,
        stalled: false,
        requiresReview: false,
        blocksDirectFollowUpCreation: false,
      };
    }

    if (input.followUpTask.status === TaskStatus.canceled) {
      return {
        label: "Canceled",
        tone: "neutral",
        detail:
          "This accepted AI-created follow-up was canceled or intentionally replaced, so Acre is not treating it as the active next step anymore.",
        positive: false,
        stalled: false,
        requiresReview: false,
        blocksDirectFollowUpCreation: false,
      };
    }

    if (
      input.followUpTask.dueAt &&
      input.followUpTask.dueAt.getTime() < input.now.getTime()
    ) {
      return {
        label: "Overdue",
        tone: "danger",
        detail: `The AI-created follow-up is still open and was due ${formatDisplayDate(
          input.followUpTask.dueAt,
          input.timeZone,
        )}. Review or resolve it before creating another one. Acre will not stack a second AI-created reminder behind an overdue task.`,
        positive: false,
        stalled: true,
        requiresReview: true,
        blocksDirectFollowUpCreation: true,
      };
    }

    if (input.followUpTask.dueAt) {
      return {
        label: "Live follow-up",
        tone: "accent",
        detail: `The AI-created follow-up is already queued for ${formatDisplayDate(
          input.followUpTask.dueAt,
          input.timeZone,
        )}. Acre pauses duplicate one-click creation until that task is resolved so the current plan can be reviewed before another follow-up is added.`,
        positive: false,
        stalled: false,
        requiresReview: false,
        blocksDirectFollowUpCreation: true,
      };
    }

    return {
      label: "Live follow-up",
      tone: "accent",
      detail:
        "The AI-created follow-up is already queued without a due date. Review that live task before creating another one so Acre does not stack duplicate reminders without confirmation.",
      positive: false,
      stalled: false,
      requiresReview: false,
      blocksDirectFollowUpCreation: true,
    };
  }

  if (!input.sendRecord) {
    return {
      label: "Needs review",
      tone: "neutral",
      detail:
        "The accepted tracked send is no longer linked to a live send record, so Acre cannot confirm delivery or engagement from history alone. Review listing output before using this suggestion as a new trigger.",
      positive: false,
      stalled: false,
      requiresReview: true,
      blocksDirectFollowUpCreation: false,
    };
  }

  if (input.sendRecord.openCount > 0) {
    return {
      label: "Opened",
      tone: "success",
      detail: input.sendRecord.lastOpenedAt
        ? `This accepted tracked send produced engagement on ${formatDisplayDateTime(
            input.sendRecord.lastOpenedAt,
            input.timeZone,
          )}. Acre treats that as a positive signal, but the next reply still needs agent judgment.`
        : `This accepted tracked send was opened ${input.sendRecord.openCount} time(s). Acre treats that as a positive signal, not an auto-reply.`,
      positive: true,
      stalled: false,
      requiresReview: false,
      blocksDirectFollowUpCreation: false,
    };
  }

  const staleSendDays = input.staleSendDays ?? 3;
  const staleThreshold = new Date(input.now);
  staleThreshold.setDate(staleThreshold.getDate() - staleSendDays);

  if (input.sendRecord.sentAt.getTime() <= staleThreshold.getTime()) {
    return {
      label: "Still unopened",
      tone: "warning",
      detail: `The tracked send went out ${formatDisplayDate(
        input.sendRecord.sentAt,
        input.timeZone,
      )} and still has no recorded open. Treat this as a rescue cue for manual review, not an auto-send repeat.`,
      positive: false,
      stalled: true,
      requiresReview: true,
      blocksDirectFollowUpCreation: false,
    };
  }

  return {
    label: "Awaiting open",
    tone: "accent",
    detail: `The tracked send went out ${formatDisplayDate(
      input.sendRecord.sentAt,
      input.timeZone,
    )} and is still waiting on the first tracked open. Acre is holding this as a watchpoint only; a human still decides if or when to send anything else.`,
    positive: false,
    stalled: false,
    requiresReview: false,
    blocksDirectFollowUpCreation: false,
  };
}

export function buildFrontOfficeAiBoundaryContract(input: {
  suggestionKind: FrontOfficeAiFollowUpKind;
  hasLinkedTransaction: boolean;
  isReadyForBackOffice: boolean;
  hasClosedTransaction: boolean;
  hasCancelledTransaction: boolean;
  directFollowUpState: FrontOfficeAiDirectFollowUpState;
  primaryActionReasonOverride?: string | null;
  oneClickReasonOverride?: string | null;
}): FrontOfficeAiBoundaryContract {
  let boundaryLabel = "Stay in Front Office";
  let boundaryTone: FrontOfficeAiTone = "accent";
  let boundaryDescription =
    "The next move is still client-facing outreach, prep, or follow-up in Front Office. Acre can stage tasks and drafts here, but the formal record still starts only when the work moves into Back Office.";
  let primaryActionReason =
    "The primary action stays in Front Office because the next best move is still a client-facing touch or prep step, not formal transaction execution.";

  if (input.hasCancelledTransaction) {
    boundaryLabel = "Return to Front Office";
    boundaryTone = "warning";
    boundaryDescription =
      "The formal file is no longer the driver. Rebuild timing, trust, and intent in Front Office before any new Back Office handoff starts.";
    primaryActionReason =
      "The primary action stays on re-entry follow-up because this relationship needs a calm restart, not another formal workflow jump.";
  } else if (
    input.suggestionKind === "handoff" &&
    input.isReadyForBackOffice &&
    !input.hasLinkedTransaction
  ) {
    boundaryLabel = "Move into Back Office";
    boundaryTone = "warning";
    boundaryDescription =
      "Use Front Office only to confirm package, timing, and client expectations. The next auditable record should open in Back Office rather than becoming another Front Office-only workflow.";
    primaryActionReason =
      "The primary action should move into Back Office now because the record has crossed from prep into offer, application, or contract-style work that needs a formal system of record.";
  } else if (input.hasClosedTransaction) {
    boundaryLabel = "Back Office record stays primary";
    boundaryTone = "success";
    boundaryDescription =
      "The deal is already formal and closed. Keep this touch client-facing in Front Office, but let milestones, money, signatures, and archival truth stay in Back Office.";
    primaryActionReason =
      "The primary action stays tied to recap, support, or referral timing because the formal milestone already exists in Back Office.";
  } else if (input.hasLinkedTransaction) {
    boundaryLabel = "Client-facing touch, BO file live";
    boundaryTone = "accent";
    boundaryDescription =
      "Use Front Office for communication and reminder framing only. Deadlines, signatures, checklist work, and formal status should keep living in the linked Back Office file.";
    primaryActionReason =
      "The primary action should keep client communication aligned with the linked Back Office record instead of creating a parallel Front Office workflow.";
  }

  if (
    input.directFollowUpState === "suppressed_by_history" &&
    input.primaryActionReasonOverride
  ) {
    primaryActionReason = input.primaryActionReasonOverride;
  } else if (input.directFollowUpState === "suppressed_by_history") {
    primaryActionReason =
      "The primary action is review, not creation, because Acre already turned a similar suggestion into a live follow-up and it still needs agent confirmation before another one is added.";
  }

  let oneClickReason =
    "One-click follow-up is available because Acre will only create a shared Front Office task here. It will not auto-send outreach, update an external system, or replace your judgment on timing.";

  if (input.oneClickReasonOverride) {
    oneClickReason = input.oneClickReasonOverride;
  } else if (input.directFollowUpState === "suppressed_by_history") {
    oneClickReason =
      "One-click follow-up is paused because a similar AI-created follow-up is still unresolved. Acre sends you back to that live task first so you do not stack duplicates without review.";
  } else if (input.directFollowUpState === "suppressed_by_boundary") {
    oneClickReason =
      "One-click follow-up is intentionally paused because the next auditable move is a formal Back Office transition, not another Front Office reminder.";
  } else if (input.hasLinkedTransaction) {
    oneClickReason =
      "One-click follow-up is still safe for this client-facing touch because it creates a Front Office reminder only. It does not update the linked Back Office checklist, deadline, or milestone for you.";
  }

  return {
    boundaryLabel,
    boundaryTone,
    boundaryDescription,
    primaryActionReason,
    oneClickReason,
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
        actionTitle: trimFrontOfficeAiCopy(action.actionTitle),
        suggestionLabel: trimFrontOfficeAiCopy(action.suggestionLabel),
        sourceSurface: action.sourceSurface ?? null,
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
  let primaryActionReasonOverride: string | null = null;
  let oneClickReasonOverride: string | null = null;
  const kindStats = input.historyIndex.byKind[input.suggestionKind] ?? null;
  const latestClientAction =
    input.historyIndex.latestByClientAndKind[
      buildFrontOfficeAiClientKindKey(input.clientId, input.suggestionKind)
    ] ?? null;
  const latestAcceptedContext = latestClientAction
    ? formatFrontOfficeAiAcceptedHistoryContext({
        sourceSurface: latestClientAction.sourceSurface,
        createdAt: latestClientAction.createdAt,
      })
    : null;
  const latestAcceptedSuffix = latestAcceptedContext
    ? ` (${latestAcceptedContext})`
    : "";

  if (
    latestClientAction?.actionType === "follow_up_created" &&
    latestClientAction.outcome.blocksDirectFollowUpCreation
  ) {
    const actionReference = formatFrontOfficeAiActionReference(
      latestClientAction.actionTitle,
      "the last AI-created follow-up",
    );

    suppressDirectFollowUpCreation = true;
    primaryActionReasonOverride =
      latestClientAction.outcome.stalled || latestClientAction.outcome.requiresReview
        ? `The primary action is review, not creation, because Acre already turned this suggestion into ${actionReference}${latestAcceptedSuffix} and that task still needs agent review.`
        : `The primary action is review, not creation, because Acre already turned this suggestion into ${actionReference}${latestAcceptedSuffix} and that live task is still on the queue.`;
    oneClickReasonOverride =
      latestClientAction.outcome.stalled || latestClientAction.outcome.requiresReview
        ? `One-click follow-up is paused because Acre already created ${actionReference}${latestAcceptedSuffix} and it still needs review. Resolve that task before adding another AI-created follow-up.`
        : `One-click follow-up is paused because Acre already created ${actionReference}${latestAcceptedSuffix} and it is still active. Acre keeps duplicate follow-up creation behind that live task.`;

    if (latestClientAction.outcome.stalled) {
      priorityAdjustment -= 2;
      historySignals.push(
        `Escalation · ${actionReference}${latestAcceptedSuffix} is overdue, so Acre promotes review before any new duplicate follow-up.`,
      );
    } else if (latestClientAction.outcome.requiresReview) {
      priorityAdjustment -= 1;
      historySignals.push(
        `Review guard · ${actionReference}${latestAcceptedSuffix} can no longer be confirmed from history, so Acre pauses duplicate one-click creation until you review it.`,
      );
    } else {
      priorityAdjustment += 2;
      historySignals.push(
        `Guardrail · ${actionReference}${latestAcceptedSuffix} is already active, so Acre keeps stronger unresolved work ahead of a duplicate follow-up.`,
      );
    }
  } else if (latestClientAction?.outcome.stalled) {
    priorityAdjustment -= 2;
    historySignals.push(
      latestClientAction.actionType === "tracked_send_created"
        ? `Escalation · the last accepted tracked send of this kind is still unopened${latestAcceptedSuffix}, so Acre promotes a rescue-style review now`
        : `Escalation · the last accepted action of this kind is still stalled${latestAcceptedSuffix} and needs review`,
    );
  } else if (latestClientAction?.outcome.positive) {
    priorityAdjustment -= 1;
    historySignals.push(
      latestClientAction.actionType === "follow_up_created"
        ? `Momentum · the last accepted follow-up of this kind was completed cleanly${latestAcceptedSuffix}, so Acre trusts this play more than an unproven path`
        : `Momentum · the last accepted tracked send of this kind produced a tracked open${latestAcceptedSuffix}, so Acre trusts this play more than an unproven path`,
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
          ? `Outcome signal · similar suggestions of this kind produced ${kindStats.positiveCount} positive outcomes versus ${kindStats.stalledCount} stalls in accepted history, so Acre lets the more reliable pattern rise`
          : "Outcome signal · this suggestion kind recently produced a positive outcome without adding more stalls, so Acre gives it a modest ranking lift",
      );
    } else if (
      kindStats.acceptedCount >= 2 &&
      kindStats.stalledCount > kindStats.positiveCount
    ) {
      priorityAdjustment += 1;
      historySignals.push(
        `Outcome signal · similar suggestions of this kind stalled ${kindStats.stalledCount} time(s) versus ${kindStats.positiveCount} positive outcomes, so Acre keeps stronger live-record signals ahead of this one`,
      );
    }
  }

  return {
    priorityAdjustment,
    historySignals: Array.from(new Set(historySignals)).slice(0, 3),
    suppressDirectFollowUpCreation,
    primaryActionReasonOverride,
    oneClickReasonOverride,
  };
}

export function rankFrontOfficeAiQueueHistoryCandidates<T extends FrontOfficeAiQueueHistoryCandidate>(
  input: {
    candidates: T[];
    historyIndex: FrontOfficeAiSuggestionHistoryIndex;
  },
): Array<
  Omit<
    T,
    | "basePriority"
    | "sortAt"
    | "primaryActionLabel"
    | "primaryActionHref"
    | "primaryActionOpensInNewTab"
  > &
    FrontOfficeAiQueueHistoryDecoratedCandidate
> {
  return input.candidates
    .map((candidate) => {
      const insight = buildFrontOfficeAiSuggestionInsight({
        historyIndex: input.historyIndex,
        clientId: candidate.clientId,
        suggestionKind: candidate.suggestionKind,
      });
      const directFollowUpState: FrontOfficeAiDirectFollowUpState =
        insight.suppressDirectFollowUpCreation
          ? "suppressed_by_history"
          : candidate.defaultAllowsDirectFollowUpCreation === false
            ? "suppressed_by_boundary"
            : "available";

      return {
        ...candidate,
        whyNowSignals:
          candidate.whyNowSignals?.length
            ? candidate.whyNowSignals
            : candidate.helperLabel
              ? [candidate.helperLabel]
              : [],
        rankingSignals: insight.historySignals,
        allowsDirectFollowUpCreation:
          candidate.defaultAllowsDirectFollowUpCreation !== false &&
          !insight.suppressDirectFollowUpCreation,
        directFollowUpState,
        primaryActionReasonOverride: insight.primaryActionReasonOverride,
        oneClickReasonOverride: insight.oneClickReasonOverride,
        primaryActionLabel: insight.suppressDirectFollowUpCreation
          ? "Review existing follow-up"
          : candidate.primaryActionLabel ?? "Open AI dossier",
        primaryActionHref: insight.suppressDirectFollowUpCreation
          ? `/agent/clients/${candidate.clientId}#front-office-follow-up-form`
          : candidate.primaryActionHref ?? candidate.openDossierHref,
        primaryActionOpensInNewTab: insight.suppressDirectFollowUpCreation
          ? false
          : candidate.primaryActionOpensInNewTab ?? false,
        priority: candidate.basePriority + insight.priorityAdjustment,
      };
    })
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.sortAt.getTime() - right.sortAt.getTime(),
    );
}

export function buildFrontOfficeAiAcceptedActionBreakdown(input: {
  historyIndex: FrontOfficeAiSuggestionHistoryIndex;
  limit?: number;
  suggestionKinds?: FrontOfficeAiFollowUpKind[];
}): FrontOfficeAiAcceptedActionBreakdownItem[] {
  const allowedKinds = input.suggestionKinds
    ? new Set(input.suggestionKinds)
    : null;

  return Object.entries(input.historyIndex.byKind)
    .flatMap(([suggestionKind, stats]) => {
      if (!stats) {
        return [];
      }

      const typedKind = suggestionKind as FrontOfficeAiFollowUpKind;

      if (allowedKinds && !allowedKinds.has(typedKind)) {
        return [];
      }

      const parts = [
        `${stats.acceptedCount} accepted`,
        `${stats.positiveCount} positive`,
        stats.stalledCount > 0 ? `${stats.stalledCount} stalled` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return [
        {
          suggestionKind: typedKind,
          label: formatFrontOfficeAiFollowUpKindLabel(typedKind),
          acceptedCount: stats.acceptedCount,
          positiveOutcomeCount: stats.positiveCount,
          stalledCount: stats.stalledCount,
          summary: parts,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.positiveOutcomeCount - left.positiveOutcomeCount ||
        right.acceptedCount - left.acceptedCount ||
        left.stalledCount - right.stalledCount ||
        left.label.localeCompare(right.label),
    )
    .slice(0, input.limit ?? 3);
}

export function buildFrontOfficeAiAcceptedActionBreakdownWindows(input: {
  actions: FrontOfficeAiHistoryAction[];
  now: Date;
  limit?: number;
  suggestionKinds?: FrontOfficeAiFollowUpKind[];
  windows?: number[];
}): FrontOfficeAiAcceptedActionBreakdownWindow[] {
  const windows = input.windows ?? [7, 90];

  return windows.map((days) => {
    const windowActions = input.actions.filter(
      (action) =>
        action.createdAt.getTime() >=
        buildFrontOfficeAiWindowStart(input.now, days).getTime(),
    );
    const historyIndex = buildFrontOfficeAiSuggestionHistoryIndex({
      actions: windowActions,
      now: input.now,
    });
    const items = buildFrontOfficeAiAcceptedActionBreakdown({
      historyIndex,
      limit: input.limit,
      suggestionKinds: input.suggestionKinds,
    });
    const acceptedCount = items.reduce(
      (total, item) => total + item.acceptedCount,
      0,
    );
    const positiveCount = items.reduce(
      (total, item) => total + item.positiveOutcomeCount,
      0,
    );
    const stalledCount = items.reduce(
      (total, item) => total + item.stalledCount,
      0,
    );

    return {
      label: `Last ${days}d`,
      days,
      summary: [
        `${acceptedCount} accepted`,
        `${positiveCount} positive`,
        stalledCount > 0 ? `${stalledCount} stalled` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      items,
    };
  });
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
