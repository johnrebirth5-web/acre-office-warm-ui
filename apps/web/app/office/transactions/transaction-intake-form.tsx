"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@acre/ui";
import type {
  OfficeTransactionCustomFieldDefinitionRecord,
  OfficeTransactionIntakeSchema,
  OfficeTransactionOwnerAssignment
} from "@acre/db";
import {
  buildLegacyFinanceFieldValuesFromDraft,
  buildStructuredFinancePayloadFromDraft,
  createTransactionFinanceCreateDraft,
  TransactionFinanceCreateFields
} from "./transaction-finance-create-fields";
import {
  createModeRetiredLegacyFieldKeys,
  createModeStructuredFinanceFieldKeys,
  editModeRestrictedFinanceFieldKeys
} from "./transaction-intake-field-policies";
import type { TransactionStatusFieldPolicy, TransactionStatusValue } from "./transaction-status-rules";

type TransactionIntakeWorkspaceProps = {
  mode: "create" | "edit";
  chrome: "modal" | "page" | "detail";
  schema: OfficeTransactionIntakeSchema;
  canEditValues: boolean;
  canEditFinanceFields?: boolean;
  submitEndpoint: string;
  submitMethod: "POST" | "PATCH";
  submitLabel: string;
  title?: string;
  stepLabel?: string;
  modalEyebrow?: string;
  modalDescription?: string;
  modalFooterTitle?: string;
  modalFooterDescription?: string;
  initialValues?: Record<string, string>;
  ownerAssignment?: OfficeTransactionOwnerAssignment;
  statusFieldPolicy?: TransactionStatusFieldPolicy;
  afterSubmit?: "refresh" | "go-detail";
  preserveDraftStateOnSchemaChange?: boolean;
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

const maxVisibleOwnerSuggestions = 20;

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

function getTransactionStatusInputName(schema: OfficeTransactionIntakeSchema) {
  return schema.builtInFields.find((field) => field.fieldKey === "transaction_status")?.inputName ?? "";
}

function applyTransactionStatusFieldPolicy(
  schema: OfficeTransactionIntakeSchema,
  fieldValues: Record<string, string>,
  statusFieldPolicy: TransactionStatusFieldPolicy | undefined
) {
  if (!statusFieldPolicy?.enforcedValue) {
    return fieldValues;
  }

  const statusFieldInputName = getTransactionStatusInputName(schema);

  if (!statusFieldInputName) {
    return fieldValues;
  }

  return {
    ...fieldValues,
    [statusFieldInputName]: statusFieldPolicy.enforcedValue
  };
}

function getFieldValueLabel(field: Pick<OfficeTransactionIntakeSchema["builtInFields"][number] | OfficeTransactionCustomFieldDefinitionRecord, "label" | "isRequired">) {
  return field.isRequired ? `${field.label} *` : field.label;
}

function buildOwnerSearchScore(label: string, query: string) {
  const normalizedLabel = label.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  const directIndex = normalizedLabel.indexOf(normalizedQuery);
  if (directIndex >= 0) {
    return directIndex;
  }

  const compactIndex = normalizedLabel.replace(/\s+/g, "").indexOf(normalizedQuery.replace(/\s+/g, ""));
  return compactIndex >= 0 ? compactIndex + 100 : -1;
}

export function TransactionIntakeWorkspace({
  mode,
  chrome,
  schema,
  canEditValues,
  canEditFinanceFields = true,
  submitEndpoint,
  submitMethod,
  submitLabel,
  title,
  stepLabel,
  modalEyebrow,
  modalDescription,
  modalFooterTitle,
  modalFooterDescription,
  initialValues,
  ownerAssignment,
  statusFieldPolicy,
  afterSubmit = "refresh",
  preserveDraftStateOnSchemaChange = false,
  onClose,
  onSubmitted
}: TransactionIntakeWorkspaceProps) {
  const router = useRouter();
  const [localSchema, setLocalSchema] = useState(schema);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    applyTransactionStatusFieldPolicy(schema, buildInitialFieldValues(schema, initialValues), statusFieldPolicy)
  );
  const [ownerSearchValue, setOwnerSearchValue] = useState("");
  const [selectedOwnerMembershipId, setSelectedOwnerMembershipId] = useState("");
  const [ownerSuggestionsOpen, setOwnerSuggestionsOpen] = useState(false);
  const [financeDraft, setFinanceDraft] = useState(() => createTransactionFinanceCreateDraft());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const ownerFieldInputName = useMemo(
    () => localSchema.customFields.find((field) => field.fieldKey === "agentName")?.inputName ?? "",
    [localSchema.customFields]
  );
  const canSearchOwners = mode === "create" && ownerAssignment?.canSelectDifferentOwner;
  const ownerHelperText = canSearchOwners
    ? "Search and select the transaction owner before saving."
    : "This transaction will be assigned to your account.";
  const pristineFinanceDraft = useMemo(() => createTransactionFinanceCreateDraft(), []);
  const pristineFieldValues = useMemo(() => {
    const nextValues = buildInitialFieldValues(localSchema, initialValues);

    if (ownerAssignment && ownerFieldInputName) {
      nextValues[ownerFieldInputName] =
        mode === "create" && ownerAssignment.canSelectDifferentOwner ? "" : ownerAssignment.currentOwnerLabel;
    }

    return applyTransactionStatusFieldPolicy(localSchema, nextValues, statusFieldPolicy);
  }, [initialValues, localSchema, mode, ownerAssignment, ownerFieldInputName, statusFieldPolicy]);
  const hasUnsavedFieldChanges = Object.keys(pristineFieldValues).some(
    (fieldName) => (fieldValues[fieldName] ?? "") !== (pristineFieldValues[fieldName] ?? "")
  );
  const hasUnsavedFinanceChanges = mode === "create" && JSON.stringify(financeDraft) !== JSON.stringify(pristineFinanceDraft);
  const hasUnsavedChanges = hasUnsavedFieldChanges || hasUnsavedFinanceChanges;

  useEffect(() => {
    setLocalSchema(schema);
    const nextOwnerFieldInputName = schema.customFields.find((field) => field.fieldKey === "agentName")?.inputName ?? "";
    setFieldValues((current) => {
      const nextValues = buildInitialFieldValues(schema, initialValues);

      if (preserveDraftStateOnSchemaChange) {
        for (const field of schema.builtInFields) {
          if (field.isVisible && typeof current[field.inputName] === "string") {
            nextValues[field.inputName] = current[field.inputName] ?? "";
          }
        }

        for (const field of schema.customFields) {
          if (field.isVisible && typeof current[field.inputName] === "string") {
            nextValues[field.inputName] = current[field.inputName] ?? "";
          }
        }
      }

      if (ownerAssignment && nextOwnerFieldInputName) {
        nextValues[nextOwnerFieldInputName] =
          preserveDraftStateOnSchemaChange && typeof current[nextOwnerFieldInputName] === "string"
            ? current[nextOwnerFieldInputName] ?? ""
            : mode === "create" && ownerAssignment.canSelectDifferentOwner
              ? ""
              : ownerAssignment.currentOwnerLabel;
      }

      return applyTransactionStatusFieldPolicy(schema, nextValues, statusFieldPolicy);
    });
    setOwnerSearchValue((current) =>
      preserveDraftStateOnSchemaChange
        ? current
        : mode === "create" && ownerAssignment?.canSelectDifferentOwner
          ? ""
          : ownerAssignment?.currentOwnerLabel ?? ""
    );
    setSelectedOwnerMembershipId((current) =>
      preserveDraftStateOnSchemaChange
        ? current
        : mode === "create"
          ? ownerAssignment?.canSelectDifferentOwner
            ? ""
            : ownerAssignment?.currentOwnerMembershipId ?? ""
          : ownerAssignment?.currentOwnerMembershipId ?? ""
    );
    setOwnerSuggestionsOpen(false);
    if (mode === "create" && !preserveDraftStateOnSchemaChange) {
      setFinanceDraft(createTransactionFinanceCreateDraft());
    }
  }, [schema, initialValues, mode, ownerAssignment, preserveDraftStateOnSchemaChange, statusFieldPolicy]);

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
      .filter(
        (field) =>
          !(
            mode === "create" &&
            (createModeStructuredFinanceFieldKeys.has(field.fieldKey) ||
              createModeRetiredLegacyFieldKeys.has(field.fieldKey))
          )
      )
      .filter((field) => !(mode === "edit" && !canEditFinanceFields && editModeRestrictedFinanceFieldKeys.has(field.fieldKey)))
      .map((field) => ({
        kind: "custom" as const,
        field,
        className: ""
      }))
  ].sort((left, right) => left.field.sortOrder - right.field.sortOrder);
  const ownerFieldEntry =
    ownerAssignment
      ? visibleBodyFields.find((entry) => entry.kind === "custom" && entry.field.fieldKey === "agentName") ?? null
      : null;
  const remainingBodyFields = ownerFieldEntry ? visibleBodyFields.filter((entry) => entry !== ownerFieldEntry) : visibleBodyFields;
  const selectedOwnerOption = useMemo(
    () => ownerAssignment?.options.find((option) => option.id === selectedOwnerMembershipId) ?? null,
    [ownerAssignment?.options, selectedOwnerMembershipId]
  );
  const filteredOwnerOptions = useMemo(() => {
    if (!ownerAssignment?.canSelectDifferentOwner) {
      return [];
    }

    const normalizedQuery = ownerSearchValue.trim().toLowerCase();

    return ownerAssignment.options
      .map((option) => ({
        option,
        score: buildOwnerSearchScore(option.label, normalizedQuery)
      }))
      .filter((entry) => !normalizedQuery || entry.score >= 0)
      .sort((left, right) => left.score - right.score || left.option.label.localeCompare(right.option.label))
      .slice(0, maxVisibleOwnerSuggestions)
      .map((entry) => entry.option);
  }, [ownerAssignment, ownerSearchValue]);
  const useOfficeCreateModalChrome =
    chrome === "modal" &&
    Boolean(modalEyebrow || modalDescription || modalFooterTitle || modalFooterDescription);

  function setFieldValue(fieldName: string, value: string) {
    setFieldValues((current) => ({
      ...current,
      [fieldName]: value
    }));
  }

  function handleOwnerSearchChange(value: string) {
    setOwnerSearchValue(value);
    setOwnerSuggestionsOpen(true);
    setSelectedOwnerMembershipId("");

    if (ownerFieldInputName) {
      setFieldValue(ownerFieldInputName, value);
    }
  }

  function handleOwnerSelect(option: OfficeTransactionOwnerAssignment["options"][number]) {
    setOwnerSearchValue(option.label);
    setSelectedOwnerMembershipId(option.id);
    setOwnerSuggestionsOpen(false);

    if (ownerFieldInputName) {
      setFieldValue(ownerFieldInputName, option.label);
    }
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

  function renderBodyField(entry: BodyFieldRecord) {
    const key = `${entry.kind}:${entry.field.fieldKey}`;

    if (entry.kind === "built-in") {
      const field = entry.field;
      const className = `bm-transaction-modal-field ${entry.className}`.trim();

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
    const isAgentOwnerField = field.fieldKey === "agentName" && Boolean(ownerAssignment);
    const className = `bm-transaction-modal-field ${entry.className} ${isAgentOwnerField ? "bm-transaction-modal-field-owner" : ""}`.trim();

    return (
      <label className={className} key={key}>
        <div className="bm-transaction-field-head">
          <span>{getFieldValueLabel(field)}</span>
        </div>
        {isAgentOwnerField ? (
          <div className="bm-transaction-owner-field">
            <input
              autoComplete="off"
              aria-expanded={canSearchOwners ? ownerSuggestionsOpen : undefined}
              aria-haspopup={canSearchOwners ? "listbox" : undefined}
              disabled={!canEditValues || !canSearchOwners}
              name={field.inputName}
              onBlur={() => {
                if (canSearchOwners) {
                  window.setTimeout(() => setOwnerSuggestionsOpen(false), 120);
                }
              }}
              onChange={(event) => handleOwnerSearchChange(event.target.value)}
              onFocus={() => {
                if (canSearchOwners) {
                  setOwnerSuggestionsOpen(true);
                }
              }}
              placeholder={canSearchOwners ? "Search an agent or team lead..." : ownerAssignment?.currentOwnerLabel || "Assigned owner"}
              readOnly={!canSearchOwners}
              type="text"
              value={canSearchOwners ? ownerSearchValue : ownerAssignment?.currentOwnerLabel ?? ""}
            />
            {canSearchOwners && ownerSuggestionsOpen ? (
              <div className="bm-transaction-owner-suggestions" role="listbox">
                {filteredOwnerOptions.length ? (
                  filteredOwnerOptions.map((option) => (
                    <button
                      className={`bm-transaction-owner-suggestion${selectedOwnerMembershipId === option.id ? " is-selected" : ""}`}
                      key={option.id}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleOwnerSelect(option);
                      }}
                      type="button"
                    >
                      <strong>{option.label}</strong>
                      <span>{option.roleLabel}</span>
                    </button>
                  ))
                ) : (
                  <div className="bm-transaction-owner-empty">No matching sales members.</div>
                )}
              </div>
            ) : null}
            <small className="office-form-helper bm-transaction-owner-helper">{ownerHelperText}</small>
          </div>
        ) : field.type === "select" ? (
          <select
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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    if (canSearchOwners && !selectedOwnerMembershipId) {
      setSubmitError("Select an agent owner before creating the transaction.");
      return;
    }
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        ...fieldValues,
        ...(mode === "create" ? buildLegacyFinanceFieldValuesFromDraft(financeDraft) : {}),
        ...(ownerAssignment && ownerFieldInputName
          ? {
              [ownerFieldInputName]:
                canSearchOwners
                  ? selectedOwnerOption?.label ?? ownerSearchValue.trim()
                  : ownerAssignment.currentOwnerLabel
            }
          : {})
      };

      if (mode === "create" && ownerAssignment) {
        payload.ownerMembershipId = canSearchOwners
          ? selectedOwnerMembershipId
          : ownerAssignment.currentOwnerMembershipId;
        payload.grossCommission = financeDraft.grossCommission;
        payload.financeNotes = financeDraft.financeNotes;
        payload.fees = buildStructuredFinancePayloadFromDraft(financeDraft).fees;
      }

      const response = await fetch(submitEndpoint, {
        method: submitMethod,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
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
        const resetValues = buildInitialFieldValues(localSchema, {});

        if (ownerAssignment && ownerFieldInputName) {
          resetValues[ownerFieldInputName] = canSearchOwners ? "" : ownerAssignment.currentOwnerLabel;
        }

        setFieldValues(applyTransactionStatusFieldPolicy(localSchema, resetValues, statusFieldPolicy));
        setOwnerSearchValue(canSearchOwners ? "" : ownerAssignment?.currentOwnerLabel ?? "");
        setSelectedOwnerMembershipId(canSearchOwners ? "" : ownerAssignment?.currentOwnerMembershipId ?? "");
        setOwnerSuggestionsOpen(false);
        setFinanceDraft(createTransactionFinanceCreateDraft());
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
        <header
          className={`bm-transaction-modal-header bm-transaction-modal-header-configurable${useOfficeCreateModalChrome ? " office-create-modal-header" : ""}`}
        >
          <div
            className={`bm-transaction-modal-title-block${useOfficeCreateModalChrome ? " office-create-modal-title-block" : ""}`}
          >
            {useOfficeCreateModalChrome && modalEyebrow ? (
              <span className="office-create-modal-kicker">{modalEyebrow}</span>
            ) : null}
            <h3>{title ?? "NEW TRANSACTION"}</h3>
            {useOfficeCreateModalChrome && modalDescription ? <p>{modalDescription}</p> : null}
          </div>
          {onClose ? (
            useOfficeCreateModalChrome ? (
              <Button aria-label="Close transaction intake" onClick={requestClose} size="sm" type="button" variant="ghost">
                Close
              </Button>
            ) : (
              <button aria-label="Close transaction intake" onClick={requestClose} type="button">
                ×
              </button>
            )
          ) : null}
        </header>
      ) : title ? (
        <div className="bm-transaction-intake-toolbar">
          <strong>{title}</strong>
        </div>
      ) : null}

      <form
        className={`bm-transaction-modal-body bm-transaction-intake-form${useOfficeCreateModalChrome ? " office-create-modal-body office-transaction-create-body" : ""}`}
        onSubmit={handleSubmit}
      >
        {useOfficeCreateModalChrome ? (
          <section className="office-create-modal-section office-transaction-create-section">
            <div className="office-create-modal-section-head">
              <h4>Core transaction details</h4>
              <p>Set the deal type, workflow status, representation, owner, and property basics before saving the record into the pipeline.</p>
            </div>

            {visibleTopFields.length ? (
              <div className="bm-transaction-modal-top-selects">
                {visibleTopFields.map((field) => (
                  <label className="bm-modal-inline-select" key={field.fieldKey}>
                    <div className="bm-transaction-field-head">
                      <span>{getFieldValueLabel(field)}</span>
                    </div>
                    <select
                      className={fieldValues[field.inputName] ? "" : "is-empty"}
                      disabled={!canEditValues || (field.fieldKey === "transaction_status" && statusFieldPolicy ? !statusFieldPolicy.canEdit : false)}
                      name={field.inputName}
                      onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                      value={fieldValues[field.inputName] ?? ""}
                    >
                      <option value="">Select...</option>
                      {field.selectOptions
                        .filter((option) => {
                          if (field.fieldKey === "transaction_status" && statusFieldPolicy) {
                            const isAllowedValue = statusFieldPolicy.allowedValues.includes(option.value as TransactionStatusValue);

                            if (!isAllowedValue) {
                              return false;
                            }

                            return mode === "create" ? true : option.isEnabled || fieldValues[field.inputName] === option.value;
                          }

                          return option.isEnabled;
                        })
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                    {field.fieldKey === "transaction_status" && statusFieldPolicy?.helperText ? (
                      <small className="office-form-helper">{statusFieldPolicy.helperText}</small>
                    ) : null}
                  </label>
                ))}
              </div>
            ) : null}

            {ownerFieldEntry ? (
              <div className="bm-transaction-modal-grid bm-transaction-modal-grid-primary bm-transaction-modal-grid-owner">
                {renderBodyField(ownerFieldEntry)}
              </div>
            ) : null}

            {remainingBodyFields.length ? (
              <div className="bm-transaction-modal-grid bm-transaction-modal-grid-primary">
                {remainingBodyFields.map((entry) => renderBodyField(entry))}
              </div>
            ) : null}
          </section>
        ) : (
          <>
            {visibleTopFields.length ? (
              <div className="bm-transaction-modal-top-selects">
                {visibleTopFields.map((field) => (
                  <label className="bm-modal-inline-select" key={field.fieldKey}>
                    <div className="bm-transaction-field-head">
                      <span>{getFieldValueLabel(field)}:</span>
                    </div>
                    <select
                      className={fieldValues[field.inputName] ? "" : "is-empty"}
                      disabled={!canEditValues || (field.fieldKey === "transaction_status" && statusFieldPolicy ? !statusFieldPolicy.canEdit : false)}
                      name={field.inputName}
                      onChange={(event) => setFieldValue(field.inputName, event.target.value)}
                      value={fieldValues[field.inputName] ?? ""}
                    >
                      <option value="">select</option>
                      {field.selectOptions
                        .filter((option) => {
                          if (field.fieldKey === "transaction_status" && statusFieldPolicy) {
                            const isAllowedValue = statusFieldPolicy.allowedValues.includes(option.value as TransactionStatusValue);

                            if (!isAllowedValue) {
                              return false;
                            }

                            return mode === "create" ? true : option.isEnabled || fieldValues[field.inputName] === option.value;
                          }

                          return option.isEnabled;
                        })
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                    {field.fieldKey === "transaction_status" && statusFieldPolicy?.helperText ? (
                      <small className="office-form-helper">{statusFieldPolicy.helperText}</small>
                    ) : null}
                  </label>
                ))}
              </div>
            ) : null}

            {ownerFieldEntry ? (
              <div className="bm-transaction-modal-grid bm-transaction-modal-grid-primary bm-transaction-modal-grid-owner">
                {renderBodyField(ownerFieldEntry)}
              </div>
            ) : null}

            {remainingBodyFields.length ? (
              <div className="bm-transaction-modal-grid bm-transaction-modal-grid-primary">
                {remainingBodyFields.map((entry) => renderBodyField(entry))}
              </div>
            ) : null}
          </>
        )}

        {mode === "create" ? (
          useOfficeCreateModalChrome ? (
            <section className="office-create-modal-section office-transaction-create-section">
              <div className="office-create-modal-section-head">
                <h4>Finance intake</h4>
                <p>Capture commission and referral details now so the created transaction already has structured finance data attached.</p>
              </div>
              <TransactionFinanceCreateFields draft={financeDraft} onChange={setFinanceDraft} />
            </section>
          ) : (
            <TransactionFinanceCreateFields draft={financeDraft} onChange={setFinanceDraft} />
          )
        ) : null}

        <footer className={`bm-transaction-modal-footer${useOfficeCreateModalChrome ? " office-create-modal-footer" : ""}`}>
          {useOfficeCreateModalChrome ? (
            <div className="office-create-modal-footer-copy">
              <strong>{modalFooterTitle ?? "Review the intake before saving"}</strong>
              <p>{modalFooterDescription ?? "This step creates the transaction using the current office schema and prepares it for the next workflow actions."}</p>
            </div>
          ) : (
            <span>{stepLabel ?? (chrome === "modal" ? "step 1 of 4" : "Schema-driven transaction intake")}</span>
          )}
          <div className="bm-transaction-modal-actions">
            {submitError ? <p className="bm-transaction-submit-error">{submitError}</p> : null}
            {useOfficeCreateModalChrome ? (
              <Button disabled={isSubmitting || !canEditValues} type="submit">
                {isSubmitting ? "Saving..." : submitLabel}
              </Button>
            ) : (
              <button className="bm-transaction-next" disabled={isSubmitting || !canEditValues} type="submit">
                {isSubmitting ? "Saving..." : submitLabel}
              </button>
            )}
          </div>
        </footer>
      </form>
    </div>
  );
}
