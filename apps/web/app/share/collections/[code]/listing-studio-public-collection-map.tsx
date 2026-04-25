"use client";

import type { StudioListingPublicCollectionSnapshot } from "@acre/db";
import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "../../../../lib/i18n/client";

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

type CoordinateGroup = {
  key: string;
  latitude: number;
  longitude: number;
  listings: MapListing[];
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

function buildCoordinateGroups(listings: MapListing[]) {
  const groupMap = new Map<string, CoordinateGroup>();

  listings.forEach((listing) => {
    const key = getCoordinateKey(listing);
    const existingGroup = groupMap.get(key);

    if (existingGroup) {
      existingGroup.listings.push(listing);
      return;
    }

    groupMap.set(key, {
      key,
      latitude: listing.latitude,
      longitude: listing.longitude,
      listings: [listing],
    });
  });

  return Array.from(groupMap.values());
}

function getCoordinateGroupLabel(group: CoordinateGroup) {
  return group.listings
    .map((listing) => String(listing.collectionIndex + 1))
    .join("/");
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

  const markers = buildCoordinateGroups(listings).map((group) => ({
    group,
    left: longitudeToTileX(group.longitude, zoom) * TILE_SIZE - viewportLeft,
    top: latitudeToTileY(group.latitude, zoom) * TILE_SIZE - viewportTop,
  }));

  return {
    markers,
    tiles,
  };
}

function createListingMarker(
  googleMaps: any,
  map: any,
  group: CoordinateGroup,
  isZh: boolean,
) {
  return new googleMaps.maps.Marker({
    map,
    position: {
      lat: group.latitude,
      lng: group.longitude,
    },
    label: {
      text: getCoordinateGroupLabel(group),
      color: "#ffffff",
      fontWeight: "800",
      fontSize: group.listings.length > 1 ? "10px" : "12px",
    },
    title:
      group.listings.length > 1
        ? isZh
          ? `这里有 ${group.listings.length} 套房源`
          : `${group.listings.length} properties at this location`
        : group.listings[0]?.displayTitle || group.listings[0]?.addressLine,
    icon: {
      path: googleMaps.maps.SymbolPath.CIRCLE,
      scale: group.listings.length > 1 ? 19 : 15,
      fillColor: "#2f5598",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });
}

function createInfoWindowContent(
  group: CoordinateGroup,
  onOpenListing: (packId: string) => void,
  isZh: boolean,
) {
  const root = document.createElement("div");
  root.className = "listing-studio-collection-share-map-popover";

  const eyebrow = document.createElement("span");
  eyebrow.textContent =
    group.listings.length > 1
      ? isZh
        ? `这里有 ${group.listings.length} 套房源`
        : `${group.listings.length} properties here`
      : isZh
        ? `房源 ${(group.listings[0]?.collectionIndex ?? 0) + 1}`
        : `Property ${(group.listings[0]?.collectionIndex ?? 0) + 1}`;
  root.appendChild(eyebrow);

  const title = document.createElement("strong");
  title.textContent =
    group.listings.length > 1
      ? getCoordinateGroupLabel(group)
      : group.listings[0]?.displayTitle || group.listings[0]?.addressLine || "";
  root.appendChild(title);

  const address = document.createElement("p");
  address.textContent =
    group.listings[0]?.locationLine || group.listings[0]?.addressLine || "";
  root.appendChild(address);

  group.listings.forEach((listing) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${String(listing.collectionIndex + 1).padStart(2, "0")} ${listing.displayTitle || listing.addressLine} · ${listing.priceLabel}`;
    button.addEventListener("click", () => onOpenListing(listing.packId));
    root.appendChild(button);
  });

  return root;
}

function ListingStudioKeylessCollectionMap(props: {
  listings: MapListing[];
  onOpenListing: (packId: string) => void;
  isZh: boolean;
}) {
  const { listings, onOpenListing, isZh } = props;
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<MapViewport>(
    DEFAULT_KEYLESS_MAP_VIEWPORT,
  );
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const mapView = useMemo(
    () => buildKeylessMapView(listings, viewport),
    [listings, viewport],
  );
  const activeMarker = mapView.markers.find(
    (marker) => marker.group.key === activeGroupKey,
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
      aria-label={
        isZh
          ? "所选房源的地图预览"
          : "Map preview showing the selected properties"
      }
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

      {mapView.markers.map(({ group, left, top }) => (
        <button
          aria-label={
            group.listings.length > 1
              ? isZh
                ? `查看这里的 ${group.listings.length} 套房源`
                : `View ${group.listings.length} properties at this location`
              : isZh
                ? `查看 ${group.listings[0]?.displayTitle || group.listings[0]?.addressLine}`
                : `View ${group.listings[0]?.displayTitle || group.listings[0]?.addressLine}`
          }
          className={
            group.listings.length > 1
              ? "listing-studio-collection-share-map-marker is-cluster"
              : "listing-studio-collection-share-map-marker"
          }
          key={group.key}
          onClick={() => {
            if (group.listings.length === 1) {
              const packId = group.listings[0]?.packId;
              if (packId) {
                onOpenListing(packId);
              }
              return;
            }

            setActiveGroupKey((currentKey) =>
              currentKey === group.key ? null : group.key,
            );
          }}
          style={{
            left,
            top,
          }}
          type="button"
        >
          {getCoordinateGroupLabel(group)}
        </button>
      ))}

      {activeMarker ? (
        <div
          className="listing-studio-collection-share-map-cluster-popover"
          style={{
            left: activeMarker.left,
            top: activeMarker.top,
          }}
        >
          <strong>
            {isZh
              ? `这里有 ${activeMarker.group.listings.length} 套房源`
              : `${activeMarker.group.listings.length} properties here`}
          </strong>
          {activeMarker.group.listings.map((listing) => (
            <button
              key={listing.packId}
              onClick={() => onOpenListing(listing.packId)}
              type="button"
            >
              <span>{String(listing.collectionIndex + 1).padStart(2, "0")}</span>
              {listing.displayTitle || listing.addressLine}
            </button>
          ))}
        </div>
      ) : null}

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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
  const fallbackMessage = isZh
    ? "这些房源还没有保存坐标，暂时无法生成地图。"
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
        const coordinateGroups = buildCoordinateGroups(mappedListings);

        if (!infoWindowRef.current) {
          infoWindowRef.current = new googleMaps.maps.InfoWindow({
            maxWidth: 220,
          });
        }

        const bounds = new googleMaps.maps.LatLngBounds();
        listingMarkersRef.current = coordinateGroups.map((group) => {
          bounds.extend({
            lat: group.latitude,
            lng: group.longitude,
          });

          const marker = createListingMarker(
            googleMaps,
            map,
            group,
            isZh,
          );
          marker.addListener("click", () => {
            const content = createInfoWindowContent(
              group,
              (packId) => onOpenListingRef.current(packId),
              isZh,
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
              ? isZh
                ? "地图暂时加载失败。"
                : error.message
              : isZh
                ? "地图暂时加载失败。"
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
  }, [apiKey, isZh, mapSignature, mappedListings]);

  return (
    <section className="listing-studio-collection-share-map" id="map">
      <header className="listing-studio-collection-share-map-head">
        <span>{isZh ? "地图视图" : "Map View"}</span>
        <h2>{isZh ? "房源分布位置" : "Where the properties are"}</h2>
        <p>
          {isZh
            ? "快速查看这组房源在不同街区之间的分布。"
            : "A quick read on the neighborhood spread across this collection."}
          {listingsWithoutCoordinates > 0
            ? isZh
              ? ` 还有 ${listingsWithoutCoordinates} 套房源暂时无法定位。`
              : ` ${listingsWithoutCoordinates} listing${
                  listingsWithoutCoordinates === 1 ? "" : "s"
                } could not be pinned yet.`
            : ""}
        </p>
      </header>

      <div className="listing-studio-collection-share-map-frame">
        {apiKey && mappedListings.length && !mapError ? (
          <div
            aria-label={
              isZh ? "所选房源地图" : "Map showing the selected properties"
            }
            className="listing-studio-collection-share-map-canvas"
            ref={mapRootRef}
          />
        ) : canRenderKeylessMap ? (
          <ListingStudioKeylessCollectionMap
            isZh={isZh}
            listings={mappedListings}
            onOpenListing={onOpenListing}
          />
        ) : (
          <div className="listing-studio-collection-share-map-fallback">
            <strong>{isZh ? "地图暂不可用" : "Map unavailable"}</strong>
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
