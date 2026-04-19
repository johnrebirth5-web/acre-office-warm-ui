import { canManageOfficeFields } from "@acre/auth";
import { deleteOfficeCustomFieldDefinition, updateOfficeCustomFieldDefinition } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { updateOfficeCustomFieldDefinitionBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    fieldKey: string;
  }>;
};

export async function handleUpdateOfficeCustomFieldDefinitionPatch(
  request: NextRequest,
  fieldKey: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    updateOfficeCustomFieldDefinition?: typeof updateOfficeCustomFieldDefinition;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, updateOfficeCustomFieldDefinitionBodySchema, {
    error: "Custom field payload is invalid.",
    invalidJsonError: "Custom field payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const snapshot = await (dependencies.updateOfficeCustomFieldDefinition ?? updateOfficeCustomFieldDefinition)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      module: body.module ?? "transaction",
      fieldKey,
      label: body.label,
      type: body.type,
      isRequired: body.isRequired,
      isVisible: body.isVisible,
      isDeletionLocked: body.isDeletionLocked,
      sortOrder: body.sortOrder,
      options: body.options?.map((option) => String(option ?? "")) ?? undefined
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update custom field."
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  const { fieldKey } = await params;
  return handleUpdateOfficeCustomFieldDefinitionPatch(request, fieldKey, context);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  const { fieldKey } = await params;
  const module = request.nextUrl.searchParams.get("module");

  try {
    const result = await deleteOfficeCustomFieldDefinition({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      module: module === "contact" || module === "offer" ? module : "transaction",
      fieldKey
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete custom field."
      },
      { status: 400 }
    );
  }
}
