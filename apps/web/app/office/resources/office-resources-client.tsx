"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import {
  Badge,
  Button,
  CheckboxField,
  ConfirmActionDialog,
  EmptyState,
  FormField,
  SectionCard,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import type { OfficeResourcesAdminSnapshot } from "@acre/db";

type OfficeResourcesClientProps = {
  activeTab: "documents" | "vendors" | "training";
  snapshot: OfficeResourcesAdminSnapshot;
};

type ResourceRecord = OfficeResourcesAdminSnapshot["resources"][number];
type VendorRecord = OfficeResourcesAdminSnapshot["vendors"][number];

type ConfirmState =
  | {
      kind: "resource";
      id: string;
      title: string;
    }
  | {
      kind: "vendor";
      id: string;
      title: string;
    }
  | null;

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

type JsonResponse = {
  error?: string;
};

const stackStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const tabsStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  padding: "0.6rem",
  borderRadius: "24px",
  border: "1px solid rgba(18, 53, 104, 0.1)",
  background: "linear-gradient(180deg, #f7f9fc 0%, #f2f6fb 100%)",
};

const tabLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  minHeight: "64px",
  width: "100%",
  padding: "0.95rem 1.1rem",
  borderRadius: "18px",
  color: "#4d6480",
  fontSize: "0.98rem",
  fontWeight: 800,
  lineHeight: 1.1,
  textDecoration: "none",
  letterSpacing: "-0.02em",
};

const activeTabLinkStyle: CSSProperties = {
  ...tabLinkStyle,
  color: "#173153",
  background: "#ffffff",
  boxShadow:
    "0 14px 28px rgba(18, 53, 104, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.96)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const recordCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.9rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "#ffffff",
};

const recordHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.8rem",
  flexWrap: "wrap",
};

const recordMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.84rem",
  lineHeight: 1.45,
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const paginationRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
  marginTop: "1rem",
};

const pageMetaStyle: CSSProperties = {
  color: "#5a718d",
  fontSize: "0.84rem",
  fontWeight: 600,
};

const paginationButtonsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  color: "#556a83",
  lineHeight: 1.55,
};

const sectionIntroStyle: CSSProperties = {
  display: "grid",
  gap: "0.28rem",
};

const resourcesPerPage = 12;

