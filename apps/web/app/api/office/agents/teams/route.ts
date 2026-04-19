import { canManageOfficeTeams } from "@acre/auth";
import { createAgentTeam } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { createAgentTeamBodySchema } from "./route.schema";

export async function handleCreateAgentTeamPost(
  request: NextRequest,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    createAgentTeam?: typeof createAgentTeam;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, createAgentTeamBodySchema, {
    error: "Team payload is invalid.",
    invalidJsonError: "Team payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const team = await (dependencies.createAgentTeam ?? createAgentTeam)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      name: body.name,
      parentTeamId: body.parentTeamId ?? null,
      leaderMembershipId: body.leaderMembershipId ?? ""
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create team." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  return handleCreateAgentTeamPost(request, context);
}
