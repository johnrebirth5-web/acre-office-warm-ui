import { createHash } from "node:crypto";
import type { StudioListingDetailSnapshot } from "@acre/db";

export type ListingStudioPosterTemplateId =
  | "editorial"
  | "open-house"
  | "social-square"
  | "factsheet";

export type ListingStudioPosterTemplate = {
  id: ListingStudioPosterTemplateId;
  label: string;
  description: string;
  accent: string;
  background: string;
};

export type ListingStudioPosterDraft = {
  templateId: ListingStudioPosterTemplateId;
  kicker: string;
  headline: string;
  subheadline: string;
  cta: string;
  footer: string;
  coverAssetId: string | null;
};

export type ListingStudioMarketingKitVariant = {
  id: string;
  label: string;
  note: string;
  text: string;
};

export type ListingStudioMarketingKitSection = {
  title: string;
  subtitle: string;
  variants: ListingStudioMarketingKitVariant[];
};

export type ListingStudioMarketingKitBundle = {
  id: string;
  title: string;
  note: string;
  description: string;
  text: string;
};

export type ListingStudioTemplateBrief = {
  id: string;
  title: string;
  note: string;
  description: string;
  text: string;
};

export type ListingStudioCampaignFlight = {
  id: string;
  title: string;
  note: string;
  description: string;
  steps: string[];
  text: string;
};

export type ListingStudioCampaignPackage = {
  id: string;
  title: string;
  note: string;
  description: string;
  text: string;
};

export type ListingStudioCampaignSequenceStep = {
  id: string;
  title: string;
  note: string;
  detail: string;
};

export type ListingStudioCampaignChecklistItem = {
  id: string;
  title: string;
  note: string;
  ready: boolean;
};

export type ListingStudioCampaignDeliveryPlan = {
  summary: string;
  packages: ListingStudioCampaignPackage[];
  sequence: ListingStudioCampaignSequenceStep[];
  checklist: ListingStudioCampaignChecklistItem[];
};

export type ListingStudioMarketingKit = {
  sections: ListingStudioMarketingKitSection[];
  bundles: ListingStudioMarketingKitBundle[];
  templateBriefs: ListingStudioTemplateBrief[];
  flights: ListingStudioCampaignFlight[];
  deliveryPlan: ListingStudioCampaignDeliveryPlan;
  fullText: string;
  summaryLine: string;
};

type ListingStudioPacketTarget = {
  href: string;
  label: string;
  hint: string;
};

const posterTemplates: ListingStudioPosterTemplate[] = [
  {
    id: "editorial",
    label: "Editorial spotlight",
    description: "A magazine-style hero layout with a strong headline and roomy framing.",
    accent: "#7a5c2e",
    background: "linear-gradient(145deg, #f4efe6 0%, #fffaf0 52%, #efe7db 100%)",
  },
  {
    id: "open-house",
    label: "Open house card",
    description: "A clear, event-led layout for showing requests and quick booking prompts.",
    accent: "#0f4c5c",
    background: "linear-gradient(145deg, #eef7f7 0%, #ffffff 48%, #dcefed 100%)",
  },
  {
    id: "social-square",
    label: "Social square",
    description: "A compact social tile with a centered hero image and bold CTA strip.",
    accent: "#7c2d12",
    background: "linear-gradient(145deg, #fff4ef 0%, #fffdfa 50%, #f7e1d6 100%)",
  },
  {
    id: "factsheet",
    label: "Facts sheet",
    description: "A text-forward one-pager that favors bullet facts and clean print output.",
    accent: "#1f3a5f",
    background: "linear-gradient(145deg, #f4f7fb 0%, #ffffff 52%, #e5edf7 100%)",
  },
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();

  return trimmed && trimmed.length ? trimmed : fallback;
}

function joinWithLineBreaks(lines: Array<string | null | undefined>) {
  return lines.filter(Boolean).join("\n");
}

function joinWithSpaces(lines: Array<string | null | undefined>) {
  return lines.filter(Boolean).join(" ");
}

function formatMarketingSectionText(section: ListingStudioMarketingKitSection) {
  return [
    section.title,
    section.subtitle,
    ...section.variants.map((variant) =>
      joinWithLineBreaks([variant.label, variant.note, variant.text]),
    ),
  ].join("\n\n");
}

function formatTemplateBriefText(brief: ListingStudioTemplateBrief) {
  return [brief.title, brief.note, brief.description, brief.text].join("\n\n");
}

function formatCampaignFlightText(flight: ListingStudioCampaignFlight) {
  return [
    flight.title,
    flight.note,
    flight.description,
    ...flight.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    flight.text,
  ].join("\n");
}

function buildPosterPacketTarget(detail: StudioListingDetailSnapshot): ListingStudioPacketTarget {
  if (detail.pack.shareEnabled && detail.pack.shareCode) {
    return {
      href: `/share/packs/${detail.pack.shareCode}`,
      label: "Live listing page",
      hint: "Scan this code to open the public Acre listing page.",
    };
  }

  return {
    href: detail.sourceUrl,
    label: "Source listing",
    hint: "Scan this code to open the original listing page.",
  };
}

