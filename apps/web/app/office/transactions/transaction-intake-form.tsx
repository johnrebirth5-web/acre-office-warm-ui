"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@acre/ui";
import type {
  OfficeTransactionCustomFieldDefinitionRecord,
  OfficeTransactionIntakeSchema,
  OfficeTransactionOwnerAssignment,
} from "@acre/db";
import {
  buildStructuredFinancePayloadFromDraft,
  createTransactionFinanceCreateDraft,
  TransactionFinanceCreateFields,
} from "./transaction-finance-create-fields";
import type {
  TransactionStatusFieldPolicy,
  TransactionStatusValue,
} from "./transaction-status-rules";

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
  headerActions?: ReactNode;
  initialOwnerMembershipId?: string;
  initialValues?: Record<string, string>;
  ownerAssignment?: OfficeTransactionOwnerAssignment;
  statusFieldPolicy?: TransactionStatusFieldPolicy;
  submissionExtras?: Record<string, unknown>;
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
const ownerSummaryLabel = "交易负责人";
const ownerSelectionError =
  "创建交易前请选择一位经纪人负责人。";
const transactionIdentityError =
  "保存前请填写交易名称或地址。";

type TransactionIntakeFieldErrors = Record<string, string>;

function normalizeFieldValue(value: string | undefined) {
  return (value ?? "").trim();
}

