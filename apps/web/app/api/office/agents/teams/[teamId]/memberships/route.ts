import { canManageOfficeTeams } from "@acre/auth";
import { addAgentToTeam } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { addAgentToTeamBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    teamId: string;
  }>;
};

export async function handleAddAgentToTeamPost(
  request: NextRequest,
  teamId: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    addAgentToTeam?: typeof addAgentToTeam;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, addAgentToTeamBodySchema, {
    error: "Team membership payload is invalid.",
    invalidJsonError: "Team membership payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const membership = await (dependencies.addAgentToTeam ?? addAgentToTeam)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      teamId,
      membershipId: body.membershipId,
      role: body.role,
      reportsToTeamMembershipId: body.reportsToTeamMembershipId ?? null
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to assign team membership." }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  const { teamId } = await params;
  return handleAddAgentToTeamPost(request, teamId, context);
}
