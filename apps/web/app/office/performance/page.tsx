import Link from "next/link";
import { canViewOfficeReports } from "@acre/auth";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  ListPageFooter,
  ListPageSection,
  ListPageSplit,
  ListPageStatsGrid,
  ListPageTableSection,
  SectionCard,
  StatCard,
  SummaryChip
} from "@acre/ui";
import {
  getOfficePerformanceWorkspace,
  type OfficePerformanceLeaderboard
} from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { PerformanceFiltersClient } from "./performance-filters-client";

type OfficePerformancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const performanceBoardGridStyle = {
  gridTemplateColumns: "88px minmax(180px, 1.5fr) minmax(128px, 0.9fr)"
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

function buildExportHref(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.trim()) {
          query.append(key, item.trim());
        }
      }
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      query.set(key, value.trim());
    }
  }

  return `/api/office/performance/export${query.size ? `?${query.toString()}` : ""}`;
}

function buildRankLabel(leaderboard: OfficePerformanceLeaderboard) {
  return leaderboard.viewerEntry ? `#${leaderboard.viewerEntry.rank}` : "Not ranked";
}

function formatMonthLabel(monthId: string, locale: string) {
  const monthIndex = Number.parseInt(monthId, 10);

  if (!Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return monthId;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, monthIndex - 1, 1)));
}

function translatePerformanceColumnLabel(
  columnKey: string,
  fallbackLabel: string,
  locale: string
) {
  const monthMatch = columnKey.match(/^\d{4}-(\d{2})$/);

  if (monthMatch) {
    return formatMonthLabel(monthMatch[1], locale);
  }

  return fallbackLabel;
}

function buildPerformanceTableGridStyle(columnCount: number) {
  return {
    gridTemplateColumns: [
      "minmax(260px, 2.4fr)",
      ...Array.from({ length: columnCount }, () => "minmax(112px, 0.85fr)")
    ].join(" ")
  };
}

