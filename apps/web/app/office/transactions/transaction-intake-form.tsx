"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import type { OfficeTransactionCustomFieldDefinitionRecord, OfficeTransactionIntakeSchema } from "@acre/db";

type TransactionIntakeWorkspaceProps = {
  mode: "create" | "edit";
  chrome: "modal" | "page" | "detail";
  schema: OfficeTransactionIntakeSchema;
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

type BodyFieldRecord =
  | {
      kind: "built-in";
      field: OfficeTransactionIntakeSchema["builtInFields"][number];
      className: string;
    }
  | {
      kind: "custom";
      field: OfficeTransactionCustomFieldDefinitionRecord;
      className: string;
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

function getFieldValueLabel(field: Pick<OfficeTransactionIntakeSchema["builtInFields"][number] | OfficeTransactionCustomFieldDefinitionRecord, "label" | "isRequired">) {
  return field.isRequired ? `${field.label} *` : field.label;
}

export function TransactionIntakeWorkspace({
  mode,
  chrome,
  schema,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const pristineFieldValues = buildInitialFieldValues(localSchema, initialValues);
  const hasUnsavedChanges = Object.keys(pristineFieldValues).some(
    (fieldName) => (fieldValues[fieldName] ?? "") !== (pristineFieldValues[fieldName] ?? "")
  );

  useEffect(() => {
    setLocalSchema(schema);
    setFieldValues(buildInitialFieldValues(schema, initialValues));
  }, [schema, initialValues]);

  const visibleTopFields = [...localSchema.builtInFields]
    .filter((field) => field.section === "top" && field.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const visibleBodyFields: BodyFieldRecord[] = [
    ...localSchema.builtInFields
      .filter((field) => field.section === "primary" && field.isVisible)
      .map((field) => ({
        kind: "built-in" as const,
        field,
        className: field.className
      })),
    ...localSchema.customFields
      .filter((field) => field.isVisible)
      .map((field) => ({
        kind: "custom" as const,
        field,
        className: ""
      }))
  ].sort((left, right) => left.field.sortOrder - right.field.sortOrder);

  function setFieldValue(fieldName: string, value: string) {
    setFieldValues((current) => ({
      ...current,
      [fieldName]: value
    }));
  }

  function requestClose() {
    if (!onClose || isSubmitting) {
      return;
    }

    if (!hasUnsavedChanges) {
      onClose();
      return;
    }

    if (typeof window !== "undefined" && window.confirm("Discard unsaved transaction changes?")) {
      onClose();
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

  return (
    <div className={`bm-transaction-intake-shell bm-transaction-intake-shell-${chrome}`}>
      {chrome === "modal" ? (
        <header className="bm-transaction-modal-header bm-transaction-modal-header-configurable">
          <div className="bm-transaction-modal-title-block">
            <h3>{title ?? "NEW TRANSACTION"}</h3>
          </div>
          {onClose ? (
            <button aria-label="Close transaction intake" onClick={requestClose} type="button">
              ×
            </button>
          ) : null}
        </header>
      ) : (
        <div className="bm-transaction-intake-toolbar">
          {title ? <strong>{title}</strong> : null}
        </div>
      )}

      <form className="bm-transaction-modal-body bm-transaction-intake-form" onSubmit={handleSubmit}>
        {visibleTopFields.length ? (
          <div className="bm-transaction-modal-top-selects">
            {visibleTopFields.map((field) => (
              <label className="bm-modal-inline-select" key={field.fieldKey}>
                <div className="bm-transaction-field-head">
                  <span>{getFieldValueLabel(field)}:</span>
                </div>
                <select
                  className={fieldValues[field.inputName] ? "" : "is-empty"}
                  disabled={!canEditValues}
                  name={field.inputName}
                  onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                  value={fieldValues[field.inputName] ?? ""}
                >
                  <option value="">select</option>
                  {field.selectOptions
                    .filter((option) => option.isEnabled)
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        {visibleBodyFields.length ? (
          <div className="bm-transaction-modal-grid bm-transaction-modal-grid-primary">
            {visibleBodyFields.map((entry) => {
              const key = `${entry.kind}:${entry.field.fieldKey}`;
              const className = `bm-transaction-modal-field ${entry.className}`.trim();

              if (entry.kind === "built-in") {
                const field = entry.field;

                return (
                  <label className={className} key={key}>
                    <div className="bm-transaction-field-head">
                      <span>{getFieldValueLabel(field)}</span>
                    </div>
                    {field.control === "textarea" ? (
                      <textarea
                        disabled={!canEditValues}
                        name={field.inputName}
                        onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                        rows={4}
                        value={fieldValues[field.inputName] ?? ""}
                      />
                    ) : (
                      <input
                        disabled={!canEditValues}
                        name={field.inputName}
                        onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                        type={field.control === "date" ? "date" : "text"}
                        value={fieldValues[field.inputName] ?? ""}
                      />
                    )}
                  </label>
                );
              }

              const field = entry.field;
              return (
                <label className={className} key={key}>
                  <div className="bm-transaction-field-head">
                    <span>{getFieldValueLabel(field)}</span>
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
              );
            })}
          </div>
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
    </div>
  );
}
