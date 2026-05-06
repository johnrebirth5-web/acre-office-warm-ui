import { canManageAdminOffice } from "@acre/auth";
import { createAdminEmailRequest, listAdminEmailRequests } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import {
  buildAdminOfficeErrorResponse,
  requireAdminOfficeApiContext,
} from "../_shared";

const emailRequestSchema = z.object({
  fullName: z.string().trim().min(1),
  preferredEmailPrefix: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const access = await requireAdminOfficeApiContext(request);
  if (access.response) {
    return access.response;
  }

  const snapshot = await listAdminEmailRequests({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
    status: request.nextUrl.searchParams.get("status"),
  });

  return NextResponse.json({ snapshot });
}

export async function POST(request: NextRequest) {
  const access = await requireAdminOfficeApiContext(request, canManageAdminOffice);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, emailRequestSchema, {
    error: "Email request payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const emailRequest = await createAdminEmailRequest({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      actorMembershipId: access.context.currentMembership.id,
    });
    return NextResponse.json({ emailRequest }, { status: 201 });
  } catch (error) {
    return buildAdminOfficeErrorResponse(error, "Failed to create email request.");
  }
}
