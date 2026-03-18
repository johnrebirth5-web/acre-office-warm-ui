import Link from "next/link";
import type { ReactNode } from "react";
import { canViewOfficeReports } from "@acre/auth";
import {
  Badge,
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  HorizontalScrollArea,
  ListPageFooter,
  ListPageFilters,
  ListPageSection,
  ListPageSplit,
  ListPageStack,
  ListPageStatsGrid,
  ListPageTableSection,
  PageHeader,
  PageHeaderSummary,
  PageShell,
  SecondaryMetaList,
  SelectInput,
  StatCard,
  StatusBadge,
  SummaryChip,
  TextInput
} from "@acre/ui";
import { getOfficeReportsSnapshot, type OfficeReportStatus } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";

type ReportsPageSearchParams = {
  startDate?: string;
  endDate?: string;
  officeId?: string;
  ownerMembershipId?: string;
  teamId?: string;
  transactionStatus?: string;
  transactionType?: string;
  commissionPlanId?: string;
};

type ReportsPageProps = {
  searchParams?: Promise<ReportsPageSearchParams>;
};

function ReportsTable(props: { children: ReactNode }) {
  return (
    <HorizontalScrollArea>
      <div className="office-table">{props.children}</div>
    </HorizontalScrollArea>
  );
}

function ReportsSummaryTable(props: { children: ReactNode }) {
  return <div className="office-table office-report-summary-table">{props.children}</div>;
}

function buildReportsHref(
  currentFilters: {
    startDate: string;
    endDate: string;
    officeId: string;
    ownerMembershipId: string;
    teamId: string;
    transactionStatus: string;
    transactionType: string;
    commissionPlanId: string;
  },
  overrides: Partial<Record<keyof ReportsPageSearchParams, string | null>>
) {
  const searchParams = new URLSearchParams();
  const nextFilters = {
    ...currentFilters,
    ...overrides
  };

  Object.entries(nextFilters).forEach(([key, value]) => {
    if (!value?.trim()) {
      return;
    }

    searchParams.set(key, value.trim());
  });

  const query = searchParams.toString();
  return query ? `/office/reports?${query}` : "/office/reports";
}

function buildTransactionsHref(
  currentFilters: {
    startDate: string;
    endDate: string;
    ownerMembershipId: string;
    teamId: string;
    transactionStatus: string;
    transactionType: string;
  },
  overrides: {
    ownerMembershipId?: string | null;
    teamId?: string | null;
    transactionStatus?: string | null;
    transactionType?: string | null;
  }
) {
  const searchParams = new URLSearchParams();
  const nextFilters = {
    ...currentFilters,
    ...overrides
  };
  const transactionStatusLabelMap: Record<string, string> = {
    opportunity: "Opportunity",
    active: "Active",
    pending: "Pending",
    closed: "Closed",
    cancelled: "Cancelled"
  };

  if (nextFilters.startDate.trim()) {
    searchParams.set("startDate", nextFilters.startDate.trim());
  }

  if (nextFilters.endDate.trim()) {
    searchParams.set("endDate", nextFilters.endDate.trim());
  }

  if (nextFilters.ownerMembershipId?.trim()) {
    searchParams.set("ownerMembershipId", nextFilters.ownerMembershipId.trim());
  }

  if (nextFilters.teamId?.trim()) {
    searchParams.set("teamId", nextFilters.teamId.trim());
  }

  if (nextFilters.transactionType?.trim()) {
    searchParams.set("type", nextFilters.transactionType.trim());
  }

  if (nextFilters.transactionStatus?.trim()) {
    searchParams.set("status", transactionStatusLabelMap[nextFilters.transactionStatus.trim()] ?? "All");
  }

  const query = searchParams.toString();
  return query ? `/office/transactions?${query}` : "/office/transactions";
}

function getTransactionTypeQueryValue(label: string) {
  const labelMap: Record<string, string> = {
    Sales: "sales",
    "Sales (listing)": "sales_listing",
    "Rental/Leasing": "rental_leasing",
    "Rental (listing)": "rental_listing",
    "Commercial Sales": "commercial_sales",
    "Commercial Lease": "commercial_lease",
    Other: "other"
  };

  return labelMap[label] ?? label;
}

function getFilterStatusLabel(value: string) {
  const labelMap: Record<string, string> = {
    opportunity: "Opportunity",
    active: "Active",
    pending: "Pending",
    closed: "Closed",
    cancelled: "Cancelled"
  };

  return labelMap[value] ?? value;
}

function getFilterTypeLabel(value: string) {
  const labelMap: Record<string, string> = {
    sales: "Sales",
    sales_listing: "Sales (listing)",
    rental_leasing: "Rental/Leasing",
    rental_listing: "Rental (listing)",
    commercial_sales: "Commercial Sales",
    commercial_lease: "Commercial Lease",
    other: "Other"
  };

  return labelMap[value] ?? value;
}

