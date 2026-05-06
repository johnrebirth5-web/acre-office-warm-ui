"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Children, cloneElement, isValidElement } from "react";
import type { CSSProperties, ReactNode } from "react";
import { DataTable, StatusBadge } from "@acre/ui";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const hrNavItems = [
  { href: "/office/hr", label: "Summary" },
  { href: "/office/hr/candidates", label: "Candidates" },
  { href: "/office/hr/interviews", label: "Interviews" },
  { href: "/office/hr/onboarding", label: "Onboarding" },
  { href: "/office/hr/offboarding", label: "Offboarding" },
  { href: "/office/hr/templates", label: "Templates" },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, href: string) {
  if (href === "/office/hr") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HrModuleNav() {
  const pathname = usePathname();

  return (
    <nav className="office-filter-bar" aria-label="HR navigation">
      {hrNavItems.map((item) => {
        const isActive = isActivePath(pathname, item.href);
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cx("office-filter-chip", isActive && "is-active")}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HrStatusBadge(props: { children: ReactNode; tone?: BadgeTone }) {
  return <StatusBadge tone={props.tone ?? "neutral"}>{props.children}</StatusBadge>;
}

export function HrDataTable(props: {
  columns: string[];
  gridTemplateColumns: string;
  children: ReactNode;
}) {
  const gridStyle: CSSProperties = {
    gridTemplateColumns: props.gridTemplateColumns,
  };

  return (
    <DataTable>
      <div className="office-table-header" role="row" style={gridStyle}>
        {props.columns.map((column) => (
          <span key={column} role="columnheader">{column}</span>
        ))}
      </div>
      {Children.map(props.children, (child) => {
        if (!isValidElement<{ className?: string; style?: CSSProperties }>(child)) {
          return child;
        }

        const className = child.props.className ?? "";
        if (!className.includes("office-table-row")) {
          return child;
        }

        return cloneElement(child, {
          style: {
            ...child.props.style,
            ...gridStyle,
          },
        });
      })}
    </DataTable>
  );
}
