import { LibraryDocumentVisibility, Prisma } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent, type ActivityLogChange } from "./activity-log";
import { prisma } from "./client";

export type OfficeLibraryScope = "all" | "company" | "office";
export type OfficeLibraryFolderSelection = "all" | "unfiled" | string;

export type OfficeLibrarySummary = {
  totalFolders: number;
  totalDocuments: number;
  pdfDocuments: number;
  unfiledDocuments: number;
  officeOnlyDocuments: number;
};

export type OfficeLibraryFolderNode = {
  id: string;
  name: string;
  description: string;
  parentFolderId: string | null;
  scopeKey: LibraryDocumentVisibility;
  scopeLabel: string;
  isActive: boolean;
  sortOrder: number;
  documentCount: number;
  directDocumentCount: number;
  children: OfficeLibraryFolderNode[];
};

export type OfficeLibraryFolderOption = {
  id: string;
  name: string;
  parentFolderId: string | null;
  depth: number;
  scopeKey: LibraryDocumentVisibility;
  scopeLabel: string;
};

export type OfficeLibraryDocument = {
  id: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number | null;
  summary: string;
  tags: string[];
  category: string;
  visibilityKey: LibraryDocumentVisibility;
  visibilityLabel: string;
  folderId: string | null;
  folderName: string;
  folderPath: string;
  scopeLabel: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
  isPdf: boolean;
  previewUrl: string;
  openUrl: string;
  downloadUrl: string;
};

export type OfficeLibrarySelectedFolder = {
  id: string | null;
  key: OfficeLibraryFolderSelection;
  name: string;
  description: string;
  scopeLabel: string;
  documentCount: number;
};

export type OfficeLibrarySnapshot = {
  summary: OfficeLibrarySummary;
  filters: {
    q: string;
    folderId: OfficeLibraryFolderSelection;
    category: string;
    tag: string;
    scope: OfficeLibraryScope;
  };
  categoryOptions: string[];
  tagOptions: string[];
  folderTree: OfficeLibraryFolderNode[];
  folderOptions: OfficeLibraryFolderOption[];
  selectedFolder: OfficeLibrarySelectedFolder;
  documents: OfficeLibraryDocument[];
  selectedDocument: OfficeLibraryDocument | null;
};

export type GetOfficeLibrarySnapshotInput = {
  organizationId: string;
  officeId?: string | null;
  folderId?: string;
  documentId?: string;
  q?: string;
  category?: string;
  tag?: string;
  scope?: string;
};

export type CreateLibraryFolderInput = {
  organizationId: string;
  currentOfficeId?: string | null;
  actorMembershipId?: string | null;
  name: string;
  description?: string | null;
  parentFolderId?: string | null;
  scope?: LibraryDocumentVisibility;
};

