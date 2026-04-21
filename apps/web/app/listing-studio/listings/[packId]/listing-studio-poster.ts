import type { StudioListingDetailSnapshot } from "@acre/db";

export type ListingStudioPosterTemplateId =
  | "card"
  | "editorial"
  | "hero"
  | "cinematic"
  | "grid";

export type ListingStudioPosterStatusVariantId =
  | "just-listed"
  | "in-contract"
  | "price-reduced"
  | "open-house"
  | "sold";

export type ListingStudioPosterFormat = "html" | "png" | "svg";

export type ListingStudioPosterTemplate = {
  id: ListingStudioPosterTemplateId;
  label: string;
  description: string;
};

export type ListingStudioPosterStatusVariant = {
  id: ListingStudioPosterStatusVariantId;
  label: string;
};

export type ListingStudioPosterDraft = {
  templateId: ListingStudioPosterTemplateId;
  coverAssetId: string | null;
  statusVariant: ListingStudioPosterStatusVariantId;
};

type PosterImageAsset = StudioListingDetailSnapshot["assets"][number];

type PosterRenderOptions = {
  baseUrl?: string;
  embedAssets?: boolean;
  requestHeaders?: HeadersInit;
};

type PosterImageSource = {
  fallbackLabel: string;
  href: string | null;
};

type PosterFact = {
  label: string;
  value: string;
};

type PosterStatusConfig = {
  badgeLabel: string;
  compactLabel: string;
  title: string;
};

const posterTemplates: ListingStudioPosterTemplate[] = [
  {
    id: "hero",
    label: "Hero",
    description: "Centered headline, price callout, hero image, fact bar, and contact footer.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Magazine-like sheet with hero, supporting photos, plan block, and property facts.",
  },
  {
    id: "card",
    label: "Card",
    description: "Image-led card with a clean information panel and bottom contact strip.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Full-bleed image poster with a dramatic lower overlay and QR anchor.",
  },
  {
    id: "grid",
    label: "Grid",
    description: "Split gallery composition with price rail, three facts, and footer.",
  },
];

