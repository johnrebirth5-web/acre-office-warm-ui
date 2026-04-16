import Link from "next/link";
import { listStudioListingCollections } from "@acre/db";
import { requireSessionContext } from "../../../lib/auth-session";
import { CreateCollectionForm } from "./create-collection-form";

function formatUpdatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently updated";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ListingStudioCollectionsPage() {
  const context = await requireSessionContext();
  const collections = await listStudioListingCollections({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
  });

  return (
    <div className="office-list-page listing-studio-page">
      <div className="listing-studio-shell">
        <header className="listing-studio-shell-header">
          <div className="listing-studio-shell-header-copy">
            <span className="listing-studio-shell-eyebrow">Listing Studio</span>
            <h1>Collections</h1>
            <p>
              Build private client folders from imported listing packets, then use
              the detail view to study how those homes spread across the map.
            </p>
          </div>
        </header>

        <section className="listing-studio-toolbar-card">
          <CreateCollectionForm />
        </section>

        <section className="listing-studio-listed-section">
          <div className="listing-studio-listed-section-head">
            <div>
              <span className="listing-studio-shell-eyebrow">Private folders</span>
              <h2>Your saved collections</h2>
            </div>
            <p>
              {collections.length} collection
              {collections.length === 1 ? "" : "s"} currently belong to this
              Front Office seat.
            </p>
          </div>

          <div className="listing-studio-collections-grid">
            {collections.length ? (
              collections.map((collection) => (
                <Link
                  className="listing-studio-collection-card"
                  href={`/listing-studio/collections/${collection.id}`}
                  key={collection.id}
                >
                  <div className="listing-studio-collection-card-media">
                    {collection.previewListings.length ? (
                      collection.previewListings.map((listing, index) => (
                        <div
                          className="listing-studio-collection-card-tile"
                          key={listing.packId}
                          style={{ zIndex: collection.previewListings.length - index }}
                        >
                          {listing.heroAssetId ? (
                            <img
                              alt={listing.displayTitle || listing.addressLine}
                              src={`/api/listing-studio/assets/${listing.heroAssetId}`}
                            />
                          ) : (
                            <span>
                              {listing.sourceSite === "streeteasy" ? "StreetEasy" : "Zillow"}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="listing-studio-collection-card-empty">
                        Empty collection
                      </div>
                    )}
                  </div>

                  <div className="listing-studio-collection-card-body">
                    <div className="listing-studio-collection-card-meta">
                      <span>{collection.listingCount} listing{collection.listingCount === 1 ? "" : "s"}</span>
                      <span>Updated {formatUpdatedLabel(collection.updatedAt)}</span>
                    </div>
                    <strong>{collection.name}</strong>
                    <p>
                      Open this folder to review every saved listing and the live map
                      view for the area.
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="listing-studio-empty-state">
                <strong>No collections yet.</strong>
                <p>
                  Create a named folder above, then start grouping imported packets
                  by building, neighborhood, or client short-list.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
