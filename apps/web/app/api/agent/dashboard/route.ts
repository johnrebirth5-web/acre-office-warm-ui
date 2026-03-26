import { can, summarizeAccess } from "@acre/auth";
import { getAgentDashboardSnapshot } from "@acre/backoffice";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!can(context.currentMembership, "dashboard:view")) {
    return NextResponse.json({ error: "Dashboard access required." }, { status: 403 });
  }

  const userId = request.nextUrl.searchParams.get("userId") ?? undefined;

  return NextResponse.json({
    access: summarizeAccess(context.currentMembership),
    snapshot: getAgentDashboardSnapshot(userId)
  });
}
