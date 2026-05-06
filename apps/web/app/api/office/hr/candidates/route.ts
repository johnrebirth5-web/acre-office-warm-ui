import { canManageOfficeHr } from "@acre/auth";
import { createHrCandidate, listHrCandidates } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../_shared";

const candidateSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().nullable(),
  role: z.string().trim().optional().nullable(),
  positionTitle: z.string().trim().optional().nullable(),
  teamLeadName: z.string().trim().optional().nullable(),
  sourceType: z.string().trim().optional().nullable(),
  referrerName: z.string().trim().optional().nullable(),
  identityType: z.string().trim().optional().nullable(),
  resumeFileKey: z.string().trim().optional().nullable(),
  resumeDriveFileId: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request);
  if (access.response) {
    return access.response;
  }

  const snapshot = await listHrCandidates({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
    status: request.nextUrl.searchParams.get("status"),
  });

  return NextResponse.json({ snapshot });
}

export async function POST(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHr);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, candidateSchema, {
    error: "Candidate payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const candidate = await createHrCandidate({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      actorMembershipId: access.context.currentMembership.id,
    });
    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to create candidate.");
  }
}
