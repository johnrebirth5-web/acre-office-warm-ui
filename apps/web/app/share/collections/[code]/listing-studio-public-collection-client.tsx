"use client";

import type { StudioListingPublicCollectionSnapshot } from "@acre/db";
import { useEffect, useMemo, useState } from "react";

type PublicCollectionSnapshot = StudioListingPublicCollectionSnapshot;
type PublicCollectionListing = PublicCollectionSnapshot["listings"][number];

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

function getGalleryAssetIds(listing: PublicCollectionListing) {
  const orderedIds = [
    listing.heroAssetId,
    ...listing.selectedAssets
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((asset) => asset.id),
  ];

  return Array.from(new Set(orderedIds.filter(Boolean))) as string[];
}

function getFactValue(
  listing: PublicCollectionListing,
  patterns: RegExp[],
  fallbackIndex: number,
) {
  const matched = listing.facts.find((fact) =>
    patterns.some((pattern) => pattern.test(fact.label)),
  );

  if (matched?.value) {
    return matched.value;
  }

  return getFacts(listing.factsLine)[fallbackIndex] ?? "-";
}

function getAmenities(listing: PublicCollectionListing) {
  return listing.amenities.flatMap((section) => section.items).slice(0, 8);
}

function ListingStudioCollectionDetailView(props: {
  snapshot: PublicCollectionSnapshot;
  listing: PublicCollectionListing;
  onBack: () => void;
}) {
  const { listing, onBack, snapshot } = props;
  const galleryAssetIds = useMemo(() => getGalleryAssetIds(listing), [listing]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const currentAssetId = galleryAssetIds[currentImageIndex] ?? null;
  const currentImageSrc = buildAssetSrc(currentAssetId, snapshot.code);
  const contactPhoneHref = snapshot.contact.phone
    ? `tel:${snapshot.contact.phone}`
    : null;
  const contactEmailHref = snapshot.contact.email
    ? `mailto:${snapshot.contact.email}`
    : null;
  const beds = getFactValue(listing, [/bed/i], 0);
  const baths = getFactValue(listing, [/bath/i], 1);
  const sqft = getFactValue(listing, [/sqft|square/i], 2);
  const amenities = getAmenities(listing);
  const listingTypeLabel = formatListingTypeLabel(listing.listingType);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [listing.packId]);

  return (
    <div className="listing-studio-collection-share-detail">
      <header className="listing-studio-collection-share-detail-header">
        <button type="button" onClick={onBack}>
          <span aria-hidden="true">{"<"}</span>
          Back to Collection
        </button>
        <strong>ACRE</strong>
      </header>

      <div className="listing-studio-collection-share-detail-body">
        {listing.agentNote ? (
          <section className="listing-studio-collection-share-detail-note">
            <span aria-hidden="true">"</span>
            <p>{listing.agentNote}</p>
            <small>Note from {snapshot.contact.name}</small>
          </section>
        ) : null}

        <section className="listing-studio-collection-share-detail-gallery">
          <div className="listing-studio-collection-share-detail-image">
            {currentImageSrc ? (
              <img
                alt={listing.displayTitle || listing.addressLine}
                src={currentImageSrc}
              />
            ) : (
              <div>{formatSourceSiteLabel(listing.sourceSite)}</div>
            )}
            <span>
              {galleryAssetIds.length ? currentImageIndex + 1 : 0} /{" "}
              {galleryAssetIds.length}
            </span>
          </div>

          {galleryAssetIds.length > 1 ? (
            <div className="listing-studio-collection-share-detail-thumbs">
              {galleryAssetIds.map((assetId, index) => (
                <button
                  aria-label={`View photo ${index + 1}`}
                  className={
                    index === currentImageIndex
                      ? "is-active"
                      : undefined
                  }
                  key={assetId}
                  onClick={() => setCurrentImageIndex(index)}
                  type="button"
                >
                  <img
                    alt=""
                    src={`/api/listing-studio/assets/${assetId}?shareCode=${snapshot.code}`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="listing-studio-collection-share-detail-copy">
          <div className="listing-studio-collection-share-detail-badges">
            <span>{formatSourceSiteLabel(listing.sourceSite)}</span>
            {listingTypeLabel ? <span>{listingTypeLabel}</span> : null}
          </div>
          <h1>{listing.priceLabel}</h1>
          <h2>{listing.displayTitle || listing.addressLine}</h2>
          <p>{listing.addressLine}</p>
          {listing.locationLine ? <p>{listing.locationLine}</p> : null}
        </section>

        <section className="listing-studio-collection-share-detail-specs">
          <div>
            <strong>{beds}</strong>
            <span>Beds</span>
          </div>
          <div>
            <strong>{baths}</strong>
            <span>Baths</span>
          </div>
          <div>
            <strong>{sqft}</strong>
            <span>Sq Ft</span>
          </div>
        </section>

        {listing.descriptionText ? (
          <section className="listing-studio-collection-share-detail-section">
            <h3>About this home</h3>
            <p>{listing.descriptionText}</p>
          </section>
        ) : null}

        {amenities.length ? (
          <section className="listing-studio-collection-share-detail-section">
            <h3>Building Amenities</h3>
            <div className="listing-studio-collection-share-detail-amenities">
              {amenities.map((amenity) => (
                <span key={amenity}>{amenity}</span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="listing-studio-collection-share-detail-info">
          <div>
            <span>Building</span>
            <strong>{listing.buildingName || listing.displayTitle || "-"}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{listing.statusLabel || listingTypeLabel || "-"}</strong>
          </div>
        </section>

        <section className="listing-studio-collection-share-detail-contact">
          <div className="listing-studio-collection-share-footer-avatar">
            {snapshot.contact.name.slice(0, 1).toUpperCase()}
          </div>
          <h3>Interested in this property?</h3>
          <p>Contact {snapshot.contact.name} to schedule a private viewing.</p>
          <div>
            {contactPhoneHref ? <a href={contactPhoneHref}>Call</a> : null}
            {contactEmailHref ? <a href={contactEmailHref}>Email</a> : null}
          </div>
          <a href={contactEmailHref ?? contactPhoneHref ?? "#"}>
            Schedule a Viewing
          </a>
        </section>
      </div>
    </div>
  );
}

export function ListingStudioPublicCollectionClient(props: {
  snapshot: PublicCollectionSnapshot;
}) {
  const { snapshot } = props;
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const selectedListing =
    snapshot.listings.find((listing) => listing.packId === selectedPackId) ??
    null;
  const heroImageSrc = buildAssetSrc(snapshot.listings[0]?.heroAssetId ?? null, snapshot.code);
  const contactPhoneHref = snapshot.contact.phone
    ? `tel:${snapshot.contact.phone}`
    : null;
  const contactEmailHref = snapshot.contact.email
    ? `mailto:${snapshot.contact.email}`
    : null;

  function openListing(packId: string) {
    setSelectedPackId(packId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeListing() {
    setSelectedPackId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (selectedListing) {
    return (
      <main className="listing-studio-collection-share-app">
        <div className="listing-studio-collection-share-phone">
          <ListingStudioCollectionDetailView
            listing={selectedListing}
            onBack={closeListing}
            snapshot={snapshot}
          />
        </div>
      </main>
    );
  }

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

                    <button
                      className="listing-studio-collection-share-property-media"
                      onClick={() => openListing(listing.packId)}
                      type="button"
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
                    </button>

                    <div className="listing-studio-collection-share-property-body">
                      <div className="listing-studio-collection-share-property-facts">
                        {facts.map((fact) => (
                          <span key={fact}>{fact}</span>
                        ))}
                      </div>
                      <button
                        className="listing-studio-collection-share-property-link"
                        onClick={() => openListing(listing.packId)}
                        type="button"
                      >
                        View Details
                      </button>
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
