"use client";

import { useState, useTransition, type ComponentProps } from "react";
import type { FrontOfficeListingsSnapshot, FrontOfficeTone } from "@acre/db";
import { Badge, Button, EmptyState, QueueItem } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import type { FrontOfficeListingsRouteState } from "./front-office-listings-route-state";

type FrontOfficeListingsOutputClientProps = {
  snapshot: FrontOfficeListingsSnapshot;
  routeState: FrontOfficeListingsRouteState;
  draftAssist?: {
    channel: "sms" | "email";
    title: string;
    subjectLine: string;
    body: string;
    suggestionKind?: string | null;
    suggestionLabel?: string | null;
    sourceLabel?: string | null;
  } | null;
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
  modeLabel?: string;
  trackingLabel?: string;
  clientLabel?: string | null;
  clientStageLabel?: string | null;
  appointmentLabel?: string | null;
  appointmentWindowLabel?: string | null;
  inheritedClientFromAppointment?: boolean;
  followUpCue?: string;
  materialCue?: string;
};

type QueueItemBadgeTone = NonNullable<
  ComponentProps<typeof QueueItem>["badgeTone"]
>;

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
    return `Tracked sends are already producing opens here. Good candidate for a shortlist or showing follow-up instead of a cold first touch.`;
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

function buildRecordedContextMessage(input: {
  listingTitle: string;
  variant: "text" | "email" | "link";
  usedDraftAssist: boolean;
  context?: ShareActionContext | null;
}) {
  const baseLabel = input.usedDraftAssist
    ? input.variant === "text"
      ? `AI-assisted tracked text copied for ${input.listingTitle}.`
      : input.variant === "email"
        ? `AI-assisted tracked email copied for ${input.listingTitle}.`
        : `Private tracked link copied for ${input.listingTitle}.`
    : input.variant === "text"
      ? `Tracked text template copied for ${input.listingTitle}.`
      : input.variant === "email"
        ? `Tracked email template copied for ${input.listingTitle}.`
        : `Private tracked link copied for ${input.listingTitle}.`;
  const trackingLabel = input.context?.trackingLabel?.trim();

  return trackingLabel ? `${baseLabel} ${trackingLabel}` : baseLabel;
}

