import { Prisma, ResourceType } from "@prisma/client";
import { activityLogActions } from "./activity-log";
import { prisma } from "./client";

const allowedOfficeResourceTypes = new Set<ResourceType>([
  ResourceType.playbook,
  ResourceType.template,
  ResourceType.document,
  ResourceType.training_video,
]);

const staleResourceWindowDays = 90;

export type OfficeResourcesAdminSnapshot = {
  summary: {
    resourceCount: number;
    publishedResourceCount: number;
    vendorCount: number;
    featuredVendorCount: number;
    trainingResourceCount: number;
    staleResourceCount: number;
  };
  topOpenedResources: Array<{
    id: string;
    title: string;
    type: ResourceType;
    typeLabel: string;
    openCount: number;
    lastOpenedLabel: string;
  }>;
  staleResources: Array<{
    id: string;
    title: string;
    type: ResourceType;
    typeLabel: string;
    updatedAtLabel: string;
    lastOpenedLabel: string;
    isPublished: boolean;
  }>;
  resources: Array<{
    id: string;
    title: string;
    summary: string;
    type: ResourceType;
    typeLabel: string;
    url: string;
    tagsText: string;
    isPublished: boolean;
    scopeKey: "organization_wide" | "office_only";
    scopeLabel: string;
    updatedAtLabel: string;
    lastOpenedLabel: string;
    openCount: number;
  }>;
  vendors: Array<{
    id: string;
    name: string;
    category: string;
    categoryLabel: string;
    headline: string;
    phone: string;
    email: string;
    website: string;
    neighborhoodsText: string;
    coverageLabel: string;
    notes: string;
    isFeatured: boolean;
    scopeKey: "organization_wide" | "office_only";
    scopeLabel: string;
    updatedAtLabel: string;
  }>;
  resourceTypeOptions: Array<{
    value: ResourceType;
    label: string;
  }>;
};

export type CreateOfficeResourceInput = {
  organizationId: string;
  officeId: string | null;
  title: string;
  summary: string;
  url: string;
  tags: string[];
  type: ResourceType;
  isPublished: boolean;
  visibilityScope: "organization_wide" | "office_only";
};

export type UpdateOfficeResourceInput = CreateOfficeResourceInput & {
  resourceId: string;
};

export type DeleteOfficeResourceInput = {
  organizationId: string;
  officeId: string | null;
  resourceId: string;
};

export type CreateOfficeVendorInput = {
  organizationId: string;
  officeId: string | null;
  category: string;
  name: string;
  headline: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  neighborhoods: string[];
  notes: string | null;
  isFeatured: boolean;
  visibilityScope: "organization_wide" | "office_only";
};

export type UpdateOfficeVendorInput = CreateOfficeVendorInput & {
  vendorId: string;
};

export type DeleteOfficeVendorInput = {
  organizationId: string;
  officeId: string | null;
  vendorId: string;
};

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function formatResourceTypeLabel(type: ResourceType) {
  switch (type) {
    case ResourceType.playbook:
      return "Playbook";
    case ResourceType.template:
      return "Template";
    case ResourceType.document:
      return "Document";
    case ResourceType.training_video:
      return "Training video";
    case ResourceType.vendor_card:
      return "Vendor card";
    default:
      return type;
  }
}

function formatVendorCategoryLabel(category: string | null | undefined) {
  const trimmed = category?.trim();

  if (!trimmed) {
    return "Vendor";
  }

  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTimeLabel(value: Date, timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone ?? undefined,
  }).format(value);
}

function formatLastOpenedLabel(value: Date | null, timeZone?: string | null) {
  if (!value) {
    return "Never opened";
  }

  return `Opened ${formatDateTimeLabel(value, timeZone)}`;
}

function slugifyResourceTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function buildUniqueResourceSlug(
  tx: Prisma.TransactionClient,
  organizationId: string,
  title: string,
  excludeResourceId?: string,
) {
  const baseSlug = slugifyResourceTitle(title) || "resource";
  const existingResources = await tx.resource.findMany({
    where: {
      organizationId,
      slug: {
        startsWith: baseSlug,
      },
      ...(excludeResourceId
        ? {
            NOT: {
              id: excludeResourceId,
            },
          }
        : {}),
    },
    select: {
      slug: true,
    },
  });
  const existingSlugs = new Set(
    existingResources.map((resource) => resource.slug),
  );

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

function normalizeCsvList(value: string[]) {
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function buildSearchText(input: {
  title: string;
  summary: string;
  tags: string[];
}) {
  return normalizeCsvList([input.title, input.summary, ...input.tags]).join(
    " ",
  );
}

function resolveScopeValue(
  officeId: string | null,
  visibilityScope: "organization_wide" | "office_only",
) {
  return visibilityScope === "organization_wide" ? null : officeId;
}

function getScopeKey(
  resourceOfficeId: string | null,
): "organization_wide" | "office_only" {
  return resourceOfficeId ? "office_only" : "organization_wide";
}

function getScopeLabel(resourceOfficeId: string | null) {
  return resourceOfficeId ? "Office only" : "Organization-wide";
}

function assertResourceType(type: ResourceType) {
  if (!allowedOfficeResourceTypes.has(type)) {
    throw new Error("Unsupported resource type.");
  }
}

function assertNonEmptyField(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

function isYouTubeUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    const normalizedHost = parsedUrl.hostname.toLowerCase();

    return (
      parsedUrl.protocol === "https:" &&
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
      ].includes(normalizedHost)
    );
  } catch {
    return false;
  }
}

function assertSupportedResourceUrl(type: ResourceType, value: string) {
  if (type === ResourceType.training_video && !isYouTubeUrl(value.trim())) {
    throw new Error("Training video resources must use a full YouTube URL.");
  }
}

async function getScopedResourceRecord(input: {
  organizationId: string;
  officeId: string | null;
  resourceId: string;
}) {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId);

  return prisma.resource.findFirst({
    where: {
      id: input.resourceId,
      organizationId: input.organizationId,
      ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
    },
  });
}

async function getScopedVendorRecord(input: {
  organizationId: string;
  officeId: string | null;
  vendorId: string;
}) {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId);

  return prisma.vendor.findFirst({
    where: {
      id: input.vendorId,
      organizationId: input.organizationId,
      ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
    },
  });
}

