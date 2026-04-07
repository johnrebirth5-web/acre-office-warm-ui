import { canAccessListingStudio } from "@acre/auth";
import { listStudioListingPacks } from "@acre/db";
import { StudioListingSourceSite } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canAccessListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio access required." },
      { status: 403 },
    );
  }

  const query = request.nextUrl.searchParams.get("q");
  const source = request.nextUrl.searchParams.get("source");
  const listingType = request.nextUrl.searchParams.get("type");
  const items = await listStudioListingPacks({
    organizationId: context.currentOrganization.id,
    search: query,
    sourceSite:
      source === StudioListingSourceSite.streeteasy ||
      source === StudioListingSourceSite.zillow
        ? source
        : null,
    listingType,
  });

  return NextResponse.json({ items });
}
