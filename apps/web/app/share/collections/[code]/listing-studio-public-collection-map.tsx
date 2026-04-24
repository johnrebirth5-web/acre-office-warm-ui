"use client";

import type { StudioListingPublicCollectionSnapshot } from "@acre/db";
import { useEffect, useMemo, useRef, useState } from "react";

type PublicCollectionListing =
  StudioListingPublicCollectionSnapshot["listings"][number];

type ListingStudioPublicCollectionMapProps = {
  listings: PublicCollectionListing[];
  onOpenListing: (packId: string) => void;
};

type MapListing = PublicCollectionListing & {
  collectionIndex: number;
  latitude: number;
  longitude: number;
};

declare global {
  interface Window {
    __acreGoogleMapsPromise?: Promise<any>;
    google?: any;
  }
}

function getGoogleMapsKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
}

function loadGoogleMapsApi(apiKey: string) {
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is missing."));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (!window.__acreGoogleMapsPromise) {
    window.__acreGoogleMapsPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-acre-google-maps="true"]',
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.google));
        existingScript.addEventListener("error", () =>
          reject(new Error("Unable to load Google Maps.")),
        );
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        apiKey,
      )}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset.acreGoogleMaps = "true";
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error("Unable to load Google Maps."));
      document.head.appendChild(script);
    });
  }

  return window.__acreGoogleMapsPromise;
}

