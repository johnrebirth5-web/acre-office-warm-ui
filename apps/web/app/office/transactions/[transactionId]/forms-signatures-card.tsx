"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckboxField, EmptyState, FormField, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeFormTemplateOption, OfficeSignatureRequest, OfficeTransactionForm } from "@acre/db";

type TaskOption = {
  id: string;
  title: string;
};

type TransactionFormsSignaturesCardProps = {
  transactionId: string;
  forms: OfficeTransactionForm[];
  signatureRequests: OfficeSignatureRequest[];
  formTemplates: OfficeFormTemplateOption[];
  taskOptions: TaskOption[];
  canUseForms: boolean;
  canManageSignatures: boolean;
  canViewDocuments: boolean;
};

type NewFormState = {
  templateId: string;
  linkedTaskId: string;
  name: string;
};

type FormEditState = {
  name: string;
  linkedTaskId: string;
  statusKey: OfficeTransactionForm["statusKey"];
};

type SignatureDraftState = {
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  signingOrder: string;
};

const formStatusOptions: Array<{ value: OfficeTransactionForm["statusKey"]; label: string }> = [
  { value: "draft", label: "草稿" },
  { value: "prepared", label: "已准备" },
  { value: "sent_for_signature", label: "已发送签名" },
  { value: "partially_signed", label: "部分已签" },
  { value: "fully_signed", label: "全部已签" },
  { value: "rejected", label: "已拒绝" },
  { value: "voided", label: "已作废" }
];

const signatureStatusLabelMap: Record<OfficeSignatureRequest["statusKey"], string> = {
  draft: "草稿",
  pending_send: "待发送",
  sent: "已发送",
  viewed: "已查看",
  signed: "已签署",
  completed: "已完成",
  declined: "已拒绝",
  canceled: "已取消",
  voided: "已作废",
  expired: "已过期"
};

function buildFormEditState(form: OfficeTransactionForm): FormEditState {
  return {
    name: form.name,
    linkedTaskId: form.linkedTaskId ?? "",
    statusKey: form.statusKey
  };
}

function buildSignatureDraft(): SignatureDraftState {
  return {
    recipientName: "",
    recipientEmail: "",
    recipientRole: "Primary contact",
    signingOrder: ""
  };
}

