import assert from "node:assert/strict";
import test from "node:test";
import type { OfficeDataScope } from "./access.ts";
import {
  buildPipelineHistoryMonthKeys,
  buildPipelineHistoryYearOptions,
  buildPipelineYearHistoryMonthKeys,
  canViewOfficePipelineMetrics,
  getMyPipelineVisibleMembershipIds,
  getOfficePipelineMetricOptions,
  normalizeOfficePipelineMetricMode,
  normalizeOfficePipelineSelectionInput,
  resolveDefaultOfficePipelineSelection,
  type OfficePipelineHistoryMonth
} from "./pipeline.ts";

function buildScope(overrides: Partial<OfficeDataScope>): OfficeDataScope {
  return {
    viewerMembershipId: "viewer-membership",
    viewerRole: "agent",
    viewerPermissions: ["transactions:view"],
    officeId: "office-id",
    kind: "self",
    visibleMembershipIds: ["viewer-membership"],
    visibleTeamIds: [],
    visibleTeamMembershipIds: [],
    ...overrides
  };
}

function buildHistoryMonth(monthKey: string, count: number, isCurrentMonth = false): OfficePipelineHistoryMonth {
  return {
    monthKey,
    label: monthKey,
    count,
    metricLabel: "$0",
    isCurrentMonth
  };
}

test("only owner and office admin can access office pipeline metrics", () => {
  assert.equal(canViewOfficePipelineMetrics("owner"), true);
  assert.equal(canViewOfficePipelineMetrics("office_admin"), true);
  assert.equal(canViewOfficePipelineMetrics("team_lead"), false);
  assert.equal(canViewOfficePipelineMetrics("agent"), false);
});

test("metric option catalog narrows to my metrics for non-admin users", () => {
  assert.deepEqual(
    getOfficePipelineMetricOptions(true).map((option) => option.value),
    ["office_net", "office_sales_volume", "office_gross", "my_net_income", "my_gross_commission", "my_sales_volume"]
  );
  assert.deepEqual(
    getOfficePipelineMetricOptions(false).map((option) => option.value),
    ["my_net_income", "my_gross_commission", "my_sales_volume"]
  );
});

test("legacy metric params normalize into supported office or my modes", () => {
  assert.equal(normalizeOfficePipelineMetricMode("transaction_volume", true), "office_sales_volume");
  assert.equal(normalizeOfficePipelineMetricMode("transaction_volume", false), "my_sales_volume");
  assert.equal(normalizeOfficePipelineMetricMode("office_net", false), "my_sales_volume");
  assert.equal(normalizeOfficePipelineMetricMode("my_net_income", false), "my_net_income");
  assert.equal(normalizeOfficePipelineMetricMode("my_gross_commission", false), "my_gross_commission");
});

test("my metric visibility always stays self scoped", () => {
  assert.deepEqual(
    getMyPipelineVisibleMembershipIds(
      buildScope({
        kind: "organization",
        visibleMembershipIds: null
      })
    ),
    ["viewer-membership"]
  );
  assert.deepEqual(
    getMyPipelineVisibleMembershipIds(
      buildScope({
        kind: "team",
        visibleMembershipIds: ["viewer-membership", "junior-lead", "agent-a", "agent-b"]
      })
    ),
    ["viewer-membership"]
  );
  assert.deepEqual(getMyPipelineVisibleMembershipIds(buildScope({ kind: "self" })), ["viewer-membership"]);
});

test("history month helper always returns the most recent six months", () => {
  assert.deepEqual(buildPipelineHistoryMonthKeys(new Date("2026-03-23T10:00:00Z")), [
    "2026-03",
    "2026-02",
    "2026-01",
    "2025-12",
    "2025-11",
    "2025-10"
  ]);
});

test("year history helpers expose full january to december buckets and descending year options", () => {
  assert.deepEqual(buildPipelineYearHistoryMonthKeys(2025), [
    "2025-01",
    "2025-02",
    "2025-03",
    "2025-04",
    "2025-05",
    "2025-06",
    "2025-07",
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12"
  ]);
  assert.deepEqual(buildPipelineHistoryYearOptions(new Date("2026-04-06T12:00:00Z"), 2024), [2026, 2025, 2024]);
  assert.deepEqual(buildPipelineHistoryYearOptions(new Date("2026-04-06T12:00:00Z"), null), [2026]);
});

test("default selection prefers current month closed, then latest closed month, then pending", () => {
  assert.deepEqual(
    resolveDefaultOfficePipelineSelection([
      buildHistoryMonth("2026-03", 4, true),
      buildHistoryMonth("2026-02", 0),
      buildHistoryMonth("2026-01", 2)
    ]),
    { view: "history", historyMonth: "2026-03" }
  );
  assert.deepEqual(
    resolveDefaultOfficePipelineSelection([
      buildHistoryMonth("2026-03", 0),
      buildHistoryMonth("2026-02", 3),
      buildHistoryMonth("2026-01", 1)
    ]),
    { view: "history", historyMonth: "2026-02" }
  );
  assert.deepEqual(
    resolveDefaultOfficePipelineSelection([
      buildHistoryMonth("2026-01", 0),
      buildHistoryMonth("2026-02", 3),
      buildHistoryMonth("2026-03", 0, true),
      buildHistoryMonth("2026-04", 1)
    ]),
    { view: "history", historyMonth: "2026-04" }
  );
  assert.deepEqual(
    resolveDefaultOfficePipelineSelection([
      buildHistoryMonth("2026-03", 0),
      buildHistoryMonth("2026-02", 0),
      buildHistoryMonth("2026-01", 0)
    ]),
    { view: "pending", historyMonth: "" }
  );
});

test("legacy cancelled history params normalize into the supported closed-history view", () => {
  assert.deepEqual(
    normalizeOfficePipelineSelectionInput({
      historyStatus: "Cancelled",
      historyMonth: "2026-02"
    }),
    {
      view: "history",
      historyMonth: "2026-02"
    }
  );
  assert.deepEqual(
    normalizeOfficePipelineSelectionInput({
      stage: "Pending"
    }),
    {
      view: "pending",
      historyMonth: ""
    }
  );
});
