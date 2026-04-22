import { canManageOfficeCommissions } from "@acre/auth";
import { deleteCommissionPlanAssignment, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

type CommissionAssignmentDetailRouteDependencies = {
  deleteCommissionPlanAssignment?: typeof deleteCommissionPlanAssignment;
};

export async function handleDeleteCommissionPlanAssignmentDelete(
  context: SessionMembershipContext,
  assignmentId: string,
  dependencies: CommissionAssignmentDetailRouteDependencies = {}
) {
  try {
    const deletedAssignmentId = await (
      dependencies.deleteCommissionPlanAssignment ?? deleteCommissionPlanAssignment
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      assignmentId,
      actorMembershipId: context.currentMembership.id
    });

    if (!deletedAssignmentId) {
      return NextResponse.json({ error: "Commission assignment not found." }, { status: 404 });
    }

    return NextResponse.json({ assignmentId: deletedAssignmentId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove commission assignment." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  const { assignmentId } = await params;
  return handleDeleteCommissionPlanAssignmentDelete(context, assignmentId);
}