function getFormTone(statusKey: OfficeTransactionForm["statusKey"]) {
  if (statusKey === "fully_signed") {
    return "success" as const;
  }

  if (statusKey === "rejected" || statusKey === "voided") {
    return "danger" as const;
  }

  if (statusKey === "sent_for_signature" || statusKey === "partially_signed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getSignatureTone(statusKey: OfficeSignatureRequest["statusKey"]) {
  if (statusKey === "completed") {
    return "success" as const;
  }

  if (statusKey === "declined" || statusKey === "canceled" || statusKey === "voided" || statusKey === "expired") {
    return "danger" as const;
  }

  if (statusKey === "pending_send" || statusKey === "sent" || statusKey === "viewed" || statusKey === "signed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getFormStatusLabel(form: OfficeTransactionForm) {
  return formStatusOptions.find((option) => option.value === form.statusKey)?.label ?? form.status;
}

function getSignatureStatusLabel(request: OfficeSignatureRequest) {
  return signatureStatusLabelMap[request.statusKey] ?? request.status;
}

function buildRecipientSummary(request: OfficeSignatureRequest) {
  if (request.recipients.length === 0) {
    return {
      label: `${request.recipientName} · ${request.recipientEmail}`,
      detail: request.signingOrder ? `顺序 ${request.signingOrder}` : ""
    };
  }

  const signerCount = request.recipients.filter((recipient) => recipient.roleKey === "signer").length;
  const approverCount = request.recipients.filter((recipient) => recipient.roleKey === "approver").length;
  const ccCount = request.ccRecipients.length;
  const actionableLabels = request.recipients
    .filter((recipient) => recipient.roleKey !== "cc")
    .map((recipient) => recipient.name || recipient.email)
    .filter(Boolean)
    .join(", ");

  return {
    label: actionableLabels || `${signerCount} 位收件人`,
    detail: `${signerCount} 位签署人 · ${approverCount} 位审批人${ccCount ? ` · ${ccCount} 位抄送` : ""}`
  };
}

function formatDateLabel(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TransactionFormsSignaturesCard({
  transactionId,
  forms,
  signatureRequests,
  formTemplates,
  taskOptions,
  canUseForms,
  canManageSignatures,
  canViewDocuments
}: TransactionFormsSignaturesCardProps) {
  const router = useRouter();
  const documentSignatureRequests = signatureRequests.filter((request) => !request.formId);
  const [newFormState, setNewFormState] = useState<NewFormState>({
    templateId: formTemplates[0]?.id ?? "",
    linkedTaskId: "",
    name: ""
  });
  const [formStates, setFormStates] = useState<Record<string, FormEditState>>(
    Object.fromEntries(forms.map((form) => [form.id, buildFormEditState(form)]))
  );
  const [signatureDrafts, setSignatureDrafts] = useState<Record<string, SignatureDraftState>>(
    Object.fromEntries(forms.map((form) => [form.id, buildSignatureDraft()]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  function updateFormState(formId: string, field: keyof FormEditState, value: string) {
    setFormStates((current) => ({
      ...current,
      [formId]: {
        ...(current[formId] ?? buildFormEditState(forms.find((form) => form.id === formId)!)),
        [field]: value
      }
    }));
  }

  function updateSignatureDraft(formId: string, field: keyof SignatureDraftState, value: string) {
    setSignatureDrafts((current) => ({
      ...current,
      [formId]: {
        ...(current[formId] ?? buildSignatureDraft()),
        [field]: value
      }
    }));
  }

  async function handleCreateForm() {
    if (!newFormState.templateId) {
      setError("请先选择模板。");
      return;
    }

    setPendingAction("create-form");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/forms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newFormState)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "无法创建表单。");
      }

      setNewFormState({
        templateId: formTemplates[0]?.id ?? "",
        linkedTaskId: "",
        name: ""
      });
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "无法创建表单。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveForm(formId: string) {
    const formState = formStates[formId];

    if (!formState) {
      return;
    }

    setPendingAction(`save-form:${formId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/forms/${formId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: formState.name,
          linkedTaskId: formState.linkedTaskId || null,
          status: formState.statusKey
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "表单更新失败。");
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "表单更新失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateSignatureRequest(formId: string) {
    const draft = signatureDrafts[formId] ?? buildSignatureDraft();

    if (!draft.recipientName.trim() || !draft.recipientEmail.trim()) {
      setError("收件人姓名和邮箱为必填项。");
      return;
    }

    setPendingAction(`create-signature:${formId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/signatures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          formId,
          recipientName: draft.recipientName,
          recipientEmail: draft.recipientEmail,
          recipientRole: draft.recipientRole,
          signingOrder: draft.signingOrder ? Number(draft.signingOrder) : null
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "无法准备签名请求。");
      }

      setSignatureDrafts((current) => ({
        ...current,
        [formId]: buildSignatureDraft()
      }));
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "无法准备签名请求。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSignatureAction(
    signatureRequestId: string,
    action: "send" | "resend" | "viewed" | "signed" | "declined" | "canceled" | "expire"
  ) {
    setPendingAction(`${action}:${signatureRequestId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/signatures/${signatureRequestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "签名状态更新失败。");
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "签名状态更新失败。");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-detail-card" id="transaction-forms-signatures">
      <div className="office-card-head">
        <div>
          <h3>表单与电子签名</h3>
          <span>从模板生成交易表单，关联到清单任务，并跟踪手动签名状态。</span>
        </div>
      </div>

      <div className="office-document-list">
        {documentSignatureRequests.length > 0 ? (
          <article className="office-form-row">
            <div className="office-card-head office-card-head-inline">
              <h3>文档签名请求</h3>
            </div>

            <div className="office-form-signature-list">
              {documentSignatureRequests.map((request) => {
                const recipientSummary = buildRecipientSummary(request);

                return (
                <div className="office-signature-row" key={request.id}>
                  <div className="office-signature-row-copy">
                    <div className="office-document-row-head">
                      <strong>{request.documentTitle || "签名请求"}</strong>
                      <StatusBadge tone={getSignatureTone(request.statusKey)}>{getSignatureStatusLabel(request)}</StatusBadge>
                    </div>
                    <p>{recipientSummary.label}</p>
                    {recipientSummary.detail ? <p>{recipientSummary.detail}</p> : null}
                    <p>
                      {request.sentAt ? `已发送 ${formatDateLabel(request.sentAt)}` : "尚未发送"}
                      {request.firstViewedAt ? ` · 已打开 ${formatDateLabel(request.firstViewedAt)}` : ""}
                      {request.signedAt ? ` · 已签署 ${formatDateLabel(request.signedAt)}` : ""}
                      {request.completedAt ? ` · 已完成 ${formatDateLabel(request.completedAt)}` : ""}
                    </p>
                  </div>

                  <div className="office-signature-row-actions">
                    <Link className="office-button-secondary office-inline-action-sm" href={`/office/transactions/${transactionId}/signatures/${request.id}`}>
                      打开请求
                    </Link>
                    {request.completedDocumentHref && canViewDocuments ? (
                      <Link className="office-button-secondary office-inline-action-sm" href={request.completedDocumentHref} target="_blank">
                        已签 PDF
                      </Link>
                    ) : null}
                    {canManageSignatures && (request.statusKey === "pending_send" || request.statusKey === "sent" || request.statusKey === "viewed" || request.statusKey === "expired" || request.statusKey === "canceled" || request.statusKey === "voided") ? (
                      <Button
                        disabled={pendingAction === `resend:${request.id}`}
                        onClick={() => handleSignatureAction(request.id, "resend")}
                        size="sm"
                        variant="secondary"
                      >
                        {pendingAction === `resend:${request.id}` ? "重新发送中..." : "重新发送"}
                      </Button>
                    ) : null}
                    {canManageSignatures && (request.statusKey === "draft" || request.statusKey === "pending_send" || request.statusKey === "sent" || request.statusKey === "viewed") ? (
                      <Button
                        disabled={pendingAction === `canceled:${request.id}`}
                        onClick={() => handleSignatureAction(request.id, "canceled")}
                        size="sm"
                        variant="danger"
                      >
                        {pendingAction === `canceled:${request.id}` ? "取消中..." : "取消"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                );
              })}
            </div>
          </article>
        ) : null}

        {forms.length > 0 ? (
          forms.map((form) => {
            const formState = formStates[form.id] ?? buildFormEditState(form);
            const signatureDraft = signatureDrafts[form.id] ?? buildSignatureDraft();

            return (
              <article className="office-form-row" key={form.id}>
                <div className="office-document-row-top">
                  <div className="office-document-row-copy">
                    <div className="office-document-row-head">
                      <strong>{form.name}</strong>
                      <StatusBadge tone={getFormTone(form.statusKey)}>{getFormStatusLabel(form)}</StatusBadge>
                      {form.documentTitle ? <StatusBadge tone="neutral">已生成文档</StatusBadge> : null}
                    </div>
                    <p>
                      模板：{form.templateName || "自定义"} · 创建人：{form.createdByName || "系统"}
                    </p>
                    {form.linkedTaskTitle ? (
                      <p>
                        关联任务：<Link href={form.linkedTaskHref}>{form.linkedTaskTitle}</Link>
                      </p>
                    ) : null}
                  </div>

                  <div className="office-document-row-actions">
                    {canViewDocuments && form.documentId ? (
                      <Link className="office-toggle-link" href={`/api/office/transactions/${transactionId}/documents/${form.documentId}/file`} target="_blank">
                        打开文档
                      </Link>
                    ) : null}
                  </div>
                </div>

                {canUseForms ? (
                  <div className="office-document-edit-grid">
                    <FormField label="表单名称">
                      <TextInput
                        onChange={(event) => updateFormState(form.id, "name", event.target.value)}
                        value={formState.name}
                      />
                    </FormField>
                    <FormField label="关联任务">
                      <SelectInput
                        onChange={(event) => updateFormState(form.id, "linkedTaskId", event.target.value)}
                        value={formState.linkedTaskId}
                      >
                        <option value="">不关联任务</option>
                        {taskOptions.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>
                    <FormField label="表单状态">
                      <SelectInput
                        onChange={(event) => updateFormState(form.id, "statusKey", event.target.value)}
                        value={formState.statusKey}
                      >
                        {formStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>
                    <div className="office-document-edit-actions">
                      <Button
                        disabled={pendingAction === `save-form:${form.id}`}
                        onClick={() => handleSaveForm(form.id)}
                        size="sm"
                      >
                        {pendingAction === `save-form:${form.id}` ? "保存中..." : "保存表单"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="office-form-payload-preview">
                  {Object.entries(form.generatedPayload).slice(0, 8).map(([key, value]) => (
                    <div className="office-form-payload-item" key={key}>
                      <span>{key}</span>
                      <strong>{value || "—"}</strong>
                    </div>
                  ))}
                </div>

                <div className="office-form-signature-list">
                  <div className="office-card-head office-card-head-inline">
                    <h3>签名请求</h3>
                  </div>

                  {form.signatureRequests.length > 0 ? (
                    form.signatureRequests.map((request) => {
                      const recipientSummary = buildRecipientSummary(request);

                      return (
                      <div className="office-signature-row" key={request.id}>
                        <div className="office-signature-row-copy">
                          <div className="office-document-row-head">
                            <strong>{request.documentTitle || form.name}</strong>
                            <StatusBadge tone={getSignatureTone(request.statusKey)}>{getSignatureStatusLabel(request)}</StatusBadge>
                          </div>
                          <p>{recipientSummary.label}</p>
                          {recipientSummary.detail ? <p>{recipientSummary.detail}</p> : null}
                          <p>
                            {request.sentAt ? `已发送 ${formatDateLabel(request.sentAt)}` : "尚未发送"}
                            {request.completedAt ? ` · 已签署 ${formatDateLabel(request.completedAt)}` : ""}
                            {request.declinedAt ? ` · 已拒绝 ${formatDateLabel(request.declinedAt)}` : ""}
                          </p>
                        </div>

                        {canManageSignatures ? (
                          <div className="office-signature-row-actions">
                            {request.statusKey === "draft" || request.statusKey === "pending_send" ? (
                              <Button
                                disabled={pendingAction === `send:${request.id}`}
                                onClick={() => handleSignatureAction(request.id, "send")}
                                size="sm"
                              >
                                {pendingAction === `send:${request.id}` ? "发送中..." : "发送"}
                              </Button>
                            ) : null}
                            {(request.statusKey === "sent" || request.statusKey === "viewed") ? (
                              <>
                                {request.statusKey === "sent" ? (
                                  <Button
                                    disabled={pendingAction === `viewed:${request.id}`}
                                    onClick={() => handleSignatureAction(request.id, "viewed")}
                                    size="sm"
                                    variant="secondary"
                                  >
                                    标记已查看
                                  </Button>
                                ) : null}
                                <Button
                                  disabled={pendingAction === `signed:${request.id}`}
                                  onClick={() => handleSignatureAction(request.id, "signed")}
                                  size="sm"
                                >
                                  {pendingAction === `signed:${request.id}` ? "保存中..." : "标记已签"}
                                </Button>
                                <Button
                                  disabled={pendingAction === `declined:${request.id}`}
                                  onClick={() => handleSignatureAction(request.id, "declined")}
                                  size="sm"
                                  variant="danger"
                                >
                                  拒绝
                                </Button>
                              </>
                            ) : null}
                            {(request.statusKey === "draft" || request.statusKey === "pending_send" || request.statusKey === "sent" || request.statusKey === "viewed") ? (
                              <Button
                                disabled={pendingAction === `canceled:${request.id}`}
                                onClick={() => handleSignatureAction(request.id, "canceled")}
                                size="sm"
                                variant="secondary"
                              >
                                取消
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      );
                    })
                  ) : (
                    <EmptyState title="还没有签名请求。" />
                  )}

                  {canManageSignatures ? (
                    <div className="office-document-upload-panel office-form-signature-create">
                      <div className="office-card-head office-card-head-inline">
                        <h3>准备签名请求</h3>
                      </div>
                      <div className="office-document-upload-grid">
                        <FormField label="收件人姓名">
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientName", event.target.value)}
                            value={signatureDraft.recipientName}
                          />
                        </FormField>
                        <FormField label="收件人邮箱">
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientEmail", event.target.value)}
                            type="email"
                            value={signatureDraft.recipientEmail}
                          />
                        </FormField>
                        <FormField label="收件人角色">
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientRole", event.target.value)}
                            value={signatureDraft.recipientRole}
                          />
                        </FormField>
                        <FormField label="签署顺序">
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "signingOrder", event.target.value)}
                            type="number"
                            value={signatureDraft.signingOrder}
                          />
                        </FormField>
                      </div>

                      <div className="office-document-edit-actions">
                        <Button
                          disabled={pendingAction === `create-signature:${form.id}`}
                          onClick={() => handleCreateSignatureRequest(form.id)}
                          size="sm"
                        >
                          {pendingAction === `create-signature:${form.id}` ? "准备中..." : "准备签名请求"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState
            description="使用内置模板准备交易表单，并启动内部签名流程。"
            title="这笔交易还没有创建表单。"
          />
        )}
      </div>

      {canUseForms ? (
        <div className="office-document-upload-panel">
          <div className="office-card-head office-card-head-inline">
            <h3>使用表单</h3>
          </div>

          <div className="office-document-upload-grid">
            <FormField label="模板">
              <SelectInput
                onChange={(event) => setNewFormState((current) => ({ ...current, templateId: event.target.value }))}
                value={newFormState.templateId}
              >
                <option value="">选择模板</option>
                {formTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="关联任务">
              <SelectInput
                onChange={(event) => setNewFormState((current) => ({ ...current, linkedTaskId: event.target.value }))}
                value={newFormState.linkedTaskId}
              >
                <option value="">不关联任务</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="文档组名称">
              <TextInput
                onChange={(event) => setNewFormState((current) => ({ ...current, name: event.target.value }))}
                placeholder="留空则使用默认模板名称"
                value={newFormState.name}
              />
            </FormField>
          </div>

          <div className="office-document-edit-actions">
            <Button disabled={pendingAction === "create-form"} onClick={handleCreateForm}>
              {pendingAction === "create-form" ? "创建中..." : "创建表单草稿"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="office-form-error">{error}</p> : null}
    </section>
  );
}
