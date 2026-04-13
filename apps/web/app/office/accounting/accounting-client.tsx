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
  TextInput,
  TextareaInput
} from "@acre/ui";
import { LocalDateTime } from "../_components/local-date-time";

type OfficeAccountingClientProps = {
  snapshot: OfficeAgentPayoutStatementsWorkspaceSnapshot;
};

type FilterState = {
  membershipId: string;
  invoiceNumbers: string[];
};

type AgentOption = OfficeAgentPayoutStatementsWorkspaceSnapshot["filters"]["memberOptions"][number];
type SelectedStatementDetail = NonNullable<OfficeAgentPayoutStatementsWorkspaceSnapshot["selectedStatement"]>;
type StatementReviewStatus = SelectedStatementDetail["reviewStatus"];
type StatementBankField = {
  label: string;
  value: string;
  wide?: boolean;
};
type EditableManualLineItem = {
  localId: string;
  id?: string;
  memo: string;
  amount: string;
};

const statementReviewStatusOptions: Array<{
  value: StatementReviewStatus;
  label: string;
}> = [
  { value: "draft", label: "Draft" },
  { value: "awaiting_agent", label: "Awaiting agent" },
  { value: "revision_requested", label: "Revision requested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "paid", label: "Paid" }
];

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

  for (const invoiceNumber of filters.invoiceNumbers) {
    const normalized = invoiceNumber.trim();

    if (!normalized) {
      continue;
    }

    searchParams.append("invoiceNumber", normalized);
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

function getReviewStatusTone(status: StatementReviewStatus) {
  if (status === "confirmed" || status === "paid") {
    return "success" as const;
  }

  if (status === "awaiting_agent") {
    return "accent" as const;
  }

  if (status === "revision_requested") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getStatementStatusSelectClassName(status: StatementReviewStatus) {
  return `office-accounting-status-select office-accounting-status-select-${getReviewStatusTone(status)}`;
}

function getSendButtonLabel(reviewStatus: StatementReviewStatus, isSending: boolean) {
  if (isSending) {
    return "Sending...";
  }

  if (reviewStatus === "awaiting_agent") {
    return "Resend";
  }

  if (reviewStatus === "revision_requested") {
    return "Send update";
  }

  if (reviewStatus === "confirmed") {
    return "Send revision";
  }

  if (reviewStatus === "paid") {
    return "Send revision";
  }

  return "Send";
}

function toNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function createEditableManualLineItem(item?: SelectedStatementDetail["manualLineItems"][number]): EditableManualLineItem {
  const persistedId = item?.id?.trim();

  return {
    localId: persistedId || `manual-${Math.random().toString(36).slice(2, 10)}`,
    ...(persistedId ? { id: persistedId } : {}),
    memo: item?.memo ?? "",
    amount: item?.amountValue ?? ""
  };
}

function normalizeManualAmountForComparison(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric.toString() : trimmed;
}

function buildManualLineItemsSignature(items: Array<{ id?: string; memo: string; amount: string }>) {
  return items
    .map((item) => `${item.id?.trim() ?? ""}:${item.memo.trim()}:${normalizeManualAmountForComparison(item.amount)}`)
    .join("|");
}

function validateManualLineItems(items: EditableManualLineItem[]) {
  for (const [index, item] of items.entries()) {
    if (!item.memo.trim()) {
      return `Manual line item ${index + 1} memo is required.`;
    }

    if (!item.amount.trim()) {
      return `Manual line item ${index + 1} amount is required.`;
    }

    if (!/^[+-]?(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/.test(item.amount.trim())) {
      return `Manual line item ${index + 1} amount must be a signed number with up to 2 decimal places.`;
    }
  }

  return "";
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

function StatementPostSplitCell({ lineItem }: { lineItem: SelectedStatementDetail["lineItems"][number] }) {
  return (
    <div className="office-agent-statement-post-split">
      <strong>{lineItem.postSplitLabel}</strong>
      {lineItem.postSplitBreakdown.map((detail) => (
        <p key={`${lineItem.id}:${detail.feeTypeValue}`}>
          {detail.feeTypeLabel}: {detail.amountLabel}
        </p>
      ))}
    </div>
  );
}

function normalizeInvoiceSelection(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildInvoiceSelectionKey(values: string[]) {
  return [...normalizeInvoiceSelection(values)].sort().join("|");
}

function getStatementGenerationBlockedMessage(input: {
  hasFilterAgent: boolean;
  hasSelectedInvoices: boolean;
  previewMatchesFilter: boolean;
  selectedRowCount: number;
}) {
  if (!input.hasFilterAgent || !input.hasSelectedInvoices) {
    return "";
  }

  if (input.previewMatchesFilter) {
    return input.selectedRowCount === 0 ? "Select at least one commission row before generating." : "";
  }

  return "";
}

export function OfficeAccountingClient({ snapshot }: OfficeAccountingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const agentListboxId = useId();
  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const previousPreviewContextKeyRef = useRef<string | null>(null);
  const hasTouchedCandidateSelectionRef = useRef(false);
  const candidateRowKey = snapshot.candidateRows.map((row) => row.id).join("|");
  const snapshotInvoiceSelectionKey = buildInvoiceSelectionKey(snapshot.filters.invoiceNumbers);
  const previewContextKey = `${snapshot.filters.membershipId}:${snapshotInvoiceSelectionKey}`;
  const historyStatusKey = snapshot.history.map((statement) => `${statement.id}:${statement.reviewStatus}`).join("|");
  const [filterState, setFilterState] = useState<FilterState>({
    membershipId: snapshot.filters.membershipId,
    invoiceNumbers: snapshot.filters.invoiceNumbers
  });
  const [agentSearchValue, setAgentSearchValue] = useState(
    snapshot.filters.memberOptions.find((option) => option.id === snapshot.filters.membershipId)?.label ?? ""
  );
  const deferredAgentSearchValue = useDeferredValue(agentSearchValue);
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [highlightedAgentIndex, setHighlightedAgentIndex] = useState(0);
  const [selectedCalculationIds, setSelectedCalculationIds] = useState<string[]>(
    snapshot.candidateRows.filter((row) => row.isGenerateEligible).map((row) => row.id)
  );
  const [manualLineItems, setManualLineItems] = useState<EditableManualLineItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSavingManualLineItems, setIsSavingManualLineItems] = useState(false);
  const [isSendingStatement, setIsSendingStatement] = useState(false);
  const [quickSendingStatementId, setQuickSendingStatementId] = useState("");
  const [updatingStatementStatusId, setUpdatingStatementStatusId] = useState("");
  const [pendingStatementStatuses, setPendingStatementStatuses] = useState<Record<string, StatementReviewStatus>>({});
  const [filterError, setFilterError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [manualSaveError, setManualSaveError] = useState("");
  const [sendError, setSendError] = useState("");
  const [historySendError, setHistorySendError] = useState("");
  const [historyStatusError, setHistoryStatusError] = useState("");
  const [sendMessage, setSendMessage] = useState("");
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
      invoiceNumbers: snapshot.filters.invoiceNumbers
    });
    setIsPreviewLoading(false);
  }, [snapshot.filters.membershipId, snapshotInvoiceSelectionKey]);

  useEffect(() => {
    const nextLabel = snapshot.filters.memberOptions.find((option) => option.id === snapshot.filters.membershipId)?.label ?? "";
    setAgentSearchValue(nextLabel);
    setIsAgentPickerOpen(false);
    setHighlightedAgentIndex(0);
  }, [snapshot.filters.memberOptions, snapshot.filters.membershipId]);

  useEffect(() => {
    setPendingStatementStatuses({});
  }, [historyStatusKey]);

  useEffect(() => {
    const eligibleIds = snapshot.candidateRows.filter((row) => row.isGenerateEligible).map((row) => row.id);
    const previewContextChanged = previousPreviewContextKeyRef.current !== previewContextKey;

    if (previewContextChanged) {
      previousPreviewContextKeyRef.current = previewContextKey;
      hasTouchedCandidateSelectionRef.current = false;
    }

    setSelectedCalculationIds((current) => {
      if (eligibleIds.length === 0) {
        return [];
      }

      if (previewContextChanged || !hasTouchedCandidateSelectionRef.current) {
        return eligibleIds;
      }

      const currentLookup = new Set(current);
      return eligibleIds.filter((id) => currentLookup.has(id));
    });
  }, [candidateRowKey, previewContextKey, snapshot.candidateRows]);

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
  const selectedStatementManualSignature = selectedStatement
    ? buildManualLineItemsSignature(
        selectedStatement.manualLineItems.map((item) => ({
          id: item.id,
          memo: item.memo,
          amount: item.amountValue
        }))
      )
    : "";
  const selectedStatementBankFields = selectedStatement ? buildStatementBankFields(selectedStatement) : [];
  const sendButtonLabel = selectedStatement ? getSendButtonLabel(selectedStatement.reviewStatus, isSendingStatement) : "Send";
  const resolvedFilterMembershipId = resolveTypedAgentMembershipId(
    snapshot.filters.memberOptions,
    filterState.membershipId,
    agentSearchValue
  );
  const selectedInvoiceNumbers = normalizeInvoiceSelection(filterState.invoiceNumbers);
  const currentInvoiceSelectionKey = buildInvoiceSelectionKey(selectedInvoiceNumbers);
  const previewMatchesFilter =
    snapshot.filters.membershipId === resolvedFilterMembershipId && snapshotInvoiceSelectionKey === currentInvoiceSelectionKey;
  const selectedInvoiceLookup = new Set(selectedInvoiceNumbers);
  const selectedInvoiceOptions = snapshot.filters.invoiceOptions.filter((option) => selectedInvoiceLookup.has(option.invoiceNumber));
  const hasFilterAgent = resolvedFilterMembershipId.trim().length > 0;
  const hasSelectedInvoices = selectedInvoiceNumbers.length > 0;
  const hasLoadedAgent = snapshot.filters.membershipId.trim().length > 0;
  const hasSelectedGenerateEligibleInvoices = selectedInvoiceOptions.some((option) => option.isGenerateEligible);
  const hasSelectedGenerateEligibleRows = selectedRows.some((row) => row.isGenerateEligible);
  const canGenerateStatement =
    hasFilterAgent &&
    hasSelectedInvoices &&
    (previewMatchesFilter ? hasSelectedGenerateEligibleRows : hasSelectedGenerateEligibleInvoices);
  const generationBlockedMessage = getStatementGenerationBlockedMessage({
    hasFilterAgent,
    hasSelectedInvoices,
    previewMatchesFilter,
    selectedRowCount: selectedRows.length
  });
  const hasSelectedReusableRows = selectedRows.some((row) => row.statusValue === "payable" || row.statusValue === "paid");
  const generateButtonLabel = isGenerating ? "Generating..." : "Generate statement";
  const manualAdjustmentTotal = manualLineItems.reduce((sum, lineItem) => sum + toNumber(lineItem.amount), 0);
  const invoicePayoutTotal = selectedStatement ? toNumber(selectedStatement.invoicePayoutTotalValue) : 0;
  const statementFinalPayout = invoicePayoutTotal + manualAdjustmentTotal;
  const hasManualLineItemChanges = selectedStatement
    ? buildManualLineItemsSignature(
        manualLineItems.map((lineItem) => ({
          id: lineItem.id,
          memo: lineItem.memo,
          amount: lineItem.amount
        }))
      ) !== selectedStatementManualSignature
    : false;
  const selectedSummary = previewMatchesFilter
    ? selectedRows.reduce(
        (summary, row) => ({
          invoiceCount: selectedInvoiceNumbers.length,
          rowCount: summary.rowCount + 1,
          gross: summary.gross + toNumber(row.grossCommissionValue),
          fees: summary.fees + toNumber(row.feesValue),
          payout: summary.payout + toNumber(row.statementAmountValue),
          isPreviewBased: true as const
        }),
        {
          invoiceCount: selectedInvoiceNumbers.length,
          rowCount: 0,
          gross: 0,
          fees: 0,
          payout: 0,
          isPreviewBased: true as const
        }
      )
    : selectedInvoiceOptions.reduce(
        (summary, option) => ({
          invoiceCount: summary.invoiceCount + 1,
          rowCount: summary.rowCount + option.rowCount,
          gross: null,
          fees: null,
          payout: summary.payout + toNumber(option.totalStatementAmountValue),
          isPreviewBased: false as const
        }),
        {
          invoiceCount: 0,
          rowCount: 0,
          gross: null as number | null,
          fees: null as number | null,
          payout: 0,
          isPreviewBased: false as const
        }
      );

  useEffect(() => {
    if (!selectedStatement) {
      setManualLineItems([]);
      setManualSaveError("");
      setIsSavingManualLineItems(false);
      setSendMessage("");
      setSendError("");
      setIsSendingStatement(false);
      setQuickSendingStatementId("");
      setHistorySendError("");
      return;
    }

    setManualLineItems(selectedStatement.manualLineItems.map((lineItem) => createEditableManualLineItem(lineItem)));
    setManualSaveError("");
    setIsSavingManualLineItems(false);
    setSendMessage("");
    setSendError("");
    setIsSendingStatement(false);
    setQuickSendingStatementId("");
    setHistorySendError("");
  }, [selectedStatement?.id, selectedStatementManualSignature]);

  function selectAgentOption(option: AgentOption) {
    setFilterState({
      membershipId: option.id,
      invoiceNumbers: []
    });
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
        membershipId: currentOption && currentOption.label === value ? current.membershipId : "",
        invoiceNumbers: currentOption && currentOption.label === value ? current.invoiceNumbers : []
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
      setFilterError("Select an agent from the search results before loading invoices.");
      return;
    }

    setFilterState({
      membershipId: resolvedMembershipId,
      invoiceNumbers: []
    });
    setIsPreviewLoading(true);

    startTransition(() => {
      router.push(
        buildAccountingHref(pathname, {
          membershipId: resolvedMembershipId,
          invoiceNumbers: []
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
      invoiceNumbers: []
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
    if (!snapshot.candidateRows.find((row) => row.id === calculationId)?.isGenerateEligible) {
      return;
    }

    hasTouchedCandidateSelectionRef.current = true;
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

  function toggleInvoiceOption(invoiceNumber: string, checked: boolean) {
    setFilterState((current) => {
      const next = new Set(current.invoiceNumbers);

      if (checked) {
        next.add(invoiceNumber);
      } else {
        next.delete(invoiceNumber);
      }

      return {
        ...current,
        invoiceNumbers: [...next]
      };
    });
    setFilterError("");
  }

  function toggleAllInvoiceOptions(checked: boolean) {
    setFilterState((current) => ({
      ...current,
      invoiceNumbers: checked ? snapshot.filters.invoiceOptions.map((option) => option.invoiceNumber) : []
    }));
    setFilterError("");
  }

  function toggleAllCandidates(checked: boolean) {
    hasTouchedCandidateSelectionRef.current = true;
    setSelectedCalculationIds(checked ? snapshot.candidateRows.map((row) => row.id) : []);
  }

  function handlePreviewSelectedInvoices() {
    if (!hasFilterAgent) {
      setFilterError("Choose one agent before previewing invoice rows.");
      return;
    }

    if (!hasSelectedInvoices) {
      setFilterError("Select at least one invoice number before previewing rows.");
      return;
    }

    setIsPreviewLoading(true);
    setFilterError("");

    startTransition(() => {
      router.push(
        buildAccountingHref(pathname, {
          membershipId: resolvedFilterMembershipId,
          invoiceNumbers: selectedInvoiceNumbers
        })
      );
      setIsPreviewLoading(false);
    });
  }

  async function handleGenerateStatement() {
    if (!hasFilterAgent) {
      setFilterError("Choose one agent before generating.");
      return;
    }

    if (!hasSelectedInvoices) {
      setFilterError("Select at least one invoice number before generating.");
      return;
    }

    if (previewMatchesFilter && selectedCalculationIds.length === 0) {
      setFilterError("Select at least one commission row before generating.");
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
          invoiceNumbers: selectedInvoiceNumbers,
          commissionCalculationIds: previewMatchesFilter && selectedCalculationIds.length > 0 ? selectedCalculationIds : []
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
            invoiceNumbers: selectedInvoiceNumbers,
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

  function handleAddManualLineItem() {
    setManualLineItems((current) => [...current, createEditableManualLineItem()]);
    setManualSaveError("");
  }

  function handleManualLineItemChange(localId: string, field: "memo" | "amount", value: string) {
    setManualLineItems((current) =>
      current.map((lineItem) => (lineItem.localId === localId ? { ...lineItem, [field]: value } : lineItem))
    );
    setManualSaveError("");
  }

  function handleRemoveManualLineItem(localId: string) {
    setManualLineItems((current) => current.filter((lineItem) => lineItem.localId !== localId));
    setManualSaveError("");
  }

  function resetManualLineItems() {
    if (!selectedStatement) {
      return;
    }

    setManualLineItems(selectedStatement.manualLineItems.map((lineItem) => createEditableManualLineItem(lineItem)));
    setManualSaveError("");
  }

  async function handleSaveManualLineItems() {
    if (!selectedStatement) {
      return;
    }

    const validationError = validateManualLineItems(manualLineItems);

    if (validationError) {
      setManualSaveError(validationError);
      return;
    }

    setIsSavingManualLineItems(true);
    setManualSaveError("");

    try {
      const response = await fetch(`/api/office/accounting/statements/${selectedStatement.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          manualLineItems: manualLineItems.map((lineItem) => ({
            ...(lineItem.id ? { id: lineItem.id } : {}),
            memo: lineItem.memo.trim(),
            amount: lineItem.amount.trim()
          }))
        })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save statement manual adjustments.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setManualSaveError(error instanceof Error ? error.message : "Failed to save statement manual adjustments.");
    } finally {
      setIsSavingManualLineItems(false);
    }
  }

  async function handleSendStatementToAgent() {
    if (!selectedStatement) {
      return;
    }

    if (hasManualLineItemChanges) {
      setSendError("Save the current manual adjustment changes before sending the statement to the agent.");
      return;
    }

    setIsSendingStatement(true);
    setSendError("");
    setHistorySendError("");

    try {
      const response = await fetch(`/api/office/accounting/statements/${selectedStatement.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: sendMessage
        })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to send the payout statement to the agent.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send the payout statement to the agent.");
    } finally {
      setIsSendingStatement(false);
    }
  }

  async function handleQuickSendStatement(statement: OfficeAgentPayoutStatementsWorkspaceSnapshot["history"][number]) {
    const hasUnsavedSelectedChanges = selectedStatement?.id === statement.id && hasManualLineItemChanges;

    if (hasUnsavedSelectedChanges) {
      setHistorySendError("Save the current manual adjustment changes before sending this statement to the agent.");
      return;
    }

    setQuickSendingStatementId(statement.id);
    setHistorySendError("");

    try {
      const response = await fetch(`/api/office/accounting/statements/${statement.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: ""
        })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to send the payout statement to the agent.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setHistorySendError(error instanceof Error ? error.message : "Failed to send the payout statement to the agent.");
    } finally {
      setQuickSendingStatementId("");
    }
  }

  async function handleUpdateStatementStatus(
    statement: OfficeAgentPayoutStatementsWorkspaceSnapshot["history"][number],
    nextStatus: StatementReviewStatus
  ) {
    if (nextStatus === statement.reviewStatus) {
      return;
    }

    if (selectedStatement?.id === statement.id && hasManualLineItemChanges) {
      setHistoryStatusError("Save the current manual adjustment changes before updating this statement status.");
      return;
    }

    setUpdatingStatementStatusId(statement.id);
    setHistoryStatusError("");
    setHistorySendError("");
    setPendingStatementStatuses((current) => ({
      ...current,
      [statement.id]: nextStatus
    }));

    try {
      const response = await fetch(`/api/office/accounting/statements/${statement.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reviewStatus: nextStatus
        })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update the payout statement status.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setPendingStatementStatuses((current) => {
        const nextState = { ...current };
        delete nextState[statement.id];
        return nextState;
      });
      setHistoryStatusError(error instanceof Error ? error.message : "Failed to update the payout statement status.");
    } finally {
      setUpdatingStatementStatusId("");
    }
  }

  return (
    <ListPageStack className="office-accounting-statements-stack">
      <ListPageSection
        subtitle="Choose an agent first, load the related invoice numbers, then preview or generate the statement from those invoices."
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

          <div className="office-filter-actions">
            <Button disabled={isPreviewLoading || !hasFilterAgent} type="submit" variant="secondary">
              {isPreviewLoading ? "Loading..." : "Load invoices"}
            </Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              Reset
            </Button>
          </div>
        </ListPageFilters>

        {filterError ? <p className="office-inline-error">{filterError}</p> : null}

        {!filterError && !hasFilterAgent ? (
          <p className="office-form-helper">
            {!hasFilterAgent && agentSearchValue.trim()
              ? "Pick one agent from the search results to continue."
              : "Choose an agent to load invoice candidates."}
          </p>
        ) : null}
      </ListPageSection>

      <ListPageSection
        subtitle="Select invoice numbers and review the matching commission rows in one place before generating the statement."
        title="Statement candidates"
      >
        {hasLoadedAgent ? (
          snapshot.filters.invoiceOptions.length > 0 ? (
            <div className="office-accounting-candidate-workspace">
              <div className="office-accounting-candidate-block">
                <div className="office-accounting-candidate-head">
                  <div className="office-accounting-candidate-copy">
                    <span className="office-mini-heading">Invoices</span>
                    <p className="office-form-helper">
                      Select one or more invoice numbers for the loaded agent. Each invoice contributes all matching eligible rows unless you later uncheck specific rows below.
                    </p>
                  </div>
                  <div className="office-section-actions">
                    <Button onClick={() => toggleAllInvoiceOptions(true)} size="sm" type="button" variant="secondary">
                      Select all
                    </Button>
                    <Button onClick={() => toggleAllInvoiceOptions(false)} size="sm" type="button" variant="ghost">
                      Clear
                    </Button>
                    <Button
                      disabled={isPreviewLoading || !hasSelectedInvoices}
                      onClick={handlePreviewSelectedInvoices}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {isPreviewLoading ? "Loading..." : "Preview rows"}
                    </Button>
                  </div>
                </div>

                <HorizontalScrollArea>
                  <DataTable className="office-table">
                    <DataTableHeader className="office-table-header office-table-row office-table-row-accounting-statement-invoices">
                      <span>Select</span>
                      <span>Invoice number</span>
                      <span>Rows</span>
                      <span>Payout</span>
                    </DataTableHeader>
                    <DataTableBody>
                      {snapshot.filters.invoiceOptions.map((option) => (
                        <DataTableRow className="office-table-row office-table-row-accounting-statement-invoices" key={option.invoiceNumber}>
                          <CheckboxField label="">
                            <input
                              checked={selectedInvoiceLookup.has(option.invoiceNumber)}
                              onChange={(event) => toggleInvoiceOption(option.invoiceNumber, event.target.checked)}
                              type="checkbox"
                            />
                          </CheckboxField>
                          <strong>{option.invoiceNumber}</strong>
                          <span>{option.rowCount}</span>
                          <span>{option.totalStatementAmountLabel}</span>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </HorizontalScrollArea>
              </div>

              <div className="office-accounting-candidate-block">
                <div className="office-accounting-candidate-head">
                  <div className="office-accounting-candidate-copy">
                    <span className="office-mini-heading">Rows</span>
                    <p className="office-form-helper">
                      Preview the commission rows under the currently selected invoice numbers. You can uncheck individual rows before generating.
                    </p>
                  </div>
                  {snapshot.candidateRows.length > 0 && previewMatchesFilter ? (
                    <div className="office-section-actions">
                      <Button onClick={() => toggleAllCandidates(true)} size="sm" type="button" variant="secondary">
                        Select all rows
                      </Button>
                      <Button onClick={() => toggleAllCandidates(false)} size="sm" type="button" variant="ghost">
                        Clear rows
                      </Button>
                    </div>
                  ) : null}
                </div>

                {hasSelectedInvoices ? (
                  previewMatchesFilter ? (
                    snapshot.candidateRows.length > 0 ? (
                      <HorizontalScrollArea>
                        <DataTable className="office-table">
                          <DataTableHeader className="office-table-header office-table-row office-table-row-accounting-statement-rows">
                            <span>Select</span>
                            <span>Invoice</span>
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
                              <DataTableRow className="office-table-row office-table-row-accounting-statement-rows" key={row.id}>
                                <CheckboxField label="">
                                  <input
                                    checked={selectedIdLookup.has(row.id)}
                                    disabled={!row.isGenerateEligible}
                                    onChange={(event) => toggleCandidate(row.id, event.target.checked)}
                                    type="checkbox"
                                  />
                                </CheckboxField>
                                <span>{formatStatementCellValue(row.invoiceNumber)}</span>
                                <div className="office-table-primary">
                                  <strong>
                                    <a
                                      className="office-inline-link office-accounting-candidate-trigger"
                                      href={row.transactionHref}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {row.transactionLabel}
                                    </a>
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
                        description="No commission rows are currently available under the selected invoice numbers."
                        title="No payout candidates"
                      />
                    )
                  ) : (
                    <EmptyState
                      description="Click Preview rows to load the exact commission rows for the currently selected invoice numbers."
                      title="Preview selected rows"
                    />
                  )
                ) : (
                  <EmptyState description="Select one or more invoice numbers to load the matching commission rows." title="Choose invoices" />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              description="This agent does not currently have any eligible commission rows with a saved invoice number."
              title="No invoice candidates"
            />
          )
        ) : (
          <EmptyState description="Choose an agent and load their invoice candidates first." title="Load agent invoices" />
        )}
      </ListPageSection>

      <ListPageSection
        actions={
          <Button
            aria-describedby={generationBlockedMessage ? "accounting-statement-generate-hint" : undefined}
            disabled={isGenerating || !canGenerateStatement}
            onClick={handleGenerateStatement}
            type="button"
          >
            {generateButtonLabel}
          </Button>
        }
        subtitle={
          previewMatchesFilter
            ? "Row-level changes apply only to the currently previewed invoice selection."
            : "Direct generation is allowed from the selected invoice numbers even before preview, but row totals below are only final after preview."
        }
        title="Selected payout summary"
      >
        <ListPageStatsGrid>
          <StatCard hint="currently selected invoice numbers" label="Selected invoices" value={selectedSummary.invoiceCount} />
          <StatCard hint="rows currently included by the selection" label="Selected rows" value={selectedSummary.rowCount} />
          <StatCard
            hint="sum of selected gross commission"
            label="Gross commission"
            value={selectedSummary.gross === null ? "Preview required" : formatCurrency(selectedSummary.gross)}
          />
          <StatCard
            hint="sum of selected fees"
            label="Fees"
            value={selectedSummary.fees === null ? "Preview required" : formatCurrency(selectedSummary.fees)}
          />
          <StatCard hint="sum of selected payout rows" label="Net payout" value={formatCurrency(selectedSummary.payout)} />
        </ListPageStatsGrid>

        {!previewMatchesFilter && hasSelectedInvoices && canGenerateStatement ? (
          <p className="office-form-helper">
            Preview the selected invoices if you want to inspect or uncheck individual rows before generating. Direct generate will include all eligible rows under those invoices.
          </p>
        ) : null}

        {previewMatchesFilter && hasSelectedReusableRows ? (
          <p className="office-form-helper">
            Rows already marked Payable or Paid can still be regenerated into a fresh statement snapshot. Regenerating does not downgrade Paid rows.
          </p>
        ) : null}

        {generationBlockedMessage ? (
          <p className="office-inline-error" id="accounting-statement-generate-hint">
            {generationBlockedMessage}
          </p>
        ) : null}

        {generationError ? <p className="office-inline-error">{generationError}</p> : null}
      </ListPageSection>

      <ListPageSection
        subtitle="Saved payout statements stay durable, so PDF downloads always rebuild from the same saved snapshot. Use Send here for quick internal delivery, or Open for notes and the full timeline."
        title="Statement history"
      >
        {historySendError ? <p className="office-inline-error">{historySendError}</p> : null}
        {historyStatusError ? <p className="office-inline-error">{historyStatusError}</p> : null}
        {snapshot.history.length > 0 ? (
          <HorizontalScrollArea>
            <DataTable className="office-table">
              <DataTableHeader className="office-table-header office-table-row office-table-row-accounting-statement-history">
                <span>Generated</span>
                <span>Agent</span>
                <span>Status</span>
                <span>Period</span>
                <span>Basis</span>
                <span>Rows</span>
                <span>Total payout</span>
                <span>Actions</span>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.history.map((statement) => {
                  const displayedReviewStatus = pendingStatementStatuses[statement.id] ?? statement.reviewStatus;

                  return (
                    <DataTableRow className="office-table-row office-table-row-accounting-statement-history" key={statement.id}>
                      <span>
                        <LocalDateTime fallbackLabel={statement.generatedAtLabel} value={statement.generatedAt} />
                      </span>
                      <strong>{statement.agentLabel}</strong>
                      <span>
                        <SelectInput
                          aria-label={`Update payout statement status for ${statement.agentLabel}`}
                          className={getStatementStatusSelectClassName(displayedReviewStatus)}
                          disabled={updatingStatementStatusId === statement.id}
                          onChange={(event) => void handleUpdateStatementStatus(statement, event.target.value as StatementReviewStatus)}
                          value={displayedReviewStatus}
                        >
                          {statementReviewStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectInput>
                      </span>
                      <span>{statement.periodLabel}</span>
                      <span>{statement.periodBasisLabel}</span>
                      <span>{statement.lineItemCount}</span>
                      <span>{statement.totalStatementAmountLabel}</span>
                      <div className="office-accounting-inline-actions office-accounting-statement-history-actions">
                        <Button
                          className="office-inline-action-sm"
                          disabled={quickSendingStatementId.length > 0 || (selectedStatement?.id === statement.id && hasManualLineItemChanges)}
                          onClick={() => void handleQuickSendStatement(statement)}
                          size="sm"
                          type="button"
                        >
                          {getSendButtonLabel(statement.reviewStatus, quickSendingStatementId === statement.id)}
                        </Button>
                        <Button
                          className="office-inline-action-sm"
                          onClick={() =>
                            startTransition(() => {
                              router.push(
                                buildAccountingHref(pathname, {
                                  membershipId: statement.membershipId,
                                  invoiceNumbers:
                                    snapshot.filters.membershipId === statement.membershipId ? snapshot.filters.invoiceNumbers : [],
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
                        <a
                          className="office-inline-action-sm"
                          href={`/api/office/accounting/statements/${statement.id}/pdf`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          PDF
                        </a>
                      </div>
                    </DataTableRow>
                  );
                })}
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
              <StatCard hint="current internal confirmation state" label="Review status" value={selectedStatement.reviewStatusLabel} />
              <StatCard hint="invoice rows plus manual adjustments" label="Rows" value={selectedStatement.lineItemCount} />
              <StatCard hint="snapshot total gross commission" label="Gross commission" value={selectedStatement.totalGrossCommissionLabel} />
              <StatCard hint="invoice-based payout subtotal" label="Invoice payout" value={selectedStatement.invoicePayoutTotalLabel} />
              <StatCard hint="live manual adjustment total before save" label="Manual adjustments" value={formatCurrency(manualAdjustmentTotal)} />
              <StatCard hint="live final payout total before save" label="Final payout" value={formatCurrency(statementFinalPayout)} />
            </ListPageStatsGrid>

            <div className="office-inline-meta">
              <span>
                Generated: <LocalDateTime fallbackLabel={selectedStatement.generatedAtLabel} value={selectedStatement.generatedAt} />
              </span>
              <span>Generated by: {selectedStatement.generatedByLabel}</span>
              <span>
                Status: <StatusBadge tone={getReviewStatusTone(selectedStatement.reviewStatus)}>{selectedStatement.reviewStatusLabel}</StatusBadge>
              </span>
              {selectedStatement.lastSharedAtLabel ? (
                <span>
                  Last sent: <LocalDateTime fallbackLabel={selectedStatement.lastSharedAtLabel} value={selectedStatement.lastSharedAt} />
                </span>
              ) : null}
              {selectedStatement.agentRespondedAtLabel ? (
                <span>
                  Agent responded:{" "}
                  <LocalDateTime fallbackLabel={selectedStatement.agentRespondedAtLabel} value={selectedStatement.agentRespondedAt} />
                </span>
              ) : null}
              <span>Signed amount: use positive for bonus or reimbursement, negative for deduction.</span>
              <Button
                disabled={isSavingManualLineItems || !hasManualLineItemChanges}
                onClick={handleSaveManualLineItems}
                size="sm"
                type="button"
              >
                {isSavingManualLineItems ? "Saving..." : "Save adjustments"}
              </Button>
              <Button
                disabled={isSavingManualLineItems || !hasManualLineItemChanges}
                onClick={resetManualLineItems}
                size="sm"
                type="button"
                variant="secondary"
              >
                Reset changes
              </Button>
              <a className="office-button-secondary office-button-sm" href={`/api/office/accounting/statements/${selectedStatement.id}/pdf`} rel="noreferrer" target="_blank">
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

            <div className="office-accounting-candidate-block">
              <div className="office-accounting-candidate-head">
                <div className="office-accounting-candidate-copy">
                  <span className="office-mini-heading">Agent Delivery</span>
                  <p className="office-form-helper">
                    Send this payout statement inside Acre so it becomes a high-priority review task on the agent dashboard and notifications page.
                  </p>
                </div>

                <div className="office-section-actions">
                  <Button
                    disabled={isSendingStatement || isSavingManualLineItems || hasManualLineItemChanges}
                    onClick={handleSendStatementToAgent}
                    size="sm"
                    type="button"
                  >
                    {sendButtonLabel} to agent
                  </Button>
                </div>
              </div>

              <TextareaInput
                onChange={(event) => setSendMessage(event.target.value)}
                placeholder={
                  selectedStatement.reviewStatus === "revision_requested"
                    ? "Reply to the agent here before you resend the updated statement."
                    : "Optional note shown to the agent in the system timeline."
                }
                rows={3}
                value={sendMessage}
              />
              <p className="office-form-helper">
                {hasManualLineItemChanges
                  ? "Save manual adjustment changes first. Saving will move this statement back to Draft until you send it again."
                  : "Each send or resend is logged in-system and stays visible in Acre until the agent confirms it or requests another revision."}
              </p>
              {sendError ? <p className="office-inline-error">{sendError}</p> : null}
            </div>

            <div className="office-accounting-candidate-block">
              <div className="office-accounting-candidate-head">
                <div className="office-accounting-candidate-copy">
                  <span className="office-mini-heading">System Timeline</span>
                  <p className="office-form-helper">
                    Agent feedback and finance replies stay on the statement record so payout communication is kept inside Back Office.
                  </p>
                </div>
              </div>

              {selectedStatement.timeline.length > 0 ? (
                <div className="office-payout-statement-timeline">
                  {selectedStatement.timeline.map((item) => (
                    <article className="office-payout-statement-timeline-item" key={item.id}>
                      <div className="office-payout-statement-timeline-head">
                        <strong>{item.messageTypeLabel}</strong>
                        <span>{item.authorLabel}</span>
                        <span>{item.createdAtLabel}</span>
                      </div>
                      {item.body ? <p>{item.body}</p> : <p className="office-form-helper">No note added for this step.</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="office-form-helper">No agent-facing timeline entries have been recorded on this statement yet.</p>
              )}
            </div>

            <div className="office-accounting-candidate-block">
              <div className="office-accounting-candidate-head">
                <div className="office-accounting-candidate-copy">
                  <span className="office-mini-heading">Invoice Items</span>
                  <p className="office-form-helper">
                    These rows are the locked invoice-based snapshot that originally generated this payout statement.
                  </p>
                </div>
              </div>

              <HorizontalScrollArea>
                <DataTable className="office-table">
                  <DataTableHeader className="office-table-header office-table-row office-table-row-agent-statement-snapshot">
                    <span>Creation date</span>
                    <span>Invoice number</span>
                    <span>Owner</span>
                    <span>Building name</span>
                    <span>Unit</span>
                    <span>Gross</span>
                    <span>Pre split</span>
                    <span>Commission rate</span>
                    <span>Post split detail</span>
                    <span>Net commission</span>
                  </DataTableHeader>
                  <DataTableBody>
                    {selectedStatement.lineItems.map((lineItem) => (
                      <DataTableRow className="office-table-row office-table-row-agent-statement-snapshot" key={lineItem.id}>
                        <span>{formatStatementCellValue(lineItem.creationDate)}</span>
                        <span>{formatStatementCellValue(lineItem.invoiceNumber)}</span>
                        <span>{formatStatementCellValue(lineItem.ownerName)}</span>
                        <div className="office-agent-statement-building">
                          <strong>
                            <Link href={lineItem.transactionHref}>{formatStatementCellValue(lineItem.buildingName)}</Link>
                          </strong>
                          <p>{formatStatementCellValue(lineItem.propertyAddress)}</p>
                        </div>
                        <span>{formatStatementCellValue(lineItem.unitNumber)}</span>
                        <span>{lineItem.grossCommissionLabel}</span>
                        <span>{lineItem.preSplitLabel}</span>
                        <span>{formatStatementCellValue(lineItem.commissionRate)}</span>
                        <StatementPostSplitCell lineItem={lineItem} />
                        <span>{lineItem.netCommissionLabel}</span>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </HorizontalScrollArea>
            </div>

            <div className="office-accounting-candidate-block office-accounting-manual-section">
              <div className="office-accounting-candidate-head">
                <div className="office-accounting-candidate-copy">
                  <span className="office-mini-heading">Manual Adjustment Items</span>
                  <p className="office-form-helper">
                    Add signed adjustments to match the actual payout for this period. Positive values increase payout and negative values reduce it.
                  </p>
                </div>

                <div className="office-section-actions">
                  <Button onClick={handleAddManualLineItem} size="sm" type="button" variant="secondary">
                    Add Line Item
                  </Button>
                </div>
              </div>

              {manualLineItems.length > 0 ? (
                <HorizontalScrollArea>
                  <DataTable className="office-table">
                    <DataTableHeader className="office-table-header office-table-row office-table-row-agent-statement-manual">
                      <span>Memo</span>
                      <span>Amount</span>
                      <span>Actions</span>
                    </DataTableHeader>
                    <DataTableBody>
                      {manualLineItems.map((lineItem, index) => (
                        <DataTableRow className="office-table-row office-table-row-agent-statement-manual" key={lineItem.localId}>
                          <TextInput
                            aria-label={`Manual line item memo ${index + 1}`}
                            onChange={(event) => handleManualLineItemChange(lineItem.localId, "memo", event.target.value)}
                            placeholder="Insurance Deduction"
                            value={lineItem.memo}
                          />
                          <TextInput
                            aria-label={`Manual line item amount ${index + 1}`}
                            className="office-accounting-manual-amount-input"
                            inputMode="decimal"
                            onChange={(event) => handleManualLineItemChange(lineItem.localId, "amount", event.target.value)}
                            placeholder="-500"
                            value={lineItem.amount}
                          />
                          <div className="office-accounting-manual-row-actions">
                            <Button onClick={() => handleRemoveManualLineItem(lineItem.localId)} size="sm" type="button" variant="ghost">
                              Remove
                            </Button>
                          </div>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </HorizontalScrollArea>
              ) : (
                <p className="office-form-helper">No manual adjustments have been added to this statement yet.</p>
              )}

              <div className="office-accounting-manual-summary">
                <span>Invoice payout subtotal: {selectedStatement.invoicePayoutTotalLabel}</span>
                <span>Manual adjustments total: {formatCurrency(manualAdjustmentTotal)}</span>
                <strong>Final payout: {formatCurrency(statementFinalPayout)}</strong>
              </div>

              {manualSaveError ? <p className="office-inline-error">{manualSaveError}</p> : null}
            </div>
          </>
        ) : (
          <EmptyState description="Use the history list to open a saved statement and inspect its locked payout lines." title="No statement selected" />
        )}
      </ListPageSection>
    </ListPageStack>
  );
}
