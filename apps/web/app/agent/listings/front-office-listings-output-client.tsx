"use client";

import { useState, useTransition, type ComponentProps } from "react";
import type { FrontOfficeListingsSnapshot, FrontOfficeTone } from "@acre/db";
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
    return `Best used as a ${snapshot.targetAppointment.typeLabel.toLowerCase()} follow-up for ${snapshot.targetClient.fullName}, so the listing, client stage, and appointment pressure stay in one trail.`;
  }

  if (snapshot.targetClient) {
    return `Best used as a client-linked recommendation for ${snapshot.targetClient.fullName} while the ${snapshot.targetClient.stage.toLowerCase()} stage is still active.`;
  }

  if (listing.trackedClickCount > 0) {
    return "This listing already has tracked engagement in your feed, so it is a good candidate for another manual touch without losing attribution.";
  }

  return "Use this when you need a tracked recommendation now, then reopen it from a dossier later if the send should become part of one client's execution trail.";
}

function buildListingTractionCue(
  listing: FrontOfficeListingsSnapshot["listings"][number],
) {
  if (listing.trackedLinkCount <= 0) {
    return "No tracked send has gone out from this surface yet. Use email when the client needs more framing before they click.";
  }

  if (listing.trackedClickCount <= 0) {
    return `${listing.trackedLinkCount} tracked send(s) exist with no open yet. Tighten the reason-to-care or pair the share with stronger agent context before resending.`;
  }

  if (listing.trackedClickCount >= listing.trackedLinkCount) {
    return "Tracked sends are already producing opens here. Good candidate for a shortlist or showing follow-up instead of a cold first touch.";
  }

  return `${listing.trackedClickCount} open(s) across ${listing.trackedLinkCount} tracked send(s). Use SMS when you need a quick reaction instead of another long note.`;
}

