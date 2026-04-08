import type { ReactNode } from "react";
import { AgentNav } from "./agent-nav";

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <main
      aria-label="Front Office workspace shell"
      className="app-shell acre-app-shell office-backoffice-shell agent-backoffice-shell"
      data-workspace="front-office"
      data-workspace-role="daily-execution"
    >
      <div className="app-grid acre-app-grid">
        <AgentNav />
        <div className="main-area acre-main-area office-dashboard-main">{children}</div>
      </div>
    </main>
  );
}
