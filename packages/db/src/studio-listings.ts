import { createHash, randomBytes } from "node:crypto";
import { Prisma, StudioExtensionChallengeStatus, StudioListingAssetKind, StudioListingImportStatus, StudioListingPackStatus, StudioListingSourceSite } from "@prisma/client";
import { prisma } from "./client";

type JsonRecord = Record<string, unknown>;
type StudioAmenitySection = { title: string; items: string[] };
type StudioTransitItem = { label: string; detail?: string | null; distanceLabel?: string | null };
type StudioFloorPlanItem = { label: string; url?: string | null; assetId?: string | null };
type StudioDetailSection = { title: string; items: string[] };
type StudioLabeledValue = { label: string; value: string };

export type StudioCapturedAssetInput = {
  kind?: StudioListingAssetKind | null;
  url: string;
  label?: string | null;
  sortOrder?: number | null;
};

export type CreateStudioListingImportInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  sourceSite: StudioListingSourceSite;
  sourceUrl: string;
  sourceListingId?: string | null;
  rawHtml: string;
  rawMetaJson?: unknown;
  canonicalFields: JsonRecord;
  assets: StudioCapturedAssetInput[];
};

export type StudioListingDashboardSnapshot = {
  extension: {
    hasActiveToken: boolean;
    activeTokenCount: number;
    latestConnectedAt: string | null;
  };
  summary: {
    totalListings: number;
    recentImports: number;
    shareViews: number;
    readyToShare: number;
  };
  recentListings: StudioListingListItem[];
};

export type StudioListingListItem = {
  packId: string;
  importId: string;
  title: string;
  sourceSite: StudioListingSourceSite;
  sourceUrl: string;
  listingType: string | null;
  priceLabel: string;
  addressLine: string;
  factsLine: string;
  statusLabel: string | null;
  importedAt: string;
  heroAssetId: string | null;
  shareEnabled: boolean;
};

export type StudioListingDetailSnapshot = {
  packId: string;
  importId: string;
  sourceSite: StudioListingSourceSite;
  sourceUrl: string;
  importStatus: StudioListingImportStatus;
  title: string;
  listingType: string | null;
  statusLabel: string | null;
  priceLabel: string;
  addressLine: string;
  locationLine: string | null;
  descriptionText: string | null;
  facts: Array<{ label: string; value: string }>;
  sourceFacts: Array<{ label: string; value: string }>;
  amenities: Array<{ title: string; items: string[] }>;
  transit: Array<{ label: string; detail?: string | null; distanceLabel?: string | null }>;
  floorPlans: Array<{ label: string; assetId?: string | null; url?: string | null }>;
  propertyHistory: Array<{ title: string; items: string[] }>;
  capturedSections: Array<{ title: string; items: string[] }>;
  assets: Array<{
    id: string;
    kind: StudioListingAssetKind;
    label: string | null;
    sortOrder: number;
  }>;
  pack: {
    status: StudioListingPackStatus;
    headline: string;
    summary: string;
    bulletPoints: string[];
    selectedAssetIds: string[];
    coverAssetId: string | null;
    shareEnabled: boolean;
    shareCode: string | null;
    agentNote: string;
    contactName: string;
    contactTitle: string;
    contactPhone: string;
    contactEmail: string;
  };
};

export type StudioListingPublicPackSnapshot = {
  code: string;
  title: string;
  headline: string;
  summary: string;
  agentNote: string;
  sourceSite: StudioListingSourceSite;
  sourceUrl: string;
  priceLabel: string;
  addressLine: string;
  locationLine: string | null;
  descriptionText: string | null;
  facts: Array<{ label: string; value: string }>;
  sourceFacts: Array<{ label: string; value: string }>;
  amenities: Array<{ title: string; items: string[] }>;
  transit: Array<{ label: string; detail?: string | null; distanceLabel?: string | null }>;
  selectedAssets: Array<{
    id: string;
    kind: StudioListingAssetKind;
    label: string | null;
    sortOrder: number;
  }>;
  floorPlans: Array<{ label: string; assetId?: string | null; url?: string | null }>;
  propertyHistory: Array<{ title: string; items: string[] }>;
  capturedSections: Array<{ title: string; items: string[] }>;
  contact: {
    name: string;
    title: string;
    phone: string;
    email: string;
  };
  capturedAtLabel: string;
};

type NormalizedStudioListingData = {
  title: string;
  listingType: string | null;
  statusLabel: string | null;
  price: string | number | null;
  priceLabel: string | null;
  currency: string;
  streetAddress: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  borough: string | null;
  neighborhood: string | null;
  buildingName: string | null;
  bedrooms: string | number | null;
  bathrooms: string | number | null;
  rooms: string | number | null;
  sqft: number | null;
  availabilityLabel: string | null;
  descriptionText: string | null;
  heroFacts: Array<{ label: string; value: string }>;
  amenities: Array<{ title: string; items: string[] }>;
  transit: Array<{ label: string; detail?: string | null; distanceLabel?: string | null }>;
  floorPlans: Array<{ label: string; url?: string | null; assetId?: string | null }>;
  propertyHistory: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  rawParsedJson: Prisma.InputJsonValue;
  latitude: string | number | null;
  longitude: string | number | null;
};

