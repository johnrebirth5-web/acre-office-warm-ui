"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { StudioListingDetailSnapshot } from "@acre/db";
import {
  Button,
  CheckboxField,
  SelectInput,
  TextareaInput,
  TextInput,
} from "@acre/ui";
import { StudioCollectionPicker } from "../../studio-collection-picker";

const preloadedAssetIds = new Set<string>();

function preloadAssetImage(assetId: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (preloadedAssetIds.has(assetId)) {
    return;
  }

  preloadedAssetIds.add(assetId);

  const image = new window.Image();

  image.decoding = "async";
  image.src = `/api/listing-studio/assets/${assetId}`;
}

type ListingStudioDetailClientProps = {
  detail: StudioListingDetailSnapshot;
};

type MediaMode = "photo" | "floorplan" | "map";

type TransitSummary = {
  nearestWalkMinutes: number | null;
  withinFiveHundredMeters: number | null;
};

type TransitItem = {
  detail?: string | null;
  distanceLabel?: string | null;
  label: string;
};

type PrimaryFactCard = {
  accent?: "success";
  label: string;
  value: string;
};

type AmenityCatalogSection = {
  title: string;
  options: string[];
};

type DisplayAmenitySection = {
  items: string[];
  title: string;
};

type EditorAmenitySection = {
  title: string;
  options: string[];
  selected: string[];
  customItems: string[];
  draftCustom: string;
  isAddingCustom: boolean;
  open: boolean;
};

type ListingEditorState = {
  listingKind: "sale" | "rental";
  selectedAssetIds: string[];
  coverAssetId: string | null;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  unit: string;
  neighborhood: string;
  buildingName: string;
  listingUrl: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  propertyType: string;
  status: string;
  availability: string;
  yearBuilt: string;
  listDate: string;
  commonCharges: string;
  taxes: string;
  description: string;
  amenitySections: EditorAmenitySection[];
};

const PROPERTY_TYPE_OPTIONS = [
  "Rental unit",
  "Condo",
  "Co-op",
  "Apartment",
  "Townhouse",
  "Multi-family",
  "Loft",
  "House",
];

const STATUS_OPTIONS = ["Active", "Off market", "Pending", "Rented", "Sold"];

const AMENITY_CATALOG: AmenityCatalogSection[] = [
  {
    title: "Services & Facilities",
    options: [
      "Bike Room",
      "Bike Storage",
      "Bicycle Storage",
      "Concierge",
      "Doorman",
      "Virtual Doorman",
      "Video Doorman",
      "Elevator",
      "Package Room",
      "Smart Package Room",
      "Laundry in Building",
      "Laundry Room",
      "Storage",
      "Storage Available",
      "Tenant Storage",
      "Cold Storage",
      "Locker / Cage Storage",
      "Live-in Super",
      "Super Lives in Building",
      "Garage Parking",
      "Garage",
      "Parking",
      "Parking Available",
      "Assigned Parking",
      "Valet Parking",
      "Covered Parking",
      "Attended Parking",
      "Wheelchair Access",
      "Accessible Entrance",
      "Smoke Free",
      "Smoke-free",
      "Security Guard",
      "Security Cameras",
      "Gated Access",
      "Intercom",
      "Video Intercom",
      "Keyless Entry",
    ],
  },
  {
    title: "Wellness & Recreation",
    options: [
      "Gym",
      "Fitness Center",
      "Gymnasium",
      "Yoga Room",
      "Yoga Studio",
      "Yoga / Dance Studio",
      "Pilates Studio",
      "Cross Fit Room",
      "Swimming Pool",
      "Indoor Pool",
      "Outdoor Pool",
      "Sauna",
      "Steam Room",
      "Spa",
      "Hot Tub",
      "Cold Plunge",
      "Media Room",
      "Screening Room",
      "Theater Room",
      "Game Room",
      "Billiards Room",
      "Resident Lounge",
      "Lounge",
      "Library",
      "Co-working Space",
      "Co-working Lounge",
      "Business Center",
      "Conference Room",
      "Golf Simulator",
      "Golf Room",
      "Music Room",
      "Study Room",
      "Sky Lounge",
    ],
  },
  {
    title: "Shared Outdoor Space",
    options: [
      "Roof Deck",
      "Rooftop",
      "Deck",
      "Terrace",
      "Patio",
      "Courtyard",
      "Garden",
      "Zen Garden",
      "Wellness Garden",
      "Shared Backyard",
      "Outdoor Lounge",
      "BBQ Area",
      "BBQ Grills",
      "Outdoor Kitchen",
      "Sundeck",
      "Outdoor Yoga Lawn",
    ],
  },
  {
    title: "Family & Pets",
    options: [
      "Children's Playroom",
      "Kids Room",
      "Playground",
      "Dog Run",
      "Dog Park",
      "Pet Spa",
      "Dog Spa",
      "Dog Washing Station",
      "Pet Friendly",
      "Pets Allowed",
    ],
  },
  {
    title: "Unit / Apartment Amenities",
    options: [
      "Washer / Dryer",
      "Washer/Dryer",
      "Washer/Dryer In Unit",
      "In-unit Washer/Dryer",
      "Washer and Dryer",
      "Washer and Dryer In Unit",
      "Shared Laundry",
      "Laundry In Unit",
      "Dishwasher",
      "Microwave",
      "Refrigerator",
      "Stainless Steel Appliances",
      "Gas Range",
      "Electric Range",
      "Garbage Disposal",
      "Chef's Kitchen",
      "Kitchen Island",
      "Central Air",
      "Central Air Conditioning",
      "Split Unit Heating",
      "Split Unit Cooling",
      "Split-unit Heat/AC",
      "Individual A/C Units",
      "Heating",
      "Air Conditioning",
      "Hardwood Floors",
      "High Ceilings",
      "Floor to Ceiling Windows",
      "Large Windows",
      "Walk-in Closet",
      "Abundant Closets",
      "Private Outdoor Space",
      "Balcony",
      "Terrace (Private)",
      "Patio (Private)",
      "Verizon Fios",
      "High Speed Internet",
      "Cable Ready",
      "Smart Controls",
    ],
  },
  {
    title: "Views / Exposure",
    options: ["City View", "Skyline View", "Water View", "Park View", "Garden View"],
  },
  {
    title: "Highlight Tags",
    options: ["Doorman", "Elevator", "Pets Allowed", "Private Outdoor Space", "Washer/Dryer", "Gym"],
  },
];

function IconPlus() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M15.5 7.5a3 3 0 1 0-2.86-4h-.28a3 3 0 0 0 .14.9l-5.63 3.1a3 3 0 1 0 0 8.98l5.63 3.1a3 3 0 1 0 .63-1.87l-5.63-3.1a3.12 3.12 0 0 0 0-1.38l5.63-3.1a3 3 0 0 0 2.37 1.17Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconLink() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M10 14 8 16a4 4 0 1 1-5.66-5.66l3-3A4 4 0 0 1 11 8m3-2 2-2a4 4 0 1 1 5.66 5.66l-3 3A4 4 0 0 1 13 16m-2-4h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 20 4.5-1 9.24-9.24a2.12 2.12 0 0 0-3-3L5.5 16 4 20Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="m13.5 7.5 3 3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m15 18-6-6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconLocation() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 20s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" fill="currentColor" r="1.8" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        width="10"
        x="9"
        y="7"
      />
      <path
        d="M15 7V5.5A2.5 2.5 0 0 0 12.5 3h-6A2.5 2.5 0 0 0 4 5.5v9A2.5 2.5 0 0 0 6.5 17H9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconChevronDown(props: { isOpen?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={props.isOpen ? "is-open" : undefined}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M14 5h5v5M10 14 19 5M19 14v5h-5M5 10V5h5M5 19h5v-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 16V6m0 0-4 4m4-4 4 4M5 18.5h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <rect
        height="13"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        width="18"
        x="3"
        y="7"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconFactBedrooms() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 18V9.5A1.5 1.5 0 0 1 5.5 8h13A1.5 1.5 0 0 1 20 9.5V18M4 14h16M7 11h3m4 0h3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconFactBathrooms() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 10.5h10M9 10.5V7.8A3 3 0 0 1 12 5a3 3 0 0 1 3 2.8v2.7M8 19h8M9 19l-.8-4.5M15 19l.8-4.5M6 14.5h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconFactSqft() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconFactAvailability() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4l2.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconTransit() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M8 18h8M9.5 18 8 20M14.5 18 16 20M8 6.5A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5v7A2.5 2.5 0 0 1 13.5 16h-3A2.5 2.5 0 0 1 8 13.5v-7ZM8 10h8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function buildShareUrl(shareCode: string | null) {
  return shareCode ? `/share/packs/${shareCode}` : null;
}

