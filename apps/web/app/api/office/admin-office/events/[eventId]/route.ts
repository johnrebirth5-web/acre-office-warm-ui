import { canManageAdminOffice } from "@acre/auth";
import { updateAdminOfficeEvent } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import {
  buildAdminOfficeErrorResponse,
  requireAdminOfficeApiContext,
} from "../../_shared";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

const eventUpdateSchema = z.object({
  title: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  eventType: z.string().trim().optional().nullable(),
  startsAt: z.string().trim().optional().nullable(),
  endsAt: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  signupRequired: z.boolean().optional().nullable(),
  signupClosesAt: z.string().trim().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireAdminOfficeApiContext(request, canManageAdminOffice);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, eventUpdateSchema, {
    error: "Event update payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { eventId } = await params;
  try {
    const event = await updateAdminOfficeEvent({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
      eventId,
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    return buildAdminOfficeErrorResponse(error, "Failed to update event.");
  }
}
