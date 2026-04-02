"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Button,
  CheckboxField,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  ListPageFilters,
  ListPageFooter,
  SelectInput,
  StatusBadge,
  SummaryChip,
  TextInput
} from "@acre/ui";
import type {
  OfficeFieldModuleSettingsSnapshot,
  OfficeTransactionRecord,
  OfficeTransactionIntakeSchema,
  OfficeTransactionOwnerAssignment,
  OfficeTransactionSearchFieldDescriptor,
  OfficeTransactionSearchLayoutSnapshot,
  OfficeTransactionSummary
} from "@acre/db";
import {
  OfficeListPagePagination,
  OfficeListPageTemplate
} from "../_components/office-list-page-template";
import {
  buildTransactionSchemaFromModuleSnapshot,
  cloneFieldModuleSnapshot,
  TransactionCreatePageClient
} from "./new/transaction-create-page-client";
import type { TransactionStatusFieldPolicy } from "./transaction-status-rules";

type TransactionsClientProps = {
  transactions: OfficeTransactionRecord[];
  summary: OfficeTransactionSummary;
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  searchLayout: OfficeTransactionSearchLayoutSnapshot;
  canManageSearchLayout: boolean;
  transactionFieldModule: OfficeFieldModuleSettingsSnapshot;
  transactionOwnerAssignment: OfficeTransactionOwnerAssignment;
  transactionStatusFieldPolicy: TransactionStatusFieldPolicy;
};

type SearchFilterState = {
  system: OfficeTransactionSearchLayoutSnapshot["filters"]["system"];
  builtin: OfficeTransactionSearchLayoutSnapshot["filters"]["builtin"];
  custom: OfficeTransactionSearchLayoutSnapshot["filters"]["custom"];
};

type SearchLayoutResponse = {
  snapshot?: OfficeTransactionSearchLayoutSnapshot;
  error?: string;
};

const pageSizeOptions = [10, 20, 50, 100] as const;
const statusValueLabelMap: Record<string, string> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

