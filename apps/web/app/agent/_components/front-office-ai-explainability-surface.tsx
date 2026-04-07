import { StatusBadge } from "@acre/ui";

type ExplainabilityTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

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
      ? "A human still decides whether this becomes a formal BO transition or stays a client-facing clarification."
      : "Acre can point to the FO -> BO boundary, but it cannot confirm that package readiness, client intent, or office ownership actually changed off-record. A human still decides whether this becomes a formal Back Office transition or stays a Front Office clarification.";
  }

  if (!input.allowsDirectFollowUpCreation) {
    return input.compact
      ? "A paused one-click state means the live task or record still needs human review first."
      : "A paused one-click state means Acre can see unresolved accepted work or a live record that still needs review. It protects the current execution trail instead of quietly stacking a second task or pretending the existing one no longer matters.";
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
      ? "No new accepted action is recorded until you review the FO -> BO transition."
      : "Because one-click is paused at the FO -> BO boundary, Acre is not recording a new accepted action yet. The next auditable event is your review of the formal handoff path, not a hidden task creation.";
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
    "Grounded in live record state",
    input.rankingSignals.length
      ? "Accepted history changed priority"
      : "Priority follows live record pressure",
    `Boundary · ${input.boundaryLabel}`,
    input.allowsDirectFollowUpCreation
      ? "One-click · creates shared task only"
      : "One-click · paused for review",
    input.allowsDirectFollowUpCreation
      ? "Accepted outcome · tracked after explicit acceptance"
      : "Accepted outcome · waiting on human review",
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

  return (
    <div
      className={`front-office-ai-explainability ${
        props.compact ? "is-compact" : ""
      }`}
    >
      {props.helperText ? (
        <div className="front-office-ai-explainability-block">
          <span className="front-office-ai-explainability-kicker">
            Execution judgment
          </span>
          <p>{props.helperText}</p>
          <div className="list-row-meta front-office-record-meta">
            {helperMeta.map((item) => (
              <span key={item}>{item}</span>
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
            emptyMessage="Acre is still grounding this in the live record: current stage, timing window, and open workflow pressure all support a next step even when one signal is not dominant yet."
            signals={props.whyNowSignals}
          />
        </article>

        <article className="front-office-ai-explainability-card">
          <span className="front-office-ai-explainability-kicker">
            How accepted history changed priority
          </span>
          <ExplainabilitySignals
            emptyMessage="No accepted-action history is materially changing rank yet, so Acre is following live-record pressure plus default safety guardrails instead of claiming a learned preference."
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
            {props.allowsDirectFollowUpCreation
              ? "Why one-click is safe"
              : "Why one-click is paused"}
          </span>
          <p>{props.oneClickReason}</p>
          <p>{acceptedOutcomeReason}</p>
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
