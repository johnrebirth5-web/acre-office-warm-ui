"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckboxField, EmptyState, FormField, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeFormTemplateOption, OfficeSignatureRequest, OfficeTransactionForm } from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";

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

const formStatusOptions: Array<{ value: OfficeTransactionForm["statusKey"]; enLabel: string; zhLabel: string }> = [
  { value: "draft", enLabel: "Draft", zhLabel: "草稿" },
  { value: "prepared", enLabel: "Prepared", zhLabel: "已准备" },
  { value: "sent_for_signature", enLabel: "Sent for signature", zhLabel: "已发送签名" },
  { value: "partially_signed", enLabel: "Partially signed", zhLabel: "部分已签" },
  { value: "fully_signed", enLabel: "Fully signed", zhLabel: "全部已签" },
  { value: "rejected", enLabel: "Rejected", zhLabel: "已拒绝" },
  { value: "voided", enLabel: "Voided", zhLabel: "已作废" }
];

const signatureStatusLabelMap: Record<OfficeSignatureRequest["statusKey"], { en: string; zh: string }> = {
  draft: { en: "Draft", zh: "草稿" },
  pending_send: { en: "Pending send", zh: "待发送" },
  sent: { en: "Sent", zh: "已发送" },
  viewed: { en: "Viewed", zh: "已查看" },
  signed: { en: "Signed", zh: "已签署" },
  completed: { en: "Completed", zh: "已完成" },
  declined: { en: "Declined", zh: "已拒绝" },
  canceled: { en: "Canceled", zh: "已取消" },
  voided: { en: "Voided", zh: "已作废" },
  expired: { en: "Expired", zh: "已过期" }
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

function getFormStatusLabel(form: OfficeTransactionForm, isZh: boolean) {
  const option = formStatusOptions.find((entry) => entry.value === form.statusKey);
  return option ? (isZh ? option.zhLabel : option.enLabel) : form.status;
}

function getSignatureStatusLabel(request: OfficeSignatureRequest, isZh: boolean) {
  const label = signatureStatusLabelMap[request.statusKey];
  return label ? (isZh ? label.zh : label.en) : request.status;
}

function buildRecipientSummary(request: OfficeSignatureRequest, isZh: boolean) {
  if (request.recipients.length === 0) {
    return {
      label: `${request.recipientName} · ${request.recipientEmail}`,
      detail: request.signingOrder ? (isZh ? `顺序 ${request.signingOrder}` : `Order ${request.signingOrder}`) : ""
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
    label: actionableLabels || (isZh ? `${signerCount} 位收件人` : `${signerCount} ${signerCount === 1 ? "recipient" : "recipients"}`),
    detail: isZh
      ? `${signerCount} 位签署人 · ${approverCount} 位审批人${ccCount ? ` · ${ccCount} 位抄送` : ""}`
      : `${signerCount} ${signerCount === 1 ? "signer" : "signers"} · ${approverCount} ${approverCount === 1 ? "approver" : "approvers"}${ccCount ? ` · ${ccCount} CC` : ""}`
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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
      setError(isZh ? "请先选择模板。" : "Select a template first.");
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
        throw new Error(body?.error ?? (isZh ? "无法创建表单。" : "Unable to create form."));
      }

      setNewFormState({
        templateId: formTemplates[0]?.id ?? "",
        linkedTaskId: "",
        name: ""
      });
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : isZh ? "无法创建表单。" : "Unable to create form.");
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
        throw new Error(body?.error ?? (isZh ? "表单更新失败。" : "Form update failed."));
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : isZh ? "表单更新失败。" : "Form update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateSignatureRequest(formId: string) {
    const draft = signatureDrafts[formId] ?? buildSignatureDraft();

    if (!draft.recipientName.trim() || !draft.recipientEmail.trim()) {
      setError(isZh ? "收件人姓名和邮箱为必填项。" : "Recipient name and email are required.");
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
        throw new Error(body?.error ?? (isZh ? "无法准备签名请求。" : "Unable to prepare signature request."));
      }

      setSignatureDrafts((current) => ({
        ...current,
        [formId]: buildSignatureDraft()
      }));
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : isZh ? "无法准备签名请求。" : "Unable to prepare signature request.");
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
        throw new Error(body?.error ?? (isZh ? "签名状态更新失败。" : "Signature status update failed."));
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : isZh ? "签名状态更新失败。" : "Signature status update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-detail-card" id="transaction-forms-signatures">
      <div className="office-card-head">
        <div>
          <h3>{isZh ? "表单与电子签名" : "Forms & eSignature"}</h3>
          <span>{isZh ? "从模板生成交易表单，关联到清单任务，并跟踪手动签名状态。" : "Generate transaction forms from templates, link them to checklist tasks, and track manual signature status."}</span>
        </div>
      </div>

      <div className="office-document-list">
        {documentSignatureRequests.length > 0 ? (
          <article className="office-form-row">
            <div className="office-card-head office-card-head-inline">
              <h3>{isZh ? "文档签名请求" : "Document signature requests"}</h3>
            </div>

            <div className="office-form-signature-list">
              {documentSignatureRequests.map((request) => {
                const recipientSummary = buildRecipientSummary(request, isZh);

                return (
                <div className="office-signature-row" key={request.id}>
                  <div className="office-signature-row-copy">
                    <div className="office-document-row-head">
                      <strong>{request.documentTitle || (isZh ? "签名请求" : "Signature request")}</strong>
                      <StatusBadge tone={getSignatureTone(request.statusKey)}>{getSignatureStatusLabel(request, isZh)}</StatusBadge>
                    </div>
                    <p>{recipientSummary.label}</p>
                    {recipientSummary.detail ? <p>{recipientSummary.detail}</p> : null}
                    <p>
                      {request.sentAt ? (isZh ? `已发送 ${formatDateLabel(request.sentAt)}` : `Sent ${formatDateLabel(request.sentAt)}`) : isZh ? "尚未发送" : "Not sent yet"}
                      {request.firstViewedAt ? (isZh ? ` · 已打开 ${formatDateLabel(request.firstViewedAt)}` : ` · Viewed ${formatDateLabel(request.firstViewedAt)}`) : ""}
                      {request.signedAt ? (isZh ? ` · 已签署 ${formatDateLabel(request.signedAt)}` : ` · Signed ${formatDateLabel(request.signedAt)}`) : ""}
                      {request.completedAt ? (isZh ? ` · 已完成 ${formatDateLabel(request.completedAt)}` : ` · Completed ${formatDateLabel(request.completedAt)}`) : ""}
                    </p>
                  </div>

                  <div className="office-signature-row-actions">
                    <Link className="office-button-secondary office-inline-action-sm" href={`/office/transactions/${transactionId}/signatures/${request.id}`}>
                      {isZh ? "打开请求" : "Open request"}
                    </Link>
                    {request.completedDocumentHref && canViewDocuments ? (
                      <Link className="office-button-secondary office-inline-action-sm" href={request.completedDocumentHref} target="_blank">
                        {isZh ? "已签 PDF" : "Signed PDF"}
                      </Link>
                    ) : null}
                    {canManageSignatures && (request.statusKey === "pending_send" || request.statusKey === "sent" || request.statusKey === "viewed" || request.statusKey === "expired" || request.statusKey === "canceled" || request.statusKey === "voided") ? (
                      <Button
                        disabled={pendingAction === `resend:${request.id}`}
                        onClick={() => handleSignatureAction(request.id, "resend")}
                        size="sm"
                        variant="secondary"
                      >
                        {pendingAction === `resend:${request.id}` ? (isZh ? "重新发送中..." : "Resending...") : isZh ? "重新发送" : "Resend"}
                      </Button>
                    ) : null}
                    {canManageSignatures && (request.statusKey === "draft" || request.statusKey === "pending_send" || request.statusKey === "sent" || request.statusKey === "viewed") ? (
                      <Button
                        disabled={pendingAction === `canceled:${request.id}`}
                        onClick={() => handleSignatureAction(request.id, "canceled")}
                        size="sm"
                        variant="danger"
                      >
                        {pendingAction === `canceled:${request.id}` ? (isZh ? "取消中..." : "Canceling...") : isZh ? "取消" : "Cancel"}
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
                      <StatusBadge tone={getFormTone(form.statusKey)}>{getFormStatusLabel(form, isZh)}</StatusBadge>
                      {form.documentTitle ? <StatusBadge tone="neutral">{isZh ? "已生成文档" : "Document generated"}</StatusBadge> : null}
                    </div>
                    <p>
                      {isZh ? "模板：" : "Template: "}{form.templateName || (isZh ? "自定义" : "Custom")} · {isZh ? "创建人：" : "Created by: "}{form.createdByName || (isZh ? "系统" : "System")}
                    </p>
                    {form.linkedTaskTitle ? (
                      <p>
                        {isZh ? "关联任务：" : "Linked task: "}<Link href={form.linkedTaskHref}>{form.linkedTaskTitle}</Link>
                      </p>
                    ) : null}
                  </div>

                  <div className="office-document-row-actions">
                    {canViewDocuments && form.documentId ? (
                      <Link className="office-toggle-link" href={`/api/office/transactions/${transactionId}/documents/${form.documentId}/file`} target="_blank">
                        {isZh ? "打开文档" : "Open document"}
                      </Link>
                    ) : null}
                  </div>
                </div>

                {canUseForms ? (
                  <div className="office-document-edit-grid">
                    <FormField label={isZh ? "表单名称" : "Form name"}>
                      <TextInput
                        onChange={(event) => updateFormState(form.id, "name", event.target.value)}
                        value={formState.name}
                      />
                    </FormField>
                    <FormField label={isZh ? "关联任务" : "Linked task"}>
                      <SelectInput
                        onChange={(event) => updateFormState(form.id, "linkedTaskId", event.target.value)}
                        value={formState.linkedTaskId}
                      >
                        <option value="">{isZh ? "不关联任务" : "No linked task"}</option>
                        {taskOptions.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>
                    <FormField label={isZh ? "表单状态" : "Form status"}>
                      <SelectInput
                        onChange={(event) => updateFormState(form.id, "statusKey", event.target.value)}
                        value={formState.statusKey}
                      >
                        {formStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {isZh ? option.zhLabel : option.enLabel}
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
                        {pendingAction === `save-form:${form.id}` ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存表单" : "Save form"}
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
                    <h3>{isZh ? "签名请求" : "Signature requests"}</h3>
                  </div>

                  {form.signatureRequests.length > 0 ? (
                    form.signatureRequests.map((request) => {
                      const recipientSummary = buildRecipientSummary(request, isZh);

                      return (
                      <div className="office-signature-row" key={request.id}>
                        <div className="office-signature-row-copy">
                          <div className="office-document-row-head">
                            <strong>{request.documentTitle || form.name}</strong>
                            <StatusBadge tone={getSignatureTone(request.statusKey)}>{getSignatureStatusLabel(request, isZh)}</StatusBadge>
                          </div>
                          <p>{recipientSummary.label}</p>
                          {recipientSummary.detail ? <p>{recipientSummary.detail}</p> : null}
                          <p>
                            {request.sentAt ? (isZh ? `已发送 ${formatDateLabel(request.sentAt)}` : `Sent ${formatDateLabel(request.sentAt)}`) : isZh ? "尚未发送" : "Not sent yet"}
                            {request.completedAt ? (isZh ? ` · 已签署 ${formatDateLabel(request.completedAt)}` : ` · Signed ${formatDateLabel(request.completedAt)}`) : ""}
                            {request.declinedAt ? (isZh ? ` · 已拒绝 ${formatDateLabel(request.declinedAt)}` : ` · Declined ${formatDateLabel(request.declinedAt)}`) : ""}
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
                                {pendingAction === `send:${request.id}` ? (isZh ? "发送中..." : "Sending...") : isZh ? "发送" : "Send"}
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
                                    {isZh ? "标记已查看" : "Mark viewed"}
                                  </Button>
                                ) : null}
                                <Button
                                  disabled={pendingAction === `signed:${request.id}`}
                                  onClick={() => handleSignatureAction(request.id, "signed")}
                                  size="sm"
                                >
                                  {pendingAction === `signed:${request.id}` ? (isZh ? "保存中..." : "Saving...") : isZh ? "标记已签" : "Mark signed"}
                                </Button>
                                <Button
                                  disabled={pendingAction === `declined:${request.id}`}
                                  onClick={() => handleSignatureAction(request.id, "declined")}
                                  size="sm"
                                variant="danger"
                              >
                                  {isZh ? "拒绝" : "Decline"}
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
                                {isZh ? "取消" : "Cancel"}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      );
                    })
                  ) : (
                    <EmptyState title={isZh ? "还没有签名请求。" : "No signature requests yet."} />
                  )}

                  {canManageSignatures ? (
                    <div className="office-document-upload-panel office-form-signature-create">
                      <div className="office-card-head office-card-head-inline">
                        <h3>{isZh ? "准备签名请求" : "Prepare signature request"}</h3>
                      </div>
                      <div className="office-document-upload-grid">
                        <FormField label={isZh ? "收件人姓名" : "Recipient name"}>
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientName", event.target.value)}
                            value={signatureDraft.recipientName}
                          />
                        </FormField>
                        <FormField label={isZh ? "收件人邮箱" : "Recipient email"}>
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientEmail", event.target.value)}
                            type="email"
                            value={signatureDraft.recipientEmail}
                          />
                        </FormField>
                        <FormField label={isZh ? "收件人角色" : "Recipient role"}>
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientRole", event.target.value)}
                            value={signatureDraft.recipientRole}
                          />
                        </FormField>
                        <FormField label={isZh ? "签署顺序" : "Signing order"}>
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
                          {pendingAction === `create-signature:${form.id}` ? (isZh ? "准备中..." : "Preparing...") : isZh ? "准备签名请求" : "Prepare signature request"}
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
            description={isZh ? "使用内置模板准备交易表单，并启动内部签名流程。" : "Use built-in templates to prepare transaction forms and start the internal signature flow."}
            title={isZh ? "这笔交易还没有创建表单。" : "No forms have been created for this transaction."}
          />
        )}
      </div>

      {canUseForms ? (
        <div className="office-document-upload-panel">
          <div className="office-card-head office-card-head-inline">
            <h3>{isZh ? "使用表单" : "Use form"}</h3>
          </div>

          <div className="office-document-upload-grid">
            <FormField label={isZh ? "模板" : "Template"}>
              <SelectInput
                onChange={(event) => setNewFormState((current) => ({ ...current, templateId: event.target.value }))}
                value={newFormState.templateId}
              >
                <option value="">{isZh ? "选择模板" : "Select template"}</option>
                {formTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label={isZh ? "关联任务" : "Linked task"}>
              <SelectInput
                onChange={(event) => setNewFormState((current) => ({ ...current, linkedTaskId: event.target.value }))}
                value={newFormState.linkedTaskId}
              >
                <option value="">{isZh ? "不关联任务" : "No linked task"}</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label={isZh ? "文档组名称" : "Document group name"}>
              <TextInput
                onChange={(event) => setNewFormState((current) => ({ ...current, name: event.target.value }))}
                placeholder={isZh ? "留空则使用默认模板名称" : "Leave blank to use the default template name"}
                value={newFormState.name}
              />
            </FormField>
          </div>

          <div className="office-document-edit-actions">
            <Button disabled={pendingAction === "create-form"} onClick={handleCreateForm}>
              {pendingAction === "create-form" ? (isZh ? "创建中..." : "Creating...") : isZh ? "创建表单草稿" : "Create form draft"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="office-form-error">{error}</p> : null}
    </section>
  );
}
