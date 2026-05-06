import { canManageAdminOffice } from "@acre/auth";
import { exportAdminOfficeEventSignupsCsv } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  buildAdminOfficeErrorResponse,
  requireAdminOfficeApiContext,
} from "../../../_shared";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const access = await requireAdminOfficeApiContext(request, canManageAdminOffice);
  if (access.response) {
    return access.response;
  }

  const { eventId } = await params;
  try {
    const csv = await exportAdminOfficeEventSignupsCsv({
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
      eventId,
    });

    if (!csv) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="admin-office-event-${encodeURIComponent(eventId)}-signups.csv"`,
      },
    });
  } catch (error) {
    return buildAdminOfficeErrorResponse(error, "Failed to export signups.");
  }
}
