"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  EmptyState,
  FormField,
  HorizontalScrollArea,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeFormTemplateOption, OfficeOfferFieldSchema, OfficeTransactionOffersSnapshot } from "@acre/db";

type TaskOption = {
  id: string;
  title: string;
};

type TransactionOffersCardProps = {
  transactionId: string;
  snapshot: OfficeTransactionOffersSnapshot;
  fieldSchema: OfficeOfferFieldSchema;
  taskOptions: TaskOption[];
  formTemplates: OfficeFormTemplateOption[];
  canManageOffers: boolean;
  canReviewOffers: boolean;
  canAcceptOffers: boolean;
  canManageDocuments: boolean;
  canUseForms: boolean;
  canManageSignatures: boolean;
};

type OfferFormState = {
  values: Record<string, string>;
  additionalFields: Record<string, string>;
  isPrimaryOffer: boolean;
};

type OfferUploadState = {
  title: string;
  documentType: string;
  linkedTaskId: string;
};

type OfferFormDraftState = {
  templateId: string;
  linkedTaskId: string;
  name: string;
};

type SignatureDraftState = {
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  signingOrder: string;
};

type OfferVisibleField =
  | { kind: "builtIn"; field: OfficeOfferFieldSchema["builtInFields"][number] }
  | { kind: "custom"; field: OfficeOfferFieldSchema["customFields"][number] };

type OfferRecord = OfficeTransactionOffersSnapshot["offers"][number];
type OfferStatusValue = OfferRecord["statusValue"];

const offerStatusLabelMap: Record<OfferStatusValue, string> = {
  draft: "草稿",
  submitted: "已提交",
  received: "已收到",
  under_review: "审核中",
  countered: "已还价",
  accepted: "已接受",
  rejected: "已拒绝",
  withdrawn: "已撤回",
  expired: "已过期"
};

const documentStatusLabelMap: Record<string, string> = {
  uploaded: "已上传",
  submitted: "已提交",
  approved: "已批准",
  rejected: "已拒绝",
  signed: "已签署",
  archived: "已归档"
};

const formStatusLabelMap: Record<string, string> = {
  draft: "草稿",
  prepared: "已准备",
  sent_for_signature: "已发送签名",
  partially_signed: "部分已签",
  fully_signed: "全部已签",
  rejected: "已拒绝",
  voided: "已作废"
};

const offerFieldLabelMap: Record<string, string> = {
  "Offer title": "报价标题",
  "Offering party": "报价方",
  "Buyer name": "买家姓名",
  Price: "价格",
  "Earnest money": "定金",
  "Financing type": "融资方式",
  "Closing date offered": "拟成交日期",
  Expiration: "到期时间",
  Notes: "备注"
};

const offerMessageMap: Record<string, string> = {
  "Offer title and offer party are required.": "报价标题和报价方必填。",
  "Offer could not be created.": "无法创建报价。",
  "Offer update failed.": "报价更新失败。",
  "Offer action failed.": "报价操作失败。",
  "Comment body is required.": "评论内容必填。",
  "Comment could not be added.": "无法添加评论。",
  "Comment could not be created.": "无法创建评论。",
  "A file is required.": "请选择文件。",
  "Document upload failed.": "文档上传失败。",
  "Select a form template first.": "请先选择表单模板。",
  "Form could not be created.": "无法创建表单。",
  "Recipient name, email, and role are required.": "收件人姓名、邮箱和角色必填。",
  "Signature request could not be created.": "无法创建签名请求。",
  "Signature request could not be prepared.": "无法准备签名请求。",
  "Offer management access required.": "需要报价管理权限。",
  "Offer acceptance access required.": "需要接受报价权限。",
  "Offer review access required.": "需要审核报价权限。",
  "Offer comment access required.": "需要报价评论权限。",
  "A valid offer action is required.": "请选择有效的报价操作。",
  "Offer update payload is invalid.": "报价更新内容无效。",
  "Offer update request body must be valid JSON.": "报价更新请求必须是有效 JSON。",
  "Signature request payload is invalid.": "签名请求内容无效。",
  "Signature request body must be valid JSON.": "签名请求正文必须是有效 JSON。"
};

const offerActionMap: Record<
  OfferStatusValue,
  Array<{ action: string; label: string }>
