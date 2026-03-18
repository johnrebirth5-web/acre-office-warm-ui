"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { OfficeAccountingSnapshot, OfficeAgentBillingSnapshot } from "@acre/db";
import {
  Button,
  ConfirmActionDialog,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  HorizontalScrollArea,
  ListPageFilters,
  ListPageFooter,
  ListPageSection,
  ListPageSplit,
  ListPageStack,
  ListPageStatsGrid,
  ListPageTableSection,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput
} from "@acre/ui";
import { AgentBillingPanel } from "./agent-billing-panel";

type OfficeAccountingClientProps = {
  snapshot: OfficeAccountingSnapshot;
  agentBillingSnapshot: OfficeAgentBillingSnapshot | null;
  officeLabel: string;
  canManageAccounting: boolean;
  canViewAgentBilling: boolean;
  canManageAgentBilling: boolean;
  canManagePayments: boolean;
};

type AccountingTypeOption = {
  value: string;
  label: string;
  supportsLineItems: boolean;
  manualEntrySides: boolean;
};

type PaymentMethodOption = {
  value: string;
  label: string;
};

type AccountingLineItemFormState = {
  id?: string;
  ledgerAccountId: string;
  description: string;
  amount: string;
  entrySide: string;
};

type AccountingEntryFormState = {
  type: string;
  status: string;
  accountingDate: string;
  dueDate: string;
  paymentMethod: string;
  referenceNumber: string;
  counterpartyName: string;
  memo: string;
  notes: string;
  totalAmount: string;
  relatedTransactionId: string;
  relatedMembershipId: string;
  lineItems: AccountingLineItemFormState[];
};

type EarnestMoneyFormState = {
  transactionId: string;
  expectedAmount: string;
  dueAt: string;
  receivedAmount: string;
  refundedAmount: string;
  paymentDate: string;
  depositDate: string;
  heldByOffice: boolean;
  heldExternally: boolean;
  trackInLedger: boolean;
  notes: string;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

const accountingTypeOptions: AccountingTypeOption[] = [
  { value: "invoice", label: "Invoice", supportsLineItems: true, manualEntrySides: false },
  { value: "bill", label: "Bill", supportsLineItems: true, manualEntrySides: false },
  { value: "credit_memo", label: "Credit memo", supportsLineItems: true, manualEntrySides: true },
  { value: "deposit", label: "Deposit", supportsLineItems: true, manualEntrySides: false },
  { value: "received_payment", label: "Received payment", supportsLineItems: false, manualEntrySides: false },
  { value: "made_payment", label: "Made payment", supportsLineItems: false, manualEntrySides: false },
  { value: "journal_entry", label: "Journal entry", supportsLineItems: true, manualEntrySides: true },
  { value: "transfer", label: "Transfer", supportsLineItems: true, manualEntrySides: true },
  { value: "refund", label: "Refund", supportsLineItems: true, manualEntrySides: false }
];

const accountingStatusOptions = [
  { value: "", label: "Default status" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "posted", label: "Posted" },
  { value: "completed", label: "Completed" },
  { value: "void", label: "Void" }
];

const paymentMethodOptions: PaymentMethodOption[] = [
  { value: "", label: "Select method" },
  { value: "ach", label: "ACH" },
  { value: "check", label: "Check" },
  { value: "wire", label: "Wire" },
  { value: "cash", label: "Cash" },
  { value: "internal_transfer", label: "Internal transfer" },
  { value: "other", label: "Other" }
];

const accountingFilterTypeOptions = [
  { value: "", label: "All types" },
  ...accountingTypeOptions.map((option) => ({ value: option.value, label: option.label }))
];

const accountingFilterStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "posted", label: "Posted" },
  { value: "completed", label: "Completed" },
  { value: "void", label: "Void" }
];

function getAccountingStatusTone(status: string) {
  if (status === "Completed" || status === "Posted") {
    return "success" as const;
  }

  if (status === "Open") {
    return "accent" as const;
  }

  if (status === "Void") {
    return "danger" as const;
  }

  return "warning" as const;
}

