import { canManageOfficeHr } from "@acre/auth";
import { createHrInterview, listHrInterviews } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../_shared";

const interviewSchema = z.object({
  candidateId: z.string().trim().min(1),
  title: z.string().trim().optional().nullable(),
  mode: z.string().trim().optional().nullable(),
  startsAt: z.string().trim().optional().nullable(),
  endsAt: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  interviewerNames: z.array(z.string()).optional(),
  attendeeEmails: z.array(z.string()).optional(),
  ccEmails: z.array(z.string()).optional(),
  notes: z.string().trim().optional().nullable(),
  timeZone: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request);
  if (access.response) {
    return access.response;
  }

  const interviews = await listHrInterviews({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
  });

  return NextResponse.json({ interviews });
}

export async function POST(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHr);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, interviewSchema, {
    error: "Interview payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const interview = await createHrInterview({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      actorMembershipId: access.context.currentMembership.id,
    });

    return NextResponse.json({ interview }, { status: 201 });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to create interview.");
  }
}
