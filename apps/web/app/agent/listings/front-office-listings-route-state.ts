import type { FrontOfficeListingsSnapshot } from "@acre/db";

export type FrontOfficeListingsRouteMode =
  | "tracked-link"
  | "client-linked"
  | "appointment-linked";

export type FrontOfficeListingsRouteLane =
  | "send-rescue"
  | "follow-through"
  | "draft-lane";

export type FrontOfficeListingsDraftAssistSource = "ai";

export type FrontOfficeListingsDraftAssist = {
  channel: "sms" | "email";
  title: string;
  subjectLine: string;
  body: string;
  suggestionKind: string | null;
  suggestionLabel: string | null;
  sourceKey: FrontOfficeListingsDraftAssistSource | null;
  sourceLabel: string | null;
};

export type FrontOfficeListingsRouteDiagnostic = {
  id: "client" | "appointment" | "draft" | "lane";
  badgeLabel: string;
  badgeTone: "accent" | "warning";
  title: string;
  description: string;
};

export type FrontOfficeListingsLaneStepTone = "accent" | "success" | "warning";

export type FrontOfficeListingsLaneStep = {
  label: string;
  detail: string;
  tone: FrontOfficeListingsLaneStepTone;
};

export type FrontOfficeListingsPreferredSupportLane = "sms" | "email" | "mixed";

export type FrontOfficeListingsRouteState = {
  cleanHref: string;
  contextHref: string;
  stableHref: string;
  stableReentryLabel: string;
  stableReentryDescription: string;
  requestedClientId: string | null;
  requestedAppointmentId: string | null;
  requestedRouteLane: FrontOfficeListingsRouteLane | null;
  requestedDraftChannel: "sms" | "email" | null;
  hasDraftAssist: boolean;
  hasRouteLaneParams: boolean;
  hasDraftAssistParams: boolean;
  diagnostics: FrontOfficeListingsRouteDiagnostic[];
  mode: FrontOfficeListingsRouteMode;
  modeLabel: string;
  modeDescription: string;
  modeContextLabel: string;
  focusedRouteLane: FrontOfficeListingsRouteLane;
  focusedRouteLaneLabel: string;
  focusedRouteLaneDescription: string;
  focusedRouteLanePanelLabel: string;
  focusedRouteLanePanelDescription: string;
  focusedRouteLaneSteps: FrontOfficeListingsLaneStep[];
  focusedRouteLaneActionLabel: string;
  routeStatusLabel: string;
  routeStatusDescription: string;
  draftStatusLabel: string;
  draftStatusDescription: string;
  preferredSupportLane: FrontOfficeListingsPreferredSupportLane;
  preferredSupportLaneLabel: string;
  preferredSupportLaneDescription: string;
};

export type FrontOfficeListingsSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type FrontOfficeListingsSearchState = {
  requestedClientId: string | null;
  requestedAppointmentId: string | null;
  requestedRouteLane: FrontOfficeListingsRouteLane | null;
  hasRouteLaneParams: boolean;
  requestedDraftChannel: "sms" | "email" | null;
  hasDraftAssistParams: boolean;
  draftAssist: FrontOfficeListingsDraftAssist | null;
};

type BuildFrontOfficeListingsRouteStateInput = {
  snapshot: FrontOfficeListingsSnapshot;
  requestedClientId: string | null;
  requestedAppointmentId: string | null;
  requestedRouteLane: FrontOfficeListingsRouteLane | null;
  hasRouteLaneParams: boolean;
  requestedDraftChannel: "sms" | "email" | null;
  draftAssist: FrontOfficeListingsDraftAssist | null;
  hasDraftAssistParams: boolean;
};

type BuildAgentListingsHrefInput = {
  clientId?: string | null;
  appointmentId?: string | null;
  lane?: FrontOfficeListingsRouteLane | null;
  draftAssist?: FrontOfficeListingsDraftAssist | null;
};

export function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

function readNormalizedSearchParamValue(value: string | string[] | undefined) {
  const normalized = readSearchParamValue(value)?.trim();

  return normalized && normalized.length ? normalized : null;
}

function buildDraftAssistSourceLabel(
  sourceKey: FrontOfficeListingsDraftAssistSource | null,
) {
  if (sourceKey === "ai") {
    return "An AI draft is loaded into the matching draft view below. Acre only preloads the message and tracked link here; nothing is sent automatically.";
  }

  return null;
}

