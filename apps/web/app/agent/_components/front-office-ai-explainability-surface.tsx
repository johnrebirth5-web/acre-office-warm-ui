import { StatusBadge } from "@acre/ui";

type ExplainabilityTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

function buildManualConfirmationReason(input: {
  allowsDirectFollowUpCreation: boolean;
  boundaryLabel: string;
  compact?: boolean;
}) {
  const boundaryMentionsBackOffice = input.boundaryLabel
    .toLowerCase()
    .includes("back office");

  if (!input.allowsDirectFollowUpCreation && boundaryMentionsBackOffice) {
    return input.compact
      ? "Acre sees a FO -> BO boundary here, so a human needs to confirm the transition before anything new is created."
      : "Acre sees a FO -> BO boundary here, so a human needs to confirm whether the next move is a formal Back Office transition or a client-facing follow-up. Acre is protecting the system-of-record boundary instead of stacking hidden automation.";
  }

  if (!input.allowsDirectFollowUpCreation) {
    return input.compact
      ? "A paused one-click state means Acre wants you to review the live task or record state before creating anything new."
      : "A paused one-click state means Acre wants you to review the live task or current record state before creating anything new. Acre is intentionally protecting the existing execution trail instead of silently adding another task in the background.";
  }

  return input.compact
    ? "Acre can create the reminder, but you still confirm timing, wording, and whether the client context changed."
    : "Acre can rank the next step and create a shared follow-up task, but it cannot confirm the latest client intent, outside delivery, or whether the conversation shifted since the last recorded touch. You still confirm timing, wording, channel, and whether the work should stay in Front Office.";
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

export function FrontOfficeAiExplainabilitySurface(props: {
  helperText?: string;
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

  return (
    <div
      className={`front-office-ai-explainability ${
        props.compact ? "is-compact" : ""
      }`}
    >
      {props.helperText ? (
        <div className="front-office-ai-explainability-block">
          <span className="front-office-ai-explainability-kicker">
            Grounded recommendation
          </span>
          <p>{props.helperText}</p>
          <div className="list-row-meta front-office-record-meta">
            <span>Grounded in live dossier state</span>
            <span>
              {props.rankingSignals.length
                ? "Outcome-informed ranking"
                : "History-safe default ranking"}
            </span>
            <span>
              {props.allowsDirectFollowUpCreation
                ? "One-click creates a task only"
                : "One-click held for review"}
            </span>
            <span>Agent confirmation still required</span>
          </div>
        </div>
      ) : null}

      <div className="front-office-ai-explainability-grid">
        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            Why now in the live record
          </span>
          <ExplainabilitySignals
            emptyMessage="Acre is grounding this suggestion in the live dossier and current execution timing, even when no single signal dominates yet."
            signals={props.whyNowSignals}
          />
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            What changed the rank
          </span>
          <ExplainabilitySignals
            emptyMessage="No accepted-action history is reordering this yet, so queue priority is currently following live record pressure and default safety rules."
            signals={props.rankingSignals}
          />
        </article>

        <article className="front-office-ai-explainability-card">
          <div className="front-office-ai-explainability-head">
            <span className="front-office-ai-explainability-kicker">
              Execution boundary
            </span>
            <StatusBadge tone={props.boundaryTone}>
              {props.boundaryLabel}
            </StatusBadge>
          </div>
          <p>{props.boundaryDescription}</p>
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            Why Acre recommends this next step
          </span>
          <p>{props.primaryActionReason}</p>
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            {props.allowsDirectFollowUpCreation
              ? "Why one-click is safe"
              : "Why one-click is paused"}
          </span>
          <p>{props.oneClickReason}</p>
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            Why manual confirmation still matters
          </span>
          <p>{manualConfirmationReason}</p>
        </article>
      </div>
    </div>
  );
}
