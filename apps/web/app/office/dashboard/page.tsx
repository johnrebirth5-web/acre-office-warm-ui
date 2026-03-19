import Link from "next/link";
import { getOfficeDashboardBusinessSnapshot } from "@acre/db";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  PageHeader,
  PageHeaderSummary,
  PageShell,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import { getSessionAccess, requireOfficeSession } from "../../../lib/auth-session";

function getChartTick(label: string, index: number, labels: string[]) {
  const [monthLabel = label, yearLabel = ""] = label.split(" ");
  const previousYear = index > 0 ? labels[index - 1]?.split(" ")[1] : undefined;
  const isLast = index === labels.length - 1;
  const showYear = index === 0 || isLast || previousYear !== yearLabel;

  return {
    monthLabel,
    yearLabel,
    showYear
  };
}

function getTransactionStatusTone(stage: string) {
  if (stage === "Closed") {
    return "success" as const;
  }

  if (stage === "Pending") {
    return "warning" as const;
  }

  if (stage === "Cancelled") {
    return "danger" as const;
  }

  if (stage === "Opportunity" || stage === "Active") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export default async function OfficeDashboardPage() {
  const context = await requireOfficeSession();
  const access = getSessionAccess(context);
  const snapshot = await getOfficeDashboardBusinessSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id
  });

  const chartPointLabels = snapshot.chart.points.map((point) => point.label);
  const livePipelineCount = snapshot.transactionCountsByStatus
    .filter((metric) => metric.status !== "Closed" && metric.status !== "Cancelled")
    .reduce((total, metric) => total + metric.count, 0);
  const currentCommissionMonth =
    snapshot.commission.monthlyTotals.find((month) => month.isCurrent) ??
    snapshot.commission.monthlyTotals[snapshot.commission.monthlyTotals.length - 1] ??
    null;
  const historicalCommissionMonths = currentCommissionMonth
    ? snapshot.commission.monthlyTotals.filter((month) => month.monthKey !== currentCommissionMonth.monthKey)
    : snapshot.commission.monthlyTotals;

  return (
    <PageShell className="office-dashboard-page office-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Access" value={access.label} />
            <SummaryChip label="My month commission" tone="accent" value={snapshot.commission.currentMonthCommissionLabel} />
            <SummaryChip label="Live pipeline" tone="accent" value={livePipelineCount} />
          </PageHeaderSummary>
        }
        description="Goal tracking, current back-office pressure, and recent transactions inside one operational dashboard."
        eyebrow="Dashboard"
        title="Office dashboard"
      />

      <div className="office-dashboard-grid-wide">
        <div className="office-dashboard-primary-stack">
          <SectionCard
            className="office-dashboard-goal-card office-list-card"
            subtitle="Goal tracking, access visibility, and live pipeline pressure for the current office scope."
            title="Goal tracking"
          >
            <div className="bm-goal-main">
              <div className="bm-dashboard-summary">
                <div className="bm-dashboard-access">
                  <strong>
                    {context.currentUser.firstName} {context.currentUser.lastName}
                  </strong>
                  <span>
                    {access.label} · {access.permissionCount} permissions · {context.currentOffice?.name ?? context.currentOrganization.name}
                  </span>
                </div>

                <div className="bm-dashboard-status-strip">
                  {snapshot.transactionCountsByStatus.map((metric) => (
                    <StatCard
                      className="bm-dashboard-status-chip"
                      hint="transactions"
                      key={metric.status}
                      label={metric.status}
                      value={metric.count}
                    />
                  ))}
                </div>
              </div>

              <div className="bm-goal-chart">
                <div className="bm-chart-grid">
                  <div className="bm-chart-axis">
                    {snapshot.chart.axisLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  <div className="bm-chart-line-shell">
                    <div className="bm-chart-canvas">
                      <div aria-hidden="true" className="bm-chart-bars">
                        {snapshot.chart.points.map((point) => {
                          const heightPercent = snapshot.chart.maxValue > 0 ? (point.value / snapshot.chart.maxValue) * 100 : 0;
                          const barHeight = point.value > 0 ? `${Math.max(heightPercent, 2)}%` : "0%";

                          return (
                            <span className="bm-chart-bar-slot" key={point.label}>
                              <span
                                className={`bm-chart-bar${point.value === 0 ? " is-empty" : ""}`}
                                style={{ height: barHeight }}
                                title={`${point.label}: ${point.value}`}
                              />
                            </span>
                          );
                        })}
                      </div>

                      <div className="bm-chart-months">
                        {snapshot.chart.points.map((point, index) => {
                          const tick = getChartTick(point.label, index, chartPointLabels);

                          return (
                            <span key={point.label} title={point.label}>
                              <span className="bm-chart-month-label">{tick.monthLabel}</span>
                              {tick.showYear ? <span className="bm-chart-year-label">{tick.yearLabel}</span> : <span aria-hidden="true" className="bm-chart-year-label is-placeholder">0000</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="bm-goal-side">
                  <div className="bm-goal-ring">
                    <div className="bm-goal-ring-inner">
                      <strong>{snapshot.goal.progressPercent}%</strong>
                      <span>{snapshot.goal.currentValueLabel}</span>
                    </div>
                  </div>
                  <div className="bm-goal-foot">
                    <span>{snapshot.goal.targetLabel}:</span>
                    <strong>{snapshot.goal.target}</strong>
                  </div>
                  <div className="bm-time-left">
                    <span>{snapshot.goal.secondaryLabel}:</span>
                    <strong>{snapshot.goal.secondaryValue}</strong>
                  </div>
                  <div className="bm-time-bar">
                    <div className="bm-time-bar-fill" style={{ width: `${snapshot.goal.progressPercent}%` }} />
                  </div>
                  <p className="bm-goal-caption">{snapshot.goal.currentValue}</p>
                </aside>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            className="office-dashboard-transactions-card office-list-card"
            subtitle="Recently updated deals visible inside the current office scope."
            title="Recent transactions"
          >
            <DataTable className="office-dashboard-transactions-table">
              <DataTableHeader className="office-dashboard-transactions-head">
                <span>Transaction</span>
                <span>Price</span>
                <span>Status</span>
                <span>Owner</span>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.recentTransactions.map((transaction) => (
                  <DataTableRow className="office-dashboard-transactions-row" key={transaction.id}>
                    <div className="office-dashboard-transactions-main">
                      <strong>
                        <Link href={`/office/transactions/${transaction.id}`}>{transaction.label}</Link>
                      </strong>
                    </div>
                    <strong className="office-dashboard-transactions-amount">{transaction.amount}</strong>
                    <StatusBadge tone={getTransactionStatusTone(transaction.stage)}>{transaction.stage}</StatusBadge>
                    <span className="office-dashboard-transactions-owner">{transaction.owner}</span>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </SectionCard>
        </div>

        <SectionCard
          className="office-dashboard-commission-card office-list-card"
          subtitle="Your own persisted commission rows only. Team or company allocations are not rolled into this dashboard card."
          title="My commissions"
        >
          <div className="office-kpi-grid office-commission-kpi-grid">
            <StatCard hint="all persisted rows tied to your membership" label="Total commission" value={snapshot.commission.totalCommissionLabel} />
            <StatCard hint="rows calculated in the current calendar month" label="This month" value={snapshot.commission.currentMonthCommissionLabel} />
            <StatCard hint="rows already marked payable" label="Payable" value={snapshot.commission.payableLabel} />
            <StatCard hint="rows already marked paid" label="Paid" value={snapshot.commission.paidLabel} />
          </div>

          <div className="office-dashboard-commission-meta">
            <span>{snapshot.commission.calculationCount} persisted commission row(s) tied to your membership.</span>
            <span>Monthly totals reflect your own statement amounts only. Previous months stay tucked into history to save space.</span>
          </div>

          {currentCommissionMonth ? (
            <div className="office-dashboard-commission-month-panel">
              <article
                className={`office-dashboard-commission-month office-dashboard-commission-month-current${currentCommissionMonth.isCurrent ? " is-current" : ""}`}
              >
                <div className="office-dashboard-commission-month-copy">
                  <span className="office-dashboard-commission-month-eyebrow">Current month</span>
                  <strong>{currentCommissionMonth.label}</strong>
                  <span>{currentCommissionMonth.calculationCount} row(s)</span>
                </div>
                <strong className="office-dashboard-commission-month-amount">{currentCommissionMonth.totalLabel}</strong>
              </article>

              {historicalCommissionMonths.length ? (
                <details className="office-dashboard-commission-history">
                  <summary>
                    <div className="office-dashboard-commission-history-copy">
                      <strong>Previous months</strong>
                      <span>{historicalCommissionMonths.length} month(s) in history</span>
                    </div>
                    <span className="office-dashboard-commission-history-action">Expand</span>
                  </summary>

                  <div className="office-dashboard-commission-history-list">
                    {historicalCommissionMonths.map((month) => (
                      <article className="office-dashboard-commission-history-item" key={month.monthKey}>
                        <div className="office-dashboard-commission-month-copy">
                          <strong>{month.label}</strong>
                          <span>{month.calculationCount} row(s)</span>
                        </div>
                        <strong className="office-dashboard-commission-month-amount">{month.totalLabel}</strong>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
        </SectionCard>
      </div>
    </PageShell>
  );
}
