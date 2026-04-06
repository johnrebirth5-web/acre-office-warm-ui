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
  return typeof body[key] === "string" ? body[key].trim() : null;
}

function isJsonObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

  const body = await request.json().catch(() => null);

  if (!isJsonObjectBody(body)) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const status = readOptionalString(body, "status");
  const externalStatus = readOptionalString(body, "externalStatus");
  const externalNote = readOptionalString(body, "externalNote");
  const externalNextActionAt = readOptionalString(body, "externalNextActionAt");
  const hasStatusUpdate = Boolean(status);
  const hasExternalUpdate = Boolean(
    externalStatus || externalNote || externalNextActionAt,
  );

  if (!hasStatusUpdate && !hasExternalUpdate) {
    return NextResponse.json(
      {
        error:
          "Provide either an appointment status update or an external coordination writeback.",
      },
      { status: 400 },
    );
  }

  if (hasStatusUpdate && hasExternalUpdate) {
    return NextResponse.json(
      {
        error:
          "Submit either an appointment status update or an external coordination writeback, not both.",
      },
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
      timeZone: context.currentUser.timezone,
      status,
      externalStatus,
      externalNote,
      externalNextActionAt,
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
