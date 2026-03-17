import { canManageOfficeTeams } from "@acre/auth";
import { addAgentToTeam, removeAgentFromTeam } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";

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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  const { teamId, membershipId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { role?: string; reportsToTeamMembershipId?: string | null }
    | null;

  try {
    const membership = await addAgentToTeam({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      teamId,
      membershipId,
      role: body?.role,
      reportsToTeamMembershipId: body?.reportsToTeamMembershipId ?? null
    });

    return NextResponse.json({ membership });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update team member." }, { status: 400 });
  }
}
