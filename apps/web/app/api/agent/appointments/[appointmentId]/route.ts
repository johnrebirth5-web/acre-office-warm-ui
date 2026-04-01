import { can } from "@acre/auth";
import { updateFrontOfficeAppointmentStatus } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    appointmentId: string;
  }>;
};

function readOptionalString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key] : null;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const { appointmentId } = await params;

  try {
    const appointment = await updateFrontOfficeAppointmentStatus({
      organizationId: context.currentOrganization.id,
      appointmentId,
      ownerMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      status: readOptionalString(body, "status"),
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the appointment.",
      },
      { status: 400 },
    );
  }
}
