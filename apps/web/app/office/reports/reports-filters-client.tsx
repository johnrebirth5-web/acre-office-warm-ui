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
import {
  buildReportsHref,
  cloneReportSearchFilterState,
  type ReportSearchFilterState
} from "./reports-search-layout";

type ReportsFiltersClientProps = {
  canManageSearchLayout: boolean;
  filters: OfficeTransactionReportsFilters;
  searchLayout: OfficeTransactionReportSearchLayoutSnapshot;
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
  selectedValues: string[]
) {
  if (!selectedValues.length) {
    return "Any";
  }

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.id))
    .map((option) => option.label);

  if (!selectedLabels.length) {
    return "Any";
  }

  if (selectedLabels.length === 1) {
    return selectedLabels[0];
  }

  return `${selectedLabels[0]} +${selectedLabels.length - 1}`;
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

  const groups: Array<OfficeTransactionReportSearchFieldDescriptor["groupLabel"]> = [
    "Operational",
    "Financial",
    "Organizational"
  ];

  return (
    <div className="office-modal-overlay" onClick={() => !props.isSaving && props.onClose()}>
      <section
        aria-label="Edit report search fields"
        aria-modal="true"
        className="office-fields-modal office-transaction-search-layout-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="office-fields-modal-head office-transaction-search-layout-head">
          <div>
            <h3>Edit search fields</h3>
            <p>Choose which report filters stay visible for this office workbench.</p>
          </div>
          <Button
            aria-label="Close report search field editor"
            disabled={props.isSaving}
            onClick={props.onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            Close
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
                  <strong>{group}</strong>
                  <p>
                    {group === "Operational"
                      ? "Day-to-day report filters like dates, workflow state, and deal attributes."
                      : group === "Financial"
                        ? "Commission and pricing filters that shape financial reporting."
                        : "Owner, office, and hierarchy filters tied to the current org structure."}
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
                        label={field.label}
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
            Cancel
          </Button>
          <Button disabled={props.isSaving} onClick={props.onSave} type="button">
            {props.isSaving ? "Saving..." : "Save fields"}
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
          <span>Operator</span>
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
            <option value="">Any</option>
            <option value="eq">Equals</option>
            <option value="gte">On or after</option>
            <option value="lte">On or before</option>
            <option value="range">Range</option>
          </SelectInput>
        </label>

        {showsSingleValue ? (
          <label className="office-report-search-inline-field">
            <span>Date</span>
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
              <span>From</span>
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
              <span>To</span>
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
          <span>Operator</span>
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
            <option value="">Any</option>
            <option value="eq">Equals</option>
            <option value="gt">Greater than</option>
            <option value="gte">Greater than or equal</option>
            <option value="lt">Less than</option>
            <option value="lte">Less than or equal</option>
            <option value="range">Range</option>
          </SelectInput>
        </label>

        {showsSingleValue ? (
          <label className="office-report-search-inline-field">
            <span>Amount</span>
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
              <span>Min</span>
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
              <span>Max</span>
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
            <strong>{selectedOption ? "1 selected" : "No selection"}</strong>
            {props.value ? (
              <button
                onClick={() => {
                  props.onChange("");
                  setSearchValue("");
                  setIsOpen(false);
                }}
                type="button"
              >
                Clear
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
              {!props.value ? <strong>Selected</strong> : null}
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
                  {props.value === option.id ? <strong>Selected</strong> : null}
                </button>
              ))
            ) : (
              <div className="office-autocomplete-empty">No matching people.</div>
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
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const summary = formatChecklistSummary(props.options, props.value);
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
            <strong>{props.value.length ? `${props.value.length} selected` : "No filters applied"}</strong>
            {props.value.length ? (
              <button
                onClick={() => {
                  props.onChange([]);
                  setSearchValue("");
                }}
                type="button"
              >
                Clear
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
                    {isChecked ? <strong>Selected</strong> : null}
                  </button>
                );
              })
            ) : (
              <div className="office-autocomplete-empty">No matching people.</div>
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
  return (
    <SearchableOptionMultiSelectField
      {...props}
      searchPlaceholder={`Search ${props.label.toLowerCase()}`}
    />
  );
}

export function ReportsFiltersClient({
  canManageSearchLayout,
  filters,
  searchLayout
}: ReportsFiltersClientProps) {
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

  function updateFilters(updater: (current: ReportSearchFilterState) => ReportSearchFilterState) {
    setSearchFilters((current) => updater(current));
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildReportsHref(pathname, {
        selectedFieldKeys: searchLayout.selectedFields.map((field) => field.key),
        filters: searchFilters
      })
    );
  }

  function resetFilters() {
    setSearchFilters(cloneReportSearchFilterState(filters));
    router.push(pathname);
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
        throw new Error(body?.error ?? "Failed to save report search fields.");
      }

      setIsSearchLayoutModalOpen(false);
      setLayoutSelection(buildLayoutSelectionState(body.snapshot.availableFields, body.snapshot.selectedFields));

      const nextHref = buildReportsHref(pathname, {
        selectedFieldKeys: body.snapshot.selectedFields.map((field) => field.key),
        filters: searchFilters
      });
      const currentHref = buildReportsHref(pathname, {
        selectedFieldKeys: searchLayout.selectedFields.map((field) => field.key),
        filters: searchFilters
      });

      if (nextHref === currentHref) {
        router.refresh();
      } else {
        router.push(nextHref);
      }
    } catch (error) {
      setLayoutSaveError(
        error instanceof Error ? error.message : "Failed to save report search fields."
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
          emptyLabel="All owners"
          key={field.key}
          label={field.label}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              ownerMembershipId: nextValue
            }))
          }
          options={filters.ownerOptions}
          searchPlaceholder="Search owner name"
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
          label={field.label}
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
        <FilterField className={getReportSearchFieldClassName(field.key)} key={field.key} label={field.label}>
          <TextInput
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                buyerTenant: event.target.value
              }))
            }
            placeholder="Buyer / Tenant"
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
          label={field.label}
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
          label={field.label}
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
          label={field.label}
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
          label={field.label}
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
          label={field.label}
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
        <FilterField className={getReportSearchFieldClassName(field.key)} key={field.key} label={field.label}>
          <TextInput
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                invoiceNumber: event.target.value
              }))
            }
            placeholder="Invoice Number"
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
          label={field.label}
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
          label={field.label}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              teamLeaderMembershipIds: nextValue
            }))
          }
          options={filters.teamLeaderOptions}
          searchPlaceholder="Search team leader"
          value={searchFilters.teamLeaderMembershipIds}
        />
      );
    }

    if (field.key === "transaction_type") {
      return (
        <CompactChecklistMultiSelectField
          className={getReportSearchFieldClassName(field.key)}
          key={field.key}
          label={field.label}
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
          label={field.label}
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
          label={field.label}
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
        <FilterField className={getReportSearchFieldClassName(field.key)} key={field.key} label={field.label}>
          <SelectInput
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                companyReferral: event.target.value as ReportSearchFilterState["companyReferral"]
              }))
            }
            value={searchFilters.companyReferral}
          >
            <option value="">Any</option>
            {filters.companyReferralOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
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
            <strong>No report fields configured</strong>
            <p>
              {canManageSearchLayout
                ? "Use Edit fields to choose which report filters should stay visible for this office."
                : "An office admin can enable report search fields for this workspace."}
            </p>
          </div>
        )}

        <div className="office-report-search-controls">
          <FilterField className="office-report-search-field office-report-search-field-sort" label="Sort By">
            <SelectInput
              onChange={(event) =>
                updateFilters((current) => ({
                  ...current,
                  sortBy: event.target.value as ReportSearchFilterState["sortBy"]
                }))
              }
              value={searchFilters.sortBy}
            >
              <option value="created_at">Creation Date</option>
              <option value="asking_price">Asking Price</option>
              <option value="purchased_price">Purchased Price</option>
              <option value="gross_commission">Gross Commission</option>
              <option value="status">Status</option>
            </SelectInput>
          </FilterField>

          <FilterField className="office-report-search-field office-report-search-field-direction" label="Direction">
            <SelectInput
              onChange={(event) =>
                updateFilters((current) => ({
                  ...current,
                  sortDirection: event.target.value as ReportSearchFilterState["sortDirection"]
                }))
              }
              value={searchFilters.sortDirection}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </SelectInput>
          </FilterField>

          <div className="office-filter-actions office-report-search-field office-report-search-field-actions">
            {canManageSearchLayout ? (
              <Button
                onClick={() => setIsSearchLayoutModalOpen(true)}
                type="button"
                variant="secondary"
              >
                Edit fields
              </Button>
            ) : null}
            <Button type="submit">Apply filters</Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              Reset
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
