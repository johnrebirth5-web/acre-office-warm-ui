import { canCreateListingStudio } from "@acre/auth";
import { approveStudioListingExtensionChallenge } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

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

  const result = await approveStudioListingExtensionChallenge({
    challengeToken,
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    approvedByMembershipId: context.currentMembership.id,
  });

  return NextResponse.json(result);
}
