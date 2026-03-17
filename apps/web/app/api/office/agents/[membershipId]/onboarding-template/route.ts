import { canManageOfficeOnboarding } from "@acre/auth";
import { applyAgentOnboardingTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(_request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeOnboarding(context.currentMembership)) {
    return NextResponse.json({ error: "Onboarding management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;

  try {
    const result = await applyAgentOnboardingTemplate({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      membershipId
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply onboarding template." },
      { status: 400 }
    );
  }
}
