"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
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
  TextInput
} from "@acre/ui";
import type {
  OfficeOfferQueueRow,
  OfficeOffersQueueContextFilter,
  OfficeOffersQueueSnapshot,
  OfficeOffersQueueStatusFilter,
  OfficeOffersQueueTimingFilter
} from "@acre/db";
import {
  OfficeListPagePagination,
  OfficeListPageTemplate
} from "../_components/office-list-page-template";

type OffersClientProps = {
  officeScopeLabel: string;
  snapshot: OfficeOffersQueueSnapshot;
};

const pageSizeOptions = [10, 20, 50, 100] as const;
const statusOptions: Array<{ value: OfficeOffersQueueStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "received", label: "Received" },
  { value: "under_review", label: "Under review" },
  { value: "countered", label: "Countered" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" }
];
const timingOptions: Array<{ value: OfficeOffersQueueTimingFilter; label: string }> = [
  { value: "all", label: "All deadlines" },
  { value: "expiring_soon", label: "Expiring soon (72h)" }
];
const contextOptions: Array<{ value: OfficeOffersQueueContextFilter; label: string }> = [
  { value: "all", label: "All context" },
  { value: "primary", label: "Primary only" },
  { value: "accepted", label: "Accepted only" }
];
const tableGridStyle: CSSProperties = {
  gridTemplateColumns:
    "minmax(240px, 2.1fr) minmax(220px, 1.8fr) minmax(150px, 1.1fr) minmax(180px, 1.3fr) minmax(160px, 1.1fr) minmax(220px, 1.8fr)"
};

