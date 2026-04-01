"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { FrontOfficeListingsSnapshot } from "@acre/db";
import { Badge, Button, EmptyState } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";

type FrontOfficeListingsOutputClientProps = {
  snapshot: FrontOfficeListingsSnapshot;
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
      const copiedValue =
        action === "sms"
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
        message:
          action === "sms"
            ? props.snapshot.targetClient
              ? `Tracked text template copied for ${listing.title}, and the send was recorded for ${props.snapshot.targetClient.fullName}.`
              : `Tracked text template copied for ${listing.title}.`
            : action === "email"
              ? props.snapshot.targetClient
                ? `Tracked email template copied for ${listing.title}, and the send was recorded for ${props.snapshot.targetClient.fullName}.`
                : `Tracked email template copied for ${listing.title}.`
              : props.snapshot.targetClient
                ? `Private tracked link copied for ${listing.title}, and the send was recorded for ${props.snapshot.targetClient.fullName}.`
                : `Private tracked link copied for ${listing.title}.`,
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
              ? "Every copy action on this page now creates a client-linked send record, so opens and revisits show up back in the dossier and dashboard."
              : "This page can always create tracked links. Open it from a client dossier when you want the send itself attributed back to one specific client."}
          </p>
          {props.snapshot.targetClient ? (
            <FrontOfficeLink
              className="office-inline-link"
              href={props.snapshot.targetClient.href}
            >
              Back to client dossier
            </FrontOfficeLink>
          ) : null}
        </div>

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
          writes a Front Office send record that can later show opens and
          revisits.
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