function buildPosterPacketAbsoluteUrl(
  detail: StudioListingDetailSnapshot,
  baseUrl?: string,
) {
  const target = buildPosterPacketTarget(detail);

  if (!baseUrl) {
    return target.href;
  }

  try {
    return new URL(target.href, baseUrl).toString();
  } catch {
    return target.href;
  }
}

function buildQrLikeMatrix(value: string, size = 29) {
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const reserved = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const digest = Array.from(createHash("sha256").update(value).digest());

  function mark(x: number, y: number, dark: boolean) {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }

    matrix[y][x] = dark;
    reserved[y][x] = true;
  }

  function fillFinder(originX: number, originY: number) {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const isBorder = x === 0 || y === 0 || x === 6 || y === 6;
        const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        mark(originX + x, originY + y, isBorder || isCenter);
      }
    }
  }

  function fillAlignment(originX: number, originY: number) {
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        const isBorder = x === 0 || y === 0 || x === 4 || y === 4;
        const isCenter = x === 2 && y === 2;
        mark(originX + x, originY + y, isBorder || isCenter);
      }
    }
  }

  fillFinder(0, 0);
  fillFinder(size - 7, 0);
  fillFinder(0, size - 7);
  fillAlignment(size - 9, size - 9);

  for (let i = 8; i < size - 8; i += 1) {
    if (!reserved[6][i]) {
      mark(i, 6, i % 2 === 0);
    }
    if (!reserved[i][6]) {
      mark(6, i, i % 2 === 0);
    }
  }

  let bitIndex = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (reserved[y][x]) {
        continue;
      }

      const byte = digest[(x * 7 + y * 11 + bitIndex) % digest.length];
      const bit = (byte >> (bitIndex % 8)) & 1;
      const mix = ((x + y + bitIndex) % 3) === 0;
      matrix[y][x] = Boolean(bit ^ Number(mix));
      bitIndex += 1;
    }
  }

  return matrix;
}

function buildScanCodeSvgMarkup(value: string, label: string) {
  const matrix = buildQrLikeMatrix(value);
  const quietZone = 4;
  const viewBoxSize = matrix.length + quietZone * 2;
  const darkRects: string[] = [];

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      if (!matrix[y][x]) {
        continue;
      }

      darkRects.push(
        `<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1" rx="0.08" />`,
      );
    }
  }

  return `
    <svg class="poster-scan-code" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" role="img" aria-label="${escapeHtml(label)}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <defs>
        <linearGradient id="scan-code-bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#f2f4f8" />
        </linearGradient>
      </defs>
      <rect width="${viewBoxSize}" height="${viewBoxSize}" fill="url(#scan-code-bg)" />
      <rect x="${quietZone - 0.5}" y="${quietZone - 0.5}" width="${matrix.length + 1}" height="${matrix.length + 1}" rx="2" fill="none" stroke="rgba(16,32,51,0.12)" />
      <g fill="#102033">${darkRects.join("")}</g>
    </svg>
  `;
}

function buildTemplateDefaults(
  detail: StudioListingDetailSnapshot,
  templateId: ListingStudioPosterTemplateId,
) {
  const locationLine = detail.locationLine ?? detail.addressLine;
  const summaryLine = detail.pack.summary || detail.descriptionText || locationLine;
  const firstBullet = detail.pack.bulletPoints[0] || detail.facts[0]?.value || "Reply for full details";
  const contactName = detail.pack.contactName || "Acre listing studio";
  const contactTitle = detail.pack.contactTitle || "Listing presentation";
  const contactLine = [contactName, contactTitle].filter(Boolean).join(" · ");

  switch (templateId) {
    case "open-house":
      return {
        kicker: "Open house ready",
        headline: detail.title,
        subheadline: normalizeText(locationLine, detail.addressLine),
        cta: detail.pack.agentNote?.trim() || "Book a showing or reply for the next tour window.",
        footer: contactLine,
      };
    case "social-square":
      return {
        kicker: "Social share",
        headline: detail.priceLabel,
        subheadline: detail.title,
        cta: "See the full listing page and send it to a client.",
        footer: contactLine,
      };
    case "factsheet":
      return {
        kicker: "Facts at a glance",
        headline: locationLine ?? detail.title,
        subheadline: summaryLine,
        cta: firstBullet,
        footer: contactLine,
      };
    case "editorial":
    default:
      return {
        kicker: "Listing Studio",
        headline: detail.pack.headline || detail.title,
        subheadline: summaryLine,
        cta: "Request the full listing page and share the print-ready view.",
        footer: contactLine,
      };
  }
}

export function getListingStudioPosterTemplates() {
  return posterTemplates;
}

export function buildListingStudioPosterDraft(
  detail: StudioListingDetailSnapshot,
  templateId: ListingStudioPosterTemplateId = "editorial",
  coverAssetId: string | null = null,
): ListingStudioPosterDraft {
  const defaults = buildTemplateDefaults(detail, templateId);
  const allowedAssetIds = new Set(detail.assets.map((asset) => asset.id));
  const fallbackCoverAssetId =
    detail.pack.coverAssetId ??
    detail.pack.selectedAssetIds[0] ??
    detail.assets[0]?.id ??
    null;
  const resolvedCoverAssetId =
    coverAssetId && allowedAssetIds.has(coverAssetId)
      ? coverAssetId
      : fallbackCoverAssetId;

  return {
    templateId,
    kicker: defaults.kicker,
    headline: defaults.headline,
    subheadline: defaults.subheadline,
    cta: defaults.cta,
    footer: defaults.footer,
    coverAssetId: resolvedCoverAssetId,
  };
}

