import {
  cancelAdminOfficeEventSignup,
  signupForAdminOfficeEvent,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  buildAdminOfficeErrorResponse,
  requireAdminOfficeApiContext,
} from "../../../_shared";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireAdminOfficeApiContext(request);
  if (access.response) {
    return access.response;
  }

  const { eventId } = await params;
  try {
    await signupForAdminOfficeEvent({
      organizationId: access.context.currentOrganization.id,
      eventId,
      membershipId: access.context.currentMembership.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return buildAdminOfficeErrorResponse(error, "Failed to sign up.");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const access = await requireAdminOfficeApiContext(request);
  if (access.response) {
    return access.response;
  }

  const { eventId } = await params;
  try {
    await cancelAdminOfficeEventSignup({
      organizationId: access.context.currentOrganization.id,
      eventId,
      membershipId: access.context.currentMembership.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return buildAdminOfficeErrorResponse(error, "Failed to cancel signup.");
  }
}
