"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  ListPageFilters,
  ListPageFooter,
  SelectInput,
  StatusBadge,
  SummaryChip,
  TextInput,
} from "@acre/ui";
import type {
  OfficeTransactionFilterOptions,
  OfficeTransactionIntakeSchema,
  OfficeTransactionOwnerAssignment,
  OfficeTransactionRecord,
  OfficeTransactionStatus,
  OfficeTransactionSummary,
} from "@acre/db";
import {
  OfficeListPagePagination,
  OfficeListPageTemplate,
} from "../_components/office-list-page-template";
import { TransactionIntakeWorkspace } from "./transaction-intake-form";

type TransactionsClientProps = {
  transactions: OfficeTransactionRecord[];
  summary: OfficeTransactionSummary;
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  filterOptions: OfficeTransactionFilterOptions;
  transactionIntakeSchema: OfficeTransactionIntakeSchema;
  transactionOwnerAssignment: OfficeTransactionOwnerAssignment;
  filters: {
    q: string;
    status: OfficeTransactionStatus | "All";
    ownerMembershipId: string;
    teamId: string;
    type: string;
    startDate: string;
    endDate: string;
  };
};

const listStatusOptions = [
  "All",
  "Opportunity",
  "Active",
  "Pending",
  "Closed",
  "Cancelled",
] as const;
const transactionTypeFilterOptions = [
  { value: "", label: "All types" },
  { value: "sales", label: "Sales" },
  { value: "sales_listing", label: "Sales (listing)" },
  { value: "rental_leasing", label: "Rental/Leasing" },
  { value: "rental_listing", label: "Rental (listing)" },
  { value: "commercial_sales", label: "Commercial Sales" },
  { value: "commercial_lease", label: "Commercial Lease" },
  { value: "other", label: "Other" },
] as const;
const pageSizeOptions = [10, 20, 50, 100] as const;

