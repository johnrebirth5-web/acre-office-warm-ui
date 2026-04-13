"use client";

import { useState } from "react";
import { Button, StatusBadge } from "@acre/ui";
import { FrontOfficeLink } from "./front-office-link";

type ExplainabilityTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

type ExplainabilityPlaybookStep = {
  id: string;
  kind: string;
  stepLabel: string;
  title: string;
  statusLabel: string;
  tone: ExplainabilityTone;
  contextLabel: string;
  doNowLabel: string;
  prepareLabel: string;
  watchLabel: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel: string;
  secondaryActionHref: string;
  detailLabel: string;
};

type ExplainabilityStrategyRule = {
  id: string;
  title: string;
  statusLabel: string;
  tone: ExplainabilityTone;
  draftLabel: string;
  draftChannelLabel: string;
  draftSubjectLine: string;
  draftBody: string;
  reviewChecklist: string[];
};

function boundaryMentionsBackOffice(boundaryLabel: string) {
  return boundaryLabel.toLowerCase().includes("back office");
}

function buildManualConfirmationReason(input: {
  allowsDirectFollowUpCreation: boolean;
  boundaryLabel: string;
  compact?: boolean;
}) {
  const crossesBackOfficeBoundary = boundaryMentionsBackOffice(
    input.boundaryLabel,
  );

  if (!input.allowsDirectFollowUpCreation && crossesBackOfficeBoundary) {
    return input.compact
      ? "A human still decides whether this becomes a formal Back Office handoff or stays a client-facing clarification."
      : "Acre can point to the formal handoff point, but it cannot confirm that document readiness, client intent, or ownership actually changed off-record. A human still decides whether this becomes a formal Back Office handoff or stays a client-facing clarification.";
  }

  if (!input.allowsDirectFollowUpCreation) {
    return input.compact
      ? "A paused one-click state means the live task or record still needs human review first."
      : "A paused one-click state means Acre can see unresolved accepted work or a live record that still needs review. It protects the current follow-up path instead of quietly stacking a second task or pretending the existing one no longer matters.";
  }

  return input.compact
    ? "Acre can create the task, but you still confirm timing, wording, channel, and whether the context changed."
    : "Acre can rank the step and create the shared task, but it cannot verify the latest off-record conversation, delivery context, or whether the client changed direction since the last logged touch. You still confirm timing, wording, channel, and whether the work should stay in Front Office.";
}

function buildAcceptedOutcomeReason(input: {
  allowsDirectFollowUpCreation: boolean;
  boundaryLabel: string;
  compact?: boolean;
}) {
  const crossesBackOfficeBoundary = boundaryMentionsBackOffice(
    input.boundaryLabel,
  );

  if (input.allowsDirectFollowUpCreation) {
    return input.compact
      ? "If accepted, Acre records an agent-approved follow-up creation and watches the shared task outcome later."
      : "If you accept one-click, Acre records an agent-approved AI action, creates the shared follow-up task only, and later reads the measurable outcome from task status or tracked engagement. It still cannot infer the actual client conversation result.";
  }

  if (crossesBackOfficeBoundary) {
    return input.compact
      ? "No new accepted action is recorded until you review the formal workflow transition."
      : "Because one-click is paused at the formal handoff point, Acre is not recording a new accepted action yet. The next auditable event is your review of the formal handoff path, not a hidden task creation.";
  }

  return input.compact
    ? "No new accepted action is recorded until you review the live task first."
    : "Because one-click is paused, Acre is not recording a new accepted action yet. The next auditable event is your review of the live task or current record state first, not a background reminder.";
}

function buildExplainabilityMeta(input: {
  allowsDirectFollowUpCreation: boolean;
  boundaryLabel: string;
  rankingSignals: string[];
}) {
  return [
    "Grounded in the current record",
    input.rankingSignals.length
      ? "Recent history changed priority"
      : "Priority follows the current record",
    `Current stage · ${input.boundaryLabel}`,
    input.allowsDirectFollowUpCreation
      ? "One-click · creates a shared follow-up only"
      : "One-click · review first",
    input.allowsDirectFollowUpCreation
      ? "Outcome · tracked after you accept it"
      : "Outcome · waits for your review",
    "No auto-send",
  ];
}

