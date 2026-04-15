import { canEditListingStudio } from "@acre/auth";
import { deleteStudioListingPackAsset } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { ensureListingStudioStorageConfigured } from "../../../../../../../lib/listing-studio";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ packId: string; assetId: string }> },
) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canEditListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio edit access required." },
      { status: 403 },
    );
  }

  const { packId, assetId } = await props.params;
  ensureListingStudioStorageConfigured();

  const detail = await deleteStudioListingPackAsset({
    organizationId: context.currentOrganization.id,
    packId,
    membershipId: context.currentMembership.id,
    assetId,
  });

  if (!detail) {
    return NextResponse.json({ error: "Packet not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
