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

export type ListingStudioPosterAgentSnapshot = {
  avatarUrl: string | null;
  companyName: string;
  email: string;
  name: string;
  phone: string;
  title: string;
};

type PosterImageAsset = StudioListingDetailSnapshot["assets"][number];

type PosterRenderOptions = {
  agent?: ListingStudioPosterAgentSnapshot | null;
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
    description:
      "Centered headline, floating price chip, full-width photo, fact bar, and clean footer.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description:
      "Magazine-like sheet with hero image, supporting gallery, floor plan block, and footer.",
  },
  {
    id: "card",
    label: "Card",
    description:
      "Image-led card with a soft white information panel and bottom contact strip.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description:
      "Full-bleed image poster with a dramatic lower overlay and anchored contact footer.",
  },
  {
    id: "grid",
    label: "Grid",
    description:
      "Split gallery composition with a price rail, three facts, and a clean footer.",
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

function formatPosterNumericValue(
  value: string | null | undefined,
  options?: { maximumFractionDigits?: number; round?: boolean },
) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "—";
  }

  const numericToken = trimmed.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  const numeric = numericToken?.[0] ? Number(numericToken[0]) : Number.NaN;

  if (!Number.isFinite(numeric)) {
    return trimmed;
  }

  if (options?.round) {
    return Math.round(numeric).toLocaleString("en-US");
  }

  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: options?.maximumFractionDigits ?? 1,
  });
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
    {
      label: "BEDROOMS",
      value: formatPosterNumericValue(bedrooms, { maximumFractionDigits: 1 }),
    },
    {
      label: "BATHROOMS",
      value: formatPosterNumericValue(bathrooms, { maximumFractionDigits: 1 }),
    },
    { label: "SF", value: formatPosterNumericValue(squareFeet, { round: true }) },
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

function buildPropertyDisplayName(detail: StudioListingDetailSnapshot) {
  return truncateText(normalizeText(detail.buildingName, detail.addressLine), 48);
}

function buildContactSnapshot(
  detail: StudioListingDetailSnapshot,
  agent?: ListingStudioPosterAgentSnapshot | null,
) {
  const name = normalizeText(
    agent?.name,
    normalizeText(detail.pack.contactName, "Listing contact"),
  );
  const title = normalizeText(
    agent?.title,
    normalizeText(detail.pack.contactTitle, "Licensed Real Estate Salesperson"),
  );
  const phone = normalizeText(
    agent?.phone,
    normalizeText(detail.pack.contactPhone, "Phone on request"),
  );
  const email = normalizeText(
    agent?.email,
    normalizeText(detail.pack.contactEmail, "Email on request"),
  );
  const companyName = normalizeText(
    agent?.companyName,
    normalizeText(detail.pack.companyFeedLabel, "Acre NY Realty"),
  );
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");

  return {
    avatarUrl: agent?.avatarUrl?.trim() || null,
    companyName,
    email,
    initials: initials || "LS",
    name,
    phone,
    title,
  };
}

