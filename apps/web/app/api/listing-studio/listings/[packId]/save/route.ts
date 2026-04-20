import { canAccessListingStudio } from "@acre/auth";
import { saveStudioListingPackToMyListings } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export const runtime = "nodejs";

type ListingStudioPackSaveRouteDependencies = {
  getRequestSessionContext?: typeof getRequestSessionContext;
  saveStudioListingPackToMyListings?: typeof saveStudioListingPackToMyListings;
};

export async function handleSaveStudioListingPackPost(
  request: NextRequest,
  packId: string,
  dependencies: ListingStudioPackSaveRouteDependencies = {},
) {
  const context = await (
    dependencies.getRequestSessionContext ?? getRequestSessionContext
  )(request);

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

  const result = await (
    dependencies.saveStudioListingPackToMyListings ??
    saveStudioListingPackToMyListings
  )({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    packId,
  });

  if (!result) {
    return NextResponse.json(
      { error: "Company dashboard listing not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ packId: string }> },
) {
  const { packId } = await props.params;
  return handleSaveStudioListingPackPost(request, packId.trim());
}
