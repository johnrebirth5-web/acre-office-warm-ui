"use client";

import { useEffect, useState, useTransition } from "react";
import type { FrontOfficeDashboardAiQueueItem } from "@acre/db";
import { Button } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";

type FrontOfficeDashboardAiQueueClientProps = {
  items: FrontOfficeDashboardAiQueueItem[];
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
  primaryHref?: string;
  primaryLabel?: string;
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
        message: `Queued "${createdTitle}" for ${item.clientName}. Nothing was sent automatically.`,
        primaryHref: item.openDossierHref,
        primaryLabel: "Open client page",
      });
      setActiveClientId(null);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not create the suggested follow-up task.",
      });
      setActiveClientId(null);
    }
  }

  if (!visibleItems.length && !feedback) {
    return null;
  }

  return (
    <>
      {feedback ? (
        <div
          className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
        >
          <p>{feedback.message}</p>
          {feedback.primaryHref ? (
            <div className="list-row-meta front-office-record-meta">
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href={feedback.primaryHref}
              >
                {feedback.primaryLabel ?? "Open record"}
              </FrontOfficeLink>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="office-queue-list">
        {visibleItems.map((item) => (
          <FrontOfficeRailItem
            action={
              item.allowsDirectFollowUpCreation ? (
                <Button
                  disabled={Boolean(activeClientId) || isPending}
                  onClick={() => void handleCreateFollowUp(item)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {activeClientId === item.clientId || isPending
                    ? "Queueing..."
                    : "Approve next move"}
                </Button>
              ) : item.primaryActionOpensInNewTab ? (
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
              )
            }
            badgeLabel={item.statusLabel}
            badgeTone={item.tone}
            context={item.contextLabel}
            description={item.description}
            key={item.id}
            meta={<span>{item.whyNowLabel}</span>}
            title={item.clientName}
          />
        ))}
      </div>
    </>
  );
}
