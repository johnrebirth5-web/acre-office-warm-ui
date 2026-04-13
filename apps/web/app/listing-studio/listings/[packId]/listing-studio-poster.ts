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

function buildPosterPacketTarget(detail: StudioListingDetailSnapshot): ListingStudioPacketTarget {
  if (detail.pack.shareEnabled && detail.pack.shareCode) {
    return {
      href: `/share/packs/${detail.pack.shareCode}`,
      label: "Live packet",
      hint: "Scan this code to open the public Acre packet.",
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
  const firstBullet = detail.pack.bulletPoints[0] || detail.facts[0]?.value || "Reply for the full packet";
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
        cta: "See the full packet and send it to a client.",
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
        cta: "Request the full packet and share the print-ready view.",
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
    : "- Reply for the full packet";
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
    return `<li>Reply for the full packet.</li>`;
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
                  <span>${escapeHtml(detail.pack.agentNote?.trim() || "Acre keeps this packet reviewable and shareable.")}</span>
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
          <span class="poster-layout-label">${escapeHtml(detail.listingType ?? detail.statusLabel ?? "Listing packet")}</span>
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
