import {
  activityLogActions,
  canCreateProjectSigning,
  prisma,
  recordActivityLogEvent,
  saveSignatureTemplate,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { saveStoredSignatureTemplateFile } from "../../../../../lib/document-storage";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload payload must be multipart/form-data." }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Template name is required." }, { status: 400 });
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
    return NextResponse.json({ error: "Only PDF files are supported for signing templates." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let template;

  try {
    template = await saveSignatureTemplate({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      templateId: null,
      name,
      description: "",
      category: "project_sales",
      isActive: true,
      emailSubject: "",
      emailBody: "",
      senderDisplayName: "",
      senderReplyTo: "",
      recipients: [
        {
          id: null,
          role: "signer",
          recipientRole: "buyer",
          routingStep: 1,
          sortOrder: 0,
        },
      ],
      fields: [],
    });
  } catch (createError) {
    return NextResponse.json(
      { error: createError instanceof Error ? createError.message : "Failed to create template." },
      { status: 400 },
    );
  }

  if (!template) {
    return NextResponse.json({ error: "Failed to create template." }, { status: 500 });
  }

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
      source: "front_office_project_signing",
      actorMembershipId: context.currentMembership.id,
      templateId: template.id,
      fileName: stored.fileName,
      fileSizeBytes: stored.fileSizeBytes,
    },
  });

  return NextResponse.json({
    template: {
      id: updated.id,
      name: updated.name,
      pdfFileName: updated.pdfFileName,
      pdfByteSize: updated.pdfByteSize,
      hasPdfSource: true,
    },
  });
}
