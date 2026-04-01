"use client";

import { useState } from "react";
import type { FrontOfficeAgentMaterialSnapshot } from "@acre/db";
import { Button, EmptyState, QueueItem } from "@acre/ui";
import { FrontOfficeLink } from "../_components/front-office-link";

type FrontOfficeAgentMaterialWindowProps = {
  material: FrontOfficeAgentMaterialSnapshot;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

async function copyTextToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

export function FrontOfficeAgentMaterialWindow(
  props: FrontOfficeAgentMaterialWindowProps,
) {
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  async function handleCopy(label: string, value: string) {
    try {
      await copyTextToClipboard(value);
      setFeedback({
        tone: "success",
        message: `${label} copied. The next client touch can use it immediately.`,
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "Clipboard access is not available in this browser. Copy the material manually instead.",
      });
    }
  }

  return (
    <div className="office-list-page-stack">
      <div className="front-office-agent-material-card">
        <div className="front-office-agent-material-head">
          {props.material.avatarUrl ? (
            <img
              alt={`${props.material.displayName} avatar`}
              className="front-office-agent-material-avatar"
              src={props.material.avatarUrl}
            />
          ) : (
            <div className="front-office-agent-material-avatar front-office-agent-material-avatar-fallback">
              <span>{props.material.avatarFallback}</span>
            </div>
          )}

          <div className="front-office-agent-material-copy">
            <strong>{props.material.displayName}</strong>
            <span>{props.material.titleLabel}</span>
            <span>{props.material.officeLabel}</span>
          </div>
        </div>

        <p>{props.material.bioLabel}</p>

        <div className="front-office-agent-material-meta">
          <span>
            {props.material.portraitReady
              ? "Portrait ready"
              : "Portrait missing"}
          </span>
          <span>{props.material.licenseLabel}</span>
          <span>{props.material.recentClosedCount} recent closings</span>
          <span>{props.material.featuredCaseCount} featured case(s)</span>
        </div>

        <div className="front-office-agent-material-actions">
          <Button
            onClick={() =>
              void handleCopy("Business card", props.material.businessCardText)
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            Copy business card
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Intro email", props.material.introEmailText)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy intro email
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Intro text", props.material.introTextMessage)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy intro text
          </Button>
        </div>

        {feedback ? (
          <p
            className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div className="office-queue-list">
        <QueueItem
          badgeLabel="Contact"
          badgeTone="accent"
          description={
            props.material.phone
              ? `Phone on record: ${props.material.phone}`
              : "No direct phone on record yet."
          }
          title={props.material.email || "Email not published"}
          action={
            <div className="front-office-playbook-actions">
              {props.material.phone ? (
                <FrontOfficeLink
                  className="office-inline-link"
                  href={`tel:${props.material.phone}`}
                >
                  Call
                </FrontOfficeLink>
              ) : null}
              {props.material.email ? (
                <FrontOfficeLink
                  className="office-inline-link"
                  href={`mailto:${props.material.email}`}
                >
                  Email
                </FrontOfficeLink>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="front-office-agent-featured-cases">
        {props.material.featuredCases.length ? (
          props.material.featuredCases.map((item) => (
            <QueueItem
              action={
                <FrontOfficeLink
                  className="office-inline-link"
                  href={item.href}
                >
                  Open transaction
                </FrontOfficeLink>
              }
              badgeLabel={item.closingLabel}
              badgeTone="success"
              description={item.priceLabel}
              key={item.id}
              title={item.label}
            />
          ))
        ) : (
          <EmptyState
            description="Closed transactions will surface here as featured cases once this profile has recent wins to reference."
            title="No featured cases yet"
          />
        )}
      </div>
    </div>
  );
}
