"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, SectionCard } from "@acre/ui";
import type {
  OfficeFieldModuleSettingsSnapshot,
  OfficeFieldSettingsSnapshot,
  OfficeTransactionCustomFieldDefinitionRecord,
  OfficeTransactionFieldSettingRecord,
  OfficeTransactionIntakeSchema,
  OfficeTransactionOwnerAssignment,
} from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";
import { OfficeSettingsFieldsClient } from "../../settings/fields/fields-client";
import { TransactionIntakeWorkspace } from "../transaction-intake-form";
import type { TransactionStatusFieldPolicy } from "../transaction-status-rules";

type TransactionCreatePageLeadIn = {
  badgeLabel?: string;
  badgeTone?: "neutral" | "accent" | "success" | "warning" | "danger";
  title: string;
  description: string;
  items?: string[];
};

type TransactionCreatePageClientProps = {
  afterSubmit?: "refresh" | "go-detail";
  canManageFields: boolean;
  handoffPrefill?: {
    handoffDraftId: string;
    requiresAcknowledgement: boolean;
    acknowledgementLabel?: string;
  };
  initialSchema: OfficeTransactionIntakeSchema;
  initialFieldModule?: OfficeFieldModuleSettingsSnapshot;
  initialOwnerMembershipId?: string;
  initialValues?: Record<string, string>;
  leadIn?: TransactionCreatePageLeadIn;
  mode?: "page" | "modal";
  modalDescription?: string;
  modalEyebrow?: string;
  modalFooterDescription?: string;
  modalFooterTitle?: string;
  onClose?: () => void;
  onFieldModuleChange?: (
    nextModule: OfficeFieldModuleSettingsSnapshot,
    nextSchema: OfficeTransactionIntakeSchema,
  ) => void;
  onSubmitted?: () => void;
  ownerAssignment: OfficeTransactionOwnerAssignment;
  statusFieldPolicy?: TransactionStatusFieldPolicy;
  submissionExtras?: Record<string, unknown>;
  submitLabel?: string;
  title?: string;
};

export function cloneFieldModuleSnapshot(
  snapshot: OfficeFieldModuleSettingsSnapshot,
): OfficeFieldModuleSettingsSnapshot {
  return {
    ...snapshot,
    builtInFields: snapshot.builtInFields.map((field) => ({
      ...field,
      options: [...field.options],
      selectOptions: field.selectOptions.map((option) => ({ ...option })),
    })),
    customFields: snapshot.customFields.map((field) => ({
      ...field,
      options: [...field.options],
    })),
    requiredContactRoles: snapshot.requiredContactRoles.map((role) => ({
      ...role,
    })),
  };
}

export function buildTransactionSchemaFromModuleSnapshot(
  snapshot: OfficeFieldModuleSettingsSnapshot,
): OfficeTransactionIntakeSchema {
  const builtInFields =
    snapshot.builtInFields as OfficeTransactionFieldSettingRecord[];
  const customFields =
    snapshot.customFields as OfficeTransactionCustomFieldDefinitionRecord[];

  return {
    summary: {
      builtInFieldCount: builtInFields.length,
      visibleBuiltInFieldCount: builtInFields.filter((field) => field.isVisible)
        .length,
      requiredBuiltInFieldCount: builtInFields.filter(
        (field) => field.isRequired,
      ).length,
      customFieldCount: customFields.length,
      visibleCustomFieldCount: customFields.filter((field) => field.isVisible)
        .length,
      requiredCustomFieldCount: customFields.filter((field) => field.isRequired)
        .length,
    },
    builtInFields,
    customFields,
  };
}

function buildFieldModuleSnapshotFromSchema(
  schema: OfficeTransactionIntakeSchema,
  isZh = false,
): OfficeFieldModuleSettingsSnapshot {
  return {
    module: "transaction",
    label: isZh ? "交易字段" : "Transaction fields",
    description: isZh ? "新建流程使用的交易字段。" : "Transaction fields used by the create flow.",
    summary: {
      fieldCount: schema.builtInFields.length + schema.customFields.length,
      customFieldCount: schema.customFields.length,
      visibleFieldCount:
        schema.builtInFields.filter((field) => field.isVisible).length +
        schema.customFields.filter((field) => field.isVisible).length,
      hiddenFieldCount:
        schema.builtInFields.filter((field) => !field.isVisible).length +
        schema.customFields.filter((field) => !field.isVisible).length,
      requiredFieldCount:
        schema.builtInFields.filter((field) => field.isRequired).length +
        schema.customFields.filter((field) => field.isRequired).length,
    },
    builtInFields: schema.builtInFields.map((field) => ({
      ...field,
      options: [...field.options],
      selectOptions: field.selectOptions.map((option) => ({ ...option })),
    })),
    customFields: schema.customFields.map((field) => ({
      ...field,
      options: [...field.options],
    })),
    requiredContactRoles: [],
  };
}

