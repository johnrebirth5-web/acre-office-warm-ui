"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Children, cloneElement, isValidElement } from "react";
import type { CSSProperties, ReactNode } from "react";
import { DataTable, StatusBadge } from "@acre/ui";
import { useI18n } from "../../../lib/i18n/client";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const adminOfficeNavItems = [
  { href: "/office/admin-office", enLabel: "Summary", zhLabel: "摘要" },
  { href: "/office/admin-office/email-requests", enLabel: "Email requests", zhLabel: "邮箱申请" },
  { href: "/office/admin-office/calendar", enLabel: "Calendar", zhLabel: "日历" },
  { href: "/office/admin-office/signups", enLabel: "Signups", zhLabel: "报名" },
];

const adminOfficeBadgeLabels: Record<string, string> = {
  activity: "活动",
  approved: "已批准",
  broker_tour: "经纪人看房团",
  completed: "已完成",
  going: "已报名",
  meeting: "会议",
  other: "其他",
  pending: "待处理",
  rejected: "已拒绝",
  training: "培训",
};

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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";

  return (
    <nav className="office-filter-bar" aria-label={isZh ? "行政导航" : "Admin Office navigation"}>
      {adminOfficeNavItems.map((item) => {
        const isActive = isActivePath(pathname, item.href);
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cx("office-filter-chip", isActive && "is-active")}
            href={item.href}
            key={item.href}
          >
            {isZh ? item.zhLabel : item.enLabel}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminOfficeStatusBadge(props: { children: ReactNode; tone?: BadgeTone }) {
  const { locale } = useI18n();
  const label = locale === "zh-CN" && typeof props.children === "string" ? adminOfficeBadgeLabels[props.children] ?? props.children : props.children;
  return <StatusBadge tone={props.tone ?? "neutral"}>{label}</StatusBadge>;
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
