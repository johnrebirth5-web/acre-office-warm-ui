import { canViewOfficeLibrary } from "@acre/auth";
import { getLibraryDocumentStorageRecord, recordLibraryDocumentOpened } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "../../../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeLibrary(context.currentMembership)) {
    return NextResponse.json({ error: "Library access required." }, { status: 403 });
  }

  const { documentId } = await params;
  const document = await getLibraryDocumentStorageRecord(
    context.currentOrganization.id,
    context.currentOffice?.id ?? null,
    documentId
  );

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  try {
    const file = await readStoredFile(document.storageKey);
    const previewOnly = request.nextUrl.searchParams.get("preview") === "1";
    const download = request.nextUrl.searchParams.get("download") === "1";

    if (!previewOnly) {
      await recordLibraryDocumentOpened(
        context.currentOrganization.id,
        context.currentOffice?.id ?? null,
        context.currentMembership.id,
        document.id
      );
    }

    return new NextResponse(file.fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(document.originalFileName)}"`,
        "Content-Length": String(file.fileSizeBytes)
      }
    });
  } catch {
    return NextResponse.json({ error: "Stored file could not be read." }, { status: 404 });
  }
}
