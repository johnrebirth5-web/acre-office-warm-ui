import { canEditListingStudio } from "@acre/auth";
import { addStudioListingPackToCollection } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export const runtime = "nodejs";

function getCollectionErrorResponse(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;
  const status = /not found/i.test(message) ? 404 : 400;

  return NextResponse.json({ error: message }, { status });
}

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

  if (!canEditListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio edit access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        packId?: string;
      }
    | null;
  const { collectionId } = await props.params;

  try {
    const collection = await addStudioListingPackToCollection({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      collectionId,
      packId: body?.packId ?? "",
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(collection);
  } catch (error) {
    return getCollectionErrorResponse(
      error,
      "Unable to add the listing to the collection.",
    );
  }
}
