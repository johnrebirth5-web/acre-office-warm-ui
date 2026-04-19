import { canCreateListingStudio } from "@acre/auth";
import { approveStudioListingExtensionChallenge } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import {
  buildPublicTokenRateLimitResponse,
  consumePublicTokenRateLimit,
  LISTING_STUDIO_EXTENSION_APPROVE_RATE_LIMIT_OPTIONS,
} from "../../../../../../lib/public-token-rate-limit";

export const runtime = "nodejs";

type ListingStudioExtensionApproveRouteDependencies = {
  approveStudioListingExtensionChallenge?: typeof approveStudioListingExtensionChallenge;
  getRequestSessionContext?: typeof getRequestSessionContext;
  rateLimit?: typeof consumePublicTokenRateLimit;
};

export async function handleListingStudioExtensionApprovePost(
  request: NextRequest,
  dependencies: ListingStudioExtensionApproveRouteDependencies = {},
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

  if (!canCreateListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio create access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    challengeToken?: string;
  } | null;
  const challengeToken = body?.challengeToken?.trim();

  if (!challengeToken) {
    return NextResponse.json(
      { error: "challengeToken is required." },
      { status: 400 },
    );
  }

  const rateLimitDecision = await (
    dependencies.rateLimit ?? consumePublicTokenRateLimit
  )({
    scope: "listing-studio/extension/connect/approve",
    request,
    token: challengeToken,
    options: LISTING_STUDIO_EXTENSION_APPROVE_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    return buildPublicTokenRateLimitResponse(
      "Too many extension approval attempts. Please try again in a moment.",
      rateLimitDecision.retryAfterSeconds,
    );
  }

  const result = await (
    dependencies.approveStudioListingExtensionChallenge ??
    approveStudioListingExtensionChallenge
  )({
    challengeToken,
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    approvedByMembershipId: context.currentMembership.id,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return handleListingStudioExtensionApprovePost(request);
}
