import { canManageOfficeFields } from "@acre/auth";
import { deleteOfficeCustomFieldDefinition, updateOfficeCustomFieldDefinition } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    fieldKey: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  const { fieldKey } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        module?: string;
        label?: string;
        type?: string;
        isRequired?: boolean;
        isVisible?: boolean;
        isDeletionLocked?: boolean;
        sortOrder?: number;
        options?: string[];
      }
    | null;

  try {
    const snapshot = await updateOfficeCustomFieldDefinition({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      module: body?.module === "contact" || body?.module === "offer" ? body.module : "transaction",
      fieldKey,
      label: body?.label,
      type: body?.type,
      isRequired: typeof body?.isRequired === "boolean" ? body.isRequired : undefined,
      isVisible: typeof body?.isVisible === "boolean" ? body.isVisible : undefined,
      isDeletionLocked:
        typeof body?.isDeletionLocked === "boolean" ? body.isDeletionLocked : undefined,
      sortOrder: typeof body?.sortOrder === "number" ? body.sortOrder : undefined,
      options: Array.isArray(body?.options) ? body.options.map((option) => String(option ?? "")) : undefined
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
