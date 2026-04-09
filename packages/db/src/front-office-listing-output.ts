import { randomBytes } from "node:crypto";
import {
  FrontOfficeSendChannel,
  FrontOfficeSendMaterialType,
  ListingStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import type { FrontOfficeAiAcceptedActionContext } from "./front-office-ai";
import { recordFrontOfficeAiAcceptedAction } from "./front-office-ai";

const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];

const TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS = 3;
const TRACKED_SEND_QUIET_AFTER_OPEN_DAYS = 7;

type FrontOfficeListingShareBindingMode =
  | "generic_tracked_link"
  | "client_dossier_context"
  | "client_appointment_context";

type FrontOfficeListingShareFollowUpKind =
  | "generic_context"
  | "client_context"
  | "appointment_context";

type FrontOfficeListingShareWritebackMode =
  | "tracked_link_only"
  | "tracked_send_recorded";

type FrontOfficeListingShareResolvedClient = {
  id: string;
  fullName: string;
  stageLabel: string | null;
  bindingSource: "explicit_client" | "appointment_context";
};

type FrontOfficeListingShareResolvedAppointment = {
  id: string;
  title: string;
  startsAt: Date | null;
};

export type FrontOfficeListingShareExecutionSummary = {
  mode: FrontOfficeListingShareBindingMode;
  modeLabel: string;
  channelLabel: string;
  sentAtLabel: string;
  sentAtValue: string;
  trackingLabel: string;
  trackingStatus: FrontOfficeListingShareWritebackMode;
  statusTone: "accent" | "warning";
  writebackLabel: string;
  writebackScopeLabel: string;
  nextStepLabel: string;
  clientLabel: string | null;
  clientStageLabel: string | null;
  clientStageDisplayLabel: string | null;
  appointmentLabel: string | null;
  appointmentStartsAt: string | null;
  appointmentWindowLabel: string | null;
};

type FrontOfficeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export type FrontOfficeListingUsagePulseCard = {
  title: string;
  badgeLabel: string;
  badgeTone: FrontOfficeTone;
  context: string;
  description: string;
  followThroughCue: string;
  meta: string[];
  clientHref: string | null;
  appointmentHref: string | null;
};

export type FrontOfficeListingUsagePulse = {
  listingCount: number;
  trackedListingCount: number;
  engagedListingCount: number;
  quietTrackedListingCount: number;
  trackedLinkCount: number;
  trackedClickCount: number;
  clickThroughRateLabel: string;
  pulseLabel: string;
  pulseDescription: string;
  sendTrailLabel: string;
  sendTrailDescription: string;
  quietTrailLabel: string;
  quietTrailDescription: string;
  nextMoveLabel: string;
  nextMoveDescription: string;
  strongestTrail: FrontOfficeListingUsagePulseCard | null;
  latestTrackedShare: FrontOfficeListingUsagePulseCard | null;
  recentTrackedShares: FrontOfficeListingUsagePulseCard[];
};

export type FrontOfficeListingUsagePulseListing = {
  id: string;
  title: string;
  areaLabel: string;
  summaryLabel: string;
  priceLabel: string;
  cityLabel: string;
  statusLabel: string;
  statusTone: FrontOfficeTone;
  trackedClickCount: number;
  trackedLinkCount: number;
  latestTrackedShare: {
    modeLabel: string;
    channelLabel: string;
    sentAtLabel: string;
    sentAtValue: string;
    trackingLabel: string;
    trackingStatus: FrontOfficeListingShareWritebackMode;
    statusTone: FrontOfficeTone;
    writebackLabel: string;
    writebackScopeLabel: string;
    nextStepLabel: string;
    clientLabel: string | null;
    clientStageDisplayLabel: string | null;
    clientHref: string | null;
    appointmentLabel: string | null;
    appointmentWindowLabel: string | null;
    appointmentHref: string | null;
    followThroughCue?: string;
  } | null;
};

class FrontOfficeListingShareLinkError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(input: { code: string; message: string; status: number }) {
    super(input.message);
    this.name = "FrontOfficeListingShareLinkError";
    this.code = input.code;
    this.status = input.status;
  }
}

function createFrontOfficeListingShareLinkError(input: {
  code: string;
  message: string;
  status?: number;
}) {
  return new FrontOfficeListingShareLinkError({
    code: input.code,
    message: input.message,
    status: input.status ?? 400,
  });
}

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function formatCurrency(value: Prisma.Decimal | number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Price on request";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

function buildFactsLabel(input: {
  bedrooms: number | null;
  bathrooms: Prisma.Decimal | null;
}) {
  const parts = [
    input.bedrooms ? `${input.bedrooms} bd` : null,
    input.bathrooms ? `${Number(input.bathrooms)} ba` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "Curated listing details";
}

function buildShareCode() {
  return randomBytes(9).toString("base64url");
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized && normalized.length ? normalized : null;
}

function parseFrontOfficeSendChannel(channel: string): FrontOfficeSendChannel {
  switch (normalizeOptionalText(channel)?.toLowerCase()) {
    case "sms":
      return FrontOfficeSendChannel.sms;
    case "email":
      return FrontOfficeSendChannel.email;
    case "direct":
      return FrontOfficeSendChannel.direct;
    default:
      throw createFrontOfficeListingShareLinkError({
        code: "unsupported_share_channel",
        message: "Unsupported share channel.",
      });
  }
}

function normalizeFrontOfficeSendChannel(
  channel: FrontOfficeSendChannel | string,
): FrontOfficeSendChannel {
  if (typeof channel !== "string") {
    return channel;
  }

  return parseFrontOfficeSendChannel(channel);
}

export function buildFrontOfficeListingSharePath(code: string) {
  return `/share/listings/${code}`;
}

function buildClientStageDisplayLabel(value: string | null | undefined) {
  return normalizeOptionalText(value) ?? "Stage not captured";
}

function buildStageKeywordMatch(
  value: string | null | undefined,
  keywords: string[],
) {
  const normalizedValue = value?.trim().toLowerCase() || "";

  return keywords.some((keyword) => normalizedValue.includes(keyword));
}

function buildAppointmentWindowLabel(
  value: Date | null | undefined,
  referenceAt: Date,
) {
  if (!value) {
    return null;
  }

  const minutesUntilStart = Math.round(
    (value.getTime() - referenceAt.getTime()) / (1000 * 60),
  );

  if (minutesUntilStart <= -120) {
    return "after the appointment window";
  }

  if (minutesUntilStart < 0) {
    return "during the appointment window";
  }

  if (minutesUntilStart <= 180) {
    return "ahead of the appointment window";
  }

  return "in the appointment prep window";
}

function resolveFrontOfficeListingShareBindingMode(input: {
  client: FrontOfficeListingShareResolvedClient | null;
  appointment: FrontOfficeListingShareResolvedAppointment | null;
}): FrontOfficeListingShareBindingMode {
  if (input.client && input.appointment) {
    return "client_appointment_context";
  }

  if (input.client) {
    return "client_dossier_context";
  }

  return "generic_tracked_link";
}

function buildShareModeLabel(mode: FrontOfficeListingShareBindingMode) {
  if (mode === "client_appointment_context") {
    return "Client + appointment context";
  }

  if (mode === "client_dossier_context") {
    return "Client dossier context";
  }

  return "Generic tracked link";
}

function buildShareChannelLabel(channel: FrontOfficeSendChannel) {
  switch (channel) {
    case FrontOfficeSendChannel.sms:
      return "SMS";
    case FrontOfficeSendChannel.email:
      return "Email";
    case FrontOfficeSendChannel.direct:
      return "Direct link";
    default:
      return "Tracked send";
  }
}

function buildShareTrackingLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  clientName: string | null;
  appointmentTitle: string | null;
}) {
  if (input.mode === "client_appointment_context") {
    return `Send record saved to ${input.clientName || "the selected client"} and linked to ${input.appointmentTitle || "the selected appointment"}.`;
  }

  if (input.mode === "client_dossier_context") {
    return `Send record saved to ${input.clientName || "the selected client"}'s Front Office trail.`;
  }

  return "Tracked link created without client-linked send attribution.";
}

function buildShareWritebackScopeLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  clientName: string | null;
  appointmentTitle: string | null;
}) {
  if (input.mode === "client_appointment_context") {
    return `Writeback scope stays on ${input.clientName || "the selected client"} and ${input.appointmentTitle || "the selected appointment"}, so reply pressure and appointment continuity remain on one trail.`;
  }

  if (input.mode === "client_dossier_context") {
    return `Writeback scope stays on ${input.clientName || "the selected client"}'s Front Office dossier trail.`;
  }

  return "Writeback scope is the tracked private link only until you reopen listing output from a dossier or appointment.";
}

function buildShareSendCue(input: {
  channel: FrontOfficeSendChannel;
  mode: FrontOfficeListingShareBindingMode;
}) {
  if (input.channel === FrontOfficeSendChannel.sms) {
    if (input.mode === "client_appointment_context") {
      return "Best for a quick reaction or confirmation around the active appointment while the tracked link stays attached to the meeting trail.";
    }

    if (input.mode === "client_dossier_context") {
      return "Best for a quick yes / no reaction while keeping the dossier send trail warm.";
    }

    return "Best for a fast manual text touch when you still want the private tracked link copied with the note.";
  }

  if (input.channel === FrontOfficeSendChannel.email) {
    if (input.mode === "client_appointment_context") {
      return "Best when the client needs more framing before or after the appointment, but you still want the send tied back to the meeting loop.";
    }

    if (input.mode === "client_dossier_context") {
      return "Best when the client needs summary, context, and a clear next-step ask beside the tracked link.";
    }

    return "Best when the listing needs more framing than a raw link before you attach it to a specific client trail.";
  }

  if (input.mode === "client_appointment_context") {
    return "Best for WeChat or another manual chat flow when you only need the private tracked URL and will handle the rest of the note yourself around the appointment.";
  }

  if (input.mode === "client_dossier_context") {
    return "Best for WeChat or ad-hoc chat when you only need the private tracked URL but still want the send recorded in the client trail.";
  }

  return "Best when you only need the private tracked URL and will handle the rest of the context in another manual send tool.";
}

function buildShareManualSendCue(channel: FrontOfficeSendChannel) {
  if (channel === FrontOfficeSendChannel.sms) {
    return "Acre only copied the SMS-ready content and tracked link. You still need to paste and send it manually from your texting app.";
  }

  if (channel === FrontOfficeSendChannel.email) {
    return "Acre only copied the email-ready content and tracked link. You still need to paste and send it manually from your mail client.";
  }

  return "Acre only copied the private tracked link. Add your own context and send it manually from the chat or email tool you choose.";
}

function buildShareNextStepLabel(channel: FrontOfficeSendChannel) {
  if (channel === FrontOfficeSendChannel.sms) {
    return "Paste the SMS package into your texting app and send it manually.";
  }

  if (channel === FrontOfficeSendChannel.email) {
    return "Paste the email package into your mail client and send it manually.";
  }

  return "Drop the tracked private link into your live chat or email thread with your own context.";
}

function buildShareFollowUpSnapshot(mode: FrontOfficeListingShareBindingMode) {
  if (mode === "client_appointment_context") {
    return {
      kind: "appointment_context" as const,
      cue: `Use the appointment record for confirmation or reschedule notes, rescue the send from the client trail if it stays unopened after ${TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS} days, and reopen the shortlist if it goes quiet for a week after the first open.`,
      unopenedAfterDays: TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS,
      quietAfterOpenAfterDays: TRACKED_SEND_QUIET_AFTER_OPEN_DAYS,
    };
  }

  if (mode === "client_dossier_context") {
    return {
      kind: "client_context" as const,
      cue: `If the send stays unopened for ${TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS} days, reopen the dossier with a tighter follow-up. If it opens and then goes quiet for a week, send the next option from the same trail.`,
      unopenedAfterDays: TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS,
      quietAfterOpenAfterDays: TRACKED_SEND_QUIET_AFTER_OPEN_DAYS,
    };
  }

  return {
    kind: "generic_context" as const,
    cue: "This link is still tracked, but it will not enter a client engagement trail until you reopen listing output from a dossier or appointment context.",
    unopenedAfterDays: null,
    quietAfterOpenAfterDays: null,
  };
}

function buildShareMaterialCue(input: {
  mode: FrontOfficeListingShareBindingMode;
  clientStageLabel: string | null;
}) {
  if (input.mode === "client_appointment_context") {
    return "Pair this listing with the intro text and one recent closing so the client sees both meeting context and agent proof.";
  }

  if (
    buildStageKeywordMatch(input.clientStageLabel, [
      "new",
      "lead",
      "prospect",
      "nurture",
      "inquiry",
    ])
  ) {
    return "Lead with the business card or intro email so the listing does not arrive without agent identity.";
  }

  if (
    buildStageKeywordMatch(input.clientStageLabel, [
      "show",
      "tour",
      "search",
      "active",
      "buyer",
      "visit",
    ])
  ) {
    return "Pair the listing with the intro text and a featured case to keep the shortlist moving toward a showing decision.";
  }

  return "Pair the listing with the business card and one proof point so the share carries identity, not just a link.";
}