export async function getOfficeResourcesAdminSnapshot(input: {
  organizationId: string;
  officeId: string | null;
  timeZone?: string | null;
}): Promise<OfficeResourcesAdminSnapshot> {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId);
  const resourceWhere: Prisma.ResourceWhereInput = {
    organizationId: input.organizationId,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };
  const vendorWhere: Prisma.VendorWhereInput = {
    organizationId: input.organizationId,
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const [resources, vendors] = await Promise.all([
    prisma.resource.findMany({
      where: resourceWhere,
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      select: {
        id: true,
        officeId: true,
        title: true,
        summary: true,
        type: true,
        url: true,
        tags: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.vendor.findMany({
      where: vendorWhere,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        officeId: true,
        category: true,
        name: true,
        headline: true,
        phone: true,
        email: true,
        website: true,
        neighborhoods: true,
        notes: true,
        isFeatured: true,
        updatedAt: true,
      },
    }),
  ]);

  const resourceIds = resources.map((resource) => resource.id);
  const openGroups =
    resourceIds.length > 0
      ? await prisma.auditLog.groupBy({
          by: ["entityId"],
          where: {
            organizationId: input.organizationId,
            entityType: "resource",
            action: activityLogActions.frontOfficeResourceOpened,
            entityId: {
              in: resourceIds,
            },
          },
          _count: {
            _all: true,
          },
          _max: {
            createdAt: true,
          },
        })
      : [];

  const openStatsByResourceId = new Map(
    openGroups.map((group) => [
      group.entityId,
      {
        openCount: group._count._all,
        lastOpenedAt: group._max.createdAt ?? null,
      },
    ]),
  );
  const staleCutoff = new Date(
    Date.now() - staleResourceWindowDays * 24 * 60 * 60 * 1000,
  );

  const resourceRows = resources.map((resource) => {
    const stats = openStatsByResourceId.get(resource.id);

    return {
      id: resource.id,
      title: resource.title,
      summary: resource.summary,
      type: resource.type,
      typeLabel: formatResourceTypeLabel(resource.type),
      url: resource.url,
      tagsText: resource.tags.join(", "),
      isPublished: resource.isPublished,
      scopeKey: getScopeKey(resource.officeId),
      scopeLabel: getScopeLabel(resource.officeId),
      updatedAtLabel: formatDateTimeLabel(resource.updatedAt, input.timeZone),
      lastOpenedLabel: formatLastOpenedLabel(
        stats?.lastOpenedAt ?? null,
        input.timeZone,
      ),
      openCount: stats?.openCount ?? 0,
      lastOpenedAt: stats?.lastOpenedAt ?? null,
      stale:
        stats?.lastOpenedAt != null
          ? stats.lastOpenedAt <= staleCutoff
          : resource.updatedAt <= staleCutoff,
    };
  });

  const topOpenedResources = resourceRows
    .filter((resource) => resource.openCount > 0)
    .sort(
      (left, right) =>
        right.openCount - left.openCount ||
        left.title.localeCompare(right.title),
    )
    .slice(0, 6)
    .map((resource) => ({
      id: resource.id,
      title: resource.title,
      type: resource.type,
      typeLabel: resource.typeLabel,
      openCount: resource.openCount,
      lastOpenedLabel: resource.lastOpenedLabel,
    }));

  const staleResources = resourceRows
    .filter((resource) => resource.stale)
    .sort((left, right) => {
      const leftTime = left.lastOpenedAt?.getTime() ?? 0;
      const rightTime = right.lastOpenedAt?.getTime() ?? 0;

      return leftTime - rightTime || left.title.localeCompare(right.title);
    })
    .slice(0, 8)
    .map((resource) => ({
      id: resource.id,
      title: resource.title,
      type: resource.type,
      typeLabel: resource.typeLabel,
      updatedAtLabel: resource.updatedAtLabel,
      lastOpenedLabel: resource.lastOpenedLabel,
      isPublished: resource.isPublished,
    }));

  return {
    summary: {
      resourceCount: resourceRows.length,
      publishedResourceCount: resourceRows.filter(
        (resource) => resource.isPublished,
      ).length,
      vendorCount: vendors.length,
      featuredVendorCount: vendors.filter((vendor) => vendor.isFeatured).length,
      trainingResourceCount: resourceRows.filter(
        (resource) => resource.type === ResourceType.training_video,
      ).length,
      staleResourceCount: staleResources.length,
    },
    topOpenedResources,
    staleResources,
    resources: resourceRows.map(
      ({ lastOpenedAt: _lastOpenedAt, stale: _stale, ...resource }) => resource,
    ),
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      category: vendor.category,
      categoryLabel: formatVendorCategoryLabel(vendor.category),
      headline: vendor.headline,
      phone: vendor.phone?.trim() || "",
      email: vendor.email?.trim() || "",
      website: vendor.website?.trim() || "",
      neighborhoodsText: vendor.neighborhoods.join(", "),
      coverageLabel: vendor.neighborhoods.length
        ? vendor.neighborhoods.join(", ")
        : "Coverage pending",
      notes: vendor.notes?.trim() || "",
      isFeatured: vendor.isFeatured,
      scopeKey: getScopeKey(vendor.officeId),
      scopeLabel: getScopeLabel(vendor.officeId),
      updatedAtLabel: formatDateTimeLabel(vendor.updatedAt, input.timeZone),
    })),
    resourceTypeOptions: Array.from(allowedOfficeResourceTypes).map((type) => ({
      value: type,
      label: formatResourceTypeLabel(type),
    })),
  };
}

