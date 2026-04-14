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
    return "AI draft loaded into the matching view.";
  }

  return null;
}

function buildDraftAssistStatusDescription(input: {
  draftAssist: FrontOfficeListingsDraftAssist | null;
  hasDraftAssistParams: boolean;
}) {
  if (input.draftAssist) {
    return input.draftAssist.channel === "sms"
      ? "SMS draft loaded."
      : "Email draft loaded.";
  }

  if (input.hasDraftAssistParams) {
    return "Draft details were incomplete, so Acre kept standard copy.";
  }

  return "Standard copy.";
}

function buildPreferredSupportLane(input: {
  mode: FrontOfficeListingsRouteMode;
  draftAssist: FrontOfficeListingsDraftAssist | null;
}) {
  if (input.draftAssist?.channel === "sms") {
    return {
      lane: "sms" as const,
      label: "SMS support",
      description: "Use the loaded SMS draft and keep the link attached.",
    };
  }

  if (input.draftAssist?.channel === "email") {
    return {
      lane: "email" as const,
      label: "Email support",
      description: "Use the loaded email draft and keep the link attached.",
    };
  }

  if (input.mode === "appointment-linked") {
    return {
      lane: "sms" as const,
      label: "SMS support",
      description: "Appointment follow-up usually starts faster in SMS.",
    };
  }

  if (input.mode === "client-linked") {
    return {
      lane: "email" as const,
      label: "Email support",
      description: "Client follow-up usually needs a little more framing.",
    };
  }

  return {
    lane: "mixed" as const,
    label: "Keep both ready",
    description: "Tracked-link mode stays manual until the next step is clear.",
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
      description: `Return here with the same draft and context intact.`,
    };
  }

  if (input.mode === "appointment-linked") {
    return {
      label: "Saved view",
      description: "Return here with the same appointment context intact.",
    };
  }

  if (input.mode === "client-linked") {
    return {
      label: "Saved view",
      description: "Return here with the same client context intact.",
    };
  }

  return {
    label: "Saved view",
    description: "Return here with the same tracked-link view intact.",
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
            "Saved draft",
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
          ? "Appointment link was adjusted"
          : "Appointment history is unavailable",
      description:
        mode === "client-linked"
          ? "The incoming appointment could not be attached to this recipient, so follow-up will stay on the client only."
          : "The incoming appointment did not resolve into the current follow-up context, so the page is not carrying appointment history right now.",
    });
  }

  if (input.hasRouteLaneParams && !input.requestedRouteLane) {
    diagnostics.push({
      id: "lane",
      badgeLabel: "Saved focus",
      badgeTone: "warning",
      title: "Requested view did not resolve",
      description:
        "The link carried a focus parameter, but it did not match a supported view, so Acre kept the page on the nearest safe follow-up view instead.",
    });
  }

  if (input.hasDraftAssistParams && !input.draftAssist) {
    diagnostics.push({
      id: "draft",
      badgeLabel: "Link draft",
      badgeTone: "accent",
      title: "Draft did not load",
      description: input.requestedDraftChannel
        ? `The link carried ${input.requestedDraftChannel.toUpperCase()} draft details, but the body or required context was incomplete, so Acre stayed on the standard message templates.`
        : "The link carried draft-related details, but not enough valid data to load the saved draft, so Acre stayed on the standard message templates.",
    });
  }

  const routeStatusLabel = diagnostics.length
    ? "View adjusted"
    : resolvedFocusedRouteLane.focusedRouteLane === "draft-lane"
      ? "Draft in view"
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
        ? "AI draft loaded"
        : "Draft loaded"
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
        ? "A saved draft is active here."
        : "A draft view is selected here, but no saved draft is loaded yet.",
      focusedRouteLanePanelLabel: "Draft",
      focusedRouteLanePanelDescription: "Keep the loaded draft and link together.",
      focusedRouteLaneSteps: [
        {
          label: "Review the loaded draft",
          detail: "Check the loaded SMS or email copy first.",
          tone: "warning" as const,
        },
        {
          label: "Match the send channel",
          detail: "Use the channel that matches the loaded draft.",
          tone: "accent" as const,
        },
        {
          label: "Keep the tracked link attached",
          detail: "Only switch views if you need different context.",
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
        focusedRouteLaneDescription: `${input.snapshot.targetClient.fullName} and ${input.snapshot.targetAppointment.title} stay tied together.`,
        focusedRouteLanePanelLabel: "Appointment next steps",
        focusedRouteLanePanelDescription:
          "Keep the appointment thread attached.",
        focusedRouteLaneSteps: [
          {
            label: "Keep the appointment thread attached",
            detail: "Use the active appointment context.",
            tone: "accent" as const,
          },
          {
            label: "Choose the next reaction channel",
            detail: "Use SMS for quick reaction and email for more framing.",
            tone: "warning" as const,
          },
          {
            label: "Save the next step",
            detail: "Record the next step before leaving.",
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
        focusedRouteLaneDescription: `${input.snapshot.targetClient.fullName} stays attached to the same follow-up history.`,
        focusedRouteLanePanelLabel: "Client next steps",
        focusedRouteLanePanelDescription:
          "Keep the client history attached.",
        focusedRouteLaneSteps: [
          {
            label: "Keep the client context attached",
            detail: "Reopen from the client record.",
            tone: "accent" as const,
          },
          {
            label: "Pick the channel that fits the thread",
            detail: "Use email for framing and SMS for quick replies.",
            tone: "warning" as const,
          },
          {
            label: "Leave a written next step",
            detail: "Save the next step before you leave.",
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
        "No client or appointment is attached yet.",
      focusedRouteLanePanelLabel: "Next steps",
      focusedRouteLanePanelDescription:
        "Attach a client or appointment before you copy anything.",
      focusedRouteLaneSteps: [
        {
          label: "Attach a client or appointment first",
          detail: "Open the record that should own the next touch.",
          tone: "warning" as const,
        },
        {
          label: "Choose the right channel",
          detail: "Match the channel to the conversation depth.",
          tone: "accent" as const,
        },
        {
          label: "Capture the next touch",
          detail: "Save the next step while context is fresh.",
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
      "Use this view to reopen quiet tracked sends.",
    focusedRouteLanePanelLabel: "Re-engagement",
    focusedRouteLanePanelDescription:
      "Use this view to reopen a quiet send.",
    focusedRouteLaneSteps: [
      {
        label: "Reopen the quiet share",
        detail: "Start from the listing that went quiet.",
        tone: "warning" as const,
      },
      {
        label: "Pick the shortest useful reply path",
        detail: "Use SMS for a quick reaction or email for more framing.",
        tone: "accent" as const,
      },
      {
        label: "Keep proof and identity nearby",
        detail: "Pair the follow-up with profile and proof.",
        tone: "success" as const,
      },
    ],
    focusedRouteLaneActionLabel: "Resume re-engagement",
  };
}
