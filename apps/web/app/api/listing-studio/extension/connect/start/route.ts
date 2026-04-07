import { createStudioListingExtensionChallenge } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "../../../../../../lib/request-origin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const challenge = await createStudioListingExtensionChallenge();
  const baseUrl = getAppBaseUrl(request);

  return NextResponse.json({
    challengeToken: challenge.challengeToken,
    expiresAt: challenge.expiresAt.toISOString(),
    approvalUrl: `${baseUrl}/listing-studio/extension/connect/${challenge.challengeToken}`,
  });
}
