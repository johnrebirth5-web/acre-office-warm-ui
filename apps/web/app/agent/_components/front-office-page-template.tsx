import type { ReactNode } from "react";
import {
  ListPageSplit,
  ListPageStack,
  PageHeader,
  PageHeaderSummary,
  PageShell
} from "@acre/ui";

function cx(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function FrontOfficePageTemplate(props: {
  eyebrow: string;
  title: string;
  description: string;
  summary: ReactNode;
  main: ReactNode;
  rail?: ReactNode;
  pageClassName?: string;
  headerClassName?: string;
  summaryClassName?: string;
  layoutClassName?: string;
}) {
  return (
    <PageShell className={cx("office-agent-page front-office-template-page", props.pageClassName)}>
      <PageHeader
        actions={<PageHeaderSummary className={cx("front-office-template-summary", props.summaryClassName)}>{props.summary}</PageHeaderSummary>}
        className={cx("front-office-template-header", props.headerClassName)}
        description={props.description}
        eyebrow={props.eyebrow}
        title={props.title}
      />

      {props.rail ? (
        <ListPageSplit className={cx("front-office-template-layout", props.layoutClassName)}>
          <ListPageStack className="front-office-template-main">{props.main}</ListPageStack>
          <ListPageStack className="front-office-template-rail">{props.rail}</ListPageStack>
        </ListPageSplit>
      ) : (
        <ListPageStack className="front-office-template-main">{props.main}</ListPageStack>
      )}
    </PageShell>
  );
}
