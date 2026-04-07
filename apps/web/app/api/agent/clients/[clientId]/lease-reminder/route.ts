import { can } from "@acre/auth";
import { saveFrontOfficeClientLeaseReminder } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "clients:manage")) {
    return NextResponse.json(
      { error: "Client management access required." },
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

  const leaseEndDate =
    typeof body.leaseEndDate === "string" ? body.leaseEndDate.trim() : "";
  const leaseReminderAt =
    typeof body.leaseReminderAt === "string" ? body.leaseReminderAt.trim() : "";

  if (leaseEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(leaseEndDate)) {
    return NextResponse.json(
      { error: "Lease end date must use YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  if (leaseReminderAt && !/^\d{4}-\d{2}-\d{2}$/.test(leaseReminderAt)) {
    return NextResponse.json(
      { error: "Lease reminder date must use YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  const { clientId } = await params;

  try {
    const reminder = await saveFrontOfficeClientLeaseReminder({
      organizationId: context.currentOrganization.id,
      clientId,
      actorMembershipId: context.currentMembership.id,
      actorOfficeId: context.currentOffice?.id ?? null,
      leaseEndDate,
      leaseReminderAt,
    });

    if (!reminder) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    return NextResponse.json({ reminder });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save the lease reminder.",
      },
      { status: 400 },
    );
  }
}
