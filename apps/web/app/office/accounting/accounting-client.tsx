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
import { useI18n } from "../../../lib/i18n/client";

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
  zhLabel: string;
}> = [
  { value: "draft", label: "Draft", zhLabel: "草稿" },
  { value: "awaiting_agent", label: "Awaiting agent", zhLabel: "等待经纪人确认" },
  { value: "revision_requested", label: "Revision requested", zhLabel: "要求修改" },
  { value: "confirmed", label: "Confirmed", zhLabel: "已确认" },
  { value: "paid", label: "Paid", zhLabel: "已付款" }
];

function translateAccountingCopy(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  const copyMap: Record<string, string> = {
    Draft: "草稿",
    "Awaiting agent": "等待经纪人确认",
    "Revision requested": "要求修改",
    Confirmed: "已确认",
    Paid: "已付款",
    Payable: "可付款",
    "Statement ready": "付款单就绪",
    Reviewed: "已审核",
    Missing: "缺失",
    Pending: "待处理",
    Posted: "已过账",
    Failed: "失败",
    Ready: "就绪",
    "Not posted": "未过账",
    "Invoice number": "发票号",
    "Created date": "创建日期",
    "Closing date": "成交日期"
  };

  return copyMap[value] ?? value;
}

function reviewStatusOptionLabel(option: { label: string; zhLabel: string }, isZh: boolean) {
  return isZh ? option.zhLabel : option.label;
}

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

