import { activityLogActions, prisma, recordActivityLogEvent } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext, getSessionCookieName, getSessionCookieSettings } from "../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../lib/request-origin";

export async function POST(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const context = await getRequestSessionContext(request, {
    allowPasswordChangeRequired: true
  });

  if (context) {
    await recordActivityLogEvent(prisma, {
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      entityType: "session",
      entityId: context.currentMembership.id,
      action: activityLogActions.authLogout,
      payload: {
        officeId: context.currentOffice?.id ?? null,
        objectLabel: `${context.currentUser.firstName} ${context.currentUser.lastName} · ${context.currentUser.email}`,
        details: [`Role: ${context.currentMembership.role}`, `Office: ${context.currentOffice?.name ?? context.currentOrganization.name}`]
      }
    });
  }

  const response = NextResponse.redirect(new URL("/login", requestOrigin), 303);

  response.cookies.set(getSessionCookieName(), "", {
    ...getSessionCookieSettings(),
    expires: new Date(0),
    maxAge: 0
  });

  return response;
}
