import type { ReactNode } from "react";
import { OfficeListPageSummary, PageHeader, PageShell } from "@acre/ui";

type ClassValue = string | false | null | undefined;

function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

export function CanonicalDetailPageShell(props: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <PageShell className={cx("office-detail-page", "office-canonical-detail-page", props.className)}>
      {props.children}
    </PageShell>
  );
}

export function CanonicalDetailPageHeader(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  summary?: ReactNode;
  summaryClassName?: string;
  className?: string;
}) {
  return (
    <PageHeader
      actions={
        props.summary ? (
          <OfficeListPageSummary className={cx("office-canonical-detail-page-summary", props.summaryClassName)}>
            {props.summary}
          </OfficeListPageSummary>
        ) : null
      }
      className={cx("office-canonical-detail-page-header", props.className)}
      description={props.description}
      eyebrow={props.eyebrow}
      title={props.title}
    />
  );
}
