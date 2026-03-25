"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  CheckboxField,
  SectionCard,
  SelectInput,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type {
  OfficeFieldModuleSettingsSnapshot,
  OfficeTransactionCustomFieldDefinitionRecord,
  OfficeTransactionFieldSettingRecord,
  OfficeTransactionIntakeSchema,
  OfficeTransactionOwnerAssignment
} from "@acre/db";
import { TransactionIntakeWorkspace } from "../transaction-intake-form";
import {
  isTransactionCreateDirectCustomFieldKey,
  isTransactionCreateRetiredLegacyFieldKey,
  isTransactionCreateStructuredFinanceFieldKey,
  isTransactionCreateSystemManagedFieldKey
} from "../transaction-intake-field-policies";
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

type CreateCustomFieldFormState = {
  isRequired: boolean;
  isVisible: boolean;
  label: string;
  optionsText: string;
  type: "text" | "select" | "date";
};

function buildEmptyCustomFieldFormState(): CreateCustomFieldFormState {
  return {
    isRequired: false,
    isVisible: true,
    label: "",
    optionsText: "",
    type: "text"
  };
}

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

function buildTransactionSchemaFromModuleSnapshot(snapshot: OfficeFieldModuleSettingsSnapshot): OfficeTransactionIntakeSchema {
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
    description: "Transaction intake fields rendered on the create form.",
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

function buildModulePayload(snapshot: OfficeFieldModuleSettingsSnapshot) {
  return {
    module: snapshot.module,
    contactRoleSettings: snapshot.requiredContactRoles.map((role) => ({
      role: role.role,
      isRequired: role.isRequired
    })),
    builtInFieldSettings: snapshot.builtInFields.map((field) => ({
      fieldKey: field.fieldKey,
      isRequired: field.isRequired,
      isVisible: field.isVisible,
      sortOrder: field.sortOrder,
      selectOptions:
        field.control === "select"
          ? field.selectOptions.map((option) => ({
              value: option.value,
              label: option.label,
              isEnabled: option.isEnabled
            }))
          : undefined
    })),
    customFieldDefinitions: snapshot.customFields.map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      type: field.type,
      isRequired: field.isRequired,
      isVisible: field.isVisible,
      isDeletionLocked: field.isDeletionLocked,
      sortOrder: field.sortOrder,
      options: field.options
    }))
  };
}

function parseOptionsText(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((option) => option.trim())
        .filter(Boolean)
    )
  );
}

function mergeDraftVisibilityOntoSnapshot(
  nextSnapshot: OfficeFieldModuleSettingsSnapshot,
  draftSnapshot: OfficeFieldModuleSettingsSnapshot | null
) {
  if (!draftSnapshot) {
    return cloneFieldModuleSnapshot(nextSnapshot);
  }

  const builtInVisibility = new Map(
    draftSnapshot.builtInFields.map((field) => [field.fieldKey, field.isVisible])
  );
  const customVisibility = new Map(
    draftSnapshot.customFields.map((field) => [field.fieldKey, field.isVisible])
  );

  return {
    ...nextSnapshot,
    builtInFields: nextSnapshot.builtInFields.map((field) => ({
      ...field,
      isVisible: builtInVisibility.get(field.fieldKey) ?? field.isVisible
    })),
    customFields: nextSnapshot.customFields.map((field) => ({
      ...field,
      isVisible: customVisibility.get(field.fieldKey) ?? field.isVisible
    }))
  };
}

function getBuiltInFieldHint(field: OfficeFieldModuleSettingsSnapshot["builtInFields"][number]) {
  if (field.section === "top") {
    return "Top-row intake control shown before the property details grid.";
  }

  if (field.control === "date") {
    return "Calendar/date input in the core intake grid.";
  }

  if (field.control === "select") {
    return "Dropdown field shown in the main intake grid.";
  }

  return "Core built-in transaction field shown in the main intake grid.";
}

