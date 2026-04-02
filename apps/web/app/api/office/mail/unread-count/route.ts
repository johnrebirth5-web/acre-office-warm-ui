import { canAccessOfficeMail } from "@acre/auth";
import { getOfficeMailUnreadCount } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeMail(context.currentMembership)) {
    return NextResponse.json({ error: "Mail access required." }, { status: 403 });
  }

  try {
    const unreadCount = await getOfficeMailUnreadCount({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the mail unread count." },
      { status: 400 }
    );
  }
}
