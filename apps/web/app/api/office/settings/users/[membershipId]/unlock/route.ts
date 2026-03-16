import { canManageOfficeUsers } from "@acre/auth";
import { unlockInternalAccount } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

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

  if (!canManageOfficeUsers(context.currentMembership.role)) {
    return NextResponse.json({ error: "User management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;

  try {
    await unlockInternalAccount({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      membershipId
    });

    return NextResponse.json({ membershipId, unlocked: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to unlock the account." }, { status: 400 });
  }
}
