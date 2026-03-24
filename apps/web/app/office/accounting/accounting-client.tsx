"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { OfficeAgentPayoutStatementsWorkspaceSnapshot } from "@acre/db";
import {
  Button,
  CheckboxField,
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
  ListPageStatsGrid,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput
} from "@acre/ui";

type OfficeAccountingClientProps = {
  snapshot: OfficeAgentPayoutStatementsWorkspaceSnapshot;
};

type FilterState = {
  membershipId: string;
  periodStart: string;
  periodEnd: string;
  periodBasis: "calculated_at" | "closing_date";
};

type AgentOption = OfficeAgentPayoutStatementsWorkspaceSnapshot["filters"]["memberOptions"][number];
type SelectedStatementDetail = NonNullable<OfficeAgentPayoutStatementsWorkspaceSnapshot["selectedStatement"]>;
type StatementBankField = {
  label: string;
  value: string;
  wide?: boolean;
};

function buildAccountingHref(
  pathname: string,
  filters: FilterState & {
    statementId?: string;
  }
) {
  const searchParams = new URLSearchParams();

  if (filters.membershipId.trim()) {
    searchParams.set("membershipId", filters.membershipId.trim());
  }

  if (filters.periodStart.trim()) {
    searchParams.set("periodStart", filters.periodStart.trim());
  }

  if (filters.periodEnd.trim()) {
    searchParams.set("periodEnd", filters.periodEnd.trim());
  }

  if (filters.periodBasis.trim()) {
    searchParams.set("periodBasis", filters.periodBasis.trim());
  }

  if (filters.statementId?.trim()) {
    searchParams.set("statementId", filters.statementId.trim());
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getStatementStatusTone(status: string) {
  if (status === "Paid") {
    return "success" as const;
  }

  if (status === "Payable" || status === "Statement ready") {
    return "accent" as const;
  }

  if (status === "Reviewed") {
    return "neutral" as const;
  }

  return "warning" as const;
}

function toNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function getAgentSearchRank(option: AgentOption, query: string) {
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

function resolveTypedAgentMembershipId(options: AgentOption[], membershipId: string, searchValue: string) {
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

function buildStatementBankFields(statement: SelectedStatementDetail): StatementBankField[] {
  const bankInformation = statement.bankInformation;

  if (!bankInformation) {
    return [];
  }

  return [
    { label: "First name", value: bankInformation.firstName },
    { label: "Last name", value: bankInformation.lastName },
    { label: "Email", value: bankInformation.email },
    { label: "Phone number", value: bankInformation.phoneNumber },
    { label: "Address", value: bankInformation.address, wide: true },
    { label: "Bank name", value: bankInformation.bankName },
    { label: "Account number", value: bankInformation.accountNumber },
    { label: "Routing number", value: bankInformation.routingNumber },
    {
      label: "SSN / EIN",
      value: [bankInformation.taxIdTypeLabel, bankInformation.taxIdValue].filter(Boolean).join(" · ")
    },
    { label: "Date of birth", value: bankInformation.dateOfBirth },
    { label: "Account type", value: bankInformation.accountTypeLabel || bankInformation.accountType }
  ].filter((field) => field.value.trim().length > 0);
}

function formatStatementCellValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : "—";
}

export function OfficeAccountingClient({ snapshot }: OfficeAccountingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const agentListboxId = useId();
  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const candidateRowKey = snapshot.candidateRows.map((row) => row.id).join("|");
  const [filterState, setFilterState] = useState<FilterState>({
    membershipId: snapshot.filters.membershipId,
    periodStart: snapshot.filters.periodStart,
    periodEnd: snapshot.filters.periodEnd,
    periodBasis: snapshot.filters.periodBasis
  });
  const [agentSearchValue, setAgentSearchValue] = useState(
    snapshot.filters.memberOptions.find((option) => option.id === snapshot.filters.membershipId)?.label ?? ""
  );
  const deferredAgentSearchValue = useDeferredValue(agentSearchValue);
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [highlightedAgentIndex, setHighlightedAgentIndex] = useState(0);
  const [selectedCalculationIds, setSelectedCalculationIds] = useState<string[]>(snapshot.candidateRows.map((row) => row.id));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [filterError, setFilterError] = useState("");
  const [generationError, setGenerationError] = useState("");
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

  useEffect(() => {
    setFilterState({
      membershipId: snapshot.filters.membershipId,
      periodStart: snapshot.filters.periodStart,
      periodEnd: snapshot.filters.periodEnd,
      periodBasis: snapshot.filters.periodBasis
    });
    setIsPreviewLoading(false);
  }, [snapshot.filters.membershipId, snapshot.filters.periodBasis, snapshot.filters.periodEnd, snapshot.filters.periodStart]);

  useEffect(() => {
    const nextLabel = snapshot.filters.memberOptions.find((option) => option.id === snapshot.filters.membershipId)?.label ?? "";
    setAgentSearchValue(nextLabel);
    setIsAgentPickerOpen(false);
    setHighlightedAgentIndex(0);
  }, [snapshot.filters.memberOptions, snapshot.filters.membershipId]);

  useEffect(() => {
    setSelectedCalculationIds(snapshot.candidateRows.map((row) => row.id));
  }, [candidateRowKey, snapshot.candidateRows]);

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

  const selectedIdLookup = new Set(selectedCalculationIds);
  const selectedRows = snapshot.candidateRows.filter((row) => selectedIdLookup.has(row.id));
  const selectedStatement = snapshot.selectedStatement;
  const selectedStatementBankFields = selectedStatement ? buildStatementBankFields(selectedStatement) : [];
  const selectedSummary = selectedRows.reduce(
    (summary, row) => ({
      count: summary.count + 1,
      gross: summary.gross + toNumber(row.grossCommissionValue),
      fees: summary.fees + toNumber(row.feesValue),
      payout: summary.payout + toNumber(row.statementAmountValue)
    }),
    {
      count: 0,
      gross: 0,
      fees: 0,
      payout: 0
    }
  );
  const resolvedFilterMembershipId = resolveTypedAgentMembershipId(
    snapshot.filters.memberOptions,
    filterState.membershipId,
    agentSearchValue
  );
  const hasFilterAgent = resolvedFilterMembershipId.trim().length > 0;
  const hasFilterDateWindow = filterState.periodStart.trim().length > 0 && filterState.periodEnd.trim().length > 0;
  const hasFilterDateOrder = !hasFilterDateWindow || filterState.periodStart.trim() <= filterState.periodEnd.trim();
  const canLoadCandidates = hasFilterAgent && hasFilterDateWindow && hasFilterDateOrder;
  const hasValidRange = filterState.membershipId.trim() && filterState.periodStart.trim() && filterState.periodEnd.trim();

  function selectAgentOption(option: AgentOption) {
    setFilterState((current) => ({ ...current, membershipId: option.id }));
    setAgentSearchValue(option.label);
    setIsAgentPickerOpen(false);
    setHighlightedAgentIndex(0);
    setFilterError("");
  }

  function handleAgentSearchChange(value: string) {
    setAgentSearchValue(value);
    setFilterState((current) => {
      const currentOption = snapshot.filters.memberOptions.find((option) => option.id === current.membershipId);

      return {
        ...current,
        membershipId: currentOption && currentOption.label === value ? current.membershipId : ""
      };
    });
    setIsAgentPickerOpen(true);
    setHighlightedAgentIndex(0);
    setFilterError("");
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilterError("");

    const resolvedMembershipId = resolvedFilterMembershipId;

    if (agentSearchValue.trim() && !resolvedMembershipId) {
      setFilterError("Select an agent from the search results before loading candidates.");
      return;
    }

    if (!filterState.periodStart.trim() || !filterState.periodEnd.trim()) {
      setFilterError("Choose both a period start and period end date before loading candidates.");
      return;
    }

    if (filterState.periodStart.trim() > filterState.periodEnd.trim()) {
      setFilterError("Period start must be on or before period end.");
      return;
    }

    setFilterState((current) => ({ ...current, membershipId: resolvedMembershipId }));
    setIsPreviewLoading(true);

    startTransition(() => {
      router.push(
        buildAccountingHref(pathname, {
          membershipId: resolvedMembershipId,
          periodStart: filterState.periodStart,
          periodEnd: filterState.periodEnd,
          periodBasis: filterState.periodBasis
        })
      );
      setIsPreviewLoading(false);
    });
  }

  function resetFilters() {
    setFilterError("");
    setGenerationError("");
    setFilterState({
      membershipId: "",
      periodStart: "",
      periodEnd: "",
      periodBasis: "calculated_at"
    });
    setAgentSearchValue("");
    setIsAgentPickerOpen(false);
    setHighlightedAgentIndex(0);
    setIsPreviewLoading(false);
    startTransition(() => {
      router.push(pathname);
    });
  }

  function toggleCandidate(calculationId: string, checked: boolean) {
    setSelectedCalculationIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(calculationId);
      } else {
        next.delete(calculationId);
      }

      return [...next];
    });
  }

  function toggleAllCandidates(checked: boolean) {
    setSelectedCalculationIds(checked ? snapshot.candidateRows.map((row) => row.id) : []);
  }

  async function handleGenerateStatement() {
    if (!canLoadCandidates) {
      setFilterError("Choose one agent and a valid statement date range before generating.");
      return;
    }

    setIsGenerating(true);
    setGenerationError("");
    setFilterError("");

    const resolvedMembershipId = resolvedFilterMembershipId;

    try {
      const response = await fetch("/api/office/accounting/statements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          membershipId: resolvedMembershipId,
          periodStart: filterState.periodStart,
          periodEnd: filterState.periodEnd,
          periodBasis: filterState.periodBasis,
          commissionCalculationIds:
            snapshot.filters.membershipId === resolvedMembershipId &&
            snapshot.filters.periodStart === filterState.periodStart &&
            snapshot.filters.periodEnd === filterState.periodEnd &&
            snapshot.filters.periodBasis === filterState.periodBasis &&
            selectedCalculationIds.length > 0
              ? selectedCalculationIds
              : []
        })
      });
      const body = (await response.json().catch(() => null)) as { error?: string; statementId?: string } | null;

      if (!response.ok || !body?.statementId) {
        throw new Error(body?.error ?? "Failed to generate the agent statement.");
      }

      startTransition(() => {
        router.push(
          buildAccountingHref(pathname, {
            membershipId: resolvedMembershipId,
            periodStart: filterState.periodStart,
            periodEnd: filterState.periodEnd,
            periodBasis: filterState.periodBasis,
            statementId: body.statementId
          })
        );
        router.refresh();
      });
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Failed to generate the agent statement.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <ListPageStack className="office-accounting-statements-stack">
      <ListPageSection
        subtitle="Pick an agent and date window, then generate the statement directly. Use preview only if you want to inspect or uncheck rows first."
        title="Statement filters"
      >
        <ListPageFilters as="form" className="office-report-filters office-list-filters" onSubmit={handleApplyFilters}>
          <FilterField label="Agent">
            <div className="office-autocomplete" ref={agentPickerRef}>
              <TextInput
                aria-activedescendant={activeDescendantId}
                aria-autocomplete="list"
                aria-controls={agentListboxId}
                aria-expanded={isAgentPickerOpen}
                autoComplete="off"
                onChange={(event) => handleAgentSearchChange(event.target.value)}
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
                        aria-selected={filterState.membershipId === option.id}
                        className={[
                          "office-autocomplete-option",
                          highlightedAgentIndex === index ? "is-active" : "",
                          filterState.membershipId === option.id ? "is-selected" : ""
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
                        {filterState.membershipId === option.id ? <strong>Selected</strong> : null}
                      </button>
                    ))
                  ) : (
                    <div className="office-autocomplete-empty">No matching agents.</div>
                  )}
                </div>
              ) : null}
            </div>
          </FilterField>

          <FilterField label="Period start">
            <TextInput onChange={(event) => setFilterState((current) => ({ ...current, periodStart: event.target.value }))} type="date" value={filterState.periodStart} />
          </FilterField>

          <FilterField label="Period end">
            <TextInput onChange={(event) => setFilterState((current) => ({ ...current, periodEnd: event.target.value }))} type="date" value={filterState.periodEnd} />
          </FilterField>

          <FilterField label="Period basis">
            <SelectInput onChange={(event) => setFilterState((current) => ({ ...current, periodBasis: event.target.value as FilterState["periodBasis"] }))} value={filterState.periodBasis}>
              <option value="calculated_at">Calculated date</option>
              <option value="closing_date">Closing date</option>
            </SelectInput>
          </FilterField>

          <div className="office-filter-actions">
            <Button disabled={isGenerating || !canLoadCandidates} onClick={handleGenerateStatement} type="button">
              {isGenerating ? "Generating..." : "Generate statement"}
            </Button>
            <Button disabled={isPreviewLoading || !canLoadCandidates} type="submit" variant="secondary">
              {isPreviewLoading ? "Loading..." : "Preview candidates"}
            </Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              Reset
            </Button>
          </div>
        </ListPageFilters>

        {filterError ? <p className="office-inline-error">{filterError}</p> : null}

        {!filterError && !canLoadCandidates ? (
          <p className="office-form-helper">
            {!hasFilterAgent && agentSearchValue.trim()
              ? "Pick one agent from the search results to continue."
              : !hasFilterAgent
                ? "Choose an agent to continue."
                : !hasFilterDateWindow
                  ? "Choose both period dates to load candidates."
                  : "Period start must be on or before period end."}
          </p>
        ) : null}

        {snapshot.filters.periodBasis === "closing_date" && snapshot.skippedMissingClosingDateCount > 0 ? (
          <p className="office-form-helper">
            {snapshot.skippedMissingClosingDateCount} eligible row(s) were skipped because the linked transaction does not have a closing date yet.
          </p>
        ) : null}
      </ListPageSection>

      <ListPageSection
        actions={
          snapshot.candidateRows.length > 0 ? (
            <div className="office-section-actions">
              <Button onClick={() => toggleAllCandidates(true)} size="sm" type="button" variant="secondary">
                Select all
              </Button>
              <Button onClick={() => toggleAllCandidates(false)} size="sm" type="button" variant="ghost">
                Clear
              </Button>
            </div>
          ) : null
        }
        subtitle="Preview the unpaid agent commission rows that would be used for this statement if you want to review them before generating."
        title="Candidate rows"
      >
        {hasValidRange ? (
          snapshot.candidateRows.length > 0 ? (
            <HorizontalScrollArea>
              <DataTable className="office-table">
                <DataTableHeader className="office-table-header office-table-row office-table-row-ledger">
                  <span>Select</span>
                  <span>Transaction</span>
                  <span>Closing</span>
                  <span>Calculated</span>
                  <span>Gross</span>
                  <span>Fees</span>
                  <span>Payout</span>
                  <span>Status</span>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.candidateRows.map((row) => (
                    <DataTableRow className="office-table-row office-table-row-ledger" key={row.id}>
                      <CheckboxField label="">
                        <input
                          checked={selectedIdLookup.has(row.id)}
                          onChange={(event) => toggleCandidate(row.id, event.target.checked)}
                          type="checkbox"
                        />
                      </CheckboxField>
                      <div className="office-table-primary">
                        <strong>
                          <Link href={row.transactionHref}>{row.transactionLabel}</Link>
                        </strong>
                        <p>{row.propertyAddress}</p>
                      </div>
                      <span>{row.closingDate || "Missing"}</span>
                      <span>{row.calculatedAt}</span>
                      <span>{row.grossCommissionLabel}</span>
                      <span>{row.feesLabel}</span>
                      <span>{row.statementAmountLabel}</span>
                      <span>
                        <StatusBadge tone={getStatementStatusTone(row.status)}>{row.status}</StatusBadge>
                      </span>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </HorizontalScrollArea>
          ) : (
            <EmptyState
              description="No eligible unpaid agent commission rows matched the current agent and period settings."
              title="No payout candidates"
            />
          )
        ) : (
          <EmptyState
            description="Choose an agent plus a valid start and end date to load payout candidates."
            title="Set a statement window"
          />
        )}
      </ListPageSection>

      <ListPageSection
        actions={
          <Button disabled={isGenerating || selectedSummary.count === 0 || !hasValidRange} onClick={handleGenerateStatement} type="button">
            {isGenerating ? "Generating..." : "Generate statement"}
          </Button>
        }
        subtitle="Selection is reset to all loaded candidates whenever the current filter window changes."
        title="Selected payout summary"
      >
        <ListPageStatsGrid>
          <StatCard hint="currently selected rows" label="Selected rows" value={selectedSummary.count} />
          <StatCard hint="sum of selected gross commission" label="Gross commission" value={formatCurrency(selectedSummary.gross)} />
          <StatCard hint="sum of selected fees" label="Fees" value={formatCurrency(selectedSummary.fees)} />
          <StatCard hint="sum of selected payout rows" label="Net payout" value={formatCurrency(selectedSummary.payout)} />
        </ListPageStatsGrid>

        {generationError ? <p className="office-inline-error">{generationError}</p> : null}
      </ListPageSection>

      <ListPageSection subtitle="Saved payout statements stay durable, so PDF downloads always rebuild from the same saved snapshot." title="Statement history">
        {snapshot.history.length > 0 ? (
          <HorizontalScrollArea>
            <DataTable className="office-table">
              <DataTableHeader className="office-table-header office-table-row office-table-row-ledger">
                <span>Generated</span>
                <span>Agent</span>
                <span>Period</span>
                <span>Basis</span>
                <span>Rows</span>
                <span>Total payout</span>
                <span>Actions</span>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.history.map((statement) => (
                  <DataTableRow className="office-table-row office-table-row-ledger" key={statement.id}>
                    <span>{statement.generatedAtLabel}</span>
                    <strong>{statement.agentLabel}</strong>
                    <span>{statement.periodLabel}</span>
                    <span>{statement.periodBasisLabel}</span>
                    <span>{statement.lineItemCount}</span>
                    <span>{statement.totalStatementAmountLabel}</span>
                    <div className="bm-accounting-inline-actions">
                      <Button
                        onClick={() =>
                          startTransition(() => {
                            router.push(
                              buildAccountingHref(pathname, {
                                membershipId: snapshot.filters.membershipId,
                                periodStart: snapshot.filters.periodStart,
                                periodEnd: snapshot.filters.periodEnd,
                                periodBasis: snapshot.filters.periodBasis,
                                statementId: statement.id
                              })
                            );
                          })
                        }
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Open
                      </Button>
                      <a className="office-button office-button-sm" href={`/api/office/accounting/statements/${statement.id}/pdf`} rel="noreferrer" target="_blank">
                        PDF
                      </a>
                    </div>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </HorizontalScrollArea>
        ) : (
          <EmptyState description="Generated statements will appear here once a payout snapshot has been saved." title="No saved statements yet" />
        )}
      </ListPageSection>

      <ListPageSection
        subtitle={
          selectedStatement
            ? `${selectedStatement.periodBasisLabel} · ${selectedStatement.periodLabel}`
            : "Select a saved statement to review the durable line-item snapshot and download its PDF."
        }
        title={selectedStatement ? "Statement detail" : "Select a statement"}
      >
        {selectedStatement ? (
          <>
            <ListPageStatsGrid>
              <StatCard hint="agent on this saved payout statement" label="Agent" value={selectedStatement.agentLabel} />
              <StatCard hint="saved snapshot row count" label="Rows" value={selectedStatement.lineItemCount} />
              <StatCard hint="snapshot total gross commission" label="Gross commission" value={selectedStatement.totalGrossCommissionLabel} />
              <StatCard hint="snapshot total payout amount" label="Net payout" value={selectedStatement.totalStatementAmountLabel} />
            </ListPageStatsGrid>

            <div className="office-inline-meta">
              <span>Generated: {selectedStatement.generatedAtLabel}</span>
              <span>Generated by: {selectedStatement.generatedByLabel}</span>
              <a className="office-button office-button-sm office-button-secondary" href={`/api/office/accounting/statements/${selectedStatement.id}/pdf`} rel="noreferrer" target="_blank">
                Download PDF
              </a>
            </div>

            {selectedStatementBankFields.length > 0 ? (
              <div className="office-detail-grid">
                {selectedStatementBankFields.map((field) => (
                  <div className={field.wide ? "office-detail-field office-detail-field-wide" : "office-detail-field"} key={field.label}>
                    <span>{field.label}</span>
                    <strong>{field.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="office-form-helper">No bank information has been saved on this member profile yet.</p>
            )}

            <HorizontalScrollArea>
              <DataTable className="office-table">
                <DataTableHeader className="office-table-header office-table-row office-table-row-agent-statement-detail">
                  <span>Creation date</span>
                  <span>Invoice number</span>
                  <span>Owner</span>
                  <span>Building name</span>
                  <span>Unit</span>
                  <span>Gross</span>
                  <span>Pre split</span>
                  <span>Commission rate</span>
                  <span>Post split</span>
                  <span>Net commission</span>
                </DataTableHeader>
                <DataTableBody>
                  {selectedStatement.lineItems.map((lineItem) => (
                    <DataTableRow className="office-table-row office-table-row-agent-statement-detail" key={lineItem.id}>
                      <span>{formatStatementCellValue(lineItem.creationDate)}</span>
                      <span>{formatStatementCellValue(lineItem.invoiceNumber)}</span>
                      <span>{formatStatementCellValue(lineItem.ownerName)}</span>
                      <div className="office-agent-statement-building">
                        <strong>
                          <Link href={lineItem.transactionHref}>{formatStatementCellValue(lineItem.buildingName || lineItem.transactionLabel)}</Link>
                        </strong>
                        <p>{formatStatementCellValue(lineItem.propertyAddress)}</p>
                      </div>
                      <span>{formatStatementCellValue(lineItem.unitNumber)}</span>
                      <span>{lineItem.grossCommissionLabel}</span>
                      <span>{lineItem.preSplitLabel}</span>
                      <span>{formatStatementCellValue(lineItem.commissionRate)}</span>
                      <span>{lineItem.postSplitLabel}</span>
                      <span>{lineItem.netCommissionLabel}</span>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </HorizontalScrollArea>
          </>
        ) : (
          <EmptyState description="Use the history list to open a saved statement and inspect its locked payout lines." title="No statement selected" />
        )}
      </ListPageSection>
    </ListPageStack>
  );
}
