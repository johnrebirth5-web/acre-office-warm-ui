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
  OfficeTransactionRecord,
  OfficeTransactionStatus,
  OfficeTransactionSummary,
} from "@acre/db";
import {
  OfficeListPagePagination,
  OfficeListPageTemplate,
} from "../_components/office-list-page-template";

type TransactionsClientProps = {
  transactions: OfficeTransactionRecord[];
  summary: OfficeTransactionSummary;
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  filterOptions: OfficeTransactionFilterOptions;
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

type InlineSelectProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
};

type ModalField = {
  label: string;
  name: string;
  type?: "text" | "date" | "email";
  className?: string;
};

type AdditionalField = {
  label: string;
  name: string;
  type: "input" | "select";
  inputType?: "text" | "email";
  options?: string[];
};

const topTypeOptions = [
  "Sales",
  "Sales (listing)",
  "Rental/Leasing",
  "Rental (listing)",
  "Commercial Sales",
  "Other",
  "Commercial Lease",
];
const topStatusOptions = [
  "Opportunity",
  "Active",
  "Pending",
  "Closed",
  "Cancelled",
];
const topRepresentingOptions = ["Buyer", "Seller", "Both"];
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

const primaryFields: ModalField[] = [
  { label: "Address", name: "address" },
  { label: "City", name: "city" },
  { label: "State", name: "state", className: "is-compact" },
  { label: "Zip", name: "zipCode", className: "is-compact" },
  {
    label: "Transaction name",
    name: "transactionName",
    className: "is-span-4",
  },
  { label: "Price", name: "price" },
  { label: "Buyer agreement date", name: "buyerAgreementDate", type: "date" },
  { label: "Buyer expiration date", name: "buyerExpirationDate", type: "date" },
  { label: "Acceptance date", name: "acceptanceDate", type: "date" },
  { label: "Listing date", name: "listingDate", type: "date" },
  {
    label: "Listing expiration date",
    name: "listingExpirationDate",
    type: "date",
  },
  { label: "Closing date", name: "closingDate", type: "date" },
];

const additionalFields: AdditionalField[] = [
  { label: "Agent Name", name: "agentName", type: "input" },
  {
    label: "Team Leader",
    name: "teamLeader",
    type: "select",
    options: ["Simon Park", "Naomi Chen", "Alice Tang"],
  },
  { label: "Licensed Agent Name", name: "licensedAgentName", type: "input" },
  { label: "Invoice Number", name: "invoiceNumber", type: "input" },
  { label: "Buyer/Tenant", name: "buyerTenant", type: "input" },
  { label: "Building Name", name: "buildingName", type: "input" },
  { label: "Address", name: "additionalAddress", type: "input" },
  {
    label: `Unit # (If it's a house, fill out "house")`,
    name: "unitNumber",
    type: "input",
  },
  { label: "Layout", name: "layout", type: "input" },
  { label: "City", name: "additionalCity", type: "input" },
  { label: "State", name: "additionalState", type: "input" },
  { label: "Zip Code", name: "additionalZipCode", type: "input" },
  {
    label: "Move-In Date/Closing Date",
    name: "moveInDateClosingDate",
    type: "input",
  },
  {
    label: "Commission Type",
    name: "commissionType",
    type: "select",
    options: ["Gross", "Net", "Custom"],
  },
  { label: "Leasing Contact", name: "leasingContact", type: "input" },
  { label: "Invoice Bill To", name: "invoiceBillTo", type: "input" },
  {
    label: "Currency Type",
    name: "currencyType",
    type: "select",
    options: ["USD", "CNY"],
  },
  { label: "Commission($)", name: "commissionAmount", type: "input" },
  { label: "Your Commission Rate", name: "yourCommissionRate", type: "input" },
  { label: "Rebate", name: "rebate", type: "input" },
  { label: "Reimbursement", name: "reimbursement", type: "input" },
  { label: "Co-Agent Legal Name", name: "coAgentLegalName", type: "input" },
  { label: "Commission Breakdown", name: "commissionBreakdown", type: "input" },
  {
    label: "Company Referral",
    name: "companyReferral",
    type: "select",
    options: ["Yes", "No"],
  },
  {
    label: "Outside Referral",
    name: "outsideReferral",
    type: "select",
    options: ["Yes", "No"],
  },
  { label: "Referral Fee", name: "referralFee", type: "input" },
  { label: "External Partners", name: "externalPartners", type: "input" },
  {
    label: "Company Referral Employee's Name",
    name: "companyReferralEmployeeName",
    type: "input",
  },
  {
    label: "Client's Email",
    name: "clientEmail",
    type: "input",
    inputType: "email",
  },
  {
    label: "Upload Invoice to VendorCafe",
    name: "uploadInvoiceToVendorCafe",
    type: "select",
    options: ["Yes", "No"],
  },
  { label: "Note(Rebate, Referral, Others)", name: "note", type: "input" },
  {
    label: "Status of Commission Received(For Admin)",
    name: "commissionReceivedStatus",
    type: "select",
    options: ["No", "Yes", "Partial"],
  },
  {
    label:
      "Commission Confirmation(For Agent, we'll process the payment once you select yes)",
    name: "commissionConfirmation",
    type: "select",
    options: ["Yes", "No"],
  },
];

