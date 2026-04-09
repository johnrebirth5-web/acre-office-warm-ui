export type FrontOfficeListingShareBindingMode =
  | "generic_tracked_link"
  | "client_dossier_context"
  | "client_appointment_context";

export type FrontOfficeListingSharePromiseChannel = "sms" | "email" | "direct";

export type FrontOfficeListingSharePublicPageSnapshot = {
  shareSurfaceLabel: string;
  shareContextLabel: string;
  channelLabel: string;
  trackingLabel: string;
  replyLaneLabel: string;
  nextStepLabel: string;
  followUpLabel: string;
  privacyLabel: string;
};

export type FrontOfficeListingSharePromiseSnapshot =
  FrontOfficeListingSharePublicPageSnapshot;

function buildShareChannelLabel(
  channel: FrontOfficeListingSharePromiseChannel,
) {
  switch (channel) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    case "direct":
      return "Direct link";
    default:
      return "Tracked send";
  }
}

function buildSharePublicSurfaceLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
}) {
  if (input.mode === "client_appointment_context") {
    return "Tracked appointment follow-through share";
  }

  if (input.mode === "client_dossier_context") {
    return "Tracked client share";
  }

  return "Private listing share";
}

function buildSharePublicContextLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  appointmentTitle: string | null;
}) {
  if (input.mode === "client_appointment_context") {
    return input.appointmentTitle
      ? `Shared as a private follow-through link around ${input.appointmentTitle}.`
      : "Shared as a private follow-through link around an active appointment.";
  }

  if (input.mode === "client_dossier_context") {
    return "Shared as a private client follow-through link so the next step stays in one conversation.";
  }

  return "Shared as a private Acre listing link without a client-bound follow-through trail.";
}

function buildSharePublicReplyLaneLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  channel: FrontOfficeListingSharePromiseChannel;
}) {
  if (input.mode === "client_appointment_context") {
    return "Reply in the same conversation if you are confirming timing, access, or the next showing step.";
  }

  if (input.mode === "client_dossier_context") {
    return input.channel === "email"
      ? "Reply in the same email thread so the shortlist and next option stay aligned."
      : "Reply in the same chat thread so the shortlist and next option stay aligned.";
  }

  return "If this page was forwarded, ask the sender for the original conversation so the next step stays aligned.";
}

function buildSharePublicTrackingLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  channel: FrontOfficeListingSharePromiseChannel;
}) {
  if (input.mode === "generic_tracked_link") {
    return "Private share link only.";
  }

  return `Tracked via ${buildShareChannelLabel(input.channel)}.`;
}

function buildSharePublicNextStepLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  appointmentTitle: string | null;
}) {
  if (input.mode === "client_appointment_context") {
    return input.appointmentTitle
      ? `Use the same conversation to confirm ${input.appointmentTitle} details or ask for the next showing step.`
      : "Use the same conversation to confirm timing or ask for the next showing step.";
  }

  if (input.mode === "client_dossier_context") {
    return "Reply in the same conversation or contact the agent directly if you want the next option lined up.";
  }

  return "Call or email the agent to keep the conversation moving, or open the source listing for the canonical record.";
}

function buildSharePublicFollowUpLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  channel: FrontOfficeListingSharePromiseChannel;
}) {
  if (input.mode === "client_appointment_context") {
    return "If you were sent this for an appointment or showing, keep the reply in the same thread so timing and follow-through do not split.";
  }

  if (input.mode === "client_dossier_context") {
    return input.channel === "email"
      ? "If you want another option, reply in the same email thread so the agent can keep your search context together."
      : "If you want another option, reply in the same conversation so the agent can keep your search context together.";
  }

  return "If this page was forwarded, ask the sender for the original context so nothing gets lost.";
}

function buildSharePublicPrivacyLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
}) {
  if (input.mode === "generic_tracked_link") {
    return "This Acre page is meant to stay private to the conversation it came from.";
  }

  return "This Acre page is a private follow-through surface, so keep replies in the same conversation whenever possible.";
}

export function buildSharePublicPageSnapshot(input: {
  mode: FrontOfficeListingShareBindingMode;
  channel: FrontOfficeListingSharePromiseChannel;
  appointmentTitle: string | null;
}): FrontOfficeListingSharePublicPageSnapshot {
  return {
    shareSurfaceLabel: buildSharePublicSurfaceLabel({
      mode: input.mode,
    }),
    shareContextLabel: buildSharePublicContextLabel({
      mode: input.mode,
      appointmentTitle: input.appointmentTitle,
    }),
    channelLabel: buildShareChannelLabel(input.channel),
    trackingLabel: buildSharePublicTrackingLabel({
      mode: input.mode,
      channel: input.channel,
    }),
    replyLaneLabel: buildSharePublicReplyLaneLabel({
      mode: input.mode,
      channel: input.channel,
    }),
    nextStepLabel: buildSharePublicNextStepLabel({
      mode: input.mode,
      appointmentTitle: input.appointmentTitle,
    }),
    followUpLabel: buildSharePublicFollowUpLabel({
      mode: input.mode,
      channel: input.channel,
    }),
    privacyLabel: buildSharePublicPrivacyLabel({
      mode: input.mode,
    }),
  };
}

export function buildFrontOfficeListingSharePromiseSnapshot(input: {
  mode: FrontOfficeListingShareBindingMode;
  channel: FrontOfficeListingSharePromiseChannel;
  appointmentTitle: string | null;
}): FrontOfficeListingSharePromiseSnapshot {
  return buildSharePublicPageSnapshot(input);
}
