import { canManageListingStudioCompanyFeed } from "@acre/auth";
import { getListingStudioCompanyDashboard } from "@acre/db";
import { requireSessionContext } from "../../../lib/auth-session";
import { ListingStudioCard } from "../listing-studio-card";

export default async function ListingStudioDashboardPage() {
  const context = await requireSessionContext();
  const canManageCompanyFeed = canManageListingStudioCompanyFeed(
    context.currentMembership,
  );
  const snapshot = await getListingStudioCompanyDashboard({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
  });

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Listing Studio</span>
          <h2>Company dashboard</h2>
          <p>
            Listings published by your admin team appear here for the whole
            studio. Add the ones you want into your own listings workspace with
            one click.
          </p>
        </div>
      </section>

      <div className="listing-studio-shell">
        <section className="listing-studio-listed-section">
          <div className="listing-studio-listed-section-head">
            <div>
              <span className="listing-studio-shell-eyebrow">Company feed</span>
              <h2>Shared company listings</h2>
            </div>
            <p>
              {snapshot.items.length} listing
              {snapshot.items.length === 1 ? "" : "s"} currently live on the
              company board.
            </p>
          </div>

          <div className="listing-studio-card-grid">
            {snapshot.items.length ? (
              snapshot.items.map((item) => (
                <ListingStudioCard
                  canManageCompanyFeed={canManageCompanyFeed}
                  item={item}
                  key={item.packId}
                  mode="dashboard"
                />
              ))
            ) : (
              <div className="listing-studio-empty-state">
                <strong>No company listings are live yet.</strong>
                <p>
                  {canManageCompanyFeed
                    ? "Import a listing from Studio > Listings, or publish one from your saved listings to start the company board."
                    : "Wait for an owner or office admin to publish listings here, then you can add them into your own Listings workspace."}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