function buildDraftAssistStatusDescription(input: {
  draftAssist: FrontOfficeListingsDraftAssist | null;
  hasDraftAssistParams: boolean;
}) {
  if (input.draftAssist) {
    return input.draftAssist.channel === "sms"
      ? "An SMS draft is active in the current follow-up view. SMS actions use the assisted copy, while email and direct-link actions stay on the standard message templates."
      : "An email draft is active in the current follow-up view. Email actions use the assisted copy, while SMS and direct-link actions stay on the standard message templates.";
  }

  if (input.hasDraftAssistParams) {
    return "The incoming draft details were incomplete or stale, so Acre kept the page on the standard message templates instead of carrying forward a broken draft.";
  }

  return "This page is using the standard message templates right now, with no saved draft attached.";
}

function buildPreferredSupportLane(input: {
  mode: FrontOfficeListingsRouteMode;
  draftAssist: FrontOfficeListingsDraftAssist | null;
}) {
  if (input.draftAssist?.channel === "sms") {
    return {
      lane: "sms" as const,
      label: "SMS support",
      description:
        "The active SMS draft should stay paired with the SMS support message so the listing link and follow-up copy stay aligned.",
    };
  }

  if (input.draftAssist?.channel === "email") {
    return {
      lane: "email" as const,
      label: "Email support",
      description:
        "The active email draft should stay paired with the email support message so the longer framing and tracked link remain aligned.",
    };
  }

  if (input.mode === "appointment-linked") {
    return {
      lane: "sms" as const,
      label: "SMS support",
      description:
        "Appointment follow-up usually needs a faster first reply, so SMS is the safest default support message for this listing.",
    };
  }

  if (input.mode === "client-linked") {
    return {
      lane: "email" as const,
      label: "Email support",
      description:
        "Client follow-up usually needs a little more framing on the first move, so email is the default support message unless the conversation is already moving quickly.",
    };
  }

  return {
    lane: "mixed" as const,
    label: "Keep both ready",
    description:
      "Tracked-link mode is not yet tied to a live client or appointment, so keep both SMS and email support messages ready until the next step is clearer.",
  };
}

function buildStableRouteReentry(input: {
  mode: FrontOfficeListingsRouteMode;
  focusedRouteLaneLabel: string;
  draftAssist: FrontOfficeListingsDraftAssist | null;
}) {
  if (input.draftAssist) {
    return {
      label: "Saved view",
      description: `Use the saved link to come back to the ${input.focusedRouteLaneLabel.toLowerCase()} with the same draft, recipient, and appointment context intact. Use reset only if you want to clear the draft and start fresh.`,
    };
  }

  if (input.mode === "appointment-linked") {
    return {
      label: "Saved view",
      description:
        "Use the saved link to come back to the appointment follow-up view with the same client and appointment context intact. Use reset only if you want to restart without the appointment thread.",
    };
  }

  if (input.mode === "client-linked") {
    return {
      label: "Saved view",
      description:
        "Use the saved link to come back to the client follow-up view with the same client context intact. Use reset only if you want to restart without the client connection.",
    };
  }

  return {
    label: "Saved view",
    description:
      "Use the saved link to reopen the same tracked-link follow-up view. Use reset only if you want to start a fresh listings page.",
  };
}

