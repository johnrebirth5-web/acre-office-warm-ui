import { canViewOfficeDocuments } from "@acre/auth";
import { getTransactionDocumentStorageRecord, recordTransactionDocumentOpened } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "../../../../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    documentId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeDocuments(context.currentMembership)) {
    return NextResponse.json({ error: "Document access required." }, { status: 403 });
  }

  const { transactionId, documentId } = await params;
  const document = await getTransactionDocumentStorageRecord(context.currentOrganization.id, transactionId, documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  try {
    const file = await readStoredFile(document.storageKey);

    await recordTransactionDocumentOpened(context.currentOrganization.id, context.currentMembership.id, documentId);

    return new NextResponse(file.fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
        "Content-Length": String(file.fileSizeBytes)
      }
    });
  } catch {
    return NextResponse.json({ error: "Stored file could not be read." }, { status: 404 });
  }
}
