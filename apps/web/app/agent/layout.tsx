import type { ReactNode } from "react";
import { requireSessionContext } from "../../lib/auth-session";
import { WorkspaceSessionStatus } from "../_components/workspace-session-status";
import { AgentNav } from "./agent-nav";

export default async function AgentLayout({ children }: { children: ReactNode }) {
  const context = await requireSessionContext();

  return (
    <main
      aria-label="Front Office workspace shell"
      className="app-shell acre-app-shell office-backoffice-shell agent-backoffice-shell"
      data-workspace="front-office"
      data-workspace-role="daily-execution"
    >
      <div className="app-grid acre-app-grid">
        <AgentNav
          companies={context.accessibleOffices.map((office) => ({
            id: office.id,
            name: office.name,
          }))}
          currentCompanyId={context.currentOffice?.id ?? null}
          homeHref="/agent/dashboard"
        />
        <div className="main-area acre-main-area office-dashboard-main">
          <WorkspaceSessionStatus context={context} />
          {children}
        </div>
      </div>
    </main>
  );
}
