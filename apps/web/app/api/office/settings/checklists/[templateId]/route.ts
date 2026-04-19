import { canManageOfficeChecklists } from "@acre/auth";
import { updateChecklistTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { updateChecklistTemplateBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function handleUpdateChecklistTemplatePatch(
  request: NextRequest,
  templateId: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    updateChecklistTemplate?: typeof updateChecklistTemplate;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, updateChecklistTemplateBodySchema, {
    error: "Checklist template payload is invalid.",
    invalidJsonError: "Checklist template payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const template = await (dependencies.updateChecklistTemplate ?? updateChecklistTemplate)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      templateId,
      name: body.name,
      description: body.description ?? "",
      transactionType: body.transactionType ?? "",
      isActive: body.isActive ?? true,
      items: body.items ?? []
    });

    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update checklist template." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeChecklists(context.currentMembership)) {
    return NextResponse.json({ error: "Checklist management permission required." }, { status: 403 });
  }

  const { templateId } = await params;
  return handleUpdateChecklistTemplatePatch(request, templateId, context);
}
