import Link from "next/link";
import { canManageOfficeFields, canViewOfficeReports } from "@acre/auth";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  ListPageSection,
  ListPageStatsGrid,
  ListPageTableSection,
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
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { ReportsFiltersClient } from "./reports-filters-client";
import { ReportsTableFooter } from "./reports-table-footer";
import {
  buildReportsHref,
  cloneReportSearchFilterState,
  defaultReportsPage,
  defaultReportsPageSize,
  maxReportsPageSize
} from "./reports-search-layout";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

function parsePositiveInteger(value: string | string[] | undefined, fallback: number, max?: number) {
  const normalized = readSearchParamValue(value);
  const numeric = Number.parseInt(normalized ?? "", 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }

  return max ? Math.min(numeric, max) : numeric;
}

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

function getTranslatedReportStatus(
  status: OfficeReportStatus,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"]
) {
  switch (status) {
    case "Pending":
      return t((messages) => messages.officeTransactions.pending);
    case "Closed":
      return t((messages) => messages.officeTransactions.closed);
    case "Cancelled":
      return t((messages) => messages.officeTransactions.cancelled);
    case "Active":
      return t((messages) => messages.officeTransactions.active);
    case "Opportunity":
      return t((messages) => messages.officeTransactions.opportunity);
    default:
      return status;
  }
}

function getReportSortSummary(
  sortBy: string,
  sortDirection: string,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"]
) {
  const sortLabel =
    sortBy === "asking_price"
      ? t((messages) => messages.officeReports.sortAskingPrice)
      : sortBy === "purchased_price"
        ? t((messages) => messages.officeReports.sortPurchasedPrice)
        : sortBy === "gross_commission"
          ? t((messages) => messages.officeReports.sortGrossCommission)
          : sortBy === "status"
            ? t((messages) => messages.officeReports.sortStatus)
            : t((messages) => messages.officeReports.sortCreatedAt);
  const directionLabel =
    sortBy === "created_at"
      ? sortDirection === "asc"
        ? t((messages) => messages.officeReports.directionOldestFirst)
        : t((messages) => messages.officeReports.directionNewestFirst)
      : sortBy === "status"
        ? sortDirection === "desc"
          ? t((messages) => messages.officeReports.directionReverseWorkflowOrder)
          : t((messages) => messages.officeReports.directionWorkflowOrder)
        : sortDirection === "asc"
          ? t((messages) => messages.officeReports.directionLowestFirst)
          : t((messages) => messages.officeReports.directionHighestFirst);

  return {
    shortLabel: `${sortLabel} · ${directionLabel}`,
    sentenceLabel: `${sortLabel} (${directionLabel})`,
  };
}

