import Link from "next/link";
import { getListingStudioDashboard } from "@acre/db";
import { Button, ListPageStatsGrid, SectionCard, StatCard } from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";

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
          <p>
            Use the Chrome extension to save a StreetEasy or Zillow listing, then
            come back here to edit, share, or export it.
          </p>
        </div>
        <div className="office-page-supporting">
          <div className="office-page-actions office-page-summary-grid listing-studio-header-actions">
            <Link className="office-button office-button-secondary" href="/listing-studio/listings">
              View listings
            </Link>
          </div>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="listing-studio-banner-card"
          subtitle="The extension runs from StreetEasy and Zillow listing detail pages. It injects the bottom-right save card and sends captured HTML, facts, and images straight into Acre."
          title="Chrome extension"
          actions={
            <a
              className="office-button office-button-primary"
              href="/listing-studio/listings"
            >
              Review saved packets
            </a>
          }
        >
          <div className="listing-studio-banner-grid">
            <div className="listing-studio-banner-copy">
              <strong>
                {snapshot.extension.hasActiveToken
                  ? "Extension connected"
                  : "Connect the extension from the popup"}
              </strong>
              <p>
                {snapshot.extension.hasActiveToken
                  ? `This account already has ${snapshot.extension.activeTokenCount} active connection${snapshot.extension.activeTokenCount === 1 ? "" : "s"}. Latest link: ${formatConnectedAtLabel(snapshot.extension.latestConnectedAt)}.`
                  : "Open the Acre extension popup, choose your Acre base URL, and click Connect to Acre. The approval page will issue the long-lived token automatically."}
              </p>
            </div>
            <div className="listing-studio-banner-status">
              <span className={`office-status-badge ${snapshot.extension.hasActiveToken ? "office-status-badge-success" : "office-status-badge-warning"}`}>
                {snapshot.extension.hasActiveToken ? "Connected" : "Awaiting connection"}
              </span>
              <span className="listing-studio-banner-meta">
                Supported sources: StreetEasy, Zillow
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle="A quick read on how much of the workspace is already active."
          title="Studio overview"
        >
          <ListPageStatsGrid>
            <StatCard
              hint="All captured listing packets in this organization"
              label="Saved listings"
              value={snapshot.summary.totalListings}
            />
            <StatCard
              hint="Imports received in the last two weeks"
              label="Recent imports"
              value={snapshot.summary.recentImports}
            />
            <StatCard
              hint="Public share page opens recorded across shared packets"
              label="Share views"
              value={snapshot.summary.shareViews}
            />
            <StatCard
              hint="Packets that already have a live public share link"
              label="Ready to share"
              value={snapshot.summary.readyToShare}
            />
          </ListPageStatsGrid>
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle="These are the most recently updated imported packets."
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
                  Open a supported listing page in Chrome, click the Acre floating
                  save card, and the imported packet will show up here automatically.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