function getOfferTone(status: OfficeOfferQueueRow["statusValue"]) {
  if (status === "accepted") {
    return "success" as const;
  }

  if (status === "rejected" || status === "withdrawn" || status === "expired") {
    return "danger" as const;
  }

  if (status === "countered" || status === "under_review") {
    return "accent" as const;
  }

  if (status === "received") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function buildOffersHref(
  pathname: string,
  params: {
    q: string;
    status: OfficeOffersQueueStatusFilter;
    timing: OfficeOffersQueueTimingFilter;
    context: OfficeOffersQueueContextFilter;
    page: number;
    pageSize: number;
  }
) {
  const searchParams = new URLSearchParams();

  if (params.q.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params.timing !== "all") {
    searchParams.set("timing", params.timing);
  }

  if (params.context !== "all") {
    searchParams.set("context", params.context);
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

function buildOfferContextLabel(row: OfficeOfferQueueRow) {
  if (row.isAcceptedOffer) {
    return "Accepted path";
  }

  if (row.isPrimaryOffer) {
    return "Primary contender";
  }

  if (row.transactionAcceptedOfferId) {
    return "Accepted elsewhere";
  }

  if (row.transactionPrimaryOfferId) {
    return "Primary elsewhere";
  }

  return "Open offer";
}

function buildOfferContextMeta(row: OfficeOfferQueueRow) {
  if (row.isAcceptedOffer && row.acceptedAtLabel) {
    return `Accepted ${row.acceptedAtLabel}`;
  }

  if (row.transactionAcceptedOfferLabel && !row.isAcceptedOffer) {
    return `Accepted offer: ${row.transactionAcceptedOfferLabel}`;
  }

  if (row.isPrimaryOffer) {
    return "Primary on this transaction";
  }

  if (row.transactionPrimaryOfferLabel) {
    return `Primary offer: ${row.transactionPrimaryOfferLabel}`;
  }

  return "No accepted offer on this transaction yet";
}

export function OffersClient({ officeScopeLabel, snapshot }: OffersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState(snapshot.filters.q);
  const [statusFilter, setStatusFilter] = useState<OfficeOffersQueueStatusFilter>(snapshot.filters.status);
  const [timingFilter, setTimingFilter] = useState<OfficeOffersQueueTimingFilter>(snapshot.filters.timing);
  const [contextFilter, setContextFilter] = useState<OfficeOffersQueueContextFilter>(snapshot.filters.context);

  useEffect(() => {
    setSearchQuery(snapshot.filters.q);
    setStatusFilter(snapshot.filters.status);
    setTimingFilter(snapshot.filters.timing);
    setContextFilter(snapshot.filters.context);
  }, [snapshot.filters]);

  const pageStart = snapshot.totalCount === 0 ? 0 : (snapshot.page - 1) * snapshot.pageSize + 1;
  const pageEnd =
    snapshot.totalCount === 0 ? 0 : Math.min(snapshot.page * snapshot.pageSize, snapshot.totalCount);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildOffersHref(pathname, {
        q: searchQuery,
        status: statusFilter,
        timing: timingFilter,
        context: contextFilter,
        page: 1,
        pageSize: snapshot.pageSize
      })
    );
  }

  function handleResetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setTimingFilter("all");
    setContextFilter("all");
    router.push(
      buildOffersHref(pathname, {
        q: "",
        status: "all",
        timing: "all",
        context: "all",
        page: 1,
        pageSize: snapshot.pageSize
      })
    );
  }

  function handlePageSizeChange(nextPageSize: number) {
    router.push(
      buildOffersHref(pathname, {
        q: snapshot.filters.q,
        status: snapshot.filters.status,
        timing: snapshot.filters.timing,
        context: snapshot.filters.context,
        page: 1,
        pageSize: nextPageSize
      })
    );
  }

  const filters = (
    <ListPageFilters as="form" className="office-transactions-toolbar" onSubmit={handleFilterSubmit}>
      <FilterField className="office-transactions-search" label="Search">
        <TextInput
          aria-label="Search offers"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search offer, party, transaction, address..."
          value={searchQuery}
        />
      </FilterField>

      <FilterField label="Status">
        <SelectInput
          onChange={(event) => setStatusFilter(event.target.value as OfficeOffersQueueStatusFilter)}
          value={statusFilter}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Deadline">
        <SelectInput
          onChange={(event) => setTimingFilter(event.target.value as OfficeOffersQueueTimingFilter)}
          value={timingFilter}
        >
          {timingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Context">
        <SelectInput
          onChange={(event) => setContextFilter(event.target.value as OfficeOffersQueueContextFilter)}
          value={contextFilter}
        >
          {contextOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <div className="office-filter-actions">
        <Button type="submit">Apply filters</Button>
        <Button onClick={handleResetFilters} type="button" variant="secondary">
          Reset
        </Button>
      </div>
    </ListPageFilters>
  );

  const footer = (
    <ListPageFooter
      controls={
        <OfficeListPagePagination
          nextHref={
            snapshot.page < snapshot.totalPages
              ? buildOffersHref(pathname, {
                  q: snapshot.filters.q,
                  status: snapshot.filters.status,
                  timing: snapshot.filters.timing,
                  context: snapshot.filters.context,
                  page: snapshot.page + 1,
                  pageSize: snapshot.pageSize
                })
              : undefined
          }
          onPageSizeChange={handlePageSizeChange}
          page={snapshot.page}
          pageSize={snapshot.pageSize}
          pageSizeOptions={pageSizeOptions}
          previousHref={
            snapshot.page > 1
              ? buildOffersHref(pathname, {
                  q: snapshot.filters.q,
                  status: snapshot.filters.status,
                  timing: snapshot.filters.timing,
                  context: snapshot.filters.context,
                  page: snapshot.page - 1,
                  pageSize: snapshot.pageSize
                })
              : undefined
          }
          totalPages={snapshot.totalPages}
        />
      }
      summary={`${pageStart}-${pageEnd} of ${snapshot.totalCount}`}
    />
  );

  return (
    <OfficeListPageTemplate
      className="office-transactions-page"
      description="Office-wide offer queue anchored inside transaction management so you can scan real status, expiring-soon pressure, and accepted-path context without leaving the transaction system."
      eyebrow="Offers"
      filters={filters}
      footer={footer}
      sectionSubtitle="Review the current office offer set, then jump straight back into the source transaction workspace for the full workflow."
      sectionTitle="Offer queue"
      summary={
        <>
          <SummaryChip label="Office scope" value={officeScopeLabel} />
          <SummaryChip label="Offers in view" tone="accent" value={snapshot.summary.totalCount} />
          <SummaryChip label="Expiring soon" value={snapshot.summary.expiringSoonCount} />
          <SummaryChip label="Accepted" value={snapshot.summary.acceptedCount} />
          <SummaryChip label="Primary" value={snapshot.summary.primaryCount} />
        </>
      }
      title="Offers"
    >
      <DataTable className="office-list-table office-list-table-wide">
        <DataTableHeader className="office-list-table-header" style={tableGridStyle}>
          <span>Transaction</span>
          <span>Offer</span>
          <span>Status</span>
          <span>Price / terms</span>
          <span>Expiration</span>
          <span>Context</span>
        </DataTableHeader>
        <DataTableBody className="office-list-table-body">
          {snapshot.rows.map((row) => (
            <DataTableRow className="office-list-table-row" key={row.id} style={tableGridStyle}>
              <div className="office-list-table-main">
                <strong>
                  <Link href={row.transactionHref}>{row.transactionTitle}</Link>
                </strong>
                <p>{row.transactionAddress || "Address pending"}</p>
                <div className="office-list-table-main-meta">
                  {row.ownerName ? <span>{row.ownerName}</span> : <span>Unassigned</span>}
                  <span>{row.transactionStatus}</span>
                </div>
              </div>

              <div className="office-list-table-cell-stack">
                <strong>
                  <Link href={row.offerHref}>{row.title}</Link>
                </strong>
                <p>{row.buyerName || row.offeringPartyName}</p>
                <div className="office-list-table-main-meta">
                  {row.isPrimaryOffer ? <span>Primary</span> : null}
                  {row.isAcceptedOffer ? <span>Accepted</span> : null}
                  {!row.isAcceptedOffer && row.transactionAcceptedOfferId ? <span>Competing path</span> : null}
                </div>
              </div>

              <div className="office-list-table-cell-stack">
                <StatusBadge className="office-list-table-status" tone={getOfferTone(row.statusValue)}>
                  {row.status}
                </StatusBadge>
                <p>{row.isExpiringSoon ? "Expiring within 72 hours" : `Updated ${row.updatedAtLabel}`}</p>
              </div>

              <div className="office-list-table-cell-stack">
                <strong>{row.price || "—"}</strong>
                <p>{row.financingType || "Financing not recorded"}</p>
                <p>
                  Close {row.closingDateOffered || "—"}
                  {row.earnestMoneyAmount ? ` · EMD ${row.earnestMoneyAmount}` : ""}
                </p>
              </div>

              <div className="office-list-table-cell-stack">
                <strong>{row.expirationAt || "—"}</strong>
                <p>{row.expirationLabel || "No expiration recorded"}</p>
                {row.acceptedAtLabel ? <p>Accepted {row.acceptedAtLabel}</p> : null}
              </div>

              <div className="office-list-table-cell-stack">
                <strong>{buildOfferContextLabel(row)}</strong>
                <p>{buildOfferContextMeta(row)}</p>
                <p>
                  <Link href={row.transactionHref}>Open transaction</Link>
                </p>
              </div>
            </DataTableRow>
          ))}

          {snapshot.rows.length === 0 ? (
            <EmptyState
              description="Try widening the search or clearing one of the queue filters."
              title="No offers matched the current filters"
            />
          ) : null}
        </DataTableBody>
      </DataTable>
    </OfficeListPageTemplate>
  );
}
