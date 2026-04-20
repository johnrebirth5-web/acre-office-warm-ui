import {
  canAccessListingStudio,
  canEditListingStudio,
  canManageListingStudioCompanyFeed,
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

type ListingStudioPackRouteDependencies = {
  deleteStudioListingPack?: typeof deleteStudioListingPack;
  ensureListingStudioStorageConfigured?: typeof ensureListingStudioStorageConfigured;
  getRequestSessionContext?: typeof getRequestSessionContext;
  getStudioListingPackDetail?: typeof getStudioListingPackDetail;
  updateStudioListingPack?: typeof updateStudioListingPack;
};

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

export async function handleUpdateStudioListingPackPatch(
  request: NextRequest,
  packId: string,
  dependencies: ListingStudioPackRouteDependencies = {},
) {
  const context = await (
    dependencies.getRequestSessionContext ?? getRequestSessionContext
  )(request);

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
        title?: string | null;
        sourceUrl?: string | null;
        listingType?: string | null;
        statusLabel?: string | null;
        price?: number | null;
        streetAddress?: string | null;
        unit?: string | null;
        city?: string | null;
        state?: string | null;
        postalCode?: string | null;
        neighborhood?: string | null;
        buildingName?: string | null;
        bedrooms?: number | null;
        bathrooms?: number | null;
        rooms?: number | null;
        sqft?: number | null;
        availabilityLabel?: string | null;
        descriptionText?: string | null;
        amenities?: Array<{ title: string; items: string[] }>;
        sourceFacts?: Array<{ label: string; value: string }>;
        companyFeedVisible?: boolean;
      }
    | null;
  const requestedCompanyFeedVisibility =
    typeof body?.companyFeedVisible === "boolean"
      ? body.companyFeedVisible
      : undefined;

  if (
    requestedCompanyFeedVisibility !== undefined &&
    !canManageListingStudioCompanyFeed(context.currentMembership)
  ) {
    return NextResponse.json(
      { error: "Listing Studio company feed manage access required." },
      { status: 403 },
    );
  }

  const detail = await (
    dependencies.updateStudioListingPack ?? updateStudioListingPack
  )({
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
    title: body?.title,
    sourceUrl: body?.sourceUrl,
    listingType: body?.listingType,
    statusLabel: body?.statusLabel,
    price: typeof body?.price === "number" || body?.price === null ? body.price : undefined,
    streetAddress: body?.streetAddress,
    unit: body?.unit,
    city: body?.city,
    state: body?.state,
    postalCode: body?.postalCode,
    neighborhood: body?.neighborhood,
    buildingName: body?.buildingName,
    bedrooms:
      typeof body?.bedrooms === "number" || body?.bedrooms === null
        ? body.bedrooms
        : undefined,
    bathrooms:
      typeof body?.bathrooms === "number" || body?.bathrooms === null
        ? body.bathrooms
        : undefined,
    rooms:
      typeof body?.rooms === "number" || body?.rooms === null ? body.rooms : undefined,
    sqft: typeof body?.sqft === "number" || body?.sqft === null ? body.sqft : undefined,
    availabilityLabel: body?.availabilityLabel,
    descriptionText: body?.descriptionText,
    amenities: Array.isArray(body?.amenities) ? body.amenities : undefined,
    sourceFacts: Array.isArray(body?.sourceFacts) ? body.sourceFacts : undefined,
    companyFeedVisible: requestedCompanyFeedVisibility,
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
  const { packId } = await props.params;
  return handleUpdateStudioListingPackPatch(request, packId);
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
  (ensureListingStudioStorageConfigured)();
  const deleted = await deleteStudioListingPack({
    organizationId: context.currentOrganization.id,
    packId,
  });

  if (!deleted) {
    return NextResponse.json({ error: "Packet not found." }, { status: 404 });
  }

  return NextResponse.json(deleted);
}
