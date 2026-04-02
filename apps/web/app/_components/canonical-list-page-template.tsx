import type { ReactNode } from "react";
import {
  ListPageSection,
  ListPageSplit,
  ListPageStack,
  OfficeListPageSummary,
  PageHeader,
  PageShell
} from "@acre/ui";

type ClassValue = string | false | null | undefined;

function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

export function CanonicalListPageShell(props: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <PageShell className={cx("office-list-page", "office-canonical-list-page", props.className)}>
      {props.children}
    </PageShell>
  );
}

export function CanonicalListPageHeader(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  summary?: ReactNode;
  actions?: ReactNode;
  summaryClassName?: string;
  className?: string;
}) {
  return (
    <PageHeader
      actions={
        props.summary || props.actions ? (
          <div className="office-list-page-header-supporting">
            {props.actions ? <div className="office-list-page-header-toolbar">{props.actions}</div> : null}
            {props.summary ? (
              <OfficeListPageSummary className={cx("office-canonical-list-page-summary", props.summaryClassName)}>
                {props.summary}
              </OfficeListPageSummary>
            ) : null}
          </div>
        ) : null
      }
      className={cx("office-canonical-list-page-header", props.className)}
      description={props.description}
      eyebrow={props.eyebrow}
      title={props.title}
    />
  );
}

export function CanonicalListPageTableCard(props: {
  id?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ListPageSection
      actions={props.actions}
      className={cx("office-canonical-list-page-card", props.className)}
      id={props.id}
      subtitle={props.subtitle}
      title={props.title}
    >
      {props.filters ? <div className="office-list-page-workbench">{props.filters}</div> : null}
      <div className="office-list-page-table-region">{props.children}</div>
      {props.footer ? <div className="office-list-page-footer-region">{props.footer}</div> : null}
    </ListPageSection>
  );
}

export function CanonicalListPageSplitLayout(props: {
  className?: string;
  mainClassName?: string;
  railClassName?: string;
  main: ReactNode;
  rail?: ReactNode;
}) {
  if (!props.rail) {
    return <ListPageStack className={props.mainClassName}>{props.main}</ListPageStack>;
  }

  return (
    <ListPageSplit className={props.className}>
      <ListPageStack className={props.mainClassName}>{props.main}</ListPageStack>
      <ListPageStack className={props.railClassName}>{props.rail}</ListPageStack>
    </ListPageSplit>
  );
}
