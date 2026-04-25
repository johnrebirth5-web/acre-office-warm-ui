import Link from "next/link";
import { canViewOfficeTransactions } from "@acre/auth";
import {
  getOfficePipelineWorkspaceSnapshot,
  type OfficePipelineMetricMode,
  type OfficePipelineStatus
} from "@acre/db";
import { StatusBadge, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
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
  historyYear?: string;
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
    historyYear: string;
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

function getRepresentingLabel(
  value: string,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  if (value === "buyer") {
    return t((messages) => messages.officePipeline.buyerSide);
  }

  if (value === "seller") {
    return t((messages) => messages.officePipeline.sellerSide);
  }

  if (value === "both") {
    return t((messages) => messages.officePipeline.bothSides);
  }

  if (value === "tenant") {
    return t((messages) => messages.officePipeline.tenantSide);
  }

  if (value === "landlord") {
    return t((messages) => messages.officePipeline.landlordSide);
  }

  return t((messages) => messages.officePipeline.anySide);
}

function getMetricModeLabel(
  metricMode: OfficePipelineMetricMode,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  if (metricMode === "office_net") {
    return t((messages) => messages.officePipeline.metricOfficeNet);
  }

  if (metricMode === "office_sales_volume") {
    return t((messages) => messages.officePipeline.metricOfficeSalesVolume);
  }

  if (metricMode === "office_gross") {
    return t((messages) => messages.officePipeline.metricOfficeGross);
  }

  if (metricMode === "my_net_income") {
    return t((messages) => messages.officePipeline.metricMyNetIncome);
  }

  if (metricMode === "my_gross_commission") {
    return t((messages) => messages.officePipeline.metricMyGrossCommission);
  }

  return t((messages) => messages.officePipeline.metricMySalesVolume);
}

function getPipelineStatusLabel(
  status: OfficePipelineStatus,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  if (status === "Opportunity") {
    return t((messages) => messages.officePipeline.statusOpportunity);
  }

  if (status === "Active") {
    return t((messages) => messages.officePipeline.statusActive);
  }

  if (status === "Pending") {
    return t((messages) => messages.officePipeline.statusPending);
  }

  if (status === "Closed") {
    return t((messages) => messages.officePipeline.statusClosed);
  }

  return t((messages) => messages.officePipeline.statusCancelled);
}

function getPipelineRepresentingRowLabel(
  value: string,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  if (value === "Buyer") {
    return t((messages) => messages.officePipeline.buyer);
  }

  if (value === "Seller") {
    return t((messages) => messages.officePipeline.seller);
  }

  if (value === "Both") {
    return t((messages) => messages.officePipeline.both);
  }

  if (value === "Tenant") {
    return t((messages) => messages.officePipeline.tenant);
  }

  return t((messages) => messages.officePipeline.landlord);
}

function getPipelineKeyDateTypeLabel(
  value: string,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  if (value === "Closed") {
    return t((messages) => messages.officePipeline.keyDateClosed);
  }

  if (value === "Important date") {
    return t((messages) => messages.officePipeline.keyDateImportantDate);
  }

  return t((messages) => messages.officePipeline.keyDateUpdated);
}

function getPipelineOwnerLabel(
  value: string,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  return value === "Unassigned" ? t((messages) => messages.officePipeline.unassigned) : value;
}

function getHistoryRangeLabel(
  historyYear: string,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  return historyYear ? historyYear : t((messages) => messages.officePipeline.lastSixMonths);
}

function getHistoryRangeNote(
  historyYear: string,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  return historyYear
    ? t((messages) => messages.officePipeline.januaryToDecember, {
        year: historyYear,
      })
    : t((messages) => messages.officePipeline.latestSixMonthlyBuckets);
}

function getHistoryYearForCurrentMonth(currentHistoryYear: string, monthKey: string) {
  const monthYear = monthKey.slice(0, 4);

  if (!currentHistoryYear || currentHistoryYear === monthYear) {
    return currentHistoryYear;
  }

  return monthYear;
}

function getKeyDateCopy(
  row: {
    keyDateTypeLabel: string;
    keyDateLabel: string;
    updatedLabel: string;
  },
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  if (row.keyDateTypeLabel === "Updated") {
    return t((messages) => messages.officePipeline.updatedPrefix, {
      value: row.updatedLabel,
    });
  }

  return t((messages) => messages.officePipeline.keyDatePrefix, {
    label: getPipelineKeyDateTypeLabel(row.keyDateTypeLabel, t),
    value: row.keyDateLabel,
  });
}

export default async function OfficePipelinePage(props: PipelinePageProps) {
  const context = await requireOfficeSession();
  const { locale, t, formatNumber } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });

  if (!canViewOfficeTransactions(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficePipelineWorkspaceSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id,
    locale,
    search: searchParams.search,
    representing: searchParams.representing,
    ownerMembershipId: searchParams.ownerMembershipId,
    metricMode: searchParams.metricMode,
    view: searchParams.view,
    stage: searchParams.stage,
    historyStatus: searchParams.historyStatus,
    historyMonth: searchParams.historyMonth,
    historyYear: searchParams.historyYear
  });

  const hrefBaseFilters = {
    search: snapshot.filters.search,
    representing: snapshot.filters.representing,
    ownerMembershipId: snapshot.filters.ownerMembershipId,
    metricMode: snapshot.filters.metricMode,
    view: snapshot.filters.view,
    historyMonth: snapshot.filters.historyMonth,
    historyYear: snapshot.filters.historyYear
  };
  const officeMetricOptions = snapshot.filters.metricOptions.filter((option) => option.scope === "office");
  const myMetricOptions = snapshot.filters.metricOptions.filter((option) => option.scope === "my");
  const transactionCountLabel = formatNumber(snapshot.summary.totalCount);
  const currentMonthClosed = snapshot.currentMonthHistory;
  const historyRangeLabel = getHistoryRangeLabel(snapshot.filters.historyYear, t);
  const historyRangeNote = getHistoryRangeNote(snapshot.filters.historyYear, t);
  const metricModeLabel = getMetricModeLabel(snapshot.filters.metricMode, t);
  const selectedHistoryMonthLabel = snapshot.filters.view === "history"
    ? snapshot.historyMonths.find((month) => month.monthKey === snapshot.filters.historyMonth)?.label
    : "";
  const selectionLabel = snapshot.filters.view === "pending"
    ? t((messages) => messages.officePipeline.selectedPending)
    : t((messages) => messages.officePipeline.selectedClosed, {
        month: selectedHistoryMonthLabel || t((messages) => messages.officePipeline.closedHistory),
      });
  const selectionNote = snapshot.filters.view === "pending"
    ? t((messages) => messages.officePipeline.pendingSelectionNote)
    : t((messages) => messages.officePipeline.historySelectionNote);
  const contextChips = [
    getRepresentingLabel(snapshot.filters.representing, t),
    ...(snapshot.filters.search ? [t((messages) => messages.officePipeline.searchChip, { value: snapshot.filters.search })] : []),
    ...(snapshot.filters.ownerMembershipId ? [t((messages) => messages.officePipeline.ownerFilterChip)] : [])
  ];

  return (
    <OfficeListPageShell className="office-pipeline-page office-pipeline-v2-page">
      <OfficeListPageHeader
        description={t((messages) => messages.officePipeline.description)}
        eyebrow={t((messages) => messages.officePipeline.eyebrow)}
        summary={
          <>
            <SummaryChip label={t((messages) => messages.common.officeScope)} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={t((messages) => messages.officePipeline.visibleMetric)} tone="accent" value={metricModeLabel} />
            <SummaryChip label={t((messages) => messages.officePipeline.selection)} value={selectionLabel} />
          </>
        }
        title={t((messages) => messages.officePipeline.title)}
      />

      <section className="office-pipeline-v2-toolbar">
        <details className="office-pipeline-v2-menu">
          <summary className="office-pipeline-v2-menu-trigger">{getRepresentingLabel(snapshot.filters.representing, t)}</summary>
          <div className="office-pipeline-v2-menu-popover">
            {[
              { value: "all", label: t((messages) => messages.officePipeline.anySide) },
              { value: "buyer", label: t((messages) => messages.officePipeline.buyerSide) },
              { value: "seller", label: t((messages) => messages.officePipeline.sellerSide) },
              { value: "both", label: t((messages) => messages.officePipeline.bothSides) },
              { value: "tenant", label: t((messages) => messages.officePipeline.tenantSide) },
              { value: "landlord", label: t((messages) => messages.officePipeline.landlordSide) }
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
          <summary className="office-pipeline-v2-menu-trigger">{metricModeLabel}</summary>
          <div className="office-pipeline-v2-menu-popover office-pipeline-v2-menu-popover-metric">
            {officeMetricOptions.length > 0 ? (
              <>
                <div className="office-pipeline-v2-menu-group-label">{t((messages) => messages.officePipeline.office)}</div>
                {officeMetricOptions.map((option) => (
                  <Link
                    className={`office-pipeline-v2-menu-item ${snapshot.filters.metricMode === option.value ? "is-active" : ""}`}
                    href={buildPipelineHref(hrefBaseFilters, {
                      metricMode: option.value
                    })}
                    key={option.value}
                  >
                    <span>{getMetricModeLabel(option.value, t)}</span>
                  </Link>
                ))}
                <div className="office-pipeline-v2-menu-divider" />
              </>
            ) : null}
            <div className="office-pipeline-v2-menu-group-label">{t((messages) => messages.officePipeline.my)}</div>
            {myMetricOptions.map((option) => (
              <Link
                className={`office-pipeline-v2-menu-item ${snapshot.filters.metricMode === option.value ? "is-active" : ""}`}
                href={buildPipelineHref(hrefBaseFilters, {
                  metricMode: option.value
                })}
                key={option.value}
              >
                <span>{getMetricModeLabel(option.value, t)}</span>
              </Link>
            ))}
          </div>
        </details>
      </section>

      <section className="office-pipeline-v2-layout">
        <aside className="office-pipeline-v2-sidebar">
          <section className="office-pipeline-v2-focus-card" aria-label={t((messages) => messages.officePipeline.pipelineStageSummary)}>
            <div className="office-pipeline-v2-focus-head">
              <div className="office-pipeline-v2-focus-copy">
                <span className="office-pipeline-v2-sidebar-label">{t((messages) => messages.officePipeline.pipelineFocus)}</span>
                <p>{t((messages) => messages.officePipeline.pipelineFocusBody)}</p>
              </div>
              <span className="office-pipeline-v2-selection-pill">{selectionLabel}</span>
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
                <span className="office-pipeline-v2-stage-card-label">{t((messages) => messages.officePipeline.pending)}</span>
                <strong>{snapshot.pendingSummary.count}</strong>
                <em>{snapshot.pendingSummary.metricLabel}</em>
                <small>{t((messages) => messages.officePipeline.dealsStillInMotion)}</small>
              </Link>

              {currentMonthClosed ? (
                <Link
                  className={`office-pipeline-v2-stage-card office-pipeline-v2-stage-card-closed ${
                    snapshot.selection.kind === "history" && snapshot.filters.historyMonth === currentMonthClosed.monthKey ? "is-active" : ""
                  }`}
                  href={buildPipelineHref(hrefBaseFilters, {
                    view: "history",
                    historyMonth: currentMonthClosed.monthKey,
                    historyYear: getHistoryYearForCurrentMonth(snapshot.filters.historyYear, currentMonthClosed.monthKey) || null
                  })}
                >
                  <span className="office-pipeline-v2-stage-card-label">{t((messages) => messages.officePipeline.closedThisMonth)}</span>
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
                <span className="office-pipeline-v2-sidebar-label">{t((messages) => messages.officePipeline.closedHistory)}</span>
                <p>{t((messages) => messages.officePipeline.closedHistoryBody)}</p>
              </div>
              <details className="office-pipeline-v2-menu office-pipeline-v2-history-menu">
                <summary className="office-pipeline-v2-menu-trigger office-pipeline-v2-history-trigger">{historyRangeLabel}</summary>
                <div className="office-pipeline-v2-menu-popover office-pipeline-v2-history-popover">
                  <Link
                    className={`office-pipeline-v2-menu-item ${snapshot.filters.historyYear === "" ? "is-active" : ""}`}
                    href={buildPipelineHref(hrefBaseFilters, {
                      historyYear: null
                    })}
                  >
                    <span>{t((messages) => messages.officePipeline.lastSixMonths)}</span>
                  </Link>
                  <div className="office-pipeline-v2-menu-divider" />
                  <div className="office-pipeline-v2-menu-group-label">{t((messages) => messages.officePipeline.years)}</div>
                  {snapshot.historyYearOptions.map((year) => (
                    <Link
                      className={`office-pipeline-v2-menu-item ${snapshot.filters.historyYear === String(year) ? "is-active" : ""}`}
                      href={buildPipelineHref(hrefBaseFilters, {
                        historyYear: String(year)
                      })}
                      key={year}
                    >
                      <span>{year}</span>
                    </Link>
                  ))}
                </div>
              </details>
            </div>
            <small className="office-pipeline-v2-history-range">{historyRangeNote}</small>
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
                    <small>
                      {month.count} {t((messages) => messages.officePipeline.transactionCountSuffix)}
                    </small>
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
                <strong>{transactionCountLabel}</strong> {t((messages) => messages.officePipeline.title)}
              </h2>
              <p className="office-pipeline-v2-panel-metric">
                {snapshot.summary.totalMetricLabel} {metricModeLabel}
              </p>
              <p className="office-pipeline-v2-panel-note">{selectionNote}</p>
              {contextChips.length > 0 ? (
                <div className="office-pipeline-v2-chip-row">
                  {contextChips.map((chip) => (
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
                      <StatusBadge tone={getPipelineStatusTone(transaction.status)}>{getPipelineStatusLabel(transaction.status, t)}</StatusBadge>
                      <small>{getPipelineRepresentingRowLabel(transaction.representing, t)}</small>
                    </span>
                  </span>

                  <span className="office-pipeline-v2-row-meta">
                    <strong>{getPipelineOwnerLabel(transaction.owner, t)}</strong>
                    <small>{getKeyDateCopy(transaction, t)}</small>
                  </span>
                </Link>
              ))
            ) : (
              <div className="office-pipeline-v2-empty">
                <strong>{t((messages) => messages.officePipeline.noTransactionsTitle)}</strong>
                <p>{t((messages) => messages.officePipeline.noTransactionsBody)}</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </OfficeListPageShell>
  );
}
