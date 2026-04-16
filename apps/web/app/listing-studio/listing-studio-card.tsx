"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConfirmActionDialog } from "@acre/ui";
import { startTransition, useState } from "react";
import type { StudioListingListItem } from "@acre/db";
import { StudioCollectionPicker } from "./studio-collection-picker";

type ListingStudioCardProps = {
  item: StudioListingListItem;
  showCollectionPicker?: boolean;
  showDeleteAction?: boolean;
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

function IconTrash() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 4.75h6m-8 3h10m-8.5 0 .55 9.2a1 1 0 0 0 1 .94h3.9a1 1 0 0 0 1-.94l.55-9.2M10 11.25v4.5m4-4.5v4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ListingStudioCard({
  item,
  showCollectionPicker = false,
  showDeleteAction = false,
}: ListingStudioCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listingTypeLabel = getListingTypeLabel(item.listingType);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  if (isDeleted) {
    return null;
  }

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/listing-studio/listings/${item.packId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to delete this listing.");
      }

      setIsDeleteDialogOpen(false);
      setIsDeleted(true);

      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set("deleted", "1");
      const nextQuery = nextSearchParams.toString();

      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
        router.refresh();
      });
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to delete this listing.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="listing-studio-card">
      {showDeleteAction ? (
        <div className="listing-studio-card-top-actions">
          <button
            aria-label={`Delete ${item.displayTitle || item.addressLine}`}
            className="listing-studio-card-delete-button"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDeleteDialogOpen(true);
            }}
            title="Delete listing"
            type="button"
          >
            <IconTrash />
          </button>
        </div>
      ) : null}

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

      <ConfirmActionDialog
        cancelLabel="Keep listing"
        confirmLabel={isDeleting ? "Deleting..." : "Delete listing"}
        confirmVariant="danger"
        description="This will permanently remove the saved packet, its imported assets, and its collection memberships."
        isOpen={isDeleteDialogOpen}
        onCancel={() => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
        title={`Delete ${item.displayTitle || item.addressLine}?`}
      >
        <p>This action cannot be undone.</p>
      </ConfirmActionDialog>
    </article>
  );
}