function parseCsv(value: FormDataEntryValue | null) {
  return `${value ?? ""}`
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function parseError(response: Response, fallback: string) {
  const payload = (await response
    .json()
    .catch(() => null)) as JsonResponse | null;
  return payload?.error || fallback;
}

function formatFileSize(fileSizeBytes: number) {
  if (fileSizeBytes <= 0) {
    return "";
  }

  if (fileSizeBytes >= 1024 * 1024) {
    return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(fileSizeBytes / 1024))} KB`;
}

function parsePageNumber(value: string | null) {
  const parsedValue = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return parsedValue;
}

function buildPageNumbers(pageCount: number, activePage: number) {
  if (pageCount <= 8) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (activePage <= 4) {
    return [1, 2, 3, 4, 5, pageCount];
  }

  if (activePage >= pageCount - 3) {
    return [
      1,
      pageCount - 4,
      pageCount - 3,
      pageCount - 2,
      pageCount - 1,
      pageCount,
    ];
  }

  return [
    1,
    activePage - 1,
    activePage,
    activePage + 1,
    activePage + 2,
    pageCount,
  ];
}

function paginateItems<T>(items: T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / resourcesPerPage));
  const currentPage = Math.min(requestedPage, pageCount);
  const startIndex = (currentPage - 1) * resourcesPerPage;

  return {
    currentPage,
    pageCount,
    visibleItems: items.slice(startIndex, startIndex + resourcesPerPage),
  };
}

function buildResourcesUrl(params: {
  tab: "documents" | "vendors" | "training";
  page?: number | null;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("tab", params.tab);

  if ((params.page ?? 1) > 1) {
    searchParams.set("page", String(params.page));
  }

  return `/office/resources?${searchParams.toString()}`;
}

export function OfficeResourcesClient({
  activeTab,
  snapshot,
}: OfficeResourcesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null,
  );
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const documents = snapshot.resources.filter(
    (resource) => resource.type === documentType,
  );
  const trainingResources = snapshot.resources.filter(
    (resource) => resource.type === trainingType,
  );
  const vendors = snapshot.vendors;
  const requestedPage = parsePageNumber(searchParams.get("page"));
  const paginatedDocuments = paginateItems(documents, requestedPage);
  const paginatedTraining = paginateItems(trainingResources, requestedPage);
  const paginatedVendors = paginateItems(vendors, requestedPage);

  async function refreshWithFeedback(nextFeedback: FeedbackState) {
    setFeedback(nextFeedback);
    router.refresh();
  }

  function renderPagination(params: {
    currentPage: number;
    pageCount: number;
    totalCount: number;
    noun: string;
  }) {
    if (params.pageCount <= 1) {
      return null;
    }

    const paginationLinks = buildPageNumbers(
      params.pageCount,
      params.currentPage,
    );

    return (
      <div style={paginationRowStyle}>
        <span style={pageMetaStyle}>
          Page {params.currentPage} of {params.pageCount} · {params.totalCount}{" "}
          {params.noun}
        </span>
        <div style={paginationButtonsStyle}>
          <a
            aria-disabled={params.currentPage === 1}
            className="office-button-secondary office-button-sm"
            href={
              params.currentPage === 1
                ? undefined
                : buildResourcesUrl({
                    tab: activeTab,
                    page: params.currentPage - 1,
                  })
            }
            style={
              params.currentPage === 1
                ? {
                    pointerEvents: "none",
                    opacity: 0.45,
                  }
                : undefined
            }
          >
            Previous
          </a>
          {paginationLinks.map((pageNumber, index) => {
            const previousPage = paginationLinks[index - 1];
            const showGap = previousPage && pageNumber - previousPage > 1;

            return (
              <span
                key={pageNumber}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {showGap ? (
                  <span
                    style={{
                      color: "#7a8ea6",
                      fontSize: "0.86rem",
                      fontWeight: 700,
                    }}
                  >
                    ...
                  </span>
                ) : null}
                <a
                  aria-current={
                    pageNumber === params.currentPage ? "page" : undefined
                  }
                  className={
                    pageNumber === params.currentPage
                      ? "office-button office-button-sm"
                      : "office-button-secondary office-button-sm"
                  }
                  href={buildResourcesUrl({
                    tab: activeTab,
                    page: pageNumber,
                  })}
                >
                  {pageNumber}
                </a>
              </span>
            );
          })}
          <a
            aria-disabled={params.currentPage === params.pageCount}
            className="office-button-secondary office-button-sm"
            href={
              params.currentPage === params.pageCount
                ? undefined
                : buildResourcesUrl({
                    tab: activeTab,
                    page: params.currentPage + 1,
                  })
            }
            style={
              params.currentPage === params.pageCount
                ? {
                    pointerEvents: "none",
                    opacity: 0.45,
                  }
                : undefined
            }
          >
            Next
          </a>
        </div>
      </div>
    );
  }

  async function handleCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-document");
    setFeedback(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      formData.set("type", documentType);
      const response = await fetch("/api/office/resources", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await parseError(response, "Failed to upload document."),
        );
      }

      form.reset();
      await refreshWithFeedback({
        tone: "success",
        message: "Document uploaded.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to upload document.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateDocument(
    event: FormEvent<HTMLFormElement>,
    resourceId: string,
  ) {
    event.preventDefault();
    setPendingAction(`update-resource:${resourceId}`);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);

    try {
      formData.set("type", documentType);
      const response = await fetch(`/api/office/resources/${resourceId}`, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await parseError(response, "Failed to update document."),
        );
      }

      setEditingResourceId(null);
      await refreshWithFeedback({
        tone: "success",
        message: "Document updated.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to update document.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-training");
    setFeedback(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/office/resources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          summary: String(formData.get("summary") ?? ""),
          url: String(formData.get("url") ?? ""),
          tags: parseCsv(formData.get("tags")),
          type: trainingType,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await parseError(response, "Failed to create training video."),
        );
      }

      form.reset();
      await refreshWithFeedback({
        tone: "success",
        message: "Training video created.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create training video.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateTraining(
    event: FormEvent<HTMLFormElement>,
    resourceId: string,
  ) {
    event.preventDefault();
    setPendingAction(`update-resource:${resourceId}`);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/office/resources/${resourceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          summary: String(formData.get("summary") ?? ""),
          url: String(formData.get("url") ?? ""),
          tags: parseCsv(formData.get("tags")),
          type: trainingType,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await parseError(response, "Failed to update training video."),
        );
      }

      setEditingResourceId(null);
      await refreshWithFeedback({
        tone: "success",
        message: "Training video updated.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update training video.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-vendor");
    setFeedback(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/office/resources/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: String(formData.get("category") ?? ""),
          name: String(formData.get("name") ?? ""),
          headline: String(formData.get("headline") ?? ""),
          phone: String(formData.get("phone") ?? "").trim() || null,
          email: String(formData.get("email") ?? "").trim() || null,
          website: String(formData.get("website") ?? "").trim() || null,
          neighborhoods: parseCsv(formData.get("neighborhoods")),
          isFeatured: formData.get("isFeatured") === "on",
        }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response, "Failed to add vendor."));
      }

      form.reset();
      await refreshWithFeedback({
        tone: "success",
        message: "Vendor created.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to add vendor.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateVendor(
    event: FormEvent<HTMLFormElement>,
    vendorId: string,
  ) {
    event.preventDefault();
    setPendingAction(`update-vendor:${vendorId}`);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `/api/office/resources/vendors/${vendorId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category: String(formData.get("category") ?? ""),
            name: String(formData.get("name") ?? ""),
            headline: String(formData.get("headline") ?? ""),
            phone: String(formData.get("phone") ?? "").trim() || null,
            email: String(formData.get("email") ?? "").trim() || null,
            website: String(formData.get("website") ?? "").trim() || null,
            neighborhoods: parseCsv(formData.get("neighborhoods")),
            isFeatured: formData.get("isFeatured") === "on",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await parseError(response, "Failed to update vendor."));
      }

      setEditingVendorId(null);
      await refreshWithFeedback({
        tone: "success",
        message: "Vendor updated.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to update vendor.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmState) {
      return;
    }

    const endpoint =
      confirmState.kind === "vendor"
        ? `/api/office/resources/vendors/${confirmState.id}`
        : `/api/office/resources/${confirmState.id}`;

    setPendingAction(`delete:${confirmState.kind}:${confirmState.id}`);
    setFeedback(null);

    try {
      const response = await fetch(endpoint, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(
          await parseError(
            response,
            confirmState.kind === "vendor"
              ? "Failed to delete vendor."
              : "Failed to delete resource.",
          ),
        );
      }

      setEditingResourceId((current) =>
        current === confirmState.id ? null : current,
      );
      setEditingVendorId((current) =>
        current === confirmState.id ? null : current,
      );
      setConfirmState(null);
      await refreshWithFeedback({
        tone: "success",
        message:
          confirmState.kind === "vendor"
            ? "Vendor deleted."
            : "Resource deleted.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : confirmState.kind === "vendor"
              ? "Failed to delete vendor."
              : "Failed to delete resource.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  function renderDocumentList() {
    if (!documents.length) {
      return (
        <EmptyState
          description="Upload the first PDF document for Front Office agents from the form above."
          title="No documents yet"
        />
      );
    }

    return (
      <div style={gridStyle}>
        {paginatedDocuments.visibleItems.map((resource) => {
          const isEditing = editingResourceId === resource.id;
          const isBusy =
            pendingAction === `update-resource:${resource.id}` ||
            pendingAction === `delete:resource:${resource.id}`;

          return (
            <article key={resource.id} style={recordCardStyle}>
              {isEditing ? (
                <form
                  className="office-form-grid"
                  onSubmit={(event) => handleUpdateDocument(event, resource.id)}
                >
                  <FormField className="office-form-grid-span-2" label="PDF file">
                    <input
                      accept=".pdf,application/pdf"
                      className="office-file-input"
                      name="file"
                      type="file"
                    />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="Title">
                    <TextInput defaultValue={resource.title} name="title" required />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="Summary">
                    <TextareaInput
                      defaultValue={resource.summary}
                      name="summary"
                      required
                      rows={3}
                    />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="Tags">
                    <TextInput
                      defaultValue={resource.tagsText}
                      name="tags"
                      placeholder="buyers, checklist, consultation"
                    />
                  </FormField>
                  <div className="office-form-grid-span-2">
                    <p className="office-form-helper" style={{ margin: 0 }}>
                      Leave the PDF field empty to keep the current document.
                    </p>
                  </div>
                  <div style={actionRowStyle}>
                    <Button disabled={isBusy} type="submit">
                      Save
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() => setEditingResourceId(null)}
                      type="button"
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        setConfirmState({
                          kind: "resource",
                          id: resource.id,
                          title: resource.title,
                        })
                      }
                      type="button"
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={recordHeaderStyle}>
                    <div style={sectionIntroStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong>{resource.title}</strong>
                        <StatusBadge tone="neutral">Document</StatusBadge>
                        {resource.hasStoredFile ? (
                          <Badge tone="accent">PDF upload</Badge>
                        ) : (
                          <Badge tone="neutral">Link fallback</Badge>
                        )}
                      </div>
                      <p style={helperTextStyle}>{resource.summary}</p>
                    </div>
                    <Button
                      onClick={() => setEditingResourceId(resource.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                  </div>

                  <div style={recordMetaStyle}>
                    <span>{resource.scopeLabel}</span>
                    <span>Updated {resource.updatedAtLabel}</span>
                    {resource.originalFileName ? (
                      <span>{resource.originalFileName}</span>
                    ) : null}
                    {resource.fileSizeBytes > 0 ? (
                      <span>{formatFileSize(resource.fileSizeBytes)}</span>
                    ) : null}
                  </div>

                  {resource.tagsText ? (
                    <div style={recordMetaStyle}>
                      <span>{resource.tagsText}</span>
                    </div>
                  ) : null}

                  <div style={actionRowStyle}>
                    {resource.openHref ? (
                      <a
                        className="office-button-secondary office-button-sm"
                        href={resource.openHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open PDF
                      </a>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          );
        })}
        {renderPagination({
          currentPage: paginatedDocuments.currentPage,
          pageCount: paginatedDocuments.pageCount,
          totalCount: documents.length,
          noun: "documents",
        })}
      </div>
    );
  }

  function renderTrainingList() {
    if (!trainingResources.length) {
      return (
        <EmptyState
          description="Paste the first YouTube training refresher for agents from the form above."
          title="No training videos yet"
        />
      );
    }

    return (
      <div style={gridStyle}>
        {paginatedTraining.visibleItems.map((resource) => {
          const isEditing = editingResourceId === resource.id;
          const isBusy =
            pendingAction === `update-resource:${resource.id}` ||
            pendingAction === `delete:resource:${resource.id}`;

          return (
            <article key={resource.id} style={recordCardStyle}>
              {isEditing ? (
                <form
                  className="office-form-grid"
                  onSubmit={(event) => handleUpdateTraining(event, resource.id)}
                >
                  <FormField className="office-form-grid-span-2" label="Title">
                    <TextInput defaultValue={resource.title} name="title" required />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="Summary">
                    <TextareaInput
                      defaultValue={resource.summary}
                      name="summary"
                      required
                      rows={3}
                    />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="YouTube URL">
                    <TextInput
                      defaultValue={resource.url}
                      name="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      required
                      type="url"
                    />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="Tags">
                    <TextInput
                      defaultValue={resource.tagsText}
                      name="tags"
                      placeholder="buyers, scripts, objections"
                    />
                  </FormField>
                  <div style={actionRowStyle}>
                    <Button disabled={isBusy} type="submit">
                      Save
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() => setEditingResourceId(null)}
                      type="button"
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        setConfirmState({
                          kind: "resource",
                          id: resource.id,
                          title: resource.title,
                        })
                      }
                      type="button"
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={recordHeaderStyle}>
                    <div style={sectionIntroStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong>{resource.title}</strong>
                        <StatusBadge tone="warning">Training</StatusBadge>
                      </div>
                      <p style={helperTextStyle}>{resource.summary}</p>
                    </div>
                    <Button
                      onClick={() => setEditingResourceId(resource.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                  </div>

                  <div style={recordMetaStyle}>
                    <span>{resource.scopeLabel}</span>
                    <span>Updated {resource.updatedAtLabel}</span>
                    <span>{resource.url}</span>
                  </div>

                  {resource.tagsText ? (
                    <div style={recordMetaStyle}>
                      <span>{resource.tagsText}</span>
                    </div>
                  ) : null}

                  <div style={actionRowStyle}>
                    <a
                      className="office-button-secondary office-button-sm"
                      href={resource.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open on YouTube
                    </a>
                  </div>
                </>
              )}
            </article>
          );
        })}
        {renderPagination({
          currentPage: paginatedTraining.currentPage,
          pageCount: paginatedTraining.pageCount,
          totalCount: trainingResources.length,
          noun: "training videos",
        })}
      </div>
    );
  }

  function renderVendorList() {
    if (!vendors.length) {
      return (
        <EmptyState
          description="Add the first vendor contact for Front Office agents from the form above."
          title="No vendors yet"
        />
      );
    }

    return (
      <div style={gridStyle}>
        {paginatedVendors.visibleItems.map((vendor) => {
          const isEditing = editingVendorId === vendor.id;
          const isBusy =
            pendingAction === `update-vendor:${vendor.id}` ||
            pendingAction === `delete:vendor:${vendor.id}`;

          return (
            <article key={vendor.id} style={recordCardStyle}>
              {isEditing ? (
                <form
                  className="office-form-grid"
                  onSubmit={(event) => handleUpdateVendor(event, vendor.id)}
                >
                  <FormField label="Category">
                    <TextInput defaultValue={vendor.category} name="category" required />
                  </FormField>
                  <FormField label="Name">
                    <TextInput defaultValue={vendor.name} name="name" required />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="Headline">
                    <TextInput
                      defaultValue={vendor.headline}
                      name="headline"
                      required
                    />
                  </FormField>
                  <FormField label="Phone">
                    <TextInput defaultValue={vendor.phone} name="phone" />
                  </FormField>
                  <FormField label="Email">
                    <TextInput
                      defaultValue={vendor.email}
                      name="email"
                      type="email"
                    />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="Website">
                    <TextInput
                      defaultValue={vendor.website}
                      name="website"
                      type="url"
                    />
                  </FormField>
                  <FormField className="office-form-grid-span-2" label="Coverage areas">
                    <TextInput
                      defaultValue={vendor.neighborhoodsText}
                      name="neighborhoods"
                      placeholder="Brooklyn, Queens, Jersey City"
                    />
                  </FormField>
                  <CheckboxField label="Featured">
                    <input
                      defaultChecked={vendor.isFeatured}
                      name="isFeatured"
                      type="checkbox"
                    />
                  </CheckboxField>
                  <div style={actionRowStyle}>
                    <Button disabled={isBusy} type="submit">
                      Save
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() => setEditingVendorId(null)}
                      type="button"
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        setConfirmState({
                          kind: "vendor",
                          id: vendor.id,
                          title: vendor.name,
                        })
                      }
                      type="button"
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={recordHeaderStyle}>
                    <div style={sectionIntroStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong>{vendor.name}</strong>
                        <Badge tone={vendor.isFeatured ? "accent" : "neutral"}>
                          {vendor.categoryLabel}
                        </Badge>
                        {vendor.isFeatured ? (
                          <StatusBadge tone="accent">Featured</StatusBadge>
                        ) : null}
                      </div>
                      <p style={helperTextStyle}>{vendor.headline}</p>
                    </div>
                    <Button
                      onClick={() => setEditingVendorId(vendor.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                  </div>

                  <div style={recordMetaStyle}>
                    <span>{vendor.scopeLabel}</span>
                    <span>Updated {vendor.updatedAtLabel}</span>
                    <span>{vendor.coverageLabel}</span>
                  </div>

                  <div style={recordMetaStyle}>
                    {vendor.phone ? <span>{vendor.phone}</span> : null}
                    {vendor.email ? <span>{vendor.email}</span> : null}
                    {vendor.website ? <span>{vendor.website}</span> : null}
                  </div>
                </>
              )}
            </article>
          );
        })}
        {renderPagination({
          currentPage: paginatedVendors.currentPage,
          pageCount: paginatedVendors.pageCount,
          totalCount: vendors.length,
          noun: "vendors",
        })}
      </div>
    );
  }

  const tabDefinitions = [
    { key: "documents" as const, label: `Documents (${documents.length})` },
    { key: "vendors" as const, label: `Vendors (${vendors.length})` },
    { key: "training" as const, label: `Training (${trainingResources.length})` },
  ];

  return (
    <div className="office-list-page-stack" style={stackStyle}>
      {feedback ? (
        <SectionCard className="office-list-card" title="Latest update">
          <p
            className="office-form-helper"
            style={{
              margin: 0,
              color: feedback.tone === "error" ? "#b42318" : "#0f766e",
            }}
          >
            {feedback.message}
          </p>
        </SectionCard>
      ) : null}

      <SectionCard
        className="office-list-card"
        subtitle="This workspace manages the shared Front Office Documents, Vendors, and Training tabs for every company."
        title="Resource tabs"
      >
        <div style={tabsStyle}>
          {tabDefinitions.map((tab) => (
            <a
              aria-current={activeTab === tab.key ? "page" : undefined}
              href={buildResourcesUrl({ tab: tab.key })}
              key={tab.key}
              style={activeTab === tab.key ? activeTabLinkStyle : tabLinkStyle}
            >
              {tab.label}
            </a>
          ))}
        </div>
      </SectionCard>

      {activeTab === "documents" ? (
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Upload the PDF documents that agents across every company should find in the Front Office Documents tab."
            title="Add document"
          >
            <form
              className="office-form-grid"
              onSubmit={handleCreateDocument}
              style={{ marginTop: "0.25rem" }}
            >
              <FormField className="office-form-grid-span-2" label="PDF file">
                <input
                  accept=".pdf,application/pdf"
                  className="office-file-input"
                  name="file"
                  required
                  type="file"
                />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Title">
                <TextInput
                  name="title"
                  placeholder="Buyer consultation checklist"
                  required
                />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Summary">
                <TextareaInput
                  name="summary"
                  placeholder="What this PDF helps the agent do."
                  required
                  rows={3}
                />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Tags">
                <TextInput
                  name="tags"
                  placeholder="buyers, consultation, checklist"
                />
              </FormField>
              <div className="office-filter-actions">
                <Button disabled={pendingAction === "create-document"} type="submit">
                  Upload document
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Only Front Office-facing PDF materials belong here, and every company sees the same published set."
            title="Documents"
          >
            {renderDocumentList()}
          </SectionCard>
        </>
      ) : null}

      {activeTab === "training" ? (
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Add only YouTube links here so the shared Front Office Training tab stays video-only."
            title="Add training video"
          >
            <form
              className="office-form-grid"
              onSubmit={handleCreateTraining}
              style={{ marginTop: "0.25rem" }}
            >
              <FormField className="office-form-grid-span-2" label="Title">
                <TextInput
                  name="title"
                  placeholder="Buyer objection refresher"
                  required
                />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Summary">
                <TextareaInput
                  name="summary"
                  placeholder="What this refresher covers."
                  required
                  rows={3}
                />
              </FormField>
              <FormField className="office-form-grid-span-2" label="YouTube URL">
                <TextInput
                  name="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  type="url"
                />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Tags">
                <TextInput name="tags" placeholder="buyers, scripts, objections" />
              </FormField>
              <div className="office-filter-actions">
                <Button disabled={pendingAction === "create-training"} type="submit">
                  Add training video
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These entries map directly to the shared Front Office Training tab for every company."
            title="Training"
          >
            {renderTrainingList()}
          </SectionCard>
        </>
      ) : null}

      {activeTab === "vendors" ? (
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Keep vendor records short and directly useful for the shared Front Office Vendors tab."
            title="Add vendor"
          >
            <form
              className="office-form-grid"
              onSubmit={handleCreateVendor}
              style={{ marginTop: "0.25rem" }}
            >
              <FormField label="Category">
                <TextInput name="category" placeholder="lender" required />
              </FormField>
              <FormField label="Name">
                <TextInput name="name" placeholder="North Star Lending" required />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Headline">
                <TextInput
                  name="headline"
                  placeholder="Fast pre-approval support for NYC buyers."
                  required
                />
              </FormField>
              <FormField label="Phone">
                <TextInput name="phone" placeholder="2125550199" />
              </FormField>
              <FormField label="Email">
                <TextInput name="email" placeholder="team@example.com" type="email" />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Website">
                <TextInput name="website" placeholder="https://..." type="url" />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Coverage areas">
                <TextInput
                  name="neighborhoods"
                  placeholder="Brooklyn, Queens, Jersey City"
                />
              </FormField>
              <CheckboxField label="Featured">
                <input name="isFeatured" type="checkbox" />
              </CheckboxField>
              <div className="office-filter-actions">
                <Button disabled={pendingAction === "create-vendor"} type="submit">
                  Add vendor
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These cards appear directly in the same Front Office vendor pool for every company."
            title="Vendors"
          >
            {renderVendorList()}
          </SectionCard>
        </>
      ) : null}

      <ConfirmActionDialog
        confirmLabel={
          confirmState?.kind === "vendor" ? "Delete vendor" : "Delete resource"
        }
        description={
          confirmState
            ? `This will permanently remove ${confirmState.title} from Front Office resources.`
            : ""
        }
        isOpen={Boolean(confirmState)}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmDelete}
        title={confirmState ? `Delete ${confirmState.title}?` : ""}
      />
    </div>
  );
}
const documentType = "document";
const trainingType = "training_video";
