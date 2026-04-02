import type { Prisma } from "@prisma/client";

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

function formatDateValue(value: Date) {
  return value.toISOString().slice(0, 10);
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
