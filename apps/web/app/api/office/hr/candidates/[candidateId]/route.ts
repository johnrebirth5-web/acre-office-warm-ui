import { canManageOfficeHr } from "@acre/auth";
import { getHrCandidateDetail, updateHrCandidate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../../_shared";

type RouteContext = {
  params: Promise<{ candidateId: string }>;
};

const candidateUpdateSchema = z.object({
  officeId: z.string().trim().optional().nullable(),
  fullName: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional().nullable(),
  role: z.string().trim().optional().nullable(),
  positionTitle: z.string().trim().optional().nullable(),
  teamLeadName: z.string().trim().optional().nullable(),
  sourceType: z.string().trim().optional().nullable(),
  referrerName: z.string().trim().optional().nullable(),
  identityType: z.string().trim().optional().nullable(),
  resumeFileKey: z.string().trim().optional().nullable(),
  resumeDriveFileId: z.string().trim().optional().nullable(),
  status: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request);
  if (access.response) {
    return access.response;
  }

  const { candidateId } = await params;
  const snapshot = await getHrCandidateDetail({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
    candidateId,
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHr);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, candidateUpdateSchema, {
    error: "Candidate update payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { candidateId } = await params;
  try {
    const candidate = await updateHrCandidate({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
      candidateId,
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    return NextResponse.json({ candidate });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to update candidate.");
  }
}
