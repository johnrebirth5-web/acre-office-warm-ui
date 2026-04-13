"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  FrontOfficeDashboardAiQueueItem,
  FrontOfficeDashboardSnapshot,
} from "@acre/db";
import { Button, EmptyState } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeAiExplainabilitySurface } from "../_components/front-office-ai-explainability-surface";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";

type FrontOfficeDashboardAiQueueClientProps = {
  items: FrontOfficeDashboardAiQueueItem[];
  strategy: FrontOfficeDashboardSnapshot["aiStrategy"];
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
} | null;

export function FrontOfficeDashboardAiQueueClient(
  props: FrontOfficeDashboardAiQueueClientProps,
) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [resolvedItemIds, setResolvedItemIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const strategyRules = props.strategy.rules;
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
        message: `Queued "${createdTitle}" for ${item.clientName}. No outbound message was sent automatically. The next move is now in the shared follow-up clock while the dashboard refreshes.`,
        primaryHref: item.openDossierHref,
        primaryLabel: "Open dossier",
        secondaryHref: "/agent/clients#client-pipeline",
        secondaryLabel: "Review client queue",
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
              {feedback.secondaryHref ? (
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={feedback.secondaryHref}
                >
                  {feedback.secondaryLabel ?? "Open queue"}
                </FrontOfficeLink>
              ) : null}
            </div>
          ) : null}
        </div>
        ) : null}

      {strategyRules.length ? (
        <div className="front-office-placeholder-note">
          <p>{props.strategy.playbook.summaryLabel}</p>
          <div className="list-row-meta front-office-record-meta">
            {strategyRules.map((rule) => (
              <span key={rule.id}>
                {rule.sourceLabel} · {rule.contextLabel}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="office-queue-list">
        {strategyRules.length ? (
          <>
            {strategyRules.map((rule) => (
              <FrontOfficeRailItem
                action={
                  <>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={rule.followUpHref}
                    >
                      Load follow-up form
                    </FrontOfficeLink>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={rule.openDossierHref}
                    >
                      Open dossier
                    </FrontOfficeLink>
                  </>
                }
                badgeLabel={rule.statusLabel}
                badgeTone={rule.tone}
                context={`${rule.sourceLabel} · ${rule.contextLabel}`}
                description={`${rule.description} ${rule.sourceDetail}`}
                key={rule.id}
                meta={
                  <div className="list-row-meta front-office-record-meta">
                    <span>{rule.helperLabel}</span>
                    {rule.whyNowSignals.map((signal) => (
                      <span key={signal}>{signal}</span>
                    ))}
                  </div>
                }
                title={rule.title}
              />
            ))}
          </>
        ) : null}

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
                        : "Approve next move"}
                    </Button>
                  ) : (
                    <Button
                      disabled
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Review grounded next move
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
                <>
                  <div className="list-row-meta front-office-record-meta">
                    <span>{item.whyNowLabel}</span>
                  </div>
                <FrontOfficeAiExplainabilitySurface
                  allowsDirectFollowUpCreation={
                    item.allowsDirectFollowUpCreation
                  }
                  boundaryDescription={item.boundaryDescription}
                  boundaryLabel={item.boundaryLabel}
                  boundaryTone={item.boundaryTone}
                  compact
                  helperText={item.helperLabel}
                  playbookSteps={props.strategy.playbook.steps}
                  playbookSummary={props.strategy.playbook.summaryLabel}
                  oneClickReason={item.oneClickReason}
                  primaryActionReason={item.primaryActionReason}
                  rankingSignals={item.rankingSignals}
                  strategyRules={strategyRules}
                  strategySignals={strategyRules.map(
                    (rule) => `${rule.sourceLabel} · ${rule.contextLabel}`,
                  )}
                  strategySummary={props.strategy.summaryLabel}
                  whyNowSignals={item.whyNowSignals}
                  />
                </>
              }
              title={item.clientName}
            />
          ))
        ) : (
          <EmptyState
            description={
              props.items.length && resolvedItemIds.length
                ? "This follow-up has been recorded. If more work is needed later, it will show up here again."
                : "No suggestions need attention right now."
            }
            title={
              props.items.length && resolvedItemIds.length
                ? "Action recorded"
                : "No AI suggestions in queue"
            }
          />
        )}
      </div>
    </>
  );
}
