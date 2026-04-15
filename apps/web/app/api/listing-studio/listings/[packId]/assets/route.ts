import { canEditListingStudio } from "@acre/auth";
import { appendStudioListingPackAssets } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { ensureListingStudioStorageConfigured } from "../../../../../../lib/listing-studio";

export const runtime = "nodejs";

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

  const invalidFile = files.find(
    (file) =>
      file.type &&
      !file.type.startsWith("image/") &&
      !file.type.startsWith("video/"),
  );

  if (invalidFile) {
    return NextResponse.json(
      { error: `Unsupported file type: ${invalidFile.type}` },
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