> = {
  draft: [
    { action: "submit", label: "提交" },
    { action: "receive", label: "标记已收到" },
    { action: "withdraw", label: "撤回" }
  ],
  submitted: [
    { action: "receive", label: "标记已收到" },
    { action: "counter", label: "还价" },
    { action: "reject", label: "拒绝" },
    { action: "withdraw", label: "撤回" }
  ],
  received: [
    { action: "review", label: "开始审核" },
    { action: "counter", label: "还价" },
    { action: "accept", label: "接受" },
    { action: "reject", label: "拒绝" },
    { action: "withdraw", label: "撤回" }
  ],
  under_review: [
    { action: "counter", label: "还价" },
    { action: "accept", label: "接受" },
    { action: "reject", label: "拒绝" },
    { action: "withdraw", label: "撤回" }
  ],
  countered: [
    { action: "submit", label: "重新提交" },
    { action: "receive", label: "标记已收到" },
    { action: "accept", label: "接受" },
    { action: "reject", label: "拒绝" },
    { action: "withdraw", label: "撤回" }
  ],
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: []
};

function sortSchemaFieldEntries(fields: OfferVisibleField[]) {
  return [...fields].sort((left, right) => {
    if (left.field.sortOrder !== right.field.sortOrder) {
      return left.field.sortOrder - right.field.sortOrder;
    }

    return left.field.label.localeCompare(right.field.label);
  });
}

function buildOfferFormState(
  fieldSchema: OfficeOfferFieldSchema,
  offer?: OfficeTransactionOffersSnapshot["offers"][number]
): OfferFormState {
  const values: Record<string, string> = {};
  const additionalFields: Record<string, string> = {};

  for (const field of fieldSchema.builtInFields) {
    values[field.inputName] = String((offer as Record<string, unknown> | undefined)?.[field.inputName] ?? "");
  }

  for (const field of fieldSchema.customFields) {
    additionalFields[field.fieldKey] = offer?.additionalFields[field.fieldKey] ?? "";
  }

  return {
    values,
    additionalFields,
    isPrimaryOffer: offer?.isPrimaryOffer ?? false
  };
}

function buildOfferPayload(fieldSchema: OfficeOfferFieldSchema, state: OfferFormState) {
  return {
    ...state.values,
    ...Object.fromEntries(
      fieldSchema.customFields.map((field) => [
        field.inputName,
        state.additionalFields[field.fieldKey] ?? ""
      ])
    ),
    isPrimaryOffer: state.isPrimaryOffer
  };
}

function translateOfferFieldLabel(label: string) {
  return offerFieldLabelMap[label] ?? label;
}

function getOfferFieldLabel(label: string, isRequired: boolean) {
  const displayLabel = translateOfferFieldLabel(label);
  return isRequired ? `${displayLabel} *` : displayLabel;
}

function getOfferFieldClassName(fieldClassName: string, context: "create" | "edit") {
  if (!fieldClassName.includes("is-span-4")) {
    return undefined;
  }

  return context === "create" ? "office-offer-create-notes" : "office-offer-edit-notes";
}

function buildOfferUploadState(): OfferUploadState {
  return {
    title: "",
    documentType: "Offer documents",
    linkedTaskId: ""
  };
}

function buildOfferFormDraftState(formTemplates: OfficeFormTemplateOption[]): OfferFormDraftState {
  return {
    templateId: formTemplates[0]?.id ?? "",
    linkedTaskId: "",
    name: ""
  };
}

function buildSignatureDraftState(): SignatureDraftState {
  return {
    recipientName: "",
    recipientEmail: "",
    recipientRole: "Buyer",
    signingOrder: ""
  };
}

function translateOfferMessage(value: string) {
  const exact = offerMessageMap[value] ?? value;
  return exact.replace(/^Document uploads must be (.+) or smaller\.$/, "文档大小不能超过 $1。");
}

function getOfferErrorMessage(error: unknown, fallback: string) {
  return translateOfferMessage(error instanceof Error ? error.message : fallback);
}

function getOfferStatusLabel(statusValue: OfferStatusValue, fallback: string) {
  return offerStatusLabelMap[statusValue] ?? fallback;
}

function getDocumentStatusLabel(statusValue: string, fallback: string) {
  return documentStatusLabelMap[statusValue] ?? fallback;
}

function getFormStatusLabel(statusValue: string, fallback: string) {
  return formStatusLabelMap[statusValue] ?? fallback;
}

function translateOfferReadiness(value: string) {
  if (value === "No linked documents") {
    return "没有关联文档";
  }

  if (value === "No signature requests") {
    return "没有签名请求";
  }

  const documentMatch = value.match(/^(\d+) documents?$/);
  if (documentMatch) {
    return `${documentMatch[1] ?? "0"} 份文档`;
  }

  const pendingMatch = value.match(/^(\d+) pending$/);
  if (pendingMatch) {
    return `${pendingMatch[1] ?? "0"} 个待处理`;
  }

  const signedMatch = value.match(/^(\d+) signed$/);
  if (signedMatch) {
    return `${signedMatch[1] ?? "0"} 个已签署`;
  }

  return value;
}