function buildEmbeddedFieldSettingsSnapshot(
  fieldModule: OfficeFieldModuleSettingsSnapshot,
): OfficeFieldSettingsSnapshot {
  return {
    selectedModule: "transaction",
    modules: [
      {
        module: fieldModule.module,
        label: fieldModule.label,
        description: fieldModule.description,
        fieldCount: fieldModule.summary.fieldCount,
        customFieldCount: fieldModule.summary.customFieldCount,
        hiddenFieldCount: fieldModule.summary.hiddenFieldCount,
      },
    ],
    currentModule: fieldModule,
  };
}

export function TransactionCreatePageClient({
  afterSubmit = "go-detail",
  canManageFields,
  handoffPrefill,
  initialFieldModule,
  initialOwnerMembershipId,
  initialSchema,
  initialValues,
  leadIn,
  mode = "page",
  modalDescription,
  modalEyebrow,
  modalFooterDescription,
  modalFooterTitle,
  onClose,
  onFieldModuleChange,
  onSubmitted,
  ownerAssignment,
  statusFieldPolicy,
  submissionExtras,
  submitLabel,
  title,
}: TransactionCreatePageClientProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [fieldModule, setFieldModule] = useState(() =>
    cloneFieldModuleSnapshot(
      initialFieldModule ?? buildFieldModuleSnapshotFromSchema(initialSchema, isZh),
    ),
  );
  const [schema, setSchema] = useState(initialSchema);
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);
  const [acknowledgeIncompleteHandoffPrefill, setAcknowledgeIncompleteHandoffPrefill] =
    useState(() => !handoffPrefill?.requiresAcknowledgement);

  useEffect(() => {
    if (!isFieldEditorOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFieldEditorOpen]);

  useEffect(() => {
    setAcknowledgeIncompleteHandoffPrefill(
      !handoffPrefill?.requiresAcknowledgement,
    );
  }, [handoffPrefill?.handoffDraftId, handoffPrefill?.requiresAcknowledgement]);

  const embeddedFieldSettingsSnapshot = useMemo(
    () => buildEmbeddedFieldSettingsSnapshot(fieldModule),
    [fieldModule],
  );
  const resolvedSubmissionExtras = useMemo(
    () => ({
      ...(submissionExtras ?? {}),
      ...(handoffPrefill
        ? {
            handoffDraftId: handoffPrefill.handoffDraftId,
          }
        : {}),
      ...(handoffPrefill?.requiresAcknowledgement
        ? {
            acknowledgeIncompleteHandoffPrefill:
              acknowledgeIncompleteHandoffPrefill,
          }
        : {}),
    }),
    [
      acknowledgeIncompleteHandoffPrefill,
      handoffPrefill,
      submissionExtras,
    ],
  );

  function openFieldEditor() {
    setIsFieldEditorOpen(true);
  }

  function closeFieldEditor() {
    setIsFieldEditorOpen(false);
  }

  function handleFieldModuleChange(
    nextModule: OfficeFieldModuleSettingsSnapshot,
  ) {
    const clonedSnapshot = cloneFieldModuleSnapshot(nextModule);
    const nextSchema = buildTransactionSchemaFromModuleSnapshot(clonedSnapshot);
    setFieldModule(clonedSnapshot);
    setSchema(nextSchema);
    onFieldModuleChange?.(clonedSnapshot, nextSchema);
  }

  const editFieldsButton = canManageFields ? (
    <Button
      onClick={openFieldEditor}
      size="sm"
      type="button"
      variant="secondary"
    >
      {isZh ? "编辑字段" : "Edit fields"}
    </Button>
  ) : null;

  const workspace = (
    <TransactionIntakeWorkspace
      afterSubmit={afterSubmit}
      canEditValues={true}
      chrome={mode === "modal" ? "modal" : "page"}
      headerActions={mode === "modal" ? editFieldsButton : undefined}
      modalDescription={
        modalDescription ??
        (isZh
          ? "新建一笔 Office 交易，分配负责人，并从一开始记录财务细节。"
          : "Create an Office transaction, assign an owner, and capture finance details from the start.")
      }
      modalEyebrow={modalEyebrow ?? (isZh ? "交易" : "Transaction")}
      modalFooterDescription={
        modalFooterDescription ??
        (isZh
          ? "此记录会使用当前 Office 字段，确保管线、报表和财务保持一致。"
          : "This record uses the current Office fields so pipeline, reports, and finance stay aligned.")
      }
      modalFooterTitle={modalFooterTitle ?? (isZh ? "创建清晰的交易记录" : "Create a clean transaction record")}
      mode="create"
      onClose={onClose}
      onSubmitted={onSubmitted ? () => onSubmitted() : undefined}
      ownerAssignment={ownerAssignment}
      preserveDraftStateOnSchemaChange={true}
      schema={schema}
      statusFieldPolicy={statusFieldPolicy}
      submitEndpoint="/api/office/transactions"
      submitLabel={
        submitLabel ?? (mode === "modal" ? (isZh ? "下一步 →" : "Next") : isZh ? "创建交易" : "Create transaction")
      }
      submitMethod="POST"
      title={
        title ??
        (mode === "modal" ? (isZh ? "创建交易" : "Create transaction") : isZh ? "Office 录入表" : "Office intake form")
      }
      initialOwnerMembershipId={initialOwnerMembershipId}
      initialValues={initialValues}
      submissionExtras={resolvedSubmissionExtras}
    />
  );

  return (
    <>
      {mode === "page" ? (
        <SectionCard
          actions={editFieldsButton}
          className="office-new-transaction-card office-new-transaction-live-card"
          title={isZh ? "交易录入" : "Transaction intake"}
        >
          {leadIn ? (
            <div className="office-transaction-create-lead-in">
              {leadIn.badgeLabel ? (
                <p>
                  <Badge tone={leadIn.badgeTone ?? "accent"}>
                    {leadIn.badgeLabel}
                  </Badge>
                </p>
              ) : null}
              <div>
                <h4>{leadIn.title}</h4>
                <p>{leadIn.description}</p>
                {handoffPrefill?.requiresAcknowledgement ? (
                  <label className="office-transaction-create-confirmation">
                    <input
                      checked={acknowledgeIncompleteHandoffPrefill}
                      onChange={(event) =>
                        setAcknowledgeIncompleteHandoffPrefill(
                          event.target.checked,
                        )
                      }
                      type="checkbox"
                    />
                    <span>
                      {handoffPrefill.acknowledgementLabel ??
                        (isZh
                          ? "我已检查 Front Office 交接缺口，仍要创建 Back Office 交易。"
                          : "I reviewed the Front Office handoff gaps and still want to create the Back Office transaction.")}
                    </span>
                  </label>
                ) : null}
                {handoffPrefill?.requiresAcknowledgement &&
                !acknowledgeIncompleteHandoffPrefill ? (
                  <p className="office-form-helper">
                    {isZh
                      ? "请先检查下方项目并确认后再提交。确认交接审核前，系统会阻止创建。"
                      : "Review the items below and confirm before submitting. The system will block creation until the handoff review is acknowledged."}
                  </p>
                ) : null}
                {leadIn.items?.length ? (
                  <ul>
                    {leadIn.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
          {workspace}
        </SectionCard>
      ) : (
        workspace
      )}

      {isFieldEditorOpen ? (
        <div className="office-modal-overlay" onClick={closeFieldEditor}>
          <section
            aria-label={isZh ? "编辑交易字段" : "Edit transaction fields"}
            aria-modal="true"
            className="office-fields-modal office-transaction-intake-fields-modal office-transaction-intake-fields-modal-expanded"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="office-fields-modal-head office-transaction-search-layout-head">
              <div>
                <h3>{isZh ? "编辑字段" : "Edit fields"}</h3>
                <p>
                  {isZh
                    ? "直接在此新建流程中管理字段名称、可见性、排序、下拉选项、自定义字段生命周期，以及交易必需联系人角色。"
                    : "Manage field names, visibility, order, dropdown options, custom field lifecycle, and required transaction contact roles directly in this create flow."}
                </p>
              </div>
              <Button
                aria-label={isZh ? "关闭交易字段编辑器" : "Close transaction field editor"}
                onClick={closeFieldEditor}
                size="sm"
                type="button"
                variant="ghost"
              >
                {isZh ? "关闭" : "Close"}
              </Button>
            </header>

            <div className="office-transaction-intake-fields-workspace">
              <OfficeSettingsFieldsClient
                canManageFields={canManageFields}
                hideModuleRail={true}
                onModuleSnapshotChange={handleFieldModuleChange}
                panelDescription={isZh ? "这些交易字段会用于新建流程、设置页和 Office 筛选。" : "These transaction fields are used by the create flow, settings page, and Office filters."}
                panelTitle={isZh ? "交易字段" : "Transaction fields"}
                snapshot={embeddedFieldSettingsSnapshot}
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