function buildFieldErrorId(fieldName: string) {
  return `transaction-intake-field-error-${fieldName.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function joinDescribedByIds(...ids: Array<string | false | undefined>) {
  const describedBy = ids.filter(Boolean).join(" ");

  return describedBy || undefined;
}

function buildRequiredFieldsSummary(labels: string[]) {
  return `请填写必填字段：${labels.join("、")}。`;
}

const transactionIntakeErrorMessageMap: Record<string, string> = {
  "Failed to save transaction intake.": "无法保存交易录入。",
  "Select an agent owner before creating the transaction.": ownerSelectionError
};

function translateTransactionIntakeErrorMessage(value: string) {
  const requiredFieldMatch = value.match(/^(.+) is required\.$/);

  if (requiredFieldMatch) {
    return `${requiredFieldMatch[1]}为必填项。`;
  }

  return transactionIntakeErrorMessageMap[value] ?? value;
}

function buildInitialFieldValues(
  schema: OfficeTransactionIntakeSchema,
  initialValues: Record<string, string> | undefined,
) {
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
  return (
    schema.builtInFields.find(
      (field) => field.fieldKey === "transaction_status",
    )?.inputName ?? ""
  );
}

function applyTransactionStatusFieldPolicy(
  schema: OfficeTransactionIntakeSchema,
  fieldValues: Record<string, string>,
  statusFieldPolicy: TransactionStatusFieldPolicy | undefined,
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
    [statusFieldInputName]: statusFieldPolicy.enforcedValue,
  };
}

function getFieldValueLabel(
  field: Pick<
    | OfficeTransactionIntakeSchema["builtInFields"][number]
    | OfficeTransactionCustomFieldDefinitionRecord,
    "label" | "isRequired"
  >,
) {
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

  const compactIndex = normalizedLabel
    .replace(/\s+/g, "")
    .indexOf(normalizedQuery.replace(/\s+/g, ""));
  return compactIndex >= 0 ? compactIndex + 100 : -1;
}

function resolveInitialOwnerOption(
  ownerAssignment: OfficeTransactionOwnerAssignment | undefined,
  mode: "create" | "edit",
  initialOwnerMembershipId: string | undefined,
) {
  if (!ownerAssignment) {
    return null;
  }

  const requestedOwnerMembershipId =
    mode === "create" && ownerAssignment.canSelectDifferentOwner
      ? initialOwnerMembershipId?.trim() || ""
      : ownerAssignment.currentOwnerMembershipId;

  if (!requestedOwnerMembershipId) {
    return null;
  }

  return (
    ownerAssignment.options.find(
      (option) => option.id === requestedOwnerMembershipId,
    ) ?? null
  );
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
  headerActions,
  initialOwnerMembershipId,
  initialValues,
  ownerAssignment,
  statusFieldPolicy,
  submissionExtras,
  afterSubmit = "refresh",
  preserveDraftStateOnSchemaChange = false,
  onClose,
  onSubmitted,
}: TransactionIntakeWorkspaceProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const initialOwnerOption = resolveInitialOwnerOption(
    ownerAssignment,
    mode,
    initialOwnerMembershipId,
  );
  const [localSchema, setLocalSchema] = useState(schema);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    applyTransactionStatusFieldPolicy(
      schema,
      buildInitialFieldValues(schema, initialValues),
      statusFieldPolicy,
    ),
  );
  const [ownerSearchValue, setOwnerSearchValue] = useState(() =>
    mode === "create" && ownerAssignment?.canSelectDifferentOwner
      ? (initialOwnerOption?.label ?? "")
      : (ownerAssignment?.currentOwnerLabel ?? ""),
  );
  const [selectedOwnerMembershipId, setSelectedOwnerMembershipId] = useState(
    () =>
      mode === "create" && ownerAssignment?.canSelectDifferentOwner
        ? (initialOwnerOption?.id ?? "")
        : (ownerAssignment?.currentOwnerMembershipId ?? ""),
  );
  const [ownerSuggestionsOpen, setOwnerSuggestionsOpen] = useState(false);
  const [financeDraft, setFinanceDraft] = useState(() =>
    createTransactionFinanceCreateDraft(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<TransactionIntakeFieldErrors>(
    {},
  );
  const ownerFieldInputName = useMemo(
    () =>
      localSchema.customFields.find((field) => field.fieldKey === "agentName")
        ?.inputName ?? "",
    [localSchema.customFields],
  );
  const canSearchOwners =
    mode === "create" && ownerAssignment?.canSelectDifferentOwner;
  const ownerHelperText = canSearchOwners
    ? "保存前请搜索并选择交易负责人。"
    : "此交易将分配给你的账户。";
  const pristineFinanceDraft = useMemo(
    () => createTransactionFinanceCreateDraft(),
    [],
  );
  const pristineFieldValues = useMemo(() => {
    const nextValues = buildInitialFieldValues(localSchema, initialValues);

    if (ownerAssignment && ownerFieldInputName) {
      nextValues[ownerFieldInputName] =
        mode === "create" && ownerAssignment.canSelectDifferentOwner
          ? (initialOwnerOption?.label ?? "")
          : ownerAssignment.currentOwnerLabel;
    }

    return applyTransactionStatusFieldPolicy(
      localSchema,
      nextValues,
      statusFieldPolicy,
    );
  }, [
    initialOwnerOption?.label,
    initialValues,
    localSchema,
    mode,
    ownerAssignment,
    ownerFieldInputName,
    statusFieldPolicy,
  ]);
  const hasUnsavedFieldChanges = Object.keys(pristineFieldValues).some(
    (fieldName) =>
      (fieldValues[fieldName] ?? "") !== (pristineFieldValues[fieldName] ?? ""),
  );
  const hasUnsavedFinanceChanges =
    mode === "create" &&
    JSON.stringify(financeDraft) !== JSON.stringify(pristineFinanceDraft);
  const hasUnsavedChanges = hasUnsavedFieldChanges || hasUnsavedFinanceChanges;

  useEffect(() => {
    setLocalSchema(schema);
    const nextOwnerFieldInputName =
      schema.customFields.find((field) => field.fieldKey === "agentName")
        ?.inputName ?? "";
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
        const shouldPreserveOwnerDraft =
          preserveDraftStateOnSchemaChange &&
          mode === "create" &&
          ownerAssignment.canSelectDifferentOwner &&
          typeof current[nextOwnerFieldInputName] === "string";

        nextValues[nextOwnerFieldInputName] =
          shouldPreserveOwnerDraft
            ? (current[nextOwnerFieldInputName] ?? "")
            : mode === "create" && ownerAssignment.canSelectDifferentOwner
              ? (initialOwnerOption?.label ?? "")
              : ownerAssignment.currentOwnerLabel;
      }

      return applyTransactionStatusFieldPolicy(
        schema,
        nextValues,
        statusFieldPolicy,
      );
    });
    setOwnerSearchValue((current) =>
      preserveDraftStateOnSchemaChange &&
      mode === "create" &&
      ownerAssignment?.canSelectDifferentOwner
        ? current
        : mode === "create" && ownerAssignment?.canSelectDifferentOwner
          ? (initialOwnerOption?.label ?? "")
          : (ownerAssignment?.currentOwnerLabel ?? ""),
    );
    setSelectedOwnerMembershipId((current) =>
      preserveDraftStateOnSchemaChange &&
      mode === "create" &&
      ownerAssignment?.canSelectDifferentOwner
        ? current
        : mode === "create"
          ? ownerAssignment?.canSelectDifferentOwner
            ? (initialOwnerOption?.id ?? "")
            : (ownerAssignment?.currentOwnerMembershipId ?? "")
          : (ownerAssignment?.currentOwnerMembershipId ?? ""),
    );
    setOwnerSuggestionsOpen(false);
    if (mode === "create" && !preserveDraftStateOnSchemaChange) {
      setFinanceDraft(createTransactionFinanceCreateDraft());
    }
    setFieldErrors({});
    setSubmitError("");
  }, [
    initialOwnerOption?.id,
    initialOwnerOption?.label,
    initialValues,
    mode,
    ownerAssignment,
    preserveDraftStateOnSchemaChange,
    schema,
    statusFieldPolicy,
  ]);

  const visibleTopFields = [...localSchema.builtInFields]
    .filter((field) => field.section === "top" && field.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const visibleBodyFields: BodyFieldRecord[] = [
    ...localSchema.builtInFields
      .filter((field) => field.section === "primary" && field.isVisible)
      .map((field) => ({
        kind: "built-in" as const,
        field,
        className: field.className,
      })),
    ...localSchema.customFields
      .filter((field) => field.isVisible)
      .map((field) => ({
        kind: "custom" as const,
        field,
        className: "",
      })),
  ].sort((left, right) => left.field.sortOrder - right.field.sortOrder);
  const ownerFieldEntry = ownerAssignment
    ? (visibleBodyFields.find(
        (entry) =>
          entry.kind === "custom" && entry.field.fieldKey === "agentName",
      ) ?? null)
    : null;
  const remainingBodyFields = ownerFieldEntry
    ? visibleBodyFields.filter((entry) => entry !== ownerFieldEntry)
    : visibleBodyFields;
  const selectedOwnerOption = useMemo(
    () =>
      ownerAssignment?.options.find(
        (option) => option.id === selectedOwnerMembershipId,
      ) ?? null,
    [ownerAssignment?.options, selectedOwnerMembershipId],
  );
  const filteredOwnerOptions = useMemo(() => {
    if (!ownerAssignment?.canSelectDifferentOwner) {
      return [];
    }

    const normalizedQuery = ownerSearchValue.trim().toLowerCase();

    return ownerAssignment.options
      .map((option) => ({
        option,
        score: buildOwnerSearchScore(option.label, normalizedQuery),
      }))
      .filter((entry) => !normalizedQuery || entry.score >= 0)
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.option.label.localeCompare(right.option.label),
      )
      .slice(0, maxVisibleOwnerSuggestions)
      .map((entry) => entry.option);
  }, [ownerAssignment, ownerSearchValue]);
  const useOfficeCreateModalChrome =
    chrome === "modal" &&
    Boolean(
      modalEyebrow ||
      modalDescription ||
      modalFooterTitle ||
      modalFooterDescription,
    );

  function clearFieldError(fieldName: string) {
    setFieldErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[fieldName];

      return nextErrors;
    });
  }

  function focusFirstInvalidField(fieldName: string) {
    if (!fieldName || typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      const escapedFieldName = fieldName
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
      const fieldElement =
        formRef.current?.querySelector<HTMLElement>(
          `[name="${escapedFieldName}"]`,
        ) ?? null;

      fieldElement?.scrollIntoView({ block: "center", behavior: "smooth" });
      fieldElement?.focus({ preventScroll: true });
    }, 0);
  }

  function validateFieldValues() {
    const nextErrors: TransactionIntakeFieldErrors = {};
    const summaryLabels: string[] = [];
    const invalidFieldNames: string[] = [];
    const visibleFields = [
      ...visibleTopFields,
      ...visibleBodyFields.map((entry) => entry.field),
    ];

    function addFieldError(
      fieldName: string,
      label: string,
      message: string,
    ) {
      if (!nextErrors[fieldName]) {
        nextErrors[fieldName] = message;
        invalidFieldNames.push(fieldName);
      }

      if (!summaryLabels.includes(label)) {
        summaryLabels.push(label);
      }
    }

    for (const field of visibleFields) {
      if (!field.isRequired) {
        continue;
      }

      if (ownerAssignment && field.inputName === ownerFieldInputName) {
        continue;
      }

      if (!normalizeFieldValue(fieldValues[field.inputName])) {
        addFieldError(
          field.inputName,
          field.label,
          translateTransactionIntakeErrorMessage(`${field.label} is required.`),
        );
      }
    }

    const hasAssignedOwner = canSearchOwners
      ? Boolean(selectedOwnerMembershipId)
      : Boolean(ownerAssignment?.currentOwnerMembershipId);

    if (ownerAssignment && ownerFieldInputName && !hasAssignedOwner) {
      addFieldError(
        ownerFieldInputName,
        ownerSummaryLabel,
        ownerSelectionError,
      );
    } else if (ownerAssignment && !hasAssignedOwner) {
      summaryLabels.push(ownerSummaryLabel);
    }

    const transactionNameField =
      visibleFields.find((field) => field.fieldKey === "transaction_name") ??
      null;
    const addressField =
      visibleFields.find((field) => field.fieldKey === "address") ?? null;
    const transactionNameValue = transactionNameField
      ? normalizeFieldValue(fieldValues[transactionNameField.inputName])
      : "";
    const addressValue = addressField
      ? normalizeFieldValue(fieldValues[addressField.inputName])
      : "";

    if (!transactionNameValue && !addressValue) {
      const identityField = transactionNameField ?? addressField;

      if (identityField && !nextErrors[identityField.inputName]) {
        addFieldError(
          identityField.inputName,
          "交易名称或地址",
          transactionIdentityError,
        );
      }
    }

    const isOnlyOwnerError =
      summaryLabels.length === 1 && summaryLabels[0] === ownerSummaryLabel;

    return {
      errors: nextErrors,
      firstInvalidFieldName: invalidFieldNames[0] ?? "",
      summary: summaryLabels.length
        ? isOnlyOwnerError
          ? ownerSelectionError
          : buildRequiredFieldsSummary(summaryLabels)
        : "",
    };
  }

  function setFieldValue(fieldName: string, value: string) {
    setFieldValues((current) => ({
      ...current,
      [fieldName]: value,
    }));
    clearFieldError(fieldName);
    setSubmitError("");
  }

  function handleOwnerSearchChange(value: string) {
    setOwnerSearchValue(value);
    setOwnerSuggestionsOpen(true);
    setSelectedOwnerMembershipId("");

    if (ownerFieldInputName) {
      setFieldValue(ownerFieldInputName, value);
    }
  }

  function handleOwnerSelect(
    option: OfficeTransactionOwnerAssignment["options"][number],
  ) {
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

    if (
      typeof window !== "undefined" &&
      window.confirm("要放弃未保存的交易改动吗？")
    ) {
      onClose();
    }
  }

  function renderBodyField(entry: BodyFieldRecord) {
    const key = `${entry.kind}:${entry.field.fieldKey}`;

    if (entry.kind === "built-in") {
      const field = entry.field;
      const fieldError = fieldErrors[field.inputName] ?? "";
      const fieldErrorId = fieldError
        ? buildFieldErrorId(field.inputName)
        : undefined;
      const className =
        `office-modal-field ${entry.className} ${fieldError ? "is-invalid" : ""}`.trim();

      return (
        <label className={className} key={key}>
          <div className="office-modal-field-head">
            <span>{getFieldValueLabel(field)}</span>
          </div>
          {field.control === "textarea" ? (
            <textarea
              aria-describedby={fieldErrorId}
              aria-invalid={Boolean(fieldError)}
              disabled={!canEditValues}
              name={field.inputName}
              onChange={(event) =>
                setFieldValue(field.inputName, event.target.value)
              }
              rows={4}
              value={fieldValues[field.inputName] ?? ""}
            />
          ) : (
            <input
              aria-describedby={fieldErrorId}
              aria-invalid={Boolean(fieldError)}
              disabled={!canEditValues}
              name={field.inputName}
              onChange={(event) =>
                setFieldValue(field.inputName, event.target.value)
              }
              type={field.control === "date" ? "date" : "text"}
              value={fieldValues[field.inputName] ?? ""}
            />
          )}
          {fieldError ? (
            <small className="office-field-error" id={fieldErrorId}>
              {fieldError}
            </small>
          ) : null}
        </label>
      );
    }

    const field = entry.field;
    const fieldError = fieldErrors[field.inputName] ?? "";
    const fieldErrorId = fieldError
      ? buildFieldErrorId(field.inputName)
      : undefined;
    const isAgentOwnerField =
      field.fieldKey === "agentName" && Boolean(ownerAssignment);
    const className =
      `office-modal-field ${entry.className} ${isAgentOwnerField ? "office-modal-field-owner" : ""} ${fieldError ? "is-invalid" : ""}`.trim();

    return (
      <label className={className} key={key}>
        <div className="office-modal-field-head">
          <span>{getFieldValueLabel(field)}</span>
        </div>
        {isAgentOwnerField ? (
          <div className="office-transaction-owner-field">
            <input
              autoComplete="off"
              aria-describedby={fieldErrorId}
              aria-expanded={canSearchOwners ? ownerSuggestionsOpen : undefined}
              aria-haspopup={canSearchOwners ? "listbox" : undefined}
              aria-invalid={Boolean(fieldError)}
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
              placeholder={
                canSearchOwners
                  ? "搜索经纪人或团队负责人..."
                  : ownerAssignment?.currentOwnerLabel || "已分配负责人"
              }
              readOnly={!canSearchOwners}
              type="text"
              value={
                canSearchOwners
                  ? ownerSearchValue
                  : (ownerAssignment?.currentOwnerLabel ?? "")
              }
            />
            {canSearchOwners && ownerSuggestionsOpen ? (
              <div
                className="office-transaction-owner-suggestions"
                role="listbox"
              >
                {filteredOwnerOptions.length ? (
                  filteredOwnerOptions.map((option) => (
                    <button
                      className={`office-transaction-owner-suggestion${selectedOwnerMembershipId === option.id ? " is-selected" : ""}`}
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
                  <div className="office-transaction-owner-empty">
                    没有匹配的销售成员。
                  </div>
                )}
              </div>
            ) : null}
            <small className="office-form-helper office-transaction-owner-helper">
              {ownerHelperText}
            </small>
          </div>
        ) : field.type === "select" ? (
          <select
            aria-describedby={fieldErrorId}
            aria-invalid={Boolean(fieldError)}
            disabled={!canEditValues}
            name={field.inputName}
            onChange={(event) =>
              setFieldValue(field.inputName, event.target.value)
            }
            value={fieldValues[field.inputName] ?? ""}
          >
            <option value="">请选择...</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-describedby={fieldErrorId}
            aria-invalid={Boolean(fieldError)}
            disabled={!canEditValues}
            maxLength={field.type === "text" ? 50 : undefined}
            name={field.inputName}
            onChange={(event) =>
              setFieldValue(field.inputName, event.target.value)
            }
            type={field.type === "date" ? "date" : "text"}
            value={fieldValues[field.inputName] ?? ""}
          />
        )}
        {fieldError ? (
          <small className="office-field-error" id={fieldErrorId}>
            {fieldError}
          </small>
        ) : null}
      </label>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    const validation = validateFieldValues();

    if (validation.summary) {
      setFieldErrors(validation.errors);
      setSubmitError(validation.summary);
      focusFirstInvalidField(validation.firstInvalidFieldName);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        ...fieldValues,
        ...(submissionExtras ?? {}),
        ...(ownerAssignment && ownerFieldInputName
          ? {
              [ownerFieldInputName]: canSearchOwners
                ? (selectedOwnerOption?.label ?? ownerSearchValue.trim())
                : ownerAssignment.currentOwnerLabel,
            }
          : {}),
      };

      if (mode === "create" && ownerAssignment) {
        const financePayload =
          buildStructuredFinancePayloadFromDraft(financeDraft);
        payload.ownerMembershipId = canSearchOwners
          ? selectedOwnerMembershipId
          : ownerAssignment.currentOwnerMembershipId;
        payload.companyReferral = financePayload.companyReferral;
        payload.companyReferralEmployeeName =
          financePayload.companyReferralEmployeeName;
        payload.grossCommission = financePayload.grossCommission;
        payload.financeNotes = financePayload.financeNotes;
        payload.fees = financePayload.fees;
      }

      const response = await fetch(submitEndpoint, {
        method: submitMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          translateTransactionIntakeErrorMessage(
            body?.error ?? "Failed to save transaction intake.",
          ),
        );
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
          resetValues[ownerFieldInputName] = canSearchOwners
            ? (initialOwnerOption?.label ?? "")
            : ownerAssignment.currentOwnerLabel;
        }

        setFieldValues(
          applyTransactionStatusFieldPolicy(
            localSchema,
            resetValues,
            statusFieldPolicy,
          ),
        );
        setOwnerSearchValue(
          canSearchOwners
            ? (initialOwnerOption?.label ?? "")
            : (ownerAssignment?.currentOwnerLabel ?? ""),
        );
        setSelectedOwnerMembershipId(
          canSearchOwners
            ? (initialOwnerOption?.id ?? "")
            : (ownerAssignment?.currentOwnerMembershipId ?? ""),
        );
        setOwnerSuggestionsOpen(false);
        setFinanceDraft(createTransactionFinanceCreateDraft());
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? translateTransactionIntakeErrorMessage(error.message)
          : translateTransactionIntakeErrorMessage("Failed to save transaction intake."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={`office-transaction-intake-shell office-transaction-intake-shell-${chrome}`}
    >
      {chrome === "modal" ? (
        <header
          className={`office-modal-header office-modal-header-configurable${useOfficeCreateModalChrome ? " office-create-modal-header" : ""}`}
        >
          <div
            className={`office-modal-title-block${useOfficeCreateModalChrome ? " office-create-modal-title-block" : ""}`}
          >
            {useOfficeCreateModalChrome && modalEyebrow ? (
              <span className="office-create-modal-kicker">{modalEyebrow}</span>
            ) : null}
            <h3>{title ?? "新建交易"}</h3>
            {useOfficeCreateModalChrome && modalDescription ? (
              <p>{modalDescription}</p>
            ) : null}
          </div>
          {headerActions || onClose ? (
            <div className="office-modal-header-actions">
              {headerActions}
              {onClose ? (
                useOfficeCreateModalChrome ? (
                  <Button
                    aria-label="关闭交易录入"
                    onClick={requestClose}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    关闭
                  </Button>
                ) : (
                  <button
                    aria-label="关闭交易录入"
                    onClick={requestClose}
                    type="button"
                  >
                    ×
                  </button>
                )
              ) : null}
            </div>
          ) : null}
        </header>
      ) : title ? (
        <div className="office-transaction-intake-toolbar">
          <strong>{title}</strong>
        </div>
      ) : null}

      <form
        className={`office-modal-body office-transaction-intake-form${useOfficeCreateModalChrome ? " office-create-modal-body office-transaction-create-body" : ""}`}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        {useOfficeCreateModalChrome ? (
          <section className="office-create-modal-section office-transaction-create-section">
            <div className="office-create-modal-section-head">
              <h4>交易核心信息</h4>
              <p>
                保存到管线前，请设置交易类型、流程状态、代表方、负责人和房源基础信息。
              </p>
            </div>

            {visibleTopFields.length ? (
              <div className="office-modal-top-selects">
                {visibleTopFields.map((field) => {
                  const fieldError = fieldErrors[field.inputName] ?? "";
                  const fieldErrorId = fieldError
                    ? buildFieldErrorId(field.inputName)
                    : undefined;
                  const helperId =
                    field.fieldKey === "transaction_status" &&
                    statusFieldPolicy?.helperText
                      ? `transaction-intake-${field.inputName}-helper`
                      : undefined;

                  return (
                    <label
                      className={`office-modal-inline-select ${fieldError ? "is-invalid" : ""}`.trim()}
                      key={field.fieldKey}
                    >
                      <div className="office-modal-field-head">
                        <span>{getFieldValueLabel(field)}</span>
                      </div>
                      <select
                        aria-describedby={joinDescribedByIds(
                          fieldErrorId,
                          helperId,
                        )}
                        aria-invalid={Boolean(fieldError)}
                        className={
                          fieldValues[field.inputName] ? "" : "is-empty"
                        }
                        disabled={
                          !canEditValues ||
                          (field.fieldKey === "transaction_status" &&
                          statusFieldPolicy
                            ? !statusFieldPolicy.canEdit
                            : false)
                        }
                        name={field.inputName}
                        onChange={(event) =>
                          setFieldValue(field.inputName, event.target.value)
                        }
                        value={fieldValues[field.inputName] ?? ""}
                      >
                        <option value="">请选择...</option>
                        {field.selectOptions
                          .filter((option) => {
                            if (
                              field.fieldKey === "transaction_status" &&
                              statusFieldPolicy
                            ) {
                              const isAllowedValue =
                                statusFieldPolicy.allowedValues.includes(
                                  option.value as TransactionStatusValue,
                                );

                              if (!isAllowedValue) {
                                return false;
                              }

                              return mode === "create"
                                ? true
                                : option.isEnabled ||
                                    fieldValues[field.inputName] ===
                                      option.value;
                            }

                            return option.isEnabled;
                          })
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                      {fieldError ? (
                        <small className="office-field-error" id={fieldErrorId}>
                          {fieldError}
                        </small>
                      ) : null}
                      {field.fieldKey === "transaction_status" &&
                      statusFieldPolicy?.helperText ? (
                        <small className="office-form-helper" id={helperId}>
                          {statusFieldPolicy.helperText}
                        </small>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : null}

            {ownerFieldEntry ? (
              <div className="office-modal-grid office-modal-grid-primary office-modal-grid-owner">
                {renderBodyField(ownerFieldEntry)}
              </div>
            ) : null}

            {remainingBodyFields.length ? (
              <div className="office-modal-grid office-modal-grid-primary">
                {remainingBodyFields.map((entry) => renderBodyField(entry))}
              </div>
            ) : null}
          </section>
        ) : (
          <>
            {visibleTopFields.length ? (
              <div className="office-modal-top-selects">
                {visibleTopFields.map((field) => {
                  const fieldError = fieldErrors[field.inputName] ?? "";
                  const fieldErrorId = fieldError
                    ? buildFieldErrorId(field.inputName)
                    : undefined;
                  const helperId =
                    field.fieldKey === "transaction_status" &&
                    statusFieldPolicy?.helperText
                      ? `transaction-intake-${field.inputName}-helper`
                      : undefined;

                  return (
                    <label
                      className={`office-modal-inline-select ${fieldError ? "is-invalid" : ""}`.trim()}
                      key={field.fieldKey}
                    >
                      <div className="office-modal-field-head">
                        <span>{getFieldValueLabel(field)}:</span>
                      </div>
                      <select
                        aria-describedby={joinDescribedByIds(
                          fieldErrorId,
                          helperId,
                        )}
                        aria-invalid={Boolean(fieldError)}
                        className={
                          fieldValues[field.inputName] ? "" : "is-empty"
                        }
                        disabled={
                          !canEditValues ||
                          (field.fieldKey === "transaction_status" &&
                          statusFieldPolicy
                            ? !statusFieldPolicy.canEdit
                            : false)
                        }
                        name={field.inputName}
                        onChange={(event) =>
                          setFieldValue(field.inputName, event.target.value)
                        }
                        value={fieldValues[field.inputName] ?? ""}
                      >
                        <option value="">请选择</option>
                        {field.selectOptions
                          .filter((option) => {
                            if (
                              field.fieldKey === "transaction_status" &&
                              statusFieldPolicy
                            ) {
                              const isAllowedValue =
                                statusFieldPolicy.allowedValues.includes(
                                  option.value as TransactionStatusValue,
                                );

                              if (!isAllowedValue) {
                                return false;
                              }

                              return mode === "create"
                                ? true
                                : option.isEnabled ||
                                    fieldValues[field.inputName] ===
                                      option.value;
                            }

                            return option.isEnabled;
                          })
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                      {fieldError ? (
                        <small className="office-field-error" id={fieldErrorId}>
                          {fieldError}
                        </small>
                      ) : null}
                      {field.fieldKey === "transaction_status" &&
                      statusFieldPolicy?.helperText ? (
                        <small className="office-form-helper" id={helperId}>
                          {statusFieldPolicy.helperText}
                        </small>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : null}

            {ownerFieldEntry ? (
              <div className="office-modal-grid office-modal-grid-primary office-modal-grid-owner">
                {renderBodyField(ownerFieldEntry)}
              </div>
            ) : null}

            {remainingBodyFields.length ? (
              <div className="office-modal-grid office-modal-grid-primary">
                {remainingBodyFields.map((entry) => renderBodyField(entry))}
              </div>
            ) : null}
          </>
        )}

        {mode === "create" ? (
          useOfficeCreateModalChrome ? (
            <section className="office-create-modal-section office-transaction-create-section">
              <div className="office-create-modal-section-head">
                <h4>佣金计算器</h4>
                <p>
                  记录总佣金、费用扣除和一条共享备注，让新交易从一开始就具备结构化财务数据。
                </p>
              </div>
              <TransactionFinanceCreateFields
                draft={financeDraft}
                onChange={setFinanceDraft}
                ownerMembershipId={
                  canSearchOwners
                    ? selectedOwnerMembershipId
                    : (ownerAssignment?.currentOwnerMembershipId ?? "")
                }
              />
            </section>
          ) : (
            <TransactionFinanceCreateFields
              draft={financeDraft}
              onChange={setFinanceDraft}
              ownerMembershipId={
                canSearchOwners
                  ? selectedOwnerMembershipId
                  : (ownerAssignment?.currentOwnerMembershipId ?? "")
              }
            />
          )
        ) : null}

        <footer
          className={`office-modal-footer${useOfficeCreateModalChrome ? " office-create-modal-footer" : ""}`}
        >
          {useOfficeCreateModalChrome ? (
            <div className="office-create-modal-footer-copy">
              <strong>
                {modalFooterTitle ?? "保存前请检查录入信息"}
              </strong>
              <p>
                {modalFooterDescription ??
                  "此步骤会创建交易，并为后续流程动作做好准备。"}
              </p>
            </div>
          ) : (
            <span>
              {stepLabel ??
                (chrome === "modal"
                  ? "第 1 步，共 4 步"
                  : "由字段架构驱动的交易录入")}
            </span>
          )}
          <div className="office-modal-actions">
            {submitError ? (
              <p className="office-form-error office-form-error-summary">
                {submitError}
              </p>
            ) : null}
            {useOfficeCreateModalChrome ? (
              <Button disabled={isSubmitting || !canEditValues} type="submit">
                {isSubmitting ? "保存中..." : submitLabel}
              </Button>
            ) : (
              <button
                className="office-transaction-next"
                disabled={isSubmitting || !canEditValues}
                type="submit"
              >
                {isSubmitting ? "保存中..." : submitLabel}
              </button>
            )}
          </div>
        </footer>
      </form>
    </div>
  );
}
