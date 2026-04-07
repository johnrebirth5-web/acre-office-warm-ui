import { pollStudioListingExtensionChallenge } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const challengeToken = request.nextUrl.searchParams.get("challengeToken")?.trim();

  if (!challengeToken) {
    return NextResponse.json(
      { error: "challengeToken is required." },
      { status: 400 },
    );
  }

  const status = await pollStudioListingExtensionChallenge(challengeToken);
  return NextResponse.json(status);
}
