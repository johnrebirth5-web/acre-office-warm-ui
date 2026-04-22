import { canAccessListingStudio } from "@acre/auth";
import { getOfficeAccountSnapshot, getStudioListingPackDetail } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { getAppBaseUrl } from "../../../../../../lib/request-origin";
import {
  buildListingStudioPosterDraft,
  buildListingStudioPosterFileName,
  readListingStudioPosterSlotAssetIds,
  readListingStudioPosterStatusVariantId,
  readListingStudioPosterTemplateId,
  renderListingStudioPosterHtml,
  renderListingStudioPosterSvg,
  type ListingStudioPosterAgentSnapshot,
  type ListingStudioPosterFormat,
} from "../../../../../listing-studio/listings/[packId]/listing-studio-poster";

export const runtime = "nodejs";

type PosterEmbeddedImage = {
  buffer: Buffer;
  contentType: string;
};

type SharpFactory = (...args: any[]) => any;

type PosterRouteDependencies = {
  getAppBaseUrl: typeof getAppBaseUrl;
  getOfficeAccountSnapshot: typeof getOfficeAccountSnapshot;
  getRequestSessionContext: typeof getRequestSessionContext;
  getStudioListingPackDetail: typeof getStudioListingPackDetail;
  importSharp: () => Promise<SharpFactory>;
  renderListingStudioPosterHtml: typeof renderListingStudioPosterHtml;
  renderListingStudioPosterSvg: typeof renderListingStudioPosterSvg;
};

const defaultDependencies: PosterRouteDependencies = {
  getAppBaseUrl,
  getOfficeAccountSnapshot,
  getRequestSessionContext,
  getStudioListingPackDetail,
  importSharp: async () => (await import("sharp")).default as SharpFactory,
  renderListingStudioPosterHtml,
  renderListingStudioPosterSvg,
};

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

function normalizeEmbeddedContentType(contentType: string | null | undefined) {
  return contentType?.split(";")[0]?.trim().toLowerCase() || "image/jpeg";
}

function canInlinePosterSvgImageContentType(contentType: string) {
  return (
    contentType === "image/jpeg" ||
    contentType === "image/jpg" ||
    contentType === "image/png" ||
    contentType === "image/svg+xml"
  );
}

export async function normalizeListingStudioPosterEmbeddedImage(
  buffer: Buffer,
  contentType: string,
  dependencies: Pick<PosterRouteDependencies, "importSharp"> = defaultDependencies,
): Promise<PosterEmbeddedImage> {
  const normalizedContentType = normalizeEmbeddedContentType(contentType);

  if (canInlinePosterSvgImageContentType(normalizedContentType)) {
    return {
      buffer,
      contentType:
        normalizedContentType === "image/jpg"
          ? "image/jpeg"
          : normalizedContentType,
    };
  }

  try {
    const sharp = await dependencies.importSharp();
    const normalizedBuffer = await sharp(buffer, { animated: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90 })
      .toBuffer();

    return {
      buffer: normalizedBuffer,
      contentType: "image/jpeg",
    };
  } catch {
    return {
      buffer,
      contentType: normalizedContentType,
    };
  }
}

export async function handleListingStudioPosterGet(
  request: NextRequest,
  packId: string,
  dependencies: PosterRouteDependencies = defaultDependencies,
) {
  const context = await dependencies.getRequestSessionContext(request);

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

  const detail = await dependencies.getStudioListingPackDetail({
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
    readListingStudioPosterSlotAssetIds((key) =>
      request.nextUrl.searchParams.get(key),
    ),
  );
  const format = readPosterFormat(request.nextUrl.searchParams.get("format"));
  const download = request.nextUrl.searchParams.get("download") === "1";
  const fileName = buildListingStudioPosterFileName(detail, draft, format);
  const accountSnapshot = await dependencies.getOfficeAccountSnapshot({
    membershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    organizationId: context.currentOrganization.id,
  });
  const baseUrl = dependencies.getAppBaseUrl(request);
  const normalizeEmbeddedImage = (buffer: Buffer, nextContentType: string) =>
    normalizeListingStudioPosterEmbeddedImage(
      buffer,
      nextContentType,
      dependencies,
    );
  const posterAgent: ListingStudioPosterAgentSnapshot | null = accountSnapshot
    ? {
        avatarUrl: accountSnapshot.profile.avatarUrl.trim() || null,
        companyName:
          accountSnapshot.officeTeam.officeName ||
          context.currentOffice?.name ||
          context.currentOrganization.name,
        email:
          accountSnapshot.profile.email.trim() || detail.pack.contactEmail.trim(),
        name:
          accountSnapshot.profile.displayName.trim() ||
          accountSnapshot.profile.fullName.trim() ||
          detail.pack.contactName.trim(),
        phone:
          accountSnapshot.profile.phone.trim() || detail.pack.contactPhone.trim(),
        title:
          accountSnapshot.officeTeam.title !== "Not assigned"
            ? accountSnapshot.officeTeam.title
            : context.currentMembership.title?.trim() ||
              detail.pack.contactTitle.trim() ||
              "Licensed Real Estate Salesperson",
      }
    : null;

  if (format === "png") {
    const sharp = await dependencies.importSharp();
    const svg = await dependencies.renderListingStudioPosterSvg(detail, draft, {
      agent: posterAgent,
      baseUrl,
      embedAssets: true,
      requestHeaders: {
        cookie: request.headers.get("cookie") ?? "",
      },
      normalizeEmbeddedImage,
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
    const svg = await dependencies.renderListingStudioPosterSvg(detail, draft, {
      agent: posterAgent,
      baseUrl,
      embedAssets: true,
      requestHeaders: {
        cookie: request.headers.get("cookie") ?? "",
      },
      normalizeEmbeddedImage,
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

  const html = dependencies.renderListingStudioPosterHtml(detail, draft, {
    autoPrint: request.nextUrl.searchParams.get("print") === "1",
    baseUrl,
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

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ packId: string }> },
) {
  const { packId } = await props.params;
  return handleListingStudioPosterGet(request, packId);
}
