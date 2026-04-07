import { can } from "@acre/auth";
import { getFrontOfficeAppointmentCalendarExport } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    appointmentId: string;
  }>;
};

function mapAppointmentIcsErrorStatus(message: string) {
  if (message.includes("Only scheduled appointments")) {
    return {
      status: 409,
      hint: "ICS export only stays available while the appointment is still scheduled in Acre.",
    };
  }

  return {
    status: 400,
    hint: null,
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
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

  const { appointmentId } = await params;

  try {
    const exportPayload = await getFrontOfficeAppointmentCalendarExport({
      organizationId: context.currentOrganization.id,
      appointmentId,
      ownerMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    });

    if (!exportPayload) {
      return NextResponse.json(
        { error: "Appointment not found." },
        { status: 404 },
      );
    }

    return new NextResponse(exportPayload.content, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${exportPayload.fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not open the appointment ICS export.";
    const mappedError = mapAppointmentIcsErrorStatus(message);

    return NextResponse.json(
      {
        error: message,
        ...(mappedError.hint ? { hint: mappedError.hint } : {}),
      },
      { status: mappedError.status },
    );
  }
}
