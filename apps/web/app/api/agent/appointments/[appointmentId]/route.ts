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

function mapAppointmentUpdateErrorStatus(message: string) {
  if (
    message.includes("still scheduled") ||
    message.includes("only be updated while the appointment is still scheduled")
  ) {
    return {
      status: 409,
      hint: "This record is already closed in Acre. Create or reopen a fresh appointment instead of writing back to the closed one.",
    };
  }

  if (message.includes("Clear the external note")) {
    return {
      status: 422,
      hint: "When coordination is reset to idle, clear the saved note and next-touch deadline in the same save.",
    };
  }

  if (
    message.includes("valid appointment status") ||
    message.includes("valid appointment external workflow status") ||
    message.includes("Next external touch")
  ) {
    return {
      status: 422,
      hint: "Check the selected status and promised next-touch checkpoint, then try again.",
    };
  }

  return {
    status: 400,
    hint: null,
  };
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
          "Provide either an appointment status update or an external coordination checkpoint.",
      },
      { status: 400 },
    );
  }

  if (hasStatusUpdate && hasExternalUpdate) {
    return NextResponse.json(
      {
        error:
          "Submit either an appointment status update or an external coordination checkpoint, not both.",
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

    return NextResponse.json({
      appointment,
      checkpoint: {
        label: appointment.coordinationLabel,
        detail: appointment.coordinationDetail,
        nextStep: appointment.coordinationNextStep,
        sourceNote:
          "Acre keeps confirmation, reschedule, and promised-touch checkpoints as the source of truth; the outside calendar or email draft stays manual unless it is written back here.",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update the appointment.";
    const mappedError = mapAppointmentUpdateErrorStatus(message);

    return NextResponse.json(
      {
        error: message,
        ...(mappedError.hint ? { hint: mappedError.hint } : {}),
      },
      { status: mappedError.status },
    );
  }
}
