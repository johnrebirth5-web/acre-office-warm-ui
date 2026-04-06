import type { FrontOfficeListingsSnapshot } from "@acre/db";

export type FrontOfficeListingsRouteMode =
  | "tracked-link"
  | "client-linked"
  | "appointment-linked";

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
  draftStatusLabel: string;
};

type BuildFrontOfficeListingsRouteStateInput = {
  snapshot: FrontOfficeListingsSnapshot;
  requestedClientId: string | null;
  requestedAppointmentId: string | null;
  requestedDraftChannel: "sms" | "email" | null;
  hasDraftAssist: boolean;
  hasDraftAssistParams: boolean;
};

export function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
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
    "Private tracked links still work here, but nothing writes back to a client trail until you reopen the page from a dossier or appointment.";
  let modeContextLabel = "Generic output terminal";

  if (input.snapshot.targetAppointment && input.snapshot.targetClient) {
    mode = "appointment-linked";
    modeLabel = "Appointment-linked";
    modeDescription = `Sends from this route stay attached to ${input.snapshot.targetClient.fullName} and the selected appointment, so the next follow-up does not lose the meeting context.`;
    modeContextLabel = `${input.snapshot.targetAppointment.typeLabel} follow-up`;
  } else if (input.snapshot.targetClient) {
    mode = "client-linked";
    modeLabel = "Client-linked";
    modeDescription = `Sends from this route write back into ${input.snapshot.targetClient.fullName}'s dossier, including the current client stage and send trail.`;
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
          ? "The URL asked for a different or unavailable client, so Acre kept the appointment-linked client that could still write back safely."
          : mode === "client-linked"
            ? "The URL did not resolve the requested client exactly, so the page stayed on the currently available client-linked context."
            : "The URL requested a client context that is no longer available here, so the page fell back to tracked-link mode.",
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
          ? "The requested appointment could not be attached to this recipient, so sends will write back to the client trail only."
          : "The requested appointment did not resolve into the current send context, so the page is not carrying appointment writeback right now.",
    });
  }

  if (input.hasDraftAssistParams && !input.hasDraftAssist) {
    diagnostics.push({
      id: "draft",
      badgeLabel: "Draft URL",
      badgeTone: "accent",
      title: "Draft assist did not load",
      description: input.requestedDraftChannel
        ? `The URL carried ${input.requestedDraftChannel.toUpperCase()} draft parameters, but the body or required context was incomplete, so Acre stayed on the standard copy templates.`
        : "The URL carried draft-related parameters, but not enough valid data to open assisted copy, so Acre stayed on the standard templates.",
    });
  }

  return {
    cleanHref: "/agent/listings",
    contextHref,
    requestedClientId: input.requestedClientId,
    requestedAppointmentId: input.requestedAppointmentId,
    requestedDraftChannel: input.requestedDraftChannel,
    hasDraftAssist: input.hasDraftAssist,
    hasDraftAssistParams: input.hasDraftAssistParams,
    diagnostics,
    mode,
    modeLabel,
    modeDescription,
    modeContextLabel,
    draftStatusLabel: input.hasDraftAssist
      ? "AI draft loaded"
      : input.hasDraftAssistParams
        ? "Draft adjusted"
        : "Manual templates",
  };
}
