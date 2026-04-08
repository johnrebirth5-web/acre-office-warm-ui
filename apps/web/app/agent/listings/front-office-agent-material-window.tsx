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
  detail?: string | null;
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

function buildFeaturedProofLine(material: FrontOfficeAgentMaterialSnapshot) {
  const featuredCase = material.featuredCases[0];

  if (!featuredCase) {
    return "No featured closing is ready yet, so lead with identity and a clear next-step ask instead of forcing proof into the first touch.";
  }

  return `Proof point: ${featuredCase.label} · ${featuredCase.priceLabel} · ${featuredCase.closingLabel}.`;
}

function buildSmsSupportPackage(input: {
  material: FrontOfficeAgentMaterialSnapshot;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  const contextLine = input.targetAppointment
    ? `Context: Use this with the tracked listing when following up on ${input.targetAppointment.title} (${input.targetAppointment.startsAtLabel}).`
    : input.targetClient
      ? `Context: Use this with the tracked listing while ${input.targetClient.fullName} is still in ${input.targetClient.stage}.`
      : "Context: Use this with the tracked listing when you need a quick intro plus identity in the same manual send.";

  return `${input.material.introTextMessage.trim()}\n\n${contextLine}\n${buildFeaturedProofLine(input.material)}\n\nBusiness card\n${input.material.businessCardText}`;
}

function buildEmailSupportPackage(input: {
  material: FrontOfficeAgentMaterialSnapshot;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  const contextLine = input.targetAppointment
    ? `Appointment context: tie the listing back to ${input.targetAppointment.title} so the next reply can stay anchored to the meeting loop.`
    : input.targetClient
      ? `Client context: keep the listing tied to ${input.targetClient.fullName}'s current ${input.targetClient.stage} search stage.`
      : "Client context: add the tracked listing to this note when the recipient needs more framing than a raw link.";

  return `${input.material.introEmailText.trim()}\n\n${contextLine}\n${buildFeaturedProofLine(input.material)}\n\nBusiness card\n${input.material.businessCardText}`;
}

function buildProofAddOnPackage(material: FrontOfficeAgentMaterialSnapshot) {
  if (!material.featuredCases.length) {
    return `Identity fallback\n${material.businessCardText}\n\nNo featured closing package is ready yet, so use the business card and intro copy as the credibility layer.`;
  }

  return [
    "Proof add-on",
    ...material.featuredCases.map(
      (item, index) =>
        `${index + 1}. ${item.label} · ${item.priceLabel} · ${item.closingLabel}`,
    ),
  ].join("\n");
}

function buildSupportPackageStatus(props: FrontOfficeAgentMaterialWindowProps) {
  if (props.routeState.preferredSupportLane === "sms") {
    return {
      badgeLabel: "SMS companion",
      badgeTone: "accent" as const,
      title: "SMS support package is the active companion",
      description: props.routeState.preferredSupportLaneDescription,
    };
  }

  if (props.routeState.preferredSupportLane === "email") {
    return {
      badgeLabel: "Email companion",
      badgeTone: "accent" as const,
      title: "Email support package is the active companion",
      description: props.routeState.preferredSupportLaneDescription,
    };
  }

  return {
    badgeLabel: "Keep both ready",
    badgeTone: "warning" as const,
    title: "Keep both support packages ready",
    description: props.routeState.preferredSupportLaneDescription,
  };
}

function buildPreferredSupportPackage(input: {
  routeState: FrontOfficeListingsRouteState;
  smsSupportPackage: string;
  emailSupportPackage: string;
}) {
  if (input.routeState.preferredSupportLane === "sms") {
    return {
      label: "Preferred companion",
      copyLabel: "Copy preferred package",
      title: "SMS companion package",
      value: input.smsSupportPackage,
    };
  }

  if (input.routeState.preferredSupportLane === "email") {
    return {
      label: "Preferred companion",
      copyLabel: "Copy preferred package",
      title: "Email companion package",
      value: input.emailSupportPackage,
    };
  }

  return null;
}

function buildMaterialCopyDetail(props: FrontOfficeAgentMaterialWindowProps) {
  if (props.targetAppointment && props.targetClient) {
    return `Use it beside ${props.targetAppointment.title} so the listing, identity, and appointment continuity stay in one manual send loop for ${props.targetClient.fullName}.`;
  }

  if (props.targetClient) {
    return `Use it beside the tracked listing so ${props.targetClient.fullName}'s next touch carries identity, context, and proof in one manual send.`;
  }

  return "Use it beside the tracked listing so the next outbound touch does not travel as a naked link.";
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
  const supportPackageStatus = buildSupportPackageStatus(props);
  const smsSupportPackage = buildSmsSupportPackage({
    material: props.material,
    targetClient: props.targetClient,
    targetAppointment: props.targetAppointment,
  });
  const emailSupportPackage = buildEmailSupportPackage({
    material: props.material,
    targetClient: props.targetClient,
    targetAppointment: props.targetAppointment,
  });
  const proofAddOnPackage = buildProofAddOnPackage(props.material);
  const preferredSupportPackage = buildPreferredSupportPackage({
    routeState: props.routeState,
    smsSupportPackage,
    emailSupportPackage,
  });

  async function handleCopy(label: string, value: string) {
    try {
      await copyTextToClipboard(value);
      setFeedback({
        tone: "success",
        message: `${label} copied. The next listing send can use it immediately.`,
        detail: buildMaterialCopyDetail(props),
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "Clipboard access is not available in this browser. Copy the material manually instead.",
        detail: null,
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
          {preferredSupportPackage ? (
            <Button
              onClick={() =>
                void handleCopy(
                  preferredSupportPackage.title,
                  preferredSupportPackage.value,
                )
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              {preferredSupportPackage.copyLabel}
            </Button>
          ) : null}
          <Button
            onClick={() =>
              void handleCopy("SMS support package", smsSupportPackage)
            }
            size="sm"
            type="button"
            variant={preferredSupportPackage ? "ghost" : "secondary"}
          >
            Copy SMS support
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Email support package", emailSupportPackage)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy email support
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Proof add-on", proofAddOnPackage)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy proof add-on
          </Button>
        </div>

        {feedback ? (
          <div
            className={`front-office-calendar-feedback ${feedback.tone === "error" ? "is-error" : "is-success"}`}
          >
            <strong>{feedback.message}</strong>
            {feedback.detail ? <span>{feedback.detail}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>Current send companion</strong>
          <span>
            Keep the material package aligned with the active listing lane so
            the send does not leave this page without identity or proof context.
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
                {props.routeState.hasDraftAssist ||
                props.routeState.diagnostics.length ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.stableHref}
                  >
                    Open stable workspace link
                  </FrontOfficeLink>
                ) : null}
                {props.routeState.diagnostics.length ||
                props.routeState.contextHref !== props.routeState.cleanHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.cleanHref}
                  >
                    Reset workspace
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
          {preferredSupportPackage ? (
            <QueueItem
              action={
                <Button
                  onClick={() =>
                    void handleCopy(
                      preferredSupportPackage.title,
                      preferredSupportPackage.value,
                    )
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {preferredSupportPackage.copyLabel}
                </Button>
              }
              badgeLabel={preferredSupportPackage.label}
              badgeTone="accent"
              context={props.routeState.draftStatusLabel}
              description={props.routeState.preferredSupportLaneDescription}
              title={preferredSupportPackage.title}
            />
          ) : null}
          <QueueItem
            badgeLabel={supportPackageStatus.badgeLabel}
            badgeTone={supportPackageStatus.badgeTone}
            context="Manual send support"
            description={supportPackageStatus.description}
            title={supportPackageStatus.title}
          />
          <QueueItem
            action={
              props.routeState.stableHref !== props.routeState.contextHref ? (
                <FrontOfficeLink
                  className="office-inline-link"
                  href={props.routeState.stableHref}
                >
                  {props.routeState.focusedRouteLaneActionLabel}
                </FrontOfficeLink>
              ) : null
            }
            badgeLabel={props.routeState.focusedRouteLanePanelLabel}
            badgeTone="accent"
            context={props.routeState.focusedRouteLaneLabel}
            description={props.routeState.focusedRouteLanePanelDescription}
            meta={
              <span>
                {props.routeState.focusedRouteLaneSteps
                  .map((step) => step.label)
                  .join(" · ")}
              </span>
            }
            title="Lane execution checklist"
          />
        </div>
      </div>

      <div className="front-office-playbook-card">
        <div className="front-office-playbook-card-head">
          <strong>Companion packages for listing lanes</strong>
          <span>
            These packages are meant to travel with the tracked listing send, so
            the copied lane leaves this workspace with identity, context, and
            proof.
          </span>
        </div>
        <div className="office-queue-list">
          <QueueItem
            action={
              <Button
                onClick={() =>
                  void handleCopy("SMS support package", smsSupportPackage)
                }
                size="sm"
                type="button"
                variant={
                  props.routeState.preferredSupportLane === "sms"
                    ? "secondary"
                    : "ghost"
                }
              >
                Copy SMS support
              </Button>
            }
            badgeLabel="SMS"
            badgeTone="accent"
            description="Short intro, current route context, one proof point, and business card together for the manual SMS lane."
            title="SMS support package"
          />
          <QueueItem
            action={
              <Button
                onClick={() =>
                  void handleCopy("Email support package", emailSupportPackage)
                }
                size="sm"
                type="button"
                variant={
                  props.routeState.preferredSupportLane === "email"
                    ? "secondary"
                    : "ghost"
                }
              >
                Copy email support
              </Button>
            }
            badgeLabel="Email"
            badgeTone="success"
            description="Longer intro, current route context, one proof point, and business card together for the manual email lane."
            title="Email support package"
          />
          <QueueItem
            action={
              <Button
                onClick={() =>
                  void handleCopy("Proof add-on", proofAddOnPackage)
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Copy proof add-on
              </Button>
            }
            badgeLabel="Proof"
            badgeTone="warning"
            description="Use this only when the listing needs extra credibility. Keep proof additive, not louder than the actual next-step ask."
            title="Proof add-on package"
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
          <strong>Underlying copy pieces</strong>
          <span>
            Use these raw pieces only when the companion package needs a custom
            tone for the live conversation.
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
