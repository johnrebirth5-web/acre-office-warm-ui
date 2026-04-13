"use client";

import { useState, useTransition } from "react";
import type {
  FrontOfficeClientDetailAiDraft,
  FrontOfficeClientDetailSnapshot,
} from "@acre/db";
import { Button, QueueItem } from "@acre/ui";
import { useRouter } from "next/navigation";
import { FrontOfficeAiExplainabilitySurface } from "../../_components/front-office-ai-explainability-surface";
import { FrontOfficeLink } from "../../_components/front-office-link";

type FrontOfficeClientAiSuggestionsClientProps = {
  snapshot: FrontOfficeClientDetailSnapshot;
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

function buildDraftCopyValue(draft: FrontOfficeClientDetailAiDraft) {
  return draft.subjectLine.trim()
    ? `Subject: ${draft.subjectLine}\n\n${draft.body}`
    : draft.body;
}

function buildDraftDirectHref(
  snapshot: FrontOfficeClientDetailSnapshot,
  draft: FrontOfficeClientDetailAiDraft,
) {
  if (draft.channelKey === "email" && snapshot.email) {
    const subject = draft.subjectLine.trim()
      ? `?subject=${encodeURIComponent(draft.subjectLine)}`
      : "";
    return {
      href: `mailto:${snapshot.email}${subject}`,
      label: "Open email app",
    };
  }

  if (draft.channelKey === "sms" && snapshot.phone) {
    return {
      href: `sms:${snapshot.phone}`,
      label: "Open text app",
    };
  }

  if (draft.channelKey === "call" && snapshot.phone) {
    return {
      href: `tel:${snapshot.phone}`,
      label: "Open dialer",
    };
  }

  return null;
}

function formatAiSuggestionDueDate(value: string) {
  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsedValue);
}

function canUseTrackedDraftAssist(statusLabel: string) {
  return (
    statusLabel === "Content follow-up" ||
    statusLabel === "Warm engagement" ||
    statusLabel === "Appointment prep" ||
    statusLabel === "Next touch"
  );
}

function buildExecutionAssistantSummary(input: {
  aiSuggestions: FrontOfficeClientDetailSnapshot["aiSuggestions"];
  aiStrategy: FrontOfficeClientDetailSnapshot["aiStrategy"];
  playbookSummary: string;
  canCreateSuggestedFollowUp: boolean;
  suggestedDueLabel: string | null;
}) {
  if (
    input.canCreateSuggestedFollowUp &&
    input.aiSuggestions.followUpSuggestion
  ) {
    return `${input.aiSuggestions.primaryActionReason} Suggested approach: ${input.playbookSummary}. If you accept one-click, Acre will create "${input.aiSuggestions.followUpSuggestion.title}" as a shared follow-up${input.suggestedDueLabel ? ` due ${input.suggestedDueLabel}` : ""} and wait for the later task outcome before learning from it.`;
  }

  return `${input.aiSuggestions.primaryActionReason} ${input.aiSuggestions.oneClickReason} Strategy summary: ${input.aiStrategy.summaryLabel}. Suggested approach: ${input.playbookSummary}. Acre will wait for your review before recording a new accepted action.`;
}

function buildExecutionAssistantMeta(input: {
  aiSuggestions: FrontOfficeClientDetailSnapshot["aiSuggestions"];
  aiStrategy: FrontOfficeClientDetailSnapshot["aiStrategy"];
  playbookSummary: string;
  canCreateSuggestedFollowUp: boolean;
  primaryActionLabel: string;
}) {
  return [
    `Recommended move · ${input.primaryActionLabel}`,
    input.aiStrategy.summaryLabel,
    input.playbookSummary,
    `Current workflow · ${input.aiSuggestions.boundaryLabel}`,
    input.canCreateSuggestedFollowUp
      ? "One-click · shared follow-up only"
      : "One-click · review first",
    input.canCreateSuggestedFollowUp
      ? "Outcome · tracked after you accept it"
      : "Outcome · waiting on review",
    "No auto-send",
  ];
}