function buildShareWritebackLabel(input: {
  sendRecordId: string | null;
  aiAcceptedActionRecorded: boolean;
}) {
  if (input.sendRecordId && input.aiAcceptedActionRecorded) {
    return "Tracked link, send record, and AI acceptance trail saved.";
  }

  if (input.sendRecordId) {
    return "Tracked link and send record saved.";
  }

  return "Tracked link saved without client-linked writeback.";
}

function buildListingUsagePulseTrailState(input: {
  trackedClickCount: number;
  trackedLinkCount: number;
}) {
  if (input.trackedLinkCount <= 0) {
    return {
      badgeLabel: "Fresh trail",
      badgeTone: "neutral" as const,
      description: "No tracked send has left this listing yet.",
    };
  }

  if (input.trackedClickCount <= 0) {
    return {
      badgeLabel: "Quiet trail",
      badgeTone: "warning" as const,
      description:
        "Tracked sends exist, but the click pulse has not returned yet.",
    };
  }

  if (input.trackedClickCount >= input.trackedLinkCount) {
    return {
      badgeLabel: "Active trail",
      badgeTone: "success" as const,
      description:
        "Tracked sends are already producing a strong usage pulse in this desk.",
    };
  }

  return {
    badgeLabel: "Warm trail",
    badgeTone: "accent" as const,
    description:
      "Tracked sends are returning clicks, but some links are still waiting on a response.",
  };
}

function buildListingUsagePulseQuietTrailCue(
  listing: FrontOfficeListingUsagePulseListing,
) {
  if (listing.trackedLinkCount <= 0) {
    return "No quiet trail yet. Start the first tracked send from a dossier or appointment.";
  }

  if (listing.trackedClickCount <= 0) {
    return "This send trail is still quiet. Tighten the framing or reopen it from the same client or appointment trail.";
  }

  return "This send trail is warm again, so the quiet trail has already been cleared.";
}

function buildListingUsagePulseNextMoveCue(
  listing: FrontOfficeListingUsagePulseListing,
) {
  if (listing.trackedLinkCount <= 0) {
    return "Start the first tracked share so the send trail can be measured.";
  }

  if (listing.trackedClickCount <= 0) {
    return listing.latestTrackedShare?.clientHref
      ? "Reopen the client trail with a tighter reason-to-care."
      : listing.latestTrackedShare?.appointmentHref
        ? "Reopen the appointment trail with a quicker reaction path."
        : "Tighten the copy, then resend from the same trail.";
  }

  return listing.latestTrackedShare?.clientHref
    ? "Keep the next touch inside the same client dossier so the warm trail stays attached."
    : listing.latestTrackedShare?.appointmentHref
      ? "Keep the next touch inside the same appointment loop so the warm trail stays attached."
      : "Keep the next touch on the same listing trail instead of restarting cold.";
}

function buildListingUsagePulseSendTrailSummary(input: {
  trackedLinkCount: number;
  trackedClickCount: number;
  quietTrackedListingCount: number;
}) {
  if (input.trackedLinkCount <= 0) {
    return {
      label: "Fresh send trail",
      description:
        "No tracked send has left this desk yet, so the first next move still needs to be created from a dossier or appointment.",
    };
  }

  if (input.trackedClickCount <= 0) {
    return {
      label: "Quiet send trail",
      description: `${input.trackedLinkCount} tracked send(s) are still waiting on their first click pulse.`,
    };
  }

  if (input.quietTrackedListingCount > 0) {
    return {
      label: "Mixed send trail",
      description: `${input.trackedClickCount} tracked click(s) are flowing, but ${input.quietTrackedListingCount} listing(s) are still quiet.`,
    };
  }

  return {
    label: "Active send trail",
    description:
      "Tracked clicks are flowing back across the desk, so the send trail is already warm.",
  };
}

function buildListingUsagePulseQuietTrailSummary(input: {
  trackedLinkCount: number;
  trackedClickCount: number;
  quietTrackedListingCount: number;
}) {
  if (input.trackedLinkCount <= 0) {
    return {
      label: "No quiet trails",
      description:
        "Nothing is quiet yet because this desk has not created its first tracked trail.",
    };
  }

  if (input.quietTrackedListingCount > 0) {
    return {
      label: `${input.quietTrackedListingCount} quiet trail(s)`,
      description: `${input.quietTrackedListingCount} tracked listing(s) still need a stronger next touch before the click pulse returns.`,
    };
  }

  if (input.trackedClickCount <= 0) {
    return {
      label: "Quiet trail waiting",
      description:
        "Tracked sends exist, but no click pulse has returned yet, so the trail is still waiting on a reaction.",
    };
  }

  return {
    label: "No quiet trails",
    description:
      "Every tracked listing has returned a click pulse, so there is no quiet trail left to rescue.",
  };
}

function buildListingUsagePulseNextMoveSummary(input: {
  trackedLinkCount: number;
  trackedClickCount: number;
  quietTrackedListingCount: number;
  strongestTrail: FrontOfficeListingUsagePulseCard | null;
  latestTrackedShare: FrontOfficeListingUsagePulseCard | null;
}) {
  if (input.trackedLinkCount <= 0) {
    return {
      label: "Start first tracked send",
      description:
        "Open a dossier or appointment and create the first tracked share so the send trail can be measured.",
    };
  }

  if (input.trackedClickCount <= 0) {
    return {
      label: "Rescue quiet trail",
      description: input.latestTrackedShare?.clientHref
        ? "Reopen the client trail with a stronger reason-to-care, then keep the tracked link attached."
        : input.latestTrackedShare?.appointmentHref
          ? "Reopen the appointment trail with a faster reaction path, then keep the tracked link attached."
          : "Rescue the same trail with a clearer reason-to-care so the first click pulse can return.",
    };
  }

  if (input.quietTrackedListingCount > 0) {
    return {
      label: "Rescue quiet trails",
      description: input.strongestTrail?.clientHref
        ? "Use the most engaged trail as the anchor and reopen the quieter listings from the same client dossier."
        : input.strongestTrail?.appointmentHref
          ? "Use the most engaged trail as the anchor and reopen the quieter listings from the same appointment loop."
          : "Use the most engaged trail as the anchor, then reopen the quieter listings before they cool off.",
    };
  }

  return {
    label: "Keep warm trails moving",
    description: input.latestTrackedShare?.clientHref
      ? "The send trail is already warm, so stay inside the same client dossier and move the next touch forward from there."
      : input.latestTrackedShare?.appointmentHref
        ? "The send trail is already warm, so stay inside the same appointment loop and move the next touch forward from there."
        : "The send trail is already warm, so keep the next touch on the same listing trail instead of restarting cold.",
  };
}

