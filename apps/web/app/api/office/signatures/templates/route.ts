import { canManageOfficeSignatureTemplates } from "@acre/auth";
import {
  getOfficeSignatureTemplateLibrarySnapshot,
  saveSignatureTemplate,
  type SaveSignatureTemplateInput
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { saveSignatureTemplateBodySchema } from "./route.schema";

type SaveTemplateRequestBody = Omit<SaveSignatureTemplateInput, "organizationId" | "officeId" | "actorMembershipId"> | null;

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatureTemplates(context.currentMembership)) {
    return NextResponse.json({ error: "Signature template access required." }, { status: 403 });
  }

  const snapshot = await getOfficeSignatureTemplateLibrarySnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null
  });

  return NextResponse.json({ snapshot });
}

export async function handleSaveSignatureTemplatePost(
  request: NextRequest,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    saveSignatureTemplate?: typeof saveSignatureTemplate;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, saveSignatureTemplateBodySchema, {
    error: "Signature template payload is invalid.",
    invalidJsonError: "Signature template payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data as SaveTemplateRequestBody;

  try {
    const template = await (dependencies.saveSignatureTemplate ?? saveSignatureTemplate)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      templateId: body?.templateId ?? null,
      name: body?.name ?? "",
      description: body?.description ?? "",
      category: body?.category ?? "transaction",
      isActive: body?.isActive ?? true,
      emailSubject: body?.emailSubject ?? "",
      emailBody: body?.emailBody ?? "",
      senderDisplayName: body?.senderDisplayName ?? "",
      senderReplyTo: body?.senderReplyTo ?? "",
      recipients: body?.recipients ?? [],
      fields: body?.fields ?? []
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save signature template." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatureTemplates(context.currentMembership)) {
    return NextResponse.json({ error: "Signature template access required." }, { status: 403 });
  }

  return handleSaveSignatureTemplatePost(request, context);
}
