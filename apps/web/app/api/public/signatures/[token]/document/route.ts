import { getPublicSignatureDocumentStorageRecord } from "@acre/db";
import { NextResponse } from "next/server";
import { readStoredFile } from "../../../../../../lib/document-storage";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params;
  const document = await getPublicSignatureDocumentStorageRecord(token);

  if (!document) {
    return NextResponse.json({ error: "Signature document not found." }, { status: 404 });
  }

  const file = await readStoredFile(document.storageKey);

  return new NextResponse(new Uint8Array(file.fileBuffer), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`
    }
  });
}