function buildPosterFactsInline(
  facts: PosterFact[],
  tone: "compact" | "long" = "compact",
) {
  return facts
    .map((fact) => {
      if (fact.label === "SF") {
        return `${fact.value} SF`;
      }

      if (fact.label === "BATHROOMS") {
        return tone === "long" ? `${fact.value} baths` : `${fact.value} Bath`;
      }

      return tone === "long" ? `${fact.value} beds` : `${fact.value} Bed`;
    })
    .join(" · ");
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

function renderAvatar(input: {
  contact: ReturnType<typeof buildContactSnapshot>;
  id: string;
  size: number;
  x: number;
  y: number;
}) {
  const centerX = input.x + input.size / 2;
  const centerY = input.y + input.size / 2;
  const radius = input.size / 2;
  const clipId = `poster-avatar-${input.id}`;

  if (!input.contact.avatarUrl) {
    return `
      <g>
        <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="#dbe4f5" />
        <circle cx="${centerX}" cy="${centerY}" r="${
          radius - 4
        }" fill="#f8fafc" />
        <text x="${centerX}" y="${centerY + 18}" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${
          input.size * 0.32
        }" font-weight="700" text-anchor="middle">${escapeXml(
          input.contact.initials,
        )}</text>
      </g>
    `;
  }

  return `
    <defs>
      <clipPath id="${clipId}">
        <circle cx="${centerX}" cy="${centerY}" r="${radius}" />
      </clipPath>
    </defs>
    <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="#f8fafc" />
    <image href="${escapeXml(
      input.contact.avatarUrl,
    )}" x="${input.x}" y="${input.y}" width="${input.size}" height="${input.size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
    <circle cx="${centerX}" cy="${centerY}" r="${radius - 2}" fill="none" stroke="rgba(15,23,42,0.12)" stroke-width="4" />
  `;
}

function renderPhoneIcon(x: number, y: number, color: string) {
  return `
    <g transform="translate(${x} ${y})">
      <path d="M3 5c1.3-1.3 3.5-.7 4 .9l.5 1.8c.2.7 0 1.4-.6 1.8l-1.1.8c1 1.9 2.5 3.4 4.4 4.4l.8-1.1c.5-.6 1.2-.9 1.8-.6l1.8.5c1.6.4 2.1 2.7.9 4l-1.1 1.1c-.8.8-2 .9-3 .5C8.8 18.7 5.3 15.2 3.5 10.6c-.4-1.1-.2-2.3.5-3.1L3 5Z" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </g>
  `;
}

function renderMailIcon(x: number, y: number, color: string) {
  return `
    <rect x="${x + 2}" y="${y + 4}" width="15" height="11" rx="2.2" fill="none" stroke="${color}" stroke-width="1.8" />
    <path d="M${x + 3.5} ${y + 6.2} L${x + 9.5} ${y + 11.2} L${x + 15.5} ${y + 6.2}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  `;
}

function renderFooterLight(input: {
  contact: ReturnType<typeof buildContactSnapshot>;
  y: number;
}) {
  return `
    <g>
      <line x1="0" y1="${input.y}" x2="2160" y2="${input.y}" stroke="rgba(15,23,42,0.10)" stroke-width="2" />
      ${renderAvatar({
        contact: input.contact,
        id: `footer-light-${input.y}`,
        size: 112,
        x: 70,
        y: input.y + 44,
      })}
      <text x="220" y="${input.y + 88}" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="42" font-weight="700">${escapeXml(
        truncateText(input.contact.name, 28),
      )}</text>
      <text x="220" y="${input.y + 132}" fill="#6b7280" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(
        truncateText(input.contact.title, 44),
      )}</text>
      <text x="220" y="${input.y + 174}" fill="#4b5563" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(
        truncateText(input.contact.companyName, 40),
      )}</text>
      ${renderPhoneIcon(1440, input.y + 118, "#6b7280")}
      <text x="1472" y="${input.y + 140}" fill="#111827" font-family="'Helvetica Neue', Arial, sans-serif" font-size="30" font-weight="600">${escapeXml(
        truncateText(input.contact.phone, 30),
      )}</text>
      ${renderMailIcon(1440, input.y + 162, "#6b7280")}
      <text x="1472" y="${input.y + 184}" fill="#4b5563" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(
        truncateText(input.contact.email, 38),
      )}</text>
    </g>
  `;
}

function renderFooterDark(input: {
  contact: ReturnType<typeof buildContactSnapshot>;
}) {
  return `
    <g>
      <text x="72" y="2648" fill="#f8fafc" font-family="'Helvetica Neue', Arial, sans-serif" font-size="36" font-weight="700">${escapeXml(
        truncateText(input.contact.name, 28),
      )}</text>
      <text x="72" y="2692" fill="rgba(248,250,252,0.82)" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26">${escapeXml(
        truncateText(`${input.contact.companyName} · ${input.contact.title}`, 56),
      )}</text>
      <text x="72" y="2734" fill="rgba(248,250,252,0.76)" font-family="'Helvetica Neue', Arial, sans-serif" font-size="24">${escapeXml(
        truncateText(`${input.contact.phone} · ${input.contact.email}`, 60),
      )}</text>
    </g>
  `;
}

async function resolveImageHref(
  source: PosterImageSource,
  options: PosterRenderOptions,
) {
  if (!source.href || !options.embedAssets) {
    return source;
  }

  try {
    const target =
      options.baseUrl && source.href.startsWith("/")
        ? new URL(source.href, options.baseUrl).toString()
        : source.href;
    const response = await fetch(target, {
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

async function resolveContactSnapshot(
  detail: StudioListingDetailSnapshot,
  options: PosterRenderOptions,
) {
  const contact = buildContactSnapshot(detail, options.agent);

  if (!contact.avatarUrl || !options.embedAssets) {
    return contact;
  }

  try {
    const target =
      options.baseUrl && contact.avatarUrl.startsWith("/")
        ? new URL(contact.avatarUrl, options.baseUrl).toString()
        : contact.avatarUrl;
    const response = await fetch(target, {
      cache: "no-store",
      headers: options.requestHeaders,
    });

    if (!response.ok) {
      return contact;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "image/jpeg";

    return {
      ...contact,
      avatarUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
    };
  } catch {
    return contact;
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
      y: 2240,
    })}
  `;
}

function renderCardTemplate(input: {
  detail: StudioListingDetailSnapshot;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
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
      buildPosterFactsInline(buildPosterFacts(input.detail), "compact"),
    )}</text>

    ${renderAmenityChips({
      items: input.amenityLabels,
      maxWidth: 1720,
      x: 70,
      y: 2200,
    })}
    ${renderFooterLight({
      contact: input.contact,
      y: 2448,
    })}
  `;
}

function renderCinematicTemplate(input: {
  detail: StudioListingDetailSnapshot;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
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
      buildPosterFactsInline(input.facts, "compact"),
    )}</text>
    <text x="68" y="2498" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="54" font-weight="700">${escapeXml(
      truncateText(input.detail.addressLine, 44),
    )}</text>
    <text x="68" y="2560" fill="rgba(255,255,255,0.76)" font-family="'Helvetica Neue', Arial, sans-serif" font-size="34">${escapeXml(
      truncateText(input.locationLine, 44),
    )}</text>
    ${renderFooterDark({
      contact: input.contact,
    })}
  `;
}

function renderGridTemplate(input: {
  detail: StudioListingDetailSnapshot;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
  facts: PosterFact[];
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
      y: 2110,
    })}
  `;
}

function renderEditorialTemplate(input: {
  detail: StudioListingDetailSnapshot;
  images: Awaited<ReturnType<typeof resolvePosterImageSources>>;
  contact: ReturnType<typeof buildContactSnapshot>;
  facts: PosterFact[];
  status: PosterStatusConfig;
  topline: string;
  propertyName: string;
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
      truncateText(input.propertyName, 32),
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
      buildPosterFactsInline(input.facts, "long"),
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
  const propertyName = buildPropertyDisplayName(detail);
  const unitLabel = buildUnitLabel(detail);
  const status = buildPosterStatusConfig(draft.statusVariant);
  const amenityLabels = buildAmenityLabels(detail);
  const images = await resolvePosterImageSources(detail, draft, options);
  const contact = await resolveContactSnapshot(detail, options);

  switch (draft.templateId) {
    case "card":
      return renderCardTemplate({
        amenityLabels,
        contact,
        detail,
        images,
        locationLine,
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
        propertyName,
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
        status,
      });
    case "grid":
      return renderGridTemplate({
        contact,
        detail,
        facts,
        images,
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
