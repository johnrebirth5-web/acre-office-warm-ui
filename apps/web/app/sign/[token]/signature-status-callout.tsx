"use client";

type Tone = "info" | "success" | "warning" | "error";
type IconName = "clock" | "check" | "x" | "question" | "timer";

type Props = {
  tone: Tone;
  icon?: IconName;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
    download?: boolean;
  };
  className?: string;
};

function SignatureStatusIcon({
  icon = "question",
}: {
  tone: Tone;
  icon?: IconName;
}) {
  switch (icon) {
    case "clock":
      return (
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="20"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5l3.25 2.25" />
        </svg>
      );
    case "check":
      return (
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="20"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.75-5" />
        </svg>
      );
    case "x":
      return (
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="20"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6" />
          <path d="m15 9-6 6" />
        </svg>
      );
    case "timer":
      return (
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M10 3h4" />
          <path d="M12 8v5l2.5 2" />
          <circle cx="12" cy="14" r="7" />
        </svg>
      );
    default:
      return (
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="20"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.25a2.75 2.75 0 1 1 4.57 2.05c-.73.63-1.57 1.21-1.57 2.45" />
          <circle cx="12" cy="16.85" r=".85" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function SignatureStatusCallout({
  tone,
  icon,
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={[
        "public-signature-callout",
        `public-signature-callout-${tone}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      <span className="public-signature-callout-icon" aria-hidden="true">
        <SignatureStatusIcon icon={icon} tone={tone} />
      </span>
      <div className="public-signature-callout-body">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
        {action ? (
          <a
            className="public-signature-callout-action"
            download={action.download}
            href={action.href}
          >
            {action.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
