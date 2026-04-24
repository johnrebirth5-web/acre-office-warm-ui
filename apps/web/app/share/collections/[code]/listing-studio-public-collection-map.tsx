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

type MapViewport = {
  width: number;
  height: number;
};

type MapTile = {
  key: string;
  src: string;
  left: number;
  top: number;
};

type CoordinateOverlap = {
  overlapIndex: number;
  overlapCount: number;
};

declare global {
  interface Window {
    __acreGoogleMapsPromise?: Promise<any>;
    google?: any;
  }
}

const TILE_SIZE = 256;
const DEFAULT_KEYLESS_MAP_VIEWPORT: MapViewport = {
  width: 360,
  height: 312,
};
const METERS_PER_LATITUDE_DEGREE = 111_320;

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

function getCoordinateKey(listing: MapListing) {
  return `${listing.latitude.toFixed(6)}:${listing.longitude.toFixed(6)}`;
}

function buildCoordinateOverlapMap(listings: MapListing[]) {
  const coordinateCounts = new Map<string, number>();
  const coordinateIndexes = new Map<string, number>();
  const overlapMap = new Map<string, CoordinateOverlap>();

  listings.forEach((listing) => {
    const coordinateKey = getCoordinateKey(listing);
    coordinateCounts.set(
      coordinateKey,
      (coordinateCounts.get(coordinateKey) ?? 0) + 1,
    );
  });

  listings.forEach((listing) => {
    const coordinateKey = getCoordinateKey(listing);
    const overlapIndex = coordinateIndexes.get(coordinateKey) ?? 0;
    coordinateIndexes.set(coordinateKey, overlapIndex + 1);
    overlapMap.set(listing.packId, {
      overlapIndex,
      overlapCount: coordinateCounts.get(coordinateKey) ?? 1,
    });
  });

  return overlapMap;
}

function getMarkerPixelOffset(overlap: CoordinateOverlap) {
  if (overlap.overlapCount <= 1) {
    return { x: 0, y: 0 };
  }

  const radius = Math.min(42, Math.max(28, 20 + overlap.overlapCount * 4));
  const angle =
    (2 * Math.PI * overlap.overlapIndex) / overlap.overlapCount -
    Math.PI / 2;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function getMarkerGeographicPosition(
  listing: MapListing,
  overlap: CoordinateOverlap,
) {
  if (overlap.overlapCount <= 1) {
    return {
      lat: listing.latitude,
      lng: listing.longitude,
    };
  }

  const pixelOffset = getMarkerPixelOffset(overlap);
  const metersPerLongitudeDegree =
    METERS_PER_LATITUDE_DEGREE *
    Math.cos((clampLatitude(listing.latitude) * Math.PI) / 180);
  const scale = 0.9;

  return {
    lat: listing.latitude - (pixelOffset.y * scale) / METERS_PER_LATITUDE_DEGREE,
    lng:
      listing.longitude +
      (pixelOffset.x * scale) / Math.max(metersPerLongitudeDegree, 1),
  };
}

function clampLatitude(latitude: number) {
  return Math.min(Math.max(latitude, -85.05112878), 85.05112878);
}

function longitudeToTileX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(latitude: number, zoom: number) {
  const latitudeRadians = (clampLatitude(latitude) * Math.PI) / 180;

  return (
    ((1 -
      Math.log(
        Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians),
      ) /
        Math.PI) /
      2) *
    2 ** zoom
  );
}

function getKeylessMapZoom(listings: MapListing[], viewport: MapViewport) {
  if (listings.length <= 1) {
    return 15;
  }

  for (let zoom = 16; zoom >= 10; zoom -= 1) {
    const tileXs = listings.map((listing) =>
      longitudeToTileX(listing.longitude, zoom),
    );
    const tileYs = listings.map((listing) =>
      latitudeToTileY(listing.latitude, zoom),
    );
    const pixelWidth =
      (Math.max(...tileXs) - Math.min(...tileXs)) * TILE_SIZE;
    const pixelHeight =
      (Math.max(...tileYs) - Math.min(...tileYs)) * TILE_SIZE;

    if (
      pixelWidth <= viewport.width * 0.72 &&
      pixelHeight <= viewport.height * 0.72
    ) {
      return zoom;
    }
  }

  return 10;
}

