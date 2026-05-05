"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@acre/ui";
import { usePdfPreview } from "../../../components/signature/use-pdf-preview";

export type ProjectSigningField = {
  id: string;
  fieldType: string;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  defaultValue: string;
  required: boolean;
};

export type ProjectSigningDocument = {
  id: string;
  title: string;
  documentUrl: string;
  fields: ProjectSigningField[];
};

export type ProjectSigningSubmitValue = {
  fieldId: string;
  fieldType: string;
  textValue?: string;
  signatureMode?: "draw" | "type" | "upload";
  imageDataUrl?: string;
};

type ProjectSigningValueMap = Record<
  string,
  {
    textValue?: string;
    signatureMode?: "draw" | "type" | "upload";
    imageDataUrl?: string;
  }
>;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getFieldLabel(field: ProjectSigningField) {
  return field.label || field.fieldType;
}

function buildInitialValues(input: {
  documents: ProjectSigningDocument[];
  recipientName: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initials = getInitials(input.recipientName);
  const values: ProjectSigningValueMap = {};

  for (const field of input.documents.flatMap((document) => document.fields)) {
    if (field.fieldType === "signature") {
      values[field.id] = {
        signatureMode: "draw",
      };
      continue;
    }

    if (field.fieldType === "initials") {
      values[field.id] = {
        textValue: field.defaultValue || initials || input.recipientName,
      };
      continue;
    }

    if (field.fieldType === "date") {
      values[field.id] = {
        textValue: field.defaultValue || today,
      };
      continue;
    }

    if (field.fieldType === "name") {
      values[field.id] = {
        textValue: field.defaultValue || input.recipientName,
      };
      continue;
    }

    values[field.id] = {
      textValue: field.defaultValue,
    };
  }

  return values;
}

function resetSignatureCanvas(canvas: HTMLCanvasElement | null) {
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#0f172a";

  return context;
}

function isFieldComplete(field: ProjectSigningField, value: ProjectSigningValueMap[string]) {
  if (!field.required && field.fieldType !== "signature") {
    return true;
  }

  if (field.fieldType === "signature") {
    return Boolean(value?.imageDataUrl?.trim() || value?.textValue?.trim());
  }

  if (field.fieldType === "checkbox") {
    return Boolean(value?.textValue?.trim());
  }

  return Boolean(value?.textValue?.trim());
}

function ProjectSigningDocumentPreview(props: {
  document: ProjectSigningDocument;
  disabled: boolean;
  values: ProjectSigningValueMap;
  onChange: (fieldId: string, value: ProjectSigningValueMap[string]) => void;
  onOpenSignature: (fieldId: string) => void;
}) {
  const { pages, isLoading, error } = usePdfPreview(props.document.documentUrl);

  return (
    <section className="public-signature-document">
      <div className="public-signature-document-heading">
        <p className="public-signature-eyebrow">Project document</p>
        <h2>{props.document.title}</h2>
      </div>
      {isLoading ? <p className="public-signature-helper">Loading document preview...</p> : null}
      {error ? <p className="office-inline-alert office-inline-alert-danger">{error}</p> : null}
      <div className="public-signature-pages">
        {pages.map((page) => (
          <section className="public-signature-page" key={page.pageNumber}>
            <div className="public-signature-page-label">Page {page.pageNumber}</div>
            <div className="public-signature-page-frame">
              <img alt={`${props.document.title} page ${page.pageNumber}`} height={page.height} src={page.imageUrl} width={page.width} />
              {props.document.fields
                .filter((field) => field.page === page.pageNumber)
                .map((field) => {
                  const value = props.values[field.id];

                  return (
                    <div
                      className={`public-signature-field public-signature-field-${field.fieldType}`}
                      key={field.id}
                      style={{
                        left: `${field.x * 100}%`,
                        top: `${field.y * 100}%`,
                        width: `${field.width * 100}%`,
                        height: `${field.height * 100}%`,
                      }}
                    >
                      {field.fieldType === "signature" ? (
                        <button
                          aria-label={`Add ${getFieldLabel(field)}`}
                          className="public-signature-sign-button"
                          disabled={props.disabled}
                          onClick={() => props.onOpenSignature(field.id)}
                          type="button"
                        >
                          {value?.imageDataUrl ? (
                            <img alt={`${getFieldLabel(field)} preview`} src={value.imageDataUrl} />
                          ) : (
                            <span>Tap to sign</span>
                          )}
                        </button>
                      ) : field.fieldType === "text" ? (
                        <textarea
                          aria-label={getFieldLabel(field)}
                          className="public-signature-textarea"
                          disabled={props.disabled}
                          onChange={(event) => props.onChange(field.id, { textValue: event.target.value })}
                          placeholder={getFieldLabel(field)}
                          value={value?.textValue ?? ""}
                        />
                      ) : field.fieldType === "checkbox" ? (
                        <input
                          aria-label={getFieldLabel(field)}
                          checked={value?.textValue === "true"}
                          className="public-signature-checkbox"
                          disabled={props.disabled}
                          onChange={(event) => props.onChange(field.id, { textValue: event.target.checked ? "true" : "" })}
                          type="checkbox"
                        />
                      ) : (
                        <input
                          aria-label={getFieldLabel(field)}
                          className="public-signature-input"
                          disabled={props.disabled}
                          onChange={(event) => props.onChange(field.id, { textValue: event.target.value })}
                          placeholder={getFieldLabel(field)}
                          value={value?.textValue ?? ""}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export function ProjectSigningExperience(props: {
  title: string;
  eyebrow: string;
  description: string;
  recipientName: string;
  documents: ProjectSigningDocument[];
  submitLabel?: string;
  completeMessage: string;
  onSubmit: (values: ProjectSigningSubmitValue[]) => Promise<void>;
  onBack?: () => void;
  backLabel?: string;
}) {
  const assignedFields = useMemo(() => props.documents.flatMap((document) => document.fields), [props.documents]);
  const [values, setValues] = useState<ProjectSigningValueMap>(() =>
    buildInitialValues({
      documents: props.documents,
      recipientName: props.recipientName,
    }),
  );
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "danger">("info");
  const [isBusy, setIsBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [activeSignatureFieldId, setActiveSignatureFieldId] = useState("");
  const [hasSignatureInk, setHasSignatureInk] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasAssignedFields = assignedFields.length > 0;
  const activeSignatureField = assignedFields.find((field) => field.id === activeSignatureFieldId) ?? null;
  const activeSignatureValue = activeSignatureFieldId ? values[activeSignatureFieldId] : undefined;

  useEffect(() => {
    if (!activeSignatureFieldId || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = resetSignatureCanvas(canvas);
    const existingSignature = activeSignatureValue?.imageDataUrl?.trim();
    setHasSignatureInk(Boolean(existingSignature));

    if (!context || !existingSignature) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = existingSignature;
  }, [activeSignatureFieldId, activeSignatureValue?.imageDataUrl]);

  function updateFieldValue(fieldId: string, nextValue: ProjectSigningValueMap[string]) {
    setValues((current) => ({
      ...current,
      [fieldId]: {
        ...current[fieldId],
        ...nextValue,
      },
    }));
    setIsReviewing(false);
    setMessage("");
  }

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function handleSignaturePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.stroke();
    setHasSignatureInk(true);
    setIsDrawing(true);
  }

  function handleSignaturePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
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
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearActiveSignature() {
    if (!activeSignatureFieldId) {
      return;
    }

    setValues((current) => ({
      ...current,
      [activeSignatureFieldId]: {
        ...current[activeSignatureFieldId],
        signatureMode: "draw",
        imageDataUrl: undefined,
        textValue: undefined,
      },
    }));
    setHasSignatureInk(false);
    setIsReviewing(false);
    resetSignatureCanvas(canvasRef.current);
  }

  function closeSignatureModal() {
    setActiveSignatureFieldId("");
    setHasSignatureInk(false);
    setIsDrawing(false);
  }

  function saveActiveSignature() {
    if (!activeSignatureFieldId || !canvasRef.current) {
      return;
    }

    if (!hasSignatureInk) {
      setMessageTone("danger");
      setMessage("Draw your signature before saving this field.");
      return;
    }

    updateFieldValue(activeSignatureFieldId, {
      signatureMode: "draw",
      imageDataUrl: canvasRef.current.toDataURL("image/png"),
      textValue: undefined,
    });
    closeSignatureModal();
  }

  function validateCompletion() {
    if (!hasAssignedFields) {
      return "This signing link has no fields assigned. Ask Acre to add signing fields to the template and send a new link.";
    }

    const missingField = assignedFields.find((field) => !isFieldComplete(field, values[field.id]));

    if (missingField) {
      return `Complete ${getFieldLabel(missingField)} before saving.`;
    }

    return null;
  }

  function buildPayloadValues(): ProjectSigningSubmitValue[] {
    return assignedFields.map((field) => {
      const value = values[field.id] ?? {};

      return {
        fieldId: field.id,
        fieldType: field.fieldType,
        textValue: value.textValue,
        signatureMode: field.fieldType === "signature" ? value.signatureMode ?? "draw" : undefined,
        imageDataUrl: field.fieldType === "signature" ? value.imageDataUrl : undefined,
      };
    });
  }

  function saveForReview() {
    const validationError = validateCompletion();

    if (validationError) {
      setMessageTone("danger");
      setMessage(validationError);
      return;
    }

    setIsReviewing(true);
    setMessageTone("info");
    setMessage("Fields saved. Review the document one more time, then confirm to complete signing.");
  }

  async function confirmSignature() {
    const validationError = validateCompletion();

    if (validationError) {
      setIsReviewing(false);
      setMessageTone("danger");
      setMessage(validationError);
      return;
    }

    setIsBusy(true);
    setMessage("");

    try {
      await props.onSubmit(buildPayloadValues());
      setIsComplete(true);
      setIsReviewing(false);
      setMessageTone("info");
      setMessage(props.completeMessage);
    } catch (error) {
      setMessageTone("danger");
      setMessage(error instanceof Error ? error.message : "Signature could not be submitted.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="public-signature-shell">
      <aside className="public-signature-sidebar">
        <div className="public-signature-sidebar-summary">
          <p className="public-signature-eyebrow">{props.eyebrow}</p>
          <h1>{props.title}</h1>
          <p className="public-signature-sidebar-description">
            {isComplete ? "Your signing step is complete." : props.description}
          </p>
        </div>

        <div className="public-signature-meta">
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>Recipient</strong>
            <span>{props.recipientName}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>Documents</strong>
            <span>{props.documents.length}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>Fields</strong>
            <span>{assignedFields.length}</span>
          </p>
        </div>

        {message ? (
          <p className={`office-inline-alert ${messageTone === "info" ? "office-inline-alert-info" : "office-inline-alert-danger"}`}>
            {message}
          </p>
        ) : null}
        {!hasAssignedFields ? (
          <p className="office-inline-alert office-inline-alert-danger">
            This link has no signing fields assigned. The sender needs to edit the template fields and send a new link.
          </p>
        ) : null}

        <div className="public-signature-sidebar-actions">
          {!isComplete && isReviewing ? (
            <Button disabled={isBusy || !hasAssignedFields} onClick={confirmSignature} type="button">
              {isBusy ? "Submitting..." : props.submitLabel ?? "Confirm signature"}
            </Button>
          ) : !isComplete ? (
            <Button disabled={isBusy || !hasAssignedFields} onClick={saveForReview} type="button">
              Save fields
            </Button>
          ) : (
            <Button disabled type="button">
              Signed
            </Button>
          )}
          {!isComplete && isReviewing ? (
            <Button disabled={isBusy} onClick={() => setIsReviewing(false)} type="button" variant="secondary">
              Edit fields
            </Button>
          ) : null}
          {props.onBack && !isComplete ? (
            <Button disabled={isBusy} onClick={props.onBack} type="button" variant="secondary">
              {props.backLabel ?? "Back"}
            </Button>
          ) : null}
        </div>
      </aside>

      <main className="public-signature-main">
        {props.documents.map((document) => (
          <ProjectSigningDocumentPreview
            disabled={isBusy || isComplete}
            document={document}
            key={document.id}
            onChange={updateFieldValue}
            onOpenSignature={setActiveSignatureFieldId}
            values={values}
          />
        ))}
      </main>

      {activeSignatureFieldId ? (
        <div className="public-signature-modal" onClick={closeSignatureModal}>
          <div className="public-signature-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="public-signature-modal-head">
              <h2>{activeSignatureField ? getFieldLabel(activeSignatureField) : "Add signature"}</h2>
              <button onClick={closeSignatureModal} type="button">
                Close
              </button>
            </div>
            <p className="public-signature-helper">Sign inside the box, then save this signature field.</p>
            <canvas
              className="public-signature-canvas"
              height={260}
              onPointerDown={handleSignaturePointerDown}
              onPointerLeave={stopDrawing}
              onPointerMove={handleSignaturePointerMove}
              onPointerUp={stopDrawing}
              ref={canvasRef}
              width={720}
            />
            <div className="public-signature-modal-actions">
              <Button onClick={clearActiveSignature} type="button" variant="ghost">
                Clear
              </Button>
              <Button onClick={saveActiveSignature} type="button">
                Save signature
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