type DownloadedStudioAsset = {
  kind: StudioListingAssetKind;
  label: string | null;
  originalUrl: string | null;
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string | null;
  sortOrder: number;
};

type ListingStudioFileHelpers = {
  saveText: (input: {
    organizationId: string;
    importId: string;
    bucket: "raw" | "pack";
    fileName: string;
    content: string;
  }) => Promise<{ storageKey: string }>;
  saveFile: (input: {
    organizationId: string;
    importId: string;
    bucket: "raw" | "assets" | "pack";
    fileName: string;
    bytes: Uint8Array;
  }) => Promise<{ storageKey: string; fileName: string; fileSizeBytes: number }>;
};

let fileHelpers: ListingStudioFileHelpers | null = null;

const studioListingAssetsOrderBy = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

const studioListingPackDetailInclude = Prisma.validator<Prisma.StudioListingPackInclude>()({
  snapshot: {
    include: {
      import: true,
      assets: {
        orderBy: studioListingAssetsOrderBy,
      },
    },
  },
});

type StudioListingPackRecord = Prisma.StudioListingPackGetPayload<{
  include: typeof studioListingPackDetailInclude;
}>;

export function configureStudioListingFileHelpers(helpers: ListingStudioFileHelpers) {
  fileHelpers = helpers;
}

function getFileHelpers(): ListingStudioFileHelpers {
  if (!fileHelpers) {
    throw new Error("Listing Studio file helpers are not configured.");
  }

  return fileHelpers;
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function createOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

function trimString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTextArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => trimString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value === "string") {
    return value
      .split(/[,|\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [] as string[];
}

function parseNumberish(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]+/g, "");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseWholeNumber(value: unknown): number | null {
  const parsed = parseNumberish(value);
  if (parsed === null) {
    return null;
  }

  return Math.round(parsed);
}

function normalizeDecimalInput(value: unknown): string | null {
  const parsed = parseNumberish(value);
  return parsed === null ? null : parsed.toString();
}

function formatCurrency(amount: number | null, currency = "USD") {
  if (amount === null) {
    return "Price not captured";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(amount);
}

function normalizeAmenitySections(value: unknown): StudioAmenitySection[] {
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => trimString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return items.length ? [{ title: "Amenities & building", items }] : [];
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([title, items]) => ({
        title: title.trim() || "Amenities & building",
        items: normalizeTextArray(items),
      }))
      .filter((section) => section.items.length > 0);
  }

  return [];
}

function normalizeTransitItems(value: unknown): StudioTransitItem[] {
  const items: StudioTransitItem[] = [];

  if (!Array.isArray(value)) {
    return items;
  }

  for (const entry of value) {
    if (typeof entry === "string") {
      const label = trimString(entry);
      if (label) {
        items.push({ label });
      }
      continue;
    }

    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    const label =
      trimString(candidate.label) ??
      trimString(candidate.station) ??
      trimString(candidate.name);

    if (!label) {
      continue;
    }

    items.push({
      label,
      detail: trimString(candidate.detail) ?? trimString(candidate.subtitle),
      distanceLabel:
        trimString(candidate.distanceLabel) ??
        trimString(candidate.distance) ??
        trimString(candidate.walkTime),
    });
  }

  return items;
}

function normalizeFloorPlans(value: unknown): StudioFloorPlanItem[] {
  const items: StudioFloorPlanItem[] = [];

  if (!Array.isArray(value)) {
    return items;
  }

  value.forEach((entry, index) => {
    if (typeof entry === "string") {
      const url = trimString(entry);
      if (url) {
        items.push({
          label: index === 0 ? "Floor plan" : `Floor plan ${index + 1}`,
          url,
        });
      }
      return;
    }

    if (!entry || typeof entry !== "object") {
      return;
    }

    const candidate = entry as Record<string, unknown>;
    const label = trimString(candidate.label) ?? `Floor plan ${index + 1}`;
    const url = trimString(candidate.url);

    if (!url) {
      return;
    }

    items.push({ label, url });
  });

  return items;
}

function normalizeDetailSections(value: unknown): StudioDetailSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        const title = `Section ${index + 1}`;
        const item = trimString(entry);
        return item ? { title, items: [item] } : null;
      }

      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const title = trimString(candidate.title) ?? `Section ${index + 1}`;
      const items = normalizeTextArray(candidate.items);
      return items.length ? { title, items } : null;
    })
    .filter((entry): entry is StudioDetailSection => Boolean(entry));
}

function normalizeLabeledValues(value: unknown): StudioLabeledValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const candidate = entry as Record<string, unknown>;
      const label = trimString(candidate.label);
      const itemValue = trimString(candidate.value);
      return label && itemValue ? { label, value: itemValue } : null;
    })
    .filter((entry): entry is StudioLabeledValue => Boolean(entry));
}

