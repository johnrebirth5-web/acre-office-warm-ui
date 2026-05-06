import { canManageOfficeHr } from "@acre/auth";
import { issueHrOnboardingToken } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../../../_shared";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHr);
  if (access.response) {
    return access.response;
  }

  const { caseId } = await params;
  try {
    const token = await issueHrOnboardingToken({
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
      caseId,
    });
    return NextResponse.json(token);
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to issue onboarding token.");
  }
}