function isPhotoAssetKind(kind: StudioListingDetailSnapshot["assets"][number]["kind"]) {
  return kind === "hero" || kind === "gallery";
}

function isLikelyPdf(url: string | null, mimeType?: string | null) {
  if (mimeType?.toLowerCase().includes("pdf")) {
    return true;
  }

  return typeof url === "string" && /\.pdf(?:$|\?)/i.test(url);
}

function getInitialPhotoId(detail: StudioListingDetailSnapshot) {
  const photoAssets = detail.assets.filter((asset) => isPhotoAssetKind(asset.kind));
  const preferredIds = [detail.pack.coverAssetId, ...detail.pack.selectedAssetIds].filter(
    (value): value is string => Boolean(value),
  );

  return (
    preferredIds.find((assetId) => photoAssets.some((asset) => asset.id === assetId)) ??
    photoAssets[0]?.id ??
    null
  );
}

function getInitialMediaMode(detail: StudioListingDetailSnapshot): MediaMode {
  if (getInitialPhotoId(detail)) {
    return "photo";
  }

  if (detail.assets.some((asset) => asset.kind === "floor_plan") || detail.floorPlans.length) {
    return "floorplan";
  }

  if (detail.latitude !== null || detail.longitude !== null || detail.addressLine) {
    return "map";
  }

  return "photo";
}

function isVideoAssetMime(mimeType: string | null) {
  return typeof mimeType === "string" && mimeType.toLowerCase().startsWith("video/");
}

function findSourceFactValue(items: Array<{ label: string; value: string }>, matcher: RegExp) {
  return items.find((item) => matcher.test(item.label))?.value ?? null;
}

function getHeaderEyebrow(detail: StudioListingDetailSnapshot) {
  return (
    detail.buildingName ??
    detail.neighborhood ??
    findSourceFactValue(detail.sourceFacts, /building/i) ??
    detail.locationLine
      ?.split("·")
      .map((entry) => entry.trim())
      .find(Boolean) ??
    (detail.sourceSite === "streeteasy" ? "StreetEasy" : "Zillow")
  );
}

function getListingStateLabel(detail: StudioListingDetailSnapshot) {
  if (detail.listingType) {
    if (/rent/i.test(detail.listingType)) {
      return "For rent";
    }
    if (/sale/i.test(detail.listingType)) {
      return "For sale";
    }
  }

  return detail.statusLabel ?? "Saved listing";
}

function buildMapEmbedUrl(detail: StudioListingDetailSnapshot) {
  if (detail.latitude !== null && detail.longitude !== null) {
    return `https://www.google.com/maps?q=${detail.latitude},${detail.longitude}&z=16&output=embed`;
  }

  const query = [detail.addressLine, detail.locationLine].filter(Boolean).join(", ").trim();
  if (!query) {
    return null;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

function collectFinancialHighlights(detail: StudioListingDetailSnapshot) {
  const candidates = [...detail.facts, ...detail.sourceFacts];
  const values = new Map<string, string>();

  for (const item of candidates) {
    const normalizedLabel = item.label.toLowerCase();

    let nextLabel: string | null = null;
    if (/common charges|hoa|maintenance/.test(normalizedLabel)) {
      nextLabel = /hoa/.test(normalizedLabel) ? "HOA" : "Common charges";
    } else if (/tax/.test(normalizedLabel)) {
      nextLabel = "Taxes";
    }

    if (!nextLabel) {
      continue;
    }

    const key = nextLabel.toLowerCase();
    if (values.has(key)) {
      continue;
    }

    values.set(key, item.value);
  }

  return [
    {
      label: "HOA",
      value: formatFinancialHighlightValue(values.get("hoa") ?? values.get("common charges") ?? ""),
    },
    {
      label: "Taxes",
      value: formatFinancialHighlightValue(values.get("taxes") ?? ""),
    },
  ];
}

function formatFinancialHighlightValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "—";
  }

  if (/\$\s*[\d,.]+.*\/mo/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, " ").trim();
  }

  const numericMatch = trimmed.match(/-?[\d,.]+/);
  if (numericMatch?.[0]) {
    return `$${numericMatch[0]}/mo`;
  }

  return trimmed;
}

function extractTransitDistanceKilometers(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const kilometerMatch = normalized.match(/([0-9.]+)\s*km/i);
  if (kilometerMatch?.[1]) {
    const kilometers = Number(kilometerMatch[1]);
    return Number.isFinite(kilometers) ? kilometers : null;
  }

  const mileMatch = normalized.match(/([0-9.]+)\s*(?:mi|miles?)\b/i);
  if (mileMatch?.[1]) {
    const miles = Number(mileMatch[1]);
    return Number.isFinite(miles) ? miles * 1.60934 : null;
  }

  const meterMatch = normalized.match(/([0-9.]+)\s*(?:meters?|m)\b/i);
  if (meterMatch?.[1]) {
    const meters = Number(meterMatch[1]);
    return Number.isFinite(meters) ? meters / 1000 : null;
  }

  return null;
}

function parseTransitSummary(
  transit: TransitItem[],
): TransitSummary {
  let nearestWalkMinutes: number | null = null;
  let withinFiveHundredMeters = 0;
  let foundDistance = false;

  for (const item of transit) {
    const haystack = [item.detail, item.distanceLabel, item.label].filter(Boolean).join(" ");
    const walkMatch = haystack.match(/(\d+)\s*min(?:ute)?(?:s)?\s*walk/i);
    const kilometers = extractTransitDistanceKilometers(haystack);

    if (walkMatch) {
      const minutes = Number(walkMatch[1]);
      if (Number.isFinite(minutes)) {
        nearestWalkMinutes =
        nearestWalkMinutes === null ? minutes : Math.min(nearestWalkMinutes, minutes);
      }
    }

    if (kilometers !== null) {
      foundDistance = true;
      if (kilometers <= 0.5) {
        withinFiveHundredMeters += 1;
      }
    }
  }

  return {
    nearestWalkMinutes,
    withinFiveHundredMeters: foundDistance ? withinFiveHundredMeters : null,
  };
}

function parseFallbackTransitItem(value: string): TransitItem | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/\s+/g, " ").trim();
  const parts = compact.split("·").map((part) => part.trim()).filter(Boolean);
  const labelCandidate =
    parts[0]?.replace(/\s+[0-9.]+\s*(?:km|mi|miles?|meters?|m)\b.*$/i, "").trim() ?? compact;
  const label = labelCandidate || compact;
  const minutesMatch = compact.match(/(\d+)\s*min(?:ute)?(?:s)?(?:\s*walk)?/i);
  const distanceMatch = compact.match(/([0-9.]+\s*(?:km|mi|miles?|meters?|m))/i);
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

