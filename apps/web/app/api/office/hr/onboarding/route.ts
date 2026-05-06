import { canManageOfficeHr } from "@acre/auth";
import { createHrOnboardingCase, listHrOnboardingCases } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../_shared";

const onboardingSchema = z.object({
  candidateId: z.string().trim().optional().nullable(),
  membershipId: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request);
  if (access.response) {
    return access.response;
  }

  const cases = await listHrOnboardingCases({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
  });

  return NextResponse.json({ cases });
}

export async function POST(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHr);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, onboardingSchema, {
    error: "Onboarding case payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const onboardingCase = await createHrOnboardingCase({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      actorMembershipId: access.context.currentMembership.id,
    });
    return NextResponse.json({ case: onboardingCase }, { status: 201 });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to create onboarding case.");
  }
}
