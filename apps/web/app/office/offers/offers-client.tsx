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
import { useI18n } from "../../../lib/i18n/client";

type OffersClientProps = {
  officeScopeLabel: string;
  snapshot: OfficeOffersQueueSnapshot;
};

const pageSizeOptions = [10, 20, 50, 100] as const;
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

function getOfferStatusLabel(
  status: OfficeOfferQueueRow["statusValue"],
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (status) {
    case "draft":
      return t((messages) => messages.officeOffers.draft);
    case "submitted":
      return t((messages) => messages.officeOffers.submitted);
    case "received":
      return t((messages) => messages.officeOffers.received);
    case "under_review":
      return t((messages) => messages.officeOffers.underReview);
    case "countered":
      return t((messages) => messages.officeOffers.countered);
    case "accepted":
      return t((messages) => messages.officeOffers.accepted);
    case "rejected":
      return t((messages) => messages.officeOffers.rejected);
    case "withdrawn":
      return t((messages) => messages.officeOffers.withdrawn);
    case "expired":
      return t((messages) => messages.officeSignatures.expired);
    default:
      return status;
  }
}

function getTransactionStatusLabel(
  status: string,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (status) {
    case "Opportunity":
      return t((messages) => messages.officeTransactions.opportunity);
    case "Active":
      return t((messages) => messages.officeTransactions.active);
    case "Pending":
      return t((messages) => messages.officeTransactions.pending);
    case "Closed":
      return t((messages) => messages.officeTransactions.closed);
    case "Cancelled":
      return t((messages) => messages.officeTransactions.cancelled);
    default:
      return status;
  }
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

function buildOfferContextLabel(
  row: OfficeOfferQueueRow,
  t: ReturnType<typeof useI18n>["t"]
) {
  if (row.isAcceptedOffer) {
    return t((messages) => messages.officeOffers.acceptedPath);
  }

  if (row.isPrimaryOffer) {
    return t((messages) => messages.officeOffers.primaryContender);
  }

  if (row.transactionAcceptedOfferId) {
    return t((messages) => messages.officeOffers.acceptedElsewhere);
  }

  if (row.transactionPrimaryOfferId) {
    return t((messages) => messages.officeOffers.primaryElsewhere);
  }

  return t((messages) => messages.officeOffers.openOffer);
}

function buildOfferContextMeta(
  row: OfficeOfferQueueRow,
  t: ReturnType<typeof useI18n>["t"],
  formatDateTime: ReturnType<typeof useI18n>["formatDateTime"]
) {
  if (row.isAcceptedOffer && row.acceptedAtLabel) {
    return t((messages) => messages.officeOffers.acceptedPrefix, {
      value: formatDateTime(row.acceptedAt) || row.acceptedAtLabel,
    });
  }

  if (row.transactionAcceptedOfferLabel && !row.isAcceptedOffer) {
    return t((messages) => messages.officeOffers.acceptedOfferPrefix, {
      value: row.transactionAcceptedOfferLabel,
    });
  }

  if (row.isPrimaryOffer) {
    return t((messages) => messages.officeOffers.primaryOnTransaction);
  }

  if (row.transactionPrimaryOfferLabel) {
    return t((messages) => messages.officeOffers.primaryOfferPrefix, {
      value: row.transactionPrimaryOfferLabel,
    });
  }

  return t((messages) => messages.officeOffers.noAcceptedOfferYet);
}

export function OffersClient({ officeScopeLabel, snapshot }: OffersClientProps) {
  const { t, formatDate, formatDateTime } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState(snapshot.filters.q);
  const [statusFilter, setStatusFilter] = useState<OfficeOffersQueueStatusFilter>(snapshot.filters.status);
  const [timingFilter, setTimingFilter] = useState<OfficeOffersQueueTimingFilter>(snapshot.filters.timing);
  const [contextFilter, setContextFilter] = useState<OfficeOffersQueueContextFilter>(snapshot.filters.context);

  const statusOptions: Array<{ value: OfficeOffersQueueStatusFilter; label: string }> = [
    { value: "all", label: t((messages) => messages.officeOffers.allStatuses) },
    { value: "draft", label: t((messages) => messages.officeOffers.draft) },
    { value: "submitted", label: t((messages) => messages.officeOffers.submitted) },
    { value: "received", label: t((messages) => messages.officeOffers.received) },
    { value: "under_review", label: t((messages) => messages.officeOffers.underReview) },
    { value: "countered", label: t((messages) => messages.officeOffers.countered) },
    { value: "accepted", label: t((messages) => messages.officeOffers.accepted) },
    { value: "rejected", label: t((messages) => messages.officeOffers.rejected) },
    { value: "withdrawn", label: t((messages) => messages.officeOffers.withdrawn) },
    { value: "expired", label: t((messages) => messages.officeSignatures.expired) }
  ];
  const timingOptions: Array<{ value: OfficeOffersQueueTimingFilter; label: string }> = [
    { value: "all", label: t((messages) => messages.officeOffers.allDeadlines) },
    { value: "expiring_soon", label: t((messages) => messages.officeOffers.expiringSoon72h) }
  ];
  const contextOptions: Array<{ value: OfficeOffersQueueContextFilter; label: string }> = [
    { value: "all", label: t((messages) => messages.officeOffers.allContext) },
    { value: "primary", label: t((messages) => messages.officeOffers.primaryOnly) },
    { value: "accepted", label: t((messages) => messages.officeOffers.acceptedOnly) }
  ];

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
      <FilterField className="office-transactions-search" label={t((messages) => messages.common.search)}>
        <TextInput
          aria-label={t((messages) => messages.officeOffers.searchAria)}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t((messages) => messages.officeOffers.searchPlaceholder)}
          value={searchQuery}
        />
      </FilterField>

      <FilterField label={t((messages) => messages.officeTransactions.tableStatus)}>
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

      <FilterField label={t((messages) => messages.officeOffers.expiration)}>
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

      <FilterField label={t((messages) => messages.officeOffers.context)}>
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
        <Button type="submit">{t((messages) => messages.common.applyFilters)}</Button>
        <Button onClick={handleResetFilters} type="button" variant="secondary">
          {t((messages) => messages.common.reset)}
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
      summary={t((messages) => messages.common.rangeSummary, {
        start: pageStart,
        end: pageEnd,
        total: snapshot.totalCount,
      })}
    />
  );

  return (
    <OfficeListPageTemplate
      className="office-transactions-page"
      description={t((messages) => messages.officeOffers.description)}
      eyebrow={t((messages) => messages.officeOffers.eyebrow)}
      filters={filters}
      footer={footer}
      sectionSubtitle={t((messages) => messages.officeOffers.sectionSubtitle)}
      sectionTitle={t((messages) => messages.officeOffers.sectionTitle)}
      summary={
        <>
          <SummaryChip label={t((messages) => messages.common.officeScope)} value={officeScopeLabel} />
          <SummaryChip label={t((messages) => messages.officeOffers.offersInView)} tone="accent" value={snapshot.summary.totalCount} />
          <SummaryChip label={t((messages) => messages.officeOffers.expiringSoon)} value={snapshot.summary.expiringSoonCount} />
          <SummaryChip label={t((messages) => messages.officeOffers.accepted)} value={snapshot.summary.acceptedCount} />
          <SummaryChip label={t((messages) => messages.officeOffers.primary)} value={snapshot.summary.primaryCount} />
        </>
      }
      title={t((messages) => messages.officeOffers.title)}
    >
      <DataTable className="office-list-table office-list-table-wide">
        <DataTableHeader className="office-list-table-header" style={tableGridStyle}>
          <span>{t((messages) => messages.officeOffers.transaction)}</span>
          <span>{t((messages) => messages.officeOffers.offer)}</span>
          <span>{t((messages) => messages.officeTransactions.tableStatus)}</span>
          <span>{t((messages) => messages.officeOffers.priceTerms)}</span>
          <span>{t((messages) => messages.officeOffers.expiration)}</span>
          <span>{t((messages) => messages.officeOffers.context)}</span>
        </DataTableHeader>
        <DataTableBody className="office-list-table-body">
          {snapshot.rows.map((row) => (
            <DataTableRow className="office-list-table-row" key={row.id} style={tableGridStyle}>
              <div className="office-list-table-main">
                <strong>
                  <Link href={row.transactionHref}>{row.transactionTitle}</Link>
                </strong>
                <p>{row.transactionAddress || t((messages) => messages.officeOffers.addressPending)}</p>
                <div className="office-list-table-main-meta">
                  {row.ownerName ? <span>{row.ownerName}</span> : <span>{t((messages) => messages.officeOffers.unassigned)}</span>}
                  <span>{getTransactionStatusLabel(row.transactionStatus, t)}</span>
                </div>
              </div>

              <div className="office-list-table-cell-stack">
                <strong>
                  <Link href={row.offerHref}>{row.title}</Link>
                </strong>
                <p>{row.buyerName || row.offeringPartyName}</p>
                <div className="office-list-table-main-meta">
                  {row.isPrimaryOffer ? <span>{t((messages) => messages.officeOffers.primary)}</span> : null}
                  {row.isAcceptedOffer ? <span>{t((messages) => messages.officeOffers.accepted)}</span> : null}
                  {!row.isAcceptedOffer && row.transactionAcceptedOfferId ? <span>{t((messages) => messages.officeOffers.competingPath)}</span> : null}
                </div>
              </div>

              <div className="office-list-table-cell-stack">
                <StatusBadge className="office-list-table-status" tone={getOfferTone(row.statusValue)}>
                  {getOfferStatusLabel(row.statusValue, t)}
                </StatusBadge>
                <p>{row.isExpiringSoon ? t((messages) => messages.officeOffers.expiringWithin72Hours) : t((messages) => messages.officeOffers.updatedPrefix, { value: formatDateTime(row.updatedAt) || row.updatedAtLabel })}</p>
              </div>

              <div className="office-list-table-cell-stack">
                <strong>{row.price || "—"}</strong>
                <p>{row.financingType || t((messages) => messages.officeOffers.financingNotRecorded)}</p>
                <p>
                  {t((messages) => messages.officeOffers.closePrefix, {
                    value: row.closingDateOffered ? formatDate(row.closingDateOffered) || row.closingDateOffered : "—",
                  })}
                  {row.earnestMoneyAmount ? ` · ${t((messages) => messages.officeOffers.emdPrefix, { value: row.earnestMoneyAmount })}` : ""}
                </p>
              </div>

              <div className="office-list-table-cell-stack">
                <strong>{row.expirationAt ? formatDate(row.expirationAt) || row.expirationAt : "—"}</strong>
                <p>{row.expirationLabel || t((messages) => messages.officeOffers.noExpirationRecorded)}</p>
                {row.acceptedAtLabel ? <p>{t((messages) => messages.officeOffers.acceptedPrefix, { value: formatDateTime(row.acceptedAt) || row.acceptedAtLabel })}</p> : null}
              </div>

              <div className="office-list-table-cell-stack">
                <strong>{buildOfferContextLabel(row, t)}</strong>
                <p>{buildOfferContextMeta(row, t, formatDateTime)}</p>
                <p>
                  <Link href={row.transactionHref}>{t((messages) => messages.officeSignatures.openTransaction)}</Link>
                </p>
              </div>
            </DataTableRow>
          ))}

          {snapshot.rows.length === 0 ? (
            <EmptyState
              description={t((messages) => messages.officeOffers.noOffersMatchedBody)}
              title={t((messages) => messages.officeOffers.noOffersMatchedTitle)}
            />
          ) : null}
        </DataTableBody>
      </DataTable>
    </OfficeListPageTemplate>
  );
}
