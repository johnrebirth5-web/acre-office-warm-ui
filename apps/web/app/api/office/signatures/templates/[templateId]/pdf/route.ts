import { canManageOfficeSignatureTemplates } from "@acre/auth";
import { activityLogActions, prisma, recordActivityLogEvent } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { saveStoredSignatureTemplateFile } from "../../../../../../../lib/document-storage";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatureTemplates(context.currentMembership)) {
    return NextResponse.json({ error: "Signature template access required." }, { status: 403 });
  }

  const { templateId } = await routeContext.params;

  const template = await prisma.signatureTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: context.currentOrganization.id,
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload payload must be multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required under field 'file'." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `PDF file exceeds the ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)} MB limit.` },
      { status: 413 },
    );
  }

  const contentType = file.type || "application/pdf";

  if (contentType !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported for signature templates." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const stored = await saveStoredSignatureTemplateFile({
    organizationId: context.currentOrganization.id,
    templateId: template.id,
    fileName: file.name,
    bytes,
  });

  const updated = await prisma.signatureTemplate.update({
    where: { id: template.id },
    data: {
      pdfStorageKey: stored.storageKey,
      pdfFileName: stored.fileName,
      pdfByteSize: stored.fileSizeBytes,
      pdfContentType: "application/pdf",
      version: template.version + 1,
    },
  });

  await recordActivityLogEvent(prisma, {
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    entityType: "signature_template",
    entityId: template.id,
    action: activityLogActions.projectSigningTemplatePdfUploaded,
    payload: {
      source: "back_office_signature_templates",
      actorMembershipId: context.currentMembership.id,
      templateId: template.id,
      fileName: stored.fileName,
      fileSizeBytes: stored.fileSizeBytes,
    },
  });

  return NextResponse.json({
    template: {
      id: updated.id,
      pdfFileName: updated.pdfFileName,
      pdfByteSize: updated.pdfByteSize,
      pdfContentType: updated.pdfContentType,
    },
  });
}