function ExplainabilitySignals(props: {
  emptyMessage: string;
  signals: string[];
}) {
  if (!props.signals.length) {
    return <p>{props.emptyMessage}</p>;
  }

  return (
    <div className="list-row-meta front-office-record-meta">
      {props.signals.map((signal) => (
        <span key={signal}>{signal}</span>
      ))}
    </div>
  );
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

function buildStrategyDraftCopyValue(rule: ExplainabilityStrategyRule) {
  return rule.draftSubjectLine.trim()
    ? `Subject: ${rule.draftSubjectLine}\n\n${rule.draftBody}`
    : rule.draftBody;
}

export function FrontOfficeAiExplainabilitySurface(props: {
  helperText?: string;
  playbookSummary?: string;
  playbookSteps?: ExplainabilityPlaybookStep[];
  strategySummary?: string;
  strategySignals?: string[];
  strategyRules?: ExplainabilityStrategyRule[];
  whyNowSignals: string[];
  rankingSignals: string[];
  boundaryLabel: string;
  boundaryTone: ExplainabilityTone;
  boundaryDescription: string;
  primaryActionReason: string;
  oneClickReason: string;
  allowsDirectFollowUpCreation: boolean;
  compact?: boolean;
}) {
  const manualConfirmationReason = buildManualConfirmationReason({
    allowsDirectFollowUpCreation: props.allowsDirectFollowUpCreation,
    boundaryLabel: props.boundaryLabel,
    compact: props.compact,
  });
  const acceptedOutcomeReason = buildAcceptedOutcomeReason({
    allowsDirectFollowUpCreation: props.allowsDirectFollowUpCreation,
    boundaryLabel: props.boundaryLabel,
    compact: props.compact,
  });
  const helperMeta = buildExplainabilityMeta({
    allowsDirectFollowUpCreation: props.allowsDirectFollowUpCreation,
    boundaryLabel: props.boundaryLabel,
    rankingSignals: props.rankingSignals,
  });
  const playbookSteps = props.playbookSteps ?? [];
  const strategyRules = props.strategyRules ?? [];
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  async function handleCopyDraft(rule: ExplainabilityStrategyRule) {
    try {
      await copyTextToClipboard(buildStrategyDraftCopyValue(rule));
      setCopyFeedback(`${rule.draftLabel} copied for manual review.`);
    } catch {
      setCopyFeedback(
        "Clipboard access is not available for the strategy draft.",
      );
    }
  }

  return (
    <div
      className={`front-office-ai-explainability ${
        props.compact ? "is-compact" : ""
      }`}
    >
      {props.helperText ? (
        <div className="front-office-ai-explainability-block">
          <span className="front-office-ai-explainability-kicker">
            Suggested next step
          </span>
          <p>{props.helperText}</p>
          <div className="list-row-meta front-office-record-meta">
            {helperMeta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      ) : null}

      {playbookSteps.length ? (
        <div className="front-office-ai-explainability-block front-office-playbook-surface">
          <div className="front-office-ai-explainability-head">
            <span className="front-office-ai-explainability-kicker">
              Suggested playbook
            </span>
            <StatusBadge tone="accent">Do / prepare / watch</StatusBadge>
          </div>
          <p>
            {props.playbookSummary ??
              "Acre turns the current guidance into step cards so the next move, preparation, and watchpoint stay visible before anyone accepts a follow-up."}
          </p>
          <div className="front-office-playbook-grid">
            {playbookSteps.map((step) => (
              <article className="front-office-playbook-card" key={step.id}>
                <div className="front-office-playbook-card-head">
                  <div>
                    <strong>{step.title}</strong>
                    <span>
                      {step.stepLabel} · {step.statusLabel}
                    </span>
                  </div>
                  <StatusBadge tone={step.tone}>
                    {step.contextLabel}
                  </StatusBadge>
                </div>

                <p>{step.detailLabel}</p>

                <div className="list-row-meta front-office-record-meta">
                  <span>{step.doNowLabel}</span>
                  <span>{step.prepareLabel}</span>
                  <span>{step.watchLabel}</span>
                </div>

                <div className="front-office-playbook-actions">
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={step.primaryActionHref}
                  >
                    {step.primaryActionLabel}
                  </FrontOfficeLink>
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={step.secondaryActionHref}
                  >
                    {step.secondaryActionLabel}
                  </FrontOfficeLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {props.strategySummary ? (
        <div className="front-office-ai-explainability-block">
          <div className="front-office-ai-explainability-head">
            <span className="front-office-ai-explainability-kicker">
              Strategy summary
            </span>
            <StatusBadge tone="accent">Review first</StatusBadge>
          </div>
          <p>{props.strategySummary}</p>
          <ExplainabilitySignals
            emptyMessage="No extra strategy signals are surfaced yet, so Acre is still leaning on the current record and its normal safety checks."
            signals={props.strategySignals ?? []}
          />
        </div>
      ) : null}

      {strategyRules.length ? (
        <div className="front-office-ai-explainability-block front-office-playbook-surface">
          <div className="front-office-ai-explainability-head">
            <span className="front-office-ai-explainability-kicker">
              Ready-to-review drafts
            </span>
            <StatusBadge tone="accent">Copy-ready</StatusBadge>
          </div>
          <p>
            Each draft includes a review checklist so the next message can stay
            manual and explicit.
          </p>
          {copyFeedback ? <p>{copyFeedback}</p> : null}
          <div className="front-office-playbook-grid">
            {strategyRules.map((rule) => (
              <article
                className="front-office-playbook-card"
                key={`${rule.id}-draft`}
              >
                <div className="front-office-playbook-card-head">
                  <div>
                    <strong>{rule.draftLabel}</strong>
                    <span>
                      {rule.statusLabel} · {rule.draftChannelLabel}
                    </span>
                  </div>
                  <StatusBadge tone={rule.tone}>{rule.title}</StatusBadge>
                </div>
                <pre className="front-office-playbook-template-body">
                  {buildStrategyDraftCopyValue(rule)}
                </pre>
                <div className="front-office-playbook-template-list">
                  {rule.reviewChecklist.map((item) => (
                    <article
                      className="front-office-playbook-template"
                      key={`${rule.id}-${item}`}
                    >
                      <div className="front-office-playbook-template-head">
                        <strong>{item}</strong>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="front-office-playbook-actions">
                  <Button
                    onClick={() => void handleCopyDraft(rule)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Copy draft
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="front-office-ai-explainability-grid">
        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            Why this surfaced now
          </span>
          <ExplainabilitySignals
            emptyMessage="Acre is still grounding this in the current record: stage, timing, and open work all support a next step even when one signal is not dominant yet."
            signals={props.whyNowSignals}
          />
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            What recent history changed
          </span>
          <ExplainabilitySignals
            emptyMessage="No recent accepted action is materially changing the ranking yet, so Acre is following current pressure plus its normal safety rules."
            signals={props.rankingSignals}
          />
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            Why Acre recommends this step
          </span>
          <p>{props.primaryActionReason}</p>
        </article>

        <article className="front-office-ai-explainability-card">
          <div className="front-office-ai-explainability-head">
            <span className="front-office-ai-explainability-kicker">
              Current workflow
            </span>
            <StatusBadge tone={props.boundaryTone}>
              {props.boundaryLabel}
            </StatusBadge>
          </div>
          <p>{props.boundaryDescription}</p>
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            {props.allowsDirectFollowUpCreation
              ? "Why quick create is safe"
              : "Why quick create is paused"}
          </span>
          <p>{props.oneClickReason}</p>
          <p>{acceptedOutcomeReason}</p>
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            Why review still matters
          </span>
          <p>{manualConfirmationReason}</p>
        </article>
      </div>
    </div>
  );
}
