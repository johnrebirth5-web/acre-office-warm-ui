"use client";

import { useState } from "react";
import type {
  FrontOfficeAgentMaterialSnapshot,
  FrontOfficeListingsTargetAppointment,
  FrontOfficeListingsTargetClient,
} from "@acre/db";
import { Button, EmptyState, QueueItem } from "@acre/ui";
import { FrontOfficeLink } from "../_components/front-office-link";
import type { FrontOfficeListingsRouteState } from "./front-office-listings-route-state";

type FrontOfficeAgentMaterialWindowProps = {
  material: FrontOfficeAgentMaterialSnapshot;
  routeState: FrontOfficeListingsRouteState;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
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

function buildMaterialBundle(input: {
  material: FrontOfficeAgentMaterialSnapshot;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  if (input.targetClient && input.targetAppointment) {
    return {
      title: `Appointment send bundle for ${input.targetClient.fullName}`,
      description:
        "Use this bundle when the listing needs to travel with identity, proof, and appointment continuity instead of as a naked link.",
      steps: [
        {
          id: "bundle-listing",
          badgeLabel: "Step 1",
          badgeTone: "accent" as const,
          title: "Send the tracked listing",
          description: `Tie the send back to ${input.targetClient.stage} and ${input.targetAppointment.title} so the follow-up stays visible in one trail.`,
        },
        {
          id: "bundle-intro",
          badgeLabel: "Step 2",
          badgeTone: "success" as const,
          title: "Attach intro text",
          description:
            "Lead with the short intro so the client can reply quickly without losing the tracked link context.",
        },
        {
          id: "bundle-proof",
          badgeLabel: "Step 3",
          badgeTone: "warning" as const,
          title: "Add one proof point",
          description:
            input.material.featuredCaseCount > 0
              ? "Include one recent closing if the client still needs confidence before or after the appointment."
              : "Use the business card and profile identity so the send still carries credibility even without featured closings.",
        },
      ],
    };
  }

  if (input.targetClient) {
    return {
      title: `Client send bundle for ${input.targetClient.fullName}`,
      description:
        "Keep the listing, intro copy, and agent proof together so the client can move from interest into the next touch without extra explanation.",
      steps: [
        {
          id: "bundle-email",
          badgeLabel: "Lead",
          badgeTone: "accent" as const,
          title: "Choose the right intro",
          description:
            "Use intro email when the client needs more framing, or intro text when you want a quick reaction beside the tracked listing link.",
        },
        {
          id: "bundle-card",
          badgeLabel: "Identity",
          badgeTone: "success" as const,
          title: "Keep the business card nearby",
          description:
            "If the listing is forwarded or reopened later, the contact details should still travel with it.",
        },
        {
          id: "bundle-proof",
          badgeLabel: "Proof",
          badgeTone: "warning" as const,
          title: "Bring proof only when it helps",
          description:
            input.material.featuredCaseCount > 0
              ? "Use a featured closing when the client is active but needs confidence, not on every first touch."
              : "You have no featured closing package yet, so lead with identity and a clear next-step ask instead.",
        },
      ],
    };
  }

  return {
    title: "Generic outbound material bundle",
    description:
      "When no client context is selected, keep materials organized so the next tracked send can become client-linked without rebuilding the package from scratch.",
    steps: [
      {
        id: "bundle-generic-link",
        badgeLabel: "Tracked",
        badgeTone: "accent" as const,
        title: "Start with the tracked listing link",
        description:
          "Generic mode still tracks the link, but it does not create a client send trail until you reopen listing output from a dossier or appointment.",
      },
      {
        id: "bundle-generic-intro",
        badgeLabel: "Context",
        badgeTone: "success" as const,
        title: "Pair it with identity",
        description:
          "Keep the business card, intro email, and intro text ready so the next outreach does not feel like raw inventory.",
      },
      {
        id: "bundle-generic-proof",
        badgeLabel: "Proof",
        badgeTone: "warning" as const,
        title: "Use proof selectively",
        description:
          input.material.featuredCaseCount > 0
            ? "Featured cases are best used after there is already some engagement, not as a replacement for basic context."
            : "Build the send around agent identity first while the proof package is still light.",
      },
    ],
  };
}

function buildMaterialWindowStatus(props: FrontOfficeAgentMaterialWindowProps) {
  if (props.targetClient && props.targetAppointment) {
    return {
      badgeLabel: "Appointment-linked",
      badgeTone: "accent" as const,
      title: `Bundle stays aligned to ${props.targetClient.fullName}`,
      description: `Use the business card, intro copy, and proof package beside ${props.targetAppointment.title} so the send keeps both client identity and appointment continuity in one loop.`,
    };
  }

  if (props.targetClient) {
    return {
      badgeLabel: "Client-linked",
      badgeTone: "success" as const,
      title: `Bundle stays aligned to ${props.targetClient.fullName}`,
      description:
        "Everything copied from this window should travel with the client-linked send trail instead of becoming detached profile material.",
    };
  }

  return {
    badgeLabel: "Tracked link",
    badgeTone: "warning" as const,
    title: "Generic outbound bundle",
    description:
      "Keep identity and proof ready here so the next tracked listing can turn into a client-linked package without rebuilding the copy from scratch.",
  };
}

export function FrontOfficeAgentMaterialWindow(
  props: FrontOfficeAgentMaterialWindowProps,
) {
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const bundle = buildMaterialBundle({
    material: props.material,
    targetClient: props.targetClient,
    targetAppointment: props.targetAppointment,
  });
  const materialStatus = buildMaterialWindowStatus(props);

  async function handleCopy(label: string, value: string) {
    try {
      await copyTextToClipboard(value);
      setFeedback({
        tone: "success",
        message: `${label} copied. The next client touch can use it immediately.`,
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "Clipboard access is not available in this browser. Copy the material manually instead.",
      });
    }
  }

  return (
    <div className="office-list-page-stack">
      <div className="front-office-agent-material-card">
        <div className="front-office-agent-material-head">
          {props.material.avatarUrl ? (
            <img
              alt={`${props.material.displayName} avatar`}
              className="front-office-agent-material-avatar"
              src={props.material.avatarUrl}
            />
          ) : (
            <div className="front-office-agent-material-avatar front-office-agent-material-avatar-fallback">
              <span>{props.material.avatarFallback}</span>
            </div>
          )}

          <div className="front-office-agent-material-copy">
            <strong>{props.material.displayName}</strong>
            <span>{props.material.titleLabel}</span>
            <span>{props.material.officeLabel}</span>
          </div>
        </div>

        <p>{props.material.bioLabel}</p>

        <div className="front-office-agent-material-meta">
          <span>
            {props.material.portraitReady
              ? "Portrait ready"
              : "Portrait missing"}
          </span>
          <span>{props.material.licenseLabel}</span>
          <span>{props.material.recentClosedCount} recent closings</span>
          <span>{props.material.featuredCaseCount} featured case(s)</span>
        </div>

        <div className="front-office-agent-material-actions">
          <Button
            onClick={() =>
              void handleCopy("Business card", props.material.businessCardText)
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            Copy business card
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Intro email", props.material.introEmailText)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy intro email
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Intro text", props.material.introTextMessage)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy intro text
          </Button>
        </div>

        {feedback ? (
          <p
            className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>Bundle status</strong>
          <span>
            Keep the material package aligned with the current send mode so the
            listing does not travel without identity or proof context.
          </span>
        </div>
        <div className="office-queue-list">
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                {props.targetClient ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.targetClient.href}
                  >
                    Open client dossier
                  </FrontOfficeLink>
                ) : null}
                {props.targetAppointment ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.targetAppointment.href}
                  >
                    Open appointment
                  </FrontOfficeLink>
                ) : null}
                {props.routeState.hasDraftAssist ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.contextHref}
                  >
                    Clear draft assist
                  </FrontOfficeLink>
                ) : null}
                {props.routeState.diagnostics.length ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.cleanHref}
                  >
                    Open clean route
                  </FrontOfficeLink>
                ) : null}
              </div>
            }
            badgeLabel={materialStatus.badgeLabel}
            badgeTone={materialStatus.badgeTone}
            context={`${props.routeState.modeContextLabel} · ${props.routeState.draftStatusLabel}`}
            description={materialStatus.description}
            meta={
              <span>
                {props.material.featuredCaseCount > 0
                  ? `${props.material.featuredCaseCount} featured case(s) ready`
                  : "Proof package is still light"}
              </span>
            }
            title={materialStatus.title}
          />
        </div>
      </div>

      <div className="front-office-placeholder-note front-office-playbook-surface">
        <div className="front-office-playbook-header">
          <strong>{bundle.title}</strong>
          <p>{bundle.description}</p>
        </div>
        <div className="office-queue-list">
          {bundle.steps.map((step) => (
            <QueueItem
              badgeLabel={step.badgeLabel}
              badgeTone={step.badgeTone}
              description={step.description}
              key={step.id}
              title={step.title}
            />
          ))}
        </div>
      </div>

      <div className="front-office-playbook-grid">
        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Identity package</strong>
            <span>
              The listing should never leave this page without agent identity
              close by.
            </span>
          </div>
          <div className="office-queue-list">
            <QueueItem
              action={
                <div className="front-office-playbook-actions">
                  <Button
                    onClick={() =>
                      void handleCopy(
                        "Business card",
                        props.material.businessCardText,
                      )
                    }
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Copy card
                  </Button>
                  {props.material.phone ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={`tel:${props.material.phone}`}
                    >
                      Call
                    </FrontOfficeLink>
                  ) : null}
                  {props.material.email ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={`mailto:${props.material.email}`}
                    >
                      Email
                    </FrontOfficeLink>
                  ) : null}
                </div>
              }
              badgeLabel="Card"
              badgeTone="accent"
              description={
                props.material.phone
                  ? `Phone on record: ${props.material.phone}`
                  : "No direct phone on record yet."
              }
              meta={
                <span>{props.material.email || "Email not published"}</span>
              }
              title="Business card + contact details"
            />
            <QueueItem
              badgeLabel={props.material.portraitReady ? "Ready" : "Missing"}
              badgeTone={props.material.portraitReady ? "success" : "warning"}
              description={
                props.material.portraitReady
                  ? "Portrait and profile identity are ready to support send-ready output."
                  : "Portrait asset is still missing, so rely more on business card and proof package when sending."
              }
              meta={<span>{props.material.licenseLabel}</span>}
              title="Portrait + license status"
            />
          </div>
        </div>

        <div className="front-office-playbook-card">
          <div className="front-office-playbook-card-head">
            <strong>Proof package</strong>
            <span>
              Featured cases should help the next decision, not create more
              noise.
            </span>
          </div>
          <div className="office-queue-list">
            {props.material.featuredCases.length ? (
              props.material.featuredCases.map((item) => (
                <QueueItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={item.href}
                    >
                      Open transaction
                    </FrontOfficeLink>
                  }
                  badgeLabel={item.closingLabel}
                  badgeTone="success"
                  description={item.priceLabel}
                  key={item.id}
                  title={item.label}
                />
              ))
            ) : (
              <EmptyState
                action={
                  <Button
                    onClick={() =>
                      void handleCopy(
                        "Business card",
                        props.material.businessCardText,
                      )
                    }
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Copy business card
                  </Button>
                }
                description="Closed transactions will surface here as featured cases once this profile has recent wins to reference."
                title="No featured cases yet"
              />
            )}
          </div>
        </div>
      </div>

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>Copy-ready intro package</strong>
          <span>
            Keep identity and tone ready so the tracked listing can move with a
            credible opening line.
          </span>
        </div>

        <div className="front-office-playbook-template-list">
          <article className="front-office-playbook-template">
            <div className="front-office-playbook-template-head">
              <div>
                <strong>Business card</strong>
                <span>Identity anchor</span>
              </div>
              <Button
                onClick={() =>
                  void handleCopy(
                    "Business card",
                    props.material.businessCardText,
                  )
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Copy package
              </Button>
            </div>
            <pre className="front-office-playbook-template-body">
              {props.material.businessCardText}
            </pre>
          </article>

          <article className="front-office-playbook-template">
            <div className="front-office-playbook-template-head">
              <div>
                <strong>Intro email</strong>
                <span>Best when the client needs framing</span>
              </div>
              <Button
                onClick={() =>
                  void handleCopy("Intro email", props.material.introEmailText)
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Copy package
              </Button>
            </div>
            <pre className="front-office-playbook-template-body">
              {props.material.introEmailText}
            </pre>
          </article>

          <article className="front-office-playbook-template">
            <div className="front-office-playbook-template-head">
              <div>
                <strong>Intro text</strong>
                <span>Best when the client needs a quick reply path</span>
              </div>
              <Button
                onClick={() =>
                  void handleCopy("Intro text", props.material.introTextMessage)
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Copy package
              </Button>
            </div>
            <pre className="front-office-playbook-template-body">
              {props.material.introTextMessage}
            </pre>
          </article>
        </div>
      </div>
    </div>
  );
}
