"use client";

import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import type {
  StudioListingCollectionDetail,
  StudioListingListItem,
} from "@acre/db";
import { ListingStudioCard } from "../../listing-studio-card";
import { DeleteCollectionButton } from "../delete-collection-button";
import { ListingStudioCollectionMap } from "./listing-studio-collection-map";

type ListingStudioCollectionDetailClientProps = {
  detail: StudioListingCollectionDetail;
  availableListings: StudioListingListItem[];
};

type CollectionDetailResponse =
  | StudioListingCollectionDetail
  | {
      error?: string;
    }
  | null;

function isCollectionDetail(
  value: CollectionDetailResponse,
): value is StudioListingCollectionDetail {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "listings" in value &&
      Array.isArray(value.listings),
  );
}

function formatRelativeDate(value: string) {
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

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ListingStudioCollectionDetailClient({
  detail,
  availableListings,
}: ListingStudioCollectionDetailClientProps) {
  const [detailState, setDetailState] = useState(detail);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(
    detail.listings.map((item) => item.packId),
  );
  const deferredSearch = useDeferredValue(search);

  const currentPackIds = useMemo(
    () => new Set(detailState.listings.map((item) => item.packId)),
    [detailState.listings],
  );

  const filteredAvailableListings = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return availableListings;
    }

    return availableListings.filter((item) =>
      [item.displayTitle, item.addressLine, item.locationLine, item.priceLabel]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [availableListings, deferredSearch]);

  const pendingSelectionSet = useMemo(
    () => new Set(selectedPackIds),
    [selectedPackIds],
  );

  const hasSelectionChanges = useMemo(() => {
    if (pendingSelectionSet.size !== currentPackIds.size) {
      return true;
    }

    return Array.from(pendingSelectionSet).some((packId) => !currentPackIds.has(packId));
  }, [currentPackIds, pendingSelectionSet]);

  function applyDetailState(nextDetail: StudioListingCollectionDetail) {
    startTransition(() => {
      setDetailState(nextDetail);
      setSelectedPackIds(
        nextDetail.listings.map(
          (item: StudioListingCollectionDetail["listings"][number]) => item.packId,
        ),
      );
    });
  }

  function openManager() {
    setSelectedPackIds(detailState.listings.map((item) => item.packId));
    setSearch("");
    setIsManagerOpen(true);
  }

  function togglePack(packId: string) {
    setSelectedPackIds((current) =>
      current.includes(packId)
        ? current.filter((value) => value !== packId)
        : [...current, packId],
    );
  }

  async function refreshCollection() {
    const response = await fetch(
      `/api/listing-studio/collections/${detailState.id}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as CollectionDetailResponse;

    if (!response.ok || !isCollectionDetail(payload)) {
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? payload.error || "Unable to refresh the collection."
          : "Unable to refresh the collection.",
      );
    }

    applyDetailState(payload);
  }

  async function removeListingFromCollection(packId: string) {
    setStatusMessage("");

    const response = await fetch(
      `/api/listing-studio/collections/${detailState.id}/items/${packId}`,
      {
        method: "DELETE",
      },
    );
    const payload = (await response.json().catch(() => null)) as CollectionDetailResponse;

    if (!response.ok || !isCollectionDetail(payload)) {
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? payload.error || "Unable to remove the listing from this collection."
          : "Unable to remove the listing from this collection.",
      );
    }

    applyDetailState(payload);
    setStatusMessage("Listing removed from this collection.");
  }

  async function saveSelectionChanges() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    const additions = selectedPackIds.filter((packId) => !currentPackIds.has(packId));
    const removals = Array.from(currentPackIds).filter(
      (packId) => !pendingSelectionSet.has(packId),
    );

    try {
      if (additions.length || removals.length) {
        await Promise.all([
          ...additions.map(async (packId) => {
            const response = await fetch(
              `/api/listing-studio/collections/${detailState.id}/items`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ packId }),
              },
            );
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as
                | { error?: string }
                | null;
              throw new Error(
                payload?.error || "Unable to add listings to the collection.",
              );
            }
          }),
          ...removals.map(async (packId) => {
            const response = await fetch(
              `/api/listing-studio/collections/${detailState.id}/items/${packId}`,
              {
                method: "DELETE",
              },
            );
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as
                | { error?: string }
                | null;
              throw new Error(
                payload?.error || "Unable to remove listings from the collection.",
              );
            }
          }),
        ]);
      }

      await refreshCollection();
      setIsManagerOpen(false);
      setStatusMessage("Collection listings updated.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the collection.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="listing-studio-collection-detail-page">
      <section className="office-page-header listing-studio-header listing-studio-header-with-actions">
        <div className="office-page-heading">
          <span className="office-eyebrow">Collections</span>
          <h2>{detailState.name}</h2>
          <p>
            {detailState.listingCount} saved listing
            {detailState.listingCount === 1 ? "" : "s"} in this folder. Updated{" "}
            {formatRelativeDate(detailState.updatedAt)}.
          </p>
        </div>

        <div className="office-page-actions listing-studio-header-actions">
          <button
            className="office-button office-button-secondary"
            onClick={openManager}
            type="button"
          >
            Add listings
          </button>
          <DeleteCollectionButton
            collectionId={detailState.id}
            collectionName={detailState.name}
            onError={(message) => setStatusMessage(message)}
          />
        </div>
      </section>

      {statusMessage ? (
        <p className="listing-studio-status-message">{statusMessage}</p>
      ) : null}

      {isManagerOpen ? (
        <section className="listing-studio-collection-manager">
          <div className="listing-studio-collection-manager-header">
            <div>
              <strong>Manage collection listings</strong>
              <p>
                Search all imported Listing Studio packets, then decide which ones
                belong in this collection.
              </p>
            </div>
            <button
              className="office-button office-button-secondary"
              onClick={() => setIsManagerOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          <label className="listing-studio-shell-search">
            <span>Search imported listings</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Address, building, neighborhood, price..."
              value={search}
            />
          </label>

          <div className="listing-studio-collection-option-list">
            {filteredAvailableListings.length ? (
              filteredAvailableListings.map((item) => {
                const isSelected = pendingSelectionSet.has(item.packId);

                return (
                  <button
                    className={cx(
                      "listing-studio-collection-option",
                      isSelected && "is-selected",
                    )}
                    key={item.packId}
                    onClick={() => togglePack(item.packId)}
                    type="button"
                  >
                    <span className="listing-studio-collection-option-check">
                      {isSelected ? "Selected" : "Add"}
                    </span>
                    <div className="listing-studio-collection-option-copy">
                      <strong>{item.displayTitle || item.addressLine}</strong>
                      <span>{item.addressLine}</span>
                      {item.locationLine ? <span>{item.locationLine}</span> : null}
                    </div>
                    <span className="listing-studio-collection-option-price">
                      {item.priceLabel}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="listing-studio-empty-state">
                <strong>No imported listings match this search.</strong>
                <p>Try a broader keyword or clear the search field.</p>
              </div>
            )}
          </div>

          <div className="listing-studio-shell-actions">
            <button
              className="office-button office-button-primary"
              disabled={!hasSelectionChanges || isSaving}
              onClick={() => void saveSelectionChanges()}
              type="button"
            >
              {isSaving ? "Saving..." : "Save collection"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="listing-studio-listed-section">
        <div className="listing-studio-listed-section-head">
          <div>
            <span className="listing-studio-shell-eyebrow">Saved listings</span>
            <h2>{detailState.listingCount ? "Current collection view" : "No listings yet"}</h2>
          </div>
          <p>
            {detailState.listingCount
              ? "Cards stay ordered to match the numbered markers on the map below."
              : "Use Add listings to start grouping imported packets into this collection."}
          </p>
        </div>

        <div className="listing-studio-card-grid">
          {detailState.listings.length ? (
            detailState.listings.map((item) => (
              <ListingStudioCard
                collectionPickerButtonLabel="Manage collections"
                item={item}
                key={item.packId}
                onRemoveFromCollection={removeListingFromCollection}
                removeFromCollectionLabel="Remove from this collection"
                showCollectionPicker
              />
            ))
          ) : (
            <div className="listing-studio-empty-state">
              <strong>This collection is empty.</strong>
              <p>
                Add imported Listing Studio packets to turn this into a client-ready
                neighborhood folder.
              </p>
            </div>
          )}
        </div>
      </section>

      <ListingStudioCollectionMap
        listings={detailState.listings}
        listingsWithoutCoordinates={detailState.listingsWithoutCoordinates}
      />
    </div>
  );
}
