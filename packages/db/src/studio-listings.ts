import { createHash, randomBytes } from "node:crypto";
import { canManageListingStudioCompanyFeed } from "@acre/auth";
import {
  Prisma,
  StudioExtensionChallengeStatus,
  StudioListingAssetKind,
  StudioListingCollectionShareEventKind,
  StudioListingImportStatus,
  StudioListingPackStatus,
  StudioListingSavedPackSource,
  StudioListingSourceSite,
} from "@prisma/client";
import { prisma } from "./client";

type JsonRecord = Record<string, unknown>;
type StudioAmenitySection = { title: string; items: string[] };
type StudioTransitItem = { label: string; detail?: string | null; distanceLabel?: string | null };
type StudioFloorPlanItem = { label: string; url?: string | null; assetId?: string | null };
type StudioDetailSection = { title: string; items: string[] };
type StudioLabeledValue = { label: string; value: string };

const DEFAULT_STUDIO_LISTING_COMPANY_FEED_LABEL = "Acre Featured";

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

export type StudioListingWorkspaceOverviewSnapshot = {
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
};

export type StudioListingCompanyFeedItem = StudioListingListItem & {
  companyFeedPublishedAt: string | null;
  isSavedToMyListings: boolean;
};

export type StudioListingCompanyDashboardSnapshot = {
  items: StudioListingCompanyFeedItem[];
};

export type StudioListingDashboardSnapshot =
  StudioListingWorkspaceOverviewSnapshot & {
    recentListings: StudioListingListItem[];
  };

export type StudioListingListItem = {
  packId: string;
  importId: string;
  title: string;
  displayTitle: string | null;
  sourceSite: StudioListingSourceSite;
  sourceUrl: string;
  listingType: string | null;
  priceLabel: string;
  addressLine: string;
  locationLine: string | null;
  factsLine: string;
  statusLabel: string | null;
  importedAt: string;
  heroAssetId: string | null;
  shareEnabled: boolean;
  companyFeedVisible: boolean;
  companyFeedLabel: string | null;
  companyFeedPublishedAt: string | null;
  savedAt: string | null;
  savedSource: StudioListingSavedPackSource | null;
};

export type StudioListingCollectionPickerItem = {
  id: string;
  name: string;
  listingCount: number;
  includesPack: boolean;
  updatedAt: string;
};

export type StudioListingCollectionListItem = {
  id: string;
  name: string;
  listingCount: number;
  createdAt: string;
  updatedAt: string;
  previewListings: StudioListingListItem[];
};

export type StudioListingCollectionListingItem = StudioListingListItem & {
  latitude: number | null;
  longitude: number | null;
};

export type StudioListingCollectionDetail = {
  id: string;
  name: string;
  listingCount: number;
  shareEnabled: boolean;
  shareCode: string | null;
  createdAt: string;
  updatedAt: string;
  listingsWithoutCoordinates: number;
  listings: StudioListingCollectionListingItem[];
};

export type StudioListingCollectionShareListItem = {
  id: string;
  name: string;
  listingCount: number;
  shareEnabled: boolean;
  shareCode: string | null;
  shareCount: number;
  viewCount: number;
  lastSharedAt: string | null;
  lastViewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudioListingCollectionSharesSnapshot = {
  summary: {
    sharedCollections: number;
    shareCount: number;
    viewCount: number;
    activeShareLinks: number;
  };
  items: StudioListingCollectionShareListItem[];
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
  price: number | null;
  priceLabel: string;
  streetAddress: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  borough: string | null;
  neighborhood: string | null;
  buildingName: string | null;
  addressLine: string;
  locationLine: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  sqft: number | null;
  availabilityLabel: string | null;
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
    mimeType: string | null;
    fileName: string;
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
    companyFeedVisible: boolean;
    companyFeedLabel: string | null;
    companyFeedPublishedAt: string | null;
    agentNote: string;
    contactName: string;
    contactTitle: string;
    contactPhone: string;
    contactEmail: string;
  };
};

