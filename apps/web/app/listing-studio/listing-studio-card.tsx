"use client";

import Link from "next/link";
import type { StudioListingListItem } from "@acre/db";
import { StudioCollectionPicker } from "./studio-collection-picker";

type ListingStudioCardProps = {
  item: StudioListingListItem;
  showCollectionPicker?: boolean;
};

function getListingTypeLabel(listingType: string | null) {
  const normalized = listingType?.trim().toLowerCase();
  if (normalized === "sale") {
    return "For sale";
  }
  if (normalized === "rent") {
    return "Rental";
  }
  return null;
}

export function ListingStudioCard({
  item,
  showCollectionPicker = false,
}: ListingStudioCardProps) {
  const listingTypeLabel = getListingTypeLabel(item.listingType);

  return (
    <article className="listing-studio-card">
      <Link
        className="listing-studio-card-link"
        href={`/listing-studio/listings/${item.packId}`}
      >
        <div className="listing-studio-card-media">
          {listingTypeLabel ? (
            <span className="listing-studio-card-media-badge">{listingTypeLabel}</span>
          ) : null}
          {item.heroAssetId ? (
            <img
              alt={item.displayTitle || item.addressLine}
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
          {item.displayTitle ? (
            <span className="listing-studio-card-title">{item.displayTitle}</span>
          ) : null}
          <span className="listing-studio-card-address">{item.addressLine}</span>
          {item.locationLine ? (
            <span className="listing-studio-card-location">{item.locationLine}</span>
          ) : null}
          <span className="listing-studio-card-facts">{item.factsLine}</span>
          {item.statusLabel ? (
            <span className="listing-studio-card-status">{item.statusLabel}</span>
          ) : null}
        </div>
      </Link>

      {showCollectionPicker ? (
        <div className="listing-studio-card-footer">
          <StudioCollectionPicker
            buttonLabel="Add to collection"
            packId={item.packId}
          />
        </div>
      ) : null}
    </article>
  );
}
