import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@acre/ui";

function cx(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--office-text)",
  fontSize: "0.96rem",
  lineHeight: 1.2,
  letterSpacing: "-0.02em"
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#556a83",
  fontSize: "0.92rem",
  lineHeight: 1.45
};

const contextStyle: CSSProperties = {
  color: "#667c93",
  fontSize: "0.78rem",
  fontWeight: 700,
  lineHeight: 1.35
};

const metaStyle: CSSProperties = {
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.8rem",
  lineHeight: 1.35
};

const actionStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px"
};

export function FrontOfficeRailItem(props: {
  badgeLabel: string;
  badgeTone?: "neutral" | "accent" | "success" | "warning" | "danger";
  title: string;
  description: string;
  meta?: ReactNode;
  context?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("office-queue-item", props.className)}>
      <div className="office-queue-item-top">
        <Badge tone={props.badgeTone ?? "neutral"}>{props.badgeLabel}</Badge>
        {props.context ? <span style={contextStyle}>{props.context}</span> : null}
      </div>
      <strong style={titleStyle}>{props.title}</strong>
      <p style={descriptionStyle}>{props.description}</p>
      {props.meta ? (
        <div className="office-queue-meta" style={metaStyle}>
          {props.meta}
        </div>
      ) : null}
      {props.action ? <div style={actionStyle}>{props.action}</div> : null}
    </article>
  );
}
