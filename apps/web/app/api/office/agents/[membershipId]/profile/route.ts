import { canManageOfficeAgents } from "@acre/auth";
import { saveAgentProfile } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAgents(context.currentMembership)) {
    return NextResponse.json({ error: "Agent management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  const body = (await request.json().catch(() => null)) as
      | {
        displayName?: string;
        bio?: string;
        notes?: string;
        licenseNumber?: string;
        licenseState?: string;
        startDate?: string;
        commissionPlanName?: string;
        splitTemplateId?: string;
        customAgentPercent?: string;
        commissionEffectiveFrom?: string;
        commissionEffectiveTo?: string;
        avatarUrl?: string;
        internalExtension?: string;
      }
    | null;

  try {
    const profile = await saveAgentProfile({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId,
      actorMembershipId: context.currentMembership.id,
      displayName: body?.displayName,
      bio: body?.bio,
      notes: body?.notes,
      licenseNumber: body?.licenseNumber,
      licenseState: body?.licenseState,
      startDate: body?.startDate,
      commissionPlanName: body?.commissionPlanName,
      splitTemplateId: body?.splitTemplateId,
      customAgentPercent: body?.customAgentPercent,
      commissionEffectiveFrom: body?.commissionEffectiveFrom,
      commissionEffectiveTo: body?.commissionEffectiveTo,
      avatarUrl: body?.avatarUrl,
      internalExtension: body?.internalExtension
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save agent profile." }, { status: 400 });
  }
}
