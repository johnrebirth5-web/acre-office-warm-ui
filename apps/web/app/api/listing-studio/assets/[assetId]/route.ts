import { canAccessListingStudio } from "@acre/auth";
import { getStudioListingAssetRecord } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { readStoredFile } from "../../../../../lib/document-storage";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ assetId: string }> },
) {
  const sessionContext = await getRequestSessionContext(request);
  const shareCode = request.nextUrl.searchParams.get("shareCode")?.trim() || null;

  if (!shareCode) {
    if (!sessionContext) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canAccessListingStudio(sessionContext.currentMembership)) {
      return NextResponse.json(
        { error: "Listing Studio access required." },
        { status: 403 },
      );
    }
  }

  const { assetId } = await props.params;
  const asset = await getStudioListingAssetRecord({
    assetId,
    organizationId: sessionContext?.currentOrganization.id ?? null,
    shareCode,
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const stored = await readStoredFile(asset.storageKey);

  return new NextResponse(new Uint8Array(stored.fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType || "application/octet-stream",
      "Cache-Control": shareCode
        ? "public, max-age=86400, stale-while-revalidate=86400"
        : "private, max-age=604800, immutable",
      "Content-Length": String(stored.fileSizeBytes),
    },
  });
}