function buildAccountingHref(
  currentFilters: {
    startDate: string;
    endDate: string;
    ownerMembershipId: string;
    teamId: string;
    transactionStatus: string;
    transactionType: string;
    commissionPlanId: string;
  },
  overrides: {
    type?: string | null;
    status?: string | null;
    anchor?: string | null;
  }
) {
  const searchParams = new URLSearchParams();

  if (currentFilters.startDate.trim()) {
    searchParams.set("startDate", currentFilters.startDate.trim());
  }

  if (currentFilters.endDate.trim()) {
    searchParams.set("endDate", currentFilters.endDate.trim());
  }

  if (currentFilters.ownerMembershipId.trim()) {
    searchParams.set("ownerMembershipId", currentFilters.ownerMembershipId.trim());
  }

  if (overrides.type?.trim()) {
    searchParams.set("type", overrides.type.trim());
  }

  if (overrides.status?.trim()) {
    searchParams.set("status", overrides.status.trim());
  }

  const query = searchParams.toString();
  const href = query ? `/office/accounting?${query}` : "/office/accounting";

  return overrides.anchor ? `${href}${overrides.anchor}` : href;
}

function buildCommissionHref(
  currentFilters: {
    startDate: string;
    endDate: string;
    ownerMembershipId: string;
    teamId: string;
    transactionStatus: string;
    transactionType: string;
    commissionPlanId: string;
  },
  overrides: {
    commissionMembershipId?: string | null;
    commissionTeamId?: string | null;
    commissionStatus?: string | null;
    commissionPlanId?: string | null;
  }
) {
  const searchParams = new URLSearchParams();

  if (overrides.commissionMembershipId?.trim()) {
    searchParams.set("commissionMembershipId", overrides.commissionMembershipId.trim());
  }

  if (overrides.commissionTeamId?.trim()) {
    searchParams.set("commissionTeamId", overrides.commissionTeamId.trim());
  }

  if (overrides.commissionStatus?.trim()) {
    searchParams.set("commissionStatus", overrides.commissionStatus.trim());
  }

  const commissionPlanId = overrides.commissionPlanId ?? currentFilters.commissionPlanId;
  if (commissionPlanId?.trim()) {
    searchParams.set("commissionPlanId", commissionPlanId.trim());
  }

  if (currentFilters.startDate.trim()) {
    searchParams.set("commissionStartDate", currentFilters.startDate.trim());
  }

  if (currentFilters.endDate.trim()) {
    searchParams.set("commissionEndDate", currentFilters.endDate.trim());
  }

  if (currentFilters.ownerMembershipId.trim()) {
    searchParams.set("commissionMembershipId", overrides.commissionMembershipId ?? currentFilters.ownerMembershipId.trim());
  }

  if (currentFilters.teamId.trim()) {
    searchParams.set("commissionTeamId", overrides.commissionTeamId ?? currentFilters.teamId.trim());
  }

  const query = searchParams.toString();
  return query ? `/office/settings/commission-plans?${query}` : "/office/settings/commission-plans";
}

