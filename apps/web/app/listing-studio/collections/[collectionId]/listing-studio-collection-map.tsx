"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { StudioListingCollectionListingItem } from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";

type ListingStudioCollectionMapProps = {
  listings: StudioListingCollectionListingItem[];
  listingsWithoutCoordinates: number;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type PoiCategoryId =
  | "all"
  | "supermarket"
  | "subway"
  | "restaurant"
  | "coffee"
  | "nightlife";

type PoiCategory = {
  id: PoiCategoryId;
  requests: Array<{ keyword?: string; type?: string }>;
};

type MapListing = StudioListingCollectionListingItem & {
  latitude: number;
  longitude: number;
};

type PlaceCandidate = {
  place_id?: string;
  name?: string;
  vicinity?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
};

declare global {
  interface Window {
    __acreGoogleMapsPromise?: Promise<any>;
    google?: any;
  }
}

const POI_CATEGORIES: PoiCategory[] = [
  {
    id: "supermarket",
    requests: [{ type: "grocery_or_supermarket" }],
  },
  {
    id: "subway",
    requests: [{ type: "subway_station" }, { type: "transit_station" }],
  },
  {
    id: "restaurant",
    requests: [{ type: "restaurant" }],
  },
  {
    id: "coffee",
    requests: [{ type: "cafe" }],
  },
  {
    id: "nightlife",
    requests: [{ type: "bar" }, { type: "night_club" }],
  },
];

const CATEGORY_TABS: Array<{ id: PoiCategoryId }> = [
  { id: "supermarket" },
  { id: "subway" },
  { id: "restaurant" },
  { id: "coffee" },
  { id: "nightlife" },
  { id: "all" },
];

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

function getEmptyPoiSummary(isZh: boolean) {
  return isZh
    ? "尚未选择周边地点分类。请选择一个分类，在地图上查看附近设施。"
    : "No nearby places selected. Choose a category to show nearby places on the map.";
}

function getMapFallbackMessage(input: { hasApiKey: boolean; isZh: boolean }) {
  if (!input.hasApiKey) {
    return input.isZh
      ? "添加 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 后，即可启用实时地图和周边设施筛选。"
      : "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the live collection map and nearby places filters.";
  }

  return input.isZh
    ? "这个清单还没有保存坐标，因此暂时无法显示地图。"
    : "No saved coordinates were found for this collection yet, so the map can’t be drawn.";
}

function getPoiCategoryLabel(category: PoiCategoryId, isZh: boolean) {
  const labels: Record<PoiCategoryId, { en: string; zh: string }> = {
    all: { en: "All", zh: "全部" },
    supermarket: { en: "Supermarket", zh: "超市" },
    subway: { en: "Subway", zh: "地铁" },
    restaurant: { en: "Restaurant", zh: "餐厅" },
    coffee: { en: "Coffee", zh: "咖啡" },
    nightlife: { en: "Nightlife", zh: "夜生活" },
  };

  return isZh ? labels[category].zh : labels[category].en;
}

function haversineDistanceMeters(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const startLatitude = toRadians(left.latitude);
  const endLatitude = toRadians(right.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function getCollectionRadiusMeters(
  listings: MapListing[],
  center: { latitude: number; longitude: number },
) {
  const furthestDistance = listings.reduce((maxDistance, listing) => {
    return Math.max(
      maxDistance,
      haversineDistanceMeters(center, {
        latitude: listing.latitude,
        longitude: listing.longitude,
      }),
    );
  }, 0);

  return Math.round(Math.min(Math.max(furthestDistance * 1.45, 900), 6000));
}

function nearbySearch(
  service: any,
  googleMaps: any,
  input: {
    center: { latitude: number; longitude: number };
    radiusMeters: number;
    keyword?: string;
    type?: string;
  },
) {
  return new Promise<PlaceCandidate[]>((resolve) => {
    service.nearbySearch(
      {
        location: new googleMaps.maps.LatLng(
          input.center.latitude,
          input.center.longitude,
        ),
        radius: input.radiusMeters,
        keyword: input.keyword,
        type: input.type,
      },
      (results: PlaceCandidate[] | null, status: string) => {
        if (
          status === googleMaps.maps.places.PlacesServiceStatus.OK ||
          status === googleMaps.maps.places.PlacesServiceStatus.ZERO_RESULTS
        ) {
          resolve(results ?? []);
          return;
        }

        resolve([]);
      },
    );
  });
}

function buildPoiRequests(category: PoiCategoryId) {
  if (category === "all") {
    return POI_CATEGORIES.flatMap((entry) => entry.requests);
  }

  return POI_CATEGORIES.find((entry) => entry.id === category)?.requests ?? [];
}

function getPoiSummaryLabel(category: PoiCategoryId, isZh: boolean) {
  if (category === "all") {
    return isZh ? "全部分类的地点" : "places across all categories";
  }

  return isZh ? getPoiCategoryLabel(category, true) : getPoiCategoryLabel(category, false).toLowerCase();
}

function createListingMarker(
  googleMaps: any,
  map: any,
  listing: MapListing,
  index: number,
) {
  return new googleMaps.maps.Marker({
    map,
    position: {
      lat: listing.latitude,
      lng: listing.longitude,
    },
    label: {
      text: String(index + 1),
      color: "#ffffff",
      fontWeight: "700",
      fontSize: "12px",
    },
    title: listing.addressLine,
    icon: {
      path: googleMaps.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: "#21478b",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });
}

function createPoiMarker(googleMaps: any, map: any, place: PlaceCandidate) {
  const latitude = place.geometry?.location?.lat?.();
  const longitude = place.geometry?.location?.lng?.();
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return new googleMaps.maps.Marker({
    map,
    position: {
      lat: latitude,
      lng: longitude,
    },
    title: place.name,
    icon: {
      path: googleMaps.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#111827",
      fillOpacity: 0.95,
      strokeColor: "#ffffff",
      strokeWeight: 1.5,
    },
  });
}

export function ListingStudioCollectionMap({
  listings,
  listingsWithoutCoordinates,
}: ListingStudioCollectionMapProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const listingMarkersRef = useRef<any[]>([]);
  const poiMarkersRef = useRef<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<PoiCategoryId | null>(
    null,
  );
  const [poiSummary, setPoiSummary] = useState(() => getEmptyPoiSummary(isZh));
  const [isPoiLoading, setIsPoiLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const apiKey = getGoogleMapsKey();

  const mappedListings = useMemo(
    () =>
      listings.filter(
        (listing): listing is MapListing =>
          typeof listing.latitude === "number" &&
          typeof listing.longitude === "number",
      ),
    [listings],
  );

  const mapSignature = useMemo(
    () =>
      mappedListings
        .map(
          (listing) =>
            `${listing.packId}:${listing.latitude}:${listing.longitude}`,
        )
        .join("|"),
    [mappedListings],
  );
  const fallbackMessage = getMapFallbackMessage({ hasApiKey: Boolean(apiKey), isZh });

  useEffect(() => {
    if (!mapRootRef.current) {
      return;
    }

    if (!apiKey) {
      setMapError(getMapFallbackMessage({ hasApiKey: false, isZh }));
      return;
    }

    if (!mappedListings.length) {
      setMapError(getMapFallbackMessage({ hasApiKey: true, isZh }));
      return;
    }

    let isCancelled = false;

    async function renderMap() {
      setIsPoiLoading(activeCategory !== null);
      setMapError("");

      try {
        const googleMaps = await loadGoogleMapsApi(apiKey);
        if (isCancelled || !mapRootRef.current) {
          return;
        }

        const center = getCollectionCenter(mappedListings);
        const radiusMeters = getCollectionRadiusMeters(mappedListings, center);

        if (!mapRef.current) {
          mapRef.current = new googleMaps.maps.Map(mapRootRef.current, {
            center: {
              lat: center.latitude,
              lng: center.longitude,
            },
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });
        }

        const map = mapRef.current;
        listingMarkersRef.current.forEach((marker) => marker.setMap(null));
        poiMarkersRef.current.forEach((marker) => marker.setMap(null));
        listingMarkersRef.current = [];
        poiMarkersRef.current = [];

        const bounds = new googleMaps.maps.LatLngBounds();
        listingMarkersRef.current = mappedListings.map((listing, index) => {
          bounds.extend({
            lat: listing.latitude,
            lng: listing.longitude,
          });
          return createListingMarker(googleMaps, map, listing, index);
        });

        if (mappedListings.length === 1) {
          map.setCenter({
            lat: center.latitude,
            lng: center.longitude,
          });
          map.setZoom(14);
        } else {
          map.fitBounds(bounds, 72);
        }

        if (!activeCategory) {
          startTransition(() => {
            setPoiSummary(getEmptyPoiSummary(isZh));
          });
          return;
        }

        const service = new googleMaps.maps.places.PlacesService(map);
        const requests = buildPoiRequests(activeCategory);
        const searchResults = await Promise.all(
          requests.map((request) =>
            nearbySearch(service, googleMaps, {
              center,
              radiusMeters,
              ...request,
            }),
          ),
        );

        if (isCancelled) {
          return;
        }

        const dedupedPlaces = searchResults
          .flat()
          .filter((place) => place.place_id && place.geometry?.location)
          .filter((place, index, source) => {
            return (
              source.findIndex(
                (candidate) => candidate.place_id === place.place_id,
              ) === index
            );
          });

        poiMarkersRef.current = dedupedPlaces
          .map((place) => createPoiMarker(googleMaps, map, place))
          .filter(Boolean);

        startTransition(() => {
          const categoryLabel = getPoiSummaryLabel(activeCategory, isZh);
          setPoiSummary(
            isZh
              ? dedupedPlaces.length
                ? `地图上已显示 ${dedupedPlaces.length} 个附近${categoryLabel}。`
                : `当前视图中没有找到附近${categoryLabel}。`
              : dedupedPlaces.length
                ? `${dedupedPlaces.length} nearby ${categoryLabel} shown on the map.`
                : `No nearby ${categoryLabel} were found in this view.`,
          );
        });
      } catch (error) {
        if (!isCancelled) {
          setMapError(
            !isZh && error instanceof Error
              ? error.message
              : isZh
                ? "暂时无法加载清单地图。"
                : "Unable to load the collection map.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsPoiLoading(false);
        }
      }
    }

    void renderMap();

    return () => {
      isCancelled = true;
    };
  }, [activeCategory, apiKey, isZh, mapSignature, mappedListings]);

  if (!apiKey || !mappedListings.length) {
    return (
      <section className="listing-studio-collection-map-panel">
        <div className="listing-studio-collection-map-header">
          <div>
            <span className="listing-studio-collection-map-eyebrow">
              {isZh ? "清单地图" : "Collection map"}
            </span>
            <h3>{isZh ? "地图暂不可用" : "Map unavailable"}</h3>
          </div>
        </div>
        <div className="listing-studio-collection-map-fallback">
          <p>{mapError || fallbackMessage}</p>
          {listingsWithoutCoordinates > 0 ? (
            <p>
              {isZh
                ? `这个清单里还有 ${listingsWithoutCoordinates} 套房源缺少坐标。`
                : `${listingsWithoutCoordinates} listing${listingsWithoutCoordinates === 1 ? "" : "s"} in this collection are still missing coordinates.`}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="listing-studio-collection-map-panel">
      <div className="listing-studio-collection-map-header">
        <div>
          <span className="listing-studio-collection-map-eyebrow">
            {isZh ? "清单地图" : "Collection map"}
          </span>
          <h3>{isZh ? "房源分布位置" : "Where these listings cluster"}</h3>
        </div>
        <p>
          {isZh
            ? listingsWithoutCoordinates > 0
              ? `还有 ${listingsWithoutCoordinates} 套已保存房源暂时无法标到地图上。`
              : "这个清单里的已保存房源都已显示在地图上。"
            : listingsWithoutCoordinates > 0
              ? `${listingsWithoutCoordinates} saved listing${listingsWithoutCoordinates === 1 ? "" : "s"} could not be pinned on the map yet.`
              : "All saved listings in this collection are plotted on the map."}
        </p>
      </div>

      <div
        aria-label={isZh ? "周边地点筛选" : "Nearby place filters"}
        className="listing-studio-collection-map-filters"
        role="toolbar"
      >
        {CATEGORY_TABS.map((category) => (
          <button
            aria-pressed={activeCategory === category.id}
            className={cx(
              "listing-studio-collection-map-filter",
              activeCategory === category.id && "is-active",
            )}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            type="button"
          >
            {getPoiCategoryLabel(category.id, isZh)}
          </button>
        ))}
        <button
          className="listing-studio-collection-map-filter is-clear"
          onClick={() => setActiveCategory(null)}
          type="button"
        >
          {isZh ? "清空" : "Clear"}
        </button>
      </div>

      <div className="listing-studio-collection-map-canvas" ref={mapRootRef} />

      <div className="listing-studio-collection-map-footnote">
        <span>{isPoiLoading ? (isZh ? "正在刷新周边地点..." : "Refreshing nearby places...") : poiSummary}</span>
      </div>
    </section>
  );
}
