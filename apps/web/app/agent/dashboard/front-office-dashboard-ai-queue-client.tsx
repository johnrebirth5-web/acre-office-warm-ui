"use client";

import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();

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

      setFeedback({
        tone: "success",
        message: `Suggested follow-up created for ${item.clientName}. The dashboard will refresh with the updated queue.`,
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
        {props.items.length ? (
          props.items.map((item) => (
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
                        ? "Working..."
                        : "Create follow-up"}
                    </Button>
                  ) : null}
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
            description="As lease timing, appointments, tracked send behavior, handoff state, and transaction milestones line up, grounded AI next-touch opportunities will appear here."
            title="No AI suggestions in queue"
          />
        )}
      </div>
    </>
  );
}
