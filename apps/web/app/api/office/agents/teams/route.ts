import { canManageOfficeTeams } from "@acre/auth";
import { createAgentTeam } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTeams(context.currentMembership)) {
    return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;

  try {
    const team = await createAgentTeam({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      name: body?.name ?? ""
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create team." }, { status: 400 });
  }
}
