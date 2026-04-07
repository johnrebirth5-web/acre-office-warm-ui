import { StudioListingSourceSite } from "@prisma/client";
import { createStudioListingImport } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "../../../../lib/request-origin";
import {
  ensureListingStudioStorageConfigured,
  getListingStudioExtensionContext,
} from "../../../../lib/listing-studio";

export const runtime = "nodejs";

function parseSourceSite(value: unknown) {
  return value === StudioListingSourceSite.streeteasy ||
    value === StudioListingSourceSite.zillow
    ? value
    : null;
}

export async function POST(request: NextRequest) {
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
