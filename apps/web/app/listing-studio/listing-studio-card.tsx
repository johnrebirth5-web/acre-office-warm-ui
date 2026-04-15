import Link from "next/link";
import type { StudioListingListItem } from "@acre/db";

type ListingStudioCardProps = {
  item: StudioListingListItem;
};

export function ListingStudioCard({ item }: ListingStudioCardProps) {
  return (
    <Link
      className="listing-studio-card"
      href={`/listing-studio/listings/${item.packId}`}
    >
      <div className="listing-studio-card-media">
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
  );
}
