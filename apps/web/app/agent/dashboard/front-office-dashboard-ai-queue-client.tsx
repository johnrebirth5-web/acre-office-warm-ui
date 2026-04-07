"use client";

import { useEffect, useState, useTransition } from "react";
import type { FrontOfficeDashboardAiQueueItem } from "@acre/db";
import { Button, EmptyState } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeAiExplainabilitySurface } from "../_components/front-office-ai-explainability-surface";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";

type FrontOfficeDashboardAiQueueClientProps = {
  items: FrontOfficeDashboardAiQueueItem[];
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

export function FrontOfficeDashboardAiQueueClient(
  props: FrontOfficeDashboardAiQueueClientProps,
) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [resolvedItemIds, setResolvedItemIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const visibleItems = props.items.filter(
    (item) => !resolvedItemIds.includes(item.id),
  );

  useEffect(() => {
    setResolvedItemIds([]);
  }, [props.items]);

  async function handleCreateFollowUp(item: FrontOfficeDashboardAiQueueItem) {
    setFeedback(null);
    setActiveClientId(item.clientId);

    try {
      const response = await fetch(
        `/api/agent/clients/${item.clientId}/follow-up-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: item.followUpTitle,
            dueAt: item.followUpDueAt,
            aiAcceptedAction: {
              sourceSurface: "dashboard_queue",
              suggestionKind: item.suggestionKind,
              suggestionLabel: item.statusLabel,
              actionTitle: item.followUpTitle,
            },
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        task?: {
          title?: string | null;
        } | null;
      } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message:
            payload?.error ?? "Could not create the suggested follow-up task.",
        });
        setActiveClientId(null);
        return;
      }

      const createdTitle = payload?.task?.title?.trim() || item.followUpTitle;
      setResolvedItemIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      );
      setFeedback({
        tone: "success",
        message: `Queued "${createdTitle}" for ${item.clientName}. No outbound message was sent automatically. The dashboard is refreshing, and Acre will only bring the record back if a grounded next step is still needed.`,
      });
      startTransition(() => {
        router.refresh();
        setActiveClientId(null);
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not create the suggested follow-up task.",
      });
      setActiveClientId(null);
    }
  }

  return (
    <>
      {feedback ? (
        <p
          className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="office-queue-list">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <FrontOfficeRailItem
              action={
                <>
                  {item.allowsDirectFollowUpCreation ? (
                    <Button
                      disabled={Boolean(activeClientId) || isPending}
                      onClick={() => void handleCreateFollowUp(item)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {activeClientId === item.clientId || isPending
                        ? "Queueing..."
                        : "Create follow-up"}
                    </Button>
                  ) : (
                    <Button disabled size="sm" type="button" variant="secondary">
                      One-click paused
                    </Button>
                  )}
                  {item.primaryActionOpensInNewTab ? (
                    <a
                      className="office-inline-link front-office-inline-link"
                      href={item.primaryActionHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {item.primaryActionLabel}
                    </a>
                  ) : (
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={item.primaryActionHref}
                    >
                      {item.primaryActionLabel}
                    </FrontOfficeLink>
                  )}
                  {item.primaryActionHref !== item.openDossierHref ? (
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={item.openDossierHref}
                    >
                      Review in dossier
                    </FrontOfficeLink>
                  ) : null}
                </>
              }
              badgeLabel={item.statusLabel}
              badgeTone={item.tone}
              context={item.contextLabel}
              description={item.description}
              key={item.id}
              meta={
                <FrontOfficeAiExplainabilitySurface
                  allowsDirectFollowUpCreation={item.allowsDirectFollowUpCreation}
                  boundaryDescription={item.boundaryDescription}
                  boundaryLabel={item.boundaryLabel}
                  boundaryTone={item.boundaryTone}
                  compact
                  helperText={item.helperLabel}
                  oneClickReason={item.oneClickReason}
                  primaryActionReason={item.primaryActionReason}
                  rankingSignals={item.rankingSignals}
                  whyNowSignals={item.whyNowSignals}
                />
              }
              title={item.clientName}
            />
          ))
        ) : (
          <EmptyState
            description={
              props.items.length && resolvedItemIds.length
                ? "The queue is refreshing after your last accepted action. If the record still needs work, Acre will return with the next grounded step."
                : "Nothing grounded is surfacing right now. Keep working the live follow-up, send/click, and handoff queues; Acre will only surface suggestions when the record trail supports them."
            }
            title={
              props.items.length && resolvedItemIds.length
                ? "Refreshing AI queue"
                : "No AI suggestions in queue"
            }
          />
        )}
      </div>
    </>
  );
}
