"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckboxField, FormField, StatusBadge, TextInput, TextareaInput } from "@acre/ui";
import type { OfficeSignatureAuditEntry, OfficeSignatureField, OfficeSignatureRequest, OfficeTransactionDocument } from "@acre/db";
import { usePdfPreview } from "../../../../../components/signature/use-pdf-preview";

type SignatureRequestEditorProps = {
  transactionId: string;
  document: OfficeTransactionDocument;
  initialRequest: OfficeSignatureRequest | null;
  initialFields: OfficeSignatureField[];
  initialAuditEntries: OfficeSignatureAuditEntry[];
  defaultSenderDisplayName: string;
  defaultReplyTo: string;
};

type SignatureDraftState = {
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  emailSubject: string;
  emailBody: string;
  expiresAt: string;
  senderDisplayName: string;
  senderReplyTo: string;
};

const fieldDefaults: Record<OfficeSignatureField["fieldType"], { label: string; width: number; height: number; fontStyle?: string }> = {
  signature: { label: "Signature", width: 0.26, height: 0.08, fontStyle: "signature" },
  date: { label: "Date", width: 0.18, height: 0.05 },
  name: { label: "Name", width: 0.24, height: 0.05 },
  text: { label: "Text", width: 0.24, height: 0.06 }
};

function buildDraftState(
  document: OfficeTransactionDocument,
  request: OfficeSignatureRequest | null,
  defaultSenderDisplayName: string,
  defaultReplyTo: string
): SignatureDraftState {
  return {
    recipientName: request?.recipientName ?? "",
    recipientEmail: request?.recipientEmail ?? "",
    recipientRole: request?.recipientRole ?? "Signer",
    emailSubject: request?.emailSubject ?? `Signature requested: ${document.title}`,
    emailBody: request?.emailBody ?? `${defaultSenderDisplayName} sent you a document to review and sign in Acre.`,
    expiresAt: request?.expiresAt ? request.expiresAt.slice(0, 10) : "",
    senderDisplayName: request?.senderDisplayName || defaultSenderDisplayName,
    senderReplyTo: request?.senderReplyTo || defaultReplyTo
  };
}

