export type ListingStudioShareReturnSource = "dashboard" | "listings";

export function normalizeListingStudioShareReturnSource(
  value: string | null | undefined,
): ListingStudioShareReturnSource | null {
  if (value === "dashboard" || value === "listings") {
    return value;
  }

  return null;
}

export function getListingStudioShareReturnSourceFromPath(
  currentPath: string,
): ListingStudioShareReturnSource | null {
  try {
    const url = new URL(currentPath, "http://acre.local");
    return normalizeListingStudioShareReturnSource(url.searchParams.get("from"));
  } catch {
    return null;
  }
}

export function getListingStudioShareReturnSourceFromReferrer(
  referrer: string | null,
): ListingStudioShareReturnSource | null {
  if (!referrer) {
    return null;
  }

  try {
    const url = new URL(referrer);

    if (url.pathname === "/listing-studio/dashboard") {
      return "dashboard";
    }

    if (url.pathname === "/listing-studio/listings") {
      return "listings";
    }
  } catch {
    return null;
  }

  return null;
}

export function buildListingStudioCollectionShareListingHref(input: {
  shareCode: string;
  packId: string;
  returnSource?: ListingStudioShareReturnSource | null;
}) {
  const params = new URLSearchParams({
    listing: input.packId,
  });

  if (input.returnSource) {
    params.set("from", input.returnSource);
  }

  return `/share/collections/${input.shareCode}?${params.toString()}`;
}
