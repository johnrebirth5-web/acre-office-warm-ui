import { canManageOfficeFields } from "@acre/auth";
import { createOfficeTransactionCustomFieldDefinition } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership.role)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        label?: string;
        type?: string;
        isRequired?: boolean;
        isVisible?: boolean;
        options?: string[];
      }
    | null;

  try {
    const schema = await createOfficeTransactionCustomFieldDefinition({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      label: body?.label ?? "",
      type: body?.type ?? "",
      isRequired: Boolean(body?.isRequired),
      isVisible: typeof body?.isVisible === "boolean" ? body.isVisible : true,
      options: Array.isArray(body?.options) ? body.options.map((option) => String(option ?? "")) : []
    });

    return NextResponse.json({ schema }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create custom field."
      },
      { status: 400 }
    );
  }
}
