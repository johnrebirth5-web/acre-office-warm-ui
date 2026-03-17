import { canManageOfficeCommissions } from "@acre/auth";
import { assignCommissionPlanToMembership } from "@acre/db";
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
    const assignmentId = await assignCommissionPlanToMembership({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : undefined,
      teamId: typeof body?.teamId === "string" ? body.teamId : undefined,
      commissionPlanId: typeof body?.commissionPlanId === "string" ? body.commissionPlanId : "",
      effectiveFrom: typeof body?.effectiveFrom === "string" ? body.effectiveFrom : "",
      effectiveTo: typeof body?.effectiveTo === "string" ? body.effectiveTo : "",
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ assignmentId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to assign commission plan." },
      { status: 400 }
    );
  }
}
