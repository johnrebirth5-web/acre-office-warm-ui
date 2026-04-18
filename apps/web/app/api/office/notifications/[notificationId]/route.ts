import { canAccessOfficeNotifications } from "@acre/auth";
import {
  markOfficeNotificationRead,
  markOfficeNotificationUnread,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { archiveOfficeNotification, unarchiveOfficeNotification } from "../../../../../../../packages/db/src/notifications";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";
import { updateOfficeNotificationBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

type OfficeNotificationRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  markOfficeNotificationRead?: typeof markOfficeNotificationRead;
  markOfficeNotificationUnread?: typeof markOfficeNotificationUnread;
  archiveOfficeNotification?: typeof archiveOfficeNotification;
  unarchiveOfficeNotification?: typeof unarchiveOfficeNotification;
};

export async function handleUpdateOfficeNotificationPatch(
  request: NextRequest,
  notificationId: string,
  context: SessionMembershipContext,
  dependencies: OfficeNotificationRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeNotificationBodySchema, {
    error: "A valid notification action is required.",
    invalidJsonError: "Notification request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const scopedInput = {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    notificationId
  };

  const updated =
    body.action === "mark_read"
      ? await (
          dependencies.markOfficeNotificationRead ??
          markOfficeNotificationRead
        )(scopedInput)
      : body.action === "mark_unread"
        ? await (
            dependencies.markOfficeNotificationUnread ??
            markOfficeNotificationUnread
          )(scopedInput)
        : body.action === "archive"
          ? await (
              dependencies.archiveOfficeNotification ??
              archiveOfficeNotification
            )(scopedInput)
          : await (
              dependencies.unarchiveOfficeNotification ??
              unarchiveOfficeNotification
            )(scopedInput);

  if (!updated) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeNotifications(context.currentMembership)) {
    return NextResponse.json({ error: "Notification access required." }, { status: 403 });
  }

  const { notificationId } = await params;
  return handleUpdateOfficeNotificationPatch(request, notificationId, context);
}
