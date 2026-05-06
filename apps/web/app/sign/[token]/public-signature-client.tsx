"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FormField, TextInput } from "@acre/ui";
import type { OfficeSignatureField, PublicSignatureRequestSnapshot } from "@acre/db";
import { usePdfPreview } from "../../../components/signature/use-pdf-preview";
import { getRecipientEditableFields } from "../../../lib/public-signature-access";
import { SignatureStatusCallout } from "./signature-status-callout";

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

type CalloutState =
  | {
      tone: "info" | "success" | "warning" | "error";
      icon: "clock" | "check" | "x" | "question" | "timer";
      title: string;
      description?: string;
      action?: {
        label: string;
        href: string;
        download?: boolean;
      };
    }
  | null;

function formatStatusDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function buildMailtoHref(address: string | null | undefined, subject: string, body: string) {
  const params = new URLSearchParams({
    subject,
    body
  });

  return `mailto:${address?.trim() || ""}?${params.toString()}`;
}

function buildSignedCopyAction(token: string) {
  return {
    label: "下载已签署副本",
    href: `/api/public/signatures/${encodeURIComponent(token)}/document`,
    download: true
  };
}

function buildStatusCallout(snapshot: PublicSignatureRequestSnapshot, token: string): CalloutState {
  const senderDisplayName = snapshot.request.senderDisplayName || "发送人";
  const requestNewLinkAction = {
    label: "请求新链接",
    href: buildMailtoHref(
      snapshot.request.senderReplyTo,
      `Request a new signing link for ${snapshot.document.title}`,
      `Hi ${senderDisplayName},\n\nThis signing link expired. Please send me a new link for "${snapshot.document.title}".\n\nThank you.`
    )
  };
  const contactSenderAction = {
    label: "联系发送人",
    href: buildMailtoHref(
      snapshot.request.senderReplyTo,
      `Question about ${snapshot.document.title}`,
      `Hi ${senderDisplayName},\n\nI need help with the signing request for "${snapshot.document.title}".\n\nThank you.`
    )
  };

  if (snapshot.request.statusKey === "completed" || snapshot.currentRecipient.statusKey === "acted") {
    return {
      tone: "success",
      icon: "check",
      title: `你已在 ${formatStatusDate(snapshot.currentRecipient.actedAt || snapshot.request.completedAt) || "之前访问时"} 签署过这个文件。`,
      action: buildSignedCopyAction(token)
    };
  }

  if (
    snapshot.request.statusKey === "canceled" ||
    snapshot.request.statusKey === "voided" ||
    snapshot.currentRecipient.statusKey === "voided"
  ) {
    return {
      tone: "info",
      icon: "x",
      title: "发送人已取消这个签署请求。",
      action: contactSenderAction
    };
  }

  if (snapshot.request.statusKey === "expired" || snapshot.currentRecipient.statusKey === "expired") {
    return {
      tone: "warning",
      icon: "clock",
      title: `这个链接已在 ${formatStatusDate(snapshot.request.expiresAt || snapshot.request.expiredAt) || "较早日期"} 过期。`,
      action: requestNewLinkAction
    };
  }

  if (snapshot.request.statusKey === "declined" || snapshot.currentRecipient.statusKey === "declined") {
    return {
      tone: "info",
      icon: "x",
      title: "这个签署请求已被拒签。",
      description: "如果仍需查看这个文件，请联系发送人。",
      action: contactSenderAction
    };
  }

  if (snapshot.currentRecipient.statusKey === "draft" || snapshot.currentRecipient.statusKey === "pending") {
    return {
      tone: "info",
      icon: "timer",
      title: "这个签署步骤尚未激活。",
      description: "请等待发送人激活你的签署顺序。"
    };
  }

  if (snapshot.request.statusKey === "draft" || snapshot.request.statusKey === "pending_send") {
    return {
      tone: "info",
      icon: "timer",
      title: "这个签署请求尚未准备好。",
      description: "发送人仍需完成这个文件的准备。"
    };
  }

  return null;
}

