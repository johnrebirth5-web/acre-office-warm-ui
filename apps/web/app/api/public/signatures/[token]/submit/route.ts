import { createTransactionDocument, getPublicSignatureDocumentStorageRecord, getPublicSignatureRequestSnapshot, updateSignatureRequest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile, saveStoredFile } from "../../../../../../lib/document-storage";
import { buildSignedPdf, type SubmittedSignatureFieldValue } from "../../../../../../lib/signature-pdf";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function buildSignedFileName(fileName: string) {
  const normalized = fileName.toLowerCase().endsWith(".pdf") ? fileName.slice(0, -4) : fileName;
  return `${normalized}-signed.pdf`;
}

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const snapshot = await getPublicSignatureRequestSnapshot(token);
  const documentRecord = await getPublicSignatureDocumentStorageRecord(token);

  if (!snapshot || !documentRecord) {
    return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
  }

  if (!["sent", "viewed"].includes(snapshot.request.statusKey)) {
    return NextResponse.json({ error: "This signature request can no longer be signed." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { values?: SubmittedSignatureFieldValue[] } | null;

  if (!body?.values || !Array.isArray(body.values)) {
    return NextResponse.json({ error: "A values array is required." }, { status: 400 });
  }

  try {
    await updateSignatureRequest({
      organizationId: documentRecord.organizationId,
      transactionId: documentRecord.transactionId,
      signatureRequestId: snapshot.request.id,
      action: "signed"
    });

    const originalFile = await readStoredFile(documentRecord.storageKey);
    const signedPdfBytes = await buildSignedPdf({
      originalPdfBytes: new Uint8Array(originalFile.fileBuffer),
      fields: snapshot.fields,
      values: body.values
    });

    const signedFile = await saveStoredFile({
      organizationId: documentRecord.organizationId,
      transactionId: documentRecord.transactionId,
      fileName: buildSignedFileName(documentRecord.fileName),
      bytes: new Uint8Array(signedPdfBytes)
    });

    const signedDocument = await createTransactionDocument({
      organizationId: documentRecord.organizationId,
      officeId: documentRecord.officeId,
      transactionId: documentRecord.transactionId,
      offerId: documentRecord.offerId,
      title: `${documentRecord.title} · signed`,
      fileName: buildSignedFileName(documentRecord.fileName),
      mimeType: "application/pdf",
      fileSizeBytes: signedFile.fileSizeBytes,
      storageKey: signedFile.storageKey,
      documentType: documentRecord.documentType,
      source: "signature_output",
      status: "signed",
      isSigned: true,
      signedAt: new Date().toISOString(),
      linkedTaskId: documentRecord.linkedTaskId
    });

    if (!signedDocument) {
      throw new Error("Signed PDF could not be archived.");
    }

    const completedRequest = await updateSignatureRequest({
      organizationId: documentRecord.organizationId,
      transactionId: documentRecord.transactionId,
      signatureRequestId: snapshot.request.id,
      action: "completed",
      completedDocumentId: signedDocument.id
    });

    return NextResponse.json({
      signatureRequest: completedRequest,
      signedDocument
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signature submission failed." },
      { status: 400 }
    );
  }
}
