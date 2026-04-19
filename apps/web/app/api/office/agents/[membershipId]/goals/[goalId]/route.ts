import { canManageOfficeGoals } from "@acre/auth";
import { updateAgentGoal } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { updateAgentGoalBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    membershipId: string;
    goalId: string;
  }>;
};

export async function handleUpdateAgentGoalPatch(
  request: NextRequest,
  membershipId: string,
  goalId: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    updateAgentGoal?: typeof updateAgentGoal;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, updateAgentGoalBodySchema, {
    error: "Agent goal payload is invalid.",
    invalidJsonError: "Agent goal payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const goal = await (dependencies.updateAgentGoal ?? updateAgentGoal)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      membershipId,
      goalId,
      periodType: body.periodType,
      startsAt: body.startsAt ?? "",
      endsAt: body.endsAt ?? "",
      targetTransactionCount: body.targetTransactionCount,
      targetClosedVolume: body.targetClosedVolume,
      targetOfficeNet: body.targetOfficeNet,
      targetAgentNet: body.targetAgentNet,
      notes: body.notes
    });

    return NextResponse.json({ goal });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update goal." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeGoals(context.currentMembership)) {
    return NextResponse.json({ error: "Goal management permission required." }, { status: 403 });
  }

  const { membershipId, goalId } = await params;
  return handleUpdateAgentGoalPatch(request, membershipId, goalId, context);
}
