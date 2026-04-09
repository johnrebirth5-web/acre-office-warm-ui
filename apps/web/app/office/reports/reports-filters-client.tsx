"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  CheckboxField,
  FilterField,
  ListPageFilters,
  SelectInput,
  TextInput
} from "@acre/ui";
import type {
  OfficeTransactionReportSearchFieldDescriptor,
  OfficeTransactionReportSearchFieldKey,
  OfficeTransactionReportSearchLayoutSnapshot,
  OfficeTransactionReportsFilters
} from "@acre/db";
import { useI18n } from "../../../lib/i18n/client";
import {
  buildReportsHref,
  cloneReportSearchFilterState,
  defaultReportsPage,
  getDefaultReportSortDirection,
  getReportSortDirectionOptions,
  getReportSortOptions,
  type ReportSearchFilterState
} from "./reports-search-layout";

type ReportsFiltersClientProps = {
  canManageSearchLayout: boolean;
  filters: OfficeTransactionReportsFilters;
  searchLayout: OfficeTransactionReportSearchLayoutSnapshot;
  pageSize: number;
};

type SearchLayoutResponse = {
  snapshot?: OfficeTransactionReportSearchLayoutSnapshot;
  error?: string;
};

type ReportFilterOption = OfficeTransactionReportsFilters["ownerOptions"][number];

function joinClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(" ");
}

function buildLayoutSelectionState(
  availableFields: OfficeTransactionReportSearchLayoutSnapshot["availableFields"],
  selectedFields: OfficeTransactionReportSearchLayoutSnapshot["selectedFields"]
) {
  const selectedFieldSet = new Set(selectedFields.map((field) => field.key));

  return Object.fromEntries(
    availableFields.map((field) => [field.key, selectedFieldSet.has(field.key)])
  ) as Record<string, boolean>;
}

function formatChecklistSummary(
  options: OfficeTransactionReportsFilters["ownerOptions"],
  selectedValues: string[],
  emptyLabel: string
) {
  if (!selectedValues.length) {
    return emptyLabel;
  }

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.id))
    .map((option) => option.label);

  if (!selectedLabels.length) {
    return emptyLabel;
  }

  if (selectedLabels.length === 1) {
    return selectedLabels[0];
  }

  return `${selectedLabels[0]} +${selectedLabels.length - 1}`;
}

function getReportFieldLabel(
  fieldKey: OfficeTransactionReportSearchFieldKey,
  fallbackLabel: string,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (fieldKey) {
    case "owner":
      return t((messages) => messages.officeReports.fieldOwner);
    case "created_at":
      return t((messages) => messages.officeReports.fieldCreatedAt);
    case "buyer_tenant":
      return t((messages) => messages.officeReports.fieldBuyerTenant);
    case "closing_move_in":
      return t((messages) => messages.officeReports.fieldClosingMoveIn);
    case "commission":
      return t((messages) => messages.officeReports.fieldCommission);
    case "asking_price":
      return t((messages) => messages.officeReports.fieldAskingPrice);
    case "purchased_price":
      return t((messages) => messages.officeReports.fieldPurchasedPrice);
    case "transaction_status":
      return t((messages) => messages.officeReports.fieldTransactionStatus);
    case "invoice_number":
      return t((messages) => messages.officeReports.fieldInvoiceNumber);
    case "department":
      return t((messages) => messages.officeReports.fieldDepartment);
    case "team_leader":
      return t((messages) => messages.officeReports.fieldTeamLeader);
    case "transaction_type":
      return t((messages) => messages.officeReports.fieldTransactionType);
    case "representing_side":
      return t((messages) => messages.officeReports.fieldRepresentingSide);
    case "layout":
      return t((messages) => messages.officeReports.fieldLayout);
    case "company_referral":
      return t((messages) => messages.officeReports.fieldCompanyReferral);
    default:
      return fallbackLabel;
  }
}

function getSortOptionLabel(
  value: ReportSearchFilterState["sortBy"],
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (value) {
    case "asking_price":
      return t((messages) => messages.officeReports.sortAskingPrice);
    case "purchased_price":
      return t((messages) => messages.officeReports.sortPurchasedPrice);
    case "gross_commission":
      return t((messages) => messages.officeReports.sortGrossCommission);
    case "status":
      return t((messages) => messages.officeReports.sortStatus);
    default:
      return t((messages) => messages.officeReports.sortCreatedAt);
  }
}

function getSortDirectionLabel(
  sortBy: ReportSearchFilterState["sortBy"],
  direction: ReportSearchFilterState["sortDirection"],
  t: ReturnType<typeof useI18n>["t"]
) {
  if (sortBy === "created_at") {
    return direction === "asc"
      ? t((messages) => messages.officeReports.directionOldestFirst)
      : t((messages) => messages.officeReports.directionNewestFirst);
  }

  if (sortBy === "status") {
    return direction === "desc"
      ? t((messages) => messages.officeReports.directionReverseWorkflowOrder)
      : t((messages) => messages.officeReports.directionWorkflowOrder);
  }

  return direction === "asc"
    ? t((messages) => messages.officeReports.directionLowestFirst)
    : t((messages) => messages.officeReports.directionHighestFirst);
}

