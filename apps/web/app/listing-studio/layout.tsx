import type { ReactNode } from "react";
import { canAccessListingStudio, getDefaultAppPath } from "@acre/auth";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../lib/auth-session";
import { AgentNav } from "../agent/agent-nav";

export default async function ListingStudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireSessionContext();

  if (!canAccessListingStudio(context.currentMembership)) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  return (
    <main
      aria-label="Front Office workspace shell"
      className="app-shell acre-app-shell office-backoffice-shell agent-backoffice-shell listing-studio-shell"
      data-workspace="front-office"
      data-workspace-role="listing-studio"
    >
      <div className="app-grid acre-app-grid">
        <AgentNav />
        <div className="main-area acre-main-area office-dashboard-main">
          {children}
        </div>
      </div>
    </main>
  );
}
