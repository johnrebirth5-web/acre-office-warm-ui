import type { ReactNode } from "react";
import { canManageOfficeSettings } from "@acre/auth";
import { requireOfficeSession } from "../../lib/auth-session";
import { OfficeNav } from "./office-nav";
import { OfficeTableLayoutRuntime } from "./office-table-layout-runtime";

export default async function OfficeLayout({ children }: { children: ReactNode }) {
  const context = await requireOfficeSession();

  return (
    <main className="app-shell acre-app-shell office-dashboard-shell office-backoffice-shell">
      <div className="app-grid acre-app-grid office-dashboard-grid-shell">
        <OfficeNav currentAccess={context.currentMembership} currentOfficeName={context.currentOffice?.name ?? "Acre"} />
        <div className="main-area acre-main-area office-dashboard-main">
          <OfficeTableLayoutRuntime canManageTableLayouts={canManageOfficeSettings(context.currentMembership)} />
          {children}
        </div>
      </div>
    </main>
  );
}