export type StudioListingPublicPackSnapshot = {
  code: string;
  usesLegacyShareCode: boolean;
  legacyShareCodeExpiresAt: Date | null;
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

export type StudioListingPublicCollectionSnapshot = {
  code: string;
  name: string;
  listingCount: number;
  updatedAt: string;
  contact: {
    name: string;
    title: string;
    phone: string;
    email: string;
  };
  listings: Array<{
    packId: string;
    title: string;
    displayTitle: string | null;
    listingType: string | null;
    priceLabel: string;
    addressLine: string;
    locationLine: string | null;
    latitude: number | null;
    longitude: number | null;
    factsLine: string;
    statusLabel: string | null;
    heroAssetId: string | null;
    agentNote: string;
    descriptionText: string | null;
    facts: Array<{ label: string; value: string }>;
    amenities: Array<{ title: string; items: string[] }>;
    buildingName: string | null;
    selectedAssets: Array<{
      id: string;
      kind: StudioListingAssetKind;
      label: string | null;
      sortOrder: number;
    }>;
  }>;
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
  deleteFile?: (storageKey: string) => Promise<void>;
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

const studioListingCollectionInclude = Prisma.validator<Prisma.StudioListingCollectionInclude>()({
  items: {
    include: {
      pack: {
        include: studioListingPackDetailInclude,
      },
    },
  },
});

type StudioListingCollectionRecord = Prisma.StudioListingCollectionGetPayload<{
  include: typeof studioListingCollectionInclude;
}>;

type StudioListingSavedPackRecord = Prisma.StudioListingSavedPackGetPayload<{
  include: {
    pack: {
      include: typeof studioListingPackDetailInclude;
    };
  };
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

function createStudioListingPackShareCode() {
  return `pack_${randomBytes(24).toString("base64url")}`;
}

function createStudioListingCollectionShareCode() {
  return `collection_${randomBytes(24).toString("base64url")}`;
}

function formatStudioListingMembershipLabel(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null | undefined) {
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  return fullName || user?.email?.trim() || "Acre user";
}

function trimString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveCompanyFeedLabel(
  value: unknown,
  companyFeedVisible: boolean,
) {
  return trimString(value) ??
    (companyFeedVisible ? DEFAULT_STUDIO_LISTING_COMPANY_FEED_LABEL : null);
}

function normalizeCollectionName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCollectionNameKey(value: string) {
  return normalizeCollectionName(value).toLowerCase();
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

function normalizeComparableLabel(value: string | null | undefined) {
  return (
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() || ""
  );
}

function labelsMatch(a: string | null | undefined, b: string | null | undefined) {
  const normalizedA = normalizeComparableLabel(a);
  const normalizedB = normalizeComparableLabel(b);
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}

function getSnapshotCanonicalFields(snapshot: { rawParsedJson: Prisma.JsonValue | null }) {
  if (!snapshot.rawParsedJson || typeof snapshot.rawParsedJson !== "object" || Array.isArray(snapshot.rawParsedJson)) {
    return null;
  }

  const root = snapshot.rawParsedJson as Record<string, unknown>;
  const canonicalFields = root.canonicalFields;
  if (!canonicalFields || typeof canonicalFields !== "object" || Array.isArray(canonicalFields)) {
    return null;
  }

  return canonicalFields as Record<string, unknown>;
}

function readSnapshotCanonicalField(
  snapshot: { rawParsedJson: Prisma.JsonValue | null },
  key: string,
) {
  const canonicalFields = getSnapshotCanonicalFields(snapshot);
  return canonicalFields?.[key];
}

function formatSlugLabel(value: string) {
  return value
    .split(/[-_]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveBuildingNameFromSourceUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/\/building\/([^/?#]+)/i);
    return match ? trimString(formatSlugLabel(decodeURIComponent(match[1]))) : null;
  } catch {
    return null;
  }
}

function parsePricePerSquareFootLabel(value: unknown) {
  const label = trimString(value);
  if (!label) {
    return null;
  }

  const match = label.match(/\$([0-9][0-9,]*(?:\.[0-9]+)?)/);
  return parseNumberish(match?.[1] ?? null);
}

function extractFirstMoneyLabel(value: string | null | undefined) {
  const normalized = trimString(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/\$[0-9][0-9,]*(?:\.[0-9]+)?(?:\/(?:mo|month|yr|year))?/i);
  return trimString(match?.[0] ?? null);
}

function parsePriceFromLabel(value: string | null | undefined) {
  return parseNumberish(extractFirstMoneyLabel(value));
}

function normalizeListingTypeValue(value: string | null | undefined) {
  const normalized = trimString(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }
  if (/rent|rental|lease/.test(normalized)) {
    return "rent";
  }
  if (/sale|sell|buy/.test(normalized)) {
    return "sale";
  }
  return trimString(value);
}

function inferListingTypeFromPriceLabel(value: string | null | undefined) {
  const normalized = trimString(value)?.toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  if (/base rent|for rent|\/mo|month lease|months free|available:/.test(normalized)) {
    return "rent";
  }
  if (/for sale|open house/.test(normalized)) {
    return "sale";
  }
  return null;
}

function inferListingTypeFromSourceUrl(value: string | null | undefined) {
  const normalized = trimString(value)?.toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }

  if (/(^|[?&])utm_campaign=sale_listing(&|$)|sale_listing/.test(normalized)) {
    return "sale";
  }

  if (/(^|[?&])utm_campaign=rental_listing(&|$)|rental_listing/.test(normalized)) {
    return "rent";
  }

  return null;
}

function resolveNormalizedListingType(input: {
  listingType: string | null | undefined;
  priceLabel: string | null | undefined;
  sourceUrl?: string | null | undefined;
}) {
  const normalizedListingType = normalizeListingTypeValue(input.listingType);
  const inferredFromSourceUrl = inferListingTypeFromSourceUrl(input.sourceUrl);
  const inferredFromPriceLabel = inferListingTypeFromPriceLabel(input.priceLabel);

  if (inferredFromSourceUrl) {
    return inferredFromSourceUrl;
  }

  if (normalizedListingType === "sale" && inferredFromPriceLabel === "rent") {
    return "rent";
  }

  return normalizedListingType ?? inferredFromPriceLabel;
}

function resolveSnapshotPrice(snapshot: {
  price: Prisma.Decimal | null;
  priceLabel: string | null;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  return (
    (snapshot.price ? Number(snapshot.price) : null) ??
    parseNumberish(readSnapshotCanonicalField(snapshot, "price")) ??
    parsePriceFromLabel(snapshot.priceLabel) ??
    parsePriceFromLabel(trimString(readSnapshotCanonicalField(snapshot, "priceLabel")))
  );
}

function deriveSnapshotSqft(snapshot: {
  sqft: number | null;
  price: Prisma.Decimal | null;
  priceLabel: string | null;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  if (snapshot.sqft !== null) {
    return snapshot.sqft;
  }

  const price = resolveSnapshotPrice(snapshot);
  const pricePerSquareFoot = parsePricePerSquareFootLabel(
    readSnapshotCanonicalField(snapshot, "pricePerSquareFootLabel"),
  );

  if (!price || !pricePerSquareFoot || pricePerSquareFoot <= 0) {
    return null;
  }

  return Math.round(price / pricePerSquareFoot);
}

function resolveSnapshotBuildingName(snapshot: {
  buildingName: string | null;
  sourceUrl: string;
}) {
  const stored = trimString(snapshot.buildingName);
  const derived = deriveBuildingNameFromSourceUrl(snapshot.sourceUrl);

  if (stored && derived && labelsMatch(stored, derived)) {
    return stored;
  }

  return derived ?? stored;
}

function resolveSnapshotCity(snapshot: {
  city: string | null;
  buildingName: string | null;
  sourceUrl: string;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  const storedCity =
    trimString(snapshot.city) ?? trimString(readSnapshotCanonicalField(snapshot, "city"));
  if (storedCity) {
    return storedCity;
  }

  const storedBuilding = trimString(snapshot.buildingName);
  const derivedBuilding = deriveBuildingNameFromSourceUrl(snapshot.sourceUrl);
  if (storedBuilding && derivedBuilding && !labelsMatch(storedBuilding, derivedBuilding)) {
    return storedBuilding;
  }

  return null;
}

function resolveSnapshotState(snapshot: {
  state: string | null;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  return trimString(snapshot.state) ?? trimString(readSnapshotCanonicalField(snapshot, "state"));
}

function resolveSnapshotPostalCode(snapshot: {
  postalCode: string | null;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  return (
    trimString(snapshot.postalCode) ??
    trimString(readSnapshotCanonicalField(snapshot, "postalCode")) ??
    trimString(readSnapshotCanonicalField(snapshot, "zipCode"))
  );
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

function resolveListingPriceLabel(input: {
  price: number | null;
  priceLabel: string | null;
  currency: string;
}) {
  const formatted = formatCurrency(input.price, input.currency);
  const raw = input.priceLabel?.trim() || null;
  const firstMoneyLabel = extractFirstMoneyLabel(raw);

  if (!raw) {
    return formatted;
  }

  if (firstMoneyLabel) {
    return firstMoneyLabel;
  }

  if (
    input.price !== null &&
    /(price increase|for rent|for sale|open house|reduced|save|monthly|weekly|base rent|fees?)/i.test(raw)
  ) {
    return formatted;
  }

  return raw;
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

function parseFallbackTransitItem(value: string): StudioTransitItem | null {
  const trimmed = trimString(value);
  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/\s+/g, " ").trim();
  const parts = compact.split("·").map((part) => part.trim()).filter(Boolean);
  const labelCandidate =
    parts[0]?.replace(/\s+[0-9.]+\s*(?:km|mi|m)\b.*$/i, "").trim() ?? compact;
  const label = labelCandidate || compact;
  const minutesMatch = compact.match(/(\d+)\s*min(?:ute)?(?:s)?(?:\s*walk)?/i);
  const distanceMatch = compact.match(/([0-9.]+\s*(?:km|mi|m))/i);
  const detailParts: string[] = [];

  if (distanceMatch?.[1]) {
    detailParts.push(distanceMatch[1]);
  }

  if (minutesMatch?.[1]) {
    detailParts.push(`${minutesMatch[1]} min walk`);
  }

  return {
    label,
    detail: detailParts.length ? detailParts.join(" • ") : parts.slice(1).join(" • ") || null,
    distanceLabel: minutesMatch?.[1]
      ? `${minutesMatch[1]} min`
      : distanceMatch?.[1] ?? null,
  };
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

function cloneRawParsedJson(rawParsedJson: Prisma.JsonValue | null) {
  if (!rawParsedJson || typeof rawParsedJson !== "object" || Array.isArray(rawParsedJson)) {
    return {} as Record<string, unknown>;
  }

  return JSON.parse(JSON.stringify(rawParsedJson)) as Record<string, unknown>;
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
  const priceNumber = parseNumberish(fields.price) ?? parsePriceFromLabel(trimString(fields.priceLabel));

  return {
    title,
    listingType: resolveNormalizedListingType({
      listingType:
        trimString(fields.listingType) ??
        trimString(fields.transactionType) ??
        trimString(fields.marketType),
      priceLabel: trimString(fields.priceLabel),
      sourceUrl: input.sourceUrl,
    }),
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
  neighborhood?: string | null;
  borough?: string | null;
  buildingName?: string | null;
  sourceUrl?: string;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  const streetAddress = trimString(snapshot.streetAddress);
  const unit = trimString(snapshot.unit);
  const normalizedStreetAddress = normalizeComparableLabel(streetAddress);
  const normalizedUnit = normalizeComparableLabel(unit);
  const lineOne =
    streetAddress && unit && normalizedUnit && normalizedStreetAddress.endsWith(normalizedUnit)
      ? streetAddress
      : [streetAddress, unit].filter(Boolean).join(" ");
  const lineTwo = formatLocalityLine(snapshot);

  return lineOne || lineTwo || "Address not captured";
}

function formatLocalityLine(snapshot: {
  city: string | null;
  state: string | null;
  postalCode: string | null;
  neighborhood?: string | null;
  borough?: string | null;
  buildingName?: string | null;
  sourceUrl?: string;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  const city = resolveSnapshotCity({
    city: snapshot.city,
    buildingName: snapshot.buildingName ?? null,
    sourceUrl: snapshot.sourceUrl ?? "",
    rawParsedJson: snapshot.rawParsedJson,
  });
  const state = resolveSnapshotState(snapshot);
  const postalCode = resolveSnapshotPostalCode(snapshot);
  const primaryLocation = [city, [state, postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  if (primaryLocation) {
    return primaryLocation;
  }

  const fallbackParts = [trimString(snapshot.neighborhood), trimString(snapshot.borough)].filter(Boolean);
  return fallbackParts.length ? fallbackParts.join(" · ") : null;
}

function formatLocationLine(snapshot: {
  buildingName: string | null;
  neighborhood: string | null;
  borough: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  sourceUrl: string;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  const parts = [
    resolveSnapshotBuildingName(snapshot),
    formatLocalityLine(snapshot),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function buildFactsLine(snapshot: {
  bedrooms: Prisma.Decimal | null;
  bathrooms: Prisma.Decimal | null;
  sqft: number | null;
  price: Prisma.Decimal | null;
  priceLabel: string | null;
  rawParsedJson: Prisma.JsonValue | null;
}) {
  const sqft = deriveSnapshotSqft(snapshot);
  const parts = [
    snapshot.bedrooms ? `${snapshot.bedrooms.toString()} bd` : null,
    snapshot.bathrooms ? `${snapshot.bathrooms.toString()} ba` : null,
    sqft ? `${new Intl.NumberFormat("en-US").format(sqft)} sf` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "Facts not captured";
}

function resolveListItemDisplayTitle(
  record: StudioListingPackRecord,
  addressLine: string,
  locationLine: string | null,
) {
  const candidates = [
    trimString(record.headline),
    resolveSnapshotBuildingName(record.snapshot),
    trimString(record.snapshot.title),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (labelsMatch(candidate, addressLine) || labelsMatch(candidate, locationLine)) {
      continue;
    }
    return candidate;
  }

  return null;
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

  const membershipLabel = formatStudioListingMembershipLabel(
    existing.approvedByMembership?.user,
  );

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

export async function getStudioListingExtensionTokenOwner(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.studioListingExtensionToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      membership: {
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

  if (!token) {
    return null;
  }

  return {
    organizationId: token.organizationId,
    officeId: token.officeId,
    membershipId: token.membershipId,
    membershipLabel: formatStudioListingMembershipLabel(token.membership?.user),
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

  const shouldPublishToCompanyFeed = canManageListingStudioCompanyFeed({
    role: membership.role,
    permissions: Array.isArray(membership.permissions)
      ? (membership.permissions as never)
      : null,
  });

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
          companyFeedPublishedByMembershipId: shouldPublishToCompanyFeed
            ? input.membershipId
            : null,
          status: StudioListingPackStatus.ready,
          headline: normalized.title,
          summary: createDefaultSummary(normalized),
          bulletPointsJson: normalized.heroFacts.map((fact) => `${fact.label}: ${fact.value}`),
          selectedAssetIdsJson: selectedAssetIds,
          coverAssetId,
          companyFeedVisible: shouldPublishToCompanyFeed,
          companyFeedLabel: shouldPublishToCompanyFeed
            ? DEFAULT_STUDIO_LISTING_COMPANY_FEED_LABEL
            : null,
          companyFeedPublishedAt: shouldPublishToCompanyFeed ? new Date() : null,
          contactName:
            `${membership.user.firstName} ${membership.user.lastName}`.trim() || membership.user.email,
          contactTitle: membership.title ?? "Acre agent",
          contactPhone: membership.user.phone ?? "",
          contactEmail: membership.user.email,
          savedPacks: {
            create: {
              organizationId: input.organizationId,
              membershipId: input.membershipId,
              source: StudioListingSavedPackSource.imported_by_me,
            },
          },
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

function mapListItem(
  record: StudioListingPackRecord,
  options?: {
    savedPack?: {
      createdAt: Date;
      source: StudioListingSavedPackSource;
    } | null;
  },
): StudioListingListItem {
  const heroAssetId =
    record.snapshot.assets.find((asset) => asset.id === record.coverAssetId)?.id ??
    record.snapshot.assets.find((asset) => asset.kind === StudioListingAssetKind.hero)?.id ??
    record.snapshot.assets[0]?.id ??
    null;
  const addressLine = formatAddressLine(record.snapshot);
  const locationLine = formatLocalityLine(record.snapshot);
  const resolvedPrice = resolveSnapshotPrice(record.snapshot);
  const resolvedListingType = resolveNormalizedListingType({
    listingType:
      record.snapshot.listingType ?? trimString(readSnapshotCanonicalField(record.snapshot, "listingType")),
    priceLabel:
      record.snapshot.priceLabel ?? trimString(readSnapshotCanonicalField(record.snapshot, "priceLabel")),
    sourceUrl: record.snapshot.sourceUrl,
  });

  return {
    packId: record.id,
    importId: record.snapshot.import.id,
    title: record.headline?.trim() || record.snapshot.title,
    displayTitle: resolveListItemDisplayTitle(record, addressLine, locationLine),
    sourceSite: record.snapshot.sourceSite,
    sourceUrl: record.snapshot.sourceUrl,
    listingType: resolvedListingType,
    priceLabel: resolveListingPriceLabel({
      price: resolvedPrice,
      priceLabel: record.snapshot.priceLabel,
      currency: record.snapshot.currency,
    }),
    addressLine,
    locationLine,
    factsLine: buildFactsLine(record.snapshot),
    statusLabel: record.snapshot.statusLabel,
    importedAt: record.snapshot.import.createdAt.toISOString(),
    heroAssetId,
    shareEnabled: record.shareEnabled,
    companyFeedVisible: record.companyFeedVisible,
    companyFeedLabel: resolveCompanyFeedLabel(
      record.companyFeedLabel,
      record.companyFeedVisible,
    ),
    companyFeedPublishedAt: record.companyFeedPublishedAt?.toISOString() ?? null,
    savedAt: options?.savedPack?.createdAt.toISOString() ?? null,
    savedSource: options?.savedPack?.source ?? null,
  };
}

function mapCollectionListingItem(
  record: StudioListingPackRecord,
): StudioListingCollectionListingItem {
  return {
    ...mapListItem(record),
    latitude: record.snapshot.latitude ? Number(record.snapshot.latitude) : null,
    longitude: record.snapshot.longitude ? Number(record.snapshot.longitude) : null,
  };
}

function mapSavedPackListItem(record: StudioListingSavedPackRecord) {
  return mapListItem(record.pack, {
    savedPack: {
      createdAt: record.createdAt,
      source: record.source,
    },
  });
}

function sortStudioListingPackRecords(records: StudioListingPackRecord[]) {
  return [...records].sort((left, right) => {
    const updatedAtDifference = right.updatedAt.getTime() - left.updatedAt.getTime();
    if (updatedAtDifference !== 0) {
      return updatedAtDifference;
    }

    return (
      right.snapshot.import.createdAt.getTime() -
      left.snapshot.import.createdAt.getTime()
    );
  });
}

function mapCollectionListItem(
  record: StudioListingCollectionRecord,
): StudioListingCollectionListItem {
  const listingRecords = sortStudioListingPackRecords(
    record.items.map((item) => item.pack),
  );

  return {
    id: record.id,
    name: record.name,
    listingCount: listingRecords.length,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    previewListings: listingRecords.slice(0, 3).map((item) => mapListItem(item)),
  };
}

function mapCollectionDetail(
  record: StudioListingCollectionRecord,
): StudioListingCollectionDetail {
  const listings = sortStudioListingPackRecords(record.items.map((item) => item.pack)).map(
    mapCollectionListingItem,
  );

  return {
    id: record.id,
    name: record.name,
    listingCount: listings.length,
    shareEnabled: record.shareEnabled,
    shareCode: record.shareCode,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    listingsWithoutCoordinates: listings.filter(
      (item) => item.latitude === null || item.longitude === null,
    ).length,
    listings,
  };
}

function isCollectionNameConflictError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function getListingStudioWorkspaceOverview(input: {
  organizationId: string;
  membershipId: string;
}): Promise<StudioListingWorkspaceOverviewSnapshot> {
  const [packCount, recentImportCount, shareViews, readyToShare, activeTokens] = await Promise.all([
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
  };
}

export async function getListingStudioCompanyDashboard(input: {
  organizationId: string;
  membershipId: string;
}): Promise<StudioListingCompanyDashboardSnapshot> {
  const records = await prisma.studioListingPack.findMany({
    where: {
      organizationId: input.organizationId,
      companyFeedVisible: true,
    },
    include: {
      ...studioListingPackDetailInclude,
      savedPacks: {
        where: {
          membershipId: input.membershipId,
        },
        select: {
          createdAt: true,
          source: true,
        },
        take: 1,
      },
    },
    orderBy: [{ companyFeedPublishedAt: "desc" }, { updatedAt: "desc" }],
  });

  return {
    items: records.map((record) => {
      const savedPack = record.savedPacks[0] ?? null;

      return {
        ...mapListItem(record, { savedPack }),
        companyFeedPublishedAt: record.companyFeedPublishedAt?.toISOString() ?? null,
        isSavedToMyListings: Boolean(savedPack),
      };
    }),
  };
}

export async function getListingStudioDashboard(input: {
  organizationId: string;
  membershipId: string;
}): Promise<StudioListingDashboardSnapshot> {
  const [overview, recentListings] = await Promise.all([
    getListingStudioWorkspaceOverview(input),
    listStudioListingPacks(input),
  ]);

  return {
    ...overview,
    recentListings: recentListings.slice(0, 6),
  };
}

export async function listStudioListingPacks(input: {
  organizationId: string;
  membershipId: string;
  search?: string | null;
  sourceSite?: StudioListingSourceSite | null;
  listingType?: string | null;
}) {
  const search = trimString(input.search);
  const requestedListingType = trimString(input.listingType)?.toLowerCase() ?? null;

  const records = await prisma.studioListingSavedPack.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      pack: {
        snapshot: {
          sourceSite: input.sourceSite ?? undefined,
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
    },
    include: {
      pack: {
        include: studioListingPackDetailInclude,
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return records
    .map(mapSavedPackListItem)
    .filter(
      (item) =>
        !requestedListingType ||
        item.listingType?.trim().toLowerCase() === requestedListingType,
    );
}

export async function listStudioListingCollections(input: {
  organizationId: string;
  membershipId: string;
}) {
  const records = await prisma.studioListingCollection.findMany({
    where: {
      organizationId: input.organizationId,
      createdByMembershipId: input.membershipId,
    },
    include: studioListingCollectionInclude,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return records.map(mapCollectionListItem);
}

export async function listStudioListingCollectionShares(input: {
  organizationId: string;
  membershipId: string;
}): Promise<StudioListingCollectionSharesSnapshot> {
  const records = await prisma.studioListingCollection.findMany({
    where: {
      organizationId: input.organizationId,
      createdByMembershipId: input.membershipId,
      OR: [
        { shareEnabled: true },
        {
          shareEvents: {
            some: {},
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      shareEnabled: true,
      shareCode: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  const collectionIds = records.map((record) => record.id);
  const groupedEvents = collectionIds.length
    ? await prisma.studioListingCollectionShareEvent.groupBy({
        by: ["collectionId", "eventKind"],
        where: {
          organizationId: input.organizationId,
          collectionId: {
            in: collectionIds,
          },
        },
        _count: {
          _all: true,
        },
        _max: {
          occurredAt: true,
        },
      })
    : [];

  const rollups = new Map<
    string,
    {
      shareCount: number;
      viewCount: number;
      lastSharedAt: Date | null;
      lastViewedAt: Date | null;
    }
  >();

  for (const eventGroup of groupedEvents) {
    const rollup =
      rollups.get(eventGroup.collectionId) ??
      {
        shareCount: 0,
        viewCount: 0,
        lastSharedAt: null,
        lastViewedAt: null,
      };

    if (eventGroup.eventKind === StudioListingCollectionShareEventKind.shared) {
      rollup.shareCount = eventGroup._count._all;
      rollup.lastSharedAt = eventGroup._max.occurredAt ?? null;
    } else if (
      eventGroup.eventKind === StudioListingCollectionShareEventKind.opened
    ) {
      rollup.viewCount = eventGroup._count._all;
      rollup.lastViewedAt = eventGroup._max.occurredAt ?? null;
    }

    rollups.set(eventGroup.collectionId, rollup);
  }

  const items = records
    .map((record) => {
      const rollup = rollups.get(record.id) ?? {
        shareCount: 0,
        viewCount: 0,
        lastSharedAt: null,
        lastViewedAt: null,
      };

      return {
        id: record.id,
        name: record.name,
        listingCount: record._count.items,
        shareEnabled: record.shareEnabled,
        shareCode: record.shareCode,
        shareCount: rollup.shareCount,
        viewCount: rollup.viewCount,
        lastSharedAt: rollup.lastSharedAt?.toISOString() ?? null,
        lastViewedAt: rollup.lastViewedAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      } satisfies StudioListingCollectionShareListItem;
    })
    .sort((left, right) => {
      const leftLatest = Math.max(
        new Date(left.lastViewedAt ?? 0).getTime(),
        new Date(left.lastSharedAt ?? 0).getTime(),
        new Date(left.updatedAt).getTime(),
      );
      const rightLatest = Math.max(
        new Date(right.lastViewedAt ?? 0).getTime(),
        new Date(right.lastSharedAt ?? 0).getTime(),
        new Date(right.updatedAt).getTime(),
      );

      return rightLatest - leftLatest || left.name.localeCompare(right.name);
    });

  return {
    summary: {
      sharedCollections: items.length,
      shareCount: items.reduce((sum, item) => sum + item.shareCount, 0),
      viewCount: items.reduce((sum, item) => sum + item.viewCount, 0),
      activeShareLinks: items.filter(
        (item) => item.shareEnabled && Boolean(item.shareCode),
      ).length,
    },
    items,
  };
}

export async function listStudioListingCollectionPickerItems(input: {
  organizationId: string;
  membershipId: string;
  packId: string;
  search?: string | null;
}) {
  const search = trimString(input.search);
  const records = await prisma.studioListingCollection.findMany({
    where: {
      organizationId: input.organizationId,
      createdByMembershipId: input.membershipId,
      name: search
        ? {
            contains: search,
            mode: "insensitive",
          }
        : undefined,
    },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      _count: {
        select: {
          items: true,
        },
      },
      items: {
        where: {
          packId: input.packId,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    listingCount: record._count.items,
    includesPack: record.items.length > 0,
    updatedAt: record.updatedAt.toISOString(),
  }));
}

export async function getStudioListingCollectionDetail(input: {
  organizationId: string;
  membershipId: string;
  collectionId: string;
}) {
  const record = await prisma.studioListingCollection.findFirst({
    where: {
      id: input.collectionId,
      organizationId: input.organizationId,
      createdByMembershipId: input.membershipId,
    },
    include: studioListingCollectionInclude,
  });

  return record ? mapCollectionDetail(record) : null;
}

export async function publishStudioListingCollection(input: {
  organizationId: string;
  collectionId: string;
  membershipId: string;
}) {
  const existing = await prisma.studioListingCollection.findFirst({
    where: {
      id: input.collectionId,
      organizationId: input.organizationId,
      createdByMembershipId: input.membershipId,
    },
  });

  if (!existing) {
    return null;
  }

  const shareCode =
    existing.shareCode && existing.shareCode.trim()
      ? existing.shareCode
      : createStudioListingCollectionShareCode();

  await prisma.$transaction([
    prisma.studioListingCollection.update({
      where: { id: existing.id },
      data: {
        updatedByMembershipId: input.membershipId,
        shareEnabled: true,
        shareCode,
      },
    }),
    prisma.studioListingCollectionShareEvent.create({
      data: {
        organizationId: existing.organizationId,
        collectionId: existing.id,
        shareCode,
        eventKind: StudioListingCollectionShareEventKind.shared,
        createdByMembershipId: input.membershipId,
      },
    }),
  ]);

  return {
    shareCode,
  };
}

export async function createStudioListingCollection(input: {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  name: string;
  initialPackId?: string | null;
}) {
  const nextName = normalizeCollectionName(input.name);
  if (!nextName) {
    throw new Error("Collection name is required.");
  }

  const collectionId = await prisma
    .$transaction(async (tx) => {
      const nextPackId = trimString(input.initialPackId);
      if (nextPackId) {
        const savedPack = await tx.studioListingSavedPack.findFirst({
          where: {
            organizationId: input.organizationId,
            membershipId: input.membershipId,
            packId: nextPackId,
          },
          select: {
            packId: true,
          },
        });

        if (!savedPack) {
          throw new Error("Listing pack not found.");
        }
      }

      const created = await tx.studioListingCollection.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? null,
          createdByMembershipId: input.membershipId,
          updatedByMembershipId: input.membershipId,
          name: nextName,
          nameNormalized: normalizeCollectionNameKey(nextName),
          items: nextPackId
            ? {
                create: {
                  packId: nextPackId,
                },
              }
            : undefined,
        },
        select: {
          id: true,
        },
      });

      return created.id;
    })
    .catch((error: unknown) => {
      if (isCollectionNameConflictError(error)) {
        throw new Error("Collection name already exists.");
      }

      throw error;
    });

  return getStudioListingCollectionDetail({
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    collectionId,
  });
}

export async function updateStudioListingCollection(input: {
  organizationId: string;
  membershipId: string;
  collectionId: string;
  name: string;
}) {
  const nextName = normalizeCollectionName(input.name);
  if (!nextName) {
    throw new Error("Collection name is required.");
  }

  const existing = await prisma.studioListingCollection.findFirst({
    where: {
      id: input.collectionId,
      organizationId: input.organizationId,
      createdByMembershipId: input.membershipId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return null;
  }

  await prisma.studioListingCollection
    .update({
      where: {
        id: existing.id,
      },
      data: {
        updatedByMembershipId: input.membershipId,
        name: nextName,
        nameNormalized: normalizeCollectionNameKey(nextName),
      },
    })
    .catch((error: unknown) => {
      if (isCollectionNameConflictError(error)) {
        throw new Error("Collection name already exists.");
      }

      throw error;
    });

  return getStudioListingCollectionDetail({
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    collectionId: existing.id,
  });
}

export async function deleteStudioListingCollection(input: {
  organizationId: string;
  membershipId: string;
  collectionId: string;
}) {
  const existing = await prisma.studioListingCollection.findFirst({
    where: {
      id: input.collectionId,
      organizationId: input.organizationId,
      createdByMembershipId: input.membershipId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return null;
  }

  await prisma.studioListingCollection.delete({
    where: {
      id: existing.id,
    },
  });

  return {
    deleted: true,
  };
}

export async function addStudioListingPackToCollection(input: {
  organizationId: string;
  membershipId: string;
  collectionId: string;
  packId: string;
}) {
  const updatedCollectionId = await prisma.$transaction(async (tx) => {
    const collection = await tx.studioListingCollection.findFirst({
      where: {
        id: input.collectionId,
        organizationId: input.organizationId,
        createdByMembershipId: input.membershipId,
      },
      select: {
        id: true,
      },
    });

    if (!collection) {
      return null;
    }

    const savedPack = await tx.studioListingSavedPack.findFirst({
      where: {
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        packId: input.packId,
      },
      select: {
        packId: true,
      },
    });

    if (!savedPack) {
      throw new Error("Listing pack not found.");
    }

    await tx.studioListingCollectionItem.upsert({
      where: {
        collectionId_packId: {
          collectionId: collection.id,
          packId: input.packId,
        },
      },
      create: {
        collectionId: collection.id,
        packId: input.packId,
      },
      update: {},
    });

    await tx.studioListingCollection.update({
      where: {
        id: collection.id,
      },
      data: {
        updatedByMembershipId: input.membershipId,
      },
    });

    return collection.id;
  });

  if (!updatedCollectionId) {
    return null;
  }

  return getStudioListingCollectionDetail({
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    collectionId: updatedCollectionId,
  });
}

export async function removeStudioListingPackFromCollection(input: {
  organizationId: string;
  membershipId: string;
  collectionId: string;
  packId: string;
}) {
  const updatedCollectionId = await prisma.$transaction(async (tx) => {
    const collection = await tx.studioListingCollection.findFirst({
      where: {
        id: input.collectionId,
        organizationId: input.organizationId,
        createdByMembershipId: input.membershipId,
      },
      select: {
        id: true,
      },
    });

    if (!collection) {
      return null;
    }

    await tx.studioListingCollectionItem.deleteMany({
      where: {
        collectionId: collection.id,
        packId: input.packId,
      },
    });

    await tx.studioListingCollection.update({
      where: {
        id: collection.id,
      },
      data: {
        updatedByMembershipId: input.membershipId,
      },
    });

    return collection.id;
  });

  if (!updatedCollectionId) {
    return null;
  }

  return getStudioListingCollectionDetail({
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    collectionId: updatedCollectionId,
  });
}

function mapDetailSnapshot(record: StudioListingPackRecord): StudioListingDetailSnapshot {
  const snapshot = record.snapshot;
  const resolvedBuildingName = resolveSnapshotBuildingName(snapshot);
  const resolvedLocationLine = formatLocalityLine(snapshot);
  const resolvedSqft = deriveSnapshotSqft(snapshot);
  const resolvedListingType = resolveNormalizedListingType({
    listingType: snapshot.listingType ?? trimString(readSnapshotCanonicalField(snapshot, "listingType")),
    priceLabel: snapshot.priceLabel ?? trimString(readSnapshotCanonicalField(snapshot, "priceLabel")),
    sourceUrl: snapshot.sourceUrl,
  });
  const bulletPoints = normalizeBulletPoints(record.bulletPointsJson);
  const selectedAssetIds = normalizeBulletPoints(record.selectedAssetIdsJson);
  const sourceFacts = normalizeLabeledValues(
    readCanonicalFieldFromRawParsed(snapshot.rawParsedJson as Prisma.JsonValue | null, "sourceFacts"),
  );
  const rawDetailSections = normalizeDetailSections(
    readCanonicalFieldFromRawParsed(snapshot.rawParsedJson as Prisma.JsonValue | null, "detailSections"),
  );
  const fallbackTransit = rawDetailSections
    .filter((section) => /transit|transportation|subway|station/i.test(section.title))
    .flatMap((section) => section.items.map(parseFallbackTransitItem))
    .filter((entry): entry is StudioTransitItem => Boolean(entry));
  const capturedSections = rawDetailSections.filter(
    (section) => !/amenities|features|transit|transportation|history|about|overview/i.test(section.title),
  );
  const propertyHistory = normalizeDetailSections(snapshot.propertyHistoryJson as Prisma.JsonValue | null);
  const assets = snapshot.assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    label: asset.label,
    mimeType: asset.mimeType,
    fileName: asset.fileName,
    sortOrder: asset.sortOrder,
  }));
  const facts = (
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
          sqft: resolvedSqft,
          availabilityLabel: snapshot.availabilityLabel,
        })
  ).slice();

  if (resolvedSqft !== null && !facts.some((entry) => entry.label.toLowerCase() === "sqft")) {
    facts.splice(Math.min(2, facts.length), 0, {
      label: "Sqft",
      value: new Intl.NumberFormat("en-US").format(resolvedSqft),
    });
  }

  const resolvedPrice = resolveSnapshotPrice(snapshot);

  return {
    packId: record.id,
    importId: snapshot.import.id,
    sourceSite: snapshot.sourceSite,
    sourceUrl: snapshot.sourceUrl,
    importStatus: snapshot.import.status,
    title: snapshot.title,
    listingType: resolvedListingType,
    statusLabel: snapshot.statusLabel,
    price: resolvedPrice,
    priceLabel: resolveListingPriceLabel({
      price: resolvedPrice,
      priceLabel: snapshot.priceLabel,
      currency: snapshot.currency,
    }),
    streetAddress: snapshot.streetAddress,
    unit: snapshot.unit,
    city: resolveSnapshotCity(snapshot),
    state: resolveSnapshotState(snapshot),
    postalCode: resolveSnapshotPostalCode(snapshot),
    borough: snapshot.borough,
    neighborhood: snapshot.neighborhood,
    buildingName: resolvedBuildingName,
    addressLine: formatAddressLine(snapshot),
    locationLine: resolvedLocationLine,
    latitude: snapshot.latitude ? Number(snapshot.latitude) : null,
    longitude: snapshot.longitude ? Number(snapshot.longitude) : null,
    bedrooms: snapshot.bedrooms ? Number(snapshot.bedrooms) : null,
    bathrooms: snapshot.bathrooms ? Number(snapshot.bathrooms) : null,
    rooms: snapshot.rooms ? Number(snapshot.rooms) : null,
    sqft: resolvedSqft,
    availabilityLabel: snapshot.availabilityLabel,
    descriptionText: snapshot.descriptionText,
    facts,
    sourceFacts,
    amenities: Array.isArray(snapshot.amenitiesJson)
      ? (snapshot.amenitiesJson as Array<{ title: string; items: string[] }>)
      : [],
    transit: Array.isArray(snapshot.transitJson)
      ? normalizeTransitItems(snapshot.transitJson as Prisma.JsonValue)
      : fallbackTransit,
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
      companyFeedVisible: record.companyFeedVisible,
      companyFeedLabel: resolveCompanyFeedLabel(
        record.companyFeedLabel,
        record.companyFeedVisible,
      ),
      companyFeedPublishedAt: record.companyFeedPublishedAt?.toISOString() ?? null,
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
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  title?: string | null;
  sourceUrl?: string | null;
  listingType?: string | null;
  statusLabel?: string | null;
  price?: number | null;
  streetAddress?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  neighborhood?: string | null;
  buildingName?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  rooms?: number | null;
  sqft?: number | null;
  availabilityLabel?: string | null;
  descriptionText?: string | null;
  amenities?: StudioAmenitySection[];
  sourceFacts?: StudioLabeledValue[];
  companyFeedVisible?: boolean;
  companyFeedLabel?: string | null;
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

  function resolveContactField(value: string | undefined, fallback: string | null | undefined) {
    if (value === undefined) {
      return fallback?.trim() || "";
    }

    return value.trim();
  }

  function resolveOptionalTextField(
    value: string | null | undefined,
    fallback: string | null | undefined,
  ) {
    if (value === undefined) {
      return fallback?.trim() || null;
    }

    return value?.trim() || null;
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
  const nextStreetAddress = resolveOptionalTextField(
    input.streetAddress,
    existing.snapshot.streetAddress,
  );
  const nextUnit = resolveOptionalTextField(input.unit, existing.snapshot.unit);
  const nextCity = resolveOptionalTextField(input.city, existing.snapshot.city);
  const nextState = resolveOptionalTextField(input.state, existing.snapshot.state);
  const nextPostalCode = resolveOptionalTextField(
    input.postalCode,
    existing.snapshot.postalCode,
  );
  const nextNeighborhood = resolveOptionalTextField(
    input.neighborhood,
    existing.snapshot.neighborhood,
  );
  const nextBuildingName = resolveOptionalTextField(
    input.buildingName,
    existing.snapshot.buildingName,
  );
  const nextListingType = resolveOptionalTextField(
    input.listingType,
    existing.snapshot.listingType,
  );
  const nextStatusLabel = resolveOptionalTextField(
    input.statusLabel,
    existing.snapshot.statusLabel,
  );
  const nextSourceUrl = resolveOptionalTextField(input.sourceUrl, existing.snapshot.sourceUrl);
  const nextPrice =
    input.price === undefined
      ? existing.snapshot.price
        ? Number(existing.snapshot.price)
        : null
      : input.price;
  const nextBedrooms =
    input.bedrooms === undefined
      ? existing.snapshot.bedrooms
        ? Number(existing.snapshot.bedrooms)
        : null
      : input.bedrooms;
  const nextBathrooms =
    input.bathrooms === undefined
      ? existing.snapshot.bathrooms
        ? Number(existing.snapshot.bathrooms)
        : null
      : input.bathrooms;
  const nextRooms =
    input.rooms === undefined
      ? existing.snapshot.rooms
        ? Number(existing.snapshot.rooms)
        : null
      : input.rooms;
  const nextSqft = input.sqft === undefined ? existing.snapshot.sqft : input.sqft;
  const nextAvailabilityLabel = resolveOptionalTextField(
    input.availabilityLabel,
    existing.snapshot.availabilityLabel,
  );
  const nextDescriptionText = resolveOptionalTextField(
    input.descriptionText,
    existing.snapshot.descriptionText,
  );
  const nextAmenities =
    input.amenities === undefined
      ? normalizeAmenitySections(existing.snapshot.amenitiesJson)
      : input.amenities
          .map((section) => ({
            title: section.title.trim() || "Amenities & building",
            items: normalizeTextArray(section.items),
          }))
          .filter((section) => section.items.length > 0);
  const nextSourceFacts =
    input.sourceFacts === undefined
      ? normalizeLabeledValues(
          readCanonicalFieldFromRawParsed(
            existing.snapshot.rawParsedJson as Prisma.JsonValue | null,
            "sourceFacts",
          ),
        )
      : input.sourceFacts
          .map((item) => ({
            label: item.label.trim(),
            value: item.value.trim(),
          }))
          .filter((item) => item.label && item.value);
  const nextTitle =
    resolveOptionalTextField(
      input.title,
      formatAddressLine({
        streetAddress: nextStreetAddress,
        unit: nextUnit,
        city: nextCity,
        state: nextState,
        postalCode: nextPostalCode,
        buildingName: null,
        sourceUrl: "",
        rawParsedJson: null,
      }),
    ) ??
    existing.snapshot.title;
  const nextHeadline =
    input.headline === undefined
      ? existing.headline?.trim() || nextTitle
      : input.headline.trim() || nextTitle;
  const nextSummary =
    input.summary === undefined ? existing.summary?.trim() || "" : input.summary.trim();
  const nextAgentNote =
    input.agentNote === undefined ? existing.agentNote?.trim() || "" : input.agentNote.trim();
  const nextBulletPoints =
    input.bulletPoints === undefined
      ? normalizeBulletPoints(existing.bulletPointsJson)
      : input.bulletPoints.filter(Boolean);
  const nextPriceLabel = resolveListingPriceLabel({
    price: nextPrice,
    priceLabel: null,
    currency: existing.snapshot.currency,
  });
  const nextHeroFacts = buildHeroFacts({
    bedrooms: nextBedrooms,
    bathrooms: nextBathrooms,
    sqft: nextSqft,
    availabilityLabel: nextAvailabilityLabel,
  });
  const nextRawParsedJson = cloneRawParsedJson(
    existing.snapshot.rawParsedJson as Prisma.JsonValue | null,
  );
  const nextCanonicalFields =
    nextRawParsedJson.canonicalFields &&
    typeof nextRawParsedJson.canonicalFields === "object" &&
    !Array.isArray(nextRawParsedJson.canonicalFields)
      ? {
          ...(nextRawParsedJson.canonicalFields as Record<string, unknown>),
        }
      : {};

  nextCanonicalFields.title = nextTitle;
  nextCanonicalFields.listingType = nextListingType;
  nextCanonicalFields.statusLabel = nextStatusLabel;
  nextCanonicalFields.price = nextPrice;
  nextCanonicalFields.priceLabel = nextPriceLabel;
  nextCanonicalFields.streetAddress = nextStreetAddress;
  nextCanonicalFields.unit = nextUnit;
  nextCanonicalFields.city = nextCity;
  nextCanonicalFields.state = nextState;
  nextCanonicalFields.postalCode = nextPostalCode;
  nextCanonicalFields.neighborhood = nextNeighborhood;
  nextCanonicalFields.buildingName = nextBuildingName;
  nextCanonicalFields.bedrooms = nextBedrooms;
  nextCanonicalFields.bathrooms = nextBathrooms;
  nextCanonicalFields.rooms = nextRooms;
  nextCanonicalFields.sqft = nextSqft;
  nextCanonicalFields.availabilityLabel = nextAvailabilityLabel;
  nextCanonicalFields.descriptionText = nextDescriptionText;
  nextCanonicalFields.amenities = nextAmenities;
  nextCanonicalFields.sourceFacts = nextSourceFacts;
  nextRawParsedJson.canonicalFields = nextCanonicalFields;
  const nextCompanyFeedVisible =
    input.companyFeedVisible === undefined
      ? existing.companyFeedVisible
      : input.companyFeedVisible;
  const existingCompanyFeedLabel = resolveCompanyFeedLabel(
    existing.companyFeedLabel,
    existing.companyFeedVisible,
  );
  const requestedCompanyFeedLabel =
    input.companyFeedLabel === undefined
      ? undefined
      : trimString(input.companyFeedLabel);
  const nextCompanyFeedLabel =
    requestedCompanyFeedLabel !== undefined
      ? requestedCompanyFeedLabel ??
        (nextCompanyFeedVisible
          ? DEFAULT_STUDIO_LISTING_COMPANY_FEED_LABEL
          : existingCompanyFeedLabel)
      : nextCompanyFeedVisible
        ? existingCompanyFeedLabel ?? DEFAULT_STUDIO_LISTING_COMPANY_FEED_LABEL
        : existingCompanyFeedLabel;
  const nextCompanyFeedPublishedAt = nextCompanyFeedVisible
    ? existing.companyFeedVisible && existing.companyFeedPublishedAt
      ? existing.companyFeedPublishedAt
      : new Date()
    : null;
  const nextCompanyFeedPublishedByMembershipId = nextCompanyFeedVisible
    ? existing.companyFeedVisible &&
      existing.companyFeedPublishedByMembershipId
      ? existing.companyFeedPublishedByMembershipId
      : input.membershipId
    : null;

  await prisma.studioListingSnapshot.update({
    where: { id: existing.snapshot.id },
    data: {
      sourceUrl: nextSourceUrl ?? existing.snapshot.sourceUrl,
      title: nextTitle,
      listingType: nextListingType,
      statusLabel: nextStatusLabel,
      price: nextPrice,
      priceLabel: nextPriceLabel,
      streetAddress: nextStreetAddress,
      unit: nextUnit,
      city: nextCity,
      state: nextState,
      postalCode: nextPostalCode,
      neighborhood: nextNeighborhood,
      buildingName: nextBuildingName,
      bedrooms: nextBedrooms,
      bathrooms: nextBathrooms,
      rooms: nextRooms,
      sqft: nextSqft,
      availabilityLabel: nextAvailabilityLabel,
      descriptionText: nextDescriptionText,
      heroFactsJson: toInputJsonValue(nextHeroFacts),
      amenitiesJson: toInputJsonValue(nextAmenities),
      rawParsedJson: toInputJsonValue(nextRawParsedJson),
    },
  });

  await prisma.studioListingPack.update({
    where: { id: existing.id },
    data: {
      updatedByMembershipId: input.membershipId,
      status: StudioListingPackStatus.ready,
      headline: nextHeadline,
      summary: nextSummary,
      bulletPointsJson: nextBulletPoints,
      selectedAssetIdsJson: selectedAssetIds,
      coverAssetId: nextCoverAssetId,
      companyFeedVisible: nextCompanyFeedVisible,
      companyFeedLabel: nextCompanyFeedLabel,
      companyFeedPublishedAt: nextCompanyFeedPublishedAt,
      companyFeedPublishedByMembershipId: nextCompanyFeedPublishedByMembershipId,
      agentNote: nextAgentNote,
      contactName: resolveContactField(input.contactName, existing.contactName),
      contactTitle: resolveContactField(input.contactTitle, existing.contactTitle),
      contactPhone: resolveContactField(input.contactPhone, existing.contactPhone),
      contactEmail: resolveContactField(input.contactEmail, existing.contactEmail),
    },
  });

  return getStudioListingPackDetail({
    organizationId: input.organizationId,
    packId: input.packId,
  });
}

export async function saveStudioListingPackToMyListings(input: {
  organizationId: string;
  membershipId: string;
  packId: string;
}) {
  const pack = await prisma.studioListingPack.findFirst({
    where: {
      id: input.packId,
      organizationId: input.organizationId,
      companyFeedVisible: true,
    },
    select: {
      id: true,
    },
  });

  if (!pack) {
    return null;
  }

  const existing = await prisma.studioListingSavedPack.findFirst({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      packId: input.packId,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return {
      saved: true,
      alreadySaved: true,
    };
  }

  await prisma.studioListingSavedPack.create({
    data: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      packId: input.packId,
      source: StudioListingSavedPackSource.saved_from_dashboard,
    },
  });

  return {
    saved: true,
    alreadySaved: false,
  };
}

export async function removeStudioListingPackFromMyListings(input: {
  organizationId: string;
  membershipId: string;
  packId: string;
}) {
  const savedPack = await prisma.studioListingSavedPack.findFirst({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      packId: input.packId,
    },
    select: {
      id: true,
      source: true,
    },
  });

  if (!savedPack) {
    return null;
  }

  if (savedPack.source !== StudioListingSavedPackSource.saved_from_dashboard) {
    throw new Error("Only company dashboard listings can be removed from My listings.");
  }

  const removedCollectionIds = await prisma.$transaction(async (tx) => {
    const collectionIds = (
      await tx.studioListingCollection.findMany({
        where: {
          organizationId: input.organizationId,
          createdByMembershipId: input.membershipId,
          items: {
            some: {
              packId: input.packId,
            },
          },
        },
        select: {
          id: true,
        },
      })
    ).map((collection) => collection.id);

    if (collectionIds.length) {
      await tx.studioListingCollectionItem.deleteMany({
        where: {
          collectionId: {
            in: collectionIds,
          },
          packId: input.packId,
        },
      });

      await tx.studioListingCollection.updateMany({
        where: {
          id: {
            in: collectionIds,
          },
        },
        data: {
          updatedByMembershipId: input.membershipId,
          updatedAt: new Date(),
        },
      });
    }

    await tx.studioListingSavedPack.delete({
      where: {
        id: savedPack.id,
      },
    });

    return collectionIds;
  });

  return {
    removed: true,
    removedCollectionCount: removedCollectionIds.length,
  };
}

export async function appendStudioListingPackAssets(input: {
  organizationId: string;
  packId: string;
  membershipId: string;
  files: Array<{
    fileName: string;
    mimeType?: string | null;
    bytes: Uint8Array;
  }>;
}) {
  const existing = await prisma.studioListingPack.findFirst({
    where: {
      id: input.packId,
      organizationId: input.organizationId,
    },
    include: {
      snapshot: {
        include: {
          import: true,
          assets: {
            orderBy: studioListingAssetsOrderBy,
          },
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const validFiles = input.files.filter((file) => file.bytes.byteLength > 0);
  if (!validFiles.length) {
    return getStudioListingPackDetail({
      organizationId: input.organizationId,
      packId: input.packId,
    });
  }

  let nextSortOrder =
    existing.snapshot.assets.reduce((max, asset) => Math.max(max, asset.sortOrder), -1) + 1;
  const createdAssetIds: string[] = [];

  for (const file of validFiles) {
    const saved = await getFileHelpers().saveFile({
      organizationId: input.organizationId,
      importId: existing.snapshot.importId,
      bucket: "assets",
      fileName: file.fileName || `upload-${nextSortOrder + 1}.bin`,
      bytes: file.bytes,
    });

    const created = await prisma.studioListingAsset.create({
      data: {
        organizationId: input.organizationId,
        snapshotId: existing.snapshot.id,
        kind: StudioListingAssetKind.gallery,
        label: trimString(file.fileName.replace(/\.[^.]+$/, "")),
        originalUrl: null,
        storageKey: saved.storageKey,
        mimeType: file.mimeType?.trim() || null,
        fileName: saved.fileName,
        fileSizeBytes: saved.fileSizeBytes,
        sortOrder: nextSortOrder,
      },
    });

    createdAssetIds.push(created.id);
    nextSortOrder += 1;
  }

  const existingPhotoAssetIds = existing.snapshot.assets
    .filter((asset) => asset.kind === StudioListingAssetKind.hero || asset.kind === StudioListingAssetKind.gallery)
    .map((asset) => asset.id);
  const nextSelectedAssetIds = [...existingPhotoAssetIds, ...createdAssetIds];
  const nextCoverAssetId =
    existing.coverAssetId && nextSelectedAssetIds.includes(existing.coverAssetId)
      ? existing.coverAssetId
      : nextSelectedAssetIds[0] ?? null;

  await prisma.studioListingPack.update({
    where: { id: existing.id },
    data: {
      updatedByMembershipId: input.membershipId,
      status: StudioListingPackStatus.ready,
      selectedAssetIdsJson: nextSelectedAssetIds,
      coverAssetId: nextCoverAssetId,
    },
  });

  return getStudioListingPackDetail({
    organizationId: input.organizationId,
    packId: input.packId,
  });
}

export async function deleteStudioListingPackAsset(input: {
  organizationId: string;
  packId: string;
  membershipId: string;
  assetId: string;
}) {
  const existing = await prisma.studioListingPack.findFirst({
    where: {
      id: input.packId,
      organizationId: input.organizationId,
    },
    include: {
      snapshot: {
        include: {
          assets: {
            orderBy: studioListingAssetsOrderBy,
          },
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const asset = existing.snapshot.assets.find((entry) => entry.id === input.assetId);
  if (!asset) {
    return getStudioListingPackDetail({
      organizationId: input.organizationId,
      packId: input.packId,
    });
  }

  await prisma.studioListingAsset.delete({
    where: { id: asset.id },
  });

  if (asset.storageKey) {
    await getFileHelpers().deleteFile?.(asset.storageKey);
  }

  const remainingPhotoAssetIds = existing.snapshot.assets
    .filter(
      (entry) =>
        entry.id !== input.assetId &&
        (entry.kind === StudioListingAssetKind.hero || entry.kind === StudioListingAssetKind.gallery),
    )
    .map((entry) => entry.id);
  const nextCoverAssetId =
    existing.coverAssetId === input.assetId
      ? remainingPhotoAssetIds[0] ?? null
      : existing.coverAssetId && remainingPhotoAssetIds.includes(existing.coverAssetId)
        ? existing.coverAssetId
        : remainingPhotoAssetIds[0] ?? null;

  await prisma.studioListingPack.update({
    where: { id: existing.id },
    data: {
      updatedByMembershipId: input.membershipId,
      status: StudioListingPackStatus.ready,
      selectedAssetIdsJson: remainingPhotoAssetIds,
      coverAssetId: nextCoverAssetId,
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
      : createStudioListingPackShareCode();

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

export async function deleteStudioListingPack(input: {
  organizationId: string;
  packId: string;
}) {
  const existing = await prisma.studioListingPack.findFirst({
    where: {
      id: input.packId,
      organizationId: input.organizationId,
    },
    include: {
      snapshot: {
        include: {
          import: true,
          assets: {
            select: {
              storageKey: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const storageKeys = [
    existing.snapshot.import.rawHtmlStorageKey,
    existing.snapshot.import.rawJsonStorageKey,
    existing.pdfStorageKey,
    ...existing.snapshot.assets.map((asset) => asset.storageKey),
  ].filter((value): value is string => Boolean(trimString(value)));

  await prisma.studioListingImport.delete({
    where: { id: existing.snapshot.import.id },
  });

  const deleteFile = getFileHelpers().deleteFile;
  if (storageKeys.length && deleteFile) {
    await Promise.all(storageKeys.map((storageKey) => deleteFile(storageKey).catch(() => null)));
  }

  return {
    deleted: true,
  };
}

function hashViewerValue(value: string | null) {
  return value ? createHash("sha256").update(value).digest("hex") : null;
}

function buildStudioListingPrimaryShareWhere(
  shareCode: string,
): Prisma.StudioListingPackWhereInput {
  return {
    shareCode,
    shareEnabled: true,
  };
}

function buildStudioListingLegacyShareWhere(
  shareCode: string,
): Prisma.StudioListingPackWhereInput {
  return {
    legacyShareCode: shareCode,
    legacyShareCodeExpiresAt: {
      gt: new Date(),
    },
    shareEnabled: true,
  };
}

function buildStudioListingCollectionShareWhere(
  shareCode: string,
): Prisma.StudioListingCollectionWhereInput {
  return {
    shareCode,
    shareEnabled: true,
  };
}

export async function getStudioListingPublicPack(input: {
  shareCode: string;
  viewerFingerprint?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  let record = await prisma.studioListingPack.findFirst({
    where: buildStudioListingPrimaryShareWhere(input.shareCode),
    include: studioListingPackDetailInclude,
  });
  let usesLegacyShareCode = false;
  let legacyShareCodeExpiresAt: Date | null = null;

  if (!record) {
    const legacyRecord = await prisma.studioListingPack.findFirst({
      where: buildStudioListingLegacyShareWhere(input.shareCode),
      include: studioListingPackDetailInclude,
    });

    if (legacyRecord) {
      record = legacyRecord;
      usesLegacyShareCode = true;
      legacyShareCodeExpiresAt = legacyRecord.legacyShareCodeExpiresAt ?? null;
    }
  }

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
    usesLegacyShareCode,
    legacyShareCodeExpiresAt,
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

export async function getStudioListingPublicCollection(input: {
  shareCode: string;
  viewerFingerprint?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  const record = await prisma.studioListingCollection.findFirst({
    where: buildStudioListingCollectionShareWhere(input.shareCode),
    include: studioListingCollectionInclude,
  });

  if (!record) {
    return null;
  }

  await prisma.studioListingCollectionShareEvent.create({
    data: {
      organizationId: record.organizationId,
      collectionId: record.id,
      shareCode: input.shareCode,
      eventKind: StudioListingCollectionShareEventKind.opened,
      viewerFingerprint: trimString(input.viewerFingerprint),
      referrer: trimString(input.referrer),
      userAgent: trimString(input.userAgent),
      ipAddressHash: hashViewerValue(trimString(input.ipAddress)),
    },
  });

  const listingRecords = sortStudioListingPackRecords(record.items.map((item) => item.pack));
  const primaryContactRecord = listingRecords.find(
    (pack) =>
      trimString(pack.contactName) ||
      trimString(pack.contactTitle) ||
      trimString(pack.contactPhone) ||
      trimString(pack.contactEmail),
  );
  const listings = listingRecords.map(
    (pack) => {
      const item = mapListItem(pack);
      const detail = mapDetailSnapshot(pack);
      const selectedAssetIds = new Set(detail.pack.selectedAssetIds);
      const selectedAssets = detail.assets
        .filter((asset) => selectedAssetIds.has(asset.id))
        .map((asset) => ({
          id: asset.id,
          kind: asset.kind,
          label: asset.label,
          sortOrder: asset.sortOrder,
        }));
      const fallbackAssets = detail.assets.slice(0, 8).map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        label: asset.label,
        sortOrder: asset.sortOrder,
      }));

      return {
        packId: item.packId,
        title: item.title,
        displayTitle: item.displayTitle,
        listingType: item.listingType,
        priceLabel: item.priceLabel,
        addressLine: item.addressLine,
        locationLine: item.locationLine,
        latitude: detail.latitude,
        longitude: detail.longitude,
        factsLine: item.factsLine,
        statusLabel: item.statusLabel,
        heroAssetId: item.heroAssetId,
        agentNote: detail.pack.agentNote,
        descriptionText: detail.descriptionText,
        facts: detail.facts,
        amenities: detail.amenities,
        buildingName: detail.buildingName,
        selectedAssets: selectedAssets.length ? selectedAssets : fallbackAssets,
      };
    },
  );

  return {
    code: input.shareCode,
    name: record.name,
    listingCount: listings.length,
    updatedAt: record.updatedAt.toISOString(),
    contact: {
      name: primaryContactRecord?.contactName?.trim() || "Acre Agent",
      title: primaryContactRecord?.contactTitle?.trim() || "Acre NY Realty Inc",
      phone: primaryContactRecord?.contactPhone?.trim() || "",
      email: primaryContactRecord?.contactEmail?.trim() || "",
    },
    listings,
  } satisfies StudioListingPublicCollectionSnapshot;
}

export async function getStudioListingAssetRecord(input: {
  assetId: string;
  organizationId?: string | null;
  shareCode?: string | null;
}) {
  if (input.shareCode) {
    const asset =
      (await prisma.studioListingAsset.findFirst({
        where: {
          id: input.assetId,
          snapshot: {
            pack: buildStudioListingPrimaryShareWhere(input.shareCode),
          },
        },
      })) ??
      (await prisma.studioListingAsset.findFirst({
        where: {
          id: input.assetId,
          snapshot: {
            pack: buildStudioListingLegacyShareWhere(input.shareCode),
          },
        },
      })) ??
      (await prisma.studioListingAsset.findFirst({
        where: {
          id: input.assetId,
          snapshot: {
            pack: {
              collectionItems: {
                some: {
                  collection: buildStudioListingCollectionShareWhere(
                    input.shareCode,
                  ),
                },
              },
            },
          },
        },
      }));

    return asset;
  }

  const asset = await prisma.studioListingAsset.findFirst({
    where: {
      id: input.assetId,
      organizationId: input.organizationId ?? undefined,
    },
  });

  return asset;
}
