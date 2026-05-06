"use client";

import type { ProjectSigningTemplateFieldEditorSnapshot } from "@acre/db";
import { Button, CheckboxField, FormField, SectionCard, SelectInput, TextInput } from "@acre/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { usePdfPreview } from "../../../components/signature/use-pdf-preview";
import { useI18n } from "../../../lib/i18n/client";

type TemplateSnapshot = ProjectSigningTemplateFieldEditorSnapshot["template"];
type TemplateField = TemplateSnapshot["fields"][number];
type TemplateRecipient = TemplateSnapshot["recipients"][number];
type FieldType = TemplateField["fieldType"];

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

const fieldDefaults: Record<FieldType, { label: string; width: number; height: number; fontStyle?: string }> = {
  signature: { label: "Signature", width: 0.26, height: 0.08, fontStyle: "signature" },
  initials: { label: "Initials", width: 0.16, height: 0.05 },
  date: { label: "Date", width: 0.18, height: 0.05 },
  name: { label: "Full Name", width: 0.24, height: 0.05 },
  text: { label: "Text", width: 0.24, height: 0.06 },
  email: { label: "Email", width: 0.26, height: 0.05 },
  title: { label: "Title", width: 0.22, height: 0.05 },
  company: { label: "Company", width: 0.28, height: 0.05 },
  checkbox: { label: "Checkbox", width: 0.06, height: 0.04 },
  dropdown: { label: "Dropdown", width: 0.24, height: 0.05 },
};

const placementFieldTools: FieldType[] = [
  "signature",
  "initials",
  "date",
  "name",
  "text",
  "email",
  "title",
  "company",
  "checkbox",
  "dropdown",
];

const fieldTypeLabelsZh: Record<FieldType, string> = {
  signature: "签名",
  initials: "姓名缩写",
  date: "日期",
  name: "全名",
  text: "文本",
  email: "邮箱",
  title: "职务",
  company: "公司",
  checkbox: "复选框",
  dropdown: "下拉框",
};

const fieldLabelZh: Record<string, string> = {
  Checkbox: "复选框",
  Company: "公司",
  Date: "日期",
  Dropdown: "下拉框",
  Email: "邮箱",
  "Full Name": "全名",
  Initials: "姓名缩写",
  Signature: "签名",
  Text: "文本",
  Title: "职务",
};

const minimumFieldWidth = 0.08;
const minimumFieldHeight = 0.04;
const fieldPadding = 0.02;
const fieldBoundary = 0.98;

