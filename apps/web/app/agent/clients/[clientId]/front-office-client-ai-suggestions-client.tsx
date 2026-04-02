"use client";

import { useState } from "react";
import type {
  FrontOfficeClientDetailAiDraft,
  FrontOfficeClientDetailSnapshot,
} from "@acre/db";
import { Button, QueueItem } from "@acre/ui";
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

export function FrontOfficeClientAiSuggestionsClient(
  props: FrontOfficeClientAiSuggestionsClientProps,
) {
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const aiSuggestions = props.snapshot.aiSuggestions;

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

  return (
    <div className="office-list-page-stack">
      <div className="office-queue-list">
        <QueueItem
          action={
            aiSuggestions.primaryActionOpensInNewTab ? (
              <a
                className="office-inline-link"
                href={aiSuggestions.primaryActionHref}
                rel="noreferrer"
                target="_blank"
              >
                {aiSuggestions.primaryActionLabel}
              </a>
            ) : (
              <FrontOfficeLink
                className="office-inline-link"
                href={aiSuggestions.primaryActionHref}
              >
                {aiSuggestions.primaryActionLabel}
              </FrontOfficeLink>
            )
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