const posterStatusVariants: ListingStudioPosterStatusVariant[] = [
  { id: "just-listed", label: "JUST LISTED" },
  { id: "in-contract", label: "IN CONTRACT" },
  { id: "price-reduced", label: "PRICE REDUCED" },
  { id: "open-house", label: "OPEN HOUSE" },
  { id: "sold", label: "SOLD" },
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}...`;
}

function normalizeText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length ? trimmed : fallback;
}

function normalizeTemplateId(
  value: string | null | undefined,
): ListingStudioPosterTemplateId {
  switch (value) {
    case "card":
    case "editorial":
    case "cinematic":
    case "grid":
    case "hero":
      return value;
    default:
      return "hero";
  }
}

function normalizeStatusVariantId(
  value: string | null | undefined,
): ListingStudioPosterStatusVariantId {
  switch (value) {
    case "in-contract":
    case "price-reduced":
    case "open-house":
    case "sold":
    case "just-listed":
      return value;
    default:
      return "just-listed";
  }
}

function isPhotoAsset(asset: PosterImageAsset) {
  const isPhotoKind = asset.kind === "hero" || asset.kind === "gallery";
  const isVideoMime =
    typeof asset.mimeType === "string" &&
    asset.mimeType.toLowerCase().startsWith("video/");

  return isPhotoKind && !isVideoMime;
}

function isPdfLike(url: string | null | undefined, mimeType?: string | null) {
  if (mimeType?.toLowerCase().includes("pdf")) {
    return true;
  }

  return typeof url === "string" && /\.pdf(?:$|\?)/i.test(url);
}

function buildAssetUrl(baseUrl: string | undefined, assetId: string) {
  const path = `/api/listing-studio/assets/${assetId}`;

  if (!baseUrl) {
    return path;
  }

  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function buildPhotoAssetCandidates(detail: StudioListingDetailSnapshot) {
  const photos = detail.assets.filter((asset) => isPhotoAsset(asset));
  const byId = new Map(photos.map((asset) => [asset.id, asset] as const));
  const ordered: PosterImageAsset[] = [];

  for (const assetId of detail.pack.selectedAssetIds) {
    const asset = byId.get(assetId);
    if (asset) {
      ordered.push(asset);
      byId.delete(assetId);
    }
  }

  for (const asset of photos) {
    if (!byId.has(asset.id)) {
      continue;
    }
    ordered.push(asset);
    byId.delete(asset.id);
  }

  return ordered;
}

function buildPosterImageSources(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
  baseUrl?: string,
) {
  const photoAssets = buildPhotoAssetCandidates(detail);
  const byId = new Map(photoAssets.map((asset) => [asset.id, asset] as const));
  const primaryAsset =
    (draft.coverAssetId ? byId.get(draft.coverAssetId) : undefined) ??
    (detail.pack.coverAssetId ? byId.get(detail.pack.coverAssetId) : undefined) ??
    photoAssets[0] ??
    null;
  const secondaryAssets = photoAssets
    .filter((asset) => asset.id !== primaryAsset?.id)
    .slice(0, 4);

  const floorPlanAsset = detail.assets.find(
    (asset) => asset.kind === "floor_plan" && !isPdfLike(null, asset.mimeType),
  );
  const floorPlanHref = floorPlanAsset
    ? buildAssetUrl(baseUrl, floorPlanAsset.id)
    : detail.floorPlans[0]?.assetId
      ? buildAssetUrl(baseUrl, detail.floorPlans[0].assetId)
      : !isPdfLike(detail.floorPlans[0]?.url ?? null)
        ? detail.floorPlans[0]?.url ?? null
        : null;

  return {
    primary: {
      fallbackLabel: truncateText(detail.addressLine, 48),
      href: primaryAsset ? buildAssetUrl(baseUrl, primaryAsset.id) : null,
    },
    secondary: secondaryAssets.map((asset, index) => ({
      fallbackLabel: `Photo ${index + 2}`,
      href: buildAssetUrl(baseUrl, asset.id),
    })),
    floorPlan: {
      fallbackLabel: "Floor plan unavailable",
      href: floorPlanHref,
    },
  };
}

function buildPosterPacketTarget(detail: StudioListingDetailSnapshot) {
  if (detail.pack.shareCode?.trim()) {
    return `/share/packs/${detail.pack.shareCode}`;
  }

  return detail.sourceUrl;
}

function buildPosterPacketAbsoluteUrl(
  detail: StudioListingDetailSnapshot,
  baseUrl?: string,
) {
  const href = buildPosterPacketTarget(detail);

  if (!baseUrl) {
    return href;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function buildDeterministicDigestBytes(value: string, length = 32) {
  const encoder = new TextEncoder();
  const input = encoder.encode(value);
  const source = input.length ? input : new Uint8Array([0]);
  const bytes: number[] = [];
  let seed = 0x811c9dc5;

  for (const unit of source) {
    seed ^= unit;
    seed = Math.imul(seed, 0x01000193) >>> 0;
    seed ^= seed >>> 13;
    seed = Math.imul(seed, 0x85ebca6b) >>> 0;
  }

  while (bytes.length < length) {
    seed = (seed + 0x9e3779b9) >>> 0;
    let mixed = seed;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x85ebca6b) >>> 0;
    mixed ^= mixed >>> 13;
    mixed = Math.imul(mixed, 0xc2b2ae35) >>> 0;
    mixed ^= mixed >>> 16;
    bytes.push(
      mixed & 0xff,
      (mixed >>> 8) & 0xff,
      (mixed >>> 16) & 0xff,
      (mixed >>> 24) & 0xff,
    );
  }

  return bytes.slice(0, length);
}

function buildQrLikeMatrix(value: string, size = 29) {
  const matrix = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  const reserved = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  const digest = buildDeterministicDigestBytes(value);

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

      const byte = digest[(x * 5 + y * 7 + bitIndex) % digest.length];
      const bit = (byte >> (bitIndex % 8)) & 1;
      const mix = ((x + y + bitIndex) % 3) === 0;
      matrix[y][x] = Boolean(bit ^ Number(mix));
      bitIndex += 1;
    }
  }

  return matrix;
}

function renderQrCode(value: string, x: number, y: number, size: number) {
  const matrix = buildQrLikeMatrix(value);
  const quietZone = 4;
  const unit = size / (matrix.length + quietZone * 2);
  const rects: string[] = [];

  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix.length; column += 1) {
      if (!matrix[row][column]) {
        continue;
      }

      rects.push(
        `<rect x="${(x + (column + quietZone) * unit).toFixed(2)}" y="${(y + (row + quietZone) * unit).toFixed(2)}" width="${unit.toFixed(2)}" height="${unit.toFixed(2)}" rx="${Math.max(unit * 0.08, 0.4).toFixed(2)}" />`,
      );
    }
  }

  return `
    <g>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${Math.max(size * 0.08, 10)}" fill="#ffffff" />
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${Math.max(size * 0.08, 10)}" fill="none" stroke="rgba(15,23,42,0.10)" stroke-width="2" />
      <g fill="#111827">${rects.join("")}</g>
    </g>
  `;
}

function extractFactValue(
  detail: StudioListingDetailSnapshot,
  matcher: RegExp,
  fallback?: string | null,
) {
  const source = [...detail.facts, ...detail.sourceFacts];
  const match = source.find((fact) => matcher.test(fact.label));

  return match?.value ?? fallback ?? null;
}

function buildPosterFacts(detail: StudioListingDetailSnapshot): PosterFact[] {
  const bedrooms =
    extractFactValue(detail, /bed/i, detail.bedrooms !== null ? String(detail.bedrooms) : null) ??
    "—";
  const bathrooms =
    extractFactValue(
      detail,
      /bath/i,
      detail.bathrooms !== null ? String(detail.bathrooms) : null,
    ) ?? "—";
  const squareFeet =
    extractFactValue(
      detail,
      /(sq.? ?ft|square feet|interior)/i,
      detail.sqft !== null ? `${detail.sqft}` : null,
    ) ?? "—";

  return [
    { label: "BEDROOMS", value: bedrooms },
    { label: "BATHROOMS", value: bathrooms },
    { label: "SF", value: squareFeet },
  ];
}

function buildAmenityLabels(detail: StudioListingDetailSnapshot, limit = 6) {
  const items = detail.amenities.flatMap((section) => section.items);
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildPosterStatusConfig(
  statusVariant: ListingStudioPosterStatusVariantId,
): PosterStatusConfig {
  switch (statusVariant) {
    case "in-contract":
      return {
        badgeLabel: "PENDING",
        compactLabel: "IN CONTRACT",
        title: "IN CONTRACT",
      };
    case "price-reduced":
      return {
        badgeLabel: "NEW PRICE",
        compactLabel: "PRICE REDUCED",
        title: "PRICE REDUCED",
      };
    case "open-house":
      return {
        badgeLabel: "EVENT",
        compactLabel: "OPEN HOUSE",
        title: "OPEN HOUSE",
      };
    case "sold":
      return {
        badgeLabel: "CLOSED",
        compactLabel: "SOLD",
        title: "SOLD",
      };
    case "just-listed":
    default:
      return {
        badgeLabel: "NEW",
        compactLabel: "NEW LISTING",
        title: "JUST LISTED",
      };
  }
}

function buildUnitLabel(detail: StudioListingDetailSnapshot) {
  const match =
    detail.addressLine.match(/#\s*([A-Za-z0-9-]+)/) ??
    detail.addressLine.match(/\b(?:APT|UNIT|PH)\s*([A-Za-z0-9-]+)/i);

  return match?.[1]?.toUpperCase() ?? "";
}

function buildToplineLabel(detail: StudioListingDetailSnapshot) {
  return truncateText(
    normalizeText(detail.buildingName, detail.addressLine).toUpperCase(),
    42,
  );
}

function buildLocationLine(detail: StudioListingDetailSnapshot) {
  return truncateText(normalizeText(detail.locationLine, detail.addressLine), 72);
}

function buildContactSnapshot(detail: StudioListingDetailSnapshot) {
  const name = normalizeText(detail.pack.contactName, "Listing contact");
  const title = normalizeText(detail.pack.contactTitle, "Licensed real estate salesperson");
  const phone = normalizeText(detail.pack.contactPhone, "Phone on request");
  const email = normalizeText(detail.pack.contactEmail, "Email on request");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");

  return {
    email,
    initials: initials || "LS",
    name,
    phone,
    title,
  };
}

function renderImageSlot(input: {
  id: string;
  source: PosterImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fit?: "meet" | "slice";
}) {
  const clipId = `poster-clip-${input.id}`;
  const fallback = `
    <rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="${input.radius}" fill="#ece7dd" />
    <text x="${input.x + input.width / 2}" y="${input.y + input.height / 2}" fill="#6b7280" font-family="'Helvetica Neue', Arial, sans-serif" font-size="48" font-weight="600" text-anchor="middle">${escapeXml(
      truncateText(input.source.fallbackLabel, 28),
    )}</text>
  `;

  if (!input.source.href) {
    return fallback;
  }

  return `
    <defs>
      <clipPath id="${clipId}">
        <rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="${input.radius}" />
      </clipPath>
    </defs>
    <rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="${input.radius}" fill="#ece7dd" />
    <image href="${escapeXml(input.source.href)}" x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" preserveAspectRatio="${
      input.fit === "meet" ? "xMidYMid meet" : "xMidYMid slice"
    }" clip-path="url(#${clipId})" />
  `;
}

function renderAmenityChips(input: {
  items: string[];
  x: number;
  y: number;
  maxWidth: number;
  dark?: boolean;
}) {
  const chips: string[] = [];
  let cursorX = input.x;
  let cursorY = input.y;
  const rowHeight = 62;

  for (const item of input.items) {
    const safeLabel = truncateText(item, 24);
    const chipWidth = Math.min(
      240,
      Math.max(160, safeLabel.length * 18 + 54),
    );

    if (cursorX + chipWidth > input.x + input.maxWidth) {
      cursorX = input.x;
      cursorY += rowHeight;
    }

    chips.push(`
      <rect x="${cursorX}" y="${cursorY}" width="${chipWidth}" height="46" rx="23" fill="${
        input.dark ? "rgba(255,255,255,0.10)" : "#ffffff"
      }" stroke="${input.dark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.10)"}" stroke-width="2" />
      <text x="${cursorX + chipWidth / 2}" y="${cursorY + 30}" fill="${
        input.dark ? "#f8fafc" : "#111827"
      }" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26" font-weight="600" text-anchor="middle">${escapeXml(
        safeLabel,
      )}</text>
    `);

    cursorX += chipWidth + 20;
  }

  return chips.join("");
}

function renderFactsRow(
  facts: PosterFact[],
  y: number,
  options?: { light?: boolean; width?: number; x?: number },
) {
  const startX = options?.x ?? 0;
  const width = options?.width ?? 2160;
  const columnWidth = width / 3;
  const textColor = options?.light === false ? "#f8fafc" : "#111827";
  const subtle = options?.light === false ? "rgba(248,250,252,0.72)" : "#9ca3af";
  const divider = options?.light === false ? "rgba(248,250,252,0.18)" : "rgba(15,23,42,0.10)";

  return `
    <g>
      ${facts
        .map((fact, index) => {
          const centerX = startX + columnWidth * index + columnWidth / 2;
          const dividerX = startX + columnWidth * index;

          return `
            ${
              index === 0
                ? ""
                : `<line x1="${dividerX}" y1="${y + 12}" x2="${dividerX}" y2="${
                    y + 112
                  }" stroke="${divider}" stroke-width="2" />`
            }
            <text x="${centerX}" y="${y + 58}" fill="${textColor}" font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="700" text-anchor="middle">${escapeXml(
              truncateText(fact.value, 12),
            )}</text>
            <text x="${centerX}" y="${y + 92}" fill="${subtle}" font-family="'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="6" text-anchor="middle">${escapeXml(
              fact.label,
            )}</text>
          `;
        })
        .join("")}
    </g>
  `;
}

