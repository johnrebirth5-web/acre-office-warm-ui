import type { ReactNode } from "react";
import { requireOfficeSession } from "../../lib/auth-session";
import { OfficeNav } from "./office-nav";

export default async function OfficeLayout({ children }: { children: ReactNode }) {
  const context = await requireOfficeSession();

  return (
    <main className="app-shell acre-app-shell office-dashboard-shell office-backoffice-shell">
      <div className="app-grid acre-app-grid office-dashboard-grid-shell">
        <OfficeNav currentOfficeName={context.currentOffice?.name ?? "Acre"} />
        <div className="main-area acre-main-area office-dashboard-main">{children}</div>
      </div>
    </main>
  );
}
