import { canManageOfficeGoals } from "@acre/auth";
import { createAgentGoal } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { createAgentGoalBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

export async function handleCreateAgentGoalPost(
  request: NextRequest,
  membershipId: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    createAgentGoal?: typeof createAgentGoal;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, createAgentGoalBodySchema, {
    error: "Agent goal payload is invalid.",
    invalidJsonError: "Agent goal payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const goal = await (dependencies.createAgentGoal ?? createAgentGoal)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      membershipId,
      periodType: body.periodType,
      startsAt: body.startsAt ?? "",
      endsAt: body.endsAt ?? "",
      targetTransactionCount: body.targetTransactionCount,
      targetClosedVolume: body.targetClosedVolume,
      targetOfficeNet: body.targetOfficeNet,
      targetAgentNet: body.targetAgentNet,
      notes: body.notes
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create goal." }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeGoals(context.currentMembership)) {
    return NextResponse.json({ error: "Goal management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  return handleCreateAgentGoalPost(request, membershipId, context);
}