export type UpdateLibraryFolderInput = {
  organizationId: string;
  currentOfficeId?: string | null;
  actorMembershipId?: string | null;
  folderId: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

export type CreateLibraryDocumentInput = {
  organizationId: string;
  currentOfficeId?: string | null;
  actorMembershipId?: string | null;
  folderId?: string | null;
  title: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  pageCount?: number | null;
  summary?: string | null;
  tags?: string[];
  category?: string | null;
  visibility?: LibraryDocumentVisibility;
};

export type UpdateLibraryDocumentInput = {
  organizationId: string;
  currentOfficeId?: string | null;
  actorMembershipId?: string | null;
  documentId: string;
  title?: string;
  folderId?: string | null;
  summary?: string | null;
  tags?: string[];
  category?: string | null;
  visibility?: LibraryDocumentVisibility;
};

type LibraryFolderRecord = Prisma.LibraryFolderGetPayload<{
  include: {
    createdByMembership: {
      include: {
        user: true;
      };
    };
  };
}>;

type LibraryDocumentRecord = Prisma.LibraryDocumentGetPayload<{
  include: {
    folder: true;
    uploadedByMembership: {
      include: {
        user: true;
      };
    };
  };
}>;

type LibraryWriter = Pick<typeof prisma, "libraryFolder" | "libraryDocument">;

const visibilityLabelMap: Record<LibraryDocumentVisibility, string> = {
  company_wide: "Company-wide",
  office_only: "Office only",
  private: "Private"
};

function formatDateTimeValue(date: Date) {
  return date.toISOString();
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeTags(tags: string[] | null | undefined) {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
}

function formatMembershipName(membership: { user: { firstName: string; lastName: string } } | null | undefined) {
  return membership ? `${membership.user.firstName} ${membership.user.lastName}` : "";
}

function normalizeScope(scope: string | undefined, currentOfficeId: string | null | undefined): OfficeLibraryScope {
  if (scope === "company") {
    return "company";
  }

  if (scope === "office" && currentOfficeId) {
    return "office";
  }

  return "all";
}

function getAccessibleOfficeFilter(currentOfficeId: string | null | undefined) {
  return currentOfficeId ? { OR: [{ officeId: null }, { officeId: currentOfficeId }] } : { officeId: null };
}

function matchesScope(recordOfficeId: string | null, scope: OfficeLibraryScope, currentOfficeId: string | null | undefined) {
  if (scope === "company") {
    return recordOfficeId === null;
  }

  if (scope === "office") {
    return Boolean(currentOfficeId) && recordOfficeId === currentOfficeId;
  }

  return recordOfficeId === null || (Boolean(currentOfficeId) && recordOfficeId === currentOfficeId);
}

function getScopeLabelForOfficeId(officeId: string | null, visibility: LibraryDocumentVisibility = getVisibilityForOfficeId(officeId)) {
  if (visibility === LibraryDocumentVisibility.private) {
    return visibilityLabelMap.private;
  }

  return officeId ? visibilityLabelMap.office_only : visibilityLabelMap.company_wide;
}

function getVisibilityForOfficeId(officeId: string | null, preferredVisibility?: LibraryDocumentVisibility) {
  if (preferredVisibility === LibraryDocumentVisibility.private) {
    return LibraryDocumentVisibility.private;
  }

  return officeId ? LibraryDocumentVisibility.office_only : LibraryDocumentVisibility.company_wide;
}

function resolveOfficeIdForVisibility(
  currentOfficeId: string | null | undefined,
  visibility: LibraryDocumentVisibility | undefined
) {
  if (visibility === LibraryDocumentVisibility.private) {
    return null;
  }

  if (visibility === LibraryDocumentVisibility.office_only && currentOfficeId) {
    return currentOfficeId;
  }

  return null;
}

function getDocumentFolderSelection(folderId: string | null) {
  return folderId ?? "unfiled";
}

function buildLibraryContextHref(folderId: OfficeLibraryFolderSelection, documentId?: string | null) {
  const searchParams = new URLSearchParams();

  if (folderId && folderId !== "all") {
    searchParams.set("folderId", folderId);
  }

  if (documentId) {
    searchParams.set("documentId", documentId);
  }

  const query = searchParams.toString();
  return query ? `/office/library?${query}` : "/office/library";
}

function buildLibraryDocumentFileHref(documentId: string, mode?: "preview" | "download") {
  const searchParams = new URLSearchParams();

  if (mode === "preview") {
    searchParams.set("preview", "1");
  }

  if (mode === "download") {
    searchParams.set("download", "1");
  }

  const query = searchParams.toString();
  return query ? `/api/office/library/documents/${documentId}/file?${query}` : `/api/office/library/documents/${documentId}/file`;
}

function buildSearchText(record: LibraryDocumentRecord, folderPath: string) {
  return [
    record.title,
    record.originalFileName,
    record.summary ?? "",
    record.category ?? "",
    record.tags.join(" "),
    folderPath
  ]
    .join(" ")
    .toLowerCase();
}

function buildChanges(previousValue: string, nextValue: string, label: string): ActivityLogChange[] {
  if (previousValue === nextValue) {
    return [];
  }

  return [
    {
      label,
      previousValue,
      nextValue
    }
  ];
}

function sortFolders(a: LibraryFolderRecord, b: LibraryFolderRecord) {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return a.name.localeCompare(b.name);
}

function sortDocuments(a: OfficeLibraryDocument, b: OfficeLibraryDocument) {
  if (a.folderPath !== b.folderPath) {
    return a.folderPath.localeCompare(b.folderPath);
  }

  if (a.title !== b.title) {
    return a.title.localeCompare(b.title);
  }

  return b.updatedAt.localeCompare(a.updatedAt);
}

function mapLibraryDocument(
  record: LibraryDocumentRecord,
  folderPathById: Map<string, string>
): OfficeLibraryDocument {
  const folderPath = record.folderId ? folderPathById.get(record.folderId) ?? record.folder?.name ?? "" : "";

  return {
    id: record.id,
    title: record.title,
    originalFileName: record.originalFileName,
    mimeType: record.mimeType,
    fileSizeBytes: record.fileSizeBytes,
    pageCount: record.pageCount ?? null,
    summary: record.summary ?? "",
    tags: record.tags,
    category: record.category ?? "",
    visibilityKey: record.visibility,
    visibilityLabel: visibilityLabelMap[record.visibility],
    folderId: record.folderId,
    folderName: record.folder?.name ?? "",
    folderPath,
    scopeLabel: getScopeLabelForOfficeId(record.officeId, record.visibility),
    uploadedByName: formatMembershipName(record.uploadedByMembership),
    createdAt: formatDateTimeValue(record.createdAt),
    updatedAt: formatDateTimeValue(record.updatedAt),
    isPdf: record.mimeType.toLowerCase() === "application/pdf",
    previewUrl: buildLibraryDocumentFileHref(record.id, "preview"),
    openUrl: buildLibraryDocumentFileHref(record.id),
    downloadUrl: buildLibraryDocumentFileHref(record.id, "download")
  };
}

function buildFolderPathById(folders: LibraryFolderRecord[]) {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const pathById = new Map<string, string>();

  function getPath(folderId: string): string {
    const existing = pathById.get(folderId);

    if (existing) {
      return existing;
    }

    const folder = folderById.get(folderId);

    if (!folder) {
      return "";
    }

    const parentPath = folder.parentFolderId ? getPath(folder.parentFolderId) : "";
    const path = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
    pathById.set(folderId, path);
    return path;
  }

  for (const folder of folders) {
    getPath(folder.id);
  }

  return pathById;
}

function buildFolderChildrenMap(folders: LibraryFolderRecord[]) {
  const childrenByParentId = new Map<string | null, LibraryFolderRecord[]>();

  for (const folder of folders) {
    const key = folder.parentFolderId ?? null;
    const siblings = childrenByParentId.get(key) ?? [];
    siblings.push(folder);
    childrenByParentId.set(key, siblings);
  }

  for (const siblings of childrenByParentId.values()) {
    siblings.sort(sortFolders);
  }

  return childrenByParentId;
}

function collectDescendantFolderIds(folderId: string, childrenByParentId: Map<string | null, LibraryFolderRecord[]>) {
  const ids = new Set<string>([folderId]);
  const stack = [folderId];

  while (stack.length > 0) {
    const current = stack.pop() ?? null;
    const children = childrenByParentId.get(current) ?? [];

    for (const child of children) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        stack.push(child.id);
      }
    }
  }

  return ids;
}

