"use client";

import { useState, useTransition, type ComponentProps } from "react";
import type { FrontOfficeListingsSnapshot, FrontOfficeTone } from "@acre/db";
import type { FrontOfficeSendChannel } from "@prisma/client";
import {
  buildFrontOfficeListingSharePromiseSnapshot,
  type FrontOfficeListingSharePromiseSnapshot,
} from "../../../../../packages/db/src/front-office-listing-share-promise";
import type { FrontOfficeListingUsagePulse } from "../../../../../packages/db/src/front-office-listing-output";
import { Badge, Button, EmptyState, QueueItem } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import type {
  FrontOfficeListingsDraftAssist,
  FrontOfficeListingsRouteState,
} from "./front-office-listings-route-state";

type FrontOfficeListingsOutputClientProps = {
  snapshot: FrontOfficeListingsSnapshot;
  routeState: FrontOfficeListingsRouteState;
  usagePulse: FrontOfficeListingUsagePulse;
  draftAssist?: FrontOfficeListingsDraftAssist | null;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
  detail?: string | null;
} | null;

type PendingAction = {
  listingId: string;
  action: "sms" | "email" | "direct";
} | null;

type ShareActionContext = {
  mode?: string;
  modeLabel?: string;
  trackingLabel?: string;
  trackingStatus?: string;
  writebackLabel?: string;
  writebackScopeLabel?: string;
  clientLabel?: string | null;
  clientStageLabel?: string | null;
  clientStageDisplayLabel?: string | null;
  appointmentLabel?: string | null;
  appointmentWindowLabel?: string | null;
  inheritedClientFromAppointment?: boolean;
  channelLabel?: string;
  sendCue?: string;
  manualSendCue?: string;
  nextStepLabel?: string;
  followUpCue?: string;
  materialCue?: string;
};

type ShareActionResultPayload = {
  error?: string;
  shareLink?: {
    sharePath?: string;
    sendRecordId?: string | null;
    context?: ShareActionContext;
    snapshot?: {
      followUp?: {
        cue?: string;
        materialCue?: string;
      };
      writeback?: {
        label?: string;
        scopeLabel?: string;
        nextStepLabel?: string;
      };
    };
  };
  publicPage?: {
    shareSurfaceLabel?: string;
    shareContextLabel?: string;
    replyLaneLabel?: string;
    nextStepLabel?: string;
    privacyLabel?: string;
  };
  writeback?: {
    label?: string;
    scopeLabel?: string;
    nextStepLabel?: string;
  };
} | null;

type QueueItemBadgeTone = NonNullable<
  ComponentProps<typeof QueueItem>["badgeTone"]
>;

type RecommendedShareAction = {
  action: "sms" | "email" | "direct";
  label: string;
  reason: string;
};

type ShareLanePlan = {
  action: "sms" | "email" | "direct";
  badgeLabel: string;
  badgeTone: QueueItemBadgeTone;
  title: string;
  context: string;
  description: string;
  meta: string[];
  isRecommended: boolean;
};

type ClientFacingShareContract = {
  badgeLabel: string;
  badgeTone: QueueItemBadgeTone;
  title: string;
  context: string;
  description: string;
  meta: string[];
};

type ClientFacingSharePromise = FrontOfficeListingSharePromiseSnapshot;

type ListingSendRiskWatch = {
  badgeLabel: string;
  badgeTone: QueueItemBadgeTone;
  context: string;
  description: string;
  meta: string[];
};

async function copyTextToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

function buildAbsoluteUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function buildSmsTemplate(input: {
  title: string;
  areaLabel: string;
  priceLabel: string;
  shareUrl: string;
  clientName?: string;
}) {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hi,";

  return `${greeting} I found a listing that may fit what we discussed: ${input.title} in ${input.areaLabel}. ${input.priceLabel}. Here is the private link with the details: ${input.shareUrl}`;
}

function buildEmailTemplate(input: {
  title: string;
  areaLabel: string;
  priceLabel: string;
  summaryLabel: string;
  shareUrl: string;
  clientName?: string;
}) {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hi,";

  return `Subject: Listing match: ${input.title}\n\n${greeting}\n\nI found a listing that may fit what we discussed.\n\nListing: ${input.title}\nArea: ${input.areaLabel}\nPrice: ${input.priceLabel}\nWhy it stands out: ${input.summaryLabel}\n\nPrivate share link: ${input.shareUrl}\n\nReply with your reaction and I can line up the next options or a showing.\n`;
}

function buildAssistedSmsTemplate(input: { body: string; shareUrl: string }) {
  return `${input.body.trim()}\n\nPrivate listing link: ${input.shareUrl}`;
}

function buildAssistedEmailTemplate(input: {
  subjectLine: string;
  body: string;
  title: string;
  shareUrl: string;
}) {
  const footer = `\n\nListing: ${input.title}\nPrivate share link: ${input.shareUrl}`;
  const subject = input.subjectLine.trim()
    ? `Subject: ${input.subjectLine.trim()}\n\n`
    : "";

  return `${subject}${input.body.trim()}${footer}`;
}

function buildListingExecutionCue(
  snapshot: FrontOfficeListingsSnapshot,
  listing: FrontOfficeListingsSnapshot["listings"][number],
) {
  if (snapshot.targetAppointment && snapshot.targetClient) {
    return `Best used as a ${snapshot.targetAppointment.typeLabel.toLowerCase()} follow-up for ${snapshot.targetClient.fullName}, so the listing, client stage, and appointment context stay in one place.`;
  }

  if (snapshot.targetClient) {
    return `Best used as a client-linked recommendation for ${snapshot.targetClient.fullName} while the ${snapshot.targetClient.stage.toLowerCase()} stage is still active.`;
  }

  if (listing.trackedClickCount > 0) {
    return "This listing already has tracked engagement in your feed, so it is a good candidate for another manual touch without losing attribution.";
  }

  return "Use this when you need a tracked recommendation now, then reopen it from a client page later if the follow-up should stay attached to one person.";
}

function buildListingTractionCue(
  listing: FrontOfficeListingsSnapshot["listings"][number],
) {
  if (listing.trackedLinkCount <= 0) {
    return "No tracked share has gone out for this listing yet. Use the option that gives the client enough context before you ask for a click.";
  }

  if (listing.trackedClickCount <= 0) {
    return `${listing.trackedLinkCount} tracked send(s) are still quiet. Tighten the reason-to-care or pair the share with stronger agent context before resending.`;
  }

  if (listing.trackedClickCount >= listing.trackedLinkCount) {
    return "Tracked sends are already producing a strong pulse here. Good candidate for a shortlist or showing follow-up instead of a cold first touch.";
  }

  return `${listing.trackedClickCount} click(s) across ${listing.trackedLinkCount} tracked send(s). Use SMS when you want a quicker pulse instead of another long note.`;
}