function getTransactionStatusTone(status: OfficeTransactionStatus) {
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


function normalizeStatusFilter(
  value: string,
): (typeof listStatusOptions)[number] {
  return listStatusOptions.includes(value as (typeof listStatusOptions)[number])
    ? (value as (typeof listStatusOptions)[number])
    : "All";
}

function buildTransactionsHref(
  pathname: string,
  params: {
    q: string;
    status: string;
    ownerMembershipId: string;
    teamId: string;
    type: string;
    startDate: string;
    endDate: string;
    page: number;
    pageSize: number;
  },
) {
  const searchParams = new URLSearchParams();

  if (params.q.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.status && params.status !== "All") {
    searchParams.set("status", params.status);
  }

  if (params.ownerMembershipId.trim()) {
    searchParams.set("ownerMembershipId", params.ownerMembershipId.trim());
  }

  if (params.teamId.trim()) {
    searchParams.set("teamId", params.teamId.trim());
  }

  if (params.type.trim()) {
    searchParams.set("type", params.type.trim());
  }

  if (params.startDate.trim()) {
    searchParams.set("startDate", params.startDate.trim());
  }

  if (params.endDate.trim()) {
    searchParams.set("endDate", params.endDate.trim());
  }

  if (params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  if (params.pageSize !== 20) {
    searchParams.set("pageSize", String(params.pageSize));
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function TransactionsClient({
  transactions,
  summary,
  totalCount,
  totalPages,
  page,
  pageSize,
  filterOptions,
  transactionIntakeSchema,
  transactionOwnerAssignment,
  filters,
}: TransactionsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    (typeof listStatusOptions)[number]
  >(normalizeStatusFilter(filters.status));
  const [searchQuery, setSearchQuery] = useState(filters.q);
  const [ownerMembershipId, setOwnerMembershipId] = useState(
    filters.ownerMembershipId,
  );
  const [teamId, setTeamId] = useState(filters.teamId);
  const [typeFilter, setTypeFilter] = useState(filters.type);
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  useEffect(() => {
    setSearchQuery(filters.q);
  }, [filters.q]);

  useEffect(() => {
    setStatusFilter(normalizeStatusFilter(filters.status));
  }, [filters.status]);

  useEffect(() => {
    setOwnerMembershipId(filters.ownerMembershipId);
  }, [filters.ownerMembershipId]);

  useEffect(() => {
    setTeamId(filters.teamId);
  }, [filters.teamId]);

  useEffect(() => {
    setTypeFilter(filters.type);
  }, [filters.type]);

  useEffect(() => {
    setStartDate(filters.startDate);
  }, [filters.startDate]);

  useEffect(() => {
    setEndDate(filters.endDate);
  }, [filters.endDate]);

  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  function navigateWithAppliedFilters(
    overrides: Partial<TransactionsClientProps["filters"]> & {
      page?: number;
      pageSize?: number;
    },
  ) {
    router.push(
      buildTransactionsHref(pathname, {
        q: overrides.q ?? filters.q,
        status: overrides.status ?? filters.status,
        ownerMembershipId:
          overrides.ownerMembershipId ?? filters.ownerMembershipId,
        teamId: overrides.teamId ?? filters.teamId,
        type: overrides.type ?? filters.type,
        startDate: overrides.startDate ?? filters.startDate,
        endDate: overrides.endDate ?? filters.endDate,
        page: overrides.page ?? page,
        pageSize: overrides.pageSize ?? pageSize,
      }),
    );
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    router.push(
      buildTransactionsHref(pathname, {
        q: searchQuery,
        status: statusFilter,
        ownerMembershipId,
        teamId,
        type: typeFilter,
        startDate,
        endDate,
        page: 1,
        pageSize,
      }),
    );
  }

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("All");
    setOwnerMembershipId("");
    setTeamId("");
    setTypeFilter("");
    setStartDate("");
    setEndDate("");
    router.push(pathname);
  }

  function handlePageSizeChange(nextPageSize: number) {
    navigateWithAppliedFilters({
      page: 1,
      pageSize: nextPageSize,
    });
  }

  const transactionFilters = (
    <ListPageFilters
      as="form"
      className="bm-transactions-toolbar"
      onSubmit={handleApplyFilters}
    >
      <FilterField className="bm-transactions-search" label="Search">
        <TextInput
          aria-label="Search transactions"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search address, contact, mls # ..."
          value={searchQuery}
        />
      </FilterField>

      <FilterField label="Current view">
        <SelectInput
          aria-label="Filter transactions by status"
          onChange={(event) =>
            setStatusFilter(
              event.target.value as (typeof listStatusOptions)[number],
            )
          }
          value={statusFilter}
        >
          {listStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Owner / agent">
        <SelectInput
          onChange={(event) => setOwnerMembershipId(event.target.value)}
          value={ownerMembershipId}
        >
          <option value="">All owners</option>
          {filterOptions.ownerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Team">
        <SelectInput
          onChange={(event) => setTeamId(event.target.value)}
          value={teamId}
        >
          <option value="">All teams</option>
          {filterOptions.teamOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Type">
        <SelectInput
          onChange={(event) => setTypeFilter(event.target.value)}
          value={typeFilter}
        >
          {transactionTypeFilterOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Start date">
        <TextInput
          onChange={(event) => setStartDate(event.target.value)}
          type="date"
          value={startDate}
        />
      </FilterField>

      <FilterField label="End date">
        <TextInput
          onChange={(event) => setEndDate(event.target.value)}
          type="date"
          value={endDate}
        />
      </FilterField>

      <div className="office-filter-actions">
        <Button type="submit">Apply filters</Button>
        <Button onClick={resetFilters} type="button" variant="secondary">
          Reset
        </Button>
      </div>
    </ListPageFilters>
  );

  const transactionFooter = (
    <ListPageFooter
      controls={
        <OfficeListPagePagination
          nextHref={
            page < totalPages
              ? buildTransactionsHref(pathname, {
                  q: filters.q,
                  status: filters.status,
                  ownerMembershipId: filters.ownerMembershipId,
                  teamId: filters.teamId,
                  type: filters.type,
                  startDate: filters.startDate,
                  endDate: filters.endDate,
                  page: page + 1,
                  pageSize,
                })
              : undefined
          }
          onPageSizeChange={handlePageSizeChange}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          previousHref={
            page > 1
              ? buildTransactionsHref(pathname, {
                  q: filters.q,
                  status: filters.status,
                  ownerMembershipId: filters.ownerMembershipId,
                  teamId: filters.teamId,
                  type: filters.type,
                  startDate: filters.startDate,
                  endDate: filters.endDate,
                  page: page - 1,
                  pageSize,
                })
              : undefined
          }
          totalPages={totalPages}
        />
      }
      summary={`${pageStart}-${pageEnd} of ${totalCount}`}
    />
  );

  const transactionSummary = (
    <>
      <SummaryChip label="Transactions" value={summary.totalCount} />
      <SummaryChip
        label="My net income"
        tone="accent"
        value={summary.totalNetIncome}
      />
      <Button
        className="office-list-page-primary-action bm-transactions-create"
        onClick={() => setIsModalOpen(true)}
        type="button"
      >
        Create transaction
      </Button>
    </>
  );

  return (
    <>
      <OfficeListPageTemplate
        className="bm-transactions-page"
        description="Operational transaction list with query-param filters for status, owner, team, type, and date-window drill-down."
        eyebrow="Transactions"
        filters={transactionFilters}
        footer={transactionFooter}
        sectionSubtitle="Search, filter, and review the current office transaction set."
        sectionTitle="Transaction list"
        summary={transactionSummary}
        summaryClassName="office-transactions-page-actions"
        title="Transactions"
      >
        <DataTable className="office-list-table bm-transactions-list-shell">
          <DataTableHeader className="office-list-table-header office-list-table-header-transactions">
            <span />
            <span>Transaction</span>
            <span>Price</span>
            <span>Owner</span>
            <span>Representing</span>
            <span>Status</span>
            <span>Important date</span>
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {transactions.map((transaction) => (
              <DataTableRow
                className="office-list-table-row office-list-table-row-transactions"
                key={transaction.id}
              >
                <span
                  className={`bm-transaction-home-icon${transaction.isFlagged ? " is-flagged" : ""}`}
                >
                  <svg
                    aria-hidden="true"
                    className="bm-transaction-home-icon-svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
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
                <div className="office-list-table-main">
                  <strong className={transaction.isFlagged ? "is-flagged" : ""}>
                    <Link href={`/office/transactions/${transaction.id}`}>
                      {transaction.address}
                    </Link>
                  </strong>
                </div>
                <span>{transaction.price}</span>
                <span>{transaction.owner}</span>
                <span>{transaction.representing}</span>
                <StatusBadge
                  className="office-list-table-status bm-transaction-status-badge"
                  tone={getTransactionStatusTone(transaction.status)}
                >
                  {transaction.status}
                </StatusBadge>
                <span>{transaction.importantDate || "—"}</span>
              </DataTableRow>
            ))}

            {transactions.length === 0 ? (
              <EmptyState
                description="Try widening the search or switching the current view."
                title="No transactions matched the current filters"
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </OfficeListPageTemplate>

      {isModalOpen ? (
        <div className="bm-modal-overlay">
          <section
            className="bm-transaction-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <TransactionIntakeWorkspace
              afterSubmit="refresh"
              canEditValues={true}
              chrome="modal"
              key={formVersion}
              mode="create"
              onClose={() => setIsModalOpen(false)}
              onSubmitted={() => {
                setIsModalOpen(false);
                setFormVersion((current) => current + 1);
                router.push(
                  buildTransactionsHref(pathname, {
                    q: searchQuery,
                    status: statusFilter,
                    ownerMembershipId,
                    teamId,
                    type: typeFilter,
                    startDate,
                    endDate,
                    page: 1,
                    pageSize,
                  }),
                );
              }}
              ownerAssignment={transactionOwnerAssignment}
              schema={transactionIntakeSchema}
              stepLabel="step 1 of 4"
              submitEndpoint="/api/office/transactions"
              submitLabel="Next →"
              submitMethod="POST"
              title="NEW TRANSACTION"
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