export function resolveListingStudioPosterCoverAssetId(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
) {
  const allowedAssetIds = new Set(detail.assets.map((asset) => asset.id));

  if (draft.coverAssetId && allowedAssetIds.has(draft.coverAssetId)) {
    return draft.coverAssetId;
  }

  return detail.pack.coverAssetId ?? detail.pack.selectedAssetIds[0] ?? detail.assets[0]?.id ?? null;
}

export function buildListingStudioPosterHref(input: {
  packId: string;
  draft: ListingStudioPosterDraft;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  download?: boolean;
  print?: boolean;
}) {
  const params = new URLSearchParams();
  params.set("template", input.draft.templateId);
  params.set("kicker", input.draft.kicker);
  params.set("headline", input.draft.headline);
  params.set("subheadline", input.draft.subheadline);
  params.set("cta", input.draft.cta);
  params.set("footer", input.draft.footer);

  if (input.draft.coverAssetId) {
    params.set("coverAssetId", input.draft.coverAssetId);
  }

  if (input.contactName !== undefined) {
    params.set("contactName", input.contactName);
  }
  if (input.contactTitle !== undefined) {
    params.set("contactTitle", input.contactTitle);
  }
  if (input.contactPhone !== undefined) {
    params.set("contactPhone", input.contactPhone);
  }
  if (input.contactEmail !== undefined) {
    params.set("contactEmail", input.contactEmail);
  }

  if (input.download) {
    params.set("download", "1");
  }

  if (input.print) {
    params.set("print", "1");
  }

  return `/api/listing-studio/listings/${input.packId}/poster?${params.toString()}`;
}

export function buildListingStudioPosterScanTarget(detail: StudioListingDetailSnapshot) {
  return buildPosterPacketTarget(detail);
}

