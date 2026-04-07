import { can } from "@acre/auth";
import {
  formatFrontOfficeAppointmentBridgeActionLabel,
  getFrontOfficeAppointmentBridgeResult,
  isFrontOfficeAppointmentBridgeAction,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    appointmentId: string;
  }>;
};

function mapAppointmentBridgeErrorStatus(message: string) {
  if (
    message.includes("Only scheduled appointments") ||
    message.includes("email target is required")
  ) {
    return 409;
  }

  return 400;
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

  const action = request.nextUrl.searchParams.get("action");
  const responseFormat = request.nextUrl.searchParams.get("format");

  if (!isFrontOfficeAppointmentBridgeAction(action)) {
    return NextResponse.json(
      { error: "A valid appointment bridge action is required." },
      { status: 400 },
    );
  }

  if (responseFormat && responseFormat !== "json") {
    return NextResponse.json(
      { error: "A valid bridge response format is required." },
      { status: 400 },
    );
  }

  const { appointmentId } = await params;

  try {
    const result = await getFrontOfficeAppointmentBridgeResult({
      organizationId: context.currentOrganization.id,
      appointmentId,
      ownerMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
      action,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Appointment not found." },
        { status: 404 },
      );
    }

    if (responseFormat === "json") {
      return NextResponse.json(
        {
          action,
          actionLabel: formatFrontOfficeAppointmentBridgeActionLabel(action),
          result,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (result.kind === "redirect") {
      return new NextResponse(null, {
        status: 307,
        headers: {
          Location: result.href,
          "Cache-Control": "no-store",
        },
      });
    }

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${result.fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not open the appointment bridge.";

    return NextResponse.json(
      { error: message },
      { status: mapAppointmentBridgeErrorStatus(message) },
    );
  }
}
