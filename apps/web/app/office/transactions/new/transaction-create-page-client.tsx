"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, SectionCard } from "@acre/ui";
import type {
  OfficeFieldModuleSettingsSnapshot,
  OfficeFieldSettingsSnapshot,
  OfficeTransactionCustomFieldDefinitionRecord,
  OfficeTransactionFieldSettingRecord,
  OfficeTransactionIntakeSchema,
  OfficeTransactionOwnerAssignment
} from "@acre/db";
import { OfficeSettingsFieldsClient } from "../../settings/fields/fields-client";
import { TransactionIntakeWorkspace } from "../transaction-intake-form";
import type { TransactionStatusFieldPolicy } from "../transaction-status-rules";

type TransactionCreatePageClientProps = {
  afterSubmit?: "refresh" | "go-detail";
  canManageFields: boolean;
  initialSchema: OfficeTransactionIntakeSchema;
  initialFieldModule?: OfficeFieldModuleSettingsSnapshot;
  mode?: "page" | "modal";
  modalDescription?: string;
  modalEyebrow?: string;
  modalFooterDescription?: string;
  modalFooterTitle?: string;
  onClose?: () => void;
  onSubmitted?: () => void;
  ownerAssignment: OfficeTransactionOwnerAssignment;
  statusFieldPolicy?: TransactionStatusFieldPolicy;
  submitLabel?: string;
  title?: string;
};

function cloneFieldModuleSnapshot(snapshot: OfficeFieldModuleSettingsSnapshot): OfficeFieldModuleSettingsSnapshot {
  return {
    ...snapshot,
    builtInFields: snapshot.builtInFields.map((field) => ({
      ...field,
      options: [...field.options],
      selectOptions: field.selectOptions.map((option) => ({ ...option }))
    })),
    customFields: snapshot.customFields.map((field) => ({
      ...field,
      options: [...field.options]
    })),
    requiredContactRoles: snapshot.requiredContactRoles.map((role) => ({ ...role }))
  };
}

function buildTransactionSchemaFromModuleSnapshot(
  snapshot: OfficeFieldModuleSettingsSnapshot
): OfficeTransactionIntakeSchema {
  const builtInFields = snapshot.builtInFields as OfficeTransactionFieldSettingRecord[];
  const customFields = snapshot.customFields as OfficeTransactionCustomFieldDefinitionRecord[];

  return {
    summary: {
      builtInFieldCount: builtInFields.length,
      visibleBuiltInFieldCount: builtInFields.filter((field) => field.isVisible).length,
      requiredBuiltInFieldCount: builtInFields.filter((field) => field.isRequired).length,
      customFieldCount: customFields.length,
      visibleCustomFieldCount: customFields.filter((field) => field.isVisible).length,
      requiredCustomFieldCount: customFields.filter((field) => field.isRequired).length
    },
    builtInFields,
    customFields
  };
}

function buildFieldModuleSnapshotFromSchema(
  schema: OfficeTransactionIntakeSchema
): OfficeFieldModuleSettingsSnapshot {
  return {
    module: "transaction",
    label: "Transaction fields",
    description: "Transaction field schema shared with the create flow.",
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
        schema.customFields.filter((field) => field.isRequired).length
    },
    builtInFields: schema.builtInFields.map((field) => ({
      ...field,
      options: [...field.options],
      selectOptions: field.selectOptions.map((option) => ({ ...option }))
    })),
    customFields: schema.customFields.map((field) => ({
      ...field,
      options: [...field.options]
    })),
    requiredContactRoles: []
  };
}

function buildEmbeddedFieldSettingsSnapshot(
  fieldModule: OfficeFieldModuleSettingsSnapshot
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
        hiddenFieldCount: fieldModule.summary.hiddenFieldCount
      }
    ],
    currentModule: fieldModule
  };
}

export function TransactionCreatePageClient({
  afterSubmit = "go-detail",
  canManageFields,
  initialFieldModule,
  initialSchema,
  mode = "page",
  modalDescription,
  modalEyebrow,
  modalFooterDescription,
  modalFooterTitle,
  onClose,
  onSubmitted,
  ownerAssignment,
  statusFieldPolicy,
  submitLabel,
  title
}: TransactionCreatePageClientProps) {
  const [fieldModule, setFieldModule] = useState(() =>
    cloneFieldModuleSnapshot(initialFieldModule ?? buildFieldModuleSnapshotFromSchema(initialSchema))
  );
  const [schema, setSchema] = useState(initialSchema);
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);

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

  const embeddedFieldSettingsSnapshot = useMemo(
    () => buildEmbeddedFieldSettingsSnapshot(fieldModule),
    [fieldModule]
  );

  function openFieldEditor() {
    setIsFieldEditorOpen(true);
  }

  function closeFieldEditor() {
    setIsFieldEditorOpen(false);
  }

  function handleFieldModuleChange(nextModule: OfficeFieldModuleSettingsSnapshot) {
    const clonedSnapshot = cloneFieldModuleSnapshot(nextModule);
    setFieldModule(clonedSnapshot);
    setSchema(buildTransactionSchemaFromModuleSnapshot(clonedSnapshot));
  }

  const editFieldsButton = canManageFields ? (
    <Button onClick={openFieldEditor} size="sm" type="button" variant="secondary">
      Edit fields
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
        "Open a new office transaction using the current intake schema, assign the owner, and capture structured finance details from the start."
      }
      modalEyebrow={modalEyebrow ?? "Transactions"}
      modalFooterDescription={
        modalFooterDescription ??
        "The record is created with the active office schema so the pipeline, reporting, and finance views all start from the same structure."
      }
      modalFooterTitle={modalFooterTitle ?? "Create a clean transaction record"}
      mode="create"
      onClose={onClose}
      onSubmitted={onSubmitted ? () => onSubmitted() : undefined}
      ownerAssignment={ownerAssignment}
      preserveDraftStateOnSchemaChange={true}
      schema={schema}
      statusFieldPolicy={statusFieldPolicy}
      submitEndpoint="/api/office/transactions"
      submitLabel={submitLabel ?? (mode === "modal" ? "Next →" : "Create transaction")}
      submitMethod="POST"
      title={title ?? (mode === "modal" ? "Create transaction" : "Office intake form")}
    />
  );

  return (
    <>
      {mode === "page" ? (
        <SectionCard
          actions={editFieldsButton}
          className="bm-new-transaction-card bm-new-transaction-live-card"
          title="Transaction intake"
        >
          {workspace}
        </SectionCard>
      ) : (
        workspace
      )}

      {isFieldEditorOpen ? (
        <div className="bm-modal-overlay" onClick={closeFieldEditor}>
          <section
            aria-label="Edit transaction fields"
            aria-modal="true"
            className="office-fields-modal office-transaction-intake-fields-modal office-transaction-intake-fields-modal-expanded"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="office-fields-modal-head office-transaction-search-layout-head">
              <div>
                <h3>Edit fields</h3>
                <p>
                  Manage field names, visibility, order, dropdown options, custom-field lifecycle,
                  and transaction-required contact roles directly from this create flow.
                </p>
              </div>
              <button
                aria-label="Close transaction field editor"
                className="office-fields-modal-close"
                onClick={closeFieldEditor}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="office-transaction-intake-fields-workspace">
              <OfficeSettingsFieldsClient
                canManageFields={canManageFields}
                hideModuleRail={true}
                onModuleSnapshotChange={handleFieldModuleChange}
                panelDescription="This is the same shared transaction schema used by Create transaction, Settings > Fields, and the office search/filter surfaces."
                panelTitle="Transaction field schema"
                snapshot={embeddedFieldSettingsSnapshot}
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
