"use client";

import type { CSSProperties, ReactNode } from "react";
import { HorizontalScrollArea, useHorizontalScrollAreaContext } from "./horizontal-scroll-area";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function DataTable(props: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const isInsideHorizontalScrollArea = useHorizontalScrollAreaContext();

  if (isInsideHorizontalScrollArea) {
    return (
      <div className={cx("office-data-table", props.className)} role="table" style={props.style}>
        {props.children}
      </div>
    );
  }

  return (
    <HorizontalScrollArea>
      <div className={cx("office-data-table", props.className)} role="table" style={props.style}>
        {props.children}
      </div>
    </HorizontalScrollArea>
  );
}