export function FrontOfficeClientAiSuggestionsClient(
  props: FrontOfficeClientAiSuggestionsClientProps,
) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const aiSuggestions = props.snapshot.aiSuggestions;
  const aiStrategy = props.snapshot.aiStrategy;
  const playbook = aiStrategy.playbook;
  const canCreateSuggestedFollowUp =
    Boolean(aiSuggestions.followUpSuggestion) &&
    aiSuggestions.allowsDirectFollowUpCreation;
  const primaryActionLabel =
    !aiSuggestions.allowsDirectFollowUpCreation &&
    aiSuggestions.primaryActionHref === "#front-office-follow-up-form"
      ? "Review existing follow-up"
      : aiSuggestions.followUpSuggestion &&
          aiSuggestions.primaryActionHref === "#front-office-follow-up-form"
        ? "Review in follow-up form"
        : aiSuggestions.primaryActionLabel;
  const suggestedDueLabel = aiSuggestions.followUpSuggestion
    ? formatAiSuggestionDueDate(aiSuggestions.followUpSuggestion.dueAt)
    : null;
  const executionAssistantSummary = buildExecutionAssistantSummary({
    aiSuggestions,
    aiStrategy,
    playbookSummary: playbook.summaryLabel,
    canCreateSuggestedFollowUp,
    suggestedDueLabel,
  });
  const executionAssistantMeta = buildExecutionAssistantMeta({
    aiSuggestions,
    aiStrategy,
    playbookSummary: playbook.summaryLabel,
    canCreateSuggestedFollowUp,
    primaryActionLabel,
  });
  const strategyRules = aiStrategy.rules;

  async function handleCreateFollowUp() {
    if (!aiSuggestions.followUpSuggestion) {
      return;
    }

    setFeedback(null);
    setActiveAction("follow-up");

    try {
      const response = await fetch(
        `/api/agent/clients/${props.snapshot.id}/follow-up-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: aiSuggestions.followUpSuggestion.title,
            dueAt: aiSuggestions.followUpSuggestion.dueAt,
            aiAcceptedAction: {
              sourceSurface: "client_dossier",
              suggestionKind: aiSuggestions.suggestionKind,
              suggestionLabel: aiSuggestions.statusLabel,
              actionTitle: aiSuggestions.followUpSuggestion.title,
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
        setActiveAction(null);
        return;
      }

      setFeedback({
        tone: "success",
        message:
          "Shared follow-up created in the queue. Acre logged this as an accepted AI action for later outcome tracking, but it did not send anything and did not change any Back Office record. It will only learn from the measurable task outcome after an agent completes, reschedules, or cancels it.",
      });
      startTransition(() => {
        router.refresh();
        setActiveAction(null);
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not create the suggested follow-up task.",
      });
      setActiveAction(null);
    }
  }

  async function handleCopyDraft(draft: FrontOfficeClientDetailAiDraft) {
    try {
      await copyTextToClipboard(buildDraftCopyValue(draft));
      setFeedback({
        tone: "success",
        message: `${draft.title} copied for review. Acre did not send anything, and copying alone does not count as an accepted action or tracked send. Edit the wording if the live conversation now needs a different tone.`,
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "Clipboard access is not available in this browser. Copy the draft manually instead.",
      });
    }
  }

  function buildTrackedDraftAssistHref(draft: FrontOfficeClientDetailAiDraft) {
    if (
      !canUseTrackedDraftAssist(aiSuggestions.statusLabel) ||
      (draft.channelKey !== "sms" && draft.channelKey !== "email")
    ) {
      return null;
    }

    const params = new URLSearchParams({
      clientId: props.snapshot.id,
      draftChannel: draft.channelKey,
      draftTitle: draft.title,
      draftBody: draft.body,
      draftSource: "ai",
      draftSuggestionKind: aiSuggestions.suggestionKind,
      draftSuggestionLabel: aiSuggestions.statusLabel,
    });

    if (draft.subjectLine.trim()) {
      params.set("draftSubject", draft.subjectLine.trim());
    }

    return `/agent/listings?${params.toString()}#front-office-draft-assist`;
  }

  return (
    <div className="office-list-page-stack">
      <div className="office-queue-list">
        <QueueItem
          action={
            <>
              {canCreateSuggestedFollowUp ? (
                <Button
                  disabled={Boolean(activeAction) || isPending}
                  onClick={() => void handleCreateFollowUp()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {activeAction === "follow-up" || isPending
                    ? "Creating..."
                    : "Create shared follow-up"}
                </Button>
              ) : (
                <Button disabled size="sm" type="button" variant="secondary">
                  Review first
                </Button>
              )}
              {aiSuggestions.primaryActionOpensInNewTab ? (
                <a
                  className="office-inline-link"
                  href={aiSuggestions.primaryActionHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  {primaryActionLabel}
                </a>
              ) : (
                <FrontOfficeLink
                  className="office-inline-link"
                  href={aiSuggestions.primaryActionHref}
                >
                  {primaryActionLabel}
                </FrontOfficeLink>
              )}
            </>
          }
          badgeLabel={aiSuggestions.statusLabel}
          badgeTone={aiSuggestions.statusTone}
          description={aiSuggestions.summary}
          title={aiSuggestions.statusTitle}
        />
      </div>

      <div className="front-office-placeholder-note front-office-playbook-surface">
        {strategyRules.length ? (
          <div className="office-queue-list">
            {strategyRules.map((rule) => (
              <QueueItem
                action={
                  <>
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={rule.followUpHref}
                    >
                      Load follow-up form
                    </FrontOfficeLink>
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={rule.openDossierHref}
                    >
                      Open client page
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
          </div>
        ) : null}

        <div className="front-office-ai-explainability-block">
          <span className="front-office-ai-explainability-kicker">
            Suggested next step
          </span>
          <p>{executionAssistantSummary}</p>
          <div className="list-row-meta front-office-record-meta">
            {executionAssistantMeta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <FrontOfficeAiExplainabilitySurface
          allowsDirectFollowUpCreation={
            aiSuggestions.allowsDirectFollowUpCreation
          }
          boundaryDescription={aiSuggestions.boundaryDescription}
          boundaryLabel={aiSuggestions.boundaryLabel}
          boundaryTone={aiSuggestions.boundaryTone}
          helperText={aiSuggestions.helperText}
          playbookSteps={playbook.steps}
          playbookSummary={playbook.summaryLabel}
          oneClickReason={aiSuggestions.oneClickReason}
          primaryActionReason={aiSuggestions.primaryActionReason}
          strategyRules={strategyRules}
          strategySignals={strategyRules.map(
            (rule) => `${rule.sourceLabel} · ${rule.contextLabel}`,
          )}
          strategySummary={aiStrategy.summaryLabel}
          rankingSignals={aiSuggestions.rankingSignals}
          whyNowSignals={aiSuggestions.groundingSignals}
        />

        {feedback ? (
          <p
            className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div className="front-office-playbook-template-list">
        {aiSuggestions.drafts.map((draft) => {
          const directAction = buildDraftDirectHref(props.snapshot, draft);
          const trackedAssistHref = buildTrackedDraftAssistHref(draft);

          return (
            <article className="front-office-playbook-template" key={draft.id}>
              <div className="front-office-playbook-template-head">
                <div>
                  <strong>{draft.title}</strong>
                  <span>
                    {draft.channelLabel} · {draft.reasonLabel}
                  </span>
                  <span>Manual send only · Acre only prepares the draft</span>
                  
                </div>
                <div className="front-office-playbook-actions">
                  {directAction ? (
                    <a className="office-inline-link" href={directAction.href}>
                      {directAction.label}
                    </a>
                  ) : null}
                  {trackedAssistHref ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={trackedAssistHref}
                    >
                      Open tracked send assist
                    </FrontOfficeLink>
                  ) : null}
                  <Button
                    onClick={() => void handleCopyDraft(draft)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Copy draft
                  </Button>
                </div>
              </div>

              {draft.subjectLine.trim() ? (
                <pre className="front-office-playbook-template-body">{`Subject: ${draft.subjectLine}`}</pre>
              ) : null}

              <pre className="front-office-playbook-template-body">
                {draft.body}
              </pre>

              <div className="list-row-meta front-office-record-meta">
                <span>
                  {trackedAssistHref
                    ? "Tracked send assist keeps the next step inside listing output so accepted actions and tracked opens stay auditable."
                    : "No tracked send record is created unless you continue through a tracked output surface."}
                </span>
                <span>
                  {directAction
                    ? "Opening your device app never auto-sends; you confirm delivery there."
                    : "Copy the draft into your preferred channel and review it before sending."}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