export function buildListingStudioPosterCopyText(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
) {
  const packetTarget = buildPosterPacketTarget(detail);
  const keyFacts = detail.facts
    .slice(0, 4)
    .map((fact) => `${fact.label}: ${fact.value}`)
    .join("\n");
  const bulletPoints = detail.pack.bulletPoints.length
    ? detail.pack.bulletPoints.map((item) => `- ${item}`).join("\n")
    : "- Reply for full details";
  const contactName = normalizeText(detail.pack.contactName, "Acre listing studio");
  const contactTitle = normalizeText(detail.pack.contactTitle, "Listing presentation");
  const contactPhone = normalizeText(detail.pack.contactPhone, "Phone not published");
  const contactEmail = normalizeText(detail.pack.contactEmail, "Email not published");

  return [
    draft.kicker,
    draft.headline,
    draft.subheadline,
    "",
    `Price: ${detail.priceLabel}`,
    `Address: ${detail.addressLine}`,
    detail.locationLine ? `Location: ${detail.locationLine}` : null,
    "",
    "Facts",
    keyFacts,
    "",
    "Bullet points",
    bulletPoints,
    "",
    `CTA: ${draft.cta}`,
    `Footer: ${draft.footer}`,
    "",
    "Agent",
    `Name: ${contactName}`,
    `Title: ${contactTitle}`,
    `Phone: ${contactPhone}`,
    `Email: ${contactEmail}`,
    "",
    "Scan path",
    packetTarget.href,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildListingStudioMarketingKit(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
): ListingStudioMarketingKit {
  const packetTarget = buildPosterPacketTarget(detail);
  const locationLine = normalizeText(detail.locationLine, detail.addressLine);
  const headline = normalizeText(draft.headline, detail.title);
  const summary = normalizeText(
    draft.subheadline,
    detail.descriptionText ?? locationLine,
  );
  const cta = normalizeText(draft.cta, "Reply for full details.");
  const contactName = normalizeText(detail.pack.contactName, "Acre listing studio");
  const contactTitle = normalizeText(detail.pack.contactTitle, "Listing presentation");
  const contactPhone = normalizeText(detail.pack.contactPhone, "Phone not published");
  const contactEmail = normalizeText(detail.pack.contactEmail, "Email not published");
  const bulletSummary = detail.pack.bulletPoints.length
    ? detail.pack.bulletPoints.slice(0, 3).join(" / ")
    : "Reply for full details";
  const factSummary = detail.facts.length
    ? detail.facts.slice(0, 3).map((fact) => `${fact.label}: ${fact.value}`).join(" / ")
    : detail.priceLabel;
  const packetPath = packetTarget.href;
  const summaryLine = joinWithSpaces([
    headline,
    locationLine,
    detail.priceLabel,
    "manual Acre marketing kit",
  ]);
  const socialSection: ListingStudioMarketingKitSection = {
    title: "Social captions",
    subtitle: "Short, copy-ready lines for new-listing posts, reposts, and story shares.",
    variants: [
      {
        id: "caption-short",
        label: "Short caption",
        note: "Fast post",
        text: joinWithSpaces([
          headline,
          "in",
          locationLine,
          "—",
          detail.priceLabel,
          "Reply for the Acre listing page.",
        ]),
      },
      {
        id: "caption-social",
        label: "Social caption",
        note: "Balanced post",
        text: joinWithSpaces(["Just listed:", headline, summary, cta]),
      },
      {
        id: "caption-share",
        label: "Share caption",
        note: "Scan-ready",
        text: joinWithLineBreaks([
          `${detail.priceLabel} | ${locationLine}`,
          bulletSummary,
          `Scan the Acre listing page for photos, facts, and showing details: ${packetPath}`,
        ]),
      },
    ],
  };
  const blurbSection: ListingStudioMarketingKitSection = {
    title: "Listing blurbs",
    subtitle: "Longer copy for newsletters, listing descriptions, and brokerage updates.",
    variants: [
      {
        id: "blurb-paragraph",
        label: "Paragraph blurb",
        note: "Narrative",
        text: joinWithSpaces([
          headline,
          "is packaged as a manual Acre marketing kit for easy sharing.",
          detail.priceLabel,
          "in",
          locationLine,
          summary,
          "The listing page keeps the latest facts, selected visuals, and scan path in one reviewable export.",
        ]),
      },
      {
        id: "blurb-facts",
        label: "Fact-led blurb",
        note: "Bullet-led",
        text: joinWithLineBreaks([
          `Highlights: ${bulletSummary}.`,
          `Facts: ${factSummary}.`,
          `Contact: ${contactName}, ${contactTitle}, ${contactPhone}, ${contactEmail}.`,
        ]),
      },
    ],
  };
  const followupSection: ListingStudioMarketingKitSection = {
    title: "Follow-up notes",
    subtitle: "Message and email versions for post-tour, warm-lead, and reminder follow-up.",
    variants: [
      {
        id: "followup-text",
        label: "Text follow-up",
        note: "Short reply",
        text: joinWithSpaces([
          "Hi there, sharing the Acre listing page for",
          `${headline}.`,
          "It includes the latest facts, selected visuals, and the scan path.",
          cta,
        ]),
      },
      {
        id: "followup-email",
        label: "Email follow-up",
        note: "Long form",
        text: joinWithLineBreaks([
          `Subject: ${headline} listing`,
          "",
          "Hi there,",
          "",
          `I'm sharing the Acre listing page for ${headline}. It includes the latest facts, selected visuals, and a reviewable scan path.`,
          "",
          cta,
          "",
          "Best,",
          contactName,
        ]),
      },
      {
        id: "followup-reminder",
        label: "Reminder note",
        note: "Gentle nudge",
        text: joinWithSpaces([
          "Quick reminder:",
          headline,
          "is still ready on the Acre listing page with photos, facts, and the manual scan path.",
          "Reply if you'd like a tighter version for text or email.",
        ]),
      },
    ],
  };
  const sections = [socialSection, blurbSection, followupSection];
  const bundles: ListingStudioMarketingKitBundle[] = [
    {
      id: "social-bundle",
      title: "Social bundle",
      note: "Post + scan path",
      description:
        "A ready-made social drop with short captioning, a fuller caption, and the share-ready scan line.",
      text: joinWithLineBreaks([
        "Social bundle",
        "",
        ...socialSection.variants.flatMap((variant) => [
          `${variant.label} (${variant.note})`,
          variant.text,
          "",
        ]),
        `Contact: ${contactName} · ${contactPhone}`,
      ]).trim(),
    },
    {
      id: "listing-bundle",
      title: "Listing bundle",
      note: "Blurb + contact",
      description:
        "A longer-form copy set for office updates, newsletters, or listing summaries that still keeps contact details attached.",
      text: joinWithLineBreaks([
        "Listing bundle",
        "",
        ...blurbSection.variants.flatMap((variant) => [
          `${variant.label} (${variant.note})`,
          variant.text,
          "",
        ]),
        `CTA: ${cta}`,
        `Share link: ${packetPath}`,
      ]).trim(),
    },
    {
      id: "followup-bundle",
      title: "Follow-up bundle",
      note: "Text + email + reminder",
      description:
        "A manual follow-up stack for post-tour, warm-lead, or reminder outreach without pretending anything auto-sends.",
      text: joinWithLineBreaks([
        "Follow-up bundle",
        "",
        ...followupSection.variants.flatMap((variant) => [
          `${variant.label} (${variant.note})`,
          variant.text,
          "",
        ]),
        `Contact: ${contactName} · ${contactEmail}`,
      ]).trim(),
    },
  ];
  const templateBriefs: ListingStudioTemplateBrief[] = posterTemplates.map(
    (template) => {
      const isActiveTemplate = template.id === draft.templateId;
      const templateFocus =
        template.id === "editorial"
            ? "Lead with the strongest hero image and price-aware headline so the listing reads like a polished spotlight."
          : template.id === "open-house"
            ? "Make the event timing and next-step CTA obvious so the listing feels invitation-ready."
            : template.id === "social-square"
              ? "Keep the copy short and image-led so the tile can drop into social without rewriting the whole listing page."
              : "Use the summary, bullet points, and contact block as the handout-first version for facts-forward sends.";
      const bestUse =
        template.id === "editorial"
          ? "Best for: new-listing announcement, premium share page preview, broker intro."
          : template.id === "open-house"
            ? "Best for: event invite, showing reminder, quick RSVP push."
            : template.id === "social-square"
              ? "Best for: Instagram tile, story repost, compact feed share."
              : "Best for: PDF handout, saved listing page, facts-forward follow-up.";

      return {
        id: `${template.id}-brief`,
        title: `${template.label} brief`,
        note: isActiveTemplate ? "Current template" : "Alternate template",
        description: `${template.description} ${bestUse}`,
        text: joinWithLineBreaks([
          `${template.label} brief`,
          `Current status: ${isActiveTemplate ? "active draft" : "available variant"}`,
          `Focus: ${templateFocus}`,
          bestUse,
          `Headline: ${headline}`,
          `Subheadline: ${summary}`,
          `CTA: ${cta}`,
          `Share link: ${packetPath}`,
          `Contact: ${contactName} · ${contactPhone} · ${contactEmail}`,
        ]),
      };
    },
  );
  const flights: ListingStudioCampaignFlight[] = [
    {
      id: "new-listing-flight",
      title: "New listing flight",
      note: "Announcement cadence",
      description:
        "Use this when the listing is fresh and you want one manual cadence across poster, social, and listing follow-through.",
      steps: [
        "Start with the editorial or current hero-led poster preview and confirm the scan path.",
        "Copy the social bundle or social send-ready package for the first outward-facing drop.",
        "Follow with the listing bundle or factsheet-style handout when someone asks for more than the tile.",
        "Finish with the follow-up bundle after the first replies or showing interest lands.",
      ],
      text: joinWithLineBreaks([
        "New listing flight",
        `Listing: ${headline} · ${detail.priceLabel}`,
        `Primary poster: ${posterTemplates.find((template) => template.id === draft.templateId)?.label ?? draft.templateId}`,
        `Best share link: ${packetPath}`,
        `Manual CTA: ${cta}`,
      ]),
    },
    {
      id: "open-house-flight",
      title: "Open house flight",
      note: "Event-led cadence",
      description:
        "Use this when the listing should move from invite to reminder to post-tour follow-through without pretending Acre owns the send.",
      steps: [
        "Switch to the open-house template or keep an event-led CTA in the active poster draft.",
        "Use the share caption plus the social send-ready package for the first invite wave.",
        "Send the follow-up package after RSVPs, tour questions, or post-tour replies arrive.",
        "Use the facts sheet brief if the contact asks for a more printable handout after the event.",
      ],
      text: joinWithLineBreaks([
        "Open house flight",
        `Invite anchor: ${headline}`,
        `Event CTA: ${cta}`,
        `Contact block: ${contactName} · ${contactPhone}`,
        `Share link: ${packetPath}`,
      ]),
    },
    {
      id: "evergreen-flight",
      title: "Evergreen follow-through flight",
      note: "Quiet relaunch",
      description:
        "Use this when the listing is still active but the outreach should feel lighter, more factual, and easier to reuse.",
      steps: [
        "Lead with the factsheet brief or listing bundle instead of a heavier announcement.",
        "Use the reminder note from the follow-up bundle to reopen the conversation manually.",
        "Drop in the social-square brief only if a lighter visual refresh helps the next touch.",
        "Keep the same share link and contact block so repeat outreach still lands in one reviewable chain.",
      ],
      text: joinWithLineBreaks([
        "Evergreen follow-through flight",
        `Fact summary: ${factSummary}`,
        `Reminder CTA: ${cta}`,
        `Manual contact: ${contactName} · ${contactEmail}`,
      ]),
    },
  ];
  const deliveryPlanPackages: ListingStudioCampaignPackage[] = [
    {
      id: "social-package",
      title: "Social send-ready package",
      note: "Post + scan path",
      description:
        "A ready-to-paste social package for a new-listing drop, repost, or story share.",
      text: joinWithLineBreaks([
        "Social send-ready package",
        "",
        "Use in this order:",
        "1. Short caption",
        "2. Social caption",
        "3. Share caption",
        "",
        `Best for: ${headline} in ${locationLine}`,
        `Contact: ${contactName} · ${contactPhone}`,
        `Scan path: ${packetPath}`,
      ]).trim(),
    },
    {
      id: "listing-package",
      title: "Listing send-ready package",
      note: "Blurb + contact",
      description:
        "A longer-form listing package for newsletters, office updates, or brokerage summaries.",
      text: joinWithLineBreaks([
        "Listing send-ready package",
        "",
        "Use in this order:",
        "1. Paragraph blurb",
        "2. Fact-led blurb",
        "",
        `Best for: ${headline} summaries and broker-facing writeups.`,
        `CTA: ${cta}`,
        `Share link: ${packetPath}`,
      ]).trim(),
    },
    {
      id: "followup-package",
      title: "Follow-up send-ready package",
      note: "Text + email + reminder",
      description:
        "A manual follow-up package for post-tour notes, warm leads, and reminder outreach.",
      text: joinWithLineBreaks([
        "Follow-up send-ready package",
        "",
        "Use in this order:",
        "1. Text follow-up",
        "2. Email follow-up",
        "3. Reminder note",
        "",
        `Best for: ${headline} follow-up after a showing or listing review.`,
        `Contact: ${contactName} · ${contactEmail}`,
      ]).trim(),
    },
  ];
  const deliveryPlanSequence: ListingStudioCampaignSequenceStep[] = [
    {
      id: "sequence-lock",
      title: "Lock the listing",
      note: "Review the source",
      detail:
        "Confirm the headline, hero asset, contact block, and scan path before copying anything out.",
    },
    {
      id: "sequence-pick",
      title: "Pick a package",
      note: "Match the channel",
      detail:
        "Choose the social, listing, or follow-up package that best fits the next manual send.",
    },
    {
      id: "sequence-copy",
      title: "Copy the bundle",
      note: "Use the ready text",
      detail:
        "Copy the full package or the section block that matches the channel you are preparing.",
    },
    {
      id: "sequence-send",
      title: "Send manually",
      note: "Review first",
      detail:
        "Paste into the target channel, review the message, and send by hand. Acre does not auto-send.",
    },
  ];
  const deliveryPlanChecklist: ListingStudioCampaignChecklistItem[] = [
    {
      id: "checklist-packet",
      title: "Listing summary is ready",
      note: "Headline and summary come from the saved listing.",
      ready: Boolean(headline && summary),
    },
    {
      id: "checklist-contact",
      title: "Contact block is ready",
      note: "The agent name, title, phone, and email stay visible in the package.",
      ready: Boolean(contactName || contactTitle || contactPhone || contactEmail),
    },
    {
      id: "checklist-hero",
      title: "Hero asset is chosen",
      note: "The poster and listing page both point at the same selected visual.",
      ready: Boolean(draft.coverAssetId),
    },
    {
      id: "checklist-scan",
      title: "Scan path is visible",
      note: "The package includes the share link or source-listing path for manual sharing.",
      ready: Boolean(packetPath),
    },
    {
      id: "checklist-manual",
      title: "Manual send only",
      note: "No auto-send or external campaign orchestration is implied by this surface.",
      ready: true,
    },
  ];
  const deliveryPlan: ListingStudioCampaignDeliveryPlan = {
    summary: summaryLine,
    packages: deliveryPlanPackages,
    sequence: deliveryPlanSequence,
    checklist: deliveryPlanChecklist,
  };
  const fullText = [
    summaryLine,
    ...sections.map(formatMarketingSectionText),
    ...templateBriefs.map(formatTemplateBriefText),
    ...flights.map(formatCampaignFlightText),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    summaryLine,
    sections,
    bundles,
    templateBriefs,
    flights,
    deliveryPlan,
    fullText,
  };
}

function buildPosterFacts(detail: StudioListingDetailSnapshot) {
  const facts = detail.facts.slice(0, 4);

  if (!facts.length) {
    return [];
  }

  return facts.map((fact) => `<span class="poster-chip"><strong>${escapeHtml(fact.label)}</strong>${escapeHtml(fact.value)}</span>`);
}

function buildPosterBulletPoints(detail: StudioListingDetailSnapshot) {
  const bulletPoints = detail.pack.bulletPoints.slice(0, 4);

  if (!bulletPoints.length) {
    return `<li>Reply for full details.</li>`;
  }

  return bulletPoints.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("");
}

export function renderListingStudioPosterHtml(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
  options?: { autoPrint?: boolean; baseUrl?: string },
) {
  const heroAssetId = resolveListingStudioPosterCoverAssetId(detail, draft);
  const template = posterTemplates.find((item) => item.id === draft.templateId) ?? posterTemplates[0];
  const heroImageUrl = heroAssetId ? `/api/listing-studio/assets/${heroAssetId}` : null;
  const packetTarget = buildPosterPacketTarget(detail);
  const packetTargetUrl = buildPosterPacketAbsoluteUrl(detail, options?.baseUrl);
  const packetCodeMarkup = buildScanCodeSvgMarkup(packetTargetUrl, packetTarget.label);
  const factsMarkup = buildPosterFacts(detail).join("");
  const bulletMarkup = buildPosterBulletPoints(detail);
  const contactName = normalizeText(detail.pack.contactName, "Acre listing studio");
  const contactTitle = normalizeText(detail.pack.contactTitle, "Listing presentation");
  const contactPhone = normalizeText(detail.pack.contactPhone, "Phone not published");
  const contactEmail = normalizeText(detail.pack.contactEmail, "Email not published");
  const locationLine = normalizeText(detail.locationLine, detail.addressLine);
  const noteLine = detail.pack.agentNote?.trim() || detail.descriptionText || "HTML/CSS poster generated inside Acre.";
  const packetTargetLabel = packetTarget.label;
  const packetTargetHint = packetTarget.hint;
  const layoutLabel =
    draft.templateId === "factsheet"
      ? "Print-first"
      : draft.templateId === "open-house"
        ? "Showing ready"
        : draft.templateId === "social-square"
          ? "Social card"
          : "Editorial";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(detail.title)} - Listing Studio poster</title>
    <style>
      :root {
        color-scheme: light;
        --accent: ${template.accent};
        --accent-soft: color-mix(in srgb, ${template.accent} 15%, white);
        --accent-strong: color-mix(in srgb, ${template.accent} 88%, black);
        --paper: #fffaf3;
        --ink: #102033;
        --muted: rgba(16, 32, 51, 0.72);
        --frame: rgba(16, 32, 51, 0.12);
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        background: ${template.background};
        color: var(--ink);
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
      }
      body {
        min-height: 100vh;
        padding: 28px;
      }
      .poster-page {
        width: min(1080px, 100%);
        min-height: 1350px;
        margin: 0 auto;
        padding: 24px;
        border-radius: 32px;
        border: 1px solid var(--frame);
        background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.92));
        box-shadow: 0 34px 120px rgba(16, 32, 51, 0.18);
        overflow: hidden;
      }
      .poster-shell {
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 22px;
        min-height: 1300px;
      }
      .poster-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        color: var(--muted);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        font-size: 12px;
      }
      .poster-brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        color: var(--accent-strong);
      }
      .poster-brand-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 6px var(--accent-soft);
      }
      .poster-layout {
        display: grid;
        grid-template-columns: ${heroImageUrl ? "1.05fr 0.95fr" : "1fr"};
        gap: 24px;
        align-items: stretch;
      }
      .poster-visual,
      .poster-copy {
        border-radius: 28px;
        overflow: hidden;
        border: 1px solid var(--frame);
        background: rgba(255, 255, 255, 0.8);
      }
      .poster-visual {
        position: relative;
        min-height: 680px;
        background: linear-gradient(160deg, rgba(255,255,255,0.82), rgba(255,255,255,0.96));
      }
      .poster-visual::after {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, transparent), transparent 42%);
        pointer-events: none;
      }
      .poster-image {
        position: absolute;
        inset: 20px;
        border-radius: 24px;
        overflow: hidden;
        background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, white), rgba(255,255,255,0.96));
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55);
      }
      .poster-image img,
      .poster-image-fallback {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .poster-image-fallback {
        display: grid;
        place-items: center;
        padding: 24px;
        text-align: center;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        font-weight: 700;
        color: var(--accent-strong);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.08)),
          radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent) 18%, white), transparent 35%),
          linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78));
      }
      .poster-overlay {
        position: absolute;
        inset: auto 20px 20px 20px;
        display: grid;
        gap: 10px;
        padding: 18px 20px;
        border-radius: 20px;
        color: white;
        background: linear-gradient(180deg, rgba(16,32,51,0.16), rgba(16,32,51,0.84));
        backdrop-filter: blur(8px);
      }
      .poster-overlay strong {
        font-size: 16px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }
      .poster-overlay span {
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.45;
      }
      .poster-copy {
        display: grid;
        gap: 18px;
        padding: 26px;
      }
      .poster-kicker {
        margin: 0;
        color: var(--accent-strong);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .poster-headline {
        margin: 0;
        font-size: clamp(36px, 4.8vw, 72px);
        line-height: 0.98;
        letter-spacing: -0.05em;
      }
      .poster-subhead {
        margin: 0;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.55;
        max-width: 32ch;
      }
      .poster-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .poster-chip {
        display: inline-flex;
        flex-direction: column;
        gap: 4px;
        min-width: 120px;
        padding: 12px 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.9);
        border: 1px solid rgba(16,32,51,0.08);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        font-size: 13px;
        line-height: 1.35;
      }
      .poster-chip strong {
        color: var(--accent-strong);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .poster-cta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 18px 20px;
        border-radius: 20px;
        background: var(--accent);
        color: white;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }
      .poster-cta strong {
        font-size: 18px;
        line-height: 1.3;
      }
      .poster-cta span {
        font-size: 13px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .poster-details {
        display: grid;
        grid-template-columns: ${draft.templateId === "factsheet" ? "repeat(2, minmax(0, 1fr))" : "1fr"};
        gap: 18px;
      }
      .poster-panel {
        padding: 18px 20px;
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(16,32,51,0.08);
      }
      .poster-panel h2,
      .poster-panel h3 {
        margin: 0 0 10px;
        font-size: 15px;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .poster-panel p,
      .poster-panel li {
        margin: 0;
        color: var(--muted);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.55;
      }
      .poster-panel ul {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 8px;
      }
      .poster-footer {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
        gap: 18px;
        padding-top: 6px;
        border-top: 1px solid rgba(16,32,51,0.1);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }
      .poster-footer strong {
        display: block;
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent-strong);
      }
      .poster-footer span,
      .poster-footer a {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }
      .poster-footer .poster-contact {
        display: grid;
        gap: 4px;
      }
      .poster-footer .poster-contact strong:first-child {
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent-strong);
      }
      .poster-footer .poster-contact strong:last-of-type {
        font-size: 18px;
        letter-spacing: -0.02em;
        text-transform: none;
        color: var(--ink);
      }
      .poster-footer .poster-scan {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 14px;
        align-items: center;
        justify-self: end;
        width: 100%;
        padding: 14px 16px;
        border-radius: 22px;
        border: 1px solid rgba(16,32,51,0.08);
        background: rgba(255,255,255,0.9);
      }
      .poster-scan-code {
        width: 148px;
        height: 148px;
        padding: 12px;
        border-radius: 18px;
        color: var(--accent-strong);
        background: white;
        box-shadow: inset 0 0 0 1px rgba(16,32,51,0.08);
      }
      .poster-scan-copy {
        display: grid;
        gap: 6px;
      }
      .poster-scan-copy strong {
        display: block;
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent-strong);
      }
      .poster-scan-copy span,
      .poster-scan-copy a {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }
      .poster-scan-copy a {
        color: var(--accent-strong);
        text-decoration: none;
        word-break: break-word;
      }
      .poster-scan-copy a:hover {
        text-decoration: underline;
      }
      .poster-rail {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 14px;
        justify-content: space-between;
        align-items: center;
      }
      .poster-layout-label {
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.92);
        border: 1px solid rgba(16,32,51,0.08);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent-strong);
      }
      .poster-source {
        max-width: 52ch;
        text-align: right;
      }
      .poster-source a {
        color: var(--accent-strong);
        text-decoration: none;
      }
      .poster-source a:hover {
        text-decoration: underline;
      }
      @media print {
        body {
          padding: 0;
          background: white;
        }
        .poster-page {
          width: 100%;
          min-height: 100vh;
          border-radius: 0;
          box-shadow: none;
          border: 0;
        }
      }
    </style>
  </head>
  <body data-template="${draft.templateId}">
    <main class="poster-page">
      <div class="poster-shell">
        <div class="poster-topline">
          <span class="poster-brand"><span class="poster-brand-dot"></span> Acre Listing Studio</span>
          <span>${escapeHtml(layoutLabel)} · ${escapeHtml(detail.sourceSite)}</span>
        </div>

        <div class="poster-layout">
          <section class="poster-visual">
            ${heroImageUrl ? `<div class="poster-image"><img alt="${escapeHtml(detail.title)}" src="${heroImageUrl}" /></div>` : `<div class="poster-image-fallback">${escapeHtml(detail.title)}<br /><span style="display:block;margin-top:10px;font-weight:500;">${escapeHtml(detail.addressLine)}</span></div>`}
            ${heroImageUrl ? `
              <div class="poster-overlay">
                <strong>${escapeHtml(draft.templateId === "open-house" ? "Showing ready" : draft.templateId === "social-square" ? "Social share" : "Print-ready")}</strong>
                <span>${escapeHtml(detail.priceLabel)} · ${escapeHtml(locationLine)}</span>
              </div>
            ` : ""}
          </section>

          <section class="poster-copy">
            <p class="poster-kicker">${escapeHtml(draft.kicker)}</p>
            <h1 class="poster-headline">${escapeHtml(draft.headline)}</h1>
            <p class="poster-subhead">${escapeHtml(draft.subheadline)}</p>

            ${factsMarkup ? `<div class="poster-chip-row">${factsMarkup}</div>` : ""}

            <div class="poster-cta">
              <strong>${escapeHtml(draft.cta)}</strong>
              <span>${escapeHtml(detail.priceLabel)}</span>
            </div>

            <div class="poster-details">
              <div class="poster-panel">
                <h2>Key points</h2>
                <ul>${bulletMarkup}</ul>
              </div>
              <div class="poster-panel">
                <h3>Source note</h3>
                <p>${escapeHtml(noteLine)}</p>
              </div>
            </div>

              <div class="poster-footer">
                <div class="poster-contact">
                  <strong>Agent info</strong>
                  <strong>${escapeHtml(contactName)}</strong>
                  <span>${escapeHtml(contactTitle)}</span>
                  <span>${escapeHtml(contactPhone)} · ${escapeHtml(contactEmail)}</span>
                  <span>${escapeHtml(draft.footer)}</span>
                  <span>${escapeHtml(detail.pack.agentNote?.trim() || "Acre keeps this listing reviewable and shareable.")}</span>
                </div>
              <div class="poster-scan">
                ${packetCodeMarkup}
                <div class="poster-scan-copy">
                  <strong>Scan path</strong>
                  <span>${escapeHtml(packetTargetLabel)}</span>
                  <span>${escapeHtml(packetTargetHint)}</span>
                  <span>${escapeHtml(draft.footer)}</span>
                  <a href="${escapeHtml(packetTargetUrl)}" rel="noreferrer" target="_blank">${escapeHtml(packetTargetUrl)}</a>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="poster-rail">
          <span class="poster-layout-label">${escapeHtml(layoutLabel)}</span>
          <span class="poster-layout-label">${escapeHtml(detail.sourceSite)}</span>
          <span class="poster-layout-label">${escapeHtml(detail.listingType ?? detail.statusLabel ?? "Saved listing")}</span>
        </div>
      </div>
    </main>
    ${options?.autoPrint ? "<script>window.addEventListener('load', function () { window.print(); });</script>" : ""}
  </body>
</html>`;
}

export function buildListingStudioPosterFileName(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
) {
  const safeTitle =
    detail.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "listing";

  return `${safeTitle}-${draft.templateId}-poster.html`;
}
