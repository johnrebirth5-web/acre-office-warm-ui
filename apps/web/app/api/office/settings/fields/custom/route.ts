import { canManageOfficeFields } from "@acre/auth";
import { createOfficeCustomFieldDefinition } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { createOfficeCustomFieldDefinitionBodySchema } from "./route.schema";

export async function handleCreateOfficeCustomFieldDefinitionPost(
  request: NextRequest,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    createOfficeCustomFieldDefinition?: typeof createOfficeCustomFieldDefinition;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, createOfficeCustomFieldDefinitionBodySchema, {
    error: "Custom field payload is invalid.",
    invalidJsonError: "Custom field payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const snapshot = await (dependencies.createOfficeCustomFieldDefinition ?? createOfficeCustomFieldDefinition)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      module: body.module ?? "transaction",
      label: body.label,
      type: body.type,
      isRequired: Boolean(body.isRequired),
      isVisible: body.isVisible ?? true,
      isDeletionLocked: Boolean(body.isDeletionLocked),
      options: body.options?.map((option) => String(option ?? "")) ?? []
    });

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create custom field."
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  return handleCreateOfficeCustomFieldDefinitionPost(request, context);
}
