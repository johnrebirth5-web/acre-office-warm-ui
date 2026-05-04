import { resolveProjectRemoteSigningToken } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "../../../../../../../lib/document-storage";

type RouteContext = {
  params: Promise<{
    token: string;
    sessionDocumentId: string;
  }>;
};

export async function GET(_request: NextRequest, routeContext: RouteContext) {
  const { token, sessionDocumentId } = await routeContext.params;
  const resolved = await resolveProjectRemoteSigningToken(token);

  if (!resolved) {
    return NextResponse.json({ error: "Signing token is invalid or expired." }, { status: 404 });
  }

  const document = resolved.recipient.session.documents.find((item) => item.id === sessionDocumentId);

  if (!document?.snapshotPdfStorageKey) {
    return NextResponse.json({ error: "Signing document was not found." }, { status: 404 });
  }

  const storedFile = await readStoredFile(document.snapshotPdfStorageKey);

  return new NextResponse(new Uint8Array(storedFile.fileBuffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.snapshotPdfFileName || "project-signing.pdf")}"`,
      "Content-Type": document.snapshotPdfContentType || "application/pdf",
    },
  });
}
