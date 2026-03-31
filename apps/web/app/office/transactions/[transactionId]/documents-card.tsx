"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckboxField, ConfirmActionDialog, EmptyState, FormField, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeTransactionDocument, OfficeTransactionDocumentFilter } from "@acre/db";

type TaskOption = {
  id: string;
  title: string;
};

type TransactionDocumentsCardBaseProps = {
  transactionId: string;
  documents: OfficeTransactionDocument[];
  taskOptions: TaskOption[];
  canViewDocuments: boolean;
  canManageDocuments: boolean;
};

type TransactionDocumentsCardProps = TransactionDocumentsCardBaseProps & {
  canManageSignatures: boolean;
};

type TransactionUnsortedDocumentsCardProps = TransactionDocumentsCardBaseProps;

type DocumentRowState = {
  linkedTaskId: string;
  statusKey: OfficeTransactionDocument["statusKey"];
  isRequired: boolean;
};

type UploadState = {
  title: string;
  documentType: string;
  linkedTaskId: string;
  isRequired: boolean;
  isUnsorted: boolean;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

const documentFilterOptions: Array<{ key: OfficeTransactionDocumentFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "signed", label: "Signed" },
  { key: "pending_signature", label: "Pending signature" },
  { key: "linked_to_tasks", label: "Linked to tasks" }
];

const documentStatusOptions: Array<{ value: OfficeTransactionDocument["statusKey"]; label: string }> = [
  { value: "uploaded", label: "Uploaded" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "signed", label: "Signed" },
  { value: "archived", label: "Archived" }
];

function buildDocumentRowState(document: OfficeTransactionDocument): DocumentRowState {
  return {
    linkedTaskId: document.linkedTaskId ?? "",
    statusKey: document.statusKey,
    isRequired: document.isRequired
  };
}

