import { can } from "@acre/auth";
import {
  createFrontOfficeSharedEvent,
  getFrontOfficeSharedEventsSnapshot,
  resolveFrontOfficeEventCalendarView,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

function isJsonObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : null;
}

function readOptionalBoolean(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "boolean" ? body[key] : null;
}

function canManageSharedEvents(role: string) {
  return role === "owner" || role === "office_admin";
}

function mapEventMutationError(message: string) {
  if (
    message.includes("required") ||
    message.includes("invalid") ||
    message.includes("must be after") ||
    message.includes("cannot be invite-only") ||
    message.includes("active office context") ||
    message.includes("need an area or location")
  ) {
    return 422;
  }

  if (message.includes("Only owners or office admins")) {
    return 403;
  }

  return 400;
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "events:view")) {
    return NextResponse.json(
      { error: "Event access required." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    snapshot: await getFrontOfficeSharedEventsSnapshot({
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
    }),
  });
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canManageSharedEvents(context.currentMembership.role)) {
    return NextResponse.json(
      { error: "Only owners or office admins can manage shared events." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);

  if (!isJsonObjectBody(body)) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  try {
    const created = await createFrontOfficeSharedEvent({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      actorRole: context.currentMembership.role,
      timeZone: context.currentUser.timezone,
      title: readOptionalString(body, "title") ?? "",
      description: readOptionalString(body, "description"),
      eventType: readOptionalString(body, "eventType"),
      visibility: readOptionalString(body, "visibility"),
      startsAt: readOptionalString(body, "startsAt") ?? "",
      endsAt: readOptionalString(body, "endsAt"),
      isOnline: readOptionalBoolean(body, "isOnline"),
      location: readOptionalString(body, "location"),
      area: readOptionalString(body, "area"),
      meetingUrl: readOptionalString(body, "meetingUrl"),
      meetingPassword: readOptionalString(body, "meetingPassword"),
      isMandatory: readOptionalBoolean(body, "isMandatory"),
      recurrenceRule: readOptionalString(body, "recurrenceRule"),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create the event.";

    return NextResponse.json(
      { error: message },
      { status: mapEventMutationError(message) },
    );
  }
}
