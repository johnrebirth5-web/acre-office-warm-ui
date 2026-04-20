import { can } from "@acre/auth";
import {
  getFrontOfficeSharedEventsSnapshot,
  resolveFrontOfficeEventCalendarView,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!can(context.currentMembership, "events:view")) {
    return NextResponse.json({ error: "Event access required." }, { status: 403 });
  }

  const snapshot = await getFrontOfficeSharedEventsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
    view: resolveFrontOfficeEventCalendarView(
      request.nextUrl.searchParams.get("calendarView"),
    ),
    focusDate: request.nextUrl.searchParams.get("focusDate"),
    targetEventId: request.nextUrl.searchParams.get("eventId"),
  });

  return NextResponse.json({
    events: snapshot.events,
    summary: snapshot.summary,
  });
}
