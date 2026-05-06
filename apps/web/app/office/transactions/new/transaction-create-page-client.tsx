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
): OfficeFieldModuleSettingsSnapshot {
  return {
    module: "transaction",
    label: "交易字段",
    description: "新建流程使用的交易字段。",
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
  const [fieldModule, setFieldModule] = useState(() =>
    cloneFieldModuleSnapshot(
      initialFieldModule ?? buildFieldModuleSnapshotFromSchema(initialSchema),
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
      编辑字段
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
        "新建一笔 Office 交易，分配负责人，并从一开始记录财务细节。"
      }
      modalEyebrow={modalEyebrow ?? "交易"}
      modalFooterDescription={
        modalFooterDescription ??
        "此记录会使用当前 Office 字段，确保管线、报表和财务保持一致。"
      }
      modalFooterTitle={modalFooterTitle ?? "创建清晰的交易记录"}
      mode="create"
      onClose={onClose}
      onSubmitted={onSubmitted ? () => onSubmitted() : undefined}
      ownerAssignment={ownerAssignment}
      preserveDraftStateOnSchemaChange={true}
      schema={schema}
      statusFieldPolicy={statusFieldPolicy}
      submitEndpoint="/api/office/transactions"
      submitLabel={
        submitLabel ?? (mode === "modal" ? "下一步 →" : "创建交易")
      }
      submitMethod="POST"
      title={
        title ??
        (mode === "modal" ? "创建交易" : "Office 录入表")
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
          title="交易录入"
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
                        "我已检查 Front Office 交接缺口，仍要创建 Back Office 交易。"}
                    </span>
                  </label>
                ) : null}
                {handoffPrefill?.requiresAcknowledgement &&
                !acknowledgeIncompleteHandoffPrefill ? (
                  <p className="office-form-helper">
                    请先检查下方项目并确认后再提交。确认交接审核前，系统会阻止创建。
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
            aria-label="编辑交易字段"
            aria-modal="true"
            className="office-fields-modal office-transaction-intake-fields-modal office-transaction-intake-fields-modal-expanded"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="office-fields-modal-head office-transaction-search-layout-head">
              <div>
                <h3>编辑字段</h3>
                <p>
                  直接在此新建流程中管理字段名称、可见性、排序、下拉选项、自定义字段生命周期，以及交易必需联系人角色。
                </p>
              </div>
              <Button
                aria-label="关闭交易字段编辑器"
                onClick={closeFieldEditor}
                size="sm"
                type="button"
                variant="ghost"
              >
                关闭
              </Button>
            </header>

            <div className="office-transaction-intake-fields-workspace">
              <OfficeSettingsFieldsClient
                canManageFields={canManageFields}
                hideModuleRail={true}
                onModuleSnapshotChange={handleFieldModuleChange}
                panelDescription="这些交易字段会用于新建流程、设置页和 Office 筛选。"
                panelTitle="交易字段"
                snapshot={embeddedFieldSettingsSnapshot}
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
