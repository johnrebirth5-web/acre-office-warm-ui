import { StatusBadge } from "@acre/ui";

type ExplainabilityTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

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
  return (
    <div
      className={`front-office-ai-explainability ${
        props.compact ? "is-compact" : ""
      }`}
    >
      {props.helperText ? (
        <div className="front-office-ai-explainability-block">
          <span className="front-office-ai-explainability-kicker">
            Why Acre is suggesting this
          </span>
          <p>{props.helperText}</p>
        </div>
      ) : null}

      <div className="front-office-ai-explainability-grid">
        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">Why now</span>
          <ExplainabilitySignals
            emptyMessage="Acre is grounding this suggestion in the live dossier and current workflow timing."
            signals={props.whyNowSignals}
          />
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            What changed the priority
          </span>
          <ExplainabilitySignals
            emptyMessage="No accepted-action history is changing this ranking yet, so Acre is leaning on the live record state instead."
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
            Why this action is next
          </span>
          <p>{props.primaryActionReason}</p>
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            {props.allowsDirectFollowUpCreation
              ? "Why one-click is allowed"
              : "Why one-click is paused"}
          </span>
          <p>{props.oneClickReason}</p>
        </article>
      </div>
    </div>
  );
}