export default async function OfficeReportsPage(props: ReportsPageProps) {
  const context = await requireOfficeSession();
  const { t } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const canManageSearchLayout = canManageOfficeFields(context.currentMembership);

  if (!canViewOfficeReports(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const page = parsePositiveInteger(searchParams.page, defaultReportsPage);
  const pageSize = parsePositiveInteger(searchParams.pageSize, defaultReportsPageSize, maxReportsPageSize);
  const workspace = await getOfficeTransactionReportsWorkspace({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    page,
    pageSize,
    searchParams
  });
  const selectedFieldKeys = workspace.searchLayout.selectedFields.map((field) => field.key);
  const exportHref = buildReportsHref("/api/office/reports/export", {
    selectedFieldKeys,
    filters: cloneReportSearchFilterState(workspace.filters)
  });
  const sortSummary = getReportSortSummary(
    workspace.filters.sortBy,
    workspace.filters.sortDirection,
    t
  );

  return (
    <OfficeListPageShell className="office-reports-list-page">
      <OfficeListPageHeader
        actions={
          <Link className="office-button-secondary" href={exportHref}>
            {t((messages) => messages.officeReports.exportCsv)}
          </Link>
        }
        description={t((messages) => messages.officeReports.description)}
        eyebrow={t((messages) => messages.officeReports.eyebrow)}
        summary={
          <>
            <SummaryChip label={t((messages) => messages.officeReports.matchingTransactions)} tone="accent" value={workspace.totalCount} />
            <SummaryChip label={t((messages) => messages.officeReports.purchasedVolume)} value={workspace.summary.totalPurchasedPrice} />
            <SummaryChip label={t((messages) => messages.officeReports.grossCommission)} value={workspace.summary.totalGrossCommission} />
            <SummaryChip label={t((messages) => messages.officeReports.sort)} value={sortSummary.shortLabel} />
          </>
        }
        title={t((messages) => messages.officeReports.title)}
      />

      <ListPageSection
        subtitle={t((messages) => messages.officeReports.filtersSubtitle)}
        title={t((messages) => messages.officeReports.filtersTitle)}
      >
        <ReportsFiltersClient
          canManageSearchLayout={canManageSearchLayout}
          filters={workspace.filters}
          pageSize={workspace.pageSize}
          searchLayout={workspace.searchLayout}
        />
      </ListPageSection>

      <ListPageSection
        subtitle={t((messages) => messages.officeReports.performanceSubtitle, {
          sortLabel: sortSummary.sentenceLabel,
        })}
        title={t((messages) => messages.officeReports.performanceTitle)}
      >
        <ListPageStatsGrid className="office-reports-kpi-grid">
          <StatCard label={t((messages) => messages.officeReports.totalTransactions)} value={workspace.summary.totalTransactions} />
          <StatCard label={t((messages) => messages.officeReports.askingPrice)} value={workspace.summary.totalAskingPrice} />
          <StatCard label={t((messages) => messages.officeReports.purchasedPrice)} value={workspace.summary.totalPurchasedPrice} />
          <StatCard label={t((messages) => messages.officeReports.grossCommission)} value={workspace.summary.totalGrossCommission} />
          <StatCard label={t((messages) => messages.officeReports.rebate)} value={workspace.summary.totalRebate} />
          <StatCard label={t((messages) => messages.officeReports.referral)} value={workspace.summary.totalReferral} />
          <StatCard label={t((messages) => messages.officeReports.reimbursement)} value={workspace.summary.totalReimbursement} />
        </ListPageStatsGrid>
      </ListPageSection>

      <ListPageTableSection
        className="office-list-card"
        footer={
          <ReportsTableFooter
            filters={workspace.filters}
            page={workspace.page}
            pageSize={workspace.pageSize}
            selectedFieldKeys={selectedFieldKeys}
            sortSummary={sortSummary.sentenceLabel}
            totalCount={workspace.totalCount}
            totalPages={workspace.totalPages}
          />
        }
        subtitle={t((messages) => messages.officeReports.filteredTransactionsSubtitle, {
          sortLabel: sortSummary.sentenceLabel,
        })}
        title={t((messages) => messages.officeReports.filteredTransactionsTitle)}
      >
        <DataTable className="office-list-table office-list-table-reports">
          <DataTableHeader className="office-list-table-header office-list-table-header-reports">
            {[
              t((messages) => messages.officeReports.tableTransaction),
              t((messages) => messages.officeReports.tableCreated),
              t((messages) => messages.officeReports.tableOwner),
              t((messages) => messages.officeReports.tableTeamLeader),
              t((messages) => messages.officeReports.tableType),
              t((messages) => messages.officeReports.tableStatus),
              t((messages) => messages.officeReports.tablePurchasedGross),
              t((messages) => messages.officeReports.tableClosingMoveIn),
            ].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {workspace.rows.map((row) => {
              const primaryLabel = row.transactionLabel || row.address || row.transactionNumber;
              const secondaryLabel = row.address && row.address !== primaryLabel ? row.address : "";

              return (
                <DataTableRow
                  className="office-list-table-row office-list-table-row-reports"
                  key={row.transactionNumber}
                >
                  <div className="office-list-table-main">
                    <strong>
                      <Link href={row.href}>{primaryLabel}</Link>
                    </strong>
                    {secondaryLabel ? <p>{secondaryLabel}</p> : null}
                    <div className="office-list-table-main-meta">
                      <span>{row.invoiceNumber || t((messages) => messages.officeReports.noInvoice)}</span>
                      <span>{row.department || t((messages) => messages.officeReports.noDepartment)}</span>
                      <span>{row.representing || t((messages) => messages.officeReports.noSide)}</span>
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
                    {getTranslatedReportStatus(row.status, t)}
                  </StatusBadge>
                  <div className="office-list-table-cell-stack office-report-table-amounts">
                    <strong>{row.purchasedPrice || "—"}</strong>
                    <p>{row.grossCommission || "—"}</p>
                  </div>
                  <span>{row.closingMoveInDate || "—"}</span>
                </DataTableRow>
              );
            })}

            {workspace.rows.length === 0 ? (
              <EmptyState
                description={t((messages) => messages.officeReports.noTransactionsMatchedBody)}
                title={t((messages) => messages.officeReports.noTransactionsMatchedTitle)}
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>
    </OfficeListPageShell>
  );
}
