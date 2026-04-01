"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SelectInput } from "@acre/ui";
import {
  CanonicalListPageHeader,
  CanonicalListPageShell,
  CanonicalListPageTableCard
} from "../../_components/canonical-list-page-template";

type ClassValue = string | false | null | undefined;

function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

type OfficeListPageShellProps = {
  className?: string;
  children: ReactNode;
};

type OfficeListPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  summary?: ReactNode;
  summaryClassName?: string;
  className?: string;
};

type OfficeListPageTableCardProps = {
  id?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

type OfficeListPageTemplateProps = {
  className?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  summary?: ReactNode;
  summaryClassName?: string;
  sectionId?: string;
  sectionTitle?: string;
  sectionSubtitle?: string;
  sectionActions?: ReactNode;
  sectionClassName?: string;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

type OfficeListPagePaginationProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  previousHref?: string;
  nextHref?: string;
  onPageSizeChange: (nextPageSize: number) => void;
  className?: string;
};

export function OfficeListPageShell(props: OfficeListPageShellProps) {
  return <CanonicalListPageShell className={props.className}>{props.children}</CanonicalListPageShell>;
}

export function OfficeListPageHeader(props: OfficeListPageHeaderProps) {
  return (
    <CanonicalListPageHeader
      className={props.className}
      description={props.description}
      eyebrow={props.eyebrow}
      summary={props.summary}
      summaryClassName={props.summaryClassName}
      title={props.title}
    />
  );
}

export function OfficeListPageTableCard(props: OfficeListPageTableCardProps) {
  return (
    <CanonicalListPageTableCard
      actions={props.actions}
      className={props.className}
      id={props.id}
      filters={props.filters}
      footer={props.footer}
      subtitle={props.subtitle}
      title={props.title}
    >
      {props.children}
    </CanonicalListPageTableCard>
  );
}

export function OfficeListPageTemplate(props: OfficeListPageTemplateProps) {
  return (
    <OfficeListPageShell className={props.className}>
      <OfficeListPageHeader
        description={props.description}
        eyebrow={props.eyebrow}
        summary={props.summary}
        summaryClassName={props.summaryClassName}
        title={props.title}
      />

      <OfficeListPageTableCard
        actions={props.sectionActions}
        className={props.sectionClassName}
        filters={props.filters}
        footer={props.footer}
        id={props.sectionId}
        subtitle={props.sectionSubtitle}
        title={props.sectionTitle}
      >
        {props.children}
      </OfficeListPageTableCard>
    </OfficeListPageShell>
  );
}

export function OfficeListPagePagination(props: OfficeListPagePaginationProps) {
  const totalPageCount = Math.max(props.totalPages, 1);
  const currentPage = Math.min(Math.max(props.page, 1), totalPageCount);

  return (
    <div className={cx("office-list-page-pagination", props.className)}>
      <label className="office-list-page-size">
        <span>Rows</span>
        <SelectInput
          onChange={(event) =>
            props.onPageSizeChange(Number(event.target.value))
          }
          value={String(props.pageSize)}
        >
          {props.pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
      </label>

      <div className="office-list-pager">
        {props.previousHref ? (
          <Link className="office-list-page-button" href={props.previousHref}>
            «
          </Link>
        ) : (
          <span className="office-list-page-button is-disabled">«</span>
        )}

        <span className="office-list-page-indicator">
          Page {currentPage} / {totalPageCount}
        </span>

        {props.nextHref ? (
          <Link className="office-list-page-button" href={props.nextHref}>
            »
          </Link>
        ) : (
          <span className="office-list-page-button is-disabled">»</span>
        )}
      </div>
    </div>
  );
}
