import { canManageOfficeHrOffboarding } from "@acre/auth";
import { getHrOffboardingCaseDetail, updateHrOffboardingCase } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../../_shared";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

const offboardingUpdateSchema = z.object({
  status: z.string().trim().optional().nullable(),
  financeHandoffStatus: z.string().trim().optional().nullable(),
  commissionSettlementTriggered: z.boolean().optional().nullable(),
  accessClosed: z.boolean().optional().nullable(),
  salespersonLicenseUnlinked: z.boolean().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request);
  if (access.response) {
    return access.response;
  }

  const { caseId } = await params;
  const snapshot = await getHrOffboardingCaseDetail({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
    caseId,
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Offboarding case not found." }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHrOffboarding);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, offboardingUpdateSchema, {
    error: "Offboarding update payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { caseId } = await params;
  try {
    const offboardingCase = await updateHrOffboardingCase({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
      caseId,
    });

    if (!offboardingCase) {
      return NextResponse.json({ error: "Offboarding case not found." }, { status: 404 });
    }

    return NextResponse.json({ case: offboardingCase });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to update offboarding case.");
  }
}
