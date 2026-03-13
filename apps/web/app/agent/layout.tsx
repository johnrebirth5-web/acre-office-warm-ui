import type { ReactNode } from "react";
import { AgentNav } from "./agent-nav";

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <main className="app-shell acre-app-shell office-backoffice-shell agent-backoffice-shell">
      <div className="app-grid acre-app-grid">
        <AgentNav />
        <div className="main-area acre-main-area office-dashboard-main">{children}</div>
      </div>
    </main>
  );
}