export function parseFrontOfficeListingsSearchParams(
  searchParams: FrontOfficeListingsSearchParams,
): FrontOfficeListingsSearchState {
  const hasRouteLaneParams =
    "lane" in searchParams && readSearchParamValue(searchParams.lane) != null;
  const requestedRouteLaneValue =
    readNormalizedSearchParamValue(searchParams.lane)?.toLowerCase() ?? null;
  const requestedRouteLane: FrontOfficeListingsRouteLane | null =
    requestedRouteLaneValue === "send-rescue" ||
    requestedRouteLaneValue === "follow-through" ||
    requestedRouteLaneValue === "draft-lane"
      ? requestedRouteLaneValue
      : null;
  const draftKeys = [
    "draftChannel",
    "draftBody",
    "draftSubject",
    "draftTitle",
    "draftSource",
    "draftSuggestionKind",
    "draftSuggestionLabel",
  ] as const;
  const hasDraftAssistParams = draftKeys.some(
    (key) => key in searchParams && readSearchParamValue(searchParams[key]),
  );
  const requestedDraftChannelValue =
    readNormalizedSearchParamValue(searchParams.draftChannel)?.toLowerCase() ??
    null;
  const requestedDraftChannel: "sms" | "email" | null =
    requestedDraftChannelValue === "sms" ||
    requestedDraftChannelValue === "email"
      ? requestedDraftChannelValue
      : null;
  const draftBody = readNormalizedSearchParamValue(searchParams.draftBody);
  const draftSourceValue =
    readNormalizedSearchParamValue(searchParams.draftSource)?.toLowerCase() ??
    null;
  const draftSourceKey: FrontOfficeListingsDraftAssistSource | null =
    draftSourceValue === "ai" ? "ai" : null;
  const draftAssist =
    requestedDraftChannel && draftBody
      ? {
          channel: requestedDraftChannel,
          title:
            readNormalizedSearchParamValue(searchParams.draftTitle) ||
            "Outbound draft assist",
          subjectLine:
            requestedDraftChannel === "email"
              ? readNormalizedSearchParamValue(searchParams.draftSubject) || ""
              : "",
          body: draftBody,
          suggestionKind: readNormalizedSearchParamValue(
            searchParams.draftSuggestionKind,
          ),
          suggestionLabel: readNormalizedSearchParamValue(
            searchParams.draftSuggestionLabel,
          ),
          sourceKey: draftSourceKey,
          sourceLabel: buildDraftAssistSourceLabel(draftSourceKey),
        }
      : null;

  return {
    requestedClientId: readNormalizedSearchParamValue(searchParams.clientId),
    requestedAppointmentId: readNormalizedSearchParamValue(
      searchParams.appointmentId,
    ),
    requestedRouteLane,
    hasRouteLaneParams,
    requestedDraftChannel,
    hasDraftAssistParams,
    draftAssist,
  };
}

export function buildAgentListingsHref(input: BuildAgentListingsHrefInput) {
  const params = new URLSearchParams();

  if (input.clientId?.trim()) {
    params.set("clientId", input.clientId.trim());
  }

  if (input.appointmentId?.trim()) {
    params.set("appointmentId", input.appointmentId.trim());
  }

  if (input.lane) {
    params.set("lane", input.lane);
  }

  if (input.draftAssist?.channel && input.draftAssist.body.trim()) {
    params.set("draftChannel", input.draftAssist.channel);
    params.set("draftBody", input.draftAssist.body.trim());

    if (input.draftAssist.title.trim()) {
      params.set("draftTitle", input.draftAssist.title.trim());
    }

    if (
      input.draftAssist.channel === "email" &&
      input.draftAssist.subjectLine
    ) {
      params.set("draftSubject", input.draftAssist.subjectLine.trim());
    }

    if (input.draftAssist.sourceKey) {
      params.set("draftSource", input.draftAssist.sourceKey);
    }

    if (input.draftAssist.suggestionKind?.trim()) {
      params.set(
        "draftSuggestionKind",
        input.draftAssist.suggestionKind.trim(),
      );
    }

    if (input.draftAssist.suggestionLabel?.trim()) {
      params.set(
        "draftSuggestionLabel",
        input.draftAssist.suggestionLabel.trim(),
      );
    }
  }

  const query = params.toString();

  return query ? `/agent/listings?${query}` : "/agent/listings";
}

