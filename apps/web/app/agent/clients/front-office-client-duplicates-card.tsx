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

type FeedbackState = {
  tone: "success" | "error";
  title: string;
  message: string;
  detail?: string;
  nextStep?: string;
  actions?: FeedbackAction[];
} | null;

type MergeApiPayload = {
  error?: string;
  detail?: string;
  nextStep?: string;
  code?: string;
  keepReason?: string;
  boundary?: string;
  result?: FrontOfficeClientMergeResult;
};

type ClientWorkbenchView =
  | "all"
  | "follow_first"
  | "anchor_now"
  | "viewing_lane"
  | "boundary_review"
  | "duplicate_review";

function buildDuplicatePairAnchorId(pairId: string) {
  const sanitized = pairId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `duplicate-pair-${sanitized || "record"}`;
}

function buildMergeCountsSummary(
  result: FrontOfficeClientMergeResult["movedCounts"],
) {
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
    label: "Ready after review",
    tone: "success" as const,
    description:
      "Multiple exact-match signals point to one surviving dossier, so the merge should mostly consolidate attached history.",
  };
}

function buildKeepSummary(pair: FrontOfficeClientDuplicatePair) {
  return `${pair.rationaleLabel} Current keep dossier snapshot: ${pair.recommendedClient.detailLabel}.`;
}

function buildMergeCarryForwardSummary(pair: FrontOfficeClientDuplicatePair) {
  return `${pair.recommendedClient.fullName} stays as the only Front Office dossier. If ${pair.duplicateClient.fullName} still owns linked appointments, follow-up tasks, tracked sends, AI action history, handoff drafts, or Back Office contact pointers, Acre moves that history onto the surviving dossier before removing the duplicate record.`;
}

function buildMergeFailureDetail(pair: FrontOfficeClientDuplicatePair) {
  return `Why Acre was keeping ${pair.recommendedClient.fullName}: ${pair.rationaleLabel}`;
}

function buildClientWorkbenchHref(
  view: ClientWorkbenchView,
  anchorId: string,
) {
  return `/agent/clients?clientView=${view}#${anchorId}`;
}