function buildListingMaterialCue(snapshot: FrontOfficeListingsSnapshot) {
  if (snapshot.targetAppointment) {
    return "Package cue: pair the listing with the intro text and one recent closing so the client sees both appointment context and agent proof.";
  }

  if (snapshot.agentMaterial.featuredCaseCount > 0) {
    return "Package cue: pair the listing with the business card and one featured case so the send carries identity and proof, not just inventory.";
  }

  if (snapshot.agentMaterial.portraitReady) {
    return "Package cue: pair the listing with the business card so the send still carries agent identity even without case history.";
  }

  return "Package cue: use the intro email or business card so the link does not travel alone.";
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
      : "Best when you need more context than a raw link, even before the send is tied to a dossier.";
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
    return "No assisted draft is loaded, so every send lane below uses the standard manual templates.";
  }

  return `Only the ${draftAssist.channel === "sms" ? "SMS" : "Email"} lane below uses this draft. The other lanes stay on the standard manual templates, and nothing auto-sends.`;
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
      label: "SMS draft lane",
      reason:
        "A matching SMS draft is already loaded in this workspace, so the fastest safe move is to keep the assisted text and tracked link together.",
    };
  }

  if (input.draftAssist?.channel === "email") {
    return {
      action: "email",
      label: "Email draft lane",
      reason:
        "A matching email draft is already loaded in this workspace, so the cleanest move is to keep the assisted framing and tracked link together.",
    };
  }

  if (input.routeState.focusedRouteLane === "draft-lane") {
    return {
      action: "sms",
      label: "Draft lane",
      reason:
        "A draft lane shell is selected here, so keep the lane ready for the matching draft before you copy a send.",
    };
  }

  if (input.routeState.focusedRouteLane === "follow-through") {
    return {
      action: input.snapshot.targetAppointment ? "sms" : "email",
      label: input.snapshot.targetAppointment
        ? "Appointment follow-through lane"
        : "Client follow-through lane",
      reason: input.snapshot.targetAppointment
        ? "This route is already tied to the appointment loop, so a quick reaction keeps the send in the same trail."
        : "This route is already tied to the client dossier, so the next manual send should stay in the same trail instead of restarting as a generic outbound share.",
    };
  }

  if (input.routeState.focusedRouteLane === "send-rescue") {
    return {
      action: input.listing.trackedClickCount > 0 ? "sms" : "email",
      label: "Send rescue lane",
      reason:
        input.listing.trackedClickCount > 0
          ? "This listing already has engagement, so the rescue lane should reopen it with a short reply path."
          : "This listing is quiet, so the rescue lane should reopen it with a tighter reason-to-care and the tracked link still attached.",
    };
  }

  return {
    action: input.snapshot.targetClient ? "email" : "direct",
    label: input.snapshot.targetAppointment
      ? "Appointment reaction lane"
      : input.snapshot.targetClient
        ? "Framed send lane"
        : "Link-only lane",
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
      title: "No send-ready listings in this appointment context",
      description:
        "This appointment-linked route is ready to write back, but there is no listing inventory in scope right now. Keep the context if you are coming back after shortlist updates.",
    };
  }

  if (props.snapshot.targetClient) {
    return {
      title: "No send-ready listings for this client context",
      description:
        "The client-linked send trail is ready, but there is no listing inventory to copy from yet. Reopen this route later and the same dossier context will still be valid.",
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
    return "Fresh";
  }

  if (listing.trackedClickCount <= 0) {
    return `${listing.trackedLinkCount} sent`;
  }

  return `${listing.trackedClickCount} opened`;
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
      ? "Writeback: client trail + appointment loop."
      : input.routeState.mode === "client-linked"
        ? "Writeback: client trail."
        : "Writeback: tracked link only.";
  const focusedLaneMeta =
    input.routeState.focusedRouteLane === "draft-lane"
      ? "Focused lane: draft lane."
      : input.routeState.focusedRouteLane === "follow-through"
        ? "Focused lane: follow-through."
        : "Focused lane: send rescue.";

  if (input.action === "sms") {
    return {
      action: "sms",
      badgeLabel: "SMS",
      badgeTone: "accent",
      title: usesDraftAssist
        ? "SMS draft + tracked link"
        : input.routeState.focusedRouteLane === "follow-through" &&
            input.snapshot.targetAppointment
          ? "Appointment follow-through text"
          : input.routeState.focusedRouteLane === "send-rescue"
            ? "SMS rescue text"
            : "Quick reaction text",
      context: usesDraftAssist
        ? "AI draft lane"
        : isRecommended
          ? input.routeState.focusedRouteLaneLabel
          : "Standard manual lane",
      description: buildChannelCue(input.snapshot, "sms"),
      meta: [
        usesDraftAssist
          ? "Copy result: assisted SMS draft + tracked link."
          : "Copy result: standard SMS template + tracked link.",
        writebackMeta,
        focusedLaneMeta,
        input.routeState.preferredSupportLane === "sms"
          ? "Pair with: SMS companion package."
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
        ? "AI draft lane"
        : isRecommended
          ? input.routeState.focusedRouteLaneLabel
          : "Standard manual lane",
      description: buildChannelCue(input.snapshot, "email"),
      meta: [
        usesDraftAssist
          ? "Copy result: assisted email draft + tracked link."
          : "Copy result: standard email template + tracked link.",
        writebackMeta,
        focusedLaneMeta,
        input.routeState.preferredSupportLane === "email"
          ? "Pair with: email companion package."
          : "Pair with: email support package when the client needs more framing.",
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
      : "Manual-only lane",
    description: buildChannelCue(input.snapshot, "direct"),
    meta: [
      "Copy result: private tracked link only.",
      writebackMeta,
      focusedLaneMeta,
      "Pair with: business card or support package if the conversation thread does not already carry context.",
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
  const channelLabel =
    input.action === "sms"
      ? input.usedDraftAssist
        ? "SMS draft + tracked link"
        : "SMS package + tracked link"
      : input.action === "email"
        ? input.usedDraftAssist
          ? "Email draft + tracked link"
          : "Email package + tracked link"
        : "Private tracked link";
  const detail = [writebackLabel, scopeLabel, nextStepLabel]
    .concat(
      nextCue
        ? [
            `${input.action === "direct" ? "Package cue" : "Next cue"}: ${nextCue}`,
          ]
        : [],
      input.routeState.stableReentryDescription
        ? [`Re-entry: ${input.routeState.stableReentryDescription}`]
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
          <span>Route · {props.routeState.routeStatusLabel}</span>
          <span>Lane · {props.routeState.focusedRouteLaneLabel}</span>
          <span>Mode · {props.routeState.modeLabel}</span>
          <span>Package · {props.routeState.preferredSupportLaneLabel}</span>
          <span>Rule · Manual send only</span>
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
            Open agent send package
          </FrontOfficeLink>
          {props.snapshot.targetClient ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.snapshot.targetClient.href}
            >
              Back to client dossier
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
              Keep context, clear draft
            </FrontOfficeLink>
          ) : null}
          {shouldShowResetLink ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.routeState.cleanHref}
            >
              Reset to clean workspace
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
            title="Lane execution checkpoint"
          />
        </div>
      </div>

      {props.routeState.diagnostics.length ? (
        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Deep-link hygiene</strong>
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
                "A draft assist is loaded into this outbound workspace. Copying the matching lane will use that draft and still append a private tracked listing link."}
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
              Keep context, clear draft
            </FrontOfficeLink>
            <FrontOfficeLink
              className="office-inline-link"
              href={agentPackageHref}
            >
              Open agent send package
            </FrontOfficeLink>
          </div>
        </div>
      ) : null}

      <div className="front-office-playbook-grid front-office-listings-overview-grid">
        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Outbound send plan</strong>
            <span>
              Keep recipient binding, route health, and the preferred companion
              package visible before you copy any lane.
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
                  ? `${props.snapshot.targetClient.nextTouchLabel}. The tracked send will write back into this dossier.`
                  : "Open listing output from a dossier or appointment to turn a generic tracked link into a client-linked send record."
              }
              title={
                props.snapshot.targetClient
                  ? props.snapshot.targetClient.fullName
                  : "No client-linked recipient selected"
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
                description="Without appointment context, send records still track the client trail but not the meeting loop."
                title="Appointment writeback is not in scope yet"
              />
            )}
            <QueueItem
              action={
                <FrontOfficeLink
                  className="office-inline-link"
                  href={agentPackageHref}
                >
                  Open agent send package
                </FrontOfficeLink>
              }
              badgeLabel={props.routeState.preferredSupportLaneLabel}
              badgeTone={
                props.routeState.preferredSupportLane === "mixed"
                  ? "warning"
                  : "accent"
              }
              description={props.routeState.preferredSupportLaneDescription}
              title="Preferred companion package"
            />
            <QueueItem
              badgeLabel={props.routeState.routeStatusLabel}
              badgeTone={
                props.routeState.diagnostics.length ? "warning" : "accent"
              }
              context={props.routeState.draftStatusLabel}
              description={props.routeState.routeStatusDescription}
              title="Route hygiene"
            />
          </div>
        </div>

        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Channel lanes</strong>
            <span>
              SMS, Email, and Direct are intentionally different manual moves.
              The recommended first lane depends on context, traction, and the
              active draft lane.
            </span>
          </div>
          <div className="office-queue-list">
            <QueueItem
              badgeLabel="Fast"
              badgeTone="accent"
              context={
                props.draftAssist?.channel === "sms"
                  ? "Draft lane active"
                  : props.routeState.preferredSupportLane === "sms"
                    ? "Preferred companion"
                    : "Standard lane"
              }
              description={buildChannelCue(props.snapshot, "sms")}
              title="SMS + tracked link"
            />
            <QueueItem
              badgeLabel="Context"
              badgeTone="success"
              context={
                props.draftAssist?.channel === "email"
                  ? "Draft lane active"
                  : props.routeState.preferredSupportLane === "email"
                    ? "Preferred companion"
                    : "Standard lane"
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
            <strong>Tracked rescue cues</strong>
            <span>
              Every copied send should have a follow-up consequence instead of
              disappearing into clipboard history.
            </span>
          </div>
          <div className="office-queue-list">
            <QueueItem
              badgeLabel="3-day"
              badgeTone="danger"
              description="If a client-linked send stays unopened for 3 days, re-enter from the dossier with a tighter reason-to-care."
              title="Rescue unopened sends"
            />
            <QueueItem
              badgeLabel="7-day"
              badgeTone="warning"
              description="If the client opens and then goes quiet for a week, send the next option from the same trail instead of starting over."
              title="Watch quiet-after-open risk"
            />
            <QueueItem
              badgeLabel={props.snapshot.targetAppointment ? "Appt" : "Package"}
              badgeTone={
                props.snapshot.targetAppointment ? "accent" : "success"
              }
              description={
                props.snapshot.targetAppointment
                  ? "Use the appointment record for confirmation, reschedule notes, and outcome writeback after the listing lands."
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
                        Recommended first lane: {recommendedAction.label}.{" "}
                        {recommendedAction.reason}
                      </span>
                    }
                    title="Execution moment"
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
                    title="Tracked link context"
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
                              Open bound dossier
                            </FrontOfficeLink>
                          ) : null}
                          {listing.latestTrackedShare.appointmentHref ? (
                            <FrontOfficeLink
                              className="office-inline-link"
                              href={listing.latestTrackedShare.appointmentHref}
                            >
                              Open bound appointment
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
                        Open agent send package
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
                    Back to client dossier
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
                  Open agent send package
                </FrontOfficeLink>
                {props.routeState.hasDraftAssist ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.contextHref}
                  >
                    Keep context, clear draft
                  </FrontOfficeLink>
                ) : null}
                {shouldShowResetLink ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.cleanHref}
                  >
                    Reset to clean workspace
                  </FrontOfficeLink>
                ) : null}
              </div>
            }
            {...buildListingEmptyState(props)}
          />
        )}
      </div>

      <div className="front-office-placeholder-note">
        <strong>Manual tracked output behavior</strong>
        <p>
          Each copy action creates a private tracked link, refreshes the tracked
          link / click counts on this page, and keeps the send fully manual. In
          client-linked mode, the same action also writes a Front Office send
          record so follow-up rescue, quiet-send cues, and appointment
          continuity can rise back into the dossier and dashboard.
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
