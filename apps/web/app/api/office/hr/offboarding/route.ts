import { canManageOfficeHrOffboarding } from "@acre/auth";
import { createHrOffboardingCase, listHrOffboardingCases } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../_shared";

const offboardingSchema = z.object({
  candidateId: z.string().trim().optional().nullable(),
  membershipId: z.string().trim().optional().nullable(),
  position: z.string().trim().optional().nullable(),
  directSupervisor: z.string().trim().optional().nullable(),
  lastWorkingDate: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
  salespersonLicenseUnlinkRequired: z.boolean().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request);
  if (access.response) {
    return access.response;
  }

  const cases = await listHrOffboardingCases({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
  });

  return NextResponse.json({ cases });
}

export async function POST(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHrOffboarding);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, offboardingSchema, {
    error: "Offboarding case payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const offboardingCase = await createHrOffboardingCase({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      actorMembershipId: access.context.currentMembership.id,
    });
    return NextResponse.json({ case: offboardingCase }, { status: 201 });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to create offboarding case.");
  }
}
