"use client";

import type {
  FrontOfficeClientDuplicatePair,
  FrontOfficeClientMergeResult,
} from "@acre/db";
import {
  Button,
  ConfirmActionDialog,
  QueueItem,
  SectionCard,
  StatusBadge,
} from "@acre/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FrontOfficeLink } from "../_components/front-office-link";

type FeedbackAction = {
  href: string;
  label: string;
};

type FeedbackState =
  | {
      tone: "success" | "error";
      title: string;
      message: string;
      detail?: string;
      nextStep?: string;
      actions?: FeedbackAction[];
    }
  | null;

type MergeApiPayload = {
  error?: string;
  detail?: string;
  nextStep?: string;
  code?: string;
  result?: FrontOfficeClientMergeResult;
};

function buildMergeCountsSummary(result: FrontOfficeClientMergeResult["movedCounts"]) {
  const parts = [
    result.appointments > 0 ? `${result.appointments} appointment(s)` : null,
    result.followUpTasks > 0
      ? `${result.followUpTasks} follow-up task(s)`
      : null,
    result.sendRecords > 0 ? `${result.sendRecords} tracked send(s)` : null,
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
    ? `Acre moved or reconciled ${parts.join(", ")}.`
    : "No linked workflow records needed to move.";
}

function buildMergeRisk(pair: FrontOfficeClientDuplicatePair) {
  const keepIsLight = pair.recommendedClient.detailLabel
    .toLowerCase()
    .includes("light dossier");
  const duplicateIsLight = pair.duplicateClient.detailLabel
    .toLowerCase()
    .includes("light dossier");
  const duplicateOutsidePersonalQueue =
    pair.duplicateClient.scopeLabel !== "In your FO queue";

  if (!keepIsLight && !duplicateIsLight) {
    return {
      label: "Both dossiers active",
      tone: "warning" as const,
      description:
        "Both sides already carry live workflow context, so confirm the keep choice before Acre consolidates history.",
    };
  }

  if (duplicateOutsidePersonalQueue) {
    return {
      label: "Office-scope record",
      tone: "warning" as const,
      description:
        "At least one record is only visible through broader office CRM scope, so review ownership and scope before merging.",
    };
  }

  if (pair.matchReasons.length === 1) {
    return {
      label: "Single-signal match",
      tone: "warning" as const,
      description:
        "Acre only matched one exact field here, so compare both dossiers carefully before you remove one.",
    };
  }

  return {
    label: "High-confidence pair",
    tone: "success" as const,
    description:
      "Multiple exact-match signals point to one surviving dossier, so the merge should mostly consolidate attached history.",
  };
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
    const payload = (await response.json().catch(() => null)) as MergeApiPayload | null;

    if (!response.ok || !payload?.result) {
      setFeedback({
        tone: "error",
        title: payload?.error ?? "Could not merge these FO dossiers",
        message:
          payload?.detail ??
          "Acre stopped before removing the duplicate record, so both dossiers are still intact.",
        detail: `Why Acre was keeping ${pair.recommendedClient.fullName}: ${pair.rationaleLabel}`,
        nextStep:
          payload?.nextStep ??
          "Refresh duplicate review, reopen both dossiers, and confirm the keep choice before trying again.",
        actions: [
          {
            href: pair.recommendedClient.href,
            label: pair.recommendedClient.reviewLabel,
          },
          {
            href: pair.duplicateClient.href,
            label: pair.duplicateClient.reviewLabel,
          },
        ],
      });
      setActivePairId(null);
      return;
    }

    setFeedback({
      tone: "success",
      title: `Merged into ${payload.result.targetFullName}`,
      message: `${payload.result.sourceFullName} is no longer a separate FO dossier. Why Acre kept ${payload.result.targetFullName}: ${pair.rationaleLabel}`,
      detail: [
        buildMergeCountsSummary(payload.result.movedCounts),
        payload.detail,
      ]
        .filter(Boolean)
        .join(" "),
      nextStep:
        payload.nextStep ??
        "Open the surviving dossier if you want to re-check stage, next touch, or the FO -> BO boundary.",
      actions: [
        {
          href: pair.recommendedClient.href,
          label: `Open ${pair.recommendedClient.fullName}`,
        },
        {
          href: "#duplicate-review",
          label: "Stay in duplicate lane",
        },
      ],
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
        subtitle="Review both sides first, keep one surviving dossier on purpose, and merge only when you are comfortable with Acre's keep recommendation. This lane consolidates FO history and BO contact pointers only; it does not create a transaction or hide automation."
        title="Duplicate review lane"
      >
        <div className="front-office-merge-list">
          {props.duplicatePairs.map((pair) => {
            const isBusy = activePairId === pair.id || isPending;
            const mergeRisk = buildMergeRisk(pair);
            const reviewBadgeLabel =
              pair.matchReasons.length >= 2 ? "High overlap" : "Review first";

            return (
              <article className="front-office-merge-pair" key={pair.id}>
                <div className="front-office-merge-pair-head">
                  <div>
                    <strong>{pair.matchReasons.join(" · ")}</strong>
                    <p>
                      Why Acre keeps {pair.recommendedClient.fullName}:{" "}
                      {pair.rationaleLabel}
                    </p>
                  </div>
                  <StatusBadge tone="warning">{reviewBadgeLabel}</StatusBadge>
                </div>

                <div className="front-office-merge-columns">
                  <div className="front-office-merge-column is-recommended">
                    <span className="front-office-merge-column-label">
                      Keep this dossier
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

                <div className="office-queue-list">
                  <QueueItem
                    badgeLabel="Keep reason"
                    badgeTone="accent"
                    description={pair.recommendedClient.detailLabel}
                    meta={
                      <>
                        <span>{pair.recommendedClient.lastUpdatedLabel}</span>
                        <span>{pair.recommendedClient.scopeLabel}</span>
                      </>
                    }
                    title={`Why ${pair.recommendedClient.fullName} survives`}
                  />
                  <QueueItem
                    badgeLabel={mergeRisk.label}
                    badgeTone={mergeRisk.tone}
                    description={mergeRisk.description}
                    meta={
                      <>
                        <span>{pair.duplicateClient.detailLabel}</span>
                        <span>{pair.duplicateClient.scopeLabel}</span>
                      </>
                    }
                    title="Merge risk to review"
                  />
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
          <div
            className={`front-office-calendar-feedback ${
              feedback.tone === "success" ? "is-success" : "is-error"
            }`}
          >
            <strong>{feedback.title}</strong>
            <p>{feedback.message}</p>
            {feedback.detail ? <p>{feedback.detail}</p> : null}
            {feedback.nextStep ? <p>Next step: {feedback.nextStep}</p> : null}
            {feedback.actions?.length ? (
              <div className="list-row-meta front-office-record-meta">
                {feedback.actions.map((action) => (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={action.href}
                    key={`${action.href}-${action.label}`}
                  >
                    {action.label}
                  </FrontOfficeLink>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      <ConfirmActionDialog
        cancelLabel="Keep reviewing"
        confirmLabel={
          confirmPair
            ? `Merge into ${confirmPair.recommendedClient.fullName}`
            : "Merge now"
        }
        description="Acre will move linked Front Office history and reconcile related Back Office contact links where possible, then remove the duplicate dossier. It will not auto-send anything, create a transaction, or pretend an outside sync already happened."
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
            <QueueItem
              badgeLabel="Keep"
              badgeTone="accent"
              description={confirmPair.rationaleLabel}
              meta={
                <>
                  <span>{confirmPair.recommendedClient.detailLabel}</span>
                  <span>{confirmPair.recommendedClient.nextTouchLabel}</span>
                  <span>{confirmPair.recommendedClient.ownerLabel}</span>
                </>
              }
              title={`${confirmPair.recommendedClient.fullName} · ${confirmPair.recommendedClient.stage}`}
            />
            <QueueItem
              badgeLabel="Merge in"
              badgeTone="warning"
              description={confirmPair.duplicateClient.detailLabel}
              meta={
                <>
                  <span>{confirmPair.duplicateClient.nextTouchLabel}</span>
                  <span>{confirmPair.duplicateClient.ownerLabel}</span>
                  <span>{confirmPair.duplicateClient.scopeLabel}</span>
                </>
              }
              title={`${confirmPair.duplicateClient.fullName} · ${confirmPair.duplicateClient.stage}`}
            />
            <QueueItem
              badgeLabel={buildMergeRisk(confirmPair).label}
              badgeTone={buildMergeRisk(confirmPair).tone}
              description={buildMergeRisk(confirmPair).description}
              title="Risk to review before merge"
            />
            <QueueItem
              badgeLabel="Boundary"
              badgeTone="neutral"
              description="This action only consolidates the FO dossier and BO contact pointers that already exist. It does not create or edit a formal transaction file, sync an outside provider, or auto-send follow-up."
              title="What this merge will and will not do"
            />
          </div>
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
