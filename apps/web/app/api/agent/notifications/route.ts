import { hasAnyPermission } from "@acre/auth";
import { markOfficeNotificationsReadByIds } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (
    !hasAnyPermission(context.currentMembership, [
      "notifications:view",
      "events:view",
      "clients:view",
      "dashboard:view",
    ])
  ) {
    return NextResponse.json(
      { error: "Notification access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        notificationIds?: string[];
      }
    | null;

  if (body?.action !== "mark_all_read") {
    return NextResponse.json(
      { error: "A valid notification action is required." },
      { status: 400 },
    );
  }

  const updatedCount = await markOfficeNotificationsReadByIds({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    notificationIds: Array.isArray(body.notificationIds)
      ? body.notificationIds
      : [],
  });

  return NextResponse.json({ updatedCount });
}
