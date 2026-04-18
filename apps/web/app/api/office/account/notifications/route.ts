import {
  saveOfficeAccountNotificationPreferences,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";
import { updateOfficeAccountNotificationsBodySchema } from "./route.schema";

type OfficeAccountNotificationsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveOfficeAccountNotificationPreferences?: typeof saveOfficeAccountNotificationPreferences;
};

export async function handleUpdateOfficeAccountNotificationsPatch(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeAccountNotificationsRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeAccountNotificationsBodySchema, {
    error: "Valid notification preferences are required.",
    invalidJsonError: "Notification preferences request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const saved = await (
    dependencies.saveOfficeAccountNotificationPreferences ??
    saveOfficeAccountNotificationPreferences
  )({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    inAppEnabled: body.inAppEnabled,
    approvalAlertsEnabled: body.approvalAlertsEnabled,
    taskRemindersEnabled: body.taskRemindersEnabled,
    offerAlertsEnabled: body.offerAlertsEnabled,
    messageAlertsEnabled: body.messageAlertsEnabled
  });

  if (!saved) {
    return NextResponse.json({ error: "Notification preferences not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, saved });
}

export async function PATCH(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return handleUpdateOfficeAccountNotificationsPatch(request, context);
}
