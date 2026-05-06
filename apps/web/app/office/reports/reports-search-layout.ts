import type {
  OfficeTransactionReportSearchFieldKey,
  OfficeTransactionReportsFilters
} from "@acre/db";

export const defaultReportsPage = 1;
export const defaultReportsPageSize = 20;
export const maxReportsPageSize = 100;

export type ReportSearchFilterState = {
  ownerMembershipId: string;
  createdAtOperator: OfficeTransactionReportsFilters["createdAtOperator"];
  createdAtValue: string;
  createdAtFrom: string;
  createdAtTo: string;
  buyerTenant: string;
  closingMoveInOperator: OfficeTransactionReportsFilters["closingMoveInOperator"];
  closingMoveInValue: string;
  closingMoveInFrom: string;
  closingMoveInTo: string;
  commissionOperator: OfficeTransactionReportsFilters["commissionOperator"];
  commissionValue: string;
  commissionMin: string;
  commissionMax: string;
  askingPriceOperator: OfficeTransactionReportsFilters["askingPriceOperator"];
  askingPriceValue: string;
  askingPriceMin: string;
  askingPriceMax: string;
  purchasedPriceOperator: OfficeTransactionReportsFilters["purchasedPriceOperator"];
  purchasedPriceValue: string;
  purchasedPriceMin: string;
  purchasedPriceMax: string;
  transactionStatuses: string[];
  invoiceNumber: string;
  departmentIds: string[];
  teamLeaderMembershipIds: string[];
  transactionTypes: string[];
  representingSides: string[];
  layouts: string[];
  companyReferral: OfficeTransactionReportsFilters["companyReferral"];
  sortBy: OfficeTransactionReportsFilters["sortBy"];
  sortDirection: OfficeTransactionReportsFilters["sortDirection"];
};

export type ReportSortOption = {
  value: ReportSearchFilterState["sortBy"];
  label: string;
};

export type ReportSortDirectionOption = {
  value: ReportSearchFilterState["sortDirection"];
  label: string;
};

const reportSortOptions: ReportSortOption[] = [
  { value: "created_at", label: "创建日期" },
  { value: "asking_price", label: "挂牌价" },
  { value: "purchased_price", label: "成交价" },
  { value: "gross_commission", label: "总佣金" },
  { value: "status", label: "状态" }
];

function appendValue(searchParams: URLSearchParams, key: string, value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return;
  }

  searchParams.set(key, normalized);
}

function appendArrayValues(searchParams: URLSearchParams, key: string, values: string[]) {
  for (const value of values) {
    const normalized = value.trim();

    if (!normalized) {
      continue;
    }

    searchParams.append(key, normalized);
  }
}

export function getReportSortOptions() {
  return reportSortOptions;
}

export function getDefaultReportSortDirection(
  sortBy: ReportSearchFilterState["sortBy"]
): ReportSearchFilterState["sortDirection"] {
  return sortBy === "status" ? "asc" : "desc";
}

export function getReportSortDirectionOptions(
  sortBy: ReportSearchFilterState["sortBy"]
): ReportSortDirectionOption[] {
  if (sortBy === "created_at") {
    return [
      { value: "desc", label: "最新优先" },
      { value: "asc", label: "最早优先" }
    ];
  }

  if (sortBy === "status") {
    return [
      { value: "asc", label: "流程顺序" },
      { value: "desc", label: "反向流程顺序" }
    ];
  }

  return [
    { value: "desc", label: "从高到低" },
    { value: "asc", label: "从低到高" }
  ];
}

export function getReportSortSummary(
  sortBy: ReportSearchFilterState["sortBy"],
  sortDirection: ReportSearchFilterState["sortDirection"]
) {
  const sortLabel =
    reportSortOptions.find((option) => option.value === sortBy)?.label ?? "创建日期";
  const directionLabel =
    getReportSortDirectionOptions(sortBy).find((option) => option.value === sortDirection)?.label ??
    getReportSortDirectionOptions(sortBy)[0]?.label ??
    "最新优先";

  return {
    sortLabel,
    directionLabel,
    shortLabel: `${sortLabel} · ${directionLabel}`,
    sentenceLabel: `${sortLabel} (${directionLabel})`
  };
}

export function cloneReportSearchFilterState(
  filters: OfficeTransactionReportsFilters
): ReportSearchFilterState {
  return {
    ownerMembershipId: filters.ownerMembershipId,
    createdAtOperator: filters.createdAtOperator,
    createdAtValue: filters.createdAtValue,
    createdAtFrom: filters.createdAtFrom,
    createdAtTo: filters.createdAtTo,
    buyerTenant: filters.buyerTenant,
    closingMoveInOperator: filters.closingMoveInOperator,
    closingMoveInValue: filters.closingMoveInValue,
    closingMoveInFrom: filters.closingMoveInFrom,
    closingMoveInTo: filters.closingMoveInTo,
    commissionOperator: filters.commissionOperator,
    commissionValue: filters.commissionValue,
    commissionMin: filters.commissionMin,
    commissionMax: filters.commissionMax,
    askingPriceOperator: filters.askingPriceOperator,
    askingPriceValue: filters.askingPriceValue,
    askingPriceMin: filters.askingPriceMin,
    askingPriceMax: filters.askingPriceMax,
    purchasedPriceOperator: filters.purchasedPriceOperator,
    purchasedPriceValue: filters.purchasedPriceValue,
    purchasedPriceMin: filters.purchasedPriceMin,
    purchasedPriceMax: filters.purchasedPriceMax,
    transactionStatuses: [...filters.transactionStatuses],
    invoiceNumber: filters.invoiceNumber,
    departmentIds: [...filters.departmentIds],
    teamLeaderMembershipIds: [...filters.teamLeaderMembershipIds],
    transactionTypes: [...filters.transactionTypes],
    representingSides: [...filters.representingSides],
    layouts: [...filters.layouts],
    companyReferral: filters.companyReferral,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection
  };
}