export function buildFrontOfficeListingsRouteState(
  input: BuildFrontOfficeListingsRouteStateInput,
): FrontOfficeListingsRouteState {
  const diagnostics: FrontOfficeListingsRouteDiagnostic[] = [];
  const unresolvedClient = Boolean(
    input.requestedClientId &&
    input.snapshot.targetClient?.id !== input.requestedClientId,
  );
  const unresolvedAppointment = Boolean(
    input.requestedAppointmentId &&
    input.snapshot.targetAppointment?.id !== input.requestedAppointmentId,
  );
  const resolvedFocusedRouteLane = buildFocusedRouteLane({
    requestedRouteLane: input.requestedRouteLane,
    snapshot: input.snapshot,
    draftAssist: input.draftAssist,
  });
  const contextHref = buildAgentListingsHref({
    clientId: input.snapshot.targetClient?.id ?? null,
    appointmentId: input.snapshot.targetAppointment?.id ?? null,
    lane: resolvedFocusedRouteLane.focusedRouteLane,
  });
  const stableHref = buildAgentListingsHref({
    clientId: input.snapshot.targetClient?.id ?? null,
    appointmentId: input.snapshot.targetAppointment?.id ?? null,
    lane: resolvedFocusedRouteLane.focusedRouteLane,
    draftAssist: input.draftAssist,
  });
  let mode: FrontOfficeListingsRouteMode = "tracked-link";
  let modeLabel = "Tracked link";
  let modeDescription =
    "Private tracked links still work here, but nothing is sent automatically. To keep the next step attached to a client or appointment, reopen this page from that client or appointment.";
  let modeContextLabel = "General listing follow-up";

  if (input.snapshot.targetAppointment && input.snapshot.targetClient) {
    mode = "appointment-linked";
    modeLabel = "Appointment-linked";
    modeDescription = `Manual sends from this view stay attached to ${input.snapshot.targetClient.fullName} and the selected appointment, so the next follow-up does not lose the meeting context.`;
    modeContextLabel = `${input.snapshot.targetAppointment.typeLabel} follow-up`;
  } else if (input.snapshot.targetClient) {
    mode = "client-linked";
    modeLabel = "Client-linked";
    modeDescription = `Manual sends from this view stay attached to ${input.snapshot.targetClient.fullName}, including the current stage and follow-up history.`;
    modeContextLabel = `${input.snapshot.targetClient.stage} stage`;
  }

  if (unresolvedClient) {
    diagnostics.push({
      id: "client",
      badgeLabel: "Client link",
      badgeTone: "warning",
      title:
        mode === "appointment-linked"
          ? "Requested client context was replaced"
          : "Requested client context did not load",
      description:
        mode === "appointment-linked"
          ? "The incoming link asked for a different or unavailable client, so Acre kept the appointment-linked client that still matches this follow-up."
          : mode === "client-linked"
            ? "The incoming link did not resolve the requested client exactly, so the page stayed on the currently available client context."
            : "The incoming link requested a client that is no longer available here, so the page fell back to tracked-link mode.",
    });
  }

  if (unresolvedAppointment) {
    diagnostics.push({
      id: "appointment",
      badgeLabel: "Appointment link",
      badgeTone: "warning",
      title:
        mode === "appointment-linked"
          ? "Requested appointment context was adjusted"
          : "Appointment history is not attached",
      description:
        mode === "client-linked"
          ? "The incoming appointment could not be attached to this recipient, so follow-up will stay on the client only."
          : "The incoming appointment did not resolve into the current follow-up context, so the page is not carrying appointment history right now.",
    });
  }

  if (input.hasRouteLaneParams && !input.requestedRouteLane) {
    diagnostics.push({
      id: "lane",
      badgeLabel: "Link focus",
      badgeTone: "warning",
      title: "Requested focus did not resolve",
      description:
        "The link carried a focus parameter, but it did not match a supported view, so Acre kept the page on the nearest safe follow-up view instead.",
    });
  }

  if (input.hasDraftAssistParams && !input.draftAssist) {
    diagnostics.push({
      id: "draft",
      badgeLabel: "Link draft",
      badgeTone: "accent",
      title: "Draft assist did not load",
      description: input.requestedDraftChannel
        ? `The link carried ${input.requestedDraftChannel.toUpperCase()} draft details, but the body or required context was incomplete, so Acre stayed on the standard message templates.`
        : "The link carried draft-related details, but not enough valid data to open assisted copy, so Acre stayed on the standard message templates.",
    });
  }

  const routeStatusLabel = diagnostics.length
    ? "View adjusted"
    : resolvedFocusedRouteLane.focusedRouteLane === "draft-lane"
      ? "Draft focus"
      : resolvedFocusedRouteLane.focusedRouteLane === "follow-through"
        ? "Follow-up focus"
        : "Re-engagement focus";
  const routeStatusDescription = diagnostics.length
    ? "Acre trimmed or replaced part of the incoming link so the page could stay on a safe follow-up path. Use the saved view if you want to continue without stale parameters."
    : resolvedFocusedRouteLane.focusedRouteLaneDescription;
  const preferredSupportLane = buildPreferredSupportLane({
    mode,
    draftAssist: input.draftAssist,
  });
  const stableReentry = buildStableRouteReentry({
    mode,
    focusedRouteLaneLabel: resolvedFocusedRouteLane.focusedRouteLaneLabel,
    draftAssist: input.draftAssist,
  });

  return {
    cleanHref: "/agent/listings",
    contextHref,
    stableHref,
    stableReentryLabel: stableReentry.label,
    stableReentryDescription: stableReentry.description,
    requestedClientId: input.requestedClientId,
    requestedAppointmentId: input.requestedAppointmentId,
    requestedRouteLane: input.requestedRouteLane,
    requestedDraftChannel: input.requestedDraftChannel,
    hasDraftAssist: Boolean(input.draftAssist),
    hasRouteLaneParams: input.hasRouteLaneParams,
    hasDraftAssistParams: input.hasDraftAssistParams,
    diagnostics,
    mode,
    modeLabel,
    modeDescription,
    modeContextLabel,
    focusedRouteLane: resolvedFocusedRouteLane.focusedRouteLane,
    focusedRouteLaneLabel: resolvedFocusedRouteLane.focusedRouteLaneLabel,
    focusedRouteLaneDescription:
      resolvedFocusedRouteLane.focusedRouteLaneDescription,
    focusedRouteLanePanelLabel:
      resolvedFocusedRouteLane.focusedRouteLanePanelLabel,
    focusedRouteLanePanelDescription:
      resolvedFocusedRouteLane.focusedRouteLanePanelDescription,
    focusedRouteLaneSteps: resolvedFocusedRouteLane.focusedRouteLaneSteps,
    focusedRouteLaneActionLabel:
      resolvedFocusedRouteLane.focusedRouteLaneActionLabel,
    routeStatusLabel,
    routeStatusDescription,
    draftStatusLabel: input.draftAssist
      ? input.draftAssist.sourceKey === "ai"
        ? "AI draft ready"
        : "Draft ready"
      : input.hasDraftAssistParams
        ? "Draft adjusted"
        : "Standard copy",
    draftStatusDescription: buildDraftAssistStatusDescription({
      draftAssist: input.draftAssist,
      hasDraftAssistParams: input.hasDraftAssistParams,
    }),
    preferredSupportLane: preferredSupportLane.lane,
    preferredSupportLaneLabel: preferredSupportLane.label,
    preferredSupportLaneDescription: preferredSupportLane.description,
  };
}