function renderAvatar(initials: string, x: number, y: number, size: number) {
  return `
    <g>
      <circle cx="${x + size / 2}" cy="${y + size / 2}" r="${
        size / 2
      }" fill="#dbe4f5" />
      <circle cx="${x + size / 2}" cy="${y + size / 2}" r="${
        size / 2 - 4
      }" fill="#f8fafc" />
      <text x="${x + size / 2}" y="${y + size / 2 + 18}" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${
        size * 0.32
      }" font-weight="700" text-anchor="middle">${escapeXml(initials)}</text>
    </g>
  `;
}

function renderFooterLight(input: {
  contact: ReturnType<typeof buildContactSnapshot>;
  qrMarkup: string;
  y: number;
}) {
  return `
    <g>
      <line x1="0" y1="${input.y}" x2="2160" y2="${input.y}" stroke="rgba(15,23,42,0.10)" stroke-width="2" />
      ${renderAvatar(input.contact.initials, 70, input.y + 44, 112)}
      <text x="220" y="${input.y + 88}" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="42" font-weight="700">${escapeXml(
        truncateText(input.contact.name, 28),
      )}</text>
      <text x="220" y="${input.y + 132}" fill="#6b7280" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(
        truncateText(input.contact.title, 44),
      )}</text>
      <text x="220" y="${input.y + 186}" fill="#4b5563" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(
        truncateText(input.contact.phone, 30),
      )}</text>
      <text x="220" y="${input.y + 226}" fill="#4b5563" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(
        truncateText(input.contact.email, 38),
      )}</text>

      <text x="1450" y="${input.y + 140}" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="30" font-weight="600">${escapeXml(
        truncateText(input.contact.phone, 30),
      )}</text>
      <text x="1450" y="${input.y + 184}" fill="#4b5563" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(
        truncateText(input.contact.email, 38),
      )}</text>

      ${input.qrMarkup}
      <text x="1880" y="${input.y + 262}" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="4" text-anchor="middle">SCAN TO VIEW</text>
    </g>
  `;
}

