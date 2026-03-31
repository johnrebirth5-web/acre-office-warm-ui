import { can } from "@acre/auth";
import { getFrontOfficeClientsSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!can(context.currentMembership, "clients:view")) {
    return NextResponse.json({ error: "Client access required." }, { status: 403 });
  }

  return NextResponse.json({
    snapshot: await getFrontOfficeClientsSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone
    })
  });
}
