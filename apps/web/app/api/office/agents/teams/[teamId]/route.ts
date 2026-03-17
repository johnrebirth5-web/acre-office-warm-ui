import { canManageOfficeTeams } from "@acre/auth";
import { deleteAgentTeam, updateAgentTeam } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    teamId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership.role)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  const { teamId } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string; isActive?: boolean } | null;

  try {
    const team = await updateAgentTeam({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      teamId,
      name: body?.name,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined
    });

    return NextResponse.json({ team });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update team." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership.role)) {
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
