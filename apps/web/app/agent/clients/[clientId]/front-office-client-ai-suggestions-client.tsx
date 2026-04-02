"use client";

import { useState, useTransition } from "react";
import type {
  FrontOfficeClientDetailAiDraft,
  FrontOfficeClientDetailSnapshot,
} from "@acre/db";
import { Button, QueueItem } from "@acre/ui";
import { useRouter } from "next/navigation";
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
      label: "Email client",
    };
  }

  if (draft.channelKey === "sms" && snapshot.phone) {
    return {
      href: `sms:${snapshot.phone}`,
      label: "Text client",
    };
  }

  if (draft.channelKey === "call" && snapshot.phone) {
    return {
      href: `tel:${snapshot.phone}`,
      label: "Call client",
    };
  }

  return null;
}

function canUseTrackedDraftAssist(statusLabel: string) {
  return (
    statusLabel === "Content follow-up" ||
    statusLabel === "Warm engagement" ||
    statusLabel === "Appointment prep" ||
    statusLabel === "Next touch"
  );
}

export function FrontOfficeClientAiSuggestionsClient(
  props: FrontOfficeClientAiSuggestionsClientProps,
) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const aiSuggestions = props.snapshot.aiSuggestions;
  const primaryActionLabel =
    aiSuggestions.followUpSuggestion &&
    aiSuggestions.primaryActionHref === "#front-office-follow-up-form"
      ? "Review in follow-up form"
      : aiSuggestions.primaryActionLabel;

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
          "Suggested follow-up created. The dossier will refresh with the accepted next touch.",
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
        message: `${draft.title} copied. Edit it before sending if the live conversation needs a different tone.`,
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
              {aiSuggestions.followUpSuggestion ? (
                <Button
                  disabled={Boolean(activeAction) || isPending}
                  onClick={() => void handleCreateFollowUp()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {activeAction === "follow-up" || isPending
                    ? "Working..."
                    : "Create suggested follow-up"}
                </Button>
              ) : null}
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
        <strong>Why Acre is suggesting this</strong>
        <p>{aiSuggestions.helperText}</p>

        <div className="list-row-meta front-office-record-meta">
          {aiSuggestions.groundingSignals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>

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
                      Open tracked assist
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
            </article>
          );
        })}
      </div>
    </div>
  );
}
