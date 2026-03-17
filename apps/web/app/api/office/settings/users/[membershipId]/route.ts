import { canManageOfficeUsers } from "@acre/auth";
import { updateOfficeAdminUser } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeUsers(context.currentMembership)) {
    return NextResponse.json({ error: "User management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        role?: string;
        status?: string;
        officeId?: string | null;
      }
    | null;

  try {
    const membership = await updateOfficeAdminUser({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      membershipId,
      role: body?.role,
      status: body?.status,
      officeId: typeof body?.officeId === "string" ? body.officeId : body?.officeId === null ? null : undefined
    });

    return NextResponse.json({ membership });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update user access." }, { status: 400 });
  }
}
