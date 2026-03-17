import { canManageOfficeLibrary } from "@acre/auth";
import { createLibraryDocument } from "@acre/db";
import { LibraryDocumentVisibility } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { deleteStoredFile, saveStoredLibraryFile } from "../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export const runtime = "nodejs";

function parseScope(value: FormDataEntryValue | null) {
  return typeof value === "string" && value === LibraryDocumentVisibility.office_only
    ? LibraryDocumentVisibility.office_only
    : LibraryDocumentVisibility.company_wide;
}

function parseTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeLibrary(context.currentMembership)) {
    return NextResponse.json({ error: "Library management access required." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
  }

  const visibility = parseScope(formData.get("visibility"));
  const storedFile = await saveStoredLibraryFile({
    organizationId: context.currentOrganization.id,
    officeId: visibility === LibraryDocumentVisibility.office_only ? context.currentOffice?.id ?? null : null,
    fileName: fileEntry.name,
    bytes: new Uint8Array(await fileEntry.arrayBuffer())
  });

  try {
    const document = await createLibraryDocument({
      organizationId: context.currentOrganization.id,
      currentOfficeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      folderId: String(formData.get("folderId") ?? "").trim() || null,
      title: String(formData.get("title") ?? fileEntry.name),
      originalFileName: fileEntry.name,
      mimeType: fileEntry.type || "application/octet-stream",
      fileSizeBytes: storedFile.fileSizeBytes,
      storageKey: storedFile.storageKey,
      summary: String(formData.get("summary") ?? "").trim() || null,
      category: String(formData.get("category") ?? "").trim() || null,
      tags: parseTags(formData.get("tags")),
      visibility
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    await deleteStoredFile(storedFile.storageKey).catch(() => null);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document upload failed." },
      { status: 400 }
    );
  }
}
