import Link from "next/link";
import { listStudioListingCollectionShares } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@acre/ui";
import { requireSessionContext } from "../../../lib/auth-session";

function formatDateTime(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCollectionMeta(listingCount: number, updatedAt: string) {
  const updatedLabel = formatDateTime(updatedAt);

  return `${listingCount} listing${listingCount === 1 ? "" : "s"} · Updated ${updatedLabel}`;
}

export default async function ListingStudioSharesPage() {
  const context = await requireSessionContext();
  const snapshot = await listStudioListingCollectionShares({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
  });

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Listing Studio</span>
          <h2>Shares</h2>
          <p>
            Review collection links you copied out of Studio and the public opens
            recorded after clients viewed those collection pages.
          </p>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="office-list-card"
          subtitle="Collection share activity for your current Studio workspace."
          title="Collection share pulse"
        >
          <ListPageStatsGrid>
            <StatCard
              hint="Collections with a live link or recorded share history"
              label="Shared collections"
              value={snapshot.summary.sharedCollections}
            />
            <StatCard
              hint="Times a collection share link was copied"
              label="Shares"
              value={snapshot.summary.shareCount}
            />
            <StatCard
              hint="Public collection page opens"
              label="Views"
              value={snapshot.summary.viewCount}
            />
            <StatCard
              hint="Currently enabled collection share links"
              label="Live links"
              value={snapshot.summary.activeShareLinks}
            />
          </ListPageStatsGrid>
        </SectionCard>

        <div className="listing-studio-shell">
          <section className="listing-studio-listed-section">
            <div className="listing-studio-listed-section-head">
              <div>
                <span className="listing-studio-shell-eyebrow">Share history</span>
                <h2>Collection shares</h2>
              </div>
              <p>
                {snapshot.items.length} collection
                {snapshot.items.length === 1 ? "" : "s"} currently have share
                activity.
              </p>
            </div>

            {snapshot.items.length ? (
              <div className="office-list-table listing-studio-shares-table">
                <div className="office-list-table-header listing-studio-shares-table-row">
                  <span>Collection</span>
                  <span>Status</span>
                  <span>Shares</span>
                  <span>Views</span>
                  <span>Last shared</span>
                  <span>Last viewed</span>
                  <span>Link</span>
                </div>

                <div className="office-list-table-body">
                  {snapshot.items.map((item) => (
                    <div
                      className="office-list-table-row listing-studio-shares-table-row"
                      key={item.id}
                    >
                      <div className="office-list-table-main">
                        <strong>
                          <Link href={`/listing-studio/collections/${item.id}`}>
                            {item.name}
                          </Link>
                        </strong>
                        <p>{formatCollectionMeta(item.listingCount, item.updatedAt)}</p>
                      </div>

                      <span>
                        <StatusBadge tone={item.shareEnabled ? "success" : "neutral"}>
                          {item.shareEnabled ? "Live" : "Inactive"}
                        </StatusBadge>
                      </span>

                      <span className="listing-studio-share-count">
                        {item.shareCount}
                      </span>
                      <span className="listing-studio-share-count">
                        {item.viewCount}
                      </span>
                      <span>{formatDateTime(item.lastSharedAt)}</span>
                      <span>{formatDateTime(item.lastViewedAt)}</span>
                      <span>
                        {item.shareCode ? (
                          <Link
                            className="office-table-action-muted"
                            href={`/share/collections/${item.shareCode}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open
                          </Link>
                        ) : (
                          "Not minted"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                action={
                  <Link
                    className="office-button office-button-primary"
                    href="/listing-studio/collections"
                  >
                    Open collections
                  </Link>
                }
                className="listing-studio-empty-state"
                description="Copy a collection share link from a collection detail page to start the share history."
                title="No collection shares yet."
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
