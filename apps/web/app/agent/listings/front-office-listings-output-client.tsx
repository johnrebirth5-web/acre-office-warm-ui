"use client";

import { useState, useTransition, type ComponentProps } from "react";
import type { FrontOfficeListingsSnapshot, FrontOfficeTone } from "@acre/db";
import type { FrontOfficeSendChannel } from "@prisma/client";
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
          <span>{props.routeState.draftStatusLabel}</span>
          {props.snapshot.targetClient ? (
            <span>Client · {props.snapshot.targetClient.fullName}</span>
          ) : null}
          {props.snapshot.targetAppointment ? (
            <span>Appointment · {props.snapshot.targetAppointment.title}</span>
          ) : null}
        </div>
        <div className="front-office-playbook-actions">
          {hasStableWorkspaceLink ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.routeState.stableHref}
            >
              {props.routeState.focusedRouteLaneActionLabel}
            </FrontOfficeLink>
          ) : null}
          <FrontOfficeLink className="office-inline-link" href={agentPackageHref}>
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

      {props.draftAssist ? (
        <div
          className="front-office-placeholder-note front-office-playbook-surface"
          id="front-office-draft-assist"
        >
          <div className="front-office-playbook-header">
            <strong>{props.draftAssist.title}</strong>
            <p>{props.draftAssist.sourceLabel || "Draft loaded for this view."}</p>
          </div>
          <div className="list-row-meta front-office-record-meta">
            <span>
              Channel · {props.draftAssist.channel === "sms" ? "SMS" : "Email"}
            </span>
            {props.draftAssist.subjectLine.trim() ? (
              <span>Subject · {props.draftAssist.subjectLine.trim()}</span>
            ) : null}
          </div>
          <pre className="front-office-playbook-template-body">
            {props.draftAssist.body}
          </pre>
        </div>
      ) : null}

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>Share activity</strong>
          <span>{props.usagePulse.nextMoveDescription}</span>
        </div>
        <div className="list-row-meta front-office-record-meta">
          <span>{props.usagePulse.trackedLinkCount} tracked link(s)</span>
          <span>{props.usagePulse.trackedClickCount} tracked click(s)</span>
          <span>{props.usagePulse.engagedListingCount} engaged listing(s)</span>
          <span>{props.usagePulse.quietTrailLabel}</span>
        </div>
        <div className="office-queue-list">
          <QueueItem
            badgeLabel={props.usagePulse.nextMoveLabel}
            badgeTone={
              props.usagePulse.quietTrackedListingCount > 0 ? "warning" : "accent"
            }
            context="Next move"
            description={props.usagePulse.nextMoveDescription}
            title="Share pulse"
          />
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
                <span>
                  Next step · {props.usagePulse.latestTrackedShare.followThroughCue}
                </span>
              }
              title="Latest tracked share"
            />
          ) : null}
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

            return (
              <article className="list-row front-office-record" key={listing.id}>
                <div className="list-row-top front-office-record-head">
                  <div>
                    <strong>{listing.title}</strong>
                    <p>{listing.areaLabel}</p>
                  </div>
                  <Badge tone={mapBadgeTone(listing.statusTone)}>
                    {listing.statusLabel}
                  </Badge>
                </div>
                <div className="list-row-meta front-office-record-meta">
                  <span>{listing.priceLabel}</span>
                  <span>{listing.cityLabel}</span>
                  <span>{buildListingTractionCue(listing)}</span>
                </div>

                <div className="office-queue-list">
                  <QueueItem
                    badgeLabel={props.routeState.modeLabel}
                    badgeTone={
                      props.routeState.mode === "tracked-link" ? "warning" : "accent"
                    }
                    description={buildListingExecutionCue(props.snapshot, listing)}
                    meta={
                      <span>Recommended first step · {recommendedAction.label}</span>
                    }
                    title="Best next use"
                  />
                  <QueueItem
                    action={
                      <FrontOfficeLink className="office-inline-link" href={agentPackageHref}>
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
                    title="Material pairing"
                  />
                </div>

                <div className="office-queue-list">
                  {lanePlans.map((plan) => (
                    <QueueItem
                      action={
                        <Button
                          disabled={isBusy}
                          onClick={() => void runShareAction(listing, plan.action)}
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
                <FrontOfficeLink className="office-inline-link" href={agentPackageHref}>
                  Open agent materials
                </FrontOfficeLink>
              </div>
            }
            {...buildListingEmptyState(props)}
          />
        )}
      </div>
    </div>
  );
}
