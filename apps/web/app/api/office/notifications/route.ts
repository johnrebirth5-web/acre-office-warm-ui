import { canAccessOfficeNotifications } from "@acre/auth";
import { markAllOfficeNotificationsRead, markOfficeNotificationsReadByIds } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeNotifications(context.currentMembership)) {
    return NextResponse.json({ error: "Notification access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        notificationIds?: string[];
        type?: string;
        category?: string;
      }
    | null;

  if (body?.action !== "mark_all_read") {
    return NextResponse.json({ error: "A valid notification action is required." }, { status: 400 });
  }

  const count = Array.isArray(body.notificationIds)
    ? await markOfficeNotificationsReadByIds({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        membershipId: context.currentMembership.id,
        notificationIds: body.notificationIds
      })
    : await markAllOfficeNotificationsRead({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        membershipId: context.currentMembership.id,
        type: body.type,
        category: body.category
      });

  return NextResponse.json({ updatedCount: count });
}
