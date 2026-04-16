"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { StudioListingCollectionListingItem } from "@acre/db";

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
  label: string;
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
    label: "Supermarket",
    requests: [{ type: "grocery_or_supermarket" }],
  },
  {
    id: "subway",
    label: "Subway",
    requests: [{ type: "subway_station" }, { type: "transit_station" }],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    requests: [{ type: "restaurant" }],
  },
  {
    id: "coffee",
    label: "Coffee",
    requests: [{ type: "cafe" }],
  },
  {
    id: "nightlife",
    label: "Nightlife",
    requests: [{ type: "bar" }, { type: "night_club" }],
  },
];

const CATEGORY_TABS: Array<{ id: PoiCategoryId; label: string }> = [
  { id: "supermarket", label: "Supermarket" },
  { id: "subway", label: "Subway" },
  { id: "restaurant", label: "Restaurant" },
  { id: "coffee", label: "Coffee" },
  { id: "nightlife", label: "Nightlife" },
  { id: "all", label: "All" },
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

  return (
    POI_CATEGORIES.find((entry) => entry.id === category)?.requests ?? []
  );
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
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const listingMarkersRef = useRef<any[]>([]);
  const poiMarkersRef = useRef<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<PoiCategoryId>("all");
  const [poiSummary, setPoiSummary] = useState("Loading nearby places...");
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
        .map((listing) => `${listing.packId}:${listing.latitude}:${listing.longitude}`)
        .join("|"),
    [mappedListings],
  );
  const fallbackMessage = !apiKey
    ? "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the live collection map and nearby places filters."
    : "No saved coordinates were found for this collection yet, so the map can’t be drawn.";

  useEffect(() => {
    if (!mapRootRef.current) {
      return;
    }

    if (!apiKey) {
      setMapError(
        "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the live collection map and nearby places filters.",
      );
      return;
    }

    if (!mappedListings.length) {
      setMapError(
        "No saved coordinates were found for this collection yet, so the map can’t be drawn.",
      );
      return;
    }

    let isCancelled = false;

    async function renderMap() {
      setIsPoiLoading(true);
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
          setPoiSummary(
            dedupedPlaces.length
              ? `${dedupedPlaces.length} nearby ${CATEGORY_TABS.find((item) => item.id === activeCategory)?.label.toLowerCase() ?? "places"} shown on the map.`
              : `No nearby ${CATEGORY_TABS.find((item) => item.id === activeCategory)?.label.toLowerCase() ?? "places"} were found in this view.`,
          );
        });
      } catch (error) {
        if (!isCancelled) {
          setMapError(
            error instanceof Error
              ? error.message
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
  }, [activeCategory, apiKey, mapSignature, mappedListings]);

  if (!apiKey || !mappedListings.length) {
    return (
      <section className="listing-studio-collection-map-panel">
        <div className="listing-studio-collection-map-header">
          <div>
            <span className="listing-studio-collection-map-eyebrow">
              Collection map
            </span>
            <h3>Map unavailable</h3>
          </div>
        </div>
        <div className="listing-studio-collection-map-fallback">
          <p>{mapError || fallbackMessage}</p>
          {listingsWithoutCoordinates > 0 ? (
            <p>
              {listingsWithoutCoordinates} listing
              {listingsWithoutCoordinates === 1 ? "" : "s"} in this collection
              are still missing coordinates.
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
            Collection map
          </span>
          <h3>Where these listings cluster</h3>
        </div>
        <p>
          {listingsWithoutCoordinates > 0
            ? `${listingsWithoutCoordinates} saved listing${listingsWithoutCoordinates === 1 ? "" : "s"} could not be pinned on the map yet.`
            : "All saved listings in this collection are plotted on the map."}
        </p>
      </div>

      <div className="listing-studio-collection-map-filters" role="tablist">
        {CATEGORY_TABS.map((category) => (
          <button
            aria-selected={activeCategory === category.id}
            className={cx(
              "listing-studio-collection-map-filter",
              activeCategory === category.id && "is-active",
            )}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            type="button"
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="listing-studio-collection-map-canvas" ref={mapRootRef} />

      <div className="listing-studio-collection-map-footnote">
        <span>{isPoiLoading ? "Refreshing nearby places..." : poiSummary}</span>
      </div>
    </section>
  );
}
