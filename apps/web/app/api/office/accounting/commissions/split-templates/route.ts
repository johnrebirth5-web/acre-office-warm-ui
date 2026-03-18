import { canManageOfficeCommissions } from "@acre/auth";
import { saveCommissionSplitTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const splitTemplate = await saveCommissionSplitTemplate({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      name: typeof body?.name === "string" ? body.name : "",
      agentPercent: typeof body?.agentPercent === "string" ? body.agentPercent : "",
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ splitTemplate }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save split template." },
      { status: 400 }
    );
  }
}
