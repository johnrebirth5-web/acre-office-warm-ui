import Link from "next/link";
import { getListingStudioDashboard } from "@acre/db";
import { ListPageStatsGrid, SectionCard, StatCard } from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";
import { ListingStudioExtensionConnectAction } from "./extension-connect-action";

function formatConnectedAtLabel(value: string | null) {
  if (!value) {
    return "Not connected yet";
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ListingStudioDashboardPage() {
  const context = await requireSessionContext();
  const snapshot = await getListingStudioDashboard({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
  });

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Listing Studio</span>
          <h2>Save listings and share them fast.</h2>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="listing-studio-banner-card"
          subtitle="Connect the Chrome extension here, then save StreetEasy and Zillow listings straight into Acre."
          title="Chrome extension"
        >
          <ListingStudioExtensionConnectAction
            serverActiveTokenCount={snapshot.extension.activeTokenCount}
            serverHasActiveToken={snapshot.extension.hasActiveToken}
            serverLatestConnectedAtLabel={formatConnectedAtLabel(
              snapshot.extension.latestConnectedAt,
            )}
          />
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle="A quick read on current Listing Studio activity."
          title="Studio overview"
        >
          <ListPageStatsGrid>
            <StatCard
              hint="All saved listings in this organization"
              label="Saved listings"
              value={snapshot.summary.totalListings}
            />
            <StatCard
              hint="Imports received in the last two weeks"
              label="Recent imports"
              value={snapshot.summary.recentImports}
            />
            <StatCard
              hint="Public share page opens recorded across shared listings"
              label="Share views"
              value={snapshot.summary.shareViews}
            />
            <StatCard
              hint="Listings that already have a live public share link"
              label="Ready to share"
              value={snapshot.summary.readyToShare}
            />
          </ListPageStatsGrid>
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle="Recently updated saved listings."
          title="Recent listings"
        >
          <div className="listing-studio-card-grid">
            {snapshot.recentListings.length ? (
              snapshot.recentListings.map((item) => (
                <Link
                  className="listing-studio-card"
                  href={`/listing-studio/listings/${item.packId}`}
                  key={item.packId}
                >
                  <div className="listing-studio-card-media">
                    {item.heroAssetId ? (
                      <img
                        alt={item.title}
                        src={`/api/listing-studio/assets/${item.heroAssetId}`}
                      />
                    ) : (
                      <div className="listing-studio-card-media-fallback">
                        {item.sourceSite === "streeteasy" ? "StreetEasy" : "Zillow"}
                      </div>
                    )}
                  </div>
                  <div className="listing-studio-card-body">
                    <div className="listing-studio-card-meta">
                      <span className="office-status-badge office-status-badge-neutral">
                        {item.sourceSite}
                      </span>
                      {item.shareEnabled ? (
                        <span className="office-status-badge office-status-badge-success">
                          Shared
                        </span>
                      ) : null}
                    </div>
                    <strong>{item.priceLabel}</strong>
                    <span className="listing-studio-card-title">{item.title}</span>
                    <span className="listing-studio-card-address">
                      {item.addressLine}
                    </span>
                    <span className="listing-studio-card-facts">{item.factsLine}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="listing-studio-empty-state">
                <strong>No saved listings yet.</strong>
                <p>
                  Open a supported listing page in Chrome, click the Acre save
                  card, and the listing will show up here automatically.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
