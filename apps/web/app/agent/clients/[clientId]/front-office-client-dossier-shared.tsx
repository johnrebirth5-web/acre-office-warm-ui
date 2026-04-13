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

export const frontOfficeClientDossierSectionLabels = {
  nextStepRail: "Next steps",
  appointmentsFollowUp: "Appointments & follow-up",
  listingOutput: "Listing output",
  offerPrep: "Offer & negotiation",
  inspectionSupport: "Inspection & contract support",
  closingSuggestion: "Closing & win suggestions",
  backOfficeContext: "Formal workflow",
} as const;

export const frontOfficeClientDossierSectionDescriptions = {
  nextStepRail:
    "Use this section to explain the current focus, the next best move, and how to continue work from the same client file.",
  appointmentsFollowUp:
    "Use this section when the next touch belongs to calls, reminders, confirmations, reschedules, or live client coordination.",
  listingOutput:
    "Use this section when the next move is about tracked sends, rescues, open counts, or follow-through on a previous shortlist.",
  offerPrep:
    "Use this section when negotiation is active, Front Office still owns the client-facing coaching, and the same file needs to connect to the formal Back Office offer record without losing the client-ready recap.",
  inspectionSupport:
    "Use this section when the formal transaction is live, Front Office still owns the client-facing explanation, and this page should reopen the Back Office checklist instead of creating a second tracker.",
  closingSuggestion:
    "Use this section when the deal is closing, closed, or paused, and this page should turn the formal outcome into a next move, a post-close touch, or a respectful restart plan.",
  backOfficeContext:
    "Use this section when you need to explain why the formal Back Office record should take over, which work still belongs in Front Office, and what the client-ready summary should show next.",
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

export function getFrontOfficeClientDossierSectionLabel(stepId: string) {
  switch (stepId) {
    case "follow_up":
    case "appointment":
      return frontOfficeClientDossierSectionLabels.appointmentsFollowUp;
    case "listing_output":
      return frontOfficeClientDossierSectionLabels.listingOutput;
    case "offer_prep":
      return frontOfficeClientDossierSectionLabels.offerPrep;
    case "inspection_support":
      return frontOfficeClientDossierSectionLabels.inspectionSupport;
    case "closing_suggestion":
      return frontOfficeClientDossierSectionLabels.closingSuggestion;
    default:
      return frontOfficeClientDossierSectionLabels.nextStepRail;
  }
}

export function getFrontOfficeClientDossierSectionDescription(stepId: string) {
  switch (stepId) {
    case "follow_up":
    case "appointment":
      return frontOfficeClientDossierSectionDescriptions.appointmentsFollowUp;
    case "listing_output":
      return frontOfficeClientDossierSectionDescriptions.listingOutput;
    case "offer_prep":
      return frontOfficeClientDossierSectionDescriptions.offerPrep;
    case "inspection_support":
      return frontOfficeClientDossierSectionDescriptions.inspectionSupport;
    case "closing_suggestion":
      return frontOfficeClientDossierSectionDescriptions.closingSuggestion;
    default:
      return frontOfficeClientDossierSectionDescriptions.nextStepRail;
  }
}

export function buildFrontOfficeClientFollowUpHref(input: {
  clientId: string;
  title?: string | null;
  dueAt?: string | null;
  source?: string | null;
}) {
  const params = new URLSearchParams();
  const title = input.title?.trim();
  const dueAt =
    typeof input.dueAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueAt)
      ? input.dueAt
      : "";
  const source = input.source?.trim();

  if (title) {
    params.set("followUpTitle", title);
  }

  if (dueAt) {
    params.set("followUpDueAt", dueAt);
  }

  if (source) {
    params.set("followUpSource", source);
  }

  const query = params.toString();

  return `/agent/clients/${input.clientId}${query ? `?${query}` : ""}#front-office-follow-up-form`;
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
    <div
      className={props.className ?? "list-row-meta front-office-record-meta"}
    >
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