function buildListingMaterialCue(snapshot: FrontOfficeListingsSnapshot) {
  if (snapshot.targetAppointment) {
    return "Share cue: pair the listing with the intro text and one recent closing so the client sees both appointment context and agent proof.";
  }

  if (snapshot.agentMaterial.featuredCaseCount > 0) {
    return "Share cue: pair the listing with the business card and one featured case so the message carries identity and proof, not just inventory.";
  }

  if (snapshot.agentMaterial.portraitReady) {
    return "Share cue: pair the listing with the business card so the message still carries agent identity even without case history.";
  }

  return "Share cue: use the intro email or business card so the link does not travel alone.";
}

function buildChannelCue(
  snapshot: FrontOfficeListingsSnapshot,
  action: "sms" | "email" | "direct",
) {
  if (action === "sms") {
    return snapshot.targetAppointment
      ? "Fastest option for a quick reaction or confirmation around the active appointment."
      : snapshot.targetClient
        ? "Best when you want a quick yes / no reaction without losing tracked attribution."
        : "Best for manual texting apps once you still want the private tracked link copied with the note.";
  }

  if (action === "email") {
    return snapshot.targetClient
      ? "Best when the client needs more framing, summary, and a clear next-step ask beside the tracked link."
      : "Best when you need more context than a raw link, even before the share is tied to a client page.";
  }

  return snapshot.targetClient
    ? "Use this for WeChat, ad-hoc chat, or manual send flows when you only need the tracked private URL."
    : "Use this when you need the tracked URL only and will handle the rest of the context elsewhere.";
}

function buildActionButtonLabel(input: {
  action: "sms" | "email" | "direct";
  usesDraftAssist: boolean;
}) {
  if (input.action === "sms") {
    return input.usesDraftAssist ? "Use SMS draft + link" : "Copy SMS + link";
  }

  if (input.action === "email") {
    return input.usesDraftAssist
      ? "Use email draft + link"
      : "Copy email + link";
  }

  return "Copy tracked link only";
}

function buildDraftLaneNote(
  draftAssist: FrontOfficeListingsDraftAssist | null,
) {
  if (!draftAssist) {
    return "No saved draft is loaded, so every option below uses the standard message templates.";
  }

  return `Only the ${draftAssist.channel === "sms" ? "SMS" : "Email"} option below uses this draft. The other options stay on the standard message templates, and nothing is sent automatically.`;
}

function buildListingRecommendedShareAction(input: {
  snapshot: FrontOfficeListingsSnapshot;
  listing: FrontOfficeListingsSnapshot["listings"][number];
  draftAssist: FrontOfficeListingsDraftAssist | null;
  routeState: FrontOfficeListingsRouteState;
}): RecommendedShareAction {
  if (input.draftAssist?.channel === "sms") {
    return {
      action: "sms",
      label: "SMS draft",
      reason:
        "A matching SMS draft is already loaded here, so the fastest safe move is to keep the loaded text and tracked link together.",
    };
  }

  if (input.draftAssist?.channel === "email") {
    return {
      action: "email",
      label: "Email draft",
      reason:
        "A matching email draft is already loaded here, so the cleanest move is to keep the loaded framing and tracked link together.",
    };
  }

  if (input.routeState.focusedRouteLane === "draft-lane") {
    return {
      action: "sms",
      label: "Draft",
      reason:
        "A draft view is selected here, so keep it ready for the matching draft before you copy anything.",
    };
  }

  if (input.routeState.focusedRouteLane === "follow-through") {
    return {
      action: input.snapshot.targetAppointment ? "sms" : "email",
      label: input.snapshot.targetAppointment
        ? "Appointment follow-up"
        : "Client follow-up",
      reason: input.snapshot.targetAppointment
        ? "This view is already tied to the appointment, so a quick reaction keeps the next touch in the same place."
        : "This view is already tied to the client, so the next follow-up should stay here instead of restarting as a generic share.",
    };
  }

  if (input.routeState.focusedRouteLane === "send-rescue") {
    return {
      action: input.listing.trackedClickCount > 0 ? "sms" : "email",
      label: "Re-engagement",
      reason:
        input.listing.trackedClickCount > 0
          ? "This listing already has engagement, so re-engagement should reopen it with a short reply path."
          : "This listing is quiet, so re-engagement should reopen it with a tighter reason-to-care while keeping the tracked link attached.",
    };
  }

  return {
    action: input.snapshot.targetClient ? "email" : "direct",
    label: input.snapshot.targetAppointment
      ? "Appointment quick reply"
      : input.snapshot.targetClient
        ? "Framed message"
        : "Link only",
    reason: input.snapshot.targetAppointment
      ? "Appointment-linked sends usually need a faster reaction or confirmation path than a long note."
      : input.snapshot.targetClient
        ? "A richer framed send is the safer first move when the client still needs context."
        : "Use the raw tracked URL only when the surrounding context already exists in another manual conversation thread.",
  };
}

function mapBadgeTone(value: FrontOfficeTone): QueueItemBadgeTone {
  switch (value) {
    case "neutral":
      return "neutral";
    case "accent":
      return "accent";
    case "danger":
      return "danger";
    case "warning":
      return "warning";
    case "success":
      return "success";
    default:
      return "accent";
  }
}

function buildListingEmptyState(
  props: FrontOfficeListingsOutputClientProps,
): Pick<ComponentProps<typeof EmptyState>, "title" | "description"> {
  if (props.snapshot.targetAppointment && props.snapshot.targetClient) {
    return {
      title: "No listings ready in this appointment context",
      description:
        "This appointment follow-up view is ready, but there are no listings in scope right now. Keep the context if you are coming back after shortlist updates.",
    };
  }

  if (props.snapshot.targetClient) {
    return {
      title: "No listings ready for this client",
      description:
        "This client follow-up view is ready, but there are no listings to copy from yet. Reopen it later and the same client context will still be valid.",
    };
  }

  return {
    title: "No listing inventory in scope",
    description:
      "Listings will appear here once send-ready inventory is available in the Front Office feed.",
  };
}

function buildWorkspaceHeading(props: FrontOfficeListingsOutputClientProps) {
  if (props.snapshot.targetAppointment && props.snapshot.targetClient) {
    return `${props.routeState.focusedRouteLaneLabel} for ${props.snapshot.targetClient.fullName}`;
  }

  if (props.snapshot.targetClient) {
    return `${props.routeState.focusedRouteLaneLabel} for ${props.snapshot.targetClient.fullName}`;
  }

  return `${props.routeState.focusedRouteLaneLabel} for tracked listings`;
}

function buildTrackedContextBadgeLabel(
  listing: FrontOfficeListingsSnapshot["listings"][number],
) {
  if (listing.trackedLinkCount <= 0) {
    return "Fresh pulse";
  }

  if (listing.trackedClickCount <= 0) {
    return "Quiet pulse";
  }

  if (listing.trackedClickCount >= listing.trackedLinkCount) {
    return "Active pulse";
  }

  return "Warm pulse";
}

function buildTrackedContextBadgeTone(
  listing: FrontOfficeListingsSnapshot["listings"][number],
): QueueItemBadgeTone {
  if (listing.trackedClickCount > 0) {
    return "success";
  }

  if (listing.trackedLinkCount > 0) {
    return "warning";
  }

  return "neutral";
}

