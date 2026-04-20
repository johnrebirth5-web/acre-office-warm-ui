import { can } from "@acre/auth";
import { respondToFrontOfficeSharedEventRsvp } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

function isJsonObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : null;
}

function mapRsvpError(message: string) {
  if (
    message.includes("RSVP status") ||
    message.includes("Mandatory events") ||
    message.includes("Past events")
  ) {
    return 422;
  }

  return 400;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
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

  const body = await request.json().catch(() => null);

  if (!isJsonObjectBody(body)) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const { eventId } = await params;

  try {
    const event = await respondToFrontOfficeSharedEventRsvp({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: context.currentMembership.id,
      eventId,
      status: readOptionalString(body, "status") ?? "",
      timeZone: context.currentUser.timezone,
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the RSVP.";

    return NextResponse.json(
      { error: message },
      { status: mapRsvpError(message) },
    );
  }
}
