"use client";

import type { FrontOfficeClientDuplicatePair } from "@acre/db";
import { Button, SectionCard, StatusBadge } from "@acre/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FrontOfficeLink } from "../_components/front-office-link";

type FeedbackState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

export function FrontOfficeClientDuplicatesCard(props: {
  duplicatePairs: FrontOfficeClientDuplicatePair[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleMerge(pair: FrontOfficeClientDuplicatePair) {
    setFeedback(null);
    setActivePairId(pair.id);

    const response = await fetch("/api/agent/clients/merge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetClientId: pair.recommendedClient.id,
        sourceClientId: pair.duplicateClient.id,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      result?: {
        targetFullName: string;
        sourceFullName: string;
      };
    } | null;

    if (!response.ok || !payload?.result) {
      setFeedback({
        tone: "error",
        message:
          payload?.error ??
          "Could not merge the duplicate Front Office records.",
      });
      setActivePairId(null);
      return;
    }

    setFeedback({
      tone: "success",
      message: `${payload.result.sourceFullName} was merged into ${payload.result.targetFullName}. Refreshing the client queue now.`,
    });
    startTransition(() => {
      router.refresh();
      setActivePairId(null);
    });
  }

  return (
    <SectionCard
      className="office-list-card"
      subtitle="These records share the same exact name, phone, or email across the Front Office CRM records you can currently see. Review both sides first, then merge the duplicate into the recommended keep record."
      title="Potential duplicates"
    >
      <div className="front-office-merge-list">
        {props.duplicatePairs.map((pair) => {
          const isBusy = activePairId === pair.id || isPending;

          return (
            <article className="front-office-merge-pair" key={pair.id}>
              <div className="front-office-merge-pair-head">
                <div>
                  <strong>{pair.matchReasons.join(" · ")}</strong>
                  <p>{pair.rationaleLabel}</p>
                </div>
                <StatusBadge tone="warning">Review first</StatusBadge>
              </div>

              <div className="front-office-merge-columns">
                <div className="front-office-merge-column is-recommended">
                  <span className="front-office-merge-column-label">
                    Keep this record
                  </span>
                  <div className="front-office-merge-column-head">
                    <strong>{pair.recommendedClient.fullName}</strong>
                    <StatusBadge tone={pair.recommendedClient.stageTone}>
                      {pair.recommendedClient.stage}
                    </StatusBadge>
                  </div>
                  <p>
                    {pair.recommendedClient.sourceLabel} ·{" "}
                    {pair.recommendedClient.nextTouchLabel}
                  </p>
                  <div className="front-office-record-meta">
                    <span>{pair.recommendedClient.detailLabel}</span>
                    <span>{pair.recommendedClient.lastUpdatedLabel}</span>
                    <span>{pair.recommendedClient.ownerLabel}</span>
                    <span>{pair.recommendedClient.scopeLabel}</span>
                  </div>
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={pair.recommendedClient.href}
                  >
                    {pair.recommendedClient.reviewLabel}
                  </FrontOfficeLink>
                </div>

                <div className="front-office-merge-column">
                  <span className="front-office-merge-column-label">
                    Merge this duplicate in
                  </span>
                  <div className="front-office-merge-column-head">
                    <strong>{pair.duplicateClient.fullName}</strong>
                    <StatusBadge tone={pair.duplicateClient.stageTone}>
                      {pair.duplicateClient.stage}
                    </StatusBadge>
                  </div>
                  <p>
                    {pair.duplicateClient.sourceLabel} ·{" "}
                    {pair.duplicateClient.nextTouchLabel}
                  </p>
                  <div className="front-office-record-meta">
                    <span>{pair.duplicateClient.detailLabel}</span>
                    <span>{pair.duplicateClient.lastUpdatedLabel}</span>
                    <span>{pair.duplicateClient.ownerLabel}</span>
                    <span>{pair.duplicateClient.scopeLabel}</span>
                  </div>
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={pair.duplicateClient.href}
                  >
                    {pair.duplicateClient.reviewLabel}
                  </FrontOfficeLink>
                </div>
              </div>

              <div className="front-office-merge-actions">
                <Button
                  disabled={isBusy}
                  onClick={() => {
                    void handleMerge(pair);
                  }}
                  type="button"
                >
                  {isBusy
                    ? "Merging duplicate..."
                    : `Merge into ${pair.recommendedClient.fullName}`}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {feedback ? (
        <p
          className={`front-office-calendar-feedback ${
            feedback.tone === "success" ? "is-success" : "is-error"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </SectionCard>
  );
}
