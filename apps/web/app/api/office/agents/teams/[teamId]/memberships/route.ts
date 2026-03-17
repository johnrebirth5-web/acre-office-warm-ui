import { canManageOfficeTeams } from "@acre/auth";
import { addAgentToTeam } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    teamId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  const { teamId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { membershipId?: string; role?: string; reportsToTeamMembershipId?: string | null }
    | null;

  try {
    const membership = await addAgentToTeam({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      teamId,
      membershipId: body?.membershipId ?? "",
      role: body?.role,
      reportsToTeamMembershipId: body?.reportsToTeamMembershipId ?? null
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to assign team membership." }, { status: 400 });
  }
}
