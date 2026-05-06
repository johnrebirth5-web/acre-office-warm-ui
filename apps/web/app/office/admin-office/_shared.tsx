"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Children, cloneElement, isValidElement } from "react";
import type { CSSProperties, ReactNode } from "react";
import { DataTable, StatusBadge } from "@acre/ui";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const adminOfficeNavItems = [
  { href: "/office/admin-office", label: "Summary" },
  { href: "/office/admin-office/email-requests", label: "Email requests" },
  { href: "/office/admin-office/calendar", label: "Calendar" },
  { href: "/office/admin-office/signups", label: "Signups" },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, href: string) {
  if (href === "/office/admin-office") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminOfficeModuleNav() {
  const pathname = usePathname();

  return (
    <nav className="office-filter-bar" aria-label="Admin Office navigation">
      {adminOfficeNavItems.map((item) => {
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

export function AdminOfficeStatusBadge(props: { children: ReactNode; tone?: BadgeTone }) {
  return <StatusBadge tone={props.tone ?? "neutral"}>{props.children}</StatusBadge>;
}

export function AdminOfficeDataTable(props: {
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