function buildFolderCounts(
  folders: LibraryFolderRecord[],
  documents: LibraryDocumentRecord[]
) {
  const childrenByParentId = buildFolderChildrenMap(folders);
  const directCounts = new Map<string, number>();

  for (const document of documents) {
    if (!document.folderId) {
      continue;
    }

    directCounts.set(document.folderId, (directCounts.get(document.folderId) ?? 0) + 1);
  }

  const totalCounts = new Map<string, number>();

  function countFolder(folderId: string): number {
    const existing = totalCounts.get(folderId);

    if (typeof existing === "number") {
      return existing;
    }

    const directCount = directCounts.get(folderId) ?? 0;
    const childCount = (childrenByParentId.get(folderId) ?? []).reduce((sum, child) => sum + countFolder(child.id), 0);
    const total = directCount + childCount;
    totalCounts.set(folderId, total);
    return total;
  }

  for (const folder of folders) {
    countFolder(folder.id);
  }

  return {
    childrenByParentId,
    directCounts,
    totalCounts
  };
}

function buildFolderTree(
  folders: LibraryFolderRecord[],
  documents: LibraryDocumentRecord[]
) {
  const { childrenByParentId, directCounts, totalCounts } = buildFolderCounts(folders, documents);

  function mapNode(folder: LibraryFolderRecord): OfficeLibraryFolderNode {
    return {
      id: folder.id,
      name: folder.name,
      description: folder.description ?? "",
      parentFolderId: folder.parentFolderId,
      scopeKey: getVisibilityForOfficeId(folder.officeId, folder.visibility),
      scopeLabel: getScopeLabelForOfficeId(folder.officeId, folder.visibility),
      isActive: folder.isActive,
      sortOrder: folder.sortOrder,
      documentCount: totalCounts.get(folder.id) ?? 0,
      directDocumentCount: directCounts.get(folder.id) ?? 0,
      children: (childrenByParentId.get(folder.id) ?? []).map(mapNode)
    };
  }

  return (childrenByParentId.get(null) ?? []).map(mapNode);
}

