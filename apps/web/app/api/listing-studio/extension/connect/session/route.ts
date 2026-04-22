import { getStudioListingExtensionTokenOwner } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export const runtime = "nodejs";

type ListingStudioExtensionSessionRouteDependencies = {
  getRequestSessionContext?: typeof getRequestSessionContext;
  getStudioListingExtensionTokenOwner?: typeof getStudioListingExtensionTokenOwner;
};

export async function handleListingStudioExtensionSessionPost(
  request: NextRequest,
  dependencies: ListingStudioExtensionSessionRouteDependencies = {},
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

  const body = (await request.json().catch(() => null)) as {
    extensionToken?: string;
  } | null;
  const extensionToken = body?.extensionToken?.trim();

  if (!extensionToken) {
    return NextResponse.json(
      { error: "extensionToken is required." },
      { status: 400 },
    );
  }

  const tokenOwner = await (
    dependencies.getStudioListingExtensionTokenOwner ??
    getStudioListingExtensionTokenOwner
  )(extensionToken);

  return NextResponse.json({
    tokenValid: Boolean(tokenOwner),
    matchesCurrentMembership:
      tokenOwner?.membershipId === context.currentMembership.id,
    currentMembershipId: context.currentMembership.id,
    tokenMembershipId: tokenOwner?.membershipId ?? null,
    tokenMembershipLabel: tokenOwner?.membershipLabel ?? null,
  });
}

export async function POST(request: NextRequest) {
  return handleListingStudioExtensionSessionPost(request);
}