export function FrontOfficeClientDuplicatesCard(props: {
  duplicatePairs: FrontOfficeClientDuplicatePair[];
  clientView?: ClientWorkbenchView;
}) {
  const router = useRouter();
  const clientView = props.clientView ?? "duplicate_review";
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
    const payload = (await response
      .json()
      .catch(() => null)) as MergeApiPayload | null;

    if (!response.ok || !payload?.result) {
      setFeedback({
        tone: "error",
        title: payload?.error ?? "Could not merge these FO dossiers",
        message: [
          payload?.detail ??
            "Acre stopped before removing the duplicate dossier, so both dossiers are still intact.",
          "Both dossiers are still intact.",
        ].join(" "),
        detail: buildMergeFailureDetail(pair),
        nextStep:
          payload?.nextStep ??
          "Refresh duplicate review, reopen both dossiers, and confirm the keep choice before trying again.",
        actions: [
          {
            href: buildClientWorkbenchHref(
              "duplicate_review",
              buildDuplicatePairAnchorId(pair.id),
            ),
            label: "Jump back to this pair",
          },
          {
            href: pair.recommendedClient.href,
            label: `Open ${pair.recommendedClient.fullName}`,
          },
          {
            href: pair.duplicateClient.href,
            label: `Open ${pair.duplicateClient.fullName}`,
          },
        ],
      });
      setActivePairId(null);
      return;
    }

    setFeedback({
      tone: "success",
      title: `Merged into ${payload.result.targetFullName}`,
      message: `Why Acre kept ${payload.result.targetFullName}: ${pair.rationaleLabel} ${payload.result.sourceFullName} is no longer a separate FO dossier.`,
      detail: [
        buildMergeCountsSummary(payload.result.movedCounts),
        payload.keepReason,
        payload.detail,
        payload.boundary,
      ]
        .filter(Boolean)
        .join(" "),
      nextStep:
        payload?.nextStep ??
        "Open the surviving dossier if you want to re-check stage, next touch, or the FO -> BO boundary.",
      actions: [
        {
          href: pair.recommendedClient.href,
          label: `Open ${pair.recommendedClient.fullName}`,
        },
        {
          href: buildClientWorkbenchHref(
            clientView,
            clientView === "duplicate_review"
              ? "duplicate-review"
              : "client-execution-queue",
          ),
          label: "Back to queue",
        },
      ],
    });
    setActivePairId(null);
    startTransition(() => {
      router.refresh();
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

        <div className="front-office-merge-list">
          {props.duplicatePairs.map((pair) => {
            const isBusy = activePairId === pair.id || isPending;
            const mergeRisk = buildMergeRisk(pair);

            return (
              <article
                className="front-office-merge-pair"
                id={buildDuplicatePairAnchorId(pair.id)}
                key={pair.id}
              >
                <div className="front-office-merge-pair-head">
                  <div>
                    <strong>{pair.matchReasons.join(" · ")}</strong>
                    <p>
                      Keep {pair.recommendedClient.fullName} and merge{" "}
                      {pair.duplicateClient.fullName} only after review.{" "}
                      {pair.rationaleLabel}
                    </p>
                  </div>
                  <StatusBadge tone={mergeRisk.tone}>
                    {mergeRisk.label}
                  </StatusBadge>
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
                  </div>
                </div>

                <div className="office-queue-list">
                  <QueueItem
                    badgeLabel="Why keep this dossier"
                    badgeTone="accent"
                    description={buildKeepSummary(pair)}
                    meta={
                      <>
                        <span>{pair.recommendedClient.detailLabel}</span>
                        <span>{pair.recommendedClient.lastUpdatedLabel}</span>
                        <span>{pair.recommendedClient.scopeLabel}</span>
                      </>
                    }
                    title={`Keep ${pair.recommendedClient.fullName}`}
                  />
                  <QueueItem
                    badgeLabel="What merge carries forward"
                    badgeTone="neutral"
                    description={buildMergeCarryForwardSummary(pair)}
                    meta={
                      <>
                        <span>{pair.duplicateClient.detailLabel}</span>
                        <span>{pair.duplicateClient.ownerLabel}</span>
                        <span>{pair.duplicateClient.scopeLabel}</span>
                      </>
                    }
                    title={`Merge ${pair.duplicateClient.fullName} into ${pair.recommendedClient.fullName}`}
                  />
                  <QueueItem
                    badgeLabel={mergeRisk.label}
                    badgeTone={mergeRisk.tone}
                    description={mergeRisk.description}
                    meta={
                      <>
                        <span>{pair.matchReasons.join(" · ")}</span>
                        <span>{pair.duplicateClient.scopeLabel}</span>
                      </>
                    }
                    title="Risk to review before merge"
                  />
                </div>

                <div className="front-office-merge-actions">
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={pair.recommendedClient.href}
                  >
                    Open keep dossier
                  </FrontOfficeLink>
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={pair.duplicateClient.href}
                  >
                    Open duplicate record
                  </FrontOfficeLink>
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
      </SectionCard>

      <ConfirmActionDialog
        cancelLabel="Keep reviewing"
        confirmLabel={
          confirmPair
            ? `Merge into ${confirmPair.recommendedClient.fullName}`
            : "Merge now"
        }
        description={
          confirmPair
            ? `${confirmPair.recommendedClient.fullName} will stay as the surviving dossier. ${confirmPair.duplicateClient.fullName} will disappear as a separate record only after Acre moves linked history safely.`
            : "Acre will keep one surviving dossier and move linked history safely before removing the duplicate."
        }
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
              description={buildKeepSummary(confirmPair)}
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
              description={buildMergeCarryForwardSummary(confirmPair)}
              meta={
                <>
                  <span>{confirmPair.duplicateClient.detailLabel}</span>
                  <span>{confirmPair.duplicateClient.nextTouchLabel}</span>
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
              title="What this merge will not do"
            />
          </div>
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
