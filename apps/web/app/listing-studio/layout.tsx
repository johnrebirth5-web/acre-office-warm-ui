import type { ReactNode } from "react";
import { canAccessListingStudio, getDefaultAppPath } from "@acre/auth";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../lib/auth-session";
import { ListingStudioNav } from "./listing-studio-nav";

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
    <main className="app-shell acre-app-shell office-backoffice-shell listing-studio-shell">
      <div className="app-grid acre-app-grid">
        <ListingStudioNav />
        <div className="main-area acre-main-area office-dashboard-main">
          {children}
        </div>
      </div>
    </main>
  );
}
