import { canAccessOfficeNotifications } from "@acre/auth";
import {
  markAllOfficeNotificationsRead,
  markOfficeNotificationsReadByIds,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../lib/api/parse-body";
import { requireRequestOfficeSession } from "../../../../lib/auth-session";
import { markOfficeNotificationsBodySchema } from "./route.schema";

type OfficeNotificationsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  markOfficeNotificationsReadByIds?: typeof markOfficeNotificationsReadByIds;
  markAllOfficeNotificationsRead?: typeof markAllOfficeNotificationsRead;
};

export async function handleMarkOfficeNotificationsPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeNotificationsRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, markOfficeNotificationsBodySchema, {
    error: "A valid notification action is required.",
    invalidJsonError: "Notification request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  const count = Array.isArray(body.notificationIds)
    ? await (
        dependencies.markOfficeNotificationsReadByIds ??
        markOfficeNotificationsReadByIds
      )({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        membershipId: context.currentMembership.id,
        notificationIds: body.notificationIds
      })
    : await (
        dependencies.markAllOfficeNotificationsRead ??
        markAllOfficeNotificationsRead
      )({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        membershipId: context.currentMembership.id,
        type: body.type,
        category: body.category
      });

  return NextResponse.json({ updatedCount: count });
}

export async function POST(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeNotifications(context.currentMembership)) {
    return NextResponse.json({ error: "Notification access required." }, { status: 403 });
  }

  return handleMarkOfficeNotificationsPost(request, context);
}
