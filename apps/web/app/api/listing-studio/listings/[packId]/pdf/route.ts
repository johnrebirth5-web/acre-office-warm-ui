import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { canShareListingStudio } from "@acre/auth";
import {
  getStudioListingAssetRecord,
  getStudioListingPackDetail,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { readStoredFile } from "../../../../../../lib/document-storage";
import { StudioListingPdfDocument } from "./studio-listing-pdf";

export const runtime = "nodejs";

function buildPdfFileName(title: string, generatedAt: Date) {
  const safeTitle =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "listing";

  return `${safeTitle}-listing-packet-${generatedAt.toISOString().slice(0, 10)}.pdf`;
}

async function loadAssetDataUri(assetId: string, organizationId: string) {
  const asset = await getStudioListingAssetRecord({
    assetId,
    organizationId,
  });

  if (!asset) {
    return null;
  }

  const stored = await readStoredFile(asset.storageKey);
  const base64 = Buffer.from(stored.fileBuffer).toString("base64");
  return `data:${asset.mimeType || "application/octet-stream"};base64,${base64}`;
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ packId: string }> },
) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canShareListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio share access required." },
      { status: 403 },
    );
  }

  const { packId } = await props.params;
  const detail = await getStudioListingPackDetail({
    organizationId: context.currentOrganization.id,
    packId,
  });

  if (!detail) {
    return NextResponse.json({ error: "Packet not found." }, { status: 404 });
  }

  const selectedAssetIds =
    detail.pack.selectedAssetIds.length > 0
      ? detail.pack.selectedAssetIds
      : detail.assets.map((asset) => asset.id).slice(0, 6);
  const heroAssetId =
    detail.pack.coverAssetId ??
    selectedAssetIds[0] ??
    detail.assets[0]?.id ??
    null;
  const galleryAssetIds = selectedAssetIds.filter((assetId) => assetId !== heroAssetId);
  const [heroImageSrc, galleryImageSrcs] = await Promise.all([
    heroAssetId
      ? loadAssetDataUri(heroAssetId, context.currentOrganization.id)
      : Promise.resolve(null),
    Promise.all(
      galleryAssetIds
        .slice(0, 4)
        .map((assetId) =>
          loadAssetDataUri(assetId, context.currentOrganization.id),
        ),
    ).then((items) => items.filter((entry): entry is string => Boolean(entry))),
  ]);

  const generatedAt = new Date();
  const document = createElement(StudioListingPdfDocument, {
    detail,
    generatedAtLabel: generatedAt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    heroImageSrc,
    galleryImageSrcs,
  }) as ReactElement<DocumentProps>;
  const pdfBuffer = await renderToBuffer(document);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${buildPdfFileName(detail.title, generatedAt)}"`,
    },
  });
}