function buildListingUsagePulseFollowThroughCue(
  listing: FrontOfficeListingUsagePulseListing,
) {
  const latestShare = listing.latestTrackedShare;

  if (!latestShare) {
    return "No tracked share has been created yet, so this listing is still waiting for its first follow-through trail.";
  }

  if (latestShare.trackingStatus === "tracked_send_recorded") {
    if (latestShare.appointmentLabel) {
      return `Reopen the ${latestShare.channelLabel.toLowerCase()} trail from the appointment loop if it goes quiet.`;
    }

    if (latestShare.clientLabel) {
      return `Reopen the ${latestShare.channelLabel.toLowerCase()} trail from the client dossier if it goes quiet.`;
    }

    return `Reopen the ${latestShare.channelLabel.toLowerCase()} trail if it goes quiet.`;
  }

  if (latestShare.appointmentLabel) {
    return "This is still a link-only share. Convert it into a tracked send from the appointment trail next time.";
  }

  if (latestShare.clientLabel) {
    return "This is still a link-only share. Convert it into a tracked send from the client trail next time.";
  }

  return "This is still a link-only share. Convert it into a tracked send next time so follow-through can be measured.";
}

function buildListingUsagePulseCard(
  listing: FrontOfficeListingUsagePulseListing,
): FrontOfficeListingUsagePulseCard {
  const latestShare = listing.latestTrackedShare;
  const trailState = buildListingUsagePulseTrailState({
    trackedClickCount: listing.trackedClickCount,
    trackedLinkCount: listing.trackedLinkCount,
  });
  const meta = [
    `${listing.trackedLinkCount} tracked link(s)`,
    `${listing.trackedClickCount} tracked click(s)`,
  ];

  if (latestShare) {
    const latestShareFollowThroughCue =
      latestShare.followThroughCue ??
      buildListingUsagePulseFollowThroughCue(listing);

    meta.push(`Send trail · ${trailState.badgeLabel}`);
    meta.push(`Quiet trail · ${buildListingUsagePulseQuietTrailCue(listing)}`);
    meta.push(`Next move · ${buildListingUsagePulseNextMoveCue(listing)}`);
    meta.push(`Latest share · ${latestShare.sentAtLabel}`);
    meta.push(`Follow-through · ${latestShareFollowThroughCue}`);
    meta.push(latestShare.writebackScopeLabel);
    meta.push(`Next step · ${latestShare.nextStepLabel}`);

    if (latestShare.clientLabel) {
      meta.push(
        `Client · ${latestShare.clientLabel}${
          latestShare.clientStageDisplayLabel
            ? ` · ${latestShare.clientStageDisplayLabel}`
            : ""
        }`,
      );
    }

    if (latestShare.appointmentLabel) {
      meta.push(
        `Appointment · ${latestShare.appointmentLabel}${
          latestShare.appointmentWindowLabel
            ? ` · ${latestShare.appointmentWindowLabel}`
            : ""
        }`,
      );
    }
  } else {
    meta.push("Latest share pending");
  }

  return {
    title: listing.title,
    badgeLabel: trailState.badgeLabel,
    badgeTone: trailState.badgeTone,
    context: latestShare
      ? `${latestShare.modeLabel} · ${latestShare.sentAtLabel}`
      : `${listing.areaLabel} · pulse waiting`,
    description: latestShare
      ? `${latestShare.trackingLabel} ${latestShare.writebackLabel}`
      : "No tracked share has been created for this listing yet.",
    followThroughCue: buildListingUsagePulseFollowThroughCue(listing),
    meta,
    clientHref: latestShare?.clientHref ?? null,
    appointmentHref: latestShare?.appointmentHref ?? null,
  };
}

export function buildFrontOfficeListingUsagePulse(
  listings: FrontOfficeListingUsagePulseListing[],
): FrontOfficeListingUsagePulse {
  const trackedLinkCount = listings.reduce(
    (sum, listing) => sum + listing.trackedLinkCount,
    0,
  );
  const trackedClickCount = listings.reduce(
    (sum, listing) => sum + listing.trackedClickCount,
    0,
  );
  const trackedListingCount = listings.filter(
    (listing) => listing.trackedLinkCount > 0,
  ).length;
  const engagedListingCount = listings.filter(
    (listing) => listing.trackedClickCount > 0,
  ).length;
  const quietTrackedListingCount = listings.filter(
    (listing) => listing.trackedLinkCount > 0 && listing.trackedClickCount <= 0,
  ).length;
  const clickThroughRateLabel =
    trackedLinkCount > 0
      ? `${Math.round((trackedClickCount / trackedLinkCount) * 100)}% click rate`
      : "No click data yet";
  const pulseLabel =
    trackedLinkCount <= 0
      ? "Fresh desk"
      : engagedListingCount <= 0
        ? "Quiet pulse"
        : quietTrackedListingCount <= 0
          ? "Active pulse"
          : "Mixed pulse";
  const pulseDescription =
    trackedLinkCount <= 0
      ? "No tracked links have been created yet, so the desk is still waiting for its first measured send."
      : engagedListingCount <= 0
        ? `${trackedLinkCount} tracked link(s) are in motion across ${trackedListingCount} listing(s), but no clicks have returned yet.`
        : `${trackedClickCount} tracked click(s) are flowing across ${engagedListingCount} engaged listing(s), with ${quietTrackedListingCount} quiet tracked trail(s) still waiting on a response.`;
  const sendTrailSummary = buildListingUsagePulseSendTrailSummary({
    trackedLinkCount,
    trackedClickCount,
    quietTrackedListingCount,
  });
  const quietTrailSummary = buildListingUsagePulseQuietTrailSummary({
    trackedLinkCount,
    trackedClickCount,
    quietTrackedListingCount,
  });
  const sortedByLatestShare = listings
    .filter((listing) => listing.latestTrackedShare)
    .slice()
    .sort((left, right) => {
      const leftValue = left.latestTrackedShare?.sentAtValue ?? "";
      const rightValue = right.latestTrackedShare?.sentAtValue ?? "";

      return rightValue.localeCompare(leftValue);
    });
  const sortedByClicks = listings.slice().sort((left, right) => {
    if (right.trackedClickCount !== left.trackedClickCount) {
      return right.trackedClickCount - left.trackedClickCount;
    }

    if (right.trackedLinkCount !== left.trackedLinkCount) {
      return right.trackedLinkCount - left.trackedLinkCount;
    }

    const leftValue = left.latestTrackedShare?.sentAtValue ?? "";
    const rightValue = right.latestTrackedShare?.sentAtValue ?? "";

    return rightValue.localeCompare(leftValue);
  });
  const strongestTrailListing = sortedByClicks[0] ?? null;
  const latestTrackedShareListing = sortedByLatestShare[0] ?? null;
  const nextMoveSummary = buildListingUsagePulseNextMoveSummary({
    trackedLinkCount,
    trackedClickCount,
    quietTrackedListingCount,
    strongestTrail: strongestTrailListing
      ? buildListingUsagePulseCard(strongestTrailListing)
      : null,
    latestTrackedShare: latestTrackedShareListing
      ? buildListingUsagePulseCard(latestTrackedShareListing)
      : null,
  });

  return {
    listingCount: listings.length,
    trackedListingCount,
    engagedListingCount,
    quietTrackedListingCount,
    trackedLinkCount,
    trackedClickCount,
    clickThroughRateLabel,
    pulseLabel,
    pulseDescription,
    sendTrailLabel: sendTrailSummary.label,
    sendTrailDescription: sendTrailSummary.description,
    quietTrailLabel: quietTrailSummary.label,
    quietTrailDescription: quietTrailSummary.description,
    nextMoveLabel: nextMoveSummary.label,
    nextMoveDescription: nextMoveSummary.description,
    strongestTrail: strongestTrailListing
      ? buildListingUsagePulseCard(strongestTrailListing)
      : null,
    latestTrackedShare: latestTrackedShareListing
      ? buildListingUsagePulseCard(latestTrackedShareListing)
      : null,
    recentTrackedShares: sortedByLatestShare
      .slice(0, 3)
      .map((listing) => buildListingUsagePulseCard(listing)),
  };
}

