"use client";

import { usePathname, useRouter } from "next/navigation";
import { ListPageFooter } from "@acre/ui";
import type {
  OfficeTransactionReportSearchFieldKey,
  OfficeTransactionReportsFilters
} from "@acre/db";
import { OfficeListPagePagination } from "../_components/office-list-page-template";
import {
  buildReportsHref,
  cloneReportSearchFilterState,
  defaultReportsPage
} from "./reports-search-layout";

type ReportsTableFooterProps = {
  filters: OfficeTransactionReportsFilters;
  page: number;
  pageSize: number;
  selectedFieldKeys: OfficeTransactionReportSearchFieldKey[];
  sortSummary: string;
  totalCount: number;
  totalPages: number;
};

const pageSizeOptions = [10, 20, 50, 100] as const;

export function ReportsTableFooter(props: ReportsTableFooterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const filterState = cloneReportSearchFilterState(props.filters);
  const pageStart = props.totalCount === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const pageEnd = props.totalCount === 0 ? 0 : Math.min(props.page * props.pageSize, props.totalCount);

  const previousHref =
    props.page > 1
      ? buildReportsHref(pathname, {
          selectedFieldKeys: props.selectedFieldKeys,
          filters: filterState,
          page: props.page - 1,
          pageSize: props.pageSize
        })
      : undefined;
  const nextHref =
    props.page < props.totalPages
      ? buildReportsHref(pathname, {
          selectedFieldKeys: props.selectedFieldKeys,
          filters: filterState,
          page: props.page + 1,
          pageSize: props.pageSize
        })
      : undefined;

  return (
    <ListPageFooter
      controls={
        <OfficeListPagePagination
          nextHref={nextHref}
          onPageSizeChange={(nextPageSize) => {
            router.push(
              buildReportsHref(pathname, {
                selectedFieldKeys: props.selectedFieldKeys,
                filters: filterState,
                page: defaultReportsPage,
                pageSize: nextPageSize
              })
            );
          }}
          page={props.page}
          pageSize={props.pageSize}
          pageSizeOptions={pageSizeOptions}
          previousHref={previousHref}
          totalPages={props.totalPages}
        />
      }
      summary={`Showing ${pageStart}–${pageEnd} of ${props.totalCount} transaction rows | Sorted by ${props.sortSummary}`}
    />
  );
}
