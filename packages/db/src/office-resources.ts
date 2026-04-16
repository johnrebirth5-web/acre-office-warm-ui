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

type ManagedResourceVisibilityScope = "organization_wide" | "office_only";

type StoredResourceFileInput = {
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
};

type DeleteOfficeResourceResult = {
  deleted: boolean;
  storageKey: string | null;
};

type UpdateOfficeResourceResult = {
  id: string;
  previousStorageKey: string | null;
};

const sharedResourceScopeLabel = "Shared across all companies";

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
    openHref: string;
    tagsText: string;
    isPublished: boolean;
    hasStoredFile: boolean;
    originalFileName: string;
    mimeType: string;
    fileSizeBytes: number;
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
  url?: string | null;
  tags: string[];
  type: ResourceType;
  isPublished?: boolean;
  visibilityScope: ManagedResourceVisibilityScope;
  uploadedFile?: StoredResourceFileInput | null;
};

export type UpdateOfficeResourceInput = Omit<
  CreateOfficeResourceInput,
  "organizationId" | "officeId"
> & {
  organizationId: string;
  officeId: string | null;
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
  notes?: string | null;
  isFeatured: boolean;
  visibilityScope: ManagedResourceVisibilityScope;
};

export type UpdateOfficeVendorInput = Omit<
  CreateOfficeVendorInput,
  "organizationId" | "officeId"
> & {
  organizationId: string;
  officeId: string | null;
  vendorId: string;
};

export type DeleteOfficeVendorInput = {
  organizationId: string;
  officeId: string | null;
  vendorId: string;
};

function formatResourceTypeLabel(type: ResourceType) {
  switch (normalizeManagedResourceType(type)) {
    case ResourceType.document:
      return "Document";
    case ResourceType.training_video:
      return "Training video";
    default:
      return type;
  }
}

function normalizeManagedResourceType(type: ResourceType) {
  return type === ResourceType.training_video
    ? ResourceType.training_video
    : ResourceType.document;
}

function buildResourceOpenHref(
  resourceId: string,
  type: ResourceType,
  url: string | null,
) {
  if (normalizeManagedResourceType(type) === ResourceType.document) {
    return `/api/resources/${resourceId}/file`;
  }

  return url?.trim() || "";
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
  _officeId: string | null,
  visibilityScope: "organization_wide" | "office_only",
) {
  void visibilityScope;
  return null;
}

function getScopeKey(
  _resourceOfficeId: string | null,
): "organization_wide" | "office_only" {
  return "organization_wide";
}

