import { canManageOfficeSettings, type UserRole } from "@acre/auth";
import { saveOrganizationRoleTemplatePermissions } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

const fixedRoles = new Set<UserRole>([
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
  "office_manager",
  "office_user"
]);

type RouteContext = {
  params: Promise<{
    role: string;
  }>;
};

function isUserRole(value: string): value is UserRole {
  return fixedRoles.has(value as UserRole);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSettings(context.currentMembership)) {
    return NextResponse.json({ error: "Settings management permission required." }, { status: 403 });
  }

  const { role } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        permissions?: string[];
      }
    | null;

  if (!isUserRole(role)) {
    return NextResponse.json({ error: "Unsupported role template." }, { status: 400 });
  }

  try {
    const snapshot = await saveOrganizationRoleTemplatePermissions({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      role,
      permissions: body?.permissions ?? []
    });

    return NextResponse.json({
      roleTemplate: snapshot.roles.find((entry) => entry.role === role) ?? null
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update the role template." },
      { status: 400 }
    );
  }
}