export function buildFrontOfficeListingShareExecutionSummary(input: {
  channel: FrontOfficeSendChannel | string;
  client: {
    fullName: string;
    stageLabel: string | null;
  } | null;
  appointment: {
    title: string;
    startsAt: Date | null;
  } | null;
  sentAt: Date;
  sendRecordId: string | null;
  aiAcceptedActionRecorded?: boolean;
  timeZone?: string | null;
}): FrontOfficeListingShareExecutionSummary {
  const normalizedChannel = normalizeFrontOfficeSendChannel(input.channel);
  const mode = resolveFrontOfficeListingShareBindingMode({
    client: input.client
      ? {
          id: "client",
          fullName: input.client.fullName,
          stageLabel: input.client.stageLabel,
          bindingSource: "explicit_client",
        }
      : null,
    appointment: input.appointment
      ? {
          id: "appointment",
          title: input.appointment.title,
          startsAt: input.appointment.startsAt,
        }
      : null,
  });
  const appointmentLabel = input.appointment?.title ?? null;
  const appointmentStartsAt = input.appointment?.startsAt ?? null;
  const appointmentStartsAtValue = appointmentStartsAt?.toISOString() ?? null;
  const sentAtValue = input.sentAt.toISOString();
  const trackingStatus: FrontOfficeListingShareWritebackMode =
    input.sendRecordId ? "tracked_send_recorded" : "tracked_link_only";
  const writebackLabel = buildShareWritebackLabel({
    sendRecordId: input.sendRecordId,
    aiAcceptedActionRecorded: input.aiAcceptedActionRecorded ?? false,
  });

  return {
    mode,
    modeLabel: buildShareModeLabel(mode),
    channelLabel: buildShareChannelLabel(normalizedChannel),
    sentAtLabel: formatDateTimeLabel(input.sentAt, {
      timeZone: input.timeZone ?? null,
    }),
    sentAtValue,
    trackingLabel: buildShareTrackingLabel({
      mode,
      clientName: input.client?.fullName ?? null,
      appointmentTitle: appointmentLabel,
    }),
    trackingStatus,
    statusTone:
      trackingStatus === "tracked_send_recorded" ? "accent" : "warning",
    writebackLabel,
    writebackScopeLabel: buildShareWritebackScopeLabel({
      mode,
      clientName: input.client?.fullName ?? null,
      appointmentTitle: appointmentLabel,
    }),
    nextStepLabel: buildShareNextStepLabel(normalizedChannel),
    clientLabel: input.client?.fullName ?? null,
    clientStageLabel: input.client?.stageLabel ?? null,
    clientStageDisplayLabel: input.client
      ? buildClientStageDisplayLabel(input.client.stageLabel)
      : null,
    appointmentLabel,
    appointmentStartsAt: appointmentStartsAtValue,
    appointmentWindowLabel: buildAppointmentWindowLabel(
      appointmentStartsAt,
      input.sentAt,
    ),
  };
}

export type CreateFrontOfficeListingShareLinkInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  listingId: string;
  channel: string;
  clientId?: string | null;
  appointmentId?: string | null;
  acceptedAiAction?: FrontOfficeAiAcceptedActionContext | null;
};

export type FrontOfficeListingShareLinkResult = {
  id: string;
  listingId: string;
  listingTitle: string;
  channel: FrontOfficeSendChannel;
  sharePath: string;
  sendRecordId: string | null;
  context: {
    mode: FrontOfficeListingShareBindingMode;
    modeLabel: string;
    trackingLabel: string;
    trackingStatus: FrontOfficeListingShareWritebackMode;
    clientId: string | null;
    clientBindingSource:
      | FrontOfficeListingShareResolvedClient["bindingSource"]
      | null;
    clientLabel: string | null;
    clientStageLabel: string | null;
    clientStageDisplayLabel: string | null;
    writebackScopeLabel: string;
    appointmentId: string | null;
    appointmentLabel: string | null;
    appointmentStartsAt: string | null;
    appointmentWindowLabel: string | null;
    inheritedClientFromAppointment: boolean;
    followUpKind: FrontOfficeListingShareFollowUpKind;
    followUpCue: string;
    followUpUnopenedAfterDays: number | null;
    quietAfterOpenAfterDays: number | null;
    materialCue: string;
    shareLinkId: string;
    shareCode: string;
    channel: FrontOfficeSendChannel;
    channelLabel: string;
    sendCue: string;
    manualSendCue: string;
    nextStepLabel: string;
    sentAt: string;
    writebackLabel: string;
  };
  execution: {
    trackingLabel: string;
    writebackLabel: string;
    writebackScopeLabel: string;
    nextStepLabel: string;
    sendCue: string;
    manualSendCue: string;
  };
  snapshot: {
    shareLink: {
      id: string;
      code: string;
      sharePath: string;
      channel: FrontOfficeSendChannel;
      createdAt: string;
    };
    binding: {
      mode: FrontOfficeListingShareBindingMode;
      inheritedClientFromAppointment: boolean;
      client: {
        id: string;
        fullName: string;
        stageLabel: string | null;
        bindingSource: FrontOfficeListingShareResolvedClient["bindingSource"];
      } | null;
      appointment: {
        id: string;
        title: string;
        startsAt: string | null;
        windowLabel: string | null;
      } | null;
    };
    trackedSend: {
      id: string | null;
      status: FrontOfficeListingShareWritebackMode;
      sentAt: string;
      channel: FrontOfficeSendChannel;
      channelLabel: string;
      materialType: FrontOfficeSendMaterialType;
      clientStageLabel: string | null;
      appointmentId: string | null;
      appointmentTitle: string | null;
      appointmentStartsAt: string | null;
    };
    followUp: {
      kind: FrontOfficeListingShareFollowUpKind;
      cue: string;
      materialCue: string;
      unopenedAfterDays: number | null;
      quietAfterOpenAfterDays: number | null;
    };
    writeback: {
      shareLinkCreated: true;
      sendRecordCreated: boolean;
      sendRecordId: string | null;
      aiAcceptedActionRecorded: boolean;
      clientBound: boolean;
      appointmentBound: boolean;
      label: string;
      scopeLabel: string;
      nextStepLabel: string;
    };
    publicPage: {
      shareSurfaceLabel: string;
      shareContextLabel: string;
      channelLabel: string;
      trackingLabel: string;
      replyLaneLabel: string;
      nextStepLabel: string;
      followUpLabel: string;
      privacyLabel: string;
    };
  };
};