function getTransactionStatusTone(status: OfficeTransactionRecord["status"]) {
  if (status === "Pending") {
    return "warning" as const;
  }

  if (status === "Closed") {
    return "success" as const;
  }

  if (status === "Cancelled") {
    return "danger" as const;
  }

  if (status === "Active") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function formatTransactionPriceCell(value: string) {
  return value || "—";
}

function buildSearchFieldId(field: Pick<OfficeTransactionSearchFieldDescriptor, "kind" | "key">) {
  return `${field.kind}:${field.key}`;
}

function buildEmptyFieldFilterValue() {
  return {
    value: "",
    from: "",
    to: ""
  };
}

function cloneFilterState(filters: OfficeTransactionSearchLayoutSnapshot["filters"]): SearchFilterState {
  return {
    system: {
      q: filters.system.q,
      ownerMembershipId: filters.system.ownerMembershipId,
      teamId: filters.system.teamId,
      createdAt: {
        from: filters.system.createdAt.from,
        to: filters.system.createdAt.to
      }
    },
    builtin: Object.fromEntries(
      Object.entries(filters.builtin).map(([key, value]) => [
        key,
        {
          value: value.value,
          from: value.from,
          to: value.to
        }
      ])
    ),
    custom: Object.fromEntries(
      Object.entries(filters.custom).map(([key, value]) => [
        key,
        {
          value: value.value,
          from: value.from,
          to: value.to
        }
      ])
    )
  };
}

function buildLayoutSelectionState(
  availableFields: OfficeTransactionSearchLayoutSnapshot["availableFields"],
  selectedFields: OfficeTransactionSearchLayoutSnapshot["selectedFields"]
) {
  const selectedIds = new Set(selectedFields.map((field) => buildSearchFieldId(field)));

  return Object.fromEntries(
    availableFields.map((field) => [buildSearchFieldId(field), selectedIds.has(buildSearchFieldId(field))])
  ) as Record<string, boolean>;
}

function getFieldEmptyOptionLabel(field: OfficeTransactionSearchFieldDescriptor) {
  if (field.emptyOptionLabel) {
    return field.emptyOptionLabel;
  }

  if (field.kind === "system" && field.key === "owner") {
    return "All owners";
  }

  if (field.kind === "system" && field.key === "team") {
    return "All teams";
  }

  return `Any ${field.label.toLowerCase()}`;
}

function buildTransactionsHref(
  pathname: string,
  input: {
    selectedFields: OfficeTransactionSearchFieldDescriptor[];
    filters: SearchFilterState;
    page: number;
    pageSize: number;
  }
) {
  const searchParams = new URLSearchParams();
  const selectedFieldIds = new Set(input.selectedFields.map((field) => buildSearchFieldId(field)));

  if (selectedFieldIds.has("system:search") && input.filters.system.q.trim()) {
    searchParams.set("q", input.filters.system.q.trim());
  }

  if (selectedFieldIds.has("system:owner") && input.filters.system.ownerMembershipId.trim()) {
    searchParams.set("ownerMembershipId", input.filters.system.ownerMembershipId.trim());
  }

  if (selectedFieldIds.has("system:team") && input.filters.system.teamId.trim()) {
    searchParams.set("teamId", input.filters.system.teamId.trim());
  }

  if (selectedFieldIds.has("system:created_at")) {
    if (input.filters.system.createdAt.from.trim()) {
      searchParams.set("startDate", input.filters.system.createdAt.from.trim());
    }

    if (input.filters.system.createdAt.to.trim()) {
      searchParams.set("endDate", input.filters.system.createdAt.to.trim());
    }
  }

  for (const field of input.selectedFields) {
    if (field.kind === "system") {
      continue;
    }

    const source = field.kind === "builtin" ? input.filters.builtin : input.filters.custom;
    const filterValue = source[field.key] ?? buildEmptyFieldFilterValue();

    if (field.kind === "builtin" && field.key === "transaction_status") {
      const statusLabel = statusValueLabelMap[filterValue.value];

      if (statusLabel) {
        searchParams.set("status", statusLabel);
      }

      continue;
    }

    if (field.kind === "builtin" && field.key === "transaction_type") {
      if (filterValue.value.trim()) {
        searchParams.set("type", filterValue.value.trim());
      }

      continue;
    }

    const baseKey = field.kind === "builtin" ? `field_${field.key}` : `custom_${field.key}`;

    if (field.control === "date") {
      if (filterValue.from.trim()) {
        searchParams.set(`${baseKey}_from`, filterValue.from.trim());
      }

      if (filterValue.to.trim()) {
        searchParams.set(`${baseKey}_to`, filterValue.to.trim());
      }

      continue;
    }

    if (filterValue.value.trim()) {
      searchParams.set(baseKey, filterValue.value.trim());
    }
  }

  if (input.page > 1) {
    searchParams.set("page", String(input.page));
  }

  if (input.pageSize !== 20) {
    searchParams.set("pageSize", String(input.pageSize));
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getFieldFilterValue(
  field: OfficeTransactionSearchFieldDescriptor,
  filters: SearchFilterState
) {
  if (field.kind === "builtin") {
    return filters.builtin[field.key] ?? buildEmptyFieldFilterValue();
  }

  if (field.kind === "custom") {
    return filters.custom[field.key] ?? buildEmptyFieldFilterValue();
  }

  return buildEmptyFieldFilterValue();
}

function getSearchLayoutFieldHint(field: OfficeTransactionSearchFieldDescriptor) {
  if (field.kind === "system" && field.key === "search") {
    return "Global keyword search across transactions, contacts, and owner names.";
  }

  if (field.kind === "system" && field.key === "created_at") {
    return "Office-level transaction creation date range.";
  }

  if (field.control === "date") {
    return "Date range filter with From and To values.";
  }

  if (field.control === "select") {
    return "Dropdown filter using the current configured options.";
  }

  return "Text filter with partial matching.";
}

function SearchDateRangeField(props: {
  label: string;
  value: { from: string; to: string };
  onChange: (nextValue: { from: string; to: string }) => void;
}) {
  return (
    <FilterField className="office-transaction-search-date-field" label={props.label}>
      <div className="office-transaction-search-date-range">
        <label className="office-transaction-search-date-input">
          <span>From</span>
          <TextInput
            onChange={(event) =>
              props.onChange({
                from: event.target.value,
                to: props.value.to
              })
            }
            type="date"
            value={props.value.from}
          />
        </label>
        <label className="office-transaction-search-date-input">
          <span>To</span>
          <TextInput
            onChange={(event) =>
              props.onChange({
                from: props.value.from,
                to: event.target.value
              })
            }
            type="date"
            value={props.value.to}
          />
        </label>
      </div>
    </FilterField>
  );
}

function TransactionSearchLayoutModal(props: {
  isOpen: boolean;
  availableFields: OfficeTransactionSearchLayoutSnapshot["availableFields"];
  layoutSelection: Record<string, boolean>;
  isSaving: boolean;
  error: string;
  onToggleField: (fieldId: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!props.isOpen) {
    return null;
  }

  const groups: Array<OfficeTransactionSearchFieldDescriptor["groupLabel"]> = [
    "Operational",
    "Built-in",
    "Custom"
  ];

  return (
    <div className="office-modal-overlay" onClick={() => !props.isSaving && props.onClose()}>
      <section
        aria-label="Edit transaction search fields"
        aria-modal="true"
        className="office-fields-modal office-transaction-search-layout-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="office-fields-modal-head office-transaction-search-layout-head">
          <div>
            <h3>Edit search fields</h3>
            <p>Choose which transaction fields appear in the shared office search workbench.</p>
          </div>
          <Button
            aria-label="Close search field editor"
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
                      ? "Shared workbench filters that are not part of the transaction field schema."
                      : group === "Built-in"
                        ? "Visible built-in transaction fields from Settings > Fields."
                        : "Visible custom transaction fields from Settings > Fields."}
                  </p>
                </div>
                <div className="office-transaction-search-layout-list">
                  {groupFields.map((field) => {
                    const fieldId = buildSearchFieldId(field);

                    return (
                      <div
                        className="office-fields-modal-checkbox office-transaction-search-layout-checkbox"
                        key={fieldId}
                      >
                        <CheckboxField className="office-transaction-search-layout-checkbox-field" label={field.label}>
                          <input
                            checked={Boolean(props.layoutSelection[fieldId])}
                            disabled={props.isSaving}
                            onChange={() => props.onToggleField(fieldId)}
                            type="checkbox"
                          />
                        </CheckboxField>
                        <small>{getSearchLayoutFieldHint(field)}</small>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="office-fields-modal-footer office-transaction-search-layout-footer">
          {props.error ? <p className="office-inline-error office-transaction-search-layout-error">{props.error}</p> : null}
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

export function TransactionsClient({
  transactions,
  summary,
  totalCount,
  totalPages,
  page,
  pageSize,
  searchLayout,
  canManageSearchLayout,
  transactionFieldModule,
  transactionOwnerAssignment,
  transactionStatusFieldPolicy
}: TransactionsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSearchLayoutModalOpen, setIsSearchLayoutModalOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [createFieldModule, setCreateFieldModule] = useState<OfficeFieldModuleSettingsSnapshot>(
    () => cloneFieldModuleSnapshot(transactionFieldModule)
  );
  const [searchFilters, setSearchFilters] = useState<SearchFilterState>(() =>
    cloneFilterState(searchLayout.filters)
  );
  const [layoutSelection, setLayoutSelection] = useState<Record<string, boolean>>(() =>
    buildLayoutSelectionState(searchLayout.availableFields, searchLayout.selectedFields)
  );
  const [layoutSaveError, setLayoutSaveError] = useState("");
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isCreateModalOpen || isSearchLayoutModalOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateModalOpen, isSearchLayoutModalOpen]);

  useEffect(() => {
    setSearchFilters(cloneFilterState(searchLayout.filters));
    setLayoutSelection(buildLayoutSelectionState(searchLayout.availableFields, searchLayout.selectedFields));
    setLayoutSaveError("");
    setIsSavingLayout(false);
  }, [searchLayout]);

  useEffect(() => {
    setCreateFieldModule(cloneFieldModuleSnapshot(transactionFieldModule));
  }, [transactionFieldModule]);

  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
  const createSchema = useMemo<OfficeTransactionIntakeSchema>(
    () => buildTransactionSchemaFromModuleSnapshot(createFieldModule),
    [createFieldModule]
  );
  const selectedDraftFields = useMemo(
    () =>
      searchLayout.availableFields.filter((field) => layoutSelection[buildSearchFieldId(field)]),
    [layoutSelection, searchLayout.availableFields]
  );

  function updateSystemFilters(
    updater: (current: SearchFilterState["system"]) => SearchFilterState["system"]
  ) {
    setSearchFilters((current) => ({
      ...current,
      system: updater(current.system)
    }));
  }

  function updateNamedFieldFilter(
    kind: "builtin" | "custom",
    key: string,
    updater: (
      currentValue: {
        value: string;
        from: string;
        to: string;
      }
    ) => {
      value: string;
      from: string;
      to: string;
    }
  ) {
    setSearchFilters((current) => {
      const currentMap = current[kind];
      return {
        ...current,
        [kind]: {
          ...currentMap,
          [key]: updater(currentMap[key] ?? buildEmptyFieldFilterValue())
        }
      };
    });
  }

  function navigateWithFilters(nextSelectedFields: OfficeTransactionSearchLayoutSnapshot["selectedFields"], nextPage: number, nextPageSize: number) {
    router.push(
      buildTransactionsHref(pathname, {
        selectedFields: nextSelectedFields,
        filters: searchFilters,
        page: nextPage,
        pageSize: nextPageSize
      })
    );
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateWithFilters(searchLayout.selectedFields, 1, pageSize);
  }

  function resetFilters() {
    setSearchFilters({
      system: {
        q: "",
        ownerMembershipId: "",
        teamId: "",
        createdAt: {
          from: "",
          to: ""
        }
      },
      builtin: Object.fromEntries(
        searchLayout.availableFields
          .filter((field) => field.kind === "builtin")
          .map((field) => [field.key, buildEmptyFieldFilterValue()])
      ),
      custom: Object.fromEntries(
        searchLayout.availableFields
          .filter((field) => field.kind === "custom")
          .map((field) => [field.key, buildEmptyFieldFilterValue()])
      )
    });
    router.push(pathname);
  }

  function handlePageSizeChange(nextPageSize: number) {
    navigateWithFilters(searchLayout.selectedFields, 1, nextPageSize);
  }

  function toggleLayoutField(fieldId: string) {
    setLayoutSelection((current) => ({
      ...current,
      [fieldId]: !current[fieldId]
    }));
  }

  async function handleSaveSearchLayout() {
    setIsSavingLayout(true);
    setLayoutSaveError("");

    try {
      const response = await fetch("/api/office/transactions/search-layout", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: selectedDraftFields.map((field) => ({
            kind: field.kind,
            key: field.key
          }))
        })
      });
      const body = (await response.json().catch(() => null)) as SearchLayoutResponse | null;

      if (!response.ok || !body?.snapshot) {
        throw new Error(body?.error ?? "Failed to save search fields.");
      }

      setIsSearchLayoutModalOpen(false);
      setLayoutSelection(buildLayoutSelectionState(body.snapshot.availableFields, body.snapshot.selectedFields));

      const nextHref = buildTransactionsHref(pathname, {
        selectedFields: body.snapshot.selectedFields,
        filters: searchFilters,
        page: 1,
        pageSize
      });
      const currentHref = buildTransactionsHref(pathname, {
        selectedFields: searchLayout.selectedFields,
        filters: searchFilters,
        page,
        pageSize
      });

      if (nextHref === currentHref) {
        router.refresh();
      } else {
        router.push(nextHref);
      }
    } catch (error) {
      setLayoutSaveError(error instanceof Error ? error.message : "Failed to save search fields.");
    } finally {
      setIsSavingLayout(false);
    }
  }

  function renderSearchField(field: OfficeTransactionSearchFieldDescriptor) {
    if (field.kind === "system" && field.key === "search") {
      return (
        <FilterField className="office-transactions-search" key={buildSearchFieldId(field)} label={field.label}>
          <TextInput
            aria-label="Search transactions"
            onChange={(event) =>
              updateSystemFilters((current) => ({
                ...current,
                q: event.target.value
              }))
            }
            placeholder={field.placeholder}
            value={searchFilters.system.q}
          />
        </FilterField>
      );
    }

    if (field.kind === "system" && field.key === "owner") {
      return (
        <FilterField key={buildSearchFieldId(field)} label={field.label}>
          <SelectInput
            onChange={(event) =>
              updateSystemFilters((current) => ({
                ...current,
                ownerMembershipId: event.target.value
              }))
            }
            value={searchFilters.system.ownerMembershipId}
          >
            <option value="">{getFieldEmptyOptionLabel(field)}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </FilterField>
      );
    }

    if (field.kind === "system" && field.key === "team") {
      return (
        <FilterField key={buildSearchFieldId(field)} label={field.label}>
          <SelectInput
            onChange={(event) =>
              updateSystemFilters((current) => ({
                ...current,
                teamId: event.target.value
              }))
            }
            value={searchFilters.system.teamId}
          >
            <option value="">{getFieldEmptyOptionLabel(field)}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </FilterField>
      );
    }

    if (field.kind === "system" && field.key === "created_at") {
      return (
        <SearchDateRangeField
          key={buildSearchFieldId(field)}
          label={field.label}
          onChange={(nextValue) =>
            updateSystemFilters((current) => ({
              ...current,
              createdAt: nextValue
            }))
          }
          value={searchFilters.system.createdAt}
        />
      );
    }

    if (field.kind === "system") {
      return null;
    }

    const fieldKind = field.kind;
    const filterValue = getFieldFilterValue(field, searchFilters);

    if (field.control === "date") {
      return (
        <SearchDateRangeField
          key={buildSearchFieldId(field)}
          label={field.label}
          onChange={(nextValue) =>
            updateNamedFieldFilter(fieldKind, field.key, () => ({
              value: "",
              from: nextValue.from,
              to: nextValue.to
            }))
          }
          value={{
            from: filterValue.from,
            to: filterValue.to
          }}
        />
      );
    }

    if (field.control === "select") {
      return (
        <FilterField key={buildSearchFieldId(field)} label={field.label}>
          <SelectInput
            onChange={(event) =>
              updateNamedFieldFilter(fieldKind, field.key, (current) => ({
                ...current,
                value: event.target.value
              }))
            }
            value={filterValue.value}
          >
            <option value="">{getFieldEmptyOptionLabel(field)}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </FilterField>
      );
    }

    return (
      <FilterField key={buildSearchFieldId(field)} label={field.label}>
        <TextInput
          onChange={(event) =>
            updateNamedFieldFilter(fieldKind, field.key, (current) => ({
              ...current,
              value: event.target.value
            }))
          }
          placeholder={field.placeholder}
          value={filterValue.value}
        />
      </FilterField>
    );
  }

  const transactionFilters = (
    <ListPageFilters
      as="form"
      className="office-transactions-toolbar office-transaction-search-layout-filters"
      onSubmit={handleApplyFilters}
    >
      {searchLayout.selectedFields.length ? (
        searchLayout.selectedFields.map((field) => renderSearchField(field))
      ) : (
        <div className="office-transaction-search-empty">
          <strong>No search fields configured</strong>
          <p>
            {canManageSearchLayout
              ? "Use Edit fields to choose which filters should appear for this office."
              : "An office admin can enable transaction search fields for this workspace."}
          </p>
        </div>
      )}

      <div className="office-filter-actions">
        <Button type="submit">Apply filters</Button>
        <Button onClick={resetFilters} type="button" variant="secondary">
          Reset
        </Button>
      </div>
    </ListPageFilters>
  );

  const transactionFooter = (
    <ListPageFooter
      controls={
        <OfficeListPagePagination
          nextHref={
            page < totalPages
              ? buildTransactionsHref(pathname, {
                  selectedFields: searchLayout.selectedFields,
                  filters: searchFilters,
                  page: page + 1,
                  pageSize
                })
              : undefined
          }
          onPageSizeChange={handlePageSizeChange}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          previousHref={
            page > 1
              ? buildTransactionsHref(pathname, {
                  selectedFields: searchLayout.selectedFields,
                  filters: searchFilters,
                  page: page - 1,
                  pageSize
                })
              : undefined
          }
          totalPages={totalPages}
        />
      }
      summary={`${pageStart}-${pageEnd} of ${totalCount}`}
    />
  );

  const transactionSummary = (
    <>
      <SummaryChip label="Transactions" value={summary.totalCount} />
      <SummaryChip
        label={summary.totalNetIncomeLabel}
        tone="accent"
        value={summary.totalNetIncome}
      />
      <div className="office-page-summary-action">
        <Button onClick={() => setIsCreateModalOpen(true)} type="button">
          Create transaction
        </Button>
      </div>
    </>
  );

  return (
    <>
      <OfficeListPageTemplate
        className="office-transactions-page"
        description="Operational transaction list with office-shared, configurable search fields and query-driven drill-down."
        eyebrow="Transactions"
        filters={transactionFilters}
        footer={transactionFooter}
        sectionActions={
          canManageSearchLayout ? (
            <Button
              onClick={() => setIsSearchLayoutModalOpen(true)}
              size="sm"
              type="button"
              variant="secondary"
            >
              Edit fields
            </Button>
          ) : null
        }
        sectionSubtitle="Search, filter, and review the current office transaction set."
        sectionTitle="Transaction list"
        summary={transactionSummary}
        summaryClassName="office-transactions-page-actions"
        title="Transactions"
      >
        <DataTable className="office-list-table office-transactions-list-shell">
          <DataTableHeader className="office-list-table-header office-list-table-header-transactions">
            <span />
            <span>Transaction</span>
            <span>Asking / Purchased</span>
            <span>Owner</span>
            <span>Representing</span>
            <span>Status</span>
            <span>Important date</span>
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {transactions.map((transaction) => (
              <DataTableRow
                className="office-list-table-row office-list-table-row-transactions"
                key={transaction.id}
              >
                <span
                  className={`office-transaction-home-icon${transaction.isFlagged ? " is-flagged" : ""}`}
                >
                  <svg
                    aria-hidden="true"
                    className="office-transaction-home-icon-svg"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M10.552 3.516a1.75 1.75 0 0 1 2.896 0l6.75 9.247a.75.75 0 0 1-.607 1.192H18.5v1.795A2.25 2.25 0 0 1 16.25 18h-1.5v-3.75a.75.75 0 0 0-.75-.75h-4a.75.75 0 0 0-.75.75V18h-1.5A2.25 2.25 0 0 1 5.5 15.75v-1.795H4.409a.75.75 0 0 1-.607-1.192l6.75-9.247Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <div className="office-list-table-main">
                  <strong className={transaction.isFlagged ? "is-flagged" : ""}>
                    <Link href={`/office/transactions/${transaction.id}`}>
                      {transaction.address}
                    </Link>
                  </strong>
                </div>
                <div className="office-list-table-main">
                  <strong>{formatTransactionPriceCell(transaction.askingPrice)}</strong>
                  <p>{formatTransactionPriceCell(transaction.purchasedPrice)}</p>
                </div>
                <span>{transaction.owner}</span>
                <span>{transaction.representing}</span>
                <StatusBadge
                  className="office-list-table-status office-transaction-status-badge"
                  tone={getTransactionStatusTone(transaction.status)}
                >
                  {transaction.status}
                </StatusBadge>
                <span>{transaction.importantDate || "—"}</span>
              </DataTableRow>
            ))}

            {transactions.length === 0 ? (
              <EmptyState
                description="Try widening the search or adjusting the visible filter fields."
                title="No transactions matched the current filters"
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </OfficeListPageTemplate>

      <TransactionSearchLayoutModal
        availableFields={searchLayout.availableFields}
        error={layoutSaveError}
        isOpen={isSearchLayoutModalOpen}
        isSaving={isSavingLayout}
        layoutSelection={layoutSelection}
        onClose={() => !isSavingLayout && setIsSearchLayoutModalOpen(false)}
        onSave={handleSaveSearchLayout}
        onToggleField={toggleLayoutField}
      />

      {isCreateModalOpen ? (
        <div className="office-modal-overlay office-create-modal-overlay">
          <section
            className="office-modal office-create-modal office-transaction-create-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <TransactionCreatePageClient
              afterSubmit="refresh"
              canManageFields={canManageSearchLayout}
              key={formVersion}
              mode="modal"
              modalDescription="Open a new office transaction using the current intake schema, assign the owner, and capture structured finance details from the start."
              modalEyebrow="Transactions"
              modalFooterDescription="The record is created with the active office schema so the pipeline, reporting, and finance views all start from the same structure."
              modalFooterTitle="Create a clean transaction record"
              onClose={() => setIsCreateModalOpen(false)}
              onSubmitted={() => {
                setIsCreateModalOpen(false);
                setFormVersion((current) => current + 1);
                router.push(
                  buildTransactionsHref(pathname, {
                    selectedFields: searchLayout.selectedFields,
                    filters: searchFilters,
                    page: 1,
                    pageSize
                  })
                );
              }}
              initialFieldModule={createFieldModule}
              initialSchema={createSchema}
              onFieldModuleChange={(nextModule) => {
                setCreateFieldModule(cloneFieldModuleSnapshot(nextModule));
              }}
              ownerAssignment={transactionOwnerAssignment}
              statusFieldPolicy={transactionStatusFieldPolicy}
              submitLabel="Next →"
              title="Create transaction"
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
