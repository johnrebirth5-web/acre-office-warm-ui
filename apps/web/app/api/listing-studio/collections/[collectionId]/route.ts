import {
  canAccessListingStudio,
  canEditListingStudio,
} from "@acre/auth";
import {
  deleteStudioListingCollection,
  getStudioListingCollectionDetail,
  updateStudioListingCollection,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

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

export async function GET(
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

  if (!canAccessListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio access required." },
      { status: 403 },
    );
  }

  const { collectionId } = await props.params;
  const collection = await getStudioListingCollectionDetail({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    collectionId,
  });

  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(collection);
}

export async function PATCH(
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
        name?: string;
      }
    | null;
  const { collectionId } = await props.params;

  try {
    const collection = await updateStudioListingCollection({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      collectionId,
      name: body?.name ?? "",
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
      "Unable to update the collection.",
    );
  }
}

export async function DELETE(
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

  const { collectionId } = await props.params;
  const deleted = await deleteStudioListingCollection({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    collectionId,
  });

  if (!deleted) {
    return NextResponse.json(
      { error: "Collection not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(deleted);
}