function buildShareLanePlan(input: {
  snapshot: FrontOfficeListingsSnapshot;
  routeState: FrontOfficeListingsRouteState;
  listing: FrontOfficeListingsSnapshot["listings"][number];
  draftAssist: FrontOfficeListingsDraftAssist | null;
  action: "sms" | "email" | "direct";
  recommendedAction: RecommendedShareAction;
}): ShareLanePlan {
  const usesDraftAssist =
    input.action !== "direct" &&
    input.draftAssist?.channel === input.action &&
    Boolean(input.draftAssist.body.trim());
  const isRecommended = input.recommendedAction.action === input.action;
  const writebackMeta =
    input.routeState.mode === "appointment-linked"
      ? "Saved to: client + appointment."
      : input.routeState.mode === "client-linked"
        ? "Saved to: client."
        : "Saved to: tracked link only.";
  const focusedLaneMeta =
    input.routeState.focusedRouteLane === "draft-lane"
      ? "Current view: draft."
      : input.routeState.focusedRouteLane === "follow-through"
        ? "Current view: follow-up."
        : "Current view: re-engagement.";

  if (input.action === "sms") {
    return {
      action: "sms",
      badgeLabel: "SMS",
      badgeTone: "accent",
      title: usesDraftAssist
        ? "SMS draft + tracked link"
        : input.routeState.focusedRouteLane === "follow-through" &&
            input.snapshot.targetAppointment
          ? "Appointment follow-up text"
          : input.routeState.focusedRouteLane === "send-rescue"
            ? "SMS re-engagement text"
            : "Quick reaction text",
      context: usesDraftAssist
        ? "AI draft loaded"
        : isRecommended
          ? input.routeState.focusedRouteLaneLabel
          : "Standard copy",
      description: buildChannelCue(input.snapshot, "sms"),
      meta: [
        usesDraftAssist
          ? "Copy result: loaded SMS draft + tracked link."
          : "Copy result: standard SMS template + tracked link.",
        writebackMeta,
        focusedLaneMeta,
        input.routeState.preferredSupportLane === "sms"
          ? "Pair with: SMS support message."
          : "Pair with: intro text + business card when the note needs more identity.",
      ],
      isRecommended,
    };
  }

  if (input.action === "email") {
    return {
      action: "email",
      badgeLabel: "Email",
      badgeTone: "success",
      title: usesDraftAssist
        ? "Email draft + tracked link"
        : input.routeState.focusedRouteLane === "follow-through"
          ? "Follow-through email"
          : "Framed email send",
      context: usesDraftAssist
        ? "AI draft loaded"
        : isRecommended
          ? input.routeState.focusedRouteLaneLabel
          : "Standard copy",
      description: buildChannelCue(input.snapshot, "email"),
      meta: [
        usesDraftAssist
          ? "Copy result: loaded email draft + tracked link."
          : "Copy result: standard email template + tracked link.",
        writebackMeta,
        focusedLaneMeta,
        input.routeState.preferredSupportLane === "email"
          ? "Pair with: email support message."
          : "Pair with: email support message when the client needs more framing.",
      ],
      isRecommended,
    };
  }

  return {
    action: "direct",
    badgeLabel: "Direct",
    badgeTone: "warning",
    title: input.snapshot.targetClient
      ? "Live chat / WeChat link"
      : "Raw tracked link",
    context: isRecommended
      ? input.routeState.focusedRouteLaneLabel
      : "Link only",
    description: buildChannelCue(input.snapshot, "direct"),
    meta: [
      "Copy result: private tracked link only.",
      writebackMeta,
      focusedLaneMeta,
      "Pair with: business card or support message if the conversation thread does not already carry context.",
    ],
    isRecommended,
  };
}

function buildShareFeedback(input: {
  listingTitle: string;
  action: "sms" | "email" | "direct";
  usedDraftAssist: boolean;
  routeState: FrontOfficeListingsRouteState;
  payload: ShareActionResultPayload;
}): FeedbackState {
  const payload = input.payload ?? {};
  const context = payload.shareLink?.context;
  const writebackLabel =
    payload.writeback?.label ||
    payload.shareLink?.snapshot?.writeback?.label ||
    context?.writebackLabel ||
    null;
  const scopeLabel =
    context?.writebackScopeLabel ||
    payload.writeback?.scopeLabel ||
    payload.shareLink?.snapshot?.writeback?.scopeLabel ||
    context?.trackingLabel ||
    null;
  const nextStepLabel =
    context?.nextStepLabel ||
    payload.writeback?.nextStepLabel ||
    payload.shareLink?.snapshot?.writeback?.nextStepLabel ||
    context?.manualSendCue ||
    null;
  const nextCue =
    input.action === "direct"
      ? context?.materialCue ||
        payload.shareLink?.snapshot?.followUp?.materialCue ||
        null
      : payload.shareLink?.snapshot?.followUp?.cue ||
        context?.followUpCue ||
        context?.materialCue ||
        null;
  const publicPage = input.payload?.publicPage;
  const channelLabel =
    input.action === "sms"
      ? input.usedDraftAssist
        ? "SMS draft + tracked link"
        : "SMS message + tracked link"
      : input.action === "email"
        ? input.usedDraftAssist
          ? "Email draft + tracked link"
          : "Email message + tracked link"
        : "Private tracked link";
  const detail = [writebackLabel, scopeLabel, nextStepLabel]
    .concat(
      publicPage?.shareSurfaceLabel
        ? [`Client view · ${publicPage.shareSurfaceLabel}`]
        : [],
      publicPage?.shareContextLabel
        ? [`Public note · ${publicPage.shareContextLabel}`]
        : [],
      publicPage?.replyLaneLabel
        ? [`Reply path · ${publicPage.replyLaneLabel}`]
        : [],
      publicPage?.privacyLabel ? [`Privacy · ${publicPage.privacyLabel}`] : [],
      nextCue
        ? [
            `${input.action === "direct" ? "Share cue" : "Next cue"}: ${nextCue}`,
          ]
        : [],
      input.routeState.stableReentryDescription
        ? [`Saved view: ${input.routeState.stableReentryDescription}`]
        : [],
    )
    .filter(Boolean)
    .join(" ");

  return {
    tone: "success",
    message: `${channelLabel} copied for ${input.listingTitle}.`,
    detail: detail.length ? detail : null,
  };
}

