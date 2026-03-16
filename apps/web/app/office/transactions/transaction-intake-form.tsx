"use client";

import { Button } from "@acre/ui";
import type {
  OfficeTransactionCustomFieldDefinitionRecord,
  OfficeTransactionFieldSettingRecord,
  OfficeTransactionIntakeSchema
} from "@acre/db";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";

type TransactionIntakeWorkspaceProps = {
  mode: "create" | "edit";
  chrome: "modal" | "page" | "detail";
  schema: OfficeTransactionIntakeSchema;
  canConfigureSchema: boolean;
  canEditValues: boolean;
  submitEndpoint: string;
  submitMethod: "POST" | "PATCH";
  submitLabel: string;
  title?: string;
  stepLabel?: string;
  initialValues?: Record<string, string>;
  afterSubmit?: "refresh" | "go-detail";
  onClose?: () => void;
  onSubmitted?: (transactionId: string) => void;
};

type CustomFieldEditorState = {
  mode: "create" | "edit";
  fieldKey: string;
  label: string;
  type: "text" | "select" | "date";
  isRequired: boolean;
  isVisible: boolean;
  optionsText: string;
};

type HiddenFieldRecord = {
  id: string;
  label: string;
  kind: "built-in" | "custom";
};

function buildInitialFieldValues(schema: OfficeTransactionIntakeSchema, initialValues: Record<string, string> | undefined) {
  const nextValues: Record<string, string> = {};

  for (const field of schema.builtInFields) {
    nextValues[field.inputName] = initialValues?.[field.inputName] ?? "";
  }

  for (const field of schema.customFields) {
    nextValues[field.inputName] = initialValues?.[field.inputName] ?? "";
  }

  return nextValues;
}

function getFieldValueLabel(field: Pick<OfficeTransactionFieldSettingRecord | OfficeTransactionCustomFieldDefinitionRecord, "label" | "isRequired">) {
  return field.isRequired ? `${field.label} *` : field.label;
}

function createCustomFieldEditorState(field?: OfficeTransactionCustomFieldDefinitionRecord | null): CustomFieldEditorState {
  return {
    mode: field ? "edit" : "create",
    fieldKey: field?.fieldKey ?? "",
    label: field?.label ?? "",
    type: field?.type ?? "text",
    isRequired: field?.isRequired ?? false,
    isVisible: field?.isVisible ?? true,
    optionsText: field?.options.join("\n") ?? ""
  };
}