function InlineSelect({
  label,
  name,
  value,
  onChange,
  options,
}: InlineSelectProps) {
  return (
    <label className="bm-modal-inline-select">
      <span>{label}:</span>
      <select
        className={value ? "" : "is-empty"}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
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
  filters,
}: TransactionsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("");
  const [representing, setRepresenting] = useState("");
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
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

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/office/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to create transaction.");
      }

      setIsModalOpen(false);
      setFormVersion((current) => current + 1);
      setTransactionType("");
      setTransactionStatus("");
      setRepresenting("");
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
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to create transaction.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
                  ⌂
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
        <div className="bm-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <section
            className="bm-transaction-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="bm-transaction-modal-header">
              <h3>NEW TRANSACTION</h3>
              <button
                aria-label="Close create transaction modal"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>

            <form
              className="bm-transaction-modal-body"
              key={formVersion}
              onSubmit={handleCreateTransaction}
            >
              <div className="bm-transaction-modal-top-selects">
                <InlineSelect
                  label="Type"
                  name="transactionType"
                  onChange={setTransactionType}
                  options={topTypeOptions}
                  value={transactionType}
                />
                <InlineSelect
                  label="Status"
                  name="transactionStatus"
                  onChange={setTransactionStatus}
                  options={topStatusOptions}
                  value={transactionStatus}
                />
                <InlineSelect
                  label="Representing"
                  name="representing"
                  onChange={setRepresenting}
                  options={topRepresentingOptions}
                  value={representing}
                />
              </div>

              <div className="bm-transaction-modal-grid bm-transaction-modal-grid-primary">
                {primaryFields.map((field) => (
                  <label
                    className={`bm-transaction-modal-field ${field.className ?? ""}`.trim()}
                    key={field.name}
                  >
                    <span>{field.label}</span>
                    <input name={field.name} type={field.type ?? "text"} />
                  </label>
                ))}
              </div>

              <section className="bm-transaction-modal-additional">
                <header className="bm-transaction-modal-section-header">
                  <button type="button">Additional fields</button>
                  <span>configure</span>
                </header>

                <div className="bm-transaction-modal-grid bm-transaction-modal-grid-additional">
                  {additionalFields.map((field) => (
                    <label
                      className="bm-transaction-modal-field"
                      key={field.name}
                    >
                      <span>{field.label}</span>
                      {field.type === "select" ? (
                        <select defaultValue="" name={field.name}>
                          <option value="">Select...</option>
                          {field.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          name={field.name}
                          type={field.inputType ?? "text"}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </section>

              <footer className="bm-transaction-modal-footer">
                <span>step 1 of 4</span>
                <div className="bm-transaction-modal-actions">
                  {submitError ? (
                    <p className="bm-transaction-submit-error">{submitError}</p>
                  ) : null}
                  <button
                    className="bm-transaction-next"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? "Saving..." : "Next →"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