export async function createOfficeResource(input: CreateOfficeResourceInput) {
  assertResourceType(input.type);
  assertNonEmptyField(input.title, "Title");
  assertNonEmptyField(input.summary, "Summary");
  assertNonEmptyField(input.url, "URL");
  assertSupportedResourceUrl(input.type, input.url);

  const tags = normalizeCsvList(input.tags);

  const resource = await prisma.$transaction(async (tx) => {
    const slug = await buildUniqueResourceSlug(
      tx,
      input.organizationId,
      input.title,
    );

    return tx.resource.create({
      data: {
        organizationId: input.organizationId,
        officeId: resolveScopeValue(input.officeId, input.visibilityScope),
        title: input.title.trim(),
        slug,
        summary: input.summary.trim(),
        url: input.url.trim(),
        tags,
        type: input.type,
        isPublished: input.isPublished,
        searchText: buildSearchText({
          title: input.title,
          summary: input.summary,
          tags,
        }),
      },
      select: {
        id: true,
      },
    });
  });

  return resource.id;
}

export async function updateOfficeResource(input: UpdateOfficeResourceInput) {
  const existingResource = await getScopedResourceRecord({
    organizationId: input.organizationId,
    officeId: input.officeId,
    resourceId: input.resourceId,
  });

  if (!existingResource) {
    return null;
  }

  assertResourceType(input.type);
  assertNonEmptyField(input.title, "Title");
  assertNonEmptyField(input.summary, "Summary");
  assertNonEmptyField(input.url, "URL");
  assertSupportedResourceUrl(input.type, input.url);

  const tags = normalizeCsvList(input.tags);

  const updated = await prisma.$transaction(async (tx) => {
    const slug = await buildUniqueResourceSlug(
      tx,
      input.organizationId,
      input.title,
      existingResource.id,
    );

    return tx.resource.update({
      where: {
        id: existingResource.id,
      },
      data: {
        officeId: resolveScopeValue(input.officeId, input.visibilityScope),
        title: input.title.trim(),
        slug,
        summary: input.summary.trim(),
        url: input.url.trim(),
        tags,
        type: input.type,
        isPublished: input.isPublished,
        searchText: buildSearchText({
          title: input.title,
          summary: input.summary,
          tags,
        }),
      },
      select: {
        id: true,
      },
    });
  });

  return updated.id;
}

export async function deleteOfficeResource(input: DeleteOfficeResourceInput) {
  const existingResource = await getScopedResourceRecord(input);

  if (!existingResource) {
    return false;
  }

  await prisma.resource.delete({
    where: {
      id: existingResource.id,
    },
  });

  return true;
}

export async function createOfficeVendor(input: CreateOfficeVendorInput) {
  assertNonEmptyField(input.category, "Category");
  assertNonEmptyField(input.name, "Name");
  assertNonEmptyField(input.headline, "Headline");

  const vendor = await prisma.vendor.create({
    data: {
      organizationId: input.organizationId,
      officeId: resolveScopeValue(input.officeId, input.visibilityScope),
      category: input.category.trim(),
      name: input.name.trim(),
      headline: input.headline.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      website: input.website?.trim() || null,
      neighborhoods: normalizeCsvList(input.neighborhoods),
      notes: input.notes?.trim() || null,
      isFeatured: input.isFeatured,
    },
    select: {
      id: true,
    },
  });

  return vendor.id;
}

export async function updateOfficeVendor(input: UpdateOfficeVendorInput) {
  const existingVendor = await getScopedVendorRecord({
    organizationId: input.organizationId,
    officeId: input.officeId,
    vendorId: input.vendorId,
  });

  if (!existingVendor) {
    return null;
  }

  assertNonEmptyField(input.category, "Category");
  assertNonEmptyField(input.name, "Name");
  assertNonEmptyField(input.headline, "Headline");

  const updated = await prisma.vendor.update({
    where: {
      id: existingVendor.id,
    },
    data: {
      officeId: resolveScopeValue(input.officeId, input.visibilityScope),
      category: input.category.trim(),
      name: input.name.trim(),
      headline: input.headline.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      website: input.website?.trim() || null,
      neighborhoods: normalizeCsvList(input.neighborhoods),
      notes: input.notes?.trim() || null,
      isFeatured: input.isFeatured,
    },
    select: {
      id: true,
    },
  });

  return updated.id;
}

export async function deleteOfficeVendor(input: DeleteOfficeVendorInput) {
  const existingVendor = await getScopedVendorRecord(input);

  if (!existingVendor) {
    return false;
  }

  await prisma.vendor.delete({
    where: {
      id: existingVendor.id,
    },
  });

  return true;
}
