"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button, ConfirmActionDialog, EmptyState, FilterBar, FilterField, SecondaryMetaList, SelectInput, TextInput, TextareaInput } from "@acre/ui";
import type {
  OfficeLibraryDocument,
  OfficeLibraryFolderNode,
  OfficeLibraryFolderOption,
  OfficeLibrarySnapshot
} from "@acre/db";
import { useI18n } from "../../../lib/i18n/client";

type OfficeLibraryClientProps = {
  snapshot: OfficeLibrarySnapshot;
  canManageLibrary: boolean;
};

type FolderResponse = {
  folder: {
    id: string;
  };
};

type DocumentResponse = {
  document: {
    id: string;
    folderId: string | null;
  };
};

type PdfMetadata = {
  pageCount: number | null;
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
};

type PdfMetadataResponse = {
  document: {
    id: string;
    isPdf: boolean;
    pdfMetadata: PdfMetadata | null;
  };
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildFolderLabel(option: OfficeLibraryFolderOption) {
  return `${"  ".repeat(option.depth)}${option.name}`;
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getFolderSelection(documentFolderId: string | null) {
  return documentFolderId ?? "unfiled";
}

function hasPdfMetadataDetails(metadata: PdfMetadata | null) {
  if (!metadata) {
    return false;
  }

  return Boolean(
    metadata.title ||
      metadata.author ||
      metadata.subject ||
      metadata.creator ||
      metadata.producer ||
      metadata.creationDate ||
      metadata.modificationDate ||
      metadata.keywords.length
  );
}

export function OfficeLibraryClient({ snapshot, canManageLibrary }: OfficeLibraryClientProps) {
  const { t, formatDateTime } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(
    Object.fromEntries(
      snapshot.folderOptions
        .filter((option) => snapshot.folderTree.some((node) => node.id === option.id || option.depth > 0))
        .map((option) => [option.id, true])
    )
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isRoutingPending, startRoutingTransition] = useTransition();
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [pdfMetadata, setPdfMetadata] = useState<PdfMetadata | null>(null);
  const [pdfMetadataStatus, setPdfMetadataStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  function getScopeLabel(value: string | null | undefined) {
    switch (value) {
      case "company_wide":
      case "Company-wide":
        return t((messages) => messages.officeLibrary.scopeCompanyWide);
      case "office_only":
      case "Office only":
        return t((messages) => messages.officeLibrary.scopeOfficeOnly);
      case "private":
      case "Private":
        return t((messages) => messages.officeLibrary.scopePrivate);
      default:
        return value ?? "";
    }
  }

  function getDocumentFolderLabel(value: string | null | undefined) {
    return value || t((messages) => messages.officeLibrary.unfiled);
  }

  function getDocumentCategoryLabel(value: string | null | undefined) {
    return value || t((messages) => messages.officeLibrary.general);
  }

  function getDocumentUploadedByLabel(value: string | null | undefined) {
    return value || t((messages) => messages.officeLibrary.system);
  }

  function getDocumentPageLabel(document: OfficeLibraryDocument) {
    if (document.pageCount) {
      return t((messages) => messages.officeLibrary.pageCount, {
        count: document.pageCount,
      });
    }

    if (document.isPdf) {
      return t((messages) => messages.officeLibrary.pdfFileType);
    }

    return t((messages) => messages.officeLibrary.genericFileType);
  }

  function buildLibraryUrl(updates: Record<string, string | null>) {
    const nextParams = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value && value.trim().length > 0) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    }

    const query = nextParams.toString();
    return query ? `/office/library?${query}` : "/office/library";
  }

  function navigate(updates: Record<string, string | null>) {
    startRoutingTransition(() => {
      router.replace(buildLibraryUrl(updates), { scroll: false });
    });
  }

  function refreshView(updates: Record<string, string | null>) {
    startRoutingTransition(() => {
      router.replace(buildLibraryUrl(updates), { scroll: false });
      router.refresh();
    });
  }

  function closeDocumentPreview() {
    navigate({
      documentId: null
    });
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !current[folderId]
    }));
  }

  async function handleCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-folder");
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/office/library/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          description: String(formData.get("description") ?? "").trim() || null,
          parentFolderId: String(formData.get("parentFolderId") ?? "").trim() || null,
          scope: String(formData.get("scope") ?? "company_wide")
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? t((messages) => messages.officeLibrary.errorFolderCreateFailed));
      }

      const payload = (await response.json()) as FolderResponse;
      setIsCreateFolderOpen(false);
      refreshView({
        folderId: payload.folder.id,
        documentId: null
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t((messages) => messages.officeLibrary.errorFolderCreateFailed));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRenameFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!snapshot.selectedFolder.id) {
      return;
    }

    setPendingAction("rename-folder");
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/office/library/folders/${snapshot.selectedFolder.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          description: String(formData.get("description") ?? "").trim() || null
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? t((messages) => messages.officeLibrary.errorFolderUpdateFailed));
      }

      refreshView({});
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t((messages) => messages.officeLibrary.errorFolderUpdateFailed));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("upload-document");
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/office/library/documents", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? t((messages) => messages.officeLibrary.errorDocumentUploadFailed));
      }

      const payload = (await response.json()) as DocumentResponse;
      setIsUploadOpen(false);
      refreshView({
        folderId: getFolderSelection(payload.document.folderId),
        documentId: payload.document.id
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t((messages) => messages.officeLibrary.errorDocumentUploadFailed));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!snapshot.selectedDocument) {
      return;
    }

    setPendingAction("save-document");
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/office/library/documents/${snapshot.selectedDocument.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          folderId: String(formData.get("folderId") ?? "").trim() || null,
          category: String(formData.get("category") ?? "").trim() || null,
          summary: String(formData.get("summary") ?? "").trim() || null,
          visibility: String(formData.get("visibility") ?? "company_wide"),
          tags: parseTags(String(formData.get("tags") ?? ""))
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? t((messages) => messages.officeLibrary.errorDocumentUpdateFailed));
      }

      const payload = (await response.json()) as DocumentResponse;
      refreshView({
        folderId: getFolderSelection(payload.document.folderId),
        documentId: payload.document.id
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t((messages) => messages.officeLibrary.errorDocumentUpdateFailed));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteDocument() {
    if (!snapshot.selectedDocument) {
      return;
    }

    setPendingAction("delete-document");
    setError("");

    try {
      const response = await fetch(`/api/office/library/documents/${snapshot.selectedDocument.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? t((messages) => messages.officeLibrary.errorDocumentDeleteFailed));
      }

      refreshView({
        documentId: null
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t((messages) => messages.officeLibrary.errorDocumentDeleteFailed));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleArchiveFolder() {
    if (!snapshot.selectedFolder.id) {
      return;
    }

    setPendingAction("archive-folder");
    setError("");

    try {
      const response = await fetch(`/api/office/library/folders/${snapshot.selectedFolder.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isActive: false
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? t((messages) => messages.officeLibrary.errorFolderArchiveFailed));
      }

      refreshView({
        folderId: snapshot.selectedFolder.parentFolderId,
        documentId: null
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t((messages) => messages.officeLibrary.errorFolderArchiveFailed));
    } finally {
      setPendingAction(null);
    }
  }

  const selectedDocument = snapshot.selectedDocument;
  const selectedFolderIsManaged =
    snapshot.selectedFolder.id !== null && snapshot.selectedFolder.key !== "all" && snapshot.selectedFolder.key !== "unfiled";
  const showAllFilesGroup = snapshot.filters.folderId === "all";
  const showUnfiledGroup = snapshot.filters.folderId === "unfiled";
  const selectedDocumentPreviewUrl =
    selectedDocument && selectedDocument.isPdf
      ? `${selectedDocument.previewUrl}#toolbar=0&navpanes=0&view=FitH`
      : selectedDocument?.previewUrl ?? "";
  const selectedDocumentPageCount =
    selectedDocument && selectedDocument.isPdf
      ? pdfMetadata?.pageCount ?? selectedDocument.pageCount
      : selectedDocument?.pageCount ?? null;
  const selectedDocumentKeywordTags =
    selectedDocument && selectedDocument.tags.length === 0 && pdfMetadata?.keywords.length
      ? pdfMetadata.keywords
      : selectedDocument?.tags ?? [];
  const selectedDocumentHasEmbeddedPdfMetadata = hasPdfMetadataDetails(pdfMetadata);

  useEffect(() => {
    if (!selectedDocument?.isPdf) {
      setPdfMetadata(null);
      setPdfMetadataStatus("idle");
      return;
    }

    const abortController = new AbortController();
    setPdfMetadata(null);
    setPdfMetadataStatus("loading");

    void fetch(`/api/office/library/documents/${selectedDocument.id}`, {
      method: "GET",
      signal: abortController.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(t((messages) => messages.officeLibrary.errorPdfMetadataRequestFailed));
        }

        const payload = (await response.json()) as PdfMetadataResponse;
        setPdfMetadata(payload.document.pdfMetadata);
        setPdfMetadataStatus("ready");
      })
      .catch((requestError) => {
        if (abortController.signal.aborted) {
          return;
        }

        console.error(requestError);
        setPdfMetadata(null);
        setPdfMetadataStatus("error");
      });

    return () => {
      abortController.abort();
    };
  }, [selectedDocument?.id, selectedDocument?.isPdf]);

  function renderVisibleDocuments(documents: OfficeLibraryDocument[]) {
    if (!documents.length) {
      return (
        <div className="office-library-inline-empty">
          <strong>{t((messages) => messages.officeLibrary.noFilesTitle)}</strong>
          <span>{t((messages) => messages.officeLibrary.noFilesBody)}</span>
        </div>
      );
    }

    return (
      <div className="office-library-folder-documents">
        {documents.map((document) => {
          const isSelected = selectedDocument?.id === document.id;
          const secondaryParts = [document.originalFileName];

          if (document.folderName && snapshot.filters.folderId === "all") {
            secondaryParts.push(document.folderName);
          }

          if (document.category) {
            secondaryParts.push(document.category);
          }

          return (
            <button
              className={`office-library-document-entry${isSelected ? " is-selected" : ""}`}
              key={document.id}
              onClick={() =>
                navigate({
                  documentId: document.id
                })
              }
              type="button"
            >
              <div className="office-library-document-entry-main">
                <strong>{document.title}</strong>
                <p>{secondaryParts.join(" · ")}</p>
              </div>

              <div className="office-library-document-entry-trailing">
                <span className="office-library-document-chip">
                  {getDocumentPageLabel(document)}
                </span>
                <span className="office-library-document-meta">{formatFileSize(document.fileSizeBytes)}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderFolderNodes(nodes: OfficeLibraryFolderNode[]) {
    return nodes.map((node) => {
      const isExpanded = expandedFolders[node.id] ?? true;
      const isSelected = snapshot.filters.folderId === node.id;

      return (
        <div className="office-library-folder-node" key={node.id}>
          <div className={`office-library-folder-row${isSelected ? " is-selected" : ""}`}>
            {node.children.length ? (
              <button className="office-library-folder-toggle" onClick={() => toggleFolder(node.id)} type="button">
                {isExpanded ? "▾" : "▸"}
              </button>
            ) : (
              <span className="office-library-folder-toggle is-placeholder">•</span>
            )}

            <button
              className="office-library-folder-button"
              onClick={() =>
                navigate({
                  folderId: node.id,
                  documentId: null
                })
              }
              type="button"
            >
              <span className="office-library-folder-button-main">
                <span className="office-library-folder-name">{node.name}</span>
              </span>
              <span className="office-library-folder-count">{node.documentCount}</span>
            </button>
          </div>

          {isSelected && isExpanded ? renderVisibleDocuments(snapshot.documents) : null}
          {node.children.length && isExpanded ? <div className="office-library-folder-children">{renderFolderNodes(node.children)}</div> : null}
        </div>
      );
    });
  }

  return (
    <>
      <section className="office-section-card office-library-toolbar-card">
        <div className="office-library-toolbar-top">
          <div className="office-library-stats">
            <span>{t((messages) => messages.officeLibrary.statsFiles, { count: snapshot.summary.totalDocuments })}</span>
            <span>{t((messages) => messages.officeLibrary.statsFolders, { count: snapshot.summary.totalFolders })}</span>
            <span>{t((messages) => messages.officeLibrary.statsPdfs, { count: snapshot.summary.pdfDocuments })}</span>
            <span>{t((messages) => messages.officeLibrary.statsUnfiled, { count: snapshot.summary.unfiledDocuments })}</span>
          </div>

          {canManageLibrary ? (
            <div className="office-library-toolbar-actions">
              <Button onClick={() => setIsUploadOpen(true)} variant="secondary">
                {t((messages) => messages.officeLibrary.uploadFile)}
              </Button>
              <Button onClick={() => setIsCreateFolderOpen(true)}>{t((messages) => messages.officeLibrary.addFolder)}</Button>
            </div>
          ) : null}
        </div>

        <FilterBar as="form" className="office-library-filter-bar" method="get">
          <input name="folderId" type="hidden" value={snapshot.filters.folderId === "all" ? "" : snapshot.filters.folderId} />

          <FilterField className="office-library-search-field" label={t((messages) => messages.officeLibrary.searchLabel)}>
            <TextInput defaultValue={snapshot.filters.q} name="q" placeholder={t((messages) => messages.officeLibrary.searchPlaceholder)} />
          </FilterField>

          <FilterField className="office-library-filter-field" label={t((messages) => messages.officeLibrary.scopeLabel)}>
            <SelectInput defaultValue={snapshot.filters.scope} name="scope">
              <option value="all">{t((messages) => messages.officeLibrary.allScopes)}</option>
              <option value="company">{t((messages) => messages.officeLibrary.scopeCompanyWide)}</option>
              <option value="office">{t((messages) => messages.officeLibrary.scopeOfficeOnly)}</option>
            </SelectInput>
          </FilterField>

          <FilterField className="office-library-filter-field" label={t((messages) => messages.officeLibrary.categoryLabel)}>
            <SelectInput defaultValue={snapshot.filters.category} name="category">
              <option value="">{t((messages) => messages.officeLibrary.allCategories)}</option>
              {snapshot.categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField className="office-library-filter-field" label={t((messages) => messages.officeLibrary.tagLabel)}>
            <SelectInput defaultValue={snapshot.filters.tag} name="tag">
              <option value="">{t((messages) => messages.officeLibrary.allTags)}</option>
              {snapshot.tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <div className="office-library-filter-actions">
            <Button type="submit" variant="secondary">
              {t((messages) => messages.common.applyFilters)}
            </Button>
            <Link className="office-button-secondary" href="/office/library">
              {t((messages) => messages.common.reset)}
            </Link>
          </div>
        </FilterBar>
      </section>

        {error ? <p className="office-form-error">{error}</p> : null}

      <section className="office-section-card office-library-browser-sheet">
        <div className="office-library-browser-head">
          <div>
            <h3>{t((messages) => messages.officeLibrary.browserTitle)}</h3>
            <p>{t((messages) => messages.officeLibrary.browserSubtitle)}</p>
          </div>
        </div>

        <div className="office-library-folder-tree">
          <div className="office-library-folder-group">
            <button
              className={`office-library-folder-button office-library-folder-button-root${showAllFilesGroup ? " is-selected" : ""}`}
              onClick={() =>
                navigate({
                  folderId: null,
                  documentId: null
                })
              }
              type="button"
            >
              <span className="office-library-folder-button-main">
                <span className="office-library-folder-name">{t((messages) => messages.officeLibrary.allFiles)}</span>
              </span>
              <span className="office-library-folder-count">{snapshot.summary.totalDocuments}</span>
            </button>

            {showAllFilesGroup ? renderVisibleDocuments(snapshot.documents) : null}
          </div>

          <div className="office-library-folder-group">
            <button
              className={`office-library-folder-button office-library-folder-button-root${showUnfiledGroup ? " is-selected" : ""}`}
              onClick={() =>
                navigate({
                  folderId: "unfiled",
                  documentId: null
                })
              }
              type="button"
            >
              <span className="office-library-folder-button-main">
                <span className="office-library-folder-name">{t((messages) => messages.officeLibrary.unfiledDocuments)}</span>
              </span>
              <span className="office-library-folder-count">{snapshot.summary.unfiledDocuments}</span>
            </button>

            {showUnfiledGroup ? renderVisibleDocuments(snapshot.documents) : null}
          </div>

          {snapshot.folderTree.length ? (
            <div className="office-library-folder-branch">{renderFolderNodes(snapshot.folderTree)}</div>
          ) : (
            <EmptyState description={t((messages) => messages.officeLibrary.noFoldersBody)} title={t((messages) => messages.officeLibrary.noFoldersTitle)} />
          )}
        </div>

        {selectedFolderIsManaged && !selectedDocument ? (
          <section className="office-library-folder-settings">
            <div className="office-library-panel-head">
              <div>
                <h3>{snapshot.selectedFolder.name}</h3>
                <span>{getScopeLabel(snapshot.selectedFolder.scopeLabel)}</span>
              </div>
            </div>

            <p className="office-library-folder-description">
              {snapshot.selectedFolder.description || t((messages) => messages.officeLibrary.folderDescriptionFallback)}
            </p>

            <SecondaryMetaList
              className="office-library-meta-list"
              items={[
                { label: t((messages) => messages.officeLibrary.folderMetaFolder), value: snapshot.selectedFolder.name },
                { label: t((messages) => messages.officeLibrary.folderMetaScope), value: getScopeLabel(snapshot.selectedFolder.scopeLabel) },
                { label: t((messages) => messages.officeLibrary.folderMetaFilesInView), value: String(snapshot.selectedFolder.documentCount) },
                { label: t((messages) => messages.officeLibrary.folderMetaActiveSubfolders), value: String(snapshot.selectedFolder.childFolderCount) },
                { label: t((messages) => messages.officeLibrary.folderMetaStatus), value: snapshot.selectedFolder.isActive ? t((messages) => messages.common.active) : t((messages) => messages.officeLibrary.archived) }
              ]}
            />

            {canManageLibrary ? (
              <form className="office-library-side-form" key={snapshot.selectedFolder.id} onSubmit={handleRenameFolder}>
                <div className="office-library-side-form-head">
                  <strong>{t((messages) => messages.officeLibrary.folderDetailsTitle)}</strong>
                  <span>{t((messages) => messages.officeLibrary.folderDetailsBody)}</span>
                </div>

                <label className="office-form-field">
                  <span>{t((messages) => messages.officeLibrary.folderName)}</span>
                  <TextInput defaultValue={snapshot.selectedFolder.name} name="name" />
                </label>

                <label className="office-form-field">
                  <span>{t((messages) => messages.officeLibrary.descriptionLabel)}</span>
                  <TextareaInput defaultValue={snapshot.selectedFolder.description} name="description" rows={4} />
                </label>

                <div className="office-library-side-actions">
                  <Button disabled={pendingAction === "rename-folder"} size="sm" type="submit">
                    {pendingAction === "rename-folder" ? t((messages) => messages.officeLibrary.savingFolder) : t((messages) => messages.officeLibrary.saveFolder)}
                  </Button>
                  <Button
                    disabled={!snapshot.selectedFolder.canArchive || pendingAction === "archive-folder"}
                    onClick={() =>
                      setConfirmDialog({
                        title: t((messages) => messages.officeLibrary.archiveFolderTitle, {
                          name: snapshot.selectedFolder.name,
                        }),
                        description: t((messages) => messages.officeLibrary.archiveFolderBody),
                        confirmLabel: t((messages) => messages.officeLibrary.archiveFolder),
                        onConfirm: () => {
                          void handleArchiveFolder();
                        }
                      })
                    }
                    size="sm"
                    type="button"
                    variant="danger"
                  >
                    {pendingAction === "archive-folder" ? t((messages) => messages.officeLibrary.archivingFolder) : t((messages) => messages.officeLibrary.archiveFolder)}
                  </Button>
                </div>

                {!snapshot.selectedFolder.canArchive ? (
                  <p className="office-form-helper">{snapshot.selectedFolder.archiveReason}</p>
                ) : (
                  <p className="office-form-helper">{t((messages) => messages.officeLibrary.archiveFolderHelperSafe)}</p>
                )}
              </form>
            ) : null}
          </section>
        ) : null}
      </section>

      {selectedDocument ? (
        <div className="office-modal-overlay" onClick={closeDocumentPreview}>
          <section className="office-modal office-library-preview-modal" onClick={(event) => event.stopPropagation()}>
            <header className="office-modal-header">
              <div>
                <h3>{selectedDocument.title}</h3>
                <p>
                  {getScopeLabel(selectedDocument.visibilityKey)} · {getDocumentFolderLabel(selectedDocument.folderName)}
                </p>
              </div>

              <div className="office-library-preview-actions">
                <Link className="office-button-secondary office-inline-action" href={selectedDocument.openUrl} target="_blank">
                  {t((messages) => messages.officeLibrary.openDocument)}
                </Link>
                <Link
                  className="office-button-secondary office-inline-action"
                  href={selectedDocument.downloadUrl}
                  target="_blank"
                >
                  {t((messages) => messages.officeLibrary.downloadDocument)}
                </Link>
                {canManageLibrary ? (
                  <Button
                    className="office-inline-action"
                    disabled={pendingAction === "delete-document"}
                    onClick={() =>
                      setConfirmDialog({
                        title: t((messages) => messages.officeLibrary.deleteDocumentTitle, {
                          name: selectedDocument.title,
                        }),
                        description: t((messages) => messages.officeLibrary.deleteDocumentBody),
                        confirmLabel: t((messages) => messages.officeLibrary.deleteDocument),
                        onConfirm: () => {
                          void handleDeleteDocument();
                        }
                      })
                    }
                    type="button"
                    variant="danger"
                  >
                    {pendingAction === "delete-document" ? t((messages) => messages.officeLibrary.deletingDocument) : t((messages) => messages.officeLibrary.deleteDocument)}
                  </Button>
                ) : null}
                <button
                  aria-label={t((messages) => messages.officeLibrary.previewCloseAria)}
                  className="office-library-preview-close"
                  onClick={closeDocumentPreview}
                  type="button"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="office-library-preview-modal-body">
              <div className="office-library-preview-frame-wrap office-library-preview-frame-wrap-modal">
                {selectedDocument.isPdf ? (
                  <iframe
                    className="office-library-preview-frame office-library-preview-frame-modal"
                    src={selectedDocumentPreviewUrl}
                    title={selectedDocument.title}
                  />
                ) : (
                  <EmptyState
                    description={t((messages) => messages.officeLibrary.previewUnavailableBody)}
                    title={t((messages) => messages.officeLibrary.previewUnavailableTitle)}
                  />
                )}
              </div>

              <details className="office-library-preview-details">
                <summary>{t((messages) => messages.officeLibrary.documentDetailsSummary)}</summary>

                <div className={`office-library-preview-details-body${canManageLibrary ? " is-manageable" : ""}`}>
                  <div className="office-library-preview-details-meta">
                    <SecondaryMetaList
                      className="office-library-meta-list"
                      items={[
                        { label: t((messages) => messages.officeLibrary.fileLabel), value: selectedDocument.originalFileName },
                        { label: t((messages) => messages.officeLibrary.folderLabel), value: getDocumentFolderLabel(selectedDocument.folderName) },
                        { label: t((messages) => messages.officeLibrary.categoryLabel), value: getDocumentCategoryLabel(selectedDocument.category) },
                        { label: t((messages) => messages.officeLibrary.scopeLabel), value: getScopeLabel(selectedDocument.visibilityKey) },
                        { label: t((messages) => messages.officeLibrary.sizeLabel), value: formatFileSize(selectedDocument.fileSizeBytes) },
                        {
                          label: t((messages) => messages.officeLibrary.pagesLabel),
                          value:
                            selectedDocumentPageCount !== null
                              ? String(selectedDocumentPageCount)
                              : pdfMetadataStatus === "loading"
                                ? t((messages) => messages.officeLibrary.readingPdf)
                                : t((messages) => messages.officeLibrary.notIndexed)
                        },
                        { label: t((messages) => messages.officeLibrary.uploadedByLabel), value: getDocumentUploadedByLabel(selectedDocument.uploadedByName) },
                        { label: t((messages) => messages.officeLibrary.updatedLabel), value: formatDateTime(selectedDocument.updatedAt) }
                      ]}
                    />

                    {selectedDocumentKeywordTags.length ? (
                      <div className="office-library-tag-list">
                        {selectedDocumentKeywordTags.map((tag) => (
                          <span className="office-badge office-badge-neutral" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {selectedDocument.isPdf ? (
                      <div className="office-library-preview-pdf-metadata">
                        <strong>{t((messages) => messages.officeLibrary.pdfMetadataTitle)}</strong>
                        {pdfMetadataStatus === "loading" ? <p className="office-form-helper">{t((messages) => messages.officeLibrary.readingPdfMetadata)}</p> : null}
                        {pdfMetadataStatus === "error" || (pdfMetadataStatus === "ready" && pdfMetadata === null) ? (
                          <p className="office-form-helper">{t((messages) => messages.officeLibrary.pdfMetadataUnavailable)}</p>
                        ) : null}
                        {pdfMetadataStatus === "ready" && selectedDocumentHasEmbeddedPdfMetadata ? (
                          <SecondaryMetaList
                            className="office-library-meta-list"
                            items={[
                              ...(pdfMetadata?.title ? [{ label: t((messages) => messages.officeLibrary.embeddedTitle), value: pdfMetadata.title }] : []),
                              ...(pdfMetadata?.subject ? [{ label: t((messages) => messages.officeLibrary.embeddedSubject), value: pdfMetadata.subject }] : []),
                              ...(pdfMetadata?.author ? [{ label: t((messages) => messages.officeLibrary.embeddedAuthor), value: pdfMetadata.author }] : []),
                              ...(pdfMetadata?.creator ? [{ label: t((messages) => messages.officeLibrary.embeddedCreator), value: pdfMetadata.creator }] : []),
                              ...(pdfMetadata?.producer ? [{ label: t((messages) => messages.officeLibrary.embeddedProducer), value: pdfMetadata.producer }] : []),
                              ...(pdfMetadata?.creationDate ? [{ label: t((messages) => messages.officeLibrary.embeddedCreated), value: formatDateTime(pdfMetadata.creationDate) }] : []),
                              ...(pdfMetadata?.modificationDate ? [{ label: t((messages) => messages.officeLibrary.embeddedModified), value: formatDateTime(pdfMetadata.modificationDate) }] : [])
                            ]}
                          />
                        ) : null}
                        {pdfMetadataStatus === "ready" && pdfMetadata !== null && !selectedDocumentHasEmbeddedPdfMetadata ? (
                          <p className="office-form-helper">{t((messages) => messages.officeLibrary.pdfMetadataEmpty)}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {canManageLibrary ? (
                    <form className="office-library-side-form" key={selectedDocument.id} onSubmit={handleSaveDocument}>
                      <div className="office-library-side-form-head">
                        <strong>{t((messages) => messages.officeLibrary.documentDetailsTitle)}</strong>
                        <span>{t((messages) => messages.officeLibrary.documentDetailsBody)}</span>
                      </div>

                      <label className="office-form-field">
                        <span>{t((messages) => messages.officeLibrary.titleLabel)}</span>
                        <TextInput defaultValue={selectedDocument.title} name="title" />
                      </label>

                      <label className="office-form-field">
                        <span>{t((messages) => messages.officeLibrary.folderLabel)}</span>
                        <SelectInput defaultValue={selectedDocument.folderId ?? ""} name="folderId">
                          <option value="">{t((messages) => messages.officeLibrary.unfiled)}</option>
                          {snapshot.folderOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {buildFolderLabel(option)}
                            </option>
                          ))}
                        </SelectInput>
                      </label>

                      <label className="office-form-field">
                        <span>{t((messages) => messages.officeLibrary.categoryField)}</span>
                        <TextInput defaultValue={selectedDocument.category} name="category" placeholder={t((messages) => messages.officeLibrary.categoryPlaceholder)} />
                      </label>

                      <label className="office-form-field">
                        <span>{t((messages) => messages.officeLibrary.visibilityField)}</span>
                        <SelectInput defaultValue={selectedDocument.visibilityKey} name="visibility">
                          <option value="company_wide">{t((messages) => messages.officeLibrary.scopeCompanyWide)}</option>
                          <option value="office_only">{t((messages) => messages.officeLibrary.scopeOfficeOnly)}</option>
                        </SelectInput>
                      </label>

                      <label className="office-form-field">
                        <span>{t((messages) => messages.officeLibrary.tagsField)}</span>
                        <TextInput defaultValue={selectedDocument.tags.join(", ")} name="tags" placeholder={t((messages) => messages.officeLibrary.tagsPlaceholder)} />
                      </label>

                      <label className="office-form-field">
                        <span>{t((messages) => messages.officeLibrary.summaryField)}</span>
                        <TextareaInput defaultValue={selectedDocument.summary} name="summary" rows={5} />
                      </label>

                      <div className="office-library-side-actions">
                        <Button disabled={pendingAction === "save-document"} size="sm" type="submit">
                          {pendingAction === "save-document" ? t((messages) => messages.common.saving) : t((messages) => messages.officeLibrary.saveDocument)}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </details>
            </div>
          </section>
        </div>
      ) : null}

      {canManageLibrary && isCreateFolderOpen ? (
        <div className="office-modal-overlay" onClick={() => setIsCreateFolderOpen(false)}>
          <section className="office-modal office-library-modal" onClick={(event) => event.stopPropagation()}>
            <header className="office-modal-header">
              <div>
                <h3>{t((messages) => messages.officeLibrary.addFolderTitle)}</h3>
                <p>{t((messages) => messages.officeLibrary.addFolderBody)}</p>
              </div>
              <button aria-label={t((messages) => messages.officeLibrary.closeAddFolderAria)} onClick={() => setIsCreateFolderOpen(false)} type="button">
                ×
              </button>
            </header>

            <form className="office-modal-body office-library-modal-body" onSubmit={handleCreateFolder}>
              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.folderName)}</span>
                <TextInput autoFocus name="name" placeholder={t((messages) => messages.officeLibrary.folderNamePlaceholder)} />
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.descriptionLabel)}</span>
                <TextareaInput name="description" rows={4} />
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.parentFolderLabel)}</span>
                <SelectInput defaultValue="" name="parentFolderId">
                  <option value="">{t((messages) => messages.officeLibrary.topLevelFolder)}</option>
                  {snapshot.folderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {buildFolderLabel(option)}
                    </option>
                  ))}
                </SelectInput>
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.createFolderScopeLabel)}</span>
                <SelectInput defaultValue="company_wide" name="scope">
                  <option value="company_wide">{t((messages) => messages.officeLibrary.scopeCompanyWide)}</option>
                  <option value="office_only">{t((messages) => messages.officeLibrary.scopeOfficeOnly)}</option>
                </SelectInput>
              </label>

              <footer className="office-modal-footer office-library-modal-footer">
                <span>{t((messages) => messages.officeLibrary.mvpDeletionNotice)}</span>
                <div className="office-modal-actions">
                  <Button onClick={() => setIsCreateFolderOpen(false)} type="button" variant="secondary">
                    {t((messages) => messages.common.cancel)}
                  </Button>
                  <Button disabled={pendingAction === "create-folder"} type="submit">
                    {pendingAction === "create-folder" ? t((messages) => messages.officeLibrary.creatingFolder) : t((messages) => messages.officeLibrary.createFolder)}
                  </Button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {canManageLibrary && isUploadOpen ? (
        <div className="office-modal-overlay" onClick={() => setIsUploadOpen(false)}>
          <section className="office-modal office-library-modal" onClick={(event) => event.stopPropagation()}>
            <header className="office-modal-header">
              <div>
                <h3>{t((messages) => messages.officeLibrary.uploadTitle)}</h3>
                <p>{t((messages) => messages.officeLibrary.uploadBody)}</p>
              </div>
              <button aria-label={t((messages) => messages.officeLibrary.closeUploadAria)} onClick={() => setIsUploadOpen(false)} type="button">
                ×
              </button>
            </header>

            <form className="office-modal-body office-library-modal-body" onSubmit={handleUpload}>
              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.uploadFileLabel)}</span>
                <input accept=".pdf,.doc,.docx,.txt,.rtf,.xlsx,.xls,.csv,image/*" className="office-file-input" name="file" required type="file" />
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.uploadTitleLabel)}</span>
                <TextInput name="title" placeholder={t((messages) => messages.officeLibrary.uploadTitlePlaceholder)} />
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.uploadFolderLabel)}</span>
                <SelectInput defaultValue={snapshot.selectedFolder.id ?? ""} name="folderId">
                  <option value="">{t((messages) => messages.officeLibrary.unfiled)}</option>
                  {snapshot.folderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {buildFolderLabel(option)}
                    </option>
                  ))}
                </SelectInput>
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.categoryField)}</span>
                <TextInput name="category" placeholder={t((messages) => messages.officeLibrary.uploadCategoryPlaceholder)} />
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.uploadVisibilityLabel)}</span>
                <SelectInput defaultValue="company_wide" name="visibility">
                  <option value="company_wide">{t((messages) => messages.officeLibrary.scopeCompanyWide)}</option>
                  <option value="office_only">{t((messages) => messages.officeLibrary.scopeOfficeOnly)}</option>
                </SelectInput>
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.uploadTagsLabel)}</span>
                <TextInput name="tags" placeholder={t((messages) => messages.officeLibrary.tagsPlaceholder)} />
              </label>

              <label className="office-form-field">
                <span>{t((messages) => messages.officeLibrary.uploadSummaryLabel)}</span>
                <TextareaInput name="summary" rows={4} />
              </label>

              <footer className="office-modal-footer office-library-modal-footer">
                <span>{t((messages) => messages.officeLibrary.inlinePreviewNotice)}</span>
                <div className="office-modal-actions">
                  <Button onClick={() => setIsUploadOpen(false)} type="button" variant="secondary">
                    {t((messages) => messages.common.cancel)}
                  </Button>
                  <Button disabled={pendingAction === "upload-document"} type="submit">
                    {pendingAction === "upload-document" ? t((messages) => messages.officeLibrary.uploadingDocument) : t((messages) => messages.officeLibrary.uploadDocument)}
                  </Button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {isRoutingPending ? <p className="office-form-helper">{t((messages) => messages.officeLibrary.refreshingView)}</p> : null}

      <ConfirmActionDialog
        cancelLabel={t((messages) => messages.officeLibrary.keepDocument)}
        confirmLabel={confirmDialog?.confirmLabel}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (!confirmDialog) {
            return;
          }

          const action = confirmDialog.onConfirm;
          setConfirmDialog(null);
          action();
        }}
        title={confirmDialog?.title ?? ""}
      />
    </>
  );
}
