import { can, summarizeAccess } from "@acre/auth";
import { getFrontOfficeDashboardSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "dashboard:view")) {
    return NextResponse.json(
      { error: "Dashboard access required." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    access: summarizeAccess(context.currentMembership),
    snapshot: await getFrontOfficeDashboardSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      viewerRole: context.currentMembership.role,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
      canUseAi: can(context.currentMembership, "ai:use"),
    }),
  });
}