function getRequestTone(statusKey: OfficeSignatureRequest["statusKey"]) {
  if (statusKey === "completed") {
    return "success" as const;
  }

  if (statusKey === "canceled" || statusKey === "declined" || statusKey === "expired") {
    return "danger" as const;
  }

  if (statusKey === "sent" || statusKey === "viewed" || statusKey === "signed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function SignatureRequestEditor({
  transactionId,
  document,
  initialRequest,
  initialFields,
  initialAuditEntries,
  defaultSenderDisplayName,
  defaultReplyTo
}: SignatureRequestEditorProps) {
  const router = useRouter();
  const { pages, isLoading, error: previewError } = usePdfPreview(document.storageUrl);
  const [requestId, setRequestId] = useState(initialRequest?.id ?? "");
  const [requestStatus, setRequestStatus] = useState<OfficeSignatureRequest["statusKey"]>(initialRequest?.statusKey ?? "draft");
  const [draftState, setDraftState] = useState<SignatureDraftState>(
    buildDraftState(document, initialRequest, defaultSenderDisplayName, defaultReplyTo)
  );
  const [fields, setFields] = useState<OfficeSignatureField[]>(initialFields);
  const [auditEntries] = useState<OfficeSignatureAuditEntry[]>(initialAuditEntries);
  const [selectedTool, setSelectedTool] = useState<OfficeSignatureField["fieldType"]>("signature");
  const [selectedFieldId, setSelectedFieldId] = useState<string>(initialFields[0]?.id ?? "");
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId]
  );

  useEffect(() => {
    if (!draggingFieldId) {
      return;
    }

    function handlePointerUp() {
      setDraggingFieldId(null);
    }

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [draggingFieldId]);

  function updateDraftField(field: keyof SignatureDraftState, value: string) {
    setDraftState((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateField(fieldId: string, changes: Partial<OfficeSignatureField>) {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...changes
            }
          : field
      )
    );
  }

  function handleAddField(pageNumber: number, event: React.MouseEvent<HTMLDivElement>) {
    const currentTarget = event.currentTarget;
    const bounds = currentTarget.getBoundingClientRect();
    const defaults = fieldDefaults[selectedTool];
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const nextField: OfficeSignatureField = {
      id,
      signatureRequestId: requestId,
      fieldType: selectedTool,
      label: defaults.label,
      page: pageNumber,
      x: Math.min(0.92 - defaults.width, Math.max(0.02, relativeX - defaults.width / 2)),
      y: Math.min(0.94 - defaults.height, Math.max(0.02, relativeY - defaults.height / 2)),
      width: defaults.width,
      height: defaults.height,
      required: true,
      defaultValue: selectedTool === "date" ? new Date().toISOString().slice(0, 10) : "",
      fontStyle: defaults.fontStyle ?? "",
      sortOrder: fields.length
    };

    setFields((current) => [...current, nextField]);
    setSelectedFieldId(id);
    setSuccessMessage("");
  }

  function handleFieldPointerDown(fieldId: string) {
    setDraggingFieldId(fieldId);
    setSelectedFieldId(fieldId);
  }

  function handleFieldPointerMove(pageNumber: number, event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingFieldId) {
      return;
    }

    const currentTarget = event.currentTarget;
    const bounds = currentTarget.getBoundingClientRect();
    const field = fields.find((entry) => entry.id === draggingFieldId);

    if (!field || field.page !== pageNumber) {
      return;
    }

    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    updateField(field.id, {
      x: Math.min(0.98 - field.width, Math.max(0.02, relativeX - field.width / 2)),
      y: Math.min(0.98 - field.height, Math.max(0.02, relativeY - field.height / 2))
    });
  }

  function removeField(fieldId: string) {
    setFields((current) => current.filter((field) => field.id !== fieldId));
    setSelectedFieldId((current) => (current === fieldId ? "" : current));
  }

  async function saveDraft(sendAfterSave: boolean) {
    if (!draftState.recipientName.trim() || !draftState.recipientEmail.trim()) {
      setError("Recipient name and email are required.");
      return;
    }

    if (!fields.length) {
      setError("Add at least one signature field before saving.");
      return;
    }

    setPendingAction(sendAfterSave ? "send" : "save");
    setError("");
    setSuccessMessage("");

    try {
      const requestResponse = await fetch(`/api/office/transactions/${transactionId}/signatures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signatureRequestId: requestId || null,
          documentId: document.id,
          recipientName: draftState.recipientName,
          recipientEmail: draftState.recipientEmail,
          recipientRole: draftState.recipientRole,
          emailSubject: draftState.emailSubject,
          emailBody: draftState.emailBody,
          expiresAt: draftState.expiresAt || null,
          senderDisplayName: draftState.senderDisplayName,
          senderReplyTo: draftState.senderReplyTo
        })
      });

      const requestPayload = (await requestResponse.json().catch(() => null)) as
        | { error?: string; signatureRequest?: OfficeSignatureRequest }
        | null;

      if (!requestResponse.ok || !requestPayload?.signatureRequest) {
        throw new Error(requestPayload?.error ?? "Signature draft could not be saved.");
      }

      const nextRequest = requestPayload.signatureRequest;
      const nextRequestId = nextRequest.id;
      setRequestId(nextRequestId);
      setRequestStatus(nextRequest.statusKey);

      const fieldsResponse = await fetch(`/api/office/transactions/${transactionId}/signatures/${nextRequestId}/fields`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: fields.map((field, index) => ({
            ...field,
            sortOrder: index
          }))
        })
      });

      const fieldsPayload = (await fieldsResponse.json().catch(() => null)) as
        | { error?: string; fields?: OfficeSignatureField[] }
        | null;

      if (!fieldsResponse.ok || !fieldsPayload?.fields) {
        throw new Error(fieldsPayload?.error ?? "Signature fields could not be saved.");
      }

      setFields(fieldsPayload.fields);
      if (!requestId) {
        router.replace(`/office/transactions/${transactionId}/signatures/${nextRequestId}`);
      }

      if (sendAfterSave) {
        const sendResponse = await fetch(`/api/office/transactions/${transactionId}/signatures/${nextRequestId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: requestStatus === "sent" || requestStatus === "viewed" || requestStatus === "expired" ? "resend" : "send"
          })
        });

        const sendPayload = (await sendResponse.json().catch(() => null)) as
          | { error?: string; signatureRequest?: OfficeSignatureRequest }
          | null;

        if (!sendResponse.ok || !sendPayload?.signatureRequest) {
          throw new Error(sendPayload?.error ?? "Signature email could not be sent.");
        }

        setRequestStatus(sendPayload.signatureRequest.statusKey);
        setSuccessMessage("Signature request email sent.");
      } else {
        setSuccessMessage("Signature draft saved.");
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Signature draft could not be saved.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRequestAction(action: "canceled" | "expire" | "resend") {
    if (!requestId) {
      return;
    }

    setPendingAction(action);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/signatures/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; signatureRequest?: OfficeSignatureRequest }
        | null;

      if (!response.ok || !payload?.signatureRequest) {
        throw new Error(payload?.error ?? "Signature request update failed.");
      }

      setRequestStatus(payload.signatureRequest.statusKey);
      setSuccessMessage(
        action === "resend"
          ? "Signature request email resent."
          : action === "expire"
            ? "Signature request marked expired."
            : "Signature request canceled."
      );
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Signature request update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="office-signature-editor">
      <div className="office-signature-editor-main">
        <section className="bm-detail-card">
          <div className="bm-card-head">
            <div>
              <h3>PDF signature editor</h3>
              <span>Select a field type, click the PDF to place it, then drag fields into the final position.</span>
            </div>
            {initialRequest ? <StatusBadge tone={getRequestTone(requestStatus)}>{requestStatus}</StatusBadge> : null}
          </div>

          <div className="office-signature-toolbar">
            {(["signature", "date", "name", "text"] as const).map((fieldType) => (
              <button
                className={`office-toggle-link${selectedTool === fieldType ? " is-active" : ""}`}
                key={fieldType}
                onClick={() => setSelectedTool(fieldType)}
                type="button"
              >
                {fieldDefaults[fieldType].label}
              </button>
            ))}
          </div>

          {isLoading ? <p className="office-signature-helper">Loading PDF preview…</p> : null}
          {previewError ? <p className="office-form-error">{previewError}</p> : null}

          <div className="office-signature-preview-stack">
            {pages.map((page) => (
              <div className="office-signature-preview-page" key={page.pageNumber}>
                <div className="office-signature-preview-label">Page {page.pageNumber}</div>
                <div
                  className="office-signature-preview-canvas"
                  onClick={(event) => handleAddField(page.pageNumber, event)}
                  onPointerMove={(event) => handleFieldPointerMove(page.pageNumber, event)}
                >
                  <img alt={`Document page ${page.pageNumber}`} height={page.height} src={page.imageUrl} width={page.width} />
                  {fields
                    .filter((field) => field.page === page.pageNumber)
                    .map((field) => (
                      <div
                        className={`office-signature-field-token${selectedFieldId === field.id ? " is-selected" : ""}`}
                        key={field.id}
                        onPointerDown={() => handleFieldPointerDown(field.id)}
                        style={{
                          left: `${field.x * 100}%`,
                          top: `${field.y * 100}%`,
                          width: `${field.width * 100}%`,
                          height: `${field.height * 100}%`
                        }}
                      >
                        <span>{field.label}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bm-detail-card">
          <div className="bm-card-head">
            <div>
              <h3>Signer and email</h3>
              <span>Configure the recipient, email copy, and optional expiration date before sending.</span>
            </div>
          </div>

          <div className="bm-document-upload-grid">
            <FormField label="Recipient name">
              <TextInput onChange={(event) => updateDraftField("recipientName", event.target.value)} value={draftState.recipientName} />
            </FormField>
            <FormField label="Recipient email">
              <TextInput onChange={(event) => updateDraftField("recipientEmail", event.target.value)} type="email" value={draftState.recipientEmail} />
            </FormField>
            <FormField label="Recipient role">
              <TextInput onChange={(event) => updateDraftField("recipientRole", event.target.value)} value={draftState.recipientRole} />
            </FormField>
            <FormField label="Expires on">
              <TextInput onChange={(event) => updateDraftField("expiresAt", event.target.value)} type="date" value={draftState.expiresAt} />
            </FormField>
            <FormField className="office-form-grid-span-2" label="Email subject">
              <TextInput onChange={(event) => updateDraftField("emailSubject", event.target.value)} value={draftState.emailSubject} />
            </FormField>
            <FormField className="office-form-grid-span-2" label="Sender display name">
              <TextInput onChange={(event) => updateDraftField("senderDisplayName", event.target.value)} value={draftState.senderDisplayName} />
            </FormField>
            <FormField className="office-form-grid-span-2" label="Reply-to email">
              <TextInput onChange={(event) => updateDraftField("senderReplyTo", event.target.value)} type="email" value={draftState.senderReplyTo} />
            </FormField>
            <FormField className="office-form-grid-span-4" label="Email body">
              <TextareaInput onChange={(event) => updateDraftField("emailBody", event.target.value)} rows={5} value={draftState.emailBody} />
            </FormField>
          </div>

          <div className="bm-document-edit-actions">
            <Button disabled={pendingAction === "save"} onClick={() => saveDraft(false)}>
              {pendingAction === "save" ? "Saving..." : "Save draft"}
            </Button>
            <Button disabled={pendingAction === "send"} onClick={() => saveDraft(true)}>
              {pendingAction === "send" ? "Sending..." : requestStatus === "sent" || requestStatus === "viewed" ? "Save & resend" : "Save & send"}
            </Button>
            {requestId ? (
              <>
                <Button disabled={pendingAction === "resend"} onClick={() => handleRequestAction("resend")} variant="secondary">
                  {pendingAction === "resend" ? "Resending..." : "Resend"}
                </Button>
                <Button disabled={pendingAction === "canceled"} onClick={() => handleRequestAction("canceled")} variant="danger">
                  {pendingAction === "canceled" ? "Canceling..." : "Cancel"}
                </Button>
              </>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="office-signature-editor-side">
        <section className="bm-detail-card">
          <div className="bm-card-head">
            <div>
              <h3>Selected field</h3>
              <span>Update the field label, default value, and required state.</span>
            </div>
          </div>

          {selectedField ? (
            <div className="bm-document-upload-grid">
              <FormField label="Label">
                <TextInput onChange={(event) => updateField(selectedField.id, { label: event.target.value })} value={selectedField.label} />
              </FormField>
              <FormField label="Font style">
                <TextInput onChange={(event) => updateField(selectedField.id, { fontStyle: event.target.value })} value={selectedField.fontStyle} />
              </FormField>
              <FormField className="office-form-grid-span-2" label="Default value">
                <TextInput onChange={(event) => updateField(selectedField.id, { defaultValue: event.target.value })} value={selectedField.defaultValue} />
              </FormField>
              <CheckboxField className="bm-document-inline-checkbox" label="Required">
                <input
                  checked={selectedField.required}
                  onChange={(event) => updateField(selectedField.id, { required: event.target.checked })}
                  type="checkbox"
                />
              </CheckboxField>
              <div className="bm-document-edit-actions">
                <Button onClick={() => removeField(selectedField.id)} size="sm" variant="danger">
                  Delete field
                </Button>
              </div>
            </div>
          ) : (
            <p className="office-signature-helper">Select a field on the PDF to edit its settings.</p>
          )}
        </section>

        <section className="bm-detail-card">
          <div className="bm-card-head">
            <div>
              <h3>Document</h3>
              <span>{document.documentType}</span>
            </div>
          </div>

          <div className="office-signature-summary-list">
            <p>
              <strong>{document.title}</strong>
            </p>
            <p>{document.fileName}</p>
            <p>{(document.fileSizeBytes / 1024).toFixed(1)} KB</p>
            <p>
              <Link href={document.storageUrl} target="_blank">
                Open original PDF
              </Link>
            </p>
            {initialRequest?.completedDocumentHref ? (
              <p>
                <Link href={initialRequest.completedDocumentHref} target="_blank">
                  Download signed PDF
                </Link>
              </p>
            ) : null}
          </div>
        </section>

        <section className="bm-detail-card">
          <div className="bm-card-head">
            <div>
              <h3>Audit trail</h3>
              <span>Internal and signer-side events are recorded here after the request is saved.</span>
            </div>
          </div>

          {auditEntries.length > 0 ? (
            <div className="office-signature-audit-list">
              {auditEntries.map((entry) => (
                <article className="office-signature-audit-row" key={entry.id}>
                  <div className="office-signature-audit-head">
                    <strong>{entry.eventLabel}</strong>
                    <span>{entry.createdAt.slice(0, 16).replace("T", " ")}</span>
                  </div>
                  <p>{entry.actorLabel}</p>
                  {entry.details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </article>
              ))}
            </div>
          ) : (
            <p className="office-signature-helper">The audit trail starts once the request has been saved.</p>
          )}
        </section>

        {error ? <p className="office-form-error">{error}</p> : null}
        {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}
      </aside>
    </div>
  );
}