function buildKeylessMapView(listings: MapListing[], viewport: MapViewport) {
  const center = getCollectionCenter(listings);
  const zoom = getKeylessMapZoom(listings, viewport);
  const tilesPerAxis = 2 ** zoom;
  const centerPixelX = longitudeToTileX(center.longitude, zoom) * TILE_SIZE;
  const centerPixelY = latitudeToTileY(center.latitude, zoom) * TILE_SIZE;
  const viewportLeft = centerPixelX - viewport.width / 2;
  const viewportTop = centerPixelY - viewport.height / 2;
  const firstTileX = Math.floor(viewportLeft / TILE_SIZE) - 1;
  const lastTileX =
    Math.floor((viewportLeft + viewport.width) / TILE_SIZE) + 1;
  const firstTileY = Math.floor(viewportTop / TILE_SIZE) - 1;
  const lastTileY =
    Math.floor((viewportTop + viewport.height) / TILE_SIZE) + 1;
  const tiles: MapTile[] = [];

  for (let x = firstTileX; x <= lastTileX; x += 1) {
    for (let y = firstTileY; y <= lastTileY; y += 1) {
      if (y < 0 || y >= tilesPerAxis) {
        continue;
      }

      const wrappedX = ((x % tilesPerAxis) + tilesPerAxis) % tilesPerAxis;
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: x * TILE_SIZE - viewportLeft,
        top: y * TILE_SIZE - viewportTop,
      });
    }
  }

  const overlapMap = buildCoordinateOverlapMap(listings);
  const markers = listings.map((listing) => ({
    listing,
    ...getMarkerPixelOffset(
      overlapMap.get(listing.packId) ?? {
        overlapIndex: 0,
        overlapCount: 1,
      },
    ),
  })).map((marker) => ({
    listing: marker.listing,
    left:
      longitudeToTileX(marker.listing.longitude, zoom) * TILE_SIZE -
      viewportLeft +
      marker.x,
    top:
      latitudeToTileY(marker.listing.latitude, zoom) * TILE_SIZE -
      viewportTop +
      marker.y,
  }));

  return {
    markers,
    tiles,
  };
}

function createListingMarker(
  googleMaps: any,
  map: any,
  listing: MapListing,
  overlap: CoordinateOverlap,
) {
  return new googleMaps.maps.Marker({
    map,
    position: getMarkerGeographicPosition(listing, overlap),
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

function ListingStudioKeylessCollectionMap(props: {
  listings: MapListing[];
  onOpenListing: (packId: string) => void;
}) {
  const { listings, onOpenListing } = props;
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<MapViewport>(
    DEFAULT_KEYLESS_MAP_VIEWPORT,
  );
  const mapView = useMemo(
    () => buildKeylessMapView(listings, viewport),
    [listings, viewport],
  );

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const updateViewport = () => {
      if (!mapRef.current) {
        return;
      }

      const rect = mapRef.current.getBoundingClientRect();
      setViewport({
        width: Math.max(Math.round(rect.width), 280),
        height: Math.max(Math.round(rect.height), 280),
      });
    };

    updateViewport();

    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      aria-label="Map preview showing the selected properties"
      className="listing-studio-collection-share-map-canvas listing-studio-collection-share-map-tiles"
      ref={mapRef}
    >
      {mapView.tiles.map((tile) => (
        <img
          alt=""
          aria-hidden="true"
          className="listing-studio-collection-share-map-tile"
          key={tile.key}
          src={tile.src}
          style={{
            left: tile.left,
            top: tile.top,
          }}
        />
      ))}

      {mapView.markers.map(({ listing, left, top }) => (
        <button
          aria-label={`View ${listing.displayTitle || listing.addressLine}`}
          className="listing-studio-collection-share-map-marker"
          key={listing.packId}
          onClick={() => onOpenListing(listing.packId)}
          style={{
            left,
            top,
          }}
          type="button"
        >
          {listing.collectionIndex + 1}
        </button>
      ))}

      <a
        className="listing-studio-collection-share-map-attribution"
        href="https://www.openstreetmap.org/copyright"
        rel="noreferrer"
        target="_blank"
      >
        © OpenStreetMap
      </a>
    </div>
  );
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
  const canRenderKeylessMap = mappedListings.length > 0;
  const fallbackMessage = "No saved coordinates were found for these listings yet.";

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
        const overlapMap = buildCoordinateOverlapMap(mappedListings);

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

          const marker = createListingMarker(
            googleMaps,
            map,
            listing,
            overlapMap.get(listing.packId) ?? {
              overlapIndex: 0,
              overlapCount: 1,
            },
          );
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
        ) : canRenderKeylessMap ? (
          <ListingStudioKeylessCollectionMap
            listings={mappedListings}
            onOpenListing={onOpenListing}
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
