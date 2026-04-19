import { canManageOfficeOnboarding } from "@acre/auth";
import { updateAgentOnboardingItem } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { updateAgentOnboardingItemBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    membershipId: string;
    itemId: string;
  }>;
};

export async function handleUpdateAgentOnboardingItemPatch(
  request: NextRequest,
  membershipId: string,
  itemId: string,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    updateAgentOnboardingItem?: typeof updateAgentOnboardingItem;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, updateAgentOnboardingItemBodySchema, {
    error: "Agent onboarding payload is invalid.",
    invalidJsonError: "Agent onboarding payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const item = await (dependencies.updateAgentOnboardingItem ?? updateAgentOnboardingItem)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      membershipId,
      itemId,
      title: body.title,
      description: body.description,
      category: body.category,
      dueAt: body.dueAt,
      status: body.status
    });

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update onboarding item." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeOnboarding(context.currentMembership)) {
    return NextResponse.json({ error: "Onboarding management permission required." }, { status: 403 });
  }

  const { membershipId, itemId } = await params;
  return handleUpdateAgentOnboardingItemPatch(request, membershipId, itemId, context);
}