function resolveAvailabilityValue(detail: StudioListingDetailSnapshot) {
  const candidates = [
    detail.availabilityLabel,
    findSourceFactValue(detail.sourceFacts, /availability|available|move[- ]?in|occupancy/i),
    ...detail.capturedSections
      .filter((section) => /availability|move[- ]?in|occupancy/i.test(section.title))
      .flatMap((section) => section.items),
  ]
    .map((value) => value?.trim() || "")
    .filter(Boolean);

  const best = candidates.sort((left, right) => right.length - left.length)[0] ?? "";
  if (!best) {
    return null;
  }

  const normalized = best.replace(/^availability[:\s-]*/i, "").trim();
  if (!normalized) {
    return null;
  }

  const yearFirstDateMatch = normalized.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (yearFirstDateMatch) {
    const [, year, month, day] = yearFirstDateMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) {
      return `Available ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
  }

  const monthFirstDateMatch = normalized.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (monthFirstDateMatch) {
    const [, month, day] = monthFirstDateMatch;
    const parsed = new Date(2026, Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) {
      return `Available ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
  }

  if (/^(available|available now)$/i.test(normalized)) {
    return "Available";
  }

  return /^available/i.test(normalized) ? normalized : `Available ${normalized}`;
}

function resolveSqftValue(detail: StudioListingDetailSnapshot) {
  if (detail.sqft !== null) {
    return new Intl.NumberFormat("en-US").format(detail.sqft);
  }

  const rawSqftValue =
    findSourceFactValue(detail.sourceFacts, /sqft|square feet|square foot/i) ??
    findSourceFactValue(detail.facts, /sqft|square feet|square foot/i) ??
    detail.capturedSections
      .flatMap((section) => section.items)
      .find((item) => /sq\.?\s*ft|sqft|square feet|square foot/i.test(item)) ??
    null;

  if (!rawSqftValue) {
    return null;
  }

  const sqftMatch = rawSqftValue.match(/([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square feet|square foot)?/i);
  if (!sqftMatch?.[1]) {
    return rawSqftValue;
  }

  const normalized = Number(sqftMatch[1].replace(/,/g, ""));
  return Number.isFinite(normalized)
    ? new Intl.NumberFormat("en-US").format(normalized)
    : rawSqftValue;
}

function buildPrimaryFactCards(detail: StudioListingDetailSnapshot): PrimaryFactCard[] {
  const sqftValue = resolveSqftValue(detail);
  const availabilityValue = resolveAvailabilityValue(detail);

  return [
    {
      label: "Bedrooms",
      value: detail.bedrooms !== null ? String(detail.bedrooms) : "—",
    },
    {
      label: "Bathrooms",
      value: detail.bathrooms !== null ? String(detail.bathrooms) : "—",
    },
    {
      label: "Sqft",
      value: sqftValue || "—",
    },
    {
      accent: availabilityValue ? "success" : undefined,
      label: "Availability",
      value: availabilityValue || "—",
    },
  ];
}

function renderPrimaryFactIcon(label: string) {
  if (/bed/i.test(label)) {
    return <IconFactBedrooms />;
  }

  if (/bath/i.test(label)) {
    return <IconFactBathrooms />;
  }

  if (/sqft|square/i.test(label)) {
    return <IconFactSqft />;
  }

  return <IconFactAvailability />;
}

function ListingStudioDisclosure(props: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <details className="listing-studio-disclosure-card">
      <summary className="listing-studio-disclosure-summary">
        <div>
          <strong>{props.title}</strong>
          <span>{props.description}</span>
        </div>
        <span className="listing-studio-disclosure-toggle">Expand</span>
      </summary>
      <div className="listing-studio-disclosure-body">{props.children}</div>
    </details>
  );
}

function normalizeAmenityKey(value: string) {
  return formatAmenityLabel(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatAmenityLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const fixups: Record<string, string> = {
    centralair: "Central Air",
    dishwasher: "Dishwasher",
    washerdryer: "Washer / dryer",
    bikeroom: "Bike Room",
    packageroom: "Package Room",
    laundryinbuilding: "Laundry in Building",
    parkinggarage: "Parking Garage",
    storagespace: "Storage space",
    viewgarden: "View / Garden",
    servicesandfacilities: "Services & Facilities",
    wheelchairaccess: "Wheelchair Access",
    smokefree: "Smoke-free",
    keylessentry: "Keyless Entry",
    liveinsuper: "Live-in Super",
  };

  if (fixups[normalized]) {
    return fixups[normalized];
  }

  return trimmed
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .replace(/\bHoa\b/g, "HOA")
    .replace(/\bNy\b/g, "NY")
    .replace(/\bAnd\b/g, "&");
}

function normalizeDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  const match = value.trim().match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) {
    return "";
  }

  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function formatSourceFactDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/-/g, "/");
}

function formatNumericInput(value: number | null) {
  return value === null ? "" : String(value);
}

