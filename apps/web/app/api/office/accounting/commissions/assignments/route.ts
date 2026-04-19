import { canManageOfficeCommissions } from "@acre/auth";
import { assignCommissionPlanToMembership, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createCommissionPlanAssignmentBodySchema } from "./route.schema";

type CommissionAssignmentRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  assignCommissionPlanToMembership?: typeof assignCommissionPlanToMembership;
};

export async function handleCreateCommissionPlanAssignmentPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: CommissionAssignmentRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createCommissionPlanAssignmentBodySchema,
    {
      error: "Commission assignment payload is invalid.",
      invalidJsonError: "Commission assignment request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const assignmentId = await (
      dependencies.assignCommissionPlanToMembership ?? assignCommissionPlanToMembership
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: body.membershipId,
      teamId: body.teamId,
      commissionPlanId: body.commissionPlanId,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? "",
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

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  return handleCreateCommissionPlanAssignmentPost(request, context);
}
