import type { ReactNode } from "react";
import {
  CanonicalListPageHeader,
  CanonicalListPageShell,
  CanonicalListPageSplitLayout,
} from "../../_components/canonical-list-page-template";

function cx(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function FrontOfficePageTemplate(props: {
  eyebrow: string;
  title: string;
  description?: string;
  summary?: ReactNode;
  main: ReactNode;
  rail?: ReactNode;
  pageClassName?: string;
  headerClassName?: string;
  summaryClassName?: string;
  layoutClassName?: string;
}) {
  return (
    <CanonicalListPageShell
      className={cx(
        "office-agent-page",
        "front-office-template-page",
        props.pageClassName,
      )}
    >
      <CanonicalListPageHeader
        className={cx("front-office-template-header", props.headerClassName)}
        description={props.description}
        eyebrow={props.eyebrow}
        summary={props.summary}
        summaryClassName={cx(
          "front-office-template-summary",
          props.summaryClassName,
        )}
        title={props.title}
      />

      <CanonicalListPageSplitLayout
        className={cx("front-office-template-layout", props.layoutClassName)}
        main={props.main}
        mainClassName="front-office-template-main"
        rail={props.rail}
        railClassName="front-office-template-rail"
      />
    </CanonicalListPageShell>
  );
}
