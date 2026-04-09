import { can } from "@acre/auth";
import { ResourceType } from "@prisma/client";
import { getFrontOfficeResourcesSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../lib/auth-session";

const allowedResourceTypes = new Set<ResourceType>([
  ResourceType.playbook,
  ResourceType.template,
  ResourceType.document,
  ResourceType.training_video,
  ResourceType.vendor_card,
]);

const allowedVendorModes = new Set(["all", "quick", "reference"]);

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "resources:view")) {
    return NextResponse.json(
      { error: "Resource access required." },
      { status: 403 },
    );
  }

  const snapshot = await getFrontOfficeResourcesSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });
  const resourceTypeFilter = request.nextUrl.searchParams.get("type")?.trim();
  const vendorCategoryFilter =
    request.nextUrl.searchParams.get("vendorCategory")?.trim() || null;
  const vendorMode =
    request.nextUrl.searchParams.get("vendorMode")?.trim().toLowerCase() ||
    "all";

  if (
    resourceTypeFilter &&
    !allowedResourceTypes.has(resourceTypeFilter as ResourceType)
  ) {
    return NextResponse.json(
      { error: "Unsupported resource type filter." },
      { status: 400 },
    );
  }

  if (!allowedVendorModes.has(vendorMode)) {
    return NextResponse.json(
      { error: "Unsupported vendor mode filter." },
      { status: 400 },
    );
  }

  const filteredResources = resourceTypeFilter
    ? snapshot.resources.filter(
        (resource) => resource.typeKey === resourceTypeFilter,
      )
    : snapshot.resources;
  const normalizedVendorCategoryFilter =
    vendorCategoryFilter?.toLowerCase() || null;
  const filteredVendors = snapshot.vendors.filter((vendor) => {
    const categoryMatches = normalizedVendorCategoryFilter
      ? vendor.category.trim().toLowerCase() === normalizedVendorCategoryFilter
      : true;
    const modeMatches =
      vendorMode === "quick"
        ? vendor.quickActionCount > 0
        : vendorMode === "reference"
          ? vendor.quickActionCount === 0
          : true;

    return categoryMatches && modeMatches;
  });
  const filteredResourceTypes = resourceTypeFilter
    ? snapshot.resourceTypes.filter((lane) => lane.key === resourceTypeFilter)
    : snapshot.resourceTypes;
  const filteredVendorCategories = normalizedVendorCategoryFilter
    ? snapshot.vendorCategories.filter(
        (category) =>
          category.category.trim().toLowerCase() ===
          normalizedVendorCategoryFilter,
      )
    : snapshot.vendorCategories;

  return NextResponse.json({
    filters: {
      type: resourceTypeFilter || null,
      vendorCategory: vendorCategoryFilter,
      vendorMode,
    },
    summary: snapshot.summary,
    filteredSummary: {
      resourceCount: filteredResources.length,
      vendorCount: filteredVendors.length,
      quickContactVendorCount: filteredVendors.filter(
        (vendor) => vendor.quickActionCount > 0,
      ).length,
      referenceOnlyVendorCount: filteredVendors.filter(
        (vendor) => vendor.quickActionCount === 0,
      ).length,
    },
    executionPulse: snapshot.executionPulse,
    resourceTypes: filteredResourceTypes,
    vendorCategories: filteredVendorCategories,
    resources: filteredResources,
    vendors: filteredVendors,
  });
}
