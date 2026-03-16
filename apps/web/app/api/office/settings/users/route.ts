import { canManageOfficeUsers } from "@acre/auth";
import { createInvitedUser } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../../lib/request-origin";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeUsers(context.currentMembership.role)) {
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
      }
    | null;

  try {
    if (body?.role !== "office_admin" && body?.role !== "office_user") {
      throw new Error("Only Admin and User roles can be created from this page.");
    }

    const result = await createInvitedUser({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      email: body?.email ?? "",
      firstName: body?.firstName ?? "",
      lastName: body?.lastName ?? "",
      role: body.role,
      officeId: typeof body?.officeId === "string" && body.officeId !== "__all__" ? body.officeId : null,
      title: typeof body?.title === "string" ? body.title : null
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
