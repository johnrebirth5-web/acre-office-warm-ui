"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FormField, TextInput } from "@acre/ui";
import type { OfficeSignatureField, PublicSignatureRequestSnapshot } from "@acre/db";
import { usePdfPreview } from "../../../components/signature/use-pdf-preview";

type PublicSignatureClientProps = {
  token: string;
  snapshot: PublicSignatureRequestSnapshot;
};

type SignatureValueMap = Record<
  string,
  {
    textValue?: string;
    signatureMode?: "draw" | "type" | "upload";
    imageDataUrl?: string;
  }
>;

function canCurrentRecipientEditField(snapshot: PublicSignatureRequestSnapshot, field: OfficeSignatureField) {
  const actionableRecipients = snapshot.request.recipients.filter((recipient) => recipient.roleKey !== "cc");
  const allowUnassignedField = actionableRecipients.length <= 1;

  if (!field.assignedRecipientId) {
    return allowUnassignedField;
  }

  return field.assignedRecipientId === snapshot.currentRecipient.id;
}

function buildInitialValues(snapshot: PublicSignatureRequestSnapshot): SignatureValueMap {
  const today = new Date().toISOString().slice(0, 10);
  const submittedValuesByFieldId = new Map(
    snapshot.submittedValues.map((value) => [
      value.fieldId,
      {
        textValue: value.textValue || undefined,
        signatureMode: value.signatureMode || undefined,
        imageDataUrl: value.imageDataUrl || undefined
      }
    ])
  );

  return Object.fromEntries(
    snapshot.fields.map((field) => [
      field.id,
      submittedValuesByFieldId.get(field.id) ??
        (field.fieldType === "name"
          ? { textValue: field.defaultValue || snapshot.currentRecipient.name }
          : field.fieldType === "date"
            ? { textValue: field.defaultValue || today }
            : field.fieldType === "text" || field.fieldType === "initials" || field.fieldType === "email" || field.fieldType === "title" || field.fieldType === "company" || field.fieldType === "dropdown"
              ? { textValue: field.defaultValue }
              : {})
    ])
  );
}

function buildStatusMessage(snapshot: PublicSignatureRequestSnapshot) {
  if (snapshot.request.statusKey === "completed") {
    return "This document has already been signed and completed.";
  }

  if (snapshot.request.statusKey === "canceled" || snapshot.request.statusKey === "voided") {
    return "This signature request was canceled.";
  }

  if (snapshot.request.statusKey === "expired") {
    return "This signing link has expired.";
  }

  if (snapshot.request.statusKey === "declined") {
    return "This signature request was declined.";
  }

  if (snapshot.currentRecipient.statusKey === "acted") {
    return "You already completed your signing step.";
  }

  if (snapshot.currentRecipient.statusKey === "declined") {
    return "You already declined this signature request.";
  }

  if (snapshot.currentRecipient.statusKey === "voided" || snapshot.currentRecipient.statusKey === "expired") {
    return "This signing step is no longer active.";
  }

  if (snapshot.currentRecipient.statusKey === "draft" || snapshot.currentRecipient.statusKey === "pending") {
    return "This signing step is not active yet.";
  }

  if (snapshot.request.statusKey === "draft" || snapshot.request.statusKey === "pending_send") {
    return "This signature request is not ready yet.";
  }

  return "";
}

function resetSignatureCanvas(canvas: HTMLCanvasElement | null) {
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 2.4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#0f172a";

  return context;
}

