import Link from "next/link";
import { canViewOfficeTransactions } from "@acre/auth";
import { getOfficePipelineWorkspaceSnapshot } from "@acre/db";
import { StatusBadge, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";

type PipelinePageSearchParams = {
  search?: string;
  representing?: string;
  ownerMembershipId?: string;
  metricMode?: string;
  view?: string;
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
    view: string;
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

function getRepresentingLabel(value: string) {
  if (value === "buyer") {
    return "Buyer side";
  }

  if (value === "seller") {
    return "Seller side";
  }

  if (value === "both") {
    return "Both sides";
  }

  if (value === "tenant") {
    return "Tenant side";
  }

  if (value === "landlord") {
    return "Landlord side";
  }

  return "Any side";
}

function getKeyDateCopy(row: {
  keyDateTypeLabel: string;
  keyDateLabel: string;
  updatedLabel: string;
}) {
  if (row.keyDateTypeLabel === "Updated") {
    return `updated: ${row.updatedLabel}`;
  }

  return `${row.keyDateTypeLabel.toLowerCase()}: ${row.keyDateLabel}`;
}

export default async function OfficePipelinePage(props: PipelinePageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeTransactions(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficePipelineWorkspaceSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id,
    search: searchParams.search,
    representing: searchParams.representing,
    ownerMembershipId: searchParams.ownerMembershipId,
    metricMode: searchParams.metricMode,
    view: searchParams.view,
    stage: searchParams.stage,
    historyStatus: searchParams.historyStatus,
    historyMonth: searchParams.historyMonth
  });

  const hrefBaseFilters = {
    search: snapshot.filters.search,
    representing: snapshot.filters.representing,
    ownerMembershipId: snapshot.filters.ownerMembershipId,
    metricMode: snapshot.filters.metricMode,
    view: snapshot.filters.view,
    historyMonth: snapshot.filters.historyMonth
  };
  const officeMetricOptions = snapshot.filters.metricOptions.filter((option) => option.scope === "office");
  const myMetricOptions = snapshot.filters.metricOptions.filter((option) => option.scope === "my");
  const transactionCountLabel = new Intl.NumberFormat("en-US").format(snapshot.summary.totalCount);
  const currentMonthClosed = snapshot.historyMonths.find((month) => month.isCurrentMonth) ?? snapshot.historyMonths[0] ?? null;

  return (
    <OfficeListPageShell className="office-pipeline-page office-pipeline-v2-page">
      <OfficeListPageHeader
        description="A calm workbench for reviewing pending deals, monthly closed activity, and the transactions visible inside your current scope."
        eyebrow="Pipeline"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Visible metric" tone="accent" value={snapshot.metricModeLabel} />
            <SummaryChip label="Selection" value={snapshot.selection.label} />
          </>
        }
        title="Pipeline"
      />

      <section className="office-pipeline-v2-toolbar">
        <details className="office-pipeline-v2-menu">
          <summary className="office-pipeline-v2-menu-trigger">{getRepresentingLabel(snapshot.filters.representing)}</summary>
          <div className="office-pipeline-v2-menu-popover">
            {[
              { value: "all", label: "Any side" },
              { value: "buyer", label: "Buyer side" },
              { value: "seller", label: "Seller side" },
              { value: "both", label: "Both sides" },
              { value: "tenant", label: "Tenant side" },
              { value: "landlord", label: "Landlord side" }
            ].map((option) => {
              const href = buildPipelineHref(hrefBaseFilters, {
                representing: option.value,
                view: snapshot.filters.view,
                historyMonth: snapshot.filters.view === "history" ? snapshot.filters.historyMonth : null
              });

              return (
                <Link
                  className={`office-pipeline-v2-menu-item ${snapshot.filters.representing === option.value ? "is-active" : ""}`}
                  href={href}
                  key={option.value}
                >
                  <span>{option.label}</span>
                </Link>
              );
            })}
          </div>
        </details>

        <details className="office-pipeline-v2-menu">
          <summary className="office-pipeline-v2-menu-trigger">{snapshot.metricModeLabel}</summary>
          <div className="office-pipeline-v2-menu-popover office-pipeline-v2-menu-popover-metric">
            {officeMetricOptions.length > 0 ? (
              <>
                <div className="office-pipeline-v2-menu-group-label">Office</div>
                {officeMetricOptions.map((option) => (
                  <Link
                    className={`office-pipeline-v2-menu-item ${snapshot.filters.metricMode === option.value ? "is-active" : ""}`}
                    href={buildPipelineHref(hrefBaseFilters, {
                      metricMode: option.value
                    })}
                    key={option.value}
                  >
                    <span>{option.label}</span>
                  </Link>
                ))}
                <div className="office-pipeline-v2-menu-divider" />
              </>
            ) : null}
            <div className="office-pipeline-v2-menu-group-label">My</div>
            {myMetricOptions.map((option) => (
              <Link
                className={`office-pipeline-v2-menu-item ${snapshot.filters.metricMode === option.value ? "is-active" : ""}`}
                href={buildPipelineHref(hrefBaseFilters, {
                  metricMode: option.value
                })}
                key={option.value}
              >
                <span>{option.label}</span>
              </Link>
            ))}
          </div>
        </details>
      </section>

      <section className="office-pipeline-v2-layout">
        <aside className="office-pipeline-v2-sidebar">
          <section className="office-pipeline-v2-focus-card" aria-label="Pipeline stage summary">
            <div className="office-pipeline-v2-focus-head">
              <div className="office-pipeline-v2-focus-copy">
                <span className="office-pipeline-v2-sidebar-label">Pipeline focus</span>
                <p>Use the two main cards to switch between open work and this month&apos;s closed results.</p>
              </div>
              <span className="office-pipeline-v2-selection-pill">{snapshot.selection.label}</span>
            </div>

            <div className="office-pipeline-v2-stage-grid">
            <Link
              className={`office-pipeline-v2-stage-card office-pipeline-v2-stage-card-pending ${
                snapshot.selection.kind === "pending" ? "is-active" : ""
              }`}
              href={buildPipelineHref(hrefBaseFilters, {
                view: "pending",
                historyMonth: null
              })}
            >
              <span className="office-pipeline-v2-stage-card-label">Pending</span>
              <strong>{snapshot.pendingSummary.count}</strong>
              <em>{snapshot.pendingSummary.metricLabel}</em>
              <small>Deals still in motion</small>
            </Link>

            {currentMonthClosed ? (
              <Link
                className={`office-pipeline-v2-stage-card office-pipeline-v2-stage-card-closed ${
                  snapshot.selection.kind === "history" && snapshot.filters.historyMonth === currentMonthClosed.monthKey ? "is-active" : ""
                }`}
                href={buildPipelineHref(hrefBaseFilters, {
                  view: "history",
                  historyMonth: currentMonthClosed.monthKey
                })}
              >
                <span className="office-pipeline-v2-stage-card-label">Closed This Month</span>
                <strong>{currentMonthClosed.count}</strong>
                <em>{currentMonthClosed.metricLabel}</em>
                <small>{currentMonthClosed.label}</small>
              </Link>
            ) : null}
            </div>
          </section>

          <section className="office-pipeline-v2-history-card">
            <div className="office-pipeline-v2-history-head">
              <div className="office-pipeline-v2-history-head-copy">
                <span className="office-pipeline-v2-sidebar-label">Closed history</span>
                <p>Recent monthly performance, kept visible even when a month is empty.</p>
              </div>
            </div>
            <small className="office-pipeline-v2-history-range">Last 6 months</small>
            <div className="office-pipeline-v2-history-list">
              {snapshot.historyMonths.map((month) => (
                <Link
                  className={`office-pipeline-v2-history-row ${
                    snapshot.selection.kind === "history" && snapshot.filters.historyMonth === month.monthKey ? "is-active" : ""
                  }`}
                  href={buildPipelineHref(hrefBaseFilters, {
                    view: "history",
                    historyMonth: month.monthKey
                  })}
                  key={month.monthKey}
                >
                  <span className="office-pipeline-v2-history-copy">
                    <strong>{month.label}</strong>
                    <small>{month.count} transactions</small>
                  </span>
                  <span className="office-pipeline-v2-history-metrics">
                    <b>{month.count}</b>
                    <em>{month.metricLabel}</em>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </aside>

        <section className="office-pipeline-v2-panel">
          <div className="office-pipeline-v2-panel-head">
            <div className="office-pipeline-v2-panel-copy">
              <h2>
                <strong>{transactionCountLabel}</strong> Transactions
              </h2>
              <p className="office-pipeline-v2-panel-metric">
                {snapshot.summary.totalMetricLabel} {snapshot.metricModeLabel}
              </p>
              <p className="office-pipeline-v2-panel-note">{snapshot.selection.note}</p>
              {snapshot.selection.contextChips.length > 0 ? (
                <div className="office-pipeline-v2-chip-row">
                  {snapshot.selection.contextChips.map((chip) => (
                    <span className="office-pipeline-v2-chip" key={chip}>
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="office-pipeline-v2-list">
            {snapshot.rows.length > 0 ? (
              snapshot.rows.map((transaction) => (
                <Link className="office-pipeline-v2-row" href={`/office/transactions/${transaction.id}`} key={transaction.id}>
                  <span className="office-pipeline-v2-row-icon" aria-hidden="true">
                    <svg fill="none" viewBox="0 0 24 24">
                      <path
                        d="M5.5 10.25 12 5l6.5 5.25"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M7.25 9.75V18a.75.75 0 0 0 .75.75h8a.75.75 0 0 0 .75-.75V9.75"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M10.25 18.75V14.5a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v4.25"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </span>

                  <span className="office-pipeline-v2-row-main">
                    <strong>{transaction.addressLine}</strong>
                    <b>{transaction.amountLabel}</b>
                    <span className="office-pipeline-v2-row-inline-meta">
                      <StatusBadge tone={getPipelineStatusTone(transaction.status)}>{transaction.status}</StatusBadge>
                      <small>{transaction.representing}</small>
                    </span>
                  </span>

                  <span className="office-pipeline-v2-row-meta">
                    <strong>{transaction.owner}</strong>
                    <small>{getKeyDateCopy(transaction)}</small>
                  </span>
                </Link>
              ))
            ) : (
              <div className="office-pipeline-v2-empty">
                <strong>No transactions matched the current pipeline selection.</strong>
                <p>Try switching months, changing the side filter, or removing any hidden URL filters.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </OfficeListPageShell>
  );
}
