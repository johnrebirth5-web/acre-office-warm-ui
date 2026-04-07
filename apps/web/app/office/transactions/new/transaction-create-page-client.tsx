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
      submitLabel={
        submitLabel ?? (mode === "modal" ? "Next →" : "Create transaction")
      }
      submitMethod="POST"
      title={
        title ??
        (mode === "modal" ? "Create transaction" : "Office intake form")
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
          title="Transaction intake"
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
                        "I reviewed the Front Office handoff gaps and still want to create the Back Office transaction."}
                    </span>
                  </label>
                ) : null}
                {handoffPrefill?.requiresAcknowledgement &&
                !acknowledgeIncompleteHandoffPrefill ? (
                  <p className="office-form-helper">
                    Review the items below and confirm before submitting. The
                    API will block create until this handoff review is
                    acknowledged.
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
                  Manage field names, visibility, order, dropdown options,
                  custom-field lifecycle, and transaction-required contact roles
                  directly from this create flow.
                </p>
              </div>
              <Button
                aria-label="Close transaction field editor"
                onClick={closeFieldEditor}
                size="sm"
                type="button"
                variant="ghost"
              >
                Close
              </Button>
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
