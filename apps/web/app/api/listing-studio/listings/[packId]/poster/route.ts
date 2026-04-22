import { canAccessListingStudio } from "@acre/auth";
import { getOfficeAccountSnapshot, getStudioListingPackDetail } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import {
  buildListingStudioPosterDraft,
  buildListingStudioPosterFileName,
  readListingStudioPosterSlotAssetIds,
  readListingStudioPosterStatusVariantId,
  readListingStudioPosterTemplateId,
  renderListingStudioPosterHtml,
  renderListingStudioPosterSvg,
  type ListingStudioPosterFormat,
  type ListingStudioPosterAgentSnapshot,
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
    readListingStudioPosterSlotAssetIds((key) =>
      request.nextUrl.searchParams.get(key),
    ),
  );
  const format = readPosterFormat(request.nextUrl.searchParams.get("format"));
  const download = request.nextUrl.searchParams.get("download") === "1";
  const fileName = buildListingStudioPosterFileName(detail, draft, format);
  const accountSnapshot = await getOfficeAccountSnapshot({
    membershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    organizationId: context.currentOrganization.id,
  });
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
    const sharp = (await import("sharp")).default;
    const svg = await renderListingStudioPosterSvg(detail, draft, {
      agent: posterAgent,
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
      agent: posterAgent,
      baseUrl: request.nextUrl.origin,
      embedAssets: true,
      requestHeaders: {
        cookie: request.headers.get("cookie") ?? "",
      },
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