function getCollectionCenter(listings: MapListing[]) {
  const totals = listings.reduce(
    (accumulator, listing) => ({
      latitude: accumulator.latitude + listing.latitude,
      longitude: accumulator.longitude + listing.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: totals.latitude / listings.length,
    longitude: totals.longitude / listings.length,
  };
}

function createListingMarker(
  googleMaps: any,
  map: any,
  listing: MapListing,
) {
  return new googleMaps.maps.Marker({
    map,
    position: {
      lat: listing.latitude,
      lng: listing.longitude,
    },
    label: {
      text: String(listing.collectionIndex + 1),
      color: "#ffffff",
      fontWeight: "800",
      fontSize: "12px",
    },
    title: listing.displayTitle || listing.addressLine,
    icon: {
      path: googleMaps.maps.SymbolPath.CIRCLE,
      scale: 15,
      fillColor: "#2f5598",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });
}

function createInfoWindowContent(
  listing: MapListing,
  onOpenListing: (packId: string) => void,
) {
  const root = document.createElement("div");
  root.className = "listing-studio-collection-share-map-popover";

  const eyebrow = document.createElement("span");
  eyebrow.textContent = `Property ${listing.collectionIndex + 1}`;
  root.appendChild(eyebrow);

  const title = document.createElement("strong");
  title.textContent = listing.displayTitle || listing.addressLine;
  root.appendChild(title);

  const address = document.createElement("p");
  address.textContent = listing.locationLine || listing.addressLine;
  root.appendChild(address);

  const price = document.createElement("small");
  price.textContent = listing.priceLabel;
  root.appendChild(price);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "View Details";
  button.addEventListener("click", () => onOpenListing(listing.packId));
  root.appendChild(button);

  return root;
}

export function ListingStudioPublicCollectionMap({
  listings,
  onOpenListing,
}: ListingStudioPublicCollectionMapProps) {
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const listingMarkersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const onOpenListingRef = useRef(onOpenListing);
  const [mapError, setMapError] = useState("");
  const apiKey = getGoogleMapsKey();

  useEffect(() => {
    onOpenListingRef.current = onOpenListing;
  }, [onOpenListing]);

  const mappedListings = useMemo(
    () =>
      listings
        .map((listing, collectionIndex) => ({ ...listing, collectionIndex }))
        .filter(
          (listing): listing is MapListing =>
            typeof listing.latitude === "number" &&
            Number.isFinite(listing.latitude) &&
            typeof listing.longitude === "number" &&
            Number.isFinite(listing.longitude),
        ),
    [listings],
  );

  const listingsWithoutCoordinates = listings.length - mappedListings.length;
  const fallbackMessage = !apiKey
    ? "Map unavailable because Google Maps is not configured yet."
    : "No saved coordinates were found for these listings yet.";

  const mapSignature = useMemo(
    () =>
      mappedListings
        .map(
          (listing) =>
            `${listing.packId}:${listing.collectionIndex}:${listing.latitude}:${listing.longitude}`,
        )
        .join("|"),
    [mappedListings],
  );

  useEffect(() => {
    if (!apiKey || !mappedListings.length || !mapRootRef.current) {
      return;
    }

    let isCancelled = false;

    async function renderMap() {
      setMapError("");

      try {
        const googleMaps = await loadGoogleMapsApi(apiKey);
        if (isCancelled || !mapRootRef.current) {
          return;
        }

        const center = getCollectionCenter(mappedListings);

        if (!mapRef.current) {
          mapRef.current = new googleMaps.maps.Map(mapRootRef.current, {
            center: {
              lat: center.latitude,
              lng: center.longitude,
            },
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });
        }

        const map = mapRef.current;
        listingMarkersRef.current.forEach((marker) => marker.setMap(null));
        listingMarkersRef.current = [];

        if (!infoWindowRef.current) {
          infoWindowRef.current = new googleMaps.maps.InfoWindow({
            maxWidth: 220,
          });
        }

        const bounds = new googleMaps.maps.LatLngBounds();
        listingMarkersRef.current = mappedListings.map((listing) => {
          bounds.extend({
            lat: listing.latitude,
            lng: listing.longitude,
          });

          const marker = createListingMarker(googleMaps, map, listing);
          marker.addListener("click", () => {
            const content = createInfoWindowContent(listing, (packId) =>
              onOpenListingRef.current(packId),
            );
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open({
              anchor: marker,
              map,
            });
          });
          return marker;
        });

        if (mappedListings.length === 1) {
          map.setCenter({
            lat: center.latitude,
            lng: center.longitude,
          });
          map.setZoom(14);
        } else {
          map.fitBounds(bounds, 54);
        }
      } catch (error) {
        if (!isCancelled) {
          setMapError(
            error instanceof Error
              ? error.message
              : "Unable to load the collection map.",
          );
        }
      }
    }

    void renderMap();

    return () => {
      isCancelled = true;
      listingMarkersRef.current.forEach((marker) => marker.setMap(null));
      listingMarkersRef.current = [];
    };
  }, [apiKey, mapSignature, mappedListings]);

  return (
    <section className="listing-studio-collection-share-map" id="map">
      <header className="listing-studio-collection-share-map-head">
        <span>Map View</span>
        <h2>Where the properties are</h2>
        <p>
          A quick read on the neighborhood spread across this collection.
          {listingsWithoutCoordinates > 0
            ? ` ${listingsWithoutCoordinates} listing${
                listingsWithoutCoordinates === 1 ? "" : "s"
              } could not be pinned yet.`
            : ""}
        </p>
      </header>

      <div className="listing-studio-collection-share-map-frame">
        {apiKey && mappedListings.length && !mapError ? (
          <div
            aria-label="Map showing the selected properties"
            className="listing-studio-collection-share-map-canvas"
            ref={mapRootRef}
          />
        ) : (
          <div className="listing-studio-collection-share-map-fallback">
            <strong>Map unavailable</strong>
            <p>{mapError || fallbackMessage}</p>
          </div>
        )}
      </div>

      {mappedListings.length ? (
        <div className="listing-studio-collection-share-map-list">
          {mappedListings.map((listing) => (
            <button
              key={listing.packId}
              onClick={() => onOpenListing(listing.packId)}
              type="button"
            >
              <span>{String(listing.collectionIndex + 1).padStart(2, "0")}</span>
              <strong>{listing.displayTitle || listing.addressLine}</strong>
              <small>{listing.priceLabel}</small>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
