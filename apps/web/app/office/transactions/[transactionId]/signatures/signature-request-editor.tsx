"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckboxField, FormField, SelectInput, StatusBadge, TextInput, TextareaInput } from "@acre/ui";
import type {
  OfficeSignatureAuditEntry,
  OfficeSignatureField,
  OfficeSignatureRequest,
  OfficeSignatureTemplate,
  OfficeTransactionDocument
} from "@acre/db";
import { usePdfPreview } from "../../../../../components/signature/use-pdf-preview";

type SignatureRequestEditorProps = {
  transactionId: string;
  document: OfficeTransactionDocument;
  initialRequest: OfficeSignatureRequest | null;
  initialFields: OfficeSignatureField[];
  initialAuditEntries: OfficeSignatureAuditEntry[];
  defaultSenderDisplayName: string;
  defaultReplyTo: string;
  availableTemplates?: OfficeSignatureTemplate[];
  initialTemplate?: OfficeSignatureTemplate | null;
};

type SignatureDraftState = {
  recipients: SignatureRecipientDraft[];
  ccRecipients: SignatureRecipientDraft[];
  emailSubject: string;
  emailBody: string;
  expiresAt: string;
  senderDisplayName: string;
  senderReplyTo: string;
};

type SignatureRecipientDraft = {
  id: string;
  roleKey: "signer" | "approver" | "cc";
  name: string;
  email: string;
  recipientRole: string;
  routingStep: string;
  sortOrder: number;
};

type SignatureTemplateCategoryKey = "transaction" | "hr" | "finance" | "admin" | "project_sales";

type TemplateDraftState = {
  templateId: string;
  name: string;
  description: string;
  category: SignatureTemplateCategoryKey;
};

type SignatureEditorStep = "recipients" | "fields";

type FieldGestureState =
  | {
      mode: "move";
      fieldId: string;
      pageNumber: number;
      pointerOffsetX: number;
      pointerOffsetY: number;
    }
  | {
      mode: "resize";
      fieldId: string;
      pageNumber: number;
      startPointerX: number;
      startPointerY: number;
      startWidth: number;
      startHeight: number;
    };

const fieldDefaults: Record<OfficeSignatureField["fieldType"], { label: string; width: number; height: number; fontStyle?: string }> = {
  signature: { label: "Signature", width: 0.26, height: 0.08, fontStyle: "signature" },
  date: { label: "Date", width: 0.18, height: 0.05 },
  initials: { label: "Initials", width: 0.16, height: 0.05 },
  name: { label: "Full Name", width: 0.24, height: 0.05 },
  text: { label: "Text", width: 0.24, height: 0.06 },
  email: { label: "Email", width: 0.26, height: 0.05 },
  title: { label: "Title", width: 0.22, height: 0.05 },
  company: { label: "Company", width: 0.28, height: 0.05 },
  checkbox: { label: "Checkbox", width: 0.06, height: 0.04 },
  dropdown: { label: "Dropdown", width: 0.24, height: 0.05 }
};

