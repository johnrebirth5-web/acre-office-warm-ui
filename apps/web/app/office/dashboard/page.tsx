import Link from "next/link";
import { canViewOfficeCommissionSelfServiceSummary } from "@acre/auth";
import { getOfficeDashboardBusinessSnapshot } from "@acre/db";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import { getSessionAccess, requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { LocalDateTime } from "../_components/local-date-time";

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
  const canViewCommissionSelfServiceSummary =
    canViewOfficeCommissionSelfServiceSummary(context.currentMembership) && snapshot.commission.hasSelfServiceData;

  const chartPointLabels = snapshot.chart.points.map((point) => point.label);
  const livePipelineCount = snapshot.transactionCountsByStatus
    .filter((metric) => metric.status !== "Closed" && metric.status !== "Cancelled")
    .reduce((total, metric) => total + metric.count, 0);
  const currentCommissionMonth =
    snapshot.commission.monthlyTotals.find((month) => month.isCurrent) ??
    snapshot.commission.monthlyTotals[snapshot.commission.monthlyTotals.length - 1] ??
    null;
  const goalProgressPercent = Math.min(Math.max(snapshot.goal.progressPercent, 0), 100);
  const historicalCommissionMonths = currentCommissionMonth
    ? snapshot.commission.monthlyTotals.filter((month) => month.monthKey !== currentCommissionMonth.monthKey)
    : snapshot.commission.monthlyTotals;
  const payoutReviewQueue = snapshot.commission.payoutReviewQueue;
  const latestPayoutReviewStatement = payoutReviewQueue.statements[0] ?? null;

  return (
    <OfficeListPageShell className="office-dashboard-page">
      <OfficeListPageHeader
        description="Goal tracking, current back-office pressure, and recent transactions inside one operational dashboard."
        eyebrow="Dashboard"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Access" value={access.label} />
            {canViewCommissionSelfServiceSummary ? (
              <SummaryChip label="My month commission" tone="accent" value={snapshot.commission.currentMonthCommissionLabel} />
            ) : null}
            <SummaryChip label="Live pipeline" tone="accent" value={livePipelineCount} />
          </>
        }
        title="Office dashboard"
      />

      <div className="office-dashboard-grid-wide">
        <div className="office-dashboard-primary-stack">
          <SectionCard
            className="office-dashboard-goal-card office-list-card"
            subtitle="Goal tracking, access visibility, and live pipeline pressure for the current office scope."
            title="Goal tracking"
          >
            <div className="office-dashboard-goal-main">
              <div className="office-dashboard-goal-summary">
                <div className="office-dashboard-access">
                  <strong>
                    {context.currentUser.firstName} {context.currentUser.lastName}
                  </strong>
                  <span>
                    {access.label} · {access.permissionCount} permissions · {context.currentOffice?.name ?? context.currentOrganization.name}
                  </span>
                </div>

                <div className="office-dashboard-status-strip">
                  {snapshot.transactionCountsByStatus.map((metric) => (
                    <StatCard
                      className="office-dashboard-status-chip"
                      hint="transactions"
                      key={metric.status}
                      label={metric.status}
                      value={metric.count}
                    />
                  ))}
                </div>
              </div>

              <div className="office-dashboard-goal-chart">
                <div className="office-dashboard-chart-grid">
                  <div className="office-dashboard-chart-axis">
                    {snapshot.chart.axisLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  <div className="office-dashboard-chart-line-shell">
                    <div className="office-dashboard-chart-canvas">
                      <div aria-hidden="true" className="office-dashboard-chart-bars">
                        {snapshot.chart.points.map((point) => {
                          const heightPercent = snapshot.chart.maxValue > 0 ? (point.value / snapshot.chart.maxValue) * 100 : 0;
                          const barHeight = point.value > 0 ? `${Math.max(heightPercent, 2)}%` : "0%";

                          return (
                            <span className="office-dashboard-chart-bar-slot" key={point.label}>
                              <span
                                className={`office-dashboard-chart-bar${point.value === 0 ? " is-empty" : ""}`}
                                style={{ height: barHeight }}
                                title={`${point.label}: ${point.value}`}
                              />
                            </span>
                          );
                        })}
                      </div>

                      <div className="office-dashboard-chart-months">
                        {snapshot.chart.points.map((point, index) => {
                          const tick = getChartTick(point.label, index, chartPointLabels);

                          return (
                            <span key={point.label} title={point.label}>
                              <span className="office-dashboard-chart-month-label">{tick.monthLabel}</span>
                              {tick.showYear ? <span className="office-dashboard-chart-year-label">{tick.yearLabel}</span> : <span aria-hidden="true" className="office-dashboard-chart-year-label is-placeholder">0000</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="office-dashboard-goal-side">
                  <div
                    className="office-dashboard-goal-ring"
                    style={{
                      background: `conic-gradient(#2552a4 0 ${goalProgressPercent}%, rgba(214, 223, 235, 0.9) ${goalProgressPercent}% 100%)`
                    }}
                  >
                    <div className="office-dashboard-goal-ring-inner">
                      <strong>{snapshot.goal.progressPercent}%</strong>
                      <span>{snapshot.goal.currentValueLabel}</span>
                    </div>
                  </div>
                  <div className="office-dashboard-goal-foot">
                    <span>{snapshot.goal.targetLabel}:</span>
                    <strong>{snapshot.goal.target}</strong>
                  </div>
                  <div className="office-dashboard-time-left">
                    <span>{snapshot.goal.secondaryLabel}:</span>
                    <strong>{snapshot.goal.secondaryValue}</strong>
                  </div>
                  <div className="office-dashboard-time-bar">
                    <div className="office-dashboard-time-bar-fill" style={{ width: `${goalProgressPercent}%` }} />
                  </div>
                  <p className="office-dashboard-goal-caption">{snapshot.goal.currentValue}</p>
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

        {canViewCommissionSelfServiceSummary ? (
          <SectionCard
            className="office-dashboard-commission-card office-list-card"
            subtitle="Your own persisted commission rows and saved payout statements only. Team or company allocations are never rolled into this dashboard card."
            title="My commissions"
          >
            {payoutReviewQueue.count > 0 && latestPayoutReviewStatement ? (
              <div className="office-dashboard-payout-reminder">
                <div className="office-dashboard-payout-reminder-copy">
                  <span className="office-dashboard-payout-reminder-eyebrow">Needs your review</span>
                  <strong>
                    {payoutReviewQueue.count === 1
                      ? "1 payout statement is awaiting your review in Acre."
                      : `${payoutReviewQueue.count} payout statements are awaiting your review in Acre.`}
                  </strong>
                  <p>
                    Latest statement: {latestPayoutReviewStatement.periodLabel} · Generated{" "}
                    <LocalDateTime
                      fallbackLabel={latestPayoutReviewStatement.generatedAtLabel}
                      value={latestPayoutReviewStatement.generatedAt}
                    />{" "}
                    · Final payout {latestPayoutReviewStatement.totalStatementAmountLabel}
                  </p>
                </div>

                <div className="office-section-actions">
                  <StatusBadge tone="danger">{payoutReviewQueue.count} awaiting review</StatusBadge>
                  <Link className="office-button" href={latestPayoutReviewStatement.openHref}>
                    Review statement
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="office-kpi-grid office-commission-kpi-grid">
              <StatCard hint="all persisted rows tied to your membership" label="Total commission" value={snapshot.commission.totalCommissionLabel} />
              <StatCard hint="rows calculated in the current calendar month" label="This month" value={snapshot.commission.currentMonthCommissionLabel} />
              <StatCard hint="rows already marked payable" label="Payable" value={snapshot.commission.payableLabel} />
              <StatCard hint="rows already marked paid" label="Paid" value={snapshot.commission.paidLabel} />
            </div>

            <div className="office-dashboard-commission-meta">
              <span>{snapshot.commission.calculationCount} persisted commission row(s) tied to your membership.</span>
              <span>Monthly totals reflect your own statement amounts only, even when the underlying transaction belongs to another office.</span>
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

            {snapshot.commission.statements.length > 0 ? (
              <DataTable className="office-dashboard-transactions-table">
                <DataTableHeader className="office-dashboard-transactions-head">
                  <span>Statement period</span>
                  <span>Generated</span>
                  <span>Status</span>
                  <span>Total</span>
                  <span>Actions</span>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.commission.statements.map((statement) => (
                    <DataTableRow className="office-dashboard-transactions-row" key={statement.id}>
                      <div className="office-dashboard-transactions-main">
                        <strong>{statement.periodLabel}</strong>
                      </div>
                      <span>
                        <LocalDateTime fallbackLabel={statement.generatedAtLabel} value={statement.generatedAt} />
                      </span>
                      <StatusBadge
                        tone={
                          statement.reviewStatus === "confirmed" ||
                          statement.reviewStatus === "paid"
                            ? "success"
                            : statement.reviewStatus === "revision_requested"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {statement.reviewStatusLabel}
                      </StatusBadge>
                      <strong className="office-dashboard-transactions-amount">{statement.totalStatementAmountLabel}</strong>
                      <div className="office-section-actions office-accounting-statement-history-actions">
                        <Link className="office-button-secondary office-button-sm" href={statement.openHref}>
                          Open
                        </Link>
                        <a className="office-button-secondary office-button-sm" href={statement.pdfHref} rel="noreferrer" target="_blank">
                          PDF
                        </a>
                      </div>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            ) : null}
          </SectionCard>
        ) : null}
      </div>
    </OfficeListPageShell>
  );
}
