import { createHrOnboardingDocument, resolveHrOnboardingToken } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildPublicTokenRateLimitResponse,
  consumePublicTokenRateLimit,
} from "../../../../../../lib/public-token-rate-limit";
import { saveStoredHrOnboardingFile } from "../../../../../../lib/document-storage";
import {
  DEFAULT_UPLOAD_MAX_BYTES,
  formatUploadLimit,
  getOversizedUpload,
  isMultipartPayloadTooLarge,
} from "../../../../../../lib/upload-validation";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const PUBLIC_ONBOARDING_UPLOAD_RATE_LIMIT_OPTIONS = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};

const uploadMetadataSchema = z.object({
  kind: z.enum(["legal_document", "onboarding_info", "direct_deposit_info", "other"]).default("other"),
  title: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/onboarding/upload",
    request,
    token,
    options: PUBLIC_ONBOARDING_UPLOAD_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    return buildPublicTokenRateLimitResponse(
      "Too many onboarding upload attempts. Please try again in a moment.",
      rateLimitDecision.retryAfterSeconds,
    );
  }

  const snapshot = await resolveHrOnboardingToken(token);
  if (!snapshot) {
    return NextResponse.json({ error: "Onboarding token is invalid or expired." }, { status: 404 });
  }

  if (isMultipartPayloadTooLarge(request, DEFAULT_UPLOAD_MAX_BYTES)) {
    return NextResponse.json(
      { error: `Uploads must be ${formatUploadLimit(DEFAULT_UPLOAD_MAX_BYTES)} or smaller.` },
      { status: 413 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  if (getOversizedUpload([file], DEFAULT_UPLOAD_MAX_BYTES)) {
    return NextResponse.json(
      { error: `Uploads must be ${formatUploadLimit(DEFAULT_UPLOAD_MAX_BYTES)} or smaller.` },
      { status: 413 },
    );
  }

  const metadata = uploadMetadataSchema.safeParse({
    kind: formData.get("kind") ?? "other",
    title: formData.get("title"),
    email: formData.get("email") ?? snapshot.candidateEmail,
  });
  if (!metadata.success) {
    return NextResponse.json({ error: "Onboarding upload metadata is invalid." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storedFile = await saveStoredHrOnboardingFile({
    organizationId: snapshot.organizationId,
    onboardingCaseId: snapshot.caseId,
    fileName: file.name,
    bytes,
  });

  const document = await createHrOnboardingDocument({
    organizationId: snapshot.organizationId,
    officeId: snapshot.officeId,
    onboardingCaseId: snapshot.caseId,
    kind: metadata.data.kind,
    title: metadata.data.title ?? file.name,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSizeBytes: storedFile.fileSizeBytes,
    storageKey: storedFile.storageKey,
    submittedByEmail: metadata.data.email ?? snapshot.candidateEmail,
  });

  return NextResponse.json({ document }, { status: 201 });
}
