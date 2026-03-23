import assert from "node:assert/strict";
import test from "node:test";
import type { OfficeDataScope } from "./access.ts";
import {
  buildPipelineHistoryMonthKeys,
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

function buildHistoryMonth(monthKey: string, count: number): OfficePipelineHistoryMonth {
  return {
    monthKey,
    label: monthKey,
    count,
    metricLabel: "$0",
    isCurrentMonth: false
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
    ["office_net", "office_sales_volume", "office_gross", "my_net_income", "my_sales_volume"]
  );
  assert.deepEqual(
    getOfficePipelineMetricOptions(false).map((option) => option.value),
    ["my_net_income", "my_sales_volume"]
  );
});

test("legacy metric params normalize into supported office or my modes", () => {
  assert.equal(normalizeOfficePipelineMetricMode("transaction_volume", true), "office_sales_volume");
  assert.equal(normalizeOfficePipelineMetricMode("transaction_volume", false), "my_sales_volume");
  assert.equal(normalizeOfficePipelineMetricMode("office_net", false), "my_sales_volume");
  assert.equal(normalizeOfficePipelineMetricMode("my_net_income", false), "my_net_income");
});

test("my metric visibility uses self for org scope and branch scope for team visibility", () => {
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
    ["viewer-membership", "junior-lead", "agent-a", "agent-b"]
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

test("default selection prefers current month closed, then latest closed month, then pending", () => {
  assert.deepEqual(
    resolveDefaultOfficePipelineSelection([
      buildHistoryMonth("2026-03", 4),
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
