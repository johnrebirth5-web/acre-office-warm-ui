import Link from "next/link";
import { canViewOfficeCommissionSelfServiceSummary } from "@acre/auth";
import { getOfficeDashboardBusinessSnapshot } from "@acre/db";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  SectionCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import { getSessionAccess, requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { KpiStrip, type KpiStripItem } from "../../_components/kpi-strip";
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

function getTransactionStatusLabel(
  stage: string,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  switch (stage) {
    case "Opportunity":
      return t((messages) => messages.officeTransactions.opportunity);
    case "Active":
      return t((messages) => messages.officeTransactions.active);
    case "Pending":
      return t((messages) => messages.officeTransactions.pending);
    case "Closed":
      return t((messages) => messages.officeTransactions.closed);
    case "Cancelled":
      return t((messages) => messages.officeTransactions.cancelled);
    default:
      return stage;
  }
}

export default async function OfficeDashboardPage() {
  const context = await requireOfficeSession();
  const { t } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
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
  const transactionKpiItems: KpiStripItem[] = snapshot.transactionCountsByStatus.map((metric) => ({
    label: metric.status,
    value: metric.count,
    tone:
      metric.status === "Active" || metric.status === "Pending"
        ? "accent"
        : metric.status === "Cancelled"
          ? "muted"
          : undefined
  }));
  const commissionKpiItems = [
    { label: t((messages) => messages.officeDashboard.totalCommission), value: snapshot.commission.totalCommissionLabel },
    {
      label: t((messages) => messages.officeDashboard.thisMonth),
      value: snapshot.commission.currentMonthCommissionLabel,
      tone: "accent" as const
    },
    { label: t((messages) => messages.officeDashboard.payable), value: snapshot.commission.payableLabel },
    { label: t((messages) => messages.officeDashboard.paid), value: snapshot.commission.paidLabel }
  ];

  return (
    <OfficeListPageShell className="office-dashboard-page">
      <OfficeListPageHeader
        description={t((messages) => messages.officeDashboard.description)}
        eyebrow={t((messages) => messages.officeDashboard.eyebrow)}
        summary={
          <>
            <SummaryChip label={t((messages) => messages.common.officeScope)} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={t((messages) => messages.common.access)} value={access.label} />
            {canViewCommissionSelfServiceSummary ? (
              <SummaryChip label={t((messages) => messages.officeDashboard.myMonthCommission)} tone="accent" value={snapshot.commission.currentMonthCommissionLabel} />
            ) : null}
            <SummaryChip label={t((messages) => messages.officeDashboard.livePipeline)} tone="accent" value={livePipelineCount} />
          </>
        }
        title={t((messages) => messages.officeDashboard.title)}
      />

      <div className="office-dashboard-grid-wide">
        <div className="office-dashboard-primary-stack">
          <SectionCard
            className="office-dashboard-goal-card office-list-card"
            subtitle={t((messages) => messages.officeDashboard.goalTrackingSubtitle)}
            title={t((messages) => messages.officeDashboard.goalTracking)}
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

                <KpiStrip className="office-dashboard-status-strip" items={transactionKpiItems} />
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
            subtitle={t((messages) => messages.officeDashboard.recentTransactionsSubtitle)}
            title={t((messages) => messages.officeDashboard.recentTransactions)}
          >
            <DataTable className="office-dashboard-transactions-table">
              <DataTableHeader className="office-dashboard-transactions-head">
                <span>{t((messages) => messages.officeDashboard.transaction)}</span>
                <span>{t((messages) => messages.officeDashboard.price)}</span>
                <span>{t((messages) => messages.officeDashboard.status)}</span>
                <span>{t((messages) => messages.officeDashboard.owner)}</span>
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
                    <StatusBadge tone={getTransactionStatusTone(transaction.stage)}>
                      {getTransactionStatusLabel(transaction.stage, t)}
                    </StatusBadge>
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
            subtitle={t((messages) => messages.officeDashboard.myCommissionsSubtitle)}
            title={t((messages) => messages.officeDashboard.myCommissions)}
          >
            {payoutReviewQueue.count > 0 && latestPayoutReviewStatement ? (
              <div className="office-dashboard-payout-reminder">
                <div className="office-dashboard-payout-reminder-copy">
                  <span className="office-dashboard-payout-reminder-eyebrow">{t((messages) => messages.officeDashboard.needsYourReview)}</span>
                  <strong>
                    {payoutReviewQueue.count === 1
                      ? t((messages) => messages.officeDashboard.payoutAwaitingReviewSingle)
                      : t((messages) => messages.officeDashboard.payoutAwaitingReviewMultiple, {
                          count: payoutReviewQueue.count,
                        })}
                  </strong>
                  <p>
                    {t((messages) => messages.officeDashboard.latestStatement, {
                      period: latestPayoutReviewStatement.periodLabel,
                      generatedAt: latestPayoutReviewStatement.generatedAtLabel,
                      amount: latestPayoutReviewStatement.totalStatementAmountLabel,
                    })}
                  </p>
                </div>

                <div className="office-section-actions">
                  <StatusBadge tone="danger">
                    {t((messages) => messages.officeDashboard.awaitingReview, {
                      count: payoutReviewQueue.count,
                    })}
                  </StatusBadge>
                  <Link className="office-button" href={latestPayoutReviewStatement.openHref}>
                    {t((messages) => messages.officeDashboard.reviewStatement)}
                  </Link>
                </div>
              </div>
            ) : null}

            <KpiStrip className="office-dashboard-commission-strip" items={commissionKpiItems} />

            <div className="office-dashboard-commission-meta">
              <span>{t((messages) => messages.officeDashboard.persistedRowsSummary, {
                count: snapshot.commission.calculationCount,
              })}</span>
              <span>{t((messages) => messages.officeDashboard.monthlyTotalsSummary)}</span>
            </div>

            {currentCommissionMonth ? (
              <div className="office-dashboard-commission-month-panel">
                <article
                  className={`office-dashboard-commission-month office-dashboard-commission-month-current${currentCommissionMonth.isCurrent ? " is-current" : ""}`}
                >
                  <div className="office-dashboard-commission-month-copy">
                    <span className="office-dashboard-commission-month-eyebrow">{t((messages) => messages.officeDashboard.currentMonth)}</span>
                    <strong>{currentCommissionMonth.label}</strong>
                    <span>{t((messages) => messages.officeDashboard.rowCount, {
                      count: currentCommissionMonth.calculationCount,
                    })}</span>
                  </div>
                  <strong className="office-dashboard-commission-month-amount">{currentCommissionMonth.totalLabel}</strong>
                </article>

                {historicalCommissionMonths.length ? (
                  <details className="office-dashboard-commission-history">
                    <summary>
                      <div className="office-dashboard-commission-history-copy">
                        <strong>{t((messages) => messages.officeDashboard.previousMonths)}</strong>
                        <span>{t((messages) => messages.officeDashboard.monthCountInHistory, {
                          count: historicalCommissionMonths.length,
                        })}</span>
                      </div>
                      <span className="office-dashboard-commission-history-action">{t((messages) => messages.officeDashboard.expand)}</span>
                    </summary>

                    <div className="office-dashboard-commission-history-list">
                      {historicalCommissionMonths.map((month) => (
                        <article className="office-dashboard-commission-history-item" key={month.monthKey}>
                          <div className="office-dashboard-commission-month-copy">
                            <strong>{month.label}</strong>
                            <span>{t((messages) => messages.officeDashboard.rowCount, {
                              count: month.calculationCount,
                            })}</span>
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
                  <span>{t((messages) => messages.officeDashboard.statementPeriod)}</span>
                  <span>{t((messages) => messages.officeDashboard.generated)}</span>
                  <span>{t((messages) => messages.officeDashboard.status)}</span>
                  <span>{t((messages) => messages.officeDashboard.total)}</span>
                  <span>{t((messages) => messages.officeDashboard.actions)}</span>
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
                          {t((messages) => messages.common.open)}
                        </Link>
                        <a className="office-button-secondary office-button-sm" href={statement.pdfHref} rel="noreferrer" target="_blank">
                          {t((messages) => messages.officeDashboard.pdf)}
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
