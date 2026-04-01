"use client";

import { useState } from "react";
import type { FrontOfficeClientDetailSnapshot } from "@acre/db";
import { Button, QueueItem } from "@acre/ui";

type FrontOfficeClientChatListClientProps = {
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

export function FrontOfficeClientChatListClient(
  props: FrontOfficeClientChatListClientProps,
) {
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  async function handleCopy(label: string, value: string) {
    try {
      await copyTextToClipboard(value);
      setFeedback({
        tone: "success",
        message: `${label} copied. The agent can paste it directly into the next client touch.`,
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "Clipboard access is not available in this browser. Copy the template manually instead.",
      });
    }
  }

  return (
    <div className="office-list-page-stack">
      <div className="office-queue-list">
        <QueueItem
          action={
            <div className="front-office-playbook-actions">
              {props.snapshot.phone ? (
                <a
                  className="office-inline-link"
                  href={`tel:${props.snapshot.phone}`}
                >
                  Call client
                </a>
              ) : null}
              {props.snapshot.email ? (
                <a
                  className="office-inline-link"
                  href={`mailto:${props.snapshot.email}`}
                >
                  Email client
                </a>
              ) : null}
              <Button
                onClick={() =>
                  void handleCopy(
                    "Intro script",
                    props.snapshot.playbook.introScript,
                  )
                }
                size="sm"
                type="button"
                variant="secondary"
              >
                Copy intro script
              </Button>
            </div>
          }
          badgeLabel={props.snapshot.playbook.focusLabel}
          badgeTone={props.snapshot.workflow.nextStepTone}
          description={props.snapshot.playbook.focusDescription}
          title="Current playbook focus"
        />
      </div>

      <div className="front-office-placeholder-note front-office-playbook-surface">
        <div className="front-office-playbook-header">
          <strong>Intro script</strong>
          <p>{props.snapshot.playbook.introScript}</p>
        </div>

        {feedback ? (
          <p
            className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div className="front-office-playbook-grid">
        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Call checklist</strong>
            <span>Use this to keep the call outcome-oriented.</span>
          </div>
          <div className="office-queue-list">
            {props.snapshot.playbook.callChecklist.map((item) => (
              <QueueItem
                badgeLabel="Checklist"
                badgeTone="accent"
                description={item.description}
                key={item.id}
                title={item.title}
              />
            ))}
          </div>
        </div>

        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Conversation prompts</strong>
            <span>Use prompts to qualify instead of guessing.</span>
          </div>
          <div className="office-queue-list">
            {props.snapshot.playbook.conversationPrompts.map((item) => (
              <QueueItem
                badgeLabel="Prompt"
                badgeTone="neutral"
                description={item.description}
                key={item.id}
                title={item.title}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>Objection handling</strong>
          <span>Keep the response calm, direct, and action-oriented.</span>
        </div>
        <div className="office-queue-list">
          {props.snapshot.playbook.objectionHandling.map((item) => (
            <QueueItem
              badgeLabel="Objection"
              badgeTone="warning"
              description={item.response}
              key={item.id}
              title={item.objection}
            />
          ))}
        </div>
      </div>

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>Copy-ready templates</strong>
          <span>
            Templates are stage-aware, but still short enough to personalize
            before sending.
          </span>
        </div>

        <div className="front-office-playbook-template-list">
          {props.snapshot.playbook.messageTemplates.map((template) => (
            <article
              className="front-office-playbook-template"
              key={template.id}
            >
              <div className="front-office-playbook-template-head">
                <div>
                  <strong>{template.label}</strong>
                  <span>{template.channelLabel}</span>
                </div>
                <Button
                  onClick={() => void handleCopy(template.label, template.body)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Copy template
                </Button>
              </div>
              <pre className="front-office-playbook-template-body">
                {template.body}
              </pre>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
