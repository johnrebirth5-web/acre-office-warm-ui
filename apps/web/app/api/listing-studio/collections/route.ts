import {
  canAccessListingStudio,
  canEditListingStudio,
} from "@acre/auth";
import {
  createStudioListingCollection,
  listStudioListingCollectionPickerItems,
  listStudioListingCollections,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

export const runtime = "nodejs";

function getCollectionErrorResponse(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;
  const status =
    /already exists/i.test(message)
      ? 409
      : /not found/i.test(message)
        ? 404
        : 400;

  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canAccessListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio access required." },
      { status: 403 },
    );
  }

  const packId = request.nextUrl.searchParams.get("packId")?.trim() || null;
  const search = request.nextUrl.searchParams.get("q");

  if (packId) {
    const items = await listStudioListingCollectionPickerItems({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      packId,
      search,
    });

    return NextResponse.json({ items, mode: "picker" });
  }

  const collections = await listStudioListingCollections({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
  });

  return NextResponse.json({ items: collections, mode: "list" });
}

export async function POST(request: NextRequest) {
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
        name?: string;
        packId?: string | null;
      }
    | null;

  try {
    const collection = await createStudioListingCollection({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: context.currentMembership.id,
      name: body?.name ?? "",
      initialPackId:
        typeof body?.packId === "string" ? body.packId : null,
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    return getCollectionErrorResponse(
      error,
      "Unable to create the collection.",
    );
  }
}
