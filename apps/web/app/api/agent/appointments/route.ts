import { can } from "@acre/auth";
import {
  createFrontOfficeAppointment,
  getFrontOfficeAppointmentsSnapshot,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

function readOptionalString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : null;
}

function isJsonObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mapAppointmentCreateErrorResponse(message: string) {
  if (message.includes("not available in your Front Office scope")) {
    return {
      status: 404,
      hint: "Refresh the calendar context and pick a visible client before saving.",
    };
  }

  if (message.includes("not available in the current office scope")) {
    return {
      status: 404,
      hint: "Refresh the listing context or switch back to the office where this listing is visible.",
    };
  }

  if (message.includes("Meeting link must be a valid http(s) URL")) {
    return {
      status: 422,
      hint: "Paste a full Zoom / Meet / Teams URL, or use a host like meet.google.com/abc so Acre can normalize it.",
    };
  }

  if (
    message.includes("Link a client") ||
    message.includes("Link a listing")
  ) {
    return {
      status: 422,
      hint: "Showing and meeting coordination works best when Acre can keep a client, listing, or outside contact attached to the record.",
    };
  }

  if (
    message.includes("Start time") ||
    message.includes("End time")
  ) {
    return {
      status: 422,
      hint: "Check the start/end fields and try again.",
    };
  }

  return {
    status: 400,
    hint: null,
  };
}

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
      { error: "Front Office dashboard access required." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    snapshot: await getFrontOfficeAppointmentsSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
      clientId: request.nextUrl.searchParams.get("clientId"),
      listingId: request.nextUrl.searchParams.get("listingId"),
      type: request.nextUrl.searchParams.get("type"),
      status: request.nextUrl.searchParams.get("status"),
      coordination: request.nextUrl.searchParams.get("coordination"),
      followUp: request.nextUrl.searchParams.get("followUp"),
      targetAppointmentId: request.nextUrl.searchParams.get("appointmentId"),
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

  if (!can(context.currentMembership, "dashboard:view")) {
    return NextResponse.json(
      { error: "Front Office dashboard access required." },
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
    const appointment = await createFrontOfficeAppointment({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      ownerMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id,
      title: readOptionalString(body, "title"),
      type: readOptionalString(body, "type"),
      clientId: readOptionalString(body, "clientId"),
      listingId: readOptionalString(body, "listingId"),
      startsAt: readOptionalString(body, "startsAt") ?? "",
      endsAt: readOptionalString(body, "endsAt"),
      location: readOptionalString(body, "location"),
      meetingUrl: readOptionalString(body, "meetingUrl"),
      contactLabel: readOptionalString(body, "contactLabel"),
      notes: readOptionalString(body, "notes"),
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create the appointment.";
    const mappedError = mapAppointmentCreateErrorResponse(message);

    return NextResponse.json(
      {
        error: message,
        ...(mappedError.hint ? { hint: mappedError.hint } : {}),
      },
      { status: mappedError.status },
    );
  }
}