function getDocumentTone(statusKey: OfficeTransactionDocument["statusKey"]) {
  if (statusKey === "signed" || statusKey === "approved") {
    return "success" as const;
  }

  if (statusKey === "rejected") {
    return "danger" as const;
  }

  if (statusKey === "submitted") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function TransactionDocumentsCard({
  transactionId,
  documents,
  taskOptions,
  canViewDocuments,
  canManageDocuments,
  canManageSignatures
}: TransactionDocumentsCardProps) {
  const router = useRouter();
  const structuredDocuments = useMemo(
    () => documents.filter((document) => !document.isUnsorted),
    [documents]
  );
  const [filter, setFilter] = useState<OfficeTransactionDocumentFilter>("all");
  const [rowStates, setRowStates] = useState<Record<string, DocumentRowState>>(
    Object.fromEntries(structuredDocuments.map((document) => [document.id, buildDocumentRowState(document)]))
  );
  const [uploadState, setUploadState] = useState<UploadState>({
    title: "",
    documentType: "General",
    linkedTaskId: "",
    isRequired: false,
    isUnsorted: false
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const visibleDocuments = useMemo(() => {
    if (filter === "signed") {
      return structuredDocuments.filter((document) => document.isSigned || document.statusKey === "signed");
    }

    if (filter === "pending_signature") {
      return structuredDocuments.filter((document) => document.hasPendingSignature);
    }

    if (filter === "linked_to_tasks") {
      return structuredDocuments.filter((document) => Boolean(document.linkedTaskId));
    }

    return structuredDocuments;
  }, [filter, structuredDocuments]);

  function updateRowState(documentId: string, field: keyof DocumentRowState, value: string | boolean) {
    setRowStates((current) => ({
      ...current,
      [documentId]: {
        ...(current[documentId] ?? buildDocumentRowState(structuredDocuments.find((document) => document.id === documentId)!)),
        [field]: value
      }
    }));
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("A file is required.");
      return;
    }

    setPendingAction("upload");
    setError("");

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("title", uploadState.title.trim() || selectedFile.name);
      formData.set("documentType", uploadState.documentType.trim() || "General");
      formData.set("linkedTaskId", uploadState.linkedTaskId);
      formData.set("isRequired", String(uploadState.isRequired));
      formData.set("isUnsorted", String(uploadState.isUnsorted));

      const response = await fetch(`/api/office/transactions/${transactionId}/documents`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Document upload failed.");
      }

      setUploadState({
        title: "",
        documentType: "General",
        linkedTaskId: "",
        isRequired: false,
        isUnsorted: false
      });
      setSelectedFile(null);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Document upload failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveDocument(documentId: string) {
    const rowState = rowStates[documentId];

    if (!rowState) {
      return;
    }

    setPendingAction(`save:${documentId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/documents/${documentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          linkedTaskId: rowState.linkedTaskId || null,
          status: rowState.statusKey,
          isRequired: rowState.isRequired
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Document update failed.");
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Document update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setPendingAction(`delete:${documentId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/documents/${documentId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Document delete failed.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Document delete failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="bm-detail-card" id="transaction-documents">
      <div className="bm-card-head">
        <div>
          <h3>Documents</h3>
          <span>Structured back-office files linked to this transaction and its checklist tasks.</span>
        </div>
      </div>

      <div className="bm-document-filter-strip">
        {documentFilterOptions.map((option) => (
          <button
            className={`office-toggle-link${filter === option.key ? " is-active" : ""}`}
            key={option.key}
            onClick={() => setFilter(option.key)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="bm-document-list">
        {visibleDocuments.length > 0 ? (
          visibleDocuments.map((document) => {
            const rowState = rowStates[document.id] ?? buildDocumentRowState(document);

            return (
              <article className="bm-document-row" key={document.id}>
                <div className="bm-document-row-top">
                  <div className="bm-document-row-copy">
                    <div className="bm-document-row-head">
                      <strong>{document.title}</strong>
                      <StatusBadge tone={getDocumentTone(document.statusKey)}>{document.status}</StatusBadge>
                      <StatusBadge tone="neutral">{document.source}</StatusBadge>
                      {document.isRequired ? <StatusBadge tone="warning">Required</StatusBadge> : null}
                      {document.hasPendingSignature ? <StatusBadge tone="accent">Pending signature</StatusBadge> : null}
                    </div>
                    <p>
                      {document.documentType} · {document.fileName} · {(document.fileSizeBytes / 1024).toFixed(1)} KB
                    </p>
                    {document.linkedTaskTitle ? (
                      <p>
                        Linked task:{" "}
                        <Link href={document.linkedTaskHref}>{document.linkedTaskTitle}</Link>
                      </p>
                    ) : null}
                  </div>

                  <div className="bm-document-row-actions">
                    {canViewDocuments ? (
                      <Link className="office-button-secondary office-inline-action-sm" href={document.storageUrl} target="_blank">
                        Open
                      </Link>
                    ) : null}
                    {canManageSignatures && document.mimeType.toLowerCase() === "application/pdf" ? (
                      <Link
                        className="office-button-secondary office-inline-action-sm"
                        href={`/office/transactions/${transactionId}/signatures/new?documentId=${document.id}`}
                      >
                        Prepare signature
                      </Link>
                    ) : null}
                    {canManageDocuments ? (
                      <Button
                        className="office-inline-action-sm"
                        disabled={pendingAction === `delete:${document.id}`}
                        onClick={() =>
                          setConfirmDialog({
                            title: `Delete ${document.title}?`,
                            description: "This permanently removes the transaction document and its stored file.",
                            confirmLabel: "Delete document",
                            onConfirm: () => {
                              void handleDeleteDocument(document.id);
                            }
                          })
                        }
                        size="sm"
                        variant="danger"
                      >
                        {pendingAction === `delete:${document.id}` ? "Deleting..." : "Delete"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {canManageDocuments ? (
                  <div className="bm-document-edit-grid">
                    <FormField label="Linked task">
                      <SelectInput
                        onChange={(event) => updateRowState(document.id, "linkedTaskId", event.target.value)}
                        value={rowState.linkedTaskId}
                      >
                        <option value="">No linked task</option>
                        {taskOptions.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>

                    <FormField label="Status">
                      <SelectInput
                        onChange={(event) => updateRowState(document.id, "statusKey", event.target.value)}
                        value={rowState.statusKey}
                      >
                        {documentStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>

                    <CheckboxField className="bm-document-inline-checkbox" label="Required document">
                      <input
                        checked={rowState.isRequired}
                        onChange={(event) => updateRowState(document.id, "isRequired", event.target.checked)}
                        type="checkbox"
                      />
                    </CheckboxField>

                    <div className="bm-document-edit-actions">
                      <Button
                        disabled={pendingAction === `save:${document.id}`}
                        onClick={() => handleSaveDocument(document.id)}
                        size="sm"
                      >
                        {pendingAction === `save:${document.id}` ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <EmptyState
            description="Upload a file or move one in from the unsorted queue."
            title="No matching transaction documents."
          />
        )}
      </div>

      {canManageDocuments ? (
        <div className="bm-document-upload-panel">
          <div className="bm-card-head bm-card-head-inline">
            <h3>Upload document</h3>
          </div>

          <div className="bm-document-upload-grid">
            <FormField label="File">
              <input
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </FormField>
            <FormField label="Title">
              <TextInput
                onChange={(event) => setUploadState((current) => ({ ...current, title: event.target.value }))}
                value={uploadState.title}
              />
            </FormField>
            <FormField label="Document type">
              <TextInput
                onChange={(event) => setUploadState((current) => ({ ...current, documentType: event.target.value }))}
                value={uploadState.documentType}
              />
            </FormField>
            <FormField label="Linked task">
              <SelectInput
                onChange={(event) => setUploadState((current) => ({ ...current, linkedTaskId: event.target.value }))}
                value={uploadState.linkedTaskId}
              >
                <option value="">No linked task</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <div className="bm-document-upload-checkboxes">
              <CheckboxField label="Required document">
                <input
                  checked={uploadState.isRequired}
                  onChange={(event) => setUploadState((current) => ({ ...current, isRequired: event.target.checked }))}
                  type="checkbox"
                />
              </CheckboxField>
              <CheckboxField label="Start in unsorted">
                <input
                  checked={uploadState.isUnsorted}
                  onChange={(event) => setUploadState((current) => ({ ...current, isUnsorted: event.target.checked }))}
                  type="checkbox"
                />
              </CheckboxField>
            </div>
          </div>

          <div className="bm-document-edit-actions">
            <Button disabled={!selectedFile || pendingAction === "upload"} onClick={handleUpload}>
              {pendingAction === "upload" ? "Uploading..." : "Upload document"}
            </Button>
          </div>
        </div>
      ) : null}

        {error ? <p className="office-form-error">{error}</p> : null}
      </section>

      <ConfirmActionDialog
        cancelLabel="Keep document"
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

export function TransactionUnsortedDocumentsCard({
  transactionId,
  documents,
  taskOptions,
  canViewDocuments,
  canManageDocuments
}: TransactionUnsortedDocumentsCardProps) {
  const router = useRouter();
  const unsortedDocuments = useMemo(
    () => documents.filter((document) => document.isUnsorted),
    [documents]
  );
  const [taskSelections, setTaskSelections] = useState<Record<string, string>>(
    Object.fromEntries(unsortedDocuments.map((document) => [document.id, document.linkedTaskId ?? ""]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  async function handleMoveToStructured(documentId: string) {
    setPendingAction(`move:${documentId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/documents/${documentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isUnsorted: false,
          linkedTaskId: taskSelections[documentId] || null
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Document update failed.");
      }

      router.refresh();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Document update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete(documentId: string) {
    setPendingAction(`delete:${documentId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/documents/${documentId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Document delete failed.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Document delete failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="bm-detail-card" id="transaction-unsorted-documents">
      <div className="bm-card-head">
        <div>
          <h3>Unsorted documents</h3>
          <span>Files that landed in the transaction but have not been organized into the main workflow yet.</span>
        </div>
      </div>

      <div className="bm-document-list">
        {unsortedDocuments.length > 0 ? (
          unsortedDocuments.map((document) => (
            <article className="bm-document-row" key={document.id}>
              <div className="bm-document-row-top">
                <div className="bm-document-row-copy">
                  <div className="bm-document-row-head">
                    <strong>{document.title}</strong>
                    <StatusBadge tone="warning">Unsorted</StatusBadge>
                    <StatusBadge tone={getDocumentTone(document.statusKey)}>{document.status}</StatusBadge>
                  </div>
                  <p>
                    {document.documentType} · {document.fileName}
                  </p>
                </div>

                <div className="bm-document-row-actions">
                  {canViewDocuments ? (
                    <Link className="office-button-secondary office-inline-action-sm" href={document.storageUrl} target="_blank">
                      Open
                    </Link>
                  ) : null}
                  {canManageDocuments ? (
                    <Button
                      className="office-inline-action-sm"
                      disabled={pendingAction === `delete:${document.id}`}
                      onClick={() =>
                        setConfirmDialog({
                          title: `Delete ${document.title}?`,
                          description: "This permanently removes the unsorted document and its stored file from the transaction.",
                          confirmLabel: "Delete document",
                          onConfirm: () => {
                            void handleDelete(document.id);
                          }
                        })
                      }
                      size="sm"
                      variant="danger"
                    >
                      {pendingAction === `delete:${document.id}` ? "Deleting..." : "Delete"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {canManageDocuments ? (
                <div className="bm-document-edit-grid">
                  <FormField label="Move into task">
                    <SelectInput
                      onChange={(event) =>
                        setTaskSelections((current) => ({
                          ...current,
                          [document.id]: event.target.value
                        }))
                      }
                      value={taskSelections[document.id] ?? ""}
                    >
                      <option value="">No linked task</option>
                      {taskOptions.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <div className="bm-document-edit-actions">
                    <Button
                      disabled={pendingAction === `move:${document.id}`}
                      onClick={() => handleMoveToStructured(document.id)}
                      size="sm"
                    >
                      {pendingAction === `move:${document.id}` ? "Moving..." : "Move to documents"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState
            description="Uploads marked as unsorted will appear here until they are placed into the workflow."
            title="No unsorted documents."
          />
        )}
      </div>

        {error ? <p className="office-form-error">{error}</p> : null}
      </section>

      <ConfirmActionDialog
        cancelLabel="Keep document"
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
