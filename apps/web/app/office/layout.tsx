import type { ReactNode } from "react";
import { canManageOfficeSettings } from "@acre/auth";
import { getOfficeTableLayouts } from "@acre/db";
import { requireOfficeSession } from "../../lib/auth-session";
import { buildOfficeTableLayoutBootstrapScript } from "./office-table-layout-bootstrap";
import { OfficeNav } from "./office-nav";
import { OfficeTableLayoutRuntime } from "./office-table-layout-runtime";

export default async function OfficeLayout({ children }: { children: ReactNode }) {
  const context = await requireOfficeSession();
  const initialLayouts = await getOfficeTableLayouts({
    organizationId: context.currentOrganization.id
  });
  const bootstrapScript = Object.keys(initialLayouts).length > 0 ? buildOfficeTableLayoutBootstrapScript(initialLayouts) : "";

  return (
    <main className="app-shell acre-app-shell office-dashboard-shell office-backoffice-shell">
      <div className="app-grid acre-app-grid office-dashboard-grid-shell">
        <OfficeNav
          companies={context.accessibleOffices.map((office) => ({
            id: office.id,
            name: office.name,
          }))}
          currentAccess={context.currentMembership}
          currentCompanyId={context.currentOffice?.id ?? null}
          currentOfficeName={context.currentOffice?.name ?? "Acre"}
        />
        <div className="main-area acre-main-area office-dashboard-main">
          <OfficeTableLayoutRuntime
            canManageTableLayouts={canManageOfficeSettings(context.currentMembership)}
            initialLayouts={initialLayouts}
          />
          {children}
          {bootstrapScript ? <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} /> : null}
        </div>
      </div>
    </main>
  );
}