function getScopeLabel(_resourceOfficeId: string | null) {
  return sharedResourceScopeLabel;
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
  if (
    normalizeManagedResourceType(type) === ResourceType.training_video &&
    !isYouTubeUrl(value.trim())
  ) {
    throw new Error("Training video resources must use a full YouTube URL.");
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertPdfUpload(file: StoredResourceFileInput) {
  if (file.mimeType.trim().toLowerCase() !== "application/pdf") {
    throw new Error("Document resources must upload a PDF file.");
  }

  if (!file.originalFileName.trim()) {
    throw new Error("Uploaded document file name is required.");
  }

  if (!file.storageKey.trim()) {
    throw new Error("Uploaded document storage key is required.");
  }

  if (file.fileSizeBytes <= 0) {
    throw new Error("Uploaded document file size is invalid.");
  }
}

function assertManagedResourcePayload(input: {
  title: string;
  summary: string;
  type: ResourceType;
  url?: string | null;
  uploadedFile?: StoredResourceFileInput | null;
}) {
  const normalizedType = normalizeManagedResourceType(input.type);

  assertNonEmptyField(input.title, "Title");
  assertNonEmptyField(input.summary, "Summary");

  if (normalizedType === ResourceType.training_video) {
    const normalizedUrl = normalizeOptionalText(input.url);

    if (!normalizedUrl) {
      throw new Error("YouTube URL is required.");
    }

    assertSupportedResourceUrl(normalizedType, normalizedUrl);
    return;
  }

  if (input.uploadedFile) {
    assertPdfUpload(input.uploadedFile);
    return;
  }

  const normalizedUrl = normalizeOptionalText(input.url);

  if (!normalizedUrl) {
    throw new Error("Document PDF upload is required.");
  }
}

async function getScopedResourceRecord(input: {
  organizationId: string;
  officeId: string | null;
  resourceId: string;
}) {
  void input.officeId;

  return prisma.resource.findFirst({
    where: {
      id: input.resourceId,
      organizationId: input.organizationId,
    },
  });
}

async function getScopedVendorRecord(input: {
  organizationId: string;
  officeId: string | null;
  vendorId: string;
}) {
  void input.officeId;

  return prisma.vendor.findFirst({
    where: {
      id: input.vendorId,
      organizationId: input.organizationId,
    },
  });
}

export async function getOfficeResourceStorageRecord(input: {
  organizationId: string;
  officeId: string | null;
  resourceId: string;
}) {
  void input.officeId;

  return prisma.resource.findFirst({
    where: {
      id: input.resourceId,
      organizationId: input.organizationId,
      isPublished: true,
    },
    select: {
      id: true,
      title: true,
      type: true,
      url: true,
      originalFileName: true,
      mimeType: true,
      fileSizeBytes: true,
      storageKey: true,
    },
  });
}

export async function getOfficeResourcesAdminSnapshot(input: {
  organizationId: string;
  officeId: string | null;
  timeZone?: string | null;
}): Promise<OfficeResourcesAdminSnapshot> {
  void input.officeId;
  const resourceWhere: Prisma.ResourceWhereInput = {
    organizationId: input.organizationId,
  };
  const vendorWhere: Prisma.VendorWhereInput = {
    organizationId: input.organizationId,
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
        originalFileName: true,
        mimeType: true,
        fileSizeBytes: true,
        storageKey: true,
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
    const normalizedType = normalizeManagedResourceType(resource.type);
    const resourceUrl = resource.url?.trim() || "";
    const hasStoredFile = Boolean(resource.storageKey?.trim());

    return {
      id: resource.id,
      title: resource.title,
      summary: resource.summary,
      type: normalizedType,
      typeLabel: formatResourceTypeLabel(normalizedType),
      url: resourceUrl,
      openHref: buildResourceOpenHref(resource.id, normalizedType, resource.url),
      tagsText: resource.tags.join(", "),
      isPublished: resource.isPublished,
      hasStoredFile,
      originalFileName: resource.originalFileName?.trim() || "",
      mimeType: resource.mimeType?.trim() || "",
      fileSizeBytes: resource.fileSizeBytes ?? 0,
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
    resourceTypeOptions: Array.from(
      new Set(
        Array.from(allowedOfficeResourceTypes).map((type) =>
          normalizeManagedResourceType(type),
        ),
      ),
    ).map((type) => ({
      value: type,
      label: formatResourceTypeLabel(type),
    })),
  };
}

export async function createOfficeResource(input: CreateOfficeResourceInput) {
  assertResourceType(input.type);
  assertManagedResourcePayload(input);

  const normalizedType = normalizeManagedResourceType(input.type);
  const normalizedUrl =
    normalizedType === ResourceType.training_video
      ? normalizeOptionalText(input.url)
      : input.uploadedFile
        ? null
        : normalizeOptionalText(input.url);
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
        url: normalizedUrl,
        originalFileName: input.uploadedFile?.originalFileName.trim() || null,
        mimeType: input.uploadedFile?.mimeType.trim() || null,
        fileSizeBytes: input.uploadedFile?.fileSizeBytes ?? null,
        storageKey: input.uploadedFile?.storageKey.trim() || null,
        tags,
        type: normalizedType,
        isPublished: input.isPublished ?? true,
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
  assertManagedResourcePayload({
    ...input,
    url:
      normalizeManagedResourceType(input.type) === ResourceType.training_video
        ? input.url
        : input.uploadedFile
          ? null
          : input.url ?? existingResource.url,
  });

  const normalizedType = normalizeManagedResourceType(input.type);
  const tags = normalizeCsvList(input.tags);
  const nextUrl =
    normalizedType === ResourceType.training_video
      ? normalizeOptionalText(input.url)
      : input.uploadedFile
        ? null
        : normalizeOptionalText(input.url) ?? existingResource.url;
  const shouldReplaceStoredFile = Boolean(input.uploadedFile);
  const shouldRemoveStoredFile =
    normalizedType !== ResourceType.document || shouldReplaceStoredFile;
  const previousStorageKey =
    shouldRemoveStoredFile && existingResource.storageKey?.trim()
      ? existingResource.storageKey.trim()
      : null;

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
        url: nextUrl,
        originalFileName:
          normalizedType === ResourceType.document
            ? input.uploadedFile?.originalFileName.trim() ||
              existingResource.originalFileName
            : null,
        mimeType:
          normalizedType === ResourceType.document
            ? input.uploadedFile?.mimeType.trim() || existingResource.mimeType
            : null,
        fileSizeBytes:
          normalizedType === ResourceType.document
            ? input.uploadedFile?.fileSizeBytes ?? existingResource.fileSizeBytes
            : null,
        storageKey:
          normalizedType === ResourceType.document
            ? input.uploadedFile?.storageKey.trim() || existingResource.storageKey
            : null,
        tags,
        type: normalizedType,
        isPublished: input.isPublished ?? true,
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

  return {
    id: updated.id,
    previousStorageKey,
  };
}

export async function deleteOfficeResource(input: DeleteOfficeResourceInput) {
  const existingResource = await getScopedResourceRecord(input);

  if (!existingResource) {
    return {
      deleted: false,
      storageKey: null,
    };
  }

  await prisma.resource.delete({
    where: {
      id: existingResource.id,
    },
  });

  return {
    deleted: true,
    storageKey: existingResource.storageKey?.trim() || null,
  };
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
      notes:
        input.notes === undefined
          ? existingVendor.notes?.trim() || null
          : input.notes?.trim() || null,
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