function normalizeCustomFieldOptions(optionsText: string) {
  return optionsText
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function renderAdminControls(props: {
  canConfigureSchema: boolean;
  isConfigMode: boolean;
  onToggleRequired: () => void;
  onHide: () => void;
  onEdit?: () => void;
  requiredLabel: string;
  isLockedRequired?: boolean;
  isLockedVisible?: boolean;
}) {
  if (!props.canConfigureSchema || !props.isConfigMode) {
    return null;
  }

  return (
    <div className="bm-transaction-field-controls">
      <button
        className="bm-transaction-field-control"
        disabled={props.isLockedRequired}
        onClick={props.onToggleRequired}
        type="button"
      >
        {props.requiredLabel}
      </button>
      <button
        className="bm-transaction-field-control"
        disabled={props.isLockedVisible}
        onClick={props.onHide}
        type="button"
      >
        Hide
      </button>
      {props.onEdit ? (
        <button className="bm-transaction-field-control" onClick={props.onEdit} type="button">
          Edit
        </button>
      ) : null}
    </div>
  );
}

export function TransactionIntakeWorkspace({
  mode,
  chrome,
  schema,
  canConfigureSchema,
  canEditValues,
  submitEndpoint,
  submitMethod,
  submitLabel,
  title,
  stepLabel,
  initialValues,
  afterSubmit = "refresh",
  onClose,
  onSubmitted
}: TransactionIntakeWorkspaceProps) {
  const router = useRouter();
  const [localSchema, setLocalSchema] = useState(schema);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => buildInitialFieldValues(schema, initialValues));
  const [isConfigMode, setIsConfigMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [schemaError, setSchemaError] = useState("");
  const [editorState, setEditorState] = useState<CustomFieldEditorState | null>(null);
  const [isSavingEditor, setIsSavingEditor] = useState(false);

  useEffect(() => {
    setLocalSchema(schema);
    setFieldValues(buildInitialFieldValues(schema, initialValues));
  }, [schema, initialValues]);

  const visibleTopFields = localSchema.builtInFields.filter((field) => field.section === "top" && field.isVisible);
  const visiblePrimaryFields = localSchema.builtInFields.filter((field) => field.section === "primary" && field.isVisible);
  const visibleCustomFields = localSchema.customFields.filter((field) => field.isVisible);
  const hiddenFields: HiddenFieldRecord[] = [
    ...localSchema.builtInFields
      .filter((field) => !field.isVisible)
      .map((field) => ({ id: field.fieldKey, label: field.label, kind: "built-in" as const })),
    ...localSchema.customFields
      .filter((field) => !field.isVisible)
      .map((field) => ({ id: field.fieldKey, label: field.label, kind: "custom" as const }))
  ];

  async function persistSchema(nextSchema: OfficeTransactionIntakeSchema) {
    setIsSavingSchema(true);
    setSchemaError("");

    try {
      const response = await fetch("/api/office/settings/fields", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contactRoleSettings: [],
          transactionFieldSettings: nextSchema.builtInFields.map((field) => ({
            fieldKey: field.fieldKey,
            isRequired: field.isRequired,
            isVisible: field.isVisible
          })),
          transactionCustomFieldDefinitions: nextSchema.customFields.map((field) => ({
            fieldKey: field.fieldKey,
            label: field.label,
            type: field.type,
            isRequired: field.isRequired,
            isVisible: field.isVisible,
            sortOrder: field.sortOrder,
            options: field.options
          }))
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save form configuration.");
      }

      const body = (await response.json()) as { snapshot?: { transactionIntakeSchema?: OfficeTransactionIntakeSchema } };
      const nextServerSchema = body.snapshot?.transactionIntakeSchema ?? nextSchema;
      setLocalSchema(nextServerSchema);
      setFieldValues((current) => ({
        ...buildInitialFieldValues(nextServerSchema, initialValues),
        ...current
      }));
      startTransition(() => router.refresh());
    } catch (error) {
      setSchemaError(error instanceof Error ? error.message : "Failed to save form configuration.");
    } finally {
      setIsSavingSchema(false);
    }
  }

  function setFieldValue(fieldName: string, value: string) {
    setFieldValues((current) => ({
      ...current,
      [fieldName]: value
    }));
  }

  function updateBuiltInField(fieldKey: OfficeTransactionFieldSettingRecord["fieldKey"], updater: (field: OfficeTransactionFieldSettingRecord) => OfficeTransactionFieldSettingRecord) {
    const nextSchema: OfficeTransactionIntakeSchema = {
      ...localSchema,
      builtInFields: localSchema.builtInFields.map((field) => (field.fieldKey === fieldKey ? updater(field) : field))
    };

    void persistSchema(nextSchema);
  }

  function updateCustomField(fieldKey: string, updater: (field: OfficeTransactionCustomFieldDefinitionRecord) => OfficeTransactionCustomFieldDefinitionRecord) {
    const nextSchema: OfficeTransactionIntakeSchema = {
      ...localSchema,
      customFields: localSchema.customFields.map((field) => (field.fieldKey === fieldKey ? updater(field) : field))
    };

    void persistSchema(nextSchema);
  }

  async function handleSaveCustomFieldEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editorState) {
      return;
    }

    setIsSavingEditor(true);
    setSchemaError("");

    try {
      const response = await fetch(
        editorState.mode === "create"
          ? "/api/office/settings/fields/custom"
          : `/api/office/settings/fields/custom/${editorState.fieldKey}`,
        {
          method: editorState.mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            label: editorState.label,
            type: editorState.type,
            isRequired: editorState.isRequired,
            isVisible: editorState.isVisible,
            options: normalizeCustomFieldOptions(editorState.optionsText)
          })
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save custom field.");
      }

      const body = (await response.json()) as { schema?: OfficeTransactionIntakeSchema };
      const nextSchema = body.schema ?? localSchema;
      setLocalSchema(nextSchema);
      setFieldValues((current) => ({
        ...buildInitialFieldValues(nextSchema, initialValues),
        ...current
      }));
      setEditorState(null);
      startTransition(() => router.refresh());
    } catch (error) {
      setSchemaError(error instanceof Error ? error.message : "Failed to save custom field.");
    } finally {
      setIsSavingEditor(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(submitEndpoint, {
        method: submitMethod,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(fieldValues)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save transaction intake.");
      }

      const body = (await response.json()) as { transaction?: { id?: string } };
      startTransition(() => router.refresh());

      if (afterSubmit === "go-detail" && body.transaction?.id) {
        startTransition(() => {
          router.push(`/office/transactions/${body.transaction?.id}`);
        });
      }

      if (body.transaction?.id) {
        onSubmitted?.(body.transaction.id);
      }

      if (mode === "create") {
        setFieldValues(buildInitialFieldValues(localSchema, {}));
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save transaction intake.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const headerActions = canConfigureSchema ? (
    <div className="bm-transaction-admin-actions">
      <Button
        disabled={isSavingSchema || isSavingEditor}
        onClick={() => setIsConfigMode((current) => !current)}
        size="sm"
        type="button"
        variant={isConfigMode ? "primary" : "secondary"}
      >
        {isConfigMode ? "Done Editing" : "Edit Form"}
      </Button>
      <Button
        disabled={isSavingSchema || isSavingEditor}
        onClick={() => setEditorState(createCustomFieldEditorState())}
        size="sm"
        type="button"
        variant="secondary"
      >
        Add Custom Field
      </Button>
    </div>
  ) : null;

  return (
    <div className={`bm-transaction-intake-shell bm-transaction-intake-shell-${chrome}`}>
      {chrome === "modal" ? (
        <header className="bm-transaction-modal-header bm-transaction-modal-header-configurable">
          <div className="bm-transaction-modal-title-block">
            <h3>{title ?? "NEW TRANSACTION"}</h3>
            {headerActions}
          </div>
          {onClose ? (
            <button aria-label="Close transaction intake" onClick={onClose} type="button">
              ×
            </button>
          ) : null}
        </header>
      ) : (
        <div className="bm-transaction-intake-toolbar">
          {title ? <strong>{title}</strong> : null}
          {headerActions}
        </div>
      )}

      {hiddenFields.length && canConfigureSchema && isConfigMode ? (
        <section className="bm-transaction-hidden-fields">
          <div className="bm-transaction-hidden-fields-head">
            <strong>Hidden fields</strong>
            <span>{hiddenFields.length} field(s) hidden from non-admin users</span>
          </div>
          <div className="bm-transaction-hidden-fields-list">
            {hiddenFields.map((field) => (
              <button
                className="bm-transaction-hidden-field-chip"
                key={field.id}
                onClick={() => {
                  if (field.kind === "built-in") {
                    updateBuiltInField(field.id as OfficeTransactionFieldSettingRecord["fieldKey"], (entry) => ({
                      ...entry,
                      isVisible: true
                    }));
                    return;
                  }

                  updateCustomField(field.id, (entry) => ({
                    ...entry,
                    isVisible: true
                  }));
                }}
                type="button"
              >
                Restore {field.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {schemaError ? <p className="office-inline-error">{schemaError}</p> : null}

      <form className="bm-transaction-modal-body bm-transaction-intake-form" onSubmit={handleSubmit}>
        {visibleTopFields.length ? (
          <div className="bm-transaction-modal-top-selects">
            {visibleTopFields.map((field) => (
              <label className="bm-modal-inline-select" key={field.fieldKey}>
                <div className="bm-transaction-field-head">
                  <span>{getFieldValueLabel(field)}:</span>
                  {renderAdminControls({
                    canConfigureSchema,
                    isConfigMode,
                    onToggleRequired: () =>
                      updateBuiltInField(field.fieldKey, (entry) => ({
                        ...entry,
                        isRequired: !entry.isRequired
                      })),
                    onHide: () =>
                      updateBuiltInField(field.fieldKey, (entry) => ({
                        ...entry,
                        isVisible: false
                      })),
                    requiredLabel: field.isRequired ? "Optional" : "Required",
                    isLockedRequired: field.isLockedRequired,
                    isLockedVisible: field.isLockedVisible
                  })}
                </div>
                <select
                  className={fieldValues[field.inputName] ? "" : "is-empty"}
                  disabled={!canEditValues}
                  name={field.inputName}
                  onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                  value={fieldValues[field.inputName] ?? ""}
                >
                  <option value="">select</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        {visiblePrimaryFields.length ? (
          <div className="bm-transaction-modal-grid bm-transaction-modal-grid-primary">
            {visiblePrimaryFields.map((field) => (
              <label className={`bm-transaction-modal-field ${field.className}`.trim()} key={field.fieldKey}>
                <div className="bm-transaction-field-head">
                  <span>{getFieldValueLabel(field)}</span>
                  {renderAdminControls({
                    canConfigureSchema,
                    isConfigMode,
                    onToggleRequired: () =>
                      updateBuiltInField(field.fieldKey, (entry) => ({
                        ...entry,
                        isRequired: !entry.isRequired
                      })),
                    onHide: () =>
                      updateBuiltInField(field.fieldKey, (entry) => ({
                        ...entry,
                        isVisible: false
                      })),
                    requiredLabel: field.isRequired ? "Optional" : "Required",
                    isLockedRequired: field.isLockedRequired,
                    isLockedVisible: field.isLockedVisible
                  })}
                </div>
                <input
                  disabled={!canEditValues}
                  maxLength={field.control === "text" ? undefined : undefined}
                  name={field.inputName}
                  onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                  type={field.control === "date" ? "date" : "text"}
                  value={fieldValues[field.inputName] ?? ""}
                />
              </label>
            ))}
          </div>
        ) : null}

        {visibleCustomFields.length ? (
          <section className="bm-transaction-modal-additional">
            <div className="bm-transaction-modal-grid bm-transaction-modal-grid-additional">
              {visibleCustomFields.map((field) => (
                <label className="bm-transaction-modal-field" key={field.fieldKey}>
                  <div className="bm-transaction-field-head">
                    <span>{getFieldValueLabel(field)}</span>
                    {renderAdminControls({
                      canConfigureSchema,
                      isConfigMode,
                      onToggleRequired: () =>
                        updateCustomField(field.fieldKey, (entry) => ({
                          ...entry,
                          isRequired: !entry.isRequired
                        })),
                      onHide: () =>
                        updateCustomField(field.fieldKey, (entry) => ({
                          ...entry,
                          isVisible: false
                        })),
                      onEdit: () => setEditorState(createCustomFieldEditorState(field)),
                      requiredLabel: field.isRequired ? "Optional" : "Required"
                    })}
                  </div>
                  {field.type === "select" ? (
                    <select
                      defaultValue=""
                      disabled={!canEditValues}
                      name={field.inputName}
                      onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                      value={fieldValues[field.inputName] ?? ""}
                    >
                      <option value="">Select...</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled={!canEditValues}
                      maxLength={field.type === "text" ? 50 : undefined}
                      name={field.inputName}
                      onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                      type={field.type === "date" ? "date" : "text"}
                      value={fieldValues[field.inputName] ?? ""}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="bm-transaction-modal-footer">
          <span>{stepLabel ?? (chrome === "modal" ? "step 1 of 4" : "Schema-driven transaction intake")}</span>
          <div className="bm-transaction-modal-actions">
            {submitError ? <p className="bm-transaction-submit-error">{submitError}</p> : null}
            <button className="bm-transaction-next" disabled={isSubmitting || !canEditValues} type="submit">
              {isSubmitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </footer>
      </form>

      {editorState ? (
        <div className="bm-transaction-config-overlay">
          <section className="bm-transaction-config-modal">
            <header className="bm-transaction-config-head">
              <div>
                <strong>{editorState.mode === "create" ? "Add custom field" : "Edit custom field"}</strong>
                <span>Only office admins can change field structure.</span>
              </div>
              <button aria-label="Close field editor" onClick={() => setEditorState(null)} type="button">
                ×
              </button>
            </header>

            <form className="bm-transaction-config-form" onSubmit={handleSaveCustomFieldEditor}>
              <label className="office-form-field">
                <span>Field label</span>
                <input
                  onChange={(event) =>
                    setEditorState((current) => (current ? { ...current, label: event.target.value } : current))
                  }
                  value={editorState.label}
                />
              </label>
              <label className="office-form-field">
                <span>Field type</span>
                <select
                  disabled={editorState.mode === "edit" && editorState.fieldKey.startsWith("custom_") === false}
                  onChange={(event) =>
                    setEditorState((current) =>
                      current ? { ...current, type: event.target.value as CustomFieldEditorState["type"] } : current
                    )
                  }
                  value={editorState.type}
                >
                  <option value="text">Text</option>
                  <option value="select">Dropdown</option>
                  <option value="date">Date</option>
                </select>
              </label>
              <label className="office-checkbox-field">
                <input
                  checked={editorState.isRequired}
                  onChange={(event) =>
                    setEditorState((current) => (current ? { ...current, isRequired: event.target.checked } : current))
                  }
                  type="checkbox"
                />
                <span>Required field</span>
              </label>
              <label className="office-checkbox-field">
                <input
                  checked={editorState.isVisible}
                  onChange={(event) =>
                    setEditorState((current) => (current ? { ...current, isVisible: event.target.checked } : current))
                  }
                  type="checkbox"
                />
                <span>Visible to non-admin users</span>
              </label>
              {editorState.type === "select" ? (
                <label className="office-form-field">
                  <span>Options</span>
                  <textarea
                    onChange={(event) =>
                      setEditorState((current) => (current ? { ...current, optionsText: event.target.value } : current))
                    }
                    placeholder={"One option per line"}
                    rows={6}
                    value={editorState.optionsText}
                  />
                </label>
              ) : null}
              {editorState.type === "text" ? <p className="office-form-helper">Text fields are capped at 50 characters.</p> : null}
              <div className="bm-transaction-config-actions">
                <Button onClick={() => setEditorState(null)} type="button" variant="ghost">
                  Cancel
                </Button>
                <Button disabled={isSavingEditor} type="submit" variant="secondary">
                  {isSavingEditor ? "Saving..." : editorState.mode === "create" ? "Create field" : "Save field"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