function renderFooterDark(input: {
  contact: ReturnType<typeof buildContactSnapshot>;
  qrMarkup: string;
}) {
  return `
    <g>
      <text x="72" y="2680" fill="#f8fafc" font-family="'Helvetica Neue', Arial, sans-serif" font-size="38" font-weight="700">${escapeXml(
        truncateText(input.contact.name, 28),
      )}</text>
      <text x="72" y="2726" fill="rgba(248,250,252,0.80)" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(
        truncateText(input.contact.phone, 30),
      )} · ${escapeXml(truncateText(input.contact.email, 32))}</text>
      ${input.qrMarkup}
      <text x="1930" y="2754" fill="rgba(248,250,252,0.76)" font-family="'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="4" text-anchor="middle">SCAN TO VIEW</text>
    </g>
  `;
}

async function resolveImageHref(
  source: PosterImageSource,
  options: PosterRenderOptions,
) {
  if (!source.href || !options.embedAssets || !options.baseUrl) {
    return source;
  }

  try {
    const response = await fetch(source.href, {
      cache: "no-store",
      headers: options.requestHeaders,
    });

    if (!response.ok) {
      return source;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get("content-type") ?? "image/jpeg";

    return {
      ...source,
      href: `data:${contentType};base64,${buffer.toString("base64")}`,
    };
  } catch {
    return source;
  }
}

async function resolvePosterImageSources(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
  options: PosterRenderOptions,
) {
  const sources = buildPosterImageSources(detail, draft, options.baseUrl);

  return {
    floorPlan: await resolveImageHref(sources.floorPlan, options),
    primary: await resolveImageHref(sources.primary, options),
    secondary: await Promise.all(
      sources.secondary.map((source) => resolveImageHref(source, options)),
    ),
  };
}

function renderHeroTemplate(input: {
  detail: StudioListingDetailSnapshot;
  draft: ListingStudioPosterDraft;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
  facts: PosterFact[];
  qrMarkup: string;
  status: PosterStatusConfig;
  topline: string;
  locationLine: string;
}) {
  return `
    <rect width="2160" height="2880" fill="#f7f4ee" />
    <text x="1080" y="104" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="600" letter-spacing="4" text-anchor="middle">${escapeXml(
      input.topline,
    )}</text>
    <text x="1080" y="238" fill="#111827" font-family="Georgia, 'Times New Roman', serif" font-size="116" font-weight="700" text-anchor="middle">${escapeXml(
      input.status.title,
    )}</text>
    <text x="1080" y="316" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="34" font-weight="500" letter-spacing="2" text-anchor="middle">${escapeXml(
      truncateText(input.detail.addressLine, 44),
    )}</text>
    <rect x="1668" y="64" width="200" height="52" rx="14" fill="#2d2e33" />
    <text x="1768" y="98" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="2" text-anchor="middle">${escapeXml(
      input.status.badgeLabel,
    )}</text>

    <rect x="760" y="370" width="640" height="154" rx="26" fill="#d7d4cf" stroke="rgba(15,23,42,0.08)" stroke-width="2" />
    <text x="1080" y="470" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="78" font-weight="800" text-anchor="middle">${escapeXml(
      input.detail.priceLabel,
    )}</text>

    ${renderImageSlot({
      fit: "slice",
      height: 1458,
      id: "hero-primary",
      radius: 0,
      source: input.images.primary,
      width: 2160,
      x: 0,
      y: 570,
    })}

    <rect x="0" y="2028" width="2160" height="212" fill="#ffffff" />
    ${renderFactsRow(input.facts, 2070, { width: 2160, x: 0 })}
    ${renderFooterLight({
      contact: input.contact,
      qrMarkup: input.qrMarkup,
      y: 2240,
    })}
  `;
}

function renderCardTemplate(input: {
  detail: StudioListingDetailSnapshot;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
  qrMarkup: string;
  status: PosterStatusConfig;
  locationLine: string;
  amenityLabels: string[];
}) {
  return `
    <rect width="2160" height="2880" fill="#f6f3ee" />
    ${renderImageSlot({
      fit: "slice",
      height: 1620,
      id: "card-primary",
      radius: 0,
      source: input.images.primary,
      width: 2160,
      x: 0,
      y: 0,
    })}
    <rect x="56" y="54" width="456" height="124" rx="18" fill="#2d2e33" />
    <text x="284" y="132" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="52" font-weight="700" letter-spacing="3" text-anchor="middle">${escapeXml(
      input.status.compactLabel,
    )}</text>

    <rect x="0" y="1470" width="2160" height="1410" fill="#fbfbfa" />
    <rect x="0" y="1416" width="2160" height="260" fill="url(#card-fade)" />
    <defs>
      <linearGradient id="card-fade" x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(251,251,250,0)" />
        <stop offset="100%" stop-color="#fbfbfa" />
      </linearGradient>
    </defs>

    <text x="70" y="1770" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="108" font-weight="800">${escapeXml(
      input.detail.priceLabel,
    )}</text>
    <text x="70" y="1866" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="40">${escapeXml(
      truncateText(input.locationLine, 42),
    )}</text>
    <text x="70" y="2010" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="68" font-weight="700">${escapeXml(
      truncateText(input.detail.addressLine, 42),
    )}</text>
    <text x="70" y="2100" fill="#6b7280" font-family="'Helvetica Neue', Arial, sans-serif" font-size="40">${escapeXml(
      buildPosterFacts(input.detail)
        .map((fact) => `${fact.value} ${fact.label === "SF" ? "SF" : fact.label === "BATHROOMS" ? "Bath" : "Bed"}`)
        .join(" · "),
    )}</text>

    ${renderAmenityChips({
      items: input.amenityLabels,
      maxWidth: 1720,
      x: 70,
      y: 2200,
    })}
    ${renderFooterLight({
      contact: input.contact,
      qrMarkup: input.qrMarkup,
      y: 2448,
    })}
  `;
}

function renderCinematicTemplate(input: {
  detail: StudioListingDetailSnapshot;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
  qrMarkup: string;
  status: PosterStatusConfig;
  locationLine: string;
  facts: PosterFact[];
}) {
  return `
    <defs>
      <linearGradient id="cinematic-overlay" x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(15,23,42,0)" />
        <stop offset="100%" stop-color="rgba(15,23,42,0.92)" />
      </linearGradient>
    </defs>
    ${renderImageSlot({
      fit: "slice",
      height: 2880,
      id: "cinematic-primary",
      radius: 0,
      source: input.images.primary,
      width: 2160,
      x: 0,
      y: 0,
    })}
    <rect x="0" y="0" width="2160" height="2880" fill="url(#cinematic-overlay)" />
    <rect x="56" y="54" width="456" height="124" rx="18" fill="#2d2e33" />
    <text x="284" y="132" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="52" font-weight="700" letter-spacing="3" text-anchor="middle">${escapeXml(
      input.status.compactLabel,
    )}</text>
    <text x="68" y="2310" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="98" font-weight="800">${escapeXml(
      input.detail.priceLabel,
    )}</text>
    <text x="68" y="2400" fill="rgba(255,255,255,0.82)" font-family="'Helvetica Neue', Arial, sans-serif" font-size="42">${escapeXml(
      input.facts
        .map((fact) => `${fact.value} ${fact.label === "SF" ? "SF" : fact.label === "BATHROOMS" ? "Bath" : "Bed"}`)
        .join(" · "),
    )}</text>
    <text x="68" y="2498" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="54" font-weight="700">${escapeXml(
      truncateText(input.detail.addressLine, 44),
    )}</text>
    <text x="68" y="2560" fill="rgba(255,255,255,0.76)" font-family="'Helvetica Neue', Arial, sans-serif" font-size="34">${escapeXml(
      truncateText(input.locationLine, 44),
    )}</text>
    ${renderFooterDark({
      contact: input.contact,
      qrMarkup: input.qrMarkup,
    })}
  `;
}

function renderGridTemplate(input: {
  detail: StudioListingDetailSnapshot;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
  facts: PosterFact[];
  qrMarkup: string;
  status: PosterStatusConfig;
  topline: string;
}) {
  const topRightPrice = truncateText(input.detail.priceLabel, 18);

  return `
    <rect width="2160" height="2880" fill="#f7f4ee" />
    <text x="70" y="84" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="600" letter-spacing="4">${escapeXml(
      input.topline,
    )}</text>
    <text x="70" y="220" fill="#111827" font-family="Georgia, 'Times New Roman', serif" font-size="114" font-weight="700">${escapeXml(
      input.status.title,
    )}</text>
    <text x="70" y="302" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="34">${escapeXml(
      truncateText(input.detail.addressLine, 44),
    )}</text>
    <rect x="1888" y="62" width="196" height="52" rx="14" fill="#2d2e33" />
    <text x="1986" y="97" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="2" text-anchor="middle">${escapeXml(
      input.status.badgeLabel,
    )}</text>
    <line x1="1548" y1="88" x2="1548" y2="256" stroke="#111827" stroke-width="7" />
    <text x="1604" y="204" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="86" font-weight="800">${escapeXml(
      topRightPrice,
    )}</text>

    ${renderImageSlot({
      fit: "slice",
      height: 1450,
      id: "grid-primary",
      radius: 0,
      source: input.images.primary,
      width: 1098,
      x: 0,
      y: 390,
    })}
    ${renderImageSlot({
      fit: "slice",
      height: 700,
      id: "grid-secondary-1",
      radius: 0,
      source: input.images.secondary[0] ?? input.images.primary,
      width: 1062,
      x: 1098,
      y: 390,
    })}
    ${renderImageSlot({
      fit: "slice",
      height: 750,
      id: "grid-secondary-2",
      radius: 0,
      source: input.images.secondary[1] ?? input.images.secondary[0] ?? input.images.primary,
      width: 1062,
      x: 1098,
      y: 1110,
    })}

    <rect x="0" y="1908" width="2160" height="202" fill="#ffffff" />
    ${renderFactsRow(input.facts, 1950, { width: 2160, x: 0 })}
    ${renderFooterLight({
      contact: input.contact,
      qrMarkup: input.qrMarkup,
      y: 2110,
    })}
  `;
}

function renderEditorialTemplate(input: {
  detail: StudioListingDetailSnapshot;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
  facts: PosterFact[];
  qrMarkup: string;
  status: PosterStatusConfig;
  topline: string;
  unitLabel: string;
  locationLine: string;
  amenityLabels: string[];
}) {
  const secondaryOne = input.images.secondary[0] ?? input.images.primary;
  const secondaryTwo = input.images.secondary[1] ?? input.images.primary;
  const secondaryThree = input.images.secondary[2] ?? input.images.primary;
  const floorPlanSource =
    input.images.floorPlan.href !== null
      ? input.images.floorPlan
      : secondaryThree;

  return `
    <rect width="2160" height="2880" fill="#f8f6f1" />
    <text x="70" y="120" fill="#111827" font-family="Georgia, 'Times New Roman', serif" font-size="106" font-weight="700">${escapeXml(
      input.status.title,
    )}</text>
    <text x="70" y="204" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="42" font-weight="700">${escapeXml(
      truncateText(input.topline, 32),
    )}</text>
    <text x="70" y="272" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="34">${escapeXml(
      truncateText(input.detail.addressLine, 48),
    )}</text>
    <rect x="1842" y="52" width="196" height="52" rx="14" fill="#2d2e33" />
    <text x="1940" y="87" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="2" text-anchor="middle">${escapeXml(
      input.status.badgeLabel,
    )}</text>
    ${
      input.unitLabel
        ? `<text x="1930" y="184" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="104" font-weight="800" text-anchor="middle">${escapeXml(
            input.unitLabel,
          )}</text>`
        : ""
    }

    ${renderImageSlot({
      fit: "slice",
      height: 1030,
      id: "editorial-primary",
      radius: 0,
      source: input.images.primary,
      width: 2160,
      x: 0,
      y: 332,
    })}
    ${renderImageSlot({
      fit: "slice",
      height: 336,
      id: "editorial-secondary-1",
      radius: 12,
      source: secondaryOne,
      width: 700,
      x: 0,
      y: 1378,
    })}
    ${renderImageSlot({
      fit: "slice",
      height: 336,
      id: "editorial-secondary-2",
      radius: 12,
      source: secondaryTwo,
      width: 722,
      x: 719,
      y: 1378,
    })}
    ${renderImageSlot({
      fit: "slice",
      height: 336,
      id: "editorial-secondary-3",
      radius: 12,
      source: secondaryThree,
      width: 700,
      x: 1460,
      y: 1378,
    })}

    <text x="80" y="1820" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="6">FLOOR PLAN</text>
    <line x1="80" y1="1850" x2="812" y2="1850" stroke="rgba(15,23,42,0.10)" stroke-width="2" />
    ${renderImageSlot({
      fit: "meet",
      height: 610,
      id: "editorial-floor-plan",
      radius: 0,
      source: floorPlanSource,
      width: 760,
      x: 70,
      y: 1890,
    })}

    <text x="960" y="1920" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="6">ASKING PRICE</text>
    <text x="960" y="2050" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="110" font-weight="800">${escapeXml(
      input.detail.priceLabel,
    )}</text>
    <text x="960" y="2140" fill="#6b7280" font-family="'Helvetica Neue', Arial, sans-serif" font-size="42">${escapeXml(
      input.facts
        .map((fact) => `${fact.value} ${fact.label === "SF" ? "SF" : fact.label === "BATHROOMS" ? "baths" : "beds"}`)
        .join(" · "),
    )}</text>
    <text x="960" y="2228" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="54" font-weight="700">${escapeXml(
      truncateText(
        input.detail.neighborhood
          ? `${input.detail.neighborhood}${input.detail.locationLine ? `, ${input.detail.locationLine.split(",")[0]}` : ""}`
          : input.locationLine,
        32,
      ),
    )}</text>
    <text x="960" y="2300" fill="#9ca3af" font-family="'Helvetica Neue', Arial, sans-serif" font-size="36">${escapeXml(
      truncateText(input.detail.addressLine, 46),
    )}</text>
    <text x="960" y="2388" fill="#374151" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="4">AMENITIES &amp; BUILDING</text>
    ${renderAmenityChips({
      items: input.amenityLabels,
      maxWidth: 1120,
      x: 960,
      y: 2420,
    })}

    ${renderFooterLight({
      contact: input.contact,
      qrMarkup: input.qrMarkup,
      y: 2560,
    })}
  `;
}

async function renderPosterBody(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
  options: PosterRenderOptions,
) {
  const facts = buildPosterFacts(detail);
  const topline = buildToplineLabel(detail);
  const locationLine = buildLocationLine(detail);
  const unitLabel = buildUnitLabel(detail);
  const status = buildPosterStatusConfig(draft.statusVariant);
  const contact = buildContactSnapshot(detail);
  const amenityLabels = buildAmenityLabels(detail);
  const images = await resolvePosterImageSources(detail, draft, options);
  const qrMarkup = renderQrCode(
    buildPosterPacketAbsoluteUrl(detail, options.baseUrl),
    1798,
    draft.templateId === "cinematic" ? 2558 : 2600,
    draft.templateId === "cinematic" ? 248 : 218,
  );

  switch (draft.templateId) {
    case "card":
      return renderCardTemplate({
        amenityLabels,
        contact,
        detail,
        images,
        locationLine,
        qrMarkup,
        status,
      });
    case "editorial":
      return renderEditorialTemplate({
        amenityLabels,
        contact,
        detail,
        facts,
        images,
        locationLine,
        qrMarkup,
        status,
        topline,
        unitLabel,
      });
    case "cinematic":
      return renderCinematicTemplate({
        contact,
        detail,
        facts,
        images,
        locationLine,
        qrMarkup,
        status,
      });
    case "grid":
      return renderGridTemplate({
        contact,
        detail,
        facts,
        images,
        qrMarkup,
        status,
        topline,
      });
    case "hero":
    default:
      return renderHeroTemplate({
        contact,
        detail,
        draft,
        facts,
        images,
        locationLine,
        qrMarkup,
        status,
        topline,
      });
  }
}

export function readListingStudioPosterTemplateId(
  value: string | null | undefined,
) {
  return normalizeTemplateId(value);
}

export function readListingStudioPosterStatusVariantId(
  value: string | null | undefined,
) {
  return normalizeStatusVariantId(value);
}

export function getListingStudioPosterTemplates() {
  return posterTemplates;
}

export function getListingStudioPosterStatusVariants() {
  return posterStatusVariants;
}

export function buildListingStudioPosterDraft(
  detail: StudioListingDetailSnapshot,
  templateId: ListingStudioPosterTemplateId = "hero",
  coverAssetId: string | null = null,
  statusVariant: ListingStudioPosterStatusVariantId = "just-listed",
): ListingStudioPosterDraft {
  const availablePhotoIds = new Set(
    buildPhotoAssetCandidates(detail).map((asset) => asset.id),
  );
  const fallbackCoverAssetId =
    detail.pack.coverAssetId ??
    detail.pack.selectedAssetIds.find((assetId) => availablePhotoIds.has(assetId)) ??
    buildPhotoAssetCandidates(detail)[0]?.id ??
    null;
  const resolvedCoverAssetId =
    coverAssetId && availablePhotoIds.has(coverAssetId)
      ? coverAssetId
      : fallbackCoverAssetId;

  return {
    coverAssetId: resolvedCoverAssetId,
    statusVariant: normalizeStatusVariantId(statusVariant),
    templateId: normalizeTemplateId(templateId),
  };
}

export function resolveListingStudioPosterCoverAssetId(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
) {
  return buildListingStudioPosterDraft(
    detail,
    draft.templateId,
    draft.coverAssetId,
    draft.statusVariant,
  ).coverAssetId;
}

export function buildListingStudioPosterHref(input: {
  packId: string;
  draft: ListingStudioPosterDraft;
  download?: boolean;
  format?: ListingStudioPosterFormat;
  print?: boolean;
}) {
  const params = new URLSearchParams();
  params.set("template", input.draft.templateId);
  params.set("statusVariant", input.draft.statusVariant);

  if (input.draft.coverAssetId) {
    params.set("coverAssetId", input.draft.coverAssetId);
  }

  if (input.format && input.format !== "html") {
    params.set("format", input.format);
  }

  if (input.download) {
    params.set("download", "1");
  }

  if (input.print) {
    params.set("print", "1");
  }

  return `/api/listing-studio/listings/${input.packId}/poster?${params.toString()}`;
}

export async function renderListingStudioPosterSvg(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
  options: PosterRenderOptions = {},
) {
  const body = await renderPosterBody(detail, draft, options);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2160 2880" width="2160" height="2880" role="img" aria-label="${escapeXml(
    `${detail.addressLine} ${draft.templateId} poster`,
  )}">
  <style>
    text { dominant-baseline: alphabetic; }
  </style>
  ${body}
</svg>`;
}

export function renderListingStudioPosterHtml(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
  options?: { autoPrint?: boolean; baseUrl?: string },
) {
  const svgHref = buildListingStudioPosterHref({
    draft,
    format: "svg",
    packId: detail.packId,
  });
  const previewUrl = options?.baseUrl
    ? new URL(svgHref, options.baseUrl).toString()
    : svgHref;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(detail.addressLine)} poster</title>
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background: #ece9e1;
      }
      body {
        display: grid;
        place-items: center;
        padding: 24px;
        box-sizing: border-box;
      }
      img {
        width: min(100%, 1080px);
        height: auto;
        display: block;
        box-shadow: 0 28px 72px rgba(15, 23, 42, 0.18);
        background: #f7f4ee;
      }
      @media print {
        body {
          padding: 0;
          background: #ffffff;
        }
        img {
          width: 100%;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <img alt="${escapeXml(detail.addressLine)} poster" src="${escapeXml(
      previewUrl,
    )}" />
    ${
      options?.autoPrint
        ? "<script>window.addEventListener('load', function () { window.print(); });</script>"
        : ""
    }
  </body>
</html>`;
}

export function buildListingStudioPosterFileName(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
  format: ListingStudioPosterFormat = "html",
) {
  const safeTitle =
    detail.addressLine
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "listing";
  const extension = format === "png" ? "png" : format === "svg" ? "svg" : "html";

  return `${safeTitle}-${draft.templateId}-${draft.statusVariant}.${extension}`;
}
