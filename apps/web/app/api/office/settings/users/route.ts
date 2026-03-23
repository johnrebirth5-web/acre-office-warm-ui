import { canManageOfficeSettings, canManageOfficeTeams, canManageOfficeUsers } from "@acre/auth";
import { createInvitedUser } from "@acre/db";
import type { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../../lib/request-origin";

const createableUserRoles = new Set<UserRole>(["owner", "office_admin", "accountant", "human_resources", "team_lead", "agent"]);
const privilegedCreateableUserRoles = new Set<UserRole>(["owner", "office_admin"]);

function isCreateableUserRole(value: string): value is UserRole {
  return createableUserRoles.has(value as UserRole);
}

function isPrivilegedCreateableUserRole(value: UserRole) {
  return privilegedCreateableUserRoles.has(value);
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeUsers(context.currentMembership)) {
    return NextResponse.json({ error: "User management permission required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
      | {
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: string;
        officeId?: string | null;
        title?: string | null;
        splitTemplateId?: string | null;
        customAgentPercent?: string | null;
        commissionEffectiveFrom?: string | null;
        teamId?: string | null;
        reportsToTeamMembershipId?: string | null;
      }
    | null;

  try {
    if (!body?.role || !isCreateableUserRole(body.role)) {
      throw new Error("A supported Back Office role is required.");
    }

    if (isPrivilegedCreateableUserRole(body.role) && !canManageOfficeSettings(context.currentMembership)) {
      return NextResponse.json({ error: "Only Owner / Office Admin can assign admin-tier roles." }, { status: 403 });
    }

    if ((body?.teamId?.trim() || body?.reportsToTeamMembershipId?.trim()) && !canManageOfficeTeams(context.currentMembership)) {
      return NextResponse.json({ error: "Team management permission required." }, { status: 403 });
    }

    const result = await createInvitedUser({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      email: body?.email ?? "",
      firstName: body?.firstName ?? "",
      lastName: body?.lastName ?? "",
      role: body.role,
      officeId: typeof body?.officeId === "string" && body.officeId !== "__all__" ? body.officeId : null,
      title: typeof body?.title === "string" ? body.title : null,
      splitTemplateId: typeof body?.splitTemplateId === "string" ? body.splitTemplateId : undefined,
      customAgentPercent: typeof body?.customAgentPercent === "string" ? body.customAgentPercent : undefined,
      commissionEffectiveFrom: typeof body?.commissionEffectiveFrom === "string" ? body.commissionEffectiveFrom : undefined,
      teamId: typeof body?.teamId === "string" ? body.teamId : undefined,
      reportsToTeamMembershipId:
        typeof body?.reportsToTeamMembershipId === "string" ? body.reportsToTeamMembershipId : undefined
    });

    return NextResponse.json({
      membershipId: result.membershipId,
      userId: result.userId,
      invitationId: result.invitationId,
      invitationUrl: new URL(result.invitationPath, getRequestOrigin(request)).toString(),
      expiresAt: result.expiresAt.toISOString(),
      email: body?.email ?? ""
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create the invited user." }, { status: 400 });
  }
}
