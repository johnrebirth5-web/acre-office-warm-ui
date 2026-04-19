import { pollStudioListingExtensionChallenge } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  buildPublicTokenRateLimitResponse,
  consumePublicTokenRateLimit,
  LISTING_STUDIO_EXTENSION_STATUS_RATE_LIMIT_OPTIONS,
} from "../../../../../../lib/public-token-rate-limit";

export const runtime = "nodejs";

type ListingStudioExtensionStatusRouteDependencies = {
  pollStudioListingExtensionChallenge?: typeof pollStudioListingExtensionChallenge;
  rateLimit?: typeof consumePublicTokenRateLimit;
};

export async function handleListingStudioExtensionStatusGet(
  request: NextRequest,
  dependencies: ListingStudioExtensionStatusRouteDependencies = {},
) {
  const challengeToken = request.nextUrl.searchParams.get("challengeToken")?.trim();

  if (!challengeToken) {
    return NextResponse.json(
      { error: "challengeToken is required." },
      { status: 400 },
    );
  }

  const rateLimitDecision = await (
    dependencies.rateLimit ?? consumePublicTokenRateLimit
  )({
    scope: "listing-studio/extension/connect/status",
    request,
    token: challengeToken,
    options: LISTING_STUDIO_EXTENSION_STATUS_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    return buildPublicTokenRateLimitResponse(
      "Too many extension status checks. Please try again in a moment.",
      rateLimitDecision.retryAfterSeconds,
    );
  }

  const status = await (
    dependencies.pollStudioListingExtensionChallenge ??
    pollStudioListingExtensionChallenge
  )(challengeToken);
  return NextResponse.json(status);
}

export async function GET(request: NextRequest) {
  return handleListingStudioExtensionStatusGet(request);
}