export function PublicSignatureClient({ token, snapshot }: PublicSignatureClientProps) {
  const { pages, isLoading, error: previewError } = usePdfPreview(`/api/public/signatures/${token}/document`);
  const [values, setValues] = useState<SignatureValueMap>(() => buildInitialValues(snapshot));
  const [activeSignatureFieldId, setActiveSignatureFieldId] = useState("");
  const [signatureMode, setSignatureMode] = useState<"draw" | "type" | "upload">("draw");
  const [typedSignature, setTypedSignature] = useState(snapshot.currentRecipient.name);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completed, setCompleted] = useState(snapshot.request.statusKey === "completed");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const statusMessage = buildStatusMessage(snapshot);
  const editableFieldCount = snapshot.fields.filter((field) => canCurrentRecipientEditField(snapshot, field)).length;
  const isReadOnly =
    completed ||
    ["completed", "declined", "canceled", "voided", "expired"].includes(snapshot.request.statusKey) ||
    ["acted", "declined", "voided", "expired", "pending", "draft"].includes(snapshot.currentRecipient.statusKey);

  const activeSignatureValue = activeSignatureFieldId ? values[activeSignatureFieldId] : undefined;
  const hasActiveSignatureValue = Boolean(activeSignatureValue?.imageDataUrl?.trim() || activeSignatureValue?.textValue?.trim());

  useEffect(() => {
    if (!activeSignatureFieldId || !canvasRef.current || signatureMode !== "draw") {
      return;
    }

    const canvas = canvasRef.current;
    const context = resetSignatureCanvas(canvas);
    if (!context) {
      return;
    }

    if (activeSignatureValue?.imageDataUrl?.trim()) {
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = activeSignatureValue.imageDataUrl;
    }
  }, [activeSignatureFieldId, activeSignatureValue?.imageDataUrl, signatureMode]);

  const completionPayload = useMemo(
    () =>
      snapshot.fields.map((field) => ({
        fieldId: field.id,
        fieldType: field.fieldType,
        textValue: values[field.id]?.textValue,
        signatureMode: values[field.id]?.signatureMode,
        imageDataUrl: values[field.id]?.imageDataUrl
      })),
    [snapshot.fields, values]
  );

  function updateFieldValue(fieldId: string, nextValue: SignatureValueMap[string]) {
    setValues((current) => ({
      ...current,
      [fieldId]: {
        ...current[fieldId],
        ...nextValue
      }
    }));
  }

  function clearFieldValue(fieldId: string) {
    setValues((current) => ({
      ...current,
      [fieldId]: {}
    }));
  }

  function openSignatureModal(field: OfficeSignatureField) {
    const currentValue = values[field.id];

    setActiveSignatureFieldId(field.id);
    setSignatureMode(currentValue?.signatureMode ?? "draw");
    setTypedSignature(currentValue?.signatureMode === "type" && currentValue.textValue?.trim() ? currentValue.textValue : snapshot.currentRecipient.name);
  }

  function closeSignatureModal() {
    setActiveSignatureFieldId("");
    setIsDrawing(false);
  }

  function clearActiveSignature() {
    if (!activeSignatureFieldId) {
      return;
    }

    clearFieldValue(activeSignatureFieldId);
    setIsDrawing(false);
    resetSignatureCanvas(canvasRef.current);
    setUploadInputKey((current) => current + 1);
  }

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height
    };
  }

  function handleSignatureCanvasPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const point = getCanvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
  }

  function handleSignatureCanvasPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing || !canvasRef.current) {
      return;
    }

    const context = canvasRef.current.getContext("2d");
    if (!context) {
      return;
    }

    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    updateFieldValue(activeSignatureFieldId, {
      signatureMode: "draw",
      imageDataUrl: canvasRef.current.toDataURL("image/png")
    });
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function applyTypedSignature() {
    updateFieldValue(activeSignatureFieldId, {
      signatureMode: "type",
      textValue: typedSignature,
      imageDataUrl: undefined
    });
    closeSignatureModal();
  }

  async function handleUploadSignature(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("The signature image could not be read."));
      reader.readAsDataURL(file);
    });

    updateFieldValue(activeSignatureFieldId, {
      signatureMode: "upload",
      imageDataUrl,
      textValue: undefined
    });
    closeSignatureModal();
  }

  async function handleSubmit() {
    setPendingSubmit(true);
    setSubmitError("");

    try {
      const response = await fetch(`/api/public/signatures/${token}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: completionPayload
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "The document could not be signed.");
      }

      setCompleted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The document could not be signed.");
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <div className="public-signature-shell">
      <aside className="public-signature-sidebar">
        <p className="public-signature-eyebrow">Acre signature request</p>
        <h1>{snapshot.document.title}</h1>
        <p>{snapshot.request.senderDisplayName || "Your Acre agent"} invited you to sign this document.</p>

        <div className="public-signature-meta">
          <p>
            <strong>Recipient</strong>
            <span>{snapshot.currentRecipient.name}</span>
          </p>
          <p>
            <strong>Email</strong>
            <span>{snapshot.currentRecipient.email}</span>
          </p>
          <p>
            <strong>Role</strong>
            <span>{snapshot.currentRecipient.recipientRole || snapshot.currentRecipient.role}</span>
          </p>
          {snapshot.request.expiresAt ? (
            <p>
              <strong>Expires</strong>
              <span>{snapshot.request.expiresAt.slice(0, 10)}</span>
            </p>
          ) : null}
        </div>

        {statusMessage && !completed ? <p className="public-signature-alert">{statusMessage}</p> : null}
        {completed ? <p className="public-signature-success">The document has been signed successfully. You can close this page.</p> : null}
        {submitError ? <p className="public-signature-alert">{submitError}</p> : null}

        {!isReadOnly && !completed ? (
          <Button disabled={pendingSubmit} onClick={handleSubmit}>
            {pendingSubmit ? "Submitting..." : snapshot.currentRecipient.roleKey === "approver" && editableFieldCount === 0 ? "Approve step" : "Submit signature"}
          </Button>
        ) : null}
      </aside>

      <main className="public-signature-main">
        {isLoading ? <p className="public-signature-helper">Loading document preview…</p> : null}
        {previewError ? <p className="public-signature-alert">{previewError}</p> : null}

        <div className="public-signature-pages">
          {pages.map((page) => (
            <section className="public-signature-page" key={page.pageNumber}>
              <div className="public-signature-page-label">Page {page.pageNumber}</div>
              <div className="public-signature-page-frame">
                <img alt={`Signable document page ${page.pageNumber}`} height={page.height} src={page.imageUrl} width={page.width} />
                {snapshot.fields
                  .filter((field) => field.page === page.pageNumber)
                  .map((field) => {
                    const currentValue = values[field.id];
                    const isEditable = canCurrentRecipientEditField(snapshot, field) && !isReadOnly;

                    return (
                      <div
                        className={`public-signature-field public-signature-field-${field.fieldType}`}
                        key={field.id}
                        style={{
                          left: `${field.x * 100}%`,
                          top: `${field.y * 100}%`,
                          width: `${field.width * 100}%`,
                          height: `${field.height * 100}%`
                        }}
                      >
                        {field.fieldType === "signature" ? (
                          <button
                            className="public-signature-sign-button"
                            disabled={!isEditable}
                            onClick={() => openSignatureModal(field)}
                            type="button"
                          >
                            {currentValue?.signatureMode === "type" && currentValue.textValue ? (
                              <span className="public-signature-typed-preview">{currentValue.textValue}</span>
                            ) : currentValue?.imageDataUrl ? (
                              <img alt={`${field.label} preview`} src={currentValue.imageDataUrl} />
                            ) : (
                              <span>{field.label}</span>
                            )}
                          </button>
                        ) : field.fieldType === "text" ? (
                          <textarea
                            className="public-signature-textarea"
                            disabled={!isEditable}
                            onChange={(event) => updateFieldValue(field.id, { textValue: event.target.value })}
                            value={currentValue?.textValue ?? ""}
                          />
                        ) : (
                          <input
                            className="public-signature-input"
                            disabled={!isEditable}
                            onChange={(event) => updateFieldValue(field.id, { textValue: event.target.value })}
                            value={currentValue?.textValue ?? ""}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      </main>

      {activeSignatureFieldId ? (
        <div className="public-signature-modal" onClick={closeSignatureModal}>
          <div className="public-signature-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="public-signature-modal-head">
              <h2>Add signature</h2>
              <button onClick={closeSignatureModal} type="button">
                Close
              </button>
            </div>

            <div className="public-signature-mode-strip">
              {(["draw", "type", "upload"] as const).map((mode) => (
                <button
                  className={`office-toggle-link${signatureMode === mode ? " is-active" : ""}`}
                  key={mode}
                  onClick={() => setSignatureMode(mode)}
                  type="button"
                >
                  {mode === "draw" ? "Draw" : mode === "type" ? "Type" : "Upload"}
                </button>
              ))}
            </div>

            {signatureMode === "draw" ? (
              <div className="public-signature-draw-panel">
                <canvas
                  className="public-signature-canvas"
                  height={180}
                  onPointerDown={handleSignatureCanvasPointerDown}
                  onPointerMove={handleSignatureCanvasPointerMove}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  ref={canvasRef}
                  width={460}
                />
                <div className="public-signature-modal-actions">
                  {hasActiveSignatureValue ? (
                    <Button onClick={clearActiveSignature} type="button" variant="ghost">
                      Clear signature
                    </Button>
                  ) : null}
                  <Button onClick={closeSignatureModal} type="button" variant="secondary">
                    Done
                  </Button>
                </div>
              </div>
            ) : null}

            {signatureMode === "type" ? (
              <div className="public-signature-type-panel">
                <FormField label="Typed signature">
                  <TextInput onChange={(event) => setTypedSignature(event.target.value)} value={typedSignature} />
                </FormField>
                <div className="public-signature-typed-preview public-signature-typed-preview-large">{typedSignature}</div>
                <div className="public-signature-modal-actions">
                  {hasActiveSignatureValue ? (
                    <Button onClick={clearActiveSignature} type="button" variant="ghost">
                      Clear signature
                    </Button>
                  ) : null}
                  <Button onClick={applyTypedSignature} type="button">
                    Use typed signature
                  </Button>
                </div>
              </div>
            ) : null}

            {signatureMode === "upload" ? (
              <div className="public-signature-upload-panel">
                <input accept="image/png,image/jpeg,image/jpg" key={uploadInputKey} onChange={handleUploadSignature} type="file" />
                <div className="public-signature-modal-actions">
                  {hasActiveSignatureValue ? (
                    <Button onClick={clearActiveSignature} type="button" variant="ghost">
                      Clear signature
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
