import { canShareListingStudio } from "@acre/auth";
import { publishStudioListingCollection } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { getAppBaseUrl } from "../../../../../../lib/request-origin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ collectionId: string }> },
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

  const { collectionId } = await props.params;
  const result = await publishStudioListingCollection({
    organizationId: context.currentOrganization.id,
    collectionId,
    membershipId: context.currentMembership.id,
  });

  if (!result) {
    return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  }

  const baseUrl = getAppBaseUrl(request);

  return NextResponse.json({
    shareCode: result.shareCode,
    shareUrl: `${baseUrl}/share/collections/${result.shareCode}`,
  });
}