function buildFocusedRouteLane(input: {
  requestedRouteLane: FrontOfficeListingsRouteLane | null;
  snapshot: FrontOfficeListingsSnapshot;
  draftAssist: FrontOfficeListingsDraftAssist | null;
}) {
  const resolvedRouteLane =
    input.requestedRouteLane ??
    (input.draftAssist
      ? "draft-lane"
      : input.snapshot.targetAppointment || input.snapshot.targetClient
        ? "follow-through"
        : "send-rescue");

  if (resolvedRouteLane === "draft-lane") {
    const draftChannelLabel = input.draftAssist
      ? input.draftAssist.channel === "sms"
        ? "SMS draft"
        : "Email draft"
      : "Draft";

    return {
      focusedRouteLane: "draft-lane" as const,
      focusedRouteLaneLabel: draftChannelLabel,
      focusedRouteLaneDescription: input.draftAssist
        ? "An assisted draft is active here. Reopen this view when you want the draft and tracked listing link to stay together."
        : "A draft view is selected here, but no assisted copy is loaded yet. Reopen from a draft link when you want the copied channel and listing link together.",
      focusedRouteLanePanelLabel: "Draft",
      focusedRouteLanePanelDescription:
        "Keep the assisted draft, channel choice, and tracked link together before copying anything.",
      focusedRouteLaneSteps: [
        {
          label: "Review the assisted draft",
          detail: "Check the loaded SMS or email copy before you use it.",
          tone: "warning" as const,
        },
        {
          label: "Match the send channel",
          detail:
            "Use the channel that matches the loaded draft so the message and listing link stay aligned.",
          tone: "accent" as const,
        },
        {
          label: "Keep the tracked link attached",
          detail:
            "Only switch views if you need a different recipient or follow-up history.",
          tone: "success" as const,
        },
      ],
      focusedRouteLaneActionLabel: input.draftAssist
        ? "Keep draft open"
        : "Open draft",
    };
  }

  if (resolvedRouteLane === "follow-through") {
    if (input.snapshot.targetAppointment && input.snapshot.targetClient) {
      return {
        focusedRouteLane: "follow-through" as const,
        focusedRouteLaneLabel: "Appointment follow-up",
        focusedRouteLaneDescription: `This view keeps ${input.snapshot.targetClient.fullName} and ${input.snapshot.targetAppointment.title} tied to the same follow-up history, so the next touch does not fall back to a generic listings page.`,
        focusedRouteLanePanelLabel: "Appointment next steps",
        focusedRouteLanePanelDescription:
          "Stay inside the appointment thread so the next send, reminder, or saved note continues the same conversation.",
        focusedRouteLaneSteps: [
          {
            label: "Keep the appointment thread attached",
            detail:
              "Use the active appointment context instead of rebuilding the send from a generic listings page.",
            tone: "accent" as const,
          },
          {
            label: "Choose the next reaction channel",
            detail:
              "Use SMS for a quick reaction and email when the client needs more framing around the listing.",
            tone: "warning" as const,
          },
          {
            label: "Save the next step",
            detail: "Record the next step before leaving the appointment loop.",
            tone: "success" as const,
          },
        ],
        focusedRouteLaneActionLabel: "Resume appointment follow-up",
      };
    }

    if (input.snapshot.targetClient) {
      return {
        focusedRouteLane: "follow-through" as const,
        focusedRouteLaneLabel: "Client follow-up",
        focusedRouteLaneDescription: `This view keeps ${input.snapshot.targetClient.fullName} attached to the same follow-up history, so the next touch reopens from the same client instead of a generic tracked link.`,
        focusedRouteLanePanelLabel: "Client next steps",
        focusedRouteLanePanelDescription:
          "Stay in the client history so the next send, reply, or re-engagement stays attached to the same record.",
        focusedRouteLaneSteps: [
          {
            label: "Keep the client context attached",
            detail:
              "Reopen from the client record so the next touch keeps the same contact, stage, and history.",
            tone: "accent" as const,
          },
          {
            label: "Pick the channel that fits the thread",
            detail:
              "Use email when the client needs framing and SMS when the next move should feel quick.",
            tone: "warning" as const,
          },
          {
            label: "Leave a written next step",
            detail: "Save the next step before you leave the client history.",
            tone: "success" as const,
          },
        ],
        focusedRouteLaneActionLabel: "Resume client follow-up",
      };
    }

    return {
      focusedRouteLane: "follow-through" as const,
      focusedRouteLaneLabel: "Follow-up",
      focusedRouteLaneDescription:
        "This follow-up view is selected, but no client or appointment is attached yet. Reopen from a client or appointment when you want the next touch to keep that history instead of staying generic.",
      focusedRouteLanePanelLabel: "Next steps",
      focusedRouteLanePanelDescription:
        "Attach this view to a client or appointment before you copy anything so the next step keeps a visible history.",
      focusedRouteLaneSteps: [
        {
          label: "Attach a client or appointment first",
          detail:
            "Open the client or appointment that should own the next touch before you send anything.",
          tone: "warning" as const,
        },
        {
          label: "Choose the right channel",
          detail:
            "Match the message channel to the conversation depth you need to preserve.",
          tone: "accent" as const,
        },
        {
          label: "Capture the next touch",
          detail: "Save the next step while the context is still fresh.",
          tone: "success" as const,
        },
      ],
      focusedRouteLaneActionLabel: "Resume follow-up",
    };
  }

  return {
    focusedRouteLane: "send-rescue" as const,
    focusedRouteLaneLabel: "Re-engagement",
    focusedRouteLaneDescription:
      "Use this view to reopen quiet tracked sends, follow up after no reply, and keep the next touch tied to the same listing history.",
    focusedRouteLanePanelLabel: "Re-engagement",
    focusedRouteLanePanelDescription:
      "Use this view to reopen a quiet send, decide the next reply, and keep the tracked history intact.",
    focusedRouteLaneSteps: [
      {
        label: "Reopen the quiet share",
        detail:
          "Start from the listing that went quiet so you can recover momentum without rebuilding everything.",
        tone: "warning" as const,
      },
      {
        label: "Pick the shortest useful reply path",
        detail:
          "Use SMS for a quick reaction or email when the lead needs more framing before they answer.",
        tone: "accent" as const,
      },
      {
        label: "Keep proof and identity nearby",
        detail:
          "Pair the follow-up with profile and proof so the next message still feels grounded.",
        tone: "success" as const,
      },
    ],
    focusedRouteLaneActionLabel: "Resume re-engagement",
  };
}
