"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { FrontOfficeListingsSnapshot } from "@acre/db";
import { Badge, Button, EmptyState } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";

type FrontOfficeListingsOutputClientProps = {
  snapshot: FrontOfficeListingsSnapshot;
  draftAssist?: {
    channel: "sms" | "email";
    title: string;
    subjectLine: string;
    body: string;
    sourceLabel?: string | null;
  } | null;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

type PendingAction = {
  listingId: string;
  action: "sms" | "email" | "direct";
} | null;

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

function buildAssistedSmsTemplate(input: {
  body: string;
  shareUrl: string;
}) {
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

function buildRecordedContextMessage(
  snapshot: FrontOfficeListingsSnapshot,
  listingTitle: string,
  variant: "text" | "email" | "link",
  usedDraftAssist: boolean,
) {
  const baseLabel =
    usedDraftAssist
      ? variant === "text"
        ? `AI-assisted tracked text copied for ${listingTitle}`
        : variant === "email"
          ? `AI-assisted tracked email copied for ${listingTitle}`
          : `Private tracked link copied for ${listingTitle}`
      : variant === "text"
        ? `Tracked text template copied for ${listingTitle}`
        : variant === "email"
          ? `Tracked email template copied for ${listingTitle}`
          : `Private tracked link copied for ${listingTitle}`;

  if (snapshot.targetClient && snapshot.targetAppointment) {
    return `${baseLabel}, and the send was recorded for ${snapshot.targetClient.fullName} in the selected appointment context.`;
  }

  if (snapshot.targetClient) {
    return `${baseLabel}, and the send was recorded for ${snapshot.targetClient.fullName}.`;
  }

  if (snapshot.targetAppointment) {
    return `${baseLabel}, and the send was recorded in the selected appointment context.`;
  }

  return `${baseLabel}.`;
}

export function FrontOfficeListingsOutputClient(
  props: FrontOfficeListingsOutputClientProps,
) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();

  const isBusy = Boolean(pendingAction) || isPending;

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
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        shareLink?: { sharePath: string };
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
      const usesDraftAssist =
        action !== "direct" &&
        props.draftAssist?.channel === action &&
        Boolean(props.draftAssist.body.trim());
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
        message: buildRecordedContextMessage(
          props.snapshot,
          listing.title,
          action === "sms" ? "text" : action === "email" ? "email" : "link",
          usesDraftAssist,
        ),
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
    label: string,
  ) {
    if (
      pendingAction?.listingId === listingId &&
      pendingAction.action === action
    ) {
      return "Working...";
    }

    return label;
  }

  return (
    <div className="office-list-page-stack">
      {feedback ? (
        <p
          className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="list-column front-office-record-list">
        <div className="front-office-placeholder-note">
          <strong>
            {props.snapshot.targetClient
              ? `Sending for ${props.snapshot.targetClient.fullName}`
              : "Tracked link mode"}
          </strong>
          <p>
            {props.snapshot.targetClient
              ? props.snapshot.targetAppointment
                ? "Every copy action on this page now creates a client-linked send record that also snapshots the selected appointment and the client's stage at send time."
                : "Every copy action on this page now creates a client-linked send record, so opens and revisits show up back in the dossier and dashboard."
              : "This page can always create tracked links. Open it from a client dossier or appointment context when you want the send itself attributed back to one specific client."}
          </p>
          {props.snapshot.targetAppointment ? (
            <p>
              Appointment context: {props.snapshot.targetAppointment.title} ·{" "}
              {props.snapshot.targetAppointment.startsAtLabel}
            </p>
          ) : null}
          {props.snapshot.targetClient ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.snapshot.targetClient.href}
            >
              Back to client dossier
            </FrontOfficeLink>
          ) : null}
        </div>

        {props.draftAssist ? (
          <div
            className="front-office-placeholder-note front-office-playbook-surface"
            id="front-office-draft-assist"
          >
            <strong>{props.draftAssist.title}</strong>
            <p>
              {props.draftAssist.sourceLabel ||
                "A draft assist is loaded into this tracked send surface. Copying the matching channel will use that draft and still append a private tracked listing link."}
            </p>
            <div className="list-row-meta front-office-record-meta">
              <span>
                Channel ·{" "}
                {props.draftAssist.channel === "sms" ? "SMS" : "Email"}
              </span>
              {props.draftAssist.subjectLine.trim() ? (
                <span>Subject · {props.draftAssist.subjectLine.trim()}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {props.snapshot.listings.length ? (
          props.snapshot.listings.map((listing) => {
            const shareMeta: ReactNode = (
              <div className="front-office-listing-actions">
                <Button
                  disabled={isBusy}
                  onClick={() => void runShareAction(listing, "sms")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {renderActionLabel(listing.id, "sms", "Copy SMS")}
                </Button>
                <Button
                  disabled={isBusy}
                  onClick={() => void runShareAction(listing, "email")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {renderActionLabel(listing.id, "email", "Copy email")}
                </Button>
                <Button
                  disabled={isBusy}
                  onClick={() => void runShareAction(listing, "direct")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {renderActionLabel(listing.id, "direct", "Copy link")}
                </Button>
              </div>
            );

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
                  <Badge
                    tone={
                      listing.statusTone === "danger"
                        ? "danger"
                        : listing.statusTone === "warning"
                          ? "warning"
                          : "success"
                    }
                  >
                    {listing.statusLabel}
                  </Badge>
                </div>
                <p>{listing.summaryLabel}</p>
                <div className="list-row-meta front-office-record-meta">
                  <span>{listing.priceLabel}</span>
                  <span>{listing.cityLabel}</span>
                  <span>{listing.trackedClickCount} tracked click(s)</span>
                  <span>{listing.trackedLinkCount} tracked link(s)</span>
                </div>
                {shareMeta}
              </article>
            );
          })
        ) : (
          <EmptyState
            description="Listings will appear here once send-ready inventory is available in the Front Office feed."
            title="No listing inventory in scope"
          />
        )}
      </div>

      <div className="front-office-placeholder-note">
        <strong>Tracked output behavior</strong>
        <p>
          Each copy action creates a private tracked link, copies the outreach
          content to the clipboard, and refreshes the tracked link / click
          counts on this page. In client-linked mode, the same action also
          writes a Front Office send record that can later show opens,
          revisits, stage context, and appointment context when applicable.
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