function buildClientFacingShareContract(input: {
  snapshot: FrontOfficeListingsSnapshot;
  recommendedAction: RecommendedShareAction;
}): ClientFacingShareContract {
  const sharePromise = buildClientFacingSharePromise(input);

  if (input.snapshot.targetAppointment) {
    return {
      badgeLabel: "Appt share",
      badgeTone: "accent",
      title: "Client-facing share",
      context: sharePromise.shareSurfaceLabel,
      description: sharePromise.shareContextLabel,
      meta: [
        `Suggested first step · ${input.recommendedAction.label}`,
        `Public page · ${sharePromise.shareSurfaceLabel}.`,
        `Reply path · ${sharePromise.replyLaneLabel}`,
        `Next step · ${sharePromise.nextStepLabel}`,
        `Privacy · ${sharePromise.privacyLabel}`,
      ],
    };
  }

  if (input.snapshot.targetClient) {
    return {
      badgeLabel: "Client share",
      badgeTone: "success",
      title: "Client-facing share",
      context: sharePromise.shareSurfaceLabel,
      description: sharePromise.shareContextLabel,
      meta: [
        `Suggested first step · ${input.recommendedAction.label}`,
        `Public page · ${sharePromise.shareSurfaceLabel}.`,
        `Reply path · ${sharePromise.replyLaneLabel}`,
        `Next step · ${sharePromise.nextStepLabel}`,
        `Privacy · ${sharePromise.privacyLabel}`,
      ],
    };
  }

  return {
    badgeLabel: "Link-only",
    badgeTone: "warning",
    title: "Private share link",
    context: sharePromise.shareSurfaceLabel,
    description: sharePromise.shareContextLabel,
    meta: [
      `Suggested first step · ${input.recommendedAction.label}`,
      `Public page · ${sharePromise.shareSurfaceLabel}.`,
      `Reply path · ${sharePromise.replyLaneLabel}`,
      `Next step · ${sharePromise.nextStepLabel}`,
      `Privacy · ${sharePromise.privacyLabel}`,
    ],
  };
}

function buildClientFacingSharePromise(input: {
  snapshot: FrontOfficeListingsSnapshot;
  recommendedAction: RecommendedShareAction;
}): ClientFacingSharePromise {
  const mode = input.snapshot.targetAppointment
    ? "client_appointment_context"
    : input.snapshot.targetClient
      ? "client_dossier_context"
      : "generic_tracked_link";

  if (input.snapshot.targetAppointment) {
    return buildFrontOfficeListingSharePromiseSnapshot({
      mode,
      channel: input.recommendedAction.action as FrontOfficeSendChannel,
      appointmentTitle: input.snapshot.targetAppointment.title,
    });
  }

  if (input.snapshot.targetClient) {
    return buildFrontOfficeListingSharePromiseSnapshot({
      mode,
      channel: input.recommendedAction.action as FrontOfficeSendChannel,
      appointmentTitle: null,
    });
  }

  return buildFrontOfficeListingSharePromiseSnapshot({
    mode,
    channel: input.recommendedAction.action as FrontOfficeSendChannel,
    appointmentTitle: null,
  });
}

function buildListingSendRiskWatch(
  listing: FrontOfficeListingsSnapshot["listings"][number],
): ListingSendRiskWatch {
  const meta = [
    `${listing.trackedLinkCount} tracked link(s)`,
    `${listing.trackedClickCount} tracked click(s)`,
  ];

  if (listing.trackedLinkCount <= 0) {
    return {
      badgeLabel: "No send risk",
      badgeTone: "neutral",
      context: "Fresh activity",
      description:
        "This listing has not been shared as a tracked send yet, so there is no follow-up pressure to rescue.",
      meta: meta.concat(
        "Watchpoint · Start the first tracked send from a client or appointment when this listing becomes live.",
      ),
    };
  }

  if (listing.trackedClickCount <= 0) {
    return {
      badgeLabel: "Unopened risk",
      badgeTone: "danger",
      context: listing.latestTrackedShare
        ? `${listing.latestTrackedShare.channelLabel} · ${listing.latestTrackedShare.modeLabel}`
        : "Tracked send waiting",
      description:
        "The latest tracked send is still waiting on its first click pulse, so this share needs a tighter reason-to-care before it fades into quiet follow-up.",
      meta: meta.concat(
        `Watchpoint · ${
          listing.latestTrackedShare?.nextStepLabel ??
          "Reopen the same share with a stronger framing before starting a new one."
        }`,
      ),
    };
  }

  if (listing.trackedClickCount < listing.trackedLinkCount) {
    return {
      badgeLabel: "Quiet-after-open",
      badgeTone: "warning",
      context: listing.latestTrackedShare
        ? `${listing.latestTrackedShare.channelLabel} · warm but uneven`
        : "Mixed activity",
      description:
        "This listing has already pulled at least one click, but part of the activity is still cooling off, so the next touch should stay inside the same conversation instead of restarting cold.",
      meta: meta.concat(
        `Watchpoint · ${
          listing.latestTrackedShare?.nextStepLabel ??
          "Use the warm share as the anchor and rescue the quieter branch from the same conversation."
        }`,
      ),
    };
  }

  return {
    badgeLabel: "Managed risk",
    badgeTone: "success",
    context: listing.latestTrackedShare
      ? `${listing.latestTrackedShare.channelLabel} · warm activity`
      : "Warm activity",
    description:
      "Every tracked send on this listing has already produced a click pulse, so follow-up risk is already being managed inside active engagement.",
    meta: meta.concat(
      `Watchpoint · ${
        listing.latestTrackedShare?.nextStepLabel ??
        "Keep the next touch attached to the same warm share."
      }`,
    ),
  };
}

