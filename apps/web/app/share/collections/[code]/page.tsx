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
    return "For sale";
  }

  if (normalized === "rent") {
    return "Rental";
  }

  return null;
}

function formatSourceSiteLabel(value: string) {
  return value === "streeteasy" ? "StreetEasy" : "Zillow";
}

function getFacts(line: string) {
  return line
    .split(" · ")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function buildAssetSrc(assetId: string | null, code: string) {
  return assetId
    ? `/api/listing-studio/assets/${assetId}?shareCode=${code}`
    : null;
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

  const heroImageSrc = buildAssetSrc(snapshot.listings[0]?.heroAssetId ?? null, snapshot.code);
  const contactPhoneHref = snapshot.contact.phone
    ? `tel:${snapshot.contact.phone}`
    : null;
  const contactEmailHref = snapshot.contact.email
    ? `mailto:${snapshot.contact.email}`
    : null;

  return (
    <main className="listing-studio-collection-share-app">
      <div className="listing-studio-collection-share-phone">
        <section
          className="listing-studio-collection-share-hero"
          style={
            heroImageSrc
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(26, 21, 16, 0.58), rgba(26, 21, 16, 0.12) 42%, rgba(26, 21, 16, 0.82)), url("${heroImageSrc}")`,
                }
              : undefined
          }
        >
          <header className="listing-studio-collection-share-topbar">
            <strong>ACRE</strong>
            <span>Shared Collection</span>
          </header>

          <div className="listing-studio-collection-share-hero-copy">
            <div className="listing-studio-collection-share-kicker">
              <span />
              <small>Curated for you</small>
              <span />
            </div>
            <h1>{snapshot.name}</h1>
            <p>
              {snapshot.listingCount} handpicked propert
              {snapshot.listingCount === 1 ? "y" : "ies"} in New York
            </p>
          </div>

          <div className="listing-studio-collection-share-agent-card">
            <div className="listing-studio-collection-share-agent-avatar">
              {snapshot.contact.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{snapshot.contact.name}</strong>
              <span>{snapshot.contact.title}</span>
            </div>
            <div className="listing-studio-collection-share-agent-actions">
              {contactPhoneHref ? <a href={contactPhoneHref}>Call</a> : null}
              {contactEmailHref ? <a href={contactEmailHref}>Email</a> : null}
            </div>
          </div>

          <div className="listing-studio-collection-share-scroll-cue">
            <span>Scroll</span>
            <i aria-hidden="true">⌄</i>
          </div>
        </section>

        <section className="listing-studio-collection-share-listings">
          <header className="listing-studio-collection-share-listings-head">
            <span>{snapshot.listingCount}</span>
            <div>
              <p>Properties</p>
              <h2>Selected for you</h2>
            </div>
          </header>

          <div className="listing-studio-collection-share-list">
            {snapshot.listings.length ? (
              snapshot.listings.map((listing, index) => {
                const assetSrc = buildAssetSrc(listing.heroAssetId, snapshot.code);
                const facts = getFacts(listing.factsLine);
                const listingTypeLabel = formatListingTypeLabel(listing.listingType);

                return (
                  <article
                    className="listing-studio-collection-share-property"
                    key={listing.packId}
                  >
                    <header className="listing-studio-collection-share-property-head">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3>{listing.displayTitle || listing.addressLine}</h3>
                        <p>{listing.locationLine}</p>
                      </div>
                    </header>

                    <a
                      className="listing-studio-collection-share-property-media"
                      href={listing.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {assetSrc ? (
                        <img
                          alt={listing.displayTitle || listing.addressLine}
                          src={assetSrc}
                        />
                      ) : (
                        <div className="listing-studio-collection-share-property-empty">
                          {formatSourceSiteLabel(listing.sourceSite)}
                        </div>
                      )}
                      <div className="listing-studio-collection-share-property-badges">
                        <span>{formatSourceSiteLabel(listing.sourceSite)}</span>
                        {listingTypeLabel ? <span>{listingTypeLabel}</span> : null}
                      </div>
                      <strong>{listing.priceLabel}</strong>
                    </a>

                    <div className="listing-studio-collection-share-property-body">
                      <div className="listing-studio-collection-share-property-facts">
                        {facts.map((fact) => (
                          <span key={fact}>{fact}</span>
                        ))}
                      </div>
                      <a
                        className="listing-studio-collection-share-property-link"
                        href={listing.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View Details
                      </a>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="listing-studio-collection-share-empty">
                This shared collection is empty right now.
              </div>
            )}
          </div>
        </section>

        <footer className="listing-studio-collection-share-footer">
          <div className="listing-studio-collection-share-footer-avatar">
            {snapshot.contact.name.slice(0, 1).toUpperCase()}
          </div>
          <h2>{snapshot.contact.name}</h2>
          <p>{snapshot.contact.title}</p>
          <div className="listing-studio-collection-share-footer-actions">
            {contactPhoneHref ? <a href={contactPhoneHref}>Call</a> : null}
            {contactEmailHref ? <a href={contactEmailHref}>Email</a> : null}
          </div>
          <a
            className="listing-studio-collection-share-schedule"
            href={contactEmailHref ?? contactPhoneHref ?? "#"}
          >
            Schedule a Viewing
          </a>
          <small>Powered by ACRE Listing System · Updated {formatUpdatedLabel(snapshot.updatedAt)}</small>
        </footer>
      </div>
    </main>
  );
}
