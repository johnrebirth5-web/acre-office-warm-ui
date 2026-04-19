import { canManageOfficeChecklists } from "@acre/auth";
import { createChecklistTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { createChecklistTemplateBodySchema } from "./route.schema";

export async function handleCreateChecklistTemplatePost(
  request: NextRequest,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    createChecklistTemplate?: typeof createChecklistTemplate;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, createChecklistTemplateBodySchema, {
    error: "Checklist template payload is invalid.",
    invalidJsonError: "Checklist template payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const template = await (dependencies.createChecklistTemplate ?? createChecklistTemplate)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      name: body.name,
      description: body.description ?? "",
      transactionType: body.transactionType ?? "",
      isActive: body.isActive ?? true,
      items: body.items ?? []
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create checklist template." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeChecklists(context.currentMembership)) {
    return NextResponse.json({ error: "Checklist management permission required." }, { status: 403 });
  }

  return handleCreateChecklistTemplatePost(request, context);
}