function flattenFolderOptions(nodes: OfficeLibraryFolderNode[], depth = 0): OfficeLibraryFolderOption[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      name: node.name,
      parentFolderId: node.parentFolderId,
      depth,
      scopeKey: node.scopeKey,
      scopeLabel: node.scopeLabel
    },
    ...flattenFolderOptions(node.children, depth + 1)
  ]);
}

function getSelectedFolder(
  folders: LibraryFolderRecord[],
  documents: LibraryDocumentRecord[],
  selectedFolderKey: OfficeLibraryFolderSelection
): OfficeLibrarySelectedFolder {
  if (selectedFolderKey === "all") {
    return {
      id: null,
      key: "all",
      name: "All files",
      description: "Company-wide and office-only files available in the current library scope.",
      scopeLabel: "Mixed scope",
      documentCount: documents.length
    };
  }

  if (selectedFolderKey === "unfiled") {
    return {
      id: null,
      key: "unfiled",
      name: "Unfiled documents",
      description: "Files stored in the library without an assigned folder.",
      scopeLabel: "Mixed scope",
      documentCount: documents.filter((document) => !document.folderId).length
    };
  }

  const folder = folders.find((entry) => entry.id === selectedFolderKey) ?? null;

  if (!folder) {
    return {
      id: null,
      key: "all",
      name: "All files",
      description: "Company-wide and office-only files available in the current library scope.",
      scopeLabel: "Mixed scope",
      documentCount: documents.length
    };
  }

  const { totalCounts } = buildFolderCounts(folders, documents);

  return {
    id: folder.id,
    key: folder.id,
    name: folder.name,
    description: folder.description ?? "",
    scopeLabel: getScopeLabelForOfficeId(folder.officeId, folder.visibility),
    documentCount: totalCounts.get(folder.id) ?? 0
  };
}

function matchesSelectedFolder(
  document: LibraryDocumentRecord,
  selectedFolderKey: OfficeLibraryFolderSelection,
  descendants: Set<string> | null
) {
  if (selectedFolderKey === "all") {
    return true;
  }

  if (selectedFolderKey === "unfiled") {
    return document.folderId === null;
  }

  if (!descendants) {
    return false;
  }

  return document.folderId ? descendants.has(document.folderId) : false;
}

