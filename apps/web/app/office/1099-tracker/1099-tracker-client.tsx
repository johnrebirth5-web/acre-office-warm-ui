"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ConfirmActionDialog,
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  HorizontalScrollArea,
  ListPageFilters,
  ListPageSection,
  ListPageStack,
  StatusBadge,
  TextInput
} from "@acre/ui";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import type { Office1099TrackerWorkspaceSnapshot } from "@acre/db";

type Office1099TrackerClientProps = {
  snapshot: Office1099TrackerWorkspaceSnapshot;
};

type RecordsFilterState = {
  membershipId: string;
  taxYear: string;
};

type DraftPaymentRecord = {
  localId: string;
  id?: string;
  paymentDate: string;
  paymentAmount: string;
  memo: string;
};

type MemberOption = Office1099TrackerWorkspaceSnapshot["filters"]["memberOptions"][number];
type PersistedPaymentRecord = {
  id: string;
  paymentDate: string;
  paymentAmountValue: string;
  memo: string;
};
type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function build1099TrackerHref(
  pathname: string,
  filters: {
    tab: "records" | "summary";
    taxYear: string;
    membershipId?: string;
  }
) {
  const searchParams = new URLSearchParams();
  searchParams.set("tab", filters.tab);

  const normalizedTaxYear = filters.taxYear.trim();

  if (normalizedTaxYear) {
    searchParams.set("taxYear", normalizedTaxYear);
  }

  if (filters.tab === "records" && filters.membershipId?.trim()) {
    searchParams.set("membershipId", filters.membershipId.trim());
  }

  return `${pathname}?${searchParams.toString()}`;
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function getAgentSearchRank(option: MemberOption, query: string) {
  if (!query) {
    return 0;
  }

  const normalizedLabel = normalizeSearchValue(option.label);

  if (normalizedLabel === query) {
    return 0;
  }

  if (normalizedLabel.startsWith(query)) {
    return 1;
  }

  if (normalizedLabel.includes(` ${query}`)) {
    return 2;
  }

  if (normalizedLabel.includes(query)) {
    return 3;
  }

  return Number.POSITIVE_INFINITY;
}

function resolveTypedMembershipId(options: MemberOption[], membershipId: string, searchValue: string) {
  if (membershipId.trim()) {
    return membershipId.trim();
  }

  const normalizedQuery = normalizeSearchValue(searchValue);

  if (!normalizedQuery) {
    return "";
  }

  const exactMatch = options.find((option) => normalizeSearchValue(option.label) === normalizedQuery);
  return exactMatch?.id ?? "";
}

function createDraftPaymentRecord(
  record?: PersistedPaymentRecord
): DraftPaymentRecord {
  const persistedId = record?.id?.trim();

  return {
    localId: persistedId || `payment-${Math.random().toString(36).slice(2, 10)}`,
    ...(persistedId ? { id: persistedId } : {}),
    paymentDate: record?.paymentDate ?? "",
    paymentAmount: record?.paymentAmountValue ?? "",
    memo: record?.memo ?? ""
  };
}

function buildDraftSignature(records: DraftPaymentRecord[]) {
  return records.map((record) => `${record.id?.trim() ?? ""}:${record.paymentDate}:${record.paymentAmount.trim()}:${record.memo.trim()}`).join("|");
}

function toNumber(value: string) {
  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function validateDraftRecords(records: DraftPaymentRecord[]) {
  for (const [index, record] of records.entries()) {
    if (!record.paymentDate.trim()) {
      return `Payment record ${index + 1} date is required.`;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.paymentDate.trim())) {
      return `Payment record ${index + 1} date must use YYYY-MM-DD format.`;
    }

    if (!record.paymentAmount.trim()) {
      return `Payment record ${index + 1} amount is required.`;
    }

    const normalizedAmount = record.paymentAmount.replaceAll(",", "").replace(/\$/g, "").trim();

    if (!/^[+-]?(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/.test(normalizedAmount)) {
      return `Payment record ${index + 1} amount must be a signed number with up to 2 decimal places.`;
    }
  }

  return "";
}

function normalizeTaxYearInput(value: string) {
  const trimmed = value.trim();
  return /^\d{4}$/.test(trimmed) ? trimmed : String(new Date().getFullYear());
}

export function Office1099TrackerClient({ snapshot }: Office1099TrackerClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const agentListboxId = useId();
  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const [recordsFilterState, setRecordsFilterState] = useState<RecordsFilterState>({
    membershipId: snapshot.filters.membershipId,
    taxYear: String(snapshot.filters.taxYear)
  });
  const [summaryTaxYear, setSummaryTaxYear] = useState(String(snapshot.filters.taxYear));
  const [agentSearchValue, setAgentSearchValue] = useState(
    snapshot.filters.memberOptions.find((option) => option.id === snapshot.filters.membershipId)?.label ?? ""
  );
  const deferredAgentSearchValue = useDeferredValue(agentSearchValue);
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [highlightedAgentIndex, setHighlightedAgentIndex] = useState(0);
  const [draftRecords, setDraftRecords] = useState<DraftPaymentRecord[]>(
    snapshot.recordsEditor ? snapshot.recordsEditor.rows.map((row) => createDraftPaymentRecord(row)) : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRoutingPending, setIsRoutingPending] = useState(false);
  const [filterError, setFilterError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const normalizedAgentSearchValue = normalizeSearchValue(deferredAgentSearchValue);
  const filteredAgentOptions = snapshot.filters.memberOptions
    .map((option) => ({
      option,
      rank: getAgentSearchRank(option, normalizedAgentSearchValue)
    }))
    .filter((entry) => entry.rank !== Number.POSITIVE_INFINITY)
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.option.label.localeCompare(right.option.label);
    })
    .slice(0, 8)
    .map((entry) => entry.option);
  const activeDescendantId =
    isAgentPickerOpen && filteredAgentOptions[highlightedAgentIndex]
      ? `${agentListboxId}-${filteredAgentOptions[highlightedAgentIndex].id}`
      : undefined;
  const resolvedFilterMembershipId = resolveTypedMembershipId(
    snapshot.filters.memberOptions,
    recordsFilterState.membershipId,
    agentSearchValue
  );
  const selectedEditorSignature = snapshot.recordsEditor
    ? buildDraftSignature(snapshot.recordsEditor.rows.map((row) => createDraftPaymentRecord(row)))
    : "";
  const draftSignature = buildDraftSignature(draftRecords);
  const hasUnsavedChanges = selectedEditorSignature !== draftSignature;
  const draftTotal = draftRecords.reduce((sum, record) => sum + toNumber(record.paymentAmount), 0);

  useEffect(() => {
    setRecordsFilterState({
      membershipId: snapshot.filters.membershipId,
      taxYear: String(snapshot.filters.taxYear)
    });
    setSummaryTaxYear(String(snapshot.filters.taxYear));
    setDraftRecords(snapshot.recordsEditor ? snapshot.recordsEditor.rows.map((row) => createDraftPaymentRecord(row)) : []);
    setSubmitError("");
    setFilterError("");
    setIsRoutingPending(false);
  }, [snapshot.filters.membershipId, snapshot.filters.taxYear, snapshot.recordsEditor]);

  useEffect(() => {
    const nextLabel = snapshot.filters.memberOptions.find((option) => option.id === snapshot.filters.membershipId)?.label ?? "";
    setAgentSearchValue(nextLabel);
    setIsAgentPickerOpen(false);
    setHighlightedAgentIndex(0);
  }, [snapshot.filters.memberOptions, snapshot.filters.membershipId]);

  useEffect(() => {
    if (highlightedAgentIndex < filteredAgentOptions.length) {
      return;
    }

    setHighlightedAgentIndex(filteredAgentOptions.length > 0 ? filteredAgentOptions.length - 1 : 0);
  }, [filteredAgentOptions, highlightedAgentIndex]);

  useEffect(() => {
    if (!isAgentPickerOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (agentPickerRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsAgentPickerOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isAgentPickerOpen]);

  function setDraftRecordField(localId: string, field: keyof Omit<DraftPaymentRecord, "localId" | "id">, value: string) {
    setDraftRecords((current) =>
      current.map((record) => (record.localId === localId ? { ...record, [field]: value } : record))
    );
  }

  function selectAgentOption(option: MemberOption) {
    setRecordsFilterState((current) => ({
      ...current,
      membershipId: option.id
    }));
    setAgentSearchValue(option.label);
    setIsAgentPickerOpen(false);
    setHighlightedAgentIndex(0);
    setFilterError("");
  }

  function handleRoute(nextHref: string) {
    setIsRoutingPending(true);
    startTransition(() => router.push(nextHref));
  }

  function handleAddLineItem() {
    setDraftRecords((current) => [...current, createDraftPaymentRecord()]);
  }

  function handleRemoveLineItem(localId: string) {
    setConfirmDialog({
      title: "Remove payment record line?",
      description: "This removes the line from the current draft. Unsaved changes will not affect the saved records until you click Save payment records.",
      confirmLabel: "Remove line",
      onConfirm: () => {
        setDraftRecords((current) => current.filter((record) => record.localId !== localId));
        setConfirmDialog(null);
      }
    });
  }

  function resetDraftRecords() {
    setConfirmDialog({
      title: "Reset unsaved payment record changes?",
      description: "This restores the current agent and tax year to the last saved version.",
      confirmLabel: "Reset changes",
      onConfirm: () => {
        setDraftRecords(snapshot.recordsEditor ? snapshot.recordsEditor.rows.map((row) => createDraftPaymentRecord(row)) : []);
        setSubmitError("");
        setActionNotice("");
        setConfirmDialog(null);
      }
    });
  }

  async function handleSaveRecords() {
    setSubmitError("");
    setActionNotice("");

    if (!snapshot.recordsEditor) {
      setSubmitError("Load an agent before saving payment records.");
      return;
    }

    const validationError = validateDraftRecords(draftRecords);

    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/office/1099-tracker/records", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          membershipId: snapshot.recordsEditor.membershipId,
          taxYear: snapshot.recordsEditor.taxYear,
          records: draftRecords.map((record) => ({
            ...(record.id ? { id: record.id } : {}),
            paymentDate: record.paymentDate,
            paymentAmount: record.paymentAmount,
            memo: record.memo
          }))
        })
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save payment records.");
      }

      setActionNotice("Payment records saved.");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save payment records.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleApplyRecordsFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilterError("");

    if (!resolvedFilterMembershipId) {
      setFilterError(agentSearchValue.trim() ? "Pick one agent from the search results to continue." : "Choose an agent to load payment records.");
      return;
    }

    handleRoute(
      build1099TrackerHref(pathname, {
        tab: "records",
        membershipId: resolvedFilterMembershipId,
        taxYear: normalizeTaxYearInput(recordsFilterState.taxYear)
      })
    );
  }

  function handleResetRecordsFilters() {
    setAgentSearchValue("");
    setRecordsFilterState({
      membershipId: "",
      taxYear: String(new Date().getFullYear())
    });
    setFilterError("");
    handleRoute(
      build1099TrackerHref(pathname, {
        tab: "records",
        taxYear: String(new Date().getFullYear())
      })
    );
  }

  function handleApplySummaryFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleRoute(
      build1099TrackerHref(pathname, {
        tab: "summary",
        taxYear: normalizeTaxYearInput(summaryTaxYear)
      })
    );
  }

  function handleResetSummaryFilters() {
    const currentYear = String(new Date().getFullYear());
    setSummaryTaxYear(currentYear);
    handleRoute(
      build1099TrackerHref(pathname, {
        tab: "summary",
        taxYear: currentYear
      })
    );
  }

  const tabs = useMemo(
    () => [
      {
        key: "records" as const,
        label: "Payment Record",
        href: build1099TrackerHref(pathname, {
          tab: "records",
          membershipId: snapshot.filters.membershipId,
          taxYear: String(snapshot.filters.taxYear)
        })
      },
      {
        key: "summary" as const,
        label: "1099 Summary / Preview",
        href: build1099TrackerHref(pathname, {
          tab: "summary",
          taxYear: String(snapshot.filters.taxYear)
        })
      }
    ],
    [pathname, snapshot.filters.membershipId, snapshot.filters.taxYear]
  );

  return (
    <>
      <ListPageStack>
        <section className="office-section-card office-1099-tracker-tabs-card">
          <div aria-label="1099 Tracker tabs" className="office-profile-basics-tabs" role="tablist">
            {tabs.map((tab) => (
              <Link
                aria-selected={snapshot.tab === tab.key}
                className={snapshot.tab === tab.key ? "office-profile-basics-tab is-active" : "office-profile-basics-tab"}
                href={tab.href}
                key={tab.key}
                role="tab"
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </section>

        {snapshot.tab === "records" ? (
          <ListPageSection
            subtitle="Choose an agent and tax year, then save the full set of payment records as one editable annual batch."
            title="Payment Record"
          >
            <form onSubmit={handleApplyRecordsFilters}>
              <ListPageFilters>
                <FilterField label="Agent">
                  <div className="office-autocomplete" ref={agentPickerRef}>
                    <TextInput
                      aria-activedescendant={activeDescendantId}
                      aria-autocomplete="list"
                      aria-controls={agentListboxId}
                      aria-expanded={isAgentPickerOpen}
                      onChange={(event) => {
                        setAgentSearchValue(event.target.value);
                        setRecordsFilterState((current) => ({
                          ...current,
                          membershipId: ""
                        }));
                        setHighlightedAgentIndex(0);
                        setIsAgentPickerOpen(true);
                      }}
                      onFocus={() => setIsAgentPickerOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setIsAgentPickerOpen(true);
                          setHighlightedAgentIndex((current) =>
                            filteredAgentOptions.length === 0 ? 0 : Math.min(current + 1, filteredAgentOptions.length - 1)
                          );
                          return;
                        }

                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setIsAgentPickerOpen(true);
                          setHighlightedAgentIndex((current) => Math.max(current - 1, 0));
                          return;
                        }

                        if (event.key === "Enter" && isAgentPickerOpen && filteredAgentOptions[highlightedAgentIndex]) {
                          event.preventDefault();
                          selectAgentOption(filteredAgentOptions[highlightedAgentIndex]);
                          return;
                        }

                        if (event.key === "Escape") {
                          setIsAgentPickerOpen(false);
                        }
                      }}
                      placeholder="Type agent name"
                      role="combobox"
                      type="search"
                      value={agentSearchValue}
                    />

                    {isAgentPickerOpen ? (
                      <div className="office-autocomplete-panel" id={agentListboxId} role="listbox">
                        {filteredAgentOptions.length > 0 ? (
                          filteredAgentOptions.map((option, index) => (
                            <button
                              aria-selected={recordsFilterState.membershipId === option.id}
                              className={[
                                "office-autocomplete-option",
                                highlightedAgentIndex === index ? "is-active" : "",
                                recordsFilterState.membershipId === option.id ? "is-selected" : ""
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              id={`${agentListboxId}-${option.id}`}
                              key={option.id}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectAgentOption(option);
                              }}
                              role="option"
                              type="button"
                            >
                              <span>{option.label}</span>
                              {recordsFilterState.membershipId === option.id ? <strong>Selected</strong> : null}
                            </button>
                          ))
                        ) : (
                          <div className="office-autocomplete-empty">No matching agents.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </FilterField>

                <FilterField label="Tax Year">
                  <TextInput
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) =>
                      setRecordsFilterState((current) => ({
                        ...current,
                        taxYear: event.target.value.replace(/[^\d]/g, "").slice(0, 4)
                      }))
                    }
                    placeholder="2026"
                    value={recordsFilterState.taxYear}
                  />
                </FilterField>

                <div className="office-filter-actions">
                  <Button disabled={isRoutingPending} type="submit" variant="secondary">
                    {isRoutingPending ? "Loading..." : "Load records"}
                  </Button>
                  <Button onClick={handleResetRecordsFilters} type="button" variant="secondary">
                    Reset
                  </Button>
                </div>
              </ListPageFilters>
            </form>

            {filterError ? <p className="office-inline-error">{filterError}</p> : null}

            {!filterError && !snapshot.recordsEditor ? (
              <p className="office-form-helper">
                {agentSearchValue.trim()
                  ? "Pick one agent from the search results to continue."
                  : "Choose an agent to load payment records for the selected tax year."}
              </p>
            ) : null}

            {snapshot.recordsEditor ? (
              <div className="office-accounting-candidate-workspace">
                <div className="office-accounting-candidate-block">
                  <div className="office-accounting-candidate-head">
                    <div className="office-accounting-candidate-copy">
                      <span className="office-mini-heading">Selected agent</span>
                      <p className="office-form-helper">
                        {snapshot.recordsEditor.displayName}
                        {snapshot.recordsEditor.payeeName ? ` · Payee: ${snapshot.recordsEditor.payeeName}` : " · Payee name missing"}
                      </p>
                    </div>
                  </div>

                  {snapshot.recordsEditor.missingProfileFields.length > 0 ? (
                    <div className="office-1099-warning">
                      <StatusBadge tone="warning">Profile warning</StatusBadge>
                      <p>
                        Missing profile fields: {snapshot.recordsEditor.missingProfileFields.join(", ")}. Preview and PDF export stay
                        available, but the missing values will remain blank.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="office-accounting-candidate-block office-accounting-manual-section">
                  <div className="office-accounting-candidate-head">
                    <div className="office-accounting-candidate-copy">
                      <span className="office-mini-heading">Payment lines</span>
                      <p className="office-form-helper">
                        Save every payment made to this agent for tax year {snapshot.recordsEditor.taxYear}. You can freely add, edit, or
                        remove line items.
                      </p>
                    </div>

                    <div className="office-section-actions">
                      <Button onClick={handleAddLineItem} size="sm" type="button" variant="secondary">
                        Add Line Item
                      </Button>
                    </div>
                  </div>

                  {draftRecords.length > 0 ? (
                    <HorizontalScrollArea>
                      <DataTable className="office-table">
                        <DataTableHeader className="office-table-header office-table-row office-table-row-1099-records">
                          <span>Payment Date</span>
                          <span>Payment Amount</span>
                          <span>Memo</span>
                          <span>Actions</span>
                        </DataTableHeader>
                        <DataTableBody>
                          {draftRecords.map((record, index) => (
                            <DataTableRow className="office-table-row office-table-row-1099-records" key={record.localId}>
                              <TextInput
                                aria-label={`Payment date ${index + 1}`}
                                onChange={(event) => setDraftRecordField(record.localId, "paymentDate", event.target.value)}
                                type="date"
                                value={record.paymentDate}
                              />
                              <TextInput
                                aria-label={`Payment amount ${index + 1}`}
                                className="office-accounting-manual-amount-input"
                                inputMode="decimal"
                                onChange={(event) => setDraftRecordField(record.localId, "paymentAmount", event.target.value)}
                                placeholder="1250.00"
                                value={record.paymentAmount}
                              />
                              <TextInput
                                aria-label={`Payment memo ${index + 1}`}
                                onChange={(event) => setDraftRecordField(record.localId, "memo", event.target.value)}
                                placeholder="ACH payout"
                                value={record.memo}
                              />
                              <div className="office-accounting-manual-row-actions">
                                <Button onClick={() => handleRemoveLineItem(record.localId)} size="sm" type="button" variant="ghost">
                                  Remove
                                </Button>
                              </div>
                            </DataTableRow>
                          ))}
                        </DataTableBody>
                      </DataTable>
                    </HorizontalScrollArea>
                  ) : (
                    <p className="office-form-helper">No payment records saved for this agent and tax year yet.</p>
                  )}

                  <div className="office-1099-total-row">
                    <span>Total Paid</span>
                    <strong>{formatCurrency(draftTotal)}</strong>
                  </div>

                  {submitError ? <p className="office-inline-error">{submitError}</p> : null}
                  {actionNotice ? <p className="office-form-helper">{actionNotice}</p> : null}

                  <div className="office-section-actions office-1099-record-actions">
                    <Button disabled={isSaving || !hasUnsavedChanges} onClick={handleSaveRecords} type="button">
                      {isSaving ? "Saving..." : "Save payment records"}
                    </Button>
                    <Button disabled={!hasUnsavedChanges || isSaving} onClick={resetDraftRecords} type="button" variant="secondary">
                      Reset changes
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </ListPageSection>
        ) : (
          <ListPageSection
            subtitle="Review each agent's annual payout total, preview the backup summary, and export a PDF for internal 1099 support."
            title="1099 Summary / Preview"
          >
            <form onSubmit={handleApplySummaryFilters}>
              <ListPageFilters>
                <FilterField label="Tax Year">
                  <TextInput
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) => setSummaryTaxYear(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                    placeholder="2026"
                    value={summaryTaxYear}
                  />
                </FilterField>

                <div className="office-filter-actions">
                  <Button disabled={isRoutingPending} type="submit" variant="secondary">
                    {isRoutingPending ? "Loading..." : "Load summary"}
                  </Button>
                  <Button onClick={handleResetSummaryFilters} type="button" variant="secondary">
                    Reset
                  </Button>
                </div>
              </ListPageFilters>
            </form>

            {snapshot.summaryRows.length > 0 ? (
              <HorizontalScrollArea>
                <DataTable className="office-table">
                  <DataTableHeader className="office-table-header office-table-row office-table-row-1099-summary">
                    <span>Name</span>
                    <span>Amount</span>
                    <span>Tax ID (SSN / EIN)</span>
                    <span>Contact Number</span>
                    <span>Address</span>
                    <span>Email</span>
                    <span>Action</span>
                  </DataTableHeader>
                  <DataTableBody>
                    {snapshot.summaryRows.map((row) => (
                      <DataTableRow className="office-table-row office-table-row-1099-summary" key={row.membershipId}>
                        <div className="office-list-table-cell-stack">
                          <strong>{row.name}</strong>
                          {row.name !== row.agentLabel ? <p>{row.agentLabel}</p> : null}
                          {row.missingProfileFields.length > 0 ? (
                            <p className="office-1099-warning-copy">Missing: {row.missingProfileFields.join(", ")}</p>
                          ) : null}
                        </div>
                        <span>{row.totalPaidLabel}</span>
                        <span>{row.taxIdLabel}</span>
                        <span>{row.contactNumber}</span>
                        <span className="office-list-table-wrap-cell">{row.address}</span>
                        <span className="office-list-table-wrap-cell">{row.email}</span>
                        <div className="office-1099-summary-actions">
                          <Link
                            className="office-button office-button-sm office-button-secondary"
                            href={`/office/1099-tracker/preview/${row.membershipId}?taxYear=${snapshot.filters.taxYear}`}
                          >
                            Preview
                          </Link>
                          <a
                            className="office-button office-button-sm office-button-secondary"
                            href={`/api/office/1099-tracker/summary/${row.membershipId}/pdf?taxYear=${snapshot.filters.taxYear}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Export PDF
                          </a>
                        </div>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </HorizontalScrollArea>
            ) : (
              <EmptyState
                description="No payment records have been saved for the selected tax year yet."
                title="No 1099 summary rows"
              />
            )}
          </ListPageSection>
        )}
      </ListPageStack>

      <ConfirmActionDialog
        confirmLabel={confirmDialog?.confirmLabel}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => confirmDialog?.onConfirm()}
        title={confirmDialog?.title ?? ""}
      />
    </>
  );
}
