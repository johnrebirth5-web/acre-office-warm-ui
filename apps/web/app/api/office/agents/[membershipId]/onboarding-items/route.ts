import { canManageOfficeOnboarding } from "@acre/auth";
import { createAgentOnboardingItem } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeOnboarding(context.currentMembership)) {
    return NextResponse.json({ error: "Onboarding management permission required." }, { status: 403 });
  }

  const { membershipId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        category?: string;
        dueAt?: string;
      }
    | null;

  try {
    const item = await createAgentOnboardingItem({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      membershipId,
      title: body?.title ?? "",
      description: body?.description,
      category: body?.category,
      dueAt: body?.dueAt
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create onboarding item." }, { status: 400 });
  }
}
