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
    <div className="bm-modal-overlay" onClick={() => !props.isSaving && props.onClose()}>
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
          <button
            aria-label="Close report search field editor"
            className="office-fields-modal-close"
            disabled={props.isSaving}
            onClick={props.onClose}
            type="button"
          >
            ×
          </button>
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
            <p className="bm-inline-error office-transaction-search-layout-error">{props.error}</p>
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
  onChange: (nextValue: {
    operator: ReportSearchFilterState["createdAtOperator"];
    value: string;
    from: string;
    to: string;
  }) => void;
}) {
  return (
    <FilterField className="office-report-search-layout-field" label={props.label}>
      <div className="office-report-search-layout-grid">
        <label className="office-report-search-inline-field">
          <span>Operator</span>
          <SelectInput
            onChange={(event) =>
              props.onChange({
                operator: event.target.value as ReportSearchFilterState["createdAtOperator"],
                value: props.value,
                from: props.from,
                to: props.to
              })
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
        <label className="office-report-search-inline-field">
          <span>Value</span>
          <TextInput
            onChange={(event) =>
              props.onChange({
                operator: props.operatorValue,
                value: event.target.value,
                from: props.from,
                to: props.to
              })
            }
            type="date"
            value={props.value}
          />
        </label>
        <label className="office-report-search-inline-field">
          <span>From</span>
          <TextInput
            onChange={(event) =>
              props.onChange({
                operator: props.operatorValue,
                value: props.value,
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
                operator: props.operatorValue,
                value: props.value,
                from: props.from,
                to: event.target.value
              })
            }
            type="date"
            value={props.to}
          />
        </label>
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
  onChange: (nextValue: {
    operator: ReportSearchFilterState["commissionOperator"];
    value: string;
    min: string;
    max: string;
  }) => void;
}) {
  return (
    <FilterField className="office-report-search-layout-field" label={props.label}>
      <div className="office-report-search-layout-grid">
        <label className="office-report-search-inline-field">
          <span>Operator</span>
          <SelectInput
            onChange={(event) =>
              props.onChange({
                operator: event.target.value as ReportSearchFilterState["commissionOperator"],
                value: props.value,
                min: props.min,
                max: props.max
              })
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
        <label className="office-report-search-inline-field">
          <span>Value</span>
          <TextInput
            inputMode="decimal"
            onChange={(event) =>
              props.onChange({
                operator: props.operatorValue,
                value: event.target.value,
                min: props.min,
                max: props.max
              })
            }
            placeholder="0.00"
            type="text"
            value={props.value}
          />
        </label>
        <label className="office-report-search-inline-field">
          <span>Min</span>
          <TextInput
            inputMode="decimal"
            onChange={(event) =>
              props.onChange({
                operator: props.operatorValue,
                value: props.value,
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
                operator: props.operatorValue,
                value: props.value,
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
    </FilterField>
  );
}

function CompactChecklistMultiSelectField(props: {
  label: string;
  options: OfficeTransactionReportsFilters["ownerOptions"];
  value: string[];
  onChange: (nextValue: string[]) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const summary = formatChecklistSummary(props.options, props.value);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className={`office-filter-field office-report-search-multiselect-field${props.className ? ` ${props.className}` : ""}`}
      ref={containerRef}
    >
      <span>{props.label}</span>
      <button
        aria-expanded={isOpen}
        className={`office-report-search-multiselect-trigger${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
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
              <button onClick={() => props.onChange([])} type="button">
                Clear
              </button>
            ) : null}
          </div>
          <div className="office-report-search-multiselect-options">
            {props.options.map((option) => {
              const isChecked = props.value.includes(option.id);

              return (
                <label
                  className={`office-report-search-multiselect-option${isChecked ? " is-selected" : ""}`}
                  key={option.id}
                  title={option.label}
                >
                  <input
                    checked={isChecked}
                    onChange={(event) => {
                      const nextValue = event.target.checked
                        ? [...props.value, option.id]
                        : props.value.filter((value) => value !== option.id);

                      props.onChange(nextValue);
                    }}
                    type="checkbox"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
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
        <FilterField key={field.key} label={field.label}>
          <SelectInput
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                ownerMembershipId: event.target.value
              }))
            }
            value={searchFilters.ownerMembershipId}
          >
            <option value="">All owners</option>
            {filters.ownerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </FilterField>
      );
    }

    if (field.key === "created_at") {
      return (
        <ReportSearchDateField
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
        <FilterField key={field.key} label={field.label}>
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
        <FilterField key={field.key} label={field.label}>
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
        <CompactChecklistMultiSelectField
          key={field.key}
          label={field.label}
          onChange={(nextValue) =>
            updateFilters((current) => ({
              ...current,
              teamLeaderMembershipIds: nextValue
            }))
          }
          options={filters.teamLeaderOptions}
          value={searchFilters.teamLeaderMembershipIds}
        />
      );
    }

    if (field.key === "transaction_type") {
      return (
        <CompactChecklistMultiSelectField
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
        <FilterField key={field.key} label={field.label}>
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
        className="office-transaction-search-layout-filters office-report-search-layout-filters"
        onSubmit={handleApplyFilters}
      >
        {searchLayout.selectedFields.length ? (
          searchLayout.selectedFields.map((field) => renderSearchField(field))
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

        <FilterField label="Sort By">
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

        <FilterField label="Direction">
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

        <div className="office-filter-actions">
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
