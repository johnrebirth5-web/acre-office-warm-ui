import { canManageOfficeLibrary } from "@acre/auth";
import { createLibraryDocument } from "@acre/db";
import { LibraryDocumentVisibility } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { deleteStoredFile, saveStoredLibraryFile } from "../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import {
  DEFAULT_UPLOAD_MAX_BYTES,
  formatUploadLimit,
  getOversizedUpload,
  isMultipartPayloadTooLarge,
} from "../../../../../lib/upload-validation";
import { extractPdfMetadata, isPdfFileLike } from "../_shared/pdf-metadata";

export const runtime = "nodejs";

const LIBRARY_DOCUMENT_MAX_BYTES = DEFAULT_UPLOAD_MAX_BYTES;

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

  if (isMultipartPayloadTooLarge(request, LIBRARY_DOCUMENT_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Document uploads must be ${formatUploadLimit(LIBRARY_DOCUMENT_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
  }

  if (getOversizedUpload([fileEntry], LIBRARY_DOCUMENT_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Document uploads must be ${formatUploadLimit(LIBRARY_DOCUMENT_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  const visibility = parseScope(formData.get("visibility"));
  const fileBytes = new Uint8Array(await fileEntry.arrayBuffer());
  const mimeType = fileEntry.type || (isPdfFileLike(fileEntry.name, fileEntry.type) ? "application/pdf" : "application/octet-stream");
  const extractedPdfMetadata = isPdfFileLike(fileEntry.name, mimeType)
    ? await extractPdfMetadata(fileBytes)
    : null;
  const requestedTitle = String(formData.get("title") ?? "").trim();
  const requestedSummary = String(formData.get("summary") ?? "").trim();
  const requestedTags = parseTags(formData.get("tags"));

  const storedFile = await saveStoredLibraryFile({
    organizationId: context.currentOrganization.id,
    officeId: visibility === LibraryDocumentVisibility.office_only ? context.currentOffice?.id ?? null : null,
    fileName: fileEntry.name,
    bytes: fileBytes
  });

  try {
    const document = await createLibraryDocument({
      organizationId: context.currentOrganization.id,
      currentOfficeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      folderId: String(formData.get("folderId") ?? "").trim() || null,
      title: requestedTitle || extractedPdfMetadata?.title || fileEntry.name,
      originalFileName: fileEntry.name,
      mimeType,
      fileSizeBytes: storedFile.fileSizeBytes,
      storageKey: storedFile.storageKey,
      pageCount: extractedPdfMetadata?.pageCount ?? null,
      summary: requestedSummary || extractedPdfMetadata?.subject || null,
      category: String(formData.get("category") ?? "").trim() || null,
      tags: requestedTags.length ? requestedTags : extractedPdfMetadata?.keywords ?? [],
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
