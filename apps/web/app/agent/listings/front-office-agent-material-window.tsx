"use client";

import { useState } from "react";
import type {
  FrontOfficeAgentMaterialSnapshot,
  FrontOfficeListingsTargetAppointment,
  FrontOfficeListingsTargetClient,
} from "@acre/db";
import { Button, QueueItem } from "@acre/ui";
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

type MaterialPreviewCard = {
  id: string;
  badgeLabel: string;
  badgeTone: "accent" | "success" | "warning";
  title: string;
  description: string;
  preview: string;
  copyLabel: string;
  copyValue: string;
};

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
  routeState: FrontOfficeListingsRouteState;
}) {
  if (input.targetClient && input.targetAppointment) {
    return {
      title: `Appointment packet for ${input.targetClient.fullName}`,
      description:
        "Use this packet when the listing needs to travel with profile, contact, proof, and route continuity instead of as a naked link.",
      steps: [
        {
          id: "bundle-profile",
          badgeLabel: "Profile",
          badgeTone: "accent" as const,
          title: "Lead with the profile sheet",
          description: `Tie the send back to ${input.targetClient.stage} and ${input.targetAppointment.title} so the follow-up stays visible in one trail.`,
        },
        {
          id: "bundle-contact",
          badgeLabel: "Contact",
          badgeTone: "success" as const,
          title: "Keep contact details with it",
          description:
            "Lead with the short intro and direct contact lane so the client can reply quickly without losing the tracked link context.",
        },
        {
          id: "bundle-proof",
          badgeLabel: "Proof",
          badgeTone: "warning" as const,
          title: "Attach one proof point",
          description:
            input.material.featuredCaseCount > 0
              ? "Include one recent closing if the client still needs confidence before or after the appointment."
              : "Use the business card and profile identity so the packet still carries credibility even without featured closings.",
        },
        {
          id: "bundle-route",
          badgeLabel: "Route",
          badgeTone: "accent" as const,
          title: "Keep the route attached",
          description: `${input.routeState.focusedRouteLaneLabel} stays the safest handoff path, and the stable link keeps the same appointment context ready for the next manual send.`,
        },
      ],
    };
  }

  if (input.targetClient) {
    return {
      title: `Client packet for ${input.targetClient.fullName}`,
      description:
        "Keep the listing, profile sheet, contact block, agent proof, and route together so the client can move from interest into the next touch without extra explanation.",
      steps: [
        {
          id: "bundle-profile",
          badgeLabel: "Profile",
          badgeTone: "accent" as const,
          title: "Open with the profile sheet",
          description:
            "Use the profile sheet when the client needs more framing, or the tracked listing when you want a quick reaction beside the route context.",
        },
        {
          id: "bundle-contact",
          badgeLabel: "Contact",
          badgeTone: "success" as const,
          title: "Keep contact details nearby",
          description:
            "If the packet is forwarded or reopened later, the contact details should still travel with it.",
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
        {
          id: "bundle-route",
          badgeLabel: "Route",
          badgeTone: "accent" as const,
          title: "Keep the route attached",
          description: `${input.routeState.focusedRouteLaneLabel} keeps the next touch in the same outbound trail instead of restarting from a raw listing link.`,
        },
      ],
    };
  }

  return {
    title: "Generic outbound packet",
    description:
      "When no client context is selected, keep profile, contact, proof, and route materials organized so the next tracked send can become client-linked without rebuilding the packet from scratch.",
    steps: [
      {
        id: "bundle-profile",
        badgeLabel: "Profile",
        badgeTone: "accent" as const,
        title: "Start with the profile sheet",
        description:
          "Generic mode still tracks the link, but it does not create a client send trail until you reopen listing output from a dossier or appointment.",
      },
      {
        id: "bundle-contact",
        badgeLabel: "Contact",
        badgeTone: "success" as const,
        title: "Pair it with contact details",
        description:
          "Keep the business card, intro email, and intro text ready so the next outreach does not feel like raw inventory.",
      },
      {
        id: "bundle-proof",
        badgeLabel: "Proof",
        badgeTone: "warning" as const,
        title: "Use proof selectively",
        description:
          input.material.featuredCaseCount > 0
            ? "Featured cases are best used after there is already some engagement, not as a replacement for basic context."
            : "Build the send around agent identity first while the proof package is still light.",
      },
      {
        id: "bundle-route",
        badgeLabel: "Route",
        badgeTone: "accent" as const,
        title: "Keep the route attached",
        description:
          "Generic mode still keeps the tracked link active, but it should stay manual until a client or appointment binding appears.",
      },
    ],
  };
}

function buildProfileSheetText(material: FrontOfficeAgentMaterialSnapshot) {
  return [
    "Profile sheet",
    material.displayName,
    `${material.titleLabel} · ${material.officeLabel}`,
    material.bioLabel,
    `Portrait: ${material.portraitReady ? "ready" : "missing"}`,
    `License: ${material.licenseLabel}`,
    `Recent closings: ${material.recentClosedCount}`,
    `Featured cases: ${material.featuredCaseCount}`,
  ].join("\n");
}

function buildContactSheetText(material: FrontOfficeAgentMaterialSnapshot) {
  return [
    "Contact block",
    material.displayName,
    `Phone: ${material.phone || "Phone not published"}`,
    `Email: ${material.email || "Email not published"}`,
    "Business card",
    material.businessCardText,
  ].join("\n");
}

function buildProofSheetText(material: FrontOfficeAgentMaterialSnapshot) {
  if (!material.featuredCases.length) {
    return [
      "Proof add-on",
      "No featured closing package is ready yet, so keep the packet centered on identity and the next-step ask.",
      "Use the business card and intro copy as the credibility layer until a recent closing is ready.",
    ].join("\n");
  }

  return [
    "Proof add-on",
    ...material.featuredCases.map(
      (item, index) =>
        `${index + 1}. ${item.label} · ${item.priceLabel} · ${item.closingLabel}`,
    ),
  ].join("\n");
}

function buildRouteSheetText(input: {
  routeState: FrontOfficeListingsRouteState;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  const routeContext = input.targetAppointment
    ? `Route context: appointment-linked to ${input.targetAppointment.title} for ${input.targetClient?.fullName ?? "the current client"}.`
    : input.targetClient
      ? `Route context: client-linked to ${input.targetClient.fullName} while ${input.targetClient.stage} stays active.`
      : `Route context: ${input.routeState.modeContextLabel}.`;

  return [
    "Route block",
    routeContext,
    `Primary lane: ${input.routeState.focusedRouteLaneLabel}`,
    `Support package: ${input.routeState.preferredSupportLaneLabel}`,
    `Stable re-entry: ${input.routeState.stableReentryLabel}`,
    `Next manual action: ${input.routeState.focusedRouteLaneActionLabel}`,
  ].join("\n");
}

function buildOutboundPacketText(input: {
  material: FrontOfficeAgentMaterialSnapshot;
  routeState: FrontOfficeListingsRouteState;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  return [
    "Outbound packet",
    buildRouteSheetText(input),
    buildProfileSheetText(input.material),
    buildContactSheetText(input.material),
    buildProofSheetText(input.material),
  ].join("\n\n");
}

function buildMaterialPreviewCards(input: {
  material: FrontOfficeAgentMaterialSnapshot;
  routeState: FrontOfficeListingsRouteState;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  const profileSheetText = buildProfileSheetText(input.material);
  const contactSheetText = buildContactSheetText(input.material);
  const proofSheetText = buildProofSheetText(input.material);
  const routeSheetText = buildRouteSheetText({
    routeState: input.routeState,
    targetClient: input.targetClient,
    targetAppointment: input.targetAppointment,
  });

  return [
    {
      id: "profile-sheet",
      badgeLabel: "Profile",
      badgeTone: "accent" as const,
      title: "Profile sheet",
      description:
        input.targetAppointment && input.targetClient
          ? `Use this profile block beside ${input.targetAppointment.title} so the send keeps identity and appointment continuity in view.`
          : input.targetClient
            ? `Use this profile block while ${input.targetClient.fullName} stays in ${input.targetClient.stage}.`
            : "Use this profile block as the identity anchor for the next tracked send.",
      preview: profileSheetText,
      copyLabel: "Copy profile sheet",
      copyValue: profileSheetText,
    },
    {
      id: "contact-block",
      badgeLabel: "Contact",
      badgeTone: "success" as const,
      title: "Contact block",
      description:
        "Keep the phone, email, and business card beside the packet so the next manual touch is easy to continue.",
      preview: contactSheetText,
      copyLabel: "Copy contact block",
      copyValue: contactSheetText,
    },
    {
      id: "proof-add-on",
      badgeLabel: "Proof",
      badgeTone: "warning" as const,
      title: "Proof add-on",
      description:
        input.material.featuredCaseCount > 0
          ? "Use this proof strip only when the packet needs an extra confidence layer."
          : "Keep this strip light until a featured closing is ready to travel with the packet.",
      preview: proofSheetText,
      copyLabel: "Copy proof add-on",
      copyValue: proofSheetText,
    },
    {
      id: "route-block",
      badgeLabel: "Route",
      badgeTone: "accent" as const,
      title: "Route block",
      description:
        "Keep the lane, support package, and stable re-entry visible so the send can be reopened without rebuilding context.",
      preview: routeSheetText,
      copyLabel: "Copy route block",
      copyValue: routeSheetText,
    },
  ] satisfies MaterialPreviewCard[];
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

function buildSupportPackageStatus(props: FrontOfficeAgentMaterialWindowProps) {
  if (props.routeState.preferredSupportLane === "sms") {
    return {
      badgeLabel: "SMS companion",
      badgeTone: "accent" as const,
      title: "SMS companion packet is the active companion",
      description: props.routeState.preferredSupportLaneDescription,
    };
  }

  if (props.routeState.preferredSupportLane === "email") {
    return {
      badgeLabel: "Email companion",
      badgeTone: "accent" as const,
      title: "Email companion packet is the active companion",
      description: props.routeState.preferredSupportLaneDescription,
    };
  }

  return {
    badgeLabel: "Keep both ready",
    badgeTone: "warning" as const,
    title: "Keep both companion packets ready",
    description: props.routeState.preferredSupportLaneDescription,
  };
}

function buildLaunchpadStatus(props: FrontOfficeAgentMaterialWindowProps) {
  if (props.targetClient && props.targetAppointment) {
    return {
      badgeLabel: "Launchpad",
      badgeTone: "success" as const,
      title: "Appointment-linked launchpad",
      description:
        "The stable route, preferred support package, and packet mode are all aligned to the appointment trail, so the next manual send can stay reviewable instead of restarting from a raw listing link.",
    };
  }

  if (props.targetClient) {
    return {
      badgeLabel: "Launchpad",
      badgeTone: "accent" as const,
      title: "Client-linked launchpad",
      description:
        "The stable route and packet mode are aligned to the client trail, so you can keep the next manual send in the same execution lane without pretending anything auto-sent.",
    };
  }

  return {
    badgeLabel: "Launchpad",
    badgeTone: "warning" as const,
    title: "Tracked-link launchpad",
    description:
      "The stable route keeps the tracked link reusable while the preferred support package and packet mode stay manual, reviewable, and FO-owned.",
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
      title: "SMS companion package",
      copyButtons: [
        {
          copyLabel: "Copy preferred package",
          title: "SMS companion package",
          value: input.smsSupportPackage,
        },
      ],
    };
  }

  if (input.routeState.preferredSupportLane === "email") {
    return {
      label: "Preferred companion",
      title: "Email companion package",
      copyButtons: [
        {
          copyLabel: "Copy preferred package",
          title: "Email companion package",
          value: input.emailSupportPackage,
        },
      ],
    };
  }

  return {
    label: "Keep both ready",
    title: "SMS and email companion packages",
    copyButtons: [
      {
        copyLabel: "Copy SMS package",
        title: "SMS companion package",
        value: input.smsSupportPackage,
      },
      {
        copyLabel: "Copy email package",
        title: "Email companion package",
        value: input.emailSupportPackage,
      },
    ],
  };
}

function buildExecutionLaneOverview(
  props: FrontOfficeAgentMaterialWindowProps,
) {
  return {
    badgeLabel: props.routeState.focusedRouteLanePanelLabel,
    badgeTone:
      props.routeState.focusedRouteLane === "send-rescue"
        ? ("warning" as const)
        : ("accent" as const),
    title: props.routeState.focusedRouteLaneLabel,
    description: `${props.routeState.focusedRouteLaneDescription} ${props.routeState.routeStatusDescription}`,
    meta: props.routeState.focusedRouteLaneSteps
      .map((step) => step.label)
      .join(" · "),
    actionLabel: props.routeState.focusedRouteLaneActionLabel,
  };
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
    routeState: props.routeState,
  });
  const materialPreviewCards = buildMaterialPreviewCards({
    material: props.material,
    routeState: props.routeState,
    targetClient: props.targetClient,
    targetAppointment: props.targetAppointment,
  });
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
  const preferredSupportPackage = buildPreferredSupportPackage({
    routeState: props.routeState,
    smsSupportPackage,
    emailSupportPackage,
  });
  const launchpadStatus = buildLaunchpadStatus(props);
  const executionLaneOverview = buildExecutionLaneOverview(props);
  const outboundPacketText = buildOutboundPacketText({
    material: props.material,
    routeState: props.routeState,
    targetClient: props.targetClient,
    targetAppointment: props.targetAppointment,
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

        <div className="front-office-playbook-template-list">
          {materialPreviewCards.map((card) => (
            <article className="front-office-playbook-template" key={card.id}>
              <div className="front-office-playbook-template-head">
                <div>
                  <strong>{card.title}</strong>
                  <span>{card.description}</span>
                </div>
                <Button
                  onClick={() => void handleCopy(card.copyLabel, card.copyValue)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {card.copyLabel}
                </Button>
              </div>
              <pre className="front-office-playbook-template-body">
                {card.preview}
              </pre>
            </article>
          ))}
        </div>

        <div className="front-office-agent-material-actions">
          <Button
            onClick={() =>
              void handleCopy("Outbound packet", outboundPacketText)
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            Copy outbound packet
          </Button>
          {preferredSupportPackage.copyButtons.map((copyButton) => (
            <Button
              key={`top-${copyButton.title}-${copyButton.copyLabel}`}
              onClick={() => void handleCopy(copyButton.title, copyButton.value)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {copyButton.copyLabel}
            </Button>
          ))}
          <Button
            onClick={() => void handleCopy("Profile sheet", materialPreviewCards[0].copyValue)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy profile sheet
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Contact block", materialPreviewCards[1].copyValue)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy contact block
          </Button>
          <Button
            onClick={() => void handleCopy("Proof add-on", materialPreviewCards[2].copyValue)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy proof add-on
          </Button>
          <Button
            onClick={() => void handleCopy("Route block", materialPreviewCards[3].copyValue)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Copy route block
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
          <strong>Launchpad</strong>
          <span>
            Keep the stable route, preferred support package, and packet mode
            visible before you launch any manual send.
          </span>
        </div>
        <div className="office-queue-list">
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                <FrontOfficeLink
                  className="office-inline-link"
                  href={props.routeState.stableHref}
                >
                  Open stable route
                </FrontOfficeLink>
                {props.routeState.stableHref !== props.routeState.contextHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.contextHref}
                  >
                    Open context route
                  </FrontOfficeLink>
                ) : null}
                {props.routeState.contextHref !== props.routeState.cleanHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.cleanHref}
                  >
                    Reset workspace
                  </FrontOfficeLink>
                ) : null}
                <Button
                  onClick={() =>
                    void handleCopy("Outbound packet", outboundPacketText)
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Copy outbound packet
                </Button>
              </div>
            }
            badgeLabel={launchpadStatus.badgeLabel}
            badgeTone={launchpadStatus.badgeTone}
            context={`${props.routeState.modeContextLabel} · ${props.routeState.draftStatusLabel}`}
            description={launchpadStatus.description}
            meta={
              <span>
                {props.routeState.stableReentryLabel} ·{" "}
                {props.routeState.preferredSupportLaneLabel}
              </span>
            }
            title={launchpadStatus.title}
          />
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                {preferredSupportPackage.copyButtons.map((copyButton) => (
                  <Button
                    key={`${copyButton.title}-${copyButton.copyLabel}`}
                    onClick={() =>
                      void handleCopy(copyButton.title, copyButton.value)
                    }
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {copyButton.copyLabel}
                  </Button>
                ))}
              </div>
            }
            badgeLabel={preferredSupportPackage.label}
            badgeTone="accent"
            context={props.routeState.draftStatusLabel}
            description={props.routeState.preferredSupportLaneDescription}
            meta={
              <span>
                {props.routeState.preferredSupportLane === "mixed"
                  ? "Copy one or both companions before you launch."
                  : "Use the companion package that matches the active route."}
              </span>
            }
            title={preferredSupportPackage.title}
          />
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                <Button
                  onClick={() =>
                    void handleCopy("Route block", materialPreviewCards[3].copyValue)
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Copy route block
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy("Packet", outboundPacketText)
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Copy packet
                </Button>
              </div>
            }
            badgeLabel={props.routeState.modeLabel}
            badgeTone="accent"
            context={bundle.title}
            description={`${bundle.description} The packet mode is kept manual and reviewable at every step.`}
            meta={
              <span>
                {bundle.steps.map((step) => step.title).join(" · ")}
              </span>
            }
            title={`${props.routeState.modeLabel} packet mode`}
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
          <QueueItem
            badgeLabel={supportPackageStatus.badgeLabel}
            badgeTone={supportPackageStatus.badgeTone}
            context="Manual send support"
            description={supportPackageStatus.description}
            title={supportPackageStatus.title}
          />
          <QueueItem
            badgeLabel="BO boundary"
            badgeTone="warning"
            description="Use this window for copy, identity, and proof only; signatures, accounting, and archive still belong in Back Office."
            title="Leave record work in Back Office"
          />
        </div>
      </div>
    </div>
  );
}
