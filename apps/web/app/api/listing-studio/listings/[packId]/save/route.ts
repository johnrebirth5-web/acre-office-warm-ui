import { canAccessListingStudio } from "@acre/auth";
import {
  removeStudioListingPackFromMyListings,
  saveStudioListingPackToMyListings,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export const runtime = "nodejs";

type ListingStudioPackSaveRouteDependencies = {
  getRequestSessionContext?: typeof getRequestSessionContext;
  removeStudioListingPackFromMyListings?: typeof removeStudioListingPackFromMyListings;
  saveStudioListingPackToMyListings?: typeof saveStudioListingPackToMyListings;
};

function getSaveRouteErrorResponse(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;
  const status =
    /not found/i.test(message)
      ? 404
      : /only company dashboard/i.test(message)
        ? 409
        : 400;

  return NextResponse.json({ error: message }, { status });
}

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

export async function handleRemoveStudioListingPackDelete(
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

  try {
    const result = await (
      dependencies.removeStudioListingPackFromMyListings ??
      removeStudioListingPackFromMyListings
    )({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      packId,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Saved listing not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return getSaveRouteErrorResponse(
      error,
      "Unable to remove this listing from My listings.",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ packId: string }> },
) {
  const { packId } = await props.params;
  return handleRemoveStudioListingPackDelete(request, packId.trim());
}
