import {
  authenticateStudioListingExtensionToken,
  configureStudioListingFileHelpers,
} from "@acre/db";
import type { NextRequest } from "next/server";
import {
  saveStoredListingStudioFile,
  saveStoredListingStudioText,
} from "./document-storage";

let listingStudioStorageConfigured = false;

export function ensureListingStudioStorageConfigured() {
  if (listingStudioStorageConfigured) {
    return;
  }

  configureStudioListingFileHelpers({
    saveText: saveStoredListingStudioText,
    saveFile: saveStoredListingStudioFile,
  });
  listingStudioStorageConfigured = true;
}

export function getListingStudioBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

export async function getListingStudioExtensionContext(request: NextRequest) {
  const bearerToken = getListingStudioBearerToken(request);

  if (!bearerToken) {
    return null;
  }

  return authenticateStudioListingExtensionToken(bearerToken);
}

export function getRequestIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}
