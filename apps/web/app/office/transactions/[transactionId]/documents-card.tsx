"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckboxField, ConfirmActionDialog, EmptyState, FormField, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeTransactionDocument, OfficeTransactionDocumentFilter } from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";

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

const documentFilterOptions: Array<{ key: OfficeTransactionDocumentFilter; enLabel: string; zhLabel: string }> = [
  { key: "all", enLabel: "All", zhLabel: "全部" },
  { key: "signed", enLabel: "Signed", zhLabel: "已签" },
  { key: "pending_signature", enLabel: "Pending signature", zhLabel: "待签名" },
  { key: "linked_to_tasks", enLabel: "Linked to tasks", zhLabel: "已关联任务" }
];

const documentStatusOptions: Array<{ value: OfficeTransactionDocument["statusKey"]; enLabel: string; zhLabel: string }> = [
  { value: "uploaded", enLabel: "Uploaded", zhLabel: "已上传" },
  { value: "submitted", enLabel: "Submitted", zhLabel: "已提交" },
  { value: "approved", enLabel: "Approved", zhLabel: "已批准" },
  { value: "rejected", enLabel: "Rejected", zhLabel: "已拒绝" },
  { value: "signed", enLabel: "Signed", zhLabel: "已签署" },
  { value: "archived", enLabel: "Archived", zhLabel: "已归档" }
];

const documentSourceLabelMap: Record<OfficeTransactionDocument["sourceKey"], { en: string; zh: string }> = {
  manual_upload: { en: "Manual upload", zh: "手动上传" },
  generated_form: { en: "Generated form", zh: "生成表单" },
  incoming_update: { en: "Incoming update", zh: "外部更新" },
  synced_external: { en: "External sync", zh: "外部同步" },
  email_pdf: { en: "Email PDF", zh: "邮件 PDF" },
  signature_output: { en: "Signature output", zh: "签名输出" }
};

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

function getDocumentStatusLabel(document: OfficeTransactionDocument, isZh: boolean) {
  const option = documentStatusOptions.find((entry) => entry.value === document.statusKey);
  return option ? (isZh ? option.zhLabel : option.enLabel) : document.status;
}

function getDocumentSourceLabel(document: OfficeTransactionDocument, isZh: boolean) {
  const label = documentSourceLabelMap[document.sourceKey];
  return label ? (isZh ? label.zh : label.en) : document.source;
}

