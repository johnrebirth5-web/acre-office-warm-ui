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
        <p className="public-signature-eyebrow">项目文件</p>
        <h2>{props.document.title}</h2>
      </div>
      {isLoading ? <p className="public-signature-helper">正在加载文件预览...</p> : null}
      {error ? <p className="office-inline-alert office-inline-alert-danger">{error}</p> : null}
      <div className="public-signature-pages">
        {pages.map((page) => (
          <section className="public-signature-page" key={page.pageNumber}>
            <div className="public-signature-page-label">第 {page.pageNumber} 页</div>
            <div className="public-signature-page-frame">
              <img alt={`${props.document.title} 第 ${page.pageNumber} 页`} height={page.height} src={page.imageUrl} width={page.width} />
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
                          aria-label={`添加${getFieldLabel(field)}`}
                          className="public-signature-sign-button"
                          disabled={props.disabled}
                          onClick={() => props.onOpenSignature(field.id)}
                          type="button"
                        >
                          {value?.imageDataUrl ? (
                            <img alt={`${getFieldLabel(field)} preview`} src={value.imageDataUrl} />
                          ) : (
                            <span>点击签名</span>
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
      setMessage("请先手写签名，再保存这个字段。");
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
      return "这个签署链接没有分配任何字段。请联系 Acre 在模板中添加签署字段后重新发送链接。";
    }

    const missingField = assignedFields.find((field) => !isFieldComplete(field, values[field.id]));

    if (missingField) {
      return `请先填写${getFieldLabel(missingField)}，再保存。`;
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
    setMessage("字段已保存。请再检查一遍文件，然后确认完成签署。");
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
      setMessage(error instanceof Error ? error.message : "无法提交签名。");
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
            {isComplete ? "你的签署步骤已完成。" : props.description}
          </p>
        </div>

        <div className="public-signature-meta">
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>收件人</strong>
            <span>{props.recipientName}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>文件</strong>
            <span>{props.documents.length}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>字段</strong>
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
            这个链接没有分配任何签署字段。发送人需要编辑模板字段并重新发送链接。
          </p>
        ) : null}

        <div className="public-signature-sidebar-actions">
          {!isComplete && isReviewing ? (
            <Button disabled={isBusy || !hasAssignedFields} onClick={confirmSignature} type="button">
              {isBusy ? "提交中..." : props.submitLabel ?? "确认签名"}
            </Button>
          ) : !isComplete ? (
            <Button disabled={isBusy || !hasAssignedFields} onClick={saveForReview} type="button">
              保存字段
            </Button>
          ) : (
            <Button disabled type="button">
              已签署
            </Button>
          )}
          {!isComplete && isReviewing ? (
            <Button disabled={isBusy} onClick={() => setIsReviewing(false)} type="button" variant="secondary">
              编辑字段
            </Button>
          ) : null}
          {props.onBack && !isComplete ? (
            <Button disabled={isBusy} onClick={props.onBack} type="button" variant="secondary">
              {props.backLabel ?? "返回"}
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
              <h2>{activeSignatureField ? getFieldLabel(activeSignatureField) : "添加签名"}</h2>
              <button onClick={closeSignatureModal} type="button">
                关闭
              </button>
            </div>
            <p className="public-signature-helper">请在框内签名，然后保存这个签名字段。</p>
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
                清除
              </Button>
              <Button onClick={saveActiveSignature} type="button">
                保存签名
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
