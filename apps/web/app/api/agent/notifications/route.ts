import { hasAnyPermission } from "@acre/auth";
import {
  markOfficeNotificationsReadByIds,
  markOfficeNotificationsUnreadByIds,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

function readNotificationIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

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

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    notificationIds?: string[];
  } | null;
  const isMarkReadAction =
    body?.action === "mark_all_read" || body?.action === "mark_read";
  const isMarkUnreadAction =
    body?.action === "mark_all_unread" || body?.action === "mark_unread";
  const notificationIds = readNotificationIds(body?.notificationIds);

  if (!body?.action || (!isMarkReadAction && !isMarkUnreadAction)) {
    return NextResponse.json(
      { error: "A valid notification action is required." },
      { status: 400 },
    );
  }

  if (!notificationIds.length) {
    return NextResponse.json(
      { error: "At least one valid notification ID is required." },
      { status: 400 },
    );
  }

  const updatedCount = isMarkReadAction
    ? await markOfficeNotificationsReadByIds({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        membershipId: context.currentMembership.id,
        notificationIds,
      })
    : await markOfficeNotificationsUnreadByIds({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        membershipId: context.currentMembership.id,
        notificationIds,
      });

  return NextResponse.json({
    ok: true,
    updatedCount,
    requestedCount: notificationIds.length,
    readState: isMarkReadAction ? "read" : "unread",
  });
}