function normalizeDateStateForOperator(
  nextOperator: ReportSearchFilterState["createdAtOperator"],
  current: {
    value: string;
    from: string;
    to: string;
  }
): {
  operator: ReportSearchFilterState["createdAtOperator"];
  value: string;
  from: string;
  to: string;
} {
  if (nextOperator === "range") {
    return {
      operator: nextOperator,
      value: "",
      from: current.from || current.value,
      to: current.to
    };
  }

  if (nextOperator === "eq" || nextOperator === "gte" || nextOperator === "lte") {
    return {
      operator: nextOperator,
      value: current.value || current.from || current.to,
      from: "",
      to: ""
    };
  }

  return {
    operator: "",
    value: "",
    from: "",
    to: ""
  };
}

function normalizeNumericStateForOperator(
  nextOperator: ReportSearchFilterState["commissionOperator"],
  current: {
    value: string;
    min: string;
    max: string;
  }
): {
  operator: ReportSearchFilterState["commissionOperator"];
  value: string;
  min: string;
  max: string;
} {
  if (nextOperator === "range") {
    return {
      operator: nextOperator,
      value: "",
      min: current.min || current.value,
      max: current.max
    };
  }

  if (
    nextOperator === "eq" ||
    nextOperator === "gt" ||
    nextOperator === "gte" ||
    nextOperator === "lt" ||
    nextOperator === "lte"
  ) {
    return {
      operator: nextOperator,
      value: current.value || current.min || current.max,
      min: "",
      max: ""
    };
  }

  return {
    operator: "",
    value: "",
    min: "",
    max: ""
  };
}

function getReportSearchFieldClassName(fieldKey: string, className?: string) {
  return joinClassNames("office-report-search-field", `office-report-search-field-${fieldKey}`, className);
}