function getQuickBooksBillStatusTone(status: SelectedStatementDetail["quickBooksBill"]["status"]) {
  if (status === "posted") {
    return "success" as const;
  }

  if (status === "failed") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getStatementStatusSelectClassName(status: StatementReviewStatus) {
  return `office-accounting-status-select office-accounting-status-select-${getReviewStatusTone(status)}`;
}

function getSendButtonLabel(reviewStatus: StatementReviewStatus, isSending: boolean, isZh: boolean) {
  if (isSending) {
    return isZh ? "发送中..." : "Sending...";
  }

  if (reviewStatus === "awaiting_agent") {
    return isZh ? "重新发送" : "Resend";
  }

  if (reviewStatus === "revision_requested") {
    return isZh ? "发送更新" : "Send update";
  }

  if (reviewStatus === "confirmed") {
    return isZh ? "发送修订版" : "Send revision";
  }

  if (reviewStatus === "paid") {
    return isZh ? "发送修订版" : "Send revision";
  }

  return isZh ? "发送" : "Send";
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

function validateManualLineItems(items: EditableManualLineItem[], isZh: boolean) {
  for (const [index, item] of items.entries()) {
    if (!item.memo.trim()) {
      return isZh ? `第 ${index + 1} 条手工调整需要填写说明。` : `Manual line item ${index + 1} memo is required.`;
    }

    if (!item.amount.trim()) {
      return isZh ? `第 ${index + 1} 条手工调整需要填写金额。` : `Manual line item ${index + 1} amount is required.`;
    }

    if (!/^[+-]?(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/.test(item.amount.trim())) {
      return isZh
        ? `第 ${index + 1} 条手工调整金额必须是最多两位小数的正负数。`
        : `Manual line item ${index + 1} amount must be a signed number with up to 2 decimal places.`;
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

function buildStatementBankFields(statement: SelectedStatementDetail, isZh: boolean): StatementBankField[] {
  const bankInformation = statement.bankInformation;

  if (!bankInformation) {
    return [];
  }

  return [
    { label: isZh ? "名" : "First name", value: bankInformation.firstName },
    { label: isZh ? "姓" : "Last name", value: bankInformation.lastName },
    { label: "Email", value: bankInformation.email },
    { label: isZh ? "电话号码" : "Phone number", value: bankInformation.phoneNumber },
    { label: isZh ? "地址" : "Address", value: bankInformation.address, wide: true },
    { label: isZh ? "银行名称" : "Bank name", value: bankInformation.bankName },
    { label: isZh ? "账户号码" : "Account number", value: bankInformation.accountNumber },
    { label: isZh ? "银行路由号" : "Routing number", value: bankInformation.routingNumber },
    {
      label: "SSN / EIN",
      value: [bankInformation.taxIdTypeLabel, bankInformation.taxIdValue].filter(Boolean).join(" · ")
    },
    { label: isZh ? "出生日期" : "Date of birth", value: bankInformation.dateOfBirth },
    { label: isZh ? "账户类型" : "Account type", value: bankInformation.accountTypeLabel || bankInformation.accountType }
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
  isZh: boolean;
}) {
  if (!input.hasFilterAgent || !input.hasSelectedInvoices) {
    return "";
  }

  if (input.previewMatchesFilter) {
    return input.selectedRowCount === 0
      ? input.isZh
        ? "生成前请至少选择一条佣金行。"
        : "Select at least one commission row before generating."
      : "";
  }

  return "";
}

export function OfficeAccountingClient({ snapshot }: OfficeAccountingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
  const [postingQuickBooksBillId, setPostingQuickBooksBillId] = useState("");
  const [updatingStatementStatusId, setUpdatingStatementStatusId] = useState("");
  const [pendingStatementStatuses, setPendingStatementStatuses] = useState<Record<string, StatementReviewStatus>>({});
  const [filterError, setFilterError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [manualSaveError, setManualSaveError] = useState("");
  const [sendError, setSendError] = useState("");
  const [historySendError, setHistorySendError] = useState("");
  const [historyStatusError, setHistoryStatusError] = useState("");
  const [quickBooksPostError, setQuickBooksPostError] = useState("");
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
  const selectedStatementBankFields = selectedStatement ? buildStatementBankFields(selectedStatement, isZh) : [];
  const sendButtonLabel = selectedStatement ? getSendButtonLabel(selectedStatement.reviewStatus, isSendingStatement, isZh) : isZh ? "发送" : "Send";
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
    selectedRowCount: selectedRows.length,
    isZh
  });
  const hasSelectedReusableRows = selectedRows.some((row) => row.statusValue === "payable" || row.statusValue === "paid");
  const generateButtonLabel = isGenerating ? (isZh ? "生成中..." : "Generating...") : isZh ? "生成付款单" : "Generate statement";
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
      setPostingQuickBooksBillId("");
      setQuickBooksPostError("");
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
    setPostingQuickBooksBillId("");
    setQuickBooksPostError("");
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
      setFilterError(isZh ? "请先从搜索结果中选择一个经纪人，再加载发票。" : "Select an agent from the search results before loading invoices.");
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
      setFilterError(isZh ? "预览发票行前，请先选择一个经纪人。" : "Choose one agent before previewing invoice rows.");
      return;
    }

    if (!hasSelectedInvoices) {
      setFilterError(isZh ? "预览行明细前，请至少选择一个发票号。" : "Select at least one invoice number before previewing rows.");
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
      setFilterError(isZh ? "生成前请先选择一个经纪人。" : "Choose one agent before generating.");
      return;
    }

    if (!hasSelectedInvoices) {
      setFilterError(isZh ? "生成前请至少选择一个发票号。" : "Select at least one invoice number before generating.");
      return;
    }

    if (previewMatchesFilter && selectedCalculationIds.length === 0) {
      setFilterError(isZh ? "生成前请至少选择一条佣金行。" : "Select at least one commission row before generating.");
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
        throw new Error(body?.error ?? (isZh ? "生成经纪人付款单失败。" : "Failed to generate the agent statement."));
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
      setGenerationError(error instanceof Error ? error.message : isZh ? "生成经纪人付款单失败。" : "Failed to generate the agent statement.");
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

    const validationError = validateManualLineItems(manualLineItems, isZh);

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
        throw new Error(body?.error ?? (isZh ? "保存手工调整失败。" : "Failed to save statement manual adjustments."));
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setManualSaveError(error instanceof Error ? error.message : isZh ? "保存手工调整失败。" : "Failed to save statement manual adjustments.");
    } finally {
      setIsSavingManualLineItems(false);
    }
  }

  async function handleSendStatementToAgent() {
    if (!selectedStatement) {
      return;
    }

    if (hasManualLineItemChanges) {
      setSendError(isZh ? "发送给经纪人前，请先保存当前手工调整。" : "Save the current manual adjustment changes before sending the statement to the agent.");
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
        throw new Error(body?.error ?? (isZh ? "发送付款单失败。" : "Failed to send the payout statement to the agent."));
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : isZh ? "发送付款单失败。" : "Failed to send the payout statement to the agent.");
    } finally {
      setIsSendingStatement(false);
    }
  }

  async function handleQuickSendStatement(statement: OfficeAgentPayoutStatementsWorkspaceSnapshot["history"][number]) {
    const hasUnsavedSelectedChanges = selectedStatement?.id === statement.id && hasManualLineItemChanges;

    if (hasUnsavedSelectedChanges) {
      setHistorySendError(isZh ? "发送这张付款单前，请先保存当前手工调整。" : "Save the current manual adjustment changes before sending this statement to the agent.");
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
        throw new Error(body?.error ?? (isZh ? "发送付款单失败。" : "Failed to send the payout statement to the agent."));
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setHistorySendError(error instanceof Error ? error.message : isZh ? "发送付款单失败。" : "Failed to send the payout statement to the agent.");
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
      setHistoryStatusError(isZh ? "更新付款单状态前，请先保存当前手工调整。" : "Save the current manual adjustment changes before updating this statement status.");
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
        throw new Error(body?.error ?? (isZh ? "更新付款单状态失败。" : "Failed to update the payout statement status."));
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
      setHistoryStatusError(error instanceof Error ? error.message : isZh ? "更新付款单状态失败。" : "Failed to update the payout statement status.");
    } finally {
      setUpdatingStatementStatusId("");
    }
  }

  async function handlePostStatementToQuickBooks(statement: {
    id: string;
    quickBooksBill: SelectedStatementDetail["quickBooksBill"];
  }) {
    if (!statement.quickBooksBill.canPost) {
      setQuickBooksPostError(isZh ? "经纪人确认付款单后，才能过账到 QuickBooks。" : "The agent must confirm this payout statement before it can be posted to QuickBooks.");
      return;
    }

    if (selectedStatement?.id === statement.id && hasManualLineItemChanges) {
      setQuickBooksPostError(isZh ? "过账到 QuickBooks 前，请先保存当前手工调整。" : "Save the current manual adjustment changes before posting this statement to QuickBooks.");
      return;
    }

    setPostingQuickBooksBillId(statement.id);
    setQuickBooksPostError("");
    setHistorySendError("");
    setHistoryStatusError("");

    try {
      const response = await fetch(`/api/office/accounting/statements/${statement.id}/quickbooks-bill`, {
        method: "POST"
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? (isZh ? "创建 QuickBooks 未付款账单失败。" : "Failed to post the QuickBooks unpaid bill."));
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setQuickBooksPostError(error instanceof Error ? error.message : isZh ? "创建 QuickBooks 未付款账单失败。" : "Failed to post the QuickBooks unpaid bill.");
    } finally {
      setPostingQuickBooksBillId("");
    }
  }

  return (
    <ListPageStack className="office-accounting-statements-stack">
      <ListPageSection
        subtitle={
          isZh
            ? "先选择经纪人，加载相关发票号，再从这些发票预览或生成付款单。"
            : "Choose an agent first, load the related invoice numbers, then preview or generate the statement from those invoices."
        }
        title={isZh ? "付款单筛选" : "Statement filters"}
      >
        <ListPageFilters as="form" className="office-report-filters office-list-filters" onSubmit={handleApplyFilters}>
          <FilterField label={isZh ? "经纪人" : "Agent"}>
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
                placeholder={isZh ? "输入经纪人姓名" : "Type agent name"}
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
                        {filterState.membershipId === option.id ? <strong>{isZh ? "已选择" : "Selected"}</strong> : null}
                      </button>
                    ))
                  ) : (
                    <div className="office-autocomplete-empty">{isZh ? "没有匹配的经纪人。" : "No matching agents."}</div>
                  )}
                </div>
              ) : null}
            </div>
          </FilterField>

          <div className="office-filter-actions">
            <Button disabled={isPreviewLoading || !hasFilterAgent} type="submit" variant="secondary">
              {isPreviewLoading ? (isZh ? "加载中..." : "Loading...") : isZh ? "加载发票" : "Load invoices"}
            </Button>
            <Button onClick={resetFilters} type="button" variant="secondary">
              {isZh ? "重置" : "Reset"}
            </Button>
          </div>
        </ListPageFilters>

        {filterError ? <p className="office-inline-error">{filterError}</p> : null}

        {!filterError && !hasFilterAgent ? (
          <p className="office-form-helper">
            {!hasFilterAgent && agentSearchValue.trim()
              ? isZh
                ? "请从搜索结果中选择一个经纪人继续。"
                : "Pick one agent from the search results to continue."
              : isZh
                ? "选择经纪人后加载候选发票。"
                : "Choose an agent to load invoice candidates."}
          </p>
        ) : null}
      </ListPageSection>

      <ListPageSection
        subtitle={
          isZh
            ? "选择发票号，并在生成付款单前集中核对匹配的佣金行。"
            : "Select invoice numbers and review the matching commission rows in one place before generating the statement."
        }
        title={isZh ? "付款单候选项" : "Statement candidates"}
      >
        {hasLoadedAgent ? (
          snapshot.filters.invoiceOptions.length > 0 ? (
            <div className="office-accounting-candidate-workspace">
              <div className="office-accounting-candidate-block">
                <div className="office-accounting-candidate-head">
                  <div className="office-accounting-candidate-copy">
                    <span className="office-mini-heading">{isZh ? "发票" : "Invoices"}</span>
                    <p className="office-form-helper">
                      {isZh
                        ? "为当前经纪人选择一个或多个发票号。除非你在下面取消勾选具体行，每张发票会包含所有匹配且可生成的佣金行。"
                        : "Select one or more invoice numbers for the loaded agent. Each invoice contributes all matching eligible rows unless you later uncheck specific rows below."}
                    </p>
                  </div>
                  <div className="office-section-actions">
                    <Button onClick={() => toggleAllInvoiceOptions(true)} size="sm" type="button" variant="secondary">
                      {isZh ? "全选" : "Select all"}
                    </Button>
                    <Button onClick={() => toggleAllInvoiceOptions(false)} size="sm" type="button" variant="ghost">
                      {isZh ? "清空" : "Clear"}
                    </Button>
                    <Button
                      disabled={isPreviewLoading || !hasSelectedInvoices}
                      onClick={handlePreviewSelectedInvoices}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {isPreviewLoading ? (isZh ? "加载中..." : "Loading...") : isZh ? "预览行明细" : "Preview rows"}
                    </Button>
                  </div>
                </div>

                <HorizontalScrollArea>
                  <DataTable className="office-table">
                    <DataTableHeader className="office-table-header office-table-row office-table-row-accounting-statement-invoices">
                      <span>{isZh ? "选择" : "Select"}</span>
                      <span>{isZh ? "发票号" : "Invoice number"}</span>
                      <span>{isZh ? "行数" : "Rows"}</span>
                      <span>{isZh ? "付款金额" : "Payout"}</span>
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
                    <span className="office-mini-heading">{isZh ? "佣金行" : "Rows"}</span>
                    <p className="office-form-helper">
                      {isZh
                        ? "预览当前发票号下的佣金行。生成前可以取消勾选单独的行。"
                        : "Preview the commission rows under the currently selected invoice numbers. You can uncheck individual rows before generating."}
                    </p>
                  </div>
                  {snapshot.candidateRows.length > 0 && previewMatchesFilter ? (
                    <div className="office-section-actions">
                      <Button onClick={() => toggleAllCandidates(true)} size="sm" type="button" variant="secondary">
                        {isZh ? "全选行" : "Select all rows"}
                      </Button>
                      <Button onClick={() => toggleAllCandidates(false)} size="sm" type="button" variant="ghost">
                        {isZh ? "清空行" : "Clear rows"}
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
                            <span>{isZh ? "选择" : "Select"}</span>
                            <span>{isZh ? "发票" : "Invoice"}</span>
                            <span>{isZh ? "交易" : "Transaction"}</span>
                            <span>{isZh ? "成交日" : "Closing"}</span>
                            <span>{isZh ? "计算时间" : "Calculated"}</span>
                            <span>{isZh ? "总佣金" : "Gross"}</span>
                            <span>{isZh ? "费用" : "Fees"}</span>
                            <span>{isZh ? "付款金额" : "Payout"}</span>
                            <span>{isZh ? "状态" : "Status"}</span>
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
                                <span>{row.closingDate || translateAccountingCopy("Missing", isZh)}</span>
                                <span>{row.calculatedAt}</span>
                                <span>{row.grossCommissionLabel}</span>
                                <span>{row.feesLabel}</span>
                                <span>{row.statementAmountLabel}</span>
                                <span>
                                  <StatusBadge tone={getStatementStatusTone(row.status)}>{translateAccountingCopy(row.status, isZh)}</StatusBadge>
                                </span>
                              </DataTableRow>
                            ))}
                          </DataTableBody>
                        </DataTable>
                      </HorizontalScrollArea>
                    ) : (
                      <EmptyState
                        description={
                          isZh
                            ? "当前所选发票号下没有可用的佣金行。"
                            : "No commission rows are currently available under the selected invoice numbers."
                        }
                        title={isZh ? "没有可付款候选项" : "No payout candidates"}
                      />
                    )
                  ) : (
                    <EmptyState
                      description={
                        isZh
                          ? "点击“预览行明细”，加载当前所选发票号对应的精确佣金行。"
                          : "Click Preview rows to load the exact commission rows for the currently selected invoice numbers."
                      }
                      title={isZh ? "预览所选行" : "Preview selected rows"}
                    />
                  )
                ) : (
                  <EmptyState
                    description={isZh ? "选择一个或多个发票号，以加载匹配的佣金行。" : "Select one or more invoice numbers to load the matching commission rows."}
                    title={isZh ? "选择发票" : "Choose invoices"}
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              description={
                isZh
                  ? "这位经纪人当前没有带已保存发票号的可用佣金行。"
                  : "This agent does not currently have any eligible commission rows with a saved invoice number."
              }
              title={isZh ? "没有候选发票" : "No invoice candidates"}
            />
          )
        ) : (
          <EmptyState
            description={isZh ? "请先选择经纪人并加载候选发票。" : "Choose an agent and load their invoice candidates first."}
            title={isZh ? "加载经纪人发票" : "Load agent invoices"}
          />
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
            ? isZh
              ? "行级勾选只作用于当前已预览的发票选择。"
              : "Row-level changes apply only to the currently previewed invoice selection."
            : isZh
              ? "未预览时也可以按所选发票号直接生成，但下方行合计只有预览后才是最终明细。"
              : "Direct generation is allowed from the selected invoice numbers even before preview, but row totals below are only final after preview."
        }
        title={isZh ? "所选付款汇总" : "Selected payout summary"}
      >
        <ListPageStatsGrid>
          <StatCard hint={isZh ? "当前已选择的发票号" : "currently selected invoice numbers"} label={isZh ? "所选发票" : "Selected invoices"} value={selectedSummary.invoiceCount} />
          <StatCard hint={isZh ? "当前选择包含的佣金行" : "rows currently included by the selection"} label={isZh ? "所选行" : "Selected rows"} value={selectedSummary.rowCount} />
          <StatCard
            hint={isZh ? "所选总佣金合计" : "sum of selected gross commission"}
            label={isZh ? "总佣金" : "Gross commission"}
            value={selectedSummary.gross === null ? (isZh ? "需要预览" : "Preview required") : formatCurrency(selectedSummary.gross)}
          />
          <StatCard
            hint={isZh ? "所选费用合计" : "sum of selected fees"}
            label={isZh ? "费用" : "Fees"}
            value={selectedSummary.fees === null ? (isZh ? "需要预览" : "Preview required") : formatCurrency(selectedSummary.fees)}
          />
          <StatCard hint={isZh ? "所选付款行合计" : "sum of selected payout rows"} label={isZh ? "净付款" : "Net payout"} value={formatCurrency(selectedSummary.payout)} />
        </ListPageStatsGrid>

        {!previewMatchesFilter && hasSelectedInvoices && canGenerateStatement ? (
          <p className="office-form-helper">
            {isZh
              ? "如果要在生成前检查或取消单独行，请先预览所选发票。直接生成会包含这些发票下所有可生成的行。"
              : "Preview the selected invoices if you want to inspect or uncheck individual rows before generating. Direct generate will include all eligible rows under those invoices."}
          </p>
        ) : null}

        {previewMatchesFilter && hasSelectedReusableRows ? (
          <p className="office-form-helper">
            {isZh
              ? "已标记为可付款或已付款的行仍可重新生成到新的付款单快照中；重新生成不会把已付款行降级。"
              : "Rows already marked Payable or Paid can still be regenerated into a fresh statement snapshot. Regenerating does not downgrade Paid rows."}
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
        subtitle={
          isZh
            ? "已保存付款单会保留固定快照，PDF 下载始终基于同一份快照重建。这里可快速发送，或打开查看备注和完整时间线。"
            : "Saved payout statements stay durable, so PDF downloads always rebuild from the same saved snapshot. Use Send here for quick internal delivery, or Open for notes and the full timeline."
        }
        title={isZh ? "付款单历史" : "Statement history"}
      >
        {historySendError ? <p className="office-inline-error">{historySendError}</p> : null}
        {historyStatusError ? <p className="office-inline-error">{historyStatusError}</p> : null}
        {quickBooksPostError ? <p className="office-inline-error">{quickBooksPostError}</p> : null}
        {snapshot.history.length > 0 ? (
          <HorizontalScrollArea>
            <DataTable className="office-table">
              <DataTableHeader className="office-table-header office-table-row office-table-row-accounting-statement-history">
                <span>{isZh ? "生成时间" : "Generated"}</span>
                <span>{isZh ? "经纪人" : "Agent"}</span>
                <span>{isZh ? "状态" : "Status"}</span>
                <span>{isZh ? "周期" : "Period"}</span>
                <span>{isZh ? "依据" : "Basis"}</span>
                <span>{isZh ? "行数" : "Rows"}</span>
                <span>{isZh ? "付款合计" : "Total payout"}</span>
                <span>{isZh ? "QB 账单" : "QB bill"}</span>
                <span>{isZh ? "操作" : "Actions"}</span>
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
                          aria-label={isZh ? `更新 ${statement.agentLabel} 的付款单状态` : `Update payout statement status for ${statement.agentLabel}`}
                          className={getStatementStatusSelectClassName(displayedReviewStatus)}
                          disabled={updatingStatementStatusId === statement.id}
                          onChange={(event) => void handleUpdateStatementStatus(statement, event.target.value as StatementReviewStatus)}
                          value={displayedReviewStatus}
                        >
                          {statementReviewStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {reviewStatusOptionLabel(option, isZh)}
                            </option>
                          ))}
                        </SelectInput>
                      </span>
                      <span>{statement.periodLabel}</span>
                      <span>{translateAccountingCopy(statement.periodBasisLabel, isZh)}</span>
                      <span>{statement.lineItemCount}</span>
                      <span>{statement.totalStatementAmountLabel}</span>
                      <span>
                        <StatusBadge tone={getQuickBooksBillStatusTone(statement.quickBooksBill.status)}>
                          {statement.quickBooksBill.docNumber || translateAccountingCopy(statement.quickBooksBill.statusLabel, isZh)}
                        </StatusBadge>
                      </span>
                      <div className="office-accounting-inline-actions office-accounting-statement-history-actions">
                        {statement.quickBooksBill.canPost ? (
                          <Button
                            className="office-inline-action-sm"
                            disabled={postingQuickBooksBillId.length > 0 || (selectedStatement?.id === statement.id && hasManualLineItemChanges)}
                            onClick={() => void handlePostStatementToQuickBooks(statement)}
                            size="sm"
                            type="button"
                          >
                            {postingQuickBooksBillId === statement.id ? (isZh ? "过账中..." : "Posting...") : isZh ? "过账到 QuickBooks" : "Post to QuickBooks"}
                          </Button>
                        ) : null}
                        <Button
                          className="office-inline-action-sm"
                          disabled={quickSendingStatementId.length > 0 || (selectedStatement?.id === statement.id && hasManualLineItemChanges)}
                          onClick={() => void handleQuickSendStatement(statement)}
                          size="sm"
                          type="button"
                        >
                          {getSendButtonLabel(statement.reviewStatus, quickSendingStatementId === statement.id, isZh)}
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
                          {isZh ? "打开" : "Open"}
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
          <EmptyState
            description={isZh ? "保存付款快照后，生成的付款单会显示在这里。" : "Generated statements will appear here once a payout snapshot has been saved."}
            title={isZh ? "还没有保存的付款单" : "No saved statements yet"}
          />
        )}
      </ListPageSection>

      <ListPageSection
        subtitle={
          selectedStatement
            ? `${translateAccountingCopy(selectedStatement.periodBasisLabel, isZh)} · ${selectedStatement.periodLabel}`
            : isZh
              ? "选择已保存付款单，查看固定行项目快照并下载 PDF。"
              : "Select a saved statement to review the durable line-item snapshot and download its PDF."
        }
        title={selectedStatement ? (isZh ? "付款单详情" : "Statement detail") : isZh ? "选择付款单" : "Select a statement"}
      >
        {selectedStatement ? (
          <>
            <ListPageStatsGrid>
              <StatCard hint={isZh ? "这张付款单对应的经纪人" : "agent on this saved payout statement"} label={isZh ? "经纪人" : "Agent"} value={selectedStatement.agentLabel} />
              <StatCard
                hint={isZh ? "当前内部确认状态" : "current internal confirmation state"}
                label={isZh ? "审核状态" : "Review status"}
                value={translateAccountingCopy(selectedStatement.reviewStatusLabel, isZh)}
              />
              <StatCard hint={isZh ? "发票行加手工调整" : "invoice rows plus manual adjustments"} label={isZh ? "行数" : "Rows"} value={selectedStatement.lineItemCount} />
              <StatCard hint={isZh ? "快照中的总佣金" : "snapshot total gross commission"} label={isZh ? "总佣金" : "Gross commission"} value={selectedStatement.totalGrossCommissionLabel} />
              <StatCard hint={isZh ? "发票来源付款小计" : "invoice-based payout subtotal"} label={isZh ? "发票付款" : "Invoice payout"} value={selectedStatement.invoicePayoutTotalLabel} />
              <StatCard hint={isZh ? "保存前的实时手工调整合计" : "live manual adjustment total before save"} label={isZh ? "手工调整" : "Manual adjustments"} value={formatCurrency(manualAdjustmentTotal)} />
              <StatCard hint={isZh ? "保存前的实时最终付款合计" : "live final payout total before save"} label={isZh ? "最终付款" : "Final payout"} value={formatCurrency(statementFinalPayout)} />
            </ListPageStatsGrid>

            <div className="office-inline-meta">
              <span>
                {isZh ? "生成时间" : "Generated"}: <LocalDateTime fallbackLabel={selectedStatement.generatedAtLabel} value={selectedStatement.generatedAt} />
              </span>
              <span>{isZh ? "生成者" : "Generated by"}: {selectedStatement.generatedByLabel}</span>
              <span>
                {isZh ? "状态" : "Status"}:{" "}
                <StatusBadge tone={getReviewStatusTone(selectedStatement.reviewStatus)}>
                  {translateAccountingCopy(selectedStatement.reviewStatusLabel, isZh)}
                </StatusBadge>
              </span>
              {selectedStatement.lastSharedAtLabel ? (
                <span>
                  {isZh ? "上次发送" : "Last sent"}: <LocalDateTime fallbackLabel={selectedStatement.lastSharedAtLabel} value={selectedStatement.lastSharedAt} />
                </span>
              ) : null}
              {selectedStatement.agentRespondedAtLabel ? (
                <span>
                  {isZh ? "经纪人回复" : "Agent responded"}:{" "}
                  <LocalDateTime fallbackLabel={selectedStatement.agentRespondedAtLabel} value={selectedStatement.agentRespondedAt} />
                </span>
              ) : null}
              <span>
                {isZh
                  ? "带符号金额：奖金或报销填正数，扣款填负数。"
                  : "Signed amount: use positive for bonus or reimbursement, negative for deduction."}
              </span>
              <Button
                disabled={isSavingManualLineItems || !hasManualLineItemChanges}
                onClick={handleSaveManualLineItems}
                size="sm"
                type="button"
              >
                {isSavingManualLineItems ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存调整" : "Save adjustments"}
              </Button>
              <Button
                disabled={isSavingManualLineItems || !hasManualLineItemChanges}
                onClick={resetManualLineItems}
                size="sm"
                type="button"
                variant="secondary"
              >
                {isZh ? "重置修改" : "Reset changes"}
              </Button>
              <a className="office-button-secondary office-button-sm" href={`/api/office/accounting/statements/${selectedStatement.id}/pdf`} rel="noreferrer" target="_blank">
                {isZh ? "下载 PDF" : "Download PDF"}
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
              <p className="office-form-helper">{isZh ? "这个成员档案还没有保存银行信息。" : "No bank information has been saved on this member profile yet."}</p>
            )}

            <div className="office-accounting-candidate-block">
              <div className="office-accounting-candidate-head">
                <div className="office-accounting-candidate-copy">
                  <span className="office-mini-heading">{isZh ? "发送给经纪人" : "Agent Delivery"}</span>
                  <p className="office-form-helper">
                    {isZh
                      ? "在 Acre 内发送这张付款单，让它出现在经纪人工作台和通知页的高优先级审核任务中。"
                      : "Send this payout statement inside Acre so it becomes a high-priority review task on the agent dashboard and notifications page."}
                  </p>
                </div>

                <div className="office-section-actions">
                  <Button
                    disabled={isSendingStatement || isSavingManualLineItems || hasManualLineItemChanges}
                    onClick={handleSendStatementToAgent}
                    size="sm"
                    type="button"
                  >
                    {isZh ? `${sendButtonLabel}给经纪人` : `${sendButtonLabel} to agent`}
                  </Button>
                </div>
              </div>

              <TextareaInput
                onChange={(event) => setSendMessage(event.target.value)}
                placeholder={
                  selectedStatement.reviewStatus === "revision_requested"
                    ? isZh
                      ? "重新发送更新后的付款单前，在这里回复经纪人。"
                      : "Reply to the agent here before you resend the updated statement."
                    : isZh
                      ? "可选备注，会显示在经纪人的系统时间线中。"
                      : "Optional note shown to the agent in the system timeline."
                }
                rows={3}
                value={sendMessage}
              />
              <p className="office-form-helper">
                {hasManualLineItemChanges
                  ? isZh
                    ? "请先保存手工调整。保存后这张付款单会回到草稿状态，直到你再次发送。"
                    : "Save manual adjustment changes first. Saving will move this statement back to Draft until you send it again."
                  : isZh
                    ? "每次发送或重新发送都会记录在系统中，并持续显示在 Acre，直到经纪人确认或再次要求修改。"
                    : "Each send or resend is logged in-system and stays visible in Acre until the agent confirms it or requests another revision."}
              </p>
              {sendError ? <p className="office-inline-error">{sendError}</p> : null}
            </div>

            <div className="office-accounting-candidate-block">
              <div className="office-accounting-candidate-head">
                <div className="office-accounting-candidate-copy">
                  <span className="office-mini-heading">{isZh ? "QuickBooks 应付账款" : "QuickBooks AP"}</span>
                  <p className="office-form-helper">
                    {isZh
                      ? "将经纪人已确认的付款单过账到这个 Acre 办公室对应的 QuickBooks 公司，作为待人工复核和付款的未付账单。"
                      : "Post the agent-confirmed statement to the QuickBooks company mapped to this Acre office as an unpaid bill for manual review and payment."}
                  </p>
                </div>

                <div className="office-section-actions">
                  <StatusBadge tone={getQuickBooksBillStatusTone(selectedStatement.quickBooksBill.status)}>
                    {selectedStatement.quickBooksBill.docNumber || translateAccountingCopy(selectedStatement.quickBooksBill.statusLabel, isZh)}
                  </StatusBadge>
                  {selectedStatement.quickBooksBill.canPost ? (
                    <Button
                      disabled={postingQuickBooksBillId.length > 0 || hasManualLineItemChanges}
                      onClick={() => void handlePostStatementToQuickBooks(selectedStatement)}
                      size="sm"
                      type="button"
                    >
                      {postingQuickBooksBillId === selectedStatement.id ? (isZh ? "过账中..." : "Posting...") : isZh ? "过账到 QuickBooks" : "Post to QuickBooks"}
                    </Button>
                  ) : null}
                </div>
              </div>

              <p className="office-form-helper">
                {selectedStatement.quickBooksBill.status === "posted"
                  ? isZh
                    ? `QuickBooks 账单 ${selectedStatement.quickBooksBill.docNumber || selectedStatement.quickBooksBill.billId} 已作为未付款账单过账。`
                    : `QuickBooks bill ${selectedStatement.quickBooksBill.docNumber || selectedStatement.quickBooksBill.billId} was posted as unpaid.`
                  : selectedStatement.quickBooksBill.canPost
                    ? isZh
                      ? "这个动作只会在映射的 QuickBooks 公司中创建应付账款；仍需菲菲人工复核并付款。"
                      : "This action creates Accounts Payable only in the mapped QuickBooks company; Feifei still checks and pays the bill manually."
                    : isZh
                      ? "经纪人在 Acre 内确认付款单后，这个按钮才会出现。"
                      : "The button appears after the agent confirms the statement inside Acre."}
              </p>
              {selectedStatement.quickBooksBill.postedAtLabel ? (
                <p className="office-form-helper">{isZh ? "过账时间" : "Posted"}: {selectedStatement.quickBooksBill.postedAtLabel}</p>
              ) : null}
              {selectedStatement.quickBooksBill.syncError ? (
                <p className="office-inline-error">{selectedStatement.quickBooksBill.syncError}</p>
              ) : null}
              {quickBooksPostError ? <p className="office-inline-error">{quickBooksPostError}</p> : null}
            </div>

            <div className="office-accounting-candidate-block">
              <div className="office-accounting-candidate-head">
                <div className="office-accounting-candidate-copy">
                  <span className="office-mini-heading">{isZh ? "系统时间线" : "System Timeline"}</span>
                  <p className="office-form-helper">
                    {isZh
                      ? "经纪人反馈和财务回复都会保留在付款单记录中，让付款沟通留在后台系统内。"
                      : "Agent feedback and finance replies stay on the statement record so payout communication is kept inside Back Office."}
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
                      {item.body ? <p>{item.body}</p> : <p className="office-form-helper">{isZh ? "这一步没有添加备注。" : "No note added for this step."}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="office-form-helper">{isZh ? "这张付款单还没有面向经纪人的时间线记录。" : "No agent-facing timeline entries have been recorded on this statement yet."}</p>
              )}
            </div>

            <div className="office-accounting-candidate-block">
              <div className="office-accounting-candidate-head">
                <div className="office-accounting-candidate-copy">
                  <span className="office-mini-heading">{isZh ? "发票项目" : "Invoice Items"}</span>
                  <p className="office-form-helper">
                    {isZh
                      ? "这些行是最初生成这张付款单时锁定的发票快照。"
                      : "These rows are the locked invoice-based snapshot that originally generated this payout statement."}
                  </p>
                </div>
              </div>

              <HorizontalScrollArea>
                <DataTable className="office-table">
                  <DataTableHeader className="office-table-header office-table-row office-table-row-agent-statement-snapshot">
                    <span>{isZh ? "创建日期" : "Creation date"}</span>
                    <span>{isZh ? "发票号" : "Invoice number"}</span>
                    <span>{isZh ? "业主" : "Owner"}</span>
                    <span>{isZh ? "楼宇名称" : "Building name"}</span>
                    <span>{isZh ? "单元" : "Unit"}</span>
                    <span>{isZh ? "总佣金" : "Gross"}</span>
                    <span>{isZh ? "拆分前" : "Pre split"}</span>
                    <span>{isZh ? "佣金比例" : "Commission rate"}</span>
                    <span>{isZh ? "拆分后明细" : "Post split detail"}</span>
                    <span>{isZh ? "净佣金" : "Net commission"}</span>
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
                  <span className="office-mini-heading">{isZh ? "手工调整项目" : "Manual Adjustment Items"}</span>
                  <p className="office-form-helper">
                    {isZh
                      ? "添加带正负号的调整，让本周期实际付款金额对齐。正数增加付款，负数减少付款。"
                      : "Add signed adjustments to match the actual payout for this period. Positive values increase payout and negative values reduce it."}
                  </p>
                </div>

                <div className="office-section-actions">
                  <Button onClick={handleAddManualLineItem} size="sm" type="button" variant="secondary">
                    {isZh ? "添加项目" : "Add Line Item"}
                  </Button>
                </div>
              </div>

              {manualLineItems.length > 0 ? (
                <HorizontalScrollArea>
                  <DataTable className="office-table">
                    <DataTableHeader className="office-table-header office-table-row office-table-row-agent-statement-manual">
                      <span>{isZh ? "说明" : "Memo"}</span>
                      <span>{isZh ? "金额" : "Amount"}</span>
                      <span>{isZh ? "操作" : "Actions"}</span>
                    </DataTableHeader>
                    <DataTableBody>
                      {manualLineItems.map((lineItem, index) => (
                        <DataTableRow className="office-table-row office-table-row-agent-statement-manual" key={lineItem.localId}>
                          <TextInput
                            aria-label={isZh ? `第 ${index + 1} 条手工调整说明` : `Manual line item memo ${index + 1}`}
                            onChange={(event) => handleManualLineItemChange(lineItem.localId, "memo", event.target.value)}
                            placeholder={isZh ? "保险扣款" : "Insurance Deduction"}
                            value={lineItem.memo}
                          />
                          <TextInput
                            aria-label={isZh ? `第 ${index + 1} 条手工调整金额` : `Manual line item amount ${index + 1}`}
                            className="office-accounting-manual-amount-input"
                            inputMode="decimal"
                            onChange={(event) => handleManualLineItemChange(lineItem.localId, "amount", event.target.value)}
                            placeholder="-500"
                            value={lineItem.amount}
                          />
                          <div className="office-accounting-manual-row-actions">
                            <Button onClick={() => handleRemoveManualLineItem(lineItem.localId)} size="sm" type="button" variant="ghost">
                              {isZh ? "移除" : "Remove"}
                            </Button>
                          </div>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </HorizontalScrollArea>
              ) : (
                <p className="office-form-helper">{isZh ? "这张付款单还没有添加手工调整。" : "No manual adjustments have been added to this statement yet."}</p>
              )}

              <div className="office-accounting-manual-summary">
                <span>{isZh ? "发票付款小计" : "Invoice payout subtotal"}: {selectedStatement.invoicePayoutTotalLabel}</span>
                <span>{isZh ? "手工调整合计" : "Manual adjustments total"}: {formatCurrency(manualAdjustmentTotal)}</span>
                <strong>{isZh ? "最终付款" : "Final payout"}: {formatCurrency(statementFinalPayout)}</strong>
              </div>

              {manualSaveError ? <p className="office-inline-error">{manualSaveError}</p> : null}
            </div>
          </>
        ) : (
          <EmptyState
            description={isZh ? "从历史列表打开已保存付款单，查看锁定的付款行。" : "Use the history list to open a saved statement and inspect its locked payout lines."}
            title={isZh ? "未选择付款单" : "No statement selected"}
          />
        )}
      </ListPageSection>
    </ListPageStack>
  );
}