function getEarnestMoneyTone(status: string) {
  if (status === "Fully deposited" || status === "Completed") {
    return "success" as const;
  }

  if (status === "Pending bank deposit" || status === "Received") {
    return "accent" as const;
  }

  if (status === "Overdue" || status === "Not received") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function createEmptyLineItem(): AccountingLineItemFormState {
  return {
    ledgerAccountId: "",
    description: "",
    amount: "",
    entrySide: "debit"
  };
}

function buildAccountingHref(
  pathname: string,
  params: {
    type: string;
    status: string;
    startDate: string;
    endDate: string;
    ownerMembershipId: string;
    q: string;
    entryId: string;
  }
) {
  const searchParams = new URLSearchParams();

  if (params.type.trim()) {
    searchParams.set("type", params.type.trim());
  }

  if (params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }

  if (params.startDate.trim()) {
    searchParams.set("startDate", params.startDate.trim());
  }

  if (params.endDate.trim()) {
    searchParams.set("endDate", params.endDate.trim());
  }

  if (params.ownerMembershipId.trim()) {
    searchParams.set("ownerMembershipId", params.ownerMembershipId.trim());
  }

  if (params.q.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.entryId.trim()) {
    searchParams.set("entryId", params.entryId.trim());
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getAccountingTypeConfig(type: string) {
  return accountingTypeOptions.find((option) => option.value === type) ?? accountingTypeOptions[0];
}

function buildEmptyEntryState(): AccountingEntryFormState {
  return {
    type: "invoice",
    status: "",
    accountingDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    paymentMethod: "",
    referenceNumber: "",
    counterpartyName: "",
    memo: "",
    notes: "",
    totalAmount: "",
    relatedTransactionId: "",
    relatedMembershipId: "",
    lineItems: [createEmptyLineItem()]
  };
}

function buildEntryStateFromSelectedEntry(snapshot: OfficeAccountingSnapshot): AccountingEntryFormState {
  const selectedEntry = snapshot.selectedTransaction;

  if (!selectedEntry) {
    return buildEmptyEntryState();
  }

  return {
    type: selectedEntry.type,
    status: selectedEntry.status,
    accountingDate: selectedEntry.accountingDate,
    dueDate: selectedEntry.dueDate,
    paymentMethod: selectedEntry.paymentMethod,
    referenceNumber: selectedEntry.referenceNumber,
    counterpartyName: selectedEntry.counterpartyName,
    memo: selectedEntry.memo,
    notes: selectedEntry.notes,
    totalAmount: selectedEntry.totalAmount,
    relatedTransactionId: selectedEntry.relatedTransactionId,
    relatedMembershipId: selectedEntry.relatedMembershipId,
    lineItems: selectedEntry.lineItems.length
      ? selectedEntry.lineItems.map((lineItem) => ({
          id: lineItem.id,
          ledgerAccountId: lineItem.ledgerAccountId,
          description: lineItem.description,
          amount: lineItem.amount,
          entrySide: lineItem.entrySide.toLowerCase()
        }))
      : [createEmptyLineItem()]
  };
}

function buildEarnestMoneyState(record?: OfficeAccountingSnapshot["earnestMoneyRecords"][number] | null): EarnestMoneyFormState {
  if (!record) {
    return {
      transactionId: "",
      expectedAmount: "",
      dueAt: "",
      receivedAmount: "",
      refundedAmount: "",
      paymentDate: "",
      depositDate: "",
      heldByOffice: true,
      heldExternally: false,
      trackInLedger: true,
      notes: ""
    };
  }

  return {
    transactionId: record.transactionId,
    expectedAmount: record.expectedAmount.replace(/[^\d.-]/g, ""),
    dueAt: record.dueAt,
    receivedAmount: record.receivedAmount.replace(/[^\d.-]/g, ""),
    refundedAmount: record.refundedAmount.replace(/[^\d.-]/g, ""),
    paymentDate: record.paymentDate,
    depositDate: record.depositDate,
    heldByOffice: record.heldByOffice,
    heldExternally: record.heldExternally,
    trackInLedger: record.trackInLedger,
    notes: record.notes
  };
}

export function OfficeAccountingClient({
  snapshot,
  agentBillingSnapshot,
  officeLabel,
  canManageAccounting,
  canViewAgentBilling,
  canManageAgentBilling,
  canManagePayments
}: OfficeAccountingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isCreateEntryOpen, setIsCreateEntryOpen] = useState(false);
  const [isEarnestMoneyOpen, setIsEarnestMoneyOpen] = useState(false);
  const [editingEarnestMoneyId, setEditingEarnestMoneyId] = useState("");
  const [entryFormState, setEntryFormState] = useState<AccountingEntryFormState>(() => buildEntryStateFromSelectedEntry(snapshot));
  const [earnestMoneyFormState, setEarnestMoneyFormState] = useState<EarnestMoneyFormState>(() => buildEarnestMoneyState(null));
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [isSavingEarnestMoney, setIsSavingEarnestMoney] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [earnestMoneyError, setEarnestMoneyError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [filterState, setFilterState] = useState({
    type: snapshot.filters.type,
    status: snapshot.filters.status,
    startDate: snapshot.filters.startDate,
    endDate: snapshot.filters.endDate,
    ownerMembershipId: snapshot.filters.ownerMembershipId,
    q: snapshot.filters.q
  });

  useEffect(() => {
    setFilterState({
      type: snapshot.filters.type,
      status: snapshot.filters.status,
      startDate: snapshot.filters.startDate,
      endDate: snapshot.filters.endDate,
      ownerMembershipId: snapshot.filters.ownerMembershipId,
      q: snapshot.filters.q
    });
  }, [
    snapshot.filters.endDate,
    snapshot.filters.ownerMembershipId,
    snapshot.filters.q,
    snapshot.filters.startDate,
    snapshot.filters.status,
    snapshot.filters.type
  ]);

  useEffect(() => {
    setEntryFormState(buildEntryStateFromSelectedEntry(snapshot));
  }, [snapshot.selectedTransaction]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash;
    if (hash !== "#commissions" && hash !== "#commission-management") {
      return;
    }

    const nextQuery = searchParams.toString();
    router.replace(nextQuery ? `/office/settings/commission-plans?${nextQuery}` : "/office/settings/commission-plans");
  }, [router, searchParams]);

  const selectedEntryConfig = getAccountingTypeConfig(entryFormState.type);
  const entryModalConfig = getAccountingTypeConfig(entryFormState.type);

  function navigateWithFilters(overrides: Partial<typeof filterState> & { entryId?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const href = buildAccountingHref(pathname, {
      type: overrides.type ?? filterState.type,
      status: overrides.status ?? filterState.status,
      startDate: overrides.startDate ?? filterState.startDate,
      endDate: overrides.endDate ?? filterState.endDate,
      ownerMembershipId: overrides.ownerMembershipId ?? filterState.ownerMembershipId,
      q: overrides.q ?? filterState.q,
      entryId: overrides.entryId ?? snapshot.filters.entryId
    });

    const nextUrl = new URL(href, "http://localhost");
    params.delete("type");
    params.delete("status");
    params.delete("startDate");
    params.delete("endDate");
    params.delete("ownerMembershipId");
    params.delete("q");
    params.delete("entryId");

    nextUrl.searchParams.forEach((value, key) => {
      params.set(key, value);
    });

    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function resetFilters() {
    setFilterState({
      type: "",
      status: "",
      startDate: "",
      endDate: "",
      ownerMembershipId: "",
      q: ""
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("type");
    params.delete("status");
    params.delete("startDate");
    params.delete("endDate");
    params.delete("ownerMembershipId");
    params.delete("q");
    params.delete("entryId");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function updateEntryField<K extends keyof AccountingEntryFormState>(key: K, value: AccountingEntryFormState[K]) {
    setEntryFormState((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateLineItem(index: number, key: keyof AccountingLineItemFormState, value: string) {
    setEntryFormState((current) => ({
      ...current,
      lineItems: current.lineItems.map((lineItem, lineItemIndex) =>
        lineItemIndex === index
          ? {
              ...lineItem,
              [key]: value
            }
          : lineItem
      )
    }));
  }

  function addLineItem() {
    setEntryFormState((current) => ({
      ...current,
      lineItems: [...current.lineItems, createEmptyLineItem()]
    }));
  }

  function removeLineItem(index: number) {
    setEntryFormState((current) => ({
      ...current,
      lineItems: current.lineItems.length === 1 ? [createEmptyLineItem()] : current.lineItems.filter((_, lineItemIndex) => lineItemIndex !== index)
    }));
  }

  function requestRemoveLineItem(index: number) {
    setConfirmDialog({
      title: `Remove line item ${index + 1}?`,
      description: "This removes the line item from the current accounting draft before you save it.",
      confirmLabel: "Remove line item",
      onConfirm: () => {
        removeLineItem(index);
      }
    });
  }

  function openCreateEntryModal() {
    setEntryError("");
    setEntryFormState(buildEmptyEntryState());
    setIsCreateEntryOpen(true);
  }

  function openEarnestMoneyModal(record?: OfficeAccountingSnapshot["earnestMoneyRecords"][number]) {
    setEarnestMoneyError("");
    setEditingEarnestMoneyId(record?.id ?? "");
    setEarnestMoneyFormState(buildEarnestMoneyState(record ?? null));
    setIsEarnestMoneyOpen(true);
  }

  async function handleCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingEntry(true);
    setEntryError("");

    try {
      const response = await fetch("/api/office/accounting/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(entryFormState)
      });

      const body = (await response.json().catch(() => null)) as { error?: string; transaction?: { id: string } } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create accounting transaction.");
      }

      setIsCreateEntryOpen(false);
      router.push(
        buildAccountingHref(pathname, {
          ...filterState,
          entryId: body?.transaction?.id ?? ""
        })
      );
      router.refresh();
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : "Failed to create accounting transaction.");
    } finally {
      setIsSavingEntry(false);
    }
  }

  async function handleSaveSelectedEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!snapshot.selectedTransaction) {
      return;
    }

    setIsSavingEntry(true);
    setEntryError("");

    try {
      const response = await fetch(`/api/office/accounting/transactions/${snapshot.selectedTransaction.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(entryFormState)
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update accounting transaction.");
      }

      router.refresh();
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : "Failed to update accounting transaction.");
    } finally {
      setIsSavingEntry(false);
    }
  }

  async function handleSaveEarnestMoney(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingEarnestMoney(true);
    setEarnestMoneyError("");

    try {
      const endpoint = editingEarnestMoneyId
        ? `/api/office/accounting/earnest-money/${editingEarnestMoneyId}`
        : "/api/office/accounting/earnest-money";
      const method = editingEarnestMoneyId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(earnestMoneyFormState)
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save earnest money.");
      }

      setIsEarnestMoneyOpen(false);
      setEditingEarnestMoneyId("");
      router.refresh();
    } catch (error) {
      setEarnestMoneyError(error instanceof Error ? error.message : "Failed to save earnest money.");
    } finally {
      setIsSavingEarnestMoney(false);
    }
  }

  return (
    <>
      <nav className="office-section-nav" aria-label="Accounting sections">
        <a href="#accounting-overview">Overview</a>
        <a href="#accounting-ledger">Accounting transactions</a>
        <a href="#agent-billing">Agent billing</a>
        <a href="#earnest-money">Earnest money</a>
        <a href="#chart-of-accounts">Chart of accounts</a>
      </nav>

      <ListPageSection
        id="accounting-overview"
        subtitle="Review live ledger metrics, narrow the current scope, and jump into accounting entries without leaving the list workspace."
        title="Accounting workbench"
      >
        <ListPageStatsGrid>
          <StatCard hint="Invoices currently in the filtered accounting window." label="Total invoices" value={snapshot.overview.totalInvoices} />
          <StatCard hint="Outstanding bills still open for payment." label="Open bills" value={snapshot.overview.openBills} />
          <StatCard hint="Cash-in recorded inside the current result set." label="Received payments" value={snapshot.overview.receivedPaymentsLabel} />
          <StatCard hint="Cash-out recorded inside the current result set." label="Made payments" value={snapshot.overview.madePaymentsLabel} />
          <StatCard hint="Income/expense effect derived from ledger entries." label="Office net ledger impact" value={snapshot.overview.officeNetLedgerImpactLabel} />
          <StatCard hint="Earnest money records not yet complete." label="Outstanding EMD" value={snapshot.overview.outstandingEmdCount} />
          <StatCard hint="Earnest money items already past due." label="Overdue EMD" value={snapshot.overview.overdueEmdCount} />
          <StatCard hint="Shared org-level accounts remain visible when office scope allows it." label="Scope" value={officeLabel} />
        </ListPageStatsGrid>

        <ListPageFilters
          as="form"
          className="office-report-filters office-list-filters"
          onSubmit={(event) => {
            event.preventDefault();
            navigateWithFilters({ ...filterState, entryId: "" });
          }}
        >
          <FilterField label="Type">
            <SelectInput onChange={(event) => setFilterState((current) => ({ ...current, type: event.target.value }))} value={filterState.type}>
              {accountingFilterTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label="Status">
            <SelectInput onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))} value={filterState.status}>
              {accountingFilterStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label="Owner / agent">
            <SelectInput
              onChange={(event) => setFilterState((current) => ({ ...current, ownerMembershipId: event.target.value }))}
              value={filterState.ownerMembershipId}
            >
              <option value="">All owners</option>
              {snapshot.filters.ownerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label="Search">
            <TextInput
              onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search reference, counterparty, transaction..."
              type="text"
              value={filterState.q}
            />
          </FilterField>

          <FilterField label="Start date">
            <TextInput
              onChange={(event) => setFilterState((current) => ({ ...current, startDate: event.target.value }))}
              type="date"
              value={filterState.startDate}
            />
          </FilterField>

          <FilterField label="End date">
            <TextInput onChange={(event) => setFilterState((current) => ({ ...current, endDate: event.target.value }))} type="date" value={filterState.endDate} />
          </FilterField>

          <div className="office-filter-actions">
            <Button type="submit">Apply filters</Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              Reset
            </Button>
          </div>

          {canManageAccounting ? (
            <div className="office-filter-actions">
              <Button onClick={openCreateEntryModal} type="button">
                New accounting entry
              </Button>
              <Button onClick={() => openEarnestMoneyModal()} type="button" variant="secondary">
                New EMD
              </Button>
            </div>
          ) : null}
        </ListPageFilters>
      </ListPageSection>

      <ListPageSplit className="office-accounting-workspace">
        <ListPageStack>
          <ListPageTableSection
            footer={<ListPageFooter summary={`${snapshot.transactions.length} accounting rows in the current filtered window`} />}
            id="accounting-ledger"
            subtitle={`${snapshot.transactions.length} records in the current filtered window`}
            title="Accounting transactions"
          >
            <DataTable className="office-table">
              <DataTableHeader className="office-table-header office-table-row office-table-row-accounting">
                <span>Date</span>
                <span>Type</span>
                <span>Counterparty</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Linked transaction</span>
                <span>Created by</span>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.transactions.map((transaction) => (
                  <Link className="office-data-table-row office-table-row office-table-row-accounting" href={transaction.href} key={transaction.id} role="row">
                    <span>{transaction.accountingDate}</span>
                    <span>{transaction.type}</span>
                    <div className="office-table-primary">
                      <strong>{transaction.counterparty}</strong>
                      <p>{transaction.referenceNumber || transaction.ownerName}</p>
                    </div>
                    <span>{transaction.amountLabel}</span>
                    <span>
                      <StatusBadge tone={getAccountingStatusTone(transaction.status)}>{transaction.status}</StatusBadge>
                    </span>
                    <div className="office-table-primary">
                      <strong>{transaction.linkedTransactionHref ? "Open transaction" : "—"}</strong>
                      <p>{transaction.linkedTransactionLabel}</p>
                    </div>
                    <span>{transaction.createdBy}</span>
                  </Link>
                ))}

                {snapshot.transactions.length === 0 ? (
                  <EmptyState description="Try widening the current accounting filters." title="No accounting transactions matched" />
                ) : null}
              </DataTableBody>
            </DataTable>
          </ListPageTableSection>

          <ListPageTableSection
            footer={<ListPageFooter summary={`${snapshot.generalLedgerEntries.length} ledger entries in the current slice`} />}
            id="chart-of-accounts"
            subtitle={`Latest ${snapshot.generalLedgerEntries.length} posted entries`}
            title="General ledger"
          >
            <DataTable className="office-table">
              <DataTableHeader className="office-table-header office-table-row office-table-row-ledger">
                <span>Date</span>
                <span>Account</span>
                <span>Debit</span>
                <span>Credit</span>
                <span>Memo</span>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.generalLedgerEntries.map((entry) => (
                  <Link className="office-data-table-row office-table-row office-table-row-ledger" href={entry.accountingTransactionHref} key={entry.id} role="row">
                    <span>{entry.entryDate}</span>
                    <div className="office-table-primary">
                      <strong>{entry.accountLabel}</strong>
                      <p>{entry.accountingTransactionLabel}</p>
                    </div>
                    <span>{entry.debitAmount}</span>
                    <span>{entry.creditAmount}</span>
                    <span>{entry.memo || "—"}</span>
                  </Link>
                ))}

                {snapshot.generalLedgerEntries.length === 0 ? (
                  <EmptyState description="Posted entries will appear here when accounting transactions hit the ledger." title="No ledger entries yet" />
                ) : null}
              </DataTableBody>
            </DataTable>
          </ListPageTableSection>
        </ListPageStack>

        <ListPageStack>
          <ListPageSection
            subtitle={
              snapshot.selectedTransaction
                ? `${snapshot.selectedTransaction.typeLabel} · ${snapshot.selectedTransaction.statusLabel}`
                : "Choose a row from the accounting table to inspect or edit it."
            }
            title={snapshot.selectedTransaction ? "Accounting entry detail" : "Select an accounting entry"}
          >
            {snapshot.selectedTransaction ? (
              <form className="bm-accounting-form" onSubmit={handleSaveSelectedEntry}>
                <AccountingEntryFormFields
                  accountOptions={snapshot.accountOptions}
                  config={selectedEntryConfig}
                  formState={entryFormState}
                  memberOptions={snapshot.memberOptions}
                  onAddLineItem={addLineItem}
                  onLineItemChange={updateLineItem}
                  onRemoveLineItem={requestRemoveLineItem}
                  onUpdateField={updateEntryField}
                  paymentMethodOptions={paymentMethodOptions}
                  transactionOptions={snapshot.filters.transactionOptions}
                />

                <div className="bm-accounting-form-actions">
                  <Button disabled={!canManageAccounting || isSavingEntry} type="submit">
                    {isSavingEntry ? "Saving..." : "Save accounting entry"}
                  </Button>
                  {snapshot.selectedTransaction.relatedTransactionId ? (
                    <Link className="office-button office-button-secondary" href={`/office/transactions/${snapshot.selectedTransaction.relatedTransactionId}`}>
                      Open linked transaction
                    </Link>
                  ) : null}
                  {entryError ? <p className="bm-transaction-submit-error">{entryError}</p> : null}
                </div>
              </form>
            ) : (
              <div className="bm-accounting-empty">
                <p>Use the transaction table to open an accounting record, or create a new invoice, bill, payment, deposit, refund, or journal entry.</p>
              </div>
            )}
          </ListPageSection>

          <ListPageTableSection
            footer={<ListPageFooter summary={`${snapshot.earnestMoneyRecords.length} active earnest money records`} />}
            id="earnest-money"
            subtitle={`${snapshot.earnestMoneyRecords.length} active EMD records`}
            title="Earnest money"
          >
            <DataTable className="office-table">
              <DataTableHeader className="office-table-header office-table-row office-table-row-emd">
                <span>Transaction</span>
                <span>Expected</span>
                <span>Received</span>
                <span>Refunded</span>
                <span>Status</span>
                <span>Due date</span>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.earnestMoneyRecords.map((record) => (
                  <DataTableRow className="office-table-row office-table-row-emd" key={record.id}>
                    <div className="office-table-primary">
                      <strong>
                        <Link href={record.transactionHref}>{record.transactionLabel}</Link>
                      </strong>
                      <p>{record.heldExternally ? "Held externally" : record.heldByOffice ? "Held by office" : "Holding mode unset"}</p>
                    </div>
                    <span>{record.expectedAmount}</span>
                    <span>{record.receivedAmount}</span>
                    <span>{record.refundedAmount}</span>
                    <span>
                      <StatusBadge tone={getEarnestMoneyTone(record.status)}>{record.status}</StatusBadge>
                    </span>
                    <div className="bm-accounting-inline-actions">
                      <span>{record.dueAt}</span>
                      {canManageAccounting ? (
                        <button className="office-inline-action" onClick={() => openEarnestMoneyModal(record)} type="button">
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </DataTableRow>
                ))}

                {snapshot.earnestMoneyRecords.length === 0 ? (
                  <EmptyState description="Create or import an earnest money record to track deposits and due dates." title="No earnest money records" />
                ) : null}
              </DataTableBody>
            </DataTable>
          </ListPageTableSection>

          <ListPageTableSection
            footer={<ListPageFooter summary={`${snapshot.chartAccounts.length} chart accounts available in this scope`} />}
            subtitle="System accounts are seeded and ready; custom account editing is intentionally not exposed yet."
            title="Chart of accounts"
          >
            <DataTable className="office-table">
              <DataTableHeader className="office-table-header office-table-row office-table-row-chart">
                <span>Code</span>
                <span>Name</span>
                <span>Type</span>
                <span>Status</span>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.chartAccounts.map((account) => (
                  <DataTableRow className="office-table-row office-table-row-chart" key={account.id}>
                    <span>{account.code || "—"}</span>
                    <div className="office-table-primary">
                      <strong>{account.name}</strong>
                      <p>{account.isSystem ? "System account" : "Custom account"}</p>
                    </div>
                    <span>{account.accountType}</span>
                    <span>
                      <StatusBadge tone={account.isActive ? "success" : "neutral"}>{account.isActive ? "Active" : "Inactive"}</StatusBadge>
                    </span>
                  </DataTableRow>
                ))}

                {snapshot.chartAccounts.length === 0 ? (
                  <EmptyState description="System accounts are seeded automatically once accounting is enabled." title="No chart accounts available" />
                ) : null}
              </DataTableBody>
            </DataTable>
          </ListPageTableSection>
        </ListPageStack>
      </ListPageSplit>

      <AgentBillingPanel
        canManageAgentBilling={canManageAgentBilling}
        canManagePayments={canManagePayments}
        canViewAgentBilling={canViewAgentBilling}
        snapshot={agentBillingSnapshot}
      />

      {isCreateEntryOpen ? (
        <div className="bm-modal-overlay" onClick={() => setIsCreateEntryOpen(false)}>
          <section className="bm-transaction-modal bm-accounting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="bm-transaction-modal-header">
              <h3>NEW ACCOUNTING ENTRY</h3>
              <button aria-label="Close create accounting entry modal" onClick={() => setIsCreateEntryOpen(false)} type="button">
                ×
              </button>
            </header>

            <form className="bm-transaction-modal-body bm-accounting-modal-body" onSubmit={handleCreateEntry}>
              <AccountingEntryFormFields
                accountOptions={snapshot.accountOptions}
                config={entryModalConfig}
                formState={entryFormState}
                memberOptions={snapshot.memberOptions}
                onAddLineItem={addLineItem}
                onLineItemChange={updateLineItem}
                onRemoveLineItem={requestRemoveLineItem}
                onUpdateField={updateEntryField}
                paymentMethodOptions={paymentMethodOptions}
                transactionOptions={snapshot.filters.transactionOptions}
              />

              <footer className="bm-transaction-modal-footer">
                <span>{entryModalConfig.supportsLineItems ? "Line items drive the posted total for this type." : "Payments and received payments use the total amount field directly."}</span>
                <Button disabled={isSavingEntry} type="submit">
                  {isSavingEntry ? "Saving..." : "Create entry"}
                </Button>
              </footer>
              {entryError ? <p className="bm-transaction-submit-error">{entryError}</p> : null}
            </form>
          </section>
        </div>
      ) : null}

      {isEarnestMoneyOpen ? (
        <div className="bm-modal-overlay" onClick={() => setIsEarnestMoneyOpen(false)}>
          <section className="bm-transaction-modal bm-accounting-modal bm-emd-modal" onClick={(event) => event.stopPropagation()}>
            <header className="bm-transaction-modal-header">
              <h3>{editingEarnestMoneyId ? "EDIT EARNEST MONEY" : "NEW EARNEST MONEY"}</h3>
              <button aria-label="Close earnest money modal" onClick={() => setIsEarnestMoneyOpen(false)} type="button">
                ×
              </button>
            </header>

            <form className="bm-transaction-modal-body bm-accounting-modal-body" onSubmit={handleSaveEarnestMoney}>
              <div className="bm-accounting-form-grid">
                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Linked transaction</span>
                  <select
                    disabled={Boolean(editingEarnestMoneyId)}
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, transactionId: event.target.value }))}
                    value={earnestMoneyFormState.transactionId}
                  >
                    <option value="">Select transaction</option>
                    {snapshot.filters.transactionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bm-detail-field">
                  <span>Expected amount</span>
                  <input
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, expectedAmount: event.target.value }))}
                    type="text"
                    value={earnestMoneyFormState.expectedAmount}
                  />
                </label>

                <label className="bm-detail-field">
                  <span>Due date</span>
                  <input
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, dueAt: event.target.value }))}
                    type="date"
                    value={earnestMoneyFormState.dueAt}
                  />
                </label>

                <label className="bm-detail-field">
                  <span>Received amount</span>
                  <input
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, receivedAmount: event.target.value }))}
                    type="text"
                    value={earnestMoneyFormState.receivedAmount}
                  />
                </label>

                <label className="bm-detail-field">
                  <span>Refunded / distributed</span>
                  <input
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, refundedAmount: event.target.value }))}
                    type="text"
                    value={earnestMoneyFormState.refundedAmount}
                  />
                </label>

                <label className="bm-detail-field">
                  <span>Payment date</span>
                  <input
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, paymentDate: event.target.value }))}
                    type="date"
                    value={earnestMoneyFormState.paymentDate}
                  />
                </label>

                <label className="bm-detail-field">
                  <span>Deposit date</span>
                  <input
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, depositDate: event.target.value }))}
                    type="date"
                    value={earnestMoneyFormState.depositDate}
                  />
                </label>

                <label className="bm-detail-field bm-detail-field-checkbox">
                  <input
                    checked={earnestMoneyFormState.heldByOffice}
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, heldByOffice: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Held by office</span>
                </label>

                <label className="bm-detail-field bm-detail-field-checkbox">
                  <input
                    checked={earnestMoneyFormState.heldExternally}
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, heldExternally: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Held externally</span>
                </label>

                <label className="bm-detail-field bm-detail-field-checkbox">
                  <input
                    checked={earnestMoneyFormState.trackInLedger}
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, trackInLedger: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Track in ledger</span>
                </label>

                <label className="bm-detail-field bm-detail-field-wide">
                  <span>Notes</span>
                  <textarea
                    onChange={(event) => setEarnestMoneyFormState((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    value={earnestMoneyFormState.notes}
                  />
                </label>
              </div>

              <footer className="bm-transaction-modal-footer">
                <span>EMD status is derived from due date, received amount, refunded amount, and deposit progress.</span>
                <Button disabled={isSavingEarnestMoney} type="submit">
                  {isSavingEarnestMoney ? "Saving..." : editingEarnestMoneyId ? "Save EMD" : "Create EMD"}
                </Button>
              </footer>
              {earnestMoneyError ? <p className="bm-transaction-submit-error">{earnestMoneyError}</p> : null}
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmActionDialog
        cancelLabel="Keep line item"
        confirmLabel={confirmDialog?.confirmLabel}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (!confirmDialog) {
            return;
          }

          const action = confirmDialog.onConfirm;
          setConfirmDialog(null);
          action();
        }}
        title={confirmDialog?.title ?? ""}
      />
    </>
  );
}

type AccountingEntryFormFieldsProps = {
  formState: AccountingEntryFormState;
  config: AccountingTypeOption;
  transactionOptions: OfficeAccountingSnapshot["filters"]["transactionOptions"];
  memberOptions: OfficeAccountingSnapshot["memberOptions"];
  accountOptions: OfficeAccountingSnapshot["accountOptions"];
  paymentMethodOptions: PaymentMethodOption[];
  onUpdateField: <K extends keyof AccountingEntryFormState>(key: K, value: AccountingEntryFormState[K]) => void;
  onLineItemChange: (index: number, key: keyof AccountingLineItemFormState, value: string) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (index: number) => void;
};

function AccountingEntryFormFields({
  formState,
  config,
  transactionOptions,
  memberOptions,
  accountOptions,
  paymentMethodOptions,
  onUpdateField,
  onLineItemChange,
  onAddLineItem,
  onRemoveLineItem
}: AccountingEntryFormFieldsProps) {
  return (
    <div className="bm-accounting-form-stack">
      <div className="bm-accounting-form-grid">
        <label className="bm-detail-field">
          <span>Type</span>
          <select onChange={(event) => onUpdateField("type", event.target.value)} value={formState.type}>
            {accountingTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="bm-detail-field">
          <span>Status</span>
          <select onChange={(event) => onUpdateField("status", event.target.value)} value={formState.status}>
            {accountingStatusOptions.map((option) => (
              <option key={option.value || "default"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="bm-detail-field">
          <span>Accounting date</span>
          <input onChange={(event) => onUpdateField("accountingDate", event.target.value)} type="date" value={formState.accountingDate} />
        </label>

        <label className="bm-detail-field">
          <span>Due date</span>
          <input onChange={(event) => onUpdateField("dueDate", event.target.value)} type="date" value={formState.dueDate} />
        </label>

        <label className="bm-detail-field">
          <span>Payment method</span>
          <select onChange={(event) => onUpdateField("paymentMethod", event.target.value)} value={formState.paymentMethod}>
            {paymentMethodOptions.map((option) => (
              <option key={option.value || "default"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="bm-detail-field">
          <span>Reference number</span>
          <input onChange={(event) => onUpdateField("referenceNumber", event.target.value)} type="text" value={formState.referenceNumber} />
        </label>

        <label className="bm-detail-field bm-detail-field-wide">
          <span>Counterparty</span>
          <input onChange={(event) => onUpdateField("counterpartyName", event.target.value)} type="text" value={formState.counterpartyName} />
        </label>

        <label className="bm-detail-field bm-detail-field-wide">
          <span>Linked transaction</span>
          <select onChange={(event) => onUpdateField("relatedTransactionId", event.target.value)} value={formState.relatedTransactionId}>
            <option value="">No linked transaction</option>
            {transactionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="bm-detail-field bm-detail-field-wide">
          <span>Owner / agent</span>
          <select onChange={(event) => onUpdateField("relatedMembershipId", event.target.value)} value={formState.relatedMembershipId}>
            <option value="">No linked owner</option>
            {memberOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="bm-detail-field bm-detail-field-wide">
          <span>Memo</span>
          <input onChange={(event) => onUpdateField("memo", event.target.value)} type="text" value={formState.memo} />
        </label>

        <label className="bm-detail-field bm-detail-field-wide">
          <span>Notes</span>
          <textarea onChange={(event) => onUpdateField("notes", event.target.value)} rows={3} value={formState.notes} />
        </label>

        {!config.supportsLineItems ? (
          <label className="bm-detail-field">
            <span>Total amount</span>
            <input onChange={(event) => onUpdateField("totalAmount", event.target.value)} type="text" value={formState.totalAmount} />
          </label>
        ) : null}
      </div>

      {config.supportsLineItems ? (
        <section className="bm-accounting-line-items">
          <div className="bm-card-head bm-card-head-inline">
            <h3>Line items</h3>
            <span>{config.manualEntrySides ? "Manual debit/credit rows must stay balanced." : "Total is derived from the line items below."}</span>
          </div>

          <HorizontalScrollArea>
            <div className="office-table">
              <div className={`office-table-header office-table-row ${config.manualEntrySides ? "office-table-row-accounting-lines-manual" : "office-table-row-accounting-lines"}`}>
                <span>Account</span>
                <span>Description</span>
                {config.manualEntrySides ? <span>Entry side</span> : null}
                <span>Amount</span>
                <span />
              </div>

              {formState.lineItems.map((lineItem, index) => (
                <div className={`office-table-row ${config.manualEntrySides ? "office-table-row-accounting-lines-manual" : "office-table-row-accounting-lines"}`} key={`${index}-${lineItem.id ?? "new"}`}>
                  <select onChange={(event) => onLineItemChange(index, "ledgerAccountId", event.target.value)} value={lineItem.ledgerAccountId}>
                    <option value="">Select account</option>
                    {accountOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input onChange={(event) => onLineItemChange(index, "description", event.target.value)} placeholder="Optional description" type="text" value={lineItem.description} />
                  {config.manualEntrySides ? (
                    <select onChange={(event) => onLineItemChange(index, "entrySide", event.target.value)} value={lineItem.entrySide}>
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                  ) : null}
                  <input onChange={(event) => onLineItemChange(index, "amount", event.target.value)} placeholder="0.00" type="text" value={lineItem.amount} />
                  <button className="office-inline-action" onClick={() => onRemoveLineItem(index)} type="button">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </HorizontalScrollArea>

          <button className="office-button office-button-secondary" onClick={onAddLineItem} type="button">
            Add line item
          </button>
        </section>
      ) : null}
    </div>
  );
}
