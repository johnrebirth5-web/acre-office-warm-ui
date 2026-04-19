import { canManageOfficeTeams } from "@acre/auth";
import { addAgentToTeam, removeAgentFromTeam } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../../../lib/api/parse-body";
import { updateAgentTeamMembershipBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    teamId: string;
    membershipId: string;
  }>;
};

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  const { teamId, membershipId } = await params;

  try {
    await removeAgentFromTeam({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      teamId,
      membershipId
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to remove agent from team." }, { status: 400 });
  }
}

export async function handleUpdateAgentTeamMembershipPatch(
  request: NextRequest,
  teamId: string,
  membershipId: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    addAgentToTeam?: typeof addAgentToTeam;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, updateAgentTeamMembershipBodySchema, {
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
      membershipId,
      role: body.role,
      reportsToTeamMembershipId: body.reportsToTeamMembershipId ?? null
    });

    return NextResponse.json({ membership });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update team member." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  const { teamId, membershipId } = await params;
  return handleUpdateAgentTeamMembershipPatch(request, teamId, membershipId, context);
}
