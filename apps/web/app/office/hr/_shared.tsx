import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable, StatusBadge } from "@acre/ui";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export function HrModuleNav() {
  return (
    <nav className="office-filter-bar" aria-label="HR navigation">
      <Link className="office-filter-chip" href="/office/hr">Summary</Link>
      <Link className="office-filter-chip" href="/office/hr/candidates">Candidates</Link>
      <Link className="office-filter-chip" href="/office/hr/interviews">Interviews</Link>
      <Link className="office-filter-chip" href="/office/hr/onboarding">Onboarding</Link>
      <Link className="office-filter-chip" href="/office/hr/offboarding">Offboarding</Link>
      <Link className="office-filter-chip" href="/office/hr/templates">Templates</Link>
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