export function TransactionDocumentsCard({
  transactionId,
  documents,
  taskOptions,
  canViewDocuments,
  canManageDocuments,
  canManageSignatures
}: TransactionDocumentsCardProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
      setError(isZh ? "请先选择文件。" : "Select a file first.");
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
        throw new Error(body?.error ?? (isZh ? "文档上传失败。" : "Document upload failed."));
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
      setError(uploadError instanceof Error ? uploadError.message : isZh ? "文档上传失败。" : "Document upload failed.");
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
        throw new Error(body?.error ?? (isZh ? "文档更新失败。" : "Document update failed."));
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : isZh ? "文档更新失败。" : "Document update failed.");
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
        throw new Error(body?.error ?? (isZh ? "文档删除失败。" : "Document delete failed."));
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : isZh ? "文档删除失败。" : "Document delete failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="office-detail-card" id="transaction-documents">
      <div className="office-card-head">
        <div>
          <h3>{isZh ? "文档" : "Documents"}</h3>
          <span>{isZh ? "与这笔交易及其清单任务关联的结构化后台文件。" : "Structured Back Office files linked to this transaction and its checklist tasks."}</span>
        </div>
      </div>

      <div className="office-document-filter-strip">
        {documentFilterOptions.map((option) => (
          <button
            className={`office-toggle-link${filter === option.key ? " is-active" : ""}`}
            key={option.key}
            onClick={() => setFilter(option.key)}
            type="button"
          >
            {isZh ? option.zhLabel : option.enLabel}
          </button>
        ))}
      </div>

      <div className="office-document-list">
        {visibleDocuments.length > 0 ? (
          visibleDocuments.map((document) => {
            const rowState = rowStates[document.id] ?? buildDocumentRowState(document);

            return (
              <article className="office-document-row" key={document.id}>
                <div className="office-document-row-top">
                  <div className="office-document-row-copy">
                    <div className="office-document-row-head">
                      <strong>{document.title}</strong>
                      <StatusBadge tone={getDocumentTone(document.statusKey)}>{getDocumentStatusLabel(document, isZh)}</StatusBadge>
                      <StatusBadge tone="neutral">{getDocumentSourceLabel(document, isZh)}</StatusBadge>
                      {document.isRequired ? <StatusBadge tone="warning">{isZh ? "必需" : "Required"}</StatusBadge> : null}
                      {document.hasPendingSignature ? <StatusBadge tone="accent">{isZh ? "待签名" : "Pending signature"}</StatusBadge> : null}
                    </div>
                    <p>
                      {document.documentType} · {document.fileName} · {(document.fileSizeBytes / 1024).toFixed(1)} KB
                    </p>
                    {document.linkedTaskTitle ? (
                      <p>
                        {isZh ? "关联任务：" : "Linked task: "}{" "}
                        <Link href={document.linkedTaskHref}>{document.linkedTaskTitle}</Link>
                      </p>
                    ) : null}
                  </div>

                  <div className="office-document-row-actions">
                    {canViewDocuments ? (
                      <Link className="office-button-secondary office-inline-action-sm" href={document.storageUrl} target="_blank">
                        {isZh ? "打开" : "Open"}
                      </Link>
                    ) : null}
                    {canManageSignatures && document.mimeType.toLowerCase() === "application/pdf" ? (
                      <Link
                        className="office-button-secondary office-inline-action-sm"
                        href={`/office/transactions/${transactionId}/signatures/new?documentId=${document.id}`}
                      >
                        {isZh ? "准备签名" : "Prepare signature"}
                      </Link>
                    ) : null}
                    {canManageDocuments ? (
                      <Button
                        className="office-inline-action-sm"
                        disabled={pendingAction === `delete:${document.id}`}
                        onClick={() =>
                          setConfirmDialog({
                            title: isZh ? `删除 ${document.title}？` : `Delete ${document.title}?`,
                            description: isZh ? "这会永久移除这份交易文档及其已存储文件。" : "This permanently removes this transaction document and its stored file.",
                            confirmLabel: isZh ? "删除文档" : "Delete document",
                            onConfirm: () => {
                              void handleDeleteDocument(document.id);
                            }
                          })
                        }
                        size="sm"
                        variant="danger"
                      >
                        {pendingAction === `delete:${document.id}` ? (isZh ? "删除中..." : "Deleting...") : isZh ? "删除" : "Delete"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {canManageDocuments ? (
                  <div className="office-document-edit-grid">
                    <FormField label={isZh ? "关联任务" : "Linked task"}>
                      <SelectInput
                        onChange={(event) => updateRowState(document.id, "linkedTaskId", event.target.value)}
                        value={rowState.linkedTaskId}
                      >
                        <option value="">{isZh ? "不关联任务" : "No linked task"}</option>
                        {taskOptions.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>

                    <FormField label={isZh ? "状态" : "Status"}>
                      <SelectInput
                        onChange={(event) => updateRowState(document.id, "statusKey", event.target.value)}
                        value={rowState.statusKey}
                      >
                        {documentStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {isZh ? option.zhLabel : option.enLabel}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>

                    <CheckboxField className="office-document-inline-checkbox" label={isZh ? "必需文档" : "Required document"}>
                      <input
                        checked={rowState.isRequired}
                        onChange={(event) => updateRowState(document.id, "isRequired", event.target.checked)}
                        type="checkbox"
                      />
                    </CheckboxField>

                    <div className="office-document-edit-actions">
                      <Button
                        disabled={pendingAction === `save:${document.id}`}
                        onClick={() => handleSaveDocument(document.id)}
                        size="sm"
                      >
                        {pendingAction === `save:${document.id}` ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存" : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <EmptyState
            description={isZh ? "上传文件，或从未整理队列移入一份文件。" : "Upload a file or move one in from the unsorted queue."}
            title={isZh ? "没有匹配的交易文档。" : "No matching transaction documents."}
          />
        )}
      </div>

      {canManageDocuments ? (
        <div className="office-document-upload-panel">
          <div className="office-card-head office-card-head-inline">
            <h3>{isZh ? "上传文档" : "Upload document"}</h3>
          </div>

          <div className="office-document-upload-grid">
            <FormField label={isZh ? "文件" : "File"}>
              <input
                className="office-file-input"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </FormField>
            <FormField label={isZh ? "标题" : "Title"}>
              <TextInput
                onChange={(event) => setUploadState((current) => ({ ...current, title: event.target.value }))}
                value={uploadState.title}
              />
            </FormField>
            <FormField label={isZh ? "文档类型" : "Document type"}>
              <TextInput
                onChange={(event) => setUploadState((current) => ({ ...current, documentType: event.target.value }))}
                value={uploadState.documentType}
              />
            </FormField>
            <FormField label={isZh ? "关联任务" : "Linked task"}>
              <SelectInput
                onChange={(event) => setUploadState((current) => ({ ...current, linkedTaskId: event.target.value }))}
                value={uploadState.linkedTaskId}
              >
                <option value="">{isZh ? "不关联任务" : "No linked task"}</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <div className="office-document-upload-checkboxes">
              <CheckboxField label={isZh ? "必需文档" : "Required document"}>
                <input
                  checked={uploadState.isRequired}
                  onChange={(event) => setUploadState((current) => ({ ...current, isRequired: event.target.checked }))}
                  type="checkbox"
                />
              </CheckboxField>
              <CheckboxField label={isZh ? "先放入未整理" : "Start as unsorted"}>
                <input
                  checked={uploadState.isUnsorted}
                  onChange={(event) => setUploadState((current) => ({ ...current, isUnsorted: event.target.checked }))}
                  type="checkbox"
                />
              </CheckboxField>
            </div>
          </div>

          <div className="office-document-edit-actions">
            <Button disabled={!selectedFile || pendingAction === "upload"} onClick={handleUpload}>
              {pendingAction === "upload" ? (isZh ? "上传中..." : "Uploading...") : isZh ? "上传文档" : "Upload document"}
            </Button>
          </div>
        </div>
      ) : null}

        {error ? <p className="office-form-error">{error}</p> : null}
      </section>

      <ConfirmActionDialog
        cancelLabel={isZh ? "保留文档" : "Keep document"}
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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
        throw new Error(body?.error ?? (isZh ? "文档更新失败。" : "Document update failed."));
      }

      router.refresh();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : isZh ? "文档更新失败。" : "Document update failed.");
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
        throw new Error(body?.error ?? (isZh ? "文档删除失败。" : "Document delete failed."));
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : isZh ? "文档删除失败。" : "Document delete failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="office-detail-card" id="transaction-unsorted-documents">
      <div className="office-card-head">
        <div>
          <h3>{isZh ? "未整理文档" : "Unsorted documents"}</h3>
          <span>{isZh ? "已进入这笔交易、但还没有整理到主流程中的文件。" : "Files that entered this transaction but have not been organized into the main workflow."}</span>
        </div>
      </div>

      <div className="office-document-list">
        {unsortedDocuments.length > 0 ? (
          unsortedDocuments.map((document) => (
            <article className="office-document-row" key={document.id}>
              <div className="office-document-row-top">
                <div className="office-document-row-copy">
                  <div className="office-document-row-head">
                    <strong>{document.title}</strong>
                    <StatusBadge tone="warning">{isZh ? "未整理" : "Unsorted"}</StatusBadge>
                    <StatusBadge tone={getDocumentTone(document.statusKey)}>{getDocumentStatusLabel(document, isZh)}</StatusBadge>
                  </div>
                  <p>
                    {document.documentType} · {document.fileName}
                  </p>
                </div>

                <div className="office-document-row-actions">
                  {canViewDocuments ? (
                    <Link className="office-button-secondary office-inline-action-sm" href={document.storageUrl} target="_blank">
                      {isZh ? "打开" : "Open"}
                    </Link>
                  ) : null}
                  {canManageDocuments ? (
                    <Button
                      className="office-inline-action-sm"
                      disabled={pendingAction === `delete:${document.id}`}
                      onClick={() =>
                        setConfirmDialog({
                          title: isZh ? `删除 ${document.title}？` : `Delete ${document.title}?`,
                          description: isZh ? "这会从交易中永久移除这份未整理文档及其已存储文件。" : "This permanently removes this unsorted document and its stored file from the transaction.",
                          confirmLabel: isZh ? "删除文档" : "Delete document",
                          onConfirm: () => {
                            void handleDelete(document.id);
                          }
                        })
                      }
                      size="sm"
                      variant="danger"
                    >
                      {pendingAction === `delete:${document.id}` ? (isZh ? "删除中..." : "Deleting...") : isZh ? "删除" : "Delete"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {canManageDocuments ? (
                <div className="office-document-edit-grid">
                  <FormField label={isZh ? "移入任务" : "Move into task"}>
                    <SelectInput
                      onChange={(event) =>
                        setTaskSelections((current) => ({
                          ...current,
                          [document.id]: event.target.value
                        }))
                      }
                      value={taskSelections[document.id] ?? ""}
                    >
                      <option value="">{isZh ? "不关联任务" : "No linked task"}</option>
                      {taskOptions.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <div className="office-document-edit-actions">
                    <Button
                      disabled={pendingAction === `move:${document.id}`}
                      onClick={() => handleMoveToStructured(document.id)}
                      size="sm"
                    >
                      {pendingAction === `move:${document.id}` ? (isZh ? "移动中..." : "Moving...") : isZh ? "移到文档" : "Move to documents"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState
            description={isZh ? "标记为未整理的上传文件会显示在这里，直到被放入流程。" : "Uploaded files marked as unsorted appear here until they are moved into the workflow."}
            title={isZh ? "没有未整理文档。" : "No unsorted documents."}
          />
        )}
      </div>

        {error ? <p className="office-form-error">{error}</p> : null}
      </section>

      <ConfirmActionDialog
        cancelLabel={isZh ? "保留文档" : "Keep document"}
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
