const DEFAULT_LISTING_STUDIO_EXTENSION_STORE_URL =
  "https://chromewebstore.google.com/detail/acre-listing-studio/hijmimhfeckiiahbjmdjpepoaifekcbk";

export const LISTING_STUDIO_EXTENSION_STORE_URL =
  process.env.NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL?.trim() ||
  DEFAULT_LISTING_STUDIO_EXTENSION_STORE_URL;
