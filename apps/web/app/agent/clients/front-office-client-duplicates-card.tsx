"use client";

import type { FrontOfficeClientDuplicatePair } from "@acre/db";
import { Button, ConfirmActionDialog, SectionCard, StatusBadge } from "@acre/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FrontOfficeLink } from "../_components/front-office-link";

type FeedbackState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

function buildMergeCountsSummary(result: {
  appointments: number;
  sendRecords: number;
  aiAcceptedActions: number;
  stageHistoryEntries: number;
  handoffDrafts: number;
  followUpTasks: number;
  transactionLinks: number;
  primaryTransactions: number;
}) {
  const parts = [
    result.appointments > 0
      ? `${result.appointments} appointment(s)`
      : null,
    result.followUpTasks > 0
      ? `${result.followUpTasks} follow-up task(s)`
      : null,
    result.sendRecords > 0
      ? `${result.sendRecords} tracked send(s)`
      : null,
    result.handoffDrafts > 0
      ? `${result.handoffDrafts} handoff draft(s)`
      : null,
    result.transactionLinks > 0
      ? `${result.transactionLinks} transaction link(s)`
      : null,
    result.primaryTransactions > 0
      ? `${result.primaryTransactions} primary transaction pointer(s)`
      : null,
    result.aiAcceptedActions > 0
      ? `${result.aiAcceptedActions} accepted AI action record(s)`
      : null,
    result.stageHistoryEntries > 0
      ? `${result.stageHistoryEntries} stage-history entry(s)`
      : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length
    ? `Moved or reconciled ${parts.join(", ")}.`
    : "No linked workflow records needed to move.";
}

export function FrontOfficeClientDuplicatesCard(props: {
  duplicatePairs: FrontOfficeClientDuplicatePair[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [confirmPair, setConfirmPair] =
    useState<FrontOfficeClientDuplicatePair | null>(null);
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
        movedCounts: {
          appointments: number;
          sendRecords: number;
          aiAcceptedActions: number;
          stageHistoryEntries: number;
          handoffDrafts: number;
          followUpTasks: number;
          transactionLinks: number;
          primaryTransactions: number;
        };
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
      message: `${payload.result.sourceFullName} was merged into ${payload.result.targetFullName}. ${buildMergeCountsSummary(payload.result.movedCounts)} Refreshing the duplicate review lane now.`,
    });
    startTransition(() => {
      router.refresh();
      setActivePairId(null);
    });
  }

  return (
    <>
      <SectionCard
        id="duplicate-review"
        className="office-list-card"
        subtitle="These records share the same exact name, phone, or email across the Front Office CRM records you can currently see. Review both sides first, then confirm the merge only when you are comfortable keeping one surviving dossier."
        title="Potential duplicates"
      >
        <div className="front-office-merge-list">
          {props.duplicatePairs.map((pair) => {
            const isBusy = activePairId === pair.id || isPending;
            const reviewBadgeLabel =
              pair.matchReasons.length >= 2 ? "High overlap" : "Review first";

            return (
              <article className="front-office-merge-pair" key={pair.id}>
                <div className="front-office-merge-pair-head">
                  <div>
                    <strong>{pair.matchReasons.join(" · ")}</strong>
                    <p>{pair.rationaleLabel}</p>
                  </div>
                  <StatusBadge tone="warning">{reviewBadgeLabel}</StatusBadge>
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
                      Review keep record
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
                      Review duplicate record
                    </FrontOfficeLink>
                  </div>
                </div>

                <div className="front-office-merge-actions">
                  <Button
                    disabled={isBusy}
                    onClick={() => {
                      setConfirmPair(pair);
                    }}
                    type="button"
                  >
                    {isBusy ? "Merging duplicate..." : "Merge after review"}
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

      <ConfirmActionDialog
        cancelLabel="Keep reviewing"
        confirmLabel={
          confirmPair
            ? `Merge into ${confirmPair.recommendedClient.fullName}`
            : "Merge now"
        }
        description="The duplicate record will be removed after Acre moves linked Front Office history and reconciles related transaction links where possible."
        isOpen={Boolean(confirmPair)}
        onCancel={() => setConfirmPair(null)}
        onConfirm={() => {
          if (!confirmPair) {
            return;
          }

          const nextPair = confirmPair;
          setConfirmPair(null);
          void handleMerge(nextPair);
        }}
        title={
          confirmPair
            ? `Merge ${confirmPair.duplicateClient.fullName} into ${confirmPair.recommendedClient.fullName}?`
            : ""
        }
      >
        {confirmPair ? (
          <div className="office-queue-list">
            <article className="office-queue-item">
              <strong>Keep record</strong>
              <p>
                {confirmPair.recommendedClient.fullName} ·{" "}
                {confirmPair.recommendedClient.stage}
              </p>
              <div className="front-office-record-meta">
                <span>{confirmPair.recommendedClient.sourceLabel}</span>
                <span>{confirmPair.recommendedClient.nextTouchLabel}</span>
                <span>{confirmPair.recommendedClient.ownerLabel}</span>
              </div>
            </article>
            <article className="office-queue-item">
              <strong>Duplicate to merge in</strong>
              <p>
                {confirmPair.duplicateClient.fullName} ·{" "}
                {confirmPair.duplicateClient.stage}
              </p>
              <div className="front-office-record-meta">
                <span>{confirmPair.duplicateClient.sourceLabel}</span>
                <span>{confirmPair.duplicateClient.nextTouchLabel}</span>
                <span>{confirmPair.duplicateClient.ownerLabel}</span>
              </div>
            </article>
            <article className="office-queue-item">
              <strong>Why Acre flagged it</strong>
              <p>{confirmPair.matchReasons.join(" · ")}</p>
              <div className="front-office-record-meta">
                <span>{confirmPair.rationaleLabel}</span>
              </div>
            </article>
          </div>
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