async function getAccessibleFolder(
  writer: LibraryWriter,
  organizationId: string,
  currentOfficeId: string | null | undefined,
  folderId: string
) {
  return writer.libraryFolder.findFirst({
    where: {
      id: folderId,
      organizationId,
      isActive: true,
      ...getAccessibleOfficeFilter(currentOfficeId)
    }
  });
}

async function getAccessibleDocument(
  writer: LibraryWriter,
  organizationId: string,
  currentOfficeId: string | null | undefined,
  documentId: string
) {
  return writer.libraryDocument.findFirst({
    where: {
      id: documentId,
      organizationId,
      ...getAccessibleOfficeFilter(currentOfficeId)
    },
    include: {
      folder: true,
      uploadedByMembership: {
        include: {
          user: true
        }
      }
    }
  });
}

function buildDocumentActivityDetails(document: {
  category: string | null;
  pageCount: number | null;
  tags: string[];
}, folderName: string | null, visibility: LibraryDocumentVisibility) {
  return [
    `Folder: ${folderName ?? "Unfiled"}`,
    `Visibility: ${visibilityLabelMap[visibility]}`,
    ...(document.category ? [`Category: ${document.category}`] : []),
    ...(document.pageCount ? [`Page count: ${document.pageCount}`] : []),
    ...(document.tags.length ? [`Tags: ${document.tags.join(", ")}`] : [])
  ];
}

