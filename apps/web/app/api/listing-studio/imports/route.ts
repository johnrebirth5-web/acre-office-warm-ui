import { StudioListingSourceSite } from "@prisma/client";
import { createStudioListingImport } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "../../../../lib/request-origin";
import {
  buildRateLimitKey,
  consumeRateLimit,
  hashRateLimitSegment,
} from "../../../../lib/rate-limit";
import {
  ensureListingStudioStorageConfigured,
  getListingStudioBearerToken,
  getListingStudioExtensionContext,
} from "../../../../lib/listing-studio";

export const runtime = "nodejs";

const LISTING_STUDIO_IMPORT_RATE_LIMIT_OPTIONS = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};

function parseSourceSite(value: unknown) {
  return value === StudioListingSourceSite.streeteasy ||
    value === StudioListingSourceSite.zillow
    ? value
    : null;
}

function buildListingStudioImportRateLimitResponse(retryAfterSeconds: number) {
  const response = NextResponse.json(
    { error: "Too many listing import attempts. Please try again in a moment." },
    { status: 429 },
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

function getListingStudioImportRateLimitKey(request: NextRequest) {
  const bearerToken = getListingStudioBearerToken(request);

  return buildRateLimitKey(
    "listing-studio/imports",
    request,
    bearerToken ? hashRateLimitSegment(bearerToken) : "anonymous",
  );
}

export async function POST(request: NextRequest) {
  const rateLimitDecision = await consumeRateLimit(
    getListingStudioImportRateLimitKey(request),
    LISTING_STUDIO_IMPORT_RATE_LIMIT_OPTIONS,
  );

  if (!rateLimitDecision.allowed) {
    return buildListingStudioImportRateLimitResponse(
      rateLimitDecision.retryAfterSeconds,
    );
  }

  const extensionContext = await getListingStudioExtensionContext(request);

  if (!extensionContext) {
    return NextResponse.json(
      { error: "Valid Listing Studio extension token required." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        sourceSite?: string;
        sourceUrl?: string;
        sourceListingId?: string | null;
        rawHtml?: string;
        rawMetaJson?: unknown;
        canonicalFields?: Record<string, unknown>;
        assets?: Array<{
          kind?: string | null;
          url?: string;
          label?: string | null;
          sortOrder?: number | null;
        }>;
      }
    | null;

  const sourceSite = parseSourceSite(body?.sourceSite);
  const sourceUrl = body?.sourceUrl?.trim();
  const rawHtml = body?.rawHtml ?? "";

  if (!sourceSite || !sourceUrl || !rawHtml) {
    return NextResponse.json(
      { error: "sourceSite, sourceUrl, and rawHtml are required." },
      { status: 400 },
    );
  }

  ensureListingStudioStorageConfigured();

  const result = await createStudioListingImport({
    organizationId: extensionContext.organizationId,
    officeId: extensionContext.officeId,
    membershipId: extensionContext.membershipId,
    sourceSite,
    sourceUrl,
    sourceListingId: body?.sourceListingId ?? null,
    rawHtml,
    rawMetaJson: body?.rawMetaJson ?? null,
    canonicalFields: body?.canonicalFields ?? {},
    assets:
      body?.assets?.map((asset, index) => ({
        kind:
          asset.kind === "hero" ||
          asset.kind === "gallery" ||
          asset.kind === "floor_plan" ||
          asset.kind === "map" ||
          asset.kind === "other"
            ? asset.kind
            : undefined,
        url: asset.url ?? "",
        label: asset.label ?? null,
        sortOrder: asset.sortOrder ?? index,
      })) ?? [],
  });

  const baseUrl = getAppBaseUrl(request);

  return NextResponse.json({
    importId: result.importId,
    snapshotId: result.snapshotId,
    packId: result.packId,
    detailUrl: `${baseUrl}/listing-studio/listings/${result.packId}`,
  });
}
