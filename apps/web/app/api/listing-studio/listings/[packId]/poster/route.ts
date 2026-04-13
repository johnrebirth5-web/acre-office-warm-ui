import { canAccessListingStudio } from "@acre/auth";
import { getStudioListingPackDetail } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import {
  buildListingStudioPosterDraft,
  buildListingStudioPosterFileName,
  renderListingStudioPosterHtml,
  type ListingStudioPosterTemplateId,
} from "../../../../../listing-studio/listings/[packId]/listing-studio-poster";

export const runtime = "nodejs";

function readPosterTemplateId(value: string | null): ListingStudioPosterTemplateId {
  switch (value) {
    case "open-house":
    case "social-square":
    case "factsheet":
      return value;
    case "editorial":
    default:
      return "editorial";
  }
}

function normalizeText(value: string | null, fallback: string) {
  const trimmed = value?.trim();

  return trimmed && trimmed.length ? trimmed : fallback;
}

function readContactOverride(url: URL, key: string) {
  if (!url.searchParams.has(key)) {
    return undefined;
  }

  const value = url.searchParams.get(key);
  return value === null ? "" : value.trim();
}

function applyPosterContactOverrides(
  detail: NonNullable<Awaited<ReturnType<typeof getStudioListingPackDetail>>>,
  request: NextRequest,
) {
  const url = new URL(request.url);
  const contactName = readContactOverride(url, "contactName");
  const contactTitle = readContactOverride(url, "contactTitle");
  const contactPhone = readContactOverride(url, "contactPhone");
  const contactEmail = readContactOverride(url, "contactEmail");

  if (
    contactName === undefined &&
    contactTitle === undefined &&
    contactPhone === undefined &&
    contactEmail === undefined
  ) {
    return detail;
  }

  return {
    ...detail,
    pack: {
      ...detail.pack,
      contactName: contactName === undefined ? detail.pack.contactName : contactName,
      contactTitle: contactTitle === undefined ? detail.pack.contactTitle : contactTitle,
      contactPhone: contactPhone === undefined ? detail.pack.contactPhone : contactPhone,
      contactEmail: contactEmail === undefined ? detail.pack.contactEmail : contactEmail,
    },
  };
}

function buildPosterDraftFromRequest(
  detail: NonNullable<Awaited<ReturnType<typeof getStudioListingPackDetail>>>,
  request: NextRequest,
) {
  const url = new URL(request.url);
  const templateId = readPosterTemplateId(url.searchParams.get("template"));

  return buildListingStudioPosterDraft(
    detail,
    templateId,
    url.searchParams.get("coverAssetId"),
  );
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

  const detailWithContactOverrides = applyPosterContactOverrides(detail, request);
  const draft = buildPosterDraftFromRequest(detailWithContactOverrides, request);
  const html = renderListingStudioPosterHtml(detailWithContactOverrides, draft, {
    baseUrl: request.nextUrl.origin,
    autoPrint: new URL(request.url).searchParams.get("print") === "1",
  });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const fileName = buildListingStudioPosterFileName(detail, draft);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="${normalizeText(fileName, "listing-poster.html")}"`,
          }
        : {}),
    },
  });
}
