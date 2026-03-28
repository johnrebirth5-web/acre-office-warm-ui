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

function buildInitialValues(snapshot: PublicSignatureRequestSnapshot): SignatureValueMap {
  const today = new Date().toISOString().slice(0, 10);

  return Object.fromEntries(
    snapshot.fields.map((field) => [
      field.id,
      field.fieldType === "name"
        ? { textValue: field.defaultValue || snapshot.request.recipientName }
        : field.fieldType === "date"
          ? { textValue: field.defaultValue || today }
          : field.fieldType === "text"
            ? { textValue: field.defaultValue }
            : {}
    ])
  );
}

function buildStatusMessage(statusKey: PublicSignatureRequestSnapshot["request"]["statusKey"]) {
  if (statusKey === "completed") {
    return "This document has already been signed and completed.";
  }

  if (statusKey === "canceled") {
    return "This signature request was canceled.";
  }

  if (statusKey === "expired") {
    return "This signing link has expired.";
  }

  if (statusKey === "declined") {
    return "This signature request was declined.";
  }

  if (statusKey === "draft") {
    return "This signature request is not ready yet.";
  }

  return "";
}

export function PublicSignatureClient({ token, snapshot }: PublicSignatureClientProps) {
  const { pages, isLoading, error: previewError } = usePdfPreview(`/api/public/signatures/${token}/document`);
  const [values, setValues] = useState<SignatureValueMap>(() => buildInitialValues(snapshot));
  const [activeSignatureFieldId, setActiveSignatureFieldId] = useState("");
  const [signatureMode, setSignatureMode] = useState<"draw" | "type" | "upload">("draw");
  const [typedSignature, setTypedSignature] = useState(snapshot.request.recipientName);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completed, setCompleted] = useState(snapshot.request.statusKey === "completed");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const statusMessage = buildStatusMessage(snapshot.request.statusKey);
  const isReadOnly = completed || Boolean(statusMessage && snapshot.request.statusKey !== "viewed" && snapshot.request.statusKey !== "sent");

  const activeSignatureValue = activeSignatureFieldId ? values[activeSignatureFieldId] : undefined;

  useEffect(() => {
    if (!activeSignatureFieldId || !canvasRef.current || signatureMode !== "draw") {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";

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
    setActiveSignatureFieldId("");
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
    setActiveSignatureFieldId("");
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
            <span>{snapshot.request.recipientName}</span>
          </p>
          <p>
            <strong>Email</strong>
            <span>{snapshot.request.recipientEmail}</span>
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
            {pendingSubmit ? "Submitting..." : "Submit signature"}
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
                            disabled={isReadOnly}
                            onClick={() => setActiveSignatureFieldId(field.id)}
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
                            disabled={isReadOnly}
                            onChange={(event) => updateFieldValue(field.id, { textValue: event.target.value })}
                            value={currentValue?.textValue ?? ""}
                          />
                        ) : (
                          <input
                            className="public-signature-input"
                            disabled={isReadOnly}
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
        <div className="public-signature-modal" onClick={() => setActiveSignatureFieldId("")}>
          <div className="public-signature-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="public-signature-modal-head">
              <h2>Add signature</h2>
              <button onClick={() => setActiveSignatureFieldId("")} type="button">
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
                  <Button onClick={() => setActiveSignatureFieldId("")} variant="secondary">
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
                  <Button onClick={applyTypedSignature}>Use typed signature</Button>
                </div>
              </div>
            ) : null}

            {signatureMode === "upload" ? (
              <div className="public-signature-upload-panel">
                <input accept="image/png,image/jpeg,image/jpg" onChange={handleUploadSignature} type="file" />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
