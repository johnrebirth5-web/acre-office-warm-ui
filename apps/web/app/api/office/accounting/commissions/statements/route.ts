import { canApproveOfficeCommissions, canManageOfficeCommissions } from "@acre/auth";
import { generateCommissionStatementSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership) && !canApproveOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission statement management access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const statement = await generateCommissionStatementSnapshot({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : "",
      startDate: typeof body?.startDate === "string" ? body.startDate : "",
      endDate: typeof body?.endDate === "string" ? body.endDate : "",
      actorMembershipId: context.currentMembership.id
    });

    if (!statement) {
      return NextResponse.json({ error: "Agent not found for statement generation." }, { status: 404 });
    }

    return NextResponse.json({ statement }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate commission statement." },
      { status: 400 }
    );
  }
}
