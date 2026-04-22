import Link from "next/link";
import { listStudioListingCollections } from "@acre/db";
import { requireSessionContext } from "../../../lib/auth-session";
import { CreateCollectionForm } from "./create-collection-form";
import { DeleteCollectionButton } from "./delete-collection-button";

type ListingStudioCollectionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : "";
}

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

export default async function ListingStudioCollectionsPage(
  props: ListingStudioCollectionsPageProps,
) {
  const context = await requireSessionContext();
  const searchParams = (await props.searchParams) ?? {};
  const deleted = readSearchParam(searchParams, "deleted");
  const collections = await listStudioListingCollections({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
  });

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">Listing Studio</span>
          <h2>Collections</h2>
          <p>
            Build private client folders from imported listing packets, then use
            the detail view to study how those homes spread across the map.
          </p>
        </div>
      </section>

      <div className="listing-studio-shell">
        {deleted ? (
          <div className="listing-studio-status-message">
            Collection deleted from Listing Studio.
          </div>
        ) : null}

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
                <div
                  className="listing-studio-collection-card-shell"
                  key={collection.id}
                >
                  <div className="listing-studio-collection-card-actions">
                    <DeleteCollectionButton
                      buttonClassName="listing-studio-card-delete-button"
                      collectionId={collection.id}
                      collectionName={collection.name}
                      iconOnly
                    />
                  </div>

                  <Link
                    className="listing-studio-collection-card"
                    href={`/listing-studio/collections/${collection.id}`}
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
                        <span>
                          {collection.listingCount} listing
                          {collection.listingCount === 1 ? "" : "s"}
                        </span>
                        <span>Updated {formatUpdatedLabel(collection.updatedAt)}</span>
                      </div>
                      <strong>{collection.name}</strong>
                      <p>
                        Open this folder to review every saved listing and the live
                        map view for the area.
                      </p>
                    </div>
                  </Link>
                </div>
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
