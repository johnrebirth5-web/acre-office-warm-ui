import { canAccessOfficeNotifications } from "@acre/auth";
import { markOfficeNotificationRead, markOfficeNotificationUnread } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeNotifications(context.currentMembership)) {
    return NextResponse.json({ error: "Notification access required." }, { status: 403 });
  }

  const { notificationId } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  if (!body?.action || (body.action !== "mark_read" && body.action !== "mark_unread")) {
    return NextResponse.json({ error: "A valid notification action is required." }, { status: 400 });
  }

  const updated =
    body.action === "mark_read"
      ? await markOfficeNotificationRead({
          organizationId: context.currentOrganization.id,
          officeId: context.currentOffice?.id ?? null,
          membershipId: context.currentMembership.id,
          notificationId
        })
      : await markOfficeNotificationUnread({
          organizationId: context.currentOrganization.id,
          officeId: context.currentOffice?.id ?? null,
          membershipId: context.currentMembership.id,
          notificationId
        });

  if (!updated) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
