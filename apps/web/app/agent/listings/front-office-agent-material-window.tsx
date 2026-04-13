"use client";

import { useState } from "react";
import type {
  FrontOfficeAgentMaterialSnapshot,
  FrontOfficeListingsTargetAppointment,
  FrontOfficeListingsTargetClient,
} from "@acre/db";
import { Button, QueueItem } from "@acre/ui";
import { FrontOfficeLink } from "../_components/front-office-link";
import {
  buildAgentListingsHref,
  type FrontOfficeListingsDraftAssist,
  type FrontOfficeListingsRouteState,
} from "./front-office-listings-route-state";

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

type MaterialLaunchLink = {
  id: string;
  label: string;
  note: string;
  description: string;
  href: string;
  isPreferred: boolean;
};

type MaterialReadinessItem = {
  id: string;
  label: string;
  stateLabel: string;
  tone: "accent" | "success" | "warning";
  detail: string;
};

type MaterialSendPlan = {
  title: string;
  description: string;
  steps: Array<{
    id: string;
    label: string;
    detail: string;
  }>;
  copyValue: string;
  preferredLaunchHref: string;
  preferredLaunchLabel: string;
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
      title: `Appointment send kit for ${input.targetClient.fullName}`,
      description:
        "Use this when the listing should travel with profile, contact, proof, and appointment context instead of as a bare link.",
      steps: [
        {
          id: "bundle-profile",
          badgeLabel: "Profile",
          badgeTone: "accent" as const,
          title: "Lead with the profile sheet",
          description: `Tie the send back to ${input.targetClient.stage} and ${input.targetAppointment.title} so the follow-up stays visible in one place.`,
        },
        {
          id: "bundle-contact",
          badgeLabel: "Contact",
          badgeTone: "success" as const,
          title: "Keep contact details with it",
          description:
            "Lead with the short intro and direct contact details so the client can reply quickly without losing the tracked link context.",
        },
        {
          id: "bundle-proof",
          badgeLabel: "Proof",
          badgeTone: "warning" as const,
          title: "Attach one proof point",
          description:
            input.material.featuredCaseCount > 0
              ? "Include one recent closing if the client still needs confidence before or after the appointment."
              : "Use the business card and profile identity so the materials still carry credibility even without featured closings.",
        },
        {
          id: "bundle-route",
          badgeLabel: "Next step",
          badgeTone: "accent" as const,
          title: "Keep the next step attached",
          description: `${input.routeState.focusedRouteLaneLabel} stays the safest path here, and the saved view keeps the same appointment context ready for the next follow-up.`,
        },
      ],
    };
  }

  if (input.targetClient) {
    return {
      title: `Client send kit for ${input.targetClient.fullName}`,
      description:
        "Keep the listing, profile sheet, contact block, proof, and next-step context together so the client can move forward without extra explanation.",
      steps: [
        {
          id: "bundle-profile",
          badgeLabel: "Profile",
          badgeTone: "accent" as const,
          title: "Open with the profile sheet",
          description:
            "Use the profile sheet when the client needs more framing, or the tracked listing when you want a quick reaction beside the current context.",
        },
        {
          id: "bundle-contact",
          badgeLabel: "Contact",
          badgeTone: "success" as const,
          title: "Keep contact details nearby",
          description:
            "If the materials are forwarded or reopened later, the contact details should still travel with them.",
        },
        {
          id: "bundle-proof",
          badgeLabel: "Proof",
          badgeTone: "warning" as const,
          title: "Bring proof only when it helps",
          description:
            input.material.featuredCaseCount > 0
              ? "Use a featured closing when the client is active but needs confidence, not on every first touch."
              : "You do not have a featured closing ready yet, so lead with identity and a clear next-step ask instead.",
        },
        {
          id: "bundle-route",
          badgeLabel: "Next step",
          badgeTone: "accent" as const,
          title: "Keep the next step attached",
          description: `${input.routeState.focusedRouteLaneLabel} keeps the next touch in the same follow-up view instead of restarting from a raw listing link.`,
        },
      ],
    };
  }

  return {
    title: "General send kit",
    description:
      "When no client is selected, keep profile, contact, proof, and follow-up materials organized so the next tracked share can become client-linked without rebuilding everything from scratch.",
    steps: [
      {
        id: "bundle-profile",
        badgeLabel: "Profile",
        badgeTone: "accent" as const,
        title: "Start with the profile sheet",
        description:
          "Tracked-link mode still tracks the share, but it does not create a client history until you reopen this page from a client or appointment.",
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
            : "Build the send around agent identity first while the proof set is still light.",
      },
      {
        id: "bundle-route",
        badgeLabel: "Next step",
        badgeTone: "accent" as const,
        title: "Keep the next step attached",
        description:
          "Tracked-link mode keeps the share active, but it should stay manual until a client or appointment is attached.",
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
      "No featured closing set is ready yet, so keep the send kit centered on identity and the next-step ask.",
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

function buildIntroPosterText(input: {
  material: FrontOfficeAgentMaterialSnapshot;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  const contextLine = input.targetAppointment
    ? `Prepared for ${input.targetAppointment.title} with ${input.targetClient?.fullName ?? "the current client"}`
    : input.targetClient
      ? `Prepared for ${input.targetClient.fullName} while ${input.targetClient.stage} stays active`
      : "Prepared as a reusable profile-intro poster";

  return [
    "Intro poster",
    input.material.displayName,
    `${input.material.titleLabel} · ${input.material.officeLabel}`,
    contextLine,
    input.material.bioLabel,
    `License: ${input.material.licenseLabel}`,
    `Recent closings: ${input.material.recentClosedCount}`,
    `Portrait: ${input.material.portraitReady ? "ready" : "missing"}`,
    `Contact: ${input.material.phone || "Phone not published"} · ${input.material.email || "Email not published"}`,
  ].join("\n");
}

function buildClosingHistoryText(material: FrontOfficeAgentMaterialSnapshot) {
  if (!material.featuredCases.length) {
    return [
      "Closing history",
      `${material.displayName} has ${material.recentClosedCount} recent closings in the current snapshot.`,
      "No featured cases are ready yet, so lead with the profile sheet and business card until a stronger proof strip is available.",
    ].join("\n");
  }

  return [
    "Closing history",
    `${material.displayName} · ${material.recentClosedCount} recent closings`,
    ...material.featuredCases.map(
      (item, index) =>
        `${index + 1}. ${item.label} · ${item.priceLabel} · ${item.closingLabel}`,
    ),
  ].join("\n");
}

function buildLandingPageBriefText(input: {
  material: FrontOfficeAgentMaterialSnapshot;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  const contextLine = input.targetAppointment
    ? `Use this as the public-facing profile brief when ${input.targetAppointment.title} needs more agent framing for ${input.targetClient?.fullName ?? "the current client"}.`
    : input.targetClient
      ? `Use this as the public-facing profile brief while ${input.targetClient.fullName} stays in ${input.targetClient.stage}.`
      : "Use this as the reusable public-facing profile brief when a tracked listing needs a fuller agent identity package.";

  const featuredCase = input.material.featuredCases[0];

  return [
    "Landing page brief",
    `Hero: ${input.material.displayName} · ${input.material.titleLabel} · ${input.material.officeLabel}`,
    `About: ${input.material.bioLabel}`,
    `Context: ${contextLine}`,
    `Credibility: ${input.material.recentClosedCount} recent closings · ${input.material.featuredCaseCount} featured case(s) · ${input.material.licenseLabel}`,
    featuredCase
      ? `Featured case: ${featuredCase.label} · ${featuredCase.priceLabel} · ${featuredCase.closingLabel}`
      : "Featured case: build the landing page around identity and direct contact until a stronger closing proof is ready.",
    `Call to action: Contact ${input.material.displayName} at ${input.material.phone || "the published phone line"} or ${input.material.email || "the published email address"} for the next showing, materials request, or follow-up.`,
  ].join("\n");
}

function buildCaseStudyReelText(material: FrontOfficeAgentMaterialSnapshot) {
  if (!material.featuredCases.length) {
    return [
      "Case-study reel",
      `${material.displayName} does not have a featured case reel ready yet.`,
      "Until a featured closing is ready, keep the showcase stack centered on the landing brief, intro poster, and direct contact block.",
    ].join("\n");
  }

  return [
    "Case-study reel",
    `${material.displayName} · ${material.recentClosedCount} recent closings`,
    ...material.featuredCases.map(
      (item, index) =>
        `${index + 1}. ${item.label}\n   Price: ${item.priceLabel}\n   Closed: ${item.closingLabel}\n   Reference: ${item.href}`,
    ),
  ].join("\n");
}

function buildRouteSheetText(input: {
  routeState: FrontOfficeListingsRouteState;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  const routeContext = input.targetAppointment
    ? `Current context: appointment-linked to ${input.targetAppointment.title} for ${input.targetClient?.fullName ?? "the current client"}.`
    : input.targetClient
      ? `Current context: client-linked to ${input.targetClient.fullName} while ${input.targetClient.stage} stays active.`
      : `Current context: ${input.routeState.modeContextLabel}.`;

  return [
    "Follow-up summary",
    routeContext,
    `Current focus: ${input.routeState.focusedRouteLaneLabel}`,
    `Support copy: ${input.routeState.preferredSupportLaneLabel}`,
    `Saved view: ${input.routeState.stableReentryLabel}`,
    `Next action: ${input.routeState.focusedRouteLaneActionLabel}`,
  ].join("\n");
}

function buildOutboundPacketText(input: {
  material: FrontOfficeAgentMaterialSnapshot;
  routeState: FrontOfficeListingsRouteState;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  return [
    "Send kit",
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
  const introPosterText = buildIntroPosterText({
    material: input.material,
    targetClient: input.targetClient,
    targetAppointment: input.targetAppointment,
  });
  const landingPageBriefText = buildLandingPageBriefText({
    material: input.material,
    targetClient: input.targetClient,
    targetAppointment: input.targetAppointment,
  });
  const closingHistoryText = buildClosingHistoryText(input.material);
  const caseStudyReelText = buildCaseStudyReelText(input.material);

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
            : "Use this profile block as the identity reference for the next tracked send.",
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
        "Keep the phone, email, and business card next to the send kit so the next touch is easy to continue.",
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
          ? "Use this proof strip only when the send kit needs an extra confidence layer."
          : "Keep this strip light until a featured closing is ready to travel with the send kit.",
      preview: proofSheetText,
      copyLabel: "Copy proof add-on",
      copyValue: proofSheetText,
    },
    {
      id: "route-block",
      badgeLabel: "Follow-up",
      badgeTone: "accent" as const,
      title: "Follow-up summary",
      description:
        "Keep the current focus, support copy, and saved view visible so you can reopen the same context without rebuilding it.",
      preview: routeSheetText,
      copyLabel: "Copy follow-up summary",
      copyValue: routeSheetText,
    },
    {
      id: "intro-poster",
      badgeLabel: "Showcase",
      badgeTone: "accent" as const,
      title: "Intro poster",
      description:
        "Use this when the send needs a more outward-facing profile summary instead of only the internal materials.",
      preview: introPosterText,
      copyLabel: "Copy intro poster",
      copyValue: introPosterText,
    },
    {
      id: "landing-page-brief",
      badgeLabel: "Landing",
      badgeTone: "accent" as const,
      title: "Landing page brief",
      description:
        "Use this as the structured copy source for a richer profile page, mini-site, or high-context agent intro.",
      preview: landingPageBriefText,
      copyLabel: "Copy landing brief",
      copyValue: landingPageBriefText,
    },
    {
      id: "closing-history",
      badgeLabel: "History",
      badgeTone:
        input.material.featuredCaseCount > 0
          ? ("success" as const)
          : ("warning" as const),
      title: "Closing history",
      description:
        "Keep a reusable proof strip ready for confidence-building sends, profile showcases, or post-tour follow-through.",
      preview: closingHistoryText,
      copyLabel: "Copy closing history",
      copyValue: closingHistoryText,
    },
    {
      id: "case-study-reel",
      badgeLabel: "Cases",
      badgeTone:
        input.material.featuredCaseCount > 0
          ? ("success" as const)
          : ("warning" as const),
      title: "Case-study reel",
      description:
        "Use this when the next public-facing profile needs a fuller closing reel instead of one short proof strip.",
      preview: caseStudyReelText,
      copyLabel: "Copy case-study reel",
      copyValue: caseStudyReelText,
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
      : "Context: Use this with the tracked listing when you need a quick intro plus identity in the same follow-up.";

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
      badgeLabel: "SMS support",
      badgeTone: "accent" as const,
      title: "SMS support message is preferred",
      description: props.routeState.preferredSupportLaneDescription,
    };
  }

  if (props.routeState.preferredSupportLane === "email") {
    return {
      badgeLabel: "Email support",
      badgeTone: "accent" as const,
      title: "Email support message is preferred",
      description: props.routeState.preferredSupportLaneDescription,
    };
  }

  return {
    badgeLabel: "Keep both ready",
    badgeTone: "warning" as const,
    title: "Keep both support messages ready",
    description: props.routeState.preferredSupportLaneDescription,
  };
}

function buildLaunchpadStatus(props: FrontOfficeAgentMaterialWindowProps) {
  if (props.targetClient && props.targetAppointment) {
    return {
      badgeLabel: "Context",
      badgeTone: "success" as const,
      title: "Appointment context",
      description:
        "The saved view, preferred support copy, and current mode are all aligned to the appointment thread, so the next touch can stay organized instead of restarting from a raw listing link.",
    };
  }

  if (props.targetClient) {
    return {
      badgeLabel: "Context",
      badgeTone: "accent" as const,
      title: "Client context",
      description:
        "The saved view and current mode are aligned to the client history, so you can keep the next touch in the same place without pretending anything was auto-sent.",
    };
  }

  return {
    badgeLabel: "Context",
    badgeTone: "warning" as const,
    title: "Tracked link context",
    description:
      "The saved view keeps the tracked link reusable while the support copy and current mode stay manual and easy to review.",
  };
}

function buildPreferredSupportPackage(input: {
  routeState: FrontOfficeListingsRouteState;
  smsSupportPackage: string;
  emailSupportPackage: string;
}) {
  if (input.routeState.preferredSupportLane === "sms") {
    return {
      label: "Preferred support",
      title: "SMS support message",
      copyButtons: [
        {
          copyLabel: "Copy preferred message",
          title: "SMS support message",
          value: input.smsSupportPackage,
        },
      ],
    };
  }

  if (input.routeState.preferredSupportLane === "email") {
    return {
      label: "Preferred support",
      title: "Email support message",
      copyButtons: [
        {
          copyLabel: "Copy preferred message",
          title: "Email support message",
          value: input.emailSupportPackage,
        },
      ],
    };
  }

  return {
    label: "Keep both ready",
    title: "SMS and email support messages",
    copyButtons: [
      {
        copyLabel: "Copy SMS message",
        title: "SMS support message",
        value: input.smsSupportPackage,
      },
      {
        copyLabel: "Copy email message",
        title: "Email support message",
        value: input.emailSupportPackage,
      },
    ],
  };
}

function buildLaunchpadDraftAssist(input: {
  channel: "sms" | "email";
  body: string;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}): FrontOfficeListingsDraftAssist {
  const title =
    input.channel === "sms"
      ? input.targetAppointment
        ? `${input.targetAppointment.title} SMS draft`
        : input.targetClient
          ? `${input.targetClient.fullName} SMS draft`
          : "SMS draft"
      : input.targetAppointment
        ? `${input.targetAppointment.title} email draft`
        : input.targetClient
          ? `${input.targetClient.fullName} email draft`
          : "Email draft";
  const subjectLine =
    input.channel === "email"
      ? input.targetAppointment
        ? `${input.targetAppointment.title} listing follow-up`
        : input.targetClient
          ? `${input.targetClient.fullName} listing follow-up`
          : "Listing follow-up"
      : "";

  return {
    channel: input.channel,
    title,
    subjectLine,
    body: input.body,
    suggestionKind: null,
    suggestionLabel: null,
    sourceKey: null,
    sourceLabel: null,
  };
}

function buildMaterialLaunchLinks(input: {
  routeState: FrontOfficeListingsRouteState;
  smsSupportPackage: string;
  emailSupportPackage: string;
  targetClient?: FrontOfficeListingsTargetClient | null;
  targetAppointment?: FrontOfficeListingsTargetAppointment | null;
}) {
  const preferredLane = input.routeState.preferredSupportLane;
  const links: MaterialLaunchLink[] = [
    {
      id: "sms-launch",
      label:
        preferredLane === "sms" ? "Open preferred SMS draft" : "Open SMS draft",
      note: preferredLane === "sms" ? "Preferred support" : "SMS support",
      description:
        "Reopen the same listings page with the SMS support message already loaded into the draft section.",
      href: buildAgentListingsHref({
        clientId: input.targetClient?.id ?? null,
        appointmentId: input.targetAppointment?.id ?? null,
        lane: input.routeState.focusedRouteLane,
        draftAssist: buildLaunchpadDraftAssist({
          channel: "sms",
          body: input.smsSupportPackage,
          targetClient: input.targetClient,
          targetAppointment: input.targetAppointment,
        }),
      }),
      isPreferred: preferredLane === "sms",
    },
    {
      id: "email-launch",
      label:
        preferredLane === "email"
          ? "Open preferred email draft"
          : "Open email draft",
      note: preferredLane === "email" ? "Preferred support" : "Email support",
      description:
        "Reopen the same listings page with the email support message already loaded into the draft section.",
      href: buildAgentListingsHref({
        clientId: input.targetClient?.id ?? null,
        appointmentId: input.targetAppointment?.id ?? null,
        lane: input.routeState.focusedRouteLane,
        draftAssist: buildLaunchpadDraftAssist({
          channel: "email",
          body: input.emailSupportPackage,
          targetClient: input.targetClient,
          targetAppointment: input.targetAppointment,
        }),
      }),
      isPreferred: preferredLane === "email",
    },
  ];

  if (preferredLane === "email") {
    return [links[1], links[0]];
  }

  if (preferredLane === "sms") {
    return [links[0], links[1]];
  }

  return links;
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

function buildMaterialReadinessItems(
  props: FrontOfficeAgentMaterialWindowProps,
) {
  const hasContactBlock = Boolean(props.material.phone || props.material.email);
  const hasProofPackage = props.material.featuredCaseCount > 0;

  return [
    {
      id: "portrait",
      label: "Portrait asset",
      stateLabel: props.material.portraitReady ? "Ready" : "Missing",
      tone: props.material.portraitReady
        ? ("success" as const)
        : ("warning" as const),
      detail: props.material.portraitReady
        ? "The profile sheet can lead with a face-ready identity block."
        : "Lead with the profile sheet copy, but refresh the portrait before treating this as a polished public-facing profile.",
    },
    {
      id: "contact",
      label: "Contact block",
      stateLabel: hasContactBlock ? "Published" : "Needs review",
      tone: hasContactBlock ? ("success" as const) : ("warning" as const),
      detail: hasContactBlock
        ? "Phone and/or email are available, so the materials can carry a clear reply path beside the tracked listing."
        : "Business card copy exists, but the direct reply path is still too thin for a stronger outbound follow-up.",
    },
    {
      id: "proof",
      label: "Proof add-on",
      stateLabel: hasProofPackage ? "Ready" : "Identity-first",
      tone: hasProofPackage ? ("accent" as const) : ("warning" as const),
      detail: hasProofPackage
        ? "A featured closing is ready when the client needs confidence after the first touch."
        : "Keep the send kit centered on profile and contact until a stronger proof case is ready.",
    },
    {
      id: "route",
      label: "Follow-up context",
      stateLabel: props.routeState.focusedRouteLaneLabel,
      tone: "accent" as const,
      detail: `The materials stay aligned to ${props.routeState.focusedRouteLaneLabel}, so the next touch can reopen in the same place.`,
    },
  ] satisfies MaterialReadinessItem[];
}

function buildMaterialReadinessCopyText(input: {
  items: MaterialReadinessItem[];
  modeLabel: string;
}) {
  return [
    "Readiness board",
    `Current mode: ${input.modeLabel}`,
    ...input.items.map(
      (item) => `${item.label}: ${item.stateLabel}\n${item.detail}`,
    ),
  ].join("\n\n");
}

function buildMaterialSendPlan(input: {
  props: FrontOfficeAgentMaterialWindowProps;
  launchLinks: MaterialLaunchLink[];
}) {
  const preferredLaunch =
    input.launchLinks.find((launchLink) => launchLink.isPreferred) ??
    input.launchLinks[0];
  const contextLabel = input.props.targetAppointment
    ? `${input.props.targetAppointment.title} for ${input.props.targetClient?.fullName ?? "the current client"}`
    : input.props.targetClient
      ? `${input.props.targetClient.fullName} in ${input.props.targetClient.stage}`
      : input.props.routeState.modeContextLabel;
  const steps = [
    {
      id: "send-plan-launch",
      label: "Open the preferred draft",
      detail: `${preferredLaunch.label} keeps the draft attached to ${input.props.routeState.focusedRouteLaneLabel} instead of dropping back into a broad listings page.`,
    },
    {
      id: "send-plan-identity",
      label: "Lead with profile and contact",
      detail:
        "Start with the profile sheet and contact block so the recipient gets identity and a reply path before any optional proof add-on.",
    },
    {
      id: "send-plan-proof",
      label: "Attach proof only when it helps",
      detail:
        input.props.material.featuredCaseCount > 0
          ? "Use the proof add-on after there is already interest, objection, or appointment follow-up pressure."
          : "Skip the proof strip for now and keep the send kit centered on identity plus the next-step ask.",
    },
    {
      id: "send-plan-reentry",
      label: "Reopen the same saved view",
      detail: input.props.targetAppointment
        ? "After the send or reply, reopen the same view so the appointment loop and next step stay together."
        : "After the send or reply, reopen the same view so the next touch stays in one clear history.",
    },
  ];

  return {
    title: input.props.targetAppointment
      ? "Appointment send plan"
      : input.props.targetClient
        ? "Client send plan"
        : "Tracked-link send plan",
    description: `This send kit stays manual, but it now has a clear execution order for ${contextLabel}.`,
    steps,
    copyValue: [
      "Recommended send plan",
      `Context: ${contextLabel}`,
      `Preferred draft: ${preferredLaunch.label}`,
      ...steps.map(
        (step, index) => `${index + 1}. ${step.label}\n${step.detail}`,
      ),
    ].join("\n\n"),
    preferredLaunchHref: preferredLaunch.href,
    preferredLaunchLabel: preferredLaunch.label,
  } satisfies MaterialSendPlan;
}

function buildMaterialCopyDetail(props: FrontOfficeAgentMaterialWindowProps) {
  if (props.targetAppointment && props.targetClient) {
    return `Use it beside ${props.targetAppointment.title} so the listing, identity, and appointment continuity stay together for ${props.targetClient.fullName}.`;
  }

  if (props.targetClient) {
    return `Use it beside the tracked listing so ${props.targetClient.fullName}'s next touch carries identity, context, and proof in one clear package.`;
  }

  return "Use it beside the tracked listing so the next outbound touch does not travel as a bare link.";
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
  const launchLinks = buildMaterialLaunchLinks({
    routeState: props.routeState,
    smsSupportPackage,
    emailSupportPackage,
    targetClient: props.targetClient,
    targetAppointment: props.targetAppointment,
  });
  const launchpadStatus = buildLaunchpadStatus(props);
  const executionLaneOverview = buildExecutionLaneOverview(props);
  const materialReadinessItems = buildMaterialReadinessItems(props);
  const materialPreviewCardMap = new Map(
    materialPreviewCards.map((card) => [card.id, card] as const),
  );
  const profileSheetCard = materialPreviewCardMap.get("profile-sheet");
  const contactBlockCard = materialPreviewCardMap.get("contact-block");
  const proofAddOnCard = materialPreviewCardMap.get("proof-add-on");
  const routeBlockCard = materialPreviewCardMap.get("route-block");
  const introPosterCard = materialPreviewCardMap.get("intro-poster");
  const landingPageBriefCard = materialPreviewCardMap.get("landing-page-brief");
  const closingHistoryCard = materialPreviewCardMap.get("closing-history");
  const caseStudyReelCard = materialPreviewCardMap.get("case-study-reel");
  const materialReadinessCopyText = buildMaterialReadinessCopyText({
    items: materialReadinessItems,
    modeLabel: props.routeState.modeLabel,
  });
  const materialSendPlan = buildMaterialSendPlan({
    props,
    launchLinks,
  });
  const outboundPacketText = buildOutboundPacketText({
    material: props.material,
    routeState: props.routeState,
    targetClient: props.targetClient,
    targetAppointment: props.targetAppointment,
  });
  const showcaseBundleText = [
    "Showcase bundle",
    landingPageBriefCard?.copyValue ?? "",
    introPosterCard?.copyValue ?? "",
    closingHistoryCard?.copyValue ?? "",
    caseStudyReelCard?.copyValue ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  async function handleCopy(label: string, value: string) {
    try {
      await copyTextToClipboard(value);
      setFeedback({
        tone: "success",
        message: `${label} copied. You can use it in the next listing follow-up right away.`,
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
                  onClick={() =>
                    void handleCopy(card.copyLabel, card.copyValue)
                  }
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
            onClick={() => void handleCopy("Send kit", outboundPacketText)}
            size="sm"
            type="button"
            variant="secondary"
          >
            Copy send kit
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Showcase bundle", showcaseBundleText)
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            Copy showcase bundle
          </Button>
          {preferredSupportPackage.copyButtons.map((copyButton) => (
            <Button
              key={`top-${copyButton.title}-${copyButton.copyLabel}`}
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
          <Button
            onClick={() =>
              void handleCopy(
                "Profile sheet",
                profileSheetCard?.copyValue ?? "",
              )
            }
            size="sm"
            type="button"
            variant="ghost"
            disabled={!profileSheetCard}
          >
            Copy profile sheet
          </Button>
          <Button
            onClick={() =>
              void handleCopy(
                "Contact block",
                contactBlockCard?.copyValue ?? "",
              )
            }
            size="sm"
            type="button"
            variant="ghost"
            disabled={!contactBlockCard}
          >
            Copy contact block
          </Button>
          <Button
            onClick={() =>
              void handleCopy("Proof add-on", proofAddOnCard?.copyValue ?? "")
            }
            size="sm"
            type="button"
            variant="ghost"
            disabled={!proofAddOnCard}
          >
            Copy proof add-on
          </Button>
          <Button
            onClick={() =>
              void handleCopy(
                "Landing page brief",
                landingPageBriefCard?.copyValue ?? "",
              )
            }
            size="sm"
            type="button"
            variant="ghost"
            disabled={!landingPageBriefCard}
          >
            Copy landing brief
          </Button>
          <Button
            onClick={() =>
              void handleCopy(
                "Follow-up summary",
                routeBlockCard?.copyValue ?? "",
              )
            }
            size="sm"
            type="button"
            variant="ghost"
            disabled={!routeBlockCard}
          >
            Copy follow-up summary
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
          <strong>Current context</strong>
          <span>
            Keep the saved view, preferred support copy, and current mode
            visible before you open any draft.
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
                  Open saved view
                </FrontOfficeLink>
                {props.routeState.stableHref !==
                props.routeState.contextHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.contextHref}
                  >
                    Open current view
                  </FrontOfficeLink>
                ) : null}
                {props.routeState.contextHref !== props.routeState.cleanHref ? (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={props.routeState.cleanHref}
                  >
                    Reset filters
                  </FrontOfficeLink>
                ) : null}
                <Button
                  onClick={() =>
                    void handleCopy("Send kit", outboundPacketText)
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Copy send kit
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
                  ? "Copy one or both support messages before you open the draft."
                  : "Use the support message that matches the current follow-up view."}
              </span>
            }
            title={preferredSupportPackage.title}
          />
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Readiness board",
                      materialReadinessCopyText,
                    )
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Copy readiness board
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Profile sheet",
                      profileSheetCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!profileSheetCard}
                >
                  Copy profile sheet
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Contact block",
                      contactBlockCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!contactBlockCard}
                >
                  Copy contact block
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Proof add-on",
                      proofAddOnCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!proofAddOnCard}
                >
                  Copy proof add-on
                </Button>
              </div>
            }
            badgeLabel="Readiness"
            badgeTone={
              materialReadinessItems.some((item) => item.tone === "warning")
                ? "warning"
                : "success"
            }
            context={props.routeState.modeLabel}
            description="Check whether portrait, contact, proof, and follow-up context are ready before you use these materials in a live follow-up."
            meta={
              <span>
                {materialReadinessItems
                  .map((item) => `${item.label}: ${item.stateLabel}`)
                  .join(" · ")}
              </span>
            }
            title="Readiness board"
          />
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Intro poster",
                      introPosterCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                  disabled={!introPosterCard}
                >
                  Copy intro poster
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Landing page brief",
                      landingPageBriefCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!landingPageBriefCard}
                >
                  Copy landing brief
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Closing history",
                      closingHistoryCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!closingHistoryCard}
                >
                  Copy closing history
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Case-study reel",
                      caseStudyReelCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!caseStudyReelCard}
                >
                  Copy case-study reel
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Profile sheet",
                      profileSheetCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!profileSheetCard}
                >
                  Copy profile sheet
                </Button>
              </div>
            }
            badgeLabel="Showcase set"
            badgeTone="accent"
            context={`${props.material.recentClosedCount} recent closings`}
            description="Use the intro poster and closing history when the next share needs a clearer public-facing agent profile instead of only private follow-up materials."
            meta={
              <span>
                Intro poster · Landing brief · Closing history · Case-study reel
              </span>
            }
            title="Profile showcase materials"
          />
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Landing page brief",
                      landingPageBriefCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                  disabled={!landingPageBriefCard}
                >
                  Copy landing brief
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy("Showcase bundle", showcaseBundleText)
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Copy showcase bundle
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Case-study reel",
                      caseStudyReelCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!caseStudyReelCard}
                >
                  Copy case-study reel
                </Button>
              </div>
            }
            badgeLabel="Landing prep"
            badgeTone="accent"
            context={`${props.material.titleLabel} · ${props.material.officeLabel}`}
            description="This keeps a future-facing profile page package ready to use, even before Acre has a full public profile system."
            meta={<span>Hero copy · Proof reel · Contact CTA</span>}
            title="Profile landing-page brief"
          />
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                {launchLinks.map((launchLink) => (
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={launchLink.href}
                    key={launchLink.id}
                  >
                    {launchLink.label}
                  </FrontOfficeLink>
                ))}
              </div>
            }
            badgeLabel="Draft links"
            badgeTone="accent"
            context={props.routeState.focusedRouteLaneLabel}
            description="These links reopen the same listings page with the support message already loaded into the draft section. Acre only preloads copy here; it does not send anything automatically."
            meta={
              <span>
                {launchLinks.map((launchLink) => launchLink.note).join(" · ")}
              </span>
            }
            title="Draft links"
          />
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                <FrontOfficeLink
                  className="office-inline-link"
                  href={materialSendPlan.preferredLaunchHref}
                >
                  {materialSendPlan.preferredLaunchLabel}
                </FrontOfficeLink>
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Recommended send plan",
                      materialSendPlan.copyValue,
                    )
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Copy send plan
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy("Send kit", outboundPacketText)
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Copy send kit
                </Button>
              </div>
            }
            badgeLabel="Send plan"
            badgeTone="accent"
            context={props.routeState.preferredSupportLaneLabel}
            description={materialSendPlan.description}
            meta={
              <span>
                {materialSendPlan.steps.map((step) => step.label).join(" · ")}
              </span>
            }
            title={materialSendPlan.title}
          />
          <QueueItem
            action={
              <div className="front-office-playbook-actions">
                <Button
                  onClick={() =>
                    void handleCopy(
                      "Follow-up summary",
                      routeBlockCard?.copyValue ?? "",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={!routeBlockCard}
                >
                  Copy follow-up summary
                </Button>
                <Button
                  onClick={() =>
                    void handleCopy("Send kit", outboundPacketText)
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Copy send kit
                </Button>
              </div>
            }
            badgeLabel={props.routeState.modeLabel}
            badgeTone="accent"
            context={bundle.title}
            description={`${bundle.description} The send kit stays manual and easy to review at every step.`}
            meta={
              <span>{bundle.steps.map((step) => step.title).join(" · ")}</span>
            }
            title={`${props.routeState.modeLabel} mode`}
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
            badgeLabel={executionLaneOverview.badgeLabel}
            badgeTone={executionLaneOverview.badgeTone}
            context={executionLaneOverview.title}
            description={props.routeState.focusedRouteLanePanelDescription}
            meta={<span>{executionLaneOverview.meta}</span>}
            title={`${executionLaneOverview.actionLabel} checklist`}
          />
          <QueueItem
            badgeLabel={supportPackageStatus.badgeLabel}
            badgeTone={supportPackageStatus.badgeTone}
            context="Manual send support"
            description={supportPackageStatus.description}
            title={supportPackageStatus.title}
          />
          <QueueItem
            badgeLabel="Back Office only"
            badgeTone="warning"
            description="Use this window for copy, identity, and proof only; signatures, accounting, and archive still belong in Back Office."
            title="Leave record work in Back Office"
          />
        </div>
      </div>
    </div>
  );
}
