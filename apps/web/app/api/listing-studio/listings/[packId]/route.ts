import {
  canAccessListingStudio,
  canEditListingStudio,
} from "@acre/auth";
import {
  deleteStudioListingPack,
  getStudioListingPackDetail,
  updateStudioListingPack,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { ensureListingStudioStorageConfigured } from "../../../../../lib/listing-studio";

export const runtime = "nodejs";

export async function GET(
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

  if (!canAccessListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio access required." },
      { status: 403 },
    );
  }

  const { packId } = await props.params;
  const detail = await getStudioListingPackDetail({
    organizationId: context.currentOrganization.id,
    packId,
  });

  if (!detail) {
    return NextResponse.json({ error: "Packet not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(
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

  if (!canEditListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio edit access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        headline?: string;
        summary?: string;
        bulletPoints?: string[];
        selectedAssetIds?: string[];
        coverAssetId?: string | null;
        agentNote?: string;
        contactName?: string;
        contactTitle?: string;
        contactPhone?: string;
        contactEmail?: string;
      }
    | null;
  const { packId } = await props.params;
  const detail = await updateStudioListingPack({
    organizationId: context.currentOrganization.id,
    packId,
    membershipId: context.currentMembership.id,
    headline: body?.headline,
    summary: body?.summary,
    bulletPoints: Array.isArray(body?.bulletPoints) ? body?.bulletPoints : undefined,
    selectedAssetIds: Array.isArray(body?.selectedAssetIds)
      ? body?.selectedAssetIds
      : undefined,
    coverAssetId:
      typeof body?.coverAssetId === "string" || body?.coverAssetId === null
        ? body?.coverAssetId
        : undefined,
    agentNote: body?.agentNote,
    contactName: body?.contactName,
    contactTitle: body?.contactTitle,
    contactPhone: body?.contactPhone,
    contactEmail: body?.contactEmail,
  });

  if (!detail) {
    return NextResponse.json({ error: "Packet not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function DELETE(
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

  if (!canEditListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio edit access required." },
      { status: 403 },
    );
  }

  const { packId } = await props.params;
  ensureListingStudioStorageConfigured();
  const deleted = await deleteStudioListingPack({
    organizationId: context.currentOrganization.id,
    packId,
  });

  if (!deleted) {
    return NextResponse.json({ error: "Packet not found." }, { status: 404 });
  }

  return NextResponse.json(deleted);
}
