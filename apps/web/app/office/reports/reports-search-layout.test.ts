import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReportsHref,
  getDefaultReportSortDirection,
  getReportSortDirectionOptions,
  getReportSortSummary,
  type ReportSearchFilterState
} from "./reports-search-layout";

function createFilterState(): ReportSearchFilterState {
  return {
    ownerMembershipId: "owner-1",
    createdAtOperator: "range",
    createdAtValue: "",
    createdAtFrom: "2026-03-01",
    createdAtTo: "2026-03-31",
    buyerTenant: "Hidden buyer",
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
    transactionStatuses: ["pending", "closed"],
    invoiceNumber: "INV-HIDDEN",
    departmentIds: ["dept-1"],
    teamLeaderMembershipIds: ["lead-1"],
    transactionTypes: ["sales"],
    representingSides: [],
    layouts: [],
    companyReferral: "",
    sortBy: "created_at",
    sortDirection: "desc"
  };
}

test("buildReportsHref omits unselected field params while keeping pinned sort", () => {
  const href = buildReportsHref("/office/reports", {
    selectedFieldKeys: ["owner", "created_at", "transaction_status", "department", "team_leader", "transaction_type"],
    filters: createFilterState()
  });

  assert.equal(
    href,
    "/office/reports?ownerMembershipId=owner-1&createdAtOperator=range&createdAtFrom=2026-03-01&createdAtTo=2026-03-31&transactionStatuses=pending&transactionStatuses=closed&departmentIds=dept-1&teamLeaderMembershipIds=lead-1&transactionTypes=sales&sortBy=created_at&sortDirection=desc"
  );
  assert.equal(href.includes("buyerTenant"), false);
  assert.equal(href.includes("invoiceNumber"), false);
});

test("buildReportsHref preserves selected composite financial filters", () => {
  const filters = createFilterState();
  filters.commissionOperator = "range";
  filters.commissionMin = "1000";
  filters.commissionMax = "2500";
  filters.companyReferral = "yes";

  const href = buildReportsHref("/office/reports", {
    selectedFieldKeys: ["commission", "company_referral"],
    filters
  });

  assert.equal(
    href,
    "/office/reports?commissionOperator=range&commissionMin=1000&commissionMax=2500&companyReferral=yes&sortBy=created_at&sortDirection=desc"
  );
});

test("status sort defaults to workflow order", () => {
  assert.equal(getDefaultReportSortDirection("status"), "asc");
  assert.deepEqual(getReportSortDirectionOptions("status"), [
    { value: "asc", label: "流程顺序" },
    { value: "desc", label: "反向流程顺序" }
  ]);
});

test("report sort summary exposes user-facing labels", () => {
  assert.deepEqual(getReportSortSummary("gross_commission", "desc"), {
    sortLabel: "总佣金",
    directionLabel: "从高到低",
    shortLabel: "总佣金 · 从高到低",
    sentenceLabel: "总佣金 (从高到低)"
  });
});
