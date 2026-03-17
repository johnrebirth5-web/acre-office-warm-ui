import { canManageOfficeUsers } from "@acre/auth";
import { issueInvitationForMembership, revokeInvitationForMembership } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../../../../lib/request-origin";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
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
        action?: string;
      }
    | null;

  try {
    if (body?.action === "revoke") {
      await revokeInvitationForMembership({
        organizationId: context.currentOrganization.id,
        actorMembershipId: context.currentMembership.id,
        membershipId
      });

      return NextResponse.json({ membershipId, revoked: true });
    }

    const result = await issueInvitationForMembership({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      membershipId
    });

    return NextResponse.json({
      membershipId,
      invitationId: result.invitationId,
      invitationUrl: new URL(result.invitationPath, getRequestOrigin(request)).toString(),
      expiresAt: result.expiresAt.toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update the invitation." }, { status: 400 });
  }
}
