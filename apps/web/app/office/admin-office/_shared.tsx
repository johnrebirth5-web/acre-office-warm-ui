import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable, StatusBadge } from "@acre/ui";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export function AdminOfficeModuleNav() {
  return (
    <nav className="office-filter-bar" aria-label="Admin Office navigation">
      <Link className="office-filter-chip" href="/office/admin-office">Summary</Link>
      <Link className="office-filter-chip" href="/office/admin-office/email-requests">Email requests</Link>
      <Link className="office-filter-chip" href="/office/admin-office/calendar">Calendar</Link>
      <Link className="office-filter-chip" href="/office/admin-office/signups">Signups</Link>
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
  return (
    <DataTable style={{ gridTemplateColumns: props.gridTemplateColumns }}>
      <div className="office-table-header" role="row">
        {props.columns.map((column) => (
          <span key={column} role="columnheader">{column}</span>
        ))}
      </div>
      {props.children}
    </DataTable>
  );
}