function getTransactionStatusTone(status: OfficeReportStatus) {
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

function getWorkflowTone(value: string) {
  if (value === "Payable" || value === "Paid" || value === "Complete" || value === "Fully deposited") {
    return "success" as const;
  }

  if (value === "Statement ready" || value === "Calculated" || value === "Pending bank deposit") {
    return "accent" as const;
  }

  if (value === "Overdue" || value === "Draft" || value === "Not received") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export default async function OfficeReportsPage(props: ReportsPageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeReports(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeReportsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    officeFilterId: searchParams.officeId,
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    ownerMembershipId: searchParams.ownerMembershipId,
    teamId: searchParams.teamId,
    transactionStatus: searchParams.transactionStatus,
    transactionType: searchParams.transactionType,
    commissionPlanId: searchParams.commissionPlanId
  });
  const hrefBaseFilters = {
    startDate: snapshot.filters.startDate,
    endDate: snapshot.filters.endDate,
    officeId: snapshot.filters.officeId,
    ownerMembershipId: snapshot.filters.ownerMembershipId,
    teamId: snapshot.filters.teamId,
    transactionStatus: snapshot.filters.transactionStatus,
    transactionType: snapshot.filters.transactionType,
    commissionPlanId: snapshot.filters.commissionPlanId
  };
  const exportSearchParams = new URLSearchParams();

  Object.entries(hrefBaseFilters).forEach(([key, value]) => {
    if (!value?.trim()) {
      return;
    }

    exportSearchParams.set(key, value.trim());
  });

  const exportHref = `/api/office/reports/export${exportSearchParams.size ? `?${exportSearchParams.toString()}` : ""}`;
  const allTransactionsHref = buildTransactionsHref(
    {
      startDate: snapshot.filters.startDate,
      endDate: snapshot.filters.endDate,
      ownerMembershipId: snapshot.filters.ownerMembershipId,
      teamId: snapshot.filters.teamId,
      transactionStatus: snapshot.filters.transactionStatus,
      transactionType: snapshot.filters.transactionType
    },
    {}
  );

  return (
    <PageShell className="office-list-page office-reports-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Matching transactions" tone="accent" value={snapshot.totals.totalTransactions} />
            <SummaryChip label="Total volume" value={snapshot.totals.totalVolumeLabel} />
            <Link className="office-button office-button-secondary" href={exportHref}>
              Export CSV
            </Link>
          </PageHeaderSummary>
        }
        description="Manager-facing reports workspace for live transaction, agent/team, commission, accounting, and earnest money data."
        eyebrow="Reports"
        title="Reports"
      />

      <ListPageSection subtitle="Shareable query-param filters across transactions, commissions, accounting, and EMD slices." title="Report filters">
        <ListPageFilters as="form" className="office-report-filters" method="get">
          <FilterField label="Start date">
            <TextInput defaultValue={snapshot.filters.startDate} name="startDate" type="date" />
          </FilterField>
          <FilterField label="End date">
            <TextInput defaultValue={snapshot.filters.endDate} name="endDate" type="date" />
          </FilterField>
          <FilterField label="Office">
            <SelectInput defaultValue={snapshot.filters.officeId} name="officeId">
              <option value="">All offices</option>
              {snapshot.filters.officeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>
          <FilterField label="Owner / agent">
            <SelectInput defaultValue={snapshot.filters.ownerMembershipId} name="ownerMembershipId">
              <option value="">All owners</option>
              {snapshot.filters.ownerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>
          <FilterField label="Team">
            <SelectInput defaultValue={snapshot.filters.teamId} name="teamId">
              <option value="">All teams</option>
              {snapshot.filters.teamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>
          <FilterField label="Transaction status">
            <SelectInput defaultValue={snapshot.filters.transactionStatus} name="transactionStatus">
              <option value="">All statuses</option>
              <option value="opportunity">Opportunity</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </SelectInput>
          </FilterField>
          <FilterField label="Transaction type">
            <SelectInput defaultValue={snapshot.filters.transactionType} name="transactionType">
              <option value="">All types</option>
              <option value="sales">Sales</option>
              <option value="sales_listing">Sales (listing)</option>
              <option value="rental_leasing">Rental/Leasing</option>
              <option value="rental_listing">Rental (listing)</option>
              <option value="commercial_sales">Commercial Sales</option>
              <option value="commercial_lease">Commercial Lease</option>
              <option value="other">Other</option>
            </SelectInput>
          </FilterField>
          <FilterField label="Commission plan">
            <SelectInput defaultValue={snapshot.filters.commissionPlanId} name="commissionPlanId">
              <option value="">All calculated plans</option>
              {snapshot.filters.commissionPlanOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>
          <div className="office-filter-actions">
            <Button type="submit">Apply filters</Button>
            <Link className="office-button office-button-secondary" href="/office/reports">
              Reset
            </Link>
          </div>
        </ListPageFilters>
      </ListPageSection>

      <nav aria-label="Reports sections" className="office-section-nav">
        <a href="#reports-scope">Scope</a>
        <a href="#reports-transactions">Transactions</a>
        <a href="#reports-agents">Agents</a>
        {snapshot.teamPerformance.hasTeams ? <a href="#reports-teams">Teams</a> : null}
        <a href="#reports-commissions">Commissions</a>
        <a href="#reports-accounting">Accounting</a>
        <a href="#reports-emd">EMD</a>
      </nav>

      <ListPageSection
        subtitle="Top-level report totals stay query-param scoped and derived only from persisted transaction, commission, accounting, and EMD data."
        title="Report summary"
      >
        <ListPageStatsGrid className="office-reports-kpi-grid">
          <StatCard hint="Real transactions inside the current reporting window." label="Matching transactions" value={snapshot.totals.totalTransactions} />
          <StatCard hint="Total price across the current filtered transaction set." label="Total volume" value={snapshot.totals.totalVolumeLabel} />
          <StatCard hint="Pulled from persisted transaction finance values; no missing values are inferred." label="Gross commission" value={snapshot.totals.totalGrossCommissionLabel} />
          <StatCard hint="Sum of persisted office net values from transaction finance." label="Office net" value={snapshot.totals.totalOfficeNetLabel} />
          <StatCard hint="Can drill directly into the filtered transaction list." label="Closed transactions" value={snapshot.totals.closedTransactionCount} />
          <StatCard hint="Owners with at least one matching deal in the current slice." label="Active owners" value={snapshot.totals.activeOwnerCount} />
          <StatCard hint={`${snapshot.totals.payableCommissionLabel} already in payable status.`} label="Statement ready / payable" value={snapshot.totals.statementReadyCommissionLabel} />
          <StatCard hint={`${snapshot.totals.overdueEmdCount} overdue EMD records in the current slice.`} label="Received payments / overdue EMD" value={snapshot.totals.receivedPaymentsLabel} />
        </ListPageStatsGrid>
      </ListPageSection>

      <ListPageSplit className="office-reports-workspace">
        <ListPageStack>
          <section id="reports-scope">
            <ListPageSection
              className="office-list-card"
              actions={
                <Link className="office-button office-button-secondary" href={allTransactionsHref}>
                  Open transactions
                </Link>
              }
              subtitle="Filters stay query-param driven so this view can be shared with office managers and admins."
              title="Reporting scope"
            >
              <SecondaryMetaList
                items={[
                  {
                    label: "Office scope",
                    value: context.currentOffice?.name ?? context.currentOrganization.name
                  },
                  {
                    label: "Transaction window",
                    value:
                      snapshot.filters.startDate || snapshot.filters.endDate
                        ? `${snapshot.filters.startDate || "Any"} -> ${snapshot.filters.endDate || "Any"}`
                        : "Open"
                  },
                  {
                    label: "Current slice",
                    value: [
                      snapshot.filters.ownerMembershipId ? "Owner scoped" : "All owners",
                      snapshot.filters.teamId ? "Team scoped" : "All teams",
                      snapshot.filters.transactionStatus
                        ? `Status ${getFilterStatusLabel(snapshot.filters.transactionStatus)}`
                        : "All transaction states",
                      snapshot.filters.transactionType ? `Type ${getFilterTypeLabel(snapshot.filters.transactionType)}` : "All transaction types",
                      snapshot.filters.commissionPlanId ? "Calculated plan scoped" : "All calculated plans"
                    ].join(" · ")
                  }
                ]}
              />

              <div className="office-report-limitations">
                <strong>Reporting rules</strong>
                <ul>
                  {snapshot.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </ListPageSection>
          </section>

          <section id="reports-transactions">
            <ListPageSection
              className="office-list-card"
              actions={
                <Link className="office-button office-button-secondary" href={allTransactionsHref}>
                  View filtered list
                </Link>
              }
              subtitle="Review status, type, and time trends inside the current transaction slice."
              title="Transaction performance"
            >
              <div className="office-report-summary-grid">
                <ReportsSummaryTable>
                  <div className="office-table-header office-table-row office-table-row-report-status">
                    <span>Status</span>
                    <span>Count</span>
                    <span>Volume</span>
                    <span>Office net</span>
                  </div>
                  {snapshot.transactionsByStatus.map((item) => (
                    <Link
                      className="office-table-row office-table-row-report-status"
                      href={buildTransactionsHref(
                        {
                          startDate: snapshot.filters.startDate,
                          endDate: snapshot.filters.endDate,
                          ownerMembershipId: snapshot.filters.ownerMembershipId,
                          teamId: snapshot.filters.teamId,
                          transactionStatus: snapshot.filters.transactionStatus,
                          transactionType: snapshot.filters.transactionType
                        },
                        {
                          transactionStatus:
                            snapshot.filters.transactionStatus === item.status.toLowerCase() ? null : item.status.toLowerCase()
                        }
                      )}
                      key={item.status}
                    >
                      <span>
                        <StatusBadge tone={getTransactionStatusTone(item.status)}>{item.status}</StatusBadge>
                      </span>
                      <span>{item.count}</span>
                      <span>{item.totalVolumeLabel}</span>
                      <span>{item.officeNetLabel}</span>
                    </Link>
                  ))}
                </ReportsSummaryTable>

                <ReportsSummaryTable>
                  <div className="office-table-header office-table-row office-table-row-report-types">
                    <span>Type</span>
                    <span>Count</span>
                    <span>Volume</span>
                    <span>Office net</span>
                  </div>
                  {snapshot.transactionTypes.map((item) => (
                    <Link
                      className="office-table-row office-table-row-report-types"
                      href={buildTransactionsHref(
                        {
                          startDate: snapshot.filters.startDate,
                          endDate: snapshot.filters.endDate,
                          ownerMembershipId: snapshot.filters.ownerMembershipId,
                          teamId: snapshot.filters.teamId,
                          transactionStatus: snapshot.filters.transactionStatus,
                          transactionType: snapshot.filters.transactionType
                        },
                        {
                          transactionType:
                            snapshot.filters.transactionType === getTransactionTypeQueryValue(item.type)
                              ? null
                              : getTransactionTypeQueryValue(item.type)
                        }
                      )}
                      key={item.type}
                    >
                      <span>{item.type}</span>
                      <span>{item.count}</span>
                      <span>{item.totalVolumeLabel}</span>
                      <span>{item.officeNetLabel}</span>
                    </Link>
                  ))}
                </ReportsSummaryTable>
              </div>

              <div className="office-note-list office-report-time-list">
                {snapshot.transactionsOverTime.map((point) => (
                  <article className="office-note-item" key={point.label}>
                    <span>{point.label.slice(0, 3)}</span>
                    <div>
                      <strong>{point.label}</strong>
                      <p>
                        {point.transactionCount} transactions · {point.closedTransactionCount ?? 0} closed · {point.totalVolumeLabel ?? "$0"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </ListPageSection>
          </section>

          <section>
            <ListPageTableSection
              className="office-list-card"
              actions={
                <Link className="office-button office-button-secondary" href={allTransactionsHref}>
                  Open full transaction list
                </Link>
              }
              footer={<ListPageFooter summary={`${snapshot.recentTransactions.length} recent transaction rows`} />}
              subtitle="Most recent matching transaction rows with direct links into detail."
              title="Recent transactions"
            >
              <DataTable className="office-table">
                <DataTableHeader className="office-table-header office-table-row office-table-row-report-transactions">
                  <span>Transaction</span>
                  <span>Status</span>
                  <span>Type</span>
                  <span>Owner</span>
                  <span>Price</span>
                  <span>Office net</span>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.recentTransactions.map((transaction) => (
                    <Link className="office-data-table-row office-table-row office-table-row-report-transactions" href={transaction.href} key={transaction.id} role="row">
                      <div className="office-table-primary">
                        <strong>{transaction.title}</strong>
                        <p>
                          {transaction.addressLine} · Created {transaction.createdAtLabel} · Closing {transaction.closingDateLabel}
                        </p>
                      </div>
                      <span>
                        <StatusBadge tone={getTransactionStatusTone(transaction.status)}>{transaction.status}</StatusBadge>
                      </span>
                      <span>{transaction.type}</span>
                      <span>{transaction.ownerName}</span>
                      <span>{transaction.priceLabel}</span>
                      <span>{transaction.officeNetLabel}</span>
                    </Link>
                  ))}
                  {snapshot.recentTransactions.length === 0 ? (
                    <EmptyState description="No records matched the current transaction filters." title="No transactions" />
                  ) : null}
                </DataTableBody>
              </DataTable>
            </ListPageTableSection>
          </section>
        </ListPageStack>

        <ListPageStack>
          <section id="reports-agents">
            <ListPageTableSection
              className="office-list-card"
              actions={
                <Link
                  className="office-button office-button-secondary"
                  href={buildReportsHref(hrefBaseFilters, { ownerMembershipId: null, teamId: null })}
                >
                  Clear people filters
                </Link>
              }
              footer={<ListPageFooter summary={`${snapshot.agentPerformance.length} agent performance rows`} />}
              subtitle="Owner-level transaction finance rollup with drill-down into profiles and transaction lists."
              title="Agent performance"
            >
              <DataTable className="office-table">
                <DataTableHeader className="office-table-header office-table-row office-table-row-report-agents">
                  <span>Agent</span>
                  <span>Team</span>
                  <span>Deals</span>
                  <span>Closed</span>
                  <span>Volume</span>
                  <span>Gross / office net</span>
                  <span>Actions</span>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.agentPerformance.map((row) => (
                    <DataTableRow className="office-table-row office-table-row-report-agents" key={row.ownerMembershipId ?? row.ownerName}>
                      <div className="office-table-primary">
                        <strong>{row.ownerName}</strong>
                        <p>
                          {row.pendingTransactionCount} pending · avg {row.averageVolumeLabel} · agent net {row.agentNetLabel}
                        </p>
                      </div>
                      <span>{row.teamLabel}</span>
                      <span>{row.transactionCount}</span>
                      <span>{row.closedTransactionCount}</span>
                      <span>{row.totalVolumeLabel}</span>
                      <div className="office-table-primary">
                        <strong>{row.grossCommissionLabel}</strong>
                        <p>{row.officeNetLabel}</p>
                      </div>
                      <div className="office-report-row-actions">
                        {row.ownerMembershipId ? (
                          <Link
                            className="office-inline-action"
                            href={buildTransactionsHref(
                              {
                                startDate: snapshot.filters.startDate,
                                endDate: snapshot.filters.endDate,
                                ownerMembershipId: snapshot.filters.ownerMembershipId,
                                teamId: snapshot.filters.teamId,
                                transactionStatus: snapshot.filters.transactionStatus,
                                transactionType: snapshot.filters.transactionType
                              },
                              {
                                ownerMembershipId: row.ownerMembershipId
                              }
                            )}
                          >
                            Transactions
                          </Link>
                        ) : null}
                        {row.profileHref ? (
                          <Link className="office-inline-action" href={row.profileHref}>
                            Profile
                          </Link>
                        ) : null}
                      </div>
                    </DataTableRow>
                  ))}
                  {snapshot.agentPerformance.length === 0 ? (
                    <EmptyState description="No owner-attributed production matched the current slice." title="No agent rows" />
                  ) : null}
                </DataTableBody>
              </DataTable>
            </ListPageTableSection>
          </section>

          {snapshot.teamPerformance.hasTeams ? (
            <section id="reports-teams">
              <ListPageTableSection
                className="office-list-card"
                actions={<Badge tone="neutral">{snapshot.teamPerformance.rows.length} visible team rows</Badge>}
                footer={<ListPageFooter summary={`${snapshot.teamPerformance.rows.length} team performance rows`} />}
                subtitle="Grouped by each owner's current active team memberships."
                title="Team performance"
              >
                {snapshot.teamPerformance.limitation ? (
                  <p className="office-report-section-note">{snapshot.teamPerformance.limitation}</p>
                ) : null}
                <DataTable className="office-table">
                  <DataTableHeader className="office-table-header office-table-row office-table-row-report-teams">
                    <span>Team</span>
                    <span>Agents</span>
                    <span>Deals</span>
                    <span>Closed</span>
                    <span>Volume</span>
                    <span>Actions</span>
                  </DataTableHeader>
                  <DataTableBody>
                    {snapshot.teamPerformance.rows.map((row) => (
                      <DataTableRow className="office-table-row office-table-row-report-teams" key={row.teamId}>
                        <div className="office-table-primary">
                          <strong>{row.teamName}</strong>
                          <p>{row.officeNetLabel} office net</p>
                        </div>
                        <span>{row.agentCount}</span>
                        <span>{row.transactionCount}</span>
                        <span>{row.closedTransactionCount}</span>
                        <span>{row.totalVolumeLabel}</span>
                        <div className="office-report-row-actions">
                          <Link
                            className="office-inline-action"
                            href={buildTransactionsHref(
                              {
                                startDate: snapshot.filters.startDate,
                                endDate: snapshot.filters.endDate,
                                ownerMembershipId: snapshot.filters.ownerMembershipId,
                                teamId: snapshot.filters.teamId,
                                transactionStatus: snapshot.filters.transactionStatus,
                                transactionType: snapshot.filters.transactionType
                              },
                              {
                                teamId: row.teamId,
                                ownerMembershipId: null
                              }
                            )}
                          >
                            Transactions
                          </Link>
                          <Link className="office-inline-action" href={`/office/agents?teamId=${row.teamId}`}>
                            Roster
                          </Link>
                        </div>
                      </DataTableRow>
                    ))}
                    {snapshot.teamPerformance.rows.length === 0 ? (
                      <EmptyState description="No team performance rows matched the current filters." title="No team rows" />
                    ) : null}
                  </DataTableBody>
                </DataTable>
              </ListPageTableSection>
            </section>
          ) : null}

          <section id="reports-commissions">
            <ListPageSection
              className="office-list-card"
              actions={
                <Link
                  className="office-button office-button-secondary"
                  href={buildCommissionHref(
                    {
                      startDate: snapshot.filters.startDate,
                      endDate: snapshot.filters.endDate,
                      ownerMembershipId: snapshot.filters.ownerMembershipId,
                      teamId: snapshot.filters.teamId,
                      transactionStatus: snapshot.filters.transactionStatus,
                      transactionType: snapshot.filters.transactionType,
                      commissionPlanId: snapshot.filters.commissionPlanId
                    },
                    {}
                  )}
                >
                  Open commissions
                </Link>
              }
              subtitle="Shows only real commission calculations. No statement or payout data is fabricated."
              title="Commission summary"
            >
              <ListPageStatsGrid className="office-report-stat-strip">
                <StatCard hint="Persisted commission rows in the current filter window." label="Calculation rows" value={snapshot.commissionSummary.calculationCount} />
                <StatCard hint="Rows ready for statement packaging." label="Statement ready" value={snapshot.commissionSummary.statementReadyLabel} />
                <StatCard hint="Rows already in payable status." label="Payable" value={snapshot.commissionSummary.payableLabel} />
                <StatCard hint="Rows already marked paid." label="Paid" value={snapshot.commissionSummary.paidLabel} />
              </ListPageStatsGrid>

              <div className="office-report-summary-grid">
                <ReportsSummaryTable>
                  <div className="office-table-header office-table-row office-table-row-report-commission-status">
                    <span>Status</span>
                    <span>Rows</span>
                    <span>Statement amount</span>
                  </div>
                  {snapshot.commissionSummary.byStatus.map((row) => (
                    <Link
                      className="office-table-row office-table-row-report-commission-status"
                      href={buildCommissionHref(
                        {
                          startDate: snapshot.filters.startDate,
                          endDate: snapshot.filters.endDate,
                          ownerMembershipId: snapshot.filters.ownerMembershipId,
                          teamId: snapshot.filters.teamId,
                          transactionStatus: snapshot.filters.transactionStatus,
                          transactionType: snapshot.filters.transactionType,
                          commissionPlanId: snapshot.filters.commissionPlanId
                        },
                        {
                          commissionStatus: row.status.toLowerCase().replaceAll(" ", "_")
                        }
                      )}
                      key={row.status}
                    >
                      <span>
                        <StatusBadge tone={getWorkflowTone(row.status)}>{row.status}</StatusBadge>
                      </span>
                      <span>{row.count}</span>
                      <span>{row.statementAmountLabel}</span>
                    </Link>
                  ))}
                </ReportsSummaryTable>

                <ReportsSummaryTable>
                  <div className="office-table-header office-table-row office-table-row-report-commission-plan">
                    <span>Plan</span>
                    <span>Rows</span>
                    <span>Statement amount</span>
                  </div>
                  {snapshot.commissionSummary.byPlan.map((row) => (
                    <Link
                      className="office-table-row office-table-row-report-commission-plan"
                      href={buildReportsHref(hrefBaseFilters, {
                        commissionPlanId: row.commissionPlanId
                      })}
                      key={row.commissionPlanId ?? row.planName}
                    >
                      <span>{row.planName}</span>
                      <span>{row.calculationCount}</span>
                      <span>{row.statementAmountLabel}</span>
                    </Link>
                  ))}
                </ReportsSummaryTable>
              </div>

              <ReportsTable>
                <div className="office-table-header office-table-row office-table-row-report-commission-recent">
                  <span>Calculation</span>
                  <span>Status</span>
                  <span>Statement</span>
                  <span>Calculated</span>
                  <span>Actions</span>
                </div>
                {snapshot.commissionSummary.recentCalculations.map((row) => (
                  <div className="office-table-row office-table-row-report-commission-recent" key={row.id}>
                    <div className="office-table-primary">
                      <strong>{row.transactionLabel}</strong>
                      <p>
                        {row.ownerName} · gross {row.grossCommissionLabel}
                      </p>
                    </div>
                    <span>
                      <StatusBadge tone={getWorkflowTone(row.status)}>{row.status}</StatusBadge>
                    </span>
                    <span>{row.statementAmountLabel}</span>
                    <span>{row.calculatedAtLabel}</span>
                    <div className="office-report-row-actions">
                      <Link className="office-inline-action" href={row.transactionHref}>
                        Transaction
                      </Link>
                      {row.accountingHref ? (
                        <Link className="office-inline-action" href={row.accountingHref}>
                          Accounting
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
                {snapshot.commissionSummary.recentCalculations.length === 0 ? (
                  <EmptyState description="No commission calculations matched the current filters." title="No commission rows" />
                ) : null}
              </ReportsTable>
              <ListPageFooter summary={`${snapshot.commissionSummary.recentCalculations.length} recent commission rows`} />
            </ListPageSection>
          </section>

          <section id="reports-accounting">
            <ListPageSection
              className="office-list-card"
              actions={
                <Link
                  className="office-button office-button-secondary"
                  href={buildAccountingHref(
                    {
                      startDate: snapshot.filters.startDate,
                      endDate: snapshot.filters.endDate,
                      ownerMembershipId: snapshot.filters.ownerMembershipId,
                      teamId: snapshot.filters.teamId,
                      transactionStatus: snapshot.filters.transactionStatus,
                      transactionType: snapshot.filters.transactionType,
                      commissionPlanId: snapshot.filters.commissionPlanId
                    },
                    {
                      anchor: "#accounting-ledger"
                    }
                  )}
                >
                  Open accounting
                </Link>
              }
              subtitle="Accounting and payment summary built from the current ledger-backed foundations."
              title="Accounting and payment summary"
            >
              <ListPageStatsGrid className="office-report-stat-strip">
                <StatCard hint="Ledger-backed accounting rows in scope." label="Accounting rows" value={snapshot.accountingSummary.transactionCount} />
                <StatCard hint="Invoices inside the current reporting slice." label="Invoices" value={snapshot.accountingSummary.totalInvoices} />
                <StatCard hint="Bills still open for payment." label="Open bills" value={snapshot.accountingSummary.openBills} />
                <StatCard hint={snapshot.accountingSummary.madePaymentsLabel} label="Received / made payments" value={snapshot.accountingSummary.receivedPaymentsLabel} />
              </ListPageStatsGrid>

              <div className="office-dashboard-grid-wide office-reports-subgrid">
                <ReportsTable>
                  <div className="office-table-header office-table-row office-table-row-report-accounting-types">
                    <span>Type</span>
                    <span>Rows</span>
                    <span>Total amount</span>
                  </div>
                  {snapshot.accountingSummary.byType.map((row) => (
                    <Link
                      className="office-table-row office-table-row-report-accounting-types"
                      href={buildAccountingHref(
                        {
                          startDate: snapshot.filters.startDate,
                          endDate: snapshot.filters.endDate,
                          ownerMembershipId: snapshot.filters.ownerMembershipId,
                          teamId: snapshot.filters.teamId,
                          transactionStatus: snapshot.filters.transactionStatus,
                          transactionType: snapshot.filters.transactionType,
                          commissionPlanId: snapshot.filters.commissionPlanId
                        },
                        {
                          type: row.type.toLowerCase().replaceAll(" ", "_"),
                          anchor: "#accounting-ledger"
                        }
                      )}
                      key={row.type}
                    >
                      <span>{row.type}</span>
                      <span>{row.count}</span>
                      <span>{row.totalAmountLabel}</span>
                    </Link>
                  ))}
                </ReportsTable>

                <ReportsSummaryTable>
                  <div className="office-table-header office-table-row office-table-row-report-accounting-recent">
                    <span>Date</span>
                    <span>Type</span>
                    <span>Status</span>
                    <span>Counterparty</span>
                    <span>Amount</span>
                  </div>
                  {snapshot.accountingSummary.recentTransactions.map((row) => (
                    <Link className="office-table-row office-table-row-report-accounting-recent" href={row.href} key={row.id}>
                      <span>{row.accountingDateLabel}</span>
                      <span>{row.type}</span>
                      <span>{row.status}</span>
                      <div className="office-table-primary">
                        <strong>{row.counterparty}</strong>
                        <p>
                          {row.ownerName} · {row.linkedTransactionLabel}
                        </p>
                      </div>
                      <span>{row.amountLabel}</span>
                    </Link>
                  ))}
                  {snapshot.accountingSummary.recentTransactions.length === 0 ? (
                    <EmptyState description="No accounting rows matched the current filters." title="No accounting rows" />
                  ) : null}
                </ReportsSummaryTable>
              </div>
              <ListPageFooter summary={`${snapshot.accountingSummary.recentTransactions.length} recent accounting rows`} />
            </ListPageSection>
          </section>

          <section id="reports-emd">
            <ListPageSection
              className="office-list-card"
              actions={
                <Link
                  className="office-button office-button-secondary"
                  href={buildAccountingHref(
                    {
                      startDate: snapshot.filters.startDate,
                      endDate: snapshot.filters.endDate,
                      ownerMembershipId: snapshot.filters.ownerMembershipId,
                      teamId: snapshot.filters.teamId,
                      transactionStatus: snapshot.filters.transactionStatus,
                      transactionType: snapshot.filters.transactionType,
                      commissionPlanId: snapshot.filters.commissionPlanId
                    },
                    {
                      anchor: "#earnest-money"
                    }
                  )}
                >
                  Open EMD ledger
                </Link>
              }
              subtitle="Only persisted earnest money records are included in this summary."
              title="Earnest money summary"
            >
              <ListPageStatsGrid className="office-report-stat-strip">
                <StatCard hint="Persisted earnest money records in scope." label="EMD records" value={snapshot.emdSummary.recordCount} />
                <StatCard hint="Records not yet fully resolved." label="Outstanding" value={snapshot.emdSummary.outstandingCount} />
                <StatCard hint="Records already past their due date." label="Overdue" value={snapshot.emdSummary.overdueCount} />
                <StatCard hint={snapshot.emdSummary.receivedAmountLabel} label="Expected / received" value={snapshot.emdSummary.expectedAmountLabel} />
              </ListPageStatsGrid>

              <div className="office-dashboard-grid-wide office-reports-subgrid">
                <ReportsTable>
                  <div className="office-table-header office-table-row office-table-row-report-emd-status">
                    <span>Status</span>
                    <span>Rows</span>
                    <span>Expected</span>
                    <span>Received</span>
                  </div>
                  {snapshot.emdSummary.byStatus.map((row) => (
                    <Link
                      className="office-table-row office-table-row-report-emd-status"
                      href={buildAccountingHref(
                        {
                          startDate: snapshot.filters.startDate,
                          endDate: snapshot.filters.endDate,
                          ownerMembershipId: snapshot.filters.ownerMembershipId,
                          teamId: snapshot.filters.teamId,
                          transactionStatus: snapshot.filters.transactionStatus,
                          transactionType: snapshot.filters.transactionType,
                          commissionPlanId: snapshot.filters.commissionPlanId
                        },
                        {
                          anchor: "#earnest-money"
                        }
                      )}
                      key={row.status}
                    >
                      <span>
                        <StatusBadge tone={getWorkflowTone(row.status)}>{row.status}</StatusBadge>
                      </span>
                      <span>{row.count}</span>
                      <span>{row.expectedAmountLabel}</span>
                      <span>{row.receivedAmountLabel}</span>
                    </Link>
                  ))}
                </ReportsTable>

                <ReportsSummaryTable>
                  <div className="office-table-header office-table-row office-table-row-report-emd-recent">
                    <span>Transaction</span>
                    <span>Status</span>
                    <span>Expected</span>
                    <span>Received</span>
                    <span>Due</span>
                  </div>
                  {snapshot.emdSummary.recentRecords.map((row) => (
                    <Link className="office-table-row office-table-row-report-emd-recent" href={row.transactionHref} key={row.id}>
                      <div className="office-table-primary">
                        <strong>{row.transactionLabel}</strong>
                        <p>{row.holdingLabel}</p>
                      </div>
                      <span>
                        <StatusBadge tone={getWorkflowTone(row.status)}>{row.status}</StatusBadge>
                      </span>
                      <span>{row.expectedAmount}</span>
                      <span>{row.receivedAmount}</span>
                      <span>{row.dueAtLabel}</span>
                    </Link>
                  ))}
                  {snapshot.emdSummary.recentRecords.length === 0 ? (
                    <EmptyState description="No earnest money records matched the current filters." title="No EMD rows" />
                  ) : null}
                </ReportsSummaryTable>
              </div>
              <ListPageFooter summary={`${snapshot.emdSummary.recentRecords.length} recent earnest money rows`} />
            </ListPageSection>
          </section>
        </ListPageStack>
      </ListPageSplit>
    </PageShell>
  );
}