function buildRecordedContextDetail(context?: ShareActionContext | null) {
  if (!context) {
    return null;
  }

  const detail = [
    context.clientStageLabel
      ? `Stage snapshot · ${context.clientStageLabel}`
      : null,
    context.appointmentLabel
      ? [
          `Appointment · ${context.appointmentLabel}`,
          context.appointmentWindowLabel,
        ]
          .filter(Boolean)
          .join(" · ")
      : null,
    context.inheritedClientFromAppointment
      ? "Client binding came from the selected appointment."
      : null,
    context.followUpCue?.trim() || null,
    context.materialCue?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return detail.length ? detail : null;
}

function buildActionButtonLabel(input: {
  action: "sms" | "email" | "direct";
  usesDraftAssist: boolean;
}) {
  if (input.action === "sms") {
    return input.usesDraftAssist ? "Copy SMS draft + link" : "Copy SMS + link";
  }

  if (input.action === "email") {
    return input.usesDraftAssist
      ? "Copy email draft + link"
      : "Copy email + link";
  }

  return "Copy private link";
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

export function FrontOfficeListingsOutputClient(
  props: FrontOfficeListingsOutputClientProps,
) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();

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
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        shareLink?: {
          sharePath: string;
          sendRecordId?: string | null;
          context?: ShareActionContext;
        };
      } | null;

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
      setFeedback({
        tone: "success",
        message: buildRecordedContextMessage({
          listingTitle: listing.title,
          variant:
            action === "sms" ? "text" : action === "email" ? "email" : "link",
          usedDraftAssist: usesDraftAssist,
          context: payload.shareLink.context,
        }),
        detail: buildRecordedContextDetail(payload.shareLink.context),
      });
      startTransition(() => {
        router.refresh();
        setPendingAction(null);
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
          <strong>
            {props.routeState.mode === "appointment-linked"
              ? `Appointment-linked send surface for ${props.snapshot.targetClient?.fullName || "current client"}`
              : props.snapshot.targetClient
                ? `Tracked send surface for ${props.snapshot.targetClient.fullName}`
                : "Tracked link surface"}
          </strong>
          <p>{props.routeState.modeDescription}</p>
        </div>

        <div className="list-row-meta front-office-record-meta">
          <span>Mode · {props.routeState.modeLabel}</span>
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
          {props.routeState.diagnostics.length ? <span>URL context adjusted</span> : null}
        </div>

        <div className="front-office-playbook-actions">
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
              Dismiss draft assist
            </FrontOfficeLink>
          ) : null}
          {props.routeState.diagnostics.length ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.routeState.cleanHref}
            >
              Open clean route
            </FrontOfficeLink>
          ) : null}
        </div>
      </div>

      {props.routeState.diagnostics.length ? (
        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>URL / deep-link adjustments</strong>
            <span>
              Acre kept the current route safe, but some incoming context was
              trimmed or replaced before you started copying sends.
            </span>
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
                "A draft assist is loaded into this tracked send surface. Copying the matching channel will use that draft and still append a private tracked listing link."}
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
          </div>
          <div className="front-office-playbook-actions">
            <FrontOfficeLink
              className="office-inline-link"
              href={props.routeState.contextHref}
            >
              Keep context, clear draft
            </FrontOfficeLink>
          </div>
        </div>
      ) : null}

      <div className="front-office-playbook-grid">
        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Current send context</strong>
            <span>
              Keep the recipient, stage, and appointment pressure visible before
              you copy anything.
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
          </div>
        </div>

        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Channel strategy</strong>
            <span>
              Choose the channel based on how much framing the client still
              needs, not just on habit.
            </span>
          </div>
          <div className="office-queue-list">
            <QueueItem
              badgeLabel="Fast"
              badgeTone="accent"
              description={buildChannelCue(props.snapshot, "sms")}
              title="SMS + tracked link"
            />
            <QueueItem
              badgeLabel="Context"
              badgeTone="success"
              description={buildChannelCue(props.snapshot, "email")}
              title="Email + tracked link"
            />
            <QueueItem
              badgeLabel="Manual"
              badgeTone="warning"
              description={buildChannelCue(props.snapshot, "direct")}
              title="Private link only"
            />
          </div>
        </div>

        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Follow-up cues</strong>
            <span>
              Sends should reopen the next task faster, not disappear into
              clipboard history.
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
          props.snapshot.listings.map((listing) => (
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
              <p>{listing.summaryLabel}</p>
              <p className="front-office-record-supporting">
                {buildListingExecutionCue(props.snapshot, listing)}
              </p>
              <p className="front-office-record-supporting">
                {buildListingTractionCue(listing)}
              </p>
              <p className="front-office-record-supporting">
                {buildListingMaterialCue(props.snapshot)}
              </p>
              <div className="list-row-meta front-office-record-meta">
                <span>{listing.priceLabel}</span>
                <span>{listing.cityLabel}</span>
                <span>{listing.trackedClickCount} tracked click(s)</span>
                <span>{listing.trackedLinkCount} tracked link(s)</span>
              </div>
              <div className="front-office-listing-actions">
                <Button
                  disabled={isBusy}
                  onClick={() => void runShareAction(listing, "sms")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {renderActionLabel(listing.id, "sms")}
                </Button>
                <Button
                  disabled={isBusy}
                  onClick={() => void runShareAction(listing, "email")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {renderActionLabel(listing.id, "email")}
                </Button>
                <Button
                  disabled={isBusy}
                  onClick={() => void runShareAction(listing, "direct")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {renderActionLabel(listing.id, "direct")}
                </Button>
              </div>
            </article>
          ))
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
                {(props.routeState.hasDraftAssist ||
                  props.routeState.diagnostics.length) &&
                props.routeState.contextHref !== props.routeState.cleanHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.contextHref}
                  >
                    Keep context, clear extras
                  </FrontOfficeLink>
                ) : null}
                {props.routeState.diagnostics.length ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.cleanHref}
                  >
                    Open clean route
                  </FrontOfficeLink>
                ) : null}
              </div>
            }
            {...buildListingEmptyState(props)}
          />
        )}
      </div>

      <div className="front-office-placeholder-note">
        <strong>Tracked output behavior</strong>
        <p>
          Each copy action creates a private tracked link, refreshes the tracked
          link / click counts on this page, and keeps the share channel manual.
          In client-linked mode, the same action also writes a Front Office send
          record so follow-up rescue and quiet-send cues can rise back into the
          dossier and dashboard.
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