function getCustomFieldHint(field: OfficeFieldModuleSettingsSnapshot["customFields"][number]) {
  if (field.type === "date") {
    return "Custom date field rendered inside the main intake grid.";
  }

  if (field.type === "select") {
    return "Custom dropdown field rendered inside the main intake grid.";
  }

  return "Custom text field rendered inside the main intake grid.";
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
  const [draftModule, setDraftModule] = useState<OfficeFieldModuleSettingsSnapshot | null>(null);
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [fieldSaveError, setFieldSaveError] = useState("");
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [createFieldError, setCreateFieldError] = useState("");
  const [createFieldForm, setCreateFieldForm] = useState(() => buildEmptyCustomFieldFormState());

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

  const activeDraftModule = draftModule ?? fieldModule;
  const topFields = useMemo(
    () => activeDraftModule.builtInFields.filter((field) => field.section === "top"),
    [activeDraftModule.builtInFields]
  );
  const primaryBuiltInFields = useMemo(
    () => activeDraftModule.builtInFields.filter((field) => field.section === "primary"),
    [activeDraftModule.builtInFields]
  );
  const customFormFields = useMemo(
    () =>
      activeDraftModule.customFields.filter((field) =>
        isTransactionCreateDirectCustomFieldKey(field.fieldKey)
      ),
    [activeDraftModule.customFields]
  );
  const managedFieldCount = useMemo(
    () =>
      fieldModule.customFields.filter(
        (field) =>
          isTransactionCreateStructuredFinanceFieldKey(field.fieldKey) ||
          isTransactionCreateRetiredLegacyFieldKey(field.fieldKey) ||
          isTransactionCreateSystemManagedFieldKey(field.fieldKey)
      ).length,
    [fieldModule.customFields]
  );

  function openFieldEditor() {
    setDraftModule(cloneFieldModuleSnapshot(fieldModule));
    setFieldSaveError("");
    setCreateFieldError("");
    setCreateFieldForm(buildEmptyCustomFieldFormState());
    setIsFieldEditorOpen(true);
  }

  function closeFieldEditor() {
    if (isSavingFields || isCreatingField) {
      return;
    }

    setDraftModule(null);
    setFieldSaveError("");
    setCreateFieldError("");
    setCreateFieldForm(buildEmptyCustomFieldFormState());
    setIsFieldEditorOpen(false);
  }

  function toggleBuiltInVisibility(fieldKey: string) {
    setDraftModule((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        builtInFields: current.builtInFields.map((field) =>
          field.fieldKey === fieldKey && !field.isLockedVisible
            ? { ...field, isVisible: !field.isVisible }
            : field
        )
      };
    });
  }

  function toggleCustomVisibility(fieldKey: string) {
    setDraftModule((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        customFields: current.customFields.map((field) =>
          field.fieldKey === fieldKey ? { ...field, isVisible: !field.isVisible } : field
        )
      };
    });
  }

  async function handleSaveFieldDraft() {
    if (!draftModule) {
      return;
    }

    setIsSavingFields(true);
    setFieldSaveError("");

    try {
      const response = await fetch("/api/office/settings/fields", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildModulePayload(draftModule))
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; snapshot?: OfficeFieldModuleSettingsSnapshot }
        | null;

      if (!response.ok || !body?.snapshot) {
        throw new Error(body?.error ?? "Failed to save transaction intake fields.");
      }

      const nextSnapshot = cloneFieldModuleSnapshot(body.snapshot);
      setFieldModule(nextSnapshot);
      setSchema(buildTransactionSchemaFromModuleSnapshot(nextSnapshot));
      setDraftModule(null);
      setIsFieldEditorOpen(false);
    } catch (error) {
      setFieldSaveError(
        error instanceof Error ? error.message : "Failed to save transaction intake fields."
      );
    } finally {
      setIsSavingFields(false);
    }
  }

  async function handleCreateCustomField() {
    setIsCreatingField(true);
    setCreateFieldError("");

    try {
      const response = await fetch("/api/office/settings/fields/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          module: "transaction",
          label: createFieldForm.label,
          type: createFieldForm.type,
          isRequired: createFieldForm.isRequired,
          isVisible: createFieldForm.isVisible,
          options: createFieldForm.type === "select" ? parseOptionsText(createFieldForm.optionsText) : []
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; snapshot?: OfficeFieldModuleSettingsSnapshot }
        | null;

      if (!response.ok || !body?.snapshot) {
        throw new Error(body?.error ?? "Failed to create custom field.");
      }

      const savedSnapshot = cloneFieldModuleSnapshot(body.snapshot);
      setFieldModule(savedSnapshot);
      setSchema(buildTransactionSchemaFromModuleSnapshot(savedSnapshot));
      setDraftModule((current) => mergeDraftVisibilityOntoSnapshot(savedSnapshot, current));
      setCreateFieldForm(buildEmptyCustomFieldFormState());
    } catch (error) {
      setCreateFieldError(error instanceof Error ? error.message : "Failed to create custom field.");
    } finally {
      setIsCreatingField(false);
    }
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
            aria-label="Edit transaction intake fields"
            aria-modal="true"
            className="office-fields-modal office-transaction-intake-fields-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="office-fields-modal-head office-transaction-search-layout-head">
              <div>
                <h3>Edit intake fields</h3>
                <p>Choose which fields appear directly in this new transaction form, then add new custom fields without leaving the page.</p>
              </div>
              <button
                aria-label="Close transaction field editor"
                className="office-fields-modal-close"
                disabled={isSavingFields || isCreatingField}
                onClick={closeFieldEditor}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="office-fields-modal-body office-transaction-intake-fields-body">
              <section className="office-transaction-search-layout-group">
                <div className="office-transaction-search-layout-group-head">
                  <strong>Top row</strong>
                  <p>These controls appear before the main property details grid.</p>
                </div>
                <div className="office-transaction-search-layout-list">
                  {topFields.map((field) => (
                    <div className="office-fields-modal-checkbox office-transaction-search-layout-checkbox" key={field.fieldKey}>
                      <CheckboxField className="office-transaction-search-layout-checkbox-field" label={field.label}>
                        <input
                          checked={field.isVisible}
                          disabled={isSavingFields || field.isLockedVisible}
                          onChange={() => toggleBuiltInVisibility(field.fieldKey)}
                          type="checkbox"
                        />
                      </CheckboxField>
                      <small>{getBuiltInFieldHint(field)}</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="office-transaction-search-layout-group">
                <div className="office-transaction-search-layout-group-head">
                  <strong>Built-in</strong>
                  <p>Core transaction fields rendered in the main intake grid.</p>
                </div>
                <div className="office-transaction-search-layout-list">
                  {primaryBuiltInFields.map((field) => (
                    <div className="office-fields-modal-checkbox office-transaction-search-layout-checkbox" key={field.fieldKey}>
                      <CheckboxField className="office-transaction-search-layout-checkbox-field" label={field.label}>
                        <input
                          checked={field.isVisible}
                          disabled={isSavingFields || field.isLockedVisible}
                          onChange={() => toggleBuiltInVisibility(field.fieldKey)}
                          type="checkbox"
                        />
                      </CheckboxField>
                      <small>{getBuiltInFieldHint(field)}</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="office-transaction-search-layout-group">
                <div className="office-transaction-search-layout-group-head">
                  <strong>Custom</strong>
                  <p>Custom fields that render directly inside this intake form.</p>
                </div>
                <div className="office-transaction-search-layout-list">
                  {customFormFields.length ? (
                    customFormFields.map((field) => (
                      <div className="office-fields-modal-checkbox office-transaction-search-layout-checkbox" key={field.fieldKey}>
                        <CheckboxField className="office-transaction-search-layout-checkbox-field" label={field.label}>
                          <input
                            checked={field.isVisible}
                            disabled={isSavingFields}
                            onChange={() => toggleCustomVisibility(field.fieldKey)}
                            type="checkbox"
                          />
                        </CheckboxField>
                        <small>{getCustomFieldHint(field)}</small>
                      </div>
                    ))
                  ) : (
                    <div className="office-fields-empty office-transaction-intake-fields-empty">
                      <strong>No direct custom fields yet</strong>
                      <p>Create one below and it can appear in the form immediately.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="office-transaction-intake-fields-note">
                <strong>Advanced and compatibility fields stay centralized</strong>
                <p>
                  Structured finance fields, system-managed fields, and older compatibility bridge fields are still kept in the shared office schema. This inline editor is intentionally limited to the fields that render directly in the current create form.
                </p>
                <p>
                  {managedFieldCount} shared field{managedFieldCount === 1 ? "" : "s"} continue to live only in the full field settings workspace.
                </p>
                <div className="office-transaction-intake-fields-note-actions">
                  <Link
                    className="office-button office-button-secondary office-button-sm"
                    href="/office/settings/fields?module=transaction"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open full settings
                  </Link>
                </div>
              </section>

              <section className="office-transaction-intake-fields-create">
                <div className="office-transaction-search-layout-group-head">
                  <strong>Add custom field</strong>
                  <p>Create a new custom field here and make it available in this intake form right away.</p>
                </div>
                <div className="office-transaction-intake-fields-create-grid">
                  <label className="office-fields-modal-field">
                    <span>Field label</span>
                    <TextInput
                      disabled={isCreatingField || isSavingFields}
                      onChange={(event) =>
                        setCreateFieldForm((current) => ({ ...current, label: event.target.value }))
                      }
                      placeholder="Example: HOA Fee"
                      value={createFieldForm.label}
                    />
                  </label>

                  <label className="office-fields-modal-field">
                    <span>Field type</span>
                    <SelectInput
                      disabled={isCreatingField || isSavingFields}
                      onChange={(event) =>
                        setCreateFieldForm((current) => ({
                          ...current,
                          type: event.target.value as CreateCustomFieldFormState["type"],
                          optionsText: event.target.value === "select" ? current.optionsText : ""
                        }))
                      }
                      value={createFieldForm.type}
                    >
                      <option value="text">Text</option>
                      <option value="select">Dropdown</option>
                      <option value="date">Date</option>
                    </SelectInput>
                  </label>

                  {createFieldForm.type === "select" ? (
                    <label className="office-fields-modal-field is-full">
                      <span>Dropdown options</span>
                      <TextareaInput
                        disabled={isCreatingField || isSavingFields}
                        onChange={(event) =>
                          setCreateFieldForm((current) => ({
                            ...current,
                            optionsText: event.target.value
                          }))
                        }
                        placeholder={"Option 1\nOption 2\nOption 3"}
                        rows={4}
                        value={createFieldForm.optionsText}
                      />
                    </label>
                  ) : null}

                  <div className="office-transaction-intake-fields-create-toggles">
                    <CheckboxField label="Visible in form">
                      <input
                        checked={createFieldForm.isVisible}
                        disabled={isCreatingField || isSavingFields}
                        onChange={(event) =>
                          setCreateFieldForm((current) => ({
                            ...current,
                            isVisible: event.target.checked
                          }))
                        }
                        type="checkbox"
                      />
                    </CheckboxField>
                    <CheckboxField label="Required field">
                      <input
                        checked={createFieldForm.isRequired}
                        disabled={isCreatingField || isSavingFields}
                        onChange={(event) =>
                          setCreateFieldForm((current) => ({
                            ...current,
                            isRequired: event.target.checked
                          }))
                        }
                        type="checkbox"
                      />
                    </CheckboxField>
                  </div>
                </div>
              </section>
            </div>

            <footer className="office-fields-modal-footer office-transaction-search-layout-footer office-transaction-intake-fields-footer">
              <div className="office-transaction-intake-fields-footer-copy">
                {fieldSaveError ? (
                  <p className="bm-inline-error office-transaction-search-layout-error">
                    {fieldSaveError}
                  </p>
                ) : createFieldError ? (
                  <p className="bm-inline-error office-transaction-search-layout-error">
                    {createFieldError}
                  </p>
                ) : (
                  <p>Saving field visibility here updates the shared office transaction intake schema.</p>
                )}
              </div>
              <div className="office-transaction-intake-fields-footer-actions">
                <Button disabled={isCreatingField || isSavingFields} onClick={handleCreateCustomField} type="button" variant="secondary">
                  {isCreatingField ? "Adding..." : "Add field"}
                </Button>
                <Button disabled={isCreatingField || isSavingFields} onClick={closeFieldEditor} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button disabled={isCreatingField || isSavingFields} onClick={handleSaveFieldDraft} type="button">
                  {isSavingFields ? "Saving..." : "Save fields"}
                </Button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