const placementFieldTools: OfficeSignatureField["fieldType"][] = [
  "signature",
  "initials",
  "date",
  "name",
  "text",
  "email",
  "title",
  "company",
  "checkbox",
  "dropdown"
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

const signatureRoleKeyLabelMap: Record<SignatureRecipientDraft["roleKey"], string> = {
  signer: "签署人",
  approver: "审批人",
  cc: "抄送"
};

const signatureFieldTypeLabelMap: Record<OfficeSignatureField["fieldType"], string> = {
  signature: "签名",
  date: "日期",
  initials: "姓名首字母",
  name: "全名",
  text: "文本",
  email: "邮箱",
  title: "职务",
  company: "公司",
  checkbox: "复选框",
  dropdown: "下拉选项"
};

const templateCategoryLabelMap: Record<SignatureTemplateCategoryKey, string> = {
  transaction: "交易",
  hr: "人事",
  finance: "财务",
  admin: "行政",
  project_sales: "项目销售"
};

const signatureEditorMessageMap: Record<string, string> = {
  "Complete every signer or approver row before continuing.": "继续前请完整填写每一位签署人或审批人。",
  "Each signer or approver needs a routing step of 1 or greater.": "每一位签署人或审批人的签署顺序必须大于或等于 1。",
  "Complete every CC recipient row before saving.": "保存前请完整填写每一位抄送收件人。",
  "At least one signer or approver is required.": "至少需要一位签署人或审批人。",
  "Signature request could not be saved.": "无法保存签名请求。",
  "Add at least one signature field before saving this step.": "保存此步骤前，请至少添加一个签名字段。",
  "Assign every field to a specific signer or approver before saving a multi-recipient request.": "多收件人请求保存前，请把每个字段分配给具体签署人或审批人。",
  "Signature draft could not be saved.": "无法保存签名草稿。",
  "Signature fields could not be saved.": "无法保存签名字段。",
  "Signature email could not be sent.": "无法发送签名邮件。",
  "Signature request email sent.": "签名请求邮件已发送。",
  "Signature field layout saved.": "签名字段布局已保存。",
  "Signature request update failed.": "签名请求更新失败。",
  "Signature request email resent.": "签名请求邮件已重新发送。",
  "Signature request marked expired.": "签名请求已标记为过期。",
  "Signature request canceled.": "签名请求已取消。",
  "Template name is required before saving.": "保存前请填写模板名称。",
  "Add recipients and fields before saving this request as a template.": "将此请求保存为模板前，请先添加收件人和字段。",
  "Signature template could not be saved.": "无法保存签名模板。",
  "Signature template saved.": "签名模板已保存。",
  "Recipients saved. Continue to PDF field placement.": "收件人已保存。请继续放置 PDF 字段。",
  "The PDF preview could not be loaded.": "无法加载 PDF 预览。",
  "The PDF preview canvas could not be created.": "无法创建 PDF 预览画布。",
  "Only PDF documents can use the external signature workflow.": "只有 PDF 文档可以使用外部签名流程。",
  "At least one signer is required.": "至少需要一位签署人。"
};

const minimumFieldWidth = 0.08;
const minimumFieldHeight = 0.04;
const fieldPadding = 0.02;
const fieldBoundary = 0.98;

function clampFieldMetric(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getSignatureStatusLabel(statusKey: OfficeSignatureRequest["statusKey"]) {
  return signatureStatusLabelMap[statusKey] ?? statusKey;
}

function getRecipientRoleKeyLabel(roleKey: SignatureRecipientDraft["roleKey"]) {
  return signatureRoleKeyLabelMap[roleKey] ?? roleKey;
}

function translateRecipientRoleValue(value: string) {
  const roleMap: Record<string, string> = {
    Signer: "签署人",
    Approver: "审批人",
    CC: "抄送"
  };

  return roleMap[value] ?? value;
}

function getFieldTypeLabel(fieldType: OfficeSignatureField["fieldType"]) {
  return signatureFieldTypeLabelMap[fieldType] ?? fieldDefaults[fieldType].label;
}

function translateTemplateCategoryLabel(label: string) {
  const categoryMap: Record<string, string> = {
    Transaction: "交易",
    HR: "人事",
    Finance: "财务",
    Admin: "行政",
    "Project sales": "项目销售"
  };

  return categoryMap[label] ?? label;
}

function translateSignatureEditorCopy(value: string) {
  return signatureEditorMessageMap[value] ?? value;
}

function getSignatureEditorErrorMessage(error: unknown, fallback: string) {
  return translateSignatureEditorCopy(error instanceof Error ? error.message : fallback);
}

function createRecipientDraft(
  roleKey: SignatureRecipientDraft["roleKey"],
  overrides: Partial<SignatureRecipientDraft> = {}
): SignatureRecipientDraft {
  return {
    id: overrides.id ?? `draft-recipient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roleKey,
    name: overrides.name ?? "",
    email: overrides.email ?? "",
    recipientRole: overrides.recipientRole ?? (roleKey === "approver" ? "Approver" : roleKey === "cc" ? "CC" : "Signer"),
    routingStep: overrides.routingStep ?? (roleKey === "cc" ? "" : "1"),
    sortOrder: overrides.sortOrder ?? 0
  };
}

function buildDraftState(
  document: OfficeTransactionDocument,
  request: OfficeSignatureRequest | null,
  template: OfficeSignatureTemplate | null,
  defaultSenderDisplayName: string,
  defaultReplyTo: string
): SignatureDraftState {
  const recipients =
    request?.recipients.filter((recipient) => recipient.roleKey !== "cc").map((recipient) =>
      createRecipientDraft(recipient.roleKey === "approver" ? "approver" : "signer", {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        recipientRole: recipient.recipientRole,
        routingStep: String(recipient.routingStep),
        sortOrder: recipient.sortOrder
      })
    ) ?? [];
  const ccRecipients =
    request?.ccRecipients.map((recipient) =>
      createRecipientDraft("cc", {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        recipientRole: recipient.recipientRole,
        routingStep: "",
        sortOrder: recipient.sortOrder
      })
    ) ?? [];
  const fallbackRecipient =
    recipients[0] ??
    createRecipientDraft("signer", {
      name: request?.recipientName ?? "",
      email: request?.recipientEmail ?? "",
      recipientRole: request?.recipientRole ?? "Signer",
      routingStep: request?.signingOrder ? String(request.signingOrder) : "1",
      sortOrder: 0
    });

  const templateRecipients =
    template?.recipients.filter((recipient) => recipient.roleKey !== "cc").map((recipient) =>
      createRecipientDraft(recipient.roleKey === "approver" ? "approver" : "signer", {
        id: recipient.id,
        name: "",
        email: "",
        recipientRole: recipient.recipientRole,
        routingStep: String(recipient.routingStep),
        sortOrder: recipient.sortOrder
      })
    ) ?? [];
  const templateCcRecipients =
    template?.recipients.filter((recipient) => recipient.roleKey === "cc").map((recipient) =>
      createRecipientDraft("cc", {
        id: recipient.id,
        name: "",
        email: "",
        recipientRole: recipient.recipientRole,
        routingStep: "",
        sortOrder: recipient.sortOrder
      })
    ) ?? [];

  return {
    recipients: recipients.length > 0 ? recipients : templateRecipients.length > 0 ? templateRecipients : [fallbackRecipient],
    ccRecipients: ccRecipients.length > 0 ? ccRecipients : templateCcRecipients,
    emailSubject: request?.emailSubject ?? template?.emailSubject ?? `Signature requested: ${document.title}`,
    emailBody:
      request?.emailBody ?? template?.emailBody ?? `${defaultSenderDisplayName} sent you a document to review and sign in Acre.`,
    expiresAt: request?.expiresAt ? request.expiresAt.slice(0, 10) : "",
    senderDisplayName: request?.senderDisplayName || template?.senderDisplayName || defaultSenderDisplayName,
    senderReplyTo: request?.senderReplyTo || template?.senderReplyTo || defaultReplyTo
  };
}

function buildTemplateDraftState(template: OfficeSignatureTemplate | null): TemplateDraftState {
  return {
    templateId: template?.id ?? "",
    name: template?.name ?? "",
    description: template?.description ?? "",
    category: template?.category ?? "transaction"
  };
}

function mapTemplateFieldToSignatureField(templateField: OfficeSignatureTemplate["fields"][number]): OfficeSignatureField {
  return {
    id: `template-field-${templateField.id}`,
    signatureRequestId: "",
    assignedRecipientId: templateField.assignedTemplateRecipientId || null,
    fieldType: templateField.fieldType,
    label: templateField.label,
    page: templateField.page,
    x: templateField.x,
    y: templateField.y,
    width: templateField.width,
    height: templateField.height,
    required: templateField.required,
    defaultValue: templateField.defaultValue,
    fontStyle: templateField.fontStyle,
    fieldKey: templateField.fieldKey,
    isReadOnly: templateField.isReadOnly,
    isSystemPrefilled: templateField.isSystemPrefilled,
    visibilityRule: templateField.visibilityRule,
    mirrorGroup: templateField.mirrorGroup,
    fieldOptions: templateField.fieldOptions,
    sortOrder: templateField.sortOrder
  };
}

function getRequestTone(statusKey: OfficeSignatureRequest["statusKey"]) {
  if (statusKey === "completed") {
    return "success" as const;
  }

  if (statusKey === "canceled" || statusKey === "declined" || statusKey === "expired" || statusKey === "voided") {
    return "danger" as const;
  }

  if (statusKey === "pending_send" || statusKey === "sent" || statusKey === "viewed" || statusKey === "signed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function isRecipientRowComplete(recipient: SignatureRecipientDraft) {
  return Boolean(recipient.name.trim() && recipient.email.trim() && recipient.recipientRole.trim());
}

function getRecipientBindingSummary(recipient: SignatureRecipientDraft | null) {
  if (!recipient) {
    return {
      badge: "未分配",
      detail: "请选择签署人或审批人"
    };
  }

  return {
    badge: `${getRecipientRoleKeyLabel(recipient.roleKey)} · 第 ${recipient.routingStep || "1"} 步`,
    detail: recipient.name || recipient.email || translateRecipientRoleValue(recipient.recipientRole) || "收件人"
  };
}

export function SignatureRequestEditor({
  transactionId,
  document,
  initialRequest,
  initialFields,
  initialAuditEntries,
  defaultSenderDisplayName,
  defaultReplyTo,
  availableTemplates = [],
  initialTemplate = null
}: SignatureRequestEditorProps) {
  const router = useRouter();
  const { pages, isLoading, error: previewError } = usePdfPreview(document.storageUrl);
  const [requestId, setRequestId] = useState(initialRequest?.id ?? "");
  const [requestStatus, setRequestStatus] = useState<OfficeSignatureRequest["statusKey"]>(initialRequest?.statusKey ?? "draft");
  const [draftState, setDraftState] = useState<SignatureDraftState>(
    buildDraftState(document, initialRequest, initialTemplate, defaultSenderDisplayName, defaultReplyTo)
  );
  const [fields, setFields] = useState<OfficeSignatureField[]>(
    initialFields.length > 0 ? initialFields : initialTemplate?.fields.map(mapTemplateFieldToSignatureField) ?? []
  );
  const [auditEntries] = useState<OfficeSignatureAuditEntry[]>(initialAuditEntries);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraftState>(() => buildTemplateDraftState(initialTemplate));
  const [selectedTool, setSelectedTool] = useState<OfficeSignatureField["fieldType"]>("signature");
  const [selectedFieldId, setSelectedFieldId] = useState<string>(initialFields[0]?.id ?? "");
  const [activeGesture, setActiveGesture] = useState<FieldGestureState | null>(null);
  const [activeStep, setActiveStep] = useState<SignatureEditorStep>(initialRequest ? "fields" : "recipients");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const previewCanvasRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const fieldsRef = useRef(fields);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId]
  );
  const recipientLookup = useMemo(
    () => new Map(draftState.recipients.map((recipient) => [recipient.id, recipient])),
    [draftState.recipients]
  );

  const actionableRecipients = draftState.recipients;
  const canAccessFieldStep = Boolean(requestId);
  const isRecipientsStep = activeStep === "recipients";
  const isFieldsStep = activeStep === "fields";

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  useEffect(() => {
    if (!requestId && activeStep !== "recipients") {
      setActiveStep("recipients");
    }
  }, [activeStep, requestId]);

  useEffect(() => {
    if (!activeGesture) {
      return;
    }

    const gesture = activeGesture;

    function handlePointerMove(event: PointerEvent) {
      const previewCanvas = previewCanvasRefs.current[gesture.pageNumber];
      const field = fieldsRef.current.find((entry) => entry.id === gesture.fieldId);

      if (!previewCanvas || !field || field.page !== gesture.pageNumber) {
        return;
      }

      const bounds = previewCanvas.getBoundingClientRect();
      const relativeX = (event.clientX - bounds.left) / bounds.width;
      const relativeY = (event.clientY - bounds.top) / bounds.height;

      if (gesture.mode === "move") {
        updateField(gesture.fieldId, {
          x: clampFieldMetric(relativeX - gesture.pointerOffsetX, fieldPadding, fieldBoundary - field.width),
          y: clampFieldMetric(relativeY - gesture.pointerOffsetY, fieldPadding, fieldBoundary - field.height)
        });
        return;
      }

      updateField(gesture.fieldId, {
        width: clampFieldMetric(
          gesture.startWidth + (relativeX - gesture.startPointerX),
          minimumFieldWidth,
          fieldBoundary - field.x
        ),
        height: clampFieldMetric(
          gesture.startHeight + (relativeY - gesture.startPointerY),
          minimumFieldHeight,
          fieldBoundary - field.y
        )
      });
    }

    function handlePointerUp() {
      setActiveGesture(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [activeGesture]);

  function openStep(step: SignatureEditorStep) {
    if (step === "fields" && !canAccessFieldStep) {
      return;
    }

    setActiveStep(step);
    setError("");
    setSuccessMessage("");
  }

  function updateDraftField(field: Exclude<keyof SignatureDraftState, "recipients" | "ccRecipients">, value: string) {
    setDraftState((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateRecipient(
    collection: "recipients" | "ccRecipients",
    recipientId: string,
    field: keyof SignatureRecipientDraft,
    value: string
  ) {
    setDraftState((current) => ({
      ...current,
      [collection]: current[collection].map((recipient) =>
        recipient.id === recipientId
          ? {
              ...recipient,
              [field]: value
            }
          : recipient
      )
    }));
  }

  function addRecipient(roleKey: SignatureRecipientDraft["roleKey"]) {
    setDraftState((current) => {
      const collection = roleKey === "cc" ? "ccRecipients" : "recipients";
      const nextRecipient = createRecipientDraft(roleKey, {
        sortOrder: current.recipients.length + current.ccRecipients.length,
        routingStep: roleKey === "cc" ? "" : String(Math.max(1, current.recipients.length + 1))
      });

      return {
        ...current,
        [collection]: [...current[collection], nextRecipient]
      };
    });
  }

  function removeRecipient(collection: "recipients" | "ccRecipients", recipientId: string) {
    setDraftState((current) => {
      const nextRecipients = current[collection].filter((recipient) => recipient.id !== recipientId);
      const fallbackOwnerId = (collection === "recipients" ? nextRecipients : current.recipients)[0]?.id ?? null;

      setFields((existingFields) =>
        existingFields.map((field) =>
          field.assignedRecipientId === recipientId
            ? {
                ...field,
                assignedRecipientId: fallbackOwnerId
              }
            : field
        )
      );

      return {
        ...current,
        [collection]: collection === "recipients" && nextRecipients.length === 0 ? [createRecipientDraft("signer")] : nextRecipients
      };
    });
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
    if (event.target instanceof Element && event.target.closest(".office-signature-field-token")) {
      return;
    }

    const currentTarget = event.currentTarget;
    const bounds = currentTarget.getBoundingClientRect();
    const defaults = fieldDefaults[selectedTool];
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const nextField: OfficeSignatureField = {
      id,
      signatureRequestId: requestId,
      assignedRecipientId: actionableRecipients[0]?.id ?? null,
      fieldType: selectedTool,
      label: defaults.label,
      page: pageNumber,
      x: clampFieldMetric(relativeX - defaults.width / 2, fieldPadding, fieldBoundary - defaults.width),
      y: clampFieldMetric(relativeY - defaults.height / 2, fieldPadding, fieldBoundary - defaults.height),
      width: defaults.width,
      height: defaults.height,
      required: true,
      defaultValue: selectedTool === "date" ? new Date().toISOString().slice(0, 10) : "",
      fontStyle: defaults.fontStyle ?? "",
      fieldKey: "",
      isReadOnly: false,
      isSystemPrefilled: false,
      visibilityRule: {},
      mirrorGroup: "",
      fieldOptions: {},
      sortOrder: fields.length
    };

    setFields((current) => [...current, nextField]);
    setSelectedFieldId(id);
    setSuccessMessage("");
  }

  function handleFieldPointerDown(fieldId: string, pageNumber: number, event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    setSelectedFieldId(fieldId);
    const previewCanvas = previewCanvasRefs.current[pageNumber];
    const field = fieldsRef.current.find((entry) => entry.id === fieldId);

    if (!previewCanvas || !field) {
      return;
    }

    const bounds = previewCanvas.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;

    setActiveGesture({
      mode: "move",
      fieldId,
      pageNumber,
      pointerOffsetX: relativeX - field.x,
      pointerOffsetY: relativeY - field.y
    });
  }

  function handleResizePointerDown(fieldId: string, pageNumber: number, event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    setSelectedFieldId(fieldId);
    const previewCanvas = previewCanvasRefs.current[pageNumber];
    const field = fieldsRef.current.find((entry) => entry.id === fieldId);

    if (!previewCanvas || !field) {
      return;
    }

    const bounds = previewCanvas.getBoundingClientRect();
    setActiveGesture({
      mode: "resize",
      fieldId,
      pageNumber,
      startPointerX: (event.clientX - bounds.left) / bounds.width,
      startPointerY: (event.clientY - bounds.top) / bounds.height,
      startWidth: field.width,
      startHeight: field.height
    });
  }

  function setPreviewCanvasRef(pageNumber: number, node: HTMLDivElement | null) {
    previewCanvasRefs.current[pageNumber] = node;
  }

  function removeField(fieldId: string) {
    setFields((current) => current.filter((field) => field.id !== fieldId));
    setSelectedFieldId((current) => (current === fieldId ? "" : current));
  }

  function validateRecipients() {
    const incompleteRecipient = draftState.recipients.find((recipient) => !isRecipientRowComplete(recipient));

    if (incompleteRecipient) {
      throw new Error("Complete every signer or approver row before continuing.");
    }

    const invalidRoutingStepRecipient = draftState.recipients.find((recipient) => {
      const routingStep = Number(recipient.routingStep || "0");
      return !Number.isFinite(routingStep) || routingStep < 1;
    });

    if (invalidRoutingStepRecipient) {
      throw new Error("Each signer or approver needs a routing step of 1 or greater.");
    }

    const incompleteCcRecipient = draftState.ccRecipients.find((recipient) => !recipient.name.trim() || !recipient.email.trim());

    if (incompleteCcRecipient) {
      throw new Error("Complete every CC recipient row before saving.");
    }

    const validRecipients = draftState.recipients.filter(isRecipientRowComplete);

    if (!validRecipients.length) {
      throw new Error("At least one signer or approver is required.");
    }

    return validRecipients;
  }

  function buildRecipientIdMap(previousRecipientDrafts: SignatureRecipientDraft[], nextRequest: OfficeSignatureRequest) {
    const recipientIdMap = new Map<string, string>();

    for (const draftRecipient of previousRecipientDrafts) {
      const matchedRecipient = [...nextRequest.recipients, ...nextRequest.ccRecipients].find(
        (recipient) =>
          recipient.sortOrder === draftRecipient.sortOrder &&
          recipient.roleKey === draftRecipient.roleKey &&
          recipient.email.trim().toLowerCase() === draftRecipient.email.trim().toLowerCase()
      );

      if (matchedRecipient) {
        recipientIdMap.set(draftRecipient.id, matchedRecipient.id);
      }
    }

    return recipientIdMap;
  }

  async function persistSignatureRequest(options: {
    action: "save-recipients" | "save-fields" | "send";
    requireFields: boolean;
    continueToFieldStep?: boolean;
    successMessage: string;
  }) {
    let validRecipients: SignatureRecipientDraft[];

    try {
      validRecipients = validateRecipients();
    } catch (validationError) {
      setError(getSignatureEditorErrorMessage(validationError, "Signature request could not be saved."));
      return;
    }

    if (options.requireFields && !fields.length) {
      setError(translateSignatureEditorCopy("Add at least one signature field before saving this step."));
      return;
    }

    if (options.requireFields && validRecipients.length > 1 && fields.some((field) => !field.assignedRecipientId)) {
      setError(translateSignatureEditorCopy("Assign every field to a specific signer or approver before saving a multi-recipient request."));
      return;
    }

    const shouldSend = options.action === "send";

    setPendingAction(options.action);
    setError("");
    setSuccessMessage("");

    try {
      const previousRecipientDrafts = [...draftState.recipients, ...draftState.ccRecipients];
      const primaryRecipient = validRecipients[0]!;
      const requestResponse = await fetch(`/api/office/transactions/${transactionId}/signatures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signatureRequestId: requestId || null,
          documentId: document.id,
          recipientName: primaryRecipient.name,
          recipientEmail: primaryRecipient.email,
          recipientRole: primaryRecipient.recipientRole,
          recipients: draftState.recipients.map((recipient, index) => ({
            id: recipient.id,
            role: recipient.roleKey,
            name: recipient.name,
            email: recipient.email,
            recipientRole: recipient.recipientRole,
            routingStep: recipient.roleKey === "cc" ? null : Number(recipient.routingStep || "1"),
            sortOrder: index
          })),
          ccRecipients: draftState.ccRecipients.map((recipient, index) => ({
            id: recipient.id,
            role: "cc",
            name: recipient.name,
            email: recipient.email,
            recipientRole: recipient.recipientRole,
            routingStep: null,
            sortOrder: draftState.recipients.length + index
          })),
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
      const recipientIdMap = buildRecipientIdMap(previousRecipientDrafts, nextRequest);

      setRequestId(nextRequestId);
      setRequestStatus(nextRequest.statusKey);
      setDraftState(buildDraftState(document, nextRequest, initialTemplate, defaultSenderDisplayName, defaultReplyTo));

      if (fields.length > 0) {
        const fieldsResponse = await fetch(`/api/office/transactions/${transactionId}/signatures/${nextRequestId}/fields`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: fields.map((field, index) => ({
              ...field,
              assignedRecipientId: field.assignedRecipientId
                ? recipientIdMap.get(field.assignedRecipientId) ?? field.assignedRecipientId
                : null,
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
      }

      if (shouldSend) {
        const sendResponse = await fetch(`/api/office/transactions/${transactionId}/signatures/${nextRequestId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action:
              requestStatus === "sent" ||
              requestStatus === "viewed" ||
              requestStatus === "expired" ||
              requestStatus === "voided" ||
              requestStatus === "canceled" ||
              requestStatus === "signed"
                ? "resend"
                : "send"
          })
        });

        const sendPayload = (await sendResponse.json().catch(() => null)) as
          | { error?: string; signatureRequest?: OfficeSignatureRequest }
          | null;

        if (!sendResponse.ok || !sendPayload?.signatureRequest) {
          throw new Error(sendPayload?.error ?? "Signature email could not be sent.");
        }

        setRequestStatus(sendPayload.signatureRequest.statusKey);
      }

      if (!requestId) {
        router.replace(`/office/transactions/${transactionId}/signatures/${nextRequestId}`);
      } else if (options.continueToFieldStep) {
        setActiveStep("fields");
      }

      setSuccessMessage(options.successMessage);
      router.refresh();
    } catch (saveError) {
      setError(getSignatureEditorErrorMessage(saveError, "Signature draft could not be saved."));
    } finally {
      setPendingAction(null);
    }
  }

  async function saveDraft(sendAfterSave: boolean) {
    await persistSignatureRequest({
      action: sendAfterSave ? "send" : "save-fields",
      requireFields: true,
      successMessage: translateSignatureEditorCopy(sendAfterSave ? "Signature request email sent." : "Signature field layout saved.")
    });
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
          ? translateSignatureEditorCopy("Signature request email resent.")
          : action === "expire"
            ? translateSignatureEditorCopy("Signature request marked expired.")
            : translateSignatureEditorCopy("Signature request canceled.")
      );
      router.refresh();
    } catch (actionError) {
      setError(getSignatureEditorErrorMessage(actionError, "Signature request update failed."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTemplate() {
    if (!templateDraft.name.trim()) {
      setError(translateSignatureEditorCopy("Template name is required before saving."));
      return;
    }

    if (draftState.recipients.length === 0 || fields.length === 0) {
      setError(translateSignatureEditorCopy("Add recipients and fields before saving this request as a template."));
      return;
    }

    setPendingAction("save-template");
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/office/signatures/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateId: templateDraft.templateId || null,
          name: templateDraft.name,
          description: templateDraft.description,
          category: templateDraft.category,
          isActive: true,
          emailSubject: draftState.emailSubject,
          emailBody: draftState.emailBody,
          senderDisplayName: draftState.senderDisplayName,
          senderReplyTo: draftState.senderReplyTo,
          recipients: [
            ...draftState.recipients.map((recipient, index) => ({
              id: recipient.id,
              role: recipient.roleKey,
              recipientRole: recipient.recipientRole,
              routingStep: Number(recipient.routingStep || "1"),
              sortOrder: index
            })),
            ...draftState.ccRecipients.map((recipient, index) => ({
              id: recipient.id,
              role: "cc",
              recipientRole: recipient.recipientRole,
              routingStep: 0,
              sortOrder: draftState.recipients.length + index
            }))
          ],
          fields: fields.map((field, index) => ({
            assignedTemplateRecipientId: field.assignedRecipientId,
            fieldType: field.fieldType,
            label: field.label,
            page: field.page,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            required: field.required,
            defaultValue: field.defaultValue,
            fontStyle: field.fontStyle,
            fieldKey: field.fieldKey,
            isReadOnly: field.isReadOnly,
            isSystemPrefilled: field.isSystemPrefilled,
            visibilityRule: field.visibilityRule,
            mirrorGroup: field.mirrorGroup,
            fieldOptions: field.fieldOptions,
            sortOrder: index
          }))
        })
      });

      const payload = (await response.json().catch(() => null)) as { template?: OfficeSignatureTemplate; error?: string } | null;

      if (!response.ok || !payload?.template) {
        throw new Error(payload?.error ?? "Signature template could not be saved.");
      }

      setTemplateDraft({
        templateId: payload.template.id,
        name: payload.template.name,
        description: payload.template.description,
        category: payload.template.category
      });
      setSuccessMessage(translateSignatureEditorCopy("Signature template saved."));
    } catch (templateError) {
      setError(getSignatureEditorErrorMessage(templateError, "Signature template could not be saved."));
    } finally {
      setPendingAction(null);
    }
  }

  function handleTemplateSelection(templateId: string) {
    const query = new URLSearchParams({
      documentId: document.id
    });

    if (templateId) {
      query.set("templateId", templateId);
    }

    router.push(`/office/transactions/${transactionId}/signatures/new?${query.toString()}`);
  }

  return (
    <div className="office-signature-editor">
      <div className="office-signature-editor-main">
        <section className="office-detail-card office-signature-stepper-card">
          <div className="office-card-head">
            <div>
              <h3>签名请求流程</h3>
              <span>先保存收件人，再在 PDF 上放置签名字段，并绑定到正确签署人。</span>
            </div>
            {requestId ? <StatusBadge tone={getRequestTone(requestStatus)}>{getSignatureStatusLabel(requestStatus)}</StatusBadge> : null}
          </div>

          <div className="office-signature-stepper">
            <button
              className={`office-signature-step${isRecipientsStep ? " is-active" : ""}${requestId ? " is-complete" : ""}`}
              onClick={() => openStep("recipients")}
              type="button"
            >
              <span className="office-signature-step-index">第 1 步</span>
              <strong>收件人与发送设置</strong>
              <span>选择签署人、审批人、抄送、签署顺序和邀请邮件内容。</span>
            </button>

            <button
              className={`office-signature-step${isFieldsStep ? " is-active" : ""}${canAccessFieldStep ? "" : " is-locked"}`}
              disabled={!canAccessFieldStep}
              onClick={() => openStep("fields")}
              type="button"
            >
              <span className="office-signature-step-index">第 2 步</span>
              <strong>PDF 字段放置</strong>
              <span>在 PDF 上放置字段，并把每个字段分配给一位签署人或审批人。</span>
            </button>
          </div>

          {!canAccessFieldStep ? (
            <p className="office-signature-helper">
              请先保存第 1 步。请求创建后，第 2 步会解锁，签名字段就可以分配给正确签署人。
            </p>
          ) : null}
        </section>

        {isRecipientsStep ? (
          <>
            <section className="office-detail-card">
              <div className="office-card-head">
                <div>
                  <h3>第 1 步 · 收件人与发送设置</h3>
                  <span>先配置参与人。保存此步骤后，PDF 字段放置阶段会解锁。</span>
                </div>
              </div>

              <div className="office-signature-summary-list">
                <p>
                  <strong>需要操作的收件人</strong>
                </p>
                {draftState.recipients.map((recipient) => (
                  <p key={recipient.id}>
                    {getRecipientRoleKeyLabel(recipient.roleKey)} · 第 {recipient.routingStep || "1"} 步 · {recipient.name || "新收件人"}
                  </p>
                ))}
                {draftState.ccRecipients.length > 0 ? (
                  <p>
                    <strong>抄送收件人</strong> · {draftState.ccRecipients.length}
                  </p>
                ) : null}
              </div>

              <div className="office-signature-section-actions office-signature-add-actions">
                <Button onClick={() => addRecipient("signer")} variant="secondary">
                  添加签署人
                </Button>
                <Button onClick={() => addRecipient("approver")} variant="secondary">
                  添加审批人
                </Button>
                <Button onClick={() => addRecipient("cc")} variant="secondary">
                  添加抄送
                </Button>
              </div>

              <div className="office-signature-audit-list">
                {draftState.recipients.map((recipient) => (
                  <article className="office-signature-audit-row" key={recipient.id}>
                    <div className="office-signature-audit-head">
                      <strong>{getRecipientRoleKeyLabel(recipient.roleKey)}</strong>
                      <span>第 {recipient.routingStep || "1"} 步</span>
                    </div>
                    <div className="office-signature-recipient-grid">
                      <FormField label="角色">
                        <SelectInput
                          onChange={(event) =>
                            updateRecipient("recipients", recipient.id, "roleKey", event.target.value as SignatureRecipientDraft["roleKey"])
                          }
                          value={recipient.roleKey}
                        >
                          <option value="signer">签署人</option>
                          <option value="approver">审批人</option>
                        </SelectInput>
                      </FormField>
                      <FormField label="姓名">
                        <TextInput onChange={(event) => updateRecipient("recipients", recipient.id, "name", event.target.value)} value={recipient.name} />
                      </FormField>
                      <FormField label="邮箱">
                        <TextInput
                          onChange={(event) => updateRecipient("recipients", recipient.id, "email", event.target.value)}
                          type="email"
                          value={recipient.email}
                        />
                      </FormField>
                      <FormField label="收件人身份">
                        <TextInput
                          onChange={(event) => updateRecipient("recipients", recipient.id, "recipientRole", event.target.value)}
                          value={recipient.recipientRole}
                        />
                      </FormField>
                      <FormField label="签署顺序">
                        <TextInput
                          inputMode="numeric"
                          onChange={(event) => updateRecipient("recipients", recipient.id, "routingStep", event.target.value)}
                          value={recipient.routingStep}
                        />
                      </FormField>
                    </div>
                    <div className="office-signature-recipient-actions">
                      <Button onClick={() => removeRecipient("recipients", recipient.id)} size="sm" variant="danger">
                        移除
                      </Button>
                    </div>
                  </article>
                ))}

                {draftState.ccRecipients.map((recipient) => (
                  <article className="office-signature-audit-row" key={recipient.id}>
                    <div className="office-signature-audit-head">
                      <strong>抄送</strong>
                      <span>只读副本</span>
                    </div>
                    <div className="office-signature-recipient-grid">
                      <FormField label="姓名">
                        <TextInput onChange={(event) => updateRecipient("ccRecipients", recipient.id, "name", event.target.value)} value={recipient.name} />
                      </FormField>
                      <FormField label="邮箱">
                        <TextInput
                          onChange={(event) => updateRecipient("ccRecipients", recipient.id, "email", event.target.value)}
                          type="email"
                          value={recipient.email}
                        />
                      </FormField>
                      <FormField label="收件人身份">
                        <TextInput
                          onChange={(event) => updateRecipient("ccRecipients", recipient.id, "recipientRole", event.target.value)}
                          value={recipient.recipientRole}
                        />
                      </FormField>
                    </div>
                    <div className="office-signature-recipient-actions">
                      <Button onClick={() => removeRecipient("ccRecipients", recipient.id)} size="sm" variant="danger">
                        移除
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="office-document-upload-grid">
                <FormField label="到期日期">
                  <TextInput onChange={(event) => updateDraftField("expiresAt", event.target.value)} type="date" value={draftState.expiresAt} />
                </FormField>
                <FormField className="office-form-grid-span-2" label="邮件主题">
                  <TextInput onChange={(event) => updateDraftField("emailSubject", event.target.value)} value={draftState.emailSubject} />
                </FormField>
                <FormField className="office-form-grid-span-2" label="发件人显示名">
                  <TextInput onChange={(event) => updateDraftField("senderDisplayName", event.target.value)} value={draftState.senderDisplayName} />
                </FormField>
                <FormField
                  className="office-form-grid-span-2"
                  helper="邀请邮件的回复会发送到此地址；最终签署完成的 PDF 通知也会同时抄送给此地址和所有签署参与人。"
                  label="回复邮箱"
                >
                  <TextInput onChange={(event) => updateDraftField("senderReplyTo", event.target.value)} type="email" value={draftState.senderReplyTo} />
                </FormField>
                <FormField className="office-form-grid-span-4" label="邮件正文">
                  <TextareaInput onChange={(event) => updateDraftField("emailBody", event.target.value)} rows={5} value={draftState.emailBody} />
                </FormField>
              </div>

              <div className="office-signature-section-actions">
                <Button
                  disabled={pendingAction === "save-recipients"}
                  onClick={() =>
                    persistSignatureRequest({
                      action: "save-recipients",
                      requireFields: false,
                      continueToFieldStep: true,
                      successMessage: translateSignatureEditorCopy("Recipients saved. Continue to PDF field placement.")
                    })
                  }
                >
                  {pendingAction === "save-recipients" ? "保存中..." : "保存收件人并继续"}
                </Button>
              </div>
            </section>

            <section className="office-detail-card office-signature-delivery-card">
              <div className="office-card-head">
                <div>
                  <h3>模板库</h3>
                  <span>把已保存模板应用到此文档，或把当前收件人和字段映射保存为可复用模板。</span>
                </div>
              </div>

              <div className="office-document-upload-grid">
                <FormField label="应用模板">
                  <SelectInput onChange={(event) => handleTemplateSelection(event.target.value)} value={initialTemplate?.id ?? ""}>
                    <option value="">不使用模板</option>
                    {availableTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · {translateTemplateCategoryLabel(template.categoryLabel)}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="模板名称">
                  <TextInput
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                    value={templateDraft.name}
                  />
                </FormField>
                <FormField label="模板分类">
                  <SelectInput
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        category: event.target.value as TemplateDraftState["category"]
                      }))
                    }
                    value={templateDraft.category}
                  >
                    <option value="transaction">{templateCategoryLabelMap.transaction}</option>
                    <option value="hr">{templateCategoryLabelMap.hr}</option>
                    <option value="finance">{templateCategoryLabelMap.finance}</option>
                    <option value="admin">{templateCategoryLabelMap.admin}</option>
                    <option value="project_sales">{templateCategoryLabelMap.project_sales}</option>
                  </SelectInput>
                </FormField>
                <FormField className="office-form-grid-span-4" label="模板说明">
                  <TextareaInput
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    value={templateDraft.description}
                  />
                </FormField>
              </div>

              <div className="office-signature-section-actions">
                <Button disabled={pendingAction === "save-template"} onClick={handleSaveTemplate} variant="secondary">
                  {pendingAction === "save-template" ? "保存模板中..." : templateDraft.templateId ? "更新模板" : "保存为模板"}
                </Button>
              </div>
            </section>
          </>
        ) : (
          <section className="office-detail-card office-signature-template-card">
            <div className="office-card-head">
              <div>
                <h3>第 2 步 · PDF 字段放置</h3>
                <span>选择字段类型，放到 PDF 上，再分配给需要填写的签署人或审批人。</span>
              </div>
              <StatusBadge tone={getRequestTone(requestStatus)}>{getSignatureStatusLabel(requestStatus)}</StatusBadge>
            </div>

            <div className="office-signature-step-banner">
              <p>
                每个签名位置都必须绑定到具体签署人。其他收件人无法在分配给别人的字段中签署或填写。
              </p>
              <Button onClick={() => openStep("recipients")} variant="secondary">
                返回第 1 步
              </Button>
            </div>

            <div className="office-signature-toolbar">
              {placementFieldTools.map((fieldType) => (
                <button
                  className={`office-toggle-link${selectedTool === fieldType ? " is-active" : ""}`}
                  key={fieldType}
                  onClick={() => setSelectedTool(fieldType)}
                  type="button"
                >
                  {getFieldTypeLabel(fieldType)}
                </button>
              ))}
            </div>

            {isLoading ? <p className="office-signature-helper">正在加载 PDF 预览...</p> : null}
            {previewError ? <p className="office-form-error">{translateSignatureEditorCopy(previewError)}</p> : null}

            <div className="office-signature-preview-stack">
              {pages.map((page) => (
                <div className="office-signature-preview-page" key={page.pageNumber}>
                  <div className="office-signature-preview-label">第 {page.pageNumber} 页</div>
                  <div
                    className="office-signature-preview-canvas"
                    onClick={(event) => handleAddField(page.pageNumber, event)}
                    ref={(node) => setPreviewCanvasRef(page.pageNumber, node)}
                  >
                    <img alt={`文档第 ${page.pageNumber} 页`} height={page.height} src={page.imageUrl} width={page.width} />
                    {fields
                      .filter((field) => field.page === page.pageNumber)
                      .map((field) => {
                        const assignedRecipient = field.assignedRecipientId ? recipientLookup.get(field.assignedRecipientId) ?? null : null;
                        const bindingSummary = getRecipientBindingSummary(assignedRecipient);

                        return (
                          <div
                            className={`office-signature-field-token${selectedFieldId === field.id ? " is-selected" : ""}`}
                            key={field.id}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => handleFieldPointerDown(field.id, page.pageNumber, event)}
                            style={{
                              left: `${field.x * 100}%`,
                              top: `${field.y * 100}%`,
                              width: `${field.width * 100}%`,
                              height: `${field.height * 100}%`
                            }}
                            title={`${bindingSummary.badge} · ${bindingSummary.detail}`}
                          >
                            <span className={`office-signature-field-assignee${assignedRecipient ? "" : " is-unassigned"}`}>
                              {bindingSummary.badge}
                            </span>
                            <span className="office-signature-field-token-label">{field.label}</span>
                            <span className="office-signature-field-token-detail">{bindingSummary.detail}</span>
                            {selectedFieldId === field.id ? (
                              <button
                                aria-label={`调整 ${field.label} 大小`}
                                className="office-signature-field-resize-handle"
                                onClick={(event) => event.stopPropagation()}
                                onPointerDown={(event) => handleResizePointerDown(field.id, page.pageNumber, event)}
                                type="button"
                              />
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            <div className="office-signature-section-actions">
              <Button disabled={pendingAction === "save-fields"} onClick={() => saveDraft(false)}>
                {pendingAction === "save-fields" ? "保存中..." : "保存字段布局"}
              </Button>
              <Button disabled={pendingAction === "send"} onClick={() => saveDraft(true)}>
                {pendingAction === "send" ? "发送中..." : requestStatus === "sent" || requestStatus === "viewed" ? "保存并重新发送" : "保存并发送"}
              </Button>
              {requestId ? (
                <>
                  <Button disabled={pendingAction === "resend"} onClick={() => handleRequestAction("resend")} variant="secondary">
                    {pendingAction === "resend" ? "重新发送中..." : "重新发送"}
                  </Button>
                  <Button disabled={pendingAction === "canceled"} onClick={() => handleRequestAction("canceled")} variant="danger">
                    {pendingAction === "canceled" ? "取消中..." : "取消"}
                  </Button>
                </>
              ) : null}
            </div>
          </section>
        )}
      </div>

      <aside className="office-signature-editor-side">
        {isFieldsStep ? (
          <section className="office-detail-card">
            <div className="office-card-head">
              <div>
                <h3>已选字段</h3>
                <span>把此字段绑定到一位签署人，再调整标签、默认值和校验设置。</span>
              </div>
            </div>

            {selectedField ? (
              <div className="office-signature-field-panel">
                <div className="office-signature-field-grid">
                  <FormField className="office-signature-field-panel-span-2" label="分配给">
                    <SelectInput
                      onChange={(event) => updateField(selectedField.id, { assignedRecipientId: event.target.value || null })}
                      value={selectedField.assignedRecipientId ?? ""}
                    >
                      <option value="">未分配</option>
                      {draftState.recipients.map((recipient) => (
                        <option key={recipient.id} value={recipient.id}>
                          {getRecipientRoleKeyLabel(recipient.roleKey)} · 第 {recipient.routingStep || "1"} 步 ·{" "}
                          {recipient.name || recipient.email || translateRecipientRoleValue(recipient.recipientRole)}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>
                  <FormField label="标签">
                    <TextInput onChange={(event) => updateField(selectedField.id, { label: event.target.value })} value={selectedField.label} />
                  </FormField>
                  <FormField label="字体样式">
                    <TextInput onChange={(event) => updateField(selectedField.id, { fontStyle: event.target.value })} value={selectedField.fontStyle} />
                  </FormField>
                  <FormField label="字段键">
                    <TextInput onChange={(event) => updateField(selectedField.id, { fieldKey: event.target.value })} value={selectedField.fieldKey} />
                  </FormField>
                  <FormField className="office-signature-field-panel-span-2" label="默认值">
                    <TextInput onChange={(event) => updateField(selectedField.id, { defaultValue: event.target.value })} value={selectedField.defaultValue} />
                  </FormField>
                  <FormField label="镜像组">
                    <TextInput onChange={(event) => updateField(selectedField.id, { mirrorGroup: event.target.value })} value={selectedField.mirrorGroup} />
                  </FormField>
                </div>

                <div className="office-signature-field-toggle-grid">
                  <CheckboxField className="office-signature-toggle-card" label="必填">
                    <input
                      checked={selectedField.required}
                      onChange={(event) => updateField(selectedField.id, { required: event.target.checked })}
                      type="checkbox"
                    />
                  </CheckboxField>
                  <CheckboxField className="office-signature-toggle-card" label="只读">
                    <input
                      checked={selectedField.isReadOnly}
                      onChange={(event) => updateField(selectedField.id, { isReadOnly: event.target.checked })}
                      type="checkbox"
                    />
                  </CheckboxField>
                  <CheckboxField className="office-signature-toggle-card" label="系统预填">
                    <input
                      checked={selectedField.isSystemPrefilled}
                      onChange={(event) => updateField(selectedField.id, { isSystemPrefilled: event.target.checked })}
                      type="checkbox"
                    />
                  </CheckboxField>
                </div>

                <div className="office-signature-field-note">
                  <p className="office-signature-helper">
                    拖动字段可移动位置；拖动右下角手柄可调整大小。未分配给某位签署人的字段，该签署人无法填写。
                  </p>
                </div>

                <div className="office-signature-section-actions office-signature-field-actions">
                  <Button onClick={() => removeField(selectedField.id)} size="sm" variant="danger">
                    删除字段
                  </Button>
                </div>
              </div>
            ) : (
              <p className="office-signature-helper">请在 PDF 上选择一个字段，以编辑它的收件人绑定和设置。</p>
            )}
          </section>
        ) : (
          <section className="office-detail-card">
            <div className="office-card-head">
              <div>
                <h3>第 2 步预览</h3>
                <span>第 1 步保存后，你会在这里放置签名字段，并把每个字段分配给具体签署人。</span>
              </div>
            </div>
            <p className="office-signature-helper">
              多签署人请求会通过字段绑定保持清晰：每个字段只属于一位签署人，未分配的人会自动被挡在别人的签名位置之外。
            </p>
          </section>
        )}

        <section className="office-detail-card">
          <div className="office-card-head">
            <div>
              <h3>文档</h3>
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
                打开原始 PDF
              </Link>
            </p>
            {initialRequest?.completedDocumentHref ? (
              <p>
                <Link href={initialRequest.completedDocumentHref} target="_blank">
                  下载已签署 PDF
                </Link>
              </p>
            ) : null}
          </div>
        </section>

        <section className="office-detail-card">
          <div className="office-card-head">
            <div>
              <h3>审计记录</h3>
              <span>请求保存后，内部事件和签署人侧事件都会记录在这里。</span>
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
            <p className="office-signature-helper">请求保存后会开始生成审计记录。</p>
          )}
        </section>

        {error ? <p className="office-form-error">{error}</p> : null}
        {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}
      </aside>
    </div>
  );
}
