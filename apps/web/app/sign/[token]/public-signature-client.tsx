"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FormField, TextInput } from "@acre/ui";
import type { OfficeSignatureField, PublicSignatureRequestSnapshot } from "@acre/db";
import { usePdfPreview } from "../../../components/signature/use-pdf-preview";
import { useI18n } from "../../../lib/i18n/client";
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

function formatStatusDate(value: string | null | undefined, isZh: boolean) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return parsed.toLocaleDateString(isZh ? "zh-CN" : "en-US", {
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

function buildSignedCopyAction(token: string, isZh: boolean) {
  return {
    label: isZh ? "下载已签署副本" : "Download signed copy",
    href: `/api/public/signatures/${encodeURIComponent(token)}/document`,
    download: true
  };
}

function buildStatusCallout(snapshot: PublicSignatureRequestSnapshot, token: string, isZh: boolean): CalloutState {
  const senderDisplayName = snapshot.request.senderDisplayName || (isZh ? "发送人" : "sender");
  const requestNewLinkAction = {
    label: isZh ? "请求新链接" : "Request new link",
    href: buildMailtoHref(
      snapshot.request.senderReplyTo,
      isZh ? `请求新的签署链接：${snapshot.document.title}` : `Request a new signing link for ${snapshot.document.title}`,
      isZh
        ? `${senderDisplayName}，你好：\n\n这个签署链接已过期。请重新发送 "${snapshot.document.title}" 的签署链接。\n\n谢谢。`
        : `Hi ${senderDisplayName},\n\nThis signing link expired. Please send me a new link for "${snapshot.document.title}".\n\nThank you.`
    )
  };
  const contactSenderAction = {
    label: isZh ? "联系发送人" : "Contact sender",
    href: buildMailtoHref(
      snapshot.request.senderReplyTo,
      isZh ? `关于 ${snapshot.document.title} 的问题` : `Question about ${snapshot.document.title}`,
      isZh
        ? `${senderDisplayName}，你好：\n\n我需要协助处理 "${snapshot.document.title}" 的签署请求。\n\n谢谢。`
        : `Hi ${senderDisplayName},\n\nI need help with the signing request for "${snapshot.document.title}".\n\nThank you.`
    )
  };

  if (snapshot.request.statusKey === "completed" || snapshot.currentRecipient.statusKey === "acted") {
    return {
      tone: "success",
      icon: "check",
      title: isZh
        ? `你已在 ${formatStatusDate(snapshot.currentRecipient.actedAt || snapshot.request.completedAt, isZh) || "之前访问时"} 签署过这个文件。`
        : `You signed this file on ${formatStatusDate(snapshot.currentRecipient.actedAt || snapshot.request.completedAt, isZh) || "an earlier visit"}.`,
      action: buildSignedCopyAction(token, isZh)
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
      title: isZh ? "发送人已取消这个签署请求。" : "The sender canceled this signing request.",
      action: contactSenderAction
    };
  }

  if (snapshot.request.statusKey === "expired" || snapshot.currentRecipient.statusKey === "expired") {
    return {
      tone: "warning",
      icon: "clock",
      title: isZh
        ? `这个链接已在 ${formatStatusDate(snapshot.request.expiresAt || snapshot.request.expiredAt, isZh) || "较早日期"} 过期。`
        : `This link expired on ${formatStatusDate(snapshot.request.expiresAt || snapshot.request.expiredAt, isZh) || "an earlier date"}.`,
      action: requestNewLinkAction
    };
  }

  if (snapshot.request.statusKey === "declined" || snapshot.currentRecipient.statusKey === "declined") {
    return {
      tone: "info",
      icon: "x",
      title: isZh ? "这个签署请求已被拒签。" : "This signing request was declined.",
      description: isZh ? "如果仍需查看这个文件，请联系发送人。" : "Contact the sender if you still need to view this file.",
      action: contactSenderAction
    };
  }

  if (snapshot.currentRecipient.statusKey === "draft" || snapshot.currentRecipient.statusKey === "pending") {
    return {
      tone: "info",
      icon: "timer",
      title: isZh ? "这个签署步骤尚未激活。" : "This signing step is not active yet.",
      description: isZh ? "请等待发送人激活你的签署顺序。" : "Wait for the sender to activate your signing order."
    };
  }

  if (snapshot.request.statusKey === "draft" || snapshot.request.statusKey === "pending_send") {
    return {
      tone: "info",
      icon: "timer",
      title: isZh ? "这个签署请求尚未准备好。" : "This signing request is not ready yet.",
      description: isZh ? "发送人仍需完成这个文件的准备。" : "The sender still needs to finish preparing this file."
    };
  }

  return null;
}

function buildInlineErrorCallout(errorMessage: string, isZh: boolean): CalloutState {
  if (!errorMessage.trim()) {
    return null;
  }

  if (errorMessage.toLowerCase().includes("too many")) {
    return {
      tone: "info",
      icon: "timer",
      title: isZh ? "尝试次数过多，请几分钟后再试。" : "Too many attempts. Please try again in a few minutes."
    };
  }

  return {
    tone: "error",
    icon: "x",
    title: isZh ? "暂时无法完成该操作。" : "This action cannot be completed right now.",
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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
  const statusCallout = useMemo(() => buildStatusCallout(snapshot, token, isZh), [isZh, snapshot, token]);
  const submitErrorCallout = useMemo(() => buildInlineErrorCallout(submitError, isZh), [isZh, submitError]);
  const previewErrorCallout = useMemo(() => buildInlineErrorCallout(previewError, isZh), [isZh, previewError]);
  const senderDisplayName = snapshot.request.senderDisplayName || (isZh ? "你的 Acre 经纪人" : "Your Acre agent");
  const expiresLabel = formatStatusDate(snapshot.request.expiresAt, isZh);
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
      reader.onerror = () => reject(new Error(isZh ? "无法读取签名图片。" : "Unable to read the signature image."));
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
        throw new Error(payload?.error ?? (isZh ? "无法签署这个文件。" : "Unable to sign this file."));
      }

      setCompleted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : isZh ? "无法签署这个文件。" : "Unable to sign this file.");
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <div className="public-signature-shell">
      <aside className="public-signature-sidebar">
        <div className="public-signature-sidebar-summary">
          <p className="public-signature-eyebrow">{isZh ? "Acre 签署请求" : "Acre signing request"}</p>
          <h1>{snapshot.document.title}</h1>
          <p className="public-signature-sidebar-description">
            {isZh ? `${senderDisplayName} 邀请你签署这个文件。` : `${senderDisplayName} invited you to sign this file.`}
          </p>
        </div>

        <div className="public-signature-meta">
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>{isZh ? "收件人" : "Recipient"}</strong>
            <span>{snapshot.currentRecipient.name}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>{isZh ? "发送人" : "Sender"}</strong>
            <span>{senderDisplayName}</span>
          </p>
          {expiresLabel ? (
            <p className="public-signature-meta-item public-signature-meta-item-primary">
              <strong>{isZh ? "过期时间" : "Expires"}</strong>
              <span>{expiresLabel}</span>
            </p>
          ) : null}
          <p className="public-signature-meta-item public-signature-meta-item-secondary">
            <strong>{isZh ? "邮箱" : "Email"}</strong>
            <span>{snapshot.currentRecipient.email}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-secondary">
            <strong>{isZh ? "角色" : "Role"}</strong>
            <span>{snapshot.currentRecipient.recipientRole || snapshot.currentRecipient.role}</span>
          </p>
        </div>

        <details className="public-signature-sidebar-details">
          <summary>{isZh ? "详情" : "Details"}</summary>
          <div className="public-signature-sidebar-details-body">
            <p>{isZh ? `${senderDisplayName} 邀请你签署这个文件。` : `${senderDisplayName} invited you to sign this file.`}</p>
            <div className="public-signature-sidebar-details-list">
              <div className="public-signature-sidebar-details-item">
                <strong>{isZh ? "邮箱" : "Email"}</strong>
                <span>{snapshot.currentRecipient.email}</span>
              </div>
              <div className="public-signature-sidebar-details-item">
                <strong>{isZh ? "角色" : "Role"}</strong>
                <span>{snapshot.currentRecipient.recipientRole || snapshot.currentRecipient.role}</span>
              </div>
            </div>
            {!completed && !statusCallout ? <p className="public-signature-helper">{isZh ? "文件上只显示分配给你的字段。" : "The file only shows fields assigned to you."}</p> : null}
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
            action={buildSignedCopyAction(token, isZh)}
            icon="check"
            title={isZh ? "文件已成功签署。" : "The file was signed successfully."}
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
        {!completed && !statusCallout ? <p className="public-signature-helper public-signature-sidebar-helper-desktop">{isZh ? "文件上只显示分配给你的字段。" : "The file only shows fields assigned to you."}</p> : null}

        {!isReadOnly && !completed ? (
          <Button disabled={pendingSubmit} onClick={handleSubmit}>
            {pendingSubmit
              ? isZh
                ? "提交中..."
                : "Submitting..."
              : snapshot.currentRecipient.roleKey === "approver" && editableFieldCount === 0
                ? isZh
                  ? "批准此步骤"
                  : "Approve this step"
                : isZh
                  ? "提交签名"
                  : "Submit signature"}
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
        {isLoading ? <p className="public-signature-helper">{isZh ? "正在加载文件预览..." : "Loading file preview..."}</p> : null}
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
              <div className="public-signature-page-label">{isZh ? `第 ${page.pageNumber} 页` : `Page ${page.pageNumber}`}</div>
              <div className="public-signature-page-frame">
                <img alt={isZh ? `可签署文件第 ${page.pageNumber} 页` : `Signable file page ${page.pageNumber}`} height={page.height} src={page.imageUrl} width={page.width} />
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
              <h2>{isZh ? "添加签名" : "Add signature"}</h2>
              <button onClick={closeSignatureModal} type="button">
                {isZh ? "关闭" : "Close"}
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
                  {mode === "draw" ? (isZh ? "手写" : "Draw") : mode === "type" ? (isZh ? "输入" : "Type") : isZh ? "上传" : "Upload"}
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
                      {isZh ? "清除签名" : "Clear signature"}
                    </Button>
                  ) : null}
                  <Button onClick={closeSignatureModal} type="button" variant="secondary">
                    {isZh ? "完成" : "Done"}
                  </Button>
                </div>
              </div>
            ) : null}

            {signatureMode === "type" ? (
              <div className="public-signature-type-panel">
                <FormField label={isZh ? "输入签名" : "Typed signature"}>
                  <TextInput onChange={(event) => setTypedSignature(event.target.value)} value={typedSignature} />
                </FormField>
                <div className="public-signature-typed-preview public-signature-typed-preview-large">{typedSignature}</div>
                <div className="public-signature-modal-actions">
                  {hasActiveSignatureValue ? (
                    <Button onClick={clearActiveSignature} type="button" variant="ghost">
                      {isZh ? "清除签名" : "Clear signature"}
                    </Button>
                  ) : null}
                  <Button onClick={applyTypedSignature} type="button">
                    {isZh ? "使用输入签名" : "Use typed signature"}
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
                      {isZh ? "清除签名" : "Clear signature"}
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
