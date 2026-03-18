import { canManageOfficeCommissions } from "@acre/auth";
import { deleteCommissionSplitTemplate, saveCommissionSplitTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    splitTemplateId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  const { splitTemplateId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const splitTemplate = await saveCommissionSplitTemplate({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      splitTemplateId,
      name: typeof body?.name === "string" ? body.name : "",
      agentPercent: typeof body?.agentPercent === "string" ? body.agentPercent : "",
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ splitTemplate });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update split template." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(_request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  const { splitTemplateId } = await params;

  try {
    const result = await deleteCommissionSplitTemplate({
      organizationId: context.currentOrganization.id,
      splitTemplateId,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete split template." },
      { status: 400 }
    );
  }
}
