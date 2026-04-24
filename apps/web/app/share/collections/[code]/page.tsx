import { getStudioListingPublicCollection } from "@acre/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  consumePublicTokenRateLimit,
  PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS,
} from "../../../../lib/public-token-rate-limit";

type ListingStudioPublicCollectionPageProps = {
  params: Promise<{ code: string }>;
};

function formatUpdatedLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently updated";
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatListingTypeLabel(value: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "sale") {
    return "Sale";
  }

  if (normalized === "rent") {
    return "Rental";
  }

  return null;
}

function formatSourceSiteLabel(value: string) {
  return value === "streeteasy" ? "StreetEasy" : "Zillow";
}

export default async function ListingStudioPublicCollectionPage(
  props: ListingStudioPublicCollectionPageProps,
) {
  const { code } = await props.params;
  const headerStore = await headers();
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/listing-studio/collections/read",
    request: headerStore,
    token: code,
    options: PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    notFound();
  }

  const snapshot = await getStudioListingPublicCollection({
    shareCode: code,
  });

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="listing-studio-share-shell listing-studio-collection-share-shell">
      <div className="listing-studio-share-page listing-studio-collection-share-page">
        <section className="listing-studio-collection-share-hero">
          <div className="listing-studio-collection-share-copy">
            <span className="office-eyebrow">Shared collection</span>
            <h1>{snapshot.name}</h1>
            <p>
              {snapshot.listingCount} curated listing
              {snapshot.listingCount === 1 ? "" : "s"} ready to review.
            </p>
          </div>

          <div className="listing-studio-collection-share-summary">
            <strong>{snapshot.listingCount}</strong>
            <span>Listings</span>
            <p>Updated {formatUpdatedLabel(snapshot.updatedAt)}</p>
          </div>
        </section>

        {snapshot.listings.length ? (
          <section className="listing-studio-collection-share-grid">
            {snapshot.listings.map((listing, index) => {
              const listingTypeLabel = formatListingTypeLabel(
                listing.listingType,
              );

              return (
                <article
                  className="listing-studio-collection-share-card"
                  key={listing.packId}
                >
                  <div className="listing-studio-collection-share-card-media">
                    {listing.heroAssetId ? (
                      <img
                        alt={listing.displayTitle || listing.addressLine}
                        src={`/api/listing-studio/assets/${listing.heroAssetId}?shareCode=${snapshot.code}`}
                      />
                    ) : (
                      <div className="listing-studio-collection-share-card-empty">
                        <span>{formatSourceSiteLabel(listing.sourceSite)}</span>
                      </div>
                    )}

                    <div className="listing-studio-collection-share-card-badges">
                      <span className="listing-studio-collection-share-card-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="listing-studio-collection-share-card-source">
                        {formatSourceSiteLabel(listing.sourceSite)}
                      </span>
                      {listingTypeLabel ? (
                        <span className="listing-studio-collection-share-card-type">
                          {listingTypeLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="listing-studio-collection-share-card-body">
                    <div className="listing-studio-collection-share-card-copy">
                      <strong>{listing.priceLabel}</strong>
                      <h2>{listing.displayTitle || listing.addressLine}</h2>
                      <p>{listing.addressLine}</p>
                      {listing.locationLine ? <p>{listing.locationLine}</p> : null}
                    </div>

                    <div className="listing-studio-collection-share-card-meta">
                      {listing.factsLine ? <span>{listing.factsLine}</span> : null}
                      {listing.statusLabel ? <span>{listing.statusLabel}</span> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="listing-studio-share-section">
            <h2>No listings available</h2>
            <p>This shared collection is empty right now.</p>
          </section>
        )}
      </div>
    </main>
  );
}
