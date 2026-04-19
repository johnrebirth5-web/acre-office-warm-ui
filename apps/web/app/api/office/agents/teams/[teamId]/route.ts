import { canManageOfficeTeams } from "@acre/auth";
import { deleteAgentTeam, updateAgentTeam } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { updateAgentTeamBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    teamId: string;
  }>;
};

export async function handleUpdateAgentTeamPatch(
  request: NextRequest,
  teamId: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    updateAgentTeam?: typeof updateAgentTeam;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, updateAgentTeamBodySchema, {
    error: "Team payload is invalid.",
    invalidJsonError: "Team payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const team = await (dependencies.updateAgentTeam ?? updateAgentTeam)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      teamId,
      name: body.name,
      isActive: body.isActive,
      parentTeamId: body.parentTeamId ?? undefined
    });

    return NextResponse.json({ team });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update team." }, { status: 400 });
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

  const { teamId } = await params;
  return handleUpdateAgentTeamPatch(request, teamId, context);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  const { teamId } = await params;

  try {
    await deleteAgentTeam({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      teamId
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete team." }, { status: 400 });
  }
}