function buildReportsSearchParams(input: {
  selectedFieldKeys: OfficeTransactionReportSearchFieldKey[];
  filters: ReportSearchFilterState;
  page?: number | string;
  pageSize?: number | string;
}) {
  const searchParams = new URLSearchParams();
  const selectedFieldKeySet = new Set(input.selectedFieldKeys);

  if (selectedFieldKeySet.has("owner")) {
    appendValue(searchParams, "ownerMembershipId", input.filters.ownerMembershipId);
  }

  if (selectedFieldKeySet.has("created_at")) {
    appendValue(searchParams, "createdAtOperator", input.filters.createdAtOperator);
    appendValue(searchParams, "createdAtValue", input.filters.createdAtValue);
    appendValue(searchParams, "createdAtFrom", input.filters.createdAtFrom);
    appendValue(searchParams, "createdAtTo", input.filters.createdAtTo);
  }

  if (selectedFieldKeySet.has("buyer_tenant")) {
    appendValue(searchParams, "buyerTenant", input.filters.buyerTenant);
  }

  if (selectedFieldKeySet.has("closing_move_in")) {
    appendValue(searchParams, "closingMoveInOperator", input.filters.closingMoveInOperator);
    appendValue(searchParams, "closingMoveInValue", input.filters.closingMoveInValue);
    appendValue(searchParams, "closingMoveInFrom", input.filters.closingMoveInFrom);
    appendValue(searchParams, "closingMoveInTo", input.filters.closingMoveInTo);
  }

  if (selectedFieldKeySet.has("commission")) {
    appendValue(searchParams, "commissionOperator", input.filters.commissionOperator);
    appendValue(searchParams, "commissionValue", input.filters.commissionValue);
    appendValue(searchParams, "commissionMin", input.filters.commissionMin);
    appendValue(searchParams, "commissionMax", input.filters.commissionMax);
  }

  if (selectedFieldKeySet.has("asking_price")) {
    appendValue(searchParams, "askingPriceOperator", input.filters.askingPriceOperator);
    appendValue(searchParams, "askingPriceValue", input.filters.askingPriceValue);
    appendValue(searchParams, "askingPriceMin", input.filters.askingPriceMin);
    appendValue(searchParams, "askingPriceMax", input.filters.askingPriceMax);
  }

  if (selectedFieldKeySet.has("purchased_price")) {
    appendValue(searchParams, "purchasedPriceOperator", input.filters.purchasedPriceOperator);
    appendValue(searchParams, "purchasedPriceValue", input.filters.purchasedPriceValue);
    appendValue(searchParams, "purchasedPriceMin", input.filters.purchasedPriceMin);
    appendValue(searchParams, "purchasedPriceMax", input.filters.purchasedPriceMax);
  }

  if (selectedFieldKeySet.has("transaction_status")) {
    appendArrayValues(searchParams, "transactionStatuses", input.filters.transactionStatuses);
  }

  if (selectedFieldKeySet.has("invoice_number")) {
    appendValue(searchParams, "invoiceNumber", input.filters.invoiceNumber);
  }

  if (selectedFieldKeySet.has("department")) {
    appendArrayValues(searchParams, "departmentIds", input.filters.departmentIds);
  }

  if (selectedFieldKeySet.has("team_leader")) {
    appendArrayValues(
      searchParams,
      "teamLeaderMembershipIds",
      input.filters.teamLeaderMembershipIds
    );
  }

  if (selectedFieldKeySet.has("transaction_type")) {
    appendArrayValues(searchParams, "transactionTypes", input.filters.transactionTypes);
  }

  if (selectedFieldKeySet.has("representing_side")) {
    appendArrayValues(searchParams, "representingSides", input.filters.representingSides);
  }

  if (selectedFieldKeySet.has("layout")) {
    appendArrayValues(searchParams, "layouts", input.filters.layouts);
  }

  if (selectedFieldKeySet.has("company_referral")) {
    appendValue(searchParams, "companyReferral", input.filters.companyReferral);
  }

  appendValue(searchParams, "sortBy", input.filters.sortBy);
  appendValue(searchParams, "sortDirection", input.filters.sortDirection);

  const normalizedPage =
    typeof input.page === "number" ? input.page : Number.parseInt(String(input.page ?? ""), 10);
  const normalizedPageSize =
    typeof input.pageSize === "number" ? input.pageSize : Number.parseInt(String(input.pageSize ?? ""), 10);

  if (Number.isFinite(normalizedPage) && normalizedPage > defaultReportsPage) {
    searchParams.set("page", String(normalizedPage));
  }

  if (
    Number.isFinite(normalizedPageSize) &&
    normalizedPageSize > 0 &&
    normalizedPageSize !== defaultReportsPageSize
  ) {
    searchParams.set("pageSize", String(normalizedPageSize));
  }

  return searchParams;
}

export function buildReportsHref(
  pathname: string,
  input: {
    selectedFieldKeys: OfficeTransactionReportSearchFieldKey[];
    filters: ReportSearchFilterState;
    page?: number | string;
    pageSize?: number | string;
  }
) {
  const searchParams = buildReportsSearchParams(input);
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