function normalizeOptionSearchTerm(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function scoreOptionMatch(label: string, rawQuery: string) {
  const query = normalizeOptionSearchTerm(rawQuery);

  if (!query) {
    return 0;
  }

  const normalizedLabel = normalizeOptionSearchTerm(label);
  const compactLabel = normalizedLabel.replace(/\s+/g, "");
  const compactQuery = query.replace(/\s+/g, "");

  if (normalizedLabel === query) {
    return 4000;
  }

  if (normalizedLabel.startsWith(query)) {
    return 3000 - normalizedLabel.length;
  }

  const words = normalizedLabel.split(" ");
  const wordMatchIndex = words.findIndex((word) => word.startsWith(query));

  if (wordMatchIndex !== -1) {
    return 2000 - wordMatchIndex;
  }

  const compactMatchIndex = compactLabel.indexOf(compactQuery);

  if (compactMatchIndex !== -1) {
    return 1500 - compactMatchIndex;
  }

  const includesIndex = normalizedLabel.indexOf(query);

  if (includesIndex !== -1) {
    return 1000 - includesIndex;
  }

  return null;
}

function getFilteredReportOptions(options: ReportFilterOption[], query: string) {
  return options
    .map((option, index) => ({
      option,
      index,
      score: scoreOptionMatch(option.label, query)
    }))
    .filter((entry) => entry.score !== null)
    .sort((left, right) => {
      if (left.score === right.score) {
        return left.index - right.index;
      }

      return (right.score ?? 0) - (left.score ?? 0);
    })
    .map((entry) => entry.option);
}

function useReportSearchPicker(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return {
    containerRef,
    searchInputRef
  };
}

const reportSearchFieldOrder: Partial<Record<OfficeTransactionReportSearchFieldKey, number>> = {
  owner: 10,
  transaction_status: 20,
  department: 30,
  team_leader: 40,
  transaction_type: 50,
  buyer_tenant: 60,
  invoice_number: 70,
  company_referral: 80,
  representing_side: 90,
  layout: 100,
  created_at: 110,
  closing_move_in: 120,
  commission: 130,
  asking_price: 140,
  purchased_price: 150
};

function getReportSearchFieldOrder(fieldKey: OfficeTransactionReportSearchFieldKey) {
  return reportSearchFieldOrder[fieldKey] ?? 500;
}

function isWideReportSearchField(fieldKey: OfficeTransactionReportSearchFieldKey) {
  return (
    fieldKey === "created_at" ||
    fieldKey === "closing_move_in" ||
    fieldKey === "commission" ||
    fieldKey === "asking_price" ||
    fieldKey === "purchased_price"
  );
}

function ReportSearchLayoutModal(props: {
  availableFields: OfficeTransactionReportSearchLayoutSnapshot["availableFields"];
  error: string;
  isOpen: boolean;
  isSaving: boolean;
  layoutSelection: Record<string, boolean>;
  onClose: () => void;
  onSave: () => void;
  onToggleField: (fieldKey: OfficeTransactionReportSearchFieldKey) => void;
}) {
  if (!props.isOpen) {
    return null;
  }

  const { t } = useI18n();

  const groups: Array<OfficeTransactionReportSearchFieldDescriptor["groupLabel"]> = [
    "Operational",
    "Financial",
    "Organizational"
  ];

  return (
    <div className="office-modal-overlay" onClick={() => !props.isSaving && props.onClose()}>
      <section
        aria-label={t((messages) => messages.officeReports.editFields)}
        aria-modal="true"
        className="office-fields-modal office-transaction-search-layout-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="office-fields-modal-head office-transaction-search-layout-head">
          <div>
            <h3>{t((messages) => messages.officeReports.editFields)}</h3>
            <p>{t((messages) => messages.officeReports.editFieldsBody)}</p>
          </div>
          <Button
            aria-label={t((messages) => messages.common.close)}
            disabled={props.isSaving}
            onClick={props.onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t((messages) => messages.common.close)}
          </Button>
        </header>

        <div className="office-fields-modal-body office-transaction-search-layout-body">
          {groups.map((group) => {
            const groupFields = props.availableFields.filter((field) => field.groupLabel === group);

            if (!groupFields.length) {
              return null;
            }

            return (
              <section className="office-transaction-search-layout-group" key={group}>
                <div className="office-transaction-search-layout-group-head">
                  <strong>
                    {group === "Operational"
                      ? t((messages) => messages.officeReports.groupOperational)
                      : group === "Financial"
                        ? t((messages) => messages.officeReports.groupFinancial)
                        : t((messages) => messages.officeReports.groupOrganizational)}
                  </strong>
                  <p>
                    {group === "Operational"
                      ? t((messages) => messages.officeReports.groupOperationalBody)
                      : group === "Financial"
                        ? t((messages) => messages.officeReports.groupFinancialBody)
                        : t((messages) => messages.officeReports.groupOrganizationalBody)}
                  </p>
                </div>
                <div className="office-transaction-search-layout-list">
                  {groupFields.map((field) => (
                    <div
                      className="office-fields-modal-checkbox office-transaction-search-layout-checkbox"
                      key={field.key}
                    >
                      <CheckboxField
                        className="office-transaction-search-layout-checkbox-field"
                        label={getReportFieldLabel(field.key, field.label, t)}
                      >
                        <input
                          checked={Boolean(props.layoutSelection[field.key])}
                          disabled={props.isSaving}
                          onChange={() => props.onToggleField(field.key)}
                          type="checkbox"
                        />
                      </CheckboxField>
                      <small>{field.description}</small>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="office-fields-modal-footer office-transaction-search-layout-footer">
          {props.error ? (
            <p className="office-inline-error office-transaction-search-layout-error">{props.error}</p>
          ) : null}
          <Button disabled={props.isSaving} onClick={props.onClose} type="button" variant="secondary">
            {t((messages) => messages.common.cancel)}
          </Button>
          <Button disabled={props.isSaving} onClick={props.onSave} type="button">
            {props.isSaving ? t((messages) => messages.common.saving) : t((messages) => messages.common.save)}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function ReportSearchDateField(props: {
  label: string;
  operatorValue: ReportSearchFilterState["createdAtOperator"];
  value: string;
  from: string;
  to: string;
  className?: string;
  onChange: (nextValue: {
    operator: ReportSearchFilterState["createdAtOperator"];
    value: string;
    from: string;
    to: string;
  }) => void;
}) {
  const { t } = useI18n();
  const isRange = props.operatorValue === "range" || (!props.operatorValue && (!!props.from || !!props.to));
  const showsSingleValue =
    !isRange &&
    (props.operatorValue === "eq" ||
      props.operatorValue === "gte" ||
      props.operatorValue === "lte" ||
      (!props.operatorValue && !!props.value));

  return (
    <FilterField
      className={joinClassNames("office-report-search-layout-field", props.className)}
      label={props.label}
    >
      <div className="office-report-search-layout-stack">
        <label className="office-report-search-inline-field">
          <span>{t((messages) => messages.officeReports.operator)}</span>
          <SelectInput
            onChange={(event) =>
              props.onChange(
                normalizeDateStateForOperator(
                  event.target.value as ReportSearchFilterState["createdAtOperator"],
                  {
                    value: props.value,
                    from: props.from,
                    to: props.to
                  }
                )
              )
            }
            value={props.operatorValue}
          >
            <option value="">{t((messages) => messages.officeReports.any)}</option>
            <option value="eq">{t((messages) => messages.officeReports.equals)}</option>
            <option value="gte">{t((messages) => messages.officeReports.onOrAfter)}</option>
            <option value="lte">{t((messages) => messages.officeReports.onOrBefore)}</option>
            <option value="range">{t((messages) => messages.officeReports.range)}</option>
          </SelectInput>
        </label>

        {showsSingleValue ? (
          <label className="office-report-search-inline-field">
            <span>{t((messages) => messages.officeReports.date)}</span>
            <TextInput
              onChange={(event) =>
                props.onChange({
                  operator: props.operatorValue,
                  value: event.target.value,
                  from: "",
                  to: ""
                })
              }
              type="date"
              value={props.value}
            />
          </label>
        ) : null}

        {isRange ? (
          <div className="office-report-search-layout-grid office-report-search-layout-grid-range">
            <label className="office-report-search-inline-field">
              <span>{t((messages) => messages.common.from)}</span>
              <TextInput
                onChange={(event) =>
                  props.onChange({
                    operator: "range",
                    value: "",
                    from: event.target.value,
                    to: props.to
                  })
                }
                type="date"
                value={props.from}
              />
            </label>
            <label className="office-report-search-inline-field">
              <span>{t((messages) => messages.common.to)}</span>
              <TextInput
                onChange={(event) =>
                  props.onChange({
                    operator: "range",
                    value: "",
                    from: props.from,
                    to: event.target.value
                  })
                }
                type="date"
                value={props.to}
              />
            </label>
          </div>
        ) : null}
      </div>
    </FilterField>
  );
}

function ReportSearchNumericField(props: {
  label: string;
  operatorValue: ReportSearchFilterState["commissionOperator"];
  value: string;
  min: string;
  max: string;
  className?: string;
  onChange: (nextValue: {
    operator: ReportSearchFilterState["commissionOperator"];
    value: string;
    min: string;
    max: string;
  }) => void;
}) {
  const { t } = useI18n();
  const isRange = props.operatorValue === "range" || (!props.operatorValue && (!!props.min || !!props.max));
  const showsSingleValue =
    !isRange &&
    (props.operatorValue === "eq" ||
      props.operatorValue === "gt" ||
      props.operatorValue === "gte" ||
      props.operatorValue === "lt" ||
      props.operatorValue === "lte" ||
      (!props.operatorValue && !!props.value));

  return (
    <FilterField
      className={joinClassNames("office-report-search-layout-field", props.className)}
      label={props.label}
    >
      <div className="office-report-search-layout-stack">
        <label className="office-report-search-inline-field">
          <span>{t((messages) => messages.officeReports.operator)}</span>
          <SelectInput
            onChange={(event) =>
              props.onChange(
                normalizeNumericStateForOperator(
                  event.target.value as ReportSearchFilterState["commissionOperator"],
                  {
                    value: props.value,
                    min: props.min,
                    max: props.max
                  }
                )
              )
            }
            value={props.operatorValue}
          >
            <option value="">{t((messages) => messages.officeReports.any)}</option>
            <option value="eq">{t((messages) => messages.officeReports.equals)}</option>
            <option value="gt">{t((messages) => messages.officeReports.greaterThan)}</option>
            <option value="gte">{t((messages) => messages.officeReports.greaterThanOrEqual)}</option>
            <option value="lt">{t((messages) => messages.officeReports.lessThan)}</option>
            <option value="lte">{t((messages) => messages.officeReports.lessThanOrEqual)}</option>
            <option value="range">{t((messages) => messages.officeReports.range)}</option>
          </SelectInput>
        </label>

        {showsSingleValue ? (
          <label className="office-report-search-inline-field">
            <span>{t((messages) => messages.officeReports.amount)}</span>
            <TextInput
              inputMode="decimal"
              onChange={(event) =>
                props.onChange({
                  operator: props.operatorValue,
                  value: event.target.value,
                  min: "",
                  max: ""
                })
              }
              placeholder="0.00"
              type="text"
              value={props.value}
            />
          </label>
        ) : null}

        {isRange ? (
          <div className="office-report-search-layout-grid office-report-search-layout-grid-range">
            <label className="office-report-search-inline-field">
              <span>{t((messages) => messages.officeReports.min)}</span>
              <TextInput
                inputMode="decimal"
                onChange={(event) =>
                  props.onChange({
                    operator: "range",
                    value: "",
                    min: event.target.value,
                    max: props.max
                  })
                }
                placeholder="0.00"
                type="text"
                value={props.min}
              />
            </label>
            <label className="office-report-search-inline-field">
              <span>{t((messages) => messages.officeReports.max)}</span>
              <TextInput
                inputMode="decimal"
                onChange={(event) =>
                  props.onChange({
                    operator: "range",
                    value: "",
                    min: props.min,
                    max: event.target.value
                  })
                }
                placeholder="0.00"
                type="text"
                value={props.max}
              />
            </label>
          </div>
        ) : null}
      </div>
    </FilterField>
  );
}

function SearchablePersonSelectField(props: {
  label: string;
  options: ReportFilterOption[];
  value: string;
  emptyLabel: string;
  searchPlaceholder: string;
  onChange: (nextValue: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const { containerRef, searchInputRef } = useReportSearchPicker(isOpen, () => setIsOpen(false));
  const selectedOption = props.options.find((option) => option.id === props.value) ?? null;
  const filteredOptions = getFilteredReportOptions(props.options, searchValue);

  function openPicker() {
    setSearchValue("");
    setIsOpen(true);
  }

  function togglePicker() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    openPicker();
  }

  return (
    <div
      className={joinClassNames(
        "office-filter-field",
        "office-report-search-multiselect-field",
        props.className
      )}
      ref={containerRef}
    >
      <span>{props.label}</span>
      <button
        aria-expanded={isOpen}
        className={`office-report-search-multiselect-trigger${isOpen ? " is-open" : ""}`}
        onClick={togglePicker}
        type="button"
      >
        <span
          className="office-report-search-multiselect-trigger-value"
          title={selectedOption?.label ?? props.emptyLabel}
        >
          {selectedOption?.label ?? props.emptyLabel}
        </span>
      </button>

      {isOpen ? (
        <div className="office-report-search-multiselect-popover">
          <div className="office-report-search-multiselect-popover-head">
            <strong>
              {selectedOption
                ? t((messages) => messages.officeReports.oneSelected)
                : t((messages) => messages.officeReports.noSelection)}
            </strong>
            {props.value ? (
              <button
                onClick={() => {
                  props.onChange("");
                  setSearchValue("");
                  setIsOpen(false);
                }}
                type="button"
              >
                {t((messages) => messages.common.clear)}
              </button>
            ) : null}
          </div>
          <input
            autoComplete="off"
            className="office-input office-report-search-picker-input"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={props.searchPlaceholder}
            ref={searchInputRef}
            type="search"
            value={searchValue}
          />
          <div className="office-report-search-multiselect-options" role="listbox">
            <button
              aria-selected={!props.value}
              className={joinClassNames(
                "office-autocomplete-option",
                !props.value && "is-selected"
              )}
              onClick={() => {
                props.onChange("");
                setSearchValue("");
                setIsOpen(false);
              }}
              type="button"
            >
              <span>{props.emptyLabel}</span>
              {!props.value ? <strong>{t((messages) => messages.officeReports.selected)}</strong> : null}
            </button>

            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  aria-selected={props.value === option.id}
                  className={joinClassNames(
                    "office-autocomplete-option",
                    props.value === option.id && "is-selected"
                  )}
                  key={option.id}
                  onClick={() => {
                    props.onChange(option.id);
                    setSearchValue("");
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  <span>{option.label}</span>
                  {props.value === option.id ? <strong>{t((messages) => messages.officeReports.selected)}</strong> : null}
                </button>
              ))
            ) : (
              <div className="office-autocomplete-empty">{t((messages) => messages.officeReports.noMatchingOptions)}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchableOptionMultiSelectField(props: {
  label: string;
  options: ReportFilterOption[];
  value: string[];
  onChange: (nextValue: string[]) => void;
  searchPlaceholder: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const summary = formatChecklistSummary(
    props.options,
    props.value,
    t((messages) => messages.officeReports.any)
  );
  const { containerRef, searchInputRef } = useReportSearchPicker(isOpen, () => setIsOpen(false));
  const filteredOptions = getFilteredReportOptions(props.options, searchValue);

  function togglePicker() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setSearchValue("");
    setIsOpen(true);
  }

  return (
    <div
      className={joinClassNames(
        "office-filter-field",
        "office-report-search-multiselect-field",
        props.className
      )}
      ref={containerRef}
    >
      <span>{props.label}</span>
      <button
        aria-expanded={isOpen}
        className={`office-report-search-multiselect-trigger${isOpen ? " is-open" : ""}`}
        onClick={togglePicker}
        type="button"
      >
        <span className="office-report-search-multiselect-trigger-value" title={summary}>
          {summary}
        </span>
      </button>

      {isOpen ? (
        <div className="office-report-search-multiselect-popover">
          <div className="office-report-search-multiselect-popover-head">
            <strong>
              {props.value.length
                ? t((messages) => messages.officeReports.selectedCount, {
                    count: props.value.length,
                  })
                : t((messages) => messages.officeReports.noFiltersApplied)}
            </strong>
            {props.value.length ? (
              <button
                onClick={() => {
                  props.onChange([]);
                  setSearchValue("");
                }}
                type="button"
              >
                {t((messages) => messages.common.clear)}
              </button>
            ) : null}
          </div>
          <input
            autoComplete="off"
            className="office-input office-report-search-picker-input"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={props.searchPlaceholder}
            ref={searchInputRef}
            type="search"
            value={searchValue}
          />
          <div className="office-report-search-multiselect-options">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isChecked = props.value.includes(option.id);

                return (
                  <button
                    aria-pressed={isChecked}
                    className={joinClassNames(
                      "office-autocomplete-option",
                      isChecked && "is-selected"
                    )}
                    key={option.id}
                    onClick={() => {
                      const nextValue = isChecked
                        ? props.value.filter((value) => value !== option.id)
                        : [...props.value, option.id];

                      props.onChange(nextValue);
                    }}
                  type="button"
                >
                  <span>{option.label}</span>
                  {isChecked ? <strong>{t((messages) => messages.officeReports.selected)}</strong> : null}
                </button>
              );
            })
            ) : (
              <div className="office-autocomplete-empty">{t((messages) => messages.officeReports.noMatchingOptions)}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchablePersonMultiSelectField(props: {
  label: string;
  options: ReportFilterOption[];
  value: string[];
  onChange: (nextValue: string[]) => void;
  searchPlaceholder: string;
  className?: string;
}) {
  return <SearchableOptionMultiSelectField {...props} />;
}

function CompactChecklistMultiSelectField(props: {
  label: string;
  options: ReportFilterOption[];
  value: string[];
  onChange: (nextValue: string[]) => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <SearchableOptionMultiSelectField
      {...props}
      searchPlaceholder={t((messages) => messages.officeReports.searchFieldPlaceholder, {
        label: props.label.toLowerCase(),
      })}
    />
  );
}

export function ReportsFiltersClient({
  canManageSearchLayout,
  filters,
  pageSize,
  searchLayout
}: ReportsFiltersClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [searchFilters, setSearchFilters] = useState<ReportSearchFilterState>(() =>
    cloneReportSearchFilterState(filters)
  );
  const [layoutSelection, setLayoutSelection] = useState<Record<string, boolean>>(() =>
    buildLayoutSelectionState(searchLayout.availableFields, searchLayout.selectedFields)
  );
  const [isSearchLayoutModalOpen, setIsSearchLayoutModalOpen] = useState(false);
  const [layoutSaveError, setLayoutSaveError] = useState("");
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  useEffect(() => {
    setSearchFilters(cloneReportSearchFilterState(filters));
    setLayoutSelection(buildLayoutSelectionState(searchLayout.availableFields, searchLayout.selectedFields));
    setLayoutSaveError("");
    setIsSavingLayout(false);
  }, [filters, searchLayout]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isSearchLayoutModalOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSearchLayoutModalOpen]);

  const selectedDraftFields = searchLayout.availableFields.filter(
    (field) => layoutSelection[field.key]
  );
  const orderedSelectedFields = [...searchLayout.selectedFields].sort(
    (left, right) => getReportSearchFieldOrder(left.key) - getReportSearchFieldOrder(right.key)
  );
  const compactSelectedFields = orderedSelectedFields.filter(
    (field) => !isWideReportSearchField(field.key)
  );
  const wideSelectedFields = orderedSelectedFields.filter((field) =>
    isWideReportSearchField(field.key)
  );
  const sortOptions = getReportSortOptions();
  const sortDirectionOptions = getReportSortDirectionOptions(searchFilters.sortBy);

  function updateFilters(updater: (current: ReportSearchFilterState) => ReportSearchFilterState) {
    setSearchFilters((current) => updater(current));
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildReportsHref(pathname, {
        selectedFieldKeys: searchLayout.selectedFields.map((field) => field.key),
        filters: searchFilters,
        page: defaultReportsPage,
        pageSize
      })
    );
  }

  function resetFilters() {
    setSearchFilters(cloneReportSearchFilterState(filters));
    router.push(
      buildReportsHref(pathname, {
        selectedFieldKeys: searchLayout.selectedFields.map((field) => field.key),
        filters: cloneReportSearchFilterState({
          ...filters,
          ownerMembershipId: "",
          createdAtOperator: "",
          createdAtValue: "",
          createdAtFrom: "",
          createdAtTo: "",
          buyerTenant: "",
          closingMoveInOperator: "",
          closingMoveInValue: "",
          closingMoveInFrom: "",
          closingMoveInTo: "",
          commissionOperator: "",
          commissionValue: "",
          commissionMin: "",
          commissionMax: "",
          askingPriceOperator: "",
          askingPriceValue: "",
          askingPriceMin: "",
          askingPriceMax: "",
          purchasedPriceOperator: "",
          purchasedPriceValue: "",
          purchasedPriceMin: "",
          purchasedPriceMax: "",
          transactionStatuses: [],
          invoiceNumber: "",
          departmentIds: [],
          teamLeaderMembershipIds: [],
          transactionTypes: [],
          representingSides: [],
          layouts: [],
          companyReferral: "",
          sortBy: filters.sortBy,
          sortDirection: filters.sortDirection
        }),
        page: defaultReportsPage,
        pageSize
      })
    );
  }

  function toggleLayoutField(fieldKey: OfficeTransactionReportSearchFieldKey) {
    setLayoutSelection((current) => ({
      ...current,
      [fieldKey]: !current[fieldKey]
    }));
  }

  async function handleSaveSearchLayout() {
    setIsSavingLayout(true);
    setLayoutSaveError("");

    try {
      const response = await fetch("/api/office/reports/search-layout", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: selectedDraftFields.map((field) => field.key)
        })
      });
      const body = (await response.json().catch(() => null)) as SearchLayoutResponse | null;

      if (!response.ok || !body?.snapshot) {
        throw new Error(body?.error ?? t((messages) => messages.officeReports.saveFieldsFailed));
      }

      setIsSearchLayoutModalOpen(false);
      setLayoutSelection(buildLayoutSelectionState(body.snapshot.availableFields, body.snapshot.selectedFields));

      const nextHref = buildReportsHref(pathname, {
        selectedFieldKeys: body.snapshot.selectedFields.map((field) => field.key),
        filters: searchFilters,
        page: defaultReportsPage,
        pageSize
      });
      const currentHref = buildReportsHref(pathname, {
        selectedFieldKeys: searchLayout.selectedFields.map((field) => field.key),
        filters: searchFilters,
        page: defaultReportsPage,
        pageSize
      });

      if (nextHref === currentHref) {
        router.refresh();
      } else {
        router.push(nextHref);
      }
    } catch (error) {
      setLayoutSaveError(
        error instanceof Error ? error.message : t((messages) => messages.officeReports.saveFieldsFailed)
      );
    } finally {
      setIsSavingLayout(false);
    }
  }

  function renderSearchField(field: OfficeTransactionReportSearchFieldDescriptor) {
    if (field.key === "owner") {
      return (
        <SearchablePersonSelectField
          className={getReportSearchFieldClassName(field.key)}
          emptyLabel={t((messages) => messages.common.allOwners)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              ownerMembershipId: nextValue
            }))
          }
          options={filters.ownerOptions}
          searchPlaceholder={t((messages) => messages.officeReports.searchOwnerName)}
          value={searchFilters.ownerMembershipId}
        />
      );
    }

    if (field.key === "created_at") {
      return (
        <ReportSearchDateField
          className={getReportSearchFieldClassName(field.key)}
          from={searchFilters.createdAtFrom}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              createdAtOperator: nextValue.operator,
              createdAtValue: nextValue.value,
              createdAtFrom: nextValue.from,
              createdAtTo: nextValue.to
            }))
          }
          operatorValue={searchFilters.createdAtOperator}
          to={searchFilters.createdAtTo}
          value={searchFilters.createdAtValue}
        />
      );
    }

    if (field.key === "buyer_tenant") {
      return (
        <FilterField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
        >
          <TextInput
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                buyerTenant: event.target.value
              }))
            }
            placeholder={t((messages) => messages.officeReports.buyerTenantPlaceholder)}
            type="text"
            value={searchFilters.buyerTenant}
          />
        </FilterField>
      );
    }

    if (field.key === "closing_move_in") {
      return (
        <ReportSearchDateField
          className={getReportSearchFieldClassName(field.key)}
          from={searchFilters.closingMoveInFrom}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              closingMoveInOperator: nextValue.operator,
              closingMoveInValue: nextValue.value,
              closingMoveInFrom: nextValue.from,
              closingMoveInTo: nextValue.to
            }))
          }
          operatorValue={searchFilters.closingMoveInOperator}
          to={searchFilters.closingMoveInTo}
          value={searchFilters.closingMoveInValue}
        />
      );
    }

    if (field.key === "commission") {
      return (
        <ReportSearchNumericField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          max={searchFilters.commissionMax}
          min={searchFilters.commissionMin}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              commissionOperator: nextValue.operator,
              commissionValue: nextValue.value,
              commissionMin: nextValue.min,
              commissionMax: nextValue.max
            }))
          }
          operatorValue={searchFilters.commissionOperator}
          value={searchFilters.commissionValue}
        />
      );
    }

    if (field.key === "asking_price") {
      return (
        <ReportSearchNumericField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          max={searchFilters.askingPriceMax}
          min={searchFilters.askingPriceMin}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              askingPriceOperator: nextValue.operator,
              askingPriceValue: nextValue.value,
              askingPriceMin: nextValue.min,
              askingPriceMax: nextValue.max
            }))
          }
          operatorValue={searchFilters.askingPriceOperator}
          value={searchFilters.askingPriceValue}
        />
      );
    }

    if (field.key === "purchased_price") {
      return (
        <ReportSearchNumericField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          max={searchFilters.purchasedPriceMax}
          min={searchFilters.purchasedPriceMin}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              purchasedPriceOperator: nextValue.operator,
              purchasedPriceValue: nextValue.value,
              purchasedPriceMin: nextValue.min,
              purchasedPriceMax: nextValue.max
            }))
          }
          operatorValue={searchFilters.purchasedPriceOperator}
          value={searchFilters.purchasedPriceValue}
        />
      );
    }

    if (field.key === "transaction_status") {
      return (
        <CompactChecklistMultiSelectField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              transactionStatuses: nextValue
            }))
          }
          options={filters.statusOptions}
          value={searchFilters.transactionStatuses}
        />
      );
    }

    if (field.key === "invoice_number") {
      return (
        <FilterField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
        >
          <TextInput
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                invoiceNumber: event.target.value
              }))
            }
            placeholder={t((messages) => messages.officeReports.invoiceNumberPlaceholder)}
            type="text"
            value={searchFilters.invoiceNumber}
          />
        </FilterField>
      );
    }

    if (field.key === "department") {
      return (
        <CompactChecklistMultiSelectField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              departmentIds: nextValue
            }))
          }
          options={filters.departmentOptions}
          value={searchFilters.departmentIds}
        />
      );
    }

    if (field.key === "team_leader") {
      return (
        <SearchablePersonMultiSelectField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              teamLeaderMembershipIds: nextValue
            }))
          }
          options={filters.teamLeaderOptions}
          searchPlaceholder={t((messages) => messages.officeReports.searchTeamLeader)}
          value={searchFilters.teamLeaderMembershipIds}
        />
      );
    }

    if (field.key === "transaction_type") {
      return (
        <CompactChecklistMultiSelectField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              transactionTypes: nextValue
            }))
          }
          options={filters.transactionTypeOptions}
          value={searchFilters.transactionTypes}
        />
      );
    }

    if (field.key === "representing_side") {
      return (
        <CompactChecklistMultiSelectField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              representingSides: nextValue
            }))
          }
          options={filters.representingOptions}
          value={searchFilters.representingSides}
        />
      );
    }

    if (field.key === "layout") {
      return (
        <CompactChecklistMultiSelectField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              layouts: nextValue
            }))
          }
          options={filters.layoutOptions}
          value={searchFilters.layouts}
        />
      );
    }

    if (field.key === "company_referral") {
      return (
        <FilterField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={getReportFieldLabel(field.key, field.label, t)}
        >
          <SelectInput
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                companyReferral: event.target.value as ReportSearchFilterState["companyReferral"]
              }))
            }
            value={searchFilters.companyReferral}
          >
            <option value="">{t((messages) => messages.officeReports.any)}</option>
            {filters.companyReferralOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id === "yes"
                  ? t((messages) => messages.common.yes)
                  : option.id === "no"
                    ? t((messages) => messages.common.no)
                    : option.label}
              </option>
            ))}
          </SelectInput>
        </FilterField>
      );
    }

    return null;
  }

  return (
    <>
      <ListPageFilters
        as="form"
        className="office-report-search-layout-shell"
        onSubmit={handleApplyFilters}
      >
        {orderedSelectedFields.length ? (
          <>
            {compactSelectedFields.length ? (
              <div className="office-report-search-grid office-report-search-grid-compact">
                {compactSelectedFields.map((field) => renderSearchField(field))}
              </div>
            ) : null}

            {wideSelectedFields.length ? (
              <div className="office-report-search-grid office-report-search-grid-wide">
                {wideSelectedFields.map((field) => renderSearchField(field))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="office-transaction-search-empty">
            <strong>{t((messages) => messages.officeReports.noFieldsConfiguredTitle)}</strong>
            <p>
              {canManageSearchLayout
                ? t((messages) => messages.officeReports.noFieldsConfiguredAdmin)
                : t((messages) => messages.officeReports.noFieldsConfiguredUser)}
            </p>
          </div>
        )}

        <div className="office-report-search-controls">
          <FilterField
            className="office-report-search-field office-report-search-field-sort"
            label={t((messages) => messages.officeReports.sortBy)}
          >
            <SelectInput
              onChange={(event) =>
                updateFilters((current) => {
                  const nextSortBy = event.target.value as ReportSearchFilterState["sortBy"];

                  return {
                    ...current,
                    sortBy: nextSortBy,
                    sortDirection: getDefaultReportSortDirection(nextSortBy)
                  };
                })
              }
              value={searchFilters.sortBy}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {getSortOptionLabel(option.value, t)}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField
            className="office-report-search-field office-report-search-field-direction"
            label={t((messages) => messages.officeReports.direction)}
          >
            <SelectInput
              onChange={(event) =>
                updateFilters((current) => ({
                  ...current,
                  sortDirection: event.target.value as ReportSearchFilterState["sortDirection"]
                }))
              }
              value={searchFilters.sortDirection}
            >
              {sortDirectionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {getSortDirectionLabel(searchFilters.sortBy, option.value, t)}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <div className="office-filter-actions office-report-search-field office-report-search-field-actions">
            {canManageSearchLayout ? (
              <Button
                onClick={() => setIsSearchLayoutModalOpen(true)}
                type="button"
                variant="secondary"
              >
                {t((messages) => messages.officeReports.editFields)}
              </Button>
            ) : null}
            <Button type="submit">{t((messages) => messages.common.applyFilters)}</Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              {t((messages) => messages.common.reset)}
            </Button>
          </div>
        </div>
      </ListPageFilters>

      <ReportSearchLayoutModal
        availableFields={searchLayout.availableFields}
        error={layoutSaveError}
        isOpen={isSearchLayoutModalOpen}
        isSaving={isSavingLayout}
        layoutSelection={layoutSelection}
        onClose={() => !isSavingLayout && setIsSearchLayoutModalOpen(false)}
        onSave={handleSaveSearchLayout}
        onToggleField={toggleLayoutField}
      />
    </>
  );
}