function buildEditorDescription(detail: StudioListingDetailSnapshot) {
  if (detail.descriptionText?.trim()) {
    return detail.descriptionText.trim();
  }

  const addressDescription = [
    detail.streetAddress?.trim(),
    [detail.city?.trim(), detail.state?.trim(), detail.postalCode?.trim()]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ")
    .trim();

  if (addressDescription) {
    return addressDescription;
  }

  return detail.pack.summary?.trim() ?? "";
}

function parseNumberishInput(value: string) {
  const normalized = value.replace(/[^0-9.-]+/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWholeNumberInput(value: string) {
  const parsed = parseNumberishInput(value);
  return parsed === null ? null : Math.round(parsed);
}

function buildAmenityEditorSections(
  amenities: StudioListingDetailSnapshot["amenities"],
): EditorAmenitySection[] {
  const sections = AMENITY_CATALOG.map((section) => ({
    title: section.title,
    options: section.options,
    selected: [] as string[],
    customItems: [] as string[],
    draftCustom: "",
    isAddingCustom: false,
    open: false,
  }));
  const sectionMap = new Map(sections.map((section) => [section.title, section]));
  const sectionByKey = new Map(
    sections.map((section) => [normalizeAmenityKey(section.title), section.title]),
  );
  const optionSectionMap = new Map<string, string>();
  const optionValueMap = new Map<string, string>();

  for (const section of sections) {
    for (const option of section.options) {
      const key = normalizeAmenityKey(option);
      optionSectionMap.set(key, section.title);
      optionValueMap.set(key, option);
    }
  }

  for (const amenitySection of amenities) {
    const preferredSectionTitle =
      sectionByKey.get(normalizeAmenityKey(amenitySection.title)) ?? sections[0]?.title ?? "";

    for (const item of amenitySection.items) {
      const formatted = formatAmenityLabel(item);
      if (!formatted) {
        continue;
      }

      const optionKey = normalizeAmenityKey(formatted);
      const matchedSectionTitle = optionSectionMap.get(optionKey);
      if (matchedSectionTitle) {
        const target = sectionMap.get(matchedSectionTitle);
        const optionValue = optionValueMap.get(optionKey) ?? formatted;
        if (target && !target.selected.includes(optionValue)) {
          target.selected.push(optionValue);
        }
        continue;
      }

      const target = sectionMap.get(preferredSectionTitle) ?? sections[0];
      if (target && !target.customItems.includes(formatted)) {
        target.customItems.push(formatted);
      }
    }
  }

  return sections;
}

function buildDisplayAmenitySections(
  amenities: StudioListingDetailSnapshot["amenities"],
): DisplayAmenitySection[] {
  const baseSections = AMENITY_CATALOG.map((section) => ({
    items: [] as string[],
    title: section.title,
  }));
  const sectionMap = new Map(baseSections.map((section) => [section.title, section]));
  const sectionByKey = new Map(
    baseSections.map((section) => [normalizeAmenityKey(section.title), section.title]),
  );
  const optionSectionMap = new Map<string, string>();
  const optionValueMap = new Map<string, string>();

  for (const section of AMENITY_CATALOG) {
    for (const option of section.options) {
      const key = normalizeAmenityKey(option);
      optionSectionMap.set(key, section.title);
      optionValueMap.set(key, option);
    }
  }

  const extraSections = new Map<string, DisplayAmenitySection>();

  for (const amenitySection of amenities) {
    const normalizedSectionKey = normalizeAmenityKey(amenitySection.title);
    const preferredSectionTitle =
      sectionByKey.get(normalizedSectionKey) ?? formatAmenityLabel(amenitySection.title);

    for (const item of amenitySection.items) {
      const formatted = formatAmenityLabel(item);
      if (!formatted) {
        continue;
      }

      const optionKey = normalizeAmenityKey(formatted);
      const matchedSectionTitle = optionSectionMap.get(optionKey);
      const normalizedValue = optionValueMap.get(optionKey) ?? formatted;

      if (matchedSectionTitle) {
        const matchedSection = sectionMap.get(matchedSectionTitle);
        if (matchedSection && !matchedSection.items.includes(normalizedValue)) {
          matchedSection.items.push(normalizedValue);
        }
        continue;
      }

      const knownSection = sectionMap.get(preferredSectionTitle);
      if (knownSection) {
        if (!knownSection.items.includes(normalizedValue)) {
          knownSection.items.push(normalizedValue);
        }
        continue;
      }

      const nextExtraSection =
        extraSections.get(preferredSectionTitle) ??
        {
          items: [],
          title: preferredSectionTitle,
        };

      if (!nextExtraSection.items.includes(normalizedValue)) {
        nextExtraSection.items.push(normalizedValue);
      }
      extraSections.set(preferredSectionTitle, nextExtraSection);
    }
  }

  return [
    ...baseSections.filter((section) => section.items.length),
    ...Array.from(extraSections.values()).filter((section) => section.items.length),
  ];
}

function buildDisplayTransit(detail: StudioListingDetailSnapshot): TransitItem[] {
  if (detail.transit.length) {
    return detail.transit;
  }

  const fallbackItems = [
    ...detail.capturedSections
      .filter((section) => /transit|transportation|subway|station/i.test(section.title))
      .flatMap((section) => section.items),
    ...detail.sourceFacts
      .filter((fact) => /transit|transportation|subway|station/i.test(fact.label))
      .map((fact) => `${fact.label}: ${fact.value}`),
  ]
    .map((item) => parseFallbackTransitItem(item))
    .filter((item): item is TransitItem => Boolean(item));

  const seen = new Set<string>();
  return fallbackItems.filter((item) => {
    const key = `${item.label.toLowerCase()}::${item.distanceLabel ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildAmenityPayload(sections: EditorAmenitySection[]) {
  return sections
    .map((section) => ({
      title: section.title,
      items: Array.from(
        new Set(
          [...section.selected, ...section.customItems]
            .map((item) => formatAmenityLabel(item))
            .filter(Boolean),
        ),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function buildEditorState(detail: StudioListingDetailSnapshot): ListingEditorState {
  const photoAssetIds = detail.assets
    .filter((asset) => isPhotoAssetKind(asset.kind))
    .map((asset) => asset.id);

  return {
    listingKind: /sale/i.test(detail.listingType ?? "") ? "sale" : "rental",
    selectedAssetIds: photoAssetIds,
    coverAssetId:
      (detail.pack.coverAssetId && photoAssetIds.includes(detail.pack.coverAssetId)
        ? detail.pack.coverAssetId
        : null) ??
      photoAssetIds[0] ??
      null,
    streetAddress: detail.streetAddress ?? "",
    city: detail.city ?? "",
    state: detail.state ?? "",
    postalCode: detail.postalCode ?? "",
    unit: detail.unit ?? "",
    neighborhood: detail.neighborhood ?? "",
    buildingName: detail.buildingName ?? "",
    listingUrl: detail.sourceUrl ?? "",
    price: formatNumericInput(detail.price),
    beds: formatNumericInput(detail.bedrooms),
    baths: formatNumericInput(detail.bathrooms),
    sqft: formatNumericInput(detail.sqft),
    propertyType: findSourceFactValue(detail.sourceFacts, /property type/i) ?? "",
    status: detail.statusLabel ?? "Active",
    availability: detail.availabilityLabel ?? "",
    yearBuilt: findSourceFactValue(detail.sourceFacts, /year built/i) ?? "",
    listDate: normalizeDateInput(
      findSourceFactValue(detail.sourceFacts, /(list|listed) date/i),
    ),
    commonCharges:
      findSourceFactValue(detail.sourceFacts, /common charges|hoa|maintenance/i) ?? "",
    taxes: findSourceFactValue(detail.sourceFacts, /tax/i) ?? "",
    description: buildEditorDescription(detail),
    amenitySections: buildAmenityEditorSections(detail.amenities),
  };
}

function buildEditedAddressTitle(editorState: ListingEditorState) {
  const lineOne = [editorState.streetAddress.trim(), editorState.unit.trim()]
    .filter(Boolean)
    .join(" ");
  const lineTwo = [editorState.city.trim(), editorState.state.trim(), editorState.postalCode.trim()]
    .filter(Boolean)
    .join(", ");

  return lineOne || lineTwo || "Imported listing";
}

function buildEditedSourceFacts(
  editorState: ListingEditorState,
  existingFacts: StudioListingDetailSnapshot["sourceFacts"],
) {
  const editablePatterns = [
    /property type/i,
    /year built/i,
    /(list|listed) date/i,
    /common charges|hoa|maintenance/i,
    /tax/i,
  ];
  const preservedFacts = existingFacts.filter(
    (fact) => !editablePatterns.some((matcher) => matcher.test(fact.label)),
  );
  const editedFacts = [
    editorState.propertyType
      ? { label: "Property type", value: editorState.propertyType.trim() }
      : null,
    editorState.yearBuilt ? { label: "Year built", value: editorState.yearBuilt.trim() } : null,
    editorState.listDate
      ? { label: "List date", value: formatSourceFactDate(editorState.listDate) }
      : null,
    editorState.commonCharges
      ? {
          label:
            editorState.listingKind === "sale"
              ? "Common charges (HOA, /mo)"
              : "Common charges",
          value: editorState.commonCharges.trim(),
        }
      : null,
    editorState.taxes ? { label: "Taxes (/mo)", value: editorState.taxes.trim() } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));

  return [...preservedFacts, ...editedFacts];
}

function openExternalWindow(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function StageActionButton(props: {
  ariaLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      aria-label={props.ariaLabel}
      className="listing-studio-view-stage-action"
      disabled={props.disabled}
      onClick={props.onClick}
      type={props.type ?? "button"}
    >
      {props.children}
    </button>
  );
}

export function ListingStudioDetailClient({ detail }: ListingStudioDetailClientProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [detailState, setDetailState] = useState(detail);
  const [mediaMode, setMediaMode] = useState<MediaMode>(() => getInitialMediaMode(detail));
  const [activePhotoId, setActivePhotoId] = useState<string | null>(() =>
    getInitialPhotoId(detail),
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isUploadingAssets, setIsUploadingAssets] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorState, setEditorState] = useState(() => buildEditorState(detail));
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const [isAddressCopied, setIsAddressCopied] = useState(false);

  const shareUrl = buildShareUrl(detailState.pack.shareCode);
  const photoAssets = useMemo(
    () => detailState.assets.filter((asset) => isPhotoAssetKind(asset.kind)),
    [detailState.assets],
  );
  const activePhoto =
    photoAssets.find((asset) => asset.id === activePhotoId) ?? photoAssets[0] ?? null;
  const floorPlanAsset =
    detailState.assets.find((asset) => asset.kind === "floor_plan") ?? null;
  const floorPlanSrc =
    (floorPlanAsset ? `/api/listing-studio/assets/${floorPlanAsset.id}` : null) ??
    (detailState.floorPlans[0]?.assetId
      ? `/api/listing-studio/assets/${detailState.floorPlans[0].assetId}`
      : null) ??
    detailState.floorPlans[0]?.url ??
    null;
  const floorPlanIsPdf = isLikelyPdf(floorPlanSrc, floorPlanAsset?.mimeType ?? null);
  const floorPlanLabel =
    floorPlanAsset?.label ?? detailState.floorPlans[0]?.label ?? "Floor plan";
  const mapEmbedUrl = useMemo(() => buildMapEmbedUrl(detailState), [detailState]);
  const statusPill = getListingStateLabel(detailState);
  const headerEyebrow = getHeaderEyebrow(detailState);
  const primaryFactCards = useMemo(() => buildPrimaryFactCards(detailState), [detailState]);
  const displayAmenitySections = useMemo(
    () => buildDisplayAmenitySections(detailState.amenities),
    [detailState.amenities],
  );
  const displayTransit = useMemo(() => buildDisplayTransit(detailState), [detailState]);
  const financialHighlights = useMemo(
    () => collectFinancialHighlights(detailState),
    [detailState],
  );
  const transitSummary = useMemo(
    () => parseTransitSummary(displayTransit),
    [displayTransit],
  );
  const visibleTransit = useMemo(() => displayTransit.slice(0, 3), [displayTransit]);
  const hiddenTransitWithinOneKilometer = useMemo(() => {
    const countWithinOneKilometer = (items: TransitItem[]) =>
      items.reduce((count, item) => {
        const haystack = [item.detail, item.distanceLabel, item.label].filter(Boolean).join(" ");
        const kilometers = extractTransitDistanceKilometers(haystack);
        if (kilometers === null) {
          return count;
        }

        return kilometers <= 1 ? count + 1 : count;
      }, 0);

    return Math.max(
      countWithinOneKilometer(displayTransit) - countWithinOneKilometer(visibleTransit),
      0,
    );
  }, [displayTransit, visibleTransit]);
  const activePhotoIndex = activePhoto
    ? Math.max(
        0,
        photoAssets.findIndex((asset) => asset.id === activePhoto.id),
      ) + 1
    : 0;
  useEffect(() => {
    if (!statusMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setStatusMessage(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    if (!isAddressCopied) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setIsAddressCopied(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [isAddressCopied]);

  useEffect(() => {
    if (!activePhoto || photoAssets.length < 2) {
      return;
    }

    const index = photoAssets.findIndex((asset) => asset.id === activePhoto.id);
    if (index === -1) {
      return;
    }

    const nextAsset = photoAssets[(index + 1) % photoAssets.length];
    const prevAsset =
      photoAssets[(index - 1 + photoAssets.length) % photoAssets.length];

    if (nextAsset) {
      preloadAssetImage(nextAsset.id);
    }
    if (prevAsset && prevAsset.id !== nextAsset?.id) {
      preloadAssetImage(prevAsset.id);
    }
  }, [activePhoto?.id, photoAssets]);

  function openEditor() {
    setEditorState(buildEditorState(detailState));
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (isSaving) {
      return;
    }

    setEditorState(buildEditorState(detailState));
    setIsEditorOpen(false);
  }

  function updateEditorField<Key extends keyof ListingEditorState>(
    key: Key,
    value: ListingEditorState[Key],
  ) {
    setEditorState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateAmenitySection(
    sectionTitle: string,
    updater: (section: EditorAmenitySection) => EditorAmenitySection,
  ) {
    setEditorState((current) => ({
      ...current,
      amenitySections: current.amenitySections.map((section) =>
        section.title === sectionTitle ? updater(section) : section,
      ),
    }));
  }

  function syncEditorPhotos(nextDetail: StudioListingDetailSnapshot) {
    const nextPhotoAssetIds = nextDetail.assets
      .filter((asset) => isPhotoAssetKind(asset.kind))
      .map((asset) => asset.id);

    setEditorState((current) => ({
      ...current,
      selectedAssetIds: nextPhotoAssetIds,
      coverAssetId:
        current.coverAssetId && nextPhotoAssetIds.includes(current.coverAssetId)
          ? current.coverAssetId
          : nextDetail.pack.coverAssetId && nextPhotoAssetIds.includes(nextDetail.pack.coverAssetId)
            ? nextDetail.pack.coverAssetId
            : nextPhotoAssetIds[0] ?? null,
    }));
  }

  function toggleAmenityOpen(sectionTitle: string) {
    updateAmenitySection(sectionTitle, (section) => ({
      ...section,
      open: !section.open,
    }));
  }

  function toggleAmenityOption(sectionTitle: string, option: string) {
    updateAmenitySection(sectionTitle, (section) => ({
      ...section,
      selected: section.selected.includes(option)
        ? section.selected.filter((item) => item !== option)
        : [...section.selected, option],
    }));
  }

  function updateAmenityDraft(sectionTitle: string, value: string) {
    updateAmenitySection(sectionTitle, (section) => ({
      ...section,
      draftCustom: value,
    }));
  }

  function toggleAddCustom(sectionTitle: string, nextValue?: boolean) {
    updateAmenitySection(sectionTitle, (section) => ({
      ...section,
      isAddingCustom: typeof nextValue === "boolean" ? nextValue : !section.isAddingCustom,
      draftCustom:
        typeof nextValue === "boolean" && nextValue === false ? "" : section.draftCustom,
    }));
  }

  function addCustomAmenity(sectionTitle: string) {
    updateAmenitySection(sectionTitle, (section) => {
      const nextValue = formatAmenityLabel(section.draftCustom);
      if (!nextValue || section.customItems.includes(nextValue)) {
        return {
          ...section,
          draftCustom: "",
          isAddingCustom: false,
        };
      }

      return {
        ...section,
        customItems: [...section.customItems, nextValue],
        draftCustom: "",
        isAddingCustom: false,
      };
    });
  }

  function removeCustomAmenity(sectionTitle: string, amenity: string) {
    updateAmenitySection(sectionTitle, (section) => ({
      ...section,
      customItems: section.customItems.filter((item) => item !== amenity),
    }));
  }

  function handleSelectPhoto(assetId: string) {
    setMediaMode("photo");
    setActivePhotoId(assetId);

    const index = photoAssets.findIndex((asset) => asset.id === assetId);
    if (index !== -1 && photoAssets.length > 1) {
      const nextAsset = photoAssets[(index + 1) % photoAssets.length];
      const prevAsset =
        photoAssets[(index - 1 + photoAssets.length) % photoAssets.length];

      if (nextAsset) {
        preloadAssetImage(nextAsset.id);
      }
      if (prevAsset && prevAsset.id !== nextAsset?.id) {
        preloadAssetImage(prevAsset.id);
      }
    }
  }

  function handleCyclePhoto(direction: -1 | 1) {
    if (!photoAssets.length) {
      return;
    }

    const currentIndex = activePhoto
      ? photoAssets.findIndex((asset) => asset.id === activePhoto.id)
      : 0;
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + photoAssets.length) % photoAssets.length;
    const nextAsset = photoAssets[nextIndex];
    if (nextAsset) {
      handleSelectPhoto(nextAsset.id);
    }
  }

  async function copyAddressLine() {
    const nextCopyValue = [detailState.addressLine, detailState.locationLine]
      .filter(Boolean)
      .join(", ")
      .trim();

    if (!nextCopyValue) {
      return;
    }

    try {
      await navigator.clipboard.writeText(nextCopyValue);
      setIsAddressCopied(true);
      setStatusMessage("Address copied.");
    } catch {
      setStatusMessage("Unable to copy the address.");
    }
  }

  function setEditorCoverPhoto(assetId: string) {
    setEditorState((current) => ({
      ...current,
      coverAssetId: assetId,
      selectedAssetIds: current.selectedAssetIds.includes(assetId)
        ? current.selectedAssetIds
        : [...current.selectedAssetIds, assetId],
    }));
  }

  async function uploadEditorAssets(files: FileList | File[]) {
    const nextFiles = Array.from(files).filter((file) => file.size > 0);
    if (!nextFiles.length || isUploadingAssets) {
      return;
    }

    setIsUploadingAssets(true);
    setStatusMessage("");

    try {
      const formData = new FormData();
      for (const file of nextFiles) {
        formData.append("files", file);
      }

      const response = await fetch(`/api/listing-studio/listings/${detailState.packId}/assets`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Unable to upload media.");
      }

      const nextDetail = (await response.json()) as StudioListingDetailSnapshot;
      syncDetailState(nextDetail);
      syncEditorPhotos(nextDetail);
      setStatusMessage("Media uploaded.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to upload media.");
    } finally {
      setIsUploadingAssets(false);
      setIsDropzoneActive(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }

  async function deleteEditorAsset(assetId: string) {
    if (deletingAssetId) {
      return;
    }

    setDeletingAssetId(assetId);
    setStatusMessage("");

    try {
      const response = await fetch(
        `/api/listing-studio/listings/${detailState.packId}/assets/${assetId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Unable to delete media.");
      }

      const nextDetail = (await response.json()) as StudioListingDetailSnapshot;
      syncDetailState(nextDetail);
      syncEditorPhotos(nextDetail);
      setStatusMessage("Media removed.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to delete media.");
    } finally {
      setDeletingAssetId(null);
    }
  }

  function syncDetailState(nextDetail: StudioListingDetailSnapshot) {
    setDetailState(nextDetail);
    setActivePhotoId((current) => {
      if (current && nextDetail.assets.some((asset) => asset.id === current)) {
        return current;
      }

      return getInitialPhotoId(nextDetail);
    });
    setMediaMode((current) => {
      if (current === "floorplan" && !nextDetail.floorPlans.length) {
        return getInitialMediaMode(nextDetail);
      }
      if (current === "map" && nextDetail.latitude === null && nextDetail.longitude === null && !nextDetail.addressLine) {
        return getInitialMediaMode(nextDetail);
      }
      return current;
    });
  }

  async function savePack(options?: { closeEditor?: boolean }) {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const nextTitle = buildEditedAddressTitle(editorState);
      const nextSelectedAssetIds =
        editorState.selectedAssetIds.length > 0
          ? editorState.selectedAssetIds
          : photoAssets[0]
            ? [photoAssets[0].id]
            : [];
      const response = await fetch(`/api/listing-studio/listings/${detailState.packId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: nextTitle,
          headline: nextTitle,
          summary: editorState.description.trim(),
          selectedAssetIds: nextSelectedAssetIds,
          coverAssetId: editorState.coverAssetId ?? nextSelectedAssetIds[0] ?? null,
          sourceUrl: editorState.listingUrl.trim() || detailState.sourceUrl,
          listingType: editorState.listingKind === "sale" ? "Sale" : "Rental",
          statusLabel: editorState.status.trim() || null,
          price: parseNumberishInput(editorState.price),
          streetAddress: editorState.streetAddress.trim() || null,
          unit: editorState.unit.trim() || null,
          city: editorState.city.trim() || null,
          state: editorState.state.trim() || null,
          postalCode: editorState.postalCode.trim() || null,
          neighborhood: editorState.neighborhood.trim() || null,
          buildingName: editorState.buildingName.trim() || null,
          bedrooms: parseNumberishInput(editorState.beds),
          bathrooms: parseNumberishInput(editorState.baths),
          sqft: parseWholeNumberInput(editorState.sqft),
          availabilityLabel: editorState.availability.trim() || null,
          descriptionText: editorState.description.trim() || null,
          amenities: buildAmenityPayload(editorState.amenitySections),
          sourceFacts: buildEditedSourceFacts(editorState, detailState.sourceFacts),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Unable to save the listing.");
      }

      const nextDetail = (await response.json()) as StudioListingDetailSnapshot;
      syncDetailState(nextDetail);
      setEditorState(buildEditorState(nextDetail));
      setStatusMessage("Listing changes saved.");

      if (options?.closeEditor) {
        setIsEditorOpen(false);
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to save the listing.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function openSharePage() {
    setIsSharing(true);
    setStatusMessage("");

    try {
      let nextShareUrl = shareUrl;

      if (!nextShareUrl) {
        const response = await fetch(
          `/api/listing-studio/listings/${detailState.packId}/share`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Unable to publish the share link.");
        }

        const body = (await response.json()) as { shareCode: string };
        nextShareUrl = buildShareUrl(body.shareCode);
        setDetailState((current) => ({
          ...current,
          pack: {
            ...current.pack,
            shareEnabled: true,
            shareCode: body.shareCode,
          },
        }));
      }

      if (nextShareUrl) {
        openExternalWindow(
          nextShareUrl.startsWith("http")
            ? nextShareUrl
            : `${window.location.origin}${nextShareUrl}`,
        );
      }

      setStatusMessage("Share page is ready.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to open the share page.",
      );
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <>
      <div className="listing-studio-listed-shell">
        <div className="listing-studio-listed-frame">
          <div className="listing-studio-listed-main">
            <div className="listing-studio-view-page">
              <header className="listing-studio-view-header">
                <div className="listing-studio-view-header-copy">
                  <span className="listing-studio-view-eyebrow">{headerEyebrow}</span>
                  <h1>{detailState.addressLine}</h1>
                  {detailState.locationLine ? <p>{detailState.locationLine}</p> : null}
                </div>
              </header>

              {statusMessage ? <p className="listing-studio-view-feedback">{statusMessage}</p> : null}

              <section className="listing-studio-view-stage-card">
          <div className="listing-studio-view-stage">
            <span className="listing-studio-view-status-pill">{statusPill}</span>

            <div className="listing-studio-view-stage-actions">
              <StudioCollectionPicker
                className="listing-studio-view-stage-collections"
                packId={detailState.packId}
                variant="icon"
              />

              <StageActionButton
                ariaLabel="Open share page"
                disabled={isSharing}
                onClick={() => void openSharePage()}
              >
                <IconShare />
              </StageActionButton>
              <StageActionButton
                ariaLabel="Open original listing"
                onClick={() => openExternalWindow(detailState.sourceUrl)}
              >
                <IconLink />
              </StageActionButton>
              <StageActionButton ariaLabel="Edit listing" onClick={openEditor}>
                <IconEdit />
              </StageActionButton>
            </div>

            {mediaMode === "map" && mapEmbedUrl ? (
              <iframe
                allowFullScreen
                className="listing-studio-view-stage-frame"
                loading="lazy"
                src={mapEmbedUrl}
                title={`${detailState.addressLine} map`}
              />
            ) : mediaMode === "floorplan" && floorPlanSrc ? (
              floorPlanIsPdf ? (
                <iframe
                  allowFullScreen
                  className="listing-studio-view-stage-frame"
                  loading="lazy"
                  src={floorPlanSrc}
                  title={floorPlanLabel}
                />
              ) : (
                <img
                  alt={floorPlanLabel}
                  className="listing-studio-view-stage-image is-contained"
                  src={floorPlanSrc}
                />
              )
            ) : activePhoto ? (
              <>
                {photoAssets.length > 1 ? (
                  <>
                    <button
                      aria-label="Previous photo"
                      className="listing-studio-view-stage-nav listing-studio-view-stage-nav--prev"
                      onClick={() => handleCyclePhoto(-1)}
                      type="button"
                    >
                      <IconArrowLeft />
                    </button>
                    <button
                      aria-label="Next photo"
                      className="listing-studio-view-stage-nav listing-studio-view-stage-nav--next"
                      onClick={() => handleCyclePhoto(1)}
                      type="button"
                    >
                      <IconArrowRight />
                    </button>
                  </>
                ) : null}

                <img
                  alt={activePhoto.label ?? detailState.title}
                  className="listing-studio-view-stage-image"
                  decoding="async"
                  fetchPriority="high"
                  src={`/api/listing-studio/assets/${activePhoto.id}`}
                />
              </>
            ) : (
              <div className="listing-studio-view-stage-empty">
                No media was captured for this listing yet.
              </div>
            )}

            {mediaMode === "photo" && activePhoto && photoAssets.length ? (
              <span className="listing-studio-view-stage-count">
                {activePhotoIndex}/{photoAssets.length}
              </span>
            ) : null}
          </div>

          <div className="listing-studio-view-stage-rail">
            <div className="listing-studio-view-thumbnail-row">
              {photoAssets.map((asset) => (
                <button
                  className={`listing-studio-view-thumbnail${mediaMode === "photo" && activePhoto?.id === asset.id ? " is-active" : ""}`}
                  key={asset.id}
                  onClick={() => handleSelectPhoto(asset.id)}
                  type="button"
                >
                  <img
                    alt={asset.label ?? detailState.title}
                    decoding="async"
                    loading="lazy"
                    src={`/api/listing-studio/assets/${asset.id}`}
                  />
                </button>
              ))}
            </div>

            <div className="listing-studio-view-mode-row">
              {floorPlanSrc ? (
                <button
                  className={`listing-studio-view-mode-button${mediaMode === "floorplan" ? " is-active" : ""}`}
                  onClick={() => setMediaMode("floorplan")}
                  type="button"
                >
                  Floor Plan
                </button>
              ) : null}
              {mapEmbedUrl ? (
                <button
                  className={`listing-studio-view-mode-button${mediaMode === "map" ? " is-active" : ""}`}
                  onClick={() => setMediaMode("map")}
                  type="button"
                >
                  Map
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="listing-studio-view-summary-card">
          <div className="listing-studio-view-price-block">
            <strong>{detailState.priceLabel}</strong>
            <span>{headerEyebrow}</span>
          </div>

          <div className="listing-studio-view-address-block">
            <strong>{detailState.addressLine}</strong>
            {detailState.locationLine ? (
              <div className="listing-studio-view-address-meta">
                <span>
                  <IconLocation />
                  <span>{detailState.locationLine}</span>
                </span>
                <button
                  aria-label={isAddressCopied ? "Address copied" : "Copy address"}
                  className={`listing-studio-view-address-copy${isAddressCopied ? " is-copied" : ""}`}
                  onClick={() => void copyAddressLine()}
                  type="button"
                >
                  <IconCopy />
                </button>
              </div>
            ) : null}
          </div>

          {primaryFactCards.length ? (
            <div className="listing-studio-view-facts-grid">
              {primaryFactCards.map((fact) => (
                <div
                  className={`listing-studio-view-fact-card${fact.accent === "success" ? " is-accent-success" : ""}`}
                  key={fact.label}
                >
                  <div className="listing-studio-view-fact-icon">
                    {renderPrimaryFactIcon(fact.label)}
                  </div>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          {financialHighlights.length ? (
            <div className="listing-studio-view-chip-row">
              {financialHighlights.map((item) => (
                <span className="listing-studio-view-chip" key={item.label}>
                  {item.label} {item.value}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {displayAmenitySections.length ? (
          <section className="listing-studio-view-info-card">
            <div className="listing-studio-view-section-head">
              <h2>Building amenities</h2>
            </div>
            <div className="listing-studio-view-amenities-sections">
              {displayAmenitySections.map((section) => (
                <div className="listing-studio-view-amenity-group" key={section.title}>
                  <strong>{section.title}</strong>
                  <ul className="listing-studio-view-amenity-list">
                    {section.items.map((item) => (
                      <li key={`${section.title}-${item}`}>{formatAmenityLabel(item)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {displayTransit.length ? (
          <section className="listing-studio-view-info-card">
            <div className="listing-studio-view-section-head">
              <div className="listing-studio-view-section-title">
                <IconTransit />
                <h2>Nearby Transit</h2>
              </div>
            </div>

            {transitSummary.nearestWalkMinutes !== null ||
            transitSummary.withinFiveHundredMeters !== null ? (
              <div className="listing-studio-view-transit-summary">
                {transitSummary.nearestWalkMinutes !== null ? (
                  <div className="listing-studio-view-transit-summary-card">
                    <span>Nearest station</span>
                    <strong>{transitSummary.nearestWalkMinutes} min walk</strong>
                  </div>
                ) : null}
                {transitSummary.withinFiveHundredMeters !== null ? (
                  <div className="listing-studio-view-transit-summary-card">
                    <span>Within 500m</span>
                    <strong>{transitSummary.withinFiveHundredMeters} stations</strong>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="listing-studio-view-transit-list">
              {visibleTransit.map((item) => (
                <div
                  className="listing-studio-view-transit-item"
                  key={`${item.label}-${item.distanceLabel ?? ""}`}
                >
                  <div className="listing-studio-view-transit-item-main">
                    <span className="listing-studio-view-transit-item-icon" aria-hidden="true">
                      <IconTransit />
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      {item.detail ? <span>{item.detail}</span> : null}
                    </div>
                  </div>
                  {item.distanceLabel ? <em>{item.distanceLabel}</em> : null}
                </div>
              ))}
            </div>
            {hiddenTransitWithinOneKilometer > 0 ? (
              <p className="listing-studio-view-transit-more">
                + {hiddenTransitWithinOneKilometer} more station
                {hiddenTransitWithinOneKilometer === 1 ? "" : "s"} within 1km
              </p>
            ) : null}
          </section>
        ) : null}

        {detailState.propertyHistory.length ? (
          <ListingStudioDisclosure description="" title="Property history">
            <div className="listing-studio-detail-section-list">
              {detailState.propertyHistory.map((section) => (
                <div className="listing-studio-detail-section-block" key={section.title}>
                  <strong>{section.title}</strong>
                  <div className="listing-studio-detail-section-items">
                    {section.items.map((item) => (
                      <span key={`${section.title}-${item}`}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ListingStudioDisclosure>
        ) : null}

        {detailState.capturedSections.length ? (
          <ListingStudioDisclosure description="" title="Additional details">
            <div className="listing-studio-detail-section-list">
              {detailState.capturedSections.map((section) => (
                <div className="listing-studio-detail-section-block" key={section.title}>
                  <strong>{section.title}</strong>
                  <div className="listing-studio-detail-section-items">
                    {section.items.map((item) => (
                      <span key={`${section.title}-${item}`}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ListingStudioDisclosure>
        ) : null}
            </div>
          </div>
        </div>
      </div>

      {isEditorOpen ? (
        <div className="listing-studio-editor-shell">
          <div className="listing-studio-editor-frame">
            <section
              aria-label="Edit listing"
              aria-modal="true"
              className="listing-studio-editor-surface"
              role="dialog"
            >
              <header className="listing-studio-editor-header">
                <button className="listing-studio-editor-back" onClick={closeEditor} type="button">
                  <IconArrowLeft />
                </button>
                <div className="listing-studio-editor-header-copy">
                  <strong>Edit Listing</strong>
                </div>
              </header>

              {statusMessage ? (
                <p className="listing-studio-editor-status">{statusMessage}</p>
              ) : null}

              <div className="listing-studio-editor-scroll">
                <section className="listing-studio-editor-section">
                <div className="listing-studio-editor-section-head">
                  <strong>Listing Type</strong>
                </div>
                <div className="listing-studio-editor-type-toggle">
                  <button
                    className={`listing-studio-editor-type-button${editorState.listingKind === "rental" ? " is-active" : ""}`}
                    onClick={() => updateEditorField("listingKind", "rental")}
                    type="button"
                  >
                    Rental
                  </button>
                  <button
                    className={`listing-studio-editor-type-button${editorState.listingKind === "sale" ? " is-active" : ""}`}
                    onClick={() => updateEditorField("listingKind", "sale")}
                    type="button"
                  >
                    Sale
                  </button>
                </div>
              </section>

              <section className="listing-studio-editor-section">
                <div className="listing-studio-editor-section-head">
                  <strong>Photos &amp; Videos</strong>
                  <span>{photoAssets.length} photos</span>
                </div>

                <div className="listing-studio-editor-photo-grid">
                  {photoAssets.map((asset) => {
                    const isCover = editorState.coverAssetId === asset.id;
                    const isDeletingAsset = deletingAssetId === asset.id;
                    const assetUrl = `/api/listing-studio/assets/${asset.id}`;

                    return (
                      <div
                        className={`listing-studio-editor-photo-card${isCover ? " is-cover" : ""}`}
                        key={asset.id}
                        onClick={() => setEditorCoverPhoto(asset.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setEditorCoverPhoto(asset.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="listing-studio-editor-photo-frame">
                          {isVideoAssetMime(asset.mimeType) ? (
                            <video muted playsInline preload="metadata" src={assetUrl} />
                          ) : (
                            <img alt={asset.label ?? detailState.title} src={assetUrl} />
                          )}
                          {isCover ? (
                            <span className="listing-studio-editor-photo-badge">Cover</span>
                          ) : null}
                          <button
                            aria-label={`Delete ${asset.label ?? "photo"}`}
                            className="listing-studio-editor-photo-remove"
                            disabled={isDeletingAsset}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void deleteEditorAsset(asset.id);
                            }}
                            type="button"
                          >
                            <IconClose />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <input
                  accept="image/*,video/*"
                  hidden
                  multiple
                  onChange={(event) => {
                    if (event.target.files?.length) {
                      void uploadEditorAssets(event.target.files);
                    }
                  }}
                  ref={uploadInputRef}
                  type="file"
                />
                <button
                  className={`listing-studio-editor-dropzone${isDropzoneActive ? " is-active" : ""}`}
                  onClick={() => uploadInputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDropzoneActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    const related = event.relatedTarget;
                    if (!(related instanceof Node) || !event.currentTarget.contains(related)) {
                      setIsDropzoneActive(false);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDropzoneActive(true);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDropzoneActive(false);
                    if (event.dataTransfer.files?.length) {
                      void uploadEditorAssets(event.dataTransfer.files);
                    }
                  }}
                  type="button"
                >
                  <span className="listing-studio-editor-dropzone-copy">
                    <IconUpload />
                    <span>
                      {isUploadingAssets
                        ? "Uploading media..."
                        : "Drop files or click to upload"}
                    </span>
                  </span>
                </button>
              </section>

              <section className="listing-studio-editor-section">
                <div className="listing-studio-editor-section-head">
                  <strong>Address</strong>
                </div>
                <div className="listing-studio-editor-grid">
                  <label className="listing-studio-editor-field is-span-3">
                    <span>Street Address</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("streetAddress", event.target.value)}
                      value={editorState.streetAddress}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>City</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("city", event.target.value)}
                      value={editorState.city}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>State</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("state", event.target.value)}
                      value={editorState.state}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>ZIP</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("postalCode", event.target.value)}
                      value={editorState.postalCode}
                    />
                  </label>
                </div>
              </section>

              <section className="listing-studio-editor-section">
                <div className="listing-studio-editor-section-head">
                  <strong>Details</strong>
                </div>
                <div className="listing-studio-editor-grid">
                  <label className="listing-studio-editor-field">
                    <span>Price</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("price", event.target.value)}
                      value={editorState.price}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>Beds</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("beds", event.target.value)}
                      value={editorState.beds}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>Baths</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("baths", event.target.value)}
                      value={editorState.baths}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>Sqft</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("sqft", event.target.value)}
                      value={editorState.sqft}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>Property Type</span>
                    <SelectInput
                      className="listing-studio-editor-select"
                      onChange={(event) => updateEditorField("propertyType", event.target.value)}
                      value={editorState.propertyType}
                    >
                      <option value="">Select type</option>
                      {PROPERTY_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectInput>
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>Status</span>
                    <SelectInput
                      className="listing-studio-editor-select"
                      onChange={(event) => updateEditorField("status", event.target.value)}
                      value={editorState.status}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectInput>
                  </label>
                </div>
              </section>

              <section className="listing-studio-editor-section">
                <div className="listing-studio-editor-section-head">
                  <strong>
                    {editorState.listingKind === "sale" ? "Sale Details" : "Rental Details"}
                  </strong>
                </div>
                <div className="listing-studio-editor-grid">
                  <label className="listing-studio-editor-field">
                    <span>Year Built</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("yearBuilt", event.target.value)}
                      value={editorState.yearBuilt}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>List Date</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("listDate", event.target.value)}
                      type="date"
                      value={editorState.listDate}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>Common Charges (HOA, /mo)</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) =>
                        updateEditorField("commonCharges", event.target.value)
                      }
                      value={editorState.commonCharges}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>Taxes (/mo)</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("taxes", event.target.value)}
                      value={editorState.taxes}
                    />
                  </label>
                </div>
              </section>

              <section className="listing-studio-editor-section">
                <div className="listing-studio-editor-section-head">
                  <strong>Additional</strong>
                </div>

                <label className="listing-studio-editor-field">
                  <span>Description</span>
                  <TextareaInput
                    className="listing-studio-editor-textarea"
                    onChange={(event) => updateEditorField("description", event.target.value)}
                    rows={4}
                    value={editorState.description}
                  />
                </label>

                <div className="listing-studio-editor-subsection-label">
                  <span>Building Amenities</span>
                </div>

                <div className="listing-studio-editor-amenity-stack">
                  {editorState.amenitySections.map((section) => (
                    <div className="listing-studio-editor-amenity-section" key={section.title}>
                      <button
                        className="listing-studio-editor-amenity-toggle"
                        onClick={() => toggleAmenityOpen(section.title)}
                        type="button"
                      >
                        <span>{section.title}</span>
                        <em>{section.selected.length + section.customItems.length}</em>
                        <IconChevronDown isOpen={section.open} />
                      </button>

                      {section.open ? (
                        <div className="listing-studio-editor-amenity-body">
                          <div className="listing-studio-editor-amenity-grid">
                            {section.options.map((option) => (
                              <CheckboxField
                                className="listing-studio-editor-checkbox"
                                key={`${section.title}-${option}`}
                                label={option}
                              >
                                <input
                                  checked={section.selected.includes(option)}
                                  onChange={() => toggleAmenityOption(section.title, option)}
                                  type="checkbox"
                                />
                              </CheckboxField>
                            ))}
                          </div>

                          <div className="listing-studio-editor-custom-block">
                            {section.customItems.length ? (
                              <div className="listing-studio-editor-custom-chip-stack">
                                <span className="listing-studio-editor-custom-label">
                                  Custom amenities:
                                </span>
                                <div className="listing-studio-editor-chip-row">
                                  {section.customItems.map((item) => (
                                    <span className="listing-studio-editor-chip" key={item}>
                                      {item}
                                      <button
                                        aria-label={`Remove ${item}`}
                                        onClick={() => removeCustomAmenity(section.title, item)}
                                        type="button"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {section.isAddingCustom ? (
                              <div className="listing-studio-editor-custom-input-row">
                                <TextInput
                                  className="listing-studio-editor-input"
                                  onChange={(event) =>
                                    updateAmenityDraft(section.title, event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      addCustomAmenity(section.title);
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      toggleAddCustom(section.title, false);
                                    }
                                  }}
                                  placeholder="Add custom amenity"
                                  value={section.draftCustom}
                                />
                                <Button
                                  onClick={() => addCustomAmenity(section.title)}
                                  type="button"
                                  variant="secondary"
                                >
                                  Add
                                </Button>
                                <Button
                                  onClick={() => toggleAddCustom(section.title, false)}
                                  type="button"
                                  variant="ghost"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <button
                                className="listing-studio-editor-add-custom"
                                onClick={() => toggleAddCustom(section.title, true)}
                                type="button"
                              >
                                <IconPlus />
                                <span>Add custom</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="listing-studio-editor-grid listing-studio-editor-meta-grid">
                  <label className="listing-studio-editor-field">
                    <span>Unit Number</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("unit", event.target.value)}
                      value={editorState.unit}
                    />
                  </label>
                  <label className="listing-studio-editor-field">
                    <span>Neighborhood</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("neighborhood", event.target.value)}
                      value={editorState.neighborhood}
                    />
                  </label>
                  <label className="listing-studio-editor-field listing-studio-editor-meta-url">
                    <span>Listing URL</span>
                    <TextInput
                      className="listing-studio-editor-input"
                      onChange={(event) => updateEditorField("listingUrl", event.target.value)}
                      value={editorState.listingUrl}
                    />
                  </label>
                </div>
              </section>
              </div>

              <footer className="listing-studio-editor-footer">
                <div className="listing-studio-editor-footer-actions">
                  <Button onClick={closeEditor} type="button" variant="secondary">
                    Cancel
                  </Button>
                  <Button
                    disabled={isSaving}
                    onClick={() => void savePack({ closeEditor: true })}
                    type="button"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </footer>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
