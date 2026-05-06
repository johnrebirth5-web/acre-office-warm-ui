import { canManageAdminOffice } from "@acre/auth";
import { createAdminOfficeEvent, listAdminOfficeEvents } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import {
  buildAdminOfficeErrorResponse,
  requireAdminOfficeApiContext,
} from "../_shared";

const eventSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  eventType: z.string().trim().optional().nullable(),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  isOnline: z.boolean().optional().nullable(),
  meetingUrl: z.string().trim().optional().nullable(),
  signupRequired: z.boolean().optional().nullable(),
  signupClosesAt: z.string().trim().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const access = await requireAdminOfficeApiContext(request);
  if (access.response) {
    return access.response;
  }

  const snapshot = await listAdminOfficeEvents({
    organizationId: access.context.currentOrganization.id,
    focusDate: request.nextUrl.searchParams.get("month"),
  });

  return NextResponse.json({ snapshot });
}

export async function POST(request: NextRequest) {
  const access = await requireAdminOfficeApiContext(request, canManageAdminOffice);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, eventSchema, {
    error: "Event payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const event = await createAdminOfficeEvent({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return buildAdminOfficeErrorResponse(error, "Failed to create event.");
  }
}
