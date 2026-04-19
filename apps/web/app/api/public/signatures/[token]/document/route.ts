import { getPublicSignatureDocumentStorageRecord } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "../../../../../../lib/document-storage";
import {
  buildPublicTokenRateLimitResponse,
  consumePublicTokenRateLimit,
  PUBLIC_SIGNATURE_READ_RATE_LIMIT_OPTIONS,
} from "../../../../../../lib/public-token-rate-limit";
import { buildSignedPdf } from "../../../../../../lib/signature-pdf";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export const runtime = "nodejs";

type PublicSignatureDocumentRouteDependencies = {
  buildSignedPdf?: typeof buildSignedPdf;
  getPublicSignatureDocumentStorageRecord?: typeof getPublicSignatureDocumentStorageRecord;
  rateLimit?: typeof consumePublicTokenRateLimit;
  readStoredFile?: typeof readStoredFile;
};

export async function handlePublicSignatureDocumentGet(
  request: NextRequest,
  routeContext: Awaited<RouteContext["params"]>,
  dependencies: PublicSignatureDocumentRouteDependencies = {},
) {
  const { token } = routeContext;
  const rateLimitDecision = await (
    dependencies.rateLimit ?? consumePublicTokenRateLimit
  )({
    scope: "public/signatures/read",
    request,
    token,
    options: PUBLIC_SIGNATURE_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    return buildPublicTokenRateLimitResponse(
      "Too many signature view attempts. Please try again in a moment.",
      rateLimitDecision.retryAfterSeconds,
    );
  }

  const document = await (
    dependencies.getPublicSignatureDocumentStorageRecord ??
    getPublicSignatureDocumentStorageRecord
  )(token);

  if (!document) {
    return NextResponse.json({ error: "Signature document not found." }, { status: 404 });
  }

  const file = await (dependencies.readStoredFile ?? readStoredFile)(
    document.storageKey,
  );
  let pdfBytes = new Uint8Array(file.fileBuffer);

  if (document.submittedValues.length > 0) {
    try {
      pdfBytes = new Uint8Array(
        await (dependencies.buildSignedPdf ?? buildSignedPdf)({
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

export async function GET(request: NextRequest, { params }: RouteContext) {
  return handlePublicSignatureDocumentGet(request, await params);
}