function readCanonicalFieldFromRawParsed(
  rawParsedJson: Prisma.JsonValue | null,
  key: string,
): unknown {
  if (!rawParsedJson || typeof rawParsedJson !== "object" || Array.isArray(rawParsedJson)) {
    return undefined;
  }

  const canonicalFields = (rawParsedJson as Record<string, unknown>).canonicalFields;
  if (!canonicalFields || typeof canonicalFields !== "object" || Array.isArray(canonicalFields)) {
    return undefined;
  }

  return (canonicalFields as Record<string, unknown>)[key];
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function buildHeroFacts(data: {
  bedrooms: string | number | null;
  bathrooms: string | number | null;
  sqft: number | null;
  availabilityLabel: string | null;
}) {
  const facts: Array<{ label: string; value: string }> = [];

  if (data.bedrooms !== null) {
    facts.push({ label: "Bedrooms", value: String(data.bedrooms) });
  }
  if (data.bathrooms !== null) {
    facts.push({ label: "Bathrooms", value: String(data.bathrooms) });
  }
  if (data.sqft !== null) {
    facts.push({ label: "Sqft", value: new Intl.NumberFormat("en-US").format(data.sqft) });
  }
  if (data.availabilityLabel) {
    facts.push({ label: "Availability", value: data.availabilityLabel });
  }

  return facts;
}

function normalizeStudioListingData(input: CreateStudioListingImportInput): NormalizedStudioListingData {
  const fields = input.canonicalFields ?? {};
  const title =
    trimString(fields.title) ??
    trimString(fields.headline) ??
    trimString(fields.addressLine) ??
    trimString(fields.streetAddress) ??
    trimString(fields.address) ??
    "Imported listing";
  const streetAddress =
    trimString(fields.streetAddress) ??
    trimString(fields.addressLine) ??
    trimString(fields.address);
  const unit = trimString(fields.unit);
  const city = trimString(fields.city);
  const state = trimString(fields.state);
  const postalCode = trimString(fields.postalCode) ?? trimString(fields.zipCode);
  const bedrooms = normalizeDecimalInput(fields.bedrooms);
  const bathrooms = normalizeDecimalInput(fields.bathrooms);
  const rooms = normalizeDecimalInput(fields.rooms);
  const sqft = parseWholeNumber(fields.sqft) ?? parseWholeNumber(fields.squareFeet);
  const availabilityLabel =
    trimString(fields.availabilityLabel) ??
    trimString(fields.availability) ??
    trimString(fields.availableFrom);
  const heroFacts =
    Array.isArray(fields.heroFacts) && fields.heroFacts.length > 0
      ? (fields.heroFacts as Array<Record<string, unknown>>)
          .map((entry) => {
            const label = trimString(entry.label);
            const value = trimString(entry.value);
            return label && value ? { label, value } : null;
          })
          .filter((entry): entry is { label: string; value: string } => Boolean(entry))
      : buildHeroFacts({ bedrooms, bathrooms, sqft, availabilityLabel });
  const priceNumber = parseNumberish(fields.price);

  return {
    title,
    listingType:
      trimString(fields.listingType) ??
      trimString(fields.transactionType) ??
      trimString(fields.marketType),
    statusLabel: trimString(fields.statusLabel) ?? trimString(fields.status),
    price: priceNumber,
    priceLabel: trimString(fields.priceLabel) ?? formatCurrency(priceNumber),
    currency: trimString(fields.currency) ?? "USD",
    streetAddress,
    unit,
    city,
    state,
    postalCode,
    borough: trimString(fields.borough),
    neighborhood: trimString(fields.neighborhood),
    buildingName: trimString(fields.buildingName),
    bedrooms,
    bathrooms,
    rooms,
    sqft,
    availabilityLabel,
    descriptionText:
      trimString(fields.descriptionText) ??
      trimString(fields.description) ??
      trimString(fields.about),
    heroFacts,
    amenities: normalizeAmenitySections(fields.amenities),
    transit: normalizeTransitItems(fields.transit),
    floorPlans: normalizeFloorPlans(fields.floorPlans),
    propertyHistory:
      fields.propertyHistory === undefined ? Prisma.JsonNull : toInputJsonValue(fields.propertyHistory),
    rawParsedJson: toInputJsonValue({
      canonicalFields: input.canonicalFields,
      rawMetaJson: input.rawMetaJson ?? null,
    }),
    latitude: parseNumberish(fields.latitude),
    longitude: parseNumberish(fields.longitude),
  };
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "asset";
}

function inferExtensionFromMime(mimeType: string | null) {
  if (!mimeType) {
    return "bin";
  }

  if (mimeType.includes("jpeg")) {
    return "jpg";
  }
  if (mimeType.includes("png")) {
    return "png";
  }
  if (mimeType.includes("webp")) {
    return "webp";
  }
  if (mimeType.includes("gif")) {
    return "gif";
  }
  if (mimeType.includes("svg")) {
    return "svg";
  }
  if (mimeType.includes("pdf")) {
    return "pdf";
  }

  return "bin";
}

async function downloadStudioAsset(
  organizationId: string,
  importId: string,
  asset: StudioCapturedAssetInput,
  index: number,
): Promise<DownloadedStudioAsset | null> {
  const assetUrl = trimString(asset.url);
  if (!assetUrl) {
    return null;
  }

  try {
    const response = await fetch(assetUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return null;
    }

    const mimeType = trimString(response.headers.get("content-type"));
    const bytes = new Uint8Array(await response.arrayBuffer());

    if (!bytes.byteLength) {
      return null;
    }

    const pathname = new URL(assetUrl).pathname.split("/").pop() || `${asset.kind ?? "asset"}-${index + 1}`;
    const extension = pathname.includes(".") ? pathname.split(".").pop() : inferExtensionFromMime(mimeType);
    const baseName = sanitizeFileName(pathname.replace(/\.[a-zA-Z0-9]+$/, "") || `${asset.kind ?? "asset"}-${index + 1}`);
    const saved = await getFileHelpers().saveFile({
      organizationId,
      importId,
      bucket: "assets",
      fileName: `${baseName}.${extension || "bin"}`,
      bytes,
    });

    return {
      kind: asset.kind ?? StudioListingAssetKind.gallery,
      label: trimString(asset.label),
      originalUrl: assetUrl,
      storageKey: saved.storageKey,
      fileName: saved.fileName,
      fileSizeBytes: saved.fileSizeBytes,
      mimeType,
      sortOrder: asset.sortOrder ?? index,
    };
  } catch {
    return null;
  }
}

function formatAddressLine(snapshot: {
  streetAddress: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}) {
  const lineOne = [snapshot.streetAddress, snapshot.unit].filter(Boolean).join(" ");
  const lineTwo = [snapshot.city, snapshot.state, snapshot.postalCode].filter(Boolean).join(", ").replace(", ,", ",");

  return lineOne || lineTwo || "Address not captured";
}

function formatLocationLine(snapshot: {
  buildingName: string | null;
  neighborhood: string | null;
  borough: string | null;
  city: string | null;
  state: string | null;
}) {
  const parts = [snapshot.buildingName, snapshot.neighborhood, snapshot.borough, snapshot.city, snapshot.state].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function buildFactsLine(snapshot: {
  bedrooms: Prisma.Decimal | null;
  bathrooms: Prisma.Decimal | null;
  sqft: number | null;
}) {
  const parts = [
    snapshot.bedrooms ? `${snapshot.bedrooms.toString()} bd` : null,
    snapshot.bathrooms ? `${snapshot.bathrooms.toString()} ba` : null,
    snapshot.sqft ? `${new Intl.NumberFormat("en-US").format(snapshot.sqft)} sf` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "Facts not captured";
}

function normalizeBulletPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => trimString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function createDefaultSummary(normalized: NormalizedStudioListingData) {
  const locationBits = [normalized.buildingName, normalized.neighborhood, normalized.city].filter(Boolean);
  const locationLine = locationBits.length ? locationBits.join(" · ") : "Imported from a supported listing source";
  const factsLine = normalized.heroFacts.map((fact) => `${fact.value} ${fact.label.toLowerCase()}`).join(" · ");

  return [locationLine, factsLine].filter(Boolean).join(". ");
}

export async function createStudioListingExtensionChallenge() {
  const challengeToken = createOpaqueToken("ls_chal");
  const tokenHash = hashToken(challengeToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

  await prisma.studioListingExtensionChallenge.create({
    data: {
      tokenHash,
      expiresAt,
    },
  });

  return {
    challengeToken,
    expiresAt,
  };
}

export async function approveStudioListingExtensionChallenge(input: {
  challengeToken: string;
  organizationId: string;
  officeId?: string | null;
  approvedByMembershipId: string;
}) {
  const tokenHash = hashToken(input.challengeToken);
  const existing = await prisma.studioListingExtensionChallenge.findFirst({
    where: {
      tokenHash,
    },
  });

  if (!existing) {
    throw new Error("Extension challenge not found.");
  }

  if (existing.consumedAt) {
    return { status: "consumed" as const };
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    await prisma.studioListingExtensionChallenge.update({
      where: { id: existing.id },
      data: { status: StudioExtensionChallengeStatus.expired },
    });

    return { status: "expired" as const };
  }

  await prisma.studioListingExtensionChallenge.update({
    where: { id: existing.id },
    data: {
      status: StudioExtensionChallengeStatus.approved,
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      approvedByMembershipId: input.approvedByMembershipId,
      approvedAt: new Date(),
    },
  });

  return { status: "approved" as const };
}

export async function pollStudioListingExtensionChallenge(challengeToken: string) {
  const tokenHash = hashToken(challengeToken);
  const existing = await prisma.studioListingExtensionChallenge.findFirst({
    where: { tokenHash },
    include: {
      organization: {
        select: { name: true },
      },
      approvedByMembership: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    return { status: "not_found" as const };
  }

  if (existing.expiresAt.getTime() < Date.now() && existing.status === StudioExtensionChallengeStatus.pending) {
    await prisma.studioListingExtensionChallenge.update({
      where: { id: existing.id },
      data: { status: StudioExtensionChallengeStatus.expired },
    });

    return { status: "expired" as const };
  }

  if (existing.status === StudioExtensionChallengeStatus.pending) {
    return { status: "pending" as const };
  }

  if (existing.status === StudioExtensionChallengeStatus.consumed || existing.consumedAt) {
    return { status: "consumed" as const };
  }

  const extensionToken = createOpaqueToken("ls_ext");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 180);

  await prisma.$transaction(async (tx) => {
    await tx.studioListingExtensionToken.create({
      data: {
        organizationId: existing.organizationId!,
        officeId: existing.officeId,
        membershipId: existing.approvedByMembershipId!,
        tokenHash: hashToken(extensionToken),
        tokenPrefix: extensionToken.slice(0, 12),
        expiresAt,
        lastUsedAt: now,
      },
    });

    await tx.studioListingExtensionChallenge.update({
      where: { id: existing.id },
      data: {
        status: StudioExtensionChallengeStatus.consumed,
        consumedAt: now,
      },
    });
  });

  const user = existing.approvedByMembership?.user;
  const membershipLabel =
    user && `${user.firstName} ${user.lastName}`.trim()
      ? `${user.firstName} ${user.lastName}`.trim()
      : user?.email ?? "Acre user";

  return {
    status: "approved" as const,
    extensionToken,
    organizationName: existing.organization?.name ?? "Acre",
    membershipLabel,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function authenticateStudioListingExtensionToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.studioListingExtensionToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!token) {
    return null;
  }

  await prisma.studioListingExtensionToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    organizationId: token.organizationId,
    officeId: token.officeId,
    membershipId: token.membershipId,
  };
}

export async function createStudioListingImport(input: CreateStudioListingImportInput) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      status: "active",
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!membership) {
    throw new Error("Active membership is required to save listing imports.");
  }

  const importRecord = await prisma.studioListingImport.create({
    data: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? membership.officeId,
      createdByMembershipId: input.membershipId,
      sourceSite: input.sourceSite,
      sourceUrl: input.sourceUrl,
      sourceListingId: input.sourceListingId ?? null,
      status: StudioListingImportStatus.received,
    },
  });

  try {
    const [savedHtml, savedJson] = await Promise.all([
      getFileHelpers().saveText({
        organizationId: input.organizationId,
        importId: importRecord.id,
        bucket: "raw",
        fileName: "source.html",
        content: input.rawHtml,
      }),
      getFileHelpers().saveText({
        organizationId: input.organizationId,
        importId: importRecord.id,
        bucket: "raw",
        fileName: "source.json",
        content: JSON.stringify(
          {
            sourceSite: input.sourceSite,
            sourceUrl: input.sourceUrl,
            sourceListingId: input.sourceListingId ?? null,
            rawMetaJson: input.rawMetaJson ?? null,
            canonicalFields: input.canonicalFields,
            assets: input.assets,
          },
          null,
          2,
        ),
      }),
    ]);

    await prisma.studioListingImport.update({
      where: { id: importRecord.id },
      data: {
        status: StudioListingImportStatus.parsing,
        rawHtmlStorageKey: savedHtml.storageKey,
        rawJsonStorageKey: savedJson.storageKey,
      },
    });

    const normalized = normalizeStudioListingData(input);

    await prisma.studioListingImport.update({
      where: { id: importRecord.id },
      data: {
        status: StudioListingImportStatus.downloading_assets,
      },
    });

    const uniqueAssets = input.assets
      .map((asset, index) => ({ ...asset, sortOrder: asset.sortOrder ?? index }))
      .filter((asset, index, source) => {
        const url = trimString(asset.url);
        if (!url) {
          return false;
        }
        return source.findIndex((candidate) => trimString(candidate.url) === url) === index;
      })
      .slice(0, 16);

    const downloadedAssetResults = await Promise.allSettled(
      uniqueAssets.map((asset, index) => downloadStudioAsset(input.organizationId, importRecord.id, asset, index)),
    );
    const downloadedAssets = downloadedAssetResults
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((asset): asset is DownloadedStudioAsset => Boolean(asset));
    const assetFailureCount = downloadedAssetResults.length - downloadedAssets.length;

    const result = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.studioListingSnapshot.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? membership.officeId,
          importId: importRecord.id,
          sourceSite: input.sourceSite,
          sourceUrl: input.sourceUrl,
          sourceListingId: input.sourceListingId ?? null,
          title: normalized.title,
          listingType: normalized.listingType,
          statusLabel: normalized.statusLabel,
          price: normalized.price,
          priceLabel: normalized.priceLabel,
          currency: normalized.currency,
          streetAddress: normalized.streetAddress,
          unit: normalized.unit,
          city: normalized.city,
          state: normalized.state,
          postalCode: normalized.postalCode,
          borough: normalized.borough,
          neighborhood: normalized.neighborhood,
          buildingName: normalized.buildingName,
          bedrooms: normalized.bedrooms,
          bathrooms: normalized.bathrooms,
          rooms: normalized.rooms,
          sqft: normalized.sqft,
          availabilityLabel: normalized.availabilityLabel,
          descriptionText: normalized.descriptionText,
          heroFactsJson: normalized.heroFacts,
          amenitiesJson: normalized.amenities,
          transitJson: normalized.transit,
          floorPlanJson: normalized.floorPlans,
          propertyHistoryJson: normalized.propertyHistory,
          rawParsedJson: normalized.rawParsedJson,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
        },
      });

      if (downloadedAssets.length) {
        await tx.studioListingAsset.createMany({
          data: downloadedAssets.map((asset) => ({
            organizationId: input.organizationId,
            snapshotId: snapshot.id,
            kind: asset.kind,
            label: asset.label,
            originalUrl: asset.originalUrl,
            storageKey: asset.storageKey,
            mimeType: asset.mimeType,
            fileName: asset.fileName,
            fileSizeBytes: asset.fileSizeBytes,
            sortOrder: asset.sortOrder,
          })),
        });
      }

      const savedAssets = await tx.studioListingAsset.findMany({
        where: { snapshotId: snapshot.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      const selectedAssetIds = savedAssets.slice(0, 8).map((asset) => asset.id);
      const coverAssetId =
        savedAssets.find((asset) => asset.kind === StudioListingAssetKind.hero)?.id ??
        savedAssets[0]?.id ??
        null;

      const pack = await tx.studioListingPack.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? membership.officeId,
          snapshotId: snapshot.id,
          updatedByMembershipId: input.membershipId,
          status: StudioListingPackStatus.ready,
          headline: normalized.title,
          summary: createDefaultSummary(normalized),
          bulletPointsJson: normalized.heroFacts.map((fact) => `${fact.label}: ${fact.value}`),
          selectedAssetIdsJson: selectedAssetIds,
          coverAssetId,
          contactName:
            `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email,
          contactTitle: membership.title ?? "Acre agent",
          contactPhone: membership.user.phone ?? "",
          contactEmail: membership.user.email,
        },
      });

      await tx.studioListingImport.update({
        where: { id: importRecord.id },
        data: {
          status: StudioListingImportStatus.ready,
          diagnosticsJson: {
            assetFailureCount,
            assetSuccessCount: savedAssets.length,
          },
          completedAt: new Date(),
        },
      });

      return {
        importId: importRecord.id,
        snapshotId: snapshot.id,
        packId: pack.id,
      };
    });

    return result;
  } catch (error) {
    await prisma.studioListingImport.update({
      where: { id: importRecord.id },
      data: {
        status: StudioListingImportStatus.failed,
        failureReason: error instanceof Error ? error.message : "Listing import failed.",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

function mapListItem(record: StudioListingPackRecord): StudioListingListItem {
  const heroAssetId =
    record.snapshot.assets.find((asset) => asset.id === record.coverAssetId)?.id ??
    record.snapshot.assets.find((asset) => asset.kind === StudioListingAssetKind.hero)?.id ??
    record.snapshot.assets[0]?.id ??
    null;

  return {
    packId: record.id,
    importId: record.snapshot.import.id,
    title: record.headline?.trim() || record.snapshot.title,
    sourceSite: record.snapshot.sourceSite,
    sourceUrl: record.snapshot.sourceUrl,
    listingType: record.snapshot.listingType,
    priceLabel: record.snapshot.priceLabel || formatCurrency(record.snapshot.price ? Number(record.snapshot.price) : null, record.snapshot.currency),
    addressLine: formatAddressLine(record.snapshot),
    factsLine: buildFactsLine(record.snapshot),
    statusLabel: record.snapshot.statusLabel,
    importedAt: record.snapshot.import.createdAt.toISOString(),
    heroAssetId,
    shareEnabled: record.shareEnabled,
  };
}

export async function getListingStudioDashboard(input: {
  organizationId: string;
  membershipId: string;
}) : Promise<StudioListingDashboardSnapshot> {
  const [packCount, recentImportCount, shareViews, readyToShare, recent, activeTokens] = await Promise.all([
    prisma.studioListingPack.count({
      where: { organizationId: input.organizationId },
    }),
    prisma.studioListingImport.count({
      where: {
        organizationId: input.organizationId,
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
        },
      },
    }),
    prisma.studioListingShareEvent.count({
      where: { organizationId: input.organizationId },
    }),
    prisma.studioListingPack.count({
      where: {
        organizationId: input.organizationId,
        shareEnabled: true,
      },
    }),
    prisma.studioListingPack.findMany({
      where: { organizationId: input.organizationId },
      include: studioListingPackDetailInclude,
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.studioListingExtensionToken.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    extension: {
      hasActiveToken: activeTokens.length > 0,
      activeTokenCount: activeTokens.length,
      latestConnectedAt: activeTokens[0]?.createdAt.toISOString() ?? null,
    },
    summary: {
      totalListings: packCount,
      recentImports: recentImportCount,
      shareViews,
      readyToShare,
    },
    recentListings: recent.map(mapListItem),
  };
}

export async function listStudioListingPacks(input: {
  organizationId: string;
  search?: string | null;
  sourceSite?: StudioListingSourceSite | null;
  listingType?: string | null;
}) {
  const search = trimString(input.search);

  const records = await prisma.studioListingPack.findMany({
    where: {
      organizationId: input.organizationId,
      snapshot: {
        sourceSite: input.sourceSite ?? undefined,
        listingType: trimString(input.listingType) ?? undefined,
        OR: search
          ? [
              { title: { contains: search, mode: "insensitive" } },
              { streetAddress: { contains: search, mode: "insensitive" } },
              { buildingName: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { neighborhood: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
    },
    include: studioListingPackDetailInclude,
    orderBy: { updatedAt: "desc" },
  });

  return records.map(mapListItem);
}

function mapDetailSnapshot(record: StudioListingPackRecord): StudioListingDetailSnapshot {
  const snapshot = record.snapshot;
  const bulletPoints = normalizeBulletPoints(record.bulletPointsJson);
  const selectedAssetIds = normalizeBulletPoints(record.selectedAssetIdsJson);
  const sourceFacts = normalizeLabeledValues(
    readCanonicalFieldFromRawParsed(snapshot.rawParsedJson as Prisma.JsonValue | null, "sourceFacts"),
  );
  const capturedSections = normalizeDetailSections(
    readCanonicalFieldFromRawParsed(snapshot.rawParsedJson as Prisma.JsonValue | null, "detailSections"),
  ).filter(
    (section) => !/amenities|features|transit|transportation|history|about|overview/i.test(section.title),
  );
  const propertyHistory = normalizeDetailSections(snapshot.propertyHistoryJson as Prisma.JsonValue | null);
  const assets = snapshot.assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    label: asset.label,
    sortOrder: asset.sortOrder,
  }));

  return {
    packId: record.id,
    importId: snapshot.import.id,
    sourceSite: snapshot.sourceSite,
    sourceUrl: snapshot.sourceUrl,
    importStatus: snapshot.import.status,
    title: snapshot.title,
    listingType: snapshot.listingType,
    statusLabel: snapshot.statusLabel,
    priceLabel:
      snapshot.priceLabel ||
      formatCurrency(snapshot.price ? Number(snapshot.price) : null, snapshot.currency),
    addressLine: formatAddressLine(snapshot),
    locationLine: formatLocationLine({
      buildingName: snapshot.buildingName,
      neighborhood: snapshot.neighborhood,
      borough: snapshot.borough,
      city: snapshot.city,
      state: snapshot.state,
    }),
    descriptionText: snapshot.descriptionText,
    facts:
      Array.isArray(snapshot.heroFactsJson)
        ? (snapshot.heroFactsJson as Array<Record<string, unknown>>)
            .map((entry) => {
              const label = trimString(entry.label);
              const value = trimString(entry.value);
              return label && value ? { label, value } : null;
            })
            .filter((entry): entry is { label: string; value: string } => Boolean(entry))
        : buildHeroFacts({
            bedrooms: snapshot.bedrooms?.toString() ?? null,
            bathrooms: snapshot.bathrooms?.toString() ?? null,
            sqft: snapshot.sqft,
            availabilityLabel: snapshot.availabilityLabel,
          }),
    sourceFacts,
    amenities: Array.isArray(snapshot.amenitiesJson)
      ? (snapshot.amenitiesJson as Array<{ title: string; items: string[] }>)
      : [],
    transit: Array.isArray(snapshot.transitJson)
      ? (snapshot.transitJson as Array<{ label: string; detail?: string | null; distanceLabel?: string | null }>)
      : [],
    floorPlans: Array.isArray(snapshot.floorPlanJson)
      ? (snapshot.floorPlanJson as Array<{ label: string; assetId?: string | null; url?: string | null }>)
      : [],
    propertyHistory,
    capturedSections,
    assets,
    pack: {
      status: record.status,
      headline: record.headline?.trim() || snapshot.title,
      summary: record.summary?.trim() || "",
      bulletPoints,
      selectedAssetIds: selectedAssetIds.length ? selectedAssetIds : assets.map((asset) => asset.id).slice(0, 8),
      coverAssetId: record.coverAssetId,
      shareEnabled: record.shareEnabled,
      shareCode: record.shareCode,
      agentNote: record.agentNote?.trim() || "",
      contactName: record.contactName?.trim() || "",
      contactTitle: record.contactTitle?.trim() || "",
      contactPhone: record.contactPhone?.trim() || "",
      contactEmail: record.contactEmail?.trim() || "",
    },
  };
}

export async function getStudioListingPackDetail(input: {
  organizationId: string;
  packId: string;
}) {
  const record = await prisma.studioListingPack.findFirst({
    where: {
      id: input.packId,
      organizationId: input.organizationId,
    },
    include: studioListingPackDetailInclude,
  });

  return record ? mapDetailSnapshot(record) : null;
}

export async function getStudioListingImportStatus(input: {
  organizationId: string;
  importId: string;
}) {
  const record = await prisma.studioListingImport.findFirst({
    where: {
      id: input.importId,
      organizationId: input.organizationId,
    },
    include: {
      snapshot: {
        select: {
          pack: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    status: record.status,
    failureReason: record.failureReason,
    completedAt: record.completedAt?.toISOString() ?? null,
    packId: record.snapshot?.pack?.id ?? null,
  };
}

export async function updateStudioListingPack(input: {
  organizationId: string;
  packId: string;
  membershipId: string;
  headline?: string;
  summary?: string;
  bulletPoints?: string[];
  selectedAssetIds?: string[];
  coverAssetId?: string | null;
  agentNote?: string;
}) {
  const existing = await prisma.studioListingPack.findFirst({
    where: {
      id: input.packId,
      organizationId: input.organizationId,
    },
    include: {
      snapshot: {
        include: {
          assets: true,
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const allowedAssetIds = new Set(existing.snapshot.assets.map((asset) => asset.id));
  const selectedAssetIds = (input.selectedAssetIds ?? normalizeBulletPoints(existing.selectedAssetIdsJson)).filter((assetId) =>
    allowedAssetIds.has(assetId),
  );
  const nextCoverAssetId =
    input.coverAssetId && allowedAssetIds.has(input.coverAssetId)
      ? input.coverAssetId
      : existing.coverAssetId && allowedAssetIds.has(existing.coverAssetId)
        ? existing.coverAssetId
        : selectedAssetIds[0] ?? existing.snapshot.assets[0]?.id ?? null;

  await prisma.studioListingPack.update({
    where: { id: existing.id },
    data: {
      updatedByMembershipId: input.membershipId,
      status: StudioListingPackStatus.ready,
      headline: input.headline?.trim() || existing.snapshot.title,
      summary: input.summary?.trim() || "",
      bulletPointsJson: (input.bulletPoints ?? normalizeBulletPoints(existing.bulletPointsJson)).filter(Boolean),
      selectedAssetIdsJson: selectedAssetIds,
      coverAssetId: nextCoverAssetId,
      agentNote: input.agentNote?.trim() || "",
    },
  });

  return getStudioListingPackDetail({
    organizationId: input.organizationId,
    packId: input.packId,
  });
}

export async function publishStudioListingPack(input: {
  organizationId: string;
  packId: string;
  membershipId: string;
}) {
  const existing = await prisma.studioListingPack.findFirst({
    where: {
      id: input.packId,
      organizationId: input.organizationId,
    },
  });

  if (!existing) {
    return null;
  }

  const shareCode =
    existing.shareCode && existing.shareCode.trim()
      ? existing.shareCode
      : `pack_${randomBytes(6).toString("base64url").toLowerCase()}`;

  await prisma.studioListingPack.update({
    where: { id: existing.id },
    data: {
      updatedByMembershipId: input.membershipId,
      status: StudioListingPackStatus.shared,
      shareEnabled: true,
      shareCode,
    },
  });

  return {
    shareCode,
  };
}

function hashViewerValue(value: string | null) {
  return value ? createHash("sha256").update(value).digest("hex") : null;
}

export async function getStudioListingPublicPack(input: {
  shareCode: string;
  viewerFingerprint?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  const record = await prisma.studioListingPack.findFirst({
    where: {
      shareCode: input.shareCode,
      shareEnabled: true,
    },
    include: studioListingPackDetailInclude,
  });

  if (!record) {
    return null;
  }

  await prisma.studioListingShareEvent.create({
    data: {
      organizationId: record.organizationId,
      packId: record.id,
      shareCode: input.shareCode,
      viewerFingerprint: trimString(input.viewerFingerprint),
      referrer: trimString(input.referrer),
      userAgent: trimString(input.userAgent),
      ipAddressHash: hashViewerValue(trimString(input.ipAddress)),
    },
  });

  const detail = mapDetailSnapshot(record);
  const selectedAssetIds = new Set(detail.pack.selectedAssetIds);
  const selectedAssets = detail.assets.filter((asset) => selectedAssetIds.has(asset.id));

  return {
    code: input.shareCode,
    title: detail.title,
    headline: detail.pack.headline || detail.title,
    summary: detail.pack.summary,
    agentNote: detail.pack.agentNote,
    sourceSite: detail.sourceSite,
    sourceUrl: detail.sourceUrl,
    priceLabel: detail.priceLabel,
    addressLine: detail.addressLine,
    locationLine: detail.locationLine,
    descriptionText: detail.descriptionText,
    facts: detail.facts,
    sourceFacts: detail.sourceFacts,
    amenities: detail.amenities,
    transit: detail.transit,
    selectedAssets: selectedAssets.length ? selectedAssets : detail.assets.slice(0, 8),
    floorPlans: detail.floorPlans,
    propertyHistory: detail.propertyHistory,
    capturedSections: detail.capturedSections,
    contact: {
      name: detail.pack.contactName,
      title: detail.pack.contactTitle,
      phone: detail.pack.contactPhone,
      email: detail.pack.contactEmail,
    },
    capturedAtLabel: record.snapshot.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  } satisfies StudioListingPublicPackSnapshot;
}

export async function getStudioListingAssetRecord(input: {
  assetId: string;
  organizationId?: string | null;
  shareCode?: string | null;
}) {
  const asset = await prisma.studioListingAsset.findFirst({
    where: input.shareCode
      ? {
          id: input.assetId,
          snapshot: {
            pack: {
              shareEnabled: true,
              shareCode: input.shareCode,
            },
          },
        }
      : {
          id: input.assetId,
          organizationId: input.organizationId ?? undefined,
        },
  });

  return asset;
}