function buildInlineErrorCallout(errorMessage: string): CalloutState {
  if (!errorMessage.trim()) {
    return null;
  }

  if (errorMessage.toLowerCase().includes("too many")) {
    return {
      tone: "info",
      icon: "timer",
      title: "尝试次数过多，请几分钟后再试。"
    };
  }

  return {
    tone: "error",
    icon: "x",
    title: "暂时无法完成该操作。",
    description: errorMessage
  };
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
  const statusCallout = useMemo(() => buildStatusCallout(snapshot, token), [snapshot, token]);
  const submitErrorCallout = useMemo(() => buildInlineErrorCallout(submitError), [submitError]);
  const previewErrorCallout = useMemo(() => buildInlineErrorCallout(previewError), [previewError]);
  const senderDisplayName = snapshot.request.senderDisplayName || "Your Acre agent";
  const expiresLabel = formatStatusDate(snapshot.request.expiresAt);
  const signatureAccessContext = useMemo(
    () => ({
      fields: snapshot.fields,
      recipients: snapshot.request.recipients,
      currentRecipientId: snapshot.currentRecipient.id
    }),
    [snapshot.currentRecipient.id, snapshot.fields, snapshot.request.recipients]
  );
  const editableFields = useMemo(() => getRecipientEditableFields(signatureAccessContext), [signatureAccessContext]);
  const editableFieldCount = editableFields.length;
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
      editableFields.map((field) => ({
        fieldId: field.id,
        fieldType: field.fieldType,
        textValue: values[field.id]?.textValue,
        signatureMode: values[field.id]?.signatureMode,
        imageDataUrl: values[field.id]?.imageDataUrl
      })),
    [editableFields, values]
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
      reader.onerror = () => reject(new Error("无法读取签名图片。"));
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
        throw new Error(payload?.error ?? "无法签署这个文件。");
      }

      setCompleted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "无法签署这个文件。");
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <div className="public-signature-shell">
      <aside className="public-signature-sidebar">
        <div className="public-signature-sidebar-summary">
          <p className="public-signature-eyebrow">Acre 签署请求</p>
          <h1>{snapshot.document.title}</h1>
          <p className="public-signature-sidebar-description">{senderDisplayName} 邀请你签署这个文件。</p>
        </div>

        <div className="public-signature-meta">
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>收件人</strong>
            <span>{snapshot.currentRecipient.name}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>发送人</strong>
            <span>{senderDisplayName}</span>
          </p>
          {expiresLabel ? (
            <p className="public-signature-meta-item public-signature-meta-item-primary">
              <strong>过期时间</strong>
              <span>{expiresLabel}</span>
            </p>
          ) : null}
          <p className="public-signature-meta-item public-signature-meta-item-secondary">
            <strong>邮箱</strong>
            <span>{snapshot.currentRecipient.email}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-secondary">
            <strong>角色</strong>
            <span>{snapshot.currentRecipient.recipientRole || snapshot.currentRecipient.role}</span>
          </p>
        </div>

        <details className="public-signature-sidebar-details">
          <summary>详情</summary>
          <div className="public-signature-sidebar-details-body">
            <p>{senderDisplayName} 邀请你签署这个文件。</p>
            <div className="public-signature-sidebar-details-list">
              <div className="public-signature-sidebar-details-item">
                <strong>邮箱</strong>
                <span>{snapshot.currentRecipient.email}</span>
              </div>
              <div className="public-signature-sidebar-details-item">
                <strong>角色</strong>
                <span>{snapshot.currentRecipient.recipientRole || snapshot.currentRecipient.role}</span>
              </div>
            </div>
            {!completed && !statusCallout ? <p className="public-signature-helper">文件上只显示分配给你的字段。</p> : null}
          </div>
        </details>

        {statusCallout ? (
          <SignatureStatusCallout
            action={statusCallout.action}
            className="public-signature-sidebar-status"
            description={statusCallout.description}
            icon={statusCallout.icon}
            title={statusCallout.title}
            tone={statusCallout.tone}
          />
        ) : null}
        {completed && !statusCallout ? (
          <SignatureStatusCallout
            action={buildSignedCopyAction(token)}
            icon="check"
            title="文件已成功签署。"
            tone="success"
          />
        ) : null}
        {submitErrorCallout ? (
          <SignatureStatusCallout
            action={submitErrorCallout.action}
            description={submitErrorCallout.description}
            icon={submitErrorCallout.icon}
            title={submitErrorCallout.title}
            tone={submitErrorCallout.tone}
          />
        ) : null}
        {!completed && !statusCallout ? <p className="public-signature-helper public-signature-sidebar-helper-desktop">文件上只显示分配给你的字段。</p> : null}

        {!isReadOnly && !completed ? (
          <Button disabled={pendingSubmit} onClick={handleSubmit}>
            {pendingSubmit ? "提交中..." : snapshot.currentRecipient.roleKey === "approver" && editableFieldCount === 0 ? "批准此步骤" : "提交签名"}
          </Button>
        ) : null}
      </aside>

      <main className="public-signature-main">
        {statusCallout ? (
          <SignatureStatusCallout
            action={statusCallout.action}
            className="public-signature-main-status"
            description={statusCallout.description}
            icon={statusCallout.icon}
            title={statusCallout.title}
            tone={statusCallout.tone}
          />
        ) : null}
        {isLoading ? <p className="public-signature-helper">正在加载文件预览...</p> : null}
        {previewErrorCallout ? (
          <SignatureStatusCallout
            action={previewErrorCallout.action}
            description={previewErrorCallout.description}
            icon={previewErrorCallout.icon}
            title={previewErrorCallout.title}
            tone={previewErrorCallout.tone}
          />
        ) : null}

        <div className="public-signature-pages">
          {pages.map((page) => (
            <section className="public-signature-page" key={page.pageNumber}>
              <div className="public-signature-page-label">第 {page.pageNumber} 页</div>
              <div className="public-signature-page-frame">
                <img alt={`可签署文件第 ${page.pageNumber} 页`} height={page.height} src={page.imageUrl} width={page.width} />
                {editableFields
                  .filter((field) => field.page === page.pageNumber)
                  .map((field) => {
                    const currentValue = values[field.id];
                    const isEditable = !isReadOnly;

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
              <h2>添加签名</h2>
              <button onClick={closeSignatureModal} type="button">
                关闭
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
                  {mode === "draw" ? "手写" : mode === "type" ? "输入" : "上传"}
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
                      清除签名
                    </Button>
                  ) : null}
                  <Button onClick={closeSignatureModal} type="button" variant="secondary">
                    完成
                  </Button>
                </div>
              </div>
            ) : null}

            {signatureMode === "type" ? (
              <div className="public-signature-type-panel">
                <FormField label="输入签名">
                  <TextInput onChange={(event) => setTypedSignature(event.target.value)} value={typedSignature} />
                </FormField>
                <div className="public-signature-typed-preview public-signature-typed-preview-large">{typedSignature}</div>
                <div className="public-signature-modal-actions">
                  {hasActiveSignatureValue ? (
                    <Button onClick={clearActiveSignature} type="button" variant="ghost">
                      清除签名
                    </Button>
                  ) : null}
                  <Button onClick={applyTypedSignature} type="button">
                    使用输入签名
                  </Button>
                </div>
              </div>
            ) : null}

            {signatureMode === "upload" ? (
              <div className="public-signature-upload-panel">
                <input
                  accept="image/png,image/jpeg,image/jpg"
                  className="office-file-input"
                  key={uploadInputKey}
                  onChange={handleUploadSignature}
                  type="file"
                />
                <div className="public-signature-modal-actions">
                  {hasActiveSignatureValue ? (
                    <Button onClick={clearActiveSignature} type="button" variant="ghost">
                      清除签名
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