export async function getOfficeLibrarySnapshot(input: GetOfficeLibrarySnapshotInput): Promise<OfficeLibrarySnapshot> {
  const currentOfficeId = input.officeId ?? null;
  const scope = normalizeScope(input.scope, currentOfficeId);
  const requestedFolderKey = normalizeText(input.folderId) || "all";
  const selectedDocumentId = normalizeText(input.documentId);
  const searchTerm = normalizeText(input.q).toLowerCase();
  const selectedCategory = normalizeText(input.category);
  const selectedTag = normalizeText(input.tag).toLowerCase();

  const [folders, allAccessibleDocuments] = await Promise.all([
    prisma.libraryFolder.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        ...getAccessibleOfficeFilter(currentOfficeId)
      },
      include: {
        createdByMembership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.libraryDocument.findMany({
      where: {
        organizationId: input.organizationId,
        ...getAccessibleOfficeFilter(currentOfficeId)
      },
      include: {
        folder: true,
        uploadedByMembership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }, { title: "asc" }]
    })
  ]);

  const scopeFilteredDocuments = allAccessibleDocuments.filter((document) => matchesScope(document.officeId, scope, currentOfficeId));
  const folderPathById = buildFolderPathById(folders);
  const requestedDocument =
    selectedDocumentId.length > 0 ? scopeFilteredDocuments.find((document) => document.id === selectedDocumentId) ?? null : null;
  const requestedFolderSelection =
    requestedFolderKey === "all" && requestedDocument ? getDocumentFolderSelection(requestedDocument.folderId) : requestedFolderKey;
  const effectiveSelectedFolderKey =
    requestedFolderSelection === "all" ||
    requestedFolderSelection === "unfiled" ||
    folders.some((folder) => folder.id === requestedFolderSelection)
      ? requestedFolderSelection
      : "all";
  const folderTree = buildFolderTree(folders, scopeFilteredDocuments);
  const folderOptions = flattenFolderOptions(folderTree);
  const selectedFolder =
    folders.find((folder) => folder.id === effectiveSelectedFolderKey) ?? null;
  const descendantIds =
    selectedFolder && effectiveSelectedFolderKey !== "all" && effectiveSelectedFolderKey !== "unfiled"
      ? collectDescendantFolderIds(selectedFolder.id, buildFolderChildrenMap(folders))
      : null;

  const categoryOptions = [...new Set(scopeFilteredDocuments.map((document) => normalizeText(document.category)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  const tagOptions = [...new Set(scopeFilteredDocuments.flatMap((document) => document.tags))].sort((a, b) => a.localeCompare(b));

  const visibleDocuments = scopeFilteredDocuments
    .filter((document) => matchesSelectedFolder(document, effectiveSelectedFolderKey, descendantIds))
    .filter((document) => (selectedCategory ? normalizeText(document.category) === selectedCategory : true))
    .filter((document) => (selectedTag ? document.tags.some((tag) => tag.toLowerCase() === selectedTag) : true))
    .filter((document) => {
      if (!searchTerm) {
        return true;
      }

      const folderPath = document.folderId ? folderPathById.get(document.folderId) ?? "" : "";
      return buildSearchText(document, folderPath).includes(searchTerm);
    })
    .map((document) => mapLibraryDocument(document, folderPathById))
    .sort(sortDocuments);

  const selectedDocument = selectedDocumentId
    ? visibleDocuments.find((document) => document.id === selectedDocumentId) ?? null
    : null;

  return {
    summary: {
      totalFolders: folders.length,
      totalDocuments: scopeFilteredDocuments.length,
      pdfDocuments: scopeFilteredDocuments.filter((document) => document.mimeType.toLowerCase() === "application/pdf").length,
      unfiledDocuments: scopeFilteredDocuments.filter((document) => !document.folderId).length,
      officeOnlyDocuments: scopeFilteredDocuments.filter((document) => document.visibility === LibraryDocumentVisibility.office_only).length
    },
    filters: {
      q: normalizeText(input.q),
      folderId: effectiveSelectedFolderKey,
      category: selectedCategory,
      tag: normalizeText(input.tag),
      scope
    },
    categoryOptions,
    tagOptions,
    folderTree,
    folderOptions,
    selectedFolder: getSelectedFolder(folders, scopeFilteredDocuments, effectiveSelectedFolderKey),
    documents: visibleDocuments,
    selectedDocument
  };
}

export async function createLibraryFolder(input: CreateLibraryFolderInput) {
  const name = normalizeText(input.name);

  if (!name) {
    throw new Error("Folder name is required.");
  }

  return prisma.$transaction(async (tx) => {
    const parentFolder = input.parentFolderId
      ? await getAccessibleFolder(tx, input.organizationId, input.currentOfficeId ?? null, input.parentFolderId)
      : null;

    if (input.parentFolderId && !parentFolder) {
      throw new Error("Parent folder not found.");
    }

    const officeId = parentFolder
      ? parentFolder.officeId
      : resolveOfficeIdForVisibility(input.currentOfficeId ?? null, input.scope ?? LibraryDocumentVisibility.company_wide);
    const sortOrder = await tx.libraryFolder.count({
      where: {
        organizationId: input.organizationId,
        officeId,
        parentFolderId: parentFolder?.id ?? null
      }
    });

    const created = await tx.libraryFolder.create({
      data: {
        organizationId: input.organizationId,
        officeId,
        parentFolderId: parentFolder?.id ?? null,
        createdByMembershipId: input.actorMembershipId ?? null,
        name,
        description: normalizeOptionalText(input.description),
        sortOrder,
        isActive: true
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? null,
      entityType: "library_folder",
      entityId: created.id,
      action: activityLogActions.libraryFolderCreated,
      payload: {
        officeId,
        objectLabel: created.name,
        details: [
          `Scope: ${getScopeLabelForOfficeId(officeId, created.visibility)}`,
          ...(parentFolder ? [`Parent folder: ${parentFolder.name}`] : [])
        ],
        contextHref: buildLibraryContextHref(created.id)
      }
    });

    return created;
  });
}

export async function updateLibraryFolder(input: UpdateLibraryFolderInput) {
  const folder = await prisma.$transaction(async (tx) => {
    const existing = await getAccessibleFolder(tx, input.organizationId, input.currentOfficeId ?? null, input.folderId);

    if (!existing) {
      return null;
    }

    const nextName = input.name === undefined ? existing.name : normalizeText(input.name) || existing.name;
    const nextDescription =
      input.description === undefined ? existing.description : normalizeOptionalText(input.description);
    const nextIsActive = input.isActive ?? existing.isActive;

    const saved = await tx.libraryFolder.update({
      where: {
        id: existing.id
      },
      data: {
        name: nextName,
        description: nextDescription,
        isActive: nextIsActive
      }
    });

    const changes = [
      ...buildChanges(existing.name, saved.name, "Folder name"),
      ...buildChanges(existing.description ?? "", saved.description ?? "", "Description"),
      ...buildChanges(existing.isActive ? "Active" : "Hidden", saved.isActive ? "Active" : "Hidden", "Status")
    ];

    if (changes.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "library_folder",
        entityId: saved.id,
        action: activityLogActions.libraryFolderUpdated,
        payload: {
          officeId: saved.officeId,
          objectLabel: saved.name,
          changes,
          contextHref: buildLibraryContextHref(saved.id)
        }
      });
    }

    return saved;
  });

  return folder;
}

export async function createLibraryDocument(input: CreateLibraryDocumentInput) {
  const title = normalizeText(input.title) || input.originalFileName;
  const tags = normalizeTags(input.tags);

  return prisma.$transaction(async (tx) => {
    const folder = input.folderId
      ? await getAccessibleFolder(tx, input.organizationId, input.currentOfficeId ?? null, input.folderId)
      : null;

    if (input.folderId && !folder) {
      throw new Error("Folder not found.");
    }

    const officeId = folder
      ? folder.officeId
      : resolveOfficeIdForVisibility(input.currentOfficeId ?? null, input.visibility ?? LibraryDocumentVisibility.company_wide);
    const visibility = getVisibilityForOfficeId(officeId, input.visibility ?? LibraryDocumentVisibility.company_wide);
    const sortOrder = await tx.libraryDocument.count({
      where: {
        organizationId: input.organizationId,
        officeId,
        folderId: folder?.id ?? null
      }
    });

    const created = await tx.libraryDocument.create({
      data: {
        organizationId: input.organizationId,
        officeId,
        folderId: folder?.id ?? null,
        uploadedByMembershipId: input.actorMembershipId ?? null,
        title,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        storageKey: input.storageKey,
        pageCount: input.pageCount ?? null,
        summary: normalizeOptionalText(input.summary),
        tags,
        category: normalizeOptionalText(input.category),
        visibility,
        sortOrder
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? null,
      entityType: "library_document",
      entityId: created.id,
      action: activityLogActions.documentUploaded,
      payload: {
        officeId,
        objectLabel: created.title,
        details: buildDocumentActivityDetails(created, folder?.name ?? null, created.visibility),
        contextHref: buildLibraryContextHref(getDocumentFolderSelection(created.folderId), created.id)
      }
    });

    return created;
  });
}

export async function updateLibraryDocument(input: UpdateLibraryDocumentInput) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await getAccessibleDocument(tx, input.organizationId, input.currentOfficeId ?? null, input.documentId);

    if (!existing) {
      return null;
    }

    const nextFolder =
      input.folderId === undefined
        ? existing.folder
        : input.folderId
          ? await getAccessibleFolder(tx, input.organizationId, input.currentOfficeId ?? null, input.folderId)
          : null;

    if (input.folderId && !nextFolder) {
      throw new Error("Destination folder not found.");
    }

    const nextOfficeId =
      input.folderId === undefined
        ? existing.officeId
        : nextFolder
          ? nextFolder.officeId
          : resolveOfficeIdForVisibility(input.currentOfficeId ?? null, input.visibility ?? existing.visibility);
    const nextVisibility = getVisibilityForOfficeId(nextOfficeId, input.visibility ?? existing.visibility);
    const nextTitle = input.title === undefined ? existing.title : normalizeText(input.title) || existing.title;
    const nextSummary =
      input.summary === undefined ? existing.summary : normalizeOptionalText(input.summary);
    const nextCategory =
      input.category === undefined ? existing.category : normalizeOptionalText(input.category);
    const nextTags = input.tags === undefined ? existing.tags : normalizeTags(input.tags);

    const saved = await tx.libraryDocument.update({
      where: {
        id: existing.id
      },
      data: {
        officeId: nextOfficeId,
        folderId: input.folderId === undefined ? existing.folderId : nextFolder?.id ?? null,
        title: nextTitle,
        summary: nextSummary,
        category: nextCategory,
        tags: nextTags,
        visibility: nextVisibility
      },
      include: {
        folder: true,
        uploadedByMembership: {
          include: {
            user: true
          }
        }
      }
    });

    const changes = [
      ...buildChanges(existing.title, saved.title, "Title"),
      ...buildChanges(existing.folder?.name ?? "Unfiled", nextFolder?.name ?? "Unfiled", "Folder"),
      ...buildChanges(existing.category ?? "", saved.category ?? "", "Category"),
      ...buildChanges(existing.summary ?? "", saved.summary ?? "", "Summary"),
      ...buildChanges(visibilityLabelMap[existing.visibility], visibilityLabelMap[saved.visibility], "Visibility"),
      ...buildChanges(existing.tags.join(", "), saved.tags.join(", "), "Tags")
    ];

    if (changes.length) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId ?? null,
        entityType: "library_document",
        entityId: saved.id,
        action: activityLogActions.documentUpdated,
        payload: {
          officeId: saved.officeId,
          objectLabel: saved.title,
          changes,
          details: buildDocumentActivityDetails(saved, nextFolder?.name ?? null, saved.visibility),
          contextHref: buildLibraryContextHref(getDocumentFolderSelection(saved.folderId), saved.id)
        }
      });
    }

    return saved;
  });

  return updated;
}

