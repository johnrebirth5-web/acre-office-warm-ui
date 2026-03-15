import Link from "next/link";
import { getOfficePipelineWorkspaceSnapshot } from "@acre/db";
import { Button, FilterBar, FilterField, HorizontalScrollArea, PageHeader, PageHeaderSummary, PageShell, SectionCard, SelectInput, StatusBadge, SummaryChip, TextInput } from "@acre/ui";
import { requireOfficeSession } from "../../../lib/auth-session";

type PipelinePageSearchParams = {
  search?: string;
  representing?: string;
  ownerMembershipId?: string;
  metricMode?: string;
  stage?: string;
  historyStatus?: string;
  historyMonth?: string;
};

type PipelinePageProps = {
  searchParams?: Promise<PipelinePageSearchParams>;
};

function getPipelineStatusTone(status: string) {
  if (status === "Pending") {
    return "warning" as const;
  }

  if (status === "Closed") {
    return "success" as const;
  }

  if (status === "Cancelled") {
    return "danger" as const;
  }

  if (status === "Active") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function buildPipelineHref(
  currentFilters: {
    search: string;
    representing: string;
    ownerMembershipId: string;
    metricMode: string;
    stage: string;
    historyStatus: string;
    historyMonth: string;
  },
  overrides: Partial<Record<keyof PipelinePageSearchParams, string | null>>
) {
  const params = new URLSearchParams();
  const nextFilters = {
    ...currentFilters,
    ...overrides
  };

  Object.entries(nextFilters).forEach(([key, value]) => {
    if (!value || value === "all") {
      return;
    }

    params.set(key, value);
  });

  const queryString = params.toString();
  return `/office/pipeline${queryString ? `?${queryString}` : ""}`;
}

export default async function OfficePipelinePage(props: PipelinePageProps) {
  const context = await requireOfficeSession();
  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficePipelineWorkspaceSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id,
    search: searchParams.search,
    representing: searchParams.representing,
    ownerMembershipId: searchParams.ownerMembershipId,
    metricMode: searchParams.metricMode,
    stage: searchParams.stage,
    historyStatus: searchParams.historyStatus,
    historyMonth: searchParams.historyMonth
  });

  const hrefBaseFilters = {
    search: snapshot.filters.search,
    representing: snapshot.filters.representing,
    ownerMembershipId: snapshot.filters.ownerMembershipId,
    metricMode: snapshot.filters.metricMode,
    stage: snapshot.filters.stage,
    historyStatus: snapshot.filters.historyStatus,
    historyMonth: snapshot.filters.historyMonth
  };

  const allTransactionsHref = buildPipelineHref(hrefBaseFilters, {
    stage: null,
    historyStatus: null,
    historyMonth: null
  });
  const hasScopedSelection = snapshot.selection.kind !== "all";
  const workingListNote =
    snapshot.selection.kind === "stage"
      ? "Showing the selected live stage inside the current top-level filters."
      : snapshot.selection.kind === "history"
        ? "Showing the selected monthly closed / cancelled bucket."
        : "Showing all transactions inside the current top-level filters.";

  return (
    <PageShell className="office-list-page office-pipeline-page">
      <PageHeader
        actions={
          <PageHeaderSummary className="office-pipeline-page-actions">
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Metric" tone="accent" value={snapshot.metricModeLabel} />
            <SummaryChip label="Filtered" value={snapshot.workspaceSummary.filteredTransactions.count} />
            <SummaryChip label="Live funnel" value={snapshot.workspaceSummary.livePipeline.count} />
            {hasScopedSelection ? <SummaryChip label="Selection" value={snapshot.selection.label} /> : null}
          </PageHeaderSummary>
        }
        description="Manager-facing pipeline workspace with live funnel totals, recent outcome rollups, and one unified list of real transactions."
        eyebrow="Pipeline"
        title="Pipeline"
      />

      <FilterBar as="form" className="office-report-filters office-pipeline-filters office-list-filters" method="get">
        <FilterField className="office-pipeline-search-field" label="Search pipeline">
          <TextInput defaultValue={snapshot.filters.search} name="search" placeholder="Title, address, city, owner..." type="search" />
        </FilterField>
        <FilterField label="Representation">
          <SelectInput defaultValue={snapshot.filters.representing} name="representing">
            <option value="all">Any side</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="both">Both</option>
            <option value="tenant">Tenant</option>
            <option value="landlord">Landlord</option>
          </SelectInput>
        </FilterField>
        <FilterField label="Metric view">
          <SelectInput defaultValue={snapshot.filters.metricMode} name="metricMode">
            {snapshot.filters.metricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </FilterField>
        <FilterField label="Owner / agent">
          <SelectInput defaultValue={snapshot.filters.ownerMembershipId} name="ownerMembershipId">
            <option value="">Any owner / agent</option>
            {snapshot.filters.ownerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </FilterField>
        <div className="office-report-filter-actions">
          <Button type="submit">
            Apply filters
          </Button>
          <Link className="office-button office-button-secondary" href="/office/pipeline">
            Reset
          </Link>
        </div>
        {snapshot.filters.stage ? <input name="stage" type="hidden" value={snapshot.filters.stage} /> : null}
        {snapshot.filters.historyStatus ? <input name="historyStatus" type="hidden" value={snapshot.filters.historyStatus} /> : null}
        {snapshot.filters.historyMonth ? <input name="historyMonth" type="hidden" value={snapshot.filters.historyMonth} /> : null}
      </FilterBar>

      <SectionCard
        className="office-list-card office-pipeline-summary-card"
        subtitle={`Current metric mode: ${snapshot.metricModeLabel}. ${snapshot.metricModeDescription}`}
        title="Pipeline summary"
      >
        <div className="office-kpi-grid office-pipeline-overview-strip" aria-label="Pipeline summary">
          <article className="office-stat-card office-pipeline-overview-card">
            <span>All filtered</span>
            <strong>{snapshot.workspaceSummary.filteredTransactions.count}</strong>
            <p>{snapshot.workspaceSummary.filteredTransactions.metricLabel}</p>
          </article>
          <article className="office-stat-card office-pipeline-overview-card">
            <span>Live funnel</span>
            <strong>{snapshot.workspaceSummary.livePipeline.count}</strong>
            <p>{snapshot.workspaceSummary.livePipeline.metricLabel}</p>
          </article>
          <article className="office-stat-card office-stat-card-accent office-pipeline-overview-card" >
            <span>{hasScopedSelection ? snapshot.selection.label : "Current view"}</span>
            <strong>{snapshot.workspaceSummary.selectedView.count}</strong>
            <p>{snapshot.workspaceSummary.selectedView.metricLabel}</p>
          </article>
          <article className="office-stat-card office-pipeline-overview-card">
            <span>Recent history</span>
            <strong>{snapshot.workspaceSummary.recentHistory.count}</strong>
            <p>{snapshot.workspaceSummary.recentHistory.metricLabel}</p>
          </article>
        </div>
      </SectionCard>

      <section className="office-pipeline-layout">
        <aside className="office-pipeline-rail">
          <section className="office-pipeline-rail-card">
            <div className="office-pipeline-rail-copy">
              <span className="office-eyebrow">Current funnel</span>
              <h3>Live stages</h3>
              <p>Select a live stage to focus the working list.</p>
            </div>

            <div className="office-pipeline-rail-totals">
              <div>
                <span>Live funnel</span>
                <strong>{snapshot.workspaceSummary.livePipeline.count}</strong>
              </div>
              <em>{snapshot.workspaceSummary.livePipeline.metricLabel}</em>
            </div>

            <Link
              className={`office-pipeline-rail-link ${snapshot.selection.kind === "all" ? "is-active" : ""}`}
              href={allTransactionsHref}
            >
              <span className="office-pipeline-rail-link-copy">
                <strong>All filtered transactions</strong>
                <small>Reset the stage or month drilldown.</small>
              </span>
              <span className="office-pipeline-rail-link-count">{snapshot.workspaceSummary.filteredTransactions.count}</span>
              <em>{snapshot.workspaceSummary.filteredTransactions.metricLabel}</em>
            </Link>

            <div className="office-pipeline-rail-section-head">
              <span>Stage</span>
              <span>Count</span>
              <span>{snapshot.metricModeLabel}</span>
            </div>
            <div className="office-pipeline-rail-list">
              {snapshot.funnelBuckets.map((bucket) => (
                <Link
                  className={`office-pipeline-rail-link ${snapshot.filters.stage === bucket.status ? "is-active" : ""}`}
                  href={buildPipelineHref(hrefBaseFilters, {
                    stage: bucket.status,
                    historyStatus: null,
                    historyMonth: null
                  })}
                  key={bucket.status}
                >
                  <span className="office-pipeline-rail-link-copy">
                    <strong>{bucket.status}</strong>
                    <small>{bucket.shareLabel}</small>
                  </span>
                  <span className="office-pipeline-rail-link-count">{bucket.count}</span>
                  <em>{bucket.metricLabel}</em>
                </Link>
              ))}
            </div>
          </section>

          <section className="office-pipeline-rail-card">
            <div className="office-pipeline-rail-copy">
              <span className="office-eyebrow">Closed / cancelled</span>
              <h3>Recent monthly rollups</h3>
              <p>Uses closing date first, then falls back to updated date.</p>
            </div>

            <div className="office-pipeline-rail-totals office-pipeline-rail-totals-muted">
              <div>
                <span>Recent history</span>
                <strong>{snapshot.workspaceSummary.recentHistory.count}</strong>
              </div>
              <em>{snapshot.workspaceSummary.recentHistory.metricLabel}</em>
            </div>

            {snapshot.historyMonths.length > 0 ? (
              <div className="office-pipeline-history-list">
                {snapshot.historyMonths.map((month) => (
                  <article className="office-pipeline-history-month" key={month.monthKey}>
                    <header>
                      <div>
                        <strong>{month.label}</strong>
                        <span>{month.totalCount} records</span>
                      </div>
                      <em>{month.totalMetricLabel}</em>
                    </header>
                    <div className="office-pipeline-history-buckets">
                      {month.buckets.map((bucket) => (
                        <Link
                          className={`office-pipeline-history-link ${
                            snapshot.filters.historyStatus === bucket.status && snapshot.filters.historyMonth === month.monthKey ? "is-active" : ""
                          }`}
                          href={buildPipelineHref(hrefBaseFilters, {
                            stage: null,
                            historyStatus: bucket.status,
                            historyMonth: month.monthKey
                          })}
                          key={`${month.monthKey}-${bucket.status}`}
                        >
                          <span>{bucket.status}</span>
                          <strong>{bucket.count}</strong>
                          <em>{bucket.metricLabel}</em>
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="office-report-empty">No closed or cancelled records matched the current top-level filters in the recent history window.</p>
            )}
          </section>
        </aside>

        <section className="office-pipeline-panel">
          <div className="office-pipeline-panel-header">
            <div className="office-pipeline-panel-copy">
              <span className="office-eyebrow">Working list</span>
              <h3>{snapshot.selection.label}</h3>
              <p>{workingListNote}</p>
              <div className="office-pipeline-selection-meta">
                {snapshot.selection.contextChips.map((chip) => (
                  <span className="office-pipeline-selection-chip" key={chip}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
            <div className="office-pipeline-panel-summary">
              <span>{snapshot.listSummary.totalCount} records</span>
              <strong>{snapshot.listSummary.metricLabel}</strong>
              <em>{snapshot.metricModeLabel}</em>
              {hasScopedSelection ? (
                <Link className="office-pipeline-panel-summary-link" href={allTransactionsHref}>
                  Show all filtered transactions
                </Link>
              ) : null}
            </div>
          </div>

          <HorizontalScrollArea>
            <div className="office-pipeline-table">
              <div className="office-pipeline-table-head">
                <span>Transaction</span>
                <span>City / state</span>
                <span>Status</span>
                <span>Side</span>
                <span>Owner</span>
                <span className="office-pipeline-table-head-number">Price</span>
                <span className="office-pipeline-table-head-number">{snapshot.metricModeLabel}</span>
                <span>Key date</span>
                <span>Updated</span>
              </div>

              <div className="office-pipeline-table-body">
                {snapshot.rows.length > 0 ? (
                  snapshot.rows.map((transaction) => (
                    <Link className="office-pipeline-row" href={`/office/transactions/${transaction.id}`} key={transaction.id}>
                      <span className="office-pipeline-row-main">
                        <strong>{transaction.title}</strong>
                        <small>{transaction.addressLine}</small>
                      </span>
                      <span className="office-pipeline-cell-value office-pipeline-cell-value-strong">
                        <strong>{transaction.cityState}</strong>
                      </span>
                      <span className="office-pipeline-cell-badge">
                        <StatusBadge tone={getPipelineStatusTone(transaction.status)}>{transaction.status}</StatusBadge>
                      </span>
                      <span className="office-pipeline-cell-value">{transaction.representing}</span>
                      <span className="office-pipeline-cell-value">{transaction.owner}</span>
                      <span className="office-pipeline-cell-number">{transaction.priceLabel}</span>
                      <span className="office-pipeline-cell-number office-pipeline-cell-number-strong">{transaction.metricValueLabel}</span>
                      <span className="office-pipeline-cell-date">
                        <small>{transaction.keyDateTypeLabel}</small>
                        <strong>{transaction.keyDateLabel}</strong>
                      </span>
                      <span className="office-pipeline-cell-date">
                        <small>Updated</small>
                        <strong>{transaction.updatedLabel}</strong>
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="office-pipeline-empty">
                    <strong>No transactions matched the current pipeline selection.</strong>
                    <p>Adjust the top filters or clear the stage / history selection to widen the result set.</p>
                  </div>
                )}
              </div>
            </div>
          </HorizontalScrollArea>
        </section>
      </section>
    </PageShell>
  );
}
