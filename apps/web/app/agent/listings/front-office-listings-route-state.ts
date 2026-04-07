import type { FrontOfficeListingsSnapshot } from "@acre/db";

export type FrontOfficeListingsRouteMode =
  | "tracked-link"
  | "client-linked"
  | "appointment-linked";

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
  id: "client" | "appointment" | "draft";
  badgeLabel: string;
  badgeTone: "accent" | "warning";
  title: string;
  description: string;
};

export type FrontOfficeListingsRouteState = {
  cleanHref: string;
  contextHref: string;
  requestedClientId: string | null;
  requestedAppointmentId: string | null;
  requestedDraftChannel: "sms" | "email" | null;
  hasDraftAssist: boolean;
  hasDraftAssistParams: boolean;
  diagnostics: FrontOfficeListingsRouteDiagnostic[];
  mode: FrontOfficeListingsRouteMode;
  modeLabel: string;
  modeDescription: string;
  modeContextLabel: string;
  routeStatusLabel: string;
  routeStatusDescription: string;
  draftStatusLabel: string;
};

export type FrontOfficeListingsSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type FrontOfficeListingsSearchState = {
  requestedClientId: string | null;
  requestedAppointmentId: string | null;
  requestedDraftChannel: "sms" | "email" | null;
  hasDraftAssistParams: boolean;
  draftAssist: FrontOfficeListingsDraftAssist | null;
};

type BuildFrontOfficeListingsRouteStateInput = {
  snapshot: FrontOfficeListingsSnapshot;
  requestedClientId: string | null;
  requestedAppointmentId: string | null;
  requestedDraftChannel: "sms" | "email" | null;
  draftAssist: FrontOfficeListingsDraftAssist | null;
  hasDraftAssistParams: boolean;
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
    return "AI draft assist is loaded below. Copying the matching send lane still keeps the action manual and appends a tracked private listing link.";
  }

  return null;
}

export function parseFrontOfficeListingsSearchParams(
  searchParams: FrontOfficeListingsSearchParams,
): FrontOfficeListingsSearchState {
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
          suggestionKind:
            readNormalizedSearchParamValue(searchParams.draftSuggestionKind),
          suggestionLabel:
            readNormalizedSearchParamValue(searchParams.draftSuggestionLabel),
          sourceKey: draftSourceKey,
          sourceLabel: buildDraftAssistSourceLabel(draftSourceKey),
        }
      : null;

  return {
    requestedClientId: readNormalizedSearchParamValue(searchParams.clientId),
    requestedAppointmentId: readNormalizedSearchParamValue(
      searchParams.appointmentId,
    ),
    requestedDraftChannel,
    hasDraftAssistParams,
    draftAssist,
  };
}

export function buildAgentListingsHref(input: {
  clientId?: string | null;
  appointmentId?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.clientId?.trim()) {
    params.set("clientId", input.clientId.trim());
  }

  if (input.appointmentId?.trim()) {
    params.set("appointmentId", input.appointmentId.trim());
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
  const contextHref = buildAgentListingsHref({
    clientId: input.snapshot.targetClient?.id ?? null,
    appointmentId: input.snapshot.targetAppointment?.id ?? null,
  });
  let mode: FrontOfficeListingsRouteMode = "tracked-link";
  let modeLabel = "Tracked link";
  let modeDescription =
    "Private tracked links still work here, but Acre only copies manual outbound content here. Nothing writes back to a client trail until you reopen the page from a dossier or appointment.";
  let modeContextLabel = "Generic output terminal";

  if (input.snapshot.targetAppointment && input.snapshot.targetClient) {
    mode = "appointment-linked";
    modeLabel = "Appointment-linked";
    modeDescription = `Manual sends from this route stay attached to ${input.snapshot.targetClient.fullName} and the selected appointment, so the next follow-up does not lose the meeting context.`;
    modeContextLabel = `${input.snapshot.targetAppointment.typeLabel} follow-up`;
  } else if (input.snapshot.targetClient) {
    mode = "client-linked";
    modeLabel = "Client-linked";
    modeDescription = `Manual sends from this route write back into ${input.snapshot.targetClient.fullName}'s dossier, including the current client stage and send trail.`;
    modeContextLabel = `${input.snapshot.targetClient.stage} stage`;
  }

  if (unresolvedClient) {
    diagnostics.push({
      id: "client",
      badgeLabel: "Client URL",
      badgeTone: "warning",
      title:
        mode === "appointment-linked"
          ? "Requested client context was replaced"
          : "Requested client context did not load",
      description:
        mode === "appointment-linked"
          ? "The incoming URL asked for a different or unavailable client, so Acre kept the appointment-linked client that could still write back safely."
          : mode === "client-linked"
            ? "The incoming URL did not resolve the requested client exactly, so the page stayed on the currently available client-linked context."
            : "The incoming URL requested a client context that is no longer available here, so the page fell back to tracked-link mode.",
    });
  }

  if (unresolvedAppointment) {
    diagnostics.push({
      id: "appointment",
      badgeLabel: "Appointment URL",
      badgeTone: "warning",
      title:
        mode === "appointment-linked"
          ? "Requested appointment context was adjusted"
          : "Appointment writeback is not attached",
      description:
        mode === "client-linked"
          ? "The incoming appointment could not be attached to this recipient, so sends will write back to the client trail only."
          : "The incoming appointment did not resolve into the current send context, so the page is not carrying appointment writeback right now.",
    });
  }

  if (input.hasDraftAssistParams && !input.draftAssist) {
    diagnostics.push({
      id: "draft",
      badgeLabel: "Draft URL",
      badgeTone: "accent",
      title: "Draft assist did not load",
      description: input.requestedDraftChannel
        ? `The URL carried ${input.requestedDraftChannel.toUpperCase()} draft parameters, but the body or required context was incomplete, so Acre stayed on the standard manual templates.`
        : "The URL carried draft-related parameters, but not enough valid data to open assisted copy, so Acre stayed on the standard manual templates.",
    });
  }

  const routeStatusLabel = diagnostics.length
    ? "Adjusted route"
    : input.draftAssist
      ? "Deep-linked draft"
      : "Clean route";
  const routeStatusDescription = diagnostics.length
    ? "Acre trimmed or replaced part of the incoming URL so the workspace could stay on a safe manual-send path."
    : input.draftAssist
      ? "A valid draft assist is loaded on top of the current send context, and the send remains fully manual."
      : "The route is carrying only the current send context, with no extra draft or stale deep-link baggage.";

  return {
    cleanHref: "/agent/listings",
    contextHref,
    requestedClientId: input.requestedClientId,
    requestedAppointmentId: input.requestedAppointmentId,
    requestedDraftChannel: input.requestedDraftChannel,
    hasDraftAssist: Boolean(input.draftAssist),
    hasDraftAssistParams: input.hasDraftAssistParams,
    diagnostics,
    mode,
    modeLabel,
    modeDescription,
    modeContextLabel,
    routeStatusLabel,
    routeStatusDescription,
    draftStatusLabel: input.draftAssist
      ? input.draftAssist.sourceKey === "ai"
        ? "AI draft loaded"
        : "Draft loaded"
      : input.hasDraftAssistParams
        ? "Draft adjusted"
        : "Manual templates",
  };
}
