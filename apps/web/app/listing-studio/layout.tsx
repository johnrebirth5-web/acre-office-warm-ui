import type { ReactNode } from "react";
import { canAccessListingStudio } from "@acre/auth";
import { getStudioListingPackCollectionShare } from "@acre/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../lib/auth-session";
import { WorkspaceSessionStatus } from "../_components/workspace-session-status";
import { FrontOfficeAccessNotice } from "../agent/_components/front-office-access-notice";
import { AgentNav } from "../agent/agent-nav";
import {
  buildListingStudioCollectionShareListingHref,
  getListingStudioShareReturnSourceFromPath,
  getListingStudioShareReturnSourceFromReferrer,
} from "./listing-studio-share-return";

export default async function ListingStudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headerStore = await headers();
  const currentPath = headerStore.get("x-acre-current-path") ?? "";
  const listingDetailMatch = currentPath.match(
    /^\/listing-studio\/listings\/([^/?#]+)(?:[?#].*)?$/,
  );

  if (listingDetailMatch) {
    const packId = decodeURIComponent(listingDetailMatch[1] ?? "");
    const returnSource =
      getListingStudioShareReturnSourceFromPath(currentPath) ??
      getListingStudioShareReturnSourceFromReferrer(
        headerStore.get("referer"),
      );
    const collectionShare = await getStudioListingPackCollectionShare({
      packId,
    });

    if (collectionShare) {
      redirect(
        buildListingStudioCollectionShareListingHref({
          packId,
          returnSource,
          shareCode: collectionShare.shareCode,
        }),
      );
    }
  }

  const context = await requireSessionContext();
  const canViewStudio = canAccessListingStudio(context.currentMembership);

  return (
    <main
      aria-label="Front Office workspace shell"
      className="app-shell acre-app-shell office-backoffice-shell agent-backoffice-shell listing-studio-layout-shell"
      data-workspace="front-office"
      data-workspace-role="listing-studio"
    >
      <div className="app-grid acre-app-grid">
        <AgentNav
          companies={context.accessibleOffices.map((office) => ({
            id: office.id,
            name: office.name,
          }))}
          currentCompanyId={context.currentOffice?.id ?? null}
          homeHref="/listing-studio/listings"
          permissions={context.currentMembership.permissions}
        />
        <div className="main-area acre-main-area office-dashboard-main">
          <WorkspaceSessionStatus context={context} />
          {canViewStudio ? (
            children
          ) : (
            <FrontOfficeAccessNotice
              currentMembership={context.currentMembership}
              featureKey="studio"
              userLocale={context.currentUser.locale}
            />
          )}
        </div>
      </div>
    </main>
  );
}
