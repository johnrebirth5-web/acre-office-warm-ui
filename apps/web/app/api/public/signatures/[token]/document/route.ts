import { getPublicSignatureDocumentStorageRecord } from "@acre/db";
import { NextResponse } from "next/server";
import { readStoredFile } from "../../../../../../lib/document-storage";
import { buildSignedPdf } from "../../../../../../lib/signature-pdf";

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
  let pdfBytes = new Uint8Array(file.fileBuffer);

  if (document.submittedValues.length > 0) {
    try {
      pdfBytes = new Uint8Array(
        await buildSignedPdf({
          originalPdfBytes: pdfBytes,
          fields: document.fields,
          values: document.submittedValues.map((value) => ({
            fieldId: value.fieldId,
            fieldType: value.fieldType,
            textValue: value.textValue || undefined,
            signatureMode: value.signatureMode || undefined,
            imageDataUrl: value.imageDataUrl || undefined
          })),
          allowIncomplete: true
        })
      );
    } catch (error) {
      console.error("Failed to render submitted signature preview values.", error);
    }
  }

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`
    }
  });
}