function getOfferTone(status: OfferStatusValue) {
  if (status === "accepted") {
    return "success" as const;
  }

  if (status === "rejected" || status === "withdrawn" || status === "expired") {
    return "danger" as const;
  }

  if (status === "countered" || status === "under_review") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function TransactionOffersCard({
  transactionId,
  snapshot,
  fieldSchema,
  taskOptions,
  formTemplates,
  canManageOffers,
  canReviewOffers,
  canAcceptOffers,
  canManageDocuments,
  canUseForms,
  canManageSignatures
}: TransactionOffersCardProps) {
  const router = useRouter();
  const [newOfferState, setNewOfferState] = useState<OfferFormState>(() =>
    buildOfferFormState(fieldSchema)
  );
  const [offerStates, setOfferStates] = useState<Record<string, OfferFormState>>(
    Object.fromEntries(
      snapshot.offers.map((offer) => [offer.id, buildOfferFormState(fieldSchema, offer)])
    )
  );
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    Object.fromEntries(snapshot.offers.map((offer) => [offer.id, ""]))
  );
  const [uploadStates, setUploadStates] = useState<Record<string, OfferUploadState>>(
    Object.fromEntries(snapshot.offers.map((offer) => [offer.id, buildOfferUploadState()]))
  );
  const [formDrafts, setFormDrafts] = useState<Record<string, OfferFormDraftState>>(
    Object.fromEntries(snapshot.offers.map((offer) => [offer.id, buildOfferFormDraftState(formTemplates)]))
  );
  const [signatureDrafts, setSignatureDrafts] = useState<Record<string, SignatureDraftState>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setNewOfferState(buildOfferFormState(fieldSchema));
    setOfferStates(
      Object.fromEntries(
        snapshot.offers.map((offer) => [offer.id, buildOfferFormState(fieldSchema, offer)])
      )
    );
    setCommentDrafts(
      Object.fromEntries(snapshot.offers.map((offer) => [offer.id, ""]))
    );
    setUploadStates(
      Object.fromEntries(snapshot.offers.map((offer) => [offer.id, buildOfferUploadState()]))
    );
    setFormDrafts(
      Object.fromEntries(
        snapshot.offers.map((offer) => [offer.id, buildOfferFormDraftState(formTemplates)])
      )
    );
    setSignatureDrafts({});
    setSelectedFiles({});
  }, [fieldSchema, formTemplates, snapshot.offers]);

  const visibleOfferFields: OfferVisibleField[] = sortSchemaFieldEntries([
    ...fieldSchema.builtInFields
      .filter((field) => field.isVisible)
      .map((field) => ({ kind: "builtIn" as const, field })),
    ...fieldSchema.customFields
      .filter((field) => field.isVisible)
      .map((field) => ({ kind: "custom" as const, field }))
  ]);

  const comparisonRows = useMemo(
    () => snapshot.offers.map((offer) => offer.comparison),
    [snapshot.offers]
  );

  function updateNewOfferValue(fieldName: string, value: string) {
    setNewOfferState((current) => ({
      ...current,
      values: {
        ...current.values,
        [fieldName]: value
      }
    }));
  }

  function updateNewOfferAdditionalField(fieldKey: string, value: string) {
    setNewOfferState((current) => ({
      ...current,
      additionalFields: {
        ...current.additionalFields,
        [fieldKey]: value
      }
    }));
  }

  function updateOfferValue(offerId: string, fieldName: string, value: string) {
    setOfferStates((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ??
          buildOfferFormState(
            fieldSchema,
            snapshot.offers.find((offer) => offer.id === offerId)
          )),
        values: {
          ...(current[offerId]?.values ??
            buildOfferFormState(
              fieldSchema,
              snapshot.offers.find((offer) => offer.id === offerId)
            ).values),
          [fieldName]: value
        }
      }
    }));
  }

  function updateOfferAdditionalField(offerId: string, fieldKey: string, value: string) {
    setOfferStates((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ??
          buildOfferFormState(
            fieldSchema,
            snapshot.offers.find((offer) => offer.id === offerId)
          )),
        additionalFields: {
          ...(current[offerId]?.additionalFields ??
            buildOfferFormState(
              fieldSchema,
              snapshot.offers.find((offer) => offer.id === offerId)
            ).additionalFields),
          [fieldKey]: value
        }
      }
    }));
  }

  function updateOfferPrimaryFlag(offerId: string, value: boolean) {
    setOfferStates((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ??
          buildOfferFormState(
            fieldSchema,
            snapshot.offers.find((offer) => offer.id === offerId)
          )),
        isPrimaryOffer: value
      }
    }));
  }

  function updateUploadState(offerId: string, field: keyof OfferUploadState, value: string) {
    setUploadStates((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ?? buildOfferUploadState()),
        [field]: value
      }
    }));
  }

  function updateFormDraft(offerId: string, field: keyof OfferFormDraftState, value: string) {
    setFormDrafts((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ?? buildOfferFormDraftState(formTemplates)),
        [field]: value
      }
    }));
  }

  function updateSignatureDraft(key: string, field: keyof SignatureDraftState, value: string) {
    setSignatureDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? buildSignatureDraftState()),
        [field]: value
      }
    }));
  }

  async function handleCreateOffer() {
    if (!newOfferState.values.title?.trim() || !newOfferState.values.offeringPartyName?.trim()) {
      setError("报价标题和报价方必填。");
      return;
    }

    setPendingAction("create-offer");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildOfferPayload(fieldSchema, newOfferState))
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "无法创建报价。");
      }

      setNewOfferState(buildOfferFormState(fieldSchema));
      router.refresh();
    } catch (createError) {
      setError(getOfferErrorMessage(createError, "无法创建报价。"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveOffer(offerId: string) {
    const offerState = offerStates[offerId];

    if (!offerState?.values.title?.trim() || !offerState.values.offeringPartyName?.trim()) {
      setError("报价标题和报价方必填。");
      return;
    }

    setPendingAction(`save-offer:${offerId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/offers/${offerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildOfferPayload(fieldSchema, offerState))
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "报价更新失败。");
      }

      router.refresh();
    } catch (updateError) {
      setError(getOfferErrorMessage(updateError, "报价更新失败。"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleOfferAction(
    offerId: string,
    action: "submit" | "receive" | "review" | "counter" | "accept" | "reject" | "withdraw" | "expire"
  ) {
    setPendingAction(`offer-action:${offerId}:${action}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/offers/${offerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "报价操作失败。");
      }

      router.refresh();
    } catch (transitionError) {
      setError(getOfferErrorMessage(transitionError, "报价操作失败。"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAddComment(offerId: string) {
    const body = commentDrafts[offerId]?.trim() ?? "";

    if (!body) {
      setError("评论内容必填。");
      return;
    }

    setPendingAction(`comment:${offerId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/offers/${offerId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ body })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "无法添加评论。");
      }

      setCommentDrafts((current) => ({ ...current, [offerId]: "" }));
      router.refresh();
    } catch (commentError) {
      setError(getOfferErrorMessage(commentError, "无法添加评论。"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUploadDocument(offerId: string) {
    const file = selectedFiles[offerId] ?? null;
    if (!file) {
      setError("请选择文件。");
      return;
    }

    const uploadState = uploadStates[offerId] ?? buildOfferUploadState();
    setPendingAction(`upload:${offerId}`);
    setError("");

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", uploadState.title.trim() || file.name);
      formData.set("documentType", uploadState.documentType.trim() || "Offer documents");
      formData.set("linkedTaskId", uploadState.linkedTaskId || "");
      formData.set("offerId", offerId);
      formData.set("isRequired", "false");
      formData.set("isUnsorted", "false");

      const response = await fetch(`/api/office/transactions/${transactionId}/documents`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "文档上传失败。");
      }

      setUploadStates((current) => ({ ...current, [offerId]: buildOfferUploadState() }));
      setSelectedFiles((current) => ({ ...current, [offerId]: null }));
      router.refresh();
    } catch (uploadError) {
      setError(getOfferErrorMessage(uploadError, "文档上传失败。"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateForm(offerId: string) {
    const draft = formDrafts[offerId] ?? buildOfferFormDraftState(formTemplates);

    if (!draft.templateId) {
      setError("请先选择表单模板。");
      return;
    }

    setPendingAction(`create-form:${offerId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/forms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateId: draft.templateId,
          linkedTaskId: draft.linkedTaskId || null,
          offerId,
          name: draft.name
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "无法创建表单。");
      }

      setFormDrafts((current) => ({ ...current, [offerId]: buildOfferFormDraftState(formTemplates) }));
      router.refresh();
    } catch (createError) {
      setError(getOfferErrorMessage(createError, "无法创建表单。"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateSignature(offerId: string, formId: string) {
    const draftKey = `${offerId}:${formId}`;
    const draft = signatureDrafts[draftKey] ?? buildSignatureDraftState();

    if (!draft.recipientName.trim() || !draft.recipientEmail.trim() || !draft.recipientRole.trim()) {
      setError("收件人姓名、邮箱和角色必填。");
      return;
    }

    setPendingAction(`create-signature:${draftKey}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/signatures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          offerId,
          formId,
          recipientName: draft.recipientName,
          recipientEmail: draft.recipientEmail,
          recipientRole: draft.recipientRole,
          signingOrder: draft.signingOrder ? Number(draft.signingOrder) : null
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "无法创建签名请求。");
      }

      setSignatureDrafts((current) => ({ ...current, [draftKey]: buildSignatureDraftState() }));
      router.refresh();
    } catch (signatureError) {
      setError(getOfferErrorMessage(signatureError, "无法创建签名请求。"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-detail-card" id="transaction-offers">
      <div className="office-card-head">
        <div>
          <h3>报价</h3>
          <span>后台报价跟踪、对比、评论，以及报价关联的文档、表单和签名。</span>
        </div>
        <div className="office-offer-head-metrics">
          {snapshot.acceptedOfferLabel ? (
            <StatusBadge tone="success">已接受：{snapshot.acceptedOfferLabel}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">尚无已接受报价</StatusBadge>
          )}
          {snapshot.expiringSoonCount > 0 ? (
            <StatusBadge tone="warning">{snapshot.expiringSoonCount} 个即将到期</StatusBadge>
          ) : null}
        </div>
      </div>

      {error ? <div className="office-inline-error">{error}</div> : null}

      {canManageOffers ? (
        <div className="office-offer-create-grid">
          {visibleOfferFields.map((entry) => {
            const field = entry.field;
            const fieldType =
              entry.kind === "builtIn" ? entry.field.control : entry.field.type;
            const fieldClassName =
              entry.kind === "builtIn" ? entry.field.className : "";
            const fieldValue =
              entry.kind === "builtIn"
                ? newOfferState.values[field.inputName] ?? ""
                : newOfferState.additionalFields[field.fieldKey] ?? "";

            return (
              <FormField
                className={getOfferFieldClassName(fieldClassName, "create")}
                key={`create:${entry.kind}:${field.fieldKey}`}
                label={getOfferFieldLabel(field.label, field.isRequired)}
              >
                {fieldType === "textarea" ? (
                  <TextareaInput
                    onChange={(event) =>
                      entry.kind === "builtIn"
                        ? updateNewOfferValue(field.inputName, event.target.value)
                        : updateNewOfferAdditionalField(
                            field.fieldKey,
                            event.target.value
                          )
                    }
                    rows={3}
                    value={fieldValue}
                  />
                ) : fieldType === "select" ? (
                  <SelectInput
                    onChange={(event) =>
                      entry.kind === "builtIn"
                        ? updateNewOfferValue(field.inputName, event.target.value)
                        : updateNewOfferAdditionalField(
                            field.fieldKey,
                            event.target.value
                          )
                    }
                    value={fieldValue}
                  >
                    <option value="">请选择...</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectInput>
                ) : (
                  <TextInput
                    onChange={(event) =>
                      entry.kind === "builtIn"
                        ? updateNewOfferValue(field.inputName, event.target.value)
                        : updateNewOfferAdditionalField(
                            field.fieldKey,
                            event.target.value
                          )
                    }
                    placeholder={
                      field.inputName === "title"
                        ? "报价 #1 / 最高且最佳"
                        : field.inputName === "offeringPartyName"
                          ? "买家 / 经纪人 / 报价方"
                          : undefined
                    }
                    type={fieldType === "date" ? "date" : "text"}
                    value={fieldValue}
                  />
                )}
              </FormField>
            );
          })}
          <div className="office-offer-create-actions">
            <Button disabled={pendingAction === "create-offer"} onClick={handleCreateOffer}>
              {pendingAction === "create-offer" ? "保存中..." : "创建报价"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="office-offer-list">
        {snapshot.offers.length ? (
          snapshot.offers.map((offer) => {
            const offerState =
              offerStates[offer.id] ?? buildOfferFormState(fieldSchema, offer);
            const uploadState = uploadStates[offer.id] ?? buildOfferUploadState();
            const formDraft = formDrafts[offer.id] ?? buildOfferFormDraftState(formTemplates);

            return (
              <article className="office-offer-row" id={`offer-${offer.id}`} key={offer.id}>
                <div className="office-offer-row-top">
                  <div className="office-offer-row-headline">
                    <div className="office-offer-row-title">
                      <strong>{offer.title}</strong>
                      <StatusBadge tone={getOfferTone(offer.statusValue)}>{getOfferStatusLabel(offer.statusValue, offer.status)}</StatusBadge>
                      {offer.isPrimaryOffer ? <StatusBadge tone="accent">主要</StatusBadge> : null}
                    </div>
                    <p>{offer.buyerName || offer.offeringPartyName}</p>
                  </div>
                  <div className="office-offer-row-metrics">
                    <span>{offer.price || "未填写价格"}</span>
                    {offer.earnestMoneyAmount ? <span>定金 {offer.earnestMoneyAmount}</span> : null}
                    {offer.expirationAt ? <span>到期 {offer.expirationAt}</span> : null}
                  </div>
                </div>

                <div className="office-offer-meta-grid">
                  <div><span>融资</span><strong>{offer.financingType || "未设置"}</strong></div>
                  <div><span>拟成交日期</span><strong>{offer.closingDateOffered || "未设置"}</strong></div>
                  <div><span>提交时间</span><strong>{offer.submittedAt || "未提交"}</strong></div>
                  <div><span>更新时间</span><strong>{offer.updatedAt || offer.createdAt}</strong></div>
                </div>

                {canManageOffers ? (
                  <div className="office-offer-edit-grid">
                    {visibleOfferFields.map((entry) => {
                      const field = entry.field;
                      const fieldType =
                        entry.kind === "builtIn" ? entry.field.control : entry.field.type;
                      const fieldClassName =
                        entry.kind === "builtIn" ? entry.field.className : "";
                      const fieldValue =
                        entry.kind === "builtIn"
                          ? offerState.values[field.inputName] ?? ""
                          : offerState.additionalFields[field.fieldKey] ?? "";

                      return (
                        <FormField
                          className={getOfferFieldClassName(fieldClassName, "edit")}
                          key={`${offer.id}:${entry.kind}:${field.fieldKey}`}
                          label={getOfferFieldLabel(field.label, field.isRequired)}
                        >
                          {fieldType === "textarea" ? (
                            <TextareaInput
                              rows={3}
                              value={fieldValue}
                              onChange={(event) =>
                                entry.kind === "builtIn"
                                  ? updateOfferValue(
                                      offer.id,
                                      field.inputName,
                                      event.target.value
                                    )
                                  : updateOfferAdditionalField(
                                      offer.id,
                                      field.fieldKey,
                                      event.target.value
                                    )
                              }
                            />
                          ) : fieldType === "select" ? (
                            <SelectInput
                              value={fieldValue}
                              onChange={(event) =>
                                entry.kind === "builtIn"
                                  ? updateOfferValue(
                                      offer.id,
                                      field.inputName,
                                      event.target.value
                                    )
                                  : updateOfferAdditionalField(
                                      offer.id,
                                      field.fieldKey,
                                      event.target.value
                                    )
                              }
                            >
                              <option value="">请选择...</option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </SelectInput>
                          ) : (
                            <TextInput
                              type={fieldType === "date" ? "date" : "text"}
                              value={fieldValue}
                              onChange={(event) =>
                                entry.kind === "builtIn"
                                  ? updateOfferValue(
                                      offer.id,
                                      field.inputName,
                                      event.target.value
                                    )
                                  : updateOfferAdditionalField(
                                      offer.id,
                                      field.fieldKey,
                                      event.target.value
                                    )
                              }
                            />
                          )}
                        </FormField>
                      );
                    })}
                    <FormField className="office-offer-edit-checkbox" label="主要报价">
                      <input
                        checked={offerState.isPrimaryOffer}
                        onChange={(event) =>
                          updateOfferPrimaryFlag(offer.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                    </FormField>
                    <div className="office-offer-action-row">
                      <Button
                        disabled={pendingAction === `save-offer:${offer.id}`}
                        onClick={() => handleSaveOffer(offer.id)}
                        size="sm"
                      >
                        {pendingAction === `save-offer:${offer.id}` ? "保存中..." : "保存报价"}
                      </Button>
                      {(offerActionMap[offer.statusValue] ?? []).map((action) => {
                        const canRun =
                          action.action === "accept"
                            ? canAcceptOffers
                            : canManageOffers || canReviewOffers;

                        if (!canRun) {
                          return null;
                        }

                        return (
                          <Button
                            disabled={pendingAction === `offer-action:${offer.id}:${action.action}`}
                            key={action.action}
                            onClick={() => handleOfferAction(offer.id, action.action as never)}
                            size="sm"
                            variant={action.action === "reject" || action.action === "withdraw" ? "danger" : "secondary"}
                          >
                            {action.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="office-offer-linked-grid">
                  <section className="office-offer-linked-section">
                    <div className="office-offer-subhead">
                      <h4>文档</h4>
                      <span>{offer.documents.length} 份已关联</span>
                    </div>
                    {offer.documents.length ? (
                      <ul className="office-offer-inline-list">
                        {offer.documents.map((document) => (
                          <li key={document.id}>
                            <a href={document.href} rel="noreferrer" target="_blank">
                              {document.title}
                            </a>
                            <StatusBadge tone={document.statusValue === "approved" || document.statusValue === "signed" ? "success" : "neutral"}>
                              {getDocumentStatusLabel(document.statusValue, document.status)}
                            </StatusBadge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState description="还没有报价文档。" title="没有关联文档" />
                    )}

                    {canManageDocuments ? (
                      <div className="office-offer-upload-grid">
                        <FormField label="文档标题">
                          <TextInput value={uploadState.title} onChange={(event) => updateUploadState(offer.id, "title", event.target.value)} />
                        </FormField>
                        <FormField label="文档类型">
                          <TextInput value={uploadState.documentType} onChange={(event) => updateUploadState(offer.id, "documentType", event.target.value)} />
                        </FormField>
                        <FormField label="关联任务">
                          <SelectInput value={uploadState.linkedTaskId} onChange={(event) => updateUploadState(offer.id, "linkedTaskId", event.target.value)}>
                            <option value="">不关联任务</option>
                            {taskOptions.map((task) => (
                              <option key={task.id} value={task.id}>
                                {task.title}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>
                        <FormField label="文件">
                          <input
                            className="office-file-input"
                            onChange={(event) =>
                              setSelectedFiles((current) => ({
                                ...current,
                                [offer.id]: event.target.files?.[0] ?? null
                              }))
                            }
                            type="file"
                          />
                        </FormField>
                        <Button
                          disabled={pendingAction === `upload:${offer.id}`}
                          onClick={() => handleUploadDocument(offer.id)}
                          size="sm"
                        >
                          {pendingAction === `upload:${offer.id}` ? "上传中..." : "上传文档"}
                        </Button>
                      </div>
                    ) : null}
                  </section>

                  <section className="office-offer-linked-section">
                    <div className="office-offer-subhead">
                      <h4>表单和电子签名</h4>
                      <span>{offer.forms.length} 份表单 · {offer.signatureRequests.length} 个请求</span>
                    </div>

                    {offer.forms.length ? (
                      <div className="office-offer-form-list">
                        {offer.forms.map((form) => {
                          const signatureDraftKey = `${offer.id}:${form.id}`;
                          const signatureDraft = signatureDrafts[signatureDraftKey] ?? buildSignatureDraftState();

                          return (
                            <div className="office-offer-form-row" key={form.id}>
                              <div className="office-offer-form-head">
                                <div>
                                  <strong>{form.name}</strong>
                                  <p>{translateOfferReadiness(form.signatureStatusSummary)}</p>
                                </div>
                                <StatusBadge tone={form.statusValue === "fully_signed" ? "success" : form.statusValue === "sent_for_signature" || form.statusValue === "partially_signed" ? "accent" : "neutral"}>
                                  {getFormStatusLabel(form.statusValue, form.status)}
                                </StatusBadge>
                              </div>
                              {form.documentId ? (
                                <Link className="office-inline-link" href={`#transaction-forms-signatures`}>
                                  在表单区查看
                                </Link>
                              ) : null}
                              {canManageSignatures ? (
                                <div className="office-offer-signature-grid">
                                  <FormField label="收件人姓名">
                                    <TextInput value={signatureDraft.recipientName} onChange={(event) => updateSignatureDraft(signatureDraftKey, "recipientName", event.target.value)} />
                                  </FormField>
                                  <FormField label="收件人邮箱">
                                    <TextInput value={signatureDraft.recipientEmail} onChange={(event) => updateSignatureDraft(signatureDraftKey, "recipientEmail", event.target.value)} />
                                  </FormField>
                                  <FormField label="收件人角色">
                                    <TextInput value={signatureDraft.recipientRole} onChange={(event) => updateSignatureDraft(signatureDraftKey, "recipientRole", event.target.value)} />
                                  </FormField>
                                  <FormField label="签署顺序">
                                    <TextInput value={signatureDraft.signingOrder} onChange={(event) => updateSignatureDraft(signatureDraftKey, "signingOrder", event.target.value)} />
                                  </FormField>
                                  <Button
                                    disabled={pendingAction === `create-signature:${signatureDraftKey}`}
                                    onClick={() => handleCreateSignature(offer.id, form.id)}
                                    size="sm"
                                  >
                                    {pendingAction === `create-signature:${signatureDraftKey}` ? "保存中..." : "发送签名"}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState description="还没有报价表单。" title="没有报价表单" />
                    )}

                    {canUseForms ? (
                      <div className="office-offer-form-create-grid">
                        <FormField label="模板">
                          <SelectInput value={formDraft.templateId} onChange={(event) => updateFormDraft(offer.id, "templateId", event.target.value)}>
                            {formTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>
                        <FormField label="关联任务">
                          <SelectInput value={formDraft.linkedTaskId} onChange={(event) => updateFormDraft(offer.id, "linkedTaskId", event.target.value)}>
                            <option value="">不关联任务</option>
                            {taskOptions.map((task) => (
                              <option key={task.id} value={task.id}>
                                {task.title}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>
                        <FormField label="表单名称">
                          <TextInput value={formDraft.name} onChange={(event) => updateFormDraft(offer.id, "name", event.target.value)} />
                        </FormField>
                        <Button
                          disabled={pendingAction === `create-form:${offer.id}`}
                          onClick={() => handleCreateForm(offer.id)}
                          size="sm"
                        >
                          {pendingAction === `create-form:${offer.id}` ? "创建中..." : "使用表单"}
                        </Button>
                      </div>
                    ) : null}
                  </section>
                </div>

                <section className="office-offer-comments-section">
                  <div className="office-offer-subhead">
                    <h4>内部评论</h4>
                    <span>{offer.comments.length}</span>
                  </div>
                  {offer.comments.length ? (
                    <ul className="office-offer-comment-list">
                      {offer.comments.map((comment) => (
                        <li key={comment.id}>
                          <div className="office-offer-comment-head">
                            <strong>{comment.authorName}</strong>
                            <span>{comment.createdAt}</span>
                          </div>
                          <p>{comment.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState description="可用评论记录内部报价讨论。" title="还没有报价评论" />
                  )}
                  <div className="office-offer-comment-compose">
                    <FormField label="添加评论">
                      <TextareaInput
                        onChange={(event) =>
                          setCommentDrafts((current) => ({ ...current, [offer.id]: event.target.value }))
                        }
                        rows={3}
                        value={commentDrafts[offer.id] ?? ""}
                      />
                    </FormField>
                    <Button
                      disabled={pendingAction === `comment:${offer.id}`}
                      onClick={() => handleAddComment(offer.id)}
                      size="sm"
                      variant="secondary"
                    >
                      {pendingAction === `comment:${offer.id}` ? "保存中..." : "添加评论"}
                    </Button>
                  </div>
                </section>
              </article>
            );
          })
        ) : (
          <EmptyState
            description="跟踪并对比买家报价，再把文档和签名关联到最终接受的路径。"
            title="此交易还没有报价"
          />
        )}
      </div>

      {comparisonRows.length > 1 ? (
        <div className="office-offer-comparison">
          <div className="office-offer-subhead">
            <h4>报价对比</h4>
            <span>{comparisonRows.length} 个报价</span>
          </div>
          <HorizontalScrollArea viewportClassName="office-table-scroll">
            <table className="office-offer-comparison-table">
              <thead>
                <tr>
                  <th>报价</th>
                  <th>价格</th>
                  <th>定金</th>
                  <th>成交日期</th>
                  <th>融资</th>
                  <th>状态</th>
                  <th>到期</th>
                  <th>文档</th>
                  <th>签名</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="office-offer-comparison-title">
                        <strong>{row.title}</strong>
                        <span>{row.buyerName || row.offeringPartyName}</span>
                        {row.isPrimaryOffer ? <StatusBadge tone="accent">主要</StatusBadge> : null}
                      </div>
                    </td>
                    <td>{row.price || "—"}</td>
                    <td>{row.earnestMoneyAmount || "—"}</td>
                    <td>{row.closingDateOffered || "—"}</td>
                    <td>{row.financingType || "—"}</td>
                    <td>
                      <StatusBadge tone={getOfferTone(row.statusValue)}>{getOfferStatusLabel(row.statusValue, row.status)}</StatusBadge>
                    </td>
                    <td>{row.expirationAt || "—"}</td>
                    <td>{translateOfferReadiness(row.documentReadiness)}</td>
                    <td>{translateOfferReadiness(row.signatureReadiness)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalScrollArea>
        </div>
      ) : null}
    </section>
  );
}