export function FrontOfficeListingsOutputClient(
  props: FrontOfficeListingsOutputClientProps,
) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();
  const hasStableWorkspaceLink =
    props.routeState.hasDraftAssist || props.routeState.diagnostics.length > 0;
  const agentPackageHref = `${props.routeState.stableHref}#agent-send-package`;
  const shouldShowResetLink =
    props.routeState.hasDraftAssist ||
    props.routeState.diagnostics.length > 0 ||
    props.routeState.contextHref !== props.routeState.cleanHref;

  const isBusy = Boolean(pendingAction) || isPending;

  function usesDraftAssistForAction(action: "sms" | "email" | "direct") {
    return (
      action !== "direct" &&
      props.draftAssist?.channel === action &&
      Boolean(props.draftAssist.body.trim())
    );
  }

  async function runShareAction(
    listing: FrontOfficeListingsSnapshot["listings"][number],
    action: "sms" | "email" | "direct",
  ) {
    setFeedback(null);
    setPendingAction({
      listingId: listing.id,
      action,
    });

    try {
      const response = await fetch(
        `/api/agent/listings/${listing.id}/share-links`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: action,
            clientId: props.snapshot.targetClient?.id ?? null,
            appointmentId: props.snapshot.targetAppointment?.id ?? null,
            aiAcceptedAction:
              action !== "direct" &&
              props.draftAssist?.channel === action &&
              props.draftAssist.suggestionKind &&
              props.draftAssist.suggestionLabel
                ? {
                    sourceSurface: "listing_output",
                    suggestionKind: props.draftAssist.suggestionKind,
                    suggestionLabel: props.draftAssist.suggestionLabel,
                    actionTitle: props.draftAssist.title,
                  }
                : null,
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as ShareActionResultPayload;

      if (!response.ok || !payload?.shareLink?.sharePath) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Could not create the tracked share link.",
        });
        setPendingAction(null);
        return;
      }

      const shareUrl = buildAbsoluteUrl(payload.shareLink.sharePath);
      const usesDraftAssist = usesDraftAssistForAction(action);
      const copiedValue =
        usesDraftAssist && action === "sms"
          ? buildAssistedSmsTemplate({
              body: props.draftAssist?.body || "",
              shareUrl,
            })
          : usesDraftAssist && action === "email"
            ? buildAssistedEmailTemplate({
                subjectLine: props.draftAssist?.subjectLine || "",
                body: props.draftAssist?.body || "",
                title: listing.title,
                shareUrl,
              })
            : action === "sms"
              ? buildSmsTemplate({
                  title: listing.title,
                  areaLabel: listing.areaLabel,
                  priceLabel: listing.priceLabel,
                  shareUrl,
                  clientName: props.snapshot.targetClient?.fullName,
                })
              : action === "email"
                ? buildEmailTemplate({
                    title: listing.title,
                    areaLabel: listing.areaLabel,
                    priceLabel: listing.priceLabel,
                    summaryLabel: listing.summaryLabel,
                    shareUrl,
                    clientName: props.snapshot.targetClient?.fullName,
                  })
                : shareUrl;

      await copyTextToClipboard(copiedValue);
      setFeedback(
        buildShareFeedback({
          listingTitle: listing.title,
          action,
          usedDraftAssist: usesDraftAssist,
          routeState: props.routeState,
          payload,
        }),
      );
      setPendingAction(null);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "Could not create or copy the tracked share content in this browser.",
      });
      setPendingAction(null);
    }
  }

  function renderActionLabel(
    listingId: string,
    action: "sms" | "email" | "direct",
  ) {
    if (
      pendingAction?.listingId === listingId &&
      pendingAction.action === action
    ) {
      return "Working...";
    }

    return buildActionButtonLabel({
      action,
      usesDraftAssist: usesDraftAssistForAction(action),
    });
  }

  function getRecommendedShareAction(
    listing: FrontOfficeListingsSnapshot["listings"][number],
  ) {
    return buildListingRecommendedShareAction({
      snapshot: props.snapshot,
      listing,
      draftAssist: props.draftAssist ?? null,
      routeState: props.routeState,
    });
  }

  return (
    <div className="office-list-page-stack">
      {feedback ? (
        <div
          className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
        >
          <strong>{feedback.message}</strong>
          {feedback.detail ? <span>{feedback.detail}</span> : null}
        </div>
      ) : null}

      <div className="front-office-placeholder-note front-office-playbook-surface">
        <div className="front-office-playbook-header">
          <strong>{buildWorkspaceHeading(props)}</strong>
          <p>{props.routeState.focusedRouteLaneDescription}</p>
        </div>

        <div className="list-row-meta front-office-record-meta">
          <span>Context · {props.routeState.routeStatusLabel}</span>
          <span>Focus · {props.routeState.focusedRouteLaneLabel}</span>
          <span>Mode · {props.routeState.modeLabel}</span>
          <span>Support · {props.routeState.preferredSupportLaneLabel}</span>
          <span>Send · Manual only</span>
          {props.snapshot.targetClient ? (
            <span>Stage · {props.snapshot.targetClient.stage}</span>
          ) : null}
          {props.snapshot.targetClient ? (
            <span>{props.snapshot.targetClient.nextTouchLabel}</span>
          ) : null}
          {props.snapshot.targetAppointment ? (
            <span>
              {props.snapshot.targetAppointment.title} ·{" "}
              {props.snapshot.targetAppointment.startsAtLabel}
            </span>
          ) : null}
          <span>{props.routeState.draftStatusLabel}</span>
        </div>

        <p className="front-office-record-supporting">
          {props.routeState.routeStatusDescription}
        </p>
        <p className="front-office-record-supporting">
          {props.routeState.draftStatusDescription}
        </p>

        <div className="front-office-playbook-actions">
          {hasStableWorkspaceLink ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.routeState.stableHref}
            >
              {props.routeState.focusedRouteLaneActionLabel}
            </FrontOfficeLink>
          ) : null}
          <FrontOfficeLink
            className="office-inline-link"
            href={agentPackageHref}
          >
            Open send kit
          </FrontOfficeLink>
          {props.snapshot.targetClient ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.snapshot.targetClient.href}
            >
              Back to client page
            </FrontOfficeLink>
          ) : null}
          {props.snapshot.targetAppointment ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.snapshot.targetAppointment.href}
            >
              Open appointment
            </FrontOfficeLink>
          ) : null}
          {props.routeState.hasDraftAssist ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.routeState.contextHref}
            >
              Keep this view, clear draft
            </FrontOfficeLink>
          ) : null}
          {shouldShowResetLink ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.routeState.cleanHref}
            >
              Reset view
            </FrontOfficeLink>
          ) : null}
        </div>
      </div>

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>{props.routeState.focusedRouteLanePanelLabel}</strong>
          <span>{props.routeState.focusedRouteLanePanelDescription}</span>
        </div>
        <div className="office-queue-list">
          {props.routeState.focusedRouteLaneSteps.map((step, index) => (
            <QueueItem
              badgeLabel={`Step ${index + 1}`}
              badgeTone={step.tone}
              description={step.detail}
              key={step.label}
              title={step.label}
            />
          ))}
          <QueueItem
            action={
              hasStableWorkspaceLink ? (
                <FrontOfficeLink
                  className="office-inline-link"
                  href={props.routeState.stableHref}
                >
                  {props.routeState.focusedRouteLaneActionLabel}
                </FrontOfficeLink>
              ) : null
            }
            badgeLabel={props.routeState.stableReentryLabel}
            badgeTone="accent"
            context={props.routeState.routeStatusLabel}
            description={props.routeState.stableReentryDescription}
            title="Saved view"
          />
        </div>
      </div>

      {props.routeState.diagnostics.length ? (
        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Saved link review</strong>
            <span>{props.routeState.routeStatusDescription}</span>
          </div>
          <div className="office-queue-list">
            {props.routeState.diagnostics.map((diagnostic) => (
              <QueueItem
                badgeLabel={diagnostic.badgeLabel}
                badgeTone={diagnostic.badgeTone}
                description={diagnostic.description}
                key={diagnostic.id}
                title={diagnostic.title}
              />
            ))}
          </div>
        </div>
      ) : null}

      {props.draftAssist ? (
        <div
          className="front-office-placeholder-note front-office-playbook-surface"
          id="front-office-draft-assist"
        >
          <div className="front-office-playbook-header">
            <strong>{props.draftAssist.title}</strong>
            <p>
              {props.draftAssist.sourceLabel ||
                "A saved draft is loaded here. Copying the matching option will use that draft and still append a private tracked listing link."}
            </p>
          </div>
          <div className="list-row-meta front-office-record-meta">
            <span>
              Channel · {props.draftAssist.channel === "sms" ? "SMS" : "Email"}
            </span>
            {props.draftAssist.subjectLine.trim() ? (
              <span>Subject · {props.draftAssist.subjectLine.trim()}</span>
            ) : null}
            <span>{props.routeState.modeLabel}</span>
            <span>Manual send only</span>
          </div>
          <p className="front-office-record-supporting">
            {buildDraftLaneNote(props.draftAssist)}
          </p>
          <pre className="front-office-playbook-template-body">
            {props.draftAssist.body}
          </pre>
          <div className="front-office-playbook-actions">
            <FrontOfficeLink
              className="office-inline-link"
              href={props.routeState.contextHref}
            >
              Keep this view, clear draft
            </FrontOfficeLink>
            <FrontOfficeLink
              className="office-inline-link"
              href={agentPackageHref}
            >
              Open agent materials
            </FrontOfficeLink>
          </div>
        </div>
      ) : null}

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>Share activity</strong>
          <span>{props.usagePulse.pulseDescription}</span>
        </div>
        <div className="list-row-meta front-office-record-meta">
          <span>{props.usagePulse.trackedLinkCount} tracked link(s)</span>
          <span>{props.usagePulse.trackedClickCount} tracked click(s)</span>
          <span>{props.usagePulse.engagedListingCount} engaged listing(s)</span>
          <span>
            {props.usagePulse.quietTrackedListingCount} quiet share(s)
          </span>
          <span>{props.usagePulse.clickThroughRateLabel}</span>
          <span>{props.usagePulse.sendTrailLabel}</span>
          <span>{props.usagePulse.quietTrailLabel}</span>
          <span>{props.usagePulse.sendRiskLabel}</span>
          <span>{props.usagePulse.nextMoveLabel}</span>
        </div>
        <div className="office-queue-list">
          <QueueItem
            action={
              <>
                {props.usagePulse.latestTrackedShare?.clientHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.usagePulse.latestTrackedShare.clientHref}
                  >
                    Open client page
                  </FrontOfficeLink>
                ) : null}
                {props.usagePulse.latestTrackedShare?.appointmentHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.usagePulse.latestTrackedShare.appointmentHref}
                  >
                    Open appointment
                  </FrontOfficeLink>
                ) : null}
                {props.usagePulse.strongestTrail?.clientHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.usagePulse.strongestTrail.clientHref}
                  >
                    Open best client page
                  </FrontOfficeLink>
                ) : null}
                {props.usagePulse.strongestTrail?.appointmentHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.usagePulse.strongestTrail.appointmentHref}
                  >
                    Open best appointment
                  </FrontOfficeLink>
                ) : null}
              </>
            }
            badgeLabel={props.usagePulse.nextMoveLabel}
            badgeTone={
              props.usagePulse.quietTrackedListingCount > 0
                ? "warning"
                : "accent"
            }
            context="Re-engagement"
            description={props.usagePulse.nextMoveDescription}
            meta={
              <>
                <span>{props.usagePulse.sendTrailLabel}</span>
                <span>{props.usagePulse.quietTrailLabel}</span>
                <span>
                  Next step ·{" "}
                  {props.usagePulse.latestTrackedShare?.followThroughCue ??
                    props.usagePulse.nextMoveDescription}
                </span>
              </>
            }
            title="Needs re-engagement"
          />
          <QueueItem
            badgeLabel={props.usagePulse.sendRiskLabel}
            badgeTone={
              props.usagePulse.trackedLinkCount <= 0
                ? "neutral"
                : props.usagePulse.trackedClickCount <= 0
                  ? "danger"
                  : props.usagePulse.quietTrackedListingCount > 0
                    ? "warning"
                    : "success"
            }
            context="Follow-up risk"
            description={props.usagePulse.sendRiskDescription}
            meta={
              <>
                <span>{props.usagePulse.sendTrailDescription}</span>
                <span>{props.usagePulse.quietTrailDescription}</span>
              </>
            }
            title="Follow-up risk"
          />
          {props.usagePulse.strongestTrail ? (
            <QueueItem
              action={
                <>
                  {props.usagePulse.strongestTrail.clientHref ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={props.usagePulse.strongestTrail.clientHref}
                    >
                      Open client page
                    </FrontOfficeLink>
                  ) : null}
                  {props.usagePulse.strongestTrail.appointmentHref ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={props.usagePulse.strongestTrail.appointmentHref}
                    >
                      Open appointment
                    </FrontOfficeLink>
                  ) : null}
                </>
              }
              badgeLabel={props.usagePulse.strongestTrail.badgeLabel}
              badgeTone={props.usagePulse.strongestTrail.badgeTone}
              context={props.usagePulse.strongestTrail.context}
              description={props.usagePulse.strongestTrail.description}
              meta={
                <>
                  <span>
                    Next step ·{" "}
                    {props.usagePulse.strongestTrail.followThroughCue}
                  </span>
                  {props.usagePulse.strongestTrail.meta.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </>
              }
              title="Best signal"
            />
          ) : null}
          {props.usagePulse.latestTrackedShare ? (
            <QueueItem
              action={
                <>
                  {props.usagePulse.latestTrackedShare.clientHref ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={props.usagePulse.latestTrackedShare.clientHref}
                    >
                      Open client page
                    </FrontOfficeLink>
                  ) : null}
                  {props.usagePulse.latestTrackedShare.appointmentHref ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={props.usagePulse.latestTrackedShare.appointmentHref}
                    >
                      Open appointment
                    </FrontOfficeLink>
                  ) : null}
                </>
              }
              badgeLabel={props.usagePulse.latestTrackedShare.badgeLabel}
              badgeTone={props.usagePulse.latestTrackedShare.badgeTone}
              context={props.usagePulse.latestTrackedShare.context}
              description={props.usagePulse.latestTrackedShare.description}
              meta={
                <>
                  <span>
                    Next step ·{" "}
                    {props.usagePulse.latestTrackedShare.followThroughCue}
                  </span>
                  {props.usagePulse.latestTrackedShare.meta.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </>
              }
              title="Most recent share"
            />
          ) : null}
        </div>
        <div
          className="front-office-playbook-card-head"
          style={{ marginTop: "0.4rem" }}
        >
          <strong>Recent share history</strong>
          <span>
            Newest first. Each card carries the latest share plus the next-step
            cue that tells you how to continue the conversation.
          </span>
        </div>
        <div className="office-queue-list">
          {props.usagePulse.recentTrackedShares.length ? (
            props.usagePulse.recentTrackedShares.map((share) => (
              <QueueItem
                action={
                  <>
                    {share.clientHref ? (
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={share.clientHref}
                      >
                        Open client page
                      </FrontOfficeLink>
                    ) : null}
                    {share.appointmentHref ? (
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={share.appointmentHref}
                      >
                        Open appointment
                      </FrontOfficeLink>
                    ) : null}
                  </>
                }
                badgeLabel={share.badgeLabel}
                badgeTone={share.badgeTone}
                context={share.context}
                description={share.description}
                key={`${share.title}-${share.context}`}
                meta={
                  <>
                    <span>Next step · {share.followThroughCue}</span>
                    {share.meta.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </>
                }
                title={share.title}
              />
            ))
          ) : (
            <QueueItem
              badgeLabel="No recent shares"
              badgeTone="neutral"
              description="Recent tracked shares will appear here once this page has enough activity to build a small timeline with next-step cues."
              title="Recent share history"
            />
          )}
        </div>
      </div>

      <div className="front-office-playbook-grid front-office-listings-overview-grid">
        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Current share setup</strong>
            <span>
              Keep the recipient, saved view, and preferred support copy visible
              before you copy any option.
            </span>
          </div>
          <div className="office-queue-list">
            <QueueItem
              badgeLabel={
                props.snapshot.targetClient
                  ? props.snapshot.targetClient.stage
                  : "Generic"
              }
              badgeTone={
                props.snapshot.targetClient
                  ? mapBadgeTone(props.snapshot.targetClient.stageTone)
                  : "warning"
              }
              description={
                props.snapshot.targetClient
                  ? `${props.snapshot.targetClient.nextTouchLabel}. This tracked share will stay attached to the client page.`
                  : "Open listing output from a client or appointment to turn a generic tracked link into a client-linked record."
              }
              title={
                props.snapshot.targetClient
                  ? props.snapshot.targetClient.fullName
                  : "No client selected yet"
              }
            />
            {props.snapshot.targetAppointment ? (
              <QueueItem
                badgeLabel={props.snapshot.targetAppointment.statusLabel}
                badgeTone={mapBadgeTone(
                  props.snapshot.targetAppointment.statusTone,
                )}
                context={props.snapshot.targetAppointment.typeLabel}
                description={`${props.snapshot.targetAppointment.startsAtLabel} · ${props.snapshot.targetAppointment.locationLabel}`}
                title={props.snapshot.targetAppointment.title}
              />
            ) : (
              <QueueItem
                badgeLabel="No appointment"
                badgeTone="neutral"
                description="Without appointment context, this follow-up stays on the client only."
                title="No appointment attached yet"
              />
            )}
            <QueueItem
              action={
                <FrontOfficeLink
                  className="office-inline-link"
                  href={agentPackageHref}
                >
                  Open agent materials
                </FrontOfficeLink>
              }
              badgeLabel={props.routeState.preferredSupportLaneLabel}
              badgeTone={
                props.routeState.preferredSupportLane === "mixed"
                  ? "warning"
                  : "accent"
              }
              description={props.routeState.preferredSupportLaneDescription}
              title="Preferred support copy"
            />
            <QueueItem
              badgeLabel={props.routeState.routeStatusLabel}
              badgeTone={
                props.routeState.diagnostics.length ? "warning" : "accent"
              }
              context={props.routeState.draftStatusLabel}
              description={props.routeState.routeStatusDescription}
              title="View cleanup"
            />
          </div>
        </div>

        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Share options</strong>
            <span>
              SMS, Email, and Direct are intentionally different choices. The
              recommended first step depends on context, traction, and any
              active draft.
            </span>
          </div>
          <div className="office-queue-list">
            <QueueItem
              badgeLabel="Fast"
              badgeTone="accent"
              context={
                props.draftAssist?.channel === "sms"
                  ? "Draft loaded"
                  : props.routeState.preferredSupportLane === "sms"
                    ? "Preferred support"
                    : "Standard copy"
              }
              description={buildChannelCue(props.snapshot, "sms")}
              title="SMS + tracked link"
            />
            <QueueItem
              badgeLabel="Context"
              badgeTone="success"
              context={
                props.draftAssist?.channel === "email"
                  ? "Draft loaded"
                  : props.routeState.preferredSupportLane === "email"
                    ? "Preferred support"
                    : "Standard copy"
              }
              description={buildChannelCue(props.snapshot, "email")}
              title="Email + tracked link"
            />
            <QueueItem
              badgeLabel="Manual"
              badgeTone="warning"
              context="Always link-only"
              description={buildChannelCue(props.snapshot, "direct")}
              title="Private link only"
            />
          </div>
        </div>

        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Follow-up cues</strong>
            <span>
              Every copied share should have a follow-up consequence instead of
              disappearing into clipboard history.
            </span>
          </div>
          <div className="office-queue-list">
            <QueueItem
              badgeLabel="3-day"
              badgeTone="danger"
              description="If a client-linked share stays unopened for 3 days, reopen it from the client page with a tighter reason-to-care."
              title="Reopen unopened shares"
            />
            <QueueItem
              badgeLabel="7-day"
              badgeTone="warning"
              description="If the client opens and then goes quiet for a week, send the next option from the same conversation instead of starting over."
              title="Watch quiet-after-open risk"
            />
            <QueueItem
              badgeLabel={props.snapshot.targetAppointment ? "Appt" : "Package"}
              badgeTone={
                props.snapshot.targetAppointment ? "accent" : "success"
              }
              description={
                props.snapshot.targetAppointment
                  ? "Use the appointment record for confirmation, reschedule notes, and outcome updates after the listing lands."
                  : buildListingMaterialCue(props.snapshot)
              }
              title={
                props.snapshot.targetAppointment
                  ? "Keep appointment follow-up in one loop"
                  : "Pair the listing with agent materials"
              }
            />
          </div>
        </div>
      </div>

      <div className="list-column front-office-record-list">
        {props.snapshot.listings.length ? (
          props.snapshot.listings.map((listing) => {
            const recommendedAction = getRecommendedShareAction(listing);
            const lanePlans: ShareLanePlan[] = [
              buildShareLanePlan({
                snapshot: props.snapshot,
                routeState: props.routeState,
                listing,
                draftAssist: props.draftAssist ?? null,
                action: "sms",
                recommendedAction,
              }),
              buildShareLanePlan({
                snapshot: props.snapshot,
                routeState: props.routeState,
                listing,
                draftAssist: props.draftAssist ?? null,
                action: "email",
                recommendedAction,
              }),
              buildShareLanePlan({
                snapshot: props.snapshot,
                routeState: props.routeState,
                listing,
                draftAssist: props.draftAssist ?? null,
                action: "direct",
                recommendedAction,
              }),
            ];
            const clientFacingContract = buildClientFacingShareContract({
              snapshot: props.snapshot,
              recommendedAction,
            });
            const sendRiskWatch = buildListingSendRiskWatch(listing);

            return (
              <article
                className="list-row front-office-record"
                key={listing.id}
              >
                <div className="list-row-top front-office-record-head">
                  <div>
                    <strong>{listing.title}</strong>
                    <p>{listing.areaLabel}</p>
                  </div>
                  <Badge tone={mapBadgeTone(listing.statusTone)}>
                    {listing.statusLabel}
                  </Badge>
                </div>
                <p>{listing.summaryLabel}</p>
                <div className="list-row-meta front-office-record-meta">
                  <span>{listing.priceLabel}</span>
                  <span>{listing.cityLabel}</span>
                  <span>Mode · {props.routeState.modeLabel}</span>
                  <span>{listing.trackedClickCount} tracked click(s)</span>
                  <span>{listing.trackedLinkCount} tracked link(s)</span>
                </div>

                <div className="office-queue-list">
                  <QueueItem
                    badgeLabel={props.routeState.modeLabel}
                    badgeTone={
                      props.routeState.mode === "tracked-link"
                        ? "warning"
                        : "accent"
                    }
                    description={buildListingExecutionCue(
                      props.snapshot,
                      listing,
                    )}
                    meta={
                      <span>
                        Recommended first step: {recommendedAction.label}.{" "}
                        {recommendedAction.reason}
                      </span>
                    }
                    title="Best next use"
                  />
                  <QueueItem
                    badgeLabel={buildTrackedContextBadgeLabel(listing)}
                    badgeTone={buildTrackedContextBadgeTone(listing)}
                    description={buildListingTractionCue(listing)}
                    meta={
                      <span>
                        {listing.trackedLinkCount} tracked link(s) ·{" "}
                        {listing.trackedClickCount} tracked click(s)
                      </span>
                    }
                    title="Usage pulse"
                  />
                  <QueueItem
                    badgeLabel={sendRiskWatch.badgeLabel}
                    badgeTone={sendRiskWatch.badgeTone}
                    context={sendRiskWatch.context}
                    description={sendRiskWatch.description}
                    meta={
                      <>
                        {sendRiskWatch.meta.map((item, index) => (
                          <span key={`send-risk-${listing.id}-${index}`}>
                            {item}
                          </span>
                        ))}
                      </>
                    }
                    title="Follow-up risk"
                  />
                  <QueueItem
                    badgeLabel={clientFacingContract.badgeLabel}
                    badgeTone={clientFacingContract.badgeTone}
                    context={clientFacingContract.context}
                    description={clientFacingContract.description}
                    meta={
                      <>
                        {clientFacingContract.meta.map((item, index) => (
                          <span key={`client-facing-${listing.id}-${index}`}>
                            {item}
                          </span>
                        ))}
                      </>
                    }
                    title={clientFacingContract.title}
                  />
                  {listing.latestTrackedShare ? (
                    <QueueItem
                      action={
                        <>
                          {listing.latestTrackedShare.clientHref ? (
                            <FrontOfficeLink
                              className="office-inline-link"
                              href={listing.latestTrackedShare.clientHref}
                            >
                              Open client page
                            </FrontOfficeLink>
                          ) : null}
                          {listing.latestTrackedShare.appointmentHref ? (
                            <FrontOfficeLink
                              className="office-inline-link"
                              href={listing.latestTrackedShare.appointmentHref}
                            >
                              Open appointment
                            </FrontOfficeLink>
                          ) : null}
                          {hasStableWorkspaceLink ? (
                            <FrontOfficeLink
                              className="office-inline-link"
                              href={props.routeState.stableHref}
                            >
                              {props.routeState.focusedRouteLaneActionLabel}
                            </FrontOfficeLink>
                          ) : null}
                        </>
                      }
                      badgeLabel={listing.latestTrackedShare.channelLabel}
                      badgeTone={mapBadgeTone(
                        listing.latestTrackedShare.statusTone,
                      )}
                      context={`${listing.latestTrackedShare.modeLabel} · ${listing.latestTrackedShare.sentAtLabel}`}
                      description={`${listing.latestTrackedShare.trackingLabel} ${listing.latestTrackedShare.writebackLabel}`}
                      meta={
                        <>
                          <span>
                            {listing.latestTrackedShare.writebackScopeLabel}
                          </span>
                          <span>
                            Next step ·{" "}
                            {listing.latestTrackedShare.nextStepLabel}
                          </span>
                          {listing.latestTrackedShare.clientLabel ? (
                            <span>
                              Client · {listing.latestTrackedShare.clientLabel}
                              {listing.latestTrackedShare
                                .clientStageDisplayLabel
                                ? ` · ${listing.latestTrackedShare.clientStageDisplayLabel}`
                                : ""}
                            </span>
                          ) : null}
                          {listing.latestTrackedShare.appointmentLabel ? (
                            <span>
                              Appointment ·{" "}
                              {listing.latestTrackedShare.appointmentLabel}
                              {listing.latestTrackedShare.appointmentWindowLabel
                                ? ` · ${listing.latestTrackedShare.appointmentWindowLabel}`
                                : ""}
                            </span>
                          ) : null}
                        </>
                      }
                      title="Latest tracked share"
                    />
                  ) : null}
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={agentPackageHref}
                      >
                        Open agent materials
                      </FrontOfficeLink>
                    }
                    badgeLabel={props.routeState.preferredSupportLaneLabel}
                    badgeTone={
                      props.routeState.preferredSupportLane === "mixed"
                        ? "warning"
                        : "success"
                    }
                    description={buildListingMaterialCue(props.snapshot)}
                    meta={
                      <span>
                        {props.routeState.preferredSupportLaneDescription}
                      </span>
                    }
                    title="Material pairing"
                  />
                </div>

                <div className="office-queue-list">
                  {lanePlans.map((plan) => (
                    <QueueItem
                      action={
                        <Button
                          disabled={isBusy}
                          onClick={() =>
                            void runShareAction(listing, plan.action)
                          }
                          size="sm"
                          type="button"
                          variant={plan.isRecommended ? "secondary" : "ghost"}
                        >
                          {renderActionLabel(listing.id, plan.action)}
                        </Button>
                      }
                      badgeLabel={plan.badgeLabel}
                      badgeTone={plan.badgeTone}
                      context={plan.context}
                      description={plan.description}
                      key={plan.action}
                      meta={
                        <>
                          {plan.meta.map((item, index) => (
                            <span key={`${plan.action}-${index}`}>{item}</span>
                          ))}
                        </>
                      }
                      title={plan.title}
                    />
                  ))}
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState
            action={
              <div className="front-office-playbook-actions">
                {props.snapshot.targetClient ? (
                  <FrontOfficeLink
                    className="office-button-secondary"
                    href={props.snapshot.targetClient.href}
                  >
                    Back to client page
                  </FrontOfficeLink>
                ) : (
                  <FrontOfficeLink
                    className="office-button-secondary"
                    href="/agent/dashboard"
                  >
                    Back to dashboard
                  </FrontOfficeLink>
                )}
                {props.snapshot.targetAppointment ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.snapshot.targetAppointment.href}
                  >
                    Open appointment
                  </FrontOfficeLink>
                ) : null}
                <FrontOfficeLink
                  className="office-inline-link"
                  href={agentPackageHref}
                >
                  Open agent materials
                </FrontOfficeLink>
                {props.routeState.hasDraftAssist ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.contextHref}
                  >
                    Keep this view, clear draft
                  </FrontOfficeLink>
                ) : null}
                {shouldShowResetLink ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.cleanHref}
                  >
                    Reset view
                  </FrontOfficeLink>
                ) : null}
              </div>
            }
            {...buildListingEmptyState(props)}
          />
        )}
      </div>

      <div className="front-office-placeholder-note">
        <strong>How tracked sharing works</strong>
        <p>
          Each copy action creates a private tracked link, refreshes the share
          counts on this page, and keeps sending fully manual. In client-linked
          mode, the same action also saves a Front Office share record so
          follow-up cues and appointment continuity can show up again on the
          client page and dashboard.
        </p>
        <div className="front-office-playbook-actions">
          <FrontOfficeLink
            className="office-inline-link"
            href="/agent/dashboard"
          >
            Back to dashboard
          </FrontOfficeLink>
        </div>
      </div>
    </div>
  );
}
