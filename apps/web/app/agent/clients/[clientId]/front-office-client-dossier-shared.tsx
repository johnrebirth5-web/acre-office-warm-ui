import type { ReactNode } from "react";
import { QueueItem } from "@acre/ui";
import { FrontOfficeLink } from "../../_components/front-office-link";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export const frontOfficeClientDossierSectionIds = {
  nextStepRail: "front-office-client-next-step-rail",
  appointmentsFollowUp: "front-office-client-appointments-follow-up",
  listingOutput: "front-office-client-listing-output",
  offerPrep: "front-office-client-offer-prep",
  inspectionSupport: "front-office-client-inspection-support",
  closingSuggestion: "front-office-client-closing-suggestion",
  backOfficeContext: "front-office-client-back-office-context",
} as const;

export type FrontOfficeClientActionDescriptor = {
  href?: string | null;
  label: string;
  opensInNewTab?: boolean;
  className?: string;
};

export type FrontOfficeClientGuidanceItem = {
  key?: string;
  label: ReactNode;
  tone?: BadgeTone;
  title: ReactNode;
  description: ReactNode;
  context?: ReactNode;
  meta?: ReactNode;
  actions?: FrontOfficeClientActionDescriptor[];
};

function isHttpHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

function isExternalLikeHref(href: string) {
  return (
    isHttpHref(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("sms:")
  );
}

export function getFrontOfficeClientDossierSectionHref(stepId: string) {
  switch (stepId) {
    case "follow_up":
    case "appointment":
      return `#${frontOfficeClientDossierSectionIds.appointmentsFollowUp}`;
    case "listing_output":
      return `#${frontOfficeClientDossierSectionIds.listingOutput}`;
    case "offer_prep":
      return `#${frontOfficeClientDossierSectionIds.offerPrep}`;
    case "inspection_support":
      return `#${frontOfficeClientDossierSectionIds.inspectionSupport}`;
    case "closing_suggestion":
      return `#${frontOfficeClientDossierSectionIds.closingSuggestion}`;
    default:
      return `#${frontOfficeClientDossierSectionIds.nextStepRail}`;
  }
}

export function FrontOfficeClientActionLink(
  props: FrontOfficeClientActionDescriptor,
) {
  const href = props.href?.trim();

  if (!href) {
    return null;
  }

  const className = props.className ?? "office-inline-link";
  const shouldOpenNewTab = props.opensInNewTab || isHttpHref(href);

  if (href.startsWith("#") || isExternalLikeHref(href) || shouldOpenNewTab) {
    return (
      <a
        className={className}
        href={href}
        rel={shouldOpenNewTab ? "noreferrer" : undefined}
        target={shouldOpenNewTab ? "_blank" : undefined}
      >
        {props.label}
      </a>
    );
  }

  return (
    <FrontOfficeLink className={className} href={href}>
      {props.label}
    </FrontOfficeLink>
  );
}

export function FrontOfficeClientActionGroup(props: {
  actions: FrontOfficeClientActionDescriptor[];
  className?: string;
}) {
  const actions = props.actions.filter((action) => action.href?.trim());

  if (!actions.length) {
    return null;
  }

  return (
    <div className={props.className ?? "list-row-meta front-office-record-meta"}>
      {actions.map((action) => (
        <FrontOfficeClientActionLink
          className={action.className}
          href={action.href}
          key={`${action.label}-${action.href}`}
          label={action.label}
          opensInNewTab={action.opensInNewTab}
        />
      ))}
    </div>
  );
}

export function FrontOfficeClientGuidanceQueue(props: {
  items: FrontOfficeClientGuidanceItem[];
}) {
  return (
    <div className="office-queue-list">
      {props.items.map((item, index) => (
        <QueueItem
          action={
            item.actions?.length ? (
              <FrontOfficeClientActionGroup actions={item.actions} />
            ) : undefined
          }
          badgeLabel={item.label}
          badgeTone={item.tone}
          context={item.context}
          description={item.description}
          key={item.key ?? index}
          meta={item.meta}
          title={item.title}
        />
      ))}
    </div>
  );
}
