import { canManageAdminOffice } from "@acre/auth";
import { updateAdminEmailRequestStatus } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import {
  buildAdminOfficeErrorResponse,
  requireAdminOfficeApiContext,
} from "../../_shared";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

const emailRequestStatusSchema = z.object({
  status: z.enum(["pending", "approved", "completed", "rejected"]),
  notes: z.string().trim().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireAdminOfficeApiContext(request, canManageAdminOffice);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, emailRequestStatusSchema, {
    error: "Email request status payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { requestId } = await params;
  try {
    const emailRequest = await updateAdminEmailRequestStatus({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
      requestId,
    });

    if (!emailRequest) {
      return NextResponse.json({ error: "Email request not found." }, { status: 404 });
    }

    return NextResponse.json({ emailRequest });
  } catch (error) {
    return buildAdminOfficeErrorResponse(error, "Failed to update email request.");
  }
}
