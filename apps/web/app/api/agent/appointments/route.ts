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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the appointment.",
      },
      { status: 400 },
    );
  }
}
