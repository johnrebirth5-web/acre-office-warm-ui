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

function normalizeSearchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function resourceMatchesQuery(
  resource: Awaited<
    ReturnType<typeof getFrontOfficeResourcesSnapshot>
  >["resources"][number],
  query: string | null,
) {
  if (!query) {
    return true;
  }

  const haystack = [
    resource.title,
    resource.summary,
    resource.detailLabel,
    resource.laneLabel,
    resource.typeLabel,
    ...resource.tags,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function vendorMatchesQuery(
  vendor: Awaited<
    ReturnType<typeof getFrontOfficeResourcesSnapshot>
  >["vendors"][number],
  query: string | null,
) {
  if (!query) {
    return true;
  }

  const haystack = [
    vendor.name,
    vendor.categoryLabel,
    vendor.headline,
    vendor.coverageLabel,
    vendor.contactLabel,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

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
  const resourceQuery = normalizeSearchValue(
    request.nextUrl.searchParams.get("q"),
  );
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
  const searchedResources = filteredResources.filter((resource) =>
    resourceMatchesQuery(resource, resourceQuery),
  );
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
  const searchedVendors = filteredVendors.filter((vendor) =>
    vendorMatchesQuery(vendor, resourceQuery),
  );
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
      q: resourceQuery,
      type: resourceTypeFilter || null,
      vendorCategory: vendorCategoryFilter,
      vendorMode,
    },
    summary: snapshot.summary,
    interactionTracking: snapshot.interactionTracking,
    filteredSummary: {
      resourceCount: searchedResources.length,
      vendorCount: searchedVendors.length,
      quickContactVendorCount: searchedVendors.filter(
        (vendor) => vendor.quickActionCount > 0,
      ).length,
      referenceOnlyVendorCount: searchedVendors.filter(
        (vendor) => vendor.quickActionCount === 0,
      ).length,
    },
    executionPulse: snapshot.executionPulse,
    resourceTypes: filteredResourceTypes,
    vendorCategories: filteredVendorCategories,
    resources: searchedResources,
    vendors: searchedVendors,
  });
}
