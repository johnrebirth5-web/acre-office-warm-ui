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

  return (
    <OfficeListPageShell className="office-performance-page">
      <OfficeListPageHeader
        description="Track agent performance, compare visible contributors across natural month, quarter, and year windows, and review current rankings without leaving the CRM."
        eyebrow="Performance"
        summary={
          <>
            <SummaryChip label="Company" value={workspace.filters.companyLabel} />
            <SummaryChip label="Scope" value={workspace.filters.scopeLabel} />
            <SummaryChip label="View" tone="accent" value={workspace.selectedRangeLabel} />
            {workspace.filters.canExport ? (
              <Link className="office-button-secondary" href={exportHref}>
                Export CSV
              </Link>
            ) : null}
          </>
        }
        title="Agent Performance"
      />

      <ListPageSection
        subtitle="Period and company filters drive the summary, table, and ranking board together."
        title="Performance filters"
      >
        <PerformanceFiltersClient filters={workspace.filters} />
      </ListPageSection>

      <ListPageSection
        subtitle="Summary cards adapt to the current role scope, while ranking cards keep month, quarter, and year snapshots visible together."
        title="Performance summary"
      >
        <ListPageStatsGrid className="office-performance-summary-grid">
          {workspace.summary.cards.map((card) => (
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
        footer={<ListPageFooter summary={`${workspace.table.rowCount} visible row(s)`} />}
        subtitle="Rows respect the current Office role scope, and each cell shows the performance formula already net of rebate, referral fees, and reimbursement."
        title="Performance table"
      >
        <DataTable className="office-list-table office-performance-table">
          <DataTableHeader
            className="office-list-table-header office-list-table-header-performance office-performance-table-head"
            style={performanceTableGridStyle}
          >
            <span>Name</span>
            {workspace.table.columns.map((column) => (
              <span key={column.key}>{column.label}</span>
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
                    Total {row.totalLabel}
                  </small>
                </div>
                {workspace.table.columns.map((column) => (
                  <span key={`${row.membershipId}-${column.key}`}>{row.cellLabels[column.key] ?? "$0"}</span>
                ))}
              </DataTableRow>
            ))}

            {workspace.table.rows.length === 0 ? (
              <EmptyState
                description="Try a different year window, or check whether any matching transactions have move-in or closing dates in this company scope."
                title={workspace.table.emptyMessage}
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>

      <ListPageSection
        subtitle="Agent viewers only see their own amount on the board. Team leaders see group amounts, and company-scope viewers see the full company board."
        title="Performance PK board"
      >
        <ListPageSplit className="office-performance-board-grid">
          {workspace.leaderboards.map((leaderboard) => (
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
                  <span>Rank</span>
                  <span>Agent</span>
                  <span>Performance</span>
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
                        <small>{entry.isViewer ? "Current account" : "Top 10 board"}</small>
                      </div>
                      <span>{entry.amountVisible ? entry.performanceLabel : "Restricted"}</span>
                    </DataTableRow>
                  ))}

                  {leaderboard.entries.length === 0 ? (
                    <EmptyState
                      description="No visible performance was ranked inside this period yet."
                      title={leaderboard.emptyMessage}
                    />
                  ) : null}
                </DataTableBody>
              </DataTable>

              <div className="office-page-actions office-performance-board-summary">
                <SummaryChip label="Current rank" value={buildRankLabel(leaderboard)} />
                {leaderboard.viewerEntry?.amountVisible ? (
                  <SummaryChip label="My performance" tone="accent" value={leaderboard.viewerEntry.performanceLabel} />
                ) : null}
              </div>
            </SectionCard>
          ))}
        </ListPageSplit>
      </ListPageSection>
    </OfficeListPageShell>
  );
}