export type FrontOfficeListingSharePageSnapshot = {
  code: string;
  listingTitle: string;
  areaLabel: string;
  priceLabel: string;
  factsLabel: string;
  summaryLabel: string;
  statusLabel: string;
  shareSurfaceLabel: string;
  shareContextLabel: string;
  channelLabel: string;
  trackingLabel: string;
  replyLaneLabel: string;
  nextStepLabel: string;
  followUpLabel: string;
  privacyLabel: string;
  sourceUrl: string;
  agentLabel: string;
  agentEmail: string;
  agentPhone: string;
  organizationLabel: string;
};

function resolvePublicShareModeFromStoredState(input: {
  hasTrackedSend: boolean;
  appointmentId: string | null;
}): FrontOfficeListingShareBindingMode {
  if (input.appointmentId) {
    return "client_appointment_context";
  }

  if (input.hasTrackedSend) {
    return "client_dossier_context";
  }

  return "generic_tracked_link";
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
  channel: FrontOfficeSendChannel;
}) {
  if (input.mode === "client_appointment_context") {
    return "Reply in the same conversation if you are confirming timing, access, or the next showing step.";
  }

  if (input.mode === "client_dossier_context") {
    return input.channel === FrontOfficeSendChannel.email
      ? "Reply in the same email thread so the shortlist and next option stay aligned."
      : "Reply in the same chat thread so the shortlist and next option stay aligned.";
  }

  return "If this page was forwarded, ask the sender for the original conversation so the next step stays aligned.";
}

function buildSharePublicTrackingLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  channel: FrontOfficeSendChannel;
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
  channel: FrontOfficeSendChannel;
}) {
  if (input.mode === "client_appointment_context") {
    return "If you were sent this for an appointment or showing, keep the reply in the same thread so timing and follow-through do not split.";
  }

  if (input.mode === "client_dossier_context") {
    return input.channel === FrontOfficeSendChannel.email
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

function buildSharePublicPageSnapshot(input: {
  mode: FrontOfficeListingShareBindingMode;
  channel: FrontOfficeSendChannel;
  appointmentTitle: string | null;
}) {
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

function buildShareResultSnapshot(input: {
  shareLinkId: string;
  shareCode: string;
  sharePath: string;
  shareLinkCreatedAt: Date;
  channel: FrontOfficeSendChannel;
  client: FrontOfficeListingShareResolvedClient | null;
  appointment: FrontOfficeListingShareResolvedAppointment | null;
  inheritedClientFromAppointment: boolean;
  sentAt: Date;
  sendRecordId: string | null;
  aiAcceptedActionRecorded: boolean;
}) {
  const mode = resolveFrontOfficeListingShareBindingMode({
    client: input.client,
    appointment: input.appointment,
  });
  const clientStageLabel = input.client?.stageLabel ?? null;
  const appointmentTitle = input.appointment?.title ?? null;
  const appointmentStartsAt = input.appointment?.startsAt ?? null;
  const appointmentStartsAtIso = appointmentStartsAt?.toISOString() || null;
  const appointmentWindowLabel = buildAppointmentWindowLabel(
    appointmentStartsAt,
    input.sentAt,
  );
  const sentAtIso = input.sentAt.toISOString();
  const trackingStatus: FrontOfficeListingShareWritebackMode =
    input.sendRecordId ? "tracked_send_recorded" : "tracked_link_only";
  const followUp = buildShareFollowUpSnapshot(mode);
  const materialCue = buildShareMaterialCue({
    mode,
    clientStageLabel,
  });
  const channelLabel = buildShareChannelLabel(input.channel);
  const writebackLabel = buildShareWritebackLabel({
    sendRecordId: input.sendRecordId,
    aiAcceptedActionRecorded: input.aiAcceptedActionRecorded,
  });
  const writebackScopeLabel = buildShareWritebackScopeLabel({
    mode,
    clientName: input.client?.fullName ?? null,
    appointmentTitle,
  });
  const sendCue = buildShareSendCue({
    channel: input.channel,
    mode,
  });
  const manualSendCue = buildShareManualSendCue(input.channel);
  const nextStepLabel = buildShareNextStepLabel(input.channel);
  const publicPage = buildSharePublicPageSnapshot({
    mode,
    channel: input.channel,
    appointmentTitle,
  });

  return {
    context: {
      mode,
      modeLabel: buildShareModeLabel(mode),
      trackingLabel: buildShareTrackingLabel({
        mode,
        clientName: input.client?.fullName ?? null,
        appointmentTitle,
      }),
      trackingStatus,
      clientId: input.client?.id ?? null,
      clientBindingSource: input.client?.bindingSource ?? null,
      clientLabel: input.client?.fullName ?? null,
      clientStageLabel,
      clientStageDisplayLabel: input.client
        ? buildClientStageDisplayLabel(clientStageLabel)
        : null,
      writebackScopeLabel,
      appointmentId: input.appointment?.id ?? null,
      appointmentLabel: appointmentTitle,
      appointmentStartsAt: appointmentStartsAtIso,
      appointmentWindowLabel,
      inheritedClientFromAppointment: input.inheritedClientFromAppointment,
      followUpKind: followUp.kind,
      followUpCue: followUp.cue,
      followUpUnopenedAfterDays: followUp.unopenedAfterDays,
      quietAfterOpenAfterDays: followUp.quietAfterOpenAfterDays,
      materialCue,
      shareLinkId: input.shareLinkId,
      shareCode: input.shareCode,
      channel: input.channel,
      channelLabel,
      sendCue,
      manualSendCue,
      nextStepLabel,
      sentAt: sentAtIso,
      writebackLabel,
    },
    execution: {
      trackingLabel: buildShareTrackingLabel({
        mode,
        clientName: input.client?.fullName ?? null,
        appointmentTitle,
      }),
      writebackLabel,
      writebackScopeLabel,
      nextStepLabel,
      sendCue,
      manualSendCue,
    },
    snapshot: {
      shareLink: {
        id: input.shareLinkId,
        code: input.shareCode,
        sharePath: input.sharePath,
        channel: input.channel,
        createdAt: input.shareLinkCreatedAt.toISOString(),
      },
      binding: {
        mode,
        inheritedClientFromAppointment: input.inheritedClientFromAppointment,
        client: input.client
          ? {
              id: input.client.id,
              fullName: input.client.fullName,
              stageLabel: clientStageLabel,
              bindingSource: input.client.bindingSource,
            }
          : null,
        appointment: input.appointment
          ? {
              id: input.appointment.id,
              title: appointmentTitle || "Appointment context",
              startsAt: appointmentStartsAtIso,
              windowLabel: appointmentWindowLabel,
            }
          : null,
      },
      trackedSend: {
        id: input.sendRecordId,
        status: trackingStatus,
        sentAt: sentAtIso,
        channel: input.channel,
        channelLabel,
        materialType: FrontOfficeSendMaterialType.listing_share,
        clientStageLabel,
        appointmentId: input.appointment?.id ?? null,
        appointmentTitle,
        appointmentStartsAt: appointmentStartsAtIso,
      },
      followUp: {
        kind: followUp.kind,
        cue: followUp.cue,
        materialCue,
        unopenedAfterDays: followUp.unopenedAfterDays,
        quietAfterOpenAfterDays: followUp.quietAfterOpenAfterDays,
      },
      writeback: {
        shareLinkCreated: true as const,
        sendRecordCreated: Boolean(input.sendRecordId),
        sendRecordId: input.sendRecordId,
        aiAcceptedActionRecorded: input.aiAcceptedActionRecorded,
        clientBound: Boolean(input.client),
        appointmentBound: Boolean(input.appointment),
        label: writebackLabel,
        scopeLabel: writebackScopeLabel,
        nextStepLabel,
      },
      publicPage,
    },
  };
}

export async function createFrontOfficeListingShareLink(
  input: CreateFrontOfficeListingShareLinkInput,
): Promise<FrontOfficeListingShareLinkResult> {
  const listingId = normalizeOptionalText(input.listingId);

  if (!listingId) {
    throw createFrontOfficeListingShareLinkError({
      code: "listing_id_required",
      message: "Listing id is required.",
    });
  }

  const clientId = normalizeOptionalText(input.clientId ?? null);
  const appointmentId = normalizeOptionalText(input.appointmentId ?? null);
  const acceptedAiAction =
    input.acceptedAiAction &&
    normalizeOptionalText(input.acceptedAiAction.suggestionLabel)
      ? {
          sourceSurface: input.acceptedAiAction.sourceSurface,
          suggestionKind: input.acceptedAiAction.suggestionKind,
          suggestionLabel: normalizeOptionalText(
            input.acceptedAiAction.suggestionLabel,
          )!,
          actionTitle: normalizeOptionalText(
            input.acceptedAiAction.actionTitle ?? null,
          ),
        }
      : null;

  if (input.acceptedAiAction && !acceptedAiAction) {
    throw createFrontOfficeListingShareLinkError({
      code: "ai_action_label_required",
      message: "AI tracked-send assist requires a suggestion label.",
    });
  }

  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const normalizedChannel = parseFrontOfficeSendChannel(input.channel);
  const [listing, explicitClient, appointment] = await Promise.all([
    prisma.listing.findFirst({
      where: {
        id: listingId,
        organizationId: input.organizationId,
        status: {
          in: activeListingStatuses,
        },
        ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
      },
      select: {
        id: true,
        title: true,
      },
    }),
    clientId
      ? prisma.client.findFirst({
          where: {
            id: clientId,
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
          },
          select: {
            id: true,
            fullName: true,
            stage: true,
          },
        })
      : Promise.resolve(null),
    appointmentId
      ? prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
            ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            client: {
              select: {
                id: true,
                fullName: true,
                stage: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!listing) {
    throw createFrontOfficeListingShareLinkError({
      code: "listing_not_found",
      message: "Listing not found in the current Front Office scope.",
      status: 404,
    });
  }

  if (clientId && !explicitClient) {
    throw createFrontOfficeListingShareLinkError({
      code: "client_not_found",
      message: "Client not found in the current Front Office scope.",
      status: 404,
    });
  }

  if (appointmentId && !appointment) {
    throw createFrontOfficeListingShareLinkError({
      code: "appointment_not_found",
      message: "Appointment not found in the current Front Office scope.",
      status: 404,
    });
  }

  if (appointment && !appointment.client?.id) {
    throw createFrontOfficeListingShareLinkError({
      code: "appointment_requires_client",
      message: "Only client-linked appointments can be used as send context.",
      status: 409,
    });
  }

  if (
    explicitClient &&
    appointment?.client?.id &&
    appointment.client.id !== explicitClient.id
  ) {
    throw createFrontOfficeListingShareLinkError({
      code: "appointment_client_mismatch",
      message: "Appointment context does not match the selected client.",
      status: 409,
    });
  }

  const client: FrontOfficeListingShareResolvedClient | null = explicitClient
    ? {
        id: explicitClient.id,
        fullName: explicitClient.fullName,
        stageLabel: normalizeOptionalText(explicitClient.stage),
        bindingSource: "explicit_client",
      }
    : appointment?.client
      ? {
          id: appointment.client.id,
          fullName: appointment.client.fullName,
          stageLabel: normalizeOptionalText(appointment.client.stage),
          bindingSource: "appointment_context",
        }
      : null;
  const resolvedAppointment: FrontOfficeListingShareResolvedAppointment | null =
    appointment
      ? {
          id: appointment.id,
          title: appointment.title.trim(),
          startsAt: appointment.startsAt ?? null,
        }
      : null;
  const inheritedClientFromAppointment =
    client?.bindingSource === "appointment_context";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = buildShareCode();
    const sharePath = buildFrontOfficeListingSharePath(code);
    const sentAt = new Date();

    try {
      const transactionResult = await prisma.$transaction(
        async (transaction) => {
          const createdShareLink = await transaction.listingShareLink.create({
            data: {
              listingId: listing.id,
              membershipId: input.viewerMembershipId,
              channel: normalizedChannel,
              code,
              targetUrl: sharePath,
            },
            select: {
              id: true,
              code: true,
              targetUrl: true,
              createdAt: true,
            },
          });
          const createdSendRecord = client
            ? await transaction.frontOfficeSendRecord.create({
                data: {
                  organizationId: input.organizationId,
                  officeId: input.officeId ?? null,
                  senderMembershipId: input.viewerMembershipId,
                  clientId: client.id,
                  listingId: listing.id,
                  appointmentId: resolvedAppointment?.id ?? null,
                  shareLinkId: createdShareLink.id,
                  channel: normalizedChannel,
                  materialType: FrontOfficeSendMaterialType.listing_share,
                  clientStageLabel: client.stageLabel,
                  appointmentTitle: resolvedAppointment?.title ?? null,
                  appointmentStartsAt: resolvedAppointment?.startsAt ?? null,
                  sentAt,
                },
                select: {
                  id: true,
                  sentAt: true,
                },
              })
            : null;
          let aiAcceptedActionRecorded = false;

          if (acceptedAiAction) {
            if (!client?.id || !createdSendRecord?.id) {
              throw createFrontOfficeListingShareLinkError({
                code: "ai_action_requires_client_context",
                message:
                  "AI tracked-send assist requires client-linked send context.",
                status: 409,
              });
            }

            await recordFrontOfficeAiAcceptedAction(transaction, {
              organizationId: input.organizationId,
              officeId: input.officeId ?? null,
              membershipId: input.viewerMembershipId,
              clientId: client.id,
              listingId: listing.id,
              sendRecordId: createdSendRecord.id,
              actionType: "tracked_send_created",
              sourceSurface: acceptedAiAction.sourceSurface,
              suggestionKind: acceptedAiAction.suggestionKind,
              suggestionLabel: acceptedAiAction.suggestionLabel,
              actionTitle: acceptedAiAction.actionTitle || listing.title,
              channel: normalizedChannel,
            });
            aiAcceptedActionRecorded = true;
          }

          return {
            createdShareLink,
            createdSendRecord,
            aiAcceptedActionRecorded,
          };
        },
      );

      const shareSnapshot = buildShareResultSnapshot({
        shareLinkId: transactionResult.createdShareLink.id,
        shareCode: transactionResult.createdShareLink.code,
        sharePath: transactionResult.createdShareLink.targetUrl,
        shareLinkCreatedAt: transactionResult.createdShareLink.createdAt,
        channel: normalizedChannel,
        client,
        appointment: resolvedAppointment,
        inheritedClientFromAppointment,
        sentAt: transactionResult.createdSendRecord?.sentAt ?? sentAt,
        sendRecordId: transactionResult.createdSendRecord?.id ?? null,
        aiAcceptedActionRecorded: transactionResult.aiAcceptedActionRecorded,
      });

      return {
        id: transactionResult.createdShareLink.id,
        listingId: listing.id,
        listingTitle: listing.title,
        channel: normalizedChannel,
        sharePath: transactionResult.createdShareLink.targetUrl,
        sendRecordId: transactionResult.createdSendRecord?.id ?? null,
        context: shareSnapshot.context,
        execution: shareSnapshot.execution,
        snapshot: shareSnapshot.snapshot,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw createFrontOfficeListingShareLinkError({
    code: "share_link_code_conflict",
    message: "Could not create a unique listing share link.",
    status: 409,
  });
}

export async function getFrontOfficeListingSharePageSnapshot(
  code: string,
): Promise<FrontOfficeListingSharePageSnapshot | null> {
  const shareLink = await prisma.listingShareLink.findUnique({
    where: { code },
    select: {
      code: true,
      channel: true,
      membershipId: true,
      sendRecord: {
        select: {
          id: true,
          channel: true,
          appointmentId: true,
          appointmentTitle: true,
          firstOpenedAt: true,
          lastOpenedAt: true,
          openCount: true,
        },
      },
      listing: {
        select: {
          title: true,
          neighborhood: true,
          city: true,
          price: true,
          bedrooms: true,
          bathrooms: true,
          aiSummary: true,
          sourceUrl: true,
          status: true,
          organization: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!shareLink) {
    return null;
  }

  const openedAt = new Date();
  await prisma.$transaction([
    prisma.listingShareLink.update({
      where: { code },
      data: {
        clickCount: {
          increment: 1,
        },
      },
    }),
    ...(shareLink.sendRecord
      ? [
          prisma.frontOfficeSendRecord.update({
            where: { id: shareLink.sendRecord.id },
            data: {
              openCount: {
                increment: 1,
              },
              lastOpenedAt: openedAt,
              ...(shareLink.sendRecord.firstOpenedAt
                ? {}
                : { firstOpenedAt: openedAt }),
            },
          }),
        ]
      : []),
  ]);

  const membership = shareLink.membershipId
    ? await prisma.membership.findUnique({
        where: { id: shareLink.membershipId },
        select: {
          title: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      })
    : null;

  const agentName =
    `${membership?.user.firstName ?? ""} ${membership?.user.lastName ?? ""}`.trim() ||
    membership?.user.email ||
    "Acre agent";
  const agentLabel = membership?.title?.trim()
    ? `${agentName} · ${membership.title.trim()}`
    : agentName;
  const publicPage = buildSharePublicPageSnapshot({
    mode: resolvePublicShareModeFromStoredState({
      hasTrackedSend: Boolean(shareLink.sendRecord),
      appointmentId: shareLink.sendRecord?.appointmentId ?? null,
    }),
    channel: shareLink.sendRecord?.channel ?? shareLink.channel,
    appointmentTitle: shareLink.sendRecord?.appointmentTitle?.trim() || null,
  });

  return {
    code: shareLink.code,
    listingTitle: shareLink.listing.title,
    areaLabel: `${shareLink.listing.neighborhood}, ${shareLink.listing.city}`,
    priceLabel: formatCurrency(shareLink.listing.price),
    factsLabel: buildFactsLabel({
      bedrooms: shareLink.listing.bedrooms,
      bathrooms: shareLink.listing.bathrooms,
    }),
    summaryLabel:
      shareLink.listing.aiSummary?.trim() || "Curated listing from Acre.",
    statusLabel:
      shareLink.listing.status === ListingStatus.hot
        ? "Hot listing"
        : "Active listing",
    shareSurfaceLabel: publicPage.shareSurfaceLabel,
    shareContextLabel: publicPage.shareContextLabel,
    channelLabel: publicPage.channelLabel,
    trackingLabel: publicPage.trackingLabel,
    replyLaneLabel: publicPage.replyLaneLabel,
    nextStepLabel: publicPage.nextStepLabel,
    followUpLabel: publicPage.followUpLabel,
    privacyLabel: publicPage.privacyLabel,
    sourceUrl: shareLink.listing.sourceUrl?.trim() || "",
    agentLabel,
    agentEmail: membership?.user.email?.trim() || "",
    agentPhone: membership?.user.phone?.trim() || "",
    organizationLabel: shareLink.listing.organization.name,
  };
}
