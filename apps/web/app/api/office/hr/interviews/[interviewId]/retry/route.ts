import { canManageOfficeHr } from "@acre/auth";
import { retryHrInterviewGoogleSync } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../../../_shared";

type RouteContext = {
  params: Promise<{ interviewId: string }>;
};

const retrySchema = z.object({
  timeZone: z.string().trim().optional().nullable(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHr);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, retrySchema, {
    error: "Retry payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { interviewId } = await params;
  try {
    await retryHrInterviewGoogleSync({
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
      interviewId,
      timeZone: parsed.data.timeZone,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to retry Google sync.");
  }
}
