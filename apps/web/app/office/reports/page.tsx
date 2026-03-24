import Link from "next/link";
import { canManageOfficeFields, canViewOfficeReports } from "@acre/auth";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
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

const reportListColumnLabels = [
  "Transaction",
  "Created",
  "Owner",
  "Team leader",
  "Type",
  "Status",
  "Purchased / Gross",
  "Closing / Move-In"
] as const;

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
        subtitle="The on-screen table highlights key operating columns, while CSV export keeps the full report schema."
        title="Filtered transactions"
      >
        <DataTable className="office-list-table office-list-table-reports">
          <DataTableHeader className="office-list-table-header office-list-table-header-reports">
            {reportListColumnLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {workspace.rows.map((row) => (
              <DataTableRow
                className="office-list-table-row office-list-table-row-reports"
                key={row.transactionNumber}
              >
                <div className="office-list-table-main">
                  <strong>
                    <Link href={row.href}>{row.transactionNumber}</Link>
                  </strong>
                  <p>{row.address || "—"}</p>
                  <div className="office-list-table-main-meta">
                    <span>{row.invoiceNumber || "No invoice"}</span>
                    <span>{row.department || "No department"}</span>
                    <span>{row.representing || "No side"}</span>
                  </div>
                </div>
                <span>{row.creationDate || "—"}</span>
                <span className="office-list-table-wrap-cell">{row.owner || "—"}</span>
                <span className="office-list-table-wrap-cell">{row.teamLeader || "—"}</span>
                <span>{row.transactionType || "—"}</span>
                <StatusBadge
                  className="office-list-table-status"
                  tone={getStatusTone(row.status)}
                >
                  {row.status}
                </StatusBadge>
                <div className="office-list-table-cell-stack office-report-table-amounts">
                  <strong>{row.purchasedPrice || "—"}</strong>
                  <p>{row.grossCommission || "—"}</p>
                </div>
                <span>{row.closingMoveInDate || "—"}</span>
              </DataTableRow>
            ))}

            {workspace.rows.length === 0 ? (
              <EmptyState
                description="Try widening the filter set or clearing one of the exact-match fields."
                title="No transactions matched the current filters"
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>
    </PageShell>
  );
}
