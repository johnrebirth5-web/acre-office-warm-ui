import { canShareListingStudio } from "@acre/auth";
import { publishStudioListingPack } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { getAppBaseUrl } from "../../../../../../lib/request-origin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ packId: string }> },
) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canShareListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio share access required." },
      { status: 403 },
    );
  }

  const { packId } = await props.params;
  const result = await publishStudioListingPack({
    organizationId: context.currentOrganization.id,
    packId,
    membershipId: context.currentMembership.id,
  });

  if (!result) {
    return NextResponse.json({ error: "Packet not found." }, { status: 404 });
  }

  const baseUrl = getAppBaseUrl(request);

  return NextResponse.json({
    shareCode: result.shareCode,
    shareUrl: `${baseUrl}/share/packs/${result.shareCode}`,
  });
}
