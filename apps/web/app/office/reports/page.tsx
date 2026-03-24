import Link from "next/link";
import { canManageOfficeFields, canViewOfficeReports } from "@acre/auth";
import {
  EmptyState,
  HorizontalScrollArea,
  ListPageFooter,
  ListPageSection,
  ListPageStatsGrid,
  ListPageTableSection,
  PageHeader,
  PageHeaderSummary,
  PageShell,
  StatCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import {
  getOfficeTransactionReportsWorkspace,
  officeTransactionReportColumns,
  type OfficeReportStatus
} from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { ReportsFiltersClient } from "./reports-filters-client";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStatusTone(status: OfficeReportStatus) {
  if (status === "Closed") {
    return "success" as const;
  }

  if (status === "Pending") {
    return "warning" as const;
  }

  if (status === "Active") {
    return "accent" as const;
  }

  return "neutral" as const;
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

  return `/api/office/reports/export${query.size ? `?${query.toString()}` : ""}`;
}

export default async function OfficeReportsPage(props: ReportsPageProps) {
  const context = await requireOfficeSession();
  const canManageSearchLayout = canManageOfficeFields(context.currentMembership);

  if (!canViewOfficeReports(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const workspace = await getOfficeTransactionReportsWorkspace({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    searchParams
  });
  const exportHref = buildExportHref(searchParams);

  return (
    <PageShell className="office-list-page office-reports-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Matching transactions" tone="accent" value={workspace.totalCount} />
            <SummaryChip label="Purchased volume" value={workspace.summary.totalPurchasedPrice} />
            <SummaryChip label="Gross commission" value={workspace.summary.totalGrossCommission} />
            <Link className="office-button office-button-secondary" href={exportHref}>
              Export CSV
            </Link>
          </PageHeaderSummary>
        }
        description="Unified transaction reporting, summary, and CSV export from the live transaction data source."
        eyebrow="Reports"
        title="Reports"
      />

      <ListPageSection
        subtitle="All filters read directly from transaction data and update the page, summary, and export together."
        title="Report filters"
      >
        <ReportsFiltersClient
          canManageSearchLayout={canManageSearchLayout}
          filters={workspace.filters}
          searchLayout={workspace.searchLayout}
        />
      </ListPageSection>

      <ListPageSection
        subtitle="Summary values update from the same filtered transaction set shown in the table and export."
        title="Transaction performance"
      >
        <ListPageStatsGrid className="office-reports-kpi-grid">
          <StatCard label="Matching transactions" value={workspace.summary.totalTransactions} />
          <StatCard label="Asking Price" value={workspace.summary.totalAskingPrice} />
          <StatCard label="Purchased Price" value={workspace.summary.totalPurchasedPrice} />
          <StatCard label="Gross Commission" value={workspace.summary.totalGrossCommission} />
          <StatCard label="Rebate" value={workspace.summary.totalRebate} />
          <StatCard label="Referral" value={workspace.summary.totalReferral} />
          <StatCard label="Reimbursement" value={workspace.summary.totalReimbursement} />
        </ListPageStatsGrid>
      </ListPageSection>

      <ListPageTableSection
        className="office-list-card"
        footer={<ListPageFooter summary={`${workspace.totalCount} transaction rows`} />}
        subtitle="The table and CSV export use the same column registry and filter predicate."
        title="Filtered transactions"
      >
        <HorizontalScrollArea>
          <table className="office-table">
            <thead className="office-table-header">
              <tr className="office-table-row">
                {officeTransactionReportColumns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workspace.rows.map((row) => (
                <tr className="office-table-row" key={row.transactionNumber}>
                  {officeTransactionReportColumns.map((column) => {
                    if (column.key === "transactionNumber") {
                      return (
                        <td key={column.key}>
                          <Link className="office-inline-action" href={row.href}>
                            {row.transactionNumber}
                          </Link>
                        </td>
                      );
                    }

                    if (column.key === "status") {
                      return (
                        <td key={column.key}>
                          <StatusBadge tone={getStatusTone(row.status)}>{row.status}</StatusBadge>
                        </td>
                      );
                    }

                    return <td key={column.key}>{row[column.key] || "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollArea>

        {workspace.rows.length === 0 ? (
          <EmptyState
            description="Try widening the filter set or clearing one of the exact-match fields."
            title="No transactions matched the current filters"
          />
        ) : null}
      </ListPageTableSection>
    </PageShell>
  );
}
