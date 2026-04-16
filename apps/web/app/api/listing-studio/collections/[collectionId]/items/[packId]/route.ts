import { canEditListingStudio } from "@acre/auth";
import { removeStudioListingPackFromCollection } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ collectionId: string; packId: string }> },
) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canEditListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio edit access required." },
      { status: 403 },
    );
  }

  const { collectionId, packId } = await props.params;
  const collection = await removeStudioListingPackFromCollection({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    collectionId,
    packId,
  });

  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(collection);
}