export default async function OfficePerformancePage(props: OfficePerformancePageProps) {
  const context = await requireOfficeSession();
  const { t, locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });

  if (!canViewOfficeReports(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const workspace = await getOfficePerformanceWorkspace({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    period: readSearchParamValue(searchParams.period),
    company: readSearchParamValue(searchParams.company),
    year: readSearchParamValue(searchParams.year),
    month: readSearchParamValue(searchParams.month),
    quarter: readSearchParamValue(searchParams.quarter),
    yearStart: readSearchParamValue(searchParams.yearStart),
    yearEnd: readSearchParamValue(searchParams.yearEnd)
  });
  const exportHref = buildExportHref(searchParams);
  const performanceTableGridStyle = buildPerformanceTableGridStyle(workspace.table.columns.length);
  const isTeamScope = workspace.filters.scopeLabel === "Team scope";
  const translatedScopeLabel =
    workspace.filters.scopeLabel === "Company scope"
      ? t((messages) => messages.officePerformance.companyScope)
      : workspace.filters.scopeLabel === "Team scope"
        ? t((messages) => messages.officePerformance.teamScope)
        : t((messages) => messages.officePerformance.myPerformance);
  const selectedRangeLabel =
    workspace.filters.period === "month"
      ? t((messages) => messages.officePerformance.selectedRangeMonth, {
          year: workspace.filters.year,
        })
      : workspace.filters.period === "quarter"
        ? t((messages) => messages.officePerformance.selectedRangeQuarter, {
            year: workspace.filters.year,
          })
        : t((messages) => messages.officePerformance.selectedRangeYear, {
            start: workspace.filters.yearStart,
            end: workspace.filters.yearEnd,
          });
  const translatedLeaderboards = workspace.leaderboards.map((leaderboard) => ({
    ...leaderboard,
    title:
      leaderboard.period === "month"
        ? `${formatMonthLabel(workspace.filters.month, locale)} ${workspace.filters.year}`
        : leaderboard.period === "quarter"
          ? `Q${workspace.filters.quarter} ${workspace.filters.year}`
          : workspace.filters.year,
    subtitle: isTeamScope
      ? t((messages) => messages.officePerformance.topPerformersInTeam)
      : t((messages) => messages.officePerformance.topPerformersInCompany, {
          company: workspace.filters.companyLabel,
        }),
  }));
  const leaderboardTitleByPeriod = new Map(
    translatedLeaderboards.map((leaderboard) => [leaderboard.period, leaderboard.title])
  );
  const translatedSummaryCards = workspace.summary.cards.map((card) => ({
    ...card,
    label:
      card.id === "selected-performance"
        ? t((messages) => messages.officePerformance.selectedPerformance)
        : card.id === "visible-performance"
          ? t((messages) => messages.officePerformance.visiblePerformance)
          : card.id === "visible-people"
            ? t((messages) => messages.officePerformance.activeUsers)
            : card.id === "month-rank"
              ? isTeamScope
                ? t((messages) => messages.officePerformance.myMonthRank)
                : t((messages) => messages.officePerformance.monthRank)
              : card.id === "quarter-rank"
                ? isTeamScope
                  ? t((messages) => messages.officePerformance.myQuarterRank)
                  : t((messages) => messages.officePerformance.quarterRank)
                : card.id === "year-rank"
                  ? isTeamScope
                    ? t((messages) => messages.officePerformance.myYearRank)
                    : t((messages) => messages.officePerformance.yearRank)
                  : card.label,
    hint:
      card.id === "selected-performance" || card.id === "visible-performance"
        ? selectedRangeLabel
        : card.id === "visible-people"
          ? translatedScopeLabel
          : card.id === "month-rank"
            ? leaderboardTitleByPeriod.get("month") ?? card.hint
            : card.id === "quarter-rank"
              ? leaderboardTitleByPeriod.get("quarter") ?? card.hint
              : card.id === "year-rank"
                ? leaderboardTitleByPeriod.get("year") ?? card.hint
                : card.hint,
  }));

  return (
    <OfficeListPageShell className="office-performance-page">
      <OfficeListPageHeader
        actions={
          workspace.filters.canExport ? (
            <Link className="office-button-secondary" href={exportHref}>
              {t((messages) => messages.officePerformance.exportCsv)}
            </Link>
          ) : null
        }
        description={t((messages) => messages.officePerformance.description)}
        eyebrow={t((messages) => messages.officePerformance.eyebrow)}
        summary={
          <>
            <SummaryChip label={t((messages) => messages.officePerformance.company)} value={workspace.filters.companyLabel} />
            <SummaryChip label={t((messages) => messages.officePerformance.scope)} value={translatedScopeLabel} />
            <SummaryChip label={t((messages) => messages.officePerformance.view)} tone="accent" value={selectedRangeLabel} />
          </>
        }
        title={t((messages) => messages.officePerformance.title)}
      />

      <ListPageSection
        subtitle={t((messages) => messages.officePerformance.filtersSubtitle)}
        title={t((messages) => messages.officePerformance.filtersTitle)}
      >
        <PerformanceFiltersClient filters={workspace.filters} />
      </ListPageSection>

      <ListPageSection
        subtitle={t((messages) => messages.officePerformance.summarySubtitle)}
        title={t((messages) => messages.officePerformance.summaryTitle)}
      >
        <ListPageStatsGrid className="office-performance-summary-grid">
          {translatedSummaryCards.map((card) => (
            <StatCard
              className="office-performance-stat-card"
              hint={card.hint}
              key={card.id}
              label={card.label}
              tone={card.tone}
              value={card.value}
            />
          ))}
        </ListPageStatsGrid>
      </ListPageSection>

      <ListPageTableSection
        className="office-list-card"
        footer={
          <ListPageFooter
            summary={t((messages) => messages.officePerformance.visibleRows, {
              count: workspace.table.rowCount,
            })}
          />
        }
        subtitle={t((messages) => messages.officePerformance.tableSubtitle)}
        title={t((messages) => messages.officePerformance.tableTitle)}
      >
        <DataTable className="office-list-table office-performance-table">
          <DataTableHeader
            className="office-list-table-header office-list-table-header-performance office-performance-table-head"
            style={performanceTableGridStyle}
          >
            <span>{t((messages) => messages.officePerformance.tableName)}</span>
            {workspace.table.columns.map((column) => (
              <span key={column.key}>
                {translatePerformanceColumnLabel(column.key, column.label, locale)}
              </span>
            ))}
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {workspace.table.rows.map((row) => (
              <DataTableRow
                className="office-list-table-row office-list-table-row-performance office-performance-table-row"
                key={row.membershipId}
                style={performanceTableGridStyle}
              >
                <div className="office-list-table-main">
                  <strong>{row.name}</strong>
                  <small>
                    {row.secondaryLabel ? `${row.secondaryLabel} · ` : ""}
                    {t((messages) => messages.officePerformance.totalPrefix, {
                      value: row.totalLabel,
                    })}
                  </small>
                </div>
                {workspace.table.columns.map((column) => (
                  <span key={`${row.membershipId}-${column.key}`}>{row.cellLabels[column.key] ?? "$0"}</span>
                ))}
              </DataTableRow>
            ))}

            {workspace.table.rows.length === 0 ? (
              <EmptyState
                description={t((messages) => messages.officePerformance.noVisibleRowsBody)}
                title={t((messages) => messages.officePerformance.noVisibleRowsTitle)}
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>

      <ListPageSection
        subtitle={t((messages) => messages.officePerformance.boardSubtitle)}
        title={t((messages) => messages.officePerformance.boardTitle)}
      >
        <ListPageSplit className="office-performance-board-grid">
          {translatedLeaderboards.map((leaderboard) => (
            <SectionCard
              className="office-performance-board-card"
              key={leaderboard.period}
              subtitle={leaderboard.subtitle}
              title={leaderboard.title}
            >
              <DataTable className="office-table office-performance-board-table">
                <DataTableHeader
                  className="office-table-header office-table-row office-table-row-performance-board"
                  style={performanceBoardGridStyle}
                >
                  <span>{t((messages) => messages.officePerformance.rank)}</span>
                  <span>{t((messages) => messages.officePerformance.agent)}</span>
                  <span>{t((messages) => messages.officePerformance.performance)}</span>
                </DataTableHeader>
                <DataTableBody>
                  {leaderboard.entries.map((entry) => (
                    <DataTableRow
                      className="office-table-row office-table-row-performance-board"
                      key={`${leaderboard.period}-${entry.membershipId}`}
                      style={performanceBoardGridStyle}
                    >
                      <span>#{entry.rank}</span>
                      <div className="office-list-table-main">
                        <strong>{entry.name}</strong>
                        <small>
                          {entry.isViewer
                            ? t((messages) => messages.officePerformance.currentAccount)
                            : t((messages) => messages.officePerformance.top10Board)}
                        </small>
                      </div>
                      <span>
                        {entry.amountVisible
                          ? entry.performanceLabel
                          : t((messages) => messages.officePerformance.restricted)}
                      </span>
                    </DataTableRow>
                  ))}

                  {leaderboard.entries.length === 0 ? (
                    <EmptyState
                      description={t((messages) => messages.officePerformance.noRankedPerformanceBody)}
                      title={t((messages) => messages.officePerformance.noRankedPerformanceTitle)}
                    />
                  ) : null}
                </DataTableBody>
              </DataTable>

              <div className="office-page-actions office-performance-board-summary">
                <SummaryChip
                  label={t((messages) => messages.officePerformance.currentRank)}
                  value={buildRankLabel(leaderboard) === "Not ranked" ? t((messages) => messages.officePerformance.notRanked) : buildRankLabel(leaderboard)}
                />
                {leaderboard.viewerEntry?.amountVisible ? (
                  <SummaryChip
                    label={t((messages) => messages.officePerformance.myPerformance)}
                    tone="accent"
                    value={leaderboard.viewerEntry.performanceLabel}
                  />
                ) : null}
              </div>
            </SectionCard>
          ))}
        </ListPageSplit>
      </ListPageSection>
    </OfficeListPageShell>
  );
}