export async function deleteLibraryDocument(
  organizationId: string,
  currentOfficeId: string | null | undefined,
  documentId: string,
  actorMembershipId?: string | null
) {
  return prisma.$transaction(async (tx) => {
    const existing = await getAccessibleDocument(tx, organizationId, currentOfficeId, documentId);

    if (!existing) {
      return null;
    }

    await tx.libraryDocument.delete({
      where: {
        id: existing.id
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId,
      membershipId: actorMembershipId ?? null,
      entityType: "library_document",
      entityId: existing.id,
      action: activityLogActions.documentDeleted,
      payload: {
        officeId: existing.officeId,
        objectLabel: existing.title,
        details: [
          `File: ${existing.originalFileName}`,
          `Folder: ${existing.folder?.name ?? "Unfiled"}`
        ],
        contextHref: buildLibraryContextHref(getDocumentFolderSelection(existing.folderId))
      }
    });

    return {
      id: existing.id,
      storageKey: existing.storageKey
    };
  });
}

export async function getLibraryDocumentStorageRecord(
  organizationId: string,
  currentOfficeId: string | null | undefined,
  documentId: string
) {
  return prisma.libraryDocument.findFirst({
    where: {
      id: documentId,
      organizationId,
      ...getAccessibleOfficeFilter(currentOfficeId)
    },
    select: {
      id: true,
      title: true,
      originalFileName: true,
      mimeType: true,
      storageKey: true,
      folderId: true,
      folder: {
        select: {
          id: true,
          name: true
        }
      },
      officeId: true
    }
  });
}

export async function recordLibraryDocumentOpened(
  organizationId: string,
  currentOfficeId: string | null | undefined,
  actorMembershipId: string | null | undefined,
  documentId: string
) {
  const document = await getAccessibleDocument(prisma, organizationId, currentOfficeId, documentId);

  if (!document) {
    return;
  }

  await recordActivityLogEvent(prisma, {
    organizationId,
    membershipId: actorMembershipId ?? null,
    entityType: "library_document",
    entityId: document.id,
    action: activityLogActions.documentOpened,
    payload: {
      officeId: document.officeId,
      objectLabel: document.title,
      details: [`File: ${document.originalFileName}`],
      contextHref: buildLibraryContextHref(getDocumentFolderSelection(document.folderId), document.id)
    }
  });
}
