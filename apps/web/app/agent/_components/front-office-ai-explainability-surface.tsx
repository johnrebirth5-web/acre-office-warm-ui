import { StatusBadge } from "@acre/ui";

type ExplainabilityTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

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
          <div className="list-row-meta front-office-record-meta">
            {props.whyNowSignals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </article>

        {props.rankingSignals.length ? (
          <article className="front-office-ai-explainability-card">
            <span className="front-office-ai-explainability-kicker">
              What changed the priority
            </span>
            <div className="list-row-meta front-office-record-meta">
              {props.rankingSignals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          </article>
        ) : null}

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
              ? "One-click policy"
              : "Why one-click is paused"}
          </span>
          <p>{props.oneClickReason}</p>
        </article>
      </div>
    </div>
  );
}