function clampFieldMetric(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getFieldTypeLabel(fieldType: FieldType, isZh: boolean) {
  if (isZh) {
    return fieldTypeLabelsZh[fieldType];
  }

  return fieldDefaults[fieldType].label;
}

function getFieldDisplayLabel(label: string, isZh: boolean) {
  if (!isZh) {
    return label;
  }

  return fieldLabelZh[label] ?? label;
}

function getRecipientLabel(recipient: TemplateRecipient | null, isZh: boolean) {
  if (!recipient) {
    return {
      badge: isZh ? "未分配" : "Unassigned",
      detail: isZh ? "选择收件人" : "Choose recipient",
    };
  }

  return {
    badge: `${recipient.roleKey === "approver" ? (isZh ? "审批人" : "Approver") : isZh ? "签署人" : "Signer"} · ${isZh ? "步骤" : "Step"} ${recipient.routingStep}`,
    detail: recipient.recipientRole,
  };
}

function formatFileSize(bytes: number) {
  if (!bytes) {
    return "PDF";
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function ProjectSigningTemplateFieldEditor(props: {
  template: TemplateSnapshot;
  pdfUrl: string;
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const { pages, isLoading, error: previewError } = usePdfPreview(props.pdfUrl);
  const actionableRecipients = useMemo(
    () => props.template.recipients.filter((recipient) => recipient.roleKey !== "cc"),
    [props.template.recipients],
  );
  const recipientLookup = useMemo(
    () => new Map(props.template.recipients.map((recipient) => [recipient.id, recipient])),
    [props.template.recipients],
  );
  const [fields, setFields] = useState<TemplateField[]>(props.template.fields);
  const [selectedTool, setSelectedTool] = useState<FieldType>("signature");
  const [selectedFieldId, setSelectedFieldId] = useState(props.template.fields[0]?.id ?? "");
  const [activeGesture, setActiveGesture] = useState<FieldGestureState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const previewCanvasRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const fieldsRef = useRef(fields);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId],
  );

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

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
          y: clampFieldMetric(relativeY - gesture.pointerOffsetY, fieldPadding, fieldBoundary - field.height),
        });
        return;
      }

      updateField(gesture.fieldId, {
        width: clampFieldMetric(
          gesture.startWidth + (relativeX - gesture.startPointerX),
          minimumFieldWidth,
          fieldBoundary - field.x,
        ),
        height: clampFieldMetric(
          gesture.startHeight + (relativeY - gesture.startPointerY),
          minimumFieldHeight,
          fieldBoundary - field.y,
        ),
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

  function updateField(fieldId: string, changes: Partial<TemplateField>) {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...changes,
            }
          : field,
      ),
    );
    setSuccessMessage("");
  }

  function setPreviewCanvasRef(pageNumber: number, node: HTMLDivElement | null) {
    previewCanvasRefs.current[pageNumber] = node;
  }

  function handleAddField(pageNumber: number, event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest(".office-signature-field-token")) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const defaults = fieldDefaults[selectedTool];
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const nextField: TemplateField = {
      id,
      assignedTemplateRecipientId: actionableRecipients[0]?.id ?? props.template.recipients[0]?.id ?? "",
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
      sortOrder: fields.length,
    };

    setFields((current) => [...current, nextField]);
    setSelectedFieldId(id);
    setError("");
    setSuccessMessage("");
  }

  function handleFieldPointerDown(fieldId: string, pageNumber: number, event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    setSelectedFieldId(fieldId);
    const previewCanvas = previewCanvasRefs.current[pageNumber];
    const field = fieldsRef.current.find((entry) => entry.id === fieldId);

    if (!previewCanvas || !field) {
      return;
    }

    const bounds = previewCanvas.getBoundingClientRect();

    setActiveGesture({
      mode: "move",
      fieldId,
      pageNumber,
      pointerOffsetX: (event.clientX - bounds.left) / bounds.width - field.x,
      pointerOffsetY: (event.clientY - bounds.top) / bounds.height - field.y,
    });
  }

  function handleResizePointerDown(fieldId: string, pageNumber: number, event: ReactPointerEvent<HTMLButtonElement>) {
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
      startHeight: field.height,
    });
  }

  function removeField(fieldId: string) {
    setFields((current) => current.filter((field) => field.id !== fieldId));
    setSelectedFieldId((current) => (current === fieldId ? "" : current));
    setSuccessMessage("");
  }

  async function saveFields() {
    setPending(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/agent/projects/templates/${encodeURIComponent(props.template.id)}/fields`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: fields.map((field, index) => ({
            assignedTemplateRecipientId: field.assignedTemplateRecipientId || null,
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
            sortOrder: index,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            template?: TemplateSnapshot;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.template) {
        throw new Error(payload?.error ?? (isZh ? "无法保存模板字段。" : "Template fields could not be saved."));
      }

      setFields(payload.template.fields);
      setSelectedFieldId(payload.template.fields[0]?.id ?? "");
      setSuccessMessage(isZh ? "模板字段已保存。" : "Template fields saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : isZh ? "无法保存模板字段。" : "Template fields could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="front-office-field-editor">
      <div className="front-office-field-editor-main">
        <SectionCard
          className="office-list-card front-office-field-editor-card"
          subtitle={`${props.template.pdfFileName || (isZh ? "源 PDF" : "Source PDF")} · ${formatFileSize(props.template.pdfByteSize)}`}
          title={isZh ? "PDF 字段放置" : "PDF field placement"}
        >
          <div className="front-office-field-editor-toolbar">
            {placementFieldTools.map((fieldType) => (
              <button
                className={`office-toggle-link${selectedTool === fieldType ? " is-active" : ""}`}
                key={fieldType}
                onClick={() => setSelectedTool(fieldType)}
                type="button"
              >
                {getFieldTypeLabel(fieldType, isZh)}
              </button>
            ))}
          </div>

          {isLoading ? <p className="office-signature-helper">{isZh ? "正在加载 PDF 预览..." : "Loading PDF preview..."}</p> : null}
          {previewError ? <p className="office-form-error">{previewError}</p> : null}

          <div className="office-signature-preview-stack front-office-field-preview-stack">
            {pages.map((page) => (
              <div className="office-signature-preview-page" key={page.pageNumber}>
                <div className="office-signature-preview-label">{isZh ? "第" : "Page "}{page.pageNumber}{isZh ? " 页" : ""}</div>
                <div
                  className="office-signature-preview-canvas"
                  onClick={(event) => handleAddField(page.pageNumber, event)}
                  ref={(node) => setPreviewCanvasRef(page.pageNumber, node)}
                >
                  <img alt={`Template page ${page.pageNumber}`} height={page.height} src={page.imageUrl} width={page.width} />
                  {fields
                    .filter((field) => field.page === page.pageNumber)
                    .map((field) => {
                      const assignedRecipient = field.assignedTemplateRecipientId
                        ? recipientLookup.get(field.assignedTemplateRecipientId) ?? null
                        : null;
                      const bindingSummary = getRecipientLabel(assignedRecipient, isZh);
                      const fieldDisplayLabel = getFieldDisplayLabel(field.label, isZh);

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
                            height: `${field.height * 100}%`,
                          }}
                          title={`${bindingSummary.badge} · ${bindingSummary.detail}`}
                        >
                          <span className={`office-signature-field-assignee${assignedRecipient ? "" : " is-unassigned"}`}>
                            {bindingSummary.badge}
                          </span>
                          <span className="office-signature-field-token-label">{fieldDisplayLabel}</span>
                          <span className="office-signature-field-token-detail">{bindingSummary.detail}</span>
                          {selectedFieldId === field.id ? (
                            <button
                              aria-label={isZh ? `调整${fieldDisplayLabel}大小` : `Resize ${field.label}`}
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
        </SectionCard>
      </div>

      <aside className="front-office-field-editor-side">
        <SectionCard
          className="office-list-card front-office-field-editor-panel"
          subtitle={isZh ? `此模板上有 ${fields.length} 个字段` : `${fields.length} fields on this template`}
          title={props.template.name}
        >
          <div className="front-office-template-fields-actions">
            <Button disabled={pending} onClick={saveFields} type="button">
              {pending ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存字段" : "Save fields"}
            </Button>
            <Link href="/agent/projects">
              <Button type="button" variant="secondary">
                {isZh ? "返回" : "Back"}
              </Button>
            </Link>
          </div>

          {error ? <p className="office-form-error">{error}</p> : null}
          {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}

          {selectedField ? (
            <div className="office-signature-field-panel">
              <div className="office-signature-field-grid">
                <FormField className="office-signature-field-panel-span-2" label={isZh ? "分配收件人" : "Assigned recipient"}>
                  <SelectInput
                    onChange={(event) =>
                      updateField(selectedField.id, {
                        assignedTemplateRecipientId: event.currentTarget.value,
                      })
                    }
                    value={selectedField.assignedTemplateRecipientId}
                  >
                    {actionableRecipients.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>
                        {recipient.roleKey === "approver" ? (isZh ? "审批人" : "Approver") : isZh ? "签署人" : "Signer"} · {isZh ? "步骤" : "Step"} {recipient.routingStep} · {recipient.recipientRole}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label={isZh ? "标签" : "Label"}>
                  <TextInput onChange={(event) => updateField(selectedField.id, { label: event.target.value })} value={selectedField.label} />
                </FormField>
                <FormField label={isZh ? "字段键" : "Field key"}>
                  <TextInput onChange={(event) => updateField(selectedField.id, { fieldKey: event.target.value })} value={selectedField.fieldKey} />
                </FormField>
                <FormField className="office-signature-field-panel-span-2" label={isZh ? "默认值" : "Default value"}>
                  <TextInput
                    onChange={(event) => updateField(selectedField.id, { defaultValue: event.target.value })}
                    value={selectedField.defaultValue}
                  />
                </FormField>
              </div>

              <div className="office-signature-field-toggle-grid">
                <CheckboxField className="office-signature-toggle-card" label={isZh ? "必填" : "Required"}>
                  <input
                    checked={selectedField.required}
                    onChange={(event) => updateField(selectedField.id, { required: event.target.checked })}
                    type="checkbox"
                  />
                </CheckboxField>
                <CheckboxField className="office-signature-toggle-card" label={isZh ? "只读" : "Read-only"}>
                  <input
                    checked={selectedField.isReadOnly}
                    onChange={(event) => updateField(selectedField.id, { isReadOnly: event.target.checked })}
                    type="checkbox"
                  />
                </CheckboxField>
              </div>

              <div className="office-signature-section-actions office-signature-field-actions">
                <Button onClick={() => removeField(selectedField.id)} size="sm" type="button" variant="danger">
                  {isZh ? "删除字段" : "Delete field"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="office-signature-helper">
              {isZh ? "请选择 PDF 上的字段，或用工具栏添加一个字段。" : "Select a field on the PDF, or add one with the toolbar."}
            </p>
          )}
        </SectionCard>
      </aside>
    </div>
  );
}
