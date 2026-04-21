import { canAccessListingStudio } from "@acre/auth";
import { getStudioListingPackDetail } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import {
  buildListingStudioPosterDraft,
  buildListingStudioPosterFileName,
  readListingStudioPosterStatusVariantId,
  readListingStudioPosterTemplateId,
  renderListingStudioPosterHtml,
  renderListingStudioPosterSvg,
  type ListingStudioPosterFormat,
} from "../../../../../listing-studio/listings/[packId]/listing-studio-poster";

export const runtime = "nodejs";

function readPosterFormat(value: string | null): ListingStudioPosterFormat {
  switch (value) {
    case "png":
    case "svg":
      return value;
    case "html":
    default:
      return "html";
  }
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

  if (!canAccessListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio access required." },
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

  const templateId = readListingStudioPosterTemplateId(
    request.nextUrl.searchParams.get("template"),
  );
  const statusVariant = readListingStudioPosterStatusVariantId(
    request.nextUrl.searchParams.get("statusVariant"),
  );
  const draft = buildListingStudioPosterDraft(
    detail,
    templateId,
    request.nextUrl.searchParams.get("coverAssetId"),
    statusVariant,
  );
  const format = readPosterFormat(request.nextUrl.searchParams.get("format"));
  const download = request.nextUrl.searchParams.get("download") === "1";
  const fileName = buildListingStudioPosterFileName(detail, draft, format);

  if (format === "png") {
    const sharp = (await import("sharp")).default;
    const svg = await renderListingStudioPosterSvg(detail, draft, {
      baseUrl: request.nextUrl.origin,
      embedAssets: true,
      requestHeaders: {
        cookie: request.headers.get("cookie") ?? "",
      },
    });
    const pngBuffer = await sharp(Buffer.from(svg))
      .png({
        compressionLevel: 9,
        quality: 100,
      })
      .toBuffer();

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/png",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="${fileName}"`,
            }
          : {}),
      },
    });
  }

  if (format === "svg") {
    const svg = await renderListingStudioPosterSvg(detail, draft, {
      baseUrl: request.nextUrl.origin,
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/svg+xml; charset=utf-8",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="${fileName}"`,
            }
          : {}),
      },
    });
  }

  const html = renderListingStudioPosterHtml(detail, draft, {
    autoPrint: request.nextUrl.searchParams.get("print") === "1",
    baseUrl: request.nextUrl.origin,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="${fileName}"`,
          }
        : {}),
    },
  });
}
