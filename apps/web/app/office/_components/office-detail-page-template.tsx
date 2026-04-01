"use client";

import type { ReactNode } from "react";
import {
  CanonicalDetailPageHeader,
  CanonicalDetailPageShell
} from "../../_components/canonical-detail-page-template";

type OfficeDetailPageShellProps = {
  className?: string;
  children: ReactNode;
};

type OfficeDetailPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  summary?: ReactNode;
  summaryClassName?: string;
  className?: string;
};

export function OfficeDetailPageShell(props: OfficeDetailPageShellProps) {
  return <CanonicalDetailPageShell className={props.className}>{props.children}</CanonicalDetailPageShell>;
}

export function OfficeDetailPageHeader(props: OfficeDetailPageHeaderProps) {
  return (
    <CanonicalDetailPageHeader
      className={props.className}
      description={props.description}
      eyebrow={props.eyebrow}
      summary={props.summary}
      summaryClassName={props.summaryClassName}
      title={props.title}
    />
  );
}
