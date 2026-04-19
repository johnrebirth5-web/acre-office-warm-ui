import { canManageOfficeDocuments } from "@acre/auth";
import { createTransactionDocument } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { saveStoredFile } from "../../../../../../lib/document-storage";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import {
  DEFAULT_UPLOAD_MAX_BYTES,
  formatUploadLimit,
  getOversizedUpload,
  isMultipartPayloadTooLarge,
} from "../../../../../../lib/upload-validation";

export const runtime = "nodejs";

const TRANSACTION_DOCUMENT_MAX_BYTES = DEFAULT_UPLOAD_MAX_BYTES;

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

function parseBooleanField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeDocuments(context.currentMembership)) {
    return NextResponse.json({ error: "Document access required." }, { status: 403 });
  }

  if (isMultipartPayloadTooLarge(request, TRANSACTION_DOCUMENT_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Document uploads must be ${formatUploadLimit(TRANSACTION_DOCUMENT_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  const { transactionId } = await params;
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
  }

  if (getOversizedUpload([fileEntry], TRANSACTION_DOCUMENT_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Document uploads must be ${formatUploadLimit(TRANSACTION_DOCUMENT_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  const uploadedFile = await saveStoredFile({
    organizationId: context.currentOrganization.id,
    transactionId,
    fileName: fileEntry.name,
    bytes: new Uint8Array(await fileEntry.arrayBuffer())
  });

  try {
    const document = await createTransactionDocument({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      title: String(formData.get("title") ?? fileEntry.name),
      fileName: fileEntry.name,
      mimeType: fileEntry.type || "application/octet-stream",
      fileSizeBytes: uploadedFile.fileSizeBytes,
      storageKey: uploadedFile.storageKey,
      offerId: String(formData.get("offerId") ?? "").trim() || null,
      documentType: String(formData.get("documentType") ?? "General"),
      isRequired: parseBooleanField(formData.get("isRequired")),
      isUnsorted: parseBooleanField(formData.get("isUnsorted")),
      linkedTaskId: String(formData.get("linkedTaskId") ?? "").trim() || null
    });

    if (!document) {
      return NextResponse.json({ error: "Transaction not found or upload failed." }, { status: 404 });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document upload failed." },
      { status: 400 }
    );
  }
}
