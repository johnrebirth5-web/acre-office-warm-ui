import { canApproveOfficeCommissions, canManageOfficeCommissions } from "@acre/auth";
import { updateCommissionCalculationStatus } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    calculationId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership) && !canApproveOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission review access required." }, { status: 403 });
  }

  const { calculationId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const calculation = await updateCommissionCalculationStatus({
      organizationId: context.currentOrganization.id,
      calculationId,
      status: typeof body?.status === "string" ? body.status : "",
      notes: typeof body?.notes === "string" ? body.notes : "",
      actorMembershipId: context.currentMembership.id
    });

    if (!calculation) {
      return NextResponse.json({ error: "Commission calculation not found." }, { status: 404 });
    }

    return NextResponse.json({ calculation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update commission calculation." },
      { status: 400 }
    );
  }
}
