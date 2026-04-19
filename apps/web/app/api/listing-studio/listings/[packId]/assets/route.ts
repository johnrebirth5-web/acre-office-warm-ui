import { canEditListingStudio } from "@acre/auth";
import { appendStudioListingPackAssets } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { ensureListingStudioStorageConfigured } from "../../../../../../lib/listing-studio";
import {
  DEFAULT_UPLOAD_BATCH_MAX_BYTES,
  DEFAULT_UPLOAD_MAX_BYTES,
  formatUploadLimit,
  getCombinedUploadSize,
  getOversizedUpload,
  getUnsupportedMimeUpload,
  isMultipartPayloadTooLarge,
} from "../../../../../../lib/upload-validation";

export const runtime = "nodejs";

const LISTING_STUDIO_UPLOAD_MAX_BYTES = DEFAULT_UPLOAD_MAX_BYTES;
const LISTING_STUDIO_BATCH_MAX_BYTES = DEFAULT_UPLOAD_BATCH_MAX_BYTES;

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ packId: string }> },
) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canEditListingStudio(context.currentMembership)) {
    return NextResponse.json(
      { error: "Listing Studio edit access required." },
      { status: 403 },
    );
  }

  if (isMultipartPayloadTooLarge(request, LISTING_STUDIO_BATCH_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Upload batches must stay under ${formatUploadLimit(LISTING_STUDIO_BATCH_MAX_BYTES)}.`,
      },
      { status: 413 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!files.length) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }

  const oversizedFile = getOversizedUpload(files, LISTING_STUDIO_UPLOAD_MAX_BYTES);
  if (oversizedFile) {
    return NextResponse.json(
      {
        error: `Each file must be ${formatUploadLimit(LISTING_STUDIO_UPLOAD_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  if (getCombinedUploadSize(files) > LISTING_STUDIO_BATCH_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Upload batches must stay under ${formatUploadLimit(LISTING_STUDIO_BATCH_MAX_BYTES)}.`,
      },
      { status: 413 },
    );
  }

  const invalidFile = getUnsupportedMimeUpload(files, ["image/", "video/"]);

  if (invalidFile) {
    return NextResponse.json(
      { error: `Unsupported file type: ${invalidFile.type || "unknown"}` },
      { status: 400 },
    );
  }

  const { packId } = await props.params;
  ensureListingStudioStorageConfigured();

  const detail = await appendStudioListingPackAssets({
    organizationId: context.currentOrganization.id,
    packId,
    membershipId: context.currentMembership.id,
    files: await Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        mimeType: file.type || null,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    ),
  });

  if (!detail) {
    return NextResponse.json({ error: "Packet not found." }, { status: 404 });
  }

  return NextResponse.json(detail, { status: 201 });
}
